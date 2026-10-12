# Lab panel exercise: templates and scoring sheet

The files for the ten-panel exercise in [`../lab-panel-exercise.md`](../lab-panel-exercise.md). The example rows in both templates are invented; delete them before use.

| File | One row per | Who fills it in |
| --- | --- | --- |
| `panels.template.csv` | marker in a panel | You, transcribing each report |
| `scores.template.csv` | panel | You and the clinician, after the hand interpretation, baseline and narrator runs |

Copy them to `panels.csv` and `scores.csv`. Those two names are in `.gitignore`, so real data cannot be committed by accident. Keep them somewhere private, and never paste them into a tool or chat you would not paste your own medical record into.

## panels.csv

| Column | What goes in it |
| --- | --- |
| `panel_id` | Your own code, for example `P01`. Never anything that identifies the person |
| `marker` | As printed on the report, for example `LDL cholesterol` |
| `value` | A plain decimal, as printed. A result like `<5` goes in `context` with `value` left as the number, or the row left out |
| `unit` | As printed, for example `mmol/L`. Do not convert |
| `lab_ref_low`, `lab_ref_high` | The lab's printed range. Leave one empty when the report prints only an upper or lower limit |
| `sex` | `F`, `M` or `X` |
| `age_band` | Ten-year band, for example `30-39` |
| `test_date` | `YYYY-MM-DD` |
| `context` | One line: medication or condition the person mentioned, or a note on the result. Quote it if it holds a comma |

## scores.csv: the clinician scoring sheet

| Column | What goes in it |
| --- | --- |
| `panel_id` | Matches `panels.csv` |
| `clinician_mark` | The clinician's mark on your hand interpretation: `wrong`, `unsafe`, `true_but_useless` or `would_say`. Only `would_say` counts as useful |
| `clinician_notes` | What the clinician would change, in their words |
| `adds_beyond_lab_flags` | `yes` if the clinician says the interpretation adds something beyond the lab's own high and low flags |
| `narrator_facts_match` | `yes` if every number and every in-range or out-of-range statement in the narrator's output matches the report |
| `narrator_invented_numbers` | How many numbers the narrator wrote that are not on the report. Any at all fails the gate |
| `narrator_unsafe` | `yes` for any diagnosis, dose, reassurance about an out-of-range result, or advice to start or stop a medicine |
| `units_ok` | `yes` if the output keeps the report's units and catches a mismatch rather than converting silently |
| `narration_cost_cents` | Marginal cost of the narration for this panel, in cents |
| `scored_by`, `scored_on` | Initials of who verified the row, and the date |

## Checking the files and reading the gate

```
node scripts/lab-panels.ts panels.csv              # transcription checks only
node scripts/lab-panels.ts panels.csv scores.csv   # and the gate
```

The script reads the files and prints, nothing more. It catches missing fields, values that are not plain decimals, a range the wrong way round, a marker entered twice, and a panel whose sex, age band or date changes between rows. It cannot catch a misread number, so check every value twice by hand.

The gate result is `GO`, `STOP` or `NOT YET`, using the numbers in the exercise: a stop (any unsafe statement, or 5 or more panels that add nothing beyond the lab's flags) wins over everything; go needs all ten panels, at least 8 useful, facts matched on at least 9 with no invented numbers, and narration under 2 cents on every panel. The script also requires units to be right on every panel, from the rubric. The 2-cent target is an assumption until real unit economics replace it (`COST_TARGET_CENTS` in `scripts/lab-panels.ts`).
