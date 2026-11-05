# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-11-05T03:45:32.706Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 23 | 23 |
| Win rate | 26.1% | 26.1% |
| PF | 0.636 | 0.576 |
| Avg R | -0.207 | -0.257 |

## Realized vs marked paper account

Realized-only equity $969.26; return -3.1%; realized-event max DD -3.1%.
Marked equity $995.18; return -0.5%; observed marked max DD -3.0%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| PM | Long | 202.525 | 211.340 | fresh | $4.57 |
| BLK | Long | 1169.710 | 1224.515 | fresh | $8.08 |
| MA | Long | 636.250 | 672.690 | fresh | $12.18 |
| COST | Long | 1039.735 | 1046.580 | fresh | $1.09 |

## Evidence integrity

Legacy provenance unknown 1; prospective 5; reconstructed 27; pending 0.
This run discrepancies 25; prior not re-observed 0; candle/data diagnostics 1.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 5 | 20.0% | -0.446 | 0.281 |
| reconstructed | 17 | 29.4% | -0.155 | 0.731 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 6 | 16.7% | -0.085 | 0.794 |
| medium | 9 | 33.3% | -0.224 | 0.656 |
| low | 8 | 25.0% | -0.425 | 0.399 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-11-04","segment":1,"expected":[4,5,6],"present":[4,5]}
