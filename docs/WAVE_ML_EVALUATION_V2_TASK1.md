# Wave ML evaluation V2 — Task 1 contract amendment

The user authorized the evaluation redesign after review of the V1 development
support failure. This task adds `evaluation-v2-contract.json` as a separate full
contract derived from V1. The original `contract.json`, source archives, feature
matrices, labels and V1 split manifests retain their identity. This is a documented
amendment after inspecting development counts/information intervals, not a claim
that the new dates were the original untouched preregistration. No model scores,
class return summaries or reserved/final outcomes informed this amendment.

## Decision windows and observation deadline

All bounds are UTC, start-inclusive and end-exclusive.

| Role | Decision start | Decision end | Label information must be known before |
|---|---|---|---|
| Development training eligibility | 2024-10-08 | Fold-specific embargo cutoff | The respective fold decision start |
| Validation 1 | 2026-01-01 | 2026-03-01 | 2026-06-15 |
| Validation 2 | 2026-03-01 | 2026-04-01 | 2026-06-15 |
| Maturity-only gap | 2026-04-01 | 2026-06-15 | No decisions admitted to fit/evaluation |
| Primary final decisions | 2026-06-15 | 2026-07-24 | Final labels remain sealed |

The maturity gap is exactly 75 calendar days, equal to the unchanged maximum
label wall horizon including entry. Every pre-April validation decision therefore
has the full allowed observation horizon before the new final decision period.
A March entry whose valid exit is in April belongs to March validation; it is not
excluded merely because its exit is later than April 1.

Before June 15 the whole validation window is unready for scoring; it must not be
reduced to an early-resolved cohort. After maturity, all eligible decisions remain
in coverage, including unresolved/invalid paths with null targets. Existing
quality exclusions and paired directions are retained. No horizon or sample
minimum was reduced and no price source was rescaled.

## Fitting isolation and retained rules

Each validation model fits only the eligible past of its own decision start.
Training labels must have information end strictly before that start, AND the
75-day pre-boundary fitting embargo must hold. Whole UTC decision days across
markets and paired directions retain shared assignments. Delayed evaluation of
January/March decisions is not permission to train those earlier models using
later data. Selection/calibration/thresholds lock from matured development data
before any primary final labels can open.

The final-refit candidate pool may use only decisions before April 1, whose
information end is strictly before June 15, with the unchanged 75-day embargo.
April-to-June decisions are not added to fitting or validation. All twelve
reserved symbols remain excluded from every development history; only their
June 15–July 23 decisions are eligible for the future primary final score.
Task 1 does not compute those outcomes.

The new contract retains the exact universe, wave/indicator features, 250-bar
warmup, long/short opportunity policy, ATR risk rules, 60-bar horizon, costs,
quality requirements, model/baseline plan, trial cap and sample minima. Training
readiness and operational enablement remain false until the next tasks verify
implementation, coverage and integrity. Statistical evidence gates remain in
force after any exploratory research fitting.

## Versioning and next tasks

V2 tags must be derived from original `availableAt` and reserved membership in a
separate manifest. V1 feature tags beginning final time on April 1 must not be
inherited blindly or overwritten. Pre-April development label records may be
reused only after checking parent/source/feature/calendar/label checksums. No
new source requests or label production are needed for this contract task.

1. Task 1: this separate contract and invariant verification.
2. Task 2: separate V2 split/partition implementation and manifest.
3. Task 3: causal isolation tests and frozen-data replay; measured support.
4. Task 4: explicit research readiness report for review; no fitting/activation.

## Verification and limits

Direct invariant checks confirm exact preservation of V1 universe/sample/
execution/model/gate objects and retained split properties, including twelve
reserved symbols, 75-day embargo, train start and July 24 end. Original V1
canonical SHA-256: `7d559f5a8bb7792e01c42400e395933435b59436055eec0a88ef2f3fa1fe9d3a`.
The amendment stores that parent hash and the reviewed commit for provenance.
The gap calculation is 75 days; the final decision window is only 39 days.

Thirty-nine days cannot supply strong independent 75-day horizon-block evidence.
A successful support check or future exploratory model fit is therefore not proof
of profitability and cannot bypass the independent-evidence/no-promotion gate.
Longer prospective evidence will be necessary. Existing source-quarantine and
reserved feature feasibility issues still need explicit accounting. This task
changes no runtime code and starts no training or final evaluation.
