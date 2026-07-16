import assert from 'node:assert/strict';

import {
  NETWORK_VIEW_LIMITS,
  PROVIDER_INDEX_LIMITS,
  collectBrowserLibp2pBootstraps,
  collectLibp2pBootstraps,
  compactCount,
  liveTaskMissionProjection,
  nextProgressiveGroupLevel,
  normalizeLibp2pBootstrap,
  normalizeBrowserLibp2pBootstrap,
  normalizeMonitoringBase,
  publishedMissionEvidenceProjection,
  projectTerminalModelFailures,
  providerIndexResponseByteLimit,
  PUBLIC_TASK_RUN_POLL_LIMIT,
  responseByteLengthWithinLimit,
  progressiveGroupLimit,
  safeCount,
  selectMonitoringBases,
  selectPriorityWindow,
  selectSearchWindow,
  selectVerifiedPublicTaskRunTargets,
  takeProgressiveGroupWindow,
  terminalTaskMissionProjection,
  verifiedPersonaIdentityPresent,
  verifiedPersonaLifecyclePresent,
  verifiedPersonaRenderable,
  personaLifecycleProjection,
} from '../assets/network-view.mjs';

const announcedMultiaddr = '/dns4/personas.example/tcp/443/wss/p2p/12D3KooWTest';
assert.equal(normalizeLibp2pBootstrap(announcedMultiaddr), announcedMultiaddr);
assert.equal(normalizeLibp2pBootstrap(`  ${announcedMultiaddr}  `), announcedMultiaddr);
for (const invalid of [
  'https://peer.example',
  'http://127.0.0.1:8765',
  '//dns4/peer.example/tcp/443/wss',
  '/dns4/peer.example/tcp/443/wss?token=secret',
  '/dns4/peer.example/tcp/443/wss\n/p2p/other',
  null,
]) {
  assert.equal(normalizeLibp2pBootstrap(invalid), null);
}
assert.deepEqual(collectLibp2pBootstraps(
  ['https://federation.example', announcedMultiaddr],
  new Set([announcedMultiaddr, '/dns4/relay.example/tcp/443/wss/p2p/relay']),
), [announcedMultiaddr, '/dns4/relay.example/tcp/443/wss/p2p/relay']);

const loopbackWs = '/ip4/127.0.0.1/tcp/8788/ws/p2p/12D3KooWLoopback';
const containerWs = '/ip4/172.17.0.3/tcp/8788/ws/p2p/12D3KooWContainer';
const secureWs = '/dns4/relay.example/tcp/443/wss/p2p/12D3KooWSecure';
const tlsWs = '/dns4/relay.example/tcp/443/tls/ws/p2p/12D3KooWTls';
const webRtc = '/dns4/relay.example/udp/443/webrtc-direct/p2p/12D3KooWWebRtc';
for (const blocked of [loopbackWs, containerWs]) {
  assert.equal(normalizeBrowserLibp2pBootstrap(blocked, {pageProtocol: 'https:'}), null,
    'HTTPS pages must not hand guaranteed mixed-content WebSocket dials to libp2p');
  assert.equal(normalizeBrowserLibp2pBootstrap(blocked, {pageProtocol: 'http:'}), blocked,
    'HTTP node-served portals may use an announced plain WebSocket transport');
}
for (const allowed of [secureWs, tlsWs, webRtc]) {
  assert.equal(normalizeBrowserLibp2pBootstrap(allowed, {pageProtocol: 'https:'}), allowed);
}
assert.deepEqual(collectBrowserLibp2pBootstraps(
  {pageProtocol: 'https:'},
  [loopbackWs, secureWs, containerWs, tlsWs, secureWs],
), [secureWs, tlsWs], 'browser bootstrap collection must filter before deduped dialing');

const signedLiveTask = {
  kind: 'task',
  label: 'design a complete four-bedroom house',
  did: 'did:personaos:kernel:test/task/run-01KTEST',
  description: 'awaiting peer sense-making live task',
  capability_summary: [
    'available_model:gpt-5.4',
    'live_task',
    'model_pool_hash:fixture-pool',
    'task_state:awaiting peer sense-making',
  ].sort(),
};

const canaryPublishedTask = {
  kind: 'task',
  label: 'design 4 bedroom house',
  did: 'did:personaos:kernel:canary/task/run-01KXF8JBFGQ71A8S8EPGMM6R48',
  capability_summary: ['event_driven_handoff'],
};
assert.deepEqual(publishedMissionEvidenceProjection(canaryPublishedTask), {
  task: 'design 4 bedroom house',
  state: 'published',
  run: 'run-01KXF8JBFGQ71A8S8EPGMM6R48',
  kind: 'task',
  publishedEvidence: true,
}, 'unknown persona-authored capability vocabulary must not hide verified task evidence');
for (const kind of ['task', 'project', 'mission']) {
  const projected = publishedMissionEvidenceProjection({
    kind,
    label: `${kind} evidence`,
    did: `did:personaos:kernel:test/${kind}/run-${kind}`,
    capability_summary: kind === 'task' ? [] : null,
  });
  assert.equal(projected.kind, kind);
  assert.equal(projected.state, 'published');
  assert.equal(projected.run, `run-${kind}`);
}
assert.equal(publishedMissionEvidenceProjection({
  ...canaryPublishedTask,
  capability_summary: ['an_entirely_different_work_mode'],
}).task, canaryPublishedTask.label,
'published task admission must be invariant under open capability vocabulary');
assert.equal(publishedMissionEvidenceProjection({...canaryPublishedTask, kind: 'artifact'}), null);
assert.equal(publishedMissionEvidenceProjection({...canaryPublishedTask, label: '\n'}), null);
assert.equal(publishedMissionEvidenceProjection({
  ...canaryPublishedTask,
  label: 'x'.repeat(300),
}).task.length, 256, 'signed task labels must be bounded before entering the DOM');
assert.equal(publishedMissionEvidenceProjection({
  ...canaryPublishedTask,
  did: 'did:personaos:kernel:canary/mission/run-wrong-kind',
}).run, '', 'a run identifier must be bound to the signed record kind');

const taskPollRecord = {
  ...signedLiveTask,
  visibility_tier: 'public',
  _kernel: 'kernel:test',
  _storeKey: 'kernel-test::task-live',
  _inventorySource: 'kernel:test',
  _inventoryGeneration: 7,
  _inventoryHash: 'sha256:current-inventory',
  _doc: {record_signature_verified: true, policy_signature_verified: true},
};
const taskPollInventory = new Map([['kernel:test', {
  generation: 7,
  hash: 'sha256:current-inventory',
  base: 'https://node.example/api',
  recordKeys: new Set([taskPollRecord._storeKey]),
  generatedAt: 1_783_683_600_000,
  expiresAt: 1_783_687_200_000,
}]]);
const taskPollBoots = new Map([['https://node.example/api', {kernel_id: 'kernel:test'}]]);
assert.deepEqual(selectVerifiedPublicTaskRunTargets(
  [taskPollRecord], taskPollInventory, taskPollBoots, {nowMs: 1_783_683_601_000},
), [{
  base: 'https://node.example/api',
  run: 'run-01KTEST',
  kernel: 'kernel:test',
  recordKey: taskPollRecord._storeKey,
}], 'a current browser-verified public task DID must seed its exact node/run poll');
for (const refused of [
  {...taskPollRecord, visibility_tier: 'project_only'},
  {...taskPollRecord, _doc: {...taskPollRecord._doc, record_signature_verified: false}},
  {...taskPollRecord, _doc: {...taskPollRecord._doc, policy_signature_verified: false}},
  {...taskPollRecord, _inventoryGeneration: 6},
  {...taskPollRecord, _inventoryHash: 'sha256:stale'},
  {...taskPollRecord, _inventorySource: 'kernel:other'},
  {...taskPollRecord, kind: 'project'},
  {...taskPollRecord, did: 'did:personaos:kernel:test/task/task-without-run',
    _links: {live: '/k/run-link-must-not-authorize/live-artifacts'}},
]) {
  assert.deepEqual(selectVerifiedPublicTaskRunTargets(
    [refused], taskPollInventory, taskPollBoots, {nowMs: 1_783_683_601_000},
  ), [], 'unsigned, stale, private, non-task, and link-derived run candidates must fail closed');
}
assert.deepEqual(selectVerifiedPublicTaskRunTargets(
  [taskPollRecord], taskPollInventory, taskPollBoots,
  {focusedKernel: 'kernel:other', nowMs: 1_783_683_601_000},
), [], 'a task outside the focused kernel must not create background polling');
assert.deepEqual(selectVerifiedPublicTaskRunTargets(
  [taskPollRecord], taskPollInventory,
  new Map([['https://node.example/api', {kernel_id: 'kernel:other'}]]),
  {nowMs: 1_783_683_601_000},
), [], 'an inventory base whose bootstrap names another kernel must not be joined');
for (const inventory of [
  {...taskPollInventory.get('kernel:test'), expiresAt: 1_783_683_601_000},
  {...taskPollInventory.get('kernel:test'), expiresAt: Number.NaN},
  (() => { const value = {...taskPollInventory.get('kernel:test')}; delete value.expiresAt; return value; })(),
  {...taskPollInventory.get('kernel:test'), generatedAt: Number.NaN},
]) {
  assert.deepEqual(selectVerifiedPublicTaskRunTargets(
    [taskPollRecord], new Map([['kernel:test', inventory]]), taskPollBoots,
    {nowMs: 1_783_683_601_000},
  ), [], 'absent, malformed, and expired inventory authority must not seed polling');
}

const terminalPollRecord = {...taskPollRecord, capability_summary: ['complete']};
assert.deepEqual(selectVerifiedPublicTaskRunTargets(
  [terminalPollRecord], taskPollInventory, taskPollBoots, {nowMs: 1_783_683_601_000},
), [], 'an exact signed terminal task must not consume a live endpoint probe');

const publishedHistory = Array.from({length: PUBLIC_TASK_RUN_POLL_LIMIT}, (_, index) => ({
  ...taskPollRecord,
  did: `did:personaos:kernel:test/task/run-published-${index}`,
  capability_summary: ['awaiting_external_handoff'],
  _storeKey: `kernel-test::published-${index}`,
}));
const liveAfterHistory = {
  ...taskPollRecord,
  did: 'did:personaos:kernel:test/task/run-current-after-history',
  _storeKey: 'kernel-test::current-after-history',
};
const historyInventory = new Map([['kernel:test', {
  ...taskPollInventory.get('kernel:test'),
  recordKeys: new Set([...publishedHistory, liveAfterHistory].map((record) => record._storeKey)),
}]]);
const historyTargets = selectVerifiedPublicTaskRunTargets(
  [...publishedHistory, liveAfterHistory], historyInventory, taskPollBoots,
  {nowMs: 1_783_683_601_000},
);
assert.equal(historyTargets.length, PUBLIC_TASK_RUN_POLL_LIMIT,
  'automatic public run polling must retain its hard browser request ceiling');
assert.equal(historyTargets[0].run, 'run-current-after-history',
  'exact signed live evidence must outrank a full window of published history');

const manyPollRecords = Array.from({length: PUBLIC_TASK_RUN_POLL_LIMIT + 12}, (_, index) => ({
  ...taskPollRecord,
  did: `did:personaos:kernel:test/task/run-bounded-${index}`,
  _storeKey: `kernel-test::task-${index}`,
}));
const manyInventory = new Map([['kernel:test', {
  ...taskPollInventory.get('kernel:test'),
  recordKeys: new Set(manyPollRecords.map((record) => record._storeKey)),
}]]);
assert.equal(selectVerifiedPublicTaskRunTargets(
  manyPollRecords, manyInventory, taskPollBoots,
  {limit: Number.MAX_SAFE_INTEGER, nowMs: 1_783_683_601_000},
).length, PUBLIC_TASK_RUN_POLL_LIMIT,
'automatic public run polling must retain a hard browser request ceiling');

assert.deepEqual(terminalTaskMissionProjection({
  ...canaryPublishedTask,
  capability_summary: ['complete'],
}), {
  task: 'design 4 bedroom house',
  state: 'complete',
  run: 'run-01KXF8JBFGQ71A8S8EPGMM6R48',
  terminalTask: true,
  terminalCapability: 'complete',
}, 'a signed generic terminal capability must outrank publication fallback state');
for (const state of [
  'complete', 'completed', 'succeeded', 'failed', 'cancelled', 'canceled', 'aborted', 'stopped',
]) {
  assert.equal(terminalTaskMissionProjection({
    ...canaryPublishedTask,
    capability_summary: [state],
  })?.state, state, `terminal task capability ${state} must retain its signed spelling`);
}
for (const refused of [
  canaryPublishedTask,
  {...canaryPublishedTask, capability_summary: ['event_driven_handoff']},
  {...canaryPublishedTask, capability_summary: ['complete', 'failed']},
  {...canaryPublishedTask, capability_summary: ['complete', 'complete']},
  {...canaryPublishedTask, capability_summary: [' complete']},
  {...canaryPublishedTask, capability_summary: ['COMPLETE']},
  {...canaryPublishedTask, kind: 'project', capability_summary: ['complete']},
]) {
  assert.equal(terminalTaskMissionProjection(refused), null,
    'unknown, conflicting, malformed, or non-task capabilities must not become terminal state');
}

assert.deepEqual(liveTaskMissionProjection(signedLiveTask), {
  task: 'design a complete four-bedroom house',
  state: 'awaiting peer sense-making',
  run: 'run-01KTEST',
  liveTask: true,
});
const legacySortedLiveTask = {
  ...signedLiveTask,
  description: 'waiting_for_persona live task',
  capability_summary: [
    'live_task',
    'waiting_for_persona',
    'model_pool_hash:legacy-pool',
  ].sort(),
};
assert.equal(liveTaskMissionProjection(legacySortedLiveTask), null,
  'bare capability vocabulary must never be interpreted as live task state');
for (const refused of [
  {...signedLiveTask, capability_summary: []},
  {...signedLiveTask, capability_summary: ['live_task']},
  {...signedLiveTask, capability_summary: ['live_task', 'task_state:']},
  {...signedLiveTask, capability_summary: ['live_task', 'task_state: queued']},
  {...signedLiveTask, capability_summary: ['live_task', `task_state:${'x'.repeat(41)}`]},
  {...signedLiveTask, capability_summary: ['live_task', 'task_state:queued\nforged']},
  {...signedLiveTask, capability_summary: [
    'live_task', 'task_state:queued', 'task_state:running',
  ]},
  {...legacySortedLiveTask, description: 'some other signed description'},
  {...legacySortedLiveTask, capability_summary: [
    'live_task', 'waiting_for_persona', 'waiting_for_persona',
  ]},
  {...signedLiveTask, kind: 'project'},
  {...signedLiveTask, label: ''},
]) {
  assert.equal(liveTaskMissionProjection(refused), null,
    'mission surface must not infer an unsigned or malformed live-task state');
}

const terminalFailures = projectTerminalModelFailures([
  {kind: 'MODEL_SELECTED', persona_id: 'persona-a', environment_id: 'env-a',
    model_id: 'model-a', requested_purpose: 'draft'},
  {kind: 'MODEL_TRANSPORT_NO_RETRY', persona_id: 'persona-a', environment_id: 'env-a',
    status: 504, reason: 'fallback remains possible'},
  {kind: 'MODEL_CALL_FAILED', persona_id: 'persona-a', environment_id: 'env-a',
    model_id: 'model-a', requested_purpose: 'draft', status: 400,
    reason: ' invalid structured output\nfrom transport '},
  {kind: 'MODEL_SELECTED', persona_id: 'persona-b', environment_id: 'env-b',
    model_id: 'model-b', requested_purpose: 'review'},
  {kind: 'MODEL_CALL_FAILED', persona_id: 'persona-b', environment_id: 'env-b',
    model_id: 'model-b', requested_purpose: 'review', status: 503,
    reason: 'backend unavailable'},
]);
assert.equal(terminalFailures.byPersona.get('persona-a')?.status, 400,
  'a later persona attempt must not erase another persona terminal failure');
assert.equal(terminalFailures.byEnvironment.get('env-b')?.purpose, 'review');
assert.equal(terminalFailures.latest?.model, 'model-b');
assert.equal(terminalFailures.latest?.reason, 'backend unavailable');
assert.equal(projectTerminalModelFailures([
  {kind: 'MODEL_CALL_FAILED', persona_id: 'persona-a', status: 500},
  {kind: 'MODEL_SELECTED', persona_id: 'persona-a', model_id: 'recovery-model'},
]).byPersona.has('persona-a'), false,
'a newer selected attempt must supersede historical terminal failure state');
assert.equal(projectTerminalModelFailures([
  {kind: 'MODEL_FALLBACK_USED', persona_id: 'persona-a', status: 503},
  {kind: 'MODEL_TRANSPORT_NO_RETRY', persona_id: 'persona-a', status: 503},
]).latest, null, 'fallback and transport diagnostics are not terminal execution state');
const succeededTerminalCall = projectTerminalModelFailures([
  {kind: 'MODEL_SELECTED', persona_id: 'persona-a', environment_id: 'env-a'},
  {kind: 'MODEL_CALL_FAILED', persona_id: 'persona-a', environment_id: 'env-a',
    status: 503, reason: 'transient terminal projection'},
  {kind: 'MODEL_CALL_SUCCEEDED', persona_id: 'persona-a', environment_id: 'env-a',
    model_id: 'recovery-model'},
]);
assert.equal(succeededTerminalCall.latest, null,
  'a terminal success must clear the matching kernel failure projection');
assert.equal(succeededTerminalCall.byPersona.has('persona-a'), false,
  'a terminal success must clear the matching persona failure projection');
assert.equal(succeededTerminalCall.byEnvironment.has('env-a'), false,
  'a terminal success must clear the matching environment failure projection');
const unrelatedSuccess = projectTerminalModelFailures([
  {kind: 'MODEL_CALL_FAILED', persona_id: 'persona-a', environment_id: 'env-a', status: 500},
  {kind: 'MODEL_CALL_SUCCEEDED', persona_id: 'persona-b', environment_id: 'env-b'},
]);
assert.equal(unrelatedSuccess.byPersona.has('persona-a'), true,
  'one persona success must not erase another persona failure');
assert.equal(unrelatedSuccess.latest?.personaId, 'persona-a',
  'an unrelated success must not erase the kernel latest failure');
const samePersonaOtherEnvironment = projectTerminalModelFailures([
  {kind: 'MODEL_CALL_FAILED', persona_id: 'persona-a', environment_id: 'env-a', status: 500},
  {kind: 'MODEL_CALL_SUCCEEDED', persona_id: 'persona-a', environment_id: 'env-b'},
]);
assert.equal(samePersonaOtherEnvironment.byPersona.has('persona-a'), true,
  'a success in another environment must not erase the persona failure');
assert.equal(samePersonaOtherEnvironment.latest?.environmentId, 'env-a',
  'cross-environment success must not erase the kernel latest failure');
const sameEnvironmentOtherPersona = projectTerminalModelFailures([
  {kind: 'MODEL_CALL_FAILED', persona_id: 'persona-a', environment_id: 'env-a', status: 500},
  {kind: 'MODEL_CALL_SUCCEEDED', persona_id: 'persona-b', environment_id: 'env-a'},
]);
assert.equal(sameEnvironmentOtherPersona.byEnvironment.has('env-a'), true,
  'another persona success must not erase the shared environment failure');
assert.equal(projectTerminalModelFailures([
  {kind: 'MODEL_CALL_FAILED', persona_id: 'persona-a', environment_id: 'env-a', status: 500},
  {kind: 'MODEL_CALL_SUCCEEDED'},
]).latest?.personaId, 'persona-a', 'unattributed success must never clear failure state');

const fixturePersonaId = 'persona-a';
const fixtureIdentityKey = 'ab'.repeat(32);
const fixtureAvatar = {
  schema: 'persona-avatar/2',
  kind: 'raster',
  body_path: `assets/persona-avatars/sha256/${'12'.repeat(32)}.png`,
  content_ref: `sha256:${'12'.repeat(32)}`,
  sha256: '12'.repeat(32),
  mime_type: 'image/png',
  byte_length: 68,
  width: 1,
  height: 1,
  character_prompt_hash: `sha256:${'34'.repeat(32)}`,
  provenance_hash: `sha256:${'56'.repeat(32)}`,
  persona_id: fixturePersonaId,
  identity_signing_key_id: `persona:${fixturePersonaId}`,
  identity_public_key_hex: fixtureIdentityKey,
  identity_signature_hex: '78'.repeat(64),
};
const completePersonaIdentity = {
  kind: 'persona',
  did: `did:personaos:kernel-a/persona/${fixturePersonaId}`,
  label: 'Aster Rowan',
  _personaSignedName: 'Aster Rowan',
  _personaIdentityPublicKeyHex: fixtureIdentityKey,
  avatar: fixtureAvatar,
};
const verifiedPersonaRecords = new Map([
  ['kernel-a\u0000persona\u0000persona-a', completePersonaIdentity],
  ['kernel-a\u0000env\u0000env-a', {kind: 'env', label: 'Workshop'}],
]);
assert.equal(verifiedPersonaIdentityPresent(
  verifiedPersonaRecords, 'kernel-a\u0000persona\u0000persona-a',
), true);
assert.equal(verifiedPersonaIdentityPresent(
  verifiedPersonaRecords, 'kernel-a\u0000persona\u0000missing-persona',
), false, 'telemetry without a signed persona record must not create a card');
assert.equal(verifiedPersonaIdentityPresent(
  verifiedPersonaRecords, 'kernel-a\u0000env\u0000env-a',
), false, 'a signed non-persona record must not create a persona card');
for (const incomplete of [
  {...completePersonaIdentity, _personaSignedName: fixturePersonaId},
  {...completePersonaIdentity, _personaSignedName: `Persona ${fixturePersonaId}`},
  {...completePersonaIdentity, _personaSignedName: ''},
  {...completePersonaIdentity, avatar: null},
  {...completePersonaIdentity, avatar: {...fixtureAvatar, kind: 'vector'}},
  {...completePersonaIdentity, avatar: {...fixtureAvatar, persona_id: 'persona-b'}},
  {...completePersonaIdentity, _personaIdentityPublicKeyHex: 'cd'.repeat(32)},
]) {
  assert.equal(verifiedPersonaIdentityPresent(
    new Map([['kernel-a\u0000persona\u0000persona-a', incomplete]]),
    'kernel-a\u0000persona\u0000persona-a',
  ), false, 'an incomplete, mechanical, or unbound identity must stay hidden');
}
assert.equal(verifiedPersonaIdentityPresent(
  new Map([['kernel-a\u0000persona\u0000persona-b', completePersonaIdentity]]),
  'kernel-a\u0000persona\u0000persona-b',
), false, 'the signed persona identity must match the exact telemetry entity key');

const pendingLifecycle={
  schema:'personaos-persona-lifecycle-card/1',persona_id:fixturePersonaId,
  did:`did:personaos:kernel-a/persona/${fixturePersonaId}`,lifecycle_state:'ACTIVE',
  identity_materialization_state:'pending',identity_fields:{
    name:{state:'pending',persona_authored:false},
    characteristics:{state:'pending',persona_authored:false},
    avatar:{state:'pending',persona_authored:false},
  },identity_signing_key_id:`persona:${fixturePersonaId}`,
  identity_public_key_hex:fixtureIdentityKey,identity_signature_verified:true,
  identity_signature_hash:`sha256:${'12'.repeat(32)}`,lifecycle_chain_verified:true,
  lifecycle_chain_head_hash:`sha256:${'34'.repeat(32)}`,
  authority:'kernel_observed_verified_persona_lifecycle',issued_at:'2026-07-15T00:00:00+00:00',
  signing_key_id:'kernel-master',signature_hex:'ab'.repeat(64),
};
const pendingPersona={kind:'persona',did:pendingLifecycle.did,label:'',_personaSignedName:'',
  _personaLifecycleVerified:true,_personaIdentitySigningKeyId:`persona:${fixturePersonaId}`,
  _personaIdentityPublicKeyHex:fixtureIdentityKey,persona_lifecycle_card:pendingLifecycle};
const pendingKey=`kernel-a\u0000persona\u0000${fixturePersonaId}`;
const pendingRecords=new Map([[pendingKey,pendingPersona]]);
assert.equal(verifiedPersonaIdentityPresent(pendingRecords,pendingKey),false,
  'a lifecycle shell must not be recast as a materialized identity');
assert.equal(verifiedPersonaLifecyclePresent(pendingRecords,pendingKey),true);
assert.equal(verifiedPersonaRenderable(pendingRecords,pendingKey),true,
  'a verified pending lifecycle must remain visibly discoverable');
assert.deepEqual(personaLifecycleProjection(pendingRecords,pendingKey),{
  personaId:fixturePersonaId,lifecycleState:'ACTIVE',materializationState:'pending',
  identityFields:{
    name:{state:'pending',personaAuthored:false},
    characteristics:{state:'pending',personaAuthored:false},
    avatar:{state:'pending',personaAuthored:false},
  },
});
const adoptedNameLifecycle={...pendingLifecycle,identity_fields:{
  ...pendingLifecycle.identity_fields,
  name:{state:'materialized',persona_authored:true},
}};
const adoptedNamePendingPersona={...pendingPersona,label:'Aster Rowan',_personaSignedName:'Aster Rowan',
  persona_lifecycle_card:adoptedNameLifecycle};
const adoptedNamePendingRecords=new Map([[pendingKey,adoptedNamePendingPersona]]);
assert.equal(verifiedPersonaIdentityPresent(adoptedNamePendingRecords,pendingKey),false,
  'an adopted display name alone must not promote a pending shell to complete identity');
assert.equal(verifiedPersonaLifecyclePresent(adoptedNamePendingRecords,pendingKey),true,
  'a pending shell may retain an independently verified persona-authored display name');
assert.equal(verifiedPersonaRenderable(adoptedNamePendingRecords,pendingKey),true,
  'a named pending shell must remain renderable while preserving materialization state');
assert.equal(personaLifecycleProjection(
  adoptedNamePendingRecords,pendingKey,
)?.identityFields.name.personaAuthored,true);
for(const refused of [
  {...pendingPersona,_personaLifecycleVerified:false},
  {...pendingPersona,persona_lifecycle_card:{...pendingLifecycle,persona_id:'other'}},
  {...pendingPersona,persona_lifecycle_card:{...pendingLifecycle,signature_hex:'bad'}},
  {...pendingPersona,persona_lifecycle_card:{...pendingLifecycle,unexpected:'signed but invalid'}},
  {...pendingPersona,_personaIdentityPublicKeyHex:'cd'.repeat(32)},
  {...pendingPersona,persona_lifecycle_card:{...pendingLifecycle,lifecycle_state:'DORMANT'}},
  {...pendingPersona,persona_lifecycle_card:{...pendingLifecycle,identity_materialization_state:'materialized'}},
  {...pendingPersona,persona_lifecycle_card:{...pendingLifecycle,identity_fields:{...pendingLifecycle.identity_fields,
    name:{state:'pending',persona_authored:'yes'}}}},
  {...pendingPersona,persona_lifecycle_card:{...pendingLifecycle,identity_fields:{...pendingLifecycle.identity_fields,
    name:{state:'pending',persona_authored:true}}}},
]) assert.equal(verifiedPersonaLifecyclePresent(new Map([[pendingKey,refused]]),pendingKey),false,
  'unverified or malformed lifecycle shells must stay hidden');

const normalProviderCount = 19;
const normalProviderBytes = 56_100;
const normalProviderLimit = providerIndexResponseByteLimit(normalProviderCount, 20_000);
assert.ok(normalProviderBytes < normalProviderLimit,
  'ordinary signed provider records need bounded framing headroom at small counts');
const scaleProviderCount = 2_016;
const scaleProviderBytes = 7_420_883;
const scaleProviderLimit = providerIndexResponseByteLimit(scaleProviderCount, 20_000);
assert.equal(PROVIDER_INDEX_LIMITS.maxSignedEnvelopeBytes, 4 * 1024,
  'the provider-only response budget needs an explicit per-envelope ceiling');
assert.ok(scaleProviderBytes > 4 * 1024 * 1024,
  'the signed scale fixture must exercise the provider-specific path');
assert.ok(scaleProviderBytes < scaleProviderLimit,
  'the measured 2,016-envelope fixture must fit with bounded headroom');
assert.ok(scaleProviderBytes > scaleProviderLimit - scaleProviderCount * 512,
  'the provider-specific scale fixture should meaningfully exercise its narrow cap');
assert.equal(providerIndexResponseByteLimit(20_001, 20_000), 0,
  'an advertised population above the record cache ceiling must be refused');
assert.equal(providerIndexResponseByteLimit(-1, 20_000), 0,
  'an invalid provider count must be refused before fetching');
assert.equal(responseByteLengthWithinLimit(scaleProviderLimit, scaleProviderLimit), true);
assert.equal(responseByteLengthWithinLimit(scaleProviderLimit + 1, scaleProviderLimit), false,
  'a provider response one byte over its derived cap must be refused');

function* millionNodes() {
  for (let index = 0; index < 1_000_000; index++) {
    yield {
      id: `node-${String(index).padStart(7, '0')}`,
      label: index % 100_000 === 42 ? `Needle relay ${index}` : `Kernel ${index}`,
      priority: index % 997,
    };
  }
}

// A million inputs produce eight deterministic rows and no million-item derived array.
const million = selectPriorityWindow(millionNodes(), {
  limit: 8,
  keyOf: (item) => item.id,
  priorityOf: (item) => item.priority,
});
assert.equal(million.scanned, 1_000_000);
assert.equal(million.matched, 1_000_000);
assert.equal(million.items.length, 8);
assert.deepEqual(million.items.map((item) => item.id), [
  'node-0000996', 'node-0001993', 'node-0002990', 'node-0003987',
  'node-0004984', 'node-0005981', 'node-0006978', 'node-0007975',
]);

const searched = selectSearchWindow(millionNodes(), 'needle relay', {
  limit: 4,
  keyOf: (item) => item.id,
  priorityOf: (item) => item.priority,
});
assert.equal(searched.items.length, 4);
assert.equal(searched.matched, 10);
assert.ok(searched.items.every((item) => /Needle relay/.test(item.label)));
assert.deepEqual(
  selectPriorityWindow([
    {id: 'b', priority: 2}, {id: 'a', priority: 2}, {id: 'c', priority: 1},
  ], {limit: 2}).items.map((item) => item.id),
  ['a', 'b'],
  'equal-priority rows must be ordered by stable key, not arrival race',
);
const scanBound = selectPriorityWindow(millionNodes(), {limit: 3, scanLimit: 25});
assert.equal(scanBound.scanned, 25);
assert.equal(scanBound.scanLimitReached, true);

// Each group advances independently and never exceeds its explicit ceiling.
const groupProgress = new Map([['alpha', 0], ['beta', 2], ['maxed', 999]]);
const groupOptions = {initial: 12, step: 12, max: 48};
assert.equal(progressiveGroupLimit('alpha', groupProgress, groupOptions), 12);
assert.equal(progressiveGroupLimit('beta', groupProgress, groupOptions), 36);
assert.equal(progressiveGroupLimit('maxed', groupProgress, groupOptions), 48);
assert.equal(nextProgressiveGroupLevel('beta', groupProgress, groupOptions), 3);
const beta = takeProgressiveGroupWindow(
  (function* () { for (let i = 0; i < 1000; i++) yield i; }()),
  'beta',
  groupProgress,
  groupOptions,
);
assert.equal(beta.items.length, 36);
assert.equal(beta.scanned, 37, 'a collapsed group should consume only one look-ahead row');
assert.equal(beta.hasMore, true);
assert.equal(beta.omittedIsLowerBound, true);
const exactGroup = takeProgressiveGroupWindow(Array.from({length: 1000}, (_, i) => i),
  'beta', groupProgress, groupOptions);
assert.equal(exactGroup.total, 1000);
assert.equal(exactGroup.omitted, 964);

// Mandatory focus/activity expands the soft budget; no mandatory base is evicted.
const monitoring = selectMonitoringBases([
  {base: 'https://cold.example/node/', priority: 100},
  {base: 'https://live-c.example/', active: true, priority: 1},
  {base: 'https://fill.example/', priority: 90},
  {base: 'https://focused-b.example/', focused: true, priority: 0},
], {
  focusedBase: 'https://focused-a.example/',
  activeBases: ['https://live-a.example/', 'https://live-b.example/'],
  limit: 2,
  hardLimit: 8,
});
assert.deepEqual(monitoring.focused, [
  'https://focused-a.example', 'https://focused-b.example',
]);
assert.deepEqual(monitoring.active, [
  'https://live-a.example', 'https://live-b.example', 'https://live-c.example',
]);
assert.equal(monitoring.limit, 5);
for (const required of [...monitoring.focused, ...monitoring.active]) {
  assert.ok(monitoring.bases.includes(required), `${required} was silently dropped`);
}
const filled = selectMonitoringBases([
  {base: 'https://low.example', priority: 1},
  {base: 'https://high.example', priority: 9},
], {focusedBase: '', limit: 2, hardLimit: 4});
assert.deepEqual(filled.bases, ['', 'https://high.example']);
assert.throws(() => selectMonitoringBases([], {
  activeBases: Array.from({length: 5}, (_, i) => `https://active-${i}.example`),
  limit: 1,
  hardLimit: 4,
}), /exceed hard limit/);
assert.equal(normalizeMonitoringBase('https://user:secret@example.test/'), null);
assert.equal(normalizeMonitoringBase('javascript:alert(1)'), null);
assert.equal(normalizeMonitoringBase('@origin'), '');

// Count formatting is bounded, exact below 1K, and BigInt-safe above Number.MAX_SAFE_INTEGER.
assert.equal(safeCount(-2), 0);
assert.equal(safeCount('100000000000000000000000'), Number.MAX_SAFE_INTEGER);
assert.equal(safeCount('350', 100), 100);
assert.equal(compactCount(999), '999');
assert.equal(compactCount(1_500), '1.5K');
assert.equal(compactCount(12_345_678), '12.3M');
assert.equal(compactCount(999_999_999_999_999_999n), '999Q');
assert.equal(compactCount(10n ** 40n), '999Q+');
assert.equal(compactCount('not-a-count'), '0');

assert.equal(NETWORK_VIEW_LIMITS.maxScan, 1_000_000);
console.log('bounded network view contract: ok');
