import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { useResource } from './hooks';
import { fields, isRecordID, strings, text, workFacts, stateTone, assumptionNote } from './workspace';
import { timestamp } from './identity';
import { humanLabel, recordTitle, fileSize, fileFormat } from './reading';
import RichText from './RichText';
import InferenceEvidence from './InferenceEvidence';
import { learningKind } from './inference-evidence';

type Open = (id: string) => void;
export function RecordReference({ id, open, fallback = 'Related item' }: { id: string; open: Open; fallback?: string }) {
  const { value, error } = useResource<Entity>('/records/' + id, e => e.entity === id);
  return <button class="text-button reader-reference" onClick={() => open(id)}>
    {value ? recordTitle(value) : error ? `${fallback} unavailable` : `Loading ${fallback.toLowerCase()}…`}
    <span aria-hidden="true"> ↗</span>
  </button>;
}

/** Authored prose only. Runtime objects never become a field-by-field UI. */
export function Story({ title, value }: { title?: string; value: unknown }) {
  const lines = typeof value === 'string' ? [value] : strings(value);
  const prose = lines.filter(line => line.trim() && !isRecordID(line));
  if (!prose.length) return null;
  return <section class="reader-section">{title && <h3>{title}</h3>}
    {Array.isArray(value) ? <ul class="reader-story-list">{prose.map((line, i) => <li key={i}><RichText text={line}/></li>)}</ul> : <RichText text={prose[0]}/>}
  </section>;
}

function Person({ id, open, user = false }: { id: unknown; open: Open; user?: boolean }) {
  return isRecordID(id) ? <RecordReference id={id} open={open} fallback="Persona"/> : user && (id === '' || id === 'user') ? <span>You</span> : null;
}

export function RelatedItems({ title, value, open }: { title: string; value: unknown; open: Open }) {
  const [expanded, setExpanded] = useState(false);
  const items = Array.isArray(value) ? value : [value];
  const refs = items.map(item => typeof item === 'string' ? { id: item } : fields(item)).filter(item => isRecordID(item.id));
  if (!refs.length) return null;
  return <section class="reader-section reader-related"><h3>{title}</h3><ul>
    {(expanded ? refs : refs.slice(0, 8)).map((item, i) => <li key={i}><RecordReference id={text(item.id)} open={open}/>{typeof item.revision === 'number' && <small>Referenced version {item.revision}</small>}</li>)}
  </ul>{!expanded && refs.length > 8 && <button class="text-button" onClick={() => setExpanded(true)}>Show {refs.length - 8} more</button>}</section>;
}

function ReadingStats({ items }: { items: [string, ComponentChildren][] }) {
  return <div class="reader-stats">{items.map(([label, value]) => <section key={label}><h3>{label}</h3><p>{value}</p></section>)}</div>;
}

export function FeedbackConditions({ value, open, historical = false }: { value: unknown; open: Open; historical?: boolean }) {
  const d = fields(value), stale = Array.isArray(d.stale_resolutions) ? d.stale_resolutions : [], deferred = Array.isArray(d.deferred_feedback) ? d.deferred_feedback : [];
  const assumptions = Array.isArray(d.stale_assumptions) ? d.stale_assumptions : [];
  const gaps = Array.isArray(d.handoff_gaps) ? d.handoff_gaps.map(fields) : [];
  if (!stale.length && !deferred.length && !assumptions.length && !gaps.length) return null;
  return <aside class="completion-conditions" aria-label="Delivery conditions">
    {!!assumptions.length && <><h3>Assumptions need new evidence</h3><p>The observations used to confirm these assumptions changed or became unavailable. Their earlier confirmation no longer supports the current result.</p><RelatedItems title="Assumptions to reconsider" value={assumptions} open={open}/></>}
    {!!gaps.length && <><h3>{historical ? 'Handoffs outstanding at release' : 'Responsibilities need a handoff'}</h3><p>{historical ? 'These responsibilities still needed an accepted successor or an authorized cancellation when this result was released.' : 'A previous owner is unavailable. This needs an accepted successor or an authorized cancellation. Naming someone alone does not transfer ownership.'}</p><RelatedItems title="Responsibilities needing attention" value={gaps.map(gap => gap.commitment)} open={open}/></>}
    {!!stale.length && <><h3>Earlier resolutions need another check</h3><p>Their supporting evidence changed or is no longer available. These findings block delivery again until they are revalidated.</p><RelatedItems title="Feedback to recheck" value={stale} open={open}/></>}
    {!!deferred.length && <><h3>{historical ? 'Conditions recorded with this release' : 'Delivery still has conditions'}</h3><p>Deferred or waived blocking findings remain conditions on the result. They are not resolved findings or unconditional acceptance.</p><RelatedItems title="Deferred or waived findings" value={deferred} open={open}/></>}
  </aside>;
}

function ScopeStory({ value }: { value: unknown }) {
  const m = fields(value), outcomes = Array.isArray(m.outcomes) ? m.outcomes.map(fields) : [];
  return <>
    <Story title="Clarifications" value={m.clarifications}/>
    {!!outcomes.length && <section class="reader-section"><h3>What the work should deliver</h3><ul class="reader-outcomes">{outcomes.map((o, i) => <li key={i}>
      <strong>{text(o.description, 'Requested outcome')}</strong>
      <Story title="How it will be judged" value={o.criterion}/>
      <p class="reader-muted">{o.required === false ? 'Optional' : 'Required'}{o.evidence === 'reviewed' ? ' · Independent review requested' : o.evidence === 'user_judgment' ? ' · Your judgment is needed' : ''}{o.outside_validation_required === true ? ' · External validation required' : ''}</p>
    </li>)}</ul></section>}
    <Story title="Constraints" value={m.constraints}/><Story title="Preferences" value={m.preferences}/>
    <Story title="Still to clarify" value={m.unresolved_inputs}/><Story title="When this work is complete" value={m.completion_agreement}/>
  </>;
}

/** Deliberately selected presentations: adding backend fields cannot accidentally
 * expose transport metadata or turn the reader into a JSON inspector. */
function Content({ record, open, historical }: { record: Entity; open: Open; historical: boolean }) {
  const d = data(record), draft = fields(d.draft);
  switch (record.kind) {
    case 'environment_tool': return <><Story value={d.description}/><p>{d.enabled ? 'Enabled for accepted participants in this environment.' : 'Removed from this environment.'}</p><Story title="Observed availability" value={d.availability_basis}/><p class="reader-muted">Shared access does not share private memory or credentials. Availability is separate from correctness or demonstrated experience.</p></>;
    case 'document': return <>
      <p class="record-caveat">{learningKind(record.kind)}. Saving or submitting a document does not establish lesson retention or later use.</p>
      {text(d.content) ? <RichText text={d.content} title={historical ? undefined : recordTitle(record)}/> : <p class="reader-muted">This document has no available text.</p>}
    </>;
    case 'artifact': return <><p class="reader-file-info">{fileFormat(d.media_type, d.name)} · {fileSize(d.size)}</p><Story value={d.description}/></>;
    case 'work': {
      const f = workFacts(record);
      return <><Story title="Your request" value={d.brief}/>
        <ReadingStats items={[["Activity", f.activity], ["Submitted work", f.submissions === undefined ? 'Not reported' : `${f.submissions} submitted versions`], ["Evidence for the requested results", f.coverage], ["Acceptance", f.acceptance]]}/>
        <FeedbackConditions value={d.core} open={open}/>
        <div class="reader-context-links">{isRecordID(d.environment) && <span>In <RecordReference id={d.environment} open={open}/></span>}
          {isRecordID(fields(d.mandate).id) && <button class="text-button" onClick={() => open(text(fields(d.mandate).id))}>Read the agreed scope ↗</button>}
          {isRecordID(d.resource_root) && <button class="text-button" onClick={() => open(d.resource_root)}>View funding ↗</button>}
        </div></>;
    }
    case 'environment': return <Story value={d.description}/>;
    case 'persona': return <Story title="About this persona" value={d.character}/>;
    case 'run': return <><p class="reader-byline">Activity for <Person id={d.persona} open={open}/></p><Story title="Instructions for this work" value={d.instructions}/></>;
    case 'call': return <><Story title="Decision summary" value={d.summary}/><Story title="Recorded failure" value={d.error}/><InferenceEvidence value={d} open={open}/></>;
    case 'message': return <><p class="reader-byline"><Person id={d.from} open={open} user/><span>to</span><Person id={d.to} open={open} user/></p><Story value={d.text}/></>;
    case 'request': return <>
      {d.status === 'answered' && <p class="notice">Replies were recorded, but this question is not resolved at this version. The owner still needs to assess the answers and explain any remaining need. Acknowledgement alone is not resolution.</p>}
      <Story title="What is needed" value={d.purpose}/><Story title="How to help" value={d.instructions}/><Story title="Information to include" value={d.evidence_required}/>
      <Story title="Conclusion" value={fields(d.resolution).conclusion}/>
    </>;
    case 'response': return <><p class="reader-byline">Answer from <Person id={d.from} open={open} user/></p><Story title="Answer" value={d.text}/><p class="record-caveat">An attributed reply is not automatic confirmation, permission or question resolution.</p></>;
    case 'submission': return <Story title="What was submitted" value={d.summary}/>;
    case 'work_mandate': return <><Story title="Original request" value={d.original_need}/><ScopeStory value={d.mandate}/></>;
    case 'commitment': return <>
      <Story title="Responsibility" value={draft.description || d.description || d.outcome}/><Story title="What success looks like" value={draft.criterion || d.criterion}/>
      {isRecordID(d.owner || draft.offered_to || d.offered_to) && <p class="reader-byline">{['accepted', 'working', 'submitted', 'closed', 'blocked'].includes(d.status) ? 'Owned by' : 'Offered to'} <Person id={d.owner || draft.offered_to || d.offered_to} open={open}/></p>}
      <Story title="Latest update" value={d.note}/><Story title="Why this was accepted" value={fields(d.consent).reason}/>
      <RelatedItems title="Supporting work" value={d.evidence} open={open}/>
      {Array.isArray(draft.dependencies) && draft.dependencies.length > 0 && <RelatedItems title="Depends on" value={draft.dependencies.map(dep => fields(dep).commitment)} open={open}/>}
    </>;
    case 'work_entry': return <>
      <Story value={draft.text || d.text}/><Story title="Expected result" value={draft.expected_result}/><Story title="Alternatives" value={draft.alternatives}/>
      <Story title="Possible drawbacks" value={draft.possible_regressions}/><Story title="How to check" value={draft.check}/><Story title="Reconsider when" value={draft.reconsider_if}/>
      <RelatedItems title="Sources" value={draft.sources} open={open}/>
    </>;
    case 'perspective': return <>
      {draft.kind === 'relationship' && isRecordID(draft.subject) && <p class="reader-byline">About working with <RecordReference id={draft.subject} open={open}/></p>}
      <Story value={draft.content}/><Story title="Limitations" value={draft.limitations}/><RelatedItems title="Sources" value={draft.sources} open={open}/>
    </>;
    case 'fragment': return <>
      <p class="record-caveat">A lesson fragment is an authored interpretation. Its presence does not prove correctness, active selection, later application or improvement.</p>
      <Story value={d.content || draft.content}/><Story title="When this is useful" value={d.applicability || draft.applicability}/><Story title="Limitations" value={d.limitations || draft.limitations}/>
      <RelatedItems title="Sources" value={d.sources || draft.sources} open={open}/><RelatedItems title="Contrary evidence" value={d.counterevidence || draft.counterevidence} open={open}/>
    </>;
    case 'assumption': return <><Story value={d.summary || d.text || d.description}/><p class="notice">{assumptionNote(text(d.status))}</p><Story title="Reconsider when" value={d.reconsider_if}/></>;
    case 'working_agreement': case 'agreement': return <><Story title="Agreement" value={d.terms || d.text}/><Story title="Concerns and exceptions" value={d.dissent || d.limitations}/><RelatedItems title="Endorsements" value={d.endorsements} open={open}/></>;
    case 'finding': case 'assessment': return <><Story title="Review" value={d.summary || d.content}/><Story title="Findings" value={d.findings}/><Story title="Limitations" value={d.limitations}/></>;
    case 'invitation': case 'membership': return <><p class="reader-byline">For <Person id={d.to || d.persona} open={open}/></p><Story value={d.preview || d.reason || d.note}/>{typeof d.orientation_calls_remaining === 'number' && <p>{d.orientation_calls_remaining} orientation attempts remaining. Joining and accepting responsibility are separate decisions.</p>}</>;
    case 'work_feedback': case 'feedback': return <><Story title="Feedback" value={d.message || d.text || draft.text || d.summary}/><Story title="Response" value={d.response || d.reason}/><RelatedItems title="Changes made" value={d.repair_refs} open={open}/></>;
    case 'work_release': case 'release': return <><Story title="Released work" value={d.summary}/><Story title="Limitations" value={d.limitations || draft.limitations}/><FeedbackConditions value={d} open={open} historical/><RelatedItems title="Submitted work" value={d.submission} open={open}/></>;
    case 'resource_root': return <Story title="Purpose" value={d.reason}/>;
    default: return <>
      <Story value={d.description || d.summary || d.content || d.text || draft.text}/>
      <Story title="Instructions" value={d.instructions}/><Story title="Expected outcome" value={d.outcome}/><Story title="Reason" value={d.reason}/><Story title="Limitations" value={d.limitations}/>
    </>;
  }
}

export default function RecordReader({ record, open, historical = false }: { record: Entity; open: Open; historical?: boolean }) {
  const d = data(record);
  const author = ['document', 'fragment', 'perspective', 'submission', 'work_entry', 'finding', 'assessment'].includes(record.kind) ? d.author || d.owner : record.kind === 'request' ? d.owner : undefined;
  return <article class="record-reader" aria-label={`${humanLabel(record.kind)} content`}>
    <div class="reader-meta">
      {isRecordID(author) && <span class="reader-byline">{record.kind === 'request' ? 'Asked by' : 'By'} <Person id={author} open={open}/></span>}
      <span>{historical ? 'Saved' : 'Updated'} <time dateTime={record.updated}>{timestamp(record.updated)}</time></span>
      {text(d.status) && !['run', 'call'].includes(record.kind) && !(record.kind === 'request' && d.status === 'open') && <span class={'state-badge tone-' + stateTone(d.status)}>{humanLabel(d.status)}</span>}
    </div>
    <Content record={record} open={open} historical={historical}/>
    {['document', 'fragment'].includes(record.kind) && isRecordID(d.environment) && <div class="reader-context-links">Shared in <RecordReference id={d.environment} open={open}/></div>}
  </article>;
}
