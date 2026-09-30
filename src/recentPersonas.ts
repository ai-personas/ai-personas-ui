/** Keep only valid IDs, most recently opened first. No names or content are cached. */
export const RECENT_PERSONA_LIMIT = 6;
export function rememberPersona(ids: readonly string[], id: string): string[] {
  if (!/^[0-9a-f]{32}$/i.test(id)) return [...ids];
  return [id, ...ids.filter(previous => previous !== id)].slice(0, RECENT_PERSONA_LIMIT);
}
