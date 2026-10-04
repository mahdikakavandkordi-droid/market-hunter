# SMC Forward Evidence Timing Conventions

This document describes evidence collection only. It does not change the frozen Weekly/Daily/4H SMC strategy rules.

## Exchange-session instruments

Hourly Yahoo bars are interpreted on the America/Toronto regular-session grid beginning 09:30. The first 4H research bar uses hourly slots 09:30, 10:30, 11:30 and 12:30. The second session bar uses 13:30, 14:30 and 15:30.

A group is emitted only when all expected source slots for that segment exist. Missing hourly sources therefore create an explicit data-quality diagnostic instead of a synthetic candle.

The completion timestamp is conservatively recorded as the final hourly source timestamp plus one hour. This deliberately avoids claiming an exact 16:00 or shortened-session close when the source payload does not provide per-bar duration. On an early-close session, a fully observed first segment can still exist; an absent session tail is reported as ambiguous between a shortened session and missing tail data.

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

If a bar opens through a stop or target, the frozen strategy-level R result is retained but the report flags that the true gap fill is unknown. The audit does not silently invent a better execution price.

Legacy closed records whose exit timestamp predates this convention remain immutable. Corrected portfolio accounting treats an unlabelled legacy exit timestamp conservatively as unavailable until four hours after that timestamp and qualifies the legacy evidence instead of rewriting it.
