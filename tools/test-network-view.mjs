import assert from 'node:assert/strict';

import {
  NETWORK_VIEW_LIMITS,
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
  progressiveGroupLimit,
  safeCount,
  selectMonitoringBases,
  selectPriorityWindow,
  selectSearchWindow,
  takeProgressiveGroupWindow,
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
