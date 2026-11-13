# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-11-13T03:37:54.067Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 14 | 14 |
| Win rate | 50.0% | 50.0% |
| PF | 1.302 | 1.141 |
| Avg R | 0.100 | 0.050 |

## Realized vs marked paper account

Realized-only equity $998.99; return -0.1%; realized-event max DD -3.1%.
Marked equity $999.02; return -0.1%; observed marked max DD -3.2%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| GIL.TO | Short | 47.390 | 49.660 | fresh | $-2.28 |
| PAAS.TO | Short | 56.100 | 53.820 | fresh | $5.05 |
| GWO.TO | Long | 96.000 | 93.880 | fresh | $-2.75 |

## Evidence integrity

Legacy provenance unknown 2; prospective 2; reconstructed 13; pending 0.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 4.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 2 | 50.0% | 0.911 | 15.193 |
| reconstructed | 10 | 50.0% | -0.261 | 0.409 |
| legacy unprovenanced | 2 | 50.0% | 0.748 | 4.290 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 4 | 50.0% | 0.122 | 2.390 |
| medium | 6 | 50.0% | 0.029 | 1.067 |
| low | 4 | 50.0% | 0.011 | 1.021 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":0,"expected":[0,1,2,3],"present":[0]}
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"GSY.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-26","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"WSP.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-22","segment":1,"expected":[4,5,6],"present":[4,6]}
