# Portfolio snapshot reconciliation policy

Portfolio snapshots remain presentation/history data derived from completed-session portfolio responses. They do not alter scanner/model inputs or research evidence.

For the active account generation, a snapshot is applicable only when all of the following hold:

- every currently held symbol is represented exactly once;
- no symbol outside the current holding set is present;
- every item has an explicit `asOf` date equal to the snapshot market date;
- the snapshot is marked complete;
- when `meta.requestedSymbols` exists, it matches the current holding set.

This makes completeness contextual: a snapshot that was complete for an older portfolio composition becomes inapplicable after a holding is added or removed.

For same-day reconciliation, source freshness is taken only from persisted capture/source metadata (`sourceGeneratedAt`, falling back to the original `capturedAt`). Database revision numbers and the time of a later cloud upload are not treated as proof that the underlying market data is newer.

Replacement is deterministic:

1. A valid snapshot beats an invalid/inapplicable snapshot.
2. A later market date may replace an earlier applicable date; date regression is not allowed.
3. For the same market date, when both source timestamps are available, the later source capture wins.
4. If same-day freshness cannot be established, the incumbent copy is preserved: local during cloud-load reconciliation and server-side during a write attempt.
5. After a revision conflict the server row is re-read and the policy is evaluated again before any retry.

An intentionally reduced portfolio is validated against the reduced holding set; a larger old snapshot is not preferred merely because it contains more symbols. A genuinely empty portfolio has no applicable position snapshot and therefore cannot resurrect a prior non-empty snapshot. Existing legacy snapshots remain readable; missing metadata is tolerated, but it is never invented as evidence of newer source data.
