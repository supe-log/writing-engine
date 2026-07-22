---
name: engine-factory
description: End-to-end factory that takes a user from "I need a grader for X" to a certified writing assessment engine. Interviews the user, acquires data (their files or a web hunt), runs a GO/NO-GO feasibility gate, selects judge models, drives the assessment-loop to build the engine, administers the sealed final exam, and packages the result with an honest report card. Use for "build me a writing assessment engine", "I need to grade essays for <subject/test/language>", or any request to create an automated essay scorer from scratch.
---

# engine-factory — from request to certified engine

You orchestrate six stages. Each stage has a written artifact; never skip a
stage or its artifact. The core loop (stages 4–5) is the proven
`assessment-loop` skill — read `.claude/skills/assessment-loop/SKILL.md`
before stage 4 and follow it exactly; this skill adds everything around it.

Speak plain English to the user throughout: they may be a teacher, not a
developer. Translate every metric the first time it appears (e.g. "QWK =
how well the engine agrees with human graders, where 1.0 is perfect").

## Stage 0 — Interview → `spec.json`

Ask (in one friendly message, not an interrogation):
1. What assessment? (name, subject, grade band, language)
2. What kind of writing? (genre(s): informational, argumentative, narrative…)
3. What does the score look like? (traits, ranges, any deterministic rules
   like "if trait A is 0, trait B is 0")
4. Stakes: classroom feedback, school pilot, or consequential/official use?
   (This sets the certification tier they need.)
5. Do they have scored examples + a rubric already? In what form
   (PDFs, spreadsheets)? If not, do official scoring guides exist publicly?

Write `lab/spec.json`: {task_name, language, grade_band, genres, traits:
[{name, range, floor}], deterministic_rules, stakes_tier, data_sources}.

## Stage 1 — Data acquisition → corpus + provenance

Two paths, in order of preference:
- **Path A (user data):** they upload/point to files. PDFs of scoring
  guides get the extraction fan-out from assessment-loop Stage 1: one
  extractor subagent per document, VERBATIM transcription (student errors
  are load-bearing), cross-checked against error words quoted in rater
  rationales, per-row `transcription_quality`, non-scorable/condition-code
  exemplars set aside as reserved eval data.
- **Path B (web hunt):** WebSearch for official scoring guides / anchor
  papers / released items ("<assessment> scoring guide PDF", the education
  agency's site, state assessment portals). Only official or
  clearly-provenanced sources. Download, then same extraction fan-out.

Non-negotiables:
- `provenance.md`: source URL, publisher, license/copyright note, retrieval
  date for every document. Scored student responses from copyrighted guides
  stay LOCAL — never committed to a public repo, never redistributed.
- `data-audit.json`: per-trait, per-score-point counts; zero/lowest-class
  count; rationale coverage (% of examples with rater explanations);
  grouping fields available for leakage-safe splits (year, prompt family).

## Stage 2 — Feasibility gate → `feasibility-report.md` (GO / DEGRADED / NO-GO)

Score the audit against measured thresholds (these numbers come from real
runs — don't soften them):

| Check | GREEN (full build) | YELLOW (degraded build) | RED (refuse) |
|---|---|---|---|
| Score-point coverage | every point, every trait | one gap at a non-boundary point | boundary points missing |
| Lowest-class (zero) exemplars | ≥ 4 | 2–3 | 0–1 |
| Total scored examples | ≥ 120 (≥ ~40/split) | 60–119 | < 60 |
| Rater rationales | on most examples | sparse | — (YELLOW cap) |
| Leakage-safe grouping | time or prompt-family field exists | — | no grouping possible |
| Holdout reservable | yes, never touched | — | no |

- **GREEN** → full pipeline, certification claims allowed (CI lower bounds).
- **YELLOW** → build proceeds, but the report card must say "provisional":
  wide error bars, mandatory human-review band, no consequential use. Tell
  the user exactly which check capped them and what data would lift it.
- **RED** → do NOT build. Deliver instead a one-page "what to collect"
  plan: how many essays at which score points, that human scores + written
  rationales are needed, and that ~2 rater-hours per 40 essays is typical.
  An unvalidatable engine is worse than no engine — say so.
- Language ≠ English: proceed, but flag "no prior measured evidence in this
  language; judge ladder (stage 3) is mandatory, expect surprises."
- Stakes = consequential requires GREEN + stability repeat + human review at
  graded boundaries. Never certify consequential use from a YELLOW build.

STOP after this stage and show the user the report. They decide to proceed,
supply more data, or stop. This gate is the product's honesty — never blur it.

## Stage 3 — Judge ladder → `judge-selection.md`

Model choice must be measured per trait, per task, per language — never
assumed (measured lesson: the strongest reasoning model was the WORST rubric
judge; two mid-tier models beat both alone by splitting traits).

On TRAIN data only: run 2–4 candidate models once each per trait, score with
`eval.py`, pick the best model per trait (mixes across traits are normal).
Record the table. Budget cap: this stage should cost cents-to-dollars, not
tens.

## Stage 4 — Build loop

Hand off to `assessment-loop` SKILL.md stages 2–3 (scaffold + loop) with the
spec's traits.json and the stage-3 judge mix as the builder's starting
model choices. Apply the gen-4 anti-gaming fixes when configuring the
harness: diagnostics sampled top-k (not exhaustive), published aggregates
rounded to 2 decimals, `out/` cleared between iterations.

Report each iteration's verdict to the user in plain English as it lands
("Round 2: tried X, it made agreement worse on the lowest scores, discarded").

## Stage 5 — Final exam (once)

assessment-loop Stage 4, verbatim: sealed holdout scored exactly once,
RESULTS.md with per-iteration table, holdout CIs, dev-vs-holdout gap,
zero-class recall/precision, limitations. The holdout is then SPENT.

## Stage 6 — Package → `dist/<task_name>/`

Deliver a folder the user can use without understanding any of the above:
- `engine/` — self-contained scorer (`run.sh <input.jsonl> <output.jsonl>`,
  stdlib-only python, the API key the only external need)
- `grade.sh` — single-essay wrapper: `bash grade.sh essay.txt` → trait
  scores + a short rationale, plain text
- `REPORT-CARD.md` — written for a non-technical reader:
  what this engine is certified on (holdout numbers, CI lower bounds,
  translated), where it is weak (the graded middle boundaries, per the
  measured pattern), the **human-review band** (which predictions must go
  to a person: adjudicator-torn calls, boundary scores, suspected zeros),
  data provenance, and the exact sentence they may honestly repeat
  ("On N never-seen essays, this engine agreed with official human raters
  with QWK X.XX; the statistically safe lower bound is X.XX").
- `flywheel/` — empty `reviewed.jsonl` + README: every human-corrected
  essay lands here and funds the next generation's training data. The
  review band is the data engine, not a defect.
- `report-card.json` — machine-readable claims for the writing-engine
  evidence gates (tier RED/YELLOW/GREEN mirrors stage 2 + exam outcome).

## Cost + time honesty

Tell the user upfront: a full build makes real API calls — typically on the
order of a few dollars to a few tens of dollars depending on corpus size and
models (the pipeline prints usage as it goes), and takes roughly 1–3 hours
mostly unattended. The feasibility gate (stages 0–2) is nearly free — run it
before any spend decision.

## Integrity rules (inherited + factory-specific)

- All assessment-loop integrity rules apply verbatim in stages 4–5.
- Never fabricate a feasibility pass, never build on RED, never let
  enthusiasm upgrade YELLOW claims to GREEN language.
- Copyrighted corpora never leave the user's machine.
- The report card states what was NOT tested (other genres, grade bands,
  languages) as plainly as what was.
