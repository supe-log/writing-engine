# Writing Engine

A heartbeat-driven writing agent that turns live public information into timely,
source-grounded writing, evaluates its own work against a frozen rubric, keeps
only the lessons that measurably improve future work, and demonstrates a
baseline-to-latest improvement across successive runs — without retraining a
model.

- **Primary track:** Recursive Intelligence (measurable self-improvement across runs)
- **Secondary fit:** Red Hat Live Data (heartbeat consumes an updating feed; freshness changes the output)
- **Built for:** AITX Community x NVIDIA Claw Agent Hackathon (July 17–19, 2026)

> This repository is a **runnable scaffold with deep module seams**, not a fake
> finished product. The demo runs end-to-end offline on deterministic fixtures.
> The writer, researcher, and evaluator in the demo are **heuristics**, clearly
> separated behind interfaces from the production model ports (Nemotron/vLLM,
> Supabase, a live feed, HiddenLayer). Nothing here claims an integration it does
> not have.

---

## Why it matters

Writing agents repeat the same mistakes because every prompt starts from scratch.
Writing Engine watches live public data, produces a source-grounded decision
memo, grades itself against a fixed rubric, and stores only the lessons that
demonstrably raise the score. In the demo, the same engine goes from a weak
baseline to a stronger, more useful piece across heartbeat cycles, with every
source, score, and learned rule visible and inspectable.

## Quick start

Requires Node.js 20+ and npm. No API keys are needed for the demo or benchmark.

```bash
npm install
npm run demo         # end-to-end heartbeat on deterministic fixtures
npm run benchmark    # frozen benchmark: per-dimension + aggregate delta
npm test             # unit + integration tests at the module seams
```

Other scripts:

```bash
npm run check        # format:check + lint + typecheck + test (CI gate)
npm run heartbeat    # single tick; memory compounds across invocations
npm run build        # compile TypeScript to dist/
```

## What the demo shows

`npm run demo` runs the heartbeat for three ticks over a simulated Texas civic
feed whose metrics update between polls, then prints the improvement:

```
Baseline aggregate: 0.357
Latest aggregate:   1.000
Aggregate delta:    +0.643

Per-dimension:
  sourceFidelity       0.000 -> 1.000  (+1.000)
  insight              0.000 -> 1.000  (+1.000)
  audienceUsefulness   0.000 -> 1.000  (+1.000)
  structure            0.500 -> 1.000  (+0.500)
  style                0.500 -> 1.000  (+0.500)
  freshness            0.500 -> 1.000  (+0.500)
  safety               1.000 -> 1.000  (+0.000)
```

It also prints the exact learned rules that caused the improvement (e.g. _"Cite
the source URL inline for every factual claim"_), whether each was promoted to
the durable playbook, and the full baseline vs. latest artifacts.

**The loop:** heartbeat wakes → poll live source → capture provenance snapshot →
research (claims, novelty, uncertainty) → write (applying retrieved lessons) →
deterministic validators → independent rubric evaluator → extract reusable
lessons → integrate into memory (dedup, reinforce, promote) → next cycle applies
the learning.

## Architecture

```text
           Heartbeat Scheduler (time/state driven)
                        |
                        v
   Live Source Adapter  --->  Snapshot / Provenance  (live source is truth)
                        |               |
                        v               v
                   Researcher  --->  Evidence Pack  --->  Writer  <--- Memory (context)
                                                            |              ^
                                                            v              |
                                              Deterministic Validators     |
                                                            |              |
                                                            v              |
                                              Independent Rubric Evaluator |
                                                            |              |
                                        +-------------------+----------+   |
                                        |                              |   |
                                        v                              v   |
                                   Run History                 Lesson Extractor
                                        |                              |
                                        +---------> Store <------------+
                                       (versioned JSON; Supabase-ready port)
```

Every box is a **port** (interface) in `src/ports/`. The scaffold ships a
deterministic offline implementation of each in `src/adapters/` and `src/core/`.
See [docs/architecture.md](docs/architecture.md) for the full design, the seam
table, and the demo-heuristic-vs-production-model distinction.

## Tech stack

- **Language/runtime:** TypeScript (strict) on Node.js 20, ESM, npm
- **Testing:** Vitest (27 tests at the module seams)
- **Tooling:** ESLint + Prettier, GitHub Actions CI
- **Persistence:** filesystem JSON under a gitignored `data/` directory, with
  versioned domain records (Supabase is a defined-but-unimplemented port)
- **Zero required services:** the demo and benchmark run with no API keys

Sponsor technologies (Nemotron, vLLM, Supabase, HiddenLayer, NemoClaw/OpenShell)
are present as **documented extension seams and TODOs**, not claimed
integrations. See [docs/architecture.md](docs/architecture.md#extension-seams).
A hackathon technical reference for the vLLM serving path (derived from
presentation slides; point-in-time) is at
[docs/references/vllm-quickstart.md](docs/references/vllm-quickstart.md).

## Reproducing the demo

- `npm run demo` is fully deterministic (fixed clock + fixed fixtures), so output
  is byte-for-byte reproducible.
- No environment variables are required. Copy [.env.example](.env.example) to
  `.env` only when wiring a production port; the placeholders map to the ports in
  `src/ports/`.
- Persisted run artifacts, snapshots, evaluations, and lessons are written under
  `data/` (gitignored) and regenerated on every run.

## Datasets / synthetic data

The demo and benchmark use **synthetic fixtures** modeling a Texas civic
open-data feed. Provenance, licensing, and the path to a real live feed are
documented in [docs/dataset-provenance.md](docs/dataset-provenance.md).

## Known limitations & next steps

See [docs/known-limitations.md](docs/known-limitations.md). In short: the demo
writer/researcher/evaluator are heuristics; the "live" feed is a fixture replay;
and the production model/persistence/security ports are defined but not
implemented. Publishing is intentionally **human-gated** — nothing auto-publishes.

## Repository layout

```
src/
  domain/      versioned record types + canonicalization
  ports/       interfaces (the replaceable seams)
  adapters/    offline implementations: source, researcher, writer, validators, evaluator, store
  core/        provenance, lesson extractor, lesson memory, pipeline, heartbeat, engine wiring
  benchmark/   frozen benchmark fixture + runner
  fixtures/    deterministic demo feed + writing task
  cli/         demo, benchmark, heartbeat entry points
tests/         Vitest suites at each seam
docs/          architecture, provenance, limitations, ADRs, submission checklist,
               and the preserved organizer capture + planning docs (docs/organizer/)
```

## Documentation

- [CONTEXT.md](CONTEXT.md) — resolved domain glossary
- [docs/architecture.md](docs/architecture.md) — design, seams, diagram, ports
- [docs/dataset-provenance.md](docs/dataset-provenance.md) — data sources & licensing
- [docs/known-limitations.md](docs/known-limitations.md) — limitations & next steps
- [docs/submission-checklist.md](docs/submission-checklist.md) — hackathon submission checklist
- [docs/adr/](docs/adr/) — architecture decision records
- [docs/references/vllm-quickstart.md](docs/references/vllm-quickstart.md) — vLLM serving reference (point-in-time, from slides)
- [docs/organizer/](docs/organizer/) — preserved organizer source-of-truth and planning docs

## License

[MIT](LICENSE) © 2026 supe-log
