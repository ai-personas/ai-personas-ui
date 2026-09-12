import {canonicalJson} from './canonical-json.mjs';
import {currentMasterKey} from './discovery-authority.mjs';
import {sha256Hex} from './live-artifacts.mjs';
import * as ed from './noble-ed25519.js';

const encoder = new TextEncoder();
const hashPattern = /^sha256:[0-9a-f]{64}$/;
const keyPattern = /^[0-9a-f]{64}$/;
const signaturePattern = /^[0-9a-f]{128}$/;
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const hexBytes = value => Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16));
const hash = async value => 'sha256:' + await sha256Hex(encoder.encode(canonicalJson(value)));
const nonempty = value => object(value) ? Object.keys(value).length > 0
  : Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.length > 0;
const failure = reason => ({ok: false, reason});

export async function verifySignedPersonaRecord(record) {
  if (!object(record) || !keyPattern.test(record.public_key || '')
      || !signaturePattern.test(record.signature || '') || !hashPattern.test(record.record_id || '')
      || !['schema', 'issuer_id', 'issued_at', 'signing_key_id'].every(key => typeof record[key] === 'string' && record[key])) return false;
  const unsigned = {...record}; delete unsigned.signature;
  const basis = {...unsigned}; delete basis.record_id;
  try {
    return await hash(basis) === record.record_id
      && await ed.verifyAsync(hexBytes(record.signature), encoder.encode(canonicalJson(unsigned)), hexBytes(record.public_key));
  } catch (_) { return false; }
}

export async function verifyNodePersonaProjection(record, {schema, personaId, nodeId, keyEntries, privateRead = false} = {}) {
  const publicKey = currentMasterKey(keyEntries);
  if (!publicKey || !nodeId || record?.schema !== schema || record?.issuer_id !== nodeId
      || record?.signing_key_id !== 'kernel-master' || record?.public_key !== publicKey
      || (personaId && record?.persona_id !== personaId)) return failure('node_or_persona_binding_invalid');
  if (!privateRead && !['public', 'public_environment_metadata'].includes(record.visibility)) return failure('private_projection_refused');
  if (!await verifySignedPersonaRecord(record)) return failure('node_projection_signature_invalid');
  return {ok: true, issuer: nodeId, sourceAuthority: 'node-verified original records'};
}

export async function verifyPersonaEducation(record, options = {}) {
  const outer = await verifyNodePersonaProjection(record, {...options, schema: 'personaos-persona-education/1'});
  if (!outer.ok) return outer;
  if (record.source_signatures_verified_by_node !== true || !Array.isArray(record.curricula)
      || !Array.isArray(record.enrollments) || !Array.isArray(record.assessments)) return failure('education_shape_invalid');
  const courses = new Map();
  for (const course of record.curricula) {
    if (!object(course) || !hashPattern.test(course.record_id || '') || courses.has(course.record_id)
        || !Array.isArray(course.rubric) || !course.rubric.length
        || !Array.isArray(course.result_scale) || !Array.isArray(course.successful_results)
        || !object(course.assessment_capability) || !keyPattern.test(course.assessment_capability.public_key || '')) return failure('curriculum_projection_invalid');
    courses.set(course.record_id, course);
  }
  for (const enrollment of record.enrollments) {
    const course = courses.get(enrollment?.package_hash);
    if (!course || enrollment.schema !== 'personaos-curriculum-enrollment/1'
        || enrollment.persona_id !== record.persona_id || enrollment.issuer_id !== record.persona_id
        || enrollment.signing_key_id !== 'persona:' + record.persona_id
        || enrollment.curriculum_id !== course.id || enrollment.version !== course.version
        || !await verifySignedPersonaRecord(enrollment)) return failure('enrollment_signature_or_binding_invalid');
  }
  const seen = new Set();
  for (const attempt of record.assessments) {
    const course = courses.get(attempt?.package_hash);
    if (!course || !hashPattern.test(attempt.assessment_id || '') || seen.has(attempt.assessment_id)
        || attempt.learner_id !== record.persona_id || attempt.curriculum_id !== course.id || attempt.version !== course.version
        || attempt.rubric_hash !== await hash(course.rubric)
        || !same(attempt.assessment_capability, course.assessment_capability)
        || !Array.isArray(attempt.history)) return failure('assessment_request_binding_invalid');
    seen.add(attempt.assessment_id);
    let priorResult = null, last = null;
    for (const result of attempt.history) {
      if (!await verifySignedPersonaRecord(result) || result.request_id !== attempt.assessment_id
          || result.learner_id !== record.persona_id || result.package_hash !== attempt.package_hash) return failure('assessment_history_signature_invalid');
      if (result.schema === 'personaos-assessment-unavailable/1') {
        if (result.status !== 'assessment_unavailable' || result.signing_key_id !== 'kernel-master'
            || !result.reason) return failure('unavailable_result_invalid');
      } else if (result.schema === 'personaos-assessment-result/1') {
        const cap = course.assessment_capability;
        if (result.public_key !== cap.public_key || result.issuer_id !== cap.id
            || !['learner_id', 'package_hash', 'rubric_hash', 'submission_hash', 'execution_evidence_hash', 'challenge_nonce', 'assessment_capability']
              .every(key => same(result[key], attempt[key]))
            || result.supersedes !== (priorResult?.record_id || '') || (priorResult && !result.correction_reason)
            || !course.result_scale.includes(result.status) || !nonempty(result.evidence)
            || !Array.isArray(result.criteria)) return failure('assessor_or_evidence_binding_invalid');
        const criteria = new Set(course.rubric.map(row => row.criterion));
        if (criteria.size !== course.rubric.length || result.criteria.length !== criteria.size
            || new Set(result.criteria.map(row => row.criterion)).size !== criteria.size
            || result.criteria.some(row => !criteria.has(row.criterion) || !course.result_scale.includes(row.status) || !nonempty(row.evidence))
            || (course.successful_results.includes(result.status)
              && result.criteria.some(row => !course.successful_results.includes(row.status)))) return failure('rubric_result_invalid');
        priorResult = result;
      } else return failure('unknown_assessment_record');
      last = result;
    }
    const latest = priorResult || last;
    if (!same(attempt.latest_result, latest) || attempt.status !== (latest?.status || 'unassessed')
        || !same(attempt.criteria, latest?.criteria || [])) return failure('latest_assessment_mismatch');
  }
  return {...outer, assessorSignaturesVerified: true};
}

export async function verifyPersonaExperience(record, options = {}) {
  const outer = await verifyNodePersonaProjection(record, {...options, schema: 'personaos-persona-experience/1'});
  if (!outer.ok) return outer;
  if (!object(record.summary) || Object.values(record.summary).some(value => !Number.isSafeInteger(value) || value < 0)
      || !Array.isArray(record.records) || !Number.isSafeInteger(record.total_records) || record.total_records < record.records.length
      || !hashPattern.test(record.source_generation || '')
      || (record.next_offset !== null && (!Number.isSafeInteger(record.next_offset) || record.next_offset < 1))) return failure('experience_shape_invalid');
  return outer;
}

export function validEnvironmentImageReference(value) {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'alt,artifact_ref,byte_length,content_ref,height,mime_type,width') return false;
  return typeof value.artifact_ref === 'string' && value.artifact_ref.length > 0
    && !/[\\\u0000-\u001f]/.test(value.artifact_ref) && !value.artifact_ref.startsWith('/')
    && !value.artifact_ref.split('/').some(part => !part || part === '.' || part === '..')
    && hashPattern.test(value.content_ref || '') && ['image/png', 'image/jpeg', 'image/webp'].includes(value.mime_type)
    && ['byte_length', 'width', 'height'].every(key => Number.isSafeInteger(value[key]) && value[key] > 0)
    && value.byte_length <= 25 * 1024 * 1024 && Math.max(value.width, value.height) <= 8192
    && value.width * value.height <= 64 * 1024 * 1024 && typeof value.alt === 'string' && value.alt.trim().length > 0;
}

export function filterPersonaDirectory(people, {text = '', availability = '', curriculum = '', version = '', result = '', characterKey = '', characterValue = ''} = {}) {
  return people.filter(person => {
    if (text && ![person.persona_id, person.profile?.name].some(value => String(value || '').toLocaleLowerCase().includes(text.toLocaleLowerCase()))) return false;
    if (availability && person.selection_available !== (availability === 'available')) return false;
    if ((curriculum || version || result) && !(person.education?.latest_assessments || []).some(row =>
      (!curriculum || row.curriculum_id === curriculum) && (!version || row.version === version) && (!result || row.status === result))) return false;
    if (characterKey) {
      const traits = person.profile?.characteristic_identity?.characteristics || {};
      if (!Object.hasOwn(traits, characterKey) || (characterValue && canonicalJson(traits[characterKey]) !== characterValue)) return false;
    }
    return true;
  });
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const words = value => String(value || '').replaceAll('_', ' ');
const evidenceHtml = evidence => `<pre class="record-evidence">${escape(typeof evidence === 'string' ? evidence : canonicalJson(evidence))}</pre>`;

export function educationHtml(doc) {
  const courses = new Map(doc.curricula.map(course => [course.record_id, course]));
  let html = '<p class="record-proof">Node signature verified · assessor signatures checked separately. These are course results, not an overall ability score.</p>';
  html += '<h3>Current study</h3>' + (doc.enrollments.length ? doc.enrollments.map(row =>
    `<div class="record-row"><b>${escape(courses.get(row.package_hash)?.title || row.curriculum_id)}</b>`
    + `<span>Version ${escape(row.version)} · enrolled ${escape(row.issued_at)}</span>`
    + `<small>Environment ${escape(row.environment_id)} · enrollment recorded, not proof of current activity</small></div>`).join('')
    : '<p class="l2">No shared enrollment records.</p>');
  html += '<h3>Assessment history</h3>';
  if (!doc.assessments.length) return html + '<p class="l2">Unassessed. No result has been recorded.</p>';
  const latestByCourse = new Map();
  for (const row of doc.assessments) latestByCourse.set(row.package_hash, row.assessment_id);
  for (const row of [...doc.assessments].reverse()) {
    const course = courses.get(row.package_hash), result = row.latest_result;
    html += `<section class="record-attempt" data-stage-key="${escape(row.assessment_id)}">`
      + `<h4>${escape(course?.title || row.curriculum_id)} <small>v${escape(row.version)}</small></h4>`
      + `<p><b>${escape(words(row.status))}</b> · ${latestByCourse.get(row.package_hash) === row.assessment_id ? 'latest attempt' : 'earlier attempt'}</p>`
      + `<p class="l2">Assessor ${escape(row.assessment_capability.id)} · v${escape(row.assessment_capability.version)}</p>`;
    if (result?.reason) html += `<p>${escape(result.reason)}</p>`;
    if (result?.correction_reason) html += `<p>Issuer correction: ${escape(result.correction_reason)}</p>`;
    html += (row.criteria || []).map(criterion => `<details class="record-criterion" data-disclosure-key="${escape(row.assessment_id + ':' + criterion.criterion)}">`
      + `<summary>${escape(criterion.criterion)} · ${escape(words(criterion.status))}</summary>`
      + `<p>${escape(course?.rubric.find(item => item.criterion === criterion.criterion)?.description || '')}</p>`
      + evidenceHtml(criterion.evidence) + '</details>').join('');
    html += `<details data-disclosure-key="${escape(row.assessment_id)}"><summary>Evidence binding and ${row.history.length} signed record${row.history.length === 1 ? '' : 's'}</summary>`
      + `<dl><dt>Submission</dt><dd><code>${escape(row.submission_hash)}</code></dd><dt>Rubric</dt><dd><code>${escape(row.rubric_hash)}</code></dd>`
      + `<dt>Package</dt><dd><code>${escape(row.package_hash)}</code></dd></dl>`
      + row.history.map(record => `<p>${escape(record.issued_at)} · ${escape(record.issuer_id)} · ${escape(words(record.status))}</p>`
        + (record.correction_reason ? `<p>${escape(record.correction_reason)}</p>` : '')).join('')
      + '<p class="l2">The browser checked each result signature against the node-verified package assessor. Original learner, enrollment and sealed-request identity bindings were verified by the node.</p></details></section>';
  }
  return html;
}

export function experienceHtml(doc) {
  const labels = {recorded_turns: 'Recorded work turns', artifact_change_turns: 'Turns with file changes',
    successful_action_receipts: 'Successful action receipts', failed_action_receipts: 'Failed action receipts',
    authored_review_receipts: 'Authored review receipts', peer_evidence_records: 'Peer evidence records',
    accepted_task_participations: 'Accepted task participations', funded_turn_records: 'Funded turn records'};
  return '<p class="record-proof">Node signature verified · original observations verified by the node.</p>'
    + '<dl class="experience-summary">' + Object.entries(labels).map(([key, label]) =>
      `<div><dt>${label}</dt><dd>${escape(doc.summary[key] ?? 'not recorded')}</dd></div>`).join('') + '</dl>'
    + `<p class="l2">${escape(doc.limits)}</p>`
    + (doc.omitted_unverified_records ? `<p role="status">${doc.omitted_unverified_records} unverifiable records excluded.</p>` : '')
    + '<h3>Recorded work</h3>' + (doc.records.length ? doc.records.map(row =>
      `<div class="record-row"><b>${escape(words(row.source_kind))}</b><span>${escape(row.recorded_at)}</span>`
      + `<small>Task ${escape(row.task_id)} · environment ${escape(row.environment_id)}</small>`
      + `<details><summary>Measured facts</summary>${evidenceHtml(row.facts)}<code>${escape(row.source_record_hash)}</code></details></div>`).join('')
      : '<p class="l2">No visible signed work records. This is not a claim that no work occurred.</p>');
}
