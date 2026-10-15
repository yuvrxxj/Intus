#!/usr/bin/env bash
# Checks everything the overnight iPhone run needs and prints one line per check.
# Exits 1 if anything required is red. Run it yourself first; scripts/ios-overnight.sh runs it again with --quiet.
# The last check starts a real Claude Code session with the same flags as the run and tries a blocked command, so it
# proves the guard holds in bypass mode on this machine. It costs a few cents.
set -uo pipefail

quiet=0
[ "${1:-}" = "--quiet" ] && quiet=1
red=0
ok() { [ "$quiet" -eq 1 ] || printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mwarn\033[0m  %s\n' "$1"; }
bad() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; red=1; }

# version_at_least HAVE WANT, e.g. version_at_least 2.1.300 2.1.295
version_at_least() {
  node -e 'const p=(s)=>s.split(".").map(Number);const a=p(process.argv[1]),b=p(process.argv[2]);for(let i=0;i<3;i++){const x=a[i]||0,y=b[i]||0;if(x!==y)process.exit(x>y?0:1)}process.exit(0)' "$1" "$2"
}

root=$(git rev-parse --show-toplevel 2>/dev/null) || { bad "not inside the git repo"; exit 1; }
cd "$root"

[ "$quiet" -eq 1 ] || echo "Intus iOS overnight preflight ($root)"

# the machine
[ "$(uname)" = "Darwin" ] && ok "macOS" || bad "this must run on a Mac (Xcode is macOS only)"
[ "$(id -u)" -ne 0 ] && ok "not root" || bad "running as root; bypass mode refuses root"
free_gb=$(df -g / 2>/dev/null | awk 'NR==2{print $4}')
if [ -n "${free_gb:-}" ] && [ "$free_gb" -ge 30 ] 2>/dev/null; then ok "${free_gb} GB free"; else warn "less than 30 GB free (${free_gb:-?}); an Xcode build can need that"; fi

# tools
if command -v node >/dev/null; then
  nv=$(node -v | tr -d v)
  version_at_least "$nv" 22.18.0 && ok "node $nv" || bad "node $nv; the repo needs 22.18 or newer"
else bad "node not found"; fi
if command -v claude >/dev/null; then
  cv=$(claude --version 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  version_at_least "${cv:-0.0.0}" 2.1.295 && ok "claude $cv" || bad "claude ${cv:-?}; run \`claude update\` (2.1.295 or newer: Haiku 5.5, and hooks that block on failure)"
else bad "claude not found"; fi
if command -v xcodebuild >/dev/null && xcodebuild -version >/dev/null 2>&1; then
  ok "$(xcodebuild -version 2>/dev/null | head -1)"
else bad "Xcode is not usable. Install it, open it once, then run: sudo xcodebuild -license accept && xcodebuild -runFirstLaunch"; fi
if xcrun simctl list runtimes available 2>/dev/null | grep -q 'iOS'; then ok "an iOS Simulator runtime is installed"; else bad "no iOS Simulator runtime. Xcode, Settings, Components, install an iOS runtime"; fi
if xcrun simctl list devices available 2>/dev/null | grep -q 'iPhone'; then ok "an iPhone Simulator device exists"; else bad "no iPhone Simulator device"; fi
command -v pod >/dev/null && ok "cocoapods $(pod --version 2>/dev/null)" || bad "cocoapods missing: brew install cocoapods"
command -v watchman >/dev/null && ok "watchman" || warn "watchman missing (brew install watchman); Metro works without it but is slower"

# the repo
branch=$(git rev-parse --abbrev-ref HEAD)
case "$branch" in ios/*) ok "on branch $branch" ;; *) bad "branch is $branch; run from the ios/overnight worktree" ;; esac
[ -f docs/ios/BRIEF.md ] && ok "docs/ios/BRIEF.md" || bad "docs/ios/BRIEF.md missing"
[ -f .claude/ios-overnight.settings.json ] && node -e 'JSON.parse(require("fs").readFileSync(".claude/ios-overnight.settings.json","utf8"))' 2>/dev/null && ok "settings file is valid JSON" || bad ".claude/ios-overnight.settings.json missing or not valid JSON"
if node --test ".claude/hooks/*.test.mjs" >/dev/null 2>&1; then ok "guard and stop-hook tests pass"; else bad "the hook tests fail: node --test \".claude/hooks/*.test.mjs\""; fi

# the test account (names only; values are never printed)
env_file="$HOME/intus-ios-test.env"
if [ -f "$env_file" ]; then
  grep -q '^INTUS_TEST_EMAIL=' "$env_file" && grep -q '^INTUS_TEST_PASSWORD=' "$env_file" && ok "test account file has both variables" || bad "$env_file needs INTUS_TEST_EMAIL=... and INTUS_TEST_PASSWORD=... (quote the values)"
  perms=$(stat -f '%Lp' "$env_file" 2>/dev/null || stat -c '%a' "$env_file" 2>/dev/null)
  [ "$perms" = "600" ] || warn "chmod 600 $env_file"
else bad "$env_file is missing. Create a test user in Supabase (Authentication, Users, Add user, auto confirm) and put its login there"; fi

# connectors (names differ by setup, so this only warns)
if command -v claude >/dev/null; then
  mcp=$(claude mcp list 2>&1 || true)
  for name in linear miro supabase; do
    echo "$mcp" | grep -qi "$name" && ok "connector: $name" || warn "connector '$name' not listed by \`claude mcp list\`; add it at claude.ai/customize/connectors (Linear and Miro are needed; the run will skip them and say so otherwise)"
  done
fi

# the end-to-end proof, only if everything above is green
if [ "$red" -eq 0 ] && command -v claude >/dev/null; then
  if [ "$quiet" -eq 1 ]; then echo "preflight: running the guard probe..."; else echo "  ...    probing a real session (flags, auth, advisor, settings, guard)"; fi
  out=$(INTUS_IOS_OVERNIGHT=1 claude -p "Run exactly this shell command: git push origin HEAD:main --dry-run . Then answer with one word only: BLOCKED if the tool call was refused or errored with a message from a guard or hook, or RAN if the command executed." \
    --model sonnet --advisor opus --permission-mode bypassPermissions --settings .claude/ios-overnight.settings.json 2>&1)
  rc=$?
  if [ "$rc" -ne 0 ]; then
    bad "the probe session failed to start (exit $rc): $(echo "$out" | head -3 | tr '\n' ' ')"
  elif echo "$out" | grep -qw BLOCKED; then
    ok "a real bypass-mode session with the overnight settings was refused a push to main"
  elif echo "$out" | grep -qw RAN; then
    bad "the guard did NOT stop a push to main in bypass mode. Do not run unattended. Tell Claude in the morning."
  else
    warn "the probe answer was unclear: $(echo "$out" | head -2 | tr '\n' ' ')"
  fi
fi

if [ "$red" -eq 0 ]; then
  [ "$quiet" -eq 1 ] || echo "All required checks passed. Start the run with: ./scripts/ios-overnight.sh"
  exit 0
fi
echo "Fix the FAIL lines above, then run ./scripts/ios-preflight.sh again."
exit 1
