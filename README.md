# ai-personas-ui — discover & explore PersonaOS personas across the global network

A static web portal to **discover and explore PersonaOS personas**, their environments,
missions, artifacts, and telemetry across a P2P network. For first contact, the bare hosted shell
joins the shared public Kademlia plane through a small, replaceable set of public libp2p bootstrap
peers and direct HTTPS peer routes. It resolves signed discovery records from the nodes the browser can reach and
verifies those records with Ed25519 in-browser. Live execution and
workspace snapshot and terminal-event signatures are separately **checked against the kernel key**;
raw operator `/status` runtime observations remain explicitly labelled as unsigned transport data.

## Realtime discovery — the page ships **no** data

This repository is a **pure shell**: `index.html`, `assets/`, and `robots.txt`. It
contains **no run data at all**. Every persona, environment, project, artifact, telemetry span,
and refinement mission is discovered at runtime from live nodes. First contact is merged from:

- the page origin when a PersonaOS node serves this shell;
- bounded localhost probes for a node running on the viewer's machine;
- the shared IPFS rendezvous CID and signed IPNS node cards, only when the viewer supplies
  `?ipfs_routing=<url>` and `?ipfs_gw=<url>` commons;
- the shipped replaceable peer commons: HTTPS `.well-known` routes and public-DHT bootstrap peers,
  plus libp2p bootstrap/relay multiaddrs from reached nodes or explicit `?bootstrap=` / `?relay=`;
- any optional, additive `?resolver=<https-url>` supplied explicitly by the viewer.

Resolver responses are signed announcements and locators only; custom resolvers receive no authority
over the records or identities they point to. The bare portal has no default resolver or PersonaOS
data service. Use `?no_global_discovery=1` to ignore even an explicitly supplied resolver. Discovery
records are re-resolved and re-verified every 15 seconds. If no first-contact path finds a reachable
node, the page shows an explicit empty state. The hosted URL never needs or interprets a
peer-routing query parameter.

**Mixed-content note.** A page served over **`https://`** cannot `fetch()` an **`http://` LAN
IP** (browsers block mixed content). A same-origin, node-served shell is available only when the
node was started with both `--ui-shell-dir` and `--ui-shell-manifest-sha256`; otherwise use the
hosted portal or the node API directly. For the **internet**, expose the node API through HTTPS
and its libp2p WebSocket listener through WSS, then advertise that WSS hostname. In every case
trust is the **Ed25519 signature on each record, not the host**.

## P2P discovery - how it finds things (no trusted central registry)

Discovery is **signed + content-addressed** (09_PROTOCOLS §3G/§3H). For
every node it knows or is told about, the page:

1. **bootstraps** from that node's `.well-known/personaos-discovery.json`;
2. resolves the current, expiring, current-master-signed `dht-provider-index/3` generation from
   `discovery/providers.json`; its hash-chained manifest binds every record id, exact canonical
   document hash, URL leaf, ProviderRecord generation, and manifest hash, and the browser rehydrates
   each pair in memory without dereferencing its mutable `record_url`;
3. **verifies each rehydrated ProviderRecord+document pair, then the record and AccessPolicy Ed25519
   signatures** against the owning kernel's current published master key (in-browser, via vendored
   [`noble-ed25519`](https://github.com/paulmillr/noble-ed25519)). An unsigned, stale-key, forged,
   policy-mismatched, or hash-mismatched record is dropped.

Planes (09_PROTOCOLS §3G.2): **internet** = `.well-known` + gossip + Kademlia DHT; **intranet** =
mDNS at the kernel, plus direct/local routes the browser can use. Records are access-gated
(`discover < read < write < admin`); a private record must not enumerate to an unauthorised peer.

**Real libp2p P2P in the browser.** The page boots a vendored **js-libp2p** node
(`assets/p2p-libp2p.js`: WebRTC + circuit-relay + gossipsub + a Kademlia client). It gossips
signed records on `personaos/discovery/v1` without trusting their unsigned outer locator metadata.
For each DID/hash key, it finds providers in the DHT, requests the signed envelope and exact record
over `/personaos/provider-record/1.0.0`, verifies the ProviderRecord against the sole current master,
then verifies the hash-bound document against its current, previous, or archived registry generation.
The same peer serves bounded public JSON and SHA-256-addressed byte chunks over
`/personaos/public-data/1.0.0`: the browser can reconcile the complete signed inventory, poll signed
telemetry/cognition, and fetch verified artifact bytes without following the HTTPS locator. Unsigned
bootstrap/key documents are admitted on this path only when their kernel/current master exactly match
the already verified self-certifying ProviderRecord. When an explicit or node-advertised bootstrap/relay is configured,
the browser finds PersonaOS nodes through rolling 15-minute v2 rendezvous content keys in that peer's
Kademlia routing table. A publisher provides only the current epoch; a browser queries the current,
previous, and next epochs so a boundary or modest clock skew does not hide a live node. The retired
fixed v1 key is not queried. With no connected bootstrap/relay there is no shared DHT to query, and
the UI does not claim otherwise.

Raw gossip is **lookup-only**: a record's embedded key, label, base, links, and policy never enter
the UI directly. The browser extracts at most five bounded content-hash/DID/global-handle/handle/id
aliases and rate-limits their DHT queries. A resolved ProviderRecord/document pair must pass its
current-master, document-hash, record-signature, policy, subject, scope, and host checks, then match
the record id, document hash, generation, and manifest hash in that kernel's current complete v3
inventory before it can refresh displayed state. A standalone lookup result cannot outlive or
bypass an inventory omission.

Public visibility grants strangers **discover**, not read. A matching, unexpired public `r`/`rw`/
`admin` grant whose optional scope matches the signed policy subject is required before an anonymous
publisher may send record links, content hashes, locators, interfaces, or read-gated descriptions.
Discover-only HTTP, gossip, and provider-protocol payloads are kernel-signed minimal projections;
the full signed record remains on the authenticated read path. The UI independently enforces the
same rule as defense in depth and labels the row discover-only. General record signatures may verify
against current, previous, or archived registry entries; live frames and ProviderRecords remain
current-kernel-master-only.

**The portal is generic + federated.** A reached node may list its own `federated_kernels` and
peers; public nodes normally publish through libp2p, and any kernel may additionally be announced
through an explicit resolver or IPFS. Every route
enters the same record-resolution and signature check.

**The network view is hierarchical and bounded.** Global mode renders an activity-prioritised
window of at most six kernel cores and ten navigator chips, with explicit “shown of total” and
aggregated-overflow counts. Selecting a kernel drills into that node's personas and environments:
the graph shows at most 36 prioritised personas, while the accessible stage starts with one flat
twelve-persona deck plus a compact ten-environment workspace index and expands through search or
**SHOW MORE**. Personas are never nested under environments; each card names the exact environments
whose roster or live telemetry associates it with them.
Environment records render as their own collectible workspace cards with stable identity sigils,
live people/signal/file facts, environment-owned outputs, and a compact avatar constellation. Each
constellation node reuses the exact persona-signed raster verifier; animated directional edges and
the in-card communication ticker appear only for observed actor→persona-endpoint frames in that
exact environment. A verified environment with no observed roster still renders as an explicit
empty card rather than disappearing or fabricating members.
Dense graph windows keep only about ten evenly spaced labels plus every active, recent, or followed
persona labelled; every other exact node remains keyboard-focusable with its full tooltip, avoiding
an unreadable text cloud without dropping identities.
The monitoring window normally polls at most twelve bases; focused and actively-running routes
are mandatory and may expand it only up to an explicit 64-base safety ceiling, rather than
starting a poll loop for every discovered node.

Discovery caches are likewise capped at 4,096 kernels and 20,000 kernel-qualified records;
presence and event history use bounded leases and rings. A large resolver should honour `limit`,
opaque `cursor`, optional `q`/`status`, and return an aggregate `total` (also accepted as
`total_count` or `node_count`). The browser traverses at most four 128-node pages per refresh and
sends global search to the resolver, then reports the aggregate while retaining only its bounded
verified window. A directory can therefore describe millions of nodes without creating millions
of DOM nodes, live connections, or ambiguous short-ID keys. Unpaged whole-list responses are
rejected rather than interpreted.

**Honest transport note (§3H.3).** The libp2p node is real and runs in your browser, but a
browser can't accept inbound connections or multicast, so to actually **reach other machines** it
needs a **relay / bootstrap peer** to dial through. Offline artifact availability similarly needs
a willing replica or pin provider. These are optional, replaceable **commons**, not a trusted
central index, but they are still infrastructure. Without bootstrap/relay/rendezvous or a direct
peer URL, unrelated browsers cannot discover each other through NAT; without replication/pinning,
an offline origin's bytes are unavailable. Trust still comes from signatures and content hashes,
not from the commons carrying them. Mixed node bootstrap documents are split at the browser
boundary: HTTPS values remain federation routes, while only bounded `/...` multiaddrs reach
js-libp2p bootstrap discovery, so one HTTP peer cannot abort valid P2P dialing.
The static transport commons lists four geographically distinct public libp2p WSS bootstrap peers
and uses the shared public DHT. Short-lived node/tunnel routes are deliberately not committed to
the static portal: an online publisher announces its current signed route through the DHT, gossip,
or another reached node instead. The bootstrap peers carry location only: no peer hint can admit a
node or data without the current-master, signed-inventory, access-policy, and content-hash checks.
For each rolling rendezvous bucket, the browser first asks each bounded, connected DHT first-contact
peer for its local provider view and merges only entries that still carry a route. This prevents one
fast response full of expired, addressless provider IDs from consuming the Kademlia result bound
before another peer's live WSS provider is observed. The direct request is only an optimization: if
none of its routes verifies, the browser always performs normal iterative Kademlia provider discovery
for that bucket. It tries a bounded set of advertised routes per provider and remembers attempts by
PeerId plus multiaddr, so one dead tunnel does not suppress a replacement route for the same node.
Bootstrap answers remain untrusted routing hints until the same signed inventory and content
verification succeeds.
Operators and viewers may add other peers with node announcements, `?relay=`, or `?bootstrap=`;
no default relay or PersonaOS data server is required.

**Tasks are visible from their signed public record at intake.** Every verified `task`, `project`,
or `mission` record is published evidence using only its bounded signed label and optional run DID;
open persona-authored capability vocabulary never decides whether it exists. A task additionally
requires the exact kernel-signed `personaos-public-task-lifecycle/2` projection. Its run, task,
signed `current_execution` boolean, environment, immediate resume/continuation/amendment parents,
lineage root, state, evidence surfaces, terminal reason, and revision are content-hash bound. The
structural identifiers, boolean, state, and revision are each repeated once in the signed capability
summary, including `task_current_execution:true|false` and explicit empty-parent bindings. Only
`current_execution: true` together with the exact lifecycle state `running` or `live` makes that run
current work. Resume, continuation, and amendment records remain visible as separate lineage/history
cards; their labels, wording, similarity, arrival order, and stale status observations never promote
them into the current-work headline. Unsigned telemetry and operator-only run state remain additive,
visibly distinct sources.

**Persona avatars are persona-signed, content-addressed raster identity.** An admitted avatar uses
the `persona-avatar/2` contract from an Ed25519-verified public persona record. The browser verifies
the descriptor's persona signature, resolves only its exact provider-relative content-addressed
path, rejects redirects, and checks raster MIME, byte length, SHA-256, and dimensions before
rendering the bytes through a temporary blob URL. A verified lifecycle shell is rendered immediately
as an independently materializing persona; its persona-authored name, characteristics, and avatar
may become materialized independently, and a verified adopted name does not falsely promote the
remaining identity fields. Every card immediately renders a deterministic local monogram derived
from its verified identity key and name. That instant local avatar is a presentation fallback, not
persona-authored identity evidence; an optional verified persona-authored raster replaces it only
after the existing signature and byte checks pass. An avatar descriptor never creates another
persona or projection card. The top status/control header is
independently collapsible and consumes zero layout height while closed.

**Public persona activity is a closed signed projection.** Anonymous aggregate telemetry and each
persona/environment feed must use their exact public schemas, bind the current node id, be fresh,
and verify under the sole current kernel master. Public communication topology admits only exact,
independently signed direct or broadcast route metadata. A persona card's public activity stream
comes only from the exact whole-document-signed `personaos-persona-public-cognition/1` endpoint for
that current-inventory persona. It renders bounded active calls, outputs/messages, learned state,
proven facts, and evolution entries without inferring content type or relabelling communication
kinds; addressed messages retain their verified recipient count. A wrong author/subject, extra field,
invalid nested shape, stale document, or changed byte is rejected. Private thinking frames remain
available only through the bearer-gated operator schema. Anonymous cognition refresh remains bounded
GET-only polling; viewing this surface cannot submit persona actions.

## Realtime execution and live workspace files

For each active run, the UI consumes `GET /runs/<run>/live-artifacts` and, for public streams,
the SSE event `live_artifact_update`. A 3-second poll is the fallback when EventSource is
buffered or blocked and is the primary path when an operator token is required.
An anonymous page also seeds this poll from an exact run bound by a browser-verified public task
DID in the node's current hash-chained provider inventory. The inventory supplies the matching
bootstrapped API base; links, labels, cached gossip, and unsigned status cannot create the join.
The browser requires that signed inventory's verified expiry to remain live, keeps exact signed
terminal and superseded lineage as history, prioritises exact signed current-execution
`running`/`live` task evidence over published history, retains at most
48 node/run pairs, rechecks inventory authority on every anonymous cycle, and exponentially backs
off empty endpoints.
The UI keeps a separate ordered revision map per `(node base, run)`, compares complete snapshots,
and shows created, modified, and deleted files grouped by persona workspace. Poll responses carry
request generations and their starting revision; an SSE `previous_revision` must extend the
admitted snapshot chain. Stale responses are discarded, `run_ended` makes the last revision terminal, and
body-cache writes are refused if the open file advanced while bytes were in flight. A signature-checked
terminal event overrides lagging unsigned run status, clears the ended call/workspace liveness,
prevents that exact call ID from being resurrected by a stale frame, and removes stale running
mission cards. Files in the immutable final revision remain inspectable: a request begun before the
terminal transition is discarded, while one begun from the final revision must still match the
same signed revision, file path, and SHA-256 before it can render.

Before any snapshot or terminal event enters that revision map, the browser verifies the metadata
signature against the node kernel key, verifies the nested signed `access-policy/1`, and binds its
policy ref, subject, node, run, revision, and visibility tier. An SSE update must have a valid
signed wrapper and a separately valid signed snapshot. Anonymous streams additionally require a
signed, unexpired public read grant whose scope is empty or exactly matches the artifact subject.
Live verification selects only the current `kernel-master` entry with role `master` and refreshes
the key registry once after a verification failure so an in-flight browser follows key rotation.
Unsigned, tampered, cross-run, incorrectly tiered, and policy-mismatched frames fail closed.
These snapshots describe provisional workspace files, not an `ArtifactBundle` lifecycle state.
Lifecycle remains unknown until a separately validated bundle and its hash-bound verifier evidence
are available.

Live files are clickable. The browser fetches their body URL with bearer authentication in the
request header, never in the URL, and computes SHA-256 before passing bytes to any renderer.
Downloads use the same check, then create a short-lived `application/octet-stream` attachment;
there is no authenticated "open raw" navigation surface.
Non-live manifest files that advertise a SHA-256 use the same fail-closed byte check before any
repository renderer receives them; un-hashed content is labelled as such rather than “verified.”
Declared Markdown, text, JSON, and tabular media retain one prior signature-checked revision and
show a bounded line diff when an open file changes. Rich presentation is selected only from the
media type declared in the admitted signed record or live snapshot; filenames and domain words in
the bytes never control dispatch. The built-in generic Web-media families cover Markdown, tabular
text, JSON, plain text, images, audio/video controls, and PDF. Undeclared, invalid, and custom media
never produces a blank viewer: hash-checked UTF-8 bytes get a bounded plain-text view and opaque
bytes get byte metadata plus a bounded hex preview and safe download. Executable peer content is
never run, and the credential-bearing page imports no executable peer or CDN modules. Client
limits cap snapshots at 2 MiB, workspaces at 64, active
calls at 64, files at 256, paths at 16 levels/512 characters, rendered bodies at 8 MiB, and
downloads at 32 MiB.

The distinction is intentional:

- **signed discovery record**: Ed25519 verified in-browser;
- **signed public telemetry/message document or route**: shown as signed only after its exact schema,
  bindings, and whole-document signature pass the browser verifier;
- **signed lineage event**: retains its signed provenance inside an admitted signed feed;
- **live workspace snapshot / terminal event**: Ed25519 signature checked against the node kernel key;
- **raw operator-status runtime/model-call frame**: unsigned node transport telemetry, labelled separately;
- **opened live file body**: bytes independently checked against the signed advertised SHA-256.

## Design reference validation

The scheduled `design-validation.yml` workflow checks the
[`ai-personas-design`](https://github.com/ai-personas/ai-personas-design) `master` branch every
Monday and on UI changes. The last reviewed design commit is
`28f0714ab2db6e1eb6ac789cf92c9a9b55675b81`: 22 Markdown files with manifest SHA-256
`78c8040aa5b2b48943f33e2650e9e651408d81420ca6b60ddfc4b0e5e29ac78e`. CI fails when either
HEAD or any Markdown input differs and instructs maintainers to review the complete upstream diff
before updating the pin. Semantic checks for decentralised discovery, the access ladder,
content integrity, globally-verifiable lineage, and honest relay/bootstrap commons remain in
place. They also pin persona-authored asynchronous clarification, exact-action external latency,
best-so-far artifact visibility, identity/genesis membership separation, birth-provenance-scoped
bootstrap communication, and persona-owned completion readiness.

## Explore

Click any discovered record for deep detail with its trust state visible:

- **persona** → full profile (archetype, disposition, reputation, accepted roles, interests,
  domain curatorships, memory) + the codex models / body it ran;
- **environment** → its **member personas** and the **models available** to them, charter norms,
  rules;
- **domain** → the emergent domain: safety class, hazard, trust ladder, required tools, safety
  extensions;
- **project / bundle** → the J7 model cascade, verifier cascade + 8-source safety floor, OCI/IPLD
  distribution (CIDs), any fabricated physical asset, and an **in-browser artifact viewer**;
- **telemetry** → a consent-gated activity/presence feed; browser-verified public documents and
  unsigned operator-status observations are labelled separately.

A real-time **LIVING NETWORK** UI makes the personas legible through an original collectible-card
visual language: the signed display name and verified raster portrait are the card hero, while each
card's bounded message stream shows its own observed model requests and coordination signals.
Environment cards carry a smaller live avatar constellation and message ticker. The global
coordination constellation still fires as messages flow, and the heartbeat-driven system vital
keeps the page alive. Persona cards expose task/LLM execution state, the current model/purpose, and
run pressure/review/block state when the node API provides it. This visual system does not reuse
third-party trading-card artwork, logos, nomenclature, or layouts.

Persona→persona graph edges are exact claims, not inferred social links. A standing chord and its
directional pulse exist only when one observed telemetry event names both an actor persona and an
explicit persona recipient/affected endpoint. Shared environment, scope, or cohort membership
never creates an edge. A single-ended kernel-mediated act remains a kernel↔persona spoke; the feed
may visually thread rows that share a real scope ID, but that thread is not presented as a recipient
claim. `recipients` and `affected` endpoints are normalized and de-duplicated once, so the graph,
feed, follow filter, persona activity, and directional pulses all describe the same explicit route.
A recorded communication intent is labelled as intent—not as proven delivery. Historical
coordination rows have a five-minute display lease and cannot make a persona look currently busy;
only a current `active_model_calls` entry does that.

Realtime presence is leased rather than inferred from durable discovery. The bounded presence
store defaults to stale after ten seconds and offline when its 30-second lease expires; duplicate
or out-of-order sequence updates are rejected. The UI also expires heartbeat, active-model-call,
persona telemetry, and persona runtime-status entries after 30 seconds without a refresh, clears
their ephemeral model/running state, and leaves the durable discovered card visible as
stale/offline.

Environment routing is authority-preserving. Exact associations come only from a verified
discovery record/provider surface. A sole candidate is unambiguous, and a current signed project
primary may resolve a project host; multiple or conflicting candidates remain explicit routing
pressure. The browser never uses activity recency, a matching title/charter, roster similarity,
array order, or the first environment on a node to select or collapse an environment. Legacy run
paths associate artifacts only when exactly one observed environment owns the run. Otherwise the
artifact stays unassigned and the stage reports the unresolved pressure instead of duplicating it
under a guessed workspace.

## Operator console — drive your own node from the portal

Anonymous visitors see each node's **public discovery projection only**: the public status
card, the operator-opted public aggregate, and the linked surface docs of records the
operator explicitly promoted public. Run state, personas, telemetry and the raw run tree are
**read-gated** (09_PROTOCOLS §3G.3 — `discover < read`).

Authority is a **bearer token, never network position** (not even loopback). Each node mints
a process bearer at boot and prints its exact temporary file path (the default is
`runs/node/.personaos-secrets/operator.token`). Capture it before the first model call: the node
then unlinks that same-UID-readable file while retaining the bearer in memory; a restart without
the file rotates it. Click **OPERATOR**, save `node base URL + token`, and the portal unlocks for
that node:

- **full node status** — personas, runs, paused missions, budget, lineage durability;
- **⚡ ASK** — submit a task as the owner (`POST /task`); **💰 FUND** — grant budget to resume
  a paused mission (`POST /budget`); **⏹ STOP** — halt a running mission as a signed operator
  intervention (`POST /stop`);
- run drill-down - live execution state, pressure/review state, updating workspace files,
  artifact lists, and per-objective **evidence basis**;
- protected fetches carry the token in `Authorization: Bearer …`; authenticated live updates
  use the 3-second polling path because browser `EventSource` cannot set that header. Public
  streams continue to use SSE.

Tokens are kept only in `sessionStorage` and are cleared when the tab session ends. Older
durable portal credentials are deleted on load. Tokens are never appended to artifact,
body, raw-view, download, or stream URLs. A page without a token can never mint authority —
cross-origin browser requests to someone's node get the public projection and signed refusals,
by design (audit5 A5-01/A5-08).

## Run locally

```bash
git clone https://github.com/ai-personas/ai-personas-ui.git
cd ai-personas-ui && python3 -m http.server 8099   # open http://localhost:8099
```

## Layout

```
index.html                                 # the discovery portal (terminal UI) — pure shell, no data
assets/discovery.js                        # discovery, live monitor, drawers, render orchestration
assets/discovery-authority.mjs             # provider hints, historical keys, AccessPolicy projection
assets/persona-avatar.mjs                  # persona-signature + raster-byte/hash/MIME/dimension verification
assets/network-view.mjs                    # bounded priority/search/progressive network projections
assets/network-store.mjs                   # kernel-qualified entities, presence leases, event rings
assets/artifact-types.mjs                  # signed declared-media presentation policy
assets/public-telemetry.mjs                # exact public/operator telemetry and route projection
assets/live-artifacts.mjs                  # pure revision/change/diff state helpers
assets/live-signatures.mjs                 # live metadata + AccessPolicy Ed25519 verification
assets/routing-authority.mjs               # fail-closed exact/ambiguous environment association
assets/noble-ed25519.js                    # vendored verifier (MIT)
assets/p2p-libp2p.js                       # vendored js-libp2p (WebRTC + relay + gossip + configured DHT client)
tools/check-design-reference.py             # scheduled normative-design drift guard
```

There is **no `k/` and no `.well-known/` in this repo** — those are *run* surfaces served by a
live node, never baked into the published page. The page discovers them from peers at runtime.
