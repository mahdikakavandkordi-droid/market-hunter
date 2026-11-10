# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-11-10T04:48:34.422Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 25 | 25 |
| Win rate | 28.0% | 24.0% |
| PF | 0.635 | 0.571 |
| Avg R | -0.192 | -0.242 |

## Realized vs marked paper account

Realized-only equity $968.95; return -3.1%; realized-event max DD -3.1%.
Marked equity $980.86; return -1.9%; observed marked max DD -3.0%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| BLK | Long | 1169.710 | 1214.700 | fresh | $6.63 |
| MA | Long | 636.250 | 655.650 | fresh | $6.48 |
| COST | Long | 1039.735 | 1066.110 | fresh | $4.22 |
| AVGO | Short | 297.570 | 319.530 | fresh | $-5.43 |

## Evidence integrity

Legacy provenance unknown 1; prospective 5; reconstructed 30; pending 0.
This run discrepancies 19; prior not re-observed 0; candle/data diagnostics 2.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 5 | 20.0% | -0.446 | 0.281 |
| reconstructed | 19 | 31.6% | -0.145 | 0.722 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 6 | 16.7% | -0.085 | 0.794 |
| medium | 11 | 36.4% | -0.195 | 0.642 |
| low | 8 | 25.0% | -0.425 | 0.399 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-11-09","segment":1,"expected":[4,5,6],"present":[4,5]}
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-11-09","segment":1,"expected":[4,5,6],"present":[4,5]}
