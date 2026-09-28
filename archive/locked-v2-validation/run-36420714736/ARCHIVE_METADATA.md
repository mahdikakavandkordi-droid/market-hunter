# Locked Market Hunter V2 validation archive

This directory is the durable archive for the successful locked validation execution.

- Source branch: `research/early-watch-validation-close-20260928`
- Validation run ID: `36420714736`
- Validation run code SHA: `4ff7b858df9e702f0b69485b245bb92ee2db6779`
- Post-run cleanup branch head at archive creation: `a54db3d853d63fd7d25ad8c80ad2028abf1fb70b`
- Immutable Vercel deployment artifact: `dpl_5yFyrve6byxA6McmfE5pvsokga4Y`
- Historical Final: SEALED; validation run used `V2_OPEN_FINAL_TEST=0`.

## Original GitHub Actions artifact identities

| Artifact | ID | GitHub artifact digest |
| --- | ---: | --- |
| locked-v2-validation-evidence | 10968829771 | sha256:b4eff4b242fb54344cafc548143c00be8b3fa157c3a0615961c6ba0372637b52 |
| market-hunter-v2-numerical-snapshot | 10969421683 | sha256:5c885e5d642df2fdf6c3ec6e1222a003387dd9f45cdba5f2c3d4a11b54243c67 |
| locked-v2-backtest-batch-0 | 10969074401 | sha256:9aeb1a9495203414114ff84806b2d648f70ca733266876c13c0877d15554f04c |
| locked-v2-backtest-batch-1 | 10969591646 | sha256:dd0bf0023e0911cac67fe5a579a34af1f856a7cc956d4e488bb22e6d1b89b516 |
| locked-v2-backtest-batch-2 | 10969516858 | sha256:f97a7244c523d86be45d77eec387aaf6d5c3a565fab705058e6281e9e9fc018d |
| locked-v2-backtest-batch-3 | 10969186919 | sha256:330cd828bd185cfe6f92d740ab59244d34bb7668501f6396308243a507d7dbb7 |

## Reproduction

The archived raw reports are under `raw-reports/`. Copy the four `v2-backtest-batch-*.json`
files into a working checkout as `data/v2-backtest-batch-0.json` through
`data/v2-backtest-batch-3.json`, copy the archived exact manifest to
`data/frozen/market-hunter-v2-numerical-snapshot/manifest.json`, then run:

```bash
V2_DATASET_LOCK_MANIFEST=data/frozen/market-hunter-v2-numerical-snapshot/manifest.json \
  node scripts/analyze-early-watch-surface-replay.mjs
```

The command must not open Historical Final. Do not set `V2_OPEN_FINAL_TEST=1`.

## Integrity verification

From repository root:

```bash
sha256sum -c archive/locked-v2-validation/run-36420714736/SHA256SUMS
```
