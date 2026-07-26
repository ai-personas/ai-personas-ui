import assert from 'node:assert/strict';
import {
  humanizeMachineKey,
  isMachineIdentifier,
  operatorResponseText,
  structuredContentProjection,
} from '../assets/human-content.mjs';

assert.equal(humanizeMachineKey('next_needed_effect'), 'Next needed effect');
assert.equal(isMachineIdentifier('run-01KYZ123456789ABCDEFGH'), true);
assert.equal(isMachineIdentifier('Avery Stone'), false);

const projection = structuredContentProjection(JSON.stringify({
  schema: 'personaos-action/1',
  run_id: 'run-01KYZ123456789ABCDEFGH',
  summary: 'The converter topology is ready for review.',
  status: 'ready_for_review',
  rationale: 'Loss estimates now include switch and inductor resistance.',
  files: ['design.md', 'losses.csv'],
  signature_hex: 'ab'.repeat(64),
}));
assert.equal(projection.parsed, true);
assert.equal(projection.headline, 'The converter topology is ready for review.');
assert.ok(projection.items.includes('design.md'));
assert.ok(projection.items.includes('losses.csv'));
assert.ok(!JSON.stringify(projection.facts).includes('run-01'));
assert.ok(!JSON.stringify(projection.facts).includes('signature'));

const nested = structuredContentProjection({
  result: { message: 'Workspace created.', workspace_id: 'workspace-1234567890' },
  accepted: true,
});
assert.equal(nested.headline, 'Workspace created.');
assert.ok(nested.facts.some((fact) => fact.label === 'Accepted' && fact.value === 'Yes'));

const readable = operatorResponseText({
  message: 'Task queued.',
  run_id: 'run-01KYZ123456789ABCDEFGH',
  queued: true,
}, 202);
assert.match(readable, /^Request succeeded\./);
assert.match(readable, /Task queued\./);
assert.doesNotMatch(readable, /run-01/);

console.log('human-content tests passed');
