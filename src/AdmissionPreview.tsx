import { useState } from 'preact/hooks';
import type { Act } from './main';
import FinishingReadiness from './FinishingReadiness';

/** Explicit read-only native quote; viewing it never starts a decision. */
export default function AdmissionPreview({ run, act }: { run: string; act: Act }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [value, setValue] = useState<any>();
  const decision = value?.decision, quote = decision?.quote;
  const choices = Array.isArray(value?.file_context_disposition?.choices) ? value.file_context_disposition.choices : [];
  const withheld = choices.filter((choice: any) => choice.status === 'withheld');
  const amount = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v.toLocaleString() : 'Not recorded';
  return <section aria-label="Decision funding preview">
    <button class="secondary" disabled={busy} onClick={async () => {
      setBusy(true); setError(''); setValue(undefined);
      try {
        const result = (await act('resource.admission.preview', { run })).result as any;
        if (result?.schema !== 'resource-admission-preview/1' || result.run !== run || result.read_only !== true) throw new Error('Unrecognized admission preview.');
        setValue(result);
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>{busy ? 'Checking capacity…' : 'Check next decision funding'}</button>
    {error && <p role="alert">{error}</p>}
    {value && <div role="status"><p>{decision?.prospective_admissible === true ? 'At the last check, the request fit the available capacity.' : 'At the last check, the request could not be admitted.'}{value.runnable === false && ' This participation remains stopped.'}</p>
      {(decision?.blocker || value.execution_blocker || quote?.blocker) && <p>{String(decision?.blocker || value.execution_blocker || quote?.blocker)}</p>}
      {value.ordinary_context && <p>Complete ordinary context: {value.ordinary_context.admissible === true ? 'fits the selected model at this check' : 'not currently admissible'}. {value.ordinary_context.blocker ? String(value.ordinary_context.blocker) : 'This includes mandatory state, full selections, qualifications, observations, history and provider formatting. Funding and pause status are checked separately.'}</p>}
      {value.decision_mode === 'context_maintenance' && value.context_maintenance?.schema === 'restricted-context-repair/1' && <p>Restricted context repair: attempt {amount(value.context_maintenance.attempt)} of {amount(value.context_maintenance.limit)}. This decision can only narrow or clear existing optional choices, request an exact bounded repair read, or stop. It cannot edit character or files, change warnings, or perform task work. {String(value.context_maintenance.selected_bodies)}. Repair uses the existing funding allowance.</p>}
      {value.file_context_disposition && <p>Optional file choices: {choices.length - withheld.length} eligible, {withheld.length} withheld. Stored choices are unchanged; withheld bundles supply no text through selection.</p>}
      {withheld.length > 0 && <ul>{withheld.map((choice: any, index: number) => <li key={index}>{choice.scope === 'fragments' ? 'Characteristic' : 'Supporting'} choice {String(choice.reference?.id)} revision {String(choice.reference?.revision)}: {String(choice.reason)}</li>)}</ul>}
      {quote && <p>{decision.pool === 'closeout' ? 'Protected finishing' : 'Production'} capacity: {amount(quote.input_upper_tokens)} input and {amount(quote.output_upper_tokens)} output tokens required for this request. This preview reserves nothing; these bounds are not measured usage.</p>}
      <FinishingReadiness value={value.finishing}/>
      {value.quotes && <details><summary>Compare ordinary and protected request bounds</summary>{(['production', 'closeout'] as const).map(pool => {
        const q = value.quotes[pool];
        return <p key={pool}>{pool === 'production' ? 'Ordinary production' : 'Protected finishing'}: {amount(q?.tokens)} tokens required by this quote. {q?.blocker ? String(q.blocker) : 'A fitting quote alone does not establish eligibility.'}</p>;
      })}</details>}
      {value.snapshot_changed && <p>State changed during this check. Check again before relying on this observation.</p>}
      <p class="micro">This check makes no model call and reserves no capacity. Context fit does not resume work or guarantee that later observations will fit. Admission checks the latest complete request, authority and funding when a decision starts.</p>
    </div>}
  </section>;
}
