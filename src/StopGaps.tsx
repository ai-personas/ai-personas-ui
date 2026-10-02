import { fields, text } from './workspace';

/** Current recorded work gaps accompany the persona's stop without a verdict. */
export default function StopGaps({ value }: { value: unknown }) {
  const v = fields(value);
  if (v.schema !== 'stop-context/1') return null;
  const gaps = fields(v.delivery_gaps);
  const uncovered = Array.isArray(gaps.uncovered_outcomes) ? gaps.uncovered_outcomes.map(item => text(item)).filter(Boolean) : null;
  const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : 'not reported';
  return <section class="notice" aria-label="Current recorded gaps">
    <p><strong>Current recorded gaps</strong></p>
    {v.binding !== 'adopted' && <p>An adopted scope is not recorded; delivery coverage is unavailable.</p>}
    {gaps.adopted_candidate_missing === true && <p>No candidate is currently adopted.</p>}
    {uncovered !== null && <p>Required outcomes without current evidence: {uncovered.length ? uncovered.join(', ') : 'none recorded'}.</p>}
    {v.binding === 'adopted' && <p>Blocking findings: {count(gaps.blocking_findings)}. Stale checks: {count(gaps.stale_checks)}.</p>}
    <p>Open questions: {Array.isArray(v.pending_requests) ? v.pending_requests.length : 'not reported'}. Responsibilities needing a handoff: {Array.isArray(v.handoff_gaps) ? v.handoff_gaps.length : 'not reported'}.</p>
    {Array.isArray(v.sharing_restrictions) && v.sharing_restrictions.length > 0 && <p>{v.sharing_restrictions.length} retained contributions have current peer access restrictions. Their source owners choose what can be shared.</p>}
    <p class="micro">These current records accompany the persona’s stop. They do not establish result quality or completion, and do not resume participation.</p>
  </section>;
}
