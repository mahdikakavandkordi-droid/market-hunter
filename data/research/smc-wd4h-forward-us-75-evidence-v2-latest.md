# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-10-27T01:38:13.542Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 14 | 14 |
| Win rate | 28.6% | 28.6% |
| PF | 0.510 | 0.462 |
| Avg R | -0.310 | -0.360 |

## Realized vs marked paper account

Realized-only equity $978.59; return -2.1%; realized-event max DD -2.8%.
Marked equity $979.28; return -2.1%; observed marked max DD -2.5%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| CRM | Long | 250.510 | 247.550 | fresh | $-1.65 |
| TMO | Long | 698.000 | 684.890 | fresh | $-1.94 |
| GE | Short | 299.000 | 288.360 | fresh | $4.62 |
| PM | Long | 202.525 | 201.870 | fresh | $-0.34 |

## Evidence integrity

Legacy provenance unknown 1; prospective 4; reconstructed 17; pending 1.
This run discrepancies 4; prior not re-observed 0; candle/data diagnostics 0.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 2 | 50.0% | 0.235 | 2.163 |
| reconstructed | 11 | 27.3% | -0.406 | 0.436 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 2 | 0.0% | -0.808 | 0.000 |
| medium | 6 | 33.3% | -0.355 | 0.493 |
| low | 6 | 33.3% | -0.216 | 0.635 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- No candle/data diagnostics this run.
