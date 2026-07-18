# TASK: Build a {{ASSESSMENT}} assessment engine

You are one iteration of an autonomous improvement loop. There is no human in
the loop. Your job each iteration: make the engine measurably better on the
dev set, guided by the diagnostics from the previous iteration.

## The goal (checkable)

Build an engine that scores {{ASSESSMENT}} responses on the official traits:

{{TRAITS}}
<!-- one line per trait: `name` — description, integer min–max -->

Deterministic rules (enforce in CODE, never via a model):
{{RULES}}
<!-- e.g. "if dev_org is 0, conventions MUST be 0" -->

**Definition of done:** on the dev set, bootstrap 95% CI _lower bounds_ must
clear: total ≥ {{DONE_BAR}}, every trait ≥ its floor (see traits.json), and
the lowest-score class recall ≥ its floor — all after the minimum iteration
count. Until then, every iteration must beat the current best kept lower
bound (without regressing lowest-score recall) or it is discarded.

## The engine contract (hard requirement)

`engine/run.sh <input.jsonl> <output.jsonl>` — reads response records and
writes ONE JSON line per input: `{"essay_id": "...", {{TRAIT_FIELDS}}}`.
Emit a line for every input even if an internal call fails (retry, then fall
back to your best heuristic — a missing row scores worse than a weak guess).
The harness runs your engine with a timeout.

## Your materials

- `data/train.jsonl` — scored examples WITH the raters' written rationales.
  This is your ground truth: the rationales state exactly WHY each score was
  given. Study the lowest-score exemplars especially — every measured run so
  far shows they are the hardest and least transferable class.
- `data/dev-responses.jsonl` — unscored responses. The harness scores your
  predictions after your turn ends.
- `feedback/latest_diagnostics.json` — per-response diagnostics from the
  previous iteration ({kind, path, message, repairHint}). Read this FIRST.
- `experiments.jsonl` — the run log. Do not re-try an approach it falsified.
- `notes/learnings.md` — the journal (survives discarded iterations).
- API keys are in `../.env`; your engine/run.sh must self-source it when the
  variable is unset.

## Rules (violations invalidate the run)

1. NEVER read, list, or reference anything outside this workspace except
   `../.env` — especially any `*secret*` path. An engine that memorizes dev
   answers is exposed by the final holdout and voids the experiment.
2. Do not modify `data/`, `feedback/`, `experiments.jsonl`, `traits.json`,
   or `task.md`. You own `engine/` and `notes/` only.
3. Keep per-iteration cost modest (1–2 API calls per response).
4. Update `notes/learnings.md` every iteration: what you changed, why, what
   you predict. Future iterations (you, with no memory) depend on it.

## Iteration protocol

1. Read diagnostics, the experiments log tail, and the journal.
2. Decide ONE primary improvement you can attribute the metric delta to.
   Prefer changes that generalize (structural rules, self-consistency,
   variance reduction) over tuning against specific train examples — a
   train-overfit prompt was the first discarded change in the reference runs.
3. Implement in `engine/`. Test on 2–3 train rows (you have their gold)
   before ending — never hand the harness a crashing engine.
4. Update the journal, end your turn. The harness scores dev and keeps or
   reverts your change.
