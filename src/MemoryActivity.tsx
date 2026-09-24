import { useState } from 'preact/hooks';
import { useResource } from './hooks';
import { fields, text } from './workspace';
import { Story } from './RecordReader';
import { timestamp } from './identity';
import Pagination from './Pagination';

type Entry = { action: string; call?: string; created: string; committed: boolean; state: string; disposition?: string; authored_intention?: string; focus?: string; learning?: string; committed_changes?: { created: number; revised: number; organized: number }; deferred?: unknown[]; error?: string };
export default function MemoryActivity({ owner, open }: { owner: string; open: (id: string) => void }) {
  const [pages, setPages] = useState([0]);
  const { value, error, loading, retry } = useResource<{items: Entry[]; next: number | null}>(`/personas/${owner}/memory/activity?after=${pages.at(-1)}&limit=12`, e => ['action', 'run', 'information_policy'].includes(e.kind));
  return <section aria-label="Learning activity" aria-busy={loading}>
    <h3>Learning activity</h3><p>What the persona chose to remember or reconsider in each decision. A saved fragment is not proof of later benefit.</p>
    {error && <p role="alert">Could not load learning activity. {error} <button onClick={retry}>Try again</button></p>}
    {!value && loading && <p role="status">Loading learning activity…</p>}
    {value?.items.map(item => <article class="memory-card learning-event" key={item.action}>
      <p class="field-label">{!item.committed ? (item.state === 'failed' ? 'Learning update failed · nothing committed' : 'Learning update pending') : ({retain:'Lesson written',revise:'Lesson revised',organize:'Learning reorganized',defer:'Idea deferred',no_change:'No fragment written'} as Record<string,string>)[item.disposition || ''] || 'Learning decision'}</p>
      {item.committed && ['retain','revise'].includes(item.authored_intention || '') && !item.committed_changes?.created && !item.committed_changes?.revised && <p class="notice">The persona intended to save learning, but supplied no fragment. Its next decision receives this feedback.</p>}
      <time dateTime={item.created}>{timestamp(item.created)}</time><Story title="Focus" value={item.focus}/><Story title="Persona’s judgment" value={item.learning}/>
      {item.committed && item.committed_changes && <p class="micro">{item.committed_changes.created} created · {item.committed_changes.revised} revised · {item.committed_changes.organized} reorganized</p>}
      {item.error && <Story title="Why it failed" value={item.error}/>}
      {item.deferred?.map((v, i) => { const entry = fields(v); return <div class="deferred-learning" key={i}><Story title="Idea to reconsider" value={entry.cue}/><Story title="Why it was deferred" value={entry.reason}/><Story title="Reconsider when" value={entry.reconsider_when}/></div>; })}
      {item.call && <button class="text-button" onClick={() => open(text(item.call))}>Read decision evidence</button>}
    </article>)}
    {value && !value.items.length && <p>No learning decisions recorded yet.</p>}
    <Pagination disabled={loading} previous={pages.length > 1} next={value?.next} onPrevious={() => setPages(pages.slice(0,-1))} onNext={() => {if (value?.next != null) setPages([...pages,value.next]);}}/>
  </section>;
}
