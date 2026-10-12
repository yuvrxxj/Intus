# Intus

Live at https://intus.fit. A personal health tracker: daily log, progress charts, history and bloodwork, on a Supabase database that only answers to the owner's login. React, TypeScript, Vite and Tailwind, deployed on Vercel.

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
| `src/features/dashboard/` | The single page: numbered sections, the index (left rail on desktop, tab bar and sheet on narrow windows), scroll tracking and the toast |
| `src/features/home/` | The public homepage (About, Why this, Pricing, Knowledge base) and the small router: `/` is the homepage for signed-out visitors and the app for signed-in ones, `/signin` is sign-in (`/signin?mode=signup` opens Create account). `knowledge.ts` holds the supplement entries, `route.ts` the address rules. `vercel.json` rewrites every path to `index.html` so `/signin` works on a reload |
| `src/features/mobile/` | On a phone browser the homepage is the whole site, and any other address shows a "Coming soon to iOS and Android" screen instead of the app. `device.ts` decides; tablets and desktops pass |
| `src/features/today`, `progress`, `history` | The daily log, charts and history table |
| `src/features/photos/` | Photo check-ins, a card under Goals and habits. `model.ts` holds the rules (angles, limits, compare first and latest), `image.ts` resizes in the browser and re-encodes so location and camera tags never leave the device, `removeAll.ts` empties a folder and proves it. The pictures live in a private Storage bucket; see `supabase/README.md` |
| `src/features/sleep/` | The Sleep section (03). Nothing derived is stored: `model.ts` checks an entry, `nights.ts` builds nights from what each source said (one source per night, never blended), `metrics.ts` works out time asleep and stages, `summary.ts` the averages (none under 5 nights), `ageBand.ts` the recommended range by age, `time.ts` circular clock statistics. The rules and the research behind them are in `docs/product/sleep-tracker.md` |
| `src/features/organs/` | "Your body today", under the overview: an organ drawn in characters for each group of readings (lungs, liver, heart, pancreas, kidneys, thyroid, brain, bones, blood), red when on track and fading to grey as a reading moves away from your own goal or the lab's range. `model.ts` holds the map from the Sprint 2 plan and every fade rule; each card lists the readings that set its colour. No score |
| `src/features/reports/` | Upload a lab report PDF on the Bloodwork screen. `extract.ts` reads it on the device (pdf.js, and Tesseract OCR for scanned pages, served from `public/ocr/`, which `scripts/copy-ocr.mjs` fills at build time), `parse.ts` finds each marker (names labs use are in `aliases.ts`), its value, unit, printed range and the sample date, and `review.ts` decides which rows start ticked. Nothing is saved until the person checks the table; units are never converted, and a unit that differs from the stored one leaves the row out until the person deals with it. A private copy of the PDF can be kept in the `lab-reports` bucket |
| `src/features/screening/` | Your details and the screening calendar, with a way to record a screening as done |
| `src/features/supplements/` | The supplements you take (a multivitamin, creatine) with start and end dates, and a before/after comparison against what you log. No dose checks or warnings |
| `src/features/account/` | The Account section (the last on the page): who is signed in, Sign out, and Delete account, which asks for the email to be typed back, calls `delete_my_account()` in the database (see `supabase/README.md`), clears what the app keeps on the device and signs out |
| `src/features/auth/` | Sign-in through Supabase Auth: email and password, password reset, and Google once it is switched on in Supabase |
| `src/db/` | Supabase client, generated table types and the queries |
| `src/components/ui/` | shadcn-style building blocks: `stepper` (onboarding), `pixel-trail` (the dots that light up under the cursor), `scroll-heading` (the section title that lights red as it climbs the window; its styles are `.scroll-heading` in `src/styles/components.css`), `ascii-art` and its pure engine `ascii-engine.ts` (shapes drawn in characters: heart, drop, capsule, ring, sphere, bars, cross, stack, coin, cube, moon, and the organs lungs, liver, kidneys, brain, bone, thyroid, pancreas). Each page section has one beside its title, chosen in `src/features/dashboard/sectionArt.ts`; `test/ascii.test.ts` fails if a shape is clipped by its frame, buttons, segmented control, number ticker |
| `src/components/` | `brand.tsx` is the mark and the wordmark, drawn from `brand-mark.ts` (generated by `scripts/brand_assets.py`). `statue-bust.tsx` is the animated statue bust. `dot-ground.tsx` is the page background |
| `public/` | Served from the site root: the favicon (`.ico` and `.svg`), the Apple touch icon and `og.png`, the image link previews show. `scripts/brand_assets.py` and `scripts/brand_rasters.mjs` make them, and `test/brand.test.ts` fails if a tag in `index.html` points at a missing or wrongly sized file |
| `docs/product/womens-health.md` | The plan for the women's health module: sex- and phase-specific ranges as rows, cycle tracking, the cycle phase on each blood draw, conditions and the pregnancy pause, and what has to come from a specialist |
| `docs/product/lab-panels/` | Templates for the ten-panel lab exercise (`panels.template.csv`, and `scores.template.csv`, the clinician scoring sheet). `scripts/lab-panels.ts` checks the filled-in files and prints the go or stop gate; real files are kept out of git |
| `mobile/` | The iPhone app (Expo, React Native), for now a thin HealthKit sync companion: sign in, allow Apple Health, sync sleep into `sleep_sessions` and HRV and resting heart rate into `cardio_metrics`. Its own `package.json`; see `mobile/README.md`. The sample-to-row mapping is tested here in `test/mobile.sync.test.ts`, and CI typechecks the app |
| `docs/brand/` | The logo options and the chosen one (option B), plus the source of the link preview image |
| `src/components/hooks/` | `use-debounced-dimensions` and `use-screen-size`, used by the trail and the overview |
| `src/styles/` | `index.css` holds Tailwind and the design tokens, `components.css` the shared classes the feature screens use |
| `supabase/` | Migrations, the script and workflow that apply them, and the notes on who can see what |
| `test/` | Unit tests for `src/lib` and for the view logic |

## Design

One page, inspired by Apple's large titles and grouped cards, in a Swiss red and paper palette with an ASCII streak. The tokens live in `src/styles/index.css`.

- Colours: red `#A31621` for actions and the current section, paper `#E5ECE9`, green `#12695F` for on track, ink `#1F1300` for text, and `#A3988F` for the background dots. An ochre (`#8A5A14`) marks "close" and "check this".
- Type: Inter for titles and text, JetBrains Mono for numbers, labels and the ASCII art, both set heavier than their defaults (body 500, medium 600, semibold 700). Both fonts are bundled, so no font request leaves the browser.
- Layout: on desktop the section index is pinned to the left edge and the content fills the rest of the width, up to 1,640 px.
- Background: a grid of small dots (3 px on a 22 px pitch, set in `src/components/dot-ground.tsx`). On a desktop pointer the dots under the cursor light red and fade.
- Motion: sections fade up once, section titles light red as they climb the upper part of the window (a gradient pinned to the viewport and clipped to the letters, with no script; mouse and trackpad only, plain ink on touch screens, in print and in forced colours), numbers settle into place, bars fill, the ASCII shapes turn slowly and pause off screen. On the statue bust a band of lighter red crosses the stone every eight seconds and the chest rises and falls a little, also paused off screen. Everything stops under reduced motion. No confetti, particles, sounds or emojis.
- The UX journey, onboarding questions, page map and visual language are on the Miro board "Health OS: UI/UX revamp" (the board still carries the old name).
- Artwork: the ribs in the desktop section index are real characters plus a traced solid layer, drawn as SVG by `src/components/ui/ascii-picture.tsx` from `src/components/art/ribs.ts`. That file is generated by `scripts/ascii_art.py` from `docs/art/ribs-source.webp`, and the same script can turn any one-colour artwork into ASCII. `src/assets/art/statue-bust.webp` is the statue bust, red on transparent, shown on the homepage and on the sign-in screen through `src/components/statue-bust.tsx`, which adds the light and the breathing (the picture's own shape masks the light, so it falls only on the statue).
- Logo: option B, the section cut (chosen 11 Oct 2026), a slash that is solid at its head and dissolves into halftone dots. The three options and the files are in `docs/brand/logos/`.

## Bloodwork and safety

- A reading counts as critical when it reaches a stored critical limit (inclusive). A marker with no limit can never be flagged as critical.
- Each result is flagged against the range printed on its own report when it has one (stored with the result; the lab chose it for the person's sex and age). Without one, the marker's usual range is used only when it applies to the person: usual ranges that are men's ranges (`biomarkers.ref_sex`) are never used for a woman, or for someone whose sex is not recorded, and the result shows no range instead. The rule is `src/lib/ranges.ts`; the screen says which range each result was read against.
- The only disclaimer in the app is the one line in the footer. No screen carries its own warning or caveat.
- Results can be typed in on the Bloodwork screen. They are stored with the source `manual`, shown as "entered by you", and can be deleted from the screen. Only plain decimals are accepted, a second result for the same marker on the same day is refused, and a number ten times outside the usual range asks for confirmation in case it was typed in the wrong unit.
- Arrows compare the latest result with the one before. A statistical trend (Mann-Kendall) needs five results, so most markers will not show one yet.
- The app does not assess medicines or doses. Supplements are recorded with their dates and schedule, and nothing more.
- "What changed since you started" (Supplements tab) sets the 28 days before a supplement's start date against days 8 to 63 after it, using only days you logged. It says nothing until each period has 10 logged days, calls a change only when it is both a medium-sized shift and clearly larger than ordinary day-to-day variation, never colours a change good or bad, and flags other supplements started or stopped close to the same time. Habits are compared too (a yes or no habit as the share of logged days it was a yes, a count or amount as its number; a day with no entry is not a no), and so are heart rate variability and resting heart rate from `cardio_metrics`, averaged per day, once a phone sync fills that table. Bloodwork is shown as one result before and one after, never as a trend. It is an observation of two periods and cannot show that a supplement works. The rules and their numbers live in `src/features/supplements/effect.ts` and are pinned by `test/supplements.effect.test.ts`.
- The homepage knowledge base is about supplements only: which blood results a supplement can move, in which direction and why. It never scores or judges. The entries are plain data in `src/features/home/knowledge.ts` and should be reviewed against sources before launch (the biotin entry follows the FDA's safety communication).
- Data the checks cannot trust (a reading with no biomarker, a threshold that is not a number) stops the screen with an error instead of being skipped.
