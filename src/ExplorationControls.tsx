import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { useRecords, useResource } from './hooks';
import { Pick } from './Create';
import { FundingChoice } from './Operator';
import type { Act } from './main';
import { text } from './workspace';

function PolicyForm({ persona, policy, act }: { persona: Entity; policy?: Entity; act: Act }) {
  const d = policy ? data(policy) : {}, [enabled, setEnabled] = useState(d.enabled === true);
  const [environment, setEnvironment] = useState<string[]>(d.environment ? [d.environment] : []);
  const [root, setRoot] = useState(text(d.resource_root || data(persona).resource_root));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  return <form class="development-card" onSubmit={async e => {
    e.preventDefault(); if (busy) return; const form = new FormData(e.currentTarget); setBusy(true); setError(''); setSaved(false);
    try {
      await act('exploration.configure', { persona: persona.id, revision: policy?.revision ?? 0, enabled, environment: environment[0], resource_root: root,
        calls_per_episode: Number(form.get('calls')), seconds_per_episode: Number(form.get('minutes')) * 60, max_episodes: Number(form.get('episodes')),
        expires: new Date(String(form.get('expires'))).toISOString(), reason: String(form.get('reason')) });
      setSaved(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <h4>Personal exploration between tasks</h4>
    <p>Exploring methods needed for active work already uses that work’s permission and funding. This setting allows the persona to propose separate investigations of its own interests.</p>
    <label class="check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.currentTarget.checked)}/>Enable optional personal exploration</label>
    <p class="micro">Disabled by default. Enabling does not create a question or a lesson. The persona chooses a question and stopping condition. Foreground work has priority.</p>
    <Pick kind="environment" value={environment} onChange={setEnvironment}/><p class="micro">Choose an environment where this persona already has access.</p>
    <FundingChoice value={root} onChange={setRoot} required/>
    <div class="profile-trait-fields"><label>Calls per episode<input name="calls" type="number" min="1" max="1000" defaultValue={d.calls_per_episode ?? 6} required/></label>
      <label>Minutes per episode<input name="minutes" type="number" min="1" max="10080" defaultValue={d.seconds_per_episode ? d.seconds_per_episode / 60 : 30} required/></label>
      <label>Total episode allowance<input name="episodes" type="number" min="1" max="10000" defaultValue={d.max_episodes ?? 3} required/></label>
      <label>Permission expires<input name="expires" type="datetime-local" required defaultValue={new Date(new Date(d.expires || Date.now() + 7 * 86400000).getTime() - new Date(d.expires || Date.now() + 7 * 86400000).getTimezoneOffset() * 60000).toISOString().slice(0,16)}/><small>Time is entered in your local timezone.</small></label></div>
    <p class="micro">Episodes use the existing allowance. Editing these limits does not reset spending or reclaim already started episodes. Changing or disabling the policy invalidates old scheduled triggers. Pause or cancel a started episode from its participation.</p>
    <label>Reason<textarea name="reason" rows={2} required/></label>
    {error && <p role="alert">{error}</p>}{saved && <p role="status">Exploration settings saved.</p>}
    <button disabled={busy || !environment.length || !root}>{busy ? 'Saving…' : 'Save exploration settings'}</button>
  </form>;
}
function CurrentPolicy({ id, persona, act }: { id: string; persona: Entity; act: Act }) {
  const { value, error, retry } = useResource<Entity>('/records/' + id, e => e.entity === id);
  return error ? <p role="alert">{error} <button onClick={retry}>Retry</button></p> : value ? <PolicyForm key={value.id + ':' + value.revision} persona={persona} policy={value} act={act}/> : <p>Loading exploration permission…</p>;
}
export default function ExplorationControls({ persona, act }: { persona: Entity; act: Act }) {
  const { value, error, loading } = useRecords('exploration_policy', persona.id, persona.id);
  if (error) return <p role="alert">{error}</p>;
  if (!value || loading) return <p>Loading exploration permission…</p>;
  return value.items[0] ? <CurrentPolicy id={value.items[0].id} persona={persona} act={act}/> : <PolicyForm persona={persona} act={act}/>;
}
