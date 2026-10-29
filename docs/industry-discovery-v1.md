# Industry discovery v1

The page evaluates every liquid current-session row before legacy classification. No total cap, sector quota or stage eligibility applies. Stocks are alphabetical, not a probability ranking. Legacy ledgers and strategy engines remain unchanged; older snapshots without universe data retain their legacy display until refreshed.

The initial technical screen requires finite price, 20-session return and relative return, MA20/MA50 distances, RSI and ATR; positive price, return, relative return and MA50 distance; an explicitly intact recent low; and an empty recorded risk flag list. Momentum acceleration is not a gate. This is an unvalidated hypothesis, not a demonstrated return advantage.

Sector breadth describes tracked liquid members, not an industry index. Incomplete coverage and small groups are disclosed. CDR wrappers remain unmapped instead of being assigned an invented sector.

First successful observations are written to data/industry-history/{CA,US}/YYYY-MM-DD.json. Same-session reruns never overwrite inputs, selection version or selected symbols. Production daily workflows commit these records. There is no historical backfill.

The scanner reports 5/10/20 reference-market-session outcomes using exact endpoint dates and same-provider adjusted series. Missing observations are separate from pending horizons. These overlap and exclude trading costs; means are not portfolio returns or evidence of statistical significance. No automated tuning uses the results.

Tests cover 101-stock and zero-stock outputs, missing metrics, mixed dates/currencies, unmapped sectors, archive immutability, exact horizons, missing outcomes, mobile English/Persian and existing regressions.
