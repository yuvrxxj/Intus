#!/usr/bin/env bash
# Runs the iPhone build unattended. Read docs/ios/README.md first.
#
#   ./scripts/ios-overnight.sh          headless: resumes after a usage limit, ends when docs/ios/DONE exists
#   ./scripts/ios-overnight.sh watch    interactive terminal with the same settings, for the first few minutes
#
# Claude Code runs in bypassPermissions mode with Sonnet as the main model and Opus as the advisor. What it may not do
# is enforced by .claude/hooks/guard.mjs, which holds in that mode.
set -uo pipefail

root=$(git rev-parse --show-toplevel) || exit 1
cd "$root"
mode=${1:-run}

branch=$(git rev-parse --abbrev-ref HEAD)
case "$branch" in ios/*) ;; *) echo "Run this from the ios/overnight worktree (this branch is $branch)." >&2; exit 1 ;; esac
[ "$(id -u)" -ne 0 ] || { echo "Do not run as root." >&2; exit 1; }
command -v claude >/dev/null || { echo "claude is not installed." >&2; exit 1; }
[ ! -e docs/ios/DONE ] || { echo "docs/ios/DONE exists, so the last run finished: $(cat docs/ios/DONE). Read docs/ios/MORNING.md, or delete DONE to run again." >&2; exit 0; }

bash scripts/ios-preflight.sh --quiet || { echo "Preflight failed. Fix the FAIL lines above and run again." >&2; exit 1; }

# the test account goes into the environment; the agent is not allowed to read the file itself
set -a
# shellcheck disable=SC1090
. "$HOME/intus-ios-test.env"
set +a
export INTUS_IOS_OVERNIGHT=1

state_dir="$HOME/.intus-ios"
log_dir="$HOME/ios-overnight-logs"
mkdir -p "$state_dir" "$log_dir" docs/ios/screens

# keep the Mac awake for as long as this script lives
command -v caffeinate >/dev/null && { caffeinate -dimsu -w $$ & }

flags=(--model sonnet --advisor opus --permission-mode bypassPermissions --settings .claude/ios-overnight.settings.json --name "Intus iOS overnight")
prompt="Read docs/ios/BRIEF.md and carry it out in full. If docs/ios/PROGRESS.md already has entries, resume from the first rung that is not done. Nobody is awake: do not ask questions, decide and log."

if [ "$mode" = "watch" ]; then
  exec claude "${flags[@]}" "$prompt"
fi

session_file="$state_dir/session-id"
[ -f "$session_file" ] || uuidgen | tr 'A-Z' 'a-z' > "$session_file"
deadline=$(( $(date +%s) + 10 * 3600 ))
attempt=0

# The scheduled resume. If the run hits a usage limit before this time, it waits for it and picks up the same
# conversation at 05:01 IST on 16 Oct 2026 (23:31 UTC on the 15th). Override with INTUS_RESUME_AT, any ISO 8601 time.
resume_at=$(node -e 'const t=Date.parse(process.argv[1]); console.log(Number.isNaN(t) ? 0 : Math.floor(t/1000))' "${INTUS_RESUME_AT:-2026-10-16T05:01:00+05:30}")
check_at=$(( resume_at - 60 ))

# 05:00 IST check: write down where things stand, whatever the run is doing at that moment
if [ "$resume_at" -gt "$(date +%s)" ]; then
  (
    while [ "$(date +%s)" -lt "$check_at" ] && [ ! -e docs/ios/DONE ]; do sleep 20; done
    {
      echo "[$(date '+%F %T')] scheduled check: done=$([ -e docs/ios/DONE ] && echo yes || echo no) claude-running=$(pgrep -f 'claude.*Intus iOS overnight' >/dev/null && echo yes || echo no)"
      echo "  last progress: $(tail -n 3 docs/ios/PROGRESS.md 2>/dev/null | tr '\n' ' ')"
    } >> "$log_dir/checks.log"
  ) &
fi

# waits until the given epoch second, ending early if the run finishes
wait_until() {
  while [ "$(date +%s)" -lt "$1" ] && [ ! -e docs/ios/DONE ]; do sleep 20; done
}

echo "Logs: $log_dir   (watch with: tail -f \"$log_dir\"/*.jsonl | jq -r 'select(.type==\"assistant\") | .message.content[]? | select(.type==\"text\") | .text')"
[ "$resume_at" -gt "$(date +%s)" ] && echo "If a usage limit stops the run, it resumes at $(date -r "$resume_at" '+%F %T %Z' 2>/dev/null || echo "$resume_at") (05:01 IST) and carries on from docs/ios/PROGRESS.md."

while [ ! -e docs/ios/DONE ] && [ "$(date +%s)" -lt "$deadline" ]; do
  attempt=$((attempt + 1))
  session=$(cat "$session_file")
  log="$log_dir/$(date +%Y%m%d-%H%M%S)-attempt${attempt}.jsonl"
  if [ -f "$state_dir/started" ]; then resume=(--resume "$session"); else resume=(--session-id "$session"); fi
  echo "[$(date '+%F %T')] attempt $attempt -> $log"
  claude -p "$prompt" "${flags[@]}" "${resume[@]}" --output-format stream-json --verbose > "$log" 2>&1
  code=$?
  if grep -q "No conversation found" "$log" 2>/dev/null; then
    rm -f "$state_dir/started"
    uuidgen | tr 'A-Z' 'a-z' > "$session_file"
    continue
  fi
  touch "$state_dir/started"
  [ -e docs/ios/DONE ] && break

  now=$(date +%s)
  if [ "$code" -ne 0 ] && tail -c 4000 "$log" | grep -qiE 'usage limit|limit reached|rate.?limit|out of (tokens|usage)|quota|resets? (at|in)'; then
    # out of tokens. Wait for the scheduled time if it is still ahead, otherwise try again in half an hour.
    if [ "$resume_at" -gt "$now" ]; then
      echo "[$(date '+%F %T')] out of usage; waiting for the scheduled resume (05:01 IST)"
      wait_until "$resume_at"
    else
      echo "[$(date '+%F %T')] out of usage; trying again in 30 min"
      sleep 1800
    fi
  elif [ "$code" -eq 0 ]; then
    echo "[$(date '+%F %T')] claude stopped without docs/ios/DONE; nudging it again in 2 min"
    sleep 120
  else
    echo "[$(date '+%F %T')] claude exited $code; trying again in 10 min"
    sleep 600
  fi
done

if [ -e docs/ios/DONE ]; then
  msg="Intus iOS run finished: $(head -c 120 docs/ios/DONE | tr '\n' ' ')"
else
  msg="Intus iOS run stopped at its time limit. See docs/ios/PROGRESS.md."
fi
echo "$msg"
command -v osascript >/dev/null && osascript -e "display notification \"$msg\" with title \"Intus iOS\"" >/dev/null 2>&1 || true
