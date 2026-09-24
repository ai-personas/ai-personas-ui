/** Read-only presentation of Rust records; never an authority or completion engine. */
import type { Entity } from './api';

export const WORK_TABS = [
  'Overview', 'Perspectives', 'Work & outcomes', 'People & agreements',
  'Artifacts & evidence', 'Decisions & learning',
] as const;
export type WorkTab = typeof WORK_TABS[number];
export type Fields = Record<string, unknown>;
export function fields(value: unknown): Fields {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : {};
}
export function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}
export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
export function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
export function recordIDs(value: unknown): string[] {
  return strings(value).filter(isRecordID);
}
export function isRecordID(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value);
}
export function activityText(value: unknown): string {
  const entries = Object.entries(fields(value)).filter(([, n]) => count(n) !== undefined && Number(n) > 0);
  return entries.map(([state, n]) => `${n} ${state.replaceAll('_', ' ')}`).join(' · ') || 'No activity reported';
}
export function workFacts(work: Entity) {
  const d = fields(work.data), core = fields(d.core), coverage = fields(core.coverage), acceptance = fields(core.acceptance);
  const outcomes = Array.isArray(coverage.outcomes) ? coverage.outcomes.map(fields).filter(o => o.required === true) : undefined;
  const evidenced = outcomes?.filter(o => ['current', 'user_accepted'].includes(text(o.evidence))).length;
  return {
    activity: activityText(d.activity),
    submissions: count(d.submissions),
    pendingRequests: count(d.pending_requests),
    // Only the runtime's current projection establishes these, never a page of reviews.
    coverage: core.binding === 'adopted' && outcomes ? `${evidenced}/${outcomes.length} required outcomes have current evidence` : 'Not established',
    acceptance: core.binding === 'adopted' && ['current', 'stale'].includes(text(acceptance.applicability)) && text(acceptance.disposition)
      ? `${text(acceptance.disposition).replaceAll('_', ' ')} · ${acceptance.applicability} release` : 'Not established',
  };
}
/** An answered request still needs disposition, but no longer needs a user reply. */
export function inputRequestCount(record: Entity): number {
  const d = fields(record.data);
  if (record.kind === 'request') return d.status === 'open' && d.audience === 'user' ? 1 : 0;
  return count(d.input_requests) ?? 0;
}
export function assessmentFacts(record: Entity) {
  const d = fields(record.data);
  const verdict = text(d.verdict, 'not recorded');
  const reported = text(d.applicability);
  const applicability = ['current', 'stale', 'pending', 'unverifiable'].includes(reported) ? reported : 'unverifiable';
  return { verdict, applicability, submission: text(d.submission),
    note: applicability === 'unverifiable'
      ? 'No current-scope applicability was supplied. This verdict is not a current work acceptance.'
      : 'Reported applicability concerns this exact assessment only, not the whole work.' };
}
export function ownership(record: Entity): { label: string; id?: string } {
  const d = fields(record.data);
  const accepted = ['accepted', 'working', 'blocked', 'submitted', 'closed'].includes(text(d.status));
  if (accepted && isRecordID(d.owner)) return { label: 'Recorded owner', id: d.owner };
  if (isRecordID(d.offered_to)) return { label: 'Offered to · acceptance not established', id: d.offered_to };
  return { label: accepted ? 'Owner not recorded' : 'Accepted ownership not established' };
}
export function stateTone(value: string): 'neutral' | 'warning' | 'danger' {
  if (['failed', 'rejected', 'conflict', 'effect_unknown'].includes(value)) return 'danger';
  if (['stale', 'pending', 'blocked', 'unverifiable', 'uncertain', 'waiting', 'unowned', 'source_disposition_required'].includes(value)) return 'warning';
  // "accepted" alone must never turn an entire work, proposal or old review green.
  return 'neutral';
}
export function assumptionNote(status: string): string {
  return status === 'authorized_for_exploration'
    ? 'Authorized for exploration is not confirmation of the fact. Dependent claims remain conditional.'
    : 'Confirmation requires referenced evidence; an assumption is not a user-supplied fact.';
}
/** Missing scope in old Rust events calls for conservative invalidation, not missed updates. */
export function matchesRecords(event: unknown, kinds: string, scope = '', owner = ''): boolean {
  const e = fields(event), d = fields(e.data);
  const kind = text(e.kind);
  const wanted = kinds.split(',');
  // Derived attention/rosters cross work scopes. Request events name their work,
  // response events name the request; neither directly names the environment.
  if (wanted.some(k => ['persona', 'environment'].includes(k))
      && ['request', 'response', 'work', 'run', 'invitation'].includes(kind)) return true;
  // Call events are scoped to a run, not to its work/owner. Run summaries
  // include the latest call; conservatively refresh bounded visible run pages.
  if (wanted.includes('run') && ['call', 'request', 'response'].includes(kind)) return true;
  const derivedWork = wanted.includes('work') && WORK_FACT_EVENTS.includes(kind);
  if (kinds && !wanted.includes(kind) && !derivedWork) return false;
  const eventScope = text(d.scope) || text(d.work);
  if (scope && eventScope && eventScope !== scope && e.entity !== scope) return false;
  const eventOwner = text(d.owner) || text(d.persona) || text(d.actor);
  if (owner && eventOwner && owner !== eventOwner) return false;
  return true;
}

const WORK_FACT_EVENTS = ['run', 'request', 'submission', 'finding', 'commitment', 'invitation',
  'work_mandate', 'work_entry', 'work_feedback', 'work_assembly', 'work_release', 'agreement',
  'working_agreement', 'resource_root', 'resource_charge', 'budget_charge'];

export function matchesWork(event: unknown, id: string): boolean {
  const e = fields(event), d = fields(e.data);
  return e.entity === id || d.scope === id || d.work === id
    || ['resource_root', 'resource_charge', 'budget_charge'].includes(text(e.kind));
}

export function matchesAllowance(event: unknown, id: string): boolean {
  const e = fields(event), d = fields(e.data);
  return e.entity === id || (['resource_charge', 'budget_charge'].includes(text(e.kind))
    && (!d.scope || d.scope === id));
}
