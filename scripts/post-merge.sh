#!/bin/bash
# Aurora — post-merge setup.
#
# Runs automatically after a task is merged. Re-syncs npm dependencies for both
# the frontend (root) and the backend workspace, then no-ops cleanly. Workflow
# reconciliation (handled by the platform afterwards) takes care of restarts.
#
# Guidelines: idempotent, non-interactive, fail-fast.
set -euo pipefail

echo "[post-merge] Installing root (frontend) dependencies…"
npm install --no-audit --no-fund --loglevel=error

if [ -f backend/package.json ]; then
  echo "[post-merge] Installing backend dependencies…"
  (cd backend && npm install --no-audit --no-fund --loglevel=error)
fi

echo "[post-merge] Done."
