/**
 * Domain types for the evidence gates: the layered decision policy that
 * determines how far a writing-assessment domain may be pursued after source
 * discovery. This is the machine-readable form of docs/evidence-gates.md —
 * the DecisionRecord here mirrors the record shape in §3 of the spec, and the
 * evaluator that computes it implements the algorithm in §6.
 *
 * A successful scrape grants only permission to investigate. Everything past
 * that is earned gate by gate.
 */

import type { IsoTimestamp } from './types.js';

/** The single machine-readable outcome enum (spec §3). Labels are labels only. */
export const EVIDENCE_GATE_STATUSES = [
  'RED',
  'AMBER',
  'YELLOW',
  'BLUE',
  'GREEN',
] as const;

export type EvidenceGateStatus = (typeof EVIDENCE_GATE_STATUSES)[number];

/** The four separately earned permissions (spec §1). */
export const PERMISSION_TIERS = [
  'investigate',
  'prototype',
  'pilot',
  'autonomous',
] as const;

export type PermissionTier = (typeof PERMISSION_TIERS)[number];

/** Maximum permission each status authorizes (spec §3 table). */
export const STATUS_MAX_PERMISSION: Record<EvidenceGateStatus, PermissionTier> =
  {
    RED: 'investigate',
    AMBER: 'investigate',
    YELLOW: 'prototype',
    BLUE: 'pilot',
    GREEN: 'autonomous',
  };

/** Default tier minimums (spec §5): hackathon-scale defaults, not constants of nature. */
export const MIN_PROMPT_FAMILIES_FOR_PROTOTYPE = 3;
export const MIN_UNTOUCHED_FAMILIES_FOR_PROTOTYPE = 1;
export const MIN_LABELED_PER_CELL_FOR_PILOT = 8;

/** Gate A: what is being scored, for whom, and what decision the score drives. */
export interface ConstructDefinition {
  /** The writing skill measured — never a vague "quality". */
  skill: string;
  /** Who writes these responses (e.g. "TX grades 3-5"). */
  population: string;
  /** Genres scored, each on its own rubric where rubrics differ. */
  genres: string[];
  /** Formative feedback, summative grade, placement, practice, ... */
  purpose: string;
  /** The concrete decision the score drives. No decision, no value to gate. */
  decision: string;
}

/** Gate B: authority and provenance of the rubric. */
export interface RubricEvidence {
  /** Who authored/approved the rule set. Substitutes allowed per spec §9. */
  kind: 'official' | 'expert' | 'user-approved' | 'none';
  /** Version identifier the scores will be tied to (null = unversioned). */
  version: string | null;
  /** Publisher / authority the rubric traces to. */
  authority: string;
  /** The rubric and bundled materials may lawfully be used. */
  licensed: boolean;
  /** Captured content-addressed (checksummed snapshot exists). */
  snapshotted: boolean;
  /**
   * Validated for scoring use (inter-rater tested against real responses).
   * An unvalidated rubric — official or not — caps the domain at
   * investigation (spec §9).
   */
  validated: boolean;
}

/** Gate C: trustworthy labels to calibrate and measure against. */
export interface GroundTruthEvidence {
  /** Labels are acquired and usable, not merely known to exist. */
  inHand: boolean;
  /** Human/official scores, never model-generated. */
  humanOrOfficial: boolean;
  /** Rater provenance is known (who scored, under what training). */
  attributed: boolean;
  /** Labels are not derivable from features visible at scoring time. */
  leakageFree: boolean;
  /** Each labeled response is paired with its prompt and source passages. */
  pairedWithSources: boolean;
  /** Records used are complete; incomplete records are excluded, not patched. */
  recordsComplete: boolean;
  /** Rater disagreement / adjudication information is available (soft). */
  disagreementInfoAvailable: boolean;
  /** Human-readable description of where the labels come from. */
  labelSource: string;
}

/** Gate D: does the evidence span what the scorer will encounter? */
export interface CoverageEvidence {
  /** Distinct prompt + source-set families, not many responses to one prompt. */
  promptFamilyCount: number;
  /** Every legal score point the domain claims to support (e.g. "devOrg=3"). */
  supportedScorePoints: string[];
  /** Score points with at least one labeled example in hand. */
  representedScorePoints: string[];
  /** Invalid/adversarial case types covered (off-topic, blank, injection...). */
  invalidCaseTypesCovered: string[];
  /** Extraction/OCR quality is recorded per record, not assumed. */
  extractionQualityKnown: boolean;
  /**
   * Minimum labeled-example count across the (score x family) cells the
   * domain reports on. Below MIN_LABELED_PER_CELL_FOR_PILOT, that cell's
   * error is invisible and the domain cannot pilot on it.
   */
  minLabeledPerReportedCell: number;
}

/** Gate E: can the scorer be measured credibly? */
export interface EvaluationEvidence {
  /** A leakage-safe holdout is possible at all (false = hard stop). */
  holdoutPossible: boolean;
  /** Dev/val/test split locked at the prompt-family level. */
  leakageSafeSplitsAtFamilyLevel: boolean;
  /** Families excluded from all tuning. */
  untouchedFamilyCount: number;
  /** Metrics chosen before running (per-trait exact/adjacent, QWK, MAE...). */
  metricsPreregistered: boolean;
  /** Human/workflow and trivial baselines defined. */
  baselinesDefined: boolean;
  /** Repeated runs executed and stability reported. */
  repeatedRunsDone: boolean;
  /** Per-cell samples large enough for interpretable uncertainty intervals. */
  perCellSamplesSufficient: boolean;
  /** Supported score points the current scorer never predicts. */
  scorePointsWithZeroRecall: string[];
  /** A qualified human blind-reviewed a sample of machine scores. */
  blindExpertReviewDone: boolean;
}

/** Gate F: can it run without harming users or losing accountability? */
export interface SafetyEvidence {
  /** A lawful basis to use the data exists at all (false = hard stop). */
  lawfulBasis: boolean;
  /** Privacy/retention requirements can be satisfied (false = hard stop). */
  privacySatisfiable: boolean;
  /** Input validation + prompt-injection defense on all untrusted text. */
  inputValidationAndInjectionDefense: boolean;
  /** The scorer can decline to judge instead of guessing. */
  abstentionImplemented: boolean;
  /** Provider failures surface as errors, never as fake scores. */
  errorPathsTested: boolean;
  /** Low-confidence / abstained / out-of-boundary cases route to a person. */
  humanRoutingImplemented: boolean;
  /** Every score records model, prompt, rubric, and data versions. */
  auditTrailImplemented: boolean;
  /** FERPA/COPPA-grade handling, minimal retention, deletion path — in place. */
  privacyImplemented: boolean;
  /** Drift, error rates, and routing volume are watched in operation. */
  monitoringImplemented: boolean;
}

/** Gate G: is it worth it? */
export interface ValueEvidence {
  /** Useful improvement over the current human/workflow alternative. */
  improvesOnAlternative: boolean;
  /** If students see feedback, its correctness is checked — not just scores. */
  feedbackValidityChecked: boolean;
  /** Cost, latency, and complexity are justified by the value delivered. */
  costJustified: boolean;
}

/** Product-safety reviews that gate a pilot when they apply (spec §5). */
export interface PilotReviewEvidence {
  /** Source use matters for this domain (source-based writing). */
  sourceUseMatters: boolean;
  /** Fabricated/misattributed-evidence review done. */
  sourceFidelityReviewDone: boolean;
  /** The product emits detailed conventions feedback. */
  emitsConventionsFeedback: boolean;
  /** Manually reviewed conventions error set exists. */
  conventionsDiagnosticReviewDone: boolean;
}

/** Evidence required only for bounded autonomous operation (spec §5). */
export interface AutonomyEvidence {
  /** Demonstrably not worse than the human process, within a set margin. */
  nonInferiorToHuman: boolean;
  /** Per-trait metrics with confidence intervals reported. */
  perTraitMetricsWithCIs: boolean;
  /** Summed-score QWK and SMD reported alongside per-trait metrics (§4). */
  summedQwkAndSmdReported: boolean;
  /** Confidence scores are calibrated and low confidence routes to humans. */
  calibratedConfidenceRoutingRetained: boolean;
  /** Subgroup slices evaluated where lawful and available. */
  subgroupSlicesEvaluated: boolean;
  /** Hard caps on the worst errors, monitored continuously. */
  severeErrorLimitsHeld: boolean;
  /** Drift and error monitoring live in production. */
  continuousMonitoring: boolean;
  /** A tested, authorized path back to human scoring. */
  rollbackApproved: boolean;
}

/** A rubric, corpus, or reference found during discovery (feasibility report §8). */
export interface DiscoveredSource {
  name: string;
  url: string;
  authority: string;
  license: string;
  version: string;
  checksum: string;
}

/** The validated boundary autonomy is confined to (spec §3 record shape). */
export interface SupportedBoundary {
  grades: number[];
  genres: string[];
  traitScores: Record<string, number[]>;
}

/**
 * Everything the gate consumes: the discovery + evidence state of one domain.
 * This is the input seam — a scraper/investigator fills this in; the evaluator
 * never goes and looks for evidence itself.
 */
export interface DomainEvidence {
  domainId: string;
  construct: ConstructDefinition;
  rubric: RubricEvidence;
  groundTruth: GroundTruthEvidence;
  coverage: CoverageEvidence;
  evaluation: EvaluationEvidence;
  safety: SafetyEvidence;
  value: ValueEvidence;
  pilotReviews: PilotReviewEvidence;
  autonomy: AutonomyEvidence;
  /** Deterministic rubric rules (e.g. STAAR zero cascade) implementable. */
  deterministicRulesImplementable: boolean;
  /** The boundary the evidence actually covers (used verbatim for GREEN). */
  supportedBoundary: SupportedBoundary;
  /** Requested-but-unjustified regions declared by the investigator. */
  declaredUnsupportedRegions: string[];
  discoveredSources: DiscoveredSource[];
}

/** One gate's finding inside the decision record. */
export interface GateFinding {
  pass: boolean;
  notes: string;
}

/** What the system returns when it refuses — and, reduced, at every tier (§8). */
export interface AssessmentFeasibilityReport {
  discoveredSources: DiscoveredSource[];
  supportedClaims: string[];
  unsupportedClaims: string[];
  missingEvidence: string[];
  acquisitionPlan: string[];
  legalPrivacyIssues: string[];
  nextExperiment: string;
}

/**
 * The auditable artifact of one gate evaluation (spec §3). Exactly one status;
 * the status is the highest tier whose minimums are fully met with no active
 * hard stop.
 */
export interface DecisionRecord {
  schemaVersion: number;
  domainId: string;
  evaluatedAt: IsoTimestamp;
  status: EvidenceGateStatus;
  maxPermission: PermissionTier;
  construct: ConstructDefinition;
  gates: {
    A_construct: GateFinding;
    B_authority: GateFinding & { rubricVersion: string | null };
    C_groundTruth: GateFinding & { labelSource: string };
    D_coverage: GateFinding;
    E_evaluation: GateFinding;
    F_safety: GateFinding;
    G_value: GateFinding;
  };
  /** Populated (non-null) only when autonomy is granted. */
  supportedBoundary: SupportedBoundary | null;
  unsupportedRegions: string[];
  hardStops: string[];
  softStops: string[];
  /** The cheapest experiment that could falsify feasibility next. */
  nextExperiment: string;
  report: AssessmentFeasibilityReport;
}
