# Bounty submission — Best Use of NemoClaw + OpenShell

**Project:** writing-engine — a heartbeat-driven STAAR writing-assessment
agent that grades student essays arriving in a live inbox, learns from its
own evaluations, and measurably improves across runs.

## Why this agent is worth containing

The agent has genuine capability and genuine attack surface: every input is
an untrusted student essay (a document class famous for carrying whatever a
student types, including prompt injections), it holds live credentials for a
security API and an inference endpoint, it maintains persistent lesson
memory, and it writes artifacts that are destined for teachers. A grading
agent that can be talked into leaking its rubric, inflating a score, or
shipping student text to an attacker's server is not hypothetical — our demo
inbox contains exactly that attempt
(`examples/essay-inbox/2026-07-18-recess-b-injection.txt`).

## Blueprint mapping (Bring Your Own Harness)

- **Models:** Nemotron on vLLM through the OpenShell gateway (built-in
  `local-inference` preset); Featherless as a hosted fallback preset.
- **Harness:** the heartbeat loop itself (`npm run heartbeat:essays`) — a
  Node process run inside the sandbox, unmodified.
- **OpenShell:** Restricted-tier baseline (deny-by-default egress, read-only
  filesystem outside `/sandbox`) plus two path-scoped custom presets
  (`deploy/nemoclaw/presets/`).
- **Optimization:** Nemotron Nano 30B-A3B (small-model punch); the
  writer+independent-judge pattern issues concurrent requests that benefit
  from vLLM batching.

## The boundary, and why it holds

The complete allowed egress of the agent is three path-scoped routes:
HiddenLayer token (`POST /oauth2/token`), HiddenLayer interactions
(`POST /detection/v2/interaction-evaluations`), and model inference via the gateway.
Rules are enforced per endpoint + port + method + path + requesting binary,
so even the allowed hosts expose no other surface. Everything else fails at
the gateway and is logged.

Two boundaries reflect real judgment rather than a blunt block:

1. **Allow-with-escalation publishing gate.** The engine's documented
   limitation was "no human approval before external publishing." We did not
   bolt a confirmation prompt onto the agent — the OpenShell operator-approval
   flow IS the gate: any attempt to reach an unlisted endpoint (i.e., any
   publish) is intercepted and surfaced in `openshell term` for a live
   human approve/deny. The gate survives a compromised agent because it does
   not run in the agent.
2. **The agent cannot rewrite its own gates.** The engine enforces
   evidence-gated autonomy in code (`docs/evidence-gates.md`); `/app` is
   read-only in the sandbox, so no injected instruction can edit the gate
   logic, the rubric, or the policy files.

## The design decision OpenShell forced

Defense in depth with distinct failure semantics. HiddenLayer scanning is
our in-band control — it sees content and fails closed per request (a
flagged essay is quarantined as evidence, never written from). OpenShell is
the out-of-band control — it cannot be prompted, so even a fully
compromised model+harness cannot exfiltrate or publish. Deciding which
threats belong to which layer (content threats in-band, reachability
threats in policy) is the architecture; the sandbox made us make it
explicit instead of trusting the agent's system prompt.

Setup, presets, and adversarial probes: `deploy/nemoclaw/README.md`.
