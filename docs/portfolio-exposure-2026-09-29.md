# Portfolio exposure and mobile flow

Presentation metadata is separate from scanner universe sectors and benchmarks.
The API now returns an `exposure` object. The UI uses its group for the Exposure
donut and retains the original sector as a backward-compatible fallback.

## Coverage

- Nine existing CDRs: AAPL, MSFT, NVDA, AMD (Technology); AMZN, TSLA, COST
  (Consumer); GOOG, META (Communication). These are broad project groups,
  not a claim of a complete GICS taxonomy. CDR identity was checked against
  https://cdr.cibc.com/en/cdr-directory on 2026-09-29.
- CGL/CGL.C and SVR/SVR.C bullion ETFs, PHYS and PSLV physical trusts,
  CEF mixed gold/silver trust, HUG/HUZ futures ETFs. Each mapping stores an
  issuer URL, instrument type, description and review date.
- Sources: BlackRock CGL product 272269, CGL.C product 241528, SVR product
  272952 and SVR.C product 240642; Sprott gold, silver and gold-and-silver
  product pages; Global X HUG and HUZ product pages. Exact URLs are in the registry.
- Existing Canadian stock classifications remain unchanged, so mining stocks
  remain Materials rather than being treated as bullion.

## Integrity and limitations

No name-based guessing, automatic AI classification, scanner changes, model
changes, account mutations, or database migration. Only reviewed exact symbols
are mapped. Unknown instruments stay Unknown. Additional tickers need issuer
verification; the user's specific gold/silver holdings have not been identified.
CEF is not split using invented constituent weights. The chart shows market
value allocation, not leverage-adjusted risk or full fund look-through.
Cash inside a fund and dynamic constituent weights are not modeled.

## Mobile UX

Value -> allocation -> vertically stacked holdings -> analysis -> account/backup.
Disclosure hides methodology and backup controls until requested. Exposure rows
show their member tickers. Holding details retain instrument/asset information
and issuer links. Existing auth, edit, delete, sync and restore handlers remain.

## Verification

Regression cases cover CDR look-through, bullion versus futures, mixed metals,
unknown symbols, exchange identity and mining-stock separation. Browser smoke
covers the Exposure toggle, selection, mobile overflow, light/dark rendering,
reload, edit, removal and watchlist behavior.
