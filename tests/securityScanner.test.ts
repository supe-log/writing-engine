import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEngine } from '../src/core/engine.js';
import { DEMO_TASK } from '../src/fixtures/demoTask.js';
import { HiddenLayerScanner } from '../src/adapters/security/HiddenLayerScanner.js';
import type { FetchLike } from '../src/adapters/source/NwsAlertsSource.js';
import {
  SecurityBlockedError,
  type RuntimeSecurityScanner,
  type Writer,
} from '../src/ports/index.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-scan-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function fakeScanner(flagged: boolean): RuntimeSecurityScanner {
  return {
    name: 'fake-scanner',
    scan: () =>
      Promise.resolve({
        flagged,
        findings: flagged
          ? [{ category: 'prompt-injection', severity: 'high', detail: 'x' }]
          : [],
        scanner: 'fake-scanner',
      }),
  };
}

describe('heartbeat security boundary', () => {
  it('a flagged ingested event is snapshotted but never written from', async () => {
    const { heartbeat, deps } = createEngine({
      dataDir: dir,
      scanner: fakeScanner(true),
    });
    const run = await heartbeat.run({ task: DEMO_TASK, ticks: 1 });

    expect(run.cycles).toHaveLength(0);
    const blocks = run.notes.filter((n) => n.kind === 'security-block');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.detail).toMatch(/prompt-injection/);
    // Evidence preserved with provenance:
    expect(
      await deps.store.latestSnapshotForFeed('tx-demo-civic-feed'),
    ).not.toBeNull();
    expect(await deps.store.listRuns()).toHaveLength(0);
  });

  it('a passing scan lets the cycle run', async () => {
    const { heartbeat } = createEngine({
      dataDir: dir,
      scanner: fakeScanner(false),
    });
    const run = await heartbeat.run({ task: DEMO_TASK, ticks: 1 });
    expect(run.cycles).toHaveLength(1);
  });

  it('a scanner failure fails CLOSED, never silently open', async () => {
    const broken: RuntimeSecurityScanner = {
      name: 'broken-scanner',
      scan: () => Promise.reject(new Error('scanner down')),
    };
    const { heartbeat } = createEngine({ dataDir: dir, scanner: broken });
    const run = await heartbeat.run({ task: DEMO_TASK, ticks: 1 });

    expect(run.cycles).toHaveLength(0);
    expect(run.notes[0]?.detail).toMatch(/fail-closed.*scanner down/);
  });

  it('a model-boundary block inside the write-cycle skips the tick visibly', async () => {
    // Simulates ScannedModelClient refusing a flagged prompt/output mid-cycle:
    // the heartbeat must convert it into a security-block note, persist no
    // run, and keep beating rather than crash.
    const blockedWriter: Writer = {
      version: 'blocked-writer@test',
      write: () =>
        Promise.reject(
          new SecurityBlockedError(
            'fake-scanner flagged model prompt for writer: prompt-injection(high)',
            'prompt',
          ),
        ),
    };
    const { heartbeat, deps } = createEngine({
      dataDir: dir,
      scanner: fakeScanner(false),
      writer: blockedWriter,
    });
    const run = await heartbeat.run({ task: DEMO_TASK, ticks: 2 });

    expect(run.cycles).toHaveLength(0);
    const blocks = run.notes.filter((n) => n.kind === 'security-block');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.detail).toMatch(/model prompt for writer/);
    expect(await deps.store.listRuns()).toHaveLength(0);
  });
});

describe('HiddenLayerScanner', () => {
  // Stub mirrors the LIVE-VERIFIED v2 response (2026-07-18): outcome.action
  // NONE|DETECT|REDACT|BLOCK plus rule_name/risk_level detections, and on
  // REDACT an effective_interaction carrying the transformed payload.
  function stubHl(
    action: string,
    detections: Array<Record<string, string>> = [],
    effectiveText?: string,
  ): FetchLike & {
    calls: Array<{ url: string; init: Record<string, unknown> }>;
  } {
    const calls: Array<{ url: string; init: Record<string, unknown> }> = [];
    const fn: FetchLike = (url, init) => {
      calls.push({ url, init: (init ?? {}) as Record<string, unknown> });
      const isAuth = url.includes('auth');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            isAuth
              ? { access_token: 'tok-123', expires_in: 3600 }
              : {
                  outcome: {
                    action,
                    detections,
                    ...(effectiveText !== undefined
                      ? {
                          effective_interaction: {
                            messages: [
                              {
                                content: [
                                  { type: 'text', text: effectiveText },
                                ],
                              },
                            ],
                          },
                        }
                      : {}),
                  },
                },
          ),
      });
    };
    return Object.assign(fn, { calls });
  }

  function scanner(fetchFn: FetchLike): HiddenLayerScanner {
    return new HiddenLayerScanner({
      clientId: 'id',
      clientSecret: 'secret',
      projectId: 'proj-1',
      fetchFn,
      nowMs: () => 1_000_000,
    });
  }

  interface V2Body {
    interaction: {
      messages: Array<{
        role: string;
        content: Array<{ type: string; text: string }>;
      }>;
    };
    metadata: Record<string, string>;
  }

  it('authenticates via client credentials, then posts the canonical interaction', async () => {
    const fetchFn = stubHl('NONE');
    const result = await scanner(fetchFn).scan('ingested', 'hello', {
      feed: 'f',
    });

    expect(result.flagged).toBe(false);
    expect(fetchFn.calls[0]?.url).toContain(
      'auth.hiddenlayer.ai/oauth2/token?grant_type=client_credentials',
    );
    expect(fetchFn.calls[1]?.url).toBe(
      'https://api.hiddenlayer.ai/detection/v2/interaction-evaluations',
    );
    const headers = fetchFn.calls[1]?.init['headers'] as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok-123');
    expect(headers['HL-Project-Id']).toBe('proj-1');
    const body = JSON.parse(fetchFn.calls[1]?.init['body'] as string) as V2Body;
    expect(body.interaction.messages[0]?.role).toBe('user');
    expect(body.interaction.messages[0]?.content[0]).toEqual({
      type: 'text',
      text: 'hello',
    });
    // Only documented metadata fields go on the wire.
    expect(Object.keys(body.metadata).sort()).toEqual([
      'model',
      'provider',
      'requester_id',
    ]);
  });

  it('sends model output as an assistant message', async () => {
    const fetchFn = stubHl('NONE');
    await scanner(fetchFn).scan('output', 'the memo', {});
    const body = JSON.parse(fetchFn.calls[1]?.init['body'] as string) as V2Body;
    expect(body.interaction.messages[0]?.role).toBe('assistant');
  });

  it('honors metadata.messageRole for the canonical role', async () => {
    const fetchFn = stubHl('NONE');
    await scanner(fetchFn).scan('prompt', 'be fair', {
      messageRole: 'system',
    });
    const body = JSON.parse(fetchFn.calls[1]?.init['body'] as string) as V2Body;
    expect(body.interaction.messages[0]?.role).toBe('system');
  });

  it('a REDACT verdict is not flagged and carries the effective content', async () => {
    const fetchFn = stubHl('REDACT', [], 'URL: file:[REDACTED]/clean.txt');
    const result = await scanner(fetchFn).scan(
      'prompt',
      'URL: file:///var/folders/xy/secretlooking/clean.txt',
      {},
    );
    expect(result.flagged).toBe(false);
    expect(result.effectiveContent).toBe('URL: file:[REDACTED]/clean.txt');
  });

  it('maps outcome detections to findings and flags on DETECT', async () => {
    const fetchFn = stubHl('DETECT', [
      { rule_name: '[System] Prompt Injection', risk_level: 'HIGH' },
    ]);
    const result = await scanner(fetchFn).scan('ingested', 'x', {});
    expect(result.flagged).toBe(true);
    expect(result.findings[0]?.category).toBe('[System] Prompt Injection');
    expect(result.findings[0]?.severity).toBe('HIGH');
  });

  it('flags on BLOCK even without detection details', async () => {
    const fetchFn = stubHl('BLOCK');
    const result = await scanner(fetchFn).scan('prompt', 'x', {});
    expect(result.flagged).toBe(true);
  });

  it('caches the token across scans', async () => {
    const fetchFn = stubHl('NONE');
    const s = scanner(fetchFn);
    await s.scan('ingested', 'a', {});
    await s.scan('output', 'b', {});
    const authCalls = fetchFn.calls.filter((c) => c.url.includes('auth'));
    expect(authCalls).toHaveLength(1);
  });

  it('throws SecurityScanError on an API failure', async () => {
    const fetchFn: FetchLike = (url) =>
      Promise.resolve({
        ok: !url.includes('detection'),
        status: url.includes('detection') ? 503 : 200,
        json: () => Promise.resolve({ access_token: 't', expires_in: 60 }),
      });
    await expect(scanner(fetchFn).scan('ingested', 'x', {})).rejects.toThrow(
      /HTTP 503/,
    );
  });
});
