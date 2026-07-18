# Submission write-up (150–300 words)

> Draft for the hackathon submission form (due Sunday July 19, 11:00 AM CST).
> Word count of the body below: ~260.

---

Writing agents repeat the same mistakes forever because every prompt starts
from scratch — and worse, they'll confidently write about anything, whether or
not they have the evidence to do it well. This bites anyone deploying
autonomous writers or graders: ops teams, ed-tech assessment builders, any
team whose agent must know what it hasn't earned the right to do yet.

**Writing Engine** is a heartbeat-driven agent that watches live public data
(real NOAA NWS alerts for Texas), writes source-grounded decision memos for
operations staff, grades itself against a frozen seven-dimension rubric, and
keeps only the lessons that measurably raise its scores. On its frozen
benchmark fixture it improves from a lesson-free baseline of 0.57 to 1.00 —
including on a held-out task it never learns from, so the improvement is
generalization, not overfitting. Lessons persist across restarts and compound: our live runs
applied six previously-learned rules to brand-new storm data.

The differentiator is the **evidence gate**: a runtime-enforced policy
(derived from our real work benchmarking a STAAR grades 3–5 essay-scoring
engine against 117 officially-scored TEA responses) that decides how much a
domain has _earned_ — investigate, prototype, pilot, or autonomous. A domain
with no benchmark gets watched, snapshotted, and refused: the agent won't
write until the evidence exists. Our live-alerts domain earned its writing
permission on camera by acquiring a benchmark.

Untrusted feed content passes a fail-closed HiddenLayer scan seam; model
inference runs behind one OpenAI-compatible adapter (vLLM-served Nemotron or
hosted); nothing publishes without a human. Impact: agents that earn
autonomy with measured evidence instead of assuming it.

---

**Track:** Recursive Intelligence (primary), Red Hat Live Data (secondary).
**Repo:** https://github.com/supe-log/writing-engine
