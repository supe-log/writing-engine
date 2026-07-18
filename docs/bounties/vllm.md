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

## Measured (to fill from the live run before freeze)

- [ ] Endpoint + model id, GPU type on Brev
- [ ] Concurrent writer+judge throughput vs sequential (tokens/s, wall-clock
      per tick) — the continuous-batching win
- [ ] Full `heartbeat:essays` demo transcript against the vLLM endpoint
