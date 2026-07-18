import { join } from 'node:path';
import { createEngine } from '../core/engine.js';
import { resetDir } from '../core/fsutil.js';
import { computeDelta } from '../core/report.js';
import { DEMO_TASK } from '../fixtures/demoTask.js';
import { RUBRIC_DIMENSIONS } from '../domain/types.js';
import type { CycleResult } from '../core/pipeline.js';

/**
 * End-to-end demo. Runs the heartbeat over the deterministic fixture feed for
 * three ticks and prints the baseline-to-latest improvement. Requires no API
 * keys — everything runs on local fixtures and heuristic (non-model) stages.
 */
async function main(): Promise<void> {
  const dataDir = join(process.env.WRITING_ENGINE_DATA_DIR ?? './data', 'demo');
  resetDir(dataDir); // start clean so the baseline is genuinely lesson-free

  banner('Writing Engine — heartbeat demo (offline, deterministic fixtures)');
  console.log(
    'NOTE: the writer/researcher/evaluator here are DEMO HEURISTICS, not models.\n' +
      '      They exist so the full loop runs offline and reproducibly. The\n' +
      '      production ports (Nemotron/vLLM writer, model judge, live feed,\n' +
      '      Supabase store) are documented in docs/architecture.md.\n',
  );

  const { heartbeat } = createEngine({ dataDir });
  const results = await heartbeat.run({ task: DEMO_TASK, ticks: 3 });

  for (const result of results) {
    printCycle(result);
  }

  const delta = computeDelta(results.map((r) => r.evaluation));
  banner('Baseline -> Latest delta');
  console.log(`Baseline aggregate: ${fmt(delta.baseline)}`);
  console.log(`Latest aggregate:   ${fmt(delta.latest)}`);
  console.log(`Aggregate delta:    ${fmtDelta(delta.aggregateDelta)}\n`);

  console.log('Per-dimension:');
  for (const dimension of RUBRIC_DIMENSIONS) {
    const d = delta.perDimension[dimension];
    if (!d) continue;
    console.log(
      `  ${dimension.padEnd(20)} ${fmt(d.baseline)} -> ${fmt(d.latest)}  (${fmtDelta(d.delta)})`,
    );
  }

  banner('Learned rules that caused the improvement');
  const baseline = results.at(0);
  const latest = results.at(-1);
  if (baseline && latest) {
    const learned = latest.artifact.appliedLessonIds;
    if (learned.length === 0) {
      console.log('No lessons were applied on the latest cycle.');
    } else {
      const memoryLessons = await (async () => {
        const { deps } = createEngine({ dataDir });
        return deps.store.lessonsForScope(latest.scope);
      })();
      for (const id of learned) {
        const lesson = memoryLessons.find((l) => l.id === id);
        if (lesson) {
          console.log(
            `  - [${lesson.targetDimension}] ${lesson.rule} ` +
              `(wins=${lesson.wins}, confidence=${lesson.confidence}, ` +
              `${lesson.promoted ? 'PROMOTED to playbook' : 'episodic'})`,
          );
        }
      }
    }
  }

  banner('Baseline artifact (cycle 0)');
  console.log(indent(results.at(0)?.artifact.content ?? '(none)'));
  banner('Latest artifact (final cycle)');
  console.log(indent(results.at(-1)?.artifact.content ?? '(none)'));

  console.log(
    `\nAll run artifacts, snapshots, evaluations, and lessons persisted under ${dataDir}/ (gitignored).`,
  );
  console.log(
    'Publishing is intentionally NOT automated: a human approves before anything ships.',
  );
}

function printCycle(result: CycleResult): void {
  banner(`Cycle ${result.cycle} — ${result.snapshot.event.title}`);
  console.log(`  snapshot:        ${result.snapshot.id}`);
  console.log(
    `  applied lessons: ${result.appliedLessonIds.length > 0 ? result.appliedLessonIds.join(', ') : '(none — baseline)'}`,
  );
  console.log(`  aggregate score: ${fmt(result.evaluation.aggregate)}`);
  console.log(
    `  lessons added:   ${result.integration.added.length}, reinforced: ${result.integration.reinforced.length}, promoted: ${result.integration.promoted.length}`,
  );
  if (result.evaluation.critique.length > 0) {
    console.log('  open critique:');
    for (const c of result.evaluation.critique) {
      console.log(`    - ${c}`);
    }
  }
  console.log('');
}

function banner(text: string): void {
  console.log(`\n${'='.repeat(72)}\n${text}\n${'='.repeat(72)}`);
}

function fmt(value: number | null): string {
  return value === null ? 'ABSTAINED' : value.toFixed(3);
}

function fmtDelta(value: number | null): string {
  if (value === null) return 'n/a';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(3)}`;
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((l) => `  | ${l}`)
    .join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
