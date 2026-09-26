import { useResource } from './hooks';
import { currentRead, readMemoryUtility } from './memoryDetails';
import type { MemoryRef } from './memoryGraph';
import { Story } from './RecordReader';
export default function MemoryLocator({ node, revision, fragment, owner }: { node: string; revision: number; fragment: MemoryRef; owner: string }) {
  const detail = useResource<unknown>('/records/' + encodeURIComponent(node), e => e.entity === node || e.entity === fragment.id || e.kind === 'information_policy');
  const current = currentRead(detail, value => readMemoryUtility(value, { id: node, revision, owner, kind: 'memory_node', fragment }));
  return <section class="memory-locator" aria-label="Retrieval utility" aria-busy={current.loading}>
    {current.error && <p role="alert">Could not read the retrieval utility. {current.error} <button class="text-button" onClick={detail.retry}>Retry retrieval utility</button></p>}
    {current.loading && <p role="status">Loading retrieval utility…</p>}
    {current.value && <><Story value={current.value.description}/><p>The persona supplies these inputs to find existing lessons. This utility does not write new lessons.</p>
      <ul>{current.value.parameters.map(p => <li key={p.name}><strong>{p.name}</strong>: {p.description}</li>)}</ul>
      <details><summary>View utility code · revision {revision}</summary><pre class="memory-code"><code>{current.value.script}</code></pre></details></>}
  </section>;
}
