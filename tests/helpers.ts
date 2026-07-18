import { ProvenanceSnapshotService } from '../src/core/provenance.js';
import { HeuristicResearcher } from '../src/adapters/researcher/HeuristicResearcher.js';
import { TemplateWriter } from '../src/adapters/writer/TemplateWriter.js';
import { fixedClock } from '../src/core/clock.js';
import type { Lesson, SourceEvent, WritingTask } from '../src/domain/types.js';

export const TEST_EVENT: SourceEvent = {
  id: 'district-enrollment-2026-w28',
  feed: 'tx-demo-civic-feed',
  url: 'https://example.org/tx-demo/open-data/district-enrollment?week=28',
  title: 'Region 13 district enrollment — week 28 snapshot',
  body: 'Weekly enrollment snapshot.',
  publishedAt: '2026-07-18T08:00:00.000Z',
  metrics: {
    totalEnrolled: 412300,
    districtsReporting: 58,
    chronicAbsenteeismFlags: 9,
  },
};

export const TEST_TASK: WritingTask = {
  id: 'test-memo',
  audience: 'ops lead',
  format: 'decision-memo',
  minWords: 40,
  maxWords: 400,
  minCitations: 1,
};

export const ALL_LESSONS: Lesson[] = [
  ['ensure-min-citations', 'sourceFidelity'],
  ['add-freshness-line', 'freshness'],
  ['add-explicit-recommendation', 'audienceUsefulness'],
  ['state-primary-implication', 'insight'],
  ['remove-generic-phrasing', 'style'],
  ['add-structured-sections', 'structure'],
].map(([directive, dimension], i) => ({
  schemaVersion: 1,
  id: `lesson-${i}`,
  rule: `rule ${i}`,
  directive: directive as Lesson['directive'],
  targetDimension: dimension as Lesson['targetDimension'],
  scope: 'tx-demo-civic-feed',
  evidence: [],
  confidence: 0.5,
  wins: 0,
  promoted: false,
  rubricVersion: 'rubric@1',
  createdAt: '2026-07-18T09:00:00.000Z',
}));

/** Build an artifact from the fixture event, optionally applying all lessons. */
export async function buildArtifact(applyLessons: boolean) {
  const clock = fixedClock();
  const snapshot = new ProvenanceSnapshotService(clock).capture(TEST_EVENT);
  const evidence = await new HeuristicResearcher().research(snapshot, null);
  const artifact = await new TemplateWriter(clock).write(
    TEST_TASK,
    evidence,
    snapshot,
    applyLessons ? ALL_LESSONS : [],
  );
  return { snapshot, evidence, artifact };
}
