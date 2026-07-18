# Dataset provenance

The demo and benchmark run entirely on **synthetic fixtures**. No real dataset is
shipped in this repository. A **real live feed** (NOAA NWS active alerts) is
available at runtime via `npm run heartbeat:live`; its provenance is recorded
below. This document records what the fixtures model, why they are synthetic,
and the live-feed terms.

## What ships in the repo

| Fixture           | Path                                          | Purpose                                                                                                                                                                                  |
| ----------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo civic feed   | `src/fixtures/events/tx-demo-civic-feed.json` | The heartbeat's "live" source. Two successive polls return the **same event id with updated metrics**, so the engine detects genuine freshness rather than re-summarizing a static file. |
| Demo writing task | `src/fixtures/demoTask.ts`                    | The decision-memo contract the demo artifact must satisfy.                                                                                                                               |
| Frozen benchmark  | `src/benchmark/fixtures/benchmark.json`       | Three tasks (two learning, one held-out) used to measure the baseline-to-latest delta. Frozen: changing it invalidates cross-run comparisons.                                            |

## What the demo feed models

`tx-demo-civic-feed` is a **synthetic** stand-in for a Texas civic open-data feed:
a weekly district-enrollment snapshot for a regional education service area, with
`totalEnrolled`, `districtsReporting`, and `chronicAbsenteeismFlags` metrics. The
second poll is a _revision_ of the first (late-reporting districts raise the
totals), which is what gives the writer a real "what changed and why now" to
report.

All identifiers, URLs (`https://example.org/tx-demo/...`), and figures are
invented for this scaffold. They resemble the _shape_ of real Texas open data but
correspond to no actual record.

## Why synthetic

- **Reproducibility.** A frozen fixture plus a fixed clock makes `npm run demo`
  byte-for-byte deterministic — the property the Recursive Intelligence track is
  judged on. A live feed changes under you.
- **No credentials, no network.** The demo and benchmark run offline, so a
  reviewer can reproduce results with `npm install && npm run demo`.
- **No licensing risk.** Synthetic data carries no attribution or redistribution
  constraints.

## Licensing

The synthetic fixtures are original to this repository and are covered by the
repository [LICENSE](../LICENSE) (MIT). Because no third-party data is included,
there are no external attribution or redistribution obligations.

## The real live feed: NOAA NWS active alerts

`NwsAlertsSource` (`src/adapters/source/NwsAlertsSource.ts`), selected with
`SOURCE_ADAPTER=live`:

- **Publisher:** US National Weather Service (NOAA), api.weather.gov
- **Endpoint:** `https://api.weather.gov/alerts/active?area=TX` (area
  configurable via `NWS_AREA`; full override via `LIVE_FEED_URL`)
- **License:** US-government work, public domain; no key required
- **Retrieval terms:** the API requires an identifying `User-Agent` header
  (sent by default; override with `LIVE_USER_AGENT`). Rate limits are
  unpublished — the default 30s poll interval is conservative. Occasional 5xx
  responses surface as visible source errors, never fabricated events.
- **Provenance:** each poll is captured as a content-hashed snapshot with the
  feed URL as the anchor and the real retrieval time (`systemClock`).

The engine's design principle is unchanged: **live source is truth; memory is
context.** Note the evidence gate treats live-alert memo-writing as its own
domain (`nws-alerts-tx`, currently AMBER): the data is real, but the writing
domain has not yet earned a benchmark — so default live runs observe and
refuse to write.

An Apify actor dataset or a Texas open-data portal endpoint remain documented
alternatives behind the same `LiveSourceAdapter` port.
