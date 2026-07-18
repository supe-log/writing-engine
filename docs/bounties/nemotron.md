# Bounty submission — Best Use of NVIDIA Nemotron

**Project:** writing-engine — a heartbeat-driven STAAR writing-assessment
agent that grades student essays arriving in a live inbox and measurably
improves across runs.

## What Nemotron is doing

Nemotron is both hands of the agent: **Nemotron Nano 30B-A3B** powers the
writer (turns evidence packs + retrieved lessons into teacher-facing
feedback memos) and, as a **separate call with its own client**, the
independent rubric judge that scores each memo across seven dimensions. The
judge never shares a prompt with the writer and abstains — never fakes a
zero — when it cannot parse its own strict-JSON verdict. Every learned
lesson in the engine's persistent memory originates from a Nemotron
judgement, so the recursive-improvement arc the project demonstrates IS
Nemotron output quality, measured run over run.

## Why Nemotron was the right choice

Our sibling STAAR measurement falsified "bigger reasoning model = better
rubric judge" (a frontier reasoning model scored worst of five judges on
real TEA-scored essays). What rubric judging rewards is fast, consistent,
instruction-faithful scoring — exactly the agentic profile Nemotron 3 is
trained for (application traces from open agent harnesses; +50% agentic
task accuracy on Ultra; thinking-budget control on Nano). Nano's 30B-A3B
MoE footprint lets the writer and judge run concurrently on one GPU behind
vLLM, keeping the always-on heartbeat affordable.

## How we maximize it

- **Grounding:** the writer only sees extracted claims with provenance
  URLs and is instructed to cite them; a deterministic validator checks
  citations before the judge ever runs.
- **Quality loop:** judge critiques are distilled into reusable lesson
  rules that are injected into future writer prompts — output quality
  compounds and is plotted first-run vs latest-run.
- **Runtime security:** every Nemotron prompt and completion passes
  through HiddenLayer scanning per request, fail-closed.

## Measured (to fill from the live run before freeze)

- [ ] `heartbeat:essays` cycle results with `WRITER_MODEL`/`EVALUATOR_MODEL`
      = Nemotron Nano on vLLM (aggregate trajectory across ticks)
- [ ] First-run vs last-run delta with lessons applied
- [ ] Abstention rate of the judge (honesty signal)
