# Wave ML V1 — task 2 frozen observations and causal features

Task 2 implements source capture, normalized daily/hourly/4H observations, causal
feature construction and integrity evidence. All 160 requested symbols were
captured at a fixed cutoff. No labels, fitting, model selection or operational
activation were performed. The task-1 contract is unchanged.

## Observed result

Cutoff: 2026-10-07T23:01:09.135Z. Five-year daily warmup and two-year hourly source
requests were captured for 75 US stocks, 70 Canadian stocks and 15 crypto assets.
Raw provider payloads, normalized snapshots, split/gap records and feature matrices
are retained in the immutable data package. HTTP success is distinct from quality.

| Market | Symbols | Paired-direction feature rows | Daily gap resets | 4H gap flags | Price mismatch days | Invalid hourly records |
|---|---:|---:|---:|---:|---:|---:|
| US | 75 | 36,444 | 356 | 402 | 343 | 722 |
| Canada | 70 | 35,126 | 130 | 238 | 115 | 764 |
| Crypto | 15 | 6,898 | 740 | 88 | 740 | 2,468 |

Total: 78,468 feature rows. These are paired daily observations, not independent
trades. Seven symbols have zero admitted feature rows: SU.TO, CCO.TO, NVDA, AVGO,
COST, GE, AMD. Several are reserved test symbols, so final-partition feasibility
must be reviewed before fitting. Do not replace them based on model results.

## Causal feature implementation

`lib/wave-ml/features.mjs` builds rows in daily time order after 250 continuous
bars. Confirmed pivots use right windows 2/5 and strict extrema; occurrence and
confirmation are separate. Previously emitted feature rows are immutable. Leg
sizes, durations, speed/ratios and structural flags only use then-confirmed past
pivots. ATR14 is the simple mean of true ranges, RSI is Wilder recursive RSI from
the segment start, and RVOL20 excludes current volume from its denominator.
Required missing paths and split dates reset warmup and weekly/pivot/RSI state.
Optional missing volume or insufficient wave history remains null with a flag.

The previous complete week becomes usable only when the first observation of a
new week arrives. This conservative extra lag avoids assuming an unobserved
Friday/holiday was a valid final session. Weekly values use 20 completed weekly
closes. Every row has the daily input cutoff, prior-week cutoff, pivot confirmation
cutoffs and five-minute historical availability assumption. Current-week candles,
unconfirmed pivots, outcomes, fills and symbol IDs do not enter predictors.

Paired directions share timestamps/partitions; directional legs, distances and
returns are mirrored. Reserved-symbol rows before final time are omitted; final
feature rows are tagged `sealed_final` and no outcome is attached. Symbol and
absolute ATR metadata are for grouping/labels, not predictors. Task 3 still needs
full information-interval purging and embargo; task-2 partition tags alone are
not a training-ready split.

## Data quality and remaining gates

`lib/wave-ml/source.mjs` verifies identity, market/timezone, timestamps, OHLC and
completed grids. Live and nonaligned crypto hourly tails are dropped. Missing or
invalid hourly data are never invented. Research-4H aggregation retains the
reviewed session conventions; missing segments and observed-reference trading
days are flagged rather than bridged. Split dates reset features; they are retained
for later holding-path exclusions.

A complete same-day 4H path is compared with daily opening/closing prices. A
relative difference above 0.5% in either opening or closing price flags a mismatch
and resets daily eligibility at that date. This is a fixed engineering integrity
threshold, not a parameter selected by returns. No price is repaired and no
threshold is relaxed to increase row counts. The observed disagreements require
investigation of adjustment/source conventions before accepting labels. The
source mismatch count does not itself establish which quote stream is correct.

Stock calendars currently use observed SPY/XIU.TO daily sessions. They are explicitly
not authoritative; stock short-session calendar approval remains pending. A missing
final segment may mean an early close or missing source data. Task 3 must resolve
that ambiguity using verified session metadata/calendar or mark the label unresolved.
Crypto daily/hourly discrepancies and missing paths also remain unresolved.

Readiness: GO for reviewing/fixing source quality and constructing label machinery
with synthetic tests. Trustworthy all-market label production and training remain
BLOCKED until these quality gates and heldout sample feasibility are resolved.

## Verification and reproduction

Seven focused tests passed: every synthetic prefix after warmup, future-price
perturbation, directional pairing, prior-only/missing RVOL, gap warmup reset,
reserved-symbol partition isolation, invalid times/instruments and live tails.
Four fixed prefixes on each real symbol passed: 640 real-source checks. These
real checks sample cutoffs; they are not an every-bar audit on all real sources.
Syntax checks passed for source/features/dataset scripts. Existing project-wide
tests were not run from this partial checkout; existing runtime code is untouched.

`dataset/manifest.json` hashes source snapshots and raw payload packages;
`dataset/feature-manifest.json` hashes compact matrices and reports quality.
The downloadable dataset package holds 484 files; `dataset-artifact.json` records
its SHA-256 and durable identity. Extract its `dataset/` into
`data/research/wave-ml-v1/dataset/`, then run:

```
node scripts/build-wave-ml-dataset.mjs
node scripts/test-wave-ml-features.mjs
```

Offline replay validates checksums and refuses changed feature output. `--capture`
refuses to overwrite an existing manifest. The data package is kept outside git;
small manifests, diagnostics, code and this report are committed. Source data is
currently observed/revised history from a survivor universe, not point-in-time
historical constituents. No inference about strategy profitability is made here.
