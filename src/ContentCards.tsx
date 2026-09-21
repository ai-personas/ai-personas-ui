import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { useResource, useRecords } from './hooks';
import { isRecordID, recordIDs, text, stateTone } from './workspace';
import { timestamp } from './identity';
import { excerpt, fileFormat, fileSize, recordExcerpt, recordTitle } from './reading';
import { RecordReference } from './RecordReader';
import Icon from './Icon';

type Links = { open: (id: string) => void; artifact?: (id: string) => void };
export function ContentCard({ record, open, artifact, summary, footer }: { record: Entity; summary?: string; footer?: string } & Links) {
  const d = data(record), isFile = record.kind === 'artifact', author = d.owner || d.author;
  const read = () => isFile && artifact ? artifact(record.id) : open(record.id);
  return <article class="card content-card" data-kind={record.kind} aria-label={recordTitle(record)}>
    <div class="card-top" aria-hidden="true"><span class="record-symbol"><Icon name={isFile ? 'File' : 'Learning'}/></span></div>
    <div class="card-content"><h3><button class="card-title" onClick={read}>{recordTitle(record)}</button></h3>
      <p class="card-summary">{recordExcerpt(record) || excerpt(summary) || (isFile ? 'Open the saved file to view or download it.' : 'Open to read the full document.')}</p>
      <div class="content-meta">{isRecordID(author) && <span>By <RecordReference id={author} open={open} fallback="Author"/></span>}
        {footer ? <span>{footer}</span> : <time dateTime={record.updated}>{timestamp(record.updated)}</time>}
        {isFile && <span>{fileFormat(d.media_type, d.name)} · {fileSize(d.size)}</span>}
        {text(d.status) && <span class={'state-badge tone-' + stateTone(d.status)}>{d.status.replaceAll('_', ' ')}</span>}
      </div>
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

/** Only references actually submitted to this work are listed. Persona-owned
 * documents are never guessed into a task from author or environment alone. */
export default function WorkArtifacts({ work, open, artifact }: { work: string } & Links) {
  const [pages, setPages] = useState([{ after: 0, offset: 0 }]);
  const current = pages.at(-1)!;
  const { value, error, loading, retry } = useRecords('submission', work, '', '', current.after);
  const references = new Map<string, { id: string; summary: string; submitted: string }>();
  for (const submission of value?.items || []) {
    const d = data(submission);
    for (const id of [...recordIDs(d.documents), ...recordIDs(d.artifacts)]) {
      if (!references.has(id)) references.set(id, { id, summary: text(d.summary), submitted: submission.created });
    }
  }
  const all = [...references.values()], count = 12;
  const visible = all.slice(current.offset, current.offset + count);
  const more = current.offset + count < all.length || value?.next != null;
  return <section class="workspace-section artifact-library" aria-label="Documents & files" aria-busy={loading}>
    <header class="section-heading"><div><h2>Documents & files</h2><p>Read the work submitted by your personas, or open its original files.</p></div></header>
    {error && <p role="alert">Documents and files could not be loaded. <button class="text-button" onClick={retry}>Try again</button></p>}
    {!value && !error && <p role="status">Loading submitted work…</p>}
    {value && !error && !all.length && <div class="workspace-empty"><strong>No documents or files on this page</strong><p>When a persona submits its work, you can read it here.</p></div>}
    <div class="cards compact-records reading-collection">{visible.map(item => <ContentReferenceCard key={item.id} id={item.id} open={open} artifact={artifact} summary={item.summary} footer={'Submitted ' + timestamp(item.submitted)}/>)}</div>
    {(pages.length > 1 || more) && <div class="record-pagination"><span>{visible.length} documents and files on this page</span><div>
      <button class="secondary" disabled={loading || pages.length === 1} onClick={() => setPages(pages.slice(0, -1))}>Previous files</button>
      <button class="secondary" disabled={loading || !more} onClick={() => setPages([...pages, current.offset + count < all.length
        ? { ...current, offset: current.offset + count } : { after: value!.next!, offset: 0 }])}>Next files</button>
    </div></div>}
    <p class="record-caveat">Submitted work is available to read here. Review and approval are shown separately below.</p>
  </section>;
}
