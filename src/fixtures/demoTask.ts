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

/** The writing contract used when the heartbeat runs against the live NWS feed. */
export const LIVE_ALERTS_TASK: WritingTask = {
  id: 'tx-alerts-memo',
  audience: 'Texas emergency operations duty officer',
  format: 'decision-memo',
  minWords: 40,
  maxWords: 400,
  minCitations: 1,
};

/**
 * The STAAR-native writing contract: for each essay arriving in the
 * submissions inbox, write a grading feedback memo a teacher can act on —
 * strengths, trait-level weaknesses, and one next step, grounded in the
 * submitted text (cited via its provenance URL).
 */
export const STAAR_FEEDBACK_TASK: WritingTask = {
  id: 'staar-ecr-feedback-memo',
  audience: 'Texas grades 3-5 writing teacher',
  format: 'decision-memo',
  minWords: 40,
  maxWords: 400,
  minCitations: 1,
};
