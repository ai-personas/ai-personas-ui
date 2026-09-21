import { useMemo, useState } from 'preact/hooks';
import { type Action, type Entity, type Page } from './api';
import { useResource } from './hooks';
import {
  TRAITS, displayValue, profileChanges, revisionAttribution,
  timestamp, traitNumber, traitPosition, traitSegments, validateRevisionPage,
} from './identity';

function AuthoringReceipt({ operation, persona }: { operation: string; persona: string }) {
  const { value, error, loading, retry } = useResource<Action>('/actions/' + encodeURIComponent(operation), e => e.entity === operation);
  if (error) return <p role="alert">Authoring receipt unavailable: {error} <button onClick={retry}>Retry receipt</button></p>;
  if (!value) return <p role="status">Loading authoring receipt…</p>;
  if (value.request.id !== operation || value.request.actor !== persona || value.request.kind !== 'persona.update') {
    return <p role="alert">The saved attribution does not match this authoring receipt.</p>;
  }
  return <div class="identity-receipt" aria-busy={loading}>
    <p>Action <code>{operation}</code> · {value.state}</p>
    <p>Actor <code>{value.request.actor}</code></p>
    <p>{value.request.source === 'api' ? 'Operator-submitted operation; not an autonomous model decision.' : <>Originating call <code>{value.request.source || 'Not recorded'}</code></>}</p>
    <p>Recorded {timestamp(value.finished || value.created)}</p>
    {value.error && <p role="alert">{value.error}</p>}
  </div>;
}

function RevisionCard({ record, before, open }: { record: Entity; before?: Entity; open: (id: string) => void }) {
  const [receipt, setReceipt] = useState(false);
  const changes = profileChanges(before, record), attribution = revisionAttribution(record);
  const gap = before && before.revision + 1 !== record.revision;
  return <article class="identity-revision" aria-label={`Identity revision ${record.revision}`}>
    <header><h5>Revision {record.revision}{!before && record.revision === 1 ? ' · Creation snapshot' : ''}</h5>
      <time dateTime={record.updated}>{timestamp(record.updated)}</time></header>
    {!before && record.revision !== 1 && <p class="notice">Earlier revisions are not loaded. These are recorded values, not inferred changes from an empty identity.</p>}
    {gap && <p class="notice">Compared with retained revision {before.revision}. Intervening revisions are unavailable; no intermediate values are inferred.</p>}
    {changes.length ? <dl class="identity-changes">{changes.map(change => <div key={change.field}>
      <dt>{change.label}</dt><dd>{before && <><span class="change-before">{displayValue(change.before)}</span><span class="change-arrow" aria-label="changed to"> → </span></>}
        <span class="change-after">{displayValue(change.after)}</span></dd>
    </div>)}</dl> : <p>No descriptor or identity-field change in this revision.</p>}
    {attribution.recorded ? <>
      <p class="micro">Attributed to this persona · {attribution.source === 'api' ? 'operator-submitted operation' : attribution.source ? 'recorded decision' : 'origin not recorded'}</p>
      <p class="record-prose">{attribution.reason || 'No authored explanation on this revision.'}</p>
      {attribution.run && <button class="text-button" onClick={() => open(attribution.run!)}>Open originating participation</button>}
      <button class="text-button" aria-expanded={receipt} onClick={() => setReceipt(!receipt)}>{receipt ? 'Hide authoring receipt' : 'Inspect authoring receipt'}</button>
      {receipt && <AuthoringReceipt operation={attribution.operation!} persona={record.id}/>}
      {attribution.evidence.map(ref => <p key={ref.id} class="micro">Supporting record <code>{ref.id.slice(0, 8)}</code>, recorded revision {ref.revision}. <button class="text-button" onClick={() => open(ref.id)}>Read details and version history</button></p>)}
    </> : <>
      <p class="micro">Per-revision authorship was not recorded here. Do not infer it from the current persona or a later revision.</p>
    </>}
  </article>;
}

function TraitHistory({ records }: { records: Entity[] }) {
  if (!records.length) return null;
  const x = (index: number) => records.length === 1 ? 120 : 8 + index * 224 / (records.length - 1);
  const y = (value: number, trait: typeof TRAITS[number]) => 40 - traitPosition(value, trait) * .32;
  return <section class="identity-history-chart" aria-label="Recorded OCEAN and VAD history">
    <h4>Descriptor history</h4>
    <p class="micro">Retained snapshots in revision order, not continuous measurements. Missing values and missing revisions break the line. Numeric scales are unchanged.</p>
    {TRAITS.map(trait => {
      const segments = traitSegments(records, trait), count = segments.reduce((total, segment) => total + segment.length, 0);
      return <div class="trait-history-row" key={trait.key}>
        <div><strong>{trait.label}</strong><small>{trait.min} to {trait.max}</small></div>
        {count ? <svg viewBox="0 0 240 48" role="img" aria-label={`${trait.label}: ${count} recorded values across revisions ${records[0].revision} to ${records.at(-1)!.revision}`}>
          <line class="trait-axis" x1="8" y1="40" x2="232" y2="40"/>
          {segments.map((segment, index) => <g key={index}>
            <polyline class={`trait-trace trait-${trait.group}`} points={segment.map(point => `${x(point.index)},${y(point.value, trait)}`).join(' ')}/>
            {segment.map(point => <circle class={`trait-point trait-${trait.group}`} key={point.record.revision} cx={x(point.index)} cy={y(point.value, trait)} r="3">
              <title>{`${trait.label}: ${traitNumber(point.value)} · revision ${point.record.revision} · ${timestamp(point.record.updated)}`}</title>
            </circle>)}
          </g>)}
        </svg> : <span class="descriptor-missing">No authored values on this page</span>}
      </div>;
    })}
    <p class="micro">Revision {records[0].revision} ({timestamp(records[0].updated)}) → revision {records.at(-1)!.revision} ({timestamp(records.at(-1)!.updated)}). Exact changed values are listed below.</p>
  </section>;
}

export default function IdentityHistory({ persona, open }: { persona: Entity; open: (id: string) => void }) {
  const [cursors, setCursors] = useState([0]);
  const after = cursors.at(-1)!;
  const { value, error, loading, retry } = useResource<Page<Entity>>(
    '/records/' + encodeURIComponent(persona.id) + '/revisions?after=' + after + '&limit=20',
    event => event.entity === persona.id || ['information.withdraw', 'information.erase'].includes(event.kind),
  );
  const parsed = useMemo(() => {
    if (value === undefined) return { items: [] as Entity[], next: null as number | null, failure: '' };
    try { return { ...validateRevisionPage(value, persona.id, after), failure: '' }; }
    catch (e) { return { items: [] as Entity[], next: null, failure: (e as Error).message }; }
  }, [value, persona.id, after]);
  const { items, next, failure } = parsed;
  const visible = items.map((record, index) => ({ record, before: items[index - 1] }))
    .filter(({ record, before }) => !before || profileChanges(before, record).length > 0 || revisionAttribution(record).recorded);
  return <section class="identity-evolution" aria-label="Persona evolution" aria-busy={loading}>
    <h4>Persona evolution</h4>
    <p class="micro">Preserved identity snapshots, oldest first. Reading this history never starts inference or changes the persona.</p>
    {(error || failure) && <p role="alert">History unavailable: {error || failure} <button onClick={retry}>Retry history</button></p>}
    {loading && <p role="status">Loading preserved identity revisions…</p>}
    {!loading && !error && !failure && !items.length && <p>No retained identity revisions are available. Earlier state is not reconstructed.</p>}
    {items.length > 0 && <>
      <TraitHistory records={items}/>
      <p class="micro">Showing {visible.length} identity snapshots or changes among {items.length} retained revisions on this page. Other revisions may concern private context and are not displayed here.</p>
      {items.at(-1)!.revision < persona.revision && <p class="notice">Current identity is revision {persona.revision}; this page ends at revision {items.at(-1)!.revision}. {next !== null ? 'Continue through the retained pages for later changes.' : 'Later history is not available in this response; refresh to check.'}</p>}
      {visible.map(({ record, before }) => <RevisionCard key={record.revision} record={record} before={before} open={open}/>)}
    </>}
    <nav class="identity-history-pagination" aria-label="Identity history pages">
      <button disabled={loading || cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Previous revisions</button>
      <button disabled={loading || next === null || !!failure || !!error} onClick={() => { if (next !== null) setCursors([...cursors, next]); }}>Next revisions</button>
      <button class="text-button" disabled={loading} onClick={retry}>Refresh history</button>
    </nav>
  </section>;
}
