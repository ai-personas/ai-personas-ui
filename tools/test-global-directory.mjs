import assert from 'node:assert/strict';
import {
  expiredProviderKernels,
  reconcileResolverDirectory,
  resolverDirectoryFingerprint,
} from '../assets/global-directory.mjs';

const now = Date.parse('2026-07-26T12:00:00Z');
const live = (kernel, sequence = 1, expires = '2026-07-26T12:05:00Z') => ({
  kernel_id: kernel,
  base_url: `https://${kernel}.example`,
  sequence,
  expires_at: expires,
  record_count: sequence,
});

const first = reconcileResolverDirectory(new Map(), [{
  endpoint: 'https://resolver.example',
  successful: true,
  complete: true,
  total: 2,
  announcements: [live('kernel:a'), live('kernel:b')],
}], {nowMs: now});
assert.equal(first.announcements.size, 2);
assert.equal(first.total, 2);

const replacement = reconcileResolverDirectory(first.snapshots, [{
  endpoint: 'https://resolver.example',
  successful: true,
  complete: true,
  total: 1,
  announcements: [live('kernel:b', 2)],
}], {nowMs: now + 1_000});
assert.deepEqual([...replacement.announcements.keys()], ['kernel:b']);
assert.equal(replacement.total, 1, 'the total is current, never a historical maximum');
assert.notEqual(replacement.fingerprint, first.fingerprint);

const leaseRefresh = reconcileResolverDirectory(first.snapshots, [{
  endpoint: 'https://resolver.example',
  successful: true,
  complete: true,
  total: 2,
  announcements: [
    {...live('kernel:a', 9, '2026-07-26T12:06:00Z'), record_count: 1},
    {...live('kernel:b', 9, '2026-07-26T12:06:00Z'), record_count: 1},
  ],
}], {nowMs: now + 1_000});
assert.equal(leaseRefresh.fingerprint, first.fingerprint,
  'a lease heartbeat alone must not trigger a heavyweight record rediscovery');

const partial = reconcileResolverDirectory(first.snapshots, [{
  endpoint: 'https://resolver.example',
  successful: true,
  complete: false,
  total: 200,
  announcements: [live('kernel:b', 3)],
}], {nowMs: now + 2_000});
assert.equal(partial.announcements.size, 2, 'partial walks retain prior live leases');
assert.equal(partial.announcements.get('kernel:b').sequence, 3);

const failed = reconcileResolverDirectory(first.snapshots, [{
  endpoint: 'https://resolver.example', successful: false,
}], {nowMs: now + 3_000});
assert.equal(failed.announcements.size, 2, 'transient failure does not invent deletions');

const expired = reconcileResolverDirectory(first.snapshots, [{
  endpoint: 'https://resolver.example', successful: false,
}], {nowMs: Date.parse('2026-07-26T12:06:00Z')});
assert.equal(expired.announcements.size, 0, 'signed lease expiry removes stale nodes');
assert.equal(expired.total, 0);

assert.equal(resolverDirectoryFingerprint(new Map([
  ['b', live('kernel:b')], ['a', live('kernel:a')],
])), resolverDirectoryFingerprint(new Map([
  ['a', live('kernel:a')], ['b', live('kernel:b')],
])));
assert.deepEqual(expiredProviderKernels(new Map([
  ['kernel:live', {expiresAt: now + 1}],
  ['kernel:expired', {expiresAt: now}],
]), now), ['kernel:expired']);

console.log('global directory tests passed');
