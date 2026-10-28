# AGENTS.md: rules for Cursor agents working on Intus

Intus is a personal health tracker (https://intus.fit). Web in the repo root, iPhone app in `mobile/`. The founder cannot read code, so you are held to a high bar and CI is the only safety net. Read `README.md` for the layout and `CLAUDE.md` for the same rules written for Claude Code. This file is the Cursor version. If they disagree, the stricter rule wins. Read `ME.md` for the founder's voice and red lines. Those red lines override this file.

## Before you start any task

1. Open the Linear issue (team INT, https://linear.app/intus). If the task has no issue, stop and ask.
2. If the issue has the label `Needs decision` or `human`, stop. Comment what you need and take another issue.
3. Search Linear for duplicates before creating any issue. Nest new issues under their parent. Label anything needed before sign-ups open `MVP launch`.
4. Move the issue to In Progress.

## Never, without the founder saying yes in the Linear issue

- Merge, approve, close or force-push anything. You open **draft** pull requests only, from branches named `agent/INT-nnn-short-name`.
- Touch critical limits, reference ranges or flag logic (`src/lib/ranges.ts`, critical-value code, marker data), `supabase/migrations/`, `supabase/functions/`, `supabase/baseline.txt`, `.github/`, `vercel.json`, auth, billing or legal text (`src/features/legal/`). These are CODEOWNERS-protected.
- Add or change any price, plan or subscription wording. `test/pricing.test.ts` must keep passing and you must not edit it to pass.
- Write medical advice, diagnoses, doses, claims that a supplement works, or any warning other than the single footer disclaimer.
- Use the Supabase connector for anything but reads. No `apply_migration`, no `execute_sql` writes.
- Put a secret, key, token or real health data anywhere: repo, Linear, Miro, PR text, logs. The repo is public.
- Point a preview or test at the production Supabase project. Use the two variables in `.env.example` with a throwaway project.
- Post, publish, email, message or spend money anywhere.

## Safety rules the code must keep

- A reading is critical only when it reaches a stored critical limit (inclusive). No limit means never critical.
- Never use a male default range for a woman or for someone with no recorded sex.
- Data the checks cannot trust stops the screen with an error. It is not skipped.
- Export and account deletion are always free and always work.

## Database changes

New file in `supabase/migrations/` named `YYYYMMDDHHMMSS_what_it_does.sql`, in a pull request. Merging applies it to production. Never edit a merged migration. A migration pull request must say in its description what it changes, whether it drops or deletes anything, and how to undo it. Flag it for human review. See `supabase/README.md`.

## Checks (all must pass before you open the PR)

```
npm ci
npm run build
npm test
npm run test:db
bash scripts/ios-ci-check.sh     # only if you touched mobile/ or shared src/lib
```

Node 22.18 or newer. If a check fails twice for the same reason, stop and comment on the issue with the output. Never skip a test, loosen an assertion or add a retry to make it pass.

## Pull request format

- Title: `INT-nnn: what changed in plain words`.
- Body: what the user will see, how you checked it, what you did not check, which files are in a protected path, and the Linear link.
- Keep it small. One issue per PR. No drive-by refactors.
- Match the surrounding code: naming, comment density, idiom. Plain logic goes in `src/lib` or a feature `model.ts`, UI components only draw.
- Design tokens live in `src/styles/index.css` (red `#A31621`, paper `#E5ECE9`, green `#12695F`, ink `#1F1300`, ochre `#8A5A14`). Inter and JetBrains Mono. No confetti, sounds or emojis.

## Reviewing a pull request (second agent)

Fail the review and say why if any of these is true:
- A protected path changed without the founder's yes in the issue.
- A test was edited to pass, deleted, skipped or weakened.
- A price, plan, claim, dose or extra disclaimer appears.
- A secret, token, email address or real health value appears anywhere in the diff.
- A migration drops or deletes data without an undo note.
- The diff is bigger than the issue.
- The PR is not a draft, or merges itself.
Otherwise list what you checked and what you could not check. Do not approve; leave a comment.

## Finishing

Every session ends with Linear and Miro current. Comment on the issue with the PR link, set status (Done only after merge), and add or update a numbered frame on the right Miro board (web: "Intus" https://miro.com/app/board/uXjVEeXXqhk=/ ; iPhone: "Intus.iOS" https://miro.com/app/board/uXjVEZLWcBQ=/). Never create a new board. Tasks and status go in Linear, visuals go in Miro. Last message: what you changed in Linear, what in Miro, what you did not verify.

## iPhone app

`mobile/` is Expo (React Native). It imports the web's plain TypeScript from `src/lib`. Cloud agents can edit and typecheck it but cannot run the Simulator or HealthKit. Say so in the PR. Device and Simulator checks are human. Overnight Mac builds use `docs/ios/` and are started by the founder only.

## Social kit

`docs/social/` is the only source for what the X account may say. Drafts go to Linear, never to X. Drafts stay out of git.

## Commands that are always wrong here

`git push --force`, `git merge`, `gh pr merge`, `gh pr review --approve`, `supabase db push`, `psql` against production, `vercel --prod`, `eas submit`, any `sudo`, any global install.
