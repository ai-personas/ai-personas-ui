import CharacterInitialization from './CharacterInitialization';
import Pagination from './Pagination';
import { render } from 'preact';
import { lazy, memo, Suspense } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { connect, data, label, operate, request, token, watch, fileURL, HttpError, type Entity, type Command } from './api';
import { useRecords, useResource } from './hooks';
import { text, isRecordID, recordIDs, workFacts, stateTone, inputRequestCount } from './workspace';
import type { ApiTypes } from './contract';
import { InputNotice } from './Attention';
import { PAGES, VIEW_META, WORK_FILTERS, matchesWorkFilter, type View, type WorkFilter } from './presentation';
import Icon from './Icon';
import SearchInput from './SearchInput';
import { ContentCard } from './ContentCards';
import './style.css';
import './workspace.css';
import './design-system.css';
import './reading.css';
const LearningLibrary = lazy(() => import('./MemoryGraph').then(m => ({ default: m.LearningLibrary })));
const Detail = lazy(() => import('./Detail'));
const Viewer = lazy(() => import('./Viewer'));
const Create = lazy(() => import('./Create'));
const Workspace = lazy(() => import('./Workspace'));
const Funding = lazy(() => import('./Operator').then(m => ({ default: m.Funding })));

export function Status({ value }: { value: string }) { return <span class={'status tone-' + stateTone(value)}>{value.replaceAll('_', ' ') || 'Not recorded'}</span>; }
export function Facts({ r }: { r: Entity }) {
  const d = data(r);
  if (r.kind === 'persona') return <Status value={text(d.lifecycle, 'Lifecycle not recorded')}/>;
  if (r.kind !== 'work') return text(d.status) ? <Status value={d.status}/> : null;
  const f = workFacts(r);
  return <div class="facts"><span>{f.activity}</span><span>{f.submissions === undefined ? 'Submission count not reported' : `${f.submissions} preserved submissions`} · acceptance not established</span>
    {f.pendingRequests !== undefined && f.pendingRequests > 0 && <span class="needs">{f.pendingRequests} unresolved outside requests</span>}</div>;
}
export function Portrait({ id, name }: { id?: string; name: string }) {
  return isRecordID(id) ? <BoundedPortrait key={id} id={id} name={name}/> : <span class="portrait placeholder" aria-label="Image not authored">◌</span>;
}
function BoundedPortrait({ id, name }: { id: string; name: string }) {
  const { value: r } = useResource<Entity>('/records/' + id, e => e.entity === id);
  const [failed, setFailed] = useState(false), d = r ? data(r) : {};
  // No thumbnail endpoint exists in v1. Do not fetch multi-megabyte originals for a list avatar.
  const safe = !failed && r?.kind === 'artifact' && Number.isSafeInteger(d.size) && d.size >= 0 && d.size <= 512_000 && ['image/png', 'image/jpeg', 'image/webp'].includes(d.media_type);
  return safe ? <img class="portrait" src={fileURL(id)} loading="lazy" width="42" height="42" alt={name + ', authored image'} onError={() => setFailed(true)}/>
    : <span class="portrait placeholder" aria-label="Portrait preview unavailable; inspect the original in details">◌</span>;
}
export { default as Pagination } from './Pagination';
export type Act = (kind: Command['kind'], args: unknown, actor?: string, run?: string) => ReturnType<typeof operate>;

function Connection({ onConnected, local, retryLocal, message }: { onConnected: () => void; local: boolean; retryLocal: () => void; message: string }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef<AbortController>();
  useEffect(() => () => pending.current?.abort(), []);
  return <main class="connection connection-screen"><span class="brand-mark">ap</span><p class="eyebrow">AI PERSONAS · NODE WORKSPACE</p>
    <h1>Different perspectives.<br/>Accountable work.</h1><p class="connection-intro">Continuing AI collaborators. A shared purpose. Results you can inspect.</p>
    <div class="connection-card"><h2>{local ? 'Open your local workspace' : 'Connect to your node'}</h2>
      {message && <p role="alert">{message}</p>}
      {local ? <><p>Your local node connects automatically. No token is needed.</p><button onClick={retryLocal}>Reconnect to local node</button></> : <>
      <p>This node requires an operator token. Local nodes started with the default settings connect automatically.</p>
      <form onSubmit={async e => {
        e.preventDefault(); if (pending.current) return;
        const value = String(new FormData(e.currentTarget).get('token') || '').trim();
        if (!value) { setError('Enter a node token.'); return; }
        const controller = new AbortController(); pending.current = controller;
        setBusy(true); setError(''); connect(value);
        try {
          // Validate against an existing authenticated route before opening any workspace reads.
          await request('/session', { method: 'POST', signal: controller.signal });
          if (!controller.signal.aborted) onConnected();
        } catch (e) {
          if (!controller.signal.aborted) { connect(''); setError(`Could not connect: ${(e as Error).message}`); }
        } finally {
          if (!controller.signal.aborted) { pending.current = undefined; setBusy(false); }
        }
      }}>
        <label>Node token<input name="token" type="password" autoComplete="off" required disabled={busy} aria-describedby="token-note"/></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Connecting…' : 'Connect to node'}</button>
        {busy && <button type="button" class="secondary" onClick={() => { pending.current?.abort(); pending.current = undefined; connect(''); setBusy(false); }}>Cancel connection</button>}
      </form>
      <p id="token-note" class="micro">Your token stays in this tab’s memory, not browser storage. The node controls execution and permissions; this UI does not add runtime isolation.</p>
      </>}
    </div><p class="connection-principle"><Icon name="Shield"/>Activity, evidence, and acceptance are separate facts.</p>
  </main>;
}
function App() {
  const [connected, setConnected] = useState(!!token), [connection, setConnection] = useState('Connecting…');
  const [opening, setOpening] = useState(true), [attempt, setAttempt] = useState(0), [local, setLocal] = useState(true), [openError, setOpenError] = useState('');
  const [page, setPage] = useState<View>('Work'), [selected, setSelected] = useState<string>(), [artifact, setArtifact] = useState<string>();
  const [work, setWork] = useState<string>(), [create, setCreate] = useState<string>(), [brief, setBrief] = useState(''), [error, setError] = useState('');
  const content = useRef<HTMLElement>(null);
  const attention = useResource<ApiTypes['attention']>('/attention', e => ['request', 'response', 'work', 'run'].includes(e.kind), connected);
  const counts: Record<string, number> = { Work: attention.value?.work || 0, Personas: attention.value?.personas || 0, Environments: attention.value?.environments || 0 };
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    setOpening(true); setOpenError('');
    void request('/session', { method: 'POST', signal: controller.signal }).then(() => {
      if (active) { setLocal(!token); setConnected(true); }
    }).catch(error => {
      if (!active) return;
      setLocal(!(error instanceof HttpError && error.status === 401));
      if (!(error instanceof HttpError && error.status === 401)) setOpenError('Could not reach the node. Check that it is running, then reconnect.');
    }).finally(() => { clearTimeout(timeout); if (active) setOpening(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  useEffect(() => { document.title = `${work ? 'Work workspace' : page} · AI Personas`; }, [page, work]);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController(); setError(''); setConnection('Connecting…');
    void watch(controller.signal, setConnection).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [connected]);
  const act: Act = (kind, args, actor = '', run = '') => operate(kind, args, actor, run);
  const navigate = (name: View) => {
    setPage(name); setWork(undefined); setSelected(undefined); setArtifact(undefined); setCreate(undefined);
    requestAnimationFrame(() => content.current?.focus());
  };
  const disconnect = () => { connect(''); setConnected(false); navigate('Work'); setConnection('Disconnected'); };
  const start = () => { setBrief(''); setCreate(page); };
  if (opening) return <main class="connection connection-screen"><span class="brand-mark">ap</span><h1>AI Personas</h1><p role="status">Opening your workspace…</p></main>;
  if (!connected) return <Connection local={local} message={openError} retryLocal={() => { connect(''); setAttempt(n => n + 1); }} onConnected={() => { setLocal(false); setConnected(true); }}/>;
  const meta = VIEW_META[page];
  return <div class="shell design-shell">
    <a class="skip-link" href="#main-content" onClick={e => { e.preventDefault(); content.current?.focus(); }}>Skip to content</a>
    <aside class="sidebar"><a class="brand" href="#" onClick={e => { e.preventDefault(); navigate('Work'); }}><span class="brand-mark">ap</span><span>AI Personas<small>Continuing collaborators</small></span></a>
      <nav aria-label="Main navigation">{PAGES.map(name => <button key={name} aria-label={name} aria-current={page === name ? 'page' : undefined} class={`${page === name ? 'active' : ''}${counts[name] ? ' nav-attention' : ''}`} title={counts[name] ? `${counts[name]} ${name.toLowerCase()} need your input` : undefined} onClick={() => navigate(name)}><Icon name={name}/><span>{name}</span>{counts[name] > 0 && <span class="nav-input-count" aria-label={`${counts[name]} need your input`}>{counts[name]}</span>}</button>)}</nav>
      <div class="sidebar-note"><span class="eyebrow">INDIVIDUAL PERSPECTIVES.<br/>SHARED PURPOSE.</span><p>People set the boundaries. Personas choose their approaches. Evidence makes the work inspectable.</p></div>
      <div class="advanced-navigation"><button aria-current={page === 'Funding' ? 'page' : undefined} onClick={() => navigate('Funding')}>Funding</button><span class="field-label">Advanced</span><button aria-current={page === 'Network' ? 'page' : undefined} class={page === 'Network' ? 'active' : ''} onClick={() => navigate('Network')}><Icon name="Network"/>Network</button></div>
      <div class="connection-state"><span role="status"><span class={'live-dot ' + (connection === 'Connected' ? '' : 'offline')} aria-hidden="true"/>{connection}</span><button class="quiet" onClick={disconnect}>Disconnect view</button></div>
    </aside>
    <main id="main-content" class="main" tabIndex={-1} ref={content}>
      <div class="app-topbar"><span>Workspace <span aria-hidden="true">/</span> <strong>{page}</strong>{work && ' / Detail'}</span><span class="runtime-label"><Icon name="Shield"/>Runtime records</span></div>
      <div class="page-content">{connection !== 'Connected' && <p class="connection-warning" role="status">{connection.startsWith('Reconnecting') ? connection : `${connection}. Displayed records may be stale.`}</p>}{error && <p role="alert">{error}</p>}
        {work ? <Suspense fallback={<p role="status">Opening workspace…</p>}><Workspace key={work} id={work} back={() => setWork(undefined)} open={setSelected} artifact={setArtifact} act={act}/></Suspense> : page === 'Funding' ? <Suspense fallback={<p>Loading funding…</p>}><Funding act={act}/></Suspense> : <>
          <header class="page-heading"><div><p class="eyebrow">YOUR WORKSPACE</p><h1>{page}</h1><p>{meta.description}</p></div>{meta.create && <button onClick={start}>+ {meta.create}</button>}</header>
          {['Work', 'Personas', 'Environments'].includes(page) && <Requests open={setSelected}/>}
          {page === 'Environments' && <Starters choose={b => { setBrief(b); setCreate('Work'); }}/>}
          {page === 'Network' && <Network/>}
          <List key={page} view={page} open={setSelected} openWork={setWork} artifact={setArtifact} act={act} start={start} navigate={navigate}/>
        </>}
        <footer class="page-footer"><Icon name="Shield"/><span>Closing this view does not cancel work. Activity, evidence, and acceptance are separate.</span></footer>
      </div>
    </main>
    {create && <Suspense fallback={<p class="overlay" role="status">Loading form…</p>}><Create kind={create} brief={brief} act={act} close={() => setCreate(undefined)}/></Suspense>}
    {selected && <Suspense fallback={<p class="drawer" role="status">Opening details…</p>}><Detail key={selected} id={selected} open={setSelected} artifact={setArtifact} close={() => setSelected(undefined)} act={act}/></Suspense>}
    {artifact && <Suspense fallback={<p class="overlay" role="status">Opening viewer…</p>}><Viewer key={artifact} id={artifact} close={() => setArtifact(undefined)}/></Suspense>}
  </div>;
}
function ReadFailure({ title, error, retry, loading }: { title: string; error: string; retry: () => void; loading: boolean }) {
  return <div class="read-failure" role="alert"><div><strong>{title}</strong><p>{error}. Previously displayed records may be stale.</p></div><button class="secondary" disabled={loading} onClick={retry}>Retry</button></div>;
}
const WorkRow = memo(function WorkRow({ r, open, openRequest }: { r: Entity; open: (id: string) => void; openRequest: (id: string) => void }) {
  const d = data(r), f = workFacts(r);
  const people = Array.isArray(d.participant_ids ?? d.personas) ? recordIDs(d.participant_ids ?? d.personas).length : undefined;
  return <article class={`work-row${inputRequestCount(r) ? ' needs-input' : ''}`}>
    <div class="work-identity"><span class="record-symbol"><Icon name="Work"/></span><div><h2><button class="card-title" onClick={() => open(r.id)}>{label(r)}</button></h2><p class="card-summary">{text(d.brief) || text(d.description) || 'Open the workspace to inspect the original need.'}</p>
      <InputNotice record={r} open={openRequest}/></div></div>
    <div class="work-fact"><span class="field-label">Activity</span><strong>{f.activity}</strong><small>Execution, not accomplishment</small></div>
    <div class="work-fact"><span class="field-label">Participants</span><strong>{people === undefined ? 'Not reported' : `${people} selected`}</strong><small>Selection is not a commitment</small></div>
    <div class="work-fact"><span class="field-label">Evidence</span><strong>{f.submissions === undefined ? 'Versions not reported' : `${f.submissions} preserved ${f.submissions === 1 ? 'submission' : 'submissions'}`}</strong><small>Acceptance not established</small></div>
    <button class="text-button work-open" onClick={() => open(r.id)}>Open workspace ↗</button>
  </article>;
});
function List(props: Parameters<typeof RecordList>[0]) {
  return props.view === 'Learning' ? <Suspense fallback={<p>Loading learning…</p>}><LearningLibrary open={props.open}/></Suspense> : <RecordList {...props}/>;
}
function RecordList({ view, open, openWork, artifact, act, start, navigate }: {
  view: View; open: (id: string) => void; openWork: (id: string) => void; artifact: (id: string) => void; act: Act; start: () => void; navigate: (view: View) => void;
}) {
  const [failure, setFailure] = useState(''), [query, setQuery] = useState(''), [cursors, setCursors] = useState([0]);
  const [filter, setFilter] = useState<WorkFilter>('all');
  const search = useRef<HTMLInputElement>(null), meta = VIEW_META[view];
  const settled = query, cursor = cursors.at(-1)!;
  const { value: page, error, loading, retry } = useRecords(meta.kind, '', '', settled, cursor);
  const busy = loading || settled !== query;
  const rows = (page?.items || []).filter(r => view !== 'Work' || matchesWorkFilter(r.data, filter));
  const clear = () => { setQuery(''); setFilter('all'); setCursors([0]); search.current?.focus(); };
  return <section class="browse-section" aria-label={`${view} records`}>
    <div class="browse-toolbar">{view === 'Work' ? <div class="browse-filters" role="group" aria-label="Filter work on this page">{WORK_FILTERS.map(item => <button key={item.value} class="filter-button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div> : <h2 class="browse-title">{view === 'Personas' ? 'Continuing individuals' : 'Recorded collection'}</h2>}
      <div class="search-field"><Icon name="Search"/><SearchInput inputRef={search} label="Search records" placeholder={`Search ${view.toLowerCase()}…`} value={query} onSearch={q => { setCursors([0]); setQuery(q); }}/></div>
    </div>
    <div class="browse-caption"><span role="status">{busy ? (page ? 'Refreshing records…' : 'Loading records…') : page ? `${rows.length} shown · ${page.items.length} loaded on page ${cursors.length}` : 'Records unavailable'}</span>{view === 'Work' && <span>Filters apply to this page, not all work.</span>}</div>
    {error && <ReadFailure title={`Could not load ${view.toLowerCase()}`} error={error} retry={retry} loading={loading}/>}{failure && <p role="alert">{failure}</p>}
    {!page && !error && <div class="loading-records" aria-hidden="true">{[0, 1, 2].map(n => <div key={n}><span/><span/></div>)}</div>}
    {!busy && !error && page && rows.length === 0 && <div class="empty-state collection-empty"><span class="empty-symbol"><Icon name={view}/></span><h2>{settled ? 'No matching records' : filter !== 'all' ? 'No work matches this page filter' : cursor > 0 ? 'No records on this page' : meta.emptyTitle}</h2>
      <p>{settled ? 'Try a different search. Search reads the node’s indexed records; it does not generate new content.' : filter !== 'all' ? 'This filter only examines the loaded page. Clear it or continue to another page; missing activity is not treated as completion.' : cursor > 0 ? 'Records may have changed. Return to the previous page or start a new search.' : meta.emptyBody}</p>
      <div class="empty-actions">{settled || filter !== 'all' ? <button class="secondary" onClick={clear}>Clear search and filters</button> : cursor === 0 && <>{meta.create && <button onClick={start}>+ {meta.create}</button>}{view === 'Work' && <button class="secondary" onClick={() => navigate('Personas')}>Choose personas</button>}</>}</div>
    </div>}
    {view === 'Work' ? <div class="work-collection" aria-busy={busy}>{rows.length > 0 && <div class="work-table-heading" aria-hidden="true"><span>Work & original need</span><span>Activity</span><span>Participants</span><span>Evidence</span></div>}{rows.map(r => <WorkRow key={r.id} r={r} open={openWork} openRequest={open}/>)}</div>
      : <div class={view === 'Personas' ? 'cards persona-cards' : 'cards compact-records'} aria-busy={busy}>{rows.map(r => { const d = data(r); return <article class={`card${inputRequestCount(r) ? ' needs-input' : ''}`} key={r.id}>
        <div class="card-top">{['persona', 'environment'].includes(r.kind) ? <Portrait id={d.portrait || d.image} name={label(r)}/> : <span class="record-symbol"><Icon name={view}/></span>}<small>{r.kind === 'persona' ? 'AI collaborator' : r.kind}</small></div>
        <div class="card-content"><h2><button class="card-title" onClick={() => open(r.id)}>{label(r)}</button></h2><p class="card-summary">{text(d.character) || text(d.description) || text(d.brief) || text(d.summary) || text(d.note) || (r.kind === 'persona' ? 'Identity created. Its starting character is being prepared.' : r.kind === 'environment' ? 'Shared place created. Participants can author its name and description when work begins.' : 'Open details to read more.')}</p><Facts r={r}/>
          <InputNotice record={r} open={open}/>
          {r.kind === 'persona' && <><CharacterInitialization persona={r}/><p class="record-caveat">Authored character, not a claim of demonstrated expertise.</p><details class="model-disclosure"><summary>Model details</summary><p class="micro">Current model: {text(d.provider, 'not recorded')} / {text(d.model, 'not recorded')}</p></details></>}
          {r.kind === 'document' && <p class="micro">Authored document · not automatically learned knowledge</p>}
          {r.kind === 'fragment' && <p class="micro">Retained interpretation · later usefulness needs evidence</p>}
          {['tool', 'capability'].includes(r.kind) && <p class="micro">Availability and registration do not establish competence</p>}
          {r.kind === 'transfer' && <><progress aria-label="Recorded transfer bytes" value={d.bytes} max={d.total || 1}/><p class="micro">{d.bytes?.toLocaleString()} / {d.total?.toLocaleString()} bytes</p>{d.status === 'running' && <button class="quiet" onClick={() => act('transfer.cancel', { id: r.id }).catch(e => setFailure(e.message))}>Cancel transfer</button>}{isRecordID(d.received_artifact) && <button onClick={() => artifact(d.received_artifact)}>Open artifact</button>}</>}
        </div><button class="text-button card-open" onClick={() => open(r.id)}>Open details ↗</button>
      </article>; })}</div>}
    {page && <Pagination next={page.next} previous={cursors.length > 1} disabled={busy} onNext={() => { if (!busy && page.next != null) setCursors([...cursors, page.next]); }} onPrevious={() => setCursors(cursors.slice(0, -1))}/>}
  </section>;
}
function Requests({ open }: { open: (id: string) => void }) {
  const [cursors, setCursors] = useState([0]);
  const { value, error, loading, retry } = useRecords('request', '', '', '', cursors.at(-1)!, 'open');
  const pending = value?.items.filter(r => data(r).status === 'open') || [];
  const row = (r: Entity) => <button key={r.id} class="request-link" onClick={() => open(r.id)}><span>{label(r)}<small>Inspect the exact request before responding</small></span><Icon name="Arrow"/></button>;
  if (!value && !error) return <p class="request-loading" role="status">Checking requests that need your input…</p>;
  return <section class="decision-inbox" aria-label="Requests needing your input">
    {error && <ReadFailure title="Requests unavailable" error={error} retry={retry} loading={loading}/>}
    {(pending.length > 0 || cursors.length > 1 || value?.next != null) && <div class="needs-panel">
      <header><span class="request-symbol"><Icon name="Attention"/></span><div><p class="eyebrow">NEEDS YOUR INPUT</p><h2>Decisions start with you.</h2><p>{pending.length} open {pending.length === 1 ? 'request' : 'requests'} on this page. A reply is not automatic resolution or approval.</p></div></header>
      {pending.slice(0, 3).map(row)}{pending.length > 3 && <details class="request-overflow"><summary>Show {pending.length - 3} more on this page</summary>{pending.slice(3).map(row)}</details>}
      {(cursors.length > 1 || value?.next != null) && <div class="request-pagination"><button class="secondary" disabled={loading || cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Previous requests</button><button class="secondary" disabled={loading || value?.next == null} onClick={() => { if (value?.next != null) setCursors([...cursors, value.next]); }}>Next requests</button></div>}
    </div>}
  </section>;
}
function Starters({ choose }: { choose: (brief: string) => void }) {
  const [open, setOpen] = useState(false);
  return <section class="starters"><button class="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>Optional learning environments</button>{open && <StarterRecords choose={choose}/>}</section>;
}
function StarterRecords({ choose }: { choose: (brief: string) => void }) {
  const { value, error, loading, retry } = useResource<any[]>('/curricula', () => false);
  return <>{error && <ReadFailure title="Starter briefs unavailable" error={error} retry={retry} loading={loading}/>}{loading && <p role="status">Loading starter briefs…</p>}
    {value?.length === 0 && <p class="notice">No optional starter briefs are available from this node.</p>}
    <div class="starter-list">{value?.map(s => <article key={s.id}><h3>{s.title}</h3><p>{s.brief}</p><button onClick={() => choose(s.brief)}>Use this brief</button></article>)}</div></>;
}
function Network() {
  const { value: n, error, loading, retry } = useResource<any>('/network', e => e.kind === 'network' || e.kind === 'peer');
  return <section class="network-info"><h2>This node</h2>{error && <ReadFailure title="Node details unavailable" error={error} retry={retry} loading={loading}/>}{!n && !error && <p role="status">Loading node details…</p>}<p class="micro">{n?.id}</p>{n?.addresses?.map((a: string) => <code key={a}>{a}</code>)}<p>{n?.peers?.length ?? 'Unknown'} connected peers</p><p class="micro">Peer transfer is not distributed exclusive identity activation.</p></section>;
}
render(<App/>, document.getElementById('app')!);
