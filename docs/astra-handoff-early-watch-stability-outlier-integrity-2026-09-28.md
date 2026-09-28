# Market Hunter — Astra Handoff: Early Watch Stability + Outlier Integrity

**Date:** 2026-09-28  
**Repository:** `mahdikakavandkordi-droid/market-hunter`

## Executive status

The requested Early Watch consistency/stability analysis and the follow-up outlier-integrity audit are complete.

### Final decision

**Keep Early Watch unchanged and collect prospective evidence.**

The prior stability review identified a specific weakness: Validation mean excess, especially at 10D and 20D, was sensitive to a small number of large positive contributors. The follow-up integrity audit tested whether those contributors were caused by calculation defects, split/dividend adjustment artifacts, or snapshot provenance problems.

Result: the concentration is real historical concentration, not a demonstrated data/calculation defect.

No threshold, ranking weight, eligibility rule, shortlist limit, other stage, frontend, or portfolio logic was changed.

Historical Final remained sealed throughout.

---

## 1. Branches and commits

### Episode stability analysis
- Branch: `research/early-watch-episode-stability-20260928`
- Starting point: `5fdaa208e19333b6b5d0e237f5aa70be5d840f00`
- Main analysis code commit: `ce7e9b10ce52c3079ade401dee4eb33771d3ff1c`
- Generated-output commit: `f3bb355b42bf71196f92855fe20cd73e4232622a`
- Final report / reproduction verification head: `e5244f6efedb1e171d3449352b0fbee94b036bbb`

### Outlier integrity audit
- Branch: `research/early-watch-outlier-integrity-20260928`
- Branched from: `e5244f6efedb1e171d3449352b0fbee94b036bbb`
- Audit code commit: `83a9081e987361847387bc57cbffaa68df9256c4`
- Audit workflow commit: `b0272efd599296ac5ae56a251ffb21a4ea3c0b4e`
- Generated audit output commit: `29526e51a84d2d4907442318bd1fd8a3d61e7304`

### Pinned evidence
- Evidence tag: `locked-v2-validation-36420714736-archive-v1`
- Original locked validation run: `36420714736`

---

## 2. Episode stability analysis — what changed

The previous report mixed observation units:
- Development / Validation: repeated `pickDayObservations`
- Combined: `firstSurfaceEpisodes`

This review standardized the primary analysis to **first-surface episodes** for Development, Validation, and Combined.

### Episode definition retained

A first-surface episode starts when a symbol is selected in the visible top-six Early Watch shortlist on a confirmed combined-market scan and was absent from the immediately previous confirmed scan.

Important continuity rules:
- episodes are constructed across the full confirmed timeline before split assignment;
- the Development / Validation boundary does not create a new episode;
- confirmed zero-pick sessions end all active episodes;
- missing / partial-coverage dates do not count as a genuine absence and do not reset episodes.

A focused synthetic regression test verifies these exact semantics.

---

## 3. Calendar and Historical Final safeguards

Episodes are assigned by first-surface date after chronological construction.

For Development:
- included only if the episode starts in Development;
- outcome must remain before `validationStart`.

For Validation:
- included only if the episode starts in Validation;
- outcome must remain before `finalStart`.

Historical Final:
- remained sealed;
- `V2_OPEN_FINAL_TEST=0`;
- no `finalEvaluation` payload was read;
- no included outcome entered Historical Final.

Episode counts:

| Horizon | Constructed | Dev before purge | Dev included | Dev boundary purged | Validation included |
| --- | ---: | ---: | ---: | ---: | ---: |
| 5D | 1,259 | 903 | 903 | 0 | 356 |
| 10D | 1,254 | 903 | 889 | 14 | 351 |
| 20D | 1,249 | 903 | 876 | 27 | 346 |

Coverage remained fully confirmed in the locked sample:
- 5D: 965 confirmed scan days, 337 zero-pick days, 0 partial-coverage days
- 10D: 960 confirmed scan days, 335 zero-pick days, 0 partial-coverage days
- 20D: 950 confirmed scan days, 330 zero-pick days, 0 partial-coverage days

---

## 4. Comparable episode results

### Development episode mean excess
- 5D: +0.49%
- 10D: +0.50%
- 20D: +0.70%

### Validation episode mean excess
- 5D: +0.35%
- 10D: +0.70%
- 20D: +1.21%

Validation median excess:
- 5D: +0.12%
- 10D: -0.03%
- 20D: -0.66%

Validation benchmark-beat rate:
- 5D: 52.8%
- 10D: 49.9%
- 20D: 48.6%

### Combined first-surface episode mean excess
- 5D: +0.45%
- 10D: +0.64%
- 20D: +1.01%

Combined first-surface episode results exactly reconcile with the previous Combined episode report.

Differences in split-level Development / Validation statistics versus the prior report are explained by:
1. changing the split-level observation unit from repeated daily picks to first-surface episodes;
2. episode-level outcome-date purging at the Development / Validation boundary.

No calculation defect was found in the previous Combined first-surface episode result.

---

## 5. Stability by period

Results are not uniformly positive by calendar year.

Notable examples:
- Development 20D mean excess in 2023: -0.27%
- Validation 20D mean excess in 2024: -0.34%
- Validation 20D mean excess in 2025: +1.71%

This supports meaningful period dependence, especially at longer horizons.

---

## 6. Concentration diagnostics

These are retrospective diagnostics, not proposed selection rules.

Validation mean excess after removing the largest positive symbol contributors:

| Horizon | Baseline | Exclude top 1 | Exclude top 3 | Exclude top 5 |
| --- | ---: | ---: | ---: | ---: |
| 5D | +0.35% | +0.27% | +0.12% | -0.02% |
| 10D | +0.70% | +0.38% | +0.10% | -0.08% |
| 20D | +1.21% | +0.70% | +0.22% | -0.10% |

After excluding the best 1% of episodes by excess return:
- 5D: +0.17%
- 10D: +0.14%
- 20D: +0.26%

Equal-weight-per-symbol Validation mean excess:
- 5D: +0.51%
- 10D: +1.52%
- 20D: +2.24%

Interpretation:
- repeated observations of the same symbol are not the sole source of the positive average;
- a small number of large positive contributor episodes materially affect the episode-weighted Validation mean.

---

## 7. Uncertainty

Method:
- circular calendar-block bootstrap;
- fixed seed `20260928`;
- 5,000 replications;
- 20 confirmed scan sessions per block;
- all episodes sharing a sampled date are resampled together.

Validation 95% intervals for mean excess:
- 5D: [-0.12%, +0.77%]
- 10D: [-0.45%, +1.70%]
- 20D: [-0.59%, +2.99%]

All three Validation intervals include zero.

Limitations:
- temporal blocks reduce, but do not eliminate, dependence;
- repeated symbols across distant blocks remain dependent;
- universe and stage rules were developed within the project history;
- Validation has already informed project research and is not described as untouched out-of-sample evidence.

---

## 8. Independent audit

The independent audit reconstructs:
- combined-market coverage intersections;
- daily top-six selection;
- episode identities;
- outcome dates;
- split / purge assignment;
- zero-pick treatment;
- descriptive statistics.

It does not merely call the main summary function.

Result:
- **30 / 30 checks passed**
- **0 failed**

Verified:
- no duplicate episode identities;
- no split-boundary episode resets;
- correct horizon-specific outcome dates;
- correct outcome purges;
- correct zero-pick treatment;
- correct partial-coverage disclosure;
- exported episode rows agree with reported summaries.

---

## 9. Follow-up outlier integrity audit

The prior decision was to investigate one specific weakness before any rule change: large positive contributors in Validation, especially 10D / 20D.

Audit scope:
- top 10 positive Validation episodes per horizon;
- 30 unique audited episodes total;
- raw and adjusted price path from the pinned numerical snapshot;
- independent recomputation of forward return, benchmark return, excess return, MAE and MFE;
- split / dividend events within the episode window;
- adjustment-factor drift;
- raw-vs-adjusted return divergence;
- largest absolute one-day move;
- exact snapshot provenance.

Audit run:
- `36444503537` — SUCCESS
- Audit artifact ID: `10980440438`
- Artifact digest: `sha256:0cb24bc7f1d2d5710ea9ffe43526345a80f47ea6c93f302cb24d093bd3c7517e`

Result:
- audited episodes: 30
- calculation mismatches: **0**
- adjustment-artifact warnings: **0**

This means the high-impact Validation episodes are not explained by a demonstrated calculation bug, split adjustment, dividend adjustment, or raw-vs-adjusted mismatch in the pinned snapshot.

---

## 10. LAC.TO integrity result

Flagged episode:
- symbol: `LAC.TO`
- first-surface date: `2025-09-10`
- benchmark: `^GSPTSE`
- snapshot batch: 2
- snapshot ID: `mhv2-2026-09-27-b2of4-a4dbafb34bc5`

Snapshot fingerprints:
- data SHA-256: `a4dbafb34bc52f37dc837133a470ad0b169da8e633628f3618c44521781150ad`
- structure SHA-256: `a8d9a3c54c30d33252ef035f3b7d46f77846d6f1885710f181258530eece2d3e`

### 5D
- entry close: 3.90
- outcome close: 4.51
- forward return: +15.64%
- benchmark return: +0.49%
- excess: +15.15%

### 10D
- entry close: 3.90
- outcome close: 8.35
- forward return: +114.10%
- benchmark return: +1.98%
- excess: +112.12%
- largest one-day move: +97.87% on 2025-09-24

### 20D
- entry close: 3.90
- outcome close: 10.99
- forward return: +181.79%
- benchmark return: +4.53%
- excess: +177.26%

Integrity findings:
- raw close equals adjusted close across the relevant LAC window;
- adjustment factor entry = 1;
- adjustment factor outcome = 1;
- adjustment-factor change = 0%;
- no split inside the audited window;
- no dividend inside the audited window;
- raw return and adjusted return are identical;
- all reported returns, excess returns, MAE and MFE independently recompute from the pinned snapshot.

External historical corroboration also exists for the 2025-09-24 LAC price jump and the contemporaneous reported news of possible U.S. government equity participation. This external corroboration is supportive only; the reproducible audit itself depends solely on the pinned archive.

Conclusion:
**The LAC episode is a genuine high-impact historical event in the locked data, not a demonstrated corporate-action or normalization artifact.**

---

## 11. What was NOT changed

No changes were made to:
- Early Watch thresholds;
- Early Watch eligibility;
- ranking weights;
- shortlist cap;
- Recovery;
- Attractive Growth;
- Established Move;
- frontend;
- portfolio logic;
- Historical Final.

The research branches remain isolated for rollback and review.

---

## 12. Final recommendation

### Keep Early Watch unchanged and collect prospective evidence.

Rationale:
1. first-surface episode results remain descriptively positive on average;
2. repeated daily observations do not explain the entire result;
3. large Validation contributors materially influence the mean;
4. the high-impact contributors audited so far are genuine historical price moves rather than demonstrated data defects;
5. Validation uncertainty intervals include zero;
6. Validation history has already been exposed during research.

There is no evidence-based justification for threshold or ranking changes at this point.

### Smallest useful next step

Freeze Early Watch logic and collect **prospective forward evidence** under the current rules.

Do not use the prospective sample to tune rules while it is accumulating. Record the surfaced shortlist and later outcomes with the same episode definition and benchmark logic, then review after a precommitted sample size / horizon-complete window.

---

## 13. Reproduction and deliverables

Episode-stability reproduction:
```bash
node scripts/reproduce-early-watch-episode-stability-archive.mjs
```

The documented reproduction command was independently verified in GitHub Actions:
- run `36439800366` — SUCCESS

Episode stability outputs:
- `data/research/early-watch-episode-stability/episodes.csv`
- `data/research/early-watch-episode-stability/episodes.json`
- `data/research/early-watch-episode-stability/summary.json`
- `data/research/early-watch-episode-stability/audit.json`
- `data/research/early-watch-episode-stability/run-metadata.json`
- `docs/early-watch-episode-stability-report-2026-09-28.md`

Outlier integrity outputs:
- `data/research/early-watch-outlier-integrity/outlier-integrity.csv`
- `data/research/early-watch-outlier-integrity/outlier-integrity.json`
- `data/research/early-watch-outlier-integrity/run-metadata.json`
- `scripts/audit-early-watch-outlier-integrity.mjs`
- `.github/workflows/audit-early-watch-outlier-integrity.yml`

Historical Final remains sealed.
