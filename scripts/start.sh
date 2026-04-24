#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

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

  while IFS= read -r pid; do
    [ -n "$pid" ] && pids+=("$pid")
  done < <(pgrep -f "next dev" || true)

  while IFS= read -r pid; do
    [ -n "$pid" ] && pids+=("$pid")
  done < <(pgrep -f "python" || true)

  if [ ${#pids[@]} -eq 0 ]; then
    echo "ℹ️  No existing processes found."
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

# ── Compose command detection ──────────────────────────────────
detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
  else
    COMPOSE_CMD=()
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
    echo "❌ Docker Compose not found. Install it or use mode 1."
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Start Docker first."
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
  "${COMPOSE_CMD[@]}" up -d db
  echo "⏳ Waiting for Postgres..."
  until "${COMPOSE_CMD[@]}" exec db pg_isready -U iqair_user -d iqair >/dev/null 2>&1; do
    sleep 1
  done
  echo "✅ Postgres ready"
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

if [ ! -f "venv/bin/activate" ] && [ ! -f "$ROOT_DIR/venv/bin/activate" ]; then
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
