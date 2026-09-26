import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { changes, resourceRequest, type Entity, type Page } from './api';
import { matchesRecords } from './workspace';

export function useResource<T>(path: string, relevant: (event: any) => boolean = () => true, enabled = true) {
  return useObservation(path, signal => resourceRequest<T>(path, signal), relevant, enabled);
}

// A multi-record read uses the same cancellation and invalidation fence as a single resource.
export function useObservation<T>(path: string, read: (signal: AbortSignal) => Promise<T>, relevant: (event: any) => boolean = () => true, enabled = true) {
  const relevance = useRef(relevant); relevance.current = relevant;
  const reader = useRef(read); reader.current = read;
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  // A retry or re-enabled observer must revalidate even when its path is unchanged.
  const key = useMemo(() => ({ path, attempt, enabled }), [path, attempt, enabled]);
  const [state, setState] = useState<{ key: typeof key; value?: T; error: string; loading: boolean }>({ key, error: '', loading: true });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined, loading = false, dirty = false, generation = 0;
    // A retry may retain this resource's last snapshot, but never another path's records.
    setState(s => s.key.path === path ? { ...s, key, error: '', loading: true } : { key, error: '', loading: true });
    const schedule = () => {
      if (timer === undefined) timer = setTimeout(() => { timer = undefined; void load(); }, 180);
    };
    const load = async () => {
      if (loading) { dirty = true; return; }
      loading = true; dirty = false;
      const started = generation;
      setState(s => ({ ...s, loading: true }));
      try {
        const value = await reader.current(controller.signal);
        if (!controller.signal.aborted && started === generation) setState({ key, value, error: '', loading: false });
      } catch (e) {
        if (!controller.signal.aborted && started === generation) setState(s => ({ ...s, key, error: (e as Error).message, loading: false }));
      } finally {
        loading = false;
        if (dirty && !controller.signal.aborted) schedule();
      }
    };
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || relevance.current(detail)) {
        // An older in-flight success OR failure cannot finish this revalidation.
        generation++; dirty = true;
        setState(s => ({ ...s, error: '', loading: true }));
        if (!loading) schedule();
      }
    };
    // Subscribe before reading, closing the local read/subscription race.
    changes.addEventListener('change', onChange); void load();
    return () => { controller.abort(); clearTimeout(timer); changes.removeEventListener('change', onChange); };
  }, [key]);
  // Never flash another path, a failed attempt, or a disabled observer's snapshot.
  return { ...(enabled && state.key === key ? state : { value: undefined, error: '', loading: enabled }), retry };
}
export function useRecords(kind: string, scope = '', owner = '', query = '', after = 0, status = '') {
  const params = new URLSearchParams({ kind, scope, owner, query, status, after: String(after), limit: '24' });
  return useResource<Page<Entity>>('/records?' + params, e => matchesRecords(e, kind, scope, owner));
}
