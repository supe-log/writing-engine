import { join } from 'node:path';
import { createEngine, type EngineConfig } from '../core/engine.js';
import { systemClock } from '../core/clock.js';
import { NwsAlertsSource } from '../adapters/source/NwsAlertsSource.js';
import { OpenAiCompatibleClient } from '../adapters/model/OpenAiCompatibleClient.js';
import { ModelWriter } from '../adapters/writer/ModelWriter.js';
import { ModelRubricEvaluator } from '../adapters/evaluator/ModelRubricEvaluator.js';
import { HiddenLayerScanner } from '../adapters/security/HiddenLayerScanner.js';
import { DEMO_TASK, LIVE_ALERTS_TASK } from '../fixtures/demoTask.js';
import { DOMAIN_EVIDENCE } from '../fixtures/demoDomainEvidence.js';

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
 *
 * Gate-domain selection (env):
 *   GATE_DOMAIN — which DomainEvidence the run is gated by. Defaults to
 *   nws-alerts-tx in live mode and tx-civic-memo otherwise; both have earned
 *   YELLOW (write-cycles permitted) via their frozen benchmarks. To see the
 *   gate REFUSE, run GATE_DOMAIN=nws-alerts-tx@pre-benchmark — the domain's
 *   before-state (AMBER: observe and snapshot, never write).
 *
 * Model selection (env):
 *   MODEL_ADAPTER=heuristic (default) — deterministic demo writer/evaluator.
 *   MODEL_ADAPTER=openai — real model writer + INDEPENDENT model judge via an
 *     OpenAI-compatible endpoint (vLLM-served Nemotron on a GPU box, or
 *     Featherless). Requires OPENAI_BASE_URL and WRITER_MODEL; honors
 *     OPENAI_API_KEY and EVALUATOR_MODEL (defaults to WRITER_MODEL, but the
 *     judge is always a SEPARATE call).
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

  const modelAdapter = process.env.MODEL_ADAPTER ?? 'heuristic';
  if (modelAdapter === 'openai') {
    const baseUrl = process.env.OPENAI_BASE_URL;
    const writerModel = process.env.WRITER_MODEL;
    if (!baseUrl || !writerModel) {
      throw new Error(
        'MODEL_ADAPTER=openai requires OPENAI_BASE_URL and WRITER_MODEL ' +
          '(see .env.example; e.g. a vLLM endpoint from docs/references/vllm-quickstart.md).',
      );
    }
    const apiKey = process.env.OPENAI_API_KEY;
    const clock = config.clock ?? systemClock;
    config.clock = clock; // live model output is non-deterministic anyway
    config.writer = new ModelWriter(
      new OpenAiCompatibleClient({
        baseUrl,
        model: writerModel,
        ...(apiKey ? { apiKey } : {}),
      }),
      clock,
    );
    // Independent judge: its own client and (ideally) its own model.
    config.evaluator = new ModelRubricEvaluator(
      new OpenAiCompatibleClient({
        baseUrl,
        model: process.env.EVALUATOR_MODEL ?? writerModel,
        ...(apiKey ? { apiKey } : {}),
      }),
    );
  }

  // Runtime security (HiddenLayer seam): wired automatically when credentials
  // are present. Ingested content is scanned fail-closed before research.
  const hlClientId = process.env.HIDDENLAYER_CLIENT_ID;
  const hlClientSecret = process.env.HIDDENLAYER_CLIENT_SECRET;
  if (hlClientId && hlClientSecret) {
    config.scanner = new HiddenLayerScanner({
      clientId: hlClientId,
      clientSecret: hlClientSecret,
      ...(process.env.HIDDENLAYER_API_URL
        ? { apiUrl: process.env.HIDDENLAYER_API_URL }
        : {}),
      ...(process.env.HIDDENLAYER_AUTH_URL
        ? { authUrl: process.env.HIDDENLAYER_AUTH_URL }
        : {}),
      ...(process.env.HIDDENLAYER_PROJECT_ID
        ? { projectId: process.env.HIDDENLAYER_PROJECT_ID }
        : {}),
      requesterId: 'writing-engine-heartbeat',
    });
  }

  const gateDomain =
    process.env.GATE_DOMAIN ?? (live ? 'nws-alerts-tx' : 'tx-civic-memo');
  const evidence = DOMAIN_EVIDENCE[gateDomain];
  if (!evidence) {
    throw new Error(
      `Unknown GATE_DOMAIN "${gateDomain}". Known domains: ${Object.keys(DOMAIN_EVIDENCE).join(', ')}`,
    );
  }
  config.gate = { evidence };

  const task = live ? LIVE_ALERTS_TASK : DEMO_TASK;
  const intervalMs = live
    ? Number(process.env.HEARTBEAT_INTERVAL_MS ?? 30_000)
    : 0;

  const { heartbeat } = createEngine(config);
  console.log(
    `heartbeat: source=${live ? 'live (NWS alerts)' : 'fixture'} task=${task.id} ticks=${ticks}` +
      (intervalMs > 0 ? ` interval=${intervalMs}ms` : ''),
  );
  const run = await heartbeat.run({ task, ticks, intervalMs });

  console.log(
    `[gate] ${run.decision.domainId}: ${run.decision.status} — max permission ` +
      `${run.decision.maxPermission} (required: prototype) -> ` +
      `${run.permitted ? 'write-cycle permitted' : 'WRITE REFUSED (observing only)'}`,
  );
  for (const note of run.notes) {
    console.log(`tick ${note.tick}: [${note.kind}] ${note.detail}`);
  }
  for (const result of run.cycles) {
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
