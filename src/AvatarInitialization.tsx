import { measuredUsage } from './inference-evidence';
import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { fields, isRecordID, text } from './workspace';
import type { Act } from './main';

export default function AvatarInitialization({ persona, act, open }: { persona: Entity; act: Act; open: (id: string) => void }) {
  const d = data(persona), init = fields(d.avatar_initialization), state = text(init.status);
  const result = fields(init.result), image = fields(result.image);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = ['pending', 'running'].includes(state), ready = state === 'ready';
  if (!state && isRecordID(d.portrait)) return null;
  return <section class="development-card" aria-label="Avatar generation">
    <h4>{ready ? 'Generated avatar' : 'Persona avatar'}</h4>
    <p role="status">{ready ? 'Created from this persona’s starting characteristics.' : state === 'running' ? 'Generating an avatar…' : state === 'pending' ? 'Avatar generation waits for the starting character, then runs without blocking work.' : state === 'supplied' ? 'An existing portrait is in use.' : 'Avatar generation is available when an image connection and priced allowance are configured.'}</p>
    {text(init.model) && <p class="micro">Requested model: {text(init.provider)} / {text(init.model)}</p>}
    {ready && text(result.actual_model) && <p class="micro">Provider-reported model: {text(result.actual_model)}{text(result.image_model) && result.image_model !== result.actual_model ? ` · Image model: ${text(result.image_model)}` : ''}</p>}
    {ready && typeof image.width === 'number' && typeof image.height === 'number' && <p class="micro">{text(image.format).toUpperCase()} · {image.width} × {image.height}</p>}
    {text(init.error) && <p class="notice">{text(init.error)}</p>}
    {ready && result.billing === 'subscription' && <p class="notice">Subscription image generation: $0 incremental API charge. Subscription limits and possible credit consumption are unknown and are not priced by this allowance.</p>}
    {ready && init.usage_known === false && <p class="notice">Complete image usage is unknown. The full admitted reservation remains accounted.</p>}
    {ready && measuredUsage(result.controller_usage) && <p class="micro">A partial controller usage receipt is available in the image generation call. It excludes image generation usage and does not establish total consumption.</p>}
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
