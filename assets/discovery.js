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
  liveTel:new Map(), liveByPersona:new Map(), liveByEnv:new Map(), drawerTimer:null };

// Index a live-telemetry doc per-persona and per-env so the detail views can
// render each entity's OWN activity (model_events carry persona_id +
// environment_id; spans carry scope + trace_id). Keyed by short persona/env id.
const _shortId=(s)=>String(s||'').replace(/^did:personaos:[^:]+:/,'').replace(/^(persona|env|kernel):/,'');
function indexLiveTelemetry(base,live){
  if(!live||typeof live!=='object') return;
  S.liveTel.set(base||'@origin',live);
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
      signed:a['personaos.lineage.signed']!==false,
      t:Date.parse(s.ended_at||s.started_at||'')||t }); } });
  personas.forEach((p)=>{ const pid=_shortId(p.persona_id);
    const cur=S.liveByPersona.get(pid)||{};
    S.liveByPersona.set(pid,{...cur,summary:p,models:byP.get(pid)||cur.models||[],generated_at:live.generated_at}); });
  for(const [pid,models] of byP){ if(!S.liveByPersona.has(pid)) S.liveByPersona.set(pid,{models,generated_at:live.generated_at}); }
  for(const [eid,models] of byE){ const cur=S.liveByEnv.get(eid)||{};
    S.liveByEnv.set(eid,{...cur,models,spans:spByE.get(eid)||cur.spans||[],generated_at:live.generated_at}); }
  for(const [eid,spans] of spByE){ const cur=S.liveByEnv.get(eid)||{};
    if(!cur.spans) S.liveByEnv.set(eid,{...cur,spans,generated_at:live.generated_at}); }
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
  for(const p of providers){
    const doc=await fetchJson(join(base,p.record_url)); if(!doc?.record){ continue; }
    const out=await verifiedRecordFromDoc(doc,keys,boot,base,plane,p.record_url);
    const r=doc.record;
    log('verify',`${r.kind}: ${(r.label||p.did||'').slice(0,28)} — ${out.ok?'OK':'FAIL'}`,out.ok);
    if(out.ok) found.push(out.row);
  }
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
  try{ s=JSON.parse(localStorage.getItem('personaos_peers')||'[]'); }catch(e){} return [...new Set([...p,...s,...TXT_PEERS])]; }

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
async function discover(){
  $('#log').innerHTML=''; $('#status').textContent='bootstrapping discovery…';
  await loadPeersTxt();                                            // published peers.txt → TXT_PEERS
  const seeds=[...new Set(['', ...peerList()])];
  S.telLoaded=S.telLoaded||new Set();
  for(const b of await resolveKernelBases(seeds)){
    const res=await discoverFrom(b,'internet'); res.found.forEach(upsert);
    if(res.boot) connectDiscoveryStream(b,res.boot);
    if(res.boot){ await loadTelemetry(b); }   // aggregate static spans + live node telemetry
  }
  classifyMap(); buildRows(); buildTicker(); renderStats(); renderGlobalKernels();
  renderEmptyState();
  const when=new Date();
  $('#status').innerHTML=`<span class="ok">${S.recs.size}</span> records discovered + Ed25519-verified across `
    +`<span class="ok">${S.kernels.size||1}</span> kernel(s) · internet (.well-known + Kademlia DHT) + intranet (mDNS) · access-gated`
    +` · refreshed ${String(when.getUTCHours()).padStart(2,'0')}:${String(when.getUTCMinutes()).padStart(2,'0')}:${String(when.getUTCSeconds()).padStart(2,'0')}Z (re-polls every 15 s)`;
}

// ---------- empty state: never a silent blank board ----------
function renderEmptyState(){
  const el=$('#emptystate'); if(!el) return;
  const table=document.querySelector('.watch');
  if(S.recs.size){ el.hidden=true; if(table) table.style.display=''; return; }
  if(table) table.style.display='none';
  const ph=S.peerHealth||new Map();
  const rows=[...ph.entries()].map(([base,h])=>
    `<div class="grant"><span class="${h.ok?'ok':'no'}">${h.ok?'●':'○'} ${esc(base)}</span>`
    +`<span class="l2">${h.ok?`reachable · ${h.records} public record(s)`:'unreachable'}</span></div>`).join('')
    ||'<div class="l2">no peers attempted yet</div>';
  const httpsPage=location.protocol==='https:';
  el.innerHTML=`<div class="empty-card">
    <h3>No live PersonaOS records discovered yet</h3>
    <div class="desc2">This page ships <b>no data</b> — everything you see is discovered at
    runtime from live nodes and Ed25519-verified in your browser. Nothing is showing because
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
    3 · The board re-polls every 15 s — records appear the moment a node responds.<br>
    4 · Your own node? Click <b>🔑 OPERATOR</b>, paste its token
    (<code>runs/…/_operator/token</code>) and drive it from here: ASK / FUND / STOP, runs,
    personas, live telemetry.</div>
  </div>`;
  el.hidden=false;
}

function appendTelemetryEvent(payload,base,boot,reason){
  const tel=payload?.telemetry||payload||{};
  const t=Date.parse(tel.generated_at||payload?.generated_at||'')||Date.now();
  const kid=(tel.node&&tel.node.node_id)||boot?.kernel_id||base||'live';
  const ev={t,kernel:kid,scope:'telemetry',kind:String(reason||tel.reason||payload?.reason||'LIVE_TELEMETRY'),
    trace:String(tel.schema||payload?.schema||'live'),signed:true,ms:0,gap:0};
  S.events=(S.events||[]).concat([ev]).sort((a,b)=>a.t-b.t);
  if(S.events.length===1) S.events[0].gap=0;
  const fm=$('#feedmode'); if(fm){ fm.textContent='LIVE'; fm.classList.add('live'); }
  const dot=$('#livedot'); if(dot) dot.style.background='var(--up)';
}
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
      if(added){ classifyMap(); buildRows(); buildTicker(); renderStats(); }
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
        signed:a['personaos.lineage.signed']!==false, ms:Number(a['personaos.lineage.append_ms']||0)
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


/* ---------- tick engine ---------- */
function emitOne(){
  const e=S.events[S.rIdx];
  // tape row
  const tape=$('#tape'); const li=document.createElement('li'); li.className='in';
  const d=new Date(e.t||Date.now());
  const sc=['domain','env','task','persona','project','answer','bundle','artifact'].includes(e.scope)?e.scope:'other';
  li.innerHTML=`<span class="t">${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(),3)}</span>`
    +`<span class="sc sc-${sc}">${esc(e.scope.slice(0,4))}</span>`
    +`<span class="k" title="${esc(e.trace)}">${esc(e.kind)}</span>`
    +`<span class="sg">${e.signed?'✓':''}</span>`;
  tape.insertBefore(li,tape.firstChild);
  while(tape.children.length>180) tape.removeChild(tape.lastChild);
  // counters: the event's kernel-scope record + that kernel's telemetry-feed record
  S.evCount++; S.epsWin.push(performance.now());
  const km=S.mapByKernel[e.kernel]||{}; const rid=km[e.scope];
  if(rid) bump(rid,e.t);
  if(km.telemetry && km.telemetry!==rid) bump(km.telemetry,e.t);
}
function bump(id,t){
  const r=S.recs.get(id); if(!r) return;
  r.events++; r.lastT=t||Date.now(); r.spark[r.spark.length-1]++; r._dirty=true;
}
function rollBuckets(){ for(const id of S.order){ const r=S.recs.get(id);
  const recent=r.spark.slice(-6).reduce((a,b)=>a+b,0); r.rate=recent/(6*BUCKET_MS/1000);
  r.spark.push(0); if(r.spark.length>SPARK_N) r.spark.shift(); r._dirty=true; } }

// Replay the captured run from the start: reset counters to 0 so they climb back to the
// SAME real totals (never inflated beyond the actual run). Discovery is untouched.
function replay(){
  S.rIdx=0; S.replayDone=false; S.lastEmit=0; S.evCount=0; S.epsWin=[]; $('#tape').innerHTML='';
  for(const id of S.order){ const r=S.recs.get(id); r.events=0; r.lastT=0; r.spark=new Array(SPARK_N).fill(0); r.rate=0; r._dirty=true; }
  const fm=$('#feedmode'); fm.textContent='REPLAY'; fm.classList.remove('live'); refreshTicker();
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
  html+=H('Access · '+esc(tier))+_ladderBar(r._effective_level||'discover')
    +kv('Visibility tier',`<span class="tier-pill t-${esc(tier)}">${esc(tier)}</span>`)
    +kv('Min to discover','discover')+kv('Min to read','read (operator token / owner)');
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
  if(!models||!models.length) return '<div class="l2">idle — no model activity in the last telemetry tick</div>';
  return models.slice(-8).reverse().map((m)=>{
    const lbl=PURPOSE_LABEL[m.purpose]||m.purpose;
    return `<div class="grant"><span class="l2"><span class="livedot2"></span>${esc(lbl)}</span>`
      +`<span><code>${esc(m.model)}</code></span></div>`;
  }).join('');
}
function renderPersonaLive(pid){
  const d=S.liveByPersona.get(_shortId(pid)); if(!d) return '<div class="l2">— no live telemetry yet (idle or not streaming) —</div>';
  const s=d.summary||{}; let h='';
  if(s.lifecycle_state!=null||s.fitness!=null){
    h+=`<div class="livegrid">`
      +`<div class="lm"><div class="lmv ${s.lifecycle_state==='ACTIVE'?'ok':''}">${esc(s.lifecycle_state||'—')}</div><div class="lmk">state</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.experience_tasks??0)}</div><div class="lmk">tasks</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.tactic_count??s.cohort_visible_tactic_count??0)}</div><div class="lmk">tactics</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.lesson_count??0)}</div><div class="lmk">lessons</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.memory_count??0)}</div><div class="lmk">memory</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.fitness!=null?Number(s.fitness).toFixed(1):'—')}</div><div class="lmk">fitness</div></div>`
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
    h+=`<div class="l2" style="margin:3px 0">Lineage events (signed)</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>
        `<div class="grant"><span class="l2">${esc(k)}</span><span class="ok">${esc(v)}</span></div>`).join('');
  }
  h+=`<div class="l2" style="margin:6px 0 3px">Model activity in this env</div>`+_liveFeed(d.models);
  return h;
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
  h+=`<div class="livegrid">`
    +`<div class="lm"><div class="lmv ${s.lifecycle_state==='ACTIVE'?'ok':''}">${esc(s.lifecycle_state||'—')}</div><div class="lmk">state</div></div>`
    +`<div class="lm"><div class="lmv">${esc(s.experience_tasks??0)}</div><div class="lmk">tasks</div></div>`
    +`<div class="lm"><div class="lmv">${esc(s.tactic_count??s.cohort_visible_tactic_count??0)}</div><div class="lmk">tactics</div></div>`
    +`<div class="lm"><div class="lmv">${esc(s.lesson_count??0)}</div><div class="lmk">lessons</div></div>`
    +`<div class="lm"><div class="lmv">${esc(s.memory_count??0)}</div><div class="lmk">memory</div></div>`
    +`<div class="lm"><div class="lmv">${esc(s.fitness!=null?Number(s.fitness).toFixed(1):'—')}</div><div class="lmk">fitness</div></div>`
    +`</div>`;
  if(s.evolution_trace_count!=null||s.accepted_trace_count!=null)
    h+=`<div class="l2" style="margin:4px 0 0">evolution: ${esc(s.accepted_trace_count??0)}/${esc(s.evolution_trace_count??0)} accepted trials · cohort ${esc((s.gepa_cohort_id||'—').slice(0,18))}</div>`;
  h+=`<div class="l2" style="margin:6px 0 3px">Doing now <span class="dim">(own feed · redacted tier)</span></div>`+_liveFeed(feedModels(doc));
  const sp=doc.spans||[];
  if(sp.length){ const counts={}; sp.forEach((x)=>{const k2=(x.attributes||{})['personaos.lineage.event_kind']||x.name||'SPAN'; counts[k2]=(counts[k2]||0)+1;});
    h+=`<div class="l2" style="margin:6px 0 3px">Signed lifecycle/lineage</div>`
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
    h+=`<div class="l2" style="margin:3px 0">Lineage events (signed · this env)</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k2,v])=>
        `<div class="grant"><span class="l2">${esc(k2)}</span><span class="ok">${esc(v)}</span></div>`).join(''); }
  h+=`<div class="l2" style="margin:6px 0 3px">Model activity in this env <span class="dim">(own feed)</span></div>`+_liveFeed(feedModels(doc));
  return h;
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
const bundleRecId=()=>S.order.find((id)=>{ const r=S.recs.get(id); return r.kind==='artifact' && r._links && r._links.bundle; });
const envRecId=()=>S.order.find((id)=>S.recs.get(id).kind==='env');

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
  html+=trustPanel(r);
  const eid=envRecId(), bid=bundleRecId(); let nav='';
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
  if(L.bundle) nav+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(L.bundle)}">Deliverable bundle →</a></div>`;
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
  if(!d) return {title:'bundle', html:'<div class="l2">unavailable</div>'};
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
  add('Size',fmtBytes(ctx.realSize));
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
  const ctx={ base, path, url, title, kind, ext:pick.ext, text, realSize,
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
  if(personas.length){
    html+=H(`Persona evolution (${personas.length})`);
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
  catch(e){ return {status:0,body:{error:String(e&&e.message||e)}}; } }

async function operatorView(){
  const m=opTokens(); const bases=Object.keys(m);
  let html=H('Operator authority — a bearer token, never network position')
    +`<div class="desc2">Each node mints a per-install token (printed at boot; stored at `
    +`<code>runs/…/_operator/token</code>). Paste it here to unlock that node's owner intake `
    +`(ASK / FUND / STOP), full status, runs, personas and the read-gated run tree. Without a `
    +`token this page shows each node's public discovery projection only — by design.</div>`;
  html+=H('Add a node')+`<div class="opform">`
    +`<input id="op-base" type="url" placeholder="node base URL, e.g. http://localhost:8765" value="${esc(opBaseKey(peerList()[0]||''))}">`
    +`<input id="op-token" type="password" placeholder="operator token">`
    +`<button class="btn" data-act="op-save">SAVE</button></div>`;
  html+=H(`Operator nodes (${bases.length})`);
  for(const b of bases){ html+=`<div class="grant"><span>${esc(b)}</span>`
    +`<span><a href="#" data-act="op-node" data-base="${esc(b)}">console →</a> · `
    +`<a href="#" data-act="op-del" data-base="${esc(b)}">forget ✕</a></span></div>`; }
  if(!bases.length) html+=`<div class="l2">no operator tokens saved — this browser is an anonymous public viewer</div>`;
  return {title:`<span class="kind k-env">OPERATOR</span> console`,html};
}

async function operatorNodeView(b){
  const st=await fetchJson(join(b,'status'))||{};
  const pub=st.schema==='personaos-node-status-public/1';
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  let html='';
  if(pub) html+=`<div class="desc2"><span class="no">token missing or rejected</span> — the node returned its public projection. Re-save the token in the operator console.</div>`;
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
  html+=H('Ask the node — owner intake')
    +`<div class="opform"><textarea id="op-task" rows="3" placeholder="any task in any field — the domain emerges at runtime"></textarea>`
    +`<div class="oprow"><input id="op-budget" type="number" min="1" placeholder="budget (optional)">`
    +`<button class="btn" data-act="op-ask" data-base="${esc(b)}">⚡ ASK</button>`
    +`<button class="btn" data-act="op-fund" data-base="${esc(b)}">💰 FUND</button>`
    +`<input id="op-run-target" placeholder="run id (stop / fund target, optional)">`
    +`<button class="btn" data-act="op-stop" data-base="${esc(b)}">⏹ STOP</button></div>`
    +`<pre id="op-out" class="opout"></pre></div>`;
  return {title:`<span class="kind k-env">OPERATOR</span> ${esc(st.node_id||b)}`,html};
}

async function operatorRunView(b,run){
  const st=await fetchJson(join(b,'runs/'+encodeURIComponent(run)))||{};
  const arts=await fetchJson(join(b,'runs/'+encodeURIComponent(run)+'/artifacts'))||{};
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  const rs=st.run_state||{};
  const stt=String(rs.status||'—');
  const stClass=(stt==='shipped'||stt==='completed'||rs.accepted)?'ok':(stt==='running'||stt==='queued'?'amber':'no');
  let html=kv('Run',`<code>${esc(run)}</code>`)
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
  S.drawerLiveKind=null; S.drawerLiveId=null; S.drawerLiveFeed=null; S.drawerLiveBase='';   // the view sets these if it streams
  $('#detailbody').innerHTML='<div class="l2">resolving…</div>';
  let v; try{ v=await top(); }catch(e){ v={title:'error',html:'<div class="l2">'+esc(e.message)+'</div>'}; }
  $('#detail-title').innerHTML=v.title; $('#detailbody').innerHTML=v.html;
  $('#detailback').hidden=S.views.length<=1; $('#detailbody').scrollTop=0;
  // optional async post-mount step (media renderers paint into a container here)
  if(typeof v.mount==='function'){ try{ await v.mount($('#detailbody')); }catch(e){} }
}
function pushView(fn){ S.views.push(fn); renderTop(); }
function openDetail(id){ S.views=[()=>viewFor(id)]; $('#detailwrap').classList.add('open'); renderTop(); }

let lastBucket=0;
function tick(now){
  if(!S.paused && !S.replayDone && S.events.length){
    if(!S.lastEmit) S.lastEmit=now;
    let guard=0;
    while(guard++<50){
      const e=S.events[S.rIdx];
      if(now-S.lastEmit < e.gap) break;
      S.lastEmit=now; emitOne(); S.rIdx++;
      if(S.rIdx>=S.events.length){ // play the captured run ONCE → counters now equal the REAL totals
        S.replayDone=true; const fm=$('#feedmode'); fm.textContent='REPLAY · done'; fm.classList.remove('live'); break; }
    }
  }
  if(now-lastBucket>BUCKET_MS){ lastBucket=now; rollBuckets(); refreshTicker(); renderMissions(); }
  S.epsWin=S.epsWin.filter((t)=>now-t<1000);
  paintDirty(); renderStats();
  requestAnimationFrame(tick);
}

/* ---------- rendering ---------- */
function sparkSVG(arr){ const w=70,h=16,max=Math.max(1,...arr); const step=w/(arr.length-1);
  const pts=arr.map((v,i)=>`${(i*step).toFixed(1)},${(h-1-(v/max)*(h-2)).toFixed(1)}`).join(' ');
  const up=arr[arr.length-1]>=arr[arr.length-2]; const col=up?'var(--up)':'var(--down)';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${col}" stroke-width="1.2" points="${pts}"/></svg>`; }
function relTime(t){ if(!t) return '—'; const s=(Date.now()-t)/1000;
  if(s<60) return s.toFixed(0)+'s'; if(s<3600) return (s/60).toFixed(0)+'m'; return (s/3600).toFixed(0)+'h'; }

// The live "doing now" cell for a persona/env board row, from the per-entity
// telemetry index — so the board itself streams what each persona/env is doing
// without opening the drawer. Other kinds fall back to ACTIVE/listed.
function _rowStatusCell(r){
  const live=r.rate>0.05;
  // A telemetry record's SUBJECT rides in its canonical DID
  // (did:…/telemetry/<subject_id>) — labels may carry a human env NAME, so the
  // DID is the mapping key and the label suffix is only a fallback.
  let subjectId;
  if(r.kind==='telemetry'){
    const m=/\/telemetry\/(.+)$/.exec(r.did||'');
    subjectId=_shortId(m?m[1]:(r.label||'').replace(/^(live )?telemetry:/,''));
  } else subjectId=_shortId(r.did||r.record_id||r.id);
  if(r.kind==='persona'||r.kind==='env'||r.kind==='telemetry'){
    const d=(r.kind==='persona'?S.liveByPersona.get(subjectId)
      :r.kind==='env'?S.liveByEnv.get(subjectId)
      :(S.liveByPersona.get(subjectId)||S.liveByEnv.get(subjectId)));
    const models=d&&d.models; const last=models&&models[models.length-1];
    if(last){
      const lbl=PURPOSE_LABEL[last.purpose]||last.purpose;
      return `<span class="dot live">●</span><span class="live" title="${esc(last.model)}">${esc(lbl)}</span>`;
    }
    if(d&&d.summary){
      const st=d.summary.lifecycle_state||'';
      if(st&&st!=='ACTIVE') return `<span class="dot idle">●</span><span class="idle">${esc(st.toLowerCase())}</span>`;
    }
  }
  return `<span class="dot ${live?'live':'idle'}">●</span>${live?'<span class="live">ACTIVE</span>':'<span class="idle">listed</span>'}`;
}
function rowHTML(r){
  const net=(r._net==='p2p'?'<span class="n i">P2P</span>':'')
    +r.planes.map((p)=>p==='internet'?'<span class="n i">DHT</span>':'<span class="n m">mDNS</span>').join('');
  const live=r.rate>0.05;
  return `<td class="l"><span class="sym" title="${esc(r.did)}">${esc(r.label)}</span><div class="did">${esc((r.did||'').slice(0,30))} · ${esc((r._kernel||'').slice(0,16))}</div></td>`
    +`<td><span class="kind k-${esc(r.kind)}">${esc(KIND_LABEL[r.kind]||r.kind)}</span></td>`
    +`<td class="tier">${esc(r.visibility_tier)}</td>`
    +`<td class="net">${net}</td>`
    +`<td class="ok">✓</td>`
    +`<td class="r num events" data-c="events">${r.events}</td>`
    +`<td class="r num rate" data-c="rate">${r.rate.toFixed(2)}</td>`
    +`<td class="r last" data-c="last">${relTime(r.lastT)}</td>`
    +`<td class="spark" data-c="spark">${sparkSVG(r.spark)}</td>`
    +`<td class="status" data-c="status">${_rowStatusCell(r)}</td>`;
}
function visible(){ let ids=S.order.filter((id)=>{ const r=S.recs.get(id);
  if(S.plane!=='all' && !r.planes.includes(S.plane)) return false;
  if(S.kind!=='all' && r.kind!==S.kind) return false;
  if(S.q){ const h=[r.label,r.kind,r.did,r._kernel,r.visibility_tier].join(' ').toLowerCase(); if(!h.includes(S.q)) return false; }
  return true; });
  const k=S.sort; ids.sort((a,b)=>{ const ra=S.recs.get(a),rb=S.recs.get(b);
    if(k==='label'||k==='kind') return S.dir*String(ra[k]).localeCompare(String(rb[k]));
    if(k==='tier') return S.dir*String(ra.visibility_tier).localeCompare(String(rb.visibility_tier));
    return S.dir*((ra[k]||0)-(rb[k]||0)); });
  return ids;
}
function buildRows(){
  const tb=$('#rows'); const ids=visible(); const have=new Set();
  for(const id of ids){ const r=S.recs.get(id); have.add(id);
    if(!r._tr){ r._tr=document.createElement('tr'); r._tr.id='r-'+id; r._tr.innerHTML=rowHTML(r); tb.appendChild(r._tr); r._new=false; }
  }
  // order + prune
  ids.forEach((id)=>tb.appendChild(S.recs.get(id)._tr));
  for(const id of S.order){ const r=S.recs.get(id); if(r._tr && !have.has(id) && r._tr.parentNode) r._tr.remove(); }
  renderKindFilter();
}
function paintDirty(){
  for(const id of S.order){ const r=S.recs.get(id); if(!r._dirty||!r._tr){ r._dirty=false; continue; } r._dirty=false;
    const tr=r._tr; const ec=tr.querySelector('[data-c=events]');
    if(ec && +ec.textContent!==r.events){ ec.textContent=r.events; ec.classList.remove('up'); void ec.offsetWidth; ec.classList.add('up'); }
    const rc=tr.querySelector('[data-c=rate]'); if(rc) rc.textContent=r.rate.toFixed(2);
    const lc=tr.querySelector('[data-c=last]'); if(lc) lc.textContent=relTime(r.lastT);
    const sp=tr.querySelector('[data-c=spark]'); if(sp) sp.innerHTML=sparkSVG(r.spark);
    const st=tr.querySelector('[data-c=status]');
    if(st) st.innerHTML=_rowStatusCell(r);
  }
  // Persona/env/telemetry rows stream their live "doing now" cell every tick even
  // when their event counter did not change (the activity comes from telemetry).
  for(const id of S.order){ const r=S.recs.get(id);
    if(!r._tr||(r.kind!=='persona'&&r.kind!=='env'&&r.kind!=='telemetry')) continue;
    const st=r._tr.querySelector('[data-c=status]'); if(st) st.innerHTML=_rowStatusCell(r); }
}
let statCache={};
function setStat(el,label,val){ const v=$(el);
  if(!v){ return; } if(statCache[el]!==val){ statCache[el]=val; v.querySelector('.v').textContent=val;
    const node=v.querySelector('.v'); node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash'); } }
function renderStats(){
  const box=$('#stats');
  if(!box.dataset.built){ box.dataset.built='1';
    box.innerHTML=['auth','personas','pop','records','kernels','events','evs','verified','clock'].map((k)=>{
      const lbl={evs:'ev/s',clock:'utc',pop:'pop',auth:'access'}[k]||k;
      const init=k==='pop'?'—':(k==='auth'?'discover':'0');
      return `<div class="stat" id="st-${k}"><div class="v">${init}</div><div class="k">${lbl}</div></div>`;
    }).join(''); }
  let personas=0,verified=0; for(const id of S.order){ const r=S.recs.get(id); if(r.kind==='persona')personas++; verified++; }
  const eps=S.epsWin.length;
  // Population: the served /status.population is an INTEGER (effective size);
  // genesis_rate_today + max_lineage_depth ride alongside. Accept the integer or
  // a legacy {current,ceiling} object.
  let pop='—';
  for(const [,hit] of statusCache){ const v=hit&&hit.v; if(!v) continue;
    const pv=v.population;
    if(typeof pv==='number'){ pop=String(pv); break; }
    if(pv&&typeof pv==='object'){ pop=`${pv.current??'?'}/${pv.ceiling??'?'}`; break; }
    if((v.personas||[]).length){ pop=String(v.personas.length); break; } }
  // GAP #4: viewer authority — discover (anonymous) vs read (operator token saved).
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  setStat('#st-auth','access',hasOp?'read':'discover');
  const authV=$('#st-auth'); if(authV){ authV.classList.toggle('auth-read',hasOp); authV.title=hasOp?'operator token saved — read-level views unlocked':'anonymous — discover-level public projection only'; }
  setStat('#st-personas','personas',personas);
  setStat('#st-pop','pop',pop);
  setStat('#st-records','records',S.recs.size);
  setStat('#st-kernels','kernels',S.kernels.size||1);
  setStat('#st-events','events',S.evCount.toLocaleString());
  setStat('#st-evs','evs',eps);
  setStat('#st-verified','verified',verified);
  const d=new Date(); const cv=$('#st-clock .v');  // clock updates silently (no per-second flash)
  if(cv) cv.textContent=`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  $('#eps').textContent=eps+' ev/s';
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
  for(const id of S.order){ const r=S.recs.get(id); const L=r._links||{};
    if(r.kind==='mission'||(r.kind==='artifact'&&_isMissionDoc(r,L))){
      // the PROJECT record from the same kernel carries the human task text
      const proj=S.order.map((x)=>S.recs.get(x)).find((p)=>p&&p.kind==='project'&&p._kernel===r._kernel);
      cards.push({key:'rec:'+id,task:(proj&&proj.label)||r.label||'mission',state:'shipped',
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
    `<div class="mcard"${c.recId?` data-mrec="${esc(c.recId)}"`:''}${c.run?` data-mrun="${esc(c.run)}" data-mbase="${esc(c.base||'')}"`:''}>`
    +`<span class="mtask" title="${esc(c.task)}">${esc(c.task)}</span>`
    +`<span class="mmeta"><span class="mstate ms-${esc(c.state)}">${esc(c.state.toUpperCase())}</span>`
    +c.meta.filter(Boolean).map((m)=>`<span>${esc(m)}</span>`).join('')+`</span></div>`).join('');
  if(wrap.dataset.h!==html){ wrap.dataset.h=html; wrap.innerHTML=html; }
}

// Build the scrolling ticker ONCE per discovery (stable structure → smooth CSS scroll);
// counts are refreshed in place by refreshTicker() without restarting the animation.
function buildTicker(){
  const item=(r)=>`<span class="tk"><span class="badge">${esc((KIND_LABEL[r.kind]||r.kind).slice(0,3))}</span>`
    +`<b>${esc((r.label||'').slice(0,18))}</b> <span class="u" data-tkc="${esc(r.id)}">${r.events}</span></span>`;
  const html=S.order.map((id)=>item(S.recs.get(id))).join('');
  $('#ticker').innerHTML=html+html;  // duplicated for a seamless -50% scroll loop
}
function refreshTicker(){
  document.querySelectorAll('[data-tkc]').forEach((el)=>{ const r=S.recs.get(el.getAttribute('data-tkc'));
    if(r){ el.textContent=r.events; el.className=r.rate>0.05?'u':'d'; } });
}
function renderKindFilter(){ const box=$('#kind-filter'); const kinds=[...new Set(S.order.map((id)=>S.recs.get(id).kind))].sort();
  const want=['all',...kinds]; if(box.dataset.k===want.join(',')) return; box.dataset.k=want.join(',');
  box.innerHTML=want.map((k)=>`<button data-kind="${esc(k)}" class="chip${k===S.kind?' on':''}">${esc(k==='all'?'ALL':(KIND_LABEL[k]||k))}</button>`).join(''); }

/* ---------- wiring ---------- */
function wire(){
  $('#q').addEventListener('input',(e)=>{ S.q=e.target.value.toLowerCase(); buildRows(); });
  $('#plane-filter').addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b)return;
    S.plane=b.dataset.plane; [...e.currentTarget.children].forEach((c)=>c.classList.toggle('on',c===b)); buildRows(); });
  $('#kind-filter').addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b)return;
    S.kind=b.dataset.kind; [...e.currentTarget.children].forEach((c)=>c.classList.toggle('on',c===b)); buildRows(); });
  document.querySelectorAll('th[data-sort]').forEach((th)=>th.addEventListener('click',()=>{
    const k=th.dataset.sort; if(S.sort===k) S.dir*=-1; else { S.sort=k; S.dir=(k==='label'||k==='kind'||k==='tier')?1:-1; } buildRows(); }));
  $('#pause').addEventListener('click',()=>{ S.paused=!S.paused; $('#pause').textContent=S.paused?'▶ RESUME':'⏸ PAUSE';
    $('#livedot').style.background=S.paused?'var(--mut)':'var(--up)'; });
  $('#replay').addEventListener('click',replay);
  $('#addpeer').addEventListener('click',()=>{ const v=$('#peer').value.trim(); if(!v)return; let s=[];
    try{ s=JSON.parse(localStorage.getItem('personaos_peers')||'[]'); }catch(e){} if(!s.includes(v))s.push(v);
    localStorage.setItem('personaos_peers',JSON.stringify(s)); discover().then(buildRows); });
  $('#opbtn').addEventListener('click',()=>{ S.views=[()=>operatorView()];
    $('#detailwrap').classList.add('open'); renderTop(); });
  updateOpBadge();
  // "what is this" intro: shown until dismissed once; the ？ button re-toggles it.
  const hb=$('#helpbtn'), intro=$('#intro');
  if(hb&&intro){
    intro.hidden=!!localStorage.getItem('personaos_intro_seen');
    hb.addEventListener('click',()=>{ intro.hidden=!intro.hidden;
      localStorage.setItem('personaos_intro_seen','1'); });
  }
  // missions strip → open the mission record, or the operator run console when
  // the card came from a token-gated /status (running/paused mission).
  const mc=$('#missionCards');
  if(mc) mc.addEventListener('click',(e)=>{ const c=e.target.closest('.mcard'); if(!c) return;
    if(c.dataset.mrec){ openDetail(c.dataset.mrec); return; }
    if(c.dataset.mrun){ S.views=[()=>operatorRunView(c.dataset.mbase||'',c.dataset.mrun)];
      $('#detailwrap').classList.add('open'); renderTop(); } });
  // click any record row → detail drawer (deep-resolves env members, persona profile, artifacts)
  $('#rows').addEventListener('click',(e)=>{ const tr=e.target.closest('tr'); if(!tr||!tr.id) return; openDetail(tr.id.replace(/^r-/,'')); });
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
    if(act==='op-ask'||act==='op-fund'||act==='op-stop'){ const b2=a.dataset.base, out=$('#op-out');
      const show=(r)=>{ if(out) out.textContent=`HTTP ${r.status}\n`+JSON.stringify(r.body,null,1).slice(0,1600); };
      if(act==='op-ask'){ const text=($('#op-task')?.value||'').trim(); if(!text){ if(out) out.textContent='enter a task first'; return; }
        const body={text}; const bd=+($('#op-budget')?.value||0); if(bd>0) body.budget=bd;
        if(out) out.textContent='submitting…'; opPost(b2,'task',body).then(show); }
      else if(act==='op-fund'){ const bd=+($('#op-budget')?.value||0); if(!(bd>0)){ if(out) out.textContent='enter a budget > 0'; return; }
        const body={budget:bd}; const run=($('#op-run-target')?.value||'').trim(); if(run) body.run=run;
        if(out) out.textContent='funding…'; opPost(b2,'budget',body).then(show); }
      else { const body={}; const run=($('#op-run-target')?.value||'').trim(); if(run) body.run=run;
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
  const closeLog=()=>$('#logmodal').classList.remove('open');
  const closeDetail=()=>$('#detailwrap').classList.remove('open');
  $('#logbtn').addEventListener('click',()=>$('#logmodal').classList.add('open'));
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
    if(P2P) P2P.announce(doc); classifyMap(); buildRows(); buildTicker(); renderStats(); }
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
  await discover();
  prefetchNodeStatuses();
  renderMissions();
  initP2P();   // start the real libp2p P2P node (non-blocking; HTTP discovery already populated the page)
  // periodic live re-discovery (genuinely re-resolves + re-verifies; ticks in new personas)
  setInterval(()=>{ discover().then(()=>{ buildRows(); renderMissions(); refreshLiveSection(); }).catch(()=>{}); }, 15000);
  // per-entity drawer feed + node run state: re-fetch on the node's live cadence
  // so the drawer and the missions strip stream without SSE.
  setInterval(()=>{ try{ refreshLiveSection(); prefetchNodeStatuses(); }catch(e){} }, 5000);
  requestAnimationFrame(tick);
})().catch((e)=>{ $('#status').textContent='discovery error: '+e.message; console.error(e); });
