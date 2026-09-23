/** Pure form conversion. Numeric UI fields use the same integer units as the API. */
export function explorationLimits(form: Pick<FormData, 'get'>) {
  const integer = (name: string, label: string, max: number): number => {
    const raw = form.get(name);
    const value = typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    if (!Number.isSafeInteger(value) || value < 1 || value > max) {
      throw new Error(`${label} must be a whole number between 1 and ${max}.`);
    }
    return value;
  };
  return {
    calls_per_episode: integer('calls', 'Calls per episode', 1000),
    seconds_per_episode: integer('seconds', 'Seconds per episode', 604800),
    max_episodes: integer('episodes', 'Total episode allowance', 10000),
  };
}

/** Never replace an invalid stored expiry with a new grant or crash the form. */
export function localExpiry(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return '';
  const local = new Date(instant.getTime() - instant.getTimezoneOffset() * 60000);
  if (!Number.isFinite(local.getTime())) return '';
  // Retain seconds and milliseconds: opening the editor is not an expiry amendment.
  return local.toISOString().slice(0, -1);
}

// Comparing wall-clock components avoids interpreting an unchanged autumn DST
// overlap as an instruction to move the existing expiry to the other occurrence.
function localComponents(value: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  return match ? `${match[1]}:${match[2] ?? '00'}.${(match[3] ?? '').padEnd(3, '0')}` : undefined;
}

export function expiryInput(value: FormDataEntryValue | null, previous?: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Choose an explicit exploration expiry.');
  }
  const components = localComponents(value);
  if (!components) throw new Error('Choose a valid exploration expiry.');
  const preserved = localExpiry(previous);
  if (preserved && components === localComponents(preserved)) {
    // The runtime accepts finer RFC 3339 precision than JavaScript dates.
    // Preserve the exact stored permission when its displayed value is unchanged.
    return typeof previous === 'string' ? previous : new Date(previous as number).toISOString();
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime()) || localComponents(localExpiry(instant.getTime())) !== components) {
    throw new Error('Choose a valid exploration expiry in your local timezone.');
  }
  return instant.toISOString();
}
