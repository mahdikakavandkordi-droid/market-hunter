# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-10-31T01:51:45.833Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 9 | 9 |
| Win rate | 66.7% | 66.7% |
| PF | 3.667 | 3.146 |
| Avg R | 0.439 | 0.389 |

## Realized vs marked paper account

Realized-only equity $1023.76; return 2.4%; realized-event max DD -0.7%.
Marked equity $1015.50; return 1.5%; observed marked max DD -1.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| RCI-B.TO | Short | 43.820 | 45.530 | fresh | $-6.19 |
| CCO.TO | Short | 105.000 | 107.400 | fresh | $-2.07 |

## Evidence integrity

Legacy provenance unknown 2; prospective 2; reconstructed 7; pending 0.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 4.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 2 | 50.0% | 0.911 | 15.193 |
| reconstructed | 5 | 80.0% | 0.038 | 1.179 |
| legacy unprovenanced | 2 | 50.0% | 0.748 | 4.290 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 2 | 50.0% | 0.069 | 2.076 |
| medium | 5 | 60.0% | 0.244 | 1.812 |
| low | 2 | 100.0% | 1.072 | n/a |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":0,"expected":[0,1,2,3],"present":[0]}
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"GSY.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-26","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"WSP.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-22","segment":1,"expected":[4,5,6],"present":[4,6]}
