import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { fields, text } from './workspace';
import type { Act } from './main';
export default function CharacterInitialization({ persona, act }: { persona: Entity; act?: Act }) {
  const init = fields(data(persona).character_initialization), state = text(init.status);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!state || state === 'ready') return text(init.invitation_error) ? <p class="notice">Character is ready, but the invitation could not be delivered: {text(init.invitation_error)}</p> : null;
  const pending = state === 'pending' || state === 'running';
  async function change() {
    if (!act || busy) return;
    setBusy(true); setError('');
    try { await act(pending ? 'persona.initialization.cancel' : 'persona.initialization.retry', { id: persona.id, revision: persona.revision }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div class="notice" role="status" aria-label="Character initialization">
    <strong>{state === 'running' ? 'Writing a starting character…' : state === 'pending' ? 'Character generation is queued.' : state === 'uncertain' ? 'Character generation was interrupted.' : state === 'cancelled' ? 'Character generation was cancelled.' : 'Character generation needs attention.'}</strong>
    <p>{pending ? 'This persona will be available for work once its character is ready.' : 'Work is waiting for a completed character. Retry starts a new funded call; earlier usage remains accounted.'}</p>
    {text(init.error) && <p>{text(init.error)}</p>}
    {act && <button type="button" class="secondary" disabled={busy} onClick={() => void change()}>{busy ? 'Saving…' : pending ? 'Cancel character generation' : 'Retry character generation'}</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
