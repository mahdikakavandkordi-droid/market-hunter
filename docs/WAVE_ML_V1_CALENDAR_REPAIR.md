# Wave ML V1 — official calendar repair and price-path quarantine

## What was fixed

The Task 3 runner originally blocked every stock outcome because historical
regular/short-session calendars were not authoritative. This repair adds explicit
primary-exchange closure and 13:00 early-close dates, covering 2024-10-08 through
2026-12-31. US NYSE/Nasdaq calendars include the exceptional 2025-01-09 closure;
Canada does not inherit it. TSX Boxing Day and other Canadian dates are separate.
All primary URLs and reviewed scope are recorded in `official-calendar.json`.

`calendar.mjs` builds DST-aware 09:30 Eastern opens. Ordinary research sessions
retain the reviewed four-plus-three hourly-source segments and conservative
13:30/16:30 completion. A confirmed 13:00 shortened session has one four-source
segment, conservatively completed at 13:30. No afternoon bar is manufactured.
A verified short session followed by a holiday is no longer treated as a missing
ordinary afternoon segment. Unscheduled source records are excluded and audited.

The accepted execution view is derived from the immutable Task 2 snapshots.
Prices, daily features, risk rules, eligibility thresholds, universe, holdout
symbols and original contract remain unchanged. Invalid records within an open
session still cause unresolved outcomes. A stock day requires both scheduled
segments (or its one verified short-session segment), valid source counts, a
daily quote, and unchanged 0.5% daily/intraday boundary agreement. Even an earlier
exit depends on this cross-check, so label information is delayed conservatively
to 17:00 Eastern. Incomplete or inconsistent days are quarantined, not treated as
wins, losses, expired entries, or zeros.

## Price mismatch diagnosis and limitations

One concrete mismatch mechanism is daily quote quantization in SHIB: all 540
pre-final development daily closes lie on a one-micro-dollar grid (within binary
float representation tolerance), with 515 mismatch days in that interval. For
2024-10-08 the recorded daily open is about 0.000017 while the hourly open is
about 0.000017472852. The stored raw source data supports this observation; no
return or target outcomes were used to select a repair. Other instruments have
heterogeneous opening/closing disagreements. A common split/dividend multiplier
has not been established and neither stream is declared authoritative by fiat.

The safe repair is path quarantine using the original integrity threshold, not
price synthesis. This does not recover missing data or restore the seven symbols
with no eligible feature rows. Full-universe source acceptance remains pending,
including reserved-symbol feature feasibility. These limits are separate from
calendar correctness.

## Observed development result

| Market | Direction rows | Resolved preliminary labels | Unresolved |
|---|---:|---:|---:|
| US | 32,296 | 25,296 | 7,000 |
| Canada | 29,796 | 25,511 | 4,285 |
| Crypto | 4,328 | 3,767 | 561 |
| Total | 66,420 | 54,574 | 11,846 |

There are now 50,807 stock outcomes, compared with zero before the calendar
repair. These are paired/correlated development opportunities, not independent
trades or strategy performance. Every reserved-symbol history and every final
label remains unopened. No class profitability/return summary was produced.

## Newly exposed validation design gate

Under the unchanged contract, all market/direction fitting pools meet nominal
count and 12-month span checks. First validation has per-direction evaluation
counts US 222, Canada 218, crypto 200. However, the second validation window is
March 2026, with final time starting April 1. Sixty stock research bars can span
roughly thirty trading sessions; some outcomes remain informative beyond April 1.
Whole-UTC-day interval purging across all symbols removes those decision groups.
The remaining second-window evaluation counts are US 0, Canada 0, crypto 40 per
direction, below the preregistered 100 minimum. Six count checks fail.

This is a temporal design/support problem, not a failed profitability result.
Training readiness stays false. We did not shorten horizons, drop slow outcomes,
break day/direction grouping, relax purge, lower sample minima or open final
labels to force the gate to pass. Before fitting, review a separately versioned
split design that places a full 75-day maturity gap after the last validation
decision and begins an untouched final decision period afterward. With existing
March validation ending April 1, its earliest fully conservative final start
would be June 15. Only June 15–July 23 matured final decisions remain at the
current cutoff; this is insufficient for strong independent horizon-block
confidence evidence, so longer prospective evidence will be needed. No date
change is activated by this repair.

## Verification, outputs and reproduction

26 focused tests pass: 7 causal-feature, 13 labels/splits and 6 calendar tests.
New tests cover official exceptional/market-specific holidays, annual session
counts, DST, short sessions without invented tails, genuinely missing sessions,
stock daily-verification timing, price quarantine and provenance mismatches.
Both the original Task 3 command and the new accepted-view command replay their
own frozen outputs with identical hashes. The original Task 3 report/package
and Task 2 data/package remain intact; the new output is separately versioned.
Production engines/accounts/workflows are untouched. Application-wide validation
is unavailable in this partial checkout.

```
node scripts/test-wave-ml-features.mjs
node scripts/test-wave-ml-labels.mjs
node scripts/test-wave-ml-calendar.mjs
node scripts/build-wave-ml-labels.mjs
node scripts/build-wave-ml-accepted.mjs
```

The accepted command requires the original checksummed dataset. Its immutable
`dataset/task3-calendar-accepted-labels.json.gz.b64` and
`task3-calendar-report.json` include source/feature/calendar provenance and exact
label/split hashes. `source-quality-diagnosis.json` records the quantization
finding. The downloadable repair archive contains these outputs and the official
calendar; its receipt is `calendar-repair-artifact.json`.
