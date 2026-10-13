# SMC W-D-4H Forward — crypto-15 — Corrected Evidence v2

Mode: crypto; generated 2026-10-13T03:31:30.416Z; start 2026-10-01; universe 15.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed | 14 | 14 |
| Win rate | 28.6% | 28.6% |
| PF | 0.549 | 0.491 |
| Avg R | -0.248 | -0.298 |

## Realized vs marked paper account

Realized-only equity $978.19; return -2.2%; realized-event max DD -3.2%.
Marked equity $978.19; return -2.2%; observed marked max DD -1.8%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:43.751Z; first complete marked-equity observation 2026-10-04T14:55:43.751Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---|---|---:|
| None | | | | | | |

## Evidence integrity

Legacy provenance unknown 5; prospective 0; reconstructed 9; pending 1.
This run discrepancies 1; prior not re-observed 0; candle/data diagnostics 30.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 9 | 33.3% | -0.263 | 0.624 |
| legacy unprovenanced | 5 | 20.0% | -0.360 | 0.046 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 10 | 20.0% | -0.405 | 0.334 |
| medium | 1 | 0.0% | -1.050 | 0.000 |
| low | 3 | 66.7% | 0.311 | 1.889 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862284000}
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862288000}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862281000}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862285000}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862288000}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862204000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862288000}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862288000}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862289000}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862288000}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862282000}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862289000}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862283000}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862288000}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791849600000,"t":1791862271000}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791849600000,"endT":1791864000000}
