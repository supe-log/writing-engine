/**
 * CLI: evaluate the evidence gates for the STAAR ECR worked example and print
 * the auditable decision record. Deterministic and offline, like the demo.
 *
 *   npm run gate
 */

import { LayeredEvidenceGateEvaluator } from '../adapters/evidenceGate/LayeredEvidenceGateEvaluator.js';
import { fixedClock } from '../core/clock.js';
import { staarEcrEvidence } from '../fixtures/staarEvidence.js';

const evaluator = new LayeredEvidenceGateEvaluator(fixedClock());
const record = evaluator.evaluate(staarEcrEvidence);

console.log(JSON.stringify(record, null, 2));
console.log();
console.log(
  `[gate] ${record.domainId}: ${record.status} — max permission: ${record.maxPermission}`,
);
console.log(`[gate] next experiment: ${record.nextExperiment}`);
