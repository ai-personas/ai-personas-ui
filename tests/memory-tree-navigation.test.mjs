import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryForest, memoryTreeRows, selectedMemoryTreeRow, memoryTreeTypeahead } from '../src/memoryTree.ts';

const card = (id, title) => ({ node: { id, revision: 1 }, title });
const edge = (source, target) => ({ source: source.node, target: target.node, origin: 'authored_related' });
const a = card('a', 'Field notes'), b = card('b', 'Review release');
const c = card('c', 'Check representations'), d = card('d', 'Compare exports');
const forest = memoryForest({ items: [a, b, c, d], connections: [edge(b, c), edge(c, d)] });
const all = memoryTreeRows(forest), selected = all.at(-1).key;

test('hidden selection stays with the nearest visible ancestor, not the first root', () => {
  const visible = memoryTreeRows(forest, new Set([all[2].key]));
  assert.equal(selectedMemoryTreeRow(visible, selected).card, c);
  const folded = memoryTreeRows(forest, new Set([b.node.id]));
  assert.equal(selectedMemoryTreeRow(folded, selected).card, b);
  assert.equal(selectedMemoryTreeRow(all, selected).card, d);
});

test('missing selections and empty graphs have predictable fallbacks', () => {
  assert.equal(selectedMemoryTreeRow(all, 'missing'), all[0]);
  assert.equal(selectedMemoryTreeRow([], selected), undefined);
  assert.equal(selectedMemoryTreeRow(all, b.node.id), all[1]);
});

test('ancestor lookup respects path boundaries', () => {
  const rows = [{ ...all[0], key: 'unrelated' }, { ...all[1], key: 'branch' }];
  assert.equal(selectedMemoryTreeRow(rows, 'branch-other/child'), rows[0]);
  assert.equal(selectedMemoryTreeRow(rows, 'branch/child'), rows[1]);
});

test('shared and cycle references retain their own selected path', () => {
  const rows = memoryTreeRows(memoryForest({ items: [a, b, c], connections: [edge(a, b), edge(a, c), edge(b, c), edge(c, a)] }));
  for (const reference of rows.filter(row => row.reference)) {
    assert.equal(selectedMemoryTreeRow(rows, reference.key), reference);
  }
});

test('repeated letters cycle and wrap through visible title matches', () => {
  assert.equal(memoryTreeTypeahead(all, all[2].key, 'c').card, d);
  assert.equal(memoryTreeTypeahead(all, all[3].key, 'cc').card, c);
  assert.equal(memoryTreeTypeahead(all, all[2].key, 'CCC').card, d);
});

test('extending a prefix keeps a current match before looking further', () => {
  const items = [card('a', 'Compare exports'), card('b', 'Compile constraints'), card('c', 'Check representations')];
  const rows = memoryTreeRows(memoryForest({ items, connections: [] }));
  assert.equal(memoryTreeTypeahead(rows, 'a', 'co').card, items[0]);
  assert.equal(memoryTreeTypeahead(rows, 'a', 'compi').card, items[1]);
  assert.equal(memoryTreeTypeahead(rows, 'b', 'che').card, items[2]);
});

test('typeahead only searches visible entries and handles no match', () => {
  const visible = memoryTreeRows(forest, new Set([b.node.id]));
  assert.equal(memoryTreeTypeahead(visible, a.node.id, 'c'), undefined);
  assert.equal(memoryTreeTypeahead(all, '', 'co').card, d);
  assert.equal(memoryTreeTypeahead(all, selected, 'not found'), undefined);
  assert.equal(memoryTreeTypeahead(all, selected, ''), undefined);
  assert.equal(memoryTreeTypeahead(all, selected, '   '), undefined);
  assert.equal(memoryTreeTypeahead([], '', 'c'), undefined);
});

test('typeahead uses the same fallback title as the rendered tree', () => {
  const rows = memoryTreeRows(memoryForest({ items: [card('a', 'Notes'), card('b', '')], connections: [] }));
  assert.equal(memoryTreeTypeahead(rows, 'a', 'r'), rows[1]);
});
