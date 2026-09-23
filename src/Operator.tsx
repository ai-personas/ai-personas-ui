import { useEffect, useRef, useState } from 'preact/hooks';
import { data, label, request, type Entity, type Model } from './api';
import { useRecords, useResource } from './hooks';
import type { Act } from './main';
import Pagination from './Pagination';
import Dialog from './Dialog';
import './operator.css';
import { modelKey, ModelStatus, useModels } from './Models';
import { EditAllowance } from './FundingEditor';
import { MessageComposer } from './Messages';
import { matchesAllowance } from './workspace';
import { ProviderSettings } from './ProviderSettings';
import { FeedbackConditions } from './RecordReader';
import ToolAccess from './ToolAccess';

export function FundingChoice({ value, onChange, required = true }: { value: string; onChange: (id: string) => void; required?: boolean }) {
  const [cursor, setCursor] = useState([0]);
  const { value: page, error } = useRecords('resource_root', '', '', '', cursor.at(-1), 'active');
  return <fieldset><legend>Funding allowance</legend>{error && <p role="alert">{error}</p>}
    <select aria-label="Funding allowance" required={required} value={value} onChange={e => onChange(e.currentTarget.value)}>
      <option value="">{required ? 'Choose an allowance' : 'No allowance (test mode)'}</option>
      {page?.items.map(r => <option value={r.id} key={r.id}>{data(r).reason || r.id.slice(0, 8)}</option>)}
    </select><small>Allowances are shared ceilings. Create one under Funding, then use it for founders and tasks.</small>
    <Pagination previous={cursor.length > 1} next={page?.next} onPrevious={() => setCursor(cursor.slice(0, -1))} onNext={() => page?.next != null && setCursor([...cursor, page.next])}/>
  </fieldset>;
}

const integer = (f: FormData, key: string) => {
  const n = Number(f.get(key));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${key.replaceAll('_', ' ')} must be a non-negative whole number.`);
  return n;
};
const units = (f: FormData, key: string) => {
  const value = String(f.get(key) || '');
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error('Enter a non-negative amount with at most six decimal places.');
  const n = Math.round(Number(value) * 1_000_000);
  if (!Number.isSafeInteger(n)) throw new Error('Amount is too large.');
  return n;
};
function NumberField({ name, title, value, min = 0 }: { name: string; title: string; value: number; min?: number }) {
  return <label>{title}<input name={name} type="number" min={min} step="1" required defaultValue={value}/></label>;
}
function AllowanceForm({ act, close, initial }: { act: Act; close: () => void; initial?: Entity }) {
  const [root, setRoot] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const errorNotice = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorNotice.current?.scrollIntoView({ block: 'nearest' }); }, [error]);
  const modelState = useModels(), models = [...modelState.models, ...(modelState.catalog?.decision_models || [])];
  const [selected, setSelected] = useState(''), [included, setIncluded] = useState(false);
  useEffect(() => { if (!selected && models.length) setSelected(modelKey(models[0])); }, [models, selected]);
  const model = models.find(m => modelKey(m) === selected);
  const subscription = !!model?.capabilities && (model!.capabilities as any).billing === 'chatgpt_subscription';
  const noTokenCharge = subscription && included;
  const d = root ? data(root) : {};
  const [expires] = useState(() => {
    const date = new Date(Date.now() + 7 * 86400000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  return <Dialog label="Create funding allowance" close={close}><form class="operator-form allowance-form" onInvalidCapture={e => {
    const details = (e.target as HTMLElement).closest('details'); if (details) details.open = true;
  }} onSubmit={async e => {
    e.preventDefault(); if (busy) return; const f = new FormData(e.currentTarget); setBusy(true); setError('');
    try {
      if (!model) throw new Error('Choose an available model before creating its funding policy.');
      const reason = String(f.get('reason')).trim();
      const bounds = {
        expires: new Date(String(f.get('expires'))).toISOString(), tokens: integer(f, 'tokens'), closeout_tokens: integer(f, 'closeout_tokens'),
        cost_units: noTokenCharge ? 0 : units(f, 'cost'), closeout_cost_units: noTokenCharge ? 0 : units(f, 'closeout_cost'), currency: String(f.get('currency') || 'USD'),
        prices: [{ provider: model.provider, model: model.id, input_units_per_million: noTokenCharge ? 0 : units(f, 'input_price'), output_units_per_million: noTokenCharge ? 0 : units(f, 'output_price'),
          evidence: noTokenCharge ? `Operator chose included Codex subscription usage with zero marginal token charge on ${new Date().toISOString().slice(0, 10)}. Plan limits still apply.` : String(f.get('price_evidence')).trim() }],
        remote_calls: integer(f, 'remote_calls'), retained_payload_bytes: String(f.get('retained_payload_bytes') || '').trim() ? integer(f, 'retained_payload_bytes') : null, cpu_seconds: integer(f, 'cpu_seconds'),
        effect_operations: integer(f, 'effect_operations'), concurrent_memory_bytes: integer(f, 'concurrent_memory_bytes'), births_per_window: integer(f, 'births_per_window'), birth_window_seconds: integer(f, 'birth_window_seconds'), reason,
      };
      if (!reason) throw new Error('Enter a purpose for this allowance.');
      if (Date.parse(bounds.expires) <= Date.now()) throw new Error('Choose an expiry in the future.');
      if (bounds.closeout_tokens > bounds.tokens || bounds.closeout_cost_units > bounds.cost_units) throw new Error('The finishing reserve must fit within the total allowance.');
      let retained = root;
      if (!retained) {
        const limits = { calls: integer(f, 'calls'), births: integer(f, 'births'), max_depth: integer(f, 'max_depth'), concurrent_calls: integer(f, 'concurrent_calls') };
        const closeout_calls = integer(f, 'closeout_calls');
        if (closeout_calls >= limits.calls) throw new Error('Reserve fewer finishing calls than the total, leaving calls for production.');
        const a = await act('resource.root.create', { limits, closeout_calls, reason });
        retained = a.result as Entity; setRoot(retained);
      }
      await act('resource.bounds.configure', { root: retained.id, revision: retained.revision, bounds }); close();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}><header><div><p class="eyebrow">FUNDING</p><h2>{root ? 'Configure allowance limits' : 'Create funding allowance'}</h2></div><button type="button" class="quiet" onClick={close}>Close form</button></header>
    <div class="form-body"><p class="form-intro">Set a shared allowance for personas and tasks. These are spending and usage limits; creating an allowance does not transfer money.</p>
    {error && <p ref={errorNotice} role="alert">{error}</p>}{root && <p role="status">Allowance retained. Complete its limits before using it.</p>}
    <label>Purpose<input name="reason" required defaultValue={d.reason || ''} placeholder="For example, research for my next project"/></label>
    <fieldset><legend>Model and cost policy</legend>
      <label>Price policy for model<select name="model" required value={selected} disabled={modelState.loading || !models.length} onChange={e => { setSelected(e.currentTarget.value); setIncluded(false); }}>
        {!model && <option value={selected}>{selected ? 'Selected model unavailable — choose another' : 'Choose an available model'}</option>}
        {models.map(m => <option value={modelKey(m)} key={modelKey(m)}>{m.provider} / {m.name || m.id}</option>)}</select></label>
      <ModelStatus {...modelState}/>
      {subscription && <label class="check"><input type="checkbox" checked={included} onChange={e => setIncluded(e.currentTarget.checked)}/>Use included subscription usage, with no per-token charge</label>}
      {noTokenCharge && <p class="provider-notice">Your Codex ChatGPT plan limits still apply. This records your choice of zero marginal token cost; calls and tokens remain limited. It does not purchase credits.</p>}
      <div hidden={noTokenCharge}><div class="operator-grid"><label>Currency<input name="currency" required={!noTokenCharge} defaultValue="USD"/></label><label>Total budget<input type="number" name="cost" min="0" step="0.000001" required disabled={noTokenCharge} defaultValue="10"/></label>
        <label>Budget reserved for finishing<input type="number" name="closeout_cost" min="0" step="0.000001" required disabled={noTokenCharge} defaultValue="2"/></label>
        <label>Input price per million tokens<input type="number" name="input_price" min="0" step="0.000001" required disabled={noTokenCharge}/></label>
        <label>Output price per million tokens<input type="number" name="output_price" min="0" step="0.000001" required disabled={noTokenCharge}/></label></div>
      <label>Price source and date<input name="price_evidence" required disabled={noTokenCharge} placeholder="Provider price page or local cost policy"/></label></div>
    </fieldset>
    <fieldset disabled={!!root}><legend>Calls and personas</legend><div class="operator-grid">
      <NumberField name="calls" title="Total model calls" value={d.limits?.calls ?? 100} min={1}/>
      <NumberField name="closeout_calls" title="Calls reserved for review and finishing" value={d.closeout_calls ?? 20}/>
      <NumberField name="births" title="Maximum new personas, including founders" value={d.limits?.births ?? 4}/>
      <NumberField name="max_depth" title="Maximum descendant depth" value={d.limits?.max_depth ?? 1}/>
      <NumberField name="concurrent_calls" title="Concurrent calls" value={d.limits?.concurrent_calls ?? 2} min={1}/>
    </div></fieldset>
    <fieldset><legend>Tokens and expiry</legend><div class="operator-grid">
      <NumberField name="tokens" title="Total tokens" value={5_000_000}/><NumberField name="closeout_tokens" title="Tokens reserved for finishing" value={1_000_000}/>
    </div>{subscription && <p class="micro">Codex reserves a full model context window for output before each call, plus input. Measured usage settles the reservation; interrupted calls remain accounted for.</p>}
      <label>Allowance expires<input type="datetime-local" name="expires" required defaultValue={expires}/></label>
    </fieldset>
    <details><summary>Execution and growth limits</summary><p class="micro">Funding grants no permission for host or external effects.</p><div class="operator-grid">
      <NumberField name="remote_calls" title="Maximum remote calls" value={100} min={1}/><label>Optional content storage allowance (bytes)<input name="retained_payload_bytes" type="number" min="0" step="1" placeholder="No ceiling"/><small>Leave blank for no ceiling. Model requests, responses, and logs are not archived.</small></label>
      <NumberField name="cpu_seconds" title="Execution CPU seconds" value={600}/><NumberField name="concurrent_memory_bytes" title="Concurrent execution memory bytes" value={268435456}/>
      <NumberField name="effect_operations" title="Tool and external operations" value={0}/><NumberField name="births_per_window" title="New personas per rate window" value={4} min={1}/><NumberField name="birth_window_seconds" title="Rate window seconds" value={3600} min={1}/>
    </div></details></div><footer class="form-actions"><p class="micro">Limits are shared by every task and persona using this allowance.</p><button disabled={busy || !model || modelState.loading}>{busy ? 'Saving…' : root ? 'Save limits' : 'Create allowance'}</button></footer>
  </form></Dialog>;
}

export function AllowanceSummary({ id, act }: { id: string; act?: Act }) {
  const { value, error } = useResource<any>('/resources/' + id, e => matchesAllowance(e, id));
  return <section aria-label="Allowance usage">{error && <p role="alert">{error}</p>}{value ? <>
    <div class="operator-grid"><p><strong>{value.calls.production_remaining}</strong> production calls remaining</p><p><strong>{value.calls.closeout_remaining}</strong> finishing calls remaining</p><p><strong>{value.calls.uncertain}</strong> calls with uncertain usage</p></div>
    <p class="micro">{value.calls.consumed ?? 0} consumed · {value.calls.reserved ?? 0} running reservations · {value.calls.initialization_reserved ?? 0} reserved for persona initialization. Total call limit: {value.limits?.calls ?? 'not reported'}.</p>
    <p class="micro">The total includes {value.closeout_calls ?? 0} calls reserved for review and finishing. Increasing the total does not make those protected calls available for production.</p>
    {value.calls.production_remaining === 0 && <p class="notice">Production calls are exhausted. A persona's unused initialization reservation can fund its first call; further decisions need more production capacity. Finishing calls remain protected until explicitly reassigned.</p>}
    {value.exposure?.bounds && <p class="micro">{value.exposure.accounted?.tokens?.toLocaleString() ?? 'Unknown'} accounted tokens of {value.exposure.bounds.tokens?.toLocaleString()} · expires {value.exposure.bounds.expires}. All tasks and personas sharing this allowance draw from these limits.</p>}
    {value.exposure?.accounting_status === 'unavailable' && <p role="alert">Accounting is incomplete. Inspect retained charge evidence before changing limits.</p>}
    {act && value.status === 'active' && value.exposure?.bounds && <EditAllowance id={id} act={act}/>}
    <details><summary>Limits, reservations, and measured usage</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
  </> : !error && <p role="status">Loading allowance…</p>}</section>;
}
export function Funding({ act }: { act: Act }) {
  const [tab, setTab] = useState('allowances');
  return <section><header class="page-heading"><div><h1>Funding</h1><p>Manage shared allowances and provider connections.</p></div></header>
    <div class="workspace-tabs" role="tablist" aria-label="Funding sections" onKeyDown={e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); const next = e.key === 'Home' ? 'allowances' : e.key === 'End' ? 'settings' : tab === 'allowances' ? 'settings' : 'allowances';
      setTab(next); document.getElementById('funding-tab-' + next)?.focus();
    }}>{['allowances', 'settings'].map(value => <button key={value} id={'funding-tab-' + value} role="tab" aria-selected={tab === value} aria-controls={'funding-panel-' + value} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)}>{value === 'allowances' ? 'Allowances' : 'Settings'}</button>)}</div>
    <div id={'funding-panel-' + tab} role="tabpanel" aria-labelledby={'funding-tab-' + tab}>
      {tab === 'settings' ? <ProviderSettings/> : <Allowances act={act}/>}
    </div></section>;
}
function Allowances({ act }: { act: Act }) {
  const [create, setCreate] = useState(false), [configure, setConfigure] = useState<Entity>(), [cursor, setCursor] = useState([0]);
  const { value: page, error } = useRecords('resource_root', '', '', '', cursor.at(-1));
  return <section><header class="page-heading"><div><h2>Allowances</h2><p>Shared capacity for founders, tasks, review, and finishing.</p></div><button onClick={() => setCreate(true)}>New allowance</button></header>
    {error && <p role="alert">{error}</p>}{page?.items.length === 0 && <p>No funding allowances yet. Create one before starting personas and tasks on a restricted node.</p>}
    {page?.items.map(r => <article key={r.id} class="operator-card"><h2>{data(r).reason || 'Funding allowance'}</h2><p>{data(r).status} · {r.id.slice(0, 8)}</p><AllowanceSummary id={r.id} act={act}/>{!data(r).bounds_configured && <button onClick={() => setConfigure(r)}>Configure limits</button>}</article>)}
    <Pagination previous={cursor.length > 1} next={page?.next} onPrevious={() => setCursor(cursor.slice(0, -1))} onNext={() => page?.next != null && setCursor([...cursor, page.next])}/>
    {(create || configure) && <AllowanceForm initial={configure} act={act} close={() => { setCreate(false); setConfigure(undefined); }}/>}</section>;
}

export function initialMandate(brief: string, criterion: string) {
  return { clarifications: [], constraints: [], preferences: [], unresolved_inputs: [], outcomes: [{ key: 'result', description: brief, criterion, required: true, evidence: 'user_judgment', conditional_allowed: false, outside_validation_required: false }], completion_agreement: 'User acceptance of the requested result', assembly_editors: [], non_contributor_review: false, scope_coverage_review_required: false };
}
export function CurrentMandate({ id, open }: { id: string; open: (id: string) => void }) {
  const { value, error } = useResource<Entity>('/records/' + id);
  const m = value ? data(value).mandate : undefined;
  return <section class="workspace-section"><h2>Current scope</h2>{error && <p role="alert">{error}</p>}{m && <>
    {m.clarifications?.map((s: string, i: number) => <p key={i}>{s}</p>)}
    <ul>{m.outcomes?.map((o: any) => <li key={o.key}><strong>{o.description}</strong><p>{o.criterion} · {o.required ? 'Required' : 'Optional'} · {o.evidence === 'reviewed' ? 'Reviewed evidence' : 'User judgment'}</p></li>)}</ul>
    {m.constraints?.length > 0 && <><h3>Constraints</h3><ul>{m.constraints.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></>}
    <button class="text-button" onClick={() => open(id)}>Inspect adopted scope and history</button>
  </>}</section>;
}
export function WorkState({ value, open }: { value: any; open: (id: string) => void }) {
  return <section class="workspace-section" aria-label="Current obligations"><h2>Current obligations</h2>
    {!value && <p>No current scope projection was supplied. Inspect the exact work record.</p>}
    {value?.binding === 'not_adopted' && <p>No scope has been adopted. Use Amend task to record the required results.</p>}
    {value?.binding === 'adopted' && <><p>Continuation: <strong>{value.continuation.status.replaceAll('_', ' ')}</strong></p>
      {value.continuation.owners.map((owner: string) => <button key={owner} class="text-button" onClick={() => open(owner)}>Inspect continuation owner {owner.slice(0, 8)}</button>)}
      <ul>{value.coverage.outcomes.map((o: any) => <li key={o.key}><strong>{o.key}</strong> · {o.required ? 'Required' : 'Optional'} · {o.unowned ? 'No accepted owner' : 'Accepted owner recorded'} · Evidence: {o.evidence.replaceAll('_', ' ')} · Outside validation: {o.outside_validation.replaceAll('_', ' ')}</li>)}</ul>
      <p>{value.coverage.meaning}</p>
      <p>Scope review: {value.coverage.scope_review_current ? 'Current review recorded' : value.coverage.scope_review_required ? 'Required, not yet current' : 'Not required by this scope'}</p>
      <p>Acceptance: {value.acceptance ? `${value.acceptance.disposition.replaceAll('_', ' ')} · ${value.acceptance.applicability}` : 'Not established'}</p>
      {value.acceptance?.release?.id && <button class="text-button" onClick={() => open(value.acceptance.release.id)}>Inspect exact release</button>}
      {value.blocking_feedback.length > 0 && <p>{value.blocking_feedback.length} unresolved blocking feedback records</p>}
      <FeedbackConditions value={value} open={open}/>
    </>}
  </section>;
}
function editedMandate(mandate: any, form: FormData) {
  const lines = (name: string) => String(form.get(name) || '').split('\n').map(s => s.trim()).filter(Boolean);
  return { ...mandate,
    ...Object.fromEntries(['clarifications', 'constraints', 'preferences', 'unresolved_inputs'].map(key => [key, lines(key)])),
    completion_agreement: String(form.get('completion_agreement') || ''),
    non_contributor_review: form.has('non_contributor_review'), scope_coverage_review_required: form.has('scope_coverage_review_required'),
    outcomes: mandate.outcomes.map((o: any) => ({ ...o,
      ...Object.fromEntries(['description', 'criterion', 'evidence'].map(key => [key, String(form.get(`outcome.${o.key}.${key}`) || '')])),
      ...Object.fromEntries(['required', 'conditional_allowed', 'outside_validation_required'].map(key => [key, form.has(`outcome.${o.key}.${key}`)])),
    })),
  };
}
function Amend({ work, act, close }: { work: Entity; act: Act; close: () => void }) {
  // Keep the edited mandate and its revision from the same opening snapshot.
  // An event refresh must not silently bless an old form with a newer revision.
  const [base] = useState(work);
  const form = useRef<HTMLFormElement>(null);
  const [mandate, setMandate] = useState<any>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { const c = new AbortController(), ref = data(base).mandate?.id;
    if (ref) request<Entity>('/records/' + ref, { signal: c.signal }).then(r => setMandate(data(r).mandate)).catch(e => !c.signal.aborted && setError(e.message));
    else setMandate(initialMandate(data(base).brief || '', 'Meets the request and stated constraints'));
    return () => c.abort();
  }, [base.id]);
  return <Dialog label="Amend task" close={close}><form class="operator-form" ref={form} onSubmit={async e => { e.preventDefault(); if (busy || !mandate) return; const f = new FormData(e.currentTarget); setBusy(true); setError('');
    try { await act('work.amend', { work: base.id, revision: base.revision, title: String(f.get('title')), mandate: editedMandate(mandate, f) }); close(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}><header><h2>Amend task</h2><button type="button" class="quiet" onClick={close}>Close form</button></header><p>Adopt a new scope. The original request and earlier decisions remain in history.</p>
    {error && <p role="alert">{error}</p>}{work.revision !== base.revision && <p role="alert">This task changed while you were editing. Close and reopen the form to review the current scope.</p>}<label>Title<input name="title" required defaultValue={data(base).title}/></label>
    {mandate && <><label>Clarifications and updated instructions<textarea rows={4} name="clarifications" defaultValue={mandate.clarifications.join('\n')}/></label>
      {mandate.outcomes.map((o: any, index: number) => <fieldset key={o.key}><legend>Outcome {index + 1}</legend>
        <label>Expected result<textarea required name={`outcome.${o.key}.description`} defaultValue={o.description}/></label>
        <label>Acceptance criterion<input required name={`outcome.${o.key}.criterion`} defaultValue={o.criterion}/></label>
        <label>Evidence<select aria-label="Evidence" name={`outcome.${o.key}.evidence`} defaultValue={o.evidence}><option value="user_judgment">User judgment</option><option value="reviewed">Reviewed evidence</option></select></label>
        {(['required', 'conditional_allowed', 'outside_validation_required'] as const).map(key => <label class="check" key={key}><input type="checkbox" name={`outcome.${o.key}.${key}`} defaultChecked={o[key]}/>{key.replaceAll('_', ' ')}</label>)}
        <button type="button" class="quiet" disabled={mandate.outcomes.length <= 1} onClick={() => { const current = editedMandate(mandate, new FormData(form.current!)); setMandate({ ...current, outcomes: current.outcomes.filter((_: any, i: number) => i !== index) }); }}>Remove outcome</button>
      </fieldset>)}<button type="button" class="secondary" onClick={() => { const current = editedMandate(mandate, new FormData(form.current!)); setMandate({ ...current, outcomes: [...current.outcomes, { ...initialMandate('', '').outcomes[0], key: crypto.randomUUID() }] }); }}>Add outcome</button>
      {(['constraints', 'preferences', 'unresolved_inputs'] as const).map(key => <label key={key}>{key.replaceAll('_', ' ')}<textarea name={key} defaultValue={mandate[key].join('\n')}/></label>)}
      <label>Completion agreement<input required name="completion_agreement" defaultValue={mandate.completion_agreement}/></label>
      {(['non_contributor_review', 'scope_coverage_review_required'] as const).map(key => <label class="check" key={key}><input type="checkbox" name={key} defaultChecked={mandate[key]}/>{key.replaceAll('_', ' ')}</label>)}
    </>}<button disabled={busy || !mandate || work.revision !== base.revision}>{busy ? 'Saving…' : 'Adopt amendment'}</button></form></Dialog>;
}

export function WorkControls({ work, act, open }: { work: Entity; act: Act; open: (id: string) => void }) {
  const [mode, setMode] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [root, setRoot] = useState('');
  const d = data(work), archived = d.status === 'archived';
  return <section class="operator-controls" aria-label="Task controls"><div class="button-row">
    {!archived && <><button class="secondary" onClick={() => setMode('amend')}>Amend task</button><button class="secondary" onClick={() => setMode(mode === 'fund' ? '' : 'fund')}>Funding</button><button class="secondary" onClick={() => setMode('tools')}>Tool access</button><button class="secondary" onClick={() => setMode(mode === 'message' ? '' : 'message')}>Message participants</button><button class="quiet" onClick={() => setMode('archive')}>Archive task</button></>}
    {archived && <p role="status">Archived. Participation was cancelled; historical results, spending, and late effects remain inspectable. Open a document, artifact, or message to erase a selected payload.</p>}
  </div>{error && <p role="alert">{error}</p>}
    {mode === 'amend' && <Amend work={work} act={act} close={() => setMode('')}/>}
    {mode === 'tools' && <ToolAccess work={work} act={act} open={open} close={() => setMode('')}/>}
    {mode === 'fund' && (d.resource_root ? <AllowanceSummary id={d.resource_root} act={act}/> : <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await act('resource.bind', { work: work.id, revision: work.revision, root, reason: String(new FormData(e.currentTarget).get('reason')) }); setMode(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><FundingChoice value={root} onChange={setRoot}/><label>Funding reason<input name="reason" required/></label><button disabled={busy}>Fund task</button></form>)}
    {mode === 'message' && <MessageComposer to={d.environment} environment={d.environment} work={work.id} act={act} open={open}/>}
    {mode === 'archive' && <Dialog label="Archive task" close={() => setMode('')}><form class="operator-form" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await act('work.archive', { work: work.id, revision: work.revision, reason: String(new FormData(e.currentTarget).get('reason')) }); setMode(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><h2>Archive {label(work)}</h2><p>This cancels task participation and outstanding responsibilities, requests stopping of tracked jobs, and removes the task from the current list. Completed effects and accounting remain recorded.</p><label>Reason<textarea name="reason" required/></label>{error && <p role="alert">{error}</p>}<button disabled={busy}>Cancel participation and archive</button><button type="button" class="quiet" onClick={() => setMode('')}>Keep task</button></form></Dialog>}
    {d.resource_root && <button class="text-button" onClick={() => open(d.resource_root)}>Inspect funding record</button>}
  </section>;
}

export function ErasePayload({ record, act }: { record: Entity; act: Act }) {
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (data(record).erased) return <p role="status">Payload erased. Minimal provenance and accountability remain.</p>;
  return <section class="retention-control"><button class="quiet" onClick={() => setShow(!show)}>Erase this payload…</button>{show && <form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await act('information.erase', { subject: record.id, revision: record.revision, reason: String(new FormData(e.currentTarget).get('reason')) }); setShow(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
    <p>Erase this {record.kind} payload and identified local copies. Its identity and minimal accounting remain. External copies and backups require their own retention action.</p><label>Erasure reason<input name="reason" required/></label><label class="check"><input type="checkbox" required/>I understand this payload cannot be restored here.</label>{error && <p role="alert">{error}</p>}<button disabled={busy}>Erase selected payload</button>
  </form>}</section>;
}
