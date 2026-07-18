# Hackathon submission checklist

AITX Community x NVIDIA Claw Agent Hackathon (July 17–19, 2026).

## Tracks

- [x] **Primary — Recursive Intelligence:** measurable self-improvement across
      runs. The demo prints a baseline-to-latest aggregate delta and per-dimension
      deltas; the benchmark isolates generalization with a held-out task.
- [x] **Secondary — Red Hat Live Data:** the heartbeat consumes an updating feed
      and freshness genuinely changes the output (revised poll ⇒ "what changed and why
      now"). Claimed only because the freshness is real, not decorative.

## Runnable in one sitting

- [x] `npm install` with no API keys required.
- [x] `npm run demo` — end-to-end heartbeat on deterministic fixtures.
- [x] `npm run benchmark` — per-dimension + aggregate delta, incl. held-out task.
- [x] `npm test` — unit + integration tests at the module seams.
- [x] `npm run check` — format:check + lint + typecheck + test (CI gate).
- [x] Output is byte-for-byte reproducible (fixed clock + frozen fixtures).

## Demonstrates the core claim

- [x] Learning is **visible**: the exact learned rules are printed.
- [x] Learning is **measurable**: baseline vs latest aggregate + per-dimension.
- [x] Learning is **durable**: lessons promote to a playbook after repeated wins
      and persist across `npm run heartbeat` invocations.
- [x] Learning is **not overfit**: a held-out benchmark task the engine never
      learns from still improves.

## Honesty / integrity

- [x] Demo writer, researcher, and evaluator are clearly labeled **heuristics**,
      separated behind ports from the production model versions.
- [x] No sponsor integration is _claimed_; each is a documented seam/TODO
      (Nemotron/vLLM, Supabase, HiddenLayer, NemoClaw/OpenShell, live feed).
- [x] Failures are visible: the evaluator can abstain (`null`, never a fake zero);
      abstained cycles teach nothing.
- [x] Provenance is content-hashed and immutable; live source is truth.

## Security & governance

- [x] Deterministic injection/secret scanning runs **before** any rubric
      judgement; security sits outside the writing rubric as its own dimension +
      documented HiddenLayer seam.
- [x] **Human publishing gate:** no auto-publish path exists anywhere in the code.

## Repository quality

- [x] Public-repo-quality `README.md` (pitch, quick start, architecture, limits).
- [x] `CONTEXT.md` — resolved domain glossary.
- [x] `docs/architecture.md` — design, seam table, diagram, extension seams.
- [x] `docs/dataset-provenance.md` — synthetic data, licensing, path to live feed.
- [x] `docs/known-limitations.md` — limitations paired with closing seams.
- [x] `docs/adr/0001-filesystem-persistence-and-ports.md` — key architectural
      decision.
- [x] Organizer source-of-truth preserved under `docs/organizer/`.
- [x] Strict TypeScript, ESLint + Prettier, GitHub Actions CI, MIT LICENSE,
      `.env.example`, `.gitignore`.

## Before pushing (human review gate)

- [ ] Maintainer has reviewed the scaffold and docs.
- [ ] Create the public GitHub repo `supe-log/writing-engine` and push.
- [ ] Confirm CI passes on GitHub Actions.
- [ ] Add the submission link / demo recording where the organizers require it.
