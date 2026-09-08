import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson, parseSignedJson, createPublicEvidence} from './helpers/public-evidence.mjs';

const epoch=Date.parse('2026-09-08T09:00:00Z');
function fixture({generation=2,kind='artifact',record='rec:A',hash='sha256:docA'}={}){
  const document=parseSignedJson('{"record":{"record_id":"'+record+'","kind":"'+kind+'",'
    +'"exact_large_integer":9007199254740993},"links":{"content":"k/run-A/artifacts/package/HANDOFF.md",'
    +'"content_hash":"sha256:body"}}');
  const envelope={record:{record_id:record,document_hash:hash,
    inventory_generation:generation,inventory_manifest_hash:'sha256:manifest'+generation},document};
  const index={kernel_id:'kernel:A',inventory_generation:generation,inventory_hash:'sha256:index'+generation,
    inventory_manifest_hash:'sha256:manifest'+generation,expires_at:'2026-09-08T10:00:00Z',
    documents:{[hash]:document},providers:[envelope]};
  const registry={kernelId:'kernel:A',entries:[{public_key_hex:'key-at-verification'}]};
  const row={record_id:record,kind,_kernel:'kernel:A',_doc:{record:document.record},
    _inventorySource:'kernel:A',_inventoryGeneration:generation,_inventoryHash:index.inventory_hash};
  return {document,envelope,index,registry,row,control:{path:document.links.content,
    content_hash:document.links.content_hash,base:'libp2p://public-peer'}};
}
function admit(bridge,f,source='p2p provider'){
  const attempt=bridge.begin(source,'libp2p://public-peer');
  bridge.available(attempt,f.index); bridge.verified(attempt,{ok:true},f.registry);
  assert.equal(bridge.rowVerified(attempt,f.row,f.envelope,f.registry),true);
  bridge.admitted(attempt,true,'accepted'); return attempt;
}
function bridge(options={}){
  const split=createPublicEvidence({canon:canonicalJson,now:()=>epoch,...options});
  const b={...split.producer,...split.reader}; b.enable(); return b;
}

test('disabled hook has no retained/exported data and does not serialize input',()=>{
  let calls=0;const split=createPublicEvidence({canon:value=>{calls++;return canonicalJson(value);}});
  const b={...split.producer,...split.reader};
  const f=fixture();assert.equal(b.begin('http',''),null);b.available(null,f.index);
  assert.equal(b.bindControl(f.row,f.control),''); assert.equal(calls,0);
});
test('receipt is consumer availability; early count/cancel/watch refusals are distinct',()=>{
  const b=bridge();for(const reason of ['count_mismatch','cancelled_before_verification','watch_retired']){
    const a=b.begin('shared/cache consumer','');b.available(a,fixture().index);b.refuse(a,reason);
  }
  const rows=JSON.parse(b.read()).events;
  assert.equal(rows.filter(x=>x.kind==='inventory_consumer_value_available').length,3);
  assert(rows.filter(x=>x.kind==='inventory_consumer_value_available').every(
    x=>x.clock==='consumer_value_available_not_wire_receipt'&&x.identity_authority==='unverified_claims'));
  assert.deepEqual(rows.filter(x=>x.kind==='inventory_consumer_refused').map(x=>x.reason),
    ['count_mismatch','cancelled_before_verification','watch_retired']);
});
test('shared object consumed twice keeps distinct attempt IDs and outcomes',()=>{
  const b=bridge(),f=fixture(),a=b.begin('http',''),c=b.begin('p2p','');
  b.available(a,f.index);b.available(c,f.index);b.refuse(a,'cancelled');
  b.verified(c,{ok:true},f.registry);b.admitted(c,false,'chain_head_mismatch');
  const rows=JSON.parse(b.read()).events;assert.notEqual(a.id,c.id);
  assert(rows.some(x=>x.attempt_id===a.id&&x.reason==='cancelled'));
  assert(rows.some(x=>x.attempt_id===c.id&&x.reason==='chain_head_mismatch'));
});
test('outer verification success does not imply admission or control authority',()=>{
  for(const reason of ['stale_or_equivocating','chain_head_mismatch','lifecycle_regression','expired']){
    const b=bridge(),f=fixture(),a=b.begin('http','');b.available(a,f.index);
    b.verified(a,{ok:true},f.registry);b.rowVerified(a,f.row,f.envelope,f.registry);b.admitted(a,false,reason);
    assert.equal(b.bindControl(f.row,f.control),'');
    const saved=JSON.parse(b.exportLatestVerified('kernel:A'));assert.equal(saved.admitted,false);
  }
});
test('signature failure has metadata only, never a verified body export',()=>{
  const b=bridge(),f=fixture(),a=b.begin('http','');b.available(a,f.index);
  b.verified(a,{ok:false,reason:'signature_invalid'},f.registry);
  assert.equal(b.rowVerified(a,f.row,f.envelope,f.registry),false);
  assert.equal(JSON.parse(b.exportLatestVerified('kernel:A')).ok,false);
});
test('exact control export preserves signed number token and verification-time key',()=>{
  const b=bridge(),f=fixture();admit(b,f);
  const key=b.bindControl(f.row,f.control);assert(key);
  const before=b.exportControl(key,{fullInventory:true});
  assert(before.includes('9007199254740993'));assert(!before.includes('9007199254740992'));
  assert(before.includes('key-at-verification'));assert.equal(JSON.parse(before).binding.record_id,'rec:A');
  assert.equal(JSON.parse(before).inventory_signature_reverification_requires_full_inventory,false);
});
test('same-byte replacement and duplicate records retain exact render identities',()=>{
  const b=bridge(),a=fixture(),c=fixture({generation:3}),d=fixture({generation:3,record:'rec:duplicate',hash:'sha256:docB'});
  admit(b,a);const ka=b.bindControl(a.row,a.control);admit(b,c);const kc=b.bindControl(c.row,c.control);
  admit(b,d);const kd=b.bindControl(d.row,d.control);
  assert.notEqual(ka,kc);assert.notEqual(kc,kd);
  assert.equal(JSON.parse(b.exportControl(ka)).binding.generation,2);
  assert.equal(JSON.parse(b.exportControl(kc)).binding.generation,3);
  assert.equal(JSON.parse(b.exportControl(kd)).binding.record_id,'rec:duplicate');
  assert.equal(JSON.parse(b.exportControl(ka)).inventory_signature_reverification_requires_full_inventory,true);
});
test('inherited inventory metadata cannot bind a replaced projected source document',()=>{
  const b=bridge(),f=fixture();admit(b,f);
  const replaced={...f.row,_doc:{record:f.document.record}};
  assert.equal(b.bindControl(replaced,f.control),'');
  assert.equal(b.bindControl({...f.row,_inventoryGeneration:99},f.control),'');
  assert.equal(b.bindControl(f.row,{...f.control,path:'k/run-B/artifacts/package/HANDOFF.md'}),'');
});
test('manifest synthetic controls and unverified rows stay unavailable',()=>{
  const b=bridge(),f=fixture();admit(b,f);
  assert.equal(b.bindControl({...f.row,_doc:undefined},f.control),'');
  assert.equal(b.bindControl({...f.row,kind:'task'},f.control),'');
});
test('expiry and DOM retirement do not substitute newer evidence',()=>{
  let clock=epoch;const b=bridge({now:()=>clock,journalLimit:2}),f=fixture();admit(b,f);
  const k=b.bindControl(f.row,f.control);clock=Date.parse('2026-09-08T10:00:01Z');
  assert.equal(JSON.parse(b.exportControl(k)).reason,'render_generation_expired');
  clock=epoch;const current=fixture({generation:3});admit(b,current);
  b.reconcileControls([b.bindControl(current.row,current.control)]);
  assert.equal(JSON.parse(b.exportControl(k)).reason,'render_binding_retired_gc_or_absent');
  assert(JSON.parse(b.read()).discarded_entries>0);
});
test('selection points to actual verified source row or explicitly unavailable authority',()=>{
  const b=bridge(),f=fixture({kind:'task'});admit(b,f);
  b.select('persona:A:mechanical',f.row,{taskId:'task:A',run:'run-A',state:'budget_exhausted',revision:'sha256:terminal',currentExecution:false});
  b.select('persona:A:mechanical',{...f.row,_doc:{}},{taskId:'task:A',run:'run-A',state:'current',revision:'sha256:old',currentExecution:true});
  const rows=JSON.parse(b.read()).events.filter(x=>x.kind==='task_selection');
  assert.equal(rows[0].authority_available,true);assert.equal(rows[0].record_id,'rec:A');
  assert.equal(rows[1].authority_available,false);assert.equal(rows[1].attempt_id,null);
});
test('serialization occurs only on explicit reads; disable drops strong reference containers',()=>{
  let calls=0;const b=bridge({canon:v=>{calls++;return canonicalJson(v);}}),f=fixture();
  admit(b,f);assert.equal(calls,0);const key=b.bindControl(f.row,f.control);assert.equal(calls,1);
  b.disable();assert.equal(JSON.parse(b.exportControl(key)).ok,false);
  assert.deepEqual(JSON.parse(b.read()).events,[]);
});
test('diagnostic serializer failure cannot prevent the ordinary render action',()=>{
  const b=bridge({canon:()=>{throw new Error('offline test injected serializer error');}}),f=fixture();
  admit(b,f);let renderContinued=false;
  assert.doesNotThrow(()=>{assert.equal(b.bindControl(f.row,f.control),'');renderContinued=true;});
  assert.equal(renderContinued,true);assert.equal(JSON.parse(b.exportControl('absent')).ok,false);
});
test('same generation re-admission preserves the earlier rendered attempt and registry',()=>{
  const b=bridge(),f=fixture();const first=admit(b,f);const old=b.bindControl(f.row,f.control);
  const secondFixture=fixture();secondFixture.registry={entries:[{public_key_hex:'new-registry'}]};
  const second=admit(b,secondFixture);const current=b.bindControl(secondFixture.row,secondFixture.control);
  assert.notEqual(old,current);assert.equal(JSON.parse(b.exportControl(old)).attempt_id,first.id);
  assert.equal(JSON.parse(b.exportControl(current)).attempt_id,second.id);
  assert(b.exportControl(old).includes('key-at-verification'));assert(!b.exportControl(old).includes('new-registry'));
});
test('full export contains inventory once and compact mode contains selected document once',()=>{
  const b=bridge(),f=fixture();admit(b,f);const key=b.bindControl(f.row,f.control);
  const full=JSON.parse(b.exportControl(key,{fullInventory:true}));
  assert(full.inventory);assert(!Object.hasOwn(full,'provider_envelope'));assert(!Object.hasOwn(full,'document'));
  const compact=JSON.parse(b.exportControl(key));assert(compact.provider_envelope.document);
  assert(!Object.hasOwn(compact,'document'));assert(!Object.hasOwn(compact,'inventory'));
});
test('oversize exact binding fields decline authority instead of truncating',()=>{
  const b=bridge(),f=fixture();admit(b,f);
  assert.equal(b.bindControl(f.row,{...f.control,base:'x'.repeat(2049)}),'');
});
test('public reader API cannot manufacture verification, admission, or source bindings',()=>{
  const split=createPublicEvidence({canon:canonicalJson});
  assert.deepEqual(Object.keys(split.reader).sort(),['disable','enable','exportControl','exportLatestVerified','read']);
  for(const name of ['available','verified','rowVerified','admitted','bindControl','select'])
    assert.equal(split.reader[name],undefined);
});
test('all 700 represented distinct controls survive one render and unchanged bindings reuse keys',()=>{
  const b=bridge(),fixtures=[],keys=[];
  for(let n=0;n<700;n++){
    const f=fixture({record:'rec:'+n,hash:'sha256:doc'+n});fixtures.push(f);admit(b,f);
    const key=b.bindControl(f.row,f.control);assert.equal(b.bindControl(f.row,f.control),key);keys.push(key);
  }
  b.reconcileControls(keys);assert.equal(JSON.parse(b.read()).retained_control_bindings,700);
  for(const key of [keys[0],keys[511],keys[635],keys.at(-1)]) assert.equal(JSON.parse(b.exportControl(key)).ok,true);
});
test('disable and re-enable cannot resurrect an earlier in-flight attempt',()=>{
  const b=bridge(),f=fixture(),a=b.begin('old consumer','');b.available(a,f.index);
  const session=JSON.parse(b.read()).session;b.disable();b.enable();
  b.verified(a,{ok:true},f.registry);b.rowVerified(a,f.row,f.envelope,f.registry);b.admitted(a,true,'accepted');
  assert.equal(JSON.parse(b.exportLatestVerified('kernel:A')).ok,false);
  assert.equal(b.bindControl(f.row,f.control),'');
  const journal=JSON.parse(b.read());assert.equal(journal.session,session+1);assert(journal.discarded_entries>0);
});
test('actual projection association is retained without altering projection shape',()=>{
  const b=bridge(),f=fixture({kind:'task'});admit(b,f);
  const p={taskId:'task:A',run:'run-A',state:'budget_exhausted',revision:'sha256:terminal',currentExecution:false};
  assert.equal(b.rememberProjection(p,f.row),p);const key=JSON.stringify(p);
  const selected=JSON.parse(b.selectProjection('persona:A:mechanical',p));
  assert.equal(selected.authority_available,true);assert.equal(selected.record_id,'rec:A');
  assert.equal(JSON.stringify(p),key);
});
test('mechanical projection without a task lifecycle stays explicitly unselected',()=>{
  const b=bridge(),mechanical={key:'active_call',label:'Thinking',source:'model_call'};
  b.deriveProjection(mechanical,null);
  const selected=JSON.parse(b.selectProjection('persona:A:mechanical',mechanical,{display:mechanical}));
  assert.equal(selected.selected,false);assert.equal(selected.authority_available,false);
  assert.equal(selected.task,'');assert.equal(selected.run,'');assert.equal(selected.record_id,'');
  assert.equal(selected.derived_display.label,'Thinking');
});
