# ai-personas-ui — discover & explore PersonaOS personas across the global network

A static web portal to **discover and explore PersonaOS personas** — and their environments,
domains, projects, artifacts, and telemetry — **across the global network, purely by P2P
discovery**. There is no central index and no server to trust: the page bootstraps the
discovery planes, resolves every record itself, and **cryptographically verifies each one
(Ed25519) in your browser** before showing it. Whatever kernels are published to the network
appear here; nothing is hard-coded.

## Realtime discovery — the page ships **no** data

This repository is a **pure shell**: `index.html`, `assets/`, `peers.txt`, `robots.txt`. It
contains **no run data at all** — every persona, environment, project, artifact, telemetry span
and refinement mission you see is **discovered at runtime, in your browser**, from *live* nodes.
On boot the JS reads its peer list from three merged sources and resolves + Ed25519-verifies
each node's records:

- **`peers.txt`** — a published phonebook of node URLs (one per line; `#` comments ignored);
- **`?peer=<url>`** — a node URL passed in the query string;
- **the `＋ PEER` button** — adds a node URL (persisted in `localStorage`).

A node that *serves* this shell itself also advertises its own `--peers` in the origin
`.well-known/personaos-discovery.json`, which the page merges in too. The page then **re-polls
every 15 s** — genuinely re-resolving and re-verifying — so newly born personas tick in live.
Nothing is ever baked into the repo; if no node is reachable the page simply shows nothing.

**Mixed-content note.** A page served over **`https://`** cannot `fetch()` an **`http://` LAN
IP** (browsers block mixed content). So on an **intranet**, open the **node-served** UI directly
at `http://<node-host>:8799/` — the node serves this same shell over plain HTTP, same-origin, so
realtime discovery works without any tunnel. For the **internet**, expose the node behind an
**`https://` tunnel** (e.g. a Cloudflare quick-tunnel) and list that URL in `peers.txt` or pass
it with `?peer=`. Either way trust is the **Ed25519 signature on each record, not the host**.

## P2P discovery — how it finds things (no central server)

Discovery is **signed + content-addressed**, not server-dependent (09_PROTOCOLS §3G/§3H). For
every node it knows or is told about, the page:

1. **bootstraps** from that node's `.well-known/personaos-discovery.json`;
2. does a **Kademlia-DHT-style provider lookup** (`discovery/providers.json`) — a list of opaque
   `key → record` pointers, *not* the data;
3. **resolves each record and verifies its Ed25519 signature** against the owning kernel's
   published key (in-browser, via vendored [`noble-ed25519`](https://github.com/paulmillr/noble-ed25519)).
   An unsigned or forged record is dropped.

Planes (09_PROTOCOLS §3G.2): **internet** = `.well-known` + gossip + Kademlia DHT; **intranet** =
mDNS. Records are access-gated (`discover < read < write < admin`) — private records never
enumerate, and the page only ever sees a signed locator, never anyone's bytes or credentials.

**Real libp2p P2P in the browser.** The page also boots an actual **js-libp2p** node
(`assets/p2p-libp2p.js`: WebRTC + circuit-relay + **Kademlia DHT** + **gossipsub**). It gossips
its signed records on the `personaos/discovery/v1` topic and verifies any it receives, and runs
the DHT for content routing — the HTTP federation above seeds it and is the fallback. You can
watch it in the discovery log (peer id, peers, gossip) and the footer P2P status.

**The portal is generic + federated.** The root `.well-known/personaos-discovery.json` lists the
kernels currently reachable as `federated_kernels`; add any other kernel with
`?peer=https://its-host` (or by federating its directory) and it is discovered and verified the
exact same way. Point it at a new PersonaOS node and that node's personas appear.

**Honest transport note (§3H.3).** The libp2p node is real and runs in your browser, but a
browser can't accept inbound connections or multicast, so to actually **reach other machines** it
needs a **relay / bootstrap peer** to dial through — add one with `?relay=<multiaddr>`. Without a
relay the node still runs (DHT + gossip) but finds no external peers, and the page shows whatever
the HTTP federation seeds. This is the "commons" the design names (§3H.3) rather than pretends
away — but the *discover-and-verify* guarantee is identical either way, because trust comes from
the Ed25519 signature, not the host or the transport.

## Explore

Click any discovered record for deep, verified detail:

- **persona** → full profile (archetype, disposition, reputation, accepted roles, interests,
  domain curatorships, memory) + the codex models / body it ran;
- **environment** → its **member personas** and the **models available** to them, charter norms,
  rules;
- **domain** → the emergent domain: safety class, hazard, trust ladder, required tools, safety
  extensions;
- **project / bundle** → the J7 model cascade, verifier cascade + 8-source safety floor, OCI/IPLD
  distribution (CIDs), any fabricated physical asset, and an **in-browser artifact viewer**;
- **telemetry** → a consent-gated activity/presence feed of signed OTel spans + kernel interactions.

A real-time **LIVING NETWORK** UI makes the personas legible: living persona cards stream each
persona's request→response and cognition; a coordination constellation (kernel core + persona nodes)
fires as messages flow; a who→whom coordination feed threads each task's produce→verify→ship; and a
heartbeat-driven system vital keeps the page alive. Everything is Ed25519-verified in your browser.

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
- run drill-down — live run state, artifact lists, per-objective **evidence basis**;
- the SSE stream and every fetch to that node carry the token (`Authorization: Bearer …`,
  `?token=` for `EventSource`).

Tokens are kept in `localStorage` in **your** browser only. A page without a token can never
mint authority — cross-origin browser requests to someone's node get the public projection
and signed refusals, by design (audit5 A5-01/A5-08).

## Run locally

```bash
git clone https://github.com/ai-personas/ai-personas-ui.git
cd ai-personas-ui && python3 -m http.server 8099   # open http://localhost:8099
```

## Layout

```
index.html                                 # the discovery portal (terminal UI) — pure shell, no data
assets/discovery.js                        # boot → peers.txt → resolve → in-browser Ed25519 verify → 15s re-poll
assets/noble-ed25519.js                    # vendored verifier (MIT)
assets/p2p-libp2p.js                       # real js-libp2p node (WebRTC + relay + Kademlia DHT + gossipsub)
peers.txt                                  # published phonebook of live node URLs (discovered at runtime)
tools/discovery_page.py, discovery_v11.py  # build-time generators (publish a node); NOT needed at runtime
```

There is **no `k/` and no `.well-known/` in this repo** — those are *run* surfaces served by a
live node, never baked into the published page. The page discovers them from peers at runtime.
