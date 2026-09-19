import { useEffect, useState } from 'preact/hooks';
import { data, label, request, type Entity, type Model } from './api';
import { useRecords, useResource } from './hooks';
import { Pagination, type Act } from './main';
import Dialog from './Dialog';
import './operator.css';

export function FundingChoice({ value, onChange, required = true }: { value: string; onChange: (id: string) => void; required?: boolean }) {
  const [cursor, setCursor] = useState([0]);
  const { value: page, error } = useRecords('resource_root', '', '', '', cursor.at(-1), 'active');
  return <fieldset><legend>Funding allowance</legend>{error && <p role="alert">{error}</p>}
    <select aria-label="Funding allowance" required={required} value={value} onChange={e => onChange(e.currentTarget.value)}>
      <option value="">{required ? 'Choose an allowance' : 'No allowance (compatibility mode)'}</option>
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
  const [root, setRoot] = useState(initial), [models, setModels] = useState<Model[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { const c = new AbortController(); request<Model[]>('/models', { signal: c.signal }).then(setModels).catch(e => !c.signal.aborted && setError(e.message)); return () => c.abort(); }, []);
  const d = root ? data(root) : {};
  return <Dialog label="Create funding allowance" close={close}><form class="operator-form" onSubmit={async e => {
    e.preventDefault(); if (busy) return; const f = new FormData(e.currentTarget); setBusy(true); setError('');
    try {
      const model = models[Number(f.get('model'))]; if (!model) throw new Error('Configure an inference provider before creating its funding policy.');
      const reason = String(f.get('reason'));
      let retained = root;
      if (!retained) {
        const a = await act('resource.root.create', { limits: { calls: integer(f, 'calls'), births: integer(f, 'births'), max_depth: integer(f, 'max_depth'), concurrent_calls: integer(f, 'concurrent_calls') }, closeout_calls: integer(f, 'closeout_calls'), reason });
        retained = a.result as Entity; setRoot(retained);
      }
      await act('resource.bounds.configure', { root: retained.id, revision: retained.revision, bounds: {
        expires: new Date(String(f.get('expires'))).toISOString(), tokens: integer(f, 'tokens'), closeout_tokens: integer(f, 'closeout_tokens'),
        cost_units: units(f, 'cost'), closeout_cost_units: units(f, 'closeout_cost'), currency: String(f.get('currency')),
        prices: [{ provider: model.provider, model: model.id, input_units_per_million: units(f, 'input_price'), output_units_per_million: units(f, 'output_price'), evidence: String(f.get('price_evidence')) }],
        remote_calls: integer(f, 'remote_calls'), retained_payload_bytes: integer(f, 'retained_payload_bytes'), cpu_seconds: integer(f, 'cpu_seconds'),
        effect_operations: integer(f, 'effect_operations'), concurrent_memory_bytes: integer(f, 'concurrent_memory_bytes'), births_per_window: integer(f, 'births_per_window'), birth_window_seconds: integer(f, 'birth_window_seconds'), reason,
      } }); close();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}><header><h2>{root ? 'Configure allowance limits' : 'Create funding allowance'}</h2><button type="button" class="quiet" onClick={close}>Close form</button></header>
    <p>Authorize a finite amount of model activity. Your provider bills actual usage; this does not transfer money.</p>
    {error && <p role="alert">{error}</p>}{root && <p role="status">Allowance retained. Complete its limits before using it.</p>}
    <label>Purpose<input name="reason" required defaultValue={d.reason || ''}/></label>
    <fieldset disabled={!!root}><legend>Calls and personas</legend><div class="operator-grid">
      <NumberField name="calls" title="Total model calls" value={d.limits?.calls ?? 100} min={1}/>
      <NumberField name="closeout_calls" title="Calls reserved for review and finishing" value={d.closeout_calls ?? 20}/>
      <NumberField name="births" title="Maximum new personas, including founders" value={d.limits?.births ?? 4}/>
      <NumberField name="max_depth" title="Maximum descendant depth" value={d.limits?.max_depth ?? 1}/>
      <NumberField name="concurrent_calls" title="Concurrent calls" value={d.limits?.concurrent_calls ?? 2} min={1}/>
    </div></fieldset>
    <label>Price policy for model<select name="model" required>{models.map((m, i) => <option value={i} key={m.provider + m.id}>{m.provider} / {m.name || m.id}</option>)}</select></label>
    {!models.length && <p class="notice">No models are configured. Supply an HTTP provider configuration when starting the node; see the README setup instructions.</p>}
    <div class="operator-grid"><label>Currency<input name="currency" required defaultValue="USD"/></label><label>Total budget<input type="number" name="cost" min="0" step="0.000001" required defaultValue="10"/></label>
      <label>Budget reserved for finishing<input type="number" name="closeout_cost" min="0" step="0.000001" required defaultValue="2"/></label>
      <label>Input price per million tokens<input type="number" name="input_price" min="0" step="0.000001" required/></label>
      <label>Output price per million tokens<input type="number" name="output_price" min="0" step="0.000001" required/></label></div>
    <label>Price source and date<input name="price_evidence" required placeholder="Provider price page or local model cost policy"/></label>
    <label>Allowance expires<input type="datetime-local" name="expires" required defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16)}/></label>
    <details><summary>Token and execution limits</summary><p>Review these finite limits before creating the allowance. A funding policy grants no permission for host or external effects.</p><div class="operator-grid">
      <NumberField name="tokens" title="Total tokens" value={1_000_000}/><NumberField name="closeout_tokens" title="Tokens reserved for finishing" value={200_000}/>
      <NumberField name="remote_calls" title="Maximum remote calls" value={100} min={1}/><NumberField name="retained_payload_bytes" title="Retained payload bytes" value={268435456}/>
      <NumberField name="cpu_seconds" title="Execution CPU seconds" value={600}/><NumberField name="concurrent_memory_bytes" title="Concurrent execution memory bytes" value={268435456}/>
      <NumberField name="effect_operations" title="External effect operations" value={0}/><NumberField name="births_per_window" title="New personas per rate window" value={4} min={1}/><NumberField name="birth_window_seconds" title="Rate window seconds" value={3600} min={1}/>
    </div></details><button disabled={busy || !models.length}>{busy ? 'Saving…' : root ? 'Save limits' : 'Create allowance'}</button>
  </form></Dialog>;
}

export function AllowanceSummary({ id }: { id: string }) {
  const { value, error } = useResource<any>('/resources/' + id);
  return <section aria-label="Allowance usage">{error && <p role="alert">{error}</p>}{value ? <>
    <div class="operator-grid"><p><strong>{value.calls.production_remaining}</strong> production calls remaining</p><p><strong>{value.calls.closeout_remaining}</strong> finishing calls remaining</p><p><strong>{value.calls.uncertain}</strong> calls with uncertain usage</p></div>
    <details><summary>Limits, reservations, and measured usage</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
  </> : !error && <p role="status">Loading allowance…</p>}</section>;
}
export function Funding({ act }: { act: Act }) {
  const [create, setCreate] = useState(false), [configure, setConfigure] = useState<Entity>(), [cursor, setCursor] = useState([0]);
  const { value: page, error } = useRecords('resource_root', '', '', '', cursor.at(-1));
  return <section><header class="page-heading"><div><h1>Funding</h1><p>Shared allowances for founders, tasks, review, and finishing.</p></div><button onClick={() => setCreate(true)}>New allowance</button></header>
    {error && <p role="alert">{error}</p>}{page?.items.length === 0 && <p>No funding allowances yet. Create one before starting personas and tasks on a restricted node.</p>}
    {page?.items.map(r => <article key={r.id} class="operator-card"><h2>{data(r).reason || 'Funding allowance'}</h2><p>{data(r).status} · {r.id.slice(0, 8)}</p><AllowanceSummary id={r.id}/>{!data(r).bounds_configured && <button onClick={() => setConfigure(r)}>Configure limits</button>}</article>)}
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
    {value?.binding === 'legacy_unbound' && <p>No scope has been adopted. Use Amend task to record the required results.</p>}
    {value?.binding === 'adopted' && <><p>Continuation: <strong>{value.continuation.status.replaceAll('_', ' ')}</strong></p>
      {value.continuation.owners.map((owner: string) => <button key={owner} class="text-button" onClick={() => open(owner)}>Inspect continuation owner {owner.slice(0, 8)}</button>)}
      <ul>{value.coverage.outcomes.map((o: any) => <li key={o.key}><strong>{o.key}</strong> · {o.required ? 'Required' : 'Optional'} · {o.unowned ? 'No accepted owner' : 'Accepted owner recorded'} · Evidence: {o.evidence.replaceAll('_', ' ')} · Outside validation: {o.outside_validation.replaceAll('_', ' ')}</li>)}</ul>
      <p>{value.coverage.meaning}</p>
      <p>Scope review: {value.coverage.scope_review_current ? 'Current review recorded' : value.coverage.scope_review_required ? 'Required, not yet current' : 'Not required by this scope'}</p>
      <p>Acceptance: {value.acceptance ? `${value.acceptance.disposition.replaceAll('_', ' ')} · ${value.acceptance.applicability}` : 'Not established'}</p>
      {value.acceptance?.release?.id && <button class="text-button" onClick={() => open(value.acceptance.release.id)}>Inspect exact release</button>}
      {value.blocking_feedback.length > 0 && <p>{value.blocking_feedback.length} unresolved blocking feedback records</p>}
    </>}
  </section>;
}
function Amend({ work, act, close }: { work: Entity; act: Act; close: () => void }) {
  // Keep the edited mandate and its revision from the same opening snapshot.
  // An event refresh must not silently bless an old form with a newer revision.
  const [base] = useState(work);
  const [mandate, setMandate] = useState<any>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { const c = new AbortController(), ref = data(base).mandate?.id;
    if (ref) request<Entity>('/records/' + ref, { signal: c.signal }).then(r => setMandate(data(r).mandate)).catch(e => !c.signal.aborted && setError(e.message));
    else setMandate(initialMandate(data(base).brief || '', 'Meets the request and stated constraints'));
    return () => c.abort();
  }, [base.id]);
  return <Dialog label="Amend task" close={close}><form class="operator-form" onSubmit={async e => { e.preventDefault(); if (busy || !mandate) return; const f = new FormData(e.currentTarget); setBusy(true); setError('');
    try { await act('work.amend', { work: base.id, revision: base.revision, title: String(f.get('title')), mandate: { ...mandate, ...Object.fromEntries(['clarifications', 'constraints', 'preferences', 'unresolved_inputs'].map(k => [k, (mandate[k] || []).map((x: string) => x.trim()).filter(Boolean)])) } }); close(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}><header><h2>Amend task</h2><button type="button" class="quiet" onClick={close}>Close form</button></header><p>Adopt a new scope. The original request and earlier decisions remain in history.</p>
    {error && <p role="alert">{error}</p>}{work.revision !== base.revision && <p role="alert">This task changed while you were editing. Close and reopen the form to review the current scope.</p>}<label>Title<input name="title" required defaultValue={data(base).title}/></label>
    {mandate && <><label>Clarifications and updated instructions<textarea rows={4} value={mandate.clarifications.join('\n')} onInput={e => setMandate({ ...mandate, clarifications: e.currentTarget.value.split('\n') })}/></label>
      {mandate.outcomes.map((o: any, index: number) => <fieldset key={o.key}><legend>Outcome {index + 1}</legend>
        <label>Expected result<textarea required value={o.description} onInput={e => setMandate({ ...mandate, outcomes: mandate.outcomes.map((x: any, i: number) => i === index ? { ...x, description: e.currentTarget.value } : x) })}/></label>
        <label>Acceptance criterion<input required value={o.criterion} onInput={e => setMandate({ ...mandate, outcomes: mandate.outcomes.map((x: any, i: number) => i === index ? { ...x, criterion: e.currentTarget.value } : x) })}/></label>
        <label>Evidence<select value={o.evidence} onChange={e => setMandate({ ...mandate, outcomes: mandate.outcomes.map((x: any, i: number) => i === index ? { ...x, evidence: e.currentTarget.value } : x) })}><option value="user_judgment">User judgment</option><option value="reviewed">Reviewed evidence</option></select></label>
        {(['required', 'conditional_allowed', 'outside_validation_required'] as const).map(key => <label class="check" key={key}><input type="checkbox" checked={o[key]} onChange={e => setMandate({ ...mandate, outcomes: mandate.outcomes.map((x: any, i: number) => i === index ? { ...x, [key]: e.currentTarget.checked } : x) })}/>{key.replaceAll('_', ' ')}</label>)}
        <button type="button" class="quiet" disabled={mandate.outcomes.length <= 1} onClick={() => setMandate({ ...mandate, outcomes: mandate.outcomes.filter((_: any, i: number) => i !== index) })}>Remove outcome</button>
      </fieldset>)}<button type="button" class="secondary" onClick={() => setMandate({ ...mandate, outcomes: [...mandate.outcomes, { ...initialMandate('', '').outcomes[0], key: crypto.randomUUID() }] })}>Add outcome</button>
      {(['constraints', 'preferences', 'unresolved_inputs'] as const).map(key => <label key={key}>{key.replaceAll('_', ' ')}<textarea value={mandate[key].join('\n')} onInput={e => setMandate({ ...mandate, [key]: e.currentTarget.value.split('\n') })}/></label>)}
      <label>Completion agreement<input required value={mandate.completion_agreement} onInput={e => setMandate({ ...mandate, completion_agreement: e.currentTarget.value })}/></label>
      {(['non_contributor_review', 'scope_coverage_review_required'] as const).map(key => <label class="check" key={key}><input type="checkbox" checked={mandate[key]} onChange={e => setMandate({ ...mandate, [key]: e.currentTarget.checked })}/>{key.replaceAll('_', ' ')}</label>)}
    </>}<button disabled={busy || !mandate || work.revision !== base.revision}>{busy ? 'Saving…' : 'Adopt amendment'}</button></form></Dialog>;
}

export function WorkControls({ work, act, open }: { work: Entity; act: Act; open: (id: string) => void }) {
  const [mode, setMode] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [root, setRoot] = useState('');
  const d = data(work), archived = d.status === 'archived';
  return <section class="operator-controls" aria-label="Task controls"><div class="button-row">
    {!archived && <><button class="secondary" onClick={() => setMode('amend')}>Amend task</button><button class="secondary" onClick={() => setMode(mode === 'fund' ? '' : 'fund')}>Funding</button><button class="secondary" onClick={() => setMode(mode === 'message' ? '' : 'message')}>Message participants</button><button class="quiet" onClick={() => setMode('archive')}>Archive task</button></>}
    {archived && <p role="status">Archived. Participation was cancelled; historical results, spending, and late effects remain inspectable. Open a document, artifact, or message to erase a selected payload.</p>}
  </div>{error && <p role="alert">{error}</p>}
    {mode === 'amend' && <Amend work={work} act={act} close={() => setMode('')}/>}
    {mode === 'fund' && (d.resource_root ? <AllowanceSummary id={d.resource_root}/> : <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await act('resource.bind', { work: work.id, revision: work.revision, root, reason: String(new FormData(e.currentTarget).get('reason')) }); setMode(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><FundingChoice value={root} onChange={setRoot}/><label>Funding reason<input name="reason" required/></label><button disabled={busy}>Fund task</button></form>)}
    {mode === 'message' && <form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; setBusy(true); setError(''); try { await act('message.send', { to: d.environment, environment: d.environment, work: work.id, text: String(new FormData(form).get('message')) }); form.reset(); setMode(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><label>Message for this task<textarea name="message" required rows={3}/></label><button disabled={busy}>Send to participants</button></form>}
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
