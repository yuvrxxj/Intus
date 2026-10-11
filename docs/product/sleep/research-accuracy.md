# Sleep tracker accuracy: research for the Intus sleep feature

Date of research: 2026-10-09. Prepared for the Intus principle "no score you cannot check": show numbers with their rules, never an opaque score, and say what the data cannot show.

## 0. Method, source labels, and what I could not verify

**Read this first.** In this environment I could not open any primary paper or manufacturer PDF. The egress proxy returned 403 for PubMed, PMC, doi.org, Crossref, Europe PMC, OpenAlex and apple.com, the fetch tool failed on DNS, and the Firecrawl scraper hit its free rate limit. Every number below therefore comes from search-tool summaries of abstracts, tables and snippets, not from my own reading of the full texts. I cross-checked across several retrievals where I could and I mark how far each figure can be trusted.

Confidence tags used in tables:

- **H**: the figure appeared in an abstract-level quote or in two or more separate retrievals.
- **M**: one retrieval of a table or text snippet from the paper itself.
- **L**: secondary source only (blog, trade press, vendor page, community forum), or retrievals conflicted.

Source-type tags:

- **[Ind]** independent academic study, no declared manufacturer funding that I could see.
- **[IndFund]** study funded by, or with authors paid by, a manufacturer (conflict of interest).
- **[Mfr]** manufacturer-published claim (white paper, blog, press release, Google Research page).
- **[Soc]** society statement or standard.
- **[Pre]** preprint, not peer reviewed.
- **[Sec]** secondary source (blog, trade press, forum).

Three general cautions that apply to every number:

1. **PSG is not a perfect truth.** Human experts scoring the same PSG agree on about 82.6% of epochs overall (N1 63.0%, N3 67.4%) per the [AASM inter-scorer reliability program](https://pubmed.ncbi.nlm.nih.gov/23319910/) (Rosenberg and Van Hout 2013, J Clin Sleep Med 9(1):81-87, H). A wrist device that agrees with PSG on 65 to 75% of four-stage epochs is therefore below, but not absurdly far from, the human ceiling.
2. **Version lag.** Most validation data describe older hardware and algorithms. A [2025 Sleep Advances letter](https://pmc.ncbi.nlm.nih.gov/articles/PMC12510450/) (doi 10.1093/sleepadvances/zpaf063, all authors Oura-affiliated, so [IndFund]-like for Oura) makes the same point and asks for device generation, firmware and algorithm version to be reported.
3. **Mostly single lab nights in healthy adults** (typically 20 to 60 people). Accuracy is worse in older adults, disrupted sleep, insomnia and sleep disorders (section 1.6).

---

## 1. Accuracy against polysomnography (PSG)

### 1.1 What nearly every study agrees on

- **Sleep is detected well, wake is not.** Epoch-by-epoch sleep sensitivity is about 0.93 to 0.97, wake specificity is only about 0.2 to 0.75. Examples: [Chinoy 2021](https://academic.oup.com/sleep/article/44/5/zsaa291/6055610) sensitivity at least 0.93, specificity 0.18 to 0.54 (H); [Schyvens 2025](https://academic.oup.com/sleepadvances/article/6/2/zpaf021/8090472) sensitivity above 90%, specificity 29.4 to 52.2% (H). A watch cannot tell lying awake and still from sleep, so wake is under-counted.
- **Consequence:** time asleep and sleep efficiency tend to be over-estimated and time awake under-estimated on restless nights. The size of this depends on device and person, and it can flip sign in older adults (section 1.2).
- **Stage labels are inferred**, not measured. The devices see movement and pulse (photoplethysmography), not brain waves. Light or core sleep is largely the residual category.
- **Four-stage agreement is moderate.** Kappa ranges from about 0.20 to 0.65 across devices and studies, with the highest numbers coming from manufacturer or manufacturer-funded work (table 1.3).

### 1.2 Per-metric summary

Bias is device minus PSG unless stated. "Spread" is limits of agreement (LoA) or mean absolute error (MAE), which is the more useful number for a single night.

| Metric | Bias direction and size | Spread on a single night | Evidence | Conf |
|---|---|---|---|---|
| **Total sleep time (TST)** | Pooled over 24 studies and 798 people: difference of 16.9 min (95% CI 7.4 to 26.3, I2 67.5%). The sign convention was not confirmed from the full text; the pattern that fits the sensitivity and specificity above is that devices overstate sleep. Healthy adults on modern wrist devices, one lab night: mean bias about -12 to +7 min. | MAE per night 22 to 31 min (Miller 2022: Whoop 3.0 30.3, Apple Watch S6 30.7, Oura Gen2 22.1). Fitbit Alta HR LoA about -42 to +47 min. Oura Gen3 in a clinical sample: mean +11.7 min but individual range -54 to +97.5 min. | [Lee YJ 2025 meta-analysis, J Clin Sleep Med](https://pubmed.ncbi.nlm.nih.gov/39484805/) doi 10.5664/jcsm.11460 [Ind]; [Miller 2022](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9412437/) doi 10.3390/s22166317 [Ind]; [Chinoy 2021](https://academic.oup.com/sleep/article/44/5/zsaa291/6055610) [Ind]; [Herberger 2025 Sci Rep](https://www.nature.com/articles/s41598-025-93774-z) doi 10.1038/s41598-025-93774-z [Ind] | H for pooled; M for per-device |
| TST, outlier devices | Garmin Fenix 5S about +44 min (LoA about -47 to +134, p<0.001, n=29). Garmin Forerunner 945 in suspected sleep-disorder patients: MAE about 85 min (about 25%). | Large | [Chinoy 2021](https://academic.oup.com/sleep/article/44/5/zsaa291/6055610); [Forerunner 945 and Polar Ignite study](https://pubmed.ncbi.nlm.nih.gov/36502241/) [Ind] | M (Fenix numbers came from one table snippet and a second retrieval gave different, probably other-metric, numbers) |
| TST, older adults | Direction flips: Fitbit Sense 2 about -74.5 min, Oura Gen3 about -75.5 min, in 19 adults aged 56 to 80. No significant bias in 13 adults aged 19 to 24. | Large | [Searles 2026, Sleep Advances 7(1):zpag006](https://academic.oup.com/sleepadvances/article/7/1/zpag006/8422777) [Ind], small sample, one night each | M |
| TST, Oura only | Pooled over 6 studies: -2.97 min (95% CI -10.27 to 4.33), not significant. | n/a | [Khan 2025, OTO Open](https://pmc.ncbi.nlm.nih.gov/articles/PMC12602993/) doi 10.1002/oto2.70181 [Ind] | M |
| **Sleep efficiency (SE)** | Pooled: 4.7 percentage points (95% CI 2.3 to 7.1), same sign caveat as TST. Wearables show "high proportional bias": SE is over-estimated when true SE is low (under about 85%) and compressed toward the top. | Wide on poor nights | [Lee YJ 2025](https://pubmed.ncbi.nlm.nih.gov/39484805/); [Lee T 2023, JMIR mHealth](https://mhealth.jmir.org/2023/1/e50983) doi 10.2196/50983 [Ind] | H pooled; L for the 85% threshold (a review cited by a summary) |
| **Sleep onset latency (SOL)** | Pooled: 2.6 min (95% CI 0.6 to 4.5). Fitbit subgroup 5.6 min (2.1 to 9.1), other brands not significant. 11-device study: wearables -2.7 min on average, Apple Watch 8 -0.8 min, nearables +29 min. Oura Gen3 ring: -3.2 min. | Oura individual range -34.5 to +32.5 min. Correlation with sleep diary SOL: r=0.03 (systematic review). | [Lee YJ 2025](https://pubmed.ncbi.nlm.nih.gov/39484805/); [Lee T 2023](https://mhealth.jmir.org/2023/1/e50983); [Herberger 2025](https://www.nature.com/articles/s41598-025-93774-z); [Srivali 2026 review, Sleep Med](https://pubmed.ncbi.nlm.nih.gov/41946254/) | M |
| **Wake after sleep onset (WASO)** | Pooled: 13.3 min (95% CI 4.5 to 22.0), sign unconfirmed; Fitbit subgroup not significant. Direction depends on device: a review reports under-estimation of 7 to 30 min, but Fitbit Charge 2 in shift workers over-estimated WASO by 37.1 min. | Very wide | [Lee YJ 2025](https://pubmed.ncbi.nlm.nih.gov/39484805/); [Stucky 2021, J Med Internet Res 23(10):e26476](https://www.jmir.org/2021/10/e26476) [Ind] | M |
| **Bedtime (detected sleep start) and wake time (detected sleep end)** | Small on average. Sleep-clinic patients: start error median -2.0 min (Fitbit) and 5 min (Withings, IQR -43 to 27); end error about 6 min for both. Healthy adults: detected bedtime later than reference by 8.6 min (SD 24.7, Oura) and 9.8 min (SD 24.0, Fitbit), MAE about 16 min. Fitbit Charge 2 in shift workers: onset and offset unbiased. | Some nights off by 30 to 40 min | [Frija 2025, J Sleep Res](https://onlinelibrary.wiley.com/doi/10.1111/jsr.14235) [Ind]; [Sleep Health 2024 smartphone-use study](https://www.sleephealthjournal.org/article/S2352-7218(24)00032-9/fulltext) (attribution of the Oura and Fitbit bedtime figures to this paper is inferred) [Ind]; [Stucky 2021](https://www.jmir.org/2021/10/e26476) | M |
| **Stages** | See 1.3 and 1.4. Typical pattern: light over-estimated and deep under-estimated by Apple Watch; Oura Gen3 close to PSG in group means in Oura-funded and one independent study; Whoop and Garmin weaker. | Individual stage minutes carry wide LoA | Multiple | M |

Note on bedtime: no study I found validated "time in bed" or "lights out" for wrist devices. What devices call bedtime is usually the detected start of sleep, so it lags true bedtime by the real sleep onset latency.

### 1.3 Four-stage agreement (kappa) by device

Kappa values are **not directly comparable across rows**: samples, nights, reference scorers, and algorithm versions differ. Use the table to see the range, not to rank products.

| Device (model as reported) | Study, N | Four-stage kappa | Other agreement | Type | Conf |
|---|---|---|---|---|---|
| Apple Watch S6 | [Miller 2022](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9412437/), 53 healthy adults, 1 night | 0.20 | Multi-state agreement 53%; sleep/wake agreement 88%, kappa 0.30 | Ind | H |
| Apple Watch S8 | [Schyvens 2025](https://academic.oup.com/sleepadvances/article/6/2/zpaf021/8090472), 62 adults, 1 night (6 devices, 2 to 4 each) | 0.53 (highest of the six) | Sleep sensitivity above 90%, wake specificity low | Ind | H |
| Apple Watch S8 | [Robbins 2024, Sensors](https://www.mdpi.com/1424-8220/24/20/6532) doi 10.3390/s24206532, 35 adults, 1 inpatient night | 0.60 | Stage sensitivities 50.5 to 86.1% (light 86.1, deep 50.5, REM 82.6); deep ICC 0.13, REM ICC 0.37 | **IndFund (Oura-funded; lead author consults for Oura)** | kappa L (Oura blog and secondary), sensitivities and minute biases M |
| Apple Watch (current stage classifier) | [Apple white paper, Oct 2025](https://www.apple.com/health/pdf/Estimating_Sleep_Stages_from_Apple_Watch_Oct_2025.pdf); earlier [Sept 2023 version](https://www.apple.com/mideast/healthcare/j/docs/site/Estimating_Sleep_Stages_from_Apple_Watch_Sept_2023.pdf). Design set 1,171 nights from 858 people; validation set 299 nights from 166 other people (Oct 2025 text). | 0.63 (SD 0.13) in the 2023 version. In the clinical PSG population (236 patients) kappa 0.55 and sleep sensitivity 97.5% (L). | Sleep sensitivity about 97.8% and specificity about 76% in 2023 figures. | **Mfr** | Mixed: see section 7, retrievals of the Oct 2025 headline numbers conflicted |
| Apple Watch 8 | [Lee T 2023](https://mhealth.jmir.org/2023/1/e50983), 11 devices, 349,114 epochs | Per-device kappa not retrieved (one secondary source says "fair", 0.2 to 0.4) | SOL bias -0.8 min | Ind | L for kappa |
| Oura Gen2 | [Miller 2022](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9412437/) | 0.43 | Sleep/wake agreement 89%, kappa 0.51 | Ind | H |
| Oura Gen3, algorithm OSSA 2.0 | [Svensson 2024, Sleep Med 115:251-263](https://pubmed.ncbi.nlm.nih.gov/38382312/), 96 Japanese adults, multi-night ambulatory PSG, 421,045 epochs | 0.65 overall | Sleep sensitivity 94.4 to 94.5%, wake specificity 73.0 to 74.6%, accuracy 91.7%. One-vs-rest accuracy: light 75.5, deep 88.6, REM 90.6 (inflated by true negatives). | Ind (funding not verified) | M; wake specificity conflicts with a later response letter that says about 48% |
| Oura Gen3 | Robbins 2024 (above) | 0.65 | Stage sensitivities 76.0 to 79.5%; group means for wake, light, deep, REM not different from PSG | **IndFund** | kappa L, rest M |
| Oura Gen3 (clinical sample) | [Herberger 2025](https://www.nature.com/articles/s41598-025-93774-z) | n/a | Four-stage accuracy 53.2%; sleep/wake accuracy about 85% | Ind; **Oura disputes the method** (says its API gives 5-minute stage blocks and the authors spread each across ten 30-second PSG epochs) | M; dispute L (Oura blog) |
| Oura Gen4 (Oura Ring 4, launched Oct 2024) | None found | none | none | none | I found no independent peer-reviewed Gen4 PSG study as of 2026-10-09. Claims of 95%+ agreement on ranking sites cite no study. |
| Fitbit Sense 2 | Robbins 2024 | 0.55 | Light over by 18 min, deep under by 15 min; stage sensitivities 61.7 to 78.0% | IndFund | kappa L |
| Fitbit Sense, Charge 5 | [Schyvens 2025](https://academic.oup.com/sleepadvances/article/6/2/zpaf021/8090472) | 0.42 and 0.41 | | Ind | H |
| Fitbit and Pixel (updated algorithm) | [Google Research page](https://research.google/pubs/performance-analysis-of-updated-sleep-tracking-algorithms-across-google-and-fitbit-wearable-devices/) | 0.63 (SD 0.12), up from 0.56 (SD 0.13) for the previous Fitbit algorithm; 50 held-out expert-scored nights; trained on over 3,000 free-living nights from 122 people | Accuracy 71% to 77% (secondary retrieval) | **Mfr** | M |
| Google Pixel Watch | [Lee T 2023](https://mhealth.jmir.org/2023/1/e50983) | Not retrieved | Best of the 11 devices for deep sleep (F1 0.593), Sense 2 next (0.556). Overall macro F1 across all 11 devices ranged 0.26 to 0.69. | Ind | M for deep F1 |
| Whoop (generation not stated, 2020) | [Miller 2020, J Sports Sci](https://pubmed.ncbi.nlm.nih.gov/32713257/), 12 adults, 86 sleeps | 0.47 | Four-state agreement 64%; sensitivity light 62%, deep 68%, REM 70%, wake 51%; sleep/wake agreement 89%, sleep sensitivity 95%, wake specificity 51%, kappa 0.49. Bed times were entered by researchers. | Ind (Whoop scored its own algorithm) | M |
| Whoop 3.0 | Miller 2022 | 0.44 | Sleep/wake agreement 86%, kappa 0.44 | Ind | H |
| Whoop 4.0 | Schyvens 2025, n=40 | 0.37 (SD 0.16) | Sensitivity about 94%, specificity about 40%; TST bias about -11 min | Ind | M |
| Whoop 5.0 and MG | None peer-reviewed found. Whoop cites a company-run University of Arizona comparison. | none | none | Mfr only | L |
| Garmin Forerunner 245 | Miller 2022 | 0.25 | Multi-state agreement 50%; sleep/wake agreement 89%, kappa 0.35 | Ind | H |
| Garmin Vivosmart 4 | Schyvens 2025; also [PLOS ONE study](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0243214) | 0.21 (lowest in Schyvens); 0.20 in PLOS ONE with sleep/wake kappa 0.33 | | Ind | H |
| Garmin Fenix 5S, Vivosmart 3 | Chinoy 2021 | n/a | Wake specificity 0.18 and 0.19 (lowest of seven); worse than research actigraphy | Ind | H |
| Garmin vivosmart 3 (older) | [Garmin's own study](https://www.garmin.com/en-US/blog/health/garmin-health-announces-sleep-study-results/), 55 people at home, reference was a Sleep Profiler EEG device, not PSG | 0.54 (SD 0.12) | Accuracy 69.7%, sleep sensitivity 95.8%, wake specificity 73.4% | **Mfr** | M |
| Garmin Vivoactive and Venu 3 | [Beyond the Hype preprint](https://sciety.org/articles/activity/10.31234/osf.io/27wun_v1) (doi 10.31234/osf.io/27wun_v1), ambulatory PSG | 0.41 | Agreement 63.4% (same preprint: Fitbit Charge 6 66.2%, kappa 0.47; Whoop 4 65.2%, kappa 0.48; Circul+ 55.6%, kappa 0.33; Oura and Apple S9 figures cut off in my retrieval) | **Pre**; lead author runs a channel with Oura and Whoop affiliate links | L |
| Samsung Galaxy Watch 3 | [Kim 2023, J Sleep Med](https://www.e-jsm.org/journal/view.php?doi=10.13078%2Fjsm.230004) doi 10.13078/jsm.230004, 32 healthy adults | Not retrieved (a secondary source gives 0.47 for a two-class task) | TST +9.5 min, ICC 0.64; sleep sensitivity 0.954, wake specificity 0.524; four-stage accuracy 0.651; sensitivity light 0.695, deep 0.612, REM 0.598; REM duration not reliably estimated | Ind | M |
| Samsung Galaxy Watch 5 | Lee T 2023 | Not retrieved | | Ind | none |
| Samsung Galaxy Watch 6 to 8, Galaxy Ring | None found | none | none | none | I found no independent PSG validation. A 2025 PLOS ONE paper on a different brand says Samsung devices have largely not been independently validated. |
| Walch et al. research classifier on Apple Watch raw data | [Walch 2019, Sleep 42(12):zsz180](https://academic.oup.com/sleep/article/42/12/zsz180/5549536) doi 10.1093/sleep/zsz180, 31 people, dataset doi 10.13026/hmhs-py35 | Not retrieved for the main model; sleep/wake kappa 0.525 in the MESA test cohort | Sleep/wake accuracy about 90%, sleep sensitivity 93%, wake specificity 59.6%; three-class (wake, NREM, REM) accuracy about 72% | Ind (University of Michigan) | H for the abstract figures |

**Important about Walch 2019:** it is a research model run on raw Apple Watch accelerometer and heart rate data, not Apple's own stage classifier (which did not exist until watchOS 9 in 2022). It is evidence that wrist motion plus pulse can stage sleep at about 72% three-class accuracy, nothing more.

### 1.4 Device-by-device notes

**Apple Watch (watchOS 9 onward).**
- Apple's own document is the only source for the current classifier at scale. Core is defined as N1 plus N2, deep as N3, per the Oct 2025 PDF (H). It says the stages are not intended for clinical use (L, from a retrieved summary).
- Independent stage tests after watchOS 9 that I found: Series 8 in Robbins 2024 (Oura-funded), Series 8 in Schyvens 2025, Apple Watch 8 in Lee 2023, and the Series 9 preprint. I found **no independent peer-reviewed study of Series 9, 10 or 11, or of the watchOS 26 / foundation-model update** that Apple's October 2025 document describes.
- Robbins 2024 pattern (n=35): Apple Watch under-counted wake by 7 min (p<0.01), under-counted deep by 43 min (p<0.001), over-counted light by 45 min (p<0.001). Schyvens 2025 had it as the best of six on kappa (0.53) and best at identifying wake epochs.
- A [living systematic review of Apple Watch accuracy](https://www.nature.com/articles/s41746-025-02238-1) (Lambe et al., npj Digit Med 2026, doi 10.1038/s41746-025-02238-1, 82 studies) calls sleep accuracy "moderate", sleep/wake classification at or above 97%, and deep sleep often mislabelled as light (L, from a search summary).
- Apple's **Sleep Score** (watchOS 26, September 2025) is a 0 to 100 number reported to weight duration up to 50 points, bedtime up to 30, interruptions up to 20; the point weights come from press coverage and Apple has not published the exact curves ([AppleInsider](https://appleinsider.com/articles/25/09/12/how-sleep-score-works-on-apple-watch-with-watchos-26), L). It is an example of the kind of score Intus has decided not to build.

**Fitbit and Pixel Watch.**
- Fitbit Alta HR (Chinoy 2021) had the best light (sensitivity 0.76) and REM (0.69) epoch agreement of the seven devices, TST bias about +2.6 min with LoA about -42 to +47 (M).
- Fitbit Sense 2 over-counts light and under-counts deep (Robbins 2024). Sense and Charge 5 reached kappa 0.42 and 0.41 (Schyvens 2025). Fitbit's SOL bias is slightly larger than other brands in the meta-analysis (5.6 min).
- Pixel Watch: the only independent PSG data I found is the 11-device Lee 2023 study, where it led on deep sleep. There is **no dedicated independent Pixel Watch 2, 3 or 4 validation** I could find. Google's own number is the 0.56 to 0.63 kappa improvement over the old Fitbit algorithm, which is a comparison with a prior algorithm, not an independent PSG result.
- Fitbit Charge 2 in 59 to 62 shift workers: TST and sleep onset and offset unbiased, WASO over by 37.1 min, REM latency over by 29.4 min, wide LoA, epoch accuracy 0.82 for wake and 0.86 for REM but 0.55 for N1+N2.

**Oura (Gen3 and Gen4).**
- The best independent data are Svensson 2024 (96 people, multi-night, kappa 0.65, group TST not different from PSG) and the Khan 2025 meta-analysis (TST -2.97 min). The Oura-funded Robbins 2024 agrees. Herberger 2025 (clinical sample, 4-stage accuracy 53.2%) disagrees, and Oura contests its method.
- Honest reading: on healthy adults the Gen3 ring looks as good as or better than other wearables on group means; on an individual night it is still plus or minus an hour for TST in some people, and stage minutes are estimates.
- **Gen4:** nothing independent. A June 2023 algorithm update (OSSA 2.0) is reported by Oura as reaching 79% four-stage agreement ([Oura blog, Mfr](https://ouraring.com/blog/new-sleep-staging-algorithm/)). The date and the size of the step change in users' deep sleep come from one personal Substack post and are L.
- Oura Gen2 on adolescents ([Nat Sci Sleep 2021, doi 10.2147/NSS.S286070](https://www.tandfonline.com/doi/full/10.2147/NSS.S286070)): REM under by 12.8 to 19.5 min, light under by 51 to 81 min, N3 over by 31.5 to 46.8 min (L, secondary summary).

**Garmin.** Consistently the weakest on independent tests (lowest wake specificity in Chinoy, lowest kappa in Schyvens, large TST over-estimates in a patient sample). Its own 2019 study used an EEG headband as reference on an older device.

**Whoop.** Reasonable sleep/wake agreement (86 to 89%), four-stage kappa 0.37 to 0.47 across three independent studies. No independent data on 5.0 or MG.

**Samsung.** Only Galaxy Watch 3 has a real PSG paper (n=32, accuracy 0.651, REM unreliable). Newer watches and the ring are unvalidated by anything I could find.

### 1.5 Multi-device and later comparisons

| Study | Design | Devices | Key results | Type |
|---|---|---|---|---|
| [Chinoy 2021, Sleep 44(5):zsaa291](https://academic.oup.com/sleep/article/44/5/zsaa291/6055610) doi 10.1093/sleep/zsaa291 | 34 healthy adults (22 women, 28.1 +/- 3.9 y), 3 nights including a disrupted-sleep night, PSG, with Actiwatch 2 as a comparator; data collected 2017 to 2019 | 4 wearables: Fatigue Science Readiband, Fitbit Alta HR, Garmin Fenix 5S, Garmin Vivosmart 3; 3 nearables: EarlySense Live, ResMed S+, SleepScore Max. **No Apple, Oura, Whoop or Samsung.** | Epoch sleep sensitivity at least 0.93, wake specificity 0.18 to 0.54. All but the Garmin devices did as well as or better than actigraphy on sleep/wake. Stages: most devices missed 30 to 50% of deep and REM. Worse on poorer or disrupted nights. | Ind, H |
| [Chinoy 2022, Nat Sci Sleep](https://pubmed.ncbi.nlm.nih.gov/35345630/) doi 10.2147/NSS.S348795 | 21 healthy young adults, unrestricted home sleep | Four wearables (the sister daytime paper names Fatigue Science, Fitbit, Oura, Polar) | Summary sleep metrics accurate on most nights, best on high-efficiency nights; better at sleep than wake; stage tracking mixed. Reference was research actigraphy plus sleep log, not PSG (as described by the daytime paper). | Ind, M |
| [Miller 2022, Sensors](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9412437/) | 53 adults (26 F, 25.4 +/- 5.9 y), one 9-hour lab night, PSG and ECG | Apple Watch S6, Garmin Forerunner 245 Music, Polar Vantage V, Oura Gen2, Whoop 3.0, Somfit | Sleep/wake kappa: Apple 0.30, Garmin 0.35, Polar 0.44, Whoop 0.44, Somfit 0.48, Oura 0.51. Multi-state kappa: Apple 0.20, Garmin 0.25, Polar 0.28, Oura 0.43, Whoop 0.44, Somfit 0.52. TST bias: Whoop -12.2, Apple -10.8, Oura -9.8 min. | Ind, H for kappa, L for TST bias |
| [Lee T 2023, JMIR mHealth](https://mhealth.jmir.org/2023/1/e50983) | Two-site Korean study, 349,114 epochs, PSG | 5 wearables (Pixel Watch, Galaxy Watch 5, Fitbit Sense 2, Apple Watch 8, Oura Ring 3), 3 nearables, 3 airables (phone apps) | Macro F1 0.26 to 0.69 across devices. Wearables: high proportional bias for sleep efficiency. Oura and SleepRoutine showed no proportional bias on any measure. Pixel Watch and Sense 2 best for deep sleep. | Ind, M |
| [Schyvens 2025, Sleep Advances 6(2):zpaf021](https://academic.oup.com/sleepadvances/article/6/2/zpaf021/8090472) doi 10.1093/sleepadvances/zpaf021 | 62 adults (52 M, 46.0 +/- 12.6 y), one lab night, AASM scoring by one technician | Fitbit Charge 5, Fitbit Sense, Withings ScanWatch, Garmin Vivosmart 4, Whoop 4.0, Apple Watch S8 | Kappa 0.21 to 0.53; sleep sensitivity above 90%, wake specificity 29.4 to 52.2%; most devices differed significantly from PSG on TST, SE, WASO and light sleep; all identified deep and REM epochs better than wake and light. **No Oura, Samsung or Pixel.** | Ind, H |
| Robbins 2024 | See table 1.3 | Oura Gen3, Fitbit Sense 2, Apple Watch S8 | Sleep sensitivity at least 95% for all (Apple 97%); see 1.3 | **IndFund** |
| [Lee YJ 2025, J Clin Sleep Med](https://pubmed.ncbi.nlm.nih.gov/39484805/) | Meta-analysis, 24 studies, 798 people, searched to March 2024 | Fitbit, Jawbone, Whoop, Garmin, Apple Watch, Xiaomi and others | See 1.2. Authors conclude wrist devices are "not as reliable as PSG". | Ind |
| [Searles 2026, Sleep Advances](https://academic.oup.com/sleepadvances/article/7/1/zpag006/8422777) | 13 young and 19 older adults, one night | Fitbit Sense 2, Oura, Withings mat, SleepScore Max | Young: TST not different from PSG. Older: all but Withings under-estimated TST (about -75 min for the two wearables). Oura had 24.3% of nights missing in older adults vs 14.3% in young (not significant). | Ind, M |
| [CHEST rapid review of real-world use](https://www.sciencedirect.com/science/article/abs/pii/S0012369225056739) | 29 ambulatory studies | Mixed | Moderate accuracy for TST and time in bed; lower precision for SE, WASO and stages (via a Sleep Advances editorial summary). | Ind, L |
| [Beyond the Hype preprint](https://sciety.org/articles/activity/10.31234/osf.io/27wun_v1) | Home ambulatory PSG, 8 devices | Polar, Oura Ring 3, Apple Watch S9, Fitbit Charge 6, Garmin, Whoop 4, Circul+ | See 1.3 | **Pre**, L |

### 1.6 What changes accuracy (matters for Intus users)

- **Disrupted or low-efficiency nights**: errors are larger and more biased (Chinoy 2021; Chinoy 2022; proportional bias in Lee 2023).
- **Older adults**: big under-estimation of TST (Searles 2026); the World Sleep Society recommendations advise caution in older age or fragmented sleep (L, via secondary summaries).
- **Insomnia and sleep disorders**: agreement with PSG and with the person's own report is worse. A 2026 systematic review found device-to-diary concordance of 82.4% in good sleepers versus 39.4% in people with insomnia ([Srivali 2026](https://pubmed.ncbi.nlm.nih.gov/41946254/), 5 studies, 2,006 people, M).
- **Daytime and short sleep**: see section 5.
- **Skin tone, obesity, wear tightness** can affect the pulse signal; the SRS white paper flags this ([de Zambotti 2024](https://academic.oup.com/sleep/article/47/4/zsad325/7501518), L).

---

## 2. How much do devices disagree with each other on the same night?

**Direct evidence is thin.** I found no large peer-reviewed study in which one person wore Apple Watch, Oura, Fitbit, Whoop and Garmin on the same nights and the devices were compared with each other. The nearest things are the multi-device PSG studies in section 1.5 (each device compared with PSG, not with each other), and non-peer-reviewed analyses.

What can be inferred, with the inference labelled:

- **Total sleep time.** Each device has a per-night absolute error of roughly 20 to 30 min against PSG (Miller 2022) and the errors are not the same sign for every device. Inference: two devices on the same night will typically differ by about 15 to 40 min on TST, with occasional gaps of an hour or more.
- **A vendor analysis (not peer reviewed):** [Terra](https://tryterra.co/research/WHOOP-Sleep-Tracking-Comparison) compared 42 nights of Oura and Whoop: median TST gap 16.6 min, mean gap 45.2 min, Whoop recorded more sleep on 57.1% of nights, per-user averages from 7.2 to 86.4 min (L, vendor blog).
- **Stage minutes disagree far more than TST.** In Robbins 2024, Apple Watch was 45 min above and 43 min below PSG for light and deep, while Oura was not significantly different, so an Apple user and an Oura user with the same night could differ by roughly 40 min or more on deep sleep (inference from a single Oura-funded study). Whoop was reported to over-count REM by about 21 min in a systematic review summary (L).
- **Definitions differ**: when sleep "starts" (first epoch vs sustained), what counts as awake in bed, the minimum length of a session, whether naps are merged, and stage resolution (Oura's API reports 5-minute stage blocks per its own blog; PSG uses 30-second epochs).
- **Algorithms change over time**, so the same device disagrees with its own past. Examples: Apple added stages in watchOS 9 (2022) and updated the model in 2024 and 2025 (Apple PDF); Oura's OSSA 2.0 in 2023 (one user reports deep sleep dropped and did not return, L); Google/Fitbit updated algorithms with a kappa shift from 0.56 to 0.63 (Mfr). A Fitbit-only study of 1,041 adults found sleep time reliability is a property of the algorithm, not proof of accuracy ([Lau 2022](https://academic.oup.com/sleepadvances/article/3/1/zpac026/6679532)).

**What this means for a user who changes device, or whose phone merges several sources**

1. A switch creates a **step change** in baselines. A shift of 10 to 30 min in TST, and larger in light/deep/REM, can appear on the day of the switch with no change in the person.
2. The direction and size of the shift is not predictable from the brand name. The error depends on the person (age, restlessness), the night, and the firmware. Do not apply a "correction factor" between brands.
3. If the phone merges sources (for example Apple Health combining Apple Watch and an app that writes sleep), the user may see a different source win on different nights, so the **series itself changes source silently**. See section 5.
4. Only an overlap period (a couple of weeks wearing both) would let a user calibrate old against new, and even then only for that person and period.

---

## 3. What is reliable for a person's own trend over weeks

**Honest caveat first:** I found **no study that directly tests whether a consumer tracker's within-person change (for example after sleep extension, restriction or an intervention) matches PSG's change**. The ratings below are my judgement from three kinds of indirect evidence: size of mean bias versus size of night-to-night variation, test-retest style reliability of the device's own numbers ([Lau 2022](https://academic.oup.com/sleepadvances/article/3/1/zpac026/6679532)), and known proportional bias. They are inference, not validated change detection.

The Lau 2022 study (Fitbit, 107,144 nights, 1,041 working adults aged 21 to 40, [Sleep Advances 3(1):zpac026](https://academic.oup.com/sleepadvances/article/3/1/zpac026/6679532)) measures consistency, not accuracy: to reach "good" (ICC 0.60) and "very good" (ICC 0.80) reliability of the mean you need 3 and 5 nights for a weekly TST mean, 5 and 10 nights for a monthly TST mean, and for night-to-night variability 5 and 6 nights (week) or 11 and 18 nights (month). Variability is the hungriest metric. A 7-night average also cuts random night error by roughly 60% if errors are independent (arithmetic, my inference), but it does nothing about a constant bias, which only cancels in a before-after comparison on the same device and firmware.

| Metric | Reliability for own trend | Evidence and reasoning |
|---|---|---|
| Wake-up time, detected sleep end | **Robust** (same source) | Mean error about 6 min, MAE about 16 min versus normal day-to-day swings of tens of minutes or more (Frija 2025; Sleep Health 2024). Inference for trend use. |
| Sleep midpoint, bedtime (detected sleep start) | **Robust to usable with caveats** | Detected start lags true bedtime by true latency; error mean 2 to 10 min, SD about 24 min on a night. Fine for weekly averages. |
| Regularity (spread of bedtime or midpoint) | **Usable with caveats** | Per-night timing noise of about 15 to 25 min inflates apparent variability; needs 11 to 18 nights a month for stable variability (Lau 2022). No PSG validation of wearable regularity indices found. |
| Time asleep (TST), 7-night or 14-night median, one source | **Usable with caveats** | Mean bias small in healthy adults, but per-night MAE 22 to 31 min, pooled bias about 17 min, sign changes in older adults (-75 min), and proportional bias compresses real changes. Trust changes of 30 to 45 min or more that persist for two weeks; do not read meaning into 10 min. Same-source only. |
| Nights with data (coverage) | **Robust** | A fact about the data; but missingness is non-random (about 30% of nights missing in one low-resource cohort; 4.8% rising to 23.6% across a year in an actigraphy cohort; 24% in older Oura users), so it matters. |
| Sleep efficiency | **Fragile** | Over-estimated on poor nights, compressed range; needs in-bed time which Apple stopped recording on Apple Watch from watchOS 11 (section 5). |
| Sleep onset latency | **Fragile** | Correlation with diary r=0.03; individual errors up to +/-35 min; definition varies by vendor. |
| WASO, awakenings, time awake | **Fragile** | Wake specificity 0.18 to 0.75; direction of error differs by device (Garmin misses wake; Fitbit Charge 2 over-counts). |
| Deep sleep minutes | **Fragile** (usable only as a long-run median on one device) | Kappa 0.2 to 0.65; Apple under by 43 min; big dependence on algorithm version; physiology (e.g. HRV) can look like an algorithm change (Oura blog). Schyvens authors say higher-kappa devices could track "prolonged, significant changes in sleep architecture", a claim about large changes, not tested. |
| REM minutes | **Fragile** | Whoop over by about 21 min (L); Galaxy Watch 3 REM duration not reliable; Oura Gen2 under by 13 to 20 min in adolescents. |
| Light or core minutes | **Fragile** | Residual category, driven by errors in wake and deep (Apple +45 min). |
| Naps and second sleep blocks | **Fragile** | Missed episode rates 3.6% to 37.3% by device, short naps worst (Chinoy 2023, section 5). |
| Any composite "sleep score" | **Not checkable** | Hidden weights (Apple Sleep Score weights come from press, not Apple documentation). Outside Intus principles. |

---

## 4. Official guidance, orthosomnia evidence, and what responsible products say

### 4.1 Society and standards statements

| Statement | Key points (as I could retrieve them; full texts not opened) | Type |
|---|---|---|
| [AASM position statement on consumer sleep technology, 2018](https://doi.org/10.5664/jcsm.7128) (Khosla et al., J Clin Sleep Med 14(5):877-880) | Consumer sleep technology has not been validated against PSG and is not a substitute for medical evaluation. Should not be used to diagnose or treat sleep disorders unless cleared by the FDA. May raise awareness of sleep and support conversation between patient and clinician within an appropriate clinical evaluation. Clinicians should be ready to discuss patient-generated data. Related AASM page: [consumer sleep technology is no substitute for medical evaluation](https://aasm.org/consumer-sleep-technology-position-statement/). | Soc |
| [AASM update, 2021](https://doi.org/10.5664/jcsm.9580) (J Clin Sleep Med 17(11):2275-2282, Schutte-Rodin et al.) | Reviews validation methods and key statistics; notes that development and validation of many products is undisclosed or unpublished; discusses OSA-detecting wearables. | Soc |
| [AASM health advisory on self-assessing sleep apnea with consumer devices](https://aasm.org/clinical-resources/emerging-technology/) | Cautions against consumer devices for self-assessing sleep apnea risk. I did not retrieve the date. | Soc |
| [SRS white paper: de Zambotti et al., Sleep 47(4):zsad325](https://academic.oup.com/sleep/article/47/4/zsad325/7501518) (doi 10.1093/sleep/zsad325, 2024) | Match device to study aim; check raw-data access and algorithm transparency; validate against PSG when stages matter; test in real-world conditions; "research grade" is not a substitute for performance testing; equity concerns for skin tone and body size. | Soc |
| [World Sleep Society task force, Chee et al., Sleep Med 131:106506](https://www.sciencedirect.com/science/article/abs/pii/S138994572500173X) (doi 10.1016/j.sleep.2025.106506, 2025) | Guidance for consumers, clinicians, researchers and manufacturers. Useful for long-term sleep health monitoring in healthy adults. Proposes standardised "fundamental sleep measurements" (total sleep time, sleep latency, sleep efficiency). Caution for older age, fragmented sleep and time zone changes. | Soc |
| [National Sleep Foundation position statement, Dzierzewski et al., Sleep Health 12(2):380-385](https://pubmed.ncbi.nlm.nih.gov/41792005/) (doi 10.1016/j.sleh.2026.02.003, 2026) | Consumer products only. Supports appropriate use of evidence-based consumer technology and independent performance evaluation consistent with the ANSI/CTA/NSF-2052 series. NSF also launched a SleepMark designation. | Soc |
| [ANSI/CTA/NSF-2052.3 performance criteria](https://www.thensf.org/wp-content/uploads/2025/03/ANSI-CTA-NSF-2052.3-FINAL.pdf) and 2052.1 definitions, 2052.2 methods | Voluntary standard defining elemental sleep measures and how to test them against PSG. I did not retrieve the numeric thresholds. | Soc |
| [Sleep Advances 2026 editorial, Scott, Grandner, Cellini](https://pubmed.ncbi.nlm.nih.gov/42327922/) (doi 10.1093/sleepadvances/zpag053) | Accuracy belongs to a device used in a particular population, setting and method, not to a brand. | Editorial |

**No society statement I found endorses stage-level or score-level interpretation for individuals.** The consistent line is: fine for self-awareness and long-run patterns in healthy adults, not for diagnosis, and not a replacement for a clinician when sleep problems persist.

### 4.2 Orthosomnia and anxiety caused by trackers

| Study | Design | Finding | Caveat |
|---|---|---|---|
| [Baron et al. 2017, J Clin Sleep Med 13(2):351-354](https://pubmed.ncbi.nlm.nih.gov/27855740/) doi 10.5664/jcsm.6472 | Clinical case series | Patients sought treatment for self-diagnosed insomnia or short sleep from tracker data; some trusted the device over clinical testing and chased "perfect" sleep. Coined "orthosomnia". | Few patients; not an established diagnosis. |
| [Gavriloff et al. 2018, J Sleep Res](https://pubmed.ncbi.nlm.nih.gov/29989248/) doi 10.1111/jsr.12726 | Randomised, 63 people with insomnia, **sham** actigraphy feedback | Told they slept poorly (n=32): worse evening alert cognition (d=0.79) and more sleepiness or fatigue (d=0.55) than those told they slept well (n=31). | Insomnia sample; feedback was fabricated. |
| [Robson et al. 2022 pilot](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10899903/) | Randomised, 54 healthy sleepers, false good or poor numeric sleep score | No difference in pre-sleep cognitive arousal or subjective sleep continuity. | Small pilot; effect may depend on population. |
| [Jahrami et al. 2024, Brain Sci 14(11):1123](https://www.mdpi.com/2076-3425/14/11/1123) | Cross-sectional, 523 adults | 35.8% used trackers; estimated orthosomnia prevalence 3 to 14% depending on definition; cases had higher insomnia scores. | Cross-sectional; association only. |
| [Bergen Orthosomnia Scale, Frontiers in Sleep 2025](https://www.frontiersin.org/journals/sleep/articles/10.3389/frsle.2025.1640355/pdf) doi 10.3389/frsle.2025.1640355 | Scale development | Orthosomnia factors correlate with health anxiety, perfectionism, sleep effort; both positive and negative effects of tracking exist. | Correlational. |
| [SLEEP 2026 abstract (Suppl 1, A246)](https://academic.oup.com/sleep/article/49/Supplement_1/A246/8674102) | National survey, conference abstract | More than 30% of US adult trackers screen positive on an adapted orthosomnia measure. | Abstract only, adapted measure; L. |
| [NITE trial, Sleep 46(9):zsad167, 2023](https://academic.oup.com/sleep/article/46/9/zsad167/7193149) | Randomised, 113 adults with insomnia symptoms, 5 weeks | Wearable feedback **with guidance on interpreting it** modestly improved insomnia severity versus sleep education, without changing sleep-state discrepancy. | Modest effect, single-blind. |
| [Ojalvo et al. 2023, J Sleep Res](https://pubmed.ncbi.nlm.nih.gov/36966819/) | 27 insomnia patients, Fitbit plus diary vs diary | No clear evidence that wearables cause orthosomnia. | Small. |

**Reading of the evidence:** harm is plausible and documented in vulnerable groups (insomnia, perfectionism, health anxiety), mostly from cross-sectional and qualitative work plus one sham-feedback experiment. I found **no randomised trial showing that tracking causes insomnia in the general population**, and some evidence that guided, contextualised feedback helps. The design implication is not "hide data" but "avoid verdicts, add context, make it easy to look away".

### 4.3 What responsible products do in their wording

From the retrieved material (several items L):

- Say what is measured (movement, pulse) and call stage splits **estimates**. Apple's validation document states the stages are not intended for clinical use. Oura treats unconfirmed naps as "rest periods" that do not change its sleep or readiness scores ([Oura](https://ouraring.com/blog/nap_detection/), L). Google's help pages describe sleep as detected when the body is still for about an hour and say stage data needs a minimum amount of sleep ([Google Health help](https://support.google.com/fitbit/answer/14236407?hl=en), L).
- State **definitions**: Fitbit time asleep is tracked time minus awake and restless time; Garmin treats sleep shorter than 3 hours as a nap ([Garmin blog](https://www.garmin.com/en-US/blog/fitness/how-garmin-watches-track-your-sleep-calculate-sleep-score/), L).
- Do not diagnose; refer persistent problems to a clinician (AASM line).
- Report fundamental measures in a standard way (World Sleep Society, ANSI/CTA/NSF-2052).
- Weakness in the market: single-night scores with hidden weights (Apple Sleep Score, Fitbit and Oura sleep scores) are the norm. Intus's rule-first approach is the unusual and defensible choice.

---

## 5. Sources of error when ingesting from Apple Health and Health Connect

### 5.1 Data models

**Apple HealthKit.** `HKCategoryValueSleepAnalysis` has `inBed` (0), `asleepUnspecified` (1, replaced the old `asleep`), `awake` (2), `asleepCore` (3), `asleepDeep` (4), `asleepREM` (5). Stages were added in iOS 16 ([WWDC22 session 10005](https://developer.apple.com/videos/play/wwdc2022-10005), [enum reference](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis)). Each sample holds one value; "in bed and asleep" is expressed with overlapping samples. A developer pitfall: summing only the stage categories misses `asleepUnspecified` samples ([forum thread](https://developer.apple.com/forums/thread/745369)); use the all-asleep values ([thread](https://developer.apple.com/forums/thread/725166)). Stage data is written after waking, not in real time. An Apple developer-relations reply says Apple Watch stopped writing `inBed` samples in watchOS 11 / iOS 18 ([thread](https://developer.apple.com/forums/thread/766977), M).

**Android Health Connect.** `SleepSessionRecord` with optional stages. Jetpack stage names from my knowledge: unknown, awake, sleeping, out of bed, light, deep, REM, awake in bed ([reference](https://developer.android.com/reference/androidx/health/connect/client/records/SleepSessionRecord.Stage); I only confirmed part of the list in retrieved snippets: sleeping, awake, awake in bed, out of bed, and light, deep, REM from the sleep guide). Stage intervals must lie inside the session, may have gaps, should not overlap ([sleep sessions guide](https://developer.android.com/health-and-fitness/health-connect/features/sleep-sessions)). `SLEEP_DURATION_TOTAL` is an aggregate; aggregate reads de-duplicate and keep only the highest-priority app, and only the user can set that priority for Sleep and Activity ([aggregate docs](https://developer.android.com/health-and-fitness/health-connect/aggregate-data)). Raw reads do not de-duplicate (inference from docs and bug reports, below).

### 5.2 Error sources and what Intus should do

| Situation | What goes wrong | Evidence | Suggested handling |
|---|---|---|---|
| **Naps** | Short naps are missed or merged into the night. Chinoy 2023 (daytime sleep, four devices, home): missed episodes Fatigue Science 3.6%, Fitbit 4.8%, Oura 6.0%, Polar 37.3%; misses concentrated in naps under 4 hours; Fitbit's earlier "over 1 hour" rule matched missed short naps. Garmin Forerunner 945 detected no daytime sleep in a daytime sleep latency test. Vendor thresholds: Oura detects naps of 15 min to 3 h; Fitbit/Google says naps of at least 20 min; Garmin calls sleep under 3 h a nap; Apple Watch gained automatic nap detection in watchOS 11 per beta reports ([MacRumors](https://www.macrumors.com/2024/06/17/watchos-11-supports-automatic-nap-detection/), L) and earlier only recorded in Sleep Focus. | [Chinoy 2023, doi 10.2147/NSS.S395732](https://www.tandfonline.com/doi/full/10.2147/NSS.S395732) (M); [Oura support](https://support.ouraring.com/hc/en-us/articles/1500009653181-Nap-Detection); [Google help](https://support.google.com/fitbit/answer/14236407?hl=en) | Keep "main sleep" and "other sleep" as separate lines. Do not add naps into the night total by default. Say "naps under 20 minutes are often missed". Let the user choose whether to include naps in daily total. |
| **People who sleep in two blocks** | A noon-to-noon window or "longest block is the night" rule assigns the second block to the wrong day, or drops it. Each vendor has its own gap rule. No validation study of split sleep on wrist devices found. | Vendor rules above | Group by sleep session using a gap threshold the user can see; show per-session durations and a day total; label "2 sessions"; anchor to the wake-up date. Never silently discard a block. |
| **Shift workers** | Sleep falls in daytime; schedule-based detection (Apple Sleep Focus, Garmin sleep window) and noon-to-noon windows break. Fitbit Charge 2 in shift workers: TST and onset/offset unbiased but wide LoA, WASO +37 min. Daytime sleep is harder to detect (above). Travel across time zones disrupts timing (World Sleep Society). | [Stucky 2021](https://www.jmir.org/2021/10/e26476) (M) | Do not assume a night window. Store the time zone offset with each record and group by session. Show a plain note: "Device accuracy for daytime sleep and shift work is not well tested". |
| **Device not worn, charging, or not synced** | Missing nights read as zero or as "short sleep". Missingness is non-random. About 30% of nights missing in one low-resource fitness-tracker cohort; actigraphy non-wear rose from 4.8% in week 1 to 23.6% at month 12; Oura 24.3% missing in older adults vs 14.3% in young. Charging gaps and forgetting the device are common causes. | [JMIR mHealth 2026 missingness paper](https://mhealth.jmir.org/2026/1/e81123) (M); [Lau 2022](https://academic.oup.com/sleepadvances/article/3/1/zpac026/6679532); [Searles 2026](https://academic.oup.com/sleepadvances/article/7/1/zpag006/8422777) | No record is "no data", never zero. Show nights-with-data next to every average and suppress averages below a threshold (for example fewer than 5 of the last 7 nights). |
| **In bed vs asleep** | Sleep efficiency and time-in-bed need in-bed time. Apple Watch stopped writing `inBed` in watchOS 11; the iPhone writes in-bed from its sleep schedule only, with no stages (secondary). Health Connect has "awake in bed" and "out of bed" stages but many apps omit them. Vendors define asleep differently (Fitbit excludes restless time). | [Apple developer forum thread on inBed in iOS 18](https://developer.apple.com/forums/thread/766977) (M); [Fitbit/Google help on time asleep](https://support.google.com/fitbit/answer/14236407?hl=en) (L) | Compute "time asleep" from asleep values only. Only show sleep efficiency when the same source supplied in-bed or awake-in-bed. Otherwise name it "time awake between first and last sleep" and label it as such. |
| **Devices or apps that report only duration** | A single "asleep unspecified" or "sleeping" block with no stages, or a manual entry. | HealthKit `asleepUnspecified`; Health Connect `sleeping` stage; Samsung, Garmin and others vary in what they write | Keep a "stages available" flag per night. Never infer stage splits. Compute stage percentages only over nights that have stages, and say how many. Keep manual entries labelled as "entered by you". |
| **Merging overlapping records from several sources** | Two watches, or watch plus app, write overlapping sessions. Summing doubles the night. Apple Health picks one source per data type by a user-editable priority list (Sleep, then Data Sources & Access); newly added apps may go to the top; community reports say the priority is not always respected and duplicates appear (L). Health Connect aggregates de-duplicate by user priority; raw reads give every record. One report: an app writing each stage as its own `SleepSessionRecord` ([carp-health-flutter issue 526](https://github.com/carp-dk/carp-health-flutter/issues/526)); another app kept only the last session from a 24-hour window and lost others ([nutritrace issue 236](https://github.com/TraceApps/nutritrace/issues/236)) (L, bug reports). My understanding, not verified from Apple documentation, is that a custom HealthKit query on a category type returns samples from every source without dedupe. | [Apple Community threads](https://discussions.apple.com/thread/255034697) (L); [Health Connect aggregate docs](https://developer.android.com/health-and-fitness/health-connect/aggregate-data) (H) | Store each source's sessions raw with source id, device, app version and time zone. Choose one primary source per night by a visible rule (user priority, else most detailed staging). **Never sum across sources.** Take presence from the union but duration from the primary. Show other sources' totals as a small "also recorded" line, and flag nights where they differ by more than about 30 to 60 min. Keep the choice reversible so a changed priority can re-resolve history. |
| **Late edits, delayed syncs, algorithm re-analysis** | Stages arrive after waking; vendors can re-process a night; Health Connect syncs later. | Apple forum on stage timing | Upsert by source record id. Recompute derived numbers from raw rows with a versioned rule. |
| **History before stages existed** | Apple Health nights before watchOS 9 (2022) have only asleep or in-bed; other sources similar. | WWDC22 | Mark each night "stages available / not available"; do not plot a long deep-sleep series that mixes the two. |

---

## 6. What this means for the design

### 6.1 Show prominently (numbers with their rules)

1. **Time asleep**: nightly value and 7-night and 30-night medians, from one chosen source. Round to the nearest 5 minutes. Always print the source and the rule.
2. **Fell-asleep time, wake-up time and sleep midpoint**, with the 14-night spread as "regularity". Error is small against real variation.
3. **Nights recorded** next to every average, and the **source name** for the series, with a marker on the day the source changed.
4. **Naps and other sleep blocks** as a separate line from the main night.
5. **Your own notes and manual entries** as first-class data, shown beside the device number. Device and diary agree poorly, especially in poor sleepers; both are useful.

### 6.2 Show with an "estimated" label (secondary, one tap away, medians not nightly)

- **Time awake in the night** and **awakenings** (fragile; direction of error differs by device).
- **Time to fall asleep** (fragile; individual errors up to about 35 min).
- **Sleep stages** (core or light, deep, REM): minutes and share as a 14-night median per source, with a plain range, no per-night colouring, no targets. Call Apple's "core" "light (core)". Hide by default behind a setting.
- **Sleep efficiency**, only when the same source gives in-bed time.
- **Trend arrows**: show only if the same source has at least 10 of the last 14 nights, and only for a persistent shift of about 30 minutes or more in time asleep (my heuristic from the 22 to 31 min per-night error; tune with Intus data). Otherwise show "no clear change".

### 6.3 Avoid

- Any **composite sleep score**, grade, "quality", "restorative sleep" or "readiness" figure.
- **Stage targets** ("you need 90 minutes of deep sleep") and good/bad colouring of single nights.
- **Sleep debt, sleep age, or health advice derived from stages.**
- **Blending or summing sources**, or comparing a user's numbers with other users on different devices.
- **Disorder or health claims** (sleep apnea, insomnia, "healthy sleep").
- **Minute-level precision** (7 h 13 min) and streaks that reward more time in bed.
- Defaulting to **red alerts** for short nights or low stage numbers.

### 6.4 Suggested caveat text (plain English, short, no em dashes)

Global note on the sleep page:
> "Your watch or ring guesses your sleep from movement and heart rate. It is not a sleep lab. Use the numbers to see your own pattern over weeks, not to judge one night."

Time asleep:
> "Time asleep is the minutes your {source} marked as asleep. For most healthy adults it lands within about 30 minutes of a sleep lab, but some nights are off by an hour or more."

Under any average:
> "Based on {n} of the last {m} nights. Nights with no data are left out, not counted as zero."

Sleep stages:
> "Stages are a rough guess. When checked against a sleep lab, devices get the stage right for roughly half to three quarters of the night, and often mix up light and deep sleep. Look at the 2 week trend, not one night."

Time awake and time to fall asleep:
> "Time awake is the least reliable number here. Devices often miss short wake ups and sometimes count rest as sleep."
> "Time to fall asleep can be off by half an hour or more."

Bedtime:
> "Bedtime here is when your device first marked you as asleep, so it is a little later than when you got into bed."

Naps and second sleeps:
> "Naps under about 20 minutes are often missed. Naps and a second sleep are shown on their own line."

Several sources:
> "Two sources recorded this night. We show {primary} because it is first in your list. {other} says {x}. We do not add them together."

Device change:
> "You changed device on {date}. Different devices measure sleep differently, so averages before and after are not directly comparable. We started a new average on that date."

No stage data from a source:
> "This source only reports how long you slept, not stages."

Manual entry:
> "Entered by you. Many people judge their sleep differently from a device, and both views are useful."

What this cannot show:
> "This cannot tell you if you have a sleep problem such as sleep apnea or insomnia. It cannot see your brain, so it cannot measure sleep stages directly. If you often feel unrested or very sleepy in the day, talk to a doctor, whatever the numbers say."

Anxiety guard (shown near stages, with a setting):
> "These numbers describe your sleep. They do not grade it. If checking them makes you worry about sleep, you can hide stages or show weekly numbers only."

Rule disclosure link on every metric ("How this is worked out"):
> "Time asleep = minutes marked asleep between your first and last sleep of the night, from {source}, rounded to 5 minutes. Naps are separate. Last updated {date}."

### 6.5 Data-model notes that follow from the evidence

- Store raw per-source sessions with source, device model if exposed, app and OS version, time zone offset, stage availability and the record id. Derive numbers at read time with a versioned rule so the rule can be shown and changed.
- Record which source was chosen for each night and why (user priority, most detail).
- Mark change points: device switch, new source added, and known vendor algorithm updates.
- Per-source series only; never a merged series.

---

## 7. Claims I could not verify, and source conflicts

**Access limits.** No primary full text was opened. Everything here rests on search-tool summaries.

**Conflicts between retrievals**

1. **Apple Oct 2025 white paper headline numbers.** Retrievals gave different values: median sleep sensitivity 96.8, 97.5 or 97.9%; specificity 78.9 or 75.0%; four-stage kappa 0.63 (SD 0.13) or 0.68 (SD 0.11); clinical-population kappa 0.55. The sample sizes (1,171 nights from 858 people for design, 299 nights from 166 people for validation) were consistent. I could not read the per-stage confusion matrix. Treat Apple's kappa as "about 0.6" and verify in the PDF.
2. **Lee YJ 2025 meta-analysis sign.** One retrieval read the negative TST and SE differences as devices recording less sleep than PSG, another as over-estimation. The abstract wording must be checked. The direction I used is consistent with the sensitivity and specificity data but is not confirmed.
3. **Chinoy 2021 per-device values.** One retrieval gave Garmin Fenix 5S TST bias about +44 min and Fitbit Alta HR about +2.6 min; another gave different figures that were probably a different metric. Per-stage bias tables for all seven devices were not retrieved.
4. **Svensson 2024 wake specificity.** 73.0 to 74.6% in the paper's abstract-level text versus about 48% in a later response letter.
5. **Robbins 2024 kappa values** (Oura 0.65, Apple 0.60, Fitbit 0.55) appear in the Oura blog and secondary summaries, not in the abstract text I could see. The Oura-funded status is certain.
6. **Herberger 2025** 4-stage accuracy of 53.2% for the Oura ring is disputed by Oura. The Oura generation tested was not confirmed.
7. **Sleep/wake kappa for Galaxy Watch 3** (0.47) is secondary.

**Not found**

- Independent peer-reviewed PSG validation of: Oura Ring 4; Whoop 5.0 and MG; Samsung Galaxy Watch 4 to 8 and Galaxy Ring; Pixel Watch (beyond Lee 2023); Apple Watch Series 9 to 11 and the watchOS 26 classifier.
- Per-device macro F1 or kappa table for Lee 2023.
- Any study of wearable accuracy for split sleep or for shift workers using modern Apple, Oura or Garmin devices.
- Any study that tests within-person change detection against PSG.
- Any direct, peer-reviewed same-night comparison of several consumer devices against each other.
- Official numeric thresholds in ANSI/CTA/NSF-2052.3.
- Verbatim text of the AASM 2018 statement, the 2021 update, the World Sleep Society and NSF statements (summaries only).

**Weak sources I used only as labelled context:** Terra vendor analysis, a Substack on the June 2023 Oura algorithm change, ranking sites, and Apple Community threads on source priority.

**Official behaviour I could not confirm from Apple or Google documentation:** how HealthKit custom queries treat overlapping category samples from different sources; whether Apple Health's displayed priority always overrides in the Health app for sleep; the full Health Connect stage constant list; the exact Apple, Oura and Garmin nap thresholds (taken from support pages and press).
