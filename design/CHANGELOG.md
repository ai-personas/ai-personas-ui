# Visual design update

## Seven-screen review and navigation follow-up

Based on design branch `52bdbfadc3dc77ce15e3cb376036c7293acad5da` and the same seven supplied PNGs. The existing screen implementation and canonical Rust v1.2 documents are preserved.

Added a responsive seven-screen reviewer with allowlisted local routes, original reference widths, one live preview frame at a time, and an explicit full-size link. Capture viewport dimensions are distinguished from original full-page image dimensions. The mobile request is directly addressable without introducing a general action dispatcher or external approval.

Fixed the Skip to content link: its `#main` fragment previously entered the hash router as an unknown page. It now moves focus without replacing the route. The request query only opens the existing information dialog, whose answer remains unresolved until assessed.

Added eleven reference-data tests and an HTTP-served browser harness for the seven screens, request semantics, keyboard skip behavior, iframe replacement, 266 px layout, missing assets and external-request rejection. The existing browser suite remains separate. CI now captures both suites' evidence; its run results, not this changelog, determine whether they pass on a given commit. No Rust or live persona behavior is claimed.

## Original scope

Based on design branch `899c63e8adf3442b40ad0d07b2303c003849a910`, the supplied FINAL/WORKSPACE screens and the Rust-only v1.2 design.

Added a responsive, dependency-free design fixture; mapped the screenshots to implementation guidance; preserved canonical status/consent/evidence distinctions; added pure state and browser interaction checks; and extended the existing documentation workflow with JavaScript syntax and fixture-state checks.

The canonical architecture, generated Rust v1 API, existing acceptance IDs, historical evidence and sibling runtime/UI implementations are unchanged. No provider credentials, external calls or new deployment configuration are introduced.

## Original review corrections

Initial browser checks found that adjacent filter text/counts lacked an accessible separating space and that native modal tab cycling could leave the document's active element outside the dialog. Both were corrected. The close-cleanup assertion was changed to wait for the native asynchronous close event rather than inspecting before the handler ran. Route focus no longer draws a decorative outline around the entire main region; interactive focus indicators remain. Long unbroken titles wrap, and local user drafts are no longer attributed to a persona.

Original verification is recorded in [verification.json](verification.json). The earlier checks did not establish production bugs; they concerned only this authored fixture.
