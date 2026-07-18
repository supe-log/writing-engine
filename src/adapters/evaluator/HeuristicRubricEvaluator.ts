import type { RubricEvaluator } from '../../ports/index.js';
import type {
  Artifact,
  DimensionScores,
  Evaluation,
  RubricDimension,
  ValidatorResult,
  WritingTask,
} from '../../domain/types.js';
import { RUBRIC_DIMENSIONS } from '../../domain/types.js';
import { SCHEMA_VERSIONS } from '../../domain/records.js';

/**
 * Independent rubric evaluator (DEMO HEURISTIC).
 *
 * It scores each of the seven rubric dimensions in [0, 1] as the fraction of
 * that dimension's deterministic checks that passed. This keeps the demo
 * reproducible and the scores explainable, at the cost of being a proxy rather
 * than a judgement.
 *
 * A PRODUCTION evaluator would be a separate model (e.g. a Nemotron judge served
 * via vLLM) that reads the artifact directly and returns calibrated per-dimension
 * scores and free-text critique — implementing this same interface. Crucially it
 * would be independent of the writer (no shared prompt, never edits scores) and
 * would ABSTAIN on provider failure rather than emit a fake zero. The `abstained`
 * path below models that contract even though the heuristic never triggers it.
 */
export class HeuristicRubricEvaluator implements RubricEvaluator {
  readonly rubricVersion = 'rubric@1';
  readonly evaluatorName = 'heuristic-demo';

  evaluate(
    artifact: Artifact,
    _task: WritingTask,
    validatorResults: ValidatorResult[],
  ): Promise<Evaluation> {
    const byDimension = groupByDimension(validatorResults);
    const scores = {} as DimensionScores;

    for (const dimension of RUBRIC_DIMENSIONS) {
      const checks = byDimension[dimension] ?? [];
      if (checks.length === 0) {
        // No deterministic signal for this dimension: treat as neutral-pass.
        scores[dimension] = 1;
        continue;
      }
      const passed = checks.filter((c) => c.passed).length;
      scores[dimension] = round(passed / checks.length);
    }

    const aggregate = round(
      RUBRIC_DIMENSIONS.reduce((sum, d) => sum + scores[d], 0) /
        RUBRIC_DIMENSIONS.length,
    );

    const critique = validatorResults
      .filter((r) => !r.passed)
      .map((r) => `[${r.dimension}] ${r.detail}`);

    return Promise.resolve({
      schemaVersion: SCHEMA_VERSIONS.evaluation,
      artifactId: artifact.id,
      rubricVersion: this.rubricVersion,
      evaluator: this.evaluatorName,
      abstained: false,
      scores,
      aggregate,
      critique,
    });
  }
}

function groupByDimension(
  results: ValidatorResult[],
): Partial<Record<RubricDimension, ValidatorResult[]>> {
  const grouped: Partial<Record<RubricDimension, ValidatorResult[]>> = {};
  for (const result of results) {
    (grouped[result.dimension] ??= []).push(result);
  }
  return grouped;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
