# UI rewrite completion audit

The request was to rewrite an interface that was not sufficiently usable or useful.
The acceptance scope is the application interface across its existing public discovery,
persona, workspace/file, task, network, and node-connection workflows. The implementation
is delivered as a reviewable repository change; merging and deploying it were not requested.

| Requirement | Implementation and observed evidence |
| --- | --- |
| Replace the crowded single-screen interface with navigable workflows | `index.html`, `workspace-shell.mjs`, and `workspace.css` implement five named views, persistent navigation, responsive controls, and dedicated details. A live Chromium walkthrough opens every view and its related profile/workspace/connection actions. |
| Make browsing and finding records useful | Search includes verified persona descriptions, aliases, and authored introductions. Activity filters precede persona pagination. All views expose search. `workspace-browsing.test.mjs` reaches every one of 81 tasks, 101 requests, and 31 known nodes, including search and scope resets. |
| Preserve coherent state while live data changes | Hash routes restore search and activity settings; layout persists locally. Node, task, and request renders use the keyed DOM updater. Request disclosure identity includes the kernel and exact request ID. The browser regression checks refresh focus, navigation, Back, and keyboard expansion through the last task page. |
| Put useful work and outputs within reach | Public persona details initially show responses/work, with profile and learning tabs. Workspace details prioritize files, give an explicit empty-file state, and disclose measurements/verification on demand. Live inspection opens a published Markdown file and verifies its downloaded SHA-256 before rendering it. |
| Work on phones and support keyboard/assistive use | The browser regression passes 25 combinations of five views and 320–1440px widths, without horizontal overflow. Controls retain accessible names in compact layouts. Axe-core scans of the five live views and node-connection dialog report no WCAG 2 A/AA or WCAG 2.1 AA violations. Keyboard expansion retains focus and reaches newly added records. |
| Retain trustworthy data and resource lifetimes | The complete Node suite passes, including signature/permission, exact identity, route, record lifetime, and search-exclusion checks. Bitmap tests load the new styles and preserve uncropped images. The record-lifetime browser test covers paging and cleanup. No sample runtime data or private credentials are included in the site. |
| Provide a concrete result for review and local use | PR #37 carries the rewrite and regression tests. `README.md` and `WORKSPACE_UI.md` document navigation, limits, previewing, and test commands. A static HTTP server can serve the checkout directly; no build service is required. |

## Validation results

- `node --test test/*.test.mjs`: 366 tests passed.
- `node test/workspace-shell.browser.mjs`: 25 view/viewport cases passed, plus
  route/filter state and keyboard task expansion; no browser errors.
- `node test/bitmap-card-layout.browser.mjs`: six cases and 12 image checks passed.
- `node test/record-evidence-lifetime.browser.mjs`: four cases passed; browser closed.
- Live Chromium: all five views, search/activity filters, persona/workspace details,
  connection form, Escape/focus restoration, and verified file preview exercised.
- Axe-core: no violations in the six scanned live surfaces.

The browser fixtures are isolated tests of admitted-state presentation; they do not
bypass production verification or constitute evidence of every remote node's availability.
Live checks cover the reachable public node. Missing identity/profile/activity data stays
labelled as unavailable, and private access still requires a node token. Requests for input
remain read-only because the existing browser contract does not expose human submission.
