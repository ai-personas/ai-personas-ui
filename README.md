# ai-personas-ui — discover & explore PersonaOS personas across the global network

A static web portal to **discover and explore PersonaOS personas**, their environments,
missions, artifacts, and telemetry across a P2P network. The shell has **no central index and
no privileged default node**. It resolves signed discovery records from whatever peers the
browser can reach and verifies those records with Ed25519 in-browser. Live execution and
workspace updates are useful but separate **unsigned transport telemetry**, labelled as such.

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
- an optional `?resolver=<https-url>` (or legacy `?global_discovery=`) supplied by the viewer.

This repository's `peers.txt` deliberately contains no fixed hostname. Optional resolvers return
signed announcements and are locators only; none is contacted unless the viewer puts it in the
URL. Discovery records are re-resolved and re-verified every 15 seconds. If no first-contact path
finds a reachable node, the page shows an explicit empty state.

**Mixed-content note.** A page served over **`https://`** cannot `fetch()` an **`http://` LAN
IP** (browsers block mixed content). So on an **intranet**, open the **node-served** UI directly
at `http://<node-host>:8799/` — the node serves this same shell over plain HTTP, same-origin, so
realtime discovery works without any tunnel. For the **internet**, expose the node behind an
**`https://` tunnel** (e.g. a Cloudflare quick-tunnel) and list that URL in `peers.txt` or pass
it with `?peer=`. Either way trust is the **Ed25519 signature on each record, not the host**.

## P2P discovery - how it finds things (no central index)

Discovery is **signed + content-addressed** (09_PROTOCOLS §3G/§3H). For
every node it knows or is told about, the page:

1. **bootstraps** from that node's `.well-known/personaos-discovery.json`;
2. does a **Kademlia-DHT-style provider lookup** (`discovery/providers.json`) — a list of opaque
   `key → record` pointers, *not* the data;
3. **resolves each record and verifies its Ed25519 signature** against the owning kernel's
   published key (in-browser, via vendored [`noble-ed25519`](https://github.com/paulmillr/noble-ed25519)).
   An unsigned or forged record is dropped.

Planes (09_PROTOCOLS §3G.2): **internet** = `.well-known` + gossip + Kademlia DHT; **intranet** =
mDNS at the kernel, plus direct/local routes the browser can use. Records are access-gated
(`discover < read < write < admin`); a private record must not enumerate to an unauthorised peer.

**Real libp2p P2P in the browser.** The page boots a vendored **js-libp2p** node
(`assets/p2p-libp2p.js`: WebRTC + circuit-relay + gossipsub + a Kademlia client). It gossips
signed records on `personaos/discovery/v1`; a locator from a verified card is enrolled into the
normal HTTP discovery/polling path, where records are fetched and verified again. When an explicit
or node-advertised bootstrap/relay is configured, the browser provides and finds the shared
PersonaOS rendezvous multihash through that peer's Kademlia routing table. With no connected
bootstrap/relay there is no shared DHT to query, and the UI does not claim otherwise.

**The portal is generic + federated.** A reached node may list its own `federated_kernels` and
peers; add any other kernel with `?peer=https://its-host`, advertise it through libp2p/IPFS, or
save it with the PEER control. Every route enters the same record-resolution and signature check.

**Honest transport note (§3H.3).** The libp2p node is real and runs in your browser, but a
browser can't accept inbound connections or multicast, so to actually **reach other machines** it
needs a **relay / bootstrap peer** to dial through. Offline artifact availability similarly needs
a willing replica or pin provider. These are optional, replaceable **commons**, not a trusted
central index, but they are still infrastructure. Without bootstrap/relay/rendezvous or a direct
peer URL, unrelated browsers cannot discover each other through NAT; without replication/pinning,
an offline origin's bytes are unavailable. Trust still comes from signatures and content hashes,
not from the commons carrying them.

## Realtime execution and live artifacts

For each active run, the UI consumes `GET /runs/<run>/live-artifacts` and, for public streams,
the SSE event `live_artifact_update`. A 3-second poll is the fallback when EventSource is
buffered or blocked and is the primary path when an operator token is required.
The UI keeps a separate ordered revision map per `(node base, run)`, compares complete snapshots,
and shows created, modified, and deleted files grouped by persona workspace. Poll responses carry
request generations and their starting revision; an SSE `previous_revision` must extend the
accepted chain. Stale responses are discarded, `run_ended` makes the last revision terminal, and
body-cache writes are refused if the open file advanced while bytes were in flight.

Live files are clickable. The browser fetches their body URL with bearer authentication in the
request header, never in the URL, and computes SHA-256 before passing bytes to any renderer.
Downloads use the same check, then create a short-lived `application/octet-stream` attachment;
there is no authenticated "open raw" navigation surface.
Markdown, text, JSON, and CSV retain one prior verified revision and show a bounded line diff when
an open file changes. Image/PDF and local KiCad/netlist viewers rerender the new verified bytes;
other CAD/3D formats receive an exact hash-bound descriptor and verified download for an isolated
CAD tool. The credential-bearing page imports no executable CDN modules. Markdown cannot fetch
remote media, and glTF with non-data `uri` dependencies is rejected. Client limits cap snapshots
at 2 MiB, workspaces at 64, active calls at 64, files at 256, paths at 16 levels/512 characters,
rendered bodies at 8 MiB, and downloads at 32 MiB.

The distinction is intentional:

- **signed discovery record**: Ed25519 verified in-browser;
- **signed lineage event**: shown as signed only when the feed explicitly marks it signed;
- **live execution/workspace frame**: unsigned node transport telemetry;
- **opened live file body**: bytes independently checked against the advertised SHA-256.

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

A real-time **LIVING NETWORK** UI makes the personas legible: living persona cards stream each
persona's request→response and cognition; a coordination constellation (kernel core + persona nodes)
fires as messages flow; a who→whom coordination feed threads each task's produce→verify→ship; and a
heartbeat-driven system vital keeps the page alive. Persona cards expose task/LLM execution state,
the current model/purpose, and run pressure/review/block state when the node API provides it.

## Operator console — drive your own node from the portal

Anonymous visitors see each node's **public discovery projection only**: the public status
card, the operator-opted public aggregate, and the linked surface docs of records the
operator explicitly promoted public. Run state, personas, telemetry and the raw run tree are
**read-gated** (09_PROTOCOLS §3G.3 — `discover < read`).

Authority is a **bearer token, never network position** (not even loopback). Each node mints
a per-install token at boot (printed on the console; stored at `runs/…/_operator/token`).
Click **🔑 OPERATOR**, save `node base URL + token`, and the portal unlocks for that node:

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
python3 tools/test-live-ui.py --screenshot-dir /tmp/personaos-ui-validation
```

The browser test requires Python Playwright and an installed Chromium. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` when the browser is installed outside Playwright's default cache.

## Layout

```
index.html                                 # the discovery portal (terminal UI) — pure shell, no data
assets/discovery.js                        # discovery, live monitor, drawers, render orchestration
assets/live-artifacts.mjs                  # pure revision/change/diff state helpers
assets/noble-ed25519.js                    # vendored verifier (MIT)
assets/p2p-libp2p.js                       # vendored js-libp2p (WebRTC + relay + gossip + configured DHT client)
peers.txt                                  # published phonebook of live node URLs (discovered at runtime)
tools/discovery_page.py, discovery_v11.py  # build-time generators (publish a node); NOT needed at runtime
tools/test-live-artifacts.mjs              # deterministic live revision/diff contract harness
tools/live_ui_fixture.py                    # canonical live API fixture for browser validation
tools/test-live-ui.py                       # Playwright security, live-update, and mobile regression
tools/check-design-reference.py             # scheduled normative-design drift guard
```

There is **no `k/` and no `.well-known/` in this repo** — those are *run* surfaces served by a
live node, never baked into the published page. The page discovers them from peers at runtime.
