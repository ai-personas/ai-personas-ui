import assert from 'node:assert/strict';

import * as ed from '../assets/noble-ed25519.js';
import {
  fetchVerifiedPersonaAvatar,
  inspectPersonaAvatarBytes,
  normalizePersonaAvatar,
  personaAvatarIdentityPayload,
  personaAvatarSha256,
  verifyPersonaAvatarBytes,
  verifyPersonaAvatarDescriptor,
} from '../assets/persona-avatar.mjs';

const canonical = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const encoder = new TextEncoder();
const privateKey = Uint8Array.from({length: 32}, () => 0x0b);
const publicKey = await ed.getPublicKeyAsync(privateKey);
const hex = (bytes) => Array.from(bytes,
  (byte) => byte.toString(16).padStart(2, '0')).join('');
const png = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
));
const personaId = '01J9ZXP0RT5K8V3W6Y2N4B7C9D';
const digest = await personaAvatarSha256(png);
const candidate = {
  schema: 'persona-avatar/2',
  kind: 'raster',
  body_path: `assets/persona-avatars/sha256/${digest}.png`,
  content_ref: `sha256:${digest}`,
  sha256: digest,
  mime_type: 'image/png',
  byte_length: png.byteLength,
  width: 1,
  height: 1,
  character_prompt_hash: `sha256:${'11'.repeat(32)}`,
  provenance_hash: `sha256:${'22'.repeat(32)}`,
  persona_id: personaId,
  identity_signing_key_id: `persona:${personaId}`,
  identity_public_key_hex: hex(publicKey),
};
const payload = personaAvatarIdentityPayload(candidate);
const signature = await ed.signAsync(encoder.encode(canonical(payload)), privateKey);
const descriptor = {...candidate, identity_signature_hex: hex(signature)};

assert.deepEqual(normalizePersonaAvatar(descriptor), descriptor);
assert.deepEqual(await verifyPersonaAvatarDescriptor(descriptor, {
  expectedPersonaId: personaId,
  pinnedPublicKeyHex: hex(publicKey),
}), descriptor);
assert.equal(await verifyPersonaAvatarDescriptor({...descriptor, width: 2}, {
  expectedPersonaId: personaId,
}), null, 'persona signature must bind every descriptor fact');
assert.equal(normalizePersonaAvatar({...descriptor, mime_type: 'image/svg+xml'}), null,
  'active vector content must not enter the raster avatar surface');

assert.deepEqual(inspectPersonaAvatarBytes(png), {
  mimeType: 'image/png', width: 1, height: 1, byteLength: png.byteLength,
});
assert.deepEqual(await verifyPersonaAvatarBytes(png, descriptor), {
  mimeType: 'image/png', width: 1, height: 1, byteLength: png.byteLength,
});
const tampered = png.slice(); tampered[tampered.length - 1] ^= 0x01;
assert.equal(await verifyPersonaAvatarBytes(tampered, descriptor), null,
  'the content hash must bind the exact raster bytes');

let request = null;
const loaded = await fetchVerifiedPersonaAvatar(descriptor, {
  expectedPersonaId: personaId,
  pinnedPublicKeyHex: hex(publicKey),
  providerBase: 'https://node.example/personas',
  pageUrl: 'https://ui.example/',
  fetchImpl: async (url, init) => {
    request = {url, init};
    return new Response(png, {headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
    }});
  },
});
assert.match(request.url, /^https:\/\/node\.example\/personas\/assets\/persona-avatars\//);
assert.equal(request.init.redirect, 'error');
assert.equal(request.init.credentials, 'omit');
assert.equal(request.init.referrerPolicy, 'no-referrer');
assert.equal(Object.hasOwn(request.init.headers, 'Authorization'), false);
assert.deepEqual(loaded.bytes, png);

console.log('persona-signed raster avatar tests passed');
