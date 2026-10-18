import { useState } from 'preact/hooks';
import type { Command } from './api';
import { useResource } from './hooks';
import type { Act } from './main';

type Policy = Extract<Command, { kind: 'storage.configure' }>['args']['policy'];
type Storage = {
  policy: { revision: number; policy: Policy; reason: string };
  database: { page_bytes: number; free_pages: number; limit: number; protected_bytes: number; ordinary_remaining: number; within_limit: boolean; reclamation: string };
  corpora: { owner: string; kind: string; records: number; bytes: number }[];
  corpora_complete: boolean;
  filesystem: { regular_files: number; logical_bytes: number; allocated_bytes: number; scan_complete: boolean; gaps: string[]; consistency: string };
  total_managed_bound_verified: boolean;
  uncovered: string[];
};
const bytes = (n: number) => `${n.toLocaleString()} bytes`;
const fields: { key: keyof Policy; label: string; min: number }[] = [
  { key: 'characteristic_bytes', label: 'Characteristic files per persona', min: 12000 },
  { key: 'supporting_bytes', label: 'Supporting files per persona', min: 65536 },
  { key: 'database_page_bytes', label: 'Total database pages', min: 16777216 },
  { key: 'protected_database_bytes', label: 'Database capacity reserved for warnings and finishing', min: 1048576 },
];

export default function StorageSettings({ act }: { act: Act }) {
  const { value, error: readError, loading, retry } = useResource<Storage>('/storage', () => false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  return <section aria-label="Storage limits" aria-busy={loading || busy}>
    <header class="page-heading"><div><h2>Storage limits</h2><p>Limit persona files and database growth while reserving room for warnings and finishing.</p></div>
      <button class="secondary" disabled={loading || busy} onClick={retry}>Refresh usage</button></header>
    {(readError || error) && <p role="alert">{readError || error}</p>}
    {loading && <p role="status">Reading current storage…</p>}
    {value && <>
      <p>Database: {bytes(value.database.page_bytes)} of {bytes(value.database.limit)}. Ordinary capacity remaining: {bytes(value.database.ordinary_remaining)}.</p>
      <p class="micro">Database usage includes histories, revisions, indexes and allocated free pages. {value.database.reclamation}</p>
      {!value.database.within_limit && <p role="alert">Existing database allocation exceeds the configured limit. Optional writes are blocked; an explicit capacity or retention decision is needed.</p>}
      <p>Observed node files: {bytes(value.filesystem.logical_bytes)} logical, {bytes(value.filesystem.allocated_bytes)} allocated, across {value.filesystem.regular_files.toLocaleString()} regular files.</p>
      {!value.total_managed_bound_verified && <p class="notice">A complete storage quota is not enforced. {value.uncovered.join('. ')}.</p>}
      {!value.filesystem.scan_complete && <p role="alert">The filesystem observation is incomplete: {value.filesystem.gaps.join('. ')}.</p>}
      <p class="micro">Usage is a snapshot; refresh to see later writes. Retiring a file removes it from the current corpus but does not reclaim its historical versions.</p>
      <details><summary>Current persona file usage</summary>
        <p class="micro">Counts include full retained records and metadata. Historical versions remain charged to the database limit.</p>
        {value.corpora.length ? <table><thead><tr><th>Persona</th><th>Files</th><th>Current usage / limit</th></tr></thead><tbody>
          {value.corpora.map(row => <tr key={row.owner + row.kind}><td>{row.owner}</td><td>{row.records} {row.kind === 'fragment' ? 'characteristic' : 'supporting'}</td>
            <td>{bytes(row.bytes)} / {bytes(row.kind === 'fragment' ? value.policy.policy.characteristic_bytes : value.policy.policy.supporting_bytes)}</td></tr>)}
        </tbody></table> : <p>No retained persona files.</p>}
        {!value.corpora_complete && <p>Only the first 256 persona/file-kind groups are shown.</p>}
      </details>
      <form key={value.policy.revision} class="operator-form" onSubmit={async e => {
        e.preventDefault(); if (busy || loading || readError) return;
        const form = new FormData(e.currentTarget); setBusy(true); setError(''); setSaved(false);
        try {
          const policy = { ...value.policy.policy };
          for (const field of fields) {
            const n = Number(form.get(field.key));
            if (!Number.isSafeInteger(n) || n < field.min) throw new Error(`${field.label} must be a whole number of at least ${field.min.toLocaleString()} bytes.`);
            policy[field.key] = n;
          }
          if (policy.protected_database_bytes >= policy.database_page_bytes) throw new Error('Reserved capacity must be smaller than the total database limit.');
          const reason = String(form.get('reason') || '').trim();
          if (!reason) throw new Error('Explain the capacity change.');
          await act('storage.configure', { revision: value.policy.revision, policy, reason });
          setSaved(true); retry();
        } catch (e) { setError((e as Error).message); retry(); } finally { setBusy(false); }
      }}>
        <fieldset disabled={busy || loading || !!readError}><legend>Limits in bytes</legend><div class="operator-grid">
          {fields.map(field => <label key={field.key}>{field.label}<input name={field.key} type="number" min={field.min} max={Number.MAX_SAFE_INTEGER} step="1" required defaultValue={value.policy.policy[field.key]}/></label>)}
        </div><label>Reason for change<input name="reason" required maxLength={4000}/></label>
          <p class="micro">The runtime rejects limits below current occupancy and the required reserve. Saving limits does not resume work or change model funding.</p>
          <button>{busy ? 'Saving…' : 'Save storage limits'}</button>
        </fieldset>
      </form>
      {saved && <p role="status">Storage limits saved.</p>}
    </>}
  </section>;
}
