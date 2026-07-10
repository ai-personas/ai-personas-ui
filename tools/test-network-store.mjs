import assert from 'node:assert/strict';
import {
  DEFAULT_NETWORK_LIMITS,
  entityIdentity,
  NetworkStore,
  TelemetryAdmissionGate,
  networkEntityKey,
  networkStreamKey,
  splitNetworkKey,
} from '../assets/network-store.mjs';

let now = 1_000;
const clock = () => now;

// A short id can repeat on independent kernels without overwriting either entity.
const shared = 'persona:shared';
const aKey = networkEntityKey('kernel:a', 'persona', shared);
const bKey = networkEntityKey('kernel:b', 'persona', shared);
assert.notEqual(aKey, bKey);
assert.deepEqual(splitNetworkKey(aKey), {
  kernelId: 'kernel:a', kind: 'persona', identity: 'shared',
});
assert.equal(entityIdentity({kernel_id: 'kernel:a', kind: 'persona', persona_id: shared}).key,
  aKey);
assert.equal(entityIdentity({kernel_id: 'kernel:a', kind: 'persona',
  did: 'did:personaos:kernel:a/persona/persona:shared'}).key, aKey);
assert.equal(networkEntityKey('kernel:a', 'environment', 'env-1'),
  networkEntityKey('kernel:a', 'env', 'env-1'));
assert.throws(() => networkEntityKey('', 'persona', shared), /kernelId is required/);

// Durable records have a hard LRU ceiling. Pinned rows survive while an unpinned
// eviction candidate exists, but the limit remains hard even if every row is pinned.
const bounded = new NetworkStore({now: clock, limits: {...DEFAULT_NETWORK_LIMITS,
  maxEntities: 3, maxPinned: 2}});
bounded.upsertEntity({kernel_id: 'kernel:a', kind: 'persona', persona_id: 'p1', name: 'one'});
bounded.upsertEntity({kernel_id: 'kernel:a', kind: 'persona', persona_id: 'p2', name: 'two'});
bounded.pinEntity(networkEntityKey('kernel:a', 'persona', 'p1'));
bounded.upsertEntity({kernel_id: 'kernel:a', kind: 'persona', persona_id: 'p3', name: 'three'});
bounded.upsertEntity({kernel_id: 'kernel:a', kind: 'persona', persona_id: 'p4', name: 'four'});
assert.equal(bounded.stats().entities, 3);
assert.ok(bounded.getEntity(networkEntityKey('kernel:a', 'persona', 'p1')));
assert.equal(bounded.getEntity(networkEntityKey('kernel:a', 'persona', 'p2')), null);

// Presence is sequence-admitted and lease-derived. Missing refreshes first age to
// stale, then offline; an offline row remains inspectable for a bounded retention.
const leases = new NetworkStore({now: clock, limits: {...DEFAULT_NETWORK_LIMITS,
  presenceStaleAfterMs: 5_000, presenceLeaseMs: 10_000, offlineRetentionMs: 20_000}});
let admitted = leases.upsertPresence({kernel_id: 'kernel:a', kind: 'persona',
  persona_id: 'p1', seq: 7, state: 'running_llm'});
const leaseKey = networkEntityKey('kernel:a', 'persona', 'p1');
assert.equal(admitted.accepted, true);
assert.equal(admitted.value.freshness, 'live');
assert.equal(leases.upsertPresence({kernel_id: 'kernel:a', kind: 'persona',
  persona_id: 'p1', seq: 7}).reason, 'duplicate_sequence');
assert.equal(leases.upsertPresence({kernel_id: 'kernel:a', kind: 'persona',
  persona_id: 'p1', seq: 6}).reason, 'out_of_order_sequence');
now = 6_001;
assert.equal(leases.presenceStatus(leaseKey).freshness, 'stale');
assert.equal(leases.presenceStatus(leaseKey).effective_state, 'stale');
now = 11_001;
assert.equal(leases.presenceStatus(leaseKey).freshness, 'offline');
assert.equal(leases.listPresence({includeOffline: false}).length, 0);
assert.deepEqual(leases.sweepPresence(), {offline: 1, pruned: 0, remaining: 1});
now = 31_002;
assert.deepEqual(leases.sweepPresence(), {offline: 1, pruned: 1, remaining: 0});

// Events are deduplicated, monotonic within a stream, gap-aware, and ring-bounded.
now = 50_000;
const events = new NetworkStore({now: clock, limits: {...DEFAULT_NETWORK_LIMITS,
  maxEventStreams: 2, maxEventsPerStream: 3, maxEventsTotal: 4}});
const stream = networkStreamKey('kernel:a', 'run', 'run-1');
const ev = (seq, id) => ({kernel_id: 'kernel:a', run_id: 'run-1', seq,
  event_id: id, kind: 'MODEL_CALL'});
assert.equal(events.ingestEvent(ev(1, 'e1')).accepted, true);
assert.equal(events.ingestEvent(ev(1, 'e1')).reason, 'duplicate_event');
assert.equal(events.ingestEvent(ev(1, 'different')).reason, 'duplicate_sequence');
assert.equal(events.ingestEvent(ev(0, 'old')).reason, 'out_of_order_sequence');
const gap = events.ingestEvent(ev(3, 'e3'));
assert.deepEqual(gap.gap, {expectedSeq: 2, receivedSeq: 3});
assert.equal(events.ingestEvent(ev(5, 'strict-gap'), {requireContiguous: true}).reason,
  'sequence_gap');
events.ingestEvent(ev(4, 'e4'));
events.ingestEvent(ev(5, 'e5'));
assert.deepEqual(events.eventsFor(stream).map((item) => item.event_id), ['e3', 'e4', 'e5']);
assert.deepEqual(events.streamCursor(stream), {lastSeq: 5, size: 3, lastEventId: 'e5'});
events.ingestEvent({kernel_id: 'kernel:b', run_id: 'run-2', seq: 1,
  event_id: 'b1', kind: 'TOOL_CALL'});
events.ingestEvent({kernel_id: 'kernel:c', run_id: 'run-3', seq: 1,
  event_id: 'c1', kind: 'TOOL_CALL'});
assert.equal(events.stats().eventStreams, 2);
assert.ok(events.stats().events <= 4);

// Global projection renders kernels, never every persona. Exact priority keeps a
// running kernel; overflow is represented by aggregate counts under the hard cap.
now = 100_000;
const graph = new NetworkStore({now: clock});
for (let k = 0; k < 5; k++) {
  for (let p = 0; p < 6; p++) {
    graph.upsertEntity({kernel_id: `kernel:${k}`, kind: 'persona',
      did: `did:personaos:kernel:${k}/persona/p${p}`, persona_id: `p${p}`,
      name: `persona ${k}/${p}`});
  }
  graph.upsertPresence({kernel_id: `kernel:${k}`, kind: 'persona', persona_id: 'p0',
    seq: 1, state: k === 4 ? 'running_llm' : 'idle'});
}
const globalProjection = graph.projectGraph({level: 'global', maxExactNodes: 2,
  maxAggregateNodes: 1, maxNodes: 3});
assert.equal(globalProjection.nodes.length, 3);
assert.equal(globalProjection.exactNodes.length, 2);
assert.equal(globalProjection.aggregateNodes.length, 1);
assert.equal(globalProjection.totals.candidates, 5);
assert.equal(globalProjection.totals.exact + globalProjection.totals.aggregated, 5);
assert.ok(globalProjection.exactNodes.some((node) => node.kernelId === 'kernel:4'
  && node.status === 'running'));

// Environment projection is capped, preserves selected/running personas, and
// accounts for every omitted persona through aggregate nodes.
for (let p = 0; p < 20; p++) {
  graph.upsertEntity({kernel_id: 'kernel:focus', kind: 'persona', persona_id: `focus-p${p}`,
    environment_id: 'env:focus', name: `focus ${p}`});
}
const selectedKey = networkEntityKey('kernel:focus', 'persona', 'focus-p19');
graph.upsertPresence({kernel_id: 'kernel:focus', kind: 'persona', persona_id: 'focus-p18',
  environment_id: 'env:focus', seq: 1, state: 'running_llm'});
const environmentProjection = graph.projectGraph({level: 'environment',
  kernelId: 'kernel:focus', environmentId: 'env:focus', selectedKeys: [selectedKey],
  maxExactNodes: 4, maxAggregateNodes: 2, maxNodes: 6});
assert.ok(environmentProjection.nodes.length <= 6);
assert.ok(environmentProjection.exactNodes.some((node) => node.key === selectedKey));
assert.ok(environmentProjection.exactNodes.some((node) => node.identity === 'focus-p18'));
assert.equal(environmentProjection.totals.candidates, 20);
assert.equal(environmentProjection.totals.exact + environmentProjection.totals.aggregated, 20);
assert.equal(environmentProjection.totals.hidden, 0);

// Persona drill-down can add active internal execution units and returns only
// explicit containment edges (never inferred persona-message edges).
graph.upsertEntity({kernel_id: 'kernel:focus', kind: 'model_call', unit_id: 'call:1',
  persona_id: 'focus-p19', environment_id: 'env:focus', state: 'running'});
graph.upsertPresence({kernel_id: 'kernel:focus', kind: 'model_call', unit_id: 'call:1',
  persona_id: 'focus-p19', environment_id: 'env:focus', seq: 1, state: 'running'});
const personaProjection = graph.projectGraph({level: 'persona', kernelId: 'kernel:focus',
  personaId: 'focus-p19', maxExactNodes: 8, maxAggregateNodes: 2});
assert.ok(personaProjection.exactNodes.some((node) => node.kind === 'persona'));
assert.ok(personaProjection.exactNodes.some((node) => node.kind === 'model_call'));
assert.deepEqual(personaProjection.edges.map((edge) => edge.kind), ['contains']);

// Node-wide telemetry is admitted by producer order/freshness, never by the
// time an HTTP/SSE replay happens to reach the browser.
now = 200_000;
const telemetry = new TelemetryAdmissionGate({now: clock, maxAgeMs: 30_000,
  futureSkewMs: 5_000, maxSources: 2});
assert.equal(telemetry.admit('https://a.example', {
  generated_at_ms: now - 1_000, sequence: 7,
}).accepted, true);
assert.equal(telemetry.admit('https://a.example', {
  generated_at_ms: now, sequence: 7,
}).reason, 'duplicate_sequence');
assert.equal(telemetry.admit('https://a.example', {
  generated_at_ms: now, sequence: 6,
}).reason, 'out_of_order_sequence');
assert.equal(telemetry.admit('https://a.example', {
  generated_at_ms: now - 30_001, sequence: 8,
}).reason, 'stale_frame');
assert.equal(telemetry.admit('https://a.example', {
  generated_at_ms: now + 5_001, sequence: 8,
}).reason, 'future_frame');
assert.equal(telemetry.admit('https://a.example', {
  generated_at_ms: now, sequence: 8,
}).accepted, true);
assert.equal(telemetry.admit('https://b.example', {
  generated_at_ms: now, stream_epoch: 'boot-b-1', sequence: 10,
}).accepted, true);
assert.equal(telemetry.admit('https://b.example', {
  generated_at_ms: now + 1, stream_epoch: 'boot-b-2', sequence: 1,
}).accepted, true, 'an explicit producer epoch change may reset sequence');
assert.equal(telemetry.admit('https://c.example', {
  generated_at_ms: now + 2, sequence: 1,
}).accepted, true);
assert.equal(telemetry.cursor('https://a.example'), null,
  'telemetry cursors must retain a hard source ceiling');

// End-to-end admission regression: two kernels may publish the same local
// persona id, and a replay from one kernel must neither resurrect its old
// running state nor overwrite the other kernel's independently running row.
now = 300_000;
const federatedPresence = new NetworkStore({now: clock});
const federatedGate = new TelemetryAdmissionGate({now: clock, maxAgeMs: 30_000});
const ingestTelemetryPresence = (source, frame) => {
  const decision = federatedGate.admit(source, frame);
  if (!decision.accepted) return decision;
  federatedPresence.upsertPresence({
    kernel_id: frame.kernel_id,
    kind: 'persona',
    persona_id: shared,
    seq: frame.sequence,
    observed_at_ms: decision.observedAt,
    state: frame.state,
  });
  return decision;
};
assert.equal(ingestTelemetryPresence('node-a', {
  kernel_id: 'kernel:a', generated_at_ms: now - 3_000, sequence: 10, state: 'running_llm',
}).accepted, true);
assert.equal(ingestTelemetryPresence('node-b', {
  kernel_id: 'kernel:b', generated_at_ms: now - 2_000, sequence: 4, state: 'running_llm',
}).accepted, true);
assert.equal(ingestTelemetryPresence('node-a', {
  kernel_id: 'kernel:a', generated_at_ms: now - 1_000, sequence: 11, state: 'idle',
}).accepted, true);
assert.equal(ingestTelemetryPresence('node-a', {
  kernel_id: 'kernel:a', generated_at_ms: now, sequence: 10, state: 'running_llm',
}).reason, 'out_of_order_sequence');
assert.equal(ingestTelemetryPresence('node-a', {
  kernel_id: 'kernel:a', generated_at_ms: now - 30_001, sequence: 12, state: 'running_llm',
}).reason, 'stale_frame');
assert.equal(federatedPresence.presenceStatus(aKey).effective_state, 'idle');
assert.equal(federatedPresence.presenceStatus(bKey).effective_state, 'running_llm');

console.log('network store/lease/sequence/projection contract: ok');
