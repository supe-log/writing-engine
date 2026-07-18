import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSystemStore } from '../src/adapters/store/FileSystemStore.js';
import { ProvenanceSnapshotService } from '../src/core/provenance.js';
import { fixedClock } from '../src/core/clock.js';
import { TEST_EVENT } from './helpers.js';

let dir: string;
let store: FileSystemStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-store-'));
  store = new FileSystemStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('FileSystemStore', () => {
  it('round-trips snapshots and returns the latest for a feed', async () => {
    const clock = fixedClock();
    const svc = new ProvenanceSnapshotService(clock);
    const first = svc.capture(TEST_EVENT);
    const second = svc.capture({
      ...TEST_EVENT,
      metrics: { totalEnrolled: 9 },
    });
    await store.saveSnapshot(first);
    await store.saveSnapshot(second);

    const latest = await store.latestSnapshotForFeed(TEST_EVENT.feed);
    expect(latest?.id).toBe(second.id);
    expect(await store.latestSnapshotForFeed('nope')).toBeNull();
  });

  it('persists versioned lessons scoped by feed', async () => {
    await store.saveLesson({
      schemaVersion: 1,
      id: 'l1',
      rule: 'r',
      directive: 'ensure-min-citations',
      targetDimension: 'sourceFidelity',
      scope: 'feed-a',
      evidence: [],
      confidence: 0.5,
      wins: 0,
      promoted: false,
      rubricVersion: 'rubric@1',
      createdAt: '2026-07-18T09:00:00.000Z',
    });

    expect(await store.lessonsForScope('feed-a')).toHaveLength(1);
    expect(await store.lessonsForScope('feed-b')).toHaveLength(0);
    expect((await store.allLessons())[0]?.schemaVersion).toBe(1);
  });
});
