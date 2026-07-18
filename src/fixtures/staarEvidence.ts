/**
 * The worked example from docs/evidence-gates.md §7: STAAR grades 3–5 Extended
 * Constructed Response, evaluated against the team's actual current evidence —
 * 117 officially scored TEA responses (2023–2025), official annotations, a
 * source manifest with page-level provenance, and the measured V3.1
 * three-repeat stability benchmark (2026-07-17): total QWK 0.532, consensus
 * exact vs gold 28.2%, per-trait repeat agreement dev 96.6% / conventions
 * 98.3%, cascade accuracy 33.3% on gold-zero observations. The repeats are
 * stable but wrong the same way every time — calibration, not stochasticity.
 *
 * Expected outcome: YELLOW (prototype ceiling). Prototyping is the right next
 * step; a pilot is reachable but not yet earned (sparse per-cell coverage,
 * zero-recall top scores, no blind review); autonomy is far off.
 */

import type { DomainEvidence } from '../domain/evidenceGate.js';

export const staarEcrEvidence: DomainEvidence = {
  domainId: 'staar-ecr-g3-5',
  construct: {
    skill: 'development-organization + conventions (source-based ECR)',
    population: 'TX grades 3-5',
    genres: ['informational', 'argumentative'],
    purpose: 'formative + practice',
    decision: 'trait scores + targeted feedback',
  },
  rubric: {
    kind: 'official',
    version: 'tea-ecr-g3-5@2023',
    authority: 'Texas Education Agency',
    licensed: true,
    snapshotted: true,
    validated: true,
  },
  groundTruth: {
    inHand: true,
    humanOrOfficial: true,
    attributed: true,
    leakageFree: true,
    pairedWithSources: true,
    recordsComplete: true,
    disagreementInfoAvailable: false,
    labelSource: 'TEA scoring guides (117 scored responses, 2023-2025)',
  },
  coverage: {
    promptFamilyCount: 9,
    supportedScorePoints: [
      'devOrg=0',
      'devOrg=1',
      'devOrg=2',
      'devOrg=3',
      'conventions=0',
      'conventions=1',
      'conventions=2',
    ],
    // Approximate distribution of the 117-response corpus per trait score;
    // refine from the corpus manifest. Top scores are thin but clear the
    // 5-example smoke-test minimum, so none are demoted at prototype tier.
    labeledCountPerScorePoint: {
      'devOrg=0': 12,
      'devOrg=1': 50,
      'devOrg=2': 45,
      'devOrg=3': 10,
      'conventions=0': 14,
      'conventions=1': 85,
      'conventions=2': 18,
    },
    invalidCaseTypesCovered: ['blank', 'off-topic'],
    extractionQualityKnown: true,
    // Legal scores are present in aggregate but sparse once split by
    // grade x genre x prompt family x trait score; top scores barely appear.
    minLabeledPerReportedCell: 1,
  },
  evaluation: {
    holdoutPossible: true,
    leakageSafeSplitsAtFamilyLevel: true,
    untouchedFamilyCount: 1,
    metricsPreregistered: true,
    baselinesDefined: true,
    // Measured in the V3.1 three-repeat run (117 predictions x 3): pairwise
    // exact trait agreement dev 96.6%, conventions 98.3%; 92.3% of essays
    // fully stable across all repeats. Taking the weaker trait as the rate.
    exactTraitScoreStabilityRate: 0.966,
    repeatDisagreementPolicy: 'consensus',
    perCellSamplesSufficient: false,
    // Measured in V3.1: one Conventions=2 prediction in 117 calls;
    // Development=3 only for a single top essay. Effectively zero recall.
    scorePointsWithZeroRecall: ['devOrg=3', 'conventions=2'],
    blindExpertReviewDone: false,
  },
  safety: {
    lawfulBasis: true,
    privacySatisfiable: true,
    inputValidationAndInjectionDefense: true,
    abstentionImplemented: true,
    errorPathsTested: true,
    humanRoutingImplemented: true,
    auditTrailImplemented: true,
    privacyImplemented: true,
    monitoringImplemented: true,
  },
  value: {
    improvesOnAlternative: true,
    feedbackValidityChecked: true,
    costJustified: true,
  },
  pilotReviews: {
    sourceUseMatters: true,
    sourceFidelityReviewDone: false,
    emitsConventionsFeedback: true,
    conventionsDiagnosticReviewDone: false,
    emitsStudentFeedback: true,
    // The architecture generates feedback in the orchestrator after trait
    // scores are final; scorer agents never see the feedback stage.
    feedbackIsolatedFromScoring: true,
  },
  autonomy: {
    nonInferiorToHuman: false,
    perTraitMetricsWithCIs: false,
    summedQwkAndSmdReported: true,
    calibratedConfidenceRoutingRetained: false,
    subgroupSlicesEvaluated: false,
    severeErrorLimitsHeld: false,
    continuousMonitoring: false,
    rollbackApproved: false,
    perScorePrecisionRecallFloorsMet: false,
    // The V2/V3 scorer compresses toward middle scores.
    scoreDistributionDivergenceAcceptable: false,
    routingPerformanceMeasured: false,
    autoScoreCoverageReported: false,
    recalibrationTriggersDefined: false,
    // Measured in V3.1: cascade accuracy 33.3% across 18 repeated gold-zero
    // observations — the cascade is not yet enforced as deterministic
    // orchestration.
    deterministicRulesVerifiedCorrect: false,
  },
  deterministicRulesImplementable: true,
  supportedBoundary: {
    grades: [3, 4, 5],
    genres: ['informational'],
    traitScores: { devOrg: [0, 1, 2], conventions: [0, 1] },
  },
  declaredUnsupportedRegions: ['argumentative g5'],
  discoveredSources: [
    {
      name: 'TEA STAAR ECR rubric, grades 3-5',
      url: 'https://tea.texas.gov/student-assessment/testing/staar',
      authority: 'Texas Education Agency',
      license: 'public state assessment materials',
      version: 'tea-ecr-g3-5@2023',
      checksum: 'sha256:rubric-snapshot',
    },
    {
      name: 'TEA scoring guides with annotated exemplars (2023-2025)',
      url: 'https://tea.texas.gov/student-assessment/testing/staar/staar-released-test-questions',
      authority: 'Texas Education Agency',
      license: 'public state assessment materials',
      version: '2023-2025',
      checksum: 'sha256:corpus-manifest',
    },
  ],
};
