# Market Hunter V2 — Deterministic Dataset Lock

This directory defines the fixed raw-data basis for validation experiments created on 2026-09-27.

The repository stores a compact lock manifest instead of roughly 41 MB of duplicated normalized Yahoo rows.

A locked backtest must:
1. query the exact UTC source window in `manifest.json`;
2. normalize data using the V2 backtest loader;
3. calculate the batch's canonical SHA-256 fingerprint;
4. abort if it differs from the expected `dataSha256`.

This prevents silent data drift between experiments. If Yahoo retroactively changes adjusted history, split handling, or any normalized row, the run fails instead of silently producing a different comparison.

Use `scripts/run-locked-v2-backtest.mjs` with the desired `V2_BATCH_INDEX`.
