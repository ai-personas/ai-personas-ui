import { useEffect, useState } from 'preact/hooks';
import { data, request, type Entity, type Page } from './api';
import { useRecords } from './hooks';
import { fields, isRecordID, text } from './workspace';
import { timestamp } from './identity';
import { RecordReference, Story } from './RecordReader';

/** Working intentions are authored in ordinary decisions. Cognitive interests
 * and relationships live in the persona's fragment graph, not a second store. */
export default function Perspectives({ work, open }: { work: string; open: (id: string) => void }) {
  const [cursors, setCursors] = useState([0]);
  const { value: page, error, loading, retry } = useRecords('run', work, '', '', cursors.at(-1)!);
  const [details, setDetails] = useState<{ page: Page<Entity>; rows: Entity[]; failures: number }>();
  useEffect(() => {
    if (!page) return;
    const controller = new AbortController();
    void Promise.allSettled(page.items.map(async summary => {
      const record = await request<Entity>('/records/' + summary.id, { signal: controller.signal });
      if (record.id !== summary.id || record.kind !== 'run' || record.scope !== work) throw new Error('Unexpected participation');
      return record;
    })).then(results => {
      if (!controller.signal.aborted) setDetails({ page, rows: results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []), failures: results.filter(r => r.status === 'rejected').length });
    });
    return () => controller.abort();
  }, [page, work]);
  const ready = page && details?.page === page;
  const rows = ready ? details.rows.filter(r => text(fields(data(r).continuity).focus) || Object.values(fields(data(r).working_intent)).some(Boolean)) : [];
  return <section class="workspace-section" aria-label="Individual approaches" aria-busy={loading || !ready}>
    <header class="section-heading"><div><h2>Individual approaches</h2><p>Each persona’s recorded focus and working intention. These are proposals, not accepted responsibilities or evidence of completion. Interests and relationship interpretations remain in each persona’s learning graph.</p></div></header>
    {error && <p role="alert">Approaches could not be refreshed. <button class="text-button" onClick={retry}>Try again</button></p>}
    {!ready && !error && <p role="status">Loading authored approaches…</p>}
    {ready && details.failures > 0 && <p role="alert">Some participations could not be loaded. <button class="text-button" onClick={retry}>Try again</button></p>}
    {ready && !error && !details.failures && !rows.length && <div class="workspace-empty"><strong>No working intentions recorded on this page</strong><p>Approaches appear when personas author them during their decisions. Trait values and activity do not supply an inferred intention.</p></div>}
    <div class="work-records">{rows.map(record => {
      const d = data(record), intent = fields(d.working_intent), continuity = fields(d.continuity);
      return <article class="work-record perspective-card" key={record.id}>
        <header><h3>{isRecordID(d.persona) ? <RecordReference id={d.persona} open={open}/> : 'Persona approach'}</h3><time dateTime={record.updated}>{timestamp(record.updated)}</time></header>
        <Story title="Current focus" value={continuity.focus}/><Story title="Intended outcome" value={intent.outcome}/>
        <Story title="Level of detail" value={intent.fidelity}/><Story title="Working with others" value={intent.collaboration}/>
        <button class="text-button" onClick={() => open(record.id)}>View participation</button>
      </article>;
    })}</div>
    {page && (cursors.length > 1 || page.next != null) && <nav class="record-pagination" aria-label="Approach pages"><div>
      <button class="secondary" disabled={loading || cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Previous approaches</button>
      <button class="secondary" disabled={loading || page.next == null} onClick={() => page.next != null && setCursors([...cursors, page.next])}>Next approaches</button>
    </div></nav>}
  </section>;
}
