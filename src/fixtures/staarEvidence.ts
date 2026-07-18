/**
 * The worked example from docs/evidence-gates.md §7: STAAR grades 3–5 Extended
 * Constructed Response, evaluated against the team's actual current evidence —
 * 117 officially scored TEA responses (2023–2025), official annotations, a
 * source manifest with page-level provenance, and the V2/V3 benchmark results
 * (summed QWK ≈ 0.41 → 0.52 with severe score compression).
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
    representedScorePoints: [
      'devOrg=0',
      'devOrg=1',
      'devOrg=2',
      'devOrg=3',
      'conventions=0',
      'conventions=1',
      'conventions=2',
    ],
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
    repeatedRunsDone: false,
    perCellSamplesSufficient: false,
    // The V2/V3 scorer essentially never predicts the top scores.
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
