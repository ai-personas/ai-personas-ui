import { fields, isRecordID, text } from './workspace';
import { RecordReference, RelatedItems, Story } from './RecordReader';

export default function ReviewJudgment({ value, open }: { value: unknown; open: (id: string) => void }) {
  const d = fields(value), snapshot = fields(d.check_receipts);
  const receipts = snapshot.schema === 'review-observations/1' && Array.isArray(snapshot.receipts)
    ? snapshot.receipts.map(fields).filter(r => isRecordID(r.action) && typeof r.receipt_digest === 'string' && /^[a-f0-9]{64}$/i.test(r.receipt_digest)) : [];
  const knownSnapshot = snapshot.schema === 'review-observations/1' && snapshot.capture_stage === 'assessment_recording' && Array.isArray(snapshot.receipts) && receipts.length === snapshot.receipts.length;
  const verdict = ({ accepted: 'Accepted by the reviewer', rejected: 'Changes needed', incomplete: 'Review incomplete' } as Record<string, string>)[text(d.verdict)] || 'Review judgment';
  return <section aria-label="Reviewer judgment">
    <h3>{verdict}</h3>
    {isRecordID(d.reviewer) && <p>Reviewed by <RecordReference id={d.reviewer} open={open} fallback="Reviewer"/></p>}
    <Story value={d.summary || d.content}/><Story title="Reviewer’s reasoning" value={d.findings}/><Story title="Limitations" value={d.limitations}/>
    <p class="reader-muted">This judgment concerns the submitted version. Current acceptance also depends on the agreed scope, unresolved findings, and any required user decision.</p>
    {knownSnapshot && <p class="reader-muted">Citation receipts were captured when this assessment was recorded. This does not establish what the reviewer saw or understood in an earlier request.</p>}
    {knownSnapshot && receipts.length === 0
      ? <p>No additional actions were cited. The reviewer may assess material already received through reading and reasoning.</p>
      : knownSnapshot ? <RelatedItems title="Observations cited at assessment" value={receipts} open={open}/>
      : <p class="reader-muted">{Object.hasOwn(d, 'check_receipts') ? 'Citation details are incomplete or unsupported. A fresh assessment is needed before relying on them.' : 'This earlier assessment has no recorded observation snapshots.'}</p>}
  </section>;
}
