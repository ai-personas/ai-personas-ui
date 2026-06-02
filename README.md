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

## What this contains — a multi-kernel ecosystem

A signed discovery surface from **seven independent PersonaOS kernels** (served as nodes under
`k/<run>/`, each like a different machine), produced by running a **variety of real tasks**
through PersonaOS with **codex models** (gpt-5.5 / gpt-5.4 / gpt-5.4-mini / gpt-5.3-codex-spark,
with model fallback). Each task drove the full pipeline — recognise → **emergent domain** →
codex body writes a self-validating program → **real sandbox verification** → artifacts →
co-signed, shipped bundle → OCI/IPLD distribution (+ a fabricated board for the hardware one).

| Persona | Emergent domain | Deliverable |
|---|---|---|
| Sparky | Electrical Engineering *(safety-critical)* | DC→AC inverter PCB package (gerbers, BOM, drill) + fabricated board |
| Ada | Software Engineering | merge sort + proof report |
| Boson | Software Engineering | CSV↔JSON converter + round-trip test |
| Mira | computational mathematics | prime sieve + verification |
| Quill | computational physics | damped-oscillator simulation |
| Volt | Software Engineering | JSON-schema validator |
| Cipher | Software Engineering Documentation | rate-limiting technical brief |

Each kernel publishes Ed25519-signed `DiscoverableRecord`s for its **persona, environment,
domain, project, artifact bundle + files, and telemetry feed** — **77 records total**, every
one resolved and verified in your browser. Click any record for deep detail: env → its
personas + the codex models it ran; persona → full profile; bundle → the J7 model cascade,
verifier cascade + 8-source safety floor, OCI/IPLD distribution, and an in-browser artifact
viewer. The root `.well-known/personaos-discovery.json` lists the kernels as
`federated_kernels`; add more with `?peer=https://host`.

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
