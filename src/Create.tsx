import { useEffect, useState } from 'preact/hooks';
import { data, label, type Entity } from './api';
import { recordIDs, matchesRecords } from './workspace';
import { useRecords, useResource } from './hooks';
import { FundingChoice, initialMandate } from './Operator';
import type { Act } from './main';
import Pagination from './Pagination';
import Dialog from './Dialog';
import { ToolChoices } from './EnvironmentTools';
import SearchInput from './SearchInput';
import ProfileFields, { profileInput } from './ProfileFields';
import { modelKey, ModelStatus, useModels } from './Models';
export function Pick({ kind, multiple, value, onChange, exclude = [], disabled = false }: { kind: string; multiple?: boolean; value: string[]; onChange: (ids: string[]) => void; exclude?: string[]; disabled?: boolean }) {
  const [query, setQuery] = useState(''), [cursors, setCursors] = useState([0]);
  const settled = query;
  const { value: page, error } = useRecords(kind, '', '', settled, cursors.at(-1));
  const rows = page?.items.filter(r => !exclude.includes(r.id) && data(r).lifecycle !== 'retired');
  return <fieldset disabled={disabled}><legend>{kind === 'persona' ? 'Choose personas' : 'Choose an environment'}</legend><div class="search-field"><SearchInput label={'Find ' + kind} value={query} onSearch={q => { setQuery(q); setCursors([0]); }} placeholder="Search…"/></div>
    {error && <p role="alert">{error}</p>}{rows?.length === 0 && <p>No available {kind === 'persona' ? 'personas' : 'environments'} on this page.</p>}{rows?.map(r => <label key={r.id} class="check"><input type={multiple ? 'checkbox' : 'radio'} checked={value.includes(r.id)} onChange={() => onChange(multiple ? value.includes(r.id) ? value.filter(id => id !== r.id) : [...value, r.id] : [r.id])}/>{label(r)}{kind === 'persona' && <small>{data(r).model}</small>}</label>)}
    <Pagination previous={cursors.length > 1} next={page?.next} onPrevious={() => setCursors(cursors.slice(0, -1))} onNext={() => { if (page?.next != null) setCursors([...cursors, page.next]); }}/></fieldset>;
}
function EnvironmentPersonas({ id, choose }: { id: string; choose: (ids: string[]) => void }) {
  const { value } = useResource<Entity>('/records/' + id, e => e.entity === id || matchesRecords(e, 'environment'));
  const ids = value ? recordIDs(data(value).participant_ids ?? data(value).personas) : [];
  return ids.length ? <button type="button" class="secondary" onClick={() => choose(ids)}>Use environment personas ({ids.length})</button> : null;
}
export default function Create({ kind, brief, close, act }: { kind: string; brief: string; close: () => void; act: Act }) {
  const [root, setRoot] = useState('');
  const [tools, setTools] = useState<string[] | undefined>();
  const createsEnvironment = kind === 'Environments' || kind === 'Work' && !!brief;
  const { value: deployment } = useResource<{ funding_required: boolean }>('/deployment', () => false);
  const modelState = useModels(kind === 'Personas'), models = modelState.models;
  const [selectedModel, setSelectedModel] = useState('');
  useEffect(() => { if (!selectedModel && models.length) setSelectedModel(modelKey(models[0])); }, [models, selectedModel]);
  const availableModel = models.find(m => modelKey(m) === selectedModel);
  const [people, setPeople] = useState<string[]>([]), [env, setEnv] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save(form: HTMLFormElement) {
    if (busy) return; setBusy(true); setError('');
    try {
      const f = new FormData(form);
      if (kind === 'Personas') { const model = models.find(m => modelKey(m) === f.get('model')); if (!model) throw new Error('Choose an available model.'); await act('persona.create', { provider: model.provider, model: model.id, profile_seed: profileInput(f, true), self_authorship: f.has('self_authorship'), ...(root ? { resource_root: root } : {}) }); }
      else if (kind === 'Environments') await act('environment.create', { tools });
      else if (kind === 'Network') {
        const descriptor = String(f.get('descriptor')).trim();
        if (descriptor) { const d = JSON.parse(descriptor); if (d.address) await act('peer.connect', { address: d.address }); const { peer, artifact, digest, size, name } = d; await act('transfer.start', { peer, artifact, digest, size, name }); }
        else await act('peer.connect', { address: String(f.get('address')) });
      } else {
        if (!people.length) throw new Error('Choose at least one persona');
        let environment = env[0];
        if (!environment && brief) { const r = await act('environment.create', { tools }); environment = (r.result as any).id; setEnv([environment]); }
        if (!environment) throw new Error('Choose an environment');
        await act('work.create', { title: String(f.get('title')), brief: String(f.get('brief')), environment, personas: people, ...(root ? { resource_root: root } : {}), mandate: initialMandate(String(f.get('brief')), String(f.get('criterion'))) });
      }
      close();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Dialog label="Create" close={close}><form class="create-panel" onSubmit={e => { e.preventDefault(); void save(e.currentTarget); }}><header><h2>{kind === 'Network' ? 'Connect or receive' : 'Create ' + kind.toLowerCase()}</h2><button type="button" class="quiet" onClick={close}>Close form</button></header>{error && <p role="alert">{error}</p>}
    {kind === 'Personas' ? <><label>Starting model<select name="model" required value={selectedModel} onChange={e => setSelectedModel(e.currentTarget.value)} disabled={modelState.loading || !models.length}>{!availableModel && <option value={selectedModel}>{selectedModel ? 'Selected model unavailable — choose another' : 'No models available'}</option>}{models.map(m => <option key={modelKey(m)} value={modelKey(m)}>{m.provider} / {m.name || m.id}</option>)}</select><small>The persona can make subsequent permitted model choices.</small></label><p>Creating reserves a bounded initialization call. Select the persona for funded work to begin orientation, where it can choose its name and character. No model call starts from creation alone.</p><ModelStatus {...modelState}/><ProfileFields creation/></>
      : kind === 'Environments' ? <p>Create a shared place for work. Participating personas can choose its name and description when work begins. An image appears only after an actual artifact is published.</p>
      : kind === 'Network' ? <><label>Peer address<input name="address" placeholder="/ip4/…/tcp/…/p2p/…"/></label><label>Or shared artifact details<textarea name="descriptor" rows={5}/></label><p>Both nodes must trust one another to exchange artifacts. Receiving bytes does not grant execution authority.</p></>
      : <><label>Short title<input name="title" required defaultValue={brief ? 'Learning together' : ''}/></label><label>Your instructions<textarea name="brief" required rows={6} defaultValue={brief}/></label><label>Acceptance criterion<input name="criterion" required defaultValue="Meets the request and stated constraints"/></label>{!brief && <Pick kind="environment" value={env} onChange={setEnv}/>}{env[0] && <EnvironmentPersonas id={env[0]} choose={setPeople}/>}<Pick kind="persona" multiple value={people} onChange={setPeople}/><p class="micro">Selecting a roster does not prove accepted commitments. No roles or workflow are assigned by the UI.</p></>}
    {createsEnvironment && <ToolChoices value={tools} onChange={setTools}/>}
    {['Personas', 'Work'].includes(kind) && <FundingChoice value={root} onChange={setRoot} required={deployment?.funding_required !== false}/>}
    <button disabled={busy || createsEnvironment && tools === undefined || kind === 'Personas' && (!availableModel || modelState.loading)}>{busy ? 'Saving…' : 'Create'}</button>
  </form></Dialog>;
}
