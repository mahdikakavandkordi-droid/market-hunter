# Healthy-Trend Pullback Prospective Collection Protocol v1

**Status:** IMPLEMENTED + VERIFIED — **NOT ACTIVATED** pending external review and default-branch activation.  
**Protocol frozen:** 2026-09-28.  
**Historical backfill:** prohibited.  
**Prospective observations currently recorded:** none at the time of this protocol update.

## 1. What was implemented

A dedicated collector now exists separately from the production scanner:

- `lib/healthy-trend-pullback-forward.js`
- `scripts/collect-healthy-trend-pullback-forward.mjs`
- `scripts/audit-healthy-trend-pullback-forward.mjs`
- `scripts/test-healthy-trend-pullback-forward.mjs`
- `.github/workflows/healthy-trend-pullback-forward.yml`

The existing `.github/workflows/daily-snapshot.yml` / `scripts/update-history.mjs` path remains untouched and is **not** treated as challenger evidence.

The forward workflow is present on the research branch for verification. GitHub scheduled workflows execute from the repository default branch, so the scheduled collector is **not active while this package remains only on the research branch**. Activation requires explicit post-review promotion of the collector workflow/code to the default branch (or an explicitly approved manual dispatch). No earlier market session may be backfilled after activation.

Verification evidence:

- workflow run: `36472921643`
- verified code SHA: `0e71068e82e1d5fb1f93383896c81d4d25499bfd`
- verification artifact ID: `10991588715`
- artifact SHA-256: `11a603e3444ed9cb07b08ef032a66ad459c7366bf5f8de6260cb87a702269985`

The verification run passed the frozen-model regression suite, forward-collector regression suite, and append-only store audit.

## 2. Frozen prospective models

The prospective v1 comparison contains only three deterministic models:

1. **Lead challenger — Core**
   - model: `core`
   - model version: `healthy-trend-pullback-v1-2026-09-28`

2. **Simple baseline — Trend + RS**
   - model: `trend_rs`
   - implementation version: `healthy-trend-pullback-v1-2026-09-28`

3. **Current Early Watch reference**
   - model: `early_watch`
   - engine version: `market-hunter-v2-rebuild-h2p10-2026-09-26`
   - uses the frozen V2 Early Watch classification/ranking/surface functions directly from `lib/market-hunter-v2-engine.js`.

The predeclared historical variants **Core + volume** and **Core + market** are not collected prospectively in v1. Task 4 did not justify carrying either one forward. Reintroducing either variant would require a new separately versioned protocol; it cannot be added silently during this collection window.

## 3. Universe and source identity

Headline evidence uses the reviewed non-CDR Canadian universe.

Each collection date stores:

- the full universe definition;
- `UNIVERSE_SOURCE`;
- a SHA-256 universe-version hash;
- intended and successfully evaluated symbol counts;
- failed symbols and explicit failure reasons;
- benchmark source identity;
- per-symbol normalized source hashes;
- exact Git commit and collector version.

Any universe change creates a new universe hash. Prior observations are immutable and are not rewritten.

## 4. Live input normalization

The collector uses Yahoo Finance chart data through `query1` with `query2` fallback.

For research consistency:

- adjusted close is the price scale;
- adjusted high/low are reconstructed using `adjustedClose / rawClose`;
- raw close × raw volume is retained for liquidity;
- split-event dates are preserved;
- current/incomplete trading sessions are excluded;
- the TSX benchmark is `^GSPTSE`.

The collector can create a prospective observation **only when the benchmark's latest completed `marketAsOf` equals the current UTC date**. Therefore a later run cannot backfill an older market date and label it prospective.

A holiday, pre-close dispatch, or stale benchmark produces an explicit `market_not_completed` run state instead of a historical observation.

## 5. Append-only evidence layout

The dedicated store is:

`data/research/healthy-trend-pullback-forward/`

Semantic append-only files:

- `inputs.jsonl` — immutable capture attempts, each journaling its full manifest and all three model results;
- `observations.jsonl` — the first complete attempt per date, published as three immutable canonical model observations;
- `snapshots/<sha256>.json.gz` — content-addressed normalized OHLCV histories, raw price fields, corporate-action events and vendor metadata for every fetched symbol and benchmark;
- `outcomes.jsonl` — separately appended matured outcomes;
- `runs.jsonl` — invocation status, including failures/no-new-session cases;
- `status.json` — derived progress only;
- `audit.json` — derived independent integrity audit.

Existing observation identities cannot be changed. A rerun that attempts to reuse an existing identity with different contents is rejected as an `append_only_conflict`.

Daily observation identity:

`modelVersion | marketAsOf | model`

Pick identity:

`modelVersion | marketAsOf | model | symbol`

## 6. Complete, zero-pick, partial and failure states

The collector explicitly preserves:

- `complete_zero_pick`
- `complete_nonzero`
- `partial_coverage`
- `collector_failure`
- `market_not_completed`
- `no_new_completed_market_session` at the run level.

Only `complete_zero_pick` is a confirmed absence for future first-surface episode continuity.

A partial/failure day must not reset an active episode. Partial model results remain in the input-attempt journal and are not eligible for primary outcomes. A retry may append a complete capture only within the same UTC decision date. The first complete attempt wins permanently; later captures cannot replace its picks. A crash after journaling can reconstruct those exact observations without refetching the decision inputs.

No model is force-filled. Each model may surface from zero to six names.

## 7. Decision timestamp and model inputs

A decision belongs to the completed market session D.

Core remains frozen exactly as predeclared:

- completed weekly trend only;
- 4%–12% controlled pullback from prior 20-session closing high;
- close >= MA50;
- MA20 > MA50;
- confirmed 2-left / 2-right pivot-high reclaim;
- 20-session relative strength versus TSX >= 0;
- same fixed 0–100 rank formula;
- maximum six surfaced names; never quota-filled.

Trend + RS remains the fixed simple baseline.

Early Watch uses the frozen V2 engine surface directly and remains unchanged.

Every surfaced pick stores its decision-time ATR14 and audit fields needed to reproduce eligibility/ranking.

## 8. Outcome maturation

No outcome is written at observation time.

For each recorded pick, an outcome may be appended only after the required future path exists:

- next symbol session adjusted close = entry reference;
- decision-time ATR14 is immutable;
- D+1 high/low are not used for barrier ordering;
- inspect D+2 through D+21;
- favourable barrier = entry + 2 × decision ATR14;
- adverse barrier = entry − 1 × decision ATR14;
- first hit determines `success` or `adverse_first`;
- same-bar both-hit = `ambiguous_both_hit`, never success;
- >7 calendar-day path gap = `suspension_or_irregular_gap`;
- 5/10/20 adjusted-close returns and TSX excess are retained.

### Corporate actions after the decision

Because the live vendor can revise historical adjusted scales after a later split, a split occurring between decision and the end of the required outcome window is labelled:

`corporate_action_during_horizon`

That observation is conservatively excluded from the primary barrier denominator rather than mixing an old decision-time ATR scale with a subsequently restated price scale.

This rule is frozen before prospective activation.

## 9. Prospective random controls

Prospective v1 does **not** collect new random-control draws.

Reason: Task 4 identified the deterministic decision as Core versus Early Watch and Trend + RS. Historical repeated-random and sector/volatility-matched random experiments remain supporting diagnostics, not the prospective headline comparison.

Adding live random controls later would constitute a new protocol version and cannot be retroactively attached to v1 observations.

## 10. Collection schedule

The prepared workflow schedule is:

- Monday–Friday
- 22:45 UTC
- after the regular Canadian market close year-round.

The schedule is intentionally not considered active until the reviewed workflow exists on the repository default branch.

The first same-day completed market session collected after approved activation defines the start of prospective evidence. There is no historical backfill.

## 11. Stopping rule

The first formal review occurs at the earlier of:

- **160 complete Canadian market sessions**, with all required primary 20-session horizons matured; or
- **120 matured Core first-surface episodes**, provided at least 80 complete market sessions have been collected.

If neither condition is met by **2027-06-30**, review only the data-quality/coverage problem. Do not tune the model on incomplete evidence.

Administrative review date: **2027-07-30**, allowing the final required horizons to mature.

## 12. Review discipline

During collection:

- no threshold tuning;
- no rank-weight changes;
- no adding/removing gates;
- no deletion of bad days;
- no deletion or rewriting of partial/failure attempts; same-day completion is appended under the v2 attempt policy;
- no historical backfill;
- no retrospective relabelling;
- no use of Historical Final as a substitute for prospective evidence;
- no production replacement based on interim results.

At review, report:

- complete sessions;
- zero-pick days;
- partial/failure days;
- natural output volume;
- first-surface episode counts;
- matured/incomplete outcomes;
- primary barrier labels;
- 5/10/20 returns and excess;
- concentration by symbol, year/time and sector;
- Core versus the two frozen deterministic baselines.

## 13. Activation gate

The implementation gate has been technically satisfied in the research branch:

1. exact frozen model versions are referenced;
2. exact input identities are persisted;
3. empty/failure states are explicit;
4. observations are append-only and outcomes are separate;
5. outcomes mature only after the frozen horizon;
6. synthetic and repository regression tests pass;
7. an independent forward-store auditor passes on the empty pre-activation store.

However, **collection remains NOT ACTIVATED** until external review is complete and the scheduling mechanism is deliberately enabled from the default branch.

That distinction is intentional: implementation verification is not the same thing as prospective evidence.


## Collector v2 integrity amendment (2026-09-28)

The model version and all selection rules remain unchanged. Collector/storage version is now `healthy-trend-pullback-forward-v2-2026-09-28`. This amendment applies before activation; v1 populated stores fail closed and require an explicit migration plan, not silent reinterpretation.

Each pick freezes its adjusted/raw decision close, original ATR and the 15 rows covering the 14 true ranges. At maturity the original ATR is multiplied by the ratio of maturity-snapshot to decision-snapshot adjustment factors on the decision date. Barriers use that rebased ATR; the original remains in the observation. All lookback rows must be consistent with the same rescaling and unchanged raw prices. Missing anchors, raw-price revisions and nonuniform history revisions receive explicit excluded outcomes. Horizon splits retain the existing exclusion.

Every outcome references the full snapshot actually used for maturity. The offline audit checks snapshot hashes, replays all attempted model selections, verifies first-complete canonical observations and recalculates matured outcomes without contacting Yahoo. Replay uses the frozen engine; it verifies persistence and reproducibility, not the economic validity of the strategy. Snapshots are committed alongside the journals and are not dependent on expiring workflow artifacts.

An already complete date no longer prevents outcome processing on rerun. Workflow run attempts have distinct identities. Journal and derived-file publication use atomic rename; workflow concurrency serializes writers. Manual local writers must also run serially against a given store.
