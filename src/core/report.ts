import type { DimensionScores, Evaluation } from '../domain/types.js';
import { RUBRIC_DIMENSIONS } from '../domain/types.js';

export interface Delta {
  baseline: number | null;
  latest: number | null;
  aggregateDelta: number | null;
  perDimension: Record<
    string,
    { baseline: number; latest: number; delta: number }
  >;
}

/**
 * Compute the baseline-to-latest improvement from an ordered list of
 * evaluations. Baseline is the first non-abstained evaluation; latest is the
 * last. Abstentions are skipped, never counted as zero.
 */
export function computeDelta(evaluations: Evaluation[]): Delta {
  const scored = evaluations.filter(
    (e) => !e.abstained && e.scores !== null && e.aggregate !== null,
  );
  const first = scored.at(0);
  const last = scored.at(-1);

  if (!first || !last || !first.scores || !last.scores) {
    return {
      baseline: null,
      latest: null,
      aggregateDelta: null,
      perDimension: {},
    };
  }

  const perDimension: Delta['perDimension'] = {};
  for (const dimension of RUBRIC_DIMENSIONS) {
    const baseline = first.scores[dimension];
    const latest = last.scores[dimension];
    perDimension[dimension] = {
      baseline,
      latest,
      delta: round(latest - baseline),
    };
  }

  return {
    baseline: first.aggregate,
    latest: last.aggregate,
    aggregateDelta: round((last.aggregate ?? 0) - (first.aggregate ?? 0)),
    perDimension,
  };
}

/** Mean per-dimension scores across a set of evaluations (for benchmarking). */
export function meanScores(evaluations: Evaluation[]): DimensionScores | null {
  const scored = evaluations.filter((e) => !e.abstained && e.scores !== null);
  if (scored.length === 0) return null;

  const totals = Object.fromEntries(
    RUBRIC_DIMENSIONS.map((d) => [d, 0]),
  ) as DimensionScores;

  for (const evaluation of scored) {
    for (const dimension of RUBRIC_DIMENSIONS) {
      totals[dimension] += evaluation.scores![dimension];
    }
  }
  for (const dimension of RUBRIC_DIMENSIONS) {
    totals[dimension] = round(totals[dimension] / scored.length);
  }
  return totals;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
