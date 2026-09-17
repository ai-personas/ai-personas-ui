import test from 'node:test';
import assert from 'node:assert/strict';
import { WORK_TABS, fields, text, count, recordIDs, activityText, workFacts, assessmentFacts,
  ownership, stateTone, assumptionNote, matchesRecords } from '../src/workspace.ts';
const id = n => n.toString(16).padStart(32, '0');
const record = (kind, data = {}) => ({ id: id(1), kind, scope: id(2), revision: 1, created: '', updated: '', data });

test('six work views are independent from domain or a profession roster', () => {
  assert.equal(WORK_TABS.length, 6);
  assert.ok(WORK_TABS.includes('Perspectives'));
  assert.ok(WORK_TABS.includes('Artifacts & evidence'));
});
for (const value of [null, undefined, [], 'text', 12]) test(`malformed data is not rendered as a record: ${JSON.stringify(value)}`, () => assert.deepEqual(fields(value), {}));
test('only plain display text and nonnegative integer counts qualify', () => {
  assert.equal(text({ title: 'bad' }, 'absent'), 'absent');
  for (const v of [-1, 1.5, NaN, Infinity, '3', null]) assert.equal(count(v), undefined);
  assert.equal(count(0), 0);
});
test('links use actual Rust record IDs only', () => assert.deepEqual(recordIDs([id(1), 'javascript:alert(1)', '../private', 3]), [id(1)]));
test('work activity and historic accepted verdicts never establish current acceptance', () => {
  const f = workFacts(record('work', { activity: { running: 2 }, assessments: { accepted: 10 }, submissions: 3 }));
  assert.equal(f.activity, '2 running'); assert.equal(f.submissions, 3);
  assert.equal(f.acceptance, 'Not established'); assert.equal(f.coverage, 'Not established');
});
test('missing totals stay unknown rather than becoming zero or unlimited', () => {
  assert.equal(workFacts(record('work')).submissions, undefined);
  assert.equal(workFacts(record('work')).pendingRequests, undefined);
});
test('invalid activity values cannot masquerade as progress', () => assert.equal(activityText({ running: 'many', accepted: -1 }), 'No activity reported'));
test('old accepted finding has unverifiable applicability when scope binding is absent', () => {
  const r = record('finding', { verdict: 'accepted', submission: id(4) });
  const facts = assessmentFacts(r);
  assert.equal(facts.verdict, 'accepted'); assert.equal(facts.applicability, 'unverifiable');
  assert.equal(r.data.verdict, 'accepted');
});
test('staleness does not erase historical verdict', () => {
  const r = record('assessment', { verdict: 'accepted', applicability: 'stale' });
  assert.deepEqual([assessmentFacts(r).verdict, assessmentFacts(r).applicability], ['accepted', 'stale']);
});
for (const state of ['', 'latest', 'passed', true, {}]) test(`unknown applicability is never current: ${JSON.stringify(state)}`, () => assert.equal(assessmentFacts(record('finding', { applicability: state })).applicability, 'unverifiable'));
test('offered responsibility does not become an accepted owner', () => {
  const o = ownership(record('commitment', { status: 'offered', owner: id(3), offered_to: id(4) }));
  assert.match(o.label, /acceptance not established/); assert.equal(o.id, id(4));
});
test('accepted responsibility can show the recorded owner without inventing one', () => {
  assert.equal(ownership(record('commitment', { status: 'working', owner: id(3) })).id, id(3));
  assert.equal(ownership(record('commitment', { status: 'accepted' })).label, 'Owner not recorded');
});
test('accepted alone never means a green success badge', () => assert.equal(stateTone('accepted'), 'neutral'));
test('authorized exploration remains conditional', () => assert.match(assumptionNote('authorized_for_exploration'), /not confirmation/));
test('scoped invalidation ignores unrelated work when scope is known', () => {
  assert.equal(matchesRecords({ kind: 'commitment', data: { scope: id(7) } }, 'commitment', id(2)), false);
  assert.equal(matchesRecords({ kind: 'commitment', data: { scope: id(2) } }, 'commitment', id(2)), true);
});
test('old events without scope invalidate conservatively', () => assert.equal(matchesRecords({ kind: 'commitment' }, 'commitment', id(2)), true));
test('work activity refreshes on dependent record changes', () => assert.equal(matchesRecords({ kind: 'finding', data: { scope: id(2) } }, 'work'), true));
test('unrelated event kinds do not refresh the current list', () => assert.equal(matchesRecords({ kind: 'call' }, 'fragment'), false));
test('owner-specific lists do not refresh for known other owners', () => assert.equal(matchesRecords({ kind: 'fragment', data: { owner: id(4) } }, 'fragment', '', id(3)), false));
