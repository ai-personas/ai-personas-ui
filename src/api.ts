import type { ApiTypes } from './contract';
export type Entity = ApiTypes['snapshot']['records'][number];
export type Action = ApiTypes['action'];
export type Detail = ApiTypes['detail'];
export type Model = ApiTypes['model'];
export type Snapshot = ApiTypes['snapshot'];
export const data = (r: Entity): { [key: string]: any } => r.data as { [key: string]: any };
export let token = sessionStorage.getItem('personas-token') || '';
export function connect(value: string) { token = value.trim(); sessionStorage.setItem('personas-token', token); }
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Request failed (${response.status})`); }
  return response.json();
}
export async function operate(kind: string, args: unknown, actor = '', run = ''): Promise<Action> {
  const action = await request<Action>('/operations', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), kind, actor, run, args }) });
  if (action.state === 'failed' || action.state === 'conflict') throw new Error(action.error || `Operation ${action.state}; details were preserved.`);
  return action;
}
export async function blob(id: string, signal: AbortSignal, progress: (read: number, total: number) => void) {
  const response = await fetch('/api/artifacts/' + encodeURIComponent(id), { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!response.ok) throw new Error('Artifact could not be loaded');
  const reader = response.body!.getReader(); const total = Number(response.headers.get('content-length') || 0); const parts: Uint8Array<ArrayBuffer>[] = []; let read = 0;
  try { while (true) { const chunk = await reader.read(); if (chunk.done) break; parts.push(chunk.value); read += chunk.value.length; progress(read, total); } }
  finally { reader.releaseLock(); }
  return new Blob(parts, { type: response.headers.get('content-type') || 'application/octet-stream' });
}
export function label(r?: Entity) { if (!r) return 'Unknown'; const d = data(r); return d.name || d.title || ({ persona: 'Unnamed persona', environment: 'Unnamed environment', work: 'Untitled work' } as { [key: string]: string })[r.kind] || r.kind; }
export const short = (value: unknown, length = 180) => (typeof value === 'string' ? value : JSON.stringify(value) || '').slice(0, length);
