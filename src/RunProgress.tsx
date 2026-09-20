import { data, type Entity } from './api';
import { fields, isRecordID, text } from './workspace';
import LiveActivity from './LiveActivity';

/** Only the node's operator projection supplies the latest decision. */
export function RunProgress({ run, open }: { run: Entity; open: (id: string) => void }) {
  const d = data(run), call = fields(d.latest_call), latest = fields(call.data);
  const active = ['queued', 'running'].includes(text(d.status));
  return <div class="run-progress">
    {active ? <p role="status">{d.status === 'queued' ? 'Ready for a decision; waiting for an execution slot.' : 'Decision in progress.'}</p>
      : text(d.note) && <p class="notice">{d.note}</p>}
    {!active && d.status === 'waiting' && <p class="micro">Waiting keeps unfinished work open. New input or a funding change can allow another decision; Resume explicitly requests one.</p>}
    {isRecordID(call.id) && <div class="latest-decision"><p class="field-label">Latest decision · {text(latest.status)} · <time dateTime={text(call.updated)}>{text(call.updated)}</time></p>
      {text(latest.summary) && <p class="record-prose">{text(latest.summary)}</p>}
      {text(latest.error) && <p role="alert">{text(latest.error)}</p>}
      <button class="text-button" onClick={() => open(text(call.id))}>Inspect latest decision</button>
    </div>}
    <LiveActivity run={run.id} call={isRecordID(call.id) ? call.id : undefined}/>
  </div>;
}
