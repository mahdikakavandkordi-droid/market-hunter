# SMC W-D-4H Forward — crypto-15 — Corrected Evidence v2

Mode: crypto; generated 2026-11-08T05:55:18.501Z; start 2026-10-01; universe 15.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed | 23 | 23 |
| Win rate | 30.4% | 26.1% |
| PF | 0.421 | 0.365 |
| Avg R | -0.279 | -0.329 |

## Realized vs marked paper account

Realized-only equity $945.34; return -5.5%; realized-event max DD -5.5%.
Marked equity $945.52; return -5.4%; observed marked max DD -5.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:43.751Z; first complete marked-equity observation 2026-10-04T14:55:43.751Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---|---|---:|
| DOGE-USD | Short | 0.072 | 0.071 | 2026-11-08T04:00:00.000Z | fresh | $0.78 |
| DOT-USD | Short | 0.894 | 0.892 | 2026-11-08T04:00:00.000Z | fresh | $0.13 |
| SHIB-USD | Short | 0.000 | 0.000 | 2026-11-08T04:00:00.000Z | fresh | $-0.73 |

## Evidence integrity

Legacy provenance unknown 5; prospective 0; reconstructed 23; pending 0.
This run discrepancies 15; prior not re-observed 0; candle/data diagnostics 16.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 18 | 33.3% | -0.320 | 0.425 |
| legacy unprovenanced | 5 | 20.0% | -0.360 | 0.046 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 14 | 28.6% | -0.329 | 0.331 |
| medium | 5 | 20.0% | -0.567 | 0.027 |
| low | 4 | 50.0% | -0.029 | 0.944 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794110400000,"t":1794117184000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1]}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"incomplete_or_missing_crypto_bar","bucket":1794110400000,"expected":[0,1,2,3],"present":[0,1,2]}
