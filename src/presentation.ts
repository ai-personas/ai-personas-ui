/** Presentation vocabulary only. No operations, sample records, or authority decisions. */
import { isRecordID, WORK_TABS, type WorkTab } from './workspace.ts';
export const PAGES = ['Work', 'Personas', 'Environments', 'Learning', 'Tools'] as const;
export type View = typeof PAGES[number] | 'Network' | 'Funding';
export type Navigation = { page: View; work?: string; tab?: WorkTab; record?: string; artifact?: string };

/** URLs identify views only. Credentials, form values and actions never belong here. */
export function readNavigation(hash: string): Navigation {
  if (hash.length > 1024) return { page: 'Work' };
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const page = ([...PAGES, 'Network', 'Funding'] as const).find(name => path === '/' + name.toLowerCase());
  if (!page) return { page: 'Work' };
  const args = new URLSearchParams(query);
  const one = (name: string) => args.getAll(name).length === 1 ? args.get(name) : undefined;
  const reference = (name: string) => { const id = one(name); return isRecordID(id) ? id : undefined; };
  const work = page === 'Work' ? reference('work') : undefined;
  const tab = work ? WORK_TABS.find(name => name === one('tab')) : undefined;
  return { page, work, tab, record: reference('record'), artifact: reference('artifact') };
}

export function navigationHash(route: Navigation): string {
  const args = new URLSearchParams();
  if (route.page === 'Work' && isRecordID(route.work)) {
    args.set('work', route.work);
    if (route.tab && route.tab !== 'Overview' && WORK_TABS.includes(route.tab)) args.set('tab', route.tab);
  }
  for (const field of ['record', 'artifact'] as const) if (isRecordID(route[field])) args.set(field, route[field]);
  return '#/' + route.page.toLowerCase() + (args.size ? '?' + args : '');
}
export type WorkFilter = 'all' | 'active' | 'needs-input' | 'archived';
export const WORK_FILTERS: readonly { value: WorkFilter; label: string }[] = [
  { value: 'all', label: 'Current work' },
  { value: 'active', label: 'Active' },
  { value: 'needs-input', label: 'Needs input' },
  { value: 'archived', label: 'Archived' },
];
export const VIEW_META: Record<View, {
  kind: string; description: string; emptyTitle: string; emptyBody: string; create?: string;
}> = {
  Funding: { kind: 'resource_root', description: 'Finite shared allowances and retained usage.', emptyTitle: 'Fund your work.', emptyBody: 'Create an allowance before starting personas and tasks.' },
  Work: {
    kind: 'work', description: 'Different perspectives. Accepted responsibilities. Evidence you can inspect.',
    emptyTitle: 'Start with a need, not a workflow.',
    emptyBody: 'Describe what you want to achieve. Create or select continuing personas, then follow their recorded approaches and commitments. Nothing is running until the node records it.',
    create: 'New work',
  },
  Personas: {
    kind: 'persona', description: 'Continuing AI collaborators, each with an authored character and an attributable history.',
    emptyTitle: 'Choose your first continuing collaborator.',
    emptyBody: 'Create a founder with a chosen model and allowance, then select it for work to begin orientation. Its character is self-authored; a new identity does not establish expertise or accepted responsibility.',
    create: 'New persona',
  },
  Environments: {
    kind: 'environment', description: 'Shared places with explicit participants, information, tools, and limits.',
    emptyTitle: 'Give your work a place.',
    emptyBody: 'Create an environment to describe a shared purpose and boundaries. The runtime, not this view, enforces access and permissions.',
    create: 'New environment',
  },
  Learning: {
    kind: 'fragment,document', description: 'Retained interpretations and authored documents, with sources and limitations.',
    emptyTitle: 'Learning needs a recorded history.',
    emptyBody: 'Fragments and documents appear when they are authored and retained. Keeping a note does not demonstrate that it improved later work.',
  },
  Tools: {
    kind: 'tool,capability', description: 'Available means of acting, separate from evidence of demonstrated competence.',
    emptyTitle: 'No tools or capabilities recorded.',
    emptyBody: 'Inspect tools as the node records them. This view cannot install a tool, grant permission, or establish competence from a registration.',
  },
  Network: {
    kind: 'transfer', description: 'Peer connections and recorded transfers. Connection is not shared authority.',
    emptyTitle: 'No transfers recorded.',
    emptyBody: 'Connect to a peer or receive an artifact through the node. A byte transfer does not activate a distributed persona identity.',
    create: 'Connect or receive',
  },
};

/** Filter only the currently loaded page, never historical review counts or inferred completion. */
export function matchesWorkFilter(data: unknown, filter: WorkFilter): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return filter === 'all';
  const d = data as Record<string, unknown>;
  if (filter === 'archived') return d.status === 'archived';
  if (d.status === 'archived') return false;
  if (filter === 'all') return true;
  const positive = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
  if (filter === 'needs-input') return positive(d.input_requests);
  const activity = d.activity;
  return !!activity && typeof activity === 'object' && !Array.isArray(activity)
    && positive((activity as Record<string, unknown>).running);
}

/** Read-only native prerequisites; never infer consent or capacity from a stop. */
export function finishingView(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.schema !== 'finishing-readiness/1' || v.read_only !== true) return null;
  const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
  const ref = v.responsibility && typeof v.responsibility === 'object' ? v.responsibility as Record<string, unknown> : {};
  return {
    preauthorized: typeof v.preauthorized === 'boolean' ? v.preauthorized : null,
    responsibility: isRecordID(ref.id) && count(ref.revision) !== null && Number(ref.revision) > 0 ? ref.id as string : null,
    billingOnly: count(v.billing_only_calls), unresolvedCharges: count(v.unresolved_charge_records), unresolvedActions: count(v.unresolved_actions),
    error: typeof v.error === 'string' ? v.error : '',
    blockers: Array.isArray(v.blockers) ? v.blockers.flatMap(item => {
      if (!item || typeof item !== 'object' || typeof item.code !== 'string' || typeof item.detail !== 'string') return [];
      return [{ code: item.code as string, detail: item.detail as string }];
    }) : null,
  };
}
