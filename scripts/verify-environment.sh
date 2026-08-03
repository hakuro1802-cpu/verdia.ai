#!/usr/bin/env bash
# Verifies repo connectivity and VM toolchain for the verdia.ai stub repository.
# Exit non-zero on any failure.
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
echo "README.md OK ($(wc -l < README.md) lines)"
file_count=$(find . -mindepth 1 -maxdepth 1 ! -name .git -printf '%f\n' | wc -l)
echo "Top-level entries (excl. .git): $file_count"
echo ""

echo "-- Toolchain --"
node --version
python3 --version
pnpm --version
npm --version
rustc --version
go version
echo ""

echo "-- Application check --"
if [[ -f package.json ]] || [[ -f pyproject.toml ]] || [[ -f go.mod ]] || [[ -f Cargo.toml ]]; then
  echo "Dependency manifest found — run project-specific install/build/test."
else
  echo "No dependency manifests yet (expected for current stub repo)."
fi

echo ""
echo "Environment verification passed."
