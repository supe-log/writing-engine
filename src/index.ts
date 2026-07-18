/** Public entry points for embedding the Writing Engine as a library. */
export * from './domain/types.js';
export * from './domain/records.js';
export * from './ports/index.js';
export { createEngine } from './core/engine.js';
export { Heartbeat } from './core/heartbeat.js';
export { runCycle } from './core/pipeline.js';
export type { CycleResult } from './core/pipeline.js';
export { LessonMemory, PROMOTION_THRESHOLD } from './core/lessonMemory.js';
export { computeDelta, meanScores } from './core/report.js';
export { runBenchmark, loadBenchmark } from './benchmark/runner.js';
export type { BenchmarkReport } from './benchmark/runner.js';
