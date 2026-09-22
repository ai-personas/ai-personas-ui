import { useState } from 'preact/hooks';
import { data, label, type Entity } from './api';
import { useResource, useRecords } from './hooks';
import type { Act } from './main';
import { Pick } from './Create';
import { inputRequestCount, matchesRecords, recordIDs } from './workspace';
import { InputNotice } from './Attention';

function Person({ id, open, remove, disabled }: { id: string; open: (id: string) => void; remove: () => void; disabled: boolean }) {
  const { value, error } = useResource<Entity>('/records/' + id, e => e.entity === id || matchesRecords(e, 'persona', '', id));
  return <article class={`participant-row${value && inputRequestCount(value) ? ' needs-input' : ''}`}>
    <div><button class="record-title" onClick={() => open(id)}>{value ? label(value) : `Persona ${id.slice(0, 8)}`}</button>
      {error && <p role="alert">Could not load persona: {error}</p>}
      {value && <InputNotice record={value} open={open}/>}</div>
    <button class="secondary" disabled={disabled} onClick={remove} aria-label={`Remove ${value ? label(value) : id}`}>Remove</button>
  </article>;
}

export default function Participants({ subject, act, open }: { subject: Entity; act: Act; open: (id: string) => void }) {
  const [mode, setMode] = useState<'add' | 'remove' | ''>(''), [person, setPerson] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [page, setPage] = useState(0), [saved, setSaved] = useState('');
  const d = data(subject), ids = recordIDs(d.participant_ids ?? d.personas), environment = subject.kind === 'environment';
  const size = 12, currentPage = Math.min(page, Math.max(0, Math.ceil(ids.length / size) - 1));
  const edit = (next: 'add' | 'remove', id = '') => { setMode(next); setPerson(id ? [id] : []); setError(''); setSaved(''); };
  const save = async (form: HTMLFormElement) => {
    if (busy || !person[0] || !mode) return;
    setBusy(true); setError('');
    try {
      const reason = String(new FormData(form).get('reason') || '').trim() || `${mode === 'add' ? 'Added' : 'Removed'} by operator from ${subject.kind}`;
      await act(mode === 'add' ? 'participants.add' : 'participants.remove', { subject: subject.id, revision: subject.revision, persona: person[0], reason });
      setSaved(mode === 'remove' ? 'Persona removed.' : environment ? 'Persona added to the environment roster.' : 'Invitation sent. The persona chooses whether to join.');
      setMode(''); setPerson([]);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section class="workspace-section participants" aria-label="Manage personas">
    <header class="section-heading"><h2>{environment ? 'Environment personas' : 'Work personas'}</h2><button class="secondary" disabled={busy || d.status === 'archived'} onClick={() => edit('add')}>Add persona</button></header>
    <p class="section-description">{environment ? 'Select personas here for new work. Adding to this roster starts no activity; work invitations are accepted separately. Removing a persona also ends their participation in this environment’s work.' : 'Add or remove personas at any time. New personas receive an invitation to the current task; joining and accepting responsibilities are separate decisions.'}</p>
    {mode && <form class="participant-editor" onSubmit={e => { e.preventDefault(); void save(e.currentTarget); }}>
      <h3>{mode === 'add' ? 'Add a persona' : `Remove persona from this ${subject.kind}`}</h3>
      {mode === 'add' ? <Pick kind="persona" value={person} onChange={setPerson} exclude={ids} disabled={busy}/> : <p>Stops this persona’s participation{environment ? ' in all work in this environment' : ' in this work'} and cancels pending requests and invitations. Existing results stay available. Unfinished responsibilities remain flagged for handoff.</p>}
      <label>Reason (optional)<input name="reason" disabled={busy}/></label>
      {error && <p role="alert">{error}</p>}
      <div class="button-row"><button disabled={busy || !person.length}>{busy ? 'Saving…' : mode === 'remove' ? 'Remove persona' : environment ? 'Add to environment' : 'Invite to work'}</button><button type="button" class="quiet" disabled={busy} onClick={() => setMode('')}>Cancel</button></div>
    </form>}
    {saved && <p role="status">{saved}</p>}
    {!environment && <OrientationInvitations work={subject.id} act={act} open={open}/>}
    {ids.length ? <div class="participant-list">{ids.slice(currentPage * size, (currentPage + 1) * size).map(id => <Person key={id} id={id} open={open} disabled={busy} remove={() => edit('remove', id)}/>)}</div> : <p>No personas selected. Use Add persona to get started.</p>}
    {ids.length > size && <div class="record-pagination"><button class="secondary" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous personas</button><button class="secondary" disabled={(currentPage + 1) * size >= ids.length} onClick={() => setPage(currentPage + 1)}>Next personas</button></div>}
  </section>;
}

function OrientationInvitations({ work, act, open }: { work: string; act: Act; open: (id: string) => void }) {
  const { value, error: loadError } = useRecords('invitation', work);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const pending = value?.items.filter(r => data(r).status === 'offered') || [];
  async function extend(invitation: Entity) {
    if (busy) return; setBusy(invitation.id); setError('');
    try { await act('invitation.extend', { id: invitation.id, revision: invitation.revision, additional_calls: Math.min(2, 16 - Number(data(invitation).orientation_calls)), reason: 'Operator provided additional orientation attempts' }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  return <>{(error || loadError) && <p role="alert">{error || loadError}</p>}{pending.map(invitation => { const d = data(invitation); return <article class={`participant-row${d.orientation_calls_remaining === 0 ? ' needs-input' : ''}`} key={invitation.id}>
    <div><button class="record-title" onClick={() => open(d.to)}>Pending invitation</button><p>{d.orientation_calls_remaining ?? '…'} orientation attempts remaining. Root funding still applies.</p></div>
    <button class="secondary" disabled={!!busy || Number(d.orientation_calls) >= 16} onClick={() => void extend(invitation)}>{busy === invitation.id ? 'Saving…' : 'Add orientation attempts'}</button>
  </article>; })}</>;
}
