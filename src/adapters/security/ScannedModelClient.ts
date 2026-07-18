/**
 * Runtime-security decorator over a ModelClient: every model interaction is
 * scanned per request — the outgoing prompt before it reaches the model, the
 * completion before it reaches the caller. This is the "depth of
 * instrumentation" boundary the HiddenLayer track judges: not just ingested
 * source content, but each prompt and each output, every request.
 *
 * Fail-closed on both sides: a flagged interaction OR an unavailable scan
 * throws {@link SecurityBlockedError}. The heartbeat converts that into a
 * visible security-block tick note (the artifact is never persisted); the
 * evaluator's existing contract turns it into an abstention (a judge that
 * cannot safely judge says so, and the engine learns nothing from the cycle).
 */

import {
  SecurityBlockedError,
  type RuntimeSecurityScanner,
  type SecurityScanResult,
} from '../../ports/index.js';
import type {
  ChatMessage,
  ModelClient,
} from '../model/OpenAiCompatibleClient.js';

export interface ScannedModelClientOptions {
  /** Which pipeline role this client serves; sent as scan metadata. */
  role: 'writer' | 'evaluator';
}

export class ScannedModelClient implements ModelClient {
  readonly model: string;

  constructor(
    private readonly inner: ModelClient,
    private readonly scanner: RuntimeSecurityScanner,
    private readonly options: ScannedModelClientOptions,
  ) {
    this.model = inner.model;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    await this.guard('prompt', serialize(messages));
    const completion = await this.inner.complete(messages);
    await this.guard('output', completion);
    return completion;
  }

  /** Scan one side of the interaction; throw unless it cleanly passes. */
  private async guard(
    boundary: 'prompt' | 'output',
    content: string,
  ): Promise<void> {
    let result: SecurityScanResult;
    try {
      result = await this.scanner.scan(boundary, content, {
        model: this.model,
        role: this.options.role,
      });
    } catch (err) {
      if (err instanceof SecurityBlockedError) throw err;
      throw new SecurityBlockedError(
        `model ${boundary} scan unavailable (fail-closed): ` +
          (err instanceof Error ? err.message : String(err)),
        boundary,
      );
    }
    if (result.flagged) {
      throw new SecurityBlockedError(
        `${result.scanner} flagged model ${boundary} for ${this.options.role}: ` +
          result.findings.map((f) => `${f.category}(${f.severity})`).join(', '),
        boundary,
        result.findings,
        result.scanner,
      );
    }
  }
}

/** Role-tagged flattening of the chat transcript for analysis. */
function serialize(messages: ChatMessage[]): string {
  return messages.map((m) => `[${m.role}]\n${m.content}`).join('\n\n');
}
