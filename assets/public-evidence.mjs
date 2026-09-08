// PREPARATION ONLY. No browser globals, transport, timers, or default activation.
// Call sites pass already-parsed references; only explicit exports serialize.
export function createPublicEvidence({canon, now=()=>Date.now(), journalLimit=512}={}) {
  if(typeof canon!=='function') throw new TypeError('canonical serializer required');
  let enabled=false, session=0, sequence=0, attemptSequence=0, lost=0;
  let retiredControls=0, evictedInventories=0;
  let journal=[], latestVerified=new Map(), proofs=new WeakMap(), controls=new Map();
  let projections=new WeakMap(), selections=new Map();
  const atom=(v,n=512)=>typeof v==='string'&&v.length<=n?v:'';
  const event=(kind,fields={})=>{
    if(!enabled) return;
    const row={sequence:++sequence, session, observed_at_ms:now(), kind, ...fields};
    journal.push(row);
    if(journal.length>journalLimit){ journal.shift(); lost++; }
    return row;
  };
  const identity=(index)=>({kernel:atom(index?.kernel_id),
    generation:Number.isSafeInteger(index?.inventory_generation)?index.inventory_generation:null,
    inventory_hash:atom(index?.inventory_hash), manifest_hash:atom(index?.inventory_manifest_hash),
    omitted_identity_fields:['kernel_id','inventory_hash','inventory_manifest_hash'].filter(
      field=>typeof index?.[field]==='string'&&index[field].length>512)});
  const entry=(attempt,index,keys)=>({attempt,index,keys,identity:identity(index),
    inventoryVerified:false,admitted:false});
  const unavailable=(reason)=>canon({ok:false,reason});
  const active=()=>enabled;
  const current=(attempt)=>enabled&&attempt?.session===session;
  const enable=()=>{
    if(!enabled){enabled=true;session++;event('observation_enabled');}
    return true;
  };
  const disable=()=>{
    lost+=journal.length;
    enabled=false; journal=[]; latestVerified.clear(); controls.clear(); proofs=new WeakMap();
    projections=new WeakMap();selections.clear();
  };
  const begin=(source,base)=>{
    if(!enabled) return null;
    const attempt={id:++attemptSequence,session,source:atom(source,80),base:atom(base,2048),record:null};
    event('inventory_consumer_started',{attempt_id:attempt.id,source:attempt.source,base:attempt.base});
    return attempt;
  };
  const available=(attempt,index)=>{
    if(!current(attempt)) return;
    attempt.record=entry(attempt,index,null);
    event('inventory_consumer_value_available',{attempt_id:attempt.id,
      source:attempt.source,base:attempt.base,...identity(index),value_present:!!index,
      identity_authority:'unverified_claims',clock:'consumer_value_available_not_wire_receipt'});
  };
  const refuse=(attempt,reason)=>{
    if(!current(attempt)) return;
    event('inventory_consumer_refused',{attempt_id:attempt.id,reason:atom(reason,160)});
  };
  const verified=(attempt,result,registry)=>{
    if(!current(attempt)||!attempt?.record) return;
    const state=attempt.record;
    state.inventoryVerified=result?.ok===true;
    state.keys=registry; // Verification-time normalized public registry, not fetched bytes.
    event('inventory_verification',{attempt_id:attempt.id,...state.identity,
      ok:state.inventoryVerified,reason:atom(result?.reason,160)});
    if(state.inventoryVerified){
      latestVerified.delete(state.identity.kernel); latestVerified.set(state.identity.kernel,state);
      while(latestVerified.size>4){latestVerified.delete(latestVerified.keys().next().value);evictedInventories++;}
    }
  };
  const rowVerified=(attempt,row,envelope,registry)=>{
    if(!current(attempt)||!attempt?.record?.inventoryVerified||!row?._doc) return false;
    const state=attempt.record, provider=envelope?.record, document=envelope?.document;
    const documentHash=atom(provider?.document_hash), recordId=atom(provider?.record_id,300);
    if(!document||state.index?.documents?.[documentHash]!==document
      ||recordId!==row.record_id||recordId!==document?.record?.record_id
      ||row._kernel!==state.identity.kernel
      ||provider.inventory_generation!==state.identity.generation
      ||provider.inventory_manifest_hash!==state.identity.manifest_hash) return false;
    const proof={state,envelope,document,registry,recordId,documentHash,projected:row._doc};
    proofs.set(row._doc,proof);
    if(row._taskLifecycleVerified===true&&row.task_lifecycle){
      const t=row.task_lifecycle;
      event('verified_task_document',{attempt_id:attempt.id,...state.identity,
        record_id:recordId,document_hash:documentHash,task:atom(t.task_id),run:atom(t.run_id),
        state:atom(t.state),revision:atom(t.revision),current_execution:t.current_execution===true});
    }
    return true;
  };
  const admitted=(attempt,ok,reason)=>{
    if(!current(attempt)||!attempt?.record) return;
    attempt.record.admitted=ok===true;
    event('inventory_admission',{attempt_id:attempt.id,...attempt.record.identity,
      ok:ok===true,reason:atom(reason,160)});
  };
  const authorityFor=(row)=>{
    const proof=row?._doc&&proofs.get(row._doc), state=proof?.state;
    // An inherited inventory hash alone cannot prove the current projected row.
    if(!current(state?.attempt)||!state?.admitted||state.identity.omitted_identity_fields.length
      ||!state.identity.kernel||row._doc!==proof.projected||row.record_id!==proof.recordId
      ||row._kernel!==state.identity.kernel||row._inventorySource!==state.identity.kernel
      ||row._inventoryGeneration!==state.identity.generation
      ||row._inventoryHash!==state.identity.inventory_hash) return null;
    return proof;
  };
  const bindControl=(row,control)=>{
    if(!enabled) return '';
    const proof=authorityFor(row), links=proof?.document?.links;
    // The prototype deliberately supports only the exact advertised public
    // content route. Manifest-derived/synthetic controls remain unavailable.
    if(!proof||row.kind!=='artifact'||links?.content!==control?.path
      ||links?.content_hash!==control?.content_hash||!atom(control?.path,4096)
      ||typeof control?.base!=='string'||atom(control.base,2048)!==control.base) return '';
    const binding={...proof.state.identity,attempt_id:proof.state.attempt.id,record_id:proof.recordId,
      document_hash:proof.documentHash,path:control.path,content_hash:control.content_hash,
      transport_base:control.base};
    const key=canon(binding); // Stable signed identity plus exact rendered tuple; no new hash.
    controls.delete(key); controls.set(key,{reference:new WeakRef(proof),binding});
    return key;
  };
  const reconcileControls=(representedKeys)=>{
    if(!enabled) return;
    const represented=new Set(representedKeys);
    for(const key of controls.keys()) if(!represented.has(key)){controls.delete(key);retiredControls++;}
  };
  const rememberProjection=(projection,row,lifecycle=projection)=>{
    if(enabled&&projection&&typeof projection==='object')
      projections.set(projection,{proof:authorityFor(row),lifecycle});
    return projection;
  };
  const deriveProjection=(projection,lifecycle)=>{
    if(enabled&&projection&&typeof projection==='object')
      projections.set(projection,projections.get(lifecycle)||{proof:null,lifecycle});
    return projection;
  };
  const selection=(surface,proof,lifecycle,{reason='',display=null}={})=>{
    if(!enabled) return '';
    const details={surface:atom(surface,512),selected:!!lifecycle,selection_reason:atom(reason,160),
      authority_scope:'selected_task_lifecycle_only',
      authority_available:!!proof,attempt_id:proof?.state.attempt.id??null,
      ...(proof?proof.state.identity:{}),record_id:proof?.recordId||'',
      document_hash:proof?.documentHash||'',task:atom(lifecycle?.taskId),run:atom(lifecycle?.run),
      revision:atom(lifecycle?.revision),state:atom(lifecycle?.state),
      current_execution:lifecycle?.currentExecution===true};
    if(display){
      details.derived_display={};
      for(const name of ['key','label','exact_state','source','face_label'])
        details.derived_display[name]=atom(display[name],512);
      details.derived_display.active_call_face=display.active_call_face===true;
      details.derived_display.model_failure_face=display.model_failure_face===true;
      details.derived_display.authority='derived_ui_projection_requires_separate_source_evidence';
    }
    const serialized=canon(details);
    if(selections.get(surface)!==serialized){
      selections.delete(surface);selections.set(surface,serialized);
      while(selections.size>512) selections.delete(selections.keys().next().value);
      event('task_selection',details);
    }
    return serialized;
  };
  const select=(surface,row,lifecycle)=>selection(surface,authorityFor(row),lifecycle);
  const selectProjection=(surface,projection,options={})=>{
    const saved=projections.get(projection);
    return selection(surface,saved?.proof||null,saved?saved.lifecycle:projection,options);
  };
  const exportControl=(key,{fullInventory=false}={})=>{
    if(!enabled) return unavailable('observation_disabled');
    const held=controls.get(key), proof=held?.reference.deref();
    if(!proof) return unavailable('render_binding_retired_gc_or_absent');
    // Do not replace an expired render generation with today's same-byte record.
    const expires=Date.parse(proof.state.index?.expires_at||'');
    if(!Number.isFinite(expires)||expires<=now()) return unavailable('render_generation_expired');
    return canon({ok:true,schema:'browser-public-control-observation/1',binding:held.binding,
      attempt_id:proof.state.attempt.id,exported_at_ms:now(),
      browser_observed_outer_verification:true,browser_observed_selected_row_admission:true,
      verifier_registry:proof.registry,inventory_verifier_registry:proof.state.keys,
      registry_kind:'normalized_verification_time_public_registry',
      ...(fullInventory?{inventory:proof.state.index}:{provider_envelope:proof.envelope}),
      inventory_signature_reverification_requires_full_inventory:!fullInventory});
  };
  const exportLatestVerified=(kernel)=>{
    if(!enabled) return unavailable('observation_disabled');
    const state=latestVerified.get(kernel);
    if(!state) return unavailable('verified_inventory_reference_unavailable');
    return canon({ok:true,schema:'browser-public-inventory-observation/1',
      attempt_id:state.attempt.id,...state.identity,admitted:state.admitted,
      browser_observed_outer_verification:true,
      embedded_row_admission:'not_implied_by_outer_verification_or_this_export',
      inventory:state.index,verifier_registry:state.keys,
      registry_kind:'normalized_verification_time_public_registry'});
  };
  const read=(after=0)=>canon({schema:'browser-public-evidence-journal/1',enabled,session,
    latest_sequence:sequence,discarded_entries:lost,retired_control_bindings:retiredControls,
    latest_verified_reference_evictions:evictedInventories,
    retained_control_bindings:controls.size,events:journal.filter(row=>row.sequence>after)});
  const methods={enable,disable,active,begin,available,refuse,verified,rowVerified,admitted,
    bindControl,reconcileControls,rememberProjection,deriveProjection,select,selectProjection,
    exportControl,exportLatestVerified,read};
  // Observation failure can never change an admission result or stop rendering.
  const guarded=Object.fromEntries(Object.entries(methods).map(([name,fn])=>
    [name,(...args)=>{try{return fn(...args);}catch(error){
      try{event('diagnostic_error',{method:name,error:atom(String(error),160)});}catch(_){}
      return ['rememberProjection','deriveProjection'].includes(name)?args[0]:name==='bindControl'?'':name.startsWith('export')||name==='read'
        ?'{"ok":false,"reason":"diagnostic_export_failed"}':null;
    }}]));
  // Only reader may be exposed as the shipped public diagnostic interface.
  const readerNames=['enable','disable','exportControl','exportLatestVerified','read'];
  return Object.freeze({reader:Object.freeze(Object.fromEntries(readerNames.map(
    name=>[name,guarded[name]]))),producer:Object.freeze(Object.fromEntries(
    Object.entries(guarded).filter(([name])=>!readerNames.includes(name))))});
}
