import { useEffect, useState } from 'preact/hooks';
import { authHeaders, data, fileURL, request, type Entity } from './api';
import Dialog from './Dialog';
type Phase = 'connecting' | 'receiving' | 'verifying' | 'preparing' | 'ready' | 'native' | 'canceled' | 'failed';
export default function Viewer({ id, close }: { id: string; close: () => void }) {
  const [record, setRecord] = useState<Entity>(), [text, setText] = useState(''), [error, setError] = useState('');
  const [progress, setProgress] = useState([0, 0]), [url, setURL] = useState(''), [phase, setPhase] = useState<Phase>('connecting');
  const [verified, setVerified] = useState(false), [cancel, setCancel] = useState<AbortController>(), [sharing, setSharing] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setCancel(controller);
    let objectURL = '', disposed = false;
    setRecord(undefined); setText(''); setError(''); setURL(''); setVerified(false); setProgress([0, 0]); setPhase('connecting');
    void (async () => {
      const r = await request<Entity>('/records/' + id, { signal: controller.signal });
      if (disposed || controller.signal.aborted) return;
      if (r.kind !== 'artifact') throw new Error('This record is not an artifact.');
      setRecord(r); const d = data(r);
      if (!Number.isSafeInteger(d.size) || d.size < 0 || typeof d.media_type !== 'string') throw new Error('Artifact size or media type is unavailable.');
      const image = ['image/png', 'image/jpeg', 'image/webp'].includes(d.media_type);
      const isText = d.media_type.startsWith('text/') || d.media_type.includes('json') || d.media_type === 'image/svg+xml';
      const limit = image ? 8_000_000 : 500_000;
      if (d.size > limit || (!image && !isText)) { setPhase('native'); return; }
      const expected = typeof d.digest === 'string' ? d.digest.replace(/^sha256:/, '').toLowerCase() : '';
      if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('A valid SHA-256 is required before preparing a preview.');
      if (!crypto.subtle) throw new Error('Digest verification requires a secure browser context. Download remains available.');
      setPhase('receiving'); setProgress([0, d.size]);
      const response = await fetch(fileURL(id), { headers: authHeaders(), credentials: 'same-origin', signal: controller.signal });
      if (!response.ok || !response.body) { await response.body?.cancel().catch(() => {}); throw new Error('Artifact could not be loaded.'); }
      const reader = response.body.getReader(), parts: Uint8Array<ArrayBuffer>[] = []; let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.length;
          if (bytes > limit || bytes > d.size) throw new Error('Preview exceeds the declared size or preview limit.');
          parts.push(new Uint8Array(chunk.value)); if (!disposed) setProgress([bytes, d.size]);
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (disposed || controller.signal.aborted) return;
      if (bytes !== d.size) throw new Error('Artifact size mismatch. No preview was rendered.');
      setPhase('verifying'); const blob = new Blob(parts, { type: d.media_type });
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      if (disposed || controller.signal.aborted) return;
      if (actual !== expected) throw new Error('Artifact digest mismatch. No preview was rendered.');
      setVerified(true); setPhase('preparing');
      if (image) { objectURL = URL.createObjectURL(blob); setURL(objectURL); }
      else { const body = await blob.text(); if (!disposed && !controller.signal.aborted) { setText(body); setPhase('ready'); } }
    })().catch(e => { if (!disposed) { setPhase(controller.signal.aborted ? 'canceled' : 'failed'); setError(controller.signal.aborted ? 'Preview canceled. The persona job was not canceled.' : e.message); } });
    return () => { disposed = true; controller.abort(); if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [id]);
  const d = record && data(record), busy = ['connecting', 'receiving', 'verifying', 'preparing'].includes(phase);
  return <Dialog label="Artifact viewer" close={close}><section class="viewer"><header><h2>{d?.name || 'Artifact'}</h2><button onClick={close}>Close viewer</button></header>
    <div class="preview-stage" role="status">{({ connecting: 'Connecting…', receiving: 'Receiving bytes…', verifying: 'Verifying SHA-256…', preparing: 'Preparing preview…', ready: 'Preview ready · bytes verified', native: 'Native application required · preview not loaded', canceled: 'Preview canceled', failed: 'Preview failed' })[phase]}</div>
    {error && <p role="alert">{error}</p>}
    {url && phase !== 'failed' && phase !== 'canceled' && <img class="artifact-image" src={url} alt="Recorded artifact preview" onLoad={() => setPhase('ready')} onError={() => { setPhase('failed'); setError('Verified bytes could not be decoded as the declared image type.'); }}/ >}
    {phase === 'ready' && !url && <pre>{text || '(Empty text file)'}</pre>}
    {phase === 'native' && <p>{d?.size.toLocaleString()} bytes. Open the original in its native application. HTML and SVG are never executed in the UI origin.</p>}
    {busy && <><progress aria-label="Artifact bytes received" value={progress[0]} max={progress[1] || 1}/><small>{progress[0].toLocaleString()} / {progress[1].toLocaleString()} bytes</small><button class="secondary" onClick={() => { cancel?.abort(); setPhase('canceled'); }}>Cancel preview</button></>}
    {verified && <p class="verified-digest">SHA-256 matches the recorded bytes. Integrity is not technical validation.</p>}
    {d && <><a class="button" href={fileURL(id)} download={d.name}>Download original</a><button class="secondary" onClick={async () => { try { const node = await request<any>('/network'); await navigator.clipboard.writeText(JSON.stringify({ peer: node.id, address: node.addresses[0], artifact: id, digest: d.digest, size: d.size, name: d.name })); setSharing('Sharing details copied.'); } catch (e) { setSharing('Could not copy: ' + (e as Error).message); } }}>Copy sharing details</button><p role="status">{sharing}</p><p class="download-note">Original downloads stream through the browser and are not verified by an unloaded preview. Closing this viewer aborts its reads and releases its object URL; it does not cancel work.</p></>}
  </section></Dialog>;
}
