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
> finished product. The demo runs end-to-end offline on deterministic fixtures;
> a **real live feed** (NOAA NWS alerts) and an **enforced evidence gate** are
> implemented. The writer, researcher, and evaluator in the demo are
> **heuristics**, clearly separated behind interfaces from the production model
> ports (Nemotron/vLLM, Supabase, HiddenLayer). Nothing here claims an
> integration it does not have.

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
npm run check          # format:check + lint + typecheck + test (CI gate)
npm run heartbeat      # single tick; memory compounds across invocations
npm run heartbeat:live # poll real NOAA NWS alerts (network; see "Live data")
npm run gate           # evaluate the evidence gates for the STAAR worked example
npm run build          # compile TypeScript to dist/
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

**Runtime evidence gate:** every heartbeat run is gated by the
[evidence gates](docs/evidence-gates.md). The run evaluates its domain's
evidence, persists the auditable decision record under `data/*/decisions/`,
and only produces writing when the domain has earned at least **prototype**
permission. Observing — polling and snapshotting — is always allowed; writing
must be earned. The demo domain (`tx-civic-memo`) passes at YELLOW/prototype;
the live-alerts domain (`nws-alerts-tx`) is AMBER/investigate, so a default
live run **watches real data and refuses to write**, saying exactly what
evidence is missing.

**The loop:** heartbeat wakes → poll live source → capture provenance snapshot →
research (claims, novelty, uncertainty) → write (applying retrieved lessons) →
deterministic validators → independent rubric evaluator → extract reusable
lessons → integrate into memory (dedup, reinforce, promote) → next cycle applies
the learning.

## Proof the loop works: the STAAR engine-builder run

To prove the recursive-improvement claim beyond fixtures, we ran a companion
experiment on real state-scored data: 117 officially scored STAAR grades 3–5
essays, split by year, and an autonomous loop in which **a fresh AI with no
memory builds and improves an essay-scoring engine run by run** — a referee
(pure code + frozen human labels) keeps or rejects every change on the
worst case of a bootstrapped confidence interval, and a locked 2025 holdout
is scored exactly once at the end.

```mermaid
flowchart TD
    RAW([Raw data: 117 state-scored essays + ONE task file]) --> SPLIT[Split by year - never mixed]
    SPLIT --> T["2023 TRAIN (textbook)<br/>essays + scores + state reasoning"]
    SPLIT --> DV["2024 DEV (practice test)<br/>essays only - referee holds answers"]
    SPLIT --> HO["2025 HOLDOUT (final exam)<br/>locked until the very end"]
    T --> A
    subgraph LOOP["THE LOOP - no human inside"]
        A["Fresh AI builder<br/>reads task + journal + last mistakes"] --> B["ONE focused engine change"]
        B --> C["Referee scores it on dev"]
        C --> Q{"Worst-case score improved?"}
        Q -- yes --> K[KEEP]
        Q -- no --> X["DISCARD change,<br/>keep the journal"]
        K --> A
        X --> A
    end
    LOOP -->|budget spent| F["FINAL EXAM: holdout, scored once"]
```

Result of the first live run (2026-07-18, three iterations): the loop built a
working engine (dev QWK 0.784), **caught and rejected its own overfit idea**
(train 0.929 → dev regression), then shipped a variance fix — and the
untouched 2025 holdout scored **total QWK 0.880, CI lower bound 0.791**,
clearing the operational 0.70 bar with no dev-over-holdout gap. The lab
harness is local-only (the corpus reproduces TEA-copyrighted passages and is
not redistributed); its design — frozen holdout, CI-lower-bound gating,
diagnostic objects, journal that survives discards — is the same
evidence-gate discipline this repository enforces at runtime.

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
- **Testing:** Vitest suites at every module seam (`npm test`)
- **Tooling:** ESLint + Prettier, GitHub Actions CI
- **Persistence:** filesystem JSON under a gitignored `data/` directory, with
  versioned domain records (Supabase is a defined-but-unimplemented port)
- **Zero required services:** the demo and benchmark run with no API keys

## Live data (NOAA NWS alerts)

`npm run heartbeat:live` polls the real National Weather Service active-alerts
API (`https://api.weather.gov/alerts/active?area=TX` — free, keyless,
US-government public domain; a User-Agent header is mandatory and sent by
default). The feed state maps onto one event stream whose severity-count
metrics update between polls; unchanged state polls as "nothing new" and the
heartbeat idles honestly. Network failures surface as visible errors — never
fabricated events.

```bash
npm run heartbeat:live                              # observe live data; gate REFUSES writing (AMBER domain)
GATE_DOMAIN=tx-civic-memo npm run heartbeat:live    # operator override: write memos from live alerts
```

Env vars (all optional): `NWS_AREA` (default `TX`), `LIVE_FEED_URL` (full
override), `LIVE_USER_AGENT`, `HEARTBEAT_TICKS`, `HEARTBEAT_INTERVAL_MS`
(default 30000 live), `GATE_DOMAIN`. The demo and benchmark never touch the
network.

## Deferred integrations (TODO)

Sponsor technologies beyond the live feed are **documented extension seams and
TODOs**, not claimed integrations
(see [docs/architecture.md](docs/architecture.md#extension-seams)):

- **Nemotron / vLLM** — one OpenAI-compatible adapter backing the
  `Researcher`/`Writer`/`RubricEvaluator` ports; works against a self-hosted
  vLLM endpoint on a GPU box (Brev) or a hosted OpenAI-compatible endpoint —
  a base-URL swap, nothing else. The evaluator must be a separate model call
  from the writer. Serving reference:
  [docs/references/vllm-quickstart.md](docs/references/vllm-quickstart.md).
- **HiddenLayer** — runtime scans at the documented boundaries: ingested feed
  content (after `poll()`, before `research()`), and prompts/outputs (around
  `write()`/`evaluate()`).
- **Supabase** — a `Store` implementation preserving `schemaVersion`.
- **NemoClaw / OpenShell** — run the heartbeat inside a sandbox whose YAML
  policy enforces the human publishing gate at the boundary.

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
writer/researcher/evaluator are heuristics; the default demo feed is a fixture
replay (a real NWS live feed is available via `heartbeat:live`); and the
production model/persistence/security ports are defined but not implemented.
Publishing is intentionally **human-gated** — nothing auto-publishes.

## Repository layout

```
src/
  domain/      versioned record types + canonicalization + evidence-gate types
  ports/       interfaces (the replaceable seams)
  adapters/    source (fixture + live NWS), researcher, writer, validators, evaluator, store, evidence gate
  core/        provenance, lesson extractor, lesson memory, pipeline, heartbeat, engine wiring
  benchmark/   frozen benchmark fixture + runner
  fixtures/    deterministic demo feed + writing tasks + domain evidence
  cli/         demo, benchmark, heartbeat, gate entry points
tests/         Vitest suites at each seam
docs/          architecture, provenance, limitations, ADRs, submission checklist,
               and the preserved organizer capture + planning docs (docs/organizer/)
```

## Documentation

- [CONTEXT.md](CONTEXT.md) — resolved domain glossary
- [docs/architecture.md](docs/architecture.md) — design, seams, diagram, ports
- [docs/evidence-gates.md](docs/evidence-gates.md) — evidence gates: how the system decides, after source discovery, whether a writing-assessment domain is worth pursuing and at what permission level
- [docs/dataset-provenance.md](docs/dataset-provenance.md) — data sources & licensing
- [docs/known-limitations.md](docs/known-limitations.md) — limitations & next steps
- [docs/submission-checklist.md](docs/submission-checklist.md) — hackathon submission checklist
- [docs/adr/](docs/adr/) — architecture decision records
- [docs/references/vllm-quickstart.md](docs/references/vllm-quickstart.md) — vLLM serving reference (point-in-time, from slides)
- [docs/organizer/](docs/organizer/) — preserved organizer source-of-truth and planning docs

## License

[MIT](LICENSE) © 2026 supe-log
