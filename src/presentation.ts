/** Presentation vocabulary only. No operations, sample records, or authority decisions. */
export const PAGES = ['Work', 'Personas', 'Environments', 'Learning', 'Tools'] as const;
export type View = typeof PAGES[number] | 'Network';
export type WorkFilter = 'all' | 'active' | 'needs-input';
export const WORK_FILTERS: readonly { value: WorkFilter; label: string }[] = [
  { value: 'all', label: 'All work' },
  { value: 'active', label: 'Active' },
  { value: 'needs-input', label: 'Needs input' },
];
export const VIEW_META: Record<View, {
  kind: string; description: string; emptyTitle: string; emptyBody: string; create?: string;
}> = {
  Work: {
    kind: 'work', description: 'Different perspectives. Accepted responsibilities. Evidence you can inspect.',
    emptyTitle: 'Start with a need, not a workflow.',
    emptyBody: 'Describe what you want to achieve. Create or select continuing personas, then follow their recorded approaches and commitments. Nothing is running until the node records it.',
    create: 'New work',
  },
  Personas: {
    kind: 'persona', description: 'Continuing AI collaborators, each with an authored character and an attributable history.',
    emptyTitle: 'Choose your first continuing collaborator.',
    emptyBody: 'Create a founder with an explicit character and model. A new identity is not proof of expertise, accepted membership, or useful learning.',
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
  if (filter === 'all') return true;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  const positive = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
  if (filter === 'needs-input') return positive(d.pending_requests);
  const activity = d.activity;
  return !!activity && typeof activity === 'object' && !Array.isArray(activity)
    && positive((activity as Record<string, unknown>).running);
}
