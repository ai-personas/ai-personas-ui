import { useState } from 'preact/hooks';
import { inferenceEvidence, type EvidenceReference } from './inference-evidence';
const number = (value: number | undefined) => value === undefined ? 'Not recorded' : value.toLocaleString();

function References({ value, open }: { value: EvidenceReference[] | undefined; open: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (!value?.length) return null;
  // No reference fetches or payload previews are mounted before explicit choice.
  return <div><button class="text-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Hide references' : 'Show exact references'}</button>
    {expanded && <ul>{value.slice(0, 32).map(ref => <li key={ref.id + ':' + ref.revision}>
      <button class="text-button" onClick={() => open(ref.id)}>{ref.id.slice(0, 12)}… · referenced revision {ref.revision}</button>
    </li>)}</ul>}{expanded && value.length > 32 && <p>Showing 32 of {value.length} references. Full receipts remain in the record.</p>}
    {expanded && <p class="reader-muted">Opening a reference shows its current record. The revision above identifies the version in this receipt.</p>}
  </div>;
}
export default function InferenceEvidence({ value, open }: { value: unknown; open: (id: string) => void }) {
  const facts = inferenceEvidence(value);
  return <section class="reader-section" aria-label="Inference evidence"><h3>Inference evidence</h3>
    <p>Call status: {facts.state.replaceAll('_', ' ')}. Status is not a verdict on the work.</p>
    <dl><dt>Serialized context bytes</dt><dd>{number(facts.contextBytes)} — not a token count</dd>
      <dt>Measured provider usage</dt><dd>{facts.measured ? `${number(facts.measured.input)} input, ${number(facts.measured.output)} output; ${number(facts.measured.cached)} cached input tokens` : 'Unknown or not coherently recorded; do not assume this call was free.'}</dd></dl>
    {facts.maintenance && <p class="notice">This call was the funded context-maintenance attempt. It uses the same assigned model and allowance.</p>}
    {facts.contextParts && <details><summary>What occupied the context</summary><dl>{facts.contextParts.map(part => <div key={part.label}><dt>{part.label}</dt><dd>{number(part.bytes)} bytes</dd></div>)}</dl><p class="reader-muted">Serialized sections are not tokenizer measurements. Adapter framing and encoded media are accounted separately.</p></details>}
    {facts.exposure && <p>Admitted upper-bound exposure: {number(facts.exposure.input)} input and {number(facts.exposure.output)} output tokens. These are reservations or estimates, not measured usage or a tokenizer result.</p>}
    {facts.recovery && <section><h4>Bounded context recovery</h4><dl>
      <dt>Older successful receipts omitted</dt><dd>{number(facts.recovery.history)}</dd>
      <dt>Old command bodies referenced</dt><dd>{number(facts.recovery.commands)}</dd>
      <dt>Old diagnostic logs excerpted</dt><dd>{number(facts.recovery.diagnostics)}</dd>
      <dt>Optional discovery previews omitted</dt><dd>{number(facts.recovery.previews)}</dd>
      <dt>Optional retention pointers omitted</dt><dd>{number(facts.recovery.retention)}</dd>
      <dt>Request bytes before projection</dt><dd>{number(facts.recovery.originalBytes)}</dd>
    </dl><p class="reader-muted">Projection does not resolve failures, edit durable history, or prove omitted detail was inspected. Exact action and job receipts remain the place to read complete evidence.</p></section>}
    {facts.discovery && <section><h4>Discovery previews admitted</h4><p>{number(facts.discovery.offered?.length)} candidate references. Discovery is not active lesson selection.</p><References value={facts.discovery.offered} open={open}/></section>}
    {facts.memory && <section><h4>Memory graph cards shown</h4><p>{number(facts.memory.offered?.length)} fragment descriptions were included. Descriptions are separate from full selected prompt fragments.</p><References value={facts.memory.offered} open={open}/></section>}
    {facts.learning && <section><h4>Selected learning admitted</h4><p>{number(facts.learning.active?.length)} active lesson references; {number(facts.learning.corrections?.length)} correction notices.</p><References value={facts.learning.active} open={open}/><p class="reader-muted">A retained lesson, an admitted selection, a later action, and a controlled improvement result are different evidence stages.</p></section>}
    {facts.questions && <section><h4>Pending questions at admission</h4><p>{number(facts.questions.references?.length)} visible pending questions with {number(facts.questions.replies)} visible replies. Answers and acknowledgements do not close questions or grant authority automatically.</p><References value={facts.questions.references} open={open}/></section>}
    {!facts.recovery && !facts.discovery && !facts.memory && !facts.learning && !facts.questions && <p>No recognized context-recovery, discovery, learning, or question receipt is recorded for this call.</p>}
    <p class="record-caveat">These context receipts describe pre-dispatch admission. They do not by themselves prove model receipt, understanding, use, or benefit. Provider outcomes, actions and independent assessment must be checked separately.</p>
  </section>;
}
