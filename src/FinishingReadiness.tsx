import { finishingView } from './presentation';
import { fields } from './workspace';

/** A recorded prerequisite snapshot, never a live quote or a resume control. */
export default function FinishingReadiness({ value }: { value: unknown }) {
  const v = finishingView(value);
  if (!v) return null;
  const count = (n: number | null) => n === null ? 'Not recorded' : n.toLocaleString();
  const headroom = fields(fields(value).headroom);
  const remaining = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n.toLocaleString() : 'Not recorded';
  return <section class="notice" aria-label="Protected finishing prerequisites">
    <p><strong>Protected finishing prerequisites at this check</strong></p>
    {v.error ? <p role="alert">The prerequisite check was unavailable: {v.error}</p> : <>
      <p>Automatic use: {v.preauthorized === null ? 'not recorded' : v.preauthorized ? 'preauthorized' : 'not preauthorized'}. Current accepted responsibility: {v.responsibility ? 'recorded for this persona and mandate' : 'not recorded'}.</p>
      <p>Closed calls retaining unknown billing: {count(v.billingOnly)}. Unresolved charge records: {count(v.unresolvedCharges)}. Unresolved actions: {count(v.unresolvedActions)}.</p>
      {Object.keys(headroom).length > 0 && <p>Ordinary capacity remaining: {remaining(fields(headroom.production).tokens)} tokens and {remaining(fields(headroom.production).calls)} calls. Protected capacity remaining: {remaining(fields(headroom.closeout).tokens)} tokens and {remaining(fields(headroom.closeout).calls)} calls. Remote capacity remaining: {remaining(fields(headroom.remote).remaining)} calls.</p>}
      {v.blockers?.map(b => <p key={b.code}>{b.detail}</p>)}
      {v.blockers === null && <p>Independent blockers were not reported.</p>}
    </>}
    <p class="micro">Unknown billing stays conservatively charged, including remote capacity. These prerequisites do not establish affordable admission or completion. A reserve, membership, submission, amendment or resume does not create consent; new terms require explicit acceptance. Check next decision funding for a current quote.</p>
  </section>;
}
