import { useEffect, useState } from 'preact/hooks';
import { data, fileURL, request, token, type Entity } from './api';
export default function Viewer({ id, close }: { id: string; close: () => void }) {
  const [record, setRecord] = useState<Entity>(); const [text, setText] = useState(''); const [error, setError] = useState('');
  const [progress, setProgress] = useState([0, 0]); const [url, setURL] = useState(''); const [cancel, setCancel] = useState<AbortController>();
  useEffect(() => {
    const controller = new AbortController(); setCancel(controller); let objectURL = ''; let disposed = false;
    (async () => {
      const r = await request<Entity>('/records/' + id, { signal: controller.signal }); if (disposed) return; setRecord(r);
      const d = data(r); const image = ['image/png','image/jpeg','image/webp','image/svg+xml'].includes(d.media_type);
      if (d.size > (image ? 8_000_000 : 500_000) || (!image && !d.media_type.startsWith('text/') && !d.media_type.includes('json'))) return;
      const response = await fetch(fileURL(id), { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      if (!response.ok || !response.body) throw new Error('Artifact could not be loaded');
      const reader = response.body.getReader(); const parts: Uint8Array<ArrayBuffer>[] = []; let bytes = 0;
      try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length; if (bytes > 8_000_000) throw new Error('Preview limit exceeded'); parts.push(chunk.value); if (!disposed) setProgress([bytes, d.size]); } }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const value = new Blob(parts, { type: d.media_type });
      if (disposed) return;
      if (image) { objectURL = URL.createObjectURL(value); setURL(objectURL); } else setText(await value.text());
    })().catch(e => !disposed && setError(e.name === 'AbortError' ? 'Preview loading cancelled' : e.message));
    return () => { disposed = true; controller.abort(); if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [id]);
  const d = record && data(record);
  return <div class="overlay" role="dialog" aria-modal="true" aria-label="Artifact viewer"><section class="viewer"><header><h2>{d?.name || 'Artifact'}</h2><button onClick={close}>Close viewer</button></header>
    {error && <p role="alert">{error}</p>}{url ? <img class="artifact-image" src={url} alt="Persona-authored artifact" /> : text ? <pre>{text}</pre> : d ? <p>{d.size.toLocaleString()} bytes. Download to open the complete file in its native application.</p> : <p>Loading artifact details…</p>}
    {progress[1] > 0 && !url && !text && <><progress value={progress[0]} max={progress[1]} /><button onClick={() => cancel?.abort()}>Cancel preview</button></>}
    {d && <><a class="button" href={fileURL(id)} download={d.name}>Download original</a><button class="secondary" onClick={async () => { const node = await request<any>('/network'); await navigator.clipboard.writeText(JSON.stringify({ peer: node.id, address: node.addresses[0], artifact: id, digest: d.digest, size: d.size, name: d.name })); }}>Copy sharing details</button><p class="micro">Downloads stream through your browser. Closing this viewer releases its preview.</p></>}
  </section></div>;
}
