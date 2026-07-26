export const LOCATOR_FALLBACK_COLD_GRACE_MS = 4500;
export const LOCATOR_FALLBACK_HEALTH_CHECK_MS = 15000;
export const LOCATOR_FALLBACK_RETRY_MS = 2500;

/**
 * Full node status is an operator/detail projection, not the global discovery
 * transport. Background polling is justified only for a node the viewer has
 * authenticated to or deliberately focused. Signed discovery and telemetry
 * keep the unfocused global population live without making every browser ask
 * every node to rebuild an expensive status document.
 */
export function shouldPrefetchNodeStatus({
  credentialed = false,
  focused = false,
} = {}) {
  return Boolean(credentialed || focused);
}

/**
 * Decide whether an optional HTTP announcement locator may be queried.
 *
 * A verified libp2p data route or a recently successful direct node read is
 * enough to keep discovery on the peer network. The locator receives a bounded
 * cold-start opportunity only after those routes have had time to materialize.
 * This function selects transport timing only; it grants no identity or record
 * authority.
 */
export function locatorFallbackDecision({
  locatorEnabled = true,
  nowMs = Date.now(),
  startedAtMs = nowMs,
  verifiedP2PRouteCount = 0,
  healthyDirectPeerCount = 0,
  coldGraceMs = LOCATOR_FALLBACK_COLD_GRACE_MS,
} = {}) {
  if (!locatorEnabled) {
    return {
      queryLocator: false,
      mode: 'locator_disabled',
      nextCheckMs: LOCATOR_FALLBACK_HEALTH_CHECK_MS,
    };
  }
  if (Number(verifiedP2PRouteCount) > 0 || Number(healthyDirectPeerCount) > 0) {
    return {
      queryLocator: false,
      mode: 'p2p_direct_primary',
      nextCheckMs: LOCATOR_FALLBACK_HEALTH_CHECK_MS,
    };
  }
  const elapsedMs = Math.max(0, Number(nowMs) - Number(startedAtMs));
  const remainingGraceMs = Math.max(0, Number(coldGraceMs) - elapsedMs);
  if (remainingGraceMs > 0) {
    return {
      queryLocator: false,
      mode: 'p2p_direct_warming',
      nextCheckMs: Math.max(250, remainingGraceMs),
    };
  }
  return {
    queryLocator: true,
    mode: 'fallback_locator',
    nextCheckMs: LOCATOR_FALLBACK_RETRY_MS,
  };
}
