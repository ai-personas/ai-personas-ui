import * as ed from './noble-ed25519.js';
import {installEd25519HashFallback, sha256Hex}
  from './live-artifacts.mjs?v=20260720-active-call-capture-v3';
import {evaluatePublicRecordAccess, validateProviderInventoryWindow}
  from './discovery-authority.mjs?v=20260715-provider-window-v1';
import {readOfflineHistorySnapshots,verifyOfflineHistorySnapshots}
  from './offline-history.mjs?v=20260808-offline-history-v2';

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
  'display_name_alias','participation_status','self_publication',
]);
// persona-card/5 adds the optional persona-authored `self_publication` object.
// Accept /4 and /5; the member is opaque here and never rendered by this entry.
const PERSONA_CARD_ACCEPTED_SCHEMAS=new Set(['persona-card/4','persona-card/5']);
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

// A plain-HTTP LAN origin is not a secure context and withholds SubtleCrypto.
// Both digests fall back to the same in-page implementations so this entry
// verifies exactly what it verifies over loopback or HTTPS.
installEd25519HashFallback(ed.etc);

async function sha256(value){
  return 'sha256:'+await sha256Hex(enc.encode(value));
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

async function verifiedPersonaCard(envelope,record,identity,identityKey,{nowMs=Date.now()}={}){
  const card=envelope?.card;
  if(!exactFields(envelope,PERSONA_ENVELOPE_FIELDS)
      ||!PERSONA_CARD_ACCEPTED_SCHEMAS.has(envelope.schema)||envelope.persona_id!==identity.signedId
      ||envelope.path!==`.well-known/personas/${identity.signedId}.json`
      ||envelope.signing_key_id!==`persona:${identity.signedId}`
      ||!Number.isSafeInteger(envelope.ttl_seconds)||envelope.ttl_seconds<1
      ||envelope.ttl_seconds>86400||!card||typeof card!=='object'||Array.isArray(card)
      ||PERSONA_CARD_REQUIRED_FIELDS.some((field)=>!Object.hasOwn(card,field))
      ||Object.keys(card).some((field)=>!PERSONA_CARD_ALLOWED_FIELDS.has(field))
      ||card.schema!==envelope.schema||card.persona_id!==identity.signedId
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
      ||!Number.isFinite(Date.parse(String(card.expires_at||'')))
      ||Date.parse(String(card.expires_at||''))<=nowMs
      ||canon(card.avatar||{})!==canon(record.avatar||{})
      ||!await signed(card,envelope.signature_hex,identityKey)) return null;
  for(const field of ['accepts_inbound_from','charter_hash','voice_hash','soul_hash',
    'kernel_provider','kernel_a2a_url']) if(typeof card[field]!=='string') return null;
  for(const field of ['display_name_alias','characteristic_identity','self_publication'])
    if(Object.hasOwn(card,field)&&(!card[field]||typeof card[field]!=='object'
      ||Array.isArray(card[field])||!Object.keys(card[field]).length)) return null;
  if(Object.hasOwn(card,'participation_status')
      &&(typeof card.participation_status!=='string'||!card.participation_status)) return null;
  return card;
}

async function verifiedPersona(doc,record,registry,kernelId,{nowMs=Date.now()}={}){
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
    ?await verifiedPersonaCard(doc.persona_card,record,identity,identityKey,{nowMs}):null;
  if(lifecycleProjection.materialization==='materialized'&&!card) return null;
  const authoredName=!!card&&lifecycleProjection.fields.name.personaAuthored===true;
  const name=authoredName?safeText(card.name,80):'New persona';
  return {
    kind:'persona',id:identity.canonicalId,name,
    description:card?safeText(card.description,240):'',
    pending:lifecycleProjection.materialization==='pending',
    avatarAvailable:Boolean(card?.avatar),
    lifecycle:'ACTIVE',
  };
}

async function verifiedIdentityRows(index,base,boot,registry,
  {nowMs=Date.now(),maxFutureSkewMs=30000}={}){
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
      ||!validateProviderInventoryWindow(index.generated_at,index.expires_at,
        {nowMs,maxFutureSkewMs}).ok
      ||Date.parse(index.generated_at)>nowMs+maxFutureSkewMs
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
    const access=evaluatePublicRecordAccess(record,policy,doc.links||{},{nowMs});
    if(!access.ok||!access.canDiscover) return null;
    if(record.kind==='persona'){
      const persona=await verifiedPersona(doc,record,registry,boot.kernel_id,{nowMs});
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

async function verifyCachedHistoricalIdentity(snapshot){
  const kernelId=safeText(snapshot?.kernel_id,128);
  const base=normalizedBase(snapshot?.provider_base,{sameOrigin:snapshot?.same_origin===true});
  const boot=snapshot?.boot,registry=currentRegistry(snapshot?.keys,kernelId);
  const observedAt=Date.parse(String(snapshot?.stored_at||''));
  if(!kernelId||!base||boot?.kernel_id!==kernelId||!registry
      ||!Number.isFinite(observedAt)||observedAt>Date.now()+30000) return [];
  const rows=await verifiedIdentityRows(
    snapshot.identity_index,base,boot,registry,{nowMs:observedAt,maxFutureSkewMs:0});
  if(!rows.length) return [];
  const storedAt=new Date(observedAt).toISOString();
  const index=snapshot.identity_index;
  return [{
    schema:'personaos-browser-verified-public-history/2',
    kernel_id:kernelId,
    stored_at:storedAt,
    lease:{generation:index.inventory_generation,inventory_hash:index.inventory_hash,
      generated_at:index.generated_at,expires_at:index.expires_at},
    counts:{persona:rows.filter((row)=>row.kind==='persona').length,
      env:rows.filter((row)=>row.kind==='env').length,artifact:0},
    personas:rows.filter((row)=>row.kind==='persona').map((row)=>({
      id:row.id,name:row.name,description:row.description,lifecycle:row.lifecycle,
      profile_state:row.pending?'pending':'materialized',avatar_available:row.avatarAvailable===true,
    })),
    environments:rows.filter((row)=>row.kind==='env').map((row)=>({
      id:row.id,name:row.name,description:'',capabilities:[],
    })),
    artifacts:[],
  }];
}

function compact(value,maximum=112){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  return text.length<=maximum?text:`${text.slice(0,Math.max(1,maximum-1)).trimEnd()}…`;
}

// Deterministic identicon (same 5x5 mirrored-grid algorithm as the full app):
// stable per-id art from the identifier hash alone, no persona-authorship claim.
function identiconHash(value){ let h=2166136261>>>0;
  for(const ch of String(value||'')){ h^=ch.codePointAt(0); h=Math.imul(h,16777619)>>>0; }
  return h>>>0; }
function identiconSVG(id){
  let h=identiconHash(id);
  const next=()=>{ h=Math.imul(h^(h>>>15),2246822519)>>>0;
    h=Math.imul(h^(h>>>13),3266489917)>>>0; return (h^=h>>>16)>>>0; };
  const hue=identiconHash(`hue:${id}`)%360;
  const cells=[];
  for(let x=0;x<3;x++) for(let y=0;y<5;y++) if(next()%2===1){
    cells.push([x,y]); if(x<2) cells.push([4-x,y]); }
  if(!cells.length) cells.push([2,1],[1,2],[2,2],[3,2],[2,3]);
  const rects=cells.map(([x,y])=>`<rect x="${3+x*10}" y="${3+y*10}" width="10" height="10" rx="1.5"/>`).join('');
  return `<svg class="pk-identicon" viewBox="0 0 56 56" role="img" aria-label="deterministic identicon derived from the identifier" style="--pk-idhue:${hue}"><rect class="pk-id-bg" x="0" y="0" width="56" height="56" rx="10"/><g class="pk-id-fg">${rects}</g></svg>`;
}

function personaCard(row,kernelId,index,{offline=false,storedAt=''}={}){
  const hue=(Array.from(row.id).reduce((sum,char)=>sum+char.codePointAt(0),0)+index*29)%360;
  const when=storedAt?new Date(storedAt).toLocaleString():'an earlier visit';
  return `<article class="pcard identity-signed identity-first-card${offline?' offline-history-card':''}" style="--avatar-hue:${hue}" aria-label="${esc(row.name)} ${offline?'offline history':'verified persona identity'}">`
    +'<div class="pc-card-shine" aria-hidden="true"></div>'
    +`<div class="pc-card-edition"><span>${offline?'OFFLINE HISTORY':'✓ VERIFIED PROFILE'}</span><span>${offline?'NOT LIVE':'IDENTITY FIRST'}</span></div>`
    +'<header class="pc-profile">'
    +`<span class="pc-avatar" data-avatar-state="identity-first" aria-label="${offline?'portrait body is not retained in offline history':'portrait loads with the full persona view'}"><span class="pc-avatar-placeholder" aria-hidden="true">${identiconSVG(row.id)}<small>${offline?(row.avatar_available?'portrait offline':'portrait unavailable'):'portrait loading'}</small></span></span>`
    +'<i class="pc-dot off" aria-hidden="true"></i>'
    +`<div class="pc-identity"><h3 class="pc-name">${esc(row.name)}</h3><span class="pc-name-proof">${offline?'historical signatures rechecked':'✓ signed identity verified'}</span>`
    +`<span class="pc-role-line"><small>${row.description?'Self-description':'Profile state'}</small><strong>${esc(row.description||'Self-description still forming')}</strong></span></div>`
    +`<div class="pc-badges"><span class="pc-idle">${offline?'OFFLINE':esc(row.lifecycle)}</span></div></header>`
    +`<section class="pc-current"><span class="pc-current-label">${offline?'Cached signed observation':'Loading current work'}</span><div class="pc-doing"><span class="pc-rest">●</span><strong>${offline?`Signed identity lease was valid at ${esc(when)}; current activity is unknown.`:'Verified persona found; joining live work now'}</strong></div></section>`
    +`<div class="pc-stats"><span class="tag" title="${offline?'historical node identity':'current signed node identity'}">${esc(kernelId)}</span></div></article>`;
}

function environmentCard(row,kernelId,{offline=false,storedAt=''}={}){
  const words=row.name.split(/\s+/).filter(Boolean);
  const initials=(words.length>1?words[0][0]+words.at(-1)[0]:words[0]?.slice(0,2)||'EN').toUpperCase();
  const when=storedAt?new Date(storedAt).toLocaleString():'an earlier visit';
  return `<article class="env-card record-signed identity-first-card${offline?' offline-history-card':''}" aria-label="${offline?'offline history for':'verified workspace'} ${esc(row.name)}">`
    +'<div class="env-card-foil" aria-hidden="true"></div><header class="env-card-profile">'
    +`<div class="env-card-avatar"><span class="env-card-glyph">□</span><strong>${esc(initials)}</strong></div>`
    +`<div class="env-identity"><span class="env-kicker">${offline?'OFFLINE WORKSPACE HISTORY':'SHARED WORKSPACE'}</span><span class="env-name">${esc(compact(row.name))}</span>`
    +`<span class="env-card-id">${esc(kernelId)}</span></div><span class="env-state ${offline?'':'ok'}">${offline?'offline':'verified'}</span></header>`
    +`<div class="env-card-empty">${offline?`Signed workspace evidence was valid at ${esc(when)}. Current people, work, and files are unknown.`:'Loading people, current work, and files…'}</div></article>`;
}

function offlineArtifactHTML(row){
  const path=String(row.path||'artifact'),leaf=path.replace(/\\/g,'/').split('/').filter(Boolean).at(-1)||path;
  const dot=leaf.lastIndexOf('.'),extension=dot>0&&dot<leaf.length-1?`.${leaf.slice(dot+1).toUpperCase()}`:'';
  const title=dot>0?leaf.slice(0,dot).replace(/[_-]+/g,' '):leaf;
  const media=row.media?.[0]||'format not declared',hash=String(row.content_hash||'');
  return `<div class="current-artifact-file artifact-preview-unavailable offline-history-artifact" aria-label="${esc(path)} — offline metadata only">`
    +`<span class="artifact-format-tile"><small>Format</small><strong>${esc(extension.replace(/^\./,'')||'FILE')}</strong></span>`
    +`<span class="current-artifact-copy"><span class="artifact-file-title" title="${esc(path)}"><b>${esc(compact(title,100))}</b>${extension?`<span class="artifact-extension-badge">${esc(extension)}</span>`:''}</span>`
    +`<small>${esc(media)}${row.size_bytes!=null?` · ${esc(row.size_bytes)} bytes`:''}${row.environment_id?` · workspace ${esc(row.environment_id)}`:''}${hash?` · ${esc(hash.slice(0,18))}…`:''}</small></span><span class="current-artifact-preview">Metadata only · offline</span></div>`;
}

function paintOfflineHistory(snapshots){
  const host=document.querySelector('#sysEnvs');
  if(!host||!Array.isArray(snapshots)||!snapshots.length) return false;
  // Live/full application cards always outrank the historical first paint.
  if(host.querySelector('.pcard:not(.identity-first-card),.env-card:not(.identity-first-card)'))
    return false;
  const byKernel=new Map();
  for(const snapshot of snapshots){
    const prior=byKernel.get(snapshot.kernel_id);
    if(!prior||Date.parse(snapshot.stored_at)>Date.parse(prior.stored_at)) byKernel.set(snapshot.kernel_id,snapshot);
  }
  const groups=[...byKernel.values()];
  const snapshotLabel=groups.every((group)=>
    Date.parse(String(group?.lease?.expires_at||''))<=Date.now())
    ?'Expired signed snapshot cached by this browser'
    :'Signed snapshot cached by this browser · offline';
  const personas=groups.flatMap((group)=>group.personas.map((row)=>({...row,kernelId:group.kernel_id,storedAt:group.stored_at})));
  const environments=groups.flatMap((group)=>group.environments.map((row)=>({...row,kernelId:group.kernel_id,storedAt:group.stored_at})));
  const artifacts=groups.flatMap((group)=>group.artifacts.map((row)=>({...row,kernelId:group.kernel_id,storedAt:group.stored_at})));
  if(!personas.length&&!environments.length&&!artifacts.length) return false;
  const totalCounts=groups.reduce((out,group)=>({persona:out.persona+group.counts.persona,
    env:out.env+group.counts.env,artifact:out.artifact+group.counts.artifact}),{persona:0,env:0,artifact:0});
  host.dataset.offlineHistory='1';
  host.innerHTML=`<section class="offline-history-banner" role="status"><strong>${esc(snapshotLabel)}</strong><span>The browser rechecked cached signatures, hashes, policies, and their historical lease window. The cached timestamp is not evidence of current liveness. Live direct and peer discovery is continuing.</span></section>`
    +`<div class="stage-summary"><div><strong>${totalCounts.persona} ${totalCounts.persona===1?'persona':'personas'} · ${totalCounts.env} ${totalCounts.env===1?'workspace':'workspaces'} · ${totalCounts.artifact} artifact${totalCounts.artifact===1?'':'s'}</strong> <span class="scope-copy">· offline metadata history · not live</span></div></div>`
    +(personas.length?`<section class="persona-section offline-history-section"><header class="stage-section-head"><div><span class="section-kicker">OFFLINE PERSONA HISTORY</span><h2>Personas in cached signed evidence</h2></div><p>No current activity or availability is implied.</p></header><div class="persona-deck">${personas.slice(0,24).map((row,index)=>personaCard(row,row.kernelId,index,{offline:true,storedAt:row.storedAt})).join('')}</div></section>`:'')
    +(environments.length?`<section class="environment-section offline-history-section"><header class="stage-section-head compact"><div><span class="section-kicker">OFFLINE WORKSPACE HISTORY</span><h2>Workspaces in cached signed evidence</h2></div><p>Live membership and work state are unknown.</p></header><div class="environment-grid">${environments.slice(0,24).map((row)=>environmentCard(row,row.kernelId,{offline:true,storedAt:row.storedAt})).join('')}</div></section>`:'')
    +(artifacts.length?`<section class="offline-history-files"><header class="stage-section-head compact"><div><span class="section-kicker">OFFLINE ARTIFACT INDEX</span><h2>File metadata in cached signed evidence</h2></div><p>Bodies stay closed until a current verified provider route returns.</p></header><div class="current-artifact-list">${artifacts.slice(0,80).map(offlineArtifactHTML).join('')}</div>${artifacts.length>80?`<p class="persona-window-note">${artifacts.length-80} additional historical artifact records retained in the bounded cache.</p>`:''}</section>`:'');
  const status=document.querySelector('#status');
  if(status) status.textContent=`${groups.length} offline node histor${groups.length===1?'y':'ies'} shown · live discovery continuing…`;
  const scope=document.querySelector('#networkScope');
  if(scope) scope.textContent=`offline history from ${groups.length} previously verified ${groups.length===1?'node':'nodes'} · discovering live peers`;
  globalThis.__personaOSOfflineHistory=groups;
  return true;
}

function paintIdentityFirst(groups){
  const host=document.querySelector('#sysEnvs');
  if(!host) return false;
  // The full application may already have admitted and painted current records
  // while this independent fast fetch was in flight. Never replace that richer
  // current view with the compact identity shell.
  if(host.querySelector('.pcard:not(.identity-first-card),.env-card:not(.identity-first-card)')) return false;
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

async function cachedHistoricalIdentitySnapshots(){
  const groups=[];
  const results=await Promise.allSettled(cachedSnapshots().map(
    (snapshot)=>verifyCachedHistoricalIdentity(snapshot)));
  for(const result of results) if(result.status==='fulfilled') groups.push(...result.value);
  return groups;
}

function publishOfflineHistory(values){
  const byKernel=new Map();
  for(const value of (Array.isArray(values)?values:[])){
    if(value?.schema!=='personaos-browser-verified-public-history/2') continue;
    const prior=byKernel.get(value.kernel_id);
    if(!prior||Date.parse(value.stored_at)>=Date.parse(prior.stored_at))
      byKernel.set(value.kernel_id,value);
  }
  const projections=[...byKernel.values()];
  globalThis.__personaOSOfflineHistory=projections;
  globalThis.dispatchEvent?.(new CustomEvent('personaos:offline-history',
    {detail:projections}));
  return projections;
}

// Current identity verification, the full live application, and historical
// cryptography start together. Cached bytes can therefore never delay direct or
// peer discovery. History stays an inert DOM projection with no reusable route.
const applicationJob=import('./discovery.js?v=20260902-member-view-v2');
const currentIdentityJob=identityFirst().catch(()=>false);
const historicalJob=(async()=>{
  const [providerHistory,identityHistory]=await Promise.all([
    verifyOfflineHistorySnapshots(readOfflineHistorySnapshots()).catch(()=>[]),
    cachedHistoricalIdentitySnapshots().catch(()=>[]),
  ]);
  const projections=publishOfflineHistory([...providerHistory,...identityHistory]);
  if(paintOfflineHistory(projections)) await afterPaint();
  return projections.length>0;
})();
await Promise.allSettled([currentIdentityJob,applicationJob,historicalJob]);
