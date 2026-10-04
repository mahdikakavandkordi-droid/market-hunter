# SMC forward ledger continuity audit — 2026-10-04

Scope: `SMC Forward Paper Track` on evidence branch `research/smc-wd4h-tsx-validation-20261001`.

## Failed run

GitHub Actions run **36936346072** failed on 2026-10-01 in **Persist immutable forward ledger**. The tracker itself completed successfully. The push was rejected with `fetch first` / non-fast-forward because the evidence branch had advanced after checkout.

The failed run checked out commit `bec97b38ab1d803bb4729d8bb2cab1c56939b3dd` and generated its snapshot at `2026-10-01T22:39:42.438Z`.

The contemporaneous tracker output was:

- closed trades: 0
- entered / skipped / open: 0 / 0 / 0
- open paper trades: 0

The local failed commit `872e231` changed only the three forward-paper files and was never pushed.

## Record-level continuity

Ledger commits before the failed persistence:

- `721a1071bc79d081e2c574b91287ae314a74c378` — updated `2026-10-01T13:20:07.785Z` — **0 trades**
- `22d20aa577f29a7d239fd9c42f96cb6da1bc6a57` — updated `2026-10-01T22:32:26.034Z` — **0 trades**

The failed 22:39 run also reported **0 trades**, so there is no missing decision record to reconstruct for October 1.

The next successful paper-ledger commit was:

- `3bc0a93c4d7e1e0673d3bc69880f2dd20c7b42b2` — updated `2026-10-02T22:39:47.382Z`

It contains exactly two unique trade identities:

1. `L.TO|2026-10-02T17:30:00.000Z|-1` — signal `2026-10-02T13:30:00.000Z`
2. `SU.TO|2026-10-02T17:30:00.000Z|1` — signal `2026-10-02T13:30:00.000Z`

No duplicate identities were found. There is no October 1 trade in the current ledger, consistent with both earlier persisted ledgers and the failed run's contemporaneous output.

**Conclusion:** no decision-record gap was found. The unrecovered item is only the failed run's generated timestamp/latest snapshot refresh; recreating that historical snapshot would be a backfill and is intentionally not done.

## Repair

Persistence now serializes all workflows that write the shared SMC evidence branch, fetches/rebases before push, retries non-fast-forward pushes, and validates that prior trade identities and immutable fields cannot disappear or change. Closed outcomes also cannot be rewritten. A synthetic git regression reproduces an unrelated concurrent branch write and proves the production persistence helper rebases/pushes successfully without rewriting the ledger.
