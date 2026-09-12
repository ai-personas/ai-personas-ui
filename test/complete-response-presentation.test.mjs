// Complete, verified snapshots feed the real public drawer and activity rows.
// The assembly helper must not turn a partial transport set into visible text.
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
const [telemetry, json, ed, authority, artifact] = await Promise.all([
  moduleAt('public-telemetry.mjs'), moduleAt('canonical-json.mjs'), moduleAt('noble-ed25519.js'),
  moduleAt('discovery-authority.mjs'), moduleAt('live-artifacts.mjs'),
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
  section('const PUBLIC_COGNITION_SCHEMAS=', 'function _rememberVerifiedPublicCognition('),
  section('const PUBLIC_PERSONA_COGNITION_FIELDS=', 'function _currentInventoryPersona('),
  section('async function verifyCurrentMasterSignedDocument(', '// ---- C-OP-16'),
  section('function _provisionalPresentationRows(', 'function _renderPersonaWorkState('),
  section('function renderThinking(', 'function renderThinkingRedacted('),
  section('function _publicCognitionRows(', 'function ingestPersonaCognitionReads('),
  section('function connectedCallMessages(', 'function connectedFederatedCommunications('),
].join('\n');
const base = 'https://node.test', secret = new Uint8Array(32).fill(7);
const publicKey = Buffer.from(await ed.getPublicKeyAsync(secret)).toString('hex');
const S = {keyDocs:new Map([[base, {entries:[{
  key_id:'kernel-master', role:'master', status:'current', public_key_hex:publicKey,
}]}]])};
const empty = () => '';
const values = {...telemetry, ...json, ...artifact, ...authority, createPublicEvidence, ed, S,
  esc:value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
  icon:empty, copyBtn:empty, _ago:empty,
  _renderPersonaWorkState:empty, _personaAgenticDevelopmentHTML:empty,
  _taskContextForExactReferences:() => null, _verifiedPublicTaskRun:empty,
  _activityProvenanceHTML:empty, _eventTrustHTML:empty,
  _publicCallProvenance:() => ({}), _publicProvisionalProvenance:() => ({}),
};
const ui = new Function(...Object.keys(values), declarations + `\nreturn {
  present:_provisionalPresentationRows, render:renderThinking,
  hydrate:hydrateThinkingOutputText, activity:_publicCognitionRows,
  connected:connectedCallMessages,
  verifySignature:verifyCurrentMasterSignedDocument, verifyEvent:_validPublicProvisionalEvent,
};`)(...Object.values(values));
const at = new Date().toISOString();
const chunks = ['The entire ', 'measured result 🧭\n', 'is now available.'];
function chunk(index, overrides = {}) {
  const text = chunks[index], bytes = Buffer.from(text);
  return {schema:'personaos-provisional-cognition/1', authority:'kernel_observed_provider_event',
    persona_signed:false, provisional:true, kind:'assistant_message',
    call_id:'call:one', model_id:'model:fixture', persona_id:'persona:alice', call_status:'running',
    message_id:'response:one', at, sequence:index+1, chunk_index:index, chunk_count:chunks.length,
    text, utf8_bytes:bytes.length, sha256:'sha256:'+createHash('sha256').update(bytes).digest('hex'),
    ...overrides};
}
function document(events) {
  const byCall = new Map();
  for (const event of events) {
    if (!byCall.has(event.call_id)) byCall.set(event.call_id, {
      call_id:event.call_id, model_id:event.model_id, persona_id:event.persona_id,
      started_at:at, status:'running', provisional_events:[],
    });
    const {call_id, model_id, persona_id, call_status, ...nested} = event;
    byCall.get(call_id).provisional_events.push(nested);
  }
  return {schema:'personaos-persona-public-cognition/3', tier:'public', generated_at:at,
    persona_id:'persona:alice', signing_key_id:'kernel-master', active_calls:[...byCall.values()],
    recent_calls:[], provisional_outputs:events, recent_outputs:[],
    proven_facts:[], evolution_timeline:[]};
}
async function signed(doc) {
  const {signature_hex, ...body} = doc;
  return {...body, signature_hex:Buffer.from(await ed.signAsync(
    new TextEncoder().encode(json.canonicalJson(body)), secret)).toString('hex')};
}
async function admitted(doc) {
  if (!await ui.verifySignature(base, doc)) return false;
  for (const call of doc.active_calls) for (const event of call.provisional_events)
    if (!await ui.verifyEvent(event, {call, generatedAt:doc.generated_at})) return false;
  return true;
}
const assistantRows = rows => rows.filter(row => row.assistant);
const activityText = doc => ui.activity(doc).filter(row => row.kind === 'PROVISIONAL_ASSISTANT_MESSAGE');
function hydration(doc) {
  const writes = [];
  const target = {dataset:{provisionalPresentationIndex:'0'}, set textContent(value) { writes.push(value); }};
  ui.hydrate({querySelectorAll:selector => selector === '[data-provisional-presentation-index]' ? [target] : []}, doc);
  return writes;
}

test('two advertised chunks show no body; all three appear once as exact text', async () => {
  const partial = await signed(document([chunk(0), chunk(1)]));
  assert.equal(await admitted(partial), true, 'A signed incomplete snapshot can retain status facts');
  assert.deepEqual(assistantRows(ui.present(partial.provisional_outputs)), []);
  assert.equal(ui.render(partial).includes('data-provisional-presentation-index'), false);
  assert.deepEqual(activityText(partial), []);
  assert.deepEqual(ui.connected(partial), []);
  assert.deepEqual(hydration(partial), ['']);

  const complete = await signed(document([chunk(0), chunk(1), chunk(2)]));
  assert.equal(await admitted(complete), true);
  const rows = assistantRows(ui.present(complete.provisional_outputs));
  assert.equal(rows.length, 1); assert.equal(rows[0].complete, true);
  assert.equal(rows[0].text, chunks.join(''));
  assert.equal((ui.render(complete).match(/data-provisional-presentation-index/g) || []).length, 1);
  assert.deepEqual(activityText(complete).map(row => row.exactText), [chunks.join('')]);
  assert.deepEqual(ui.connected(complete).map(row => row.text), [chunks.join('')]);
  assert.deepEqual(hydration(complete), [chunks.join('')]);
  // A later tail cannot borrow its missing beginning from another snapshot.
  assert.deepEqual(assistantRows(ui.present([chunk(2)])), []);
});

test('legacy deltas never animate text and status facts remain visible', () => {
  const status = {kind:'provider_status', status:'turn_started', sequence:1, call_id:'call:one'};
  const deltas = [chunk(0, {stream_delta:true, sequence:2}), chunk(1, {stream_delta:true, sequence:3})];
  const rows = ui.present([status, ...deltas]);
  assert.deepEqual(assistantRows(rows), []);
  assert.equal(rows.length, 1); assert.equal(rows[0].event, status);
  const complete = chunks.map((_text, index) => chunk(index, {sequence:index+4}));
  assert.deepEqual(assistantRows(ui.present([...deltas, ...complete]))
    .map(row => row.text), [chunks.join('')]);
});

test('shareable deltas display once, reconcile complete text, and mark interruption', () => {
  const deltas=[chunk(0,{schema:'personaos-provisional-cognition/2',stream_delta:true,sequence:2}),
    chunk(1,{schema:'personaos-provisional-cognition/2',stream_delta:true,sequence:3})];
  const draft=assistantRows(ui.present([...deltas,deltas[1]]));
  assert.equal(draft.length,1); assert.equal(draft[0].text,chunks.slice(0,2).join(''));
  assert.equal(draft[0].complete,false); assert.equal(draft[0].interrupted,false);
  assert.equal(assistantRows(ui.present(deltas.map(event=>({...event,call_status:'finished'}))))[0].interrupted,true);
  const complete=chunks.map((_text,index)=>chunk(index,{sequence:index+4}));
  const final=assistantRows(ui.present([...deltas,...complete]));
  assert.equal(final.length,1); assert.equal(final[0].text,chunks.join('')); assert.equal(final[0].complete,true);
  assert.deepEqual(assistantRows(ui.present([...deltas,...complete])),final,'Reconnecting uses the current snapshot without accumulating text');
});

test('duplicates, missing sequences and conflicting bindings cannot form a complete message', () => {
  const complete = [chunk(0), chunk(1), chunk(2)];
  for (const events of [
    [...complete, chunk(2, {sequence:4})],
    [chunk(0), chunk(1, {sequence:3}), chunk(2, {sequence:4})],
    [chunk(1), chunk(0), chunk(2)],
    [chunk(0), chunk(1, {chunk_count:4}), chunk(2)],
    [chunk(0), chunk(1, {message_id:'response:other'}), chunk(2)],
    [chunk(0), chunk(1, {call_id:'call:other'}), chunk(2)],
    [chunk(0), chunk(1, {model_id:'model:other'}), chunk(2)],
    [chunk(0), chunk(1, {persona_id:'persona:bob'}), chunk(2)],
    [chunk(0), chunk(1, {call_status:'finished'}), chunk(2)],
  ]) {
    assert.deepEqual(assistantRows(ui.present(events)), [], 'Conflicting chunks must not blend');
    assert.deepEqual(ui.connected(document(events)), [], 'A connected public node uses the same admission');
  }
  const separate = [...complete, ...complete.map(event => ({...event, call_id:'call:other'}))];
  assert.deepEqual(assistantRows(ui.present(separate)).map(row => row.text), [chunks.join(''), chunks.join('')]);
  const anonymous = complete.map(({message_id, ...event}) => event);
  assert.deepEqual(assistantRows(ui.present(anonymous)).map(row => row.text), [chunks.join('')]);
});

test('an advertised huge count cannot allocate or expose unseen chunks', () => {
  const partial = chunk(0, {chunk_count:Number.MAX_SAFE_INTEGER});
  assert.deepEqual(assistantRows(ui.present([partial])), []);
  const {message_id, ...anonymous} = partial;
  assert.deepEqual(assistantRows(ui.present([anonymous])), []);
});

test('signature and per-chunk hashes still gate text before assembly', async () => {
  const complete = await signed(document([chunk(0), chunk(1), chunk(2)]));
  assert.equal(await admitted(complete), true);
  const changed = structuredClone(complete);
  changed.active_calls[0].provisional_events[1].text = 'Forged text';
  changed.provisional_outputs[1].text = 'Forged text';
  assert.equal(await admitted(changed), false, 'The original master signature binds every byte');
  assert.equal(await admitted(await signed(changed)), false, 'A new outer signature cannot repair a wrong chunk hash');
  const registry = S.keyDocs.get(base);
  S.keyDocs.delete(base);
  try { assert.equal(await admitted(complete), false, 'The current master key is required'); }
  finally { S.keyDocs.set(base, registry); }
});
