#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:8787/api/v1}"
echo "health:" && curl -sf "$BASE/health"
echo
echo "dashboard:" && curl -sf "$BASE/devices/ESP32_001/dashboard" | head -c 200
echo "…"
echo
echo "pump pulse:" && curl -sf -X POST "$BASE/devices/ESP32_001/commands/pump" \
  -H 'Content-Type: application/json' \
  -d '{"action":"pulse","durationMs":1500,"source":"app"}'
echo
echo "OK"
