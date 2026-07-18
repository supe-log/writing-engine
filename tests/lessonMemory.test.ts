import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSystemStore } from '../src/adapters/store/FileSystemStore.js';
import { LessonMemory, PROMOTION_THRESHOLD } from '../src/core/lessonMemory.js';
import type { Lesson, ValidatorResult } from '../src/domain/types.js';

let dir: string;
let store: FileSystemStore;
let memory: LessonMemory;

const SCOPE = 'feed';

function lesson(): Lesson {
  return {
    schemaVersion: 1,
    id: 'lesson_x',
    rule: 'cite sources',
    directive: 'ensure-min-citations',
    targetDimension: 'sourceFidelity',
    scope: SCOPE,
    evidence: [],
    confidence: 0.5,
    wins: 0,
    promoted: false,
    rubricVersion: 'rubric@1',
    createdAt: '2026-07-18T09:00:00.000Z',
  };
}

const passingCitation: ValidatorResult = {
  check: 'citation-coverage',
  dimension: 'sourceFidelity',
  passed: true,
  detail: 'ok',
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-mem-'));
  store = new FileSystemStore(dir);
  memory = new LessonMemory(store);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('LessonMemory', () => {
  it('adds new lessons but de-duplicates by id', async () => {
    const first = await memory.integrate(SCOPE, [lesson()], [], []);
    expect(first.added).toHaveLength(1);

    const second = await memory.integrate(SCOPE, [lesson()], [], []);
    expect(second.added).toHaveLength(0);
    expect(await store.lessonsForScope(SCOPE)).toHaveLength(1);
  });

  it('reinforces and promotes a lesson after repeated wins', async () => {
    await memory.integrate(SCOPE, [lesson()], [], []);

    let promotedSeen = false;
    for (let i = 0; i < PROMOTION_THRESHOLD; i++) {
      const result = await memory.integrate(
        SCOPE,
        [],
        [passingCitation],
        ['lesson_x'],
      );
      expect(result.reinforced).toHaveLength(1);
      if (result.promoted.length > 0) promotedSeen = true;
    }

    expect(promotedSeen).toBe(true);
    const stored = (await store.lessonsForScope(SCOPE))[0];
    expect(stored?.promoted).toBe(true);
    expect(stored?.wins).toBe(PROMOTION_THRESHOLD);
    expect(stored?.confidence).toBeGreaterThan(0.5);
  });

  it('does not reinforce a lesson that was not applied', async () => {
    await memory.integrate(SCOPE, [lesson()], [], []);
    const result = await memory.integrate(SCOPE, [], [passingCitation], []);
    expect(result.reinforced).toHaveLength(0);
  });

  it('sorts applicable lessons by confidence', async () => {
    await memory.integrate(SCOPE, [lesson()], [], []);
    const applicable = await memory.applicable(SCOPE);
    expect(applicable[0]?.id).toBe('lesson_x');
  });
});
