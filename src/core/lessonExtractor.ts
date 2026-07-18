import type { LessonExtractor } from '../ports/index.js';
import type {
  Artifact,
  Evaluation,
  Lesson,
  LessonDirective,
  RubricDimension,
  ValidatorResult,
} from '../domain/types.js';
import { SCHEMA_VERSIONS } from '../domain/records.js';
import { shortId } from './hash.js';
import type { Clock } from './clock.js';

/**
 * Maps a failed deterministic check to the smallest reusable repair. Only checks
 * with an entry here can become lessons; anything else is treated as too specific
 * to generalize (rejected as overfit). This table is the concrete, inspectable
 * form of "the smallest reusable lesson supported by the critique."
 */
export interface Repair {
  directive: LessonDirective;
  dimension: RubricDimension;
  rule: string;
}

export const REPAIRS: Record<string, Repair> = {
  'citation-coverage': {
    directive: 'ensure-min-citations',
    dimension: 'sourceFidelity',
    rule: 'Cite the source URL inline for every factual claim so citation coverage meets the task minimum.',
  },
  'freshness-line': {
    directive: 'add-freshness-line',
    dimension: 'freshness',
    rule: 'Include an explicit "what changed and why now" section derived from the novelty diff.',
  },
  'explicit-recommendation': {
    directive: 'add-explicit-recommendation',
    dimension: 'audienceUsefulness',
    rule: 'Close with a concrete, actionable recommendation the audience can act on.',
  },
  'primary-implication': {
    directive: 'state-primary-implication',
    dimension: 'insight',
    rule: 'Surface the single most important non-obvious implication of the update.',
  },
  'structured-sections': {
    directive: 'add-structured-sections',
    dimension: 'structure',
    rule: 'Organize the memo into Premise, Evidence, and Conclusion sections.',
  },
  'no-generic-phrasing': {
    directive: 'remove-generic-phrasing',
    dimension: 'style',
    rule: 'Open with a specific, concrete summary; avoid generic filler phrasing.',
  },
};

/** The repair mapped to a deterministic check, if that check can generalize. */
export function repairForCheck(check: string): Repair | undefined {
  return REPAIRS[check];
}

/**
 * Extracts reusable lessons from a completed evaluation.
 *
 * The extractor is deliberately conservative: it only proposes a lesson when a
 * deterministic check failed AND that check maps to a known, generalizable
 * repair. Lessons are proposed with confidence and zero wins; the memory layer
 * (see LessonMemory) is responsible for de-duplication, confidence growth on
 * repeated evidence, and promotion to the durable playbook after repeated wins.
 */
export class CritiqueLessonExtractor implements LessonExtractor {
  constructor(private readonly clock: Clock) {}

  extract(
    artifact: Artifact,
    evaluation: Evaluation,
    validatorResults: ValidatorResult[],
    scope: string,
  ): Lesson[] {
    if (evaluation.abstained) {
      // No trustworthy judgement -> learn nothing. Failures stay visible.
      return [];
    }

    const lessons: Lesson[] = [];
    for (const result of validatorResults) {
      if (result.passed) continue;
      const repair = REPAIRS[result.check];
      if (!repair) continue; // too specific to generalize; reject.

      lessons.push({
        schemaVersion: SCHEMA_VERSIONS.lesson,
        id: shortId('lesson', { directive: repair.directive, scope }),
        rule: repair.rule,
        directive: repair.directive,
        targetDimension: repair.dimension,
        scope,
        evidence: [artifact.id, evaluation.artifactId],
        confidence: 0.5,
        wins: 0,
        promoted: false,
        rubricVersion: evaluation.rubricVersion,
        createdAt: this.clock.now(),
      });
    }
    return lessons;
  }
}
