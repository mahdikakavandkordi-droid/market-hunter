# Elliott rejection diagnosis — frozen model

All 55 terminal candidate states independently matched their available-at-the-time numerical conditions. Replaying only up to the first terminal event reproduced the same state; previous-bar replay was still nonterminal or the candidate had not yet appeared. No parameters, source observations or forward accounts were changed.

| Mechanism | Count |
|---|---:|
| price_reached_original_impulse_origin | 3 |
| retracement_too_shallow | 7 |
| C_does_not_exceed_A | 15 |
| confirmed_after_C_and_B_crossing | 4 |
| more_than_three_confirmed_pivots | 7 |
| B_reaches_or_exceeds_wave5 | 14 |
| price_breached_confirmed_C | 2 |
| reward_risk_below_frozen_minimum | 1 |
| retracement_too_deep | 2 |

## Interpretation

The generic complex-correction label covered 36 cases: 15 where C did not exceed A in the correction direction, 14 where B reached/exceeded wave 5, and only 7 with more than three confirmed post-impulse pivots. Thus 29 exclusions reflect price geometry outside our narrow simple-ABC contract, rather than an extra-pivot correction. These are mechanical descriptions, not independent labels proving that these market patterns were invalid Elliott counts.

Retracement-bound exclusions are split into shallow/deep in the table. Origin and C breaches were independently checked against observed candle extrema; reward/risk rejection and confirmations were checked against actual available close and fixed levels. No unexplained implementation mismatch appeared in these 55 candidates. That conclusion is limited to the frozen sample; it is not proof that the entire engine is defect-free.

Next research should review excluded geometries against an independently defined annotation rubric, especially B beyond wave 5 and C not beyond A, before adding pattern families. Do not simply relax the bounds to increase signal counts. The observed sample is development evidence; revised hypotheses require fresh symbols/time for validation. Full actual-account backtesting still requires longer intraday history and is not supplied by this diagnosis.
