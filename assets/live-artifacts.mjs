const MAX_DIFF_LINES = 180;
const MAX_DIFF_CHARS = 48 * 1024;
export const LIVE_ARTIFACT_LIMITS = Object.freeze({
  maxFiles: 512,
  maxWorkspaces: 64,
  maxActiveCalls: 64,
  maxPathDepth: 16,
  maxPathLength: 512,
  maxBodyUrlLength: 2048,
  // Body materialization stays deliberately small. Metadata for a signed
  // snapshot may describe larger opaque outputs without making the browser
  // fetch those bytes for a preview.
  maxFileBytes: 8 * 1024 * 1024,
  maxAdvertisedFileBytes: 512 * 1024 * 1024,
  maxSnapshotBytes: 2 * 1024 * 1024,
  maxDownloadBytes: 32 * 1024 * 1024,
  maxArtifactRoles: 16,
  maxArtifactCapabilities: 24,
  maxArtifactSemanticLength: 160,
});
const SHA256_K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));

function sha256Fallback(buffer) {
  const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const total = Math.ceil((source.length + 9) / 64) * 64;
  const padded = new Uint8Array(total);
  padded.set(source);
  padded[source.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(total - 8, Math.floor(source.length / 0x20000000), false);
  view.setUint32(total - 4, (source.length << 3) >>> 0, false);
  const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < total; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,q] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (q + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      q=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0;
    h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+q)>>>0;
  }
  return [...h].map((value) => value.toString(16).padStart(8, '0')).join('');
}

export async function sha256Hex(buffer) {
  if (globalThis.crypto?.subtle) {
    try {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
      return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      // Non-secure intranet contexts may expose crypto without SubtleCrypto access.
    }
  }
  return sha256Fallback(buffer);
}

// SHA-512 for the same reason as the SHA-256 fallback above: a node-served
// shell reached over plain HTTP on a LAN address is not a browser "secure
// context", so `crypto.subtle` is absent even though `crypto` exists. Ed25519
// verification hashes with SHA-512, so without this every signature check on
// such an origin throws and byte-identical documents that verify over loopback
// are reported as `*_signature_invalid`. This computes the same digest the
// platform would; it verifies nothing less and grants nothing.
const SHA512_K = new Uint32Array([  // hi,lo pairs of the 80 SHA-512 round constants
  0x428a2f98,0xd728ae22,0x71374491,0x23ef65cd,0xb5c0fbcf,0xec4d3b2f,0xe9b5dba5,0x8189dbbc,
  0x3956c25b,0xf348b538,0x59f111f1,0xb605d019,0x923f82a4,0xaf194f9b,0xab1c5ed5,0xda6d8118,
  0xd807aa98,0xa3030242,0x12835b01,0x45706fbe,0x243185be,0x4ee4b28c,0x550c7dc3,0xd5ffb4e2,
  0x72be5d74,0xf27b896f,0x80deb1fe,0x3b1696b1,0x9bdc06a7,0x25c71235,0xc19bf174,0xcf692694,
  0xe49b69c1,0x9ef14ad2,0xefbe4786,0x384f25e3,0x0fc19dc6,0x8b8cd5b5,0x240ca1cc,0x77ac9c65,
  0x2de92c6f,0x592b0275,0x4a7484aa,0x6ea6e483,0x5cb0a9dc,0xbd41fbd4,0x76f988da,0x831153b5,
  0x983e5152,0xee66dfab,0xa831c66d,0x2db43210,0xb00327c8,0x98fb213f,0xbf597fc7,0xbeef0ee4,
  0xc6e00bf3,0x3da88fc2,0xd5a79147,0x930aa725,0x06ca6351,0xe003826f,0x14292967,0x0a0e6e70,
  0x27b70a85,0x46d22ffc,0x2e1b2138,0x5c26c926,0x4d2c6dfc,0x5ac42aed,0x53380d13,0x9d95b3df,
  0x650a7354,0x8baf63de,0x766a0abb,0x3c77b2a8,0x81c2c92e,0x47edaee6,0x92722c85,0x1482353b,
  0xa2bfe8a1,0x4cf10364,0xa81a664b,0xbc423001,0xc24b8b70,0xd0f89791,0xc76c51a3,0x0654be30,
  0xd192e819,0xd6ef5218,0xd6990624,0x5565a910,0xf40e3585,0x5771202a,0x106aa070,0x32bbd1b8,
  0x19a4c116,0xb8d2d0c8,0x1e376c08,0x5141ab53,0x2748774c,0xdf8eeb99,0x34b0bcb5,0xe19b48a8,
  0x391c0cb3,0xc5c95a63,0x4ed8aa4a,0xe3418acb,0x5b9cca4f,0x7763e373,0x682e6ff3,0xd6b2b8a3,
  0x748f82ee,0x5defb2fc,0x78a5636f,0x43172f60,0x84c87814,0xa1f0ab72,0x8cc70208,0x1a6439ec,
  0x90befffa,0x23631e28,0xa4506ceb,0xde82bde9,0xbef9a3f7,0xb2c67915,0xc67178f2,0xe372532b,
  0xca273ece,0xea26619c,0xd186b8c7,0x21c0c207,0xeada7dd6,0xcde0eb1e,0xf57d4f7f,0xee6ed178,
  0x06f067aa,0x72176fba,0x0a637dc5,0xa2c898a6,0x113f9804,0xbef90dae,0x1b710b35,0x131c471b,
  0x28db77f5,0x23047d84,0x32caab7b,0x40c72493,0x3c9ebe0a,0x15c9bebc,0x431d67c4,0x9c100d4c,
  0x4cc5d4be,0xcb3e42b6,0x597f299c,0xfc657e2a,0x5fcb6fab,0x3ad6faec,0x6c44198c,0x4a475817,
]);
const SHA512_H = new Uint32Array([
  0x6a09e667,0xf3bcc908,0xbb67ae85,0x84caa73b,0x3c6ef372,0xfe94f82b,0xa54ff53a,0x5f1d36f1,
  0x510e527f,0xade682d1,0x9b05688c,0x2b3e6c1f,0x1f83d9ab,0xfb41bd6b,0x5be0cd19,0x137e2179,
]);

export function sha512Fallback(buffer) {
  const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const total = Math.ceil((source.length + 17) / 128) * 128;
  const padded = new Uint8Array(total);
  padded.set(source);
  padded[source.length] = 0x80;
  const view = new DataView(padded.buffer);
  // 128-bit big-endian bit length. A browser document is far below 2^61 bytes,
  // so only the low 64 bits can be non-zero.
  view.setUint32(total - 8, Math.floor(source.length / 0x20000000), false);
  view.setUint32(total - 4, (source.length * 8) >>> 0, false);
  const hh = new Uint32Array(8), hl = new Uint32Array(8);
  for (let i = 0; i < 8; i++) { hh[i] = SHA512_H[i * 2]; hl[i] = SHA512_H[i * 2 + 1]; }
  const wh = new Uint32Array(80), wl = new Uint32Array(80);
  for (let offset = 0; offset < total; offset += 128) {
    for (let i = 0; i < 16; i++) {
      wh[i] = view.getUint32(offset + i * 8, false);
      wl[i] = view.getUint32(offset + i * 8 + 4, false);
    }
    for (let i = 16; i < 80; i++) {
      const h15 = wh[i - 15], l15 = wl[i - 15];
      const s0h = ((h15 >>> 1) | (l15 << 31)) ^ ((h15 >>> 8) | (l15 << 24)) ^ (h15 >>> 7);
      const s0l = ((l15 >>> 1) | (h15 << 31)) ^ ((l15 >>> 8) | (h15 << 24)) ^ ((l15 >>> 7) | (h15 << 25));
      const h2 = wh[i - 2], l2 = wl[i - 2];
      const s1h = ((h2 >>> 19) | (l2 << 13)) ^ ((l2 >>> 29) | (h2 << 3)) ^ (h2 >>> 6);
      const s1l = ((l2 >>> 19) | (h2 << 13)) ^ ((h2 >>> 29) | (l2 << 3)) ^ ((l2 >>> 6) | (h2 << 26));
      const low = (wl[i - 16] >>> 0) + (s0l >>> 0) + (wl[i - 7] >>> 0) + (s1l >>> 0);
      wl[i] = low >>> 0;
      wh[i] = (wh[i - 16] + s0h + wh[i - 7] + s1h + Math.floor(low / 0x100000000)) >>> 0;
    }
    let ah = hh[0], al = hl[0], bh = hh[1], bl = hl[1], ch = hh[2], cl = hl[2];
    let dh = hh[3], dl = hl[3], eh = hh[4], el = hl[4], fh = hh[5], fl = hl[5];
    let gh = hh[6], gl = hl[6], qh = hh[7], ql = hl[7];
    for (let i = 0; i < 80; i++) {
      const s1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
      const s1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
      const chh = (eh & fh) ^ (~eh & gh);
      const chl = (el & fl) ^ (~el & gl);
      const t1l = (ql >>> 0) + (s1l >>> 0) + (chl >>> 0)
        + (SHA512_K[i * 2 + 1] >>> 0) + (wl[i] >>> 0);
      const t1h = (qh + s1h + chh + SHA512_K[i * 2] + wh[i] + Math.floor(t1l / 0x100000000)) >>> 0;
      const s0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
      const s0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
      const majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const majl = (al & bl) ^ (al & cl) ^ (bl & cl);
      const t2l = (s0l >>> 0) + (majl >>> 0);
      const t2h = (s0h + majh + Math.floor(t2l / 0x100000000)) >>> 0;
      qh = gh; ql = gl; gh = fh; gl = fl; fh = eh; fl = el;
      const eLow = (dl >>> 0) + (t1l >>> 0);
      eh = (dh + t1h + Math.floor(eLow / 0x100000000)) >>> 0; el = eLow >>> 0;
      dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al;
      const aLow = (t1l >>> 0) + (t2l >>> 0);
      ah = (t1h + t2h + Math.floor(aLow / 0x100000000)) >>> 0; al = aLow >>> 0;
    }
    const nextH = [ah, bh, ch, dh, eh, fh, gh, qh], nextL = [al, bl, cl, dl, el, fl, gl, ql];
    for (let i = 0; i < 8; i++) {
      const low = (hl[i] >>> 0) + (nextL[i] >>> 0);
      hl[i] = low >>> 0;
      hh[i] = (hh[i] + nextH[i] + Math.floor(low / 0x100000000)) >>> 0;
    }
  }
  const digest = new Uint8Array(64);
  const out = new DataView(digest.buffer);
  for (let i = 0; i < 8; i++) { out.setUint32(i * 8, hh[i], false); out.setUint32(i * 8 + 4, hl[i], false); }
  return digest;
}

// Ed25519 verification is only as available as its hash. Install the fallback
// digest on the vendored curve implementation when — and only when — the
// platform withholds SubtleCrypto; a secure context keeps using the native one.
export function installEd25519HashFallback(etc) {
  if (!etc || globalThis.crypto?.subtle || etc._sha512FallbackInstalled) return false;
  const native = etc.sha512Async;
  etc.sha512Async = async (...messages) => {
    if (globalThis.crypto?.subtle) {
      try { return await native(...messages); } catch (_) { /* platform withdrew SubtleCrypto */ }
    }
    let length = 0;
    for (const message of messages) length += message.length;
    const joined = new Uint8Array(length);
    let at = 0;
    for (const message of messages) { joined.set(message, at); at += message.length; }
    return sha512Fallback(joined);
  };
  etc._sha512FallbackInstalled = true;
  return true;
}

export function liveArtifactFileKey(file) {
  return `${String(file?.workspace_id || '')}\u0000${String(file?.path || '')}`;
}

export function liveArtifactRunKey(base, run, origin = '') {
  const resolved = String(base || origin || '').replace(/\/$/, '');
  return `${resolved}\u0000${String(run || '')}`;
}

function semanticText(value) {
  if (typeof value !== 'string' || value.length > LIVE_ARTIFACT_LIMITS.maxArtifactSemanticLength * 4) return '';
  const text=value.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim();
  return text && text.length <= LIVE_ARTIFACT_LIMITS.maxArtifactSemanticLength ? text : '';
}

function semanticList(value, limit) {
  if (value === undefined || value === null) return {values: [], valid: true};
  if (!Array.isArray(value) || value.length > limit) return {values: [], valid: false};
  const values=[];
  for (const raw of value) {
    const text=semanticText(raw);
    if (!text) return {values: [], valid: false};
    if (!values.includes(text)) values.push(text);
  }
  return {values, valid: true};
}

export function sanitizeArtifactSemantics(value) {
  const source=value && typeof value==='object' ? value : {};
  const rolePresent=Object.prototype.hasOwnProperty.call(source,'role_in_bundle');
  const role=rolePresent?semanticText(source.role_in_bundle):'';
  if (rolePresent && source.role_in_bundle !== '' && !role) return {};
  const roles=semanticList(source.artifact_roles,LIVE_ARTIFACT_LIMITS.maxArtifactRoles);
  const capabilities=semanticList(source.capability_summary,LIVE_ARTIFACT_LIMITS.maxArtifactCapabilities);
  if (!roles.valid || !capabilities.valid) return {};
  if (role && roles.values.length && !roles.values.includes(role)) return {};
  const artifactRoles=[...roles.values];
  if (role && !artifactRoles.includes(role)) artifactRoles.unshift(role);
  const capabilitySummary=[...capabilities.values];
  for (const item of artifactRoles) if (!capabilitySummary.includes(item)) capabilitySummary.push(item);
  const out={};
  if (role || artifactRoles.length) out.role_in_bundle=role||artifactRoles[0];
  if (artifactRoles.length) out.artifact_roles=artifactRoles;
  if (capabilitySummary.length) out.capability_summary=capabilitySummary;
  return out;
}

export function artifactSemanticLabels(value) {
  const clean=sanitizeArtifactSemantics(value);
  const out=[];
  for (const item of [clean.role_in_bundle,...(clean.artifact_roles||[]),...(clean.capability_summary||[])]) {
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

function artifactSemanticKey(value) {
  return JSON.stringify(sanitizeArtifactSemantics(value));
}

function snapshotFileByteLimit(snapshot) {
  const value = snapshot?.limits?.max_file_bytes;
  if (!Number.isSafeInteger(value) || value < 1) return LIVE_ARTIFACT_LIMITS.maxFileBytes;
  return Math.min(value, LIVE_ARTIFACT_LIMITS.maxAdvertisedFileBytes);
}

function liveArtifactCaptureBoundary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.schema !== 'personaos-live-artifact-capture-boundary/1'
      || !['authenticated_call_completion', 'authenticated_active_native_call_observation']
        .includes(value.state)
      || typeof value.in_call_file_streaming !== 'boolean') return null;
  const provisionalPresent = Object.prototype.hasOwnProperty.call(value, 'provisional');
  if (provisionalPresent && typeof value.provisional !== 'boolean') return null;
  if (value.provisional === true
      && value.state !== 'authenticated_active_native_call_observation') return null;
  return {
    schema: value.schema,
    state: value.state,
    in_call_file_streaming: value.in_call_file_streaming,
    ...(provisionalPresent ? {provisional: value.provisional} : {}),
  };
}

function publicFile(file, maxAdvertisedBytes) {
  if (!file || typeof file !== 'object') return null;
  const workspaceId = String(file.workspace_id || '');
  const path = String(file.path || '');
  const sha256 = String(file.sha256 || '').replace(/^sha256:/, '').toLowerCase();
  const bodyUrl = String(file.body_url || '');
  const sizeBytes = Number(file.size_bytes);
  const parts = path.split('/');
  if (!workspaceId || workspaceId.length > 128 || !path || path.length > LIVE_ARTIFACT_LIMITS.maxPathLength
      || path.startsWith('/') || path.includes('\\') || parts.length > LIVE_ARTIFACT_LIMITS.maxPathDepth
      || parts.some((part) => !part || part === '.' || part === '..')
      || !bodyUrl || bodyUrl.length > LIVE_ARTIFACT_LIMITS.maxBodyUrlLength
      || !Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > maxAdvertisedBytes
      || !/^[0-9a-f]{64}$/.test(sha256)) return null;
  const clean={...file, workspace_id: workspaceId, path, body_url: bodyUrl,
    size_bytes: sizeBytes, sha256};
  delete clean.role_in_bundle; delete clean.artifact_roles; delete clean.capability_summary;
  Object.assign(clean,sanitizeArtifactSemantics(file));
  return clean;
}

export function sanitizeLiveArtifactSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  // `limits` is covered by the snapshot signature before this sanitizer is
  // reached. Bound it again locally so even a malformed caller can never raise
  // metadata admission beyond the kernel's hard ceiling.
  const maxAdvertisedBytes = snapshotFileByteLimit(source);
  const files = [];
  let rejected = 0;
  const rawFiles = Array.isArray(source.files) ? source.files : [];
  for (const raw of rawFiles) {
    if (files.length >= LIVE_ARTIFACT_LIMITS.maxFiles) { rejected++; continue; }
    const file = publicFile(raw, maxAdvertisedBytes);
    if (file) files.push(file); else rejected++;
  }
  const workspaces = (Array.isArray(source.workspaces) ? source.workspaces : [])
    .slice(0, LIVE_ARTIFACT_LIMITS.maxWorkspaces)
    .filter((item) => item && typeof item === 'object' && String(item.workspace_id || '').length <= 128)
    .map((item) => ({...item, workspace_id: String(item.workspace_id || '')}));
  const active = source.active && typeof source.active === 'object' ? source.active : {};
  const calls = (Array.isArray(active.calls) ? active.calls : [])
    .slice(0, LIVE_ARTIFACT_LIMITS.maxActiveCalls)
    .filter((item) => item && typeof item === 'object');
  const captureBoundary = liveArtifactCaptureBoundary(source.capture_boundary);
  return {
    schema: String(source.schema || ''),
    node_id: String(source.node_id || ''),
    run: String(source.run || ''),
    task: String(source.task || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    generated_at: String(source.generated_at || ''),
    revision: String(source.revision || ''),
    visibility_tier: String(source.visibility_tier || ''),
    active: {...active, calls},
    workspaces,
    file_count: Number.isSafeInteger(source.file_count) ? source.file_count : rawFiles.length,
    indexed_file_count: files.length,
    total_size_bytes: files.reduce((total, file) => total + file.size_bytes, 0),
    limits: {max_file_bytes: maxAdvertisedBytes},
    ...(captureBoundary ? {capture_boundary: captureBoundary} : {}),
    files,
    truncated: Boolean(source.truncated || rejected),
    omitted_file_count: Math.max(Number(source.omitted_file_count) || 0, 0) + rejected,
    client_omitted_file_count: rejected,
    omitted_reasons: source.omitted_reasons && typeof source.omitted_reasons === 'object'
      ? source.omitted_reasons : {},
  };
}

export function decideLiveArtifactUpdate(previous, snapshot, meta = {}) {
  if (!snapshot || snapshot.schema !== 'personaos-live-artifacts/1'
      || !snapshot.run || !snapshot.revision) return {accept: false, reason: 'invalid_snapshot'};
  if (previous?.ended || meta.ended) return {accept: false, reason: 'run_ended'};
  const revision = String(snapshot.revision);
  if (meta.requestGeneration != null && meta.latestRequestGeneration != null
      && meta.requestGeneration < meta.latestRequestGeneration) {
    return {accept: false, reason: 'stale_request_generation'};
  }
  if (meta.source === 'poll' && previous && meta.startedRevision != null
      && String(meta.startedRevision) !== String(previous.revision || '')) {
    return {accept: false, reason: 'state_advanced_while_polling'};
  }
  if (previous && revision === String(previous.revision || '')) return {accept: true, refresh: true};
  if (meta.source === 'sse' && previous) {
    const prior = meta.previousRevision == null ? '' : String(meta.previousRevision);
    if (prior && prior !== String(previous.revision || '')) {
      return {accept: false, reason: 'broken_revision_chain'};
    }
    if (!prior) {
      const incomingTime = Date.parse(snapshot.generated_at || '');
      const currentTime = Date.parse(previous.generatedAt || previous.snapshot?.generated_at || '');
      if (!Number.isFinite(incomingTime) || !Number.isFinite(currentTime) || incomingTime <= currentTime) {
        return {accept: false, reason: 'unordered_sse_snapshot'};
      }
    }
  }
  return {accept: true, refresh: false};
}

export function endLiveArtifactState(previous, event = {}, verification = {}) {
  if (!previous) return null;
  if (String(event.previous_revision || '') !== String(previous.revision || '')) return null;
  const workspaces = previous.snapshot?.workspaces;
  const immutableFinalized = previous.finalized === true
    && previous.terminalKind === 'immutable_finalized_snapshot'
    && previous.verification?.immutableFinalizedBootstrap === true
    && Array.isArray(workspaces) && workspaces.length > 0
    && workspaces.every((workspace) => workspace?.state === 'run_finalized');
  // A later signature-checked terminal frame confirms transport quiescence; it
  // cannot weaken an immutable finalized snapshot that already binds the exact
  // workspace states and bytes. Keep that stronger state and its verification
  // metadata intact while the caller records terminalEventVerified.
  if (immutableFinalized) return {...previous};
  const snapshot = previous.snapshot && typeof previous.snapshot === 'object'
    ? {
      ...previous.snapshot,
      active: {...(previous.snapshot.active || {}), calls: [], persona_ids: [], environment_ids: []},
      workspaces: Array.isArray(previous.snapshot.workspaces)
        ? previous.snapshot.workspaces.map((workspace) => ({
          ...workspace, active_call_ids: [], state: 'run_ended',
        }))
        : previous.snapshot.workspaces,
    }
    : previous.snapshot;
  return {...previous, snapshot, ended: true,
    endedAt: String(event.generated_at || event.ended_at || ''),
    endReason: String(event.reason || event.status || 'run ended'),
    terminalState: String(verification.terminalState || ''),
    terminalStatus: String(verification.terminalStatus || '')};
}

export function terminalLiveArtifactCalls(...states) {
  return states.flatMap((state) => {
    const calls=state?.snapshot?.active?.calls;
    return Array.isArray(calls)
      ?calls.filter((call)=>call&&typeof call==='object'):[];
  });
}

export function finalizeLiveArtifactState(previous, verification = {}) {
  if (!previous || verification?.ok !== true
      || verification?.immutableFinalizedBootstrap !== true) return null;
  const finalizedAt = String(verification.finalizedAt || '');
  const workspaces = previous.snapshot?.workspaces;
  if (!finalizedAt || finalizedAt !== String(previous.generatedAt || '')
      || !Array.isArray(workspaces) || workspaces.length === 0
      || workspaces.some((workspace) => workspace?.state !== 'run_finalized')) return null;
  const snapshot = previous.snapshot && typeof previous.snapshot === 'object'
    ? {
      ...previous.snapshot,
      active: {...(previous.snapshot.active || {}), calls: [], persona_ids: [], environment_ids: []},
      workspaces: workspaces.map((workspace) => ({...workspace, active_call_ids: []})),
    }
    : previous.snapshot;
  return {...previous, snapshot, ended: true, finalized: true,
    terminalKind: 'immutable_finalized_snapshot', endedAt: finalizedAt,
    endReason: 'run finalized',
    terminalState: String(verification.terminalState || ''),
    terminalStatus: String(verification.terminalStatus || '')};
}

export function liveBodyCommitIsCurrent(expected, current, openFile) {
  if (!expected || !current) return false;
  // A body request started while the run was active must never commit after a
  // terminal event, even if the final revision retained the same hash. A new
  // request started from the signature-checked final revision is safe: terminal states
  // are immutable and still bind the exact advertised file bytes.
  if (current.ended && (!expected.terminalAtStart
      || String(expected.endedAt || '') !== String(current.endedAt || ''))) return false;
  if (!current.ended && expected.terminalAtStart) return false;
  const key = `${String(expected.workspace_id || '')}\u0000${String(expected.path || '')}`;
  const file = current.files instanceof Map ? current.files.get(key) : null;
  return Boolean(file && file.sha256 === expected.sha256
    && String(current.revision || '') === String(expected.revision || '')
    && (!openFile || (openFile.bodyKey === expected.bodyKey && openFile.hash === expected.sha256)));
}

export function transitionLiveArtifacts(previous, snapshot) {
  const clean = sanitizeLiveArtifactSnapshot(snapshot);
  const files = new Map();
  for (const file of clean.files) files.set(liveArtifactFileKey(file), file);
  const prior = previous?.files instanceof Map ? previous.files : new Map();
  const created = [];
  const modified = [];
  const deleted = [];
  for (const [key, file] of files) {
    const old = prior.get(key);
    if (!old) created.push(file);
    else if (old.sha256 !== file.sha256 || old.size_bytes !== file.size_bytes || old.mtime !== file.mtime
        || artifactSemanticKey(old) !== artifactSemanticKey(file)) {
      modified.push({...file, previous: old, contentChanged: old.sha256 !== file.sha256});
    }
  }
  for (const [key, file] of prior) if (!files.has(key)) deleted.push(file);
  const byPath = (a, b) => liveArtifactFileKey(a).localeCompare(liveArtifactFileKey(b));
  created.sort(byPath);
  modified.sort(byPath);
  deleted.sort(byPath);
  return {
    base: previous?.base || '',
    run: String(clean.run || previous?.run || ''),
    revision: String(clean.revision || ''),
    generatedAt: String(clean.generated_at || ''),
    snapshot: clean,
    files,
    changes: {baseline: !previous, created, modified, deleted},
    changed: !previous || String(previous.revision || '') !== String(clean.revision || ''),
  };
}

function boundedLines(value) {
  const text = String(value ?? '');
  const clipped = text.length > MAX_DIFF_CHARS;
  const source = text.slice(0, MAX_DIFF_CHARS);
  const all = source.split(/\r?\n/);
  return {lines: all.slice(0, MAX_DIFF_LINES), truncated: clipped || all.length > MAX_DIFF_LINES};
}

export function boundedLineDiff(previousText, currentText) {
  const before = boundedLines(previousText);
  const after = boundedLines(currentText);
  const a = before.lines;
  const b = after.lines;
  const table = Array.from({length: a.length + 1}, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  let left = 1;
  let right = 1;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      rows.push({kind: 'same', text: a[i], left: left++, right: right++});
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || table[i][j + 1] >= table[i + 1][j])) {
      rows.push({kind: 'add', text: b[j++], left: null, right: right++});
    } else {
      rows.push({kind: 'del', text: a[i++], left: left++, right: null});
    }
  }
  return {rows, truncated: before.truncated || after.truncated};
}
