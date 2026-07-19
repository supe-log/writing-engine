# Backtest — real STAAR grades 3–5 ECR, full live stack

Run 2026-07-18 against **3 officially-scored TEA sample responses** (public
scoring-guide items), through the entire live sponsor stack: Nemotron 3 Nano
30B-A3B served on a self-hosted **vLLM** endpoint (Brev A100), every prompt and
output scanned per request by **HiddenLayer**, the whole thing driven by the
heartbeat loop with lesson memory.

Each essay was dropped into the live submission inbox with the real assignment
prompt and the verbatim student response (transcription artifacts and all).
Nemotron wrote teacher feedback and, in the same memo, proposed the two STAAR
trait scores. We then compared those to the official TEA scores — data the
model never saw.

## Result: trait-score agreement

| Essay (grade, genre)         | Official dev-org / conv | Nemotron suggested | Match                   |
| ---------------------------- | ----------------------- | ------------------ | ----------------------- |
| gold-zero (g3 argumentative) | **0 / 0**               | 2 / 1              | dev **+2**, conv **+1** |
| mid (g3 informational)       | **2 / 1**               | 2 / 1              | **exact / exact**       |
| top (g3 informational)       | **3 / 2**               | 3 / 2              | **exact / exact**       |

On the two genuine scoreable attempts the single-pass model **nailed both
traits exactly**. On the gold-zero it **over-scored by 2 points** — which is
not a random miss, it is the _known, measured_ failure mode of single-pass
rubric scoring: a response that reads like an attempt but has no claim of its
own gets credited for effort it did not earn.

## Why that miss is the whole point (how the two engines differ)

This project (`writing-engine`) and the STAAR grading engine
(`mw_hole_filling`) are **different tools doing different jobs**:

- **`writing-engine`** (this repo) is an _agentic writing loop_: a heartbeat
  ingests a live essay, a model writes teacher-facing feedback, an independent
  model judge scores that feedback, and lessons compound across runs — all
  wrapped in the sponsor stack (vLLM/Nemotron inference, per-request
  HiddenLayer security, an OpenShell publishing gate). It optimizes for a
  **usable teacher workflow** and the hackathon tracks.
- **`mw_hole_filling`** is a _measurement engine_: it predicts the official
  STAAR trait scores and reports agreement with human raters as **quadratic
  weighted kappa (QWK)** over a fixed labeled corpus. It optimizes for
  **accuracy against gold**, with a judge-model mix, bootstrap confidence
  intervals, and 3-repeat stability gates.

The backtest above independently **reproduced the exact gap** that engine's
newest component targets. Its measured finding: single-pass judges over-score
gold-zeros; a dedicated **structural zero-gate** (V3.3) that adjudicates only
the 0-vs-1 boundary raised dev-zero recall from **3/42 → 29/42** across three
years and moved every QWK point-estimate up — on a fresh 2022 family it took
gold-zero recall from **0/6 → 6/6** with no false fires. Our single-pass
Nemotron memo giving the gold-zero a 2 is precisely the input that gate exists
to catch.

**So the two connect:** `mw_hole_filling` measures how well STAAR scoring can be
done and produces the trait-score evidence; `writing-engine` consumes that
evidence in its **evidence gate** (the `staar-ecr-g3-5` domain is seeded with
those measured QWK/stability numbers) to decide how much autonomy the writing
agent has earned, and adds the live/security/sandbox machinery that turns a
scorer into a shippable agent. One is the ruler; the other is the product that
respects the ruler.

## Honest caveats

- **Feedback still carries civic-pipeline noise.** The demo `Researcher` is the
  metric-diffing heuristic built for the NOAA/civic feed; on essays it emits
  meaningless "word count grew by +38 since the prior snapshot" novelty lines,
  which leak into the memos. The _grading_ is sound now (the model reads the
  full source text), but a production essay path would swap in an essay-aware
  researcher. Documented seam, not a claim.
- **The judge aggregate (0.243 → 0.729) conflates two things:** lessons
  accumulating AND the essays arriving worst-first. It is not a clean
  learning-only delta — the clean delta is the fixture demo
  (`npm run benchmark`). What this run demonstrates is _trait-score agreement on
  real data_, above.
- **N = 3.** Illustrative, not a QWK claim. The statistically-gated numbers live
  in `mw_hole_filling`.
- HiddenLayer's REDACT masked the `file://` temp paths as `GENERIC_API_KEY`
  inside the memos (visible as `[REDACTED:…]`) — the security layer actively
  transforming prompts mid-loop, exactly as designed.

## Reproduce

```bash
# vLLM serving Nemotron on a GPU box, reachable at $OPENAI_BASE_URL
MODEL_ADAPTER=openai \
WRITER_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16 \
EVALUATOR_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16 \
MODEL_MAX_TOKENS=8192 \
ESSAY_INBOX_DIR=<inbox of ASSIGNMENT+RESPONSE .txt files> \
HEARTBEAT_TICKS=3 \
npm run heartbeat:essays
```

Source essays: TEA official grades 3–5 RLA constructed-response scoring guides
(public domain), 2023–2024.
