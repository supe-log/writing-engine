import { describe, expect, it } from 'vitest';
import { ScannedModelClient } from '../src/adapters/security/ScannedModelClient.js';
import {
  SecurityBlockedError,
  type RuntimeSecurityScanner,
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

function recordingScanner(flagKinds: string[] = []): RuntimeSecurityScanner & {
  calls: ScanCall[];
} {
  const calls: ScanCall[] = [];
  return {
    name: 'fake-scanner',
    calls,
    scan: (kind, content, metadata) => {
      calls.push({ kind, content, metadata });
      const flagged = flagKinds.includes(kind);
      return Promise.resolve({
        flagged,
        findings: flagged
          ? [{ category: 'prompt-injection', severity: 'high', detail: 'x' }]
          : [],
        scanner: 'fake-scanner',
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
  it('scans prompt then output around a clean interaction', async () => {
    const scanner = recordingScanner();
    const inner = fakeModel('the memo');
    const client = new ScannedModelClient(inner, scanner, { role: 'writer' });

    const result = await client.complete(MESSAGES);

    expect(result).toBe('the memo');
    expect(scanner.calls.map((c) => c.kind)).toEqual(['prompt', 'output']);
    // The prompt scan sees the full role-tagged transcript...
    expect(scanner.calls[0]?.content).toContain('[system]\ngrade fairly');
    expect(scanner.calls[0]?.content).toContain('[user]\nessay text');
    // ...the output scan sees the completion, and both carry role metadata.
    expect(scanner.calls[1]?.content).toBe('the memo');
    expect(scanner.calls[0]?.metadata).toEqual({
      model: 'fake-model',
      role: 'writer',
    });
  });

  it('a flagged prompt never reaches the model', async () => {
    const scanner = recordingScanner(['prompt']);
    const inner = fakeModel('never');
    const client = new ScannedModelClient(inner, scanner, { role: 'writer' });

    await expect(client.complete(MESSAGES)).rejects.toThrow(
      SecurityBlockedError,
    );
    await expect(client.complete(MESSAGES)).rejects.toThrow(
      /flagged model prompt for writer.*prompt-injection/,
    );
    expect(inner.calls).toHaveLength(0);
  });

  it('a flagged output never reaches the caller', async () => {
    const scanner = recordingScanner(['output']);
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
