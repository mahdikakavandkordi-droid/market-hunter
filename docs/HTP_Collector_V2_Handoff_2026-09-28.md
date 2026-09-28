# HTP collector v2: implementation and handoff

Scope: repair prospective evidence collection and support reviewed activation. No scanner rules, weights, model version, Historical Final access or production integration changed.

## Implemented

1. Full replayable inputs. Each capture saves a compressed, SHA-256-addressed snapshot containing the complete normalized histories used by all models, benchmark, raw price fields, events and vendor metadata. Input attempts and matured outcomes reference their exact snapshots. The offline audit replays selections and outcomes from these files. Missing or modified snapshots fail audit.
2. Consistent ATR scale. Picks freeze original ATR, decision adjusted/raw close and the ATR lookback. Maturity rebases the frozen ATR to the current snapshot's decision-date adjustment factor. It preserves the original value and records the conversion. Nonuniform historical revisions and raw-price corrections are excluded explicitly; horizon splits remain excluded.
3. Safe retries. Every attempt is retained. Partial attempts do not publish primary observations. The first complete same-day attempt becomes canonical; reruns cannot replace it. An interrupted publication recovers from the original journal. Reruns also retry outcome processing independently of whether today's decisions are already complete. Later-day backfill remains blocked.

The new model adapter extracts the existing calculation unchanged, so collector and offline audit execute the same selection code. The audit demonstrates reproducibility, not independent proof of model quality.

## Verification

Local validation: the complete `npm test` suite passed, including the existing Historical Final isolation guards. No historical research run was performed.

`npm test` includes the existing forward regression script, which now also runs `test-healthy-trend-pullback-forward-store.mjs`.

New regressions cover adjusted-price rescaling, invalid anchors and inconsistent revisions; actual collector partial-to-complete retries; immutable canonical picks; recovery after interrupted observation publication; no next-day backfill; nonempty pick/outcome replay; repeated maturity without duplicates; altered picks/outcomes; corrupt or missing snapshots; and rejection of legacy stores.

The collector integration fixture replaces network access and the clock. It does not collect actual market evidence or activate the schedule.

Offline store verification:

```sh
HTP_FORWARD_DIR=data/research/healthy-trend-pullback-forward node scripts/audit-healthy-trend-pullback-forward.mjs
```

## Operational status after review

1. The collector/storage amendment was reviewed and activation was deliberately performed from `main` using a workflow pinned to commit `1b967b798534525871efc6aff2f76a2582bf1fe9`.
2. Durable evidence is isolated on `research/htp-forward-evidence`; production scanner and frontend behavior remain unchanged.
3. The first live attempt on 2026-09-28 was partial: 226/227 symbols, with `ARX.TO` missing the market session. The attempt and snapshot were preserved, but no canonical observations were published.
4. Operational recovery was hardened afterward: up to three same-day retries are attempted, a second 23:35 UTC recovery schedule exists, an already complete day is skipped, and a still-partial day fails/degrades the workflow instead of appearing successful.
5. Continue monitoring coverage, fetch failures, snapshot storage growth and excluded revision outcomes. After 21 symbol sessions, verify real matured outcomes reference committed snapshots and replay offline. Keep the existing stopping rule; do not tune on interim outcomes.

## Operational limits

Writers must be serialized (the workflow already has a concurrency group). Captures crossing the UTC date boundary are rejected. Compression and content addressing reduce storage, but daily full-universe history snapshots still grow the repository; monitor actual size before choosing a separate durable store. Expiring Actions artifacts are not the canonical snapshot store.

Live Yahoo collection is now active; sustained storage cost and actual corporate-action cases remain to be observed. Synthetic passing tests do not establish predictive superiority over Early Watch or Trend+RS.
