import { useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { useRecords, useResource } from './hooks';
import { label, type Entity } from './api';
import Pagination from './Pagination';
import { Story } from './RecordReader';
const Fragment = lazy(() => import('./MemoryFragment'));

type Ref = { id: string; revision: number };
type Card = { node: Ref; fragment: Ref; title: string; short_description: string };
type Branch = { path: Card[]; related: Card[]; items: Card[]; next: number | null };
export default function MemoryTree({ owner, open }: { owner: string; open: (id: string) => void }) {
  const [branch, setBranch] = useState(''), [pages, setPages] = useState([0]), [expanded, setExpanded] = useState('');
  const navigate = (id: string) => { setBranch(id); setPages([0]); setExpanded(''); };
  const path = `/personas/${owner}/memory?limit=12&after=${pages.at(-1)}${branch ? '&branch=' + encodeURIComponent(branch) : ''}`;
  const { value, error, loading, retry } = useResource<Branch>(path, e => ['memory_node', 'fragment', 'information_policy'].includes(e.kind));
  const cards = (items: Card[]) => <div class="memory-cards">{items.map(item => <article class="memory-card" key={item.node.id}>
    <h4>{item.title || 'Retained learning'}</h4><Story value={item.short_description}/>
    <div class="memory-actions"><button class="text-button" onClick={() => navigate(item.node.id)}>Explore branch</button><button class="text-button" aria-expanded={expanded === item.node.id} onClick={() => setExpanded(expanded === item.node.id ? '' : item.node.id)}>{expanded === item.node.id ? 'Close fragment' : 'Read fragment'}</button></div>
    {expanded === item.node.id && <Suspense fallback={<p role="status">Loading fragment…</p>}><Fragment key={item.fragment.id} id={item.fragment.id} owner={owner} open={open}/></Suspense>}
  </article>)}</div>;
  return <section class="memory-tree" aria-label="Learning tree" aria-busy={loading}>
    <p class="record-caveat">The persona organizes these prompt fragments. Retaining a lesson does not establish that it was used or improved an outcome.</p>
    <nav class="memory-path" aria-label="Learning path"><button class="text-button" onClick={() => navigate('')}>All learning</button>{value?.path.map(item => <button class="text-button" key={item.node.id} aria-current={item.node.id === branch ? 'location' : undefined} onClick={() => navigate(item.node.id)}>{item.title}</button>)}</nav>
    {error && <p role="alert">Could not load this branch. {error} <button class="text-button" onClick={retry}>Try again</button></p>}
    {!value && loading && <p role="status">Loading learning…</p>}
    {value && <>{!!value.path.length && cards([value.path[value.path.length - 1]])}<h3>{branch ? 'Within this branch' : 'Learning branches'}</h3>{cards(value.items)}{!value.items.length && <p>{branch ? 'No further branches here.' : 'No lessons retained yet.'}</p>}
      <Pagination disabled={loading} previous={pages.length > 1} next={value.next} onPrevious={() => { setPages(pages.slice(0, -1)); setExpanded(''); }} onNext={() => { if (value.next !== null) { setPages([...pages, value.next]); setExpanded(''); } }}/>
      {!!value.related.length && <><h3>Related branches</h3>{cards(value.related)}</>}</>}
  </section>;
}
export function LearningLibrary({ open }: { open: (id: string) => void }) {
  const [owner, setOwner] = useState(''), [pages, setPages] = useState([0]);
  const { value, error, loading } = useRecords('persona', '', '', '', pages.at(-1)!);
  return <section class="learning-library"><h2>Learning by persona</h2><p>Explore how each persona organizes its experience.</p>{error && <p role="alert">{error}</p>}
    <div class="memory-owners">{value?.items.map((p: Entity) => <button class="secondary" key={p.id} aria-pressed={owner === p.id} onClick={() => setOwner(owner === p.id ? '' : p.id)}>{label(p)}</button>)}</div>
    {value && !value.items.length && <p>Create personas to begin.</p>}
    <Pagination disabled={loading} previous={pages.length > 1} next={value?.next} onPrevious={() => setPages(pages.slice(0,-1))} onNext={() => { if (value?.next != null) setPages([...pages,value.next]); }}/>
    {owner && <MemoryTree key={owner} owner={owner} open={open}/>}
  </section>;
}
