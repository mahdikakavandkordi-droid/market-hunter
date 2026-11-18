# SMC W-D-4H Forward — us-75 — Corrected Evidence v2

Generated: 2026-11-18T04:44:40.098Z; forward start: 2026-10-01; universe: 75.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed trades | 37 | 37 |
| Win rate | 37.8% | 35.1% |
| PF | 0.728 | 0.644 |
| Avg R | -0.125 | -0.175 |

## Realized vs marked paper account

Realized-only equity $970.78; return -2.9%; realized-event max DD -3.1%.
Marked equity $981.48; return -1.9%; observed marked max DD -3.0%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:54.783Z; first complete marked-equity observation 2026-10-04T14:55:54.783Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark status | Unrealized P/L |
|---|---:|---:|---:|---|---:|
| NFLX | Short | 62.443 | 59.680 | fresh | $10.85 |
| AXP | Short | 315.700 | 315.890 | fresh | $-0.14 |

## Evidence integrity

Legacy provenance unknown 1; prospective 5; reconstructed 33; pending 0.
This run discrepancies 30; prior not re-observed 0; candle/data diagnostics 1.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 5 | 20.0% | -0.446 | 0.281 |
| reconstructed | 31 | 41.9% | -0.103 | 0.773 |
| legacy unprovenanced | 1 | 0.0% | -1.050 | 0.000 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 15 | 53.3% | 0.125 | 1.499 |
| medium | 12 | 33.3% | -0.266 | 0.546 |
| low | 10 | 20.0% | -0.516 | 0.304 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"TMO","type":"incomplete_or_missing_exchange_bar","date":"2026-11-17","segment":1,"expected":[4,5,6],"present":[4,5]}
