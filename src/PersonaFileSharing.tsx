import { useState } from 'preact/hooks';
import { data, resourceRequest, type Entity, type Page } from './api';
import { useObservation } from './hooks';
import { Pick } from './Create';
import { recordIDs, text } from './workspace';
import type { Act } from './main';

/** File text and its current audience have independently versioned records. */
export default function PersonaFileSharing({ file, act, open }: { file: Entity; act: Act; open: (id: string) => void }) {
  const [saved, setSaved] = useState(false);
  const { value, loading, error, retry } = useObservation(`file-sharing:${file.id}:${file.revision}`, async signal => {
    const current = await resourceRequest<Entity>(`/records/${file.id}`, signal);
    if (current.id !== file.id || !(['fragment', 'persona_asset'].includes(current.kind) && data(current).file?.path || current.kind === 'file_warning' && data(current).target)) throw new Error('This record is not an accepted persona file or applicability warning.');
    const page = await resourceRequest<Page<Entity>>('/records?' + new URLSearchParams({ kind: 'information_policy', scope: file.id, limit: '2' }), signal);
    if (page.items.length > 1 || page.next != null) throw new Error('The current sharing policy could not be identified.');
    const policy = page.items[0] ? await resourceRequest<Entity>(`/records/${page.items[0].id}`, signal) : null;
    if (policy && (policy.kind !== 'information_policy' || policy.scope !== current.id)) throw new Error('The sharing policy does not belong to this file.');
    return { current, policy };
  }, e => e.entity === file.id || e.kind === 'information_policy');
  const p = value?.policy ? data(value.policy) : {};
  const unavailable = value && (data(value.current).erased === true || data(value.current).discredited === true || !['retained', 'active', 'resolved'].includes(data(value.current).status));
  const special = value?.policy && (p.status !== 'active' || ['seed_readers', 'response_readers', 'work_readers'].some(k => recordIDs(p[k]).length));
  return <section class="development-card" aria-busy={loading}>
    <h3>{file.kind === 'file_warning' ? 'Warning sharing' : 'File sharing'}</h3>
    <p>Choose which personas may read this material. Work derived from it also depends on these permissions. Restrictions from its sources still apply.</p>
    {error && <p role="alert">{error} <button type="button" onClick={retry}>Refresh sharing</button></p>}
    {loading && <p role="status">Reading current sharing settings…</p>}
    {value && <>
      {value.policy && <button class="text-button" onClick={() => open(value.policy!.id)}>Read current sharing policy</button>}
      {unavailable || special ? <p>This file has a retirement, withdrawal or special sharing disposition. Inspect its records before replacing that policy.</p> : <SharingForm key={`${value.current.revision}:${value.policy?.revision ?? 0}`} file={value.current} policy={value.policy} act={act} stale={loading || !!error} onSaved={() => { setSaved(true); retry(); }} onEdit={() => setSaved(false)}/>}
    </>}
    {saved && <p role="status">Sharing settings saved. Accepted text was preserved.</p>}
  </section>;
}

function localTime(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

function SharingForm({ file, policy, act, stale, onSaved, onEdit }: { file: Entity; policy: Entity | null; act: Act; stale: boolean; onSaved: () => void; onEdit: () => void }) {
  const p = policy ? data(policy) : {};
  const owner = text(data(file).owner);
  const [readers, setReaders] = useState(() => recordIDs(p.readers));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <form onInput={onEdit} onSubmit={async event => {
    event.preventDefault(); if (busy || stale) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); onEdit();
    try {
      const expires = String(form.get('expires') || '');
      await act('information.policy', { subject: file.id, revision: file.revision, policy_revision: policy?.revision ?? 0, readers, allow_export: form.has('export'), expires: expires ? new Date(expires).toISOString() : null, reason: String(form.get('reason') || '') });
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <fieldset disabled={busy || stale}>
      <legend>Allowed readers</legend>
      <p class="micro">The owner does not need an explicit reader grant. Selecting peers does not select this file for their context. Expiry blocks use of this file, including by its owner, until its policy is renewed.</p>
      <Pick kind="persona" multiple value={readers} onChange={ids => { setReaders(ids); onEdit(); }} disabled={busy || stale}/>
      {readers.length > 0 && <details><summary>Selected readers ({readers.length})</summary><ul>{readers.map(id => <li key={id}>{id}{id === owner && ' · owner'} <button type="button" class="text-button" onClick={() => { setReaders(readers.filter(r => r !== id)); onEdit(); }}>Remove explicit grant</button></li>)}</ul></details>}
      <label class="check"><input name="export" type="checkbox" defaultChecked={p.allow_export === true}/>Allow export by permitted readers</label>
      <label>Expiry in your local time (optional)<input name="expires" type="datetime-local" step="1" defaultValue={localTime(p.expires)}/></label>
      <label>Reason for this sharing change<textarea name="reason" required rows={2}/></label>
      <button>{busy ? 'Saving…' : 'Save sharing'}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>;
}
