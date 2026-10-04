# Paper Engines in Market Hunter

Adds a read-only research view with three independent engines and five separate market accounts. Navigation, mobile swipe cards, open/closed positions, evidence freshness, incomplete instrument coverage, and source links use the existing engine reports. Scanner classifications, strategy rules, ledgers, workflows and real portfolio state are untouched.

Sources are allowlisted in `lib/engine-dashboard.js`: SMC corrected evidence-v2 reports on its original research branch; Trend Breakout and Mean Reversion forward-shadow reports on their own branches. The GET-only `/api/engines` endpoint fetches all fifteen reports concurrently, with eight-second source timeouts and one-minute edge caching. A failed source is displayed as unavailable. There is no historical fallback or zero substitution.

Full-period account results keep their original start dates. A separate common-window table uses the Mean Reversion report's existing comparison accounts for SMC and Trend and its own account for Mean Reversion. This excludes earlier baseline positions. Source timestamps and overdue reports are visible; valuations are independently observed and need not have identical price timestamps. This is observational comparison, not proof of superiority.

Account amounts are nominal paper units, kept separate by cohort. No FX conversion or combined account return is invented. Settled return and equity are separate from marked equity and unrealized P/L. Null marks remain unavailable. Recorded source quality and legacy SMC provenance limitations are displayed. Strategy-level signals pending or skipped are not shown as funded account positions.

Badges on existing review/watchlist candidate cards identify recorded open paper positions and open the corresponding engine and market. They do not alter scanner ranking or imply voting among engines.

Validation: `node scripts/test-engine-dashboard.mjs`, syntax checks, existing portfolio/quote regression checks, normalization against all fifteen real forward reports, and mobile/desktop browser checks with read-only snapshots and synthetic market/portfolio API fixtures. Temporary snapshots and screenshots are not committed.


## Mobile, language and overlap presentation

The Engines page lists positions across all five markets with independent engine and status filters. Market tabs only select separate account statistics; balances are never combined. Long and Short have written labels and green/red styling. Entry, recorded mark, recorded mark time, explicit exit price (if supplied), and nominal P/L plus P/L divided by position notional are shown. Missing prices remain unavailable. These are recorded completed-bar observations, not streaming quotes.

`engine-matches.js` is shared by the browser and Telegram. Telegram uses only canonical daily `integratedSurfacePicks` (including an explicitly empty selection), falling back to stage surface picks only when the canonical array is absent. It shows funded open positions and explicit pending-entry records, preserving direction. Source freshness, per-symbol failures and scanner freshness distinguish no match from unavailable evidence. Web cards can inspect their own symbol independently. General entry rules are labeled as rules rather than an evaluated setup. No scanner thresholds, engine rules, ledgers or execution paths are changed.

English/Persian explanation preference persists locally. Persian narratives follow the same stage, momentum, relative-strength and caution thresholds as English. Navigation and core engine position explanations are bilingual; symbols and numerical data remain isolated left-to-right. Some legacy dashboard labels and source evidence remain in English.

The installable standalone PWA has SVG and 180/192/512 PNG artwork, a dedicated maskable icon and complete shell asset caching. API and financial data are not cached as offline market evidence. iOS installation is guided through Safari Share > Add to Home Screen. Android install prompts are used when available.

Telegram adds an Engines menu and `/engines`; no outbound test messages are required. Fully available evidence with no overlap returns «سهم مناسبی برای امروز یافت نشد». Partial or stale evidence returns an unavailable notice instead.
