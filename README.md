# ai-personas-ui — PersonaOS discovery portal

A **static front-end that discovers PersonaOS entities at runtime** — personas, environments,
artifacts and telemetry — across the **internet** (`.well-known` + gossip + Kademlia DHT) and
**intranet** (mDNS) planes, under one access-level model (`discover < read < write < admin`).

It is **generic**: it renders whatever any kernel publishes, not a fixed dataset. Point it at
another kernel with `?peer=https://host` and it discovers + verifies that kernel's records too.

## It discovers — it does not display a dump

The page is **not** handed a finished list. In your browser it:

1. **Bootstraps** from `/.well-known/personaos-discovery.json` (kernel id, keys URL, DHT
   provider-index URL, planes).
2. **DHT lookup** — fetches `discovery/providers.json`, a Kademlia-style index of opaque
   `key → record_url` pointers (no record content).
3. **Resolves + verifies each record live** — for every pointer it fetches the signed record
   and **verifies its Ed25519 signature in-browser** (vendored [`noble-ed25519`](https://github.com/paulmillr/noble-ed25519),
   over WebCrypto SHA-512) against the kernel's published key. Unsigned/forged records are
   dropped. Only then is the record shown.
4. **Intranet plane** — probes configured LAN peer URLs (`?peer=…` or the in-page field): the
   browser equivalent of mDNS. (True multicast mDNS / libp2p Kademlia run in the native
   runtime; the static profile verifies over HTTP(S) — see `09_PROTOCOLS §3H.3`.)

A live **discovery log** shows every step (bootstrap → DHT → resolve → verify), so it is
visibly a runtime process. Access-gating is honoured: only `federation`/`public` records have
provider entries (tighter tiers never leave the origin); artifact bodies and the telemetry feed
stay `read`-gated to the owner/grantees even though the records are discoverable.

## Run locally

```bash
cd ai-personas-ui && python3 -m http.server 8099
# open http://localhost:8099  — watch the discovery log resolve + verify each record
```

Discover a second kernel: `http://localhost:8099/?peer=https://that-kernels-site`.

## What this snapshot contains

A signed discovery surface from a real PersonaOS run — *"Design a DC to AC circuit and produce
a ready-to-order PCB manufacturing package"* — where the persona ran on **codex models**
(gpt-5.5 / gpt-5.4 / gpt-5.4-mini / gpt-5.3-codex-spark, with model fallback) and shipped a
verified PCB package. The discoverable records:

- `persona` — the DC-to-AC designer persona
- `env` — the project workspace environment
- `artifact` ×N — the bundle + each Gerber / drill / BOM / fab-order file (content-addressed)
- `telemetry` — a consent-gated activity/presence feed card

Everything is signed by the kernel's `kernel-master` key, published at
`.well-known/personaos-keys.json`, and verified in the browser.

## Regenerate

`tools/` contains the generators (`discovery_page.py` builds this portal; `discovery_v11.py`
projects + signs the records). They run against a PersonaOS run directory:

```python
from discovery_page import export_discovery_portal
export_discovery_portal("runs/dc_to_ac_design/<run>", "ai-personas-ui")
```

## Layout

```
index.html                     # the runtime discovery portal
assets/discovery.js            # bootstrap → DHT lookup → resolve → in-browser Ed25519 verify
assets/noble-ed25519.js        # vendored verifier (MIT)
.well-known/personaos-discovery.json   # discovery bootstrap
.well-known/personaos-keys.json        # kernel public keys (verification)
discovery/providers.json       # DHT provider index (key → pointer)
discovery/v11/records/*.json   # the signed DiscoverableRecords (resolved at runtime)
telemetry/ artifacts/ store/ … # the resolvable run surface
```
