# Dialog usability

The shared production `src/Dialog.tsx` still uses the native HTML dialog for
modal focus, inert background content, nesting, and Escape. It now locks document
scrolling before paint and restores focus without scrolling the launching control
into a different position.

`src/dialog-scroll.ts` owns a reference-counted lock per document. Closing an
inner dialog must not unlock the workspace behind its parent. Cleanup is
idempotent, restores the original inline overflow values and priorities, and
preserves an existing classic scrollbar gutter where supported. It does not add
body padding or reset the page's scroll position. Unsupported scrollbar-gutter
styling does not prevent the lock from working.

`src/dialog.css` keeps direct form and reader headers visible while their panels
scroll. The opaque header has its own stacking layer, a divider, and close targets
of at least 44 by 44 CSS pixels. Existing drawer layouts and native dialog
semantics remain in place. There are no new dependencies, backend controls, API
contracts, or runtime writes.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run test:dialogs
```

For an interactive component fixture, run `npm run dev` and open
`/tests/dialog-fixture.html` on that server. The fixture imports the actual
production Dialog and production stylesheets. Its work, form, evidence, and
activity content are synthetic, and form submission only updates fixture state.

The ten Node checks cover nested/out-of-order release, duplicate cleanup,
independent documents, exact inline-style restoration, classic scrollbar space,
and missing window or computed scrollbar-gutter support.

The browser checks cover scroll and layout preservation, backdrop wheel input,
scrollable content beneath reachable headers, focus containment, nested Escape,
focus return, restored page scrolling, 390px and 320px screens, short landscape
screens, drawers, pre-existing styles, and unmounting nested dialogs. Evidence is
written to `.qa/dialogs/`, including desktop, scrolled desktop, mobile, narrow and
landscape screenshots plus `checks.json`.

The unit checks are included in `npm test`; the browser checks are included in
`npm run test:reliability`, which the existing workspace workflow runs and archives.

## Validation boundaries

Component fixtures are not Rust integration or acceptance of live work. During
this change, ten Node checks and twelve Chromium checks passed locally. The local
browser loaded the real transpiled production Dialog with Preact 10.27.0 and the
applicable existing CSS declarations in a self-contained, network-free fixture.
This was not a full Vite application build. The committed Vite fixture imports the
complete production base/workspace stylesheets; the full build and repository
regression suites are separate CI checks. No private runtime source or execution
data is used.
