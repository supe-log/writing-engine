import type {
  DeterministicValidator,
  LessonExtractor,
  Researcher,
  RubricEvaluator,
  Store,
  Writer,
} from '../ports/index.js';
import type {
  Artifact,
  Evaluation,
  RunRecord,
  SourceSnapshot,
  WritingTask,
} from '../domain/types.js';
import { SCHEMA_VERSIONS } from '../domain/records.js';
import { shortId } from './hash.js';
import type { Clock } from './clock.js';
import type { LessonMemory, IntegrationResult } from './lessonMemory.js';

export interface PipelineDeps {
  researcher: Researcher;
  writer: Writer;
  validator: DeterministicValidator;
  evaluator: RubricEvaluator;
  extractor: LessonExtractor;
  memory: LessonMemory;
  store: Store;
  clock: Clock;
}

/** Everything produced by one pass through the heartbeat pipeline. */
export interface CycleResult {
  cycle: number;
  scope: string;
  snapshot: SourceSnapshot;
  artifact: Artifact;
  evaluation: Evaluation;
  appliedLessonIds: string[];
  integration: IntegrationResult;
  run: RunRecord;
}

/**
 * Run one complete cycle over a captured snapshot: research -> write (applying
 * retrieved lessons) -> deterministic validation -> independent evaluation ->
 * lesson extraction -> memory integration -> persistence.
 *
 * The stages are wired only through the port interfaces, so any stage can be
 * swapped for a production implementation without touching this function.
 */
export interface CycleOptions {
  /**
   * When false, the cycle applies retrieved lessons and scores the artifact but
   * does NOT extract or integrate new lessons. Used for held-out benchmark tasks
   * so their improvement can only come from lessons learned elsewhere.
   */
  learn?: boolean;
}

const EMPTY_INTEGRATION: IntegrationResult = {
  added: [],
  reinforced: [],
  promoted: [],
};

export async function runCycle(
  deps: PipelineDeps,
  task: WritingTask,
  snapshot: SourceSnapshot,
  previous: SourceSnapshot | null,
  cycle: number,
  options: CycleOptions = {},
): Promise<CycleResult> {
  const learn = options.learn ?? true;
  const scope = snapshot.event.feed;

  const evidence = await deps.researcher.research(snapshot, previous);
  await deps.store.saveEvidence(evidence);

  // Memory is context: retrieve lessons, apply them in the writer only.
  const lessons = await deps.memory.applicable(scope);
  const artifact = await deps.writer.write(task, evidence, snapshot, lessons);
  await deps.store.saveArtifact(artifact);

  const validatorResults = deps.validator.validate(artifact, task, snapshot);
  const evaluation = await deps.evaluator.evaluate(
    artifact,
    task,
    validatorResults,
  );
  await deps.store.saveEvaluation(evaluation);

  let extracted: ReturnType<typeof deps.extractor.extract> = [];
  let integration = EMPTY_INTEGRATION;
  if (learn) {
    extracted = deps.extractor.extract(
      artifact,
      evaluation,
      validatorResults,
      scope,
    );
    integration = await deps.memory.integrate(
      scope,
      extracted,
      validatorResults,
      artifact.appliedLessonIds,
    );
  }

  const run: RunRecord = {
    schemaVersion: SCHEMA_VERSIONS.runRecord,
    id: shortId('run', { cycle, artifactId: artifact.id }),
    cycle,
    taskId: task.id,
    snapshotId: snapshot.id,
    artifactId: artifact.id,
    evaluationId: artifact.id,
    appliedLessonIds: artifact.appliedLessonIds,
    extractedLessonIds: extracted.map((l) => l.id),
    aggregate: evaluation.aggregate,
    createdAt: deps.clock.now(),
  };
  await deps.store.saveRun(run);

  return {
    cycle,
    scope,
    snapshot,
    artifact,
    evaluation,
    appliedLessonIds: artifact.appliedLessonIds,
    integration,
    run,
  };
}
