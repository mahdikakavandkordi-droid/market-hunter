# Selection-quality evidence

The existing Market Hunter monitor now includes a read-only `quality` projection. It compares the final integrated shortlist and each stage separately at 5, 10 and 20 benchmark sessions. This is selection tracking, not strategy-engine or portfolio performance.

Each horizon reports paired stock and TSX returns over the same dates. Excess return is their arithmetic difference in percentage points. Means and medians use paired finite numeric observations only. Missing values are not zero. The symbol-balanced mean first averages repeated observations within a symbol, then averages symbols equally. This reduces repeated-symbol weighting but does not make observations independent. Decision-date counts expose calendar concentration. Stage groups may share symbols and must not be added together.

Only recorded outcomes whose target dates are at or before the monitor's canonical session are included. `recorded` and `excludedMissing` describe available outcome records; they do not measure missing outcomes that were never recorded. No sample-size gate, confidence claim, winner label, score, or filter optimization is inferred. Return conventions remain those of the canonical collector; no execution costs or simulated entries have been added.

The source remains the append-only prospective ledger. No historical picks are reconstructed and no outcome or decision is modified. New fields appear when the normal collector next regenerates monitor.json. Older monitor payloads remain compatible and simply omit the quality disclosure. The disclosure stays collapsed on mobile and tables scroll within the panel.

## Current development decision

Do not promote a new selection filter on the basis of this short forward sample. Existing stage ranking already penalizes extension above MA20 and high ATR; an additional similar filter could duplicate those effects. The next filter experiment must specify one hypothesis and rule before collecting its evaluation window, preserve the baseline, and compare retained and excluded selections over identical horizons. Prospective results, symbol concentration, overlapping dates and omitted outcomes must be reviewed together.

Fundamental context remains supplementary, without numerical scores or an exclusion rule. Four reconciled issuer mappings do not cover the current Canadian universe. Broader coverage requires verified issuer mappings, sector-appropriate statement measures and an accessible authorized source. Public coverage must be calculated against the current shortlist, not a historical sample. Failed source checks retain previously verified snapshots with their original dates. More measurements or template text do not establish fundamental coverage.

## Verification

`node scripts/test-hunter-quality.mjs` checks scope and horizon separation, future isolation, repeated-symbol weighting, null handling, duplicate rejection and input immutability. It runs through the required Hunter monitor regression suite. `tests/hunter-monitor.spec.mjs` exercises the disclosure and horizontal containment at 390px and is included in `npm run test:browser`.
