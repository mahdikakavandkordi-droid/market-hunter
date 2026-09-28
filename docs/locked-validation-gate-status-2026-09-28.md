# Locked validation gate status — 28 September 2026

Branch: `research/early-watch-validation-close-20260928`

Base repair commit: `47be4c4bc426dca3e5b74716d12db26db4c4044d`

## Implemented

- Migrated `scripts/analyze-early-watch-surface-replay.mjs` from its private dynamic 70/30 split to the shared fixed validation calendar with outcome-date purging.
- Uses `surfaceReplay.datesByHorizon[h]` independently for each horizon.
- Rejects stale reports that do not contain horizon-specific coverage.
- Validates all four locked reports against the designated numerical snapshot manifest:
  - frozen mode
  - Historical Final closed
  - unique complete batch indices
  - common source, normalization, artifact, calendar and horizons
  - per-batch snapshot ID, numerical hash, structural hash and symbol membership
- Treats a combined-market date as confirmed only when all four batch reports contain coverage for that horizon. Partial coverage is disclosed and is not counted as a zero-pick session.
- Preserves confirmed zero-pick sessions when identifying repeated-name episodes.
- Added `scripts/test-early-watch-replay-calendar.mjs` and included it in `npm test`.
- Extended `.github/workflows/locked-v2-validation.yml` with a post-backtest aggregation job that:
  - downloads all four locked outputs plus the exact numerical snapshot manifest
  - runs the Early Watch replay consumer
  - records code SHA, run URL, artifact ID, calendar and per-batch identities
  - uploads one `locked-v2-validation-evidence` bundle
- Historical Final remains closed and no scanner eligibility, ranking floor, shortlist policy or production behavior was changed.

## Local contract verification

The new Early Watch replay fixture was executed locally and passed:
- fixed calendar preserved for baseline and ranking variants
- labels crossing the validation boundary are purged
- duplicate batch identities fail
- missing horizon coverage fails
- confirmed empty sessions split repeated symbols into separate episodes
- 5D and 20D use their own coverage calendars
- partial/unavailable coverage is not treated as a confirmed zero-pick day

## Real locked run attempt

Temporary push triggering was added only to force one real execution, then removed so the workflow is again manual-dispatch only.

Attempted run:

- Run ID: `36376373072`
- Code SHA: `936cf35bd119fd3507cc6f3231a0b1736ff6c9a1`
- URL: https://github.com/mahdikakavandkordi-droid/market-hunter/actions/runs/36376373072
- Result: failed before any workflow step started.
- The `materialize-and-preflight` job shows zero executed steps and `runner_id=0`; the repository's ordinary `Check scanner` workflow failed the same way on the same commit. This indicates GitHub did not allocate a runner, so this failure is not evidence of a validation-code or snapshot-verification failure.

The protected Vercel deployment is still READY and registered as `dpl_5yFyrve6byxA6McmfE5pvsokga4Y`, but authenticated connected fetches still redirect to Vercel SSO. The exact snapshot bytes were therefore not replaced with a Yahoo refetch or any other substitute.

## Gate state

Implementation gate: **complete**.

Execution/evidence gate: **blocked externally until GitHub Actions can allocate a runner (and the workflow can use authorized Vercel artifact access).**

Do not tune Early Watch production rules from this branch until a successful locked workflow produces the evidence bundle. After that success, proceed to Development-only comparison of selling-pressure fading, fresh reclaim, and their overlap, with ordering changes tested before eligibility changes.
