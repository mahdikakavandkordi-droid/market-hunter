# SMC Forward Evidence — Final Correctness Audit (2026-10-04)

## Scope

This audit finalizes correctness work for the existing Weekly / Daily / 4H SMC forward-paper experiment on branch `research/smc-wd4h-tsx-validation-20261001`.

The strategy itself remains frozen. No scanner threshold, CHoCH trigger, Weekly/Daily/4H structure parameter, entry rule, stop rule, target rule, max-hold rule, universe, risk sizing rule, cost assumption, or Momentum Shadow decision rule was optimized or redesigned. Momentum remains observational only.

No historical decision backfill was performed. Existing closed decisions remain immutable. Legacy records without trustworthy first-observation provenance remain explicitly unprovenanced.

## Residual correctness issues verified and fixed

### 1. Open-trade lifecycle could depend on revised market data fields

Previously, an already-recorded open trade could fail to close if later Yahoo data changed a core recomputed field such as entry or stop. Reconciliation correctly refused to overwrite the immutable recorded decision, but that could also leave the lifecycle stuck open.

The forward runners now replay an already-recorded open trade from its own immutable recorded entry, stop, target, direction and entry timestamp. Pending recorded signals are resumed from the recorded signal snapshot rather than re-validating the original decision from revised source data.

This preserves decision immutability while allowing lifecycle updates to continue.

### 2. Missing candles could shift the next-bar entry or 16-bar lifecycle

The evidence layer now builds an explicit gap map over completed research bars.

For 24/7 crypto, non-contiguous 4H bars are treated as unresolved missing-candle gaps.

For exchange-session instruments, missing first/second session segments and missing known trading dates are treated as unresolved evidence gaps. A historical session with an absent tail that could represent either a shortened session or missing intraday data is treated conservatively as unresolved rather than assuming a hypothetical bar.

A gap before the intended next-bar entry leaves the signal pending. A gap inside an already-open trade stops lifecycle inference before later bars. The system does not manufacture an entry, exit or 16-bar timeout across unresolved missing evidence.

### 3. Prospective / reconstructed / legacy performance was mixed

Reports now calculate performance separately for:

- prospective evidence;
- reconstructed evidence;
- legacy unprovenanced evidence.

The existing overall summary is retained for continuity, but provenance-specific statistics are now emitted alongside it so forward performance is not silently mixed with reconstructed or legacy observations.

Stale `entryObservationClass: pending` metadata is also repaired from the immutable first-observation timestamp and recorded entry timestamp once an entry exists.

## Files changed

- `lib/smc-forward-runtime.mjs`
- `lib/smc-forward-evidence.mjs`
- `scripts/smc-forward-paper.mjs`
- `scripts/smc-forward-expanded.mjs`
- `scripts/smc-forward-alternatives.mjs`
- `scripts/test-smc-forward-ledger.mjs`
- `scripts/test-smc-forward-timing.mjs`
- `.github/workflows/smc-forward-paper.yml`

## Verification

Research-branch CI:

- SMC Forward Paper Track — run `37214796850` — **success**
  - forward ledger integrity — success
  - forward candle timing — success
  - marked portfolio accounting — success
  - expanded / alternatives syntax checks — success
  - Momentum Shadow tests — success
  - frozen forward paper tracker — success
  - artifact upload — success

Repository regression CI:

- Check scanner — run `37214796864` — **success**
  - syntax checks — success
  - full `npm test` — success

The research workflow was also widened so future edits to the shared SMC evidence/runtime/test files trigger these SMC correctness regressions automatically.

## Current disposition

The correctness audit is complete enough to resume prospective evidence collection.

Do not optimize the frozen strategy from this audit. Let the forward ledgers accumulate. Preserve zero-result sessions, unresolved gaps, failures, and provenance distinctions. Any later performance assessment should treat prospective evidence as the primary out-of-sample sample and keep reconstructed / legacy evidence separate.
