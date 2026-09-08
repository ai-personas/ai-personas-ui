// Exercise the production lifecycle selection over already verified records.
// A retained work note can still describe an earlier task after a new run starts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import {disabledPublicEvidenceDependencies} from './helpers/public-evidence.mjs';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const {environmentIdentity} = await import(pathToFileURL(resolve(assetRoot, 'routing-authority.mjs')));
const start = source.indexOf('function _taskLifecycleRecordOrder(');
const end = source.indexOf('// face notes are for humans:', start);
assert.ok(start >= 0 && end > start);

function projection({active = [], bound = false, model = null, acts = [], includeCurrent = true} = {}) {
  const earlier = {taskId: 'task:earlier', run: 'run-01EARLIER', environment: 'env:room',
    state: 'budget_exhausted', currentExecution: false};
  const current = {taskId: 'task:current', run: 'run-02CURRENT', environment: 'env:room',
    state: 'running', currentExecution: true};
  const lifecycles = [earlier, ...(includeCurrent ? [current] : [])];
  const S = {order: lifecycles.map(row => row.run),
    recs: new Map(lifecycles.map(lifecycle => [lifecycle.run,
      {_kernel: 'kernel', record_id: `rec:public:task:${lifecycle.run}`, lifecycle}]))};
  const values = {...disabledPublicEvidenceDependencies(), S, environmentIdentity,
    publicTaskLifecycleProjection: record => record.lifecycle,
    _activeModelCallsForPersona: () => active,
    _verifiedPublicTaskForRun: (kernel, run) => kernel === 'kernel'
      ? lifecycles.find(row => row.run === run) : null,
    _verifiedPublicTaskRun: (kernel, task) => kernel === 'kernel'
      ? lifecycles.find(row => row.taskId === task)?.run || '' : '',
    _eventPersonaKey: (event, persona) => `${event._kernel}:${persona}`,
  };
  const select = new Function(...Object.keys(values), source.slice(start, end)
    + '\nreturn _personaMechanicalRunProjection;')(...Object.values(values));
  return select(model, 'kernel', acts, 'kernel:alice', {
    schema: 'personaos-persona-work-state-surface/5',
    task_id: earlier.taskId, environment_id: earlier.environment,
    bound_to_latest_observation: bound,
  });
}

for (const model of [
  {run: 'run-02CURRENT', task: 'task:current'},
  {task: 'task:current'},
]) {
  test(`a retained earlier note does not replace the latest call's ${model.run ? 'run' : 'task'}`, () => {
    const result = projection({model});
    assert.equal(result.key, 'running');
    assert.equal(result.exactState, 'running');
    assert.equal(result.source, 'signed task lifecycle');
  });
}

test('the latest task-scoped activity outranks an unbound earlier note', () => {
  const result = projection({acts: [{actor_kind: 'persona', actor_id: 'alice',
    _kernel: 'kernel', _provenance: {task: 'task:current'}}]});
  assert.equal(result.key, 'running');
  assert.equal(result.exactState, 'running');
});

test('another persona or kernel cannot change the selected task', () => {
  for (const event of [
    {actor_kind: 'persona', actor_id: 'bob', _kernel: 'kernel'},
    {actor_kind: 'persona', actor_id: 'alice', _kernel: 'other-kernel'},
  ]) {
    const result = projection({acts: [{...event, _provenance: {task: 'task:current'}}]});
    assert.equal(result.key, 'resource-paused');
    assert.equal(result.exactState, 'budget_exhausted');
  }
});

test('a work state still bound to the latest observation keeps its exact task', () => {
  const result = projection({bound: true, model: {run: 'run-02CURRENT'}});
  assert.equal(result.key, 'resource-paused');
  assert.equal(result.exactState, 'budget_exhausted');
});

test('a current active call takes precedence even over a bound note', () => {
  const result = projection({bound: true, active: [{run_id: 'run-02CURRENT'}]});
  assert.equal(result.key, 'running');
  assert.equal(result.source, 'active model call');
});

test('a missing current lifecycle does not invent a running state', () => {
  const result = projection({includeCurrent: false, model: {run: 'run-02CURRENT'}});
  assert.equal(result.key, 'resource-paused');
  assert.equal(result.exactState, 'budget_exhausted');
});
