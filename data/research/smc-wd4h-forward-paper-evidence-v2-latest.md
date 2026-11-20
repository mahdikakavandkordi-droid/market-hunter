# SMC W-D-4H Forward Paper — Corrected Evidence v2

Generated: 2026-11-20T04:07:57.524Z

Frozen strategy rules are unchanged. This v2 changes evidence integrity, candle completion/timing, and account valuation only.
The pre-audit v1 snapshot remains preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

## Strategy outcomes

| Metric | Raw | +0.03R cost | +0.05R cost |
|---|---:|---:|---:|
| Closed trades | 13 | 13 | 13 |
| Win rate | 46.2% | 46.2% | 46.2% |
| PF | 0.848 | 0.792 | 0.757 |
| Avg R | -0.072 | -0.102 | -0.122 |

## $1,000 paper account — realized vs marked

Realized-only equity: $979.72; realized return: -2.0%.
Marked equity: $983.89; marked return: -1.6%; mark quality: fresh.
Unrealized P/L: $4.18.
Realized-event max drawdown: -3.4%; observed marked max drawdown: -3.4%.
Marked-equity observation coverage starts: 2026-10-04T14:55:43.524Z; first complete marked-equity observation: 2026-10-04T14:55:43.524Z; this is not historical intraday drawdown coverage.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions with marks

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---|---:|
| L.TO | Long | 70.490 | 70.880 | 2026-11-19T21:30:00.000Z | fresh | $1.37 |
| LUN.TO | Short | 27.240 | 23.790 | 2026-11-19T21:30:00.000Z | fresh | $7.06 |
| POW.TO | Long | 94.910 | 93.280 | 2026-11-19T21:30:00.000Z | fresh | $-4.25 |

## Evidence integrity

Legacy trades without first-observation provenance: 2.
Prospective entries: 2; reconstructed entries: 13; pending signals: 0.
This run discrepancies: 13; prior records not re-observed: 0; candle/data diagnostics: 1.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 11 | 45.5% | -0.226 | 0.547 |
| legacy unprovenanced | 2 | 50.0% | 0.450 | 1.857 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 4 | 25.0% | -0.100 | 0.830 |
| medium | 3 | 66.7% | 0.039 | 1.112 |
| low | 6 | 50.0% | -0.219 | 0.584 |
| unavailable | 0 | n/a | n/a | n/a |

## Execution qualifications

- New exits are timestamped at bar completion. Legacy closed exit timestamps remain immutable and are conservatively delayed for corrected portfolio availability when their convention is unknown.
- Same-bar stop/target collisions remain stop-first.
- Gap-through-stop/target events retain the frozen strategy-level R result but are flagged because true execution price is unknown.
- Momentum is recorded only as shadow evidence and does not affect any trade decision.

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"CSU.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-21","segment":1,"expected":[4,5,6],"present":[5,6]}
