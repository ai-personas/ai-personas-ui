/*
 * Environment association and routing authority for verified discovery rows.
 *
 * This module deliberately does not score candidate environments. Activity,
 * recency, names, task text, privacy hints, and array order are observations,
 * never authority to pick one environment over another. Callers must first
 * verify the containing discovery document (and its provider envelope) and pass
 * `verified: true`; unsigned transport objects cannot create a UI association.
 */

const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const MAX_REFERENCE_LENGTH = 1024;

const text = (value) => String(value ?? '').normalize('NFC').trim();

function scalarValues(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

/** Return the stable environment identity carried by one exact reference. */
export function environmentIdentity(value) {
  if (typeof value !== 'string') return '';
  const raw = text(value);
  if (!raw || raw.length > MAX_REFERENCE_LENGTH || CONTROL_RE.test(raw)) return '';

  // PersonaOS DIDs and canonical ids may contain `env:<id>` more than once
  // (`.../env/env:<id>`). The final explicit marker is the subject identity.
  const marked = [...raw.matchAll(/(?:^|[/:])env:([^/?#\s]+)/gi)];
  if (marked.length) return decodeIdentity(marked[marked.length - 1][1]);

  // Verified provider links commonly use environments/<id>.json.
  const pathMatch = raw.match(/(?:^|\/)environments\/([^/?#]+?)(?:\.json)?(?:[?#]|$)/i);
  if (pathMatch) return decodeIdentity(pathMatch[1]);

  // A DID path can use /env/<id> without the second env: prefix.
  const didPath = raw.match(/(?:^|\/)env\/([^/?#]+)(?:[?#]|$)/i);
  if (didPath) return decodeIdentity(didPath[1]);

  // Bare ids are accepted as open vocabulary. Paths, URLs, and fragments are
  // not silently converted into ids by taking an arbitrary final segment.
  if (!/[/?#]/.test(raw)) return decodeIdentity(raw.replace(/^environment:/i, ''));
  return '';
}

function decodeIdentity(value) {
  let decoded = text(value);
  try { decoded = decodeURIComponent(decoded); } catch (_) { return ''; }
  decoded = decoded.replace(/\.json$/i, '');
  return decoded && decoded.length <= MAX_REFERENCE_LENGTH && !CONTROL_RE.test(decoded)
    ? decoded : '';
}

function addCandidates(target, value) {
  for (const item of scalarValues(value)) {
    const id = environmentIdentity(item);
    if (id) target.add(id);
  }
}

function sorted(set) {
  return [...set].sort((left, right) => left.localeCompare(right, 'en-US'));
}

/**
 * Resolve environment authority from an already verified discovery surface.
 *
 * Singular fields are exact associations. Plural host/candidate fields expose
 * a bounded candidate set but never choose its first member. A verified
 * project `primary_environment_id` is prior project authority only when it does
 * not conflict with the current host set or another exact association.
 */
export function resolveEnvironmentAuthority(record, links = {}, {verified = false} = {}) {
  if (!verified) {
    return Object.freeze({status: 'unverified', environmentId: '', candidates: [],
      basis: '', reason: 'unsigned_transport_has_no_routing_authority'});
  }

  const exact = new Set();
  const candidates = new Set();
  for (const value of [
    record?.environment_id,
    record?.owning_environment_id,
    record?.owning_env_id,
    links?.environment_id,
    links?.owning_environment_id,
    links?.owning_env_id,
    links?.env,
  ]) addCandidates(exact, value);
  for (const value of [
    record?.environment_ids,
    record?.host_environment_ids,
    record?.candidate_environment_ids,
    links?.environment_ids,
    links?.host_environment_ids,
  ]) addCandidates(candidates, value);

  const primary = record?.kind === 'project'
    ? environmentIdentity(record?.primary_environment_id) : '';
  const exactIds = sorted(exact);
  const candidateIds = sorted(candidates);
  const all = new Set([...exactIds, ...candidateIds]);
  if (primary) all.add(primary);

  if (primary) {
    const exactConflict = exactIds.some((id) => id !== primary);
    const hostConflict = candidateIds.length > 0 && !candidates.has(primary);
    if (exactConflict || hostConflict) {
      return Object.freeze({status: 'conflict', environmentId: '', candidates: sorted(all),
        basis: '', reason: 'signed_primary_conflicts_with_current_context'});
    }
    return Object.freeze({status: 'resolved', environmentId: primary,
      candidates: sorted(all), basis: 'signed_project_primary', reason: ''});
  }

  if (exactIds.length > 1) {
    return Object.freeze({status: 'ambiguous', environmentId: '', candidates: sorted(all),
      basis: '', reason: 'conflicting_exact_environment_references'});
  }
  if (exactIds.length === 1) {
    const selected = exactIds[0];
    if (candidateIds.length && !candidates.has(selected)) {
      return Object.freeze({status: 'conflict', environmentId: '', candidates: sorted(all),
        basis: '', reason: 'exact_environment_outside_candidate_set'});
    }
    return Object.freeze({status: 'resolved', environmentId: selected,
      candidates: sorted(all), basis: 'exact_verified_reference', reason: ''});
  }
  if (candidateIds.length === 1) {
    return Object.freeze({status: 'resolved', environmentId: candidateIds[0],
      candidates: candidateIds, basis: 'sole_verified_candidate', reason: ''});
  }
  if (candidateIds.length > 1) {
    return Object.freeze({status: 'ambiguous', environmentId: '', candidates: candidateIds,
      basis: '', reason: 'routing_context_pressure'});
  }
  return Object.freeze({status: 'absent', environmentId: '', candidates: [],
    basis: '', reason: 'no_verified_environment_reference'});
}
