# SMC W-D-4H Forward Paper — Corrected Evidence v2

Generated: 2026-10-13T03:06:08.987Z

Frozen strategy rules are unchanged. This v2 changes evidence integrity, candle completion/timing, and account valuation only.
The pre-audit v1 snapshot remains preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

## Strategy outcomes

| Metric | Raw | +0.03R cost | +0.05R cost |
|---|---:|---:|---:|
| Closed trades | 1 | 1 | 1 |
| Win rate | 0.0% | 0.0% | 0.0% |
| PF | 0.000 | 0.000 | 0.000 |
| Avg R | -1.000 | -1.030 | -1.050 |

## $1,000 paper account — realized vs marked

Realized-only equity: $989.50; realized return: -1.0%.
Marked equity: n/a; marked return: n/a; mark quality: incomplete_missing_marks.
Unrealized P/L: n/a.
Realized-event max drawdown: -1.0%; observed marked max drawdown: -0.9%.
Marked-equity observation coverage starts: 2026-10-04T14:55:43.524Z; first complete marked-equity observation: 2026-10-04T14:55:43.524Z; this is not historical intraday drawdown coverage.
Missing/invalid marks: L.TO, SU.TO; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions with marks

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---|---:|
| L.TO | Short | 61.780 | n/a |  | missing | n/a |
| SU.TO | Long | 99.090 | n/a |  | missing | n/a |

## Evidence integrity

Legacy trades without first-observation provenance: 2.
Prospective entries: 0; reconstructed entries: 1; pending signals: 0.
This run discrepancies: 0; prior records not re-observed: 3; candle/data diagnostics: 0.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 1 | 0.0% | -1.050 | 0.000 |
| legacy unprovenanced | 0 | n/a | n/a | n/a |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 0 | n/a | n/a | n/a |
| medium | 0 | n/a | n/a | n/a |
| low | 1 | 0.0% | -1.050 | 0.000 |
| unavailable | 0 | n/a | n/a | n/a |

## Execution qualifications

- New exits are timestamped at bar completion. Legacy closed exit timestamps remain immutable and are conservatively delayed for corrected portfolio availability when their convention is unknown.
- Same-bar stop/target collisions remain stop-first.
- Gap-through-stop/target events retain the frozen strategy-level R result but are flagged because true execution price is unknown.
- Momentum is recorded only as shadow evidence and does not affect any trade decision.

## Fetch/data gaps

- Fetch failure ^GSPTSE: momentum_benchmark_http_429
- Fetch failure RY.TO: http_429
- Fetch failure TD.TO: http_429
- Fetch failure BMO.TO: http_429
- Fetch failure BNS.TO: http_429
- Fetch failure CM.TO: http_429
- Fetch failure AEM.TO: http_429
- Fetch failure WPM.TO: http_429
- Fetch failure ABX.TO: http_429
- Fetch failure LUN.TO: http_429
- Fetch failure CNQ.TO: http_429
- Fetch failure SU.TO: http_429
- Fetch failure TRP.TO: http_429
- Fetch failure CNR.TO: http_429
- Fetch failure CP.TO: http_429
- Fetch failure SHOP.TO: http_429
- Fetch failure NTR.TO: http_429
- Fetch failure MFC.TO: http_429
- Fetch failure BCE.TO: http_429
- Fetch failure NA.TO: http_429
- Fetch failure SLF.TO: http_429
- Fetch failure POW.TO: http_429
- Fetch failure ENB.TO: http_429
- Fetch failure IMO.TO: http_429
- Fetch failure TOU.TO: http_429
- Fetch failure FNV.TO: http_429
- Fetch failure K.TO: http_429
- Fetch failure FTS.TO: http_429
- Fetch failure EMA.TO: http_429
- Fetch failure WCN.TO: http_429
- Fetch failure CSU.TO: http_429
- Fetch failure ATD.TO: http_429
- Fetch failure MRU.TO: http_429
- Fetch failure L.TO: http_429
- No candle/data diagnostics this run.
