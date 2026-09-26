/** Validate lazy memory reads against the exact card that opened them. */
import type { Entity } from './api';
import type { MemoryRef } from './memoryGraph';

export type ReadState<T> = { value?: T; error: string; loading: boolean };
export type MemoryDetailRequest = {
  id: string;
  revision: number;
  owner: string;
  kind: 'fragment' | 'memory_node';
  fragment?: MemoryRef;
};
export type MemoryUtility = {
  description: string;
  script: string;
  parameters: { name: string; description: string }[];
};
export type MemoryUsage = {
  selected_participations: number;
  admitted_calls: number;
  recent_calls: string[];
};

const DETAIL_ERROR = 'The memory detail no longer matches this graph card. Refresh the graph before opening it again.';
function requireDetail(condition: unknown): asserts condition {
  if (!condition) throw new Error(DETAIL_ERROR);
}
function object(value: unknown): Record<string, unknown> {
  requireDetail(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function identity(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value);
}
function revision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** A retained transport snapshot is not a current authorized display. */
export function currentRead<T>(state: ReadState<unknown>, decode: (value: unknown) => T): ReadState<T> {
  if (state.loading) return { error: '', loading: true };
  if (state.error) return { error: state.error, loading: false };
  if (state.value === undefined) return { error: '', loading: true };
  try { return { value: decode(state.value), error: '', loading: false }; }
  catch (error) {
    return { error: error instanceof Error ? error.message : DETAIL_ERROR, loading: false };
  }
}

export function readMemoryDetail(value: unknown, expected: MemoryDetailRequest): Entity {
  requireDetail(identity(expected.id) && identity(expected.owner) && revision(expected.revision));
  const record = object(value), data = object(record.data);
  requireDetail(record.id === expected.id && record.revision === expected.revision && record.kind === expected.kind);
  requireDetail(data.owner === expected.owner && data.status === 'retained');
  requireDetail(data.erased !== true && data.discredited !== true);
  if (expected.kind === 'memory_node') {
    const binding = object(data.fragment);
    requireDetail(expected.fragment && identity(expected.fragment.id) && revision(expected.fragment.revision));
    requireDetail(binding.id === expected.fragment.id && binding.revision === expected.fragment.revision);
  }
  return value as Entity;
}

export function readMemoryUtility(value: unknown, expected: MemoryDetailRequest): MemoryUtility {
  requireDetail(expected.kind === 'memory_node');
  const record = readMemoryDetail(value, expected);
  const locator = object(object(record.data).locator);
  requireDetail(typeof locator.description === 'string' && typeof locator.script === 'string');
  requireDetail(Array.isArray(locator.parameters));
  const parameters = locator.parameters.map(value => {
    const parameter = object(value);
    requireDetail(typeof parameter.name === 'string' && typeof parameter.description === 'string');
    return { name: parameter.name, description: parameter.description };
  });
  return { description: locator.description, script: locator.script, parameters };
}

export function readMemoryUsage(value: unknown): MemoryUsage {
  const fail = () => { throw new Error('Usage evidence is incomplete or malformed.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const usage = value as Record<string, unknown>;
  const count = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  if (!count(usage.selected_participations) || !count(usage.admitted_calls)
    || !Array.isArray(usage.recent_calls) || usage.recent_calls.length > 12
    || !usage.recent_calls.every(identity) || new Set(usage.recent_calls).size !== usage.recent_calls.length
    || usage.recent_calls.length > usage.admitted_calls) return fail();
  return { selected_participations: usage.selected_participations, admitted_calls: usage.admitted_calls,
    recent_calls: [...usage.recent_calls] };
}
