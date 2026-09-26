import { lazy, Suspense } from 'preact/compat';
import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { useObservation } from './hooks';
import { readCurrentSelf } from './currentSelf';
const Fragment = lazy(() => import('./MemoryFragment'));

export default function CurrentSelf({ persona, open }: { persona: Entity; open: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const designated = data(persona).self_model != null;
  const current = useObservation(`current-self:${persona.id}:${persona.revision}`, signal => readCurrentSelf(persona, signal),
    e => e.entity === persona.id || ['memory_node', 'fragment', 'information_policy'].includes(e.kind), designated);
  if (!designated) return <><p class="record-prose">{typeof data(persona).character === 'string' && data(persona).character || 'No narrative character is recorded yet.'}</p><p class="micro">No self-fragments are designated yet. This is the current profile character; the starting profile remains provenance.</p></>;
  return <section aria-label="Current self-model" aria-busy={current.loading}>
    {current.loading ? <p role="status">Checking current self-fragments…</p> : current.error ? <p role="alert">Could not verify the current self-model. {current.error} <button onClick={current.retry}>Retry self-model</button></p> : current.value && <>
      <p class="record-prose">{current.value.character}</p>
      <p class="micro">Derived from {current.value.parts.length} exact self-fragment{current.value.parts.length === 1 ? '' : 's'} · designation revision {current.value.revision}.</p>
      <button class="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide self-fragment sources' : 'Inspect self-fragment sources'}</button>
      {expanded && current.value.parts.map(part => <article key={part.node.id + ':' + part.node.revision} class="development-card"><h4>{part.title}</h4><p class="micro">Graph node revision {part.node.revision} · fragment revision {part.fragment.revision}</p><Suspense fallback={<p>Loading self-fragment…</p>}><Fragment id={part.fragment.id} revision={part.fragment.revision} owner={persona.id} open={open}/></Suspense></article>)}
    </>}
  </section>;
}
