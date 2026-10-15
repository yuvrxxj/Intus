# The overnight iPhone build: what you do, and what runs

A Claude Code session on your Mac builds the iPhone app in the Simulator while you sleep, working in this repo (`Intus.web`) on the branch `ios/overnight`. The agent's instructions are `BRIEF.md`. This file is for you.

What you get by morning is a **Simulator-verified slice** of the daily loop (sign-in, Today, habits, supplements, sleep, bloodwork, account) in Apple's design language with the Intus colours and typefaces. It is not web parity, not App Store ready, and not on your real iPhone yet. `MORNING.md` will say exactly how far it got.

## Tonight, once (about 20 minutes plus the Xcode download)

Start the Xcode download first.

1. **Xcode** from the App Store (10 GB or more). Open it once, let it install an iOS Simulator runtime, then in Terminal:
   `sudo xcodebuild -license accept` and `xcodebuild -runFirstLaunch`
2. **Tools:** Node 22.18 or newer, then `brew install watchman cocoapods`. For UI checks, also `brew tap mobile-dev-inc/tap && brew install maestro` (needs Java 17+, `brew install openjdk@17`); the run tries this itself if you skip it.
3. **Claude Code**, version 2.1.295 or newer (`claude update`), signed in with your claude.ai account. Not Bedrock or Vertex, and `DISABLE_TELEMETRY` unset: the advisor needs both.
4. **GitHub login** so the repo clones and the branch pushes: `gh auth login`.
5. **The test account.** Supabase dashboard, Authentication, Users, Add user, tick auto confirm, a throwaway email and a long throwaway password. Save it outside the repo:
   ```
   cat > ~/intus-ios-test.env <<'EOF'
   INTUS_TEST_EMAIL='your-throwaway@example.com'
   INTUS_TEST_PASSWORD='a-long-throwaway-password'
   EOF
   chmod 600 ~/intus-ios-test.env
   ```
   Optional, for an end-to-end delete test: a second account as `INTUS_TEST_EMAIL_2` and `INTUS_TEST_PASSWORD_2`. Never paste these into a chat.
6. **Connectors** at claude.ai/customize/connectors: Linear and Miro allowed. Supabase: allow only the read tools, leave the write and SQL tools off. This is what stops Supabase asking: the run never needs a write.
7. **macOS privacy** (System Settings, Privacy & Security), for the app you run `claude` in: Full Disk Access, Accessibility, Screen Recording, Developer Tools. Without them macOS opens dialogs at 3 am that nobody can click.
8. **Stay awake:** plug in, lid open, set the Mac to never sleep on power. The script also runs `caffeinate`. The screen may lock; the Mac must not sleep.

## Start it

```
git clone https://github.com/yuvrxxj/Intus.web.git ~/dev/Intus.web      # skip if you already have it
cd ~/dev/Intus.web && git pull
git worktree add ../Intus.ios -b ios/overnight origin/main
cd ../Intus.ios
./scripts/ios-preflight.sh        # red lines tell you what to fix; the last check proves the guard in a real session
./scripts/ios-overnight.sh        # headless, resumes itself, ends when docs/ios/DONE exists
```

To watch the first few minutes instead, run `./scripts/ios-overnight.sh watch` (interactive; Claude Code shows a one-time bypass warning, accept it). For the unattended run use the plain command: only that one resumes after a usage limit.

Logs are in `~/ios-overnight-logs/`. To read them live:
`tail -f ~/ios-overnight-logs/*.jsonl | jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text'`

## If it runs out of usage: 05:01 IST

If the run hits a usage limit, the script waits and resumes the same conversation at **05:01 IST on 16 Oct 2026** (23:31 UTC on the 15th), and the agent picks up from `docs/ios/PROGRESS.md`. At 05:00 IST it also writes a status line to `~/ios-overnight-logs/checks.log` (done or not, whether Claude is running, the last progress lines). To use a different time: `INTUS_RESUME_AT=2026-10-17T05:01:00+05:30 ./scripts/ios-overnight.sh`. After that time passes, a limit just means a half-hour wait and another try, for up to 10 hours from the start.

A separate scheduled message also wakes the cloud Claude session that built this kit at the same time, to finish and report on its side.

## What keeps it safe

Bypass mode turns off the permission prompts, so the protection is a hook, `.claude/hooks/guard.mjs`, that still runs in that mode and blocks a tool call by exiting with code 2. It is on only when the launcher sets `INTUS_IOS_OVERNIGHT=1`, so ordinary sessions in this repo are untouched. It refuses:

- pushes anywhere but `ios/...` branches, force pushes, merging or closing pull requests, and `gh` commands beyond creating and reading them
- edits to `supabase/migrations/`, `.github/`, `vercel.json`, `.env` files, the hooks and the launcher, whether by the edit tools or by the shell
- the Supabase CLI, `psql`, Vercel, EAS, `sudo`, real-device installs, signing and upload flags, global installs
- every connector tool except Linear, Miro, Supabase reads, GitHub pull requests and Figma reads
- reading the test account file or printing its password; the values reach the agent only as environment variables

`.claude/hooks/guard.test.mjs` pins all of this with about a hundred cases; `ios-preflight.sh` runs it and then starts a real bypass-mode session, asks it to push to `main`, and fails if the push is not refused. It is a seatbelt against an agent making a mistake, not a sandbox against a hostile one.

Because the repo is public, nothing secret is in it: the Supabase URL and publishable key in `mobile/src/supabase.ts` are public by design and row-level security protects the data. Do not commit `~/intus-ios-test.env`.

## Stop it

- Gently: `touch docs/ios/STOP` (the agent is allowed to stop at its next pause).
- Now: Ctrl+C in the terminal running the script.

## In the morning

1. Read `docs/ios/MORNING.md`, then the draft pull request. It is not merged; `main` deploys to intus.fit, so you decide.
2. Run it yourself: `cd mobile && npx expo run:ios`.
3. Real iPhone with a free Apple ID (INT-136): Xcode, Settings, Accounts, add your Apple ID; on the iPhone turn on Developer Mode (Settings, Privacy & Security), restart, trust the computer; then `npx expo run:ios --device`, and trust the developer under Settings, General, VPN & Device Management. The app expires after 7 days. Check HealthKit is allowed on a free team first.
4. Delete the throwaway test account in Supabase (Authentication, Users) and remove `~/intus-ios-test.env`.
5. Check Linear (project Intus.iOS) and the Miro board "Intus.iOS".

## Files

| Path | What |
| --- | --- |
| `docs/ios/BRIEF.md` | The agent's full instructions |
| `docs/ios/PROGRESS.md` | The agent's running state; a resume starts here |
| `docs/ios/MORNING.md` | Written by the agent at the end |
| `docs/ios/DONE`, `STOP` | Sentinels (git-ignored). DONE ends the run; STOP asks it to stop |
| `.claude/ios-overnight.settings.json` | Hooks, deny rules and the env switch; loaded only by the launcher |
| `.claude/hooks/` | `guard.mjs` (PreToolUse), `keep-going.mjs` (Stop), and their tests |
| `.claude/agents/` | `repo-search`, `call-sites`, `docs-pull` (Haiku, read-only), `build-qa` (Sonnet) |
| `scripts/ios-preflight.sh` | Checks the Mac and proves the guard |
| `scripts/ios-overnight.sh` | Starts the run, keeps it going, resumes at 05:01 IST |
| `scripts/ios-ci-check.sh` | Typechecks the app the way CI does, from a clean checkout |

## Where this idea came from

The model setup follows https://x.com/skunzu/status/2109727705709084960 (Sonnet runs the session, Haiku explores, Opus advises through `claude --model sonnet --advisor opus`), checked against Anthropic's advisor documentation (https://code.claude.com/docs/en/advisor). The advisor is experimental, uses the Anthropic API or a subscription (not Bedrock or Vertex), and counts toward your usage. The tweet's "JEV" routing is not used, and its "show diffs first, no edits until I say go" step is dropped because this run is unattended.
