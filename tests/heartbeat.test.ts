import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEngine } from '../src/core/engine.js';
import { computeDelta } from '../src/core/report.js';
import { DEMO_TASK } from '../src/fixtures/demoTask.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-hb-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('Heartbeat end-to-end', () => {
  it('improves from a lesson-free baseline to a higher latest score', async () => {
    const { heartbeat } = createEngine({ dataDir: dir });
    const run = await heartbeat.run({ task: DEMO_TASK, ticks: 3 });
    const results = run.cycles;

    expect(results).toHaveLength(3);
    const delta = computeDelta(results.map((r) => r.evaluation));

    expect(delta.baseline).not.toBeNull();
    expect(delta.latest).not.toBeNull();
    expect(delta.aggregateDelta).toBeGreaterThan(0);
    // Baseline applies no lessons; a later cycle applies several.
    expect(results[0]?.appliedLessonIds).toHaveLength(0);
    expect(results.at(-1)?.appliedLessonIds.length).toBeGreaterThan(0);
  });

  it('persists lessons that survive a fresh engine on the same data dir', async () => {
    await createEngine({ dataDir: dir }).heartbeat.run({
      task: DEMO_TASK,
      ticks: 3,
    });

    const { deps } = createEngine({ dataDir: dir });
    const lessons = await deps.store.lessonsForScope('tx-demo-civic-feed');
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.some((l) => l.promoted)).toBe(true);
  });

  it('records a run per cycle', async () => {
    const { heartbeat, deps } = createEngine({ dataDir: dir });
    await heartbeat.run({ task: DEMO_TASK, ticks: 3 });
    const runs = await deps.store.listRuns();
    expect(runs).toHaveLength(3);
    expect(runs.map((r) => r.cycle)).toEqual([0, 1, 2]);
  });
});
