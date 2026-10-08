# Four-symbol single-hourly pilot checkpoint

This pilot was completed before the user narrowed the active research goal to gold only. It is retained as a checkpoint, not an active training or deployment branch.

Fixed instruments were AAPL, RY.TO, BTC-USD and ETH-USD, using the already captured hourly sources through March 2026. Daily and four-hour bars derive from the same hourly authority. The existing 250-day warmup and V2 split definitions were unchanged.

Ten deterministic tests and 16 real-data prefix checks passed. Source verification traced the incomplete sessions to null raw quotes: 5 scheduled hours for AAPL, 6 for RY.TO and 156 each for BTC and ETH. The stock examples include last hours of shortened sessions; no valid source quote was incorrectly dropped.

Under these conservative warmup and reset requirements the pilot yielded zero feature rows for either stock and 138 per crypto instrument (69 per direction). Even the optimistic perfect-source ceiling cannot supply the previously required 12-month fitting span. No labels, parameter search, model fitting or final-test outcomes were opened for this pilot. Its existing immutable source and contract checks remain unchanged.

Files: `data/research/wave-ml-v1/single-hourly-pilot-v1/{contract,report,source-checks}.json`, `lib/wave-ml/single-hourly.mjs` and the matching build, source-verification and test scripts.

The new `gold-v1` experiment is a separately frozen research question with a longer independent history. It does not silently relax the old pilot's gates or modify the previous engines.
