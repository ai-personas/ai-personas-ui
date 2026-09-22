# Archives and inference evidence

The production file viewer supports TAR, TAR.GZ and TGZ alongside ZIP. TAR
indexing streams headers and skips file bodies; GZIP is decompressed as a bounded
stream. A selected member is read separately, not eagerly mounted with every
other preview. Returning to a folder or closing the viewer cancels extraction
and releases preview URLs; unmounting terminates the archive worker.

The reader validates header checksums, end markers, GZIP integrity, UTF-8 names,
member sizes and path uniqueness. It rejects traversal, file/directory conflicts,
links, devices, sparse files, conflicting extended names and ambiguous PAX
metadata. Browser bounds are 128 MiB input, 512 MiB expanded scan, 10,000 members,
64 KiB per extended header, and a 30-second worker-operation deadline. Existing
per-format preview limits and nested-archive depth limits still apply. These are
browser working-set bounds, not storage limits or a guarantee of archive safety
in another application. TAR validation is not a CAD parser or reproduction check.

Call readers now distinguish recovery, discovery, active learning, pending
questions at admission, upper-bound exposure and measured provider usage. Only
recognized, coherent receipt shapes receive counts; missing or malformed fields
remain unknown. Pre-dispatch admission is not proof of model receipt,
understanding, application, causal benefit or work acceptance. Exact references
are fetched only after the user opens one, and the displayed referenced revision
is not represented as the current record's revision.

Content cards and readers label ordinary documents separately from retained
lesson fragments. Answered questions remain pending an explicit owner decision;
acknowledgement is not resolution and a participant report is not operator
consent. Feedback readers display the runtime's authored `message` field.

## Validation

`npm test` includes 18 TAR/GZIP and 12 evidence-projection regressions. Those 30
focused tests and a focused strict TypeScript check passed in the editing
session. This is not a full production build or runtime acceptance result.

`npm run test:reliability` exercises actual viewer components and the worker in
Chromium using synthetic files and receipts. It checks lazy extraction, inert SVG
preview, corrupt GZIP failure, cleanup, reference selection and learning labels.
The existing UI workflow runs this after installation and the production build.
The editing environment could not install the frontend dependencies, so the new
browser test and whole UI build require their own CI results. Fixtures contain
no private runtime source, model records, execution evidence or credentials.
