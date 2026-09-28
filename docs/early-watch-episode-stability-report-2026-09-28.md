# Market Hunter — Early Watch Episode Stability Review

**Date:** 2026-09-28  
**Research branch:** `research/early-watch-episode-stability-20260928`  
**Pinned evidence tag:** `locked-v2-validation-36420714736-archive-v1`  
**Validation source run:** `36420714736`  
**Analysis code commit:** `ce7e9b10ce52c3079ade401dee4eb33771d3ff1c`  
**Analysis run:** `36439299651` — SUCCESS  
**Generated-output commit:** `f3bb355b42bf71196f92855fe20cd73e4232622a`  
**Historical Final:** SEALED; `V2_OPEN_FINAL_TEST=0`

## Decision

**Verdict 2 — Investigate one specific weakness before changing rules.**

The specific weakness is **tail / positive-contributor concentration in Validation, especially at 10D and 20D**. The observed mean excess is not explained simply by repeated daily observations, but the Validation result is materially reduced by removing a very small number of positive symbol contributors or the best 1% of episodes. No threshold, ranking, eligibility, shortlist-limit, frontend, portfolio, or other-stage change is justified by this analysis.

**Smallest useful next step:** audit only the largest positive contributor episodes for data/corporate-action integrity and provenance, especially the 2025-09-10 LAC.TO episode, before making any rule change. This is a data-integrity / concentration check, not a proposal to exclude those symbols or tune Early Watch.

## 1. Consistent observation unit

The primary observation unit is now a **first-surface episode** for Development, Validation, and Combined results.

Existing episode definition preserved:

- A symbol starts an episode when it is selected in the visible top-six Early Watch shortlist on a **confirmed combined-market scan** and was absent from the immediately previous confirmed scan.
- Episodes are constructed chronologically over the full confirmed timeline **before** split assignment.
- Crossing the Development/Validation boundary does **not** create a new episode.
- A confirmed zero-pick session clears the previous-symbol set and ends every active episode.
- Missing or partial-coverage sessions are skipped and do not silently create an absence/reset.
- The locked sample has zero partial-coverage dates at all three horizons; the missing-coverage rule is also covered by a focused synthetic regression test.

Daily repeated-observation statistics remain in `summary.json` under a separately labelled section and are not used as the primary episode unit.

## 2. Return and timing definitions preserved

No return or entry definition was changed.

- Entry reference: adjusted close on the first-surface scan date.
- Outcome: adjusted close exactly 5, 10, or 20 symbol trading sessions after the first-surface date.
- Benchmark: `^IXIC` for CAD CDR symbols, `^GSPTSE` for the rest of the current universe.
- Benchmark return: benchmark close aligned to the entry date through benchmark close at the symbol outcome date.
- Excess return: symbol forward return minus benchmark return.
- MAE/MFE: minimum/maximum adjusted-close percentage move relative to entry across sessions 1 through the horizon.
- These are descriptive historical close-to-close replay outcomes, not executable trading profits.

## 3. Split construction and purging

Episodes were created before split assignment and then assigned by first-surface date.

| Horizon | Constructed episodes | Development before purge | Development included | Dev boundary purged | Validation included |
| --- | ---: | ---: | ---: | ---: | ---: |
| 5D | 1,259 | 903 | 903 | 0 | 356 |
| 10D | 1,254 | 903 | 889 | 14 | 351 |
| 20D | 1,249 | 903 | 876 | 27 | 346 |

No included Development outcome crosses `2024-09-20`. No included Validation outcome enters Historical Final starting `2026-01-01`. No Historical Final result was inspected.

Confirmed scan / zero-pick counts:

| Horizon | Confirmed scans | Zero-pick confirmed scans | Partial coverage |
| --- | ---: | ---: | ---: |
| 5D | 965 | 337 | 0 |
| 10D | 960 | 335 | 0 |
| 20D | 950 | 330 | 0 |

## 4. Episode-level descriptive results

### Development

| Horizon | Episodes | Symbols | Mean return | Median return | Mean excess | Median excess | Beat benchmark | Avg MAE | Avg MFE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5D | 903 | 200 | 0.71% | 0.71% | **0.49%** | 0.27% | 53.8% | -1.81% | 2.82% |
| 10D | 889 | 200 | 0.86% | 1.01% | **0.50%** | 0.02% | 50.3% | -3.30% | 4.48% |
| 20D | 876 | 198 | 1.72% | 1.75% | **0.70%** | 0.10% | 50.3% | -5.21% | 7.03% |

### Validation

Validation is a fixed-calendar research split but **must not be described as untouched out-of-sample evidence**. Earlier project work has already exposed Validation history.

| Horizon | Episodes | Symbols | Mean return | Median return | Mean excess | Median excess | Beat benchmark | Avg MAE | Avg MFE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5D | 356 | 154 | 0.77% | 0.81% | **0.35%** | 0.12% | 52.8% | -1.75% | 2.87% |
| 10D | 351 | 152 | 1.74% | 1.58% | **0.70%** | -0.03% | 49.9% | -3.07% | 5.10% |
| 20D | 346 | 150 | 2.60% | 0.86% | **1.21%** | -0.66% | 48.6% | -5.05% | 8.51% |

### Combined descriptive period

Combined is explicitly descriptive Development + Validation history, not a holdout claim.

| Horizon | Episodes | Mean excess | Median excess |
| --- | ---: | ---: | ---: |
| 5D | 1,259 | 0.45% | 0.24% |
| 10D | 1,254 | 0.64% | 0.06% |
| 20D | 1,249 | 1.01% | 0.10% |

The Combined first-surface results exactly reproduce the previous report's Combined first-surface episode values.

## 5. Calendar-period stability

Year-level results are mixed rather than uniformly positive.

Development mean excess:
- 5D: 2022 +0.52%, 2023 +0.22%, 2024 +0.95%.
- 10D: 2022 +0.49%, 2023 +0.37%, 2024 +0.80%.
- 20D: 2022 +0.98%, **2023 -0.27%**, 2024 +2.30%.

Validation mean excess:
- 5D: 2024 +0.67%, 2025 +0.25%.
- 10D: 2024 +0.78%, 2025 +0.67%.
- 20D: **2024 -0.34%**, 2025 +1.71%.

This supports period dependence, especially for the longer horizon.

## 6. Concentration and retrospective sensitivity

These exclusions are **retrospective diagnostics only**, not proposed selection rules.

### Validation mean excess after excluding largest positive symbol contributors

| Horizon | Baseline | Exclude top 1 | Exclude top 3 | Exclude top 5 |
| --- | ---: | ---: | ---: | ---: |
| 5D | +0.35% | +0.27% | +0.12% | **-0.02%** |
| 10D | +0.70% | +0.38% | +0.10% | **-0.08%** |
| 20D | +1.21% | +0.70% | +0.22% | **-0.10%** |

### Validation after excluding best 1% of episodes by excess return

- 5D: +0.35% → **+0.17%**
- 10D: +0.70% → **+0.14%**
- 20D: +1.21% → **+0.26%**

The 10D and 20D Validation means are particularly affected by a 2025-09-10 LAC.TO episode:
- 10D: symbol +114.10%, benchmark +1.98%, excess +112.12%.
- 20D: symbol +181.79%, benchmark +4.53%, excess +177.26%.

This analysis does **not** conclude that the episode is erroneous. It identifies it as a high-impact item that merits a narrow integrity/provenance audit before using the aggregate mean to motivate rule changes.

Equal-weight-per-symbol mean excess is higher than episode-weighted mean excess in Validation:
- 5D: 0.51% vs 0.35%.
- 10D: 1.52% vs 0.70%.
- 20D: 2.24% vs 1.21%.

Therefore frequent repeated symbols are not the sole source of the positive average. The more important concern is the size of a small number of positive contributor episodes/symbols.

## 7. Temporal uncertainty

A fixed-seed circular calendar-block bootstrap was used:

- Seed: `20260928`
- Replications: 5,000
- Block length: 20 confirmed scan sessions
- All episodes sharing a sampled date are resampled together.

95% intervals for mean excess:

| Horizon | Development | Validation | Combined |
| --- | --- | --- | --- |
| 5D | [0.17%, 0.82%] | **[-0.12%, 0.77%]** | [0.19%, 0.72%] |
| 10D | [0.04%, 0.95%] | **[-0.45%, 1.70%]** | [0.16%, 1.15%] |
| 20D | **[-0.13%, 1.57%]** | **[-0.59%, 2.99%]** | [0.22%, 1.85%] |

The Validation intervals include zero at all three horizons. The method addresses temporal clustering better than an iid episode bootstrap, but repeated-symbol dependence across distant blocks remains. Universe/rule selection history also remains a limitation.

## 8. Independent audit

The independent audit does not call the analysis summary function. It reconstructs coverage intersections, top-six daily selections, first-surface episodes, split/purge status, raw candidate fields, and descriptive statistics directly from the pinned raw reports.

Result: **30 / 30 checks passed; 0 failed.**

Verified:
- no duplicate episode identities;
- no split-boundary episode resets;
- exact horizon-specific outcome dates and raw replay fields;
- Development and Final boundary purges;
- confirmed zero-pick session counts;
- partial-coverage disclosure;
- exported-row / reported-summary agreement.

A focused synthetic regression separately verifies that:
- a missing/partial-coverage date does not reset an episode;
- a split boundary does not reset an episode;
- a confirmed zero-pick session does reset an episode;
- a Development episode whose outcome crosses into Validation is purged.

## 9. Reconciliation with the previous report

There is **no demonstrated calculation defect** in the previous Combined first-surface episode result: all three Combined episode summaries match exactly.

The previous split-level Development/Validation values used repeated `pickDayObservations`, while this review uses first-surface episodes consistently.

Examples of mean excess:

| Horizon | Previous Dev daily | New Dev episodes | Previous Val daily | New Val episodes |
| --- | ---: | ---: | ---: | ---: |
| 5D | 0.58% | 0.49% | 0.39% | 0.35% |
| 10D | 0.56% | 0.50% | 0.82% | 0.70% |
| 20D | 0.66% | 0.70% | 1.23% | 1.21% |

The differences are explained by:
1. observation-unit change from repeated daily picks to first-surface episodes; and
2. episode-level outcome-date purge at the Development/Validation boundary (14 episodes at 10D and 27 at 20D).

## 10. Reproduction

From a checkout that contains the pinned evidence tag:

```bash
node scripts/reproduce-early-watch-episode-stability-archive.mjs
```

Default reproduced output:
`data/research/early-watch-episode-stability-reproduced/`

The command:
- reads raw inputs from `locked-v2-validation-36420714736-archive-v1`;
- forces `V2_OPEN_FINAL_TEST=0`;
- rebuilds the analysis;
- runs the independent audit;
- fails if Historical Final is opened or the audit disagrees.

## 11. Deliverables

Committed generated outputs:
- `data/research/early-watch-episode-stability/episodes.csv`
- `data/research/early-watch-episode-stability/episodes.json`
- `data/research/early-watch-episode-stability/summary.json`
- `data/research/early-watch-episode-stability/audit.json`
- `data/research/early-watch-episode-stability/run-metadata.json`

Analysis artifact:
- GitHub Actions artifact ID: `10977785569`
- Artifact name: `early-watch-episode-stability-analysis`
- Artifact digest: `sha256:bf58e98eb90ba585ab0e121100afaba5a706e70ac29d8179e9bb9e03f55c0310`

## 12. Interpretation boundary

This work establishes reproducibility and describes the historical distribution of Early Watch first-surface episodes. It does **not** prove investment performance, does not establish executable profits, and does not provide untouched out-of-sample evidence. Historical Final remains sealed.

No scanner thresholds, ranking weights, eligibility rules, shortlist limits, other stages, frontend, or portfolio logic were changed.
