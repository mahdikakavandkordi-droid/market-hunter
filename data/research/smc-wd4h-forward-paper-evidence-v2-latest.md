# SMC W-D-4H Forward Paper — Corrected Evidence v2

Generated: 2026-10-20T01:08:35.184Z

Frozen strategy rules are unchanged. This v2 changes evidence integrity, candle completion/timing, and account valuation only.
The pre-audit v1 snapshot remains preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

## Strategy outcomes

| Metric | Raw | +0.03R cost | +0.05R cost |
|---|---:|---:|---:|
| Closed trades | 4 | 4 | 4 |
| Win rate | 25.0% | 25.0% | 25.0% |
| PF | 0.667 | 0.638 | 0.619 |
| Avg R | -0.250 | -0.280 | -0.300 |

## $1,000 paper account — realized vs marked

Realized-only equity: $991.40; realized return: -0.9%.
Marked equity: $983.47; marked return: -1.7%; mark quality: fresh.
Unrealized P/L: $-7.93.
Realized-event max drawdown: -1.8%; observed marked max drawdown: -2.0%.
Marked-equity observation coverage starts: 2026-10-04T14:55:43.524Z; first complete marked-equity observation: 2026-10-04T14:55:43.524Z; this is not historical intraday drawdown coverage.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions with marks

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---|---:|
| FNV.TO | Short | 335.780 | 340.710 | 2026-10-19T20:30:00.000Z | fresh | $-2.64 |
| LUN.TO | Short | 32.710 | 33.250 | 2026-10-19T20:30:00.000Z | fresh | $-1.91 |
| WPM.TO | Short | 184.410 | 186.380 | 2026-10-19T20:30:00.000Z | fresh | $-1.30 |
| SLF.TO | Long | 112.030 | 111.090 | 2026-10-19T20:30:00.000Z | fresh | $-2.08 |

## Evidence integrity

Legacy trades without first-observation provenance: 2.
Prospective entries: 0; reconstructed entries: 7; pending signals: 0.
This run discrepancies: 3; prior records not re-observed: 0; candle/data diagnostics: 1.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 2 | 0.0% | -1.050 | 0.000 |
| legacy unprovenanced | 2 | 50.0% | 0.450 | 1.857 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 1 | 100.0% | 1.950 | n/a |
| medium | 0 | n/a | n/a | n/a |
| low | 3 | 0.0% | -1.050 | 0.000 |
| unavailable | 0 | n/a | n/a | n/a |

## Execution qualifications

- New exits are timestamped at bar completion. Legacy closed exit timestamps remain immutable and are conservatively delayed for corrected portfolio availability when their convention is unknown.
- Same-bar stop/target collisions remain stop-first.
- Gap-through-stop/target events retain the frozen strategy-level R result but are flagged because true execution price is unknown.
- Momentum is recorded only as shadow evidence and does not affect any trade decision.

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"CSU.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-21","segment":1,"expected":[4,5,6],"present":[5,6]}
