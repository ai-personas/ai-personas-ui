import { data, resourceRequest, type Entity } from './api';
import { readMemoryDetail } from './memoryDetails';
import type { MemoryRef } from './memoryGraph';

export async function readCurrentSelf(persona: Entity, signal: AbortSignal) {
  const d = data(persona), model = d.self_model;
  const fail = () => { throw new Error('The designated self-fragments are unavailable or changed. Refresh the profile to inspect its current designation.'); };
  const refs = (value: unknown): MemoryRef[] => {
    if (!Array.isArray(value) || value.length < 1 || value.length > 8
      || !value.every(r => r && /^[0-9a-f]{32}$/i.test(r.id) && Number.isSafeInteger(r.revision) && r.revision > 0)
      || new Set(value.map(r => r.id)).size !== value.length) return fail();
    return value;
  };
  if (!model || !Number.isSafeInteger(model.revision) || model.revision < 1 || model.revision > persona.revision) return fail();
  const nodes = refs(model.nodes), fragments = refs(model.fragments);
  if (nodes.length !== fragments.length) return fail();
  const parts = await Promise.all(nodes.map(async (node, i) => {
    const fragment = fragments[i];
    const [nodeValue, fragmentValue] = await Promise.all([node, fragment].map(ref => resourceRequest<unknown>('/records/' + ref.id, signal)));
    readMemoryDetail(nodeValue, { ...node, owner: persona.id, kind: 'memory_node', fragment });
    const record = readMemoryDetail(fragmentValue, { ...fragment, owner: persona.id, kind: 'fragment' });
    const value = data(record), content = value.draft?.content ?? value.content;
    if (typeof content !== 'string') return fail();
    return { node, fragment, content, title: String(value.draft?.title ?? value.title ?? 'Self-fragment') };
  }));
  const character = parts.map(p => p.content).join('\n\n');
  if (character !== d.character) return fail();
  return { revision: model.revision as number, character, parts };
}
