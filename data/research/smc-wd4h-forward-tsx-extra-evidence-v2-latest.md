# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-10-10T01:56:03.718Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 1 | 1 |
| Win rate | 0.0% | 0.0% |
| PF | 0.000 | 0.000 |
| Avg R | -1.000 | -1.050 |

## Realized vs marked paper account

Realized-only equity $993.11; return -0.7%; realized-event max DD -0.7%.
Marked equity $996.60; return -0.3%; observed marked max DD -1.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| SAP.TO | Short | 37.960 | 38.790 | fresh | $-2.58 |
| CVE.TO | Long | 44.260 | 44.760 | fresh | $2.82 |
| WCP.TO | Long | 18.450 | 18.690 | fresh | $3.25 |

## Evidence integrity

Legacy provenance unknown 2; prospective 1; reconstructed 1; pending 0.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 3.

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
| medium | 1 | 0.0% | -1.050 | 0.000 |
| low | 0 | n/a | n/a | n/a |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":0,"expected":[0,1,2,3],"present":[0]}
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"WSP.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-22","segment":1,"expected":[4,5,6],"present":[4,6]}
