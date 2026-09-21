import { useEffect, useRef, useState } from 'preact/hooks';
import { authHeaders, data, fileURL, request, type Entity } from './api';
import Dialog from './Dialog';
import FilePreview from './files/FilePreview';
import { fileFormat, previewLimit } from './files/formats';
import { fileSize } from './reading';
import './reading.css';
import './files/viewer.css';

type Phase = 'connecting' | 'receiving' | 'verifying' | 'ready' | 'native' | 'unloaded' | 'failed';
export default function Viewer({ id, close }: { id: string; close: () => void }) {
  const [record, setRecord] = useState<Entity>(), [blob, setBlob] = useState<Blob>(), [error, setError] = useState('');
  const [received, setReceived] = useState(0), [phase, setPhase] = useState<Phase>('connecting');
  const [enabled, setEnabled] = useState(true), [attempt, setAttempt] = useState(0), [sharing, setSharing] = useState('');
  const cancel = useRef<() => void>();
  useEffect(() => {
    setBlob(undefined); setError(''); setReceived(0);
    if (!enabled) { setPhase('unloaded'); return; }
    const controller = new AbortController();
    let worker: Worker | undefined, disposed = false;
    const dispose = () => { disposed = true; controller.abort(); if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); worker = undefined; } };
    cancel.current = dispose; setPhase('connecting');
    const fail = (message: string) => { if (!disposed) { setError(message); setPhase('failed'); worker?.terminate(); worker = undefined; } };
    void (async () => {
      const result = await request<Entity>('/records/' + id, { signal: controller.signal });
      if (disposed) return;
      if (result.kind !== 'artifact') throw new Error('This record is not a file.');
      setRecord(result); const d = data(result);
      if (!Number.isSafeInteger(d.size) || d.size < 0 || typeof d.media_type !== 'string') throw new Error('File size or format is unavailable.');
      const format = fileFormat(typeof d.name === 'string' ? d.name : '', d.media_type), limit = previewLimit(format.kind, format.media);
      if (format.kind === 'unsupported' || d.size > limit) { setPhase('native'); return; }
      const expected = typeof d.digest === 'string' ? d.digest.replace(/^sha256:/, '').toLowerCase() : '';
      if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('A valid SHA-256 is required to verify this preview. Download remains available.');
      setPhase('receiving');
      worker = new Worker(new URL('./files/artifact.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data: message }) => {
        if (disposed) return;
        if (message.error) { fail(message.error); return; }
        if (message.blob) { setBlob(message.blob); setPhase('ready'); worker?.terminate(); worker = undefined; }
        else { setReceived(message.bytes); if (message.verifying) setPhase('verifying'); }
      };
      worker.onerror = () => fail('The file reader stopped. Try loading the preview again.');
      worker.postMessage({ url: new URL(fileURL(id), location.origin).href, headers: authHeaders(), size: d.size, digest: expected, media: d.media_type, limit });
    })().catch(error => { if (!disposed) fail((error as Error).message); });
    return () => { dispose(); cancel.current = undefined; };
  }, [id, enabled, attempt]);
  const d = record && data(record), name = typeof d?.name === 'string' ? d.name : 'File';
  const format = d && fileFormat(name, typeof d.media_type === 'string' ? d.media_type : '');
  const busy = ['connecting', 'receiving', 'verifying'].includes(phase);
  function unload() { cancel.current?.(); setBlob(undefined); setEnabled(false); setPhase('unloaded'); }
  return <Dialog label="Artifact viewer" close={close}><section class="viewer reading-viewer">
    <header class="viewer-heading"><div><h2>{name}</h2>{d && <p>{format?.label} · {fileSize(d.size)}</p>}</div><button onClick={close}>Close viewer</button></header>
    <div class="preview-stage" role="status">{({ connecting: 'Connecting…', receiving: 'Loading file…', verifying: 'Verifying file…', ready: 'File loaded · bytes verified', native: 'Preview unavailable · download original', unloaded: 'Preview unloaded', failed: 'Preview failed' })[phase]}</div>
    {error && <p role="alert">{error}</p>}
    {blob && d && <FilePreview key={id + ':' + attempt} file={{ blob, name, media: d.media_type }}/>}
    {phase === 'native' && <p class="notice">{format?.kind === 'unsupported' ? 'A preview is not available for this format.' : 'This file is larger than the browser preview can hold comfortably.'} Download the original to open it in its application.</p>}
    {busy && <div class="preview-progress"><progress aria-label="Artifact bytes received" value={received} max={d?.size || 1}/><small>{fileSize(received)} / {fileSize(d?.size)}</small><button class="secondary" onClick={unload}>Cancel preview</button></div>}
    <footer class="viewer-footer"><div class="viewer-actions">
      {d && <a class="button" href={fileURL(id)} download={d.name}>Download original</a>}
      {phase === 'ready' && <button class="secondary" onClick={unload}>Unload preview</button>}
      {phase === 'unloaded' && <button class="secondary" onClick={() => setEnabled(true)}>Load preview</button>}
      {phase === 'failed' && <button class="secondary" onClick={() => setAttempt(n => n + 1)}>Retry preview</button>}
      {d && <button class="text-button" onClick={async () => { try { const node = await request<any>('/network'); await navigator.clipboard.writeText(JSON.stringify({ peer: node.id, address: node.addresses[0], artifact: id, digest: d.digest, size: d.size, name: d.name })); setSharing('Sharing details copied.'); } catch (e) { setSharing('Could not copy: ' + (e as Error).message); } }}>Copy sharing details</button>}
    </div>{sharing && <p role="status">{sharing}</p>}</footer>
  </section></Dialog>;
}
