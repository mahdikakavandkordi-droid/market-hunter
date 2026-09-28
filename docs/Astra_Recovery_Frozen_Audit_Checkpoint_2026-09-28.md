# Astra Review Package — Recovery Frozen Audit
**Market Hunter research checkpoint — 2026-09-28**

## 1. Review objective

Please independently review the current **Recovery** stage research. Do not redesign the scanner, tune thresholds, open Historical Final, or promote Recovery into production.

The narrow question is:

> After correcting the historical continuity bug and reconstructing Recovery on the immutable locked snapshot with fixed calendar boundaries, is the current Recovery stage defensible enough to freeze for prospective observation, or is there a material research-design problem that still needs correction?

The present conclusion is conservative:

**Current Recovery has meaningful historical evidence, especially over 20 sessions, and the fixed Review First floor appears useful. However, the evidence is concentrated by sector/regime, split-specific bootstrap intervals still include zero, and previously proposed structural gates such as minor-high break do not replicate consistently. No Recovery threshold or ranking rule has been changed.**

---

## 2. Repository and current branch

Repository:

`mahdikakavandkordi-droid/market-hunter`

Recovery audit branch:

`research/recovery-frozen-audit-20260928`

Current branch head containing durable evidence:

`501d0741bf7d14139febe620138ea5f9cc841d1d`

Frozen engine version:

`market-hunter-v2-rebuild-h2p10-2026-09-26`

Frozen numerical evidence source:

`locked-v2-validation-36420714736-archive-v1`

Original locked validation run:

`36420714736`

Historical Final start:

`2026-01-01`

Historical Final remained sealed throughout this Recovery audit:

`finalTestOpened === false`

Previously observed Validation begins:

`2024-09-20`

Development begins:

`2021-09-27`

Validation is **not** described as untouched out-of-sample evidence.

---

## 3. Final Recovery audit workflow evidence

Final clean workflow run:

`36489484297`

Code SHA used by the workflow:

`3c7efe084111a4967c687325da5973402554d826`

Run result:

**SUCCESS**

Independent Recovery audit:

- 34 checks
- 34 passed
- 0 failed

Evidence artifact:

- artifact ID: `11001491912`
- artifact SHA-256: `6bcf5869df4bb46f6c93f0e396e193d11b892a0765901fdca76bb7e3c6335eed`
- artifact retention through 2026-10-28

Durable machine-readable evidence is committed under:

`data/research/recovery-frozen-audit/`

including:

- `summary.json`
- `episodes.json`
- `audit.json`
- `run-metadata.json`

Protocol:

`docs/recovery-frozen-audit-protocol-v1.md`

---

## 4. Current Recovery model — unchanged

Recovery classification currently requires:

- prior weakness;
- not already an advanced near-high move;
- close >= 98% of MA20;
- positive 5-session return;
- positive momentum shift;
- at least a 4% pullback from the prior 60-session closing high.

Recovery currently does **not** require:

- minor-high break;
- fresh pivot breakout;
- MA50 reclaim;
- non-negative RS20;
- volume confirmation;
- higher low.

### Current ranking

Recovery base rank uses:

- momentum shift;
- RS20;
- up/down volume;
- fresh reclaim age;
- higher low;
- improving swing structure;
- ATR penalty/reward.

Current Review First floor:

`49.5`

Current surface policy:

- Review First only;
- `stageAge <= 2`;
- max six visible;
- no quota fill.

Current anti-chase surface ordering:

`baseScore - 1.5 * max(0, ret20 - 3)`

No part of the above was changed during this audit.

---

## 5. Structural bug found and corrected

The historical backtest previously skipped all observations inside the 30-session post-split exclusion window without resetting stage continuity.

That meant a Recovery observation after the exclusion window could incorrectly inherit:

- Recovery stage age from before the split; and
- prior episode continuity.

Potential consequences included:

- inflated `stageAge`;
- missing new Recovery episode starts;
- contaminated freshness diagnostics;
- mismatch between backtest and live-stage-age semantics.

Fix:

- a split exclusion now resets stage continuity;
- liquidity exclusions continue to reset continuity;
- continuity handling is explicit in `lib/stage-continuity.js`;
- regression tests confirm Recovery after an excluded interval restarts at `stageAge = 0`.

This was a research-backtest correction. It did not change Recovery classification/ranking rules.

---

## 6. Why the old Recovery PASS is retired

The older `data/recovery-final-audit.json` reported PASS, but it explicitly checked engine version:

`market-hunter-v2-rebuild-h2p7-2026-09-26`

The current engine is h2p10.

More importantly, older Recovery diagnostics used their own replay/70-30 logic rather than the current fixed calendar and sealed-boundary reconstruction. The old stage-age diagnostic covered about 1,135 scan dates, while the new mature pre-Final 20D reconstruction contains 950 confirmed dates.

Therefore:

**The old Recovery PASS is historical context only and must not be used as current validation evidence.**

The current package supersedes it for Recovery research interpretation.

---

## 7. Observation units

Two observation units are reported separately.

### Daily surfaced observations

Daily Review First candidates:

- stageAge <= 2;
- anti-chase surface ranking;
- max six.

### First-surface episodes

A symbol becomes a new first-surface episode when it is surfaced on the current confirmed date but was absent on the previous confirmed surfaced date.

Zero-pick dates reset the previous surfaced set.

The first-surface episode view is the preferred unit for reducing repeated-day dependence.

---

## 8. Current Recovery historical results

### First-surface episodes

| Horizon | Episodes | Mean return | Positive rate | Benchmark beat | Mean excess |
| --- | ---: | ---: | ---: | ---: | ---: |
| 5D | 1,439 | +0.4834% | 53.30% | 51.84% | +0.3481 pp |
| 10D | 1,432 | +0.9938% | 54.68% | 51.68% | +0.5300 pp |
| 20D | 1,418 | +2.2716% | 60.23% | 54.94% | +1.1710 pp |

### Development versus previously observed Validation

| Horizon | Development excess | Validation excess |
| --- | ---: | ---: |
| 5D | +0.2980 pp | +0.4833 pp |
| 10D | +0.3905 pp | +0.6516 pp |
| 20D | +0.7714 pp | +1.9773 pp |

Validation is stronger than Development, but it was previously observed and cannot be called untouched OOS evidence.

---

## 9. Block-bootstrap uncertainty

Method:

- 20-confirmed-session circular blocks;
- fixed full calendar;
- 5,000 valid replications;
- fixed deterministic seeds;
- first-surface episodes.

### Combined 95% intervals for mean excess

- 5D: **[+0.0080, +0.7038] pp**
- 10D: **[-0.0210, +1.0953] pp**
- 20D: **[+0.2651, +2.1368] pp**

### Development-only 95% intervals

- 5D: [-0.1096, +0.7069] pp
- 10D: [-0.2150, +1.0050] pp
- 20D: [-0.2279, +1.7715] pp

### Previously observed Validation 95% intervals

- 5D: [-0.2707, +1.1964] pp
- 10D: [-0.5063, +1.8461] pp
- 20D: [-0.0612, +4.3052] pp

Interpretation:

Combined 20D evidence is the strongest part of the historical result. However, neither Development nor previously observed Validation independently establishes a stable positive excess interval.

---

## 10. Review First is doing useful filtering

Raw Recovery stage-start episodes are much broader and weaker.

### Raw Recovery stage starts

| Horizon | n | Mean excess |
| --- | ---: | ---: |
| 5D | 6,339 | +0.0481 pp |
| 10D | 6,311 | +0.2150 pp |
| 20D | 6,256 | +0.4463 pp |

### Raw Recovery starts that pass fixed Review First >= 49.5

| Horizon | n | Mean excess |
| --- | ---: | ---: |
| 5D | 1,248 | +0.3623 pp |
| 10D | 1,241 | +0.5507 pp |
| 20D | 1,232 | +1.2247 pp |

This is one of the clearest findings in the current audit:

**The existing fixed Review First score floor historically separates a materially stronger subset from raw Recovery stage membership.**

This does not justify retuning the floor.

---

## 11. Stage age

Daily surfaced observations:

### 5D mean excess

- age 0: +0.5486 pp
- age 1: +0.3190 pp
- age 2: -0.0309 pp

### 10D mean excess

- age 0: +0.5835 pp
- age 1: +0.9971 pp
- age 2: +0.1110 pp

### 20D mean excess

- age 0: +1.2714 pp
- age 1: +1.8676 pp
- age 2: +0.5839 pp

Age 2 is visibly weaker than age 0/1.

Current maxAge2 still improves the broad historical daily cohort relative to no age limit:

- 5D excess: +0.3544 vs +0.2699 pp
- 10D: +0.6018 vs +0.3963 pp
- 20D: +1.2964 vs +0.9101 pp

However:

**Do not change maxAge2 to maxAge1 from this same historical sample.**

Age-2 weakness is a prospective hypothesis, not a newly approved gate.

---

## 12. Anti-chase ordering

Anti-chase versus base rank top-six selection:

### 5D

- anti-chase excess: +0.3544 pp
- base-rank excess: +0.3406 pp

### 10D

- anti-chase: +0.6018 pp
- base-rank: +0.5390 pp

### 20D

- anti-chase: +1.2964 pp
- base-rank: +1.2875 pp

Selection Jaccard overlap is about 0.91.

Interpretation:

Anti-chase changes only a small fraction of selections and shows only modest historical incremental value. It should not be strengthened or retuned from this sample.

---

## 13. Structural-confirmation diagnostics

### Minor-high break

First-surface mean excess:

| Horizon | Break present | No break |
| --- | ---: | ---: |
| 5D | +0.4216 | +0.2985 |
| 10D | +0.4615 | +0.5763 |
| 20D | +0.7862 | +1.4282 |

A minor-high break does not provide consistent superiority.

### Fresh high break <= 3 sessions

The direction is also mixed across horizons.

### Higher low

A higher low does not consistently identify the stronger Recovery cohort.

Conclusion:

**The older idea of requiring a minor-high break or structural confirmation is not supported strongly enough by the current fixed-calendar reconstruction to become an eligibility gate.**

Do not add it.

---

## 14. Other descriptive features

### RS20 >= 0

- useful at 5D;
- not superior at 10D/20D.

Therefore RS20 >= 0 should not become a Recovery gate from this sample.

### MA20 fully reclaimed

Mean excess:

- 5D: reclaimed +0.3396 vs not reclaimed +0.3818 pp
- 10D: +0.5945 vs +0.2774 pp
- 20D: +1.2647 vs +0.8065 pp

This is suggestive only at longer horizons.

### Volume support

Mean excess:

- 5D: +0.3708 vs +0.1077 pp
- 10D: +0.5869 vs -0.0701 pp
- 20D: +1.2577 vs +0.2659 pp

Volume support is an interesting prospective explanatory field, but adding it as a gate from the same history would be post-hoc tuning.

### High ATR

Only five first-surface observations fall in the high-ATR group in each horizon, and their outcomes are poor.

The sample is far too small to justify a new threshold.

---

## 15. Time/regime behavior

First-surface mean excess by year:

### 5D

- 2022: -0.0805 pp
- 2023: +0.7607 pp
- 2024: -0.0899 pp
- 2025: +0.7975 pp

### 10D

- 2022: +0.4095 pp
- 2023: +0.5599 pp
- 2024: +0.2050 pp
- 2025: +0.9163 pp

### 20D

- 2022: +0.4571 pp
- 2023: +1.1808 pp
- 2024: +0.9588 pp
- 2025: +2.2747 pp

The 20D effect is more temporally consistent than the 5D effect, but 2025 is materially stronger.

---

## 16. Symbol concentration

20D combined mean excess:

+1.1710 pp.

Largest positive contributors include:

- EQX.TO
- LAC.TO
- DPM.TO
- WDO.TO
- KNT.TO

Sensitivity:

- remove top 1 positive symbol: +1.0747 pp
- remove top 3: +0.9141 pp
- remove top 5: +0.7888 pp

10D:

- original +0.5300 pp
- remove top 5: +0.3049 pp

5D:

- original +0.3481 pp
- remove top 5: +0.1627 pp

Interpretation:

Concentration matters, especially at shorter horizons, but the 20D historical effect does not disappear after removing the five largest positive symbol contributors.

---

## 17. Sector concentration

The strongest aggregate contributors are heavily concentrated in:

- Materials;
- Energy;
- CDRs.

At 20D first-surface:

- Materials: n=413, mean excess +2.0464 pp
- Energy: n=277, +1.2643 pp
- CDR: n=51, +3.6755 pp

Several other sectors are much weaker or negative.

Therefore the Recovery historical advantage is not uniformly distributed across the market.

This concentration must remain a caveat.

---

## 18. CDR benchmark caveat

CDRs are retained only as a diagnostic family because historical CDR returns are CAD instruments while the historical benchmark convention uses Nasdaq in USD and the frozen evidence lacks FX/hedging series.

20D first-surface:

- non-CDR: n=1,367; mean excess +1.0776 pp
- CDR diagnostic: n=51; mean excess +3.6755 pp

The non-CDR result remains positive and substantial, so the headline historical Recovery result does not depend on CDRs.

Do not use the CDR subgroup as clean benchmark-relative proof.

---

## 19. Current research interpretation

The strongest defensible interpretation is:

1. Recovery as a broad raw stage is weak.
2. The existing fixed Review First floor materially improves the historical cohort.
3. Current fresh surfacing, stageAge <= 2 and max-six workload control produce a historically reasonable review set.
4. Combined 20D Recovery evidence is meaningfully positive and survives non-CDR restriction and top-contributor removal.
5. Split-specific uncertainty still crosses zero.
6. 5D/10D evidence is weaker and more concentration-sensitive.
7. Minor-high break, RS>=0 and other descriptive features do not justify new eligibility gates.
8. Anti-chase ranking has only modest incremental historical support.
9. No current Recovery parameter should be retuned using this evidence.
10. Recovery should remain a discovery/review stage, not a buy/sell signal.

Recommended research disposition:

**Keep the current Recovery definition/rank/surface frozen and move to prospective observation after external review. Do not rewrite Recovery and do not add the tested structural gates from this historical sample.**

This is a research disposition, not a claim of predictive superiority or a production recommendation.

---

## 20. What was not changed

This audit did not change:

- Recovery classification thresholds;
- Recovery rank weights;
- Review First floor 49.5;
- anti-chase coefficient;
- maxStageAge=2;
- max visible=6;
- Early Watch;
- Attractive Growth;
- Established Move;
- production scanner behavior;
- Historical Final state.

The only behavioral correction was the backtest continuity reset across excluded split/liquidity intervals.

---

## 21. Requested Astra review

Please independently challenge the following.

### A. Integrity

Verify:

- split-exclusion continuity fix;
- episode semantics;
- fixed calendar boundaries;
- boundary purges;
- no Historical Final leakage;
- exact immutable-snapshot identity;
- 34/34 audit checks.

### B. Statistics

Challenge:

- first-surface episode construction;
- circular 20-session block-bootstrap implementation;
- whether 20-session block length is defensible;
- concentration sensitivity;
- Development/Validation interpretation;
- whether uncertainty is understated by symbol dependence.

### C. Recovery policy

Challenge, without tuning:

- whether Review First >=49.5 is genuinely supported as a frozen historical discriminator;
- whether stageAge<=2 remains defensible;
- whether anti-chase should remain unchanged;
- whether any current feature is structurally redundant.

Do not choose new thresholds from the same data.

### D. Structural gates

Specifically test the interpretation that:

- minor-high break should **not** be required;
- fresh high break should **not** be required;
- RS20>=0 should **not** be required;
- MA20 full reclaim should **not** be required;
- volume support should remain diagnostic only.

If you disagree, identify the exact evidence and distinguish hypothesis generation from defensible model change.

### E. Next-step decision

Return one of:

- **Ready to freeze current Recovery for prospective collection**
- **Ready after specific audit/infrastructure fixes**
- **Do not freeze; material research-design issue remains**

This is a decision about the research specification, not production promotion.

---

## 22. Review constraints

Please do not:

- open Historical Final;
- refetch historical market data as replacement evidence;
- optimize thresholds/weights;
- redesign all stages together;
- use the older h2p7 Recovery PASS as current proof;
- turn descriptive feature slices into gates without a new protocol;
- treat previously observed Validation as untouched OOS;
- interpret CDR benchmark-relative results as clean FX-adjusted evidence;
- promote Recovery into production from this historical package.

The goal is to determine whether the **current frozen Recovery stage** is sufficiently well specified for prospective testing.
