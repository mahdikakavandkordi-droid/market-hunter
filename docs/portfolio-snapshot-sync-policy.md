# Portfolio snapshot synchronization policy

This document describes the deterministic replacement policy used by the Market Hunter portfolio snapshot cache and cloud copy.

## Scope

Portfolio snapshots are presentation/account-state data. They do not change scanner stages, model scores, ranking rules, Historical Final, or prospective research evidence. Intraday quotes remain separate from completed-session portfolio/model inputs.

## Applicability

A snapshot is applicable only to the currently reconciled portfolio context.

For a non-empty portfolio, all of the following must hold:

- the snapshot has a valid `YYYY-MM-DD` market date;
- every required holding appears exactly once;
- every item has an `asOf` date equal to the snapshot market date;
- the item-symbol set exactly matches the current portfolio-symbol set;
- declared context metadata, when present, matches that same set.

A snapshot for an older subset is therefore not complete after cloud reconciliation adds a holding.

A smaller snapshot can be valid after an intentional holding deletion because the current reconciled portfolio context has changed. The algorithm does not prefer snapshots merely because they contain more symbols.

## Empty portfolios

Deleting the final holding creates an explicit empty portfolio context for the existing completed-session date when one is already known. It does not manufacture a new market date.

The metadata contains `portfolioEmpty: true` and an empty `portfolioSymbols`/ `requestedSymbols` set. This lets cloud reconciliation distinguish an intentional empty portfolio from a failed or empty API response.

## Same-day replacement

For two applicable snapshots on the same market date:

1. An invalid or wrong-context snapshot cannot replace a valid applicable snapshot.
2. If both are valid, source freshness is compared using `sourceGeneratedAt`, then `capturedAt` as the compatibility fallback.
3. Cloud row `updated_at`, upload time, and revision number are **not** treated as evidence that the underlying market data is newer.
4. If source freshness is equal or cannot be established, the incumbent is retained.

The cloud compare-and-swap revision remains a concurrency guard. After a CAS conflict, the server row is re-read and the replacement policy is evaluated again before any retry.

## Metadata

Newly written complete snapshots may include:

- `complete`
- `requestedSymbols`
- `portfolioSymbols`
- `portfolioEmpty`
- `portfolioContextKey`
- `capturedAt`
- `sourceGeneratedAt`

Existing non-empty stored snapshots remain readable. If `portfolioSymbols` is absent, the reader falls back to `requestedSymbols`, and then to the item symbols for legacy payloads.

Partial attempts, mixed dates, missing item dates, and older responses remain diagnostic attempts and do not replace the last valid complete snapshot.

## Session isolation

All asynchronous cloud and portfolio operations capture both the account identity and a session epoch. Responses, catch/finally handlers, queued synchronization, refresh results, and cloud writes may mutate account-scoped state only while that captured context is still active.
