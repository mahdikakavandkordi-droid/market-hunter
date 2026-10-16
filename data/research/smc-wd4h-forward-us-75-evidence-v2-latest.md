# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-10-16T00:48:31.230Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 7 | 7 |
| Win rate | 14.3% | 14.3% |
| PF | 0.333 | 0.310 |
| Avg R | -0.571 | -0.621 |

## Realized vs marked paper account

Realized-only equity $972.49; return -2.8%; realized-event max DD -2.8%.
Marked equity $980.60; return -1.9%; observed marked max DD -2.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| PG | Long | 150.005 | 157.080 | fresh | $10.24 |
| MS | Short | 179.900 | 182.090 | fresh | $-2.12 |

## Evidence integrity

Legacy provenance unknown 1; prospective 2; reconstructed 10; pending 1.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 2.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 6 | 16.7% | -0.550 | 0.371 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 1 | 0.0% | -1.050 | 0.000 |
| medium | 3 | 0.0% | -1.050 | 0.000 |
| low | 3 | 33.3% | -0.050 | 0.929 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-10-15","segment":1,"expected":[4,5,6],"present":[4,5]}
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-15","segment":1,"expected":[4,5,6],"present":[4,5]}
