import assert from 'node:assert/strict';
import test from 'node:test';
import { memoryGraphPath, readMemoryGraph } from '../src/memoryGraph.ts';
import { owner, first, second, later, card, edge, conditional, page } from './memory-graph.fixture.mjs';
const a = card(first, 'Check representations'), b = card(second, 'Compare exports');
const request = (extra = {}) => ({ owner, focus: '', after: 0, query: '', ...extra });
const focused = () => page({ focus: a, items: [b], connections: [edge(a, b)] });
const reject = (value, req = request()) => assert.throws(() => readMemoryGraph(value, req), /supported memory-graph\/1 contract/);

test('navigation requests the focused graph neighborhood', () => {
  const url = new URL(memoryGraphPath(request({ focus: first, after: 12 })), 'http://localhost');
  assert.equal(url.pathname, `/personas/${owner}/memory`);
  assert.equal(url.searchParams.get('focus'), first);
  assert.equal(url.searchParams.get('after'), '12');
  assert.equal(url.searchParams.get('limit'), '12');
});
test('search text is encoded as data, not additional query parameters', () => {
  const query = 'révision & focus=unexpected # +';
  const url = new URL(memoryGraphPath(request({ query })), 'http://localhost');
  assert.equal(url.searchParams.get('query'), query);
  assert.equal(url.searchParams.has('focus'), false);
  assert.equal(url.hash, '');
});
test('a rootless all-owned page has no focused card', () => {
  const raw = page({ items: [a] });
  assert.deepEqual(readMemoryGraph(raw, request()).items.map(c => c.node), [a.node]);
  assert.equal(readMemoryGraph(raw, request()).focus_card, null);
});
test('the focused card carries its exact node version', () => {
  const result = readMemoryGraph(focused(), request({ focus: first }));
  assert.equal(result.focus_card.title, a.title);
  assert.deepEqual(result.focus_card.node, a.node);
  assert.equal(result.connections[0].mode, 'preview_only');
});
test('cycles are displayed once per direction without recursion', () => {
  const raw = page({ focus: a, items: [b], connections: [edge(a, b), edge(b, a)] });
  assert.equal(readMemoryGraph(raw, request({ focus: first })).connections.length, 2);
});
test('authored conditions and required corrections survive display projection', () => {
  const raw = focused(); raw.connections.push(conditional(a, b));
  const before = structuredClone(raw);
  const result = readMemoryGraph(raw, request({ focus: first }));
  assert.deepEqual(raw, before);
  assert.deepEqual(result.connections, raw.connections);
  // Association and qualification share endpoints without one erasing the other.
  assert.equal(result.connections.length, 2);
});
test('wrong owner is rejected without echoing the foreign identity', () => {
  const raw = page({ items: [a] }); raw.owner = later;
  assert.throws(() => readMemoryGraph(raw, request()), error => !error.message.includes(later));
});
test('an ignored focus request cannot masquerade as its neighborhood', () => reject(page({ items: [a] }), request({ focus: first })));
test('stale cursor and search snapshots are rejected', () => {
  reject(page({ items: [a] }), request({ after: 12 }));
  reject(page({ items: [a], query: 'old' }), request({ query: 'new' }));
});
test('tree and unknown graph schemas are not silently interpreted', () => {
  for (const schema of ['memory-tree/1', 'memory-graph/2', undefined]) reject({ ...page(), schema });
});
test('focus must have an exact card at the same revision', () => {
  for (const focus_card of [null, undefined, b, card(first, a.title, 2)]) reject({ ...focused(), focus_card }, request({ focus: first }));
});
test('an all-owned page cannot carry a hidden focus', () => {
  reject({ ...page(), focus: a.node });
  reject({ ...page(), focus_card: a });
});
test('duplicate cards, including duplication of the focus, are rejected', () => {
  reject(page({ items: [a, a] }));
  reject(page({ focus: a, items: [a] }), request({ focus: first }));
});
test('off-page or unavailable endpoints are rejected without revealing them', () => {
  const raw = page({ items: [a], connections: [edge(a, b)] });
  assert.throws(() => readMemoryGraph(raw, request()), error => !error.message.includes(second));
});
test('connection versions must equal the visible node versions', () => {
  const raw = focused(); raw.connections[0] = { ...raw.connections[0], target: { id: second, revision: 2 } };
  reject(raw, request({ focus: first }));
});
test('duplicate directed connections and self-edges are rejected', () => {
  reject(page({ items: [a, b], connections: [edge(a, b), edge(a, b)] }));
  reject(page({ items: [a], connections: [edge(a, a)] }));
});
test('browsing cannot claim applicability or full inclusion from a plain association', () => {
  for (const change of [{ origin: 'unknown' }, { mode: 'full' }, { applicability: 'match' }]) {
    const raw = focused(); Object.assign(raw.connections[0], change);
    reject(raw, request({ focus: first }));
  }
});
test('bounded compound conditions retain semantic unknowns without evaluating them', () => {
  const rule = { kind: 'all', conditions: [{ kind: 'work', id: later }, { kind: 'semantic', situation: 'Comparing exported results' }] };
  const raw = focused(); raw.connections = [conditional(a, b, { relation: 'association', mode: 'preview', condition: rule })];
  const [connection] = readMemoryGraph(raw, request({ focus: first })).connections;
  assert.deepEqual(connection.condition, rule);
  assert.equal(connection.applicability, 'not_evaluated');
  for (const condition of [{ kind: 'all', conditions: [rule] }, { kind: 'any', conditions: [] }, { kind: 'not', condition: rule }]) {
    raw.connections[0].condition = condition;
    reject(raw, request({ focus: first }));
  }
});
test('graph flags cannot silently enable full selection, roots, or grouping', () => {
  for (const field of ['automatic_selection', 'requires_root', 'requires_functional_groups']) reject({ ...page(), [field]: true });
});
test('malformed references and oversized pages are rejected', () => {
  for (const ref of [{ id: first, revision: -1 }, { id: first, revision: 1.5 }, { id: 'not-a-node', revision: 1 }]) {
    reject(page({ items: [{ ...a, node: ref }] }));
  }
  reject(page({ items: Array(13).fill(a) }));
});
test('malformed or missing graph arrays are explicit errors', () => {
  for (const field of ['items', 'connections']) reject({ ...page(), [field]: null });
  reject(null); reject([]);
});
test('pagination must progress and stay within the endpoint offset bound', () => {
  for (const next of [0, -1, 1.5, '12', 1_000_001]) reject(page({ next }));
  assert.equal(readMemoryGraph(page({ items: [a], next: 12 }), request()).next, 12);
  assert.equal(readMemoryGraph(page({ after: 12, items: [b] }), request({ after: 12 })).next, null);
});
