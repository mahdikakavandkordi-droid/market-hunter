# Healthy-Trend Pullback Challenger Protocol v1
Date frozen: 2026-09-28
Status: predeclared research protocol; commit before any challenger outcome comparison.

## Purpose
Test one interpretable chart-discovery challenger for healthy uptrend pullbacks. This is not a trading system and the +2 ATR / -1 ATR barriers are research labels only.

## Evidence and split policy
- Frozen source: `locked-v2-validation-36420714736-archive-v1`.
- Reuse the locked numerical snapshots, fixed calendar, episode logic, universe metadata and audit conventions.
- Development is the design sample.
- Validation is explicitly labelled **previously observed validation history**.
- Historical Final remains sealed and may not be read.
- No live download may replace a locked input.
- No grid search, threshold sweep, model-selection search, or post-result parameter adjustment is permitted in this round.

## Decision timestamp
A setup is decided immediately after the close of symbol session D. Only data available by that close may be used.
- Daily inputs may use bars through D.
- Weekly inputs use only weeks that ended before the Monday-containing week of D. The current calendar week is excluded even on Friday; this is deliberately conservative and prevents partial-week ambiguity.
- A 2-left / 2-right daily pivot high is available only after the second right-hand bar has closed.

## Headline universe
Headline comparisons use non-CDR Canadian equities from the reviewed `UNIVERSE`.
CDRs are not mixed into headline benchmark-excess evidence because CAD CDR returns include CAD/USD effects while `^IXIC` is a USD index and the locked archive contains no FX hedge/currency series. CDR diagnostics may be exported separately with this limitation.

Existing safeguards are retained:
- adjusted/raw series must be present and internally valid;
- at least 100 prior daily sessions and enough completed weekly history;
- raw close >= CAD 2;
- 20-session average raw-dollar volume >= CAD 3,000,000;
- no decision within 30 symbol sessions after a recorded split;
- no interpolation or forward-fill.

## Core setup: exact numeric rules

### 1. Established upward weekly trend
Using completed weekly closes only:
- latest completed weekly close > 10-week SMA;
- 10-week SMA > 20-week SMA;
- 10-week SMA is higher than its value four completed weeks earlier.

### 2. Controlled daily pullback
At D:
- drawdown from the highest adjusted close in the prior 20 symbol sessions, excluding D, is between 4% and 12% inclusive;
- adjusted close >= 50-day SMA;
- 20-day SMA > 50-day SMA.

"Controlled" therefore means a visible retracement that has not broken the medium-term daily trend.

### 3. Measurable daily recovery
Find the most recent confirmed 2-left / 2-right pivot high whose pivot date is within the prior 15 symbol sessions.
Recovery is present only when:
- D adjusted close > that pivot high; and
- D-1 adjusted close <= that pivot high.

This is a close-based reclaim of a previously confirmed minor high. No future pivot information is allowed.

### 4. Relative strength
20-session symbol return minus 20-session `^GSPTSE` return must be >= 0 percentage points.

## Core ranking
Eligibility and ranking are separate. Eligible names are ranked by a fixed 0-100 score:
- 40 points: RS20, linearly clipped from 0 to +10 percentage points.
- 25 points: 4-completed-week slope of the 10-week SMA, linearly clipped from 0% to +5%.
- 20 points: pullback quality, maximum at a 7.5% drawdown and declining linearly to zero at 3% or 12%.
- 15 points: reclaim strength, close above pivot high divided by decision-time ATR14, clipped from 0 to 1 ATR.

Ties break by symbol ascending.
Surface output is the highest-ranked **up to six** eligible names. Six is a cap, never a quota. Natural eligible count is recorded separately.

## Planned variants — only these three
1. **Core** — rules above.
2. **Core + volume** — Core plus decision-day volume >= 1.20 × the mean volume of the previous 20 symbol sessions, excluding D.
   - This changes eligibility only.
   - Core ranking is unchanged.
3. **Core + market context** — Core plus `^GSPTSE` adjusted close > its 50-session SMA at D.
   - This changes eligibility only.
   - Core ranking is unchanged.

The volume and market-context gates will not be combined in this round. No additional variants are allowed.

## Baselines frozen before outcomes

### Current Early Watch
Use the current locked Early Watch surface replay unchanged. Natural all-instrument output is reported exactly as stored. For headline controlled comparisons only, its non-CDR selections are identified as a subset; this does not change the Early Watch algorithm.

### Simple trend + relative-strength selector
Same non-CDR history/liquidity/split safeguards.
Eligibility:
- completed-week trend rules from Core;
- adjusted close >= 50-day SMA;
- RS20 >= 0.
No pullback or pivot-recovery requirement.
Ranking:
- 60 points RS20 clipped 0 to +10 pp;
- 40 points 4-week 10-week-SMA slope clipped 0% to +5%.
Up to six names; never forced.

### Repeated random selector
For each controlled challenger opportunity date, sample without replacement from the generic liquid non-CDR eligible universe for that date, excluding benchmark symbols.
Selection count equals the challenger selection count for that date.
Seeds are fixed as integers 2026092800 through 2026092899 inclusive (100 repetitions).

### Date/sector/volatility-matched random control
For each challenger pick on each date:
- same date;
- same universe safeguards;
- same sector from `UNIVERSE`;
- same cross-sectional ATR14% quintile on that date;
- not the challenger symbol;
- not already used as another control on that date.
Use the same 100 fixed seeds.
If no pool exists, leave the pick unmatched. Do not broaden criteria after seeing outcomes. Report unmatched picks/dates and insufficient pools.

## Episode identity and re-entry
Selections are built on one chronological confirmed calendar before split assignment.
For each model/variant:
- an episode begins when a selected symbol is absent from that model's immediately previous confirmed scan date;
- confirmed zero-pick dates end active episodes;
- missing/incomplete coverage dates do not create absence and do not reset;
- re-entry creates a new episode only after a confirmed absence;
- identity: `model|symbol|firstSurfaceDate`.

## Primary outcome
Primary horizon: 20 symbol trading sessions **after the entry reference**.

### ATR
ATR14 is an absolute-price Wilder-style/simple true-range mean over the latest 14 completed daily ranges available at D, using the same adjusted OHLC basis as the outcome path. No future bar enters ATR.

### Entry reference
The locked snapshot has no Open field. Therefore:
- executable research reference = adjusted close of the next symbol session D+1;
- if D+1 close is unavailable, the episode is `missing_entry` and is not imputed;
- the D+1 high/low are not used because they occurred partly before the close entry reference.

This prevents fabricated open/gap data. True open-gap behaviour cannot be tested from the pinned source and is a disclosed limitation.

### Barrier path
Starting with the session after entry (D+2), inspect the next 20 symbol sessions:
- favourable barrier = entry close + 2 × decision-time ATR14;
- adverse barrier = entry close - 1 × decision-time ATR14.

Labels:
- `success`: favourable barrier is crossed on an earlier bar than the adverse barrier;
- `adverse_first`: adverse barrier is crossed earlier;
- `neither`: neither is crossed within 20 sessions;
- `ambiguous_both_hit`: both barriers are crossed for the first time within the same daily bar.

Ambiguous-both-hit is never inferred as favourable and is not counted as success.

### Suspensions / irregular gaps
No price is filled. If any consecutive required symbol observations from entry through the 20-session path are separated by more than 7 calendar days, label `suspension_or_irregular_gap` and exclude it from the primary barrier denominator while reporting it separately.

### Boundary purge
The full required primary window — decision, next-session entry, and all 20 post-entry symbol sessions — must mature before the relevant split boundary:
- Development: before `validationStart`;
- Validation: before `finalStart`.
Historical Final is never opened.

## Secondary diagnostics
Using the same next-session-close entry convention:
- 5-session and 10-session close returns and benchmark excess;
- 20-session close return and benchmark excess;
- favourable excursion from adjusted highs;
- adverse excursion from adjusted lows;
- time in symbol sessions to the +2 ATR favourable barrier when successful;
- top-ranked (rank 1) quality;
- episode count and distinct-symbol count;
- year and market context (`^GSPTSE` above/below 50-day SMA);
- contributor concentration.

Legacy scan-close-to-close Early Watch statistics remain separately labelled and are not mixed with next-session-entry results.

## Costs/slippage
Primary barrier labels are gross research labels.
Return sensitivity is predeclared at:
- 0 bps per side;
- 10 bps per side;
- 25 bps per side.
Net close-to-close return sensitivity subtracts two sides of the stated friction. No other cost cases are allowed in this round.

## Controlled comparison rules
- Natural output volume, zero-pick dates, and coverage are reported for every model.
- Controlled comparisons use challenger opportunity dates and challenger daily selection counts.
- No model is forced to emit six names.
- If a baseline has fewer natural selections than the requested controlled count, use all available selections and report the shortfall rather than filling from outside its rule.
- Random selectors match the requested count from their frozen pool subject to availability.
- Unmatched dates/picks are explicit.

## Uncertainty
- Calendar-block bootstrap with 5,000 repetitions, fixed seed 20260928, block length 20 confirmed dates.
- All same-date episodes move together inside a bootstrap block.
- Paired model differences are calculated on shared opportunity-date blocks where applicable.
- Report effect sizes and 95% bootstrap intervals, not only rates.
- Temporal blocks reduce but do not eliminate repeated-symbol dependence.

## Data and adjustment basis
Adjusted close/high/low from the locked snapshot are used consistently for trend, pivots, ATR, entry reference, barriers and returns.
Liquidity uses raw close × volume, matching the existing scanner.
Corporate actions use the archive's split metadata and the existing post-split exclusion safeguard.

## Interpretation constraints
- Validation is previously observed history, not untouched out-of-sample evidence.
- The reviewed 2026 universe is not point-in-time historical membership; survivorship/universe-selection bias must be disclosed.
- A higher historical average alone is insufficient to promote the challenger.
- No production merge, Early Watch change, other-stage change, or Historical Final opening is permitted.
