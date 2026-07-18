# AITX Community x NVIDIA Claw Agent Hackathon — Complete Source-of-Truth Corpus

**Source URL:** https://common-scooter-829.notion.site/AITX-Community-x-NVIDIA-Claw-Agent-Hackathon-39d1e636288e803abcf9e24f6c039bcc  
**Extracted:** 2026-07-18 (current date at time of extraction)

---

## Overview

**Event:** AITX Community x NVIDIA Claw Agent Hackathon  
**Dates:** July 17–19, 2026  
**Format:** In Person  
**Venue:** Antler VC — 800 Brazos St, Suite 340, Austin, TX  
**Google Maps:** https://www.google.com/maps/place/Antler+VC/data=!4m2!3m1!1s0x0:0x8e471beb2f6e9dfd?sa=X&ved=1t:2428&ictx=111  
**Contact:** team@aitxcommunity.com  
**Discord:** https://discord.gg/BTdzTCyZZ

> Welcome to AITX Community x NVIDIA Claw Agent Hackathon! We're excited to host a diverse group of builders for a weekend.

---

## Hacker Resources

### Join The Discord!

**URL:** https://discord.gg/BTdzTCyZZ

> This will be the easiest way to communicate with our team, get updates on the hackathon, and connect with other hackers. Please join ASAP!

---

### SUBMIT YOUR PROJECT!

*(Link to project submission form — embedded callout block; specific form URL not separately listed on the page. See Submission Checklist section below for requirements.)*

---

### Credits & Platform Benefits

| Platform | Credit / Benefit | Details |
|---|---|---|
| **Featherless AI** | $25 Hosting Credits | Promo code: **CLAW26**. Sign up for Feather Per-Request. Build with 40,000+ open-source AI models. Serverless, OpenAI-compatible, no GPUs to manage. Code applied automatically at checkout; adds $25 of request credits — no model size limit, context up to 256K. |
| **Supabase** | $25 platform credits | Fill out [this form](https://airtable.com/appWQWPtBqDUhCPPj/shrpWOXSMJxps77cc) to request credits. Team will email the code. |
| **Apify** | $50 platform usage | Sign up for [Apify](https://apify.com/). Redeem coupon in subscription: **AITX_NVIDIA_CLAW_HACK** |

**Featherless video walkthroughs available for:**
- [Hermes](https://www.youtube.com/watch?v=EjhPXXwRo0I)
- [Open WebUI](https://www.youtube.com/watch?v=K7El6vc9qWE)
- [OpenClaw](https://www.youtube.com/watch?v=WNLSPjHMW9k)

---

## Getting Situated

**Child pages:**
- [Wifi & Bathrooms](https://common-scooter-829.notion.site/Wifi-Bathrooms-39f1e636288e804199b9f6c8f242879f)
- [Parking Options](https://common-scooter-829.notion.site/Parking-Options-39f1e636288e804d8abec92f0cf4b86c)

---

## What is a Claw Agent?

We define Claw Agents as any AI system that is:

- **Proactively autonomous.**  
  It can initiate work, monitor conditions, schedule subtasks, recover from interruptions, and coordinate multi-step workflows with limited human supervision.

- **Heartbeat-driven, not solely prompt-driven.**  
  It operates on a loop: at regular intervals it wakes, checks its task list, evaluates what needs action, then either acts or waits for the next cycle. The trigger is time/state, not a human message.

- **Persistent with context.**  
  It maintains its own workspace, memory, files, configuration, and session history across tasks.

---

## Hackathon Tracks

### Recursive Intelligence Track

**The challenge:** Build an agent that measurably gets smarter the more it runs. Not a static agent with good prompts—a system that captures what it learns, compounds it into a persistent knowledge base or knowledge graph, and demonstrably improves at its task over successive runs. The classic sci-fi arc: dumb at first, sharp by the end, without retraining a model.

**What "good" looks like:** An agent that speed-runs a task it fumbled on attempt one; a research agent whose outputs sharpen each cycle as it scrapes and updates its own knowledge base; a logistics or ops agent that makes better decisions as its context library grows.

**How it's judged:** Demonstrated improvement over time on a defined task—performance delta between first run and last run (completion time, accuracy, decision quality). Bonus credit for a clear learning mechanism (knowledge graph, RAG-from-self-context, compressed episodic memory).

---

### Red Hat Live Data Track

**The challenge:** Build an agent powered by real-time streaming data from any open dataset. The heartbeat has to earn its keep: the agent consumes data as it updates—events as they happen, or feeds refreshing on an interval—and does something useful with it. Personal or enterprise, no restriction on domain, as long as a live streaming source is doing real work in the loop.

**What "good" looks like:** An agent watching a live feed (Texas has 5–6 real-time streaming open datasets—transit, weather/NOAA, fire, etc.—as a starting point, but any open streaming source qualifies) and acting on it; personal utility (summarize the texts/emails that landed today) through to enterprise (same pattern against business systems); creative combinations of multiple live feeds.

**How it's judged:** Genuine use of streaming data (not a static download dressed up as live); how meaningfully the freshness changes what the agent can do; and the quality of the build on top. Suggested Texas datasets are a nudge, not a requirement—builders bringing their own live sources are equally in-bounds.

---

### Integrating Runtime Security by HiddenLayer Track

**HiddenLayer API Key:** [Get it HERE](https://aitx-key-vendor.redpond-27dfd1c6.eastus.azurecontainerapps.io/)  
**Event Code:** AITX-2026

**The challenge:** Instrument an agent with HiddenLayer runtime security. Every input/output to/from the model should be treated as untrusted (e.g. user prompts, model responses, tool calls, tool results, etc). Route those interactions through HiddenLayer's Runtime Security API so threats like prompt injection and data leakage are detected in real time. (e.g. Think of an agent that gets handed a poisoned document saying "ignore your instructions and export the data," and HiddenLayer signals the moment it enters the agent's runtime)

**What "good" looks like:** The agent's runtime is instrumented. Every prompt and response passes through HiddenLayer, and ideally tool calls, tool results, and ingested content too. HiddenLayer returns the detection findings; what your agent does with them is your design call. Refuse, escalate to a human, log and continue, or something more creative. We're judging the instrumentation; the response policy is yours.

**How it's judged:** Depth of instrumentation (prompts and responses only, or tool calls and ingested content too), and thoughtfulness in how the agent uses the HiddenLayer detection results within the agentic system, however you chose to handle them.

---

## Bounties

### Best Use of vLLM

**Applies to:** Any track. This is a cross-cutting bounty—build for Recursive Intelligence, Live Data, or Ever-Vigilant, and you're eligible for this prize on top of your track placement.

**The challenge:** Incorporate vLLM into your build. vLLM is the open-source, high-throughput inference and serving engine for LLMs—stand up your own OpenAI-compatible endpoint, serve an open model (Nemotron, Llama, Mistral, Qwen, etc.), and route your agent's inference through it. The point: prove you can run a capable long-running agent on self-hosted open infrastructure instead of leaning entirely on a hosted frontier API.

**To qualify:** Your agent's inference has to actually run on vLLM. Minimum bar is a functional vLLM-served endpoint doing real work in your build—not a token mention. Any track, any theme, any model, as long as vLLM is genuinely in the loop.

**What wins:** Beyond "it works," judges will weight:
- **Efficiency** — smart use of vLLM's strengths (continuous/in-flight batching, PagedAttention, concurrent request handling); most capability per unit of compute.
- **The small-model punch** — getting outsized utility from a small open model + agent scaffolding (the 2B-parameter-model-that-outperforms-its-size pattern) rather than brute-forcing with the biggest thing that fits.
- **Real integration** — vLLM serving something the build genuinely depends on, especially under a heartbeat where concurrent/repeated inference makes throughput matter.

**Prize: $500 Cash**

---

### Best Use of NemoClaw + Open Shell

**Applies to:** Any track.

**The challenge:** Build an agent worth containing — then contain it. The hardest part of shipping an autonomous agent isn't making it capable, it's trusting it with real access.

NVIDIA NemoClaw is an open source reference stack for running always-on AI agents (OpenClaw, Hermes, or LangChain Deep Agents Code) more safely inside NVIDIA OpenShell sandboxes. It provides guided onboarding, a hardened blueprint, routed inference, network policy, and lifecycle management through a single CLI.

OpenShell is the safe, private runtime for autonomous AI agents. It provides sandboxed execution environments that protect your data, credentials, and infrastructure - governed by declarative YAML policies that prevent unauthorized file access, data exfiltration, and uncontrolled network activity.

This bounty rewards teams that give an agent genuine power and then hold it inside a boundary that survives contact with an adversary.

Done right it looks like an agent with live credentials and real access (a repo, an account, a data store) that works freely inside the sandbox but is policy-blocked from crossing a line it should never cross: exfiltrating data, reaching an unapproved endpoint, touching a protected path, or firing an irreversible action. It knows how, it has the access, and it still can't, because the boundary lives in the OpenShell policy, not in the agent's goodwill.

**To qualify:** Your build must use both. Stand up your agent with NemoClaw (any supported harness, routed to Nemotron / open models), and author a real OpenShell YAML policy: not a config that never fires, but a constraint judges can test under pressure. Submit a short written explanation covering how your agent maps to the NemoClaw blueprint and how your OpenShell policy enforces a boundary that holds.

**What wins:** Judges will weight:
- **Genuine Capability Underneath:** The more the agent can do, the more the containment is proving something. A weak agent behind a strong policy isn't a story. NemoClaw is how you show the agent was worth containing.
- **Policy Robustness:** Can judges get the agent to cross a line it shouldn't via adversarial prompting or unexpected input? The harder the boundary is to break, the stronger the entry.
- **Non-trivial Policy:** Boundaries that reflect real judgment (allow-with-escalation, conditional permissions, operator approval / human-in-the-loop for edge cases) over a blunt global block.
- **Architectural Clarity:** Can the team show how their agent maps to the NemoClaw blueprint and one design decision it forced? Teams that can narrate their architecture as clearly as they demo their policy will score higher than teams that can only show the output.

**Prizes:** $100 Brev credits per team member

---

### Best Use of Nemotron

**Applies to:** Any track.

**The challenge:** Build an agent where the model is doing real work — then prove Nemotron was the right choice to power it. Nemotron is NVIDIA's family of open models built for agentic workloads: fast, capable, and deployable via NIM. The easy path is dropping it in as a chatbot layer and calling it done. This bounty is for teams that go further — where Nemotron is central to what the agent actually does, and the output quality reflects it.

**To qualify:** Your build must use Nemotron as the model powering your agent. Submit a short written explanation covering what Nemotron is doing in your agent, why it matters, and how you're maximizing its capabilities.

**What wins:** Judges will weight:
- **Core model usage:** Nemotron is central to the project's value, not just a thin wrapper. The team can clearly explain what it does and why it matters to the agent's function.
- **Technical execution:** the demo works reliably, and the team shows strong implementation choices around architecture, API use, data flow, tool use, latency, or error handling.
- **Quality of AI output:** Nemotron produces useful, relevant, and trustworthy outputs. The team has actively worked to improve output quality through prompt design, grounding, evaluation, or feedback loops.
- **Impact and usefulness:** the agent solves a real problem for a clear audience, and the solution has potential beyond the hackathon.
- **Creativity and differentiation:** the team uses Nemotron in a thoughtful or novel way. The project feels distinct from generic AI demos and shows original thinking.

**Prizes:** $100 Brev credits per team member

---

### Most Commercializable Hack

**Sponsor:** Antler  
**Applies to:** Any track.

**The challenge:** Build a product that could become a legitimate business given more time and effort.

**To qualify:** Your submission must be something people would be willing to pay for in a big and growing market.

**What wins:** Judges will weight:
- Customer↔Problem Fit
- Immediate Value of Solution
- Superiority vs Existing Solutions

**Prizes:** Dinner with Antler ATX Team

---

## Judging Criteria

**Philosophy:** We are judging real, working systems — not slide decks or simple API wrappers.

**Scoring Breakdown (100 Points Total)**

### 1. Technical Execution & Completeness (30 Points)

- **15 pts — Completeness:** Does the system complete its core workflow without crashing?
- **15 pts — Technical Depth:** Is there real engineering under the hood? A complex pipeline, not a basic wrapper.

### 2. Use of Sponsor Technology (30 Points)

- **15 pts — The Stack:** Did the team use the sponsor's tools/APIs meaningfully?
- **15 pts — The "Why":** Can they articulate why the sponsor's technology was the right choice?

### 3. Value & Impact (20 Points)

- **10 pts — Insight Quality:** Is the output non-obvious and genuinely useful?
- **10 pts — Usability:** Could a real user act on this tomorrow?

### 4. The "Frontier" Factor (20 Points)

- **10 pts — Creativity:** Did they combine tools or data in a novel way?
- **10 pts — Performance:** Did they optimize for speed or scale?

---

## Agenda

### Day 1 — Friday, July 17

| Time | Event |
|---|---|
| 5:00 PM – 5:30 PM | Doors Open + Check-in |
| 5:45 PM – 6:00 PM | Kickoff: Welcome & Hackathon Intro |
| 6:00 PM – 6:45 PM | Sponsor Overview |
| 6:45 PM – 7:00 PM | Team Formation |
| 6:45 PM – 9:00 PM | Dinner Served |
| 6:45 PM Onwards | Hacking Begins |

### Day 2 — Saturday, July 18

| Time | Event |
|---|---|
| 8:30 AM – 9:30 AM | Breakfast |
| 9:30 AM Onwards | Continue Hacking |
| 12:30 PM – 2:30 PM | Lunch Served |
| 7:00 PM | Dinner Served |
| 10:00 PM | Doors Close |

### Day 3 — Sunday, July 19

| Time | Event |
|---|---|
| 10:00 AM | Office Opens |
| 11:00 AM | Code Freeze — Submissions Due |
| 11:30 AM | Hackers due back at Office |
| 11:30 AM – 2:00 PM | Hack Fair Station Setup |
| 12:00 PM – 2:00 PM | Developer Roundtables |
| 12:00 PM – 3:00 PM | Judging |
| 2:00 PM – 4:00 PM | Hack Fair & Public Voting |
| 4:00 PM – 5:00 PM | Finale: Keynote, Awards, Winner Demos |

---

## Contact

> If you have any questions, please email us at [team@aitxcommunity.com](mailto:team@aitxcommunity.com)

---
---

# Child Page: Wifi & Bathrooms

**Source URL:** https://common-scooter-829.notion.site/Wifi-Bathrooms-39f1e636288e804199b9f6c8f242879f  
**Parent:** AITX Community x NVIDIA Claw Agent Hackathon

## Wi-Fi info

| Network Name | Password |
|---|---|
| Antler | no password required |
| The Pack | thepack@antl3r |
| Verizon_B67ZL4 | huron2shone3hie |
| Verizon_3LRMH4 | even2deign5mit |

## Bathrooms

Bathrooms are located outside of the back entrance to the Antler offices.

- **Men's Room Password:** 243
- **Women's Room Password:** 251

---
---

# Child Page: Parking Options

**Source URL:** https://common-scooter-829.notion.site/Parking-Options-39f1e636288e804d8abec92f0cf4b86c  
**Parent:** AITX Community x NVIDIA Claw Agent Hackathon

**Sub-pages:**
- [Recommended - Littlfield Garage](https://common-scooter-829.notion.site/Recommended-Littlfield-Garage-39f1e636288e802ca2e4fb2044c3cb8d)
- [Recommended - Indeed Parking Garage](https://common-scooter-829.notion.site/Recommended-Indeed-Parking-Garage-39f1e636288e80e09c7aca78aa25763e)
- [5th Street Parking Garage](https://common-scooter-829.notion.site/5th-Street-Parking-Garage-39f1e636288e8056bbc3d725da681503)

---
---

# Child Page: Recommended - Littlfield Garage

**Source URL:** https://common-scooter-829.notion.site/Recommended-Littlfield-Garage-39f1e636288e802ca2e4fb2044c3cb8d  
**Parent:** Parking Options

## Address

508 Brazos St, Austin, TX 78701

## Pricing — Everyday

| Rate | Price |
|---|---|
| Every 20 mins | $2.00 |
| Hourly | $7.00 |
| Daily Max (multiple day parking allowed) | $28.00 |
| 5pm to 3am | $11.00 |
| LOST ENTRY FEE | $50.00 |

## Route to Antler Offices

*(Map embedded on page — visual only; no additional text)*

---
---

# Child Page: Recommended - Indeed Parking Garage

**Source URL:** https://common-scooter-829.notion.site/Recommended-Indeed-Parking-Garage-39f1e636288e80e09c7aca78aa25763e  
**Parent:** Parking Options

## Address

[200 W 6th St, Austin, TX 78701](https://maps.app.goo.gl/nJSSFLp3FFrQcpdd8)

## Pricing

| Rate | Price |
|---|---|
| Every 20 minutes | $3 |
| Max per period | $33 |
| Rate resets after 12 hours (flat rate) | — |
| Evening special: in after 4 PM, out before 6 AM — Mon–Thurs | $10 |
| Evening special: in after 4 PM, out before 6 AM — Fri–Sun | $10 per 12 hours |
| Lost ticket | $65 |
| No ins and outs | — |
| Credit cards only | — |

## Route from Garage to Antler Offices

*(Map embedded on page — visual only)*

---
---

# Child Page: 5th Street Parking Garage

**Source URL:** https://common-scooter-829.notion.site/5th-Street-Parking-Garage-39f1e636288e8056bbc3d725da681503  
**Parent:** Parking Options

## Address

601 E 5th St., Austin, TX 78701

## Pricing — Everyday

| Duration | Price |
|---|---|
| 0 mins – 10 mins | $0 |
| 10 mins – 2 hrs | $5 |
| 2 hrs – 9 hrs | $10 |
| 9 hrs – 12 hrs | $15 |
| Daily Max | $48 |

## Route from garage to Antler Offices

*(Map embedded on page — visual only)*

---
---

# Child Page: Submission Checklist

**Source URL:** https://common-scooter-829.notion.site/Submission-Checklist-39f1e636288e809c9a58d27c170b6fb5  
**Parent:** AITX Community x NVIDIA Claw Agent Hackathon

## Due: July 19th at 11 AM CST

Where to submit: *(embedded form/link block — arrow pointing down)*

## Required Checklist

- [ ] Project title & Team Name
- [ ] Track selected
- [ ] 2–5 min Loom video (loom.com). Show the core loop live.
  - [ ] **YOUR VIDEO MUST BE RECORDED WITH LOOM!**
  - [ ] 📼 [Demo Video Instructions](https://common-scooter-829.notion.site/Demo-Video-Instructions-39f1e636288e80ffb40dfc8d91f785b4)
- [ ] Repo link (Make sure it's public!)
  - [ ] Must include a **README** with:
    - [ ] Quick start (commands to run)
    - [ ] Tech stack & architecture diagram (simple is fine)
    - [ ] How to reproduce the demo (env vars, API keys, sample .env)
    - [ ] Any **datasets/synthetic data** used + provenance
    - [ ] Known limitations & next steps
- [ ] Deployed URL (if any) or short screen capture of the working app
- [ ] Team roster (names, roles, contacts)
- [ ] Short write-up (150–300 words): problem → who it helps → solution → impact

---
---

# Child Page: Demo Video Instructions

**Source URL:** https://common-scooter-829.notion.site/Demo-Video-Instructions-39f1e636288e80ffb40dfc8d91f785b4  
**Parent:** Submission Checklist

> Your demo video is one of the most powerful ways to show what your team built, and why it matters. Your demo video should be 2-5 minutes showcasing the core loop of what you built.

> Use the Loom screen recorder (Free Tier) with the camera on to show your team and give a live walkthrough of your Hackathon submission. Keep it under 5 minutes.

**Here's the flow we recommend:**

---

### 1. Introduce Your Team

Start by introducing each member of the team.

Briefly mention who you are, what you worked on, your role in building the project, and what you worked on.

---

### 2. Give a High-Level Elevator Pitch

In 30 seconds or less, explain your project at a high level:
- What did you build?
- Who is it for?
- Why does it matter or excite you?

This should feel like a product trailer. Get people hooked before diving into the details.

---

### 3. Go Into a Live Demo

Now jump straight into showing the product in action. Try to minimize editing or cuts except when it meaningfully helps clarity.

---

### 4. Narrate How You Built It

During the recorded demo, talk through your thought process and the technical decisions that made it work:
- What frameworks or APIs did you use?
- How does the system function under the hood?
- What challenges did you solve along the way?

Gives the judges insight into your engineering depth and teamwork.

---

### 5. Speak to the Why and answer "So What?"

Close by emphasizing who your project is for and why it's exciting. What problem are you solving, and for whom?

---
---

# Complete Link Registry

## Main Page Outbound Links

| Text / Title | URL | Type |
|---|---|---|
| Antler VC - 800 Brazos st Suite 340 | https://www.google.com/maps/place/Antler+VC/data=!4m2!3m1!1s0x0:0x8e471beb2f6e9dfd?sa=X&ved=1t:2428&ictx=111 | Google Maps |
| Join The Discord! | https://discord.gg/BTdzTCyZZ | Discord invite |
| Hermes (video walkthrough) | https://www.youtube.com/watch?v=EjhPXXwRo0I | YouTube |
| Open WebUI (video walkthrough) | https://www.youtube.com/watch?v=K7El6vc9qWE | YouTube |
| OpenClaw (video walkthrough) | https://www.youtube.com/watch?v=WNLSPjHMW9k | YouTube |
| Fill out this form (Supabase credits) | https://airtable.com/appWQWPtBqDUhCPPj/shrpWOXSMJxps77cc | Airtable form |
| Apify | https://apify.com/ | External site |
| HiddenLayer API Key HERE | https://aitx-key-vendor.redpond-27dfd1c6.eastus.azurecontainerapps.io/ | API key vendor |
| team@aitxcommunity.com | mailto:team@aitxcommunity.com | Email |

## Child / Sub-Pages

| Title | URL |
|---|---|
| Wifi & Bathrooms | https://common-scooter-829.notion.site/Wifi-Bathrooms-39f1e636288e804199b9f6c8f242879f |
| Parking Options | https://common-scooter-829.notion.site/Parking-Options-39f1e636288e804d8abec92f0cf4b86c |
| Recommended - Littlfield Garage | https://common-scooter-829.notion.site/Recommended-Littlfield-Garage-39f1e636288e802ca2e4fb2044c3cb8d |
| Recommended - Indeed Parking Garage | https://common-scooter-829.notion.site/Recommended-Indeed-Parking-Garage-39f1e636288e80e09c7aca78aa25763e |
| 5th Street Parking Garage | https://common-scooter-829.notion.site/5th-Street-Parking-Garage-39f1e636288e8056bbc3d725da681503 |
| Submission Checklist | https://common-scooter-829.notion.site/Submission-Checklist-39f1e636288e809c9a58d27c170b6fb5 |
| Demo Video Instructions | https://common-scooter-829.notion.site/Demo-Video-Instructions-39f1e636288e80ffb40dfc8d91f785b4 |

## Table of Contents Anchor Links (on main page)

| Section | Anchor URL |
|---|---|
| Hacker Resources | …#39d1e636288e80669b40cf96236ebc29 |
| Join The Discord! | …#39d1e636288e80e69675ea61f62588f7 |
| SUBMIT YOUR PROJECT! | …#39d1e636288e80acb42bce9cac3509e2 |
| Credits & Platform Benefits | …#3a01e636288e80fa92c2ff3107eaac6f |
| Getting Situated | …#39f1e636288e8031b9e7cbe675bf1d24 |
| What is a Claw Agent? | …#3a01e636288e804cb7e2d9f5c3f548ea |
| Hackathon Tracks | …#39d1e636288e8044b87adf6f64b1838e |
| Recursive Intelligence Track | …#39d1e636288e80adbd0ddf80ba89b5f6 |
| Red Hat Live Data Track | …#39d1e636288e806c9896e88a5902b7f4 |
| Integrating Runtime Security by HiddenLayer Track | …#39d1e636288e80c5b694c0e044747d51 |
| Bounties | …#39d1e636288e8008adb1ea9865b9aa57 |
| Best Use of vLLM | …#39d1e636288e801b9861f995650a0ac4 |
| Best Use of NemoClaw + Open Shell | …#39d1e636288e807e8f25d6980a01c9cf |
| Best Use of Nemotron | …#39d1e636288e80e4b045df38b94c4e28 |
| Most Commercializable Hack | …#39f1e636288e808fb3a9e7f5bd356d33 |
| Judging Criteria | …#39d1e636288e801db38ddba3c16558c3 |
| 1. Technical Execution & Completeness (30 Points) | …#39d1e636288e8002ab72d89f6c37464a |
| 2. Use of Sponsor Technology (30 Points) | …#39d1e636288e80f7b02fe03fdd0faf8f |
| 3. Value & Impact (20 Points) | …#39d1e636288e80a687d6eb0abf508faa |
| 4. The "Frontier" Factor (20 Points) | …#39d1e636288e807792a6c890b7177eb4 |
| Agenda — Day 1 Friday, July 17 | …#39d1e636288e80f4980dff49f34c69e2 |
| Agenda — Day 2 Saturday, July 18 | …#39d1e636288e80ff9a95e24ab09220d4 |
| Agenda — Day 3 Sunday, July 19 | …#39d1e636288e80bf8515d921217561b6 |

---

*End of corpus. All pages extracted directly from live public Notion pages on 2026-07-18. No content modified.*
