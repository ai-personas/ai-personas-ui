import assert from 'node:assert/strict';
import test from 'node:test';
import { readMemoryGraph } from '../src/memoryGraph.ts';
import { owner, first, second, card, conditional, page as graphPage } from './memory-graph.fixture.mjs';
const request = { owner, focus: '', after: 0, query: '' };
const page = () => graphPage({ items: [card(first, 'Method'), card(second, 'Other method')] });
const connected = (change = {}) => {
  const p = page(); p.connections = [conditional(p.items[0], p.items[1], change)];
  return p;
};
const rejects = p => assert.throws(() => readMemoryGraph(p, request), /supported memory-graph\/1 contract/);
test('authored applicability and limits survive the card projection', () => {
  const p = page(); p.items[0].applicability = 'Only for identical source versions'; p.items[0].limitations = 'Check rounding separately';
  const result = readMemoryGraph(p, request).items[0];
  assert.equal(result.applicability, p.items[0].applicability); assert.equal(result.limitations, p.items[0].limitations);
});
test('absent or null qualification text stays empty rather than invented', () => {
  const p = page(); p.items[0].applicability = null; p.items[0].limitations = null;
  const result = readMemoryGraph(p, request).items;
  for (const item of result) { assert.equal(item.applicability, ''); assert.equal(item.limitations, ''); }
});
test('non-text applicability and limitations are explicit errors', () => {
  for (const field of ['applicability', 'limitations']) { const p = page(); p.items[0][field] = { instruction: 'not text' }; rejects(p); }
});
test('zero node and fragment revisions are not exact persisted versions', () => {
  for (const field of ['node', 'fragment']) { const p = page(); p.items[0][field].revision = 0; rejects(p); }
});
test('zero received-evidence revisions cannot appear in conditions', () => {
  rejects(connected({ condition: { kind: 'received', reference: { id: first, revision: 0 } } }));
});
test('semantic situation limits count UTF-8 bytes rather than UTF-16 units', () => {
  rejects(connected({ condition: { kind: 'semantic', situation: 'é'.repeat(513) } }));
});
test('connection explanation limits count UTF-8 bytes', () => {
  rejects(connected({ explanation: 'é'.repeat(1025) }));
});
test('valid multilingual text at exact byte limits is preserved', () => {
  const p = connected({ explanation: 'é'.repeat(1024), condition: { kind: 'semantic', situation: 'é'.repeat(512) } });
  assert.deepEqual(readMemoryGraph(p, request).connections[0], p.connections[0]);
});
test('compound conditions retain exact positive evidence revisions', () => {
  const condition = { kind: 'all', conditions: [{ kind: 'received', reference: { id: first, revision: 1 } }, { kind: 'sender', id: owner }] };
  assert.deepEqual(readMemoryGraph(connected({ condition }), request).connections[0].condition, condition);
});
test('existing expiry validation is preserved', () => {
  rejects(connected({ expires: 'not a date' }));
});
