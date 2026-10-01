import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, VIEW_META, WORK_FILTERS, matchesWorkFilter, readNavigation, navigationHash, finishingView } from '../src/presentation.ts';

test('canonical navigation keeps Tools first-class and Network advanced', () => {
  assert.deepEqual(PAGES, ['Work', 'Personas', 'Environments', 'Learning', 'Tools']);
  assert.equal(VIEW_META.Network.kind, 'transfer');
  assert.equal(PAGES.includes('Network'), false);
  for (const page of [...PAGES, 'Network', 'Funding']) assert.equal(readNavigation(navigationHash({page})).page, page);
  const route = {page:'Work',work:'a'.repeat(32),tab:'Artifacts & evidence',record:'b'.repeat(32),artifact:'c'.repeat(32)};
  assert.deepEqual(readNavigation(navigationHash(route)), route);
  assert.equal(navigationHash({...route,token:'never-in-url',command:'run.resume'}), navigationHash(route));
  for (const hash of ['', '#main-content', '#/unknown', '#/work?' + 'x'.repeat(1024)]) assert.deepEqual(readNavigation(hash), {page:'Work'});
  for (const query of ['work=../../private', 'work=javascript:alert(1)', 'work='+route.work+'&work='+route.work]) assert.equal(readNavigation('#/work?'+query).work, undefined);
  assert.equal(readNavigation('#/personas?work='+route.work).work, undefined);
  assert.equal(readNavigation('#/work?tab=Perspectives').tab, undefined);
  assert.equal(readNavigation('#/work?work='+route.work+'&tab=Unknown').tab, undefined);
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
  const archived = { status: 'archived', activity: { running: 1 }, input_requests: 1 };
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
test('needs input requires an explicit positive unanswered request count', () => {
  assert.equal(matchesWorkFilter({ input_requests: 1 }, 'needs-input'), true);
  assert.equal(matchesWorkFilter({ pending_requests: 5, input_requests: 0 }, 'needs-input'), false);
  for (const input_requests of [0, -1, '2', false, undefined, 0.5, Infinity]) {
    assert.equal(matchesWorkFilter({ input_requests }, 'needs-input'), false);
  }
});
test('missing or malformed records do not acquire activity or decision claims', () => {
  for (const value of [null, undefined, [], 'active', 1, { activity: [] }]) {
    assert.equal(matchesWorkFilter(value, 'active'), false);
    assert.equal(matchesWorkFilter(value, 'needs-input'), false);
    assert.equal(matchesWorkFilter(value, 'all'), true);
  }
});

test('finishing prerequisites keep missing consent, execution and retained billing independent', () => {
  const value = { schema: 'finishing-readiness/1', read_only: true, preauthorized: true, responsibility: null,
    billing_only_calls: 1, unresolved_charge_records: 2, unresolved_actions: 1,
    blockers: [{code:'RESOURCE_RESPONSIBILITY_REQUIRED',detail:'No current accepted responsibility.'}, {code:'RESOURCE_UNCERTAIN',detail:'Unresolved execution.'}] };
  const view = finishingView(value);
  assert.equal(view.preauthorized, true);
  assert.equal(view.responsibility, null);
  assert.equal(view.billingOnly, 1);
  assert.equal(view.unresolvedCharges, 2);
  assert.equal(view.unresolvedActions, 1);
  assert.deepEqual(view.blockers.map(b => b.code), ['RESOURCE_RESPONSIBILITY_REQUIRED', 'RESOURCE_UNCERTAIN']);
  assert.equal(finishingView({...value, responsibility:{id:'a'.repeat(32),revision:2}}).responsibility, 'a'.repeat(32));
  for (const n of [undefined, null, -1, 0.5, '0', NaN, Infinity]) {
    assert.equal(finishingView({...value,billing_only_calls:n}).billingOnly, null);
  }
  for (const malformed of [null, {}, {...value,read_only:false}, {...value,schema:'other'}]) assert.equal(finishingView(malformed), null);
  const unavailable = finishingView({schema:value.schema,read_only:true,error:'Evidence unavailable'});
  assert.equal(unavailable.preauthorized, null);
  assert.equal(unavailable.blockers, null);
  assert.equal(unavailable.billingOnly, null);
});
