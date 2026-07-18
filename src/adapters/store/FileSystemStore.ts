import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Store } from '../../ports/index.js';
import type {
  Artifact,
  Evaluation,
  EvidencePack,
  Lesson,
  RunRecord,
  SourceSnapshot,
} from '../../domain/types.js';
import type { DecisionRecord } from '../../domain/evidenceGate.js';

/**
 * Filesystem JSON implementation of {@link Store}.
 *
 * Records are written as pretty-printed JSON under a gitignored data directory,
 * one file per record, partitioned by kind. Each record carries a
 * `schemaVersion` (see src/domain/records.ts) so a future migration or a
 * Supabase-backed store can detect and translate old shapes.
 *
 * This is intentionally the simplest durable store that preserves every artifact
 * for inspection. The Supabase port (not implemented) would satisfy the same
 * interface; nothing in the pipeline depends on the filesystem specifically.
 */
interface StoreDirs {
  snapshots: string;
  evidence: string;
  artifacts: string;
  evaluations: string;
  runs: string;
  lessons: string;
  decisions: string;
}

export class FileSystemStore implements Store {
  private readonly dirs: StoreDirs;

  constructor(baseDir: string) {
    this.dirs = {
      snapshots: join(baseDir, 'snapshots'),
      evidence: join(baseDir, 'evidence'),
      artifacts: join(baseDir, 'artifacts'),
      evaluations: join(baseDir, 'evaluations'),
      runs: join(baseDir, 'runs'),
      lessons: join(baseDir, 'lessons'),
      decisions: join(baseDir, 'decisions'),
    };
    for (const dir of Object.values(this.dirs)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  saveSnapshot(snapshot: SourceSnapshot): Promise<void> {
    this.writeRecord(this.dirs.snapshots, snapshot.id, snapshot);
    return Promise.resolve();
  }

  latestSnapshotForFeed(feed: string): Promise<SourceSnapshot | null> {
    const snapshots = this.readAll<SourceSnapshot>(this.dirs.snapshots)
      .filter((s) => s.event.feed === feed)
      .sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt));
    return Promise.resolve(snapshots.at(-1) ?? null);
  }

  saveEvidence(pack: EvidencePack): Promise<void> {
    this.writeRecord(this.dirs.evidence, pack.snapshotId, pack);
    return Promise.resolve();
  }

  saveArtifact(artifact: Artifact): Promise<void> {
    this.writeRecord(this.dirs.artifacts, artifact.id, artifact);
    return Promise.resolve();
  }

  saveEvaluation(evaluation: Evaluation): Promise<void> {
    this.writeRecord(this.dirs.evaluations, evaluation.artifactId, evaluation);
    return Promise.resolve();
  }

  saveRun(run: RunRecord): Promise<void> {
    this.writeRecord(this.dirs.runs, run.id, run);
    return Promise.resolve();
  }

  listRuns(): Promise<RunRecord[]> {
    const runs = this.readAll<RunRecord>(this.dirs.runs).sort(
      (a, b) => a.cycle - b.cycle || a.createdAt.localeCompare(b.createdAt),
    );
    return Promise.resolve(runs);
  }

  saveLesson(lesson: Lesson): Promise<void> {
    this.writeRecord(this.dirs.lessons, lesson.id, lesson);
    return Promise.resolve();
  }

  lessonsForScope(scope: string): Promise<Lesson[]> {
    const lessons = this.readAll<Lesson>(this.dirs.lessons).filter(
      (l) => l.scope === scope,
    );
    return Promise.resolve(lessons);
  }

  allLessons(): Promise<Lesson[]> {
    return Promise.resolve(this.readAll<Lesson>(this.dirs.lessons));
  }

  saveDecision(record: DecisionRecord): Promise<void> {
    // Keyed by domain + evaluation time: the audit trail accumulates rather
    // than overwriting earlier decisions for the same domain.
    this.writeRecord(
      this.dirs.decisions,
      `${record.domainId}-${record.evaluatedAt}`,
      record,
    );
    return Promise.resolve();
  }

  listDecisions(): Promise<DecisionRecord[]> {
    const decisions = this.readAll<DecisionRecord>(this.dirs.decisions).sort(
      (a, b) => a.evaluatedAt.localeCompare(b.evaluatedAt),
    );
    return Promise.resolve(decisions);
  }

  private writeRecord(dir: string, id: string, record: unknown): void {
    const safe = id.replace(/[^a-zA-Z0-9_.-]/g, '_');
    writeFileSync(
      join(dir, `${safe}.json`),
      JSON.stringify(record, null, 2),
      'utf8',
    );
  }

  private readAll<T>(dir: string): T[] {
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      return [];
    }
    return files.map(
      (f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T,
    );
  }
}
