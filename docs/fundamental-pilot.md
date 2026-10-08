# Fundamental narrative pilot — Stage 3

Base: main `1aabddde0d86971ed70fe9e5d0b346c8b25a5261`.

This is a standalone, manually run research adapter. It is not imported by the application, scanner, portfolio or paper engines. It adds no public API, cron, numerical rating or valuation claim.

The fixed ten-instrument feasibility sample remains intact. Four instruments have a SEC-first implementation; six are explicitly deferred. Generated snapshots and bilingual readings are in `data/research/fundamental-pilot/latest.json` and `review.md`.

## Offline reproduction

Run `npm run test:fundamental`, then `node scripts/build-fundamental-pilot.mjs`. The compact fixtures contain only relevant USD facts, recent filing metadata, original inline fact excerpts and source response hashes. Building the report requires no network access or credentials.

## Fresh collection

Use `python3 scripts/fetch-fundamental-pilot.py /absolute/path/outside/repository --user-agent 'Your application and real contact URL/address'` to collect the pinned June 2026 source documents. Then run `python3 scripts/prepare-fundamental-fixtures.py /absolute/path/outside/repository tests/fixtures/fundamental-pilot`, tests and report generation. Do not commit the full raw responses. HTTP errors terminate collection without bypassing source restrictions.

This collector is deliberately pinned to the pilot period. A later financial period, amendment or changed issuer mapping requires a separate review; this is not a general production financial-data pipeline. Its as-of cutoff is 8 October 2026 at 10:17:56 UTC.

## Evidence controls

- Exact instrument → underlying company → CIK and registered name mapping. Microsoft and Meta CDRs use the underlying company, retaining a separate instrument note.
- Filing selection uses report date and acceptance timestamp. The selected filing accession, units and exact start/end dates determine eligible facts.
- Original-document comparison uses entity-wide USD inline XBRL facts, recognized numeric formatting, sign and scale. Dimensional contexts and unsupported transforms are excluded. Source HTML SHA-256 and inline fact/context identifiers are retained. This is reconciliation of selected numbers, not a complete accounting audit or independent financial-data source.
- Duplicate conflicting values, missing evidence, future dates and unreviewed amendments fail closed. Partial or older attempts cannot replace the previous complete core snapshot.
- Quarterly income statements, six-month cash flows, annual Microsoft figures and instantaneous balance-sheet figures have separate period metadata. No YTD subtraction or automatic quarter reconstruction is performed.
- Completeness means four verified core fields: revenue, operating income, operating cash and cash. Optional missing/unverified metrics remain explicit gaps. Components are not silently converted to total debt.
- Comparable revenue growth and operating margins are derived only from verified same-filing, like-duration facts. They are financial percentages, not quality ratings.
- English and Persian templates share evidence and derived values, each with two monitoring conditions. Business context and monitoring prompts remain visibly reviewed templates; the pilot does not claim an automated assessment of every sector-specific risk.

## Validation and next stage

Eighteen focused checks cover real-source reconciliation, identity, USD/CAD separation, period confusion, total/continuing operations, duplicates, invalid values, zero, original evidence, as-of timing, amendments, snapshot replacement, CDRs and bilingual comparisons.

Six additional Python parser checks cover original inline sign/scale, exact period, currency, dimensions, entity identity, unsupported transformations, nil values and zero/dash handling. Run `python3 scripts/test-fundamental-inline.py`.

Before product integration, review the generated four pairs; decide whether Microsoft's annual view is sufficient or a separately reconciled Q4 source is needed; enrich and verify sector-specific context where useful. Then add optional fundamental context below the existing technical reading with distinct dates, language selection and unavailable-state handling. Keep the scanner's selection logic and sealed research evidence untouched.

The six Canadian source routes still need individual retrieval/usage verification or a licensed provider review. No paid provider has been configured. No SEDAR+ public-site ingestion is implemented. No live customer account or portfolio was used for testing.
