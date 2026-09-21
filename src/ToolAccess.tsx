import { useState } from 'preact/hooks';
import { data, label, type Entity } from './api';
import type { GrantDraft } from './contract';
import type { Act } from './main';
import { useRecords, useResource } from './hooks';
import { recordIDs } from './workspace';
import { RecordReference } from './RecordReader';
import Dialog from './Dialog';

function PersonaOption({ id }: { id: string }) {
  const { value } = useResource<Entity>('/records/' + id, e => e.entity === id);
  return <option value={id} disabled={!value || data(value).lifecycle === 'retired'}>{value ? `${label(value)} · ${data(value).model || 'model not recorded'}` : 'Loading persona…'}</option>;
}

function Permission({ record, act, open }: { record: Entity; act: Act; open: (id: string) => void }) {
  const { value, error } = useResource<Entity>('/records/' + record.id, e => e.entity === record.id);
  const [revoking, setRevoking] = useState(false), [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  if (!value) return <p role={error ? 'alert' : 'status'}>{error || 'Loading permission…'}</p>;
  const d = data(value), expired = Date.parse(d.expires) <= Date.now(), active = d.status === 'active' && !expired;
  const names: Record<string, string> = { exec: 'Local computation', 'artifact.capture': 'Save completed output as a file' };
  return <article class="work-record">
    <header><h3><RecordReference id={d.actor} open={open}/></h3><span class={`state-badge tone-${active ? 'positive' : 'neutral'}`}>{expired && d.status === 'active' ? 'Expired' : active ? 'Allowed' : 'Revoked'}</span></header>
    <p>{(d.operations || []).map((operation: string) => names[operation] || operation.replaceAll('.', ' ')).join(' · ')}</p>
    <p class="micro">Up to {d.max_operations} operations · expires {new Date(d.expires).toLocaleString()}</p>
    {d.execution && <p class="micro">Per computation: {d.execution.wall_ms / 1000} seconds elapsed, {d.execution.cpu_seconds} CPU seconds, {d.execution.memory_bytes / 1048576} MiB memory, {d.execution.output_bytes / 1048576} MiB output.</p>}
    <p>{d.reason}</p>
    {active && <button class="secondary" disabled={busy} onClick={() => setRevoking(!revoking)}>Revoke permission</button>}
    {revoking && <form onSubmit={async e => {
      e.preventDefault(); if (busy) return; const reason = String(new FormData(e.currentTarget).get('reason') || '').trim();
      if (!reason) return; setBusy(true); setFailure('');
      try { await act('grant.revoke', { id: value.id, revision: value.revision, reason }); setRevoking(false); }
      catch (e) { setFailure((e as Error).message); } finally { setBusy(false); }
    }}><label>Reason for revoking<input name="reason" required/></label><p class="micro">Prevents further use. Already completed operations remain recorded.</p>{failure && <p role="alert">{failure}</p>}<button disabled={busy}>{busy ? 'Revoking…' : 'Revoke now'}</button></form>}
  </article>;
}

function whole(form: FormData, key: string, min: number, max: number): number {
  const value = Number(form.get(key));
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Enter whole numbers within the displayed limits.');
  return value;
}

export default function ToolAccess({ work, act, open, close }: { work: Entity; act: Act; open: (id: string) => void; close: () => void }) {
  const [openedAt] = useState(() => Date.now());
  const [person, setPerson] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState('');
  const [cursor, setCursor] = useState([0]);
  const { value: page, error: listError } = useRecords('grant', work.id, '', '', cursor.at(-1));
  const d = data(work), people = recordIDs(d.participant_ids ?? d.personas), archived = d.status === 'archived';
  return <Dialog label="Tool access" close={close}><section class="operator-form">
    <header><h2>Tool access</h2><button type="button" class="quiet" onClick={close}>Close tool access</button></header>
    <p>Allow a persona to run local computations for {label(work)} and save completed output as artifact files. The runtime keeps filesystem access read-only and blocks networking and subprocesses.</p>
    <p class="micro">Each computation and each saved output uses one tool operation from this work’s funding allowance. Funding and permission are both required. This control does not install software or permit physical equipment operation.</p>
    {!archived && <form onInvalidCapture={e => { const details = (e.target as HTMLElement).closest('details'); if (details) details.open = true; }} onSubmit={async e => {
      e.preventDefault(); if (busy) return; const form = new FormData(e.currentTarget); setBusy(true); setError(''); setSaved('');
      try {
        if (!people.includes(person)) throw new Error('Choose a current participant.');
        const reason = String(form.get('reason') || '').trim(); if (!reason) throw new Error('Explain why this access is needed.');
        const draft: GrantDraft = { actor: person, work: work.id, operations: ['exec', 'artifact.capture'],
          expires: new Date(openedAt + whole(form, 'hours', 1, 168) * 3600000).toISOString(),
          max_operations: whole(form, 'operations', 1, 10000), reason,
          execution: { wall_ms: whole(form, 'seconds', 1, 3600) * 1000, cpu_seconds: whole(form, 'cpu', 1, 3600),
            memory_bytes: whole(form, 'memory', 16, 16384) * 1048576, output_bytes: whole(form, 'output', 1, 64) * 1048576 } };
        await act('grant.issue', { draft }); setSaved('Local computation and output capture are allowed. The persona has been notified.'); setPerson('');
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}><fieldset disabled={busy}><legend>Allow local computation</legend>
      <label>Persona<select aria-label="Persona" required value={person} onChange={e => setPerson(e.currentTarget.value)}><option value="">Choose a participant</option>{people.map(id => <PersonaOption key={id} id={id}/>)}</select></label>
      <label>Reason for access<textarea name="reason" required rows={2}/></label>
      <div class="operator-grid">
        <label>Maximum tool operations<input name="operations" type="number" min="1" max="10000" step="1" required defaultValue="60"/></label>
        <label>Access duration (hours)<input name="hours" type="number" min="1" max="168" step="1" required defaultValue="24"/></label>
      </div>
      <details><summary>Limits per computation</summary><div class="operator-grid">
        <label>Elapsed time (seconds)<input name="seconds" type="number" min="1" max="3600" step="1" required defaultValue="60"/></label>
        <label>CPU time (seconds)<input name="cpu" type="number" min="1" max="3600" step="1" required defaultValue="10"/></label>
        <label>Memory (MiB)<input name="memory" type="number" min="16" max="16384" step="1" required defaultValue="256"/></label>
        <label>Output size (MiB)<input name="output" type="number" min="1" max="64" step="1" required defaultValue="4"/></label>
      </div></details>
      {error && <p role="alert">{error}</p>}<button disabled={busy || !person}>{busy ? 'Saving…' : 'Allow computation and files'}</button>
    </fieldset></form>}
    {saved && <p role="status">{saved}</p>}
    <section aria-label="Existing permissions"><h3>Existing permissions</h3>{listError && <p role="alert">{listError}</p>}
      {page?.items.length === 0 && <p>No permissions recorded for this work.</p>}
      {page?.items.map(record => <Permission key={record.id} record={record} act={act} open={open}/>)}
      <div class="button-row"><button class="secondary" disabled={cursor.length < 2} onClick={() => setCursor(cursor.slice(0, -1))}>Previous permissions</button><button class="secondary" disabled={page?.next == null} onClick={() => { if (page?.next != null) setCursor([...cursor, page.next]); }}>Next permissions</button></div>
    </section>
  </section></Dialog>;
}
