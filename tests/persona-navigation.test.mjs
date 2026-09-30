import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryForest, memoryTreeRows, connectionLabel } from '../src/memoryTree.ts';
import { rememberPersona, RECENT_PERSONA_LIMIT } from '../src/recentPersonas.ts';

const id = n => n.toString(16).padStart(32, '0');
const card = n => ({ node: { id: id(n), revision: 1 }, fragment: { id: id(n + 100), revision: 1 }, title: `Fragment ${n}`, short_description: '', applicability: '', limitations: '', full_context: { status: 'available', fragments: 1 } });
const edge = (source, target, extra = {}) => ({ source: source.node, target: target.node, origin: 'authored_related', mode: 'preview_only', applicability: 'not_evaluated', ...extra });
const graph = (items, connections = [], focus_card = null) => ({ items, connections, focus_card, next: null });
const a = card(1), b = card(2), c = card(3), d = card(4);
const rows = value => memoryTreeRows(memoryForest(value));

test('empty and disconnected fragments remain a forest without a synthetic root', () => {
  assert.deepEqual(memoryForest(graph([])), []);
  assert.deepEqual(memoryForest(graph([b, a])).map(x => x.card.node.id), [b.node.id, a.node.id]);
  assert(rows(graph([a, b])).every(row => row.level === 1 && row.size === 2));
});
test('outgoing authored connections produce branches, preserving relation and wire order', () => {
  const connection = edge(a, b, { origin: 'authored_condition', relation: 'prerequisite', mode: 'full' });
  const result = rows(graph([b, a, c], [connection, edge(a, c)]));
  assert.deepEqual(result.map(x => x.card.title), [a.title, b.title, c.title]);
  assert.deepEqual(result.map(x => x.level), [1, 2, 2]);
  assert.equal(result[1].connection, connection);
  assert.equal(connectionLabel(connection), 'Prerequisite');
  assert.equal(connectionLabel(edge(a, b)), 'Association');
  assert.equal(connectionLabel(), 'Browsing anchor');
});
test('a focused fragment is only a browsing anchor, even with incoming connections', () => {
  const result = memoryForest(graph([a, c], [edge(a, b), edge(b, c)], b));
  assert.equal(result[0].card, b);
  assert.equal(result[1].children[0].reference, 'shared');
});
test('cycles terminate with explicit links rather than duplicated subtrees', () => {
  const result = rows(graph([a, b], [edge(a, b), edge(b, a)]));
  assert.equal(result.length, 3);
  assert.equal(result[2].reference, 'cycle');
  assert.deepEqual(result[2].children, []);
});
test('a conditional self-link remains visible and finite', () => {
  const result = rows(graph([a], [edge(a, a, { origin: 'authored_condition', relation: 'association' })]));
  assert.equal(result.length, 2);
  assert.equal(result[1].reference, 'cycle');
});
test('diamond graphs show shared references without exponentially expanding paths', () => {
  const result = rows(graph([a, b, c, d], [edge(a, b), edge(a, c), edge(b, d), edge(c, d)]));
  assert.equal(result.filter(x => !x.reference).length, 4);
  assert.equal(result.filter(x => x.reference === 'shared').length, 1);
  assert.equal(new Set(result.map(x => x.key)).size, result.length);
});
test('parallel authored association and condition preserve both connections', () => {
  const result = rows(graph([a, b], [edge(a, b), edge(a, b, { origin: 'authored_condition', relation: 'correction' })]));
  assert.equal(result.filter(x => x.connection).length, 2);
  assert.equal(result.at(-1).reference, 'shared');
  assert.notEqual(result[1].key, result[2].key);
});
test('unavailable and revision-mismatched endpoints never create rows or links', () => {
  const result = rows(graph([a, b], [edge(a, c), edge(c, b), { ...edge(a, b), target: { ...b.node, revision: 2 } }]));
  assert.equal(result.length, 2);
  assert(result.every(x => !x.connection));
});
test('collapse preserves sibling metadata and source graph; expansion restores rows', () => {
  const value = graph([a, b, c], [edge(a, b), edge(a, c)]);
  const before = JSON.stringify(value), forest = memoryForest(value);
  assert.equal(memoryTreeRows(forest, new Set([forest[0].key])).length, 1);
  const expanded = memoryTreeRows(forest);
  assert.deepEqual(expanded.slice(1).map(x => [x.position, x.size, x.parent]), [[1, 2, forest[0].key], [2, 2, forest[0].key]]);
  assert.equal(JSON.stringify(value), before);
});
test('dense cyclic graph stays bounded by nodes plus connections', () => {
  const items = Array.from({ length: 13 }, (_, i) => card(i + 1));
  const connections = items.flatMap(source => items.filter(target => target !== source).map(target => edge(source, target)));
  const result = rows(graph(items, connections));
  assert.equal(result.filter(row => !row.reference).length, items.length);
  assert.equal(result.filter(row => row.connection).length, connections.length);
  assert(result.length <= items.length + connections.length);
});
test('recent IDs are newest first, deduplicated, bounded, and do not mutate input', () => {
  const previous = [id(2), id(1)];
  assert.deepEqual(rememberPersona(previous, id(1)), [id(1), id(2)]);
  assert.deepEqual(previous, [id(2), id(1)]);
  let recent = [];
  for (let n = 1; n <= 20; n++) recent = rememberPersona(recent, id(n));
  assert.equal(recent.length, RECENT_PERSONA_LIMIT);
  assert.deepEqual(recent, [20, 19, 18, 17, 16, 15].map(id));
});
test('invalid recent IDs cannot become request paths', () => {
  const previous = [id(1)];
  for (const value of ['', '../session', 'persona-name', 'f'.repeat(31), 'g'.repeat(32)]) {
    assert.deepEqual(rememberPersona(previous, value), previous);
  }
});
