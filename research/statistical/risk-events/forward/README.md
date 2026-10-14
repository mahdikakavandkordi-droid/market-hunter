# Frozen prospective validation

Read PROTOCOL.md before execution. This experiment records risk probabilities,
not transactions/signals. No changes to main or production are required.

One-time initialization (already completed privately on2026-10-14):

```
node research/statistical/risk-events/forward/run.mjs --seed-bundle ORIGINAL_VERIFIED_EXTENSION --output-dir NEW_INITIAL_DIRECTORY --archive NEW_INITIAL.zip
```

Continuation from the latest private checkpoint, NEVER reinitialize:

```
node research/statistical/risk-events/forward/test.mjs
node research/statistical/risk-events/forward/run.mjs --input-bundle UNPACKED_LATEST_CHECKPOINT --output-dir NEW_DIRECTORY --archive NEW_CHECKPOINT.zip
```

Use frozen source snapshots or the pinned activation commit, not a later branch
head. Source changes are rejected by the genesis hash. Fetches use Yahoo chart
data; incomplete sessions and unexplained calendar gaps are rejected. Both markets
have independent status; a provider failure is recorded without inventing a row.
The first bootstrap/live connection check had zero forecasts:2026-10-14 was still
incomplete. Training-only history ends2026-10-13; no historical prospective backfill.

An assistant automation continues collection on weekday evenings and reports
descriptive counts on Fridays. Access and persistence must succeed on each run;
missed decision windows remain missing. This is assistant-run research collection,
not guaranteed service uptime. Persistent checkpoint replacements must use the
observed Library version guard and preserve the same file identity. Keep immutable
launch archive separately. If a conflict occurs, discard the stale computed update,
reload the latest checkpoint and recompute. Do not replace a newer checkpoint.

Evidence includes source hashes, provider snapshots, immutable canonical input
events, hashes of forecasts/outcomes, time-of-decision, and training-label maturity.
Hash-chain plus version history is tamper-evident, not WORM or independent notarization.
Until the single declared endpoint, scores are descriptive, not confirmatory tests.
Do not change parameters based on weekly reports or mix this with macro/SMC outputs.
