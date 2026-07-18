import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEngine } from '../src/core/engine.js';
import { DEMO_TASK } from '../src/fixtures/demoTask.js';
import {
  nwsAlertsPreBenchmarkEvidence,
  txCivicMemoEvidence,
} from '../src/fixtures/demoDomainEvidence.js';
import type { LiveSourceAdapter } from '../src/ports/index.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-gate-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('Heartbeat evidence-gate enforcement', () => {
  it('permits the default demo domain and persists the decision', async () => {
    const { heartbeat, deps } = createEngine({ dataDir: dir });
    const run = await heartbeat.run({ task: DEMO_TASK, ticks: 3 });

    expect(run.permitted).toBe(true);
    expect(run.cycles).toHaveLength(3);

    const decisions = await deps.store.listDecisions();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.domainId).toBe('tx-civic-memo');
    expect(decisions[0]?.status).toBe('YELLOW');
  });

  it('refuses to write for an AMBER domain but keeps observing', async () => {
    const { heartbeat, deps } = createEngine({
      dataDir: dir,
      gate: { evidence: nwsAlertsPreBenchmarkEvidence },
    });
    const run = await heartbeat.run({ task: DEMO_TASK, ticks: 2 });

    expect(run.permitted).toBe(false);
    expect(run.cycles).toHaveLength(0);
    expect(run.notes.filter((n) => n.kind === 'gate-refusal')).toHaveLength(2);
    expect(run.notes[0]?.detail).toMatch(/AMBER/);

    // Observation still happened: the snapshot was captured and persisted...
    const snapshot =
      await deps.store.latestSnapshotForFeed('tx-demo-civic-feed');
    expect(snapshot).not.toBeNull();
    // ...but nothing was written.
    expect(await deps.store.listRuns()).toHaveLength(0);
  });

  it('an investigate-tier requirement lets an AMBER domain run', async () => {
    const { heartbeat } = createEngine({
      dataDir: dir,
      gate: {
        evidence: nwsAlertsPreBenchmarkEvidence,
        requiredTier: 'investigate',
      },
    });
    const run = await heartbeat.run({ task: DEMO_TASK, ticks: 1 });

    expect(run.permitted).toBe(true);
    expect(run.cycles).toHaveLength(1);
  });

  it('a throwing source surfaces as a visible note, never a fake cycle', async () => {
    const broken: LiveSourceAdapter = {
      name: 'broken-feed',
      poll: () => Promise.reject(new Error('ECONNREFUSED live feed')),
    };
    const { heartbeat, deps } = createEngine({
      dataDir: dir,
      source: broken,
      gate: { evidence: txCivicMemoEvidence },
    });
    const run = await heartbeat.run({ task: DEMO_TASK, ticks: 1 });

    const errors = run.notes.filter((n) => n.kind === 'source-error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.detail).toMatch(/ECONNREFUSED/);
    // No history for this feed either, so the tick idled honestly.
    expect(run.notes.some((n) => n.kind === 'no-history')).toBe(true);
    expect(run.cycles).toHaveLength(0);
    expect(await deps.store.listRuns()).toHaveLength(0);
  });
});
