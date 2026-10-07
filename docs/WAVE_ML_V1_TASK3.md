# Wave ML V1 — Task 3 development labels and chronological split machinery

## Scope and readiness

Adds outcome-only label construction and fold manifests to the existing frozen
Task 1 contract and Task 2 dataset. Source prices, feature eligibility and the
contract were not changed. This completes the development label/split machinery;
full-universe data acceptance remains blocked. No model was trained, selected,
activated or attached to a paper/real account.

The historical run processes only pre-2026-04-01 development decisions from
nonreserved symbols. Every reserved symbol is skipped, and the public label API
rejects both reserved-symbol histories and final-time decisions. Final feature
counts can be inventoried, but their outcomes are never computed or summarized.

## Source-quality diagnosis

The nonreserved, pre-final mismatch audit finds 409 opening-only, 98 closing-only
and 399 both-boundary mismatches. Examples inspected during diagnosis show
opening discrepancies with nearly equal closes; this does not establish a
constant adjustment multiplier or which source is correct. The cause remains
unverified. No guessed rescaling, threshold relaxation or warmup shortening was
introduced. Repeated Task 2 quality resets explain why some symbols cannot reach
250 continuous accepted bars; the seven-symbol zero-feature finding remains.

Authoritative stock regular/short-session calendar validation is still absent.
All real stock labels are therefore retained as unresolved, without manufacturing
fills or interpreting absent bars as no trade. Synthetic stock calendar fixtures
exercise the label interface, but are not approval for real exchange schedules.
Crypto uses its complete UTC grid; accepted paths additionally need a daily quote
and all six valid 4H bars for each inspected day. Daily opening/closing consistency
uses the unchanged 0.5% engineering threshold. Daily verification becomes known
at the next UTC midnight, which extends the label information interval even when
an intrabar exit occurs earlier. Missing later same-day sources invalidate that
cross-check; the code does not silently accept a partial comparison.

## Labels

`lib/wave-ml/labels.mjs` requires the first scheduled open at/after daily
availability. It never skips a missing scheduled entry to a later convenient bar.
The entry bar counts toward the 60-bar maximum. Risk is twice decision ATR14;
stop is 1R and target 2R. Adverse opening gaps fill at open, favorable opening
gaps fill at the target boundary, and an intrabar collision is stop-first for
both long and short. Time exits fill at the 60th bar close. Admitted trades pay
0.05R; a verified entry expiration pays no trade cost. Missing sources, splits,
invalid boundaries, incomplete calendars and unfinished paths produce null
outcomes plus an unresolved reason. The 75-day wall limit is enforced.

Label records contain future entry/exit data and must never enter predictors.
They describe the separate ATR challenger policy, not Elliott V1 account returns.
Source history is retrospectively observed/revised and is not point-in-time data.
No profitability or real short borrow/funding feasibility is established.

## Splits

`lib/wave-ml/splits.mjs` assigns whole UTC decision days across all symbols and
both directions. Unresolved/incomplete direction pairs are excluded together.
Training rows must precede the evaluation boundary by 75 calendar days AND their
whole-day maximum resolved information end must be strictly before the boundary.
Evaluation groups whose information end reaches the next window are also purged.
Unresolved records never contribute fitting targets or zero-return observations.

Validation windows are January–February 2026 and March 2026. Expanding fitting
sets remain subject to the same embargo, so March validation does not simply
reuse January labels without a horizon check. A final-fit-only candidate pool
uses the April boundary and embargo; it contains no final evaluation labels and
is metadata for a future locked fitting procedure, not a trained model.

## Observed development result

| Item | Count |
|---|---:|
| Development direction rows | 66,420 |
| Resolved preliminary crypto labels | 3,767 |
| Unresolved rows, retained for coverage | 62,653 |
| Real stock rows, all unresolved | 62,092 |
| Reserved symbols skipped | 12 |
| Sealed final feature rows, no labels | 1,486 |

Crypto meets nominal per-direction count and 12-month span checks: fold 1 has
778 fitting / 384 evaluation rows per direction; fold 2 has 1,012 / 160. These
are correlated opportunities, not independent trades or effective sample sizes.
All 16 stock market/direction/fold count gates fail with zero admitted labels.
Overall training readiness remains false; neither crypto counts nor a completed
implementation waive the full-universe integrity gates. No class performance,
net-return summaries or final outcomes are opened in this task.

## Verification and reproduction

Thirteen new focused tests pass, alongside seven unchanged feature tests. They
cover directional collisions and gaps, horizon accounting, missing scheduled
bars, daily-verification timing/coverage, splits, censoring, invalid boundaries,
stock calendar requirements, final/reserved isolation, future perturbation,
75-day embargo, exact interval purging and UTC/pair grouping. Offline replay of
the frozen source data reproduces the exact label and split hashes. Existing
production code is untouched; this partial checkout does not provide an
application-wide verification environment.

```
node scripts/test-wave-ml-features.mjs
node scripts/test-wave-ml-labels.mjs
node scripts/build-wave-ml-labels.mjs
```

The last command requires the checksummed Task 2 dataset at its documented path.
It writes a separate immutable compressed development label/split file and a
small `task3-report.json`; it refuses changed replay output. The Task 3 result
archive includes that file, report, contract and this document. Its receipt is
`task3-artifact.json`. No Task 2 package or operational ledger was rewritten.

## Next gate

Verify daily/hourly quote conventions and authoritative historical stock
sessions with provenance; accept only demonstrably complete execution paths.
Then re-run development coverage on a separately versioned accepted dataset,
review the reserved-symbol feature feasibility without opening final labels,
and verify all-market support and independent horizon-sized block support before
Task 4 training. Do not replace holdouts or optimize source filters using outcomes.
