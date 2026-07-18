import { rmSync } from 'node:fs';

/** Remove a directory tree if it exists (used to reset the demo/benchmark store). */
export function resetDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
