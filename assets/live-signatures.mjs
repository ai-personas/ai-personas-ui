import * as ed from './noble-ed25519.js';

const encoder = new TextEncoder();
const POLICY_FIELDS = Object.freeze([
  'schema',
  'policy_id',
  'subject_kind',
  'subject_id',
  'owner_persona_id',
  'access_grants',
  'outward_tier',
  'cross_tenant_agreement_ref',
]);
const GRANT_FIELDS = Object.freeze([
  'schema',
  'grantee_kind',
  'grantee_id',
  'access_level',
  'scope_kind',
  'scope_id',
  'reason',
  'expires_at',
  'attestation_id',
]);
const REVISION_RE = /^sha256:[0-9a-f]{64}$/;
const HEX_KEY_RE = /^[0-9a-f]{64}$/i;
const HEX_SIGNATURE_RE = /^[0-9a-f]{128}$/i;

export function canonicalJson(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const failed = (reason) => ({ok: false, reason});

function bytesFromHex(value, pattern) {
  const text = String(value || '');
  if (!pattern.test(text)) return null;
  return Uint8Array.from(text.match(/.{2}/g).map((part) => Number.parseInt(part, 16)));
}

export function liveMetadataSigningPayload(document) {
  if (!isObject(document)) return null;
  return Object.fromEntries(Object.entries(document).filter(([key]) => key !== 'signature_hex'));
}

function exactFields(source, fields) {
  if (!isObject(source) || fields.some((field) => !Object.hasOwn(source, field))) return null;
  return Object.fromEntries(fields.map((field) => [field, source[field]]));
}

export function liveAccessPolicySigningPayload(policy) {
  const payload = exactFields(policy, POLICY_FIELDS);
  if (!payload || !Array.isArray(payload.access_grants)) return null;
  const grants = [];
  for (const grant of payload.access_grants) {
    const clean = exactFields(grant, GRANT_FIELDS);
    if (!clean) return null;
    grants.push(clean);
  }
  return {...payload, access_grants: grants};
}

async function verifySignature(signatureHex, payload, publicKeyHex) {
  const signature = bytesFromHex(signatureHex, HEX_SIGNATURE_RE);
  const publicKey = bytesFromHex(publicKeyHex, HEX_KEY_RE);
  if (!signature || !publicKey || !payload) return false;
  try {
    return await ed.verifyAsync(signature, encoder.encode(canonicalJson(payload)), publicKey);
  } catch (_) {
    return false;
  }
}

function parseKernelIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) return Number.NaN;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', zone = ''] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
  if (hour > 23 || minute > 59 || second > 59) return Number.NaN;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day || date.getUTCHours() !== hour
      || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return Number.NaN;
  let offsetMinutes = 0;
  if (zone && zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3)), offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return Number.NaN;
    offsetMinutes = (offsetHour * 60 + offsetMinute) * (zone[0] === '+' ? 1 : -1);
  }
  const fractionalMs = fraction ? Number(`0.${fraction}`) * 1000 : 0;
  return date.getTime() + fractionalMs - offsetMinutes * 60_000;
}

function publicReadGranted(policy, nowMs = Date.now()) {
  const ranks = new Map([['discover', 0], ['r', 1], ['rw', 2], ['admin', 3], ['assume_custody', 4]]);
  return policy.access_grants.some((grant) => {
    const expiresAt = String(grant.expires_at || '');
    const expiresMs = expiresAt ? parseKernelIso(expiresAt) : Number.POSITIVE_INFINITY;
    const scopeKind = String(grant.scope_kind || '');
    const scopeId = String(grant.scope_id || '');
    const scopeMatches = (!scopeKind && !scopeId)
      || (scopeKind === policy.subject_kind && scopeId === policy.subject_id);
    return grant.schema === 'access-grant/1'
      && grant.grantee_kind === 'public'
      && grant.grantee_id === '*'
      && scopeMatches
      && (!expiresAt || (Number.isFinite(expiresMs) && expiresMs > nowMs))
      && (ranks.get(String(grant.access_level || '')) ?? -1) >= 1;
  });
}

function validatePolicyBinding(document, policy, {requirePublic = false, nowMs = Date.now()} = {}) {
  if (!isObject(policy) || policy.schema !== 'access-policy/1') return failed('invalid_access_policy');
  if (!String(policy.policy_id || '') || !Array.isArray(policy.access_grants)) {
    return failed('invalid_access_policy');
  }
  if (document.access_policy_ref !== policy.policy_id) return failed('access_policy_ref_mismatch');
  if (policy.subject_kind !== 'artifact') return failed('access_policy_subject_kind_mismatch');
  if (policy.subject_id !== `${document.node_id}:${document.run}`) {
    return failed('access_policy_subject_id_mismatch');
  }
  if (policy.signing_key_id !== document.signing_key_id) {
    return failed('access_policy_signing_key_mismatch');
  }
  if (document.schema === 'personaos-live-artifacts/1') {
    const expectedTier = document.visibility_tier === 'public' ? 'public'
      : document.visibility_tier === 'operator' ? 'persona_only' : '';
    if (!expectedTier || policy.outward_tier !== expectedTier) {
      return failed('access_policy_tier_mismatch');
    }
  } else if (!['public', 'persona_only'].includes(policy.outward_tier)) {
    return failed('access_policy_tier_mismatch');
  }
  if (requirePublic && (policy.outward_tier !== 'public' || !publicReadGranted(policy, nowMs))) {
    return failed('public_read_not_granted');
  }
  return {ok: true};
}

async function verifyMetadata(document, options, expectedSchema) {
  if (!isObject(document) || document.schema !== expectedSchema) return failed('invalid_schema');
  if (!String(document.node_id || '') || !String(document.run || '')) return failed('missing_identity');
  if (options.expectedNodeId && document.node_id !== options.expectedNodeId) {
    return failed('node_id_mismatch');
  }
  if (options.expectedRun && document.run !== options.expectedRun) return failed('run_mismatch');
  const keyId = String(document.signing_key_id || '');
  if (keyId !== 'kernel-master') return failed('non_master_signing_key');
  const candidates = (Array.isArray(options.keyEntries) ? options.keyEntries : [])
    .filter((entry) => entry?.key_id === keyId && entry?.role === 'master'
      && entry?.status === 'current' && HEX_KEY_RE.test(String(entry?.public_key_hex || '')));
  if (candidates.length !== 1) return failed('current_master_key_unavailable');
  const publicKeyHex = candidates[0].public_key_hex;
  const policy = document.access_policy;
  const binding = validatePolicyBinding(document, policy, options);
  if (!binding.ok) return binding;
  if (!await verifySignature(document.signature_hex, liveMetadataSigningPayload(document), publicKeyHex)) {
    return failed('metadata_signature_invalid');
  }
  if (!await verifySignature(policy.signature_hex, liveAccessPolicySigningPayload(policy), publicKeyHex)) {
    return failed('access_policy_signature_invalid');
  }
  return {
    ok: true,
    signingKeyId: keyId,
    accessPolicyRef: document.access_policy_ref,
    outwardTier: policy.outward_tier,
  };
}

export async function verifyLiveArtifactSnapshot(document, options = {}) {
  if (!isObject(document) || !REVISION_RE.test(String(document.revision || ''))) {
    return failed('invalid_snapshot_revision');
  }
  const verified = await verifyMetadata(document, options, 'personaos-live-artifacts/1');
  if (!verified.ok) return verified;
  const lifecycle = document.lifecycle;
  const workspaces = document.workspaces;
  const immutableFinalizedBootstrap = isObject(lifecycle)
    && lifecycle.state === 'run_finalized'
    && REVISION_RE.test(String(document.since_revision || ''))
    && lifecycle.workspace_revision === document.since_revision
    && typeof lifecycle.finalized_at === 'string'
    && Number.isFinite(parseKernelIso(lifecycle.finalized_at))
    && lifecycle.finalized_at === document.generated_at
    && Array.isArray(workspaces)
    && workspaces.length > 0
    && workspaces.every((workspace) => isObject(workspace) && workspace.state === 'run_finalized');
  if (Object.hasOwn(options, 'expectedSinceRevision')) {
    const expected = options.expectedSinceRevision ?? null;
    const observed = document.since_revision ?? null;
    const immutableBootstrapOrRefresh = immutableFinalizedBootstrap
      && (expected === null || expected === document.revision);
    if (observed !== expected && !immutableBootstrapOrRefresh) {
      return failed('poll_revision_binding_mismatch');
    }
  }
  return {...verified, immutableFinalizedBootstrap};
}

export async function verifyLiveArtifactEvent(document, options = {}) {
  const outer = await verifyMetadata(document, options, 'personaos-live-artifact-event/1');
  if (!outer.ok) return outer;
  if (document.state === 'run_ended') {
    if (document.snapshot !== null || document.revision !== null || document.active !== false
        || !REVISION_RE.test(String(document.previous_revision || ''))) {
      return failed('invalid_run_ended_event');
    }
    if (options.expectedPreviousRevision !== undefined
        && document.previous_revision !== options.expectedPreviousRevision) {
      return failed('broken_terminal_revision_chain');
    }
    return {...outer, kind: 'run_ended'};
  }
  if (!isObject(document.snapshot) || !REVISION_RE.test(String(document.revision || ''))) {
    return failed('invalid_live_artifact_event');
  }
  const nested = await verifyLiveArtifactSnapshot(document.snapshot, {
    ...options,
    expectedNodeId: document.node_id,
    expectedRun: document.run,
  });
  if (!nested.ok) return failed(`snapshot_${nested.reason}`);
  if (document.revision !== document.snapshot.revision
      || (document.previous_revision ?? null) !== (document.snapshot.since_revision ?? null)
      || document.access_policy_ref !== document.snapshot.access_policy_ref
      || canonicalJson(document.access_policy) !== canonicalJson(document.snapshot.access_policy)) {
    return failed('event_snapshot_binding_mismatch');
  }
  return {...outer, kind: 'snapshot', snapshot: nested};
}
