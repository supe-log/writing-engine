# Dataset provenance

The demo and benchmark run entirely on **synthetic fixtures**. No real dataset is
downloaded, scraped, or shipped in this repository. This document records what the
fixtures model, why they are synthetic, and the path to a real live feed.

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

## Path to a real live feed

The source is a replaceable port (`LiveSourceAdapter`). To point the engine at a
real feed:

1. Implement `src/adapters/source/LiveSourceAdapter.todo.ts` against a real public
   source — e.g. a Texas open-data portal endpoint, NOAA, or an Apify actor.
2. Wire it in `createEngine` (`src/core/engine.ts`) — the one place adapters are
   selected.
3. Configure endpoints/keys via `.env` (see [.env.example](../.env.example)); the
   demo needs none.

When wiring a real feed, honor the source's terms of use and licensing, and record
the actual provenance (publisher, license, retrieval terms) here — replacing the
synthetic description above. The engine's design principle is unchanged: **live
source is truth; memory is context.**
