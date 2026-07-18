/**
 * DomainEvidence for the writing engine's own demo domains, so the runtime
 * gate (docs/evidence-gates.md) can be enforced on the heartbeat itself.
 *
 * Interpretation note: the evidence schema was written for human-scored
 * assessment domains (see staarEvidence.ts). For a self-assessed
 * deterministic-rubric domain the honest readings, documented per field
 * below, are: the human-authored decision procedure (rubric@1 plus the
 * deterministic validators) IS the ground truth; repeat agreement is 1.0 by
 * construction because the demo evaluator is deterministic; and there is no
 * pre-assigned label channel that could leak into scoring.
 */

import type { DomainEvidence } from '../domain/evidenceGate.js';

/**
 * The offline demo domain: decision memos over the frozen civic fixture feed,
 * scored by the deterministic rubric@1 evaluator against the 3-family
 * benchmark (one family held out).
 *
 * Expected gate outcome: YELLOW — permission to prototype. Honest ceilings:
 * per-cell coverage is far below pilot minimums, no blind expert review, and
 * production monitoring does not exist.
 */
export const txCivicMemoEvidence: DomainEvidence = {
  domainId: 'tx-civic-memo',
  construct: {
    skill: 'source-grounded decision-memo writing over a civic data feed',
    population: 'writing-engine demo agent',
    genres: ['decision-memo'],
    purpose: 'demonstrate measurable self-improvement (recursive intelligence)',
    decision: 'seven rubric dimension scores + lesson extraction per cycle',
  },
  rubric: {
    kind: 'user-approved',
    version: 'rubric@1',
    authority: 'writing-engine brief (docs/organizer, frozen 7 dimensions)',
    licensed: true, // authored in-repo, MIT
    snapshotted: true, // versioned in git; scores carry rubricVersion
    validated: true, // deterministic checks reviewed against the brief
  },
  groundTruth: {
    inHand: true,
    // The human-authored deterministic procedure is the label source; there
    // is no separate human-rater channel for this synthetic domain.
    humanOrOfficial: true,
    attributed: true, // procedure authored and versioned in this repo
    leakageFree: true, // no pre-assigned labels exist to leak
    pairedWithSources: true, // every artifact links its snapshot + evidence
    recordsComplete: true,
    disagreementInfoAvailable: false,
    labelSource:
      'deterministic rubric@1 verdicts over the frozen benchmark fixture v1',
  },
  coverage: {
    promptFamilyCount: 3, // benchmark families; exactly the prototype minimum
    supportedScorePoints: [
      'sourceFidelity',
      'insight',
      'audienceUsefulness',
      'structure',
      'style',
      'freshness',
      'safety',
    ],
    // 3 tasks x 3 cycles per benchmark run exercise every dimension.
    labeledCountPerScorePoint: {
      sourceFidelity: 9,
      insight: 9,
      audienceUsefulness: 9,
      structure: 9,
      style: 9,
      freshness: 9,
      safety: 9,
    },
    invalidCaseTypesCovered: ['prompt-injection', 'staleness'],
    extractionQualityKnown: true, // fixtures are authored, not extracted
    minLabeledPerReportedCell: 3, // honest: below the pilot default of 8
  },
  evaluation: {
    holdoutPossible: true,
    leakageSafeSplitsAtFamilyLevel: true,
    untouchedFamilyCount: 1, // the held-out benchmark task
    metricsPreregistered: true, // per-dimension delta + aggregate, frozen
    baselinesDefined: true, // lesson-free cycle 0
    exactTraitScoreStabilityRate: 1.0, // deterministic evaluator, by construction
    repeatDisagreementPolicy: 'abstain',
    perCellSamplesSufficient: false,
    scorePointsWithZeroRecall: [],
    blindExpertReviewDone: false,
  },
  safety: {
    lawfulBasis: true,
    privacySatisfiable: true,
    inputValidationAndInjectionDefense: true, // deterministic injection check
    abstentionImplemented: true, // evaluator abstention is a first-class state
    errorPathsTested: true,
    humanRoutingImplemented: true, // human publishing gate; no auto-publish path
    auditTrailImplemented: true, // versioned, content-addressed records
    privacyImplemented: true, // synthetic data only
    monitoringImplemented: false, // no production monitoring exists
  },
  value: {
    improvesOnAlternative: true, // vs. a static prompt with no learning loop
    feedbackValidityChecked: true, // lessons are validated against later wins
    costJustified: true, // zero-cost deterministic demo
  },
  pilotReviews: {
    sourceUseMatters: true,
    sourceFidelityReviewDone: false,
    emitsConventionsFeedback: false,
    conventionsDiagnosticReviewDone: false,
    emitsStudentFeedback: false, // memos go to an operator, not students
    feedbackIsolatedFromScoring: true, // writer never sees evaluator scores
  },
  autonomy: {
    nonInferiorToHuman: false,
    perTraitMetricsWithCIs: false,
    summedQwkAndSmdReported: false,
    calibratedConfidenceRoutingRetained: false,
    subgroupSlicesEvaluated: false,
    severeErrorLimitsHeld: false,
    continuousMonitoring: false,
    rollbackApproved: false,
    perScorePrecisionRecallFloorsMet: false,
    scoreDistributionDivergenceAcceptable: false,
    routingPerformanceMeasured: false,
    autoScoreCoverageReported: false,
    recalibrationTriggersDefined: false,
    deterministicRulesVerifiedCorrect: true, // validators have dedicated tests
  },
  deterministicRulesImplementable: true,
  supportedBoundary: {
    grades: [],
    genres: ['decision-memo'],
    traitScores: {},
  },
  declaredUnsupportedRegions: ['live feed domains without a frozen benchmark'],
  discoveredSources: [
    {
      name: 'tx-demo-civic-feed fixture',
      url: 'src/fixtures/events/tx-demo-civic-feed.json',
      authority: 'writing-engine repo (synthetic)',
      license: 'MIT',
      version: 'v1',
      checksum: 'content-addressed via snapshot hashing',
    },
  ],
};

/**
 * The live NWS-alerts domain AS IT WAS before it earned a benchmark: the
 * heartbeat could OBSERVE it (poll + snapshot) but had no prompt families,
 * labels, or baseline for memo-writing over live alerts.
 *
 * Gate outcome: AMBER — permission to investigate only. Preserved (a) as the
 * refusal demo (GATE_DOMAIN=nws-alerts-tx@pre-benchmark) and (b) as the
 * before-state of the arc the current evidence completes: the domain EARNED
 * its way to YELLOW by getting a frozen benchmark
 * (src/benchmark/fixtures/nws-benchmark.json, BENCHMARK_FIXTURE=nws).
 */
export const nwsAlertsPreBenchmarkEvidence: DomainEvidence = {
  domainId: 'nws-alerts-tx@pre-benchmark',
  construct: {
    skill: 'source-grounded decision-memo writing over live NWS alerts',
    population: 'writing-engine live agent',
    genres: ['decision-memo'],
    purpose: 'timely operational awareness memos from live public data',
    decision: 'seven rubric dimension scores + lesson extraction per cycle',
  },
  rubric: {
    kind: 'user-approved',
    version: 'rubric@1',
    authority: 'writing-engine brief (docs/organizer, frozen 7 dimensions)',
    licensed: true,
    snapshotted: true,
    validated: true,
  },
  groundTruth: {
    inHand: false, // no scored memo corpus exists for this feed yet
    humanOrOfficial: false,
    attributed: false,
    leakageFree: true,
    pairedWithSources: false,
    recordsComplete: false,
    disagreementInfoAvailable: false,
    labelSource: 'none yet — live-alert memos have never been benchmarked',
  },
  coverage: {
    promptFamilyCount: 0,
    supportedScorePoints: [
      'sourceFidelity',
      'insight',
      'audienceUsefulness',
      'structure',
      'style',
      'freshness',
      'safety',
    ],
    labeledCountPerScorePoint: {},
    invalidCaseTypesCovered: [],
    extractionQualityKnown: false,
    minLabeledPerReportedCell: 0,
  },
  evaluation: {
    holdoutPossible: true, // alert episodes could form families later
    leakageSafeSplitsAtFamilyLevel: false,
    untouchedFamilyCount: 0,
    metricsPreregistered: true, // same frozen rubric metrics would apply
    baselinesDefined: false,
    exactTraitScoreStabilityRate: null,
    repeatDisagreementPolicy: 'abstain',
    perCellSamplesSufficient: false,
    scorePointsWithZeroRecall: [],
    blindExpertReviewDone: false,
  },
  safety: {
    lawfulBasis: true, // US-government public-domain data
    privacySatisfiable: true,
    inputValidationAndInjectionDefense: true,
    abstentionImplemented: true,
    errorPathsTested: true,
    humanRoutingImplemented: true,
    auditTrailImplemented: true,
    privacyImplemented: true,
    monitoringImplemented: false,
  },
  value: {
    improvesOnAlternative: true,
    feedbackValidityChecked: false,
    costJustified: true,
  },
  pilotReviews: {
    sourceUseMatters: true,
    sourceFidelityReviewDone: false,
    emitsConventionsFeedback: false,
    conventionsDiagnosticReviewDone: false,
    emitsStudentFeedback: false,
    feedbackIsolatedFromScoring: true,
  },
  autonomy: {
    nonInferiorToHuman: false,
    perTraitMetricsWithCIs: false,
    summedQwkAndSmdReported: false,
    calibratedConfidenceRoutingRetained: false,
    subgroupSlicesEvaluated: false,
    severeErrorLimitsHeld: false,
    continuousMonitoring: false,
    rollbackApproved: false,
    perScorePrecisionRecallFloorsMet: false,
    scoreDistributionDivergenceAcceptable: false,
    routingPerformanceMeasured: false,
    autoScoreCoverageReported: false,
    recalibrationTriggersDefined: false,
    deterministicRulesVerifiedCorrect: true,
  },
  deterministicRulesImplementable: true,
  supportedBoundary: {
    grades: [],
    genres: ['decision-memo'],
    traitScores: {},
  },
  declaredUnsupportedRegions: [],
  discoveredSources: [
    {
      name: 'NOAA NWS active alerts (Texas)',
      url: 'https://api.weather.gov/alerts/active?area=TX',
      authority: 'US National Weather Service',
      license: 'US-government public domain',
      version: 'live',
      checksum: 'content-addressed per snapshot at retrieval time',
    },
  ],
};

/**
 * The live NWS-alerts domain with its EARNED evidence: the frozen 3-family
 * benchmark (src/benchmark/fixtures/nws-benchmark.json; flood episode held
 * out) run via BENCHMARK_FIXTURE=nws gives it labels, a lesson-free baseline
 * (aggregate 0.571 -> 1.000 measured), leakage-safe family splits, and
 * deterministic repeat stability — the same honest interpretations as
 * txCivicMemoEvidence, documented there.
 *
 * Expected gate outcome: YELLOW — permission to prototype. Live runs write by
 * default now; the pre-benchmark AMBER state above shows the before-state.
 */
export const nwsAlertsDomainEvidence: DomainEvidence = {
  ...structuredClone(nwsAlertsPreBenchmarkEvidence),
  domainId: 'nws-alerts-tx',
  groundTruth: {
    inHand: true,
    humanOrOfficial: true, // human-authored deterministic procedure (rubric@1)
    attributed: true,
    leakageFree: true,
    pairedWithSources: true,
    recordsComplete: true,
    disagreementInfoAvailable: false,
    labelSource:
      'deterministic rubric@1 verdicts over the frozen NWS benchmark fixture v1',
  },
  coverage: {
    promptFamilyCount: 3, // heat, storm, flood alert episodes
    supportedScorePoints: [
      'sourceFidelity',
      'insight',
      'audienceUsefulness',
      'structure',
      'style',
      'freshness',
      'safety',
    ],
    // 3 tasks x 3 cycles per benchmark run exercise every dimension.
    labeledCountPerScorePoint: {
      sourceFidelity: 9,
      insight: 9,
      audienceUsefulness: 9,
      structure: 9,
      style: 9,
      freshness: 9,
      safety: 9,
    },
    invalidCaseTypesCovered: ['prompt-injection', 'staleness'],
    extractionQualityKnown: true,
    minLabeledPerReportedCell: 3, // honest: below the pilot default of 8
  },
  evaluation: {
    holdoutPossible: true,
    leakageSafeSplitsAtFamilyLevel: true,
    untouchedFamilyCount: 1, // the held-out flood episode
    metricsPreregistered: true,
    baselinesDefined: true, // measured: 0.571 lesson-free baseline
    exactTraitScoreStabilityRate: 1.0, // deterministic evaluator
    repeatDisagreementPolicy: 'abstain',
    perCellSamplesSufficient: false,
    scorePointsWithZeroRecall: [],
    blindExpertReviewDone: false,
  },
  value: {
    improvesOnAlternative: true,
    feedbackValidityChecked: true, // lessons validated against later wins
    costJustified: true,
  },
  declaredUnsupportedRegions: ['live feed domains without a frozen benchmark'],
};

/** Registry for CLI selection via GATE_DOMAIN. */
export const DOMAIN_EVIDENCE: Record<string, DomainEvidence> = {
  [txCivicMemoEvidence.domainId]: txCivicMemoEvidence,
  [nwsAlertsDomainEvidence.domainId]: nwsAlertsDomainEvidence,
  [nwsAlertsPreBenchmarkEvidence.domainId]: nwsAlertsPreBenchmarkEvidence,
};
