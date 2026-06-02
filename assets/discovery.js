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

const join = (base, rel)=> !base ? rel : base.replace(/\/$/,'')+'/'+rel.replace(/^\//,'');
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
  const params = new URLSearchParams(location.search);
  const fromUrl = params.getAll('peer');
  let saved=[]; try{ saved = JSON.parse(localStorage.getItem('personaos_peers')||'[]'); }catch(e){}
  return [...new Set([...fromUrl, ...saved])];
}

async function discover(){
  logEl().innerHTML=''; state.records=[]; state.kernels=new Set();
  document.getElementById('status').textContent='discovering…';
  // Internet plane: this origin's published kernel (.well-known + DHT provider index).
  let recs = await discoverFrom('', 'internet');
  // Intranet plane: probe configured LAN peer kernels (browser equivalent of mDNS).
  const peers = peerList();
  if(peers.length===0) log('mdns', 'no LAN peer configured — add ?peer=https://host for cross-host intranet discovery');
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
