import { describe, expect, it } from 'vitest';
import { ProvenanceSnapshotService } from '../src/core/provenance.js';
import { fixedClock } from '../src/core/clock.js';
import type { SourceEvent } from '../src/domain/types.js';

const event: SourceEvent = {
  id: 'e1',
  feed: 'f',
  url: 'https://example.org/x',
  title: 't',
  body: 'b',
  publishedAt: '2026-07-18T08:00:00.000Z',
  metrics: { a: 1 },
};

describe('ProvenanceSnapshotService', () => {
  it('hashes the same event payload identically regardless of retrieval time', () => {
    const a = new ProvenanceSnapshotService(fixedClock()).capture(event);
    const b = new ProvenanceSnapshotService(fixedClock()).capture(event);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.id).toBe(b.id);
  });

  it('produces a different hash when the payload changes', () => {
    const a = new ProvenanceSnapshotService(fixedClock()).capture(event);
    const b = new ProvenanceSnapshotService(fixedClock()).capture({
      ...event,
      metrics: { a: 2 },
    });
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('records retrieval time from the clock', () => {
    const snap = new ProvenanceSnapshotService(
      fixedClock('2026-07-18T09:00:00.000Z'),
    ).capture(event);
    expect(snap.retrievedAt).toBe('2026-07-18T09:00:00.000Z');
  });
});
