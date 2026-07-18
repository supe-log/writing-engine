/**
 * The acceptance criteria of docs/evidence-gates.md §10, as assertions.
 * Fixtures start from the STAAR worked example (§7) and mutate one piece of
 * evidence at a time, so each test isolates one rule of the gate.
 */

import { describe, expect, it } from 'vitest';
import { LayeredEvidenceGateEvaluator } from '../src/adapters/evidenceGate/LayeredEvidenceGateEvaluator.js';
import { fixedClock } from '../src/core/clock.js';
import { staarEcrEvidence } from '../src/fixtures/staarEvidence.js';
import type { DomainEvidence } from '../src/domain/evidenceGate.js';
import { EVIDENCE_GATE_STATUSES } from '../src/domain/evidenceGate.js';

function evidence(mutate?: (e: DomainEvidence) => void): DomainEvidence {
  const clone = structuredClone(staarEcrEvidence);
  mutate?.(clone);
  return clone;
}

function gate(e: DomainEvidence) {
  return new LayeredEvidenceGateEvaluator(fixedClock()).evaluate(e);
}

/** Evidence upgraded until every pilot minimum passes. */
function pilotReady(e: DomainEvidence): void {
  e.coverage.minLabeledPerReportedCell = 10;
  for (const score of e.coverage.supportedScorePoints) {
    e.coverage.labeledCountPerScorePoint[score] = 20;
  }
  e.evaluation.exactTraitScoreStabilityRate = 0.97;
  e.evaluation.repeatDisagreementPolicy = 'consensus';
  e.evaluation.perCellSamplesSufficient = true;
  e.evaluation.scorePointsWithZeroRecall = [];
  e.evaluation.blindExpertReviewDone = true;
  e.pilotReviews.sourceFidelityReviewDone = true;
  e.pilotReviews.conventionsDiagnosticReviewDone = true;
  e.declaredUnsupportedRegions = [];
}

/** Evidence upgraded until every autonomy minimum passes too. */
function autonomyReady(e: DomainEvidence): void {
  pilotReady(e);
  e.autonomy = {
    nonInferiorToHuman: true,
    perTraitMetricsWithCIs: true,
    summedQwkAndSmdReported: true,
    calibratedConfidenceRoutingRetained: true,
    subgroupSlicesEvaluated: true,
    severeErrorLimitsHeld: true,
    continuousMonitoring: true,
    rollbackApproved: true,
    perScorePrecisionRecallFloorsMet: true,
    scoreDistributionDivergenceAcceptable: true,
    routingPerformanceMeasured: true,
    autoScoreCoverageReported: true,
    recalibrationTriggersDefined: true,
    deterministicRulesVerifiedCorrect: true,
  };
}

describe('the STAAR ECR worked example (spec §7)', () => {
  it('lands on YELLOW with prototype as the permission ceiling', () => {
    const record = gate(evidence());
    expect(record.status).toBe('YELLOW');
    expect(record.maxPermission).toBe('prototype');
  });

  it('fails coverage and evaluation while passing the other gates', () => {
    const record = gate(evidence());
    expect(record.gates.A_construct.pass).toBe(true);
    expect(record.gates.B_authority.pass).toBe(true);
    expect(record.gates.C_groundTruth.pass).toBe(true);
    expect(record.gates.D_coverage.pass).toBe(false);
    expect(record.gates.E_evaluation.pass).toBe(false);
    expect(record.gates.F_safety.pass).toBe(true);
    expect(record.gates.G_value.pass).toBe(true);
  });

  it('names the zero-recall top scores as unsupported regions', () => {
    const record = gate(evidence());
    expect(record.unsupportedRegions).toContain('devOrg=3');
    expect(record.unsupportedRegions).toContain('conventions=2');
    expect(record.unsupportedRegions).toContain('argumentative g5');
  });

  it('ties scores to the rubric version', () => {
    const record = gate(evidence());
    expect(record.gates.B_authority.rubricVersion).toBe('tea-ecr-g3-5@2023');
  });
});

describe('permissions (spec §1, §10)', () => {
  it('a successful scrape alone grants at most investigate', () => {
    // Scrape done, labels known to exist but not in hand: nothing past AMBER.
    const record = gate(
      evidence((e) => {
        e.groundTruth.inHand = false;
      }),
    );
    expect(record.status).toBe('AMBER');
    expect(record.maxPermission).toBe('investigate');
  });

  it('emits exactly one status from the enum', () => {
    const record = gate(evidence());
    expect(EVIDENCE_GATE_STATUSES).toContain(record.status);
  });
});

describe('hard stops force RED (spec §6)', () => {
  it('no statable construct', () => {
    const record = gate(
      evidence((e) => {
        e.construct.skill = '';
      }),
    );
    expect(record.status).toBe('RED');
    expect(record.hardStops.join(' ')).toMatch(/construct/);
  });

  it('no rubric of any kind', () => {
    const record = gate(
      evidence((e) => {
        e.rubric.kind = 'none';
      }),
    );
    expect(record.status).toBe('RED');
  });

  it('labels in hand but untrustworthy', () => {
    const record = gate(
      evidence((e) => {
        e.groundTruth.humanOrOfficial = false;
      }),
    );
    expect(record.status).toBe('RED');
  });

  it('labels in hand but leaking the target', () => {
    const record = gate(
      evidence((e) => {
        e.groundTruth.leakageFree = false;
      }),
    );
    expect(record.status).toBe('RED');
  });

  it('privacy cannot be satisfied', () => {
    const record = gate(
      evidence((e) => {
        e.safety.privacySatisfiable = false;
      }),
    );
    expect(record.status).toBe('RED');
  });

  it('deterministic rules cannot be implemented', () => {
    const record = gate(
      evidence((e) => {
        e.deterministicRulesImplementable = false;
      }),
    );
    expect(record.status).toBe('RED');
  });

  it('no valid holdout is possible', () => {
    const record = gate(
      evidence((e) => {
        e.evaluation.holdoutPossible = false;
      }),
    );
    expect(record.status).toBe('RED');
  });
});

describe('AMBER: missing but acquirable evidence (spec §6)', () => {
  it('labels not yet in hand', () => {
    const record = gate(
      evidence((e) => {
        e.groundTruth.inHand = false;
      }),
    );
    expect(record.status).toBe('AMBER');
    expect(record.report.missingEvidence.join(' ')).toMatch(/labels/);
  });

  it('rubric present but unversioned', () => {
    const record = gate(
      evidence((e) => {
        e.rubric.version = null;
      }),
    );
    expect(record.status).toBe('AMBER');
  });

  it('an unvalidated substitute rubric caps at investigation (spec §9)', () => {
    const record = gate(
      evidence((e) => {
        e.rubric.kind = 'expert';
        e.rubric.validated = false;
      }),
    );
    expect(record.status).toBe('AMBER');
    expect(record.maxPermission).toBe('investigate');
  });

  it('too few prompt families for a prototype', () => {
    const record = gate(
      evidence((e) => {
        e.coverage.promptFamilyCount = 2;
      }),
    );
    expect(record.status).toBe('AMBER');
    expect(record.report.missingEvidence.join(' ')).toMatch(/prompt families/);
  });

  it('no trait score clearing the smoke-test minimum leaves nothing to prototype', () => {
    const record = gate(
      evidence((e) => {
        for (const score of e.coverage.supportedScorePoints) {
          e.coverage.labeledCountPerScorePoint[score] = 2;
        }
      }),
    );
    expect(record.status).toBe('AMBER');
  });
});

describe('scoping instead of blocking (critique: prototype gate was too strict)', () => {
  it('a thin score point is demoted to unsupported, not a prototype blocker', () => {
    const record = gate(
      evidence((e) => {
        e.coverage.labeledCountPerScorePoint['devOrg=3'] = 2;
      }),
    );
    expect(record.status).toBe('YELLOW');
    expect(record.unsupportedRegions).toContain('devOrg=3');
  });

  it('scores below the calibration minimum block the pilot but not the prototype', () => {
    const record = gate(
      evidence((e) => {
        pilotReady(e);
        e.coverage.labeledCountPerScorePoint['conventions=2'] = 9;
      }),
    );
    expect(record.status).toBe('YELLOW');
    expect(record.softStops.join(' ')).toMatch(/calibration minimum/);
  });
});

describe('YELLOW prototypes declare their limits (spec §3, §10)', () => {
  it('populates unsupportedRegions for any YELLOW+ status', () => {
    const record = gate(evidence());
    expect(record.status).toBe('YELLOW');
    expect(record.unsupportedRegions.length).toBeGreaterThan(0);
  });

  it('keeps the supported boundary null below GREEN', () => {
    expect(gate(evidence()).supportedBoundary).toBeNull();
  });
});

describe('BLUE: the pilot tier (spec §5)', () => {
  it('is granted once every pilot minimum is met', () => {
    const record = gate(evidence(pilotReady));
    expect(record.status).toBe('BLUE');
    expect(record.maxPermission).toBe('pilot');
  });

  it('a zero-recall legal score blocks the pilot', () => {
    const record = gate(
      evidence((e) => {
        pilotReady(e);
        e.evaluation.scorePointsWithZeroRecall = ['devOrg=3'];
      }),
    );
    expect(record.status).toBe('YELLOW');
    expect(record.softStops.join(' ')).toMatch(/zero-recall/);
  });

  it('missing blind expert review blocks the pilot', () => {
    const record = gate(
      evidence((e) => {
        pilotReady(e);
        e.evaluation.blindExpertReviewDone = false;
      }),
    );
    expect(record.status).toBe('YELLOW');
  });

  it('unmeasured repeat stability blocks the pilot', () => {
    const record = gate(
      evidence((e) => {
        pilotReady(e);
        e.evaluation.exactTraitScoreStabilityRate = null;
      }),
    );
    expect(record.status).toBe('YELLOW');
  });

  it('exact stability below the 95% floor blocks the pilot', () => {
    const record = gate(
      evidence((e) => {
        pilotReady(e);
        e.evaluation.exactTraitScoreStabilityRate = 0.9;
      }),
    );
    expect(record.status).toBe('YELLOW');
    expect(record.softStops.join(' ')).toMatch(/stability/);
  });

  it('an unhandled repeat-disagreement policy blocks the pilot', () => {
    const record = gate(
      evidence((e) => {
        pilotReady(e);
        e.evaluation.repeatDisagreementPolicy = 'unhandled';
      }),
    );
    expect(record.status).toBe('YELLOW');
  });

  it('student feedback that is not isolated from scoring blocks the pilot', () => {
    const blocked = gate(
      evidence((e) => {
        pilotReady(e);
        e.pilotReviews.feedbackIsolatedFromScoring = false;
      }),
    );
    expect(blocked.status).toBe('YELLOW');
    expect(blocked.softStops.join(' ')).toMatch(/isolated from scoring/);

    const scoreOnly = gate(
      evidence((e) => {
        pilotReady(e);
        e.pilotReviews.emitsStudentFeedback = false;
        e.pilotReviews.feedbackIsolatedFromScoring = false;
      }),
    );
    expect(scoreOnly.status).toBe('BLUE');
  });

  it('source-fidelity review is required only when source use matters', () => {
    const blocked = gate(
      evidence((e) => {
        pilotReady(e);
        e.pilotReviews.sourceFidelityReviewDone = false;
      }),
    );
    expect(blocked.status).toBe('YELLOW');

    const exempt = gate(
      evidence((e) => {
        pilotReady(e);
        e.pilotReviews.sourceUseMatters = false;
        e.pilotReviews.sourceFidelityReviewDone = false;
      }),
    );
    expect(exempt.status).toBe('BLUE');
  });
});

describe('GREEN: bounded autonomy (spec §5)', () => {
  it('is granted only when pilot and autonomy minimums all hold', () => {
    const record = gate(evidence(autonomyReady));
    expect(record.status).toBe('GREEN');
    expect(record.maxPermission).toBe('autonomous');
  });

  it('records the validated boundary — never a blank check', () => {
    const record = gate(evidence(autonomyReady));
    expect(record.supportedBoundary).toEqual(
      staarEcrEvidence.supportedBoundary,
    );
  });

  it('autonomy evidence without pilot evidence stays below BLUE', () => {
    const record = gate(
      evidence((e) => {
        autonomyReady(e);
        e.evaluation.blindExpertReviewDone = false;
      }),
    );
    expect(record.status).toBe('YELLOW');
  });

  it('unverified deterministic rules block autonomy but not the pilot', () => {
    const record = gate(
      evidence((e) => {
        autonomyReady(e);
        e.autonomy.deterministicRulesVerifiedCorrect = false;
      }),
    );
    expect(record.status).toBe('BLUE');
    expect(record.softStops.join(' ')).toMatch(/zero cascade/);
  });

  it('unmeasured routing performance blocks autonomy', () => {
    const record = gate(
      evidence((e) => {
        autonomyReady(e);
        e.autonomy.routingPerformanceMeasured = false;
      }),
    );
    expect(record.status).toBe('BLUE');
  });
});

describe('refusal and the feasibility report (spec §8, §10)', () => {
  it('always names a next falsifying experiment', () => {
    for (const record of [
      gate(evidence()),
      gate(evidence((e) => (e.rubric.kind = 'none'))),
      gate(evidence(autonomyReady)),
    ]) {
      expect(record.nextExperiment.length).toBeGreaterThan(0);
    }
  });

  it('RED returns a complete feasibility report', () => {
    const record = gate(
      evidence((e) => {
        e.rubric.kind = 'none';
      }),
    );
    expect(record.status).toBe('RED');
    expect(record.report.discoveredSources.length).toBeGreaterThan(0);
    expect(record.report.missingEvidence.length).toBeGreaterThan(0);
    expect(record.report.acquisitionPlan.length).toBeGreaterThan(0);
    expect(record.report.nextExperiment).toBe(record.nextExperiment);
  });

  it('is deterministic: identical evidence yields an identical record', () => {
    expect(gate(evidence())).toEqual(gate(evidence()));
  });
});
