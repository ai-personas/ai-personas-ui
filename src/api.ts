import type { ApiTypes } from './contract';
export type Entity = ApiTypes['records']['items'][number];
export type Action = ApiTypes['action'];
export type Model = ApiTypes['model'];
export type Command = ApiTypes['command'];
export type Page<T> = { items: T[]; next: number | null; sequence: number };
export const data = (r: Entity): Record<string, any> => r.data as Record<string, any>;
export let token = sessionStorage.getItem('personas-token') || '';
export function connect(value: string) { token = value.trim(); sessionStorage.setItem('personas-token', token); }
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Request failed (${response.status})`); }
  return response.json();
}
export async function operate(kind: Command['kind'], args: unknown, actor = '', run = ''): Promise<Action> {
  const action = await request<Action>('/operations', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), kind, actor, run, args }) });
  if (action.state === 'failed' || action.state === 'conflict') throw new Error(action.error || `Operation ${action.state}; details were preserved.`);
  return action;
}
export function label(r?: Entity) {
  if (!r) return 'Unloaded record'; const d = data(r);
  return d.name || d.title || d.purpose || ({ persona: 'Unnamed persona', environment: 'Unnamed environment', work: 'Untitled work', submission: 'Submitted version', finding: 'Assessment', request: 'Needs your input', run: 'Persona activity' } as Record<string, string>)[r.kind] || r.kind;
}
export const short = (value: unknown, length = 180) => (typeof value === 'string' ? value : JSON.stringify(value) || '').slice(0, length);
export const fileURL = (id: string) => '/api/artifacts/' + encodeURIComponent(id);
export const changes = new EventTarget();
export function changed() { changes.dispatchEvent(new CustomEvent('change', { detail: null })); }
export async function watch(signal: AbortSignal, status: (message: string) => void) {
  let cursor = (await request<Page<Entity>>('/records?kind=work&limit=1', { signal })).sequence;
  changed();
  while (!signal.aborted) {
    try {
      const response = await fetch('/api/events?after=' + cursor, { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!response.ok || !response.body) throw new Error('Activity stream unavailable');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = '';
      status('Connected');
      try { while (!signal.aborted) {
        const { value, done } = await reader.read(); if (done) break;
        pending += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = pending.indexOf('\n\n')) >= 0) {
          const block = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
          const raw = block.split('\n').find(l => l.startsWith('data:'))?.slice(5).trim();
          if (raw) { const event = JSON.parse(raw); cursor = event.sequence; changes.dispatchEvent(new CustomEvent('change', { detail: event })); }
        }
      } } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } catch (e) { if (signal.aborted) return; status('Reconnecting to activity…'); }
    if (signal.aborted) return;
    await new Promise<void>(resolve => { const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); }; const timer = setTimeout(finish, 1000); signal.addEventListener('abort', finish, { once: true }); });
  }
}
