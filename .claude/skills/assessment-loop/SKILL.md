---
name: assessment-loop
description: Build a writing assessment engine from a rubric + scored examples via an autonomous improvement loop with a frozen holdout. Use when the user wants to create, evaluate, or improve an automated scorer for essays or constructed responses ("build a grader for X", "create a writing assessment engine", "score essays against my rubric").
---

# assessment-loop — autonomous engine-builder

You are the HARNESS. Fresh subagents are the BUILDERS. The verifier is pure
code plus the user's frozen human labels — never an LLM judging an LLM. This
flow produced, on real state-scored data: STAAR 3–5 holdout total QWK 0.880
[CI-LB 0.791] in 3 iterations, and a 6–8 transfer whose premature stop the
holdout caught — the multi-floor rules below encode both lessons.

## Stage 1 — Collect the minimums (interview the user)

1. **Scored examples covering EVERY score point**, ideally with the raters'
   written rationales (the single biggest quality lever — engines built from
   rationale-rich data started at ~0.78 QWK; expect materially worse without).
2. **The rubric** (analytic, per-score descriptors) + trait names/ranges.
3. **Deterministic rules** stated as rules (e.g. cascades) — enforced in code.
4. **Volume check:** ≥ ~40 examples per split; below that, warn that CI
   half-widths exceed ~0.1 and gate decisions are provisional.
5. If the data is in PDFs (scoring guides), run the ingestion fan-out first:
   one extractor subagent per document, transcribing responses VERBATIM
   (spelling errors are load-bearing for conventions-type traits), cross-
   checked against error words quoted in the rationales; per-row
   `transcription_quality` field; set aside non-scorable/condition-code
   exemplars separately.

## Stage 2 — Scaffold (OUTSIDE any git repo the builders shouldn't see)

```
<lab>/                    # e.g. ~/assessment-labs/<name>/
  harness/eval.py         # copy from templates/
  loop.sh                 # copy from templates/
  prepare_data.py         # copy from templates/
  .env                    # ONLY the API key(s) the engine needs
  workspace/
    task.md               # from templates/task-template.md, placeholders filled
    traits.json           # traits, ranges, floors, cascade, zero class
    data/                 # written by prepare_data.py
<lab>-secret/             # sibling — dev gold + holdout; NEVER in workspace
```

Split with `prepare_data.py --group-field <time-or-family> ...` — grouped
splits only (train = oldest, holdout = newest; a holdout that postdates the
judge models' training cutoffs is immune to pretraining contamination).
**Leak audit before the first run:** grep the PUBLIC dev file for anything
that reconstructs gold — score digits embedded in ids, label fields.
(Measured incident: `sp0` inside essay ids and a `response_label` field both
leaked gold; prepare_data's salted opaque ids close this, but new corpora
bring new fields.)

## Stage 3 — Drive the loop (you are the harness)

Per iteration: (1) chmod-lock the secret dir; (2) spawn a FRESH builder
subagent (Agent tool, no memory of prior iterations) whose prompt says: read
task.md, follow the iteration protocol, hard rules about the secret path;
(3) unlock, run `engine/run.sh` on dev with a timeout; (4) score with
`eval.py --config workspace/traits.json`; (5) KEEP only if total CI-LB
improves AND lowest-score recall does not regress (git tag `best`; on
discard, preserve experiments.jsonl + diagnostics + notes/learnings.md — the
journal must survive or falsified ideas get retried); (6) audit the builder's
transcript for secret-path references — any hit voids the iteration.

**Stop only when ALL hold** (the 6–8 run proved total-only stops are refuted
by holdouts): iteration ≥ min_iters, total LB ≥ target, every trait LB ≥ its
floor, zero-class recall ≥ its floor. Optionally confirm with one repeat run
before believing the stop. Otherwise run to the iteration budget.

`loop.sh` implements exactly this for unattended runs (`claude -p` builders);
when you drive it interactively, follow the same steps with Agent-tool
builders and report each verdict to the user as it lands.

## Stage 4 — The final exam (once)

Score the holdout exactly ONCE with the best kept engine; write RESULTS.md
with: the per-iteration table, holdout numbers with CIs, dev-vs-holdout gap
(a large gap = the loop memorized dev — say so), zero-class recall/precision,
and honest limitations. The holdout is then SPENT for this engine lineage;
a new generation needs fresh data.

## Integrity rules (non-negotiable)

- Secret dir outside the workspace, chmod-locked during builder turns
  (a tripwire, not a sandbox — containerize builders for hardening).
- Claim only the holdout number, with its CI lower bound, never the point.
- Never let a builder run the dev eval or read gold; diagnostics are the
  only channel (they leak dev gold one miss at a time by design — dev is
  burnable, the holdout is the claim).
- Report every kept AND discarded iteration; discards are results too.
