# SMC Forward Evidence Timing Conventions

This document describes evidence collection only. It does not change the frozen Weekly/Daily/4H SMC strategy rules.

## Exchange-session instruments

Hourly Yahoo bars are interpreted on the America/Toronto regular-session grid beginning 09:30. The first 4H research bar uses hourly slots 09:30, 10:30, 11:30 and 12:30. The second session bar uses 13:30, 14:30 and 15:30.

A group is emitted only when all expected source slots for that segment exist. Missing hourly sources therefore create an explicit data-quality diagnostic instead of a synthetic candle.

The completion timestamp is conservatively recorded as the final hourly source timestamp plus one hour. This deliberately avoids claiming an exact 16:00 or shortened-session close when the source payload does not provide per-bar duration. On an early-close session, the first research segment can contain the complete available session even though the final Yahoo hourly source may represent less than a full hour; that segment is retained with the conservative final-source-start + 1h completion timestamp. The absent session tail is reported as ambiguous between a shortened session and missing tail data, and no second segment is synthesized.

Current-day bars are not emitted until this conservative completion timestamp has passed. Date/session assignment uses America/Toronto via Intl, so DST is handled by the timezone database rather than a fixed UTC offset.

## 24/7 crypto

4H bars are aligned to UTC at 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00. All four hourly source bars are required. Three-hour or otherwise incomplete buckets are dropped and reported.

## Bias and signal timing

Daily bias uses dates strictly before the 4H signal date. Weekly bias uses weeks strictly before the signal week. The current day/week is therefore excluded from the higher-timeframe bias.

A CHoCH signal is actionable only from a completed 4H bar. Entry remains the next completed research bar's opening price. If that next bar does not yet exist, the evidence system may record a pending signal but must not fabricate an entry.

The 16-bar holding rule is unchanged: the entry bar is bar 1 and the final forced-close bar is bar 16 after the signal bar.

## Exit timing and collisions

Stop/target detection continues to use the bar's high/low. If both stop and target are touched in the same bar, stop wins. This is the existing conservative collision convention.

New exit evidence uses the exit bar completion timestamp, not its opening timestamp. This prevents capital from being released before the bar outcome is knowable.

If a bar opens through a stop or target, the open is treated as temporally prior to the rest of that candle. A gap through the stop therefore resolves as the stop outcome, and a gap through the target resolves as the target outcome before later high/low contacts are considered. The frozen strategy-level boundary R result is retained while the report flags that the true gap fill is unknown. For non-gap bars where both stop and target are touched and intrabar order is unavailable, the conservative stop-first rule remains in force.

Legacy closed records whose exit timestamp predates this convention remain immutable. Corrected portfolio accounting treats an unlabelled legacy exit timestamp conservatively as unavailable until four hours after that timestamp and qualifies the legacy evidence instead of rewriting it.


## Marked account equity

The original realized-equity series is retained and labelled separately. Open positions are additionally valued from the latest completed 4H close available at the observation time.

For each open position the evidence records the mark price, mark timestamp, mark source/status and directional unrealized P/L. A mark from before the position entry, a future-dated mark, or a missing mark is not used to manufacture an account value. In those cases the position is flagged and total marked equity is null rather than substituting the entry price.

Marked open-position value is the reserved entry notional plus directional unrealized P/L. Total marked equity is cash plus those marked position values, so reserved capital is not counted twice. Long and short positions use the same reserved-capital accounting while unrealized P/L changes sign with direction.

The configured cost assumption is charged once when a position settles. Open marked equity does not subtract a hypothetical future closing cost, so the same cost is not charged twice.

The marked-equity series begins only when these observations are actually recorded. The report distinguishes the first observation from the first complete marked-equity observation and does not claim historical intraday marked drawdown coverage before that point. Stale marks may still produce a marked value, but the quality is explicitly labelled stale.
