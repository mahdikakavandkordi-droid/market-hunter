# Healthy-Trend Pullback Prospective Collection Protocol v1

**Status:** PROPOSED ONLY — not activated or verified as a live collector.  
**Frozen on:** 2026-09-28  
**Historical backfill:** prohibited.

## What already exists

The repository already has an append-oriented daily collection pattern in:

- `.github/workflows/daily-snapshot.yml`
- `scripts/update-history.mjs`

That path preserves a daily surfaced cohort and later appends matured outcomes. It is useful as an implementation pattern.

It is **not sufficient to claim prospective evidence for this challenger** because the current live scanner does not expose the exact challenger model version, exact challenger input identities, or the predeclared next-session-entry / 20-session ATR outcome schema. Existing historical records must not be relabelled as challenger prospective observations.

Accordingly, this document proposes a separate collector. No collector is activated by this research branch.

## Frozen model versions

Collect all four deterministic comparison models without tuning:

1. `healthy-trend-pullback-v1-2026-09-28 / core`
2. `healthy-trend-pullback-v1-2026-09-28 / core_volume`
3. `healthy-trend-pullback-v1-2026-09-28 / core_market`
4. current Early Watch production logic version present when prospective collection is activated, recorded by exact engine/version/commit identity.

The simple trend+RS baseline should also be recorded under the exact implementation commit used in this research package.

No threshold, rank weight, eligibility rule, universe rule, barrier convention, or random-control matching rule may change during the collection window.

## Universe policy

- Use the reviewed Canadian universe policy in force at activation and store its exact source identity, membership hash, code commit and sector map.
- Headline challenger evidence remains non-CDR unless a defensible CAD-compatible benchmark/FX treatment is frozen before activation.
- Any universe refresh during collection creates a new universe version. It must not silently rewrite prior records.
- Each daily record stores the exact symbols attempted, successfully evaluated, failed, and excluded.

## Append-only daily record

Use a dedicated append-only file or durable store, separate from existing `data/history.json`.

Suggested identity:

`modelVersion | universeVersion | marketAsOf | model | symbol`

Each completed-market daily record must preserve:

- collector timestamp in UTC;
- `marketAsOf` / decision session;
- Git commit and model version;
- universe version and membership SHA-256;
- input provider/source identity;
- per-symbol source snapshot identity or immutable content hash;
- model name;
- full surfaced shortlist in rank order, including a genuine empty list;
- natural eligible count;
- zero-pick flag;
- complete / partial / failed coverage status;
- failed symbols and reasons;
- decision-time values needed to audit eligibility/ranking;
- pivot date **and pivot confirmation date**;
- latest completed weekly-bar identity;
- decision-time ATR14;
- benchmark identity;
- no outcome fields until the required horizon matures.

Daily records are immutable after append except for a separate outcome object keyed to the immutable observation identity.

## Failures and zero picks

The collector must explicitly distinguish:

- `complete_zero_pick`: model ran on complete intended coverage and surfaced nothing;
- `complete_nonzero`;
- `partial_coverage`;
- `collector_failure`;
- `market_not_completed`.

Only `complete_zero_pick` is a genuine confirmed absence for episode continuity. Partial/failure records must not reset an active episode.

## Outcome maturation

Outcomes are appended only after they mature under the frozen convention:

- next symbol session adjusted close = entry reference;
- decision-time ATR14 fixed at observation time;
- barrier path begins with the session after entry close;
- +2 ATR favourable / -1 ATR adverse;
- 20 post-entry symbol sessions primary horizon;
- same-day both-hit = `ambiguous_both_hit`, never success;
- suspension/irregular-gap rule unchanged;
- 5/10/20 close-return diagnostics use the same entry reference.

The outcome process may append an outcome object but may never rewrite the original observation/rank/input identity.

## Collection stopping rule

Precommit the first review at the earlier of:

- **160 complete Canadian market sessions collected**, with every primary 20-session horizon matured; or
- **at least 120 matured Core first-surface episodes**, provided at least 80 complete market sessions were collected.

If neither condition is met by **2027-06-30**, review the data-quality/coverage problem only; do not tune the model on incomplete evidence.

Planned administrative review date: **2027-07-30**, after allowing the final required horizons to mature.

## Random controls prospectively

If random controls are collected prospectively:

- use the same frozen random matching rules and fixed seed family;
- store the eligible pool identity before drawing;
- store unmatched picks explicitly;
- never redraw a control because of a later missing or adverse outcome.

## Review discipline

During collection:

- no tuning;
- no deleting bad days;
- no backfilling missing historical observations as if prospective;
- no replacing a failed day with a later reconstruction;
- no opening/using the historical Final period as a substitute for prospective evidence.

At review, report all complete records, zero-pick days, partial/failure days, matured/incomplete outcomes, and contributor concentration before considering any model change.

## Activation gate

This protocol becomes **ACTIVE** only after a dedicated collector is implemented and independently verified to:

1. run the exact frozen model versions;
2. persist exact input identities;
3. preserve empty/failure days;
4. append rather than rewrite observations;
5. mature outcomes only after the horizon completes;
6. pass a synthetic end-to-end test.

Until that gate is satisfied, the prospective collector status is **PROPOSED, NOT ACTIVATED**.
