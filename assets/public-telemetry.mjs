/* Closed, privacy-safe adapters for PersonaOS public telemetry documents.
 * These helpers deliberately select known structural fields instead of making
 * the public UI depend on private kernel snapshots. */

export const PUBLIC_PERSONA_TELEMETRY_SCHEMA='personaos-persona-telemetry-public/2';
export const PUBLIC_ENVIRONMENT_TELEMETRY_SCHEMAS=Object.freeze(new Set([
  'personaos-environment-telemetry-public/1',
  'personaos-environment-telemetry-public/2',
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

const ENVIRONMENT_FEED_FIELDS=Object.freeze([
  'activity','communication_routes','communication_routes_hash','environment_id','generated_at',
  'member_count','members','model_status','node_id','schema','signature_hex','signing_key_id','status','tier',
]);
const RUN_BUDGET_FIELDS=Object.freeze([
  'available','environment_id','run','schema','status_at_last_export','task_id',
]);
const RUN_BUDGET_OPTIONAL=Object.freeze([
  'budget_mode','granted','remaining','spent_net','remaining_exceeds_grant_from_topups',
]);
const RUN_PROGRESS_FIELDS=Object.freeze(['schema','run','task_id','environment_id']);
const RUN_PROGRESS_INTS=Object.freeze([
  'seconds_since_last_persona_append','parked_member_count','active_member_count',
  'pending_outbox_deliveries','pending_causal_delivery_retries','causal_deliveries_waiting_resource',
  'pending_initial_delivery_retries','consecutive_failures','refused_calls_zero_spend',
  'active_call_count','active_calls_beyond_declared_timeout','deliveries_held_for_cooldown',
  'bytes_written_under_runs_since_last_statement',
]);
const RUN_PROGRESS_FLOATS=Object.freeze([
  'router_cooldown_remaining_s','declared_model_call_timeout_s','oldest_active_call_age_s',
]);
const RUN_PROGRESS_BOOLS=Object.freeze([
  'live','settled','cooldown_active','stated','last_persona_append_readable',
  'member_facts_readable','outbox_readable','runs_bytes_readable',
]);
const RUN_PROGRESS_TEXT=Object.freeze([
  'run_state','last_refusal_reason_code','observation_hash','observed_at','last_persona_append_at',
]);
const RUN_PROGRESS_OPTIONAL=Object.freeze([
  ...RUN_PROGRESS_INTS,...RUN_PROGRESS_FLOATS,...RUN_PROGRESS_BOOLS,...RUN_PROGRESS_TEXT,
  'unparked_member_ids',
]);
const _closedFields=(value,required,optional=[])=>value&&typeof value==='object'&&!Array.isArray(value)
  &&required.every((key)=>Object.hasOwn(value,key))
  &&Object.keys(value).every((key)=>required.includes(key)||optional.includes(key));
const _exactAtom=(value,max=512,required=false)=>typeof value==='string'&&value.length<=max
  &&(!required||value.length>0)&&value.trim()===value&&!/[\u0000-\u0020\u007f]/u.test(value);
const _nonnegativeInteger=(value)=>Number.isSafeInteger(value)&&value>=0;

function validPublicRunBudgets(rows,eid){
  if(!Array.isArray(rows)||rows.length>8) return false;
  return rows.every((row)=>{
    if(!_closedFields(row,RUN_BUDGET_FIELDS,RUN_BUDGET_OPTIONAL)
        ||row.schema!=='personaos-live-run-budget/1'||typeof row.available!=='boolean'
        ||row.environment_id!==eid||!_exactAtom(row.run,512,true)||!_exactAtom(row.task_id)
        ||typeof row.status_at_last_export!=='string'||row.status_at_last_export.length>64
        ||('budget_mode' in row&&!_exactAtom(row.budget_mode,32))) return false;
    for(const key of ['granted','remaining','spent_net']){
      if(row.available){ if(!_nonnegativeInteger(row[key])) return false; }
      else if(key in row) return false;
    }
    return !('remaining_exceeds_grant_from_topups' in row)
      ||row.remaining_exceeds_grant_from_topups===true;
  });
}

function validPublicRunProgress(rows,eid){
  // Matches the node's closed public projection, including its 32-row window.
  if(!Array.isArray(rows)||rows.length>32) return false;
  return rows.every((row)=>_closedFields(row,RUN_PROGRESS_FIELDS,RUN_PROGRESS_OPTIONAL)
    &&row.schema==='personaos-run-progress-stall/1'&&row.environment_id===eid
    &&_exactAtom(row.run,512,true)&&_exactAtom(row.task_id)
    &&RUN_PROGRESS_INTS.every((key)=>!(key in row)||_nonnegativeInteger(row[key]))
    &&RUN_PROGRESS_FLOATS.every((key)=>!(key in row)
      ||(typeof row[key]==='number'&&Number.isFinite(row[key])&&row[key]>=0))
    &&RUN_PROGRESS_BOOLS.every((key)=>!(key in row)||typeof row[key]==='boolean')
    &&RUN_PROGRESS_TEXT.every((key)=>!(key in row)||(typeof row[key]==='string'
      &&row[key].length<=128&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(row[key])))
    &&(!('unparked_member_ids' in row)||(Array.isArray(row.unparked_member_ids)
      &&row.unparked_member_ids.length<=512
      &&row.unparked_member_ids.every((id)=>_exactAtom(id,512,true)))));
}

export function isPublicEntityModelStatus(value,identityField,identity){
  return _closedFields(value,['active_calls','recent_events'])
    &&[value.active_calls,value.recent_events].every((rows)=>Array.isArray(rows)
      &&rows.every((entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)
        &&String(entry[identityField]||'')===identity));
}

/** Shape only: the caller still verifies freshness, route, master signature and
 * the separately signed communication routes before using this document. */
export function isExactPublicEnvironmentTelemetryDocument(doc){
  if(!isEnvironmentTelemetryDocument(doc)) return false;
  const v2=doc.schema==='personaos-environment-telemetry-public/2';
  // Older /2 publishers predate the progress observation. No other extension
  // is admitted implicitly: private observer fields must never enter the UI.
  if(!_closedFields(doc,v2?[...ENVIRONMENT_FEED_FIELDS,'run_budgets']:ENVIRONMENT_FEED_FIELDS,
      v2?['run_progress']:[])) return false;
  const eid=doc.environment_id;
  return _exactAtom(eid,512,true)&&doc.tier==='public_redacted'
    &&_nonnegativeInteger(doc.member_count)&&Array.isArray(doc.members)
    &&doc.members.length===doc.member_count
    &&isPublicEntityModelStatus(doc.model_status,'environment_id',eid)
    &&Array.isArray(doc.activity)&&Array.isArray(doc.communication_routes)
    &&(!v2||validPublicRunBudgets(doc.run_budgets,eid))
    &&(!('run_progress' in doc)||validPublicRunProgress(doc.run_progress,eid));
}

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
  if(publicStatus&&typeof publicStatus==='object'&&!Array.isArray(publicStatus))
    return _objects(publicStatus.recent_events,80);
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
    currentWorkState:usable&&persona&&doc.current_work_state
      &&typeof doc.current_work_state==='object'&&!Array.isArray(doc.current_work_state)
      ?doc.current_work_state:{},
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
