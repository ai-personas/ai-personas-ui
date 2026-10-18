import { useState } from 'preact/hooks';
import { useRecords, useResource } from './hooks';
import { data, label, type Entity } from './api';
import Pagination from './Pagination';
import { fields, text } from './workspace';
import './persona-navigation.css';

/** Operator file browsing. Reading here does not change a persona's selection. */
export default function PersonaFiles({ owner, open }: { owner: string; open: (id: string) => void }) {
  const [kind, setKind] = useState('fragment'), [pages, setPages] = useState([0]);
  const { value, error, loading, retry } = useRecords(kind, '', owner, '', pages.at(-1)!, kind === 'call' ? '' : 'retained');
  const switchKind = (next: string) => { setKind(next); setPages([0]); };
  return <section class="memory-graph" aria-label="Persona files" aria-busy={loading}>
    <p>The persona authors characteristic files and separately maintains supporting assets. Each decision records its maintenance and next-context choices.</p>
    <div class="memory-view-switch" role="group" aria-label="Persona material">
      <button aria-pressed={kind === 'fragment'} onClick={() => switchKind('fragment')}>Characteristic files</button>
      <button aria-pressed={kind === 'persona_asset'} onClick={() => switchKind('persona_asset')}>Supporting assets</button>
      <button aria-pressed={kind === 'call'} onClick={() => switchKind('call')}>Decision activity</button>
    </div>
    {error && <p role="alert">Could not load persona material. {error} <button onClick={retry}>Try again</button></p>}
    {loading && <p role="status">Loading…</p>}
    {!loading && !error && value && <>
      <ul class="memory-fragments">{value.items.map(record => {
        return <FileCard key={record.id} record={record} kind={kind} open={open}/>;
      })}</ul>
      {!value.items.length && <p>No {kind === 'fragment' ? 'characteristic files' : kind === 'persona_asset' ? 'supporting assets' : 'decisions'} on this page.</p>}
      <Pagination disabled={loading} previous={pages.length > 1} next={value.next} onPrevious={() => setPages(pages.slice(0,-1))} onNext={() => { if (value.next != null) setPages([...pages,value.next]); }}/>
    </>}
    <p class="record-caveat">Acceptance, later context inclusion, and useful maturation are separate observations. File counts are not a quality score.</p>
  </section>;
}
function FileCard({ record, kind, open }: { record: Entity; kind: string; open: (id: string) => void }) {
  const { value, error } = useResource<Entity>('/records/' + record.id, e => e.entity === record.id);
  const d = data(value || record), file = fields(d.file), outcome = fields(d.maintenance_outcome), initial = fields(d.initialization_outcome);
  const changes = Array.isArray(outcome.accepted_changes) ? outcome.accepted_changes.length : Array.isArray(initial.accepted_files) ? initial.accepted_files.length : 0;
  return <li class="memory-graph-item"><article class="memory-card">
    <h4>{kind === 'call' ? `${text(d.actual_model || d.requested_model, 'Model call')} · ${text(d.status, 'Status unavailable')}` : text(file.path, label(record))}</h4>
    {error ? <p role="alert">File detail could not be refreshed.</p> : !value ? <p>Reading file detail…</p> : kind === 'call' ? <>
      <p>{initial.status === 'accepted' ? `${changes} initial files accepted` : Object.keys(outcome).length ? `${changes} file changes accepted` : 'No accepted maintenance outcome recorded'}</p>
      {d.error && <p role="alert">{text(d.error)}</p>}
      {d.stop_reason && <p class="micro">{text(d.stop_reason).replaceAll('_', ' ')}</p>}
    </> : <p class="micro">Revision {value.revision} · {kind === 'fragment' ? 'Characteristic prompt text' : 'Supporting resource'}</p>}
    <button class="text-button" onClick={() => open(record.id)}>{kind === 'call' ? 'Read decision evidence' : 'Read accepted file'}</button>
  </article></li>;
}
export function LearningLibrary({ open }: { open: (id: string) => void }) {
  const [owner, setOwner] = useState(''), [pages, setPages] = useState([0]);
  const { value, error, loading } = useRecords('persona', '', '', '', pages.at(-1)!);
  return <section class="learning-library"><h2>Persona files and development</h2>{error && <p role="alert">{error}</p>}
    <div class="memory-owners">{value?.items.map((p: Entity) => <button class="secondary" key={p.id} aria-pressed={owner === p.id} onClick={() => setOwner(p.id)}>{label(p)}</button>)}</div>
    <Pagination disabled={loading} previous={pages.length > 1} next={value?.next} onPrevious={() => setPages(pages.slice(0,-1))} onNext={() => { if (value?.next != null) setPages([...pages,value.next]); }}/>
    {owner && <PersonaFiles key={owner} owner={owner} open={open}/>}
  </section>;
}
