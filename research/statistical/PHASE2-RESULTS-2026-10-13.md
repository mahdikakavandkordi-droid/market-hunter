# Phase-2 cross-asset statistics — exploratory evidence (as of 2026-10-13)

Run: https://github.com/mahdikakavandkordi-droid/market-hunter/actions/runs/38508314801

**Status:** Not validated alpha; no signals, allocations, execution or production engine changes.

## Input and validity

- Yahoo Finance daily close / adjusted ETF closes, 2020–2026; full data date and source in downloadable GitHub Actions JSON artifact. Crypto's latest complete bar: 2026-10-12.
- 9 instruments: S&P/TSX Composite, S&P 500, NASDAQ 100, Dow, Russell 2000; GLD, SLV ETFs; BTC/USD and ETH/USD.
- HAR-style volatility from DAILY CLOSE RETURNS, NOT true high-frequency HAR-RV. 5/10/20 future bar RMS daily log returns predicted from trailing 5/20/60 vol with fixed-penalty ridge regression. Strictly matured labels, expanding retraining every 21 bars. 252 historical labels required.
- Compare future squared-error volatility forecasts with (a) naive current 20-bar RMS volatility, (b) expanding historical mean of future RMS vol.
- Macro direction candidate: own price history + strictly PREVIOUS CALENDAR DAY VIX, US10Y, DXY, WTI oil, S&P 500; compared against SAME-DATES own-price-only model and historical positive rate. Historical window is **reused after earlier analysis**. This is exploratory testing, not a new unbiased holdout.
- Synthetic-feature invariants pass; all 9 market data series and all 4 external source series fetched (zero errors). See Actions artifacts for full precision.

## 20-bar future volatility MSE improvement (positive = lower MSE)

| Asset | vs current vol20, all overlapping predictions | vs historic mean, all overlapping predictions | vs vol20, disjoint forecasts (h=20) | vs historic mean, disjoint |
|---|---:|---:|---:|---:|
| TSX | +29.9% | +12.7% | +35.1% | +15.3% |
| S&P 500 | +17.3% | +28.9% | +14.1% | +28.4% |
| NASDAQ 100 | +14.5% | +34.6% | +8.6% | +34.9% |
| Dow | +24.7% | +27.1% | +25.7% | +26.0% |
| Russell 2000 | +29.1% | +25.7% | +29.2% | +29.8% |
| Gold proxy (GLD) | +9.3% | +15.5% | +3.0% | +15.9% |
| Silver proxy (SLV) | +0.7% | +30.4% | **-12.1%** | +31.8% |
| Bitcoin | +28.1% | +28.8% | +30.8% | +29.8% |
| Ethereum | +31.4% | +27.3% | +34.2% | +28.1% |

Disjoint sample has only **68 observations per ETF/index** and **107 per crypto** at 20-bar horizon. These are NOT significance tests. Comparing only one aligned subsample can introduce phase sensitivity. More independent prospective evidence is needed.

## Year-to-year instability (vs vol20, 20-bar horizon)

- NASDAQ: -46.3% in 2021, -37.3% in 2022, then positive each of 2023–2026.
- S&P 500: -43.5% in 2022; positive in 2021 and 2023–2026.
- Gold: -2.1% in 2021 and -8.6% in 2026; positive 2022–2025.
- Silver: -598% in 2021 and -26.4% in 2025, otherwise positive; very unstable relative to the comparator.
- BTC: -150.7% in 2020 and -4.2% in 2021, then positive 2022–2026.
- ETH: -58.6% in 2023, positive in remaining sampled years.
- TSX and Russell 2000: positive vs vol20 in each available scored calendar year, but this is exploratory and overlapping.

**Do not call a strategy profitable or reliable merely because aggregate MSE improved.** These scores measure forecast volatility, not investment gains or directional edge.

## Macro model (5/10/20-bar Brier skill)

Additional lagged VIX, 10-year yield, DXY, WTI and SPX data made probability forecasts WORSE than the price-only model on ALL 27 market-horizon comparisons. For 20-bar horizon, Brier skill macro-vs-price-only: TSX -12.7%, S&P 500 -8.5%, NASDAQ -10.3%, Dow -8.8%, Russell -9.2%, GLD -9.9%, SLV -11.3%, BTC -5.0%, ETH -5.1%.
Disjoint-sample Brier results remained negative in all nine markets at 20 bars.

This does NOT prove macroeconomic drivers never help. It shows that the **tested fixed lagged price proxies** and a heavily regularized logistic model failed to improve predictive calibration.

## Regime analysis

Simple four-way grouping by close above/below 200-bar SMA and 20-bar volatility above/below its trailing 252-session median was computed. The group frequencies and forward returns are saved in the JSON report, but are **descriptive**, strongly overlapping and not tested as a live selection strategy.

## Next gates (precommitted before any deployment)

1. Preserve the current code and model parameters (no tuning against the 2020–2026 OOS window).
2. Collect *new future observations* with versioned daily as-of predictions and immutable outcome maturity.
3. Evaluate probability calibration, realized vs predicted risk, adverse-volatility events and confidence intervals under non-overlap/block bootstrap; evaluate execution only as a separate later study.
4. Do not merge macro features or volatility outputs into existing Market Hunter or SMC; the PR is intentionally draft.
