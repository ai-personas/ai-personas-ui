// Exercise the renderer's real lifecycle and membership selection after
// cryptographic admission, including a public node with no aggregate feed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const {environmentIdentity} = await import(pathToFileURL(resolve(assetRoot, 'routing-authority.mjs')));
const {publicTaskLifecycleProjection} = await import(pathToFileURL(resolve(assetRoot, 'network-view.mjs')));
function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, start);
  return source.slice(first, last);
}

function record(run, state, environment = 'env:room', kernel = 'node') {
  return {record_id: `rec:public:task:${run}`, kind: 'task', _kernel: kernel,
    did: `did:personaos:fixture/task/${run}`, label: 'Continue the current work',
    _taskLifecycleVerified: true,
    capability_summary: [`task_run:${run}`, `task_environment:${environment}`, `task_state:${state}`],
    task_lifecycle: {schema: 'personaos-public-task-lifecycle/2', kernel_id: kernel,
      run_id: run, task_id: `task:${run}`, environment_id: environment,
      state, current_execution: state === 'running', continued_from_run: '',
      amended_from_run: '', resumed_from_run: '', root_run_id: run,
      revision: `sha256:${'a'.repeat(64)}`}};
}

function taskSelector(records) {
  const S = {order: records.map(row => row.record_id),
    recs: new Map(records.map(row => [row.record_id, row]))};
  return new Function('S', 'environmentIdentity', 'publicTaskLifecycleProjection',
    section('function _taskLifecycleRecordOrder(', 'function _latestTaskLifecycle(')
    + section('function _pkTaskFacts(', '// Tool-kind discovery records')
    + '\nreturn _pkTaskFacts;')(S, environmentIdentity, publicTaskLifecycleProjection);
}

test('the workspace uses the newest lifecycle regardless of discovery order', () => {
  const old = record('run-01old', 'budget_exhausted'), current = record('run-02new', 'running');
  for (const records of [[old, current], [current, old]]) {
    const select = taskSelector(records);
    assert.equal(select('node', 'env:room', '').state, 'running');
    assert.equal(select('node', 'env:room', 'run-01old').state, 'budget_exhausted');
    assert.equal(select('node', 'env:room', 'run-02new').state, 'running');
  }
});

test('an exact run never falls back to an unrelated task in the same workspace', () => {
  const select = taskSelector([record('run-01old', 'budget_exhausted')]);
  assert.equal(select('node', 'env:room', 'run-missing'), null);
  assert.equal(select('node', 'env:elsewhere', 'run-01old'), null);
  assert.equal(select('other-node', 'env:room', ''), null);
});

test('unverified lifecycle data and capability-only claims do not choose workspace state', () => {
  const old = record('run-01old', 'budget_exhausted');
  const forged = record('run-99forged', 'running');
  forged._taskLifecycleVerified = false;
  assert.equal(taskSelector([forged, old])('node', 'env:room', '').state, 'budget_exhausted');
  delete old.task_lifecycle;
  assert.equal(taskSelector([old])('node', 'env:room', ''), null);
});

test('the latest revision of the same run wins over a retained exhausted revision', () => {
  const old = record('run-same', 'budget_exhausted'), current = record('run-same', 'running');
  old.record_id = 'rec:01ARZ3NDEKTSV4RRFFQ69G5FAV';
  current.record_id = 'rec:01ARZ3NDEKTSV4RRFFQ69G5FAW';
  assert.equal(taskSelector([current, old])('node', 'env:room', 'run-same').state, 'running');
});

test('a live task with a stable public record id outranks the archived predecessor', () => {
  const old = record('run-01M1Y7D6TDZQDZHGQ00VP301AE', 'budget_exhausted');
  old.record_id = 'rec:01M1YCXQ6XKBQTYN3K2GE865NM';
  const current = record('run-01M1YGKDAHYCVEBM81QNFC7058', 'running');
  current.task_lifecycle.amended_from_run = old.task_lifecycle.run_id;
  current.task_lifecycle.root_run_id = old.task_lifecycle.run_id;
  for (const records of [[old, current], [current, old]]) {
    assert.equal(taskSelector(records)('node', 'env:room', '').run,
      current.task_lifecycle.run_id);
  }
});

test('republishing an earlier run does not make it the latest workspace task', () => {
  const old = record('run-01M1Y7D6TDZQDZHGQ00VP301AE', 'budget_exhausted');
  old.record_id = 'rec:01M1ZZZZZZKBQTYN3K2GE865NM';
  const current = record('run-01M1YGKDAHYCVEBM81QNFC7058', 'operator_terminated');
  current.record_id = 'rec:01M1YHKDAHKBQTYN3K2GE865NM';
  assert.equal(taskSelector([current, old])('node', 'env:room', '').run,
    current.task_lifecycle.run_id);
});

function observedMembers({live = [], cognition = [], admitted = []} = {}) {
  const S = {liveByPersona: new Map(live), verifiedPublicCognitionByPersona: new Map(cognition),
    ixByPersona: new Map()};
  const block = {members: []}, bySid = new Map([['node/room', block]]), assigned = new Set();
  const values = {S, bySid, assigned,
    _shortId: value => String(value || '').replace(/^env:/, ''),
    _personaRef: key => ({kernel: key.split('/')[0], sid: key.split('/')[1]}),
    envKey: (kernel, sid) => `${kernel}/${sid}`,
    providerVerifiedPersonaObservation: key => admitted.includes(key),
  };
  new Function(...Object.keys(values),
    section('const PUBLIC_COGNITION_SCHEMAS=', 'function _rememberVerifiedPublicCognition(')
    + section('function _personaModelHistory(', 'function _refreshPersonaInteractionIndex(')
    + section('  // Redacted environment feeds', '  S.envCount=envBlocks.length;'))(...Object.values(values));
  return {block, assigned};
}

function cognitionRow(key, environment = 'env:room') {
  return [key, {doc: {schema: 'personaos-persona-public-cognition/3', tier: 'public',
    recent_calls: [{model_id: 'model', environment_id: environment,
      started_at: '2026-09-07T18:00:00Z', ended_at: '2026-09-07T18:00:09Z'}]}}];
}

test('all four participants appear from signed cognition without aggregate telemetry', () => {
  const admitted = ['node/alice', 'node/bob', 'node/carol', 'node/dan'];
  const {block, assigned} = observedMembers({admitted, cognition: admitted.map(key => cognitionRow(key))});
  assert.deepEqual(block.members, admitted);
  assert.deepEqual([...assigned], admitted);
});

test('cognition updates the environment and cannot duplicate a live participant', () => {
  const key = 'node/alice';
  const {block} = observedMembers({admitted: [key], cognition: [cognitionRow(key)],
    live: [[key, {kernel: 'node', models: [{environment: 'older-room'}]}]]});
  assert.deepEqual(block.members, [key]);
});

test('unverified personas and a same-name workspace on another node stay separate', () => {
  const {block} = observedMembers({admitted: ['other/alice'],
    cognition: [cognitionRow('other/alice'), cognitionRow('node/unsigned')]});
  assert.deepEqual(block.members, []);
});
