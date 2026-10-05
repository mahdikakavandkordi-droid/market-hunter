# Ichimoku V1 — independent experimental challenger

Frozen launch: 2026-10-05T21:16:13.924Z. This is a paper-only fourth engine, not a replacement for Mean Reversion, and not an investment recommendation.

## Why Mean Reversion had no positions

The reviewed report was generated on October 5 at 17:58 UTC, before the first stock daily close following its October 4 launch. Previous completed stock sessions predated launch and correctly could not generate prospective entries. Later hosted GitHub Actions runs were delayed by a public runner-assignment incident. Zero positions at that point is not proof of a broken or useless strategy.

Its existing, limited historical diagnostic nevertheless showed weak after-cost results: TSX core 16 closed trades, PF 0.34; TSX extended 12, PF 0.25; US 22, PF 0.17. Crypto had no closed trades and metals only one. Two years of daily source data but only approximately 60 days of hourly fill data, current-universe selection, missing quotes and corporate-action exclusions prevent treating this as a definitive comparative backtest. No Mean Reversion rules or evidence were changed.

## Fixed rules

- Ichimoku periods: Tenkan 9, Kijun 26, Span B 52, cloud displacement 26.
- Weekly regime: the last prior calendar week's close above its visible cloud permits longs; below permits shorts. Inside the cloud: no signal. The signal's entire current week is excluded, including Friday. The first source week is discarded as potentially incomplete. Daily calendar gaps fail closed.
- The visible weekly cloud is calculated from 26 weekly bars earlier, never from the projected cloud at the current bar or any future observation.
- Daily trigger: previous daily close at/below its Kijun and current close above its Kijun for longs; symmetric crossing below for shorts. Completed-session data only.
- Stocks and metal ETFs require 20-session average dollar volume of at least 1 million. Crypto does not use this volume threshold.
- Record the decision when actually observed. Enter at the first eligible completed 4H bar whose open is no earlier than that decision. No historical decision backfill. Entry expires after 120 hours for stocks/ETFs or 36 for crypto.
- Initial stop: two daily ATR(14) from the actual entry. Adverse stop gaps fill at the worse observed open. No fixed take-profit.
- Exit after a completed daily close loses Kijun: record the exit decision, then execute at the next eligible observed 4H open. A subsequently recovering daily close does not revoke a recorded exit decision. Also exit at the stop or after 60 completed 4H bars. This bar-count timeout has different calendar duration for stocks versus crypto.
- Completed 4H bars only; forming/off-session/partial bars are not silently admitted. Lifecycle gaps block advancement and remain explicit.
- Exit timestamps retain the shared bar-end accounting convention; executionAudit records the actual exit bar start/end, so next-open executions are auditable.

## Independent evidence and accounts

Five unchanged cohorts: TSX core, TSX extended, US 75, crypto 15 and metals 5. Each has a separate nominal 1,000-unit paper account; no cross-currency or cross-engine aggregate. Risk 1% per entry, maximum position 25%, maximum four positions and 4% open risk, fractional quantities, fixed cost 0.05R. These assumptions omit borrow costs/availability, FX, dividend adjustments and variable spreads. Short positions are simulations, not claims of tradable availability.

Forward ledgers and historical diagnostics have separate paths. Frozen code/config hashes are verified before execution. Existing decision identities, first-observation provenance, entered positions and terminal outcomes cannot be rewritten by normal persistence. Hourly collection does not imply an hourly trading signal: decisions remain completed-daily, weekly-filtered and 4H-executed.

Common-window comparisons exclude positions entered before this launch. They are parallel paper observations, not a matched-price historical replay; different holding periods and execution conventions remain disclosed. Missing source accounts must display unavailable, not zero returns. Missing/invalid Yahoo quotes and split events are excluded for review, not converted into fabricated bars.

## Initial verification and diagnostic

All five real-feed forward collections completed locally. No positions or pending signals were created because the last complete daily bars predated launch. Six symbols were rejected for source quality or corporate-action review. The eligibility list explicitly distinguishes prelaunch bars, warmup, weekly cloud state, absent daily reclaim, liquidity and invalid ATR.

The untuned historical diagnostic produced the following raw-strategy closed-trade results after the fixed 0.05R cost; these are not the constrained portfolio-account returns:

| Cohort | Closed trades | Profit factor | Average R |
|---|---:|---:|---:|
| TSX core | 62 | 0.34 | -0.289 |
| TSX extended | 70 | 0.35 | -0.246 |
| US 75 | 142 | 0.62 | -0.138 |
| Crypto 15 | 45 | 0.05 | -0.438 |
| Metals 5 | 16 | 0.10 | -0.482 |

This first diagnostic is unfavorable in every cohort. It does not support promoting this simple Ichimoku implementation over existing engines. Keep it explicitly experimental; do not optimize thresholds on these observations or present signal frequency as quality. Historical signals lacking available intraday execution history cannot establish full-period performance. Preserve raw inputs and report exclusions alongside any later analysis.

## Operations and follow-up

Research branch: research/ichimoku-v1-20261005. Workflow on main: .github/workflows/ichimoku-forward.yml, hourly at minute 15 UTC, separate concurrency group. Raw snapshots and reports are archived for 90 days by each Actions run; initial raw inputs accompany this bootstrap as an archive. UI and Telegram are read-only adapters over this branch.

Tests cover displaced-cloud arithmetic, future-data isolation, prior-week completion, symmetric long/short rules, liquidity, prospective entry timing, unfinished bars, recorded exit timing, gaps, adverse stop gaps, timeouts, expiry, idempotency and terminal/frozen-evidence rewrite rejection.

Next review should check actual scheduled-run completion and eligibility coverage, then prospectively recorded closed outcomes and drawdown. Do not rank engines from different launch dates or small samples. No scanner selection/ranking thresholds, official Historical Final evidence, personal holdings or real-money trades are modified.
