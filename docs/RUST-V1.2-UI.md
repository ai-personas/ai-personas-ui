> Historical UI increment. For the current operator controls, runtime compatibility, and validation commands, see [the README](../README.md).

# Rust v1.2 UI: implementation and backend boundary

Target: `ai-personas-ui/rewrite/design-first`, base UI revision
`34c0a5a3b30a4f66e4b0a9b4e82f1a640bda24c5`. Runtime reference:
`ai-personas/rewrite/design-first` at `d3339d30fa883c21c7935a2d009e3a58f480a256`.
Design basis: supplied AI-PERSONAS-RUST-SPEC-v1.2, especially sections 6, 8, 14,
19 and corrections C01–C09. No Python runtime or current-main UI is used.

## Delivered views

Work opens a full-width workspace with Overview, Perspectives, Work & outcomes,
People & agreements, Artifacts & evidence, and Decisions & learning. Main
navigation separates Tools from Learning and places Network under Advanced.
Lists use compact rows. Character, proposals, offers, consent, experience,
historical verdicts and current applicability are separate facts.

All six views read bounded pages through the existing Rust `/api/records` API.
No fake endpoint, role roster or unimplemented mutation is sent. Existing
creation, run controls, messages, responses, uploads and review-start retain
v1 operations. The generated API.md, api.schema.json and contract.d.ts are not
hand-edited to pretend the proposed backend contract exists.

## Read-only adapters, not a Rust authoring contract

The workspace explicitly recognizes these proposed work-scoped record kinds
when the server returns them. Missing data remains missing.

| View | Kinds |
|---|---|
| Overview | continuation, budget, commitment, request, feedback, run |
| Perspectives | perspective, proposal, work_entry |
| Work & outcomes | outcome, commitment, assumption, iteration, interface |
| People & agreements | selected roster, membership, birth/birth_link/birth_proposal, agreement/working_agreement |
| Artifacts & evidence | submission, finding/assessment, release |
| Decisions & learning | decision/work_entry, fragment, document |

Presentation reads explicit author/owner, status, agenda/priorities/contribution,
exact references, terms, dissent, initialization/membership state, allowances and
limitations. These are UI field adapters, not backend guarantees. Exact record
inspection remains available when a bounded summary omits other fields.
Queries do not expand a missing work-scope result into private cross-work data.
Persona detail uses owner scope for persona-owned learning/tools. ACL enforcement
belongs to Rust; frontend filtering cannot establish confidentiality.

Current acceptance and required-outcome coverage stay **Not established** because
v1 supplies historical counts rather than an atomic scope-bound projection.
Finding applicability is labeled *reported*, defaults to `unverifiable`, and is
never promoted to whole-work acceptance. A stale finding retains its verdict.
Page counts are not a completeness or quality score.

Rust must still implement continuation acceptance, scope grants, bounded birth
and bootstrap consent, assumptions, accepted commitments, feedback disposition,
provisional interfaces/iterations, protected closeout and atomic release sealing.
Their controls must be generated from the future Rust contract, not invented as
untyped v1 writes. This commit does not implement or simulate those guarantees.

## Transport, privacy and lifecycle

The token stays in tab memory; legacy sessionStorage is removed on load. A UI
disconnect does not revoke the operator token or an existing HttpOnly file-session
cookie. This UI change does not sandbox the unsandboxed Rust v1 runtime.

Identical ambiguous retries reuse an exact saved envelope within the tab;
concurrent duplicate clicks share a request. Definite failures are surfaced.
Unknown outcomes retain the ID rather than becoming a replacement effect.
This is not exactly-once external execution. Reload loses the recovery map, so
inspect action receipts before resubmitting after a reload.

Stream retry includes initial session/watermark establishment. Parsing handles
LF/CRLF, bounds buffers, deduplicates numeric v1 cursors and releases readers.
409/410 triggers a resnapshot. Opaque access-scoped cursors require Rust support.
Resource hooks use current relevance predicates, subscribe before loading,
coalesce changes, abort on unmount and clear previous-work state. Search is
debounced and pages remain bounded. Missing old-event scope invalidates
conservatively instead of hiding changes.

Native dialog supplies top-layer modality, inert background, Escape and focus
return. Closing detail removes its nested lazy views and output polling.
Artifact preview separates connecting, receiving, verifying, preparing and ready.
It checks the exact byte length and SHA-256 before rendering; a mismatch fails.
Only small raster images render; text/HTML/SVG are escaped. Large/native files
use browser downloads, which are not claimed to have been client-verified by an
unloaded preview. Reads, readers and object URLs are disposed on close.

There is no v1 thumbnail endpoint. List portraits read metadata first and load
raster originals only up to 512 KB; otherwise they show an unavailable preview
and retain access to the original in details. Backend thumbnails/pixel-limit
validation remain backend work, not invented URL routes.

## Reproduction and evidence

Use Node 22 and the unchanged dependency lockfile:

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:workspace
```

Unit checks use Node's test runner/type stripping. Browser checks use the real
Preact/Vite UI with explicitly synthetic HTTP data. They cover the six views at
desktop/mobile sizes; qualified offers, assumptions and births; historical
assessment ambiguity; verified, tampered and native-file previews; keyboard
navigation, detail cleanup and absence of invented writes. Results/screenshots
are emitted under `.qa/` and uploaded by CI. No model or engineering claim follows
from these fixtures. Rust-backed campaigns retain their separate prerequisites.
