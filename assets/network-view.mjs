import {normalizePersonaAvatar} from './persona-avatar.mjs';

/*
 * Bounded, DOM-free helpers for projecting a very large PersonaOS network into
 * small UI windows.  Every collection helper consumes an iterable in one pass
 * and retains only O(output limit) items.  Callers may therefore feed these
 * helpers a generator backed by a million-node index without first materialising
 * that index as another array.
 */

export const NETWORK_VIEW_LIMITS = Object.freeze({
  priorityWindow: 80,
  searchWindow: 160,
  maxWindow: 512,
  maxScan: 1_000_000,
  groupInitial: 24,
  groupStep: 24,
  groupMax: 240,
  monitoredBases: 12,
  mandatoryMonitoringBases: 64,
  maxQueryLength: 256,
  maxSearchTextLength: 4096,
  maxKeyLength: 512,
});

export const PROVIDER_INDEX_LIMITS = Object.freeze({
  framingBytes: 64 * 1024,
  maxSignedEnvelopeBytes: 4 * 1024,
});

/**
 * Bound the one large discovery response independently of ordinary JSON.
 *
 * A compact provider index carries one hash-addressed signed discovery document
 * per advertised record plus independently signed lookup aliases for that
 * document. The node's bootstrap `record_count` therefore selects an aggregate
 * per-document byte budget, while the browser's existing record cache remains
 * the hard population ceiling. Invalid or over-ceiling declarations fail closed
 * before any response body is read.
 */
export function providerIndexResponseByteLimit(recordCount, recordCeiling) {
  if (!Number.isInteger(recordCount) || recordCount < 0
      || !Number.isInteger(recordCeiling) || recordCeiling < 1
      || recordCount > recordCeiling) return 0;
  return PROVIDER_INDEX_LIMITS.framingBytes
    + recordCount * PROVIDER_INDEX_LIMITS.maxSignedEnvelopeBytes;
}

export function responseByteLengthWithinLimit(byteLength, maxBytes) {
  return Number.isSafeInteger(byteLength) && byteLength >= 0
    && Number.isSafeInteger(maxBytes) && maxBytes >= 1
    && byteLength <= maxBytes;
}

const LIVE_TASK_CAPABILITY_LIMIT = 128;
const LIVE_TASK_STATE_LIMIT = 40;
const LIVE_TASK_MARKER = 'live_task';
const TASK_STATE_PREFIX = 'task_state:';
const TERMINAL_TASK_CAPABILITIES = new Set([
  'complete',
  'completed',
  'succeeded',
  'failed',
  'cancelled',
  'canceled',
  'aborted',
  'stopped',
]);
const MISSION_EVIDENCE_KINDS = new Set(['task', 'project', 'mission']);
const MISSION_EVIDENCE_LABEL_LIMIT = 256;
const MISSION_EVIDENCE_DID_LIMIT = 512;
const MODEL_EVENT_SCAN_LIMIT = 8_192;
const MODEL_FAILURE_REASON_LIMIT = 240;
const MODEL_EVENT_FIELD_LIMIT = 128;

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

function iterableOf(value) {
  if (value == null) return [];
  if (typeof value === 'string') return [value];
  return typeof value[Symbol.iterator] === 'function' ? value : [value];
}

function boundedMissionEvidenceLabel(value) {
  if (typeof value !== 'string') return '';
  const exact = value.normalize('NFC').trim();
  if (!exact || /[\u0000-\u001f\u007f]/u.test(exact)) return '';
  return [...exact].slice(0, MISSION_EVIDENCE_LABEL_LIMIT).join('');
}

function signedMissionRun(record) {
  if (typeof record?.did !== 'string') return '';
  const did = record.did.normalize('NFC').trim();
  if (!did || [...did].length > MISSION_EVIDENCE_DID_LIMIT
      || /[\u0000-\u001f\u007f]/u.test(did)) return '';
  const match = did.match(/\/(task|project|mission)\/(run-[0-9A-Za-z_-]{1,180})$/);
  return match && match[1] === record.kind ? match[2] : '';
}

/**
 * Keep only browser-dialable libp2p multiaddr-shaped bootstrap values.
 *
 * Node bootstrap documents intentionally carry both HTTP federation URLs and
 * libp2p routes in some legacy arrays.  Passing the HTTP values to js-libp2p's
 * bootstrap discovery aborts the whole P2P node before it can dial the valid
 * entries.  This boundary is deliberately structural: it does not choose a
 * transport or peer, it only keeps bounded multiaddr strings and deduplicates
 * them in observation order.
 */
export function normalizeLibp2pBootstrap(value) {
  if (typeof value !== 'string') return null;
  const exact = value.normalize('NFC').trim();
  if (!exact || exact.length > 2048 || exact[0] !== '/' || exact[1] === '/') return null;
  if (!/^\/[!-~]+$/.test(exact) || /[?#]/.test(exact)) return null;
  return exact;
}

export function collectLibp2pBootstraps(...sources) {
  const seen = new Set();
  const out = [];
  for (const source of sources) {
    for (const value of iterableOf(source)) {
      const normalized = normalizeLibp2pBootstrap(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

/**
 * Admit a structurally valid multiaddr only when this browser can legally dial
 * its WebSocket transport from the current page security context.
 *
 * Browsers map `/ws` to `ws://`.  An HTTPS page will reject that connection as
 * mixed content before libp2p can negotiate with the peer, so handing such an
 * address to js-libp2p creates a guaranteed failed dial and a noisy console.
 * `/wss` and `/tls/.../ws` remain eligible, as do non-WebSocket transports.
 * This is a browser transport boundary, not peer selection or trust policy.
 */
export function normalizeBrowserLibp2pBootstrap(value, {pageProtocol = ''} = {}) {
  const normalized = normalizeLibp2pBootstrap(value);
  if (!normalized || String(pageProtocol).toLowerCase() !== 'https:') return normalized;
  const protocols = normalized.split('/').filter(Boolean).map((part) => part.toLowerCase());
  for (let index = 0; index < protocols.length; index += 1) {
    if (protocols[index] !== 'ws') continue;
    const tlsBeforeWebSocket = protocols.lastIndexOf('tls', index) >= 0;
    if (!tlsBeforeWebSocket) return null;
  }
  return normalized;
}

export function collectBrowserLibp2pBootstraps(context, ...sources) {
  const seen = new Set();
  const out = [];
  for (const source of sources) {
    for (const value of iterableOf(source)) {
      const normalized = normalizeBrowserLibp2pBootstrap(value, context);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

/**
 * Project already-verified structural mission evidence without interpreting
 * capability vocabulary.
 *
 * `task`, `project`, and `mission` are record structure, while capability names
 * are open persona-authored vocabulary.  A verified task therefore remains
 * public evidence even when its only capability is an unfamiliar handoff or
 * work mode.  The label and optional run identifier are taken only from bounded
 * signed record fields; the caller still owns signature/access verification.
 */
export function publishedMissionEvidenceProjection(record) {
  if (!record || typeof record !== 'object' || !MISSION_EVIDENCE_KINDS.has(record.kind)) {
    return null;
  }
  const task = boundedMissionEvidenceLabel(record.label);
  if (!task) return null;
  return Object.freeze({
    task,
    state: 'published',
    run: signedMissionRun(record),
    kind: record.kind,
    publishedEvidence: true,
  });
}

/**
 * Project a signed, protocol-level terminal task capability into mission state.
 *
 * Capability vocabulary remains open: only the small generic lifecycle set
 * above has status semantics. Unknown capabilities continue to be published
 * evidence, never inferred state. Conflicting terminal capabilities fail
 * closed so canonical array ordering cannot choose an outcome for the UI.
 */
export function terminalTaskMissionProjection(record) {
  if (!record || typeof record !== 'object' || record.kind !== 'task') return null;
  if (!Array.isArray(record.capability_summary)
      || record.capability_summary.length > LIVE_TASK_CAPABILITY_LIMIT) return null;
  const terminal = record.capability_summary.filter((value) => (
    typeof value === 'string' && TERMINAL_TASK_CAPABILITIES.has(value)
  ));
  if (terminal.length !== 1) return null;
  const task = boundedMissionEvidenceLabel(record.label);
  if (!task) return null;
  return Object.freeze({
    task,
    state: terminal[0],
    run: signedMissionRun(record),
    terminalTask: true,
    terminalCapability: terminal[0],
  });
}

/**
 * Project one already-verified public task record into the mission surface.
 *
 * The caller owns signature/access verification. New records bind their exact,
 * bounded, persona-authored state with `task_state:`; capability ordering is not
 * semantic because the signed discovery payload canonicalises the list. No bare
 * capability or prose value is interpreted as state.
 */
export function liveTaskMissionProjection(record) {
  if (!record || typeof record !== 'object' || record.kind !== 'task') return null;
  if (!Array.isArray(record.capability_summary)
      || record.capability_summary.length > LIVE_TASK_CAPABILITY_LIMIT) return null;
  const capabilities = record.capability_summary.map((value) => (
    typeof value === 'string' ? value : ''
  ));
  if (capabilities.filter((value) => value === LIVE_TASK_MARKER).length !== 1) return null;

  const boundedState = (value) => {
    if (!value || value !== value.trim() || [...value].length > LIVE_TASK_STATE_LIMIT) return '';
    return /[\u0000-\u001f\u007f]/u.test(value) ? '' : value;
  };
  const bindings = capabilities.filter((value) => value.startsWith(TASK_STATE_PREFIX));
  if (bindings.length !== 1) return null;
  const state = boundedState(bindings[0].slice(TASK_STATE_PREFIX.length));
  if (!state) return null;
  const task = boundedMissionEvidenceLabel(record.label);
  if (!task) return null;
  return Object.freeze({
    task,
    state,
    run: signedMissionRun(record),
    liveTask: true,
  });
}

function boundedTelemetryField(value, maximum = MODEL_EVENT_FIELD_LIMIT) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const exact = String(value).normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (!exact || /[\u0000-\u001f\u007f]/u.test(exact)) return '';
  return [...exact].slice(0, maximum).join('');
}

function terminalFailureProjection(event, index) {
  const statusValue = Number(event?.status);
  const attemptValue = Number(event?.attempt);
  return Object.freeze({
    kind: 'MODEL_CALL_FAILED',
    index,
    personaId: boundedTelemetryField(event?.persona_id, 512),
    environmentId: boundedTelemetryField(event?.environment_id, 512),
    model: boundedTelemetryField(event?.model_id),
    purpose: boundedTelemetryField(event?.requested_purpose ?? event?.purpose),
    attempt: Number.isSafeInteger(attemptValue) && attemptValue >= 0
      ? attemptValue : null,
    status: Number.isSafeInteger(statusValue) && statusValue >= 100 && statusValue <= 599
      ? statusValue : null,
    reason: boundedTelemetryField(event?.reason, MODEL_FAILURE_REASON_LIMIT),
  });
}

function attributedTerminalEventMatches(failure, personaId, environmentId) {
  if (!failure || (!personaId && !environmentId)) return false;
  if (failure.personaId || personaId) {
    if (!failure.personaId || !personaId || failure.personaId !== personaId) return false;
  }
  if (failure.environmentId || environmentId) {
    if (!failure.environmentId || !environmentId
        || failure.environmentId !== environmentId) return false;
  }
  return true;
}

function signedPersonaId(record) {
  if (typeof record?.did !== 'string') return '';
  const did = record.did.normalize('NFC').trim();
  const marker = '/persona/';
  const offset = did.lastIndexOf(marker);
  if (offset < 0) return '';
  const personaId = did.slice(offset + marker.length);
  return personaId && personaId.length <= 180 && !/[\u0000-\u0020/\\]/u.test(personaId)
    ? personaId : '';
}

function nonMechanicalPersonaLabel(value, personaId) {
  if (typeof value !== 'string' || !personaId) return '';
  const label = value.normalize('NFC').trim();
  if (!label || [...label].length > 240 || /[\u0000-\u001f\u007f]/u.test(label)) return '';
  const fold = (text) => text.normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const labelFold = fold(label), idFold = fold(personaId);
  if (!labelFold || !idFold || labelFold === idFold
      || ['persona', 'identity', 'agent'].some((prefix) =>
        labelFold === `${prefix} ${idFold}`)) return '';
  return label;
}

/**
 * A persona card needs one complete, already-verified public identity record.
 * Telemetry cannot manufacture identity, and a signed shell without a
 * persona-authored name plus persona-bound raster descriptor stays hidden.
 * Cryptographic avatar-signature and byte verification still happens at the
 * asynchronous image hydration boundary.
 */
export function verifiedPersonaIdentityPresent(personaDiscoveryByKey, personaKey) {
  if (!(personaDiscoveryByKey instanceof Map) || typeof personaKey !== 'string'
      || !personaKey) return false;
  const record = personaDiscoveryByKey.get(personaKey);
  if (!record || typeof record !== 'object' || record.kind !== 'persona') return false;
  const personaId = signedPersonaId(record);
  const keyParts = personaKey.split('\u0000');
  if (keyParts.length !== 3 || keyParts[1] !== 'persona' || keyParts[2] !== personaId) return false;
  const signedName = nonMechanicalPersonaLabel(record._personaSignedName, personaId);
  const avatar = normalizePersonaAvatar(record.avatar);
  const identityPin = String(record._personaIdentityPublicKeyHex || '');
  return !!signedName && !!avatar && avatar.persona_id === personaId
    && /^[0-9a-f]{64}$/.test(identityPin)
    && avatar.identity_public_key_hex === identityPin;
}

function normalizedPersonaLifecycleCard(record) {
  const card=record?.persona_lifecycle_card;
  const exactFields=['authority','did','identity_fields','identity_materialization_state',
    'identity_public_key_hex','identity_signature_hash','identity_signature_verified',
    'identity_signing_key_id','issued_at','lifecycle_chain_head_hash',
    'lifecycle_chain_verified','lifecycle_state','persona_id','schema','signature_hex',
    'signing_key_id'];
  if(!card||typeof card!=='object'||Array.isArray(card)
      ||card.schema!=='personaos-persona-lifecycle-card/1'
      ||card.signing_key_id!=='kernel-master'
      ||Object.keys(card).sort().join('\u0000')!==exactFields.sort().join('\u0000')
      ||!/^[0-9a-f]{128}$/i.test(String(card.signature_hex||''))) return null;
  const personaId=signedPersonaId(record);
  if(!personaId||String(card.persona_id||'')!==personaId
      ||String(card.did||'')!==String(record.did||'')) return null;
  const lifecycle=String(card.lifecycle_state||'').normalize('NFC').trim();
  if(lifecycle!=='ACTIVE') return null;
  if(card.authority!=='kernel_observed_verified_persona_lifecycle'
      ||card.identity_signature_verified!==true||card.lifecycle_chain_verified!==true
      ||!/^sha256:[0-9a-f]{64}$/i.test(String(card.identity_signature_hash||''))
      ||!/^sha256:[0-9a-f]{64}$/i.test(String(card.lifecycle_chain_head_hash||''))) return null;
  const issuedAt=String(card.issued_at||'');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(issuedAt)
      ||!Number.isFinite(Date.parse(issuedAt))) return null;
  const outerKeyId=String(record._personaIdentitySigningKeyId||record.identity_signing_key_id||'');
  const outerPublicKey=String(record._personaIdentityPublicKeyHex||record.identity_public_key_hex||'').toLowerCase();
  if(!outerKeyId||String(card.identity_signing_key_id||'')!==outerKeyId
      ||!/^[0-9a-f]{64}$/.test(outerPublicKey)
      ||String(card.identity_public_key_hex||'').toLowerCase()!==outerPublicKey) return null;
  const materialization=String(card.identity_materialization_state||'');
  if(!['pending','materialized'].includes(materialization)) return null;
  const fields=card.identity_fields;
  if(!fields||typeof fields!=='object'||Array.isArray(fields)) return null;
  const normalizedFields={};
  for(const name of ['name','characteristics','avatar']){
    const field=fields[name];
    if(!field||typeof field!=='object'||Array.isArray(field)
        ||Object.keys(field).sort().join('\u0000')!=='persona_authored\u0000state'
        ||!['pending','materialized'].includes(String(field.state||''))
        ||typeof field.persona_authored!=='boolean'
        ||field.persona_authored!==(field.state==='materialized')) return null;
    normalizedFields[name]=Object.freeze({state:field.state,personaAuthored:field.persona_authored});
  }
  if(Object.keys(fields).sort().join('\u0000')!=='avatar\u0000characteristics\u0000name') return null;
  const allMaterialized=Object.values(normalizedFields).every((field)=>field.state==='materialized');
  if((materialization==='materialized')!==allMaterialized) return null;
  return Object.freeze({personaId,lifecycleState:lifecycle,
    materializationState:materialization,identityFields:Object.freeze(normalizedFields)});
}

/**
 * A kernel-signed lifecycle shell is sufficient to render an honest pending
 * persona card. The nested signature is verified at discovery admission and
 * recorded on the already provider/document-verified row. No telemetry alias,
 * guessed name, traits, role or avatar can satisfy this predicate.
 */
export function verifiedPersonaLifecyclePresent(personaDiscoveryByKey,personaKey){
  if(!(personaDiscoveryByKey instanceof Map)||typeof personaKey!=='string'||!personaKey) return false;
  const record=personaDiscoveryByKey.get(personaKey);
  if(!record||record.kind!=='persona'||record._personaLifecycleVerified!==true) return false;
  const lifecycle=normalizedPersonaLifecycleCard(record); if(!lifecycle) return false;
  const keyParts=personaKey.split('\u0000');
  return keyParts.length===3&&keyParts[1]==='persona'&&keyParts[2]===lifecycle.personaId;
}

export function verifiedPersonaRenderable(personaDiscoveryByKey,personaKey){
  return verifiedPersonaIdentityPresent(personaDiscoveryByKey,personaKey)
    ||verifiedPersonaLifecyclePresent(personaDiscoveryByKey,personaKey);
}

export function personaLifecycleProjection(personaDiscoveryByKey,personaKey){
  if(!verifiedPersonaLifecyclePresent(personaDiscoveryByKey,personaKey)) return null;
  return normalizedPersonaLifecycleCard(personaDiscoveryByKey.get(personaKey));
}

/**
 * Project the latest terminal model-call failure from an ordered telemetry ring.
 *
 * MODEL_SELECTED begins a new execution attempt and therefore clears an older
 * failure for its exact persona/environment. MODEL_CALL_FAILED closes that
 * attempt with failure; MODEL_CALL_SUCCEEDED closes it successfully and clears
 * any matching failure projection. Transport/fallback diagnostics are
 * intentionally ignored: they may be followed by a successful fallback and
 * are not themselves terminal state.
 * The returned entity maps and kernel-wide `latest` value let callers surface
 * failure without treating historical MODEL_SELECTED rows as current work.
 */
export function projectTerminalModelFailures(modelEvents) {
  const source = Array.isArray(modelEvents)
    ? modelEvents.slice(-MODEL_EVENT_SCAN_LIMIT)
    : [...iterableOf(modelEvents)].slice(-MODEL_EVENT_SCAN_LIMIT);
  const byPersona = new Map();
  const byEnvironment = new Map();
  let latest = null;
  source.forEach((event, index) => {
    const kind = boundedTelemetryField(event?.kind);
    if (kind !== 'MODEL_SELECTED' && kind !== 'MODEL_CALL_FAILED'
        && kind !== 'MODEL_CALL_SUCCEEDED') return;
    const personaId = boundedTelemetryField(event?.persona_id, 512);
    const environmentId = boundedTelemetryField(event?.environment_id, 512);
    if (kind === 'MODEL_SELECTED' || kind === 'MODEL_CALL_SUCCEEDED') {
      if (personaId && attributedTerminalEventMatches(
        byPersona.get(personaId), personaId, environmentId,
      )) byPersona.delete(personaId);
      if (environmentId && attributedTerminalEventMatches(
        byEnvironment.get(environmentId), personaId, environmentId,
      )) byEnvironment.delete(environmentId);
      if (attributedTerminalEventMatches(latest, personaId, environmentId)) latest = null;
      return;
    }
    const failure = terminalFailureProjection(event, index);
    if (personaId) byPersona.set(personaId, failure);
    if (environmentId) byEnvironment.set(environmentId, failure);
    latest = failure;
  });
  return Object.freeze({byPersona, byEnvironment, latest});
}

function boundedText(value, maxLength) {
  return String(value ?? '').normalize('NFC').slice(0, maxLength);
}

function defaultKeyOf(item, index) {
  if (item && typeof item === 'object') {
    for (const key of ['kernel_id', 'node_id', 'record_id', 'did', 'id', 'base', '_base', 'url']) {
      if (item[key] != null && String(item[key])) return item[key];
    }
  }
  if (typeof item === 'string' && item) return item;
  return String(index).padStart(16, '0');
}

function defaultSearchTextOf(item) {
  if (item == null) return '';
  if (typeof item !== 'object') return item;
  const fields = [];
  for (const key of [
    'label', 'name', 'task', 'kind', 'status', 'role', 'kernel_id', 'node_id',
    'record_id', 'did', 'id', 'base', '_base', 'url', 'description',
  ]) {
    const value = item[key];
    if (value == null) continue;
    if (Array.isArray(value)) fields.push(value.slice(0, 16).join(' '));
    else if (typeof value !== 'object') fields.push(String(value));
  }
  return fields.join(' ');
}

function defaultPriorityOf(item) {
  if (!item || typeof item !== 'object') return 0;
  const status = String(item.status || item.state || '').toLowerCase();
  let score = Number(item.priority || item.score || 0);
  if (!Number.isFinite(score)) score = 0;
  if (item.focused === true || item.selected === true) score += 1_000_000_000;
  if (item.running === true || item.active === true || item.busy === true || status === 'running') {
    score += 100_000_000;
  } else if (status === 'paused' || status === 'blocked') {
    score += 70_000_000;
  } else if (item.live === true || item.recent === true || status === 'live') {
    score += 50_000_000;
  }
  if (item.reachable === true) score += 10_000_000;
  return score;
}

function queryTokens(query) {
  const normalized = boundedText(query, NETWORK_VIEW_LIMITS.maxQueryLength)
    .trim().toLocaleLowerCase('en-US');
  if (!normalized) return {query: '', tokens: []};
  return {
    query: normalized,
    tokens: normalized.split(/\s+/).filter(Boolean).slice(0, 8),
  };
}

// Negative means `left` belongs before `right` in the final best-first window.
function compareRank(left, right) {
  if (left.priority !== right.priority) return left.priority > right.priority ? -1 : 1;
  if (left.key < right.key) return -1;
  if (left.key > right.key) return 1;
  return left.index - right.index;
}

function insertRanked(window, selectedByKey, candidate, limit, dedupeByKey) {
  if (limit <= 0) return;
  if (dedupeByKey) {
    const prior = selectedByKey.get(candidate.key);
    if (prior) {
      if (compareRank(candidate, prior) >= 0) return;
      const priorIndex = window.indexOf(prior);
      if (priorIndex >= 0) window.splice(priorIndex, 1);
      selectedByKey.delete(candidate.key);
    }
  }
  if (window.length === limit && compareRank(candidate, window[window.length - 1]) >= 0) return;
  let low = 0;
  let high = window.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compareRank(candidate, window[middle]) < 0) high = middle;
    else low = middle + 1;
  }
  window.splice(low, 0, candidate);
  if (dedupeByKey) selectedByKey.set(candidate.key, candidate);
  if (window.length > limit) {
    const removed = window.pop();
    if (dedupeByKey && selectedByKey.get(removed.key) === removed) {
      selectedByKey.delete(removed.key);
    }
  }
}

/**
 * Select a deterministic best-first window from an arbitrary iterable.
 *
 * Ordering is numeric priority descending, then bounded key ascending, then
 * source order.  Search is an AND match over at most eight normalized tokens.
 * The result retains at most `limit` items and never calls Array.from(items).
 */
export function selectPriorityWindow(items, options = {}) {
  const {query, tokens} = queryTokens(options.query || '');
  const fallbackLimit = query
    ? NETWORK_VIEW_LIMITS.searchWindow
    : NETWORK_VIEW_LIMITS.priorityWindow;
  const limit = boundedInteger(options.limit, fallbackLimit, 0, NETWORK_VIEW_LIMITS.maxWindow);
  const scanLimit = boundedInteger(
    options.scanLimit,
    NETWORK_VIEW_LIMITS.maxScan,
    0,
    NETWORK_VIEW_LIMITS.maxScan,
  );
  const priorityOf = typeof options.priorityOf === 'function'
    ? options.priorityOf : defaultPriorityOf;
  const keyOf = typeof options.keyOf === 'function' ? options.keyOf : defaultKeyOf;
  const searchTextOf = typeof options.searchTextOf === 'function'
    ? options.searchTextOf : defaultSearchTextOf;
  const dedupeByKey = options.dedupeByKey !== false;
  const ranked = [];
  const selectedByKey = new Map();
  let scanned = 0;
  let matched = 0;

  for (const item of iterableOf(items)) {
    if (scanned >= scanLimit) break;
    const index = scanned++;
    if (tokens.length) {
      let haystack = '';
      try {
        haystack = boundedText(
          searchTextOf(item, index),
          NETWORK_VIEW_LIMITS.maxSearchTextLength,
        ).toLocaleLowerCase('en-US');
      } catch (_) {
        continue;
      }
      if (!tokens.every((token) => haystack.includes(token))) continue;
    }
    matched++;
    let rawPriority = 0;
    let rawKey = '';
    try { rawPriority = Number(priorityOf(item, index)); } catch (_) { rawPriority = 0; }
    try { rawKey = keyOf(item, index); } catch (_) { rawKey = ''; }
    const priority = Number.isFinite(rawPriority) ? rawPriority : 0;
    const key = boundedText(rawKey || String(index).padStart(16, '0'), NETWORK_VIEW_LIMITS.maxKeyLength);
    insertRanked(ranked, selectedByKey, {item, priority, key, index}, limit, dedupeByKey);
  }

  return {
    items: ranked.map((entry) => entry.item),
    keys: ranked.map((entry) => entry.key),
    query,
    scanned,
    matched,
    returned: ranked.length,
    omitted: Math.max(0, matched - ranked.length),
    limit,
    scanLimitReached: scanned >= scanLimit,
  };
}

export function selectSearchWindow(items, query, options = {}) {
  return selectPriorityWindow(items, {
    ...options,
    query,
    limit: options.limit ?? NETWORK_VIEW_LIMITS.searchWindow,
  });
}

export const selectBoundedNetworkWindow = selectPriorityWindow;

function progressValue(groupKey, progressByGroup) {
  if (typeof progressByGroup === 'function') return progressByGroup(groupKey);
  if (progressByGroup instanceof Map) return progressByGroup.get(groupKey);
  if (progressByGroup && typeof progressByGroup === 'object') return progressByGroup[groupKey];
  return 0;
}

/** Return the visible-item limit for one independently expanded group. */
export function progressiveGroupLimit(groupKey, progressByGroup, options = {}) {
  const initial = boundedInteger(
    options.initial,
    NETWORK_VIEW_LIMITS.groupInitial,
    1,
    NETWORK_VIEW_LIMITS.groupMax,
  );
  const maximum = boundedInteger(
    options.max,
    NETWORK_VIEW_LIMITS.groupMax,
    initial,
    NETWORK_VIEW_LIMITS.maxWindow,
  );
  const step = boundedInteger(
    options.step,
    NETWORK_VIEW_LIMITS.groupStep,
    1,
    maximum,
  );
  const level = boundedInteger(progressValue(groupKey, progressByGroup), 0, 0,
    Math.ceil((maximum - initial) / step));
  return Math.min(maximum, initial + level * step);
}

export function nextProgressiveGroupLevel(groupKey, progressByGroup, options = {}) {
  const initial = boundedInteger(options.initial, NETWORK_VIEW_LIMITS.groupInitial, 1,
    NETWORK_VIEW_LIMITS.groupMax);
  const maximum = boundedInteger(options.max, NETWORK_VIEW_LIMITS.groupMax, initial,
    NETWORK_VIEW_LIMITS.maxWindow);
  const step = boundedInteger(options.step, NETWORK_VIEW_LIMITS.groupStep, 1, maximum);
  const current = boundedInteger(progressValue(groupKey, progressByGroup), 0, 0,
    Math.ceil((maximum - initial) / step));
  return Math.min(Math.ceil((maximum - initial) / step), current + 1);
}

/** Consume a group iterable while retaining only that group's progressive window. */
export function takeProgressiveGroupWindow(items, groupKey, progressByGroup, options = {}) {
  const limit = progressiveGroupLimit(groupKey, progressByGroup, options);
  const scanLimit = boundedInteger(options.scanLimit, NETWORK_VIEW_LIMITS.maxScan, 0,
    NETWORK_VIEW_LIMITS.maxScan);
  const selected = [];
  let scanned = 0;
  // One look-ahead is sufficient to render a truthful "show more" control. Do
  // not walk the remaining 999,000 members of a collapsed group just to count
  // them. Arrays/Sets may still provide an O(1) exact total.
  const probeLimit = Math.min(scanLimit, limit + 1);
  for (const item of iterableOf(items)) {
    if (scanned >= probeLimit) break;
    scanned++;
    if (selected.length < limit) selected.push(item);
  }
  const rawKnownTotal = Array.isArray(items) ? items.length
    : (items && Number.isSafeInteger(items.size) ? items.size : null);
  const knownTotal = rawKnownTotal == null ? null : safeCount(rawKnownTotal, NETWORK_VIEW_LIMITS.maxScan);
  const hasMore = knownTotal == null ? scanned > selected.length : knownTotal > selected.length;
  return {
    items: selected,
    groupKey,
    limit,
    scanned,
    total: knownTotal,
    omitted: knownTotal == null
      ? (hasMore ? 1 : 0)
      : Math.max(0, knownTotal - selected.length),
    omittedIsLowerBound: knownTotal == null && hasMore,
    hasMore,
    scanLimitReached: scanned >= scanLimit,
  };
}

/**
 * Normalize a node API base.  Empty string / @origin intentionally mean the
 * page origin; other values must be credential-free absolute HTTP(S) URLs.
 */
export function normalizeMonitoringBase(value) {
  let raw = value;
  if (value && typeof value === 'object') {
    raw = own(value, 'base') ? value.base
      : own(value, '_base') ? value._base
      : own(value, 'url') ? value.url
      : own(value, 'base_url') ? value.base_url
      : null;
  }
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text || text === '@origin') return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.search = '';
    url.hash = '';
    const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    return `${url.origin}${pathname}`;
  } catch (_) {
    return null;
  }
}

function defaultBaseOf(item) {
  return normalizeMonitoringBase(item);
}

function defaultActiveOf(item) {
  if (!item || typeof item !== 'object') return false;
  const status = String(item.status || item.state || '').toLowerCase();
  return item.active === true || item.running === true || item.busy === true
    || status === 'running' || Number(item.active_calls || item.activeCallCount || 0) > 0;
}

function defaultFocusedOf(item) {
  return Boolean(item && typeof item === 'object'
    && (item.focused === true || item.selected === true));
}

/**
 * Choose API bases to poll without ever silently evicting a focused or active
 * base.  The requested limit expands to fit mandatory bases, up to `hardLimit`;
 * exceeding that explicit safety ceiling throws instead of reporting a false
 * monitoring state.  All remaining slots are filled by deterministic priority.
 */
export function selectMonitoringBases(candidates, options = {}) {
  const requestedLimit = boundedInteger(
    options.limit,
    NETWORK_VIEW_LIMITS.monitoredBases,
    0,
    NETWORK_VIEW_LIMITS.mandatoryMonitoringBases,
  );
  const hardLimit = boundedInteger(
    options.hardLimit,
    NETWORK_VIEW_LIMITS.mandatoryMonitoringBases,
    Math.max(1, requestedLimit),
    NETWORK_VIEW_LIMITS.maxWindow,
  );
  const scanLimit = boundedInteger(options.scanLimit, NETWORK_VIEW_LIMITS.maxScan, 0,
    NETWORK_VIEW_LIMITS.maxScan);
  const baseOf = typeof options.baseOf === 'function' ? options.baseOf : defaultBaseOf;
  const activeOf = typeof options.activeOf === 'function' ? options.activeOf : defaultActiveOf;
  const focusedOf = typeof options.focusedOf === 'function' ? options.focusedOf : defaultFocusedOf;
  const priorityOf = typeof options.priorityOf === 'function'
    ? options.priorityOf : defaultPriorityOf;
  const focused = [];
  const active = [];
  const focusedSet = new Set();
  const activeSet = new Set();
  const ranked = [];
  const rankedByKey = new Map();

  const checkedBase = (item, index) => {
    try { return normalizeMonitoringBase(baseOf(item, index)); } catch (_) { return null; }
  };
  const ensureCapacity = () => {
    if (focusedSet.size + activeSet.size > hardLimit) {
      throw new RangeError(`focused/active monitoring bases exceed hard limit ${hardLimit}`);
    }
  };
  const addFocused = (base) => {
    if (base == null || focusedSet.has(base)) return;
    if (activeSet.delete(base)) {
      const index = active.indexOf(base);
      if (index >= 0) active.splice(index, 1);
    }
    focusedSet.add(base);
    focused.push(base);
    ensureCapacity();
  };
  const addActive = (base) => {
    if (base == null || focusedSet.has(base) || activeSet.has(base)) return;
    activeSet.add(base);
    active.push(base);
    ensureCapacity();
  };

  if (own(options, 'focusedBase')) addFocused(checkedBase(options.focusedBase, -1));
  for (const item of iterableOf(options.focusedBases)) addFocused(checkedBase(item, -1));
  for (const item of iterableOf(options.activeBases)) addActive(checkedBase(item, -1));

  let scanned = 0;
  for (const item of iterableOf(candidates)) {
    if (scanned >= scanLimit) break;
    const index = scanned++;
    const base = checkedBase(item, index);
    if (base == null) continue;
    let isFocused = false;
    let isActive = false;
    try { isFocused = focusedOf(item, index) === true; } catch (_) {}
    try { isActive = activeOf(item, index) === true; } catch (_) {}
    if (isFocused) addFocused(base);
    else if (isActive) addActive(base);
    let rawPriority = 0;
    try { rawPriority = Number(priorityOf(item, index)); } catch (_) {}
    insertRanked(ranked, rankedByKey, {
      item: base,
      key: base || '@origin',
      priority: Number.isFinite(rawPriority) ? rawPriority : 0,
      index,
    }, hardLimit, true);
  }

  ensureCapacity();
  const mandatoryCount = focused.length + active.length;
  const limit = Math.min(hardLimit, Math.max(requestedLimit, mandatoryCount));
  const bases = [...focused, ...active];
  const selected = new Set(bases);
  for (const entry of ranked) {
    if (bases.length >= limit) break;
    if (selected.has(entry.item)) continue;
    selected.add(entry.item);
    bases.push(entry.item);
  }
  return {
    bases,
    focused: [...focused],
    active: [...active],
    requestedLimit,
    limit,
    hardLimit,
    mandatoryCount,
    scanned,
    scanLimitReached: scanned >= scanLimit,
  };
}

function countBigInt(value) {
  if (typeof value === 'bigint') return value > 0n ? value : 0n;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    return BigInt(Math.floor(Math.min(value, Number.MAX_SAFE_INTEGER)));
  }
  const text = String(value ?? '').trim();
  if (/^\d+$/.test(text)) {
    try { return BigInt(text); } catch (_) { return 0n; }
  }
  if (/^\d+\.\d+$/.test(text)) {
    const number = Number(text);
    if (Number.isFinite(number) && number > 0) {
      return BigInt(Math.floor(Math.min(number, Number.MAX_SAFE_INTEGER)));
    }
  }
  return 0n;
}

/** Clamp untrusted counts to an exact non-negative safe JS integer. */
export function safeCount(value, maximum = Number.MAX_SAFE_INTEGER) {
  const max = boundedInteger(maximum, Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER);
  const count = countBigInt(value);
  const cap = BigInt(max);
  return Number(count > cap ? cap : count);
}

/**
 * Compact, deterministic count text without Intl/locale variance or unsafe
 * floating-point conversion. Values beyond 999 quadrillion are explicitly
 * capped instead of emitting an attacker-sized decimal string.
 */
export function compactCount(value) {
  const count = countBigInt(value);
  if (count < 1000n) return count.toString();
  const units = [
    ['Q', 1_000_000_000_000_000n],
    ['T', 1_000_000_000_000n],
    ['B', 1_000_000_000n],
    ['M', 1_000_000n],
    ['K', 1_000n],
  ];
  if (count >= 1_000_000_000_000_000_000n) return '999Q+';
  for (const [suffix, unit] of units) {
    if (count < unit) continue;
    const tenths = (count * 10n) / unit;
    const whole = tenths / 10n;
    const decimal = tenths % 10n;
    return decimal && whole < 100n
      ? `${whole}.${decimal}${suffix}`
      : `${whole}${suffix}`;
  }
  return count.toString();
}
