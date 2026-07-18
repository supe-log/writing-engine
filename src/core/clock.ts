import type { IsoTimestamp } from '../domain/types.js';

/**
 * Time source abstraction. Injecting a clock keeps the pipeline deterministic
 * under test and lets the demo/benchmark produce stable, reproducible records.
 */
export interface Clock {
  now(): IsoTimestamp;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

/**
 * A clock that advances by a fixed step on each call, starting from a fixed
 * epoch. Used by the demo and benchmark so runs are byte-for-byte reproducible.
 */
export function fixedClock(
  startIso = '2026-07-18T09:00:00.000Z',
  stepMs = 1000,
): Clock {
  let current = new Date(startIso).getTime();
  return {
    now(): IsoTimestamp {
      const iso = new Date(current).toISOString();
      current += stepMs;
      return iso;
    },
  };
}
