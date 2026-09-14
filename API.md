# Generated HTTP contract

Contract: `design-first/1`

All `/api` routes require the node bearer token. Commands run directly on the host.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/snapshot` | Compact current records; document bodies and artifact bytes are omitted |
| GET | `/api/records/{id}` | Entity, preserved revisions, related records, and recorded actions |
| GET | `/api/actions/{id}` | Action identity and current result, including job reconciliation |
| GET | `/api/actions/{id}/output?offset=0&limit=32768` | Incremental tracked command output with a byte cursor |
| POST | `/api/operations` | Execute an Operation; repeating an identical identity returns its recorded result |
| GET | `/api/events?after=0` | Server-sent durable change notifications; disconnect releases the observer |
| GET | `/api/artifacts/{id}` | Stream verified immutable artifact bytes; client cancellation releases the file |
| GET | `/api/calls/{id}/{part}` | Load request.json, response.json, thread.json, provider.jsonl, provider.json or provider.stderr on demand |
| GET | `/api/models` | Discover provider-advertised models and capabilities |
| GET | `/api/network` | Current peer identity, addresses and connected peers |
| GET | `/api/contract` | Generated machine contract |
| GET | `/api/release` | Installed runtime revision and matching release manifest |

## Operations

Supply a new random 32-character hex `id`, a `kind`, `actor`, `run`, and `args` to `POST /api/operations`. A repeated identical identity returns its recorded result; a changed request is rejected.

- `record.read`: {id}: read current record metadata, including tools, peers, and submissions
- `artifact.inspect`: {id}: verify a preserved artifact digest and return its immutable file path for inspection or a working copy
- `persona.create`: {provider, model, effort?}: create a fresh identity with empty character and learning
- `persona.update`: {revision, name?, character?, portrait?, attributes?}: author your character; portrait is a published image artifact ID (empty clears it); stale revisions are retained as conflicts
- `environment.create`: {directory?}: create a shared environment; the path is an ordinary host directory
- `environment.update`: {id, revision, name?, description?, image?}: author an environment; image is a published image artifact ID (empty clears it)
- `work.create`: {title, brief, environment, personas: string[]}: create work and independent runs for its participants
- `run.resume`: {id}: continue a waiting or paused run
- `run.pause`: {id}: pause decisions; running host jobs continue
- `run.cancel`: {id}: stop decisions and cancel this run's tracked jobs
- `exec`: {command, directory?, background?}: run any host command; installers and unregistered tools work normally. Results include the first 32768 output bytes, total size and full output path. Use job.read with the returned offset for more
- `job.read`: {id, offset?, limit?}: read incremental output and the tracked job's current outcome
- `job.cancel`: {id}: cancel a tracked process group without undoing prior effects
- `document.write`: {id?, parents?: string[], title, content, environment?}: retain an immutable version. Returned record.id is the version; data.document is its logical grouping. To append, set id to that grouping and parents to prior version IDs. Concurrent children remain visible
- `document.read`: {version}: read a retained document version
- `context.select`: {versions: string[]}: choose retained document versions to include in subsequent model requests
- `context.compact`: {summary, through, versions: string[]}: replace active history through an action ID with your own account, preserving originals
- `model.choose`: {provider, model, effort?}: choose an advertised model for subsequent decisions
- `tool.register`: {name, command, description, acquisition}: record an owned tool or skill and its acquisition provenance; registration never gates execution
- `message.send`: {to, text, environment?}: deliver a durable message to a persona or environment
- `artifact.publish`: {path, name?, media_type?}: preserve exact file bytes and SHA-256 digest
- `submit`: {summary, artifacts: string[], documents: string[]}: submit immutable artifact record IDs and document version record IDs (not data.document grouping IDs)
- `review.start`: {submission, persona, instructions}: assess a submitted version using a different persona and the ordinary engine
- `assess`: {verdict: accepted|rejected|incomplete, findings, checks: string[]}: checks contains only bare completed exec action IDs from this reviewer run; put explanatory prose in findings. Preserve the reviewer's checks and verdict
- `wait`: {reason}: wait for user input or a message
- `peer.connect`: {address}: connect and trust this libp2p peer identity for application exchanges
- `transfer.start`: {peer, artifact, digest, size, name}: fetch immutable bytes from a trusted peer with progress and integrity checks
- `transfer.cancel`: {id}: cancel a transfer and discard the incomplete file
- `peer.message`: {peer, to, text}: send a durable, deduplicated message over libp2p
- `continuity.export`: {}: pause this persona's decisions and export its records and referenced artifacts
- `continuity.import`: {artifact}: import a verified continuity bundle as a paused identity, preserving conflicts
- `action.resolve`: {id, outcome, evidence}: append explicit evidence for an uncertain action; never re-execute it
