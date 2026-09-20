import { useEffect, useRef, useState } from 'preact/hooks';
import { authHeaders, type Action } from './api';
export default function Upload({ onFile }: { onFile: (id: string, name: string) => void }) {
  const [progress, setProgress] = useState(''); const cancel = useRef<() => void>();
  useEffect(() => () => cancel.current?.(), []);
  async function upload(file: File) {
    cancel.current?.(); let disposed = false; let xhr: XMLHttpRequest | undefined;
    const worker = new Worker(new URL('./upload.worker.ts', import.meta.url), { type: 'module' });
    cancel.current = () => { disposed = true; worker.terminate(); xhr?.abort(); };
    setProgress('Checking file…');
    worker.onmessage = ({ data }) => {
      if (disposed) return;
      if (data.error) { setProgress(data.error); worker.terminate(); return; }
      if (!data.digest) { setProgress(`Checking file · ${Math.round(data.bytes / (file.size || 1) * 100)}%`); return; }
      worker.terminate(); xhr = new XMLHttpRequest();
      const q = new URLSearchParams({ id: crypto.randomUUID().replaceAll('-', ''), name: file.name, media_type: file.type || 'application/octet-stream', size: String(file.size), digest: data.digest });
      xhr.open('POST', '/api/uploads?' + q);
      for (const [key, value] of Object.entries(authHeaders())) xhr.setRequestHeader(key, value);
      xhr.upload.onprogress = e => !disposed && setProgress(`Uploading · ${Math.round(e.loaded / (e.total || file.size || 1) * 100)}%`);
      xhr.onload = () => { if (disposed) return; try { const result: Action = JSON.parse(xhr!.responseText); if (xhr!.status !== 200 || result.state !== 'succeeded') throw new Error(result.error || 'Upload failed'); onFile((result.result as any).id, file.name); setProgress('File attached'); } catch (e) { setProgress((e as Error).message); } };
      xhr.onerror = () => !disposed && setProgress('Upload connection failed'); xhr.send(file);
    };
    worker.onerror = event => { if (!disposed) setProgress(event.message || 'File checking failed'); worker.terminate(); };
    worker.postMessage(file);
  }
  return <div><label>Attach evidence<input type="file" onChange={e => { const file = e.currentTarget.files?.[0]; if (file) upload(file); }} /></label>{progress && <p aria-live="polite">{progress} <button type="button" class="quiet" onClick={() => { cancel.current?.(); setProgress('Upload cancelled'); }}>Cancel upload</button></p>}</div>;
}
