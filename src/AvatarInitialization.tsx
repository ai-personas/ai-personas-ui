import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { fields, isRecordID, text } from './workspace';
import type { Act } from './main';

export default function AvatarInitialization({ persona, act, open }: { persona: Entity; act: Act; open: (id: string) => void }) {
  const d = data(persona), init = fields(d.avatar_initialization), state = text(init.status);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = ['pending', 'running'].includes(state), ready = state === 'ready';
  if (!state && isRecordID(d.portrait)) return null;
  return <section class="development-card" aria-label="Avatar generation">
    <h4>{ready ? 'Generated avatar' : 'Persona avatar'}</h4>
    <p role="status">{ready ? 'Created from this persona’s starting characteristics.' : state === 'running' ? 'Generating an avatar…' : state === 'pending' ? 'Avatar generation waits for the starting character, then runs without blocking work.' : state === 'supplied' ? 'An existing portrait is in use.' : 'Avatar generation is available when an image connection and priced allowance are configured.'}</p>
    {text(init.model) && <p class="micro">{text(init.provider)} / {text(init.model)} · Low quality, 1024 × 1024</p>}
    {text(init.error) && <p class="notice">{text(init.error)}</p>}
    {ready && init.usage_known === false && <p class="notice">The image arrived without a complete usage receipt. Its reserved spending remains accounted.</p>}
    {!ready && state !== 'supplied' && <><p class="micro">Uses the lowest reserved cost among enabled, available image models priced in this persona’s allowance. Character creation and work can continue without an avatar. A new attempt uses a new funded call.</p>
      <div class="button-row"><button class="secondary" disabled={busy} onClick={async () => {
        if (busy) return; setBusy(true); setError('');
        try { await act(pending ? 'persona.avatar.cancel' : 'persona.avatar.retry', { id: persona.id, revision: persona.revision }); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? 'Saving…' : pending ? 'Cancel avatar generation' : 'Generate avatar'}</button>
      {isRecordID(d.resource_root) && <button class="text-button" onClick={() => open(d.resource_root)}>View avatar allowance</button>}</div></>}
    {isRecordID(init.call) && <button class="text-button" onClick={() => open(text(init.call))}>Inspect image generation call</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
