import { useState } from 'preact/hooks';
import { data, resourceRequest, type Entity } from './api';
import { useObservation } from './hooks';
import type { Act } from './main';

/** An explicit work-source grant, separate from the selector's processing flags. */
export default function RecallSourceAccess({ run, act }: { run: Entity; act: Act }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const { value, loading, error: readError, retry } = useObservation(`recall-source:${run.scope}`, async signal => {
    const work = await resourceRequest<Entity>(`/records/${run.scope}`, signal);
    if (work.id !== run.scope || work.kind !== 'work') throw new Error('Work source did not match this participation.');
    const ref = data(work).information_policy;
    const policy = ref?.id ? await resourceRequest<Entity>(`/records/${ref.id}`, signal) : null;
    if (policy && (policy.kind !== 'information_policy' || policy.scope !== work.id || policy.revision !== ref.revision)) throw new Error('Source permission changed; refresh before saving.');
    return { work, policy };
  }, e => ['work', 'information_policy'].includes(e.kind));
  const p = value?.policy ? data(value.policy) : {};
  // This small control cannot replace special sharing ledgers or restore withdrawal.
  const complex = value?.policy && (p.status !== 'active' || ['seed_readers', 'response_readers', 'work_readers'].some(k => Array.isArray(p[k]) && p[k].length));
  const readers = [...new Set<string>([...(Array.isArray(p.readers) ? p.readers : []), ...(value && !value.policy && Array.isArray(data(value.work).personas) ? data(value.work).personas : []), data(run).persona])];
  return <form class="development-card" onSubmit={async event => {
    event.preventDefault(); if (!value || loading || readError || busy || complex) return;
    const form = new FormData(event.currentTarget); setBusy(true); setError(''); setSaved(false);
    try {
      await act('information.policy', { subject: value.work.id, revision: value.work.revision, readers, allow_export: form.has('export'), expires: p.expires ?? null, reason: String(form.get('reason')) });
      setSaved(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <h4>Original task source permission</h4>
    <p>Enabling recall does not authorize exporting the task. This separate permission allows the listed readers to export work content, including to JEV when its processing permission is enabled. Source ancestry restrictions still apply.</p>
    {readError && <p role="alert">Could not read source permission. <button type="button" onClick={retry}>Retry source permission</button></p>}
    {loading && <p role="status">Checking source permission…</p>}
    {value && <>
      <p class="micro">Keeps existing explicit readers and includes this persona{!value.policy && ' and the original participants'}. New participants need a separate source grant. Existing expiry is preserved.</p>
      <details><summary>Readers ({readers.length})</summary><ul>{readers.map(id => <li key={id}>{id}</li>)}</ul></details>
      {complex ? <p role="alert">This source has a withdrawal or special sharing policy. Inspect that policy before changing its audience.</p> : <fieldset key={value.work.revision} disabled={busy || loading || Boolean(readError)}>
        <label class="check"><input name="export" type="checkbox" defaultChecked={p.allow_export === true}/>Allow these readers to export this work content</label>
        <label>Source permission reason<textarea name="reason" required rows={2}/></label>
        <button>Save task source permission</button>
      </fieldset>}
    </>}
    {error && <p role="alert">{error}</p>}{saved && <p role="status">Task source permission saved.</p>}
  </form>;
}
