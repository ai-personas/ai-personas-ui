import { useEffect, useRef, useState } from 'preact/hooks';
import type { ApiTypes } from './contract';
import { type Action } from './api';
import { useResource } from './hooks';
import { followProgress, type Progress } from './activity';
import ToolOutput from './ToolOutput';
import ActionReader from './ActionReader';
import { actionTitle } from './reading';

type Receipt = ApiTypes['action_activity'][number];

function CallMessages({ id, visible }: { id: string; visible: boolean }) {
  const [snapshot, setSnapshot] = useState<Progress>(), [error, setError] = useState('');
  useEffect(() => { setSnapshot(undefined); setError(''); }, [id]);
  useEffect(() => visible ? followProgress(id, (value, error) => { setSnapshot(value); setError(error); }) : undefined, [id, visible]);
  return <div class="progress-messages">
    {error && <p role="alert">{error}</p>}
    {snapshot?.messages.map(m => <div class="progress-message" key={m.index}><span class="field-label">{m.kind === 'summary' ? 'Provisional decision summary' : 'Progress message'}</span><p class="record-prose">{m.text}</p></div>)}
    {snapshot && !snapshot.done && !snapshot.messages.length && <p class="micro">The model is responding. No public progress message has arrived yet.</p>}
    {snapshot && snapshot.messages.length > 0 && <p class="micro">{snapshot.done ? `Decision ${snapshot.status}.` : 'Decision still in progress.'} Progress messages are reported activity; action receipts show what actually ran.</p>}
    {snapshot?.truncated && <p class="micro">Progress preview reached its size limit. Saved work and action receipts remain available after the call.</p>}
  </div>;
}

function ReceiptDetails({ id, open }: { id: string; open: (id: string) => void }) {
  const { value, error } = useResource<Action>(`/actions/${id}`, e => e.entity === id);
  return error ? <p role="alert">{error}</p> : value ? <div class="readable-action"><ActionReader action={value} open={open}/><details><summary>Technical action details</summary><pre>{JSON.stringify(value, null, 2)}</pre></details></div> : <p>Loading receipt…</p>;
}

function ActionItem({ action, follow, visible, open }: { action: Receipt; follow: boolean; visible: boolean; open: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return <li class="activity-action" data-state={action.state}>
    <div class="activity-action-heading"><strong>{actionTitle(action.kind)}</strong><span class={'state-badge tone-' + (action.state === 'failed' || action.state === 'conflict' ? 'attention' : action.state === 'running' ? 'active' : 'neutral')}>{action.state}</span></div>
    <time class="micro" dateTime={action.finished || action.created}>{new Date(action.finished || action.created).toLocaleTimeString()}</time>
    {action.error && <p role="alert">{action.error}</p>}
    {follow && <ToolOutput id={action.id} state={action.state} visible={visible}/>}
    <button class="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide activity details' : 'View activity details'}</button>
    {expanded && <ReceiptDetails id={action.id} open={open}/>}
  </li>;
}

export default function LiveActivity({ run, call, open }: { run: string; call?: string; open: (id: string) => void }) {
  const section = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null), following = useRef(true);
  const [onScreen, setOnScreen] = useState(false), [tabVisible, setTabVisible] = useState(!document.hidden), [paused, setPaused] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: '100px' });
    if (section.current) observer.observe(section.current);
    const change = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', change); };
  }, []);
  const visible = onScreen && tabVisible && !paused;
  const { value: actions, error } = useResource<Receipt[]>(`/runs/${run}/activity`, e => e.kind === 'action' && e.data?.run === run, visible);
  useEffect(() => { if (following.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [actions]);
  const followed = actions?.filter(a => a.kind === 'exec').slice(-2).map(a => a.id) || [];
  return <section ref={section} class="live-activity" aria-label="Live progress and actions">
    <div class="activity-heading"><h4>Live activity</h4><button class="text-button" onClick={() => setPaused(!paused)}>{paused ? 'Follow live activity' : 'Pause live view'}</button></div>
    {paused && <p class="micro">Display paused. The persona’s work continues.</p>}
    {call && <CallMessages id={call} visible={visible}/>}
    {error && <p role="alert">Recent actions unavailable: {error}</p>}
    {actions?.length === 0 && <p class="micro">No actions recorded for this participation yet.</p>}
    <ol ref={list} class="activity-actions" onScroll={e => { const el = e.currentTarget; following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>{actions?.map(action => <ActionItem key={action.id} action={action} follow={followed.includes(action.id)} visible={visible} open={open}/>)}</ol>
    {!!actions?.length && <p class="micro">Latest {actions.length} action receipts. Open activity details for the full history.</p>}
  </section>;
}
