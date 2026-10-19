# Training window and causal probability calibration

Historical exploratory analysis; all price histories have been inspected.
Fixed before these scores: h10, existing risk event/threshold and four features,
lambda20, minimum252 matured labels,21-bar refits. Compare expanding training
with a fixed504-label (~two native-session years) trailing training window.
Both full and level models receive the same window: a recent level benchmark
must not be handicapped by forcing it to use expanding history only.

Calibration: regularized logit-intercept correction of expanding full AND level
probabilities, using only their past out-of-sample forecasts whose h10 labels
have matured. Minimum252 calibration pairs, last504 pairs,21-origin refit,
penalty20 on intercept. One-dimensional offset, no fitted slope, bins or cutoff
optimization. Match ALL candidate scoring dates to calibration availability.
Store fit parameters and latest training/calibration label end.

Markets: TSX,S&P500,XFN,XEG,XMA,XIT. Two existing normalized vintages, no new
downloads. Native horizons, separate vintage warmups, adjusted ETF caveats apply.
Primary 96-test family:6 markets x2 vintages x2 populations x4 comparisons:
rollingFull vs expandingFull; rollingFull vs rollingLevel;
calibratedFull vs expandingFull; calibratedFull vs calibratedLevel.
Holm;9999 seeded circular block draws, primaryblock20, sensitivities10/40.
All/calm inference uses full native axis; calm outside-selection differences=0.
Report Brier/log loss, fixed bins, calibration-in-the-large, every year and ten
non-overlap offsets. No best-model selection or portfolio use.
Continuation requires positive incremental evidence in both vintages and no
material proper-score/calibration deterioration; a historical improvement still
needs a separately frozen prospective validation.

Prospective disposition: original expanding model remains frozen alongside the
original expanding level comparator. Historical variants are NOT substituted
after seeing these scores. No live collection, scheduler, signal or deployment
is enabled by this experiment. Risk-downside targets require a separate protocol
and are not included in this focused window/calibration test.
