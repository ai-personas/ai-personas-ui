import assert from 'node:assert/strict';

import * as ed from '../assets/noble-ed25519.js';
import {
  fetchVerifiedPersonaAvatar,
  inspectPersonaAvatarBytes,
  normalizePersonaAvatar,
  personaAvatarIdentityPayload,
  personaAvatarSha256,
  personaIdentityKeyPin,
  resolvePersonaAvatarBodyUrl,
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
const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
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
assert.deepEqual(payload, {schema: 'persona-avatar-admission/1', descriptor: candidate});
const signature = await ed.signAsync(encoder.encode(canonical(payload)), privateKey);
const descriptor = {...candidate, identity_signature_hex: hex(signature)};

assert.deepEqual(normalizePersonaAvatar(descriptor), descriptor);
assert.deepEqual(await verifyPersonaAvatarDescriptor(descriptor, {
  expectedPersonaId: personaId,
  pinnedPublicKeyHex: hex(publicKey),
}), descriptor);
assert.equal(await verifyPersonaAvatarDescriptor(descriptor, {
  expectedPersonaId: `${personaId}X`,
}), null, 'descriptor must bind the displayed persona identity');
assert.equal(await verifyPersonaAvatarDescriptor(descriptor, {
  expectedPersonaId: personaId,
  pinnedPublicKeyHex: '33'.repeat(32),
}), null, 'an independently verified identity key must pin the descriptor key');
assert.equal(await verifyPersonaAvatarDescriptor({...descriptor, width: 2}, {
  expectedPersonaId: personaId,
}), null, 'persona signature must bind every descriptor fact');

for (const invalid of [
  {...descriptor, schema: 'persona-avatar/1'},
  {...descriptor, kind: 'identicon'},
  {...descriptor, body_path: `https://tracker.invalid/${digest}.png`},
  {...descriptor, body_path: `assets/persona-avatars/sha256/../${digest}.png`},
  {...descriptor, content_ref: `sha256:${'00'.repeat(32)}`},
  {...descriptor, mime_type: 'image/svg+xml'},
  {...descriptor, byte_length: 0},
  {...descriptor, width: 8193},
  {...descriptor, identity_public_key_hex: descriptor.identity_public_key_hex.toUpperCase()},
  {...descriptor, url: 'https://tracker.invalid/avatar.png'},
]) assert.equal(normalizePersonaAvatar(invalid), null);

assert.equal(personaIdentityKeyPin({
  kind: 'persona',
  identity_signing_key_id: `persona:${personaId}`,
  identity_public_key_hex: hex(publicKey),
}, personaId), hex(publicKey));
assert.equal(personaIdentityKeyPin({
  kind: 'persona',
  identity_signing_key_id: `persona:${personaId}X`,
  identity_public_key_hex: hex(publicKey),
}, personaId), '');

const providerBase = 'https://node.example/personaos';
const bodyUrl = `https://node.example/personaos/${candidate.body_path}`;
assert.equal(resolvePersonaAvatarBodyUrl(candidate.body_path, {
  providerBase,
  pageUrl: 'https://ui.example/network/',
}), bodyUrl);
assert.equal(resolvePersonaAvatarBodyUrl(candidate.body_path, {
  providerBase: 'https://user:secret@node.example/personaos',
  pageUrl: 'https://ui.example/',
}), '');
assert.equal(resolvePersonaAvatarBodyUrl(`/${candidate.body_path}`, {
  providerBase,
  pageUrl: 'https://ui.example/',
}), '');
assert.equal(resolvePersonaAvatarBodyUrl('assets/persona-avatars/sha256/not-a-hash.png', {
  providerBase,
  pageUrl: 'https://ui.example/',
}), '');

assert.deepEqual(inspectPersonaAvatarBytes(png), {
  mimeType: 'image/png', width: 1, height: 1, byteLength: png.byteLength,
});
const jpegHeader = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x02,
  0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
]);
assert.deepEqual(inspectPersonaAvatarBytes(jpegHeader), {
  mimeType: 'image/jpeg', width: 2, height: 1, byteLength: jpegHeader.byteLength,
});
const webpHeader = new Uint8Array(30);
webpHeader.set(Buffer.from('RIFF'), 0); webpHeader.set(Buffer.from('WEBP'), 8);
webpHeader.set(Buffer.from('VP8X'), 12); webpHeader[24] = 1; webpHeader[27] = 2;
assert.deepEqual(inspectPersonaAvatarBytes(webpHeader), {
  mimeType: 'image/webp', width: 2, height: 3, byteLength: webpHeader.byteLength,
});
assert.deepEqual(await verifyPersonaAvatarBytes(png, descriptor), {
  mimeType: 'image/png', width: 1, height: 1, byteLength: png.byteLength,
});
const tamperedPng = png.slice();
tamperedPng[tamperedPng.length - 1] ^= 0x01;
assert.equal(await verifyPersonaAvatarBytes(tamperedPng, descriptor), null,
  'raster hash must cover the exact fetched bytes');

let request = null;
const loaded = await fetchVerifiedPersonaAvatar(descriptor, {
  expectedPersonaId: personaId,
  pinnedPublicKeyHex: hex(publicKey),
  providerBase,
  pageUrl: 'https://ui.example/',
  fetchImpl: async (url, init) => {
    request = {url, init};
    return new Response(png, {headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
    }});
  },
});
assert.equal(request.url, bodyUrl);
assert.equal(request.init.redirect, 'error');
assert.equal(request.init.credentials, 'omit');
assert.equal(request.init.referrerPolicy, 'no-referrer');
assert.equal(Object.hasOwn(request.init.headers, 'Authorization'), false,
  'public avatar fetch must not carry operator authority');
assert.deepEqual(loaded.bytes, png);

await assert.rejects(fetchVerifiedPersonaAvatar(descriptor, {
  expectedPersonaId: personaId,
  providerBase,
  pageUrl: 'https://ui.example/',
  fetchImpl: async () => new Response(png, {headers: {
    'Content-Type': 'image/svg+xml',
    'Content-Length': String(png.byteLength),
  }}),
}), /MIME mismatch/);
await assert.rejects(fetchVerifiedPersonaAvatar(descriptor, {
  expectedPersonaId: personaId,
  providerBase,
  pageUrl: 'https://ui.example/',
  fetchImpl: async () => new Response(png, {headers: {
    'Content-Type': 'image/png',
    'Content-Length': String(png.byteLength + 1),
  }}),
}), /declared byte length mismatch/);
await assert.rejects(fetchVerifiedPersonaAvatar(descriptor, {
  expectedPersonaId: personaId,
  providerBase,
  pageUrl: 'https://ui.example/',
  fetchImpl: async () => ({ok: true, redirected: true, url: 'https://other.example/avatar.png'}),
}), /response refused/, 'redirected avatar responses must fail closed');

console.log('persona-signed content-addressed raster avatar contract: ok');
