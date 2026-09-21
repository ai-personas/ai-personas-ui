import { useEffect, useRef, useState } from 'preact/hooks';
import type { ApiTypes } from './contract';
import { data, type Entity, type Page } from './api';
import { useResource } from './hooks';
import { Pagination, Status, type Act } from './main';
import { text } from './workspace';

type Delivery = ApiTypes['message_delivery']['items'][number];
type Open = (id: string) => void;

export function MessageReceipt({ id, open }: { id: string; open: Open }) {
  const [cursors, setCursors] = useState([0]);
  const { value, error, loading } = useResource<Page<Delivery>>(`/messages/${id}/delivery?after=${cursors.at(-1)}&limit=24`,
    e => e.entity === id || ['action', 'run', 'call', 'resource_root'].includes(e.kind));
  const { value: message } = useResource<Entity>('/records/' + id, e => e.entity === id);
  if (message && data(message).to === 'user') return <p class="notice">This reply is saved for you in the work conversation.</p>;
  return <section class="message-receipt" aria-label="Message delivery" aria-busy={loading}>
    <h3>Message delivery</h3><p class="micro">Delivery, inclusion in a model request, and acknowledgment are separate. None guarantees a reply or acceptance of work.</p>
    {error && <p role="alert">Delivery status unavailable: {error}. Previously shown status may be stale.</p>}
    {!value && !error && <p role="status">Checking durable delivery…</p>}
    {value?.items.length === 0 && <p>No recipient delivery is recorded on this page. The message remains saved.</p>}
    {value?.items.map(delivery => {
      const run = delivery.participation, d = run ? data(run) : {};
      return <article class="delivery-recipient" key={delivery.persona}>
        <button class="text-button" onClick={() => open(delivery.persona)}>Persona {delivery.persona.slice(0,8)}</button>
        <ul class="receipt-stages">
          <li>{delivery.delivered ? 'Delivered to the inbox' : 'Retained; delivery is pending'}</li>
          <li>{delivery.included_call ? <button class="text-button" onClick={() => open(delivery.included_call!)}>Included in an admitted model request</button> : 'No model-request inclusion receipt recorded'}</li>
          <li>{delivery.acknowledged ? 'Acknowledged' : 'Not acknowledged'}</li>
        </ul>
        {run ? <><p>Current participation: <Status value={text(d.status)}/></p>{text(d.note) && <p class="notice">{d.note}</p>}
          <div class="button-row"><button class="text-button" onClick={() => open(run.id)}>Inspect activity</button><button class="text-button" onClick={() => open(run.scope)}>Open related work</button></div></>
          : <p class="notice">No active matching participation. The message is retained. Invite the persona to funded work to provide a work context; sending a message alone does not create one.</p>}
        {delivery.funding_root && <button class="secondary" onClick={() => open(delivery.funding_root!)}>Manage funding</button>}
      </article>;
    })}
    <Pagination previous={cursors.length > 1} next={value?.next} onPrevious={() => setCursors(cursors.slice(0,-1))} onNext={() => value?.next != null && setCursors([...cursors,value.next])}/>
  </section>;
}

export function MessageComposer({ to, work, environment, act, open, initialText = '', audience, groupTo }: {
  to: string; work?: string; environment?: string; act: Act; open: Open; initialText?: string; audience?: 'persona'; groupTo?: string;
}) {
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(''), [error, setError] = useState('');
  const [privateReply, setPrivateReply] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => input.current?.focus(), []);
  return <div><form onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const form = e.currentTarget, body = String(new FormData(form).get('text') || '').trim();
    setError(''); if (!body) { setError('Enter a message.'); return; }
    setBusy(true); setSent('');
    try {
      const action = await act('message.send', { to: groupTo && !privateReply ? groupTo : to, text: body, ...(work ? { work } : {}), ...(environment ? { environment } : {}) });
      setSent((action.result as Entity).id); form.reset();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>{groupTo && <label>Reply audience<select value={privateReply ? 'persona' : 'work'} onChange={e => setPrivateReply(e.currentTarget.value === 'persona')} disabled={busy}>
      <option value="work">All participants in this work</option><option value="persona">Only this persona</option>
    </select></label>}<label>{audience === 'persona' ? 'Your reply or direction' : work ? 'Message for this task' : 'Message'}<textarea ref={input} name="text" required rows={3} defaultValue={initialText}/></label>
    <p class="micro">{groupTo && !privateReply ? 'Shared with all participants in this work. Each can respond or contribute within the current allowance.' : audience === 'persona' ? 'Private reply to this persona in this work. Other participants cannot read or answer it.' : work ? 'Delivered only to participants in this work.' : 'General correspondence uses an existing participation when available. It does not start a new task.'}</p>
    {error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Sending…' : audience === 'persona' ? 'Send reply' : work ? 'Send to participants' : 'Send message'}</button>
  </form>{sent && <><p role="status">Message saved.</p><button class="text-button" onClick={() => open(sent)}>Open saved message</button><MessageReceipt id={sent} open={open}/></>}</div>;
}
