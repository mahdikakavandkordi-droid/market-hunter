# Market data refresh schedule

Market Hunter separates completed-session research from live display quotes. The schedules below refresh **presentation/report data only** for the relevant asset calendar; they do not rerun the stock scanner, historical backtests, or mutate canonical prospective decisions.

## Equity package

The existing `Research Daily Refresh` runs at **16:30 America/Toronto** on exchange weekdays. GitHub cron uses both 20:30 and 21:30 UTC with a Toronto-time gate so DST is handled by the IANA timezone rather than a fixed offset.

- America/Toronto: 16:30 ET
- America/St_Johns: 18:00 local time
- UTC: 20:30 during EDT, 21:30 during EST

Exchange session metadata controls whether the current daily bar is complete, including early closes. On weekends/holidays the latest completed equity session remains valid.

## Crypto completed daily bars

Yahoo crypto daily bars use the UTC day boundary. Lightweight retries run every day at **00:15 UTC** and **01:15 UTC**. Only BTC/ETH Market Pulse rows and presentation reports are rebuilt.

- Toronto during EDT: 20:15 / 21:15 previous calendar day
- Toronto during EST: 19:15 / 20:15 previous calendar day
- St. John's during NDT: 21:45 / 22:45 previous calendar day
- St. John's during NST: 20:45 / 21:45 previous calendar day

Crypto continues seven days per week.

## Metals completed daily bars

The current Yahoo/COMEX metadata exposes a daily regular-session boundary near **03:59 UTC**. Lightweight retries run **04:15 UTC** and **05:15 UTC Tuesday-Saturday**, covering the preceding Monday-Friday metals sessions and allowing one delayed-provider retry.

- Toronto during EDT: 00:15 / 01:15
- Toronto during EST: 23:15 previous day / 00:15
- St. John's during NDT: 01:45 / 02:45
- St. John's during NST: 00:45 / 01:45

The code uses provider session start/end metadata to classify completion; it does not assume the equity close applies to metals.

## Failure policy

Partial/live bars are excluded. A targeted provider failure keeps the last valid completed report and marks the affected asset with `freshness.status = provider_failure`. An older provider response cannot replace a newer stored session. Mixed per-instrument dates remain explicit in the daily report.
