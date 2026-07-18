# Tasks

## Critical Path

### Friday Night: Lock the Demo Contract

- [ ] Join the Discord and watch organizer updates
- [ ] Confirm team name, roster, roles, and contact details
- [ ] Choose the primary track: Recursive Intelligence
- [ ] Decide whether live open data is core enough to claim Red Hat Live Data
- [ ] Write one sentence defining the user, painful job, and promised outcome
- [ ] Define the fixed evaluation set and scoring rubric
- [ ] Define the measurable first-run versus last-run improvement claim
- [ ] Pick one live public-data feed and verify that it updates reliably
- [ ] Create the public repository and commit a minimal README
- [ ] Redeem only the sponsor credits needed for the selected architecture

### Saturday Morning: End-to-End Vertical Slice

- [ ] Ingest one live item from the selected public feed
- [ ] Generate one piece of writing from it
- [ ] Score the output with deterministic checks and an evaluator rubric
- [ ] Store the artifact, score, critique, and lesson in persistent state
- [ ] Run a second generation that retrieves and applies the stored lesson
- [ ] Display the run history and score delta
- [ ] Add heartbeat scheduling so the agent can wake without a prompt
- [ ] Keep source retrieval, writing, evaluation, and memory as separate modules

### Saturday Afternoon: Make Improvement Credible

- [ ] Build a frozen benchmark of at least 5–10 writing tasks
- [ ] Record baseline scores before changing prompts or memory
- [ ] Run repeated cycles against the same benchmark
- [ ] Prevent evaluator leakage: do not let the writer see reference answers
- [ ] Add data-quality checks for malformed, duplicated, or stale records
- [ ] Version prompts, rubrics, datasets, and memory updates
- [ ] Add abstention and visible error states for failed sources or models
- [ ] Plot first-run versus latest-run performance
- [ ] Capture one qualitative example showing how a learned rule changed the output

### Saturday Evening: Product and Sponsor Integration

- [ ] Make one real sponsor integration central to the heartbeat loop
- [ ] If using Nemotron, make it the writer or evaluator rather than a side call
- [ ] If using vLLM, demonstrate real inference throughput or small-model utility
- [ ] If using HiddenLayer, scan prompts, outputs, tool calls, tool results, and ingested text
- [ ] If using NemoClaw + OpenShell, define non-trivial file and network policies
- [ ] Add a human approval gate before publishing externally
- [ ] Polish the core user flow and remove non-demo features
- [ ] Draft the 150–300 word submission write-up

### Sunday Before 9:30 AM: Freeze the Story

- [ ] Run the full demo from a clean start
- [ ] Verify the public repository and quick-start commands
- [ ] Add architecture diagram
- [ ] Document environment variables and provide `.env.example`
- [ ] Document dataset provenance
- [ ] Document known limitations and next steps
- [ ] Verify deployed URL or prepare a working screen capture
- [ ] Finalize team roster

### Sunday Before 11:00 AM: Submit

- [ ] Record a 2–5 minute Loom with camera on
- [ ] Introduce the team and roles
- [ ] Deliver the elevator pitch in 30 seconds or less
- [ ] Show the core loop live
- [ ] Explain architecture and sponsor technology choices
- [ ] Show measurable first-run versus last-run improvement
- [ ] Explain the customer, problem, and impact
- [ ] Submit project title and team name
- [ ] Submit selected track
- [ ] Submit public repository
- [ ] Submit deployed URL or screen capture
- [ ] Submit roster and 150–300 word write-up

## Definition of Done

The project is done when a judge can watch the agent ingest fresh public data, produce a useful piece, evaluate it, retain a specific lesson, rerun the task, and see a credible performance improvement without relying on a slide deck.
