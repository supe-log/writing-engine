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

| Limitation                            | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closing seam                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo writer is a heuristic            | `TemplateWriter` toggles concrete memo changes from lesson directives instead of prompting a model. Chosen so the learning loop is visible, testable, and offline.                                                                                                                                                                                                                                                                                   | Implement `Writer` against a Nemotron/vLLM endpoint; the lesson's `rule` becomes prompt context.                                                                      |
| Demo researcher is a heuristic        | `HeuristicResearcher` extracts claims and novelty by diffing metrics, not by reasoning over prose.                                                                                                                                                                                                                                                                                                                                                   | Implement `Researcher` against a model doing claim extraction + implication reasoning.                                                                                |
| Demo evaluator is a proxy             | `HeuristicRubricEvaluator` scores each dimension as the fraction of that dimension's deterministic checks that passed. Explainable, but a proxy, and **not independent** of the writer's check surface.                                                                                                                                                                                                                                              | Implement `RubricEvaluator` as a **separate** model judge that reads the artifact directly and abstains on provider failure. The `abstained` contract already exists. |
| Essay-inbox scoring is un-benchmarked | Two live sources are implemented behind the port: the STAAR essay-submission inbox (`EssaySubmissionSource`, the headline demo) and NOAA NWS alerts (`NwsAlertsSource`, side demo, whose `nws-alerts-tx` domain earned YELLOW via its frozen benchmark). The essays flow runs under the `staar-ecr-g3-5` gate domain, whose evidence comes from the sibling STAAR grading project — this scaffold's own feedback memos have no frozen benchmark yet. | Freeze a feedback-memo benchmark for the essays domain, as was done for `nws-alerts-tx`. See [dataset-provenance.md](dataset-provenance.md).                          |
| Persistence is local JSON             | `FileSystemStore` is single-process and not queryable like SQL.                                                                                                                                                                                                                                                                                                                                                                                      | Implement `Store` against Supabase, preserving `schemaVersion`.                                                                                                       |
| Security scan is live-unverified      | `HiddenLayerScanner` implements the documented AIDR flow and is wired at BOTH boundaries — ingested content, and (via `ScannedModelClient`) every model prompt and output per request, all fail-closed. It has not yet run against the real API, so the detection payload shape is unconfirmed (`parseDetections` is the single adjust point).                                                                                                       | Authenticated smoke against api.hiddenlayer.ai with event credentials; confirm wire shape; capture the poisoned-essay refusal end-to-end.                             |
| Sandbox enforcement is unexercised    | OpenShell policy presets, the Bring-Your-Own-Harness mapping, and adversarial probes are authored (`deploy/nemoclaw/`), turning the human publishing gate into OpenShell's operator-approval flow — but no sandbox run has executed them yet.                                                                                                                                                                                                        | Onboard a NemoClaw sandbox (Restricted tier), apply the presets, run the probes in `deploy/nemoclaw/README.md`.                                                       |
| Single artifact format                | The only writing format is a decision memo.                                                                                                                                                                                                                                                                                                                                                                                                          | Add more `WritingTask` formats; the rubric and validators generalize.                                                                                                 |
| Rubric evaluator not calibrated       | The proxy scores are not calibrated against human judgement.                                                                                                                                                                                                                                                                                                                                                                                         | Calibrate the model judge against a labeled set.                                                                                                                      |

## Next steps (in rough priority order)

1. **Live-verify the model adapters** (`ModelWriter` + independent
   `ModelRubricEvaluator` are implemented; point `OPENAI_BASE_URL` at a
   vLLM-served Nemotron or Featherless and run `heartbeat:essays`).
2. **Authenticated HiddenLayer smoke** — confirm the detection wire shape and
   capture the poisoned-essay refusal (`parseDetections` is the adjust point).
3. **Exercise the OpenShell sandbox** — onboard, apply
   `deploy/nemoclaw/presets/`, run the adversarial probes.
4. **Benchmark the essays domain** so the scaffold's feedback memos earn their
   gate tier on their own evidence, as `nws-alerts-tx` did.
5. Implement the **Supabase** `Store`.
6. Gate any **new writing-assessment domain** through the
   [evidence-gates.md](evidence-gates.md) checks before wiring it in — now
   enforced at runtime by the heartbeat, not just documented.

## Non-negotiable

**Publishing stays human-gated.** There is no auto-publish path anywhere in the
code, and none should be added without an explicit human-approval step at the
boundary.
