import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { LiveSourceAdapter } from '../../ports/index.js';
import type { SourceEvent } from '../../domain/types.js';

interface FixtureFile {
  feed: string;
  description: string;
  events: SourceEvent[];
}

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(
  here,
  '../../fixtures/events/tx-demo-civic-feed.json',
);

/**
 * A {@link LiveSourceAdapter} that replays events from a JSON fixture in order.
 *
 * This is the offline stand-in for a real streaming feed: it lets `npm run demo`
 * exercise the entire pipeline with zero credentials while still modeling the
 * thing that matters for the Live Data track — successive polls returning the
 * same event id with UPDATED metrics, i.e. genuine freshness. Swap this for a
 * real polling adapter behind the same interface (see LiveSourceAdapter TODO in
 * src/adapters/source/LiveSourceAdapter.todo.ts).
 */
export class FixtureSourceAdapter implements LiveSourceAdapter {
  readonly name: string;
  private readonly events: SourceEvent[];
  private cursor = 0;

  constructor(fixturePath: string = DEFAULT_FIXTURE) {
    const parsed = JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureFile;
    this.name = parsed.feed;
    this.events = parsed.events;
  }

  poll(): Promise<SourceEvent | null> {
    if (this.cursor >= this.events.length) {
      return Promise.resolve(null);
    }
    const event = this.events[this.cursor];
    this.cursor += 1;
    return Promise.resolve(event ?? null);
  }

  /** Total number of events this fixture can emit. */
  get size(): number {
    return this.events.length;
  }
}
