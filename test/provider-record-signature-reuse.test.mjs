import assert from 'node:assert/strict';
import {createHash, createPrivateKey, createPublicKey, sign, verify} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {assetRoot, canonicalJson, disabledPublicEvidenceDependencies} from './helpers/public-evidence.mjs';

const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const authority = await import(pathToFileURL(resolve(assetRoot, 'discovery-authority.mjs')));
const {publicTaskLifecycleProjection} = await import(pathToFileURL(resolve(assetRoot, 'network-view.mjs')));
const section = (start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Production section exists: ${start}`);
  return source.slice(first, last);
};
const declarations = [
  section('async function verifyRecord(', 'const isAbs='),
  section('function providerPolicyPayload(', 'async function verifyPersonaLifecycleCard('),
  section('const PUBLIC_TASK_LIFECYCLE_FIELDS=', 'async function verifyPublicCommunicationRoutes('),
  section('async function verifyCurrentMasterSignedDocument(', '// ---- C-OP-16 member-view siblings'),
  section('const PROVIDER_INVENTORY_FIELDS=', 'const PUBLIC_ENTITY_INDEX_FIELDS='),
  section('async function verifiedRecordFromDoc(', 'const PUBLIC_IDENTITY_INDEX_FIELDS='),
  section('function applyVerifiedProviderInventory(', 'function upsert('),
].join('\n');
const bytes = value => Buffer.from(canonicalJson(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const contentHash = value => `sha256:${hash(bytes(value))}`;
const epoch = Date.parse('2026-09-09T06:00:00Z');

function keyPair(label) {
  // Synthetic offline identities; never read a retained private key.
  const privateKey = createPrivateKey({key:Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(`provider-signature-reuse:${label}`).digest(),
  ]), format:'der', type:'pkcs8'});
  const publicKey = createPublicKey(privateKey).export({format:'der', type:'spki'})
    .subarray(-32).toString('hex');
  return {publicKey, signed:value => sign(null, bytes(value), privateKey).toString('hex')};
}

function fixture() {
  const key = keyPair('original'), base = 'https://public.example.test';
  const kernel = `kernel:${key.publicKey.slice(0, 16)}`;
  const boot = {kernel_id:kernel};
  const registry = {schema:'personaos-keys/1', kernelId:kernel, entries:[{
    key_id:'kernel-master', role:'master', status:'current', public_key_hex:key.publicKey,
  }]};
  const lifecycle = {
    schema:'personaos-public-task-lifecycle/2', kernel_id:kernel,
    run_id:'run-terminal', task_id:'task:terminal', current_execution:false,
    environment_id:'env:house', resumed_from_run:'', continued_from_run:'', amended_from_run:'',
    root_run_id:'run-terminal', state:'budget_exhausted', pressure:{}, review:{}, block:{},
    terminal_reason:'budget_exhausted', access:'public_read_only',
    links:{discovery:'/.well-known/personaos-discovery.json',
      live_artifacts:'/runs/run-terminal/live-artifacts', telemetry:'/telemetry/live/latest.json'},
  };
  lifecycle.revision = contentHash(lifecycle);
  lifecycle.signing_key_id = 'kernel-master';
  lifecycle.signature_hex = key.signed(lifecycle);
  const capabilities = ['public_task_lifecycle',
    ...Object.entries({state:lifecycle.state, run:lifecycle.run_id, id:lifecycle.task_id,
      current_execution:'false', environment:lifecycle.environment_id, continued_from:'',
      amended_from:'', resumed_from:'', root_run:lifecycle.root_run_id, revision:lifecycle.revision})
      .map(([name, value]) => `task_${name}:${value}`)];
  const documents = ['artifact:A', 'artifact:B', 'task:terminal'].map(recordId => {
    const task = recordId.startsWith('task:'), kind = task ? 'task' : 'artifact';
    const record = {schema:'discovery-record/1', record_id:recordId, kind,
      did:`did:personaos:${kernel}/${kind}/${task ? lifecycle.run_id : recordId}`,
      label:task ? 'Terminal task' : recordId, visibility_tier:'public',
      access_policy_ref:`policy:${recordId}`, expires_at:new Date(epoch + 60_000).toISOString(),
      capability_summary:task ? capabilities : []};
    const policy = {schema:'access-policy/1', policy_id:record.access_policy_ref,
      subject_kind:kind, subject_id:recordId, owner_persona_id:'persona:fixture',
      access_grants:[], outward_tier:'public', cross_tenant_agreement_ref:''};
    return {record, signature_hex:key.signed(record), signing_key_id:'kernel-master',
      host_kernel_id:kernel, kernel_id:kernel, base, links:{},
      access_policy:{...policy, signature_hex:key.signed(policy)},
      ...(task ? {task_lifecycle:lifecycle} : {})};
  });
  function inventory() {
    const manifest = documents.map(document => ({record_id:document.record.record_id,
      record_url:`discovery/public/records/${document.record.record_id}.json`,
      document_hash:contentHash(document)}));
    const manifestHash = contentHash(manifest);
    const providers = documents.map((document, index) => {
      const record = {schema:'provider-record/1', key:document.record.did,
        ...manifest[index], visibility_tier:'public', host_kernel_id:kernel,
        public_key_hex:key.publicKey, base_url:base, content_locator_refs:[],
        access_policy_ref:document.access_policy.policy_id, signing_key_id:'kernel-master',
        signing_key_role:'master', signing_key_status:'current',
        document_signing_key_id:'kernel-master', document_signing_key_status:'current',
        document_public_key_hex:key.publicKey, inventory_generation:1,
        inventory_manifest_hash:manifestHash};
      return {schema:'provider-record-reference/1', record,
        signature_hex:key.signed(record), document_ref:manifest[index].document_hash};
    });
    const index = {schema:'dht-provider-index/3', base, kernel_id:kernel, version:1,
      inventory_generation:1, previous_inventory_hash:'', visibility:'public',
      signing_key_id:'kernel-master', generated_at:new Date(epoch - 1000).toISOString(),
      expires_at:new Date(epoch + 600_000).toISOString(), provider_count:documents.length,
      document_count:documents.length, inventory_manifest:manifest,
      inventory_manifest_hash:manifestHash, providers,
      documents:Object.fromEntries(documents.map(document => [contentHash(document), document]))};
    index.inventory_hash = contentHash(index);
    index.signature_hex = key.signed(index);
    return index;
  }
  return {key, base, kernel, boot, registry, documents, inventory};
}

function harness(f, {reuse = true, onHash = () => {}, onVerify = () => {}} = {}) {
  let now = epoch;
  const calls = [], changes = [];
  const S = {keyDocs:new Map([[f.base, f.registry]]), providerKeyRefreshAt:new Map(),
    providerInventories:new Map(), recs:new Map(), cachedIdentityPendingKernels:new Set()};
  const dependencies = {...authority, ...disabledPublicEvidenceDependencies(), S,
    enc:new TextEncoder(), canon:canonicalJson,
    hexToBytes:hex => Buffer.from(hex || '', 'hex'),
    sha256Hex:async value => {
      const digest = hash(value);
      onHash(Buffer.from(value).toString());
      return digest;
    },
    _exactObjectFields:(value, fields) => !!value && typeof value === 'object'
      && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...fields].sort()),
    Date:class extends Date {static now() {return now;}},
    validateProviderInventoryWindow:(generated, expires) => authority.validateProviderInventoryWindow(
      generated, expires, {nowMs:now}),
    evaluatePublicRecordAccess:(record, policy, links) => authority.evaluatePublicRecordAccess(
      record, policy, links, {nowMs:now}),
    ed:{verifyAsync:async (signature, message, publicKey) => {
      calls.push({signature:Buffer.from(signature).toString('hex'), payload:Buffer.from(message).toString()});
      const ok = verify(null, message, createPublicKey({key:Buffer.concat([
        Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey),
      ]), format:'der', type:'spki'}), signature);
      onVerify(Buffer.from(message).toString());
      return ok;
    }},
    keysFor:async () => ({'kernel-master':authority.currentMasterKey(S.keyDocs.get(f.base).entries)}),
    join:(base, path) => `${base}/${path}`, opBaseKey:value => value, log() {},
    _providerInventoryIsCurrent:inventory => inventory.expiresAt > now,
    recordStoreKey:row => row.record_id, _personaLifecycleRegresses:() => false,
    upsert:row => {S.recs.set(row.record_id, row); changes.push(row.record_id);},
    _removeRecordStoreKey:id => S.recs.delete(id), persistOfflinePublicHistory() {},
    retireFastSignedIdentityRoute() {}, scheduleRealtimeRepaint() {},
  };
  const api = new Function(...Object.keys(dependencies), declarations + `
    return {verifyHttpProviderWithKeyRefresh, verifiedRecordFromDoc, verifiedRowsFromProviderIndex,
      applyVerifiedProviderInventory, disableReuse(){
        const original = verifiedRecordFromDoc;
        verifiedRecordFromDoc = (doc, keys, boot, base, plane, url, meta = {}) => original(
          doc, keys, boot, base, plane, url, {...meta, providerVerification:null});
      }};`)(...Object.values(dependencies));
  if (!reuse) api.disableReuse();
  return {...api, S, calls, changes, advance:ms => {now += ms;},
    async verifyDocument(document = f.documents[0]) {
      const envelope = authority.hydrateProviderIndex(f.inventory()).envelopes
        .find(value => value.document === document);
      assert(envelope);
      const result = await api.verifyHttpProviderWithKeyRefresh(envelope, document, f.boot, f.base);
      assert.equal(result.ok, true);
      return {envelope, result};
    },
    row(document, result, {receipt = true} = {}) {
      return api.verifiedRecordFromDoc(document, result.keys, f.boot, f.base, 'internet',
        `discovery/public/records/${document.record.record_id}.json`,
        {access:result.access, providerBaseVerified:true, providerVerification:receipt ? result : null});
    },
  };
}

test('a complete signed inventory verifies each record once and preserves the terminal lifecycle', async () => {
  const results = [];
  for (const reuse of [false, true]) {
    const f = fixture(), h = harness(f, {reuse}), index = f.inventory();
    const result = await h.verifiedRowsFromProviderIndex(index, f.base, f.boot, 'internet');
    assert.equal(result.inventory.ok, true);
    assert.equal(result.refused, 0);
    assert.equal(result.rows.length, f.documents.length);
    const inventory = {...result.inventory, complete:true};
    assert.equal(h.applyVerifiedProviderInventory(f.base, f.boot, result.rows, inventory, index), true);
    const task = h.S.recs.get('task:terminal');
    assert.equal(task._taskLifecycleVerified, true);
    const projection = publicTaskLifecycleProjection(task);
    assert.equal(projection.state, 'budget_exhausted');
    assert.equal(projection.currentExecution, false);
    assert.equal(projection.run, 'run-terminal');
    assert.equal(projection.taskId, 'task:terminal');
    results.push({rows:result.rows, calls:h.calls.length});
  }
  assert.deepEqual(results[1].rows, results[0].rows);
  assert.equal(results[0].calls, 14, 'Baseline: outer + three signatures and a repeat per record + lifecycle');
  assert.equal(results[1].calls, 11, 'Reuse removes exactly one record signature check per envelope');
});

for (const [name, mutate, accepted] of [
  ['changed record bytes', (f, _h, doc) => {doc.record.label = 'unsigned replacement';}, false],
  ['changed signature', (f, _h, doc) => {doc.signature_hex = '00'.repeat(64);}, false],
  ['changed signing key id', (f, _h, doc) => {doc.signing_key_id = 'unknown-key';}, false],
  ['changed eligible public key', f => {f.registry.entries[0].public_key_hex = keyPair('replacement').publicKey;}, false],
  ['revoked key eligibility', f => {f.registry.entries[0].status = 'revoked';}, false],
  ['changed master role', f => {f.registry.entries[0].role = 'operational';}, false],
  ['rotated current master', f => {
    f.registry.entries[0].status = 'previous';
    f.registry.entries.unshift({...f.registry.entries[0], status:'current', public_key_hex:keyPair('rotation').publicKey});
  }, true],
  ['changed document sibling', (_f, _h, doc) => {doc.links = {extra:'new locator'};}, true],
]) {
  test(`${name} takes the same fallback path as fresh record verification`, async () => {
    const f = fixture(), h = harness(f), doc = f.documents[0];
    const {result} = await h.verifyDocument(doc);
    mutate(f, h, doc);
    const before = h.calls.length, reused = await h.row(doc, result);
    const reuseCalls = h.calls.length - before;
    const freshStart = h.calls.length, fresh = await h.row(doc, result, {receipt:false});
    assert.equal(reused.ok, accepted);
    assert.deepEqual(reused, fresh);
    assert.equal(reuseCalls, h.calls.length - freshStart, 'Mismatched proof never skips a fresh key attempt');
  });
}

test('a refreshed equivalent registry can reuse its signature, but another document object cannot', async () => {
  const f = fixture(), h = harness(f), doc = f.documents[0];
  const {result} = await h.verifyDocument(doc);
  h.S.keyDocs.set(f.base, structuredClone(f.registry));
  const before = h.calls.length;
  assert.equal((await h.row(doc, result)).ok, true);
  assert.equal(h.calls.length, before, 'Current eligibility is recomputed without repeating stable crypto');
  assert.equal((await h.row(structuredClone(doc), result)).ok, true);
  assert.equal(h.calls.length, before + 1, 'No receipt is reused for another document instance');
});

test('the receipt binds the actual signature input when document bytes change across awaits', async () => {
  const f = fixture(), doc = f.documents[0], originalLabel = doc.record.label;
  doc.signature_hex = '00'.repeat(64);
  const originalDocument = canonicalJson(doc);
  let mutated = false, verifiedReplacement = false;
  const h = harness(f, {
    onHash:value => {
      if (!mutated && value === originalDocument) {
        mutated = true;
        doc.record.label = 'replacement during verification';
        doc.signature_hex = f.key.signed(doc.record);
      }
    },
    onVerify:value => {
      if (mutated && !verifiedReplacement && value === canonicalJson(doc.record)) {
        verifiedReplacement = true;
        doc.record.label = originalLabel;
        doc.signature_hex = '00'.repeat(64);
      }
    },
  });
  const {result} = await h.verifyDocument(doc);
  assert(verifiedReplacement);
  assert.equal(canonicalJson(doc), originalDocument);
  const before = h.calls.length;
  assert.equal((await h.row(doc, result)).ok, false);
  assert.equal(h.calls.length, before + 1, 'A matching old document hash cannot stand in for another verified signature');
});

test('the verified key is captured before its registry entry changes during signature verification', async () => {
  const f = fixture(), doc = f.documents[0];
  let changed = false;
  const h = harness(f, {onVerify:value => {
    if (!changed && value === canonicalJson(doc.record)) {
      changed = true;
      f.registry.entries[0].public_key_hex = keyPair('during-await').publicKey;
    }
  }});
  const {result} = await h.verifyDocument(doc);
  assert.equal(result.documentKey.public_key_hex, f.key.publicKey);
  assert.equal((await h.row(doc, result)).ok, false, 'The old verified key does not become newly eligible');
});

test('expired records, incomplete inventories and invalid lifecycle siblings retain their authority gates', async () => {
  const f = fixture(), h = harness(f), index = f.inventory();
  h.advance(120_000);
  const expired = await h.verifiedRowsFromProviderIndex(index, f.base, f.boot, 'internet');
  assert.equal(expired.inventory.ok, true, 'The outer inventory is still current');
  assert.equal(expired.refused, f.documents.length);
  assert.equal(expired.rows.length, 0, 'Expired record access remains refused');
  assert.equal(h.applyVerifiedProviderInventory(f.base, f.boot, [], {...expired.inventory, complete:false}), false);
  assert.deepEqual(h.changes, []);

  const next = fixture(), valid = harness(next);
  next.documents[2].task_lifecycle.signature_hex = '00'.repeat(64);
  const damaged = await valid.verifiedRowsFromProviderIndex(next.inventory(), next.base, next.boot, 'internet');
  assert.equal(damaged.refused, 0, 'Valid envelope/record signatures remain distinct from lifecycle evidence');
  assert.equal(damaged.rows[2]._taskLifecycleVerified, false);
  assert.equal(publicTaskLifecycleProjection(damaged.rows[2]), null);
});
