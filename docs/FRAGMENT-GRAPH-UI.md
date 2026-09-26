# Fragment graph UI contract

The production reader consumes the current `memory-graph/1` response. It sends
`focus` to request a neighborhood and reads the exact `focus_card` directly.
There is no tree projection or compatibility path for older graph payloads.

The reader checks the requested owner, focus, cursor, query, page bounds and
exact visible endpoint versions. It displays directed associations and authored
conditional connections, including explanations, recall conditions, corrections,
prerequisites and the authored preview or full treatment. A plain association
and a conditional connection can share endpoints. Browsing does not evaluate
conditions or select full context: applicability remains `not_evaluated`.

A refreshing or failed graph read withholds the previous snapshot, including
expanded details. Retry restores only a freshly validated page. Missing edges
on a partial page do not establish that the whole graph is disconnected.

## Validation scope

`npm test` includes the graph projection checks. `npm run test:memory` checks
production components with synthetic current-contract pages, including focus,
conditional connections, on-demand details, access-error withholding, pagination
and cleanup. `npm run test:operator` also browses fragments and connections
created by a synthetic decision through the real Rust API, without mocked graph
responses or paid model calls. These checks do not establish behavioral benefit.

Tests that required a `branch` alias, singleton ancestor path, legacy parent
connections, or rejection of all conditional/full treatments have been removed
or replaced by current-contract checks. Runtime permission, accounting,
cancellation and recovery regressions remain relevant and are retained.

The Identity panel verifies the current self-model's exact node and fragment
versions before displaying its projected character, and can inspect each source.
An invalidated, inaccessible or mismatched source withholds that projection.
Profile edits keep their original revision and draft, with saving disabled after
an intervening change. Recall permission lookup follows all policy pages and
never interprets a failed later page as permission to create a new policy.

Persona avatars are optional presentation alongside creation. Identity shows
queued/running/unavailable/completed state, independent cancel/retry controls,
and the actual image-call receipt. Provider settings expose supported image
models independently of primary text models; image-only connections are allowed.
Funding can add their reviewed prices to an editable shared allowance. A missing
image connection or allowance leaves character readiness independent. Generated
portraits refer to preserved image artifacts and do not change self-fragments.
