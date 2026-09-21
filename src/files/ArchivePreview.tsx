import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fileSize } from '../reading';
import Icon from '../Icon';
import FilePreview from './FilePreview';
import { fileFormat, folderItems, MAX_PREVIEW_BYTES, previewLimit, type ArchiveEntry, type PreviewFile } from './formats';
import { useObjectURL } from './useObjectURL';

function ExtractedFile({ entry, blob, depth }: { entry: ArchiveEntry; blob: Blob; depth: number }) {
  // Downloads must never expose active HTML/SVG documents on the UI origin.
  const name = entry.path.split('/').at(-1)!, format = fileFormat(name), url = useObjectURL(blob, 'application/octet-stream');
  return <><div class="archive-file-heading"><div><h3>{name}</h3><small>{format.label} · {fileSize(blob.size)}</small></div>
    {url && <a class="button secondary" href={url} download={name}>Download this file</a>}</div>
    <FilePreview file={{ blob, name, media: format.media }} depth={depth + 1}/></>;
}

export default function ArchivePreview({ file, depth }: { file: PreviewFile; depth: number }) {
  const worker = useRef<Worker>(), request = useRef(0), listFocus = useRef<HTMLButtonElement>(null);
  const [entries, setEntries] = useState<ArchiveEntry[]>(), [error, setError] = useState('');
  const [folder, setFolder] = useState(''), [page, setPage] = useState(0), [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ArchiveEntry>(), [blob, setBlob] = useState<Blob>(), [extractError, setExtractError] = useState(''), [bytes, setBytes] = useState(0);
  const [extracting, setExtracting] = useState(false);
  useEffect(() => {
    const current = new Worker(new URL('./archive.worker.ts', import.meta.url), { type: 'module' }); worker.current = current;
    current.onmessage = ({ data }) => {
      if (data.entries) setEntries(data.entries);
      else if (data.request === undefined && data.error) { setError('Could not browse this ZIP. ' + data.error); current.terminate(); worker.current = undefined; }
      else if (data.request === request.current) {
        if (data.error) { setExtractError('Could not extract this file. ' + data.error); setExtracting(false); }
        else if (data.blob) { setBlob(data.blob); setExtracting(false); }
        else if (typeof data.bytes === 'number') setBytes(data.bytes);
      }
    };
    current.onerror = () => { setError('The archive reader stopped. Close and reopen the file to try again.'); current.terminate(); worker.current = undefined; };
    current.postMessage({ kind: 'open', blob: file.blob });
    return () => { current.onmessage = null; current.onerror = null; current.terminate(); worker.current = undefined; };
  }, [file.blob]);

  const items = useMemo(() => folderItems(entries || [], folder).filter(item => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [entries, folder, query]);
  const count = 100, start = page * count, segments = folder ? folder.split('/') : [];
  function clearSelection() {
    request.current++; worker.current?.postMessage({ kind: 'cancel' });
    setSelected(undefined); setBlob(undefined); setExtractError(''); setExtracting(false); setBytes(0);
  }
  function navigate(path: string) { clearSelection(); setFolder(path); setQuery(''); setPage(0); }
  function extract(entry: ArchiveEntry) {
    clearSelection(); setSelected(entry);
    if (entry.encrypted) { setExtractError('This file is password protected. Download the archive to open it with your password.'); return; }
    const format = fileFormat(entry.path), limit = format.kind === 'unsupported' ? MAX_PREVIEW_BYTES : previewLimit(format.kind, format.media);
    if (entry.size > limit) { setExtractError('This file is too large for an in-browser preview. Download the archive to extract it.'); return; }
    setExtracting(true);
    worker.current?.postMessage({ kind: 'extract', index: entry.index, request: request.current, limit });
  }
  function back() { clearSelection(); requestAnimationFrame(() => listFocus.current?.focus()); }
  if (error) return <p role="alert">{error}</p>;
  if (!entries) return <p role="status">Reading archive folders…</p>;
  return <section class="archive-browser" aria-label={'Contents of ' + file.name}>
    <nav class="archive-breadcrumbs" aria-label="Archive folders"><button class="text-button" onClick={() => navigate('')}>Archive home</button>
      {segments.map((name, i) => <span key={i}><span aria-hidden="true"> / </span><button class="text-button" onClick={() => navigate(segments.slice(0, i + 1).join('/'))}>{name}</button></span>)}
    </nav>
    {selected ? <div class="archive-selection" key={selected.index}>
      <button class="secondary archive-back" onClick={back}>← Back to folder</button>
      {!blob && <h3>{selected.path.split('/').at(-1)}</h3>}
      {extracting && <><p role="status">Extracting selected file… {fileSize(bytes)} / {fileSize(selected.size)}</p><progress aria-label="Extracted file bytes" value={bytes} max={selected.size || 1}/><button class="secondary" onClick={back}>Cancel extraction</button></>}
      {extractError && <p role="alert">{extractError}</p>}
      {blob && <ExtractedFile entry={selected} blob={blob} depth={depth}/>}
    </div> : <>
      <div class="archive-toolbar"><p>{entries.filter(entry => !entry.directory).length.toLocaleString()} files in this archive</p><label>Find in this folder<input type="search" value={query} onInput={e => { setQuery(e.currentTarget.value); setPage(0); }}/></label></div>
      <ul class="archive-files" aria-label="Files and folders">{items.slice(start, start + count).map((item, i) => <li key={(item.directory ? 'folder:' : 'file:') + item.path}>
        <button ref={i === 0 ? listFocus : undefined} class="archive-file" onClick={() => item.directory ? navigate(item.path) : extract(item.entry!)} aria-label={(item.directory ? 'Open folder ' : 'Open file ') + item.name}>
          <span class="archive-icon"><Icon name={item.directory ? 'Folder' : 'File'}/></span><span class="archive-name">{item.name}<small>{item.directory ? 'Folder' : fileFormat(item.name).label + (item.entry!.encrypted ? ' · Password protected' : '')}</small></span>
          {!item.directory && <small class="archive-size">{fileSize(item.entry!.size)}</small>}<span aria-hidden="true">›</span>
        </button></li>)}</ul>
      {!items.length && <p class="reader-muted">{query ? 'No matching files in this folder.' : 'This folder is empty.'}</p>}
      {items.length > count && <div class="record-pagination"><small>{start + 1}–{Math.min(start + count, items.length)} of {items.length}</small><div>
        <button class="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous files</button><button class="secondary" disabled={start + count >= items.length} onClick={() => setPage(page + 1)}>Next files</button>
      </div></div>}
      <p class="reader-muted">Open a file to preview or download it. Files are extracted only when selected.</p>
    </>}
  </section>;
}
