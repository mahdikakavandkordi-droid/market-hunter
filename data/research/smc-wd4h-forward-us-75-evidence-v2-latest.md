# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-11-13T03:38:04.653Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 33 | 33 |
| Win rate | 36.4% | 33.3% |
| PF | 0.749 | 0.665 |
| Avg R | -0.117 | -0.167 |

## Realized vs marked paper account

Realized-only equity $981.08; return -1.9%; realized-event max DD -3.1%.
Marked equity $981.80; return -1.8%; observed marked max DD -3.0%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| NKE | Short | 37.935 | 37.763 | fresh | $0.72 |

## Evidence integrity

Legacy provenance unknown 1; prospective 5; reconstructed 31; pending 0.
This run discrepancies 22; prior not re-observed 0; candle/data diagnostics 2.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 5 | 20.0% | -0.446 | 0.281 |
| reconstructed | 27 | 40.7% | -0.082 | 0.819 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 13 | 46.2% | 0.083 | 1.288 |
| medium | 12 | 33.3% | -0.266 | 0.546 |
| low | 8 | 25.0% | -0.425 | 0.399 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-11-12","segment":1,"expected":[4,5,6],"present":[4,5]}
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-11-12","segment":1,"expected":[4,5,6],"present":[4,5]}
