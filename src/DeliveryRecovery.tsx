import { fields, isRecordID, text } from './workspace';
import { RecordReference } from './RecordReader';

/** Read-only policy diagnostics. The source owner makes every sharing choice. */
export default function DeliveryRecovery({ value, open }: { value: unknown; open: (id: string) => void }) {
  const v = fields(value);
  if (v.schema !== 'delivery-recovery/2') return null;
  const sources = Array.isArray(v.owned_sources) ? v.owned_sources.map(fields) : [];
  const audience = Array.isArray(v.audience) ? v.audience.map(fields) : [];
  const readers = (values: unknown, complete: unknown) => complete === true && Array.isArray(values)
    ? values.filter(isRecordID).join(', ') || 'none recorded'
    : 'incomplete; inspect the exact policy before replacing its readers';
  return <section class="notice" aria-label="Sharing recovery choices">
    <p><strong>Delivery needs a sharing decision.</strong> No source was automatically shared.</p>
    <p>{v.complete === true ? 'The bounded source check is complete.' : 'This source check is incomplete; further restrictions may remain.'}</p>
    {audience.map(persona => isRecordID(persona.id) && <p key={persona.id}>Intended persona: <RecordReference id={persona.id} open={open}/> · {persona.readable === true ? 'can read this version' : 'cannot read this version'}</p>)}
    {v.audience_complete !== true && <p>The full intended audience was not included.</p>}
    {sources.map((source, i) => {
      const subject = fields(source.subject), policy = fields(source.policy), implicit = fields(source.implicit_audiences);
      return <div key={text(subject.id, String(i))}>
        {isRecordID(subject.id) && <p>Owned source: <RecordReference id={subject.id} open={open}/> · revision {text(String(subject.revision ?? 'not recorded'))}</p>}
        {isRecordID(policy.id) && <p>Policy: <RecordReference id={policy.id} open={open}/> · revision {text(String(policy.revision ?? 'not recorded'))}</p>}
        <p>Explicit persona readers: {readers(source.readers, source.readers_complete)}.</p>
        <p>Export permission: {source.allow_export === true ? 'allowed by this policy; ancestor restrictions still apply' : source.allow_export === false ? 'not allowed' : 'not recorded'}.</p>
        {fields(source.inherited_restrictions).applies === true && <p>Inherited restrictions also apply to this source.</p>}
        <details><summary>Implicit audiences cleared by policy replacement</summary>
          <p>Seed persona readers: {readers(implicit.seed_readers, implicit.seed_readers_complete)}.</p>
          <p>Response persona readers: {readers(implicit.response_readers, implicit.response_readers_complete)}.</p>
          <p>Work membership scopes: {readers(implicit.work_scopes, implicit.work_scopes_complete)}. These work IDs are not persona readers.</p>
        </details>
      </div>;
    })}
    <p class="micro">Policy replacement clears implicit audiences. Readers must identify personas; operator access needs no reader entry. The owner chooses whether to preserve intended access, share explicitly, ask another owner, or continue independently with permitted sources.</p>
  </section>;
}
