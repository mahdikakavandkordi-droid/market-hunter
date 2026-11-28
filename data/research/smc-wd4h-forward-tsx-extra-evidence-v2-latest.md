# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-11-28T04:59:17.534Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 21 | 21 |
| Win rate | 52.4% | 52.4% |
| PF | 1.967 | 1.728 |
| Avg R | 0.272 | 0.222 |

## Realized vs marked paper account

Realized-only equity $1010.53; return 1.1%; realized-event max DD -3.1%.
Marked equity $1018.03; return 1.8%; observed marked max DD -3.2%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| AGI.TO | Short | 37.670 | 39.770 | fresh | $-2.24 |
| GIB-A.TO | Long | 116.290 | 119.180 | fresh | $6.23 |
| DOL.TO | Long | 222.890 | 223.140 | fresh | $0.28 |
| BEP-UN.TO | Long | 43.800 | 44.500 | fresh | $3.23 |

## Evidence integrity

Legacy provenance unknown 2; prospective 4; reconstructed 22; pending 0.
This run discrepancies 9; prior not re-observed 0; candle/data diagnostics 4.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 3 | 66.7% | 1.257 | 30.386 |
| reconstructed | 16 | 50.0% | -0.038 | 0.896 |
| legacy unprovenanced | 2 | 50.0% | 0.748 | 4.290 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 9 | 55.6% | 0.419 | 3.221 |
| medium | 8 | 50.0% | 0.106 | 1.324 |
| low | 4 | 50.0% | 0.011 | 1.021 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":0,"expected":[0,1,2,3],"present":[0]}
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"GSY.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-26","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"WSP.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-22","segment":1,"expected":[4,5,6],"present":[4,6]}
