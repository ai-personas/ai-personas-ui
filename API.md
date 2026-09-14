# Generated HTTP contract

Contract: `ai-personas/1`

Application operations require the node bearer token. Browser file reads can use the session cookie established with bearer authentication. Commands execute on the shared host.

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
| POST | `/api/session` | Authorize browser file loading using a session cookie; other operations still require bearer authentication |
| GET | `/api/calls/{id}/{part}` | Load preserved provider input, request, response or usage on demand |
| GET | `/api/models` | Provider-advertised models and capabilities |
| GET | `/api/network` | Current node and connected peers |
| GET | `/api/curricula` | Optional ordinary starter environment briefs |
| GET | `/api/contract` | Generated operation, type and route contract |
| GET | `/api/release` | Matching runtime, design and UI revisions |

## Operations

Send an Operation with random 32-character hex `id`, `kind`, `actor`, `run` and typed `args`. The server assigns `source` to `api`; model actions carry their originating call identity. An identical retry returns the saved result, while a changed request with that identity is rejected.

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

Create an ordinary shared host directory.

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

Create work and queue participant decisions. Participants own continued work after submissions.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `title` | string | Required |  |
| `brief` | string | Required |  |
| `environment` | string | Required |  |
| `personas` | string[] | Required |  |

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

Run any host command, installer or tool in a fresh /bin/sh -c process. Invoke another installed interpreter explicitly when its syntax is needed; shell state does not persist between commands. Registration is optional. Foreground jobs complete before the next decision; background jobs return asynchronously. Full output remains available through job.read.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `command` | string | Required |  |
| `directory` | string or null | Optional |  |
| `background` | boolean or null | Optional |  |

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

Retain an immutable document version. id is the logical grouping; parents are prior version record IDs. Concurrent children are preserved.

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

Preserve an exact submitted version. This does not end work ownership or declare acceptance. artifacts and documents are immutable record IDs.

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

Wait for missing input, findings or pending job results. Work ownership continues.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `reason` | string | Required |  |

### `network.read`

Read this node’s current peer identity, addresses and live connections.

No arguments.

### `peer.connect`

Connect and trust a libp2p peer for application exchanges.

| Argument | Type | Presence | Meaning |
|---|---|---|---|
| `address` | string | Required |  |

### `transfer.start`

Fetch exact bytes from a trusted peer with progress and integrity validation.

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

Pause this persona and export its records, inbox, selected context and referenced files.

No arguments.

### `continuity.import`

Import a verified bundle as a paused identity, preserving conflicts.

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
| `outcome` | Outcome | Required |  |
| `evidence` | string | Required |  |

The machine schema includes OCEAN ranges [0,1], VAD ranges [-1,1], nullable unauthored values and extensible attributes. Server validation applies the same Rust Command definition.
