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
