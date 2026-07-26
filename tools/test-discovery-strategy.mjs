import assert from 'node:assert/strict';
import {
  LOCATOR_FALLBACK_COLD_GRACE_MS,
  locatorFallbackDecision,
} from '../assets/discovery-strategy.mjs';

const start = 1_000_000;

assert.deepEqual(locatorFallbackDecision({
  locatorEnabled: false,
  nowMs: start,
  startedAtMs: start,
}), {
  queryLocator: false,
  mode: 'locator_disabled',
  nextCheckMs: 15000,
});

const warming = locatorFallbackDecision({
  nowMs: start + 1000,
  startedAtMs: start,
});
assert.equal(warming.queryLocator, false);
assert.equal(warming.mode, 'p2p_direct_warming');
assert.equal(warming.nextCheckMs, LOCATOR_FALLBACK_COLD_GRACE_MS - 1000);

const p2p = locatorFallbackDecision({
  nowMs: start + 60_000,
  startedAtMs: start,
  verifiedP2PRouteCount: 1,
});
assert.equal(p2p.queryLocator, false);
assert.equal(p2p.mode, 'p2p_direct_primary');

const direct = locatorFallbackDecision({
  nowMs: start + 60_000,
  startedAtMs: start,
  healthyDirectPeerCount: 2,
});
assert.equal(direct.queryLocator, false);
assert.equal(direct.mode, 'p2p_direct_primary');

const fallback = locatorFallbackDecision({
  nowMs: start + LOCATOR_FALLBACK_COLD_GRACE_MS,
  startedAtMs: start,
});
assert.equal(fallback.queryLocator, true);
assert.equal(fallback.mode, 'fallback_locator');
assert.equal(fallback.nextCheckMs, 2500);

console.log('discovery strategy tests passed');
