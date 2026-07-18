import { join } from 'node:path';
import { createEngine } from '../core/engine.js';
import { DEMO_TASK } from '../fixtures/demoTask.js';

/**
 * Minimal heartbeat runner that persists across invocations (does NOT reset the
 * data directory), so learning compounds each time you run it. Handy for showing
 * that memory survives process restarts. Ticks default to 1.
 */
async function main(): Promise<void> {
  const ticks = Number(process.env.HEARTBEAT_TICKS ?? 1);
  const dataDir = join(
    process.env.WRITING_ENGINE_DATA_DIR ?? './data',
    'heartbeat',
  );

  const { heartbeat } = createEngine({ dataDir });
  const results = await heartbeat.run({ task: DEMO_TASK, ticks });

  for (const result of results) {
    console.log(
      `cycle ${result.cycle}: aggregate=${result.evaluation.aggregate?.toFixed(3) ?? 'ABSTAINED'} ` +
        `applied=${result.appliedLessonIds.length} ` +
        `added=${result.integration.added.length} ` +
        `promoted=${result.integration.promoted.length}`,
    );
  }
  console.log(`Persisted under ${dataDir}/ (memory compounds across runs).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
