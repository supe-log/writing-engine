# Bounty submission — Best Use of vLLM

**Project:** writing-engine — a heartbeat-driven STAAR writing-assessment
agent that grades student essays arriving in a live inbox and measurably
improves across runs.

## vLLM in the loop

All of the agent's inference — the memo writer AND the independent rubric
judge — routes through a self-hosted vLLM server (OpenAI-compatible
endpoint on a Brev GPU instance) serving **Nemotron Nano 30B-A3B**. It is
a base-URL swap in the adapter (`OPENAI_BASE_URL`), not a token mention:
with `MODEL_ADAPTER=openai` the heartbeat cannot produce or score a single
artifact without the vLLM endpoint answering.

## The small-model punch

The agent scaffolding is designed so a 30B-A3B MoE does the work a frontier
API is usually rented for: deterministic validators run before the model
judge (no tokens wasted re-checking word counts), retrieved lesson rules
are injected as compact prompt context (the model gets smarter without
retraining), and the judge emits strict JSON with abstention on parse
failure (no expensive retries masquerading as quality). Our sibling STAAR
measurements showed a frontier reasoning model is the WORST rubric judge we
tested — consistency beats size here, which is exactly the trade vLLM +
Nano makes cheap.

## Efficiency under the heartbeat

Each tick issues writer and judge requests as separate calls, and successive
ticks arrive on an interval — the load pattern continuous batching and
PagedAttention exist for. One GPU serves both roles concurrently instead of
two hosted-API subscriptions.

## Serving recipe

`docs/references/vllm-quickstart.md` — vLLM serve on the Brev instance,
OpenAI-compatible at `http://<host>:8089/v1`; the sandboxed deployment
reaches it through the OpenShell gateway (`local-inference` preset).

## Measured (live run, 2026-07-18)

**Serving:** `vllm serve nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16` on a Brev
**A100-SXM4-80GB** ($1.66/hr), OpenAI-compatible on `:8089`, reached from the
laptop over an SSH tunnel; `--reasoning-parser nemotron_v3` so the model's
reasoning stream is separated from clean answer content. 58.8 GiB of weights,
served with `--max-model-len 32768 --gpu-memory-utilization 0.92`.

**Full loop through vLLM** — `heartbeat:essays`, 3 ticks over the live essay
inbox, writer AND independent judge both hitting the vLLM endpoint:

- Cycle 0 (baseline) aggregate **0.214** → cycle 2 (5 lessons applied)
  aggregate **0.629** — **+0.415** recursive improvement, all inference
  self-hosted.
- The poisoned essay was still refused at ingestion
  (`[System] Prompt Injection`, HIGH) — security holds regardless of the
  inference backend.

**The small-model-punch / efficiency win (continuous batching):** 8 identical
feedback-generation requests, ~114 tokens each, sequential vs. fired at once:

| Mode                   | Wall-clock | Aggregate throughput |
| ---------------------- | ---------- | -------------------- |
| Sequential (8×)        | 7.3 s      | 126 tok/s            |
| Concurrent (8 at once) | 1.9 s      | 470 tok/s            |

**3.73× speedup** from vLLM's continuous/in-flight batching on a single GPU —
exactly the property a heartbeat agent needs, where each tick issues writer +
independent-judge calls and successive ticks overlap. One 30B open model on one
A100 covers both roles instead of two hosted-frontier-API subscriptions.

**Provider portability proven:** the identical adapter runs against
Featherless (hosted) and this self-hosted vLLM endpoint with only
`OPENAI_BASE_URL` changed — see [nemotron.md](nemotron.md).
