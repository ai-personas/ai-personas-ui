// Exercise the shipped avatar job with real descriptor and byte verification.
// Only the network, clock and browser image decoder are controlled here.
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assets = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assets, 'discovery.js'), 'utf8');
const {fetchVerifiedPersonaAvatar, personaAvatarIdentityPayload, resolvePersonaAvatarBodyUrl}
  = await import(pathToFileURL(resolve(assets, 'persona-avatar.mjs')));
const {canonicalJson} = await import(pathToFileURL(resolve(assets, 'live-signatures.mjs')));
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5i0AAAAASUVORK5CYII=', 'base64');
const hash = createHash('sha256').update(bytes).digest('hex');
const {privateKey, publicKey} = generateKeyPairSync('ed25519');
const pin = publicKey.export({type: 'spki', format: 'der'}).subarray(-32).toString('hex');
const descriptor = {
  schema: 'persona-avatar/2', kind: 'raster', persona_id: 'member',
  identity_signing_key_id: 'persona:member', identity_public_key_hex: pin,
  content_ref: `sha256:${hash}`, sha256: hash,
  body_path: `assets/persona-avatars/sha256/${hash}.png`,
  mime_type: 'image/png', byte_length: bytes.length, width: 1, height: 1,
  character_prompt_hash: `sha256:${'a'.repeat(64)}`, provenance_hash: `sha256:${'b'.repeat(64)}`,
};
descriptor.identity_signature_hex = sign(null,
  Buffer.from(canonicalJson(personaAvatarIdentityPayload(descriptor))), privateKey).toString('hex');
function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, start);
  return source.slice(first, last);
}
async function until(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(check(), 'the controlled operation did not start');
}
function fixture({http = false} = {}) {
  let now = 0, nextTimer = 0;
  const timers = new Map(), requests = [], httpRequests = [], decoded = [];
  const clock = {
    setTimeout(callback, ms) { const id = ++nextTimer; timers.set(id, {at: now + ms, callback}); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const signals = {
    any: list => AbortSignal.any(list),
    timeout(ms) {
      const controller = new AbortController();
      clock.setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);
      return controller.signal;
    },
  };
  const deferredRead = (rows, options) => new Promise((resolve, reject) => {
    const request = {options, resolve, reject, cancelled: false}; rows.push(request);
    const cancel = () => { request.cancelled = true; reject(options.signal.reason); };
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener('abort', cancel, {once: true});
  });
  const providerBase = http ? 'https://node.example' : 'libp2p://12D3KooWAbC';
  const card = {_providerBase: providerBase, _personaIdentityPublicKeyHex: pin};
  const S = {personaIdentityKeys: new Map()};
  const values = {
    S, globalThis: clock, AbortSignal: signals, location: {href: 'https://portal.example/'},
    _personaRef: () => ({key: 'kernel:member', sid: 'member'}),
    signedPersonaIdentity: () => ({canonicalId: 'member', signedId: 'member'}),
    resolvePersonaAvatarBodyUrl, fetchVerifiedPersonaAvatar,
    p2pDataRouteForUrl: url => ({route: {providerRecord: {}}, path: new URL(url).pathname.slice(1)}),
    P2P: {fetchPublicBlob: (_provider, _hash, options) => deferredRead(requests, options)},
    isHttp: url => /^https?:/.test(url), secureFetchInit: (_url, init) => init,
    fetch: (_url, options) => deferredRead(httpRequests, options),
    _decodePersonaAvatarBlob: async (blob, _descriptor, signal) => {
      signal.throwIfAborted(); decoded.push(Buffer.from(await blob.arrayBuffer()));
    },
  };
  const api = new Function(...Object.keys(values),
    section('function settleBeforeAbort(', '// Large signed inventories')
    + section('const _PERSONA_AVATAR_CACHE_MAX_ENTRIES=', 'function _personaAvatarFallbackCopy(')
    + section('function _rememberPersonaAvatarAsset(', 'function _neutralPersonaAvatar(')
    + '\nreturn {load:_loadPersonaAvatarAsset, jobs:_personaAvatarJobs, assets:_personaAvatarAssets,'
    + 'cancel:()=>{for(const controller of _personaAvatarJobControllers) controller.abort();}};'
  )(...Object.values(values));
  return {...api, requests, httpRequests, decoded,
    load: () => api.load('kernel:member', card, descriptor),
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) {
        timers.delete(id); timer.callback();
      }
    },
  };
}
function response() {
  return new Response(bytes, {headers: {'content-type': 'image/png', 'content-length': String(bytes.length)}});
}

test('a peer portrait remains one shared job after fifteen seconds and admits its complete bytes', async () => {
  const f = fixture(); let settled = false;
  const first = f.load().finally(() => { settled = true; }); first.catch(() => {});
  await until(() => f.requests.length === 1);
  f.advance(15001); await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'a healthy peer transfer must not be discarded by a whole-job timer');
  const second = f.load();
  assert.equal(f.jobs.size, 1); assert.equal(f.requests.length, 1);
  f.requests[0].resolve({bytes});
  const [one, two] = await Promise.all([first, second]);
  assert.equal(one, two); assert.equal(f.jobs.size, 0); assert.equal(f.assets.size, 1);
  assert.deepEqual(f.decoded, [bytes]);
});

test('an HTTP timeout leaves the still-running peer portrait shared and eligible', async () => {
  const f = fixture({http: true});
  const loaded = f.load(); loaded.catch(() => {});
  await until(() => f.requests.length === 1 && f.httpRequests.length === 1);
  f.advance(15001); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.httpRequests[0].cancelled, true);
  assert.equal(f.requests[0].cancelled, false); assert.equal(f.jobs.size, 1);
  f.requests[0].resolve({bytes}); await loaded;
  assert.deepEqual(f.decoded, [bytes]);
});

test('page cancellation reaches the peer transfer and cannot cache its late result', async () => {
  const f = fixture(); const loaded = f.load(); loaded.catch(() => {});
  await until(() => f.requests.length === 1);
  f.cancel();
  await assert.rejects(loaded, error => error.avatarBodyTransient === true);
  assert.equal(f.requests[0].cancelled, true);
  f.requests[0].resolve({bytes}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.assets.size, 0); assert.deepEqual(f.decoded, []);
});

test('a verified HTTP winner cancels its redundant peer transfer', async () => {
  const f = fixture({http: true}); const loaded = f.load();
  await until(() => f.requests.length === 1 && f.httpRequests.length === 1);
  f.httpRequests[0].resolve(response()); await loaded;
  assert.equal(f.requests[0].cancelled, true); assert.equal(f.assets.size, 1);
  assert.deepEqual(f.decoded, [bytes]);
});

test('a failed peer read permits one later retry without refusing the signed identity', async () => {
  const f = fixture(); const first = f.load(); first.catch(() => {});
  await until(() => f.requests.length === 1);
  f.requests[0].reject(new Error('connection lost'));
  await assert.rejects(first, error => error.avatarBodyTransient === true);
  const retry = f.load(); await until(() => f.requests.length === 2);
  f.requests[1].resolve({bytes}); await retry;
  assert.equal(f.assets.size, 1); assert.deepEqual(f.decoded, [bytes]);
});
