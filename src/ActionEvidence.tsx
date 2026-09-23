import { type Action } from './api';
import { useResource } from './hooks';
import ActionReader from './ActionReader';
export default function ActionEvidence({ id, digest, open }: { id: string; digest?: string; open: (id: string) => void }) {
  const { value, error, retry } = useResource<Action>('/actions/' + id, e => e.entity === id);
  return <section class="development-card">{error ? <p role="alert">Evidence unavailable: {error} <button onClick={retry}>Retry</button></p> : value ? <ActionReader action={value} open={open}/> : <p role="status">Loading the recorded observation…</p>}
    {digest && <details><summary>Exact evidence reference</summary><p>The interpretation cites this receipt fingerprint. A later reconciliation can change the current receipt shown above; the original reference remains historical evidence.</p><code>{digest}</code></details>}
  </section>;
}
