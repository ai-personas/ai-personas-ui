const LEVEL_RANK = Object.freeze({discover: 0, r: 1, read: 1, rw: 2, write: 2, admin: 3});
const KEY_RE = /^[0-9a-f]{64}$/i;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;
const POLICY_FIELDS = Object.freeze([
  'schema', 'policy_id', 'subject_kind', 'subject_id', 'owner_persona_id',
  'access_grants', 'outward_tier', 'cross_tenant_agreement_ref',
]);

const text = (value) => String(value ?? '').normalize('NFC').trim();
const tail = (value) => text(value).split('/').filter(Boolean).pop() || '';

function liveAt(expiresAt, nowMs) {
  const value = text(expiresAt);
  if (!value) return true;
  const match = ISO_RE.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText,
    fraction = '', zone] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
  if (hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day || date.getUTCHours() !== hour
      || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return false;
  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3)), offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
    offsetMinutes = (offsetHour * 60 + offsetMinute) * (zone[0] === '+' ? 1 : -1);
  }
  const expiresMs = date.getTime() + (fraction ? Number(`0.${fraction}`) * 1000 : 0)
    - offsetMinutes * 60_000;
  return Number.isFinite(expiresMs) && expiresMs > nowMs;
}

export function providerLookupHints(record, {max = 5} = {}) {
  const hints = [];
  for (const raw of [
    record?.content_hash,
    record?.did,
    record?.global_handle,
    record?.handle,
    record?.record_id || record?.card_id,
  ]) {
    const value = text(raw);
    if (!value || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)
        || hints.includes(value)) continue;
    hints.push(value);
    if (hints.length >= max) break;
  }
  return hints;
}

export function recordVerificationEntries(entries, keyId) {
  const seen = new Set();
  const ranked = {current: 0, previous: 1, archived: 2};
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.key_id === keyId
      && (keyId !== 'kernel-master' || entry?.role === 'master')
      && Object.hasOwn(ranked, entry?.status)
      && KEY_RE.test(text(entry?.public_key_hex)))
    .sort((a, b) => ranked[a.status] - ranked[b.status])
    .filter((entry) => {
      const key = text(entry.public_key_hex).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function currentMasterKey(entries) {
  const matches = (Array.isArray(entries) ? entries : []).filter((entry) =>
    entry?.key_id === 'kernel-master' && entry?.role === 'master'
    && entry?.status === 'current' && KEY_RE.test(text(entry?.public_key_hex)));
  return matches.length === 1 ? text(matches[0].public_key_hex) : '';
}

function subjectCandidates(record, links) {
  const values = new Set();
  const add = (value) => {
    const full = text(value);
    if (!full) return;
    values.add(full);
    const last = tail(full);
    if (last) values.add(last);
  };
  for (const value of [
    record?.record_id,
    record?.card_id,
    record?.subject_id,
    record?.bundle_id,
    record?.artifact_id,
    record?.persona_id,
    record?.environment_id,
    record?.project_id,
    record?.domain_id,
    record?.did,
    links?.subject_id,
    links?.bundle_id,
    links?.artifact_id,
    links?.persona_id,
    links?.environment_id,
    links?.owning_env_id,
    links?.project_id,
    links?.domain_id,
  ]) add(value);
  return values;
}

function grantScopeMatches(grant, policy) {
  const kind = text(grant?.scope_kind), id = text(grant?.scope_id);
  if (kind && kind !== text(policy?.subject_kind)) return false;
  if (id && id !== text(policy?.subject_id)) return false;
  return true;
}

export function evaluatePublicRecordAccess(record, policy, links = {}, {nowMs = Date.now()} = {}) {
  if (!record || !policy || policy.schema !== 'access-policy/1'
      || POLICY_FIELDS.some((field) => !Object.hasOwn(policy, field))
      || !Array.isArray(policy.access_grants)) {
    return {ok: false, canDiscover: false, canRead: false, level: '', reason: 'invalid_policy'};
  }
  if (!text(record.access_policy_ref) || record.access_policy_ref !== policy.policy_id) {
    return {ok: false, canDiscover: false, canRead: false, level: '', reason: 'policy_ref_mismatch'};
  }
  if (text(policy.subject_kind) !== text(record.kind)
      || !subjectCandidates(record, links).has(text(policy.subject_id))) {
    return {ok: false, canDiscover: false, canRead: false, level: '', reason: 'policy_subject_mismatch'};
  }
  if (record.visibility_tier !== 'public' || policy.outward_tier !== 'public') {
    return {ok: false, canDiscover: false, canRead: false, level: '', reason: 'not_publicly_discoverable'};
  }
  if (!liveAt(record.expires_at, nowMs)) {
    return {ok: false, canDiscover: false, canRead: false, level: '', reason: 'record_expired'};
  }
  let rank = LEVEL_RANK.discover;
  for (const grant of policy.access_grants) {
    if (grant?.schema !== 'access-grant/1' || grant?.grantee_kind !== 'public'
        || !grantScopeMatches(grant, policy) || !liveAt(grant.expires_at, nowMs)) continue;
    const grantRank = LEVEL_RANK[text(grant.access_level).toLowerCase()];
    if (Number.isInteger(grantRank)) rank = Math.max(rank, grantRank);
  }
  const level = ['discover', 'r', 'rw', 'admin'][rank];
  return {ok: true, canDiscover: true, canRead: rank >= LEVEL_RANK.r, level,
    reason: rank >= LEVEL_RANK.r ? 'public_read_granted' : 'public_discover_only'};
}

export function projectDiscoveryRecord(record, canRead) {
  if (canRead) return {...record};
  const out = {};
  for (const key of [
    'schema', 'record_id', 'card_id', 'did', 'kind', 'label', 'capability_summary',
    'access_policy_ref', 'visibility_tier',
  ]) {
    if (Object.hasOwn(record || {}, key)) out[key] = record[key];
  }
  // The descriptor is signed public identity data, not a fetchable locator.
  // Rendering validates its bounded shape and never follows URL/data fields.
  if (record?.kind === 'persona' && Object.hasOwn(record, 'avatar')) {
    out.avatar = record.avatar;
  }
  return out;
}

export function projectAccessPolicy(policy, canRead) {
  if (canRead) return {...policy};
  return {
    schema: policy?.schema,
    policy_id: policy?.policy_id,
    subject_kind: policy?.subject_kind,
    subject_id: policy?.subject_id,
    access_grants: [],
    outward_tier: policy?.outward_tier,
    verified_discover_only: true,
  };
}

export function projectRecordSurface(record, policy, links, access, {base = '', url = ''} = {}) {
  const canRead = access?.canRead === true;
  return {
    record: projectDiscoveryRecord(record, canRead),
    policy: projectAccessPolicy(policy, canRead),
    links: canRead ? {...(links || {})} : {},
    base: canRead ? text(base) : '',
    url: canRead ? text(url) : '',
  };
}
