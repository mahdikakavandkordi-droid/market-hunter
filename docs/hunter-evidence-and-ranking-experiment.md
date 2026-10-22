# Hunter measurement repair and prospective ranking experiment

## Problem and resulting behavior

A saved selection price could be on a pre-split scale while later Yahoo history was adjusted. AMD's seven-for-one October 16 split therefore looked like an approximately 87% loss. Measurement now reads both endpoints from the same adjusted history and scales the original support consistently. The saved decision price, decisions and old outcome records remain unchanged. New outcomes identify their measurement basis; the monitor derives corrected quality and maturity summaries without rewriting the ledger. This convention is an adjusted-price observation, not an executable trade or portfolio return.

Missing entry/target/benchmark bars produce unknown returns. A material change of entry-price scale must agree within 1% with the product of declared splits; an unrelated dividend cannot justify an arbitrary price change. Small differences include saved-price rounding and ordinary adjustments. Unsupported material changes are excluded explicitly rather than falling back to the old calculation. Large dividend adjustments may therefore remain unmeasurable pending source review.

The public reader also validates this repaired measurement contract. Raw GitHub CDN edges can retain a pre-repair snapshot after the new evidence commit exists. On an incompatible/failed raw response, the reader tries GitHub's public Contents API with the raw media type, within the same total eight-second budget. A legacy calculation is never returned as a fallback; if neither source supplies a compatible report the endpoint returns unavailable. Healthy raw reads do not consume Contents API requests.

October 9's two captures failed because the source still contained October 8. A later October 9 report exists, but it is not a prospective ledger record. That historical gap remains visible and is never backfilled. Collection now additionally follows successful `Research Daily Refresh` completion, using trusted main code and the current main snapshot. Existing schedules remain recovery paths. Exchange-local same-day and completed-session checks continue to reject stale or retrospective captures. The API and mobile follow-up disclose missing benchmark-session dates.

## Frozen experiment: hunter-momentum-peer-order-v1-20261022

This is a new prospective discovery-ranking experiment, separate from the production shortlist and all three strategy engines. No retrospective performance is claimed for it. Each capture freezes the source hash, capture time, complete classified cohort and its original decision features, baseline membership, shadow membership, policy and policy hash. The operational scanner also records one exclusion reason per universe symbol; source failures and unclassified instruments remain distinct from ranked-but-hidden candidates. The experiment evaluates classified candidates only, not an asserted market-wide opportunity set.

Admission floors, stage criteria, Recovery age cap, per-stage maximum six, final maximum six and stage round-robin stay unchanged. Within the eligible candidates of each stage, order by:

1. Positive `momentumShift`, then nonpositive, then unknown.
2. Descending median `rs20` of classified same-sector peers in this exact snapshot. At least three valid peers are required; otherwise rank this component as unknown.
3. Existing surface score (Recovery) or score (other stages), then symbol.

This combines two exploratory signals into one declared ranking policy. It does not estimate their independent causal effects. The sector statistic describes classified peers, not an independent industry index; a small or selected cohort may be misleading. This policy is not fitted to the missed winners and does not lower floors to admit OTEX/VET/etc.

All classified candidates, including neither-selected candidates, receive immutable same-date 5/10/20 benchmark-session outcomes when measurable. The comparison reports current vs experimental selection, added vs removed vs neither-selected cohorts, mean/median and equal-symbol excess returns, adverse excursions, sector concentration, missing matured outcomes and complete paired-date differences. A paired date is usable only when every selected name on both sides has a measurable outcome. Missing outcomes are not zero, and unequal partial baskets cannot count as a paired win. Repeated stocks and overlapping horizons are not independent evidence; these are not executed portfolios.

The operational review gate is at least 30 captured sessions and 10 complete paired decision dates for the relevant horizon, with no pending matured outcomes. This is not a statistical sufficiency guarantee. There is no automatic production promotion. A policy change requires a new version and prospective cohort; old captures are not recomputed with revised policy.

## Verification

`test-hunter-measurement.mjs` covers split-scaled returns/support, missing bases, unsupported changes, legacy projection immutability and benchmark-calendar gaps. `test-hunter-selection-experiment.mjs` covers preserved admission, baseline validation, hidden candidates, losing alternatives, incomplete pairs, future isolation and idempotent evidence. Collector integration tests exercise same-day capture/retry and stale rejection. The mobile browser fixture checks disclosure, missing dates, unknown price basis and horizontal containment. Required CI runs both scanner checks and the regression/browser suite before merge.
