# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-10-13T03:12:28.107Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 2 | 2 |
| Win rate | 0.0% | 0.0% |
| PF | 0.000 | 0.000 |
| Avg R | -1.000 | -1.050 |

## Realized vs marked paper account

Realized-only equity $979.00; return -2.1%; realized-event max DD -2.1%.
Marked equity $988.16; return -1.2%; observed marked max DD -2.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| FCX | Long | 73.070 | 73.300 | fresh | $0.46 |
| CVX | Long | 208.545 | 215.020 | fresh | $7.76 |
| PG | Long | 150.005 | 153.190 | fresh | $4.61 |
| SBUX | Short | 89.500 | 92.270 | fresh | $-3.67 |

## Evidence integrity

Legacy provenance unknown 1; prospective 2; reconstructed 6; pending 0.
This run discrepancies 0; prior not re-observed 0; candle/data diagnostics 1.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 1 | 0.0% | -1.050 | 0.000 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 0 | n/a | n/a | n/a |
| medium | 1 | 0.0% | -1.050 | 0.000 |
| low | 1 | 0.0% | -1.050 | 0.000 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-10-12","segment":1,"expected":[4,5,6],"present":[4,5]}
