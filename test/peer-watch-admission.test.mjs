import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const {selectMonitoringBases} = await import(pathToFileURL(resolve(assetRoot, 'network-view.mjs')));
const {normalizedPeerRouteBase} = await import(pathToFileURL(resolve(assetRoot, 'peer-route.mjs')));

function declaration(name) {
  const at = source.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name);
  const first = source.lastIndexOf('\n', at) + 1;
  const next = source.slice(first + 1).search(/\n(?:async )?function [\w$]+\(|\nconst [\w$]+\s*=/);
  const value = source.slice(first, next < 0 ? source.length : first + 1 + next);
  return value;
}
const sharedStart = source.indexOf('const _sharedDocJobs=');
const sharedEnd = source.indexOf('async function fetchJson(', sharedStart);
const shared = source.slice(sharedStart, sharedEnd);
const normalizers = ['isAbs', 'isHttp', 'join', 'opBaseKey'].map(name =>
  source.match(new RegExp('^const ' + name + '=.*$', 'm'))[0]).join('\n');
const limitStart = source.indexOf('const NETWORK_LIMITS=Object.freeze({');
const limitEnd = source.indexOf('\nconst NETWORK=', limitStart);
const limits = source.slice(limitStart, limitEnd);
const names = ['settleBeforeAbort', 'peerList', 'discover', '_providerInventoryIsCurrent',
  'recordStoreKey', '_personaLifecycleRegresses', 'retireProviderInventory',
  'applyVerifiedProviderInventory', '_registerP2PDataRoute', '_ensurePeerDiscoveryStream',
  'connectDiscoveryStream', 'rebalanceDiscoveryStreams', '_rememberP2PRouteHint',
  '_discoverFromP2P', '_reconcileP2PRouteHint'];
const code = [
  normalizers, limits, shared,
  'let _discoverBusy=false, _discoverQueued=false;',
  ...names.map(declaration),
  'return {reconcile:_reconcileP2PRouteHint,discover,peerList,rebalance:rebalanceDiscoveryStreams,',
  'register:_registerP2PDataRoute,connect:connectDiscoveryStream,guard:_peerInventoryReadGuard,',
  'retire:retireProviderInventory,jobs:_sharedDocJobs,limits:NETWORK_LIMITS,recordStoreKey};',
].join('\n');
const next = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
const count = (rows, kind) => rows.filter(row => row.kind === kind).length;

function fixture() {
  const plans = new Map(), events = [], reads = [], watches = [], timers = new Set();
  const evidenceSymbol = Symbol('synthetic-observation');
  let clock = 10_000, nextAttempt = 0, api;
  const S = {
    recs: new Map(), order: [], boots: new Map(), keys: new Map(),
    p2pDataRoutes: new Map(), p2pArtifactHashes: new Map(), providerRouteReconciliations: new Map(),
    streams: new Map(), providerInventories: new Map(), identityIndexes: new Map(),
    globalKernels: new Map(), globalAnnouncements: new Map(), peerHealth: new Map(),
    activeModelCallsByBase: new Map(), cachedIdentityPendingKernels: new Set(),
    gossipPeers: new Set(), portalPeers: new Set(), ipfsPeers: new Set(), globalPeers: new Set(),
    monitoringWindow: new Set(), kernelFocus: null,
  };
  const state = () => ({
    records: S.recs.size, inventories: S.providerInventories.size,
    remembered: [...S.gossipPeers], monitoring: [...S.monitoringWindow],
    activeReconciliations: S.providerRouteReconciliations.size,
    watches: [...S.streams.keys()], createdWatches: watches.length,
    closedWatches: watches.filter(watch => watch.closed).length,
  });
  const values = {
    S, MY_NODES: new Map(), location: new URL('https://ai-personas.github.io/'),
    URL, URLSearchParams, AbortController, AbortSignal, Promise, selectMonitoringBases,
    Date: {now: () => clock, parse: Date.parse},
    PROVIDER_HINT_LIMITS: {maxRouteHints: 64}, P2P_ROUTE_LIMITS: {jobDeadlineMs: 60_000},
    _publicEvidenceAttempt: evidenceSymbol,
    _publicEvidence: {
      begin(source, base) {
        const observation = {id: ++nextAttempt, source, base};
        events.push({kind: 'started', ...observation});
        return observation;
      },
      available(observation, value) {
        events.push({kind: 'available', id: observation.id, value: !!value,
          generation: value?.inventory_generation});
      },
      refuse(observation, reason) {
        events.push({kind: 'refused', id: observation?.id, reason});
      },
      admitted(observation, accepted, reason) {
        if (observation) events.push({kind: 'admitted', id: observation.id, accepted, reason});
      },
    },
    P2P: {
      async fetchPublicJson(provider, path) {
        const plan = plans.get(provider.host_kernel_id);
        assert.ok(plan, 'Only explicit synthetic routes may be read');
        reads.push({kernel: provider.host_kernel_id, path});
        if (path.endsWith('personaos-keys.json')) return {kernel_id: plan.hint.kernel};
        if (path.endsWith('personaos-discovery.json')) return plan.boot;
        assert.equal(path, plan.boot.providers_url);
        plan.bodyStarted = true;
        return plan.body ? plan.body.promise : plan.document;
      },
      watchPublicEvents(provider, options) {
        const done = deferred();
        const watch = {provider, options, closed: false, done: done.promise};
        watch.close = () => { watch.closed = true; done.resolve(); };
        watches.push(watch);
        return watch;
      },
    },
    admitKeysDocument: (_base, boot, keys, {expectedMaster}) => {
      assert.equal(keys.kernel_id, boot.kernel_id);
      assert.ok(expectedMaster);
      return {'kernel-master': expectedMaster};
    },
    async verifiedRowsFromProviderIndex(document, _base, boot, _plane, _where, options) {
      const plan = plans.get(boot.kernel_id);
      assert.equal(document, plan.document);
      plan.verificationStarted = true;
      events.push({kind: 'synthetic_verification_started', kernel: boot.kernel_id});
      if (plan.verification) await plan.verification.promise;
      if (plan.throwVerification) throw Error('synthetic verifier failure');
      const rows = plan.valid === false ? [] : [plan.row];
      return {rows, refused: plan.valid === false ? 1 : 0,
        inventory: {ok: plan.valid !== false, generation: plan.generation,
          hash: plan.hash, previousHash: plan.previousHash, manifestHash: 'manifest:' + plan.generation,
          recordIds: new Set(rows.map(row => row.record_id)), bindings: new Map(),
          generatedAt: 1, expiresAt: plan.expired ? clock - 1 : clock + 100_000,
          [evidenceSymbol]: options.publicEvidenceAttempt}};
    },
    upsert(row) {
      const id = api.recordStoreKey(row);
      S.recs.set(id, row);
      if (!S.order.includes(id)) S.order.push(id);
      events.push({kind: 'upsert', kernel: row._kernel, generation: row._inventoryGeneration});
      return true;
    },
    _removeRecordStoreKey(id) { S.recs.delete(id); S.order = S.order.filter(value => value !== id); return true; },
    persistOfflinePublicHistory() {}, retireFastSignedIdentityRoute() {},
    scheduleRealtimeRepaint() {}, updateP2PStatus() {}, collectP2PBootstraps() {},
    noteKernel() {}, _dropKernelDirectoryEntry() { return false; },
    _kernelDisplayContext: kernel => ({label: kernel}),
    tokenFor: () => '', log() {}, _schedulePeerInvalidation() {},
    loadTelemetry: async () => {},
    discoverViaIPFS: async () => {},
    resolveKernelBases: async () => [],
    classifyMap() {}, renderGlobalKernels() {}, updateVitalsCounters() {},
    refreshSystemView() {}, pollLiveArtifacts() {}, updateDiscoverySummary() {},
    $: () => ({innerHTML: '', textContent: ''}), queueMicrotask,
    fetch: async () => { throw Error('Network is forbidden in this offline fixture'); },
    setTimeout(fn, delay) { const timer = {fn, delay}; timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); },
  };
  api = new Function(...Object.keys(values), code)(...Object.values(values));
  function plan({name = 'new', stage = null, generation = 487, valid = true,
    expired = false, throwVerification = false} = {}) {
    // Use distinct alphanumeric synthetic IDs accepted by the production URL
    // normalizer. This fixture substitutes transport and makes no peer-key claim.
    const kernel = 'kernel:' + name, peerId = 'peer' + Buffer.from(name).toString('hex'),
      base = 'libp2p://' + peerId;
    assert.equal(normalizedPeerRouteBase(base), base);
    const hint = {base, kernel, peerId, providerRecord: {
      host_kernel_id: kernel, provider_peer_id: peerId,
      public_key_hex: 'master-' + name, inventory_generation: generation,
    }};
    const value = {hint, generation, valid, expired, throwVerification,
      hash: 'hash:' + generation, previousHash: 'hash:' + (generation - 1),
      boot: {kernel_id: kernel, record_count: 1, providers_url: 'discovery/public/providers.json'},
      document: {document_count: 1, inventory_generation: generation},
      row: {kind: 'task', _kernel: kernel, record_id: 'task:' + name, label: 'synthetic current task'},
      body: stage === 'body' ? deferred() : null,
      verification: stage === 'verification' ? deferred() : null,
      bodyStarted: false, verificationStarted: false,
    };
    plans.set(kernel, value);
    return value;
  }
  async function begin(plan, options) {
    const work = api.reconcile(plan.hint, options);
    await next();
    assert.equal(plan.bodyStarted, true);
    if (plan.verification) assert.equal(plan.verificationStarted, true);
    return {work, stream: S.streams.get('p2p:' + plan.hint.base),
      guard: api.guard(plan.hint.base), snapshot: state()};
  }
  function release(plan) {
    plan.body?.resolve(plan.document);
    plan.verification?.resolve();
  }
  function closeIdle() { api.peerList(); api.rebalance(); }
  return {...api, S, plans, plan, begin, release, state, events, reads, watches, timers,
    maintenance: () => api.discover({refreshGlobal: false}), closeIdle};
}
test('an unchanged route admits its first inventory before becoming a remembered peer', async () => {
  const h = fixture(), p = h.plan({stage: 'body'}), started = await h.begin(p);
  assert.deepEqual(h.peerList(), []);
  assert.equal(h.S.recs.size, 0);
  assert.equal(h.S.gossipPeers.size, 0);
  h.release(p);
  const result = await started.work;
  assert.equal(result.accepted, true);
  assert.deepEqual(h.peerList(), [p.hint.base]);
  h.rebalance();
  assert.equal(h.S.streams.get('p2p:' + p.hint.base), started.stream);
  assert.equal(h.S.providerRouteReconciliations.size, 0);
});

for (const stage of ['body', 'verification']) {
  test('ordinary discovery must preserve the first-admission watch during ' + stage, async () => {
    const h = fixture(), p = h.plan({stage}), started = await h.begin(p);
    const routeBefore = h.S.p2pDataRoutes.get(p.hint.base);
    assert.deepEqual(h.peerList(), [], 'Unadmitted P2P routes are not promoted into peerList');
    await h.maintenance();
    const beforeRelease = h.state(), currentAfterMaintenance = started.guard();
    assert.equal(h.S.p2pDataRoutes.get(p.hint.base), routeBefore, 'No authority or route mutation');
    assert.equal(h.S.recs.size, 0);
    assert.equal(h.S.gossipPeers.size, 0);
    h.release(p);
    const result = await started.work;
    assert.equal(result.accepted, true, 'Scheduling eviction must not discard a current first inventory');
    assert.equal(currentAfterMaintenance, true, 'The exact original watch remains current');
    assert.equal(beforeRelease.createdWatches, 1, 'Retention creates no extra watch');
    assert.equal(beforeRelease.closedWatches, 0);
    assert.equal(h.S.providerInventories.get(p.hint.kernel).generation, 487);
  });
}

for (const change of ['kernel', 'peer', 'master']) {
  for (const stage of ['body', 'verification']) {
    test(change + ' authority change still refuses a pending ' + stage, async () => {
      const h = fixture(), p = h.plan({stage}), started = await h.begin(p);
      const route = h.S.p2pDataRoutes.get(p.hint.base);
      const changed = {...route, providerRecord: {...route.providerRecord}};
      if (change === 'kernel') changed.kernel = 'kernel:other';
      if (change === 'peer') changed.peerId = 'peerOther';
      if (change === 'master') changed.providerRecord.public_key_hex = 'master-other';
      h.S.p2pDataRoutes.set(p.hint.base, changed);
      assert.equal(started.guard(), false);
      h.release(p);
      const result = await started.work;
      h.closeIdle();
      assert.equal(result.accepted, false);
      assert.equal(count(h.events, 'upsert'), 0);
      assert.equal(h.S.providerInventories.size, 0);
      assert.equal(h.S.streams.size, 0);
      assert.ok(h.events.some(event => event.reason === 'watch_retired'));
    });
  }
}

for (const stage of ['body', 'verification']) {
  test('explicit inventory retirement still refuses the pending ' + stage, async () => {
    const h = fixture(), p = h.plan({stage}), started = await h.begin(p);
    h.S.providerInventories.set(p.hint.kernel, {generation: 486, hash: 'hash:486', recordKeys: new Set()});
    h.retire(p.hint.kernel);
    assert.equal(started.guard(), false);
    assert.equal(h.S.p2pDataRoutes.has(p.hint.base), false);
    h.release(p);
    const result = await started.work;
    h.closeIdle();
    assert.equal(result.accepted, false);
    assert.equal(h.S.streams.size, 0);
    assert.equal(h.S.recs.size, 0);
    assert.equal(h.S.providerRouteReconciliations.size, 0);
  });

  test('an explicitly replaced logical watch still refuses the pending ' + stage, async () => {
    const h = fixture(), p = h.plan({stage}), started = await h.begin(p);
    started.stream.close();
    h.S.streams.delete('p2p:' + p.hint.base);
    h.connect(p.hint.base, p.boot);
    assert.notEqual(h.S.streams.get('p2p:' + p.hint.base), started.stream);
    assert.equal(started.guard(), false);
    h.release(p);
    const result = await started.work;
    h.closeIdle();
    assert.equal(result.accepted, false);
    assert.equal(h.S.streams.size, 0);
    assert.equal(h.S.recs.size, 0);
  });

  test('same kernel peer master renewal preserves the pending ' + stage, async () => {
    const h = fixture(), p = h.plan({stage}), started = await h.begin(p);
    h.register({...p.hint, providerRecord: {...p.hint.providerRecord, renewed: true}});
    h.connect(p.hint.base, {...p.boot});
    assert.equal(h.S.streams.get('p2p:' + p.hint.base), started.stream);
    assert.equal(started.guard(), true);
    h.release(p);
    const result = await started.work;
    assert.equal(result.accepted, true);
  });
}

test('retrying the transport within the same logical watch preserves currentness', async () => {
  const h = fixture(), p = h.plan({stage: 'body'}), started = await h.begin(p);
  h.watches[0].options.onState('retry', 'synthetic retry');
  h.watches[0].options.onState('open');
  assert.equal(started.guard(), true);
  h.release(p);
  assert.equal((await started.work).accepted, true);
});

for (const condition of ['older_generation', 'equivocation', 'chain_mismatch', 'expired']) {
  test('actual inventory admission retains the ' + condition + ' rejection', async () => {
    const h = fixture(), p = h.plan({stage: 'verification', expired: condition === 'expired'}),
      started = await h.begin(p);
    if (condition === 'older_generation')
      h.S.providerInventories.set(p.hint.kernel, {generation: 488, hash: 'hash:488', recordKeys: new Set()});
    if (condition === 'equivocation')
      h.S.providerInventories.set(p.hint.kernel, {generation: 487, hash: 'different:487', recordKeys: new Set()});
    if (condition === 'chain_mismatch')
      h.S.providerInventories.set(p.hint.kernel, {generation: 486, hash: 'different:486', recordKeys: new Set()});
    assert.equal(started.guard(), true);
    h.release(p);
    const result = await started.work;
    h.closeIdle();
    assert.equal(result.accepted, false);
    assert.equal(h.S.recs.size, 0);
    assert.equal(h.S.gossipPeers.size, 0);
    assert.equal(h.S.providerRouteReconciliations.size, 0);
    assert.equal(h.S.streams.size, 0, 'A refused job does not pin a watch after settling');
    const expected = condition === 'expired' ? 'inventory_expired'
      : condition === 'chain_mismatch' ? 'chain_head_mismatch' : 'stale_or_equivocating_generation';
    assert.ok(h.events.some(event => event.kind === 'admitted' && event.reason === expected));
  });
}

for (const failure of ['null_body', 'invalid_rows', 'throwing_verifier']) {
  test('zero-admission ' + failure + ' releases its reconciliation and is prunable', async () => {
    const h = fixture(), p = h.plan({stage: 'body', valid: failure !== 'invalid_rows',
      throwVerification: failure === 'throwing_verifier'}), started = await h.begin(p);
    if (failure === 'null_body') p.body.resolve(null);
    else h.release(p);
    let result = null, error = null;
    try { result = await started.work; } catch (caught) { error = caught.message; }
    assert.equal(h.S.providerRouteReconciliations.size, 0);
    h.closeIdle();
    assert.equal(h.S.streams.size, 0);
    assert.equal(h.S.recs.size, 0);
    assert.equal(h.S.gossipPeers.size, 0);
    assert.equal(count(h.events, 'upsert'), 0);
    if (failure === 'throwing_verifier') assert.equal(error, 'synthetic verifier failure');
    else assert.equal(result.accepted, false);
  });
}

test('caller cancellation leaves shared owner work intact and settles cleanly later', async () => {
  const h = fixture(), p = h.plan({stage: 'body'}), caller = new AbortController();
  const started = await h.begin(p, {signal: caller.signal});
  caller.abort();
  assert.equal((await started.work).accepted, false);
  assert.equal(h.S.providerRouteReconciliations.size, 1);
  const owner = [...h.S.providerRouteReconciliations.values()][0];
  assert.equal(started.guard(), true);
  h.release(p);
  assert.equal((await owner).accepted, true);
  h.closeIdle();
  assert.equal(h.S.providerRouteReconciliations.size, 0);
});

test('pending retention respects the existing watch cap and frees refused slots fairly', async () => {
  const h = fixture(), pending = [];
  for (let i = 0; i < h.limits.monitoredBases; i++) {
    const p = h.plan({name: 'pending-' + i, stage: 'body', valid: false});
    pending.push({p, ...(await h.begin(p))});
  }
  assert.equal(h.watches.length, h.limits.monitoredBases);
  await h.maintenance();
  const retained = h.S.streams.size;
  const outside = h.plan({name: 'next', stage: 'body'});
  h.register(outside.hint);
  h.connect(outside.hint.base, outside.boot);
  const afterLimitAttempt = h.S.streams.size, createdAfterLimitAttempt = h.watches.length;
  for (const item of pending) h.release(item.p);
  await Promise.all(pending.map(item => item.work));
  assert.equal(h.S.providerRouteReconciliations.size, 0);
  h.closeIdle();
  assert.equal(h.S.streams.size, 0);
  h.connect(outside.hint.base, outside.boot);
  const slotReused = h.S.streams.has('p2p:' + outside.hint.base);
  assert.equal(retained, h.limits.monitoredBases, 'Only already-open pending watches survive');
  assert.equal(afterLimitAttempt, h.limits.monitoredBases);
  assert.equal(createdAfterLimitAttempt, h.limits.monitoredBases, 'Exemption never creates an extra watch');
  assert.equal(slotReused, true, 'A refused job loses retention at the next normal rebalance');
});

test('an unrelated job or non-peer stream cannot acquire pending retention', async () => {
  const h = fixture(), p = h.plan();
  h.register(p.hint);
  h.connect(p.hint.base, p.boot);
  h.S.providerRouteReconciliations.set('kernel:other\u0000' + p.hint.base, Promise.resolve());
  const closed = [];
  h.S.streams.set('https://synthetic.invalid/events',
    {_base: 'https://synthetic.invalid', close: () => closed.push(true)});
  h.peerList();
  h.rebalance();
  assert.equal(h.S.streams.size, 0);
  assert.equal(closed.length, 1);
  assert.equal(h.watches[0].closed, true);
  h.S.providerRouteReconciliations.clear();
});

