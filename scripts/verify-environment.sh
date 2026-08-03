#!/usr/bin/env bash
# Verifies repo connectivity, toolchain, and web app CI checks for verdia.ai.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== verdia.ai environment verification =="
echo "Workspace: $ROOT"
echo ""

echo "-- Git --"
git status -sb
git fetch origin
echo "Remote: $(git remote get-url origin | sed 's/x-access-token:[^@]*/x-access-token:[REDACTED]/')"
echo ""

echo "-- Repository contents --"
if [[ ! -f README.md ]]; then
  echo "ERROR: README.md missing"
  exit 1
fi
if ! grep -qi verdia README.md; then
  echo "ERROR: README.md does not mention verdia"
  exit 1
fi
if [[ ! -f web/package.json ]]; then
  echo "ERROR: web/package.json missing"
  exit 1
fi
echo "README.md OK"
echo "web/package.json OK"
echo ""

echo "-- Toolchain --"
node --version
python3 --version
pnpm --version
echo ""

echo "-- Install dependencies --"
pnpm install
echo ""

echo "-- Lint --"
pnpm lint
echo ""

echo "-- Test --"
pnpm test
echo ""

echo "-- Build --"
pnpm build
echo ""

if [[ "${VERIFY_DEV_SERVER:-0}" == "1" ]]; then
  echo "-- Dev server probe --"
  DEV_PORT="${VERIFY_DEV_PORT:-5173}"
  tmux -f /exec-daemon/tmux.portal.conf has-session -t verdia-dev 2>/dev/null \
    || tmux -f /exec-daemon/tmux.portal.conf new-session -d -s verdia-dev -c "$ROOT" -- "${SHELL:-bash}" -l
  tmux -f /exec-daemon/tmux.portal.conf send-keys -t verdia-dev:0.0 "pnpm dev --host 127.0.0.1 --port ${DEV_PORT}" C-m
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${DEV_PORT}/" >/tmp/verdia-dev-index.html 2>/dev/null; then
      break
    fi
    sleep 1
  done
  if ! curl -fsS "http://127.0.0.1:${DEV_PORT}/src/App.tsx" | grep -qi verdia; then
    echo "ERROR: dev server did not serve verdia.ai app source"
    exit 1
  fi
  echo "Dev server OK (http://127.0.0.1:${DEV_PORT}/)"
  tmux -f /exec-daemon/tmux.portal.conf send-keys -t verdia-dev:0.0 C-c
fi

echo ""
echo "Environment verification passed."
