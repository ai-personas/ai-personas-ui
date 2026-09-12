import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assets = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assets, 'discovery.js'), 'utf8');
const {sameRouteOrigin} = await import(pathToFileURL(resolve(assets, 'peer-route.mjs')));
const {currentMasterKey} = await import(pathToFileURL(resolve(assets, 'discovery-authority.mjs')));
const code = source.slice(source.indexOf('function p2pDataRouteForUrl('),
  source.indexOf('// Large signed inventories'));
const bytes = new TextEncoder().encode('A public authored artifact\n');
const hash = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const master = 'a'.repeat(64), kernel = 'kernel:' + master.slice(0, 16);
const peerBase = 'libp2p://peerAlpha';

function fixture({base = '@origin'} = {}) {
  const location = new URL('http://127.0.0.1:18980/');
  const provider = {host_kernel_id: kernel, public_key_hex: master,
    provider_peer_id: 'peerAlpha', host_multiaddrs: ['/dns4/peer.example/tcp/443/wss/p2p/peerAlpha']};
  const route = {providerRecord: provider, kernel, peerId: provider.provider_peer_id};
  const S = {p2pDataRoutes: new Map([[peerBase, route]]), p2pArtifactHashes: new Map(),
    boots: new Map([[base, {kernel_id: kernel}]]),
    keyDocs: new Map([[base, {kernelId: kernel, entries: [
      {key_id: 'kernel-master', role: 'master', status: 'current', public_key_hex: master},
    ]}]]), providerInventories: new Map([[kernel, {generatedAt: 100, expiresAt: 300}]])};
  const reads = [];
  const values = {S, location, URL, sameRouteOrigin, currentMasterKey,
    _providerInventoryIsCurrent: inventory => inventory?.generatedAt < 200 && inventory?.expiresAt > 200,
    P2P: {fetchPublicBlob: async (record, contentHash, options) => {
      reads.push({record, contentHash, options});
      options.onProgress?.({received: bytes.length, total: bytes.length, phase: 'verified'});
      return {bytes};
    }},
  };
  const api = new Function(...Object.keys(values), code
    + '\nreturn {read:fetchP2PArtifactBytes, route:p2pDataRouteForUrl};')(...Object.values(values));
  return {...api, S, provider, reads};
}

test('an HTTP-origin artifact uses its existing same-master peer route without HTTP or credentials', async () => {
  const f = fixture(), progress = [];
  const result = await f.read('http://127.0.0.1:18980/k/run-example/artifacts/package/plot.svg', hash,
    bytes.length, {onProgress: value => progress.push(value)});
  assert.deepEqual(result, bytes);
  assert.equal(f.reads.length, 1);
  assert.equal(f.reads[0].record, f.provider);
  assert.equal(f.reads[0].contentHash, hash);
  assert.equal(f.reads[0].options.path, 'k/run-example/artifacts/package/plot.svg');
  assert.equal(f.reads[0].options.maxBytes, bytes.length);
  assert.equal(f.reads[0].options.headers, undefined);
  assert.equal(progress.at(-1).phase, 'verified');
  assert.equal(f.route('http://127.0.0.1:18980/discovery/public/providers.json'), null,
    'Artifact fallback must not switch ordinary HTTP JSON reads to peer-only transport');
});

test('a verified alternate base removes only its exact path prefix and binds hash queries', async () => {
  const f = fixture({base: 'https://node.example/personas'});
  assert.deepEqual(await f.read('https://node.example/personas/artifacts/report.txt?sha256=' + hash.slice(7), hash), bytes);
  assert.equal(f.reads[0].options.path, 'artifacts/report.txt');
  for (const url of ['https://node.example/personas-extra/artifacts/report.txt',
    'https://node.example/elsewhere/report.txt',
    'https://node.example/personas/artifacts/report.txt?sha256=' + 'b'.repeat(64)])
    assert.equal(await f.read(url, hash), null);
  assert.equal(f.reads.length, 1);
});

for (const expired of [false, true]) {
  test('a more specific mounted origin owns its path' + (expired ? ' even after expiry' : ''), async () => {
    const f = fixture(), mountedBase = 'http://127.0.0.1:18980/mounted';
    const mountedKey = 'c'.repeat(64), mountedKernel = 'kernel:' + mountedKey.slice(0, 16);
    const mountedProvider = {...f.provider, host_kernel_id: mountedKernel,
      public_key_hex: mountedKey, provider_peer_id: 'peerMounted'};
    f.S.boots.set(mountedBase, {kernel_id: mountedKernel});
    f.S.keyDocs.set(mountedBase, {kernelId: mountedKernel, entries: [
      {key_id: 'kernel-master', role: 'master', status: 'current', public_key_hex: mountedKey},
    ]});
    f.S.providerInventories.set(mountedKernel, {generatedAt: 100, expiresAt: expired ? 199 : 300});
    f.S.p2pDataRoutes.set('libp2p://peerMounted', {
      providerRecord: mountedProvider, kernel: mountedKernel, peerId: 'peerMounted',
    });
    const result = await f.read(mountedBase + '/artifacts/report.txt', hash);
    if (expired) {
      assert.equal(result, null);
      assert.equal(f.reads.length, 0, 'An expired mounted node must not send its path to the root node');
    } else {
      assert.deepEqual(result, bytes);
      assert.equal(f.reads[0].record, mountedProvider);
      assert.equal(f.reads[0].options.path, 'artifacts/report.txt');
    }
  });
}

for (const alteration of ['no-inventory', 'expired', 'foreign-kernel', 'different-full-key', 'unverified-route']) {
  test('an HTTP alias refuses ' + alteration, async () => {
    const f = fixture();
    if (alteration === 'no-inventory') f.S.providerInventories.clear();
    if (alteration === 'expired') f.S.providerInventories.get(kernel).expiresAt = 199;
    if (alteration === 'foreign-kernel') f.S.boots.get('@origin').kernel_id = 'kernel:foreign';
    if (alteration === 'different-full-key') f.provider.public_key_hex = master.slice(0, 16) + 'b'.repeat(48);
    if (alteration === 'unverified-route') f.S.p2pDataRoutes.clear();
    assert.equal(await f.read('http://127.0.0.1:18980/artifacts/report.txt', hash), null);
    assert.equal(f.reads.length, 0);
  });
}

test('unknown origins, credentials, fragments and opaque foreign peers create no artifact route', async () => {
  const f = fixture();
  for (const url of ['http://localhost:18980/artifacts/report.txt',
    'http://user:password@127.0.0.1:18980/artifacts/report.txt',
    'http://127.0.0.1:18980/artifacts/report.txt#other', 'libp2p://otherPeer/artifacts/report.txt'])
    assert.equal(await f.read(url, hash), null, url);
  assert.equal(f.reads.length, 0);
});

test('cancellation prevents a read through an otherwise valid alias', async () => {
  const f = fixture(), controller = new AbortController();
  controller.abort();
  assert.equal(await f.read('http://127.0.0.1:18980/artifacts/report.txt', hash,
    bytes.length, {signal: controller.signal}), null);
  assert.equal(f.reads.length, 0);
});
