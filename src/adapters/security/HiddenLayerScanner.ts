/**
 * HiddenLayer AIDR (AI Detection & Response) runtime-security scanner.
 *
 * Flow, per HiddenLayer's public integration docs:
 *  1. OAuth2 client-credentials token from the auth service
 *     (default https://auth.hiddenlayer.ai/oauth2/token), cached until expiry.
 *  2. POST the interaction to the SaaS analysis endpoint
 *     (default https://api.hiddenlayer.ai/detection/v1/interactions) with an
 *     optional HL-Project-Id header; detections in the response become
 *     findings.
 *
 * The request payload mapping follows the publicly documented proxy
 * integrations (endpoint + auth verified; exact detection field names should
 * be confirmed against the official SDK on the first authenticated call —
 * `parseDetections` is the single place to adjust).
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
  fetchFn?: FetchLike;
  /** Clock in ms for token-expiry checks; injectable for tests. */
  nowMs?: () => number;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

/** The response slice this adapter reads; adjust here if the SDK differs. */
interface InteractionsResponse {
  detections?: Array<{
    category?: string;
    severity?: string;
    detection_type?: string;
    description?: string;
  }>;
  evaluation?: { flagged?: boolean };
}

export class HiddenLayerScanner implements RuntimeSecurityScanner {
  readonly name = 'hiddenlayer-aidr@detection-v1';
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
      `${this.apiUrl}/detection/v1/interactions`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(this.options.projectId
            ? { 'HL-Project-Id': this.options.projectId }
            : {}),
        },
        body: JSON.stringify({
          metadata: {
            model: metadata['model'] ?? 'writing-engine',
            requester_id: this.options.requesterId ?? 'writing-engine',
            ...metadata,
            boundary: kind,
          },
          // Ingested content and prompts are analyzed as input; artifacts as output.
          ...(kind === 'output' ? { output: content } : { input: content }),
        }),
      },
    );

    const payload = (await response.json()) as InteractionsResponse;
    const findings = parseDetections(payload);
    return {
      flagged: payload.evaluation?.flagged ?? findings.length > 0,
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

function parseDetections(payload: InteractionsResponse): SecurityScanFinding[] {
  return (payload.detections ?? []).map((d) => ({
    category: d.category ?? d.detection_type ?? 'unknown',
    severity: d.severity ?? 'unknown',
    detail: d.description ?? 'detection triggered',
  }));
}
