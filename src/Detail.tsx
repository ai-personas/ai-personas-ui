import { ErasePayload, AllowanceSummary } from './Operator';
import { Correspondence, MessageComposer, MessageReceipt, PersonaActivity } from './Messages';
import type { ComponentChildren } from 'preact';
import { lazy, Suspense } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { data, label, request, type Entity, type Action, type Page } from './api';
import { useRecords, useResource } from './hooks';
import { Portrait, Pagination, Status, type Act } from './main';
import { assessmentFacts, isRecordID, recordIDs, text, inputRequestCount, matchesRecords, matchesWork } from './workspace';
import Participants from './Participants';
import { InputNotice, InputBadge } from './Attention';
import Dialog from './Dialog';
import { RunProgress } from './RunProgress';
import Identity from './Identity';
import ToolOutput from './ToolOutput';
import RecordReader from './RecordReader';
import ActionReader from './ActionReader';
import { ContentReferences } from './ContentCards';
import { humanLabel, recordTitle, actionTitle } from './reading';
import { timestamp } from './identity';
import RichText from './RichText';
import ContextRecovery from './ContextRecovery';
const EnvironmentTools = lazy(() => import('./EnvironmentTools'));
const Upload = lazy(() => import('./Upload'));
const Pick = lazy(() => import('./Create').then(m => ({ default: m.Pick })));
function Expand({ title, children }: { title: string; children: () => ComponentChildren }) { const [open, setOpen] = useState(false); return <section class="expand"><button class="expand-title" aria-expanded={open} onClick={() => setOpen(!open)}>{title} {open ? '−' : '+'}</button>{open && children()}</section>; }
export default function Detail({ id, open, artifact, close, act }: { id: string; open: (id: string) => void; artifact: (id: string) => void; close: () => void; act: Act }) {
  const { value: r, error } = useResource<Entity>('/records/' + id, e => e.kind === 'information_policy' || matchesWork(e, id) || matchesRecords(e, 'persona,environment'));
  const [tab, setTab] = useState(''), [failure, setFailure] = useState(''), [review, setReview] = useState(false), [reviewers, setReviewers] = useState<string[]>([]), [reviewBusy, setReviewBusy] = useState(false);
  const d = r ? data(r) : {};
  const tabs = r?.kind === 'work' ? ['Activity', 'Submissions', 'Assessments', 'Requests'] : r?.kind === 'persona' ? ['Work', 'Learning', 'Tools', 'Perspectives', 'Messages', 'History'] : r?.kind === 'environment' ? ['Work', 'Learning', 'Tools', 'Messages'] : r?.kind === 'run' ? ['Actions', 'Model calls'] : r?.kind === 'request' ? ['Responses'] : [];
  const current = tab || tabs[0];
  const actSafe: Act = async (...args) => { setFailure(''); try { return await act(...args); } catch (e) { setFailure((e as Error).message); throw e; } };
  return <Dialog label="Record details" close={close} drawer><div class="drawer record-detail"><header><div><p class="eyebrow">{r ? humanLabel(r.kind) : 'Details'}</p><h2>{r ? recordTitle(r) : 'Loading…'}</h2></div><button onClick={close}>Close details</button></header><div class="drawer-body">
    {(error || failure) && <p role="alert">{error || failure}</p>}{r && <>
      {r.kind === 'request' ? <InputBadge record={r}/> : <InputNotice record={r} open={open}/>}
      {r.kind !== 'persona' && <RecordReader record={r} open={open}/>}
      {r.kind === 'environment_tool' && isRecordID(d.last_action) && <Expand title="Last tool observation">{() => <ActionRecord id={d.last_action} act={actSafe} open={open}/>}</Expand>}
      {r.kind === 'run' && <RunProgress run={r} open={open} act={actSafe}/>} {text(d.error) && <p role="alert">{d.error}</p>}
      {['persona', 'environment'].includes(r.kind) && <><Portrait id={d.portrait || d.image} name={label(r)}/>{isRecordID(d.portrait || d.image) && <button class="text-button" onClick={() => artifact(d.portrait || d.image)}>Inspect original image</button>}</>}
      {r.kind === 'persona' && <><Identity persona={r} open={open} act={actSafe}/>
        <Expand title="Private carried context">{() => <><RichText text={text(d.context, 'No compacted account authored yet.')}/>{recordIDs(d.selected).map(ref => <button key={ref} class="record-link" onClick={() => open(ref)}>Selected record {ref.slice(0, 8)}</button>)}</>}</Expand></>}
      {r.kind === 'persona' && <PersonaActivity persona={id} funding={d.resource_root} open={open} act={actSafe}/>}
      {['work', 'environment'].includes(r.kind) && <Participants subject={r} act={actSafe} open={open}/>}
      {r.kind === 'environment' && !text(d.name) && <Expand title="Ask participants to name this environment">{() => <><p>Send one request to existing participants. A response uses their current allowances. Create work in this environment first if it has no participants.</p><MessageComposer to={id} environment={id} act={actSafe} open={open} initialText="Please choose a descriptive name and concise description for this shared environment after inspecting its current record. Respect any name already chosen by another participant. An image is optional and must refer to a real published artifact."/></>}</Expand>}
      {['persona', 'environment'].includes(r.kind) && <Expand title="Send a message">{() => <MessageComposer to={id} act={actSafe} open={open}/>}</Expand>}
      {r.kind === 'message' && <MessageReceipt id={id} open={open}/>}
      {r.kind === 'run' && <><div class="button-row"><button disabled={d.membership === 'removed' || ['queued', 'running'].includes(d.status)} onClick={() => void actSafe('run.resume', { id }).catch(() => {})}>Resume</button><button class="secondary" onClick={() => void actSafe('run.pause', { id }).catch(() => {})}>Pause decisions</button><button class="secondary" onClick={() => void actSafe('run.cancel', { id }).catch(() => {})}>Cancel work</button></div><p class="micro">Pause stops decisions; existing jobs may continue. Cancel cannot undo completed external effects.</p><ContextRecovery run={r} act={actSafe}/></>}
      {r.kind === 'request' && <><ContentReferences ids={recordIDs(d.artifacts)} open={open} artifact={artifact}/><p class="notice">{d.audience === 'work' ? 'Shared question: you and permitted participants can answer. Your response and attachments are shared with this work. The requesting persona assesses the replies.' : 'Your response and attachments go to the requesting persona.'} An answer does not establish resolution or verified facts.</p><Respond id={id} act={actSafe}/></>}
      {r.kind === 'response' && <><ContentReferences ids={recordIDs(d.artifacts)} open={open} artifact={artifact}/>{isRecordID(d.request) && <button onClick={() => open(d.request)}>Open request</button>}</>}
      {r.kind === 'submission' && <><ContentReferences ids={[...recordIDs(d.documents), ...recordIDs(d.artifacts)]} open={open} artifact={artifact}/>
        <button class="secondary" onClick={() => setReview(!review)}>Request independent review</button>
        {review && <form onSubmit={async e => { e.preventDefault(); if (reviewBusy) return; setReviewBusy(true); try { await actSafe('review.start', { submission: id, persona: reviewers[0], instructions: String(new FormData(e.currentTarget).get('instructions')) }); setReview(false); } catch { /* actSafe displays the retained failure. */ } finally { setReviewBusy(false); } }}>
          <p class="notice">The reviewer needs accepted participation, responsibility, and funding. The node checks the exact evidence and current scope.</p>
          <Suspense fallback={<p>Loading personas…</p>}><Pick kind="persona" value={reviewers} onChange={setReviewers}/></Suspense><label>Reviewer instructions<textarea name="instructions" required rows={4}/></label><button disabled={!reviewers.length || reviewBusy}>{reviewBusy ? 'Requesting…' : 'Start review'}</button></form>}
        <Records key={'finding' + id} kind="finding" scope={r.scope} filter={x => data(x).submission === id} open={open}/></>}
      {['finding', 'assessment'].includes(r.kind) && <><p>Historical verdict: <Status value={assessmentFacts(r).verdict}/></p><p>Reported applicability: <Status value={assessmentFacts(r).applicability}/></p><p class="notice">{assessmentFacts(r).note}</p>
        {isRecordID(d.submission) && <p>Exact submission <button class="text-button" onClick={() => open(d.submission)}>{d.submission.slice(0, 8)}</button></p>}
        <p>{recordIDs(d.checks).length} referenced checks. Command completion alone is not technical validation.</p>{recordIDs(d.checks).map(ref => <Expand key={ref} title={'Check ' + ref.slice(0, 8)}>{() => <ActionRecord id={ref} act={actSafe} open={open}/>}</Expand>)}</>}
      {r.kind === 'call' && <><p>{text(d.actual_model, 'Actual model not recorded')} · {text(d.status)}</p><p>{d.usage?.known ? `${d.usage.input} input · ${d.usage.cached} cached · ${d.usage.output} output tokens` : 'Usage unknown'}</p><p class="micro">Recorded usage is not a currency budget or a host-wide spend measure.</p><p>{d.context_bytes?.toLocaleString()} context bytes · {d.images?.length || 0} selected image inputs</p>
        <p class="micro">Model requests, responses, and provider logs are not archived. Saved work, status, and usage remain available.</p>
        {d.error && <p role="alert">{text(d.error)}</p>}</>}
      {r.kind === 'resource_root' && <AllowanceSummary id={id} act={actSafe}/>}
      {['document', 'artifact', 'fragment', 'perspective', 'message'].includes(r.kind) && <ErasePayload record={r} act={actSafe}/>}
      {r.kind === 'artifact' && <button onClick={() => artifact(id)}>Open file</button>}
      {tabs.length > 0 && <><nav class="tabs" aria-label="Detail sections">{tabs.map(t => <button key={t} class={current === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
        {current === 'Messages' && r.kind === 'persona' ? <Correspondence key={id} persona={id} open={open}/> : current === 'Actions' || current === 'History' ? <Actions key={current + id} owner={r.kind === 'persona' ? id : ''} run={r.kind === 'run' ? id : ''} act={actSafe} open={open}/>
          : current === 'Tools' && r.kind === 'environment' ? <Suspense fallback={<p>Loading tools…</p>}><EnvironmentTools environment={id} act={actSafe} open={open}/></Suspense>
          : <Records key={current + id} kind={({ Activity: 'run', Work: r.kind === 'persona' ? 'run' : 'work', Learning: 'fragment,document', Tools: 'tool,capability', Perspectives: 'perspective', Messages: 'message', 'Model calls': 'call', Submissions: 'submission', Assessments: 'finding,assessment', Requests: 'request', Responses: 'response' } as Record<string, string>)[current]} scope={r.kind === 'persona' ? '' : id} owner={r.kind === 'persona' ? id : ''} open={open}/>}
      </>}
      <Expand title="Version history">{() => <Revisions id={id} open={open}/>}</Expand>
      <Expand title="Technical details">{() => <><p class="reader-technical">Record ID: {id}</p><pre>{JSON.stringify(r.data, null, 2)}</pre></>}</Expand>
    </>}</div></div></Dialog>;
}
function Respond({ id, act }: { id: string; act: Act }) { const [files, setFiles] = useState<{ id: string; name: string }[]>([]), [busy, setBusy] = useState(false), [sent, setSent] = useState(''); return <form onSubmit={async e => { e.preventDefault(); if (busy) return; const form = e.currentTarget; setBusy(true); try { await act('request.respond', { request: id, text: String(new FormData(form).get('text')), artifacts: files.map(f => f.id) }); form.reset(); setFiles([]); setSent('Response delivered to the owner; disposition is not established.'); } catch { /* Parent displays the failure. */ } finally { setBusy(false); } }}><label>Your response<textarea name="text" rows={4} required placeholder="Facts, observations, a decision, or measurements…"/></label><Suspense fallback={<p>Loading attachment control…</p>}><Upload onFile={(ref, name) => setFiles(fs => [...fs, { id: ref, name }])}/></Suspense>{files.map(f => <p key={f.id}>{f.name} <button type="button" class="quiet" onClick={() => setFiles(files.filter(x => x.id !== f.id))}>Remove</button></p>)}<button disabled={busy}>{busy ? 'Sending…' : 'Send response'}</button>{sent && <p role="status">{sent}</p>}</form>; }
function Records({ kind, scope = '', owner = '', open, filter }: { kind: string; scope?: string; owner?: string; open: (id: string) => void; filter?: (r: Entity) => boolean }) { const [cursors, setCursors] = useState([0]); const { value: page, error } = useRecords(kind, scope, owner, '', cursors.at(-1)); const rows = page?.items.filter(filter || (() => true)); return <section>{error && <p role="alert">{error}</p>}{rows?.map(r => <button key={r.id} class={`record-link${inputRequestCount(r) ? ' needs-input' : ''}`} onClick={() => open(r.id)}><span>{recordTitle(r)}<InputBadge record={r}/><small>{timestamp(r.created)}</small></span><Status value={text(data(r).status) || text(data(r).verdict) || humanLabel(r.kind)}/></button>)}{rows?.length === 0 && !error && <p>No matching records on this page.</p>}<Pagination previous={cursors.length > 1} next={page?.next} onPrevious={() => setCursors(cursors.slice(0, -1))} onNext={() => { if (page?.next != null) setCursors([...cursors, page.next]); }}/></section>; }
function Actions({ owner, run, act, open }: { owner: string; run: string; act: Act; open: (id: string) => void }) { const [cursors, setCursors] = useState([0]); const { value: page, error } = useResource<Page<Action>>('/actions?' + new URLSearchParams({ owner, scope: run, after: String(cursors.at(-1)), limit: '20' }), e => e.kind === 'action' && (run ? e.data?.run === run : e.data?.actor === owner)); return <section>{error && <p role="alert">{error}</p>}{page?.items.map(a => <Expand key={a.request.id} title={actionTitle(a.request.kind) + ' · ' + a.state}>{() => <ActionBody a={a} act={act} open={open}/>}</Expand>)}<Pagination previous={cursors.length > 1} next={page?.next} onPrevious={() => setCursors(cursors.slice(0, -1))} onNext={() => { if (page?.next != null) setCursors([...cursors, page.next]); }}/></section>; }
function ActionRecord({ id, act, open }: { id: string; act: Act; open: (id: string) => void }) { const { value, error } = useResource<Action>('/actions/' + id, e => e.entity === id); return error ? <p role="alert">{error}</p> : value ? <ActionBody a={value} act={act} open={open}/> : <p>Loading check…</p>; }
function ActionBody({ a, act, open }: { a: Action; act: Act; open: (id: string) => void }) {
  const [output, setOutput] = useState(false);
  return <div class="readable-action">{a.request.kind === 'model.choose' && <p>{a.request.source === 'api' ? 'Operator model choice' : 'Persona model choice'}</p>}
    <ActionReader action={a} open={open}/>
    {a.request.kind === 'exec' && <><p class="notice">{a.state === 'running' ? 'Tool execution is pending. Launch is not completion.' : 'This receipt records execution, not engineering correctness.'}</p><button onClick={() => setOutput(!output)}>{output ? 'Close output' : 'Follow output'}</button>{a.state === 'running' && <button class="secondary" onClick={() => void act('job.cancel', { id: a.request.id }).catch(() => {})}>Cancel job</button>}{output && <ToolOutput id={a.request.id} state={a.state}/>}</>}
    <Expand title="Technical action details">{() => <pre>{JSON.stringify(a, null, 2)}</pre>}</Expand>
  </div>;
}
function Revisions({ id, open }: { id: string; open: (id: string) => void }) { const [cursors, setCursors] = useState([0]); const { value: page, error } = useResource<Page<Entity>>(`/records/${id}/revisions?after=${cursors.at(-1)}&limit=10`, e => e.entity === id); return <div class="reader-history">{error && <p role="alert">{error}</p>}{page?.items.map((r, i) => <Expand key={r.revision + ':' + i} title={'Version ' + r.revision + ' · ' + timestamp(r.updated)}>{() => <RecordReader record={r} open={open} historical/>}</Expand>)}<Pagination previous={cursors.length > 1} next={page?.next} onPrevious={() => setCursors(cursors.slice(0, -1))} onNext={() => { if (page?.next != null) setCursors([...cursors, page.next]); }}/></div>; }
