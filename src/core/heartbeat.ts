import type { LiveSourceAdapter, SnapshotService } from '../ports/index.js';
import type { SourceSnapshot, WritingTask } from '../domain/types.js';
import type { CycleResult, PipelineDeps } from './pipeline.js';
import { runCycle } from './pipeline.js';

export interface HeartbeatDeps extends PipelineDeps {
  source: LiveSourceAdapter;
  snapshotService: SnapshotService;
}

export interface HeartbeatOptions {
  task: WritingTask;
  /** Number of heartbeat ticks to run. */
  ticks: number;
  /**
   * Wait between ticks. 0 (the default) keeps offline demo runs instant; live
   * runs set a real interval so successive polls can observe fresh data.
   */
  intervalMs?: number;
}

/**
 * The heartbeat: the time/state-driven loop that makes this a Claw Agent rather
 * than a prompt-driven script. On each tick it wakes, checks the live source,
 * captures provenance, and runs a full learning cycle.
 *
 * When the source has nothing new, the heartbeat does NOT fabricate work — it
 * re-runs against the most recent snapshot so newly-learned lessons can still
 * improve the artifact. That is the intended answer to "what should the
 * heartbeat do when nothing changed": apply accumulated learning, never invent
 * a fake source event.
 */
export class Heartbeat {
  constructor(private readonly deps: HeartbeatDeps) {}

  async run(options: HeartbeatOptions): Promise<CycleResult[]> {
    const results: CycleResult[] = [];
    let previous: SourceSnapshot | null = null;

    for (let tick = 0; tick < options.ticks; tick++) {
      const event = await this.deps.source.poll();

      let snapshot: SourceSnapshot | null;
      if (event) {
        snapshot = this.deps.snapshotService.capture(event);
        await this.deps.store.saveSnapshot(snapshot);
      } else {
        // Nothing new this tick: fall back to the latest known snapshot so the
        // engine can still apply freshly-learned lessons.
        snapshot = await this.deps.store.latestSnapshotForFeed(
          this.deps.source.name,
        );
      }

      if (!snapshot) {
        // No event and no history yet: idle tick, visible and honest.
        continue;
      }

      const result = await runCycle(
        this.deps,
        options.task,
        snapshot,
        previous,
        tick,
      );
      results.push(result);
      previous = snapshot;

      const intervalMs = options.intervalMs ?? 0;
      if (intervalMs > 0 && tick < options.ticks - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return results;
  }
}
