import { useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { useRecords, useResource } from './hooks';
import { label, type Entity } from './api';
import Pagination from './Pagination';
import { Story } from './RecordReader';
import { memoryGraphPath, readMemoryGraph, type MemoryCard as Card, type MemoryGraph as Graph } from './memoryGraph';
const Locator = lazy(() => import('./MemoryLocator'));
const Fragment = lazy(() => import('./MemoryFragment'));
const Activity = lazy(() => import('./MemoryActivity'));
const Tree = lazy(() => import('./MemoryTree'));
import './persona-navigation.css';

function Lesson({ item, owner, open, navigate }: { item: Card; owner: string; open: (id: string) => void; navigate: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false), [utility, setUtility] = useState(false);
  return <li class="memory-graph-item"><article class="memory-card">
    <p class="field-label">{{tentative: 'Idea to test', observed: 'From experience', reported: 'Reported by others'}[item.basis || 'tentative']}</p><h4>{item.title || 'Retained learning'}</h4><Story value={item.short_description}/>{item.applicability && <p class="micro">Applies to: {item.applicability}</p>}{item.limitations && <p class="record-caveat">Limits: {item.limitations}</p>}
    <p class="micro">{item.full_context.status === 'available'
      ? `Full context available: ${item.full_context.fragments} ${item.full_context.fragments === 1 ? 'fragment' : 'fragments'}, including required corrections and prerequisites.`
      : ({ required_context_unavailable: 'Full context unavailable: a required correction or prerequisite cannot be read.',
          required_context_stale: 'Full context needs review: a required fragment has changed.',
          required_context_too_large: 'Full context exceeds the current bundle limit.' }[item.full_context.status])}
      {' '}This card is a preview; availability does not mean it was selected or used.</p>
    <div class="memory-actions">
      <button class="text-button" onClick={() => navigate(item.node.id)}>Explore connections</button><button class="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Close fragment' : 'Read fragment'}</button>{item.locator && <button class="text-button" aria-expanded={utility} onClick={() => setUtility(!utility)}>{utility ? 'Close retrieval utility' : 'How this finds lessons'}</button>}
    </div>
    {utility && <Suspense fallback={<p>Loading retrieval utility…</p>}><Locator key={item.node.id + ":" + item.node.revision} node={item.node.id} revision={item.node.revision} fragment={item.fragment} owner={owner}/></Suspense>}
    {expanded && <Suspense fallback={<p role="status">Loading fragment…</p>}><Fragment key={item.fragment.id + ":" + item.fragment.revision} id={item.fragment.id} revision={item.fragment.revision} owner={owner} open={open}/></Suspense>}
  </article></li>;
}
export default function MemoryGraph({ owner, open }: { owner: string; open: (id: string) => void }) {
  const [focus, setFocus] = useState(''), [pages, setPages] = useState([0]), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [activity, setActivity] = useState(false);
  const [view, setView] = useState<'tree' | 'cards'>('tree');
  const navigate = (id: string) => { setFocus(id); setPages([0]); setQuery(''); setSearch(''); };
  const request = { owner, focus, after: pages.at(-1)!, query };
  const path = memoryGraphPath(request);
  const { value: response, error, loading, retry } = useResource<unknown>(path, e => ['memory_node', 'fragment', 'information_policy'].includes(e.kind), !activity);
  // A failed or refreshing read must not continue displaying a revoked snapshot.
  const decoded = ((): { value?: Graph; error: string } => {
    if (activity || loading || error || response === undefined) return { error: '' };
    try { return { value: readMemoryGraph(response, request), error: '' }; }
    catch (e) { return { error: (e as Error).message }; }
  })();
  const value = decoded.value, graphError = error || decoded.error;
  const cards = (items: Card[]) => <ul class="memory-fragments">{items.map(item => <Lesson key={path+item.node.id} item={item} owner={owner} open={open} navigate={navigate}/>)}</ul>;
  return <section class="memory-graph" aria-label="Fragment graph" aria-busy={!activity && loading}>
    <p class="record-caveat">The persona organizes these prompt fragments. Retaining a lesson does not establish that it was used or improved an outcome.</p>
    <button class="text-button" aria-expanded={activity} onClick={() => setActivity(!activity)}>{activity ? 'Back to fragment graph' : 'View learning activity'}</button>
    {activity ? <Suspense fallback={<p>Loading learning activity…</p>}><Activity owner={owner} open={open}/></Suspense> : <>
      <form class="memory-search" onSubmit={e => {e.preventDefault(); setQuery(search.trim()); setFocus(''); setPages([0]);}}><label>Find learning<input type="search" value={search} maxLength={512} aria-describedby={`memory-search-help-${owner}`} onInput={e => setSearch(e.currentTarget.value)}/></label><button>Search learning</button>{query && <button type="button" class="secondary" onClick={() => navigate('')}>Clear search</button>}</form>
      <p id={`memory-search-help-${owner}`} class="micro">Match whole words in titles and descriptions, in any order. Full fragment text is not searched.</p>
      <nav class="memory-focus" aria-label="Graph navigation"><button class="text-button" onClick={() => navigate('')}>All learning</button>{value?.focus_card && <span aria-current="location">{value.focus_card.title}</span>}</nav>
      {graphError && <p role="alert">Could not load this graph. {graphError} <button class="text-button" onClick={retry}>Try again</button></p>}
      {loading && <p role="status">Loading learning…</p>}
      {value && <><div class="memory-view-toolbar"><div><h3>{query ? 'Matching lessons' : focus ? 'Connected fragments' : 'All fragments'}</h3><p class="micro">{value.items.length + (value.focus_card ? 1 : 0)} fragments · {value.connections.length} connections on this page</p></div>
          <div class="memory-view-switch" role="group" aria-label="Fragment display"><button aria-pressed={view === 'tree'} onClick={() => setView('tree')}>Tree</button><button aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Cards</button></div></div>
        {view === 'tree' ? <><p class="record-caveat">Tree branches follow authored connections on this page, not a fixed hierarchy. Shared fragments and cycles appear as links. Other connections may be on another page.</p><Suspense fallback={<p role="status">Loading fragment tree…</p>}><Tree key={path} graph={value} renderCard={item => cards([item])}/></Suspense></>
          : <>{value.focus_card && cards([value.focus_card])}{cards(value.items)}</>}{!value.items.length && <p>{query ? 'No matching titles or descriptions on this page.' : focus ? 'No available connections here.' : 'No lessons retained yet.'}</p>}
        {query && value.next === null && <p class="record-caveat">End of results for this query. Full fragment text was not searched. Change the search terms or clear the search to browse available descriptions.</p>}
        <Pagination disabled={loading} previous={pages.length > 1} next={value.next} onPrevious={() => setPages(pages.slice(0, -1))} onNext={() => { if (value.next !== null) setPages([...pages, value.next]); }}/>
        {!!value.connections.length && <section aria-label="Authored connections"><h3>Authored connections</h3><p class="micro">Only connections between fragments on this page are shown. Browsing does not select context or establish usefulness.</p>{value.connections.map(edge => {
          const titles = [value.focus_card, ...value.items].filter(Boolean) as Card[];
          const name = (id: string) => titles.find(card => card.node.id === id)?.title || 'Fragment';
          return <article class="memory-card" key={edge.source.id + ':' + edge.target.id + ':' + edge.origin}><p>{name(edge.source.id)} → {name(edge.target.id)}</p>{edge.origin === 'authored_condition' ? <>
            <Story value={edge.explanation}/><p class="micro">{edge.relation} · {edge.mode === 'full' ? 'Full text under delegation' : 'Preview'} · Applicability not evaluated</p>
            <details><summary>Recall condition</summary><pre>{JSON.stringify(edge.condition, null, 2)}</pre>{edge.work && <p>Work: {edge.work}</p>}{edge.expires && <p>Expires: {edge.expires}</p>}</details>
          </> : <p class="micro">Authored association · Preview only · Applicability not evaluated</p>}</article>;
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
