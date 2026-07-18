import type { Store } from '../ports/index.js';
import type { Lesson, ValidatorResult } from '../domain/types.js';
import { repairForCheck } from './lessonExtractor.js';

/** Wins required before an episodic lesson is promoted to the durable playbook. */
export const PROMOTION_THRESHOLD = 2;

/** Confidence increment awarded each time a lesson demonstrably helps. */
const CONFIDENCE_STEP = 0.2;

export interface IntegrationResult {
  /** Lessons newly stored this cycle (episodic, from fresh failures). */
  added: Lesson[];
  /** Lessons that earned a win this cycle (their target check now passes). */
  reinforced: Lesson[];
  /** Lessons promoted to the durable playbook this cycle. */
  promoted: Lesson[];
}

/**
 * The learning policy layered over the {@link Store}.
 *
 * Responsibilities:
 *  - Retrieval: which lessons apply to the next write for a given scope.
 *  - De-duplication: lessons are keyed by directive+scope, so the same repair is
 *    never stored twice.
 *  - Reinforcement: when an applied lesson's target check passes on a later
 *    cycle, that is a win — confidence grows and wins increments.
 *  - Promotion: after {@link PROMOTION_THRESHOLD} wins a lesson is promoted to
 *    the durable playbook, matching the brief's "promote only after repeated
 *    wins" rule.
 *
 * Memory is context, never evidence: lessons change HOW the writer works, never
 * WHAT the source says.
 */
export class LessonMemory {
  constructor(private readonly store: Store) {}

  /** Lessons to apply on the next write for this scope, best-confidence first. */
  async applicable(scope: string): Promise<Lesson[]> {
    const lessons = await this.store.lessonsForScope(scope);
    return lessons.sort(
      (a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id),
    );
  }

  /**
   * Fold this cycle's outcome into memory.
   *
   * @param scope         Scope tag (feed/domain) the cycle ran under.
   * @param extracted     Lessons proposed from THIS cycle's failures.
   * @param results       This cycle's deterministic validator results.
   * @param appliedIds    Ids of lessons the writer applied this cycle.
   */
  async integrate(
    scope: string,
    extracted: Lesson[],
    results: ValidatorResult[],
    appliedIds: string[],
  ): Promise<IntegrationResult> {
    const existing = await this.store.lessonsForScope(scope);
    const byId = new Map(existing.map((l) => [l.id, l]));
    const added: Lesson[] = [];

    // Store genuinely new episodic lessons (fresh, un-repaired failures).
    for (const lesson of extracted) {
      if (!byId.has(lesson.id)) {
        await this.store.saveLesson(lesson);
        byId.set(lesson.id, lesson);
        added.push(lesson);
      }
    }

    // Reinforce lessons whose target check passed this cycle after being applied.
    const applied = new Set(appliedIds);
    const passedDirectives = new Set(
      results
        .filter((r) => r.passed)
        .map((r) => repairForCheck(r.check)?.directive)
        .filter((d): d is NonNullable<typeof d> => d !== undefined),
    );

    const reinforced: Lesson[] = [];
    const promoted: Lesson[] = [];
    for (const lesson of byId.values()) {
      const helped =
        applied.has(lesson.id) && passedDirectives.has(lesson.directive);
      if (!helped) continue;

      const wins = lesson.wins + 1;
      const updated: Lesson = {
        ...lesson,
        wins,
        confidence: Math.min(1, round(lesson.confidence + CONFIDENCE_STEP)),
        promoted: lesson.promoted || wins >= PROMOTION_THRESHOLD,
      };
      await this.store.saveLesson(updated);
      reinforced.push(updated);
      if (updated.promoted && !lesson.promoted) {
        promoted.push(updated);
      }
    }

    return { added, reinforced, promoted };
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
