import { useCallback, useEffect, useState } from 'preact/hooks';
import { data, label, type Entity } from './api';
import { useResource } from './hooks';
import { isRecordID, text } from './workspace';
import { rememberPersona } from './recentPersonas';
import Icon from './Icon';
import './persona-navigation.css';

/** App-owned state survives page navigation, but not disconnect or reload. */
export function useRecentPersonas(selected: string | undefined, connected: boolean) {
  const [ids, setIDs] = useState<string[]>([]);
  const clear = useCallback(() => setIDs([]), []);
  const { value, error, loading } = useResource<Entity>(
    '/records/' + encodeURIComponent(selected || ''),
    event => event.entity === selected || event.kind === 'information_policy',
    connected && isRecordID(selected),
  );
  useEffect(() => {
    if (!connected) { clear(); return; }
    if (!loading && !error && value?.kind === 'persona' && value.id === selected) {
      setIDs(previous => previous[0] === value.id ? previous : rememberPersona(previous, value.id));
    }
  }, [connected, selected, value?.id, value?.kind, loading, error, clear]);
  return { ids: connected ? ids : [], clear };
}

function RecentPersona({ id, open }: { id: string; open: (id: string) => void }) {
  const { value, error, loading, retry } = useResource<Entity>(
    '/records/' + encodeURIComponent(id),
    event => event.entity === id || event.kind === 'information_policy',
  );
  // Hide stale names on revalidation, denial, deletion, or a mismatched response.
  if (loading) return <li class="recent-persona recent-placeholder" aria-busy="true">Loading persona…</li>;
  if (error || !value || value.id !== id || value.kind !== 'persona') return <li class="recent-persona recent-unavailable">
    <span>Persona unavailable</span><button class="text-button" onClick={retry}>Retry shortcut</button>
  </li>;
  const name = label(value);
  return <li><button class="recent-persona" onClick={() => open(id)} aria-label={`Reopen ${name}`}>
    <span class="recent-persona-symbol" aria-hidden="true"><Icon name="Personas"/></span>
    <span class="recent-persona-copy"><strong>{name}</strong><small>{text(data(value).lifecycle, 'Lifecycle not recorded').replaceAll('_', ' ')}</small></span>
    <Icon name="Open"/>
  </button></li>;
}

export default function RecentPersonas({ ids, clear, open }: { ids: string[]; clear: () => void; open: (id: string) => void }) {
  return <section class="recent-personas" aria-labelledby="recent-personas-title">
    <header><div><p class="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2 id="recent-personas-title">Recent personas</h2></div>
      {ids.length > 0 && <button class="text-button" onClick={clear}>Clear recent personas</button>}
    </header>
    <p class="micro">Recently opened in this connection, newest first. This is browsing history, not persona activity.</p>
    {ids.length ? <ul class="recent-persona-list">{ids.map(id => <RecentPersona key={id} id={id} open={open}/>)}</ul>
      : <p class="recent-empty">Open a persona below to keep it within reach here.</p>}
  </section>;
}
