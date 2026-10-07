# Market Hunter selection monitor

This view belongs to the four-stage discovery scanner. It does not read signal-engine positions, change scanner rules, or access customer portfolios.

- The first canonical stage-surface observation of each symbol is the return anchor. Integrated repetitions and later reappearances do not restart that anchor.
- All recorded symbols remain visible after leaving the shortlist. Leaving the shortlist is not classified as a failed trade.
- Prices use the exact latest canonical session date. Future bars are excluded. Missing quotes remain explicit; new selections have no forward return yet.
- Progress means price is above the anchor without the displayed cooling/support flags. Cooling means negative momentum shift or price below MA20. A support warning means a previously valid selection support is lost or the current scanner metrics report a local low break. These are descriptive labels, not entry/exit rules.
- The collector derives `monitor.json` on the existing evidence branch. Canonical sessions, episodes and matured outcomes retain their append-only behavior. The standalone builder only regenerates the derived view from an existing journal.
- Five-, ten- and twenty-session outcomes remain separate from the unequal-duration since-selection overview. Repeated episodes are not independent symbols.

The site exposes the monitor as a collapsed section on Home. Telegram exposes paginated tracking via the menu and `/monitor`. `/api/hunter-monitor` reads the evidence branch and reports unavailable sources explicitly.

Market Pulse crypto completed days now use UTC midnight rather than provider session metadata. Site and Telegram label stale/missing/provider-failure states as unverified, keeping old assessments explicitly historical. Historical analog datasets and strategy parameters are unchanged.
