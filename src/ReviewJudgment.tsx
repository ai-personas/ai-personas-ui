import { fields, isRecordID, text } from './workspace';
import { RecordReference, RelatedItems, Story } from './RecordReader';

export default function ReviewJudgment({ value, open }: { value: unknown; open: (id: string) => void }) {
  const d = fields(value), snapshot = fields(d.check_receipts);
  const receipts = snapshot.schema === 'review-observations/1' && Array.isArray(snapshot.receipts)
    ? snapshot.receipts.map(fields).filter(r => isRecordID(r.action) && typeof r.receipt_digest === 'string' && /^[a-f0-9]{64}$/i.test(r.receipt_digest)) : [];
  const knownSnapshot = snapshot.schema === 'review-observations/1' && snapshot.capture_stage === 'assessment_recording' && Array.isArray(snapshot.receipts) && receipts.length === snapshot.receipts.length;
  const self = d.judgment_kind === 'self_assessment';
  const verdict = ({ accepted: 'Judged satisfactory', rejected: 'Concerns raised', incomplete: 'Assessment incomplete' } as Record<string, string>)[text(d.verdict)] || 'Assessment';
  return <section aria-label="Persona assessment">
    <h3>{verdict}</h3>
    <p>{self ? 'Self-assessment — the author is judging their own contribution.' : d.judgment_kind === 'peer_perspective' ? 'Peer perspective on the submitted version.' : 'Assessment of the submitted version.'}</p>
    {isRecordID(d.reviewer) && <p>Assessed by <RecordReference id={d.reviewer} open={open} fallback="Persona"/></p>}
    <Story value={d.summary || d.content}/><Story title="Reasoning" value={d.findings}/><Story title="Limitations" value={d.limitations}/>
    <p class="reader-muted">An assessment does not approve the work or decide what happens next. Acceptance depends on the agreed requirements and any required user decision.</p>
    {self && <p class="reader-muted">This does not count as independent approval.</p>}
    {knownSnapshot && <p class="reader-muted">Citation receipts were captured when this assessment was recorded. This does not establish what the persona saw or understood in an earlier request.</p>}
    {knownSnapshot && receipts.length === 0
      ? <p>No additional actions were cited. The persona may assess material already received through reading and reasoning.</p>
      : knownSnapshot ? <RelatedItems title="Observations cited at assessment" value={receipts} open={open}/>
      : <p class="reader-muted">Citation details are missing or unsupported. A fresh assessment is needed before relying on them.</p>}
  </section>;
}
