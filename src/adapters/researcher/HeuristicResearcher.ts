import type { Researcher } from '../../ports/index.js';
import type {
  Claim,
  EvidencePack,
  SourceSnapshot,
} from '../../domain/types.js';
import { SCHEMA_VERSIONS } from '../../domain/records.js';

/**
 * Deterministic researcher for the demo. It derives claims from the event's
 * structured metrics and body, and computes novelty by diffing the current
 * snapshot's metrics against the previous snapshot of the same feed.
 *
 * This is a DEMO HEURISTIC, not a production research model. A production
 * Researcher would use a Nemotron/vLLM-served model to extract claims and
 * reason about implications; it would implement the same interface so the
 * orchestrator does not change. The heuristic exists so the pipeline is fully
 * runnable offline and its behavior is byte-for-byte reproducible.
 */
export class HeuristicResearcher implements Researcher {
  readonly version = 'heuristic-researcher@1';

  research(
    snapshot: SourceSnapshot,
    previous: SourceSnapshot | null,
  ): Promise<EvidencePack> {
    const { event } = snapshot;
    const claims: Claim[] = Object.entries(event.metrics).map(
      ([metric, value]) => ({
        text: `${humanize(metric)} is ${value.toLocaleString('en-US')} as of ${event.publishedAt}.`,
        supportUrl: event.url,
        confidence: 0.9,
      }),
    );

    const metricDeltas: Record<string, number> = {};
    const novelty: string[] = [];
    if (previous) {
      for (const [metric, value] of Object.entries(event.metrics)) {
        const prior = previous.event.metrics[metric];
        if (prior === undefined) {
          novelty.push(`New metric reported: ${humanize(metric)}.`);
          continue;
        }
        const delta = value - prior;
        metricDeltas[metric] = delta;
        if (delta !== 0) {
          novelty.push(
            `${humanize(metric)} changed by ${formatDelta(delta)} since the prior snapshot.`,
          );
        }
      }
    } else {
      novelty.push(
        'First observation of this feed; no prior state to compare.',
      );
    }

    const uncertainties = [
      'Figures are described by the source as provisional and may be revised.',
    ];

    return Promise.resolve({
      schemaVersion: SCHEMA_VERSIONS.evidencePack,
      snapshotId: snapshot.id,
      claims,
      novelty,
      uncertainties,
      metricDeltas,
    });
  }
}

function humanize(metric: string): string {
  return metric
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toLocaleString('en-US')}`;
}
