# Gold prediction experiment 1

## Decision

Do not deploy this model. A first actual XAUUSD experiment has completed, including training, chronological model selection and a one-time final test. It found a small conditional probability effect but did not establish reliable market timing. No orders, production routes or existing trading engines changed.

The selected model's final-test directional accuracy was **65.71%**, exactly the same as always predicting up. Its probabilities were always above 50%. A subsequently added diagnostic rolling-frequency baseline achieved a better probability score than the trained model. That comparison was added after inspecting the test and is explicitly not a second confirmatory experiment.

## What was measured

- Instrument: HistData XAUUSD bid quotations. This is not GLD or a continuous gold futures series.
- History: 2009–2025, **5,880,521 unique minute observations**, aggregated into fixed UTC−05:00 calendar weekday bars. Sunday bars are excluded. Source timestamps are fixed EST without seasonal daylight-saving conversion.
- Forecast: positive return from the next retained weekday's open to the fifth retained weekday's close. Five observations are not necessarily five calendar days.
- Features: **87** causal price, trend, volatility, candle, oscillator, calendar and confirmed-pivot features. Pivot features are not a full Elliott-wave count.
- Search: **16 pipelines**: 9 regularized logistic models, 6 shallow boosted-tree models and one training-only rule-selection pipeline. The rule pipeline considers **696 individual conditions plus 2,000 pairs** per fold. Numerical thresholds are learned from that fold's past only. These are correlated candidates, not 2,696 independent discoveries.
- Development: expanding fits through seven validation years, 2017–2023, **1,123 eligible forecasts**. Training labels must end strictly before validation begins.
- Final test: **312 eligible forecasts**, 2024-01-22 through 2025-12-16, model fit on **2,421** observations whose final target date was 2023-12-22. No model refresh during this final test.

## Results

Lower Brier score means better probability forecasts. Accuracy alone is misleading in this sample.

| Evaluation | Selected rule learner | Historical-frequency baseline |
|---|---:|---:|
| Development Brier | 0.252115 | **0.249527** |
| Development directional accuracy | 53.34% | **54.50%** |
| Final-test Brier | **0.241786** | 0.243883 |
| Final-test directional accuracy | 65.71% | 65.71% |
| Final-test AUC | 0.515660 | 0.500000 |

No learned pipeline beat the frequency baseline in pooled development. The best learned pipeline was nevertheless carried into the final test exactly as predeclared; no final-test tuning occurred.

The final Brier improvement was 0.002097. A paired circular bootstrap with 20-observation blocks and 2,000 draws produced a 95% interval of [0.000259, 0.004429]. It improved Brier in both test years and therefore passed the narrow frozen statistical criterion. This is a provisional finding, not evidence of executable returns. Post-test 40- and 60-observation block diagnostics also retained positive lower bounds, but none remove source, sample-selection, model-selection or regime uncertainty.

The fitted rule raises the estimated up probability from 0.520859 to 0.597750 when both conditions hold:

1. The 200-observation log price return is at most 0.163313.
2. The 200-observation simple-average gain share (`rsi_200`, scaled 0–1) exceeds 0.526609. This is not Wilder-smoothed RSI.

This condition applied on only **21 of 312 dates (6.73%)**, with **16 positive targets**. Many dates overlap in March 2024, so these are not 21 independent trades. Earlier development fits often selected a different low-volatility/high-stochastic rule; its favorable in-sample behavior did not produce development superiority.

The post-test diagnostic baseline using the latest 250 **already matured** historical labels had Brier **0.231638**, better than the selected model's 0.241786. It uses only information available before each decision, including completed earlier test outcomes. It updates online whereas the tested model stays fixed; this distinction is explicit. It shows why comparison only with a static long-history average is insufficient for practical adoption. Its 59.94% accuracy also illustrates that probability accuracy and binary classification accuracy are different metrics.

## Data quality and limitations

Source: [HistData downloads](https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/xauusd) and [provider FAQ](https://www.histdata.com/f-a-q/). The FAQ specifies bid-only OHLC, no usable volume, fixed EST timestamps and no data certification. No second provider independently confirmed these prices. Bid data do not include the spread, financing or execution costs needed for a profit claim.

The downloader verifies finite positive consistent OHLC and time ordering. Exact repeated rows in the 2019–2021 files were found before training; the protocol was amended to discard only entirely identical records and reject conflicting timestamp duplicates. Both original and amended protocols are retained. Later years receive the same rule without adjustment.

Daily quality requires at least 900 recorded minutes, no observed internal gap greater than 120 minutes, first quote within 30 minutes of midnight and, Monday through Thursday, a final quote in the last 30 minutes. Friday uses its regular shorter day without that final-quote requirement. These are research heuristics, not an exchange-certified spot-gold calendar. A known scheduled closure may fail them. No price is forward-filled and no missing observation is fabricated.

Eligible forecasts require five recent good bars and all five future target bars to pass quality, with the target ending within ten calendar days. Future quality is used only to establish whether a label is measurable, not as a feature or trading filter. Thus reported metrics are conditional on retrospectively measurable targets, not coverage of every real-time decision. Incomplete observed historical bars remain in the feature history and can bias long-lookback ranges. Entire missing weekdays are not imputed. These are material limitations for any subsequent execution study.

2023 had only 157 quality days out of 259 observed weekday bars, leaving 90 eligible development forecasts. The final two years have 521 observed weekday bars, 492 passing individual-day checks, but only 312 eligible five-session forecasts. Overlapping target returns are dependent. The record count is not an independent sample size.

Volume indicators, dollar/yield/macro data, news, intraday session effects, alternative horizons and deep networks were not tested. This experiment cannot conclude that gold is unpredictable or that all technical methods fail. It establishes the performance of this explicitly bounded search.

## Freeze and verification

1. Initial protocol committed at `d630c8477e6a1dc669d755a238d9f8cfb56c91f6` before any fit.
2. Causal implementation and duplicate-only amendment committed at `32e717fa56d4c4bfc7b1142c3f9bcee879a91277` before any fit.
3. All development scores, selection and hashes committed at `f258911b8007002513bf6b281deea0889b315d7b` before acquiring 2024–2025 files.
4. The final-test runner verified those input, protocol and implementation hashes before evaluation.
5. Five deterministic tests pass: prefix/future perturbation, target alignment, missing-target exclusion, unused volume, purging and bootstrap identity (prefix and alignment share a test). Real-data prefix and future-perturbation checks pass at five cut points. A separate audit reconstructs final predictions from the saved rule and checks target values.

`test.json` retains the narrow success result unchanged. `audit.json` contains the later diagnostics and caution. `model.json` is a transparent research-only rule artifact, not an approved trading model. No 2026 history was acquired or evaluated.

## Reproduce

Python, NumPy, pandas, scikit-learn and threadpoolctl versions for the fitting run are recorded in `development.json`. No extra package installation was required.

From the repository root:

```sh
python scripts/test_gold_research.py
python scripts/gold_download.py 2009 2023
python scripts/gold_research.py develop
# Only after development.json is locked:
python scripts/gold_download.py 2024 2025
python scripts/gold_research.py test
python scripts/audit_gold_results.py
```

Results refuse overwrites. For a true rerun use a fresh directory with frozen protocol and code; retain original results elsewhere and keep 2024–2025 inputs out of that directory until development is finished. Published development and test predictions are retained for independent scoring. Their compact archives can be decoded with `base64.b64decode` followed by `gzip.decompress`.

The exact daily inputs are stored in `daily-inputs.json.gz.b64`, with per-file SHA-256 hashes in `inputs-manifest.json`. `python scripts/unpack_gold_inputs.py --development-only` restores only 2009–2023; omit that flag to restore all already-consumed inputs. This replay convenience does not make a previously seen final test unseen again. Minute archives are downloaded directly from the provider and identified by hashes inside each daily input, rather than duplicated in this repository.

For the next distinct experiment, first improve missing-minute coverage and add independent price verification. Evaluate explicitly defined intraday/session or volatility targets and dollar/yield inputs against adaptive baselines. Freeze this new search before looking at its final outcomes. 2024–2025 are now consumed test data; any subsequent use of them is development, and 2026 or genuinely future data must supply a new held-out test. Do not repeatedly search these same outcomes until a profitable-looking rule appears.
