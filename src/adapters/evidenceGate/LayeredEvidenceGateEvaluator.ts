/**
 * Deterministic implementation of the evidence gates (docs/evidence-gates.md).
 *
 * Evaluation order follows §6 of the spec: hard stops first (any one forces
 * RED), then gates A..G set the permission ceiling, then the prototype /
 * pilot / autonomy tier minimums raise it. The ceiling is always the highest
 * tier whose minimums are fully met with no active hard stop; when in doubt
 * the evaluator returns the lower tier and names the missing evidence.
 */

import type { Clock } from '../../core/clock.js';
import { systemClock } from '../../core/clock.js';
import { SCHEMA_VERSIONS } from '../../domain/records.js';
import type { EvidenceGateEvaluator } from '../../ports/index.js';
import type {
  AssessmentFeasibilityReport,
  DecisionRecord,
  DomainEvidence,
  EvidenceGateStatus,
  GateFinding,
} from '../../domain/evidenceGate.js';
import {
  MIN_EXACT_STABILITY_FOR_PILOT,
  MIN_LABELED_PER_CELL_FOR_PILOT,
  MIN_LABELED_PER_SCORE_FOR_PILOT,
  MIN_LABELED_PER_SCORE_FOR_PROTOTYPE,
  MIN_PROMPT_FAMILIES_FOR_PROTOTYPE,
  MIN_UNTOUCHED_FAMILIES_FOR_PROTOTYPE,
  STATUS_MAX_PERMISSION,
} from '../../domain/evidenceGate.js';

/** Labeled examples in hand for a score point (missing key = zero). */
function labeledCount(e: DomainEvidence, score: string): number {
  return e.coverage.labeledCountPerScorePoint[score] ?? 0;
}

/**
 * Supported scores below the prototype per-score minimum. These are demoted
 * to unsupportedRegions — an incomplete prototype is allowed as long as it
 * does not claim the thin regions (the gate scopes claims, it does not block
 * research).
 */
function demotedScorePoints(e: DomainEvidence): string[] {
  return e.coverage.supportedScorePoints.filter(
    (s) => labeledCount(e, s) < MIN_LABELED_PER_SCORE_FOR_PROTOTYPE,
  );
}

export class LayeredEvidenceGateEvaluator implements EvidenceGateEvaluator {
  readonly specVersion = 'evidence-gates@1';

  constructor(private readonly clock: Clock = systemClock) {}

  evaluate(evidence: DomainEvidence): DecisionRecord {
    const hardStops = collectHardStops(evidence);
    const softStops: string[] = [];
    const missingEvidence: string[] = [];

    const gates = {
      A_construct: gateA(evidence),
      B_authority: {
        ...gateB(evidence),
        rubricVersion: evidence.rubric.version,
      },
      C_groundTruth: {
        ...gateC(evidence),
        labelSource: evidence.groundTruth.labelSource,
      },
      D_coverage: gateD(evidence),
      E_evaluation: gateE(evidence),
      F_safety: gateF(evidence),
      G_value: gateG(evidence),
    };

    let status: EvidenceGateStatus;

    if (hardStops.length > 0) {
      status = 'RED';
      missingEvidence.push(...hardStops);
    } else if (!gates.A_construct.pass || !gates.B_authority.pass) {
      // No statable construct / no rubric are hard stops; reaching here means
      // gate B failed on provenance details (unversioned, unlicensed,
      // unsnapshotted, unvalidated): acquirable, so AMBER.
      status = 'AMBER';
      missingEvidence.push(
        gates.A_construct.pass
          ? gates.B_authority.notes
          : gates.A_construct.notes,
      );
    } else if (!gates.C_groundTruth.pass) {
      status = 'AMBER';
      missingEvidence.push(`labels: ${gates.C_groundTruth.notes}`);
    } else if (!minimalCoverage(evidence)) {
      status = 'AMBER';
      missingEvidence.push(`coverage: ${gates.D_coverage.notes}`);
    } else if (!meetsPrototypeMinimums(evidence, missingEvidence)) {
      status = 'AMBER';
    } else {
      status = 'YELLOW';
      if (
        meetsPilotMinimums(evidence, softStops) &&
        gates.F_safety.pass &&
        gates.G_value.pass
      ) {
        status = 'BLUE';
        if (meetsAutonomyMinimums(evidence, softStops)) {
          status = 'GREEN';
        }
      } else {
        if (!gates.F_safety.pass)
          softStops.push(`safety: ${gates.F_safety.notes}`);
        if (!gates.G_value.pass)
          softStops.push(`value: ${gates.G_value.notes}`);
      }
    }

    const unsupportedRegions = deriveUnsupportedRegions(evidence, status);
    const nextExperiment = cheapestFalsifyingExperiment(
      hardStops,
      missingEvidence,
      softStops,
      status,
    );

    return {
      schemaVersion: SCHEMA_VERSIONS.decisionRecord,
      domainId: evidence.domainId,
      evaluatedAt: this.clock.now(),
      status,
      maxPermission: STATUS_MAX_PERMISSION[status],
      construct: evidence.construct,
      gates,
      supportedBoundary: status === 'GREEN' ? evidence.supportedBoundary : null,
      unsupportedRegions,
      hardStops,
      softStops,
      nextExperiment,
      report: buildReport(
        evidence,
        status,
        missingEvidence,
        unsupportedRegions,
        nextExperiment,
      ),
    };
  }
}

/** Hard stops (spec §6): any one forces RED regardless of anything else. */
function collectHardStops(e: DomainEvidence): string[] {
  const stops: string[] = [];
  if (!constructIsStatable(e)) {
    stops.push('no statable construct (Gate A)');
  }
  if (e.rubric.kind === 'none') {
    stops.push('no stable, approved rubric of any kind (Gate B)');
  }
  if (
    e.groundTruth.inHand &&
    (!e.groundTruth.humanOrOfficial ||
      !e.groundTruth.attributed ||
      !e.groundTruth.leakageFree)
  ) {
    stops.push(
      'labels untrustworthy, unattributed, model-generated, or leaking the target',
    );
  }
  if (!e.safety.lawfulBasis || !e.safety.privacySatisfiable) {
    stops.push('no lawful basis, or privacy/retention cannot be satisfied');
  }
  if (!e.deterministicRulesImplementable) {
    stops.push(
      'deterministic rubric rules (e.g. zero cascade) cannot be implemented correctly',
    );
  }
  if (!e.evaluation.holdoutPossible) {
    stops.push(
      'a leakage-safe holdout at the correct grouping level is impossible',
    );
  }
  return stops;
}

function constructIsStatable(e: DomainEvidence): boolean {
  const c = e.construct;
  return (
    c.skill.trim() !== '' &&
    c.population.trim() !== '' &&
    c.genres.length > 0 &&
    c.purpose.trim() !== '' &&
    c.decision.trim() !== ''
  );
}

function gateA(e: DomainEvidence): GateFinding {
  return constructIsStatable(e)
    ? { pass: true, notes: `${e.construct.skill} / ${e.construct.population}` }
    : {
        pass: false,
        notes:
          'construct, population, genre, purpose, or decision missing — you cannot score what you cannot define',
      };
}

function gateB(e: DomainEvidence): GateFinding {
  const r = e.rubric;
  if (r.kind === 'none') {
    return { pass: false, notes: 'no rubric or decision procedure' };
  }
  const gaps: string[] = [];
  if (r.version === null) gaps.push('unversioned');
  if (!r.licensed) gaps.push('unlicensed');
  if (!r.snapshotted) gaps.push('not snapshotted/checksummed');
  if (!r.validated) gaps.push('not validated for scoring use');
  return gaps.length === 0
    ? { pass: true, notes: `${r.kind} rubric from ${r.authority}` }
    : { pass: false, notes: `rubric exists but ${gaps.join(', ')}` };
}

function gateC(e: DomainEvidence): GateFinding {
  const g = e.groundTruth;
  if (!g.inHand) {
    return { pass: false, notes: 'labels not yet in hand' };
  }
  const gaps: string[] = [];
  if (!g.humanOrOfficial) gaps.push('not human/official');
  if (!g.attributed) gaps.push('rater provenance unknown');
  if (!g.leakageFree) gaps.push('labels leak the target');
  if (!g.pairedWithSources)
    gaps.push('responses missing prompt/source pairing');
  return gaps.length === 0
    ? {
        pass: true,
        notes: g.disagreementInfoAvailable
          ? `trusted labels from ${g.labelSource}`
          : `trusted labels from ${g.labelSource}; limited rater-disagreement info`,
      }
    : { pass: false, notes: gaps.join(', ') };
}

function minimalCoverage(e: DomainEvidence): boolean {
  return (
    e.coverage.promptFamilyCount >= 1 &&
    e.coverage.supportedScorePoints.some(
      (s) => labeledCount(e, s) >= MIN_LABELED_PER_SCORE_FOR_PROTOTYPE,
    )
  );
}

function gateD(e: DomainEvidence): GateFinding {
  const c = e.coverage;
  const thin = demotedScorePoints(e);
  const gaps: string[] = [];
  if (thin.length > 0) {
    gaps.push(
      `score points below the ${MIN_LABELED_PER_SCORE_FOR_PROTOTYPE}-example smoke-test minimum: ${thin.join(', ')}`,
    );
  }
  if (c.invalidCaseTypesCovered.length === 0) {
    gaps.push('no invalid/adversarial cases covered');
  }
  if (!c.extractionQualityKnown) {
    gaps.push('extraction/OCR quality unknown per record');
  }
  if (c.minLabeledPerReportedCell < MIN_LABELED_PER_CELL_FOR_PILOT) {
    gaps.push(
      `sparse per-cell coverage (min ${c.minLabeledPerReportedCell} labeled per reported cell; pilot default needs >= ${MIN_LABELED_PER_CELL_FOR_PILOT})`,
    );
  }
  return gaps.length === 0
    ? {
        pass: true,
        notes: `${c.promptFamilyCount} families, all supported scores represented`,
      }
    : { pass: false, notes: gaps.join('; ') };
}

function gateE(e: DomainEvidence): GateFinding {
  const v = e.evaluation;
  const gaps: string[] = [];
  if (!v.holdoutPossible) gaps.push('no valid holdout possible');
  if (!v.leakageSafeSplitsAtFamilyLevel)
    gaps.push('splits not locked at prompt-family level');
  if (!v.metricsPreregistered) gaps.push('metrics not preregistered');
  if (!v.baselinesDefined) gaps.push('no baselines defined');
  if (v.exactTraitScoreStabilityRate === null)
    gaps.push('repeated-run stability not measured');
  if (!v.perCellSamplesSufficient)
    gaps.push('per-cell samples too few for interpretable CIs');
  return gaps.length === 0
    ? { pass: true, notes: 'locked, leakage-safe, preregistered evaluation' }
    : { pass: false, notes: gaps.join('; ') };
}

function gateF(e: DomainEvidence): GateFinding {
  const s = e.safety;
  const gaps: string[] = [];
  if (!s.inputValidationAndInjectionDefense) gaps.push('no injection defense');
  if (!s.abstentionImplemented) gaps.push('no abstention');
  if (!s.humanRoutingImplemented) gaps.push('no human routing');
  if (!s.auditTrailImplemented) gaps.push('no audit trail');
  if (!s.privacyImplemented)
    gaps.push('privacy/retention handling not implemented');
  if (!s.monitoringImplemented) gaps.push('no monitoring');
  return gaps.length === 0
    ? {
        pass: true,
        notes: 'abstention, routing, audit, privacy, and monitoring in place',
      }
    : { pass: false, notes: gaps.join('; ') };
}

function gateG(e: DomainEvidence): GateFinding {
  const v = e.value;
  const gaps: string[] = [];
  if (!v.improvesOnAlternative)
    gaps.push('no improvement over current alternative');
  if (!v.feedbackValidityChecked) gaps.push('feedback validity unchecked');
  if (!v.costJustified) gaps.push('cost/latency/complexity not justified');
  return gaps.length === 0
    ? {
        pass: true,
        notes: 'beats the current alternative with checked feedback',
      }
    : { pass: false, notes: gaps.join('; ') };
}

/** Prototype minimums (spec §5). Appends what is missing to `missing`. */
function meetsPrototypeMinimums(e: DomainEvidence, missing: string[]): boolean {
  const gaps: string[] = [];
  if (
    e.rubric.version === null ||
    !e.rubric.snapshotted ||
    !e.rubric.licensed ||
    !e.rubric.validated
  ) {
    gaps.push('approved, versioned, snapshotted, licensed rubric');
  }
  if (!e.groundTruth.recordsComplete) {
    gaps.push(
      'complete records (response + prompt + sources + score + provenance)',
    );
  }
  if (e.coverage.promptFamilyCount < MIN_PROMPT_FAMILIES_FOR_PROTOTYPE) {
    gaps.push(
      `>= ${MIN_PROMPT_FAMILIES_FOR_PROTOTYPE} independent prompt families`,
    );
  }
  // Thin score points are demoted to unsupportedRegions rather than blocking
  // the prototype; only a domain where NO score clears the minimum has
  // nothing left to prototype on.
  if (demotedScorePoints(e).length === e.coverage.supportedScorePoints.length) {
    gaps.push(
      `at least one trait score with >= ${MIN_LABELED_PER_SCORE_FOR_PROTOTYPE} labeled examples`,
    );
  }
  if (
    e.evaluation.untouchedFamilyCount < MIN_UNTOUCHED_FAMILIES_FOR_PROTOTYPE
  ) {
    gaps.push('at least one untouched prompt family held out from all tuning');
  }
  if (!e.evaluation.baselinesDefined) {
    gaps.push('a measurable baseline to beat');
  }
  missing.push(...gaps.map((g) => `prototype minimums: ${g}`));
  return gaps.length === 0;
}

/** Pilot minimums (spec §5). Appends caps to `softStops`. */
function meetsPilotMinimums(e: DomainEvidence, softStops: string[]): boolean {
  const gaps: string[] = [];
  if (e.coverage.minLabeledPerReportedCell < MIN_LABELED_PER_CELL_FOR_PILOT) {
    gaps.push(
      `insufficient per-(score x family) coverage (min ${e.coverage.minLabeledPerReportedCell}, need >= ${MIN_LABELED_PER_CELL_FOR_PILOT})`,
    );
  }
  const underCalibrated = e.coverage.supportedScorePoints.filter(
    (s) => labeledCount(e, s) < MIN_LABELED_PER_SCORE_FOR_PILOT,
  );
  if (underCalibrated.length > 0) {
    gaps.push(
      `scores below the ${MIN_LABELED_PER_SCORE_FOR_PILOT}-example calibration minimum: ${underCalibrated.join(', ')}`,
    );
  }
  if (e.evaluation.scorePointsWithZeroRecall.length > 0) {
    gaps.push(
      `zero-recall legal scores cannot pilot: ${e.evaluation.scorePointsWithZeroRecall.join(', ')}`,
    );
  }
  if (!e.evaluation.leakageSafeSplitsAtFamilyLevel)
    gaps.push('no leakage-safe dev/val/test split');
  if (e.evaluation.exactTraitScoreStabilityRate === null) {
    gaps.push('repeated-run stability not measured');
  } else if (
    e.evaluation.exactTraitScoreStabilityRate < MIN_EXACT_STABILITY_FOR_PILOT
  ) {
    gaps.push(
      `exact trait-score stability ${e.evaluation.exactTraitScoreStabilityRate} below the ${MIN_EXACT_STABILITY_FOR_PILOT} floor`,
    );
  }
  if (e.evaluation.repeatDisagreementPolicy === 'unhandled') {
    gaps.push(
      'no consensus/abstention policy for disagreeing repeated model scores',
    );
  }
  if (!e.evaluation.perCellSamplesSufficient)
    gaps.push('per-cell samples too few for interpretable CIs');
  if (!e.evaluation.blindExpertReviewDone) gaps.push('no blind expert review');
  if (!e.safety.abstentionImplemented || !e.safety.errorPathsTested) {
    gaps.push('abstention and provider-error paths not implemented/tested');
  }
  if (
    e.pilotReviews.sourceUseMatters &&
    !e.pilotReviews.sourceFidelityReviewDone
  ) {
    gaps.push('source-fidelity review missing while source use matters');
  }
  if (
    e.pilotReviews.emitsConventionsFeedback &&
    !e.pilotReviews.conventionsDiagnosticReviewDone
  ) {
    gaps.push(
      'conventions diagnostic review missing while conventions feedback is emitted',
    );
  }
  if (
    e.pilotReviews.emitsStudentFeedback &&
    !e.pilotReviews.feedbackIsolatedFromScoring
  ) {
    gaps.push(
      'student feedback is not isolated from scoring — encouragement pressure can inflate scores',
    );
  }
  softStops.push(...gaps.map((g) => `pilot minimums: ${g}`));
  return gaps.length === 0;
}

/** Autonomy minimums (spec §5). Appends caps to `softStops`. */
function meetsAutonomyMinimums(
  e: DomainEvidence,
  softStops: string[],
): boolean {
  const a = e.autonomy;
  const gaps: string[] = [];
  if (!a.nonInferiorToHuman)
    gaps.push('non-inferiority to human agreement not demonstrated');
  if (!a.perTraitMetricsWithCIs)
    gaps.push('per-trait metrics with CIs missing');
  if (!a.summedQwkAndSmdReported)
    gaps.push('summed-score QWK and SMD not reported');
  if (!a.calibratedConfidenceRoutingRetained)
    gaps.push('calibrated confidence + human routing not retained');
  if (!a.subgroupSlicesEvaluated) gaps.push('subgroup slices not evaluated');
  if (!a.severeErrorLimitsHeld) gaps.push('severe-error limits not held');
  if (!a.continuousMonitoring) gaps.push('no continuous monitoring');
  if (!a.rollbackApproved) gaps.push('no approved rollback to human scoring');
  if (!a.perScorePrecisionRecallFloorsMet)
    gaps.push('per-score precision/recall floors not met');
  if (!a.scoreDistributionDivergenceAcceptable)
    gaps.push(
      'score distribution diverges from human scores (or middle-score collapse persists)',
    );
  if (!a.routingPerformanceMeasured)
    gaps.push('auto-scored vs human-routed accuracy not measured separately');
  if (!a.autoScoreCoverageReported)
    gaps.push('auto-scoreable coverage rate not reported');
  if (!a.recalibrationTriggersDefined)
    gaps.push(
      'no recalibration triggers for rubric/model/prompt/corpus/population changes',
    );
  if (!a.deterministicRulesVerifiedCorrect)
    gaps.push('deterministic rules (zero cascade) not verified 100% correct');
  softStops.push(...gaps.map((g) => `autonomy minimums: ${g}`));
  return gaps.length === 0;
}

function deriveUnsupportedRegions(
  e: DomainEvidence,
  status: EvidenceGateStatus,
): string[] {
  if (status === 'RED' || status === 'AMBER') {
    return e.declaredUnsupportedRegions;
  }
  const merged = new Set<string>([
    ...e.declaredUnsupportedRegions,
    ...demotedScorePoints(e),
    ...e.evaluation.scorePointsWithZeroRecall,
  ]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

/**
 * The single lowest-cost test that could disprove feasibility fastest: the
 * first active blocker, phrased as the experiment that would resolve it.
 */
function cheapestFalsifyingExperiment(
  hardStops: string[],
  missingEvidence: string[],
  softStops: string[],
  status: EvidenceGateStatus,
): string {
  const first = hardStops[0] ?? missingEvidence[0] ?? softStops[0];
  if (first !== undefined) {
    return `resolve or falsify: ${first}`;
  }
  if (status === 'GREEN') {
    return 'attempt to breach the validated boundary with adversarial and out-of-boundary cases; any severe error falsifies the boundary';
  }
  return 'acquire the next-tier evidence and re-gate';
}

function buildReport(
  e: DomainEvidence,
  status: EvidenceGateStatus,
  missingEvidence: string[],
  unsupportedRegions: string[],
  nextExperiment: string,
): AssessmentFeasibilityReport {
  const maxPermission = STATUS_MAX_PERMISSION[status];
  return {
    discoveredSources: e.discoveredSources,
    supportedClaims: [
      `permission tier: ${maxPermission} (${status}) for domain ${e.domainId}`,
    ],
    unsupportedClaims: unsupportedRegions.map(
      (r) => `${r} is not supported by the current evidence`,
    ),
    missingEvidence,
    acquisitionPlan: missingEvidence.map((m) => `acquire: ${m}`),
    legalPrivacyIssues:
      e.safety.lawfulBasis && e.safety.privacySatisfiable
        ? []
        : ['lawful basis or privacy/retention unresolved'],
    nextExperiment,
  };
}
