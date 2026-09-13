# Workspace interface

The application shell separates browsing from network diagnostics. Its navigation,
page headings, search, layouts, and mobile controls are implemented in
`assets/workspace-shell.mjs` and `assets/workspace.css`. The small
`assets/workspace-state.mjs` contains URL state and activity selection rules.
`index.html` remains directly deployable as a static site.

The discovery engine still owns signature verification, node authority, exact
workspace/file identity, authenticated connections, detail lifetimes, and live
updates. The existing `discovery.css` provides compatibility styling for specialized
record and artifact renderers; the workspace stylesheet defines the new shell,
roster cards, task lists, file lists, and detail presentation.

## Interaction behavior

- Five hash routes: `#overview`, `#personas`, `#workspaces`, `#work`, `#network`.
- Search is shared across views and stored as an encoded `q` fragment parameter.
  Node routing parameters in the URL query string remain intact.
- Persona activity filtering occurs before bounded pagination, so a working
  persona beyond the first page can still be found. An active call, a failed
  work step, and an absence of an active call remain distinct observations.
- Layout selection is remembered locally. Changes to live records preserve
  surviving DOM controls, focus, and verified portrait mounts.
- Tasks are collapsed on the overview and open on Current work. Searching also
  refreshes the task list. Missing results have an explicit reset action.
- Persona details initially show shared responses and work. Profile, education,
  and experience remain available on separate tabs with their existing lazy reads.
- Workspace files lead their section. Empty lists explain the missing data;
  incoming verified files replace that notice. Run measurements and technical
  metadata are expandable. The file controls still verify bytes on demand.
- The network map exposes an accessible group of interactive nodes. Navigation
  retains accessible names when tablet layouts hide visible text labels.
- Empty discovery states provide a connection action and expandable local setup
  help. No sample personas, workspaces, or task counts are shipped.

## Validation

```bash
node --test test/*.test.mjs
node test/workspace-shell.browser.mjs
node test/bitmap-card-layout.browser.mjs
node test/record-evidence-lifetime.browser.mjs
```

Browser scripts require Playwright and Chromium. Set `UI_BROWSER_MODULE` to an
installed Playwright module and `UI_BROWSER_EXECUTABLE` to an existing Chromium
binary when they are outside the usual module resolution or browser cache.

The shell browser test uses local renderer fixtures and blocks discovery. It checks
navigation, bookmark state, browser Back, live-refresh focus preservation, search
reset, layout selection, empty work, connection actions, and 25 view/viewport
combinations from 320 to 1440 pixels. The bitmap check loads both stylesheets and
verifies that square, portrait, and landscape images remain uncropped. The record
lifetime test covers paging and resource cleanup separately.

A read-only live Chromium walkthrough during development exercised public discovery,
all five views, persona and workspace drawers, filters, the connection form, Escape,
and focus restoration. Axe-core found no WCAG 2 A/AA or WCAG 2.1 AA violations in
the five live views and connection dialog after corrections. These observations
cover the reachable public node and records at the time of the run; they do not
establish availability of every federated node or private connection.
