# Yuvraaj's Health OS

A personal health tracker: daily log, progress charts, history and bloodwork, on a Supabase database that only answers to the owner's login. React, TypeScript, Vite and Tailwind, deployed on Vercel.

## Run it

```
npm install
npm run dev        # local dev server
npm test           # unit tests (Node's built-in runner, TypeScript run directly)
npm run typecheck
npm run build      # typecheck, then production build into dist/
```

Node 22.18 or newer is needed, because the tests run TypeScript through Node's built-in type stripping.

The app talks to the production Supabase project by default. `.env.example` lists the two variables that point it elsewhere. The publishable key is public by design, and row-level security is what protects the data (see `supabase/README.md`).

## Layout

| Path | What lives there |
| --- | --- |
| `src/lib/` | Plain logic with no UI or network: trend detection, screening calendar, critical-value checks |
| `src/features/bloodwork/` | The Bloodwork screen. `model.ts` turns table rows into what is shown, and the components only draw it |
| `src/features/dashboard/` | The single page: numbered sections, the index (left rail on desktop, tab bar and sheet on phones), scroll tracking and the toast |
| `src/features/today`, `progress`, `history` | The daily log, charts and history table |
| `src/features/screening/` | Your details and the screening calendar, with a way to record a screening as done |
| `src/features/supplements/` | The supplements you take (a multivitamin, creatine) with start and end dates, and a before/after comparison against what you log. No dose checks or warnings |
| `src/features/auth/` | Email and password sign-in through Supabase Auth |
| `src/db/` | Supabase client, generated table types and the queries |
| `src/components/ui/` | shadcn-style building blocks: `stepper` (onboarding), `pixel-trail` (the dots that light up under the cursor), `ascii-art` (shapes drawn in characters), buttons, segmented control, number ticker |
| `src/components/hooks/` | `use-debounced-dimensions` and `use-screen-size`, used by the trail and the overview |
| `src/styles/` | `index.css` holds Tailwind and the design tokens, `components.css` the shared classes the feature screens use |
| `supabase/` | Migrations and the notes on the owner-only lock-down |
| `test/` | Unit tests for `src/lib` and for the view logic |

## Design

One page, inspired by Apple's large titles and grouped cards, in a Swiss red and paper palette with an ASCII streak. The tokens live in `src/styles/index.css`.

- Colours: red `#A31621` for actions and the current section, paper `#E5ECE9`, green `#12695F` for on track, ink `#1F1300` for text, and `#A3988F` for the background dots. An ochre (`#8A5A14`) marks "close" and "check this".
- Type: Inter for titles and text, JetBrains Mono for numbers, labels and the ASCII art, both set heavier than their defaults (body 500, medium 600, semibold 700). Both fonts are bundled, so no font request leaves the browser.
- Layout: on desktop the section index is pinned to the left edge and the content fills the rest of the width, up to 1,640 px.
- Background: a grid of small dots (3 px on a 22 px pitch, set in `src/components/dot-ground.tsx`). On a desktop pointer the dots under the cursor light red and fade.
- Motion: sections fade up once, numbers settle into place, bars fill, the ASCII shapes turn slowly and pause off screen. Everything stops under reduced motion. No confetti, particles, sounds or emojis.
- The UX journey, onboarding questions, page map and visual language are on the Miro board "Health OS: UI/UX revamp".

## Bloodwork and safety

- A reading counts as critical only when the marker's critical limits have been signed off by a clinician (`biomarkers.threshold_verified_at`) and the reading reaches one (inclusive). A marker with no limit is reported as unwatched, and a marker whose limits nobody has signed off is reported as unverified. Neither is ever shown as fine.
- No limit has been signed off yet, so critical-value alerts are off, and the Bloodwork screen says so in place of a reassuring green banner. Results are still flagged against the stored reference range. To turn alerts on for a marker, a clinician reviews its limits and the project owner records the sign-off in SQL (see `supabase/migrations/20261005000600_threshold_verification.sql`). The reviewer's name is required, and the API cannot write to that table.
- Results can be typed in on the Bloodwork screen. They are stored with the source `manual`, shown as "entered by you", and can be deleted from the screen. Only plain decimals are accepted, a second result for the same marker on the same day is refused, and a number ten times outside the usual range asks for confirmation in case it was typed in the wrong unit.
- Arrows compare the latest result with the one before. A statistical trend (Mann-Kendall) needs five results, so most markers will not show one yet.
- The app does not assess medicines or doses. Supplements are recorded with their dates and schedule, and nothing more.
- "What changed since you started" (Supplements tab) sets the 28 days before a supplement's start date against days 8 to 63 after it, using only days you logged. It says nothing until each period has 10 logged days, calls a change only when it is both a medium-sized shift and clearly larger than ordinary day-to-day variation, never colours a change good or bad, and flags other supplements started or stopped close to the same time. Bloodwork is shown as one result before and one after, never as a trend. It is an observation of two periods and cannot show that a supplement works. The rules and their numbers live in `src/features/supplements/effect.ts` and are pinned by `test/supplements.effect.test.ts`.
- Data the checks cannot trust (a reading with no biomarker, a threshold that is not a number) stops the screen with an error instead of being skipped.
