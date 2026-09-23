import { WorkControls, AllowanceSummary, CurrentMandate, WorkState } from './Operator';
import type { Act } from './main';
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { data, label, type Entity } from './api';
import { useRecords, useResource } from './hooks';
import { WORK_TABS, type WorkTab, fields, text, strings, recordIDs, isRecordID,
  workFacts, assessmentFacts, ownership, stateTone, assumptionNote, matchesWork } from './workspace';
import { RunProgress } from './RunProgress';
import WorkConversation from './WorkConversation';
import Participants from './Participants';
import Perspectives from './Perspectives';
import { InputNotice } from './Attention';
import { inputRequestCount } from './workspace';
import WorkArtifacts, { ContentReferences } from './ContentCards';
import { humanLabel, recordTitle } from './reading';
import { RecordReference } from './RecordReader';
import RichText from './RichText';
import './workspace.css';

type Open = (id: string) => void;
type Links = { open: Open; artifact: Open };

export function Badge({ value }: { value: string }) {
  return <span class={`state-badge tone-${stateTone(value)}`}>{value.replaceAll('_', ' ') || 'Not recorded'}</span>;
}
function Empty({ title, children }: { title: string; children: ComponentChildren }) {
  return <div class="workspace-empty"><strong>{title}</strong><p>{children}</p></div>;
}
function Reference({ id, caption, open }: { id: unknown; caption: string; open: Open }) {
  return isRecordID(id) ? <span class="work-reference"><span>{caption}</span> <RecordReference id={id} open={open}/></span> : null;
}
function TextValue({ value }: { value: unknown }) {
  const lines = typeof value === 'string' ? [value] : strings(value);
  return <>{lines.filter(Boolean).map((line, i) => <RichText key={i} text={line}/>)}</>;
}
function NamedField({ name, value }: { name: string; value: unknown }) {
  if (!text(value) && !strings(value).length) return null;
  return <div class="record-field"><span class="field-label">{name}</span><TextValue value={value}/></div>;
}
function ActivityPersona({ id, open }: { id: string; open: Open }) {
  const { value } = useResource<Entity>('/records/' + id, e => e.entity === id);
  return <button class="reference-link activity-persona" onClick={() => open(id)}>{value ? text(data(value).name) || 'Unnamed persona' : 'Persona'} <code>{id.slice(0, 8)}</code> <span aria-hidden="true">↗</span></button>;
}
function RecordCard({ record, open, artifact, act }: { record: Entity; act: Act } & Links) {
  // Work-list projections omit authored drafts. Load the visible card's content
  // rather than presenting an empty update or exposing projection metadata.
  const needsContent = ['work_entry', 'commitment'].includes(record.kind) && !Object.keys(fields(fields(record.data).draft)).length;
  const { value, error } = useResource<Entity>('/records/' + record.id, e => e.entity === record.id, needsContent);
  const r = needsContent && value ? value : record;
  const d = fields(r.data), draft = fields(d.draft), state = text(d.status) || text(d.disposition);
  const assessment = r.kind === 'finding' || r.kind === 'assessment';
  const isBirth = ['birth', 'birth_link', 'birth_proposal'].includes(r.kind);
  const isPerspective = r.kind === 'perspective';
  const author = d.author || d.owner || d.persona || d.from;
  const body = text(d.summary) || text(d.description) || text(d.agenda) || text(d.text) || text(d.content) || text(draft.text) || text(draft.description) || text(d.purpose) || text(d.note);
  return <article class={`work-record${inputRequestCount(r) ? ' needs-input' : ''}`} data-kind={r.kind}>
    <header><div>
      <h3><button class="record-title" onClick={() => open(r.id)}>{recordTitle(r)}</button></h3></div>
      {state && !assessment && <Badge value={state}/>}</header>
    <InputNotice record={r} open={open}/>
    {r.kind === 'run' && isRecordID(author) ? <ActivityPersona id={author} open={open}/> : r.kind !== 'commitment' && <Reference id={author} caption={isPerspective ? 'Perspective by' : 'By'} open={open}/>}
    {needsContent && !value && !error && <p class="micro" role="status">Loading the update…</p>}
    {needsContent && error && <p class="micro" role="alert">The written update could not be loaded. Open details to try again.</p>}
    {body && r.kind !== 'run' && <p class="record-prose record-excerpt">{body}</p>}
    {r.kind === 'run' && <RunProgress run={r} open={open} act={act}/>}
    {isPerspective && <><NamedField name="Proposed attention" value={d.priorities}/><NamedField name="Expected contribution" value={d.contribution}/><NamedField name="Concerns" value={d.concerns}/><p class="record-caveat">An individual perspective, not an assignment or a collective decision.</p></>}
    {r.kind === 'commitment' && <>
      <p class="ownership-label">{ownership(r).label}</p><Reference id={ownership(r).id} caption="Persona" open={open}/>
      <NamedField name="Expected outcome" value={d.outcome}/>
      <References ids={d.depends_on} caption="Prerequisite" open={open}/>
      <p class="record-caveat">An offer is not acceptance; submitted work is not necessarily closed or validated.</p>
    </>}
    {r.kind === 'outcome' && <><NamedField name="Criterion" value={d.criterion}/><References ids={d.commitments} caption="Commitment" open={open}/><p class="record-caveat">Adopted-outcome coverage is not proof that the original need has been fully covered.</p></>}
    {r.kind === 'assumption' && <><p class="notice">{assumptionNote(state)}</p><References ids={d.affected_claims} caption="Affected claim" open={open}/></>}
    {['agreement', 'working_agreement'].includes(r.kind) && <>
      <NamedField name="Terms" value={d.terms}/><NamedField name="Dissent / limitations" value={d.dissent}/>
      <References ids={d.endorsements} caption="Exact endorsement" open={open}/>
      <p class="record-caveat">Only explicit endorsements bind participants. An agreement cannot widen permissions.</p>
    </>}
    {isBirth && <>
      <NamedField name="Motivating need" value={d.reason}/><NamedField name="Offered contribution" value={d.proposed_contribution}/>
      <Reference id={d.parent} caption="Proposer" open={open}/><Reference id={d.newborn} caption="New identity" open={open}/>
      <NamedField name="Initialization" value={d.initialization_status}/><NamedField name="Invitation" value={d.membership_status}/>
      <References ids={d.contribution_refs} caption="Observed contribution" open={open}/>
      <p class="record-caveat">Birth is not membership, accepted responsibility, or demonstrated expertise.</p>
    </>}
    {r.kind === 'membership' && <><Reference id={d.persona} caption="Participant" open={open}/><p class="record-caveat">Membership and commitment acceptance are separate.</p></>}
    {assessment && <Assessment record={r} open={open}/>}
    {r.kind === 'submission' && <>
      <ContentReferences ids={[...recordIDs(d.documents), ...recordIDs(d.artifacts)]} open={open} artifact={artifact}/>
      <p class="record-caveat">This preserves a submitted version, not an acceptance of the current work.</p>
    </>}
    {r.kind === 'artifact' && <button class="secondary" onClick={() => artifact(r.id)}>Open file</button>}
    {r.kind === 'request' && <><NamedField name="Evidence required" value={d.evidence_required}/><p class="record-caveat">{d.audience === 'work' && 'You and other participants can answer this shared question. '}A response does not resolve the question until its owner records a disposition.</p></>}
    {['work_feedback', 'feedback'].includes(r.kind) && <><NamedField name="Disposition" value={d.disposition}/><References ids={d.repair_refs} caption="Repair evidence" open={open}/><p class="record-caveat">Acknowledgement is not disposition or verified repair.</p></>}
    {r.kind === 'iteration' && <><Reference id={d.baseline} caption="Exact baseline" open={open}/><NamedField name="Remaining allowance" value={d.allowance_summary}/><NamedField name="Stop condition" value={d.stop_condition}/><p class="record-caveat">Provisional inputs permit exploration, not unconditional final claims.</p></>}
    {r.kind === 'budget' && <><NamedField name="Allowance" value={d.allowance_summary}/><NamedField name="Protected closeout" value={d.closeout_summary}/><p class="record-caveat">Call, token, currency and population limits are separate. No balance is inferred from activity.</p></>}
    {['work_release', 'release'].includes(r.kind) && <><Reference id={d.submission} caption="Sealed submission" open={open}/><NamedField name="Seal / conflict" value={d.seal_status}/><p class="record-caveat">A release refers to an exact historical state, never automatically to the latest files.</p></>}
    {r.kind === 'fragment' && <><NamedField name="Applies when" value={d.applicability}/><NamedField name="Limitations / contrary evidence" value={d.limitations}/><References ids={d.sources} caption="Experience / source" open={open}/><p class="record-caveat">Retained learning is an authored interpretation; later usefulness needs evidence.</p></>}
    <button class="text-button" onClick={() => open(r.id)}>View details ↗</button>
  </article>;
}
function Assessment({ record, open }: { record: Entity; open: Open }) {
  const a = assessmentFacts(record);
  return <div class="assessment-facts"><div><span class="field-label">Historical verdict</span><Badge value={a.verdict}/></div>
    <div><span class="field-label">Reported applicability</span><Badge value={a.applicability}/></div>
    <Reference id={a.submission} caption="Exact submission" open={open}/><p class="record-caveat">{a.note}</p></div>;
}
function References({ ids, caption, open }: { ids: unknown; caption: string; open: Open }) {
  return <div class="record-references">{recordIDs(ids).slice(0, 12).map(id => <Reference key={id} id={id} caption={caption} open={open}/>)}
    {recordIDs(ids).length > 12 && <p class="micro">Open details to see all related items.</p>}</div>;
}
function RecordsSection({ title, description, kinds, work, empty, open, artifact, act }: {
  title: string; description?: string; kinds: string; work: string; empty: string; act: Act;
} & Links) {
  const [cursors, setCursors] = useState([0]);
  const { value: page, error, loading } = useRecords(kinds, work, '', '', cursors.at(-1)!);
  return <section class="workspace-section" aria-label={title} aria-busy={loading}>
    <header class="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{loading && <span class="field-label">Refreshing…</span>}</header>
    {error && <p role="alert">Could not load {title.toLowerCase()}: {error}. Previously shown records may be stale.</p>}
    {!page && !error && <p role="status">Loading records…</p>}
    {page && !error && page.items.length === 0 && <Empty title="Not recorded in this view">{empty}</Empty>}
    <div class="work-records">{page?.items.map(record => <RecordCard key={record.id} record={record} open={open} artifact={artifact} act={act}/>)}</div>
    {page && <div class="record-pagination"><small>{page.items.length} records on this page · not a completeness measure</small>
      <div><button class="secondary" disabled={cursors.length === 1 || loading} onClick={() => setCursors(cursors.slice(0, -1))}>Previous</button>
        <button class="secondary" disabled={page.next == null || loading} onClick={() => { if (page.next != null) setCursors([...cursors, page.next]); }}>Next</button></div></div>}
  </section>;
}
export default function Workspace({ id, open, artifact, back, act }: { id: string; back: () => void; act: Act } & Links) {
  const { value: work, error, loading } = useResource<Entity>('/records/' + id, e => matchesWork(e, id));
  const [tab, setTab] = useState<WorkTab>('Overview');
  const [submissionHistory, setSubmissionHistory] = useState(false);
  const tabs = useRef<HTMLDivElement>(null);
  if (error && !work) return <section><button class="text-button" onClick={back}>← All work</button><p role="alert">{error}</p></section>;
  if (!work) return <p role="status">Opening workspace…</p>;
  if (work.kind !== 'work') return <p role="alert">This record is not a work item.</p>;
  const summary = workFacts(work), d = fields(work.data);
  const section = (title: string, kinds: string, empty: string, description?: string) =>
    <RecordsSection key={tab + ':' + kinds + ':' + id} title={title} kinds={kinds} work={id} empty={empty} description={description} open={open} artifact={artifact} act={act}/>;
  return <div class="workspace">
    <div class="workspace-trail"><button class="text-button" onClick={back}>← All work</button><span>Workspace</span><button class="text-button" onClick={() => open(id)}>Work details & activity ↗</button></div>
    <header class="workspace-heading"><div><p class="eyebrow">ONE NEED. DIFFERENT PERSPECTIVES.</p><h1>{label(work)}</h1><p class="workspace-subtitle">Individual priorities. Negotiated commitments. Inspectable evidence.</p></div><span class="revision-tag">Work revision {work.revision}</span></header>
    {(loading || error) && <p class="notice" role={error ? 'alert' : 'status'}>{error ? `Refresh failed: ${error}. Displayed data may be stale.` : 'Refreshing work state. Displayed values are not a new confirmation.'}</p>}
    <WorkControls work={work} act={act} open={open}/>
    <InputNotice record={work} open={open}/>
    <div class="status-axes" aria-label="Independent work status">
      <div><span>Activity</span><strong>{summary.activity}</strong><small>Execution is not accomplishment</small></div>
      <div><span>Versions</span><strong>{summary.submissions === undefined ? 'Not reported' : `${summary.submissions} submitted`}</strong><small>Preserved history, not current acceptance</small></div>
      <div><span>Required-outcome coverage</span><strong>{summary.coverage}</strong><small>Runtime projection of adopted outcomes</small></div>
      <div><span>Principal acceptance</span><strong>{summary.acceptance}</strong><small>Exact release and current applicability</small></div>
    </div>
    <div class="workspace-tabs" role="tablist" aria-label="Workspace sections" ref={tabs} onKeyDown={e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); let n = WORK_TABS.indexOf(tab);
      n = e.key === 'Home' ? 0 : e.key === 'End' ? WORK_TABS.length - 1 : (n + (e.key === 'ArrowRight' ? 1 : -1) + WORK_TABS.length) % WORK_TABS.length;
      setTab(WORK_TABS[n]); (tabs.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[n])?.focus();
    }}>{WORK_TABS.map((name, index) => <button key={name} id={`workspace-tab-${index}`} role="tab" aria-selected={tab === name}
        aria-controls="workspace-panel" tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)}>{name}</button>)}</div>
    <section id="workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${WORK_TABS.indexOf(tab)}`} tabIndex={0}>
      {tab === 'Overview' && <>
        <WorkConversation key={id} work={id} environment={text(d.environment) || work.scope} open={open}/>
        {section('Persona activity', 'run', 'No participation runs have been recorded.', 'Latest decisions and current stop reasons. Open a run to inspect actions or pause, resume, and cancel participation.')}
        <section class="workspace-section mandate"><span class="field-label">Recorded request · scope is not silently expanded</span><h2>The need</h2><p class="record-prose">{text(d.brief, 'Read the exact record for the retained request.')}</p>
          <p class="record-caveat">The interface does not assign professions, rank personalities, choose a team strategy, or declare a design safe.</p></section>
        {fields(d.mandate).id && <CurrentMandate id={text(fields(d.mandate).id)} open={open}/>}
        <div class="workspace-columns"><WorkState value={d.core} open={open}/>
          {d.resource_root ? <section class="workspace-section"><h2>Funding and finishing capacity</h2><AllowanceSummary id={text(d.resource_root)}/></section> : <section class="workspace-section"><h2>Funding</h2><p>No allowance is bound. Use Funding above to authorize one.</p></section>}</div>
        {section('Current collective commitments', 'commitment', 'No explicit commitments are visible. Open persona activity to inspect what has actually happened.', 'Accepted responsibilities and dependencies, not an automatically ranked task list.')}
        {section('Needs attention', 'request,work_feedback,feedback', 'No requests or consequential feedback are visible on this page. This is not proof that the work has no blockers.', 'Answers, acknowledgements, dispositions and verified repairs are different states.')}
      </>}
      {tab === 'Perspectives' && <>
        <div class="workspace-intro"><h2>Different people, different approaches</h2><p>Read the perspectives personas have authored for this work. Their views remain separate from shared proposals and accepted responsibilities.</p></div>
        <Perspectives key={id} work={id} open={open}/>
        {section('Shared opportunity board', 'proposal,work_entry', 'No proposals are visible. The UI does not generate candidate improvements.', 'Unranked records in server order. Frequency, confidence or group size does not confer authority.')}
      </>}
      {tab === 'Work & outcomes' && <>
        <p class="notice">A complete checklist can still omit part of the original need. Adopted-outcome coverage and scope review must be assessed separately.</p>
        {fields(d.mandate).id && <CurrentMandate id={text(fields(d.mandate).id)} open={open}/>}<WorkState value={d.core} open={open}/>
        {section('Responsibilities & dependencies', 'commitment', 'No accepted responsibilities are recorded here.')}
        <div class="workspace-columns">{section('Conditional assumptions', 'assumption', 'No explicit assumption records are available.')}{section('Interfaces & bounded iterations', 'iteration,interface', 'No agreed provisional interfaces or iteration baseline are available.')}</div>
      </>}
      {tab === 'People & agreements' && <>
        <Participants subject={work} act={act} open={open}/>
        {section('Membership & consent', 'invitation,membership', 'The baseline roster alone does not prove an invitation was accepted.')}
        {section('Births & contributions', 'birth,birth_link,birth_proposal', 'No birth provenance is available. The UI will not infer birth, lineage or expertise from a new name.')}
        {section('Working agreements & dissent', 'agreement,working_agreement', 'No exact endorsed agreements are available. Similar messages are not consensus.')}
      </>}
      {tab === 'Artifacts & evidence' && <>
        <WorkArtifacts work={id} open={open} artifact={artifact}/>
        <details class="submission-history" open={submissionHistory} onToggle={e => setSubmissionHistory(e.currentTarget.open)}><summary>Submission history</summary>
          {submissionHistory && section('Submitted versions', 'submission', 'No submissions have been recorded yet.')}
        </details>
        {section('Assessments & applicability', 'finding,assessment', 'No assessment is visible. Reviewer availability and funding are not inferred.', 'Missing current-scope bindings remain unverifiable; an old accepted verdict is never a green work status.')}
        {section('Release seals & conflicts', 'work_release,release', 'No atomic release seal is reported. Inspect the exact release and its current applicability.')}
      </>}
      {tab === 'Decisions & learning' && <>
        {section('Decisions, changes & handoffs', 'decision,work_entry', 'No attributed work decisions are available. Open activity for original action receipts.')}
        {section('Retained fragments', 'fragment', 'No work-scoped fragments are visible. Persona-owned learning is available from that persona’s detail; it is not imported across scopes.')}
        <section class="workspace-section"><h2>Authored documents</h2><p>Documents belong to their author or shared environment. Exact versions submitted to this task are linked from its submissions.</p><button class="secondary" onClick={() => setTab('Artifacts & evidence')}>View submitted documents and files</button></section>
      </>}
    </section>
    <aside class="contract-boundary"><p>Scope, funding, participation, and evidence come from your node. Selecting participants offers an invitation; each persona chooses whether to join and accept responsibility.</p></aside>
  </div>;
}
