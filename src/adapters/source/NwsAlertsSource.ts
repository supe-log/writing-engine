/**
 * Live source adapter over the NOAA National Weather Service active-alerts API
 * (https://api.weather.gov/alerts/active?area=TX by default): free, keyless,
 * US-government public-domain data that updates continuously.
 *
 * Each poll maps the CURRENT feed state onto one SourceEvent with a constant
 * event id and updated numeric metrics — the same freshness model the fixture
 * feed uses, so the researcher's metric deltas and novelty detection work
 * unchanged. When the feed state has not changed since the last poll (compared
 * by content fingerprint), poll() returns null and the heartbeat takes its
 * honest idle path. Network and payload failures throw LiveSourceError — a
 * failed poll is an error, never a fabricated event.
 */

import type { LiveSourceAdapter } from '../../ports/index.js';
import type { SourceEvent } from '../../domain/types.js';
import type { Clock } from '../../core/clock.js';
import { systemClock } from '../../core/clock.js';
import { sha256 } from '../../core/hash.js';

/**
 * Minimal structural fetch type so tests can inject stubs and the adapter does
 * not depend on DOM lib typings.
 */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** A live poll that failed. Callers must treat this as a visible error. */
export class LiveSourceError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LiveSourceError';
  }
}

export interface NwsAlertsSourceOptions {
  /** Two-letter area code appended to the alerts endpoint. Default "TX". */
  area?: string;
  /** Full feed URL override; wins over `area` when provided. */
  feedUrl?: string;
  /**
   * api.weather.gov requires a User-Agent identifying the application and a
   * contact address; requests without one are rejected.
   */
  userAgent?: string;
  /** How many alerts to include in the event body. Default 5. */
  maxAlertsInBody?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchFn?: FetchLike;
  /** Fallback timestamp source when the payload carries none. */
  clock?: Clock;
}

/** The slice of the NWS GeoJSON payload this adapter reads. */
interface NwsAlertsPayload {
  title?: string;
  updated?: string;
  features?: Array<{
    properties?: {
      event?: string;
      severity?: string;
      headline?: string;
      areaDesc?: string;
      sent?: string;
    };
  }>;
}

const SEVERITIES = ['Extreme', 'Severe', 'Moderate', 'Minor'] as const;

const DEFAULT_USER_AGENT =
  '(writing-engine hackathon demo, team@aitxcommunity.com)';

export class NwsAlertsSource implements LiveSourceAdapter {
  readonly name: string;
  private readonly url: string;
  private readonly userAgent: string;
  private readonly maxAlertsInBody: number;
  private readonly fetchFn: FetchLike;
  private readonly clock: Clock;
  private lastFingerprint: string | null = null;

  constructor(options: NwsAlertsSourceOptions = {}) {
    const area = options.area ?? 'TX';
    this.name = `nws-alerts-${area.toLowerCase()}`;
    this.url =
      options.feedUrl ??
      `https://api.weather.gov/alerts/active?area=${encodeURIComponent(area)}`;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.maxAlertsInBody = options.maxAlertsInBody ?? 5;
    this.fetchFn = options.fetchFn ?? (globalThis.fetch as FetchLike);
    this.clock = options.clock ?? systemClock;
  }

  async poll(): Promise<SourceEvent | null> {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchFn(this.url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/geo+json',
        },
      });
    } catch (err) {
      throw new LiveSourceError(
        `NWS alerts fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        this.url,
      );
    }
    if (!response.ok) {
      throw new LiveSourceError(
        `NWS alerts request returned HTTP ${response.status}`,
        this.url,
        response.status,
      );
    }

    let payload: NwsAlertsPayload;
    try {
      payload = (await response.json()) as NwsAlertsPayload;
    } catch (err) {
      throw new LiveSourceError(
        `NWS alerts payload was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
        this.url,
      );
    }
    if (!Array.isArray(payload.features)) {
      throw new LiveSourceError(
        'NWS alerts payload missing the "features" array',
        this.url,
      );
    }

    const event = this.toSourceEvent(payload);

    // De-dup by content fingerprint: an unchanged feed state is "nothing new",
    // which lets the heartbeat idle honestly instead of re-snapshotting.
    const fingerprint = sha256(event);
    if (fingerprint === this.lastFingerprint) {
      return null;
    }
    this.lastFingerprint = fingerprint;
    return event;
  }

  private toSourceEvent(payload: NwsAlertsPayload): SourceEvent {
    const alerts = (payload.features ?? []).map((f) => f.properties ?? {});

    const metrics: Record<string, number> = {
      alertsActive: alerts.length,
      severityExtreme: 0,
      severitySevere: 0,
      severityModerate: 0,
      severityMinor: 0,
      severityUnknown: 0,
      distinctEventTypes: new Set(alerts.map((a) => a.event ?? 'Unknown')).size,
    };
    for (const alert of alerts) {
      const severity = alert.severity ?? '';
      const key = (SEVERITIES as readonly string[]).includes(severity)
        ? `severity${severity}`
        : 'severityUnknown';
      metrics[key] = (metrics[key] ?? 0) + 1;
    }

    const severeOrWorse =
      (metrics['severityExtreme'] ?? 0) + (metrics['severitySevere'] ?? 0);

    const headline = alerts
      .slice()
      .sort(
        (a, b) =>
          severityRank(a.severity) - severityRank(b.severity) ||
          (b.sent ?? '').localeCompare(a.sent ?? ''),
      )
      .slice(0, this.maxAlertsInBody)
      .map(
        (a) =>
          `${a.event ?? 'Unknown event'}: ${a.headline ?? '(no headline)'} (${a.areaDesc ?? 'area unknown'})`,
      );

    const publishedAt =
      payload.updated ??
      alerts
        .map((a) => a.sent)
        .filter((s): s is string => typeof s === 'string')
        .sort()
        .at(-1) ??
      this.clock.now();

    return {
      // Constant id: this is one logical stream whose state updates between
      // polls, exactly like the fixture feed. Freshness lives in the metrics.
      id: `${this.name}-active`,
      feed: this.name,
      url: this.url,
      title:
        payload.title ??
        `Active NWS alerts — ${alerts.length} active (${severeOrWorse} severe or worse)`,
      body:
        headline.length > 0
          ? headline.join('\n')
          : 'No active alerts for the monitored area.',
      publishedAt,
      metrics,
    };
  }
}

function severityRank(severity: string | undefined): number {
  const idx = (SEVERITIES as readonly string[]).indexOf(severity ?? '');
  return idx === -1 ? SEVERITIES.length : idx;
}
