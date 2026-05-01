#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
COMPOSE_CMD=()
DOCKER_CMD=()
COMPOSE_NEEDS_SUDO=0

# ── Port helper ────────────────────────────────────────────────
find_free_port() {
  local start_port="$1"
  local candidate="$start_port"
  local i

  is_port_busy() {
    local port="$1"
    if command -v ss >/dev/null 2>&1; then
      ss -H -ltn "( sport = :${port} )" | grep -q . && return 0
    fi
    lsof -iTCP:"${port}" -sTCP:LISTEN -t >/dev/null 2>&1 && return 0
    return 1
  }

  for ((i = 0; i < 50; i++)); do
    if ! is_port_busy "$candidate"; then
      echo "$candidate"
      return 0
    fi
    candidate=$((candidate + 1))
  done
  return 1
}

# ── Kill existing processes ────────────────────────────────────
kill_existing_processes() {
  local pids=()
  local pid
  local cwd

  add_repo_pid() {
    local candidate="$1"
    [ -z "$candidate" ] && return 0
    [ "$candidate" = "$$" ] && return 0
    cwd="$(readlink -f "/proc/${candidate}/cwd" 2>/dev/null || true)"
    case "$cwd" in
      "$ROOT_DIR"|"$ROOT_DIR"/*)
        pids+=("$candidate")
        ;;
    esac
  }

  while IFS= read -r pid; do
    add_repo_pid "$pid"
  done < <(pgrep -f "next dev" || true)

  while IFS= read -r pid; do
    add_repo_pid "$pid"
  done < <(pgrep -f "uvicorn|python .*main.py|python3 .*main.py" || true)

  if [ ${#pids[@]} -eq 0 ]; then
    echo "ℹ️  No existing Breez dev processes found."
    return 0
  fi

  mapfile -t pids < <(printf '%s\n' "${pids[@]}" | sort -u)
  echo "⚠️  Found PIDs: ${pids[*]}"
  echo "🧹 Stopping..."

  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  sleep 1
  for pid in "${pids[@]}"; do
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  done
  echo "✅ Cleaned up"
}

wait_for_postgres() {
  local db_user="${POSTGRES_USER:-iqair_user}"
  local db_name="${POSTGRES_DB:-iqair}"
  local attempts="${POSTGRES_WAIT_ATTEMPTS:-60}"
  local i
  local output=""

  for ((i = 1; i <= attempts; i++)); do
    if output="$("${COMPOSE_CMD[@]}" exec -T db pg_isready -U "$db_user" -d "$db_name" 2>&1)"; then
      echo "✅ Postgres ready"
      return 0
    fi

    if (( i == 1 || i % 10 == 0 )); then
      echo "   Still waiting (${i}/${attempts})... ${output}"
    fi
    sleep 1
  done

  echo "❌ Postgres did not become ready after ${attempts}s."
  echo "Last readiness output:"
  echo "$output"
  echo ""
  echo "Container status:"
  "${COMPOSE_CMD[@]}" ps db || true
  echo ""
  echo "Recent Postgres logs:"
  "${COMPOSE_CMD[@]}" logs --tail=80 db || true
  exit 1
}

sync_postgres_host_port() {
  local mapped_port
  mapped_port="$("${COMPOSE_CMD[@]}" port db 5432 2>/dev/null | awk -F: 'END {print $NF}' || true)"
  if [[ "$mapped_port" =~ ^[0-9]+$ ]]; then
    POSTGRES_PORT="$mapped_port"
    export POSTGRES_PORT
  fi
}

start_postgres_container() {
  local output=""
  local attempt=0
  local max_attempts=3

  while (( attempt < max_attempts )); do
    attempt=$((attempt + 1))

    if output="$("${COMPOSE_CMD[@]}" up -d db 2>&1)"; then
      return 0
    fi

    if echo "$output" | grep -Eqi 'Bind for .*failed: port is already allocated|port is already allocated'; then
      echo "⚠️  Port ${POSTGRES_PORT} is already in use, trying another one..."
      POSTGRES_PORT="$(find_free_port $((POSTGRES_PORT + 1)))"
      if [ -z "$POSTGRES_PORT" ]; then
        echo "❌ Could not find a free host port for Postgres."
        return 1
      fi
      export POSTGRES_PORT
      continue
    fi

    echo "$output"
    return 1
  done

  echo "❌ Could not start Postgres after trying multiple ports."
  return 1
}

# ── Compose command detection ──────────────────────────────────
detect_compose() {
  local docker_compose_output=""
  local docker_compose_bin_output=""

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    DOCKER_CMD=(docker)
    COMPOSE_CMD=(docker compose)
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    docker_compose_output="$(docker compose version 2>&1 || true)"
    if echo "$docker_compose_output" | grep -qi "sudo"; then
      if command -v sudo >/dev/null 2>&1; then
        DOCKER_CMD=(sudo -E docker)
        COMPOSE_CMD=(sudo -E docker compose)
        COMPOSE_NEEDS_SUDO=1
        return 0
      fi
    fi
  fi

  if command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    DOCKER_CMD=(docker)
    COMPOSE_CMD=(docker-compose)
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker_compose_bin_output="$(docker-compose version 2>&1 || true)"
    if echo "$docker_compose_bin_output" | grep -qi "sudo"; then
      if command -v sudo >/dev/null 2>&1; then
        DOCKER_CMD=(sudo -E docker)
        COMPOSE_CMD=(sudo -E docker-compose)
        COMPOSE_NEEDS_SUDO=1
        return 0
      fi
    fi
  fi

  COMPOSE_CMD=()
}

check_python_venv_support() {
  if python3 -m ensurepip --version >/dev/null 2>&1; then
    return 0
  fi

  echo "❌ Python venv support is missing for $(python3 --version 2>/dev/null || echo python3)."
  echo "Install it, then rerun this script:"
  echo "   sudo apt install python3.12-venv"
  echo ""
  echo "If your distro uses the generic package name, use:"
  echo "   sudo apt install python3-venv"
  exit 1
}

move_broken_venv_if_needed() {
  local venv_path="$1"
  local backup_path

  if [ -d "$venv_path" ] && [ ! -f "$venv_path/bin/activate" ]; then
    backup_path="${venv_path}.broken.$(date +%Y%m%d%H%M%S)"
    echo "⚠️  Found incomplete venv at $venv_path"
    echo "🧹 Moving it to $backup_path"
    mv "$venv_path" "$backup_path"
  fi
}

echo "🚀 Breez — Dev Startup"
echo "─────────────────────────────────"

# ── 1. Check folders ──────────────────────────────────────────
[ ! -d "$BACKEND_DIR" ] && echo "❌ backend/ folder not found" && exit 1
[ ! -d "$FRONTEND_DIR" ] && echo "❌ frontend/ folder not found" && exit 1
echo "✅ Project structure OK"

# ── 2. Optional cleanup ───────────────────────────────────────
echo ""
read -p "Kill existing Python/Next.js processes before starting? [y/N]: " KILL_OLD
if [[ "$KILL_OLD" =~ ^[Yy]$ ]]; then
  kill_existing_processes
fi

# ── 3. Choose run mode ────────────────────────────────────────
echo ""
echo "How do you want to run the app?"
echo "  1) Local only       (venv Python + npm run dev, no Docker)"
echo "  2) DB via Docker    (Postgres in Docker + local Python + npm)"
echo "  3) Full Docker      (everything in Docker)"
echo ""
read -p "Enter choice [1/2/3]: " MODE

# ── 4. Handle Docker modes ────────────────────────────────────
detect_compose

if [ "$MODE" = "2" ] || [ "$MODE" = "3" ]; then
  if [ ${#COMPOSE_CMD[@]} -eq 0 ]; then
    echo "❌ Docker Compose is not available from this shell."
    echo "Install Docker Compose, fix Docker permissions, or use mode 1."
    exit 1
  fi

  if [ "$COMPOSE_NEEDS_SUDO" = "1" ]; then
    echo "ℹ️  Docker requires sudo on this machine; Docker commands may ask for your password."
    if ! sudo -v; then
      echo "❌ Could not get sudo access for Docker commands."
      exit 1
    fi
  fi

  if ! "${DOCKER_CMD[@]}" info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Start Docker first."
    if [ "$COMPOSE_NEEDS_SUDO" = "1" ]; then
      echo "If Docker is running, try rerunning this script from a normal terminal so sudo can prompt."
    fi
    exit 1
  fi

  if [ -z "${POSTGRES_PORT:-}" ]; then
    POSTGRES_PORT="$(find_free_port 5432)"
    export POSTGRES_PORT
  fi

  if [ "$MODE" = "3" ]; then
    echo ""
    echo "🐳 Starting full Docker stack..."
    cd "$ROOT_DIR"
    "${COMPOSE_CMD[@]}" up -d --no-recreate --build
    echo "✅ All services started via Docker."
    echo "🌐 Frontend: http://localhost:3000"
    echo "🔧 Backend:  http://localhost:8000"
    echo ""
    echo "📋 Useful commands:"
    echo "   docker compose logs -f          # all logs"
    echo "   docker compose logs -f backend  # backend only"
    echo "   docker compose down             # stop (data kept)"
    exit 0
  fi

  # Mode 2: only start DB if not already running
  echo ""
  cd "$ROOT_DIR"
  echo "📦 Starting Postgres in Docker on host port ${POSTGRES_PORT}..."
  start_postgres_container
  sync_postgres_host_port
  echo "📦 Postgres host port: ${POSTGRES_PORT}"
  echo "⏳ Waiting for Postgres..."
  wait_for_postgres
fi

# ── 5. Find free ports ────────────────────────────────────────
echo ""
echo "🔍 Finding available ports..."
FRONTEND_PORT="$(find_free_port 3000)"
BACKEND_PORT="$(find_free_port 8000)"
echo "✅ Frontend port: $FRONTEND_PORT"
echo "✅ Backend port:  $BACKEND_PORT"

# ── 5b. Sync frontend .env.local with chosen backend/DB config ─
DB_HOST="${TYNYS_DB_HOST:-${PGHOST:-${POSTGRES_HOST:-localhost}}}"
DB_USER="${TYNYS_DB_USER:-${PGUSER:-${POSTGRES_USER:-iqair_user}}}"
DB_PASSWORD="${TYNYS_DB_PASSWORD:-${PGPASSWORD:-${POSTGRES_PASSWORD:-zwNxu4QJzMc35yN2}}}"
DB_NAME="${TYNYS_DB_NAME:-${PGDATABASE:-${POSTGRES_DB:-iqair}}}"

if [ -n "${TYNYS_DB_PORT:-}" ]; then
  DB_PORT="$TYNYS_DB_PORT"
elif [ -n "${PGPORT:-}" ]; then
  DB_PORT="$PGPORT"
elif [ -n "${POSTGRES_PORT:-}" ]; then
  DB_PORT="$POSTGRES_PORT"
else
  DB_PORT="5432"
fi

DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

ENV_LOCAL_FILE="$FRONTEND_DIR/.env.local"
TMP_ENV_LOCAL="$(mktemp)"

{
  echo "# Auto-generated by scripts/start.sh"
  echo "NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}"
  echo "DB_URL=${DB_URL}"
  echo "DATABASE_URL=${DB_URL}"
  echo "TYNYS_DB_URL=${DB_URL}"
  echo "TYNYS_DB_HOST=${DB_HOST}"
  echo "TYNYS_DB_PORT=${DB_PORT}"
  echo "TYNYS_DB_USER=${DB_USER}"
  echo "TYNYS_DB_PASSWORD=${DB_PASSWORD}"
  echo "TYNYS_DB_NAME=${DB_NAME}"
} > "$TMP_ENV_LOCAL"

if [ -f "$ENV_LOCAL_FILE" ]; then
  grep -Ev '^(NEXT_PUBLIC_API_URL|DB_URL|DATABASE_URL|TYNYS_DB_URL|TYNYS_DB_HOST|TYNYS_DB_PORT|TYNYS_DB_USER|TYNYS_DB_PASSWORD|TYNYS_DB_NAME)=' "$ENV_LOCAL_FILE" >> "$TMP_ENV_LOCAL" || true
fi

mv "$TMP_ENV_LOCAL" "$ENV_LOCAL_FILE"
echo "✅ Updated .env.local → API URL: http://localhost:${BACKEND_PORT}"
echo "✅ Updated .env.local → DB URL:  postgresql://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# ── 6. Setup venv if missing ──────────────────────────────────
echo ""
echo "🐍 Checking Python venv..."
cd "$BACKEND_DIR"

move_broken_venv_if_needed "$BACKEND_DIR/venv"
move_broken_venv_if_needed "$ROOT_DIR/venv"

if [ ! -f "venv/bin/activate" ] && [ ! -f "$ROOT_DIR/venv/bin/activate" ]; then
  check_python_venv_support
  echo "📦 Creating venv..."
  python3 -m venv venv
fi

if [ -f "$BACKEND_DIR/venv/bin/activate" ]; then
  source "$BACKEND_DIR/venv/bin/activate"
  VENV_DIR="$BACKEND_DIR/venv"
elif [ -f "$ROOT_DIR/venv/bin/activate" ]; then
  source "$ROOT_DIR/venv/bin/activate"
  VENV_DIR="$ROOT_DIR/venv"
fi

if [ -f "requirements.txt" ]; then
  echo "📦 Installing/checking Python dependencies..."
  pip install -r requirements.txt -q
fi

# ── 7. Start Python backend ───────────────────────────────────
echo ""
echo "🐍 Starting Python backend..."

UVICORN_BIN=""
if [ -f "$VENV_DIR/bin/uvicorn" ]; then
  UVICORN_BIN="$VENV_DIR/bin/uvicorn"
fi

if [ -n "$UVICORN_BIN" ]; then
  "$UVICORN_BIN" main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
else
  python main.py &
fi
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# ── 8. Start Next.js frontend ─────────────────────────────────
echo ""
echo "⚛️  Starting Next.js frontend..."
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  npm install
fi

npm run dev -- --port "$FRONTEND_PORT" &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

# ── 9. Done ───────────────────────────────────────────────────
echo ""
echo "✅ Breez is running!"
echo "🌐 Frontend: http://localhost:${FRONTEND_PORT}"
echo "🔧 Backend:  http://localhost:${BACKEND_PORT}"
echo ""
echo "Press Ctrl+C to stop both."

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait $BACKEND_PID $FRONTEND_PID
