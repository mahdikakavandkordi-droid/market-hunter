# SMC W-D-4H Forward — tsx-extra — Corrected Evidence v2

Generated: 2026-10-04T19:37:34.323Z; forward start: 2026-10-01; universe: 37.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 0 | 0 |
| Win rate | n/a | n/a |
| PF | n/a | n/a |
| Avg R | n/a | n/a |

## Realized vs marked paper account

Realized-only equity $1000.00; return 0.0%; realized-event max DD 0.0%.
Marked equity $1008.89; return 0.9%; observed marked max DD 0.0%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:45.085Z; first complete marked-equity observation 2026-10-04T14:55:45.085Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| SAP.TO | Short | 37.960 | 38.680 | fresh | $-2.24 |
| CVE.TO | Long | 44.260 | 46.230 | fresh | $11.13 |

## Evidence integrity

Legacy provenance unknown 2; prospective 0; reconstructed 0; pending 0.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 3.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 0 | n/a | n/a | n/a |
| legacy unprovenanced | 0 | n/a | n/a | n/a |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 0 | n/a | n/a | n/a |
| medium | 0 | n/a | n/a | n/a |
| low | 0 | n/a | n/a | n/a |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":0,"expected":[0,1,2,3],"present":[0]}
- Data diagnostic: {"symbol":"FM.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-30","segment":1,"expected":[4,5,6],"present":[5,6]}
- Data diagnostic: {"symbol":"WSP.TO","type":"incomplete_or_missing_exchange_bar","date":"2026-09-22","segment":1,"expected":[4,5,6],"present":[4,6]}
