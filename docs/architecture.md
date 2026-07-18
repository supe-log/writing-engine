# Architecture

Writing Engine is a heartbeat-driven pipeline built around **ports** (interfaces)
and **adapters** (implementations). The orchestrator depends only on the ports,
so any stage can be replaced — a heuristic swapped for a model, a fixture feed
swapped for a live one, filesystem JSON swapped for Supabase — without touching
the loop.

## Design principles (from the brief)

1. **Live source is truth; memory is context.** Snapshots are immutable and
   content-hashed. Lessons change _how_ the writer works, never _what_ the source
   says.
2. **Separation of concerns.** Research, writing, deterministic validation, and
   rubric evaluation are distinct stages. The writer never sees or edits scores.
3. **Failures are visible.** The evaluator may abstain; abstentions are `null`,
   never a fake zero, and the engine learns nothing from them.
4. **Security sits outside the writing rubric.** Injection/secret scanning is a
   deterministic validator and a documented HiddenLayer seam, not a style score.
5. **Human publishing gate.** Nothing auto-publishes. There is no publish path in
   the code.
6. **Measurable improvement.** A frozen benchmark and per-dimension scoring make
   the baseline-to-latest delta credible, including a held-out task.

## The heartbeat pipeline

```text
           Heartbeat Scheduler (time/state driven)
                        |
                        v
   Live Source Adapter  --->  Snapshot / Provenance  (live source is truth)
                        |               |
                        v               v
                   Researcher  --->  Evidence Pack  --->  Writer  <--- Lesson Memory (context)
                                                            |               ^
                                                            v               |
                                              Deterministic Validators      |
                                                            |               |
                                                            v               |
                                              Independent Rubric Evaluator  |
                                                            |               |
                                        +-------------------+-----------+   |
                                        |                               |   |
                                        v                               v   |
                                   Run History                  Lesson Extractor
                                        |                               |
                                        +----------> Store <------------+
                                       (versioned JSON; Supabase-ready port)
```

One cycle (`runCycle` in `src/core/pipeline.ts`):

1. **Poll** the source adapter for the next event (or reuse the latest snapshot).
2. **Capture** a content-hashed provenance snapshot.
3. **Research**: extract claims, novelty (vs. the previous snapshot), and
   uncertainty into an evidence pack.
4. **Retrieve** applicable lessons for the scope from memory.
5. **Write** the artifact, applying the retrieved lessons' directives.
6. **Validate** deterministically (objective, model-free checks).
7. **Evaluate** independently against the frozen rubric (per-dimension scores).
8. **Extract** the smallest reusable lessons from the failed checks.
9. **Integrate** into memory: de-duplicate, reinforce wins, promote after
   repeated wins.
10. **Persist** the run, artifact, evaluation, and lessons.

## Ports and adapters (the seam table)

| Port (`src/ports/index.ts`) | Demo adapter (offline, deterministic)                                           | Production implementation (not shipped)                                                    |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `LiveSourceAdapter`         | `FixtureSourceAdapter` — replays a JSON feed whose metrics update between polls | Poll a real feed (Texas open data / NOAA / Apify actor). Stub: `LiveSourceAdapter.todo.ts` |
| `SnapshotService`           | `ProvenanceSnapshotService` — SHA-256 content hashing                           | Same; optionally persist raw payloads to object storage                                    |
| `Researcher`                | `HeuristicResearcher` — metric/body extraction + novelty diff                   | Nemotron/vLLM-served model doing claim extraction and implication reasoning                |
| `Writer`                    | `TemplateWriter` — directives toggle concrete memo changes                      | Nemotron/vLLM-served model; lessons become prompt-context injections                       |
| `DeterministicValidator`    | `DeterministicValidators` — citations, staleness, injection, structure          | Same, extended with domain-specific checks                                                 |
| `RubricEvaluator`           | `HeuristicRubricEvaluator` — per-dimension pass-ratio proxy                     | Independent model judge (separate prompt), returns calibrated scores + abstention          |
| `LessonExtractor`           | `CritiqueLessonExtractor` — maps failed checks to reusable repairs              | Model-assisted lesson synthesis with overfit rejection                                     |
| `Store`                     | `FileSystemStore` — versioned JSON under `data/`                                | Supabase-backed store implementing the same interface                                      |

Wiring happens in exactly one place: `createEngine` in `src/core/engine.ts`.

## Demo heuristic vs. production model

The demo's `Researcher`, `Writer`, and `RubricEvaluator` are **deterministic
heuristics**, chosen so the entire loop runs offline, with no API keys, and
produces byte-for-byte reproducible output. This is a deliberate scaffold
decision, not a hidden shortcut:

- The **writer** turns lessons into output changes via `LessonDirective`
  toggles. This makes the learning loop _visible and testable_. A production
  writer sends the evidence pack and retrieved lessons to a model as prompt
  context; the lesson's human-readable `rule` is what gets injected.
- The **evaluator** scores each dimension as the fraction of that dimension's
  deterministic checks that passed. It is explainable but is a _proxy_. A
  production evaluator is a separate model judge that reads the artifact
  directly, is independent of the writer, and abstains on provider failure. The
  `abstained` contract already exists in the `Evaluation` type and is honored by
  the extractor (an abstained cycle teaches nothing).

Because both sides implement the same port, swapping in the model version does
not change the orchestrator, the store, the benchmark, or the tests.

## Learning mechanism

- **Extraction** (`src/core/lessonExtractor.ts`): only failed checks that map to
  a known, generalizable repair become lessons. The `REPAIRS` table is the
  concrete form of "the smallest reusable lesson supported by the critique."
- **Memory** (`src/core/lessonMemory.ts`): lessons are keyed by
  `directive + scope` (natural de-duplication). When an applied lesson's target
  check passes on a later cycle, that is a **win**: confidence grows and, after
  `PROMOTION_THRESHOLD` wins, the lesson is **promoted** to the durable playbook.
- **Scope**: lessons generalize within a feed/domain scope. The benchmark's
  held-out task shares the scope but never contributes lessons, so its
  improvement isolates generalization from overfitting.

## Persistence and versioning

- The `FileSystemStore` writes one pretty-printed JSON file per record under a
  gitignored `data/` directory, partitioned by kind (snapshots, evidence,
  artifacts, evaluations, runs, lessons).
- Every record carries a `schemaVersion` (see `src/domain/records.ts`). Bumping a
  version signals that a reader/migration must handle the change — the mechanism a
  Supabase migration would hook into.
- Content-addressed ids (`src/core/hash.js`) make records deterministic and
  tamper-evident.

## Extension seams

These sponsor technologies are **defined seams and TODOs, not implemented
integrations**:

- **Live feed** — implement `LiveSourceAdapter` against a real public source
  (see `src/adapters/source/LiveSourceAdapter.todo.ts` and `.env.example`).
- **Nemotron / vLLM** — implement `Researcher`, `Writer`, and/or
  `RubricEvaluator` against an OpenAI-compatible vLLM endpoint serving Nemotron.
  The evaluator should be a _separate_ model call from the writer.
- **Supabase** — implement `Store` against Supabase, preserving `schemaVersion`.
- **HiddenLayer** — add a scan step that routes ingested source content, prompts,
  writer output, and (future) tool calls/results through the Runtime Security API
  before they cross a boundary. The natural insertion points are: after
  `poll()`/before `research()`, and after `write()`/before `evaluate()`.
- **NemoClaw + OpenShell** — run the heartbeat inside an OpenShell sandbox with a
  YAML policy that permits fixture/data-dir access but blocks unapproved network
  egress and protected paths, enforcing the human publishing gate at the boundary.

See [adr/0001-filesystem-persistence-and-ports.md](adr/0001-filesystem-persistence-and-ports.md)
for the rationale behind the ports-first, filesystem-first approach.
