/**
 * Core domain types for the Writing Engine.
 *
 * These types describe the data that flows through the heartbeat pipeline:
 * source event -> snapshot -> evidence pack -> artifact -> validation ->
 * evaluation -> lesson. They are deliberately transport-agnostic so the same
 * shapes work whether persistence is the local filesystem store or a future
 * Supabase-backed store.
 */

/** ISO-8601 timestamp string (e.g. "2026-07-18T14:03:00.000Z"). */
export type IsoTimestamp = string;

/** The seven rubric dimensions the engine scores, drawn from the brief. */
export const RUBRIC_DIMENSIONS = [
  'sourceFidelity',
  'insight',
  'audienceUsefulness',
  'structure',
  'style',
  'freshness',
  'safety',
] as const;

export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

/** Per-dimension scores in the closed interval [0, 1]. */
export type DimensionScores = Record<RubricDimension, number>;

/**
 * A single item emitted by a live source adapter. In the demo this comes from
 * deterministic fixtures; in production it would be a live public-data event.
 */
export interface SourceEvent {
  /** Stable identifier for this event within its feed. */
  id: string;
  /** Human-readable feed name (e.g. "tx-demo-civic-feed"). */
  feed: string;
  /** Public URL the event was retrieved from (provenance anchor). */
  url: string;
  /** Short title of the event. */
  title: string;
  /** Raw textual body of the event as retrieved from the source. */
  body: string;
  /** When the source itself says the data was published/updated. */
  publishedAt: IsoTimestamp;
  /** Structured metrics carried by the event, keyed by name. */
  metrics: Record<string, number>;
}

/**
 * An immutable, hashed capture of a {@link SourceEvent} at retrieval time.
 * The snapshot is the unit of provenance: memory is never allowed to override
 * what the snapshot recorded (see docs/architecture.md, "live source is truth").
 */
export interface SourceSnapshot {
  schemaVersion: number;
  /** Content-addressed id derived from the event payload + retrieval time. */
  id: string;
  event: SourceEvent;
  /** When the engine retrieved the event (may differ from publishedAt). */
  retrievedAt: IsoTimestamp;
  /** SHA-256 of the canonicalized event payload, for tamper-evidence. */
  contentHash: string;
}

/** A single extracted, source-grounded claim. */
export interface Claim {
  text: string;
  /** URL supporting the claim; must trace back to the snapshot's source. */
  supportUrl: string;
  /** Confidence in [0, 1] that the source supports this claim. */
  confidence: number;
}

/**
 * The researcher's structured output: claims, what is new versus prior state,
 * and open uncertainties. The writer consumes only the evidence pack, never the
 * raw source directly, keeping research and writing separable.
 */
export interface EvidencePack {
  schemaVersion: number;
  snapshotId: string;
  claims: Claim[];
  /** What changed relative to the previously seen state of this feed. */
  novelty: string[];
  /** Known unknowns the writer should hedge or omit. */
  uncertainties: string[];
  /** Numeric deltas versus the prior snapshot, keyed by metric name. */
  metricDeltas: Record<string, number>;
}

/** The audience/format contract a writing task must satisfy. */
export interface WritingTask {
  id: string;
  audience: string;
  /** The single supported format for the scaffold: a short decision memo. */
  format: 'decision-memo';
  minWords: number;
  maxWords: number;
  /** Minimum distinct citations required for source fidelity. */
  minCitations: number;
}

/** A generated piece of writing plus the provenance of how it was produced. */
export interface Artifact {
  schemaVersion: number;
  id: string;
  taskId: string;
  snapshotId: string;
  /** Rendered artifact body (markdown). */
  content: string;
  /** URLs cited in the body, extracted for validation. */
  citations: string[];
  /** Version of the writer prompt/template used. */
  writerVersion: string;
  /** Lesson ids that were applied when producing this artifact. */
  appliedLessonIds: string[];
  createdAt: IsoTimestamp;
}

/** Result of one deterministic validator check. */
export interface ValidatorResult {
  /** Machine-stable check name (e.g. "citation-coverage"). */
  check: string;
  passed: boolean;
  /** Human-readable explanation, always populated on failure. */
  detail: string;
  /** Dimension this check informs, for lesson targeting. */
  dimension: RubricDimension;
}

/**
 * Output of the rubric evaluator. `abstained` is true when the evaluator could
 * not produce a judgement (e.g. a provider failure); scores are then null and
 * must never be coerced to zero (see brief: failures are visible).
 */
export interface Evaluation {
  schemaVersion: number;
  artifactId: string;
  rubricVersion: string;
  /** Evaluator identity, e.g. "heuristic-demo" or "nemotron-judge". */
  evaluator: string;
  abstained: boolean;
  scores: DimensionScores | null;
  /** Aggregate mean across dimensions, null when abstained. */
  aggregate: number | null;
  critique: string[];
}

/** A reusable directive the writer knows how to apply. This is the seam between
 * a human-readable lesson and a machine-applicable change to the output. In
 * production these map to prompt injections; in the demo they map to template
 * toggles so the effect is deterministic and inspectable. */
export const LESSON_DIRECTIVES = [
  'ensure-min-citations',
  'add-freshness-line',
  'add-explicit-recommendation',
  'state-primary-implication',
  'remove-generic-phrasing',
  'add-structured-sections',
] as const;

export type LessonDirective = (typeof LESSON_DIRECTIVES)[number];

/**
 * A validated, reusable lesson. Lessons are the engine's learned knowledge.
 * They are extracted from critique, stored with evidence and confidence, and
 * promoted to the durable playbook only after repeated wins.
 */
export interface Lesson {
  schemaVersion: number;
  id: string;
  /** Human-readable rule (e.g. "Cite at least two distinct sources."). */
  rule: string;
  directive: LessonDirective;
  targetDimension: RubricDimension;
  /** Scope tag limiting where the lesson applies (e.g. feed name). */
  scope: string;
  /** Evidence: artifact/evaluation ids that motivated the lesson. */
  evidence: string[];
  confidence: number;
  /** Number of benchmark cycles in which applying this lesson helped. */
  wins: number;
  /** True once promoted to the durable playbook. */
  promoted: boolean;
  rubricVersion: string;
  createdAt: IsoTimestamp;
}

/** A single completed pass through the pipeline, persisted for inspection. */
export interface RunRecord {
  schemaVersion: number;
  id: string;
  cycle: number;
  taskId: string;
  snapshotId: string;
  artifactId: string;
  evaluationId: string;
  appliedLessonIds: string[];
  extractedLessonIds: string[];
  aggregate: number | null;
  createdAt: IsoTimestamp;
}
