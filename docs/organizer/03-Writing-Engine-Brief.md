# Writing Engine

## One-Line Pitch

A heartbeat-driven writing agent that turns live public information into timely, source-grounded writing and measurably improves its output through persistent evaluation memory.

## Track Fit

### Primary: Recursive Intelligence

The engine has a fixed task, explicit evaluator, persistent run history, and a learning mechanism. Each cycle stores evidence about what worked, compresses useful lessons into a reusable playbook, and applies those lessons to the next run. The demo shows a quantitative and qualitative delta between the baseline and later runs without retraining the model.

### Secondary: Red Hat Live Data

The heartbeat watches an open feed and initiates work when new information becomes relevant. Freshness must change the output, so the agent should identify what is new, compare it with prior state, and decide whether a new draft is warranted rather than merely summarizing a static dataset.

### Commercialization

The first customer is a high-output operator, research team, or subject-matter expert who needs frequent, credible writing but cannot repeatedly perform source discovery, synthesis, drafting, evaluation, and revision by hand.

## Core Demo

1. A heartbeat wakes the agent and checks a live public feed.
2. The agent selects a noteworthy update and stores the source snapshot.
3. A researcher extracts claims, evidence, novelty, and uncertainty.
4. The writer generates a draft for a defined audience and format.
5. Independent evaluators score the draft against a frozen rubric.
6. The system stores the scores, critique, failure tags, and a compressed lesson.
7. The writer runs again using only approved lessons retrieved from prior cycles.
8. The dashboard shows the baseline, latest draft, score delta, and the exact learned rule that caused the improvement.

## Recommended Narrow Use Case

Build a public-data-to-insight engine for education operators. It can watch one authoritative education or civic dataset, detect a meaningful change, and produce a concise decision memo or public explainer with citations.

This scope connects the open-data track to an audience and problem Logan already understands. It also makes factuality and usefulness easier to evaluate than unconstrained social-media writing.

If a reliable education feed is unavailable, use a frequently updating Texas civic feed such as weather, fire, or transit while keeping the same architecture.

## Learning Loop

### State

- Source snapshot and retrieval time
- Writing task and target audience
- Prompt, model, and rubric versions
- Generated artifact
- Deterministic validation results
- Evaluator scores and critique
- Human preference or approval signal
- Extracted lesson and confidence
- Benchmark score history

### Evaluate

Score dimensions independently so one strong trait does not hide another:

- Source fidelity: every factual claim is supported
- Insight: identifies a non-obvious implication
- Audience usefulness: enables a concrete decision or action
- Structure: clear premise, progression, and conclusion
- Style: concise, specific, and free of generic AI phrasing
- Freshness: explains what changed and why now
- Safety: no prompt injection, secret leakage, or unsupported publication

Use deterministic checks before model judgment: URL presence, citation coverage, word count, duplicate passages, missing sections, stale timestamps, and malformed records.

### Learn

After each evaluated run:

1. Identify the smallest reusable lesson supported by the critique.
2. Reject lessons that merely overfit one example.
3. Store the lesson with evidence, confidence, scope, and rubric version.
4. Retrieve only lessons relevant to the next task.
5. Promote a lesson to the durable playbook only after repeated wins.
6. Retire lessons when they stop improving the frozen benchmark.

### Prove Improvement

- Freeze a benchmark before optimization.
- Record a baseline across all benchmark tasks.
- Run multiple learning cycles without changing the benchmark.
- Report mean score, per-dimension score, failure rate, and latency.
- Show at least one held-out task to reduce the appearance of prompt overfitting.
- Preserve all run artifacts so the result is inspectable.

## Architecture

```text
Heartbeat Scheduler
        |
        v
Live Feed Monitor --> Source Snapshot / Provenance
        |                       |
        v                       v
Researcher --> Evidence Pack --> Writer
                                  |
                                  v
                    Deterministic Validators
                                  |
                                  v
                     Independent Evaluators
                                  |
                   +--------------+-------------+
                   |                            |
                   v                            v
             Run History                 Lesson Extractor
                   |                            |
                   +----------> Memory <--------+
                                  |
                                  v
                         Next Writing Cycle
```

## Separation of Concerns

- Live sources are truth; persistent memory is context, not verification.
- Research, writing, scoring, and feedback generation are separate stages.
- The writer never edits evaluator scores.
- Security scanning sits outside the writing rubric.
- Publishing requires explicit human approval.
- Provider failures and abstentions are visible and never converted into fake zero scores.

## Sponsor Technology Strategy

Choose the smallest stack that creates a coherent story:

- Nemotron: central writer or evaluator
- vLLM: OpenAI-compatible serving for the selected open model
- Supabase: persistent run, rubric, source, and lesson history
- Apify: live-feed ingestion when a direct feed is inconvenient
- HiddenLayer: scan source content, prompts, outputs, tool calls, and tool results
- NemoClaw + OpenShell: contain the autonomous loop with explicit network and file policies

The strongest sponsor narrative is not “we called every API.” It is “the agent is powerful enough to need containment, persistent enough to learn, and measurable enough to prove the learning.”

## UI

Build one screen with:

- Current heartbeat status
- Latest source event and freshness
- Baseline and latest writing artifacts
- Rubric scorecard with delta
- Learned rules used in the latest run
- Run timeline
- Approve, reject, or rerun controls

## Scope Cuts

- Do not support many content formats; choose one.
- Do not ingest many feeds; choose one reliable source.
- Do not auto-publish during the hackathon.
- Do not build a general-purpose knowledge graph unless the demo needs it.
- Do not claim learning from prompt edits performed manually outside the system.
- Do not optimize the UI before the complete loop works.

## Reusable Precedents

- STAAR ECR Grading Engine: frozen scored corpus, split-trait evaluation, deterministic orchestration, benchmark reporting, abstention, and explicit provider-error handling
- Comms Operating System: durable context separated from live source validation
- X Growth Workflow: automated drafting with a deliberate human publishing gate
- OpenData Lunch & Learn: public-data products with clear provenance and sensitive-data boundaries
- Good AI Design: inspectable, reversible memory and explicit forgetting

## Thirty-Second Pitch

Writing agents usually repeat the same mistakes because every prompt starts from scratch. Writing Engine watches live public data, creates a source-grounded insight, grades itself against a fixed rubric, and stores only the lessons that measurably improve future work. In the demo, the same engine goes from a weak baseline to a stronger, more useful piece across successive heartbeat cycles, with every source, score, and learned rule visible.
