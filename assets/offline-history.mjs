import * as ed from './noble-ed25519.js';
import {
  evaluatePublicRecordAccess,
  hydrateProviderIndex,
  providerLookupHints,
  recordVerificationEntries,
  validateProviderInventoryWindow,
} from './discovery-authority.mjs?v=20260715-provider-window-v1';
import {resolveEnvironmentAuthority}
  from './routing-authority.mjs?v=20260729-exact-environment-v3';
import {installEd25519HashFallback, sha256Hex}
  from './live-artifacts.mjs?v=20260720-active-call-capture-v3';

// Insecure-context (plain-HTTP LAN) origins withhold SubtleCrypto; keep the
// same historical signature/hash checks running there.
installEd25519HashFallback(ed.etc);

/*
 * Historical public evidence is deliberately separate from discovery state.
 * The cache contains the exact signed provider generation and the key material
 * used to verify it, never a trusted display projection or a reusable route.
 * Every read replays the cryptographic and lease checks at `stored_at` before
 * returning inert, route-free metadata for presentation.
 */

export const OFFLINE_HISTORY_CACHE_KEY='personaos.signed-public-history.v2';
const RETIRED_UNSIGNED_CACHE_KEY='personaos.last-verified-public-history.v1';
const CACHE_SCHEMA='personaos-browser-signed-public-history-cache/2';
const EVIDENCE_SCHEMA='personaos-browser-signed-public-history-evidence/2';
const PROJECTION_SCHEMA='personaos-browser-verified-public-history/2';
const CACHE_MAX_BYTES=3*1024*1024;
const MAX_SNAPSHOTS=4;
const MAX_PROJECTED_ROWS=2048;
const MAX_FUTURE_SKEW_MS=30_000;
const HEX_32=/^[0-9a-f]{64}$/i;
const HEX_64=/^[0-9a-f]{128}$/i;
const SHA256=/^sha256:[0-9a-f]{64}$/;
const KERNEL=/^kernel:[0-9a-f]{16}$/i;
const RECORD_ID=/^[A-Za-z0-9:_.-]{1,300}$/;
const PROVIDER_INVENTORY_FIELDS=Object.freeze([
  'base','document_count','documents','expires_at','generated_at','inventory_generation',
  'inventory_hash','inventory_manifest','inventory_manifest_hash','kernel_id',
  'previous_inventory_hash','provider_count','providers','schema','signature_hex',
  'signing_key_id','version','visibility',
].sort());
const PROVIDER_MANIFEST_FIELDS=Object.freeze(['document_hash','record_id','record_url']);
const POLICY_FIELDS=Object.freeze([
  'schema','policy_id','subject_kind','subject_id','owner_persona_id','access_grants',
  'outward_tier','cross_tenant_agreement_ref',
]);
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
// persona-card/5 adds the optional persona-authored `self_publication` object;
// accept /4 and /5 with envelope/card schema equality. Opaque here.
const PERSONA_CARD_ACCEPTED_SCHEMAS=new Set(['persona-card/4','persona-card/5']);
const PERSONA_LIFECYCLE_FIELDS=Object.freeze([
  'authority','did','identity_fields','identity_materialization_state',
  'identity_public_key_hex','identity_signature_hash','identity_signature_verified',
  'identity_signing_key_id','issued_at','lifecycle_transition_hash',
  'lifecycle_chain_verified','lifecycle_state','persona_id','schema','signature_hex',
  'signing_key_id',
].sort());
const enc=new TextEncoder();
const hex=(value)=>Uint8Array.from(String(value||'').match(/.{1,2}/g)
  ?.map((byte)=>Number.parseInt(byte,16))||[]);

function canon(value){
  if(value===null||value===undefined) return 'null';
  if(Array.isArray(value)) return '['+value.map(canon).join(',')+']';
  if(typeof value==='object') return '{'+Object.keys(value).sort()
    .map((key)=>JSON.stringify(key)+':'+canon(value[key])).join(',')+'}';
  return JSON.stringify(value);
}

function exactFields(value,fields){
  return !!value&&typeof value==='object'&&!Array.isArray(value)
    &&Object.keys(value).sort().join('\u0000')===fields.join('\u0000');
}

function safeText(value,maximum=512){
  const text=String(value??'').normalize('NFC').trim();
  return text.length<=maximum&&!/[\u0000-\u001f\u007f]/u.test(text)?text:'';
}

function safeList(value,{limit=24,maximum=240}={}){
  if(!Array.isArray(value)) return [];
  return [...new Set(value.map((item)=>safeText(item,maximum)).filter(Boolean))].slice(0,limit);
}

function finiteInstant(value){
  const parsed=typeof value==='number'?value:Date.parse(String(value||''));
  return Number.isFinite(parsed)?new Date(parsed).toISOString():'';
}

function withoutSignature(value){
  const out={};
  for(const key of Object.keys(value||{})) if(key!=='signature_hex') out[key]=value[key];
  return out;
}

function policyPayload(policy){
  const out={};
  for(const field of POLICY_FIELDS) if(Object.hasOwn(policy||{},field)) out[field]=policy[field];
  return out;
}

async function sha256(value){
  const bytes=value instanceof Uint8Array?value:enc.encode(String(value));
  return 'sha256:'+await sha256Hex(bytes);
}

async function signed(payload,signature,publicKey){
  if(!HEX_64.test(String(signature||''))||!HEX_32.test(String(publicKey||''))) return false;
  try{ return await ed.verifyAsync(hex(signature),enc.encode(canon(payload)),hex(publicKey)); }
  catch(_){ return false; }
}

function currentRegistry(keysDoc,kernelId){
  if(keysDoc?.schema!=='personaos-keys/1'||keysDoc.kernel_id!==kernelId
      ||!Array.isArray(keysDoc.keys)||keysDoc.keys.length>64) return null;
  const entries=[];
  for(const raw of keysDoc.keys){
    const entry={key_id:String(raw?.key_id||''),role:String(raw?.role||''),
      public_key_hex:String(raw?.public_key_hex||'').toLowerCase(),
      status:String(raw?.status||''),rotated_at:String(raw?.rotated_at||'')};
    if(!entry.key_id||!['current','previous','archived'].includes(entry.status)
        ||!HEX_32.test(entry.public_key_hex)) return null;
    entries.push(entry);
  }
  const masters=entries.filter((entry)=>entry.key_id==='kernel-master'
    &&entry.role==='master'&&entry.status==='current');
  if(masters.length!==1||kernelId!==`kernel:${masters[0].public_key_hex.slice(0,16)}`) return null;
  const currentIds=new Set();
  for(const entry of entries.filter((item)=>item.status==='current')){
    if(currentIds.has(entry.key_id)) return null;
    currentIds.add(entry.key_id);
  }
  return {master:masters[0].public_key_hex,entries};
}

function evidenceShape(snapshot){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)
      ||!exactFields(snapshot,['kernel_id','keys','provider_index','schema','stored_at'].sort())
      ||snapshot.schema!==EVIDENCE_SCHEMA||!KERNEL.test(String(snapshot.kernel_id||''))
      ||!Number.isFinite(Date.parse(String(snapshot.stored_at||'')))
      ||snapshot.keys?.schema!=='personaos-keys/1'
      ||snapshot.keys?.kernel_id!==snapshot.kernel_id
      ||!Array.isArray(snapshot.keys?.keys)||snapshot.keys.keys.length>64
      ||snapshot.provider_index?.schema!=='dht-provider-index/3'
      ||snapshot.provider_index?.kernel_id!==snapshot.kernel_id) return false;
  return true;
}

export function createOfflineHistorySnapshot({kernelId,keys,providerIndex,storedAt=Date.now()}={}){
  const snapshot={schema:EVIDENCE_SCHEMA,kernel_id:safeText(kernelId,128),
    stored_at:finiteInstant(storedAt),keys,provider_index:providerIndex};
  return evidenceShape(snapshot)?snapshot:null;
}

export function readOfflineHistorySnapshots(){
  try{
    // The former cache contained unsigned projections. Remove it rather than
    // treating old presentation bytes as historical authority.
    localStorage.removeItem(RETIRED_UNSIGNED_CACHE_KEY);
    const raw=localStorage.getItem(OFFLINE_HISTORY_CACHE_KEY)||'';
    if(!raw||raw.length>CACHE_MAX_BYTES){
      if(raw) localStorage.removeItem(OFFLINE_HISTORY_CACHE_KEY);
      return [];
    }
    const cache=JSON.parse(raw);
    if(cache?.schema!==CACHE_SCHEMA||!Array.isArray(cache.snapshots)){
      localStorage.removeItem(OFFLINE_HISTORY_CACHE_KEY); return [];
    }
    return cache.snapshots.filter(evidenceShape)
      .sort((left,right)=>Date.parse(right.stored_at)-Date.parse(left.stored_at))
      .slice(0,MAX_SNAPSHOTS);
  }catch(_){ return []; }
}

export function writeOfflineHistorySnapshot(snapshot){
  if(!evidenceShape(snapshot)) return false;
  try{
    const snapshots=[snapshot,...readOfflineHistorySnapshots()
      .filter((item)=>item.kernel_id!==snapshot.kernel_id)].slice(0,MAX_SNAPSHOTS);
    while(snapshots.length){
      const raw=JSON.stringify({schema:CACHE_SCHEMA,snapshots});
      if(raw.length<=CACHE_MAX_BYTES){
        localStorage.setItem(OFFLINE_HISTORY_CACHE_KEY,raw); return true;
      }
      snapshots.pop();
    }
    localStorage.removeItem(OFFLINE_HISTORY_CACHE_KEY);
  }catch(_){ }
  return false;
}

function signedPersonaIdentity(record,kernelId){
  if(record?.kind!=='persona'||record.visibility_tier!=='public'
      ||typeof record.did!=='string') return null;
  const did=record.did.normalize('NFC').trim(),prefix=`did:personaos:${kernelId}/persona/`;
  if(!did.startsWith(prefix)) return null;
  const signedId=did.slice(prefix.length);
  if(!signedId||signedId.length>180||/[\u0000-\u0020/\\]/u.test(signedId)) return null;
  const canonicalId=signedId.startsWith('persona:')?signedId.slice(8):signedId;
  return canonicalId&&canonicalId.length<=180&&!/[\u0000-\u0020/\\]/u.test(canonicalId)
    ?{signedId,canonicalId,did}:null;
}

async function verifiedPersonaProjection(doc,record,documentKey,registry,kernelId,observedAt){
  const identity=signedPersonaIdentity(record,kernelId),lifecycle=doc.persona_lifecycle_card;
  if(!identity||documentKey?.key_id!=='kernel-master'
      ||!exactFields(lifecycle,PERSONA_LIFECYCLE_FIELDS)
      ||lifecycle.schema!=='personaos-persona-lifecycle-card/2'
      ||lifecycle.persona_id!==identity.signedId||lifecycle.did!==identity.did
      ||lifecycle.signing_key_id!=='kernel-master'||lifecycle.lifecycle_state!=='ACTIVE'
      ||lifecycle.authority!=='kernel_observed_verified_persona_lifecycle'
      ||lifecycle.identity_signing_key_id!==`persona:${identity.signedId}`
      ||lifecycle.identity_signature_verified!==true
      ||lifecycle.lifecycle_chain_verified!==true
      ||!SHA256.test(String(lifecycle.identity_signature_hash||''))
      ||!SHA256.test(String(lifecycle.lifecycle_transition_hash||''))
      ||!Number.isFinite(Date.parse(String(lifecycle.issued_at||'')))
      ||!['pending','materialized'].includes(lifecycle.identity_materialization_state)
      ||!await signed(withoutSignature(lifecycle),lifecycle.signature_hex,
        documentKey.public_key_hex)) return null;
  const fields=lifecycle.identity_fields;
  if(!exactFields(fields,['avatar','characteristics','name'])) return null;
  for(const name of ['name','characteristics','avatar']){
    const field=fields[name];
    if(!exactFields(field,['persona_authored','state'])
        ||!['pending','materialized'].includes(field.state)
        ||field.persona_authored!==(field.state==='materialized')) return null;
  }
  const allMaterialized=Object.values(fields).every((field)=>field.state==='materialized');
  if((lifecycle.identity_materialization_state==='materialized')!==allMaterialized) return null;
  if(!allMaterialized) return Object.freeze({id:identity.canonicalId,name:'New persona',
    description:'',profile_state:'pending',avatar_available:false});

  const envelope=doc.persona_card,card=envelope?.card;
  const keyId=`persona:${identity.signedId}`;
  const identityKey=String(record.identity_public_key_hex||'').toLowerCase();
  if(!HEX_32.test(identityKey)||record.identity_signing_key_id!==keyId
      ||!registry.entries.some((entry)=>entry.key_id===keyId
        &&entry.status==='current'&&entry.public_key_hex===identityKey)
      ||!exactFields(envelope,PERSONA_ENVELOPE_FIELDS)
      ||!PERSONA_CARD_ACCEPTED_SCHEMAS.has(envelope.schema)||envelope.persona_id!==identity.signedId
      ||envelope.path!==`.well-known/personas/${identity.signedId}.json`
      ||envelope.signing_key_id!==keyId||!Number.isSafeInteger(envelope.ttl_seconds)
      ||envelope.ttl_seconds<1||envelope.ttl_seconds>86400
      ||!card||typeof card!=='object'||Array.isArray(card)
      ||PERSONA_CARD_REQUIRED_FIELDS.some((field)=>!Object.hasOwn(card,field))
      ||Object.keys(card).some((field)=>!PERSONA_CARD_ALLOWED_FIELDS.has(field))
      ||card.schema!==envelope.schema||card.persona_id!==identity.signedId
      ||card.signing_key_id!==keyId||card.visibility!=='public'
      ||card.federation_visibility!=='public'||card.name!==record.label
      ||!safeText(card.name,80)||typeof card.description!=='string'
      ||card.description.length>240||!Number.isSafeInteger(card.soul_version)
      ||!card.rate_limit||typeof card.rate_limit!=='object'||Array.isArray(card.rate_limit)
      ||!card.identity_authority||typeof card.identity_authority!=='object'
      ||Array.isArray(card.identity_authority)||!Object.keys(card.identity_authority).length
      ||Date.parse(String(card.expires_at||''))<=observedAt
      ||canon(card.avatar||{})!==canon(record.avatar||{})
      ||!await signed(card,envelope.signature_hex,identityKey)) return null;
  return Object.freeze({id:identity.canonicalId,name:safeText(card.name,80),
    description:safeText(card.description,240),profile_state:'materialized',
    avatar_available:Boolean(card.avatar)});
}

function environmentProjection(record,kernelId){
  const prefix=`did:personaos:${kernelId}/env/`,did=String(record.did||'');
  const id=did.startsWith(prefix)?safeText(did.slice(prefix.length),256)
    :safeText(record.record_id,300);
  const name=safeText(record.label,240);
  return id&&name?Object.freeze({id,name,description:safeText(record.description,500),
    capabilities:safeList(record.capability_summary,{limit:24,maximum:240})}):null;
}

function artifactProjection(record,links){
  const id=safeText(record.record_id||record.card_id||record.did,512);
  const path=safeText(record.title||record.path||record.label,1024);
  if(!id||!path) return null;
  const media=safeList([record.media_kind,record.mime_type,links?.media_kind,links?.mime_type],
    {limit:4,maximum:240});
  const rawHash=String(record.content_hash||links?.content_hash||'').toLowerCase();
  const sizeCandidates=[record.size_bytes,record.size,record.bytes,links?.size_bytes];
  const size=sizeCandidates.find((value)=>Number.isSafeInteger(value)&&value>=0);
  const environment=resolveEnvironmentAuthority(record,links||{},{verified:true});
  return Object.freeze({id,path,description:safeText(record.description,500),media,
    purpose:safeList(record.capability_summary,{limit:24,maximum:240}),
    content_hash:SHA256.test(rawHash)?rawHash:'',size_bytes:size??null,
    environment_id:environment.status==='resolved'?environment.environmentId:''});
}

async function verifyProviderInventory(index,registry,kernelId,observedAt){
  if(!exactFields(index,PROVIDER_INVENTORY_FIELDS)
      ||index.schema!=='dht-provider-index/3'||index.kernel_id!==kernelId
      ||index.signing_key_id!=='kernel-master'||index.visibility!=='public'
      ||!Number.isSafeInteger(index.inventory_generation)||index.inventory_generation<1
      ||index.version!==index.inventory_generation
      ||!Array.isArray(index.inventory_manifest)||!Array.isArray(index.providers)
      ||!index.documents||typeof index.documents!=='object'||Array.isArray(index.documents)
      ||!Number.isSafeInteger(index.provider_count)||index.provider_count!==index.providers.length
      ||!Number.isSafeInteger(index.document_count)
      ||index.document_count!==Object.keys(index.documents).length
      ||index.document_count!==index.inventory_manifest.length
      ||index.document_count>MAX_PROJECTED_ROWS
      ||!SHA256.test(String(index.inventory_manifest_hash||''))
      ||!SHA256.test(String(index.inventory_hash||''))) return null;
  const window=validateProviderInventoryWindow(index.generated_at,index.expires_at,
    {nowMs:observedAt,maxFutureSkewMs:0});
  if(!window.ok||window.generatedAt>observedAt||observedAt>=window.expiresAt) return null;
  if((index.inventory_generation===1&&index.previous_inventory_hash!=='')
      ||(index.inventory_generation>1&&!SHA256.test(String(index.previous_inventory_hash||'')))) return null;
  const rows=[],recordIds=new Set(),documentHashes=new Set();
  for(const item of index.inventory_manifest){
    if(!exactFields(item,PROVIDER_MANIFEST_FIELDS)
        ||!RECORD_ID.test(String(item.record_id||''))
        ||!SHA256.test(String(item.document_hash||''))
        ||String(item.record_url)!==`discovery/public/records/${item.record_id}.json`
        ||recordIds.has(item.record_id)||documentHashes.has(item.document_hash)
        ||!Object.hasOwn(index.documents,item.document_hash)) return null;
    rows.push(item); recordIds.add(item.record_id); documentHashes.add(item.document_hash);
  }
  const lexical=(left,right)=>left<right?-1:left>right?1:0;
  const sorted=[...rows].sort((a,b)=>lexical(a.record_id,b.record_id)
    ||lexical(a.document_hash,b.document_hash)||lexical(a.record_url,b.record_url));
  if(canon(rows)!==canon(sorted)||await sha256(canon(rows))!==index.inventory_manifest_hash
      ||Object.keys(index.documents).some((hash)=>!documentHashes.has(hash))) return null;
  const byRecord=new Map(rows.map((item)=>[item.record_id,item])),referenced=new Set();
  for(const reference of index.providers){
    const provider=reference?.record,item=byRecord.get(String(provider?.record_id||''));
    if(!item||String(provider.record_url||'')!==item.record_url
        ||String(provider.document_hash||'')!==item.document_hash
        ||String(reference.document_ref||'')!==item.document_hash
        ||provider.inventory_generation!==index.inventory_generation
        ||provider.inventory_manifest_hash!==index.inventory_manifest_hash) return null;
    referenced.add(item.record_id);
  }
  if(referenced.size!==recordIds.size) return null;
  const hashPayload={};
  for(const field of Object.keys(index)) if(!['inventory_hash','signature_hex'].includes(field))
    hashPayload[field]=index[field];
  if(await sha256(canon(hashPayload))!==index.inventory_hash
      ||!await signed(withoutSignature(index),index.signature_hex,registry.master)) return null;
  return {recordIds,window};
}

async function verifiedDocument(envelope,registry,kernelId,observedAt){
  const provider=envelope?.record,doc=envelope?.document,record=doc?.record,
    policy=doc?.access_policy||{};
  if(envelope?.schema!=='provider-record-envelope/1'||provider?.schema!=='provider-record/1'
      ||provider.signing_key_id!=='kernel-master'||provider.signing_key_role!=='master'
      ||provider.signing_key_status!=='current'
      ||String(provider.public_key_hex||'').toLowerCase()!==registry.master
      ||provider.visibility_tier!=='public'||provider.host_kernel_id!==kernelId
      ||String(provider.record_url||'')!==`discovery/public/records/${provider.record_id}.json`
      ||!await signed(provider,envelope.signature_hex,registry.master)
      ||await sha256(canon(doc))!==provider.document_hash
      ||record?.record_id!==provider.record_id||record.visibility_tier!=='public'
      ||doc.host_kernel_id!==provider.host_kernel_id
      ||String(doc.base||'')!==String(provider.base_url||'')
      ||record.access_policy_ref!==provider.access_policy_ref
      ||policy.policy_id!==provider.access_policy_ref||policy.outward_tier!=='public'
      ||!providerLookupHints(record).includes(String(provider.key||''))) return null;
  const loc=[record.content_locator_ref].filter(Boolean).sort();
  if(canon(loc)!==canon([...(provider.content_locator_refs||[])].filter(Boolean).sort())) return null;
  const boundId=String(provider.document_signing_key_id||''),
    boundStatus=String(provider.document_signing_key_status||''),
    boundKey=String(provider.document_public_key_hex||'').toLowerCase();
  const candidates=recordVerificationEntries(registry.entries,doc.signing_key_id)
    .filter((entry)=>entry.key_id===boundId&&entry.status===boundStatus
      &&String(entry.public_key_hex||'').toLowerCase()===boundKey);
  const matches=[];
  for(const entry of candidates) if(await signed(record,doc.signature_hex,entry.public_key_hex))
    matches.push(entry);
  if(matches.length!==1||!await signed(policyPayload(policy),policy.signature_hex,
    matches[0].public_key_hex)) return null;
  const access=evaluatePublicRecordAccess(record,policy,doc.links||{},{nowMs:observedAt});
  if(!access.ok||!access.canDiscover) return null;
  return {doc,record,links:access.canRead?(doc.links||{}):{},documentKey:matches[0]};
}

export async function verifyOfflineHistorySnapshot(snapshot,{nowMs=Date.now()}={}){
  if(!globalThis.crypto?.subtle||!evidenceShape(snapshot)) return null;
  const observedAt=Date.parse(snapshot.stored_at);
  if(!Number.isFinite(observedAt)||observedAt>nowMs+MAX_FUTURE_SKEW_MS) return null;
  const registry=currentRegistry(snapshot.keys,snapshot.kernel_id);
  if(!registry) return null;
  const inventory=await verifyProviderInventory(
    snapshot.provider_index,registry,snapshot.kernel_id,observedAt);
  if(!inventory) return null;
  const hydrated=hydrateProviderIndex(snapshot.provider_index);
  if(!hydrated.ok||hydrated.refused) return null;
  const documents=new Map();
  for(const envelope of hydrated.envelopes){
    const verified=await verifiedDocument(envelope,registry,snapshot.kernel_id,observedAt);
    if(!verified) return null;
    const id=String(verified.record.record_id||'');
    const prior=documents.get(id);
    if(prior&&canon(prior.doc)!==canon(verified.doc)) return null;
    documents.set(id,verified);
  }
  if(documents.size!==inventory.recordIds.size
      ||[...inventory.recordIds].some((id)=>!documents.has(id))) return null;
  const personas=[],environments=[],artifacts=[];
  for(const verified of documents.values()){
    const {doc,record,links,documentKey}=verified;
    if(record.kind==='persona'){
      const row=await verifiedPersonaProjection(doc,record,documentKey,registry,
        snapshot.kernel_id,observedAt);
      if(row) personas.push(row);
    }else if(record.kind==='env'){
      const row=environmentProjection(record,snapshot.kernel_id); if(row) environments.push(row);
    }else if(record.kind==='artifact'){
      const row=artifactProjection(record,links); if(row) artifacts.push(row);
    }
  }
  const byId=(left,right)=>left.id.localeCompare(right.id,'en-US');
  personas.sort(byId); environments.sort(byId); artifacts.sort(byId);
  return Object.freeze({schema:PROJECTION_SCHEMA,kernel_id:snapshot.kernel_id,
    stored_at:snapshot.stored_at,lease:Object.freeze({
      generated_at:snapshot.provider_index.generated_at,
      expires_at:snapshot.provider_index.expires_at,
      generation:snapshot.provider_index.inventory_generation,
      inventory_hash:snapshot.provider_index.inventory_hash,
    }),counts:Object.freeze({persona:personas.length,env:environments.length,
      artifact:artifacts.length}),personas:Object.freeze(personas),
    environments:Object.freeze(environments),artifacts:Object.freeze(artifacts)});
}

export async function verifyOfflineHistorySnapshots(snapshots=readOfflineHistorySnapshots(),options){
  const results=await Promise.allSettled((Array.isArray(snapshots)?snapshots:[])
    .slice(0,MAX_SNAPSHOTS).map((snapshot)=>verifyOfflineHistorySnapshot(snapshot,options)));
  const byKernel=new Map();
  for(const result of results){
    if(result.status!=='fulfilled'||!result.value) continue;
    const projection=result.value,prior=byKernel.get(projection.kernel_id);
    if(!prior||Date.parse(projection.stored_at)>Date.parse(prior.stored_at))
      byKernel.set(projection.kernel_id,projection);
  }
  return [...byKernel.values()].sort((left,right)=>
    Date.parse(right.stored_at)-Date.parse(left.stored_at));
}
