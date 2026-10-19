# Attractive Growth review and prospective volume hypothesis

Recorded: 2026-10-18 UTC. Evidence cutoff: 2026-10-16.
Full reproducible output: `attractive-growth-review-2026-10-18.json`, including its
immutable source commit. Run `node scripts/audit-hunter-growth.mjs <source-commit>`.
Only original episode decisions and stored matured outcomes are joined. No current
charts, reconstructed decisions or threshold search. Old evidence is untouched.

## Findings

Stage-level excess returns versus TSX (percentage points):

| Five-session group | Observations / symbols | Mean excess | Median excess |
|---|---|---|---|
| All Attractive Growth | 16 / 14 | -3.10 | -4.69 |
| Recent volume spike | 4 / 3 | +0.19 | +0.39 |
| Without spike | 12 / 11 | -4.20 | -6.64 |
| Recorded Industrials sector | 7 / 6 | -8.77 | -8.75 |
| Less than 6% above MA20 | 7 / 7 | -1.36 | -1.21 |
| 6% to below 10% above MA20 | 4 / 4 | -7.08 | -9.39 |
| At least 10% above MA20 | 5 / 5 | -2.37 | -5.94 |
| Fresh recorded high break, age 0–3 | 5 / 4 | -8.39 | -8.98 |

Seven decision dates overlap. Industry/date concentration is material: all seven
Industrials observations had negative excess returns; six were outside active
stages at the horizon. Leaving a stage is not itself a failed breakout or a trade
exit. No Industrials observation met the volume-spike threshold in this sample.
Therefore the volume association is confounded with sector composition. The only
recorded sector shared by spike and non-spike groups is Energy, represented by
two different EFX episodes. That does not identify an independent volume effect.

The extension relationship is not monotonic: the most extended group was not the
worst at five sessions. Current ranking already penalizes extension at 6% and 10%.
Do not add another extension penalty on these results. Recent breakouts performed
poorly at five sessions but the ten-session pattern reverses on only two records;
do not ban recent breakouts. No price path confirms the mechanism from these
aggregate observations alone.

Removing any single symbol leaves the five-session baseline mean between -3.80
and -1.80 pp. Weakness is not explained by only one ticker, but shared market dates
and sectors remain strong confounders. Equal-symbol weighting yields -2.67 pp.
The volume group omits three positive-return observations / three benchmark-beaters
at five sessions: the full excluded-winner cost must accompany any mean gain.

Ten sessions: 6 observations, mean -8.74 pp, median -8.22 pp. Volume group:
3 observations, mean -2.99 pp. No matured twenty-session observations.
AMD.TO's ten-session stored adverse excursion is about -86.8%, requiring source
review. This heuristic does not prove invalid data. Raw records are preserved;
the sensitivity excluding that observation is -8.33 pp, so it does not account for
the overall negative ten-session result. No correction of the source is claimed.

## Fixed forward study: ag-volume-v1

- Start: new canonical decision dates on or after **2026-10-19**. Earlier decisions
  are retrospective even if their outcomes mature later.
- Primary population: first-surface stage episodes in Attractive Growth.
- Secondary population: integrated shortlist episodes whose entry stage is
  Attractive Growth, reported separately, never pooled with the stage sample.
- One rule: recorded `maxRvol5 >= 1.5`, with recorded `avgDollar20 >= 3000000`.
  `maxRvol5` is the maximum of the last five completed-session volume ratios,
  each against its own preceding twenty sessions; it is not same-day buying flow.
- The convention comes from volume-context-v1. No grid search or fitted threshold.
- Compare the volume subgroup with the full eligible baseline and its non-spike
  complement over identical 5/10/20-session TSX-relative holding periods.
- Missing volume is a distinct unknown group. Missing outcomes never become zero.
- Report mean, median, symbol-balanced mean, symbols, selection dates, omitted
  winners, sector/date breakdowns and extreme-path review sensitivity.
- No replacement picks, changed ranks, trades, portfolio allocation or costs are
  simulated. This is a selection subgroup study, not a portfolio backtest.
- Freeze this rule while observations accrue. At minimum review after 20 new
  primary episodes have matured at ten sessions across at least 10 entry dates.
  This is an operational review milestone, not proof of statistical sufficiency.
  No automatic promotion to a production filter.

The existing forward collector supplies original decisions and outcomes. The
derived monitor includes separate frozen-period and forward summaries. On a closed
day, only this research projection may refresh from stored evidence; quote rows,
their timestamps and canonical records are not regenerated. No separate scheduling
service or automation was introduced.

## Sector labels on cards

Cards show the existing broad economic sector in English/Persian. This is a sector,
not a newly researched fine-grained industry classification. CDR labels use the
same reviewed underlying-company mapping as portfolio exposures (e.g. Microsoft:
Technology; Meta: Communication). The CDR instrument label remains visible.
Unverified sectors say unavailable. These current display classifications do not
overwrite historical research sectors; old CDR records remain CDR in this audit.
