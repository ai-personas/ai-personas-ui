// Exercise the actual retained-state, feed and drawer paths with signed
// snapshots arriving independently through GET and SSE.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import {createPublicEvidence} from './helpers/public-evidence.mjs';

const assets = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assets, 'discovery.js'), 'utf8');
const moduleAt = name => import(pathToFileURL(resolve(assets, name)));
const [json, ed, authority, telemetry] = await Promise.all([
  moduleAt('canonical-json.mjs'), moduleAt('noble-ed25519.js'),
  moduleAt('discovery-authority.mjs'), moduleAt('public-telemetry.mjs'),
]);
const section = (start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing shipped declarations: ${start}`);
  return source.slice(first, last);
};
const declarations = [
  section('const enc=new TextEncoder();', 'const pad='),
  section('function canon(v){', 'async function verifyRecord('),
  section('const _exactObjectFields=', ';\n') + ';',
  section('const SHA256_CONTENT_RE=', ';\n') + ';',
  section('const PUBLIC_COGNITION_SCHEMAS=', 'function _personaModelHistory('),
  section('function _freshPublicGeneratedAt(', 'function _safeEntityMap('),
  section('async function verifyCurrentMasterSignedDocument(', '// ---- C-OP-16'),
  section('const PUBLIC_PERSONA_COGNITION_FIELDS=', 'function _currentInventoryPersona('),
  section('async function verifyPublicPersonaCognition(', 'function _cognitionPreview('),
  section('function _removeRecordStoreKey(', 'function _providerInventoryIsCurrent('),
  section('function _cognitionPreview(', 'function _publicProvenanceAtom('),
  section('function ingestPersonaCognitionReads(', 'function refreshLiveSection('),
].join('\n');
const base = 'https://node.test', kernel = 'kernel:fixture', pid = 'persona:alice';
const personaKey = `${kernel}/alice`, secret = new Uint8Array(32).fill(7);
const publicKey = Buffer.from(await ed.getPublicKeyAsync(secret)).toString('hex');
const stamp = delta => new Date(Date.now() - 10000 + delta).toISOString();
const startedAt = stamp(0), earlier = stamp(1000), later = stamp(2000), next = stamp(3000);
const chunks = ['A complete ', 'verified response.'];
const identityFields = Object.fromEntries(['name', 'characteristics', 'avatar']
  .map(field => [field, {state:'pending', persona_authored:false}]));
const bodyTexts = doc => telemetry.publicProvisionalPresentationRows(doc.provisional_outputs)
  .filter(row => row.assistant).map(row => row.text);
function document(count = chunks.length, {at = later, model = 'model:current', text = chunks,
  personaId = pid, calls = true} = {}) {
  const events = calls ? text.slice(0, count).map((value, index) => ({
    schema:'personaos-provisional-cognition/1', authority:'kernel_observed_provider_event',
    persona_signed:false, provisional:true, kind:'assistant_message', message_id:'response:one',
    at:startedAt, sequence:index+1, chunk_index:index, chunk_count:text.length, text:value,
    utf8_bytes:Buffer.byteLength(value),
    sha256:'sha256:'+createHash('sha256').update(value).digest('hex'),
  })) : [];
  const call = {call_id:'call:one', model_id:model, persona_id:personaId, started_at:startedAt,
    requested_purpose:'persona_turn', environment_id:'environment:one', status:'running',
    reasoning_effort:'', reasoning_effort_source:'', run_id:'run:one', task_id:'task:one',
    provisional_events:events};
  return {schema:'personaos-persona-public-cognition/3', tier:'public', persona_id:personaId,
    generated_at:at, signing_key_id:'kernel-master', active_calls:calls ? [call] : [], recent_calls:[],
    provisional_outputs:events.map(event => ({...event, call_id:call.call_id,
      model_id:model, persona_id:personaId, call_status:call.status})),
    recent_outputs:[], proven_facts:[], evolution_timeline:[], name:'',
    identity_fields:identityFields, identity_materialization_state:'pending', lifecycle_state:'active',
    current_work_state:{}, work_state_history:[],
    brain_episode_count:0, brain_evolution_application_count:0, brain_evolution_decision_count:0,
    brain_fragment_binding_count:0, brain_fragment_count:0,
    agentic_development:{schema:'personaos-persona-agentic-development/4',
      expertise_awarded_by_substrate:false, semantic_interpretation_performed:false,
      authored_knowledge:[], authored_methods:[], active_bindings:[], recent_action_practice:[],
      acquired_capabilities:[], acquired_tools:[], tool_invocations:[], local_executions:[]}};
}
async function signed(doc) {
  const {signature_hex, ...body} = doc;
  return {...body, signature_hex:Buffer.from(await ed.signAsync(
    new TextEncoder().encode(json.canonicalJson(body)), secret)).toString('hex')};
}
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return {promise, resolve};
}
function fixture() {
  const row = {kind:'persona', did:pid, _kernel:kernel};
  const S = {keyDocs:new Map([[base, {kernelId:kernel, entries:[{
    key_id:'kernel-master', role:'master', status:'current', public_key_hex:publicKey,
  }]}]]), verifiedPublicCognitionByPersona:new Map(), cognitionByPersona:new Map(),
    personaDiscoveryByKey:new Map([[personaKey, row]]), liveByPersona:new Map(),
    recs:new Map([['persona', row]]), order:['persona'],
    drawerThinkPid:pid, drawerLiveBase:base, drawerLiveKernel:kernel};
  const requests = [], rendered = [], indexed = [], logs = [];
  let paints = 0, api;
  const target = {innerHTML:'', querySelectorAll:() => []};
  const values = {...json, ...authority, createPublicEvidence, ed, S,
    NETWORK_LIMITS:{cognitionPersonas:24}, NETWORK:{removeEntity() {}},
    networkEntityKey:() => personaKey, _shortId:value => String(value).split(':').pop(),
    _personaKey:(node, persona) => `${node}/${String(persona).split(':').pop()}`,
    log:(...args) => logs.push(args), _friendlyInstant:value => value,
    esc:value => String(value), $:() => target, tokenFor:() => '',
    join:(root, path) => `${root}/${path}`, fetchEntityFeed:async () => null,
    fetchResponsivePublicJson:() => {
      const request = deferred(); requests.push(request); return request.promise;
    },
    // Seed an independently admitted discovery identity, then exercise the
    // complete production cognition verifier before every transport admission.
    _currentInventoryPersona:(node, shortId) => node === kernel && shortId === 'alice'
      ? S.personaDiscoveryByKey.get(personaKey) : null,
    signedPersonaIdentity:record => record ? {canonicalId:'alice', signedId:pid} : null,
    personaLifecycleProjection:records => records.has(personaKey) ? {
      lifecycleState:'active', materializationState:'pending',
      identityFields:Object.fromEntries(Object.entries(identityFields)
        .map(([field, value]) => [field, {state:value.state, personaAuthored:value.persona_authored}])),
    } : null,
    sha256Hex:async bytes => createHash('sha256').update(bytes).digest('hex'),
    renderThinking:doc => {
      rendered.push(doc); return JSON.stringify(bodyTexts(doc));
    },
    hydrateThinkingOutputText() {}, renderThinkingRedacted:() => '',
    scheduleRealtimeRepaint:() => { paints++; }, _refreshPersonaInteractionIndex() {},
    _indexPublicCognitionActiveCalls:(key, calls) => indexed.push({key, calls}),
    _publicCognitionRows:doc => telemetry.publicProvisionalPresentationRows(doc.provisional_outputs)
      .filter(row => row.assistant).map(row => ({source:'provider', kind:'PROVISIONAL_ASSISTANT_MESSAGE',
        msg:row.text, exactText:row.text, at:doc.generated_at, dedup:row.events,
        presentationKey:row.presentationKey, providerProvisional:true, providerComplete:true,
        personaSigned:false})),
    _rememberPersonaCognitionEvent:event => {
      const key = `${event._kernel}/${event.actor_id}`;
      let rows = S.cognitionByPersona.get(key);
      if (!rows) S.cognitionByPersona.set(key, rows = new Map());
      rows.set(event._key, event);
    },
  };
  api = new Function(...Object.keys(values), declarations + `\nreturn {
    remember:_rememberVerifiedPublicCognition, ingest:ingestPersonaCognitionReads,
    remove:_removeRecordStoreKey,
    verify:doc => verifyPublicPersonaCognition('${base}', doc,
      {personaId:'${pid}', kernel:'${kernel}'}),
  };`)(...Object.values(values));
  return {...api, S, requests, rendered, indexed, logs, target, paints:() => paints,
    reintroduce:() => { S.personaDiscoveryByKey.set(personaKey, row); },
    retained:() => S.verifiedPublicCognitionByPersona.get(personaKey),
    receive:async doc => {
      if (!await api.verify(doc)) return false;
      api.ingest([{candidate:{key:personaKey, sid:'alice', kernel, endpointId:pid}, t:doc, usedBase:base}]);
      return true;
    },
    remember:doc => api.remember(personaKey, doc, {base, kernel, personaId:pid}),
  };
}

test('an older signed partial cannot replace a completed snapshot or reset feed state', async () => {
  const f = fixture(), complete = await signed(document()),
    partial = await signed(document(1, {at:earlier, model:'model:older'}));
  await f.receive(complete);
  const retained = f.retained(), interactions = [...f.S.interactions], paints = f.paints();
  assert.deepEqual(bodyTexts(retained.doc), [chunks.join('')]);
  await f.receive(partial);
  assert.equal(f.retained(), retained);
  assert.deepEqual(bodyTexts(f.retained().doc), [chunks.join('')]);
  assert.deepEqual(f.S.interactions, interactions);
  assert.equal(f.indexed.length, 1, 'Rejected snapshots cannot reset active call projections');
  assert.equal(f.paints(), paints);
});

test('equal-time exact repeats are idempotent; conflicting signed documents have no ordering', async () => {
  const f = fixture(), complete = await signed(document());
  await f.receive(complete);
  const retained = f.retained(), row = f.S.interactions[0];
  const repeat = await signed(Object.fromEntries(Object.entries(document()).reverse()));
  await f.receive(repeat);
  assert.equal(f.retained().doc, retained.doc);
  assert.equal(f.S.interactions.length, 1);
  assert.equal(f.S.interactions[0], row);
  for (const conflicting of [document(1), document(2, {text:['A different ', 'complete response.']})]) {
    const candidate = await signed(conflicting);
    assert.equal(await f.verify(candidate), true);
    assert.deepEqual(f.remember(candidate), {
      accepted:false, reason:'same_time_conflicting_snapshot', doc:complete, modelHistoryChanged:false,
    });
    await f.receive(candidate);
    assert.equal(f.retained().doc, complete);
    assert.equal(f.S.interactions[0], row);
  }
  assert.ok(f.logs.some(([, message]) => message.includes('same_time_conflicting_snapshot')));
});

test('newer signed snapshots can change or clear calls, without any content-based ordering', async () => {
  const f = fixture(), complete = await signed(document());
  await f.receive(complete);
  const newer = await signed(document(0, {at:next, calls:false}));
  await f.receive(newer);
  assert.equal(f.retained().doc, newer);
  assert.deepEqual(f.indexed.at(-1).calls, []);
  await f.receive(complete);
  assert.equal(f.retained().doc, newer);
});

test('timestamp ordering retains signed submillisecond precision and timezone equivalence', async () => {
  const f = fixture();
  const second = earlier.slice(0, 19), older = `${second}.123400Z`, newer = `${second}.123401Z`;
  const partial = await signed(document(1, {at:older})), complete = await signed(document(2, {at:newer}));
  await f.receive(partial); await f.receive(complete);
  assert.equal(f.retained().doc, complete, 'Distinct signed microseconds remain ordered');
  await f.receive(partial);
  assert.equal(f.retained().doc, complete);
  const equivalent = await signed(document(1, {at:`${second}.1234010+00:00`}));
  assert.equal(f.remember(equivalent).reason, 'same_time_conflicting_snapshot');
  assert.equal(f.retained().doc, complete);
});

test('signature, key and inventory invalidation still gate admission and clear retained ordering', async () => {
  const f = fixture(), complete = await signed(document());
  await f.receive(complete);
  const changed = {...complete, generated_at:next};
  assert.equal(await f.receive(changed), false);
  assert.equal(f.retained().doc, complete);
  const keys = f.S.keyDocs.get(base);
  f.S.keyDocs.delete(base);
  assert.equal(await f.receive(await signed(document(2, {at:next}))), false);
  assert.equal(f.remove('persona'), true);
  assert.equal(f.retained(), undefined);
  f.S.keyDocs.set(base, keys);
  const reintroduced = await signed(document(1, {at:earlier}));
  assert.equal(await f.receive(reintroduced), false, 'A retired persona cannot authorize a new snapshot');
  f.reintroduce();
  await f.receive(reintroduced);
  assert.equal(f.retained().doc, reintroduced, 'Invalidation clears the retained timestamp with its document');
});
