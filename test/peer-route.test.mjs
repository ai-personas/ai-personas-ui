import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedPeerRouteBase, providerRouteBase, sameRouteOrigin } from '../assets/peer-route.mjs';
import { selectVerifiedPublicTaskRunTargets } from '../assets/network-view.mjs';

test('a signed peer can be addressed without a published web server', () => {
  assert.equal(providerRouteBase({base_url: '', provider_peer_id: '12D3KooWAbC'}), 'libp2p://12D3KooWAbC');
  assert.equal(providerRouteBase({base_url: 'http://127.0.0.1:8765', provider_peer_id: '12D3KooWAbC'}), 'libp2p://12D3KooWAbC');
  assert.equal(providerRouteBase({base_url: 'https://node.example', provider_peer_id: '12D3KooWAbC'}), 'https://node.example');
});

test('opaque URL origins cannot mix records from two peers', () => {
  const first = new URL('libp2p://12D3KooWAbC/telemetry/personas/member.json');
  const second = new URL('libp2p://12D3KooWDef');
  assert.equal(first.origin, second.origin);
  assert.equal(sameRouteOrigin(first, second), false);
  assert.equal(sameRouteOrigin(first, new URL('libp2p://12D3KooWAbC')), true);
});

test('peer addresses reject credentials, query, fragments and path impersonation', () => {
  for (const value of ['libp2p://user@peer', 'libp2p://peer?x=1', 'libp2p://peer#x',
    'libp2p://peer/path', 'libp2p://peer:80', 'javascript:alert(1)', 'http://node.example'])
    assert.equal(normalizedPeerRouteBase(value), '', value);
});

test('live artifact polling follows an exact peer inventory and rejects stale or foreign authority', () => {
  const base = 'libp2p://12D3KooWAbC', kernel = 'kernel:fixture', run = 'run-fixture';
  const record = {
    kind: 'task', visibility_tier: 'public', label: 'Produce the current file',
    did: `did:personaos:fixture/task/${run}`, _kernel: kernel, _storeKey: 'task-record',
    _doc: {record_signature_verified: true, policy_signature_verified: true},
    _inventorySource: kernel, _inventoryGeneration: 1, _inventoryHash: 'current',
    _taskLifecycleVerified: true,
    task_lifecycle: {schema: 'personaos-public-task-lifecycle/2', kernel_id: kernel,
      run_id: run, task_id: 'task:fixture', environment_id: 'env:fixture',
      current_execution: true, state: 'running', continued_from_run: '',
      amended_from_run: '', resumed_from_run: '', root_run_id: run,
      revision: `sha256:${'a'.repeat(64)}`},
  };
  const inventory = {base, recordKeys: new Set(['task-record']), generation: 1,
    hash: 'current', generatedAt: 100, expiresAt: 300};
  const inventories = new Map([[kernel, inventory]]);
  const boots = new Map([[base, {kernel_id: kernel}]]);
  const select = () => selectVerifiedPublicTaskRunTargets([record], inventories, boots, {nowMs: 200});
  assert.deepEqual(select(), [{base, run, kernel, recordKey: 'task-record'}]);
  inventory.expiresAt = 150;
  assert.deepEqual(select(), []);
  inventory.expiresAt = 300;
  boots.set(base, {kernel_id: 'kernel:another'});
  assert.deepEqual(select(), []);
  boots.set(base, {kernel_id: kernel});
  record._inventoryHash = 'stale';
  assert.deepEqual(select(), []);
});
