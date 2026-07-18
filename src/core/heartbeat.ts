import type {
  EvidenceGateEvaluator,
  LiveSourceAdapter,
  RuntimeSecurityScanner,
  SnapshotService,
} from '../ports/index.js';
import type { SourceSnapshot, WritingTask } from '../domain/types.js';
import type {
  DecisionRecord,
  DomainEvidence,
  PermissionTier,
} from '../domain/evidenceGate.js';
import { permits } from '../domain/evidenceGate.js';
import type { CycleResult, PipelineDeps } from './pipeline.js';
import { runCycle } from './pipeline.js';

/** The evidence-gate wiring the heartbeat enforces before writing. */
export interface GateDeps {
  evaluator: EvidenceGateEvaluator;
  /** The evidence state of the domain this run operates in. */
  evidence: DomainEvidence;
  /** Tier the write-cycle requires. Producing artifacts is prototype-tier. */
  requiredTier: PermissionTier;
}

export interface HeartbeatDeps extends PipelineDeps {
  source: LiveSourceAdapter;
  snapshotService: SnapshotService;
  gate: GateDeps;
  /**
   * Optional runtime-security scanner (HiddenLayer seam) over freshly
   * ingested content — after poll, before research. Flagged or unscannable
   * content is snapshotted (evidence preserved with provenance) but never
   * written from: fail-closed.
   */
  scanner?: RuntimeSecurityScanner;
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

/** A visible, honest note about a tick that did not produce a cycle. */
export interface TickNote {
  tick: number;
  kind: 'gate-refusal' | 'source-error' | 'no-history' | 'security-block';
  detail: string;
}

export interface HeartbeatRunResult {
  /** The gate decision this run operated under (also persisted). */
  decision: DecisionRecord;
  /** Whether decision.maxPermission covers gate.requiredTier. */
  permitted: boolean;
  cycles: CycleResult[];
  notes: TickNote[];
}

/**
 * The heartbeat: the time/state-driven loop that makes this a Claw Agent rather
 * than a prompt-driven script. On each tick it wakes, checks the live source,
 * captures provenance, and runs a full learning cycle.
 *
 * Two honesty rules govern the loop:
 *
 * 1. When the source has nothing new, the heartbeat does NOT fabricate work —
 *    it re-runs against the most recent snapshot so newly-learned lessons can
 *    still improve the artifact.
 * 2. Before any writing happens, the run is gated by the evidence gates
 *    (docs/evidence-gates.md): observing a domain — polling and snapshotting —
 *    is always allowed, but producing artifacts requires the domain to have
 *    EARNED the configured permission tier. A refused run keeps watching and
 *    records why it refused; it never writes.
 */
export class Heartbeat {
  constructor(private readonly deps: HeartbeatDeps) {}

  async run(options: HeartbeatOptions): Promise<HeartbeatRunResult> {
    // Evaluate the gate once per run (evidence is static for the process) and
    // persist the decision so every run is auditable back to its permission.
    const decision = this.deps.gate.evaluator.evaluate(this.deps.gate.evidence);
    await this.deps.store.saveDecision(decision);
    const permitted = permits(
      decision.maxPermission,
      this.deps.gate.requiredTier,
    );

    const cycles: CycleResult[] = [];
    const notes: TickNote[] = [];
    let previous: SourceSnapshot | null = null;

    for (let tick = 0; tick < options.ticks; tick++) {
      let event = null;
      try {
        event = await this.deps.source.poll();
      } catch (err) {
        // A failed poll is an error, never a fabricated event. Fall through to
        // the latest-known-snapshot path so learning can still apply.
        notes.push({
          tick,
          kind: 'source-error',
          detail: err instanceof Error ? err.message : String(err),
        });
      }

      let snapshot: SourceSnapshot | null;
      if (event) {
        // Observation is investigation-tier and always permitted: capture the
        // provenance snapshot even when writing is refused.
        snapshot = this.deps.snapshotService.capture(event);
        await this.deps.store.saveSnapshot(snapshot);

        // Runtime-security boundary (HiddenLayer seam): scan freshly ingested
        // content before it reaches the researcher. Fail-closed — a flagged
        // or unscannable event is preserved as evidence but never written
        // from this tick.
        if (this.deps.scanner) {
          const blocked = await this.scanIngested(event, tick, notes);
          if (blocked) {
            await this.pause(options, tick);
            continue;
          }
        }
      } else {
        // Nothing new this tick: fall back to the latest known snapshot so the
        // engine can still apply freshly-learned lessons.
        snapshot = await this.deps.store.latestSnapshotForFeed(
          this.deps.source.name,
        );
      }

      if (!permitted) {
        notes.push({
          tick,
          kind: 'gate-refusal',
          detail:
            `${decision.domainId} is ${decision.status} (max permission ` +
            `${decision.maxPermission}, required ${this.deps.gate.requiredTier}). ` +
            `Next: ${decision.nextExperiment}`,
        });
        await this.pause(options, tick);
        continue;
      }

      if (!snapshot) {
        // No event and no history yet: idle tick, visible and honest.
        notes.push({
          tick,
          kind: 'no-history',
          detail: `no event and no prior snapshot for feed ${this.deps.source.name}`,
        });
        await this.pause(options, tick);
        continue;
      }

      const result = await runCycle(
        this.deps,
        options.task,
        snapshot,
        previous,
        tick,
      );
      cycles.push(result);
      previous = snapshot;
      await this.pause(options, tick);
    }

    return { decision, permitted, cycles, notes };
  }

  /** Returns true when the tick must not proceed to a write-cycle. */
  private async scanIngested(
    event: { feed: string; url: string; title: string; body: string },
    tick: number,
    notes: TickNote[],
  ): Promise<boolean> {
    const scanner = this.deps.scanner;
    if (!scanner) return false;
    try {
      const result = await scanner.scan(
        'ingested',
        `${event.title}\n\n${event.body}`,
        { feed: event.feed, url: event.url },
      );
      if (result.flagged) {
        notes.push({
          tick,
          kind: 'security-block',
          detail:
            `${result.scanner} flagged ingested content: ` +
            result.findings
              .map((f) => `${f.category}(${f.severity})`)
              .join(', '),
        });
        return true;
      }
      return false;
    } catch (err) {
      notes.push({
        tick,
        kind: 'security-block',
        detail: `scan unavailable (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
      });
      return true;
    }
  }

  private async pause(options: HeartbeatOptions, tick: number): Promise<void> {
    const intervalMs = options.intervalMs ?? 0;
    if (intervalMs > 0 && tick < options.ticks - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
