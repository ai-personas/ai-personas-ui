import type { MemoryCard, MemoryConnection, MemoryGraph } from './memoryGraph';

/** A finite, page-local browsing projection, never an authored hierarchy. */
export type MemoryBranch = {
  key: string;
  card: MemoryCard;
  connection?: MemoryConnection;
  reference?: 'cycle' | 'shared';
  children: MemoryBranch[];
};
export type MemoryTreeRow = MemoryBranch & {
  parent?: string;
  level: number;
  position: number;
  size: number;
};

export function memoryForest(graph: MemoryGraph): MemoryBranch[] {
  const cards = [...(graph.focus_card ? [graph.focus_card] : []), ...graph.items];
  const byID = new Map(cards.map(card => [card.node.id, card]));
  const outgoing = new Map<string, MemoryConnection[]>();
  const incoming = new Set<string>();
  for (const edge of graph.connections) {
    // Never invent an unavailable endpoint or join different revisions.
    if (byID.get(edge.source.id)?.node.revision !== edge.source.revision
      || byID.get(edge.target.id)?.node.revision !== edge.target.revision) continue;
    outgoing.set(edge.source.id, [...(outgoing.get(edge.source.id) || []), edge]);
    incoming.add(edge.target.id);
  }
  const visited = new Set<string>();
  const visit = (card: MemoryCard, key: string, ancestors: Set<string>, connection?: MemoryConnection): MemoryBranch => {
    const branch: MemoryBranch = { key, card, connection, children: [] };
    const id = card.node.id;
    if (ancestors.has(id)) return { ...branch, reference: 'cycle' };
    if (visited.has(id)) return { ...branch, reference: 'shared' };
    visited.add(id);
    const path = new Set(ancestors); path.add(id);
    branch.children = (outgoing.get(id) || []).map(edge => visit(
      byID.get(edge.target.id)!, `${key}/${edge.target.id}:${edge.origin}`, path, edge,
    ));
    return branch;
  };
  const roots: MemoryBranch[] = [];
  const add = (card: MemoryCard) => {
    if (!visited.has(card.node.id)) roots.push(visit(card, card.node.id, new Set()));
  };
  // The chosen focus is a browsing anchor, not a runtime root. Keep wire order.
  if (graph.focus_card) add(graph.focus_card);
  cards.filter(card => !incoming.has(card.node.id)).forEach(add);
  // Covers disconnected components and cycles with no zero-incoming vertex.
  cards.forEach(add);
  return roots;
}

export function memoryTreeRows(forest: MemoryBranch[], collapsed: ReadonlySet<string> = new Set()): MemoryTreeRow[] {
  const rows: MemoryTreeRow[] = [];
  const walk = (branches: MemoryBranch[], level: number, parent?: string) => {
    branches.forEach((branch, index) => {
      rows.push({ ...branch, parent, level, position: index + 1, size: branches.length });
      if (!collapsed.has(branch.key)) walk(branch.children, level + 1, branch.key);
    });
  };
  walk(forest, 1);
  return rows;
}

export function connectionLabel(edge?: MemoryConnection): string {
  if (!edge) return 'Browsing anchor';
  return edge.origin === 'authored_related' ? 'Association' : edge.relation.replace(/^./, letter => letter.toUpperCase());
}

/** A hidden selection falls back within its branch, not to an unrelated root. */
export function selectedMemoryTreeRow(rows: readonly MemoryTreeRow[], selected: string): MemoryTreeRow | undefined {
  let ancestor: MemoryTreeRow | undefined;
  for (const row of rows) {
    if (row.key === selected) return row;
    if (selected.startsWith(`${row.key}/`) && (!ancestor || row.level > ancestor.level)) ancestor = row;
  }
  return ancestor || rows[0];
}

/** Repeated letters cycle; extending a prefix keeps the current match first. */
export function memoryTreeTypeahead(rows: readonly MemoryTreeRow[], selected: string, value: string): MemoryTreeRow | undefined {
  if (!rows.length || !value.trim()) return undefined;
  const letters = Array.from(value.toLocaleLowerCase());
  const repeated = letters.every(letter => letter === letters[0]);
  const query = repeated ? letters[0] : letters.join('');
  const index = rows.findIndex(row => row.key === selected);
  const start = index < 0 ? 0 : index + (repeated ? 1 : 0);
  for (let offset = 0; offset < rows.length; offset++) {
    const row = rows[(start + offset) % rows.length];
    if ((row.card.title || 'Retained learning').toLocaleLowerCase().startsWith(query)) return row;
  }
  return undefined;
}
