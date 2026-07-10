import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as ed from '../assets/noble-ed25519.js';
import {
  boundedLineDiff,
  decideLiveArtifactUpdate,
  endLiveArtifactState,
  LIVE_ARTIFACT_LIMITS,
  liveBodyCommitIsCurrent,
  liveArtifactFileKey,
  liveArtifactRunKey,
  sha256Hex,
  transitionLiveArtifacts,
} from '../assets/live-artifacts.mjs';
import {
  canonicalJson,
  liveAccessPolicySigningPayload,
  liveMetadataSigningPayload,
  verifyLiveArtifactEvent,
  verifyLiveArtifactSnapshot,
} from '../assets/live-signatures.mjs';
import {
  currentMasterKey,
  evaluatePublicRecordAccess,
  projectAccessPolicy,
  projectDiscoveryRecord,
  projectRecordSurface,
  providerLookupHints,
  recordVerificationEntries,
} from '../assets/discovery-authority.mjs';
import {assertSelfContainedGltf} from '../assets/renderers/cad3d.mjs';

const authorityRecord = {
  schema: 'discoverable-record/1', record_id: 'rec-a',
  did: 'did:personaos:kernel:test/artifact/rec-a', kind: 'artifact',
  label: 'minimal label', description: 'read-gated description',
  capability_summary: ['inspect'], handle: 'house-plan',
  content_hash: `sha256:${'ab'.repeat(32)}`, content_locator_ref: 'locator:private',
  access_policy_ref: 'acl-a', visibility_tier: 'public',
};
const publicGrant = (extra = {}) => ({
  schema: 'access-grant/1', grantee_kind: 'public', grantee_id: '*', access_level: 'r',
  scope_kind: '', scope_id: '', reason: '', expires_at: '', attestation_id: '', ...extra,
});
const authorityPolicy = (grants = [], extra = {}) => ({
  schema: 'access-policy/1', policy_id: 'acl-a', subject_kind: 'artifact',
  subject_id: 'rec-a', owner_persona_id: 'owner', access_grants: grants,
  outward_tier: 'public', cross_tenant_agreement_ref: null, ...extra,
});
assert.deepEqual(providerLookupHints(authorityRecord), [
  authorityRecord.content_hash, authorityRecord.did, authorityRecord.handle, authorityRecord.record_id,
]);
const historyEntries = [
  {key_id: 'kernel-master', role: 'master', status: 'archived', public_key_hex: '33'.repeat(32)},
  {key_id: 'kernel-master', role: 'master', status: 'current', public_key_hex: '11'.repeat(32)},
  {key_id: 'kernel-master', role: 'master', status: 'previous', public_key_hex: '22'.repeat(32)},
];
assert.deepEqual(recordVerificationEntries(historyEntries, 'kernel-master').map((entry) => entry.status),
  ['current', 'previous', 'archived']);
assert.equal(currentMasterKey(historyEntries), '11'.repeat(32));
assert.equal(currentMasterKey([...historyEntries, historyEntries[1]]), '');
const discoverOnly = evaluatePublicRecordAccess(authorityRecord, authorityPolicy());
assert.deepEqual({ok: discoverOnly.ok, level: discoverOnly.level, canRead: discoverOnly.canRead},
  {ok: true, level: 'discover', canRead: false});
const minimal = projectDiscoveryRecord(authorityRecord, discoverOnly.canRead);
assert.equal(minimal.label, authorityRecord.label);
assert.equal(minimal.content_locator_ref, undefined);
assert.equal(minimal.content_hash, undefined);
assert.equal(minimal.description, undefined);
const minimalPolicy = projectAccessPolicy(authorityPolicy([publicGrant()]), false);
assert.deepEqual(minimalPolicy.access_grants, []);
assert.equal(minimalPolicy.owner_persona_id, undefined);
const discoverSurface = projectRecordSurface(authorityRecord, authorityPolicy(), {
  content: 'private/body.bin', profile: 'private/profile.json',
}, discoverOnly, {base: 'https://node.example', url: 'https://node.example/record.json'});
assert.deepEqual(discoverSurface.links, {});
assert.equal(discoverSurface.base, '');
assert.equal(discoverSurface.url, '');
assert.equal(evaluatePublicRecordAccess(authorityRecord, authorityPolicy([publicGrant()])).canRead, true);
assert.equal(evaluatePublicRecordAccess(authorityRecord, authorityPolicy([publicGrant({
  expires_at: '2020-01-01T00:00:00Z',
})]), {}, {nowMs: Date.parse('2026-07-10T00:00:00Z')}).canRead, false);
assert.equal(evaluatePublicRecordAccess(authorityRecord, authorityPolicy([publicGrant({
  expires_at: '2027-02-30T00:00:00Z',
})]), {}, {nowMs: Date.parse('2026-07-10T00:00:00Z')}).canRead, false);
assert.equal(evaluatePublicRecordAccess(authorityRecord, authorityPolicy([publicGrant({
  scope_kind: 'artifact', scope_id: 'different-record',
})])).canRead, false);
assert.equal(evaluatePublicRecordAccess(authorityRecord, authorityPolicy([publicGrant({
  scope_kind: 'artifact', scope_id: 'rec-a',
})])).canRead, true);
assert.equal(evaluatePublicRecordAccess(authorityRecord,
  authorityPolicy([], {subject_id: 'other'})).ok, false);

const file = (workspace_id, path, sha256, extra = {}) => ({
  workspace_id,
  path,
  sha256,
  size_bytes: 1,
  body_url: `/body/${path}?sha256=${sha256}`,
  ...extra,
});
const a = 'a'.repeat(64);
const b = 'b'.repeat(64);
const c = 'c'.repeat(64);
const first = transitionLiveArtifacts(null, {
  run: 'run-1', task: '  inspect a changing\nworkspace  ', revision: 'sha256:r1',
  files: [file('ws-1', 'plan.md', a), file('ws-1', 'old.csv', b)],
});
assert.equal(first.changes.baseline, true);
assert.equal(first.files.size, 2);
assert.equal(first.snapshot.task, 'inspect a changing workspace');
assert.equal(liveArtifactFileKey(first.files.get('ws-1\0plan.md')), 'ws-1\0plan.md');

const next = transitionLiveArtifacts(first, {
  run: 'run-1', revision: 'sha256:r2', files: [file('ws-1', 'plan.md', c), file('ws-2', 'model.step', b)],
});
assert.deepEqual(next.changes.created.map((x) => x.path), ['model.step']);
assert.deepEqual(next.changes.modified.map((x) => [x.path, x.previous.sha256]), [['plan.md', a]]);
assert.equal(next.changes.modified[0].contentChanged, true);
assert.deepEqual(next.changes.deleted.map((x) => x.path), ['old.csv']);
assert.equal(liveArtifactRunKey('https://node.example/', 'run-1'), 'https://node.example\0run-1');

const snapshot = (revision, generated_at, files = [file('ws-1', 'plan.md', a)]) => ({
  schema: 'personaos-live-artifacts/1', run: 'run-1', revision, generated_at, files,
});
const orderedFirst = transitionLiveArtifacts(null, snapshot('sha256:r1', '2026-07-10T12:00:01Z'));
assert.deepEqual(decideLiveArtifactUpdate(orderedFirst, snapshot('sha256:r2', '2026-07-10T12:00:02Z'), {
  source: 'sse', previousRevision: 'sha256:r1',
}), {accept: true, refresh: false});
assert.equal(decideLiveArtifactUpdate(orderedFirst, snapshot('sha256:r3', '2026-07-10T12:00:03Z'), {
  source: 'sse', previousRevision: 'sha256:wrong',
}).reason, 'broken_revision_chain');
assert.equal(decideLiveArtifactUpdate(orderedFirst, snapshot('sha256:r2', '2026-07-10T12:00:02Z'), {
  source: 'poll', startedRevision: 'sha256:older', requestGeneration: 3, latestRequestGeneration: 3,
}).reason, 'state_advanced_while_polling');
assert.equal(decideLiveArtifactUpdate(orderedFirst, snapshot('sha256:r2', '2026-07-10T12:00:02Z'), {
  source: 'poll', startedRevision: 'sha256:r1', requestGeneration: 2, latestRequestGeneration: 3,
}).reason, 'stale_request_generation');
assert.equal(endLiveArtifactState(orderedFirst, {
  previous_revision: 'sha256:stale', generated_at: '2026-07-10T12:00:04Z',
}), null);
const ended = endLiveArtifactState(orderedFirst, {
  previous_revision: orderedFirst.revision, generated_at: '2026-07-10T12:00:04Z', reason: 'complete',
});
assert.equal(ended.ended, true);
assert.equal(ended.snapshot.active.calls.length, 0);
assert.equal(decideLiveArtifactUpdate(ended, snapshot('sha256:r2', '2026-07-10T12:00:05Z')).reason, 'run_ended');
const expectedBody = {...orderedFirst.files.get('ws-1\0plan.md'), revision: orderedFirst.revision, bodyKey: 'body-1'};
assert.equal(liveBodyCommitIsCurrent(expectedBody, orderedFirst, {bodyKey: 'body-1', hash: a}), true);
assert.equal(liveBodyCommitIsCurrent({...expectedBody, sha256: b}, orderedFirst, {bodyKey: 'body-1', hash: b}), false);

const many = Array.from({length: LIVE_ARTIFACT_LIMITS.maxFiles + 30}, (_, i) =>
  file('ws-limit', `dir/f-${i}.txt`, a));
many.push(file('ws-limit', `${'deep/'.repeat(LIVE_ARTIFACT_LIMITS.maxPathDepth)}x.txt`, a));
many.push(file('ws-limit', 'too-large.bin', a, {size_bytes: LIVE_ARTIFACT_LIMITS.maxFileBytes + 1}));
const limited = transitionLiveArtifacts(null, snapshot('sha256:limits', '2026-07-10T12:00:06Z', many));
assert.equal(limited.files.size, LIVE_ARTIFACT_LIMITS.maxFiles);
assert.equal(limited.snapshot.truncated, true);
assert.ok(limited.snapshot.client_omitted_file_count >= 32);

assert.doesNotThrow(() => assertSelfContainedGltf(
  new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'data:application/octet-stream;base64,AA=='}]})), 'gltf'));
assert.throws(() => assertSelfContainedGltf(
  new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},images:[{uri:'texture.png'}]})), 'gltf'),
  /external glTF dependency refused/);

const diff = boundedLineDiff('one\ntwo\nthree', 'one\nTWO\nthree\nfour');
assert.deepEqual(diff.rows.filter((x) => x.kind !== 'same').map((x) => [x.kind, x.text]), [
  ['add', 'TWO'], ['del', 'two'], ['add', 'four'],
]);
assert.equal(diff.truncated, false);
assert.equal(await sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
Object.defineProperty(globalThis, 'crypto', {value: undefined, configurable: true});
assert.equal(await sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);

const signingKey = new Uint8Array(32).fill(7);
const publicKey = await ed.getPublicKeyAsync(signingKey);
const toHex = (bytes) => [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
const signJson = async (value) => toHex(await ed.signAsync(
  new TextEncoder().encode(canonicalJson(value)), signingKey));
const keyEntries = [{key_id: 'kernel-master', role: 'master', status: 'current',
  public_key_hex: toHex(publicKey), rotated_at: '2026-07-10T00:00:00Z'}];
async function signedPolicy(nodeId, run, outwardTier = 'public') {
  const payload = {
    schema: 'access-policy/1',
    policy_id: 'acl:live-artifacts:test',
    subject_kind: 'artifact',
    subject_id: `${nodeId}:${run}`,
    owner_persona_id: 'persona-owner',
    access_grants: outwardTier === 'public' ? [{
      schema: 'access-grant/1', grantee_kind: 'public', grantee_id: '*', access_level: 'r',
      scope_kind: '', scope_id: '', reason: '', expires_at: '', attestation_id: '',
    }] : [],
    outward_tier: outwardTier,
    cross_tenant_agreement_ref: null,
  };
  return {...payload, signature_hex: await signJson(liveAccessPolicySigningPayload(payload)),
    signing_key_id: 'kernel-master'};
}
async function signedMetadata(document, outwardTier = 'public') {
  const policy = await signedPolicy(document.node_id, document.run, outwardTier);
  const out = {...document, access_policy_ref: policy.policy_id, access_policy: policy,
    signing_key_id: 'kernel-master'};
  out.signature_hex = await signJson(liveMetadataSigningPayload(out));
  return out;
}
async function resignMetadata(document) {
  document.signature_hex = await signJson(liveMetadataSigningPayload(document));
  return document;
}
async function resignPolicyAndMetadata(document) {
  document.access_policy.signature_hex = await signJson(
    liveAccessPolicySigningPayload(document.access_policy));
  return resignMetadata(document);
}

const signedSnapshot = await signedMetadata({
  schema: 'personaos-live-artifacts/1', node_id: 'kernel:test', run: 'run-signed',
  generated_at: '2026-07-10T12:00:00Z', revision: `sha256:${a}`, since_revision: null,
  visibility_tier: 'public', active: {calls: []}, workspaces: [], files: [],
});
assert.equal((await verifyLiveArtifactSnapshot(signedSnapshot, {
  keyEntries, expectedNodeId: 'kernel:test', expectedRun: 'run-signed', requirePublic: true,
})).ok, true);
const rotatedKeyEntries = [
  {key_id: 'kernel-master', role: 'master', status: 'archived', public_key_hex: 'aa'.repeat(32)},
  ...keyEntries,
  {key_id: 'kernel-master', role: 'master', status: 'previous', public_key_hex: 'bb'.repeat(32)},
];
assert.equal((await verifyLiveArtifactSnapshot(signedSnapshot, {
  keyEntries: rotatedKeyEntries, requirePublic: true,
})).ok, true);
assert.equal((await verifyLiveArtifactSnapshot(signedSnapshot, {
  keyEntries: keyEntries.map((entry) => ({...entry, role: 'persona_identity'})), requirePublic: true,
})).reason, 'current_master_key_unavailable');
const personaKeyIdSnapshot = structuredClone(signedSnapshot);
personaKeyIdSnapshot.signing_key_id = 'kernel-master/persona:owner';
personaKeyIdSnapshot.access_policy.signing_key_id = 'kernel-master/persona:owner';
await resignMetadata(personaKeyIdSnapshot);
assert.equal((await verifyLiveArtifactSnapshot(personaKeyIdSnapshot, {
  keyEntries: [{...keyEntries[0], key_id: 'kernel-master/persona:owner', role: 'persona_identity'}],
  requirePublic: true,
})).reason, 'non_master_signing_key');
assert.equal((await verifyLiveArtifactSnapshot(signedSnapshot, {
  keyEntries: [...keyEntries, {...keyEntries[0], public_key_hex: 'cc'.repeat(32)}], requirePublic: true,
})).reason, 'current_master_key_unavailable');

const unsignedSnapshot = structuredClone(signedSnapshot);
delete unsignedSnapshot.signature_hex;
assert.equal((await verifyLiveArtifactSnapshot(unsignedSnapshot, {keyEntries, requirePublic: true})).ok, false);
const tamperedSnapshot = structuredClone(signedSnapshot);
tamperedSnapshot.task = 'tampered after signing';
assert.equal((await verifyLiveArtifactSnapshot(tamperedSnapshot, {keyEntries, requirePublic: true})).ok, false);
const mismatchedRef = structuredClone(signedSnapshot);
mismatchedRef.access_policy_ref = 'acl:wrong';
await resignMetadata(mismatchedRef);
assert.equal((await verifyLiveArtifactSnapshot(mismatchedRef, {keyEntries, requirePublic: true})).reason,
  'access_policy_ref_mismatch');
const stalePolicySignature = structuredClone(signedSnapshot);
stalePolicySignature.access_policy.owner_persona_id = 'tampered-owner';
await resignMetadata(stalePolicySignature);
assert.equal((await verifyLiveArtifactSnapshot(stalePolicySignature, {keyEntries, requirePublic: true})).reason,
  'access_policy_signature_invalid');
const expiredGrant = structuredClone(signedSnapshot);
expiredGrant.access_policy.access_grants[0].expires_at = '2026-07-09T00:00:00Z';
await resignPolicyAndMetadata(expiredGrant);
assert.equal((await verifyLiveArtifactSnapshot(expiredGrant, {
  keyEntries, requirePublic: true, nowMs: Date.parse('2026-07-10T00:00:00Z'),
})).reason, 'public_read_not_granted');
for (const alias of ['read', 'write']) {
  const aliasedLevel = structuredClone(signedSnapshot);
  aliasedLevel.access_policy.access_grants[0].access_level = alias;
  await resignPolicyAndMetadata(aliasedLevel);
  assert.equal((await verifyLiveArtifactSnapshot(aliasedLevel, {
    keyEntries, requirePublic: true,
  })).reason, 'public_read_not_granted');
}
for (const invalidExpiry of ['07/11/2026', '2026-02-30T00:00:00Z']) {
  const invalidExpiryGrant = structuredClone(signedSnapshot);
  invalidExpiryGrant.access_policy.access_grants[0].expires_at = invalidExpiry;
  await resignPolicyAndMetadata(invalidExpiryGrant);
  assert.equal((await verifyLiveArtifactSnapshot(invalidExpiryGrant, {
    keyEntries, requirePublic: true, nowMs: Date.parse('2026-01-01T00:00:00Z'),
  })).reason, 'public_read_not_granted');
}
const naiveUtcGrant = structuredClone(signedSnapshot);
naiveUtcGrant.access_policy.access_grants[0].expires_at = '2026-07-10T00:30:00';
await resignPolicyAndMetadata(naiveUtcGrant);
assert.equal((await verifyLiveArtifactSnapshot(naiveUtcGrant, {
  keyEntries, requirePublic: true, nowMs: Date.parse('2026-07-10T00:00:00Z'),
})).ok, true);
assert.equal((await verifyLiveArtifactSnapshot(naiveUtcGrant, {
  keyEntries, requirePublic: true, nowMs: Date.parse('2026-07-10T01:00:00Z'),
})).reason, 'public_read_not_granted');
const scopedGrant = structuredClone(signedSnapshot);
scopedGrant.access_policy.access_grants[0].scope_kind = 'artifact';
scopedGrant.access_policy.access_grants[0].scope_id = 'some-other-artifact';
await resignPolicyAndMetadata(scopedGrant);
assert.equal((await verifyLiveArtifactSnapshot(scopedGrant, {keyEntries, requirePublic: true})).reason,
  'public_read_not_granted');
const partialScopeGrant = structuredClone(signedSnapshot);
partialScopeGrant.access_policy.access_grants[0].scope_kind = 'artifact';
await resignPolicyAndMetadata(partialScopeGrant);
assert.equal((await verifyLiveArtifactSnapshot(partialScopeGrant, {
  keyEntries, requirePublic: true,
})).reason, 'public_read_not_granted');
const exactScopeGrant = structuredClone(signedSnapshot);
exactScopeGrant.access_policy.access_grants[0].scope_kind = exactScopeGrant.access_policy.subject_kind;
exactScopeGrant.access_policy.access_grants[0].scope_id = exactScopeGrant.access_policy.subject_id;
await resignPolicyAndMetadata(exactScopeGrant);
assert.equal((await verifyLiveArtifactSnapshot(exactScopeGrant, {
  keyEntries, requirePublic: true,
})).ok, true);
const operatorSnapshot = await signedMetadata({
  ...signedSnapshot, signature_hex: undefined, access_policy: undefined, access_policy_ref: undefined,
  signing_key_id: undefined, visibility_tier: 'operator',
}, 'persona_only');
assert.equal((await verifyLiveArtifactSnapshot(operatorSnapshot, {keyEntries, requirePublic: false})).ok, true);
assert.equal((await verifyLiveArtifactSnapshot(operatorSnapshot, {keyEntries, requirePublic: true})).reason,
  'public_read_not_granted');

const signedEvent = await signedMetadata({
  schema: 'personaos-live-artifact-event/1', node_id: 'kernel:test', run: 'run-signed',
  revision: signedSnapshot.revision, previous_revision: null,
  generated_at: '2026-07-10T12:00:01Z', endpoint: '/runs/run-signed/live-artifacts',
  snapshot: signedSnapshot,
});
assert.equal((await verifyLiveArtifactEvent(signedEvent, {
  keyEntries, expectedNodeId: 'kernel:test', requirePublic: true,
})).kind, 'snapshot');
const tamperedEvent = structuredClone(signedEvent);
tamperedEvent.snapshot.task = 'tampered nested snapshot';
await resignMetadata(tamperedEvent);
assert.match((await verifyLiveArtifactEvent(tamperedEvent, {keyEntries, requirePublic: true})).reason,
  /^snapshot_/);
const endedEvent = await signedMetadata({
  schema: 'personaos-live-artifact-event/1', node_id: 'kernel:test', run: 'run-signed',
  revision: null, previous_revision: signedSnapshot.revision,
  generated_at: '2026-07-10T12:00:02Z', endpoint: '/runs/run-signed/live-artifacts',
  state: 'run_ended', active: false, snapshot: null,
});
assert.equal((await verifyLiveArtifactEvent(endedEvent, {
  keyEntries, requirePublic: true, expectedPreviousRevision: signedSnapshot.revision,
})).kind, 'run_ended');
assert.equal((await verifyLiveArtifactEvent(endedEvent, {
  keyEntries, requirePublic: true, expectedPreviousRevision: `sha256:${b}`,
})).reason, 'broken_terminal_revision_chain');
const unsignedEndedEvent = structuredClone(endedEvent);
delete unsignedEndedEvent.signature_hex;
assert.equal((await verifyLiveArtifactEvent(unsignedEndedEvent, {keyEntries, requirePublic: true})).ok, false);

const portal = await readFile(new URL('../assets/discovery.js', import.meta.url), 'utf8');
const p2pBundle = await readFile(new URL('../assets/p2p-libp2p.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.doesNotMatch(portal, /node1\.personas\.ai|GLOBAL_DISCOVERY_DEFAULT/);
assert.match(portal, /addEventListener\('live_artifact_update'/);
assert.match(portal, /addEventListener\('run_ended'/);
assert.match(portal, /project\?\.label\|\|state\.snapshot\?\.task\|\|state\.run/);
assert.match(portal, /query\.get\('local_discovery'\)!=='1'/);
assert.match(portal, /location\.hostname==='ai-personas\.github\.io'/);
assert.match(portal, /query\.get\('origin_discovery'\)==='1'/);
assert.match(portal, /setInterval\(\(\)=>\{ try\{ pollLiveArtifacts\(\)/);
assert.match(portal, /opts\.liveFile\?\.sha256\|\|opts\.contentHash/);
assert.match(portal, /fetchVerifiedLiveBody\(sourceUrl,expectedHash\)/);
assert.match(portal, /const bodyUnavailable=hashAdvertised\?!verified\?\.ok/);
assert.match(portal, /data-act="secure-download"/);
assert.match(portal, /type:'application\/octet-stream'/);
assert.match(portal, /redirect:'error'/);
assert.match(portal, /credentials:'omit'/);
assert.match(portal, /referrerPolicy:'no-referrer'/);
assert.match(portal, /safeRenderMime/);
assert.match(portal, /setAttribute\('sandbox',''\)/);
assert.doesNotMatch(portal, /function dlHref/);
assert.match(portal, /sessionStorage\.setItem\('personaos_operator'/);
assert.doesNotMatch(portal, /localStorage\.setItem\('personaos_operator'/);
assert.doesNotMatch(portal, /needs no token|localhost\s*=\s*operator|per-install token/i);
assert.doesNotMatch(portal, /new EventSource\(esUrl\)/);
assert.match(portal, /authenticated polling \(token omitted from URL\)/);
assert.match(portal, /KERNEL-SIGNED · VERIFIED/);
assert.doesNotMatch(portal, /UNSIGNED LIVE TRANSPORT/);
assert.doesNotMatch(portal, /UNSIGNED LIVE METADATA/);
assert.doesNotMatch(portal, /delegated-ipfs\.dev|https:\/\/ipfs\.io|https:\/\/dweb\.link/);
assert.doesNotMatch(portal, /https:\/\/esm\.sh|https:\/\/cdn\.jsdelivr\.net/);
assert.match(portal, /external executable renderer dependencies are disabled/);
assert.match(portal, /P2P\.node\.contentRouting\.provide/);
assert.match(portal, /verifyHttpProviderEnvelope\(envelope,doc,keys,boot,base,expectedKey=''/);
assert.match(portal, /P2P\.resolveProvider\(key,\{timeoutMs:5000\}\)/);
assert.match(portal, /signing_key_status!=='current'/);
assert.match(portal, /legacy or malformed provider pointer refused/);
assert.match(portal, /recordVerificationEntries\(keyEntries,doc\?\.signing_key_id\)/);
assert.match(portal, /untrusted lookup hint only; awaiting current-master ProviderRecord/);
const gossipHandler = portal.slice(portal.indexOf('function onGossipRecord'),
  portal.indexOf('let _p2pRendezvousCid'));
assert.match(gossipHandler, /queueProviderHints\(doc\.record/);
assert.doesNotMatch(gossipHandler, /upsert\(|S\.recs/);
assert.doesNotMatch(portal, /S\.gossipPeers\.add\(base\)/);
assert.doesNotMatch(portal, /tier==='public'\?'discover \(public read\)'/);
const rendezvousNamespace = 'personaos-discovery-rendezvous/v1';
assert.ok(portal.includes(rendezvousNamespace));
assert.equal(createHash('sha256').update(rendezvousNamespace).digest('hex'),
  '89d2ce7e05be64fcab15e488a0fe9d052a52be9e0c7ad54aaeecaf6417e5ec87');
assert.ok(p2pBundle.includes('/personaos/kad/1.0.0'));
assert.ok(p2pBundle.includes('/personaos/provider-record/1.0.0'));
assert.ok(p2pBundle.includes('personaos-browser-provider-resolution/1'));
assert.match(portal, /Close details/);
assert.match(portal, /cards\.push\(\{key:'rec:'\+id,task,state:'published'/);
assert.doesNotMatch(portal, /cards\.push\(\{key:'rec:'\+id,task,state:'shipped'/);
assert.match(index, /script-src 'self'/);
assert.match(index, /connect-src 'self' blob:/);
assert.match(index, /img-src 'self' blob: data:/);

console.log('live artifact state/diff contract: ok');
