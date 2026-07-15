import assert from 'node:assert/strict';

import {
  environmentIdentity,
  resolveEnvironmentAuthority,
  resolveUniqueRunEnvironment,
} from '../assets/routing-authority.mjs';

const verified = {verified: true};

assert.equal(environmentIdentity('did:personaos:k/env/env:01JENVIRONMENT00000000001'),
  '01JENVIRONMENT00000000001');
assert.equal(environmentIdentity('environments/env-blue.json'), 'env-blue');
assert.equal(environmentIdentity('https://example.test/arbitrary/not-an-environment'), '');

assert.deepEqual(resolveEnvironmentAuthority({environment_id: 'env:alpha'}, {}, verified), {
  status: 'resolved', environmentId: 'alpha', candidates: ['alpha'],
  basis: 'exact_verified_reference', reason: '',
});
assert.equal(resolveEnvironmentAuthority({environment_id: 'env:alpha'}).status, 'unverified',
  'an unsigned transport field must never create an environment association');

const ambiguous = resolveEnvironmentAuthority({
  environment_ids: ['env:recent', 'env:active'],
  activity_recency: {'env:recent': 99},
  active_environment_id: 'env:active',
  task: 'words that resemble one environment charter',
}, {}, verified);
assert.equal(ambiguous.status, 'ambiguous');
assert.equal(ambiguous.environmentId, '');
assert.deepEqual(ambiguous.candidates, ['active', 'recent']);

const conflicting = resolveEnvironmentAuthority({environment_id: 'env:alpha'}, {
  owning_env_id: 'env:beta',
}, verified);
assert.equal(conflicting.status, 'ambiguous');
assert.equal(conflicting.environmentId, '');

const primary = resolveEnvironmentAuthority({
  kind: 'project',
  primary_environment_id: 'env:beta',
  host_environment_ids: ['env:alpha', 'env:beta'],
}, {}, verified);
assert.equal(primary.status, 'resolved');
assert.equal(primary.environmentId, 'beta');
assert.equal(primary.basis, 'signed_project_primary');

const stalePrimary = resolveEnvironmentAuthority({
  kind: 'project',
  primary_environment_id: 'env:retired',
  host_environment_ids: ['env:alpha', 'env:beta'],
}, {}, verified);
assert.equal(stalePrimary.status, 'conflict');
assert.equal(stalePrimary.environmentId, '');

assert.deepEqual(resolveUniqueRunEnvironment(['kernel-a\0env-alpha', 'kernel-a\0env-alpha']), {
  status: 'resolved', environmentKey: 'kernel-a\0env-alpha', candidates: ['kernel-a\0env-alpha'],
});
assert.equal(resolveUniqueRunEnvironment(['kernel-a\0env-alpha', 'kernel-a\0env-beta']).status,
  'ambiguous', 'run recency or array order must not pick an environment host');

console.log('routing authority contract: ok');
