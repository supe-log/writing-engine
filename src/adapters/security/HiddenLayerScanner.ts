/**
 * HiddenLayer AIDR (AI Detection & Response) runtime-security scanner.
 *
 * Flow, LIVE-VERIFIED against the real API on 2026-07-18 with event
 * credentials:
 *  1. OAuth2 client-credentials token from the auth service
 *     (default https://auth.hiddenlayer.ai/oauth2/token), cached until expiry.
 *  2. POST the interaction to the v2 evaluation endpoint
 *     (default https://api.hiddenlayer.ai/detection/v2/interaction-evaluations)
 *     in canonical form: `{ interaction: { messages: [...] }, metadata }`,
 *     with an optional HL-Project-Id header.
 *  3. The response's `outcome.action` (NONE | DETECT | REDACT | BLOCK) and
 *     `outcome.detections` ({ rule_name, risk_level }) become the scan result.
 *     Verified: a prompt-injection essay returns DETECT with
 *     `[System] Prompt Injection` at HIGH; clean content returns NONE.
 *
 * Scan failures THROW. The heartbeat treats a thrown scan as fail-closed for
 * ingested content: no trustworthy scan, no write.
 */

import type {
  RuntimeSecurityScanner,
  SecurityScanFinding,
  SecurityScanResult,
} from '../../ports/index.js';
import type { FetchLike } from '../source/NwsAlertsSource.js';

export class SecurityScanError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SecurityScanError';
  }
}

export interface HiddenLayerScannerOptions {
  clientId: string;
  clientSecret: string;
  /** SaaS API base. Default https://api.hiddenlayer.ai */
  apiUrl?: string;
  /** OAuth base. Default https://auth.hiddenlayer.ai */
  authUrl?: string;
  /** Optional HL-Project-Id header for console routing. */
  projectId?: string;
  /** Auditing metadata sent with each interaction. */
  requesterId?: string;
  /** Provider label sent in evaluation metadata. Default "openai". */
  provider?: string;
  /**
   * Minimum detection severity that fails closed. Detections below this rank
   * are surfaced as findings but do NOT block (the response policy is ours to
   * set — the track judges the instrumentation, not a fixed reaction). Default
   * "medium": prompt-injection (HIGH) in a student essay is refused, while an
   * incidental LOW signal (e.g. code-like formatting in a feedback memo) is
   * logged and the loop continues. An explicit policy BLOCK always blocks.
   */
  blockMinSeverity?: 'low' | 'medium' | 'high' | 'critical';
  fetchFn?: FetchLike;
  /** Clock in ms for token-expiry checks; injectable for tests. */
  nowMs?: () => number;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

/** The response slice this adapter reads (v2 interaction-evaluations). */
interface EvaluationResponse {
  outcome?: {
    action?: 'NONE' | 'DETECT' | 'REDACT' | 'BLOCK';
    detections?: Array<{
      rule_name?: string;
      risk_level?: string;
    }>;
    /** On REDACT, the transformed payload the caller should forward. */
    effective_interaction?: {
      messages?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };
  };
}

/** Canonical roles the evaluation API accepts on a message. */
const CANONICAL_ROLES = new Set(['system', 'user', 'assistant', 'tool']);

/** Severity ordering for the fail-closed threshold. */
const SEVERITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Rank of a detection's severity; unknown severities fail closed (block). */
function severityRank(severity: string): number {
  return SEVERITY_RANK[severity.toLowerCase()] ?? Number.POSITIVE_INFINITY;
}

export class HiddenLayerScanner implements RuntimeSecurityScanner {
  readonly name = 'hiddenlayer-aidr@interaction-evaluations-v2';
  private readonly apiUrl: string;
  private readonly authUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly nowMs: () => number;
  private readonly blockThreshold: number;
  private token: { value: string; expiresAtMs: number } | null = null;

  constructor(private readonly options: HiddenLayerScannerOptions) {
    this.apiUrl = (options.apiUrl ?? 'https://api.hiddenlayer.ai').replace(
      /\/$/,
      '',
    );
    this.authUrl = (options.authUrl ?? 'https://auth.hiddenlayer.ai').replace(
      /\/$/,
      '',
    );
    this.fetchFn = options.fetchFn ?? (globalThis.fetch as FetchLike);
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.blockThreshold = SEVERITY_RANK[options.blockMinSeverity ?? 'medium']!;
  }

  async scan(
    kind: 'ingested' | 'prompt' | 'output',
    content: string,
    metadata: Record<string, string>,
  ): Promise<SecurityScanResult> {
    const token = await this.getToken();
    const response = await this.request(
      `${this.apiUrl}/detection/v2/interaction-evaluations`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(this.options.projectId
            ? { 'HL-Project-Id': this.options.projectId }
            : {}),
        },
        body: JSON.stringify({
          interaction: {
            messages: [
              {
                // Callers may name the exact canonical role via
                // metadata.messageRole (the scanned-model-client does, per
                // chat message). Fallback: model output is the assistant
                // speaking; ingested content and prompts are untrusted input.
                role:
                  metadata['messageRole'] &&
                  CANONICAL_ROLES.has(metadata['messageRole'])
                    ? metadata['messageRole']
                    : kind === 'output'
                      ? 'assistant'
                      : 'user',
                content: [{ type: 'text', text: content }],
              },
            ],
          },
          // Only the documented metadata fields go on the wire; the scan-site
          // metadata (feed, url, role) stays in local findings/notes.
          metadata: {
            model: metadata['model'] ?? 'writing-engine',
            provider: this.options.provider ?? 'openai',
            requester_id: this.options.requesterId ?? 'writing-engine',
          },
        }),
      },
    );

    const payload = (await response.json()) as EvaluationResponse;
    const findings = parseDetections(payload);
    const action = payload.outcome?.action;
    // Response policy (ours, documented, risk-tiered):
    //  - BLOCK  → always fail closed (the policy explicitly said block).
    //  - REDACT → proceed with the transformed payload (handled below).
    //  - DETECT → fail closed only when the highest-severity detection meets
    //    the block threshold (default MEDIUM). A LOW-severity signal — e.g.
    //    incidental code-like formatting in a feedback memo — is surfaced as a
    //    finding but does NOT halt the loop. A HIGH prompt-injection does.
    // (Live 2026-07-18: REDACT can arrive with an empty detections array, e.g.
    // GENERIC_API_KEY PII masking, so `action` is the primary verdict source.)
    const maxSeverity = findings.reduce(
      (max, f) => Math.max(max, severityRank(f.severity)),
      0,
    );
    const flagged =
      action === 'BLOCK' ||
      (action !== 'REDACT' &&
        findings.length > 0 &&
        maxSeverity >= this.blockThreshold);
    const effectiveContent =
      action === 'REDACT'
        ? payload.outcome?.effective_interaction?.messages?.[0]?.content?.find(
            (part) => part.type === 'text' && typeof part.text === 'string',
          )?.text
        : undefined;
    return {
      flagged,
      findings,
      scanner: this.name,
      ...(effectiveContent !== undefined ? { effectiveContent } : {}),
    };
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAtMs > this.nowMs() + 30_000) {
      return this.token.value;
    }
    const basic = Buffer.from(
      `${this.options.clientId}:${this.options.clientSecret}`,
    ).toString('base64');
    const response = await this.request(
      `${this.authUrl}/oauth2/token?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: '',
      },
    );
    const payload = (await response.json()) as TokenResponse;
    if (!payload.access_token) {
      throw new SecurityScanError('HiddenLayer auth returned no access_token');
    }
    this.token = {
      value: payload.access_token,
      expiresAtMs: this.nowMs() + (payload.expires_in ?? 300) * 1000,
    };
    return this.token.value;
  }

  private async request(
    url: string,
    init: { headers: Record<string, string>; body: string },
  ): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }> {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchFn(url, {
        headers: init.headers,
        ...({ method: 'POST', body: init.body } as object),
      });
    } catch (err) {
      throw new SecurityScanError(
        `HiddenLayer request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!response.ok) {
      throw new SecurityScanError(
        `HiddenLayer returned HTTP ${response.status}`,
        response.status,
      );
    }
    return response;
  }
}

function parseDetections(payload: EvaluationResponse): SecurityScanFinding[] {
  return (payload.outcome?.detections ?? []).map((d) => ({
    category: d.rule_name ?? 'unknown',
    severity: d.risk_level ?? 'unknown',
    detail: `${d.rule_name ?? 'detection'} (policy ${payload.outcome?.action ?? 'DETECT'})`,
  }));
}
