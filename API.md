# Generated HTTP contract

Contract: `ai-personas/1`

Default loopback listeners allow the same-origin local operator workspace without a token. Local writes include X-Personas-Client: workspace. The listener, actual peer, Host and browser Origin are checked; unrelated origins are rejected. Nonloopback listeners and --require-token require bearer authentication. Bearer-authenticated browser sessions can authorize file reads with an HttpOnly cookie. Local sessions issue no browser secret. Persona authority, information permissions and resource limits remain enforced independently. The node records its execution profile. Restricted execution requires scoped grants and enforced limits; the unrestricted compatibility profile requires explicit operator opt-in.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/records?kind=&scope=&owner=&query=&after=0&limit=40` | Bounded summaries, indexed text search, stable cursor and event watermark |
| GET | `/api/records/{id}` | Load one complete record; work activity and version assessments are separate facts |
| GET | `/api/records/{id}/revisions?after=0&limit=20` | Load a bounded page of preserved versions on demand |
| GET | `/api/actions?owner=&scope=&after=0&limit=20` | Load actions for a persona or run with a cursor |
| GET | `/api/actions/{id}` | Recorded action outcome, including tracked job reconciliation |
| GET | `/api/actions/{id}/output?offset=0&limit=32768` | Incremental tracked command output |
| GET | `/api/actions/{id}/output.bin` | Stream original command output bytes, with byte ranges |
| POST | `/api/operations` | Execute the typed Command in an Operation envelope; identical retries reuse results |
| GET | `/api/events?after=0` | Resumable lightweight change events; closing a view releases its observer |
| GET | `/api/artifacts/{id}` | Stream immutable files with byte ranges and browser-managed downloads |
| POST | `/api/uploads?id=&name=&media_type=&size=&digest=` | Stream a file with expected SHA-256 and size; retries preserve the upload identity |
| POST | `/api/session` | Connect the same-origin loopback workspace without a token; authenticated remote sessions authorize browser file reads |
| GET | `/api/calls/{id}/{part}` | Load preserved provider input, request, response or usage on demand |
| GET | `/api/models` | Provider-advertised models and capabilities |
| GET | `/api/network` | Current node and connected peers |
| GET | `/api/resources/{id}` | Current allowance, usage, reservations and uncertain exposure; no model call |
| GET | `/api/deployment` | Recorded execution profile and setup capabilities |
| GET | `/api/inference?refresh=false` | Cached available models and access-safe provider setup status; explicit refresh performs discovery, never inference |
| GET | `/api/curricula` | Optional ordinary starter environment briefs |
| GET | `/api/contract` | Generated operation, type and route contract |
| GET | `/api/release` | Matching runtime, design and UI revisions |

## Operations

Send an Operation with random 32-character hex `id`, `kind`, `actor`, `run` and typed `args`. The server assigns `source` to `api`; model actions carry their originating call identity. An identical retry returns the saved result, while a changed request with that identity is rejected.

### `deployment.read`

Inspect the recorded execution profile and disabled deployment extensions.

No arguments.

### `grant.issue`

Issue current authority with exact actor, work, effects, expiry and conserved operation ceilings.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `draft` | GrantDraft | Required |  |

### `grant.revoke`

Revoke this grant and all descendants; initiate stopping admitted affected jobs.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `reason` | string | Required |  |

### `resource.bounds.configure`

Install immutable measurable ceilings and documented model pricing on a local resource root.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `root` | string | Required |  |
| `revision` | integer | Required |  |
| `bounds` | Bounds | Required |  |

### `resource.bounds.reallocate`

Move unspent token/cost capacity between production and closeout without increasing either root ceiling.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `root` | string | Required |  |
| `revision` | integer | Required |  |
| `closeout_tokens` | integer | Required |  |
| `closeout_cost_units` | integer | Required |  |
| `reason` | string | Required |  |

### `information.policy`

Set named readers, export permission and optional access expiry. Source restrictions propagate to derivatives; erasure is an explicit disposition.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `subject` | string | Required |  |
| `revision` | integer | Required |  |
| `readers` | string[] | Required |  |
| `allow_export` | boolean | Required |  |
| `expires` | string or null | Optional |  |
| `reason` | string | Required |  |

### `information.withdraw`

Withdraw a source and its tracked derivatives from future use while preserving minimal accountability.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `subject` | string | Required |  |
| `revision` | integer | Required |  |
| `reason` | string | Required |  |

### `information.erase`

Erase the named payload, its record/action copies and identified call archives. Derivatives become unavailable and need their own retention disposition; outside copies and backups remain outside this operation.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `subject` | string | Required |  |
| `revision` | integer | Required |  |
| `reason` | string | Required |  |

### `context.discard`

Explicitly discard this run's active context and history window after a source disposition. The archive and obligations remain.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `revision` | integer | Required |  |
| `reason` | string | Required |  |

### `invitation.offer`

Offer an exact preview and currently permitted seeds for bounded orientation. This does not grant membership or responsibility.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `to` | string | Required |  |
| `preview` | string | Required |  |
| `seed` | VersionRef[] | Required |  |
| `orientation_calls` | integer | Required |  |

### `invitation.respond`

Accept or decline your exact invitation; commitment acceptance remains a separate operation.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `accept` | boolean | Required |  |
| `reason` | string | Required |  |

### `persona.retire`

Retire an identity, pause activity and retain explicit responsibility gaps until accepted handoff or authorized disposition.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `reason` | string | Required |  |

### `persona.activate`

Operator funds local activation of imported identity history. This does not claim exclusive cross-host activation.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `root` | string | Required |  |
| `reason` | string | Required |  |

### `capability.acquire`

Mark an owned capability available using an actual successful execution of its exact descriptor in this environment.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `check` | string | Required |  |
| `limitations` | string | Required |  |

### `capability.retire`

Withdraw a capability without erasing its earlier evidence or granting a replacement.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `reason` | string | Required |  |

### `effect.destination.configure`

Operator configures one exact idempotent HTTP destination and credential reference. No credential value is disclosed to personas.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `config` | Destination | Required |  |

### `effect.destination.revoke`

undefined

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `reason` | string | Required |  |

### `effect.dispatch`

Dispatch one bounded JSON request under a current grant. Unknown effects are never automatically retried.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `destination` | string | Required |  |
| `body` | JSON value | Required |  |

### `effect.reconcile`

Operator reconciles uncertainty using a preserved receipt naming the exact destination and idempotency key.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `action` | string | Required |  |
| `evidence` | VersionRef | Required |  |

### `artifact.capture`

Preserve completed owned job output as an immutable artifact; no arbitrary host path is opened.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `job` | string | Required |  |
| `name` | string | Required |  |
| `media_type` | string | Required |  |

### `resource.root.create`

Operator creates a finite shared allowance. Call and birth ceilings are conserved; this grants no host, external or financial permissions.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `limits` | Limits | Required |  |
| `closeout_calls` | integer | Required |  |
| `reason` | string | Required |  |

### `resource.bind`

Operator binds paused/unstarted legacy or imported work to local funding. An existing local binding cannot be replaced to reset expenditure.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `revision` | integer | Required |  |
| `root` | string | Required |  |
| `reason` | string | Required |  |

### `resource.closeout.assign`

Operator assigns protected capacity to a current accepted responsibility. Membership, a review request and an unaccepted offer are insufficient.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `run` | string | Required |  |
| `revision` | integer | Required |  |
| `commitment` | VersionRef | Required |  |
| `reason` | string | Required |  |

### `resource.reallocate`

Operator moves unspent capacity between production and closeout inside the unchanged total ceiling. Reservations and unknown exposure cannot be refunded.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `root` | string | Required |  |
| `revision` | integer | Required |  |
| `closeout_calls` | integer | Required |  |
| `reason` | string | Required |  |

### `resource.revoke`

Operator closes inference and birth authority and pauses affected decisions. Existing effects and late receipts remain; host-job stopping uses run.cancel/job.cancel.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `root` | string | Required |  |
| `revision` | integer | Required |  |
| `reason` | string | Required |  |

### `resource.usage.resolve`

Operator records observed usage for an uncertain attempt without refunding the call or altering the original provider receipt.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `charge` | string | Required |  |
| `revision` | integer | Required |  |
| `usage` | Usage | Required |  |
| `evidence` | string | Required |  |

### `resource.summary`

Read remaining production/closeout allowance, births, reservations and unknown usage without a model call. Only actors bound to this root can inspect it.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `root` | string | Required |  |

### `work.mandate.adopt`

Adopt a new immutable mandate using operator authority. Preserves the original brief and all earlier criteria; does not grant execution, spending or replication rights.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `revision` | integer | Required |  |
| `mandate` | Mandate | Required |  |

### `work.amend`

Operator amends the title and adopts an exact new mandate. Original instructions, prior criteria and historical evidence remain inspectable; stale decisions must observe the new scope.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `revision` | integer | Required |  |
| `title` | string | Required |  |
| `mandate` | Mandate | Required |  |

### `work.archive`

Operator cancels participation and outstanding responsibilities, and archives the work. History, charges, late receipts and unresolved effects remain. Erasing selected information payloads is a separate operation.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `revision` | integer | Required |  |
| `reason` | string | Required |  |

### `fragment.write`

Author owned retained learning with explicit applicability, limitations and exact provenance. Receiving material is not first-hand experience or measured learning.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `draft` | FragmentDraft | Required |  |

### `fragment.revise`

Create an immutable correction to an owned fragment. Earlier content remains inspectable and old active selections require explicit reselection.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `version` | VersionRef | Required |  |
| `draft` | FragmentDraft | Required |  |

### `perspective.write`

Author your own work-scoped agenda or directional relationship interpretation. No shared priority score or automatic role assignment is created.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `id` | string or null | Optional |  |
| `revision` | integer or null | Optional |  |
| `draft` | PerspectiveDraft | Required |  |

### `work.entry.append`

Append an attributed observation, improvement hypothesis, decision summary or conditional assumption to the unranked work board.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `draft` | EntryDraft | Required |  |

### `work.entry.dispose`

Dispose a proposal or assumption at an exact revision. Authorization for exploration is not confirmation; confirming an assumption requires operator authority and evidence.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `disposition` | EntryDisposition | Required |  |
| `reason` | string | Required |  |
| `evidence` | VersionRef[] | Required |  |

### `agreement.propose`

Propose exact working terms to named participants. Agreements never mint authority, budgets or another person's consent.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `terms` | string | Required |  |
| `parties` | string[] | Required |  |
| `supersedes` | VersionRef or null | Optional |  |

### `agreement.endorse`

Endorse or decline an exact agreement version as yourself; earlier endorsements cannot be inherited by revised terms.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `agreement` | VersionRef | Required |  |
| `accept` | boolean | Required |  |
| `reason` | string | Required |  |

### `commitment.offer`

Offer a responsibility against the adopted mandate. An offer, team membership and accepted ownership are different facts.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `draft` | CommitmentDraft | Required |  |

### `commitment.respond`

Accept or decline your exact offered responsibility. Nobody can accept on another persona's behalf.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `accept` | boolean | Required |  |
| `reason` | string | Required |  |

### `commitment.update`

Update an accepted responsibility. Final prerequisites need current qualifying closure; closure needs exact outcome evidence or a current explicit release.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `status` | CommitmentStatus | Required |  |
| `note` | string | Required |  |
| `evidence` | VersionRef[] | Required |  |

### `commitment.handoff.offer`

Offer a handoff while retaining current ownership until the successor explicitly responds to this revision.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `to` | string | Required |  |
| `reason` | string | Required |  |

### `commitment.handoff.respond`

Accept or decline an exact handoff as the named successor. Neither lease expiry nor a parent's statement substitutes for this consent.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `accept` | boolean | Required |  |
| `reason` | string | Required |  |

### `feedback.open`

Preserve actionable feedback on an exact work version. A known blocking finding survives message delivery, acknowledgement and compaction.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `subject` | VersionRef | Required |  |
| `commitment` | string or null | Optional |  |
| `blocking` | boolean | Required |  |
| `message` | string | Required |  |

### `feedback.dispose`

Propose a repair, dispute or escalation; only the finding author/principal can confirm repair. Deferral/waiver needs operator authority and remains historical.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `disposition` | FeedbackDisposition | Required |  |
| `reason` | string | Required |  |
| `evidence` | VersionRef[] | Required |  |

### `assembly.adopt`

Atomically adopt an exact submission/input/assumption vector under the mandate's narrow assembly delegation. Adoption is not validation or acceptance.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `revision` | integer | Required |  |
| `submission` | VersionRef | Required |  |
| `inputs` | VersionRef[] | Required |  |
| `assumptions` | VersionRef[] | Required |  |

### `evidence.bind`

Bind your actual accepted reviewer finding to its predeclared exact mandate/assembly and assessed outcomes. Old or failed checks cannot become a current pass.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `draft` | EvidenceDraft | Required |  |

### `release.commit`

Operator seals a current exact release, with explicit conditions or partial limitations. This is not outside professional certification or authorization for physical effects.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |
| `revision` | integer | Required |  |
| `draft` | ReleaseDraft | Required |  |

### `work.summary`

Read authoritative independent activity, ownership, adopted-outcome coverage, candidate, evidence, acceptance and outside-validation facts.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `work` | string | Required |  |

### `record.read`

Read a complete record by identity. For an action receipt use action.read.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |

### `action.read`

Read a preserved action and its result. Nested history lookups are represented by action references; the exact archived receipt also remains available at GET /api/actions/{id}.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |

### `record.list`

Discover a bounded page of record summaries. Use the returned cursor for the next page.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `kind` | string or null | Optional |  |
| `scope` | string or null | Optional |  |
| `owner` | string or null | Optional |  |
| `status` | string or null | Optional |  |
| `query` | string or null | Optional |  |
| `after` | integer or null | Optional |  |
| `limit` | integer or null | Optional |  |

### `history.read`

Retrieve a page of retained actions for your identity, including compacted history. Earlier retrieval results are referenced by action ID, preventing recursive copies; use action.read for one result.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `after` | integer or null | Optional |  |
| `limit` | integer or null | Optional |  |
| `run` | string or null | Optional |  |

### `artifact.inspect`

Verify preserved bytes and return the immutable path. Copy before editing.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |

### `image.observe`

Select a published PNG, JPEG, or WebP for visual input on subsequent model calls. No visual inspection is claimed before a capable model receives it.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `artifact` | string | Required |  |
| `purpose` | string | Required |  |

### `persona.create`

Create a fresh identity with unauthored character.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `provider` | string | Required |  |
| `model` | string | Required |  |
| `effort` | string or null | Optional |  |
| `resource_root` | string or null | Optional | Operator's explicit funding for a founder. Descendants inherit the caller's root and reserve initialization; they cannot choose a new allowance. |
| `need` | string or null | Optional |  |
| `seed` | array or null | Optional |  |

### `persona.update`

Author character, dispositions, affect and imagery. Explain changes and their evidence. Character shapes preferences, never factual accuracy or compliance with user instructions. Stale revisions preserve conflicts.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `revision` | integer | Required |  |
| `name` | string or null | Optional |  |
| `character` | string or null | Optional |  |
| `portrait` | string or null | Optional | Artifact ID returned by artifact.publish for your existing portrait file. Omit until published; an empty string clears it. Image descriptions and filesystem paths are not artifact IDs. |
| `ocean` | Ocean or null | Optional |  |
| `vad` | Vad or null | Optional |  |
| `attributes` | JSON value | Optional |  |
| `reason` | string or null | Optional |  |
| `evidence` | array or null | Optional |  |

### `environment.create`

Create a managed environment directory. Custom host paths require the explicit unrestricted test profile.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `directory` | string or null | Optional |  |

### `environment.update`

Author the environment name, description and published image reference.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `revision` | integer | Required |  |
| `name` | string or null | Optional |  |
| `description` | string or null | Optional |  |
| `image` | string or null | Optional | Artifact ID returned by artifact.publish for the existing environment image. Omit until published; an empty string clears it. Image descriptions and filesystem paths are not artifact IDs. |

### `work.create`

Create funded work and invite participants to bounded orientation. Restricted nodes require explicit membership consent before contribution; commitment consent remains separate.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `title` | string | Required |  |
| `brief` | string | Required |  |
| `environment` | string | Required |  |
| `personas` | string[] | Required |  |
| `mandate` | Mandate or null | Optional | Optional operator-authored initial scope, adopted atomically before invitations can run. |
| `resource_root` | string or null | Optional | Optional operator-selected shared allowance. Persona-created work inherits its controlling root automatically; descendants cannot escape it. |

### `run.resume`

Queue a run for continued decisions. A busy identity retains this request.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |

### `run.pause`

Pause decisions; tracked host jobs continue.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |

### `run.cancel`

Cancel decisions and tracked jobs without undoing prior effects.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |

### `exec`

Execute under the node's recorded profile and current grant. Restricted execution permits a shell builtin or exec of one program, read-only workspace/system files, no network or subprocesses, and finite CPU, memory, wall time and output. artifact.capture preserves output. The explicit unrestricted test profile retains shared-host execution. A launch ends this decision batch; observe its receipt before further work.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `command` | string | Required |  |
| `directory` | string or null | Optional |  |
| `background` | boolean or null | Optional |  |
| `capability` | VersionRef or null | Optional |  |

### `job.read`

Read incremental output and job outcome.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `offset` | integer or null | Optional |  |
| `limit` | integer or null | Optional |  |

### `job.cancel`

Cancel a tracked process group.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |

### `document.write`

Retain an immutable document version synchronously. The outer result.id is the exact version for submit.documents; result.data.document groups versions. args.id is that grouping for a later write; parents are prior version record IDs. The receipt is available in the next decision without waiting. Concurrent children are preserved.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string or null | Optional |  |
| `parents` | array or null | Optional |  |
| `title` | string | Required |  |
| `content` | string | Required |  |
| `environment` | string or null | Optional |  |

### `document.read`

Read an immutable version.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `version` | string | Required |  |

### `context.select`

Choose exact retained records and action results for future context. Replaces selection; originals remain discoverable. Images must be observation record IDs.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `records` | string[] | Required |  |
| `actions` | string[] | Required |  |

### `context.compact`

Replace active history in the referenced action's work run through that ID with your own account and selection. Other work histories and all originals remain retrievable. No imposed schedule.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `summary` | string | Required |  |
| `through` | string | Required |  |
| `records` | string[] | Required |  |
| `actions` | string[] | Required |  |

### `input.acknowledge`

Acknowledge delivered inputs using inputs.through after retaining or acting on them. Never discards originals.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `through` | integer | Required |  |

### `model.choose`

Choose an advertised provider and model for subsequent decisions.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `provider` | string | Required |  |
| `model` | string | Required |  |
| `effort` | string or null | Optional |  |

### `tool.register`

Retain an owned tool or skill and acquisition provenance. Registration never gates host execution.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `name` | string | Required |  |
| `command` | string | Required |  |
| `description` | string | Required |  |
| `acquisition` | string | Required |  |

### `message.send`

Deliver durable correspondence. General messages belong to the identity once; work defaults to the caller’s current work when present.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `to` | string | Required |  |
| `work` | string or null | Optional |  |
| `text` | string | Required |  |
| `environment` | string or null | Optional |  |

### `artifact.publish`

Preserve exact file bytes and digest.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `path` | string | Required |  |
| `name` | string or null | Optional |  |
| `media_type` | string or null | Optional |  |

### `submit`

Preserve exact evidence chosen by the persona. documents takes the outer document.write result.id, never result.data.document or the action request.id. A dependent submission is chosen in the next decision after inspecting the write receipt. This does not end ownership or declare acceptance.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `summary` | string | Required |  |
| `artifacts` | string[] | Required |  |
| `documents` | string[] | Required |  |

### `review.start`

Queue independent assessment of an exact version by a persona outside the contributor group, using the ordinary work engine.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `submission` | string | Required |  |
| `persona` | string | Required |  |
| `instructions` | string | Required |  |

### `assess`

Preserve assessment of this exact submission and deliver findings to its owner. Acceptance requires actual completed exec checks from this reviewer run. Explanations belong in findings.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `verdict` | Verdict | Required |  |
| `findings` | string | Required |  |
| `checks` | string[] | Required |  |

### `request.create`

Ask a human or external connection for facts, a decision, physical work or evidence. Give actionable instructions and evidence requirements. You retain ownership and assess replies.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `purpose` | string | Required |  |
| `instructions` | string | Required |  |
| `evidence_required` | string | Required |  |
| `artifacts` | string[] | Required |  |

### `request.respond`

Append a response and uploaded artifact references. Wakes the owner without implying success. Reuse the operation identity for retries.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `request` | string | Required |  |
| `text` | string | Required |  |
| `artifacts` | string[] | Required |  |

### `request.resolve`

Owner records how a request was satisfied, with evidence.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `request` | string | Required |  |
| `conclusion` | string | Required |  |
| `evidence` | string[] | Required |  |

### `request.cancel`

Owner or operator cancels an outstanding request with a reason.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `request` | string | Required |  |
| `reason` | string | Required |  |

### `wait`

End this decision and wait for new input. Optionally name an owned action request or transfer record in this run to observe its outcome without a lost wake. A transfer launch receipt is not transfer completion. Already completed synchronous results are in history; they need no wait. Retained outcomes do not repeatedly trigger inference. Work ownership and unmet obligations continue.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `reason` | string | Required |  |
| `condition` | WaitCondition or null | Optional |  |

### `network.read`

Read this node’s current peer identity, addresses and live connections.

No arguments.

### `peer.connect`

Connect and trust a libp2p peer for application exchanges.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `address` | string | Required |  |

### `transfer.start`

Start fetching exact bytes from a trusted peer with progress and integrity validation. The returned transfer record may still be running. When called for a work run, its completed, failed, cancelled or interrupted record is delivered as input and wakes waiting work. Completed records identify the verified received_artifact.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `peer` | string | Required |  |
| `artifact` | string | Required |  |
| `digest` | string | Required |  |
| `size` | integer | Required |  |
| `name` | string | Required |  |

### `transfer.cancel`

Cancel transfer and discard incomplete bytes.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |

### `peer.message`

Send a durable deduplicated message over libp2p.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `peer` | string | Required |  |
| `to` | string | Required |  |
| `text` | string | Required |  |

### `continuity.export`

Pause this persona and export its records, inbox, selected context and referenced files. Finish or cancel active host actions and peer transfers first; interrupted outcomes remain recorded.

No arguments.

### `continuity.import`

Operator imports a verified bundle as paused history, preserving conflicts. Imports do not create local resource authority and cannot replace funded persona birth.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `artifact` | string | Required |  |

### `continuity.handoff`

Explicitly route future inputs for this paused identity to a trusted destination peer after import. This is not distributed exclusivity.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `peer` | string | Required |  |

### `action.resolve`

Append evidence about an uncertain action without re-executing it. Unknown outcomes remain uncertain.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `id` | string | Required |  |
| `outcome` | Outcome2 | Required |  |
| `evidence` | string | Required |  |

The machine schema includes OCEAN ranges [0,1], VAD ranges [-1,1], nullable unauthored values and extensible attributes. Server validation applies the same Rust Command definition.
