# Getting started — from zero to your own writing assessment engine

This guide assumes nothing. If you can install an app and copy-paste, you
can do this. At the end you'll have a grading engine for YOUR writing
assessment — with an honest report card that tells you exactly how much to
trust it.

## What you need

- A Mac or Windows computer.
- A Claude account (claude.ai) — the builder runs on Claude Code.
- An OpenAI API key (platform.openai.com) — the engine's "judges" run on
  it. The setup will walk you through creating one; expect to add ~$20 of
  credit.
- **Ideally: your scored examples.** A rubric plus real essays that human
  graders already scored (with their written reasoning, if you have it).
  PDFs, spreadsheets, scans — any form. Don't have them? Start anyway:
  step 4 will search for public data and tell you honestly whether enough
  exists.
- About 1–3 hours, mostly waiting while it builds.

## Step 1 — Install Claude Code

Easiest: download the **Claude Code desktop app** from
https://claude.com/claude-code (Mac or Windows), install, and sign in with
your Claude account.

(Terminal users: `npm install -g @anthropic-ai/claude-code`, then `claude`.)

## Step 2 — Get this project

In Claude Code, paste this and press enter:

> Clone https://github.com/supe-log/writing-engine into a folder called
> writing-engine and open it.

Claude does the rest. (Terminal users: `git clone
https://github.com/supe-log/writing-engine && cd writing-engine && claude`.)

## Step 3 — Start the factory

Type:

```
/engine-factory
```

That's the whole interface. It will interview you in plain English:

- What test or assignment do you need to grade? What grade level? What
  language?
- How is it scored? (e.g. "Ideas 0–3 and Grammar 0–2")
- Is this for classroom feedback, a school pilot, or official scores?
- Where are your scored examples? (Drag folders/files into the chat, or
  say "I don't have any — please search.")

## Step 4 — The honesty checkpoint (free)

Before spending anything, the factory audits the data and gives you one of
three answers:

- 🟢 **GREEN** — enough data to build and _prove_ an engine. It proceeds.
- 🟡 **YELLOW** — it can build a draft engine, but with wide error bars and
  a rule that a human reviews borderline scores. It tells you exactly what
  extra data would earn green.
- 🔴 **RED** — not enough data to build anything trustworthy. Instead of an
  engine, you get a one-page collection plan: how many essays, at which
  score points, scored how. (This answer is the product working, not
  failing — a grader nobody verified is worse than no grader.)

You approve before it continues. Building costs real API money — typically
a few dollars to a few tens of dollars; it reports usage as it goes.

## Step 5 — It builds itself (you can watch)

The factory then: picks the best judge models for _your_ rubric by
measuring them, locks a final exam away where nothing can peek, and runs
improvement rounds — each round a fresh AI builder tries one change, and a
referee (pure code + your human scores) keeps it only if agreement with
human graders genuinely improved. You'll see plain-English updates like
"Round 2: tried X, it hurt the lowest scores, discarded."

At the end it takes the sealed final exam **once** and reports the honest
number.

## Step 6 — What you walk away with

A folder `dist/<your-assessment>/` containing:

- **`grade.sh`** — grade one essay: `bash grade.sh essay.txt` → scores +
  a short written rationale. Or just ask Claude: "grade the essays in this
  folder with my engine."
- **`REPORT-CARD.md`** — plain-English certification: how closely it
  matched human graders on essays it never saw, its weak spots, and which
  scores should get a human double-check (borderline calls).
- **`flywheel/`** — every essay a human re-checks is saved here and makes
  the next version of your engine better. Your reviewers are training it
  just by doing their normal job.

## FAQ

**I have no scored examples at all. Can I still get an engine?**
Maybe — some official assessments publish scoring guides with graded
sample essays, and the factory will hunt for them. If it can't find
enough, it will tell you precisely what to collect (typically ~120 scored
essays covering every score point, including failing ones).

**Does it work in other languages?**
Yes — the first non-English build (Spanish STAAR, grades 3–5) passed its
sealed exam at QWK 0.87–0.91. The factory still measures everything for
your language from scratch (judge choices proved language-specific), and
the report card says exactly what was and wasn't tested.

**Is my students' writing private?**
Essays stay on your computer except when sent to the AI judges for scoring
(OpenAI/Anthropic API calls). Nothing is uploaded to this project or any
public repository — and copyrighted scoring-guide material must never be.

**How accurate is it, really?**
On the assessment it was first built for (Texas STAAR essays), it agreed
with official human raters at QWK 0.88 on never-seen essays —
around the level at which trained human raters agree with each other.
Your number will be measured, not promised: that's what the report card
is for.
