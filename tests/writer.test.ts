import { describe, expect, it } from 'vitest';
import { buildArtifact } from './helpers.js';

describe('TemplateWriter', () => {
  it('produces a weak baseline with no lessons applied', async () => {
    const { artifact } = await buildArtifact(false);
    expect(artifact.citations).toHaveLength(0);
    expect(artifact.content).toContain('In this ever-changing landscape');
    expect(artifact.content).not.toContain('## Recommendation');
    expect(artifact.content).not.toContain('## Implication');
    expect(artifact.appliedLessonIds).toHaveLength(0);
  });

  it('applies lesson directives to repair the artifact', async () => {
    const { artifact, snapshot } = await buildArtifact(true);
    expect(artifact.citations.length).toBeGreaterThanOrEqual(1);
    expect(artifact.citations).toContain(snapshot.event.url);
    expect(artifact.content).toContain('## What changed and why now');
    expect(artifact.content).toContain('Recommended action:');
    expect(artifact.content).toContain('## Implication');
    expect(artifact.content).toContain('## Premise');
    expect(artifact.content).not.toContain('In this ever-changing landscape');
    expect(artifact.appliedLessonIds.length).toBe(6);
  });

  it('is deterministic for identical inputs', async () => {
    const a = await buildArtifact(true);
    const b = await buildArtifact(true);
    expect(a.artifact.id).toBe(b.artifact.id);
    expect(a.artifact.content).toBe(b.artifact.content);
  });
});
