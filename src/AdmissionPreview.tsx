import { useState } from 'preact/hooks';
import type { Act } from './main';
import FinishingReadiness from './FinishingReadiness';

/** Explicit read-only native quote; viewing it never starts a decision. */
export default function AdmissionPreview({ run, act }: { run: string; act: Act }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [value, setValue] = useState<any>();
  const decision = value?.decision, quote = decision?.quote;
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
      {quote && <p>{decision.pool === 'closeout' ? 'Protected finishing' : 'Production'} capacity: {amount(quote.input_upper_tokens)} input and {amount(quote.output_upper_tokens)} output tokens required for this request. This preview reserves nothing; these bounds are not measured usage.</p>}
      <FinishingReadiness value={value.finishing}/>
      {value.quotes && <details><summary>Compare ordinary and protected request bounds</summary>{(['production', 'closeout'] as const).map(pool => {
        const q = value.quotes[pool];
        return <p key={pool}>{pool === 'production' ? 'Ordinary production' : 'Protected finishing'}: {amount(q?.tokens)} tokens required by this quote. {q?.blocker ? String(q.blocker) : 'A fitting quote alone does not establish eligibility.'}</p>;
      })}</details>}
      {value.snapshot_changed && <p>State changed during this check. Check again before relying on this observation.</p>}
      <p class="micro">This check makes no model call and reserves no capacity. Optional selector evaluation and its added context are excluded. Admission checks the latest request and funding when a decision starts.</p>
    </div>}
  </section>;
}
