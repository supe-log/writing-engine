# regression-gate — cross-family harness for shared-layer changes

The mechanism that keeps the engine family adaptable: any proposed change
to the shared layer (templates, judge protocols, adjudicator patterns) is
evaluated PAIRED against every family's dev set before adoption anywhere.
Engines stay specialized per assessment; general knowledge lives in the
factory; this gate decides, per family, whether a candidate lesson helps.

- `families.example.json` — registry shape (engine, dev, sealed gold,
  traits config per family). Corpora and gold labels are LOCAL ONLY
  (TEA-copyrighted) — never in this repo.
- `judge_b.py` — independent cross-provider judge (disagreement signal,
  validated as a human-review-band trigger; falsified as a voting member).
- `resolvers.py` — the two escalation resolvers that the gate REJECTED
  (kept as the canonical example of the gate doing its job).
- `REPORT.md` — both measured campaigns with verdicts (2026-07-22/23):
  escalation-by-voting falsified; quote-grounded feedback adopted;
  gen-2 lesson transfer adopted for Spanish (sealed exam), rejected for
  the English families (paired CIs), deferred for high school.
