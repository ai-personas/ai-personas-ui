import { useEffect, useState } from 'preact/hooks';
import { data, type Entity } from './api';
import { useResource, useRecords } from './hooks';
import type { Act } from './main';
import { matchesRecords } from './workspace';

type Tool = { id: string; name: string; description: string; operations: string[]; default_enabled: boolean; adapter: string };
export function ToolChoices({ value, onChange }: { value?: string[]; onChange: (value: string[]) => void }) {
  const { value: catalog, error, retry } = useResource<Tool[]>('/environment-tools', () => false);
  useEffect(() => { if (catalog && value === undefined) onChange(catalog.filter(t => t.default_enabled).map(t => t.id)); }, [catalog, value]);
  return <fieldset class="environment-tools"><legend>Tools</legend>
    <p>Available to every participating persona and work in this environment. Remove any defaults you do not want to start with. Personas can acquire tools later when permitted.</p>
    {error && <p role="alert">Could not load available tools. <button type="button" onClick={retry}>Try again</button></p>}
    {!catalog && !error && <p role="status">Loading tools…</p>}
    {catalog?.map(tool => <label class="tool-choice" key={tool.id}><input type="checkbox" checked={(value ?? []).includes(tool.id)} onChange={e => onChange(e.currentTarget.checked ? [...(value ?? []), tool.id] : (value ?? []).filter(id => id !== tool.id))}/><span><strong>{tool.name}</strong><small>{tool.description}</small></span></label>)}
    <small>Creating an environment does not run these tools or spend inference.</small>
  </fieldset>;
}
export default function EnvironmentTools({ environment, act, open }: { environment: string; act: Act; open: (id: string) => void }) {
  const { value: catalog, error: catalogError } = useResource<Tool[]>('/environment-tools', () => false);
  const { value: page, error: bindingsError } = useRecords('environment_tool', environment);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  async function change(tool: Tool, binding?: Entity) {
    if (busy) return; setBusy(tool.id); setError('');
    try { await act(binding && data(binding).enabled ? 'environment.tool.remove' : 'environment.tool.add', { environment, tool: tool.id, revision: binding?.revision ?? 0 }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  return <section class="workspace-section" aria-label="Environment tools"><h2>Shared tools</h2><p>Every accepted participant in this environment can use enabled tools under its current permissions and allowance. Private memories and credentials are not shared.</p>
    {(error || catalogError || bindingsError) && <p role="alert">{error || catalogError || bindingsError}</p>}
    {(!catalog || !page) && !catalogError && !bindingsError && <p role="status">Loading tools…</p>}
    <div class="cards reading-collection">{page && catalog?.map(tool => { const binding = page.items.find(r => data(r).tool === tool.id), d = binding ? data(binding) : {}; return <article class="card environment-tool" key={tool.id}>
      <h3>{tool.name}</h3><p>{tool.description}</p><p><strong>{d.enabled ? d.status === 'unchecked' ? 'Ready to try · not checked yet' : d.status === 'available' ? 'Last attempt succeeded' : 'Last attempt unavailable' : 'Not enabled'}</strong></p>
      {d.availability_basis && <p class="micro">{d.availability_basis}</p>}
      <div class="button-row"><button class="secondary" disabled={!!busy} onClick={() => void change(tool, binding)}>{busy === tool.id ? 'Saving…' : d.enabled ? 'Remove tool' : 'Add tool'}</button>{d.last_action && <button class="text-button" onClick={() => open(binding!.id)}>View last observation</button>}</div>
    </article>; })}</div>
    <p class="micro">Removing a binding does not uninstall host software. A persona may explicitly acquire a removed tool later under its existing authority.</p>
  </section>;
}
