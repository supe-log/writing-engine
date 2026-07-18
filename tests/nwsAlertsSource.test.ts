import { describe, expect, it } from 'vitest';
import {
  LiveSourceError,
  NwsAlertsSource,
  type FetchLike,
} from '../src/adapters/source/NwsAlertsSource.js';
import { fixedClock } from '../src/core/clock.js';

interface AlertProps {
  event?: string;
  severity?: string;
  headline?: string;
  areaDesc?: string;
  sent?: string;
}

function nwsPayload(alerts: AlertProps[], updated?: string): unknown {
  return {
    title: undefined,
    updated,
    features: alerts.map((properties) => ({ properties })),
  };
}

/** A FetchLike returning queued responses in order; records requests. */
function stubFetch(
  responses: Array<{ ok?: boolean; status?: number; body?: unknown }>,
): FetchLike & {
  calls: Array<{ url: string; headers: Record<string, string> }>;
} {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  let i = 0;
  const fn: FetchLike = (url, init) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (!next) throw new Error('no stub response queued');
    return Promise.resolve({
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: () => Promise.resolve(next.body),
    });
  };
  return Object.assign(fn, { calls });
}

const TWO_ALERTS: AlertProps[] = [
  {
    event: 'Heat Advisory',
    severity: 'Moderate',
    headline: 'Heat Advisory until 8 PM CDT',
    areaDesc: 'Travis County',
    sent: '2026-07-18T10:00:00Z',
  },
  {
    event: 'Severe Thunderstorm Warning',
    severity: 'Severe',
    headline: 'Severe Thunderstorm Warning for Bexar County',
    areaDesc: 'Bexar County',
    sent: '2026-07-18T11:00:00Z',
  },
];

describe('NwsAlertsSource', () => {
  it('maps the alerts payload onto a SourceEvent with severity metrics', async () => {
    const fetchFn = stubFetch([
      { body: nwsPayload(TWO_ALERTS, '2026-07-18T11:05:00Z') },
    ]);
    const source = new NwsAlertsSource({ fetchFn, clock: fixedClock() });

    const event = await source.poll();
    expect(event).not.toBeNull();
    expect(event?.feed).toBe('nws-alerts-tx');
    expect(event?.id).toBe('nws-alerts-tx-active');
    expect(event?.url).toContain('api.weather.gov/alerts/active?area=TX');
    expect(event?.publishedAt).toBe('2026-07-18T11:05:00Z');
    expect(event?.metrics).toMatchObject({
      alertsActive: 2,
      severitySevere: 1,
      severityModerate: 1,
      severityExtreme: 0,
      distinctEventTypes: 2,
    });
    // Severe alerts sort ahead of moderate ones in the body.
    expect(event?.body.startsWith('Severe Thunderstorm Warning:')).toBe(true);
  });

  it('sends the mandatory User-Agent header', async () => {
    const fetchFn = stubFetch([{ body: nwsPayload([]) }]);
    const source = new NwsAlertsSource({
      fetchFn,
      userAgent: '(test agent, test@example.org)',
      clock: fixedClock(),
    });
    await source.poll();
    expect(fetchFn.calls[0]?.headers['User-Agent']).toBe(
      '(test agent, test@example.org)',
    );
  });

  it('returns null when the feed state is unchanged (fingerprint de-dup)', async () => {
    const body = nwsPayload(TWO_ALERTS, '2026-07-18T11:05:00Z');
    const fetchFn = stubFetch([{ body }, { body }]);
    const source = new NwsAlertsSource({ fetchFn, clock: fixedClock() });

    expect(await source.poll()).not.toBeNull();
    expect(await source.poll()).toBeNull();
  });

  it('emits a fresh event when the feed state changes', async () => {
    const more: AlertProps[] = [
      ...TWO_ALERTS,
      {
        event: 'Flash Flood Warning',
        severity: 'Severe',
        headline: 'Flash Flood Warning for Hays County',
        areaDesc: 'Hays County',
        sent: '2026-07-18T11:30:00Z',
      },
    ];
    const fetchFn = stubFetch([
      { body: nwsPayload(TWO_ALERTS, '2026-07-18T11:05:00Z') },
      { body: nwsPayload(more, '2026-07-18T11:31:00Z') },
    ]);
    const source = new NwsAlertsSource({ fetchFn, clock: fixedClock() });

    await source.poll();
    const second = await source.poll();
    expect(second).not.toBeNull();
    expect(second?.metrics['alertsActive']).toBe(3);
    expect(second?.metrics['severitySevere']).toBe(2);
  });

  it('treats zero active alerts as a valid, reportable state', async () => {
    const fetchFn = stubFetch([
      { body: nwsPayload([], '2026-07-18T12:00:00Z') },
    ]);
    const source = new NwsAlertsSource({ fetchFn, clock: fixedClock() });

    const event = await source.poll();
    expect(event).not.toBeNull();
    expect(event?.metrics['alertsActive']).toBe(0);
    expect(event?.body).toContain('No active alerts');
  });

  it('throws LiveSourceError on a non-ok response', async () => {
    const fetchFn = stubFetch([{ ok: false, status: 503, body: {} }]);
    const source = new NwsAlertsSource({ fetchFn, clock: fixedClock() });

    await expect(source.poll()).rejects.toMatchObject({
      name: 'LiveSourceError',
      status: 503,
    });
  });

  it('wraps network failures in LiveSourceError', async () => {
    const fetchFn: FetchLike = () => Promise.reject(new Error('ECONNREFUSED'));
    const source = new NwsAlertsSource({ fetchFn, clock: fixedClock() });

    await expect(source.poll()).rejects.toBeInstanceOf(LiveSourceError);
    await expect(source.poll()).rejects.toThrow(/ECONNREFUSED/);
  });

  it('rejects a payload without a features array', async () => {
    const fetchFn = stubFetch([{ body: { unexpected: true } }]);
    const source = new NwsAlertsSource({ fetchFn, clock: fixedClock() });

    await expect(source.poll()).rejects.toThrow(/features/);
  });

  it('honors feedUrl override and body truncation', async () => {
    const many: AlertProps[] = Array.from({ length: 8 }, (_, i) => ({
      event: `Event ${i}`,
      severity: 'Minor',
      headline: `Headline ${i}`,
      areaDesc: 'Somewhere',
      sent: `2026-07-18T0${i}:00:00Z`,
    }));
    const fetchFn = stubFetch([{ body: nwsPayload(many) }]);
    const source = new NwsAlertsSource({
      fetchFn,
      feedUrl: 'https://example.org/custom-feed',
      maxAlertsInBody: 2,
      clock: fixedClock(),
    });

    const event = await source.poll();
    expect(fetchFn.calls[0]?.url).toBe('https://example.org/custom-feed');
    expect(event?.body.split('\n')).toHaveLength(2);
  });
});
