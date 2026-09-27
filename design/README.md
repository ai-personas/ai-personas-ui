# Historical screen provenance

The standalone HTML/JavaScript prototype and its state, reference-screen and
Python browser suites have been retired. They exercised scripted persona and
work snapshots independently of the production UI and current fragment design.
The production Preact application in `src/` and its current browser suites are
the maintained implementation and UI verification path; see [development
instructions](../README.md#develop).

[Source image fingerprints](source-images.json) retain the original seven
user-supplied screens' filenames, dimensions, sizes and SHA-256 hashes. These
screens informed the palette and layout; they do not establish runtime behavior
or successful persona work.

The complete prototype, migration manifest and historical verification remain
in [Git history at 2666a020daca](https://github.com/ai-personas/ai-personas-ui/tree/2666a020daca15e9b234e48926199c2d8c19748c/design).
It was originally relocated from
`ai-personas-design@9b1fd0a82ee4c5c6eb6f87aac4f2f9495f14d41d`.

Current requirements are in the [design
handbook](https://github.com/ai-personas/ai-personas-design/tree/rewrite/design-first).
