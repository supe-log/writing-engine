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
  };
}

export class HiddenLayerScanner implements RuntimeSecurityScanner {
  readonly name = 'hiddenlayer-aidr@interaction-evaluations-v2';
  private readonly apiUrl: string;
  private readonly authUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly nowMs: () => number;
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
                // Model output is the assistant speaking; ingested content and
                // prompts are untrusted input entering the context window.
                role: kind === 'output' ? 'assistant' : 'user',
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
    const action = payload.outcome?.action ?? 'NONE';
    return {
      // DETECT, REDACT, and BLOCK all mean detections fired; this agent is
      // fail-closed at every boundary, so any of them flags the content.
      flagged: action !== 'NONE' || findings.length > 0,
      findings,
      scanner: this.name,
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
