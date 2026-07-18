/**
 * Runtime-security decorator over a ModelClient: every model interaction is
 * scanned per request — each prompt message before it reaches the model, the
 * completion before it reaches the caller. This is the "depth of
 * instrumentation" boundary the HiddenLayer track judges: not just ingested
 * source content, but each prompt and each output, every request.
 *
 * Response policy (ours, by design):
 *  - DETECT / BLOCK verdicts, or an unavailable scan, throw
 *    {@link SecurityBlockedError} — fail-closed. The heartbeat converts that
 *    into a visible security-block tick note (nothing is written); the
 *    evaluator's existing contract turns it into an abstention.
 *  - REDACT verdicts proceed: the policy chose to transform rather than
 *    refuse, so the redacted message content is what gets forwarded to the
 *    model (e.g. an API-key-looking span masked out of a prompt).
 *
 * Messages are scanned individually with their real roles (system, user,
 * assistant) so the policy evaluates the interaction the way the model
 * actually receives it.
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
  /** Which pipeline role this client serves; recorded in scan metadata. */
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
    const guarded = await Promise.all(
      messages.map(async (message) => {
        const effective = await this.guard(
          'prompt',
          message.content,
          message.role,
        );
        return effective === null
          ? message
          : { role: message.role, content: effective };
      }),
    );
    const completion = await this.inner.complete(guarded);
    const effectiveOutput = await this.guard('output', completion, 'assistant');
    return effectiveOutput ?? completion;
  }

  /**
   * Scan one side of the interaction. Returns the policy's redacted content
   * when it transformed the message, null when the original passes untouched;
   * throws when the verdict (or a failed scan) says do not proceed.
   */
  private async guard(
    boundary: 'prompt' | 'output',
    content: string,
    messageRole: ChatMessage['role'] | 'assistant',
  ): Promise<string | null> {
    let result: SecurityScanResult;
    try {
      result = await this.scanner.scan(boundary, content, {
        model: this.model,
        role: this.options.role,
        messageRole,
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
        `${result.scanner} flagged model ${boundary} (${messageRole} message, ${this.options.role}): ` +
          result.findings.map((f) => `${f.category}(${f.severity})`).join(', '),
        boundary,
        result.findings,
        result.scanner,
      );
    }
    return result.effectiveContent ?? null;
  }
}
