import type { ApiTypes } from './contract';
export type Entity = ApiTypes['records']['items'][number];
export type Action = ApiTypes['action'];
export type Model = ApiTypes['model'];
export type Command = ApiTypes['command'];
export type Page<T> = { items: T[]; next: number | null; sequence: number };
export const data = (r: Entity): Record<string, any> => r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data as Record<string, any> : {};
// The operator token lives in this tab's memory, not persistent browser storage.
export let token = '';
try { sessionStorage.removeItem('personas-token'); } catch { /* Storage may be disabled. */ }
const pending = new Map<string, { body: string; inflight?: Promise<Action> }>();
let connectionGeneration = 0, resourceGeneration = 0;
export function connect(value: string) { connectionGeneration++; token = value.trim(); pending.clear(); for (const read of reads.values()) read.controller.abort(); reads.clear(); }
export function authHeaders(): Record<string, string> {
  return { 'X-Personas-Client': 'workspace', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = 'HttpError'; this.status = status; }
}
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, { ...init, credentials: 'same-origin', headers: {
    ...authHeaders(), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers,
  } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new HttpError(typeof body.error === 'string' ? body.error : `Request failed (${response.status})`, response.status);
  }
  return response.json();
}
// Share only in-flight reads. No completed payload remains cached after unmount.
const reads = new Map<string, { controller: AbortController; promise: Promise<unknown>; users: number }>();
export function resourceRequest<T>(path: string, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  // A new observer must not join a request that predates a known change.
  const session = connectionGeneration;
  const key = JSON.stringify([session, resourceGeneration, path]);
  let read = reads.get(key);
  if (!read) {
    const controller = new AbortController();
    read = { controller, users: 0, promise: request(path, { signal: controller.signal }) };
    const current = read;
    reads.set(key, read);
    void read.promise.finally(() => { if (reads.get(key) === current) reads.delete(key); }).catch(() => {});
  }
  const current = read; current.users++;
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const finish = () => {
      if (done) return false;
      done = true; signal.removeEventListener('abort', abort);
      current.controller.signal.removeEventListener('abort', abort);
      if (--current.users === 0) { current.controller.abort(); if (reads.get(key) === current) reads.delete(key); }
      return true;
    };
    const abort = () => { if (finish()) reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    current.controller.signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted || current.controller.signal.aborted) abort();
    current.promise.then(value => {
      if (session !== connectionGeneration) abort();
      else if (finish()) resolve(value as T);
    }, error => {
      if (session !== connectionGeneration) abort();
      else if (finish()) reject(error);
    });
  });
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + stable(v)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
/** An ambiguous transport retry of an identical intent reuses its exact saved envelope. */
export function operate(kind: Command['kind'], args: unknown, actor = '', run = ''): Promise<Action> {
  const key = stable({ kind, args, actor, run });
  let entry = pending.get(key);
  if (entry?.inflight) return entry.inflight;
  if (!entry) {
    if (pending.size >= 100) return Promise.reject(new Error('Too many unresolved operations. Inspect action receipts before continuing.'));
    entry = { body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), kind, actor, run, args }) };
    pending.set(key, entry);
  }
  const current = entry;
  const promise = request<Action>('/operations', { method: 'POST', body: current.body }).then(action => {
    if (['uncertain', 'effect_unknown'].includes(action.state)) {
      throw new Error(`Operation outcome is uncertain. Retry only this same intent to inspect its receipt; do not create a replacement effect. ${action.error || ''}`);
    }
    if (pending.get(key) === current) pending.delete(key);
    if (['failed', 'conflict', 'denied'].includes(action.state)) throw new Error(action.error || `Operation ${action.state}; details were preserved.`);
    changed(); return action;
  }).catch(error => {
    // Definite client rejection can be corrected as a new operation. 5xx/network ambiguity cannot.
    if (error instanceof HttpError && error.status >= 400 && error.status < 500 && pending.get(key) === current) pending.delete(key);
    throw error;
  }).finally(() => { if (pending.get(key) === current) current.inflight = undefined; });
  current.inflight = promise; return promise;
}
export function label(r?: Entity): string {
  if (!r) return 'Unloaded record'; const d = data(r);
  const authored = [d.name, d.title, d.purpose].find(v => typeof v === 'string' && v.trim());
  if (!authored && ['persona', 'environment'].includes(r.kind)) return `Unnamed ${r.kind} · ${r.id.slice(0, 8)}`;
  return authored || ({ persona: 'Unnamed persona', environment: 'Unnamed environment', work: 'Untitled work',
    submission: 'Submitted version', finding: 'Assessment', request: 'Needs your input', run: 'Persona activity' } as Record<string, string>)[r.kind] || r.kind;
}
export const short = (value: unknown, length = 180) => (typeof value === 'string' ? value : JSON.stringify(value) || '').slice(0, length);
export const fileURL = (id: string) => '/api/artifacts/' + encodeURIComponent(id);
export const changes = new EventTarget();
// Register before UI observers, including observers added during dispatch. This
// only fences future sharing; existing hooks decide which resources to reload.
changes.addEventListener('change', () => { resourceGeneration++; });
export function changed(detail: unknown = null) { changes.dispatchEvent(new CustomEvent('change', { detail })); }
export async function watch(signal: AbortSignal, status: (message: string) => void) {
  let cursor: number | undefined;
  while (!signal.aborted) {
    try {
      // Initial session and watermark acquisition belong inside the retry boundary too.
      await request('/session', { method: 'POST', signal });
      if (cursor === undefined) {
        const page = await request<Page<Entity>>('/records?kind=work&limit=1', { signal });
        if (!Number.isSafeInteger(page.sequence) || page.sequence < 0) throw new Error('Invalid activity watermark');
        cursor = page.sequence; changed();
      }
      const response = await fetch('/api/events?after=' + cursor, { credentials: 'same-origin', headers: authHeaders(), signal });
      if (response.status === 409 || response.status === 410) cursor = undefined;
      if (!response.ok || !response.body) throw new Error('Activity stream unavailable');
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      status('Connected');
      try {
        while (!signal.aborted) {
          const { value, done } = await reader.read(); if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 1_048_576) throw new Error('Activity frame exceeds the limit');
          let match: RegExpExecArray | null;
          while ((match = /\r?\n\r?\n/.exec(buffer))) {
            const block = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length);
            const raw = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
            if (!raw) continue;
            const event = JSON.parse(raw);
            if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) throw new Error('Invalid activity cursor');
            if (event.sequence > (cursor ?? -1)) { cursor = event.sequence; changed(event); }
          }
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } catch (e) { if (signal.aborted) return; }
    if (signal.aborted) return;
    status('Reconnecting · displayed data may be stale');
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, 1000); signal.addEventListener('abort', finish, { once: true });
      if (signal.aborted) finish();
    });
  }
}
