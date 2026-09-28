# Task 4 — Healthy-Trend Pullback Results and Robustness Review
Date: 2026-09-28

Branch: `research/healthy-trend-pullback-challenger-20260928`
Frozen evidence: `locked-v2-validation-36420714736-archive-v1`
Historical Final: sealed (`finalTestOpened === false`)

This review interprets only the predeclared challenger experiment. Validation is previously observed history, not untouched out-of-sample evidence. No thresholds were changed after observing these results.

## 1. Primary result: barrier-path quality

The primary research label is +2 decision-time ATR before -1 ATR within 20 post-entry sessions, using next-session adjusted close as the entry reference.

| Model / control | Included episodes | Success rate | Mean 20-session excess |
| --- | ---: | ---: | ---: |
| Core | 44 | 34.09% | +4.8511 pp |
| Core + volume | 10 | 40.00% | +7.1561 pp |
| Core + market | 28 | 25.00% | +4.5225 pp |
| Trend + RS natural | 1,305 | 36.32% | +0.9099 pp |
| Early Watch natural | 1,187 | 38.50% | +0.7859 pp |

The high Core mean excess does **not** correspond to a higher primary barrier success rate. On Core opportunity dates:
- Core: 34.09% success.
- repeated random mean: 34.54%.
- sector/ATR-volatility matched random mean: 40.52%.
- controlled Early Watch: 46.15% on its available subset; Early Watch had 17 pick shortfalls.
- controlled Trend + RS: 38.10%, with no shortfall.

Paired Core minus Early Watch on shared episode dates:
- success-rate difference: -11.36 pp; 95% calendar-block interval [-40.48, +18.18].
- mean 20-session excess difference: +1.4711 pp; interval [-5.8313, +8.3894].

Paired Core minus Trend + RS:
- success-rate difference: -2.78 pp; interval [-23.81, +21.21].
- mean excess difference: +5.2173 pp; interval [-0.8870, +11.2194].

Therefore the experiment does not demonstrate a primary-metric advantage over the meaningful deterministic baselines.

## 2. Split instability is the main warning

Core:
- Development: 18 episodes, 22.22% success, -0.0289 pp mean excess.
- previously observed Validation: 26 episodes, 42.31% success, +8.2295 pp mean excess.

Core + volume:
- Development: 4 episodes, 0% success, -3.9276 pp mean excess.
- Validation: 6 episodes, 66.67% success, +14.5453 pp mean excess.

Core + market:
- Development: 10 episodes, 10% success, -3.6529 pp mean excess.
- Validation: 18 episodes, 33.33% success, +9.0644 pp mean excess.

All three variants move from weak/negative Development evidence to much stronger previously observed Validation history. The combined averages therefore must not be treated as evidence of stable generalization.

Core by year supports the same caution:
- 2022: -0.5583 pp mean excess.
- 2023: +0.2358 pp.
- 2024: +2.0513 pp.
- 2025: +8.7097 pp, with 23 of the 44 Core episodes.

The result is strongly time-regime dependent in this frozen history.

## 3. Random controls: excess is more interesting than success

Against 100 fixed repeated-random seeds, Core's +4.8511 pp mean excess is above every random seed in this experiment. Against stricter sector + ATR-volatility matched controls, it is approximately at the 94th percentile.

However Core's success rate is only around the 44.5th percentile of ordinary random controls and the 12th percentile of matched controls.

This is an important distinction:
- the historical Core picks contain unusually large 20-session relative moves;
- they do not show unusually frequent +2 ATR-before--1 ATR path success.

The matched control result also weakens the raw random comparison, because the challenger's opportunity set is heavily concentrated in specific sectors and volatility regimes.

## 4. Contributor and sector concentration

Core combined:
- 44 episodes across 35 symbols.
- top three positive symbol contributors account for about 46.6% of net 20-session excess.
- top five account for about 67.0%.
- removing the top five positive symbols reduces mean excess from +4.8511 pp to about +1.9048 pp.

This is meaningful concentration, although the remaining Core sample is still positive in the combined history.

Core + volume is much less robust:
- 10 episodes.
- top three contributors account for about 83.7% of net excess.
- removing the top five positive contributors leaves mean excess around -2.6608 pp.

Core + market:
- top three contributors account for about 69.7% of net excess.
- removing the top five reduces mean excess to about +0.2633 pp.

Sector concentration is also material for Core:
- Materials: 22/44 episodes and about +159.95 pp aggregate excess, roughly 75% of total net excess.
- Energy: 11/44 episodes and about +41.34 pp aggregate excess.
- Materials + Energy together: 33/44 episodes and roughly 94% of Core's aggregate net excess.

This is why sector/volatility-matched controls are more informative than unconstrained random picks.

## 5. The market-context addition is not supported

Within the Core sample itself:
- TSX above MA50: 28 episodes, 25.0% success, +4.5225 pp mean excess.
- TSX not above MA50: 16 episodes, 50.0% success, +5.4260 pp mean excess.

The predeclared `Core + market` gate therefore removes observations that were at least as good historically and reduces the primary success rate. Its mean excess (+4.5225 pp) is also essentially equal to the sector/volatility-matched random mean (+4.5258 pp).

**Task-4 disposition:** do not carry the market-context gate forward as a preferred challenger.

## 6. The volume addition is too small to interpret

Core + volume has only 10 included episodes:
- combined success: 40%.
- combined mean excess: +7.1561 pp.
- 95% block-bootstrap excess interval: [-3.2339, +17.0047].
- Development contains only four episodes and has 0% primary success.
- contributor concentration is severe.

The historical average is attractive, but the sample is too small and unstable to establish added value.

**Task-4 disposition:** do not select the volume gate based on this historical result. It may remain documented as a completed predeclared variant, but should not be the lead prospective model.

## 7. Ranking quality

For Core, rank-one episodes do not improve the important return statistic:
- all Core episodes: +4.8511 pp mean excess, 34.09% success.
- rank-one Core episodes: +4.0680 pp mean excess, 35.14% success.

The fixed ranking formula therefore does not demonstrate useful ordering power in this sample. The setup may be more informative as an eligibility/event detector than as a finely ranked score.

## 8. Cost sensitivity

Using the predeclared round-trip sensitivity:
- Core mean 20-session return: 6.3056% gross; 6.1056% at 10 bps/side; 5.8056% at 25 bps/side.
- Core + volume: 9.2820%, 9.0820%, 8.7820%.
- Core + market: 5.5863%, 5.3863%, 5.0863%.

Friction does not explain the historical mean-return observations. The larger concerns are split instability, sample size, concentration, and lack of primary-metric superiority.

## 9. Task-4 evidence judgment

The historical evidence is **insufficient to claim that the challenger has demonstrated value over the current Early Watch or the simpler Trend + RS baseline**.

At the same time, Core contains one potentially useful research feature: unusually strong 20-session excess returns relative to random controls, including a high position versus sector/volatility-matched controls. That feature survives removal of the largest few contributors better than the two gated variants.

Accordingly:
- **Core** is the only version worth taking into a prospective comparison.
- **Core + volume** is not selected; too few observations and too much concentration.
- **Core + market** is not selected; the added gate is contradicted by the experiment.
- Core must remain a research challenger, not a production replacement.
- Early Watch remains unchanged.
- Historical Final remains sealed.

This is not a promotion decision. The next decision should come from a predeclared prospective comparison, not further historical threshold tuning.
