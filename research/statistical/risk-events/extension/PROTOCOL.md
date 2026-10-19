# Fixed feature ablations and Canadian sector replication

Recorded before new sector downloads or ablation scores. Historical exploratory
research, not blind validation: broad-market histories have already been inspected.

Primary horizon: 10 native daily bars. Existing causal event threshold, training
purge, lambda=20, expanding training, and 21-bar refits remain frozen.
Candidates: full [0,1,2,3], acceleration [0,1], shock [0,2], downside [0,3].
Benchmark: calibrated level [0]. No tuning, best-candidate promotion, or portfolio test.
Markets: existing TSX and S&P 500 snapshots, plus Yahoo adjusted ETF closes for
XFN.TO financials, XEG.TO energy, XMA.TO materials, XIT.TO technology.
Sector data requested from 2005-01-01 through 2026-10-13, split into pre2020
and post2020 vintages BEFORE feature construction, matching earlier warmup rules.
XMA inception is December 2005; no synthetic pre-inception observations.
Canadian calendar is explicitly applied to every .TO ETF, with strict gap checks.
Save provider bytes, normalized inputs, metadata, source hashes, fits and prediction ledgers.

Report all and calm-origin Brier/log loss, yearly results, all ten non-overlap
offsets, probability calibration, and block lengths 10/20/40 (999 seeded draws).
Family: 6 markets x 2 vintages x 2 populations x 4 candidates = 96 paired Brier
tests versus level, Holm corrected. Secondary comparison of each ablation with
full: 72 tests, separately corrected and exploratory. No significance selection
across these two families. All/calm losses keep the full native time axis.
Acceptance for further research: positive skill in BOTH vintages, positive
corrected evidence in BOTH, no single-year dependence, and useful calibration.
Even success requires a new frozen prospective validation before operational use.

Yahoo adjusted history is retrieved today, not a point-in-time adjustment archive.
ETF fees, tracking error, dividend adjustments and historical revisions limit
interpretation. Results concern event probabilities, not investment performance.

Numerical amendment after initial scores: 999 bootstrap draws have minimum p=.001,
so with 96 tests even the smallest Holm p is .096. Increase ALL comparisons and
block sensitivities uniformly to 9999 draws (minimum p=.0001); retain the original
999-draw bundle separately. No model, features, dates, family or acceptance rule
changes. This amendment concerns inference resolution and is explicitly post-score.
