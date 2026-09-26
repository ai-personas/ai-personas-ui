import CharacterInitialization from './CharacterInitialization';
import CurrentSelf from './CurrentSelf';
import { useEffect, useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { fields, isRecordID, text } from './workspace';
import { timestamp } from './identity';
import Traits from './Traits';
import { lazy, Suspense } from 'preact/compat';
import type { Act } from './main';
const IdentityHistory = lazy(() => import('./IdentityHistory'));
const ProfileEditor = lazy(() => import('./ProfileEditor'));
const Development = lazy(() => import('./Development'));
import { Story, RelatedItems } from './RecordReader';
import './identity.css';

export default function Identity({ persona, open, act }: { persona: Entity; act: Act; open: (id: string) => void }) {
  const d = data(persona), creation = fields(d.creation), milestones = fields(d.milestones), sponsor = text(creation.sponsor);
  const [copied, setCopied] = useState(false), [history, setHistory] = useState(false), [copyError, setCopyError] = useState(''), [editing, setEditing] = useState(false), [starting, setStarting] = useState(false), [development, setDevelopment] = useState(false);
  useEffect(() => { setCopied(false); setCopyError(''); setHistory(false); setEditing(false); setStarting(false); setDevelopment(false); }, [persona.id]);
  return <section class="identity-profile" aria-label="Persona identity">
    <header><h3>Identity</h3><span class="identity-lifecycle">{text(d.lifecycle, 'Lifecycle not recorded')}</span></header>
    <p class="micro">A continuing identity across work and model changes. Current revision {persona.revision}.</p>
    <div class="identity-id"><code>{persona.id}</code><button class="text-button" onClick={async () => {
      try { await navigator.clipboard.writeText(persona.id); setCopied(true); setCopyError(''); }
      catch { setCopied(false); setCopyError('Clipboard unavailable. Select and copy the identity above.'); }
    }}>{copied ? 'ID copied' : 'Copy ID'}</button></div>
    {copyError && <p role="status" class="micro">{copyError}</p>}
    <CharacterInitialization persona={persona} act={act}/>
    <h4>Current character</h4><CurrentSelf key={persona.id} persona={persona} open={open}/>
    {!text(d.name) && <p class="notice">No display name has been chosen. The short ID identifies this persona until it chooses one.</p>}
    <dl class="identity-milestones">{[['Created', milestones.created || persona.created], ['Oriented', milestones.oriented], ['Joined work', milestones.joined], ['Accepted responsibility', milestones.committed]].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{typeof value === 'string' && value ? <time dateTime={value}>{timestamp(value)}</time> : 'Not recorded'}</dd></div>)}</dl>
    <p class="micro">Creation, membership and accepted responsibility are separate milestones.</p>
    <details><summary>Creation provenance</summary><p>Sponsor: {isRecordID(sponsor) ? <button class="text-button" onClick={() => open(sponsor)}>{sponsor.slice(0, 8)}</button> : sponsor || 'Not recorded'}</p>
      {isRecordID(d.resource_root) && <button class="text-button" onClick={() => open(d.resource_root)}>View controlling allowance</button>}
      {text(creation.operation) && <p class="micro">Creation operation <code>{text(creation.operation)}</code></p>}
    </details>
    <Traits value={d}/>
    <p>{d.self_authorship === false ? 'Character and affect are controlled by you. Learning and interests remain available.' : 'This persona may shape its character and affect through attributed changes.'}</p>
    <p class="micro">Initial approach: {fields(d.profile_orientation).disposition === 'adopted' ? 'Recorded' : fields(d.profile_orientation).disposition === 'deferred' ? 'Explicitly deferred' : 'Not recorded yet'}</p>
    <Story value={fields(d.profile_orientation).approach}/>
    <button class="secondary" disabled={['pending', 'running', 'recovering'].includes(text(fields(d.character_initialization).status))} aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? 'Close profile editor' : 'Edit character and authorship'}</button>
    {editing && <Suspense fallback={<p>Loading editor…</p>}><ProfileEditor persona={persona} act={act} close={() => setEditing(false)}/></Suspense>}
    <button class="text-button" aria-expanded={starting} onClick={() => setStarting(!starting)}>{starting ? 'Hide starting profile' : 'Show starting profile'}</button>
    {starting && <section class="development-card"><h4>Starting profile</h4>{d.starting_profile ? <><Story value={fields(d.starting_profile).character}/><Traits value={fields(d.starting_profile)}/><p class="micro">Preserved initial values. Missing numeric entries were randomly initialized; this is not personal experience.</p><details><summary>Initialization provenance</summary><p>Generator: {text(fields(fields(d.starting_profile).initialization).algorithm, 'Not recorded')}</p><p>Reproducibility seed: <code>{text(fields(fields(d.starting_profile).initialization).random_seed, 'Not recorded')}</code></p></details></> : <p>No starting profile was recorded for this identity.</p>}</section>}
    {Object.keys(fields(d.attributes)).length > 0 && <details><summary>Authored interests and attributes</summary><Story title="Interests" value={fields(d.attributes).interests}/><Story title="Values" value={fields(d.attributes).values}/><Story title="Strengths" value={fields(d.attributes).strengths}/><Story title="Working preferences" value={fields(d.attributes).preferences}/><Story value={fields(d.attributes).description}/></details>}
    {text(d.reason) && <p class="micro">Last preserved profile explanation: {d.reason}</p>}
    <RelatedItems title="Supporting observations" value={d.evidence} open={open}/>
    <button class="identity-history-toggle" aria-expanded={history} onClick={() => setHistory(!history)}>{history ? 'Hide persona evolution' : 'Show persona evolution'}</button>
    {history && <Suspense fallback={<p>Loading evolution history…</p>}><IdentityHistory key={persona.id} persona={persona} open={open}/></Suspense>}
    <button class="identity-history-toggle" aria-expanded={development} onClick={() => setDevelopment(!development)}>{development ? 'Hide experience and exploration' : 'Show experience and exploration'}</button>
    {development && <Suspense fallback={<p>Loading development…</p>}><Development persona={persona} open={open} act={act}/></Suspense>}
    <details><summary>Inference configuration</summary><p>{text(d.provider, 'Not recorded')} / {text(d.model, 'Not recorded')}</p>{text(d.effort) && <p>Effort: {d.effort}</p>}</details>
  </section>;
}
