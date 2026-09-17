import { useEffect, useRef, useState } from 'preact/hooks';
import { changes, request, type Entity, type Page } from './api';
import { matchesRecords } from './workspace';

export function useDebounced<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setSettled(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return settled;
}
export function useResource<T>(path: string, relevant: (event: any) => boolean = () => true) {
  const relevance = useRef(relevant); relevance.current = relevant;
  const [state, setState] = useState<{ path: string; value?: T; error: string; loading: boolean }>({ path, error: '', loading: true });
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined, loading = false, dirty = false;
    setState({ path, error: '', loading: true });
    const load = async () => {
      if (loading) { dirty = true; return; }
      loading = true;
      setState(s => ({ ...s, loading: true }));
      try {
        const value = await request<T>(path, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ path, value, error: '', loading: false });
      } catch (e) {
        if (!controller.signal.aborted) setState(s => ({ ...s, path, error: (e as Error).message, loading: false }));
      } finally {
        loading = false;
        if (dirty && !controller.signal.aborted) { dirty = false; timer = setTimeout(() => { timer = undefined; void load(); }, 180); }
      }
    };
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || relevance.current(detail)) {
        setState(s => ({ ...s, loading: true }));
        if (!timer) timer = setTimeout(() => { timer = undefined; void load(); }, 180);
      }
    };
    // Subscribe before reading, closing the local read/subscription race.
    changes.addEventListener('change', onChange); void load();
    return () => { controller.abort(); clearTimeout(timer); changes.removeEventListener('change', onChange); };
  }, [path]);
  // Never flash the previous work's data while effects for the new path are pending.
  return state.path === path ? state : { value: undefined, error: '', loading: true };
}
export function useRecords(kind: string, scope = '', owner = '', query = '', after = 0, status = '') {
  const params = new URLSearchParams({ kind, scope, owner, query, status, after: String(after), limit: '24' });
  return useResource<Page<Entity>>('/records?' + params, e => matchesRecords(e, kind, scope, owner));
}
