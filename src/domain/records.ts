/**
 * Schema versions for every persisted domain record, plus canonicalization
 * used for content-addressed hashing.
 *
 * Every persisted record carries a `schemaVersion`. Bumping a version here is
 * the signal that a store migration is required; the filesystem store records
 * the version it wrote so future readers can detect drift.
 */

export const SCHEMA_VERSIONS = {
  sourceSnapshot: 1,
  evidencePack: 1,
  artifact: 1,
  evaluation: 1,
  lesson: 1,
  runRecord: 1,
} as const;

export type RecordKind = keyof typeof SCHEMA_VERSIONS;

/**
 * Produce a stable, deterministic JSON string for hashing: object keys are
 * sorted recursively so semantically-equal payloads hash identically
 * regardless of key insertion order.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}
