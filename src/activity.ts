import type { ApiTypes } from './contract';
import { authHeaders } from './api';

export type Progress = ApiTypes['call_progress'];
type Listener = (progress: Progress | undefined, error: string) => void;
type Subscription = { listeners: Set<Listener>; controller: AbortController; value?: Progress; error: string };
const subscriptions = new Map<string, Subscription>();

/** One bounded stream per visible call, shared by the workspace and detail view. */
export function followProgress(id: string, listener: Listener) {
  let entry = subscriptions.get(id);
  if (!entry) {
    entry = { listeners: new Set(), controller: new AbortController(), error: '' };
    subscriptions.set(id, entry);
    void read(id, entry);
  }
  entry.listeners.add(listener); listener(entry.value, entry.error);
  const current = entry;
  return () => {
    current.listeners.delete(listener);
    if (!current.listeners.size) { current.controller.abort(); subscriptions.delete(id); }
  };
}

async function read(id: string, entry: Subscription) {
  const signal = entry.controller.signal;
  const emit = () => { for (const listener of entry.listeners) listener(entry.value, entry.error); };
  while (!signal.aborted) {
    try {
      const response = await fetch(`/api/calls/${id}/progress`, { credentials: 'same-origin', headers: authHeaders(), signal });
      if (!response.ok || !response.body) throw new Error('Progress stream unavailable');
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      try {
        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 262144) throw new Error('Progress frame exceeds the limit');
          let match: RegExpExecArray | null;
          while ((match = /\r?\n\r?\n/.exec(buffer))) {
            const block = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length);
            const raw = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
            if (!raw) continue;
            const progress = JSON.parse(raw) as Progress;
            if (!Array.isArray(progress.messages) || progress.messages.length > 16 || typeof progress.done !== 'boolean'
              || progress.messages.some(m => !['message', 'summary'].includes(m.kind) || typeof m.text !== 'string' || m.text.length > 8192)) {
              throw new Error('Invalid progress snapshot');
            }
            entry.value = progress; entry.error = ''; emit();
            if (progress.done) return;
          }
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      throw new Error('Progress connection ended');
    } catch (e) {
      if (signal.aborted) return;
      entry.error = `${(e as Error).message}. Reconnecting; displayed progress may be stale.`; emit();
    }
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, 1500); signal.addEventListener('abort', finish, { once: true });
      if (signal.aborted) finish();
    });
  }
}
