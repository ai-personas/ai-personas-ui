import { useEffect, useState } from 'preact/hooks';
import { blob } from './api';

export default function Viewer({ id, close }: { id: string; close: () => void }) {
  const [url, setURL] = useState(''); const [text, setText] = useState(''); const [kind, setKind] = useState(''); const [error, setError] = useState(''); const [progress, setProgress] = useState([0, 0]); const [cancel, setCancel] = useState<AbortController>();
  useEffect(() => {
    const controller = new AbortController(); setCancel(controller); let objectURL = ''; let disposed = false;
    blob(id, controller.signal, (a, b) => setProgress([a, b])).then(async value => {
      if (disposed) return; objectURL = URL.createObjectURL(value); setURL(objectURL); setKind(value.type);
      if ((value.type.startsWith('text/') || value.type.includes('json')) && value.size < 2_000_000) setText(await value.text());
    }).catch(e => { if (!disposed) setError(e.name === 'AbortError' ? 'Loading cancelled' : e.message); });
    return () => { disposed = true; controller.abort(); if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [id]);
  return <div class="overlay" role="dialog" aria-modal="true" aria-label="Artifact viewer"><section class="viewer"><header><h2>Artifact</h2><button class="quiet" onClick={close}>Close ✕</button></header>
    {!url && !error && <div class="loading"><progress value={progress[0]} max={progress[1] || undefined} /><p>{(progress[0] / 1024).toFixed(0)} KB received</p><button onClick={() => cancel?.abort()}>Cancel loading</button></div>}
    {error && <p role="alert">{error}</p>}{url && <><div class="artifact-content">{kind.startsWith('image/') ? <img src={url} alt="Persona-authored artifact" /> : text ? <pre>{text}</pre> : <p>This file is ready to download and open in its native application.</p>}</div><a class="button" href={url} download={id}>Download original</a></>}
  </section></div>;
}
