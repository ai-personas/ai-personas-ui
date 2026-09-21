import { useEffect, useState } from 'preact/hooks';
import { data, request, type Entity, type Page } from './api';
import { useRecords } from './hooks';
import { fields, isRecordID, text } from './workspace';
import { timestamp } from './identity';
import { RecordReference, RelatedItems, Story } from './RecordReader';

function perspectiveType(record: Entity): string {
  const d = data(record);
  return text(fields(d.draft).kind) || (text(d.agenda) ? 'agenda' : 'other');
}

function PerspectiveCard({ record, open }: { record: Entity; open: (id: string) => void }) {
  const d = data(record), draft = fields(d.draft), kind = perspectiveType(record);
  return <article class="work-record perspective-card">
    <header><h3>{text(d.title) || (kind === 'agenda' ? 'What I am focusing on' : kind === 'relationship' ? 'Working relationship' : 'Authored perspective')}</h3></header>
    <div class="reader-meta">{isRecordID(d.owner) && <span>By <RecordReference id={d.owner} open={open}/></span>}<time dateTime={record.updated}>{timestamp(record.updated)}</time></div>
    {kind === 'relationship' && isRecordID(draft.subject) && <p class="reader-byline">About working with <RecordReference id={draft.subject} open={open}/></p>}
    <Story value={draft.content || d.content || d.agenda}/>
    <Story title="Limitations" value={draft.limitations || d.limitations}/>
    <RelatedItems title="Sources" value={draft.sources || d.sources} open={open}/>
    <button class="text-button" onClick={() => open(record.id)}>View details ↗</button>
  </article>;
}

/** Work-scoped list rows omit draft content. Fetch just this bounded page, then
 * distinguish authored agendas from relationship notes without inventing either. */
export default function Perspectives({ work, open }: { work: string; open: (id: string) => void }) {
  const [cursors, setCursors] = useState([0]);
  const { value: page, error, loading, retry } = useRecords('perspective', work, '', '', cursors.at(-1)!);
  const [details, setDetails] = useState<{ page: Page<Entity>; rows: Entity[]; failures: number }>();
  useEffect(() => {
    if (!page) return;
    const controller = new AbortController();
    void Promise.allSettled(page.items.map(async summary => {
      const record = await request<Entity>('/records/' + summary.id, { signal: controller.signal });
      if (record.id !== summary.id || record.kind !== 'perspective' || record.scope !== work) throw new Error('Unexpected perspective');
      return record;
    })).then(results => {
      if (controller.signal.aborted) return;
      setDetails({ page, rows: results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []), failures: results.filter(result => result.status === 'rejected').length });
    });
    return () => controller.abort();
  }, [page, work]);
  const ready = page && details?.page === page, rows = ready ? details.rows : [];
  const agendas = rows.filter(r => perspectiveType(r) === 'agenda');
  const relationships = rows.filter(r => perspectiveType(r) === 'relationship');
  const other = rows.filter(r => !['agenda', 'relationship'].includes(perspectiveType(r)));
  return <>
    <section class="workspace-section" aria-label="Individual agendas" aria-busy={loading || !ready}>
      <header class="section-heading"><div><h2>Individual agendas</h2><p>Each persona’s written priorities for this work. Writing an agenda is optional; it is separate from accepting responsibilities or submitting results.</p></div></header>
      {error && <p role="alert">Agendas could not be refreshed. <button class="text-button" onClick={retry}>Try again</button></p>}
      {!ready && !error && <p role="status">Loading authored perspectives…</p>}
      {ready && details.failures > 0 && <p role="alert">{details.failures} {details.failures === 1 ? 'perspective could' : 'perspectives could'} not be loaded. <button class="text-button" onClick={retry}>Try again</button></p>}
      {ready && !error && !details.failures && !agendas.length && <div class="workspace-empty"><strong>{cursors.length === 1 && page.next == null && !rows.length ? 'No agendas have been written for this work' : 'No agendas on this page'}</strong><p>Personas can continue working without one. Use Message participants if you want them to describe their priorities. Their activity and character do not automatically become an agenda.</p></div>}
      <div class="work-records">{agendas.map(record => <PerspectiveCard key={record.id} record={record} open={open}/>)}</div>
    </section>
    {!!relationships.length && <section class="workspace-section" aria-label="Relationship notes"><header class="section-heading"><div><h2>Relationship notes</h2><p>Individual observations about working with another persona. These do not establish the other person’s agreement.</p></div></header><div class="work-records">{relationships.map(record => <PerspectiveCard key={record.id} record={record} open={open}/>)}</div></section>}
    {!!other.length && <section class="workspace-section" aria-label="Other authored perspectives"><h2>Other authored perspectives</h2><div class="work-records">{other.map(record => <PerspectiveCard key={record.id} record={record} open={open}/>)}</div></section>}
    {page && (cursors.length > 1 || page.next != null) && <nav class="record-pagination" aria-label="Perspective pages"><span>Agendas and relationship notes on this page</span><div>
      <button class="secondary" disabled={loading || cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Previous perspectives</button>
      <button class="secondary" disabled={loading || page.next == null} onClick={() => page.next != null && setCursors([...cursors, page.next])}>Next perspectives</button>
    </div></nav>}
  </>;
}
