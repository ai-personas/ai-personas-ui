import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
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
import {assertSelfContainedGltf} from '../assets/renderers/cad3d.mjs';

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
  run: 'run-1', revision: 'sha256:r1', files: [file('ws-1', 'plan.md', a), file('ws-1', 'old.csv', b)],
});
assert.equal(first.changes.baseline, true);
assert.equal(first.files.size, 2);
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
const ended = endLiveArtifactState(orderedFirst, {generated_at: '2026-07-10T12:00:04Z', reason: 'complete'});
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

const portal = await readFile(new URL('../assets/discovery.js', import.meta.url), 'utf8');
const p2pBundle = await readFile(new URL('../assets/p2p-libp2p.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.doesNotMatch(portal, /node1\.personas\.ai|GLOBAL_DISCOVERY_DEFAULT/);
assert.match(portal, /addEventListener\('live_artifact_update'/);
assert.match(portal, /addEventListener\('run_ended'/);
assert.match(portal, /setInterval\(\(\)=>\{ try\{ pollLiveArtifacts\(\)/);
assert.match(portal, /fetchVerifiedLiveBody\(sourceUrl,opts\.liveFile\.sha256\)/);
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
assert.match(portal, /UNSIGNED LIVE TRANSPORT/);
assert.doesNotMatch(portal, /delegated-ipfs\.dev|https:\/\/ipfs\.io|https:\/\/dweb\.link/);
assert.doesNotMatch(portal, /https:\/\/esm\.sh|https:\/\/cdn\.jsdelivr\.net/);
assert.match(portal, /external executable renderer dependencies are disabled/);
assert.match(portal, /P2P\.node\.contentRouting\.provide/);
assert.match(portal, /S\.gossipPeers\.add\(base\)/);
const rendezvousNamespace = 'personaos-discovery-rendezvous/v1';
assert.ok(portal.includes(rendezvousNamespace));
assert.equal(createHash('sha256').update(rendezvousNamespace).digest('hex'),
  '89d2ce7e05be64fcab15e488a0fe9d052a52be9e0c7ad54aaeecaf6417e5ec87');
assert.ok(p2pBundle.includes('/personaos/kad/1.0.0'));
assert.match(portal, /Close details/);
assert.match(portal, /cards\.push\(\{key:'rec:'\+id,task,state:'published'/);
assert.doesNotMatch(portal, /cards\.push\(\{key:'rec:'\+id,task,state:'shipped'/);
assert.match(index, /script-src 'self'/);
assert.match(index, /connect-src 'self' blob:/);
assert.match(index, /img-src 'self' blob: data:/);

console.log('live artifact state/diff contract: ok');
