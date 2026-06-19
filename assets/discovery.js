import * as ed from './noble-ed25519.js';

const $=(s)=>document.querySelector(s);
const esc=(s)=>String(s??'').replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const enc=new TextEncoder();
const hexToBytes=(h)=>Uint8Array.from((h||'').match(/.{1,2}/g)?.map((b)=>parseInt(b,16))||[]);
const pad=(n,w=2)=>String(n).padStart(w,'0');
const KIND_LABEL={persona:'PERSONA',env:'ENV',project:'PROJECT',domain:'DOMAIN',artifact:'ARTIFACT',telemetry:'TELEMETRY',knowledge:'KNOWLEDGE',skill:'SKILL',tool:'TOOL',mission:'MISSION'};
const SPARK_N=32, BUCKET_MS=650;

// canonical bytes == personaos canonical_bytes (sorted keys, compact, UTF-8)
function canon(v){
  if(v===null||v===undefined)return 'null';
  if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
  if(typeof v==='object')return '{'+Object.keys(v).sort().map((k)=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
async function verifyRecord(doc,keys){
  const pk=keys[doc.signing_key_id]; if(!pk) return false;
  try{ return await ed.verifyAsync(hexToBytes(doc.signature_hex),enc.encode(canon(doc.record)),hexToBytes(pk)); }
  catch(e){ return false; }
}
const isAbs=(u)=>/^https?:\/\//i.test(String(u||''));
const isHttp=(u)=>/^https?:\/\//i.test(String(u||''));
const join=(b,r)=>{ if(isAbs(r))return r; if(!b)return r; return b.replace(/\/$/,'')+'/'+String(r||'').replace(/^\//,''); };
/* ---------- operator authority (A5-01/A5-08: a BEARER TOKEN, never network position) ----------
   The node mints a per-install token (printed at boot, stored under runs/.../_operator/token).
   Saved per node base in localStorage; every fetch to that base carries it, unlocking owner
   intake (/task /budget /stop), full /status, /runs, /personas and the gated static tree.
   Anonymous viewers keep working — they see each node's public discovery projection only. */
function opTokens(){ try{ return JSON.parse(localStorage.getItem('personaos_operator')||'{}'); }catch(e){ return {}; } }
function opSaveTokens(m){ localStorage.setItem('personaos_operator',JSON.stringify(m)); updateOpBadge(); }
const opBaseKey=(b)=>String(b||location.origin).replace(/\/$/,'');
// A node reachable on localhost IS the owner's own machine: the node trusts a
// genuine loopback caller (no tunnel/proxy hop) as operator, so the bearer token
// is bypassed for it. A tunneled node keeps the public hostname and still needs a
// token. This only flips operator affordances ON for local nodes — never off.
const isLocalBase=(b)=>{ try{ const h=new URL(opBaseKey(b),location.href).hostname;
  return h==='localhost'||h==='127.0.0.1'||h==='[::1]'||h==='::1'; }catch(e){ return false; } };
function tokenFor(u){ const m=opTokens(); const abs=isAbs(u)?u:join(location.origin,u);
  let best='',tok=''; for(const k in m){ if(abs.startsWith(k)&&k.length>best.length){ best=k; tok=m[k]; } }
  return tok; }
function authHeaders(u){ const t=tokenFor(u); return t?{'Authorization':'Bearer '+t}:{}; }
function updateOpBadge(){ const b=$('#opbtn'); if(!b) return;
  const n=Object.keys(opTokens()).length; b.classList.toggle('on',n>0);
  b.textContent=n>0?`🔑 OPERATOR · ${n}`:'🔑 OPERATOR'; }
async function fetchJson(u){ try{ const r=await fetch(u,{cache:'no-store',headers:authHeaders(u)}); if(!r.ok)return null; return await r.json(); }catch(e){ return null; } }
const planesOf=(t)=>['federation','public'].includes(t)?['internet','intranet']:['intranet'];

const S={ recs:new Map(), order:[], kernels:new Set(), events:[], emitted:0, rIdx:0, lastEmit:0,
  paused:false, sort:'events', dir:-1, plane:'all', kind:'all', q:'', epsWin:[], evCount:0, live:false,
  map:{}, mapByKernel:{}, telLoaded:new Set(), eventKeys:new Set(), keys:new Map(), boots:new Map(),
  streams:new Map(), p2pBootstraps:new Set(), views:[], curBase:'',
  bundleDirs:new Set(), bundleDirsOpen:new Set(),
  // Live per-entity telemetry index: base → latest live telemetry doc, plus
  // derived per-persona / per-env activity. Lets each persona + env view show
  // what is happening INSIDE it right now (model selections, evolution, lineage).
  liveTel:new Map(), liveByPersona:new Map(), liveByEnv:new Map(), drawerTimer:null,
  // living-network state: heartbeat (always-on baseline), vital-sign spike queue,
  // persistent constellation node positions/elements, env count, persona-follow.
  heartbeat:null, vitalSpikes:[], nodePos:new Map(), gnodes:new Map(), envCount:0,
  follow:null, sysFlt:'all' };

// honour the viewer's motion preference: freeze the ambient/firing animations
// (canvas trace, traveling pulses, breathe/heartbeat) while keeping all STATE —
// counters, colours, fresh-classes, feed rows — fully live.
const RM=(typeof matchMedia!=='undefined')&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// Index a live-telemetry doc per-persona and per-env so the detail views can
// render each entity's OWN activity (model_events carry persona_id +
// environment_id; spans carry scope + trace_id). Keyed by short persona/env id.
const _shortId=(s)=>String(s||'').replace(/^did:personaos:[^:]+:/,'').replace(/^(persona|env|kernel):/,'');
// The workspace RUN id (k/run-XXXX) every record carries in its resolved links /
// url. It is the reliable join between an environment and ITS deliverables: an
// env record and the artifact bundle + files it produced all share one run path.
function runOf(r){ if(!r) return null;
  const cands=[...Object.values(r._links||{}), r._url, r._base];
  for(const v of cands){ if(typeof v==='string'){ const m=v.match(/k\/run-[0-9A-Za-z]+/); if(m) return m[0]; } }
  // Some records (notably ARTIFACTS) carry the run path only NESTED — e.g. an env+federation tier
  // artifact's body is gated, so its run lives in links.content_stub.note/locator, not a top-level
  // string link. Deep-scan the links blob so a deliverable still joins to ITS env lane.
  try{ const m=JSON.stringify(r._links||{}).match(/k\/run-[0-9A-Za-z]+/); if(m) return m[0]; }catch(e){}
  return null; }
// The bare env ULID — the live entities feed keys envs as `env:<ULID>` (→ ULID
// via _shortId), but an env RECORD's DID is `…:<kernel>/env/env:<ULID>`, which
// _shortId leaves long. Match on the ULID so a live lane + its discovered record
// merge into ONE lane instead of two.
function _envSid(r){ const sub=(r._links||{}).subject_id;
  if(sub){ const m=String(sub).match(/([0-9A-HJKMNP-TV-Z]{20,})/i); if(m) return m[1]; }
  const m2=String(r.did||r.record_id||'').match(/env:([0-9A-HJKMNP-TV-Z]{20,})/i);
  return m2?m2[1]:_shortId(r.did||r.record_id||''); }
function indexLiveTelemetry(base,live){
  if(!live||typeof live!=='object') return;
  S.liveTel.set(base||'@origin',live);
  // the always-on baseline pulse: node.heartbeat is present + running on every
  // node sample, so the page is alive the instant it loads even when both event
  // streams are momentarily quiet — and it NEVER fakes activity.
  if(live.node&&live.node.heartbeat) S.heartbeat=live.node.heartbeat;
  const me=(live.kernel&&live.kernel.model_events)||[];
  const sp=(live.kernel&&live.kernel.spans)||[];
  const personas=live.personas||[];
  const t=Date.parse(live.generated_at||'')||Date.now();
  // model selections → per persona and per env
  const byP=new Map(), byE=new Map();
  me.forEach((m,i)=>{
    if((m.kind||'')!=='MODEL_SELECTED') return;
    const rec={t:t-((me.length-i)*200), purpose:String(m.requested_purpose||m.purpose||m.role||'model'),
      model:String(m.model_id||'—'), role:String(m.role||''), reason:String(m.reason||'')};
    const pid=_shortId(m.persona_id); if(pid){ (byP.get(pid)||byP.set(pid,[]).get(pid)).push(rec); }
    const eid=_shortId(m.environment_id); if(eid){ (byE.get(eid)||byE.set(eid,[]).get(eid)).push(rec); }
  });
  // lineage spans → per env (scope=environment), per task/domain too
  const spByE=new Map();
  sp.forEach((s)=>{ const a=s.attributes||{}; const sc=a['personaos.lineage.scope'];
    const tid=_shortId(a['personaos.trace_id']);
    if(sc==='environment'&&tid){ (spByE.get(tid)||spByE.set(tid,[]).get(tid)).push({
      kind:String(a['personaos.lineage.event_kind']||s.name||'SPAN'),
      signed:a['personaos.lineage.signed']===true,   // fail-CLOSED: only an explicit true counts as signed
      t:Date.parse(s.ended_at||s.started_at||'')||t }); } });
  personas.forEach((p)=>{ const pid=_shortId(p.persona_id);
    const cur=S.liveByPersona.get(pid)||{};
    S.liveByPersona.set(pid,{...cur,summary:p,models:byP.get(pid)||cur.models||[],generated_at:live.generated_at}); });
  for(const [pid,models] of byP){ if(!S.liveByPersona.has(pid)) S.liveByPersona.set(pid,{models,generated_at:live.generated_at}); }
  for(const [eid,models] of byE){ const cur=S.liveByEnv.get(eid)||{};
    S.liveByEnv.set(eid,{...cur,models,spans:spByE.get(eid)||cur.spans||[],generated_at:live.generated_at}); }
  for(const [eid,spans] of spByE){ const cur=S.liveByEnv.get(eid)||{};
    if(!cur.spans) S.liveByEnv.set(eid,{...cur,spans,generated_at:live.generated_at}); }
  // VITAL SPIKES from model_events growth: a persona just asked a model to do
  // something. Honest — fires only when a persona's req/resp count GREW since
  // last poll (a static snapshot spikes once on cold load, then rests).
  S.modelCount=S.modelCount||new Map();
  S.lastActiveAt=S.lastActiveAt||new Map();   // sid -> ts of last GENUINE activity growth (running-now signal)
  for(const [pid,models] of byP){
    const prev=S.modelCount.get(pid); const now2=models.length;
    if(prev!=null && now2>prev){ const g=Math.min(now2-prev,6);
      for(let k=0;k<g;k++) _pushSpike('produce');
      S.lastActiveAt.set(pid,Date.now());   // this persona just asked a model → it is RUNNING NOW
      setTimeout(()=>_fireEdge(pid,'produce'),60); }   // the persona just asked a model → its edge fires
    S.modelCount.set(pid,now2);
  }
  // WHO→WHOM interaction stream (kernel.interactions): actor → affected : kind.
  // Drives the coordination feed + constellation. Keyed by a stable signature so
  // re-polls don't duplicate; newest kept (ring of 400). On the FIRST load we
  // seed the ring WITHOUT spiking the vital or firing edges (the 400-ring spans
  // hours — stale events must not animate); only genuinely-new keys fire after.
  const ix=(live.kernel&&live.kernel.interactions)||[];
  if(ix.length){
    S.interactions=S.interactions||[]; S.ixKeys=S.ixKeys||new Set();
    const cold=!S.ixColdLoaded; let fired=0; const fresh=[];
    ix.forEach((e,i)=>{
      const aff=(e.affected||[]).map((a)=>`${a.kind}:${a.id}`).join(',');
      const key=`${base}|${e.scope_id}|${e.actor_id}|${aff}|${e.kind}|${e.at||i}`;
      if(S.ixKeys.has(key)) return; S.ixKeys.add(key);
      const rec={...e, _base:base, _t:Date.parse(e.at||'')||t, _key:key};
      S.interactions.push(rec); fresh.push(rec);
    });
    S.interactions.sort((a,b)=>a._t-b._t);
    if(S.interactions.length>400) S.interactions=S.interactions.slice(-400);
    // bound the dedup/seen sets to the live ring so a long-running page doesn't
    // leak (the node never re-sends an evicted event, so this can't re-fire one).
    const liveKeys=new Set(S.interactions.map((e)=>e._key)); S.ixKeys=liveKeys;
    if(S.ixSeen) for(const k of [...S.ixSeen]) if(!liveKeys.has(k)) S.ixSeen.delete(k);
    // index recent coordination acts PER PERSONA (actor + affected) so a persona
    // card can stream its activity in live state A (interactions, no model_events).
    const _ixSids=(e)=>[e.actor_kind==='persona'?_shortId(e.actor_id):null,
      ...(e.affected||[]).filter((a)=>a.kind==='persona').map((a)=>_shortId(a.id))].filter(Boolean);
    S.ixByPersona=new Map();
    for(const e of S.interactions) for(const sid of _ixSids(e)){
      const arr=S.ixByPersona.get(sid)||S.ixByPersona.set(sid,[]).get(sid); arr.push({kind:e.kind,_t:e._t}); }
    for(const [,arr] of S.ixByPersona) if(arr.length>12) arr.splice(0,arr.length-12);
    if(!cold){
      S.ixCountBySid=S.ixCountBySid||new Map();
      for(const rec of fresh){
        // monotonic per-persona act tally → drives the card flash on genuine growth
        // coordination acts drive the edge-fire + per-card tally, but they do NOT mark a
        // persona 'running': 'running' means actively IN A MODEL CALL (set only on
        // model_events growth above). A persona merely NAMED in a routed message is not
        // itself in an LLM call — conflating the two made every coordinated persona pulse.
        for(const sid of _ixSids(rec)){ S.ixCountBySid.set(sid,(S.ixCountBySid.get(sid)||0)+1); }
        if(fired>=12) continue;               // vital spike + edge fire are capped/staggered
        _pushSpike(_ixClass(rec.kind)); fired++;
        const cls=_ixClass(rec.kind), d=Math.min(fired*120,1500);
        _ixSids(rec).forEach((sid)=>setTimeout(()=>_fireEdge(sid,cls),d));
      }
    }
    S.ixColdLoaded=true;
  }
  // PERSONA MESSAGES (live monitor): a persona's model request IS a live message.
  // kernel.model_events carry persona_id + model + purpose + rationale (no timestamp),
  // so order them off the live frame time and merge them into the SAME feed (deduped,
  // ring-bounded) — the monitor then shows WHAT each persona is asking its model in
  // real time, not only who→whom coordination. Never fabricated: pure node telemetry.
  const me2=(live.kernel&&live.kernel.model_events)||[];
  if(me2.length){
    S.interactions=S.interactions||[]; S.ixKeys=S.ixKeys||new Set();
    const baseT=Date.parse(live.generated_at||'')||t; let addedM=0;
    me2.forEach((m,i)=>{
      if(String(m.kind||'')!=='MODEL_SELECTED') return;
      const model=String(m.model_id||'—'), purpose=String(m.requested_purpose||m.purpose||'model');
      const role=String(m.role||''), rationale=String(m.rationale||m.reason||'');
      const key=`${base}|model|${m.persona_id||''}|${model}|${purpose}|${role}|${rationale}|${i}`;
      if(S.ixKeys.has(key)) return; S.ixKeys.add(key); addedM++;
      S.interactions.push({actor_id:String(m.persona_id||''),actor_kind:m.persona_id?'persona':'kernel',
        affected:[{id:model,kind:'model'}],kind:'MODEL_CALL',scope:'model',scope_id:String(m.environment_id||''),
        at:'',_base:base,_t:baseT-((me2.length-i)*200),_key:key,
        _msg:purpose+(role&&role!=='-'&&role!==''?(' · '+role):''),_model:model,_rationale:rationale});
    });
    if(addedM){
      S.interactions.sort((a,b)=>a._t-b._t);
      if(S.interactions.length>400) S.interactions=S.interactions.slice(-400);
      S.ixKeys=new Set(S.interactions.map((e)=>e._key));
    }
  }
}

/* ---------- discovery log ---------- */
function log(tag,msg,ok){ const li=document.createElement('li');
  const c=ok===true?'ok':ok===false?'bad':'';
  li.innerHTML=`<span class="tag2">${esc(tag)}</span><span class="${c}">${esc(msg)}</span>`;
  $('#log').appendChild(li); }

/* ---------- discovery (runtime resolve + in-browser verify) ---------- */
function collectP2PBootstraps(boot){
  for(const v of [...(boot?.bootstrap_peers||[]),...(boot?.relay_peers||[]),
    ...((boot?.reachability_profile||{}).bootstrap_peers||[]),
    ...((boot?.reachability_profile||{}).relay_peers||[])]){
    if(v) S.p2pBootstraps.add(v);
  }
}
async function keysFor(base,boot){
  const key=base||'@origin';
  if(S.keys.has(key)) return S.keys.get(key);
  const keysDoc=await fetchJson(join(base,boot?.keys_url||'.well-known/personaos-keys.json'));
  const keys={}; (keysDoc?.keys||[]).forEach((k)=>keys[k.key_id]=k.public_key_hex);
  S.keys.set(key,keys);
  return keys;
}
async function verifiedRecordFromDoc(doc,keys,boot,base,plane,recordUrl){
  if(!doc?.record) return {ok:false,row:null};
  const ok=await verifyRecord(doc,keys);
  if(!ok) return {ok:false,row:null};
  const r=doc.record, k=doc.host_kernel_id||boot?.kernel_id||'', b=doc.base||base||'';
  return {ok:true,row:{...r,_kernel:k,_url:recordUrl?join(base,recordUrl):(doc._url||''),_access:doc.access_policy||{},
    _links:doc.links||{},_base:b,_plane:plane,
    _doc:{record:doc.record,signature_hex:doc.signature_hex,signing_key_id:doc.signing_key_id,
          public_key_hex:keys[doc.signing_key_id]||'',kernel_id:k,host_kernel_id:doc.host_kernel_id||'',
          base:b,links:doc.links||{},access_policy:doc.access_policy||{}}}};
}
async function discoverFrom(base,plane){
  const where=base||location.origin;
  log('bootstrap',`${where}/.well-known/personaos-discovery.json`);
  const boot=await fetchJson(join(base,'.well-known/personaos-discovery.json'));
  S.peerHealth=(S.peerHealth||new Map());
  if(!boot){ log('bootstrap',`no endpoint at ${where}`,false);
    S.peerHealth.set(where,{ok:false,records:0,t:Date.now()}); return {boot:null,found:[]}; }
  S.boots.set(base||'@origin',boot); collectP2PBootstraps(boot);
  if(boot.kernel_id) S.kernels.add(boot.kernel_id);
  const keys=await keysFor(base,boot);
  const prov=await fetchJson(join(base,boot.providers_url||'discovery/providers.json'));
  const providers=prov?.providers||[];
  log('dht',`${boot.kernel_id||where}: ${providers.length} provider key(s)${boot.providers_are_aggregate?' · public aggregate':''}`);
  const found=[];
  // PARALLEL record resolution (batches of 24): a node serving hundreds of
  // records — or reached over a WAN tunnel — must not cost one round-trip per
  // record. Ed25519 verification stays per-record after each batch lands.
  for(let i=0;i<providers.length;i+=24){
    const batch=providers.slice(i,i+24);
    const docs=await Promise.all(batch.map((p)=>fetchJson(join(base,p.record_url))
      .then((doc)=>({p,doc})).catch(()=>({p,doc:null}))));
    for(const {p,doc} of docs){
      if(!doc?.record) continue;
      const out=await verifiedRecordFromDoc(doc,keys,boot,base,plane,p.record_url);
      if(!out.ok){ const r=doc.record;
        log('verify',`${r.kind}: ${(r.label||p.did||'').slice(0,28)} — FAIL`,false); continue; }
      found.push(out.row);
    }
  }
  if(found.length) log('verify',`${found.length}/${providers.length} record(s) Ed25519-verified OK`,true);
  // GLOBAL P2P PLANE: a node running the libp2p bridge serves the verified
  // records it RECEIVED over gossipsub (discovery/p2p/received.json) — records
  // from kernels anywhere on the mesh, re-verified here against each record's
  // embedded key before joining the board (NET = P2P).
  const p2pDoc=await fetchJson(join(base,'discovery/p2p/received.json'));
  for(const doc of (p2pDoc?.records||[])){
    if(!doc?.record || doc.record.visibility_tier!=='public') continue;
    let ok=false;
    try{ ok=await ed.verifyAsync(hexToBytes(doc.signature_hex),enc.encode(canon(doc.record)),hexToBytes(doc.public_key_hex)); }catch(e){}
    if(!ok) continue;
    const k=doc.host_kernel_id||doc.kernel_id||'p2p';
    S.kernels.add(k); noteKernel(k,'p2p',doc.base||'');
    found.push({...doc.record,_kernel:k,_url:'',_access:doc.access_policy||{},
      _links:doc.links||{},_base:doc.base||'',_plane:'internet',_net:'p2p',_doc:doc});
  }
  // HTTP gossip cache: cards a peer pushed at this node (§3B). Cards marked
  // unverified by the receiving node are listed but never trusted with links.
  const gossip=await fetchJson(join(base,'gossip/cache'));
  for(const id in (gossip?.cards||gossip||{})){
    const card=(gossip.cards||gossip)[id]; if(!card||typeof card!=='object') continue;
    const k=card._originating_kernel||'gossip';
    if(card.kind||card.record_id){ S.kernels.add(k); noteKernel(k,'gossip',''); }
  }
  if(boot.kernel_id) noteKernel(boot.kernel_id,'http',base||location.origin);
  S.peerHealth.set(where,{ok:true,records:found.length,kernel:boot.kernel_id||'',t:Date.now()});
  return {boot,found};
}

// ---------- global kernel tracker (the "across the globe" strip) ----------
function noteKernel(kernelId,via,base){
  if(!kernelId) return;
  const g=S.globalKernels=(S.globalKernels||new Map());
  const cur=g.get(kernelId)||{via:new Set(),bases:new Set(),lastSeen:0};
  cur.via.add(via); if(base) cur.bases.add(base); cur.lastSeen=Date.now();
  g.set(kernelId,cur);
}
function renderGlobalKernels(){
  const el=$('#globalKernels'); if(!el) return;
  const g=S.globalKernels||new Map();
  if(!g.size){ el.innerHTML='<span class="dim">no kernels discovered yet</span>'; return; }
  const now=Date.now();
  el.innerHTML=[...g.entries()].map(([kid,info])=>{
    const fresh=(now-info.lastSeen)<45000;
    const via=[...info.via].map((v)=>`<span class="n ${v==='p2p'?'i':v==='gossip'?'m':'k'}">${v.toUpperCase()}</span>`).join('');
    return `<span class="gk ${fresh?'ok':'dim'}" title="${esc([...info.bases].join(' '))}">`
      +`<span class="dot ${fresh?'live':''}"></span>${esc(kid.replace(/^kernel:/,'').slice(0,12))} ${via}</span>`;
  }).join(' ');
}
// Peers come from three sources, merged + de-duped: the ?peer= query params, the
// "＋ PEER" localStorage list, and the published peers.txt file (fetched at boot).
let TXT_PEERS=[];
async function loadPeersTxt(){
  // peers.txt — one node URL per line; '#' comments + blank lines ignored. Each
  // listed node is bootstrapped + resolved + Ed25519-verified exactly like ?peer=.
  const t=await fetchText('peers.txt');
  TXT_PEERS = t ? t.split(/\r?\n/).map((s)=>s.trim()).filter((s)=>s && !s.startsWith('#')) : [];
  if(TXT_PEERS.length) log('peers.txt',`${TXT_PEERS.length} peer(s): ${TXT_PEERS.join(', ').slice(0,90)}`);
  else log('peers.txt','none listed');
  return TXT_PEERS;
}
function peerList(){ const p=new URLSearchParams(location.search).getAll('peer'); let s=[];
  try{ s=JSON.parse(localStorage.getItem('personaos_peers')||'[]'); }catch(e){}
  return [...new Set([...p,...s,...TXT_PEERS,...(S.ipfsPeers||[]),...(S.localPeers||[])])]; }

/* ---------- IPFS discovery plane (content-addressed rendezvous) ----------
   Every PersonaOS kernel pins the SAME deterministic rendezvous block
   ("personaos-discovery-rendezvous/v1") and publishes a SIGNED node card under
   its IPNS name. The UI enumerates the rendezvous CID's providers via the
   delegated-routing HTTP API, resolves each provider's signed node card (via the
   delegated-routing IPNS record → immutable /ipfs/<card-cid>, falling back to a
   gateway /ipns/<peer-id>), verifies the card's Ed25519 signature in-browser, and
   feeds the verified peer URL into the normal discovery plane. Purely additive to
   ?peer / +PEER / peers.txt / DHT / mDNS / gossipsub — unreachable IPFS infra
   degrades silently. Override endpoints with ?ipfs_routing= and ?ipfs_gw=. */
const IPFS_RENDEZVOUS_CID='Qmbnw4HfNbSp9YqpNBGoQqZcBgAbfF3reayr79DWxPqJgQ';
function ipfsRouting(){ const p=new URLSearchParams(location.search).get('ipfs_routing');
  return p||'https://delegated-ipfs.dev/routing/v1/providers/'; }
function ipfsGateways(){ const p=new URLSearchParams(location.search).getAll('ipfs_gw');
  return p.length?p:['https://ipfs.io','https://dweb.link']; }
// An /dns*/<host>/tcp/<port>/https (or tls/http) multiaddr in a provider record
// names the node's HTTP front door — kernels announce it via kubo
// Addresses.AppendAnnounce, so the URL rides the DHT provider record itself and
// NO IPNS resolution is needed for first contact. Transport info only: every
// record fetched from the URL is still Ed25519-verified before it is trusted.
function httpsFromMultiaddr(a){
  const m=/^\/dns[46]?\/([^/]+)\/tcp\/(\d+)\/(?:tls\/http|https?)(?:\/|$)/.exec(String(a||''));
  if(!m) return '';
  const port=m[2]==='443'?'':(':'+m[2]);
  return `https://${m[1]}${port}`;
}
// --- IPNS node-card resolution -------------------------------------------------
// Public gateways frequently FAIL to resolve a fresh /ipns/<peer-id> over the DHT
// (they 404 for many minutes), so the reliable path is the delegated-routing IPNS
// endpoint: it returns the signed IPNS record fast, we pull the /ipfs/<card-cid>
// it points at, and fetch that IMMUTABLE card from any gateway (always serveable).
// The routing endpoint needs the base36 CIDv1 libp2p-key form, so convert the
// base58 provider id first. Trust = the card's own Ed25519 signature (verified by
// the caller); the IPNS record is only an unsigned-to-us pointer.
const _B58A='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const _B36A='0123456789abcdefghijklmnopqrstuvwxyz';
function _baseDecode(str,alpha){ const bytes=[0];
  for(const ch of str){ const v=alpha.indexOf(ch); if(v<0) return null; let carry=v;
    for(let j=0;j<bytes.length;j++){ carry+=bytes[j]*alpha.length; bytes[j]=carry&0xff; carry>>=8; }
    while(carry){ bytes.push(carry&0xff); carry>>=8; } }
  for(let k=0;k<str.length&&str[k]===alpha[0];k++) bytes.push(0);
  return bytes.reverse(); }
function _baseEncode(bytes,alpha){ const digits=[0];
  for(const b of bytes){ let carry=b;
    for(let j=0;j<digits.length;j++){ carry+=digits[j]<<8; digits[j]=carry%alpha.length; carry=(carry/alpha.length)|0; }
    while(carry){ digits.push(carry%alpha.length); carry=(carry/alpha.length)|0; } }
  let out=''; for(let k=0;k<bytes.length&&bytes[k]===0;k++) out+=alpha[0];
  for(let q=digits.length-1;q>=0;q--) out+=alpha[digits[q]]; return out; }
function peerIdToIpnsName(pid){ try{ const mh=_baseDecode(String(pid),_B58A); if(!mh) return '';
  return 'k'+_baseEncode([0x01,0x72,...mh],_B36A);   // CIDv1 libp2p-key (0x72), multibase 'k'=base36
}catch(e){ return ''; } }
function ipnsRoutingBase(){ return ipfsRouting().replace('/providers/','/ipns/'); }
async function fetchNodeCard(pid){
  const name=peerIdToIpnsName(pid);
  if(name){ try{
    const rr=await fetch(ipnsRoutingBase()+name,{headers:{Accept:'application/vnd.ipfs.ipns-record'},cache:'no-store'});
    if(rr.ok){ const buf=new Uint8Array(await rr.arrayBuffer());
      let txt=''; for(let i=0;i<buf.length;i++) txt+=String.fromCharCode(buf[i]);
      const m=txt.match(/\/ipfs\/(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]{20,})/);
      if(m){ for(const gw of ipfsGateways()){ try{ const cr=await fetch(`${gw}/ipfs/${m[1]}`,{cache:'no-store'}); if(cr.ok) return await cr.json(); }catch(e){} } } }
  }catch(e){} }
  for(const gw of ipfsGateways()){ try{ const r=await fetch(`${gw}/ipns/${pid}`,{cache:'no-store'}); if(r.ok) return await r.json(); }catch(e){} }
  return null;
}
async function discoverViaIPFS(){
  S.ipfsPeers=S.ipfsPeers||new Set();
  let provs=[];
  try{ const r=await fetch(ipfsRouting()+IPFS_RENDEZVOUS_CID,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!r.ok){ if(!S._ipfsNoted){ S._ipfsNoted=true; log('ipfs',`delegated routing HTTP ${r.status} — IPFS plane idle`,false); } return; }
    const d=await r.json();
    provs=(d.Providers||[]).filter((x)=>x&&x.ID);
  }catch(e){ if(!S._ipfsNoted){ S._ipfsNoted=true; log('ipfs','delegated routing unreachable — IPFS plane idle',false); } return; }
  if(provs.length) log('ipfs',`rendezvous providers on the IPFS DHT: ${provs.length}`,true);
  // REBUILD the IPFS peer set from THIS cycle (not accumulate): a node that moved to
  // a new URL — a rotated tunnel, http→https — drops its stale entry instead of
  // lingering forever as an "unreachable" peer. The DHT/IPNS is the source of truth.
  const fresh=new Set();
  for(const p of provs.slice(0,16)){
    const pid=String(p.ID);
    // 1) PRIMARY: the provider record's own announced https multiaddr.
    let url=(p.Addrs||[]).map(httpsFromMultiaddr).find(Boolean)||'';
    if(url) log('ipfs',`provider ${pid.slice(0,12)}… announces ${url}`,true);
    // 2) RELIABLE: the signed IPNS node card via delegated routing → immutable card.
    if(!url){
      const doc=await fetchNodeCard(pid);
      if(doc&&doc.schema==='personaos-ipfs-node-card/1'&&doc.card){
        let ok=false;  // in-browser Ed25519 verify against the card's embedded key
        try{ ok=await ed.verifyAsync(hexToBytes(doc.signature_hex),enc.encode(canon(doc.card)),hexToBytes(doc.public_key_hex)); }catch(e){}
        log('ipfs',`node card ${pid.slice(0,12)}… ${ok?'verified':'BAD SIGNATURE'}`,ok);
        if(ok) url=String(doc.card.peer_url||'');
      }
    }
    if(url) fresh.add(url);
  }
  const before=[...S.ipfsPeers].sort().join('|'), after=[...fresh].sort().join('|');
  S.ipfsPeers=fresh;                       // replace → stale URLs fall away, latest stays
  if(after!==before){ log('ipfs',`IPFS peers refreshed: ${fresh.size} live kernel(s)`,true);
    discover().then(()=>{ renderMissions(); }).catch(()=>{}); }
}

// ---- LOCAL probe: is a PersonaOS node running on THIS machine? -----------------
// A node's PUBLIC url (a tunnel) and its localhost url are the same kernel, but
// localhost is never globally advertised (every visitor's localhost is their own
// box). So probe a few well-known ports here; self-register any that answer. That
// node then appears in the OPERATOR console as a LOCAL node — loopback ⇒ NO token.
// Silent when nothing's running. From an https page: https://localhost works if the
// node's cert is trusted; http://localhost works in Chromium (localhost is
// potentially-trustworthy) and just fails quietly elsewhere.
const LOCAL_PORTS=[8805,8765,8910];
async function probeBase(base){
  try{
    const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),2500);
    const r=await fetch(join(base,'.well-known/personaos-discovery.json'),{signal:ctl.signal,cache:'no-store'});
    clearTimeout(t);
    if(!r.ok) return false;
    const d=await r.json();
    return !!(d&&typeof d==='object'&&/personaos-discovery/.test(d.schema||''));
  }catch(e){ return false; }
}
async function discoverLocalNode(){
  S.localPeers=S.localPeers||new Set();
  const hosts=location.protocol==='https:'
    ? ['https://localhost','https://127.0.0.1','http://localhost','http://127.0.0.1']
    : ['http://localhost','http://127.0.0.1'];
  const found=new Set();
  await Promise.all(hosts.flatMap((h)=>LOCAL_PORTS.map(async(port)=>{
    const base=`${h}:${port}`;
    if(await probeBase(base)) found.add(base);
  })));
  const before=[...S.localPeers].sort().join('|'), after=[...found].sort().join('|');
  S.localPeers=found;                      // rebuild each cycle: a stopped local node drops off
  if(after!==before){
    if(found.size) log('local',`PersonaOS node on THIS machine: ${[...found].join(', ')} — operator console works with NO token (loopback)`,true);
    discover().then(()=>{ renderMissions(); }).catch(()=>{});
  }
}

function upsert(r){
  const id=r.record_id||r.card_id; if(!id) return;
  let row=S.recs.get(id);
  if(!row){ row={id,events:0,lastT:0,spark:new Array(SPARK_N).fill(0),bucket:0,rate:0,_new:true};
    S.recs.set(id,row); S.order.push(id); }
  Object.assign(row,{kind:r.kind,label:r.label||id,did:r.did||id,visibility_tier:r.visibility_tier,
    planes:planesOf(r.visibility_tier),_kernel:r._kernel,_access:r._access,_url:r._url,_links:r._links||{},_base:r._base||'',_doc:r._doc,_net:r._net||'',

    capability_summary:r.capability_summary||[],content_hash:r.content_hash||'',content_locator_ref:r.content_locator_ref||''});
}
function classifyMap(){ // per-kernel scope → record map so each kernel's events tick its own rows
  S.mapByKernel={}; const byKK={};
  for(const id of S.order){ const r=S.recs.get(id); const kk=byKK[r._kernel]=byKK[r._kernel]||{}; (kk[r.kind]=kk[r.kind]||[]).push(id); }
  for(const kid in byKK){ const bk=byKK[kid], first=(k)=>(bk[k]||[])[0];
    const bundle=(bk.artifact||[]).find((id)=>S.recs.get(id)._links&&S.recs.get(id)._links.bundle)||first('artifact');
    S.mapByKernel[kid]={persona:first('persona'),env:first('env'),domain:first('domain')||first('persona'),
      task:first('persona'),answer:first('persona'),project:first('project')||first('env'),
      bundle,artifact:bundle,telemetry:first('telemetry'),mission:first('mission')}; }
}
async function resolveKernelBases(seeds){
  // Every seed (this origin, peers.txt, ?peer, ＋PEER) is resolved the SAME way:
  // its bootstrap may BE a kernel (providers_url), LIST kernels (federated_kernels —
  // a multi-run node), and NAME further peers (one hop). Previously only the page's
  // own origin was expanded, so a multi-run peer node yielded zero records.
  const visited=new Set(), kernels=[]; const queue=seeds.map((s)=>({b:s,depth:0}));
  while(queue.length){
    const {b,depth}=queue.shift(); const key=b||'@origin';
    if(visited.has(key)) continue; visited.add(key);
    const boot=await fetchJson(join(b,'.well-known/personaos-discovery.json'));
    if(!boot){ if(b) kernels.push(b); continue; }          // dead peer → discoverFrom logs it
    S.boots.set(b||'@origin',boot); collectP2PBootstraps(boot);
    const fks=boot.federated_kernels||[];
    if(boot.providers_are_aggregate){ kernels.push(b); }   // public node aggregate: do not expand private runs
    else {
      if(boot.providers_url||!fks.length) kernels.push(b); // the base itself is a kernel (or legacy single-run)
      for(const fk of fks) kernels.push(join(b,fk));       // multi-run node → per-kernel bases
    }
    if(depth<1){
      const httpBoots=[...(boot.peers||[]),...(boot.bootstrap_peers||[])].filter(isHttp);
      for(const rp of httpBoots) queue.push({b:rp,depth:depth+1});
    }
  }
  return [...new Set(kernels)];
}
function pruneDeadManualPeers(){
  // +PEER seeds live in this browser's localStorage. With IPFS as the live source of
  // truth, a manually-added node that's now unreachable shouldn't linger and keep
  // erroring. Drop only entries we ATTEMPTED this cycle and found unreachable —
  // never untried or reachable ones. (?peer= query seeds and IPFS peers aren't
  // touched; re-add a node any time with ＋PEER.)
  let s; try{ s=JSON.parse(localStorage.getItem('personaos_peers')||'[]'); }catch(e){ return; }
  if(!Array.isArray(s)||!s.length) return;
  const ph=S.peerHealth||new Map();
  const dead=(u)=>{ const h=ph.get(u)||ph.get(opBaseKey(u))||ph.get(opBaseKey(u)+'/'); return !!(h&&h.ok===false); };
  const keep=s.filter((u)=>!dead(u));
  if(keep.length!==s.length){
    localStorage.setItem('personaos_peers',JSON.stringify(keep));
    log('peers',`removed ${s.length-keep.length} unreachable ＋PEER node(s) from this browser`,false);
  }
}
async function discover(){
  $('#log').innerHTML=''; $('#status').textContent='bootstrapping discovery…';
  await loadPeersTxt();                                            // published peers.txt → TXT_PEERS
  const seeds=[...new Set(['', ...peerList()])];
  S.telLoaded=S.telLoaded||new Set();
  // PARALLEL per-base discovery: a dead/slow peer must not serialize the rest.
  const bases=await resolveKernelBases(seeds);
  const results=await Promise.all(bases.map((b)=>
    discoverFrom(b,'internet').then((res)=>({b,res})).catch(()=>({b,res:{boot:null,found:[]}}))));
  for(const {b,res} of results){
    res.found.forEach(upsert);
    if(res.boot) connectDiscoveryStream(b,res.boot);
    if(res.boot){ await loadTelemetry(b); }   // aggregate static spans + live node telemetry
  }
  pruneDeadManualPeers();                  // drop +PEER seeds that resolved unreachable
  classifyMap(); renderGlobalKernels(); updateVitalsCounters();
  refreshSystemView();
  const when=new Date();
  $('#status').innerHTML=`<span class="ok">${S.recs.size}</span> records discovered + Ed25519-verified across `
    +`<span class="ok">${S.kernels.size||1}</span> kernel(s) · internet (.well-known + Kademlia DHT) + intranet (mDNS) · access-gated`
    +` · refreshed ${String(when.getUTCHours()).padStart(2,'0')}:${String(when.getUTCMinutes()).padStart(2,'0')}:${String(when.getUTCSeconds()).padStart(2,'0')}Z (re-polls every 15 s)`;
}

// ---------- empty state: never a silent blank network ----------
// Returns the rich "how to get live data" card HTML; refreshSystemView() paints
// it into the stage (#sysEnvs) when nothing has been discovered yet.
function emptyStateHTML(){
  const ph=S.peerHealth||new Map();
  const rows=[...ph.entries()].map(([base,h])=>
    `<div class="grant"><span class="${h.ok?'ok':'no'}">${h.ok?'●':'○'} ${esc(base)}</span>`
    +`<span class="l2">${h.ok?`reachable · ${h.records} public record(s)`:'unreachable'}</span></div>`).join('')
    ||'<div class="l2">no peers attempted yet</div>';
  const httpsPage=location.protocol==='https:';
  return `<div class="empty-card">
    <h3>No live PersonaOS personas discovered yet</h3>
    <div class="desc2">This page ships <b>no data</b> — every persona, message and number you see is
    discovered at runtime from live nodes and Ed25519-verified in your browser. Nothing is showing because
    no reachable node is currently publishing public records.</div>
    <h4>Peers tried</h4>${rows}
    <h4>Get live data</h4>
    <div class="desc2">
    1 · Run a node: <code>python -m personaos.node --budget 8 --public-discovery</code><br>
    ${httpsPage?`2 · This page is <b>https://</b> — browsers block fetches to a plain-http
    LAN/localhost node (mixed content). Either open the <b>node-served UI</b> at
    <code>http://&lt;node-host&gt;:&lt;port&gt;/</code> (same shell, same-origin), or expose the
    node through an HTTPS tunnel (e.g. <code>cloudflared tunnel --url http://localhost:8765</code>)
    and add the tunnel URL with <b>＋ PEER</b>.`:`2 · Add your node's URL with <b>＋ PEER</b>
    (or <code>?peer=&lt;url&gt;</code>).`}<br>
    3 · The network re-polls every 15 s — personas appear the moment a node responds.<br>
    4 · Your own node? Click <b>🔑 OPERATOR</b>, paste its token
    (<code>runs/…/_operator/token</code>) and drive it from here: ASK / FUND / STOP, runs,
    personas, live telemetry.</div>
  </div>`;
}

// a live telemetry frame arrived (SSE) — the per-entity index + heartbeat were
// already refreshed by indexLiveTelemetry; the livedot is driven by the real
// heartbeat in updateVitalsCounters, so there is nothing to force here.
function appendTelemetryEvent(payload,base,boot,reason){}
function connectDiscoveryStream(base,boot){
  if(!boot?.discovery_stream_url||typeof EventSource==='undefined') return;
  const url=join(base,boot.discovery_stream_url);
  if(S.streams.has(url)) return;
  // EventSource cannot set headers — the operator token rides ?token= instead.
  const tok=tokenFor(url); const esUrl=tok?url+(url.includes('?')?'&':'?')+'token='+encodeURIComponent(tok):url;
  const es=new EventSource(esUrl);
  S.streams.set(url,es);
  es.addEventListener('open',()=>log('stream',`${url} connected`,true));
  es.addEventListener('hello',(ev)=>{
    try{ const d=JSON.parse(ev.data||'{}'); if(d.node_id) S.kernels.add(d.node_id); }catch(e){}
  });
  es.addEventListener('discovery_snapshot',async (ev)=>{
    try{
      const snap=JSON.parse(ev.data||'{}'), keys=await keysFor(base,boot);
      let added=0;
      for(const p of (snap.providers?.providers||[])){
        const doc=await fetchJson(join(base,p.record_url));
        const out=await verifiedRecordFromDoc(doc,keys,boot,base,'internet',p.record_url);
        if(out.ok){ upsert(out.row); added++; }
      }
      if(added){ classifyMap(); updateVitalsCounters(); refreshSystemView(); }
    }catch(e){ log('stream','snapshot parse failed: '+(e&&e.message||e),false); }
  });
  es.addEventListener('telemetry_update',(ev)=>{
    try{
      const payload=JSON.parse(ev.data||'{}');
      const live=payload.telemetry||payload;
      indexLiveTelemetry(base,live);   // refresh per-persona / per-env activity
      appendTelemetryEvent(payload,base,boot,'LIVE_TELEMETRY');
      refreshLiveSection();   // stream into an open persona/env drawer, in place
    }
    catch(e){ return; }
  });
  es.onerror=()=>{ if(!es._noted){ log('stream','SSE reconnecting; polling remains active',false); es._noted=true; } };
}

/* ---------- telemetry tape (replay of real signed spans) ---------- */
async function loadTelemetry(base){
  const boot=await fetchJson(join(base,'.well-known/personaos-discovery.json'));
  if(!boot) return;
  const kid=boot.kernel_id||base;
  let added=0;
  const pushEvent=(e)=>{
    const key=e.key||`${e.kernel}|${e.trace}|${e.kind}|${e.t}`;
    if(S.eventKeys.has(key)) return;
    S.eventKeys.add(key);
    delete e.key;
    S.events.push(e);
    added++;
  };
  const ingestSpans=(spans)=>{
    if(!Array.isArray(spans)||!spans.length) return;
    spans.forEach((s)=>{
      const a=s.attributes||{};
      const t=Date.parse(s.ended_at||s.started_at||'')||0;
      pushEvent({
        key:`span|${kid}|${s.span_id||''}|${a['personaos.trace_id']||''}|${s.name||''}|${t}`,
        t, kernel:kid,
        scope:String(a['personaos.lineage.scope']||(s.name||'').split('.').pop()||'other'),
        kind:String(a['personaos.lineage.event_kind']||s.name||'SPAN'), trace:String(a['personaos.trace_id']||s.span_id||''),
        signed:a['personaos.lineage.signed']===true, ms:Number(a['personaos.lineage.append_ms']||0)
      });
    });
  };
  const ingestLive=(live)=>{
    indexLiveTelemetry(base,live);   // per-persona / per-env activity index
    const modelEvents=live?.kernel?.model_events||[];
    if(!Array.isArray(modelEvents)||!modelEvents.length) return;
    const baseT=Date.parse(live.generated_at||'')||Date.now();
    modelEvents.forEach((m,i)=>{
      const purpose=String(m.requested_purpose||m.purpose||'model');
      pushEvent({
        key:`live|${kid}|${i}|${m.kind||''}|${m.model_id||''}|${purpose}|${m.role||''}|${m.reason||''}`,
        t:baseT-((modelEvents.length-i)*220), kernel:kid,
        scope:'telemetry',
        kind:String(m.kind||'MODEL_EVENT'),
        trace:String(m.reason||purpose||m.model_id||'live'),
        signed:false, ms:0,
      });
    });
  };
  const spansUrls=[];
  if(boot.telemetry_url) spansUrls.push(boot.telemetry_url);
  if(boot.telemetry_spans_url) spansUrls.push(boot.telemetry_spans_url);
  if(!boot.live_telemetry_url) spansUrls.push('telemetry/spans.json');
  for(const url of [...new Set(spansUrls)]){
    const spans=await fetchJson(join(base,url));
    ingestSpans(spans);
  }
  if(boot.live_telemetry_url){
    const live=await fetchJson(join(base,boot.live_telemetry_url));
    ingestLive(live);
  }
  if(!added){ return; }
  // aggregate across kernels, re-sort by time, normalise inter-event gaps to a lively cadence
  S.events=(S.events||[]).sort((a,b)=>a.t-b.t);
  let prev=S.events[0]?.t||0;
  S.events.forEach((e)=>{ const g=e.t-prev; prev=e.t; e.gap=Math.max(90,Math.min(900,g||300)); });
  if(S.events.length) S.events[0].gap=0;
  log('telemetry',`+${added} telemetry event(s) (${S.events.length} total) for the live tape`);
}


// ---------- rich, navigable detail drawer (resolves deep docs) ----------
const dcache=new Map();
async function dfetch(base,path){ if(!path) return null; const k=base+'|'+path;
  if(dcache.has(k)) return dcache.get(k); const v=await fetchJson(join(base,path)); dcache.set(k,v); return v; }
// Node /status cache — 8s TTL so active runs stay reasonably fresh without hammering
const statusCache=new Map();
async function fetchNodeStatus(base){
  const key=base||'@origin'; const hit=statusCache.get(key);
  if(hit&&(Date.now()-hit.ts)<8000) return hit.v;
  const v=await fetchJson(join(base,'status'));
  if(v) statusCache.set(key,{v,ts:Date.now()}); return v||null;
}
function personaIdFromDid(did){
  const m=/\/persona\/([^/]+)$/.exec(did||''); if(m) return m[1];
  return (did||'').replace('did:personaos:',''); }
async function fetchText(u){ try{ const r=await fetch(u,{cache:'no-store',headers:authHeaders(u)}); if(!r.ok)return null; return await r.text(); }catch(e){ return null; } }
// Binary-safe fetch for images / PDFs / 3D meshes — returns {blob,size,type} or null.
// Binaries are detected by extension BEFORE this is called so fetchText is never run on them.
async function fetchBlob(u){ try{ const r=await fetch(u,{cache:'no-store',headers:authHeaders(u)}); if(!r.ok)return null;
  const b=await r.blob(); return {blob:b,size:b.size,type:b.type}; }catch(e){ return null; } }
const fmtBytes=(n)=>{ if(n==null||isNaN(n))return '—'; if(n<1024)return n+' B';
  if(n<1048576)return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; };
const extOf=(p)=>{ const m=/\.([a-z0-9_]+)$/i.exec(String(p||'')); return m?m[1].toLowerCase():''; };
const kv=(l,v)=>`<div class="row"><span class="l2">${esc(l)}</span><span class="v2">${v}</span></div>`;
const H=(t)=>`<h4>${esc(t)}</h4>`;
const chipsOf=(a)=>`<div class="caps">${(a||[]).filter(Boolean).map((c)=>`<span class="cap">${esc(c)}</span>`).join('')||'<span class="l2">—</span>'}</div>`;
const recLink=(id,txt)=>`<a href="#" data-act="rec" data-id="${esc(id)}">${esc(txt)}</a>`;
const findRecByDid=(pid)=>S.order.find((id)=>{ const r=S.recs.get(id); return r.did==='did:personaos:'+pid||r.did===pid; });

// ---------- Trust / Access panel (09_PROTOCOLS §3F/§3G — the design's first-class
// trust surface: Ed25519 verification + the discover<read<write<admin ladder).
// Every detail view renders this so the viewer always sees WHY a record is
// trusted and WHAT access tier it sits at. Bound to the record's _doc/_access.
const ACCESS_RANK={discover:0,r:1,read:1,rw:2,write:2,admin:3};
const TIER_RANK={persona_only:0,project_only:1,tenant:2,federation:3,public:4};
function _ladderBar(level){
  const lv=String(level||'discover').toLowerCase().replace('read','r').replace('write','rw');
  const rungs=[['discover','discover'],['r','read'],['rw','write'],['admin','admin']];
  const have=ACCESS_RANK[lv]??0;
  return `<div class="ladder">`+rungs.map(([k,lbl],i)=>
    `<span class="rung ${i<=have?'on':''}" title="${esc(lbl)}">${esc(lbl)}</span>`).join('<span class="arr">›</span>')+`</div>`;
}
function trustPanel(r){
  const doc=r._doc||{}, a=r._access||doc.access_policy||{};
  const keyId=doc.signing_key_id||'—';
  const keyHex=(doc.public_key_hex||'').slice(0,18);
  const tier=a.outward_tier||r.visibility_tier||'persona_only';
  const grants=a.access_grants||[];
  const anchor=r.content_hash?('sha256 '+String(r.content_hash).replace('sha256:','').slice(0,20)+'…')
    :(r.content_locator_ref?('locator '+esc(String(r.content_locator_ref).slice(0,24))):'— (discover-level metadata only)');
  let html=H('Trust · Ed25519')
    +kv('Verified in browser','<span class="ok">✓ signature checked here</span>')
    +kv('Signing key',`<code>${esc(keyId)}</code>${keyHex?` <span class="l2">${esc(keyHex)}…</span>`:''}`)
    +kv('Key source','<span class="l2">.well-known/personaos-keys.json</span>');
  // drive min-to-discover/read from the record's REAL access policy, not constants
  const minD=esc(a.min_to_discover||'discover');
  const minR=a.min_to_read?esc(a.min_to_read)
    :(a.public_read||tier==='public'?'discover (public read)'
      :a.federated_read?'read (federation grant)':'read (operator token / owner)');
  html+=H('Access · '+esc(tier))+_ladderBar(r._effective_level||'discover')
    +kv('Visibility tier',`<span class="tier-pill t-${esc(tier)}">${esc(tier)}</span>`)
    +kv('Min to discover',minD)+kv('Min to read',minR);
  if(r.promoted_from_tier) html+=kv('Bridged from',`<span class="amber">${esc(r.promoted_from_tier)} → public</span>`
    +(r.bridge_policy_ref?` <span class="l2">${esc(r.bridge_policy_ref)}</span>`:''));
  html+=kv('Body',esc(anchor));
  if(grants.length) html+=H(`Grants (${grants.length})`)+grants.slice(0,8).map((g)=>
    `<div class="grant"><span>${esc(g.grantee_kind||'?')}:${esc((g.grantee_id||'*').slice(0,18))}</span>`
    +`<span class="ok">${esc(g.access_level||'discover')}</span></div>`).join('');
  return html;
}

// ---------- live per-entity activity (what is happening INSIDE this persona / env) ----------
const PURPOSE_LABEL={candidate:'producing candidate',repair:'repairing candidate',judge:'judging (PoLL)',
  safety:'safety check',objective:'naming objectives',classifier:'classifying',optimize_tactics:'evolving tactics',
  domain_probe_perceiver:'probing domain',domain_probe_abducer:'abducing domain',answer:'answering'};
function _liveFeed(models){
  if(!models||!models.length) return '<div class="l2">idle — no recent model calls</div>';
  // A persona legitimately produces, repairs AND evolves its own tactics — so SUMMARISE
  // its recent model calls by PURPOSE with a count (newest purpose first), instead of a
  // repeating row per call that reads like a glitch ("repairing candidate" ×6 in a row).
  const byP=new Map(); let i=0;
  for(const m of models){ const k=m.purpose||'model';
    const e=byP.get(k)||{n:0,model:m.model,seen:i}; e.n++; e.model=m.model||e.model; e.seen=i++; byP.set(k,e); }
  const order=[...byP.entries()].sort((a,b)=>b[1].seen-a[1].seen);   // most-recently-used purpose first
  return order.map(([p,e])=>{
    const lbl=PURPOSE_LABEL[p]||p;
    return `<div class="grant"><span class="l2"><span class="livedot2"></span>${esc(lbl)}`
      +`${e.n>1?` <span class="rr-count">×${e.n}</span>`:''}</span>`
      +`<span><code>${esc(e.model)}</code></span></div>`;
  }).join('');
}
function renderPersonaLive(pid){
  const d=S.liveByPersona.get(_shortId(pid)); if(!d) return '<div class="l2">— no live telemetry yet (idle or not streaming) —</div>';
  const s=d.summary||{}; let h='';
  // PER-04 / 09_PROTOCOLS §4.1: public tiles only (state, tasks, reputation);
  // operator-tier evolution internals (fitness, tactics, lessons, memory) appear
  // only when an operator token is held.
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  if(s.lifecycle_state!=null||s.reputation_score!=null||s.experience_tasks!=null){
    h+=`<div class="livegrid">`
      +`<div class="lm"><div class="lmv ${s.lifecycle_state==='ACTIVE'?'ok':''}">${esc(s.lifecycle_state||'—')}</div><div class="lmk">state</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.experience_tasks??0)}</div><div class="lmk">tasks</div></div>`
      +(s.reputation_score!=null?`<div class="lm"><div class="lmv ok">${esc(Number(s.reputation_score).toFixed(2))}</div><div class="lmk">reputation</div></div>`:'')
      +(hasOp?`<div class="lm"><div class="lmv">${esc(s.tactic_count??s.cohort_visible_tactic_count??0)}</div><div class="lmk">tactics</div></div>`
        +`<div class="lm"><div class="lmv">${esc(s.lesson_count??0)}</div><div class="lmk">lessons</div></div>`
        +`<div class="lm"><div class="lmv">${esc(s.memory_count??0)}</div><div class="lmk">memory</div></div>`
        +`<div class="lm"><div class="lmv">${esc(s.fitness!=null?Number(s.fitness).toFixed(1):'—')}</div><div class="lmk">fitness (op)</div></div>`:'')
      +`</div>`;
  }
  h+=`<div class="l2" style="margin:6px 0 3px">Doing now</div>`+_liveFeed(d.models);
  return h;
}
function renderEnvLive(eid){
  const d=S.liveByEnv.get(_shortId(eid)); if(!d) return '<div class="l2">— no live telemetry yet (idle or not streaming) —</div>';
  let h='';
  const sp=d.spans||[];
  if(sp.length){
    const counts={}; sp.forEach((s)=>{counts[s.kind]=(counts[s.kind]||0)+1;});
    h+=`<div class="l2" style="margin:3px 0">Lineage events</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>
        `<div class="grant"><span class="l2">${esc(k)}</span><span class="ok">${esc(v)}</span></div>`).join('');
  }
  h+=`<div class="l2" style="margin:6px 0 3px">Model activity in this env</div>`+_liveFeed(d.models);
  return h;
}

/* ===================== ◫ SYSTEM VIEW — the living representation ===================
   Environments contain their personas; each persona card streams its live
   request/response (model selections = what it ASKED a model to do) and its
   cognition; the right rail streams coordination + cross-env interactions
   (kernel.interactions: actor → affected : kind); artifacts show as deliverables.
   All from live, signature-verified telemetry — nothing fabricated. */
const PURPOSE_VERB={candidate:'produce candidate',repair:'repair candidate',judge:'judge (PoLL)',
  safety:'safety check',objective:'name objectives',classifier:'classify task',optimize_tactics:'evolve tactics',
  domain_probe_perceiver:'probe domain',domain_probe_abducer:'abduce domain',answer:'answer',verifier:'verify'};
// event-kind → coordination / cross-env / artifact / lifecycle classification + glyph
const COORD_KINDS=new Set(['COORDINATION_SHAPE_EVENT','COORDINATION_SHAPE_ADMITTED','ATTENTION_ALLOCATED',
  'MEMBER_JOINED','ENV_MEMBER_ADMITTED','BLACKBOARD_POST','blackboard_post','coordination_signal',
  'coordination_update','GOAL_PROGRESS_REPORTED','TASK_PROGRESS_REPORTED']);
const CROSSENV_KINDS=new Set(['ENV_COMPOSED','env_composition_established','cross_env_event_link',
  'cross_env_offer_made','cross_env_offer_accepted','env_composition_cascade_applied']);
// VERIFY = independent judgement (reinforces trust = signature). Checked before
// SHIP so a verdict reads as a verify act, not a generic artifact event.
const VERIFY_KINDS=new Set(['VERIFIER_VERDICT','ANSWER_EVALUATED','SAFETY_CHECKED','TASK_NOT_ACCEPTED','PANEL_VERDICT']);
const ARTIFACT_KINDS=new Set(['BUNDLE_CREATED','artifact_sharing_policy_created','artifact_card_published',
  'PROVEN_FACT_RECORDED','TASK_COMPLETED','TASK_ACCEPTED','answer/5']);
// a verdict that did NOT accept → render in the rejected colour
const _ixFailed=(kind)=>kind==='TASK_NOT_ACCEPTED';
function _ixClass(kind){ if(kind==='MODEL_CALL'||kind==='LLM_OUTPUT'||kind==='LLM_LESSON')return 'think';
  if(CROSSENV_KINDS.has(kind))return 'crossenv'; if(VERIFY_KINDS.has(kind))return 'verify';
  if(COORD_KINDS.has(kind))return 'coord'; if(ARTIFACT_KINDS.has(kind))return 'artifact'; return 'activity'; }
// interaction-kind → human verb, so a persona card can stream its recent
// coordination acts when no model req/resp is flowing (live state A). Anything
// unmapped falls back to the lower-cased kind — never fabricated.
const IX_VERB={CANDIDATE_PRODUCED:'produced candidate',CANDIDATE_REPAIRED:'repaired candidate',
  VERIFIER_VERDICT:'gave verdict',ANSWER_EVALUATED:'evaluated answer',SAFETY_CHECKED:'safety-checked',
  TASK_COMPLETED:'completed task',TASK_ACCEPTED:'accepted task',TASK_NOT_ACCEPTED:'rejected answer',
  TASK_CLASSIFIED:'classified task',MODE_ENTRY:'entered mode',MODE_EXIT:'exited mode',
  ENVELOPE_MINTED:'minted envelope',EXPERIENCE_TASK_RECORDED:'recorded experience',
  PROVEN_FACT_RECORDED:'recorded proven fact',COORDINATION_SHAPE_EVENT:'coordinated',
  COORDINATION_SHAPE_ADMITTED:'coordination admitted',ATTENTION_ALLOCATED:'allocated attention',
  MEMBER_JOINED:'joined environment',ENV_MEMBER_ADMITTED:'admitted member',BLACKBOARD_POST:'posted to blackboard',
  GOAL_PROGRESS_REPORTED:'reported progress',TASK_PROGRESS_REPORTED:'reported progress',
  MODEL_CALL:'asked',LLM_OUTPUT:'produced',LLM_LESSON:'learned',EXTERNAL_CAPABILITY_BLOCKED:'blocked on capability',
  EXTERNAL_CAPABILITY_ACQUIRED:'acquired capability',CAPABILITY_PROVISIONED:'provisioned tool',
  ENV_MCP_TOOL_REGISTERED:'mounted tool',ENV_MCP_TOOL_INVOKED:'used tool'};
const _ixVerb=(kind)=>IX_VERB[kind]||String(kind||'acted').toLowerCase().replace(/_/g,' ');
const _ago=(t)=>{const s=Math.max(0,(Date.now()-t)/1000|0);return s<5?'now':s<60?s+'s':s<3600?(s/60|0)+'m':(s/3600|0)+'h';};
const _PERSONA_NAME=new Map();   // short id -> friendly name (filled from live summaries + records)
function _nameFor(shortId){ return _PERSONA_NAME.get(shortId)||shortId.slice(0,10); }
// RUNNING NOW vs merely live: a persona is "running now" iff its model/coordination activity
// GREW within the last ~12 s (one poll window) — i.e. it is mid model-call this moment. This is
// the precise signal that distinguishes the ONE persona actually working from the several that are
// recently-active ("live"). Everything else stays calm so the running one is unmistakable.
const _RUNNING_WINDOW_MS=12000;
function _runningNow(sid){ const t=(S.lastActiveAt&&S.lastActiveAt.get(sid))||0;
  return t>0 && (Date.now()-t)<_RUNNING_WINDOW_MS; }

// one persona card: identity + lifecycle + live "doing now" + request/response mini-stream + cognition
// derive a persona's coordination ROLE from its summary/name (open, emergent —
// no closed enum): verifier / producer-lead / integrator / specialist / member.
function _coordRole(sid,s){
  // a COARSE, presentational coordination hint — derived only from honest signals.
  // The public projection carries no raw role, so we read the persona's declared
  // role/capability when present and otherwise classify by NAME keywords; we NEVER
  // use raw operator fitness (PER-04) and never map the word "persona" → lead
  // (that mislabels founders/operator-created personas).
  const declared=String(s.role||(s.capability_summary&&s.capability_summary[0])||'').toLowerCase();
  if(declared==='lead'||declared==='founder'||s.can_lead_cohorts===true) return 'lead';
  const n=(_nameFor(sid)+' '+declared).toLowerCase();
  if(n.includes('verif')) return 'verifier';
  if(n.includes('integrat')) return 'integrator';
  if(n.includes('specialist')||s.born_specialist===true||declared==='specialist') return 'specialist';
  if(declared.includes('lead')) return 'lead';
  return 'member';
}
// per-persona "is fresh" detector for realtime streaming: did its model-event
// count grow since the last render? (drives the slide-in animation + node pulse)
function _personaGrew(sid,count){
  S.pcardSeen=S.pcardSeen||new Map();
  const prev=S.pcardSeen.get(sid); S.pcardSeen.set(sid,count);
  return prev!=null && count>prev;
}
function renderPersonaCard(pid){
  const sid=_shortId(pid); const d=S.liveByPersona.get(sid)||{}; const s=d.summary||{};
  const models=d.models||[]; const last=models[models.length-1];
  const name=s.name||_nameFor(sid); _PERSONA_NAME.set(sid,name);
  const role=_coordRole(sid,s);
  const state=s.lifecycle_state||'';
  // dual-state hero: STATE B = model req/resp (the richest signal); STATE A =
  // recent kernel.interactions naming this persona (so the hero stays alive on a
  // node that streams coordination but no model_events). Both are real telemetry.
  const acts=(S.ixByPersona&&S.ixByPersona.get(sid))||[];
  const recentAct=acts[acts.length-1];
  // live persona MESSAGES (cognition): the LLM's own recent outputs + lessons for THIS persona,
  // streamed straight onto the card (newest first) — the same data the THINK feed shows.
  const cogMsgs=(S.interactions||[]).filter((e)=>e.scope==='cognition'&&_shortId(e.actor_id)===sid)
    .slice(-4).reverse();
  const actFresh=!!recentAct && (Date.now()-recentAct._t)<90000;
  const hasModels=models.length>0;
  const live=hasModels||actFresh;
  const running=_runningNow(sid);   // mid model-call THIS moment — the one truly working
  // flash on genuine growth of total activity (model reqs + monotonic act tally)
  const actTally=(S.ixCountBySid&&S.ixCountBySid.get(sid))||0;
  const grew=_personaGrew(sid,models.length+actTally);
  // Card content (UX): the useful signal is WHAT it's doing now + WHAT it produced/learned
  // (the message stream) + a clean grouped ACTIVITY GLANCE — not a raw per-call list.
  let doingHTML, glance='';
  if(hasModels){
    doingHTML=`<span class="pulse">●</span> ${esc(PURPOSE_VERB[last.purpose]||last.purpose)} <code>${esc(last.model)}</code>`;
    const byP=new Map();
    for(const m of models){ const k=m.purpose||'model'; byP.set(k,(byP.get(k)||0)+1); }
    glance=[...byP.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4)
      .map(([p,n])=>`<span class="pc-g">${esc(PURPOSE_VERB[p]||p)}${n>1?` <b>×${n}</b>`:''}</span>`).join('');
  } else if(actFresh){
    doingHTML=`<span class="pulse">●</span> ${esc(_ixVerb(recentAct.kind))}`;
  } else {
    doingHTML='<span class="l2">idle — awaiting a mission</span>';
  }
  const mp=s.mode_proficiencies||{}; const topMode=Object.entries(mp).sort((a,b)=>b[1]-a[1])[0];
  // PER-04: the public card shows reputation_score (role-relative [0,1]), NEVER raw
  // operator fitness. Evolution internals (tactics/lessons/modes) are operator-tier
  // — shown only when an operator token is held (and in the 🧠 thinking drawer).
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  // 3-state presence: RUNNING NOW (pulsing) · active (calm, recently worked) · idle.
  const dotCls=running?'run':(live?'on':'off');
  const statusBadge=running
    ? '<span class="pc-run">● RUNNING</span>'
    : (live?'<span class="pc-active">active</span>':'<span class="pc-idle">idle</span>');
  return `<div class="pcard role-${role}${running?' running':live?' live':''}${grew?' flashcard':''}" data-pcard="${esc(sid)}" role="button" tabindex="0" title="open ${esc(name)}">`
    +`<div class="pcard-top"><span class="pc-dot ${dotCls}"></span>`
    +`<span class="pc-name">${esc(name)}</span>`
    +(name.toLowerCase()!==role?`<span class="pc-role">${esc(role)}</span>`:'')
    +statusBadge
    +(state&&state!=='ACTIVE'?`<span class="pc-state">${esc(state.toLowerCase())}</span>`:'')
    +`<button class="pc-follow" data-follow="${esc(sid)}" title="watch only this persona" aria-pressed="false">◎</button></div>`
    +`<div class="pc-doing">${doingHTML}</div>`
    +(cogMsgs.length?`<div class="pc-msgs">`+cogMsgs.map((m,i)=>
        `<div class="pc-msg ${m.kind==='LLM_LESSON'?'lesson':'out'}${grew&&i===0?' fresh':''}">`
        +`<span class="pc-msg-g">${m.kind==='LLM_LESSON'?'💡':'▸'}</span>${esc(m._msg||'')}</div>`).join('')
      +`</div>`:'')
    +(glance?`<div class="pc-glance">${glance}</div>`:'')
    +`<div class="pc-stats">`
    +(s.experience_tasks!=null?`<span title="tasks worked">⚙ ${esc(s.experience_tasks)}</span>`:'')
    +(s.reputation_score!=null?`<span title="reputation — role-relative [0,1]">✦ ${esc(Number(s.reputation_score).toFixed(2))}</span>`:'')
    +(hasOp&&s.tactic_count!=null?`<span title="evolved tactics (operator)">🧬 ${esc(s.tactic_count)}</span>`:'')
    +(hasOp&&s.lesson_count!=null?`<span title="lessons learned (operator)">💡 ${esc(s.lesson_count)}</span>`:'')
    +(hasOp&&topMode?`<span title="strongest cognitive mode (operator)">◈ ${esc(topMode[0])} ${esc(Number(topMode[1]).toFixed(2))}</span>`:'')
    +`</div></div>`;
}

// ---- live coordination GRAPH (SVG): kernel hub + persona nodes + pulsing edges --
// Honest topology: PersonaOS coordination is KERNEL-MEDIATED (the kernel routes
// candidate→verify→accept), so the kernel is the hub and personas are spokes;
// the producer→verifier verify-relationship is drawn directly. Edges/nodes PULSE
// when a fresh interaction names that persona (from kernel.interactions).
function _hotPersonas(){
  const hot=new Set();
  for(const e of (S.interactions||[]).slice(-10)){
    if(e.actor_kind==='persona'&&e.actor_id) hot.add(_shortId(e.actor_id));
    for(const a of (e.affected||[])) if(a.kind==='persona') hot.add(_shortId(a.id));
  }
  return hot;
}
const SVGNS='http://www.w3.org/2000/svg';
const _svg=(tag,attrs,cls)=>{ const e=document.createElementNS(SVGNS,tag);
  if(cls) e.setAttribute('class',cls); for(const k in (attrs||{})) e.setAttribute(k,attrs[k]); return e; };
// CONSTELLATION (supporting minimap): KERNEL core (beats on heartbeat) + persona
// nodes (breathe live / dim idle) on an ellipse, + producer→verifier verify edges.
// Rendered with a KEYED enter/update/exit diff (NOT innerHTML=) so in-flight
// breathing + traveling pulses survive each 5s refresh. The kernel is the honest
// hub: PersonaOS coordination is kernel-mediated. cx/cy in the wide 1000×200 rail.
function renderCoordGraph(persons){
  const svg=$('#sysGraph'); if(!svg) return;
  const cx=500,cy=100,rx=432,ry=58;
  // skeleton (created once): edges / axons / core / nodes layers
  if(!svg._built){ svg._built=true;
    svg.appendChild(_svg('g',{},'cg-edges'));
    svg.appendChild(_svg('g',{},'cg-axons'));
    const core=_svg('g',{transform:`translate(${cx},${cy})`},'core');
    core.appendChild(_svg('circle',{r:34},'core-ring'));
    core.appendChild(_svg('circle',{r:28},'core-c'));
    core.appendChild(_svg('text',{y:-2},'core-t')).textContent='KERNEL';
    const cs=_svg('text',{y:13},'core-s'); core.appendChild(cs);
    svg.appendChild(core); svg.appendChild(_svg('g',{},'cg-nodes'));
    svg._edges=core.parentNode.querySelector('.cg-edges'); svg._axons=svg.querySelector('.cg-axons');
    svg._core=core; svg._nodes=svg.querySelector('.cg-nodes');
  }
  const hot=_hotPersonas();
  const n=persons.length||1;
  persons.forEach((p,i)=>{ const ang=(-Math.PI/2)+(i*2*Math.PI/n);
    p.x=+(cx+Math.cos(ang)*rx).toFixed(1); p.y=+(cy+Math.sin(ang)*ry).toFixed(1);
    S.nodePos.set(p.sid,{x:p.x,y:p.y}); });
  const verifier=persons.find((p)=>p.role==='verifier');
  // core: beat cadence from the heartbeat; caption = live/active count
  const beat=S.heartbeat&&S.heartbeat.interval_s?Math.max(2,+S.heartbeat.interval_s):5;
  svg._core.style.setProperty('--beat',beat+'s');
  const runningN=persons.filter((p)=>p.running).length;
  const liveN=persons.filter((p)=>p.live).length;
  svg._core.querySelector('.core-s').textContent=
    runningN ? `${runningN} in a model call · ${persons.length} personas`
             : `${liveN} active · ${persons.length} personas`;
  // edges (static spokes + verify links) — safe to rebuild (no continuous anim)
  let e='';
  persons.forEach((p)=>{ const h=hot.has(p.sid);
    e+=`<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" class="ge ${h?'ge-hot':p.live?'ge-live':'ge-idle'}"/>`; });
  if(verifier) persons.forEach((p)=>{ if(p.sid===verifier.sid) return;
    e+=`<line x1="${p.x}" y1="${p.y}" x2="${verifier.x}" y2="${verifier.y}" class="ge ge-verify"/>`; });
  svg._edges.innerHTML=e;
  // axons (persistent, one per sid kernel→persona) — fired imperatively by _fireEdge
  const liveSids=new Set(persons.map((p)=>p.sid));
  persons.forEach((p)=>{ let ax=svg._axons.querySelector(`[data-axon="${cssEsc(p.sid)}"]`);
    if(!ax){ ax=_svg('line',{},'axon'); ax.setAttribute('data-axon',p.sid);
      ax.addEventListener('animationend',()=>ax.setAttribute('class','axon')); svg._axons.appendChild(ax); }
    ax.setAttribute('x1',cx); ax.setAttribute('y1',cy); ax.setAttribute('x2',p.x); ax.setAttribute('y2',p.y); });
  [...svg._axons.children].forEach((ax)=>{ if(!liveSids.has(ax.getAttribute('data-axon'))) ax.remove(); });
  // nodes — KEYED upsert so breathing persists; only touch what changed
  persons.forEach((p)=>{ let g=svg._nodes.querySelector(`[data-gp="${cssEsc(p.sid)}"]`);
    if(!g){ g=_svg('g',{},''); g.setAttribute('data-gp',p.sid);
      g.setAttribute('tabindex','0'); g.setAttribute('role','button');   // keyboard-focusable map node
      g.appendChild(_svg('circle',{r:11},'gn-c'));
      g.appendChild(_svg('circle',{r:14},'gn-ring'));
      g.appendChild(_svg('text',{y:-17},'gn-name'));
      g.appendChild(_svg('text',{y:4},'gn-role'));
      g.appendChild(_svg('text',{y:25},'gn-do'));
      svg._nodes.appendChild(g); }
    const cls=`gnode role-${p.role}${p.running?' gn-running':p.live?' gn-live':''}${hot.has(p.sid)?' gn-hot':''}${S.follow===p.sid?' gn-followed':''}`;
    if(g.getAttribute('class')!==cls) g.setAttribute('class',cls);   // toggle only on change → no anim restart
    g.setAttribute('transform',`translate(${p.x},${p.y})`);
    g.setAttribute('aria-label',`${p.name||'persona'} — ${p.role}${p.live?', live: '+(p.doing||''):', idle'} (press Enter to follow)`);
    const nm=p.name&&p.name.length>11?p.name.slice(0,10)+'…':(p.name||''); if(g.children[2].textContent!==nm) g.children[2].textContent=nm;
    const rl=(p.role[0]||'?').toUpperCase(); if(g.children[3].textContent!==rl) g.children[3].textContent=rl;
    const dn=p.running?(p.doing||'').slice(0,16):''; if(g.children[4].textContent!==dn) g.children[4].textContent=dn; });
  [...svg._nodes.children].forEach((g)=>{ if(!liveSids.has(g.getAttribute('data-gp'))) g.remove(); });
}
const cssEsc=(s)=>(window.CSS&&CSS.escape)?CSS.escape(String(s)):String(s).replace(/["\\]/g,'\\$&');

// fire a traveling pulse along a persona's kernel-edge (and flash its node) —
// called when a NEW coordination act names that persona (staggered). The axon is
// a reused element; we restart its one-shot travel by reflow + class re-add.
function _fireEdge(sid,cls){
  if(RM) { _flashNode(sid,cls); return; }
  const svg=$('#sysGraph'); if(!svg||!svg._axons) return;
  const ax=svg._axons.querySelector(`[data-axon="${cssEsc(sid)}"]`); if(!ax) return;
  ax.setAttribute('class','axon'); void ax.getBoundingClientRect();
  ax.setAttribute('class','axon fire'+(cls&&cls!=='coord'?' fire-'+cls:''));
  _flashNode(sid,cls);
}
function _flashNode(sid,cls){
  const svg=$('#sysGraph'); if(!svg||!svg._nodes) return;
  const g=svg._nodes.querySelector(`[data-gp="${cssEsc(sid)}"]`); if(!g) return;
  const base=g.getAttribute('class').replace(/ gn-flash| gn-verdict-\w+/g,'');
  const verdict=cls==='verify'?' gn-verdict-pass':'';
  g.setAttribute('class',base+' gn-flash'+verdict);
  setTimeout(()=>{ g.setAttribute('class',base); },800);
}

// VITAL-SIGN spike queue: a verified event (model-event growth or a new
// coordination act) injects a decaying spike, coloured by class. The ECG canvas
// (drawVital) consumes it. Never enqueued without a real telemetry delta behind it.
const SPIKE_COL={produce:'#a779e6',coord:'#3aa0ff',verify:'#19c39a',artifact:'#f0a73a',crossenv:'#ff5fa2',activity:'#48586a'};
function _pushSpike(cls){ S.vitalSpikes.push({a:1,col:SPIKE_COL[cls]||SPIKE_COL.coord}); if(S.vitalSpikes.length>40) S.vitalSpikes.shift(); }

// per-task THREAD hue: a stable colour per scope_id so you can watch one task
// ripple produce→verify→ship down the feed.
function _threadHue(scopeId){ let h=0; const s=String(scopeId||''); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return `hsl(${h%360},58%,60%)`; }

// ---- the system VITAL SIGN (ECG canvas) — always-on heartbeat baseline +
// one spike per verified event. The page is alive the instant it loads, and the
// waveform decays to a calm baseline when work rests (never fakes activity). ----
let _vitalBuf=null, _vitalPhase=0, _lastBeatAt=0;
function drawVital(){
  const c=$('#vital'); if(!c) return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const w=c.clientWidth||360, h=c.clientHeight||30;
  if(c.width!==Math.round(w*dpr)){ c.width=Math.round(w*dpr); c.height=Math.round(h*dpr); }
  const N=Math.max(80,Math.round(w));
  if(!_vitalBuf||_vitalBuf.length!==N){ _vitalBuf=new Array(N).fill(0).map(()=>({v:0,col:'#21d07a'})); }
  const running=!S.heartbeat||S.heartbeat.running!==false;
  // advance one sample/frame: baseline heartbeat blip + the strongest queued spike
  _vitalPhase+=1;
  let sample=0, col='#21d07a';
  const beatFrames=Math.max(40,Math.round((S.heartbeat&&S.heartbeat.interval_s||5)*60/3)); // visible blip cadence
  if(running && !RM && _vitalPhase-_lastBeatAt>=beatFrames){ _lastBeatAt=_vitalPhase; sample=Math.max(sample,.34); }
  if(S.vitalSpikes.length){ const sp=S.vitalSpikes[S.vitalSpikes.length-1];
    sample=Math.max(sample,.55+sp.a*.4); col=sp.col; sp.a-=.5; if(sp.a<=0) S.vitalSpikes.pop(); }
  _vitalBuf.push({v:sample,col}); if(_vitalBuf.length>N) _vitalBuf.shift();
  // draw
  const ctx=c.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  const mid=h*.55, amp=h*.42;
  ctx.lineWidth=1.4; ctx.lineJoin='round';
  ctx.beginPath(); ctx.strokeStyle='rgba(72,88,106,.5)'; ctx.moveTo(0,mid); ctx.lineTo(w,mid); ctx.stroke();
  // waveform
  ctx.beginPath(); ctx.strokeStyle=running?'#21d07a':'#48586a';
  for(let i=0;i<_vitalBuf.length;i++){ const x=i*(w/N); const y=mid-_vitalBuf[i].v*amp;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.stroke();
  // leading-edge dot, coloured by the most recent event class
  const last=_vitalBuf[_vitalBuf.length-1];
  if(last.v>.1){ ctx.fillStyle=last.col; ctx.beginPath(); ctx.arc((N-1)*(w/N),mid-last.v*amp,2.2,0,7); ctx.fill(); }
}

// ---- humane VITALS counters (replaces the exchange board-stats cluster) ----
function updateVitalsCounters(){
  const box=$('#stats'); if(!box) return;
  if(!box.dataset.built){ box.dataset.built='1';
    box.innerHTML=['auth','personas','active','envs','acts','signed'].map((k)=>{
      const lbl={auth:'access',personas:'personas',active:'streaming',envs:'envs',acts:'acts/min',signed:'verified'}[k];
      const init=k==='auth'?'discover':'0';
      return `<div class="stat" id="st-${k}"><div class="v">${init}</div><div class="k">${lbl}</div></div>`;
    }).join(''); }
  const setV=(id,val)=>{ const el=$(id); if(!el) return; const v=el.querySelector('.v');
    if(v.textContent!==String(val)){ v.textContent=val; v.classList.remove('flash'); void v.offsetWidth; v.classList.add('flash'); } };
  let personasN=S.liveByPersona.size;
  for(const id of S.order){ if(S.recs.get(id).kind==='persona') personasN=Math.max(personasN,1); }
  const recPersona=S.order.filter((id)=>S.recs.get(id).kind==='persona').length;
  personasN=Math.max(S.liveByPersona.size,recPersona);
  const now=Date.now();
  // STREAMING = personas with live req/resp (model_events) OR a coordination act
  // in the last 60s — so the headline can't read 0 while the feed is streaming.
  const streaming=new Set();
  for(const [psid,pd] of S.liveByPersona) if((pd.models||[]).length>0) streaming.add(psid);
  if(S.ixByPersona) for(const [psid,arr] of S.ixByPersona) if(arr.some((a)=>now-a._t<60000)) streaming.add(psid);
  const active=streaming.size;
  const acts=(S.interactions||[]).filter((e)=>now-e._t<60000).length;
  // "verified" counts ONLY Ed25519-verified records (S.recs all pass verifyRecord);
  // unverified live interactions are NOT signed and must never inflate this.
  const signed=S.recs.size;
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  setV('#st-auth',hasOp?'read':'discover');
  const authEl=$('#st-auth'); if(authEl){ authEl.classList.toggle('auth-read',hasOp);
    authEl.title=hasOp?'operator token saved — read-level views unlocked':'anonymous — discover-level public projection only'; }
  setV('#st-personas',personasN); setV('#st-active',active); setV('#st-envs',S.envCount);
  setV('#st-acts',acts); setV('#st-signed',signed.toLocaleString());
  // verify badge live count
  const vb=$('#verifybadge'); if(vb) vb.title=`${S.recs.size} signed record(s) Ed25519-verified in your browser`;
  // livedot beats ONLY while a real node heartbeat is running (no decorative pulse)
  const dot=$('#livedot'); if(dot){ const beating=!!(S.heartbeat&&S.heartbeat.running!==false);
    dot.classList.toggle('beating',beating);
    dot.title=beating?'live — node heartbeat running':'no live node heartbeat';
    dot.setAttribute('aria-label',beating?'node heartbeat live':'node idle'); }
}

async function refreshSystemView(){
  const host=$('#sysEnvs'); if(!host) return;
  // structure: each discovered base → its envs (entities index) → members (env feed).
  const bases=[...new Set([...(S.boots?S.boots.keys():[]), ''])];
  const envBlocks=[];          // {kernel, envId, sid, name, type, status, members[], run, recId, live}
  const assigned=new Set();
  const bySid=new Map();        // sid -> envBlock, so a live feed + its discovered record merge into one lane
  // (1) LIVE-telemetry environments — rich: members, status, lineage spans.
  for(const key of bases){ const base=key==='@origin'?'':key;
    const ent=await fetchEntityFeed(base,'telemetry/live/entities.json'); if(!ent) continue;
    const kernel=(S.boots.get(key)||{}).kernel_id||base||'@origin';
    for(const [eid,rel] of Object.entries(ent.environments||{})){
      const feed=await fetchEntityFeed(base,rel); if(!feed) continue;
      const members=(feed.members||[]).map(_shortId);
      members.forEach((m)=>assigned.add(m));
      const sid=_shortId(eid);
      const prev=bySid.get(sid);
      if(prev){   // SAME env discovered via another base/alias (localhost vs 127.0.0.1
                  // vs @origin vs ?peer) — merge into the one lane, never duplicate it.
        if(members.length>prev.members.length){ prev.members=members; prev.spans=feed.spans||prev.spans; }
        if(!prev.status) prev.status=feed.status||''; if(!prev.type) prev.type=feed.env_type||'';
        continue; }
      const b={base,kernel,envId:eid,sid,name:feed.name||eid,
        type:feed.env_type||'',status:feed.status||'',members,spans:feed.spans||[],
        run:null,recId:null,live:true};
      bySid.set(sid,b); envBlocks.push(b);
    }
  }
  // (2) Every DISCOVERED + Ed25519-verified environment record — so EVERY env
  // shows on the stage (the operator root + federated task workspaces with no
  // live feed), not only the ones streaming live telemetry this session. A record
  // that matches a live env enriches that lane (run id for the deliverable join);
  // one with no live feed becomes its own lane.
  for(const id of S.order){ const r=S.recs.get(id); if(r.kind!=='env') continue;
    const sid=_envSid(r); const run=runOf(r); const exportRel=(r._links||{}).export;
    const cap=(r.capability_summary||[]).filter((c)=>c&&c!=='project_workspace');
    let b=bySid.get(sid);
    if(b){ b.recId=b.recId||id; b.run=b.run||run; if(b.name===b.envId) b.name=r.label||b.name;
      if(!b.type&&cap.length) b.type=cap[cap.length-1]; if(!b.exportRel) b.exportRel=exportRel; }
    else { b={base:r._base||'',kernel:r._kernel||'',envId:r.did||sid,sid,
        name:r.label||sid,type:cap[cap.length-1]||'env',status:'',members:[],spans:[],
        run,recId:id,live:false,exportRel};
      bySid.set(sid,b); envBlocks.push(b); }
  }
  // (2b) An env whose LIVE feed is absent (a federated env, or any env whose live
  // telemetry dropped after a node RESTART) still has its signed, durable export doc
  // (links.export → environments/<id>.json) carrying its full member ROSTER. Pull it
  // so the personas that worked in the env still SHOW in the env (members + count),
  // instead of a "no members" lane — the env's people don't vanish on restart.
  await Promise.all(envBlocks.map(async(b)=>{
    if(b.members.length || !b.exportRel) return;
    const ed=await fetchEntityFeed(b.base,b.exportRel); if(!ed||!Array.isArray(ed.members)) return;
    b.roster=ed.members;
    b.members=ed.members.map((m)=>_shortId(m.persona_id||m.id||'')).filter(Boolean);
    b.members.forEach((m)=>assigned.add(m));
    if(!b.status) b.status=ed.status||'';
    b.fromExport=true;
  }));
  S.envCount=envBlocks.length;
  // personas known live but not in any env feed → a node-roster lane
  const orphans=[...S.liveByPersona.keys()].filter((p)=>!assigned.has(p));
  // refresh the friendly-name map from discovered persona records
  for(const id of S.order){ const r=S.recs.get(id); if(r.kind==='persona'){
    const sid=_shortId(r.did||r.record_id); if(r.label) _PERSONA_NAME.set(sid,r.label); } }
  // artifacts joined to their ENVIRONMENT by the workspace run id (not lumped by
  // kernel) — each lane shows ITS OWN signed deliverables, never another env's.
  const artByRun=new Map();
  for(const id of S.order){ const r=S.recs.get(id);
    if(r.kind!=='artifact') continue; const run=runOf(r); if(!run) continue;
    (artByRun.get(run)||artByRun.set(run,[]).get(run)).push(r); }

  const laneHTML=(b)=>{
    const cards=b.members.length?b.members.map(renderPersonaCard).join('')
      :'<div class="l2" style="padding:8px">awaiting members</div>';
    const arts=b.run?(artByRun.get(b.run)||[]):[];
    const bundles=arts.filter((a)=>a._links&&a._links.bundle);
    // file cards carry content_stub/content_hash (the public projection), not always a
    // raw `content` link — count any of them so the bundle chip shows a real file count.
    const fileCount=arts.filter((a)=>{ const L=a._links||{};
      return L.content||L.content_stub||L.content_hash; }).length;
    const chips=(bundles.length?bundles:arts).slice(0,6).map((a)=>{
      const n=(bundles.length&&a._links&&a._links.bundle)?fileCount:0;
      // data-artid MUST be the S.recs key (record_id/card_id — see upsert), not a.id
      // (records have no .id field), or the click handler's S.recs.has() always misses.
      const aid=a.record_id||a.card_id||a.id||'';
      const _al=a.label||'artifact';
      return `<span class="art-chip" data-artid="${esc(aid)}" role="button" tabindex="0" title="${esc(a.label||'')}">▣ ${esc(_al.length>26?_al.slice(0,24)+'…':_al)}${n?` · ${n} file${n>1?'s':''}`:''}</span>`;
    }).join('');
    const artRow=arts.length?`<div class="env-arts"><span class="l2">deliverables:</span>${chips}</div>`:'';
    // roster pulled from the durable export (no live feed) is HISTORICAL — its members
    // have departed; mark it so it reads as "who worked here", not "who is here now".
    const departed=b.fromExport && (b.roster||[]).length>0 && (b.roster||[]).every((m)=>m&&m.active===false);
    // a fully-departed env is not "active" anymore — read it as archived (muted),
    // never the strongest positive green that says "people working here now".
    const statusTxt=departed?'archived':(b.status||(b.live?'—':'discovered'));
    const statusOk=(b.status==='active' && !departed);
    const memberTxt=b.members.length?` · ${b.members.length} member${b.members.length>1?'s':''}`:'';
    return `<div class="env-lane" data-envsid="${esc(b.sid)}" style="--envhue:${_envHue(b.sid)}">`
      +`<div class="env-head"><span class="env-badge">ENV</span>`
      +`<span class="env-name" data-envrec="${esc(b.sid)}" role="button" tabindex="0">${esc(b.name)}</span>`
      +`<span class="env-meta">${esc((b.type||'env').replace(/_/g,' '))} · <span class="${statusOk?'ok':'l2'}">${esc(statusTxt)}</span>${memberTxt}${arts.length?` · ${arts.length} artifact${arts.length>1?'s':''}`:''}</span></div>`
      +`<div class="env-personas">${cards}</div>${artRow}</div>`;
  };
  // (3) DE-DUPE lanes that are the SAME mission discovered as several env records
  // (e.g. 'Power electronics task workspace' ×2 + 'power_electronics…' + 'electrical_engineering…').
  // bySid keys on exact sid, so these become N full lanes with an identical roster +
  // deliverable. Group by (kernel + normalized task) — mirroring missionCardList()'s
  // (kernel::task) dedupe — and keep ONE survivor per group (prefer live, then a
  // lane that bears a deliverable, then the one with the most members).
  const _normTask=(s)=>String(s||'').toLowerCase().trim().replace(/\s+(task\s+)?workspace$/,'').trim();
  const _dgroups=new Map();
  for(const b of envBlocks){ const k=(b.kernel||'')+'::'+_normTask(b.name);
    (_dgroups.get(k)||_dgroups.set(k,[]).get(k)).push(b); }
  const _kept=[];
  for(const grp of _dgroups.values()){
    if(grp.length===1){ _kept.push(grp[0]); continue; }
    const survivor=grp.slice().sort((a,b)=>{
      const sc=(x)=>(x.live?4:0)+((x.run&&artByRun.has(x.run))?2:0)+Math.min(1,x.members.length?1:0);
      const d=sc(b)-sc(a); return d!==0?d:(b.members.length-a.members.length);
    })[0];
    _kept.push(survivor);
  }
  // (4) SORT lanes by activity so the hero slot is a running/deliverable-bearing env,
  // never an empty 'awaiting members' lane. Stable sort pushes empty/departed last.
  const _score=(b)=> (b.members.some((m)=>_runningNow(m))?4:0)
    + (b.members.some((m)=>(S.liveByPersona.get(m)||{}).models)?2:0)
    + ((b.run&&artByRun.has(b.run))?1:0);
  _kept.sort((a,b)=>_score(b)-_score(a));
  // HIDE empty infrastructure lanes — e.g. the node's operator/governance ROOT, which owns
  // no personas (every task workspace is composed as its child). An env with no members AND
  // no shipped deliverables is plumbing, not a workspace; showing it as an "awaiting members"
  // lane only clutters the personas-at-work view. Fall back to all only if hiding empties the stage.
  const _visible=_kept.filter((b)=>b.members.length>0 || (b.run&&artByRun.has(b.run)));
  envBlocks.length=0; envBlocks.push(...((_visible.length||orphans.length)?_visible:_kept));
  S.envCount=envBlocks.length;
  let html=envBlocks.map(laneHTML).join('');
  if(orphans.length){
    html+=`<div class="env-lane orphan"><div class="env-head"><span class="env-badge alt">NODE ROSTER</span>`
      +`<span class="env-meta">personas not currently in a task environment</span></div>`
      +`<div class="env-personas">${orphans.map(renderPersonaCard).join('')}</div></div>`;
  }
  const finalHTML=html||((S.recs.size||S.liveByPersona.size)
    ?'<div class="dim" style="padding:20px">no environments discovered yet — start or add a node.</div>'
    :emptyStateHTML());
  // only rewrite when the stage actually changed → unchanged (idle) renders keep
  // their in-flight breathing/flash animations instead of restarting every 5s.
  if(host.dataset.h!==finalHTML){ host.dataset.h=finalHTML; host.innerHTML=finalHTML; }
  _applyFollow();
  // build the graph node set from ACTIVE-env members + any live orphan personas
  const graphIds=[...new Set([...envBlocks.flatMap((b)=>b.members),...orphans.filter((o)=>(S.liveByPersona.get(o)||{}).models)])];
  const persons=graphIds.map((sid)=>{ const d=S.liveByPersona.get(sid)||{}; const s=d.summary||{};
    const models=d.models||[]; const last=models[models.length-1];
    return {sid,name:s.name||_nameFor(sid),role:_coordRole(sid,s),live:!!last,
      running:_runningNow(sid),
      doing:last?(PURPOSE_VERB[last.purpose]||last.purpose):''}; }).slice(0,14);
  renderCoordGraph(persons);
  renderInteractionStream();
  updateVitalsCounters();
  if(S.q) _applyFilter();   // re-apply the active filter after the 5s stage/feed rebuild
}
// per-env accent hue (stable, from the design palette) for the lane border/badge
const _ENV_HUES=['#19c39a','#3aa0ff','#a779e6','#f0a73a','#ff5fa2'];
function _envHue(sid){ let h=0; const s=String(sid||''); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return _ENV_HUES[h%_ENV_HUES.length]; }
// persona-follow: dim cards + feed rows that aren't the followed persona
function _applyFollow(){
  const f=S.follow;
  document.querySelectorAll('.pcard').forEach((el)=>{ el.classList.toggle('dimmed',!!f&&el.dataset.pcard!==f);
    el.querySelector('.pc-follow')?.setAttribute('aria-pressed',String(el.dataset.pcard===f)); });
  const ff=$('#cfFollow'); if(ff) ff.hidden=!f;
  // light up the followed node in the constellation too (card/feed-initiated follows
  // should give the graph the same selected feedback as clicking a node directly).
  const g=$('#sysGraph'); if(g){ g.classList.toggle('has-follow',!!f);
    g.querySelectorAll('[data-gp]').forEach((n)=>n.classList.toggle('gn-followed',n.dataset.gp===f)); }
}

// the live COORDINATION FEED — the heartbeat of who→whom:what. Newest slides in
// at the top (.fresh); adjacent acts sharing a real scope_id get a per-task
// THREAD SPINE so you can watch one task ripple produce→verify→ship. The kernel
// is rendered as the honest mediator — we NEVER draw a persona→persona arrow the
// data doesn't contain; the only honest persona↔persona link is the scope_id join.
function renderInteractionStream(){
  const el=$('#sysStream'); if(!el) return;
  const flt=S.sysFlt||'all';
  const all=(S.interactions||[]);
  S.ixSeen=S.ixSeen||new Set();   // _keys already painted (so only genuinely-new rows .fresh in)
  const rows=all.filter((e)=>{ const c=_ixClass(e.kind);
    if(flt==='all') return true;
    if(flt==='think') return c==='think';
    if(flt==='coord') return c==='coord';
    if(flt==='verify') return c==='verify';
    if(flt==='crossenv') return c==='crossenv';
    if(flt==='artifact') return c==='artifact';
    return true; }).slice(-120).reverse();
  const f=S.follow;
  const matches=(e)=>!f|| (e.actor_kind==='persona'&&_shortId(e.actor_id)===f)
    || (e.affected||[]).some((a)=>a.kind==='persona'&&_shortId(a.id)===f);
  let prevScope=null;
  el.innerHTML=rows.map((e)=>{
    const c=_ixClass(e.kind); const fail=_ixFailed(e.kind);
    const who=e.actor_kind==='persona'?_nameFor(_shortId(e.actor_id)):(e.actor_id?`${esc(e.actor_kind)}:${esc((e.actor_id||'').slice(0,10))}`:esc(e.actor_kind||'kernel'));
    const aff=(e.affected||[]).map((a)=>a.kind==='persona'?_nameFor(_shortId(a.id)):`${a.kind}:${(a.id||'').slice(0,8)}`);
    const arrow=aff.length?`<span class="ix-arrow">→</span><span class="ix-to">${esc(aff.join(', '))}</span>`:'';
    const fresh=!S.ixSeen.has(e._key); if(fresh) S.ixSeen.add(e._key);
    // thread spine when this row shares a real scope_id with the one above it
    const sid=e.scope_id&&/[:/]/.test(String(e.scope_id))?String(e.scope_id):null;
    const threaded=sid&&sid===prevScope; prevScope=sid;
    const spine=threaded?`<span class="ix-spine${fresh?' grow':''}" style="--thread:${_threadHue(sid)}"></span>`:'';
    // read the row like a live MESSAGE: "<persona> <verb> → <to> · <detail>".
    const verb=_ixVerb(e.kind);
    const msg=e._msg?`<span class="ix-msg">${esc(e._msg)}</span>`:'';
    const ttl=e._rationale?` title="${esc(e._rationale)}"`:'';
    return `<li class="ix ix-${c}${fail?' fail':''}${fresh?' fresh':''}${threaded?' threaded':''}${(f&&!matches(e))?' dimmed':''}"${ttl}>`
      +spine+`<span class="ix-kind">${esc(verb)}</span>`
      +`<span class="ix-from">${esc(who)}</span>${arrow}${msg}`
      +`<span class="ix-scope">${esc(e.scope==='cognition'?'':e.scope||'')}</span><span class="ix-time">${esc(_ago(e._t))}</span></li>`;
  }).join('')||(()=>{
    // cognition is operator-token-only by design (A-TF2), so an anonymous THINK feed is
    // always empty — explain that instead of the generic 'fund a mission' line.
    if(flt==='think' && Object.keys((typeof opTokens==='function'?opTokens():{})).length===0)
      return '<li class="l2" style="padding:10px">persona cognition is operator-only (A-TF2) — add an operator token in the console to watch the THINK stream.</li>';
    // presence check so the intentional empty-string label (all) survives the lookup
    const lbl={all:'',think:'thinking ',coord:'coordination ',verify:'verification ',artifact:'shipped-artifact ',crossenv:'cross-env '};
    const q=(flt in lbl)?lbl[flt]:(flt+' ');
    return '<li class="l2" style="padding:10px">no '+esc(q)+'activity yet — fund a mission to watch personas coordinate.</li>';
  })();
  const r=$('#sysStreamRate'); if(r) r.textContent=`${all.length} live acts`;
  // self-filter so an active search query keeps filtering the feed even when this is
  // called directly (tab-switch / follow toggle / cognition merge), not only via the 5s caller.
  if(S.q) document.querySelectorAll('#sysStream .ix').forEach((li)=>{ if(!li.textContent.toLowerCase().includes(S.q)) li.style.display='none'; });
  // prune the 'seen' set to the live ring unconditionally — a node streaming ONLY
  // cognition/model events never hits the indexLiveTelemetry prune, so ixSeen would
  // otherwise leak for the page's life.
  const liveKeys=new Set((S.interactions||[]).map((e)=>e._key));
  for(const k of [...S.ixSeen]) if(!liveKeys.has(k)) S.ixSeen.delete(k);
}

// ---- per-entity feed documents (telemetry/personas/<slug>.json etc.) ----
// The node serves each persona's and each env's OWN redacted-tier live feed
// (09_PROTOCOLS §4.1 / A-TF2). The drawer prefers that authoritative document;
// the client-side index over the node-wide aggregate stays as the fallback for
// older nodes that only publish telemetry/live/latest.json.
async function fetchEntityFeed(base,rel){
  const key=(base||'@origin')+'|'+rel;
  const m=(S.entFeed=S.entFeed||new Map()); const hit=m.get(key);
  if(hit&&(Date.now()-hit.ts)<4000) return hit.v;
  const v=await fetchJson(join(base,rel)); m.set(key,{v,ts:Date.now()}); return v;
}
function feedModels(doc){ return ((doc&&doc.model_events)||[]).filter((m)=>(m.kind||'')==='MODEL_SELECTED')
  .map((m)=>({purpose:String(m.requested_purpose||m.role||'model'),model:String(m.model_id||'—'),role:String(m.role||'')})); }
function renderPersonaFeedDoc(doc){
  const s=doc.summary||{}; let h='';
  // PER-04 / §4.1: public tiles (state, tasks, reputation); operator-tier evolution
  // internals + GEPA cohort only with an operator token.
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  h+=`<div class="livegrid">`
    +`<div class="lm"><div class="lmv ${s.lifecycle_state==='ACTIVE'?'ok':''}">${esc(s.lifecycle_state||'—')}</div><div class="lmk">state</div></div>`
    +`<div class="lm"><div class="lmv">${esc(s.experience_tasks??0)}</div><div class="lmk">tasks</div></div>`
    +(s.reputation_score!=null?`<div class="lm"><div class="lmv ok">${esc(Number(s.reputation_score).toFixed(2))}</div><div class="lmk">reputation</div></div>`:'')
    +(hasOp?`<div class="lm"><div class="lmv">${esc(s.tactic_count??s.cohort_visible_tactic_count??0)}</div><div class="lmk">tactics</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.lesson_count??0)}</div><div class="lmk">lessons</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.memory_count??0)}</div><div class="lmk">memory</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.fitness!=null?Number(s.fitness).toFixed(1):'—')}</div><div class="lmk">fitness (op)</div></div>`:'')
    +`</div>`;
  if(hasOp&&(s.evolution_trace_count!=null||s.accepted_trace_count!=null))
    h+=`<div class="l2" style="margin:4px 0 0">evolution: ${esc(s.accepted_trace_count??0)}/${esc(s.evolution_trace_count??0)} accepted trials${s.gepa_cohort_id?' · cohort '+esc(String(s.gepa_cohort_id).slice(0,18)):''}</div>`;
  h+=`<div class="l2" style="margin:6px 0 3px">Doing now</div>`+_liveFeed(feedModels(doc));
  const sp=doc.spans||[];
  if(sp.length){ const counts={}; sp.forEach((x)=>{const k2=(x.attributes||{})['personaos.lineage.event_kind']||x.name||'SPAN'; counts[k2]=(counts[k2]||0)+1;});
    h+=`<div class="l2" style="margin:6px 0 3px">Lifecycle / lineage</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k2,v])=>
        `<div class="grant"><span class="l2">${esc(k2)}</span><span class="ok">${esc(v)}</span></div>`).join(''); }
  return h;
}
function renderEnvFeedDoc(doc){
  let h=`<div class="livegrid">`
    +`<div class="lm"><div class="lmv ${String(doc.status)==='active'?'ok':''}">${esc(doc.status||'—')}</div><div class="lmk">status</div></div>`
    +`<div class="lm"><div class="lmv">${esc(doc.env_type||'—')}</div><div class="lmk">type</div></div>`
    +`<div class="lm"><div class="lmv">${esc(doc.member_count??(doc.members||[]).length)}</div><div class="lmk">members</div></div>`
    +`<div class="lm"><div class="lmv">${esc((doc.spans||[]).length)}</div><div class="lmk">events</div></div>`
    +`</div>`;
  const sp=doc.spans||[];
  if(sp.length){ const counts={}; sp.forEach((x)=>{const k2=(x.attributes||{})['personaos.lineage.event_kind']||x.name||'SPAN'; counts[k2]=(counts[k2]||0)+1;});
    h+=`<div class="l2" style="margin:3px 0">Lineage events (this env)</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k2,v])=>
        `<div class="grant"><span class="l2">${esc(k2)}</span><span class="ok">${esc(v)}</span></div>`).join(''); }
  h+=`<div class="l2" style="margin:6px 0 3px">Model activity in this env <span class="dim">(own feed)</span></div>`+_liveFeed(feedModels(doc));
  return h;
}
// ---- 🧠 persona THINKING (02_PERSONA §4/§8-10) ----
// Operator (token) sees the persona's cognition in ITS OWN WORDS — learned
// lessons (trigger→action+rationale), evolved EVOLVE-BLOCK tactics with GEPA
// provenance, mode proficiencies, the signed cognition timeline, and the exact
// thinking FRAME (SOUL + evolved tactics + retrieved knowledge) it generates
// under. Anonymous viewers get the A-TF2 redacted tier: transition kinds +
// proficiency numbers from the persona's own public feed — content never.
function renderThinking(t){
  let h='';
  const out=t.recent_outputs||[];
  if(out.length){
    h+=`<div class="l2" style="margin:2px 0 3px">🗣️ Recent model output — what the LLM actually produced (newest first)</div>`
      +out.slice(-10).reverse().map((o)=>
        `<div class="think llmout"><span class="amber">${esc(o.kind||'output')}</span> `
        +`<span class="opmsg">${esc(String(o.text||'').slice(0,240))}</span></div>`).join('');
  }
  const mp=t.mode_proficiencies||{};
  if(Object.keys(mp).length){
    h+=`<div class="l2" style="margin:2px 0">Cognitive modes (proficiency it earned per mode)</div>`
      +Object.entries(mp).sort((a,b)=>b[1]-a[1]).map(([m,v])=>
        `<div class="grant"><span class="l2">${esc(m)}</span><span class="ok">${esc(Number(v).toFixed(2))}</span></div>`).join('');
  }
  const lessons=t.lessons||[];
  if(lessons.length){
    h+=`<div class="l2" style="margin:6px 0 3px">Lessons it learned — its own words</div>`
      +lessons.slice(-6).reverse().map((l)=>
        `<div class="think"><span class="amber">when</span> ${esc(l.trigger||'—')} <span class="amber">→</span> ${esc(l.action||'')}`
        +(l.rationale?`<div class="l2">${esc(String(l.rationale).slice(0,260))}</div>`:'')
        +`<div class="l2">confidence ${esc(Number(l.confidence||0).toFixed(2))}</div></div>`).join('');
  }
  const tactics=t.tactics||[];
  if(tactics.length){
    h+=`<div class="l2" style="margin:6px 0 3px">Evolved tactics (EVOLVE-BLOCK · GEPA-signed)</div>`
      +tactics.slice(-6).reverse().map((x)=>
        `<div class="think">${esc(String(x.action||x.trigger||'').slice(0,300))}`
        +`<div class="l2">${esc(x.source||'manual')} · score ${esc(Number(x.score||0).toFixed(2))} · v${esc(x.version||1)}${x.cohort?' · '+esc(x.cohort):''}</div></div>`).join('');
  }
  const facts=t.proven_facts||[];
  if(facts.length){
    h+=`<div class="l2" style="margin:6px 0 3px">Shared proven facts it holds</div>`
      +facts.slice(-4).reverse().map((s)=>`<div class="think l2">${esc(String(s).slice(0,220))}</div>`).join('');
  }
  const tl=t.evolution_timeline||[];
  if(tl.length){
    h+=`<div class="l2" style="margin:6px 0 3px">Cognition timeline (signed evolution log)</div><div class="tape-mini">`
      +tl.slice(-10).reverse().map((e)=>
        `<div class="row2"><span class="l2">${esc(e.kind||'')}</span><span>${esc(e.mode||'')}</span>`
        +`<span class="${e.accepted===true?'ok':e.accepted===false?'down':'l2'}">${e.accepted===true?'✓':e.accepted===false?'✗':''}</span></div>`).join('')+`</div>`;
  }
  if(t.thinking_frame)
    h+=`<details class="frame"><summary class="l2">🧠 thinking frame — the exact prompt it generates under (SOUL + evolved tactics + retrieved knowledge)</summary>`
      +`<pre class="opout">${esc(t.thinking_frame)}</pre></details>`;
  return h||'<div class="l2">no cognition recorded yet — it has not worked a task</div>';
}
function renderThinkingRedacted(doc){
  let h='<div class="l2">public tier shows TRANSITIONS only (A-TF2) — the operator token unlocks lessons, tactics and the thinking frame</div>';
  const mp=(doc&&doc.summary&&doc.summary.mode_proficiencies)||{};
  if(Object.keys(mp).length)
    h+=Object.entries(mp).sort((a,b)=>b[1]-a[1]).map(([m,v])=>
      `<div class="grant"><span class="l2">${esc(m)}</span><span class="ok">${esc(Number(v).toFixed(2))}</span></div>`).join('');
  const tl=(doc&&doc.transitions)||[];
  if(tl.length)
    h+='<div class="tape-mini">'+tl.slice(-10).reverse().map((e)=>
      `<div class="row2"><span class="l2">${esc(e.kind||'')}</span><span>${esc(e.mode||'')}</span>`
      +`<span class="l2">${e.accepted===true?'✓':e.accepted===false?'✗':''}</span></div>`).join('')+'</div>';
  return h;
}
async function refreshThinking(){
  if(!S.drawerThinkPid) return;
  const el=$('#thinksec'); if(!el) return;
  const want=S.drawerThinkPid;
  const t=await fetchJson(join(S.drawerLiveBase||'',`personas/${encodeURIComponent(_shortId(want))}/thinking`));
  if(S.drawerThinkPid!==want) return;   // drawer navigated away mid-fetch
  const el2=$('#thinksec'); if(!el2) return;
  if(t&&t.schema==='personaos-persona-thinking/1'){ el2.innerHTML=renderThinking(t); return; }
  const doc=S.drawerLiveFeed?await fetchEntityFeed(S.drawerLiveBase||'',S.drawerLiveFeed):null;
  if(S.drawerThinkPid!==want) return;
  const el3=$('#thinksec'); if(el3) el3.innerHTML=renderThinkingRedacted(doc);
}
// LIVE persona MESSAGES (operator-tier): poll active personas' cognition surface and merge
// their ACTUAL recent model outputs (what the LLM produced) + newest learned lesson into the
// SAME live feed — so the operator watches persona LLM messages in real time WITHOUT drilling
// into a drawer. Public viewers get nothing here by design (A-TF2: content is operator-only).
let _cogBusy=false;
// Readable one-line preview of a persona's raw model OUTPUT (a candidate package
// JSON or a code blob) — so the THINK feed shows WHAT it produced, not a code dump.
function _cogPreview(msg){
  const s=String(msg||'').trim();
  if(s[0]==='{'||s[0]==='['){ try{ const o=JSON.parse(s); const p=(o&&o.package)||o;
    const files=p&&p.files;
    if(Array.isArray(files)&&files.length) return `produced ${files.length}-file package — ${files.slice(0,4).join(', ')}${files.length>4?'…':''}`;
    if(p&&p.file_count) return `produced ${p.file_count}-file package`;
  }catch(e){} }
  for(const ln of s.split(/\r?\n/)){ const t=ln.trim();
    if(!t||t.startsWith('#!')||/^(import |from |\/\/|#|"""|''')/.test(t)) continue; return t.slice(0,150); }
  return s.replace(/\s+/g,' ').slice(0,150);
}
async function streamPersonaCognition(){
  if(_cogBusy) return;
  _cogBusy=true;
  try{
    S.cogBaseFor=S.cogBaseFor||new Map();   // sid -> the base that served its thinking (sticky)
    // The bases that actually serve the personaos API are the ones that streamed LIVE telemetry
    // (the cards render from those) — NOT necessarily a discovery record's _base (which may be an
    // IPFS/alias host that doesn't serve the API). Probe telemetry bases first, then record bases.
    const apiBases=[...new Set([
      ...[...(S.liveTel?S.liveTel.keys():[])].map((k)=>k==='@origin'?'':k),
      ...[...(S.order||[])].map((id)=>S.recs.get(id)).filter((r)=>r&&r.kind==='persona').map((r)=>r._base||''),
      '',
    ])];
    // Stream for the personas actually SHOWN (live telemetry) plus any discovered persona records.
    const sids=new Set([...(S.liveByPersona?S.liveByPersona.keys():[])]);
    for(const id of (S.order||[])){ const r=S.recs.get(id);
      if(r&&r.kind==='persona') sids.add(_shortId(r.did||r.id||'')); }
    const list=[...sids].filter(Boolean).slice(0,24);   // cover specialists/born personas, not just the first few
    S.interactions=S.interactions||[]; S.ixKeys=S.ixKeys||new Set(); let added=0;
    for(const sid of list){
      // sticky base first (avoids re-probing every poll), then the candidate API bases
      const order=[...new Set([S.cogBaseFor.get(sid), ...apiBases].filter((b)=>b!==undefined))];
      let t=null, usedBase='';
      for(const base of order){
        // _shortId strips the did:/persona: PREFIX (it is NOT a length truncation), giving the
        // bare ULID the /thinking endpoint resolves for BOTH founder AND born specialists.
        // Do NOT use the prefixed persona_id: encodeURIComponent turns its ':' into %3A → 404,
        // which is exactly why born ('persona:<ulid>') personas stopped streaming.
        const r=await fetchJson(join(base,`personas/${encodeURIComponent(sid)}/thinking`));
        if(r && r.schema==='personaos-persona-thinking/1'){ t=r; usedBase=base; S.cogBaseFor.set(sid,base); break; }
      }
      if(!t) continue;
      const rows=[];
      for(const o of (t.recent_outputs||[])) rows.push({kind:'LLM_OUTPUT',msg:o.text,at:o.at});
      const lz=(t.lessons||[]); if(lz.length) rows.push({kind:'LLM_LESSON',msg:lz[lz.length-1].action,at:''});
      for(const row of rows){
        const msg=String(row.msg||'').trim(); if(!msg) continue;
        // KEY on the OUTPUT TIMESTAMP (not a content prefix) — distinct candidates often
        // share a boilerplate prefix (#!/usr/bin/env python3, imports…), so a prefix key
        // collapsed them into one and the feed never advanced. The timestamp is unique.
        const key=`cog|${sid}|${row.kind}|${row.at||''}|${msg.length}`;
        if(S.ixKeys.has(key)) continue; S.ixKeys.add(key); added++;
        const preview=row.kind==='LLM_LESSON'?('learned — '+msg):_cogPreview(msg);
        S.interactions.push({actor_id:sid,actor_kind:'persona',affected:[],kind:row.kind,scope:'cognition',
          scope_id:'',at:'',_base:usedBase,_t:Date.parse(row.at||'')||Date.now(),_key:key,
          _msg:preview.slice(0,200),_rationale:msg});
      }
    }
    if(added){
      S.interactions.sort((a,b)=>a._t-b._t);
      if(S.interactions.length>400) S.interactions=S.interactions.slice(-400);
      S.ixKeys=new Set(S.interactions.map((e)=>e._key));
      renderInteractionStream();
    }
  }catch(e){}
  finally{ _cogBusy=false; }
}
function refreshLiveSection(){
  if(!S.drawerLiveKind||!S.drawerLiveId) return;
  const el=$('#livesec'); if(!el) return;
  const fallback=()=>{ const el2=$('#livesec'); if(!el2) return;
    el2.innerHTML=S.drawerLiveKind==='persona'?renderPersonaLive(S.drawerLiveId):renderEnvLive(S.drawerLiveId); };
  if(S.drawerLiveFeed){
    // capture the target before the async fetch: if the drawer navigated away
    // meanwhile, a slow response must never paint entity A into entity B's view.
    const wantFeed=S.drawerLiveFeed, wantId=S.drawerLiveId;
    fetchEntityFeed(S.drawerLiveBase||'',wantFeed).then((doc)=>{
      if(S.drawerLiveFeed!==wantFeed||S.drawerLiveId!==wantId) return;
      const el2=$('#livesec'); if(!el2) return;
      if(doc&&doc.schema==='personaos-persona-telemetry/1') el2.innerHTML=renderPersonaFeedDoc(doc);
      else if(doc&&doc.schema==='personaos-env-telemetry/1') el2.innerHTML=renderEnvFeedDoc(doc);
      else fallback();
    }).catch(fallback);
    return;
  }
  fallback();
}
async function personaView(r){ const base=r._base||'',L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v);
  S.curBase=base;
  // PersonaCard public projection (02_PERSONA): bind the SERVED profile doc
  // (links.profile → personas/<id>.json). PER-04: the public card shows
  // reputation_score [0,1] — never raw operator fitness (that lives only in
  // the token-gated operator console). /status is a fallback for liveness.
  const prof=(L.profile?await dfetch(base,L.profile):null)||{};
  const ns=prof.persona_id?{}:(await fetchNodeStatus(base)||{});
  const pid=prof.persona_id||personaIdFromDid(r.did);
  const ps=prof.persona_id?prof:((ns.personas||[]).find((p)=>p.persona_id===pid||(pid&&(p.persona_id||'').endsWith(pid)))||{});
  const role=ps.role||(ps.membership||{}).role||'—';
  const state=ps.lifecycle_state||'—';
  const rep=ps.reputation_score!=null?Number(ps.reputation_score).toFixed(2):'—';
  let html=kv('Persona id',S0(pid||r.did))
    +kv('Name',S0(ps.name||r.label))
    +kv('Role',`<span class="cap">${esc(role)}</span>`)
    +kv('Lifecycle',state==='ACTIVE'?`<span class="ok">● ACTIVE</span>`:`<span class="dim">${esc(state)}</span>`)
    +kv('Reputation',rep==='—'?'—':`<span class="ok">${esc(rep)}</span> <span class="l2">role-relative [0,1]</span>`)
    +kv('Archetype',S0(ps.archetype))
    +kv('Disposition',S0(ps.primary_disposition))
    +kv('Experience tasks',S0(ps.experience_tasks))
    +kv('Soul version',S0(ps.soul_version))
    +(ps.born_specialist?kv('Origin','<span class="amber">born specialist (genesis)</span>'):'');
  if(ps.description) html+=H('Description')+`<div class="desc2">${esc(String(ps.description).slice(0,400))}</div>`;
  if((ps.advertised_interests||[]).length) html+=H('Interests')+chipsOf(ps.advertised_interests);
  if((ps.domain_curatorships||[]).length) html+=H('Domain curatorships')+chipsOf(ps.domain_curatorships);
  // LIVE per-persona activity — what this persona is doing right now + its
  // evolving internal state, streamed in place on every telemetry tick. Prefers
  // the persona's OWN feed document (links.telemetry → telemetry/personas/<slug>.json).
  S.drawerLiveKind='persona'; S.drawerLiveId=pid||r.did; S.drawerLiveBase=base;
  S.drawerLiveFeed=(L.telemetry&&!String(L.telemetry).includes('live/latest'))?L.telemetry:'';
  html+=H('● Live · inside this persona')+`<div id="livesec" class="livesec">${renderPersonaLive(pid||r.did)}</div>`;
  if(S.drawerLiveFeed) setTimeout(refreshLiveSection,0);
  // 🧠 what it is THINKING: lessons/tactics/frame for the operator; redacted
  // transition timeline for everyone else. Streams on the live cadence.
  S.drawerThinkPid=pid||_shortId(r.did);
  html+=H('🧠 Thinking')+`<div id="thinksec" class="livesec"><div class="l2">resolving cognition…</div></div>`;
  setTimeout(refreshThinking,0);
  html+=trustPanel(r);
  const eid=kernelRec(r._kernel,'env');
  const bid=S.order.find((id)=>{ const x=S.recs.get(id);
    return x&&x._kernel===r._kernel&&x.kind==='artifact'&&x._links&&x._links.bundle; });
  let nav='';
  if(eid) nav+=`<div class="row">${recLink(eid,'Workspace (env) →')}</div>`;
  if(bid) nav+=`<div class="row">${recLink(bid,'Deliverable (bundle) →')}</div>`;
  if(nav) html+=H('Related')+nav;
  if(L.profile) html+=H('Source')+`<div class="row"><a href="${esc(join(base,L.profile))}" target="_blank" rel="noopener">signed persona card →</a></div>`;
  return {title:`<span class="kind k-persona">PERSONA</span> ${esc(ps.name||r.label)}`, html};
}
async function envView(r){ const base=r._base||'',L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v); S.curBase=base;
  // EnvironmentInstance export (05_ENVIRONMENT): bind the SERVED env doc
  // (environments/<id>.json) — env_type, status, members, lineage_digest,
  // rule_count. /status is only a liveness fallback when no export link exists.
  const d=(L.export?await dfetch(base,L.export):null)||{};
  const ns=d.environment_id?{}:(await fetchNodeStatus(base)||{});
  const members=d.members||[];
  const ld=d.lineage_digest||{};
  let html=kv('Environment',S0(d.environment_id||r.did||r.label))
    +kv('Name',S0(d.name||r.label))
    +kv('Type',`<span class="cap">${esc(d.env_type||'—')}</span>`)
    +kv('Status',d.status==='active'?'<span class="ok">● active</span>':`<span class="dim">${esc(d.status||'—')}</span>`)
    +kv('Members',S0(members.length||(ns.personas||[]).length))
    +kv('Env rules',S0(d.rule_count))
    +kv('Lineage events',S0(ld.event_count));
  if(d.description) html+=H('Description')+`<div class="desc2">${esc(String(d.description).slice(0,300))}</div>`;
  // Deliverables produced in THIS environment — every signed bundle and every
  // file, joined to the env by its workspace run id. The whole point of clicking
  // an environment: see ALL its artifacts. Each row opens the verified body.
  const _run=runOf(r);
  const myArts=_run?S.order.map((id)=>S.recs.get(id)).filter((x)=>x&&x.kind==='artifact'&&runOf(x)===_run):[];
  const myBundles=myArts.filter((a)=>a._links&&a._links.bundle);
  const myFiles=myArts.filter((a)=>{ const L=a._links||{}; return L.content||L.content_stub||L.content_hash; });
  if(myArts.length){
    html+=H(`Deliverables — ${myArts.length} artifact${myArts.length>1?'s':''}`
      +(myBundles.length?` · ${myBundles.length} bundle${myBundles.length>1?'s':''}`:'')+' (click to view)');
    for(const bnd of myBundles)
      html+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(bnd._links.bundle)}">▣ ${esc(bnd.label||'deliverable bundle')} →</a></div>`;
    if(myFiles.length)
      html+=`<div class="atree">`+myFiles.map((a)=>
        `<div class="tnode tfile"><a href="#" data-act="rec" data-id="${esc(a.id)}">${esc(a.label||a.record_id||'file')}</a>`
        +`<span class="l2">${esc(a.media_kind||'')}</span></div>`).join('')+`</div>`;
  }
  const roster=members.length?members:( (ns.personas||[]).map((p)=>({persona_id:p.persona_id,role:p.role,active:p.lifecycle_state==='ACTIVE'})) );
  if(roster.length){
    html+=H(`Members (${roster.length})`);
    html+=roster.map((m)=>{
      const rid=findRecByDid(m.persona_id)||findRecByDid('did:personaos:'+m.persona_id);
      const label=rid?recLink(rid,m.role||m.persona_id):esc(m.role||m.persona_id);
      const active=m.active!==false;
      return `<div class="grant">${label}<span class="l2"><span class="${active?'ok':'dim'}">${active?'active':'departed'}</span></span></div>`;
    }).join('');
  }
  if(ld.kind_counts && Object.keys(ld.kind_counts).length){
    html+=H('Lineage digest (event-kind counts; J9 federation shape)');
    html+=Object.entries(ld.kind_counts).slice(0,12).map(([k,v])=>
      `<div class="grant"><span class="l2">${esc(k)}</span><span class="ok">${esc(v)}</span></div>`).join('');
  }
  // LIVE per-env activity — signed lineage events + model activity in this env,
  // streamed in place on every telemetry tick. Prefers the env's OWN feed
  // document (links.telemetry → telemetry/environments/<slug>.json).
  const envId=d.environment_id||r.did;
  S.drawerLiveKind='env'; S.drawerLiveId=envId; S.drawerLiveBase=base;
  S.drawerLiveFeed=(L.telemetry&&!String(L.telemetry).includes('live/latest'))?L.telemetry:'';
  html+=H('● Live · inside this environment')+`<div id="livesec" class="livesec">${renderEnvLive(envId)}</div>`;
  if(S.drawerLiveFeed) setTimeout(refreshLiveSection,0);
  html+=trustPanel(r);
  const did=kernelRec(r._kernel,'domain'), pid=kernelRec(r._kernel,'project'); let nav='';
  if(did) nav+=`<div class="row">${recLink(did,'Domain →')}</div>`;
  if(pid) nav+=`<div class="row">${recLink(pid,'Project →')}</div>`;
  if(L.bundle && !myBundles.length) nav+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(L.bundle)}">Deliverable bundle →</a></div>`;
  if(nav) html+=H('Related')+nav;
  return {title:`<span class="kind k-env">ENV</span> ${esc(d.name||r.label)}`, html};
}
// ---------- deliverable-bundle artifact TREE ----------
// Bundle-export artifacts carry their package-relative path in `title` (e.g. cad/board.step,
// docs/assembly.md) — '/' separators are preserved. The on-disk body lives at
// artifacts/package/<title>; gating is keyed on body_published (origin_gated stub when false).
// Group entries by path segments into a nested dir/file tree; flat packages (no '/') collapse
// to a single-level tree with all files at the root.
function buildArtifactTree(arts){
  const root={dirs:new Map(), files:[]};
  for(const a of (arts||[])){
    const path=String(a.title||a.artifact_id||''); const parts=path.split('/').filter(Boolean);
    let node=root;
    for(let i=0;i<parts.length-1;i++){ const seg=parts[i];
      if(!node.dirs.has(seg)) node.dirs.set(seg,{dirs:new Map(), files:[]});
      node=node.dirs.get(seg); }
    node.files.push({art:a, name:parts.length?parts[parts.length-1]:path, path}); }
  return root;
}
// collapsed dir paths remembered in-page (default expanded for depth ≤ 2)
function dirCollapsed(key,depth){ if(S.bundleDirs.has(key)) return true; if(S.bundleDirsOpen.has(key)) return false; return depth>=2; }
function renderArtifactNode(node,prefix,depth){
  let h='';
  for(const [seg,child] of [...node.dirs.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
    const key=prefix?prefix+'/'+seg:seg; const collapsed=dirCollapsed(key,depth);
    const n=(child.files.length)+child.dirs.size;
    h+=`<div class="tnode tdir" style="padding-left:${depth*14}px"><a href="#" data-act="tdir" data-key="${esc(key)}" data-collapsed="${collapsed?1:0}">`
      +`<span class="ttog">${collapsed?'▸':'▾'}</span> ${esc(seg)}/</a><span class="l2">${n}</span></div>`;
    if(!collapsed) h+=`<div class="tkids">${renderArtifactNode(child,key,depth+1)}</div>`; }
  for(const f of node.files.sort((a,b)=>a.name.localeCompare(b.name))){
    const a=f.art, published=a.body_published!==false;
    const body=published
      ? `<a href="#" data-act="file" data-path="${esc('artifacts/package/'+f.path)}" data-title="${esc(f.path)}" data-kind="${esc(a.media_kind)}" data-hash="${esc(a.content_hash||'')}" data-size="${esc(a.size??a.bytes??'')}">${esc(f.name)}</a>`
      : `<span class="tgated">${esc(f.name)} <span class="no">· origin_gated</span></span>`;
    h+=`<div class="tnode tfile" style="padding-left:${depth*14}px">${body}<span class="l2">${esc(a.media_kind||'—')}</span></div>`; }
  return h;
}
function renderArtifactTree(arts){
  if(!S.bundleDirs) S.bundleDirs=new Set(); if(!S.bundleDirsOpen) S.bundleDirsOpen=new Set();
  if(!(arts||[]).length) return '<div class="l2">— no artifacts —</div>';
  return `<div class="atree">${renderArtifactNode(buildArtifactTree(arts),'',0)}</div>`;
}
async function bundleView(base,url,L){ S.curBase=base; const d=await dfetch(base,url);
  if(!d){
    // An anonymous viewer holds only 'discover': the node publishes that the deliverable
    // EXISTS (files, hashes, metadata) but gates the BYTES to read+ tier (07_ARTIFACTS §10a).
    // Render the PUBLIC manifest from the discovered file-card records + how to read the bytes.
    const run=(String(url||'').match(/k\/(run-[0-9A-Za-z]+)/)||[])[1]||'';
    const files=(S.order||[]).map((id)=>S.recs.get(id)).filter((r)=>r&&r.kind==='artifact'
        && !((r._links||{}).bundle) && runOf(r)===run);
    let mh='<div class="empty-card"><h3>Deliverable — content is read-gated</h3>'
      +'<p class="desc2">This node publishes that the deliverable <b>exists</b> (file list, hashes, metadata) '
      +'to anonymous viewers, but serves the actual <b>bytes</b> only at <b>read+</b> tier '
      +'(07_ARTIFACTS §10a). To open the files: click <b>🔑&nbsp;OPERATOR</b> and paste this node\'s '
      +'bearer token, or open the page on the node\'s own machine (localhost = operator).</p></div>';
    if(files.length){
      mh+=H(`Files (${files.length}) — published manifest`)+files.slice(0,80).map((r)=>{
        const L2=r._links||{}; const h=String(L2.content_hash||'').replace('sha256:','').slice(0,10);
        return `<div class="grant"><span class="l2">${esc(r.label||'file')}</span>`
          +`<span class="tier">${esc(L2.media_kind||'')}${h?` · ${h}…`:''}</span></div>`;
      }).join('');
    }
    return {title:'deliverable (manifest)', html:mh};
  }
  // personaos-bundle-export/2 is a DIRECT document (07_ARTIFACTS §7): bundle_id,
  // bundle_kind, state, contributors, verifier_evidence[], co_signatures{},
  // accepted_at/shipped_at, artifacts[] with role_in_bundle. Verifier evidence
  // is MANDATORY for verified/accepted — surface it as the proof, not a one-liner.
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  const arts=d.artifacts||[], ev=d.verifier_evidence||[], rv=d.review_verdicts||[];
  const cosigners=Object.keys(d.co_signatures||{});
  const st=String(d.state||'—');
  const stClass=(st==='shipped'||st==='accepted')?'ok':(st==='rejected'?'no':'amber');
  let html=kv('Bundle',`<code>${esc(d.bundle_id||'')}</code>`)
    +kv('Kind',`<span class="cap">${esc(d.bundle_kind||'task_deliverable')}</span>`)
    +kv('State',`<span class="${stClass}">● ${esc(st)}</span>`)+kv('Version',S0(d.version))
    +kv('Outward tier',`<span class="tier-pill t-${esc(d.outward_artifact_tier||d.visibility_tier||'federation')}">${esc(d.outward_artifact_tier||d.visibility_tier||'federation')}</span>`)
    +(d.accepted_at?kv('Accepted at',S0(d.accepted_at)):'')
    +(d.shipped_at?kv('Shipped at',S0(d.shipped_at)):'')
    +kv('Contributors',S0((d.contributors||[]).join(', ')))
    +kv('Co-signatures',cosigners.length?`<span class="ok">${esc(cosigners.length)} signer(s)</span>`:'<span class="no">none</span>');
  // Verifier evidence — the hash-bound, signed proof each artifact check ran.
  if(ev.length){
    html+=H(`Verifier evidence (${ev.length}) — executed checks, hash-bound`);
    html+=ev.slice(0,12).map((e)=>{
      const ok=(e.exit_status_kind==='success')||(e.parsed_verdict==='pass');
      const nr=e.parsed_verdict==='not_run';
      const cls=nr?'amber':(ok?'ok':'no');
      const mark=nr?'∅ not_run':(ok?'✓ pass':'✗ fail');
      return `<div class="grant"><span class="l2">${esc(e.command_or_api_fingerprint||e.stage_id||'check')}</span>`
        +`<span class="${cls}">${mark}</span></div>`;
    }).join('');
  } else {
    html+=H('Verifier evidence')+`<div class="l2">— none recorded (below verified) —</div>`;
  }
  if(rv.length){
    html+=H(`Review verdicts (${rv.length})`);
    html+=rv.slice(0,8).map((v)=>`<div class="grant"><span class="l2">${esc(v.reviewer_persona_id||v.reviewer||'reviewer')}</span>`
      +`<span class="${String(v.verdict||'').includes('accept')?'ok':'no'}">${esc(v.verdict||'—')}</span></div>`
      +(v.rationale?`<div class="desc2">${esc(String(v.rationale).slice(0,240))}</div>`:'')).join('');
  }
  html+=H(`Artifacts (${arts.length}) — click to view`)+renderArtifactTree(arts);
  if(L && L.run){ html+=H('Provenance')
    +`<div class="row"><a href="#" data-act="body" data-url="${esc(L.run)}">Body · model cascade →</a></div>`
    +`<div class="row"><a href="#" data-act="verify" data-url="${esc(L.run)}">Verification · cascade + safety floor →</a></div>`
    +`<div class="row"><a href="#" data-act="physical" data-url="${esc(L.run)}">Physical asset →</a></div>`;
    if(L.oci) html+=`<div class="row"><a href="#" data-act="dist" data-oci="${esc(L.oci)}" data-dag="${esc(L.dag||'')}" data-reg="${esc(L.registry||'')}">Distribution · OCI + IPLD →</a></div>`; }
  return {title:`<span class="kind k-artifact">BUNDLE</span> ${esc(d.bundle_id||'')}`, html};
}
/* ====================================================================
   MEDIA-AWARE ARTIFACT RENDERING
   --------------------------------------------------------------------
   Renderer is selected by file EXTENSION (primary) then media_kind
   (fallback). Each heavy library is LAZY-LOADED via dynamic import()
   from a pinned CDN, ONLY the first time a file of that kind is opened,
   behind a cached module promise. Every import is wrapped so a CDN
   failure (offline / intranet node-served page) degrades to the plain
   <pre> renderer — never a broken pane.
   SECURITY: artifact bodies are REMOTE PEER content. Markdown is
   sanitised with DOMPurify; tables / code / descriptors are built with
   createElement + textContent (never innerHTML of raw content); SVG and
   images are rendered as blob: <img> (never inline innerHTML). No eval.
   ==================================================================== */

// Pinned CDN modules. esm.sh / jsdelivr +esm both serve ES modules with
// their own deps bundled. Each entry lists fallbacks tried in order.
const CDN={
  marked:   ['https://esm.sh/marked@12.0.2','https://cdn.jsdelivr.net/npm/marked@12.0.2/+esm'],
  dompurify:['https://esm.sh/dompurify@3.1.6','https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm'],
  papaparse:['https://esm.sh/papaparse@5.4.1','https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm'],
  hljs:     ['https://esm.sh/highlight.js@11.10.0/lib/core','https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/lib/core/+esm'],
  three:    ['https://esm.sh/three@0.160.0','https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'],
  orbit:    ['https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js','https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm'],
  stl:      ['https://esm.sh/three@0.160.0/examples/jsm/loaders/STLLoader.js','https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/STLLoader.js/+esm'],
  obj:      ['https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js','https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js/+esm'],
  gltf:     ['https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js','https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm'],
};
// Per-key cached module promise. lazyLib(key) resolves the module once;
// on every listed URL failing it REJECTS so the caller falls back to <pre>.
const LIBS=new Map();
function lazyLib(key){
  if(LIBS.has(key)) return LIBS.get(key);
  const urls=(CDN[key]||[]).slice();
  const p=(async()=>{ let lastErr;
    for(const u of urls){ try{ return await import(/* @vite-ignore */ u); }catch(e){ lastErr=e; } }
    throw lastErr||new Error('no CDN url for '+key); })();
  p.catch(()=>LIBS.delete(key));   // allow a later retry if the first attempt failed
  LIBS.set(key,p); return p;
}

// Highlight.js language packs are lazy too (one import per language, cached).
const HLJS_LANGS={ python:'python', py:'python', js:'javascript', javascript:'javascript',
  ts:'typescript', typescript:'typescript', sh:'bash', bash:'bash', json:'json',
  yaml:'yaml', yml:'yaml', toml:'ini', ini:'ini', spice:'plaintext', cir:'plaintext',
  net:'plaintext', xml:'xml', html:'xml', css:'css' };
async function loadHljs(lang){
  const core=(await lazyLib('hljs')).default;
  const name=HLJS_LANGS[lang]||'plaintext';
  if(name!=='plaintext' && !core.getLanguage(name)){
    const urls=[`https://esm.sh/highlight.js@11.10.0/lib/languages/${name}`,
                `https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/lib/languages/${name}/+esm`];
    for(const u of urls){ try{ const m=await import(/* @vite-ignore */ u); core.registerLanguage(name,m.default); break; }catch(e){} }
  }
  return {core,name};
}

// EXTENSION → renderer id. Drives both binary-detection and dispatch.
const EXT_RENDERER={
  md:'markdown', markdown:'markdown',
  csv:'csv',
  png:'image', jpg:'image', jpeg:'image', gif:'image', webp:'image', svg:'image',
  py:'code', js:'code', ts:'code', sh:'code', json:'code', yaml:'code', yml:'code',
  toml:'code', spice:'code', cir:'code', net:'code', ini:'code', xml:'code', cfg:'code',
  stl:'model3d', '3mf':'model3d', obj:'model3d', gltf:'model3d', glb:'model3d',
  step:'descriptor', stp:'descriptor', kicad_pcb:'descriptor', kicad_sch:'descriptor',
  pdf:'pdf',
};
// media_kind → renderer id (fallback when extension is unknown/absent).
const KIND_RENDERER={ md:'markdown', markdown:'markdown', csv:'csv', image:'image',
  png:'image', svg:'image', json:'code', code:'code', source:'code', yaml:'code',
  model:'model3d', cad:'model3d', mesh:'model3d', step:'descriptor', pdf:'pdf' };
// Renderers that consume binary bytes (blob), not text. Text fetch is skipped.
const BINARY_RENDERERS=new Set(['image','model3d','pdf']);
const IMG_EXT=new Set(['png','jpg','jpeg','gif','webp','svg']);
const TEXTY_DESCRIPTOR_EXT=new Set(['step','stp','kicad_pcb','kicad_sch']);

function pickRenderer(title,kind){
  const ext=extOf(title);
  if(ext && EXT_RENDERER[ext]) return {id:EXT_RENDERER[ext],ext};
  const k=String(kind||'').toLowerCase();
  if(KIND_RENDERER[k]) return {id:KIND_RENDERER[k],ext};
  return {id:'plain',ext};
}

// Track blob: URLs allocated for the current view so they're revoked on change.
function mkBlobURL(blob){ const u=URL.createObjectURL(blob);
  onViewCleanup(()=>URL.revokeObjectURL(u)); return u; }

// Small helper: build an element with optional class/text (textContent — safe).
function el(tag,cls,text){ const e=document.createElement(tag);
  if(cls) e.className=cls; if(text!=null) e.textContent=String(text); return e; }
function loadingNode(label){ const d=el('div','fv-loading'); d.textContent=label||'loading renderer…'; return d; }
function plainPre(text,note){ const wrap=document.createElement('div');
  if(note) wrap.appendChild(el('div','fv-note',note));
  const pre=el('pre','filview'); pre.textContent=String(text??''); wrap.appendChild(pre); return wrap; }

/* ---------- individual renderers (each fills `host`, may throw → fallback) ---------- */
async function renderMarkdown(host,ctx){
  host.appendChild(loadingNode('loading markdown renderer…'));
  const [markedMod,puriMod]=await Promise.all([lazyLib('marked'),lazyLib('dompurify')]);
  const marked=markedMod.marked||markedMod.default||markedMod;
  const DOMPurify=puriMod.default||puriMod;
  const raw=typeof marked.parse==='function'?marked.parse(ctx.text||'',{breaks:true}):marked(ctx.text||'');
  // sanitise EVERY rendered byte; forbid script/style and event handlers.
  const clean=DOMPurify.sanitize(raw,{FORBID_TAGS:['style','script','iframe','form','object','embed'],
    FORBID_ATTR:['style','onerror','onload','onclick'],ADD_ATTR:['target','rel']});
  host.innerHTML='';
  const md=el('div','fv-md'); md.innerHTML=clean;   // clean is DOMPurify output
  md.querySelectorAll('a[href]').forEach((a)=>{ a.target='_blank'; a.rel='noopener noreferrer'; });
  host.appendChild(md);
}
async function renderCsv(host,ctx){
  host.appendChild(loadingNode('loading CSV parser…'));
  const Papa=(await lazyLib('papaparse')).default;
  const out=Papa.parse((ctx.text||'').trim(),{skipEmptyLines:true});
  const rows=out.data||[]; const N=500; const shown=rows.slice(0,N);
  host.innerHTML='';
  if(rows.length>N) host.appendChild(el('div','fv-note',`showing ${N} of ${rows.length} rows`));
  const tbl=el('table','fv-table'); const head=shown[0]||[];
  const thead=el('thead'); const htr=el('tr');
  head.forEach((c)=>htr.appendChild(el('th',null,c)));   // textContent — safe
  thead.appendChild(htr); tbl.appendChild(thead);
  const tb=el('tbody');
  for(let i=1;i<shown.length;i++){ const tr=el('tr');
    (shown[i]||[]).forEach((c)=>tr.appendChild(el('td',null,c))); tb.appendChild(tr); }
  tbl.appendChild(tb);
  const scroll=el('div','fv-tablewrap'); scroll.appendChild(tbl); host.appendChild(scroll);
}
async function renderImage(host,ctx){
  const fb=await fetchBlob(ctx.url);
  if(!fb) throw new Error('image fetch failed');
  ctx.realSize=fb.size;
  const url=mkBlobURL(fb.blob);
  host.innerHTML='';
  const img=document.createElement('img'); img.className='fv-img'; img.alt=ctx.title;
  img.src=url;   // blob: URL — SVG too (NOT inline innerHTML)
  host.appendChild(img);
}
async function renderCode(host,ctx){
  let body=ctx.text||'';
  const isJson=ctx.ext==='json'||String(ctx.kind||'').toLowerCase()==='json';
  if(isJson){
    if((ctx.realSize??body.length)>200*1024){ host.appendChild(plainPre(body,'json > 200 KB — plain text (perf)')); return; }
    try{ body=JSON.stringify(JSON.parse(body),null,2); }catch(e){}
  }
  host.appendChild(loadingNode('loading syntax highlighter…'));
  const {core,name}=await loadHljs(isJson?'json':ctx.ext);
  let out; try{ out=core.highlight(body,{language:name,ignoreIllegals:true}); }
  catch(e){ out=null; }
  host.innerHTML='';
  const pre=el('pre','filview fv-code'); const code=document.createElement('code');
  if(out && out.value){ code.innerHTML=out.value; }   // hljs output is HTML-escaped tokens
  else { code.textContent=body; }                     // fallback: textContent (safe)
  pre.appendChild(code); host.appendChild(pre);
}
async function renderModel3d(host,ctx){
  host.appendChild(loadingNode('loading 3D viewer…'));
  const fb=await fetchBlob(ctx.url); if(!fb) throw new Error('mesh fetch failed');
  ctx.realSize=fb.size;
  const ext=ctx.ext;
  const THREE=(await lazyLib('three'));
  const {OrbitControls}=await lazyLib('orbit');
  host.innerHTML='';
  const canvasWrap=el('div','fv-3d');
  host.appendChild(canvasWrap);
  const w=canvasWrap.clientWidth||380, h=260;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  canvasWrap.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(45,w/h,0.01,5000);
  scene.add(new THREE.AmbientLight(0xffffff,0.7));
  const dir=new THREE.DirectionalLight(0xffffff,0.8); dir.position.set(1,1,1); scene.add(dir);
  const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true;
  const mat=new THREE.MeshStandardMaterial({color:0x9fb4c8,metalness:0.1,roughness:0.8});
  const buf=await fb.blob.arrayBuffer();
  let object;
  if(ext==='stl'){ const {STLLoader}=await lazyLib('stl');
    const geo=new STLLoader().parse(buf); geo.computeVertexNormals(); object=new THREE.Mesh(geo,mat); }
  else if(ext==='obj'){ const {OBJLoader}=await lazyLib('obj');
    object=new OBJLoader().parse(new TextDecoder().decode(buf)); }
  else if(ext==='gltf'||ext==='glb'){ const {GLTFLoader}=await lazyLib('gltf');
    const g=await new Promise((res,rej)=>new GLTFLoader().parse(buf,'',res,rej)); object=g.scene; }
  else { throw new Error('no in-browser loader for .'+ext); }  // .3mf → fallback descriptor
  scene.add(object);
  // auto-fit camera to the object's bounding sphere
  const box=new THREE.Box3().setFromObject(object); const sph=box.getBoundingSphere(new THREE.Sphere());
  const c=sph.center, rad=sph.radius||1; object.position.sub(c);
  camera.position.set(0,0,rad*2.6); camera.near=rad/100; camera.far=rad*100; camera.updateProjectionMatrix();
  controls.target.set(0,0,0); controls.update();
  let alive=true;
  (function loop(){ if(!alive)return; controls.update(); renderer.render(scene,camera); requestAnimationFrame(loop); })();
  // dispose ALL GPU resources on view change
  onViewCleanup(()=>{ alive=false; controls.dispose();
    scene.traverse((o)=>{ if(o.geometry)o.geometry.dispose(); if(o.material){ const ms=Array.isArray(o.material)?o.material:[o.material]; ms.forEach((m)=>m.dispose()); } });
    renderer.dispose(); if(renderer.forceContextLoss)renderer.forceContextLoss(); });
}
async function renderDescriptor(host,ctx){
  // .step / .kicad_* etc: no in-browser renderer → honest descriptor card,
  // download link, + a plain-text head preview if the body is texty.
  host.innerHTML='';
  const card=el('div','fv-card');
  card.appendChild(el('div','fv-cardhd',`No in-browser viewer for .${ctx.ext||ctx.kind||'?'} — descriptor only`));
  const add=(l,v)=>{ const r=el('div','row'); r.appendChild(el('span','l2',l));
    r.appendChild(el('span','v2',v)); card.appendChild(r); };
  add('Kind',ctx.kind||ctx.ext||'—');
  add('Size',fmtBytes(ctx.realSize!=null?ctx.realSize:ctx.size));
  add('Content hash',ctx.contentHash||'—');
  host.appendChild(card);
  const dl=el('div','row'); const a=document.createElement('a');
  a.href=ctx.url; a.target='_blank'; a.rel='noopener'; a.setAttribute('download',''); a.textContent='download →';
  dl.appendChild(a); host.appendChild(dl);
  if(TEXTY_DESCRIPTOR_EXT.has(ctx.ext)){
    const txt=await fetchText(ctx.url);
    if(txt && /[\x09\x0a\x0d\x20-\x7e]/.test(txt.slice(0,200))){
      host.appendChild(el('div','fv-note','head preview (first 4 KB)'));
      const pre=el('pre','filview'); pre.textContent=txt.slice(0,4096); host.appendChild(pre);
    }
  }
}
async function renderPdf(host,ctx){
  const fb=await fetchBlob(ctx.url); if(!fb) throw new Error('pdf fetch failed');
  ctx.realSize=fb.size; const url=mkBlobURL(fb.blob);
  host.innerHTML='';
  const obj=document.createElement('iframe'); obj.className='fv-pdf'; obj.src=url; obj.title=ctx.title;
  host.appendChild(obj);
}
async function renderPlain(host,ctx){
  let body=ctx.text;
  if(body==null){ // forced-plain view of a binary kind → best-effort text decode
    host.appendChild(loadingNode('loading…')); body=await fetchText(ctx.url); host.innerHTML='';
    if(body==null){ host.appendChild(el('div','l2','binary body — use the download link above.')); return; } }
  if(ctx.ext==='json'){ try{ body=JSON.stringify(JSON.parse(body),null,2); }catch(e){} }
  const trunc=body.length>20000;
  host.appendChild(plainPre(body.slice(0,20000),trunc?'first 20 KB':''));
}
const RENDERERS={ markdown:renderMarkdown, csv:renderCsv, image:renderImage, code:renderCode,
  model3d:renderModel3d, descriptor:renderDescriptor, pdf:renderPdf, plain:renderPlain };

// fileView builds the header synchronously, then mounts the chosen renderer
// asynchronously into #fv-body, with a graceful <pre> fallback on any failure.
async function fileView(base,path,title,kind,opts){ S.curBase=base; opts=opts||{};
  const pick=pickRenderer(title,kind);
  const url=join(base,path);
  const isBinary=BINARY_RENDERERS.has(pick.id);
  const forcedPlain=opts.raw===true;
  const rendId=forcedPlain?'plain':pick.id;
  // text bodies fetched here; binaries deferred to their renderer (blob).
  let text=null, realSize=null;
  if(!isBinary || forcedPlain){
    // a forced-plain view of a binary would show garbage, so only fetch text for texty kinds
    if(!isBinary){ text=await fetchText(url); realSize=text?text.length:null; }
  }
  const ctx={ base, path, url, title, kind, ext:pick.ext, text, realSize, size:opts.size,
    contentHash:opts.contentHash||null };
  const sizeLabel=realSize!=null?fmtBytes(realSize):(opts.size!=null?fmtBytes(opts.size):'—');
  const rawTog=forcedPlain
    ? `<a href="#" data-act="fv-rich" data-path="${esc(path)}" data-title="${esc(title)}" data-kind="${esc(kind||'')}">rich view ←</a>`
    : (rendId!=='plain'
        ? `<a href="#" data-act="fv-raw" data-path="${esc(path)}" data-title="${esc(title)}" data-kind="${esc(kind||'')}">raw text</a>`
        : '<span class="l2">raw</span>');
  let html=kv('File',esc(title))
    +kv('Media kind',`${esc(kind||pick.ext||'—')} <span class="fv-rid">· ${esc(rendId)}</span>`)
    +`<div class="row"><span class="l2">Size</span><span class="v2 fv-size">${esc(sizeLabel)}</span></div>`
    +`<div class="row"><span class="l2">view</span><span class="v2">${rawTog} · `
    +`<a href="${esc(url)}" target="_blank" rel="noopener" download>download / open raw →</a></span></div>`
    +`<div id="fv-body" class="fv-body"></div>`;
  const mount=async(root)=>{
    const host=root.querySelector('#fv-body'); if(!host) return;
    const r=RENDERERS[rendId]||renderPlain;
    try{ await r(host,ctx);
      // size discovered during a binary fetch → reflect it in the header
      if(ctx.realSize!=null){ const sz=root.querySelector('.fv-size'); if(sz) sz.textContent=fmtBytes(ctx.realSize); }
    }catch(e){
      // GRACEFUL FALLBACK: CDN import failed / parse error → plain <pre>, never broken.
      host.innerHTML='';
      host.appendChild(el('div','fv-note','renderer unavailable ('+esc(e&&e.message||'error')+') — plain text'));
      let body=ctx.text;
      if(body==null){ body=isBinary?null:await fetchText(url); }
      if(body==null && isBinary){ host.appendChild(el('div','l2','binary body — use the download link above.')); return; }
      host.appendChild(plainPre(String(body??'').slice(0,20000)));
    }
  };
  return {title:`<span class="kind k-artifact">FILE</span> ${esc(title)}`, html, mount};
}
async function telemetryView(r){ const base=r._base||'',L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v); S.curBase=base;
  // 01_KERNEL §8/§11: live telemetry nests OTel/lineage under `kernel`
  // (model_events, spans, summary, lineage_durable) and persona evolution
  // summaries under `personas`. Bind those — NOT the old tel.events/tel.ring.
  const tel=await fetchJson(join(base,L.snapshot||'telemetry/live/latest.json'))||{};
  // Per-ENTITY feed record (telemetry:<persona>/<env> → its own redacted-tier
  // document): render the entity's live "inside" view and stream it in place.
  if(tel.schema==='personaos-persona-telemetry/1'||tel.schema==='personaos-env-telemetry/1'){
    const isP=tel.schema==='personaos-persona-telemetry/1';
    S.drawerLiveKind=isP?'persona':'env';
    S.drawerLiveId=isP?tel.persona_id:tel.environment_id;
    S.drawerLiveBase=base; S.drawerLiveFeed=L.snapshot||'';
    let html=kv('Feed',S0(r.label))
      +kv('Subject',`<span class="cap">${esc(isP?'persona':'environment')}</span> <code>${esc(S.drawerLiveId)}</code>`)
      +kv('Tier','redacted — span kinds / status / durations / transitions only (A-TF2)')
      +kv('Generated',S0(tel.generated_at))
      +kv('Access','consent-gated · content tier needs a read+ grant AND a consent pin (A-TF3)');
    html+=H(isP?'● Live · inside this persona':'● Live · inside this environment')
      +`<div id="livesec" class="livesec">${isP?renderPersonaFeedDoc(tel):renderEnvFeedDoc(tel)}</div>`;
    html+=trustPanel(r);
    return {title:`<span class="kind k-telemetry">TELEMETRY</span> ${esc(r.label)}`, html};
  }
  const k=tel.kernel||{}, personas=tel.personas||[], modelEvents=k.model_events||[];
  const selected=modelEvents.filter((e)=>e.kind==='MODEL_SELECTED');
  const byPurpose={};
  for(const e of selected){ const pp=e.requested_purpose||e.role||'other'; byPurpose[pp]=(byPurpose[pp]||0)+1; }
  let html=kv('Feed',S0(r.label))
    +kv('Reason',S0(tel.reason))
    +kv('Lineage durable',k.lineage_durable?'<span class="ok">✓ durable</span>':'<span class="no">in-memory only</span>')
    +kv('Signed spans',S0((k.spans||[]).length))
    +kv('Model-selection events',S0(selected.length))
    +kv('Access','consent-gated · read+ (operator) or public-telemetry opt-in');
  if(Object.keys(byPurpose).length){
    html+=H('Model selection by purpose');
    html+=Object.entries(byPurpose).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([kk,v])=>
      `<div class="grant"><span class="l2">${esc(kk)}</span><span class="ok">${esc(v)}</span></div>`).join('');
  }
  const recent=selected.slice(-8).reverse();
  if(recent.length){
    html+=H('Recent model selections');
    html+=recent.map((e)=>`<div class="grant"><span class="l2">${esc(e.requested_purpose||e.role||'')}</span>`
      +`<span>${esc(e.model_id||'—')}</span></div>`).join('');
  }
  // operator-tier evolution internals (tactics/lessons counts) — token only (PER-04 / §4.1)
  if(personas.length && Object.keys((typeof opTokens==='function'?opTokens():{})).length>0){
    html+=H(`Persona evolution (${personas.length}) · operator`);
    html+=personas.slice(0,8).map((p)=>`<div class="grant"><span class="l2">${esc(p.role||p.persona_id||'')}</span>`
      +`<span class="l2">tasks ${esc(p.experience_tasks??0)} · tactics ${esc(p.cohort_visible_tactic_count??p.generic_tactic_count??0)} · lessons ${esc(p.lesson_count??0)}</span></div>`).join('');
  }
  return {title:`<span class="kind k-telemetry">TELEMETRY</span> ${esc(r.label)}`, html};
}
async function genericView(r){ const a=r._access||{}, grants=a.access_grants||[]; S.curBase=r._base||'';
  const anchor=r.content_hash?('sha256 '+r.content_hash.replace('sha256:','').slice(0,18)+'…'):'— (metadata only)';
  let html=kv('Kind',esc(r.kind))+kv('Visibility',esc(r.visibility_tier))+kv('DID',esc(r.did))
    +kv('Kernel',esc(r._kernel||'—'))+kv('Signature','<span class="ok">✓ Ed25519 verified</span>')+kv('Body anchor',esc(anchor))
    +kv('Events (this run)',esc(r.events));
  const gh=grants.length?grants.map((g)=>`<div class="grant"><span>${esc(g.grantee_kind)}:${esc((g.grantee_id||'').slice(0,18))||'*'}</span><span class="ok">${esc(g.access_level)}</span></div>`).join(''):'<div class="grant"><span>owner only</span><span></span></div>';
  html+=H('Capabilities')+chipsOf(r.capability_summary)+H(`Access · outward ${esc(a.outward_tier||r.visibility_tier)}`)+gh
    +H('Source')+`<div class="row"><a href="${esc(r._url)}" target="_blank" rel="noopener">signed record JSON →</a></div>`;
  return {title:`<span class="kind k-${esc(r.kind)}">${esc(KIND_LABEL[r.kind]||r.kind)}</span> ${esc(r.label)}`, html};
}
const kernelRec=(kid,kind)=>S.order.find((id)=>{ const r=S.recs.get(id); return r._kernel===kid && r.kind===kind; });
async function domainView(r){ const base=r._base||'',L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v); S.curBase=base;
  // DomainContext export (06_DOMAIN): the served domain doc is a DIRECT document
  // (domains/<id>.json: domain_id, name, stage, safety_critical, physical_harm_class).
  const d=(L.export?await dfetch(base,L.export):null)||{};
  let html=kv('Domain',S0(d.domain_id||r.did))
    +kv('Name',S0(d.name||r.label))
    +kv('Stage',`<span class="cap">${esc(d.stage||'emergent')}</span>`)
    +kv('Safety critical',d.safety_critical?'<span class="no">● yes</span>':'<span class="dim">no</span>')
    +kv('Physical harm class',d.physical_harm_class?`<span class="no">${esc(d.physical_harm_class)}</span>`:'—')
    +(d.information_hazard_class?kv('Info hazard',esc(d.information_hazard_class)):'')
    +(d.trust_score!=null?kv('Trust score',esc(d.trust_score)):'');
  html+=trustPanel(r);
  const eid=kernelRec(r._kernel,'env'); if(eid) html+=H('Used by')+`<div class="row">${recLink(eid,'Environment →')}</div>`;
  return {title:`<span class="kind k-domain">DOMAIN</span> ${esc(d.name||r.label)}`, html};
}
async function projectView(r){ const base=r._base||'',L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v); S.curBase=base;
  // Project export (04_PROJECT): direct document (projects/<id>.json: project_id,
  // name, environment_id, members, domain_context_ref, bundle_id).
  const d=(L.export?await dfetch(base,L.export):null)||{};
  const members=d.members||[];
  let html=kv('Project',S0(d.project_id||r.did))+kv('Name',S0(d.name||r.label))
    +kv('Workspace env',S0(d.environment_id))+kv('Members',S0(members.length||'—'))
    +(d.bundle_id?kv('Deliverable bundle',`<code>${esc(d.bundle_id)}</code>`):'');
  if(members.length) html+=H(`Members (${members.length})`)+members.slice(0,10).map((m)=>{
    const rid=findRecByDid(m.persona_id)||findRecByDid('did:personaos:'+m.persona_id);
    return `<div class="grant">${rid?recLink(rid,m.role||m.persona_id):esc(m.role||m.persona_id)}<span class="l2">${esc(m.role||'')}</span></div>`;
  }).join('');
  html+=trustPanel(r);
  let nav=''; const eid=kernelRec(r._kernel,'env'), did=kernelRec(r._kernel,'domain');
  if(eid) nav+=`<div class="row">${recLink(eid,'Environment →')}</div>`;
  if(did) nav+=`<div class="row">${recLink(did,'Domain →')}</div>`;
  if(L.bundle) nav+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(L.bundle)}">Deliverable bundle →</a></div>`;
  if(nav) html+=H('Related')+nav;
  return {title:`<span class="kind k-project">PROJECT</span> ${esc(d.name||r.label)}`, html};
}
async function bodyView(base,runUrl){ S.curBase=base; const rj=await dfetch(base,runUrl)||{}; const b=rj.body||{}, ex=rj.real_execution||{};
  let html=kv('Task class',esc(b.task_class||'—'))+kv('Pathway',esc(b.pathway||'—'))
    +kv('Accepted',b.accepted?'<span class="ok">✓ verified</span>':'<span class="no">✗</span>')
    +kv('Verified by model',`<span class="ok">${esc(b.verified_by_model||'—')}</span>`)+kv('Program',esc((b.program_chars||0)+' chars'));
  const at=b.attempts||[]; if(at.length) html+=H('Codex model cascade')+at.map((a)=>`<div class="grant"><span>${a.accepted?'✓':'✗'} ${esc(a.model_id)}</span><span class="l2">${esc(a.status)} · ${esc(a.program_chars)} ch</span></div>`).join('');
  html+=H('Real sandbox execution')+kv('Result',ex.ok?'<span class="ok">ok</span>':'<span class="no">failed</span>')+kv('Return code',esc(ex.returncode))+kv('stdout',`<code>${esc(ex.stdout||'')}</code>`);
  html+=H(`Safety floor sources (${(b.safety_sources||[]).length} of 8)`)+chipsOf(b.safety_sources);
  return {title:`<span class="kind k-persona">BODY · J7</span> codex run`, html};
}
async function verifyView(base,runUrl){ S.curBase=base; const rj=await dfetch(base,runUrl)||{}; const bv=rj.bundle_verification||{}, rt=rj.ready_to_order||{};
  let html=kv('Bundle verified',bv.passed?'<span class="ok">✓ passed</span>':'<span class="no">✗</span>')
    +kv('Final state',`<span class="ok">${esc(rt.state||'—')}</span>`)+kv('Locked',esc(rt.locked))+kv('Co-signers',esc((rt.co_signers||[]).join(', ')||'—'));
  html+=H('Verifier cascade')+(bv.invocations||[]).map((v)=>`<div class="grant"><span>${esc(v[0])}</span><span class="ok">${v[1]?'✓':'✗'}</span></div>`).join('');
  const ev=rj.environment_rule_evidence||[]; if(ev.length) html+=H(`Env-rule evidence (${ev.length})`)+ev.map((e)=>`<div class="desc2">• ${esc(e.rule_name||e.rule_id||'rule')} — ${e.passed===false?'✗':'✓ signed'}</div>`).join('');
  return {title:`<span class="kind k-env">VERIFICATION</span> cascade + floor`, html};
}
async function distributionView(base,L){ S.curBase=base; const oci=await dfetch(base,L.oci)||{}, dag=await dfetch(base,L.dag)||{}, reg=await dfetch(base,L.registry)||{};
  let html=kv('OCI artifactType',esc(oci.artifactType||'—'))+kv('OCI layers',esc((oci.layers||[]).length))
    +kv('IPLD root CID',esc(((dag.root_cid||'')+'').slice(0,32)||'—'))+kv('Addressing','SHA-256 · CIDv1 · content-addressed');
  const pk=reg.packages||[]; if(pk.length) html+=H(`Registry DIDs (${pk.length})`)+pk.map((p)=>`<div class="grant"><span>${esc(p.kind)}</span><span class="l2">${esc((p.did||'').slice(0,34))}…</span></div>`).join('');
  return {title:`<span class="kind k-artifact">DISTRIBUTION</span> OCI + IPLD`, html};
}
async function physicalView(base,runUrl){ S.curBase=base; const rj=await dfetch(base,runUrl)||{}; const p=rj.physical_board;
  if(!p) return {title:'<span class="kind k-artifact">PHYSICAL</span>', html:'<div class="l2">No physical asset for this task (digital deliverable).</div>'};
  const html=kv('MHBB tier',esc(p.mhbb_tier))+kv('Asset kind',esc(p.asset_kind))+kv('State',`<span class="ok">${esc(p.asset_state)}</span>`)
    +kv('As-built ref',esc(p.as_built_ref))+kv('Fabricator',esc(p.fab))+H('External attestation')+`<div class="desc2">${esc(p.attestation)}</div>`;
  return {title:`<span class="kind k-artifact">PHYSICAL BOARD</span>`, html};
}
// Evidence badge for the honesty surface: every reported objective value travels with
// the strength of the evidence that credited it (attested by an independent model /
// executed in the sandbox / unmeasured = claimed but never evidenced — never scores).
const EV_TIP={executed_attested:'an executable check ran AND an independent model from a different family confirmed the value',
  attested:'an independent model confirmed the value is evidenced by the package',
  executed:'an in-package executable check measured this value in the sandbox',
  executed_unconfirmed:'a check ran but the independent attestor did not confirm the value — does not score',
  declared_only:'the author asserted the value with no evidence — does not score',
  unmeasured:'claimed but never evidenced — does not score, shown honestly'};
function evBadge(ev){ const s=String((ev&&ev.evidence_strength)||'unmeasured');
  const extra=ev&&ev.credited_round!=null?` · credited round ${ev.credited_round}`:'';
  const why=ev&&ev.rationale?` — ${ev.rationale}`:'';
  return `<span class="evb ev-${esc(s)}" title="${esc((EV_TIP[s]||s)+extra+why)}">${esc(s.replace(/_/g,' ').toUpperCase())}</span>`; }
function missionDocHTML(ref){
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  const targets=ref.objective_targets||[]; const traj=ref.trajectory||[]; const tr=ref.tranches||[];
  const fin=ref.final_objective||{}; const evd=ref.objective_evidence||{};
  let html=H('ADR-0071 ContinuousRefinementMission — anytime, budget-scaled, convergence-bounded');
  html+=kv('Task',S0(ref.task))+kv('Backend',S0(ref.backend))
    +kv('State',`<span class="ok">${S0(ref.final_state)}</span>`)
    +kv('Status',`<span class="ok">${S0(ref.final_status)}</span>`)
    +kv('Converged',ref.converged?'<span class="ok">yes — nothing left to improve</span>':'no (auto-reopen-eligible)')
    +kv('Best-so-far',S0(ref.best_so_far_ref)+' · score '+(ref.best_so_far_score!=null?Number(ref.best_so_far_score).toFixed(4):'—'));
  // MissionObjective vector: baseline → current per target, stamped with the EVIDENCE
  // that credited each value (a number with no admissible evidence reads UNMEASURED).
  html+=H('Objectives — every value carries its evidence');
  html+=targets.map((t)=>{ const cur=fin[t.name]; const dir=t.direction==='minimize'?'↓':'↑';
    const ev=evd[t.name];
    return `<div class="grant"><span>${esc(t.name)} ${dir} ${evBadge(ev)}</span>`
      +`<span class="l2">base ${esc(t.baseline)} → <b class="ok">${esc(cur!=null?cur:t.current)}</b> · ideal ${esc(t.ideal)}</span></div>`; }).join('');
  const unmeasured=targets.filter((t)=>String((evd[t.name]||{}).evidence_strength||'unmeasured')==='unmeasured');
  if(unmeasured.length) html+=`<div class="viewerr">⚠ ${unmeasured.length} objective(s) have no admissible evidence — their claimed numbers never scored (fail-closed).</div>`;
  // Budget tranches — "resume with more budget → measurably better best-so-far".
  if(tr.length){ html+=H('Budget tranches — resume with more budget → higher best-so-far');
    html+=tr.map((x)=>`<div class="grant"><span>tranche ${esc(x.tranche)} · budget ${esc(x.budget_candidates)} cand · ${esc(x.rounds_this_tranche)} rounds</span>`
      +`<span class="l2">score <b>${Number(x.score_before).toFixed(3)} → <span class="ok">${Number(x.score_after).toFixed(3)}</span></b> · [${esc(x.status)}]</span></div>`).join(''); }
  // Best-so-far climb (round trajectory) with marginal value + WHY candidates died.
  if(traj.length){ html+=H('Refinement trajectory (best-so-far never regresses)');
    html+='<div class="tape-mini">'+traj.map((r2)=>{ const blk=(r2.blocked_targets||[]).length?` <span class="down">blocked:${esc((r2.blocked_targets||[]).join(','))}</span>`:'';
      const errs=(r2.candidate_errors||[]).length?` <span class="down" title="${esc((r2.candidate_errors||[]).join(' | ').slice(0,600))}">✗${(r2.candidate_errors||[]).length} died</span>`:'';
      return `<div class="row2"><span>r${esc(r2.round)}</span><span>score <b>${Number(r2.best_score).toFixed(4)}</b></span>`
        +`<span class="${r2.marginal_value>=0?'ok':'down'}">Δ${Number(r2.marginal_value).toFixed(4)}</span>`
        +`<span class="l2">${esc(r2.candidates_explored)} cand${blk}${errs}</span></div>`; }).join('')+'</div>'; }
  // Budget→emergence (genesis of specialists / sub-envs under ReplicationBound).
  const em=(ref.emergence||[]).filter((e)=>e.event==='budget_to_emergence_genesis');
  if(em.length){ html+=H('Budget → emergence (16_POP §4A factor 7)');
    html+=em.map((e)=>{ const g=e.genesis||{};
      return `<div class="grant"><span>genesis: <b class="ok">${esc(g.niche)}</b> · sub-env ${esc((e.sub_env||{}).kind)}</span>`
        +`<span class="l2">pressure ${esc(e.pressure_score)} (admissible ${e.pressure_admissible?'✓':'✗'}) · ReplicationBound ceiling ${esc(g.replication_bound_population_ceiling)}</span></div>`; }).join(''); }
  const ceiling=ref.physical_realization_ceiling||ref.manufacturability_ceiling;
  if(ceiling) html+=H('Physical-realization ceiling (honest)')+`<div class="l2">${esc(ceiling)}</div>`;
  return html;
}
async function missionView(r){
  // The ADR-0071 refinement trajectory is a DISCOVERED, Ed25519-verified Design-
  // History-File artifact; resolve its content (the trajectory JSON) the same way
  // any artifact body is resolved over P2P — no client-side injection.
  const L=r._links||{}; const url=join(r._base||'', L.content); let ref=null;
  try{ ref=JSON.parse(await fetchText(url)||'null'); }catch(e){ ref=null; }
  if(!ref||typeof ref!=='object')
    return {title:`<span class="kind k-mission">MISSION</span> ${esc(r.label)}`,
      html:`<div class="viewerr">design-history content could not be loaded from ${esc(url)} — the node may be offline or the artifact body gated.</div>`};
  return {title:`<span class="kind k-mission">MISSION</span> ${esc(r.label)}`, html:missionDocHTML(ref)};
}
/* ---------- operator console views ---------- */
async function opPost(base,path,body){ const u=join(base,path);
  try{ const r=await fetch(u,{method:'POST',
      headers:{'Content-Type':'application/json',...authHeaders(u)},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({})); return {status:r.status,body:d}; }
  catch(e){ let msg=String(e&&e.message||e);
    if(location.protocol==='https:'&&/^http:\/\//i.test(u))
      msg+=` — this page is HTTPS and browsers block calls to an HTTP node. Open the node's own console directly at ${opBaseKey(base)}/ (a local node needs no token there).`;
    return {status:0,body:{error:msg}}; } }

async function operatorView(){
  const m=opTokens();
  // Local (loopback-reachable) nodes are owner-trusted WITHOUT a token, so surface
  // them in the console automatically alongside any token-saved remote nodes. This
  // INCLUDES the page's own origin when the UI is served by a local node itself
  // (open http://localhost:<port>/ and its console is right here, no token).
  const localBases=[...new Set([...peerList().map(opBaseKey).filter(isLocalBase),
    ...(isLocalBase(location.origin)?[opBaseKey(location.origin)]:[])])];
  const bases=[...new Set([...Object.keys(m),...localBases])];
  let html=H('Operator authority — a bearer token, or a local (loopback) node')
    +`<div class="desc2">Each node mints a per-install token (printed at boot; stored at `
    +`<code>runs/…/_operator/token</code>). Paste it here to unlock a REMOTE node's owner intake `
    +`(ASK / FUND / STOP / ATTEST), full status, runs and personas. A node reachable on `
    +`<code>localhost</code> is your own machine — the node trusts the loopback connection as `
    +`operator, so <b>no token is needed</b> for it (a tunneled node keeps the public host and `
    +`still requires the token).</div>`;
  html+=H('Add a node')+`<div class="opform">`
    +`<input id="op-base" type="url" placeholder="node base URL, e.g. http://localhost:8765" value="${esc(opBaseKey(peerList()[0]||''))}">`
    +`<input id="op-token" type="password" placeholder="operator token">`
    +`<button class="btn" data-act="op-save">SAVE</button></div>`;
  html+=H(`Operator nodes (${bases.length})`);
  for(const b of bases){ const loc=isLocalBase(b), tokd=!!(m[b]);
    html+=`<div class="grant"><span>${esc(b)}${loc&&!tokd?' <span class="ok">· local · token bypassed (loopback)</span>':''}</span>`
    +`<span><a href="#" data-act="op-node" data-base="${esc(b)}">console →</a>`
    +(tokd?` · <a href="#" data-act="op-del" data-base="${esc(b)}">forget ✕</a>`:'')+`</span></div>`; }
  if(!bases.length) html+=`<div class="l2">no operator tokens saved and no local node discovered — this browser is an anonymous public viewer. Run a node locally (it appears here automatically) or paste a remote node's token.</div>`;
  return {title:`<span class="kind k-env">OPERATOR</span> console`,html};
}

async function operatorNodeView(b){
  const key=opBaseKey(b);
  const mixed=location.protocol==='https:'&&/^http:\/\//i.test(key);
  const st=await fetchJson(join(b,'status'))||{};
  const reached=!!st.schema;
  const pub=st.schema==='personaos-node-status-public/1';
  const loc=isLocalBase(b), tokd=Object.keys(opTokens()).includes(key);
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  let html='';
  if(!reached){
    html+=`<div class="desc2"><span class="no">can't reach this node from this page</span>`
      +(mixed
        ?` — this page is served over <b>HTTPS</b> and browsers block it from calling an <b>HTTP</b> node. Open the node's OWN console directly (same-origin, and a local node needs no token): <a href="${esc(key)}/" target="_blank" rel="noopener">${esc(key)}/</a>`
        :` — check the node is running and reachable at <code>${esc(key)}</code>.`)+`</div>`;
    return {title:`<span class="kind k-env">OPERATOR</span> ${esc(key)}`,html};
  }
  if(!pub&&loc&&!tokd) html+=`<div class="desc2"><span class="ok">● local node — operator authority via loopback</span>; no token needed (the node trusts the same-machine connection). Set <code>PERSONAOS_TRUST_LOOPBACK=0</code> on the node to require one.</div>`;
  else if(pub&&loc) html+=`<div class="desc2"><span class="no">loopback trust off or proxied</span> — a local node should grant operator access without a token. If you reached it through a tunnel/proxy the token is still required; otherwise check it isn't started with <code>PERSONAOS_TRUST_LOOPBACK=0</code>.</div>`;
  else if(pub) html+=`<div class="desc2"><span class="no">token missing or rejected</span> — the node returned its public projection. Paste this node's token in the operator console (or open its localhost UI, where loopback grants access).</div>`;
  html+=kv('Node',S0(st.node_id))+kv('Backend',S0(st.backend)+' · '+S0(st.active_model))
    +kv('Lineage',st.lineage_durable?'<span class="ok">durable ✓</span>':(pub?'—':'<span class="no">in-memory only</span>'))
    +kv('Budget',S0(st.budget_candidates)+' cand/task · pending '+S0(st.pending_budget??0))
    +kv('Artifact tier',S0(st.artifact_tier))
    +kv('Public discovery',st.public_discovery?`<span class="ok">on</span> (${esc((st.public_discovery_kinds||[]).join(', '))})`:'off');
  const personas=st.personas||[];
  if(personas.length) html+=H(`Personas (${personas.length})`)+personas.map((p)=>
    `<div class="grant"><span>${esc(p.name||p.persona_id)}</span>`
    +`<span class="l2">${esc(p.lifecycle_state||'')} · ${esc(p.experience_tasks??0)} task(s) · fit ${esc(p.fitness??'—')}</span></div>`).join('');
  const runs=st.runs||[];
  if(runs.length) html+=H(`Runs (${runs.length})`)+runs.slice(-12).reverse().map((r)=>{
    const id=typeof r==='string'?r:(r.run||r.run_id||'');
    return `<div class="grant"><span><a href="#" data-act="op-run" data-base="${esc(b)}" data-run="${esc(id)}">${esc(id)}</a></span>`
      +`<span class="l2">${esc(typeof r==='object'?(r.status||''):'')}</span></div>`; }).join('');
  const paused=st.paused_missions||[];
  if(paused.length) html+=H(`Paused missions (${paused.length}) — fund to resume`)+paused.map((p)=>
    `<div class="grant"><span>${esc(p.run||p.run_id||'')}</span><span class="l2">${esc(p.status||p.reason||'paused')}</span></div>`).join('');
  // A-HB (06_DOMAIN §5.5): missions BLOCKED on a HUMAN — the persona named an
  // unavailable external capability instead of fabricating a value. The human
  // attests once (signed bridge evidence); the next resume clears the block.
  const att=st.attestations_needed||[];
  html+=H(`Human attestation${att.length?` ⚠ needed (${att.length}) — mission honest-blocked`:''}`);
  if(!att.length){
    html+=`<div class="l2">`+(pub
      ?`operator-only — attestation requests appear here once you have owner access (paste the token, or open the node's localhost UI).`
      :`✓ no mission is blocked on human attestation right now. When a persona honest-blocks on an external capability it cannot self-provision (a hardware instrument, a credential, a paid API…), it appears here with an <b>✍ ATTEST</b> form.`)+`</div>`;
  } else {
    html+=att.map((a)=>{
      const blocks=(a.blocks||[]).map((bk)=>
        `<div class="grant"><span class="amber">${esc(bk.capability||bk.kind||'capability')}</span>`
        +`<span class="l2">${esc(bk.target||'')} ${esc((bk.reason||'').slice(0,90))}</span></div>`).join('');
      return `<div class="grant"><span>${esc(a.run)}</span><span class="l2">${esc((a.task||'').slice(0,60))}</span></div>`+blocks
        +`<div class="opform">`
        +`<input class="op-att-stmt" data-run="${esc(a.run)}" placeholder="what you provisioned / verified (signed into the run)">`
        +`<textarea class="op-att-smoke" data-run="${esc(a.run)}" rows="2" placeholder="optional SMOKE TEST (Python, runs in the real sandbox; a failing probe REFUSES the attestation; passing output becomes EXECUTED evidence)"></textarea>`
        +`<div class="oprow"><button class="btn" data-act="op-attest" data-base="${esc(b)}" data-run="${esc(a.run)}">✍ ATTEST</button></div></div>`;
    }).join('');
  }
  html+=H('Ask the node — owner intake')
    +`<div class="opform"><textarea id="op-task" rows="3" placeholder="any task in any field — the domain emerges at runtime"></textarea>`
    +`<div class="oprow"><input id="op-budget" type="number" min="1" placeholder="budget — optional for ASK, required for FUND">`
    +`<button class="btn" data-act="op-ask" data-base="${esc(b)}">⚡ ASK</button>`
    +`<button class="btn" data-act="op-fund" data-base="${esc(b)}">💰 FUND</button>`
    +`<input id="op-run-target" placeholder="run id (stop / fund target, optional)">`
    +`<button class="btn btn-stop" data-act="op-stop" data-base="${esc(b)}">⏹ STOP</button></div>`
    +`<pre id="op-out" class="opout"></pre></div>`;
  // Owner-class creation: environments form via the full §12c/§15 ceremony;
  // personas are OPERATOR-seeded souls (personas still never self-author).
  html+=H('Create — environment / persona (owner authority)')
    +`<div class="opform"><div class="oprow">`
    +`<input id="op-env-name" placeholder="new environment name">`
    +`<input id="op-env-desc" placeholder="purpose / charter line (optional)">`
    +`<button class="btn" data-act="op-newenv" data-base="${esc(b)}">🏗 NEW ENV</button></div>`
    +`<div class="oprow">`
    +`<input id="op-p-name" placeholder="new persona name">`
    +`<input id="op-p-role" placeholder="role (default member)">`
    +`<input id="op-p-desc" placeholder="description (optional)">`
    +`<button class="btn" data-act="op-newpersona" data-base="${esc(b)}">🧬 NEW PERSONA</button></div></div>`;
  // 09_PROTOCOLS §2/A.1: the kernel's MCP tool surface — substrate built-ins +
  // persona-authored, FSM-promoted env tools (invocable below, kernel-mediated).
  const mcp=await fetchJson(join(b,'mcp/tools'));
  if(mcp&&mcp.builtins){
    html+=H('Env MCP tools (kernel-mediated)');
    html+=`<div class="l2" style="margin:2px 0 4px">built-ins: ${mcp.builtins.map((t)=>esc(t.name)).join(' · ')}</div>`;
    const authored=mcp.persona_authored||{};
    const envs=Object.keys(authored);
    if(envs.length) html+=envs.map((eid)=>authored[eid].map((t)=>
      `<div class="grant"><span>${esc(t.name)} <span class="l2">${esc(t.description||'')}</span></span>`
      +`<span class="l2">${esc(eid.slice(0,22))} · by ${esc((t.author_persona_id||'').slice(-8))}</span></div>`).join('')).join('');
    else html+=`<div class="l2">no persona-authored tools promoted yet — a persona authors one via the ToolArtifact FSM; promotion mounts it here.</div>`;
    html+=`<div class="opform"><div class="oprow">`
      +`<input id="op-mcp-env" placeholder="environment id (optional)">`
      +`<input id="op-mcp-tool" placeholder="tool name, e.g. sandbox_exec">`
      +`<input id="op-mcp-args" placeholder='args JSON, e.g. {"code":"print(42)"}'>`
      +`<button class="btn" data-act="op-mcpcall" data-base="${esc(b)}">🔧 CALL</button></div></div>`;
  }
  return {title:`<span class="kind k-env">OPERATOR</span> ${esc(st.node_id||b)}`,html};
}

async function operatorRunView(b,run){
  const st=await fetchJson(join(b,'runs/'+encodeURIComponent(run)))||{};
  const arts=await fetchJson(join(b,'runs/'+encodeURIComponent(run)+'/artifacts'))||{};
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  const rs=st.run_state||{};
  const stt=String(rs.status||'—');
  const stClass=(stt==='shipped'||stt==='completed'||rs.accepted)?'ok':(stt==='running'||stt==='queued'?'amber':'no');
  // a paused mission card opens this view directly, so give it inline resume/stop
  // controls (it is otherwise read-only). The handlers prefer a.dataset.run over the
  // console-level #op-run-target, and read #opr-budget when present.
  let html='<div class="opform"><div class="oprow">'
    +'<input id="opr-budget" type="number" min="1" placeholder="add budget">'
    +'<button class="btn" data-act="op-fund" data-base="'+esc(b)+'" data-run="'+esc(run)+'">💰 FUND</button>'
    +'<button class="btn btn-stop" data-act="op-stop" data-base="'+esc(b)+'" data-run="'+esc(run)+'">⏹ STOP</button></div>'
    +'<pre id="op-out" class="opout"></pre></div>';
  html+=kv('Run',`<code>${esc(run)}</code>`)
    +kv('Status',`<span class="${stClass}">● ${esc(stt)}</span>`)
    +kv('Accepted',rs.accepted?'<span class="ok">✓ yes</span>':'<span class="no">no</span>')
    +kv('Task class',S0(rs.task_class))+kv('Pathway',S0(rs.acceptance_pathway))
    +kv('Task',S0((rs.task||'').slice(0,200)));
  // GAP #3: surface the ContinuousRefinementMission trajectory from the served
  // design_history (best-so-far never regresses; budget tranches; marginal value).
  const dh=st.design_history||rs.refinement_mission||{};
  if(dh && (dh.final_status||dh.trajectory)){
    html+=H('Mission trajectory (ADR-0071 — best-so-far)')
      +kv('Final state',S0(dh.final_state||dh.final_status))
      +kv('Converged',dh.converged?'<span class="ok">yes</span>':'<span class="dim">no (reopen-eligible)</span>')
      +kv('Best score',S0(dh.best_so_far_score!=null?Number(dh.best_so_far_score).toFixed(4):rs.best_score));
    const traj=dh.trajectory||[];
    if(traj.length) html+='<div class="tape-mini">'+traj.map((rd)=>
      `<div class="row2"><span>r${esc(rd.round)}</span><span>score <b>${esc(Number(rd.best_score||0).toFixed(4))}</b></span>`
      +`<span class="${(rd.marginal_value||0)>=0?'ok':'no'}">Δ${esc(Number(rd.marginal_value||0).toFixed(4))}</span>`
      +`<span class="l2">${esc(rd.candidates_explored||0)} cand</span></div>`).join('')+'</div>';
  }
  // GAP #3: per-objective evidence basis + acceptance.
  const ev=rs.objective_evidence||dh.objective_evidence;
  if(ev) html+=H('Objective evidence basis (07_ARTIFACTS §7)')+Object.entries(ev).map(([n,e2])=>{
    const es=(e2||{}).evidence_strength||'—';
    const cls=es==='executed'?'ok':(es==='unmeasured'?'no':'amber');
    return `<div class="grant"><span class="l2">${esc(n)}</span><span class="${cls}">${esc(es)}</span></div>`;
  }).join('');
  const ap=rs.answer_package; if(ap&&ap.schema) html+=H('Signed AnswerPackage (answer/5)')
    +kv('Status',S0(ap.status))+kv('Bundle ref',S0(ap.artifact_bundle_ref))
    +kv('Bundle state',S0(ap.artifact_bundle_state))+kv('Signed',ap.signed_by?'<span class="ok">✓</span>':'<span class="no">✗</span>');
  const files=arts.package||arts.package_files||arts.files||[];
  if(files.length) html+=H(`Package artifacts (${files.length})`)+files.slice(0,100).map((f)=>{
    const path=typeof f==='string'?f:(f.path||f.title||'');
    const name=String(path).split('/').pop();
    return `<div class="grant"><span class="l2">${esc(name)}</span><span class="l2">${esc(String(path).includes('/')?path.split('/').slice(0,-1).join('/'):'')}</span></div>`;
  }).join('');
  const bundles=arts.bundles||[];
  if(bundles.length) html+=H(`Bundles (${bundles.length})`)+bundles.map((bd)=>
    `<div class="grant"><span class="l2">${esc(bd.bundle_id||bd.path||'bundle')}</span><span class="${bd.state==='shipped'||bd.state==='accepted'?'ok':'amber'}">${esc(bd.state||'—')}</span></div>`).join('');
  return {title:`<span class="kind k-mission">RUN</span> ${esc(run)}`,html};
}

async function viewFor(id){ const r=S.recs.get(id); if(!r) return {title:'—',html:'not found'};
  const L=r._links||{};
  if(r.kind==='artifact' && _isMissionDoc(r,L)) return missionView(r);
  if(r.kind==='mission' && L.content) return missionView(r);
  if(r.kind==='persona') return personaView(r);
  if(r.kind==='env') return envView(r);
  if(r.kind==='domain') return domainView(r);
  if(r.kind==='project') return projectView(r);
  if(r.kind==='telemetry') return telemetryView(r);
  if(r.kind==='artifact' && L.bundle) return bundleView(r._base||'',L.bundle,L);
  if(r.kind==='artifact' && L.content) return fileView(r._base||'',L.content,r.label,L.media_kind);
  return genericView(r);
}
// Any renderer that allocates per-view resources (blob: URLs, a three.js scene,
// timers) registers a teardown here; renderTop() runs every pending teardown before
// it paints the next view so nothing leaks across navigation.
function runViewCleanups(){ const cbs=S.viewCleanups||[]; S.viewCleanups=[];
  for(const fn of cbs){ try{ fn(); }catch(e){} } }
function onViewCleanup(fn){ (S.viewCleanups=S.viewCleanups||[]).push(fn); }
async function renderTop(){ const top=S.views[S.views.length-1]; if(!top) return;
  runViewCleanups();
  S.drawerLiveKind=null; S.drawerLiveId=null; S.drawerLiveFeed=null; S.drawerLiveBase=''; S.drawerThinkPid=null;   // the view sets these if it streams
  $('#detailbody').innerHTML='<div class="l2">resolving…</div>';
  let v; try{ v=await top(); }catch(e){ v={title:'error',html:'<div class="l2">'+esc(e.message)+'</div>'}; }
  $('#detail-title').innerHTML=v.title; $('#detailbody').innerHTML=v.html;
  $('#detailback').hidden=S.views.length<=1; $('#detailbody').scrollTop=0;
  // optional async post-mount step (media renderers paint into a container here)
  if(typeof v.mount==='function'){ try{ await v.mount($('#detailbody')); }catch(e){} }
}
function pushView(fn){ S.views.push(fn); renderTop(); }
function openDetail(id){ S._topIsOp=false; S._lastFocus=document.activeElement;
  S.views=[()=>viewFor(id)]; $('#detailwrap').classList.add('open'); renderTop(); $('.drawer')?.focus(); }

// ---------- main animation loop ----------
// One rAF: paint the ECG vital every frame, and refresh the missions strip +
// vitals counters a few times a second. (The board replay-tape engine is gone —
// the page is driven by live telemetry deltas, not a replayed event ring.)
let lastBucket=0;
function tick(now){
  drawVital();
  if(now-lastBucket>900){ lastBucket=now; renderMissions(); updateVitalsCounters(); }
  requestAnimationFrame(tick);
}

/* ---------- missions strip (every task the discovered nodes work on) ---------- */
// Cards come from two honest sources: (1) discovered mission/design-history
// records — shipped/refined missions anyone may see; (2) the node's /status —
// running/paused mission state, which the node only exposes to an operator
// token (anonymous viewers see the public projection without run state).
// A mission document is the run's Design-History-File artifact. Media kinds are
// EMERGENT registry values (a run may classify it structured_data), so match the
// canonical filename too — the label rides inside the signed record.
function _isMissionDoc(r,L){ return L.media_kind==='design_history'
  || /(^|\/)design_history\.json$/i.test(r.label||''); }
function missionCardList(){
  const cards=[]; const seen=new Set();
  const shippedSeen=new Set();
  for(const id of S.order){ const r=S.recs.get(id); const L=r._links||{};
    if(r.kind==='mission'||(r.kind==='artifact'&&_isMissionDoc(r,L))){
      // the PROJECT record from the same kernel carries the human task text;
      // MANY legs of one mission ship many design-history records — ONE card
      // per (kernel, task), pointing at the newest record discovered.
      const proj=S.order.map((x)=>S.recs.get(x)).find((p)=>p&&p.kind==='project'&&p._kernel===r._kernel);
      const task=(proj&&proj.label)||r.label||'mission';
      const dedupe=(r._kernel||'')+'::'+task;
      if(shippedSeen.has(dedupe)) continue; shippedSeen.add(dedupe);
      cards.push({key:'rec:'+id,task,state:'shipped',
        meta:[(r._kernel||'').slice(0,16)],recId:id}); } }
  for(const [base,hit] of statusCache){ const v=hit&&hit.v; if(!v) continue;
    const busy=String((v.heartbeat||{}).busy||'');
    for(const run of (v.stoppable_runs||[])){ if(seen.has(run)) continue; seen.add(run);
      cards.unshift({key:'run:'+run,task:busy||run,state:'running',meta:[run.slice(0,26)],base,run}); }
    for(const p of (v.paused_missions||[])){
      const run=String(p.run||p.run_id||p); if(!run||seen.has(run)) continue; seen.add(run);
      cards.push({key:'pause:'+run,task:String(p.task||run),state:'paused',
        meta:[run.slice(0,26),String(p.status||'')],base,run}); } }
  return cards;
}
// The strip needs each node's run state (the token-gated part of /status);
// prefetch statuses for every discovered base so running/paused missions show
// without first opening a drawer. Anonymous viewers get the public projection
// (no run state) and the strip stays honest — records only.
function prefetchNodeStatuses(){
  for(const key of S.boots.keys()){ const base=key==='@origin'?'':key;
    fetchNodeStatus(base).then(()=>renderMissions()).catch(()=>{}); }
}
function renderMissions(){
  const box=$('#missions'), wrap=$('#missionCards'); if(!box||!wrap) return;
  const cards=missionCardList();
  box.hidden=!cards.length;
  if(!cards.length) return;
  const html=cards.slice(0,24).map((c)=>
    `<div class="mcard" role="button" tabindex="0"${c.recId?` data-mrec="${esc(c.recId)}"`:''}${c.run?` data-mrun="${esc(c.run)}" data-mbase="${esc(c.base||'')}"`:''}>`
    +`<span class="mtask" title="${esc(c.task)}">${esc(c.task)}</span>`
    +`<span class="mmeta"><span class="mstate ms-${esc(c.state)}">${esc(c.state.toUpperCase())}</span>`
    +c.meta.filter(Boolean).map((m)=>`<span>${esc(m)}</span>`).join('')+`</span></div>`).join('');
  if(wrap.dataset.h!==html){ wrap.dataset.h=html; wrap.innerHTML=html; }
}

/* ---------- wiring ---------- */
// lightweight stage/feed filter — hides persona cards, env lanes, and feed rows
// that don't match the query (replaces the board's row filter).
function _applyFilter(){
  const q=(S.q||'').trim();
  document.querySelectorAll('.pcard').forEach((el)=>{ el.style.display=(!q||el.textContent.toLowerCase().includes(q))?'':'none'; });
  document.querySelectorAll('.env-lane').forEach((lane)=>{
    const hay=lane.textContent.toLowerCase();
    lane.style.display=(!q||hay.includes(q))?'':'none'; });
  document.querySelectorAll('#sysStream .ix').forEach((li)=>{ li.style.display=(!q||li.textContent.toLowerCase().includes(q))?'':'none'; });
}
function wire(){
  // keyboard access: Enter/Space activates any focusable [data-pcard]/[data-envrec]/
  // [data-artid]/[data-gp]/.mcard control (they carry role="button" tabindex="0").
  document.addEventListener('keydown',(e)=>{ if(e.key!=='Enter'&&e.key!==' ') return;
    const t=e.target.closest('[data-pcard],[data-envrec],[data-artid],[data-gp],.mcard'); if(!t) return;
    e.preventDefault(); t.dispatchEvent(new MouseEvent('click',{bubbles:true})); });
  // coordination-feed filters: ALL · COORD · VERIFY · SHIP · CROSS-ENV
  $('#sysStreamTabs').addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b)return;
    S.sysFlt=b.dataset.flt; [...e.currentTarget.children].forEach((c)=>c.classList.toggle('on',c===b)); renderInteractionStream(); });
  // stage click: a persona card or env name → open its Ed25519 drawer; deliverable chip → bundle/mission drawer
  $('#sysEnvs').addEventListener('click',(e)=>{
    // follow toggle: the card's ◎ button focuses the stage+feed on ONE persona
    // (the only follow trigger reachable at every breakpoint). Stop here so the
    // click doesn't also open the drawer.
    const fb=e.target.closest('[data-follow]'); if(fb){ e.stopPropagation(); const fid=fb.dataset.follow;
      S.follow=(S.follow===fid)?null:fid; _applyFollow(); renderInteractionStream(); return; }
    // the card/lane carry a SHORT id (a ULID); a discovered record's canonical
    // DID contains it (…/persona/<ULID>) — match by containment, tolerant of did form.
    const pc=e.target.closest('[data-pcard]'); if(pc){ const sid=pc.dataset.pcard;
      // clicking a card that is dimmed-out under follow opens its drawer — clear the
      // follow first so the just-inspected card isn't left greyed (looks disabled).
      if(S.follow&&S.follow!==sid){ S.follow=null; _applyFollow(); renderInteractionStream(); }
      const rid=S.order.find((id)=>{ const r=S.recs.get(id);
        return r.kind==='persona'&&((r.did||'').includes(sid)||_shortId(r.did||'')===sid||(r.record_id||'').includes(sid)); });
      if(rid) openDetail(rid); return; }
    const ev=e.target.closest('[data-envrec]'); if(ev){ const sid=ev.dataset.envrec;
      const rid=S.order.find((id)=>{ const r=S.recs.get(id);
        return r.kind==='env'&&((r.did||'').includes(sid)||_shortId(r.did||'')===sid); });
      if(rid) openDetail(rid); return; }
    const ar=e.target.closest('[data-artid]'); if(ar){ const aid=ar.dataset.artid;
      const rid=S.recs.has(aid)?aid:S.order.find((id)=>{ const r=S.recs.get(id);
        return r&&((r.record_id||r.card_id)===aid||(r.did||'').includes(aid)); });
      if(rid) openDetail(rid); else log('artifact',`no viewable record for ${String(aid).slice(0,16)} (not yet exported)`,false); } });
  // constellation node click → FOLLOW that persona (focus the stage + feed on it);
  // click the same node (or "show all") to clear. The full drawer opens from the card.
  const g=$('#sysGraph'); if(g) g.addEventListener('click',(e)=>{ const node=e.target.closest('[data-gp]'); if(!node) return;
    const sid=node.dataset.gp; S.follow=(S.follow===sid)?null:sid; _applyFollow(); renderInteractionStream(); });
  $('#cfUnfollow').addEventListener('click',()=>{ S.follow=null; _applyFollow(); renderInteractionStream(); });
  // collapse / expand the constellation rail
  $('#conToggle').addEventListener('click',(e)=>{ $('#constellation').classList.toggle('collapsed');
    e.currentTarget.setAttribute('aria-expanded',String(!$('#constellation').classList.contains('collapsed'))); });
  // filter the stage + feed (replaces the board's row filter)
  $('#q').addEventListener('input',(e)=>{ S.q=e.target.value.toLowerCase(); _applyFilter(); });
  $('#addpeer').addEventListener('click',()=>{ let v=$('#peer').value.trim(); if(!v)return;
    // the input is type=url but there's no <form>, so native validation never runs —
    // normalise a bare host ('localhost:8805') to an absolute https URL before storing.
    if(!/^https?:\/\//i.test(v)) v='https://'+v;
    let s=[]; try{ s=JSON.parse(localStorage.getItem('personaos_peers')||'[]'); }catch(e){} if(!s.includes(v))s.push(v);
    localStorage.setItem('personaos_peers',JSON.stringify(s)); $('#peer').value='';
    discover().then(()=>{ renderMissions();
      const ph=S.peerHealth||new Map();
      const h=ph.get(v)||ph.get(opBaseKey(v))||ph.get(opBaseKey(v)+'/');
      log('peer', h&&h.ok?('reachable ✓ '+v):('no node at '+v), !!(h&&h.ok)); }); });
  // Enter in the peer field submits (no <form> wraps it)
  $('#peer').addEventListener('keydown',(e)=>{ if(e.key==='Enter') $('#addpeer').click(); });
  // OPERATOR is a TOGGLE: a second click closes the console it opened. We tag the
  // drawer with S._topIsOp; opening any other drawer (openDetail) or closing the
  // drawer clears the flag, so the toggle reflects true open-ness.
  $('#opbtn').addEventListener('click',()=>{
    const open=$('#detailwrap').classList.contains('open');
    if(open && S._topIsOp){ $('#detailwrap').classList.remove('open'); S._topIsOp=false; return; }
    S.views=[()=>operatorView()]; S._topIsOp=true;
    $('#detailwrap').classList.add('open'); renderTop(); });
  updateOpBadge();
  // "what is this" intro + setup instructions: HIDDEN by default (the living network is
  // the page — instructions don't eat real estate); the ？ button toggles them on demand.
  const hb=$('#helpbtn'), intro=$('#intro');
  if(hb&&intro){
    intro.hidden=true;
    hb.addEventListener('click',()=>{ intro.hidden=!intro.hidden;
      hb.setAttribute('aria-expanded',String(!intro.hidden)); });
    $('#introclose')?.addEventListener('click',()=>{ intro.hidden=true;
      hb.setAttribute('aria-expanded','false'); });
  }
  // missions strip → open the mission record, or the operator run console when
  // the card came from a token-gated /status (running/paused mission).
  const mc=$('#missionCards');
  if(mc) mc.addEventListener('click',(e)=>{ const c=e.target.closest('.mcard'); if(!c) return;
    if(c.dataset.mrec){ openDetail(c.dataset.mrec); return; }
    if(c.dataset.mrun){ S.views=[()=>operatorRunView(c.dataset.mbase||'',c.dataset.mrun)];
      $('#detailwrap').classList.add('open'); renderTop(); } });
  // in-drawer navigation: follow links to other records / bundles / artifact files
  $('#detailbody').addEventListener('click',(e)=>{ const a=e.target.closest('[data-act]'); if(!a) return; e.preventDefault();
    const act=a.dataset.act, base=S.curBase||'';
    if(act==='tdir'){ const key=a.dataset.key, wasCollapsed=a.dataset.collapsed==='1';
      if(!S.bundleDirs)S.bundleDirs=new Set(); if(!S.bundleDirsOpen)S.bundleDirsOpen=new Set();
      // flip the effective state regardless of depth-default; explicit sets win over the default
      if(wasCollapsed){ S.bundleDirs.delete(key); S.bundleDirsOpen.add(key); }
      else { S.bundleDirsOpen.delete(key); S.bundleDirs.add(key); }
      const sc=$('#detailbody').scrollTop; renderTop().then(()=>{ $('#detailbody').scrollTop=sc; }); return; }
    if(act==='op-save'){ const nb=opBaseKey($('#op-base').value.trim()), tv=$('#op-token').value.trim();
      if(nb&&tv){ const m2=opTokens(); m2[nb]=tv; opSaveTokens(m2); S.views[S.views.length-1]=()=>operatorView(); renderTop(); discover(); } return; }
    if(act==='op-del'){ const m2=opTokens(); delete m2[a.dataset.base]; opSaveTokens(m2);
      S.views[S.views.length-1]=()=>operatorView(); renderTop(); return; }
    if(act==='op-node'){ pushView(()=>operatorNodeView(a.dataset.base)); return; }
    if(act==='op-run'){ pushView(()=>operatorRunView(a.dataset.base,a.dataset.run)); return; }
    if(act==='op-attest'){ const b2=a.dataset.base, run=a.dataset.run, out=$('#op-out');
      const sel=(window.CSS&&CSS.escape)?CSS.escape(run):run;
      const inp=document.querySelector(`.op-att-stmt[data-run="${sel}"]`);
      const smokeEl=document.querySelector(`.op-att-smoke[data-run="${sel}"]`);
      const statement=(inp&&inp.value||'').trim();
      const smoke_test=(smokeEl&&smokeEl.value||'').trim();
      if(!statement){ if(out) out.textContent='describe what you provisioned/verified first — the statement is signed into the run'; return; }
      if(out) out.textContent=smoke_test?'running smoke test in the sandbox, then signing…':'signing human attestation…';
      opPost(b2,'attest',{run,statement,smoke_test}).then((r)=>{
        if(out) out.textContent=`HTTP ${r.status}\n`+JSON.stringify(r.body,null,1).slice(0,1200)
          +(r.status<300?'\n\n→ now FUND the mission to resume with the attested capability.':'');
        if(r.status<300){ S.views[S.views.length-1]=()=>operatorNodeView(b2); setTimeout(renderTop,3500); } });
      return; }
    if(act==='op-newenv'||act==='op-newpersona'||act==='op-mcpcall'){ const b2=a.dataset.base, out=$('#op-out');
      const show=(r)=>{ if(out) out.textContent=`HTTP ${r.status}\n`+JSON.stringify(r.body,null,1).slice(0,1600);
        // leave the result readable, then refresh the console so the new entity shows
        if(r.status<300){ S.views[S.views.length-1]=()=>operatorNodeView(b2); setTimeout(renderTop,3000); } };
      if(act==='op-newenv'){ const name=($('#op-env-name')?.value||'').trim();
        if(!name){ if(out) out.textContent='enter an environment name first'; return; }
        if(out) out.textContent='forming environment (full §12c ceremony)…';
        opPost(b2,'env',{name,description:($('#op-env-desc')?.value||'').trim()}).then(show); }
      else if(act==='op-newpersona'){ const name=($('#op-p-name')?.value||'').trim();
        if(!name){ if(out) out.textContent='enter a persona name first'; return; }
        if(out) out.textContent='seeding persona…';
        opPost(b2,'persona',{name,role:($('#op-p-role')?.value||'').trim()||'member',
          description:($('#op-p-desc')?.value||'').trim()}).then(show); }
      else { const tool=($('#op-mcp-tool')?.value||'').trim();
        if(!tool){ if(out) out.textContent='enter a tool name first'; return; }
        let args={}; try{ args=JSON.parse(($('#op-mcp-args')?.value||'').trim()||'{}'); }
        catch(e){ if(out) out.textContent='args must be valid JSON'; return; }
        if(out) out.textContent='calling (kernel-mediated, sandboxed)…';
        opPost(b2,'mcp/call',{environment_id:($('#op-mcp-env')?.value||'').trim(),tool,args})
          .then((r)=>{ if(out) out.textContent=`HTTP ${r.status}\n`+JSON.stringify(r.body,null,1).slice(0,1600); }); }
      return; }
    if(act==='op-ask'||act==='op-fund'||act==='op-stop'){ const b2=a.dataset.base, out=$('#op-out');
      // ASK/FUND/STOP mutate node state — leave the JSON visible briefly, then re-render
      // the console so the new run / updated paused list shows (mirrors op-newenv).
      const show=(r)=>{ if(out) out.textContent=`HTTP ${r.status}\n`+JSON.stringify(r.body,null,1).slice(0,1600);
        if(r.status<300){ S.views[S.views.length-1]=()=>operatorNodeView(b2); setTimeout(renderTop,3000); } };
      // a run-scoped control (operatorRunView's inline FUND/STOP) carries the run on the
      // button; prefer it over the console-level #op-run-target field.
      const run=(a.dataset.run||$('#op-run-target')?.value||'').trim();
      if(act==='op-ask'){ const text=($('#op-task')?.value||'').trim(); if(!text){ if(out) out.textContent='enter a task first'; return; }
        const body={text}; const bd=+($('#op-budget')?.value||0); if(bd>0) body.budget=bd;
        if(out) out.textContent='submitting…'; opPost(b2,'task',body).then(show); }
      else if(act==='op-fund'){ const bd=+(($('#opr-budget')?.value)||($('#op-budget')?.value)||0); if(!(bd>0)){ if(out) out.textContent='enter a budget > 0'; return; }
        const body={budget:bd}; if(run) body.run=run;
        if(out) out.textContent='funding…'; opPost(b2,'budget',body).then(show); }
      else { if(!run && !confirm('No run id entered — stop ALL active missions on this node?')) return;
        const body={}; if(run) body.run=run;
        if(out) out.textContent='stopping…'; opPost(b2,'stop',body).then(show); }
      return; }
    if(act==='rec') pushView(()=>viewFor(a.dataset.id));
    else if(act==='file'){ const o={contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null};
      pushView(()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,o)); }
    else if(act==='fv-raw'){ // swap the CURRENT file view to forced plain text (re-render in place)
      S.views[S.views.length-1]=()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,{raw:true}); renderTop(); }
    else if(act==='fv-rich'){ // swap back to the rich media renderer
      S.views[S.views.length-1]=()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,{}); renderTop(); }
    else if(act==='bundle') pushView(()=>bundleView(base,a.dataset.url));
    else if(act==='body') pushView(()=>bodyView(base,a.dataset.url));
    else if(act==='verify') pushView(()=>verifyView(base,a.dataset.url));
    else if(act==='physical') pushView(()=>physicalView(base,a.dataset.url));
    else if(act==='dist') pushView(()=>distributionView(base,{oci:a.dataset.oci,dag:a.dataset.dag,registry:a.dataset.reg})); });
  $('#detailback').addEventListener('click',()=>{ S.views.pop(); renderTop(); });
  // dialog focus management: save the trigger, move focus into the panel on open,
  // restore it on close (a11y — overlays are role=dialog aria-modal).
  const closeLog=()=>{ $('#logmodal').classList.remove('open');
    if(S._lastFocusLog){ try{ S._lastFocusLog.focus(); }catch(e){} S._lastFocusLog=null; } };
  const closeDetail=()=>{ $('#detailwrap').classList.remove('open'); S._topIsOp=false;
    if(S._lastFocus){ try{ S._lastFocus.focus(); }catch(e){} S._lastFocus=null; } };
  $('#logbtn').addEventListener('click',()=>{ S._lastFocusLog=document.activeElement;
    $('#logmodal').classList.add('open'); $('.logcard')?.focus(); });
  $('#logclose').addEventListener('click',closeLog);
  $('#logmodal').addEventListener('click',(e)=>{ if(e.target.id==='logmodal') closeLog(); });
  $('#detailclose').addEventListener('click',closeDetail);
  $('#detailwrap').addEventListener('click',(e)=>{ if(e.target.id==='detailwrap') closeDetail(); });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ closeLog(); closeDetail(); } });
}

// ---------- real P2P transport: a js-libp2p node in the browser ----------
// WebRTC + circuit-relay + Kademlia DHT + gossipsub. The HTTP federation above seeds it
// (and is the fallback); over libp2p the page gossips its signed records and verifies any
// it receives. Reaching other machines needs a relay/bootstrap peer (browsers can't accept
// inbound / multicast) — add one with ?relay=<multiaddr>.
let P2P=null;
function updateP2PStatus(){ const el=$('#p2p'); if(!el) return; const n=P2P&&P2P.node;
  el.textContent = n ? `P2P · libp2p ${n.peerId.toString().slice(0,10)}… · ${(n.getPeers?n.getPeers().length:0)} peer(s)` : 'P2P · http-federation'; }
async function onGossipRecord(doc){ if(!doc||!doc.record) return; let ok=false;
  if(doc.record.visibility_tier!=='public') return;
  if(doc.public_key_hex){ try{ ok=await ed.verifyAsync(hexToBytes(doc.signature_hex),enc.encode(canon(doc.record)),hexToBytes(doc.public_key_hex)); }catch(e){} }
  log('gossip',`${doc.record.kind}: ${(doc.record.label||'').slice(0,24)} — ${ok?'verified':'unverified'}`, ok);
  const r=doc.record, id=r.record_id||r.card_id;
  if(ok && id && !S.recs.has(id)){ upsert({...r,_kernel:doc.kernel_id||'gossip',_url:'',_access:doc.access_policy||{},_links:doc.links||{},_base:doc.base||'',_doc:doc});
    if(P2P) P2P.announce(doc); classifyMap(); updateVitalsCounters(); refreshSystemView(); }
}
async function initP2P(){
  const params=new URLSearchParams(location.search);
  const root=await fetchJson('.well-known/personaos-discovery.json')||{};
  collectP2PBootstraps(root);
  const list=[...S.p2pBootstraps,...params.getAll('relay'),...params.getAll('bootstrap')].filter(Boolean);
  log('p2p','starting libp2p node — WebRTC + Kademlia DHT + gossipsub…');
  try{
    const mod=await import('./p2p-libp2p.js');
    P2P=await mod.startP2P({ bootstrapList:list,
      onLog:(t,m)=>{ log('p2p',t+' '+m, t==='peer:connect'||t==='peer:discovery'?true:undefined); updateP2PStatus(); },
      onRecord:onGossipRecord });
    updateP2PStatus();
    for(const id of S.order){ const r=S.recs.get(id);
      if(r._doc&&r._doc.record?.visibility_tier==='public') P2P.announce(r._doc); }   // gossip public records to the mesh
    log('p2p', list.length ? `dialling ${list.length} relay/bootstrap peer(s)…`
      : 'libp2p running — no relay configured; add ?relay=<multiaddr> to reach other machines (a browser needs a relay/bootstrap to find peers)');
  }catch(e){ log('p2p','libp2p unavailable here, using HTTP federation: '+(e&&e.message||e), false);
    const el=$('#p2p'); if(el) el.textContent='P2P · http-federation'; }
}

(async ()=>{
  wire();
  // The IPFS plane (rendezvous CID → signed IPNS node cards) probes CONCURRENTLY
  // with HTTP discovery — a slow/dead configured peer must not delay it.
  discoverViaIPFS().catch(()=>{});
  setInterval(()=>{ discoverViaIPFS().catch(()=>{}); }, 120000);
  discoverLocalNode().catch(()=>{});                                  // is a node running on THIS machine?
  setInterval(()=>{ discoverLocalNode().catch(()=>{}); }, 30000);
  await discover();
  prefetchNodeStatuses();
  renderMissions();
  initP2P();   // start the real libp2p P2P node (non-blocking; HTTP discovery already populated the page)
  // periodic live re-discovery (genuinely re-resolves + re-verifies; ticks in new personas)
  setInterval(()=>{ discover().then(()=>{ renderMissions(); refreshLiveSection(); }).catch(()=>{}); }, 15000);
  // per-entity drawer feed + node run state + the living network: re-fetch on the
  // node's live cadence so the stage, constellation and feed stream without SSE.
  setInterval(()=>{ try{ refreshLiveSection(); refreshThinking(); prefetchNodeStatuses();
    refreshSystemView(); streamPersonaCognition(); }catch(e){} }, 5000);
  requestAnimationFrame(tick);
})().catch((e)=>{ $('#status').textContent='discovery error: '+e.message; console.error(e); });
