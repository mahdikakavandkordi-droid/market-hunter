# Prospective risk-probability validation v1

Freeze at launch on 2026-10-14, first eligible origin2026-10-14 regular close.
S&P500 (^GSPC raw index) and Canadian technology (XIT.TO adjusted ETF proxy).
Target: future ten native daily-return RMS exceeds origin's causal80th percentile
of252 trailing20-bar RMS values. Frozen four-feature full vs one-feature level
logistic,lambda20,expanding training,252 matured labels,refit every21 observations
on the original training cadence. No model/threshold/candidate changes.

Bootstrap input is original2020-through2026-10-13 normalized snapshot, verified
against prior extension manifest. Bootstrap contains ZERO prospective forecasts.
Canonical old inputs stay immutable. New daily returns use adjacent adjusted
closes from ONE as-of provider snapshot; reconstruct new close relative to the
prior canonical close. Thus dividend/split level rescaling cannot create artificial
jumps, and later vendor revisions never rewrite old canonical return observations.
Archive full provider snapshots and changed historical-adjacent-return diagnostics.
Current as-of changes may affect returns relative to historical re-downloads; this
is a declared prospective data convention, not a claim of vendor vintage accuracy.
Unexpected calendar gaps/invalid prices fail; no imputation or silent substitution.

Decision after completed session+30minutes. Issue only latest observed origin,
before origin availability+14hours (next morning, before normal next session).
Never backfill forecasts for missed origins. Catch up missing OBSERVATIONS for
training/outcome maturity, logging missed origins separately. No trading decisions.
Archive recordedAt,origin availability,threshold,probabilities,training fit date,
training maturity,source hashes,raw snapshot hash,forecast hash chain. Outcomes
are separate append-only events, fixed on first maturity under canonical returns.
Duplicate calls do not rewrite forecasts/outcomes; conflicting input/state fails.

Daily integrity and Friday descriptive report; no weekly significance testing or
early winner selection. Primary confirmatory endpoint: BOTH markets each accumulate
504 mature prospective forecasts AND at least30 contiguous positive-label episodes,
or a three-calendar-year cap (2029-10-14). A capped short sample is inconclusive.
These operational minima are not an80%-power guarantee; rare regimes may need longer.
At the single endpoint test four paired comparisons (2 markets x all/calm) with
Holm,9999 seeded circular blocks20, sensitivity10/40. Retain native-axis gaps and
do NOT compress skipped origins or calm selections for bootstrap inference.
Show Brier/log loss,calibration bins,years,all10 native non-overlap offsets,
confidence intervals,missingness and regime coverage. Success requires incremental
proper-score improvement with acceptable calibration and block sensitivity;
aggregate volatility-state skill cannot be renamed onset/crash-warning skill.

Schedules are assistant-run collection, not a guaranteed uptime service. Each
iteration must persist the checkpoint before claiming a forecast was recorded.
Checkpoint writes use a Library version guard; on conflict reread and recompute.
Hash chaining detects edits; Library version history preserves prior checkpoints.
This is NOT WORM storage or third-party cryptographic notarization. Honest execution
timestamps, retained snapshots and published model hashes are the evidence boundary.
No main/production/SMC/Telegram/portfolio changes, PR merge or model deployment.
