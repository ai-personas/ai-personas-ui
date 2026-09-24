import { useResource } from './hooks';
import { data, type Entity } from './api';
import { fields, text } from './workspace';
import { Story } from './RecordReader';
export default function MemoryLocator({ node }: { node: string }) {
  const { value, error } = useResource<Entity>('/records/' + node, e => e.entity === node || e.kind === 'information_policy');
  const locator = fields(value ? data(value).locator : undefined);
  return <section class="memory-locator" aria-label="Retrieval utility">
    {error && <p role="alert">Could not read the retrieval utility. {error}</p>}
    {!value && !error && <p role="status">Loading retrieval utility…</p>}
    {value && <><Story value={locator.description}/><p>The persona supplies these inputs to find existing lessons. This utility does not write new lessons.</p>
      <ul>{(Array.isArray(locator.parameters) ? locator.parameters : []).map((p: {name: string;description: string}) => <li key={p.name}><strong>{p.name}</strong>: {p.description}</li>)}</ul>
      <details><summary>View utility code · revision {value?.revision}</summary><pre class="memory-code"><code>{text(locator.script)}</code></pre></details></>}
  </section>;
}
