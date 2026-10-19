# Preserved original aggregate records

These two JSON files are exact copies of the original Actions artifacts. They are historical summaries, not raw market data or row-level evidence. They are not rewritten by v3.

| File | Run | Original run SHA | JSON SHA256 |
|---|---|---|---|
| experiment-results.json | 38506906308 | 4e069e8d761ab30f550349ae38c625bd53a1bdee | 4fe19c1f292c0a934b9f047dc38ec5666876e22a24b60dea16469be228b7cd0b |
| phase2-results.json | 38508314801 | 54ee0441052a086c32e4c63f74c9d4c8b04b1b69 | b85cccb6ac6b005e880a8c266daaeec77fdcbd6f1ce3bf98fcaa2afa1d803116 |

Volatility model metrics in v3 must remain numerically equal to original implementation when given identical input bars. New source vintages, price-field contracts and macro oil proxy changes can produce different historical results; they must be labelled rather than backfilled into these records.
