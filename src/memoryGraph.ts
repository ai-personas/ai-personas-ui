/** Compatibility projection of the runtime's memory-graph/1 response.
 * This is not a conditional-recall contract. Graph cards and edges are previews.
 */
export type MemoryRef = { id: string; revision: number };
export type MemoryCard = {
  node: MemoryRef;
  fragment: MemoryRef;
  title: string;
  short_description: string;
  basis?: string;
  locator?: { description: string } | null;
};
export type MemoryConnection = {
  source: MemoryRef;
  target: MemoryRef;
  origin: 'authored_related' | 'legacy_parent';
  mode: 'preview_only';
  applicability: 'not_evaluated';
};
export type MemoryGraph = {
  focus_card: MemoryCard | null;
  items: MemoryCard[];
  connections: MemoryConnection[];
  next: number | null;
};
export type MemoryGraphRequest = { owner: string; focus: string; after: number; query: string };

export function memoryGraphPath(request: MemoryGraphRequest): string {
  const { owner, focus, after, query } = request;
  // The public endpoint retains `branch` as the wire name for graph focus.
  const params = new URLSearchParams({ limit: '12', after: String(after) });
  if (focus) params.set('branch', focus);
  if (query) params.set('query', query);
  return `/personas/${encodeURIComponent(owner)}/memory?${params}`;
}

function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new Error('The fragment graph response does not match this request or the supported memory-graph/1 contract.');
}
function object(value: unknown): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function reference(value: unknown): MemoryRef {
  const ref = object(value);
  requireValue(typeof ref.id === 'string' && /^[0-9a-f]{32}$/i.test(ref.id));
  requireValue(typeof ref.revision === 'number' && Number.isSafeInteger(ref.revision) && ref.revision >= 0);
  return { id: ref.id, revision: ref.revision };
}
function same(a: MemoryRef, b: MemoryRef): boolean {
  return a.id === b.id && a.revision === b.revision;
}
function text(value: unknown): string {
  requireValue(value == null || typeof value === 'string');
  return typeof value === 'string' ? value : '';
}
function card(value: unknown): MemoryCard {
  const item = object(value);
  const locator = item.locator == null ? null : object(item.locator);
  return {
    node: reference(item.node), fragment: reference(item.fragment),
    title: text(item.title), short_description: text(item.short_description),
    basis: text(item.basis),
    locator: locator ? { description: text(locator.description) } : null,
  };
}

/** Reject stale/mismatched projections rather than inventing roots or endpoints.
 * Errors never echo potentially inaccessible IDs or content from the response.
 */
export function readMemoryGraph(value: unknown, request: MemoryGraphRequest): MemoryGraph {
  const page = object(value);
  requireValue(page.schema === 'memory-graph/1' && page.owner === request.owner);
  requireValue(page.branch === (request.focus || null));
  requireValue(page.after === request.after && page.limit === 12);
  requireValue((page.query ?? '') === request.query);
  requireValue(page.view === (request.query ? 'search' : request.focus ? 'neighborhood' : 'all_owned'));
  requireValue(page.automatic_selection === false && page.requires_root === false && page.requires_functional_groups === false);
  requireValue(Array.isArray(page.path) && page.path.length <= 1);
  requireValue(Array.isArray(page.items) && page.items.length <= 12);
  requireValue(Array.isArray(page.connections) && page.connections.length <= 13 * 17);
  const items = page.items.map(card);
  let focus_card: MemoryCard | null = null;
  if (request.focus) {
    const focus = reference(page.focus);
    requireValue(focus.id === request.focus && page.path.length === 1);
    focus_card = card(page.path[0]);
    requireValue(same(focus, focus_card.node));
  } else {
    requireValue(page.focus === null && page.path.length === 0);
  }
  const visible = new Map<string, MemoryRef>();
  for (const item of [...(focus_card ? [focus_card] : []), ...items]) {
    requireValue(!visible.has(item.node.id));
    visible.set(item.node.id, item.node);
  }
  const seen = new Set<string>();
  const connections = page.connections.map(value => {
    const edge = object(value), source = reference(edge.source), target = reference(edge.target);
    const from = visible.get(source.id), to = visible.get(target.id);
    requireValue(from && to && same(from, source) && same(to, target) && source.id !== target.id);
    const key = `${source.id}:${target.id}`;
    requireValue(!seen.has(key)); seen.add(key);
    requireValue(edge.origin === 'authored_related' || edge.origin === 'legacy_parent');
    requireValue(edge.mode === 'preview_only' && edge.applicability === 'not_evaluated');
    return { source, target, origin: edge.origin, mode: edge.mode, applicability: edge.applicability } as MemoryConnection;
  });
  requireValue(page.next === null || (typeof page.next === 'number' && Number.isSafeInteger(page.next) && page.next > request.after && page.next <= 1_000_000));
  return { focus_card, items, connections, next: page.next as number | null };
}
