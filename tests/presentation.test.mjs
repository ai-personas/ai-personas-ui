import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, VIEW_META, WORK_FILTERS, matchesWorkFilter } from '../src/presentation.ts';

test('canonical navigation keeps Tools first-class and Network advanced', () => {
  assert.deepEqual(PAGES, ['Work', 'Personas', 'Environments', 'Learning', 'Tools']);
  assert.equal(VIEW_META.Network.kind, 'transfer');
  assert.equal(PAGES.includes('Network'), false);
});
test('every destination explains its empty state without inserting fixture records', () => {
  for (const view of [...PAGES, 'Network']) {
    assert.ok(VIEW_META[view].kind);
    assert.ok(VIEW_META[view].emptyTitle.length > 10);
    assert.ok(VIEW_META[view].emptyBody.length > 40);
  }
  assert.equal(VIEW_META.Learning.create, undefined);
  assert.equal(VIEW_META.Tools.create, undefined);
});
test('work filters never claim accepted or completed work', () => {
  assert.deepEqual(WORK_FILTERS.map(x => x.value), ['all', 'active', 'needs-input', 'archived']);
  assert.equal(matchesWorkFilter({ assessments: { accepted: 4 }, submissions: 4 }, 'active'), false);
  assert.equal(matchesWorkFilter({ status: 'accepted' }, 'active'), false);
  assert.equal(matchesWorkFilter({ activity: { completed: 2 } }, 'active'), false);
});
test('archived work is retained separately from current work and activity', () => {
  const archived = { status: 'archived', activity: { running: 1 }, pending_requests: 1 };
  for (const filter of ['all', 'active', 'needs-input']) assert.equal(matchesWorkFilter(archived, filter), false);
  assert.equal(matchesWorkFilter(archived, 'archived'), true);
  assert.equal(matchesWorkFilter({ status: 'waiting' }, 'archived'), false);
});
test('active requires an explicit positive running count', () => {
  assert.equal(matchesWorkFilter({ activity: { running: 1, paused: 2 } }, 'active'), true);
  for (const running of [0, -1, '1', true, null, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(matchesWorkFilter({ activity: { running } }, 'active'), false);
  }
});
test('needs input requires an explicit positive unresolved request count', () => {
  assert.equal(matchesWorkFilter({ pending_requests: 1 }, 'needs-input'), true);
  for (const pending_requests of [0, -1, '2', false, undefined, 0.5, Infinity]) {
    assert.equal(matchesWorkFilter({ pending_requests }, 'needs-input'), false);
  }
});
test('missing or malformed records do not acquire activity or decision claims', () => {
  for (const value of [null, undefined, [], 'active', 1, { activity: [] }]) {
    assert.equal(matchesWorkFilter(value, 'active'), false);
    assert.equal(matchesWorkFilter(value, 'needs-input'), false);
    assert.equal(matchesWorkFilter(value, 'all'), true);
  }
});
