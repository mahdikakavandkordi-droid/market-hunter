# Elliott fixed-model historical structure audit

Frozen source cutoff: 2026-10-07T22:29:48.140Z. Model parameters unchanged.

20/20 usable symbols; 11406 completed daily bars; 11406 prefix checks passed. 55 impulse candidates; 1 long and 3 short confirmations.

| Market | Symbols | Bars | Impulses | Long | Short |
|---|---:|---:|---:|---:|---:|
| us | 6 | 3006 | 14 | 1 | 1 |
| ca | 6 | 3018 | 9 | 0 | 0 |
| crypto | 6 | 4380 | 24 | 0 | 2 |
| metals | 2 | 1002 | 8 | 0 | 0 |

## Rejection/state reasons

- origin_breached: 3
- retracement_out_of_range: 9
- complex_correction_unsupported: 36
- correction_endpoint_breached: 2
- insufficient_reward_risk: 1

## Interpretation

Prefix equality verifies that later candles do not change emitted pivots or decisions on these frozen observations. It does not establish objectively correct Elliott counts or a trading edge. The count is a strict six-pivot impulse with simple ABC, not full discretionary Elliott analysis. Final candidate states include subsequent invalidations and are not historical entry signals. Chart cases show only candles available at the indicated time.

The 20-symbol sample was fixed before fetching, but is a purposive liquid survivor sample. Source history is currently observed/revised data; it is not historical point-in-time data. The two-year window has limited cycle coverage. SMA regimes use only past closes and need 200 warm-up bars. Split/invalid/stale sources are excluded, not repaired to improve the outcome. This audit reports diagnostics across the period, so its final third is not an untouched holdout for later tuning. No parameters were tuned.

No 4H trade replay, costs, win rate, return or drawdown is claimed. Two-year daily data does not supply the two-year intraday path required by the actual account model. Full 4H execution validation requires a frozen longer intraday dataset; it must not substitute daily bars or invent fills. Existing forward ledgers are untouched and the runner remains disabled.

## Next decision

Review count frequency, rejected corrections and confirmation delays in report.json and cases.html before changing a parameter. Any later development must pre-register limited alternatives and reserve fresh time/symbol data. Separately obtain long intraday history for account backtesting.
