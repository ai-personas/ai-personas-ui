/*
 * Bounded, framework-free state for the global PersonaOS network UI.
 *
 * Identity is always kernel-qualified.  Short persona/environment ids are useful
 * for labels and URL paths, but are never safe Map keys in a federated view.
 * Runtime presence and event history are deliberately leases/rings rather than
 * append-only browser state: an unreachable node must age to stale/offline and a
 * long-running tab must have a fixed memory ceiling.
 */

const SEP = '\u0000';

export const DEFAULT_NETWORK_LIMITS = Object.freeze({
  maxEntities: 5_000,
  maxPresence: 5_000,
  maxPinned: 128,
  maxEventStreams: 64,
  maxEventsPerStream: 400,
  maxEventsTotal: 8_000,
  presenceStaleAfterMs: 10_000,
  presenceLeaseMs: 30_000,
  offlineRetentionMs: 120_000,
  maxGraphExact: 96,
  maxGraphAggregates: 24,
  maxGraphNodes: 120,
  maxTelemetrySources: 128,
  telemetryMaxAgeMs: 30_000,
  telemetryFutureSkewMs: 30_000,
});

function cleanPart(value, label, {lower = false} = {}) {
  let out = String(value ?? '').trim();
  if (!out) throw new TypeError(`${label} is required`);
  if (out.includes(SEP)) throw new TypeError(`${label} contains a reserved separator`);
  if (lower) out = out.toLowerCase();
  return out;
}

function boundedInt(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function positiveMs(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function millis(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalSequence(value) {
  if (value === undefined || value === null || value === '') return {present: false, value: null};
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0
    ? {present: true, value: parsed}
    : {present: true, value: null};
}

function first(source, names) {
  for (const name of names) {
    const value = source?.[name];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function canonicalIdentity(kind, value) {
  let out = cleanPart(value, 'identity');
  const normalizedKind = canonicalKind(kind);
  const prefixes = [normalizedKind];
  if (normalizedKind === 'env') prefixes.push('environment');
  if (normalizedKind === 'kernel') prefixes.push('node');
  if (normalizedKind === 'subagent') prefixes.push('agent', 'worker');
  for (const prefix of prefixes) {
    if (out.startsWith(`${prefix}:`)) {
      out = out.slice(prefix.length + 1);
      break;
    }
  }
  return cleanPart(out, 'identity');
}

export function networkEntityKey(kernelId, kind, identity) {
  const normalizedKind = canonicalKind(cleanPart(kind, 'kind', {lower: true}));
  return [
    cleanPart(kernelId, 'kernelId'),
    normalizedKind,
    canonicalIdentity(normalizedKind, identity),
  ].join(SEP);
}

export function networkStreamKey(kernelId, scopeKind = 'global', scopeId = 'global') {
  return [
    cleanPart(kernelId, 'kernelId'),
    cleanPart(scopeKind || 'global', 'scopeKind', {lower: true}),
    cleanPart(scopeId || 'global', 'scopeId'),
  ].join(SEP);
}

export function splitNetworkKey(key) {
  const parts = String(key || '').split(SEP);
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  return {kernelId: parts[0], kind: parts[1], identity: parts[2]};
}

export function entityIdentity(source, overrides = {}) {
  const record = source && typeof source === 'object' ? source : {};
  const kernelId = overrides.kernelId ?? first(record, [
    'kernel_id', 'host_kernel_id', 'node_id', '_kernel', 'kernelId',
  ]);
  const kind = overrides.kind ?? first(record, [
    'kind', 'entity_kind', 'unit_kind', 'scope_kind',
  ]);
  const normalizedKind = canonicalKind(cleanPart(kind, 'kind', {lower: true}));
  // Prefer the entity's kernel-local canonical id. The kernel is already part of
  // the compound key, so this joins a signed discovery DID to runtime telemetry
  // that commonly carries only persona_id/environment_id. A full DID is retained
  // on the record itself; when it is the sole identifier, reduce only its final
  // kind-qualified segment (never use that local id without the kernel+kind).
  const byKind = normalizedKind === 'persona'
    ? first(record, ['persona_id', 'entity_id'])
    : normalizedKind === 'env' || normalizedKind === 'environment'
      ? first(record, ['environment_id', 'env_id', 'entity_id'])
      : normalizedKind === 'kernel' || normalizedKind === 'node'
        ? first(record, ['node_id', 'kernel_id', 'entity_id'])
        : ['model_call', 'tool_call', 'subagent', 'worker', 'call', 'tool'].includes(normalizedKind)
          ? first(record, ['unit_id', 'call_id', 'tool_call_id', 'entity_id'])
          : first(record, ['entity_id', 'unit_id', 'call_id', 'run_id', 'record_id', 'card_id', 'id']);
  const did = String(record.did || '').trim();
  let didIdentity = did;
  if (did.startsWith('did:')) {
    if (did.includes('/')) didIdentity = did.slice(did.lastIndexOf('/') + 1);
    else {
      const marker = `:${normalizedKind}:`;
      const at = did.lastIndexOf(marker);
      if (at >= 0) didIdentity = did.slice(at + marker.length);
    }
    const prefix = `${normalizedKind}:`;
    if (didIdentity.startsWith(prefix)) didIdentity = didIdentity.slice(prefix.length);
  }
  const identity = (overrides.identity ?? overrides.id ?? byKind) || didIdentity;
  const normalizedIdentity = canonicalIdentity(normalizedKind, identity);
  const key = networkEntityKey(kernelId, normalizedKind, normalizedIdentity);
  return {
    key,
    kernelId: cleanPart(kernelId, 'kernelId'),
    kind: normalizedKind,
    identity: normalizedIdentity,
  };
}

function statusRank(status) {
  return {running: 5, live: 4, recent: 3, idle: 2, stale: 1, offline: 0}[status] ?? 2;
}

function displayStatus(reported, freshness) {
  if (freshness === 'offline') return 'offline';
  if (freshness === 'stale') return 'stale';
  const value = String(reported || '').toLowerCase();
  if (/running|model_call_active|running_llm|executing|working/.test(value)) return 'running';
  if (/live|recent|active_call/.test(value)) return 'live';
  if (/offline|unreachable|dead/.test(value)) return 'offline';
  if (/paused|idle|waiting|available|active|run_participant/.test(value)) return 'idle';
  return freshness === 'live' ? 'recent' : 'idle';
}

function canonicalKind(kind) {
  const value = String(kind || '').toLowerCase();
  if (value === 'environment') return 'env';
  if (value === 'node') return 'kernel';
  if (value === 'agent' || value === 'worker') return 'subagent';
  return value;
}

function aggregateKey(scope, group) {
  return `aggregate:${encodeURIComponent(scope)}:${encodeURIComponent(group)}`;
}

/**
 * Admit node-wide live telemetry before it is allowed to refresh presence.
 *
 * A transport reconnect or a cache can replay an old snapshot after a newer one.
 * Receiving that replay "now" must not make its active_model_calls live again, so
 * ordering is based on the producer's sequence/generated_at, never receipt time.
 */
export class TelemetryAdmissionGate {
  constructor(options = {}) {
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.maxSources = boundedInt(options.maxSources,
      DEFAULT_NETWORK_LIMITS.maxTelemetrySources, 1, 4_096);
    this.maxAgeMs = positiveMs(options.maxAgeMs,
      DEFAULT_NETWORK_LIMITS.telemetryMaxAgeMs);
    this.futureSkewMs = positiveMs(options.futureSkewMs,
      DEFAULT_NETWORK_LIMITS.telemetryFutureSkewMs);
    this.cursors = new Map();
  }

  admit(source, frame, overrides = {}) {
    const sourceKey = cleanPart(source || '@origin', 'telemetry source');
    const receivedAt = positiveMs(overrides.receivedAt, this.now());
    const observedRaw = overrides.observedAt ?? first(frame, [
      'generated_at_ms', 'generated_at', 'observed_at_ms', 'observed_at', 'at',
    ]);
    const observedAt = millis(observedRaw, Number.NaN);
    if (!Number.isFinite(observedAt)) {
      return {accepted: false, reason: 'missing_observed_time', sourceKey};
    }
    if (observedAt < receivedAt - this.maxAgeMs) {
      return {accepted: false, reason: 'stale_frame', sourceKey, observedAt, receivedAt};
    }
    if (observedAt > receivedAt + this.futureSkewMs) {
      return {accepted: false, reason: 'future_frame', sourceKey, observedAt, receivedAt};
    }

    const rawSequence = overrides.sequence ?? frame?.sequence ?? frame?.seq;
    const sequence = optionalSequence(rawSequence);
    if (sequence.present && sequence.value === null) {
      return {accepted: false, reason: 'invalid_sequence', sourceKey, observedAt, receivedAt};
    }
    const epoch = String((overrides.epoch ?? first(frame, [
      'stream_epoch', 'boot_id', 'session_id', 'instance_id',
    ])) || '');
    const eventId = String(overrides.eventId || '');
    const prior = this.cursors.get(sourceKey);
    const sameEpoch = prior && prior.epoch === epoch;
    if (sameEpoch && sequence.present && prior.sequence !== null) {
      if (sequence.value < prior.sequence) {
        return {accepted: false, reason: 'out_of_order_sequence', sourceKey,
          observedAt, receivedAt, expectedAfter: prior.sequence, receivedSequence: sequence.value};
      }
      if (sequence.value === prior.sequence) {
        return {accepted: false, reason: 'duplicate_sequence', sourceKey,
          observedAt, receivedAt, receivedSequence: sequence.value};
      }
    } else if (sameEpoch && observedAt <= prior.observedAt) {
      return {accepted: false,
        reason: observedAt === prior.observedAt ? 'duplicate_time' : 'out_of_order_time',
        sourceKey, observedAt, receivedAt};
    }
    if (sameEpoch && eventId && eventId === prior.eventId) {
      return {accepted: false, reason: 'duplicate_event', sourceKey, observedAt, receivedAt};
    }

    const cursor = {sourceKey, observedAt, receivedAt,
      sequence: sequence.present ? sequence.value : null, epoch, eventId};
    this.cursors.delete(sourceKey);
    this.cursors.set(sourceKey, cursor);
    while (this.cursors.size > this.maxSources) this.cursors.delete(this.cursors.keys().next().value);
    return {accepted: true, ...cursor};
  }

  cursor(source) {
    return this.cursors.get(String(source || '@origin')) || null;
  }

  delete(source) {
    return this.cursors.delete(String(source || '@origin'));
  }

  clear() {
    this.cursors.clear();
  }
}

export class NetworkStore {
  constructor(options = {}) {
    this.limits = Object.freeze({...DEFAULT_NETWORK_LIMITS, ...(options.limits || {})});
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.entities = new Map();
    this.presence = new Map();
    this.eventStreams = new Map();
    this.pinned = new Map();
    this._eventCount = 0;
  }

  _touch(map, key, value) {
    map.delete(key);
    map.set(key, value);
  }

  _evictMap(map, limit, protectedKeys = null, onEvict = null) {
    while (map.size > limit) {
      let victim = null;
      for (const key of map.keys()) {
        if (!protectedKeys?.has(key)) { victim = key; break; }
      }
      if (victim === null) victim = map.keys().next().value;
      const value = map.get(victim);
      map.delete(victim);
      if (onEvict) onEvict(victim, value);
    }
  }

  upsertEntity(record, overrides = {}) {
    const id = entityIdentity(record, overrides);
    const prior = this.entities.get(id.key);
    const value = {
      ...(prior || {}),
      ...(record || {}),
      entity_key: id.key,
      kernel_id: id.kernelId,
      kind: id.kind,
      entity_id: id.identity,
      updated_at_ms: this.now(),
    };
    this._touch(this.entities, id.key, value);
    this._evictMap(this.entities, this.limits.maxEntities, new Set(this.pinned.keys()),
      (key) => this.pinned.delete(key));
    return {accepted: true, inserted: !prior, key: id.key, value};
  }

  getEntity(key) {
    return this.entities.get(String(key || '')) || null;
  }

  removeEntity(key) {
    const normalized = String(key || '');
    this.pinned.delete(normalized);
    return this.entities.delete(normalized);
  }

  pinEntity(key) {
    const normalized = String(key || '');
    if (!this.entities.has(normalized) && !this.presence.has(normalized)) return false;
    this._touch(this.pinned, normalized, this.now());
    this._evictMap(this.pinned, this.limits.maxPinned);
    return true;
  }

  unpinEntity(key) {
    return this.pinned.delete(String(key || ''));
  }

  upsertPresence(update, overrides = {}) {
    const id = entityIdentity(update, overrides);
    const prior = this.presence.get(id.key);
    const rawSeq = update?.seq ?? update?.sequence;
    const hasSeq = rawSeq !== undefined && rawSeq !== null && rawSeq !== '';
    const seq = hasSeq ? Number(rawSeq) : null;
    if (hasSeq && (!Number.isSafeInteger(seq) || seq < 0)) {
      return {accepted: false, reason: 'invalid_sequence', key: id.key};
    }
    if (hasSeq && prior?.seq !== null && prior?.seq !== undefined) {
      if (seq === prior.seq) return {accepted: false, reason: 'duplicate_sequence', key: id.key};
      if (seq < prior.seq) return {accepted: false, reason: 'out_of_order_sequence', key: id.key};
    }

    const observedAt = millis(first(update, ['observed_at_ms', 'observed_at', 'generated_at', 'at']), this.now());
    if (!hasSeq && prior && observedAt < prior.observed_at_ms) {
      return {accepted: false, reason: 'out_of_order_time', key: id.key};
    }
    const leaseMs = positiveMs(update?.lease_ms ?? overrides.leaseMs,
      this.limits.presenceLeaseMs);
    const staleAfterMs = Math.min(leaseMs, positiveMs(
      update?.stale_after_ms ?? overrides.staleAfterMs,
      this.limits.presenceStaleAfterMs));
    const expiresAt = millis(update?.expires_at_ms ?? update?.expires_at, observedAt + leaseMs);
    const staleAt = Math.min(expiresAt, millis(
      update?.stale_at_ms ?? update?.stale_at,
      observedAt + staleAfterMs));
    const value = {
      ...(prior || {}),
      ...(update || {}),
      entity_key: id.key,
      kernel_id: id.kernelId,
      kind: id.kind,
      entity_id: id.identity,
      seq: hasSeq ? seq : (prior?.seq ?? null),
      observed_at_ms: observedAt,
      stale_at_ms: staleAt,
      expires_at_ms: Math.max(staleAt, expiresAt),
      reported_state: first(update, ['state', 'status', 'runtime_state', 'lifecycle_state'])
        || prior?.reported_state || '',
    };
    this._touch(this.presence, id.key, value);
    this._evictMap(this.presence, this.limits.maxPresence, new Set(this.pinned.keys()),
      (key) => this.pinned.delete(key));
    return {accepted: true, inserted: !prior, key: id.key, value: this.presenceStatus(id.key)};
  }

  presenceStatus(key, at = this.now()) {
    const value = this.presence.get(String(key || ''));
    if (!value) return null;
    const freshness = at >= value.expires_at_ms
      ? 'offline'
      : at >= value.stale_at_ms ? 'stale' : 'live';
    return {
      ...value,
      freshness,
      effective_state: freshness === 'offline'
        ? 'offline' : freshness === 'stale' ? 'stale' : (value.reported_state || 'online'),
    };
  }

  listPresence({includeOffline = true, at = this.now()} = {}) {
    const out = [];
    for (const key of this.presence.keys()) {
      const value = this.presenceStatus(key, at);
      if (value && (includeOffline || value.freshness !== 'offline')) out.push(value);
    }
    return out;
  }

  sweepPresence(at = this.now()) {
    let offline = 0;
    let pruned = 0;
    for (const [key, value] of this.presence) {
      if (at >= value.expires_at_ms) offline++;
      if (at >= value.expires_at_ms + this.limits.offlineRetentionMs
          && !this.pinned.has(key)) {
        this.presence.delete(key);
        pruned++;
      }
    }
    return {offline, pruned, remaining: this.presence.size};
  }

  ingestEvent(event, options = {}) {
    const kernelId = options.kernelId ?? first(event, [
      'kernel_id', 'node_id', 'host_kernel_id', '_kernel', 'kernelId',
    ]);
    let streamKey = options.streamKey;
    if (!streamKey) {
      const run = first(event, ['run_id', 'run']);
      const env = first(event, ['environment_id', 'scope_id']);
      const scopeKind = run ? 'run' : env ? 'environment' : 'global';
      streamKey = networkStreamKey(kernelId, scopeKind, run || env || 'global');
    }
    const eventId = cleanPart(options.eventId ?? first(event, ['event_id', 'id']), 'eventId');
    const rawSeq = event?.seq ?? event?.sequence;
    const hasSeq = rawSeq !== undefined && rawSeq !== null && rawSeq !== '';
    const seq = hasSeq ? Number(rawSeq) : null;
    if (hasSeq && (!Number.isSafeInteger(seq) || seq < 0)) {
      return {accepted: false, reason: 'invalid_sequence', streamKey, eventId};
    }

    let stream = this.eventStreams.get(streamKey);
    if (!stream) stream = {key: streamKey, events: [], eventIds: new Set(), lastSeq: null,
      touchedAt: this.now()};
    if (stream.eventIds.has(eventId)) {
      return {accepted: false, reason: 'duplicate_event', streamKey, eventId};
    }
    if (hasSeq && stream.lastSeq !== null) {
      if (seq === stream.lastSeq) {
        return {accepted: false, reason: 'duplicate_sequence', streamKey, eventId};
      }
      if (seq < stream.lastSeq) {
        return {accepted: false, reason: 'out_of_order_sequence', streamKey, eventId};
      }
      if (options.requireContiguous && seq !== stream.lastSeq + 1) {
        return {accepted: false, reason: 'sequence_gap', expectedSeq: stream.lastSeq + 1,
          receivedSeq: seq, streamKey, eventId};
      }
    }
    const gap = hasSeq && stream.lastSeq !== null && seq > stream.lastSeq + 1
      ? {expectedSeq: stream.lastSeq + 1, receivedSeq: seq} : null;
    const value = {
      ...(event || {}),
      event_id: eventId,
      seq,
      kernel_id: cleanPart(kernelId, 'kernelId'),
      stream_key: streamKey,
      received_at_ms: this.now(),
    };
    stream.events.push(value);
    stream.eventIds.add(eventId);
    if (hasSeq) stream.lastSeq = seq;
    stream.touchedAt = this.now();
    this._eventCount++;
    while (stream.events.length > this.limits.maxEventsPerStream) {
      const removed = stream.events.shift();
      stream.eventIds.delete(removed.event_id);
      this._eventCount--;
    }
    this._touch(this.eventStreams, streamKey, stream);
    this._evictMap(this.eventStreams, this.limits.maxEventStreams, null, (_key, removed) => {
      this._eventCount -= removed.events.length;
    });
    this._trimTotalEvents();
    return {accepted: true, streamKey, eventId, value, gap};
  }

  _trimTotalEvents() {
    while (this._eventCount > this.limits.maxEventsTotal) {
      let victim = null;
      let oldest = Infinity;
      for (const [key, stream] of this.eventStreams) {
        const at = stream.events[0]?.received_at_ms ?? Infinity;
        if (at < oldest) { oldest = at; victim = key; }
      }
      if (victim === null) break;
      const stream = this.eventStreams.get(victim);
      const removed = stream.events.shift();
      if (removed) {
        stream.eventIds.delete(removed.event_id);
        this._eventCount--;
      }
      if (!stream.events.length) this.eventStreams.delete(victim);
    }
  }

  eventsFor(streamKey) {
    return [...(this.eventStreams.get(String(streamKey || ''))?.events || [])];
  }

  streamCursor(streamKey) {
    const stream = this.eventStreams.get(String(streamKey || ''));
    return stream ? {lastSeq: stream.lastSeq, size: stream.events.length,
      lastEventId: stream.events.at(-1)?.event_id || ''} : null;
  }

  _rows(at) {
    const rows = new Map();
    for (const [key, entity] of this.entities) rows.set(key, {...entity});
    for (const [key] of this.presence) {
      const live = this.presenceStatus(key, at);
      rows.set(key, {...(rows.get(key) || {}), ...live});
    }
    return [...rows.values()].map((row) => {
      const parsed = splitNetworkKey(row.entity_key) || {};
      const kind = canonicalKind(row.kind || parsed.kind);
      const kernelId = row.kernel_id || parsed.kernelId || '';
      const environmentId = String(first(row, ['environment_id', 'env_id']) || '');
      const runId = String(first(row, ['run_id', 'run']) || '');
      const personaId = String(first(row, ['persona_id', 'owner_persona_id'])
        || (kind === 'persona' ? row.entity_id : ''));
      const reported = first(row, ['reported_state', 'runtime_state', 'task_execution_state',
        'status', 'state', 'lifecycle_state']);
      const status = displayStatus(reported, row.freshness || '');
      const activityAt = Math.max(
        Number(row.observed_at_ms || 0),
        millis(first(row, ['last_active_at', 'generated_at', 'updated_at']), 0),
      );
      return {
        ...row,
        key: row.entity_key,
        kernelId,
        kind,
        identity: row.entity_id || parsed.identity || '',
        environmentId,
        runId,
        personaId,
        status,
        activityAt,
        name: String(first(row, ['name', 'label', 'title']) || row.entity_id || parsed.identity || kind),
      };
    });
  }

  projectGraph(options = {}) {
    const at = options.at ?? this.now();
    const level = String(options.level || (options.personaId ? 'persona'
      : options.environmentId ? 'environment' : options.runId ? 'run'
        : options.kernelId ? 'kernel' : 'global')).toLowerCase();
    const exactCap = boundedInt(options.maxExactNodes, this.limits.maxGraphExact,
      0, this.limits.maxGraphExact);
    let aggregateCap = boundedInt(options.maxAggregateNodes, this.limits.maxGraphAggregates,
      0, this.limits.maxGraphAggregates);
    const totalCap = boundedInt(options.maxNodes, this.limits.maxGraphNodes,
      0, this.limits.maxGraphNodes);
    const selected = new Set((options.selectedKeys || []).map(String));
    const allRows = this._rows(at);
    let candidates;

    if (level === 'global') {
      const kernels = new Map();
      for (const row of allRows) {
        if (!row.kernelId) continue;
        const key = networkEntityKey(row.kernelId, 'kernel', row.kernelId);
        const prior = kernels.get(key);
        const summary = prior || {key, entity_key: key, kernelId: row.kernelId,
          kind: 'kernel', identity: row.kernelId, name: row.kernelId,
          status: 'offline', activityAt: 0, entityCount: 0};
        summary.entityCount++;
        if (statusRank(row.status) > statusRank(summary.status)) summary.status = row.status;
        summary.activityAt = Math.max(summary.activityAt, row.activityAt);
        kernels.set(key, summary);
      }
      candidates = [...kernels.values()];
    } else {
      candidates = allRows.filter((row) => {
        if (options.kernelId && row.kernelId !== String(options.kernelId)) return false;
        if (options.runId && row.runId !== String(options.runId)) return false;
        if (options.environmentId && row.environmentId !== String(options.environmentId)
            && !(row.kind === 'env' && row.identity === String(options.environmentId))) return false;
        if (options.personaId && row.personaId !== String(options.personaId)
            && !(row.kind === 'persona' && row.identity === String(options.personaId))) return false;
        return true;
      });
      const requestedKinds = options.kinds?.map(canonicalKind);
      if (requestedKinds?.length) {
        const kinds = new Set(requestedKinds);
        candidates = candidates.filter((row) => kinds.has(row.kind));
      } else if (level === 'environment' || level === 'run') {
        candidates = candidates.filter((row) => row.kind === 'persona');
      } else if (level === 'persona') {
        const internals = new Set(['persona', 'subagent', 'model_call', 'tool_call', 'call', 'tool']);
        candidates = candidates.filter((row) => internals.has(row.kind));
      } else if (level === 'kernel') {
        const structural = candidates.filter((row) => ['env', 'run', 'mission'].includes(row.kind));
        if (structural.length) {
          const structuralKeys = new Set(structural.map((row) => row.key));
          candidates = candidates.filter((row) => structuralKeys.has(row.key)
            || (row.kind === 'persona' && !row.environmentId && !row.runId));
        } else candidates = candidates.filter((row) => row.kind === 'persona');
      }
    }

    if (level === 'persona') {
      for (const row of candidates) if (row.kind === 'persona') selected.add(row.key);
    }
    const score = (row) => (selected.has(row.key) ? 1_000_000 : 0)
      + (this.pinned.has(row.key) ? 600_000 : 0)
      + statusRank(row.status) * 100_000;
    candidates.sort((a, b) => score(b) - score(a) || b.activityAt - a.activityAt
      || a.key.localeCompare(b.key));
    const exact = candidates.slice(0, Math.min(exactCap, totalCap));
    const remainder = candidates.slice(exact.length);
    aggregateCap = Math.min(aggregateCap, Math.max(0, totalCap - exact.length));

    const groupFor = typeof options.groupBy === 'function'
      ? options.groupBy
      : (row) => level === 'global' ? row.status
        : level === 'kernel' ? `${row.kind}:${row.status}`
          : level === 'persona' ? `${row.kind}:${row.status}` : row.status;
    const groups = new Map();
    for (const row of remainder) {
      const group = String(groupFor(row) || 'other');
      const value = groups.get(group) || {group, rows: [], count: 0, newestAt: 0};
      value.rows.push(row);
      value.count++;
      value.newestAt = Math.max(value.newestAt, row.activityAt);
      groups.set(group, value);
    }
    let rankedGroups = [...groups.values()].sort((a, b) => b.count - a.count
      || b.newestAt - a.newestAt || a.group.localeCompare(b.group));
    if (aggregateCap && rankedGroups.length > aggregateCap) {
      const keep = rankedGroups.slice(0, Math.max(0, aggregateCap - 1));
      const rest = rankedGroups.slice(keep.length);
      keep.push({group: 'other', rows: rest.flatMap((item) => item.rows),
        count: rest.reduce((total, item) => total + item.count, 0),
        newestAt: Math.max(0, ...rest.map((item) => item.newestAt))});
      rankedGroups = keep;
    } else rankedGroups = rankedGroups.slice(0, aggregateCap);

    const scopeName = [level, options.kernelId, options.runId, options.environmentId,
      options.personaId].filter(Boolean).join(':') || level;
    const exactNodes = exact.map((row) => ({...row, nodeType: 'exact'}));
    const aggregateNodes = rankedGroups.map((item) => {
      const statusCounts = {};
      const kindCounts = {};
      for (const row of item.rows) {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
        kindCounts[row.kind] = (kindCounts[row.kind] || 0) + 1;
      }
      return {
        key: aggregateKey(scopeName, item.group),
        nodeType: 'aggregate',
        kind: 'aggregate',
        group: item.group,
        name: `+${item.count} ${item.group}`,
        count: item.count,
        statusCounts,
        kindCounts,
        activityAt: item.newestAt,
        sampleKeys: item.rows.slice(0, 5).map((row) => row.key),
      };
    });

    const exactKeys = new Set(exactNodes.map((node) => node.key));
    const byIdentity = new Map(exactNodes.map((node) => [
      `${node.kernelId}${SEP}${node.kind}${SEP}${node.identity}`, node.key,
    ]));
    const edges = [];
    for (const node of exactNodes) {
      let parentKey = String(node.parent_key || '');
      if (!parentKey && ['subagent', 'model_call', 'tool_call', 'call', 'tool'].includes(node.kind)
          && node.personaId) {
        parentKey = byIdentity.get(`${node.kernelId}${SEP}persona${SEP}${node.personaId}`) || '';
      }
      if (!parentKey && node.kind === 'persona' && node.environmentId) {
        parentKey = byIdentity.get(`${node.kernelId}${SEP}env${SEP}${node.environmentId}`) || '';
      }
      if (parentKey && exactKeys.has(parentKey)) {
        edges.push({key: `contains:${parentKey}>${node.key}`, from: parentKey,
          to: node.key, kind: 'contains'});
      }
    }
    const aggregatedCount = aggregateNodes.reduce((total, node) => total + node.count, 0);
    return {
      scope: {level, kernelId: options.kernelId || '', runId: options.runId || '',
        environmentId: options.environmentId || '', personaId: options.personaId || ''},
      nodes: [...exactNodes, ...aggregateNodes],
      exactNodes,
      aggregateNodes,
      edges,
      totals: {
        candidates: candidates.length,
        exact: exactNodes.length,
        aggregated: aggregatedCount,
        hidden: Math.max(0, candidates.length - exactNodes.length - aggregatedCount),
      },
      truncated: candidates.length > exactNodes.length,
    };
  }

  stats(at = this.now()) {
    let live = 0;
    let stale = 0;
    let offline = 0;
    for (const key of this.presence.keys()) {
      const freshness = this.presenceStatus(key, at)?.freshness;
      if (freshness === 'live') live++;
      else if (freshness === 'stale') stale++;
      else if (freshness === 'offline') offline++;
    }
    return {
      entities: this.entities.size,
      presence: this.presence.size,
      live,
      stale,
      offline,
      eventStreams: this.eventStreams.size,
      events: this._eventCount,
      pinned: this.pinned.size,
    };
  }

  clear() {
    this.entities.clear();
    this.presence.clear();
    this.eventStreams.clear();
    this.pinned.clear();
    this._eventCount = 0;
  }
}
