import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { fields, isRecordID, recordIDs, text } from './workspace';
import { Status } from './main';

export default function Identity({ persona, open }: { persona: Entity; open: (id: string) => void }) {
  const d = data(persona), creation = fields(d.creation), milestones = fields(d.milestones), sponsor = text(creation.sponsor);
  const [copied, setCopied] = useState(false);
  const traits = (name: string, value: unknown, min: number, max: number) => {
    const entries = Object.entries(fields(value)).filter(([, v]) => typeof v === 'number' && Number.isFinite(v));
    return entries.length ? <div><h4>{name} <small>{min} to {max}</small></h4><dl class="identity-traits">{entries.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></div> : null;
  };
  return <section class="identity-profile" aria-label="Persona identity">
    <header><h3>Identity</h3><Status value={text(d.lifecycle, 'Lifecycle not recorded')}/></header>
    <p class="micro">A continuing identity across work and model changes.</p>
    <div class="identity-id"><code>{persona.id}</code><button class="text-button" onClick={async () => { try { await navigator.clipboard.writeText(persona.id); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'ID copied' : 'Copy ID'}</button></div>
    <h4>Self-authored character</h4><p class="record-prose">{text(d.character) || 'No character has been authored yet.'}</p>
    {!text(d.name) && <p class="notice">No display name has been chosen. The short ID identifies this persona until it chooses one during funded orientation or responds to an introduction request.</p>}
    <dl class="identity-milestones">{[['Created', milestones.created || persona.created], ['Oriented', milestones.oriented], ['Joined work', milestones.joined], ['Accepted responsibility', milestones.committed]].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{typeof value === 'string' ? <time dateTime={value}>{new Date(value).toLocaleString()}</time> : 'Not recorded'}</dd></div>)}</dl>
    <p class="micro">Creation, membership and accepted responsibility are separate milestones.</p>
    <details><summary>Creation provenance</summary><p>Sponsor: {isRecordID(sponsor) ? <button class="text-button" onClick={() => open(sponsor)}>{sponsor.slice(0, 8)}</button> : sponsor || 'Not recorded'}</p>
      {isRecordID(d.resource_root) && <button class="text-button" onClick={() => open(d.resource_root)}>View controlling allowance</button>}
      {text(creation.operation) && <p class="micro">Creation operation <code>{text(creation.operation)}</code></p>}
    </details>
    {(d.ocean || d.vad || Object.keys(fields(d.attributes)).length > 0) && <details><summary>Authored traits and interests</summary>
      {traits('OCEAN dispositions', d.ocean, 0, 1)}{traits('VAD affect', d.vad, -1, 1)}
      {Object.keys(fields(d.attributes)).length > 0 && <pre>{JSON.stringify(d.attributes, null, 2)}</pre>}
      <p class="micro">Optional self-description. Traits do not establish expertise, authority or assigned roles.</p>
    </details>}
    {text(d.reason) && <p class="micro">Latest authored explanation: {d.reason}</p>}
    {recordIDs(d.evidence).map(id => <button class="text-button" key={id} onClick={() => open(id)}>Supporting record {id.slice(0, 8)}</button>)}
    <details><summary>Inference configuration</summary><p>{text(d.provider, 'Not recorded')} / {text(d.model, 'Not recorded')}</p>{text(d.effort) && <p>Effort: {d.effort}</p>}</details>
  </section>;
}
