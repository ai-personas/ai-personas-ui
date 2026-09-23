import test from 'node:test';
import assert from 'node:assert/strict';
import { profileCreation, supportsProfileCreation, operatorProfileStamp } from '../src/profile.ts';

const form = (values = {}) => { const f = new FormData(); for (const [key, value] of Object.entries(values)) f.set(key, value); return f; };

test('blank fields are omitted, zero and signed endpoints are preserved', () => {
  assert.deepEqual(profileCreation(form({ 'profile.self_authorship':'on', 'profile.ocean.openness':'0', 'profile.vad.arousal':'0', 'profile.vad.valence':'-1', 'profile.vad.dominance':'1', 'profile.ocean.agreeableness':' ' })), {
    profile_seed: { ocean: { openness: 0 }, vad: { valence: -1, arousal: 0, dominance: 1 } }, self_authorship: true,
  });
});
test('unchecked self-authorship is explicit false, not a missing default', () => {
  assert.deepEqual(profileCreation(form()), { profile_seed:{}, self_authorship:false });
});
test('character text is preserved and repeated parsing never randomizes values', () => {
  const f = form({ 'profile.character':'  A starting approach  ', 'profile.self_authorship':'on' });
  const first = profileCreation(f);
  assert.equal(first.profile_seed.character, '  A starting approach  ');
  assert.deepEqual(first, profileCreation(f));
  assert.equal(first.profile_seed.ocean, undefined);
});
test('invalid numeric input is rejected rather than clamped or initialized', () => {
  for (const value of ['-0.1','1.1','NaN','Infinity','0x1','1,0','word']) assert.throws(() => profileCreation(form({ 'profile.ocean.openness':value })));
  for (const value of ['-1.1','1.1']) assert.throws(() => profileCreation(form({ 'profile.vad.valence':value })));
});
test('server capability must include the version and both creation fields', () => {
  const supported = { command:{ 'x-contract-version':'operations/2', oneOf:[{ properties:{ kind:{const:'persona.create'}, args:{properties:{ profile_seed:{}, self_authorship:{} }} } }] } };
  assert.equal(supportsProfileCreation(supported), true);
  for (const unsupported of [null, {}, {command:{oneOf:[]}}, {command:{...supported.command,'x-contract-version':'operations/1'}}]) assert.equal(supportsProfileCreation(unsupported), false);
  delete supported.command.oneOf[0].properties.args.properties.self_authorship;
  assert.equal(supportsProfileCreation(supported), false);
});
test('operator attribution cannot be inferred from an inherited stamp or persona actor', () => {
  const record = { id:'a'.repeat(32), revision:2, data:{profile_revision:{revision:2,author_kind:'operator',actor:'',run:'',source:'api',operation:'b'.repeat(32)}} };
  assert.equal(operatorProfileStamp(record), true);
  assert.equal(operatorProfileStamp({...record,revision:3}), false);
  assert.equal(operatorProfileStamp({...record,data:{profile_revision:{...record.data.profile_revision,actor:record.id}}}), false);
  assert.equal(operatorProfileStamp({...record,data:{profile_revision:{...record.data.profile_revision,source:'call:'+'c'.repeat(32)}}}), false);
});

const { revisionAttribution, profileChanges, TRAITS, traitReading, traitSegments } = await import('../src/identity.ts');
test('identity history distinguishes operator and persona revisions and rejects inherited stamps', () => {
  const id='a'.repeat(32), operation='b'.repeat(32);
  const record={id,kind:'persona',revision:2,data:{profile_revision:{revision:2,operation,author_kind:'operator',actor:'',run:'',source:'api',reason:'User chose fixed values',evidence:[]}}};
  assert.equal(revisionAttribution(record).authorKind,'operator');
  assert.equal(revisionAttribution({...record,revision:3}).recorded,false);
  const authored={...record,data:{profile_revision:{...record.data.profile_revision,actor:id,author_kind:'persona',source:'call:'+'c'.repeat(32)}}};
  assert.equal(revisionAttribution(authored).authorKind,'persona');
  assert.equal(revisionAttribution({...record,data:{profile_revision:{...record.data.profile_revision,actor:id}}}).recorded,false);
});
test('policy changes are visible and missing numeric history is not reconstructed', () => {
  const before={id:'a'.repeat(32),kind:'persona',revision:1,data:{self_authorship:true,ocean:{openness:0}}};
  const after={...before,revision:2,data:{self_authorship:false,ocean:{openness:0}}};
  assert.deepEqual(profileChanges(before,after).map(change=>change.field),['self_authorship']);
  assert.equal(traitReading(after.data,TRAITS[0]).value,0);
  const missing={...after,revision:3,data:{}};
  assert.equal(traitReading(missing.data,TRAITS[0]).state,'missing');
  assert.equal(traitSegments([before,missing,{...after,revision:4}],TRAITS[0]).length,2);
});
