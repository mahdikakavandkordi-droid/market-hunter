# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-10-22T00:56:51.694Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 4 | 4 |
| Win rate | 50.0% | 50.0% |
| PF | 2.848 | 2.592 |
| Avg R | 0.649 | 0.599 |

## Realized vs marked paper account

Realized-only equity $1014.48; return 1.4%; realized-event max DD -0.7%.
Marked equity $1006.57; return 0.7%; observed marked max DD -1.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| AGI.TO | Short | 43.430 | 44.540 | fresh | $-2.85 |
| CCO.TO | Short | 116.670 | 115.160 | fresh | $0.85 |
| PAAS.TO | Short | 60.220 | 61.290 | fresh | $-1.59 |
| BEP-UN.TO | Short | 39.820 | 40.960 | fresh | $-4.31 |

## Evidence integrity

Legacy provenance unknown 2; prospective 2; reconstructed 5; pending 0.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 3.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 1 | 100.0% | 1.950 | n/a |
| reconstructed | 1 | 0.0% | -1.050 | 0.000 |
| legacy unprovenanced | 2 | 50.0% | 0.748 | 4.290 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 0 | n/a | n/a | n/a |
| medium | 3 | 33.3% | 0.148 | 1.296 |
| low | 1 | 100.0% | 1.950 | n/a |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":0,"expected":[0,1,2,3],"present":[0]}
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"WSP.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-22","segment":1,"expected":[4,5,6],"present":[4,6]}
