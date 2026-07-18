import { join } from 'node:path';
import { createEngine, type EngineConfig } from '../core/engine.js';
import { systemClock } from '../core/clock.js';
import { NwsAlertsSource } from '../adapters/source/NwsAlertsSource.js';
import { DEMO_TASK, LIVE_ALERTS_TASK } from '../fixtures/demoTask.js';

/**
 * Minimal heartbeat runner that persists across invocations (does NOT reset the
 * data directory), so learning compounds each time you run it. Handy for showing
 * that memory survives process restarts. Ticks default to 1.
 *
 * Source selection (env):
 *   SOURCE_ADAPTER=fixture (default) — offline, deterministic.
 *   SOURCE_ADAPTER=live — poll real NOAA NWS active alerts. Also honors
 *     NWS_AREA (default TX), LIVE_FEED_URL (full override), LIVE_USER_AGENT,
 *     and HEARTBEAT_INTERVAL_MS (default 30000 in live mode).
 */
async function main(): Promise<void> {
  const live = (process.env.SOURCE_ADAPTER ?? 'fixture') === 'live';
  const ticks = Number(process.env.HEARTBEAT_TICKS ?? 1);
  const dataDir = join(
    process.env.WRITING_ENGINE_DATA_DIR ?? './data',
    live ? 'heartbeat-live' : 'heartbeat',
  );

  const config: EngineConfig = { dataDir };
  if (live) {
    config.source = new NwsAlertsSource({
      ...(process.env.NWS_AREA ? { area: process.env.NWS_AREA } : {}),
      ...(process.env.LIVE_FEED_URL
        ? { feedUrl: process.env.LIVE_FEED_URL }
        : {}),
      ...(process.env.LIVE_USER_AGENT
        ? { userAgent: process.env.LIVE_USER_AGENT }
        : {}),
    });
    // Live provenance must carry real retrieval times.
    config.clock = systemClock;
  }

  const task = live ? LIVE_ALERTS_TASK : DEMO_TASK;
  const intervalMs = live
    ? Number(process.env.HEARTBEAT_INTERVAL_MS ?? 30_000)
    : 0;

  const { heartbeat } = createEngine(config);
  console.log(
    `heartbeat: source=${live ? 'live (NWS alerts)' : 'fixture'} task=${task.id} ticks=${ticks}` +
      (intervalMs > 0 ? ` interval=${intervalMs}ms` : ''),
  );
  const results = await heartbeat.run({ task, ticks, intervalMs });

  for (const result of results) {
    console.log(
      `cycle ${result.cycle}: aggregate=${result.evaluation.aggregate?.toFixed(3) ?? 'ABSTAINED'} ` +
        `applied=${result.appliedLessonIds.length} ` +
        `added=${result.integration.added.length} ` +
        `promoted=${result.integration.promoted.length}`,
    );
  }
  console.log(`Persisted under ${dataDir}/ (memory compounds across runs).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
