# Wave ML evaluation V2 — Task 4 readiness review for Astra

**Decision: engineering verification and nominal development support pass.
Research training remains blocked; production readiness remains false.**

Task 4 is a report/review task under `evaluationV2Tasks.task4`. It does not fit a
model, select settings, inspect reserved/final outcomes, change the contract or
activate the challenger. Reviewed research head before this task:
`0b97274c33dce431160481345f354a7343f3dee2` (draft PR #68).

## What the completed tasks establish

Task 1 separates decision membership from outcome maturity. Task 2 implements
separate V2 feature tags and split records. Task 3 passes 46 focused tests and
checks all 199,260 fold records, with replay preserving the Task 2 manifest hash.
All protected inputs still match their Task 3 checksums. These checks establish
causal partition behavior and reproducibility; they are not trading performance.

March validation is no longer restricted to opportunities that exit by April 1.
Both validation windows become scoreable only at the June 15 deadline. Fitting
continues to exclude future information, complete UTC days in the 75-day
embargo, reserved symbols and April-or-later decisions. The current pipeline is
a wave/indicator feature representation predicting a separate ATR opportunity
policy. It is not supervised ground-truth Elliott wave numbering, and its labels
cannot be used as Elliott engine account returns.

## Nominal development support

Counts below are per direction; long and short have identical paired admission.
`final_fit_only` is candidate metadata, not a fitted model.

| Market | Validation 1 fit | Validation 1 evaluate | Validation 2 fit | Validation 2 evaluate | Final refit candidates |
|---|---:|---:|---:|---:|---:|
| US | 9,684 | 923 | 9,927 | 528 | 11,513 |
| Canada | 9,541 | 939 | 10,357 | 528 | 11,926 |
| Crypto | 778 | 472 | 1,012 | 248 | 1,860 |

All 18 fitting pools meet the 500-row minimum and the pooled first-to-last
12-calendar-month span. All 12 validation market/direction pools meet 100 rows.
No minima were lowered. First-window fit spans are 374 days; second-window spans
are about 428–433 days; final-refit candidate spans are 539 days. A pooled span
does not imply a continuous 12-month accepted path for each symbol.

Validation coverage is narrower than the frozen universe: admitted validation 1
has 27 US symbols, 27 Canadian symbols and 8 crypto symbols; validation 2 has
24, 24 and 8, respectively. Both directions share these symbols. Nominal row
counts are correlated opportunities, not independent trades or an effective
sample size. The JSON report includes per-pool symbol concentration, distinct
UTC days, coverage, exclusion reasons and first/last decisions.

## Source quality remains an unresolved gate

| Development market | Direction rows | Resolved rows | Unresolved rows | Unresolved fraction |
|---|---:|---:|---:|---:|
| US | 32,296 | 25,296 | 7,000 | 21.67% |
| Canada | 29,796 | 25,511 | 4,285 | 14.38% |
| Crypto | 4,328 | 3,767 | 561 | 12.96% |

Among 148 nonreserved instruments, the accepted development metadata reports
104 symbols with mismatch days and 906 mismatch symbol-days. This is an audit
count, not a percentage of failed trades. Unknown paths are retained in coverage
and excluded from supervised admission: 9,868 direction rows have an unverified
daily cross-check, 1,925 an untrusted price day, and 53 a split in the label path.
No unknown outcome is assigned a zero/win/loss target.

Official calendar acceptance and conservative quarantine address label integrity
on admitted paths. They do not establish why source prices disagree or whether
exclusions are unbiased. SHIB daily quantization is documented; no common
adjustment factor is verified across the universe. Seven symbols have zero
stored eligible features: SU.TO, CCO.TO, NVDA, AVGO, COST, GE and AMD. Original
price/continuity thresholds remain unchanged. Current survivor selection and
revised provider histories limit historical inference.

## Reserved feature feasibility — without opening outcomes

The check uses stored V2 feature tags and calendar metadata only. Capture success
for all 160 sources does not guarantee usable features. A feature marked
available below is not a verified final execution path or a resolved outcome.

| Reserved symbol | Stored final decision days | Calendar decision days | Feature feasibility |
|---|---:|---:|---|
| BMO.TO | 28 | 28 | Available |
| SU.TO | 0 | 28 | Unavailable |
| CCO.TO | 0 | 28 | Unavailable |
| DOL.TO | 28 | 28 | Available |
| JPM | 27 | 27 | Available |
| COST | 0 | 27 | Unavailable |
| XOM | 27 | 27 | Available |
| AMD | 0 | 27 | Unavailable |
| BNB-USD | 39 | 39 | Available |
| LINK-USD | 39 | 39 | Available |
| AVAX-USD | 12 | 39 | Partial |
| LTC-USD | 39 | 39 | Available |

Four of the twelve reserved symbols are unavailable; AVAX ends after June 26
with 27 expected decision days absent. V2 retagging cannot recover these missing
features or V1-omitted histories. Dropping/replacing reserved instruments would
change the frozen scope and must not silently convert this gate to a pass.
Final execution acceptance is intentionally not assessed here.

## Temporal evidence is inconclusive

Validation decision windows are 59 and 31 calendar days; the final window is
39 days. Each contains zero complete nonoverlapping 75-day decision bins under
the contract's conservative maximum information horizon. This is a fixed-span
support diagnostic, not a calculation of effective sample size or proof that
all shorter exits overlap. We do not select short-duration outcomes to claim
independence. Multiple symbols and paired directions do not replace independent
time evidence because they share market shocks and overlapping price paths.

The October 7 source cutoff permits conservative horizon maturity for the
existing final window. Maturity and evidence breadth are different: the short
window still cannot support robust profitability confidence. No return metric,
class profitability, calibration score, block confidence interval, final result
or promotion decision was computed. Short P/L omits borrow/funding/dividends/FX;
nominal 0.05R costs remain assumptions, not execution evidence.

## Decision and concrete review options

| Gate | Result |
|---|---|
| Causal split integrity and offline replay | Pass |
| Development count minima | Pass |
| Pooled 12-month training spans | Pass |
| Conservative path quarantine and unknown coverage | Pass with limitations |
| Full-universe source acceptance | Blocked |
| Reserved feature feasibility | Blocked: four unavailable, one partial |
| Independent temporal evidence | Inconclusive |
| Final outcome seal | Preserved |

Recommended next work is a focused source-integrity review before fitting.
Astra should choose the scope from these concrete options:

1. **Source repair:** verify daily/hourly instrument and adjustment identity from
   price metadata, diagnose continuity resets and prepare a separately versioned
   dataset if an authoritative fix is found. Preserve the current evidence and
   quarantine; do not guess rescaling, relax tolerances or splice venues.
2. **Prospective evidence design:** specify a longer sealed decision period,
   full maturity and independent-block support before collection/scoring. Keep
   current historical findings; this report changes no dates or schedules.
3. **Restricted exploratory fitting:** only as a separate reviewed task that
   explicitly accepts source limitations and restricted coverage. Preserve an
   inconclusive historical final-confidence result and no-promotion restriction.
   This report does not authorize or perform fitting.

No dependency/model family/trial setting was selected. A later training task
must reconcile the frozen baselines, preprocessing/calibration chronology and
eight-trial ceiling, and retain the final seal until development selection is
locked. Independent confidence and cost-stress acceptance gates remain intact.

## Reproduction and verification

```
node scripts/report-wave-ml-readiness-v2.mjs
```

Restore the original checksummed data packages first. The runner validates Task
3 provenance, input hashes and protected-file bytes, reads development labels
and feature metadata, and writes the separate immutable
`evaluation-v2-task4-readiness-report.json`. Replay requires an identical report.
No provider request, final-label generation, fitting, workflow/account mutation
or production deployment is performed. The report is committed with this script
and this handoff document; Task 1–3 contracts and evidence remain unchanged.

The report was generated and replayed with identical bytes. An independent
Python audit cross-checks all 18 support pools, minima, calendar spans, reserved
feature counts and the blocked decision against original split/tag records.
Application-wide testing is outside this partial checkout; Task 3's 46 focused
checks are provenance-linked rather than claimed as new application tests.
