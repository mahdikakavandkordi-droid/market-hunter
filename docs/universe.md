# Universe and data quality

The reviewed 2026-09-21 snapshot in `lib/universe.js` contains 236 unique instruments:
216 CAD equity holdings from BlackRock's XIC holdings file, plus 11 Canadian
supplements and nine selected CAD CDRs. This is a broad discovery sample, not an
exhaustive exchange listing or a point-in-time backtest universe.

Source URL and date are exported with every scan. Cash, derivatives, non-CAD
holdings and the nonstandard holding identifier `2299955D` are excluded.
BlackRock share-class punctuation is converted to Yahoo notation (`TECK.B` to
`TECK-B.TO`, `CAR.UN` to `CAR-UN.TO`). Topicus and Lumine use `.V`.
Core sector classifications follow the source; Information Technology maps to
Technology, and the two consumer sectors remain combined. This also corrects
several previous manual sector assignments (including Hammond Power Solutions).

Seven legacy symbols absent from this source and returning Yahoo 404 during
review were retired: MEG, CPG, CIX, NGD, SSL, TIXT and PKI (all `.TO`). This is
an operational exclusion of unavailable symbols, not a mechanism for finding
successor securities. ARX remains listed but fails the stale-data gate.

## Refresh procedure

Download the official source linked in `UNIVERSE_SOURCE`, check its holdings
date, select CAD equities on Toronto Stock Exchange, normalize tickers and
review additions/removals against the existing snapshot. Keep the reviewed
supplements and CDRs separate from source-driven membership decisions. Verify
Yahoo currency, history and symbol mapping; update the source date, count and
review notes in the same commit. Run `npm test` and a live scan before release.
Review monthly and when repeated 404s or corporate actions appear. No external
constituent list is downloaded on the live request path.

## Missing data

All instruments, including CDRs, must pass the CAD, freshness, history,
61-reference-session and positive-volume checks. An incomplete response gets a
bounded retry using Yahoo query2 and a one-year request, trimmed to the common
six-month reference start. This is the same provider, not independent verification.
Only a complete valid replacement is used; series are never merged, interpolated
or forward-filled. Unresolved data remain excluded from scores and breadth, and
are reported in `failureDetails` and the scan-status tooltip. Failed fetches
except 404s may also retry. The total scan budget remains 24 seconds, with the
last six seconds reserved for recovery. Diagnostics report recovery attempts,
recoveries and elapsed time. Partial responses have short cache lifetimes.

The minimum-price and C$2M/5M/10M/25M thresholds, ranking/stage rules, nine CDRs,
and default five displayed results per stage are unchanged. Breadth remains a
fixed C$2M Canadian sample; expanding membership can change breadth and sector
results even without price changes. Version `hunter-1.2` prevents comparisons
with history from the previous universe version. Historical membership must be
archived separately before any future backtest.

## Shortlists and early observation

The default is now three results per list, selectable to five. Each list has an
independent Show all / Show top toggle. Existing technical scores order charts
for review, not expected returns; weights have not been optimized or validated
as predictive probabilities.

`watchItems` is a supplemental Early Watch list, not a fourth stage. It contains
only otherwise unclassified, validated, liquid instruments with negative 20D
returns, positive 5D returns, the existing momentum-improvement flag, and either
price at/above MA20 or the existing fading-selling-volume flag. It shares the
existing technical ordering and never duplicates the three classified lists.
It does not assert a bottom or confirmed reversal. Stocks merely falling more
slowly still fail the positive-5D requirement. No indicator or ranking weight
was added. Existing stage/history semantics are unchanged.
