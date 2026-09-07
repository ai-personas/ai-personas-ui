import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const {fetchVerifiedPersonaAvatar, personaAvatarIdentityPayload, resolvePersonaAvatarBodyUrl}
  = await import(pathToFileURL(resolve(assetRoot, 'persona-avatar.mjs')));
const {canonicalJson} = await import(pathToFileURL(resolve(assetRoot, 'live-signatures.mjs')));
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5i0AAAAASUVORK5CYII=', 'base64');
const hash = createHash('sha256').update(bytes).digest('hex');
const bodyPath = `assets/persona-avatars/sha256/${hash}.png`;
const peer = 'libp2p://12D3KooWAbC';
const pageUrl = 'https://portal.example/';

test('portraits resolve against the exact peer or web provider', () => {
  for (const providerBase of [peer, `${peer}/`, 'https://node.example/a', 'http://localhost:8765']) {
    assert.equal(resolvePersonaAvatarBodyUrl(bodyPath, {providerBase, pageUrl}),
      `${providerBase.replace(/\/$/, '')}/${bodyPath}`);
  }
});

test('portrait paths and peer providers cannot redirect to other addresses', () => {
  for (const providerBase of ['libp2p://user@peer', 'libp2p://peer:80',
    'libp2p://peer/path', 'libp2p://peer?url=foreign', 'libp2p://peer#foreign', 'file:///tmp']) {
    assert.equal(resolvePersonaAvatarBodyUrl(bodyPath, {providerBase, pageUrl}), '', providerBase);
  }
  for (const path of [`/${bodyPath}`, `../${bodyPath}`, `//foreign/${bodyPath}`]) {
    assert.equal(resolvePersonaAvatarBodyUrl(path, {providerBase: peer, pageUrl}), '', path);
  }
});

test('a peer-only portrait still verifies its persona signature and complete image bytes', async () => {
  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  const key = publicKey.export({type: 'spki', format: 'der'}).subarray(-32).toString('hex');
  const descriptor = {
    schema: 'persona-avatar/2', kind: 'raster', persona_id: 'member',
    identity_signing_key_id: 'persona:member', identity_public_key_hex: key,
    content_ref: `sha256:${hash}`, sha256: hash, body_path: bodyPath,
    mime_type: 'image/png', byte_length: bytes.length, width: 1, height: 1,
    character_prompt_hash: `sha256:${'a'.repeat(64)}`, provenance_hash: `sha256:${'b'.repeat(64)}`,
  };
  descriptor.identity_signature_hex = sign(null,
    Buffer.from(canonicalJson(personaAvatarIdentityPayload(descriptor))), privateKey).toString('hex');
  let supplied = bytes;
  const requests = [];
  const options = {expectedPersonaId: 'member', pinnedPublicKeyHex: key,
    providerBase: peer, pageUrl, fetchImpl: async (url) => {
      requests.push(url);
      return new Response(supplied, {headers: {'content-type': 'image/png', 'content-length': String(bytes.length)}});
    }};
  const result = await fetchVerifiedPersonaAvatar(descriptor, options);
  assert.deepEqual(Buffer.from(result.bytes), bytes);
  assert.equal(result.sourceUrl, `${peer}/${bodyPath}`);
  assert.deepEqual(requests, [`${peer}/${bodyPath}`]);
  supplied = Buffer.from(bytes);
  supplied[supplied.length - 1] ^= 1;
  await assert.rejects(fetchVerifiedPersonaAvatar(descriptor, options), /avatar bytes refused/);
  await assert.rejects(fetchVerifiedPersonaAvatar(descriptor,
    {...options, pinnedPublicKeyHex: 'c'.repeat(64)}), /avatar identity signature refused/);
  assert.equal(requests.length, 2, 'Invalid identity never requests a body');
});
