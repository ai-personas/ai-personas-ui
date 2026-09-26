import { data, resourceRequest, type Entity, type Page } from './api';

export async function readRecallPolicy(persona: string, work: string, signal: AbortSignal): Promise<Entity | null> {
  let after = 0;
  for (;;) {
    const params = new URLSearchParams({ kind: 'recall_policy', scope: persona, owner: persona, after: String(after), limit: '24' });
    const page = await resourceRequest<Page<Entity>>('/records?' + params, signal);
    const matches = page.items.filter(record => data(record).work === work);
    if (matches.length > 1) throw new Error('Multiple recall permissions were returned for this work.');
    if (matches.length) {
      const policy = await resourceRequest<Entity>('/records/' + matches[0].id, signal);
      if (policy.id !== matches[0].id || policy.kind !== 'recall_policy' || policy.scope !== persona
        || data(policy).owner !== persona || data(policy).work !== work || !Number.isSafeInteger(policy.revision) || policy.revision < 1)
        throw new Error('The recall permission does not match this persona and work.');
      return policy;
    }
    if (page.next === null) return null;
    if (!Number.isSafeInteger(page.next) || page.next <= after) throw new Error('Recall permission pagination did not advance.');
    after = page.next;
  }
}
