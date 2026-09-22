import test from 'node:test';
import assert from 'node:assert/strict';
import { inferenceEvidence, learningKind } from '../src/inference-evidence.ts';
const ref = { id: 'a'.repeat(32), revision: 2 };
test('missing receipts and measurements are unknown rather than zero', () => {
  for (const value of [null, undefined, 3, [], {}]) {
    const facts = inferenceEvidence(value);
    assert.equal(facts.measured, undefined);
    for (const key of ['recovery', 'learning', 'discovery', 'questions', 'contextBytes']) assert.equal(facts[key], undefined);
  }
});
test('discovery and selected learning have distinct exact references', () => {
  const facts = inferenceEvidence({ discovery_context: {schema:'discovery-context/1',stage:'admitted_request',transport_boundary:'pre_dispatch', offered:[{version:ref}]},
    learning_context:{schema:'learning-context/1',stage:'admitted_request',transport_boundary:'pre_dispatch', active:[], correction_notices:[ref]}});
  assert.deepEqual(facts.discovery.offered, [ref]);
  assert.deepEqual(facts.learning.active, []);
  assert.deepEqual(facts.learning.corrections, [ref]);
});
test('active lesson references use the actual fragment field', () => {
  assert.deepEqual(inferenceEvidence({learning_context:{schema:'learning-context/1',stage:'admitted_request',transport_boundary:'pre_dispatch',active:[{fragment:ref}],correction_notices:[]}}).learning.active, [ref]);
});
test('unsupported receipt schemas do not become evidence', () => {
  const facts = inferenceEvidence({ discovery_context:{schema:'different',offered:[]}, context_recovery:{schema:'different',omitted_history:[]}});
  assert.equal(facts.discovery, undefined); assert.equal(facts.recovery, undefined);
});
test('invalid references are not counted as a partial successful list', () => {
  for (const invalid of [{id:'../path',revision:1}, {id:ref.id,revision:0}, {id:ref.id,revision:2.1}, {id:ref.id,revision:Number.MAX_SAFE_INTEGER+1}]) {
    assert.equal(inferenceEvidence({discovery_context:{schema:'discovery-context/1',stage:'admitted_request',transport_boundary:'pre_dispatch',offered:[{version:ref},{version:invalid}]}}).discovery.offered, undefined);
  }
});
test('provider usage requires coherent known numbers and cached input consistency', () => {
  const usage = {known:true,input:20,output:5,cached:10};
  assert.deepEqual(inferenceEvidence({usage}).measured, {input:20,output:5,cached:10});
  for (const change of [{known:false},{known:1},{cached:21},{input:-1},{output:NaN},{input:Number.MAX_SAFE_INTEGER,output:1},{cached:null}]) {
    assert.equal(inferenceEvidence({usage:{...usage,...change}}).measured, undefined);
  }
});
test('recovery distinguishes old receipt omissions, command references and log excerpts', () => {
  const r = inferenceEvidence({context_recovery:{schema:'context-recovery/1',omitted_history:[{}],projected_commands:[{},{}],projected_diagnostics:[{},{},{}],omitted_discovery_candidates:4,original_request_bytes:9000}}).recovery;
  assert.deepEqual(r, {history:1,commands:2,diagnostics:3,previews:4,retention:undefined,originalBytes:9000});
});
test('oversized receipt vectors and untrusted negative counts remain unknown', () => {
  const r = inferenceEvidence({context_recovery:{schema:'context-recovery/1',omitted_history:Array(513).fill({}),omitted_discovery_candidates:-1}}).recovery;
  assert.equal(r.history, undefined); assert.equal(r.previews, undefined);
});
test('pending question evidence preserves replies without implying resolution', () => {
  const q = inferenceEvidence({question_context:{schema:'question-context-receipt/1',stage:'admitted_request',transport_boundary:'pre_dispatch',questions:[{question:ref,visible_reply_count:3}]}}).questions;
  assert.deepEqual(q, {references:[ref],replies:3});
  assert(!Object.hasOwn(q,'resolved'));
});
test('documents and tools are not labeled as retained learning', () => {
  assert.match(learningKind('document'), /not a retained lesson/);
  assert.match(learningKind('fragment'), /usefulness not established/);
  assert.match(learningKind('tool'), /acquisition evidence/);
  assert.equal(learningKind('unknown'), 'Saved content');
});

test('retrieval or requested-stage receipts must not be mislabeled admitted', () => {
  const facts = inferenceEvidence({discovery_context:{schema:'discovery-context/1',stage:'retrieved',transport_boundary:'pre_dispatch',offered:[]}});
  assert.equal(facts.discovery, undefined);
});
test('quoted upper bounds are separated from measured provider usage', () => {
  const facts = inferenceEvidence({context_admission:{measured_usage:false,byte_count_is_token_count:false,request_bytes:240000,input_exposure_upper_tokens:280000,output_exposure_upper_tokens:4096},usage:{known:true,input:65000,output:200,cached:0}});
  assert.equal(facts.contextBytes, 240000);
  assert.deepEqual(facts.exposure, {input:280000,output:4096,bytes:240000});
  assert.equal(facts.measured.input, 65000);
});
