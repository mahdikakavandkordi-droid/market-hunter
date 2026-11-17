# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-11-17T05:15:39.478Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 35 | 35 |
| Win rate | 37.1% | 34.3% |
| PF | 0.734 | 0.649 |
| Avg R | -0.122 | -0.172 |

## Realized vs marked paper account

Realized-only equity $981.08; return -1.9%; realized-event max DD -3.1%.
Marked equity $986.25; return -1.4%; observed marked max DD -3.0%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| NKE | Short | 37.935 | 38.285 | fresh | $-1.48 |
| NFLX | Short | 62.443 | 60.750 | fresh | $6.65 |

## Evidence integrity

Legacy provenance unknown 1; prospective 5; reconstructed 32; pending 0.
This run discrepancies 32; prior not re-observed 0; candle/data diagnostics 2.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 5 | 20.0% | -0.446 | 0.281 |
| reconstructed | 29 | 41.4% | -0.094 | 0.790 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 14 | 50.0% | 0.092 | 1.342 |
| medium | 12 | 33.3% | -0.266 | 0.546 |
| low | 9 | 22.2% | -0.457 | 0.354 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"EOG","type":"incomplete_or_missing_exchange_bar","date":"2026-11-16","segment":1,"expected":[4,5,6],"present":[4,5]}
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-11-16","segment":1,"expected":[4,5,6],"present":[4,5]}
