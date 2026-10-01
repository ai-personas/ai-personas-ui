import ContinuityView from './ContinuityView';
import DeliveryRecovery from './DeliveryRecovery';
import { lazy, Suspense } from 'preact/compat';
import { type Action } from './api';
import { fields, isRecordID, text } from './workspace';
import { actionTitle, humanLabel } from './reading';
import { RecordReference, RelatedItems, Story } from './RecordReader';

const ResearchEvidence = lazy(() => import('./ResearchEvidence'));

/** Describe the purpose and visible result of an action, not its JSON envelope. */
export default function ActionReader({ action, open }: { action: Action; open: (id: string) => void }) {
  const kind = action.request.kind, args = fields(action.request.args), result = fields(action.result), draft = fields(args.draft);
  const items = Array.isArray(result.items) ? result.items : Array.isArray(action.result) ? action.result : undefined;
  const narrative = args.text || args.content || args.summary || args.description || args.character || args.purpose || args.findings || args.conclusion || draft.text || draft.description || draft.content;
  const transition = result.schema === 'wait-receipt/1' ? fields(result.run) : result.schema === 'invitation-response/1' ? fields(result.invitation) : {};
  const state = ({ succeeded: 'Completed', running: 'In progress', pending: 'Pending', failed: 'Failed', conflict: 'Could not apply the change', uncertain: 'Outcome uncertain' } as Record<string, string>)[action.state] || 'Outcome not confirmed';
  return <div class="action-reader">
    <p class="action-outcome"><strong>{actionTitle(kind)}</strong><span>{state}</span></p>
    {kind === 'message.send' && <p class="reader-byline">To {isRecordID(args.to) ? <RecordReference id={args.to} open={open}/> : args.to === 'user' || args.to === '' ? 'you' : 'the selected recipient'}</p>}
    {kind === 'context.advance' && (result.continuity ? <ContinuityView value={result.continuity} open={open}/> : <><Story title="Proposed focus" value={fields(args.continuity).focus}/><p class="record-caveat">No committed learning or context change was recorded.</p></>)}
    <Story value={narrative}/><Story title="Reason" value={args.reason}/><Story title="Instructions" value={args.instructions}/>
    {(kind.startsWith('browser.') || kind === 'model.invoke' && result.capability === 'knowledge') && <Suspense fallback={<p>Loading research…</p>}><ResearchEvidence kind={kind} args={args} result={result}/></Suspense>}
    {kind === 'exec' && <><Story title="Command" value={args.command}/>{typeof result.exit_code === 'number' && <p>{result.exit_code === 0 ? 'The command finished without reporting an error.' : `The command reported exit code ${result.exit_code}.`}</p>}</>}
    {kind === 'exec' && <Story title="Execution directory" value={result.directory}/>}
    {kind === 'artifact.publish' && <Story title="Published file" value={fields(result.publication).resolved_path}/>}
    {kind === 'model.choose' && text(args.model) && <p>Selected model: <strong>{text(args.model)}</strong></p>}
    {kind === 'record.list' && text(args.query) && <p>Search: {text(args.query)}</p>}
    {text(args.name || args.title) && <p class="action-name">{text(args.name || args.title)}</p>}
    {action.error && <p role="alert">{action.error}</p>}
    <DeliveryRecovery value={result.recovery || fields(result.peer_delivery).recovery || fields(fields(result.data).peer_delivery).recovery} open={open}/>
    <Story title="Result" value={result.summary || result.message || result.conclusion || result.note}/>
    {result.schema === 'wait-receipt/1' && <p>Recorded participation status: {humanLabel(text(result.status))}. Waiting does not establish completion or acceptance.</p>}
    {result.schema === 'invitation-response/1' && <p>Recorded membership: {humanLabel(text(result.membership))}.{result.commitment === 'not_accepted' && ' Responsibility has not been accepted by this invitation response.'}</p>}
    {isRecordID(transition.id) && <p class="reader-context-links">Current {result.schema === 'wait-receipt/1' ? 'participation' : 'invitation'} <RecordReference id={transition.id} open={open}/> <small>This receipt refers to revision {transition.revision}.</small></p>}
    {isRecordID(result.id) && typeof result.kind === 'string' && result.data != null && <p class="reader-context-links">Saved item <RecordReference id={result.id} open={open}/></p>}
    {items && <><p class="reader-muted">{items.length} {items.length === 1 ? 'item' : 'items'} in this result{result.next != null ? '; more are available' : ''}.</p><RelatedItems title="Returned items" value={items} open={open}/></>}
    {!narrative && !items && !text(args.name || args.title || args.reason || args.instructions) && !isRecordID(result.id) && !text(result.summary || result.message || result.conclusion || result.note) && !['exec', 'context.advance'].includes(kind) && !kind.startsWith('browser.') && !(kind === 'model.invoke' && result.capability === 'knowledge') && <p class="reader-muted">{action.state === 'succeeded' ? 'This action completed. Saved work and later activity show its effects.' : action.state === 'running' ? 'A result has not arrived yet.' : 'No written result was recorded for this action.'}</p>}
  </div>;
}
