#!/usr/bin/env python3
"""AQI simulator with safe low-write defaults.

Commands:
  start   Start background simulation loop
  stop    Stop background simulation loop
  status  Show simulator status
  once    Execute one simulation tick immediately

Aliases:
  start: up, run
  stop: down, halt
  status: stat, st
  once: tick, step
"""

from __future__ import annotations

import argparse
import json
import os
import random
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest
from typing import Any

API_URL = os.getenv("SIMULATOR_API_URL", "http://localhost:8000").rstrip("/")
ADMIN_SECRET = os.getenv("ADMIN_SECRET")

DEFAULT_INTERVAL_SECONDS = 60
DEFAULT_SENSORS_PER_TICK = 3
MIN_SENSORS_PER_TICK = 2
MAX_SENSORS_PER_TICK = 4
MAX_TARGET_SENSORS = 20

STATE_DIR = Path(__file__).resolve().parent / ".aqi-simulator"
PID_FILE = STATE_DIR / "simulator.pid"
STATE_FILE = STATE_DIR / "state.json"
LOG_FILE = STATE_DIR / "simulator.log"


def load_env_from_repo() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        pass


def ensure_state_dir() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)


def clamp_sensors_per_tick(value: int) -> int:
    return max(MIN_SENSORS_PER_TICK, min(MAX_SENSORS_PER_TICK, value))


def load_state() -> dict[str, Any]:
    if not STATE_FILE.exists():
        return {
            "cursor": 0,
            "tick": 0,
            "interval_seconds": DEFAULT_INTERVAL_SECONDS,
            "sensors_per_tick": DEFAULT_SENSORS_PER_TICK,
            "sensors_total": 0,
            "last_updated": None,
            "last_updated_sensor_ids": [],
        }
    try:
        with STATE_FILE.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {
        "cursor": 0,
        "tick": 0,
        "interval_seconds": DEFAULT_INTERVAL_SECONDS,
        "sensors_per_tick": DEFAULT_SENSORS_PER_TICK,
        "sensors_total": 0,
        "last_updated": None,
        "last_updated_sensor_ids": [],
    }


def save_state(state: dict[str, Any]) -> None:
    ensure_state_dir()
    with STATE_FILE.open("w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=True, indent=2)


def read_pid() -> int | None:
    try:
        if not PID_FILE.exists():
            return None
        value = PID_FILE.read_text(encoding="utf-8").strip()
        if not value:
            return None
        return int(value)
    except Exception:
        return None


def write_pid(pid: int) -> None:
    ensure_state_dir()
    PID_FILE.write_text(str(pid), encoding="utf-8")


def clear_pid() -> None:
    if PID_FILE.exists():
        PID_FILE.unlink()


def process_running(pid: int | None) -> bool:
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def normalize_command(name: str) -> str:
    aliases = {
        "up": "start",
        "run": "start",
        "down": "stop",
        "halt": "stop",
        "stat": "status",
        "st": "status",
        "tick": "once",
        "step": "once",
    }
    return aliases.get(name, name)


def get_admin_secret() -> str:
    secret = os.getenv("ADMIN_SECRET") or ADMIN_SECRET
    if not secret:
        raise RuntimeError("ADMIN_SECRET is missing. Set it in backend/.env or environment.")
    return secret


def http_json(
    method: str,
    url: str,
    *,
    token: str | None = None,
    payload: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    timeout: float = 10.0,
) -> dict[str, Any]:
    request_url = url
    if params:
        encoded = urlparse.urlencode(params)
        sep = "&" if "?" in url else "?"
        request_url = f"{url}{sep}{encoded}"

    headers: dict[str, str] = {}
    data: bytes | None = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urlrequest.Request(request_url, data=data, headers=headers, method=method)

    try:
        with urlrequest.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return {}
            decoded = json.loads(raw)
            if isinstance(decoded, dict):
                return decoded
            return {"data": decoded}
    except urlerror.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code} {request_url}: {details}") from exc
    except urlerror.URLError as exc:
        raise RuntimeError(f"Request failed for {request_url}: {exc.reason}") from exc


def login_admin() -> str:
    payload = http_json(
        "POST",
        f"{API_URL}/admin/login",
        payload={"secret": get_admin_secret()},
        timeout=10,
    )
    token = payload.get("access_token")
    if not token:
        raise RuntimeError("admin/login did not return access_token")
    return token


def fetch_target_sensors(token: str) -> list[dict[str, Any]]:
    payload = http_json("GET", f"{API_URL}/admin/sensors", token=token, timeout=10)
    sensors = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(sensors, list):
        return []

    sensors = [s for s in sensors if isinstance(s, dict) and s.get("id")]
    sensors.sort(key=lambda s: str(s.get("name") or s.get("id")))
    return sensors[:MAX_TARGET_SENSORS]


def aqi_to_pm25(aqi: float) -> float:
    # Approximate inverse of US EPA AQI breakpoints for PM2.5
    if aqi <= 50:
        return (aqi / 50.0) * 12.0
    if aqi <= 100:
        return 12.1 + ((aqi - 51.0) / 49.0) * (35.4 - 12.1)
    if aqi <= 150:
        return 35.5 + ((aqi - 101.0) / 49.0) * (55.4 - 35.5)
    if aqi <= 200:
        return 55.5 + ((aqi - 151.0) / 49.0) * (150.4 - 55.5)
    capped = min(aqi, 300.0)
    return 150.5 + ((capped - 201.0) / 99.0) * (250.4 - 150.5)


def next_target_aqi(tick: int, sensor_offset: int) -> int:
    cycle = [35, 75, 125, 175, 225]
    base = cycle[(tick + sensor_offset) % len(cycle)]
    jitter = random.randint(-8, 8)
    return max(5, base + jitter)


def update_sensor_params(token: str, sensor_id: str, aqi: int) -> None:
    pm25 = round(aqi_to_pm25(float(aqi)), 1)
    pm10 = round(pm25 * 1.45, 1)
    http_json(
        "PUT",
        f"{API_URL}/sensors/{sensor_id}/parameters",
        token=token,
        params={"pm25": pm25, "pm10": pm10},
        timeout=10,
    )


def run_tick(interval_seconds: int, sensors_per_tick: int) -> dict[str, Any]:
    sensors_per_tick = clamp_sensors_per_tick(sensors_per_tick)
    state = load_state()
    state["interval_seconds"] = interval_seconds
    state["sensors_per_tick"] = sensors_per_tick

    token = login_admin()
    sensors = fetch_target_sensors(token)
    if not sensors:
        raise RuntimeError("No sensors found to simulate. Seed sensors first.")

    sensor_ids = [str(s["id"]) for s in sensors]
    total = len(sensor_ids)
    cursor = int(state.get("cursor", 0) or 0) % total
    tick = int(state.get("tick", 0) or 0)

    selected_ids: list[str] = []
    for i in range(sensors_per_tick):
        idx = (cursor + i) % total
        sid = sensor_ids[idx]
        target_aqi = next_target_aqi(tick, i)
        update_sensor_params(token, sid, target_aqi)
        selected_ids.append(sid)

    state["cursor"] = (cursor + sensors_per_tick) % total
    state["tick"] = tick + 1
    state["sensors_total"] = total
    state["last_updated"] = int(time.time())
    state["last_updated_sensor_ids"] = selected_ids
    save_state(state)

    return state


def command_once(args: argparse.Namespace) -> int:
    interval_seconds = max(1, int(args.interval))
    sensors_per_tick = clamp_sensors_per_tick(int(args.sensors_per_tick))
    state = run_tick(interval_seconds=interval_seconds, sensors_per_tick=sensors_per_tick)

    print("simulator_tick=ok")
    print(f"interval_seconds={state.get('interval_seconds')}")
    print(f"sensors_per_tick={state.get('sensors_per_tick')}")
    print(f"sensors_total={state.get('sensors_total')}")
    print(f"cursor={state.get('cursor')}")
    print(f"updated_sensor_ids={','.join(state.get('last_updated_sensor_ids', []))}")
    return 0


def command_status(_: argparse.Namespace) -> int:
    pid = read_pid()
    running = process_running(pid)
    state = load_state()

    print(f"running={str(running).lower()}")
    print(f"pid={pid if running else ''}")
    print(f"interval_seconds={state.get('interval_seconds', DEFAULT_INTERVAL_SECONDS)}")
    print(f"sensors_per_tick={state.get('sensors_per_tick', DEFAULT_SENSORS_PER_TICK)}")
    print(f"sensors_total={state.get('sensors_total', 0)}")
    print(f"cursor={state.get('cursor', 0)}")
    print(f"log_file={LOG_FILE}")
    return 0


def command_stop(_: argparse.Namespace) -> int:
    pid = read_pid()
    if not process_running(pid):
        clear_pid()
        print("simulator_stopped=already")
        return 0

    assert pid is not None
    os.kill(pid, signal.SIGTERM)

    for _ in range(20):
        if not process_running(pid):
            break
        time.sleep(0.1)

    if process_running(pid):
        os.kill(pid, signal.SIGKILL)

    clear_pid()
    print("simulator_stopped=ok")
    return 0


def command_start(args: argparse.Namespace) -> int:
    ensure_state_dir()
    pid = read_pid()
    if process_running(pid):
        print("simulator_started=already")
        return 0

    interval_seconds = max(1, int(args.interval))
    sensors_per_tick = clamp_sensors_per_tick(int(args.sensors_per_tick))

    cmd = [
        sys.executable,
        str(Path(__file__).resolve()),
        "run-loop",
        "--interval",
        str(interval_seconds),
        "--sensors-per-tick",
        str(sensors_per_tick),
    ]

    with LOG_FILE.open("a", encoding="utf-8") as log_fh:
        process = subprocess.Popen(
            cmd,
            stdout=log_fh,
            stderr=log_fh,
            start_new_session=True,
        )

    write_pid(process.pid)
    state = load_state()
    state["interval_seconds"] = interval_seconds
    state["sensors_per_tick"] = sensors_per_tick
    save_state(state)

    print("simulator_started=ok")
    print(f"pid={process.pid}")
    print(f"interval_seconds={interval_seconds}")
    print(f"sensors_per_tick={sensors_per_tick}")
    print(f"log_file={LOG_FILE}")
    return 0


def command_run_loop(args: argparse.Namespace) -> int:
    interval_seconds = max(1, int(args.interval))
    sensors_per_tick = clamp_sensors_per_tick(int(args.sensors_per_tick))

    def _handle_term(_sig: int, _frame: Any) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _handle_term)

    try:
        while True:
            try:
                run_tick(interval_seconds=interval_seconds, sensors_per_tick=sensors_per_tick)
            except Exception as exc:
                print(f"simulator_tick=error message={exc}", flush=True)
            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        return 0
    finally:
        clear_pid()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AQI simulator controller")
    parser.add_argument("command", help="start|stop|status|once")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL_SECONDS)
    parser.add_argument("--sensors-per-tick", type=int, default=DEFAULT_SENSORS_PER_TICK)
    return parser


def main() -> int:
    load_env_from_repo()
    parser = build_parser()
    args = parser.parse_args()

    args.command = normalize_command(args.command)

    if args.command == "start":
        return command_start(args)
    if args.command == "stop":
        return command_stop(args)
    if args.command == "status":
        return command_status(args)
    if args.command == "once":
        return command_once(args)
    if args.command == "run-loop":
        return command_run_loop(args)

    parser.error("Unknown command. Use start|stop|status|once")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
