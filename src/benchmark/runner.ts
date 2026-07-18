import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SourceEvent, WritingTask, Evaluation } from '../domain/types.js';
import type { HeartbeatDeps } from '../core/heartbeat.js';
import { runCycle } from '../core/pipeline.js';
import { computeDelta, meanScores, type Delta } from '../core/report.js';
import type { SourceSnapshot } from '../domain/types.js';

interface BenchmarkTask {
  id: string;
  heldOut: boolean;
  task: WritingTask;
  event: SourceEvent;
}

interface BenchmarkFixture {
  name: string;
  version: number;
  frozen: boolean;
  scope: string;
  tasks: BenchmarkTask[];
}

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(here, 'fixtures/benchmark.json');

export interface CycleReport {
  cycle: number;
  meanAggregate: number | null;
}

export interface BenchmarkReport {
  name: string;
  version: number;
  cycles: number;
  taskCount: number;
  heldOutTaskIds: string[];
  perCycle: CycleReport[];
  /** Aggregate + per-dimension delta across all tasks (cycle 0 -> last). */
  overall: Delta;
  /** Aggregate + per-dimension delta across only held-out tasks. */
  heldOut: Delta;
}

export function loadBenchmark(
  path: string = DEFAULT_FIXTURE,
): BenchmarkFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as BenchmarkFixture;
}

/**
 * Run the frozen benchmark for a number of cycles and report the baseline
 * (cycle 0) to latest (final cycle) delta, per dimension and aggregate.
 *
 * All tasks share one memory scope, so a lesson learned on one task is applied
 * to the others. Held-out tasks never contribute lessons (learn=false); their
 * improvement isolates generalization from overfitting.
 *
 * The benchmark deliberately bypasses the heartbeat's evidence gate: it is the
 * instrument that PRODUCES the evidence a domain uses to earn its permission
 * tier — gating the instrument would deadlock domain onboarding.
 */
export async function runBenchmark(
  deps: HeartbeatDeps,
  cycles: number,
  fixture: BenchmarkFixture = loadBenchmark(),
): Promise<BenchmarkReport> {
  // Per-task chronological evaluations, and previous snapshot per task.
  const evalsByTask = new Map<string, Evaluation[]>();
  const previousByTask = new Map<string, SourceSnapshot | null>();
  const perCycle: CycleReport[] = [];

  for (const bt of fixture.tasks) {
    evalsByTask.set(bt.id, []);
    previousByTask.set(bt.id, null);
  }

  // Held-out tasks run FIRST each cycle so their cycle-0 score is a genuine
  // lesson-free baseline: any later improvement can only come from lessons
  // learned on the other tasks in prior cycles, not from within-cycle leakage.
  const ordered = [...fixture.tasks].sort(
    (a, b) => Number(b.heldOut) - Number(a.heldOut),
  );

  for (let cycle = 0; cycle < cycles; cycle++) {
    const cycleEvals: Evaluation[] = [];
    for (const bt of ordered) {
      const snapshot = deps.snapshotService.capture(bt.event);
      await deps.store.saveSnapshot(snapshot);
      const previous = previousByTask.get(bt.id) ?? null;

      const result = await runCycle(deps, bt.task, snapshot, previous, cycle, {
        learn: !bt.heldOut,
      });
      evalsByTask.get(bt.id)!.push(result.evaluation);
      cycleEvals.push(result.evaluation);
      previousByTask.set(bt.id, snapshot);
    }
    const cycleMean = meanScores(cycleEvals);
    perCycle.push({
      cycle,
      meanAggregate: cycleMean ? aggregateOf(cycleMean) : null,
    });
  }

  const overall = deltaAcrossTasks(
    fixture.tasks.map((t) => t.id),
    evalsByTask,
  );
  const heldOutIds = fixture.tasks.filter((t) => t.heldOut).map((t) => t.id);
  const heldOut = deltaAcrossTasks(heldOutIds, evalsByTask);

  return {
    name: fixture.name,
    version: fixture.version,
    cycles,
    taskCount: fixture.tasks.length,
    heldOutTaskIds: heldOutIds,
    perCycle,
    overall,
    heldOut,
  };
}

/**
 * Build a single Delta representing the mean baseline evaluation and mean latest
 * evaluation across a set of tasks, then diff them.
 */
function deltaAcrossTasks(
  taskIds: string[],
  evalsByTask: Map<string, Evaluation[]>,
): Delta {
  const baselineEvals: Evaluation[] = [];
  const latestEvals: Evaluation[] = [];
  for (const id of taskIds) {
    const evals = evalsByTask.get(id) ?? [];
    const first = evals.at(0);
    const last = evals.at(-1);
    if (first) baselineEvals.push(first);
    if (last) latestEvals.push(last);
  }

  const baseMean = meanScores(baselineEvals);
  const latestMean = meanScores(latestEvals);
  if (!baseMean || !latestMean) {
    return {
      baseline: null,
      latest: null,
      aggregateDelta: null,
      perDimension: {},
    };
  }

  // Reuse computeDelta by wrapping the means as two synthetic evaluations.
  return computeDelta([synthetic(baseMean), synthetic(latestMean)]);
}

function synthetic(scores: Evaluation['scores']): Evaluation {
  const nonNull = scores!;
  return {
    schemaVersion: 1,
    artifactId: 'synthetic',
    rubricVersion: 'rubric@1',
    evaluator: 'benchmark-mean',
    abstained: false,
    scores: nonNull,
    aggregate: aggregateOf(nonNull),
    critique: [],
  };
}

function aggregateOf(scores: NonNullable<Evaluation['scores']>): number {
  const values = Object.values(scores);
  return (
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) /
    1000
  );
}
