# Yuvraaj's Health OS

A personal health tracker: daily log, progress charts, history and bloodwork, on a Supabase database that only answers to the owner's login. React, TypeScript and Vite, deployed on Vercel.

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
| `src/lib/` | Plain logic with no UI or network: trend detection, screening calendar, critical-value checks, paracetamol and biotin checks |
| `src/features/bloodwork/` | The Bloodwork screen. `model.ts` turns table rows into what is shown, and the components only draw it |
| `src/features/today`, `progress`, `history` | The daily log, charts and history table |
| `src/features/screening/` | Your details and the screening calendar, with a way to record a screening as done |
| `src/features/meds/` | Medications and supplements, today's paracetamol total, and the alert shown above every screen |
| `src/features/auth/` | Email and password sign-in through Supabase Auth |
| `src/db/` | Supabase client, generated table types and the queries |
| `src/fx/` | The playful layer: particles, cursor, sounds. Decoration only, and it honours reduced motion |
| `supabase/` | Migrations and the notes on the owner-only lock-down |
| `test/` | Unit tests for `src/lib` and for the view logic |

## Bloodwork and safety

- A reading counts as critical when it reaches a stored critical limit (inclusive). A marker with no limit is reported as unwatched, never as fine.
- The critical limits in the database have not been verified by a clinician. The screen says so, and a quiet banner is not an all clear. A qualified person should check them before anyone else uses this app.
- Arrows compare the latest result with the one before. A statistical trend (Mann-Kendall) needs five results, so most markers will not show one yet.
- Paracetamol is totalled from the medications you enter. A product named like paracetamol with no dose or frequency is reported as incomplete, never left out, and the top-of-app alert also appears when the check itself cannot run.
- Biotin warnings on Bloodwork only appear once a biotin product is recorded under Meds.
- Data the checks cannot trust (a reading with no biomarker, a threshold that is not a number) stops the screen with an error instead of being skipped.
