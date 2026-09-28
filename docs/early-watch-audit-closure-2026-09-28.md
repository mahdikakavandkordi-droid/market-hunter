# Early Watch audit closure — 2026-09-28

This note closes the three audit items that remained after the Early Watch stability/outlier review. It does not modify the archived evidence tag `locked-v2-validation-36420714736-archive-v1`.

## Combined sample naming

The stability analysis now exposes two explicitly different combined samples:

1. **CombinedPooledPreFinal** — all valid first-surface episodes that start before Historical Final and whose outcome remains before Historical Final. This intentionally includes Development episodes whose outcome crosses the Development/Validation boundary. This is the sample that reconciles with the previously reported Combined episode statistic.
2. **CombinedIncludedPurged** — only Development and Validation episodes with `included === true` after the split-specific boundary purges. Development outcomes do not cross `validationStart`; Validation outcomes do not cross `finalStart`.

The independent audit recomputes both definitions separately.

## Historical Final metadata

Input backtest reports must now contain exactly:

`validation.finalTestOpened === false`

Missing values, `null`, strings such as `"false"`, and `true` are rejected. Any truthy `finalEvaluation` payload is also rejected. Focused regression coverage is in `scripts/test-research-audit-guards.mjs`.

## Outlier conclusion qualification

The outlier recomputation demonstrates **internal consistency within the pinned numerical source**: the exported outcomes, adjusted/raw paths, corporate-action metadata and recomputed statistics agree with the frozen snapshot.

It is **not independent market-price verification**. Any second-source corroboration is separate supporting evidence only and must never overwrite, mutate, or silently replace the frozen snapshot.

Therefore the defensible wording is:

> The high-impact episodes are consistent with the pinned source and are not explained by a demonstrated calculation or adjustment defect within that source. Independent market-price verification remains a separate question.

Historical Final remains sealed.
