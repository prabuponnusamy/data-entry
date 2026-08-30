#!/usr/bin/env bash
# Stops the server started by scripts/start-server.sh.
#
#   ./scripts/stop-server.sh
#   PORT=9000 ./scripts/stop-server.sh
set -euo pipefail

PORT="${PORT:-8777}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.server-$PORT.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "No server recorded for port $PORT."
    # The pid file can go missing while something is still holding the port -
    # show it rather than killing a process we cannot vouch for.
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "Something is still listening on port $PORT:"
        lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
        echo "Stop it with: kill \$(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN)"
    fi
    exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    # Wait for it to go, then insist if it hasn't.
    for _ in $(seq 1 20); do
        kill -0 "$PID" 2>/dev/null || break
        sleep 0.2
    done
    if kill -0 "$PID" 2>/dev/null; then
        kill -9 "$PID" 2>/dev/null || true
    fi
    echo "Stopped server on port $PORT (pid $PID)."
else
    echo "Server on port $PORT was not running (stale pid $PID)."
fi

rm -f "$PID_FILE"
