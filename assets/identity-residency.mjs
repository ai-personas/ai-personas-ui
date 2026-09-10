import * as ed from './noble-ed25519.js';
import {canonicalJson as canonical} from './canonical-json.mjs';
import {installEd25519HashFallback, sha256Hex}
  from './live-artifacts.mjs?v=20260720-active-call-capture-v3';

installEd25519HashFallback(ed.etc);
const encoder=new TextEncoder();
const keyPattern=/^[0-9a-f]{64}$/;
const signaturePattern=/^[0-9a-f]{128}$/;
const hashPattern=/^sha256:[0-9a-f]{64}$/;
const hex=(value)=>Uint8Array.from(value.match(/.{2}/g).map(byte=>parseInt(byte,16)));
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).sort().join('\0')===[...fields].sort().join('\0');
const unsigned=(value)=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='signature'));
const digest=async(value)=>'sha256:'+await sha256Hex(encoder.encode(canonical(value)));
async function signed(value,key,schema){
  return value?.schema===schema&&keyPattern.test(key)&&signaturePattern.test(value.signature)
    &&await ed.verifyAsync(hex(value.signature),encoder.encode(canonical(unsigned(value))),hex(key));
}

// Public proofs reveal destination custody and the durable source fence. The
// private state and its historical message index are never sent to this reader.
export async function verifyIdentityResidency(value,{
  personaId='',originalDid='',residentKernelId='',residentPublicKeyHex='',
}={}){
  try{
    if(!exact(value,['schema','persona_id','original_global_handle','resident_kernel_id',
      'resident_persona_public_key','epoch','history'])||value.schema!=='personaos-identity-residency/1'
      ||!Array.isArray(value.history)||!value.history.length
      ||!Number.isSafeInteger(value.epoch)||value.epoch!==value.history.length
      ||(personaId&&value.persona_id!==personaId)
      ||(originalDid&&value.original_global_handle!==originalDid)
      ||(residentKernelId&&value.resident_kernel_id!==residentKernelId)
      ||(residentPublicKeyHex&&value.resident_persona_public_key!==residentPublicKeyHex)) return null;
    let previous=null;
    for(let epoch=0;epoch<value.history.length;epoch++){
      const fence=value.history[epoch],preparation=fence?.preparation,consent=fence?.consent;
      if(!exact(fence,['schema','manifest_hash','source_fenced','preparation','consent','signature'])
        ||fence.source_fenced!==true||!hashPattern.test(fence.manifest_hash)
        ||!exact(preparation,['schema','handoff_id','persona_id','source_kernel_id','source_kernel_public_key',
          'source_persona_public_key','source_epoch','destination_kernel_id','destination_kernel_public_key',
          'destination_persona_public_key','created_at','signature'])
        ||preparation.persona_id!==value.persona_id||preparation.source_epoch!==epoch
        ||!exact(consent,['schema','persona_id','preparation_hash','original_global_handle','previous_fence_hash','signature'])
        ||consent.persona_id!==value.persona_id||consent.original_global_handle!==value.original_global_handle
        ||consent.preparation_hash!==await digest(preparation)) return null;
      for(const side of ['source','destination']){
        if(!keyPattern.test(preparation[side+'_kernel_public_key'])
          ||!keyPattern.test(preparation[side+'_persona_public_key'])
          ||preparation[side+'_kernel_id']!=='kernel:'+preparation[side+'_kernel_public_key'].slice(0,16)) return null;
      }
      if(preparation.source_kernel_id===preparation.destination_kernel_id
        ||preparation.source_persona_public_key===preparation.destination_persona_public_key) return null;
      if(previous){
        if(consent.previous_fence_hash!==await digest(previous)) return null;
        for(const suffix of ['kernel_id','kernel_public_key','persona_public_key'])
          if(preparation['source_'+suffix]!==previous.preparation['destination_'+suffix]) return null;
      }else if(consent.previous_fence_hash||value.original_global_handle!==
        `did:personaos:${preparation.source_kernel_id}/persona/${value.persona_id}`) return null;
      if(!await signed(preparation,preparation.destination_kernel_public_key,'personaos-identity-handoff-preparation/1')
        ||!await signed(consent,preparation.source_persona_public_key,'personaos-identity-handoff-consent/1')
        ||!await signed(fence,preparation.source_kernel_public_key,'personaos-identity-handoff-fence/1')) return null;
      previous=fence;
    }
    return previous.preparation.destination_kernel_id===value.resident_kernel_id
      &&previous.preparation.destination_persona_public_key===value.resident_persona_public_key?value:null;
  }catch(_){return null;}
}

export async function residencyDescriptorKey(value,{personaId,currentPublicKeyHex,embeddedPublicKeyHex}){
  if(embeddedPublicKeyHex===currentPublicKeyHex) return currentPublicKeyHex;
  const verified=await verifyIdentityResidency(value,{personaId,residentPublicKeyHex:currentPublicKeyHex});
  if(!verified) return '';
  return verified.history.some(fence=>['source','destination'].some(side=>
    fence.preparation[side+'_persona_public_key']===embeddedPublicKeyHex))?embeddedPublicKeyHex:'';
}
