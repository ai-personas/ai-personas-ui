import { useEffect, useState } from 'preact/hooks';
import { data, request, type Entity, type Action, type Page } from './api';
import type { Act } from './main';
import { recordIDs } from './workspace';

/** Operator-authored recovery. It changes active context, never retained history. */
export default function ContextRecovery({ run, act }: { run: Entity; act: Act }) {
  const [show, setShow] = useState(false), [through, setThrough] = useState(''), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [saved, setSaved] = useState('');
  const d = data(run), stopped = ['waiting', 'paused'].includes(d.status) && d.membership === 'accepted';
  useEffect(() => {
    if (!show) return;
    const controller = new AbortController(); setThrough(''); setError('');
    void (async () => {
      let after = 0, last = '';
      for (let n = 0; n < 100; n++) {
        const page = await request<Page<Action>>('/actions?' + new URLSearchParams({ owner: d.persona, scope: run.id, after: String(after), limit: '100' }), { signal: controller.signal });
        last = page.items.at(-1)?.request.id || last;
        if (page.next == null) { if (!last) throw new Error('There is no action history to reduce.'); setThrough(last); return; }
        if (page.next <= after) throw new Error('The history cursor did not advance. Reopen this form to retry.');
        after = page.next;
      }
      throw new Error('This history is too large for the recovery form.');
    })().catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [show, run.id]);
  if (!stopped && !show) return null;
  return <section class="context-recovery">
    <button class="secondary" disabled={busy} onClick={() => { setShow(!show); setSaved(''); }}>Reduce active context</button>
    {show && <form onSubmit={async e => {
      e.preventDefault(); if (busy || !through || !stopped) return;
      const f = new FormData(e.currentTarget), summary = String(f.get('summary') || '').trim();
      if (!summary) return; setBusy(true); setError('');
      try {
        await act('context.compact', { through, summary, records: f.has('keep') ? recordIDs(d.selected) : [], actions: [] }, d.persona, run.id);
        setShow(false); setSaved('Active context reduced. Saved files and history remain available. Use Resume to continue.');
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>
      <p>Replace earlier action details in this participation’s active context with your handoff note. The current task, identity and obligations remain supplied. Saved history and files can still be inspected.</p>
      <label>Handoff note<textarea name="summary" rows={5} required maxLength={12000} defaultValue={'Operator context recovery: earlier actions remain in saved history. Inspect the current task, saved outputs and latest input before continuing. Do not infer successful checks from prior attempts.'}/></label>
      <p class="micro">This is an operator note, not a persona’s learned memory. It does not change permissions, funding or acceptance.</p>
      {recordIDs(d.selected).length > 0 && <label class="check"><input type="checkbox" name="keep" defaultChecked/>Keep the {recordIDs(d.selected).length} currently selected records</label>}
      {!through && !error && <p role="status">Loading the current history boundary…</p>}
      {!stopped && <p role="alert">Pause this participation before changing its active context.</p>}
      {error && <p role="alert">{error}</p>}
      <div class="button-row"><button disabled={busy || !through || !stopped}>{busy ? 'Saving…' : 'Save smaller context'}</button><button type="button" class="quiet" disabled={busy} onClick={() => setShow(false)}>Keep current context</button></div>
    </form>}
    {saved && <p role="status">{saved}</p>}
  </section>;
}
