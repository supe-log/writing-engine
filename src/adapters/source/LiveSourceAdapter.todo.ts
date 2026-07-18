/**
 * EXTENSION SEAM — real live feed adapter (NOT IMPLEMENTED).
 *
 * This file documents the shape of a production {@link LiveSourceAdapter} so the
 * seam is obvious. It intentionally throws: the scaffold does not ship a live
 * integration, and nothing should claim one exists.
 *
 * To implement:
 *  - Poll a real public streaming source (e.g. a Texas open-data endpoint, a
 *    NOAA feed, or an Apify actor dataset via APIFY_TOKEN / APIFY_ACTOR_ID).
 *  - De-duplicate already-seen events (persist a cursor / last-seen id).
 *  - Map the upstream payload onto the SourceEvent shape, preserving the public
 *    URL as the provenance anchor.
 *  - Route ingested content through the HiddenLayer scan seam before it reaches
 *    the researcher (see docs/architecture.md, "Security boundary").
 *
 * Keep the FixtureSourceAdapter as the default so the demo stays offline.
 */

import type { LiveSourceAdapter } from '../../ports/index.js';
import type { SourceEvent } from '../../domain/types.js';

export interface LiveSourceConfig {
  feedUrl: string;
  pollIntervalMs: number;
  apifyToken?: string;
  apifyActorId?: string;
}

export class LiveSourceAdapter_NotImplemented implements LiveSourceAdapter {
  readonly name = 'live-source-not-implemented';

  constructor(_config: LiveSourceConfig) {}

  poll(): Promise<SourceEvent | null> {
    throw new Error(
      'LiveSourceAdapter is not implemented in the scaffold. ' +
        'Use FixtureSourceAdapter for the demo, or implement this seam against a ' +
        'real public feed. See docs/architecture.md and .env.example.',
    );
  }
}
