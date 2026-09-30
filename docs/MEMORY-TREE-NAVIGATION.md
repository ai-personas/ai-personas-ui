# Fragment tree navigation details

The production `MemoryTree` keeps the existing page-local browsing projection and
server-backed learning search. It does not add a second search, change the graph
contract, fetch fragment bodies, or write to the runtime.

The navigator reports unique fragments separately from visible tree entries.
Shared and cycle links count as entries, not additional fragments. The selected
preview shows its current browsing path; ancestor buttons return keyboard focus
to the corresponding visible tree row. This path is not an authored hierarchy.

Collapsing a selected descendant shows its nearest visible ancestor, including in
a forest with several disconnected roots. Expanding again restores the original
selection unless the reader explicitly selects another entry in the meantime.

Type a title prefix to navigate visible entries. Repeated presses of the same
letter cycle through matches and wrap. Extending a prefix first checks the current
entry, so typing more letters does not skip a matching selection. Navigation keys
reset the 700 ms typeahead buffer; composition events are left to the input method.

## Verification

- `npm test` includes pure navigation regression tests.
- `npm run test:navigation` runs existing persona tests and the new component fixture.
- `npm run test:memory` includes the fixture in the existing GitHub Actions workflow.

The new browser fixture imports the production ESM component and styles. It checks
keyboard behavior, branch-preserving collapse, restored selection, breadcrumb
focus, counts, empty data, and horizontal overflow at 390 and 320 CSS pixels.
It writes `.qa/memory-tree-navigation-desktop.png` and
`.qa/memory-tree-navigation-mobile.png`, collected by the existing
`workspace-ui-fixture-evidence` artifact step.

These are synthetic production-component checks, not live runtime or Rust
integration results. Passing UI checks does not establish backend compatibility.
