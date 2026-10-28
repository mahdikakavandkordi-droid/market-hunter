# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-10-28T01:46:16.333Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 16 | 16 |
| Win rate | 25.0% | 25.0% |
| PF | 0.477 | 0.428 |
| Avg R | -0.311 | -0.361 |

## Realized vs marked paper account

Realized-only equity $971.51; return -2.8%; realized-event max DD -2.8%.
Marked equity $972.10; return -2.8%; observed marked max DD -2.7%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| GE | Short | 299.000 | 297.760 | fresh | $0.54 |
| PM | Long | 202.525 | 202.630 | fresh | $0.05 |

## Evidence integrity

Legacy provenance unknown 1; prospective 5; reconstructed 19; pending 0.
This run discrepancies 13; prior not re-observed 0; candle/data diagnostics 0.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 3 | 33.3% | -0.044 | 0.868 |
| reconstructed | 12 | 25.0% | -0.383 | 0.429 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 3 | 0.0% | -0.582 | 0.000 |
| medium | 7 | 28.6% | -0.390 | 0.431 |
| low | 6 | 33.3% | -0.216 | 0.635 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- No candle/data diagnostics this run.
