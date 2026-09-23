import { useEffect, useState } from 'preact/hooks';
import { data, type Entity } from './api';
import type { Act } from './main';
import { fields, isRecordID, text } from './workspace';
import LiveActivity from './LiveActivity';
import { MessageComposer } from './MessageComposer';
import { useResource } from './hooks';
import { timestamp } from './identity';

function WorkReply({ run, open, act }: { run: Entity; open: (id: string) => void; act: Act }) {
  const { value, error } = useResource<Entity>('/records/' + run.scope, e => e.entity === run.scope);
  if (error) return <p role="alert">Could not load reply audience: {error}</p>;
  if (!value) return <p role="status">Loading reply audience…</p>;
  const environment = text(data(value).environment) || value.scope;
  return <MessageComposer to={text(data(run).persona)} work={run.scope} groupTo={isRecordID(environment) ? environment : undefined} audience="persona" act={act} open={open}/>;
}

/** Only the node's operator projection supplies the latest decision. */
export function RunProgress({ run, open, act }: { run: Entity; open: (id: string) => void; act: Act }) {
  const [reply, setReply] = useState(false);
  useEffect(() => setReply(false), [run.id]);
  const d = data(run), call = fields(d.latest_call), latest = fields(call.data);
  const input = fields(d.latest_user_input), inputRecord = fields(input.record);
  const active = ['queued', 'running'].includes(text(d.status));
  const canReply = isRecordID(d.persona) && isRecordID(run.scope) && d.historical !== true && d.imported_history !== true
    && !['removed', 'declined', 'cancelled'].includes(text(d.membership)) && !['cancelled', 'paused'].includes(text(d.status));
  return <div class="run-progress">
    {isRecordID(inputRecord.id) && <div class="latest-user-input"><p class="field-label">Your latest input · <time dateTime={text(inputRecord.created)}>{timestamp(text(inputRecord.created))}</time></p>
      <p>{input.acknowledged === true ? 'Persona acknowledged your input.' : isRecordID(input.included_call) ? 'Your input was included in a decision.' : 'Your input is delivered and awaiting a decision.'}</p>
      <button class="text-button" onClick={() => open(text(inputRecord.id))}>View your input and delivery</button>
    </div>}
    {active ? <p role="status">{d.status === 'queued' ? 'Ready for a decision; waiting for an execution slot.' : 'Decision in progress.'}</p>
      : text(d.note) && <div class="current-wait"><p class="field-label">{({outside_dependency:'Awaiting an outside observation',peer_dependency:'Awaiting an accepted peer contribution',scheduled:'Personal exploration scheduled',voluntary_yield:'Persona chose to yield',partial_delivery:'Partial delivery with remaining gaps',completion:'Checked delivery recorded',blocked:'A limitation stopped this decision'} as Record<string,string>)[text((d.stop_disposition as any)?.authored?.kind || (d.stop_disposition as any)?.classification)] || 'Current stop reason'} · <time dateTime={run.updated}>{timestamp(run.updated)}</time></p><p class="notice">{d.note}</p></div>}
    {canReply && (d.status === 'waiting' || reply) && <section class="run-reply" aria-label="Reply to this persona">
      {d.status === 'waiting' && <p class="micro">Open requests have a Respond now button. You can also send feedback or new direction for this work here.</p>}
      <button class="secondary" aria-expanded={reply} onClick={() => setReply(!reply)}>{reply ? 'Close reply' : 'Reply to persona'}</button>
      {reply && <WorkReply key={run.id} run={run} act={act} open={open}/>}
    </section>}
    {isRecordID(call.id) && <div class="latest-decision"><p class="field-label">Latest decision · {text(latest.status)} · <time dateTime={text(call.updated)}>{timestamp(text(call.updated))}</time></p>
      {text(latest.summary) && <p class="record-prose">{text(latest.summary)}</p>}
      {text(latest.error) && <p role="alert">{text(latest.error)}</p>}
      <button class="text-button" onClick={() => open(text(call.id))}>Inspect latest decision</button>
    </div>}
    <LiveActivity run={run.id} call={isRecordID(call.id) ? call.id : undefined} open={open}/>
  </div>;
}
