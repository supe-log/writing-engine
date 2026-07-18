/**
 * Ports: the replaceable seams of the Writing Engine.
 *
 * Each interface here is a boundary that the heartbeat orchestrator depends on
 * abstractly. The scaffold ships deterministic, offline implementations of every
 * port (see src/adapters). Production implementations — a live feed adapter, a
 * Nemotron/vLLM-backed writer and evaluator, a Supabase-backed store — can be
 * dropped in without touching the orchestrator, because they satisfy the same
 * contracts.
 */

import type {
  Artifact,
  Evaluation,
  EvidencePack,
  Lesson,
  RunRecord,
  SourceEvent,
  SourceSnapshot,
  ValidatorResult,
  WritingTask,
} from '../domain/types.js';
import type { DecisionRecord, DomainEvidence } from '../domain/evidenceGate.js';

/**
 * A live source of public information. The demo adapter replays deterministic
 * fixtures; a production adapter would poll a real feed (Texas open data, an
 * Apify actor dataset, etc.).
 */
export interface LiveSourceAdapter {
  readonly name: string;
  /** Return the next unseen event, or null when the feed has nothing new. */
  poll(): Promise<SourceEvent | null>;
}

/** Turns a raw source event into a hashed, immutable snapshot (provenance). */
export interface SnapshotService {
  capture(event: SourceEvent): SourceSnapshot;
}

/**
 * Extracts claims, novelty, uncertainty, and metric deltas from a snapshot,
 * comparing against the previous snapshot of the same feed when available.
 */
export interface Researcher {
  readonly version: string;
  research(
    snapshot: SourceSnapshot,
    previous: SourceSnapshot | null,
  ): Promise<EvidencePack>;
}

/**
 * Produces an artifact from an evidence pack, applying any retrieved lessons.
 * The writer never sees evaluator scores and never edits them.
 */
export interface Writer {
  readonly version: string;
  write(
    task: WritingTask,
    evidence: EvidencePack,
    snapshot: SourceSnapshot,
    lessons: Lesson[],
  ): Promise<Artifact>;
}

/** Deterministic, model-free checks run before any model judgement. */
export interface DeterministicValidator {
  validate(
    artifact: Artifact,
    task: WritingTask,
    snapshot: SourceSnapshot,
  ): ValidatorResult[];
}

/**
 * Independent rubric evaluator. Kept separate from the writer and from the
 * deterministic validators so a single strong trait cannot mask a weak one.
 */
export interface RubricEvaluator {
  readonly rubricVersion: string;
  evaluate(
    artifact: Artifact,
    task: WritingTask,
    validatorResults: ValidatorResult[],
  ): Promise<Evaluation>;
}

/**
 * Extracts the smallest reusable lessons from a completed evaluation. Rejects
 * lessons that would overfit a single example.
 */
export interface LessonExtractor {
  extract(
    artifact: Artifact,
    evaluation: Evaluation,
    validatorResults: ValidatorResult[],
    scope: string,
  ): Lesson[];
}

/**
 * Decides how far a writing-assessment domain may be pursued after source
 * discovery, per docs/evidence-gates.md. Deterministic policy, not a model
 * call: it consumes the evidence an investigator assembled and emits the
 * auditable decision record. A successful scrape never yields more than
 * permission to investigate.
 */
export interface EvidenceGateEvaluator {
  /** Version of the evidence-gates specification this evaluator implements. */
  readonly specVersion: string;
  evaluate(evidence: DomainEvidence): DecisionRecord;
}

/**
 * Persistent memory and run store. The demo implementation writes versioned
 * JSON to a gitignored directory; a production implementation would target
 * Supabase while satisfying the same interface.
 */
export interface Store {
  saveSnapshot(snapshot: SourceSnapshot): Promise<void>;
  latestSnapshotForFeed(feed: string): Promise<SourceSnapshot | null>;

  saveEvidence(pack: EvidencePack): Promise<void>;
  saveArtifact(artifact: Artifact): Promise<void>;
  saveEvaluation(evaluation: Evaluation): Promise<void>;
  saveRun(run: RunRecord): Promise<void>;
  listRuns(): Promise<RunRecord[]>;

  saveLesson(lesson: Lesson): Promise<void>;
  /** Retrieve lessons applicable to a scope (feed/domain tag). */
  lessonsForScope(scope: string): Promise<Lesson[]>;
  allLessons(): Promise<Lesson[]>;

  /** Persist an evidence-gate decision (the audit trail accumulates). */
  saveDecision(record: DecisionRecord): Promise<void>;
  /** All gate decisions, sorted by evaluation time. */
  listDecisions(): Promise<DecisionRecord[]>;
}
