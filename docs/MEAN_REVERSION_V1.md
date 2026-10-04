# Mean Reversion V1 — independent third paper engine

Purpose: compare a long-only daily oversold/rebound hypothesis with frozen SMC and Trend Breakout. No parameter is selected from results; no claim of profitability is made. Existing strategy code, evidence and production scanner remain unchanged.

## Frozen hypothesis

`data/research/mean-reversion-v1/config.json` is frozen before any diagnostic. Ledgers require its SHA-256 fingerprint; changing parameters requires a new version and ledger.

- Dip day: completed daily close above its 200-day SMA, but at least 1.5 daily ATR14 below its 20-day SMA. ATR is a simple average of 14 true ranges.
- Confirmation: the following completed daily candle closes above the dip day's high and its own open, while still below the dip day's frozen SMA20 target.
- Stock liquidity: preceding 20-day average price-times-volume at least 1,000,000 in the quote currency. This is a coarse liquidity screen, not a spread estimate. Crypto volume is not used as a dollar-volume filter.
- Stop: dip-day low minus 0.5 dip-day ATR14. Target: dip-day SMA20, frozen. Both are known before entry.
- Minimum reward/risk: 0.5 at signal close and again at actual assumed entry open. This is a hypothesis parameter, not evidence of positive expectancy.
- Daily completion: stocks 17:00 Toronto, conservatively 7.5 hours after daily quote start; crypto the following UTC midnight. No incomplete daily candle can trigger.
- Entry: first completed research 4H bar whose open is at/after recorded decision availability. Hourly collection may add one research-bar delay. Intrabar execution is hypothetical, not an exchange order.
- Entry window: 120 wall-clock hours from stock daily signal completion / 36 for crypto. Expired signals and invalid entry opens become immutable cancelled decisions, not losing or winning trades.
- Exit: fixed mean target, fixed stop, or completed close after 10 research bars. This is roughly five stock sessions or forty crypto hours, not the same duration across markets.
- Adverse stop gap: observed open. Favorable target gap: boundary target. Opening gaps resolve before intrabar ranges; otherwise stop-first for ambiguous stop/target touches. No trailing stop or averaging down.
- Only the latest completed post-launch daily signal can create a forward decision. Prelaunch and stale patterns are not backfilled. Historical diagnostics may scan older patterns but are stored separately and labelled historical_simulated.
- No overlapping pending/open decisions per symbol. Missing candle paths suspend lifecycle inference and retain review flags. Closed/cancelled evidence is immutable; repeated observations do not count bars twice.

## Risk and comparisons

Same five universes and paper risk settings as Trend Breakout: each cohort has its own 1,000-unit account in a normalized quote-currency convention; target risk 1%, maximum notional 25%/position, maximum four positions, maximum total initial open risk 4%. The five accounts are separate, not one combined $1,000 portfolio. Fractional shares and fixed 0.05R round-trip costs are hypothetical; variable spreads, FX and dividends are omitted.

Both baseline comparisons include entries from the third engine's real freeze timestamp onward. Earlier positions are excluded without modifying their original ledgers. Baseline positions whose decision predates this launch but entry follows it can appear; disclose this as an entry-window comparison. Reports include provenance groups, baseline freshness and identical-risk paper-account simulations. Primary evidence is prospective-only, portfolio-admitted performance including marked open exposure and unresolved gaps, not raw closed signal win rate. There is no equal historical common window when baselines do not yet exist.

## Operation and audit

- Runner: `node scripts/mean-reversion-forward.mjs` (optional `--cohort=metals-5`).
- Diagnostic: `node scripts/mean-reversion-forward.mjs --historical --offline`. Offline replay is forbidden for forward ledgers.
- Tests: `node scripts/test-mean-reversion.mjs`; shared Trend and SMC portfolio tests also run in CI.
- Workflow hourly at minute 45, in addition to an initial push-triggered launch. Ledgers/reports persist only on the dedicated research branch. Raw gzip snapshots and SHA-256 hashes accompany 90-day workflow artifacts.
- Stocks use XIU.TO/SPY daily reference calendars to detect missing daily quotes; crypto requires continuous daily timestamps. Non-finite source quotes and splits inside the last 230 daily rows require review. Missing marks prevent claiming complete marked equity.
- Present-day universe selection, incomplete provider calendars, provider revisions/adjustments, limited intraday history, approximate sessions, and fixed costs limit inference. Source snapshots are observed, not authoritative exchange data. Daily liquidity and broad-market trend filtering may make overlap with Trend Breakout substantial; measure this before claiming diversification.

Motivation: short-term reversal/liquidity-provision research, https://www.nber.org/papers/w30917 . This specific long-only dip/rebound rule is an adaptation, not a replication or research-proven edge.
