# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-11-11T03:05:36.334Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 12 | 12 |
| Win rate | 50.0% | 50.0% |
| PF | 1.213 | 1.074 |
| Avg R | 0.080 | 0.030 |

## Realized vs marked paper account

Realized-only equity $995.47; return -0.5%; realized-event max DD -2.9%.
Marked equity $996.26; return -0.4%; observed marked max DD -3.1%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| CCO.TO | Short | 105.000 | 103.350 | fresh | $1.43 |
| DOL.TO | Long | 211.960 | 215.970 | fresh | $3.76 |
| GIL.TO | Short | 47.390 | 50.610 | fresh | $-3.23 |
| PAAS.TO | Short | 56.100 | 56.620 | fresh | $-1.15 |

## Evidence integrity

Legacy provenance unknown 2; prospective 2; reconstructed 12; pending 0.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 4.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 2 | 50.0% | 0.911 | 15.193 |
| reconstructed | 8 | 50.0% | -0.370 | 0.295 |
| legacy unprovenanced | 2 | 50.0% | 0.748 | 4.290 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 2 | 50.0% | 0.069 | 2.076 |
| medium | 6 | 50.0% | 0.029 | 1.067 |
| low | 4 | 50.0% | 0.011 | 1.021 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":0,"expected":[0,1,2,3],"present":[0]}
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"GSY.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-26","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"WSP.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-22","segment":1,"expected":[4,5,6],"present":[4,6]}
