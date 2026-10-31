# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-10-31T01:51:55.277Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 20 | 20 |
| Win rate | 25.0% | 25.0% |
| PF | 0.543 | 0.490 |
| Avg R | -0.267 | -0.317 |

## Realized vs marked paper account

Realized-only equity $969.26; return -3.1%; realized-event max DD -3.1%.
Marked equity $969.94; return -3.0%; observed marked max DD -3.0%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| PM | Long | 202.525 | 208.900 | fresh | $3.30 |
| BLK | Long | 1169.710 | 1147.900 | fresh | $-3.22 |
| MA | Long | 636.250 | 638.010 | fresh | $0.59 |

## Evidence integrity

Legacy provenance unknown 1; prospective 5; reconstructed 22; pending 0.
This run discrepancies 10; prior not re-observed 0; candle/data diagnostics 0.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 4 | 25.0% | -0.296 | 0.425 |
| reconstructed | 15 | 26.7% | -0.274 | 0.560 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 4 | 0.0% | -0.494 | 0.000 |
| medium | 8 | 37.5% | -0.121 | 0.799 |
| low | 8 | 25.0% | -0.425 | 0.399 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- No candle/data diagnostics this run.
