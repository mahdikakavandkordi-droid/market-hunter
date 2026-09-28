# Recovery Frozen Audit Protocol v1

Date: 2026-09-28

Branch: `research/recovery-frozen-audit-20260928`

Starting point: `research/early-watch-outlier-integrity-20260928`

Frozen numerical evidence source: `locked-v2-validation-36420714736-archive-v1`

Historical Final: sealed. Do not open Historical Final for this audit.

## Objective

Determine whether the current Recovery stage is structurally sound and historically defensible before considering any threshold or ranking change.

This is an audit-first task. It is not an optimization task.

Do not change:

- Recovery classification thresholds;
- Recovery rank weights;
- Review First floor;
- anti-chase coefficient;
- max visible count;
- Early Watch, Attractive Growth, or Established Move logic;
- production scanner behavior.

## Current Recovery definition

The current engine classifies Recovery when all of the following hold:

- priorWeakness is true;
- advancedNearHigh is false;
- close is at least 98% of MA20;
- 5-session return is positive;
- momentumShift is positive;
- pullback from the 60-session closing high is at most -4%.

Recovery does **not** currently require:

- a confirmed minor-high break;
- a fresh pivot breakout;
- MA50 reclaim;
- non-negative relative strength;
- volume confirmation;
- a higher low.

Those fields may contribute to rank/evidence diagnostics but are not Recovery eligibility gates.

Current surface behavior:

- base Review First floor: 49.5;
- anti-chase surface ordering: `baseScore - 1.5 * max(0, ret20 - 3)`;
- only stageAge <= 2 is surface-eligible;
- maximum six visible;
- no quota filling.

## Existing evidence is not accepted blindly

A prior Recovery final audit reported PASS, but it explicitly checked engine version `h2p7`.

The current engine is `market-hunter-v2-rebuild-h2p10-2026-09-26`.

Therefore the old PASS is historical context, not current proof.

The old diagnostics suggested that fresh Recovery observations (stageAge 0-2) had better 20-session outcomes than older Recovery observations. That claim must be recomputed from the immutable locked numerical snapshot under the current audited code path before it is reused.

## Structural issue found before statistical revalidation

The historical backtest previously did this:

- skip all observations inside the 30-session post-split exclusion window;
- preserve `prevStage` and `prevStageAge` while those dates were skipped.

That allowed a post-split Recovery observation to inherit stage continuity from a pre-split Recovery state. Consequences could include:

- inflated stageAge;
- failure to register a new Recovery episode after the exclusion window;
- contamination of freshness diagnostics;
- mismatch with live Recovery stage-age semantics.

This is a research-backtest continuity bug, not a Recovery model-rule change.

Fix:

- any split-excluded observation resets stage continuity;
- liquidity-excluded observations continue to reset continuity;
- stage continuity is now explicit and testable through `lib/stage-continuity.js`;
- a Recovery after an exclusion begins at stageAge 0 and is a new episode.

## Audit sequence

### Task 1 — structural closure

1. Keep the immutable historical universe and frozen numerical snapshot.
2. Fix split-exclusion continuity.
3. Add regression tests for continuity reset.
4. Confirm repository tests pass.
5. Do not interpret old Recovery PASS as current validation.

### Task 2 — exact Recovery reconstruction

Using the locked numerical snapshot and sealed Final:

1. rerun all four V2 batches with current h2p10 engine;
2. reconstruct confirmed chronological Recovery observations;
3. distinguish:
   - raw Recovery stage membership;
   - Review First;
   - surfaced Recovery;
   - first-surface/episode observations;
4. preserve zero-pick dates and split/liquidity exclusions explicitly;
5. document Development vs previously observed Validation with one consistent observation unit.

### Task 3 — current-rule diagnostics

Re-evaluate without threshold tuning:

- stageAge 0, 1, 2 separately;
- stageAge >2 diagnostic only;
- base rank vs anti-chase surface rank;
- crowded-day selected vs excluded;
- minor-high break;
- fresh high-break age;
- higher low;
- RS20;
- MA20 reclaim;
- volume support;
- ATR;
- sector/time/symbol concentration.

These are explanatory diagnostics unless already frozen as current policy. Do not promote a diagnostic into a new gate from the same sample.

### Task 4 — robustness and interpretation

Report:

- 5D/10D/20D return and TSX excess;
- positive and benchmark-beat rates;
- MAE/MFE;
- Development vs previously observed Validation;
- year/regime/sector/symbol concentration;
- overlap and repeated-observation sensitivity;
- stage-age consistency;
- ranking usefulness;
- uncertainty where supportable.

Allowed conclusions:

1. Current Recovery is defensible enough for prospective observation.
2. Current Recovery adds no demonstrated value.
3. Evidence is insufficient.

No production promotion or threshold optimization follows automatically from any conclusion.

## Historical Final rule

Historical Final remains sealed throughout this Recovery audit.

Previously observed history may be used for reproducibility and diagnostics, but it must not be described as untouched out-of-sample evidence.

The correct next source of genuinely new evidence is prospective collection after the historical audit is frozen.
