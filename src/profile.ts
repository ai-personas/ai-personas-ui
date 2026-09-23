/** Form parsing only. The runtime contract owns validation and initialization. */
export const PROFILE_TRAITS = [
  ['ocean', 'openness', 'Openness', 0, 1],
  ['ocean', 'conscientiousness', 'Conscientiousness', 0, 1],
  ['ocean', 'extraversion', 'Extraversion', 0, 1],
  ['ocean', 'agreeableness', 'Agreeableness', 0, 1],
  ['ocean', 'neuroticism', 'Neuroticism', 0, 1],
  ['vad', 'valence', 'Valence', -1, 1],
  ['vad', 'arousal', 'Arousal', -1, 1],
  ['vad', 'dominance', 'Dominance', -1, 1],
] as const;

const object = (value: unknown): Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

/** Require the connected server's canonical capability, not a speculative UI type. */
export function supportsProfileCreation(value: unknown): boolean {
  const command = object(object(value).command);
  if (command['x-contract-version'] !== 'operations/2' || !Array.isArray(command.oneOf)) return false;
  const creation = command.oneOf.find((entry: unknown) => object(object(object(entry).properties).kind).const === 'persona.create');
  const args = object(object(object(object(creation).properties).args).properties);
  return Object.hasOwn(args, 'profile_seed') && Object.hasOwn(args, 'self_authorship');
}

export function profileCreation(form: FormData) {
  const profile_seed: { character?: string; ocean?: Record<string, number>; vad?: Record<string, number> } = {};
  const character = form.get('profile.character');
  if (character !== null && typeof character !== 'string') throw new Error('Character must be text.');
  if (typeof character === 'string' && character.length) profile_seed.character = character;
  for (const [group, key, label, low, high] of PROFILE_TRAITS) {
    const raw = form.get(`profile.${group}.${key}`);
    if (raw === null || typeof raw === 'string' && !raw.trim()) continue;
    if (typeof raw !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) throw new Error(`${label} must be a number or blank.`);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < low || value > high) throw new Error(`${label} must be between ${low} and ${high}.`);
    (profile_seed[group] ??= {})[key] = value;
  }
  // An unchecked checkbox is explicit false. Zero scores are never omissions.
  return { profile_seed, self_authorship: form.has('profile.self_authorship') };
}

/** Only an exact attributed revision can be labelled an operator edit. */
export function operatorProfileStamp(record: { id: string; revision: number; data: unknown }): boolean {
  const stamp = object(object(record.data).profile_revision);
  return stamp.revision === record.revision && stamp.author_kind === 'operator'
    && stamp.actor === '' && stamp.source === 'api' && stamp.run === ''
    && typeof stamp.operation === 'string' && /^[a-fA-F0-9]{32}$/.test(stamp.operation);
}
