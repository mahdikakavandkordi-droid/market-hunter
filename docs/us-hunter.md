# Independent US discovery extension — 2026-10-19

The outstanding US-market request is implemented on the actual V2 daily-scan path,
not the legacy `/api/scan` endpoint. Canadian membership, stage predicates,
ranking, shortlist caps, historical evidence and strategy-engine universes retain
their existing definitions.

## Reviewed membership

`data/universes/us-ivv-2026-10-16.json` records 503 USD equity holdings of iShares
IVV on NYSE, NASDAQ or Cboe BZX, with issuer name, sector, source ticker and exchange.
The official source's holdings date is 2026-10-16; retrieval date and source-file
SHA-256 are included. This is a large-cap sample, not every US exchange listing.
Cash and futures are excluded. HOLX is excluded because the source marks its
exchange as unlisted. Source class tickers `BRK B` and `BF B` become Yahoo `BRK-B`
and `BF-B`; TradingView links use dotted class symbols.

Membership is a deliberate snapshot, never downloaded during a scan. For a refresh,
download the official CSV linked in its metadata, verify holdings date, listed
exchange, equity asset class and USD currency, review additions/removals and update
the snapshot and source metadata together. Never use today's membership to claim a
point-in-time historical US backtest. Sector is displayed on both markets' cards;
no more granular industry classification is inferred.

## Operation and separation

When both newest close fields are null, the US adapter may use the explicit
regular-session OHLCV summary from that same Yahoo response. This is real provider
data, not a carried or estimated price. It requires exact symbol/USD/equity/daily
identity, the same session date, a quote timestamp within 60 seconds of the regular
close, at least 15 minutes after the close, and positive/coherent OHLCV. The prior
adjustment factor must already be one and no dividend or split may intervene;
otherwise the normalization basis is unknown and recovery is refused. Existing
numeric daily closes and all historical rows remain untouched. Extended-hours
`fulldayPrice` is never used.

Every such recovery is recorded in `sourceSessionRecoveries` with the actual
OHLCV, provider timestamp and session end; selected rows carry `sourceBarMethod`.
The US UI discloses these same-provider recoveries. They are not an independent
market-wide verification. In source checks on 2026-10-19, the Yahoo summary closes
for AAPL/NVDA/MSFT matched independently retrieved Alpaca SIP closes; only those
three closes were cross-checked, not all symbols or volume/high/low fields.

Run `MH_HUNTER_MARKET=US node scripts/scan-market-hunter-v2.mjs` to write only
`data/v2-us-latest-scan.json`. The default remains Canada and its original file.
US relative strength and session anchoring use `^GSPC`; currency must be USD.
Completed-session filtering, liquidity, stage predicates, scores and shortlist
caps use the existing engine. The numeric price/dollar-volume floors are in USD
for US instruments; no CAD-equivalent or currency conversion is claimed. Canadian
threshold validation does not establish US predictive performance.

The US job fetches at most four instruments concurrently, with a bounded timeout.
When a stock's latest valid session differs from the index, it retries the same
full history range once through Yahoo query2. Only a complete USD replacement
matching the reference session is accepted; rows are never spliced or imputed.
The US scan has a three-minute source budget and at most one minute for recovery;
superseded US workflow runs are cancelled. Canadian scan timing is unchanged.
Publication requires usable source histories for at least 90% of membership and
at least one liquid instrument, independently of whether any setup qualifies.
This is a source-reliability guard, not an optimized selection threshold. Failed
collection exits nonzero and leaves the accepted file untouched. Replacement uses
an atomic rename. Counts and exclusions remain in the report.

The independent workflow runs weekdays at 23:00 UTC and on relevant code changes;
it stages only the US snapshot. It does not depend on Canada's holiday calendar.
`/api/research-data?kind=v2-us` has its own file and validates market, currency,
benchmark and session identity. Existing Canadian collection rejects a report
explicitly marked US, preventing accidental entry into its canonical ledger.
There is no US performance ledger or historical outcome backfill in this change.

The Review screen has Canada/US tabs. US loading is optional and cannot block core
dashboard loading. The date, USD denomination, source coverage and unvalidated
status are visible. Failed sources show unavailable, not a successful zero-pick
scan; a refresh failure retains and labels an already loaded snapshot. The home
shortlist and Canadian quality monitor remain Canadian. No US engine confirmations
are borrowed from Canadian results. Existing portfolio quote lookup recognizes
exact US symbols separately from CAD CDRs and uses S&P 500 for these US issuers.
No real portfolio was accessed or changed for testing.

## Verification and remaining work

`scripts/test-us-hunter.mjs` runs the actual scanner on synthetic vendor payloads,
checks exact currency/benchmark identity, source-failure retention, unchanged
Canadian output, ledger rejection and US-versus-CDR API benchmarks.
`tests/us-hunter.spec.mjs` covers 390px bilingual rendering, market switching,
currency, chart routing, exact position-form symbol, source failure and home-scope
isolation. Both are included in the standard regression/browser commands.

Existing volume labels and quality evidence were already merged in PRs 78/77.
They are not a proven selection filter. Fundamental source refresh remains paused
as documented in `fundamental-pilot.md`; adding a US symbol does not manufacture
financial coverage. US outcome tracking and broader verified financial coverage
remain separate next steps. Do not promote an additional rank/filter rule on the
short, overlapping Canadian forward sample.
