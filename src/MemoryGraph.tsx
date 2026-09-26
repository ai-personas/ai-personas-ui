import { useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { useRecords, useResource } from './hooks';
import { label, type Entity } from './api';
import Pagination from './Pagination';
import { Story } from './RecordReader';
const Locator = lazy(() => import('./MemoryLocator'));
const Fragment = lazy(() => import('./MemoryFragment'));
const Activity = lazy(() => import('./MemoryActivity'));

type Ref = { id: string; revision: number };
type Card = { node: Ref; fragment: Ref; title: string; short_description: string; basis?: string; locator?: {description: string} | null };
type Graph = { focus_card: Card | null; items: Card[]; connections: {source: Ref; target: Ref; origin: string; relation?: string; explanation?: string; condition?: unknown; mode: string; applicability: string}[]; next: number | null };
function Lesson({ item, owner, open, navigate }: { item: Card; owner: string; open: (id: string) => void; navigate: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false), [utility, setUtility] = useState(false);
  return <li class="memory-graph-item"><article class="memory-card">
    <p class="field-label">{{tentative: 'Idea to test', observed: 'From experience', reported: 'Reported by others'}[item.basis || 'tentative']}</p><h4>{item.title || 'Retained learning'}</h4><Story value={item.short_description}/>
    <div class="memory-actions">
      <button class="text-button" onClick={() => navigate(item.node.id)}>Explore connections</button><button class="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Close fragment' : 'Read fragment'}</button>{item.locator && <button class="text-button" aria-expanded={utility} onClick={() => setUtility(!utility)}>{utility ? 'Close retrieval utility' : 'How this finds lessons'}</button>}
    </div>
    {utility && <Suspense fallback={<p>Loading retrieval utility…</p>}><Locator node={item.node.id}/></Suspense>}
    {expanded && <Suspense fallback={<p role="status">Loading fragment…</p>}><Fragment key={item.fragment.id} id={item.fragment.id} owner={owner} open={open}/></Suspense>}
  </article></li>;
}
export default function MemoryGraph({ owner, open }: { owner: string; open: (id: string) => void }) {
  const [focus, setFocus] = useState(''), [pages, setPages] = useState([0]), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [activity, setActivity] = useState(false);
  const navigate = (id: string) => { setFocus(id); setPages([0]); setQuery(''); setSearch(''); };
  const path = `/personas/${owner}/memory?limit=12&after=${pages.at(-1)}${focus ? '&focus=' + encodeURIComponent(focus) : ''}${query ? '&query='+encodeURIComponent(query) : ''}`;
  const { value, error, loading, retry } = useResource<Graph>(path, e => ['memory_node', 'fragment', 'information_policy'].includes(e.kind), !activity);
  const cards = (items: Card[]) => <ul class="memory-fragments">{items.map(item => <Lesson key={path+item.node.id} item={item} owner={owner} open={open} navigate={navigate}/>)}</ul>;
  return <section class="memory-graph" aria-label="Fragment graph" aria-busy={!activity && loading}>
    <p class="record-caveat">The persona organizes these prompt fragments. Retaining a lesson does not establish that it was used or improved an outcome.</p>
    <button class="text-button" aria-expanded={activity} onClick={() => setActivity(!activity)}>{activity ? 'Back to fragment graph' : 'View learning activity'}</button>
    {activity ? <Suspense fallback={<p>Loading learning activity…</p>}><Activity owner={owner} open={open}/></Suspense> : <>
      <form class="memory-search" onSubmit={e => {e.preventDefault(); setQuery(search.trim()); setFocus(''); setPages([0]);}}><label>Find learning<input type="search" value={search} maxLength={512} aria-describedby={`memory-search-help-${owner}`} onInput={e => setSearch(e.currentTarget.value)}/></label><button>Search learning</button>{query && <button type="button" class="secondary" onClick={() => navigate('')}>Clear search</button>}</form>
      <p id={`memory-search-help-${owner}`} class="micro">Match whole words in lesson titles and descriptions, in any order.</p>
      <nav class="memory-focus" aria-label="Graph navigation"><button class="text-button" onClick={() => navigate('')}>All learning</button>{value?.focus_card && <span aria-current="location">{value.focus_card.title}</span>}</nav>
      {error && <p role="alert">Could not load this graph. {error} <button class="text-button" onClick={retry}>Try again</button></p>}
      {!value && loading && <p role="status">Loading learning…</p>}
      {value && <>{value.focus_card && cards([value.focus_card])}<h3>{query ? 'Matching lessons' : focus ? 'Connected fragments' : 'All fragments'}</h3>{cards(value.items)}{!value.items.length && <p>{query ? 'No matching lessons.' : focus ? 'No available connections here.' : 'No lessons retained yet.'}</p>}
        <Pagination disabled={loading} previous={pages.length > 1} next={value.next} onPrevious={() => setPages(pages.slice(0, -1))} onNext={() => { if (value.next !== null) setPages([...pages, value.next]); }}/>
        {!!value.connections.length && <section aria-label="Authored connections"><h3>Authored connections</h3>{value.connections.map((edge, index) => {
          const titles = [value.focus_card, ...value.items].filter(Boolean) as Card[];
          const name = (id: string) => titles.find(card => card.node.id === id)?.title || 'Fragment';
          return <article class="memory-card" key={index}><p>{name(edge.source.id)} → {name(edge.target.id)}</p>{edge.explanation && <Story value={edge.explanation}/>}<p class="micro">{edge.relation || 'Association'} · {edge.mode === 'full' ? 'Full text under delegation' : 'Preview'} · {edge.applicability.replaceAll('_', ' ')}</p>{edge.condition != null && <details><summary>Recall condition</summary><pre>{JSON.stringify(edge.condition, null, 2)}</pre></details>}</article>;
        })}</section>}</>}
    </>}
  </section>;
}
export function LearningLibrary({ open }: { open: (id: string) => void }) {
  const [owner, setOwner] = useState(''), [pages, setPages] = useState([0]);
  const { value, error, loading } = useRecords('persona', '', '', '', pages.at(-1)!);
  return <section class="learning-library"><h2>Learning by persona</h2><p>Explore how each persona organizes its experience.</p>{error && <p role="alert">{error}</p>}
    <div class="memory-owners">{value?.items.map((p: Entity) => <button class="secondary" key={p.id} aria-pressed={owner === p.id} onClick={() => setOwner(owner === p.id ? '' : p.id)}>{label(p)}</button>)}</div>
    {value && !value.items.length && <p>Create personas to begin.</p>}
    <Pagination disabled={loading} previous={pages.length > 1} next={value?.next} onPrevious={() => setPages(pages.slice(0,-1))} onNext={() => { if (value?.next != null) setPages([...pages,value.next]); }}/>
    {owner && <MemoryGraph key={owner} owner={owner} open={open}/>}
  </section>;
}
