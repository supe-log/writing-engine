# Evidence gates: deciding whether a writing-assessment domain is worth pursuing

## Why this document exists

The Writing Engine can discover sources on the internet. Discovery is cheap and
easy; **being right about student writing is neither.** A successful scrape tells
you a domain _exists_ and that _some_ material is reachable. It does not tell you
whether you have a stable construct to score, trustworthy labels to learn from, a
valid way to measure yourself, or the legal and safety footing to touch student
data.

This specification defines the **evidence gates**: the ordered checks the system
runs _after_ source discovery to decide how far a requested writing-grading or
assessment domain may be pursued — and, crucially, how far it may **not**. It is
general to writing assessment. STAAR grades 3–5 Extended Constructed Response
(ECR) is used throughout as the worked example because it is the domain the team
already has real evidence for.

The document is written to be useful two ways: a human can read it as a policy,
and a future implementer can turn every rule into code. Section
[Acceptance criteria / checklist](#acceptance-criteria--checklist-for-implementers)
is the machine-facing summary.

---

## 1. Four permissions, not one

Treat "can we do this?" as four separate permissions, each earned independently.
**A successful scrape grants only the first.** The later three are never implied
by data being reachable.

| Permission                               | What it authorizes                                                                                            | What it does **not** authorize                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Permission to investigate**            | Discovering sources, reading rubrics, cataloguing what exists, writing a feasibility report.                  | Building a scorer, making accuracy claims, touching student data at scale.         |
| **Permission to prototype**              | Building a limited, internal, non-student-facing scorer over a subset of the construct, measured vs baseline. | Any accuracy claim to users, any student-facing feedback, any deployment.          |
| **Permission to run a controlled pilot** | Supervised use on real items with locked evaluation, human review, and a human fallback for every decision.   | Removing the human, expanding beyond the validated subset, subgroup claims.        |
| **Permission to operate autonomously**   | Bounded, monitored, unattended scoring **inside a validated boundary**, with routing to humans retained.      | Operating outside validated grades/genres/prompt families; dropping human routing. |

The gate below decides which of these permissions a domain has earned. A domain
can hold, say, _investigate + prototype_ for one grade and only _investigate_ for
another. Permissions are scoped to what the evidence actually covers.

---

## 2. The layered gate (evaluated in order)

Gates are evaluated top to bottom. A domain's permission ceiling is set by the
**last gate it fully passes**; the first gate it fails caps it there and produces
a report explaining the gap. Later gates are not evaluated as blockers until the
earlier ones pass, but discovered facts about them are still recorded.

### Gate A — Request / construct clarity

Can we state precisely _what is being scored_?

- **Construct:** the writing skill being measured (e.g. "development and
  organization of ideas in a source-based response"), not a vague "quality".
- **Population:** who writes these (e.g. Texas grade 4 students).
- **Genre:** informational, argumentative, narrative, correspondence, etc. —
  scored on its own rubric where genres differ.
- **Purpose:** formative feedback, summative grade, placement, practice.
- **Decision:** the concrete decision the score drives (a grade, an intervention,
  a feedback message). If no decision changes, scoring has no value to gate for.

Fail → **RED**. You cannot score what you cannot define.

### Gate B — Authority / provenance of the rubric

Is there a stable, approved rule set for scoring, with known origin?

- A stable, approved **rubric or decision procedure** (see §9 on what "approved"
  can mean — an expert-authored or user-approved rubric can qualify if validated).
- **Source authority:** who publishes it and whether they are competent to.
- **Version:** the rubric is versioned; scores are tied to a rubric version.
- **Licensing:** you may lawfully use the rubric and any bundled materials.
- **Immutable snapshots / checksums:** the rubric and sources are captured
  content-addressed so a score can always be traced to the exact text it used.

Fail → **RED** (no stable rubric) or **AMBER** (rubric exists but unversioned,
unlicensed, or not yet snapshotted).

### Gate C — Ground truth

Do we have trustworthy labels to calibrate and measure against?

- **Trusted human/official labels** for real responses (not model-generated).
- **Rater provenance:** who scored them, under what training.
- **Adjudication / disagreement information:** where raters disagreed and how it
  was resolved — a single score hides rater noise.
- **Original prompt and source passages** for each labeled response, because a
  source-based score is meaningless without the source.
- **No target-label leakage:** labels must not be derivable from features the
  model will see at scoring time (e.g. an answer key embedded in the passage).

Fail → **AMBER** (promising construct, labels not yet in hand) or **RED** (labels
exist but are untrustworthy, unattributed, or leak).

### Gate D — Coverage

Does the evidence span what the scorer will actually encounter?

- **Every legal score point** is represented (for STAAR ECR: Development 0–3,
  Conventions 0–2, and valid totals under the cascade rule).
- **Weak / average / strong / invalid** responses, including off-topic, blank,
  refusal, and prompt-injection cases.
- **Multiple prompt families** (distinct prompts + source sets), not many
  responses to one prompt.
- **Genres and populations** the domain claims to support.
- **Rare consequential cases:** the ones where a wrong score does real harm.
- **Extraction / OCR quality** is known per record; low-quality transcriptions
  are flagged, not silently scored.

Fail → **AMBER** or **YELLOW** depending on how much is missing (see outcomes).

### Gate E — Evaluation feasibility

Can we _measure_ the scorer credibly?

- A **locked, leakage-safe holdout** split at the **correct grouping level** —
  for source-based writing that is the **prompt family**, not the individual
  response, or the same passage leaks between train and test.
- **Preregistered metrics** chosen before running (see §5 and §6): per-trait exact
  and adjacent agreement, quadratic weighted kappa (QWK), MAE, cascade
  correctness, calibration.
- **Baselines** to beat: current human/workflow alternative, and a trivial
  majority-class or length baseline.
- **Repeated runs** to measure stability (model judges are non-deterministic).
- **Enough samples** per reported cell for the uncertainty interval to be
  interpretable — otherwise the metric is theater.

Fail → **AMBER** (can't yet measure) caps the domain below pilot.

### Gate F — Operational safety

Can we run it without harming users or losing accountability?

- **Input validation** and **prompt-injection defense** on the response, the
  prompt, and the source passages (untrusted student text can carry attacks).
- **Abstention:** the scorer can say "no trustworthy judgement" instead of
  guessing.
- **Human routing:** low-confidence, abstained, or out-of-boundary cases go to a
  person.
- **Auditability:** every score records model, prompt, rubric, and data versions,
  plus the evidence it used.
- **Privacy / retention:** lawful handling of student data (FERPA/COPPA where
  applicable), minimal retention, access control, and a defined deletion path.
- **Monitoring:** drift, error rates, and routing volume are watched in
  operation.

Fail → **RED** if privacy/safety cannot be met; otherwise caps below pilot.

### Gate G — Outcome value

Is it actually worth it?

- **Useful improvement** over the current human or workflow alternative — faster,
  more consistent, more available, or cheaper _without_ being worse where it
  matters.
- **Feedback validity:** if the product gives students feedback, the feedback
  must be correct and actionable, not just a number. A right score with wrong
  feedback is a failure.
- **Cost / latency / complexity justified** by the value delivered.

Fail → **RED / feasibility report only**: technically possible, not worth doing.

---

## 3. Outcomes

The gate produces exactly one status. Names and colors are **labels only**; the
machine-readable enum is what implementations key on.

| Status     | Label                         | Meaning                                                                                                                                               | Max permission                 |
| ---------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **RED**    | Feasibility report only       | No stable construct, no trustworthy labels, no valid holdout, or unacceptable privacy/safety. Return the report (§8) and stop.                        | Investigate                    |
| **AMBER**  | Continue evidence acquisition | Promising construct, but labels, coverage, or validation are missing. Go acquire the specific missing evidence; re-gate.                              | Investigate                    |
| **YELLOW** | Experimental prototype        | Limited, **non-student-facing** scorer over a declared subset, with explicitly named unsupported regions. **No accuracy or deployment claim.**        | Prototype                      |
| **BLUE**   | Controlled pilot              | Supervised use with locked evaluation, complete coverage of every supported score point, calibrated abstention, teacher review, and a human fallback. | Controlled pilot               |
| **GREEN**  | Bounded autonomous operation  | Unattended scoring **only inside validated boundaries**, with monitoring and human routing retained. Never a blank check.                             | Operate autonomously (bounded) |

### Machine-readable status enum

```jsonc
// EvidenceGateStatus
"RED" | "AMBER" | "YELLOW" | "BLUE" | "GREEN"
```

### Decision record shape

Every gate evaluation emits a record. This is the auditable artifact and the
seam a future `EvidenceGateEvaluator` port would return.

```jsonc
{
  "schemaVersion": 1,
  "domainId": "staar-ecr-g3-5",
  "evaluatedAt": "2026-07-18T00:00:00.000Z",
  "status": "YELLOW", // EvidenceGateStatus
  "maxPermission": "prototype", // investigate | prototype | pilot | autonomous
  "construct": {
    "skill": "development-organization + conventions (source-based ECR)",
    "population": "TX grades 3-5",
    "genres": ["informational", "argumentative"],
    "purpose": "formative + practice",
    "decision": "trait scores + targeted feedback",
  },
  "gates": {
    "A_construct": { "pass": true, "notes": "..." },
    "B_authority": {
      "pass": true,
      "rubricVersion": "tea-ecr-g3-5@2023",
      "notes": "...",
    },
    "C_groundTruth": {
      "pass": true,
      "labelSource": "TEA scoring guides",
      "notes": "...",
    },
    "D_coverage": {
      "pass": false,
      "notes": "sparse across grade x genre x family x score",
    },
    "E_evaluation": {
      "pass": false,
      "notes": "holdout at family level too small for CIs",
    },
    "F_safety": { "pass": true, "notes": "abstention + routing defined" },
    "G_value": {
      "pass": true,
      "notes": "beats unavailable-teacher baseline for practice",
    },
  },
  "supportedBoundary": {
    "grades": [3, 4, 5],
    "genres": ["informational"],
    "traitScores": { "devOrg": [0, 1, 2], "conventions": [0, 1] },
  },
  "unsupportedRegions": ["devOrg=3", "conventions=2", "argumentative g5"],
  "hardStops": [],
  "softStops": ["insufficient per-cell samples for subgroup claims"],
  "nextExperiment": "acquire >= N labeled devOrg=3 responses across >= 2 new families",
  "report": "assessment-feasibility-report#staar-ecr-2026-07-18",
}
```

---

## 4. TEA thresholds, correctly interpreted

Earlier framing in this project cited "65% exact and 95% adjacent" as if they
were a universal automated-scoring-engine (ASE) certification bar. **That is
wrong.** Read the primary sources directly:

- **65% exact / 95% adjacent are human-rater _maintenance_ requirements** — the
  agreement level human scorers must sustain — **not** a universal ASE
  certification threshold:
  https://tea.texas.gov/data-reports/staar/hybrid-scoring-key-questions-2.pdf
- **TEA's 2024 automated ECR criteria** are stated in summed-score terms:
  **QWK > 0.70 for summed scores** and **standardized mean difference (SMD)
  within ±0.15**, evaluated with **human–human comparison** and with **human
  routing** retained. Per-dimension exact agreement was **not** held to a
  universal 65% threshold:
  https://legacycms.tea.texas.gov/student-assessment/reports-and-studies/2024-staar-hybrid-scoring-study.pdf
- In that published 2024 study, TEA **routed 28.2% of responses to human
  scoring.** The lesson for us: **bounded autonomy must retain routing** — a real,
  audited automated system did not score everything itself, and neither should we.
- **Deterministic rubric rules must be exactly correct.** The STAAR **zero
  cascade** (Development/Organization = 0 forces Conventions = 0) is a rule, not a
  judgement. Any implementation must apply it with **100% correctness**; a cascade
  error is a hard stop, not a metric to average.

Takeaways baked into the gates:

1. Report **summed-score QWK and SMD** alongside per-trait metrics; do not present
   a human-maintenance number as our certification bar.
2. Treat **QWK > 0.70 (summed) and SMD within ±0.15** as the _reference_ target
   for autonomy discussions — a comparison, adapted per domain, not a magic
   constant.
3. **Keep human routing** in any autonomous mode.
4. **Zero-cascade correctness = 100%**, verified deterministically and tested.

---

## 5. Practical minimums per permission

These numbers are **defaults and heuristics for a hackathon-scale writing
assessment, not universal scientific constants.** They exist so a decision can be
made today; a psychometrician would set domain-specific values. Where a number
appears, read it as "at least, as a starting default."

### To begin **investigation**

- A **plausible construct** (Gate A statable, even if rough).
- **Discoverable authority and labels** — evidence that a rubric and scored
  examples _plausibly exist and are reachable_.

That is all. Investigation's job is to produce the feasibility report.

### To justify a **prototype** (→ YELLOW)

- An **approved, versioned rubric** (official, or expert/user-approved and
  validated per §9).
- **Complete records for the items you use:** each has response, prompt, source
  passage(s), official score, and provenance. Incomplete records are excluded, not
  patched.
- **Multiple independent prompt families** (default **≥ 3**) so you are not
  learning one prompt.
- **At least 5 labeled examples per supported trait score** (a technical
  smoke-test minimum). Scores below the minimum are **demoted to
  `unsupportedRegions` rather than blocking the prototype** — an incomplete
  prototype is allowed as long as it does not claim the thin regions. Only a
  domain where no score clears the minimum has nothing to prototype on.
- **At least one untouched prompt family** held out from all tuning.
- **Provenance** (snapshots/checksums) for rubric and sources.
- **A measurable baseline** to beat.
- The prototype **may intentionally support only a subset** (e.g. one genre, not
  the top score point) **and must say so explicitly** in `unsupportedRegions`.

### To justify a **controlled pilot** (→ BLUE)

- **Adequate per-score and per-family coverage** (defaults: **≥ 15 labeled
  responses per supported trait score** for preliminary calibration, and
  **≥ 8–10 per (supported trait score × prompt family)** cell you report on;
  fewer means you cannot see that cell's error).
- **No zero-recall legal score:** every supported score point is predicted at
  least sometimes and evaluated — a scorer that _never_ outputs Development 3
  cannot pilot on Development 3.
- **Leakage-safe dev / validation / test** split at the prompt-family level.
- **Repeated runs with ≥ 95% _exact_ trait-score stability** — within-one-point
  stability lets scores churn while "passing." Orchestration must be
  deterministic, and disagreement between repeated model scores must resolve by
  an explicit **consensus or abstention** policy, never silently.
- **Blind expert review** of a sample of machine scores by a qualified human who
  does not see the machine's score first.
- **Abstention and provider-error paths** implemented and tested (a failed model
  call is an error, never a fake 0/0).
- **Source-fidelity review** when source use matters (fabricated/misattributed
  evidence detection), even though it is a product-safety layer, not an official
  trait.
- **Conventions diagnostic review** whenever the product emits detailed
  conventions feedback (so we don't tell a child a correct sentence is wrong).

### To justify **bounded autonomous operation** (→ GREEN)

- **Non-inferiority** relative to qualified human agreement on the domain — you
  are demonstrably not worse than the human process you replace, within a
  preregistered margin.
- **Per-trait metrics with confidence intervals**, plus summed-score QWK and SMD
  (see §4).
- **Calibrated confidence and routing:** confidence scores mean what they say, and
  low-confidence cases route to humans (recall TEA routed 28.2%).
- **Subgroup slices where lawful and available** (grade, genre, English-learner
  status, transcription quality) — you cannot claim fairness you never measured.
- **Protected severe-error limits:** hard caps on the worst errors (e.g. scoring a
  0 essay as a 5, or violating the cascade), monitored continuously.
- **"Every score predicted reliably," made measurable:** per-score precision and
  recall exceed defined floors, the predicted score distribution stays within an
  approved divergence from human scores, and there is no persistent
  middle-score collapse.
- **Routing performance and coverage:** accuracy measured **separately** for
  auto-scored and human-routed responses, and the share the engine can score
  without intervention reported.
- **Recalibration triggers:** any change to the rubric, model, prompt, corpus,
  or population forces a calibration recheck.
- **Deterministic rules verified at 100%:** the zero cascade (and any analogous
  rule) is verified exactly correct with a dedicated test — a rule error is an
  implementation defect, not a metric to average.
- **Continuous monitoring** of drift and error rates in production.
- **Approved rollback:** a tested, authorized path to revert to human scoring.

Autonomy is always **bounded** to the exact grades, genres, prompt families, and
score ranges the evidence validated. Outside the boundary, route to a human.

---

## 6. Hard stops, soft stops, and the decision algorithm

### Hard stops (force RED, regardless of anything else)

- No statable construct (Gate A fails).
- No stable, approved rubric of any kind (Gate B: neither official nor
  validated-expert/user rubric).
- Labels are untrustworthy, unattributed, model-generated, or leak the target.
- No lawful basis to use the data, or privacy/retention cannot be satisfied.
- Deterministic rubric rules (e.g. zero cascade) cannot be implemented correctly.
- A validated holdout at the correct grouping level is impossible (e.g. only one
  prompt family exists, so any split leaks).

### Soft stops (cap the ceiling; acquire evidence and re-gate)

- Labels exist but are not yet in hand → cap at **investigate/AMBER**.
- Coverage sparse in some cells → cap below **pilot** for those cells only.
- Holdout exists but samples too few for interpretable CIs → cap below **pilot**.
- Stability/repeat runs not yet done → cap below **pilot**.
- Subgroup data unavailable → cap below **autonomy** (may still pilot).
- A supported score point has zero recall → that score cannot pilot/autonomize.

### Decision algorithm (pseudocode)

```text
function evaluateEvidenceGate(domain, discovery):
    record = new DecisionRecord(domain)

    # Hard stops first — any one forces RED.
    if not constructIsStatable(domain):            return RED(record, "no construct")
    if not hasStableApprovedRubric(discovery):     return RED(record, "no rubric")
    if labelsUntrustworthyOrLeak(discovery):       return RED(record, "labels")
    if not lawfulAndPrivacyOk(domain):             return RED(record, "privacy")
    if not deterministicRulesImplementable(domain):return RED(record, "rules")
    if not validHoldoutPossible(discovery):        return RED(record, "no holdout")

    # Gates A..G set the ceiling. Missing-but-acquirable => AMBER.
    if not (gateA and gateB): return RED(record)
    if not gateC:             return AMBER(record, missing="labels")
    if not gateD_minimal:     return AMBER(record, missing="coverage")

    # Prototype tier.
    if meetsPrototypeMinimums(discovery):
        record.declareUnsupportedRegions()
        ceiling = YELLOW
    else:
        return AMBER(record, missing="prototype minimums")

    # Pilot tier.
    if meetsPilotMinimums(discovery) and noZeroRecallLegalScore(discovery)
       and gateE_holdoutInterpretable and gateF_safety and gateG_value:
        ceiling = BLUE

    # Autonomy tier — bounded, and only if pilot passed.
    if ceiling == BLUE and meetsAutonomyMinimums(discovery)
       and nonInferiorToHuman(discovery) and calibratedRoutingRetained(discovery)
       and severeErrorLimitsHeld(discovery):
        ceiling = GREEN
        record.boundary = validatedBoundaryOnly(discovery)

    record.status = ceiling
    record.nextExperiment = cheapestFalsifyingExperiment(record)
    return record
```

The ceiling is always the **highest tier whose minimums are fully met with no
active hard stop.** When in doubt, return the lower tier and name the missing
evidence.

---

## 7. Worked example: STAAR ECR grades 3–5

Using the team's current evidence — **117 officially scored TEA ECR responses**
(2023–2025, grades 3–5), official annotations, source manifest, page-level
provenance, and the V2/V3 benchmark results (summed QWK ≈ 0.41 → 0.52 with
severe score compression):

| Gate             | Result  | Why                                                                                                                                                    |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — construct    | Pass    | Two official traits, defined population, two genres, clear decision.                                                                                   |
| B — authority    | Pass    | TEA rubric, versioned by year, snapshotted with checksums.                                                                                             |
| C — ground truth | Pass\*  | Official TEA labels + annotations; but single official score per response, limited rater-disagreement info; 2023 subset needed OCR repair.             |
| D — coverage     | Partial | Legal scores present in aggregate, but **sparse** once split by grade × genre × prompt family × trait score; top scores barely represented.            |
| E — evaluation   | Partial | Holdout only credible at prompt-family level, and with **9 families / 117 responses** the per-cell samples are too few for tight confidence intervals. |
| F — safety       | Pass    | Abstention, provider-error-as-error, injection defense, and routing are defined.                                                                       |
| G — value        | Pass    | Beats the "no teacher available" alternative for practice and formative feedback.                                                                      |

**Resulting decisions:**

- **GREEN for continued _prototyping_** — the construct, rubric, labels, and a
  measurable baseline are all in hand. Prototyping (YELLOW-tier work) is not just
  allowed, it is the right next step. (Here "green light" means _go ahead and
  prototype_; the domain's formal gate **status** is YELLOW because that is its
  permission ceiling.)
- **AMBER → YELLOW for a controlled pilot, _depending on verified coverage_** — a
  pilot is reachable but **not yet earned**. It becomes justified only once
  per-(score × family) coverage is filled in, no supported score has zero recall
  (today the engine essentially never predicts Development 3 or a top total, so
  those cannot pilot), and blind expert review is done. Until then the honest
  status stays below BLUE.
- **NOT GREEN for bounded autonomous operation** with the current corpus. 117
  responses is genuinely useful — enough to prototype and to expose real failure
  modes like score compression — but it is **sparse across grade × genre × prompt
  family × trait score.** Many cells have a handful of examples or none. That
  sparsity makes confidence intervals wide, makes subgroup/fairness claims
  impossible, and cannot support non-inferiority to human raters. Autonomy
  requires evidence the corpus does not yet contain.

**Why 117 is useful but not enough:** 3 grades × 2 genres × ~9 prompt families ×
up to 6 trait-score combinations is well over a hundred cells before you even ask
for multiple examples per cell. 117 responses cannot populate that space densely.
It is an excellent _diagnostic and prototyping_ corpus and a poor _autonomy
certification_ corpus. The fix is targeted acquisition (more families, more
high-score exemplars, more rater-disagreement data), not more responses to the
prompts already covered.

---

## 8. What the system returns when it refuses

A RED or AMBER outcome is not a dead end — it returns an **Assessment
Feasibility Report** so the requester learns something actionable. The report is
also emitted (in reduced form) at every tier, because even a GREEN domain should
document its boundary.

An Assessment Feasibility Report contains:

1. **Discovered sources** — every rubric, corpus, and reference found, with URL,
   authority, license, version, and checksum.
2. **Supported claims** — what the evidence _does_ justify (which grades, genres,
   score ranges, at which permission tier).
3. **Unsupported claims** — what was requested but is **not** justified, and why
   (named `unsupportedRegions`).
4. **Missing evidence** — the specific labels, coverage cells, or validation
   artifacts that are absent.
5. **Acquisition plan** — how to get the missing evidence (which families to
   collect, how many labeled exemplars per cell, what rater data to request).
6. **Legal / privacy issues** — licensing constraints, PII exposure, FERPA/COPPA
   considerations, retention limits.
7. **Next cheapest falsifying experiment** — the single lowest-cost test that
   could _disprove_ feasibility fastest, so effort is spent trying to kill the
   idea before scaling it.

The report is the product of _investigate_ permission and is always safe to
produce from a successful scrape alone.

---

## 9. Careful language: what "approved rubric" means

The absence of an **official government rubric is not, by itself, a hard stop.**
Many worthwhile writing-assessment domains have no state rubric.

- An **expert-authored** rubric (created by a qualified writing/assessment
  professional) **may substitute** for an official one.
- A **user-approved** rubric (the operator explicitly adopts a defined rule set)
  **may substitute** as well.
- **But** any substitute rubric must still be **validated**: versioned,
  snapshotted, and tested for inter-rater reliability against real responses
  before it can carry a domain past _prototype_. An unvalidated rubric — official
  or not — caps the domain at investigation.

Conversely, an official rubric that cannot be lawfully used, or whose scored
examples are untrustworthy, does **not** clear Gates B/C just by being official.
Authority and validation are separate tests; a domain needs both.

---

## 10. Acceptance criteria / checklist for implementers

This is the machine-facing summary. A future `EvidenceGateEvaluator` port (a
natural sibling to the ports in [architecture.md](architecture.md)) should be
able to compute a `DecisionRecord` (§3) by checking each item. Each bullet is
intended to become an assertion.

**Permissions**

- [ ] A successful scrape sets status to at most **investigate**; it never sets
      prototype, pilot, or autonomous.
- [ ] Permissions are scoped to the covered grades/genres/families/scores, not
      granted domain-wide.

**Gates (in order)**

- [ ] Gate A: construct, population, genre, purpose, and decision are all
      non-empty and specific.
- [ ] Gate B: rubric is present, versioned, licensed, and snapshotted with a
      checksum.
- [ ] Gate C: labels are human/official, attributed, non-leaking, and paired with
      prompt + source passages; disagreement info recorded where available.
- [ ] Gate D: every supported legal score point and case type (weak/avg/strong/
      invalid) is represented; OCR/extraction quality is recorded per record.
- [ ] Gate E: holdout is locked at the prompt-family level; metrics are
      preregistered; baselines defined; repeated runs planned; per-cell sample
      counts are sufficient for the reported uncertainty.
- [ ] Gate F: input validation, abstention, human routing, versioned audit trail,
      privacy/retention, and monitoring are all implemented.
- [ ] Gate G: improvement over the current alternative is demonstrated and
      feedback validity is checked.

**Outcomes**

- [ ] Exactly one `EvidenceGateStatus` (`RED|AMBER|YELLOW|BLUE|GREEN`) is emitted.
- [ ] The status equals the highest tier whose minimums are met with no active
      hard stop.
- [ ] `unsupportedRegions` is populated for any YELLOW+ status.
- [ ] A `nextExperiment` (cheapest falsifying test) is always present.

**Tier minimums**

- [ ] Prototype: approved+versioned rubric, complete records, ≥ 3 prompt families,
      ≥ 5 labeled examples per supported trait score (thinner scores demoted to
      `unsupportedRegions`, not blocking), ≥ 1 untouched family, provenance,
      measurable baseline; unsupported subset declared.
- [ ] Pilot: ≥ 15 labeled per supported score and adequate per-(score × family)
      coverage, no zero-recall legal score, leakage-safe dev/val/test, ≥ 95%
      exact trait-score repeat stability with a consensus/abstention policy for
      disagreement, blind expert review, abstention + error paths,
      source-fidelity review (if source use matters), conventions diagnostic
      review (if detailed conventions feedback is produced).
- [ ] Autonomy: non-inferiority to qualified human agreement, per-trait metrics +
      CIs, summed-score QWK and SMD reference targets, calibrated confidence +
      retained routing, subgroup slices where lawful/available, protected
      severe-error limits, per-score precision/recall floors, distribution
      divergence within bounds (no middle-score collapse), routing performance
      measured separately with coverage reported, recalibration triggers,
      deterministic rules verified 100%, continuous monitoring, approved
      rollback; boundary recorded.

**Deterministic correctness**

- [ ] STAAR zero cascade (and any analogous deterministic rule) is applied with
      100% correctness and has a dedicated test.

**Refusal**

- [ ] RED/AMBER returns a complete Assessment Feasibility Report (§8) with
      discovered sources, supported/unsupported claims, missing evidence,
      acquisition plan, legal/privacy issues, and next experiment.

---

## Related documents

- [docs/architecture.md](architecture.md) — ports/adapters, the evaluator seam,
  and where an `EvidenceGateEvaluator` would sit.
- [docs/dataset-provenance.md](dataset-provenance.md) — how sources are snapshotted
  and licensed (Gate B evidence).
- [docs/known-limitations.md](known-limitations.md) — the scaffold's current
  evaluator/corpus limitations that keep it below pilot.
- [CONTEXT.md](../CONTEXT.md) — domain glossary (abstention, held-out task,
  provenance).
