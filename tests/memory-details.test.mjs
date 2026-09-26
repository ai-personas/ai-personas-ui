import assert from 'node:assert/strict';
import test from 'node:test';
import { currentRead, readMemoryDetail, readMemoryUtility, readMemoryUsage } from '../src/memoryDetails.ts';
const owner = 'a'.repeat(32), id = 'b'.repeat(32), node = 'c'.repeat(32), foreign = 'f'.repeat(32);
const expected = { id, revision: 3, owner, kind: 'fragment' };
const fragment = () => ({ id, revision: 3, kind: 'fragment', scope: owner,
  data: { owner, status: 'retained', draft: { content: 'PRIVATE_FRAGMENT_TEXT' } } });
const nodeExpected = { id: node, revision: 5, owner, kind: 'memory_node', fragment: { id, revision: 3 } };
const memoryNode = () => ({ id: node, revision: 5, kind: 'memory_node', data: { owner, status: 'retained',
  fragment: { id, revision: 3 }, locator: { description: 'My retrieval utility', script: 'PRIVATE_UTILITY_CODE',
    parameters: [{ name: 'query', description: 'Search words' }] } } });
const usage = () => ({ selected_participations: 1, admitted_calls: 2, recent_calls: ['d'.repeat(32)] });
const rejected = (read, value, request) => assert.throws(() => read(value, request), error => {
  for (const hidden of [foreign, 'PRIVATE_FRAGMENT_TEXT', 'PRIVATE_UTILITY_CODE']) assert(!error.message.includes(hidden));
  return true;
});

test('exact owned retained fragment preserves its original authored record', () => {
  const value = fragment(); assert.equal(readMemoryDetail(value, expected), value);
});
for (const version of [0, 1, 2, 4, -1, 3.5, '3', null, Number.MAX_SAFE_INTEGER + 1]) {
  test(`fragment revision ${version} cannot replace the graph card's exact revision`, () => {
    rejected(readMemoryDetail, { ...fragment(), revision: version }, expected);
  });
}
for (const [name, mutate] of [
  ['wrong record', r => { r.id = foreign; }],
  ['wrong kind', r => { r.kind = 'document'; }],
  ['wrong owner', r => { r.data.owner = foreign; }],
  ['missing owner despite matching scope', r => { delete r.data.owner; }],
  ['retired', r => { r.data.status = 'retired'; }],
  ['missing status', r => { delete r.data.status; }],
  ['erased', r => { r.data.erased = true; }],
  ['discredited', r => { r.data.discredited = true; }],
]) {
  test(`${name} is rejected without echoing untrusted content`, () => {
    const r = fragment(); mutate(r); rejected(readMemoryDetail, r, expected);
  });
}
for (const value of [undefined, null, [], 'text', 4, {}, { data: [] }, { data: null }]) {
  test(`malformed memory detail ${JSON.stringify(value)} fails closed`, () => rejected(readMemoryDetail, value, expected));
}

test('invalid expected identities and revisions cannot weaken matching', () => {
  for (const request of [{ ...expected, id: '' }, { ...expected, owner: 'owner' }, { ...expected, revision: 0 }, { ...expected, revision: 3.5 }]) {
    rejected(readMemoryDetail, fragment(), request);
  }
});
test('utility binds the exact node AND fragment and keeps code as text', () => {
  assert.deepEqual(readMemoryUtility(memoryNode(), nodeExpected), memoryNode().data.locator);
});
test('a changed node cannot supply another utility revision', () => {
  rejected(readMemoryUtility, { ...memoryNode(), revision: 6 }, nodeExpected);
});
test('a changed fragment binding cannot silently inherit the utility card', () => {
  for (const binding of [{ id: foreign, revision: 3 }, { id, revision: 4 }, null, {}]) {
    const r = memoryNode(); r.data.fragment = binding; rejected(readMemoryUtility, r, nodeExpected);
  }
});
test('utility requires an explicit expected fragment binding', () => {
  rejected(readMemoryUtility, memoryNode(), { ...nodeExpected, fragment: undefined });
});
test('removed or malformed utility does not fabricate an empty successful reader', () => {
  for (const locator of [null, {}, { description: {}, script: 'x', parameters: [] },
    { description: 'x', script: {}, parameters: [] }, { description: 'x', script: 'x', parameters: {} },
    { description: 'x', script: 'x', parameters: [{ name: {}, description: 'x' }] }]) {
    const r = memoryNode(); r.data.locator = locator; rejected(readMemoryUtility, r, nodeExpected);
  }
});
test('loading with a previously valid value withholds content and does not decode', () => {
  let decoded = false;
  assert.deepEqual(currentRead({ value: fragment(), error: '', loading: true }, () => { decoded = true; }), { error: '', loading: true });
  assert.equal(decoded, false);
});
test('failed refresh cannot redisplay the previous valid value', () => {
  assert.deepEqual(currentRead({ value: fragment(), error: 'Access revoked', loading: false }, v => readMemoryDetail(v, expected)),
    { error: 'Access revoked', loading: false });
});
test('a newer version is a repairable display error, not silently selected text', () => {
  const state = currentRead({ value: { ...fragment(), revision: 4 }, error: '', loading: false }, v => readMemoryDetail(v, expected));
  assert.equal(state.value, undefined); assert.equal(state.loading, false); assert.match(state.error, /Refresh the graph/);
});
test('a successful revalidation restores the exact valid content', () => {
  const value = fragment();
  assert.deepEqual(currentRead({ value, error: '', loading: false }, v => readMemoryDetail(v, expected)), { value, error: '', loading: false });
});
test('missing response stays loading rather than inventing empty memory', () => {
  assert.deepEqual(currentRead({ error: '', loading: false }, v => v), { error: '', loading: true });
});
test('valid usage and genuine zero counts are preserved', () => {
  assert.deepEqual(readMemoryUsage(usage()), usage());
  assert.deepEqual(readMemoryUsage({ selected_participations: 0, admitted_calls: 0, recent_calls: [] }),
    { selected_participations: 0, admitted_calls: 0, recent_calls: [] });
});
for (const invalid of [undefined, null, -1, 0.5, '2', Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid usage count ${invalid} cannot become measured evidence`, () => {
    for (const key of ['selected_participations', 'admitted_calls']) assert.throws(() => readMemoryUsage({ ...usage(), [key]: invalid }));
  });
}
test('missing, malformed, duplicate, excessive or inconsistent inclusion references are rejected', () => {
  for (const calls of [undefined, null, 'call', [{}], ['not-an-id'], ['d'.repeat(32), 'd'.repeat(32)],
    Array.from({ length: 13 }, (_, i) => i.toString(16).padStart(32, '0'))]) {
    assert.throws(() => readMemoryUsage({ ...usage(), recent_calls: calls }));
  }
  assert.throws(() => readMemoryUsage({ ...usage(), admitted_calls: 0 }));
});
test('usage refresh and failure withhold an earlier count instead of presenting it as current', () => {
  for (const state of [{ value: usage(), error: '', loading: true }, { value: usage(), error: 'Unavailable', loading: false }]) {
    assert.equal(currentRead(state, readMemoryUsage).value, undefined);
  }
});
