import * as ed from './noble-ed25519.js';
import {evaluatePublicRecordAccess, validateProviderInventoryWindow}
  from './discovery-authority.mjs?v=20260715-provider-window-v1';

// This entry never discovers a route or consults a locator. It can only retry
// direct provider bases that the full application previously admitted and
// cached. Fresh self-certifying keys re-authorize the still-current signed
// compact identity snapshot before any identity text reaches the DOM.
const CACHE_KEY='personaos.fast-signed-identities.v1';
const CACHE_MAX_BYTES=2*1024*1024;
const MAX_SNAPSHOTS=4;
const FAST_PATH_DEADLINE_MS=850;
const HEX_32=/^[0-9a-f]{64}$/i;
const HEX_64=/^[0-9a-f]{128}$/i;
const SHA256=/^sha256:[0-9a-f]{64}$/;
const RECORD_ID=/^[A-Za-z0-9:_.-]{1,300}$/;
const PERSONA_ENVELOPE_FIELDS=Object.freeze([
  'card','path','persona_id','schema','signature_hex','signing_key_id','ttl_seconds',
].sort());
const PERSONA_CARD_REQUIRED_FIELDS=Object.freeze([
  'accepts_inbound_from','charter_hash','description','expires_at','federation_visibility',
  'identity_authority','kernel_a2a_url','kernel_provider','name','persona_id','rate_limit',
  'schema','signing_key_id','soul_hash','soul_version','visibility','voice_hash',
]);
const PERSONA_CARD_ALLOWED_FIELDS=new Set([
  ...PERSONA_CARD_REQUIRED_FIELDS,'avatar','capabilities_summary','characteristic_identity',
  'display_name_alias','participation_status',
]);
const PERSONA_LIFECYCLE_FIELDS=Object.freeze([
  'authority','did','identity_fields','identity_materialization_state',
  'identity_public_key_hex','identity_signature_hash','identity_signature_verified',
  'identity_signing_key_id','issued_at','lifecycle_transition_hash',
  'lifecycle_chain_verified','lifecycle_state','persona_id','schema','signature_hex',
  'signing_key_id',
].sort());
const enc=new TextEncoder();
const esc=(value)=>String(value??'').replace(/[&<>"]/g,
  (char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const hex=(value)=>Uint8Array.from(String(value||'').match(/.{1,2}/g)
  ?.map((byte)=>Number.parseInt(byte,16))||[]);

function canon(value){
  if(value===null||value===undefined) return 'null';
  if(Array.isArray(value)) return '['+value.map(canon).join(',')+']';
  if(typeof value==='object') return '{'+Object.keys(value).sort()
    .map((key)=>JSON.stringify(key)+':'+canon(value[key])).join(',')+'}';
  return JSON.stringify(value);
}

function withoutSignature(value){
  const out={};
  for(const key of Object.keys(value||{})) if(key!=='signature_hex') out[key]=value[key];
  return out;
}

function exactFields(value,fields){
  return !!value&&typeof value==='object'&&!Array.isArray(value)
    &&Object.keys(value).sort().join('\u0000')===fields.join('\u0000');
}

async function sha256(value){
  const digest=await crypto.subtle.digest('SHA-256',enc.encode(value));
  return 'sha256:'+Array.from(new Uint8Array(digest),
    (byte)=>byte.toString(16).padStart(2,'0')).join('');
}

async function signed(payload,signature,publicKey){
  if(!HEX_64.test(String(signature||''))||!HEX_32.test(String(publicKey||''))) return false;
  try{
    return await ed.verifyAsync(hex(signature),enc.encode(canon(payload)),hex(publicKey));
  }catch(_){
    return false;
  }
}

function normalizedBase(value,{sameOrigin=false}={}){
  if(sameOrigin){
    if(location.hostname==='ai-personas.github.io') return '';
    return location.origin;
  }
  try{
    const url=new URL(String(value||''));
    if(url.username||url.password||url.search||url.hash) return '';
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&location.protocol==='http:')) return '';
    url.pathname=url.pathname==='/'?'':url.pathname.replace(/\/+$/,'');
    return url.href.replace(/\/$/,'');
  }catch(_){
    return '';
  }
}

function relativeRoute(base,value,fallback){
  const path=String(value||fallback||'').replace(/^\/+/, '');
  if(!path||path.length>512||path.includes('\\')
      ||path.split('/').some((part)=>!part||part==='.'||part==='..')) return '';
  try{
    const root=new URL(String(base||location.origin).replace(/\/$/,'')+'/');
    const target=new URL(path,root);
    if(target.origin!==root.origin||target.username||target.password
        ||target.search||target.hash||!target.pathname.startsWith(root.pathname)) return '';
    return target.href;
  }catch(_){
    return '';
  }
}

async function boundedJson(url,{signal,maxBytes}){
  if(!url) return null;
  try{
    const response=await fetch(url,{signal,cache:'no-store',credentials:'omit',
      redirect:'error',referrerPolicy:'no-referrer'});
    if(!response.ok) return null;
    const declared=Number(response.headers.get('content-length'));
    if(Number.isFinite(declared)&&declared>maxBytes) return null;
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.byteLength>maxBytes) return null;
    return JSON.parse(new TextDecoder().decode(bytes));
  }catch(_){
    return null;
  }
}

function cachedSnapshots(){
  try{
    const raw=localStorage.getItem(CACHE_KEY)||'';
    if(!raw||raw.length>CACHE_MAX_BYTES) return [];
    const cache=JSON.parse(raw);
    if(cache?.schema!=='personaos-browser-signed-identity-cache/1'
        ||!Array.isArray(cache.snapshots)) return [];
    return cache.snapshots
      .filter((snapshot)=>snapshot?.schema==='personaos-browser-signed-identity-snapshot/1')
      .sort((left,right)=>Date.parse(right.stored_at||'')-Date.parse(left.stored_at||''))
      .slice(0,MAX_SNAPSHOTS);
  }catch(_){
    return [];
  }
}

function currentRegistry(keysDoc,kernelId){
  if(keysDoc?.schema!=='personaos-keys/1'||keysDoc.kernel_id!==kernelId
      ||!Array.isArray(keysDoc.keys)||keysDoc.keys.length>64) return null;
  const entries=keysDoc.keys.filter((entry)=>entry&&typeof entry==='object'
    &&HEX_32.test(String(entry.public_key_hex||'')));
  const masters=entries.filter((entry)=>entry.key_id==='kernel-master'
    &&entry.role==='master'&&entry.status==='current');
  if(masters.length!==1) return null;
  const master=String(masters[0].public_key_hex).toLowerCase();
  if(kernelId!==`kernel:${master.slice(0,16)}`) return null;
  const byId=new Map();
  for(const entry of entries){
    if(entry.status!=='current') continue;
    if(byId.has(entry.key_id)) return null;
    byId.set(String(entry.key_id),String(entry.public_key_hex).toLowerCase());
  }
  return {master,byId};
}

function policyPayload(policy){
  const out={};
  for(const field of ['schema','policy_id','subject_kind','subject_id','owner_persona_id',
    'access_grants','outward_tier','cross_tenant_agreement_ref'])
    if(Object.hasOwn(policy||{},field)) out[field]=policy[field];
  return out;
}

function safeText(value,maximum){
  const text=String(value||'').normalize('NFC').trim();
  return text&&text.length<=maximum&&!/[\u0000-\u001f\u007f]/u.test(text)?text:'';
}

function signedPersonaIdentity(record,kernelId){
  if(record?.kind!=='persona'||record.visibility_tier!=='public'
      ||typeof record.did!=='string') return null;
  const did=record.did.normalize('NFC').trim();
  const prefix=`did:personaos:${kernelId}/persona/`;
  if(!did.startsWith(prefix)) return null;
  const signedId=did.slice(prefix.length);
  if(!signedId||signedId.length>180||/[\u0000-\u0020/\\]/u.test(signedId)) return null;
  const canonicalId=signedId.startsWith('persona:')
    ?signedId.slice('persona:'.length):signedId;
  return canonicalId&&canonicalId.length<=180&&!/[\u0000-\u0020/\\]/u.test(canonicalId)
    ?{signedId,canonicalId,did}:null;
}

async function verifiedLifecycle(lifecycle,record,identity,identityKey,registry){
  if(!exactFields(lifecycle,PERSONA_LIFECYCLE_FIELDS)
      ||lifecycle.schema!=='personaos-persona-lifecycle-card/2'
      ||lifecycle.persona_id!==identity.signedId||lifecycle.did!==identity.did
      ||lifecycle.signing_key_id!=='kernel-master'
      ||lifecycle.lifecycle_state!=='ACTIVE'
      ||lifecycle.authority!=='kernel_observed_verified_persona_lifecycle'
      ||lifecycle.identity_signing_key_id!==`persona:${identity.signedId}`
      ||String(lifecycle.identity_public_key_hex||'').toLowerCase()!==identityKey
      ||lifecycle.identity_signature_verified!==true
      ||lifecycle.lifecycle_chain_verified!==true
      ||!SHA256.test(String(lifecycle.identity_signature_hash||''))
      ||!SHA256.test(String(lifecycle.lifecycle_transition_hash||''))
      ||!Number.isFinite(Date.parse(String(lifecycle.issued_at||'')))
      ||!['pending','materialized'].includes(lifecycle.identity_materialization_state))
    return null;
  const fields=lifecycle.identity_fields;
  if(!exactFields(fields,['avatar','characteristics','name'])) return null;
  const projected={};
  for(const name of ['name','characteristics','avatar']){
    const field=fields[name];
    if(!exactFields(field,['persona_authored','state'])
        ||!['pending','materialized'].includes(field.state)
        ||typeof field.persona_authored!=='boolean'
        ||field.persona_authored!==(field.state==='materialized')) return null;
    projected[name]={state:field.state,personaAuthored:field.persona_authored};
  }
  const allMaterialized=Object.values(projected)
    .every((field)=>field.state==='materialized');
  if((lifecycle.identity_materialization_state==='materialized')!==allMaterialized
      ||!await signed(withoutSignature(lifecycle),lifecycle.signature_hex,registry.master))
    return null;
  return {materialization:lifecycle.identity_materialization_state,fields:projected};
}

async function verifiedPersonaCard(envelope,record,identity,identityKey){
  const card=envelope?.card;
  if(!exactFields(envelope,PERSONA_ENVELOPE_FIELDS)
      ||envelope.schema!=='persona-card/4'||envelope.persona_id!==identity.signedId
      ||envelope.path!==`.well-known/personas/${identity.signedId}.json`
      ||envelope.signing_key_id!==`persona:${identity.signedId}`
      ||!Number.isSafeInteger(envelope.ttl_seconds)||envelope.ttl_seconds<1
      ||envelope.ttl_seconds>86400||!card||typeof card!=='object'||Array.isArray(card)
      ||PERSONA_CARD_REQUIRED_FIELDS.some((field)=>!Object.hasOwn(card,field))
      ||Object.keys(card).some((field)=>!PERSONA_CARD_ALLOWED_FIELDS.has(field))
      ||card.schema!=='persona-card/4'||card.persona_id!==identity.signedId
      ||card.signing_key_id!==`persona:${identity.signedId}`
      ||record.identity_signing_key_id!==`persona:${identity.signedId}`
      ||String(record.identity_public_key_hex||'').toLowerCase()!==identityKey
      ||card.visibility!=='public'||card.federation_visibility!=='public'
      ||card.name!==record.label||!safeText(card.name,80)
      ||typeof card.description!=='string'||card.description.length>240
      ||!Number.isSafeInteger(card.soul_version)
      ||!card.rate_limit||typeof card.rate_limit!=='object'||Array.isArray(card.rate_limit)
      ||!card.identity_authority||typeof card.identity_authority!=='object'
      ||Array.isArray(card.identity_authority)||!Object.keys(card.identity_authority).length
      ||Date.parse(String(card.expires_at||''))<=Date.now()
      ||canon(card.avatar||{})!==canon(record.avatar||{})
      ||!await signed(card,envelope.signature_hex,identityKey)) return null;
  for(const field of ['accepts_inbound_from','charter_hash','voice_hash','soul_hash',
    'kernel_provider','kernel_a2a_url']) if(typeof card[field]!=='string') return null;
  for(const field of ['display_name_alias','characteristic_identity'])
    if(Object.hasOwn(card,field)&&(!card[field]||typeof card[field]!=='object'
      ||Array.isArray(card[field])||!Object.keys(card[field]).length)) return null;
  if(Object.hasOwn(card,'participation_status')
      &&(typeof card.participation_status!=='string'||!card.participation_status)) return null;
  return card;
}

async function verifiedPersona(doc,record,registry,kernelId){
  const identity=signedPersonaIdentity(record,kernelId);
  if(!identity) return null;
  const lifecycle=doc.persona_lifecycle_card;
  const personaId=identity.signedId;
  const identityKeyId=`persona:${identity.signedId}`;
  const identityKey=String(record?.identity_public_key_hex||'').toLowerCase();
  if(record.identity_signing_key_id!==identityKeyId||!HEX_32.test(identityKey)
      ||registry.byId.get(identityKeyId)!==identityKey) return null;
  const lifecycleProjection=await verifiedLifecycle(
    lifecycle,record,identity,identityKey,registry);
  if(!lifecycleProjection) return null;
  const card=lifecycleProjection.materialization==='materialized'
    ?await verifiedPersonaCard(doc.persona_card,record,identity,identityKey):null;
  if(lifecycleProjection.materialization==='materialized'&&!card) return null;
  const authoredName=!!card&&lifecycleProjection.fields.name.personaAuthored===true;
  const name=authoredName?safeText(card.name,80):'New persona';
  return {
    kind:'persona',id:identity.canonicalId,name,
    description:card?safeText(card.description,240):'',
    pending:lifecycleProjection.materialization==='pending',
    lifecycle:'ACTIVE',
  };
}

async function verifiedIdentityRows(index,base,boot,registry){
  const fields=['base','document_count','documents','expires_at','generated_at',
    'inventory_generation','inventory_hash','inventory_manifest_hash','kernel_id','schema',
    'signature_hex','signing_key_id','visibility'].sort();
  if(!index||typeof index!=='object'||Array.isArray(index)
      ||Object.keys(index).sort().join('\u0000')!==fields.join('\u0000')
      ||index.schema!=='personaos-public-identity-index/1'
      ||index.kernel_id!==boot.kernel_id||index.visibility!=='public'
      ||index.signing_key_id!=='kernel-master'
      ||!Number.isSafeInteger(index.inventory_generation)||index.inventory_generation<1
      ||!SHA256.test(String(index.inventory_hash||''))
      ||!SHA256.test(String(index.inventory_manifest_hash||''))
      ||!Number.isSafeInteger(index.document_count)||index.document_count<1
      ||index.document_count>512||!index.documents
      ||typeof index.documents!=='object'||Array.isArray(index.documents)
      ||Object.keys(index.documents).length!==index.document_count
      ||!validateProviderInventoryWindow(index.generated_at,index.expires_at).ok
      ||normalizedBase(index.base)!==normalizedBase(base)
      ||!await signed(withoutSignature(index),index.signature_hex,registry.master)) return [];
  const entries=Object.entries(index.documents),recordIds=new Set();
  for(const [documentHash,doc] of entries){
    const record=doc?.record,policy=doc?.access_policy;
    const recordId=String(record?.record_id||'');
    if(!SHA256.test(documentHash)||!record||!policy
        ||!['persona','env'].includes(String(record.kind||''))
        ||!RECORD_ID.test(recordId)||recordIds.has(recordId)
        ||doc.schema!==record.schema||doc.discovery_kind!==record.kind
        ||doc.kind!==record.kind||doc.visibility_tier!=='public'
        ||record.visibility_tier!=='public'
        ||doc.host_kernel_id!==boot.kernel_id||doc.kernel_id!==boot.kernel_id
        ||normalizedBase(doc.base)!==normalizedBase(base)
        ||doc.signing_key_id!=='kernel-master') return [];
    recordIds.add(recordId);
  }
  // Hash and signature checks are independent per identity document. Running
  // them concurrently keeps a large warm identity deck from turning into a
  // one-record-at-a-time paint delay; Promise.all preserves inventory order.
  const rows=await Promise.all(entries.map(async([documentHash,doc])=>{
    const record=doc.record,policy=doc.access_policy;
    if(await sha256(canon(doc))!==documentHash
        ||!await signed(record,doc.signature_hex,registry.master)
        ||!await signed(policyPayload(policy),policy.signature_hex,registry.master)) return null;
    const access=evaluatePublicRecordAccess(record,policy,doc.links||{});
    if(!access.ok||!access.canDiscover) return null;
    if(record.kind==='persona'){
      const persona=await verifiedPersona(doc,record,registry,boot.kernel_id);
      return persona||null;
    }
    const prefix=`did:personaos:${boot.kernel_id}/env/`;
    const did=String(record.did||'');
    const id=did.startsWith(prefix)?safeText(did.slice(prefix.length),256):'';
    const name=safeText(record.label,240);
    return id&&!id.includes('/')&&name?{kind:'env',id,name}:null;
  }));
  return rows.every(Boolean)?rows:[];
}

async function verifyCachedIdentityWithFreshAuthority(snapshot,signal){
  const kernelId=safeText(snapshot?.kernel_id,128);
  const base=normalizedBase(snapshot?.provider_base,{sameOrigin:snapshot?.same_origin===true});
  if(!kernelId||!base) return [];
  const bootstrapUrl=relativeRoute(base,'.well-known/personaos-discovery.json');
  const defaultKeysUrl=relativeRoute(base,'.well-known/personaos-keys.json');
  const [boot,defaultKeysDoc]=await Promise.all([
    boundedJson(bootstrapUrl,{signal,maxBytes:256*1024}),
    boundedJson(defaultKeysUrl,{signal,maxBytes:256*1024}),
  ]);
  if(boot?.schema!=='personaos-discovery-bootstrap/1'||boot.kernel_id!==kernelId) return [];
  const keysUrl=relativeRoute(base,boot.keys_url,'.well-known/personaos-keys.json');
  const keysDoc=keysUrl===defaultKeysUrl?defaultKeysDoc
    :await boundedJson(keysUrl,{signal,maxBytes:256*1024});
  const index=snapshot.identity_index;
  const registry=currentRegistry(keysDoc,kernelId);
  if(!registry) return [];
  const rows=await verifiedIdentityRows(index,base,boot,registry);
  return rows.length?[{kernelId,base,rows}]:[];
}

function compact(value,maximum=112){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  return text.length<=maximum?text:`${text.slice(0,Math.max(1,maximum-1)).trimEnd()}…`;
}

function personaCard(row,kernelId,index){
  const hue=(Array.from(row.id).reduce((sum,char)=>sum+char.codePointAt(0),0)+index*29)%360;
  return `<article class="pcard identity-signed identity-first-card" style="--avatar-hue:${hue}" aria-label="${esc(row.name)} verified persona identity">`
    +'<div class="pc-card-shine" aria-hidden="true"></div>'
    +`<div class="pc-card-edition"><span>✓ VERIFIED PROFILE</span><span>IDENTITY FIRST</span></div>`
    +'<header class="pc-profile">'
    +`<span class="pc-avatar" data-avatar-state="identity-first" aria-label="portrait loads with the full persona view"><span class="pc-avatar-placeholder" aria-hidden="true"><span class="pc-avatar-silhouette"><i></i></span><small>portrait loading</small></span></span>`
    +'<i class="pc-dot off" aria-hidden="true"></i>'
    +`<div class="pc-identity"><h3 class="pc-name">${esc(row.name)}</h3><span class="pc-name-proof">✓ signed identity verified</span>`
    +`<span class="pc-role-line"><small>${row.description?'Self-description':'Profile state'}</small><strong>${esc(row.description||'Self-description still forming')}</strong></span></div>`
    +`<div class="pc-badges"><span class="pc-idle">${esc(row.lifecycle)}</span></div></header>`
    +`<section class="pc-current"><span class="pc-current-label">Loading current work</span><div class="pc-doing"><span class="pc-rest">●</span><strong>Verified persona found; joining live work now</strong></div></section>`
    +`<div class="pc-stats"><span class="tag" title="current signed node identity">${esc(kernelId)}</span></div></article>`;
}

function environmentCard(row,kernelId){
  const words=row.name.split(/\s+/).filter(Boolean);
  const initials=(words.length>1?words[0][0]+words.at(-1)[0]:words[0]?.slice(0,2)||'EN').toUpperCase();
  return `<article class="env-card record-signed identity-first-card" aria-label="verified workspace ${esc(row.name)}">`
    +'<div class="env-card-foil" aria-hidden="true"></div><header class="env-card-profile">'
    +`<div class="env-card-avatar"><span class="env-card-glyph">□</span><strong>${esc(initials)}</strong></div>`
    +`<div class="env-identity"><span class="env-kicker">SHARED WORKSPACE</span><span class="env-name">${esc(compact(row.name))}</span>`
    +`<span class="env-card-id">${esc(kernelId)}</span></div><span class="env-state ok">verified</span></header>`
    +'<div class="env-card-empty">Loading people, current work, and files…</div></article>';
}

function paintIdentityFirst(groups){
  const host=document.querySelector('#sysEnvs');
  if(!host) return false;
  const personas=groups.flatMap((group)=>group.rows
    .filter((row)=>row.kind==='persona').map((row)=>({...row,kernelId:group.kernelId})));
  const environments=groups.flatMap((group)=>group.rows
    .filter((row)=>row.kind==='env').map((row)=>({...row,kernelId:group.kernelId})));
  if(!personas.length&&!environments.length) return false;
  host.dataset.identityFirst='1';
  host.innerHTML=`<div class="stage-summary"><div><strong>${personas.length} ${personas.length===1?'persona':'personas'} · ${environments.length} ${environments.length===1?'workspace':'workspaces'}</strong> <span class="scope-copy">· fresh compact identities verified · loading live activity</span></div></div>`
    +(personas.length?`<section class="persona-section"><header class="stage-section-head"><div><span class="section-kicker">PERSONA DECK</span><h2>Verified personas</h2></div><p role="status">Identity arrived first; current work and files are loading now.</p></header><div class="persona-deck">${personas.map((row,index)=>personaCard(row,row.kernelId,index)).join('')}</div></section>`:'')
    +(environments.length?`<section class="environment-section"><header class="stage-section-head compact"><div><span class="section-kicker">ENVIRONMENT INDEX</span><h2>Verified workspaces</h2></div><p role="status">Workspace identities found; joining live detail.</p></header><div class="environment-grid">${environments.map((row)=>environmentCard(row,row.kernelId)).join('')}</div></section>`:'');
  const status=document.querySelector('#status');
  if(status) status.textContent=`${personas.length+environments.length} fresh signed identities verified · loading full live view…`;
  const scope=document.querySelector('#networkScope');
  if(scope) scope.textContent=`${new Set(groups.map((group)=>group.kernelId)).size} verified ${groups.length===1?'node':'nodes'} · live detail loading`;
  globalThis.__personaOSIdentityFirstPaint={at:Date.now(),personas:personas.length,
    environments:environments.length};
  return true;
}

async function identityFirst(){
  if(!globalThis.crypto?.subtle) return false;
  const snapshots=cachedSnapshots();
  if(!snapshots.length) return false;
  const controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),FAST_PATH_DEADLINE_MS);
  const groups=[];
  try{
    const jobs=snapshots.map(async(snapshot)=>{
      const found=await verifyCachedIdentityWithFreshAuthority(snapshot,controller.signal);
      if(found.length){
        for(const group of found){
          const prior=groups.findIndex((item)=>item.kernelId===group.kernelId);
          if(prior>=0) groups.splice(prior,1);
          groups.push(group);
        }
        paintIdentityFirst(groups);
      }
    });
    await Promise.allSettled(jobs);
    return groups.length>0;
  }finally{
    clearTimeout(deadline);
    controller.abort();
  }
}

function afterPaint(){
  return new Promise((resolve)=>{
    if(typeof requestAnimationFrame!=='function'){ setTimeout(resolve,0); return; }
    requestAnimationFrame(()=>requestAnimationFrame(resolve));
  });
}

const painted=await identityFirst().catch(()=>false);
if(painted) await afterPaint();
await import('./discovery.js?v=20260804-run-package-v7');
