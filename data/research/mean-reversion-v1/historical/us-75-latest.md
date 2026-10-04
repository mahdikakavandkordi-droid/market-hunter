# Mean Reversion V1 — us-75
Generated: 2026-10-04T20:32:10.633Z; mode: historical_diagnostic.
Forward start: 2026-10-04T20:24:23.948534+00:00; universe 75; failed fetch/review symbols 3.
Open 3; pending 1; closed 22; lifecycle reviews 0.
Realized equity $917.49; marked equity $923.05; mark quality fresh.
## Evidence provenance

| Group | Closed | Avg R after cost | PF after cost |
|---|---:|---:|---:|
| prospective | 0 | n/a | n/a |
| reconstructed | 0 | n/a | n/a |
| historical_simulated | 22 | -0.5128106365108068 | 0.17144461723223592 |
| pending | 0 | n/a | n/a |
| legacy_unprovenanced | 0 | n/a | n/a |

## Positions

- CRM: Long open; entry 235.27999877929688; current stop 219.37463705880302; provenance historical_simulated; gap none
- COP: Long open; entry 125.01000213623047; current stop 123.18856838771275; provenance historical_simulated; gap none
- EOG: Long open; entry 139.75; current stop 135.50857707432337; provenance historical_simulated; gap none
- UNH: Long pending_entry; entry pending; current stop pending; provenance pending; gap none

## Common-window comparison

SMC ledger as of 2026-10-04T19:37:44.551Z; stale false. Trend ledger as of 2026-10-04T20:07:30.473Z; stale false.
New entries in the common forward window only; existing SMC and Trend positions before launch are excluded. Baseline source prices are independently observed, not a shared historical price replay. Costs: same 0.05R assumption, different disclosed gap-fill rules and holding horizons. Comparisons include newly entered positions only, even if the baseline signal predates launch; they are parallel observational evidence, not matched-price replay.
SMC closed 0; Trend closed 0; challenger closed 0. No winner is claimed from a small sample.

Limitations: current-universe selection, short intraday history, hypothetical fractional shares, fixed-R costs excluding FX/dividends and variable spreads, completed-bar marks and approximate exchange closes. Archived raw snapshots accompany workflow artifacts.
