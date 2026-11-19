# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-11-19T04:33:03.946Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 16 | 16 |
| Win rate | 50.0% | 50.0% |
| PF | 1.731 | 1.515 |
| Avg R | 0.213 | 0.163 |

## Realized vs marked paper account

Realized-only equity $1016.85; return 1.7%; realized-event max DD -3.1%.
Marked equity $1016.88; return 1.7%; observed marked max DD -3.2%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| GWO.TO | Long | 96.000 | 94.370 | fresh | $-2.11 |
| FM.TO | Short | 30.100 | 28.390 | fresh | $3.18 |
| BEP-UN.TO | Long | 43.930 | 43.730 | fresh | $-1.03 |

## Evidence integrity

Legacy provenance unknown 2; prospective 2; reconstructed 16; pending 0.
This run discrepancies 4; prior not re-observed 0; candle/data diagnostics 4.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 2 | 50.0% | 0.911 | 15.193 |
| reconstructed | 12 | 50.0% | -0.059 | 0.840 |
| legacy unprovenanced | 2 | 50.0% | 0.748 | 4.290 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 5 | 60.0% | 0.488 | 7.940 |
| medium | 7 | 42.9% | 0.017 | 1.046 |
| low | 4 | 50.0% | 0.011 | 1.021 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":0,"expected":[0,1,2,3],"present":[0]}
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"GSY.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-26","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"WSP.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-22","segment":1,"expected":[4,5,6],"present":[4,6]}
