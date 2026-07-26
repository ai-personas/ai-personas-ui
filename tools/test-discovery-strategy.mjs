import assert from 'node:assert/strict';
import {
  LOCATOR_FALLBACK_COLD_GRACE_MS,
  LOCATOR_FALLBACK_PEER_PROBE_MAX_MS,
  LOCATOR_FALLBACK_RETRY_MS,
  locatorFallbackDecision,
  shouldPrefetchNodeStatus,
} from '../assets/discovery-strategy.mjs';
import {selectVerifiedPublicTaskRunTargets} from '../assets/network-view.mjs';

const start = 1_000_000;

assert.deepEqual(locatorFallbackDecision({
  locatorEnabled: false,
  nowMs: start,
  startedAtMs: start,
}), {
  queryLocator: false,
  mode: 'locator_disabled',
  nextCheckMs: 15000,
});

const warming = locatorFallbackDecision({
  nowMs: start + 1000,
  startedAtMs: start,
});
assert.equal(warming.queryLocator, false);
assert.equal(warming.mode, 'p2p_direct_warming');
assert.equal(warming.nextCheckMs, LOCATOR_FALLBACK_COLD_GRACE_MS - 1000);

const p2p = locatorFallbackDecision({
  nowMs: start + 60_000,
  startedAtMs: start,
  verifiedP2PRouteCount: 1,
});
assert.equal(p2p.queryLocator, false);
assert.equal(p2p.mode, 'p2p_direct_primary');

const direct = locatorFallbackDecision({
  nowMs: start + 60_000,
  startedAtMs: start,
  healthyDirectPeerCount: 2,
});
assert.equal(direct.queryLocator, false);
assert.equal(direct.mode, 'p2p_direct_primary');

const fallback = locatorFallbackDecision({
  nowMs: start + LOCATOR_FALLBACK_COLD_GRACE_MS,
  startedAtMs: start,
});
assert.equal(fallback.queryLocator, true);
assert.equal(fallback.mode, 'fallback_locator');
assert.equal(fallback.nextCheckMs, LOCATOR_FALLBACK_RETRY_MS);

const peerProbe = locatorFallbackDecision({
  nowMs: start + LOCATOR_FALLBACK_COLD_GRACE_MS + 1000,
  startedAtMs: start,
  peerProbeExpected: true,
  peerProbeComplete: false,
});
assert.equal(peerProbe.queryLocator, false);
assert.equal(peerProbe.mode, 'p2p_first_contact_in_progress');
assert.equal(peerProbe.nextCheckMs, 1000);

const exhaustedPeerProbe = locatorFallbackDecision({
  nowMs: start + LOCATOR_FALLBACK_PEER_PROBE_MAX_MS,
  startedAtMs: start,
  peerProbeExpected: true,
  peerProbeComplete: false,
});
assert.equal(exhaustedPeerProbe.queryLocator, true);

const failedPeerProbe = locatorFallbackDecision({
  nowMs: start + LOCATOR_FALLBACK_COLD_GRACE_MS + 1000,
  startedAtMs: start,
  peerProbeExpected: true,
  peerProbeComplete: true,
});
assert.equal(failedPeerProbe.queryLocator, true);

assert.equal(shouldPrefetchNodeStatus(), false);
assert.equal(shouldPrefetchNodeStatus({credentialed: true}), true);
assert.equal(shouldPrefetchNodeStatus({focused: true}), true);
assert.equal(shouldPrefetchNodeStatus({credentialed: false, focused: false}), false);

const kernel='kernel:test', base='https://node.example', hash='0'.repeat(64);
const taskRecord=(run,{state,current,terminal=''})=>({
  kind:'task',label:'Design a house',visibility_tier:'public',_kernel:kernel,
  _storeKey:run,_taskLifecycleVerified:true,
  _doc:{record_signature_verified:true,policy_signature_verified:true},
  did:`did:personaos:${kernel}/task/${run}`,
  _inventorySource:kernel,_inventoryGeneration:7,_inventoryHash:'inventory-hash',
  task_lifecycle:{schema:'personaos-public-task-lifecycle/2',kernel_id:kernel,
    run_id:run,task_id:'task:test',current_execution:current,environment_id:'env:test',
    continued_from_run:'',amended_from_run:'',resumed_from_run:'',root_run_id:run,
    state,revision:`sha256:${hash}`,terminal_reason:terminal},
});
const liveTask=taskRecord('run-live',{state:'running',current:true});
const terminalTask=taskRecord('run-old',{state:'operator_terminated',current:false,
  terminal:'operator_terminated'});
const inventory=new Map([[kernel,{recordKeys:new Set(['run-live','run-old']),
  generatedAt:start-1000,expiresAt:start+60000,generation:7,hash:'inventory-hash',base}]]);
const boots=new Map([[base,{kernel_id:kernel}]]);
assert.deepEqual(selectVerifiedPublicTaskRunTargets(
  [terminalTask,liveTask],inventory,boots,{nowMs:start}),
[{base,run:'run-live',kernel,recordKey:'run-live'}],
'automatic artifact polling must exclude signed terminal history');
assert.equal(selectVerifiedPublicTaskRunTargets(
  [terminalTask,liveTask],inventory,boots,{nowMs:start,includeHistorical:true}).length,2);

console.log('discovery strategy tests passed');
