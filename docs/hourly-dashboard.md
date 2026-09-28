# Hourly dashboard observations

Quotes are separate from daily model scores and HTP research evidence. The workflow runs at minute 47 during UTC hours 13–20 on weekdays; Toronto time and fresh TSX regular-session metadata gate collection for daylight saving, holidays and early closes. Scheduler and vendor delays are possible: this is not a real-time feed.

Snapshots are published to `data/intraday-quotes:data/intraday.json`. The frontend reads `/api/intraday` every five minutes while visible, showing capture/quote timestamps, missing coverage and stale quotes. Daily scanner/position calculations remain based on completed candles. The new panel shows intraday prices separately.

Watchlist and position symbols stay in browser storage. Quotes outside the captured universe are shown as unavailable. Seven market instruments and the existing universe are covered. Canadian breadth excludes CDRs and reports the actual fresh-data denominator.

Initial/manual runs can publish an explicitly labelled closed-session snapshot. Scheduled collection runs only during verified open sessions. The old four-hour shadow-history schedule is removed; daily snapshots and the pinned HTP prospective collector are unchanged.

Validation: `npm test` runs scanner and intraday regressions, including DST, weekend/holiday/stale-session gates, early close, quote normalization and endpoint errors.
