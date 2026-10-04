# Paper Engines in Market Hunter

Adds a read-only research view with three independent engines and five separate market accounts. Navigation, mobile swipe cards, open/closed positions, evidence freshness, incomplete instrument coverage, and source links use the existing engine reports. Scanner classifications, strategy rules, ledgers, workflows and real portfolio state are untouched.

Sources are allowlisted in `lib/engine-dashboard.js`: SMC corrected evidence-v2 reports on its original research branch; Trend Breakout and Mean Reversion forward-shadow reports on their own branches. The GET-only `/api/engines` endpoint fetches all fifteen reports concurrently, with eight-second source timeouts and one-minute edge caching. A failed source is displayed as unavailable. There is no historical fallback or zero substitution.

Full-period account results keep their original start dates. A separate common-window table uses the Mean Reversion report's existing comparison accounts for SMC and Trend and its own account for Mean Reversion. This excludes earlier baseline positions. Source timestamps and overdue reports are visible; valuations are independently observed and need not have identical price timestamps. This is observational comparison, not proof of superiority.

Account amounts are nominal paper units, kept separate by cohort. No FX conversion or combined account return is invented. Settled return and equity are separate from marked equity and unrealized P/L. Null marks remain unavailable. Recorded source quality and legacy SMC provenance limitations are displayed. Strategy-level signals pending or skipped are not shown as funded account positions.

Badges on existing review/watchlist candidate cards identify recorded open paper positions and open the corresponding engine and market. They do not alter scanner ranking or imply voting among engines.

Validation: `node scripts/test-engine-dashboard.mjs`, syntax checks, existing portfolio/quote regression checks, normalization against all fifteen real forward reports, and mobile/desktop browser checks with read-only snapshots and synthetic market/portfolio API fixtures. Temporary snapshots and screenshots are not committed.
