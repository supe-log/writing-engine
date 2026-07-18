import type { WritingTask } from '../domain/types.js';

/** The single writing contract the demo pipeline satisfies. */
export const DEMO_TASK: WritingTask = {
  id: 'region13-enrollment-memo',
  audience: 'Region 13 education operations lead',
  format: 'decision-memo',
  minWords: 40,
  maxWords: 400,
  minCitations: 1,
};
