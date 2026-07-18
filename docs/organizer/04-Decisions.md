# Decisions and Open Questions

## Decisions

| Decision | Current Choice | Reason |
|---|---|---|
| Primary track | Recursive Intelligence | The core differentiator is measurable improvement across runs |
| Secondary track | Red Hat Live Data, only if freshness is essential | Avoid claiming a track based on a static download |
| Product | Writing Engine | Matches the proposed idea and creates an inspectable learning loop |
| Initial audience | Education or civic-data operators | Clear need for sourced, actionable writing |
| Publication | Human approval required | Draft privately and publish deliberately |
| Truth boundary | Live source is authoritative; memory supplies context | Prevent stale memory from becoming evidence |
| Evaluation | Frozen benchmark plus independent trait scores | Makes improvement credible |

## Open Questions

- [ ] Who is on the team, and what are their roles?
- [ ] What exact writing artifact will the demo produce: decision memo, briefing, article, or social thread?
- [ ] Which live public feed is reliable enough for the whole weekend?
- [ ] What is the smallest benchmark that judges will find credible?
- [ ] Which model will write, and which model or method will evaluate?
- [ ] Is vLLM feasible on available infrastructure before Saturday afternoon?
- [ ] Which sponsor bounty is worth the integration cost?
- [ ] What action should the heartbeat take when nothing meaningful changed?
- [ ] What evidence promotes a lesson from episodic memory to the durable playbook?
- [ ] What is the commercial wedge after the hackathon?

## Risks

- Evaluator scores may drift or reward superficial style changes.
- The learning loop may accidentally be manual prompt engineering.
- A live feed may fail, update too slowly, or contain malformed records.
- Memory may overfit the benchmark.
- Sponsor integrations may consume time without improving the core product.
- An autonomous writer may ingest prompt injection from public sources.
- The Loom deadline leaves little room for Sunday debugging.

## Decision Log

Add new decisions here with date, owner, choice, and rationale. Do not rewrite the preserved organizer content in [00 Source of Truth](00-Source-of-Truth.md).
