# Market Hunter forward validation evidence

Durable append-only evidence for the four-stage Market Hunter surface.

Canonical files are created by the scheduled workflow:
- sessions.jsonl
- presences.jsonl
- episodes.jsonl
- outcomes.jsonl
- runs.jsonl
- status.json
- audit.json

Policy:
- prospective only; no historical backfill;
- first same-day canonical session is immutable;
- Early Watch, Recovery, Attractive Growth, Established Move, and integrated Top 6 are recorded separately;
- 5/10/20-session outcomes are descriptive validation, not buy/sell signals;
- model/version identity is stored with every session and episode.
