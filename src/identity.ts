import type { Entity } from './api';

/** These are the runtime's descriptor scales, not clinical measurements. */
export const TRAITS = [
  { group: 'ocean', key: 'openness', label: 'Openness', min: 0, max: 1, meaning: 'Receptiveness to ideas and exploration' },
  { group: 'ocean', key: 'conscientiousness', label: 'Conscientiousness', min: 0, max: 1, meaning: 'Preference for planning and follow-through' },
  { group: 'ocean', key: 'extraversion', label: 'Extraversion', min: 0, max: 1, meaning: 'Preference for outward engagement' },
  { group: 'ocean', key: 'agreeableness', label: 'Agreeableness', min: 0, max: 1, meaning: 'Preference for cooperative interaction' },
  { group: 'ocean', key: 'neuroticism', label: 'Neuroticism', min: 0, max: 1, meaning: 'Modeled sensitivity to stress or uncertainty' },
  { group: 'vad', key: 'valence', label: 'Valence', min: -1, max: 1, meaning: 'Modeled negative to positive affect' },
  { group: 'vad', key: 'arousal', label: 'Arousal', min: -1, max: 1, meaning: 'Modeled low to high activation' },
  { group: 'vad', key: 'dominance', label: 'Dominance', min: -1, max: 1, meaning: 'Modeled low to high sense of control; not authority' },
] as const;
export type Trait = typeof TRAITS[number];
export type TraitGroup = Trait['group'];
export type TraitReading = { state: 'authored'; value: number } | { state: 'missing' } | { state: 'invalid'; raw: unknown };
export type ProfileChange = { field: string; label: string; before: unknown; after: unknown };
export type RevisionEvidence = { id: string; revision?: number };

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function traitReading(data: unknown, trait: Trait): TraitReading {
  const raw = object(object(data)[trait.group])[trait.key];
  if (raw === undefined || raw === null) return { state: 'missing' };
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= trait.min && raw <= trait.max
    ? { state: 'authored', value: raw } : { state: 'invalid', raw };
}
export function traitPosition(value: number, trait: Trait): number {
  return 100 * (value - trait.min) / (trait.max - trait.min);
}
export function traitNumber(value: number): string {
  // No score conversion or percentage substitution. Keep small authored values visible.
  return String(Object.is(value, -0) ? 0 : value);
}
export function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Time not recorded';
  const time = new Date(value);
  return Number.isFinite(time.getTime()) ? time.toLocaleString() : 'Invalid recorded time';
}
export function recordID(value: unknown): value is string {
  return typeof value === 'string' && /^[a-fA-F0-9]{32}$/.test(value);
}
function canonical(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object') return '{' + Object.keys(object(value)).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(object(value)[key])).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
export function displayValue(value: unknown): string {
  if (value === undefined || value === null) return 'Not authored';
  if (value === '') return 'Cleared / empty';
  if (typeof value === 'number') return traitNumber(value);
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? 'Not recorded';
}

const PROFILE_FIELDS = [
  ['name', 'Display name'], ['character', 'Character'], ['portrait', 'Portrait artifact'],
  ['attributes', 'Interests and attributes'], ['provider', 'Inference provider'],
  ['model', 'Inference model'], ['effort', 'Inference effort'], ['lifecycle', 'Lifecycle'],
  ['milestones', 'Identity milestones'],
] as const;

/** Compare only identity fields. Never copy private carried context or source payloads. */
export function profileChanges(before: Entity | undefined, after: Entity): ProfileChange[] {
  const previous = object(before?.data), current = object(after.data), changes: ProfileChange[] = [];
  const add = (field: string, label: string, a: unknown, b: unknown) => {
    if (canonical(a) !== canonical(b)) changes.push({ field, label, before: a, after: b });
  };
  for (const [field, label] of PROFILE_FIELDS) add(field, label, previous[field], current[field]);
  for (const trait of TRAITS) add(`${trait.group}.${trait.key}`, `${trait.group.toUpperCase()} · ${trait.label}`,
    object(previous[trait.group])[trait.key], object(current[trait.group])[trait.key]);
  return changes;
}

/** An inherited stamp is not attribution for a later lifecycle/model revision. */
export function revisionAttribution(record: Entity): {
  recorded: boolean; actor?: string; operation?: string; source?: string; run?: string;
  reason?: string; evidence: RevisionEvidence[];
} {
  const d = object(record.data), stamp = object(d.profile_revision);
  const current = stamp.revision === record.revision && recordID(stamp.operation) && stamp.actor === record.id;
  if (!current) return { recorded: false, evidence: [] };
  const evidence: RevisionEvidence[] = [];
  for (const candidate of Array.isArray(stamp.evidence) ? stamp.evidence : []) {
    const ref = object(candidate);
    if (recordID(ref.id) && Number.isSafeInteger(ref.revision) && (ref.revision as number) > 0) {
      evidence.push({ id: ref.id, revision: ref.revision as number });
    }
  }
  return {
    recorded: true, actor: stamp.actor as string, operation: stamp.operation as string,
    source: typeof stamp.source === 'string' ? stamp.source : undefined,
    run: recordID(stamp.run) ? stamp.run : undefined,
    reason: typeof stamp.reason === 'string' && stamp.reason.trim() ? stamp.reason : undefined,
    evidence,
  };
}

/** Validate each server page before rendering or accepting its continuation cursor. */
export function validateRevisionPage(value: unknown, persona: string, after: number): {
  items: Entity[]; next: number | null;
} {
  const page = object(value);
  if (!Array.isArray(page.items) || page.items.length > 100) throw new Error('Invalid persona revision page');
  let previous = 0;
  for (const value of page.items) {
    const item = object(value);
    if (item.id !== persona || item.kind !== 'persona' || !Number.isSafeInteger(item.revision)
      || (item.revision as number) <= previous || !item.data || typeof item.data !== 'object' || Array.isArray(item.data)) {
      throw new Error('Persona history contains an invalid or out-of-order revision');
    }
    previous = item.revision as number;
  }
  if (page.next !== null && (!Number.isSafeInteger(page.next) || (page.next as number) <= after || !page.items.length)) {
    throw new Error('Persona history returned an invalid continuation cursor');
  }
  return { items: page.items as Entity[], next: page.next as number | null };
}

/** Break the line at missing/invalid values and at missing record revisions. */
export function traitSegments(records: Entity[], trait: Trait): { record: Entity; value: number; index: number }[][] {
  const segments: { record: Entity; value: number; index: number }[][] = [];
  let segment: { record: Entity; value: number; index: number }[] = [];
  records.forEach((record, index) => {
    const reading = traitReading(record.data, trait);
    const last = segment.at(-1);
    if (reading.state !== 'authored' || (last && last.record.revision + 1 !== record.revision)) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (reading.state === 'authored') segment.push({ record, value: reading.value, index });
  });
  if (segment.length) segments.push(segment);
  return segments;
}
