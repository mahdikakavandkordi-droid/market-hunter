# Trend Breakout V1: frozen independent SMC challenger

Purpose: test a simple trend-following hypothesis beside the existing SMC experiment. This is a new independent research model, not an SMC threshold change. No claim of universally best strategy or proven profitability is made.

## Why this family

Moskowitz, Ooi & Pedersen (2012), Time Series Momentum, documents time-series momentum across futures/forwards. Hurst, Ooi & Pedersen (2017), A Century of Evidence on Trend-Following Investing, extends diversified trend evidence and discusses costs. These studies motivate the family, not these parameter values, individual-stock selection, crypto, hourly execution or this specific model. This model is a practical adaptation, not a replication of either paper.

- https://www.aqr.com/Insights/Research/Journal-Article/Time-Series-Momentum
- https://www.aqr.com/insights/research/journal-article/a-century-of-evidence-on-trend-following-investing

## Frozen rules

The immutable configuration is `data/research/trend-breakout-v1/config.json`; every ledger checks its SHA-256 fingerprint. A changed configuration requires a new version and a fresh ledger.

- Direction: previous completed daily close above/below the mean of 200 completed daily closes.
- Trigger: completed 4H close above the highest high / below the lowest low of the preceding 20 research bars. The signal bar is excluded from the range.
- Entry: first available research 4H open at or after first recorded decision availability. No past open can be fabricated as a live entry. In hourly-collected forward data this can delay a fill by one full research bar. Historical diagnostics instead assume hypothetical decision availability at signal completion; they are labelled `historical_simulated`, never genuine prospective observations.
- Initial stop: 2 times simple-average ATR14 of research bars, fixed from the signal snapshot.
- Exit: initial/trailing stop, or completed close after 60 holding bars. No fixed profit target.
- Trail: best completed close since entry minus/plus 3 ATR14. It only tightens and activates on the following bar. Intrabar highs/lows do not retroactively move the stop.
- Stop gaps fill at the observed adverse open; this differs from SMC's frozen boundary-R convention and is explicitly reported.
- No overlapping open/pending trades per symbol. The preceding 20-bar signal window and entry/holding path require known candle continuity. Gaps block inference and remain visible.

Same five frozen SMC universes: 33 TSX core, 37 TSX extra, 75 US, 15 crypto, 5 metal ETFs. Each cohort has an independent $1,000 shadow account; target risk 1%, cap 25% notional/position, 4 positions, 4% aggregate open risk, fixed 0.05R cost per close. Universe and risk parameters are not tuned from test outcomes.

## Honest comparison

The forward start is the actual configuration-freeze timestamp. Reports compare only new entries on/after this common start. Earlier SMC positions are excluded from the common-window account; the original SMC account is untouched. SMC trade statistics are grouped by observation provenance, so missing legacy provenance cannot masquerade as out-of-sample performance.

Both strategies have the same risk/cost assumptions, but different exit horizons, stop-gap conventions and observation/fill latency. Existing SMC source quotes are independently observed. This is a parallel strategy experiment, not an exact shared-price historical A/B replay. Do not claim a winner from closed-trade win rate alone: consider marked account equity, all outstanding/unresolved trades, drawdown coverage, duration, exposure, sample size and cohort concentration. Prospective-only evidence is the primary forward result.

## Data integrity and operation

- SMC scripts, ledgers and scanner remain unchanged.
- Challenger decisions and initial stops remain fixed; closed outcomes never replay.
- Open state advances only over newly completed bars; repeat runs do not count a bar twice.
- Missing source data preserves old records; missing marks make total marked equity unavailable.
- Corporate splits in the current hourly window stop inference for that symbol and require review.
- Raw fetched data is gzip-archived with SHA-256 hashes in workflow artifacts. Reports and independent ledgers persist in the challenger branch.
- Runner: `node scripts/trend-breakout-forward.mjs`.
- Diagnostic replay of archived inputs: `node scripts/trend-breakout-forward.mjs --historical --offline`. It writes a separate `historical/` tree and never modifies forward ledgers.
- Tests: `node scripts/test-trend-breakout.mjs` plus the full repository `npm test` suite.

Limitations: short rolling hourly history, present-day selected universe/survivorship, unfinished or gapped trades, approximate exchange-session closes, hypothetical shorts/fractional shares and omitted borrow/funding/FX/dividends. Historical marked account values at the sample endpoint are not reconstructed historical intraday drawdown. A historical diagnostic cannot validate the latency-aware live model.

## Initial diagnostic (rules were frozen before results)

All 165 symbols fetched successfully. On the available rolling intraday window, marked paper-equity returns after the fixed cost were approximately: TSX core -5.3%, TSX extra +1.6%, US -5.5%, crypto +6.9%, metals -1.6%. Closed-only trade expectancy was negative in every cohort, with unfinished trades and gap reviews explicitly present. This is mixed preliminary evidence, not proof that the model is good and not a matched historical comparison with SMC. No parameters were changed in response. Preserve the negative results and continue the separately labelled forward observation if the goal is learning.
