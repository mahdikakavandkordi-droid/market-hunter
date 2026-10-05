# SMC W-D-4H Forward — crypto-15 — Corrected Evidence v2

Mode: crypto; generated 2026-10-05T23:23:12.118Z; start 2026-10-01; universe 15.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed | 5 | 5 |
| Win rate | 40.0% | 40.0% |
| PF | 0.712 | 0.646 |
| Avg R | -0.173 | -0.223 |

## Realized vs marked paper account

Realized-only equity $984.71; return -1.5%; realized-event max DD -1.5%.
Marked equity $981.81; return -1.8%; observed marked max DD -0.5%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:43.751Z; first complete marked-equity observation 2026-10-04T14:55:43.751Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---|---|---:|
| BNB-USD | Long | 789.570 | 787.320 | 2026-10-05T20:00:00.000Z | fresh | $-0.70 |
| BCH-USD | Long | 319.860 | 315.360 | 2026-10-05T20:00:00.000Z | fresh | $-2.76 |
| XRP-USD | Long | 1.500 | 1.503 | 2026-10-05T20:00:00.000Z | fresh | $0.56 |

## Evidence integrity

Legacy provenance unknown 5; prospective 0; reconstructed 5; pending 0.
This run discrepancies 1; prior not re-observed 0; candle/data diagnostics 30.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 3 | 33.3% | -0.050 | 0.929 |
| legacy unprovenanced | 2 | 50.0% | -0.482 | 0.082 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 5 | 40.0% | -0.223 | 0.646 |
| medium | 0 | n/a | n/a | n/a |
| low | 0 | n/a | n/a | n/a |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242587000}
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242588000}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242583000}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242590000}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242588000}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242524000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242593000}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242588000}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242576000}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242590000}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242553000}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242588000}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242587000}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242593000}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"off_crypto_hour_grid","bucket":1791230400000,"t":1791242573000}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1791230400000,"endT":1791244800000}
