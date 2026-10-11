# Intus sleep tracker: metrics specification and evidence

Prepared 2026-10-09 for the Intus sleep tracker (React, TypeScript, Supabase Postgres). Input data: manual entry now
(start and end times), Apple Health and Google Health Connect later (sessions, optional stage segments, several
overlapping sources per night). Product principle: no score you cannot check. Every number below is a quantity with a
written rule, never an opaque score.

## 0. How to read this document

Evidence tags used throughout:

| Tag | Meaning |
|---|---|
| [P] | Primary text (paper, official documentation, source code) was fetched and read in this session. Quoted numbers were checked against that text. |
| [S] | The number comes from an abstract or a search summary of the primary source. The citation is real, the full text was not read. Re-check before putting the number in the UI. |
| [D] | Design default chosen for Intus. No standard exists. The reasoning is stated. Change it with data. |
| [U] | Could not be verified. Listed again in section 8.6. |

Conventions: times are written 24 hour. "h:mm" for durations. Formulas are plain text. "Night" means one sleep
period keyed to the local date on which the person woke up (section 3). Where a source gives a range, the range is
copied as published. A hyphen between two numbers means "to".

The constraint that shapes most decisions: the app must be able to show, next to any number, the rule that produced it
and the input records it came from. That rules out blended or voted values that no single source ever reported
(section 4) and it rules out any composite 0 to 100 "sleep score".

---

## 1. Recommended sleep duration by age

### 1.1 What the three statements are, and what "may be appropriate" means

| Statement | Scope | Method | Citation |
|---|---|---|---|
| Watson et al. 2015, AASM and SRS | Adults 18 to 60 | 15 experts, modified RAND/UCLA Appropriateness Method, 5,314 articles, nine health categories, consensus meeting February 2015 [P] | [Sleep 2015;38(6):843-844](https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/), [doi:10.5665/sleep.4716](https://doi.org/10.5665/sleep.4716) |
| Paruthi et al. 2016, AASM | Children and teens, 4 months to 18 years (under 4 months excluded for "wide range of normal variation" and "insufficient evidence for associations with health outcomes") | 13 experts, modified RAND/UCLA, 864 articles, seven health categories, endorsed by the American Academy of Pediatrics, SRS and AAST [P] | [J Clin Sleep Med 2016;12(6):785-786](https://pmc.ncbi.nlm.nih.gov/articles/PMC4877308/), [doi:10.5664/jcsm.5866](https://doi.org/10.5664/jcsm.5866) |
| Hirshkowitz et al. 2015, National Sleep Foundation | Whole life span, nine age groups from newborn to 65+, healthy people without a sleep disorder | 18 panel members, RAND/UCLA, 1 to 9 appropriateness ratings, 3 categories [P, read from a PDF copy of the paper](https://www.nursesinaidscare.org/files/VAT%20pages/prevention-hiskwokwitz.pdf) | [Sleep Health 2015;1(1):40-43](https://doi.org/10.1016/j.sleh.2014.12.010) |

What the words mean. The NSF paper defines three classes from the panel's median rating on a 1 to 9 scale [P]:

- "Recommended" (the paper also says "appropriate"): panel median 7 to 9 with agreement (at least 80 percent of votes
  inside one 3 point band).
- "May be appropriate" (also "possibly acceptable", "may be appropriate for some people"): median 4 to 6, or any median
  with disagreement. The NSF text says these are "those hours that may be appropriate for some individuals". It is the
  RAND "uncertain" class, not a mild endorsement and not a warning.
- "Not recommended" (also "unlikely to be appropriate"): median 3 or lower. "Those hours that experts agree are not
  likely conducive for health and well-being".

NSF caveat, quoted from the paper [P]: "Sleep durations outside the recommended range may be appropriate, but
deviating far from the normal range is rare. Individuals who habitually sleep outside the normal range may be
exhibiting signs or symptoms of serious health problems or, if done volitionally, may be compromising their health
and well-being." The ranges are guidance for "healthy individuals and those not suffering from a sleep disorder".

AASM and SRS adult statement, quoted [P]: "Adults should sleep 7 or more hours per night on a regular basis to promote
optimal health." and "Sleeping more than 9 hours per night on a regular basis may be appropriate for young adults,
individuals recovering from sleep debt, and individuals with illnesses. For others, it is uncertain whether sleeping
more than 9 hours per night is associated with health risk." and "People concerned they are sleeping too little or
too much should consult their healthcare provider." Note the AASM adult statement has a floor (7) and no stated upper
limit; the NSF adult range is 7 to 9.

AASM pediatric statement: infants 4 to 12 months 12 to 16 hours per 24 hours including naps; 1 to 2 years 11 to 14
including naps; 3 to 5 years 10 to 13 including naps; 6 to 12 years 9 to 12; 13 to 18 years 8 to 10 [P]. For longer
than recommended it says "Regularly sleeping more than the recommended hours may be associated with adverse health
outcomes such as hypertension, diabetes, obesity, and mental health problems" [P].

### 1.2 Table by age band (suitable for a profile that stores age in whole years)

The profile table stores `age` as an integer number of years. Bands below 1 year cannot be selected from whole
years; see 1.3.

Hours of sleep per 24 hours (children up to 5 years, naps included) or per night (6 years and up). The NSF classes
are the only complete three-way classification across all ages, so Intus uses the NSF numbers for classification and
shows the AASM and SRS figure as a second line where it exists.

| Age band | NSF recommended | NSF may be appropriate | NSF not recommended | AASM and SRS statement (where it exists) |
|---|---|---|---|---|
| 0 to 3 months | 14 to 17 | 11 to 13 and 18 to 19 | under 11, over 19 | none ("insufficient evidence", [P]) |
| 4 to 11 months | 12 to 15 | 10 to 11 and 16 to 18 | under 10, over 18 | 12 to 16 (4 to 12 months, incl. naps) |
| 1 to 2 years | 11 to 14 | 9 to 10 and 15 to 16 | under 9, over 16 | 11 to 14 (incl. naps) |
| 3 to 5 years | 10 to 13 | 8 to 9 and 14 | under 8, over 14 | 10 to 13 (incl. naps) |
| 6 to 13 years | 9 to 11 | 7 to 8 and 12 | under 7, over 12 | 9 to 12 (AASM band is 6 to 12 years) |
| 14 to 17 years | 8 to 10 | 7 and 11 | under 7, over 11 | 8 to 10 (AASM band is 13 to 18 years) |
| 18 to 25 years | 7 to 9 | 6 and 10 to 11 | under 6, over 11 | 7 or more (AASM adult band is 18 to 60) |
| 26 to 64 years | 7 to 9 | 6 and 10 | under 6, over 10 | 7 or more (to age 60 only) |
| 65 years and over | 7 to 8 | 5 to 6 and 9 | under 5, over 9 | none (statement covers 18 to 60) |

Source for all NSF cells: [Hirshkowitz et al. 2015, table](https://doi.org/10.1016/j.sleh.2014.12.010), read from [the PDF copy](https://www.nursesinaidscare.org/files/VAT%20pages/prevention-hiskwokwitz.pdf) [P].
Source for the AASM column: sections 1.1 [P].

Overlaps and gaps to handle in code:

- Age 13: AASM pediatric says 8 to 10; NSF school-age (6 to 13) says 9 to 11. Rule: NSF governs the three-way class.
  Show the AASM line next to it. Do not average.
- Age 18: AASM pediatric band ends at 18 and the AASM adult band starts at 18. Rule: 18 and over is adult.
- Ages 61 to 64: the AASM adult statement stops at 60 (its panel studied 18 to 60). NSF 26 to 64 applies.
- Whole hours versus minutes. The NSF table is printed in whole hours and does not say how to class 8 h 40 min.
  Intus reads each row as four thresholds on a continuous scale [D] (this reading is consistent with every row
  of the table, it is Intus's interpretation, not the authors' wording):
  `notBelow` = the "not recommended: less than" number, `recLow`, `recHigh` = the recommended range, `notAbove` = the
  "not recommended: more than" number. Then, for a duration d in hours:
  d < notBelow is "not recommended"; notBelow <= d < recLow is "may be appropriate"; recLow <= d <= recHigh is
  "recommended"; recHigh < d <= notAbove is "may be appropriate"; d > notAbove is "not recommended".
  Example, adults 26 to 64 (notBelow 6, recLow 7, recHigh 9, notAbove 10): 5:59 is not recommended, 6:00 to 6:59 may
  be appropriate, 7:00 to 9:00 recommended, 9:01 to 10:00 may be appropriate, 10:01 and more not recommended.
  Check against the printed rows: "may be appropriate 6 and 10" for adults is exactly the two one hour bands next to
  the recommended range; the same holds for teens (7 and 11), older adults (5 to 6 and 9) and the child rows.
  The four thresholds per age row are in the constants table (8.4).
- Children under 6 are compared on the 24 hour total including naps (the statements say "per 24 hours (including
  naps)"). Adults and teens: compare the main night, and show the 24 hour total as a second number.

### 1.3 How the app maps a profile to a band

- Input: `age` (whole years). Output: the row above, as `{ lowHours, highHours, mayBeAppropriate: [[a,b],...],
  notRecommended: [...], aasm: {...} | null }`.
- Age under 1 cannot choose between the 0 to 3 months and 4 to 11 months rows. Either ask for date of birth or do not
  show a target band for age 0. The app targets adults, so this is an edge case, but the function must not guess.
- Age missing or outside 0 to 120: return null and draw no band. Never default to the adult band for a missing age.
- Show the band as a shaded range, not as a verdict. Text pattern: "Adults 26 to 64: 7 to 9 hours is the range the
  National Sleep Foundation panel recommends (Hirshkowitz 2015). 6 and 10 hours 'may be appropriate for some people'."

### 1.4 Evidence on long sleep, and what the app must not imply

Why "more is better" is wrong, with the strength of each statement:

| Claim | Evidence | Tag |
|---|---|---|
| The AASM and SRS panel did not set an upper limit for adults and said more than 9 hours "may be appropriate" for three groups and is uncertain for others. | Watson 2015 quote above. | [P] |
| The NSF panel rated more than 9 hours "not recommended" for 65+, more than 10 hours for 26 to 64, more than 11 hours for 14 to 25. | NSF table. | [P] |
| Long sleep is associated with higher all-cause mortality in cohort studies: pooled relative risk 1.30 (95% CI 1.22 to 1.38) for long versus medium sleep, 16 studies, 1,382,999 participants, follow-up 4 to 25 years; short sleep 1.12 (1.06 to 1.18). | [Cappuccio 2010, Sleep 33(5):585-592](https://wrap.warwick.ac.uk/5980/), [doi:10.1093/sleep/33.5.585](https://doi.org/10.1093/sleep/33.5.585) | [S] |
| Updated pooled estimate: long sleep and all-cause mortality risk ratio 1.39 (1.31 to 1.47) from 137 prospective cohorts, about 5.1 million participants; also incident diabetes 1.26, cardiovascular disease 1.25, stroke 1.46, coronary heart disease 1.24, obesity 1.08; no association with hypertension (1.01, 0.95 to 1.07). The authors call for tests of whether the link is causal. | [Jike et al. 2018, Sleep Med Rev](https://pubmed.ncbi.nlm.nih.gov/28890167/), [doi:10.1016/j.smrv.2017.08.002](https://doi.org/10.1016/j.smrv.2017.08.002) | [S] |
| Long sleep and type 2 diabetes incidence: pooled relative risk 1.48 (1.13 to 1.96), long sleep defined as more than 8 to 9 h; short sleep 1.28 (1.03 to 1.60). | [Cappuccio 2010, Diabetes Care 33(2):414-420](https://pmc.ncbi.nlm.nih.gov/articles/PMC2809295), [doi:10.2337/dc09-1124](https://doi.org/10.2337/dc09-1124) | [S] |
| Children: more than the recommended hours "may be associated with" hypertension, diabetes, obesity, mental health problems. | Paruthi 2016. | [P] |
| More REM or more of any stage is not "better": the NSF quality panel agreed that elevated REM (41 percent or more) does not indicate good sleep quality for young adults, adults and older adults, and wrote that this addresses "the misperception that more REM sleep is always better". | [Ohayon et al. 2017, Sleep Health 3(1):6-19](https://doi.org/10.1016/j.sleh.2016.11.006) | [P] |

Why these are associations, not a reason to fear long sleep: these are observational cohorts. Long sleep is
partly a marker of illness, depression, medication and low activity (reverse causation and confounding). The
Watson statement itself lists "individuals with illnesses" and "recovering from sleep debt" among those for whom
long sleep may be appropriate. Treat all long-sleep numbers as population-level association only.

Rules for the app [D]:

1. No colour, icon, streak or wording ranks a longer night above a shorter one. Above-range nights get the same
   neutral colour as below-range nights, with the plain label of the class: "Longer than the recommended range".
2. Never say "you need more sleep" or "catch up" from the app's own data. Say what the range is and where the night
   fell.
3. Persistent long sleep (more than 14 of the last 28 nights above the "not recommended" bound for the age) shows one
   neutral line: "You have slept longer than this range on most recent nights. This can be normal after illness or
   sleep debt. If you are concerned about sleeping too much or too little, the AASM and SRS statement suggests asking
   a healthcare provider." The threshold is a design default [D].
4. Do not add a "sleep debt" counter. The panels set no method for it; any formula would be invented.

---

## 2. Standard metrics: definitions, formulas, cut-offs, and what each needs

### 2.1 Five time points every metric is built from

All durations are differences of UTC instants (never of local clock strings, because of daylight saving time, section 3.5).

| Symbol | Name | Where it comes from |
|---|---|---|
| IB | in-bed start (got into bed or lights out) | manual "bedtime"; Apple `inBed` sample start; Oura `bedtime_start`; Fitbit `startTime`; Health Connect session `startTime` |
| SO | sleep onset (first minute asleep) | first asleep stage start; manual: IB + minutes-to-fall-asleep; if neither is known, SO = IB (and the night is flagged `bed_to_wake`) |
| FA | final awakening (last minute asleep) | end of last asleep stage; manual "wake time" |
| OB | out of bed | manual (default FA); `inBed` sample end; session `endTime` |
| awake segments | awake time between SO and FA | stage data only, or manual "minutes awake in the night" (a total, no positions) |

Apple documents exactly this layering. In HealthKit one sleep sample holds one value; "one set of samples tracks the
amount of time the user spent in bed", detailed samples (awake, core, deep, REM) "overlap the in-bed sample, but they
don't overlap each other", and "Samples recorded by Apple Watch only include awake samples that occur between two
sleep samples". Apple also lists the derived statistics apps can compute from these: "the amount of time it took for
the user to fall asleep, the percentage of sleep time spent in deep sleep, the number of times the user woke while
in bed, and the total amount of time spent both in bed and asleep"
([HKCategoryValueSleepAnalysis](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis)) [P].
Consequence: with Apple data, FA and SO can be missing at the edges of the in-bed sample ("there might not be any
detailed samples that correspond to the beginning or ending of an in-bed sample"), so the code must not assume
SO is the in-bed start.

### 2.2 Definitions

| Metric | Rule (plain text) | Notes, edge cases | Standard |
|---|---|---|---|
| Time in bed, TIB | OB - IB, minutes | OB < IB is invalid. If only start and end are known, TIB = end - start. | Consensus Sleep Diary: bedtime to out-of-bed ([Carney 2012, doi:10.5665/sleep.1642](https://pmc.ncbi.nlm.nih.gov/articles/PMC3250369/)) [S]. Oura `time_in_bed` "duration spent in bed in seconds" [P]. |
| Sleep period, SPT | FA - SO | Called "sleep duration" (SD = SE - SO) in the Munich ChronoType Questionnaire: onset to end, not reduced by awakenings. GGIR calls the same span the sleep period time window. | [mctq package docs, sdu()](https://github.com/ropensci/mctq/blob/main/R/sdu.R) [P]; [Open mHealth sleep-episode: "initial sleep onset time ... final awakening time"](https://github.com/openmhealth/schemas/blob/master/schema/omh/sleep-episode-1.0.json) [P] |
| Wake after sleep onset, WASO | sum of awake minutes strictly between SO and FA | Excludes the time before sleep onset and after final awakening. Fitbit: minutesAwake is "the total sum of 'wake' minutes only. It does not include before falling asleep or after waking up". | NSF: "amount of time, in minutes, spent awake after sleep has been initiated and before final awakening" ([Ohayon 2017](https://doi.org/10.1016/j.sleh.2016.11.006)) [P]; [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-log-by-date/) [P] |
| Total sleep time, TST | SPT - WASO, equivalently the sum of asleep minutes between SO and FA | Stage data: sum of light + deep + REM + unspecified-asleep. Start and end only: TST cannot be separated from SPT; set TST = SPT and flag `bed_to_wake`. | Fitbit and Google Health API `minutesAsleep`; Open mHealth `total_sleep_time` "total amount of time spent asleep within the effective time frame" [P] |
| Sleep onset latency, SOL | SO - IB | Needs a real "trying to sleep" start. Fitbit and Google Health API set `minutesToFallAsleep` to 0 for auto-detected logs ("no explicit intent to fall asleep was logged"). So a 0 from a wearable means "unknown", not "fell asleep instantly". Apple: derive from the in-bed sample start versus the first asleep sample. | NSF: "length of time ... it takes to transition from wake to sleep" [P]; [Google Health API sleep guide](https://developers.google.com/health/data-types/sleep) [P] |
| Number of awakenings | count of awake episodes with duration > 5 min between SO and FA | NSF uses "greater than 5 min". Vendors count shorter wake bouts (Fitbit `wake` count, Google `shortAwakenings` that "can overlap with surrounding sleep stages"). Do not mix them: label the number "awakenings over 5 minutes". Needs stage data or a manual count. | NSF: "Number of episodes, per night, in which an individual is awake for greater than 5 min" [P] |
| Terminal wakefulness | OB - FA | Time in bed after the last awakening. Reed and Sacco call it TASAFA. | [Reed and Sacco 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4751425/) [P] |
| Sleep efficiency, SE (default) | 100 * TST / TIB | Hide when TST = TIB by construction (start and end only): the value would read 100 percent and mean nothing. Reject SE > 100 as a data error. | NSF: "Ratio of total sleep time to time in bed" [P]; Fitbit and Google: `round((minutesAsleep / minutesInBed) * 100)` [P] |
| Sleep efficiency, alternative denominators | (a) 100 * TST / (SOL + TST + WASO + TASAFA) (Reed and Sacco "duration of the sleep episode", DSE). (b) 100 * TST / SPT (Open mHealth `sleep_maintenance_efficiency_percentage`). GGIR offers two metrics (time-in-bed denominator, or sleep period plus latency). | The denominator changes the answer. Reed and Sacco's worked example from the Consensus Sleep Diary: TST 300 min, TIB 545 min gives SE = 55 percent; DSE 470 min gives 64 percent. Never compare an SE computed with one denominator to a cut-off defined with another. | [Reed and Sacco 2016, doi:10.5664/jcsm.5498](https://doi.org/10.5664/jcsm.5498) [P]; [GGIR sleepefficiency.metric](https://github.com/wadpac/GGIR/blob/master/man/GGIR.Rd) [P] |
| Midpoint of sleep, MS | SO + SPT / 2 (equivalently (SO + FA) / 2) as a local clock time | MCTQ: MSL = SO + SD/2 with SD = SE - SO. With start and end only use (start + end) / 2 and label it "midpoint of bed to wake". Add 24 h arithmetic carefully (wrap at midnight, section 2.4). | [mctq msl()](https://github.com/ropensci/mctq/blob/main/R/msl.R) [P] |
| Bedtime and wake-time variability | SD of the clock time of IB (or SO), of FA, and of MS across nights, using the wrap rule in 2.4 | No agreed cut-off for "too variable". Report the SD in minutes with the number of nights. | [Fischer 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8503839/) [P] |
| Social jetlag, SJL | MSF - MSW, signed; absolute value reported | See 2.5. | [Wittmann 2006](https://doi.org/10.1080/07420520500545979); [Roenneberg 2012, doi:10.1016/j.cub.2012.03.038](https://doi.org/10.1016/j.cub.2012.03.038) |
| Sleep Regularity Index, SRI | -100 + 200 * (matching minute pairs / valid minute pairs) | See 2.6. | [Phillips 2017](https://doi.org/10.1038/s41598-017-03171-4) [P] |
| Naps | any sleep session not chosen as the night's main sleep | Count and total minutes per 24 h. NSF quality panel found no consensus on most nap variables; it rated a nap longer than 100 minutes as not indicating good sleep quality for young adults, adults and older adults. | [Ohayon 2017](https://doi.org/10.1016/j.sleh.2016.11.006) [P] |
| 24-hour sleep | main sleep TST + nap TST on the same wake date | Used for children under 6. The MCTQ shift version defines SD24 = SD + NapD. | [mctq sd24()](https://github.com/ropensci/mctq/blob/main/R/sdu.R) [P] |

### 2.3 Usual cut-offs (published, not scores)

From the NSF sleep quality panel (Ohayon et al. 2017: 18 panelists, 277 studies, three rounds of voting, "appropriate"
means median 7 to 9 with at least 80 percent agreement) [P]. These apply to otherwise healthy people. The panel did
not reach agreement for most sleep architecture and nap variables.

| Metric | Reads as good sleep quality | Reads as not good | Exceptions |
|---|---|---|---|
| Sleep efficiency | 85 percent or more, all ages ("85-94% or 95%+") | 74 percent or less (64 percent or less for young adults) | none |
| Sleep latency | 15 minutes or less; 16 to 30 minutes judged the same | over 60 minutes, all ages; 46 to 60 minutes except in older adults | older adults: 46 to 60 minutes not rated as poor |
| Awakenings over 5 min | 0 or 1; 2 also for older adults | 4 or more (more than 3 for teens) | |
| WASO | 20 minutes or less (preschoolers through older adults) | 51 minutes or more; 41 minutes or more for school-aged, young adults, adults | |
| REM share | 21 to 30 percent for adults | 41 percent or more for young adults, adults, older adults | |
| N3 ("deep") share | 16 to 20 percent for adults | 5 percent or less for teens, young adults, adults | |
| N1 share | 5 percent or less | 20 percent or more (toddlers to adults) | |

Display rule [D]: show the cut-off as a thin reference line or a plain sentence ("NSF panel: 85 percent or more is
good sleep continuity"), with the number, the age group and the citation one tap away. Do not turn the cut-off into
a green or red state, and do not combine metrics into one rating. The panel itself noted that "4 or more
awakenings of 5 minutes or more (20 minutes total)" and "41 minutes or more of WASO" are not fully consistent,
which is a reason to show them as separate facts.

Where "85 percent" is also used: sleep restriction therapy in CBT-I uses efficiency thresholds near 85 percent to
decide whether to change time in bed. I did not fetch a primary source for the exact protocol thresholds [U]. Intus
should cite only the NSF panel.

### 2.4 Midpoints, clock times and variability: the wrap rule

Clock times wrap at midnight, so the arithmetic mean and SD of 23:30 and 00:30 are wrong (12:00 and 12 h). The
MCTQ authors compute social jetlag as MSF - MSW and the rOpenSci mctq package documents why that is fragile: two clock
times on a two day timeline have a short and a long interval, and the sign of SJL comes from the order on the
timeline. The package default is the "shorter interval" method; "difference" (the plain linear subtraction) is
"not recommended" there ([mctq vignette: the social jetlag computation](https://github.com/ropensci/mctq/blob/main/vignettes/sjl-computation.Rmd)) [P].

Intus rule [D] (simple to explain and to test):

```
circularMeanMinutes(xs):   // xs = clock times in minutes after local midnight, any real number
  k = 2*pi/1440
  c = mean(cos(k*x)), s = mean(sin(k*x))
  if c == 0 and s == 0: return null            // times spread evenly around the clock, no meaningful mean
  return (atan2(s, c) / k) mod 1440

wrapDiff(x, m):            // signed shortest distance from m to x, in [-720, +720)
  d = ((x - m) mod 1440 + 1440) mod 1440
  return d >= 720 ? d - 1440 : d

anchoredSd(xs):            // "SD of clock times"
  if len(xs) < 2: return null
  m  = circularMeanMinutes(xs)
  ds = xs.map(x => wrapDiff(x, m))
  mu = mean(ds)
  return sqrt( sum((d - mu)^2) / (len(xs) - 1) )
```

Check [prototype run, 2026-10-09]: bedtimes 23:00, 23:30, 22:45 and 00:15 give anchoredSd = 39.7 minutes, where the
naive SD over minutes-after-midnight would be about 685.

This is the same idea as the mctq "shorter interval" and as the circular standard deviation for small spreads. It
fails (returns a meaningless number) when a person's times are spread over most of the clock. That is the
shift-worker case: show SRI instead (section 2.6) and say why.

Typical size of ordinary variation, so the app does not call normal variation "irregular": in a pooled analysis of
eight datasets of healthy sleepers (2,404 people, 26,121 nights) the within-person standard deviation of nightly
sleep duration was 85.8 minutes by diary, 77.4 by actigraphy and 67.0 by EEG, a coefficient of variation near 19
percent ([Messman et al. 2022, J Sleep Res, doi:10.1111/jsr.13680](https://doi.org/10.1111/jsr.13680)) [S].
A company-affiliated 2026 paper argues that reliably measuring variability takes 41 to 65 consecutive nights [S, not
independently verified, treat with caution]. So show the SD with its number of nights, call fewer than 14 nights
"rough", and never derive a state ("irregular") from it.

### 2.5 Social jetlag (Roenneberg et al.)

Definition. Social jetlag is the difference between the midpoint of sleep on free days and on work days. The term was
introduced by Wittmann, Dinich, Merrow and Roenneberg ([Chronobiol Int 2006;23(1-2):497-509](https://doi.org/10.1080/07420520500545979)); the
formula used since is from the MCTQ guidelines used in [Roenneberg et al. 2012, Curr Biol 22:939-943](https://doi.org/10.1016/j.cub.2012.03.038), whose conclusion
reads "Beyond sleep duration, social jet lag is associated with increased body mass index" (association) [S].
Formulas as implemented and documented in the peer-reviewed rOpenSci [mctq](https://github.com/ropensci/mctq) package
(Apache-2.0) [P]:

```
SO = SPrep + SLat            // local time the person tried to sleep + minutes to fall asleep
SD = SE - SO                 // sleep end minus sleep onset
MS = SO + SD / 2             // midpoint of sleep, local clock time
MSW = MS on work days        MSF = MS on work-free days
SJLrel = MSF - MSW           // signed; positive when free-day sleep is later
SJL    = abs(MSF - MSW)
SDweek = (SDW * WD + SDF * FD) / 7     // WD work days per week, FD = 7 - WD
MSFsc  = MSF                           if SDF <= SDW
       = MSF - (SDF - SDweek) / 2      otherwise      // chronotype proxy, "sleep-corrected"
MSFsc is not computed if the person uses an alarm clock on free days.
```

Prototype check (2026-10-09): free-day onset 00:30, SDF 9 h, SDW 7 h, 5 work days: MSF 05:00, SDweek 7 h 34, MSFsc
04:17; with MSW 03:00, SJL = 2 h 00 (free days later).

Which nights are "work" and which are "free" in Intus: Intus keys a night to the date of waking (section 3). A night
whose wake date is a work day is a work-day night (the alarm is for work). Default rule [D]: wake dates Monday to
Friday are work days, Saturday and Sunday are free days; the profile gets a "work days" setting (set of weekdays)
and an optional "days off" list. Ask once: "Do you wake without an alarm on free days?" and compute MSFsc only on
"yes".

Minimum data [D]: at least 4 work-day nights and 2 free-day nights in the last 28 days, otherwise "not enough nights
yet". The MCTQ is a questionnaire about typical days and has no published nightly-diary minimum that I could
verify [U].

Cut-offs: none is standard. Roenneberg-type papers report SJL in hours and associate it with outcomes; popular
statements such as "69 percent of people have at least one hour of social jetlag" come from internet cohorts
(Wittmann 2006 and Roenneberg and Merrow 2007 as cited in later work) and were not verified in the primary text [U].
The app shows hours and minutes and the direction ("free-day sleep is 1 h 20 min later"), and does not label ranges.

Shift workers: the MCTQ has a shift version where MSW, MSF and SJL are computed per shift type
("the computation ... must be applied to each shift section") [P]. Without declared shift types, do not compute SJL
or MSFsc; show SRI and duration only.

### 2.6 Sleep Regularity Index (Phillips et al. 2017)

Source: Phillips AJK, Clerx WM, O'Brien CS, Sano A, Barger LK, Picard RW, Lockley SW, Klerman EB, Czeisler CA.
Irregular sleep/wake patterns are associated with poorer academic performance and delayed circadian and sleep/wake
timing. Sci Rep 2017;7:3216. [doi:10.1038/s41598-017-03171-4](https://doi.org/10.1038/s41598-017-03171-4) [P, read in the Harvard DASH copy].

Definition (Phillips): "the percentage probability of an individual being in the same state (asleep vs. awake) at any
two time-points 24 h apart, averaged across the study", scaled so that "an individual who sleeps and wakes at exactly
the same times each day scores 100, whereas an individual who sleeps and wakes at random scores 0". It "does not
require designation of a main daily sleep episode", so naps and all-nighters are counted [P].

Exact formula. In Phillips' Methods: x is the likelihood that two time-points (minute by minute) 24 h apart are in
the same state, 0 to 1, "rescaled (y = 200 (x - 1/2)) to give a range of -100 to 100". The closed form
(Fischer, Klerman and Phillips 2021, equation 5) [P]:

```
SRI = -100 + ( 200 / (M * (N - 1)) ) * SUM_{j=1..M} SUM_{i=1..N-1} delta( s(i,j), s(i+1,j) )
  N = number of days, M = epochs per day, s(i,j) = 1 asleep or 0 awake at epoch j of day i
  delta(a,b) = 1 if a equals b, else 0
With missing data (Phillips): only pairs where both epochs are non-missing are used:
  SRI = -100 + 200 * (matching valid pairs / valid pairs)  =  100 - 200 * (mismatching fraction)
```

Check: a schedule that is two hours later on alternate days (both bedtime and wake time) mismatches 4 h of every 24 h
(16.7 percent), so SRI = 100 - 200 * 0.1667 = 66.7. The prototype run returns 66.67. A schedule that is 3 h later
on Saturday and Sunday gives 86.4 over two weeks.

Epoch and data requirements:

- Phillips: minute by minute, from sleep diaries (26 to 36 days, mean 30.7), "Only pairs of non-missing time-points
  were used", and for the final analysis "the longest interval of a whole number of weeks with no missing data to
  avoid day-of-week bias" (1, 2, 3 or 4 weeks in the 61 students) [P]. Students' SRI: 38 to 86, mean 73, SD 11
  (that is a description of 61 undergraduates, not a norm).
- GGIR ([CalcSleepRegularityIndex.R](https://github.com/wadpac/GGIR/blob/master/R/CalcSleepRegularityIndex.R), Apache-2.0) [P]: 30 second epochs
  (M = 2880), per day pair `-100 + 200/(M - skipped) * matches`, skipping epochs that are missing in either day,
  and shortens 23 or 25 hour days to compare equal counts.
- sleepreg (Windred 2021, [dpwindred/sleepreg](https://github.com/dpwindred/sleepreg), LGPL) [P]: `SRI = -100 + 200 * (1 - mean(abs(state_shifted_24h - state)))`,
  `minSRIdays = 5` ("minimum number of days of overlapping data to calculate valid SRI scores"), `exclNAhrs = 6`
  (a noon-to-noon day with more than 6 hours of missing data is excluded). Daylight-saving transitions create repeated
  or non-ordered timestamps and the package stops on them.
- Fischer 2021: SRI "is independent of study length" in simulation, but its confidence intervals are on average 39
  percent wider than those of interdaily stability for 7 days or fewer, 20 percent for 8 to 14 days and 14 percent for
  more than 14 days. The SRI "makes no assumptions about the structure of sleep" while SD and composite phase
  deviation "require only knowledge of the onset and offset timing of the main sleep episode" [P].
- Software choice matters: a 2025 comparison of the two open-source calculators in more than 70,000 UK Biobank adults
  found "only two-fifths" were in the same SRI quintile and proposed a 14-item reporting checklist (RIRI) including
  epoch length, day anchoring, sleep and wake definitions, missing data and outliers
  ([Czeisler et al. 2025, Sleep, doi:10.1093/sleep/zsaf299](https://academic.oup.com/sleep/article-abstract/49/4/zsaf299/8265987)) [S]. Therefore Intus must publish its own parameter set
  (below) and show it with the value.

Intus SRI specification [D, built from the sources above]:

| Parameter | Value | Reason |
|---|---|---|
| Epoch | 1 minute | Phillips' resolution; matches the precision of manual entry and of Apple and Health Connect timestamps |
| Day | local civil day, 00:00 to 24:00 on the wall clock of the zone where the person was | matches Phillips (diary clock time) |
| State | asleep = inside an asleep interval of the chosen record(s); with stage data awake segments inside a session are awake; with start and end only the whole session is asleep | the only information available |
| Unlogged time | a civil day is "observed" only if both the night that ends on it and the night that ends on the next day are logged (or the person marked the day "no data"); minutes of unobserved days are missing, never awake | an empty day is not evidence of being awake |
| Naps | included as asleep | SRI definition |
| Pairing | minute m of day D with minute m of day D+1 on the wall clock; both must be observed | Phillips "24 h apart" |
| DST | wall-clock minutes. Nonexistent minutes (spring forward) are missing. Repeated minutes (fall back): first occurrence wins | keeps 1440 comparable minutes per day; Phillips reports DST versus universal-time differences "negligible" |
| Travel | days on which the zone offset differs from the previous day (excluding DST jumps within one IANA zone) are excluded from SRI by default | wall-clock regularity across a time-zone change is not the same thing as regularity of the body clock |
| Minimum | 5 valid day pairs (sleepreg default) inside the last 28 days, and at least 12 hours of valid minutes in each pair | `minSRIdays = 5`, `exclNAhrs = 6` (noon to noon) |
| Window | last 28 days (4 whole weeks, balanced for weekday) | Phillips: whole weeks |
| Output | SRI to one decimal, the number of valid day pairs, the fraction of valid minutes, the parameter set id | RIRI-style disclosure |

Rule shown in the UI: "SRI 78. On 22 of 27 day pairs, with 94 percent of minutes available, you were in the same
state (asleep or awake) at the same clock time as 24 hours earlier on 89 percent of minutes. SRI = 200 x 0.89 - 100."
(Numbers are an illustration of the sentence, not data.)

Simpler alternatives and what they ignore: SD of bedtime, SD of wake time and SD of midpoint need only the main
sleep's two times and are the right choice for manual entry; they ignore naps and awake periods inside the night and
wrap at midnight. Phillips found SRI correlated -0.66 with the SD of sleep onset time, -0.62 with SD of wake time and
-0.62 with SD of mid-sleep time in the 61 students [P], so for ordinary single-block sleepers they carry similar
information. Composite phase deviation (CPD) and interdaily stability (IS) need either two-point daily data
or hourly activity data; do not implement them.

### 2.7 What can be computed from which data

| Metric | Start and end only (manual) | Start, end + optional diary fields (minutes to fall asleep, minutes awake) | Stage or awake segments, or in-bed + asleep samples |
|---|---|---|---|
| Time in bed | yes (end - start) | yes | yes |
| Sleep period, midpoint of sleep | yes (as bed-to-wake) | yes | yes (true onset to final awakening) |
| Total sleep time | no, equals SPT; label "bed to wake" | yes: SPT - minutes awake | yes |
| Sleep efficiency | no (would read 100 percent) | yes, but depends on a self-estimate | yes |
| Sleep onset latency | no | yes (self-reported) | only if an in-bed start is separate from the first asleep sample |
| WASO, number of awakenings over 5 min | no | WASO total only; no count unless asked | yes |
| Stage shares (light, deep, REM) | no | no | yes, labelled as device estimates (section 6) |
| Bedtime, wake time and midpoint variability (SD) | yes | yes | yes |
| Social jetlag, MSF, MSW | yes | yes | yes |
| SRI | approximately (whole session = asleep) | approximately | yes, better |
| Naps and 24 h total | yes (as extra sessions) | yes | yes |

---

## 3. Assigning sessions to nights, and the edge cases

### 3.1 What each platform documents

| Platform | Which date a session belongs to | Main sleep versus nap | Time zone | Source |
|---|---|---|---|---|
| Apple HealthKit | No date field. A sample has a start, an end and one value (`inBed`, `asleepUnspecified`, `awake`, `asleepCore`, `asleepDeep`, `asleepREM`; `asleep` was deprecated in iOS 16 and renamed `asleepUnspecified`). The Health app's own day assignment is not in the HealthKit documentation [U]. | No nap flag. Overlapping samples are allowed; "samples with different values may have overlapping time intervals". Apple Watch minimum sleep length for automatic tracking: not documented by Apple in anything I could fetch [U]; a third-party guide says one hour. | Apple: "For best results when analyzing sleep samples, it's recommended that you use [`HKMetadataKeyTimeZone`] to store time zone metadata" | [HKCategoryValueSleepAnalysis](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis), [sleepAnalysis](https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier/sleepanalysis), [HKCategorySample](https://developer.apple.com/documentation/healthkit/hkcategorysample) [P] |
| Android Health Connect | No date field. `SleepSessionRecord(startTime, startZoneOffset, endTime, endZoneOffset, metadata, title, notes, stages)`. Aggregate metric `SLEEP_DURATION_TOTAL`. How a per-day aggregate assigns a session that crosses midnight is not documented [U]. | "a sleep session data type, to store information about a user's sleep, such as a nightly session or daytime nap". No flag. Stages: unknown 0, awake 1, sleeping 2, out of bed 3, light 4, deep 5, REM 6, awake in bed 7. Stages "should fall within the sleep session interval ... don't need to be continuous but shouldn't overlap". | per-record start and end zone offsets | [SleepSessionRecord](https://developer.android.com/reference/androidx/health/connect/client/records/SleepSessionRecord), [Track sleep sessions](https://developer.android.com/health-and-fitness/health-connect/features/sleep-sessions) [P] |
| Fitbit Web API (legacy) | `dateOfSleep` = "The date the sleep log ended". "Requesting a sleep log for a given date ... may return a log entry that began the previous night." | `isMainSleep` boolean; the rule is not documented. A Fitbit staff reply in the developer forum says the longest log of the day gets `isMainSleep = true` [S]. `infoCode` 2 = "Sleep period was too short (less than 3 hours)". Logs are `auto_detected` or `manual`. Automatic detection starts after about an hour without movement (help text, via search) [S]. | not stated in the field list I read [U] | [Get Sleep Log by Date](https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-log-by-date/) [P]. Support for this API ends 2026-09-30 and it is turned off 2026-10-30 per [Google's notice](https://developers.google.com/health/migration) [P]. |
| Google Health API (Fitbit's replacement) | A `Sleep` session with `interval` start and end plus `startUtcOffset` and `endUtcOffset`; list/filter by civil end time (example in the guide filters on `sleep.interval.civil_end_time`) [S]. | "a discrete sleep event, such as a single nightly sleep or a daytime nap". "Use the `reconcile` operation to ensure that overlapping sleep logs from different devices (for example, a wearable and a mattress sensor) are merged into a single 'main' sleep record." Stages LIGHT, DEEP, REM, AWAKE are non-overlapping; `shortAwakenings` may overlap. | per-interval UTC offsets | [Sleep guide](https://developers.google.com/health/data-types/sleep) [P] |
| Oura Cloud API v2 | `day` = "Day that the sleep belongs to". Oura's support article says the Sleep Day runs 6 pm to 6 pm and the longest continuous sleep within it gives the Sleep Score for that calendar day (activity day is 4 am to 4 am, calendar day midnight to midnight) [S]. | `type`: `long_sleep` = "sleep that is long enough (>3h) to automatically contribute to daily scores"; `sleep` = "user confirmed sleep / nap, min 15 minutes, max 3 hours"; `late_nap` = "user confirmed sleep / nap, min 15 minutes, ended after sleep day change (6 pm), contributes to next days daily scores"; `rest` = "falsely detected sleep / nap, rejected in confirm prompt by user"; `deleted`. "A user can have multiple sleep periods per day." Also `sleep_algorithm_version`. | `bedtime_start` and `bedtime_end` are localized date-times | [API docs](https://cloud.ouraring.com/v2/docs), [type definitions in a generated SDK](https://github.com/spxrogers/oura-toolkit/blob/main/sdks/typescript/api/src/models/PublicSleepType.ts), [OpenAPI copy](https://github.com/api-evangelist/oura-ring/blob/main/openapi/oura-ring-sleep-routes-api-openapi.yml), [Oura partner support](https://partnersupport.ouraring.com/hc/en-us/articles/29160913203219-Understanding-the-Different-Types-of-Oura-Days-in-Oura-API-Data) [P for the enum text, S for the support article] |

Summary of vendor behaviour: the closest thing to a common rule is "the day you wake up" (Fitbit `dateOfSleep` is the
end date; Oura's `day` is the date the Sleep Day is scored for; Apple and Health Connect do not store a date at all).
Do not copy a vendor's date. Recompute from instants (3.2) so that sessions from different sources land on the same key.

### 3.2 Intus rules

**Stored fields per session** (all in UTC, plus offsets so that local clock times can be rebuilt):

| Field | Type | Note |
|---|---|---|
| `start_utc`, `end_utc` | timestamptz | instants; `end_utc > start_utc` |
| `start_offset_min`, `end_offset_min` | smallint | minutes east of UTC at that instant; Health Connect and Google Health API provide these; Apple provides an IANA name in `HKTimeZone` metadata which must be converted |
| `tz_id` | text, nullable | IANA zone name, used to resolve offsets inside a session that crosses a DST change |
| `source_id`, `source_kind`, `external_id`, `recorded_at`, `recording_method` | | provenance (section 4) |
| `vendor_type`, `vendor_day`, `algorithm_version` | nullable | kept for display and debugging only; never used for keys |

**Night key.** The key is the local calendar date on which the person woke:

```
nightKey(session, cutoffHour = 24):
  // cutoffHour is the hour of the local day at which the "sleep day" rolls over.
  // 24 (default) = midnight, like Fitbit dateOfSleep and the usual reading of Apple Health.
  // Oura's sleep day is 18.
  localEndMs = session.endUtcMs + session.endOffsetMin * 60000
  shifted    = localEndMs + (24 - cutoffHour) * 3600000
  return isoDate(new Date(shifted).toISOString())      // the UTC calendar date of the shifted value
```

Use the offset at the end instant: a flight across zones during sleep is keyed to where the person woke. The
function must not depend on the device's current zone or the viewer's browser zone.

**One main sleep per key.** Among sessions with the same key (after the within-source merge in 3.4), the main sleep is
the session with the most asleep minutes; ties go to the later end, then the lower `source_rank`. Every other
session on that key is "additional": a nap if its asleep time is at most 180 minutes, otherwise "second sleep".
Reasons [D from vendor rules]: Fitbit gives the main flag to the longest log of the day [S]; Oura separates sleep
at 3 hours [P]; Fitbit marks logs under 3 hours "too short" [P]. A rule based on clock time (for example "naps
start after 09:00") fails for night-shift workers, so the rule uses duration only.

If the best session for a key is shorter than 180 minutes it is still the main sleep, flagged `short_main`; the
night is never left empty just because it is short.

**Night total versus 24 hour total.** `mainTst` is the main sleep's TST. `totalTst24h` adds the key's additional
sessions. Adults: compare `mainTst` to the age band (Watson 2015 says "per night"). Children under 6: compare
`totalTst24h` (Paruthi 2016 says "per 24 hours (including naps)").

**Minimum session length.** Sessions under 15 minutes are ignored on import and rejected in manual entry [D from
Oura's 15 minute minimum and GGIR's 15 minute nap example (`possible_nap_dur = c(15, 240)`, [GGIR.Rd](https://github.com/wadpac/GGIR/blob/master/man/GGIR.Rd)) [P]].

**No record is not zero sleep.** A key with no session has no value. Charts show a gap. Averages exclude it.
Offer an explicit "I did not sleep" marker (a record with `kind = 'no_sleep'`): it counts as an observed night with 0
minutes for averages and as an all-awake night for SRI. All-nighters change SRI differently from SD-type metrics
(Fischer 2021) [P], so the marker matters.

### 3.3 Midnight crossings

Everything is computed on instants, so a 23:00 to 07:00 session is just 8 hours with start date D-1 and key D. UI label:
"Night ending Fri 9 Oct" with a subline "11:00 pm Thu to 7:00 am Fri". Avoid "Oct 8" or "Oct 9" alone, which different
people read differently. A session that ends exactly at 00:00 has key D (the date of the instant 00:00 local), which
makes a 16:00 to 24:00 sleep belong to the next date; this follows the Fitbit "ended" rule and is acceptable. Shift
workers can change `cutoffHour` (3.6).

### 3.4 Split sleep (two blocks in one night)

Gap rule [D, from GGIR and the NSF definitions]:

- Within one source, merge two consecutive sessions into one when the gap between the first session's last asleep
  minute and the next session's first asleep minute is at most 60 minutes (`MERGE_GAP_MIN = 60`).
  GGIR merges resting blocks into one sleep period window when "the maximum size in minutes of a gap between
  resting blocks" is at most `spt_max_gap_dur = 60` (and a block must be at least `spt_min_block_dur = 30`) [P].
- The merged session spans first start to last end. Its TST is the sum of asleep minutes. The gap counts as WASO
  (and as an awakening if it exceeds 5 minutes). TIB spans the whole merged block. This is consistent with Reed and
  Sacco, who argue that time awake or out of bed during the night belongs in the denominator because it is part of
  the same sleep episode [P].
- Gaps over 60 minutes make separate sessions: the longer is main, the other is additional (3.2).
- A larger value is a legitimate alternative: SparkyFitness uses 4 hours as the break between sessions
  ([source](https://github.com/CodeWithCJ/SparkyFitness/blob/main/SparkyFitnessMobile/src/services/healthkit/dataAggregation.ts), `SESSION_GAP_THRESHOLD_MS`; the project license is non-commercial, so use it
  only as evidence of what another app chose, never copy the code) [P]. Expose `mergeGapMinutes` as a setting with
  range 30 to 240 so people with biphasic sleep can choose.
- Fitbit's and Apple's own splitting rules are not documented. Users report splits after waking for 15 to 45 minutes
  [S, forum posts, not authoritative]. Do not infer a rule from those.
- Never merge across sources. Two sources covering the same period are duplicates, not blocks (section 4).

### 3.5 Time zones, daylight saving time, and travel

Rules:

1. Durations: always `end_utc - start_utc`. Never subtract two local clock strings. On the night daylight saving time
   ends, 23:00 to 07:00 on the wall clock is 9 hours; on the night it starts it is 7 hours. Prototype run: a person
   in America/New_York with a constant 23:00 to 07:00 wall-clock schedule has a session length of 9 h on the night of
   2026-10-31 to 2026-11-01 and an SRI of 100.0 over the week with the wall-clock mapping in 2.6.
2. Local clock times (bedtime, midpoint, SJL, SRI) use the offset at the instant they describe. Midpoint:
   `midUtc = (soUtc + faUtc) / 2`, then `localMid = midUtc + offsetAt(midUtc)`. Where start and end offsets
   differ and `tz_id` is unknown, use the end offset and set `tz_uncertain`.
3. Imports without offsets use the profile's time zone for that date, flagged `tz_assumed`. Apple recommends
   writing `HKMetadataKeyTimeZone` for sleep ([doc](https://developer.apple.com/documentation/healthkit/hkmetadatakeytimezone)); Health Connect and the Google Health
   API carry offsets [P]. Manual entry: the form uses the device's current zone and stores the offset it used, with
   a visible "time zone" chip that the person can change.
4. Upcoming transitions to test against: Europe (EU rules, last Sunday of October) 2026-10-25; United States
   (first Sunday of November) 2026-11-01; United States spring forward 2026-03-08 (already passed). Dates computed
   from the rules; checked against the Node.js `Intl` time zone database in the prototype for New York, London and Berlin.
5. Travel versus daylight saving time: a change of offset within the same `tz_id` is daylight saving time. A change of
   `tz_id` or an offset change not explained by the zone's rules is travel. Travel nights are flagged `travel`. By
   default they are excluded from SRI, SJL and the variability SDs, and still count in duration averages. A setting
   lets the person include them.
6. For travellers the app can also show a second view in the home time zone; this is optional. Do not mix the two in
   one chart.

### 3.6 Shift workers

- The night key is still the wake date; the nap/main rule uses duration, not time of day, so a daytime main sleep
  after a night shift is main.
- If two long sleeps end on the same date (for example an anchor sleep and a pre-shift sleep), the longer is main,
  the other is additional. Offer `cutoffHour` in the profile (default 24; Oura uses 18): a session that ends at or
  after that local hour is keyed to the next date. Use it only when two long sleeps keep landing on one date; for a
  sleep that ends in the evening before a night shift the default is usually right.
- Do not compute SJL or MSFsc unless the person declares shift types (MCTQ-shift needs per-shift work and free
  days) [P]. Compute duration, midpoint (shown without a verdict) and SRI, which "does not require designation of a
  main daily sleep episode" and is designed for irregular schedules [P].
- Do not apply the circular-SD rule (2.4) when the circular mean resultant length is below about 0.3 (times
  spread around the clock); show "times too spread to summarise" and show SRI.

---

## 4. Merging overlapping records from several sources

### 4.1 The options, with one worked night

Same night, three sources (invented numbers, computed in the prototype):

- Watch with stages: asleep 23:10 to 06:40 minus two awake bouts (01:40 to 01:55 and 04:20 to 04:30): 425 min (7:05).
- Phone app, no stages: asleep 22:30 to 07:10: 520 min (8:40).
- Manual entry: 23:15 to 07:00: 465 min (7:45).

| Method | How it works | Result for the night | Verdict |
|---|---|---|---|
| Sum of records | add every record | 1,410 min (23:30) | Wrong. The classic double count; also what happens when Apple `inBed` and `asleep` samples are both summed. |
| Union of intervals | minute is asleep if any source says asleep | 520 min (8:40) | Equals the most generous source. Always at least as large as every source, and no source ever reported that number, so the person cannot check it. Inflates when one source over-reports. |
| Take the longest | use the source with the most asleep minutes | 520 min (8:40) | Simple and checkable, but systematically biased high, because the sources that over-report win every night, and the winner changes from night to night. |
| Per-minute majority vote | minute is asleep if at least 2 of 3 sources agree | 470 min (7:50) | A number none of the three sources reported. Needs at least 3 independent sources; with 2 every disagreement is a tie. Watch and a phone app are often not independent (an app may re-export the watch's data). Stage labels are not comparable across vendors. Hardest to explain. |
| Intersection | asleep only if all agree | 420 min (7:00) | Biased low. |
| Pick one source by priority (per night) | one source's own numbers | 425 (watch first), 465 (manual first), 520 (phone first) | Checkable: the number equals what that source shows. Stable over time. Requires a priority list. This is what the platforms do (4.2). |

Recommendation: priority per night with a coverage floor, manual entry first, detailed in 4.5.

### 4.2 What Apple Health and Health Connect do themselves

- Apple HealthKit stores every sample from every source and does not merge sleep for you. Statistics queries "calculate common
  statistics over the set of matching samples" but "You can use statistics queries with quantity samples only", and
  sleep is a category type ([HKStatisticsQuery](https://developer.apple.com/documentation/healthkit/hkstatisticsquery)) [P]. So an app reading sleep from HealthKit
  must de-duplicate itself.
- The Health app uses a user-ordered source list per data type. Apple's default order: "1. Health data that you enter
  manually. 2. Data from your iPhone, iPad, and Apple Watch. 3. Data from apps and Bluetooth devices." and "If multiple
  sources contribute the same data type, the data source at the top will take priority over others. New apps or
  devices that you add are listed at the top automatically, above your iPhone or iPad."
  ([Apple Support: Manage Health data](https://support.apple.com/en-us/108779)) [P]. How Health trims or splits partially overlapping sleep samples
  is not documented by Apple; an unofficial Apple Developer Forums reply (thread 842919, which I could not open
  because of bot verification) is said to describe: higher-priority source wins, later-written sample wins within one
  source, specific stages beat unspecified, lower-priority samples may be truncated or split [U].
- Health Connect: "Only the Activity and Sleep data types are deduped by Health Connect" in the Aggregate API: "the
  Aggregate API accounts for any duplicate data and keeps only the data from the app with the highest priority", where
  "End users can set priority for the Sleep and Activity apps that they have integrated"; apps may "build your own
  logic to calculate the data separately for each app" and can filter by data origin
  ([Aggregate data](https://developer.android.com/health-and-fitness/health-connect/aggregate-data)) [P]. Records also carry a recording method
  (`RECORDING_METHOD_MANUAL_ENTRY`, `AUTOMATICALLY_RECORDED`, `ACTIVELY_RECORDED`, `UNKNOWN`) and a device type (watch,
  phone, ring, band, ...) ([Metadata](https://developer.android.com/health-and-fitness/health-connect/metadata)) [P]. The raw records are never merged.
- Google Health API (Fitbit's successor): `reconcile` "ensure[s] that overlapping sleep logs from different devices
  (for example, a wearable and a mattress sensor) are merged into a single 'main' sleep record" (how it chooses is not
  documented) ([sleep guide](https://developers.google.com/health/data-types/sleep)) [P].
- The common design in all three: choose a source by user-controlled priority; do not blend minutes.

### 4.3 What open-source projects do

I searched GitHub code and repositories for sleep merge logic. None of the projects below uses a per-minute majority
vote; the two real implementations use priority and rank. Coverage of this search is partial; GitHub code search is
incomplete [U].

| Project (licence) | What it does | Link |
|---|---|---|
| Open Wearables, the-momentum (MIT) | For each local sleep date (`end_datetime + zone_offset`) rank sources by provider priority, then device-type priority, then device model; keep all sessions of the winning source (`dense_rank() == 1`), naps included. Defaults: apple 1, garmin 2, polar 3, suunto 4, whoop 5, anything else 99. `is_nap` NULL counts as main sleep. A coverage-based fallback ("e.g. under 80 percent coverage") is listed as future work. [P] | [`winning_sleep_record_ids`](https://github.com/the-momentum/open-wearables/blob/main/backend/app/repositories/event_record_repository.py), [priority spec](https://github.com/the-momentum/open-wearables/blob/main/.ai/specs/001-data-source-priority.mdx) |
| SparkyFitness (source-available, non-commercial licence: do not reuse code) | Sweep line over all boundaries; in each elementary interval the covering sample with the highest rank wins (deep 5, REM 4, core 3, awake 2, unspecified asleep 1, in-bed 0), so a Watch `awake` overrides AutoSleep's generic `asleep`; gaps are dropped; adjacent same-stage slices are coalesced; sessions split at a 4 hour gap; time asleep = deep + light + REM. [P] | [`dataAggregation.ts`](https://github.com/CodeWithCJ/SparkyFitness/blob/main/SparkyFitnessMobile/src/services/healthkit/dataAggregation.ts) |
| Emuqu `SleepResolver` (licence not checked: do not reuse) | Pure resolver with four cases (session or not, Watch or not). Comment records a trap: an iPhone's `asleepUnspecified` "routinely pre-labels the 1-2 hour window of 'phone down + lights low' as sleep, dragging the displayed sleep start backward by an hour or more", so these guesses before the Watch's detected onset are dropped. [P, one developer's observation] | [`SleepResolver.swift`](https://github.com/chrissharp80/emuqu/blob/main/Emuqu/Sources/Analysis/SleepResolver.swift) |
| Open mHealth schemas (Apache-2.0) | Data model only: one `sleep-episode` with `is_main_sleep`, `latency_to_sleep_onset`, `total_sleep_time`, `number_of_awakenings`, `sleep_maintenance_efficiency_percentage`, and `effective_time_frame` from onset to final awakening. [P] | [`sleep-episode-1.0.json`](https://github.com/openmhealth/schemas/blob/master/schema/omh/sleep-episode-1.0.json) |
| GGIR (Apache-2.0), sleepreg (LGPL) | Not source merging. Reference implementations for the sleep period window (gap merge 60 min), naps and the SRI (section 2.6). | [GGIR](https://github.com/wadpac/GGIR), [sleepreg](https://github.com/dpwindred/sleepreg) |

### 4.4 Double counting traps

| Trap | What goes wrong | Guard |
|---|---|---|
| Summing `inBed` and `asleep` samples | Apple says detailed samples "overlap the in-bed sample". Summing doubles the night. | Two layers: in-bed is the TIB layer, asleep states are the TST layer. Never add layers. |
| Same device, two routes | A watch writes to Apple Health, and a third-party app that reads Health writes a copy back. Two sources, near-identical times. | Pick one source per night (priority). Do not flag these as a disagreement if start and end are within 5 minutes. |
| Re-sync and edited records | Retries create duplicates; edits at the source change start or end. Health Connect's guide warns about "duplicates during sync retries". | Idempotent upsert on `(user_id, source_id, external_id)`; if there is no id, fingerprint `(source_id, start rounded to minute, end rounded to minute, kind)`; delete local rows that the source no longer returns for the sync window (tombstones). Health Connect: "Deleting a session does not automatically delete data associated with that session". |
| Midnight edge | One source ends at 23:58, another at 00:03: separate keys, so two "nights". | Cluster by overlap across sources before assigning a key (4.5). |
| Time zone error in one source | Same sleep appears 5 or 8 hours apart. | If two sessions from different sources have equal length within 10 minutes and a start difference that is a whole number of hours (1 to 14), flag `possible_tz_error`; do not merge automatically. |
| Phone guesses | Sensor-less sources label scheduled bed time as sleep (Emuqu comment). | Tier ranking puts devices with stage data above phone guesses; the coverage floor handles the opposite failure. |
| Partial recording | The watch battery died at 02:00, the phone has the full night. | Coverage floor (4.5): a higher-priority automatic source whose main session has under half of the best candidate's asleep minutes loses that night. |
| Daily totals imported next to sessions | A daily "minutes asleep" and the sessions it came from both count. | Import sessions only. If a source gives only a daily total, store it as a session-less `daily_total` and use it only when no session exists for that key. |
| Stage mixing | Grafting the phone's stage labels onto the watch's session. | Stages come only from the winning source. Other sources' stages are shown separately, never summed. |

### 4.5 Recommended algorithm: priority per night, with a coverage floor

Design goals: (1) every number shown equals what exactly one source reported, so the person can check it in that
source's app; (2) deterministic, no randomness, stable under re-import; (3) the override is one tap (per-night
preferred source).

Source ranking (a `rank` integer, lower wins):

1. Tier 0: entered by the person, either in Intus or flagged as user-entered at the source
   (`RECORDING_METHOD_MANUAL_ENTRY` in Health Connect; Apple's user-entered metadata). This mirrors Apple's own default (manual first).
2. Tier 1: wearable with stage data (watch, ring, band).
3. Tier 2: phone or other sensor without stage data.
4. Tier 3: other apps and aggregators.
5. Inside a tier, the person's saved order; otherwise the order sources were first seen. A newly connected
   source goes to the bottom of its tier (Apple puts new sources on top; Intus does not, because that silently
   changes history).
6. A saved explicit ordering overrides tiers entirely.

Pseudocode (TypeScript flavoured; pure functions; all times are UTC milliseconds):

```
type Interval = { s: number; e: number }                       // [s, e)
type Stage = 'asleep' | 'light' | 'deep' | 'rem' | 'awake'
type SourceSession = {
  sourceId: string; rank: number; recordedAt: number;
  inBed: Interval | null;
  stages: { s: number; e: number; stage: Stage }[];            // empty if none; manual start/end => one 'asleep' stage
  unplacedAwakeMin: number;                                    // manual "minutes awake", not positioned
  endOffsetMin: number;
}

function buildNights(records: SourceRecord[], cfg): Night[] {

  // 1. validate (section 5); invalid records go to a quarantine list, never silently dropped
  const ok = records.filter(r => validate(r, cfg).ok)

  // 2. idempotent de-duplication: same (sourceId, externalId) keep newest recordedAt;
  //    no externalId => fingerprint of (sourceId, minute(start), minute(end), kind)
  const unique = dedupe(ok)

  // 3. per source, resolve overlaps INSIDE the source, then cut into sessions
  const sessions: SourceSession[] = []
  for (const [sourceId, recs] of groupBy(unique, r => r.sourceId)) {
    const timeline = resolveWithinSource(recs)         // below
    sessions.push(...cutIntoSessions(timeline, cfg.mergeGapMin))   // gap rule 3.4, asleep-to-asleep gap
  }
  sessions = sessions.filter(s => asleepMinutes(s) >= cfg.minSessionMin)

  // 4. cluster sessions of DIFFERENT sources that describe the same sleep
  //    edge a--b if overlap(a,b) >= 0.5 * min(duration(a), duration(b)); events = connected components
  const events = clusterByOverlap(sessions, 0.5)

  // 5. per event choose the winning source
  const chosen = []
  for (const ev of events) {
    const bySource = bestSessionPerSource(ev)          // longest asleep session per source in this event
    const bestAsleep = max(bySource.map(asleepMinutes))
    const eligible = bySource.filter(c =>
         c.tier0 || asleepMinutes(c) >= cfg.coverageFloor * bestAsleep)      // coverageFloor = 0.5
    eligible.sort(by(
      c => (ev.preferredSourceId === c.sourceId ? 0 : 1),  // per-night override from the person
      c => c.rank,                                         // priority
      c => (c.stages.some(isSpecific) ? 0 : 1),            // has real stage data
      c => -asleepMinutes(c),                              // more asleep minutes
      c => -c.recordedAt,                                  // newer write
      c => c.sourceId))                                    // final stable tie-break
    const w = eligible[0]
    chosen.push({ session: w, alternatives: bySource.filter(c => c !== w).map(summary(c, reason)),
                  flags: disagreementFlags(w, bySource) })
  }

  // 6. nights: key by the WINNER's end (3.2); main = most asleep minutes; others additional
  return groupBy(chosen, c => nightKey(c.session, cfg.cutoffHour)).map(pickMainAndNaps)
}

function resolveWithinSource(recs): Timeline {
  // Two layers. inBedLayer = union of in-bed intervals (TIB). stateLayer = sweep line over boundaries.
  // For each elementary interval [b_i, b_{i+1}) covered by one or more state samples choose
  // the sample with highest (recordedAt, specificity); specificity: deep=rem=light=3 > awake=2 > asleep(unspecified)=1.
  // Uncovered intervals stay uncovered (unknown), they are not turned into awake.
  // Coalesce adjacent slices with the same stage. A record with no stage list becomes one 'asleep' state over its span.
}

function disagreementFlags(w, all): string[] {
  // 'sources_disagree' if any other source overlapping w by >= 50% differs in asleep minutes by >= 60.
  // 'possible_tz_error' as in 4.4. 'single_source' if all.length == 1.
}
```

Tie-break summary (in this order): (1) the person's per-night choice; (2) rank; (3) real stage data; (4) more asleep
minutes; (5) newer `recordedAt`; (6) `sourceId` in ascending order. Rules 3 to 6 matter only between sources of the same rank.
Constants: `coverageFloor = 0.5` [D], `overlapEdge = 0.5` [D], `disagreeMin = 60` [D], `mergeGapMin = 60` [D from GGIR].

Why the coverage floor and not "longest": the floor only fires when a higher-priority automatic source is clearly
incomplete, so the series stays on one source almost all of the time (important for before/after comparisons,
section 7.3). The floor value is a judgement call [D]; the Open Wearables project lists a similar 80 percent fallback
as planned work. Log every time the floor fires and show it on the night ("Watch recorded 3 h 10 of an estimated 7 h 40,
so the phone's record was used").

What the night screen must show: the used source and its rank; each alternative with its asleep time and why it was
not used; the rule text for each metric; a "use this one instead" action (stores `preferred_source_id` for that
night).

---

## 5. Plausibility limits for manual entry and imported data

No standard exists for "implausible sleep". The limits below are design defaults [D] anchored to the numbers that do
exist. Principle: reject only what is impossible or structurally invalid, warn on what is merely unusual, and never
silently drop an import; send it to a quarantine list the person can see.

| Id | Rule | Default | Manual entry | Import | Reason |
|---|---|---|---|---|---|
| V1 | `start` and `end` are finite instants and `end > start` | n/a | reject | quarantine | arithmetic validity |
| V2 | minimum session length | 15 min | reject ("shorter than 15 minutes") | ignore, count in `ignored` | Oura's smallest nap is 15 minutes [P]; GGIR's example nap range starts at 15 [P] |
| V3 | hard maximum single session | 20 h | reject | quarantine | the most extreme daily totals in the clinical literature are "up to 20 hours per day" in Kleine-Levin episodes ([NINDS text via BrainFacts](https://brainfacts.org/diseases-and-disorders/neurological-disorders-az/diseases-a-to-z-from-ninds/kleine-levin-syndrome)) [S]; one session longer than that is almost always an AM/PM or date error |
| V4 | soft maximum single session (age 6 and over) | 14 h | warn, offer "Did you mean ...?" with AM/PM and date swaps | keep, flag `long_session` | the longest NSF upper bound for any age 14 and over is 11 h; 14 h is three hours past it [D] |
| V5 | soft minimum for a main sleep | 3 h | warn only | keep, flag `short_main` | Fitbit marks logs under 3 hours "too short" [P]; Oura's `long_sleep` starts above 3 h [P] |
| V6 | total asleep time inside any 24 h window | 20 h | reject the newest record | quarantine | same reasoning as V3 |
| V7 | overlap inside one source | none allowed | reject, name the overlapping record | resolve with the within-source rules (4.5), do not reject | Health Connect stages "shouldn't overlap"; Apple's detailed samples "don't overlap each other" [P]; but repeated writes and edits do overlap in practice |
| V8 | overlap across different sources | allowed | n/a | allowed, handled by 4.5 | expected: several devices record one night |
| V9 | not in the future | `end <= now + 5 min` | reject | ignore, flag `future` | clock skew between devices [D] |
| V10 | not before | 2000-01-01 | reject | quarantine | earlier than any consumer sleep tracker; catches year typos [D] |
| V11 | offsets | integer minutes within -720 to +840; warn if not a multiple of 15 | reject outside range | quarantine, then fall back to profile zone with `tz_assumed` | civil time zones currently span UTC-12 to UTC+14 (common knowledge, not fetched) [D] |
| V12 | start and end offsets differ by more than 2 h and no `tz_id` | | warn | flag `tz_uncertain` | a 2 hour jump inside one sleep is not daylight saving time |
| V13 | stage segment shape | each segment `start < end`, inside the session (1 min tolerance), stage in the known set | n/a | drop the segment list and keep the session, flag `bad_stages` | structural |
| V14 | stage segments do not overlap each other | none | n/a | same as V13, except Google `shortAwakenings`, which "can overlap with surrounding sleep stages" and are stored as a separate list [P] | contracts in [Health Connect](https://developer.android.com/reference/androidx/health/connect/client/records/SleepSessionRecord), [Google Health API](https://developers.google.com/health/data-types/sleep) |
| V15 | stage minutes add up | sum of segment minutes <= session minutes + 1 | n/a | same as V13 | |
| V16 | vendor summary consistency | vendor `minutesAsleep` <= vendor `timeInBed`; efficiency within 0 to 100 | warn | recompute from segments, keep the vendor figure for display, flag `summary_mismatch` if they differ by more than 5 min | vendors compute their own figures (Fitbit and Google: `round(minutesAsleep / minutesInBed * 100)`) [P] |
| V17 | one `no_sleep` marker per key and no session on the same key | | reject conflicts | n/a | |

"Impossible stage sequences". Structurally impossible: overlap, negative length, a stage outside its session, an
unknown stage code. Physiologically odd but possible: REM within the first 15 minutes after sleep onset, or a single
light segment longer than 3 hours. These are flagged only (`rem_at_onset`, `no_cycling`), never rejected, because
sleep-onset REM does occur in some conditions and I found no standard to cite for a hard rule [U]. Stage coverage
below 80 percent of the asleep period (`stage_coverage_low`) disables the stage views for that night.

Manual form defaults: pre-fill from the person's last night, not a typical night; keep seconds out of the model (round
to the minute); ask for bedtime, wake time and, optionally, "minutes to fall asleep", "minutes awake in the night"
and "out of bed" (Consensus Sleep Diary items) [S]; show the computed duration and the age band class before saving,
as a number, not a verdict.

---

## 6. Presenting stages honestly

### 6.1 Vendor stage vocabularies and the Intus mapping

| Intus stage | Apple HealthKit | Health Connect | Fitbit (stages log) | Google Health API |
|---|---|---|---|---|
| awake | `awake` | `STAGE_TYPE_AWAKE` (1), `AWAKE_IN_BED` (7) | `wake` | `AWAKE` |
| light | `asleepCore` ("light or intermediate sleep") | `STAGE_TYPE_LIGHT` (4) | `light` | `LIGHT` |
| deep | `asleepDeep` | `STAGE_TYPE_DEEP` (5) | `deep` | `DEEP` |
| rem | `asleepREM` | `STAGE_TYPE_REM` (6) | `rem` | `REM` |
| asleep (no stage) | `asleepUnspecified` (`asleep` until iOS 16) | `STAGE_TYPE_SLEEPING` (2) | classic `asleep` (and `restless`, which is not a stage) | session without stages |
| ignore | `inBed` is the TIB layer | `OUT_OF_BED` (3), `UNKNOWN` (0) | | |

Sources: Apple [HKCategoryValueSleepAnalysis](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis), Health Connect
[SleepSessionRecord](https://developer.android.com/reference/androidx/health/connect/client/records/SleepSessionRecord), [Fitbit](https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-log-by-date/), [Google Health API](https://developers.google.com/health/data-types/sleep) [P].
Apple's "core" is Apple's own word; it is not guaranteed to equal N1 plus N2, so Intus calls it "light" and does not
claim a split between N1 and N2.

### 6.2 Typical shares of total sleep, and how they change with age

| Stage | Typical healthy adult share of total sleep time | NSF quality panel (otherwise healthy people) [P] | Age trend |
|---|---|---|---|
| N1 (part of "light") | about 2 to 5 percent [S] | 5 percent or less is good; 20 percent or more is not | rises with age (effect size +0.38 in adults) |
| N2 (rest of "light") | about 45 to 55 percent [S] | more than 81 percent is not good | rises with age (+0.28) |
| N3 ("deep", slow-wave) | about 13 to 25 percent, textbooks differ [S] | 16 to 20 percent is good for adults; 5 percent or less is not good for teens, young adults and adults | falls the most (effect size -0.85, the largest of the measures tested) |
| REM | about 20 to 25 percent [S] | 21 to 30 percent is good for adults; 41 percent or more is not | falls with age (-0.46) |

Sources: textbook ranges from [StatPearls "Physiology, Sleep Stages"](https://www.statpearls.com/point-of-care/20917) and
sleep-technologist study guides [S, not primary; the N3 range varies between sources]; NSF numbers from
[Ohayon 2017](https://doi.org/10.1016/j.sleh.2016.11.006) [P]; age effects from the meta-analysis of 65 studies and 3,577 people aged 5 to 102
([Ohayon 2004, Sleep 27(7):1255-73](https://pubmed.ncbi.nlm.nih.gov/15586779/), Table 6 effect sizes read in the full text) [P]. Quoted conclusions: in adults total sleep time,
sleep efficiency, percent slow-wave sleep and percent REM decrease with age, sleep latency, percent stage 1, percent
stage 2 and WASO increase; "only sleep efficiency continued to significantly decrease after 60 years of age"; effect
sizes "were greatly modified by the quality of subject screening". WASO rises "about 10 minutes per decade of age from 30
years" [P]. Children's shares differ (REM and N3 are a larger fraction); the app should show stage shares only for
ages 18 and over, because the NSF stage rows for children are sparse [D].

### 6.3 Why wearable stages are estimates

Facts the label rests on:

- Wrist devices infer stages from motion and pulse. Apple's documentation itself notes that Apple Watch "only include[s]
  awake samples that occur between two sleep samples", so wake at the start and end of the night is not observed [P].
- Device versus polysomnography (PSG): seven consumer devices in 34 healthy adults had epoch-by-epoch sleep
  sensitivity of 0.93 or more but wake specificity of only 0.18 to 0.54, stage comparisons were "mixed" and
  worse on disturbed nights ([Chinoy et al. 2021, Sleep 44(5):zsaa291](https://academic.oup.com/sleep/article/44/5/zsaa291/6055610)) [S].
  Fitbit models without staging overestimated total sleep time by about 7 to 67 minutes and efficiency by 2 to 15
  percent and underestimated WASO; staging models had sensitivity 0.95 to 0.96 and specificity 0.58 to 0.69
  ([Haghayegh et al. 2019, JMIR 21(11):e16273](https://www.jmir.org/2019/11/e16273)) [S]. A 24 study, 798 person meta-analysis (2025) found total
  sleep time, efficiency, latency and WASO all differed significantly between consumer devices and PSG
  ([J Clin Sleep Med 2025, PMC11874098](https://pmc.ncbi.nlm.nih.gov/articles/PMC11874098/)) [S, abstract only]. A lab study of six wrist devices in 62 adults found
  most differed from PSG for total sleep time, efficiency, WASO and light sleep ([PMC12038347](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12038347/)) [S].
  For Apple Watch, an independent study reported 88 percent sleep/wake agreement (kappa 0.30) and 53 percent
  four-stage agreement (kappa 0.20) ([Sensors 2022, PubMed 36016077](https://pubmed.ncbi.nlm.nih.gov/36016077/)) [S]; Apple's own validation claims (kappa
  about 0.63) I could not verify [U].
- AASM position: consumer sleep technology is not a substitute for medical evaluation
  ([Khosla et al. 2018, JCSM 14(5):877-880, doi:10.5664/jcsm.7128](https://aasm.org/consumer-sleep-technology/)) [S].
- Algorithms change: Oura's API carries `sleep_algorithm_version` [P], so a trend can break at a software update.

Labelling rules [D]: every stage number and chart carries "Estimated by <device name>" and the algorithm version when
known; stage shares are never compared across sources or algorithm versions; no stage figure enters any rating,
streak, supplement comparison or health statement; the only reference lines are the NSF REM and N3 ranges; the sentence
"These are estimates from a wrist sensor, not a sleep study" is one tap away.

### 6.4 Chart conventions

1. **Nightly duration bars with a target band.** One bar per night keyed by wake date; the bar is the main sleep's TST
   (or "bed to wake" for start/end-only entries, with a dashed top and a different label). Bars start at zero,
   because bar length encodes the value ([Datawrapper academy](https://www.datawrapper.de/academy/why-our-column-and-bar-charts-start-at-zero), citing Pandey et al. 2015) [S].
   Behind the bars draw the NSF "recommended" band for the person's age as a light neutral range and the "may be
   appropriate" ranges lighter still (section 1). Missing nights are gaps, never zero and never interpolated. Bars above
   and below the band share one colour. Show n nights, the window, and the rule text under the chart. Naps are a
   separate thin segment above the bar, not added into it. A 7 night mean is drawn only with at least 5 of the 7 nights.
2. **Bedtime and wake-time strip.** One horizontal bar per night from sleep start to end on a 24 hour wall-clock axis
   that begins at 18:00 and ends at 18:00 the next day (so a normal night does not wrap; shift workers pick 12:00).
   Tick for the midpoint. Weekends and free days shaded. Daylight saving changes and time-zone changes marked on the
   date axis. Axis labels in local wall-clock time of where the person slept.
3. **Hypnogram, only when stage data exists.** Draw it only for nights whose winning source has stage segments covering
   at least 80 percent of the asleep period. Step plot, time on x, one row per stage; the row order is a convention
   (consumer apps usually show awake at the top and deep at the bottom; I found no standard to cite for the order [U]),
   so label every row. Never draw a hypnogram, or a flat "asleep" bar styled like one, for manual entries. No smoothing.
4. Provide a text or table alternative with the same numbers for every chart; do not rely on colour alone for the band.

---

## 7. How sleep relates to what Intus tracks

### 7.1 Findings the app may cite, with strength

Strength scale used here: **Strong** = consistent across several meta-analyses that include randomized experiments;
**Moderate** = consistent associations in prospective cohorts, or small randomized experiments; **Weak or mixed** =
inconsistent or null. Every row is group-level evidence. None applies to one person's data.

| Topic | What replicated studies found | Strength | Source |
|---|---|---|---|
| Appetite and energy intake | Short-term partial sleep deprivation raised energy intake by 385 kcal/day (95% CI 252 to 517) with no change in energy expenditure (11 studies, 172 people; [S]). A 2 week randomized trial in 80 adults aged 21 to 40, BMI 25 to 29.9, sleeping under 6.5 h, extended sleep by about 1.2 h and ate 270 kcal/day less than controls (95% CI -393 to -147; [S]). In 12 young men, 2 nights of restriction lowered leptin 18 percent, raised ghrelin 28 percent, hunger 24 percent, appetite 23 percent ([S]). | Moderate for intake over days to weeks; the trials are short and small | [Al Khatib 2017, doi:10.1038/ejcn.2016.201](https://doi.org/10.1038/ejcn.2016.201); [Tasali 2022, doi:10.1001/jamainternmed.2021.8098](https://doi.org/10.1001/jamainternmed.2021.8098); [Spiegel 2004, PMID 15583226](https://pubmed.ncbi.nlm.nih.gov/15583226/) |
| Body weight | Short sleep and obesity: pooled odds ratio 1.89 (1.46 to 2.43) in children and 1.55 (1.43 to 1.68) in adults, mostly cross-sectional; the authors say a causal link is unproven [S]. In 10 adults on a 14 day calorie-restricted diet, 5.5 h versus 8.5 h in bed cut the share of weight lost as fat by 55 percent [S]. Day-to-day weight on a scale mostly moves with water. | Weak to moderate for long-run weight | [Cappuccio 2008](https://pubmed.ncbi.nlm.nih.gov/18517032/); [Nedeltcheva 2010](https://pubmed.ncbi.nlm.nih.gov/20921542/) |
| Mood and mental health | 65 randomized trials (8,608 people) of interventions that improved sleep quality: composite mental health Hedges g -0.53, depression -0.63, anxiety -0.51 (negative means fewer symptoms) [S]. Insomnia predicts later depression: odds ratio 2.10 (fixed effects) to 2.60 (random effects), 21 longitudinal studies [S]. These are about insomnia and sleep quality, not about nightly hours. | Moderate to strong at group level for insomnia and depression; weak for one night's duration and next-day self-rated mood [U] | [Scott 2021, doi:10.1016/j.smrv.2021.101556](https://pubmed.ncbi.nlm.nih.gov/34607184/); [Baglioni 2011, doi:10.1016/j.jad.2011.01.011](https://doi.org/10.1016/j.jad.2011.01.011) |
| Steps and exercise | A 66 study meta-analysis found acute exercise had small beneficial effects on total sleep time, latency and efficiency, and regular exercise small effects on total sleep time and efficiency and a moderate effect on sleep quality [S]. Step counts themselves, and the reverse direction (poor sleep leading to fewer steps), I could not verify [U]. | Moderate for exercise, small effects; unverified for steps | [Kredlow 2015, doi:10.1007/s10865-015-9617-6](https://pubmed.ncbi.nlm.nih.gov/25596964/) |
| Glucose and HbA1c | Incident type 2 diabetes: short sleep RR 1.28 (1.03 to 1.60), long sleep 1.48 (1.13 to 1.96), 10 studies, 107,756 people [S]. Six nights at 4 h in bed reduced glucose tolerance in 11 men [S]; seven nights at 5 h cut insulin sensitivity by 20 +- 24 percent (IVGTT) and 11 +- 5.5 percent (clamp) in 20 men [S]. In people who already have type 2 diabetes, short sleep, long sleep and poor sleep quality go with higher HbA1c (20 studies, 69,329 people) [S]. HbA1c averages roughly the last two to three months of glucose, so one night cannot be linked to it. For people without diabetes I found no verified HbA1c result [U]. | Moderate for diabetes incidence and glycaemic control at group level; experiments are small and in young men | [Cappuccio 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2809295); [Spiegel 1999, doi:10.1016/S0140-6736(99)01376-8](https://pubmed.ncbi.nlm.nih.gov/10543671/); [Buxton 2010, doi:10.2337/db09-0699](https://pmc.ncbi.nlm.nih.gov/articles/PMC2927933/); [Lee 2017, doi:10.1016/j.smrv.2016.02.001](https://doi.org/10.1016/j.smrv.2016.02.001) |
| Lipids | Prospective studies find no link: dyslipidaemia risk RR 1.01 (0.93 to 1.10) for short and 0.98 (0.87 to 1.10) for long sleep, 13 studies; "no supportive evidence"; Jike 2018 had too few studies to assess dyslipidaemia [S]. | Weak or null | [Kruisbrink 2017, doi:10.1136/bmjopen-2017-018585](https://pmc.ncbi.nlm.nih.gov/articles/PMC5735405/) |

Recommended UI behaviour: cite weight/appetite, mood and glucose findings only on request ("What does research say?"),
always as group-level, with the study size and the strength label. Show nothing about lipids. Show nothing about
HbA1c from the app's own sleep data.

### 7.2 What the app must never claim

1. That sleep caused, or will cause, any change in the person's own weight, mood, steps, glucose, HbA1c or lipids.
   Observational links need confounding and reverse causation ruled out; one person's logs cannot do that.
2. Any risk number for the person (a relative risk is a group statistic).
3. That more sleep is better, that a long night is a good night, or "catch-up sleep" advice (section 1.4).
4. That a supplement, bedtime or habit "improved" sleep from the app's own before-and-after numbers.
5. That a stage share, a device's "sleep score", or a regularity value diagnoses anything.
6. A lab-marker interpretation based on sleep data.
7. A numerical sleep goal derived from the person's data. The profile already stores `sleep_goal`; keep it as the
   person's own target and show the NSF band beside it.

When the app compares the person's own sleep with their own other logs, it describes: "On the 12 days after a night
under 6 hours your logged calories averaged 2,310; on the other 40 days 2,150. That is what your log shows, not
evidence that sleep changed your eating." Use the same minimum days and the "no clear change" rule as the supplement
comparison, and show at most a handful of such pairs: with 8 metrics each tested at roughly 2 standard errors, the
chance that at least one flags by luck is about 1 - 0.95^8 = 34 percent (independence assumed).

### 7.3 Adding sleep duration to the supplement before-and-after comparison

The existing rules (`src/features/supplements/effect.ts`, read-only): before = 28 days before the start date; after =
from day 8 (7 ramp-up days) for at most 56 days, ending at the end date or today; at least `MIN_DAYS = 10` logged days
in each period; "higher" or "lower" needs a shift of at least 0.5 pooled standard deviations that is also more than
2 standard errors of the difference.

**Can it be one more metric? Yes, with four conditions.**

1. Value per day: the main sleep's TST in minutes, keyed by night key = wake date = `log_date`. A night is "logged" if
   it has a main sleep and, for wearable sources, a valid record. Naps excluded. Show hours, say "Higher/lower", never
   "better/worse" (the existing page already refuses to judge direction).
2. Timing is right. The first night after a dose taken on the start date ends on start date + 1, inside the
   7 day ramp that the after-period already skips; the last "before" night ends on start date - 1. No off-by-one fix is
   needed.
3. **Same measurement in both periods.** If the winning source tier or device differs between the periods (for example
   manual entries before, a new watch after), say "not comparable" and give no verdict. Devices differ from PSG by tens
   of minutes in total sleep time (7 to 67 minutes for Fitbit models, 6.3) and two devices differ from each other by
   as much, which is larger than any plausible supplement effect.
4. **Whole weeks.** Sleep has a strong weekday cycle (social jetlag, 2.5). The 28 day before period is exactly four
   weeks. The after period is eight weeks only when complete; when it is cut by today or the end date, trim it to the
   largest whole number of weeks (7, 14, 21, ...) and give no verdict under 14 days [D]. Otherwise an extra weekend
   in one period can fake a shift.

**Does 28 before against days 8 to 63 after make sense for sleep?** Mostly yes, and the whole-week lengths are an
advantage. The weak point is statistical power, not the window. With a within-person SD of nightly duration of about 77
minutes (actigraphy; 86 by diary; [Messman 2022](https://doi.org/10.1111/jsr.13680) [S]), the smallest shift the current rule can call "higher" or "lower"
is the larger of 0.5 SD (38.7 min) and 2 standard errors:

| Nights before / after | SE of difference | 2 SE | Smallest shift flagged |
|---|---|---|---|
| 10 / 10 (current minimum) | 34.6 min | 69.2 | 69 min |
| 14 / 14 | 29.3 | 58.5 | 59 min |
| 28 / 28 | 20.7 | 41.4 | 41 min |
| 28 / 56 (full windows) | 17.9 | 35.8 | 39 min |

(SE = SD * sqrt(1/nBefore + 1/nAfter); numbers computed for SD 77.4 min.) Reported supplement effects on sleep are far
smaller: a meta-analysis of 19 placebo-controlled trials (1,683 people with primary sleep disorders) found melatonin
shortened sleep latency by 7.1 minutes and lengthened total sleep time by 8.3 minutes (95% CI 1.7 to 14.8)
([Ferracioli-Oda 2013, doi:10.1371/journal.pone.0063773](https://doi.org/10.1371/journal.pone.0063773)) [S]. So the comparison will say "no clear change" almost
always, and the page must say: "This comparison can only detect changes of about 40 minutes or more in nightly sleep.
No clear change does not mean no effect." Recommended changes [D]: a per-metric `minDays` of 14 for sleep (two full
weeks, which contain about four weekend nights); keep the 7 day ramp and the 56 day cap; add the whole-week trim and
the same-measurement check; show the smallest detectable shift next to the result.

Cautions to print on the sleep row: people often start a supplement when they are sleeping badly, so a "before" period
of poor sleep tends to be followed by better sleep anyway (regression to the mean; [Barnett et al. 2005, Int J
Epidemiol 34(1):215-220](https://pubmed.ncbi.nlm.nih.gov/15333621/)) [S]; season and daylight saving time can shift sleep over a 91 day span; other supplements or
habits started in the window (already listed by `concurrentChanges`) cannot be separated; caffeine, alcohol, illness and
travel are not tracked. Do not add midpoint or efficiency to the comparison (clock-time midpoints move an hour at
daylight saving time; efficiency is device-estimated).

---

## 8. Implementation spec

### 8.1 Conventions

- Pure functions in `src/features/sleep/` (suggested files: `ranges.ts`, `validate.ts`, `nights.ts`, `merge.ts`,
  `metrics.ts`, `regularity.ts`, `chronotype.ts`) with tests in `test/sleep.*.test.ts`, written like the existing tests
  (`node:test`, `node:assert/strict`, `.ts` import extensions, invented fixtures).
- Repo constraints from `tsconfig.json`: `strict`, `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly`
  (no `enum`, no namespaces; use string-literal unions), `noUnusedLocals`. Node 22 runs the tests.
- No function reads the clock or the browser time zone: pass `nowMs`, offsets and `tz` in. All times are integer UTC
  milliseconds, rounded to the minute on entry. Durations are integer minutes. Expected bad input returns a result
  object (`ok`/`errors`), it does not throw. Do not use `dayNumber(Date)` from `src/lib/dates.ts` on instants: it
  reads the host's local parts.
- Storage (for the later migration PR, not part of this task; schema changes only through `supabase/migrations/`
  per `CLAUDE.md`): `sleep_sessions(id, user_id, source_id, source_kind, external_id, kind, start_utc, end_utc,
  start_offset_min, end_offset_min, tz_id, recorded_at, recording_method, vendor_type, vendor_day, algorithm_version,
  awake_minutes, fall_asleep_minutes, out_of_bed_utc)` with unique `(user_id, source_id, external_id)` and row level
  security like the other tables; `sleep_stage_segments(session_id, start_utc, end_utc, stage)`;
  `sleep_source_prefs(user_id, source_id, rank)`; `sleep_night_prefs(user_id, night_key, preferred_source_id)`.

### 8.2 Types

```ts
export type Stage = 'asleep' | 'light' | 'deep' | 'rem' | 'awake';
export interface Interval { s: number; e: number }               // UTC ms, [s, e)
export interface StageSegment extends Interval { stage: Stage }
export interface SleepRecord {
  id: string; sourceId: string; externalId: string | null; sourceKind: 'manual' | 'wearable' | 'phone' | 'app';
  kind: 'sleep' | 'in_bed' | 'no_sleep'; userEntered: boolean;
  startUtc: number; endUtc: number; startOffsetMin: number; endOffsetMin: number; tzId: string | null;
  recordedAt: number; stages: StageSegment[]; awakeMinutes: number | null; fallAsleepMinutes: number | null;
  outOfBedUtc: number | null; algorithmVersion: string | null;
}
export interface SourceSession { sourceId: string; rank: number; recordedAt: number; inBed: Interval | null;
  stages: StageSegment[]; unplacedAwakeMin: number; endOffsetMin: number; tzId: string | null }
export interface Night { key: string; main: SourceSession | null; additional: SourceSession[]; usedSourceId: string;
  alternatives: { sourceId: string; asleepMin: number; reason: string }[]; flags: string[] }
```

### 8.3 Functions

| Function | Inputs | Output | Edge cases |
|---|---|---|---|
| `durationTarget(ageYears)` | whole years | `{ notBelow, recLow, recHigh, notAbove (hours), basis: 'night' \| '24h', aasm: string \| null } \| null` | age under 1: null (needs months); not an integer, negative, over 120: null; age 18 uses adult row; basis `24h` for ages 1 to 5 |
| `classifyDuration(minutes, ageYears)` | asleep minutes | `'recommended' \| 'may_be_appropriate' \| 'not_recommended' \| null` | uses 1.2 thresholds: below notBelow not; [notBelow, recLow) may; [recLow, recHigh] rec; (recHigh, notAbove] may; above not; exact 6:00 is "may"; null for no target |
| `validateRecord(rec, ctx)` | record, `{ nowMs, manual: boolean, existing: SleepRecord[] }` | `{ ok, errors: string[], warnings: string[], flags: string[] }` | rules V1 to V17; a quarantined import returns `ok:false` with a stable error code per rule |
| `nightKey(endUtc, endOffsetMin, cutoffHour = 24)` | | `'YYYY-MM-DD'` | session ending exactly at local midnight gets the new date; cutoff 18 puts a 18:00 end on the next date; never reads host zone |
| `resolveWithinSource(recs)` | records of one source | non-overlapping `{ inBed: Interval[]; states: StageSegment[] }` | recency then specificity; uncovered time stays unknown; in-bed never added to asleep |
| `cutIntoSessions(timeline, mergeGapMin)` | resolved timeline | `SourceSession[]` | gap measured asleep-to-asleep; gap <= mergeGapMin merges and counts as WASO; sessions under `MIN_SESSION_MIN` of asleep time dropped |
| `clusterSessions(sessions, edge = 0.5)` | sessions of all sources | `SourceSession[][]` | edge when overlap >= edge * shorter duration; connected components; a source contributes its longest session per cluster |
| `chooseSource(cluster, cfg, preferredSourceId?)` | | `{ winner, alternatives, flags }` | 4.5 order: person's choice, rank, stage data, asleep minutes, `recordedAt`, `sourceId`; floor 0.5 except tier 0; `sources_disagree`, `possible_tz_error` |
| `buildNights(records, cfg)` | all records of a person | `Night[]` sorted by key | same input in any order gives identical output; invalid records returned in a separate quarantine list; keys with only `no_sleep` give a night with `main: null` and `flags: ['no_sleep']` |
| `sessionMetrics(s)` | one session | `{ tibMin, sptMin, tstMin, solMin \| null, wasoMin \| null, awakenings \| null, seTib \| null, seDse \| null, onsetUtc, finalAwakeningUtc, midpointUtc, precision: 'bed_to_wake' \| 'diary' \| 'staged' }` | start/end only: tst = spt, waso/sol/awakenings/se null; `seTib` null when tst = tib; se over 100 is an error; awakenings counts awake episodes strictly longer than 5 min between onset and final awakening; Apple edge gaps handled (onset is first asleep segment) |
| `stageShares(s)` | session with stages | `{ light, deep, rem, asleepUnspecified: minutes; coverage: number } \| null` | null when coverage < 0.8 or no stages; shares are of the staged asleep minutes |
| `hypnogramSteps(s)` | session | `{ s, e, stage }[]` or null | null unless coverage >= 0.8; merges adjacent same-stage slices |
| `circularMeanMinutes(xs)`, `wrapDiff(x, m)`, `anchoredSd(xs)` | clock minutes | number or null | implement exactly as in 2.4; null for fewer than 2 values or zero resultant; flag when resultant length < 0.3 |
| `midpointLocalMinutes(onsetUtc, faUtc, tz)` | | minutes after local midnight | offset taken at the midpoint instant, not at the start |
| `socialJetlag(nights, cfg)` | nights, work-day set, `alarmOnFreeDays`, today | `{ status: 'ok' \| 'not_enough' \| 'shift_unsupported'; msfMin; mswMin; sjlRelMin; sjlAbsMin; msfscMin \| null; nWork; nFree }` | wake-date weekday decides work or free; min 4 work and 2 free nights in 28 days; sign by the shorter-way rule; `msfsc` null if alarm on free days; travel nights excluded |
| `regularityIndex(sessions, observedDays, cfg)` | main and extra sessions, `observed` set of local dates, tz | `{ sri \| null; validPairs; validMinuteFraction; dayPairs; params }` | 1 min epoch, wall clock; nonexistent DST minutes missing, repeated first wins; unobserved days missing; fewer than 5 valid day pairs gives null; weekly-balanced window not required |
| `observedDays(nightKeys, noSleepKeys)` | | `Set<string>` | day D observed iff nights D and D+1 are both present |
| `variabilitySummary(nights)` | | `{ bedSdMin; wakeSdMin; midSdMin; durationSdMin; n; rough: boolean }` | needs >= 7 nights; `rough` when < 14; uses `anchoredSd`; travel nights excluded |
| `sleepDaySeries(nights)` | | `Map<number, number>` (dayNumber of key to main TST minutes) | plugs into `seriesOf` in `effect.ts`; skips nights with `precision` unknown; nap-only keys are absent |
| `trimToWholeWeeks(days, from, to)` | | `{ from, to }` | after-period only; returns the largest multiple of 7 days starting at `from`; under 14 days returns null (no verdict) |
| `measurementConsistent(before, after)` | nights in each period | `{ ok; reason: 'source_changed' \| 'tier_changed' \| null }` | not comparable if the majority source differs between periods or more than 20 percent of nights in a period come from another source |
| `minimumDetectableShift(sdMin, nBefore, nAfter)` | | minutes | `max(0.5 * sd, 2 * sd * sqrt(1/nB + 1/nA))`, as in 7.3 |

### 8.4 Default constants

| Name | Value | Source or reason |
|---|---|---|
| NSF rows `[notBelow, recLow, recHigh, notAbove]` hours: 0-3 mo `[11,14,17,19]`; 4-11 mo `[10,12,15,18]`; 1-2 y `[9,11,14,16]`; 3-5 y `[8,10,13,14]`; 6-13 y `[7,9,11,12]`; 14-17 y `[7,8,10,11]`; 18-25 y `[6,7,9,11]`; 26-64 y `[6,7,9,10]`; 65+ `[5,7,8,9]` | | [Hirshkowitz 2015](https://doi.org/10.1016/j.sleh.2014.12.010) [P]; continuous reading [D] |
| MIN_SESSION_MIN | 15 | Oura nap minimum [P]; GGIR nap example [P] |
| NAP_MAX_MIN, SHORT_MAIN_MIN | 180, 180 | Oura `sleep` max 3 h and `long_sleep` above 3 h [P]; Fitbit "too short (less than 3 hours)" [P] |
| MERGE_GAP_MIN | 60 (setting range 30 to 240) | GGIR `spt_max_gap_dur = 60` [P]; SparkyFitness 4 h as the other end [P] |
| AWAKENING_MIN | strictly more than 5 min | NSF definition [P] |
| COVERAGE_FLOOR, OVERLAP_EDGE, DISAGREE_MIN | 0.5, 0.5, 60 min | [D] |
| TZ_ERROR_LENGTH_TOL, TZ_ERROR_START_DIFF | 10 min, whole hours 1 to 14 | [D] |
| SOFT_MAX_SESSION_MIN, HARD_MAX_SESSION_MIN, MAX_ASLEEP_24H_MIN | 840, 1200, 1200 | [D]; 20 h from Kleine-Levin "up to 20 hours per day" [S] |
| FUTURE_TOLERANCE_MIN, EARLIEST_DATE | 5, 2000-01-01 | [D] |
| OFFSET_RANGE_MIN | -720 to 840 | civil time zones [D] |
| STAGE_COVERAGE_MIN | 0.8 | [D] |
| SRI: epoch 1 min; MIN_SRI_PAIRS 5; SRI_WINDOW_DAYS 28; min valid hours per pair 12 | | Phillips minute resolution [P]; sleepreg `minSRIdays = 5`, `exclNAhrs = 6` [P]; whole weeks [P] |
| MIN_VARIABILITY_NIGHTS, ROUGH_BELOW | 7, 14 | Fischer: differences largest at 7 days or fewer [P]; [D] |
| SJL minimum | 4 work nights and 2 free nights in 28 days | [D] |
| DEFAULT_WORK_DAYS, CUTOFF_HOUR | Monday to Friday, 24 | [D]; Fitbit end-date rule [P], Oura 18 [S] |
| LONG_SLEEP_NOTICE | more than 14 of last 28 nights above `notAbove` | [D] |
| SE_REFERENCE, LATENCY_REFERENCE, WASO_REFERENCE, AWAKENINGS_REFERENCE | 85 %, 15 min (16 to 30 also good), 20 min, 1 | NSF quality panel [P] (reference lines only) |
| Supplement sleep metric: SLEEP_MIN_DAYS | 14 (others stay `MIN_DAYS = 10`) | 7.3 [D]; `BEFORE_DAYS 28`, `RAMP_DAYS 7`, `AFTER_MAX_DAYS 56`, `MIN_EFFECT_SIZE 0.5`, `SE_MULTIPLE 2` unchanged |

### 8.5 Golden tests (values from the prototype runs of 2026-10-09)

| Test | Expected |
|---|---|
| `regularityIndex`, 23:00 to 07:00 every night, 12 observed days, UTC | 100 |
| same, schedule 2 h later on alternate nights | 66.67 (= 100 - 200 * 4/24) |
| same, 3 h later on Saturday and Sunday nights | 86.36 |
| New York, constant 23:00 to 07:00 wall clock across 2026-11-01 | night of 2026-10-31 lasts 540 min; SRI 100 |
| `anchoredSd([1380, 1410, 1365, 15])` | 39.69 |
| `socialJetlag`: free onset 00:30, SDF 540, SDW 420, 5 work days, MSW 03:00 | MSF 05:00, SDweek 454.3 min, MSFsc 04:17, SJL +120 min |
| 4.1 example: watch 425, phone 520, manual 465 min | priority picks 465 (manual first) or 425 (manual absent); union 520; sum 1410; vote 470 |
| coverage floor: watch 190 min vs phone 460 min, watch higher rank | phone chosen, alternative reason `below_coverage_floor` |
| `classifyDuration(359, 40)` / `(360, 40)` / `(420, 40)` / `(540, 40)` / `(541, 40)` / `(601, 40)` | not / may / recommended / recommended / may / not |
| `nightKey` end 2026-10-09 06:30, offset -240 | `2026-10-09`; with cutoff 18 and end 19:00 the next date |
| `trimToWholeWeeks` after-period 30 days | 28 days; 13 days gives null |
| `minimumDetectableShift(77.4, 10, 10)` / `(77.4, 28, 56)` | 69.2 / 38.7 |
| Input order shuffled for `buildNights` | identical output |

### 8.6 Numbers and statements I could not verify

- Apple's own Apple Watch sleep-stage validation figures (kappa about 0.63) and any Apple minimum length for
  automatic sleep or naps; how the Health app assigns a sleep session to a day; the Apple Developer Forums description of how
  overlapping samples are reconciled (thread blocked by bot verification).
- Fitbit's rule for `isMainSleep` (only a forum reply says "longest log"), Fitbit's rule for splitting a log, and
  whether Fitbit log times carry an offset.
- Health Connect: how `SLEEP_DURATION_TOTAL` is attributed to a day for a session that crosses midnight.
- Oura's Sleep Day (6 pm to 6 pm) is from a search summary of the support article, which I could not fetch; the type
  definitions come from Oura's OpenAPI text as reproduced in generated SDKs.
- Numbers taken from abstracts or search summaries only [S]: Cappuccio 2008 and 2010, Jike 2018, Al Khatib 2017,
  Tasali 2022, Spiegel 1999 and 2004, Nedeltcheva 2010, Buxton 2010, Lee 2017, Kruisbrink 2017, Baglioni 2011, Scott 2021,
  Kredlow 2015, Chinoy 2021, Haghayegh 2019, the 2025 meta-analysis, the Apple Watch independent studies, Messman 2022
  (77.4 min), Ferracioli-Oda 2013, Windred 2024, the 2025 SRI software comparison (Czeisler et al.), and the textbook stage
  shares (N3 range varies between sources).
- The Consensus Sleep Diary item definitions (the article text did not load; TIB, SOL, WASO, TST, SE as defined in
  2.2 are consistent with NSF, Fitbit and Google definitions that I did read).
- The 85 percent efficiency threshold in CBT-I protocols; the 69 percent social jetlag prevalence; any social jetlag
  cut-off; the 41 to 65 night claim for measuring variability; no standard for hypnogram row order; no standard for
  "impossible" stage sequences; time-zone offset limits; the Intus design defaults marked [D].
- The effect of adding the 8th metric on false positives (34 percent) assumes independent tests; the real rate is
  lower because the rule also needs 0.5 SD.
