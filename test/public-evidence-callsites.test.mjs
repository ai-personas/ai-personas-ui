// Exercise actual production declarations with inert transport/crypto fakes.
// discovery-route-contract.test.mjs separately verifies real signed admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assetRoot, canonicalJson, parseSignedJson, createPublicEvidence} from './helpers/public-evidence.mjs';

const source=readFileSync(resolve(assetRoot,'discovery.js'),'utf8');
const attemptSymbol=Symbol('test internal attempt'),registrySymbol=Symbol('test internal registry');
const epoch=Date.parse('2026-09-08T09:00:00Z');
const plain=value=>JSON.parse(JSON.stringify(value,(_key,item)=>
  item instanceof Map?[...item]:item instanceof Set?[...item]:item));
const section=(source,start,end)=>{
  const first=source.indexOf(start),last=source.indexOf(end,first+start.length);
  assert(first>=0&&last>first,`source section ${start}`);return source.slice(first,last);
};
function compile(source,parts,names,values){
  return new Function(...Object.keys(values),parts.map(([start,end])=>section(source,start,end)).join('\n')
    +'\nreturn {'+names.join(',')+'};')(...Object.values(values));
}
function bridge(enabled=true){
  const split=createPublicEvidence({canon:canonicalJson,now:()=>epoch});if(enabled) split.reader.enable();
  return {...split,all:{...split.producer,...split.reader}};
}
function fixture(){
  const dh='sha256:'+'c'.repeat(64),mh='sha256:'+'a'.repeat(64),ih='sha256:'+'b'.repeat(64);
  const record={record_id:'rec:A',kind:'artifact',did:'did:artifact:A',label:'HANDOFF.md'};
  const document={record,signature_hex:'sig-record',signing_key_id:'operational:old',
    host_kernel_id:'kernel:A',base:'https://public.example',
    links:{content:'k/run-A/artifacts/package/HANDOFF.md',content_hash:'sha256:'+'e'.repeat(64)},access_policy:{}};
  const provider={schema:'provider-record/1',record_id:'rec:A',record_url:'discovery/public/records/rec:A.json',
    document_hash:dh,inventory_generation:2,inventory_manifest_hash:mh};
  const envelope={schema:'provider-record-envelope/1',record:provider,document,public_key_hex:'provider-old'};
  const index={schema:'dht-provider-index/3',kernel_id:'kernel:A',base:'https://public.example',
    inventory_generation:2,version:2,inventory_hash:ih,previous_inventory_hash:'sha256:'+'d'.repeat(64),
    inventory_manifest_hash:mh,inventory_manifest:[{record_id:'rec:A',record_url:provider.record_url,document_hash:dh}],
    generated_at:'2026-09-08T09:00:00Z',expires_at:'2026-09-08T10:00:00Z',signing_key_id:'kernel-master',
    visibility:'public',provider_count:1,document_count:1,signature_hex:'sig-inventory',
    documents:{[dh]:document},providers:[{schema:envelope.schema,record:provider,document_ref:dh}]};
  const registry={kernelId:'kernel:A',entries:[{key_id:'operational:old',status:'current',public_key_hex:'record-old'}]};
  const row={...record,_kernel:'kernel:A',_doc:{record,public_key_hex:'record-old',signing_key_id:'operational:old'},
    _links:document.links,_inventorySource:'kernel:A',_inventoryGeneration:2,_inventoryHash:ih};
  const inventory={ok:true,complete:true,generation:2,hash:ih,previousHash:index.previous_inventory_hash,
    manifestHash:mh,recordIds:new Set(['rec:A']),bindings:new Map([['rec:A',dh]]),generatedAt:epoch,expiresAt:epoch+3600000};
  return {index,envelope,document,registry,row,inventory,boot:{kernel_id:'kernel:A',record_count:1},base:'https://public.example'};
}
function prepareEvidence(b,f){
  const a=b.all.begin('offline public consumer',f.base);b.all.available(a,f.index);
  b.all.verified(a,{ok:true},f.registry);b.all.rowVerified(a,f.row,f.envelope,f.registry);
  f.inventory[attemptSymbol]=a;return a;
}

test('actual admission predicates and mutations match with observation disabled and enabled',()=>{
  const cases={accepted:'accepted',incomplete:'inventory_incomplete',invalid:'inventory_invalid',
    kernel_missing:'missing_kernel',expired:'inventory_expired',stale:'stale_or_equivocating_generation',
    equivocating:'stale_or_equivocating_generation',chain_mismatch:'chain_head_mismatch',
    row_kernel:'row_outside_manifest',row_manifest:'row_outside_manifest',
    record_key:'record_key_missing',regression:'persona_lifecycle_regression',incomplete_rows:'incomplete_unique_rows'};
  function run(enabled,kind){
    const f=fixture(),b=bridge(enabled),rows=[f.row],logs=[],effects=[];
    const S={providerInventories:new Map(),recs:new Map(),cachedIdentityPendingKernels:new Set(['kernel:A'])};
    const a=prepareEvidence(b,f);let boot=f.boot,inventory=f.inventory;
    if(kind==='incomplete') inventory.complete=false;
    if(kind==='invalid') inventory.ok=false;
    if(kind==='kernel_missing') boot={};
    if(kind==='stale') S.providerInventories.set('kernel:A',{generation:3,hash:'later',recordKeys:new Set()});
    if(kind==='equivocating') S.providerInventories.set('kernel:A',{generation:2,hash:'other',recordKeys:new Set()});
    if(kind==='chain_mismatch') S.providerInventories.set('kernel:A',{generation:1,hash:'other',recordKeys:new Set()});
    if(kind==='row_kernel') rows[0]._kernel='kernel:B';
    if(kind==='row_manifest') inventory.recordIds=new Set(['rec:other']);
    if(kind==='incomplete_rows') inventory.recordIds.add('rec:missing');
    const values={S,_publicEvidence:b.producer,_publicEvidenceAttempt:attemptSymbol,
      _providerInventoryIsCurrent:()=>kind!=='expired',recordStoreKey:r=>kind==='record_key'?'':r.record_id,
      _personaLifecycleRegresses:()=>kind==='regression',log:(...x)=>logs.push(x),
      upsert:r=>{S.recs.set(r.record_id,r);effects.push('upsert');},_removeRecordStoreKey:id=>S.recs.delete(id),
      persistOfflinePublicHistory:()=>effects.push('persist'),retireFastSignedIdentityRoute:()=>effects.push('retire'),
      scheduleRealtimeRepaint:()=>effects.push('paint')};
    const fn=compile(source,[['function applyVerifiedProviderInventory(','function upsert(']],['applyVerifiedProviderInventory'],values).applyVerifiedProviderInventory;
    const state=()=>plain({records:[...S.recs],inventories:[...S.providerInventories],
      pending:[...S.cachedIdentityPendingKernels],fastOriginRefreshPending:S.fastOriginRefreshPending});
    const before=state(),result=fn(f.base,boot,rows,inventory,f.index);
    return {result,logs,effects,...state(),before,
      events:JSON.parse(b.reader.read()).events.filter(e=>e.kind==='inventory_admission'),attempt:a};
  }
  for(const [kind,reason] of Object.entries(cases)){
    const baseline=run(false,kind),accepted=kind==='accepted';
    for(const enabled of [false,true]){
      const actual=enabled?run(true,kind):baseline;
      assert.equal(actual.result,accepted,`${kind} expected admission decision`);
      assert.deepEqual(actual.effects,accepted?['upsert','persist','retire','paint']:[],kind);
      for(const field of ['result','logs','effects','records','inventories','pending','fastOriginRefreshPending'])
        assert.deepEqual(actual[field],baseline[field],`${kind} enabled=${enabled} ${field}`);
      if(accepted){
        const f=fixture();
        assert.deepEqual(actual.records,plain([['rec:A',f.row]]));
        assert.deepEqual(actual.inventories,[['kernel:A',{generation:2,hash:f.index.inventory_hash,
          recordKeys:['rec:A'],manifestHash:f.inventory.manifestHash,bindings:[...f.inventory.bindings],
          base:f.base,generatedAt:epoch,expiresAt:epoch+3600000}]]);
        assert.deepEqual(actual.pending,[]);assert.equal(actual.fastOriginRefreshPending,false);
      }else{
        for(const field of ['records','inventories','pending','fastOriginRefreshPending'])
          assert.deepEqual(actual[field],actual.before[field],`${kind} must not mutate ${field}`);
      }
      assert.equal(actual.events.length,enabled?1:0,kind);
      if(enabled){
        assert.equal(actual.events[0].ok,accepted);assert.equal(actual.events[0].reason,reason);
        assert.equal(actual.events[0].attempt_id,actual.attempt.id);
      }
    }
  }
});

test('real record verifier captures its original registry across a concurrent refresh',async()=>{
  const f=fixture(),b=bridge(),a=b.all.begin('http',f.base);b.all.available(a,f.index);b.all.verified(a,{ok:true},f.registry);
  const S={keyDocs:new Map([[f.base,f.registry]])};let release,entriesUsed;
  const gate=new Promise(resolve=>{release=resolve;});
  const access={ok:true,canDiscover:true,canRead:true,level:'public'};
  const values={S,_publicEvidence:b.producer,verifyRecord:async(doc,entries)=>{entriesUsed=entries;await gate;return {ok:true,entry:entries[0]};},
    evaluatePublicRecordAccess:()=>access,projectRecordSurface:(record,policy,links,access,{base,url})=>({record,policy,links,base,url}),
    projectDiscoveryRecord:r=>r,join:(base,path)=>base+'/'+path,opBaseKey:x=>x};
  const fn=compile(source,[['async function verifiedRecordFromDoc(','function logRecordAccess(']],['verifiedRecordFromDoc'],values).verifiedRecordFromDoc;
  const pending=fn(f.document,{},f.boot,f.base,'internet',f.envelope.record.record_url,
    {access,providerBaseVerified:true,publicEvidenceAttempt:a,publicEvidenceEnvelope:f.envelope});
  S.keyDocs.set(f.base,{kernelId:'kernel:A',entries:[{public_key_hex:'new-key'}]});release();
  const result=await pending;assert.equal(entriesUsed,f.registry.entries);
  Object.assign(result.row,{_inventorySource:'kernel:A',_inventoryGeneration:2,_inventoryHash:f.index.inventory_hash});
  b.all.admitted(a,true,'accepted');const key=b.all.bindControl(result.row,{path:f.document.links.content,
    content_hash:f.document.links.content_hash,base:f.base});
  assert(key);const exported=b.reader.exportControl(key,{fullInventory:true});
  assert(exported.includes('record-old'));assert(!exported.includes('new-key'));
});

test('actual outer inventory verifier captures input before signature await and keeps raw index untouched',async()=>{
  const f=fixture(),b=bridge(),a=b.all.begin('http',f.base);b.all.available(a,f.index);
  const before=canonicalJson(f.index),S={keyDocs:new Map([[f.base,f.registry]])};
  let release,usedRegistry;const gate=new Promise(resolve=>{release=resolve;});
  const values={S,_publicEvidenceRegistry:registrySymbol,PROVIDER_INVENTORY_FIELDS:[],PROVIDER_MANIFEST_FIELDS:[],
    _exactObjectFields:()=>true,verifiedCanonicalBaseMatch:async()=>true,SHA256_CONTENT_RE:/^sha256:[0-9a-f]{64}$/,
    validateProviderInventoryWindow:()=>({ok:true,generatedAt:epoch,expiresAt:epoch+3600000}),canon:canonicalJson,enc:new TextEncoder(),
    sha256Hex:async bytes=>new TextDecoder().decode(bytes).startsWith('[')?'a'.repeat(64):'b'.repeat(64),
    verifyCurrentMasterSignedDocument:async()=>{usedRegistry=S.keyDocs.get(f.base);await gate;return true;}};
  const fn=compile(source,[['async function verifyProviderInventory(','const PUBLIC_ENTITY_INDEX_FIELDS=']],['verifyProviderInventory'],values).verifyProviderInventory;
  const pending=fn(f.index,f.base,f.boot,{publicEvidenceAttempt:a});
  // Let manifest and whole-index hashes reach the signature await.
  while(!usedRegistry) await Promise.resolve();
  S.keyDocs.set(f.base,{entries:[{public_key_hex:'replacement'}]});release();const result=await pending;
  assert.equal(result.ok,true);assert.equal(result[registrySymbol],f.registry);
  assert.equal(canonicalJson(f.index),before);assert.equal(Object.getOwnPropertySymbols(f.index).length,0);
});

test('real row verifier passes exact attempt/envelope and preserves Symbols through descriptor spreads',async()=>{
  const f=fixture(),b=bridge(),a=b.all.begin('http',f.base);b.all.available(a,f.index);
  let seen;
  const values={S:{keyDocs:new Map([[f.base,f.registry]])},_publicEvidence:b.producer,
    _publicEvidenceAttempt:attemptSymbol,_publicEvidenceRegistry:registrySymbol,
    verifyProviderInventory:async()=>({...f.inventory,[registrySymbol]:f.registry}),
    hydrateProviderIndex:()=>({ok:true,envelopes:[f.envelope]}),
    verifyHttpProviderWithKeyRefresh:async()=>({ok:true,keys:{},access:{}}),
    verifiedRecordFromDoc:async(doc,keys,boot,base,plane,url,meta)=>{seen={doc,meta};return {ok:true,row:f.row};},
    log:()=>{},logRecordAccess:()=>{}};
  const fn=compile(source,[['async function verifiedRowsFromProviderIndex(','const PUBLIC_IDENTITY_INDEX_FIELDS=']],['verifiedRowsFromProviderIndex'],values).verifiedRowsFromProviderIndex;
  const out=await fn(f.index,f.base,f.boot,'internet','http',{publicEvidenceAttempt:a});
  assert.equal(seen.doc,f.document);assert.equal(seen.meta.publicEvidenceEnvelope,f.envelope);
  assert.equal(seen.meta.publicEvidenceAttempt,a);assert.equal(out.inventory[attemptSymbol],a);
  const spread={...out.inventory,complete:true};assert.equal(spread[attemptSymbol],a);
  assert.equal(JSON.stringify(spread).includes('publicEvidence'),false);
});

test('real artifact control rendering is byte-identical disabled and exports exact enabled key',()=>{
  const f=fixture(),b=bridge();const a=prepareEvidence(b,f);b.all.admitted(a,true,'accepted');
  const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const values={esc,_publicEvidence:b.producer,_artifactDisplayPath:()=> 'HANDOFF.md',
    _artifactFilePresentation:path=>({path}),_artifactDeclarationDisplayProjection:()=>null,
    artifactMediaPresentation:()=>({mediaType:'text/markdown'}),artifactTypeLabel:()=> 'Markdown',
    _bodyPath:x=>x,artifactSemanticsAttr:()=>'',_artifactFormatTileHTML:()=>'',_artifactFileIdentityHTML:()=>'',
    artifactDeclarationAttr:()=>'',authoredArtifactLabelText:()=>'',_artifactDeclarationPersonaLabel:()=>'',fmtBytes:String};
  const build=source=>compile(source,[['function _artifactPreviewActionHTML(','function _artifactActionHTML(']],['_artifactPreviewActionHTML'],values)._artifactPreviewActionHTML;
  const actual=build(source);b.reader.disable();const baseline=actual(f.row,{verifiedMetadata:true});
  assert(!baseline.includes('data-public-evidence-key'));
  assert(baseline.includes('data-current-artifact-path="'+f.document.links.content+'"'));
  assert(baseline.includes('data-current-artifact-hash="'+f.document.links.content_hash+'"'));
  assert(baseline.includes('Open file'));
  b.reader.enable();prepareEvidence(b,f);b.all.admitted(f.inventory[attemptSymbol],true,'accepted');
  const html=actual(f.row,{verifiedMetadata:true});const encoded=/data-public-evidence-key="([^"]+)"/.exec(html)?.[1];assert(encoded);
  assert.equal(html.replace(/ data-public-evidence-key="[^"]+"/,''),baseline);
  const key=encoded.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
  assert.equal(JSON.parse(b.reader.exportControl(key)).binding.record_id,'rec:A');
  const replacement={...f.row,_doc:{}};assert.equal(actual(replacement,{verifiedMetadata:true}).includes('data-public-evidence-key'),false);
});

test('real exact-run and latest task selectors retain expected outcomes and projection identity',()=>{
  const f=fixture(),b=bridge();f.row.kind='task';f.document.record.kind='task';
  const a=prepareEvidence(b,f);b.all.admitted(a,true,'accepted');
  f.row.task_lifecycle={taskId:'task:A',run:'run-A',task:'same title',environment:'env-A',state:'budget_exhausted',revision:'sha256:terminal',currentExecution:false};
  const S={order:['rec:A'],recs:new Map([['rec:A',f.row]])};
  const values={S,_publicEvidence:b.producer,_publicProvenanceAtom:x=>typeof x==='string'?x:'',
    publicTaskLifecycleProjection:r=>r.task_lifecycle,environmentIdentity:x=>x,
    _taskLifecycleRecordOrder:(r,p)=>p.run+'-'+r.record_id};
  const parts=[['function _latestTaskLifecycle(','const _MECHANICAL_QUIESCENT_TASK_STATES='],
    ['function _verifiedPublicTaskForRun(','function _withVerifiedTaskRun(']];
  const actual=compile(source,parts,['_latestTaskLifecycle','_verifiedPublicTaskForRun'],values);
  for(const enabled of [false,true]){
    if(enabled){b.reader.enable();prepareEvidence(b,f);b.all.admitted(f.inventory[attemptSymbol],true,'accepted');}
    else b.reader.disable();
    assert.equal(actual._latestTaskLifecycle('kernel:A',{environment:'env-A'}),f.row.task_lifecycle);
    assert.equal(actual._verifiedPublicTaskForRun('kernel:A','run-A'),f.row.task_lifecycle);
    assert.equal(actual._verifiedPublicTaskForRun('kernel:A','run-missing'),null);
    assert.equal(actual._verifiedPublicTaskForRun('kernel:B','run-A'),null);
    const selected=actual._verifiedPublicTaskForRun('kernel:A','run-A');
    const observation=b.producer.selectProjection('persona:A:task',selected);
    if(enabled) assert.equal(JSON.parse(observation).authority_available,true);
    else assert.equal(observation,'');
  }
  S.order.push('rec:B');S.recs.set('rec:B',{...f.row,record_id:'rec:B'});
  assert.equal(actual._verifiedPublicTaskForRun('kernel:A','run-A'),null);
});

test('public producer calls remain confined to declared anonymous provider/renderer paths',()=>{
  const owner=section(source,'async function connectedNodeBytes(','async function renderTop(');
  assert(!owner.includes('_publicEvidence.available('));assert(!owner.includes('_publicEvidence.verified('));
  assert(!owner.includes('_publicEvidence.rowVerified('));assert(!owner.includes('_publicEvidence.admitted('));
  assert(source.includes('globalThis.__personaOSPublicEvidence=_publicEvidenceBridge.reader;'));
  assert(!source.includes('globalThis.__personaOSPublicEvidence=_publicEvidence;'));
  const ingest=section(source,'async function verifiedRecordFromDoc(','const PUBLIC_IDENTITY_INDEX_FIELDS=');
  assert(!ingest.includes('operator.token'));assert(!ingest.includes('MY_NODES'));assert(!ingest.includes('model_response'));
});

test('actual HTTP consumer records shared value availability before the identity await, and count refusal',async()=>{
  async function run(kind){
    const f=fixture(),b=bridge(),S={keyDocs:new Map(),peerHealth:new Map()};let identityWaiting=false,release,verifiedCalls=0;
    const identityGate=new Promise(resolve=>{release=resolve;});
    f.boot.identity_index_url='public-identities.json';
    const value=kind==='missing'?null:kind==='count'?{...f.index,document_count:2}:f.index;
    const values={S,_publicEvidence:b.producer,location:{origin:'https://public.viewer'},log:()=>{},
      keysFor:async()=>({'kernel-master':'public-key'}),refreshOpenInputDirectory:async()=>{},
      join:(a,c)=>a+'/'+c,sharedDocumentJson:()=>Promise.resolve(value),
      fetchJson:async()=>{identityWaiting=true;return await identityGate;},admitVerifiedIdentityIndex:async()=>false,
      verifiedRowsFromProviderIndex:async(index,base,boot,plane,source,options)=>{
        verifiedCalls++;assert.equal(options.publicEvidenceAttempt.record.index,index);
        b.all.verified(options.publicEvidenceAttempt,{ok:true},f.registry);
        return {rows:[f.row],inventory:{...f.inventory,[attemptSymbol]:options.publicEvidenceAttempt},refused:0,envelopeCount:1};},
      setTimeout:()=>0};
    const fn=compile(source,[['async function discoverFrom(','function kernelForBase(']],['discoverFrom'],values).discoverFrom;
    const pending=fn(f.base,'internet',f.boot);for(let n=0;n<12&&!identityWaiting;n++) await Promise.resolve();
    await Promise.resolve();const before=JSON.parse(b.reader.read()).events;
    assert(before.some(e=>e.kind==='inventory_consumer_value_available'));
    assert.equal(verifiedCalls,0);release(null);const result=await pending;
    const events=JSON.parse(b.reader.read()).events;
    if(kind==='valid') assert.equal(result.inventory.complete,true);
    else {assert.equal(verifiedCalls,0);assert(events.some(e=>e.reason===(kind==='count'?'bootstrap_count_mismatch':'provider_value_absent')));}
  }
  for(const kind of ['valid','count','missing']) await run(kind);
});

test('actual P2P early refusal and post-verification watch paths keep the same consumer attempt',async()=>{
  for(const kind of ['valid','cancel','count','watch_before','watch_after','incomplete']){
    const f=fixture(),b=bridge(),signal={aborted:false};let watchCalls=0,verifiedCalls=0;
    const providerIndex=kind==='count'?{...f.index,document_count:2}:f.index;
    const hint={base:'libp2p://peer',kernel:'kernel:A',peerId:'peer',providerRecord:{host_kernel_id:'kernel:A',provider_peer_id:'peer',public_key_hex:'public-key'}};
    const values={_publicEvidence:b.producer,P2P:{fetchPublicJson:async(p,path)=>path.includes('keys')?{kernel_id:'kernel:A'}:f.boot},
      settleBeforeAbort:async(p)=>{const value=await p;if(value===providerIndex&&kind==='cancel'){signal.aborted=true;return null;}return value;},
      admitKeysDocument:()=>({'kernel-master':'public-key'}),_registerP2PDataRoute:()=>{},connectDiscoveryStream:()=>{},
      join:(a,c)=>a+'/'+c,_peerInventoryReadGuard:()=>()=>{watchCalls++;return kind==='watch_before'?false:!(kind==='watch_after'&&watchCalls===2);},
      sharedDocumentJson:()=>Promise.resolve(providerIndex),log:()=>{},
      verifiedRowsFromProviderIndex:async(index,base,boot,plane,source,options)=>{
        verifiedCalls++;assert.equal(options.publicEvidenceAttempt.record.index,index);
        b.all.verified(options.publicEvidenceAttempt,{ok:true},f.registry);
        return {rows:[f.row],inventory:{...f.inventory,[attemptSymbol]:options.publicEvidenceAttempt},
          refused:kind==='incomplete'?1:0,envelopeCount:1};}};
    const fn=compile(source,[['async function _discoverFromP2P(','function _reconcileP2PRouteHint(']],['_discoverFromP2P'],values)._discoverFromP2P;
    const result=await fn(hint,{signal});const events=JSON.parse(b.reader.read()).events;
    const available=events.find(e=>e.kind==='inventory_consumer_value_available');assert(available,kind);
    assert(events.filter(e=>e.attempt_id!=null).every(e=>e.attempt_id===available.attempt_id),kind);
    if(kind==='valid') assert.equal(result.inventory.complete,true);
    else assert(events.some(e=>e.kind==='inventory_consumer_refused'),kind);
    assert.equal(verifiedCalls,['valid','watch_after','incomplete'].includes(kind)?1:0,kind);
  }
});

test('actual SSE caller retains one attempt across parse and later processing failure',async()=>{
  for(const kind of ['valid','parse','processing']){
    const f=fixture(),b=bridge();let handler;
    const es={addEventListener:(name,fn)=>{assert.equal(name,'discovery_snapshot');handler=fn;}};
    const values={es,_publicEvidence:b.producer,base:f.base,boot:f.boot,parseSignedJson,
      verifiedRowsFromProviderIndex:async(index,base,boot,plane,source,{publicEvidenceAttempt:a})=>{
        assert.equal(a.record.index,index);b.all.verified(a,{ok:true},f.registry);
        if(kind==='processing') throw new Error('synthetic record processing failure');
        return {rows:[f.row],inventory:{...f.inventory,[attemptSymbol]:a},refused:0};},
      applyVerifiedProviderInventory:(base,boot,rows,inventory)=>{b.all.admitted(inventory[attemptSymbol],true,'accepted');return true;},
      log:()=>{},classifyMap:()=>{},updateVitalsCounters:()=>{},refreshSystemView:()=>{},scheduleSseCognitionRefresh:()=>{}};
    const block=section(source,"  es.addEventListener('discovery_snapshot',","  es.addEventListener('telemetry_update',");
    const wait=new Function(...Object.keys(values),'let cognitionQueue=Promise.resolve();\n'+block+'\nreturn ()=>cognitionQueue;')(...Object.values(values));
    handler({data:kind==='parse'?'{bad':JSON.stringify({providers:f.index,unrelated_frame:'DO_NOT_RETAIN_OTHER_PAYLOADS'})});await wait();
    const encoded=b.reader.read(),events=JSON.parse(encoded).events;
    assert.equal(encoded.includes('DO_NOT_RETAIN_OTHER_PAYLOADS'),false);
    assert.equal(events.filter(e=>e.kind==='inventory_consumer_started').length,1);
    if(kind!=='valid') assert(events.some(e=>e.reason===(kind==='parse'?'snapshot_parse_failure':'snapshot_processing_failure')));
    const ids=new Set(events.filter(e=>e.attempt_id!=null).map(e=>e.attempt_id));assert.equal(ids.size,1);
  }
});

test('actual mechanical active-call override has separate derived display and terminal-task authority',()=>{
  const f=fixture(),b=bridge();f.row.kind='task';f.document.record.kind='task';const a=prepareEvidence(b,f);b.all.admitted(a,true,'accepted');
  const lifecycle={taskId:'task:A',run:'run-A',state:'budget_exhausted',revision:'sha256:terminal',currentExecution:false};
  b.producer.rememberProjection(lifecycle,f.row);
  const values={_publicEvidence:b.producer,_activeModelCallsForPersona:()=>[{}],_taskLifecycleForPersonaWork:()=>lifecycle};
  const fn=compile(source,[['const _MECHANICAL_QUIESCENT_TASK_STATES=','function _taskLifecycleForPersonaWork('],
    ['function _personaMechanicalRunProjection(','// face notes are for humans:']],['_personaMechanicalRunProjection'],values)._personaMechanicalRunProjection;
  const projected=fn({},'kernel:A',[],'persona:A');assert.equal(projected.key,'running');assert.equal(projected.source,'active model call');
  const selected=JSON.parse(b.producer.selectProjection('persona:A:mechanical-subprojection',projected,
    {display:{key:projected.key,label:projected.label,exact_state:projected.exactState,source:projected.source,active_call_face:true}}));
  assert.equal(selected.state,'budget_exhausted');assert.equal(selected.derived_display.key,'running');
  assert.equal(selected.authority_scope,'selected_task_lifecycle_only');
  assert.equal(selected.derived_display.authority,'derived_ui_projection_requires_separate_source_evidence');
});

test('actual environment no-task fallback is not presented as a selected signed task',()=>{
  const b=bridge(),empty=()=>'',esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  const values={_publicEvidence:b.producer,envOutputContext:()=>({statusTxt:'Available',metaFiles:0,artRow:''}),
    renderEnvLaneLive:empty,_environmentCommunicationGraphHTML:()=>({activeCount:0,eventCount:0,html:''}),
    _pkTaskFacts:()=>null,_retainedVerifiedEntityFeed:()=>null,telemetryActiveCalls:()=>[],_environmentRunBudget:()=>null,
    _runBudgetLabel:empty,_sentenceStart:x=>x,_pkEnvTools:()=>[],_envHue:()=>0,identiconSVG:empty,icon:empty,esc};
  const parts=[['  const environmentCardHTML=(b)=>{','  // (3) Preserve every exact environment identity.']];
  const render=compile(source,parts,['environmentCardHTML'],values).environmentCardHTML;
  const env={kernel:'kernel:A',sid:'env:A',members:[],name:'Workspace',type:'workspace',live:true};
  b.reader.disable();const baseline=render(env);assert(!baseline.includes('data-public-task-selection'));
  b.reader.enable();const html=render(env);assert(html.includes('live updates streaming'));
  assert.equal(html.replace(/ data-public-task-selection="[^"]+"/,''),baseline);
  const encoded=/data-public-task-selection="([^"]+)"/.exec(html)?.[1];assert(encoded);
  const selected=JSON.parse(encoded.replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
  assert(selected.surface.endsWith(':task-facts'));assert.equal(selected.selected,false);
  assert.equal(selected.selection_reason,'no_selected_task_facts');assert.equal(selected.authority_available,false);
});
