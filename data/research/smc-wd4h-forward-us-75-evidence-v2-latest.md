# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-10-22T00:57:00.831Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 11 | 11 |
| Win rate | 27.3% | 27.3% |
| PF | 0.567 | 0.519 |
| Avg R | -0.289 | -0.339 |

## Realized vs marked paper account

Realized-only equity $984.21; return -1.6%; realized-event max DD -2.8%.
Marked equity $973.60; return -2.6%; observed marked max DD -2.5%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| MS | Short | 179.900 | 187.110 | fresh | $-6.98 |
| CRM | Long | 250.510 | 241.680 | fresh | $-4.92 |
| TMO | Long | 698.000 | 697.330 | fresh | $-0.10 |
| GE | Short | 299.000 | 295.835 | fresh | $1.37 |

## Evidence integrity

Legacy provenance unknown 1; prospective 3; reconstructed 14; pending 0.
This run discrepancies 6; prior not re-observed 0; candle/data diagnostics 2.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 2 | 50.0% | 0.235 | 2.163 |
| reconstructed | 8 | 25.0% | -0.394 | 0.500 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 1 | 0.0% | -1.050 | 0.000 |
| medium | 6 | 33.3% | -0.355 | 0.493 |
| low | 4 | 25.0% | -0.138 | 0.779 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-10-21","segment":1,"expected":[4,5,6],"present":[4,5]}
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-21","segment":1,"expected":[4,5,6],"present":[4,5]}
