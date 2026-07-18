import { FixtureSourceAdapter } from '../adapters/source/FixtureSourceAdapter.js';
import { HeuristicResearcher } from '../adapters/researcher/HeuristicResearcher.js';
import { TemplateWriter } from '../adapters/writer/TemplateWriter.js';
import { DeterministicValidators } from '../adapters/evaluator/DeterministicValidators.js';
import { HeuristicRubricEvaluator } from '../adapters/evaluator/HeuristicRubricEvaluator.js';
import { FileSystemStore } from '../adapters/store/FileSystemStore.js';
import { LayeredEvidenceGateEvaluator } from '../adapters/evidenceGate/LayeredEvidenceGateEvaluator.js';
import { txCivicMemoEvidence } from '../fixtures/demoDomainEvidence.js';
import { ProvenanceSnapshotService } from './provenance.js';
import { CritiqueLessonExtractor } from './lessonExtractor.js';
import { LessonMemory } from './lessonMemory.js';
import { fixedClock, type Clock } from './clock.js';
import { Heartbeat, type GateDeps, type HeartbeatDeps } from './heartbeat.js';
import type {
  EvidenceGateEvaluator,
  LiveSourceAdapter,
  RubricEvaluator,
  RuntimeSecurityScanner,
  Writer,
} from '../ports/index.js';
import type { DomainEvidence, PermissionTier } from '../domain/evidenceGate.js';

/** Evidence-gate configuration for the heartbeat (see docs/evidence-gates.md). */
export interface GateConfig {
  /** The domain the run operates in. Defaults to the offline demo domain. */
  evidence?: DomainEvidence;
  evaluator?: EvidenceGateEvaluator;
  /** Tier required to run write-cycles. Default: 'prototype'. */
  requiredTier?: PermissionTier;
}

export interface EngineConfig {
  dataDir: string;
  /** Defaults to a deterministic fixed clock for reproducible demo output. */
  clock?: Clock;
  /** Defaults to the offline FixtureSourceAdapter. */
  source?: LiveSourceAdapter;
  /** Defaults to the deterministic TemplateWriter (e.g. swap in ModelWriter). */
  writer?: Writer;
  /** Defaults to the deterministic heuristic (e.g. swap in ModelRubricEvaluator). */
  evaluator?: RubricEvaluator;
  /** Optional runtime-security scanner over ingested content (HiddenLayer seam). */
  scanner?: RuntimeSecurityScanner;
  gate?: GateConfig;
}

/**
 * Assemble a Heartbeat wired with the default offline implementations of every
 * port. Swapping any argument (source, clock, gate) or editing this factory is
 * the single place production adapters get plugged in.
 */
export function createEngine(config: EngineConfig): {
  heartbeat: Heartbeat;
  deps: HeartbeatDeps;
} {
  const clock = config.clock ?? fixedClock();
  const store = new FileSystemStore(config.dataDir);
  const memory = new LessonMemory(store);

  const gate: GateDeps = {
    evaluator:
      config.gate?.evaluator ?? new LayeredEvidenceGateEvaluator(clock),
    evidence: config.gate?.evidence ?? txCivicMemoEvidence,
    requiredTier: config.gate?.requiredTier ?? 'prototype',
  };

  const deps: HeartbeatDeps = {
    source: config.source ?? new FixtureSourceAdapter(),
    snapshotService: new ProvenanceSnapshotService(clock),
    researcher: new HeuristicResearcher(),
    writer: config.writer ?? new TemplateWriter(clock),
    validator: new DeterministicValidators(),
    evaluator: config.evaluator ?? new HeuristicRubricEvaluator(),
    extractor: new CritiqueLessonExtractor(clock),
    memory,
    store,
    clock,
    gate,
    ...(config.scanner ? { scanner: config.scanner } : {}),
  };

  return { heartbeat: new Heartbeat(deps), deps };
}
