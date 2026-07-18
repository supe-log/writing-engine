import { describe, expect, it } from 'vitest';
import { LayeredEvidenceGateEvaluator } from '../src/adapters/evidenceGate/LayeredEvidenceGateEvaluator.js';
import { fixedClock } from '../src/core/clock.js';
import {
  nwsAlertsDomainEvidence,
  txCivicMemoEvidence,
} from '../src/fixtures/demoDomainEvidence.js';
import { PERMISSION_RANK, permits } from '../src/domain/evidenceGate.js';

const gate = new LayeredEvidenceGateEvaluator(fixedClock());

describe('demo domain evidence', () => {
  it('tx-civic-memo earns YELLOW / prototype', () => {
    const record = gate.evaluate(txCivicMemoEvidence);
    expect(record.status).toBe('YELLOW');
    expect(record.maxPermission).toBe('prototype');
  });

  it('nws-alerts-tx is AMBER / investigate until labels exist', () => {
    const record = gate.evaluate(nwsAlertsDomainEvidence);
    expect(record.status).toBe('AMBER');
    expect(record.maxPermission).toBe('investigate');
    expect(record.report.missingEvidence.join(' ')).toMatch(/labels/);
  });
});

describe('permission ordering', () => {
  it('each tier permits itself and everything below', () => {
    expect(permits('prototype', 'prototype')).toBe(true);
    expect(permits('prototype', 'investigate')).toBe(true);
    expect(permits('autonomous', 'pilot')).toBe(true);
  });

  it('a lower tier never permits a higher requirement', () => {
    expect(permits('investigate', 'prototype')).toBe(false);
    expect(permits('pilot', 'autonomous')).toBe(false);
  });

  it('ranks are strictly increasing', () => {
    expect(PERMISSION_RANK.investigate).toBeLessThan(PERMISSION_RANK.prototype);
    expect(PERMISSION_RANK.prototype).toBeLessThan(PERMISSION_RANK.pilot);
    expect(PERMISSION_RANK.pilot).toBeLessThan(PERMISSION_RANK.autonomous);
  });
});
