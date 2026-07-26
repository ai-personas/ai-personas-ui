import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  friendlyDuration,
  humanActivityPresentation,
  humanizeMachineKey,
  isMachineIdentifier,
  operatorResponseText,
  structuredContentProjection,
} from '../assets/human-content.mjs';

assert.equal(friendlyDuration(37_966), '38 seconds');
assert.equal(friendlyDuration(61_000), '1 minute 1 second');
assert.deepEqual(humanActivityPresentation('MODEL_CALL_SUCCEEDED',{
  purpose: 'artifact_review', status: 200, latencyMs: 37_966,
}), {
  headline: 'Finished a model-assisted work step',
  summary: 'Reviewing the deliverables.',
  duration: '38 seconds',
  context: 'reviewing the deliverables',
});
assert.equal(humanActivityPresentation('MODEL_CALL',{purpose:'model'}).context,
  'working through the task');
assert.deepEqual(humanActivityPresentation('PERSONA_ACTION_AUTHORED',{
  action: 'command_exec',
  actionPurpose: 'Run the package validator against the current review files',
}), {
  headline: 'Ran a workspace command',
  summary: 'Run the package validator against the current review files.',
  duration: '',
  context: '',
});
assert.equal(humanActivityPresentation('PERSONA_ACTION_AUTHORED',{
  action: 'propose_persona_birth',
}).headline, 'Proposed a new specialist');
assert.equal(humanActivityPresentation('PERSONA_ACTION_AUTHORED',{
  action: 'discover_coordination_actions',
}).headline, 'Checked available collaboration actions');
assert.equal(humanActivityPresentation('PERSONA_PRESSURE_APPRAISAL_AUTHORED').headline,
  'Assessed whether more work is needed');
assert.equal(humanActivityPresentation('PERSONA_COGNITIVE_INTENT').headline,
  'Chose the next work step');

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

const portalSource = readFileSync(new URL('../assets/discovery.js', import.meta.url), 'utf8');
assert.doesNotMatch(portalSource, /workspace is currently empty/i);
assert.match(portalSource, /signed live-run capture, not a claim that the durable workspace is empty/i);
assert.match(portalSource, /signedIdentity\.description/,
  'persona cards must fall back to the verified public self-description');
assert.match(portalSource, /exactProjection=exactText\?structuredContentProjection/,
  'signed JSON cognition must be projected into human text on the card');
assert.doesNotMatch(portalSource, /__personaosDebugState/,
  'release builds must not expose mutable internal UI state');

console.log('human-content tests passed');
