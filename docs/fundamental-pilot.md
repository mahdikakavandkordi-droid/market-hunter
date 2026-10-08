# Fundamental context: operational refresh and limitations

The feature adds bilingual financial context without scores or trading recommendations. Scanner stages, rankings, portfolio accounting and paper engines do not consume financial context.

## Supported scope and authoritative mapping

`data/fundamental-issuers.json` is the sole instrument/issuer registry. Server-side adapters and the generated browser registry use it. Four verified SEC mappings exist: BHC.TO, SSRM.TO, META.TO and MSFT.TO. Meta and Microsoft refer to their underlying US companies, retaining USD reporting currency and explicit CDR notes. Unknown symbols and funds are not guessed into corporate mappings.

The original ten-symbol sample additionally contains SIA.TO, FTT.TO, RUS.TO, DFY.TO, SPB.TO and LUG.TO. Issuer financial-report indexes have been found for all six. An index being accessible is not proof of permitted automated retrieval/republication. They remain unsupported until an approved source route and evidence exist. Russel Metals’ published terms expressly restrict robots/extraction and republication without permission. No SEDAR+ ingestion, paid provider, or access-control bypass is implemented.

The public projection reports both sample coverage and coverage of the actual max-six integrated shortlist, with an explicit denominator and unsupported/unmapped/failure reasons. A compact coverage line is shown on Review. It does not claim all stage candidates are covered.

## Runtime refresh

Run:

    SEC_USER_AGENT='YourApp https://your-real-contact-url' node scripts/refresh-fundamentals.mjs

The cutoff defaults to the current UTC instant; `--as-of ISO_TIMESTAMP` supports explicit research cutoffs. Optional `--cache`, `--inputs`, and `--output` paths are available. Full responses remain outside the repository. The compatibility Python collector delegates to this operational command.

Operational inputs reside in `data/fundamentals/inputs`, initially seeded from the reviewed four-company evidence. Test fixtures stay under `tests/fixtures` and are not live refresh inputs. Rebuilding an input is not itself a network refresh.

For each relevant verified SEC issuer, the collector checks submissions first. It downloads Company Facts and the original document only for a changed accession or an incomplete prior reconciliation. Requests are sequential, spaced at least half a second apart, and bounded by 20-second source timeouts. Each issuer fails independently. No repeated HTTP bypass attempts occur.

`source-checks.json` distinguishes checked/unchanged/collected/failed and records the discovered accession. A newer filing awaiting reconciliation produces a visible warning while previous accepted data is retained. Amendment selection fails closed and records a source-check failure; the previous snapshot remains available.

The GitHub workflow checks filings once each weekday at 22:15 UTC and also supports manual dispatch. Changes to its own workflow trigger one initial run on main, so the deployed orchestration can be verified without waiting for the next daily slot. It runs the financial guards before collection and commits only financial data. This uses existing GitHub/Vercel infrastructure. The first local live check succeeded for all four issuers, confirming unchanged accessions; it did not claim a newly published financial quarter.

## Periods, evidence and dates

Eligible 10-Q/10-K selection uses report date, filing date and acceptance timestamp. Income-statement starts are taken from exact selected-filing facts: quarterly durations 60–110 days; annual durations 330–400 days. Ambiguous/missing periods require review. Cash flows preserve the selected filing-to-date duration. Annual figures are never presented as Q4-only, and YTD subtraction is not performed. Issuers with unsupported forms/taxonomies or unusual periods remain unsupported rather than being approximated.

Same-filing prior-year comparisons require exact dates. A 52/53-week or changed fiscal calendar may prevent a comparison; missing comparisons are omitted. No calendar-frame substitution occurs.

Verified facts require original entity-wide inline USD evidence, accession, exact periods, source URL and document hash. This is numeric reconciliation, not a complete accounting audit. Four verified core fields define completeness; optional debt/capex gaps remain explicit. Missing values are never zero.

The generator reads prior accepted snapshots, preserves complete ones on partial/older/failed attempts, records lastAttempts, and writes JSON by temporary-file rename. Repeated unchanged inputs retain their reconciliation date. Source checks, publication, financial period, numeric reconciliation and human review are separate fields. Retrieval never invents a human review date.

Browser financial loading is independent, times out after five seconds and ignores superseded responses. Late responses patch financial disclosures without resetting the active language/view or expanded state. PWA cache: v29.

## Reviewed manual source route

After verifying permission and reviewing a report, prepare a manifest and the original report’s extracted text outside the repository. For PDF sources, use a trustworthy text extraction tool and manually check page/table attribution.

    node scripts/import-fundamental-manual.mjs reviewed-manifest.json source-text.txt
    node scripts/build-fundamental-pilot.mjs

Required manifest fields: `symbol`, exact registered `issuer`, approved HTTPS `sourceUrl`, actual `publishedAt`, actual `retrievedAt`, `currency` (CAD/USD), `period` with exact start/end/basis, `review` with `approved:true`, named reviewer, actual `reviewedAt`, and `permission:{scope:'republication-authorized',reference:'written permission or applicable license reference'}`.

Each metric supplies an absolute numeric `value`, exact `periodStart`/`periodEnd`, `scale` (1/1000/1000000/1000000000), `scope` (consolidated/continuing), page/table `location`, `sourceNumber` and a matching text `anchor`. Core fields are revenue, operatingIncome, operatingCash and cash. Cash must be a period-end instant. Income fields must match the stated period. The importer checks numeric scaling, text anchors, source identity and chronology, retaining source hashes and human review attribution.

This route is explicitly human-reviewed; the code does not independently certify license authenticity or accounting interpretation. An arbitrary permission assertion is not a substitute for obtaining permission. No deferred issuer has been fabricated into coverage. Manual imports for banks, insurers or other specialized businesses must not relabel a different financial measure as operating income just to pass the core contract.

## Narratives

English/Persian explanations share verified evidence. BHC displays separately identified current/noncurrent long-term debt and cash, without claiming total debt. Meta/Microsoft distinguish same-period equipment cash spending from operating cash and label the subtraction as a limited calculation, not issuer-defined free cash flow. SSRM identifies total versus continuing-operation cash-flow scope. Missing optional evidence suppresses the corresponding conclusion. Business context and sector disclosures still have explicitly stated limits; no valuation or predictive superiority is claimed.

## Validation

Run `npm run test:fundamental`, `node scripts/test-fundamental-build.mjs`, `node scripts/test-fundamental-refresh.mjs`, `node scripts/test-fundamental-context.mjs`, `python3 scripts/test-fundamental-inline.py`, and `npm run test:browser`.

Tests exercise actual generator failures, synthetic advancement to another quarter without date edits, optional-field/scope/period suppression, manual permission/currency guards, and mobile/desktop bilingual rendering with delayed/hanging financial requests. Synthetic later-period records are never committed as real financial evidence.
