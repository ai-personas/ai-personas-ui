import { useEffect, useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { fields, isRecordID, recordIDs, text } from './workspace';
import { timestamp } from './identity';
import Traits from './Traits';
import IdentityHistory from './IdentityHistory';
import { Story } from './RecordReader';
import './identity.css';

export default function Identity({ persona, open }: { persona: Entity; open: (id: string) => void }) {
  const d = data(persona), creation = fields(d.creation), milestones = fields(d.milestones), sponsor = text(creation.sponsor);
  const [copied, setCopied] = useState(false), [history, setHistory] = useState(false), [copyError, setCopyError] = useState('');
  useEffect(() => { setCopied(false); setCopyError(''); setHistory(false); }, [persona.id]);
  return <section class="identity-profile" aria-label="Persona identity">
    <header><h3>Identity</h3><span class="identity-lifecycle">{text(d.lifecycle, 'Lifecycle not recorded')}</span></header>
    <p class="micro">A continuing identity across work and model changes. Current revision {persona.revision}.</p>
    <div class="identity-id"><code>{persona.id}</code><button class="text-button" onClick={async () => {
      try { await navigator.clipboard.writeText(persona.id); setCopied(true); setCopyError(''); }
      catch { setCopied(false); setCopyError('Clipboard unavailable. Select and copy the identity above.'); }
    }}>{copied ? 'ID copied' : 'Copy ID'}</button></div>
    {copyError && <p role="status" class="micro">{copyError}</p>}
    <h4>Self-authored character</h4><p class="record-prose">{text(d.character) || 'No character has been authored yet.'}</p>
    {!text(d.name) && <p class="notice">No display name has been chosen. The short ID identifies this persona until it chooses one during funded orientation or responds to an introduction request.</p>}
    <dl class="identity-milestones">{[['Created', milestones.created || persona.created], ['Oriented', milestones.oriented], ['Joined work', milestones.joined], ['Accepted responsibility', milestones.committed]].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{typeof value === 'string' && value ? <time dateTime={value}>{timestamp(value)}</time> : 'Not recorded'}</dd></div>)}</dl>
    <p class="micro">Creation, membership and accepted responsibility are separate milestones.</p>
    <details><summary>Creation provenance</summary><p>Sponsor: {isRecordID(sponsor) ? <button class="text-button" onClick={() => open(sponsor)}>{sponsor.slice(0, 8)}</button> : sponsor || 'Not recorded'}</p>
      {isRecordID(d.resource_root) && <button class="text-button" onClick={() => open(d.resource_root)}>View controlling allowance</button>}
      {text(creation.operation) && <p class="micro">Creation operation <code>{text(creation.operation)}</code></p>}
    </details>
    <Traits value={d}/>
    <p class="micro">Use an introduction request or a message to ask this persona to describe or reconsider its character, OCEAN and VAD. Authorship remains optional and uses existing funded participation; opening this view does not create work.</p>
    {Object.keys(fields(d.attributes)).length > 0 && <details><summary>Authored interests and attributes</summary><Story title="Interests" value={fields(d.attributes).interests}/><Story title="Values" value={fields(d.attributes).values}/><Story title="Strengths" value={fields(d.attributes).strengths}/><Story title="Working preferences" value={fields(d.attributes).preferences}/><Story value={fields(d.attributes).description}/></details>}
    {text(d.reason) && <p class="micro">Last preserved profile explanation: {d.reason}</p>}
    {recordIDs(d.evidence).map(id => <button class="text-button" key={id} onClick={() => open(id)}>Supporting record {id.slice(0, 8)}</button>)}
    <button class="identity-history-toggle" aria-expanded={history} onClick={() => setHistory(!history)}>{history ? 'Hide persona evolution' : 'Show persona evolution'}</button>
    {history && <IdentityHistory key={persona.id} persona={persona} open={open}/>}
    <details><summary>Inference configuration</summary><p>{text(d.provider, 'Not recorded')} / {text(d.model, 'Not recorded')}</p>{text(d.effort) && <p>Effort: {d.effort}</p>}</details>
  </section>;
}
