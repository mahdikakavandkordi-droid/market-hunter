# Market Hunter V2 — Structural Dataset Lock

This directory defines the fixed validation source window created on 2026-09-27.

The lock is intentionally based on **structural market data**, not Yahoo's full-precision adjusted-price floats.

Locked fields:
- timestamp
- raw open-independent OHLC fields available to the backtest (raw close/high/low)
- volume
- split events
- dividend events

Yahoo adjusted prices remain inputs to calculations, but repeated requests showed tiny sub-mill floating-point revisions even when raw market data and corporate actions were unchanged. Those precision changes must not trigger a false data-drift failure.

Every comparative experiment must run baseline and candidate variants from the **same fetched data object in the same process**.

Use `scripts/run-locked-v2-backtest.mjs`. A structural SHA mismatch aborts the run.
