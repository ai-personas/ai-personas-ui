import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { fields, strings, text } from './workspace';
import type { Act } from './main';
import { ModelImageInput, ModelStatus, modelKey, primaryModels, useModels } from './Models';
import { ModelReadiness, useModelReadiness } from './ModelReadiness';

export default function ModelChoice({ persona, act, close }: { persona: Entity; act: Act; close: () => void }) {
  const d = data(persona), modelState = useModels(), models = primaryModels(modelState.models);
  const [selected, setSelected] = useState(JSON.stringify([text(d.provider), text(d.model)]));
  const [effort, setEffort] = useState(text(d.effort)), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const model = models.find(m => modelKey(m) === selected);
  const efforts = strings(fields(model?.capabilities).allowed_reasoning_efforts);
  const readiness = useModelReadiness({ provider: model?.provider || '', model: model?.id || '', effort: effort || null, resource_root: text(d.resource_root) || null, persona: persona.id }, act,
    !!model && !modelState.loading, [modelState.catalog, persona.revision]);
  return <form class="model-choice" aria-label="Change persona model" onSubmit={async e => {
    e.preventDefault(); if (busy || !model) return; setBusy(true); setError('');
    try {
      const checked = await readiness.check();
      if (!checked.ready) throw Error(checked.blocker?.message || 'This model is not ready for funded decisions.');
      await act('model.choose', { provider: model.provider, model: model.id, effort: effort || null }, persona.id); close();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <label>Persona model<select aria-label="Persona model" value={selected} required disabled={busy || modelState.loading || !models.length} onChange={e => { setSelected(e.currentTarget.value); setEffort(''); }}>
      {!model && <option value={selected}>Current model unavailable — choose another</option>}{models.map(m => <option key={modelKey(m)} value={modelKey(m)}>{m.provider} / {m.name || m.id}</option>)}
    </select></label>
    {efforts.length > 0 && <label>Reasoning effort<select aria-label="Reasoning effort" value={effort} disabled={busy} onChange={e => setEffort(e.currentTarget.value)}><option value="">Model default</option>{efforts.map(value => <option value={value} key={value}>{value}</option>)}</select></label>}
    <ModelImageInput model={model}/><ModelStatus {...modelState} models={models}/><ModelReadiness {...readiness}/>
    <p class="micro">Changing the model preserves this persona’s identity. Its allowance and active work must permit the selection.</p>
    {error && <p role="alert">{error}</p>}
    <div class="button-row"><button disabled={busy || readiness.loading || !readiness.value?.ready}>{busy ? 'Saving…' : 'Save model choice'}</button><button type="button" class="quiet" disabled={busy} onClick={close}>Cancel model change</button></div>
  </form>;
}
