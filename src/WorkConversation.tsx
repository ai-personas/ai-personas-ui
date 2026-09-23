import { useState } from 'preact/hooks';
import { data, type Entity, type Page } from './api';
import { useResource } from './hooks';
import { isRecordID, text } from './workspace';
import { Pagination } from './main';
import { timestamp } from './identity';

function Person({ id, open }: { id: string; open: (id: string) => void }) {
  const { value } = useResource<Entity>('/records/' + id, e => e.entity === id);
  return <button class="text-button" onClick={() => open(id)}>{value ? text(data(value).name) || 'Unnamed persona' : 'Persona'} <code>{id.slice(0, 8)}</code></button>;
}

/** Operator view. Audience labels do not grant persona access to private replies. */
export default function WorkConversation({ work, environment, open }: { work: string; environment: string; open: (id: string) => void }) {
  const [cursors, setCursors] = useState([0]);
  const { value, error, loading } = useResource<Page<Entity>>(`/work/${work}/messages?after=${cursors.at(-1)}&limit=12`,
    e => ['message', 'request', 'response', 'input'].includes(e.kind));
  return <section class="workspace-section work-conversation" aria-label="Work conversation" aria-busy={loading}>
    <header><div><h2>Conversation</h2><p>Messages, questions and replies · newest first</p></div></header>
    {error && <p role="alert">Conversation unavailable: {error}</p>}
    {!value && !error && <p role="status">Loading conversation…</p>}
    {value?.items.length === 0 && <p>No messages or questions yet. Use Message participants to start a shared conversation.</p>}
    {value?.items.map(record => {
      const d = data(record), from = text(record.kind === 'request' ? d.owner : d.from);
      const audience = record.kind === 'message'
        ? d.to === 'user' ? 'Reply to you' : d.to === environment ? 'All work participants' : 'Private message'
        : d.audience === 'work' ? 'Shared question' : 'User question';
      return <article class="conversation-entry" key={record.id} data-kind={record.kind}>
        <p class="field-label">{isRecordID(from) ? <Person id={from} open={open}/> : 'You'}<time dateTime={record.created}>{timestamp(record.created)}</time></p>
        <p class="micro">{record.kind === 'response' ? (d.audience === 'work' ? 'Shared answer' : 'Answer to the requesting persona') : audience}{text(d.status) ? ` · ${text(d.status)}` : ''}</p>
        <p class="record-prose">{text(record.kind === 'request' ? d.purpose : d.text)}</p>
        <button class="text-button" onClick={() => open(record.id)}>Read full {record.kind === 'request' ? 'question' : record.kind === 'response' ? 'answer' : 'message'}</button>
        {isRecordID(d.request) && <button class="text-button" onClick={() => open(text(d.request))}>Open question</button>}
      </article>;
    })}
    <Pagination previous={cursors.length > 1} next={value?.next} onPrevious={() => setCursors(cursors.slice(0, -1))} onNext={() => value?.next != null && setCursors([...cursors, value.next])}/>
  </section>;
}
