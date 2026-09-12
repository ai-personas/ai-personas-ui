import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign, webcrypto} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import test from 'node:test';

globalThis.crypto ||= webcrypto;
const root = process.env.UI_PRESENTATION_ASSETS || fileURLToPath(new URL('../assets/', import.meta.url));
const {canonicalJson, parseSignedJson} = await import(pathToFileURL(resolve(root, 'canonical-json.mjs')));
const {verifySignedPersonaRecord, verifyPersonaEducation, verifyPersonaExperience,
  verifyNodePersonaProjection, filterPersonaDirectory, educationHtml, experienceHtml} = await import(pathToFileURL(resolve(root, 'persona-records.mjs')));
const digest = value => 'sha256:' + createHash('sha256').update(canonicalJson(value)).digest('hex');
const key = () => {
  const pair = generateKeyPairSync('ed25519');
  return {...pair, hex: pair.publicKey.export({type: 'spki', format: 'der'}).subarray(-32).toString('hex')};
};
const nodeKey = key(), learnerKey = key(), assessorKey = key();
const signRecord = (payload, keyPair, issuer, keyId) => {
  const body = {...payload, issuer_id: issuer, public_key: keyPair.hex, signing_key_id: keyId, issued_at: '2026-09-11T00:00:00Z'};
  body.record_id = digest(body);
  return {...body, signature: sign(null, Buffer.from(canonicalJson(body)), keyPair.privateKey).toString('hex')};
};
const resign = (record, pair = nodeKey) => {
  const body = {...record}; for (const name of ['signature', 'record_id', 'issuer_id', 'public_key', 'signing_key_id', 'issued_at']) delete body[name];
  return signRecord(body, pair, record.issuer_id, record.signing_key_id);
};
const options = {nodeId: 'kernel:test', personaId: 'learner', keyEntries: [{key_id: 'kernel-master', role: 'master', status: 'current', public_key_hex: nodeKey.hex}]};

function fixture() {
  const course = {id: 'tools', title: 'Tools and verification', version: '1', record_id: digest('package'),
    rubric: [{criterion: 'fresh-checks', description: 'Verify changed input.'}],
    assessment_capability: {id: 'independent', version: '1', public_key: assessorKey.hex},
    result_scale: ['passed', 'not_yet_demonstrated', 'assessment_unavailable'], successful_results: ['passed']};
  const binding = {learner_id: 'learner', package_hash: course.record_id, rubric_hash: digest(course.rubric),
    submission_hash: digest('immutable submission'), execution_evidence_hash: digest('authenticated evidence'),
    challenge_nonce: 'fresh-case', assessment_capability: course.assessment_capability};
  const result = signRecord({schema: 'personaos-assessment-result/1', ...binding, request_id: digest('request'),
    status: 'passed', criteria: [{criterion: 'fresh-checks', status: 'passed', evidence: ['Changed inputs measured.']}],
    evidence: {case_count: 33}, supersedes: '', correction_reason: ''}, assessorKey, 'independent', 'assessor:independent');
  const enrollment = signRecord({schema: 'personaos-curriculum-enrollment/1', persona_id: 'learner',
    curriculum_id: course.id, version: course.version, package_hash: course.record_id,
    environment_id: 'room', task_id: 'task', visibility: 'public'}, learnerKey, 'learner', 'persona:learner');
  const attempt = {...binding, assessment_id: result.request_id, curriculum_id: course.id, version: course.version,
    status: result.status, criteria: result.criteria, latest_result: result, history: [result]};
  const doc = signRecord({schema: 'personaos-persona-education/1', persona_id: 'learner', visibility: 'public',
    source_signatures_verified_by_node: true, curricula: [course], enrollments: [enrollment], assessments: [attempt]}, nodeKey, 'kernel:test', 'kernel-master');
  return {doc, attempt, result, course};
}

test('education verifies the node projection, original signatures, pinned assessor and every rubric criterion', async () => {
  const {doc} = fixture();
  assert.equal((await verifyPersonaEducation(doc, options)).ok, true);
  const html = educationHtml(doc);
  assert.match(html, /Node signature verified/); assert.match(html, /assessor signatures checked separately/);
  assert.match(html, /fresh-checks/); assert.match(html, /Changed inputs measured/);
  assert.match(html, /independent/); assert.match(html, /latest attempt/);
  assert.match(html, /not an overall ability score/);
});

test('a valid self-contained signature is not node or assessor authority', async () => {
  const {doc} = fixture();
  assert.equal(await verifySignedPersonaRecord(resign(doc, learnerKey)), true);
  assert.equal((await verifyPersonaEducation(resign(doc, learnerKey), options)).ok, false);
  for (const change of [row => { row.issuer_id = 'someone-else'; }, row => { row.learner_id = 'someone-else'; },
    row => { row.submission_hash = digest('substituted'); }, row => { row.criteria = []; }]) {
    const changed = structuredClone(doc), attempt = changed.assessments[0];
    change(attempt.history[0]);
    attempt.history[0] = resign(attempt.history[0], assessorKey);
    attempt.latest_result = attempt.history[0]; attempt.criteria = attempt.latest_result.criteria;
    assert.equal((await verifyPersonaEducation(resign(changed), options)).ok, false);
  }
  const substituted = structuredClone(doc), row = substituted.assessments[0];
  row.history[0] = resign(row.history[0], learnerKey); row.latest_result = row.history[0];
  assert.equal((await verifyPersonaEducation(resign(substituted), options)).ok, false);
});

test('corrections remain visible and cannot leave a stale passing label', async () => {
  const {doc, result} = fixture();
  const correction = resign({...result, supersedes: result.record_id, correction_reason: 'The source check was withdrawn.',
    status: 'not_yet_demonstrated', criteria: [{...result.criteria[0], status: 'not_yet_demonstrated'}]}, assessorKey);
  const attempt = doc.assessments[0]; attempt.history.push(correction);
  assert.equal((await verifyPersonaEducation(resign(doc), options)).ok, false);
  attempt.latest_result = correction; attempt.status = correction.status; attempt.criteria = correction.criteria;
  assert.equal((await verifyPersonaEducation(resign(doc), options)).ok, true);
  assert.match(educationHtml(doc), /Issuer correction: The source check was withdrawn/);
  assert.match(educationHtml(doc), /2 signed records/);
});

test('unassessed and unavailable are distinct from a failed signature, and public views reject private projections', async () => {
  const {doc} = fixture();
  doc.assessments = [];
  assert.equal((await verifyPersonaEducation(resign(doc), options)).ok, true);
  assert.match(educationHtml(doc), /Unassessed/);
  doc.visibility = 'authorized_private';
  assert.equal((await verifyPersonaEducation(resign(doc), options)).ok, false);
  assert.equal((await verifyPersonaEducation(resign(doc), {...options, privateRead: true})).ok, true);
  const {doc: unavailable} = fixture(), attempt = unavailable.assessments[0];
  const record = signRecord({schema: 'personaos-assessment-unavailable/1', request_id: attempt.assessment_id,
    learner_id: 'learner', package_hash: attempt.package_hash, status: 'assessment_unavailable', reason: '<script>no funding</script>'}, nodeKey, 'kernel:test', 'kernel-master');
  Object.assign(attempt, {latest_result: record, history: [record], criteria: [], status: record.status});
  assert.equal((await verifyPersonaEducation(resign(unavailable), options)).ok, true);
  const html = educationHtml(unavailable);
  assert.match(html, /assessment unavailable/); assert.ok(!html.includes('<script>')); assert.match(html, /&lt;script&gt;/);
});

test('signed JSON numeric tokens remain intact and byte tampering is refused', async () => {
  const row = signRecord(parseSignedJson('{"schema":"fixture/1","value":1.0,"huge":900719925474099300001}'), nodeKey, 'kernel:test', 'kernel-master');
  assert.equal(await verifySignedPersonaRecord(row), true);
  row.value = 2;
  assert.equal(await verifySignedPersonaRecord(row), false);
});

test('experience shows retained observations without assigning competence or leaking source text', async () => {
  const doc = signRecord({schema: 'personaos-persona-experience/1', persona_id: 'learner', visibility: 'public_environment_metadata',
    summary: {recorded_turns: 0}, records: [], total_records: 0, next_offset: null,
    source_generation: digest([]), limits: 'Retained observations, not competence.'}, nodeKey, 'kernel:test', 'kernel-master');
  assert.equal((await verifyPersonaExperience(doc, options)).ok, true);
  assert.match(experienceHtml(doc), /not a claim that no work occurred/);
  doc.summary.recorded_turns = -1;
  assert.equal((await verifyPersonaExperience(resign(doc), options)).ok, false);
});

test('manual participant filters use exact course versions, results and open character values without ranking', async () => {
  const people = [
    {persona_id: 'b', selection_available: true, profile: {name: 'B', characteristic_identity: {characteristics: {patient: false}}}, education: {latest_assessments: [{curriculum_id: 'tools', version: '1', status: 'passed'}]}},
    {persona_id: 'a', selection_available: false, profile: {name: 'A'}, education: {latest_assessments: [{curriculum_id: 'tools', version: '2', status: 'passed'}]}},
  ];
  assert.deepEqual(filterPersonaDirectory(people), people);
  assert.deepEqual(filterPersonaDirectory(people, {curriculum: 'tools', version: '1', result: 'passed'}), [people[0]]);
  assert.deepEqual(filterPersonaDirectory(people, {characterKey: 'patient', characterValue: 'false'}), [people[0]]);
  assert.deepEqual(filterPersonaDirectory(people, {availability: 'unavailable'}), [people[1]]);
  assert.deepEqual(filterPersonaDirectory(people, {result: 'unassessed'}), []);
  const doc = signRecord({schema: 'personaos-persona-directory/1', visibility: 'public', ranked: false, personas: people}, nodeKey, 'kernel:test', 'kernel-master');
  assert.equal((await verifyNodePersonaProjection(doc, {...options, personaId: '', schema: doc.schema})).ok, true);
});
