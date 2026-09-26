/** Display projection of the current rootless graph. Browsing never selects context. */
import type { Condition, Predicate, Relation, Treatment } from './contract';
export type MemoryRef = { id: string; revision: number };
export type MemoryCard = {
  node: MemoryRef;
  fragment: MemoryRef;
  title: string;
  short_description: string;
  basis?: string;
  locator?: { description: string } | null;
};
type ConnectionEndpoints = {
  source: MemoryRef;
  target: MemoryRef;
  applicability: 'not_evaluated';
};
export type MemoryConnection = ConnectionEndpoints & (
  | { origin: 'authored_related'; mode: 'preview_only' }
  | { origin: 'authored_condition'; mode: Treatment; relation: Relation;
      explanation: string; condition: Condition; work: string | null; expires: string | null }
);
export type MemoryGraph = {
  focus_card: MemoryCard | null;
  items: MemoryCard[];
  connections: MemoryConnection[];
  next: number | null;
};
export type MemoryGraphRequest = { owner: string; focus: string; after: number; query: string };

export function memoryGraphPath(request: MemoryGraphRequest): string {
  const { owner, focus, after, query } = request;
  const params = new URLSearchParams({ limit: '12', after: String(after) });
  if (focus) params.set('focus', focus);
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
function identity(value: unknown): string {
  requireValue(typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value));
  return value;
}
function predicate(value: unknown): Predicate {
  const p = object(value);
  switch (p.kind) {
    case 'always': return { kind: p.kind };
    case 'work': case 'sender': return { kind: p.kind, id: identity(p.id) };
    case 'received': return { kind: p.kind, reference: reference(p.reference) };
    case 'semantic':
      requireValue(typeof p.situation === 'string' && p.situation.trim() && p.situation.length <= 1024);
      return { kind: p.kind, situation: p.situation };
    default: requireValue(false);
  }
}
function condition(value: unknown): Condition {
  const c = object(value);
  if (c.kind === 'all' || c.kind === 'any') {
    requireValue(Array.isArray(c.conditions) && c.conditions.length > 0 && c.conditions.length <= 8);
    return { kind: c.kind, conditions: c.conditions.map(predicate) };
  }
  if (c.kind === 'not') return { kind: c.kind, condition: predicate(c.condition) };
  return predicate(value);
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
  requireValue(page.after === request.after && page.limit === 12);
  requireValue((page.query ?? '') === request.query);
  requireValue(page.view === (request.query ? 'search' : request.focus ? 'neighborhood' : 'all_owned'));
  requireValue(page.automatic_selection === false && page.requires_root === false && page.requires_functional_groups === false);
  requireValue(Array.isArray(page.items) && page.items.length <= 12);
  requireValue(Array.isArray(page.connections) && page.connections.length <= 13 * 32);
  const items = page.items.map(card);
  let focus_card: MemoryCard | null = null;
  if (request.focus) {
    const focus = reference(page.focus);
    requireValue(focus.id === request.focus);
    focus_card = card(page.focus_card);
    requireValue(same(focus, focus_card.node));
  } else {
    requireValue(page.focus === null && page.focus_card === null);
  }
  const visible = new Map<string, MemoryRef>();
  for (const item of [...(focus_card ? [focus_card] : []), ...items]) {
    requireValue(!visible.has(item.node.id));
    visible.set(item.node.id, item.node);
  }
  const seen = new Set<string>();
  const connections: MemoryConnection[] = page.connections.map(value => {
    const edge = object(value), source = reference(edge.source), target = reference(edge.target);
    const from = visible.get(source.id), to = visible.get(target.id);
    requireValue(from && to && same(from, source) && same(to, target) && source.id !== target.id);
    // A plain association and a conditional connection can share endpoints.
    const key = `${source.id}:${target.id}:${edge.origin}`;
    requireValue(!seen.has(key)); seen.add(key);
    requireValue(edge.applicability === 'not_evaluated');
    const endpoints: ConnectionEndpoints = { source, target, applicability: 'not_evaluated' };
    if (edge.origin === 'authored_related') {
      requireValue(edge.mode === 'preview_only');
      return { ...endpoints, origin: edge.origin, mode: edge.mode };
    }
    requireValue(edge.origin === 'authored_condition' && (edge.mode === 'preview' || edge.mode === 'full'));
    requireValue(edge.relation === 'association' || edge.relation === 'correction' || edge.relation === 'prerequisite' || edge.relation === 'contradiction');
    requireValue(typeof edge.explanation === 'string' && edge.explanation.trim() && edge.explanation.length <= 2048);
    requireValue(edge.expires === null || (typeof edge.expires === 'string' && Number.isFinite(Date.parse(edge.expires))));
    return { ...endpoints, origin: edge.origin, mode: edge.mode, relation: edge.relation,
      explanation: edge.explanation, condition: condition(edge.condition),
      work: edge.work === null ? null : identity(edge.work), expires: edge.expires };
  });
  requireValue(page.next === null || (typeof page.next === 'number' && Number.isSafeInteger(page.next) && page.next > request.after && page.next <= 1_000_000));
  return { focus_card, items, connections, next: page.next as number | null };
}
