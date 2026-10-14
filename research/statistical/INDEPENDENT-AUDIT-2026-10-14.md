# Independent audit: statistical cross-asset forecasting

Date: 14 October 2026. Scope: PR #74, research only. No repository writes, merge, deployment, live signals, portfolio access or production changes were performed.

**Verdict: no model currently demonstrates a robust, independently validated out-of-sample forecasting advantage.** The volatility model is a credible exploratory candidate, not a validated risk engine. Directional models have not demonstrated an advantage. Macro augmentation under the tested specification worsened historical probability scores; this is not a general rejection of macroeconomic predictability.

## Evidence and reproducibility boundary

Reviewed head: `f1a88dc4970c2e465c6038b4f8d6c0cc3439af9c` on `research/statistical-cross-asset-20261014`. [PR #74](https://github.com/mahdikakavandkordi-droid/market-hunter/pull/74) was open and draft when inspected.

Downloaded and inspected both original Actions archives:

| Run | Run commit | Artifact ID | Contents |
|---|---|---|---|
| [38506906308](https://github.com/mahdikakavandkordi-droid/market-hunter/actions/runs/38506906308) | `4e069e8d761ab30f550349ae38c625bd53a1bdee` | 11867229796 | experiment-results.json |
| [38508314801](https://github.com/mahdikakavandkordi-droid/market-hunter/actions/runs/38508314801) | `54ee0441052a086c32e4c63f74c9d4c8b04b1b69` | 11868886608 | phase2-results.json |

GitHub comparisons confirmed Phase 1 engine/runner code was unchanged between its run and the reviewed head; only the Phase 2 summary was added after the Phase 2 run. Downloaded ZIP SHA256 values match GitHub artifact metadata:

- Phase 1: `1cc36f5533728bd8b5e72ac69ba93c42ef0751220b177d660a68425a2556bce1`
- Phase 2: `9194b4d0c3882efd995bf5268cc64d0e4d02ae98568805cab313778363def41b`

Verification performed:

- Both original synthetic test suites passed locally.
- Additional temporary, local audit instrumentation exposed prediction records without changing forecasting logic. Future-price perturbations left all pre-cutoff volatility forecasts and macro/price forecasts unchanged across all three horizons. These checks included model fitting and training normalization, not just feature extraction.
- An intercept-only synthetic oracle recovered the exact mean return and empirical positive rate. Independent aggregation reproduced Phase 1 Brier and return-MSE skill on three synthetic horizons.
- Recomputed 108 Phase 2 skill ratios from archived loss components: maximum absolute discrepancy zero at parsed floating-point precision. Verified the 24/27 negative Phase 1 Brier count and 27/27 negative macro-versus-price count.

**Not performed or possible from these archives:** original-market-data replay, independent price validation, probability calibration, loss-series confidence intervals, EWMA/GARCH comparisons, all-phase non-overlap analysis or crisis loss attribution. Neither archive contains original daily input bars or historical row-level predictions. Phase 1 also omits its underlying aggregate Brier/MSE loss components. Synthetic tests establish software properties only; they are not market evidence. No p-values or confidence intervals are fabricated here.

## Findings by severity

No **Critical** defect was established that invalidates the whole volatility experiment. Several **High** limitations prevent scientific validation. “Confirmed” below refers to inspected code/evidence; consequences requiring missing raw data remain explicitly unverified.

### High — H1: Original evidence is insufficient for full replay and inference (confirmed)

References: `run.mjs:80–84,93–94`; `run-phase2.mjs:63–68,77–78,98–99`; `engine.mjs:110–137`; `phase2.mjs:73–98,176–198`.

Runners persist summaries and source metadata, not raw responses, normalized bars, transformation flags, fitted parameters or the complete forecast/loss ledger. A fresh Yahoo download is not proof of replaying the original input vintage. The 30-day Actions retention also threatens the availability of the current records.

Impact: aggregate arithmetic is verified, but historical training and losses cannot be independently reproduced from the retained experiment alone. Statistical significance cannot be calculated from mean losses and sample counts.

Repair: append a versioned evidence bundle, retaining originals byte-for-byte. Include input bytes/hashes, timestamps, explicit calendar/adjustment rules, code SHA, configuration, per-date forecasts and baselines, training end and label maturity dates, and realized outcomes separately. If originals cannot be recovered, label a new download as a different data vintage and report differences; never overwrite original results.

Acceptance: an offline replay from the saved bundle reproduces all metrics within a declared numerical tolerance (e.g. 1e-10 absolute for dimensionless reported scores), with a complete mapping from every score to its predictions. This is a reproducibility repair, not a fresh holdout.

### High — H2: Oil preprocessing silently excludes economically valid prices (confirmed code defect; original numerical impact unknown)

References: `run-phase2.mjs:12–14,35–40`; `phase2.mjs:147`.

All prices must be positive to survive ingestion. This is invalid as a universal rule for WTI futures. The macro feature then computes a 20-observation log price change. WTI May futures settled at -$37.63 on 20 April 2020 according to the CFTC. The archived run used `CL=F`, not fallback USO. Without raw input, we cannot establish exactly how Yahoo represented that event in this run or quantify the resulting score distortion.

If a negative observation is supplied, it is silently removed and subsequent lookbacks cross the gap, changing a session-based series. Missing values and duplicate dates are also silently filtered/collapsed rather than diagnosed. Continuous-contract roll effects remain another unresolved issue; a front-contract price ratio is not automatically an investable oil return.

Repair: symbol-specific validation, retention of rejected observations/reasons, and a predeclared oil representation that supports signed prices or an explicitly identified positive-price proxy with roll/fee limitations. Do not pick the replacement by whichever improves the observed score.

Acceptance: a fixture with positive/zero/negative futures observations must never silently compress the timeline; missing and conflicting duplicate dates must be logged or rejected. Audit the actual 2020 source window. Recompute macro results as a corrected exploratory version. This defect does not directly affect the own-price volatility models.

### High — H3: Apparent volatility advantage has no dependence-aware significance assessment (confirmed)

References: `phase2.mjs:79–98,189–198`; `engine.mjs:124–137`.

Adjacent 20-bar targets share 19 daily returns. This does not make their average loss invalid, but makes IID standard errors and nominal sample counts invalid measures of evidence. Keeping every twentieth forecast removes target overlap, not dependence caused by volatility persistence, shared training sets and common market shocks. Calling Phase 1 subsamples “independent” overstates what was achieved.

Only one offset is retained. Its results may be phase-sensitive. Equity indices are highly related and BTC/ETH share drivers: nine assets are not nine independent confirmations. The 27 horizon/asset cells, two target families, alternative baselines and later exploratory choices create multiplicity beyond a single 27-test family.

Acceptance: preserve paired per-date loss differences, report all h offsets without selecting the best, and perform predeclared block-bootstrap or HAC inference with dependence sensitivity checks. Report loss differences and ratio intervals; do not derive uncertainty from rounded skills. Use synchronized calendar blocks where claiming pooled cross-market evidence, and a declared multiple-comparison procedure such as Holm for a fixed primary family. Historical inference remains exploratory after selection.

### High — H4: Competitive volatility benchmarks and crisis coverage are insufficient (confirmed)

References: `phase2.mjs:47,73,76–98`; archived evaluation dates.

Expanding mean volatility is already implemented and included in results; it should not be presented as missing. EWMA, simple mean-reverting persistence, canonical daily/weekly/monthly HAR-style alternatives and GARCH are missing. A regression smoothing a noisy vol20 estimate may beat persistence through shrinkage alone. The current comparisons do not establish incremental information beyond straightforward volatility dynamics.

At h=20 the equity/ETF evaluation starts on **27 April 2021**, while BTC/ETH start **27 November 2020**. The March 2020 crash is training history, not an out-of-sample stress test. Bitcoin's negative 2020 result uses only 35 overlapping forecasts. It is not a full-year evaluation. Year buckets are assigned by forecast origin; some targets mature in the next year.

Acceptance: locked, same-date comparisons against vol5/20/60 persistence, existing expanding mean, a fixed-parameter EWMA, a simple mean-reverting forecast, a declared HAR-style comparator and, if feasible, constrained GARCH(1,1). Aggregate GARCH forecasts over exactly the same h daily returns. Set positivity, fit-failure and initialization policies before evaluation. Earlier history can add retrospective crisis tests, but cannot become a newly blind holdout after inspection.

### Medium — M1: Log-volatility fitting and level-MSE scoring target different quantities (confirmed specification)

References: `phase2.mjs:8,17–20,47–55,67–72`.

The target is RMS daily log return: sqrt(mean(r²)), not centered sample standard deviation and not intraday realized variance. Ridge fits log(RMS), then simply exponentiates. exp(E[log V|X]) is generally not E[V|X], the optimum for level-volatility MSE. Under suitable log-error assumptions the former is closer to a conditional median/geometric mean. Retransformation can lead to underprediction during high-risk periods. This is not future leakage and does not mathematically invalidate the existing MSE comparison.

Acceptance: explicitly name the target and loss. Evaluate bias, calibration and upper-tail underprediction. If a smearing correction or variance-target model is tested, estimate it only inside training data and freeze the variant before future scoring. Do not automatically square the existing forecast and call it an unbiased conditional variance forecast.

### Medium — M2: Point-in-time input availability is incompletely documented (confirmed gap, no demonstrated leakage)

References: `run.mjs:41–47`; `run-phase2.mjs:33–40`; `phase2.mjs:129–150`.

Strictly prior calendar dates are a conservative alignment rule for these market-derived variables, and future-macro perturbation checks pass. But YYYY-MM-DD alone is not a release timestamp, exchange close, provider publication time or historical vintage. A daily crypto date may label the start rather than completion of a UTC session. The runner has no explicit session-completion guard; the observed archive ending crypto on 12 October does not prove every future invocation will exclude an unfinished bar.

Per-row fallback between adjusted and raw closes can create discontinuities if adjustment availability is inconsistent. Index price levels and ETF adjusted prices are different economic targets; their pooled results are not total-return portfolio results. Retrospective adjusted history is not automatically leakage: uniform scaling cancels from these ratio features, but inconsistent adjustments, corrections and revisions require evidence.

Acceptance: record raw timestamps, timezone, session start/end, provider retrieval time, available-at rules, adjustment provenance and missing-session diagnostics. A partial-bar fixture must be excluded until final. Verify Canada/US holidays separately and require a point-in-time contract for every new economic release series. No such release series (GDP/CPI vintages) is actually tested here.

### Medium — M3: Macro failure cannot be causally attributed from these results (confirmed limitation)

References: `engine.mjs:41–80`; `phase2.mjs:145–170`.

The augmented model uses 14 features instead of six. Training standardization is correct, and matched price-only and macro models use identical eligible training and evaluation dates. No unfair date comparison was found. However, correlated SPX/own-price features, nonstationary yield/VIX levels, repeated stale weekend observations, and fixed lag choices can raise estimation error. These are plausible mechanisms, not established causes.

The penalty is added to a SUM loss. Lambda=20 therefore becomes weaker relative to data size as the expanding window grows. Equal lambda does not imply equal complexity control across six- and fourteen-feature models, or across ridge and logistic objectives. This is a specification issue, not a coding error. Because columns are standardized, constant unit rescaling of the yield feature alone would mostly cancel; a units concern is not evidence that it caused the macro losses.

Newton iterations stop after at most 15 steps with bounded coordinate updates and no recorded convergence status/objective check. No convergence failure was demonstrated on original data; archived diagnostics cannot exclude one.

Acceptance: record convergence, gradient norms, objective values, coefficient paths, feature distributions and probability calibration. Diagnostic ablations may use old history but must remain exploratory. Any model selection requires inner chronological validation within the training window, followed by one frozen prospective test. Brier degradation alone does not isolate calibration failure from discrimination/resolution failure.

### Medium — M4: Macro failure can coexist with a successful runner exit (confirmed)

Reference: `run-phase2.mjs:84–97,117`.

The exit code checks only whether all nine markets were added. Missing macro contexts or macro-backtest exceptions can yield empty macro results while the process succeeds. The inspected run had no recorded errors and all 27 macro rows, so this does not invalidate its table.

Acceptance: a required-section completeness contract must fail when a context is missing, a horizon is absent or a macro result is nonfinite. Preserve diagnostics and partial output while clearly marking the run incomplete. Test an unavailable context and a forced macro exception; do not rerun production workflows for this audit.

### Medium — M5: Regimes do not currently explain model forecast errors (confirmed)

Reference: `phase2.mjs:103–126`.

SMA200 and a trailing 252-observation median are causal at the decision close; no global quantile leakage was found. The labels are intelligible descriptive trend/relative-volatility states. “High volatility” is relative to recent own history, not an absolute comparable risk threshold. Crypto and equities use different calendar spans. Slow threshold shifts and repeated observations produce dependent, potentially imbalanced buckets.

The output groups forward returns, not model-minus-baseline losses, and is not a fitted regime-conditioned forecast model. Its start at t=475 discards more history than needed for these inputs. Joining existing forecast losses to causal regimes is the first useful diagnostic; sparse state counts must be reported in both rows and contiguous episodes.

Acceptance: descriptive error tables on common dates with dependence-aware uncertainty, fixed thresholds and state occupancy/transition diagnostics. If conditioning is later proposed, fit state-specific parameters only in training, use a predeclared sparse-state fallback and assess on untouched future data.

### Low — L1: Reporting precision and nomenclature

References: `engine.mjs:124–137`; `phase2.mjs:63,125,186`; summary tables.

- Dow h=20 skill is 24.74767579%, rounding to **24.7%**, not 24.8% in the supplied request.
- Macro -12.7% means 100*(1 - macro Brier / price Brier), not a 12.7 percentage-point subtraction between two skills against the prior.
- `baselinePositiveRate` is the realized evaluation-set positive rate, not the training prior. It is not used to generate predictions, so this naming issue is not leakage.
- The “future variance ... known as of evaluation t” comment is misleading: only matured training targets are known at t; the current future target is known later for retrospective scoring.
- Regime median uses the upper middle observation for even n. Declare that convention or use the conventional two-middle average.

## Validated safeguards and baseline interpretation

`engine.mjs:29–38` uses only prices through t. `engine.mjs:103–109`, `phase2.mjs:64–70,165–171` enforce label end <= decision t. Inclusion of an outcome ending exactly at t is valid for a forecast made after the t close has become available; execution at that same close is not implied. `engine.mjs:44–46` and `phase2.mjs:26–28` fit scaling on training rows only. Future scored targets are not used in fitting. Existing synthetic tests are useful but some purge assertions merely repeat the filter; the additional full-path perturbation checks strengthen, rather than prove universally, this evidence.

Brier skill and return-MSE skill use 100*(1 - model loss / baseline loss). Positive means lower average loss; negative means higher loss. Brier is a proper probability score, not directional accuracy. A model can improve Brier and worsen thresholded accuracy, as Russell h=20 does.

Historical priors and return means are computed from matured training outcomes and refreshed at model refits every 21 bars. This is a legitimate benchmark, but not a daily-updated expanding estimate. Daily-updated equivalents and zero-return/random-walk forecasts are useful stronger checks. Momentum is compared only in directional accuracy, not as a calibrated probability benchmark. Accuracy versus 50% alone would be inappropriate when positive-return prevalence exceeds 50%.

## Verified 20-bar volatility results

Percent reductions against the named benchmark; these are archived forecast-error statistics, not independently replayed market results and not investment returns.

| Market | MSE vs vol20 | MSE vs expanding mean | MAE vs vol20 | Non-overlap MSE vs vol20 |
|---|---:|---:|---:|---:|
| TSX | 29.9 | 12.7 | 16.5 | 35.1 |
| S&P 500 | 17.3 | 28.9 | 8.8 | 14.1 |
| Nasdaq 100 | 14.5 | 34.6 | 3.4 | 8.6 |
| Dow | 24.7 | 27.1 | 16.3 | 25.7 |
| Russell 2000 | 29.1 | 25.7 | 13.4 | 29.2 |
| GLD | 9.3 | 15.5 | 13.6 | 3.0 |
| SLV | 0.7 | 30.4 | 7.9 | -12.1 |
| BTC | 28.1 | 28.8 | 12.7 | 30.8 |
| ETH | 31.4 | 27.3 | 15.8 | 34.2 |

There are 68 disjoint h=20 forecasts per equity/ETF and 107 per crypto; effective independent information is not established by those counts. MAE improvements provide some support that the aggregate result is not solely an MSE artifact, but do not establish tail-risk accuracy.

Important additional stability evidence: TSX beats persistence each scored year but loses to the expanding mean in 2022 (-4.3%), 2025 (-0.5%) and 2026 (-9.3%). Russell loses to mean in 2022 (-11.8%); ETH loses to mean in 2025 (-27.5%). Stability depends on the comparator. The S&P 2022 (-43.5%), Nasdaq 2021/2022 (-46.3%/-37.3%) and ETH 2023 (-58.6%) persistence-relative failures are confirmed. Silver's 2021 -598% indicates a loss ratio near 6.98, not a financial loss of 598%; a small comparator denominator may amplify ratios. Absolute yearly losses are needed.

## Loss functions, risk utility and statistical protocol

MSE/MAE on RMS volatility are meaningful for that observed target. They do not automatically establish forecasting latent conditional variance. For variance-oriented assessment, define realized target q = mean(r²) and a strictly positive variance forecast f; use QLIKE log(f)+q/f (equivalent rankings to normalized forms) and variance MSE, alongside volatility MAE/MSE as secondary measures. State the near-zero-return-mean approximation. Proxy-robustness results require the appropriate target and conditional-unbiasedness assumptions, not merely the label “MSE.”

Calibration should include forecast/realized averages, error sign, training-defined forecast bins, calibration intercept/slope with dependence-aware uncertainty, and high-risk underprediction frequency/magnitude. Probability checks should include reliability plots, calibration intercept/slope, Brier decomposition and log loss. Avoid small bins interpreted as stable evidence. Stress attribution should report each episode's contribution to total paired loss improvement and leave-one-episode/year-out sensitivity; retaining all observations remains the primary score. Do not remove inconvenient crashes to improve results.

Better volatility forecasts could support risk budgeting or exposure scaling only after those gates. Marginal asset volatility alone is insufficient for portfolio variance: correlations/covariances, forecast timing, turnover, costs, leverage/exposure limits and reaction delays also matter. A separate frozen risk-policy experiment should compare realized risk tracking, overshoots and drawdowns against simple volatility controls. No such policy was tested here; no portfolio benefit is established.

## Bounded development and research sequence

| Priority | Work | Acceptance gate | Holdout protection |
|---|---|---|---|
| P0 | Evidence archive and offline replay; original-output preservation | Complete source and prediction ledger; reproducible score calculations; immutable original records | No tuning; explicitly label any replacement data vintage |
| P0 | Data contracts, signed-futures handling, partial bars, missing dates and macro completeness | Focused fixtures pass; missing sections fail visibly; timestamp/proxy provenance recorded | Repairs defined by data semantics, not performance |
| P1 | Benchmark suite and paired loss reporting | Same targets/dates; EWMA, simple mean reversion, HAR-style and optional constrained GARCH; failures reported | Freeze equations/settings before comparisons; historical results exploratory |
| P1 | Calibration, block inference, all-offset and stress diagnostics | CIs and loss attribution; fixed test family; no IID claims | Predeclare primary loss/horizon and significance policy; no best-offset selection |
| P2 | Diagnostic macro ablations and causal regime error tables | Explain evidence limits; record convergence and training-only transforms | No claim of a fresh holdout; any selection confined to training/inner chronology |
| P3 | Prospective research-only forecast archive, after protocol approval | Forecasts timestamped before target begins; immutable versions; outcomes appended at maturity; missed forecasts retained | Start after code/protocol freeze, not retroactively on 14 October; fixed evaluation dates and no outcome-driven stopping |
| Later | Separate risk-control utility study | Risk tracking and costs compared with simple controls on untouched observations | No deployment or production linkage from this audit |

The primary research priority is whether a small volatility model beats competitive simple baselines, not adding more directional features or a more complex learner. Select a primary hypothesis before future results (for example, a predeclared 20-bar variance-loss comparison), enumerate secondary markets/horizons and set multiplicity handling. Define a minimum economically relevant forecast-loss improvement and an assessment horizon with a power/dependence rationale; 68 disjoint observations do not justify an arbitrary universal sample-size threshold. New changes after freezing create a new model version and validation clock. Forward monitoring is a proposal only and was not activated.

## Final scientific assessment

- **Credible within the retained evidence:** score arithmetic; conservative label maturity; training-only normalization; matched macro comparisons; negative directional and macro findings under the tested specifications; exploratory volatility improvements against vol20 and expanding mean.
- **Questionable/unresolved:** original data quality and availability, historical replay, numerical convergence across original fits, economic interpretation of oil features, uncertainty, tail calibration, competitive-baseline advantage and regime stability.
- **Unsupported claims:** confirmed alpha, statistical significance, independently blind validation, proven drawdown reduction, or general uselessness of macroeconomic information.

Continue the research, prioritize evidence preservation and volatility validation, and keep PR #74 isolated. There is a promising volatility hypothesis; there is not yet a robust forecasting result suitable for allocation.

## Source links

All code references above are relative to `research/statistical/` at the reviewed SHA:

- [engine.mjs](https://github.com/mahdikakavandkordi-droid/market-hunter/blob/f1a88dc4970c2e465c6038b4f8d6c0cc3439af9c/research/statistical/engine.mjs)
- [phase2.mjs](https://github.com/mahdikakavandkordi-droid/market-hunter/blob/f1a88dc4970c2e465c6038b4f8d6c0cc3439af9c/research/statistical/phase2.mjs)
- [run.mjs](https://github.com/mahdikakavandkordi-droid/market-hunter/blob/f1a88dc4970c2e465c6038b4f8d6c0cc3439af9c/research/statistical/run.mjs)
- [run-phase2.mjs](https://github.com/mahdikakavandkordi-droid/market-hunter/blob/f1a88dc4970c2e465c6038b4f8d6c0cc3439af9c/research/statistical/run-phase2.mjs)
- [Original tests](https://github.com/mahdikakavandkordi-droid/market-hunter/blob/f1a88dc4970c2e465c6038b4f8d6c0cc3439af9c/research/statistical/test.mjs) and [Phase 2 tests](https://github.com/mahdikakavandkordi-droid/market-hunter/blob/f1a88dc4970c2e465c6038b4f8d6c0cc3439af9c/research/statistical/phase2-test.mjs)
- [Corsi (2009), original HAR-RV paper](https://doi.org/10.1093/jjfinec/nbp001): background for distinguishing canonical HAR-RV from the current daily-close 5/20/60 RMS model.
- [Patton (2011), Volatility forecast comparison using imperfect volatility proxies](https://public.econ.duke.edu/~ap172/Patton_vol_proxies_JoE_2011.pdf): target/proxy/loss compatibility; this does not validate this experiment's particular forecasts.
- [CFTC (23 November 2020), WTI negative settlement report](https://www.cftc.gov/PressRoom/PressReleases/8315-20): confirms the signed-price issue is economically real, not proof of the missing Yahoo input vintage.
