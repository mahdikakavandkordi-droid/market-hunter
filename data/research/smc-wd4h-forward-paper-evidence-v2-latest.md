# SMC W-D-4H Forward Paper — Corrected Evidence v2

Generated: 2026-11-28T04:49:38.114Z

Frozen strategy rules are unchanged. This v2 changes evidence integrity, candle completion/timing, and account valuation only.
The pre-audit v1 snapshot remains preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

## Strategy outcomes

| Metric | Raw | +0.03R cost | +0.05R cost |
|---|---:|---:|---:|
| Closed trades | 16 | 16 | 16 |
| Win rate | 50.0% | 50.0% | 50.0% |
| PF | 0.950 | 0.887 | 0.847 |
| Avg R | -0.023 | -0.053 | -0.073 |

## $1,000 paper account — realized vs marked

Realized-only equity: $983.74; realized return: -1.6%.
Marked equity: $983.24; marked return: -1.7%; mark quality: fresh.
Unrealized P/L: $-0.50.
Realized-event max drawdown: -4.2%; observed marked max drawdown: -3.5%.
Marked-equity observation coverage starts: 2026-10-04T14:55:43.524Z; first complete marked-equity observation: 2026-10-04T14:55:43.524Z; this is not historical intraday drawdown coverage.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions with marks

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---|---:|
| WCN.TO | Long | 266.610 | 265.920 | 2026-11-27T21:30:00.000Z | fresh | $-0.50 |

## Evidence integrity

Legacy trades without first-observation provenance: 2.
Prospective entries: 2; reconstructed entries: 14; pending signals: 0.
This run discrepancies: 10; prior records not re-observed: 1; candle/data diagnostics: 1.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 2 | 50.0% | -0.130 | 0.753 |
| reconstructed | 12 | 50.0% | -0.150 | 0.672 |
| legacy unprovenanced | 2 | 50.0% | 0.450 | 1.857 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 5 | 40.0% | 0.058 | 1.124 |
| medium | 5 | 60.0% | -0.028 | 0.933 |
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
