/**
 * Minimal OpenAI-compatible chat-completions client.
 *
 * Deliberately endpoint-agnostic: the same adapter works against a self-hosted
 * vLLM server on a GPU box (see docs/references/vllm-quickstart.md — e.g.
 * `http://localhost:8089/v1` serving a Nemotron/open model) or any hosted
 * OpenAI-compatible endpoint (e.g. Featherless at
 * `https://api.featherless.ai/v1`). Switching providers is a base-URL swap.
 *
 * Failures throw {@link ModelProviderError} — a failed model call is an error,
 * never silently-degraded output. The evaluator adapter turns that error into
 * an abstention; the writer lets it surface.
 */

import type { FetchLike } from '../source/NwsAlertsSource.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * The model-call seam the writer and evaluator adapters depend on. Kept as an
 * interface so a decorator (e.g. the runtime-security ScannedModelClient) can
 * wrap the transport without the adapters knowing.
 */
export interface ModelClient {
  /** Model id as the server knows it. */
  readonly model: string;
  /** One chat completion; returns the assistant message content. */
  complete(messages: ChatMessage[]): Promise<string>;
}

export class ModelProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ModelProviderError';
  }
}

export interface OpenAiCompatibleClientOptions {
  /** e.g. http://localhost:8089/v1 (vLLM) or https://api.featherless.ai/v1 */
  baseUrl: string;
  /** Bearer token; some self-hosted vLLM servers accept any value. */
  apiKey?: string;
  /** Model id as the server knows it (e.g. an NVIDIA Nemotron checkpoint). */
  model: string;
  /** Default 0.2: memos and judgements want consistency over flair. */
  temperature?: number;
  maxTokens?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchFn?: FetchLike;
}

/** The slice of a chat-completions response this client reads. */
interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
}

export class OpenAiCompatibleClient implements ModelClient {
  readonly model: string;
  private readonly url: string;
  private readonly apiKey: string | undefined;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly fetchFn: FetchLike;

  constructor(options: OpenAiCompatibleClientOptions) {
    this.url = `${options.baseUrl.replace(/\/$/, '')}/chat/completions`;
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.temperature = options.temperature ?? 0.2;
    this.maxTokens = options.maxTokens ?? 1024;
    this.fetchFn = options.fetchFn ?? (globalThis.fetch as FetchLike);
  }

  /** One chat completion; returns the assistant message content. */
  async complete(messages: ChatMessage[]): Promise<string> {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchFn(this.url, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        // FetchLike is structural; real fetch accepts method/body.
        ...({
          method: 'POST',
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
          }),
        } as object),
      });
    } catch (err) {
      throw new ModelProviderError(
        `model request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!response.ok) {
      throw new ModelProviderError(
        `model endpoint returned HTTP ${response.status}`,
        response.status,
      );
    }
    let payload: ChatCompletionResponse;
    try {
      payload = (await response.json()) as ChatCompletionResponse;
    } catch (err) {
      throw new ModelProviderError(
        `model response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const choice = payload.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      // Reasoning models can exhaust max_tokens before emitting any content
      // (finish_reason "length"); surface that so the fix (raise maxTokens /
      // MODEL_MAX_TOKENS) is obvious.
      throw new ModelProviderError(
        `model response carried no content (finish_reason: ${choice?.finish_reason ?? 'unknown'})`,
      );
    }
    return content;
  }
}
