import * as ed from './noble-ed25519.js';

const AVATAR_SCHEMA = 'persona-avatar/2';
const AVATAR_KIND = 'raster';
const AVATAR_ADMISSION_SCHEMA = 'persona-avatar-admission/1';
const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_128 = /^[0-9a-f]{128}$/;
const HASH_REF = /^sha256:[0-9a-f]{64}$/;
const PERSONA_ID = /^[^\u0000-\u0020/\\]{1,180}$/u;
const MIME_EXTENSIONS = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
});
const AVATAR_FIELDS = Object.freeze([
  'body_path',
  'byte_length',
  'character_prompt_hash',
  'content_ref',
  'height',
  'identity_public_key_hex',
  'identity_signature_hex',
  'identity_signing_key_id',
  'kind',
  'mime_type',
  'persona_id',
  'provenance_hash',
  'schema',
  'sha256',
  'width',
]);
const UNSIGNED_AVATAR_FIELDS = Object.freeze(
  AVATAR_FIELDS.filter((field) => field !== 'identity_signature_hex'),
);
const MAX_AVATAR_BYTES = 25 * 1024 * 1024;
const MAX_AVATAR_EDGE = 8192;
const MAX_AVATAR_PIXELS = 64 * 1024 * 1024;
const textEncoder = new TextEncoder();

function canonical(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hexToBytes(value) {
  const parts = String(value ?? '').match(/../g);
  return Uint8Array.from(parts ? parts.map((part) => Number.parseInt(part, 16)) : []);
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError('avatar bytes must be an ArrayBuffer or Uint8Array');
}

function hasExactFields(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((field, index) => field === expected[index]);
}

function expectedBodyPath(sha256, mimeType) {
  const extension = MIME_EXTENSIONS[mimeType];
  return extension ? `assets/persona-avatars/sha256/${sha256}.${extension}` : '';
}

export function normalizePersonaAvatar(value) {
  if (!hasExactFields(value, AVATAR_FIELDS)) return null;
  const sha256 = value.sha256;
  const mimeType = value.mime_type;
  const personaId = value.persona_id;
  const byteLength = value.byte_length;
  const width = value.width;
  const height = value.height;
  if (value.schema !== AVATAR_SCHEMA || value.kind !== AVATAR_KIND
      || typeof sha256 !== 'string' || !HEX_64.test(sha256)
      || !Object.hasOwn(MIME_EXTENSIONS, mimeType)
      || typeof personaId !== 'string' || !PERSONA_ID.test(personaId)
      || value.identity_signing_key_id !== `persona:${personaId}`
      || typeof value.identity_public_key_hex !== 'string'
      || !HEX_64.test(value.identity_public_key_hex)
      || typeof value.identity_signature_hex !== 'string'
      || !HEX_128.test(value.identity_signature_hex)
      || value.content_ref !== `sha256:${sha256}`
      || typeof value.character_prompt_hash !== 'string'
      || !HASH_REF.test(value.character_prompt_hash)
      || typeof value.provenance_hash !== 'string'
      || !HASH_REF.test(value.provenance_hash)
      || value.body_path !== expectedBodyPath(sha256, mimeType)
      || !Number.isInteger(byteLength) || byteLength < 1 || byteLength > MAX_AVATAR_BYTES
      || !Number.isInteger(width) || !Number.isInteger(height)
      || width < 1 || height < 1 || width > MAX_AVATAR_EDGE || height > MAX_AVATAR_EDGE
      || width * height > MAX_AVATAR_PIXELS) return null;
  return Object.freeze(Object.fromEntries(AVATAR_FIELDS.map((field) => [field, value[field]])));
}

export function personaAvatarIdentityPayload(value) {
  const descriptor = hasExactFields(value, UNSIGNED_AVATAR_FIELDS)
    ? normalizePersonaAvatar({...value, identity_signature_hex: '0'.repeat(128)})
    : normalizePersonaAvatar(value);
  if (!descriptor) return null;
  return Object.freeze({
    schema: AVATAR_ADMISSION_SCHEMA,
    descriptor: Object.freeze(Object.fromEntries(
      UNSIGNED_AVATAR_FIELDS.map((field) => [field, descriptor[field]]),
    )),
  });
}

export async function verifyPersonaAvatarDescriptor(value, {
  expectedPersonaId = '',
  pinnedPublicKeyHex = '',
} = {}) {
  const descriptor = normalizePersonaAvatar(value);
  if (!descriptor || (expectedPersonaId && descriptor.persona_id !== expectedPersonaId)) {
    return null;
  }
  if (pinnedPublicKeyHex
      && (!HEX_64.test(pinnedPublicKeyHex)
        || descriptor.identity_public_key_hex !== pinnedPublicKeyHex)) return null;
  try {
    const ok = await ed.verifyAsync(
      hexToBytes(descriptor.identity_signature_hex),
      textEncoder.encode(canonical(personaAvatarIdentityPayload(descriptor))),
      hexToBytes(descriptor.identity_public_key_hex),
    );
    return ok ? descriptor : null;
  } catch (_error) {
    return null;
  }
}

// Some signed persona records may expose the identity key independently of the
// avatar descriptor. Callers must pass only a record whose outer signature was
// already verified; this helper merely validates the claim's exact binding.
export function personaIdentityKeyPin(record, expectedPersonaId = '') {
  if (!record || record.kind !== 'persona' || !expectedPersonaId) return '';
  const keyId = record.identity_signing_key_id;
  const publicKeyHex = record.identity_public_key_hex;
  return keyId === `persona:${expectedPersonaId}`
    && typeof publicKeyHex === 'string' && HEX_64.test(publicKeyHex)
    ? publicKeyHex : '';
}

export function resolvePersonaAvatarBodyUrl(bodyPath, {
  providerBase = '',
  pageUrl = '',
} = {}) {
  if (typeof bodyPath !== 'string' || !/^assets\/persona-avatars\/sha256\/[0-9a-f]{64}\.(png|jpg|webp)$/.test(bodyPath)) {
    return '';
  }
  let base;
  try {
    const page = new URL(pageUrl || globalThis.location?.href || '');
    base = providerBase ? new URL(providerBase, page) : new URL('/', page);
  } catch (_error) {
    return '';
  }
  if (!/^https?:$/.test(base.protocol) || base.username || base.password
      || base.search || base.hash) return '';
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/`;
  let target;
  try {
    target = new URL(bodyPath, base);
  } catch (_error) {
    return '';
  }
  const expectedPath = `${base.pathname}${bodyPath}`.replace(/\/{2,}/g, '/');
  return target.protocol === base.protocol && target.origin === base.origin
    && !target.username && !target.password && !target.search && !target.hash
    && target.pathname === expectedPath
    ? target.href : '';
}

function pngDimensions(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  if (bytes.length < 24 || bytes[12] !== 0x49 || bytes[13] !== 0x48
      || bytes[14] !== 0x44 || bytes[15] !== 0x52) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {mimeType: 'image/png', width: view.getUint32(16), height: view.getUint32(20)};
}

function jpegDimensions(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) break;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (sof.has(marker)) {
      if (segmentLength < 7) return null;
      return {
        mimeType: 'image/jpeg',
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes) {
  const ascii = (offset, value) => Array.from(value).every((char, index) =>
    bytes[offset + index] === char.charCodeAt(0));
  if (bytes.length < 30 || !ascii(0, 'RIFF') || !ascii(8, 'WEBP')) return null;
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === 'VP8X') {
    return {
      mimeType: 'image/webp',
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const [b0, b1, b2, b3] = bytes.subarray(21, 25);
    return {
      mimeType: 'image/webp',
      width: 1 + b0 + ((b1 & 0x3f) << 8),
      height: 1 + ((b1 & 0xc0) >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10),
    };
  }
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      mimeType: 'image/webp',
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  return null;
}

export function inspectPersonaAvatarBytes(value) {
  const bytes = asBytes(value);
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) return null;
  const dimensions = pngDimensions(bytes) || jpegDimensions(bytes) || webpDimensions(bytes);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1
      || dimensions.width > MAX_AVATAR_EDGE || dimensions.height > MAX_AVATAR_EDGE
      || dimensions.width * dimensions.height > MAX_AVATAR_PIXELS) return null;
  return Object.freeze({...dimensions, byteLength: bytes.byteLength});
}

export async function personaAvatarSha256(value) {
  const bytes = asBytes(value);
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPersonaAvatarBytes(value, descriptorValue) {
  const descriptor = normalizePersonaAvatar(descriptorValue);
  if (!descriptor) return null;
  const bytes = asBytes(value);
  const inspected = inspectPersonaAvatarBytes(bytes);
  if (!inspected || inspected.byteLength !== descriptor.byte_length
      || inspected.mimeType !== descriptor.mime_type
      || inspected.width !== descriptor.width || inspected.height !== descriptor.height
      || await personaAvatarSha256(bytes) !== descriptor.sha256) return null;
  return inspected;
}

async function readExactResponseBytes(response, expectedLength) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== expectedLength) throw new Error('avatar byte length mismatch');
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > expectedLength || total > MAX_AVATAR_BYTES) {
        await reader.cancel();
        throw new Error('avatar byte length mismatch');
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch (_error) { /* no-op */ }
  }
  if (total !== expectedLength) throw new Error('avatar byte length mismatch');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchVerifiedPersonaAvatar(value, {
  expectedPersonaId = '',
  pinnedPublicKeyHex = '',
  providerBase = '',
  pageUrl = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const descriptor = await verifyPersonaAvatarDescriptor(value, {
    expectedPersonaId,
    pinnedPublicKeyHex,
  });
  if (!descriptor) throw new Error('avatar identity signature refused');
  const sourceUrl = resolvePersonaAvatarBodyUrl(descriptor.body_path, {providerBase, pageUrl});
  if (!sourceUrl || typeof fetchImpl !== 'function') throw new Error('avatar body path refused');
  const response = await fetchImpl(sourceUrl, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    headers: {Accept: descriptor.mime_type},
  });
  if (!response?.ok || response.redirected || (response.url && response.url !== sourceUrl)) {
    throw new Error('avatar response refused');
  }
  const contentEncoding = String(response.headers?.get('content-encoding') || '').trim().toLowerCase();
  if (contentEncoding && contentEncoding !== 'identity') throw new Error('encoded avatar body refused');
  const mimeType = String(response.headers?.get('content-type') || '')
    .split(';', 1)[0].trim().toLowerCase();
  if (mimeType !== descriptor.mime_type || !Object.hasOwn(MIME_EXTENSIONS, mimeType)) {
    throw new Error('avatar MIME mismatch');
  }
  const declaredLength = String(response.headers?.get('content-length') || '').trim();
  if (declaredLength && (!/^\d+$/.test(declaredLength)
      || Number(declaredLength) !== descriptor.byte_length)) {
    throw new Error('avatar declared byte length mismatch');
  }
  const bytes = await readExactResponseBytes(response, descriptor.byte_length);
  if (!await verifyPersonaAvatarBytes(bytes, descriptor)) throw new Error('avatar bytes refused');
  return Object.freeze({descriptor, bytes, sourceUrl});
}

export const PERSONA_AVATAR_CONTRACT = Object.freeze({
  schema: AVATAR_SCHEMA,
  kind: AVATAR_KIND,
  admissionSchema: AVATAR_ADMISSION_SCHEMA,
  mimeTypes: Object.freeze(Object.keys(MIME_EXTENSIONS)),
  maxBytes: MAX_AVATAR_BYTES,
  maxEdge: MAX_AVATAR_EDGE,
  maxPixels: MAX_AVATAR_PIXELS,
});
