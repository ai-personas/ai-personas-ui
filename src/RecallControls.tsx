import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { useObservation, useResource } from './hooks';
import { readRecallPolicy } from './recallPolicy';
import type { Act } from './main';
import { localExpiry, expiryInput } from './explorationPolicy';
import RecallSourceAccess from './RecallSourceAccess';

function Form({ run, policy, act, blocked }: { run: Entity; policy?: Entity; act: Act; blocked: boolean }) {
  const d = policy ? data(policy) : {}, p = d.policy || {};
  const [selectedModel, setSelectedModel] = useState(p.provider && p.model ? `${p.provider}:${p.model}` : '');
  const [enabled, setEnabled] = useState(d.status === 'enabled'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const { value, error: modelError, loading: modelsLoading, retry } = useResource<{ models: { provider: string; id: string; capabilities: any }[] }>('/inference', e => ['provider_settings', 'deployment'].includes(e.kind));
  const models = value?.models.filter(m => m.capabilities?.inference?.adapter === 'typesafe-systemone-choice/1') || [];
  return <form class="development-card" onSubmit={async event => {
    event.preventDefault(); if (busy || blocked) return; const form = new FormData(event.currentTarget); setBusy(true); setError(''); setSaved(false);
    try {
      const selected = models.find(m => `${m.provider}:${m.id}` === form.get('model'));
      if (enabled && !selected) throw new Error('Choose a configured choice model.');
      const number = (name: string) => { const n = Number(form.get(name)); if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Limits must be positive whole numbers.'); return n; };
      await act('recall.configure', { persona: data(run).persona, work: run.scope, revision: policy?.revision ?? 0, reason: String(form.get('reason')),
        policy: enabled ? { provider: selected!.provider, model: selected!.id, expires: expiryInput(form.get('expires'), p.expires),
          allow_owned_fragments: form.has('fragments'), allow_work_observations: form.has('observations'), allow_authored_focus: form.has('focus'),
          max_candidates: number('candidates'), max_request_bytes: number('bytes'), max_input_tokens: number('input'), max_output_tokens: number('output'),
          max_episode_attempts: number('episode'), max_total_attempts: number('total'), timeout_ms: number('timeout'), fallback: String(form.get('fallback')) } : null });
      setSaved(true);
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }}>
    <h4>Optional recall selector</h4><p>The persona’s delegation determines which memories may be selected. This permission allows a configured choice model to assess a bounded shortlist using the work’s existing priced allowance.</p>
    <label class="check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.currentTarget.checked)}/>Enable selection before a decision</label>
    {enabled && <><label>Choice model<select name="model" required value={selectedModel} onChange={e => setSelectedModel(e.currentTarget.value)}><option value="">Choose a deployment</option>{models.map(m => <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>{m.provider} · {m.id}</option>)}</select></label>{modelError ? <p role="alert">Could not load choice models. {modelError} <button type="button" onClick={retry}>Retry choice models</button></p> : modelsLoading ? <p role="status">Loading choice models…</p> : !models.length && <p>No choice deployment is configured. Add one in provider settings first.</p>}
      <fieldset><legend>Text this provider may process</legend><label class="check"><input type="checkbox" name="fragments" defaultChecked={p.allow_owned_fragments === true}/>Owned fragment descriptions and connection conditions</label><label class="check"><input type="checkbox" name="observations" defaultChecked={p.allow_work_observations === true}/>Permitted work observations</label><label class="check"><input type="checkbox" name="focus" defaultChecked={p.allow_authored_focus === true}/>The persona’s authored focus</label><p class="micro">Current source permissions still apply to every request and cache reuse.</p></fieldset>
      <div class="profile-trait-fields">{[
        ['candidates','Candidates per batch',p.max_candidates ?? 8,32], ['bytes','Request bytes',p.max_request_bytes ?? 16384,65536],
        ['input','Maximum reserved input tokens',p.max_input_tokens ?? '',100000000], ['output','Maximum reserved output tokens',p.max_output_tokens ?? '',100000000],
        ['episode','Attempts before the next primary call',p.max_episode_attempts ?? 1,4], ['total','Total attempt allowance',p.max_total_attempts ?? 10,10000],
        ['timeout','Timeout in milliseconds',p.timeout_ms ?? 5000,60000]
      ].map(([name,label,current,max]) => <label key={String(name)}>{label}<input name={String(name)} type="number" min="1" max={Number(max)} step="1" required defaultValue={current}/></label>)}</div>
      <label>On failure<select name="fallback" defaultValue={p.fallback ?? 'deterministic'}><option value="deterministic">Use deterministic recall</option><option value="block">Block the decision</option></select></label>
      <label>Permission expires<input name="expires" type="datetime-local" required defaultValue={localExpiry(p.expires || Date.now() + 86400000)}/></label>
      <p class="micro">Enter token reservations from the deployment’s reviewed limits. Timeouts retain uncertain spending. Changing these settings does not reset spent attempts. A moving model alias cannot reuse cached assessments.</p></>}
    <label>Reason<textarea name="reason" rows={2} required/></label>{error && <p role="alert">{error}</p>}{saved && <p role="status">Recall permission saved.</p>}<button disabled={busy || blocked || (enabled && (!models.length || modelsLoading || Boolean(modelError)))}>{busy ? 'Saving…' : 'Save recall permission'}</button>
  </form>;
}
export default function RecallControls({ run, act }: { run: Entity; act: Act }) {
  const persona = data(run).persona;
  const { value, error, loading, retry } = useObservation(`recall-policy:${persona}:${run.scope}`, signal => readRecallPolicy(persona, run.scope, signal), e => e.kind === 'recall_policy');
  return <section aria-busy={loading}>
    {error && <p role="alert">Could not load recall permission. {error} <button onClick={retry}>Retry recall permission</button></p>}
    {loading && <p role="status">{value === undefined ? 'Loading recall permission…' : 'Checking current permission; saving is disabled until this finishes.'}</p>}
    {value !== undefined && <><Form key={value?.revision ?? 0} run={run} policy={value ?? undefined} act={act} blocked={loading || Boolean(error)}/><RecallSourceAccess run={run} act={act}/></>}
  </section>;
}
