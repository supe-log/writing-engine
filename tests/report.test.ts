import { describe, expect, it } from 'vitest';
import { computeDelta, meanScores } from '../src/core/report.js';
import type { DimensionScores, Evaluation } from '../src/domain/types.js';

function evaluation(value: number, abstained = false): Evaluation {
  const scores: DimensionScores = {
    sourceFidelity: value,
    insight: value,
    audienceUsefulness: value,
    structure: value,
    style: value,
    freshness: value,
    safety: value,
  };
  return {
    schemaVersion: 1,
    artifactId: 'a',
    rubricVersion: 'rubric@1',
    evaluator: 'test',
    abstained,
    scores: abstained ? null : scores,
    aggregate: abstained ? null : value,
    critique: [],
  };
}

describe('computeDelta', () => {
  it('computes baseline-to-latest aggregate and per-dimension deltas', () => {
    const delta = computeDelta([
      evaluation(0.3),
      evaluation(0.6),
      evaluation(0.9),
    ]);
    expect(delta.baseline).toBe(0.3);
    expect(delta.latest).toBe(0.9);
    expect(delta.aggregateDelta).toBeCloseTo(0.6, 5);
    expect(delta.perDimension.insight?.delta).toBeCloseTo(0.6, 5);
  });

  it('ignores abstentions rather than treating them as zero', () => {
    const delta = computeDelta([
      evaluation(0, true),
      evaluation(0.4),
      evaluation(0.8),
    ]);
    expect(delta.baseline).toBe(0.4);
    expect(delta.latest).toBe(0.8);
  });

  it('returns nulls when there is no scored evaluation', () => {
    const delta = computeDelta([evaluation(0, true)]);
    expect(delta.baseline).toBeNull();
    expect(delta.aggregateDelta).toBeNull();
  });
});

describe('meanScores', () => {
  it('averages dimension scores across evaluations', () => {
    const mean = meanScores([evaluation(0.2), evaluation(0.8)]);
    expect(mean?.insight).toBeCloseTo(0.5, 5);
  });

  it('returns null when all evaluations abstained', () => {
    expect(meanScores([evaluation(0, true)])).toBeNull();
  });
});
