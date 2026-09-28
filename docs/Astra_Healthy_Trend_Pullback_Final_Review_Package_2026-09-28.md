# Astra Review Package — Healthy-Trend Pullback Challenger
**Market Hunter research handoff — 2026-09-28**

## 1. Review objective

Please independently review the completed Healthy-Trend Pullback challenger research package. Do **not** restart the scanner, redesign the project from scratch, optimize thresholds, open Historical Final, or promote any challenger into production.

The question is narrower:

> Is the historical experiment internally defensible, is the Task-4 interpretation appropriately conservative, and is the prospective collector technically sound enough to activate after review?

The current research conclusion is **not** that the challenger has beaten Early Watch. The conclusion is that historical evidence is insufficient for a promotion decision, while the Core setup contains enough interesting excess-return behavior to justify a frozen prospective comparison.

---

## 2. Repository and frozen evidence

Repository:

`mahdikakavandkordi-droid/market-hunter`

Research branch:

`research/healthy-trend-pullback-challenger-20260928`

Branch head immediately before this handoff document:

`f80f3a4fdcf7bb23123c9d29421512dcefda898f`

Historical frozen evidence tag:

`locked-v2-validation-36420714736-archive-v1`

Historical validation source run:

`36420714736`

Historical Final remains sealed:

`finalTestOpened === false`

Do not open or substitute Historical Final during this review.

---

## 3. Research chronology already completed

### Task 1 — audit closure and protocol freeze

Completed before challenger result interpretation:

- exact boolean Historical Final guard;
- consistent Early Watch episode/sample semantics;
- explicit distinction between `CombinedPooledPreFinal` and `CombinedIncludedPurged`;
- outlier wording corrected to distinguish pinned-source internal consistency from independent market-price verification;
- challenger protocol frozen before comparison.

Protocol:

`docs/healthy-trend-pullback-challenger-protocol-v1.md`

Audit closure:

`docs/early-watch-audit-closure-2026-09-28.md`

### Task 2 — challenger implementation and timing audit

Implemented in:

`lib/healthy-trend-pullback.js`

Frozen challenger version:

`healthy-trend-pullback-v1-2026-09-28`

Timing rules include:

- decision after close of D;
- current calendar week excluded from weekly inputs;
- 2-left / 2-right pivot unavailable until the second right bar closes;
- next-session adjusted close used as entry because frozen source has no Open;
- D+1 high/low excluded from barrier ordering;
- primary path is D+2 through D+21;
- same-bar favourable/adverse crossing is ambiguous, never favourable;
- split-boundary outcome purges are enforced.

Focused regression tests:

`scripts/test-healthy-trend-pullback.mjs`

### Task 3 — fair baselines and controls

Completed and independently audited:

- current Early Watch unchanged;
- simple Trend + RS baseline;
- 100 fixed repeated-random seeds: `2026092800 ... 2026092899`;
- same-date sector + ATR14%-quintile matched random controls;
- exact opportunity-date/daily-count evidence retained;
- no force-fill when a deterministic baseline has too few picks;
- explicit shortfalls/unmatched controls;
- paired calendar-block bootstrap fixed to operate on the full confirmed calendar rather than compressed shared-date order;
- exactly 5,000 valid paired bootstrap replications required.

Independent audit confirms:

- 13,600 daily random matching records;
- 15,869 random outcome rows;
- 68 controlled deterministic opportunity records;
- no matched-identity violations;
- no random-count/opportunity mismatches.

### Task 4 — results and robustness interpretation

Review document:

`docs/healthy-trend-pullback-task4-results-review.md`

Machine-readable robustness output:

`data/research/healthy-trend-pullback/robustness.json`

The Task-4 conclusion is deliberately conservative:

**Historical evidence is insufficient to claim that the challenger has demonstrated value over Early Watch or Trend + RS.**

Only Core is retained for prospective research. Core + Volume and Core + Market are not carried forward.

### Task 5 — prospective collector implementation

Forward protocol:

`docs/healthy-trend-pullback-forward-test-protocol-v1.md`

New implementation:

- `lib/healthy-trend-pullback-forward.js`
- `scripts/collect-healthy-trend-pullback-forward.mjs`
- `scripts/audit-healthy-trend-pullback-forward.mjs`
- `scripts/test-healthy-trend-pullback-forward.mjs`
- `.github/workflows/healthy-trend-pullback-forward.yml`

Status:

**IMPLEMENTED + VERIFIED — NOT ACTIVATED**

No prospective observations have been intentionally collected by the research-branch push verification. Push events verify only; the live collector job is skipped on push.

The schedule is prepared for 22:45 UTC Monday–Friday, but GitHub scheduled workflows execute from the default branch. Therefore the schedule is not active while the workflow exists only on this research branch.

Activation should occur only after this external review.

---

## 4. Frozen challenger definition

Headline universe:

- reviewed non-CDR Canadian universe;
- raw price >= CAD 2;
- 20-session average raw-dollar volume >= CAD 3,000,000;
- sufficient daily/weekly history;
- exclude decisions within 30 symbol sessions after a split.

### Core setup

Weekly trend, using completed weeks only:

- latest completed weekly close > 10-week SMA;
- 10-week SMA > 20-week SMA;
- 10-week SMA > its value four completed weeks earlier.

Controlled daily pullback:

- drawdown from highest adjusted close in prior 20 sessions, excluding D: 4%–12%;
- close >= MA50;
- MA20 > MA50.

Recovery:

- latest confirmed 2-left / 2-right pivot high within prior 15 symbol sessions;
- D close > pivot;
- D-1 close <= pivot.

Relative strength:

- 20-session stock return minus 20-session TSX return >= 0 percentage points.

Fixed rank:

- 40 points: RS20, clipped from 0 to +10 pp;
- 25 points: four-week slope of 10-week SMA, clipped 0 to +5%;
- 20 points: pullback quality, centred around 7.5%;
- 15 points: pivot reclaim strength, clipped at 1 decision-time ATR.

Maximum visible:

6, never quota-filled.

---

## 5. Historical result summary

The comparison period contains 950 confirmed pre-Final sessions.

### Natural model volume

| Model | Days with picks | Total picks / episodes |
| --- | ---: | ---: |
| Core | 37 | 44 |
| Core + Volume | 9 | 10 |
| Core + Market | 22 | 28 |
| Trend + RS | 935 | 5,596 daily picks / 1,305 included episodes |
| Early Watch | 614 | 1,593 daily picks / 1,187 included episodes |

### Primary and 20-session results

| Model | Included episodes | Primary success | Mean 20D excess |
| --- | ---: | ---: | ---: |
| Core | 44 | 34.09% | +4.8511 pp |
| Core + Volume | 10 | 40.00% | +7.1561 pp |
| Core + Market | 28 | 25.00% | +4.5225 pp |
| Trend + RS | 1,305 | 36.32% | +0.9099 pp |
| Early Watch | 1,187 | 38.50% | +0.7859 pp |

Primary success means:

**+2 decision-time ATR before -1 ATR within 20 post-entry symbol sessions.**

The high Core excess-return average does not correspond to a superior primary barrier success rate.

---

## 6. Split instability — central caution

### Core

Development:

- 18 episodes;
- success 22.22%;
- mean 20D excess -0.0289 pp;
- median 20D excess -1.7539 pp.

Previously observed Validation:

- 26 episodes;
- success 42.31%;
- mean 20D excess +8.2295 pp;
- median 20D excess +9.0921 pp.

Validation minus Development mean-excess difference:

+8.2584 pp.

### Core + Volume

Development:

- n=4;
- success 0%;
- mean excess -3.9276 pp.

Validation:

- n=6;
- success 66.67%;
- mean excess +14.5453 pp.

### Core + Market

Development:

- n=10;
- success 10%;
- mean excess -3.6529 pp.

Validation:

- n=18;
- success 33.33%;
- mean excess +9.0644 pp.

All three variants improve sharply in the previously observed Validation history. Combined averages must therefore not be interpreted as stable out-of-sample evidence.

---

## 7. Fair-control findings

### Core versus repeated random

Core mean 20D excess:

+4.8511 pp.

Across 100 fixed ordinary-random seeds, Core is at approximately the 100th percentile for mean excess.

Core primary success:

34.09%.

This is only approximately the 44.5th percentile of ordinary-random success rates.

### Core versus sector/volatility matched random

Core mean excess is approximately at the 94th percentile of sector/ATR-volatility matched controls.

Core primary success is only approximately at the 12th percentile of matched-control success rates.

Interpretation:

The historical Core cohort contains unusually large relative moves, but not unusually frequent clean +2ATR-before--1ATR paths.

### Core versus controlled Early Watch

Early Watch had 17 pick shortfalls on Core opportunity dates and was not force-filled.

On shared episode dates:

- Core minus Early Watch success: -11.36 pp;
- 95% calendar-block interval: [-40.48, +18.18];
- Core minus Early Watch mean 20D excess: +1.4711 pp;
- interval: [-5.8313, +8.3894].

### Core versus controlled Trend + RS

Trend + RS had no shortfall.

On shared episode dates:

- Core minus Trend + RS success: -2.78 pp;
- interval: [-23.81, +21.21];
- Core minus Trend + RS mean 20D excess: +5.2173 pp;
- interval: [-0.8870, +11.2194].

No deterministic-baseline paired interval establishes a robust Core advantage.

---

## 8. Concentration findings

Core:

- 44 episodes across 35 symbols;
- top three positive symbol contributors = ~46.6% of net excess;
- top five = ~67.0%;
- removing the top five positive symbols leaves mean excess around +1.9048 pp.

Sector concentration is substantial:

- Materials: 22/44 Core episodes and roughly 75% of aggregate net excess;
- Energy: 11/44;
- Materials + Energy: 33/44 episodes and roughly 94% of aggregate Core net excess.

This is why matched sector/volatility controls are more informative than unconstrained random controls.

Core + Volume is more fragile:

- only 10 episodes;
- top three contributors ~83.7% of net excess;
- removing the top five positive contributors leaves mean excess around -2.6608 pp.

Core + Market is also concentrated:

- top five positive contributors ~95.2% of net excess;
- removing them leaves mean excess around +0.2633 pp.

---

## 9. Why the two variants were not carried forward

### Core + Market

Inside the Core sample:

TSX above MA50:

- 28 episodes;
- 25.0% success;
- +4.5225 pp mean excess.

TSX not above MA50:

- 16 episodes;
- 50.0% success;
- +5.4260 pp mean excess.

The market gate removed observations that were historically at least as good. Its mean excess was also essentially identical to sector/volatility-matched random mean excess.

Disposition:

**Do not carry Core + Market forward.**

### Core + Volume

Only 10 included episodes exist. The block-bootstrap mean-excess interval crosses zero:

[-3.2339, +17.0047].

Development has only four episodes and 0% primary success.

Disposition:

**Do not select Core + Volume for prospective v1.**

---

## 10. Ranking result

Core rank #1 did not improve the return statistic.

All Core:

- success 34.09%;
- mean excess +4.8511 pp.

Rank-one Core:

- success 35.14%;
- mean excess +4.0680 pp.

The rank formula does not currently demonstrate strong ordering power. The setup may be more useful as an eligibility/event detector than as a fine ordering score.

Do not retune the rank using these historical outcomes.

---

## 11. Historical audit evidence

Latest clean historical research workflow:

- run ID: `36473092802`
- code SHA: `f11ee16f32e03e209feafaabc3e777bb13c4c99d`
- conclusion: SUCCESS
- artifact ID: `10992372954`
- artifact SHA-256: `adcbeb9d731107eec13a9baf5f32b9d253f931d03a67192b197ef94e481d621b`

Independent audit:

- 46 checks;
- 46 passed;
- 0 failed;
- 2,636 deterministic episodes recomputed;
- 15,869 random-control outcome rows audited;
- 13,600 random daily matching records audited;
- 68 deterministic controlled-selection records audited;
- no Historical Final access.

Machine-readable sources:

- `data/research/healthy-trend-pullback/summary.json`
- `data/research/healthy-trend-pullback/robustness.json`
- `data/research/healthy-trend-pullback/audit.json`
- `data/research/healthy-trend-pullback/controlled-selections.json`
- `data/research/healthy-trend-pullback/checksums.json`
- `data/research/healthy-trend-pullback/run-metadata.json`

---

## 12. Prospective collector design

### Collected models after activation

Only:

1. Core — `healthy-trend-pullback-v1-2026-09-28`
2. Trend + RS — same HTP implementation version
3. Early Watch — `market-hunter-v2-rebuild-h2p10-2026-09-26`

Core + Volume and Core + Market are explicitly absent.

### Source handling

The collector fetches Yahoo chart data from query1/query2.

It stores:

- adjusted close;
- adjusted high/low reconstructed with adjustedClose/rawClose;
- raw close and raw volume for liquidity;
- split event dates;
- per-symbol source hashes;
- benchmark source hash;
- universe definition and universe SHA-256;
- Git commit;
- model version;
- decision-time audit fields.

### No historical backfill

A model observation can be created only when the latest completed TSX `marketAsOf` equals the collector's current UTC date.

Therefore a later run cannot reconstruct an old day and call it prospective.

### Append-only semantics

Files after activation:

- `inputs.jsonl`
- `observations.jsonl`
- `outcomes.jsonl`
- `runs.jsonl`
- derived `status.json`
- derived `audit.json`

A reused immutable identity with different content throws `append_only_conflict`.

### Explicit daily states

- `complete_zero_pick`
- `complete_nonzero`
- `partial_coverage`
- `collector_failure`
- `market_not_completed`
- run-level `no_new_completed_market_session`

Only a complete zero-pick day is allowed to reset future episode continuity.

### Outcome maturation

Outcomes are appended separately after maturity.

Frozen convention:

- next-session adjusted close entry;
- D+1 high/low excluded;
- D+2 through D+21 primary path;
- +2 ATR favourable;
- -1 ATR adverse;
- same-bar both-hit ambiguous;
- >7-calendar-day gap separately excluded from primary path;
- 5/10/20 close-return and TSX-excess diagnostics.

A split during the decision-to-final horizon is conservatively labelled `corporate_action_during_horizon` and excluded from the primary barrier denominator rather than combining an old ATR scale with later restated adjusted prices.

---

## 13. Prospective verification evidence

Latest clean forward-verification workflow:

- run ID: `36473091766`
- verified code SHA: `f11ee16f32e03e209feafaabc3e777bb13c4c99d`
- conclusion: SUCCESS
- artifact ID: `10991633924`
- artifact SHA-256: `3983581d6dbff0a502bdaaaff957095c7c07511adea185043262ded215a1dd39`

The push verification did **not** execute live collection.

It verified:

- frozen HTP timing/model tests;
- forward Yahoo normalization;
- adjusted high/low scale handling;
- append-only duplicate/conflict behavior;
- complete/zero/partial/failure state distinctions;
- next-session entry alignment;
- exclusion of D+1 barrier extremes;
- ambiguous same-bar handling;
- post-decision split exclusion;
- empty pre-activation forward-store integrity audit.

Current activation status:

**IMPLEMENTED + VERIFIED — NOT ACTIVATED**

No historical records should be relabelled as prospective.

---

## 14. Prospective stopping rule

First formal review occurs at the earlier of:

1. 160 complete Canadian market sessions, with all primary 20-session horizons matured; or
2. 120 matured Core first-surface episodes, provided at least 80 complete market sessions were collected.

If neither is achieved by 2027-06-30:

- review coverage/data-quality only;
- do not tune on incomplete evidence.

Administrative review date:

2027-07-30.

No interim tuning or production promotion.

---

## 15. Reproduction / verification commands

### Repository regression suite

```bash
npm test
```

### Historical challenger reconstruction

Use the frozen evidence tag and the workflow:

`.github/workflows/healthy-trend-pullback-challenger.yml`

The workflow:

1. materializes exact archived numerical inputs from `locked-v2-validation-36420714736-archive-v1`;
2. verifies SHA-256 checksums;
3. reruns Early Watch closure;
4. reruns predeclared challenger comparison;
5. derives robustness diagnostics;
6. runs independent audit;
7. refuses success if Historical Final is not sealed or an audit fails;
8. uploads durable evidence.

Key commands inside the frozen environment:

```bash
node scripts/analyze-early-watch-episode-stability.mjs
node scripts/audit-early-watch-episode-stability.mjs
node scripts/analyze-healthy-trend-pullback.mjs
node scripts/summarize-healthy-trend-pullback-robustness.mjs
node scripts/audit-healthy-trend-pullback.mjs
```

### Prospective-store verification

```bash
node scripts/test-healthy-trend-pullback-forward.mjs
node scripts/audit-healthy-trend-pullback-forward.mjs
```

Do not run `collect-healthy-trend-pullback-forward.mjs` against an old market date to create a historical prospective cohort. The collector itself contains a same-day market guard.

---

## 16. Requested independent Astra review

Please focus on finding substantive weaknesses, not stylistic rewrites.

### A. Historical integrity

Verify independently:

1. decision timestamps contain no lookahead;
2. weekly current-week exclusion is correct;
3. pivot confirmation cannot leak future right bars;
4. next-session entry / barrier ordering is internally consistent;
5. Development and previously observed Validation are labelled honestly;
6. Historical Final remains sealed;
7. the combined results are not overstated given split instability.

### B. Baseline/control fairness

Check:

1. controlled Early Watch and Trend + RS opportunity-date matching;
2. deterministic shortfall handling;
3. fixed random seed set;
4. sector + ATR-volatility quintile matching;
5. whether matched controls are constructed without outcome information;
6. paired calendar-block bootstrap implementation;
7. whether another non-tuned control is essential before prospective activation.

### C. Task-4 interpretation

Challenge these current dispositions:

- Core: retain only as prospective research challenger;
- Core + Volume: do not carry forward;
- Core + Market: do not carry forward;
- no ranking retune;
- no production replacement.

If you disagree, identify the concrete evidence and the exact reason. Do not optimize new thresholds from the same historical sample.

### D. Prospective collector

Review:

1. Yahoo adjustment normalization;
2. universe/input hashing;
3. append-only identity rules;
4. prevention of historical backfill;
5. distinction between zero-pick and partial/failure days;
6. outcome maturity;
7. corporate-action-during-horizon exclusion;
8. whether Early Watch V2 reference is reconstructed faithfully;
9. whether the schedule/activation mechanism is safe;
10. whether any missing field prevents future independent audit.

### E. Activation decision

Return one of these operational recommendations:

- **Ready to activate unchanged**
- **Ready after specific collector/audit fixes**
- **Do not activate yet; material research-design issue remains**

This activation recommendation concerns the prospective **research collector**, not production scanner promotion.

---

## 17. Constraints for this review

Please preserve these constraints:

- do not change Early Watch production behavior;
- do not merge Core into production;
- do not open Historical Final;
- do not tune thresholds or weights from these historical results;
- do not reintroduce Core + Volume or Core + Market unless a new protocol is explicitly justified;
- do not replace frozen evidence with live market downloads;
- do not treat previously observed Validation as untouched out-of-sample evidence;
- do not treat a high historical mean excess as sufficient proof by itself.

The purpose of Astra's review is to challenge the integrity and interpretation of this completed research package before prospective activation.
