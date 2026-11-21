# SMC W-D-4H Forward — crypto-15 — Corrected Evidence v2

Mode: crypto; generated 2026-11-21T06:59:11.981Z; start 2026-10-01; universe 15.

Frozen strategy rules are unchanged. Pre-audit v1 is preserved at research commit 1523e4adde5f3be5ff3d08a36fa79f1ba06d5c28.

| Metric | Raw | +0.05R cost |
|---|---:|---:|
| Closed | 33 | 33 |
| Win rate | 39.4% | 36.4% |
| PF | 0.798 | 0.686 |
| Avg R | -0.073 | -0.123 |

## Realized vs marked paper account

Realized-only equity $981.66; return -1.8%; realized-event max DD -5.7%.
Marked equity $1012.79; return 1.3%; observed marked max DD -5.4%; quality fresh.
Marked-series coverage begins 2026-10-04T14:55:43.751Z; first complete marked-equity observation 2026-10-04T14:55:43.751Z; no historical intraday marked DD is implied.
Missing/invalid marks: none; stale marks: none.
Cost accounting: 0.05R is charged once when a trade settles; open marked equity does not assume or double-charge a future exit cost.

### Open positions

| Symbol | Dir | Entry | Mark | Mark time | Mark status | Unrealized P/L |
|---|---:|---:|---|---|---:|
| XLM-USD | Short | 0.134 | 0.122 | 2026-11-21T04:00:00.000Z | fresh | $14.37 |
| XRP-USD | Short | 0.951 | 0.880 | 2026-11-21T04:00:00.000Z | fresh | $14.56 |
| TRX-USD | Short | 0.303 | 0.300 | 2026-11-21T04:00:00.000Z | fresh | $2.20 |

## Evidence integrity

Legacy provenance unknown 5; prospective 0; reconstructed 31; pending 0.
This run discrepancies 116; prior not re-observed 0; candle/data diagnostics 15.

### Performance by evidence provenance

| Evidence class | Closed | Win rate | Avg R after 0.05R cost | PF after 0.05R cost |
|---|---:|---:|---:|---:|
| prospective | 0 | n/a | n/a | n/a |
| reconstructed | 28 | 42.9% | -0.080 | 0.796 |
| legacy unprovenanced | 5 | 20.0% | -0.360 | 0.046 |

## Momentum shadow (observational only)

| Bucket | Closed | Win rate | Avg R after cost | PF after cost |
|---|---:|---:|---:|---:|
| high | 20 | 45.0% | -0.024 | 0.930 |
| medium | 9 | 22.2% | -0.383 | 0.104 |
| low | 4 | 50.0% | -0.029 | 0.944 |
| unavailable | 0 | n/a | n/a | n/a |

## Fetch/data gaps

- No fetch failures this run.
- Data diagnostic: {"symbol":"BTC-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"ETH-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"BNB-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"XRP-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"SOL-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"TRX-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"DOGE-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"LINK-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"ADA-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"XLM-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"BCH-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"LTC-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"AVAX-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"DOT-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
- Data diagnostic: {"symbol":"SHIB-USD","mode":"crypto","type":"live_incomplete_crypto_bar_dropped","bucket":1795233600000,"endT":1795248000000}
