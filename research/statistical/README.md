# Cross-asset statistical forecasts (isolated research v0.1)

STATUS: Research only. No Market Hunter scanner changes, SMC engine edits, live portfolio writes, Telegram signals, production deployments or trade execution.

## Instruments and sources

Five exact index symbols: ^GSPTSE (S&P/TSX Composite), ^GSPC (S&P 500), ^NDX (Nasdaq 100), ^DJI (Dow), ^RUT (Russell 2000).
Gold and silver: GLD and SLV are US-listed ETF proxies, not spot XAU/USD or XAG/USD and not CAD ETFs.
Crypto: BTC-USD, ETH-USD. Primary runner fetches Yahoo Finance chart data.
CSV alternative: --csv-dir DIR, named tsx.csv, sp500.csv, nasdaq100.csv, dow.csv, russell2000.csv, gold.csv, silver.csv, btc.csv, eth.csv. Each has Date,Close columns. Do not publish licensed raw vendor history.

## Method

- Features available at close t only: 1/5/20/60-bar log returns, gap from 20-bar SMA, trailing 20-bar realized daily volatility.
- Ridge regression predicts future h-bar log return. L2 logistic regression estimates probability of a positive future h-bar return, for horizons 5, 10, 20.
- Regularization lambda=20 is fixed (no optimization on the holdout period).
- Expanding forward-only evaluation. At least 252 training outcomes must be known. The h-bar forecast label for a historical sample is admitted only after its endpoint is observed. Refit models every 21 bars, without training on future outcomes.
- Baselines: historical mean return for MSE and MAE; historical positive rate for directional accuracy and Brier scores; trailing 20-bar momentum directional rule as additional comparator.
- Report Brier skill, return MSE skill, accuracy, errors, and non-overlapping accuracy subsample.
- Trading session horizon for indices/ETFs differs from calendar-day horizon for crypto (which trades weekends).

## Commands

1. node research/statistical/test.mjs
2. node research/statistical/run.mjs --from 2020-01-01 --asof 2026-10-13
3. Or node research/statistical/run.mjs --asof 2026-10-13 --csv-dir ./data/csv

Runner creates results.json and reports unavailable inputs explicitly. The GitHub workflow writes an aggregate JSON artifact without rehosting raw provider data.

## Interpretation and limitations

A positive Brier skill relative to the expanding historic up-rate baseline is necessary but insufficient evidence of value. High directional accuracy can be worse than always-up in a bull market.

Overlapping h-bar labels yield dependent forecast outcomes, so reported OOS counts are not independent trials. The non-overlap count helps illustrate this limitation, but is not a confidence interval. We have not tested real trading profits, transaction costs, FX, slippage, taxes, execution assumptions, confidence intervals or annual holdout stability.

US-listed ETF prices and index levels are not directly interchangeable with Canadian-traded instruments. Adjusted ETF closes and index prices can represent different return concepts.

If Yahoo blocks automated access (HTTP 403/429), mark that market as untested, not as a success or failure. Avoid searching hyperparameters until a blind forward validation and a prespecified model comparison protocol exist.
