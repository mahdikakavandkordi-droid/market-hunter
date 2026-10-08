# Wave ML evaluation V2 — Task 2 split implementation

Implements the separate V2 contract from Task 1 in `splits-v2.mjs` and the offline
`build-wave-ml-splits-v2.mjs` runner. V1 code, source/feature archives, contracts,
labels and split outputs retain their versioned identities. No source refetch,
new labels, model fitting or final outcome inspection is performed.

## Behavior

The new split builder reads explicit decision windows and outcome deadlines from
the V2 contract. Validation membership is fixed by the decision timestamp/whole
UTC day, not by whether the trade closes before the decision month ends. A March
decision with an April outcome can be evaluated after the common June 15
observation deadline. Before that deadline, the entire validation window is
unready; the builder emits no early-resolved evaluation subset.

`cohortRole` retains all decision-window members in coverage, even when their
pair is unresolved or incomplete. `role` admits fitting/evaluation targets only
for complete resolved long/short pairs, with explicit exclusion reasons. A late
or unresolved label cannot change that decision's fold membership or move it
into training. Evaluation information must be known strictly before the fixed
outcome deadline; no unknown label becomes a zero outcome. Existing pair quality
requirements are preserved, and dependent sample counts remain dependent.

Training still uses the 75-day pre-boundary embargo and whole-day maximum
resolved information end strictly before each fold's decision start. Individual
admitted training outcomes must also be observed by the explicit source cutoff.
Whole-day cohort assignment and paired directions remain grouped. Final-refit
metadata admits only pre-April decisions, with June 15 interval isolation and
the unchanged embargo. It is candidate metadata, not a fitted model.

The new module rejects any reserved-symbol label, any label decision on/after
April 1, duplicate IDs, malformed information intervals and inconsistent V2
configuration. The runner checks parent contract, source/feature manifest,
calendar and accepted label/split checksums, all original feature matrices, and
label-to-feature identity. It does not inherit V1 partition tags blindly.

## Versioned feature tags and outputs

The runner derives 78,468 V2 tags from original feature `availableAt` and reserved
membership. Pre-April development rows become training candidates or one of the
two validation windows. April 1–June 15 is a maturity-only exclusion; June 15–July
24 features are tagged development-final-time or sealed-final according to
reserved membership. Features/values are not rewritten. These tags cover stored
V1 feature rows only; they do not recover histories omitted by the V1 feature
builder or any symbol with no eligible features.

The compressed `dataset/evaluation-v2-splits.json.gz.b64` contains separate tags
and fold records, references to the input label hash, and no copied outcome
values. `evaluation-v2-task2-report.json` records hashes, cohort/role counts and
provenance. Replay refuses any changed output/report. The downloadable archive
and its `evaluation-v2-task2-artifact.json` receipt persist this output separately.

## Observed preliminary support

Counts below are per direction; paired long and short have the same count.

| Market | Validation 1 admitted | Validation 2 admitted |
|---|---:|---:|
| US | 923 | 528 |
| Canada | 939 | 528 |
| Crypto | 472 | 248 |

All original unresolved decisions remain in the coverage records. These are
preliminary engineering counts, not independent sample sizes or performance.
Research training readiness stays false until Tasks 3 and 4 verify integrity,
coverage, source limitations, reserved feature feasibility and evidence support.
No profit/class-return metrics or final outcome values were opened.

## Task 2 checks and reproduction

The initial build and one offline replay produced identical output hashes.
Direct real-data assertions check that March rows with April-or-later outcomes
are retained, every admitted fitting label ends before its fold start and its
decision precedes the embargo cutoff, all development labels exclude reserved/
gap/final decisions, and the whole window remains unevaluated before June 15.
Partition checks exercise reserved histories, the maturity gap and sealed-final
tags. This is preliminary verification, not the complete formal Task 3 suite.

```
node scripts/build-wave-ml-splits-v2.mjs
```

The original checksummed Task 2 data and accepted calendar label package must be
available at the documented dataset path. Runtime engines, accounts and work
schedules are untouched; application-wide testing is outside this partial
checkout. Task 3 adds focused causality, boundary and tampering tests and a formal
replay report. Task 4 reports readiness for review without training.
