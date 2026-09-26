import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { useResource } from './hooks';
import { isRecordID, recordIDs, text, stateTone } from './workspace';
import { timestamp } from './identity';
import { excerpt, fileFormat, fileSize, recordExcerpt, recordTitle } from './reading';
import { RecordReference } from './RecordReader';
import Icon from './Icon';
import QuestionDelivery from './QuestionDelivery';
import { learningKind } from './inference-evidence';

type Links = { open: (id: string) => void; artifact?: (id: string) => void };
export function ContentCard({ record, open, artifact, summary, footer }: { record: Entity; summary?: string; footer?: string } & Links) {
  const d = data(record), isFile = record.kind === 'artifact', author = d.owner || d.author;
  const read = () => isFile && artifact ? artifact(record.id) : open(record.id);
  return <article class="card content-card" data-kind={record.kind} aria-label={recordTitle(record)}>
    <div class="card-top" aria-hidden="true"><span class="record-symbol"><Icon name={isFile ? 'File' : 'Learning'}/></span></div>
    <div class="card-content"><h3><button class="card-title" onClick={read}>{recordTitle(record)}</button></h3>
      <p class="card-summary">{recordExcerpt(record) || excerpt(summary) || (isFile ? 'Open the saved file to view or download it.' : 'Open to read the full document.')}</p>
      <div class="content-meta">{!isFile && <span>{learningKind(record.kind)}</span>}{isRecordID(author) && <span>By <RecordReference id={author} open={open} fallback="Author"/></span>}
        {footer ? <span>{footer}</span> : <time dateTime={record.updated}>{timestamp(record.updated)}</time>}
        {isFile && <span>{fileFormat(d.media_type, d.name)} · {fileSize(d.size)}</span>}
        {text(d.status) && <span class={'state-badge tone-' + stateTone(d.status)}>{d.status.replaceAll('_', ' ')}</span>}
      </div>
      <QuestionDelivery value={d.peer_delivery} status={d.status}/>
    </div><div class="content-actions"><button class="text-button card-open" onClick={read}>{isFile ? 'Open file' : record.kind === 'fragment' ? 'Read note' : 'Read document'} ↗</button>
      {isFile && <button class="text-button" onClick={() => open(record.id)}>File details</button>}</div>
  </article>;
}
function ContentReferenceCard({ id, open, artifact, summary, footer }: { id: string; summary?: string; footer?: string } & Links) {
  const { value, error, retry } = useResource<Entity>('/records/' + id, e => e.entity === id);
  if (error) return <article class="content-unavailable"><p role="alert">This document or file could not be loaded.</p><button class="secondary" onClick={retry}>Try again</button><button class="text-button" onClick={() => open(id)}>View details</button></article>;
  return value ? <ContentCard record={value} open={open} artifact={artifact} summary={summary} footer={footer}/> : <article class="content-loading" role="status">Loading document or file…</article>;
}

/** Bounded references, used by record readers as well as submitted work. */
export function ContentReferences({ ids, open, artifact }: { ids: string[] } & Links) {
  const [page, setPage] = useState(0), unique = [...new Set(ids.filter(isRecordID))], count = 8;
  const start = Math.min(page * count, Math.max(0, Math.ceil(unique.length / count) - 1) * count);
  if (!unique.length) return null;
  return <div class="content-references"><div class="cards compact-records reading-collection">
    {unique.slice(start, start + count).map(id => <ContentReferenceCard key={id} id={id} open={open} artifact={artifact}/>)}
  </div>{unique.length > count && <div class="record-pagination"><span>{start + 1}–{Math.min(start + count, unique.length)} of {unique.length}</span><div>
    <button class="secondary" disabled={!start} onClick={() => setPage(Math.max(0, Math.floor(start / count) - 1))}>Previous files</button>
    <button class="secondary" disabled={start + count >= unique.length} onClick={() => setPage(Math.floor(start / count) + 1)}>Next files</button>
  </div></div>}</div>;
}

/** Runtime provenance distinguishes published drafts, submissions and adopted candidates. */
export default function WorkArtifacts({ work, open, artifact }: { work: string } & Links) {
  const [cursors, setCursors] = useState([0]);
  const { value, error, loading, retry } = useResource<import('./contract').ApiTypes['work_files']>(`/work/${work}/files?after=${cursors.at(-1)}&limit=12`, e => ['artifact', 'document', 'submission', 'work_assembly', 'action'].includes(e.kind));
  const statuses: Record<string, string> = { published_draft: 'Published draft', submitted: 'Submitted · review is separate', adopted_candidate: 'In adopted candidate · approval is separate', historical_or_unavailable: 'Historical or unavailable' };
  return <section class="workspace-section artifact-library" aria-label="Documents & files" aria-busy={loading}>
    <header class="section-heading"><div><h2>Documents & files</h2><p>Read published drafts and submitted files. Each card shows how it relates to this work.</p></div></header>
    {error && <p role="alert">Documents and files could not be loaded. <button class="text-button" onClick={retry}>Try again</button></p>}
    {!value && !error && <p role="status">Loading work files…</p>}
    {value && !error && !value.items.length && <div class="workspace-empty"><strong>No documents or files on this page</strong><p>Files appear here when a persona publishes or submits them in this work.</p></div>}
    <div class="cards compact-records reading-collection">{value?.items.map(item => <ContentCard key={item.record.id} record={item.record} open={open} artifact={artifact} footer={statuses[item.status] || item.status}/>)}</div>
    {(cursors.length > 1 || value?.next != null) && <div class="record-pagination"><div>
      <button class="secondary" disabled={loading || cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Previous files</button>
      <button class="secondary" disabled={loading || value?.next == null} onClick={() => { if (value?.next != null) setCursors([...cursors, value.next]); }}>Next files</button>
    </div></div>}
  </section>;
}
