import type { ApiTypes, Model } from './contract';

export const modelKey = (model: Model) => JSON.stringify([model.provider, model.id]);

export function primaryModels(models: Model[]) {
  return models.filter(model => {
    const operations = (model.capabilities as { inference?: { operations?: unknown } })?.inference?.operations;
    return Array.isArray(operations) && operations.includes('persona_decision');
  });
}

export function fundingModels(catalog?: ApiTypes['inference']) {
  const unique = new Map<string, Model>();
  for (const model of [...(catalog?.models || []), ...(catalog?.decision_models || [])]) {
    const key = modelKey(model);
    if (!unique.has(key)) unique.set(key, model);
  }
  return [...unique.values()];
}
