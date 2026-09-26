import { useResource } from './hooks';
import { fields, isRecordID, text } from './workspace';
import { timestamp } from './identity';

/** Observed component state, separate from outcome quality or future admission. */
export default function WorkReadiness({ work, open }: { work: string; open: (id: string) => void }) {
  const { value, error, loading, retry } = useResource<Record<string, unknown>>(`/work/${work}/readiness`, e => ['run', 'call', 'persona', 'recall_policy', 'information_policy', 'work', 'resource_root', 'budget_charge', 'memory_node', 'action'].includes(e.kind));
  const people = Array.isArray(value?.participants) ? value.participants.map(fields) : [];
  const budget = fields(value?.jev_budget), funding = fields(value?.funding), tokens = fields(funding.observed_tokens);
  const amount = (n: unknown) => typeof n === 'number' ? `$${(n / 1_000_000).toFixed(6)}` : 'Not available';
  return <section class="workspace-section" aria-label="Component status" aria-busy={loading}>
    <header class="section-heading"><div><h2>Component status</h2><p>Current configuration and recorded activity. A configured component or selected fragment does not establish useful work.</p></div><button class="text-button" onClick={retry}>Refresh component status</button></header>
    {error && <p role="alert">Component status could not be refreshed. Displayed observations may be stale.</p>}
    {!value && !error && <p role="status">Reading component status…</p>}
    {value && <>
      <p class="micro">Observed {timestamp(text(value.observed))}. Funding: {text(funding.binding, 'Not reported')}. {typeof tokens.input === 'number' && typeof tokens.output === 'number' && `Measured ${tokens.input.toLocaleString()} input + ${tokens.output.toLocaleString()} output tokens.`}</p>
      <p>JEV node limit: <strong>{amount(budget.limit_micro_usd)}</strong> · Accounted: {amount(budget.accounted_micro_usd)} · Remaining: {amount(budget.remaining_micro_usd)}</p>
      {Boolean(budget.error) && <p role="alert">JEV spending could not be verified.</p>}
      <div class="work-records">{people.map(p => {
        const latest = fields(p.last_selector), selected = fields(latest.result), delegation = fields(p.delegation);
        const selector = p.selector_policy === 'enabled' ? (delegation.semantic === true && p.delegation_current === true ? 'Enabled; current persona semantic delegation' : delegation.semantic === true ? 'Enabled; persona delegation expired or unverified' : 'Enabled; awaiting persona semantic delegation') : p.selector_policy === 'expired' ? 'Expired for this work' : 'Disabled for this work';
        return <article class="work-record" key={text(p.run)}>
          <h3>{text(p.name, 'Unnamed persona')}</h3>
          <p>{text(p.model, 'No model recorded')} · {p.model_discovered ? 'Model discovered' : p.provider_configured ? 'Model availability not confirmed' : 'Provider unavailable'} · {text(p.status).replaceAll('_', ' ')}</p>
          <p>Character: {p.character_ready ? 'Ready' : text(p.character_initialization, 'Pending')} · Avatar: {text(p.avatar, p.character_ready ? 'Not requested' : 'Waiting for character').replaceAll('_', ' ')}</p>
          <p>{typeof p.self_fragments === 'number' ? p.self_fragments : 'Unknown'} current self fragments · {typeof p.retained_fragments === 'number' ? p.retained_fragments : 'Unknown'} retained fragments</p>
          <p>Recall selector: <strong>{selector}</strong></p>
          {p.selector_policy === 'enabled' && <p>Original task source: {p.work_export_allowed === true ? 'May be exported; processing permission also required' : 'Export not permitted; excluded from selector context'}</p>}
          <p>Last observed recall: {text(selected.status, 'No decision recorded').replaceAll('_', ' ')}{isRecordID(latest.call) && <> · <button class="text-button" onClick={() => open(latest.call as string)}>Inspect recall receipt</button></>}</p>
          <p>{typeof p.publications === 'number' ? p.publications : 'Unknown'} published versions · {typeof p.submissions === 'number' ? p.submissions : 'Unknown'} submissions. Publication and activity do not establish completion.</p>
          {isRecordID(p.run) && <button class="text-button" onClick={() => open(p.run as string)}>Participation and recall settings</button>}
        </article>;
      })}</div>
      {!people.length && <p>No participations recorded.</p>}
      {value.truncated === true && <p class="notice">Showing the first 64 participations. Open People & agreements for further records.</p>}
    </>}
  </section>;
}
