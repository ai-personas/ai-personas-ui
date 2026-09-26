// Synthetic wire-shape fixture. This is neither private runtime data nor an
// executed backend response. Keep the schema distinct from the UI projection.
export const owner = 'a'.repeat(32), first = 'b'.repeat(32), second = 'c'.repeat(32), fragment = 'd'.repeat(32), later = 'e'.repeat(32);
export const card = (id, title, revision = 1) => ({
  node: { id, revision }, fragment: { id: fragment, revision: 1 },
  parent: null, child_count: 0, title, basis: 'tentative',
  locator: { description: 'Find a relevant method', parameters: [], script_available: true },
  short_description: 'I check the **published pair** before relying on it.',
});
export const edge = (source, target, origin = 'authored_related') => ({
  source: source.node, target: target.node, origin,
  mode: 'preview_only', applicability: 'not_evaluated',
});
export function page({ focus = null, after = 0, query = null, items = [], connections = [], next = null } = {}) {
  return {
    schema: 'memory-graph/1', owner, focus: focus?.node ?? null,
    branch: focus?.node.id ?? null, after, limit: 12, query,
    path: focus ? [focus] : [], related: [], items, connections, next,
    view: query ? 'search' : focus ? 'neighborhood' : 'all_owned',
    legacy_tree_fields: 'branch_is_focus_path_is_singleton_parent_and_child_count_are_placeholders',
    automatic_selection: false, requires_root: false, requires_functional_groups: false,
    search_semantics: 'all_case_insensitive_words_in_title_and_short_description',
  };
}
