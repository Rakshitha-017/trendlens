#!/usr/bin/env bash
# Start the TrendLens Python backend (honest pipeline API, stdlib only).
# Requires the venv to be active. Listens on 0.0.0.0:8000 by default.
set -euo pipefail
cd "$(dirname "$0")/.."
exec python -m src.api
