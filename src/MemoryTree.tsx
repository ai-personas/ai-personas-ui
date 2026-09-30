import type { ComponentChildren, JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import type { MemoryCard, MemoryGraph } from './memoryGraph';
import { connectionLabel, memoryForest, memoryTreeRows, selectedMemoryTreeRow, memoryTreeTypeahead, type MemoryTreeRow } from './memoryTree';
import './persona-navigation.css';

export default function MemoryTree({ graph, renderCard }: {
  graph: MemoryGraph; renderCard: (card: MemoryCard) => ComponentChildren;
}) {
  const forest = useMemo(() => memoryForest(graph), [graph]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState('');
  const tree = useRef<HTMLDivElement>(null), help = useId();
  const typing = useRef({ value: '', at: 0 });
  const allRows = useMemo(() => memoryTreeRows(forest), [forest]);
  const rows = useMemo(() => memoryTreeRows(forest, collapsed), [forest, collapsed]);
  const active = selectedMemoryTreeRow(rows, selected);
  const trail = active ? allRows.filter(row => active.key === row.key || active.key.startsWith(`${row.key}/`)) : [];
  const toggle = (row: MemoryTreeRow) => setCollapsed(previous => {
    const next = new Set(previous);
    if (next.has(row.key)) next.delete(row.key); else next.add(row.key);
    return next;
  });
  const focus = (row?: MemoryTreeRow) => {
    if (!row) return;
    setSelected(row.key);
    tree.current?.querySelector<HTMLElement>(`[data-tree-key="${row.key}"]`)?.focus();
  };
  const keydown = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>, row: MemoryTreeRow) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const index = rows.findIndex(item => item.key === row.key);
    switch (event.key) {
      case 'ArrowDown': focus(rows[Math.min(index + 1, rows.length - 1)]); break;
      case 'ArrowUp': focus(rows[Math.max(0, index - 1)]); break;
      case 'Home': focus(rows[0]); break;
      case 'End': focus(rows.at(-1)); break;
      case 'ArrowRight':
        if (row.children.length) {
          if (collapsed.has(row.key)) toggle(row); else focus(rows[index + 1]);
        }
        break;
      case 'ArrowLeft':
        if (row.children.length && !collapsed.has(row.key)) toggle(row);
        else focus(rows.find(item => item.key === row.parent));
        break;
      case 'Enter': case ' ': setSelected(row.key); break;
      case '*':
        setCollapsed(previous => new Set([...previous].filter(key => !rows.some(item => item.parent === row.parent && item.key === key))));
        break;
      default: {
        if (event.key.length !== 1) return;
        const now = Date.now();
        const value = (now - typing.current.at < 700 ? typing.current.value : '') + event.key.toLocaleLowerCase();
        typing.current = { value, at: now };
        focus(memoryTreeTypeahead(rows, row.key, value));
        event.preventDefault();
        return;
      }
    }
    typing.current = { value: '', at: 0 };
    event.preventDefault();
  };
  if (!active) return null;
  return <div class="memory-tree-layout">
    <div class="memory-tree-navigation">
      <div class="memory-tree-toolbar"><span class="field-label">ON THIS PAGE</span><div>
        <button type="button" class="text-button" disabled={!collapsed.size} onClick={() => setCollapsed(new Set())}>Expand all</button>
        <button type="button" class="text-button" disabled={!rows.some(row => row.children.length && !collapsed.has(row.key))} onClick={() => setCollapsed(new Set(allRows.filter(row => row.children.length).map(row => row.key)))}>Collapse all</button>
      </div></div>
      <p class="memory-tree-summary" role="status" aria-atomic="true">
        <strong>{allRows.filter(row => !row.reference).length} fragments</strong>
        <span>{rows.length} of {allRows.length} entries shown</span>
      </p>
      <p id={help} class="micro memory-tree-help">Arrow keys navigate and expand. <kbd>Home</kbd> / <kbd>End</kbd> jump. Type a title, or repeat a letter to cycle. Entries include shared and cycle links.</p>
      <div class="memory-tree" role="tree" aria-label="Persona fragment tree" aria-describedby={help} ref={tree}>
        {rows.map(row => <div key={row.key} role="treeitem" data-tree-key={row.key}
          class={`memory-tree-row${row.reference ? ' memory-tree-reference' : ''}`}
          style={{ '--tree-level': Math.min(row.level - 1, 5) }}
          tabIndex={active.key === row.key ? 0 : -1} aria-level={row.level}
          aria-posinset={row.position} aria-setsize={row.size}
          aria-selected={active.key === row.key}
          aria-expanded={row.children.length ? !collapsed.has(row.key) : undefined}
          aria-label={`${row.card.title || 'Retained learning'} · ${connectionLabel(row.connection)}${row.reference ? ` · ${row.reference === 'cycle' ? 'Cycle link' : 'Also linked'}` : ''}`}
          onFocus={() => setSelected(row.key)} onClick={() => focus(row)} onKeyDown={event => keydown(event, row)}>
          <span class="memory-tree-toggle" aria-hidden="true" onClick={event => { event.stopPropagation(); focus(row); if (row.children.length) toggle(row); }}>
            {row.children.length ? collapsed.has(row.key) ? '▸' : '▾' : row.reference ? '↗' : '·'}
          </span>
          <span class="memory-tree-copy"><strong>{row.card.title || 'Retained learning'}</strong><small>{connectionLabel(row.connection)}
            {row.reference && <span class="memory-tree-badge">{row.reference === 'cycle' ? 'Cycle link' : 'Also linked'}</span>}
          </small></span>
        </div>)}
      </div>
    </div>
    <section class="memory-tree-reader" aria-label="Selected fragment preview">
      <nav class="memory-tree-path" aria-label="Selected fragment path">
        <ol>{trail.map((row, index) => <li key={row.key}>
          {index > 0 && <span class="memory-tree-path-separator" aria-hidden="true">/</span>}
          {row.key === active.key
            ? <span aria-current="location">{row.card.title || 'Retained learning'}</span>
            : <button type="button" class="text-button" onClick={() => focus(row)}>{row.card.title || 'Retained learning'}</button>}
        </li>)}</ol>
      </nav>
      <p class="field-label">FRAGMENT PREVIEW · {connectionLabel(active.connection)}</p>
      {active.reference && <p class="micro">{active.reference === 'cycle' ? 'This connection returns to a fragment already in this branch.' : 'This fragment also appears in another branch.'} It is shown once in full; the link is not a duplicate fragment.</p>}
      {renderCard(active.card)}
    </section>
  </div>;
}
