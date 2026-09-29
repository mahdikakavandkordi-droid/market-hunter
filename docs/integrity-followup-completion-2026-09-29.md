# Integrity follow-up completion

PR: https://github.com/mahdikakavandkordi-droid/market-hunter/pull/8

Production baseline: `d40d050270b71af502c1024bcc7d4924d3a39973`.
Sol's work preserved through `059e29e`; completion continues on the same branch.

## Completed scope

- Session epochs invalidate late cloud, portfolio and refresh responses after account changes, including logout and re-login to the same account.
- Nasdaq-100 presentation uses `^NDX`; `^IXIC` cannot substitute for it. Missing hourly coverage retains the completed-session fallback.
- Snapshot writes validate symbol coverage, per-item dates and source freshness, and re-read after revision conflicts. Intentional empty portfolios are explicit.
- Outcome retry coverage runs the actual pinned collector three times against isolated provider fixtures. It verifies a delayed matured outcome, immutable daily observations and deduplication. The test clock is fixed; production collector code and its pin are unchanged.

## Additional defects closed during completion

1. Computed portfolio entries and analytics survived a session switch in memory. Scope changes now clear those caches immediately. A behavioral test reproduced the old state leakage and passes after the fix.
2. A holding could be added while the cloud snapshot GET was pending, after applicability had already been calculated. Each attempt now revalidates the local snapshot and holdings after the awaited read. The regression proves the former subset is not uploaded.
3. An old portfolio API response could apply after quantity or entry edits within the same account. Requests now check both their sequence and the captured holdings before applying analytics or saving a snapshot.

The race-test fixtures now include the actual cloud row's `market_as_of` field. Without it, tests could mistake a malformed remote fixture for a stale snapshot. Assertions use the application's session-invalidation error contract.

## Verification

- `npm test`: full required regression suite passes locally, including the real pinned collector integration, account races, snapshot behavior and instrument identity.
- `npm run test:browser`: Chromium mobile smoke passes; saved session reload, edit/remove, durable tombstone, hourly/fallback labels, Watchlist and Nasdaq identity are covered. No browser console/page errors were observed by the test.
- `git diff --check`: passes.
- GitHub Actions results for the final branch commit remain the authoritative CI gate; see PR checks.

The supplementary agent-browser CLI could not start its daemon in this workspace after two attempts. Browser validation above used the repository's Playwright Chromium test successfully.

## Boundaries

No database migration or production data manipulation was performed for this follow-up. Tests use synthetic accounts and temporary evidence. Two populated production accounts on two physical devices have not been exercised.

Scanner thresholds, ranking weights, model selection, Historical Final and existing research records remain unchanged. These changes provide no evidence of predictive superiority.

The PR is prepared for review; production merge/deployment is a separate step.
