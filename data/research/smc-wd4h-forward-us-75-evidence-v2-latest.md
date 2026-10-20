# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-10-20T01:18:41.117Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 10 | 10 |
| Win rate | 20.0% | 20.0% |
| PF | 0.398 | 0.364 |
| Avg R | -0.443 | -0.493 |

## Realized vs marked paper account

Realized-only equity $972.49; return -2.8%; realized-event max DD -2.8%.
Marked equity $977.67; return -2.2%; observed marked max DD -2.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| PG | Long | 150.005 | 157.710 | fresh | $11.15 |
| MS | Short | 179.900 | 178.470 | fresh | $1.38 |
| CRM | Long | 250.510 | 242.460 | fresh | $-4.48 |
| TMO | Long | 698.000 | 678.650 | fresh | $-2.86 |

## Evidence integrity

Legacy provenance unknown 1; prospective 3; reconstructed 11; pending 0.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 2.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 2 | 50.0% | 0.235 | 2.163 |
| reconstructed | 7 | 14.3% | -0.621 | 0.310 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 1 | 0.0% | -1.050 | 0.000 |
| medium | 5 | 20.0% | -0.665 | 0.208 |
| low | 4 | 25.0% | -0.138 | 0.779 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-10-19","segment":1,"expected":[4,5,6],"present":[4,5]}
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-19","segment":1,"expected":[4,5,6],"present":[4,5]}
