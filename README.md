# ai-personas-ui — discover & explore PersonaOS personas across the global network

A static web portal to **discover and explore PersonaOS personas**, their environments,
missions, artifacts, and telemetry across a P2P network. For first contact, the bare hosted shell
uses **`https://node1.personas.ai` as an untrusted, replaceable locator**. It resolves signed
discovery records from the nodes the browser can reach and
verifies those records with Ed25519 in-browser. Live execution and
workspace snapshots and terminal events are separately **kernel-signed and Ed25519-verified**;
other transient execution telemetry remains explicitly labelled as unsigned transport data.

## Realtime discovery — the page ships **no** data

This repository is a **pure shell**: `index.html`, `assets/`, `peers.txt`, `robots.txt`. It
contains **no run data at all**. Every persona, environment, project, artifact, telemetry span,
and refinement mission is discovered at runtime from live nodes. First contact is merged from:

- the page origin when a PersonaOS node serves this shell;
- **`?peer=<url>`**, peers saved by the **PEER** control in `localStorage`, and `peers.txt`;
- bounded localhost probes for a node running on the viewer's machine;
- the shared IPFS rendezvous CID and signed IPNS node cards, only when the viewer supplies
  `?ipfs_routing=<url>` and `?ipfs_gw=<url>` commons;
- libp2p bootstrap/relay multiaddrs from reached nodes or explicit `?bootstrap=` / `?relay=`;
- the default `https://node1.personas.ai` rendezvous plus any additive
  `?resolver=<https-url>` (or legacy `?global_discovery=`) supplied by the viewer.

This repository's `peers.txt` deliberately contains no fixed node hostname. Resolver responses are
signed announcements and locators only; `node1` and custom resolvers receive no authority over the
records or identities they point to. Use `?no_global_discovery=1` for an explicit
resolver-free/offline session. Discovery
records are re-resolved and re-verified every 15 seconds. If no first-contact path finds a reachable
node, the page shows an explicit empty state.

**Mixed-content note.** A page served over **`https://`** cannot `fetch()` an **`http://` LAN
IP** (browsers block mixed content). So on an **intranet**, open the **node-served** UI directly
at `http://<node-host>:8799/` — the node serves this same shell over plain HTTP, same-origin, so
realtime discovery works without any tunnel. For the **internet**, expose the node behind an
**`https://` tunnel** (e.g. a Cloudflare quick-tunnel) and announce its URL through `node1`, give
viewers its URL through `?peer=`, or use another signed-announcement resolver. In every case trust
is the **Ed25519 signature on each record, not the host**.

## P2P discovery - how it finds things (no central index)

Discovery is **signed + content-addressed** (09_PROTOCOLS §3G/§3H). For
every node it knows or is told about, the page:

1. **bootstraps** from that node's `.well-known/personaos-discovery.json`;
2. resolves signed `provider-record/1` envelopes from `discovery/providers.json`, each binding a
   DID/hash/handle key, record hash, host locators, access policy, and current kernel master key;
3. **resolves each record and verifies the ProviderRecord, record, and AccessPolicy Ed25519
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
Only then may it follow a bound locator. When an explicit or node-advertised bootstrap/relay is configured,
the browser also provides and finds the shared PersonaOS rendezvous multihash through that peer's
Kademlia routing table. With no connected bootstrap/relay there is no shared DHT to query, and the
UI does not claim otherwise.

Raw gossip is **lookup-only**: a record's embedded key, label, base, links, and policy never enter
the UI directly. The browser extracts at most five bounded content-hash/DID/global-handle/handle/id
aliases, rate-limits their DHT queries, and displays the record only after `resolveProvider` returns
a current-master-signed ProviderRecord whose document hash, record signature, policy signature,
subject, scope, and host binding all verify. This lets a gossip-only handle discover a previously
unknown node without an HTTP provider-index seed while preventing self-signed gossip from
overwriting displayed state.

Public visibility grants strangers **discover**, not read. A matching, unexpired public `r`/`rw`/
`admin` grant whose optional scope matches the signed policy subject is required before an anonymous
publisher may send record links, content hashes, locators, interfaces, or read-gated descriptions.
Discover-only HTTP, gossip, and provider-protocol payloads are kernel-signed minimal projections;
the full signed record remains on the authenticated read path. The UI independently enforces the
same rule as defense in depth and labels the row discover-only. General record signatures may verify
against current, previous, or archived registry entries; live frames and ProviderRecords remain
current-kernel-master-only.

**The portal is generic + federated.** A reached node may list its own `federated_kernels` and
peers; public nodes normally announce through the default untrusted locator, and any kernel can
also be added with `?peer=https://its-host`, advertised through libp2p/IPFS, or saved with the PEER
control. Every route enters the same record-resolution and signature check.

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
of DOM nodes, live connections, or ambiguous short-ID keys. The legacy whole-list response remains
a compatibility path, not the recommended interface for a million-node directory.

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

**Live tasks are visible from their signed public record at intake.** The mission surface renders
the exact task label and the exact bounded value of the signed `task_state:` capability whenever
the record also carries `live_task`. Capability order is deliberately irrelevant because the
signed payload canonicalises that list. A prior raw-state record is accepted only when one signed
legacy state capability is unambiguously corroborated by its signed description; prose never
supplies a missing state. Unsigned telemetry, project/mission evidence, and operator-only run state
remain additive sources.

**Persona avatars are persona-signed, content-addressed raster identity.** An admitted avatar uses
the `persona-avatar/2` contract from an Ed25519-verified public persona record. The browser verifies
the descriptor's persona signature, resolves only its exact provider-relative content-addressed
path, rejects redirects, and checks raster MIME, byte length, SHA-256, and dimensions before
rendering the bytes through a temporary blob URL. Missing or invalid avatars remain neutral text
placeholders; the UI generates no identity art, and an avatar descriptor never creates another
persona or projection card. The top status/control header is independently collapsible and consumes
zero layout height while closed.

## Realtime execution and live artifacts

For each active run, the UI consumes `GET /runs/<run>/live-artifacts` and, for public streams,
the SSE event `live_artifact_update`. A 3-second poll is the fallback when EventSource is
buffered or blocked and is the primary path when an operator token is required.
The UI keeps a separate ordered revision map per `(node base, run)`, compares complete snapshots,
and shows created, modified, and deleted files grouped by persona workspace. Poll responses carry
request generations and their starting revision; an SSE `previous_revision` must extend the
accepted chain. Stale responses are discarded, `run_ended` makes the last revision terminal, and
body-cache writes are refused if the open file advanced while bytes were in flight. A verified
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

Live files are clickable. The browser fetches their body URL with bearer authentication in the
request header, never in the URL, and computes SHA-256 before passing bytes to any renderer.
Downloads use the same check, then create a short-lived `application/octet-stream` attachment;
there is no authenticated "open raw" navigation surface.
Non-live manifest files that advertise a SHA-256 use the same fail-closed byte check before any
repository renderer receives them; un-hashed content is labelled as such rather than “verified.”
Markdown, text, JSON, and CSV retain one prior verified revision and show a bounded line diff when
an open file changes. Repository-owned adapters cover Gerber/drill, KiCad, netlist/SPICE,
waveforms, DXF, CAD/3D, PDF, tables, structured data, and Markdown; built-ins cover verified
images, audio/video controls, source code, tabular text, and safe download descriptors. Unknown
content never produces a blank viewer: textual bytes get a bounded plain-text view and binary
bytes get metadata plus a bounded hex preview. HTML is displayed as source, archive/office
formats are descriptors, and executable peer content is never run. The credential-bearing page
imports no executable CDN modules. Markdown cannot fetch remote media, and glTF with non-data
`uri` dependencies is rejected. Client limits cap snapshots at 2 MiB, workspaces at 64, active
calls at 64, files at 256, paths at 16 levels/512 characters, rendered bodies at 8 MiB, and
downloads at 32 MiB.

The distinction is intentional:

- **signed discovery record**: Ed25519 verified in-browser;
- **signed lineage event**: shown as signed only when the feed explicitly marks it signed;
- **live workspace snapshot / terminal event**: Ed25519 verified against the node kernel key;
- **other live execution frame**: unsigned node transport telemetry, labelled separately;
- **opened live file body**: bytes independently checked against the signed advertised SHA-256.

## Design reference validation

The scheduled `design-validation.yml` workflow checks the
[`ai-personas-design`](https://github.com/ai-personas/ai-personas-design) `master` branch every
Monday and on UI changes. The last reviewed design commit is
`f6647e65bce877d48b68c7343ee873ba81e5e312`: 22 Markdown files with manifest SHA-256
`380f19a78c2e63d29f74c784b9937f97d72d7883a90963651b5f4801f3344182`. CI fails when either
HEAD or any Markdown input differs and instructs maintainers to review the complete upstream diff
before updating the pin. Semantic checks for decentralised discovery, the access ladder,
content integrity, globally-verifiable lineage, and honest relay/bootstrap commons remain in
place, followed by the state harness and Playwright live/mobile regression.

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
- **telemetry** → a consent-gated activity/presence feed; signed spans and unsigned live frames
  are labelled separately.

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

## Operator console — drive your own node from the portal

Anonymous visitors see each node's **public discovery projection only**: the public status
card, the operator-opted public aggregate, and the linked surface docs of records the
operator explicitly promoted public. Run state, personas, telemetry and the raw run tree are
**read-gated** (09_PROTOCOLS §3G.3 — `discover < read`).

Authority is a **bearer token, never network position** (not even loopback). Each node mints
a process bearer at boot and temporarily stages it at `runs/…/_operator/token`. Capture it
before the first model call: the node then unlinks that same-UID-readable file while retaining
the bearer in memory; a restart without the file rotates it. Click **OPERATOR**, save
`node base URL + token`, and the portal unlocks for that node:

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

Deterministic validation (the Playwright check starts its own local fixture):

```bash
node tools/test-live-artifacts.mjs
node tools/test-persona-avatar.mjs
node tools/test-artifact-types.mjs
node tools/test-network-view.mjs
node tools/test-network-store.mjs
python3 tools/test-live-ui.py --screenshot-dir /tmp/personaos-ui-validation
python3 tools/test-hosted-deploy.py --base-url http://127.0.0.1:8099/ \
  --commit local --screenshot /tmp/personaos-hosted-smoke.png
```

The browser test requires Python Playwright, PyNaCl, and an installed Chromium. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` when the browser is installed outside Playwright's default cache.

## Layout

```
index.html                                 # the discovery portal (terminal UI) — pure shell, no data
assets/discovery.js                        # discovery, live monitor, drawers, render orchestration
assets/discovery-authority.mjs             # provider hints, historical keys, AccessPolicy projection
assets/persona-avatar.mjs                  # persona-signature + raster-byte/hash/MIME/dimension verification
assets/network-view.mjs                    # bounded priority/search/progressive network projections
assets/network-store.mjs                   # kernel-qualified entities, presence leases, event rings
assets/artifact-types.mjs                  # safe local/built-in artifact dispatch manifest
assets/live-artifacts.mjs                  # pure revision/change/diff state helpers
assets/live-signatures.mjs                 # live metadata + AccessPolicy Ed25519 verification
assets/noble-ed25519.js                    # vendored verifier (MIT)
assets/p2p-libp2p.js                       # vendored js-libp2p (WebRTC + relay + gossip + configured DHT client)
peers.txt                                  # published phonebook of live node URLs (discovered at runtime)
tools/discovery_page.py, discovery_v11.py  # build-time generators (publish a node); NOT needed at runtime
tools/test-live-artifacts.mjs              # deterministic live revision/diff contract harness
tools/test-persona-avatar.mjs              # signed, content-addressed raster avatar regression
tools/test-artifact-types.mjs              # artifact-dispatch matrix and unknown-content fallback
tools/test-network-view.mjs                # million-node bounded-window regression
tools/test-network-store.mjs               # identity, lease, ring, and graph-projection regression
tools/live_ui_fixture.py                    # canonical live API fixture for browser validation
tools/test-live-ui.py                       # Playwright security, live-update, and mobile regression
tools/test-hosted-deploy.py                 # exact deployed-byte + hosted Chromium smoke
tools/check-design-reference.py             # scheduled normative-design drift guard
```

There is **no `k/` and no `.well-known/` in this repo** — those are *run* surfaces served by a
live node, never baked into the published page. The page discovers them from peers at runtime.
