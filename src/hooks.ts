import { useEffect, useState } from 'preact/hooks';
import { changes, request, type Entity, type Page } from './api';
export function useResource<T>(path: string, relevant: (event: any) => boolean = () => true) {
  const [value, setValue] = useState<T>(); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined; let loading = false; let dirty = false;
    setValue(undefined); setError('');
    const load = async () => {
      if (loading) { dirty = true; return; } loading = true;
      try { const next = await request<T>(path, { signal: controller.signal }); if (!controller.signal.aborted) { setValue(next); setError(''); } }
      catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { loading = false; if (dirty && !controller.signal.aborted) { dirty = false; timer = setTimeout(() => { timer = undefined; load(); }, 200); } }
    };
    const onChange = (event: Event) => { const detail = (event as CustomEvent).detail; if (!detail || relevant(detail)) { if (!timer) timer = setTimeout(() => { timer = undefined; load(); }, 200); } };
    load(); changes.addEventListener('change', onChange);
    return () => { controller.abort(); clearTimeout(timer); changes.removeEventListener('change', onChange); };
  }, [path]);
  return { value, error };
}
export function useRecords(kind: string, scope = '', owner = '', query = '', after = 0, status = '') {
  const params = new URLSearchParams({ kind, scope, owner, query, status, after: String(after), limit: '24' });
  return useResource<Page<Entity>>('/records?' + params, e => kind.split(',').includes(e.kind) || kind === 'work' && ['run','request','submission','finding'].includes(e.kind));
}
