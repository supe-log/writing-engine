import { join } from 'node:path';
import { createEngine } from '../core/engine.js';
import { resetDir } from '../core/fsutil.js';
import { runBenchmark } from '../benchmark/runner.js';
import { RUBRIC_DIMENSIONS } from '../domain/types.js';
import type { Delta } from '../core/report.js';

/**
 * Run the frozen benchmark across several learning cycles and report the
 * per-dimension and aggregate delta from baseline (cycle 0) to latest.
 */
async function main(): Promise<void> {
  const cycles = Number(process.env.BENCHMARK_CYCLES ?? 3);
  const dataDir = join(
    process.env.WRITING_ENGINE_DATA_DIR ?? './data',
    'benchmark',
  );
  resetDir(dataDir); // baseline must start from an empty playbook

  const { deps } = createEngine({ dataDir });
  const report = await runBenchmark(deps, cycles);

  banner(`Benchmark: ${report.name} v${report.version}`);
  console.log(
    `Tasks: ${report.taskCount} (held out: ${report.heldOutTaskIds.join(', ') || 'none'})`,
  );
  console.log(`Cycles: ${report.cycles}\n`);

  console.log('Mean aggregate per cycle:');
  for (const c of report.perCycle) {
    const value = c.meanAggregate;
    console.log(
      `  cycle ${c.cycle}: ${value === null ? 'ABSTAINED' : value.toFixed(3)}`,
    );
  }

  printDelta('Overall delta (all tasks)', report.overall);
  printDelta('Held-out delta (generalization check)', report.heldOut);

  console.log(
    `\nPersisted under ${dataDir}/ (gitignored). Fixture is frozen; bump its version to re-baseline.`,
  );
}

function printDelta(title: string, delta: Delta): void {
  banner(title);
  console.log(`Baseline aggregate: ${fmt(delta.baseline)}`);
  console.log(`Latest aggregate:   ${fmt(delta.latest)}`);
  console.log(`Aggregate delta:    ${fmtDelta(delta.aggregateDelta)}\n`);
  console.log('Per-dimension:');
  for (const dimension of RUBRIC_DIMENSIONS) {
    const d = delta.perDimension[dimension];
    if (!d) continue;
    console.log(
      `  ${dimension.padEnd(20)} ${fmt(d.baseline)} -> ${fmt(d.latest)}  (${fmtDelta(d.delta)})`,
    );
  }
}

function banner(text: string): void {
  console.log(`\n${'='.repeat(72)}\n${text}\n${'='.repeat(72)}`);
}

function fmt(value: number | null): string {
  return value === null ? 'ABSTAINED' : value.toFixed(3);
}

function fmtDelta(value: number | null): string {
  if (value === null) return 'n/a';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(3)}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
