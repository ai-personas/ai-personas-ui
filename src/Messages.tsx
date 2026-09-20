import { useState } from 'preact/hooks';
import type { ApiTypes } from './contract';
import { data, label, type Entity, type Page } from './api';
import { useRecords, useResource } from './hooks';
import { Pagination, Status, type Act } from './main';
import { text } from './workspace';
import { RunProgress } from './RunProgress';

type Delivery = ApiTypes['message_delivery']['items'][number];
type Open = (id: string) => void;

export function MessageReceipt({ id, open }: { id: string; open: Open }) {
  const [cursors, setCursors] = useState([0]);
  const { value, error, loading } = useResource<Page<Delivery>>(`/messages/${id}/delivery?after=${cursors.at(-1)}&limit=24`,
    e => e.entity === id || ['action', 'run', 'call', 'resource_root'].includes(e.kind));
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

export function MessageComposer({ to, work, environment, act, open, initialText = '' }: {
  to: string; work?: string; environment?: string; act: Act; open: Open; initialText?: string;
}) {
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(''), [error, setError] = useState('');
  return <div><form onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const form = e.currentTarget, body = String(new FormData(form).get('text') || '').trim();
    setError(''); if (!body) { setError('Enter a message.'); return; }
    setBusy(true); setSent('');
    try {
      const action = await act('message.send', { to, text: body, ...(work ? { work } : {}), ...(environment ? { environment } : {}) });
      setSent((action.result as Entity).id); form.reset();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}><label>{work ? 'Message for this task' : 'Message'}<textarea name="text" required rows={3} defaultValue={initialText}/></label>
    <p class="micro">{work ? 'Delivered only to participants in this work.' : 'General correspondence uses an existing participation when available. It does not start a new task.'}</p>
    {error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Sending…' : work ? 'Send to participants' : 'Send message'}</button>
  </form>{sent && <><p role="status">Message saved.</p><button class="text-button" onClick={() => open(sent)}>Open saved message</button><MessageReceipt id={sent} open={open}/></>}</div>;
}

export function PersonaActivity({ persona, funding, open, act }: { persona: string; funding?: string; open: Open; act: Act }) {
  const [cursors, setCursors] = useState([0]);
  const [introduction, setIntroduction] = useState('');
  const { value, error, loading } = useRecords('run', '', persona, '', cursors.at(-1));
  return <section class="persona-activity" aria-label="Current persona activity" aria-busy={loading}><h3>Current activity</h3>
    {error && <p role="alert">Activity unavailable: {error}</p>}
    {!value && !error && <p role="status">Loading participation…</p>}
    {value?.items.length === 0 && <p>No participation on this page. Select this persona when creating funded work to start its bounded orientation. It can choose its name and character there; names and portraits are optional.</p>}
    {value?.items.map(run => <article key={run.id}><p><Status value={text(data(run).status)}/></p><RunProgress run={run} open={open}/>
      <div class="button-row"><button class="text-button" onClick={() => open(run.id)}>Inspect activity {run.id.slice(0,8)}</button><button class="text-button" onClick={() => open(run.scope)}>Open related work</button>
        {!['cancelled'].includes(text(data(run).status)) && data(run).historical !== true && <button class="text-button" onClick={() => setIntroduction(introduction === run.id ? '' : run.id)}>Request introduction</button>}
      </div>{introduction === run.id && <div class="introduction-request"><p>Send one request in this work. A response uses the current allowance and may choose to author a profile; it does not grant new funding or resume paused work.</p><MessageComposer to={persona} work={run.scope} act={act} open={open} initialText="Please introduce yourself by choosing an optional display name and a concise, honest character in your persona profile. Describe your preferences and intentions without inventing human experience or credentials. Preserve any existing identity you want to keep. Continue to respect the current work and its allowance."/></div>}</article>)}
    {funding && <button class="secondary" onClick={() => open(funding)}>Manage funding</button>}
    <Pagination previous={cursors.length > 1} next={value?.next} onPrevious={() => setCursors(cursors.slice(0,-1))} onNext={() => value?.next != null && setCursors([...cursors,value.next])}/>
  </section>;
}

export function Correspondence({ persona, open }: { persona: string; open: Open }) {
  const [cursors, setCursors] = useState([0]);
  const { value, error } = useResource<Page<Entity>>(`/personas/${persona}/messages?after=${cursors.at(-1)}&limit=24`,
    e => e.kind === 'input' || e.kind === 'message');
  return <section aria-label="Persona correspondence">{error && <p role="alert">{error}</p>}
    {value?.items.map(message => <article class="correspondence-message" key={message.id}>
      <p class="field-label">{data(message).from === persona ? 'Sent' : 'Received'} · {message.created}</p><p class="long-text">{text(data(message).text, 'Payload unavailable')}</p>
      <button class="text-button" onClick={() => open(message.id)}>Open message and delivery status</button>
    </article>)}{value?.items.length === 0 && <p>No correspondence on this page.</p>}
    <Pagination previous={cursors.length > 1} next={value?.next} onPrevious={() => setCursors(cursors.slice(0,-1))} onNext={() => value?.next != null && setCursors([...cursors,value.next])}/>
  </section>;
}
