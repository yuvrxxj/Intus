# Sleep tracker: platform research for Intus

Research date: 2026-10-09. Scope: Apple HealthKit, Apple Health export, Google Health Connect, web access options, libraries for the future Expo app, and design consequences.

## 0. How to read this document

Source tags used on every non-trivial claim:

- [P] primary: Apple, Google or Android documentation, official support pages, or the official repository of the library in question.
- [S] secondary: forum threads, blogs, vendor marketing, community repositories, search-tool summaries.
- [M] my own work: a calculation, an inference, or a measurement I ran in this session. Never presented as a source fact.

Access notes (they affect how much I could verify):

- Apple developer pages were read as raw Markdown/JSON from developer.apple.com (for example `https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis.md`), so those quotes are exact.
- Android developer pages (developer.android.com) were fetched and read in full.
- support.apple.com, developers.google.com, support.google.com and developer.mozilla.org are blocked for direct fetches from this sandbox. I read the pages I needed through the Firecrawl scraper (exact text). Where I could only get a search-tool summary instead, the claim is tagged [S] and says so.
- Vendor sites (Terra, Junction, Rook, Spike, Open Wearables) were not reachable at all. Their pricing comes only from search-tool summaries and must be re-checked before anyone relies on it.

### Headline findings

1. HealthKit sleep stages (core, deep, REM, unspecified, awake, in bed) exist since iOS 16 (in bed and awake are older). Each sample has one value and one source. HealthKit does not merge or de-duplicate sleep samples across sources. The reader must.
2. Apple stopped writing `inBed` samples from Apple Watch on watchOS 11 / iOS 18 (Apple DTS engineer, on the developer forum). Do not depend on in-bed intervals to find session boundaries.
3. There is no HealthKit API for the watchOS 26 sleep score (Apple DTS engineer, September 2025). It must be computed by the app if wanted, and called something else.
4. iOS 27 adds time-bound read authorization: a person can grant a native app only a recent window of history. This is in Apple's current docs.
5. Neither HealthKit nor Health Connect has a web API. A browser cannot read either. The only browser routes are file imports (Apple Health `export.zip`, Takeout files) and, for Fitbit/Pixel Watch owners only, the new Google Health API.
6. Google Fit APIs (including REST) stop at the end of 2026 and have been closed to new sign-ups since 2024-05-01. The Fitbit Web API is switched off on 2026-10-30. The replacement, the Google Health API, launched 2026-03-24, but Google's own banner currently says it is "not onboarding new projects at this time". I could not test whether that blocks a brand-new personal project.
7. Realistic free path before phone apps exist: manual entry plus a client-side Apple Health export import. I measured a streaming scan of a synthetic 1 GB export.xml at about 5 seconds and 120 MB peak memory in Node 22 (not a browser, not real data). Do not build a Google cloud integration yet.

---

## A. Apple HealthKit sleep

### A1. Identifier and every value

`HKCategoryTypeIdentifier.sleepAnalysis` is "A category sample type for sleep analysis information", available from iOS 8.0 [P] https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier/sleepanalysis.md

Values of `HKCategoryValueSleepAnalysis` [P] https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis.md (descriptions are Apple's text; availability comes from the per-case pages, for example `.../hkcategoryvaluesleepanalysis/asleepcore.md`):

| Swift case | ObjC constant (this is also the string in export.xml) | Raw int [S] | Apple description | Availability [P] |
|---|---|---|---|---|
| `inBed` | `HKCategoryValueSleepAnalysisInBed` | 0 | "The user is in bed." | iOS 8.0, watchOS 2.0 |
| `asleepUnspecified` | `HKCategoryValueSleepAnalysisAsleepUnspecified` | 1 | "The user is asleep, but the specific stage isn't known." | iOS 16.0, watchOS 9.0 (as a name) |
| `awake` | `HKCategoryValueSleepAnalysisAwake` | 2 | "The user is awake." | iOS 10.0, watchOS 3.0 |
| `asleepCore` | `HKCategoryValueSleepAnalysisAsleepCore` | 3 | "The user is in light or intermediate sleep." | iOS 16.0, watchOS 9.0 |
| `asleepDeep` | `HKCategoryValueSleepAnalysisAsleepDeep` | 4 | "The user is in deep sleep." | iOS 16.0, watchOS 9.0 |
| `asleepREM` | `HKCategoryValueSleepAnalysisAsleepREM` | 5 | "The user is in REM sleep." | iOS 16.0, watchOS 9.0 |
| `asleep` (deprecated) | `HKCategoryValueSleepAnalysisAsleep` | 1 | "The user is sleeping." | iOS 8.0 to 16.0 (deprecated in 16) |

Notes:

- Raw integers are not printed in Apple's docs. They come from the .NET bindings of the Apple header: https://raw.githubusercontent.com/dotnet/macios/main/src/HealthKit/Enums.cs (`InBed`, `Asleep`, `Awake`, then `AsleepCore = 3`, `AsleepDeep = 4`, `AsleepREM = 5`) [S]. That `asleepUnspecified` shares raw value 1 with the old `asleep` is my inference from that file plus Apple saying `asleep` was deprecated "in favor of asleepUnspecified" [M]. Importing files by string name (export.xml) avoids the question. I could not tell which of the two strings (`HKCategoryValueSleepAnalysisAsleep` or `...AsleepUnspecified`) an export prints for old data, so an importer should accept both and map both to `asleep_unspecified` [M].
- `HKCategoryValueSleepAnalysis.allAsleepValues` (iOS 16) is "A set of values that represents the possible stages of sleep" and includes unspecified; use it in predicates when you want all asleep time [P] https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis/allasleepvalues.md
- Stage semantics from WWDC22 session "What's new in HealthKit": `asleepCore` corresponds to stages one and two of the AASM scoring model, `asleepDeep` to stage three, `asleepREM` to REM; `asleep` was deprecated in favor of `asleepUnspecified` [P] https://developer.apple.com/videos/play/wwdc2022/10005/
- Stage availability in practice depends on the writing source. Apple Watch with watchOS 9+ writes stages (WWDC22). Which third-party apps and wearables write stages, versus only `asleepUnspecified` or `inBed`, varies and I did not verify it per vendor [M].

### A2. How samples are structured

[P] https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis.md says, in Apple's words:

- "Each sleep analysis sample can have only one value."
- To track both time in bed and sleep quality, "use samples with overlapping times." One set of samples tracks time in bed; the in-bed time is partitioned into detailed samples (awake, core, deep, REM). "The detailed samples overlap the in-bed sample, but they don't overlap each other."
- "Samples recorded by Apple Watch only include awake samples that occur between two sleep samples. When reading sleep samples from HealthKit, there might not be any detailed samples that correspond to the beginning or ending of an in-bed sample."
- Apps can derive time to fall asleep, percent in deep sleep, number of wake-ups and totals by comparing start and end times.

Writer guidance in WWDC22: "create one sample for each continuous period of time in a given sleep stage." So the model is one `HKCategorySample` per stage segment, not one object per night [P] https://developer.apple.com/videos/play/wwdc2022/10005/

Every sample is an immutable `HKObject` with `uuid`, `metadata`, `device`, `sourceRevision` and `source` (the app or device that created it) [P] https://developer.apple.com/documentation/healthkit/hkobject.md

Change that breaks session grouping: Apple stopped recording `inBed` samples on watchOS 11 and iOS 18. Apple DTS engineer reply on the developer forum: "We stopped recording the `inBed` samples on watchOS 11 and iOS 18 because the samples are not quite as accurate as what we'd like them to be. As of today, the system doesn't provide a replacement for the API." Garmin and Oura still write in-bed samples per the original poster [S, but it is an Apple staff statement] https://developer.apple.com/forums/thread/766977

### A3. Several sources, source priority, double counting

What Apple documents:

- Health app, user-visible rule [P] https://support.apple.com/en-us/108779 : "By default, Health prioritizes data in this order: 1. Health data that you enter manually. 2. Data from your iPhone, iPad, and Apple Watch. 3. Data from apps and Bluetooth devices." A newly added source "appears above all apps and devices". The user can reorder per data type under Browse > category > subcategory > Data Sources & Access > Edit; "the data source at the top will take priority over others."
- HealthKit statistics queries merge sources automatically, but only for quantity samples: "You can use statistics queries with quantity samples only" [P] https://developer.apple.com/documentation/healthkit/hkstatisticsquery.md and "By default, these queries automatically merge the data from all of your data sources before performing the calculations" [P] https://developer.apple.com/documentation/healthkit/hkstatistics.md . `sleepAnalysis` is a category type, so no automatic merge exists for it [M, inference from those two statements].
- A reply on the Apple developer forum (user jcafaro; the page does not label this user as Apple staff): "if your device contains overlapping in bed intervals from multiple source then that's what the query will return. It will be up to you to decide how you want to handle it. You could ignore certain sources if you want, for example. Or you can keep track of the intervals yourselves in some kind of data structure." [S] https://developer.apple.com/forums/thread/730258
- Same user, on a sum that was too large: "Do any of the samples overlap? If so you'll be counting too much." and "Are any of the samples logged as asleepUnspecified? If so, you've forgotten to count them." Also: "the dates in the Health app are based from 6pm-6pm." [S] https://developer.apple.com/forums/thread/745369

What I could not find: any Apple statement of how the Health app itself reconciles overlapping sleep samples from different sources, or any API that exposes the user's source order to an app. Treat both as unknown.

What a correct reader must do [M, derived from the sources above]:

1. Query `sleepAnalysis` samples for the window; keep `source.bundleIdentifier`, source name, device and sample uuid on every row.
2. Never sum raw durations across samples. Never add `inBed` to asleep time.
3. Treat "asleep" as the union of `asleepUnspecified`, `asleepCore`, `asleepDeep`, `asleepREM` (that is `allAsleepValues`). Do not forget unspecified.
4. Group by source first. Within one source, merge overlapping intervals (sort by start, coalesce) before measuring.
5. Pick one primary source per night with an explicit, user-editable priority list. Do not add or average two sources. Keep the others as alternates.
6. Assign each session to a night by local time at wake-up, with the time zone problem in A5 in mind.
7. Because Apple Watch has not written `inBed` since iOS 18 / watchOS 11, split sessions by a gap rule (design parameter, see section F), not by in-bed anchors.
8. For incremental sync, use an anchored query: it "returns an anchor value that corresponds to the last sample or deleted object received", so later queries return only newer or deleted objects [P] https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery.md . Users can delete or edit samples in Health at any time, so deletions must be handled.

### A4. What Apple exposes to third parties and what it does not

| Metric | Exposed in HealthKit? | Evidence |
|---|---|---|
| Sleep stages (core, deep, REM, awake, unspecified, in bed) | Yes, `sleepAnalysis` category samples | A1 above [P] |
| Sleep score (watchOS 26 / iOS 26) | No API | Apple DTS engineer, forum, Sep 2025: "As of today, there is no API that allows the access to sleep scores." https://developer.apple.com/forums/thread/799857 [S, Apple staff]. I also found no such type in Apple's current HealthKit type lists or in "HealthKit updates" (latest entries June 2026: workout zones, menopause API) https://developer.apple.com/documentation/updates/healthkit.md [P] |
| Sleeping wrist temperature | Yes, read-only: `appleSleepingWristTemperature` (iOS 16, watchOS 9). One aggregated value per night; "You can request permission to read the samples ... but you can't request authorization to share them." | https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/applesleepingwristtemperature.md [P] |
| Breathing disturbances | A type exists: `appleSleepingBreathingDisturbances` (iOS 18, watchOS 11). The page has no description, so units and meaning are not documented there. | https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/applesleepingbreathingdisturbances.md [P] |
| Sleep apnea notifications | A category type exists: `sleepApneaEvent` (iOS 18, watchOS 11), no description on its page. The notification itself is a Watch feature, not an API. | https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier/sleepapneaevent.md [P] |
| Sleeping heart rate | No dedicated type. HealthKit lists `heartRate`, `restingHeartRate`, `walkingHeartRateAverage`, `heartRateVariabilitySDNN`, `respiratoryRate`, `oxygenSaturation`; an app can filter `heartRate` samples to the sleep window. Heart rate samples can carry `HKMetadataKeyHeartRateMotionContext`. | Absence checked in https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier.md [P]; absence is my reading of a list, not an Apple statement |
| In-bed time | Not any more on Apple Watch since iOS 18 / watchOS 11 | A2 [S, Apple staff] |

Sleep score details, for reference only: Apple's Watch guide describes a 0 to 100 score from estimated duration (50 points), bedtime consistency (30) and interruptions (20), with bands Very Low (0-40), Low (41-60), OK (61-80), High (81-95), Very High (96+) [S, via search-tool summary of https://support.apple.com/guide/watch/view-your-sleep-score-apded441a669/watchos ]. Exact formulas are not published. A third-party aggregator says the score is not synced to Health and comes through as null [S] https://docs.tryterra.co/faq/help-topics/data-api-sdk/provider-coverage-and-per-provider-data-availability/apple-sleep-score-not-exposed-by-healthkit

I checked for sleep changes in iOS 27 / watchOS 27 / WWDC26: the HealthKit updates page (read directly, newest entries June 2026) lists no new sleep API. Third-party blogs mention "improved sleep tracking" in watchOS 27 without detail [S].

### A5. Time zones on samples

- A `HKCategorySample` start and end are absolute instants. Apple's guidance: "For best results when analyzing sleep samples, it's recommended that you use HKMetadataKeyTimeZone to store time zone metadata with your sleep sample data." The key takes "a string value compatible with the NSTimeZone class's timeZoneWithName: method", i.e. an IANA name such as `Europe/London` [P] https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier/sleepanalysis.md and https://developer.apple.com/documentation/healthkit/hkmetadatakeytimezone.md
- Apple says writers should add it; it does not say that Apple Watch always does. Community reports say the key is common on sleep and workouts and mostly absent on quantity samples [S, via search-tool summary of GitHub discussion https://github.com/the-momentum/open-wearables/discussions/606 ]. Unverified for Apple's own samples.
- Consequence: a reader must treat time zone as optional, prefer `HKTimeZone` when present, and keep the original instants in UTC.

### A6. New in iOS 27: limited read window (affects the native app)

Apple's authorization article: "people can choose to grant your app access to only a limited window of recent data rather than their full history ... you can discover the earliest date from which your app is authorized to read data for a given type, but you can't distinguish between full access and denied access." "Time-bound authorization applies only to sample types." `getEarliestAuthorizedSampleDate(for:completion:)` is marked iOS 27.0+. "Avoid interpreting the absence of older samples as evidence they don't exist." [P] https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data.md and https://developer.apple.com/documentation/healthkit/hkhealthstore/getearliestauthorizedsampledate(for:completion:).md

Design effect: the future iOS app can end up with only weeks of history. The export.zip import (section B) is then the only way to backfill years of sleep.

### A7. Accuracy caveat (needed for honest UI)

Apple's own validation paper "Estimating Sleep Stages from Apple Watch" (Oct 2025) uses polysomnography as the reference and reports an average four-stage kappa of 0.63 (SD 0.13); independent studies report weaker stage agreement and a tendency to over-count sleep when the user lies still awake [S, via search-tool summary; I could not open the PDF] https://www.apple.com/health/pdf/Estimating_Sleep_Stages_from_Apple_Watch_Oct_2025.pdf , https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12038347/ . Treat stage minutes as device estimates, best for trends, not as measurements.

### Confidence for section A

High for the enum, availability, sample structure, source-priority page, the lack of a sleep score API, the iOS 27 window and the `inBed` change (all Apple documentation or Apple staff statements). Medium for "no automatic merge for category samples" (inferred from two Apple statements) and for raw integers (secondary). Low for time zone behavior of Apple-written samples (not verified). Not verified: units and meaning of breathing disturbances and apnea event values.

---

## B. Apple Health export file

### B1. Official way to export

Apple Support, "Share your data in Health on iPhone" (iOS 27 version, read 2026-10-09): "You can export all of your health and fitness data from Health in XML format, which is a common format for sharing data between apps." Steps: open Health, tap Summary, tap your picture or initials, tap Export All Health Data, then choose a method for sharing [P] https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios

Apple's page does not name the file. The zip name `export.zip` and the contents below come from open-source tools [S]: https://github.com/dogsheep/healthkit-to-sqlite ("Click 'Export Health Data' ... Now you can convert the resulting `export.zip`") and https://github.com/AlekSi/applehealth ("If you have a lot of data, the export will take a lot of time, and the app can be unresponsive").

### B2. Zip layout and XML shape

Zip layout [S]: the main XML sits one folder deep, next to other files (other `.xml` files that a parser must skip, and GPX route files referenced from workouts as `/workout-routes/route_....gpx`). The healthkit-to-sqlite CLI finds the main file by looking at `.xml` entries exactly one folder deep and checking that the first 1024 bytes contain `<!DOCTYPE HealthData` or `<HealthData `, because the file name is localized (its tests run with both `export.xml` and `exportar.xml`) https://raw.githubusercontent.com/dogsheep/healthkit-to-sqlite/main/healthkit_to_sqlite/cli.py and https://raw.githubusercontent.com/dogsheep/healthkit-to-sqlite/main/tests/test_healthkit_to_sqlite.py . A browser importer should do the same: sniff the header, never trust the name.

The file starts with an XML declaration and an internal DTD (`<!DOCTYPE HealthData [ ... ]>`), then `<ExportDate>`, `<Me>`, and thousands of `<Record>`, `<Workout>`, `<ActivitySummary>` elements. Apple's DTD, as copied by community projects (export versions 3 and 11; I found no Apple-published copy):

```
<!ELEMENT Record ((MetadataEntry|HeartRateVariabilityMetadataList)*)>
<!ATTLIST Record
  type          CDATA #REQUIRED
  unit          CDATA #IMPLIED
  value         CDATA #IMPLIED
  sourceName    CDATA #REQUIRED
  sourceVersion CDATA #IMPLIED
  device        CDATA #IMPLIED
  creationDate  CDATA #IMPLIED
  startDate     CDATA #REQUIRED
  endDate       CDATA #REQUIRED
>
```
[S] https://raw.githubusercontent.com/AlekSi/applehealth/main/healthkit11.dtd and https://raw.githubusercontent.com/tdda/applehealthdata/master/testdata/export6s3sample.xml

So a sleep record has: `type` = `HKCategoryTypeIdentifierSleepAnalysis`; `sourceName`; `sourceVersion`; `device`; `creationDate`; `startDate`; `endDate`; `value` = one of the strings in the A1 table; no `unit`. Optional child `<MetadataEntry key=".." value=".."/>` elements.

Verified fragments I could see in real fixtures:

- A sleep record from a maintainer's test fixture: `<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" value="HKCategoryValueSleepAnalysisAsleepDeep" startDate="2024-01-01 22:00:00 +0000" endDate="2024-01-01 23:30:00 +0000"/>` [S] https://github.com/vpetersson/apple-health-mcp-server/pull/1 . This is a minimal fixture, not a real export line.
- A real-looking Apple Watch heart-rate record with the `device` attribute: `device="&lt;&lt;HKDevice: 0x282a45810&gt;, name:Apple Watch, manufacturer:Apple, model:Watch, hardware:Watch2,4, software:4.3.1&gt;"`, plus `creationDate`, `startDate`, `endDate` and a `MetadataEntry` child [S] https://raw.githubusercontent.com/dogsheep/healthkit-to-sqlite/main/tests/export.xml . The `device` value is the string form of an `HKDevice`, not structured data.

Illustrative sleep record assembled from the verified pieces above (not copied from a real export; the `HKTimeZone` child is expected but I could not verify that Apple Watch writes it, see A5):

```xml
<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" sourceVersion="10.1"
        device="&lt;&lt;HKDevice: 0x...&gt;, name:Apple Watch, manufacturer:Apple, model:Watch, hardware:Watch6,2, software:10.1&gt;"
        creationDate="2026-10-08 07:12:03 +0100" startDate="2026-10-07 23:41:10 +0100"
        endDate="2026-10-07 23:58:40 +0100" value="HKCategoryValueSleepAnalysisAsleepCore">
  <MetadataEntry key="HKTimeZone" value="Europe/London"/>
</Record>
```

Parser gotchas:

- A `value` that is a string, not a number. One MCP server importer ran every `value` through a numeric parser and silently dropped all sleep stages as NULL [S] https://github.com/vpetersson/apple-health-mcp-server/pull/1
- The internal DTD can disagree with the file body. After iOS 16 an R import failed with an ATTLIST error because `<Me>` carried a new attribute the DTD lacked [S, via search-tool summary] https://discussions.apple.com/thread/254202523 . Use a non-validating, streaming parser and skip the DOCTYPE.
- Text can include non-ASCII (`Simon's iPhone` with a typographic apostrophe in a fixture): decode as UTF-8.
- `<Correlation>` children also appear as top-level `<Record>` elements (Apple comment in the DTD), so do not count them twice (not relevant for sleep).

### B3. Dates and time zone in the file

Format in fixtures: `YYYY-MM-DD HH:MM:SS +HHMM` (for example `2016-11-20 17:57:19 -0700`, `2024-01-01 22:00:00 +0000`). It is not ISO 8601; parse it by hand. There is no IANA zone on `Record`; at most a `MetadataEntry key="HKTimeZone"` child (seen on `<Workout>` in a fixture).

What the offset means is disputed in secondary sources: one blogger exported in two different seasons and found every timestamp had the export-time offset (all `-0400` in summer, all `-0500` in winter); other reports say each `startDate` carries an offset [S, via search-tool summary of https://www.r-bloggers.com/2020/02/apple-health-export-part-i/ and https://github.com/the-momentum/open-wearables/issues/1712 ]. A fixture in dogsheep also shows a November date with `-0700`, which would be wrong for US Pacific winter time if offsets were per record [M, observation on a possibly hand-edited fixture]. Do not assume the offset equals the local offset when the sleep happened. Convert to a UTC instant with the given offset, keep `HKTimeZone` when present, and treat local-night assignment as an estimate (design: `tz_origin`).

### B4. File size at scale

- A real 424 MB `export.xml` held about 982,000 records [S] https://github.com/vpetersson/apple-health-mcp-server/pull/1
- A 10-year export: 1.8 GB `export.xml`, 4.26 million records, 71 MB when gzipped; DOM parsers crashed [S, via search-tool summary of a DEV Community article https://dev.to/beck_moulton/quantified-self-turn-your-massive-apple-health-xml-into-a-lightning-fast-duckdb-database-o70 ]. Another article in the same series is titled "Taming 5GB+ of Apple Health XML Data" [S].
- Guides give 200 to 500 MB XML (50 to 150 MB zip) as typical and 1 GB+ for heavy users [S, search-tool summary].
- From the first two reports: about 420 to 430 bytes of XML per record [M, 424e6 / 982e3 and 1.8e9 / 4.26e6].
- Sleep is a small slice: heart rate, steps, energy and distance dominate. My estimate (not from a source) is tens of sleep records per night, so ten years of nightly tracking is roughly 100 to 200 MB of sleep XML at most [M].
- Compression: the one report that gives both numbers is 1.8 GB to 71 MB gzipped, about 25x, because the markup is repetitive [S]. My synthetic file compressed about 30x [M].

### B5. What is realistic in a browser without uploading anything

Short answer: yes on a desktop browser, if you stream and never hold the whole file or a DOM. Phone browsers are unverified and riskier.

Building blocks and their status:

- Read the user's file with the File API; `File` is a `Blob`, and `Blob.stream()` is Baseline widely available (Chrome 76, Firefox 69, Safari 14.1) [S, search-tool summary of MDN/caniuse] https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream
- Inflate with the native `DecompressionStream("deflate-raw")`: Baseline since May 2023 (Chrome 103, Firefox 113, Safari 16.4) [S, same source] https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream . Zip entries are raw deflate, but you still need a ZIP container reader to find the entry.
- ZIP reading libraries: zip.js is BSD-3-Clause, "designed to handle large amounts of data", supports "archives larger than 4GB with Zip64" and native compression streams [P] https://raw.githubusercontent.com/gildas-lormeau/zip.js/master/README.md . fflate is MIT, has streaming `Unzip` and async Worker-based APIs, and its README lists "Supports files up to 4GB" [P] https://raw.githubusercontent.com/101arrowz/fflate/master/README.md . A 5 GB `export.xml` would exceed fflate's stated limit, so prefer zip.js for the unzip step [M].
- XML: either a hand-rolled scanner (Apple writes one `<Record ...>` tag per line, but do not rely on line breaks) or sax-js, a streaming parser https://github.com/isaacs/sax-js . The open-source Python reference does the same thing: feed 1 MB chunks into `XMLPullParser`, yield `Record` elements, clear the root after each [S] https://raw.githubusercontent.com/dogsheep/healthkit-to-sqlite/main/healthkit_to_sqlite/utils.py
- Run all of it in a Web Worker (also supported for streams) and post small batches of already-parsed sleep rows back to the page.

My measurement [M]. I generated a synthetic Apple-Health-like export.xml of 1,000,000,000 bytes (2.47 million records, 49,345 sleep records, a DOCTYPE, `device` strings and `MetadataEntry` children; no real data), deflate-raw compressed it to 32.8 MB, then ran in Node 22 on a 4-core sandbox: stream, `DecompressionStream("deflate-raw")`, `TextDecoderStream`, scan for `<Record type="HKCategoryTypeIdentifierSleepAnalysis"`, extract attributes, convert dates to epoch milliseconds. Results:

| Variant | Time | Peak RSS | Sleep records found |
|---|---|---|---|
| Inflate + decode only | 4.9 s | n/a | 0 |
| Scan, storing extracted strings | 6.9 s | 972 MB | 49,345 |
| Scan, storing numbers + interned names | 5.1 s | 120 MB | 49,345 (all) |

Lessons: (1) the work is inflate-bound, about 200 MB/s of XML in V8; (2) storing substrings of a chunk keeps the whole chunk alive (V8 sliced strings), which made memory grow to roughly the size of the file; convert to numbers or copy strings immediately. These are Node numbers on synthetic, highly repetitive data. A real zip, the browser, Safari and a phone will be slower. Plan on tens of seconds for a laptop, and show progress using bytes read from the File.

Other pitfalls: `await file.text()`, `arrayBuffer()` and `DOMParser` all materialize the whole document; do not use them. Match the header, not the file name (B2). iOS Safari memory limits for this workload are unverified; prefer a desktop import and offer "export on iPhone, AirDrop or save to Files, open Intus on a computer".

### B6. Open-source parsers and format descriptions

- dogsheep/healthkit-to-sqlite (Apache-2.0): https://github.com/dogsheep/healthkit-to-sqlite (streaming, 1 MB chunks)
- tdda/applehealthdata (MIT): https://github.com/tdda/applehealthdata , with a sample export and DTD: https://raw.githubusercontent.com/tdda/applehealthdata/master/testdata/export6s3sample.xml
- AlekSi/applehealth (Go) and its DTD copy: https://github.com/AlekSi/applehealth
- vpetersson/apple-health-mcp-server, useful for the "value is a string" bug: https://github.com/vpetersson/apple-health-mcp-server/pull/1

### Confidence for section B

High for the official steps (read from Apple's page). Medium for XML shape: attribute names are consistent across two community DTD copies and several fixtures, but the DTDs are older export versions and I did not see a real current sleep line. Medium for sizes (blogs and one PR). Medium-low for the offset semantics (secondary sources conflict). The benchmark is real but synthetic and not in a browser.

---

## C. Google Health Connect

All of this is from developer.android.com, fetched in full on 2026-10-09 [P].

### C1. SleepSessionRecord and Stage

`SleepSessionRecord` "Captures the user's sleep length and its stages. Each record represents a time interval for a full sleep session. All sleep stage time intervals should fall within the sleep session interval. Time intervals for stages don't need to be continuous but shouldn't overlap." https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/SleepSessionRecord

Constructor fields: `startTime: Instant`, `startZoneOffset: ZoneOffset?`, `endTime: Instant`, `endZoneOffset: ZoneOffset?`, `metadata: Metadata`, `title: String?`, `notes: String?`, `stages: List<SleepSessionRecord.Stage>`. Zone offset docs: "User experienced zone offset at startTime, or null if unknown ... Queries with user experienced time filters will assume system current zone offset if the information is absent." A `Stage` has only `startTime`, `endTime`, `stage: Int` (no per-stage zone offset) https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/SleepSessionRecord.Stage

Stage constants (Jetpack names; the platform class uses `STAGE_TYPE_SLEEPING_DEEP/LIGHT/REM` and `STAGE_TYPE_AWAKE_OUT_OF_BED` with the same values, all "Added in API level 34, Also in U Extensions 7") https://developer.android.com/reference/android/health/connect/datatypes/SleepSessionRecord.StageType :

| Int | Constant | Meaning (Google's text) |
|---|---|---|
| 0 | `STAGE_TYPE_UNKNOWN` | "Use this type if the stage of sleep is unknown." |
| 1 | `STAGE_TYPE_AWAKE` | "The user is awake and either known to be in bed, or it is unknown whether they are in bed or not." |
| 2 | `STAGE_TYPE_SLEEPING` | "The user is asleep but the particular stage of sleep (light, deep or REM) is unknown." |
| 3 | `STAGE_TYPE_OUT_OF_BED` | "The user is out of bed and assumed to be awake." |
| 4 | `STAGE_TYPE_LIGHT` | "The user is in a light sleep stage." |
| 5 | `STAGE_TYPE_DEEP` | "The user is in a deep sleep stage." |
| 6 | `STAGE_TYPE_REM` | "The user is in a REM sleep stage." |
| 7 | `STAGE_TYPE_AWAKE_IN_BED` | "The user is awake and in bed." |

Other guidance: "the SleepSessionRecord itself must only be written to Health Connect once the session has finished"; "Writing sleep stages is optional, but recommended if available"; granular data such as heart rate is separate records linked to a session only by overlapping time (no session id) https://developer.android.com/health-and-fitness/health-connect/experiences/sleep and https://developer.android.com/health-and-fitness/health-connect/features/sleep-sessions . Library version: Jetpack `androidx.health.connect:connect-client` 1.1.0 stable since 2025-10-08; 1.2.0-alpha06 on 2026-08-26 https://developer.android.com/jetpack/androidx/releases/health-connect

### C2. Metadata and duplicates

`Metadata` fields [P] https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/metadata/Metadata :

- `id`: "Unique identifier of this data, assigned by Health Connect at insertion time."
- `dataOrigin`: "Where the data comes from, such as application information originally generated this data." After insertion it holds the writing app (package name).
- `clientRecordId` (optional): "There is guaranteed a single entry for any type of data with same client provided identifier for a given client. Any new insertions with the same client provided identifier will either replace or be ignored depending on associated clientRecordVersion."
- `clientRecordVersion`: "Data with the highest clientRecordVersion takes precedence. clientRecordVersion starts with 0."
- `lastModifiedTime`: automatically set on insert or change.
- `recordingMethod`: unknown (0), actively recorded (1), automatically recorded (2), manual entry (3).
- `device`: optional `Device` (type, manufacturer, model). Device is mandatory for automatically and actively recorded data in the current SDK https://developer.android.com/health-and-fitness/guides/health-connect/develop/metadata

Duplicate handling, three levels:

1. Same app writing twice: `clientRecordId` + `clientRecordVersion` upsert (above). Google calls it "the most effective way to prevent duplicates during sync retries or app reinstalls".
2. Different apps writing overlapping sessions: `readRecords` returns all of them, each tagged with `dataOrigin`. Nothing merges them for you.
3. Aggregation: "End users can set priority for the Sleep and Activity apps ... When you perform an aggregate read, the Aggregate API accounts for any duplicate data and keeps only the data from the app with the highest priority. ... Only the Activity and Sleep data types are deduped by Health Connect." For sleep the metric is `SleepSessionRecord.SLEEP_DURATION_TOTAL` https://developer.android.com/health-and-fitness/health-connect/aggregate-data

When syncing changes out of Health Connect, "only take changes that didn't come from the calling app" (check `dataOrigin.packageName`) and store Health Connect record ids, because deletions only carry the id https://developer.android.com/health-and-fitness/health-connect/sync-data

### C3. Read permission, history, background

- Permission: `android.permission.health.READ_SLEEP` (and `WRITE_SLEEP`).
- History: "By default, all applications can read data from Health Connect for up to 30 days prior to when any permission was first granted." Beyond that you need `android.permission.health.READ_HEALTH_DATA_HISTORY` (`PERMISSION_READ_HEALTH_DATA_HISTORY`), otherwise "an attempt to read records older than 30 days results in an error." Uninstall and reinstall resets the 30-day window to the new grant date. Feature flag: `FEATURE_READ_HEALTH_DATA_HISTORY`.
- Background reads: foreground reads need nothing extra; background reads need `android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND` and the feature `FEATURE_READ_HEALTH_DATA_IN_BACKGROUND` to be available; use WorkManager. If the user does not grant it, the app "should still run". Default page size is 1000; iterate with `pageToken` and watch rate limits.
- Apps must declare the Health Connect data types they use for Play distribution (a `SecurityException` otherwise).

Sources: https://developer.android.com/health-and-fitness/health-connect/read-data , https://developer.android.com/health-and-fitness/health-connect/data-types , https://developer.android.com/health-and-fitness/health-connect/features/availability

### C4. Android versions, built-in or not, iOS

- "Starting Android 14 (API Level 34), Health Connect is part of the Android Framework" (a framework module). On Android 13 and lower it "is not part of the Android Framework" and the user installs the Health Connect app from Google Play. https://developer.android.com/health-and-fitness/health-connect/get-started
- The SDK supports Android 8 (API 26) or higher, but the Health Connect app works only on Android 9 (API 28) or higher. https://developer.android.com/health-and-fitness/health-connect/architecture
- Android-only: all official docs describe an Android SDK talking over IPC to an on-device component. I found no iOS SDK. Google's Health Connect help page says the same and Google's Health help tells iPhone users to connect through Apple Health instead [S, via search-tool summaries of https://support.google.com/android/answer/13770320 and https://support.google.com/googlehealth/answer/14506680 ; not opened directly].
- Backup/export for end users: Android 14+ has a "Scheduled export" of Health Connect data to a ZIP in cloud storage (and Import) [S, via search-tool summary of https://support.google.com/android/answer/15323271 ]. Whether the ZIP is a readable SQLite database is disputed in secondary sources and unverified.

### Confidence for section C

High. Every fact is from fetched primary pages dated within 2026 (record reference updated 2026-06-24, read-data guide 2026-09-24). Lower: the user-facing scheduled export format, and the iOS statement (Android-only is inferred from the docs; the help pages were read only as summaries).

---

## D. Can a web app read either platform today?

### D1. HealthKit has no web API (confirmed as an absence)

- Apple's HealthKit documentation describes only native frameworks. "The user's device stores all HealthKit data locally" and the store is encrypted when the device is locked [P] https://developer.apple.com/documentation/healthkit/protecting-user-privacy.md . `isHealthDataAvailable()` is true on iOS, watchOS, visionOS and iPadOS 17+; on macOS 13+ "your app can't read or write HealthKit data" [P] https://developer.apple.com/documentation/healthkit/hkhealthstore/ishealthdataavailable().md
- Health data synced through iCloud is end-to-end encrypted [P] https://support.apple.com/en-us/108779
- I found no Apple REST or JavaScript API for Health. Aggregators agree: "Apple Health has no cloud API, so you need to retrieve it locally from your users' devices" (Rook) and Terra says a mobile SDK is required [S, search-tool summaries]. An absence claim cannot be proven, but nothing in Apple's docs or in vendors' docs contradicts it.

### D2. Health Connect has no web API (confirmed)

Google's own comparison: Health Connect has "No OAuth required (on-device permissions)" and "Device-centric (on-device)" storage, versus cloud-centric Fit [P] https://developer.android.com/health-and-fitness/health-connect/migration/fit . Access is through the Android SDK and per-app on-device permissions. No REST endpoint exists.

### D3. Google Fit APIs

- "The Google Fit API (including the REST API) will only be supported until the end of 2026." "Developers cannot sign up to use these APIs as of May 1, 2024." "There is no alternative to the Fit REST API." Recommended replacements: Google Health API (cloud) and Health Connect (mobile). No exact day in 2026 is published on the pages I read. [P] https://developer.android.com/health-and-fitness/health-connect/migration/fit and https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq
- So Fit REST is a dead end for a new web app: you cannot register, and it ends this year.

### D4. Fitbit Web API and the Google Health API (2026 status)

Primary source, banner on every Google Health page, read 2026-10-09 (cache dated 2026-10-08) https://developers.google.com/health/release-notes :

> "Support for the legacy Fitbit Web API ends on September 30, 2026. After this date the API will continue to operate, but Google will no longer fix bugs or provide API support. On October 30, 2026, the Fitbit Web API will be turned off and will no longer function or sync data to or from Fitbit users. ... While we are not onboarding new projects at this time, we are actively working to open access to more developers and will share updates here as availability expands."

What the Google Health API is [P]:

- Launched 2026-03-24 as "the next generation of the Fitbit Web API", REST (also gRPC) at `https://health.googleapis.com/v4/...`, Google OAuth 2.0, registered through Google Cloud Console. Existing Fitbit tokens "cannot be transferred", users must re-consent. https://developers.google.com/health/release-notes , https://developers.google.com/health/migration , https://developers.google.com/health/get-started
- Sleep: data type `sleep` (a "Session"), scope `https://www.googleapis.com/auth/googlehealth.sleep.readonly` (write scope is `.sleep.writeonly`), operations list, get, reconcile, create, update, batchDelete. A session has an `interval` with start/end plus `startUtcOffset`/`endUtcOffset`, a `type` of `STAGES` (or `CLASSIC` with simpler AWAKE / RESTLESS / ASLEEP levels, per the REST reference as summarized by a search tool [S]), `stages` of LIGHT, DEEP, REM, AWAKE (non-overlapping) and separate `shortAwakenings` that can overlap stages. `reconcile` merges overlapping logs from different devices into one main record. https://developers.google.com/health/data-types/sleep , https://developers.google.com/health/scopes
- Limits: no cap on history depth, but sleep pages are capped at 25 sessions ("if a client requests all sleep data for the past 10 years, the API will still return only 25 sleep sessions on the first page"). https://developers.google.com/health/data-types
- Whose data: devices listed are Fitbit trackers and Pixel Watches; "Fitbit devices can't communicate directly with third-party applications ... designed to communicate and synchronize exclusively with the Google Health app", and data reaches the API after sync https://developers.google.com/health/data-types . It does not read Apple Watch data, Apple Health, or other apps' Health Connect data [M, from that page].

Can a web app get sleep through OAuth for free, and what review is needed [P] https://developers.google.com/health/app-verification and https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification :

- "Most scopes for the Google Health API are restricted, which means you must complete verification before your app is publicly available." Not verified: whether `sleep.readonly` is restricted or sensitive. The Cloud Console "Data Access" page shows it.
- "If your app isn't verified, it's limited to 100 users."
- Verification has two parts: OAuth app verification (identity, scopes, privacy policy, in-app disclosure) and an annual third-party security assessment (CASA) "based on the Cloud App Security Assessment framework", with "fees payable to the third-party assessor, ranging from $500 to $4,500 USD". Google itself does not charge for it. 2 to 3 weeks for tier 2, 4 to 6 weeks for tier 3.
- Exceptions: "Personal use ... if you are the only user of your app or if your app is used by only a few users, all of whom are known personally to you" you can proceed through the unverified-app screen; projects in Testing status "only available to users you add to the list of test users".
- In Testing status, Google says authorizations by test users expire after seven days, including refresh tokens [S, via search-tool summary of https://support.google.com/cloud/answer/15549945 ]. So a personal-use setup needs a weekly re-consent.
- Call it from a server (for example a Supabase Edge Function) so the client secret and refresh token stay off the browser [M]. Whether the API allows direct browser calls (CORS) is not verified.

Net for Intus today:

- Free for a single owner in Testing mode is plausible, but only if Google lets a new Cloud project enable the API ("not onboarding new projects at this time" is ambiguous and I could not test it).
- Free for the general public is not realistic: restricted-scope verification plus a yearly paid CASA assessment.
- Covers only Fitbit and Pixel Watch users. It is not a route to Apple or Samsung data.
- A developer forum thread (title only; I could not open it) reports a Google Health OAuth verification pending since 2026-06-01 with no status update, which suggests review times can be long [S] https://discuss.google.dev/t/google-health-oauth-verification-pending-since-june-1-2026-no-status-update/376636 . The banner text above is the primary source; one search tool failed to find it, but I read it on four Google Health pages (release notes, get started, migration, sleep guide).

### D5. What Google Takeout exports for sleep

- Google Health (the renamed Fitbit service): "If you login with a Google Account, follow the instructions for How to download your Google data. Make sure Google Health is selected." Legacy Fitbit-login users use Fitbit settings > Data Export (full archive, or a selection with chosen date range and file format) [P] https://support.google.com/googlehealth/answer/14236615
- File layout for sleep is not described on that page. Third-party guides say sleep arrives as one JSON file per night (`sleep-YYYY-MM-DD.json`) with stage breakdowns [S, search-tool summaries of https://takeoutday.org/guides/fitbit-data-export and https://www.fitmesh.fit/en/blog/export-fitbit-data-after-google ]. Check a real archive before writing an importer.
- Google Fit: Google's Fit help page describes Takeout generally (https://support.google.com/fit/answer/3024190) but I found no official description of how sleep appears in a Fit Takeout. Unverified. Fit is closed to new users anyway.

### D6. Aggregator services (note only; the owner wants free)

All of these need their own mobile SDK on the phone to reach Apple Health or Health Connect, so none helps a browser-only app today. Prices are from search-tool summaries of vendor pages, not read directly; re-check before use [S].

| Service | Price signal | Free tier? | Notes |
|---|---|---|---|
| Terra (tryterra.co) | Quick Start from about $399/month billed annually or $499/month, includes 100,000 credits; 200 credits per active user per month; overage $0.005/credit | Marketing text says Apple Health is "in its free tier"; no formal terms found | https://tryterra.co/pricing , https://docs.tryterra.co/health-and-fitness-api/pricing |
| Junction (formerly Vital, tryvital.com) | Launch $300/month; Enterprise custom | Sandbox and docs free | https://www.tryvital.com/pricing |
| ROOK (tryrook.io) | $399/month for 750 active users, $999 for 5,000, $1,999 Business; 30-day pilot | Sandbox only | https://www.tryrook.io/pricing |
| Open Wearables (self-hosted) | $0 per user, MIT license, you host FastAPI + PostgreSQL + Redis + Celery | Yes (open source) | iOS and Android SDKs exist; maturity of Apple Health / Health Connect sync disputed in sources. https://docs.openwearables.io/ , https://openwearables.io/docs/faqs |
| Spike (spikeapi.com) | From $450/month | No free tier found | One source says Spike was acquired in July 2026 (unverified). https://www.spikeapi.com/pricing |

Open Wearables is the only one consistent with "free", but it still needs the phone-side SDK, so it becomes relevant only with the native apps.

### Confidence for section D

High for the Fit shutdown, the Fitbit dates, the 100-user cap, CASA fee range and the Personal use exception (Google pages read directly). Medium for the Google Health API onboarding situation (the primary banner is clear but its practical effect on a new personal project is untested). Medium-low for aggregator prices (search summaries only). Low for Takeout file layout (secondary only).

---

## E. Libraries for the future native app (short)

Data from the npm registry (`https://registry.npmjs.org/<package>`) on 2026-10-09 [P], plus each project's README [P].

| Library | Latest / release date | License | Expo | Sleep stages |
|---|---|---|---|---|
| `@kingstinct/react-native-healthkit` (iOS) https://github.com/kingstinct/react-native-healthkit | 16.1.0, 2026-10-07 | MIT | Config plugin (`"plugins": ["@kingstinct/react-native-healthkit"]`), "will not work in Expo Go", needs a dev client; needs `react-native-nitro-modules`; peers react >=19, react-native >=0.79 | Yes in principle: "63 Category Types ... Sleep analysis", types mirror HealthKit names. I did not run it |
| `react-native-health` (iOS) https://github.com/agencyenterprise/react-native-health | 1.19.0, 2024-10-15 (almost two years old) | MIT | Config plugin `"react-native-health"`, not in Expo Go, no background support in the plugin | Yes: `getSleepSamples` returns `INBED`, `ASLEEP`, `AWAKE`, `CORE`, `DEEP`, `REM` (checked in source) |
| `react-native-health-connect` (Android) https://github.com/matinzd/react-native-health-connect | 4.1.3, 2026-08-06 | MIT | Since v4 the Expo config plugin and module ship inside the package (`"plugins": ["react-native-health-connect"]`) plus `expo-build-properties` with `minSdkVersion` 26; not Expo Go; dev client | Yes: `SleepSession` record with `stages`. Its `SleepStageType` constants stop at REM (6) and omit `AWAKE_IN_BED` (7) in the version I read, so map unknown ints defensively |
| `expo-health-connect` | 0.1.1, 2024-07-31 | MIT | Deprecated and archived; "everything it did now ships inside react-native-health-connect"; leaving both installed breaks the Android build | n/a |

Expo itself: I found no first-party HealthKit or Health Connect module. The npm package `expo-health` is a 0.0.0 placeholder from 2021 (no license, no repo) [P: npm registry]. docs.expo.dev was not reachable, so an Expo docs page I could not see is possible [M].

Capacitor alternative (relevant if the Vite web app were wrapped instead of rewritten): `@capgo/capacitor-health` 8.11.8 (2026-10-09, MPL-2.0) and `capacitor-health` 8.4.0 (2026-09-23, MIT) both claim Apple HealthKit plus Health Connect. Sleep-stage support not checked [P: npm metadata only].

Cost reality for the native phase, outside the question but relevant to "free only": Apple's membership comparison lists the Apple Developer Program at 99 USD per year; the Google Play developer account is a 25 USD one-time fee [S, search-tool summaries] https://developer.apple.com/support/compare-memberships , https://support.google.com/googleplay/android-developer/answer/6112435 (neither opened directly). Check whether development builds on your own devices can avoid these before the owner commits to "free only".

### Confidence for section E

Medium-high. Versions, dates and licenses come straight from the npm registry; Expo notes from READMEs. None of the libraries was installed or run.

---

## F. What this means for the design

### F1. Neutral sleep session record (store what the source said; derive the rest)

Two layers: raw sessions from each source, and a derived per-night summary. Field names below are suggestions, not a migration (no repository file was changed).

`sleep_session` (one row per session reported by one source):

| Field | Why / mapping |
|---|---|
| `id`, `user_id` | own keys |
| `source_system` | `manual`, `apple_health_export`, `healthkit`, `health_connect`, `google_health_api`, `fitbit_takeout`, `csv` |
| `source_record_id` | HealthKit: synthetic session id (HK has no session object; keep sample uuids on segments). Health Connect: `metadata.id`. Google Health API: data point `name`. Export: hash of (type, source, start, end, value) per segment. Unique on `(user_id, source_system, source_record_id)` so re-imports are idempotent |
| `source_client_record_id`, `source_client_record_version` | Health Connect only (nullable) |
| `source_app_id`, `source_app_name` | HealthKit `source.bundleIdentifier` or Health Connect `dataOrigin.packageName`; export has only `sourceName` |
| `device_type`, `device_manufacturer`, `device_model` | Health Connect `Device`; parsed from the HK `device` string; nullable |
| `recording_method` | `manual` / `automatic` / `active` / `unknown` (Health Connect `recordingMethod`; HK `HKWasUserEntered`) |
| `started_at`, `ended_at` | UTC instants (timestamptz). Always. |
| `start_utc_offset_min`, `end_utc_offset_min`, `tz_name`, `tz_origin` | Offsets as reported (Health Connect `startZoneOffset`, Google `startUtcOffset`), IANA from `HKTimeZone`; `tz_origin` = `reported_offset` / `reported_iana` / `export_offset_unreliable` / `profile_fallback` / `unknown`. Local night assignment is only as good as this |
| `in_bed_started_at`, `in_bed_ended_at` | nullable; present only when the source reported in-bed |
| `stage_detail` | `none` / `asleep_only` / `classic` / `stages`; tells the UI whether stage minutes exist at all |
| `title`, `notes` | Health Connect session fields |
| `source_created_at`, `source_modified_at` | HK `creationDate`, Health Connect `lastModifiedTime` |
| `import_id`, `raw` (jsonb) | keep the original payload so mappings can be fixed later without re-importing |
| `excluded` (bool) | user can hide a session without deleting |

`sleep_stage_segment`: `session_id`, `started_at`, `ended_at`, `stage` (canonical), `source_stage_code` (int or text as received), `source_sample_id` (HK uuid, nullable).

Canonical stage vocabulary (a superset so nothing is lost):

| Canonical | HealthKit | Health Connect | Google Health API |
|---|---|---|---|
| `in_bed` (interval kind, not a stage) | inBed (0) | n/a | time in bed |
| `awake` | awake (2) | AWAKE (1) | AWAKE |
| `awake_in_bed` | n/a | AWAKE_IN_BED (7) | n/a |
| `out_of_bed` | n/a | OUT_OF_BED (3) | n/a |
| `asleep_unspecified` | asleepUnspecified (1, legacy asleep) | SLEEPING (2) | ASLEEP (classic) |
| `light` | asleepCore (3) | LIGHT (4) | LIGHT |
| `deep` | asleepDeep (4) | DEEP (5) | DEEP |
| `rem` | asleepREM (5) | REM (6) | REM |
| `restless` | n/a | n/a | RESTLESS (classic; from a search summary, unverified) |
| `unknown` | any unmapped | UNKNOWN (0) or unknown int | anything else |

Derived `sleep_night` (rebuildable, carries `algo_version`): `night_date` (local date of wake), `primary_session_id`, `asleep_min`, `awake_min`, `in_bed_min` (nullable), `light_min`, `deep_min`, `rem_min` (all nullable), `sleep_onset_at`, `wake_at`, `stage_detail`, `sources_seen`, `alternates` (other sessions overlapping this night).

### F2. Overlapping sources

HealthKit returns every source's samples and does not reconcile sleep; Health Connect `readRecords` does the same and only its aggregate API de-duplicates by user priority; Google's `reconcile` exists for its own data. So Intus must own the rule:

1. Never sum durations across rows. Within a single session, asleep time is the length of the union of asleep intervals (sort by start, merge overlaps).
2. Choose one primary session per night. Two sessions belong to the same night if their intervals overlap by more than half of the shorter one (design parameter; tune on real data).
3. Primary selection order, user-editable and shown in settings, mirroring Apple's "Data Sources & Access" and Health Connect's app priority: manual entry, then sources with stages, then sources with asleep-only data, then in-bed-only. Ties go to the longer session from the higher-priority device type (watch or ring over phone).
4. Never average two sources and never mix stage minutes from different sources in one night. Show alternates as "also reported by <source>: 7 h 12 min" so the user sees disagreement.
5. Optional, off by default: fill gaps in the primary from a secondary source. If ever enabled, mark the night as "combined".
6. Session splitting for HealthKit data without in-bed anchors (Apple Watch since iOS 18): start a new session when the gap between consecutive segments from the same source exceeds a threshold (suggest 60 minutes; this is my parameter, not Apple's). Label sessions that start between roughly 10:00 and 18:00 local and last under about 3 hours as naps, flagged as a heuristic.
7. Idempotent imports: upsert on `(user_id, source_system, source_record_id)`. For export files with no ids, replace by range: when importing an export, delete or supersede earlier `apple_health_export` rows inside the covered date range for the same source, because an export cannot tell you about deletions.
8. For the native phase: HealthKit anchored queries (handle `HKDeletedObject`), Health Connect changes API (store record ids; ignore your own `dataOrigin`).

### F3. Honesty rules for the UI

- `null` is not zero. If a source has no stages, show "stages not reported by this source", not "0 min deep".
- Show sleep efficiency only when real in-bed times exist. Apple Watch no longer provides them (iOS 18).
- Label everything from wearables "estimated by <device>". Apple's own validation: four-stage kappa 0.63 against polysomnography; independent studies lower (A7). Say stage minutes are for trends.
- Do not copy Apple's "Sleep Score" (no API, formula unpublished). If Intus shows a score, name it differently and display the formula, for example duration versus the user's target and bedtime regularity.
- Do not present breathing disturbances or apnea events as diagnoses. If imported at all, show as "reported by device".
- Show the data window ("imported through 2026-10-07 from export") because export is a snapshot. Show a banner when a native app has only a limited authorization window (iOS 27).
- Make the local-time assumption visible when `tz_origin` is not a reported zone.

### F4. Best free route to get data in before the phone apps exist

In order of value per effort:

1. Manual entry (bedtime, wake time, optional wake-ups): works for everyone, no dependency. Store as `source_system = manual`, `recording_method = manual`.
2. Apple Health export import, fully client-side. Steps for the user come from Apple's page (B1). In the app: choose file, find the main XML by header sniffing, stream-inflate in a Web Worker, scan only `HKCategoryTypeIdentifierSleepAnalysis` records, post batches, show progress, and write only sleep rows to Supabase. Nothing is uploaded except parsed sleep rows the user confirms. Use zip.js (Zip64, large archives) and a streaming scanner; avoid DOM parsing (B5). Allow an optional "only import from date X" to make repeat imports fast. This is free, needs no Apple developer account and, after iOS 27, may be the only way to backfill history.
3. Android users: no browser path to Health Connect. Options, all unverified: the Health Connect "Scheduled export" ZIP (Android 14+, cloud storage; format unconfirmed), a third-party exporter app, or manual entry. Do not promise Android import until a real export file has been inspected.
4. Fitbit / Pixel Watch owners only: import the Google Health / Fitbit Takeout sleep JSON (layout unverified, check a real archive). The live Google Health API is not worth building yet: new-project onboarding is paused or unclear, restricted-scope verification plus yearly paid CASA is required for the public, and test mode forces weekly re-consent. If the owner personally wants it, try creating a Cloud project and enabling the API; the answer settles the question in minutes.
5. Skip: Google Fit REST (closed to new users, ends 2026), aggregator services (paid and need native SDKs anyway).

### F5. Native phase notes

- Keep the web record model as the contract; the Expo app writes the same `sleep_session` rows with `source_system` of `healthkit` or `health_connect`.
- iOS: `@kingstinct/react-native-healthkit` (active) over `react-native-health` (last release 2024). Android: `react-native-health-connect`. Both need a development build; neither works in Expo Go.
- Request history permission on Android (`READ_HEALTH_DATA_HISTORY`) and handle the iOS 27 limited window, or users get only 30 days (Android) or an arbitrary window (iOS).
- Budget note: store distribution costs money (Apple 99 USD/year, Google Play 25 USD once, from search summaries); decide whether "free only" covers that.

### F6. Claims I could not verify (carry these as open questions)

1. Whether a new Google Cloud project can enable the Google Health API today, and whether `sleep.readonly` is classed restricted or sensitive.
2. How the Health app merges overlapping sleep samples from several sources, and whether any API exposes the user's source order.
3. Whether Apple Watch sleep samples carry `HKTimeZone`, and what offset `export.xml` uses per record (secondary sources conflict).
4. A real, current `export.xml` sleep line (my example is assembled from verified pieces), and the exact zip layout of a current export.
5. Units and meaning of `appleSleepingBreathingDisturbances` and `sleepApneaEvent` values (Apple pages have no description).
6. Takeout sleep file layouts (Fitbit/Google Health JSON and anything in Google Fit Takeout) and the Health Connect scheduled export format.
7. Aggregator prices and Open Wearables' real HealthKit / Health Connect support (vendor sites unreachable; search summaries only).
8. Safari on iPhone memory limits for the client-side parse; browser performance in general (my benchmark was Node 22 on synthetic data).
9. Apple's validation paper and Apple's sleep score support page were read only as search-tool summaries.
10. Whether Expo has an official health module documented on docs.expo.dev (site unreachable; npm shows only a 2021 placeholder).
