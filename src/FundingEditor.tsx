import { useEffect, useState } from 'preact/hooks';
import { data, type Entity } from './api';
import type { Bounds, Limits, Price } from './contract';
import { useResource } from './hooks';
import { modelKey, ModelStatus, useModels } from './Models';
import type { Act } from './main';
import Dialog from './Dialog';

function whole(f: FormData, key: string) {
  const raw = String(f.get(key) ?? '');
  const n = Number(raw);
  if (!raw.trim() || !Number.isSafeInteger(n) || n < 0) throw Error('Enter a non-negative whole number for ' + key.replaceAll('_', ' ') + '.');
  return n;
}
function money(f: FormData, key: string) {
  const raw = String(f.get(key) ?? '');
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) throw Error('Amounts need at most six decimal places.');
  const n = Math.round(Number(raw) * 1_000_000);
  if (!Number.isSafeInteger(n)) throw Error('Amount is too large.');
  return n;
}
const localTime = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0,16);
};
function NumberField({ name, title, value, money: currency = false }: { name: string; title: string; value: number; money?: boolean }) {
  return <label>{title}<input name={name} type="number" min="0" step={currency ? '0.000001' : '1'} required defaultValue={currency ? value / 1_000_000 : value}/></label>;
}

// Keep keystroke updates local; the funding dialog and model catalogue do not
// rerender for each digit, and background events cannot reset this draft.
function CallCapacity({ total, finishing }: { total: number; finishing: number }) {
  const [calls, setCalls] = useState(String(total)), [reserve, setReserve] = useState(String(finishing));
  const valid = /^\d+$/.test(calls) && /^\d+$/.test(reserve)
    && Number.isSafeInteger(Number(calls)) && Number.isSafeInteger(Number(reserve));
  return <div class="call-capacity"><div class="operator-grid">
    <label>Total model calls<input name="calls" type="number" min="0" step="1" required value={calls} onInput={e => setCalls(e.currentTarget.value)}/></label>
    <label>Calls reserved for review and finishing<input name="closeout_calls" type="number" min="0" step="1" required value={reserve} onInput={e => setReserve(e.currentTarget.value)}/></label>
  </div>{valid && <p class={Number(reserve) > Number(calls) ? 'notice' : 'micro'} aria-live="polite">{Number(reserve) > Number(calls)
    ? 'Finishing reserves exceed the total call limit.'
    : `${Number(calls) - Number(reserve)} production calls before existing usage and reservations (${calls} total − ${reserve} reserved for finishing).`}</p>}</div>;
}

export function EditAllowance({ id, act }: { id: string; act: Act }) {
  const [editing, setEditing] = useState(false);
  return <><button class="secondary" onClick={() => setEditing(true)}>Edit allowance</button>
    {editing && <AllowanceEditor id={id} act={act} close={() => setEditing(false)}/>}</>;
}

function AllowanceEditor({ id, act, close }: { id: string; act: Act; close: () => void }) {
  const current = useResource<Entity>('/records/' + id, e => e.entity === id);
  const [base, setBase] = useState<Entity>();
  useEffect(() => { if (!base && current.value) setBase(current.value); }, [base, current.value]);
  const stale = !!base && !!current.value && base.revision !== current.value.revision;
  return <Dialog label="Edit funding allowance" close={close}>
    {!base ? <div class="operator-form"><h2>Edit funding allowance</h2><p role={current.error ? 'alert' : 'status'}>{current.error || 'Loading current limits…'}</p><button onClick={close}>Close form</button></div>
      : <AllowanceDraft key={base.revision} base={base} act={act} close={close} stale={stale} readError={current.error}
          reload={() => current.value && setBase(current.value)}/>} </Dialog>;
}

function AllowanceDraft({ base, act, close, stale, reload, readError }: {
  base: Entity; act: Act; close: () => void; stale: boolean; reload: () => void; readError: string;
}) {
  const d = data(base), bounds = d.bounds as Bounds, limits = d.limits as Limits;
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const modelState = useModels(), [selected, setSelected] = useState('');
  const [prices, setPrices] = useState<Price[]>(bounds?.prices ?? []);
  const [included, setIncluded] = useState(false);
  const available = [...modelState.models, ...(modelState.catalog?.decision_models || [])].filter(m => !prices.some(p => p.provider === m.provider && p.model === m.id));
  const chosen = available.find(m => modelKey(m) === selected);
  const subscription = (chosen?.capabilities as any)?.billing === 'chatgpt_subscription';
  if (!bounds || d.status !== 'active') return <div class="operator-form"><h2>Allowance cannot be edited</h2><p role="alert">{!bounds ? 'Configure the initial limits before editing this allowance.' : 'This allowance is closed. Its history and spending remain retained.'}</p><button onClick={close}>Close form</button></div>;
  return <form class="operator-form allowance-form" onInvalidCapture={e => {
    const details = (e.target as HTMLElement).closest('details'); if (details) details.open = true;
  }} onSubmit={async e => {
    e.preventDefault(); if (busy || stale || readError) return;
    const f = new FormData(e.currentTarget); setBusy(true); setError('');
    try {
      const reason = String(f.get('reason') || '').trim();
      if (!reason) throw Error('Explain the funding change.');
      const updated: Bounds = { ...bounds, reason,
        expires: new Date(String(f.get('expires'))).toISOString(),
        tokens: whole(f, 'tokens'), closeout_tokens: whole(f, 'closeout_tokens'),
        cost_units: money(f, 'cost'), closeout_cost_units: money(f, 'closeout_cost'),
        remote_calls: whole(f, 'remote_calls'), retained_payload_bytes: String(f.get('retained_payload_bytes') || '').trim() ? whole(f, 'retained_payload_bytes') : null,
        cpu_seconds: whole(f, 'cpu_seconds'), concurrent_memory_bytes: whole(f, 'concurrent_memory_bytes'),
        effect_operations: whole(f, 'effect_operations'), births_per_window: whole(f, 'births_per_window'), birth_window_seconds: whole(f, 'birth_window_seconds'),
        prices: prices.map((p, i) => ({ ...p, input_units_per_million: money(f, `price.${i}.input`), output_units_per_million: money(f, `price.${i}.output`), evidence: String(f.get(`price.${i}.evidence`) || '').trim() })),
      };
      const nextLimits = { calls: whole(f, 'calls'), births: whole(f, 'births'), max_depth: whole(f, 'max_depth'), concurrent_calls: whole(f, 'concurrent_calls') };
      const closeout_calls = whole(f, 'closeout_calls');
      if (closeout_calls > nextLimits.calls || updated.closeout_tokens > updated.tokens || updated.closeout_cost_units > updated.cost_units) throw Error('Finishing reserves must fit inside the total limits.');
      if (Date.parse(updated.expires) <= Date.now()) throw Error('Choose an expiry in the future.');
      await act('resource.root.amend', { root: base.id, revision: base.revision, limits: nextLimits, closeout_calls, bounds: updated, reason });
      close();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}><header><div><p class="eyebrow">FUNDING</p><h2>Edit funding allowance</h2><p>{d.reason}</p></div><button type="button" class="quiet" onClick={close}>Close form</button></header>
    <div class="form-body"><p class="form-intro">Enter new total limits, including capacity already used. This changes the shared allowance for every linked persona and task. Spent, reserved, and uncertain usage stays accounted for.</p>
      <p class="notice">Saving may let waiting participants continue. Paused and cancelled work remains stopped. Increasing these limits does not purchase credits or grant host permissions.</p>
      {(error || readError) && <p role="alert">{error || readError}</p>}
      {stale && <p role="alert">This allowance changed while you were editing. <button type="button" onClick={reload}>Reload current limits</button> to replace this draft before saving.</p>}
      <label>Reason for funding change<textarea name="reason" required rows={2}/></label>
      <fieldset><legend>Calls and personas</legend><CallCapacity total={limits.calls} finishing={d.closeout_calls}/><div class="operator-grid">
        <NumberField name="births" title="Maximum new personas, including founders" value={limits.births}/>
        <NumberField name="max_depth" title="Maximum descendant depth" value={limits.max_depth}/>
        <NumberField name="concurrent_calls" title="Concurrent calls" value={limits.concurrent_calls}/>
      </div></fieldset>
      <fieldset><legend>Tokens, budget, and expiry</legend><div class="operator-grid">
        <NumberField name="tokens" title="Total tokens" value={bounds.tokens}/><NumberField name="closeout_tokens" title="Tokens reserved for finishing" value={bounds.closeout_tokens}/>
        <NumberField name="cost" title={`Total budget (${bounds.currency})`} value={bounds.cost_units} money/><NumberField name="closeout_cost" title={`Budget reserved for finishing (${bounds.currency})`} value={bounds.closeout_cost_units} money/>
      </div><label>Allowance expires<input type="datetime-local" name="expires" required defaultValue={localTime(bounds.expires)}/></label></fieldset>
      <fieldset><legend>Funded models and prices</legend><p class="micro">Prices apply to future reservations. Existing calls retain their recorded prices. Subscription limits still apply when you explicitly record zero marginal prices.</p>
        {prices.map((price, i) => <fieldset key={JSON.stringify([price.provider, price.model])}><legend>{price.provider} / {price.model}</legend><div class="operator-grid">
          <NumberField name={`price.${i}.input`} title={`Input price per million tokens — ${price.model}`} value={price.input_units_per_million} money/>
          <NumberField name={`price.${i}.output`} title={`Output price per million tokens — ${price.model}`} value={price.output_units_per_million} money/>
        </div><label>Price source and date — {price.model}<input name={`price.${i}.evidence`} required defaultValue={price.evidence}/></label></fieldset>)}
        <label>Add price policy for model<select value={selected} onChange={e => { setSelected(e.currentTarget.value); setIncluded(false); }}><option value="">Choose a model to add</option>{available.map(m => <option key={modelKey(m)} value={modelKey(m)}>{m.provider} / {m.name || m.id}</option>)}</select></label>
        <ModelStatus {...modelState}/>
        {subscription && <label class="check"><input type="checkbox" checked={included} onChange={e => setIncluded(e.currentTarget.checked)}/>Use included subscription usage for this model</label>}
        <button type="button" class="secondary" disabled={!chosen} onClick={() => {
          if (!chosen) return;
          // Existing fields remain mounted; adding a row preserves their draft.
          setPrices(p => [...p, { provider: chosen.provider, model: chosen.id, input_units_per_million: 0, output_units_per_million: 0,
            evidence: subscription && included ? `Operator chose included subscription usage on ${new Date().toISOString().slice(0,10)}. Plan limits still apply.` : '' }]);
          setSelected(''); setIncluded(false);
        }}>Add model policy</button>
      </fieldset>
      <details><summary>Execution and growth limits</summary><div class="operator-grid">
        <label>Optional content storage allowance (bytes)<input name="retained_payload_bytes" type="number" min="0" step="1" defaultValue={bounds.retained_payload_bytes ?? ''} placeholder="No ceiling"/><small>Leave blank for no ceiling. Model requests, responses, and logs are not archived.</small></label>
        {([['remote_calls','Maximum remote calls'],['cpu_seconds','Execution CPU seconds'],['concurrent_memory_bytes','Concurrent execution memory bytes'],['effect_operations','External effect operations'],['births_per_window','New personas per rate window'],['birth_window_seconds','Rate window seconds']] as const).map(([name,title]) => <NumberField key={name} name={name} title={title} value={bounds[name]}/>)}
      </div></details>
    </div><footer class="form-actions"><p class="micro">Changing the finishing reserve is an explicit reallocation. Required review and repair obligations remain.</p><button disabled={busy || stale || !!readError}>{busy ? 'Saving…' : 'Save funding changes'}</button></footer>
  </form>;
}
