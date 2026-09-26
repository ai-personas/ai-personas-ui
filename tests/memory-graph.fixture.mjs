// Synthetic wire-shape fixture. This is neither private runtime data nor an
// executed backend response. Keep the schema distinct from the UI projection.
export const owner = 'a'.repeat(32), first = 'b'.repeat(32), second = 'c'.repeat(32), fragment = 'd'.repeat(32), later = 'e'.repeat(32);
export const card = (id, title, revision = 1) => ({
  node: { id, revision }, fragment: { id: fragment, revision: 1 },
  title, basis: 'tentative',
  locator: { description: 'Find a relevant method', parameters: [], script_available: true },
  short_description: 'I check the **published pair** before relying on it.',
});
export const edge = (source, target) => ({
  source: source.node, target: target.node, origin: 'authored_related',
  mode: 'preview_only', applicability: 'not_evaluated',
});
export const conditional = (source, target, overrides = {}) => ({
  source: source.node, target: target.node, origin: 'authored_condition',
  mode: 'full', applicability: 'not_evaluated', relation: 'correction',
  explanation: 'Retain the **required correction** with this method.',
  condition: { kind: 'always' }, work: null, expires: null, ...overrides,
});
export function page({ focus = null, after = 0, query = null, items = [], connections = [], next = null } = {}) {
  return {
    schema: 'memory-graph/1', owner, focus: focus?.node ?? null,
    focus_card: focus, after, limit: 12, query, items, connections, next,
    view: query ? 'search' : focus ? 'neighborhood' : 'all_owned',
    automatic_selection: false, requires_root: false, requires_functional_groups: false,
    search_semantics: 'all_case_insensitive_words_in_title_and_short_description',
  };
}
