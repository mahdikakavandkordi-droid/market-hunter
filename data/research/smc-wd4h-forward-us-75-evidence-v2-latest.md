# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-11-26T05:29:33.782Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 39 | 39 |
| Win rate | 38.5% | 35.9% |
| PF | 0.799 | 0.711 |
| Avg R | -0.093 | -0.143 |

## Realized vs marked paper account

Realized-only equity $978.30; return -2.2%; realized-event max DD -3.1%.
Marked equity $984.75; return -1.5%; observed marked max DD -3.0%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| AXP | Short | 315.700 | 312.560 | fresh | $2.35 |
| TGT | Long | 170.655 | 172.160 | fresh | $1.12 |
| AVGO | Short | 306.990 | 300.555 | fresh | $0.99 |
| LOW | Long | 231.395 | 235.660 | fresh | $2.00 |

## Evidence integrity

Legacy provenance unknown 1; prospective 6; reconstructed 37; pending 0.
This run discrepancies 37; prior not re-observed 1; candle/data diagnostics 2.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 6 | 16.7% | -0.547 | 0.210 |
| reconstructed | 32 | 43.8% | -0.039 | 0.912 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 16 | 56.3% | 0.239 | 2.018 |
| medium | 13 | 30.8% | -0.326 | 0.475 |
| low | 10 | 20.0% | -0.516 | 0.304 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-11-25","segment":1,"expected":[4,5,6],"present":[4,5]}
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-11-25","segment":1,"expected":[4,5,6],"present":[4,5]}
