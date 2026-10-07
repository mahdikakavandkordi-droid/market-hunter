# Wave ML V1 — task 1 contract and data feasibility

Status: design and source-capability investigation complete; feature/dataset engineering may start. Training remains gated by dataset integrity and sample feasibility. No model was trained and no operational configuration was changed.

## Scope and immutable baseline

Reviewed main: `3571076ec6ae4120011b3dc11b3956f67694af01`.
Reviewed Elliott / PR 67: `58353bb4a25189ce47eb270a2d0efab68948b823`.
Reviewed SMC: `1a7d1e5baa37760b4b8b5b64fd4fefed71dd671a`.
Reviewed Trend: `0bdb2b422a14e9a028829467e49d0a322cce790e`.

The machine-readable contract is `data/research/wave-ml-v1/contract.json`. It freezes 160 symbols from the reviewed Elliott universes: 70 Canadian, 75 US and 15 crypto. Metal ETFs are outside this initial requested scope. The frozen current universe has survivorship bias; historical-constituent returns are not claimed. Existing engines, accounts and Elliott parameters stay on their existing branches.

## Verified source capability and correction of the earlier assumption

The nine requests in `source-probes.json` are actual endpoint observations, not advertised entitlement. All returned HTTP 200. Row counts include possible live/tail records and do not establish continuous completed history.

| Instrument | 5-year daily | 60-day hourly request | 2-year hourly request |
|---|---:|---:|---:|
| AAPL | 1,254 | 421 | 3,498 |
| RY.TO | 1,255 | 414 | 3,511 |
| BTC-USD | 1,827 | 1,440 | 17,522 |

The existing Elliott runner requests `60d/1h`. That request choice was previously mistaken for the source's maximum history. The `2y/1h` probes disprove that assumption for these three instruments at the recorded observation time. Two-year hourly acquisition is a viable next step; a 60-day-history blocker is withdrawn. The existing Elliott source-window contract itself has not been changed in this task.

Yahoo sources are currently revised observations, not point-in-time archives. Exact timestamps, OHLC validation, splits, paired daily/intraday consistency, reference exchange sessions, short sessions and gaps must be checked before admitting rows. BTC's final observed hourly row is not aligned to an hour and is live; it must be excluded. The first partial UTC bucket must also be excluded. Stock rows at session end require grid checks. A 200 response is not dataset acceptance or assurance of future endpoint availability.

The existing 20-symbol Elliott archive verifies 11,406 completed daily bars, but contains neither full execution paths nor representative training samples. Repository tree inspection of latest main/SMC/Trend found research ledgers and summaries, not a full long hourly candle archive under the reviewed research paths. Frozen-dataset utilities exist; ledgers are not a candle-data substitute. This is an inspected-repository statement, not an assertion that external workflow artifacts cannot exist.

## Documented alternatives, not connected entitlements

- Binance official public-data documentation describes daily/monthly spot klines and hourly intervals: https://github.com/binance/binance-public-data . It explicitly states that spot archive timestamps from January 2025 are microseconds. Downloads, symbol coverage and checksums are not yet verified here. Venue-specific BTCUSDT is a distinct instrument/source from Yahoo BTC-USD; do not splice prices or normalize USDT as USD without an explicit new instrument contract.
- Alpha Vantage documents historical intraday access as a premium endpoint, with raw/adjusted and session controls: https://www.alphavantage.co/documentation/#intraday . No connected key/entitlement, TSX instrument coverage or paid retrieval is verified. It is a documented option, not an available dataset or recommendation to subscribe.

## Sample and feature availability

Every eligible completed daily observation produces a paired long/short opportunity, independent of Elliott signals. Require 250 valid continuous daily bars, positive ATR and complete required price/calendar inputs. This supplies ordinary, failed and successful market states rather than only four Elliott confirmations. Rows retain symbol identity for grouping/accounting; symbol IDs are excluded from predictors.

Daily small/outer pivots use fixed right-confirmation windows 2/5; their occurrence and confirmation times are separate. Only confirmed past legs contribute sizes, durations, ratios, speed and distances. No future-fitted ZigZag or final-history wave label enters a feature. Optional missing volume/short pivot histories remain null with flags; mandatory gaps reset eligibility and state. Indicators have explicit formulas in the JSON: simple ATR14, Wilder RSI14, prior-only RVOL20, normalized SMA distances/slopes, returns and volatility. Higher-timeframe features use completed weeks and a verified session calendar.

A historical decision is conservatively available at completed daily time plus five minutes. This is an assumption for historical simulation, not historical provider-arrival evidence. Future paper execution must use actual recorded availability. Persist every feature input cutoff and pivot confirmation timestamp, so prefix replay and future perturbation can test the builder.

## Label policy is a distinct ML challenger

First eligible completed research-4H bar open at/after availability; entry expiry 120 wall hours for stocks, 36 for crypto. Risk distance is twice decision-time ATR14. At that future opening price set stop one risk distance away and target two risk distances away, symmetrically long/short. These opening-price fields belong only to labels; they never enter decision features.

The target/stop are fixed, the entry bar counts, and a position times out at its 60th held research bar. Opening adverse stop gaps fill at open; favorable target gaps fill at target; an otherwise ambiguous intrabar collision is stop-first. A fixed 0.05R cost is charged once for admitted trades. Label target/stop/time/entry-expired outcomes and actual gross/net R. Entry-expired means no trade and zero P/L; missing-path unresolved means unknown, never zero or a loss.

Stock research bars use the reviewed regular-session four-source and three-source aggregation with conservative final-slot completion. Short sessions need a verified calendar convention; missing paths cannot be jumped. Crypto requires four aligned completed UTC hourly sources. Nonpositive stops, splits inside feature/holding windows, unresolved gaps/revisions and paths extending beyond the 75-day information horizon remain unresolved and count against coverage. Do not choose labels merely because an outcome resolved quickly.

This ATR barrier policy differs from Elliott's C stop and wave-extension target. It is a separate challenger, not a modification of Elliott V1 or evidence about its four trades. Short P/L is hypothetical; reserve notional and omit credit from short sale proceeds. Borrow, funding, dividends and FX remain excluded and must be visible in comparisons.

## Time separation and untouched final evaluation

Use common UTC boundaries across every instrument and direction. Decision periods: training from 2024-10-08; validation 2026-01-01 to 2026-04-01 in two chronological windows; final test 2026-04-01 to 2026-07-24. The final end precedes the observed cutoff by at least the 75-day maximum information horizon, avoiding outcome-dependent admission of recent labels.

Reserve all history of 12 previously uninvestigated symbols from fitting/tuning/calibration: BMO.TO, SU.TO, CCO.TO, DOL.TO; JPM, COST, XOM, AMD; BNB-USD, LINK-USD, AVAX-USD, LTC-USD. Their final-time block is the primary new-symbol/new-time test. Earlier raw warmup may compute features but must not fit model components. The 20-symbol Elliott audit is already-observed development evidence and is not called untouched.

Purge a training row whenever its full label-information interval intersects the next block. In addition, embargo fitting decisions within 75 calendar days before each validation/final boundary. Keep the two directions together and apply boundaries to all symbols, preventing correlated future leakage through another asset. Require at least 12 months of eligible train decision coverage after embargo; the earliest validation boundary was selected to permit that coverage if the source is continuous.

Task 2 freezes source manifests and feature partitions. Task 3 may write sealed final labels/checksums but must not expose their outcomes or scores to development. Task 4 uses train/validation only, fixes model/preprocessing/calibration/threshold/ranking, and records the entire trial budget. Task 5 opens final evaluation once. A failed final result cannot be tuned on that same partition and called a new untouched test.

## Acceptance and next-task gates

Task 2: GO for acquisition of five-year daily warmup plus two-year hourly observations, quality auditing and a causal feature builder. Pilot transport availability is verified; full 160-symbol continuity is not.

Training: blocked until source identity/session/corporate-action/price consistency checks pass, every admitted feature has an as-of audit, labels have verified complete paths, partitions are sealed, and split feasibility is measured. Require at least 500 resolved train rows per market/direction and 100 per validation market/direction, with at least 12 months train decision coverage. Raw counts are correlated; report nonoverlapping time/symbol-block support, unresolved coverage and class balance rather than treating paired daily rows as independent trades.

Later evaluation must compare training-frequency and regularized simple baselines with one preregistered tree family (at most eight trials). Preprocessing and probability calibration fit only their assigned past partitions. Report log loss, Brier/reliability, expected/admitted net R, costs and causally admitted portfolio drawdown. Insufficient independent blocks make a confidence interval inconclusive. Positive in-sample results never promote a model. Challenger promotion requires frozen validation policy, heldout evidence and 0.10R cost stress; activation is a later explicit task.

Task 1 contains no training code, parameter optimization, full dataset builder, schedule or operational write. The next task is data capture and features, not fitting a model.
