import test from 'node:test';
import assert from 'node:assert/strict';
import { WORK_TABS, fields, text, count, recordIDs, activityText, workFacts, assessmentFacts,
  ownership, stateTone, assumptionNote, matchesRecords, matchesWork, matchesAllowance } from '../src/workspace.ts';
import { inputRequestCount } from '../src/workspace.ts';
const id = n => n.toString(16).padStart(32, '0');
const record = (kind, data = {}) => ({ id: id(1), kind, scope: id(2), revision: 1, created: '', updated: '', data });

test('only unanswered requests need user input, not waiting runs or answered requests', () => {
  assert.equal(inputRequestCount(record('request', { status: 'open' })), 1);
  for (const status of ['answered', 'resolved', 'cancelled']) assert.equal(inputRequestCount(record('request', { status })), 0);
  assert.equal(inputRequestCount(record('run', { status: 'waiting' })), 0);
  assert.equal(inputRequestCount(record('work', { pending_requests: 3, input_requests: 0 })), 0);
  for (const kind of ['work', 'persona', 'environment', 'run']) assert.equal(inputRequestCount(record(kind, { input_requests: 2 })), 2);
});
test('attention refreshes across work and request scopes', () => {
  for (const kind of ['request', 'response', 'work', 'run', 'invitation']) {
    assert.equal(matchesRecords({ kind, data: { scope: id(42) } }, 'environment', id(2)), true);
    assert.equal(matchesRecords({ kind, data: { owner: id(42) } }, 'persona', '', id(2)), true);
  }
});

test('actual Rust charge events refresh only the matching allowance', () => {
  for (const kind of ['resource_charge', 'budget_charge']) {
    const event = { kind, entity: id(9), data: { scope: id(2), owner: '', revision: 2, status: 'consumed' } };
    assert.equal(matchesAllowance(event, id(2)), true);
    assert.equal(matchesAllowance(event, id(3)), false);
    assert.equal(matchesWork(event, id(4)), true);
  }
  assert.equal(matchesAllowance({ kind: 'resource_root', entity: id(2), data: { scope: '' } }, id(2)), true);
  assert.equal(matchesAllowance({ kind: 'run', entity: id(9), data: { scope: id(2) } }, id(2)), false);
});
test('latest call and current work projections refresh from their dependencies', () => {
  assert.equal(matchesRecords({ kind: 'call', entity: id(9), data: { scope: id(8) } }, 'run', id(2), id(3)), true);
  for (const kind of ['commitment', 'work_mandate', 'work_feedback', 'work_release', 'agreement']) {
    const event = { kind, entity: id(9), data: { scope: id(2), owner: id(3) } };
    assert.equal(matchesRecords(event, 'work'), true);
    assert.equal(matchesWork(event, id(2)), true);
    assert.equal(matchesWork(event, id(4)), false);
  }
});

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

// Completion display follows the runtime projection, never local review counts.
test('work status uses exact runtime outcome evidence and release applicability', () => {
  const work = { data: { core: { binding: 'adopted', coverage: { outcomes: [
    { required: true, evidence: 'current' }, { required: true, evidence: 'conditional' },
    { required: false, evidence: 'user_accepted' },
  ] }, acceptance: { disposition: 'accepted', applicability: 'stale' } } } };
  assert.equal(workFacts(work).coverage, '1/2 required outcomes have current evidence');
  assert.equal(workFacts(work).acceptance, 'accepted · stale release');
  work.data.core.acceptance.applicability = 'unknown';
  assert.equal(workFacts(work).acceptance, 'Not established');
});
