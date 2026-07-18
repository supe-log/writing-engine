import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EssaySubmissionSource } from '../src/adapters/source/EssaySubmissionSource.js';

let inbox: string;
beforeEach(() => {
  inbox = mkdtempSync(join(tmpdir(), 'we-inbox-'));
});
afterEach(() => {
  rmSync(inbox, { recursive: true, force: true });
});

function submit(name: string, body: string, mtimeSeconds: number): void {
  const path = join(inbox, name);
  writeFileSync(path, body);
  utimesSync(path, mtimeSeconds, mtimeSeconds);
}

describe('EssaySubmissionSource', () => {
  it('emits submissions oldest-first, once each, then null', async () => {
    submit('later.txt', 'Second essay body here.', 2_000);
    submit('earlier.txt', 'First essay body here.', 1_000);
    const source = new EssaySubmissionSource({ inboxDir: inbox });

    const first = await source.poll();
    const second = await source.poll();
    const third = await source.poll();

    expect(first?.id).toBe('earlier');
    expect(second?.id).toBe('later');
    expect(third).toBeNull();
  });

  it('captures provenance: file URL, first line as title, word count', async () => {
    submit('essay.txt', 'Why Recess Matters\n\nKids need to move.', 1_000);
    const source = new EssaySubmissionSource({ inboxDir: inbox });

    const event = await source.poll();

    expect(event?.feed).toBe('staar-essay-submissions');
    expect(event?.url).toBe(`file://${join(inbox, 'essay.txt')}`);
    expect(event?.title).toBe('Why Recess Matters');
    expect(event?.metrics['wordCount']).toBe(7);
    expect(event?.publishedAt).toBe(new Date(1_000 * 1000).toISOString());
  });

  it('picks up essays that arrive between polls (the live property)', async () => {
    const source = new EssaySubmissionSource({ inboxDir: inbox });
    expect(await source.poll()).toBeNull();

    submit('dropped-mid-run.txt', 'A new submission arrives.', 3_000);
    const event = await source.poll();

    expect(event?.id).toBe('dropped-mid-run');
  });

  it('ignores non-.txt files', async () => {
    submit('README.md', 'not an essay', 1_000);
    submit('notes.json', '{}', 1_000);
    const source = new EssaySubmissionSource({ inboxDir: inbox });

    expect(await source.poll()).toBeNull();
  });

  it('throws visibly when the inbox is unreadable', async () => {
    const source = new EssaySubmissionSource({
      inboxDir: join(inbox, 'does-not-exist'),
    });
    await expect(source.poll()).rejects.toThrow(/essay inbox unreadable/);
  });
});
