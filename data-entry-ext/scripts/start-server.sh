#!/usr/bin/env bash
# Starts a local static server for the extension folder, so pages that need a
# real http:// origin can be opened - ocr-test.html above all, since Chrome
# blocks the Web Worker Tesseract runs in when a page is loaded from file://.
#
#   ./scripts/start-server.sh          # http://localhost:8777
#   PORT=9000 ./scripts/start-server.sh
set -euo pipefail

PORT="${PORT:-8777}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.server-$PORT.pid"
LOG_FILE="$ROOT/.server-$PORT.log"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Already running on port $PORT (pid $(cat "$PID_FILE"))."
    echo "  http://localhost:$PORT/ocr-test.html"
    exit 0
fi
rm -f "$PID_FILE"

# Someone else on the port - say so rather than failing with a stack trace.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $PORT is already in use by another process:" >&2
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2
    echo "Pick another one with: PORT=9000 $0" >&2
    exit 1
fi

cd "$ROOT"
python3 -m http.server "$PORT" > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

# Give it a moment, then make sure it actually came up.
sleep 1
if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Server failed to start - see $LOG_FILE" >&2
    cat "$LOG_FILE" >&2
    rm -f "$PID_FILE"
    exit 1
fi

echo "Serving $ROOT on port $PORT (pid $(cat "$PID_FILE"))"
echo "  OCR test bench : http://localhost:$PORT/ocr-test.html"
echo "  Parse data     : http://localhost:$PORT/parse-data.html"
if [ "$PORT" = "8777" ]; then
    echo "  Stop with      : npm stop"
else
    echo "  Stop with      : PORT=$PORT ./scripts/stop-server.sh"
fi
echo "  Log            : $LOG_FILE"
