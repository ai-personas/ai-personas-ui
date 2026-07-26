function expiryMs(announcement) {
  const value = Date.parse(String(announcement?.expires_at || ''));
  return Number.isFinite(value) ? value : 0;
}

function sequenceOf(announcement) {
  const value = Number(announcement?.sequence);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function preferAnnouncement(left, right) {
  if (!left) return right;
  if (!right) return left;
  const sequenceDelta = sequenceOf(right) - sequenceOf(left);
  if (sequenceDelta) return sequenceDelta > 0 ? right : left;
  return expiryMs(right) >= expiryMs(left) ? right : left;
}

function liveAnnouncements(values, nowMs) {
  const result = new Map();
  for (const value of values || []) {
    const kernelId = String(value?.kernel_id || '');
    if (!kernelId || expiryMs(value) <= nowMs) continue;
    result.set(kernelId, preferAnnouncement(result.get(kernelId), value));
  }
  return result;
}

/**
 * Reconcile independently fetched resolver views without turning a temporary
 * resolver failure into a false global deletion. A complete successful page
 * walk replaces that resolver's prior view atomically. A bounded/partial walk
 * merges newly seen leases with the still-live prior leases; those retained
 * leases disappear at their own signed expiry.
 */
export function reconcileResolverDirectory(previousByEndpoint, results, {
  nowMs = Date.now(),
} = {}) {
  const previous = previousByEndpoint instanceof Map ? previousByEndpoint : new Map();
  const snapshots = new Map();
  let successfulResolvers = 0;
  let currentAdvertisedTotal = 0;

  for (const result of results || []) {
    const endpoint = String(result?.endpoint || '');
    if (!endpoint) continue;
    const prior = previous.get(endpoint);
    if (result?.successful) {
      successfulResolvers += 1;
      const incoming = liveAnnouncements(result.announcements, nowMs);
      let announcements = incoming;
      if (!result.complete) {
        announcements = liveAnnouncements(prior?.announcements?.values?.() || [], nowMs);
        for (const [kernelId, announcement] of incoming) {
          announcements.set(kernelId,
            preferAnnouncement(announcements.get(kernelId), announcement));
        }
      }
      const advertisedTotal = Math.max(announcements.size,
        Number.isSafeInteger(Number(result.total)) ? Number(result.total) : 0);
      currentAdvertisedTotal = Math.max(currentAdvertisedTotal, advertisedTotal);
      snapshots.set(endpoint, {
        announcements,
        complete: Boolean(result.complete),
        total: advertisedTotal,
        revision: String(result.revision || ''),
        updatedAt: nowMs,
      });
      continue;
    }
    if (prior) {
      const announcements = liveAnnouncements(prior.announcements?.values?.() || [], nowMs);
      if (announcements.size) snapshots.set(endpoint, {
        ...prior,
        announcements,
      });
    }
  }

  const announcements = new Map();
  for (const [endpoint, snapshot] of snapshots) {
    for (const [kernelId, value] of snapshot.announcements) {
      const candidate = {...value, source_endpoint: endpoint};
      announcements.set(kernelId,
        preferAnnouncement(announcements.get(kernelId), candidate));
    }
  }
  const announcementByBase = new Map();
  const peers = new Set();
  for (const announcement of announcements.values()) {
    const base = String(announcement?.base_url || '').replace(/\/$/, '');
    if (!base) continue;
    announcementByBase.set(base, announcement);
    peers.add(base);
  }

  // Failed resolvers contribute their still-live signed leases, but never an
  // old advertised aggregate. As soon as any resolver succeeds, the displayed
  // total is current rather than a historical maximum.
  const total = Math.max(announcements.size,
    successfulResolvers ? currentAdvertisedTotal : announcements.size);
  return {
    snapshots,
    announcements,
    announcementByBase,
    peers,
    total,
    successfulResolvers,
    fingerprint: resolverDirectoryFingerprint(announcements),
  };
}

export function resolverDirectoryFingerprint(announcements) {
  const values = announcements instanceof Map
    ? announcements.values()
    : (announcements || []);
  return [...values].map((value) => [
    String(value?.kernel_id || ''),
    String(value?.base_url || '').replace(/\/$/, ''),
    Number(value?.record_count) || 0,
    String(value?.reachability_class || ''),
    value?.public_discovery === true ? 'public' : 'hidden',
    [...(Array.isArray(value?.libp2p_multiaddrs) ? value.libp2p_multiaddrs : [])]
      .sort().join(','),
  ]).sort((left, right) => String(left[0]).localeCompare(String(right[0])))
    .map((row) => row.join('\u0000')).join('\u0001');
}

export function expiredProviderKernels(inventories, nowMs = Date.now()) {
  const expired = [];
  for (const [kernelId, inventory] of inventories || []) {
    if (!Number.isFinite(Number(inventory?.expiresAt))
        || Number(inventory.expiresAt) <= nowMs) expired.push(String(kernelId));
  }
  return expired;
}
