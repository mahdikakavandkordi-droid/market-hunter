# SMC W-D-4H Forward — crypto-15 — Corrected Evidence v2

Mode: crypto; generated 2026-11-10T07:11:05.330Z; start 2026-10-01; universe 15.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed | 29 | 29 |
| Win rate | 34.5% | 31.0% |
| PF | 0.450 | 0.379 |
| Avg R | -0.223 | -0.273 |

## Realized vs marked paper account

Realized-only equity $943.81; return -5.6%; realized-event max DD -5.6%.
Marked equity $942.73; return -5.7%; observed marked max DD -5.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:43.751Z; first complete marked-equity observation 2026-10-04T14:55:43.751Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---|---|---:|
| TRX-USD | Short | 0.316 | 0.318 | 2026-11-10T04:00:00.000Z | fresh | $-1.09 |

## Evidence integrity

Legacy provenance unknown 5; prospective 0; reconstructed 25; pending 0.
This run discrepancies 110; prior not re-observed 0; candle/data diagnostics 30.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 24 | 37.5% | -0.255 | 0.436 |
| legacy unprovenanced | 5 | 20.0% | -0.360 | 0.046 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 17 | 35.3% | -0.266 | 0.351 |
| medium | 8 | 25.0% | -0.411 | 0.109 |
| low | 4 | 50.0% | -0.029 | 0.944 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294658000}
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294660000}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294644000}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294660000}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294660000}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294485000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294641000}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294645000}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294655000}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294652000}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294652000}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294663000}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294652000}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294645000}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1794283200000,"t":1794294644000}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1794283200000,"endT":1794297600000}
