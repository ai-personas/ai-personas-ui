# Fragment graph wire compatibility

The production graph reader consumes the `memory-graph/1` response, not the
former browser-only `focus_card` shape. It sends `branch` as the compatibility
wire name for focus. The focused card is resolved from `focus` and its exact
singleton `path`; these do not describe a tree or ancestor chain.

Cards and directed associations are previews. The reader validates the owner,
requested focus, cursor, query, schema, bounds and exact visible endpoint
versions. It neither fabricates missing endpoints nor interprets legacy parent
placeholders as hierarchy. Unsupported conditional or full-inclusion modes are
reported as contract errors rather than presented as implemented capabilities.

A refreshing or failed graph read withholds the previous snapshot, including
expanded details. This matters when an information-policy change invalidates a
previously displayed graph. Retry can restore a freshly validated page; an error
must not leave the old private material presented as current.

Only connections between the displayed fragments can appear on a page. Missing
edges on a partial page do not establish that the whole graph is disconnected.
Browsing does not activate prompts or demonstrate learning, character influence,
semantic recall, or improved work.

## Validation scope

The dependency-free projection tests run in the normal `npm test` command.
`npm run test:memory` uses synthetic wire-shaped pages and exercises the actual
production component in a browser, including focus navigation, on-demand detail,
access-error withholding, unsupported schemas, pagination and cleanup. The
workspace workflow now includes that browser command.

During this change, 24 projection tests passed locally. Strict TypeScript
checking of `src/memoryGraph.ts`, TS/TSX transpile-syntax checks, JavaScript syntax
checks and whitespace checks also passed. Full application type-checking,
building and browser execution were not run locally because the dependency
checkout is unavailable. Workflow results must be checked at the pushed commit.
These fixtures are not Rust integration or live persona-behavior evidence.
