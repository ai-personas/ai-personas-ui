import { useEffect, useState } from 'preact/hooks';
import { changes, request, type Model } from './api';
import type { ApiTypes } from './contract';

type Catalog = ApiTypes['inference'];
export const modelKey = (model: Model) => JSON.stringify([model.provider, model.id]);

export function useModels(enabled = true) {
  const [catalog, setCatalog] = useState<Catalog>(), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const update = (e: Event) => { if ((e as CustomEvent).detail?.kind === 'provider_settings') setAttempt(n => n + 1); };
    changes.addEventListener('change', update); return () => changes.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    request<Catalog>('/inference' + (attempt ? '?refresh=true' : ''), { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setCatalog(value); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, enabled]);
  return { catalog, models: catalog?.models || [], loading, error, refresh: () => setAttempt(n => n + 1) };
}
export function ModelStatus({ catalog, models, loading, error, refresh }: ReturnType<typeof useModels>) {
  const unavailable = catalog?.providers.filter(p => !p.available) || [];
  return <div class="model-status"><div aria-live="polite">
    {loading ? <p role="status">Checking available models…</p> : error ? <p role="alert">Could not load models: {error}</p>
      : models.length ? <p class="micro">{models.length} available {models.length === 1 ? 'model' : 'models'}. Credentials stay on the node host.</p>
      : !unavailable.length && <p>No inference provider is enabled. Add a connection in Funding → Settings, then refresh.</p>}
    {!loading && unavailable.map(p => <p class="provider-notice" key={p.provider}><strong>{p.provider}</strong>: {p.message}</p>)}
  </div><button type="button" class="text-button" disabled={loading} onClick={refresh}>Refresh models</button></div>;
}
