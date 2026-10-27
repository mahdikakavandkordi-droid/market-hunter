# SMC W-D-4H Forward — crypto-15 — Corrected Evidence v2

Mode: crypto; generated 2026-10-27T02:01:49.147Z; start 2026-10-01; universe 15.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed | 16 | 16 |
| Win rate | 31.3% | 31.3% |
| PF | 0.501 | 0.444 |
| Avg R | -0.271 | -0.321 |

## Realized vs marked paper account

Realized-only equity $968.68; return -3.1%; realized-event max DD -3.2%.
Marked equity $972.52; return -2.7%; observed marked max DD -2.8%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:43.751Z; first complete marked-equity observation 2026-10-04T14:55:43.751Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---|---|---:|
| DOGE-USD | Short | 0.078 | 0.077 | 2026-10-26T20:00:00.000Z | fresh | $1.81 |
| SHIB-USD | Short | 0.000 | 0.000 | 2026-10-26T20:00:00.000Z | fresh | $2.03 |

## Evidence integrity

Legacy provenance unknown 5; prospective 0; reconstructed 13; pending 0.
This run discrepancies 10; prior not re-observed 0; candle/data diagnostics 44.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 11 | 36.4% | -0.303 | 0.546 |
| legacy unprovenanced | 5 | 20.0% | -0.360 | 0.046 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 10 | 20.0% | -0.405 | 0.334 |
| medium | 2 | 50.0% | -0.485 | 0.075 |
| low | 4 | 50.0% | -0.029 | 0.944 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"duplicate_crypto_hour_slot","bucket":1793059200000,"slot":2}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793044800000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793059200000,"expected":[0,1,2,3],"present":[0,1,2]}
