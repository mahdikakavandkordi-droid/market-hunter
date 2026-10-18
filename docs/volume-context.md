# Volume context v1 — 2026-10-18 UTC

Presentation-only; no scanner scores, ranking weights, selections or strategy rules changed.
The existing scanner already uses volume. This is not an independent new source of alpha.

## Fixed definitions

All metrics use completed daily bars, never intraday overlay prices/volumes.
Require recorded average dollar volume >= CAD 3 million (existing scanner floor).

- Latest relative volume: latest volume / preceding 20-session mean, excluding latest.
- Building: last 5-session mean / preceding non-overlapping 20-session mean >= 1.3,
  with at least 3 of those 5 sessions at >= 1.3 times that baseline.
- Breakout with elevated volume: latest relative volume >= 1.5, positive close-to-close
  change, close in top quarter of daily range, and existing freshHighBreakAge = 0.
- Price caution: latest relative volume >= 1.5 with negative daily change or close in
  bottom 35% of daily range. Takes precedence over building/breakout.
- Legacy fallback: recorded maxRvol5 >= 1.5 is labelled only a recent spike; never
  misrepresented as today's volume, a rising trend, accumulation or a bullish breakout.
- Missing/invalid volume or insufficient history does not become zero. No prominent
  badge when normal/unavailable. Missing context is not a negative quality score.

New metrics are produced on the next normal scanner run and preserved in future
canonical decisions. Old records are not backfilled. Existing reports display the
legacy spike badge immediately. Mobile disclosure includes completed-session date.
Thresholds are fixed descriptive conventions, not empirically optimal values.

## Retrospective audit

Reproduce from the pinned evidence commit in volume-retrospective-2026-10-18.json:

`node scripts/audit-volume-context.mjs <evidence-commit>`

Cutoff: 2026-10-16. Only already-recorded episode decisions and matured outcomes are
joined, with identity checks. No current charts, reconstructed historical decisions,
or future outcomes. Hypothesis is post-hoc despite using contemporaneous features.
The tested rule is only the legacy spike definition, NOT all new price/volume labels.

Integrated shortlist, excess return vs TSX in percentage points:

| Horizon | Group | Observations / symbols | Mean | Median | Equal-symbol mean |
|---|---|---|---|---|---|
| 5 sessions | All | 33 / 29 | -0.60 | -0.96 | -0.89 |
| 5 sessions | Spike | 15 / 12 | +0.04 | -1.11 | -0.19 |
| 5 sessions | No spike | 18 / 18 | -1.13 | -0.25 | -1.13 |
| 10 sessions | All | 13 / 13 | -3.73 | -0.32 | -3.73 |
| 10 sessions | Spike | 6 / 6 | -1.95 | -0.28 | -1.95 |
| 10 sessions | No spike | 7 / 7 | -5.25 | -0.32 | -5.25 |

No matured 20-session outcomes. Five-session groups cover 8 overlapping decision
dates, ten-session groups only 3. A symbol can appear in both groups on different
episodes. No significance or causality claim. Mean improvement with a worse 5-session
median does not establish a reliable filter. Equal-symbol weighting is not an
independence correction. Returns are selection observations, not a trade simulation.
Full stage breakdown, counts, missingness and limitations are in the JSON artifact.

## Next evaluation

Keep v1 labels/rules fixed. Accumulate new decision-time metrics through normal
collection; compare each label with the same eligible baseline at 5/10/20 sessions.
Do not tune on this short retrospective sample. Check medians, unique symbols,
decision-date concentration, omitted winners and downside before proposing ranking
changes. No automatic rank/filter promotion or special monitoring job is enabled.
