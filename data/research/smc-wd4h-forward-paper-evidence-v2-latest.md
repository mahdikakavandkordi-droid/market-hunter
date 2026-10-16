# SMC W-D-4H Forward Paper — Corrected Evidence v2

Generated: 2026-10-16T00:31:52.857Z

Frozen strategy rules are unchanged. This v2 changes evidence integrity, candle completion/timing, and account valuation only.
The pre-audit v1 snapshot remains preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

## Strategy outcomes

| Metric | Raw | +0.03R cost | +0.05R cost |
|---|---:|---:|---:|
| Closed trades | 3 | 3 | 3 |
| Win rate | 33.3% | 33.3% | 33.3% |
| PF | 1.000 | 0.956 | 0.929 |
| Avg R | 0.000 | -0.030 | -0.050 |

## $1,000 paper account — realized vs marked

Realized-only equity: $1001.92; realized return: 0.2%.
Marked equity: $987.51; marked return: -1.2%; mark quality: fresh.
Unrealized P/L: $-14.42.
Realized-event max drawdown: -1.8%; observed marked max drawdown: -1.4%.
Marked-equity observation coverage starts: 2026-10-04T14:55:43.524Z; first complete marked-equity observation: 2026-10-04T14:55:43.524Z; this is not historical intraday drawdown coverage.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions with marks

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---|---:|
| AEM.TO | Short | 250.290 | 266.290 | 2026-10-15T20:30:00.000Z | fresh | $-7.49 |
| FNV.TO | Short | 335.780 | 341.810 | 2026-10-15T20:30:00.000Z | fresh | $-3.23 |
| LUN.TO | Short | 32.710 | 32.920 | 2026-10-15T20:30:00.000Z | fresh | $-0.74 |
| WPM.TO | Short | 184.410 | 188.890 | 2026-10-15T20:30:00.000Z | fresh | $-2.95 |

## Evidence integrity

Legacy trades without first-observation provenance: 2.
Prospective entries: 0; reconstructed entries: 6; pending signals: 0.
This run discrepancies: 3; prior records not re-observed: 0; candle/data diagnostics: 1.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 1 | 0.0% | -1.050 | 0.000 |
| legacy unprovenanced | 2 | 50.0% | 0.450 | 1.857 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 1 | 100.0% | 1.950 | n/a |
| medium | 0 | n/a | n/a | n/a |
| low | 2 | 0.0% | -1.050 | 0.000 |
| unavailable | 0 | n/a | n/a | n/a |

## Execution qualifications

- New exits are timestamped at bar completion. Legacy closed exit timestamps remain immutable and are conservatively delayed for corrected portfolio availability when their convention is unknown.
- Same-bar stop/target collisions remain stop-first.
- Gap-through-stop/target events retain the frozen strategy-level R result but are flagged because true execution price is unknown.
- Momentum is recorded only as shadow evidence and does not affect any trade decision.

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"CSU.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-21","segment":1,"expected":[4,5,6],"present":[5,6]}
