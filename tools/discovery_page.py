"""Generic PersonaOS discovery portal — *runtime* discovery from a static page.

Unlike a page that is handed a finished directory, this front-end **performs discovery at
runtime, in the browser**: it bootstraps from ``.well-known/personaos-discovery.json``, does a
Kademlia-style provider-index lookup, then **resolves and cryptographically verifies each
record live** (Ed25519, in-browser via vendored ``noble-ed25519`` over WebCrypto SHA-512)
before showing it. Records are never trusted from a blob — they are discovered, fetched, and
verified one by one, with a visible discovery log. Additional diagnostic peer
routes may be saved locally without encoding routing state into a public URL.

Honest transport note (09_PROTOCOLS §3H.3): a static page cannot open raw UDP/TCP, so true
libp2p Kademlia/mDNS need the native runtime or a js-libp2p bootstrap. The browser profile
implemented here does real *resolution + signature verification* over HTTP(S): the internet
plane reads this origin's ``.well-known`` + DHT provider index; the intranet plane probes
configured LAN peer URLs (the browser equivalent of mDNS, which needs a known peer address).

``export_discovery_portal(run_dir, "docs")`` lays down the run surface (so records resolve),
merges every kernel's provider index, writes the bootstrap, and ships the portal + verifier.
"""

from __future__ import annotations

import html
import json
import shutil
from pathlib import Path
from typing import Any

from personaos.ids import now_iso

_VENDOR = Path(__file__).resolve().parent / "vendor" / "noble-ed25519.js"


def _read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def _merge_providers(out: Path) -> dict[str, Any]:
    """Merge every ``providers.json`` (DHT provider index) found under ``out/discovery``
    into one keyspace. Each entry is a key -> {record_url, did, host} pointer — NOT the
    record content. The page resolves + verifies each at runtime."""
    providers: list[dict] = []
    kernels: dict[str, dict] = {}
    seen: set[str] = set()
    for path in sorted(out.glob("discovery/**/providers.json")):
        doc = _read_json(path)
        kid = doc.get("kernel_id", "")
        if kid:
            kernels.setdefault(kid, {"kernel_id": kid, "keys_url": doc.get("keys_url",
                                     ".well-known/personaos-keys.json")})
        for p in doc.get("providers", []) or []:
            rid = p.get("record_url", "")
            if rid and rid not in seen:
                seen.add(rid)
                providers.append(p)
    return {
        "schema": "dht-provider-index/1",
        "generated_at": now_iso(),
        "keys_url": ".well-known/personaos-keys.json",
        "kernels": list(kernels.values()),
        "provider_count": len(providers),
        "providers": providers,
    }


def export_discovery_portal(
    run_dir: str | Path,
    output_dir: str | Path = "docs",
    *,
    title: str = "PersonaOS Discovery",
) -> dict[str, Any]:
    """Lay down the run surface, build the DHT provider index + bootstrap, ship the portal."""
    from personaos.protocols.pages import export_github_pages

    pages_report = export_github_pages(run_dir, output_dir, title=title)
    out = Path(output_dir)

    provider_index = _merge_providers(out)
    _write_json(out / "discovery" / "providers.json", provider_index)

    bootstrap = {
        "schema": "personaos-discovery-bootstrap/1",
        "generated_at": now_iso(),
        "kernel_id": (provider_index["kernels"][0]["kernel_id"] if provider_index["kernels"] else ""),
        "keys_url": ".well-known/personaos-keys.json",
        "providers_url": "discovery/providers.json",
        "planes": {
            "internet": {"transports": [".well-known", "gossip", "kademlia_dht"]},
            "intranet": {"transports": ["mdns"], "note": "browser probes peer URLs; native runtime does multicast mDNS"},
        },
        "access_model": ["discover", "r", "rw", "admin"],
    }
    _write_json(out / ".well-known" / "personaos-discovery.json", bootstrap)

    (out / "assets").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(_VENDOR, out / "assets" / "noble-ed25519.js")
    (out / "index.html").write_text(_PORTAL_HTML.replace("__TITLE__", html.escape(title)),
                                    encoding="utf-8")
    (out / "assets" / "discovery.css").write_text(_PORTAL_CSS.strip() + "\n", encoding="utf-8")
    (out / "assets" / "discovery.js").write_text(_PORTAL_JS.strip() + "\n", encoding="utf-8")

    return {
        "pages_report_passed": bool(pages_report.get("passed")),
        "bootstrap": (out / ".well-known" / "personaos-discovery.json").as_posix(),
        "providers": (out / "discovery" / "providers.json").as_posix(),
        "provider_count": provider_index["provider_count"],
        "kernels": [k.get("kernel_id") for k in provider_index["kernels"]],
    }


_PORTAL_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>__TITLE__</title>
  <link rel="stylesheet" href="assets/discovery.css">
</head>
<body>
  <header class="hero">
    <p class="eyebrow">PersonaOS &middot; runtime decentralised discovery</p>
    <h1>__TITLE__</h1>
    <p class="lede">This page <strong>discovers at runtime</strong>: it bootstraps from
      <code>.well-known</code>, does a <span class="plane internet">Kademlia DHT</span>
      provider lookup, then <strong>resolves and cryptographically verifies every record live
      in your browser</strong> (Ed25519) before showing it &mdash; across the internet
      (<code>.well-known</code> + gossip + DHT) and intranet
      (<span class="plane intranet">mDNS</span>) planes, access-gated
      <code>discover &lt; read &lt; write &lt; admin</code>.</p>
    <div class="stats" id="stats"></div>
    <div class="peerbar">
      <input id="peer" type="url" placeholder="Diagnostic peer route: https://host" aria-label="Peer URL">
      <button id="addpeer">Discover peer</button>
      <button id="rescan">Re-run discovery</button>
    </div>
  </header>

  <main>
    <section class="controls">
      <input type="search" id="q" placeholder="Filter discovered records&hellip;" aria-label="Filter">
      <div class="chips" id="plane-filter" role="group" aria-label="Plane">
        <button data-plane="all" class="chip on">All planes</button>
        <button data-plane="internet" class="chip">Internet (DHT)</button>
        <button data-plane="intranet" class="chip">Intranet (mDNS)</button>
      </div>
      <div class="chips" id="kind-filter" role="group" aria-label="Kind"></div>
    </section>

    <div class="split">
      <section class="results" id="results" aria-live="polite"></section>
      <aside class="logwrap">
        <h2>Discovery log <span class="muted" id="logcount"></span></h2>
        <ol class="log" id="log"></ol>
      </aside>
    </div>

    <section class="federate">
      <h2>How this discovers (not a directory dump)</h2>
      <p>Records are <b>not</b> listed inline. The browser fetches a DHT provider index of
        opaque <code>key &rarr; record_url</code> pointers, then resolves each record and
        <b>verifies its Ed25519 signature against the kernel's published key</b> before trust.
        A failed signature is dropped. Add a peer kernel's URL above and it is discovered and
        verified the same way &mdash; this portal is generic for any PersonaOS kernel.
        True multicast mDNS / libp2p Kademlia run in the native runtime; the browser profile
        verifies over HTTP(S) (<a href="https://github.com/ai-personas">09_PROTOCOLS &sect;3H.3</a>).</p>
    </section>
  </main>

  <footer><span id="status">starting discovery&hellip;</span></footer>
  <script type="module" src="assets/discovery.js"></script>
</body>
</html>
"""

_PORTAL_CSS = """
:root{color-scheme:light dark;--ink:#10151c;--muted:#5b6675;--line:#d7dde5;--panel:#fff;
  --band:#f3f6fa;--internet:#1f6feb;--intranet:#1a7f5a;--accent:#7b3fe4;--chip:#eef1f6;--ok:#1a7f5a;--bad:#c0392b;}
@media (prefers-color-scheme:dark){:root{--ink:#e7edf5;--muted:#9aa7b8;--line:#26303d;
  --panel:#121821;--band:#0d131b;--chip:#1a222d;}}
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,
  "Segoe UI",sans-serif;color:var(--ink);background:var(--band)}
a{color:var(--internet)}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em}
.hero{padding:44px clamp(18px,5vw,72px) 24px;background:linear-gradient(160deg,#eef2f8,#e6ecf6);border-bottom:1px solid var(--line)}
@media (prefers-color-scheme:dark){.hero{background:linear-gradient(160deg,#0e151e,#0b121b)}}
.eyebrow{margin:0;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.76rem}
h1{margin:.2em 0;font-size:clamp(2rem,5vw,3.4rem);line-height:1.04;font-weight:800}
.lede{margin:.4em 0 0;max-width:900px;font-size:1.02rem;line-height:1.5}
.plane{padding:1px 8px;border-radius:999px;font-weight:700;font-size:.92em;color:#fff}
.plane.internet{background:var(--internet)}.plane.intranet{background:var(--intranet)}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:92px}
.stat b{display:block;font-size:1.5rem;line-height:1}.stat span{color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.04em}
.peerbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.peerbar input{flex:1 1 320px;padding:9px 12px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--ink)}
.peerbar button{padding:9px 14px;border:1px solid var(--ink);background:var(--ink);color:var(--panel);border-radius:9px;cursor:pointer;font-weight:600}
main{padding:22px clamp(18px,5vw,72px) 60px}
.controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:18px}
#q{flex:1 1 240px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{border:1px solid var(--line);background:var(--chip);color:var(--ink);padding:8px 12px;border-radius:999px;cursor:pointer;font-size:.86rem}
.chip.on{background:var(--ink);color:var(--panel);border-color:var(--ink)}
.split{display:grid;grid-template-columns:1fr;gap:18px}
@media(min-width:1040px){.split{grid-template-columns:1.6fr 1fr}}
.results{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;align-content:start}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:15px;display:flex;flex-direction:column;gap:8px}
.card .top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.badge{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:6px;color:#fff}
.badge.persona{background:#7b3fe4}.badge.env{background:#0b7285}.badge.artifact{background:#9a4d18}
.badge.telemetry{background:#b3245e}.badge.knowledge{background:#2b6cb0}.badge.skill{background:#2f855a}
.badge.tool{background:#555}.badge.project{background:#3b5bdb}.badge.domain{background:#0b7a4b}
.verified{font-size:.7rem;font-weight:700;color:var(--ok);border:1px solid var(--ok);border-radius:6px;padding:2px 7px}
.card h3{margin:0;font-size:1.05rem;overflow-wrap:anywhere}
.card .desc{color:var(--muted);font-size:.88rem;margin:0;line-height:1.4}
.caps{display:flex;flex-wrap:wrap;gap:5px}.cap{background:var(--chip);border:1px solid var(--line);border-radius:6px;padding:1px 7px;font-size:.72rem;color:var(--muted)}
.meta{display:flex;flex-wrap:wrap;gap:6px}.pill{font-size:.7rem;border:1px solid var(--line);border-radius:999px;padding:2px 9px;color:var(--muted)}
.pill.internet{border-color:var(--internet);color:var(--internet)}.pill.intranet{border-color:var(--intranet);color:var(--intranet)}.pill.tier{font-weight:700}
.access{font-size:.76rem;color:var(--muted);border-top:1px dashed var(--line);padding-top:7px}.access b{color:var(--ink)}
.did{font-size:.7rem;color:var(--muted);overflow-wrap:anywhere}
.logwrap{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;max-height:560px;overflow:auto;position:sticky;top:12px}
.logwrap h2{margin:0 0 8px;font-size:1rem}.muted{color:var(--muted);font-weight:400}
.log{list-style:none;margin:0;padding:0;font-family:ui-monospace,Menlo,monospace;font-size:.78rem;line-height:1.5}
.log li{display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--line)}
.log .tag{font-weight:700;min-width:74px;text-transform:uppercase;font-size:.66rem;letter-spacing:.04em;color:var(--accent)}
.log .ok{color:var(--ok)}.log .bad{color:var(--bad)}
.federate{margin-top:26px;padding:16px 20px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.federate h2{margin:0 0 6px;font-size:1.05rem}.federate p{margin:0;color:var(--muted);line-height:1.5}
footer{padding:14px clamp(18px,5vw,72px);color:var(--muted);border-top:1px solid var(--line);font-size:.84rem}
.empty{color:var(--muted);padding:40px 0;text-align:center}
"""

_PORTAL_JS = """
import * as ed from './noble-ed25519.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KIND_LABEL = {persona:'Personas',env:'Environments',project:'Projects',domain:'Domains',
  artifact:'Artifacts',telemetry:'Telemetry',knowledge:'Knowledge',skill:'Skills',tool:'Tools'};
const enc = new TextEncoder();
const hexToBytes = (h)=> Uint8Array.from((h||'').match(/.{1,2}/g)?.map((b)=>parseInt(b,16)) || []);
// Canonical bytes identical to personaos canonical_bytes: sorted keys, compact, UTF-8.
function canon(v){
  if(v===null||v===undefined) return 'null';
  if(Array.isArray(v)) return '['+v.map(canon).join(',')+']';
  if(typeof v==='object') return '{'+Object.keys(v).sort().map((k)=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
const state = {records: [], plane:'all', kind:'all', q:'', kernels:new Set()};

const join = (base, rel)=> !base ? rel : base.replace(/\\/$/,'')+'/'+rel.replace(/^\\//,'');
async function fetchJson(url){ try{ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) return null; return await r.json(); }catch(e){ return null; } }

const logEl = ()=> document.getElementById('log');
function log(tag, msg, status){ const li=document.createElement('li');
  const cls = status===true?'ok':status===false?'bad':'';
  li.innerHTML = `<span class="tag">${esc(tag)}</span><span class="${cls}">${esc(msg)}</span>`;
  logEl().appendChild(li); document.getElementById('logcount').textContent = `(${logEl().children.length})`;
  logEl().parentElement.scrollTop = logEl().parentElement.scrollHeight; }

async function verifyRecord(doc, keys){
  const pubHex = keys[doc.signing_key_id]; if(!pubHex) return false;
  try{ return await ed.verifyAsync(hexToBytes(doc.signature_hex), enc.encode(canon(doc.record)), hexToBytes(pubHex)); }
  catch(e){ return false; }
}
const planesOf = (tier)=> ['federation','public'].includes(tier) ? ['internet','intranet'] : ['intranet'];

async function discoverFrom(base, sourceLabel){
  const where = base || (location.origin+ ' (this kernel)');
  log('bootstrap', `${where}: .well-known/personaos-discovery.json`);
  const boot = await fetchJson(join(base, '.well-known/personaos-discovery.json'));
  if(!boot){ log('bootstrap', `no discovery endpoint at ${where}`, false); return []; }
  if(boot.kernel_id) state.kernels.add(boot.kernel_id);
  const keysDoc = await fetchJson(join(base, boot.keys_url || '.well-known/personaos-keys.json'));
  const keys = {}; (keysDoc?.keys||[]).forEach((k)=> keys[k.key_id]=k.public_key_hex);
  log('keys', `loaded ${Object.keys(keys).length} kernel key(s) for ${boot.kernel_id||where}`);
  const prov = await fetchJson(join(base, boot.providers_url || 'discovery/providers.json'));
  const providers = prov?.providers || [];
  log('dht', `provider index → ${providers.length} key(s) to resolve + verify`);
  const found = [];
  for(const p of providers){
    const doc = await fetchJson(join(base, p.record_url));
    if(!doc || !doc.record){ log('resolve', `${(p.key||'').slice(0,22)}… unresolved`, false); continue; }
    const ok = await verifyRecord(doc, keys);
    const r = doc.record;
    log('verify', `${r.kind}: ${(r.label||p.did||'').slice(0,30)} — Ed25519 ${ok?'OK':'FAIL'}`, ok);
    if(ok){ found.push({...r, _source: sourceLabel, _kernel: boot.kernel_id||'', _key:p.key,
      _record_url: join(base,p.record_url), _access: (doc.access_policy||{})}); }
  }
  log('done', `${where}: ${found.length}/${providers.length} record(s) discovered + verified`, true);
  return found;
}

function peerList(){
  let saved=[]; try{ saved = JSON.parse(localStorage.getItem('personaos_peers')||'[]'); }catch(e){}
  return [...new Set(saved)];
}

async function discover(){
  logEl().innerHTML=''; state.records=[]; state.kernels=new Set();
  document.getElementById('status').textContent='discovering…';
  // Internet plane: this origin's published kernel (.well-known + DHT provider index).
  let recs = await discoverFrom('', 'internet');
  // Intranet plane: probe configured LAN peer kernels (browser equivalent of mDNS).
  const peers = peerList();
  if(peers.length===0) log('mdns', 'no local diagnostic peer route configured');
  for(const base of peers){ recs = recs.concat(await discoverFrom(base, 'intranet')); }
  // Dedup by record id across sources.
  const byId = new Map();
  for(const r of recs){ const id=r.record_id||r.card_id||r._key; if(!byId.has(id)) byId.set(id, r); }
  state.records = [...byId.values()];
  render();
  document.getElementById('status').textContent =
    `discovered + verified ${state.records.length} record(s) from ${state.kernels.size||1} kernel(s) · internet (.well-known + DHT) + intranet (mDNS) · access-gated`;
}

function renderStats(){
  const r=state.records, byKind={}; r.forEach((x)=>byKind[x.kind]=(byKind[x.kind]||0)+1);
  const internet=r.filter((x)=>planesOf(x.visibility_tier).includes('internet')).length;
  const stats=[['Verified',r.length],['Personas',byKind.persona||0],['Kernels',state.kernels.size||1],['On internet',internet]];
  document.getElementById('stats').innerHTML = stats.map(([s,b])=>`<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
  const kinds=['all',...Object.keys(byKind).sort()];
  document.getElementById('kind-filter').innerHTML = kinds.map((k)=>
    `<button data-kind="${esc(k)}" class="chip${k===state.kind?' on':''}">${esc(k==='all'?'All kinds':(KIND_LABEL[k]||k))}</button>`).join('');
}
function matches(r){
  if(state.plane!=='all' && !planesOf(r.visibility_tier).includes(state.plane)) return false;
  if(state.kind!=='all' && r.kind!==state.kind) return false;
  if(state.q){ const hay=[r.label,r.description,r.did,r._kernel,(r.capability_summary||[]).join(' '),r.kind].join(' ').toLowerCase();
    if(!hay.includes(state.q.toLowerCase())) return false; }
  return true;
}
function card(r){
  const planes=planesOf(r.visibility_tier).map((p)=>`<span class="pill ${p}">${p==='internet'?'Internet · DHT':'Intranet · mDNS'}</span>`).join('');
  const caps=(r.capability_summary||[]).filter(Boolean).map((c)=>`<span class="cap">${esc(c)}</span>`).join('');
  const grants=(r._access?.access_grants)||[];
  const readers = grants.length ? grants.filter((g)=>['r','rw','admin'].includes(g.access_level)).map((g)=>`${g.grantee_kind}:${(g.grantee_id||'').slice(0,8)}`).join(', ') : 'owner only';
  return `<article class="card">
    <div class="top"><span class="badge ${esc(r.kind)}">${esc(r.kind)}</span>
      <span class="pill tier">${esc(r.visibility_tier)}</span><span class="verified">✓ Ed25519</span></div>
    <h3>${esc(r.label||r.record_id||r.card_id)}</h3>
    <p class="desc">${esc(r.description||'')}</p>
    ${caps?`<div class="caps">${caps}</div>`:''}
    <div class="meta">${planes}</div>
    <p class="did">${esc(r.did||r.record_id||'')} · <span title="publishing kernel">${esc((r._kernel||'').slice(0,18))}</span></p>
    <div class="access"><b>discover</b>: federated peers &amp; LAN · <b>read</b>: ${esc(readers)} · <a href="${esc(r._record_url)}">signed record →</a></div>
  </article>`;
}
function render(){
  renderStats();
  const out=state.records.filter(matches);
  document.getElementById('results').innerHTML = out.length ? out.map(card).join('')
    : '<p class="empty">No verified records match these filters.</p>';
}
function wire(){
  document.getElementById('q').addEventListener('input',(e)=>{state.q=e.target.value;render();});
  document.getElementById('plane-filter').addEventListener('click',(e)=>{const b=e.target.closest('button');if(!b)return;
    state.plane=b.dataset.plane;[...e.currentTarget.children].forEach((c)=>c.classList.toggle('on',c===b));render();});
  document.getElementById('kind-filter').addEventListener('click',(e)=>{const b=e.target.closest('button');if(!b)return;
    state.kind=b.dataset.kind;[...e.currentTarget.children].forEach((c)=>c.classList.toggle('on',c===b));render();});
  document.getElementById('addpeer').addEventListener('click',()=>{const v=document.getElementById('peer').value.trim();
    if(!v)return; let s=[];try{s=JSON.parse(localStorage.getItem('personaos_peers')||'[]');}catch(e){} if(!s.includes(v))s.push(v);
    localStorage.setItem('personaos_peers',JSON.stringify(s)); discover();});
  document.getElementById('rescan').addEventListener('click',discover);
}
wire(); discover().catch((e)=>{document.getElementById('status').textContent='discovery error'; console.error(e);});
"""
