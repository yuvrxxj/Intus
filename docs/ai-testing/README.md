# Intus AI testing

A test-only environment for choosing which AI model should read a lab report and fill the Bloodwork screen. Linear: INT-130, under INT-108.

**Nothing here goes to main or the live site.** No pull request to main, no deploy to production, no database change. This is a branch, a script and a page that is only built when asked for.

## What is here

| Path | What it is |
| --- | --- |
| `scripts/groq-bench.ts` | Reads one redacted report with each Groq model setting and records tokens, seconds, list-price cost, the limits Groq reports, and how much of the on-device reader's results the model found |
| `scripts/vertex-bench.ts` | The same bench for Google Vertex AI (Gemini): the whole report in one request, tokens, seconds, list-price cost, how much of the on-device reader's results the model found. See "Google Vertex AI" below |
| `scripts/vertex-card.ts` | Prints the Vertex report card from the run files, including how closely the Bloodwork screen a model's rows would fill matches the one the app's own reader fills |
| `docs/ai-testing/vertex-report-card.md` | The Vertex results: the answer, a grade per model, what it cost, what it showed, what it does not |
| `src/features/ailab/` | The pure logic (request, usage, cost, limits, scoring, ledger, preview; `groq.ts` and `vertex.ts` per provider) and the `/ai-lab` page |
| `docs/ai-testing/ledger.jsonl` | One line of measurements per run. No report text, no values, no names |
| `docs/ai-testing/models.json` | What Groq lists for each model, and the limits seen on this key |
| `test-lab/local/` | One file per run with the rows a model read. These hold lines of a real report, so the folder is not in git |

## Rules

- The report PDF and its text never go in the repository. `scripts/report-text.ts` redacts the name, ID numbers and contact details first, and that is the only text sent to Groq.
- The `/ai-lab` page exists only in a build made with `VITE_AI_LAB=1`. In any other build the route is compiled out (checked: a normal `npm run build` has no trace of it). It makes no network request of its own, and draws the Bloodwork screen from in-memory data through the app's own review and view code.
- The Groq key is never in the repository. In Claude's cloud session the network proxy adds it to requests for `api.groq.com`.
- Do not add the AI lab to a migration, the Edge Function or the production settings. Wiring a Groq model into the app is a separate change, through a pull request, after this is decided.

## Results, 14 Oct 2026

One real 38-page Healthians report (942 lines after redaction, about 9,800 tokens), sent in five chunks of up to 7,000 characters with the app's own prompt, at temperature 0, on a free-tier Groq key. "Found" is how many of the 69 results the app's on-device reader finds that the model also found, on the same line with the same number (28 are tracked markers). The reader is a fixed yardstick, not the truth, so what a model found beyond it is listed, not penalised. "Dropped" is rows the app's verifier threw out because the number is not printed on the line the model said it came from: invented or misquoted results that never reach the review table.

| Model and setting | Read the whole report | Found | Tracked found | Dropped | Wrong marker | Time (requests / elapsed) | Tokens in / out | Cost per report |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **qwen3.8-27b, default** (run twice) | yes, both | **69 of 69, both** | **28 of 28** | **0** | **0** | 17 to 18 s / 2 m 38 s and 3 m 24 s | 15,938 / 6,845, both | $0.040 |
| gpt-oss-20b, low (run twice) | yes, both | 57, then 64 of 69 | 25 of 28 | 10, both | 2, both | 10 s / 2 m 32 s to 2 m 40 s | 15,561 / 6,034 and 6,729 | $0.003 |
| gpt-oss-120b, low | yes | 41 of 69 | 26 of 28 | 6 | 0 | 23 s / 3 m 19 s | 15,561 / 8,886 | $0.008 |
| gpt-oss-120b, medium, JSON mode, 3,500-character chunks | one chunk lost | 49 of 69 | 23 of 28 | 6 | 1 | 52 s / 5 m 16 s | 19,685 / 21,903 | $0.016 |
| gpt-oss-20b, medium (two setups) | 4 to 5 chunks failed | 1 and 7 of 69 | 0 and 4 of 28 | 0 | 0 | | | |
| gpt-oss-120b, medium, strict schema | 4 of 5 chunks failed | 1 of 69 | 0 of 28 | 0 | 0 | | | |
| qwen3.8-27b, low | 4 of 5 chunks failed | 1 of 69 | 0 of 28 | 0 | 0 | | | |
| qwen3.8-27b, default, 3,500-character chunks, 2,000 tokens out | 3 chunks lost | 30 of 69 | 22 of 28 | 6 | 0 | | | |
| gpt-oss-safeguard-20b | refused: limit is 2,000 tokens a minute | | | | | | | |
| allam-2-7b | 400, failed to generate JSON | | | | | | | |

`high` effort was not run for any model: medium already spent 3,000 to 3,700 tokens thinking about a 2,000 to 3,400 token chunk and was cut off by its own output cap, so high would only have used up the day's allowance. The ledger has every run.

### What the runs say

1. **Qwen 3.8 27B at its default setting was the only model that read the whole report correctly.** It found every result the on-device reader finds, plus six printed calculated indices (Mentzer index, BUN/creatinine ratio and similar), invented nothing, and mapped no marker wrongly. Run twice, it used exactly the same tokens and gave the same rows, so it is repeatable at temperature 0. On the Bloodwork preview its 28 tracked results flag the same four concerns the report itself flags: creatinine and T4 high, iron and vitamin D low.
2. **gpt-oss-20b is the cheap option, and it is not safe to use unchecked.** About a thirteenth of Qwen's cost and a little over half its request time. But it dropped 10 rows as not printed on the report, both times, missed NT-proBNP and the iron panel both times, and **both times read Total T3 as Free T3 and Total T4 as Free T4**, the exact mistake the prompt forbids. The review table's unit check catches both (the units differ), which is the point of that check. Its recall swung from 83% to 93% between two identical runs, so it is not repeatable at temperature 0.
3. **gpt-oss-120b was worse than its small sibling.** At low effort it silently skipped whole sections (the white-cell differential, platelets, CEA) and found 59%. More thinking did not fix it: at medium effort it spent 16,600 reasoning tokens for 71% and lost a chunk to its own output cap. It cost more than twice what 20b did, for less.
4. **Reasoning is the wrong tool for this job.** gpt-oss at medium effort spent 3,000 to 3,700 tokens thinking per chunk and either hit the output cap (a truncated JSON reply loses the whole chunk), or returned an empty answer that Groq rejects with 400 `json_validate_failed` and a zero-length generation. Qwen with reasoning switched on (low) did the same. Qwen at default reports no reasoning tokens on Groq, and it finished every chunk.
5. **Output cap matters more than chunk size.** Qwen's replies run 1,200 to 2,700 tokens per 7,000-character chunk. With a 2,000-token cap and smaller chunks, three chunks were cut off and the score fell to 43%. A cap of 3,600 was fine. Any real integration should keep partial JSON from a truncated reply instead of throwing the chunk away.
6. **Not every model on Groq can do this.** `gpt-oss-safeguard-20b` is limited to 2,000 tokens a minute, so one chunk is refused outright (it is a safety-classification model anyway). `allam-2-7b` has a 4,096-token context and could not produce valid JSON on its one try. The rest of Groq's list is speech or prompt-guard models.

### Rate limits on this key (free tier: the 429s say "Upgrade to Dev Tier")

| Model | Per minute | Per day |
| --- | --- | --- |
| gpt-oss-120b, gpt-oss-20b, qwen3.8-27b | 8,000 tokens, 30 requests | 200,000 tokens, 1,000 requests |
| gpt-oss-safeguard-20b | 2,000 tokens, 3 requests | 200,000 tokens, 1,000 requests |
| qwen3.8-27b, as well | 1,000 **output** tokens a minute, only visible as a 429 | |
| allam-2-7b | 6,000 tokens | 7,000 requests |

- Only tokens per minute and requests per day come back in the headers. The per-day token limit, the per-minute request limit and Qwen's output limit are not in them.
- The app's current design, one request with the whole report, **cannot work on this key**: 9,800 tokens of report plus the prompt is over 8,000 tokens a minute. The harness reads the report in five chunks and waits for the token bucket to refill, which makes a read take 2.5 to 3.5 minutes (17 seconds of it in actual requests).
- A full read counts about 22,800 tokens against the daily limit (cached input is not counted), so **this key reads about 9 reports a day per model**. That is enough to test, not to run a beta on.
- Qwen's 1,000 output tokens a minute is the slowest part: its replies are longer than that per chunk, so Groq refused some requests and the harness waited and retried (2 to 4 refusals per full read, none fatal at the 3,600-token cap).
- Cached input (the repeated prompt and marker list) showed up in some gpt-oss runs, at half the input price, and does not count against the limits. It never showed up on Qwen.
- Groq's pay-as-you-go prices per million tokens, in and out: gpt-oss-20b $0.075 / $0.30, gpt-oss-120b $0.15 / $0.60, qwen3.8-27b $0.80 / $4.00. At list price, 1,000 reports would cost about $40 with Qwen, $3 with gpt-oss-20b and $8 with gpt-oss-120b. Developer-tier limits are higher, but the page I could read does not list them by tier, so the numbers are not here.

### What this does not show

- One report from one lab. The ranking could change on another layout, a scanned report or a short one.
- The on-device reader is the yardstick, and it is a set of rules. Its 69 results include calculated ratios some people would not call results; models that skip them lose recall without being wrong.
- Calls Groq refuses with 400 or 413 return no usage, so their tokens are not in the totals (they still came out of the minute's bucket).
- Each setting was tried once or twice. Two tuned variants were tried for the models that failed at the app's settings; this is not a full tuning study.
- "Summarising" was read as what the app can show: extracting results into the Bloodwork screen. The app deliberately gives no narrative interpretation (no diagnosis, no advice), so no model was asked for one.
- The model sees redacted text. The app's OpenRouter route is pinned to hosts that do not collect or train on prompts (`data_collection: deny`); the Groq request has no such field, and I did not check Groq's data-retention terms for this account. Settle that before any real report goes through it.

## Google Vertex AI (Gemini)

**Result, 14 Oct 2026: use `gemini-3.5-flash-lite` with every field of a row required in the response schema.** 43 runs on the real report, $1.88 at list price. The full report card (every model graded, cost, time, the Bloodwork screen compared marker by marker) is in [vertex-report-card.md](vertex-report-card.md). In short: it reads the whole report in 10 to 17 seconds for $0.013 to $0.022 and filled the Bloodwork screen exactly in 6 of 7 runs; every Gemini model that thinks by default ran out of the app's 16,384 output tokens and returned nothing; and the app's Gemini schema lets a model leave out the marker or a printed range limit, which cost 3.5 Flash-Lite a wrong "in range" on two out-of-range results in 3 of 10 runs and its markers entirely in 1.

The key is a service account's (`GOOGLE_SERVICE_ACCOUNT_JSON_B64`, plus `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`, set in the cloud environment). `scripts/vertex-bench.ts` signs a one-hour token with it in memory and never prints or writes either. It sends the app's own Gemini request (`buildGeminiRequest`: the same prompt, marker list, temperature 0 and response schema) to Vertex, and the app's own parser reads the reply, so a model that does well here is doing the app's job.

Unlike the Groq key there is no 8,000 tokens a minute to stay under, so by default the whole report goes in **one request with the app's 16,384-token output cap**, which is how the app sends it (Groq could not run that design at all). `--chunk-chars 7000` sends it in the same five chunks as the Groq runs to compare like for like.

### What the project can call

| Model | Called at | Standard price per million tokens (in / out / cached in) |
| --- | --- | --- |
| gemini-2.5-flash-lite | us-central1 | $0.10 / $0.40 / $0.01 |
| gemini-2.5-flash | us-central1 | $0.30 / $2.50 / $0.03 |
| gemini-2.5-pro | us-central1 | $1.25 / $10.00 / $0.125 |
| gemini-3.1-flash-lite | global | $0.25 / $1.50 / $0.025 |
| gemini-3.5-flash-lite | global | $0.30 / $2.50 / $0.03 |
| gemini-3-flash-preview | global | $0.50 / $3.00 / $0.05 (the Standard table prints no output price; $3.00 is what its Priority and Batch rows imply) |
| gemini-3.5-flash | global | $1.50 / $9.00 / $0.15 |
| gemini-3.8-flash | global | $1.50 / $7.50 / $0.15 (half price, $0.75 / $3.75, through 31 Dec 2026; costs here use the later price) |
| gemini-3.1-pro-preview | global | $2.00 / $12.00 / $0.20 |

Prices are from [Google's Vertex AI pricing page](https://cloud.google.com/vertex-ai/generative-ai/pricing), read on 14 Oct 2026, Standard tier, prompts up to 200,000 tokens. Output includes thinking. The 3.5 and later models cost 10% more when called through a region instead of `global`. `gemini-2.0-*` and `gemini-3-pro` are not available to this project; the 3.x models answer only on `global`.

### Data terms, from [Google's Vertex data governance page](https://cloud.google.com/vertex-ai/generative-ai/docs/data-governance) (read 14 Oct 2026, the terms on this account not checked)

- Google says it will not use the data to train or fine-tune any model without permission.
- Gemini caches inputs and outputs by default for up to 24 hours, scoped to the project and never used for training; caching can be turned off per project.
- Prompts may be logged for abuse monitoring unless the account asks for an exception, so "zero data retention" is not the default.
- The `global` endpoint can serve a request from any region. A regional endpoint keeps it in that region, but then only the 2.5 models are reachable.

This is a better answer than the one Groq's results left open, but it is still a decision for the owner before a real report goes through it.

### What a first check on a made-up report showed

A 22-result report written for the purpose (no real data) was sent to all nine models. It says nothing about which model reads a real report best; it shows how the settings behave:

- **Thinking left at its default is expensive and can break the answer.** `gemini-2.5-flash` spent 10,000 thinking tokens and `gemini-3.5-flash` 5,900 on a 22-line report; `gemini-3-flash-preview` used all 16,384 output tokens, 15,700 of them thinking, and was cut off before it finished its answer. `gemini-3.8-flash` also hit the cap, with about 14,700 tokens of answer for a 19-result report, and cost $0.13. The app's cap counts thinking, so a long real report with default thinking is likely to be truncated. The same lesson as on Groq: reasoning is the wrong tool for extraction.
- **With thinking set to `none` every model finished** (a budget of 0 or the `minimal` level, or the lowest the model allows: `gemini-2.5-pro` cannot switch it off and used its smallest budget, 78 tokens), in 1 to 23 seconds, except `gemini-3.1-pro-preview` at about 110 seconds.
- `gemini-3.8-flash` and the Pro models have no `minimal` level (Vertex answers 400); `none` means `low` for them.
- `gemini-2.5-pro` answered one request with 429 `RESOURCE_EXHAUSTED` on a shared quota and succeeded on the retry after 20 seconds.
- Output the model puts out beyond what the report holds is not penalised, as with Groq. Some small models stopped early (`gemini-3.1-flash-lite` with `none` returned 1 of 19).

### Run it

```
# the models and prices this lab knows
node scripts/vertex-bench.ts --models

# one report, one request each. Thinking off is the setting to compare; default shows what the model does left alone
NODE_USE_ENV_PROXY=1 node scripts/vertex-bench.ts report.txt --plan gemini-2.5-flash:none,gemini-3.5-flash:none,gemini-2.5-flash:default

# stop early if it costs more than expected (default $2 for one invocation)
NODE_USE_ENV_PROXY=1 node scripts/vertex-bench.ts report.txt --plan gemini-3.1-pro-preview:none --max-cost 0.5
```

A plan item is `model`, then `:thinking` (`none`, `default`, `low`, `medium`, `high`), then `@location` (defaults to where the model can be reached). The flags are `--require-all` (every field of a row required in the response schema), `--chunk-chars`, `--max-tokens`, `--repeats`, `--first N`, `--max-cost`, `--out`, `--ledger`, `--dry-run`. Runs go to the same ledger and `test-lab/local/` as Groq's, and show on `/ai-lab` with the Vertex price table.

## Run it

```
# 1. the redacted text that would be sent (nothing leaves the machine)
node scripts/report-text.ts report.pdf --name FirstName --name LastName > report.txt

# 2. what Groq lists
NODE_USE_ENV_PROXY=1 node scripts/groq-bench.ts --models

# 3. try a setting on the first chunk, then the whole report
NODE_USE_ENV_PROXY=1 node scripts/groq-bench.ts report.txt --plan qwen/qwen3.8-27b:default --first 1
NODE_USE_ENV_PROXY=1 node scripts/groq-bench.ts report.txt --plan qwen/qwen3.8-27b:default,openai/gpt-oss-20b:low

# 4. look at it
VITE_AI_LAB=1 npm run dev        # then open http://localhost:5173/ai-lab
```

A plan item is `model`, then `:effort` (`low`, `medium`, `high`, and for Qwen also `none` or `default`), then `@schema` or `@object` to choose strict JSON schema or plain JSON mode. Other flags: `--chunk-chars`, `--max-tokens`, `--repeats`, `--day-budget` (a self-set cap on tokens a model may use in 24 hours, from the ledger), `--first N`.

`NODE_USE_ENV_PROXY=1` is only needed in Claude's cloud session, where Node's fetch must be told to use the proxy that adds the key. Elsewhere set `GROQ_API_KEY` instead.

## The Vercel project "Intus AI testing"

The cloud session could not create it (Vercel answered 403 to project creation, though the GitHub connection is healthy). To make it by hand, in Vercel, **Add New, Project**, import `yuvrxxj/Intus`, and set:

| Setting | Value |
| --- | --- |
| Project name | `intus-ai-testing` |
| Framework, install, build, output | read from `vercel.json` (Vite, `npm ci`, `npm run build`, `dist`) |
| Settings, Git, Ignored Build Step | `test "$VERCEL_GIT_COMMIT_REF" = "main"` (exit 0 skips the build, so `main` is never built here) |
| Env `VITE_AI_LAB` | `1`, for Production and Preview |
| Env `VITE_SUPABASE_URL` | `https://intus-ai-testing.invalid`, for Production and Preview. The app defaults to the production database, so this points the test build at nothing |
| Env `VITE_SUPABASE_PUBLISHABLE_KEY` | `not-a-key`, for Production and Preview |
| Settings, Deployment Protection | Vercel Authentication on, for all deployments |

Then deploy `claude/kind-knuth-6u4sw5`. The page is at `/ai-lab`. Run files are not in git, so the Bloodwork section of that page is empty until a run file is opened with its button; the tables of limits and runs come from the committed ledger.
