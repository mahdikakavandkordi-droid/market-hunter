# SMC W-D-4H Forward Paper — Corrected Evidence v2

Generated: 2026-10-28T01:31:41.189Z

Frozen strategy rules are unchanged. This v2 changes evidence integrity, candle completion/timing, and account valuation only.
The pre-audit v1 snapshot remains preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

## Strategy outcomes

| Metric | Raw | +0.03R cost | +0.05R cost |
|---|---:|---:|---:|
| Closed trades | 8 | 8 | 8 |
| Win rate | 62.5% | 62.5% | 62.5% |
| PF | 1.528 | 1.435 | 1.376 |
| Avg R | 0.198 | 0.168 | 0.148 |

## $1,000 paper account — realized vs marked

Realized-only equity: $1011.09; realized return: 1.1%.
Marked equity: $1012.01; marked return: 1.2%; mark quality: fresh.
Unrealized P/L: $0.93.
Realized-event max drawdown: -1.8%; observed marked max drawdown: -2.0%.
Marked-equity observation coverage starts: 2026-10-04T14:55:43.524Z; first complete marked-equity observation: 2026-10-04T14:55:43.524Z; this is not historical intraday drawdown coverage.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions with marks

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---|---:|
| SLF.TO | Long | 112.030 | 112.450 | 2026-10-27T20:30:00.000Z | fresh | $0.93 |

## Evidence integrity

Legacy trades without first-observation provenance: 2.
Prospective entries: 0; reconstructed entries: 7; pending signals: 0.
This run discrepancies: 9; prior records not re-observed: 0; candle/data diagnostics: 1.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 6 | 66.7% | 0.047 | 1.135 |
| legacy unprovenanced | 2 | 50.0% | 0.450 | 1.857 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 1 | 100.0% | 1.950 | n/a |
| medium | 2 | 100.0% | 0.584 | n/a |
| low | 5 | 40.0% | -0.387 | 0.386 |
| unavailable | 0 | n/a | n/a | n/a |

## Execution qualifications

- New exits are timestamped at bar completion. Legacy closed exit timestamps remain immutable and are conservatively delayed for corrected portfolio availability when their convention is unknown.
- Same-bar stop/target collisions remain stop-first.
- Gap-through-stop/target events retain the frozen strategy-level R result but are flagged because true execution price is unknown.
- Momentum is recorded only as shadow evidence and does not affect any trade decision.

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"CSU.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-21","segment":1,"expected":[4,5,6],"present":[5,6]}
