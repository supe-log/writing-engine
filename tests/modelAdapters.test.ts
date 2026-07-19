import { describe, expect, it } from 'vitest';
import {
  ModelProviderError,
  OpenAiCompatibleClient,
} from '../src/adapters/model/OpenAiCompatibleClient.js';
import { ModelWriter } from '../src/adapters/writer/ModelWriter.js';
import {
  ModelRubricEvaluator,
  parseJudgement,
} from '../src/adapters/evaluator/ModelRubricEvaluator.js';
import type { FetchLike } from '../src/adapters/source/NwsAlertsSource.js';
import { fixedClock } from '../src/core/clock.js';
import { RUBRIC_DIMENSIONS } from '../src/domain/types.js';
import type {
  Artifact,
  EvidencePack,
  Lesson,
  SourceSnapshot,
} from '../src/domain/types.js';
import { DEMO_TASK } from '../src/fixtures/demoTask.js';

function chatResponse(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

/** FetchLike stub that records requests (read the latest via calls.at(-1)). */
function stubModelFetch(
  content: string | { ok: false; status: number },
): FetchLike & {
  calls: Array<{ url: string; init: Record<string, unknown> }>;
} {
  const calls: Array<{ url: string; init: Record<string, unknown> }> = [];
  const fn: FetchLike = (url, init) => {
    calls.push({ url, init: (init ?? {}) as Record<string, unknown> });
    if (typeof content !== 'string') {
      return Promise.resolve({
        ok: false,
        status: content.status,
        json: () => Promise.resolve({}),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(chatResponse(content)),
    });
  };
  return Object.assign(fn, { calls });
}

function client(
  fetchFn: FetchLike,
  model = 'nvidia/nemotron-test',
): OpenAiCompatibleClient {
  return new OpenAiCompatibleClient({
    baseUrl: 'http://localhost:8089/v1',
    apiKey: 'test-key',
    model,
    fetchFn,
  });
}

const snapshot: SourceSnapshot = {
  schemaVersion: 1,
  id: 'snap_test',
  event: {
    id: 'e1',
    feed: 'nws-alerts-tx',
    url: 'https://api.weather.gov/alerts/active?area=TX',
    title: 'Active NWS alerts',
    body: 'Severe Thunderstorm Warning: ...',
    publishedAt: '2026-07-18T11:00:00.000Z',
    metrics: { alertsActive: 22 },
  },
  retrievedAt: '2026-07-18T11:01:00.000Z',
  contentHash: 'abc',
};

const evidence: EvidencePack = {
  schemaVersion: 1,
  snapshotId: snapshot.id,
  claims: [
    {
      text: '22 alerts are active statewide',
      supportUrl: 'https://api.weather.gov/alerts/active?area=TX',
      confidence: 0.9,
    },
  ],
  novelty: ['3 new severe thunderstorm warnings since the last poll'],
  uncertainties: ['county-level impact not yet confirmed'],
  metricDeltas: { alertsActive: 3 },
};

const lesson: Lesson = {
  schemaVersion: 1,
  id: 'les_1',
  rule: 'Cite the source URL inline for every factual claim.',
  directive: 'ensure-min-citations',
  targetDimension: 'sourceFidelity',
  scope: 'nws-alerts-tx',
  evidence: [],
  confidence: 0.8,
  wins: 2,
  promoted: true,
  rubricVersion: 'rubric@1',
  createdAt: '2026-07-18T10:00:00.000Z',
};

describe('OpenAiCompatibleClient', () => {
  it('POSTs to /chat/completions with auth and returns the content', async () => {
    const fetchFn = stubModelFetch('hello memo');
    const result = await client(fetchFn).complete([
      { role: 'user', content: 'hi' },
    ]);

    expect(result).toBe('hello memo');
    const last = fetchFn.calls.at(-1);
    expect(last?.url).toBe('http://localhost:8089/v1/chat/completions');
    const headers = last?.init['headers'] as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-key');
    const body = JSON.parse(last?.init['body'] as string) as {
      model: string;
      messages: unknown[];
    };
    expect(body.model).toBe('nvidia/nemotron-test');
    expect(body.messages).toHaveLength(1);
  });

  it('throws ModelProviderError on a non-ok response', async () => {
    const fetchFn = stubModelFetch({ ok: false, status: 503 });
    await expect(
      client(fetchFn).complete([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(ModelProviderError);
  });

  it('throws ModelProviderError when the response carries no content', async () => {
    const fetchFn: FetchLike = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ choices: [] }),
      });
    await expect(
      client(fetchFn).complete([{ role: 'user', content: 'hi' }]),
    ).rejects.toThrow(/no content/);
  });
});

describe('ModelWriter', () => {
  it('sends evidence, snapshot context, and lesson rules as prompt context', async () => {
    const fetchFn = stubModelFetch(
      '# Memo\n\n22 alerts are active [source](https://api.weather.gov/alerts/active?area=TX).',
    );
    const writer = new ModelWriter(client(fetchFn), fixedClock());
    const artifact = await writer.write(DEMO_TASK, evidence, snapshot, [
      lesson,
    ]);

    const body = JSON.parse(fetchFn.calls.at(-1)?.init['body'] as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const user = body.messages.find((m) => m.role === 'user')?.content ?? '';
    expect(user).toContain('22 alerts are active statewide');
    expect(user).toContain('Cite the source URL inline');
    expect(user).toContain(snapshot.event.url);
    // The raw source text is grounded into the prompt so the model can reason
    // over the actual content (essay being graded, alert being summarized).
    expect(user).toContain(snapshot.event.body);
    const system =
      body.messages.find((m) => m.role === 'system')?.content ?? '';
    expect(system).toContain(DEMO_TASK.audience);
    // The writer never sees evaluator scores: nothing score-like in the prompt.
    expect(user).not.toMatch(/aggregate|score/i);

    expect(artifact.citations).toContain(
      'https://api.weather.gov/alerts/active?area=TX',
    );
    expect(artifact.appliedLessonIds).toEqual(['les_1']);
    expect(artifact.writerVersion).toBe('model-writer@1:nvidia/nemotron-test');
  });

  it('lets provider failures surface as errors (no fallback output)', async () => {
    const fetchFn = stubModelFetch({ ok: false, status: 500 });
    const writer = new ModelWriter(client(fetchFn), fixedClock());
    await expect(
      writer.write(DEMO_TASK, evidence, snapshot, []),
    ).rejects.toBeInstanceOf(ModelProviderError);
  });
});

describe('ModelRubricEvaluator', () => {
  const artifact: Artifact = {
    schemaVersion: 1,
    id: 'art_test',
    taskId: DEMO_TASK.id,
    snapshotId: snapshot.id,
    content: '# Memo\n\nBody text.',
    citations: [],
    writerVersion: 'model-writer@1:x',
    appliedLessonIds: [],
    createdAt: '2026-07-18T11:02:00.000Z',
  };

  function judgement(scoreValue: number): string {
    const scores = Object.fromEntries(
      RUBRIC_DIMENSIONS.map((d) => [d, scoreValue]),
    );
    return JSON.stringify({ scores, critique: ['tighten the opener'] });
  }

  it('parses a strict-JSON judgement into scores and aggregate', async () => {
    const evaluator = new ModelRubricEvaluator(
      client(stubModelFetch(judgement(0.8)), 'judge-model'),
    );
    const evaluation = await evaluator.evaluate(artifact, DEMO_TASK, []);

    expect(evaluation.abstained).toBe(false);
    expect(evaluation.scores?.sourceFidelity).toBe(0.8);
    expect(evaluation.aggregate).toBe(0.8);
    expect(evaluation.critique).toContain('tighten the opener');
    expect(evaluation.evaluator).toBe('model-judge@1:judge-model');
  });

  it('tolerates code fences around the JSON', () => {
    const fenced = '```json\n' + judgement(0.5) + '\n```';
    expect(parseJudgement(fenced).scores.style).toBe(0.5);
  });

  it('abstains on provider failure — never a fake zero', async () => {
    const evaluator = new ModelRubricEvaluator(
      client(stubModelFetch({ ok: false, status: 502 })),
    );
    const evaluation = await evaluator.evaluate(artifact, DEMO_TASK, []);

    expect(evaluation.abstained).toBe(true);
    expect(evaluation.scores).toBeNull();
    expect(evaluation.aggregate).toBeNull();
    expect(evaluation.critique[0]).toMatch(/abstained/);
  });

  it('abstains on malformed judge output', async () => {
    const evaluator = new ModelRubricEvaluator(
      client(stubModelFetch('I think this memo is pretty good!')),
    );
    const evaluation = await evaluator.evaluate(artifact, DEMO_TASK, []);
    expect(evaluation.abstained).toBe(true);
  });

  it('abstains when a rubric dimension is missing', async () => {
    const partial = JSON.stringify({
      scores: { sourceFidelity: 1 },
      critique: [],
    });
    const evaluator = new ModelRubricEvaluator(client(stubModelFetch(partial)));
    const evaluation = await evaluator.evaluate(artifact, DEMO_TASK, []);
    expect(evaluation.abstained).toBe(true);
  });

  it('clamps out-of-range scores into [0, 1]', () => {
    const scores = Object.fromEntries(RUBRIC_DIMENSIONS.map((d) => [d, 1.7]));
    const parsed = parseJudgement(JSON.stringify({ scores, critique: [] }));
    expect(parsed.scores.insight).toBe(1);
  });
});
