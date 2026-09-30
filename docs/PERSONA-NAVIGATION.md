# Persona navigation and fragment tree

## Recent personas

The Personas page places up to six recently opened personas above the full
collection. Recency means **opened in this UI connection**, not recently created,
updated, active, successful, or globally newest. The full collection keeps its
existing server search and pagination.

Only validated persona record IDs are retained in App-owned memory. Navigation
between pages preserves that order; reopening a persona moves it to the front.
Clear, disconnect, and reload remove the history. Nothing is written to browser
storage or the runtime. Each shortcut revalidates its record; loading, permission
revocation, deletion, or a mismatched response withholds old names and content.

## Fragment browsing

The existing `memory-graph/1` endpoint and strict decoder remain authoritative.
Tree is the default display in persona details and the Learning library; Cards
retains the existing multi-card reader. No backend contract, operation, selection,
functional group, or runtime root is introduced.

The tree is a finite, directed spanning forest of **the loaded page**. A current
focus becomes its browsing anchor. Otherwise zero-incoming nodes are displayed
first, followed by any unvisited cyclic or disconnected components, in wire order.
An authored edge is displayed once. Already expanded nodes become shared links;
ancestor/self references become cycle links. Relationship labels remain attached
to the original edge. Off-page or different-revision endpoints are never invented.
All original authored-connection explanations and recall conditions remain below
the browser. Browsing or expanding does not select model context or prove usefulness.

The left pane uses tree/treeitem semantics, roving focus, level and sibling metadata,
Arrow keys, Home/End, type-ahead, Space/Enter and sibling expansion with `*`.
Expand/collapse-all controls are also available. Selecting a tree row changes the
preview without fetching full fragment text; the existing explicit Read fragment
and retrieval-utility actions remain lazy. Narrow screens stack the tree and reader.
Search, pagination, owner changes and policy invalidations preserve the existing
withholding of stale or inaccessible snapshots.

## Checks

- `node --experimental-strip-types --test tests/persona-navigation.test.mjs`
  exercises the production projection and bounded recent-ID helper.
- `node tests/persona-navigation.browser.mjs` exercises production Preact
  components against synthetic wire fixtures, with desktop/mobile screenshots
  under `.qa/`. It covers keyboard focus, cycles/shared links, card fallback,
  search, pagination, recency, access revocation, disconnect, and cleanup.
- `npm run test:navigation` runs both. Existing CI runs these through `npm test`
  and `npm run test:memory`; the existing memory-card regression suite explicitly
  switches to Cards and retains its assertions.
- `npm run build` and the existing workspace/browser suites remain the production
  UI checks. These fixture tests are not Rust-runtime integration evidence.
