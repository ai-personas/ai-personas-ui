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
type Card = { parent?: string | null; child_count?: number; node: Ref; fragment: Ref; title: string; short_description: string; basis?: string; locator?: {description: string} | null };
type Branch = { path: Card[]; related: Card[]; items: Card[]; next: number | null };
function Lesson({ item, owner, open, navigate, depth = 0 }: { item: Card; owner: string; open: (id: string) => void; navigate: (id: string) => void; depth?: number }) {
  const [expanded, setExpanded] = useState(false), [utility, setUtility] = useState(false), [children, setChildren] = useState(false);
  return <li class="memory-tree-item"><article class="memory-card">
    <p class="field-label">{{tentative: 'Idea to test', observed: 'From experience', reported: 'Reported by others'}[item.basis || 'tentative']}</p><h4>{item.title || 'Retained learning'}</h4><Story value={item.short_description}/>
    <div class="memory-actions">
      {!!item.child_count && depth < 6 && <button class="text-button" aria-expanded={children} onClick={() => setChildren(!children)}>{children ? 'Collapse' : 'Expand'} children ({item.child_count})</button>}
      <button class="text-button" onClick={() => navigate(item.node.id)}>Explore branch</button><button class="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Close fragment' : 'Read fragment'}</button>{item.locator && <button class="text-button" aria-expanded={utility} onClick={() => setUtility(!utility)}>{utility ? 'Close retrieval utility' : 'How this finds lessons'}</button>}
    </div>
    {utility && <Suspense fallback={<p>Loading retrieval utility…</p>}><Locator node={item.node.id}/></Suspense>}
    {expanded && <Suspense fallback={<p role="status">Loading fragment…</p>}><Fragment key={item.fragment.id} id={item.fragment.id} owner={owner} open={open}/></Suspense>}
  </article>{children && <Children key={item.node.id} branch={item.node.id} owner={owner} open={open} navigate={navigate} depth={depth+1}/>}</li>;
}
function Children({ branch, owner, open, navigate, depth }: { branch: string; owner: string; open: (id: string) => void; navigate: (id: string) => void; depth: number }) {
  const [pages, setPages] = useState([0]);
  const { value, error, loading, retry } = useResource<Branch>(`/personas/${owner}/memory?limit=12&after=${pages.at(-1)}&branch=${encodeURIComponent(branch)}`, e => ['memory_node','fragment','information_policy'].includes(e.kind));
  return <div class="memory-children">{error && <p role="alert">Could not load children. {error} <button onClick={retry}>Try again</button></p>}{!value && loading && <p role="status">Loading children…</p>}
    <ul class="memory-branches">{value?.items.map(item => <Lesson key={item.node.id} item={item} owner={owner} open={open} navigate={navigate} depth={depth}/>)}</ul>
    {value && !value.items.length && <p>No further branches here.</p>}
    <Pagination disabled={loading} previous={pages.length > 1} next={value?.next} onPrevious={() => setPages(pages.slice(0,-1))} onNext={() => {if (value?.next != null) setPages([...pages,value.next]);}}/>
  </div>;
}
export default function MemoryTree({ owner, open }: { owner: string; open: (id: string) => void }) {
  const [branch, setBranch] = useState(''), [pages, setPages] = useState([0]), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [activity, setActivity] = useState(false);
  const navigate = (id: string) => { setBranch(id); setPages([0]); setQuery(''); setSearch(''); };
  const path = `/personas/${owner}/memory?limit=12&after=${pages.at(-1)}${branch ? '&branch=' + encodeURIComponent(branch) : ''}${query ? '&query='+encodeURIComponent(query) : ''}`;
  const { value, error, loading, retry } = useResource<Branch>(path, e => ['memory_node', 'fragment', 'information_policy'].includes(e.kind), !activity);
  const cards = (items: Card[]) => <ul class="memory-branches">{items.map(item => <Lesson key={path+item.node.id} item={item} owner={owner} open={open} navigate={navigate}/>)}</ul>;
  return <section class="memory-tree" aria-label="Learning tree" aria-busy={!activity && loading}>
    <p class="record-caveat">The persona organizes these prompt fragments. Retaining a lesson does not establish that it was used or improved an outcome.</p>
    <button class="text-button" aria-expanded={activity} onClick={() => setActivity(!activity)}>{activity ? 'Back to learning tree' : 'View learning activity'}</button>
    {activity ? <Suspense fallback={<p>Loading learning activity…</p>}><Activity owner={owner} open={open}/></Suspense> : <>
      <form class="memory-search" onSubmit={e => {e.preventDefault(); setQuery(search.trim()); setBranch(''); setPages([0]);}}><label>Find learning<input type="search" value={search} maxLength={512} onInput={e => setSearch(e.currentTarget.value)}/></label><button>Search learning</button>{query && <button type="button" class="secondary" onClick={() => navigate('')}>Clear search</button>}</form>
      <nav class="memory-path" aria-label="Learning path"><button class="text-button" onClick={() => navigate('')}>All learning</button>{value?.path.map(item => <button class="text-button" key={item.node.id} aria-current={item.node.id === branch ? 'location' : undefined} onClick={() => navigate(item.node.id)}>{item.title}</button>)}</nav>
      {error && <p role="alert">Could not load this branch. {error} <button class="text-button" onClick={retry}>Try again</button></p>}
      {!value && loading && <p role="status">Loading learning…</p>}
      {value && <>{!!value.path.length && cards([value.path[value.path.length - 1]])}<h3>{query ? 'Matching lessons' : branch ? 'Within this branch' : 'Learning branches'}</h3>{cards(value.items)}{!value.items.length && <p>{query ? 'No matching lessons.' : branch ? 'No further branches here.' : 'No lessons retained yet.'}</p>}
        <Pagination disabled={loading} previous={pages.length > 1} next={value.next} onPrevious={() => setPages(pages.slice(0, -1))} onNext={() => { if (value.next !== null) setPages([...pages, value.next]); }}/>
        {!!value.related.length && <><h3>Related branches</h3><p class="micro">Cross-links chosen by the persona.</p>{cards(value.related)}</>}</>}
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
    {owner && <MemoryTree key={owner} owner={owner} open={open}/>}
  </section>;
}
