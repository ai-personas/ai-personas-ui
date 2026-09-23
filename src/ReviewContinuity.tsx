import { useState } from 'preact/hooks';
import { fields, isRecordID } from './workspace';
import { RelatedItems } from './RecordReader';

function version(value: unknown) {
  const v = fields(value);
  return isRecordID(v.id) && typeof v.revision === 'number' && Number.isSafeInteger(v.revision) && v.revision > 0;
}
function evidence(value: unknown) {
  const v = fields(value);
  return version(value) || (isRecordID(v.action) && typeof v.receipt_digest === 'string' && /^[a-fA-F0-9]{64}$/.test(v.receipt_digest));
}
export default function ReviewContinuity({ value, open }: { value: unknown; open: (id: string) => void }) {
  const d = fields(value), [expanded, setExpanded] = useState(false);
  const concludes = version(d.concludes) ? d.concludes : undefined;
  const links = Array.isArray(d.change_evidence) ? d.change_evidence.slice(0, 32).map(fields).filter(link =>
    link.basis === 'explicit_exact_reference' && version(link.change) &&
    Array.isArray(link.observations) && link.observations.length > 0 && link.observations.length <= 128 &&
    link.observations.every(evidence)
  ) : [];
  if (!concludes && !links.length) return null;
  return <section class="reader-section" aria-label="Review continuity">
    {concludes && <p>This concludes an earlier deferral. It is not a new experience or permission for another exploration episode.</p>}
    {links.length > 0 && <p>These changes cite exact reviewed observations. The links do not establish that the interpretation is correct or that it improved an outcome.</p>}
    <button class="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide review links' : 'Show review links'}</button>
    {expanded && <div aria-label="Review evidence links">
      {concludes && <RelatedItems title="Earlier deferred interpretation" value={[concludes]} open={open}/>}
      {links.map((link, index) => <section key={index}>
        <RelatedItems title={`Committed change ${index + 1}`} value={[link.change]} open={open}/>
        <RelatedItems title="Observations explicitly cited by this change" value={link.observations} open={open}/>
      </section>)}
      <p class="micro">Record links open the available current item; the referenced version is shown separately. Action evidence checks the recorded receipt digest.</p>
    </div>}
  </section>;
}
