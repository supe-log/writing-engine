import { describe, expect, it } from 'vitest';
import { ScannedModelClient } from '../src/adapters/security/ScannedModelClient.js';
import {
  SecurityBlockedError,
  type RuntimeSecurityScanner,
  type SecurityScanResult,
} from '../src/ports/index.js';
import type {
  ChatMessage,
  ModelClient,
} from '../src/adapters/model/OpenAiCompatibleClient.js';

interface ScanCall {
  kind: string;
  content: string;
  metadata: Record<string, string>;
}

type Verdict = Partial<SecurityScanResult>;

/** Scanner stub: per-content verdict overrides, records every call. */
function recordingScanner(
  verdicts: Record<string, Verdict> = {},
): RuntimeSecurityScanner & { calls: ScanCall[] } {
  const calls: ScanCall[] = [];
  return {
    name: 'fake-scanner',
    calls,
    scan: (kind, content, metadata) => {
      calls.push({ kind, content, metadata });
      const verdict = verdicts[content] ?? {};
      return Promise.resolve({
        flagged: verdict.flagged ?? false,
        findings:
          verdict.findings ??
          (verdict.flagged
            ? [{ category: 'prompt-injection', severity: 'high', detail: 'x' }]
            : []),
        scanner: 'fake-scanner',
        ...(verdict.effectiveContent !== undefined
          ? { effectiveContent: verdict.effectiveContent }
          : {}),
      });
    },
  };
}

function fakeModel(reply: string): ModelClient & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  return {
    model: 'fake-model',
    calls,
    complete: (messages) => {
      calls.push(messages);
      return Promise.resolve(reply);
    },
  };
}

const MESSAGES: ChatMessage[] = [
  { role: 'system', content: 'grade fairly' },
  { role: 'user', content: 'essay text' },
];

describe('ScannedModelClient', () => {
  it('scans each prompt message with its role, then the output', async () => {
    const scanner = recordingScanner();
    const inner = fakeModel('the memo');
    const client = new ScannedModelClient(inner, scanner, { role: 'writer' });

    const result = await client.complete(MESSAGES);

    expect(result).toBe('the memo');
    expect(scanner.calls.map((c) => [c.kind, c.content])).toEqual([
      ['prompt', 'grade fairly'],
      ['prompt', 'essay text'],
      ['output', 'the memo'],
    ]);
    expect(scanner.calls[0]?.metadata).toEqual({
      model: 'fake-model',
      role: 'writer',
      messageRole: 'system',
    });
    expect(scanner.calls[1]?.metadata['messageRole']).toBe('user');
    expect(scanner.calls[2]?.metadata['messageRole']).toBe('assistant');
    // Nothing redacted: the model saw the original messages.
    expect(inner.calls[0]).toEqual(MESSAGES);
  });

  it('a flagged prompt message never reaches the model', async () => {
    const scanner = recordingScanner({
      'essay text': { flagged: true },
    });
    const inner = fakeModel('never');
    const client = new ScannedModelClient(inner, scanner, { role: 'writer' });

    await expect(client.complete(MESSAGES)).rejects.toThrow(
      SecurityBlockedError,
    );
    await expect(client.complete(MESSAGES)).rejects.toThrow(
      /flagged model prompt \(user message, writer\).*prompt-injection/,
    );
    expect(inner.calls).toHaveLength(0);
  });

  it('a REDACT verdict forwards the redacted content to the model', async () => {
    const scanner = recordingScanner({
      'essay text': {
        effectiveContent: 'essay [REDACTED:GENERIC_API_KEY] text',
      },
    });
    const inner = fakeModel('the memo');
    const client = new ScannedModelClient(inner, scanner, { role: 'writer' });

    const result = await client.complete(MESSAGES);

    expect(result).toBe('the memo');
    expect(inner.calls[0]).toEqual([
      { role: 'system', content: 'grade fairly' },
      { role: 'user', content: 'essay [REDACTED:GENERIC_API_KEY] text' },
    ]);
  });

  it('a redacted output returns the redacted completion', async () => {
    const scanner = recordingScanner({
      'raw completion': { effectiveContent: 'clean completion' },
    });
    const client = new ScannedModelClient(
      fakeModel('raw completion'),
      scanner,
      { role: 'evaluator' },
    );
    expect(await client.complete(MESSAGES)).toBe('clean completion');
  });

  it('a flagged output never reaches the caller', async () => {
    const scanner = recordingScanner({
      'poisoned completion': { flagged: true },
    });
    const inner = fakeModel('poisoned completion');
    const client = new ScannedModelClient(inner, scanner, {
      role: 'evaluator',
    });

    const failure = await client
      .complete(MESSAGES)
      .catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(SecurityBlockedError);
    expect((failure as SecurityBlockedError).boundary).toBe('output');
    expect((failure as SecurityBlockedError).findings).toHaveLength(1);
    expect(inner.calls).toHaveLength(1);
  });

  it('an unavailable scanner fails CLOSED', async () => {
    const broken: RuntimeSecurityScanner = {
      name: 'broken',
      scan: () => Promise.reject(new Error('scanner down')),
    };
    const client = new ScannedModelClient(fakeModel('x'), broken, {
      role: 'writer',
    });

    await expect(client.complete(MESSAGES)).rejects.toThrow(
      /prompt scan unavailable \(fail-closed\): scanner down/,
    );
  });
});
