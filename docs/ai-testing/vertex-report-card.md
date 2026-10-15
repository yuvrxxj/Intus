# Google Vertex AI report card: which Gemini model should read a lab report

INT-130, 14 Oct 2026. Test environment only: nothing here is on main, in the app or in the database. This is the Google half of the bake-off; the Groq half is in [README.md](README.md).

## The answer

**Use `gemini-3.5-flash-lite`, with every field of a row required in the response schema.** It was the cheapest model that read the whole report, it is fast, and it filled the Bloodwork screen exactly in 6 of 7 runs.

| | Result |
| --- | --- |
| Time | 10 to 17 seconds for the whole 38-page report, in one request |
| Cost | $0.013 to $0.022 per report at list price, about **$13 to $22 per 1,000 reports** |
| Tokens | about 12,200 in, 5,000 to 7,500 out, no thinking tokens |
| Read | 67 to 69 of the 69 results the app's own reader finds, 0 invented rows |
| Bloodwork screen | all 28 tracked markers identical to the app's own reader's, and all 5 out-of-range flags, in 6 of 7 runs. The seventh was missing one marker (white cell count) |

Two settings decide whether a Gemini model works at all, and both are free:

1. **Do not leave thinking at its default on the models that think.** All six that think (2.5 Flash, 2.5 Pro, 3 Flash, 3.5 Flash, 3.8 Flash, 3.1 Pro) spent 10,000 to 15,700 of the app's 16,384 output tokens on thinking, were cut off, and returned **no rows at all**: six requests, $0.81, nothing to show. Turn thinking off (budget 0 or the lowest level the model has) or choose a model that does not think by default, which the Flash-Lite models do not.
2. **Make every field required in the Gemini response schema.** The app's schema requires only `name`, `value_text` and `line`, so a model may leave out `marker`, `unit` and the printed range. With it, `gemini-3.5-flash-lite` had an exact Bloodwork screen in 6 of 7 runs; with the app's schema, 6 of 10, and in the others it **dropped the upper limit of a printed range on creatinine and total T4 (three runs), which made both read "in range" when the app's reader flags them high**, or wrote no marker on any row (one run). Several other models did the second thing on every row (2.5 Flash-Lite, 2.5 Pro, 3.8 Flash: 0 of 28 markers). The OpenRouter route already requires every field; the Gemini route does not.

Runner-up: **`gemini-2.5-flash`, thinking off, all fields required**: 3 of 3 exact screens at $0.020 to $0.024, but 30 to 80 seconds a read and 7 to 9 invented rows per read (the app's verifier drops them, so they never reach the screen, but they are paid for).

## The report card

Grades are for this job: reading a lab report into the Bloodwork screen, at each model's best setting. Cost and time are per report.

| Model | Grade | Best setting | Time | Cost | Out tokens | Read (of 69) | Invented | Exact screens | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **gemini-3.5-flash-lite** | **A-** | all fields required (thinking not used) | 10 to 17 s | $0.013 to $0.022 | 5.1k to 7.5k | 67 to 69 | 0 | 6 of 7 | Cheapest model that works, fast, and the only one with no invented rows at this price |
| gemini-2.5-flash | B+ | thinking off, all fields required | 30 to 80 s | $0.020 to $0.024 | 6.6k to 8.2k | 69 | 7 to 9 | 3 of 3 | Exact every time, but slow and it pads with rows the verifier throws away |
| gemini-3.1-pro-preview | B | thinking at its lowest, all fields required | 64 to 66 s | $0.115 | 7.5k | 69 | 0 | 1 of 1 (and 1 of 1 on the app's schema) | Works; costs 5 to 9 times the Flash-Lite for no better screen |
| gemini-3.5-flash | C | thinking off, all fields required | 39 s and 209 s, and four requests that hung past 300 s | $0.085 | 7.5k | 69 | 0 | 1 of 1 | Works when it answers, 4 to 6 times the price, and its latency is erratic |
| gemini-2.5-pro | C | thinking at its smallest, all fields required | 35 s | $0.059 | 4.4k | 62 | 0 | 1 of 1 | Screen exact, but 7 results missed; 3 to 4 times the price |
| gemini-3.8-flash | D | thinking at `low`, all fields required | 28 s | $0.057 | 5.1k | 69 | 0 | 0 of 1 (26 of 28, 4 of 5 flags) | On the app's schema it wrote no marker at all (0 of 28) |
| gemini-3-flash-preview | D | thinking off, all fields required | 23 s | $0.019 | 4.3k | 62 | 0 | 0 of 1 (27 of 28) | Reads 40 to 62 of 69; invented 24 rows on the app's schema |
| gemini-2.5-flash-lite | D | all fields required | 15 s | $0.004 | 7.2k | 55 | 15 | 0 of 1 (26 of 28) | The cheapest of all, and it shows: 14 results missed, 15 invented |
| gemini-3.1-flash-lite | F | all fields required | 5.9 s | $0.006 | 2.2k | 33 | 0 | 0 of 1 (25 of 28) | Stops early: 2 rows on the app's schema (111 tokens), 33 with the change |
| Any of the six that think, at default thinking | F | the app's settings | 73 to 173 s | $0.04 to $0.22, for nothing | 16.4k (cap) | none | n/a | 0 | Cut off by the output cap before the first row was finished |

Cost per 1,000 reports at list price, best setting: 3.5 Flash-Lite $13 to $22, 2.5 Flash $20 to $24, 2.5 Pro $59, 3.8 Flash $57, 3.5 Flash $85, 3.1 Pro $115. For comparison, from the Groq half on this same redacted report: Qwen 3.8 27B $40 and gpt-oss-20b $3, but the free Groq key took 2.5 to 3.5 minutes a read and Vertex takes 10 to 17 seconds in one request.

"Exact screen" means every one of the app's 28 tracked markers is on the Bloodwork screen with the same number and the same flag (in range, below, above), and every out-of-range marker the app's reader flags is flagged the same way.

## What it cost

Every number is from the tokens Google reported on each answer, times Google's Standard list prices (Vertex AI pricing page, read 14 Oct 2026; output includes thinking).

| Model | Runs on the real report | Runs on made-up text | Tokens in | Tokens out (of which thinking) | List price, all runs | of which on the real report |
| --- | --- | --- | --- | --- | --- | --- |
| gemini-3.1-pro-preview | 3 | 2 | 39,876 | 40,599 (16,638) | $0.57 | $0.45 |
| gemini-3.5-flash | 3 | 3 | 41,524 | 41,631 (21,632) | $0.44 | $0.34 |
| gemini-3.8-flash | 3 | 4 | 41,524 | 42,805 (11,817) | $0.38 | $0.24 |
| gemini-2.5-pro | 3 | 2 | 38,918 | 31,370 (15,343) | $0.35 | $0.29 |
| gemini-3.5-flash-lite | 17 | 2 | 210,604 | 101,397 (0) | $0.28 | $0.28 |
| gemini-2.5-flash | 6 | 3 | 76,386 | 76,138 (33,829) | $0.21 | $0.17 |
| gemini-3-flash-preview | 3 | 2 | 39,876 | 42,297 (31,457) | $0.15 | $0.09 |
| gemini-3.1-flash-lite | 3 | 2 | 39,876 | 3,207 (0) | $0.01 | $0.01 |
| gemini-2.5-flash-lite | 2 | 2 | 26,920 | 15,501 (0) | $0.01 | $0.01 |
| **Total** | **43** | **22** | **555,504** | **394,945 (130,716)** | **$2.40** | **$1.88** |

**This is not checked against Google's own billing.** From the cloud session the Cloud Billing API is switched off in the project, Cloud Monitoring refuses the service account, and BigQuery has no billing export, so Google's billed amounts could not be read. To check: Google Cloud console, Billing, Reports, 14 Oct 2026, filter the service to Vertex AI, group by SKU. Expect about $2.40 to $2.60: the table, plus six requests to 3.5 Flash that never answered (four timed out at 300 seconds and two were cut off by me; Google may still have billed them, at most a few cents each), two small probe calls and about 40 one-word test calls, which are cents. Google halves Gemini 3.8 Flash's price through 31 Dec 2026, so its rows will show about $0.19 less than the list price here, and any free credit on the account comes off the end. Billing reports can lag by hours.

## What else the runs showed

- **Latency is not steady on the global endpoint.** `gemini-3.5-flash` answered in 39 s and in 209 s for the same request and then four more requests hung past the 300-second limit (three in a row, then one more) before I stopped trying. The Flash-Lite models were steady (3.5 Flash-Lite took 7 to 17 s over 17 runs).
- **Models differ run to run even at temperature 0.** The same request to `gemini-3.5-flash-lite` produced 3,567 to 7,477 output tokens, so cost varies about 2 times between identical runs.
- **Output is about 80% of the cost.** 12,200 tokens in cost $0.004 on Flash-Lite and 5,000 to 7,500 out cost $0.013 to $0.019. Cutting the output (each row repeats the whole report line it came from) would cut the cost more than anything else; that is a change to the app's request and not tried here.
- **A bigger output cap rescues default thinking, at a price.** `gemini-2.5-flash` at default thinking and a 40,000-token cap finished with an exact screen, spending 11,391 thinking tokens for the same 75 rows: $0.045 and 72 s, against $0.020 and 30 s with thinking off.
- **Thinking does not buy accuracy here.** Nothing that thinks beat `gemini-3.5-flash-lite`, and the only default-thinking run that finished (2.5 Flash with the cap raised) matched its thinking-off result at twice the cost.
- **The Bloodwork screen was drawn through the app's own review and view code**, from each run's rows, and compared marker by marker with the screen the on-device reader fills. The winning model's screen is the same 28 markers with the same 5 flags (creatinine above, total T4 above, eGFR, iron and vitamin D below range).

## How it was run

- One real 38-page lab report, as the app would send it: the app's own redactor with no names given (942 lines, about 9,800 tokens, the same text the Groq runs used), plus the prompt and the marker list, in **one request** with the app's 16,384-token output cap and its own Gemini request and parser.
- The app's on-device reader finds 69 results on the report, 28 for tracked markers, and is the yardstick. It is a set of rules, not the truth: rows a model found beyond it are counted, not penalised. "Invented" is rows the app's verifier dropped because the number is not printed on the line the model named.
- Settings: each model with thinking off (a budget of 0, or the lowest level it has) on the app's schema and with all fields required; the models that think also at default; 3.5 Flash-Lite 17 times in all, 2.5 Flash 6 times, the rest once or twice per setting. Counts of one are single observations, not rates.
- The service account's key never left the cloud session's environment. Run files with the rows read from the report are in `test-lab/local/`, which is not in git; the ledger (`ledger.jsonl`) holds measurements only.

## What this does not show

- One report from one lab. A scanned report, a short one or another lab's layout could change the order.
- Small counts. 3.5 Flash-Lite's 6 of 7 is a rate from 7 runs; the others have 1 to 3. The direction (all fields required helps, default thinking fails) is clear; the exact rates are not.
- The text sent was redacted by the app's redactor (no names given). The same report unredacted was not run: the session's guard stopped that request, and it would not have changed the ranking, only the tokens (the unredacted text is about twice as long).
- Cost is list price from Google's tokens, not a billed amount (see above). The data terms for this account are not checked.
- Nothing was wired into the app. Using any of this means a pull request: a `vertex` provider in `ai_settings` (a migration), the service account as an Edge Function secret, thinking off, every field required in `RESPONSE_SCHEMA`, and a check that a tracked marker's printed range has both limits the on-device reader sees (the dropped upper limit is a silent error otherwise).

## All runs

Generated by `node scripts/vertex-card.ts report.txt` from the run files; ranges are over the runs of a setting.

### Thinking off, the app's own schema

| Model | Runs | Finished | Time per read | Tokens in / out | Thinking tokens | Cost per read | Found of 69 | Invented rows | Bloodwork markers identical | Exact screens | Concerns flagged | False alarms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gemini-2.5-flash-lite | 1 | 1 of 1 | 12 s | 11,998 / 5,454 | 0 | $0.0034 | 65 | 2 | 0 of 28 | 0 of 1 | 0 of 5 | 0 |
| gemini-3.1-flash-lite | 1 | 1 of 1 | 1.6 s | 12,188 / 111 | 0 | $0.0032 | 2 | 0 | 2 of 28 | 0 of 1 | 0 of 5 | 0 |
| gemini-3.5-flash-lite | 3 | 3 of 3 | 11 s to 16 s | 12,188 / 5,052 to 7,472 | 0 | $0.0163 to $0.0223 | 69 | 0 | 28 of 28 | 3 of 3 | 5 of 5 | 0 |
| gemini-2.5-flash | 1 | 1 of 1 | 39 s | 11,998 / 5,676 | 0 | $0.0178 | 59 | 13 | 27 of 28 | 0 of 1 | 4 of 5 | 0 |
| gemini-3-flash-preview | 1 | 1 of 1 | 22 s | 12,188 / 4,163 | 0 | $0.0186 | 40 | 24 | 17 of 28 | 0 of 1 | 3 of 5 | 0 |
| gemini-3.5-flash | 1 | 1 of 1 | 209 s | 12,188 / 7,472 | 0 | $0.0855 | 69 | 0 | 27 of 28 | 0 of 1 | 5 of 5 | 0 |
| gemini-3.8-flash | 1 | 1 of 1 | 21 s | 12,188 / 3,818 | 0 | $0.0469 | 69 | 0 | 0 of 28 | 0 of 1 | 0 of 5 | 0 |
| gemini-2.5-pro | 1 | 1 of 1 | 42 s | 11,998 / 4,767 | 67 | $0.0492 | 65 | 2 | 0 of 28 | 0 of 1 | 0 of 5 | 0 |
| gemini-3.1-pro-preview | 1 | 1 of 1 | 64 s | 12,188 / 7,552 | 0 | $0.115 | 69 | 0 | 28 of 28 | 1 of 1 | 5 of 5 | 0 |

### Thinking off, all fields required

| Model | Runs | Finished | Time per read | Tokens in / out | Thinking tokens | Cost per read | Found of 69 | Invented rows | Bloodwork markers identical | Exact screens | Concerns flagged | False alarms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gemini-2.5-flash-lite | 1 | 1 of 1 | 15 s | 12,006 / 7,205 | 0 | $0.0041 | 55 | 15 | 26 of 28 | 0 of 1 | 5 of 5 | 0 |
| gemini-3.1-flash-lite | 1 | 1 of 1 | 5.9 s | 12,204 / 2,246 | 0 | $0.0064 | 33 | 0 | 25 of 28 | 0 of 1 | 4 of 5 | 0 |
| gemini-3.5-flash-lite | 3 | 3 of 3 | 10 s to 17 s | 12,204 / 5,053 to 7,477 | 0 | $0.0163 to $0.0224 | 68 to 69 | 0 | 27 to 28 of 28 | 2 of 3 | 5 of 5 | 0 |
| gemini-2.5-flash | 3 | 3 of 3 | 30 s to 80 s | 12,006 / 6,558 to 8,218 | 0 | $0.0200 to $0.0241 | 69 | 7 to 9 | 28 of 28 | 3 of 3 | 5 of 5 | 0 |
| gemini-3-flash-preview | 1 | 1 of 1 | 23 s | 12,204 / 4,328 | 0 | $0.0191 | 62 | 0 | 27 of 28 | 0 of 1 | 4 of 5 | 0 |
| gemini-3.5-flash | 1 | 1 of 1 | 39 s | 12,204 / 7,455 | 0 | $0.0854 | 69 | 0 | 28 of 28 | 1 of 1 | 5 of 5 | 0 |
| gemini-3.8-flash | 1 | 1 of 1 | 28 s | 12,204 / 5,094 | 0 | $0.0565 | 69 | 0 | 26 of 28 | 0 of 1 | 4 of 5 | 0 |
| gemini-2.5-pro | 1 | 1 of 1 | 35 s | 12,006 / 4,405 | 80 | $0.0591 | 62 | 0 | 28 of 28 | 1 of 1 | 5 of 5 | 0 |
| gemini-3.1-pro-preview | 1 | 1 of 1 | 66 s | 12,204 / 7,549 | 0 | $0.115 | 69 | 0 | 28 of 28 | 1 of 1 | 5 of 5 | 0 |

### Default thinking, the app's own schema and 16,384-token cap

| Model | Runs | Finished | Time per read | Tokens in / out | Thinking tokens | Cost per read | Found of 69 | Invented rows | Bloodwork markers identical | Exact screens | Concerns flagged | False alarms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gemini-2.5-flash | 1 | 0 of 1 (truncated) | 101 s | 11,998 / 16,370 | 11,391 | $0.0445 | none | n/a | 0 | 0 of 1 | 0 | n/a |
| gemini-3-flash-preview | 1 | 0 of 1 (truncated) | 73 s | 12,188 / 16,369 | 15,726 | $0.0552 | none | n/a | 0 | 0 of 1 | 0 | n/a |
| gemini-3.5-flash | 1 | 0 of 1 (truncated) | 173 s | 12,188 / 16,369 | 15,725 | $0.166 | none | n/a | 0 | 0 of 1 | 0 | n/a |
| gemini-3.8-flash | 1 | 0 of 1 (truncated) | 91 s | 12,188 / 16,369 | 10,131 | $0.141 | none | n/a | 0 | 0 of 1 | 0 | n/a |
| gemini-2.5-pro | 1 | 0 of 1 (truncated) | 103 s | 11,998 / 16,368 | 11,890 | $0.179 | none | n/a | 0 | 0 of 1 | 0 | n/a |
| gemini-3.1-pro-preview | 1 | 0 of 1 (truncated) | 138 s | 12,188 / 16,370 | 10,040 | $0.221 | none | n/a | 0 | 0 of 1 | 0 | n/a |
| gemini-3.5-flash-lite | 7 | 7 of 7 | 7.4 s to 15 s | 12,188 / 3,567 to 7,472 | 0 | $0.0093 to $0.0191 | 69 | 0 | 0 to 28 of 28 | 3 of 7 | 0 to 5 of 5 | 0 |
| gemini-3.1-flash-lite | 1 | 1 of 1 | 1.6 s | 12,188 / 111 | 0 | $0.0032 | 2 | 0 | 2 of 28 | 0 of 1 | 0 of 5 | 0 |

### Default thinking, output cap raised to 40,000 tokens

| Model | Runs | Finished | Time per read | Tokens in / out | Thinking tokens | Cost per read | Found of 69 | Invented rows | Bloodwork markers identical | Exact screens | Concerns flagged | False alarms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gemini-2.5-flash | 1 | 1 of 1 | 72 s | 11,998 / 16,558 | 11,391 | $0.0450 | 69 | 0 | 28 of 28 | 1 of 1 | 5 of 5 | 0 |

### Google's default setting, all fields required (only Flash-Lite: the others think and cannot finish)

| Model | Runs | Finished | Time per read | Tokens in / out | Thinking tokens | Cost per read | Found of 69 | Invented rows | Bloodwork markers identical | Exact screens | Concerns flagged | False alarms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gemini-3.5-flash-lite | 4 | 4 of 4 | 10 s to 15 s | 12,204 / 5,056 to 7,471 | 0 | $0.0130 to $0.0214 | 67 to 69 | 0 | 28 of 28 | 4 of 4 | 5 of 5 | 0 |

## Reproduce

```
node scripts/report-text.ts report.pdf > report.txt        # the app's redactor; add --name FirstName for the name
NODE_USE_ENV_PROXY=1 node scripts/vertex-bench.ts report.txt --require-all --plan gemini-3.5-flash-lite:default --repeats 3
node scripts/vertex-card.ts report.txt                      # the tables above
VITE_AI_LAB=1 npm run dev                                   # /ai-lab draws the Bloodwork screen from any run
```
