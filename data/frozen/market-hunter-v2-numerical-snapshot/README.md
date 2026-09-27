# Market Hunter V2 numerical snapshot

Task 3 freezes the **actual normalized numerical inputs**, including adjusted calculation values.

Canonical artifact:
- Vercel deployment: `dpl_5yFyrve6byxA6McmfE5pvsokga4Y`
- Capture code: `47494e8a1416ca8d0ee4715e9381a2607348bb30`
- Four batch files plus the artifact manifest live under `/task3-numerical-snapshot/`.

Important rules:
1. Retrieve the exact batch files from the registered deployment using authorized Vercel access.
2. Keep the files local for an experiment; baseline and candidate must read the same files.
3. Run with network access forbidden.
4. The loader verifies file integrity, full numerical hash, structural hash, normalization version, source metadata, batch identity, and exact symbol membership/order.
5. Do not substitute a fresh Yahoo fetch, even if its structural fingerprint matches.
6. The historical Final period remains closed during development experiments.

The registry intentionally identifies the artifact by immutable deployment ID rather than a temporary share URL. The snapshot files themselves contain their exact numerical and structural hashes.
