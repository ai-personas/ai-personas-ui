/* Closed, privacy-safe adapters for PersonaOS public telemetry documents.
 * These helpers deliberately select known structural fields instead of making
 * the public UI depend on private kernel snapshots. */

export const PUBLIC_PERSONA_TELEMETRY_SCHEMA='personaos-persona-telemetry-public/1';
export const PUBLIC_ENVIRONMENT_TELEMETRY_SCHEMAS=Object.freeze(new Set([
  'personaos-environment-telemetry-public/1',
]));
export const PUBLIC_ENTITY_INDEX_SCHEMA='personaos-telemetry-entities-public/1';
export const OPERATOR_LIVE_TELEMETRY_SCHEMA='personaos-live-telemetry/1';

const PUBLIC_ROUTE_FIELDS=Object.freeze([
  'at','environment_id','event_id','lineage_signature_verified',
  'persona_signature_verified','recipient_persona_ids','route_kind','schema',
  'sender_persona_id','signature_hex','signing_key_id',
].sort());
const PUBLIC_ROUTE_KINDS=Object.freeze(new Set(['broadcast','direct']));
const _objects=(value,limit)=>Array.isArray(value)
  ?value.filter((item)=>item&&typeof item==='object'&&!Array.isArray(item)).slice(-limit):[];
const _token=(value,max=512)=>{ const out=String(value||'').normalize('NFC').trim();
  return out&&out.length<=max&&!/[\u0000-\u001f\u007f]/u.test(out)?out:''; };

export const isPersonaTelemetryDocument=(doc)=>doc?.schema===PUBLIC_PERSONA_TELEMETRY_SCHEMA;
export const isEnvironmentTelemetryDocument=(doc)=>PUBLIC_ENVIRONMENT_TELEMETRY_SCHEMAS.has(doc?.schema);
export const isPublicEntityTelemetryDocument=(doc)=>doc?.schema===PUBLIC_PERSONA_TELEMETRY_SCHEMA
  ||PUBLIC_ENVIRONMENT_TELEMETRY_SCHEMAS.has(doc?.schema);
export const isPublicEntityIndexDocument=(doc)=>doc?.schema===PUBLIC_ENTITY_INDEX_SCHEMA;

export function isExactPublicCommunicationRoute(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)
      ||Object.keys(raw).sort().join('\u0000')!==PUBLIC_ROUTE_FIELDS.join('\u0000')
      ||raw.schema!=='personaos-public-persona-communication-route/1'
      ||raw.persona_signature_verified!==true||raw.lineage_signature_verified!==true
      ||raw.signing_key_id!=='kernel-master'||!PUBLIC_ROUTE_KINDS.has(raw.route_kind)
      ||!/^[0-9a-f]{128}$/i.test(String(raw.signature_hex||''))) return false;
  const sender=_token(raw.sender_persona_id), environment=_token(raw.environment_id);
  const eventId=_token(raw.event_id), at=_token(raw.at,80);
  if(!sender||!environment||!eventId||!at||!Number.isFinite(Date.parse(at))
      ||!Array.isArray(raw.recipient_persona_ids)||raw.recipient_persona_ids.length>64) return false;
  const recipients=raw.recipient_persona_ids.map((value)=>_token(value));
  return !recipients.some((value)=>!value)
    &&new Set(recipients).size===recipients.length
    &&(raw.route_kind!=='direct'||recipients.length>0);
}

export function telemetryModelEvents(doc){
  if(!doc||typeof doc!=='object') return [];
  const publicStatus=doc.model_status;
  if(Array.isArray(publicStatus)) return _objects(publicStatus,80);
  if(publicStatus&&typeof publicStatus==='object') return _objects(publicStatus.recent_events,80);
  if(doc.schema===OPERATOR_LIVE_TELEMETRY_SCHEMA) return _objects(doc.kernel?.model_events,80);
  return [];
}

export function telemetryActiveCalls(doc){
  if(!doc||typeof doc!=='object') return [];
  const publicStatus=doc.model_status;
  if(publicStatus&&typeof publicStatus==='object'&&!Array.isArray(publicStatus))
    return _objects(publicStatus.active_calls,32);
  if(doc.schema===OPERATOR_LIVE_TELEMETRY_SCHEMA)
    return _objects(doc.kernel?.active_model_calls,32);
  return [];
}

export function telemetryActivity(doc,{verifiedCommunicationRoutes=[],publicFrameVerified=false}={}){
  if(!doc||typeof doc!=='object') return [];
  // Entity feeds need a verified whole-document wrapper before ordinary
  // activity is usable. Independently verified route objects remain admissible.
  const ordinary=isPublicEntityTelemetryDocument(doc)&&publicFrameVerified!==true?[]
    :(Array.isArray(doc.activity)?_objects(doc.activity,120):[]);
  const operatorOrdinary=doc.schema===OPERATOR_LIVE_TELEMETRY_SCHEMA
    ?_objects(doc.kernel?.interactions,120):[];
  return [...ordinary,...operatorOrdinary,
    ...publicCommunicationRouteEvents(verifiedCommunicationRoutes)].slice(-120);
}

/** Project independently verified, content-free communication routing metadata. */
export function publicCommunicationRouteEvents(verifiedRoutes){
  const out=[];
  for(const raw of _objects(verifiedRoutes,96)){
    if(!isExactPublicCommunicationRoute(raw)) continue;
    const recipientIds=raw.recipient_persona_ids.map((value)=>_token(value));
    out.push(Object.freeze({
      kind:'PERSONA_COMMUNICATION_ROUTE_OBSERVED',
      actor_kind:'persona',actor_id:_token(raw.sender_persona_id),
      persona_id:_token(raw.sender_persona_id),
      recipients:recipientIds.map((id)=>Object.freeze({kind:'persona',id})),affected:[],
      environment_id:_token(raw.environment_id),scope:'environment',
      scope_id:_token(raw.environment_id),at:_token(raw.at,80),status:'observed',
      route_kind:raw.route_kind,event_id:_token(raw.event_id),
      persona_signature_verified:true,lineage_signature_verified:true,
    }));
  }
  return out;
}

export function telemetrySpans(doc){
  if(!doc||typeof doc!=='object') return [];
  if(Array.isArray(doc.spans)) return _objects(doc.spans,160);
  if(doc.schema===OPERATOR_LIVE_TELEMETRY_SCHEMA) return _objects(doc.kernel?.spans,160);
  return [];
}

export function entityTelemetryProjection(doc,{publicFrameVerified=false,
  verifiedCommunicationRoutes=[]}={}){
  if(!isPersonaTelemetryDocument(doc)&&!isEnvironmentTelemetryDocument(doc)) return null;
  const persona=isPersonaTelemetryDocument(doc), publicDoc=isPublicEntityTelemetryDocument(doc);
  // A caller may still inspect the entity kind/id of an unsigned public feed,
  // but no summary/model/activity state crosses that boundary.
  const usable=!publicDoc||publicFrameVerified===true;
  return Object.freeze({
    kind:persona?'persona':'environment',public:publicDoc,
    id:String(persona?doc.persona_id:doc.environment_id||''),
    summary:usable&&persona&&doc.summary&&typeof doc.summary==='object'?doc.summary:{},
    status:usable&&!persona?String(doc.status||''):'',
    members:usable&&!persona?(_objects(doc.members,512).length
      ?_objects(doc.members,512):Array.isArray(doc.members)?doc.members.slice(0,512):[]):[],
    memberCount:usable&&!persona?(Number.isSafeInteger(doc.member_count)?Math.max(0,doc.member_count)
      :(Array.isArray(doc.members)?doc.members.length:0)):0,
    modelEvents:usable?telemetryModelEvents(doc):[],activeCalls:usable?telemetryActiveCalls(doc):[],
    activity:telemetryActivity(doc,{publicFrameVerified,verifiedCommunicationRoutes}),
    spans:usable?telemetrySpans(doc):[],
  });
}
