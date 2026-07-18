import type { SnapshotService } from '../ports/index.js';
import type { SourceEvent, SourceSnapshot } from '../domain/types.js';
import { SCHEMA_VERSIONS } from '../domain/records.js';
import type { Clock } from './clock.js';
import { sha256, shortId } from './hash.js';

/**
 * Captures source events as immutable, content-addressed snapshots.
 *
 * The content hash covers only the event payload (not the retrieval time) so
 * the same event retrieved twice hashes identically — this is what lets the
 * researcher recognize "nothing changed" versus a genuine update.
 */
export class ProvenanceSnapshotService implements SnapshotService {
  constructor(private readonly clock: Clock) {}

  capture(event: SourceEvent): SourceSnapshot {
    const contentHash = sha256(event);
    return {
      schemaVersion: SCHEMA_VERSIONS.sourceSnapshot,
      id: shortId('snap', { contentHash }),
      event,
      retrievedAt: this.clock.now(),
      contentHash,
    };
  }
}
