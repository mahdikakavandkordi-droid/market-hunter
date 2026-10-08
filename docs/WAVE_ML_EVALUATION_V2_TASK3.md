# Wave ML evaluation V2 — Task 3 causality and replay verification

Task 3 adds 20 focused V2 regression tests and a reproducible offline audit of
all stored development split records. It completes engineering verification;
Task 4 remains the readiness assessment. No model is fitted, no performance
metric is computed, and reserved/final outcomes remain unopened.

## Regression coverage and corrections

The suite exercises UTC window boundaries, strict outcome deadlines, the common
whole-window maturity gate, 75-day whole-day embargo, global day training interval
purging, paired directions, unresolved/incomplete coverage, explicit observation
cutoffs, reserved-symbol and gap/final exclusions, and final-refit metadata.
March decisions with April/May exits remain in the March evaluation cohort.
Changing validation outcome timing or return/class values cannot change the
earlier fitting assignments; split records contain no outcome values.

An isolated runner fixture tests deterministic byte replay, modified label and
feature checksums, contradictory accepted metadata, and changed existing output
or report. The fixture uses temporary synthetic data and no network source calls.

Two missing validation groups were identified and corrected:

* The split contract now requires UTC mode and agreement between the top-level
  validation start/deadline and their window definitions.
* The runner now requires the accepted report's observation cutoff to match the
  input, an approved calendar, unopened final labels and no started training.

These guards reject inconsistent inputs. Valid real-data output retains the
original Task 2 identity; the contract, source data, features, accepted labels,
V1 implementation and outputs are unchanged.

## Reproduction

With the checksummed research data packages restored at their original paths:

```
node --test scripts/test-wave-ml-splits-v2.mjs
node scripts/verify-wave-ml-splits-v2.mjs
```

The verifier runs all four focused test files (26 prior V1 tests plus 20 V2
regressions), invokes the offline split runner, checks the Task 2 hashes, then
audits every development fold record. It independently checks decision bounds,
paired admission, whole-day fitting interval purges, cutoff isolation and
coverage/count preservation. It also changes validation outcome metadata and
verifies earlier fitting assignments are unchanged, checks the pre-deadline
zero-evaluation gate, and verifies protected file bytes before/after execution.

A successful run writes `evaluation-v2-task3-report.json`; subsequent runs
require the same report. The tests and audit do not load raw final outcomes.
Restored heavy input/output archives are required; they are intentionally not
included as large Git blobs. No application-wide test claim is made for this
partial checkout.

## Recorded result

All 46 focused tests passed. The audit covers 78,468 feature tags, 66,420
accepted development labels and 199,260 fold records. It retains 1,745 March
evaluation direction rows whose information end is in April or later. Those
rows and paired long/short counts are dependent samples, not independent
observations or evidence of profitability.

Offline replay retains manifest hash
`df8d0368346eeeeea19a0ca0abdbe97d345373fa0f94264b85f6ef49cd131f52`.
The report records separate hashes, counts and assertions; the Task 2 report
remains an immutable record of that earlier stage.

Research training readiness stays false. Task 4 must assess coverage, missing
reserved histories/features, data quality limits and the short 39-day final
window before any training decision. Existing source limitations are unchanged;
these tests verify split isolation and replay, not the model's trading ability.
