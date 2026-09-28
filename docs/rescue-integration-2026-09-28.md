# Rescue integration checkpoint — 2026-09-28

This branch integrates the full Astra/UI verification lineage with the newer main-line HTP, intraday and scan-history work.

Merge parents:
- current main lineage: 316a9410696456dea707ac17a20f0fb887c2efa3
- Astra/UI verification lineage: 9d2422f212f6af726506be4f81d7fecf16f2e182

Integration commit:
- 561c2bceafaf780b7fe7cf529473aa574b34d00c

Policy:
- preserve Astra/UI engine, report, validation and UI work;
- preserve newer HTP prospective workflows, hourly intraday infrastructure, and latest scan history;
- do not publish to production until CI passes.
