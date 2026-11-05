# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-11-05T03:45:21.160Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 10 | 10 |
| Win rate | 60.0% | 60.0% |
| PF | 2.190 | 1.915 |
| Avg R | 0.295 | 0.245 |

## Realized vs marked paper account

Realized-only equity $1013.01; return 1.3%; realized-event max DD -1.2%.
Marked equity $1022.98; return 2.3%; observed marked max DD -1.8%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| CCO.TO | Short | 105.000 | 100.080 | fresh | $4.25 |
| CTC-A.TO | Long | 206.050 | 209.480 | fresh | $4.22 |
| DOL.TO | Long | 211.960 | 220.060 | fresh | $7.59 |
| TIH.TO | Long | 210.790 | 198.180 | fresh | $-6.08 |

## Evidence integrity

Legacy provenance unknown 2; prospective 2; reconstructed 10; pending 0.
This run discrepancies 4; prior not re-observed 0; candle/data diagnostics 4.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 2 | 50.0% | 0.911 | 15.193 |
| reconstructed | 6 | 66.7% | -0.144 | 0.589 |
| legacy unprovenanced | 2 | 50.0% | 0.748 | 4.290 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 2 | 50.0% | 0.069 | 2.076 |
| medium | 5 | 60.0% | 0.244 | 1.812 |
| low | 3 | 66.7% | 0.365 | 2.043 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":0,"expected":[0,1,2,3],"present":[0]}
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"GSY.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-26","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"WSP.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-22","segment":1,"expected":[4,5,6],"present":[4,6]}
