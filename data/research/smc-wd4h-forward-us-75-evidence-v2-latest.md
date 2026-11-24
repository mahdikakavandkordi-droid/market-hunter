# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-11-24T07:07:25.822Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 38 | 38 |
| Win rate | 39.5% | 36.8% |
| PF | 0.846 | 0.752 |
| Avg R | -0.069 | -0.119 |

## Realized vs marked paper account

Realized-only equity $987.96; return -1.2%; realized-event max DD -3.1%.
Marked equity $986.84; return -1.3%; observed marked max DD -3.0%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| AXP | Short | 315.700 | 307.030 | fresh | $6.48 |
| TGT | Long | 170.655 | 168.200 | fresh | $-1.82 |
| T | Short | 21.890 | 22.320 | fresh | $-4.77 |
| AVGO | Short | 306.990 | 313.540 | fresh | $-1.01 |

## Evidence integrity

Legacy provenance unknown 1; prospective 6; reconstructed 36; pending 0.
This run discrepancies 37; prior not re-observed 1; candle/data diagnostics 2.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 5 | 20.0% | -0.446 | 0.281 |
| reconstructed | 32 | 43.8% | -0.039 | 0.912 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 16 | 56.3% | 0.239 | 2.018 |
| medium | 12 | 33.3% | -0.266 | 0.546 |
| low | 10 | 20.0% | -0.516 | 0.304 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-11-23","segment":1,"expected":[4,5,6],"present":[4,5]}
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-11-23","segment":1,"expected":[4,5,6],"present":[4,5]}
