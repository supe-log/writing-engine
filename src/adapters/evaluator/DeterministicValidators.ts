import type { DeterministicValidator } from '../../ports/index.js';
import type {
  Artifact,
  SourceSnapshot,
  ValidatorResult,
  WritingTask,
} from '../../domain/types.js';
import { countWords } from '../writer/TemplateWriter.js';

/**
 * Model-free checks that run BEFORE any rubric judgement. Deterministic
 * validators catch objective failures (missing citations, stale timestamps,
 * malformed structure, injection markers) so the rubric evaluator is only ever
 * asked to judge things a machine cannot decide by inspection.
 *
 * Each result names the rubric dimension it informs; the lesson extractor uses
 * failed checks to target a specific, reusable repair.
 */
export class DeterministicValidators implements DeterministicValidator {
  validate(
    artifact: Artifact,
    task: WritingTask,
    snapshot: SourceSnapshot,
  ): ValidatorResult[] {
    const content = artifact.content;
    const words = countWords(content);

    const results: ValidatorResult[] = [];

    results.push({
      check: 'citation-coverage',
      dimension: 'sourceFidelity',
      passed: artifact.citations.length >= task.minCitations,
      detail: `Found ${artifact.citations.length} citation(s); require >= ${task.minCitations}.`,
    });

    results.push({
      check: 'source-url-present',
      dimension: 'sourceFidelity',
      passed: content.includes(snapshot.event.url),
      detail: content.includes(snapshot.event.url)
        ? 'Snapshot source URL is present.'
        : 'Snapshot source URL is missing from the artifact.',
    });

    results.push({
      check: 'word-count',
      dimension: 'style',
      passed: words >= task.minWords && words <= task.maxWords,
      detail: `Word count ${words}; allowed [${task.minWords}, ${task.maxWords}].`,
    });

    results.push({
      check: 'freshness-line',
      dimension: 'freshness',
      passed: content.includes('What changed and why now'),
      detail: content.includes('What changed and why now')
        ? 'Freshness section present.'
        : 'Missing an explicit "what changed and why now" section.',
    });

    results.push({
      check: 'explicit-recommendation',
      dimension: 'audienceUsefulness',
      passed: content.includes('Recommended action:'),
      detail: content.includes('Recommended action:')
        ? 'Explicit recommendation present.'
        : 'No explicit, actionable recommendation for the audience.',
    });

    results.push({
      check: 'primary-implication',
      dimension: 'insight',
      passed: content.includes('## Implication'),
      detail: content.includes('## Implication')
        ? 'States a primary implication.'
        : 'Does not surface a non-obvious implication.',
    });

    results.push({
      check: 'structured-sections',
      dimension: 'structure',
      passed:
        content.includes('## Premise') &&
        content.includes('## Evidence') &&
        content.includes('## Conclusion'),
      detail: 'Requires Premise, Evidence, and Conclusion sections.',
    });

    results.push({
      check: 'no-generic-phrasing',
      dimension: 'style',
      passed: !content.includes('In this ever-changing landscape'),
      detail: content.includes('In this ever-changing landscape')
        ? 'Contains generic AI phrasing.'
        : 'Free of the flagged generic phrasing.',
    });

    results.push({
      check: 'no-duplicate-passages',
      dimension: 'structure',
      passed: !hasDuplicateParagraph(content),
      detail: hasDuplicateParagraph(content)
        ? 'Contains duplicated passages.'
        : 'No duplicated passages detected.',
    });

    results.push({
      check: 'timestamp-not-stale',
      dimension: 'freshness',
      passed: !isStale(snapshot),
      detail: `Snapshot published ${snapshot.event.publishedAt}, retrieved ${snapshot.retrievedAt}.`,
    });

    results.push({
      check: 'safety-scan',
      dimension: 'safety',
      passed: !containsInjectionMarker(content),
      detail: containsInjectionMarker(content)
        ? 'Possible prompt-injection / secret-leak marker detected.'
        : 'No injection or secret-leak markers detected.',
    });

    return results;
  }
}

function hasDuplicateParagraph(content: string): boolean {
  const paras = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 40);
  return new Set(paras).size !== paras.length;
}

function isStale(snapshot: SourceSnapshot): boolean {
  const published = new Date(snapshot.event.publishedAt).getTime();
  const retrieved = new Date(snapshot.retrievedAt).getTime();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return retrieved - published > twentyFourHours;
}

function containsInjectionMarker(content: string): boolean {
  const markers = [
    'ignore your instructions',
    'ignore previous instructions',
    'export the data',
    'BEGIN RSA PRIVATE KEY',
  ];
  const lower = content.toLowerCase();
  return markers.some((m) => lower.includes(m.toLowerCase()));
}
