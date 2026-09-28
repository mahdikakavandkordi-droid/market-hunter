# Mobile UI polish — handoff for Sol

Scope: research/market-hunter-ui-lite. This pass changes presentation and interaction; stock qualification, rankings, portfolio calculations, and validation rules are unchanged.

## Implemented
- Added ui-polish.css as the final shared stylesheet: larger text, clearer card hierarchy, 44px touch targets, focus indicators, and reduced-motion support.
- Mobile stage filters use a two-column layout with all four stages visible.
- Home review rows stack into compact cards while retaining company, stage, RSI, and chart action.
- Stock symbols open their chart; watch and stage buttons expose selected state.
- Bottom navigation includes safe-area spacing and current-page semantics.
- Position form uses 16px inputs, associated labels, a scrollable mobile sheet, Escape dismissal, focus containment/return, and an inert background while open.
- Fixed a literal backslash-n in HTML. Added required stylesheet, service-worker, and icon paths to the Node static server.
- Updated the service-worker shell cache to v5 and included the new stylesheet.

## Verification completed
JavaScript syntax checks passed for app.js, server.js, and service-worker.js. A local DOM integration check using the repository's actual committed JSON passed home rendering, all four stage selectors, navigation state, watch toggle, modal labels/focus/Shift-Tab/Escape/cancel, theme toggle, and portfolio/watchlist navigation. No live portfolio API write or purchase was performed.

## Remaining work
1. Visual QA is still required. agent-browser failed during daemon startup; the fallback browser download returned an invalid archive. DOM checks do not validate layout or browser rendering.
2. Check 320, 375, 390, 430, 768, and 1440px widths in both themes. Verify no page-level horizontal overflow, long company names, home RSI rows, and bottom-nav clearance.
3. On iOS Safari and Android Chrome, open the position form with the keyboard visible; confirm Save remains reachable, date/select inputs work, background scroll stays put, and close restores focus.
4. Verify existing installed PWA clients receive shell v5 and the new stylesheet, including an offline shell reload. Data endpoints remain network-only.
5. Review the protected research preview before any production merge. Do not report this as visually approved or production-deployed.
6. After visual approval, consolidate accumulated legacy CSS into a single responsive source in a separate change. Avoid changing scoring or financial logic during that cleanup.
