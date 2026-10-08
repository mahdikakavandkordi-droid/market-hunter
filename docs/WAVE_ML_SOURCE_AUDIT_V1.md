# Wave ML — source diagnosis and conditional training follow-up

Reviewed starting head: `77e0afe17aa0cee80bb9122abc9072195ae3638c`, draft PR #68.
The four requested follow-up tasks have been evaluated in dependency order.
Tasks 1–3 produce evidence and a corrected coverage assessment. Task 4 remains
blocked by its explicit readiness condition; no model is fitted and no model
performance result exists.

## Task 1: explain the discarded data

The offline audit checks all 160 frozen raw/snapshot/feature file hashes and raw
instrument identities. Re-normalizing daily/hourly raw quotes and re-aggregating
execution bars reproduces every snapshot exactly. In 22 focused instruments
(all 15 crypto symbols plus seven zero-feature stock symbols), the complete
feature replay reproduces the existing feature checksum. Forty additional
as-of prefix replays at reset events reproduce their corresponding full-history
prefix. This supports the recorded processing behavior; it does not identify an
authoritative price stream or prove the provider's original quotes are correct.

Before-April boundary examples demonstrate disagreements already present in raw
quotes. For BTC on 2024-12-05, daily close is 96,593.5703125 and the last hourly
close is 97,078.9765625 (about 0.5025% different). ETH on 2024-10-23 has a daily
close 2,509.098876953125 versus hourly 2,523.60693359375 (about 0.578%). Stock
examples also reproduce first-hour versus daily-open differences, such as COST
on 2024-11-06. These are source boundary disagreements, not arithmetic differences
introduced by the current aggregation. No observed example justifies declaring
one stream authoritative, changing adjustment factors, or relaxing the 0.5%
comparison threshold. Quantization in SHIB remains a separate documented issue.

Each daily-path reset restarts the indicator/pivot/weekly state. The frozen policy
requires 250 continuous daily bars before emitting a feature. Repeated resets
therefore suppress months of otherwise present source observations. In the
examined decision ranges, each zero-feature stock's longest uninterrupted run
is below 250 bars:

| Symbol | Maximum continuous bars | Required |
|---|---:|---:|
| SU.TO | 68 | 250 |
| CCO.TO | 135 | 250 |
| NVDA | 211 | 250 |
| AVGO | 134 | 250 |
| COST | 206 | 250 |
| GE | 230 | 250 |
| AMD | 67 | 250 |

The machine report records each range explicitly: pre-April development for
nonreserved symbols; the original stored April–July feature range for reserved
symbols. Post-April price examples/outcomes are not used to choose a correction.
Ranges are not identical across groups, and these lengths are eligibility
diagnostics, not model scores. Full feature replay confirms the stored zero rows.

In crypto's first fitting pool, there are 161 observed UTC decision days out of
375 calendar decision days (about 42.93%). Each direction has 778 rows, but both
directions and repeated symbols share the same observed dates. No admitted
fitting rows occur from 2024-11-28 through 2025-06-29 inclusive: 214 calendar days.
December 2024 through May 2025 are six completely empty fitting months. Some
December feature rows exist but their outcomes are unresolved; January–May also
have no stored development crypto feature rows. Thus feature eligibility and
label admission both contribute. A first-to-last span above 12 months does not
establish 12 months of continuous accepted observations. The gap persists in
both validation fitting pools and the final-refit candidate metadata.

## Task 2: corrections and reconstruction result

No price or aggregation correction has been verified. All 160 raw processing
replays and 22 focused feature replays retain their original hashes. Consequently
no replacement source dataset is fabricated and the old feature/label/split
archives remain unchanged. Removing the mismatch reset or reducing warmup would
be a methodological change, not a demonstrated bug fix.

The verified reporting issue is corrected separately: `coverage.mjs` enumerates
expected calendar decision dates, monthly counts including empty months,
observed-day ratios and the longest missing run. UTC crypto days and approved
exchange session dates are counted separately. Pairing creates additional rows,
not additional observed days. Six regression cases cover paired directions,
empty interior months, exchange weekends/holidays, edge gaps, empty input and
invalid/out-of-calendar timestamps. The new `source-audit-v1` reports supplement
and preserve the original Task 4 report rather than rewriting its history.

The audit writes immutable task-specific reports and refuses a changed replay.
No runtime engine, source tolerance, label horizon, universe, heldout membership,
model threshold or account/workflow configuration changes.

## Task 3: readiness reassessment

Nominal sample minima and pooled first-to-last spans still pass. Full requested
scope training readiness remains false because source price acceptance has not
been resolved, crypto coverage is discontinuous, and four reserved symbols lack
features. AVAX still has 12 of 39 final decision days. The new report includes
coverage for all 18 market/direction/fold fitting pools, including leading and
trailing missing expected days. Coverage is descriptive; no new hidden numerical
acceptance threshold is introduced.

Training-data readiness is separated from promotion-evidence readiness. A short
39-day final period limits confidence in profitability/promotion; it alone is
not proof that a restricted exploratory fit is pointless. Such a fit would need
an explicit reviewed restricted-scope design, appropriate class/feature support,
trial/preprocessing chronology and clear uncertainty. The current full-scope
source acceptance gate has not passed.

## Task 4: conditional fit status

`task4.json` records `BLOCKED_BY_TASK3_READINESS; NOT_FITTED`, zero fitted models,
zero trials and null performance metrics. This preserves the requested condition
"train if the preceding readiness assessment passes." It must not be reported
as completed training, a failed model, or a profitability result. Baselines and
candidate settings have not been tuned on deficient data. Final outcomes remain
unopened.

The next concrete work is an authoritative source-price/convention investigation
using instrument/price metadata, or a reviewed separate limited-scope contract.
A trustworthy correction requires a verified explanation for daily/hourly
boundary differences and a versioned replay with original integrity protections.
The current audit provides timestamped examples for this investigation, but does
not provide an unconnected data subscription, replacement venue, guessed prices
or evidence that deleting safeguards is valid.

## Reproduction and verification

```
node --test scripts/test-wave-ml-features.mjs scripts/test-wave-ml-labels.mjs scripts/test-wave-ml-calendar.mjs scripts/test-wave-ml-splits-v2.mjs scripts/test-wave-ml-coverage.mjs
node scripts/audit-wave-ml-source-v2.mjs
```

All 52 focused tests pass (46 original plus six coverage tests). Audit generation
and replay produce identical reports, with all prior protected evidence files
byte-identical. The stored frozen source/feature/label packages are required.
The reports are `data/research/wave-ml-v1/source-audit-v1/task1.json` through
`task4.json`; they contain no model performance metrics or reserved/final label
outcomes. Final feature metadata may be checked for feasibility; it is not a
final execution-path result. Application-wide testing is outside this partial
checkout.
