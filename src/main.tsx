import { render } from 'preact';
import { lazy, Suspense } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { connect, data, label, operate, request, token, watch, changed, fileURL, type Entity, type Command } from './api';
import { useRecords, useResource } from './hooks';
import './style.css';
const Detail = lazy(() => import('./Detail'));
const Viewer = lazy(() => import('./Viewer'));
const Create = lazy(() => import('./Create'));
const pages = ['Work','Personas','Environments','Learning','Network'] as const;
type View = typeof pages[number];
const kinds: Record<View,string> = { Work:'work', Personas:'persona', Environments:'environment', Learning:'document,tool', Network:'transfer' };
export function Status({ value }: { value: string }) { return <span class={'status ' + value}>{value || 'Waiting'}</span>; }
export function Facts({ r }: { r: Entity }) {
  const d = data(r);
  return r.kind === 'work' ? <div class="facts"><span>{Object.entries(d.activity || {}).map(([state,n]) => `${n} ${state}`).join(' · ') || 'No activity yet'}</span><span>{d.submissions || 0} submitted versions{Object.entries(d.assessments || {}).map(([verdict,n]) => ` · ${n} ${verdict} assessments`)}</span>{d.pending_requests > 0 && <span class="needs">{d.pending_requests} unresolved outside requests</span>}</div> : d.status ? <Status value={d.status} /> : null;
}
export function Portrait({ id, name }: { id?: string; name: string }) { return id ? <img class="portrait" src={fileURL(id)} loading="lazy" alt={name + ', authored image'} /> : <span class="portrait placeholder" aria-label="Image not authored">◌</span>; }
export function Pagination({ next, previous, onNext, onPrevious }: { next?: number | null; previous: boolean; onNext: () => void; onPrevious: () => void }) {
  return <div class="pagination"><button class="secondary" disabled={!previous} onClick={onPrevious}>Previous page</button><button class="secondary" disabled={!next} onClick={onNext}>Next page</button></div>;
}
function App() {
  const [connected,setConnected] = useState(!!token); const [connection,setConnection] = useState('Connecting…');
  const [page,setPage] = useState<View>('Work'); const [selected,setSelected] = useState<string>(); const [artifact,setArtifact] = useState<string>();
  const [create,setCreate] = useState<string>(); const [brief,setBrief] = useState(''); const [error,setError] = useState('');
  useEffect(() => {
    if (!connected) return; const c = new AbortController();
    request('/session',{ method:'POST', signal:c.signal }).then(() => watch(c.signal,setConnection)).catch(e => !c.signal.aborted && setError(e.message));
    return () => c.abort();
  }, [connected]);
  async function act(kind: Command['kind'], args: unknown, actor = '', run = '') { const a = await operate(kind,args,actor,run); changed(); return a; }
  if (!connected) return <main class="connection"><span class="brand-mark">ap</span><h1>A place for minds<br/>to make things.</h1><p>Follow persistent personas as they learn, collaborate and do useful work.</p><form onSubmit={e => { e.preventDefault(); connect(String(new FormData(e.currentTarget).get('token'))); setConnected(true); }}><label>Node token<input name="token" type="password" autoComplete="off" required /></label><button>Connect to node</button></form><p class="micro">Personas work directly on the host running this node.</p></main>;
  return <div class="shell"><aside class="sidebar"><a class="brand" href="#" onClick={e => { e.preventDefault(); setPage('Work'); }}><span class="brand-mark">ap</span>AI Personas</a><nav aria-label="Main navigation">{pages.map(name => <button key={name} aria-label={name} class={page === name ? 'active' : ''} onClick={() => { setPage(name); setSelected(undefined); setCreate(undefined); }}>{name}</button>)}</nav><div class="connection-state"><span class="live-dot"/>{connection}<button class="quiet" onClick={() => { connect(''); setConnected(false); }}>Disconnect view</button></div></aside>
    <main class="main"><header class="page-heading"><div><p class="eyebrow">YOUR WORKSPACE</p><h1>{page}</h1><p>{({Work:'Follow progress, useful results and what needs your input.',Personas:'Character and experience that continue across tasks.',Environments:'Shared places authored by the personas who use them.',Learning:'Retained knowledge, owned tools and chosen skills.',Network:'Connections and the progress of shared files.'})[page]}</p></div>{page !== 'Learning' && <button onClick={() => { setBrief(''); setCreate(page); }}>+ {({Work:'New work',Personas:'New persona',Environments:'New environment',Network:'Connect or receive'})[page]}</button>}</header>
    {error && <p class="error" role="alert">{error}</p>}
    {page === 'Work' && <Requests open={setSelected} />}
    {page === 'Environments' && <Starters choose={text => {setBrief(text);setCreate('Work');}} />}
    {page === 'Network' && <Network />}
    <List key={page} kind={kinds[page]} open={setSelected} artifact={setArtifact} act={act}/>
    <footer class="page-footer">Work continues when you close this view.</footer></main>
    {create && <Suspense fallback={<p class="overlay">Loading form…</p>}><Create kind={create} brief={brief} act={act} close={() => setCreate(undefined)} /></Suspense>}
    {selected && <Suspense fallback={<p class="drawer">Opening details…</p>}><Detail key={selected} id={selected} open={setSelected} artifact={setArtifact} close={() => setSelected(undefined)} act={act} /></Suspense>}
    {artifact && <Suspense fallback={<p class="overlay">Opening viewer…</p>}><Viewer key={artifact} id={artifact} close={() => setArtifact(undefined)} /></Suspense>}
  </div>;
}
export type Act = (kind:Command['kind'],args:unknown,actor?:string,run?:string) => ReturnType<typeof operate>;
function List({ kind, open, artifact, act }: { kind:string;open:(id:string)=>void;artifact:(id:string)=>void;act:Act }) {
  const [failure,setFailure] = useState(''); const [query,setQuery] = useState(''); const [cursors,setCursors] = useState([0]); const cursor = cursors.at(-1)!;
  const {value:page,error} = useRecords(kind,'','',query,cursor);
  return <><div class="section-tools"><span>{page ? `${page.items.length} on this page` : 'Loading…'}</span><input type="search" aria-label="Search records" placeholder="Search this view…" value={query} onInput={e => { setCursors([0]);setQuery(e.currentTarget.value); }} /></div>
    {(error||failure) && <p role="alert">{error||failure}</p>}{page?.items.length === 0 && <div class="empty-state"><h2>{query ? 'No matching records' : 'A fresh place to start'}</h2><p>Names, imagery and learning appear when personas author them.</p></div>}
    <div class="cards">{page?.items.map(r => {const d=data(r);return <article class="card" key={r.id}><div class="card-top">{['persona','environment'].includes(r.kind) ? <Portrait id={d.portrait || d.image} name={label(r)}/> : <span class="card-symbol">{r.kind==='work'?'↗':r.kind==='transfer'?'⇄':'◇'}</span>}<small>{r.kind}</small></div><button class="card-title" onClick={()=>open(r.id)}>{label(r)}</button><p class="card-summary">{d.character || d.description || d.brief || d.summary || d.note || 'Details appear as work develops.'}</p><Facts r={r}/>{r.kind==='persona' && <p class="micro">{d.provider} / {d.model}</p>}{r.kind==='work' && <p class="micro">{d.personas?.length || 0} contributing personas</p>}
    {r.kind==='transfer' && <><progress value={d.bytes} max={d.total || 1}/><p class="micro">{d.bytes?.toLocaleString()} / {d.total?.toLocaleString()} bytes</p>{d.status==='running' && <button class="quiet" onClick={()=>act('transfer.cancel',{id:r.id}).catch(e=>setFailure(e.message))}>Cancel transfer</button>}{d.received_artifact && <button onClick={()=>artifact(d.received_artifact)}>Open artifact</button>}</>}
    <button class="text-button" onClick={()=>open(r.id)}>Open details ↗</button></article>})}</div>
    <Pagination next={page?.next} previous={cursors.length>1} onNext={()=>page?.next && setCursors([...cursors,page.next])} onPrevious={()=>setCursors(cursors.slice(0,-1))}/></>;
}
function Requests({open}:{open:(id:string)=>void}) { const {value}=useRecords('request','','','',0,'open'); const pending=value?.items.filter(r=>data(r).status==='open') || [];return pending.length ? <section class="needs-panel"><h2>Needs you</h2><p>Replies return to the owning persona for assessment.</p>{pending.slice(0,4).map(r=><button key={r.id} class="record-link" onClick={()=>open(r.id)}>{label(r)}</button>)}{pending.length>4 && <p>More requests are available inside their work items.</p>}</section>:null; }
function Starters({choose}:{choose:(brief:string)=>void}) {const [open,setOpen]=useState(false);const [items,setItems]=useState<any[]>([]);useEffect(()=>{if(!open)return;const c=new AbortController();request<any[]>('/curricula',{signal:c.signal}).then(setItems).catch(()=>{});return()=>c.abort();},[open]);return <section><button class="secondary" onClick={()=>setOpen(!open)}>Optional learning environments</button>{open && <div class="starter-list">{items.map(s=><article key={s.id}><h3>{s.title}</h3><p>{s.brief}</p><button onClick={()=>choose(s.brief)}>Use this brief</button></article>)}</div>}</section>;}
function Network(){const {value:n}=useResource<any>('/network',e=>e.kind==='network'||e.kind==='peer');return <section class="network-info"><h2>This node</h2><p class="micro">{n?.id}</p>{n?.addresses.map((a:string)=><code key={a}>{a}</code>)}<p>{n?.peers.length || 0} connected peers</p></section>;}

render(<App/>,document.getElementById('app')!);
