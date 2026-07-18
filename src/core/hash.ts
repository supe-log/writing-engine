import { createHash } from 'node:crypto';
import { canonicalize } from '../domain/records.js';

/** SHA-256 of a canonicalized value, returned as lowercase hex. */
export function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

/** A short, stable, human-scannable id: a prefix plus the first 12 hex chars. */
export function shortId(prefix: string, value: unknown): string {
  return `${prefix}_${sha256(value).slice(0, 12)}`;
}
