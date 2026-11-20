# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-11-20T04:20:47.076Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 16 | 16 |
| Win rate | 50.0% | 50.0% |
| PF | 1.731 | 1.515 |
| Avg R | 0.213 | 0.163 |

## Realized vs marked paper account

Realized-only equity $1016.85; return 1.7%; realized-event max DD -3.1%.
Marked equity $1013.24; return 1.3%; observed marked max DD -3.2%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| GWO.TO | Long | 96.000 | 93.090 | fresh | $-3.77 |
| FM.TO | Short | 30.100 | 27.860 | fresh | $4.16 |
| BEP-UN.TO | Long | 43.930 | 43.070 | fresh | $-4.42 |
| AGI.TO | Short | 37.670 | 37.270 | fresh | $0.43 |

## Evidence integrity

Legacy provenance unknown 2; prospective 2; reconstructed 17; pending 1.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 4.

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
