import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import type { Act } from './main';
import ProfileFields, { profileInput } from './ProfileFields';

export default function ProfileEditor({ persona, act, close }: { persona: Entity; act: Act; close: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <form class="development-card" onSubmit={async event => {
    event.preventDefault(); if (busy) return; const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const receipt = await act('persona.profile.configure', { id: persona.id, revision: persona.revision, ...profileInput(form), self_authorship: form.has('self_authorship'), reason: String(form.get('reason')) });
      if ((receipt.result as any)?.conflict) throw new Error('The persona changed while you were editing. Refresh the profile before applying your changes.');
      close();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <ProfileFields value={data(persona)}/>
    <label>Reason for this change<textarea name="reason" required rows={2}/></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{busy ? 'Saving…' : 'Save your changes'}</button><button type="button" class="secondary" disabled={busy} onClick={close}>Cancel edit</button>
  </form>;
}
