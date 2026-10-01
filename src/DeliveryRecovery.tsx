import { fields, isRecordID, text } from './workspace';
import { RecordReference } from './RecordReader';

/** Read-only owned-policy diagnostics. No guessed readers or automatic retries. */
export default function DeliveryRecovery({ value, open }: { value: unknown; open: (id: string) => void }) {
  const v = fields(value);
  if (v.schema !== 'delivery-recovery/1') return null;
  const sources = Array.isArray(v.owned_sources) ? v.owned_sources.map(fields) : [];
  return <section class="notice" aria-label="Sharing recovery choices">
    <p><strong>Delivery needs a sharing decision.</strong> No source was automatically shared.</p>
    {isRecordID(v.recipient) && <p>Intended persona: <RecordReference id={v.recipient} open={open}/></p>}
    {sources.map((source, i) => {
      const subject = fields(source.subject), policy = fields(source.policy), preview = fields(source.policy_preview), audiences = fields(preview.audiences);
      return <div key={text(subject.id, String(i))}>
        {isRecordID(subject.id) && <p>Owned source: <RecordReference id={subject.id} open={open}/> · revision {text(String(subject.revision ?? 'not recorded'))}</p>}
        {isRecordID(policy.id) && <p>Policy: <RecordReference id={policy.id} open={open}/> · revision {text(String(policy.revision ?? 'not recorded'))}</p>}
        {preview.present === false ? <p>No explicit policy was recorded for this source.</p> : <>
          <p>{preview.complete === true ? 'Bounded audience preview is complete.' : 'Audience preview is incomplete. Inspect the exact policy before replacing it.'} Export permission: {preview.allow_export === true ? 'allowed by this policy; ancestor restrictions still apply' : preview.allow_export === false ? 'not allowed' : 'not recorded'}.</p>
          <details><summary>Explicit and implicit audiences</summary>{(['readers','seed_readers','response_readers','work_readers'] as const).map(name => {
            const audience = fields(audiences[name]), values = Array.isArray(audience.values) ? audience.values.filter(isRecordID) : null;
            return <p key={name}>{name === 'readers' ? 'Explicit persona readers' : name === 'work_readers' ? 'Implicit work membership scopes (not persona readers)' : name === 'seed_readers' ? 'Implicit seed persona readers' : 'Implicit response persona readers'}: {audience.complete === true && values ? values.length ? values.join(', ') : 'none recorded' : 'omitted or unavailable; not an empty audience'}.</p>;
          })}</details>
        </>}
      </div>;
    })}
    <p class="micro">Policy replacement clears implicit audiences. Readers must be existing persona IDs; operator access needs no reader entry. Do not copy work, environment or allowance IDs into readers. The owner chooses whether to preserve intended access, share explicitly, ask another owner, or continue independently with permitted sources.</p>
  </section>;
}
