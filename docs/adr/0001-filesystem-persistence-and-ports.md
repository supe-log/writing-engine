# ADR 0001: Filesystem persistence behind ports

- Status: Accepted
- Date: 2026-07-18

## Context

The Writing Engine needs to persist snapshots, evidence, artifacts, evaluations,
run history, and lessons so that memory compounds across heartbeat cycles and
across process invocations. The hackathon brief names Supabase as a target
persistence technology, and the production writer/researcher/evaluator are meant
to be model-served (Nemotron/vLLM).

Two decisions had to be made early because they shape every other module:

1. **What backs persistence in the runnable demo?** A hosted database (Supabase)
   or the local filesystem?
2. **How tightly is the orchestrator coupled to any concrete choice** — of
   persistence, source, or model?

These are hard to reverse cheaply: if the orchestrator reaches directly into a
database client or a model SDK, swapping either later means editing the loop, the
tests, and the benchmark.

## Decision

**Persist to versioned JSON on the local filesystem in the demo, and put every
replaceable concern behind a port (interface).**

- The orchestrator (`runCycle`, `Heartbeat`) depends only on the interfaces in
  `src/ports/index.ts`. It never imports a concrete adapter.
- Wiring happens in exactly one place: `createEngine` in `src/core/engine.ts`.
- The demo `Store` is `FileSystemStore`, which writes one pretty-printed JSON file
  per record under a gitignored `data/` directory, partitioned by kind.
- Every persisted record carries a `schemaVersion` (`src/domain/records.ts`).
- Record ids are content-addressed (`src/core/hash.ts`) so runs are deterministic
  and tamper-evident.

Supabase, a live feed, and the model-served stages remain **defined ports with
documented TODOs**, not implemented integrations.

## Consequences

**Positive**

- The demo and benchmark run offline with no API keys, no services, and
  byte-for-byte reproducible output — the property the Recursive Intelligence
  track is judged on.
- Swapping in Supabase means implementing the `Store` interface and changing one
  line in `createEngine`; the orchestrator, benchmark, and tests are untouched.
  `schemaVersion` is the hook a real migration would key off.
- The same substitution story holds for the source adapter and the model-served
  researcher/writer/evaluator.
- Tests target the seams directly, so they stay valid across the demo→production
  swap.

**Negative / accepted trade-offs**

- Filesystem JSON is not concurrent-safe and not queryable like SQL. That is
  acceptable for a single-process heartbeat demo and is exactly what the Supabase
  port is for.
- A little indirection (ports + a wiring module) is added up front. This is the
  cost that buys the substitution guarantee.

## Alternatives considered

- **Integrate Supabase directly now.** Rejected: it would require credentials to
  run, break offline reproducibility, and couple the loop to a client before the
  integration choice is actually being made.
- **Wire adapters directly into the orchestrator (no ports).** Rejected: makes
  every later swap a change to the loop and its tests — the opposite of the
  "replaceable seam" goal.
