import { render } from 'preact';
import { lazy, Suspense } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { connect, data, label, operate, request, token, watch, fileURL, type Entity, type Command } from './api';
import { useDebounced, useRecords, useResource } from './hooks';
import { text, isRecordID, workFacts, stateTone } from './workspace';
import './style.css';
import './workspace.css';
const Detail = lazy(() => import('./Detail'));
const Viewer = lazy(() => import('./Viewer'));
const Create = lazy(() => import('./Create'));
const Workspace = lazy(() => import('./Workspace'));
const pages = ['Work', 'Personas', 'Environments', 'Learning', 'Tools'] as const;
type View = typeof pages[number] | 'Network';
const kinds: Record<View, string> = { Work: 'work', Personas: 'persona', Environments: 'environment', Learning: 'fragment,document', Tools: 'tool,capability', Network: 'transfer' };
export function Status({ value }: { value: string }) { return <span class={'status tone-' + stateTone(value)}>{value.replaceAll('_', ' ') || 'Not recorded'}</span>; }
export function Facts({ r }: { r: Entity }) {
  const d = data(r);
  if (r.kind !== 'work') return text(d.status) ? <Status value={d.status}/> : null;
  const f = workFacts(r);
  return <div class="facts"><span>{f.activity}</span><span>{f.submissions === undefined ? 'Submission count not reported' : `${f.submissions} preserved submissions`} · acceptance not established</span>
    {f.pendingRequests !== undefined && f.pendingRequests > 0 && <span class="needs">{f.pendingRequests} unresolved outside requests</span>}</div>;
}
export function Portrait({ id, name }: { id?: string; name: string }) {
  return isRecordID(id) ? <BoundedPortrait id={id} name={name}/> : <span class="portrait placeholder" aria-label="Image not authored">◌</span>;
}
function BoundedPortrait({ id, name }: { id: string; name: string }) {
  const { value: r } = useResource<Entity>('/records/' + id, e => e.entity === id);
  const [failed, setFailed] = useState(false), d = r ? data(r) : {};
  // No thumbnail endpoint exists in v1. Do not fetch multi-megabyte originals for a list avatar.
  const safe = !failed && r?.kind === 'artifact' && Number.isSafeInteger(d.size) && d.size >= 0 && d.size <= 512_000 && ['image/png', 'image/jpeg', 'image/webp'].includes(d.media_type);
  return safe ? <img class="portrait" src={fileURL(id)} loading="lazy" width="42" height="42" alt={name + ', authored image'} onError={() => setFailed(true)}/>
    : <span class="portrait placeholder" aria-label="Portrait preview unavailable; inspect the original in details">◌</span>;
}
export function Pagination({ next, previous, onNext, onPrevious }: { next?: number | null; previous: boolean; onNext: () => void; onPrevious: () => void }) {
  return <div class="pagination"><button class="secondary" disabled={!previous} onClick={onPrevious}>Previous page</button><button class="secondary" disabled={next == null} onClick={onNext}>Next page</button></div>;
}
export type Act = (kind: Command['kind'], args: unknown, actor?: string, run?: string) => ReturnType<typeof operate>;
function App() {
  const [connected, setConnected] = useState(!!token), [connection, setConnection] = useState('Connecting…');
  const [page, setPage] = useState<View>('Work'), [selected, setSelected] = useState<string>(), [artifact, setArtifact] = useState<string>();
  const [work, setWork] = useState<string>(), [create, setCreate] = useState<string>(), [brief, setBrief] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController(); setError('');
    void watch(controller.signal, setConnection).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [connected]);
  const act: Act = (kind, args, actor = '', run = '') => operate(kind, args, actor, run);
  const navigate = (name: View) => { setPage(name); setWork(undefined); setSelected(undefined); setArtifact(undefined); setCreate(undefined); };
  const disconnect = () => { connect(''); setConnected(false); navigate('Work'); setConnection('Disconnected'); };
  if (!connected) return <main class="connection"><span class="brand-mark">ap</span><p class="eyebrow">AI PERSONAS · RUST WORKSPACE</p><h1>Different minds.<br/>Useful work.</h1><p>Follow continuing individuals as they choose their approaches, collaborate and produce inspectable results.</p>
    <form onSubmit={e => { e.preventDefault(); connect(String(new FormData(e.currentTarget).get('token'))); setConnected(true); }}><label>Node token<input name="token" type="password" autoComplete="off" required/></label><button>Connect to node</button></form>
    <p class="micro">Your token stays in this tab's memory. The node controls execution and permissions; this UI does not add isolation to the v1 runtime.</p></main>;
  const canCreate = ['Work', 'Personas', 'Environments', 'Network'].includes(page);
  return <div class="shell"><aside class="sidebar"><a class="brand" href="#" onClick={e => { e.preventDefault(); navigate('Work'); }}><span class="brand-mark">ap</span>AI Personas</a>
    <nav aria-label="Main navigation">{pages.map(name => <button key={name} aria-label={name} aria-current={page === name ? 'page' : undefined} class={page === name ? 'active' : ''} onClick={() => navigate(name)}>{name}</button>)}</nav>
    <div class="advanced-navigation"><span class="field-label">Advanced</span><button class={page === 'Network' ? 'active' : ''} onClick={() => navigate('Network')}>Network</button></div>
    <div class="connection-state" role="status"><span class={'live-dot ' + (connection === 'Connected' ? '' : 'offline')}/>{connection}<button class="quiet" onClick={disconnect}>Disconnect view</button></div></aside>
    <main class="main">{connection !== 'Connected' && <p class="connection-warning" role="status">{connection}. Displayed records may be stale.</p>}{error && <p role="alert">{error}</p>}
      {work ? <Suspense fallback={<p role="status">Opening workspace…</p>}><Workspace key={work} id={work} back={() => setWork(undefined)} open={setSelected} artifact={setArtifact}/></Suspense> : <>
        <header class="page-heading"><div><p class="eyebrow">YOUR WORKSPACE</p><h1>{page}</h1><p>{({ Work: 'Individual approaches. Shared commitments. Evidence you can inspect.', Personas: 'Character and experience that continue across tasks and models.', Environments: 'Shared places, participants and resources.', Learning: 'Authored fragments and documents. Retention is not proof of useful learning.', Tools: 'Acquired capabilities and usage evidence, not inferred expertise.', Network: 'Existing peer connections and verified-byte transfers.' })[page]}</p></div>
          {canCreate && <button onClick={() => { setBrief(''); setCreate(page); }}>+ {({ Work: 'New work', Personas: 'New persona', Environments: 'New environment', Network: 'Connect or receive' } as Record<string, string>)[page]}</button>}</header>
        {page === 'Work' && <Requests open={setSelected}/>}
        {page === 'Environments' && <Starters choose={b => { setBrief(b); setCreate('Work'); }}/>}
        {page === 'Network' && <Network/>}
        <List key={page} kind={kinds[page]} open={setSelected} openWork={setWork} artifact={setArtifact} act={act}/>
      </>}
      <footer class="page-footer">Closing this view does not cancel work. Activity, evidence and acceptance are separate.</footer>
    </main>
    {create && <Suspense fallback={<p class="overlay">Loading form…</p>}><Create kind={create} brief={brief} act={act} close={() => setCreate(undefined)}/></Suspense>}
    {selected && <Suspense fallback={<p class="drawer">Opening details…</p>}><Detail key={selected} id={selected} open={setSelected} artifact={setArtifact} close={() => setSelected(undefined)} act={act}/></Suspense>}
    {artifact && <Suspense fallback={<p class="overlay">Opening viewer…</p>}><Viewer key={artifact} id={artifact} close={() => setArtifact(undefined)}/></Suspense>}
  </div>;
}
function List({ kind, open, openWork, artifact, act }: { kind: string; open: (id: string) => void; openWork: (id: string) => void; artifact: (id: string) => void; act: Act }) {
  const [failure, setFailure] = useState(''), [query, setQuery] = useState(''), [cursors, setCursors] = useState([0]);
  const settled = useDebounced(query), cursor = cursors.at(-1)!;
  const { value: page, error, loading } = useRecords(kind, '', '', settled, cursor);
  const visit = (r: Entity) => r.kind === 'work' ? openWork(r.id) : open(r.id);
  return <><div class="section-tools"><span>{loading ? 'Refreshing…' : page ? `${page.items.length} on this page` : 'Loading…'}</span><input type="search" aria-label="Search records" placeholder="Search this view…" value={query} onInput={e => { setCursors([0]); setQuery(e.currentTarget.value); }}/></div>
    {(error || failure) && <p role="alert">{error || failure}</p>}{!loading && !error && page?.items.length === 0 && <div class="empty-state"><h2>{settled ? 'No matching records' : 'A fresh place to start'}</h2><p>Names, imagery, learning and capabilities appear when they are actually recorded.</p></div>}
    <div class="cards compact-records" aria-busy={loading}>{page?.items.map(r => { const d = data(r); return <article class="card" key={r.id}>
      <div class="card-top">{['persona', 'environment'].includes(r.kind) ? <Portrait id={d.portrait || d.image} name={label(r)}/> : <span class="card-symbol" aria-hidden="true">{r.kind === 'work' ? '↗' : r.kind === 'transfer' ? '⇄' : '◇'}</span>}<small>{r.kind}</small></div>
      <div class="card-content"><button class="card-title" onClick={() => visit(r)}>{label(r)}</button><p class="card-summary">{text(d.character) || text(d.description) || text(d.brief) || text(d.summary) || text(d.note) || 'Inspect the exact record for details.'}</p><Facts r={r}/>
        {r.kind === 'persona' && <p class="micro">Current model: {text(d.provider, 'not recorded')} / {text(d.model, 'not recorded')}</p>}
        {r.kind === 'work' && <p class="micro">{Array.isArray(d.personas) ? d.personas.length : 0} selected personas · not a contribution score</p>}
        {r.kind === 'document' && <p class="micro">Authored document · not automatically learned knowledge</p>}
        {['tool', 'capability'].includes(r.kind) && <p class="micro">Availability and registration do not establish competence</p>}
        {r.kind === 'transfer' && <><progress value={d.bytes} max={d.total || 1}/><p class="micro">{d.bytes?.toLocaleString()} / {d.total?.toLocaleString()} bytes</p>{d.status === 'running' && <button class="quiet" onClick={() => act('transfer.cancel', { id: r.id }).catch(e => setFailure(e.message))}>Cancel transfer</button>}{d.received_artifact && <button onClick={() => artifact(d.received_artifact)}>Open artifact</button>}</>}
      </div><button class="text-button card-open" onClick={() => visit(r)}>{r.kind === 'work' ? 'Open workspace ↗' : 'Open details ↗'}</button>
    </article>; })}</div>
    <Pagination next={page?.next} previous={cursors.length > 1} onNext={() => { if (page?.next != null) setCursors([...cursors, page.next]); }} onPrevious={() => setCursors(cursors.slice(0, -1))}/></>;
}
function Requests({ open }: { open: (id: string) => void }) {
  const { value } = useRecords('request', '', '', '', 0, 'open'); const pending = value?.items.filter(r => data(r).status === 'open') || [];
  return pending.length ? <section class="needs-panel"><h2>Needs you</h2><p>Replies return to the owning persona; they do not automatically resolve the request.</p>{pending.slice(0, 4).map(r => <button key={r.id} class="record-link" onClick={() => open(r.id)}>{label(r)}</button>)}{(pending.length > 4 || value?.next != null) && <p>More requests may be available inside their work items.</p>}</section> : null;
}
function Starters({ choose }: { choose: (brief: string) => void }) {
  const [open, setOpen] = useState(false), [items, setItems] = useState<any[]>([]), [error, setError] = useState('');
  useEffect(() => { if (!open) return; const c = new AbortController(); request<any[]>('/curricula', { signal: c.signal }).then(setItems).catch(e => { if (!c.signal.aborted) setError(e.message); }); return () => c.abort(); }, [open]);
  return <section><button class="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>Optional learning environments</button>{error && <p role="alert">{error}</p>}{open && <div class="starter-list">{items.map(s => <article key={s.id}><h3>{s.title}</h3><p>{s.brief}</p><button onClick={() => choose(s.brief)}>Use this brief</button></article>)}</div>}</section>;
}
function Network() { const { value: n, error } = useResource<any>('/network', e => e.kind === 'network' || e.kind === 'peer'); return <section class="network-info"><h2>This node</h2>{error && <p role="alert">{error}</p>}<p class="micro">{n?.id}</p>{n?.addresses?.map((a: string) => <code key={a}>{a}</code>)}<p>{n?.peers?.length ?? 'Unknown'} connected peers</p><p class="micro">Peer transfer is not distributed exclusive identity activation.</p></section>; }
render(<App/>, document.getElementById('app')!);
