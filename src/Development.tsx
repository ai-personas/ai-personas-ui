import { lazy, Suspense } from 'preact/compat';
import { useState } from 'preact/hooks';
import { data, type Entity, type Page, type Action } from './api';
import { useRecords, useResource } from './hooks';
import type { Act } from './main';
import Pagination from './Pagination';
import { fields, text } from './workspace';
import { recordTitle, actionTitle, excerpt } from './reading';
import { timestamp } from './identity';
const ExplorationControls = lazy(() => import('./ExplorationControls'));
const RecordReader = lazy(() => import('./RecordReader'));
const ActionEvidence = lazy(() => import('./ActionEvidence'));

function RecordDetails({ id, open, act }: { id: string; open: (id: string) => void; act: Act }) {
  const { value, error } = useResource<Entity>('/records/' + id, e => e.entity === id);
  const [failure, setFailure] = useState(''), [busy, setBusy] = useState(false);
  return error ? <p role="alert">{error}</p> : value ? <><Suspense fallback={<p>Loading details…</p>}><RecordReader record={value} open={open}/></Suspense>
    {value.kind === 'exploration_opportunity' && data(value).status === 'scheduled' && <form onSubmit={async e => {
      e.preventDefault(); if (busy) return; const reason = String(new FormData(e.currentTarget).get('reason')); setBusy(true); setFailure('');
      try { await act('exploration.cancel', {id:value.id, revision:value.revision, reason}); } catch (e) { setFailure((e as Error).message); } finally { setBusy(false); }
    }}><label>Reason to cancel this investigation<textarea name="reason" rows={2} required/></label>{failure && <p role="alert">{failure}</p>}<button class="secondary" disabled={busy}>{busy ? 'Cancelling…' : 'Cancel scheduled investigation'}</button></form>}
  </> : <p>Loading recorded details…</p>;
}
function DevelopmentRecords({ kind, persona, open, act }: { kind: string; persona: string; open: (id: string) => void; act: Act }) {
  const [cursors, setCursors] = useState([0]), [expanded, setExpanded] = useState('');
  const { value, error, loading } = useRecords(kind, '', persona, '', cursors.at(-1));
  const rows = kind === 'call' ? value?.items.filter(r => Number(data(r).learning_inclusion_count) > 0) : value?.items;
  return <section aria-busy={loading}>{error && <p role="alert">{error}</p>}{!value && !error && <p>Loading recorded experience…</p>}
    {rows?.map(r => <article class="development-card" key={r.id}><h4>{kind === 'call' ? 'Lesson included in a later decision' : recordTitle(r)}</h4><p class="micro">{timestamp(r.created)}{r.kind === 'perspective' ? r.scope === persona ? ' · Across work' : ' · Scoped to one work' : ''}</p>
      <p>{excerpt(data(r).interpretation || data(r).question || fields(data(r).draft).content || data(r).summary)}</p>
      <button class="text-button" aria-expanded={expanded === r.id} onClick={() => setExpanded(expanded === r.id ? '' : r.id)}>{expanded === r.id ? 'Close details' : 'Read the recorded evidence'}</button>
      {expanded === r.id && <RecordDetails id={r.id} open={open} act={act}/>}
    </article>)}
    {rows?.length === 0 && <p>No matching evidence on this page. Missing evidence is not inferred from other activity.</p>}
    <Pagination previous={cursors.length > 1} next={value?.next} onPrevious={() => { setExpanded(''); setCursors(cursors.slice(0,-1)); }} onNext={() => { if (value?.next != null) { setExpanded(''); setCursors([...cursors,value.next]); } }}/>
  </section>;
}
function Trials({ persona, open }: { persona: string; open: (id: string) => void }) {
  const [cursors, setCursors] = useState([0]), [expanded, setExpanded] = useState('');
  const { value, error } = useResource<Page<Action>>('/actions?' + new URLSearchParams({owner:persona,after:String(cursors.at(-1)),limit:'24'}), e => e.kind === 'action' && e.data?.actor === persona);
  const rows=value?.items.filter(a => ['exec','browser.search','browser.open','image.observe'].includes(a.request.kind));
  return <section><p>A tool attempt is an observation, including failures and unknown outcomes. It is not automatically retained learning.</p>{error && <p role="alert">{error}</p>}{rows?.map(a => <article class="development-card" key={a.request.id}><h4>{actionTitle(a.request.kind)} · {a.state}</h4><p>{timestamp(a.finished || a.created)}</p><button class="text-button" aria-expanded={expanded === a.request.id} onClick={() => setExpanded(expanded === a.request.id ? '' : a.request.id)}>{expanded === a.request.id ? 'Close observation' : 'Inspect the actual observation'}</button>{expanded === a.request.id && <Suspense fallback={<p>Loading observation…</p>}><ActionEvidence id={a.request.id} open={open}/></Suspense>}</article>)}{rows?.length === 0 && <p>No tool trials on this activity page.</p>}
    <Pagination previous={cursors.length>1} next={value?.next} onPrevious={() => {setExpanded('');setCursors(cursors.slice(0,-1));}} onNext={() => {if(value?.next!=null){setExpanded('');setCursors([...cursors,value.next]);}}}/></section>;
}
export default function Development({ persona, open, act }: { persona: Entity; open: (id: string) => void; act: Act }) {
  const [tab,setTab]=useState('Interests and relationships');
  const kinds:Record<string,string>={'Interests and relationships':'perspective','Retained lessons':'fragment','Interpretations':'experience_review','Later decisions':'call','Exploration activity':'exploration_opportunity'};
  return <section class="development-panel" aria-label="Experience and exploration"><h3>Experience and exploration</h3>
    <p>Tried, retained and included in later decisions are separate steps. Benefit needs an outcome assessment; it cannot be established by counting notes, tools or trait changes.</p>
    <nav class="development-tabs" aria-label="Development views">{[...Object.keys(kinds),'Tool trials','Exploration settings'].map(name => <button class={tab===name?'':'secondary'} aria-pressed={tab===name} onClick={() => setTab(name)} key={name}>{name}</button>)}</nav>
    {tab==='Exploration settings' ? <Suspense fallback={<p>Loading controls…</p>}><ExplorationControls persona={persona} act={act}/></Suspense> : tab==='Tool trials' ? <Trials persona={persona.id} open={open}/> : <>{tab==='Later decisions' && <p>These admission records show exact lesson inclusion. Inspect dispatch receipts and subsequent work before claiming that a lesson was applied or improved an outcome.</p>}<DevelopmentRecords key={tab} kind={kinds[tab]} persona={persona.id} open={open} act={act}/></>}
  </section>;
}
