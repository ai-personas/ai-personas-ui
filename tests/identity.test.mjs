import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAITS, displayValue, profileChanges, recordID, revisionAttribution,
  timestamp, traitNumber, traitPosition, traitReading, traitSegments, validateRevisionPage,
} from '../src/identity.ts';

const id = 'a'.repeat(32), operation = 'b'.repeat(32), evidence = 'c'.repeat(32);
const openness = TRAITS.find(trait => trait.key === 'openness');
const valence = TRAITS.find(trait => trait.key === 'valence');
const revision = (number, data = {}, persona = id) => ({ id: persona, kind: 'persona', scope: '', revision: number,
  created: '2026-01-01T00:00:00Z', updated: `2026-01-${String(number).padStart(2, '0')}T00:00:00Z`, data });

test('all five OCEAN and all three VAD dimensions have explicit canonical scales', () => {
  assert.equal(TRAITS.filter(t => t.group === 'ocean' && t.min === 0 && t.max === 1).length, 5);
  assert.equal(TRAITS.filter(t => t.group === 'vad' && t.min === -1 && t.max === 1).length, 3);
});
for (const missing of [undefined, null, {}, { ocean: {} }, { ocean: { openness: null } }]) {
  test(`missing traits are not fabricated: ${JSON.stringify(missing)}`, () => {
    assert.equal(traitReading(missing, openness).state, 'missing');
  });
}
for (const value of [0, 0.0000001, 0.5, 1]) {
  test(`OCEAN retains authored value ${value}`, () => assert.deepEqual(traitReading({ ocean: { openness: value } }, openness), { state: 'authored', value }));
}
for (const value of [-1, -0.25, 0, 1]) {
  test(`VAD retains signed authored value ${value}`, () => assert.deepEqual(traitReading({ vad: { valence: value } }, valence), { state: 'authored', value }));
}
for (const value of [-0.01, 1.01, '0.5', NaN, Infinity, false, []]) {
  test(`invalid OCEAN is visible, never coerced: ${String(value)}`, () => assert.equal(traitReading({ ocean: { openness: value } }, openness).state, 'invalid'));
}
test('meter position uses the scale without relabeling a value as a percentage', () => {
  assert.equal(traitPosition(-1, valence), 0); assert.equal(traitPosition(0, valence), 50);
  assert.equal(traitPosition(1, valence), 100); assert.equal(traitNumber(-0), '0');
  assert.equal(traitNumber(0.0000001), '1e-7');
});
test('zero and negative values survive historical comparisons', () => {
  const changes = profileChanges(revision(1, { ocean: { openness: 0 }, vad: { valence: -1 } }), revision(2, { ocean: { openness: 0.4 }, vad: { valence: 0 } }));
  assert.deepEqual(changes.map(c => [c.field, c.before, c.after]), [['ocean.openness', 0, 0.4], ['vad.valence', -1, 0]]);
});
test('identity history includes character, attributes, model and lifecycle changes', () => {
  const before = revision(1, { character: 'A', attributes: { interest: 'a' }, model: 'a', lifecycle: 'created' });
  const after = revision(2, { character: 'B', attributes: { interest: 'b' }, model: 'b', lifecycle: 'active' });
  assert.deepEqual(profileChanges(before, after).map(c => c.field), ['character', 'attributes', 'model', 'lifecycle']);
});
test('attribute key order does not invent a change', () => assert.equal(profileChanges(revision(1, { attributes: { a: 1, b: 2 } }), revision(2, { attributes: { b: 2, a: 1 } })).length, 0));
test('private carried context, selections and source payloads never become profile changes', () => {
  assert.deepEqual(profileChanges(revision(1, { context: 'private one' }), revision(2, { context: 'private two', selected: [evidence], information_sources: [evidence] })), []);
});
test('removal remains different from zero and null is not an authored number', () => {
  const changes = profileChanges(revision(1, { ocean: { openness: 0 } }), revision(2, { ocean: { openness: null } }));
  assert.equal(changes[0].before, 0); assert.equal(displayValue(changes[0].after), 'Not authored');
  assert.equal(displayValue(''), 'Cleared / empty');
});
test('exact revision attribution retains the operation, explanation and evidence version', () => {
  const record = revision(2, { profile_revision: { revision: 2, actor: id, operation, source: operation, reason: 'Observed outcome', evidence: [{ id: evidence, revision: 7 }] } });
  assert.deepEqual(revisionAttribution(record).evidence, [{ id: evidence, revision: 7 }]);
  assert.equal(revisionAttribution(record).recorded, true);
  assert.equal(revisionAttribution(record).reason, 'Observed outcome');
});
test('an inherited stamp never misattributes later lifecycle or model revisions', () => {
  assert.equal(revisionAttribution(revision(3, { profile_revision: { revision: 2, actor: id, operation, reason: 'Earlier explanation' } })).recorded, false);
});
test('unattributed fields do not establish revision authorship', () => {
  assert.deepEqual(revisionAttribution(revision(1, { reason: 'Unattributed explanation', evidence: [evidence] })), { recorded: false, evidence: [] });
});
test('invalid actors and invalid action identities do not become attribution', () => {
  assert.equal(revisionAttribution(revision(2, { profile_revision: { revision: 2, actor: evidence, operation } })).recorded, false);
  assert.equal(revisionAttribution(revision(2, { profile_revision: { revision: 2, actor: id, operation: '/api/private' } })).recorded, false);
});
test('invalid evidence versions are not silently treated as current versions', () => {
  const record = revision(2, { profile_revision: { revision: 2, actor: id, operation, evidence: [{ id: evidence }, { id: evidence, revision: -1 }, { id: evidence, revision: 2.5 }] } });
  assert.deepEqual(revisionAttribution(record).evidence, []);
});
test('valid cursor pages preserve all snapshots, including incomplete traits', () => {
  const items = [revision(1), revision(2, { ocean: { openness: 0 } })];
  assert.deepEqual(validateRevisionPage({ items, next: 50 }, id, 0), { items, next: 50 });
  assert.equal(validateRevisionPage({ items: [], next: null }, id, 50).next, null);
});
for (const next of [0, -1, 1.5, '2', undefined]) {
  test(`invalid continuation cursor ${String(next)} is rejected`, () => assert.throws(() => validateRevisionPage({ items: [revision(1)], next }, id, 0)));
}
test('wrong-persona or out-of-order revisions are rejected before display', () => {
  assert.throws(() => validateRevisionPage({ items: [revision(1, {}, evidence)], next: null }, id, 0));
  assert.throws(() => validateRevisionPage({ items: [revision(2), revision(1)], next: null }, id, 0));
  assert.throws(() => validateRevisionPage({ items: [revision(1), revision(1)], next: null }, id, 0));
});
test('history transport bounds and non-progressing empty pages are enforced', () => {
  assert.throws(() => validateRevisionPage({ items: Array.from({ length: 101 }, (_, i) => revision(i + 1)), next: null }, id, 0));
  assert.throws(() => validateRevisionPage({ items: [], next: 10 }, id, 0));
});
test('charts break at missing traits, invalid values and missing revisions', () => {
  const records = [revision(1, { ocean: { openness: 0 } }), revision(2, { ocean: { openness: 1 } }), revision(3), revision(4, { ocean: { openness: 0.4 } }), revision(6, { ocean: { openness: 0.6 } }), revision(7, { ocean: { openness: 3 } })];
  assert.deepEqual(traitSegments(records, openness).map(segment => segment.map(point => point.record.revision)), [[1, 2], [4], [6]]);
});
test('input snapshots are not mutated during projection', () => {
  const items = [revision(1, { ocean: { openness: 0 } }), revision(2, { ocean: { openness: 1 } })];
  const original = structuredClone(items); profileChanges(items[0], items[1]); traitSegments(items, openness);
  assert.deepEqual(items, original);
});
test('invalid dates and identity references are labeled without invented timestamps', () => {
  assert.equal(timestamp('not-a-date'), 'Invalid recorded time'); assert.equal(timestamp(null), 'Time not recorded');
  assert.equal(recordID(id), true); assert.equal(recordID('../private'), false);
});
