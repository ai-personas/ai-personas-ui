import { useState } from 'preact/hooks';
import { data, label, type Entity, type Page } from './api';
import { useRecords, useResource } from './hooks';
import { Pagination, Status, type Act } from './main';
import { text, inputRequestCount } from './workspace';
import { InputNotice } from './Attention';
import { RunProgress } from './RunProgress';
import { MessageComposer } from './MessageComposer';
export { MessageComposer, MessageReceipt } from './MessageComposer';

type Open = (id: string) => void;

export function PersonaActivity({ persona, funding, open, act }: { persona: string; funding?: string; open: Open; act: Act }) {
  const [cursors, setCursors] = useState([0]);
  const [introduction, setIntroduction] = useState('');
  const { value, error, loading } = useRecords('run', '', persona, '', cursors.at(-1));
  return <section class="persona-activity" aria-label="Current persona activity" aria-busy={loading}><h3>Current activity</h3>
    {error && <p role="alert">Activity unavailable: {error}</p>}
    {!value && !error && <p role="status">Loading participation…</p>}
    {value?.items.length === 0 && <p>No participation on this page. Select this persona when creating funded work to start its bounded orientation. It can choose its name, character and optional OCEAN/VAD descriptors there; no default identity scores are assigned.</p>}
    {value?.items.map(run => <article key={run.id} class={inputRequestCount(run) ? 'needs-input' : ''}><p><Status value={text(data(run).status)}/></p><InputNotice record={run} open={open}/><RunProgress run={run} open={open} act={act}/>
      <div class="button-row"><button class="text-button" onClick={() => open(run.id)}>Inspect activity {run.id.slice(0,8)}</button><button class="text-button" onClick={() => open(run.scope)}>Open related work</button>
        {!['cancelled'].includes(text(data(run).status)) && data(run).historical !== true && <button class="text-button" onClick={() => setIntroduction(introduction === run.id ? '' : run.id)}>Request introduction</button>}
      </div>{introduction === run.id && <div class="introduction-request"><p>Send one request in this work. A response uses the current allowance and may choose to author a profile; it does not grant new funding or resume paused work.</p><MessageComposer to={persona} work={run.scope} act={act} open={open} initialText="Please introduce yourself by choosing an optional display name and a concise, honest character in your persona profile. Describe your preferences and intentions without inventing human experience or credentials. You may also author optional OCEAN dispositions (openness, conscientiousness, extraversion, agreeableness, neuroticism, each 0 to 1) and current modeled VAD affect (valence, arousal, dominance, each -1 to 1). Omit dimensions you cannot meaningfully describe; do not invent default scores or claim human feelings. Use persona.update with your current revision and a concise reason for character, attribute or descriptor changes; cite readable retained record IDs as evidence when relevant. Preserve existing identity and values you want to keep. Learning does not require scores to change, and traits grant no expertise or authority. Continue to respect the current work, consent boundaries and allowance."/></div>}</article>)}
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
