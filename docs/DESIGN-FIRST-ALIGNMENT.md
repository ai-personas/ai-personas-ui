# Production UI / design-first alignment

This change updates `src/`, not the illustrative application under `design/`.
The reference fixtures remain independent and unchanged.

## Sources and scope

The normative experience is described in
[Human experience and society](https://github.com/ai-personas/ai-personas-design/blob/rewrite/design-first/design/07-experience-and-society.md):
Work, Personas, Environments, Learning, and Tools; attributable perspectives;
meaningful human decisions; accessible empty and failure states; and independent
activity, evidence, and acceptance. The relocated [visual reference](../design/README.md)
provides the sage palette, compact Work composition, persona cards, and request
banner. These are design references, not sample data to inject into production.

The Rust branch's authenticated session, bounded record reads, and existing UI
operations remain the integration boundary. No private Rust source, runtime
execution data, or new speculative command is copied into this repository.
Generated `API.md`, `api.schema.json`, and `src/contract.d.ts` are unchanged.
This is not a claim that the UI implements every newer runtime authoring contract.

## Changes

- A responsive navigation shell, local decorative line icons, breadcrumb,
  route-preserving skip link, visible mobile disconnect control, and reference
  typography/spacing. No external fonts, images, or additional packages.
- Work rows separate the original need, execution activity, selected participants,
  and preserved submissions. Active / Needs input filters use explicit numeric
  fields and are visibly limited to the loaded page. Historical review counts
  never establish activity, completion, or acceptance.
- Persona cards emphasize authored character. Model details are secondary;
  absent portraits remain explicitly labeled placeholders, not generated images.
- A request inbox exposes failures, retries, all records on its current page,
  and subsequent pages. Replying is not presented as resolution or approval.
- Search and every collection have specific, actionable empty states. Failed
  reads are not empty installations. Resource retries retain only the same
  resource's snapshot and dispose the previous observer/request.
- A node token must pass the existing authenticated `/api/session` route before
  the workspace opens. Failed or cancelled connection attempts remain recoverable.
  The token remains memory-only. Disconnecting the view does not revoke the token,
  clear the node's HttpOnly file cookie, or stop node execution.
- Existing six-section workspaces, detail dialogs, operation envelopes, artifact
  verification, and cancellation semantics remain intact.

## Verification

Use Node 22 with the unchanged dependency lockfile:

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:workspace
```

`npm test` includes pure presentation checks for navigation, missing/malformed
counts, and non-inference of activity from historical acceptance.
`npm run test:workspace` runs the existing six-section workspace/verified-artifact
suite, followed by the new production-shell browser checks at 1440, 390, and
320 pixel widths. The latter covers invalid authentication, request failures,
pagination/disclosure, bounded filters, search reset/focus, resource retry,
route-preserving keyboard access, persona placeholders, empty collections,
mobile overflow, and absence of invented writes.

Screenshots and machine-readable results are emitted to `.qa/` and collected by
the existing read-only GitHub Actions workflow. Browser data is explicitly
synthetic. These checks are separate from the unmodified `design/` fixture suites
and from Rust-backed/live integration; they do not establish runtime behavior,
full accessibility conformance, or pixel-identical reproduction of source images.
