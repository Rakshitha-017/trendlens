#!/usr/bin/env bash
# TrendLens — run the full stack (Python backend :8000 + React frontend :3000).
# Honest data only: the frontend serves pipeline artifacts, never invented results.
set -euo pipefail
cd "$(dirname "$0")/.."

source venv/bin/activate

# Start the Python backend in the background
python -m src.api &
API_PID=$!
trap "kill $API_PID 2>/dev/null || true" EXIT

sleep 1
echo "Python backend:  http://127.0.0.1:8000/api/health"
echo "Frontend:        http://127.0.0.1:3000"

cd frontend
exec npx tsx server.ts
