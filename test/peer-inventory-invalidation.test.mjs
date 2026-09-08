import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {disabledPublicEvidenceDependencies} from './helpers/public-evidence.mjs';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const sharedSource = source.slice(source.indexOf('const _sharedDocJobs='),
  source.indexOf('async function fetchJson('));
const routeNormalization = ['isAbs', 'isHttp', 'join', 'opBaseKey']
  .map(name => source.match(new RegExp('^const ' + name + '=.*$', 'm'))[0]).join('\n');

function declaration(name) {
  const at = source.indexOf('function ' + name + '(');
  assert.notEqual(at, -1, name + ' exists in the production source');
  const first = source.lastIndexOf('\n', at) + 1;
  const next = source.slice(first + 1).search(/\n(?:async )?function [\w$]+\(|\nconst [\w$]+\s*=/);
  return source.slice(first, next < 0 ? source.length : first + 1 + next);
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

const document = (generation, valid = true) => ({generation, valid, document_count: 1});
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

function fixture({base = 'libp2p://peer', providers = 'discovery/public/providers.json',
  keysAvailable = true} = {}) {
  let now = 0, activeBodies = 0, maximumBodies = 0;
  const timers = [], callbacks = [], bodyPlans = [], telemetryPlans = [], verificationPlans = [];
  const bodies = [], requests = [], httpRequests = [], verified = [], applied = [];
  const location = {origin: 'https://viewer.invalid', href: 'https://viewer.invalid/'};
  const {join, opBaseKey, isHttp} = new Function('location', routeNormalization
    + '\nreturn {join,opBaseKey,isHttp};')(location);
  const routeKey = opBaseKey(base);
  const hint = {base, kernel: 'kernel:test', peerId: 'peer',
    providerRecord: {host_kernel_id: 'kernel:test', provider_peer_id: 'peer',
      public_key_hex: 'master', marker: 'original'}};
  const boot = {kernel_id: hint.kernel, record_count: 1};
  if (providers !== null) boot.providers_url = providers;
  const url = join(base, providers || 'discovery/public/providers.json');
  const watchKey = 'p2p:' + routeKey;
  const S = {p2pDataRoutes: new Map([[routeKey, {...hint}]]),
    streams: new Map([[watchKey, {_boot: boot}]]),
    providerRouteReconciliations: new Map(), boots: new Map([[base, boot]]),
    p2pInvalidations: new Map(), p2pWatchRevisions: new Map(), peerHealth: new Map()};
  const setTimeout = (fn, delay) => {
    const timer = {fn, delay, due: now + delay, fired: false};
    timers.push(timer);
    return timer;
  };
  const clearTimeout = timer => { if (timer) timer.fired = true; };
  function readBody(transport, provider = null) {
    assert.ok(bodyPlans.length, 'Every full-body transfer requires an explicit test plan');
    const planned = bodyPlans.shift();
    bodies.push({transport, provider});
    activeBodies++;
    maximumBodies = Math.max(maximumBodies, activeBodies);
    return Promise.resolve(planned).finally(() => { activeBodies--; });
  }
  const values = {
    ...disabledPublicEvidenceDependencies(),
    S, join, opBaseKey, setTimeout, clearTimeout, Date: {now: () => now},
    NETWORK_LIMITS: {cachedKernels: 32, cachedRecords: 1000, monitoredBases: 32},
    location,
    P2P: {fetchPublicJson: async (provider, path, options) => {
      requests.push({provider, path, options});
      if (path.endsWith('personaos-keys.json')) return keysAvailable ? {kernel_id: hint.kernel} : null;
      if (path.endsWith('personaos-discovery.json')) return boot;
      assert.equal(path, providers || 'discovery/public/providers.json');
      assert.equal(options.maxBytes, Number.MAX_SAFE_INTEGER);
      return readBody('p2p', provider);
    }},
    admitKeysDocument: () => ({'kernel-master': 'master'}),
    verifiedRowsFromProviderIndex: async body => {
      verified.push(body.generation);
      if (verificationPlans.length) await verificationPlans.shift();
      const rows = body.valid ? [{kind: 'task', _kernel: hint.kernel,
        record_id: 'task:' + body.generation}] : [];
      return {rows, refused: body.valid ? 0 : 1, envelopeCount: 1,
        inventory: {ok: body.valid, recordIds: new Set(rows.map(row => row.record_id))}};
    },
    applyVerifiedProviderInventory: (_base, _boot, _found, inventory, body) => {
      if (!inventory?.complete || !body?.valid) return false;
      applied.push(body.generation);
      return true;
    },
    connectDiscoveryStream: (_base, currentBoot) => {
      if (!S.streams.has(watchKey)) S.streams.set(watchKey, {});
      S.streams.get(watchKey)._boot = currentBoot;
    },
    loadTelemetry: async (_base, options) => {
      if (options?.boot && telemetryPlans.length) await telemetryPlans.shift();
    },
    isHttp,
    fetchDiscoveryBootstrap: async () => boot,
    keysFor: async () => ({'kernel-master': 'master'}),
    refreshOpenInputDirectory: async () => {},
    fetchJson: async requested => {
      httpRequests.push(requested);
      assert.equal(requested, url);
      return readBody('http');
    },
    log() {}, _rememberP2PRouteHint() {}, updateP2PStatus() {},
    collectP2PBootstraps() {}, noteKernel() {}, _clearEntityFeedCache() {},
    _personaKeysForInvalidation: () => null, scheduleSseCognitionRefresh() {},
    fetchLiveArtifacts: async () => {}, pollLiveArtifacts() {},
    scheduleRealtimeRepaint() {}, refreshSystemView() {}, refreshLiveSection() {},
  };
  const functions = new Function(...Object.keys(values), [
    sharedSource,
    ...['settleBeforeAbort', '_registerP2PDataRoute', '_discoverFromP2P', 'discoverFrom',
      '_refreshPeerInventory', '_schedulePeerInvalidation', '_reconcileP2PRouteHint'].map(declaration),
    'return {shared:sharedDocumentJson, schedule:_schedulePeerInvalidation,',
    'reconcile:_reconcileP2PRouteHint, discoverHTTP:discoverFrom, jobs:_sharedDocJobs,',
    'guard:typeof _peerInventoryReadGuard === "function" ? _peerInventoryReadGuard : null};',
  ].join('\n'))(...Object.values(values));
  async function advance(milliseconds) {
    now += milliseconds;
    for (const timer of timers.filter(timer => !timer.fired && timer.due <= now)) {
      timer.fired = true;
      const result = timer.fn();
      if (result?.then) {
        const observation = {settled: false, error: null};
        callbacks.push(observation);
        result.then(() => { observation.settled = true; },
          error => { observation.settled = true; observation.error = error; });
      }
    }
    await flush();
  }
  return {...functions, S, base, routeKey, boot, url, hint, watchKey, timers, callbacks,
    bodies, requests, httpRequests, verified, applied, advance, readBody,
    planBody: value => bodyPlans.push(value),
    holdTelemetry: promise => telemetryPlans.push(promise),
    holdVerification: promise => verificationPlans.push(promise),
    invalidate: (kind = 'discovery', revision = 'revision:1') =>
      functions.schedule(base, boot, {kind, revision}),
    read: () => functions.shared(url, () => readBody('direct'), {base}),
    get maximumBodies() { return maximumBodies; }};
}

test('ordinary slow reads still share one transfer and retain the settled result for ten seconds', async () => {
  const h = fixture(), old = deferred();
  h.planBody(old.promise);
  const first = h.read();
  await flush();
  await h.advance(45_000);
  assert.equal(h.read(), first);
  assert.equal(h.bodies.length, 1);
  old.resolve(document(1));
  await first;
  assert.equal(h.read(), first);
  await h.advance(10_001);
  h.planBody(document(2));
  assert.equal((await h.read()).generation, 2);
  assert.equal(h.bodies.length, 2);
});

test('a burst of discovery hints queues one complete successor after the old reconciliation', async () => {
  const h = fixture(), old = deferred(), fresh = deferred();
  h.planBody(old.promise);
  h.planBody(fresh.promise);
  const first = h.reconcile(h.hint);
  await flush();
  h.invalidate('discovery', 'a');
  h.invalidate('discovery', 'a');
  h.invalidate('discovery', 'b');
  await h.advance(150);
  assert.equal(h.callbacks.length, 1);
  assert.equal(h.bodies.length, 1, 'The hinted refresh must let the active transfer finish');
  old.resolve(document(1));
  await flush();
  assert.equal(h.bodies.length, 2, 'The hinted refresh must request a post-hint complete body');
  assert.deepEqual(h.applied, [1]);
  fresh.resolve(document(2));
  await first;
  await flush();
  assert.deepEqual(h.applied, [1, 2]);
  assert.ok(h.callbacks.every(callback => callback.settled && !callback.error));
  assert.equal(h.maximumBodies, 1);
});

for (const kind of ['discovery', 'resync']) {
  test(kind + ' invalidates at receipt and accepts a body started during debounce', async () => {
    const h = fixture(), fresh = deferred();
    h.planBody(document(1));
    await h.read();
    h.invalidate(kind);
    h.planBody(fresh.promise);
    const postHint = h.read();
    await flush();
    assert.equal(h.bodies.length, 2, 'The pre-hint settled entry is evicted before debounce');
    await h.advance(150);
    assert.equal(h.bodies.length, 2, 'A read begun after the hint remains eligible');
    fresh.resolve(document(2));
    assert.equal((await postHint).generation, 2);
    await flush();
    assert.deepEqual(h.applied, [2]);
    assert.equal(h.bodies.length, 2, 'Debounce must not invalidate the post-hint body again');
  });
}

test('a hint before any provider request does not force a second full download', async () => {
  const h = fixture(), first = deferred();
  h.invalidate();
  h.planBody(first.promise);
  const reconciliation = h.reconcile(h.hint);
  await flush();
  await h.advance(150);
  first.resolve(document(2));
  await reconciliation;
  await flush();
  assert.equal(h.bodies.length, 1);
  assert.ok(h.applied.length && h.applied.every(generation => generation === 2));
  assert.ok(h.callbacks.every(callback => callback.settled && !callback.error));
});

test('R0 telemetry, an independent D1, and intervening R1 cannot consume the second hint', async () => {
  const h = fixture(), telemetry = deferred(), d1 = deferred(), d2 = deferred();
  h.planBody(document(0));
  h.holdTelemetry(telemetry.promise);
  const r0 = h.reconcile(h.hint);
  await flush();
  assert.deepEqual(h.applied, [0]);
  h.invalidate('discovery', 'h1');
  await h.advance(150);
  await h.advance(10_001);
  h.planBody(d1.promise);
  const direct = h.read();
  await flush();
  assert.equal(h.bodies.length, 2);
  h.invalidate('discovery', 'h2');
  await h.advance(150);
  h.planBody(d2.promise);
  telemetry.resolve();
  await flush();
  assert.equal(h.requests.filter(request => request.path.endsWith('personaos-keys.json')).length, 2,
    'R1 starts after R0 telemetry while the independently read D1 is still active');
  assert.equal(h.bodies.length, 2);
  d1.resolve(document(1));
  assert.equal((await direct).generation, 1);
  await flush();
  assert.equal(h.bodies.length, 3, 'R1 must select a shared successor to the invalidated D1');
  assert.deepEqual(h.applied, [0], 'D1 cannot satisfy the hinted reconciliation');
  d2.resolve(document(2));
  await r0;
  await flush();
  assert.deepEqual(h.applied, [0, 2]);
  assert.equal(h.maximumBodies, 1);
  assert.ok(h.callbacks.every(callback => callback.settled && !callback.error));
});

test('targeted invalidation leaves other URLs and non-discovery events shared', async () => {
  const h = fixture({providers: 'custom/providers.json?plane=public'});
  const target = h.shared(h.url, async () => document(1));
  const otherUrl = h.base + '/unrelated/providers.json';
  const other = h.shared(otherUrl, async () => document(9));
  await Promise.all([target, other]);
  for (const kind of ['heartbeat', 'telemetry', 'cognition', 'artifact']) h.invalidate(kind);
  assert.equal(h.shared(h.url, assert.fail), target);
  h.invalidate('discovery');
  assert.equal(h.shared(otherUrl, assert.fail), other);
  assert.equal((await h.shared(h.url, async () => document(2))).generation, 2);
});

test('legacy bootstrap defaults invalidate only both established provider paths', async () => {
  const h = fixture({providers: null});
  const urls = [h.base + '/discovery/providers.json', h.base + '/discovery/public/providers.json'];
  const originals = await Promise.all(urls.map(url => h.shared(url, async () => document(1))));
  assert.deepEqual(originals.map(body => body.generation), [1, 1]);
  h.invalidate();
  const current = await Promise.all(urls.map(url => h.shared(url, async () => document(2))));
  assert.deepEqual(current.map(body => body.generation), [2, 2]);
});

for (const oldRejects of [false, true]) for (const freshRejects of [false, true]) {
  test('old ' + (oldRejects ? 'rejection' : 'null') + ' permits one successor; fresh '
    + (freshRejects ? 'rejection' : 'null') + ' does not self-retry', async () => {
    const h = fixture(), old = deferred(), fresh = deferred();
    let fetches = 0;
    const first = h.shared(h.url, () => { fetches++; return old.promise; });
    const firstResult = Promise.allSettled([first]);
    await flush();
    h.invalidate();
    const next = h.shared(h.url, () => { fetches++; return fresh.promise; });
    const nextResult = Promise.allSettled([next]);
    oldRejects ? old.reject(new Error('old failed')) : old.resolve(null);
    await flush();
    assert.equal(fetches, 2);
    freshRejects ? fresh.reject(new Error('fresh failed')) : fresh.resolve(null);
    await firstResult;
    assert.equal((await nextResult)[0].status, freshRejects ? 'rejected' : 'fulfilled');
    h.invalidate('discovery', 'revision:1');
    await Promise.allSettled([h.shared(h.url, () => { fetches++; return document(99); })]);
    assert.equal(fetches, 2, 'A duplicate revision cannot restart the failed successor');
    h.invalidate('discovery', 'revision:2');
    assert.equal((await h.shared(h.url, () => { fetches++; return document(2); })).generation, 2);
    assert.equal(fetches, 3, 'A distinct invalidation permits a new attempt');
  });
}

test('expired old cache timers cannot remove a successor', async () => {
  const h = fixture(), fresh = deferred();
  await h.shared(h.url, async () => document(1));
  const expiry = h.timers.find(timer => timer.delay === 10_000);
  h.invalidate();
  const next = h.shared(h.url, () => fresh.promise);
  await flush();
  expiry.fn();
  assert.equal(h.shared(h.url, assert.fail), next);
  fresh.resolve(document(2));
  assert.equal((await next).generation, 2);
});

const replacements = {
  retired: h => { h.S.p2pDataRoutes.delete(h.routeKey); h.S.streams.delete(h.watchKey); },
  watch: h => { h.S.streams.set(h.watchKey, {}); },
  kernel: h => { h.S.p2pDataRoutes.set(h.routeKey, {...h.hint, kernel: 'kernel:other'}); },
  peer: h => { h.S.p2pDataRoutes.set(h.routeKey, {...h.hint, peerId: 'other'}); },
  master: h => { h.S.p2pDataRoutes.set(h.routeKey, {...h.hint,
    providerRecord: {...h.hint.providerRecord, public_key_hex: 'other'}}); },
};

for (const [kind, replace] of Object.entries(replacements)) {
  test('a ' + kind + ' route cannot start a deferred body with the old watch', async () => {
    const h = fixture(), old = deferred();
    let freshReads = 0;
    const first = h.shared(h.url, () => old.promise, {base: h.base});
    await flush();
    h.invalidate();
    const next = h.shared(h.url, () => { freshReads++; return document(2); }, {base: h.base});
    replace(h);
    old.resolve(document(1));
    await first;
    assert.equal(await next, null);
    assert.equal(freshReads, 0);
    assert.equal(h.jobs.has(h.url), false, 'A stale waiter leaves no failed cache entry');
  });
}

test('replacing a route object with the same binding and watch preserves the successor', async () => {
  const h = fixture(), old = deferred();
  const first = h.shared(h.url, () => old.promise, {base: h.base});
  await flush();
  h.invalidate();
  const next = h.shared(h.url, async () => document(2), {base: h.base});
  h.S.p2pDataRoutes.set(h.base, {...h.hint,
    providerRecord: {...h.hint.providerRecord, marker: 'renewed'}});
  old.resolve(document(1));
  await first;
  assert.equal((await next).generation, 2);
});

test('a stale predicate before a read leaves a newer caller cache entry untouched', async () => {
  const h = fixture();
  const current = h.shared(h.url, async () => document(2));
  await current;
  const entry = h.jobs.get(h.url);
  const stale = h.shared(h.url, assert.fail, {isCurrent: () => false});
  assert.equal(typeof stale?.then, 'function');
  assert.equal(await stale, null);
  assert.equal(h.jobs.get(h.url), entry);
  assert.equal(h.shared(h.url, assert.fail), current);
});

test('a predicate that expires before fetch starts makes no transfer or cached null', async () => {
  const h = fixture();
  let current = true, calls = 0;
  const pending = h.shared(h.url, () => { calls++; return document(1); }, {isCurrent: () => current});
  current = false;
  assert.equal(await pending, null);
  assert.equal(calls, 0);
  assert.equal(h.jobs.has(h.url), false);
  assert.equal((await h.shared(h.url, async () => document(2))).generation, 2);
});

for (const [kind, replace] of Object.entries(replacements)) {
  test('a ' + kind + ' route stops the queued reconciliation after prior telemetry settles', async () => {
    const h = fixture(), telemetry = deferred();
    h.planBody(document(1));
    h.holdTelemetry(telemetry.promise);
    const first = h.reconcile(h.hint);
    await flush();
    h.invalidate();
    await h.advance(150);
    replace(h);
    telemetry.resolve();
    await first;
    await flush();
    assert.equal(h.bodies.length, 1);
    assert.equal(h.requests.length, 3);
    assert.ok(h.callbacks.every(callback => callback.settled && !callback.error));
  });
}

test('the trailing reconciliation uses the renewed current ProviderRecord', async () => {
  const h = fixture(), telemetry = deferred();
  h.planBody(document(1));
  h.planBody(document(2));
  h.holdTelemetry(telemetry.promise);
  const first = h.reconcile(h.hint);
  await flush();
  h.invalidate();
  await h.advance(150);
  h.S.p2pDataRoutes.set(h.base, {...h.hint,
    providerRecord: {...h.hint.providerRecord, marker: 'renewed'}});
  telemetry.resolve();
  await first;
  await flush();
  assert.equal(h.bodies.length, 2);
  assert.equal(h.bodies[1].provider.marker, 'renewed');
  assert.deepEqual(h.applied, [1, 2]);
});

test('aborting a scan cannot cancel the old transfer or the hinted successor', async () => {
  const h = fixture(), old = deferred(), fresh = deferred(), scan = new AbortController();
  h.planBody(old.promise);
  h.planBody(fresh.promise);
  const observer = h.reconcile(h.hint, {signal: scan.signal});
  await flush();
  h.invalidate();
  await h.advance(150);
  scan.abort();
  assert.equal((await observer).accepted, false);
  assert.equal(h.bodies.length, 1);
  old.resolve(document(1));
  await flush();
  assert.equal(h.bodies.length, 2);
  fresh.resolve(document(2));
  await flush();
  assert.deepEqual(h.applied, [1, 2]);
  assert.equal(h.maximumBodies, 1);
});

test('the successor still has to pass provider inventory verification', async () => {
  const h = fixture(), old = deferred();
  h.planBody(old.promise);
  h.planBody(document(2, false));
  const first = h.reconcile(h.hint);
  await flush();
  h.invalidate();
  await h.advance(150);
  old.resolve(document(1));
  await first;
  await flush();
  assert.deepEqual(h.verified, [1, 2]);
  assert.deepEqual(h.applied, [1]);
  assert.equal(h.bodies.length, 2);
  assert.ok(h.callbacks.every(callback => callback.settled && !callback.error));
});

test('HTTP provider reads at a known peer base carry the deferred watch guard', async () => {
  const h = fixture({base: 'https://peer.invalid'}), old = deferred();
  h.planBody(old.promise);
  const first = h.read();
  await flush();
  h.invalidate();
  const discovered = h.discoverHTTP(h.base, 'internet', h.boot, {resolveProviderAliases: false});
  await flush();
  replacements.retired(h);
  old.resolve(document(1));
  await first;
  const result = await discovered;
  assert.deepEqual(result.found, []);
  assert.equal(h.bodies.length, 1);
  assert.deepEqual(h.verified, []);
});

test('a stale P2P body on an HTTPS base cannot escape through HTTP fallback', async () => {
  const h = fixture({base: 'https://peer.invalid'}), old = deferred();
  h.planBody(old.promise);
  h.planBody(document(2));
  const independent = h.read();
  await flush();
  h.invalidate();
  const reconciliation = h.reconcile(h.hint);
  await flush();
  replacements.retired(h);
  old.resolve(document(1));
  await independent;
  assert.equal((await reconciliation).accepted, false);
  assert.deepEqual(h.httpRequests, []);
  assert.equal(h.bodies.length, 1);
  assert.deepEqual(h.applied, []);
  assert.equal(h.S.p2pDataRoutes.has(h.base), false);
  assert.equal(h.S.streams.has(h.watchKey), false);
});

test('retirement during provider verification prevents final registration and HTTP fallback', async () => {
  const h = fixture({base: 'https://peer.invalid'}), verification = deferred();
  h.planBody(document(2));
  h.holdVerification(verification.promise);
  const reconciliation = h.reconcile(h.hint);
  await flush();
  assert.deepEqual(h.verified, [2]);
  replacements.retired(h);
  verification.resolve();
  assert.equal((await reconciliation).accepted, false);
  assert.deepEqual(h.httpRequests, []);
  assert.deepEqual(h.applied, []);
  assert.equal(h.S.p2pDataRoutes.has(h.base), false);
  assert.equal(h.S.streams.has(h.watchKey), false);
});

test('ordinary P2P transport failure still permits verified HTTP fallback', async () => {
  const h = fixture({base: 'https://peer.invalid', keysAvailable: false});
  h.planBody(document(2));
  assert.equal((await h.reconcile(h.hint)).accepted, true);
  assert.deepEqual(h.httpRequests, [h.url]);
  assert.deepEqual(h.applied, [2]);
});

test('discoverFrom with an explicit empty origin base retains the deferred peer guard', async () => {
  const h = fixture({base: ''}), old = deferred();
  assert.equal(h.routeKey, 'https://viewer.invalid', 'Use production origin normalization');
  assert.equal(h.url, 'discovery/public/providers.json', 'Use the production relative provider path');
  h.planBody(old.promise);
  h.planBody(document(2));
  const independent = h.read();
  await flush();
  h.invalidate();
  const discovered = h.discoverHTTP('', 'internet', h.boot, {resolveProviderAliases: false});
  await flush();
  replacements.retired(h);
  old.resolve(document(1));
  await independent;
  assert.deepEqual((await discovered).found, []);
  assert.deepEqual(h.httpRequests, []);
  assert.deepEqual(h.verified, []);
  assert.equal(h.bodies.length, 1);
});

test('omitting the shared-read base does not inherit the page-origin peer guard', async () => {
  const h = fixture({base: ''}), old = deferred();
  const independent = h.shared(h.url, () => old.promise);
  await flush();
  h.invalidate();
  const successor = h.shared(h.url, async () => document(2));
  replacements.retired(h);
  old.resolve(document(1));
  await independent;
  assert.equal((await successor).generation, 2);
});
