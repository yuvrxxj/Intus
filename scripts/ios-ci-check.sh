#!/usr/bin/env bash
# Typechecks the iPhone app the way CI does: from a clean checkout of HEAD with only mobile/'s own packages installed.
# On a laptop the repo root has node_modules, so a plain `cd mobile && npm run typecheck` can find web packages that
# CI will not have. Commit first: this checks the last commit, not the working tree.
set -euo pipefail

root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/intus-ci-check.XXXXXX")
trap 'git -C "$root" worktree remove --force "$tmp/wt" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

git -C "$root" worktree add --detach "$tmp/wt" HEAD >/dev/null 2>&1
cd "$tmp/wt/mobile"
npm ci --no-audit --no-fund
npm run typecheck
echo "CI-faithful typecheck of the iPhone app: ok"
