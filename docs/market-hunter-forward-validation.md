# Market Hunter forward validation journal

This is a prospective, append-only validation layer for the current four-stage Market Hunter surface. It does not alter scanner thresholds, ranking, stage classification, integrated cap logic, or portfolio behavior.

## What is recorded

For each completed Canadian market session:

- one immutable session snapshot with the exact Market Hunter model version and source hash;
- every visible pick in Early Watch, Recovery, Attractive Growth, and Established Move;
- the integrated Top 6 surface;
- daily presence records separated from first-surface episodes;
- the day's compact classification map so later stage transitions can be evaluated.

A first-surface episode begins when a symbol was not present in the same stage surface on the immediately previous recorded market session. Integrated Top 6 episodes continue while the symbol remains in the integrated surface, even if its stage changes.

## Forward outcomes

Each episode is evaluated after 5, 10, and 20 completed TSX sessions. Outcomes include:

- close-to-close return from the decision-session close;
- TSX Composite return and excess return over the same dates;
- maximum favourable and adverse excursion during the horizon;
- stage at the horizon;
- whether the symbol is still surfaced in any stage;
- whether it remains in the integrated Top 6.

This is descriptive validation, not a buy/sell backtest.

## Integrity

- Historical backfill is disabled.
- Same-day retries never replace the first canonical session.
- Evidence lives on `research/market-hunter-forward-validation`.
- If the source scan is stale while the TSX has a completed session, collection fails instead of recording mismatched evidence.
- A missing/holiday completed session is a no-op, not a fabricated record.
- Model/version changes are recorded explicitly so different versions can be analyzed separately.

Operational review begins after 30 complete sessions; 60 sessions is a stronger evidence target. Those are review milestones, not statistical guarantees.
