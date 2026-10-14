# Frozen research-v3 comparison protocol, 14 October 2026

This protocol defines a new exploratory historical experiment. The 2020–2026 period has already been inspected. No retrospective result from it is a new blind holdout. No live allocation, production integration or scheduled collection is authorized by this implementation.

## Evidence contract

Use a new output directory for every run. Save exact raw response bytes privately, normalized bars and hashes, provider retrieval time, exchange timezone/session completion rules, code-file hashes and source snapshots, git SHA/dirty status, fit snapshots, forecasts, baselines, label maturity and outcome timestamps. Do not publish raw provider history to the public repository. `--input-bundle` verifies file/configuration/source hashes and replays offline without network access. `--data-bundle` verifies input integrity but permits a new code version on preserved inputs; it is explicitly labelled a new experiment with parent-manifest hash. A corrected code version/data vintage must be labelled separately rather than overwriting records.

Original two Actions JSON summaries are retained in `original-evidence/`, unchanged. They contain no raw history. Their original limitations remain; a new download cannot retroactively restore original point-in-time data.

## Targets and fit rules

Nine instruments, native observed daily bars, horizons 5/10/20. At least 252 matured future-window targets, initial feature origin t=60, expanding history, refit 21 native bars. Daily-close RMS return is the existing volatility target. Variance is mean future squared log returns. Estimates are available after the decision bar is complete, not at an executable same-close price.

Retain the original log-RMS ridge (lambda 20 summed loss, training-only normalization, no retransformation correction). The forecasts squared for variance scoring are explicitly not guaranteed conditional-mean variance estimates. The additional linear-variance HAR-style model uses daily/5/22-bar average squared close returns, ridge 20 and positive floor 1e-12. It is not classical intraday HAR-RV.

Fixed benchmarks: trailing RMS 5/20/60; original expanding mean future RMS; expanding mean future variance; EWMA decay .94; 50% current vol20 variance / 50% historical mean variance; restricted zero-mean variance-targeted Gaussian GARCH(1,1). GARCH uses a fixed alpha grid [.03,.07,.12,.18], beta [.7,.8,.9,.95] with alpha+beta<.999 and omega=training second moment*(1-alpha-beta); grid selection minimizes training Gaussian likelihood only. This is a limited benchmark, not an unrestricted maximum-likelihood GARCH implementation. No benchmark is chosen by OOS performance.

## Data semantics

Indices/crypto use raw closes; GLD/SLV/USO require adjusted closes consistently. Invalid expected observations and duplicate/unordered dates fail explicitly. Do not remove negative futures prices and cross the missing session. Revised macro oil input is fixed as USO and identified as an ETF proxy, not spot oil or a futures investment return. No silent symbol substitution. Index price returns and ETF adjusted returns remain different economic concepts.

Crypto sessions: UTC calendar date, completion at next midnight plus 10-minute publication buffer. Other supported North American series: local regular close 16:00 plus 30-minute buffer; DXY uses 23:59 local and VIX a conservative 16:15 exchange-local close, DST handled explicitly. Early-close sessions are conservatively delayed, not used early. Retrieval-time vintages and historical corrections remain limitations. Fully empty weekend/known US or Canadian exchange-holiday placeholders are excluded with recorded reasons; unexplained missing session prices and weekday gaps fail. Native trading holidays are not imputed; long gaps are flagged for review, not assumed valid. Market proxies use previous calendar dates and maximum eight-day staleness. Their actual recorded availability must also precede the decision. These proxies are not point-in-time macro release data such as CPI/GDP.

## Diagnostics and historical inference

Report volatility MSE/MAE, variance MSE and positive-forecast QLIKE log(f)+q/f. Do not calculate a ratio skill on additive QLIKE, which can be negative. Paired candidate-minus-benchmark losses preserve the common evaluation dates. Negative paired differences favor the candidate.

Primary exploratory family: original HAR log-RMS candidate vs EWMA on variance QLIKE, all nine markets and three horizons (27 comparisons), two-sided centered moving-block bootstrap p-values and Holm adjustment. Fixed seed 20261014, 999 resamples, circular blocks 2h, sensitivity h and 4h. Approximate stationarity is required; changing regimes and cross-market dependence limit interpretation. Additional models/losses are secondary exploratory diagnostics. Holm handles dependence in a fixed family if underlying p-values are valid; it does not correct all prior researcher choices or make historical tests confirmatory.

Inspect every non-overlap offset, without selecting the best. Origins must be contiguous native bar indexes. Non-overlap removes target sharing, not all serial dependence. Report origin-year absolute losses and leave-one-year-out summaries; targets can cross year boundaries. Regime classification is causal close/SMA200 and trailing volatility median. It remains descriptive and does not choose trades or fit regime-dependent forecasts. Report occupancy and contiguous episodes.

Calibration uses fixed daily RMS bins 0–.5%, .5–1%, 1–2%, 2–4%, 4–8%, 8%+, descriptive slope/intercept and high-risk (>2% realized RMS) underprediction. No outcome-driven bin selection or calibration fit. Direction records include probability reliability bins, log loss, zero-return and daily-updated-own-price baselines, and legacy logistic gradient diagnostics. Macro and own-price models share eligible fit/evaluation dates; daily-updated own baselines may have broader historical eligibility and are identified separately.

## Gate for a future blind experiment

First review the corrected exploratory output and benchmark competitiveness. Before any future archive is activated, freeze code/model hashes, instruments, targets, forecast cutoff, primary tests, minimum useful improvement, observation period, archive ownership/retention and missing-forecast policy. Choose duration from prospective precision/power and serial dependence, not by checking results until significance appears. Future forecasts must be timestamped before target windows start; outcomes append only at maturity. Model changes create a new validation version. No retrospective backfill is allowed.

Forecasting quality is not portfolio performance. A later independent risk-policy experiment must include covariance, risk tracking/overshoots, exposure limits, turnover and costs. No such utility study is implemented here.

Calendar references: https://www.nyse.com/markets/hours-calendars , the 9 January 2025 closure notice https://www.nyse.com/publicdocs/nyse/markets/american-options/rule-interpretations/2025/National_Day_of_Mourning_20250102.pdf , and https://www.tsx.com/en/trading/calendars-and-trading-hours/calendar . Empty holiday placeholders are handled as metadata, not as returns. Canada follows the TSX holiday rules independently of US closures. Unexpected future special closures require an explicit calendar update, not silent data removal.
