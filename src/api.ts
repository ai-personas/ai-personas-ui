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
export function connect(value: string) { token = value.trim(); pending.clear(); }
export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = 'HttpError'; this.status = status; }
}
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, { ...init, credentials: 'same-origin', headers: {
    Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers,
  } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new HttpError(typeof body.error === 'string' ? body.error : `Request failed (${response.status})`, response.status);
  }
  return response.json();
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
  return authored || ({ persona: 'Unnamed persona', environment: 'Unnamed environment', work: 'Untitled work',
    submission: 'Submitted version', finding: 'Assessment', request: 'Needs your input', run: 'Persona activity' } as Record<string, string>)[r.kind] || r.kind;
}
export const short = (value: unknown, length = 180) => (typeof value === 'string' ? value : JSON.stringify(value) || '').slice(0, length);
export const fileURL = (id: string) => '/api/artifacts/' + encodeURIComponent(id);
export const changes = new EventTarget();
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
      const response = await fetch('/api/events?after=' + cursor, { credentials: 'same-origin', headers: { Authorization: `Bearer ${token}` }, signal });
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
