# SMC W-D-4H Forward — crypto-15 — Corrected Evidence v2

Mode: crypto; generated 2026-10-12T02:20:57.894Z; start 2026-10-01; universe 15.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed | 12 | 12 |
| Win rate | 25.0% | 25.0% |
| PF | 0.618 | 0.558 |
| Avg R | -0.213 | -0.263 |

## Realized vs marked paper account

Realized-only equity $986.61; return -1.3%; realized-event max DD -3.2%.
Marked equity $996.46; return -0.4%; observed marked max DD -0.5%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:43.751Z; first complete marked-equity observation 2026-10-04T14:55:43.751Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---|---|---:|
| XLM-USD | Long | 0.196 | 0.203 | 2026-10-11T20:00:00.000Z | fresh | $6.80 |
| LINK-USD | Long | 13.123 | 13.285 | 2026-10-11T20:00:00.000Z | fresh | $3.04 |

## Evidence integrity

Legacy provenance unknown 5; prospective 0; reconstructed 9; pending 0.
This run discrepancies 48; prior not re-observed 0; candle/data diagnostics 38.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 7 | 28.6% | -0.193 | 0.743 |
| legacy unprovenanced | 5 | 20.0% | -0.360 | 0.046 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 10 | 20.0% | -0.405 | 0.334 |
| medium | 0 | n/a | n/a | n/a |
| low | 2 | 50.0% | 0.450 | 1.857 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771656000}
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791748800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771655000}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771655000}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791748800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771654000}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791748800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771654000}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771362000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771654000}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771646000}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791748800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771640000}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791748800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771660000}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791748800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771651000}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771652000}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791748800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771656000}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771632000}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791763200000,"t":1791771634000}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791748800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1791763200000,"expected":[0,1,2,3],"present":[0,1,2]}
