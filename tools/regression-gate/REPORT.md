# Regression-gate campaign — 2026-07-22
## Question: do disagreement-escalation, anchor-placement, and quote-grounding improve accuracy GENERALLY (all grades, both languages) without area-specific tuning?

METHOD. Four families (STAAR en 3-5, en 6-8, es 3-5, HS EOC), dev sets only
(every holdout is SPENT — these are development measurements, not
certification claims). Fresh baseline engine runs for g35/g68; saved
baselines for slar/eoc. Judge B = claude-sonnet-5 (cross-provider,
deliberately generic prompts). Paired bootstrap (10k, same essays) for all
deltas. Caveat: g68's baseline (dev 0.932) carries the documented gen-3
dev-tuning inflation — expect no headroom there by construction.

## Result 1 — disagreement IS a valid uncertainty signal (3 of 4 families)
Engine-exact rate when A and B agree vs disagree:
g68 80%/55% · slar 67%/43% · eoc 50%/19% · g35 53%/46% (no signal).
Judge B alone: QWK 0.70-0.84 per family — credible but never better than
the tuned engine.

## Result 2 — BOTH model-side resolvers FALSIFIED
| family | baseline total | med3 Δ | anchor Δ |
|---|---|---|---|
| g35 | 0.792 | +0.021 ns | +0.029 ns |
| g68 | 0.932 | −0.034 ns | −0.057 ns |
| slar | 0.871 | +0.016 ns | −0.144 ns |
| eoc | 0.759 | −0.092 ns | −0.011 ns |
| POOLED (130) | 0.844 | 0.827 | 0.803 |
No delta CI excludes zero; pooled both NEGATIVE. Failure mechanism, med3:
generic voters OUTVOTE specialist components — EOC zero recall 0.5→0.0
(B and C un-demote the responsiveness adjudicator's zeros). Anchor
placement: buys zero recall (slar 1.0) at precision cost + crushes
dev_org where the base judge was calibrated (slar 0.721→0.556).
LESSON (generalizes): the oracle-escalation analysis promised ~champion
QWK because the oracle was perfect; real model voters are not. Ensembling
a specialized engine with generic judges averages away the specialty.

## Result 3 — the validated CONSUMER of the signal is the human review band
Review-trigger comparison (size, error-catch, precision):
- eoc: disagreement band 62% of essays, catches 72%, precision 81% —
  vs current Ideas-0-2 band 85%/94%/77%. Disagreement reviews 23% fewer
  essays at higher precision.
- g68: disagreement catches 87% of errors vs score-band 53%.
- g35/slar: roughly tied with score band.
RECOMMENDATION: two-tier review in pilots — tier 1 = flagged by BOTH
triggers (must review), tier 2 = either alone. Judge B cost ~1 cheap
call/essay; no engine changes; certifications untouched.

## Result 4 — quote-grounded feedback: ADOPTED (score-neutral, guaranteed property)
EOC dev, fresh control vs quote-variant: score agreement with control =
run-variance level (20/26, same as control-vs-sealed); exact-vs-gold flat
(8/9/8 of 26). Quote coverage 96%→100%. Shipped to shared task-template
(writing-engine main @ a6623e8). Certified engines NOT modified.

## Verdicts
1. Disagreement escalation by model voting: REJECTED (would regress zeros).
2. Anchor placement at graded boundaries: REJECTED as tested; a narrower
   variant (anchors INSIDE the base judge prompt) previously tied (slar
   iter-3, LB 0.7025 vs 0.7045) — the graded middle remains unsolved by
   prompting; route to humans + flywheel data.
3. Disagreement-gated review band: ADOPT in pilots (product change, not
   engine change).
4. Quote-grounded feedback: ADOPTED into shared templates.
5. The regression gate itself (this harness) is now standing:
   families.json + judge_b.py + resolvers.py + paired eval. Any future
   shared-layer change runs through it.

Artifacts: preds/, results/ (disagreement JSONs, paired-eval.json).
Costs: ~350 API calls (~single-digit dollars). All secret dirs relocked.

## Campaign 2 (2026-07-23): gen-2 lesson transfer, side-by-side across families
Question: do the SLAR gen-2 lessons (responsiveness zeros + sentence-boundary
conventions rule) generalize to the English engines? Paired dev evals,
variants built per family, certified engines untouched pending verdicts.

| family | Δ total (paired 95% CI) | zero r/p change | verdict |
|---|---|---|---|
| es 3-5 (anchor: sealed 2025 exam) | −0.001 (tie) | precision 6/8→6/6 | ADOPTED v2.0.0 |
| en 3-5 | −0.012 [−0.043, +0.000] | none (3/6, 3-of-4) | REJECTED |
| en 6-8 | −0.043 [−0.099, −0.004] SIG− | none (4/6, 4-of-4) | REJECTED |
| en HS | not testable (lesson provenance = its own spent exam) | — | deferred |

WHY (the adaptability lesson, measured):
1. en 6-8's gen-3 adjudicator was ALREADY responsiveness-based (its builder
   converged on wrong-task/wrong-mode criteria independently in 2026-07-18's
   run) — nothing to gain; and the sentence-boundary conventions rule HURT
   its already-excellent conventions judge (0.931→0.871): the rule fixes an
   error mode that engine doesn't have.
2. en 3-5's zeros are STRUCTURAL (young writers) and its base judge already
   carries a responsiveness line; the added adjudicator caught nothing new
   (the two hard "near-task claim" zeros remain uncaught by every approach).
3. The lessons transfer as GATED CANDIDATES, not blanket updates. Blind
   adoption would have significantly degraded one certified engine and
   slightly degraded another. Engine specialization per test + shared
   knowledge in the factory + per-family gating = the adaptability model.
