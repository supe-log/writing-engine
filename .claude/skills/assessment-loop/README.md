# assessment-loop

A Claude Code skill that builds writing assessment engines from a rubric +
scored examples via an autonomous improvement loop: fresh AI builders per
iteration, a pure-code verifier over frozen human labels, CI-lower-bound
keep/discard, and a holdout scored exactly once.

## Evidence (three live runs on real TEA-scored STAAR essays, 2026-07-18)

| Run                                          | Dev total QWK (CI-LB)   | Holdout                     | Outcome                                                                                      |
| -------------------------------------------- | ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| STAAR grades 3–5, 3 iterations               | 0.784 → 0.801           | **0.880 [CI-LB 0.791]** (scored once) | Passed the 0.70 operational bar; iteration 2's train-overfit change was correctly discarded |
| STAAR grades 6–8 transfer, 1 iteration       | 0.821 [LB 0.706]        | 0.798 [CI-LB 0.641] (scored once)     | Holdout refuted a premature total-only stop — now encoded as the multi-floor stop rule      |
| STAAR grades 6–8 gen-2, fixed harness, 3 it. | LB 0.641 → 0.704 → 0.753 | 0.825 [CI-LB 0.708] (2nd exposure — weaker claim) | The new multi-floor stop rule correctly REFUSED to declare done (dev/org trait floor unmet) — and the holdout agreed (dev/org LB 0.568). Zero-recall never regressed under the multi-objective keep. |

Both corpora were extracted from public TEA scoring guides by parallel
agents (verbatim student errors preserved); the corpora themselves are not
redistributed here (they reproduce copyrighted reading passages).

## Why Claude Code as the harness

The loop's builder/harness pattern runs natively on Claude Code (fresh
subagent per iteration, skills as distribution); the alternative considered,
xai-org/grok-build, is a read-only mirror of a proprietary monorepo. The
verifier and data tooling are plain bash+python (`templates/`) and remain
portable regardless of harness.

## Contents

- `SKILL.md` — the flow Claude follows when you invoke `/assessment-loop`
- `templates/eval.py` — generalized verifier (traits.json-driven: per-trait
  QWK + bootstrap CIs, zero-class metrics, diagnostic objects, label-
  uncertainty flags)
- `templates/loop.sh` — unattended driver (multi-floor stop, multi-objective
  keep, journal survives discards, holdout-once finale)
- `templates/prepare_data.py` — grouped leakage-safe splits, salted id
  anonymization, leak-field stripping
- `templates/task-template.md` — the builder's task file

## Honest limitations

- Below ~40 examples per split, QWK CI half-widths exceed ~0.1 — gate
  decisions are provisional (the tool warns).
- The lowest score class is the least transferable skill in every measured
  run. VALIDATED FIX (2026-07-18): a dedicated narrow boundary adjudicator —
  a second call that fires only at the judge's boundary score — took
  lowest-class recall from 3/42 to 29/42 attempts across three STAAR splits
  (including 6/6 with no false fires on a fully fresh 2022 family). The
  pattern is documented in `templates/task-template.md` under "Proven moves".
- The secret-dir lock is a tripwire, not a sandbox — containerize builders
  for adversarial settings.
- Each holdout is single-use per engine lineage.
