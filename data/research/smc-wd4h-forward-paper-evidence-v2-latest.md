# SMC W-D-4H Forward Paper — Corrected Evidence v2

Generated: 2026-10-06T22:40:17.986Z

Frozen strategy rules are unchanged. This v2 changes evidence integrity, candle completion/timing, and account valuation only.
The pre-audit v1 snapshot remains preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

## Strategy outcomes

| Metric | Raw | +0.03R cost | +0.05R cost |
|---|---:|---:|---:|
| Closed trades | 0 | 0 | 0 |
| Win rate | n/a | n/a | n/a |
| PF | n/a | n/a | n/a |
| Avg R | n/a | n/a | n/a |

## $1,000 paper account — realized vs marked

Realized-only equity: $1000.00; realized return: 0.0%.
Marked equity: $995.85; marked return: -0.4%; mark quality: fresh.
Unrealized P/L: $-4.15.
Realized-event max drawdown: 0.0%; observed marked max drawdown: -0.3%.
Marked-equity observation coverage starts: 2026-10-04T14:55:43.524Z; first complete marked-equity observation: 2026-10-04T14:55:43.524Z; this is not historical intraday drawdown coverage.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions with marks

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---|---:|
| L.TO | Short | 61.780 | 61.370 | 2026-10-06T20:30:00.000Z | fresh | $1.66 |
| SU.TO | Long | 99.090 | 96.960 | 2026-10-06T20:30:00.000Z | fresh | $-5.18 |
| NTR.TO | Long | 101.600 | 101.290 | 2026-10-06T20:30:00.000Z | fresh | $-0.62 |

## Evidence integrity

Legacy trades without first-observation provenance: 2.
Prospective entries: 0; reconstructed entries: 1; pending signals: 0.
This run discrepancies: 0; prior records not re-observed: 0; candle/data diagnostics: 1.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 0 | n/a | n/a | n/a |
| legacy unprovenanced | 0 | n/a | n/a | n/a |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 0 | n/a | n/a | n/a |
| medium | 0 | n/a | n/a | n/a |
| low | 0 | n/a | n/a | n/a |
| unavailable | 0 | n/a | n/a | n/a |

## Execution qualifications

- New exits are timestamped at bar completion. Legacy closed exit timestamps remain immutable and are conservatively delayed for corrected portfolio availability when their convention is unknown.
- Same-bar stop/target collisions remain stop-first.
- Gap-through-stop/target events retain the frozen strategy-level R result but are flagged because true execution price is unknown.
- Momentum is recorded only as shadow evidence and does not affect any trade decision.

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"CSU.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-21","segment":1,"expected":[4,5,6],"present":[5,6]}
