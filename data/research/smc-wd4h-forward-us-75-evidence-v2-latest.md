# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-10-15T00:56:36.143Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 3 | 3 |
| Win rate | 33.3% | 33.3% |
| PF | 1.000 | 0.929 |
| Avg R | 0.000 | -0.050 |

## Realized vs marked paper account

Realized-only equity $993.27; return -0.7%; realized-event max DD -2.1%.
Marked equity $989.15; return -1.1%; observed marked max DD -2.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| FCX | Long | 73.070 | 69.610 | fresh | $-6.87 |
| PG | Long | 150.005 | 156.525 | fresh | $9.43 |
| SBUX | Short | 89.500 | 93.300 | fresh | $-5.03 |
| MS | Short | 179.900 | 181.600 | fresh | $-1.64 |

## Evidence integrity

Legacy provenance unknown 1; prospective 2; reconstructed 10; pending 0.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 2.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 2 | 50.0% | 0.450 | 1.857 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 0 | n/a | n/a | n/a |
| medium | 1 | 0.0% | -1.050 | 0.000 |
| low | 2 | 50.0% | 0.450 | 1.857 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-10-14","segment":1,"expected":[4,5,6],"present":[4,5]}
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-14","segment":1,"expected":[4,5,6],"present":[4,5]}
