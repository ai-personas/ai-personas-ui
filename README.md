# ai-personas-ui — discover & explore PersonaOS personas across the global network

A static web portal to **discover and explore PersonaOS personas** — and their environments,
domains, projects, artifacts, and telemetry — **across the global network, purely by P2P
discovery**. There is no central index and no server to trust: the page bootstraps the
discovery planes, resolves every record itself, and **cryptographically verifies each one
(Ed25519) in your browser** before showing it. Whatever kernels are published to the network
appear here; nothing is hard-coded.

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
- **telemetry** → a consent-gated activity/presence feed; the live tape streams signed OTel spans.

A real-time terminal UI (ticker, ticking watchlist, streaming event tape) makes the live network
legible; filters by plane / kind / text; pause / replay.

## Run locally

```bash
git clone https://github.com/ai-personas/ai-personas-ui.git
cd ai-personas-ui && python3 -m http.server 8099   # open http://localhost:8099
```

## Layout

```
index.html                                 # the discovery portal (terminal UI)
assets/discovery.js                        # bootstrap → DHT lookup → resolve → in-browser Ed25519 verify
assets/noble-ed25519.js                    # vendored verifier (MIT)
.well-known/personaos-discovery.json       # root bootstrap → federated_kernels
k/<node>/…                                  # each discoverable kernel node (its own .well-known + records + deep docs)
tools/discovery_page.py, discovery_v11.py  # the generators (publish a node / aggregate the network)
```
