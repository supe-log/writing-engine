import { describe, expect, it } from 'vitest';
import { CritiqueLessonExtractor } from '../src/core/lessonExtractor.js';
import { HeuristicRubricEvaluator } from '../src/adapters/evaluator/HeuristicRubricEvaluator.js';
import { DeterministicValidators } from '../src/adapters/evaluator/DeterministicValidators.js';
import { fixedClock } from '../src/core/clock.js';
import { buildArtifact, TEST_TASK } from './helpers.js';
import type { Evaluation } from '../src/domain/types.js';

const validator = new DeterministicValidators();
const evaluator = new HeuristicRubricEvaluator();
const extractor = new CritiqueLessonExtractor(fixedClock());

describe('CritiqueLessonExtractor', () => {
  it('extracts one lesson per generalizable failed check', async () => {
    const { artifact, snapshot } = await buildArtifact(false);
    const results = validator.validate(artifact, TEST_TASK, snapshot);
    const evaluation = await evaluator.evaluate(artifact, TEST_TASK, results);

    const lessons = extractor.extract(
      artifact,
      evaluation,
      results,
      'tx-demo-civic-feed',
    );
    const directives = lessons.map((l) => l.directive).sort();
    expect(directives).toEqual(
      [
        'add-explicit-recommendation',
        'add-freshness-line',
        'add-structured-sections',
        'ensure-min-citations',
        'remove-generic-phrasing',
        'state-primary-implication',
      ].sort(),
    );
  });

  it('extracts nothing from a fully-passing artifact', async () => {
    const { artifact, snapshot } = await buildArtifact(true);
    const results = validator.validate(artifact, TEST_TASK, snapshot);
    const evaluation = await evaluator.evaluate(artifact, TEST_TASK, results);
    const lessons = extractor.extract(artifact, evaluation, results, 'scope');
    expect(lessons).toEqual([]);
  });

  it('learns nothing when the evaluator abstained', async () => {
    const { artifact, snapshot } = await buildArtifact(false);
    const results = validator.validate(artifact, TEST_TASK, snapshot);
    const abstained: Evaluation = {
      schemaVersion: 1,
      artifactId: artifact.id,
      rubricVersion: 'rubric@1',
      evaluator: 'heuristic-demo',
      abstained: true,
      scores: null,
      aggregate: null,
      critique: [],
    };
    expect(extractor.extract(artifact, abstained, results, 'scope')).toEqual(
      [],
    );
  });
});
