# Known limitations & next steps

This repository is a **runnable scaffold with deep module seams**, not a finished
product. It is honest about what it is and is not. The limitations below are
deliberate scaffold boundaries, each paired with the seam that closes it.

## What is real

- The **heartbeat loop** runs end-to-end: poll → snapshot → research → write →
  validate → evaluate → extract lessons → integrate memory → persist.
- The **learning is genuine and measurable**: the demo goes from a lesson-free
  baseline aggregate of ~0.357 to ~1.000, with the exact learned rules printed and
  promoted to a durable playbook after repeated wins.
- **Provenance** is real: snapshots are immutable and content-hashed (SHA-256).
- **Persistence** is real: versioned JSON records under `data/`, survive across
  `npm run heartbeat` invocations.
- **Tests** exercise each module seam (Vitest).

## Limitations (and the seam that closes each)

| Limitation                       | Detail                                                                                                                                                                                                                                                                                                            | Closing seam                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo writer is a heuristic       | `TemplateWriter` toggles concrete memo changes from lesson directives instead of prompting a model. Chosen so the learning loop is visible, testable, and offline.                                                                                                                                                | Implement `Writer` against a Nemotron/vLLM endpoint; the lesson's `rule` becomes prompt context.                                                                      |
| Demo researcher is a heuristic   | `HeuristicResearcher` extracts claims and novelty by diffing metrics, not by reasoning over prose.                                                                                                                                                                                                                | Implement `Researcher` against a model doing claim extraction + implication reasoning.                                                                                |
| Demo evaluator is a proxy        | `HeuristicRubricEvaluator` scores each dimension as the fraction of that dimension's deterministic checks that passed. Explainable, but a proxy, and **not independent** of the writer's check surface.                                                                                                           | Implement `RubricEvaluator` as a **separate** model judge that reads the artifact directly and abstains on provider failure. The `abstained` contract already exists. |
| Default feed is a fixture replay | The default `FixtureSourceAdapter` replays a synthetic JSON feed for determinism. A real live source (`NwsAlertsSource`, NOAA NWS alerts) IS implemented behind the same port — but memo-writing over live alerts has not been benchmarked, so its gate domain is AMBER and live runs refuse to write by default. | Benchmark the live domain (build prompt families + a baseline) so `nws-alerts-tx` earns YELLOW. See [dataset-provenance.md](dataset-provenance.md).                   |
| Persistence is local JSON        | `FileSystemStore` is single-process and not queryable like SQL.                                                                                                                                                                                                                                                   | Implement `Store` against Supabase, preserving `schemaVersion`.                                                                                                       |
| Security scan is a marker check  | Deterministic injection/secret scanning matches known markers; it is a documented HiddenLayer seam, not a full runtime scanner.                                                                                                                                                                                   | Route ingested content, prompts, and writer output through the HiddenLayer Runtime Security API at the documented insertion points.                                   |
| No sandbox enforcement           | The human publishing gate is enforced by _there being no publish path in the code_, not by a runtime policy.                                                                                                                                                                                                      | Run the heartbeat inside a NemoClaw/OpenShell sandbox with a YAML egress/path policy.                                                                                 |
| Single artifact format           | The only writing format is a decision memo.                                                                                                                                                                                                                                                                       | Add more `WritingTask` formats; the rubric and validators generalize.                                                                                                 |
| Rubric evaluator not calibrated  | The proxy scores are not calibrated against human judgement.                                                                                                                                                                                                                                                      | Calibrate the model judge against a labeled set.                                                                                                                      |

## Next steps (in rough priority order)

1. Swap the **evaluator** for an independent model judge (biggest credibility win;
   makes scores independent of the writer).
2. Swap the **writer** and **researcher** for Nemotron/vLLM-served models (one
   OpenAI-compatible adapter; base-URL swap between a Brev GPU vLLM server and a
   hosted endpoint).
3. **Benchmark the live domain** so `nws-alerts-tx` earns prototype permission
   and live runs write without an operator override.
4. Implement the **Supabase** `Store`.
5. Add the **HiddenLayer** scan step at the documented boundaries.
6. Wrap the runtime in **NemoClaw/OpenShell** with an egress policy.
7. Gate any **new writing-assessment domain** through the
   [evidence-gates.md](evidence-gates.md) checks before wiring it in — now
   enforced at runtime by the heartbeat, not just documented.

## Non-negotiable

**Publishing stays human-gated.** There is no auto-publish path anywhere in the
code, and none should be added without an explicit human-approval step at the
boundary.
