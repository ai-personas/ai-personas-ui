import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const declarations = source.slice(source.indexOf('const _sharedDocJobs='),
  source.indexOf('async function fetchJson('));

test('a slow shared inventory stays one download through later discovery attempts', async () => {
  let now = 0, calls = 0, complete;
  const timers = [];
  const shared = new Function('Date', 'setTimeout', declarations + '\nreturn sharedDocumentJson;')(
    {now: () => now}, callback => timers.push(callback));
  const fetch = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  const first = shared('libp2p://peer/providers', fetch);
  await Promise.resolve();
  now = 45000;
  assert.equal(shared('libp2p://peer/providers', fetch), first);
  assert.equal(calls, 1, 'An active transfer must not expire from the shared cache');
  complete({generation: 1});
  assert.deepEqual(await first, {generation: 1});
  assert.equal(shared('libp2p://peer/providers', fetch), first);
  now += 10001;
  const next = shared('libp2p://peer/providers', fetch);
  await Promise.resolve();
  assert.notEqual(next, first);
  assert.equal(calls, 2, 'A later settled generation may be refreshed');
  timers[0]();
  assert.equal(shared('libp2p://peer/providers', fetch), next);
  complete({generation: 2});
  await next;
});

test('an expired network scan does not discard its still-progressing verified inventory', async () => {
  const section = (start, end) => source.slice(source.indexOf(start),
    source.indexOf(end, source.indexOf(start)));
  let complete, downloads = 0, applied = 0, watching = false;
  const values = {
    S: {providerRouteReconciliations: new Map(), boots: new Map()},
    _discoverFromP2P: () => { downloads++; return new Promise(resolve => { complete = resolve; }); },
    isHttp: () => false,
    applyVerifiedProviderInventory: () => { applied++; return true; },
    _rememberP2PRouteHint() {}, updateP2PStatus() {}, collectP2PBootstraps() {}, noteKernel() {},
    loadTelemetry: async () => { assert.ok(watching, 'Live watching precedes archive loading'); },
    connectDiscoveryStream: () => { watching = true; },
  };
  const reconcile = new Function(...Object.keys(values),
    section('function settleBeforeAbort(', 'async function fetchP2PArtifactBytes(')
    + section('function _reconcileP2PRouteHint(', 'async function _resolveProviderHintJob(')
    + '\nreturn _reconcileP2PRouteHint;')(...Object.values(values));
  const scan = new AbortController();
  const hint = {base: 'libp2p://peer', kernel: 'kernel:test'};
  const observed = reconcile(hint, {signal: scan.signal});
  scan.abort();
  assert.equal((await observed).accepted, false);
  const next = reconcile(hint);
  assert.equal(downloads, 1, 'Later scans share the original transfer');
  complete({boot: {kernel_id: hint.kernel}, found: [{}], inventory: {}});
  assert.equal((await next).accepted, true);
  assert.equal(applied, 1);
  assert.equal(values.S.providerRouteReconciliations.size, 0);
});

test('a verified peer watches current changes while its historical inventory is pending', async () => {
  const section = source.slice(source.indexOf('async function _discoverFromP2P('),
    source.indexOf('function _reconcileP2PRouteHint('));
  const hint = {base: 'libp2p://peer', kernel: 'kernel:test', peerId: 'peer',
    providerRecord: {host_kernel_id: 'kernel:test', provider_peer_id: 'peer', public_key_hex: 'master'}};
  const boot = {kernel_id: hint.kernel, record_count: 700};
  let release, pending = false, watches = 0, routeRegistered = false, keysValid = true;
  const values = {
    P2P: {fetchPublicJson: async (_provider, path) => {
      if (path.endsWith('personaos-keys.json')) return {kernel_id: hint.kernel};
      if (path.endsWith('personaos-discovery.json')) return boot;
      pending = true;
      return new Promise(resolve => { release = resolve; });
    }},
    settleBeforeAbort: promise => promise,
    admitKeysDocument: (_base, _boot, _keys, options) => {
      assert.equal(options.expectedMaster, hint.providerRecord.public_key_hex);
      return keysValid ? {'kernel-master': 'master'} : {};
    },
    _registerP2PDataRoute: () => { routeRegistered = true; },
    connectDiscoveryStream: (base, document) => {
      assert.ok(routeRegistered);
      assert.equal(base, hint.base);
      assert.equal(document, boot);
      watches++;
    },
    providerIndexResponseByteLimit: () => 10000000,
    NETWORK_LIMITS: {cachedRecords: 10000},
    join: (base, path) => `${base}/${path}`,
    sharedDocumentJson: (_url, fetch) => fetch(), log() {},
  };
  const discover = new Function(...Object.keys(values), section + '\nreturn _discoverFromP2P;')(
    ...Object.values(values));
  const work = discover(hint);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  try {
    assert.equal(pending, true);
    assert.equal(watches, 1, 'Current events must not wait for the full archive');
  } finally {
    release(null);
    await work;
  }
  keysValid = false;
  routeRegistered = false;
  const refused = await discover(hint);
  assert.equal(refused.boot, null);
  assert.equal(watches, 1, 'An unverified master must not open a watch');
  assert.equal(routeRegistered, false);
  await discover({...hint, kernel: 'kernel:foreign'});
  assert.equal(watches, 1, 'A mismatched provider must not open a watch');
});
