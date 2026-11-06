# SMC W-D-4H Forward — crypto-15 — Corrected Evidence v2

Mode: crypto; generated 2026-11-06T06:33:51.070Z; start 2026-10-01; universe 15.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed | 22 | 22 |
| Win rate | 31.8% | 27.3% |
| PF | 0.463 | 0.400 |
| Avg R | -0.246 | -0.296 |

## Realized vs marked paper account

Realized-only equity $955.37; return -4.5%; realized-event max DD -4.5%.
Marked equity $946.11; return -5.4%; observed marked max DD -5.1%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:43.751Z; first complete marked-equity observation 2026-10-04T14:55:43.751Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---|---|---:|
| BCH-USD | Long | 280.770 | 274.700 | 2026-11-06T04:00:00.000Z | fresh | $-3.56 |
| DOGE-USD | Short | 0.072 | 0.072 | 2026-11-06T04:00:00.000Z | fresh | $-0.01 |
| DOT-USD | Short | 0.894 | 0.921 | 2026-11-06T04:00:00.000Z | fresh | $-2.51 |
| SHIB-USD | Short | 0.000 | 0.000 | 2026-11-06T04:00:00.000Z | fresh | $-3.18 |

## Evidence integrity

Legacy provenance unknown 5; prospective 0; reconstructed 23; pending 0.
This run discrepancies 10; prior not re-observed 0; candle/data diagnostics 30.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 17 | 35.3% | -0.277 | 0.475 |
| legacy unprovenanced | 5 | 20.0% | -0.360 | 0.046 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 14 | 28.6% | -0.329 | 0.331 |
| medium | 4 | 25.0% | -0.446 | 0.042 |
| low | 4 | 50.0% | -0.029 | 0.944 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946829000}
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946829000}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946811000}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946823000}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946827000}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946663000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946828000}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946821000}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946821000}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946826000}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946824000}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946824000}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946828000}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946825000}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1793937600000,"t":1793946825000}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1793937600000,"expected":[0,1,2,3],"present":[0,1,2]}
