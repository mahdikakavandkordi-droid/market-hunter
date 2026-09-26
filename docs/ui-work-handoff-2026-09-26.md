# Market Hunter UI Work — Handoff

Date: 2026-09-26

Working branch:
`research/market-hunter-ui-work`

Base branch:
`research/market-hunter-v2-rebuild`

## Guardrails

- Do not merge to main/live without explicit user approval.
- Do not reopen validated scanner stage research casually.
- Do not change Market Pulse methodology casually.
- Backend remains the source of truth for classification, ranking, stage surfaces, integrated max-6 selection, and historical analogs.
- Frontend should render, not rerank.
- GitHub Actions minutes are currently constrained. The generic `check.yml` workflow ignores this temporary UI branch to avoid wasting minutes.
- Do not add new workflows or trigger manual GitHub Actions while this limitation is active unless explicitly necessary.

## Current UX direction

The page should answer four questions in order:

1. What happened today?
2. Where is the market now?
3. Which charts are worth reviewing?
4. Where can I inspect deeper market internals if I want them?

Current Market flow:

`Daily Market Report → Market Pulse → Charts to review today → Market Internals`

The product should not feel like a wall of metrics.

## Implemented changes

### Daily Market Report
- Compact headline.
- Equities / Metals / Crypto state cards.
- Only three key developments visible initially.
- Divergences, scenario watch levels, methodology/context and Hunter context are behind `Open full daily context`.

### Market Pulse
- Seven markets preserved: TSX, S&P 500, Nasdaq-100, Gold, Silver, Bitcoin, Ethereum.
- Compact closed state shows only essential state + 5D / 20D context.
- Full historical analog evidence, confidence, sample sizes, exact/family source, warnings, outlook and scenario levels remain behind card expansion.
- Mobile uses horizontal swipe cards to reduce vertical scrolling.

### Final Shortlist
- Validated integrated max-6 policy is unchanged.
- Full Shortlist tab remains available.
- Market page includes a compact `Charts to review today` preview using the exact same `integratedSurfacePicks`.
- No browser-side reranking.
- Cards show four primary metrics at first glance, including RSI.
- Full evidence remains behind Details.
- Methodology text is collapsed under `How this shortlist is built`.

### Market Internals
- Indexes, breadth, sectors, detailed regime view and Market Takeaway are preserved but collapsed by default inside `Market Internals`.

### Mobile / interaction fixes
- Main tabs are horizontally scrollable instead of five compressed buttons.
- Pulse cards are horizontally swipeable.
- Shortlist metrics are 2x2 on mobile.
- Header reduced to Refresh + Scan settings.
- Legacy Top 3/5 selector hidden from normal UI but retained in DOM so legacy code does not break.
- Liquidity setting explicitly states it does not rerank validated Final Shortlist.
- Fixed potential double-toggle Watchlist heart bug caused by simultaneous touchend + click handlers.
- Cards now have keyboard support and aria-expanded state.
- Improved directional swipe detection for Watchlist removal.
- Position details rendered with `.detail.open` are visible.
- Removed unusable Bought action from unavailable Watchlist cards.
- Loading state now disables Refresh and shows `Refreshing…`.
- Status is aria-live and error container has role=alert.
- Watchlist status language is consistently English.

## Key commits on UI branch

- `04915e2` — skip Actions on temporary UI branch
- `b765030` — simplify Market Overview with progressive disclosure
- `e88300b` — simplify Final Shortlist cards and hierarchy
- `7d03b55` — improve mobile navigation and reduce vertical density
- `da7521f` — clarify scan settings / hide legacy Top control
- `cea7d69` — mobile-safe + accessible card interactions
- `5979797` — compact Final Shortlist preview on Market page
- `ec8dd69` — tighten mobile shortlist preview layout
- `8c77514` — loading / positions / unavailable watchlist fixes
- `be5641d` — consistent Watchlist status language

## Validation completed

- Latest `index.html` JavaScript syntax check: PASS.
- Required controls still exist in DOM: Refresh, liquidity, hidden topN.
- Tab handlers remain connected.
- Card expand/collapse handlers remain connected.
- Daily Report details, Market Pulse details, Market Internals, and Shortlist methodology are present.
- No new GitHub Action run has been triggered by the UI commits after the temporary branch guard.
- Existing Vercel preview for this branch is stale and points to the first UI-branch commit, not the latest UI work.

## Vercel

Project:
`market-hunter`

Latest known UI-branch preview deployment:
- READY
- branch: `research/market-hunter-ui-work`
- commit: `04915e2e75e20ff62f274e3652ff900f026af809`

Do not treat this preview as the current UI; newer commits are not deployed yet due current deployment/rate constraints.

## Next steps

Once Vercel can build a fresh preview:

1. Verify latest UI branch deployment SHA.
2. Desktop visual audit:
   - Daily Report hierarchy
   - Pulse density
   - Compact shortlist preview
   - Full Shortlist card density
   - Market Internals collapsed state
3. Mobile visual audit:
   - sticky/swipeable tabs
   - Pulse horizontal swipe
   - shortlist 2x2 metrics
   - Chart / Watchlist touch targets
   - no horizontal overflow
4. Functional checks:
   - Market → Shortlist button
   - card expansion
   - TradingView links
   - Watchlist add/remove
   - Watchlist swipe removal
   - Positions visibility
   - empty/unavailable states
5. Only after successful preview validation, discuss moving UI work back to the research branch.
6. Main/live merge requires explicit user approval.


## Portfolio Monitor — V1 implemented

The old Positions area is now a real Portfolio Monitor.

### Position entry
Each holding can be added manually or from a Market Hunter card. Stored fields include:
- symbol
- quantity
- average purchase price
- purchase date
- source: Market Hunter or Manual / External
- optional entry thesis / note
- created / updated timestamps

For Market Hunter-origin positions, the Hunter setup is captured as an entry snapshot when available:
- entry stage
- RS20
- momentum shift
- RSI14
- local structure
- support / resistance
- evidence

Legacy saved positions are preserved and marked Needs Details rather than inventing a quantity.

### Portfolio overview
The Portfolio tab now shows:
- portfolio / tracked value
- cost basis
- total P/L in $ and %
- holdings count
- needs-attention count
- plain-language Portfolio Read

If any complete holding lacks current data, totals are not presented as if the portfolio were fully valued.

### Monitoring, not signals
Per-position health uses descriptive states:
- Trend Healthy
- Momentum Cooling
- Watch Closely
- Structure Warning
- Data Unavailable

The monitor reports evidence such as:
- local-low break / reclaim
- swing structure
- momentum weakening
- RS vs benchmark
- weekly + daily trend alignment
- support / resistance context

It does not generate Buy, Sell, Hold, Take Profit or Stop Loss instructions.

### What Changed Today
Portfolio monitoring keeps an independent daily snapshot in localStorage:
`marketHunterPortfolioDaily`

The current portfolio state is compared with the prior market-day snapshot for material changes such as:
- stage context change
- momentum improvement / deterioration
- local-high break
- local-low break / reclaim
- newly unusual volume

### Independent data path
New serverless endpoint:
`api/portfolio.js`

Purpose:
- fetch technical data for holdings independently of the current Hunter shortlist / scanner universe
- use the frozen V2 metrics engine for descriptive portfolio monitoring
- use TSX as the default benchmark for CAD-listed holdings
- use Nasdaq / S&P benchmark mappings for known Canadian-traded U.S. CDRs
- return context only; it does not run shortlist selection or ranking

Frontend endpoint:
`/api/portfolio?symbols=...`

### Portfolio commits
- `0bf4089` — Portfolio Monitor layout/editor styling
- `f0d32b6` — holdings form + overview + health monitor
- `398aedb` — daily changes + legacy position migration
- `da57a75` — independent portfolio metrics endpoint
- `3f4a1a6` — load holdings independently from scanner universe
- `4bff9c5` — independent daily monitoring snapshots
- `4169cb7` — migration and signed P/L fixes
- `2faab01` — repaired P/L template expressions

Validation:
- latest frontend JavaScript syntax: PASS
- `api/portfolio.js` syntax: PASS
- no new GitHub Actions run triggered on the temporary UI branch
- Vercel preview is currently READY only up to commit `f0d32b6`; newer portfolio data-path commits still need a fresh preview deployment before runtime verification


## Portfolio Monitor — V1.1

Added after V1:

### Allocation & concentration
- current market-value weight per holding
- largest position
- largest sector
- concentration read
- sector exposure breakdown
- Market Hunter vs Manual / External exposure breakdown
- holdings outside the reviewed universe remain `Unclassified` rather than receiving a guessed sector

### Currency safety
- Portfolio totals and allocation are aggregated only when current holdings resolve to one known currency
- if multiple or unknown currencies are present, combined value / P&L / weights are intentionally withheld
- individual holdings continue to be monitored independently
- no implicit CAD/USD FX conversion is performed

### Since-entry analysis
The portfolio endpoint now accepts purchase date + actual average purchase price context and returns:
- sessions held
- current return from actual entry price
- maximum gain since entry
- maximum peak-to-trough drawdown during the holding period
- benchmark return since entry
- excess return vs benchmark
- partial-history flag when stored market history does not cover the full holding period

These analytics live in position details and do not generate trade instructions.

### V1.1 commits
- `5a3f9a5` — add universe name/sector metadata to portfolio endpoint
- `887600e` — allocation / concentration UI
- `59fbec2` — repair allocation holding metric template
- `073d838` — currency-safe portfolio totals and allocation
- `330f390` — since-entry performance endpoint context
- `99acd46` — surface since-entry drawdown / benchmark metrics

Validation:
- latest frontend JavaScript syntax: PASS
- latest `api/portfolio.js` syntax: PASS
- allocation / currency guard / since-entry metrics present
- GitHub Actions count remains unchanged at the one old failed run
- newest Vercel preview currently observed is commit `59fbec2`; later V1.1 commits still need preview deployment before visual/runtime validation


## Portfolio Monitor — V1.2 Advanced Risk

Added after V1.1:

### Advanced Risk (collapsed by default)
Portfolio-level historical context is available behind a collapsed `Advanced Risk` section so the default Portfolio view remains compact.

Metrics:
- annualized volatility (recent common-session window)
- portfolio max drawdown
- beta vs TSX Composite
- portfolio return vs TSX over the same window
- excess return vs TSX
- average pairwise holding correlation
- diversification read
- pairwise correlation matrix
- beta-based TSX ±5% stress lens

### Guardrails
- these are descriptive historical analytics, not forecasts or trade signals
- TSX Composite is the current portfolio-level benchmark
- correlation remains available for mixed-currency portfolios because it is return-based
- combined volatility / beta / stress analytics are withheld when holdings span multiple or unknown currencies
- stress estimates are simple beta-based sensitivity approximations, not predicted outcomes
- correlation table is limited in the UI to keep mobile density manageable

### V1.2 commits
- `43a8908` — advanced portfolio risk and correlation backend
- `4e971e5` — collapsed Advanced Risk UI
- `61b780a` — currency-safe advanced risk calculations
- `1ab5341` — preserve correlation view for mixed-currency portfolios

Validation:
- frontend JavaScript syntax: PASS
- `api/portfolio.js` syntax: PASS
- Vercel deployment for `61b780a` is READY
- no runtime errors observed in the selected recent Vercel window
- GitHub Actions usage remains unchanged on the temporary UI branch


## Portfolio Monitor — Advanced Risk

Advanced Risk is implemented as a collapsed section so the default Portfolio view stays simple.

### Metrics
- current-weight annualized volatility vs TSX
- 60-session max drawdown
- beta vs TSX
- portfolio return vs TSX
- excess return vs TSX
- average pairwise holding correlation
- highest-correlation pair
- diversification read
- TSX ±5% beta-based stress lens
- holding-level variance / risk contribution

### Risk contribution
Uses current portfolio weights and the covariance matrix over the common historical session window. It distinguishes portfolio weight from contribution to recent portfolio variance.

### Safety / integrity guards
- TSX benchmark is always fetched for portfolio-level beta/stress analytics, including CDR-only portfolios.
- Portfolio-level volatility, beta and stress analytics are withheld if not all quantity-bearing holdings have sufficient common history.
- Mixed/unknown currencies continue to block combined value-weighted portfolio analytics until FX conversion exists.
- Correlation can still be shown for a covered subset because it is based on percentage returns.
- Portfolio risk history is explicitly described as a current-weight monitoring approximation rather than a reconstructed transaction-level track record.
- Stress lens is described as sensitivity, not a forecast or signal.

Latest validation:
- frontend JavaScript syntax: PASS
- api/portfolio.js syntax: PASS
- risk contribution wiring: PASS
- no new GitHub Actions run triggered
