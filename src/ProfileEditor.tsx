import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import type { Act } from './main';
import ProfileFields, { profileInput } from './ProfileFields';

export default function ProfileEditor({ persona, act, close }: { persona: Entity; act: Act; close: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [original] = useState(persona);
  const stale = original.revision !== persona.revision;
  return <form class="development-card" onSubmit={async event => {
    event.preventDefault(); if (busy || stale) return; const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const receipt = await act('persona.profile.configure', { id: original.id, revision: original.revision, ...profileInput(form), self_authorship: form.has('self_authorship'), reason: String(form.get('reason')) });
      if ((receipt.result as any)?.conflict) throw new Error('The persona changed while you were editing. Refresh the profile before applying your changes.');
      close();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <ProfileFields value={data(original)}/>
    <label>Reason for this change<textarea name="reason" required rows={2}/></label>
    {error && <p role="alert">{error}</p>}
    {stale && <p role="alert">The profile changed while you were editing. Your draft is retained here; close and reopen the editor to review the current profile before saving.</p>}
    <button disabled={busy || stale}>{busy ? 'Saving…' : 'Save your changes'}</button><button type="button" class="secondary" disabled={busy} onClick={close}>Cancel edit</button>
  </form>;
}
