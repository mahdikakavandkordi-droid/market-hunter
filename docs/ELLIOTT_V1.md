# Elliott V1 — steps 2–3: causal core and requested-symbol analysis

Status: core and requested-symbol analysis implemented and tested on the research
branch. No trading runner, account, operational workflow, scheduled activation or
outbound messages in this change. The page is not deployed to production yet.

This is a constrained Elliott-inspired hypothesis, not a complete discretionary
wave count, calibrated confidence estimate or demonstrated trading advantage.

## Existing infrastructure reviewed

Main reviewed at `0caf7be6228d0856390e3f20007fc202a9d6a55d`.
Read-only dashboard sources are `lib/engine-dashboard.js` and
`docs/engine-dashboard.md`. Operational workflows on main execute these branches:

| Engine | Research branch | Reviewed head |
|---|---|---|
| SMC | `research/smc-wd4h-tsx-validation-20261001` | `9c0fc81bb94b2704ce5d43e122bdab22df459536` |
| Trend Breakout | `research/trend-breakout-v1-20261004` | `b7778a9eeede310fdcfc8f0686170da411db85e1` |
| Mean Reversion | `research/mean-reversion-v1-20261004` | `0219c185f53e2eebe0275ae21df5305b6b76a1e5` |

Existing independent cohorts: `tsx-core` (33), `tsx-extra` (37), `us-75` (75),
`crypto-15` (15), `metals-5` (5 metal ETFs). Elliott's eventual runner must freeze
the same current symbol lists, not reconstruct them from scanner selections.
There are five separate nominal 1,000-unit accounts, not a combined portfolio.
Current comparison settings: target risk 1%, notional cap 25%, four positions,
aggregate initial open risk cap 4%, fractional quantities, fixed cost 0.05R.
Hypothetical shorts omit borrow, funding, dividends and FX; preserve that explicit
limitation in like-for-like comparisons and never call it executable net P/L.
Mean Reversion is long-only; Elliott is deliberately long/short. Report both
directions separately instead of suggesting all engines share direction rules.

## Frozen core hypothesis

Parameters are exported in the immutable `MODEL` object in
`lib/elliott/engine.mjs`. They were chosen before any market-result diagnostic.
A changed operational configuration will require a new model/ledger version.
No forward start is invented here: it must be the actual later activation time.

- Structure timeframe: completed daily bars, both long and short.
- Small pivots: strict high/low relative to two bars on each side.
- Outer anchors: strict high/low relative to five bars on each side. Both endpoints
  of the larger wave-1 candidate must also be confirmed outer pivots.
- Equal extrema and bars that qualify as both high and low pivots are skipped.
- A pivot's `t` is its occurrence time; `confirmedAt` is the rightmost required
  bar's completion. A pivot is never usable before `confirmedAt`.
- Consecutive same-kind small pivots retain the more extreme point in the
  unpublished alternating working sequence. Raw confirmation events and emitted
  signal snapshots never change. Equal same-kind points retain the earlier one.
- Six consecutive alternating small pivots form five internal impulse legs.
  In oriented coordinates: wave 2 holds the origin, wave 3 exceeds wave 1 and
  is not the shortest motive leg, wave 4 stays strictly outside wave 1's price
  territory, and wave 5 exceeds wave 3. Diagonals/truncated fifths are unsupported.
- The whole impulse is a *potential larger wave 1*. Following it, accept exactly
  three alternating corrective pivots A/B/C. Long: A below the impulse top, B
  between A and the top, C below A but above the impulse origin. Reverse for short.
- C retracement is 0.382 through 0.786 of the whole impulse amplitude, inclusive.
  These are chosen research parameters, not universal Elliott rules.
- Additional corrective pivots are classified unsupported. A confirmed invalid
  correction is terminal for that impulse candidate. The engine does not silently
  relabel it until a new, separately identified impulse qualifies.
- Any post-impulse origin breach invalidates the candidate, including a breach
  observed before the outer endpoint was available. A breach of C after its
  occurrence invalidates the entry setup. Known data gaps terminate active
  candidates; no structure or indicator window crosses a declared gap.
- Trigger: a completed daily close crosses B in the impulse direction, after
  all required pivots are known. Earlier crossings are not retrospectively used.
- Preliminary stop: C minus/plus 0.5 daily ATR14. Target: C plus/minus 1.618 times
  whole impulse amplitude. At signal close, positive risk and reward/risk >=2
  are required. A failed ratio is recorded as an immutable rejected decision.
- ATR14: simple mean of 14 true ranges, requiring the preceding close.
- RSI14: Wilder smoothing from the beginning of the supplied continuous segment.
- RVOL20: signal volume / mean volume of the preceding 20 bars, excluding signal.
  Missing/zero-denominator volume is null. RSI and RVOL are diagnostics, not gates.

## Core interface and boundaries

```js
import {analyzeElliott} from '../lib/elliott/engine.mjs';
const analysis = analyzeElliott(completedOrLiveDailyRows, {
  symbol: 'BTC-USD',
  asOf: observedAtMs,
  gapBeforeTimes: []
});
```

Each row: `{t, endT, o, h, l, c, v}` with millisecond times and positive finite
OHLC. `endT` is the actual/conservative source completion, not an assumed fixed
24-hour stock session. Completed rows must be strictly ordered/non-overlapping;
duplicates, malformed completed prices and invalid times fail closed. Rows with
completion after `asOf` cannot influence analysis. Missing volume is allowed.

The caller must supply provider session normalization and missing-session checks:
`gapBeforeTimes` contains the start timestamp of each bar following a known gap.
Stock holidays must not be inferred from a simple 24-hour spacing test. Crypto
continuity and stock reference calendars are later adapter responsibilities.
The returned `coverage.calendarContinuity` states `caller_supplied`; an empty gap
list is not evidence that a provider feed is complete or trustworthy.

Outputs: raw small/large pivot confirmation events, all detected candidates,
signals and rejected decisions with independent snapshots, plus at most two active
candidates. Selection sorts by latest impulse endpoint, then latest origin, then
direction and stable identity. No probability/confidence percentage is invented.
Multiple hypothesis signals may be returned; later execution must enforce one
pending/open decision per symbol and deterministic account admission.

Every signal preserves all nine pivots, their availability, trigger, stop, target,
indicator values and identity. Replaying unchanged input reproduces these records.
Persistent provenance, provider-revision safeguards and immutable ledger writes
are later runner/account responsibilities; the pure core itself performs no I/O.

## Execution contract reserved for step 4

- First completed research-4H bar open at/after recorded decision availability;
  never fill at an open preceding first observation.
- Entry expires at 120 wall-clock hours for stock-mode cohorts, 36 for crypto.
- Recheck reward/risk >=2 at assumed entry open; cancel if invalid or through
  stop/target. Freeze all signal fields before admission.
- Fixed stop, fixed target, maximum 60 research bars, no trail or partial exit.
- Adverse stop gap at observed open; favorable target gap at boundary target.
  Resolve opening gap before ranges; otherwise ambiguous stop/target is stop-first.
- Incremental lifecycle advancement, same-bar idempotency, missing-path review,
  portfolio-admitted metrics, separate historical diagnostics and prospective start.
- Actual borrow/perpetual/margin availability is not supplied by these price feeds.
  Direction-price simulation must not masquerade as executable short performance.

## Verification performed in this step

Run: `node scripts/test-elliott-core.mjs` (18 passing tests).

Fixtures cover valid impulse/ABC, violated Elliott constraints, symmetric short
prices and levels, small/large confirmation timing, complete prefix-by-prefix
replay, incomplete candles, modified future values, breakout before C confirmation,
origin breach before/after outer confirmation, rejected reward/risk, known gaps,
equal/ambiguous pivots, indicator arithmetic, missing optional volume, malformed
input and deterministic no-structure output. No real account or portfolio data
was accessed or changed. These tests establish core mechanics, not profitability.

## Step 3: requested-symbol analysis

`elliott.html` is a standalone bilingual analysis page (not a new scanner tab).
`GET /api/elliott?symbol=BTC&market=crypto` uses the same `analyzeElliott` core.
Markets: `us`, `ca`, `crypto`, `metals`; Canadian base symbols resolve to `.TO`,
crypto base symbols to `-USD`. Invalid/mismatched input is rejected. Analysis is
read-only and never creates a trade, ledger or portfolio mutation.

The adapter requests two years of observed daily Yahoo data. Stock calendars use
SPY or XIU.TO reference quotes; weekends are not interpreted as missing sessions.
Crypto uses continuous UTC days. Current stock completion uses provider regular
session metadata; historical stock completion conservatively uses 17:00 Toronto
with DST. A missing completed reference session returns unavailable rather than
false freshness. These observed calendars are not authoritative exchange data.

Incomplete daily bars are excluded. Missing paths reset the wave count. Stale
quotes, malformed completed rows, corporate splits or insufficient history block
analysis and show a separate quality warning. Source failures have no historical
fallback. In crypto the supplied volume is aggregate provider volume, not an
exchange-specific executable market. Foreign exchange-session metadata is rejected.

The page renders candles, 0–5/A–B–C labels, B confirmation, full count invalidation,
and hypothetical stop/target. Waiting-breakout levels are explicitly provisional
and supplied by the shared core; confirmed decision levels remain immutable.
Historical confirmations are explicitly distinguished from current entries or
open positions. At most two scenarios are shown; no forced count/confidence score.
Pointer inspection displays date/OHLC. Source times, currency, RSI/RVOL/ATR and
limitations are visible. Failed new requests clear the previous symbol's chart.
Provider names/text are escaped before insertion in HTML.

Verification: `npm run test:elliott` passes 32 tests (18 core + 14 adapter/API/chart).
The integration tests use synthetic providers and real handler/core code, with
daily completion, DST, missing sessions, stale/split data, API failures and safe
SVG/HTML output and provisional levels from the shared core. Live provider smoke
checks passed for BTC-USD (730 rows), AAPL (501 rows), RY.TO (503 rows); all returned
usable completed data. These counts describe the observed verification run, not
a permanent universe or performance result. Visual browser verification is outstanding:
Chromium could not launch in the execution environment (`socket(): Operation not
permitted`). `npm run test:elliott:browser` provides a repeatable fixture-driven
browser test for an environment with Chromium installed. No screenshots are claimed.

Local routes are added in `server.js`; Vercel function timeout is 20 seconds.
The maximum upstream fetch path is two sequential seven-second attempts, with
symbol and reference fetched concurrently. No secrets or additional dependencies
are needed for the production feature. The browser test uses existing Playwright.

## Remaining steps

4. Independent persistent long/short paper account and execution tests.
5. Engines dashboard, evidence/comparison reports and Telegram integration.
6. End-to-end independent review, then scheduled activation.

No scheduled Elliott execution is enabled by the step-2 PR.
