import assert from 'node:assert/strict';
import {
  entityTelemetryProjection,
  isEnvironmentTelemetryDocument,
  isExactPublicCommunicationRoute,
  isPersonaTelemetryDocument,
  isPublicEntityTelemetryDocument,
  OPERATOR_LIVE_TELEMETRY_SCHEMA,
  publicCommunicationRouteEvents,
  telemetryActiveCalls,
  telemetryActivity,
  telemetryModelEvents,
} from '../assets/public-telemetry.mjs';

const model={kind:'MODEL_SELECTED',persona_id:'p1',environment_id:'e1',
  model_id:'gpt-5.4-mini',requested_purpose:'review'};
const persona={
  schema:'personaos-persona-telemetry-public/1',generated_at:'2026-07-15T00:00:00Z',
  persona_id:'p1',tier:'public_redacted',summary:{persona_id:'p1',lifecycle_state:'ACTIVE'},
  model_status:[model],activity:[{kind:'FORGED_UNSIGNED_ACTIVITY',actor_id:'p1'}],
};
assert.equal(isPersonaTelemetryDocument(persona),true);
assert.equal(isPublicEntityTelemetryDocument(persona),true);
assert.deepEqual(telemetryModelEvents(persona),[model]);
assert.equal(entityTelemetryProjection(persona).kind,'persona');
assert.deepEqual(entityTelemetryProjection(persona).modelEvents,[]);
assert.deepEqual(entityTelemetryProjection(persona,{publicFrameVerified:true}).modelEvents,[model]);
assert.deepEqual(telemetryActivity(persona),[],
  'unsigned public entity activity must not enter cards or topology');
assert.equal(telemetryActivity(persona,{publicFrameVerified:true}).length,1);

for(const schema of ['personaos-environment-telemetry-public/1']){
  const env={schema,environment_id:'e1',status:'active',member_count:2,
    members:['p1','p2'],model_status:[model],activity:[]};
  assert.equal(isEnvironmentTelemetryDocument(env),true);
  const projected=entityTelemetryProjection(env,{publicFrameVerified:true});
  assert.equal(projected.public,true);
  assert.equal(projected.memberCount,2);
  assert.deepEqual(projected.modelEvents,[model]);
}

const route={
  schema:'personaos-public-persona-communication-route/1',
  event_id:'event:1',at:'2026-07-15T00:00:00Z',
  sender_persona_id:'p1',recipient_persona_ids:['p2'],route_kind:'broadcast',
  environment_id:'e1',
  persona_signature_verified:true,lineage_signature_verified:true,
  signing_key_id:'kernel-master',signature_hex:'ab'.repeat(64),
};
const aggregate={
  schema:'personaos-live-telemetry-public/1',generated_at:'2026-07-15T00:00:00Z',
  model_status:{active_calls:[{call_id:'c1',persona_id:'p1'}],recent_events:[model]},
  activity:[],communication_routes:[route],
};
assert.equal(telemetryActiveCalls(aggregate).length,1);
assert.deepEqual(telemetryModelEvents(aggregate),[model]);
const projectedRoute=publicCommunicationRouteEvents([route]);
assert.equal(projectedRoute.length,1);
assert.deepEqual(projectedRoute[0].recipients,[{kind:'persona',id:'p2'}]);
assert.equal(projectedRoute[0].kind,'PERSONA_COMMUNICATION_ROUTE_OBSERVED');
assert.equal(isExactPublicCommunicationRoute(route),true);
for(const [field,secret] of [['content','PRIVATE MESSAGE'],['prompt','PRIVATE PROMPT'],['reasoning','PRIVATE COT']]){
  const hostile={...route,[field]:secret};
  assert.equal(isExactPublicCommunicationRoute(hostile),false);
  assert.deepEqual(publicCommunicationRouteEvents([hostile]),[]);
}
assert.equal(telemetryActivity(aggregate).length,0,
  'unverified route bytes must never enter topology');
assert.equal(telemetryActivity(aggregate,{verifiedCommunicationRoutes:[route]}).length,1);

const broadcast={...route,event_id:'event:2',recipient_persona_ids:['p2','p3']};
assert.deepEqual(publicCommunicationRouteEvents([broadcast])[0].recipients,
  [{kind:'persona',id:'p2'},{kind:'persona',id:'p3'}]);
assert.equal(publicCommunicationRouteEvents([
  {...route,persona_signature_verified:false},
  {...route,lineage_signature_verified:false},
]).length,0);
assert.equal(publicCommunicationRouteEvents([{...route,route_kind:'addressed'}]).length,0);

assert.equal(isPersonaTelemetryDocument({schema:'personaos-persona-telemetry/1'}),false);
assert.equal(isEnvironmentTelemetryDocument({schema:'personaos-env-telemetry/1'}),false);
assert.equal(isEnvironmentTelemetryDocument({schema:'personaos-env-telemetry-public/1'}),false);
assert.equal(isPublicEntityTelemetryDocument({schema:'personaos-persona-telemetry/1'}),false);
const operator={schema:OPERATOR_LIVE_TELEMETRY_SCHEMA,kernel:{
  active_model_calls:[{call_id:'operator-call'}],model_events:[model],
  interactions:[{kind:'OPERATOR_EVENT'}],spans:[{span_id:'operator-span'}],
}};
assert.equal(telemetryActiveCalls(operator)[0].call_id,'operator-call');
assert.deepEqual(telemetryModelEvents(operator),[model]);
assert.equal(telemetryActivity(operator)[0].kind,'OPERATOR_EVENT');
console.log('public telemetry contract: ok');
