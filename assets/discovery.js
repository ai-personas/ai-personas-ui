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
  bundleDirs:new Set(), bundleDirsOpen:new Set() };

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
    try{ appendTelemetryEvent(JSON.parse(ev.data||'{}'),base,boot,'LIVE_TELEMETRY'); }
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
const bundleRecId=()=>S.order.find((id)=>{ const r=S.recs.get(id); return r.kind==='artifact' && r._links && r._links.bundle; });
const envRecId=()=>S.order.find((id)=>S.recs.get(id).kind==='env');

async function personaView(r){ const base=r._base||'',L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v);
  S.curBase=base;
  // profile/export endpoints are not yet implemented — use live /status instead
  const ns=await fetchNodeStatus(base)||{};
  const pid=personaIdFromDid(r.did);
  const ps=(ns.personas||[]).find((p)=>p.persona_id===pid||p.persona_id===r.did||(pid&&(p.persona_id||'').endsWith(pid)))||{};
  const mi=ns.model_independence===true;
  const fitness=ps.fitness!=null?ps.fitness.toFixed(2):'—';
  const expTasks=ps.experience_tasks??'—';
  const state=ps.lifecycle_state||'—';
  const role=ps.role||'—';
  const modelId=ps.model||ps.assigned_model||ps.model_id||'—';
  let html=kv('Persona id',S0(r.did))
    +kv('Role',`<span class="cap">${esc(role)}</span>`)
    +kv('Lifecycle state',state==='ACTIVE'?`<span class="ok">● ACTIVE</span>`:`<span class="dim">${esc(state)}</span>`)
    +kv('Fitness',fitness==='—'?'—':`<span class="${parseFloat(fitness)>=0?'ok':'no'}">${esc(fitness)}</span>`)
    +kv('Experience tasks',S0(expTasks))
    +kv('Model',S0(modelId))
    +kv('Multi-family PoLL',mi?'<span class="ok">✓ yes</span>':'<span class="no">✗ no — single family</span>')
    +kv('Visibility',S0(r.visibility_tier))
    +kv('Signature','<span class="ok">✓ Ed25519 verified</span>');
  // Show sibling personas from /status for context
  if((ns.personas||[]).length>1){
    html+=H('All personas in run');
    html+=(ns.personas||[]).map((p)=>{
      const f=p.fitness!=null?p.fitness.toFixed(2):'—';
      const active=p.lifecycle_state==='ACTIVE';
      const me=p.persona_id===pid||(pid&&(p.persona_id||'').endsWith(pid));
      return `<div class="grant"><span>${me?'<b>':''}${esc(p.role||p.persona_id)}${me?'</b>':''}</span>`
        +`<span class="l2">fitness <span class="${parseFloat(f)>=0?'ok':'no'}">${esc(f)}</span>`
        +` · tasks ${esc(p.experience_tasks??0)}`
        +` · <span class="${active?'ok':'dim'}">${esc(p.lifecycle_state||'—')}</span></span></div>`;
    }).join('');
  }
  const eid=envRecId(), bid=bundleRecId(); let nav='';
  if(eid) nav+=`<div class="row">${recLink(eid,'Workspace (env) →')}</div>`;
  if(bid) nav+=`<div class="row">${recLink(bid,'Deliverable (bundle) →')}</div>`;
  if(nav) html+=H('Related')+nav;
  if(L.profile) html+=H('Source')+`<div class="row"><a href="${esc(join(base,L.profile))}" target="_blank" rel="noopener">signed persona card →</a></div>`;
  return {title:`<span class="kind k-persona">PERSONA</span> ${esc(role==='—'?r.label:role)}`, html};
}
async function envView(r){ const base=r._base||'',L=r._links||{}; S.curBase=base;
  // export endpoint not implemented — pull everything from live /status
  const ns=await fetchNodeStatus(base)||{};
  const pop=ns.population||{};
  const personas=ns.personas||[];
  const mi=ns.model_independence===true;
  const pfmm=ns.poll_family_minimum_met===true;
  const activeRun=ns.active_run||ns.current_run||'—';
  const genesisTriggered=!!(ns.genesis_triggered||ns.genesis_fired);
  const currentRound=ns.current_round||ns.round||'—';
  let html=kv('Environment',esc(r.did||r.label))
    +kv('Visibility',esc(r.visibility_tier))
    +kv('Population',`${pop.current??personas.length} / ${pop.ceiling??'—'}`)
    +kv('Genesis triggered',genesisTriggered?'<span class="ok">yes</span>':'<span class="dim">no</span>')
    +kv('Active run',esc(activeRun))
    +kv('Current round',esc(currentRound))
    +kv('Multi-family PoLL',pfmm?'<span class="ok">✓ met</span>':'<span class="no">✗ single-family — PoLL degraded</span>')
    +kv('Model independence',mi?'<span class="ok">✓ yes</span>':'<span class="no">✗ no</span>')
    +kv('Signature','<span class="ok">✓ Ed25519 verified</span>');
  if(personas.length){
    html+=H(`Personas (${personas.length})`);
    html+=personas.map((p)=>{
      const fit=p.fitness!=null?p.fitness.toFixed(2):'—';
      const active=p.lifecycle_state==='ACTIVE';
      const rid=findRecByDid(p.persona_id)||findRecByDid('did:personaos:'+p.persona_id);
      const label=rid?recLink(rid,p.role||p.persona_id):esc(p.role||p.persona_id);
      return `<div class="grant">${label}<span class="l2">`
        +`fitness <span class="${parseFloat(fit)>=0?'ok':'no'}">${esc(fit)}</span>`
        +` · tasks ${esc(p.experience_tasks??0)}`
        +` · <span class="${active?'ok':'dim'}">${esc(p.lifecycle_state||'—')}</span>`
        +`</span></div>`;
    }).join('');
  }
  const did=kernelRec(r._kernel,'domain'), pid=kernelRec(r._kernel,'project'); let nav='';
  if(did) nav+=`<div class="row">${recLink(did,'Domain →')}</div>`;
  if(pid) nav+=`<div class="row">${recLink(pid,'Project →')}</div>`;
  if(L.bundle) nav+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(L.bundle)}">Deliverable bundle →</a></div>`;
  if(nav) html+=H('Related')+nav;
  return {title:`<span class="kind k-env">ENV</span> ${esc(r.label)}`, html};
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
  const b=(d.bundle&&d.bundle.payload)||d.bundle||{}, arts=d.artifacts||[];
  let html=kv('Bundle',esc(b.bundle_id||''))+kv('Kind',esc(b.bundle_kind||'—'))
    +kv('State',`<span class="ok">${esc(b.state||'—')}</span>`)+kv('Version',esc(b.version||'—'))
    +kv('Owning env',esc(b.owning_env_id||'—'))+kv('Co-signers',esc(Object.keys(d.co_signatures||{}).join(', ')||'—'));
  const vinv=(d.verifier_invocations||[]).map((v)=>`${v.tier}:${v.passed?'✓':'✗'}`).join('  ');
  if(vinv) html+=H('Verifier cascade')+`<div class="desc2">${esc(vinv)}</div>`;
  html+=H(`Artifacts (${arts.length}) — click to view`)+renderArtifactTree(arts);
  if(L && L.run){ html+=H('Provenance')
    +`<div class="row"><a href="#" data-act="body" data-url="${esc(L.run)}">Body · codex model cascade →</a></div>`
    +`<div class="row"><a href="#" data-act="verify" data-url="${esc(L.run)}">Verification · cascade + safety floor →</a></div>`
    +`<div class="row"><a href="#" data-act="physical" data-url="${esc(L.run)}">Physical asset →</a></div>`;
    if(L.oci) html+=`<div class="row"><a href="#" data-act="dist" data-oci="${esc(L.oci)}" data-dag="${esc(L.dag||'')}" data-reg="${esc(L.registry||'')}">Distribution · OCI + IPLD →</a></div>`; }
  return {title:`<span class="kind k-artifact">BUNDLE</span> ${esc(b.bundle_id||'')}`, html};
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
async function telemetryView(r){ const base=r._base||'',L=r._links||{}; S.curBase=base;
  // summary endpoint not implemented — use /status + telemetry/live/latest.json
  const ns=await fetchNodeStatus(base)||{};
  const tel=await fetchJson(join(base,'telemetry/live/latest.json'))||{};
  const events=tel.events||tel.ring||[];
  const activeRun=ns.active_run||ns.current_run||'—';
  const currentRound=ns.current_round||ns.round||'—';
  // tally event purposes / kinds from the ring buffer
  const purposeCounts={};
  for(const e of events){ const p=e.purpose||e.event_type||e.kind||e.event||'other'; purposeCounts[p]=(purposeCounts[p]||0)+1; }
  const topPurposes=Object.entries(purposeCounts).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const modelEvents=events.filter((e)=>(e.event||e.event_type||'').includes('MODEL')||(e.purpose||'').includes('model'));
  let html=kv('Feed',esc(r.label))
    +kv('Active run',esc(activeRun))
    +kv('Current round',esc(currentRound))
    +kv('Ring buffer events',esc(events.length))
    +kv('Model call events',esc(modelEvents.length))
    +kv('Access','consent-gated (read+ &amp; ConsentLedger pin)')
    +kv('Signature','<span class="ok">✓ Ed25519 verified</span>');
  if(topPurposes.length){
    html+=H('Event purposes (ring)');
    html+=topPurposes.map(([k,v])=>`<div class="grant"><span>${esc(k)}</span><span class="ok">${esc(v)}</span></div>`).join('');
  } else {
    html+=H('Event purposes')+`<span class="l2">ring empty — node idle or not yet streaming</span>`;
  }
  const recentModel=modelEvents.slice(-6).reverse();
  if(recentModel.length){
    html+=H('Recent model calls');
    html+=recentModel.map((e)=>`<div class="grant"><span class="l2">${esc(e.event||e.event_type||'')}</span><span>${esc(e.model||e.model_id||'—')}</span></div>`).join('');
  }
  if(L.snapshot) html+=H('Source')+`<div class="row"><a href="${esc(join(base,L.snapshot))}" target="_blank" rel="noopener">telemetry snapshot →</a></div>`;
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
async function domainView(r){ const base=r._base||'',L=r._links||{}; S.curBase=base;
  const d=await dfetch(base,L.export)||{}; const dm=(d.domain&&d.domain.payload)||d.domain||{};
  const rj=await dfetch(base,L.run||'run.json')||{}; const dd=rj.domain||{};
  let html=kv('Domain',esc(dm.domain_id||r.did))+kv('Origin',esc(dm.origin||'emergent'))+kv('Stage',esc(dm.stage||'—'))
    +kv('Trust score',esc(dm.trust_score??'—'))+kv('Safety critical',dm.safety_critical?'<span class="no">● yes</span>':'no')
    +kv('Physical harm',esc(dm.physical_harm_class||'—'))+kv('Info hazard',esc(dm.information_hazard_class||'—'))
    +kv('Signature','<span class="ok">✓ Ed25519 verified</span>');
  const sx=(d.safety_extensions||[]).map(String); if(sx.length){ const m=/description='([^']+)'/.exec(sx[0]);
    html+=H('Safety extension')+`<div class="desc2">${esc((m?m[1]:sx[0]).slice(0,420))}</div>`; }
  if((dd.kinds||[]).length) html+=H(`Emergent kinds (${dd.kinds.length})`)+chipsOf(dd.kinds.slice(0,18));
  const tools=dm.tools_required||dd.tools||[]; if(tools.length) html+=H(`Tools required (${tools.length})`)+chipsOf(tools.slice(0,18));
  if((dm.standards_refs||[]).length) html+=H('Standards')+chipsOf(dm.standards_refs);
  if(rj.recognition) html+=H('Recognition → emergence')+chipsOf(rj.recognition);
  const eid=kernelRec(r._kernel,'env'); if(eid) html+=H('Used by')+`<div class="row">${recLink(eid,'Environment →')}</div>`;
  return {title:`<span class="kind k-domain">DOMAIN</span> ${esc(dm.name||r.label)}`, html};
}
async function projectView(r){ const base=r._base||'',L=r._links||{}; S.curBase=base;
  const d=await dfetch(base,L.export)||{}; const p=(d.project&&d.project.payload)||d.project||{};
  let html=kv('Project',esc(p.project_id||r.did))+kv('Name',esc(p.name||r.label))+kv('Status',`<span class="ok">${esc(p.status||'—')}</span>`)
    +kv('Environment',esc(p.env_id||'—'))+kv('Signature','<span class="ok">✓ Ed25519 verified</span>');
  let nav=''; const eid=kernelRec(r._kernel,'env'), did=kernelRec(r._kernel,'domain');
  if(eid) nav+=`<div class="row">${recLink(eid,'Environment →')}</div>`;
  if(did) nav+=`<div class="row">${recLink(did,'Domain →')}</div>`;
  if(L.bundle) nav+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(L.bundle)}">Deliverable bundle →</a></div>`;
  if(nav) html+=H('Related')+nav;
  return {title:`<span class="kind k-project">PROJECT</span> ${esc(p.name||r.label)}`, html};
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
async function missionView(r){
  // The ADR-0071 refinement trajectory is a DISCOVERED, Ed25519-verified Design-
  // History-File artifact; resolve its content (the trajectory JSON) the same way
  // any artifact body is resolved over P2P — no client-side injection.
  const L=r._links||{}; let ref={};
  try{ ref=JSON.parse(await fetchText(join(r._base||'', L.content))||'{}'); }catch(e){ ref={}; }
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  const targets=ref.objective_targets||[]; const traj=ref.trajectory||[]; const tr=ref.tranches||[];
  const fin=ref.final_objective||{};
  let html=H('ADR-0071 ContinuousRefinementMission — anytime, budget-scaled, convergence-bounded');
  html+=kv('Task',S0(ref.task))+kv('Backend',S0(ref.backend))
    +kv('State',`<span class="ok">${S0(ref.final_state)}</span>`)
    +kv('Status',`<span class="ok">${S0(ref.final_status)}</span>`)
    +kv('Converged',ref.converged?'<span class="ok">yes — nothing left to improve</span>':'no (auto-reopen-eligible)')
    +kv('Best-so-far',S0(ref.best_so_far_ref)+' · score '+(ref.best_so_far_score!=null?Number(ref.best_so_far_score).toFixed(4):'—'));
  // MissionObjective vector: baseline → current, per target.
  html+=H('MissionObjective (signed measurable targets)');
  html+=targets.map((t)=>{ const cur=fin[t.name]; const dir=t.direction==='minimize'?'↓':'↑';
    return `<div class="grant"><span>${esc(t.name)} ${dir} <span class="l2">(${esc(t.outcome_kind)})</span></span>`
      +`<span class="l2">base ${esc(t.baseline)} → <b class="ok">${esc(cur!=null?cur:t.current)}</b> · ideal ${esc(t.ideal)}</span></div>`; }).join('');
  // Budget tranches — "resume with more budget → measurably better best-so-far".
  html+=H('Budget tranches — resume with more budget → higher best-so-far');
  html+=tr.map((x)=>`<div class="grant"><span>tranche ${esc(x.tranche)} · budget ${esc(x.budget_candidates)} cand · ${esc(x.rounds_this_tranche)} rounds</span>`
    +`<span class="l2">score <b>${Number(x.score_before).toFixed(3)} → <span class="ok">${Number(x.score_after).toFixed(3)}</span></b> · [${esc(x.status)}]</span></div>`).join('');
  // Best-so-far climb (round trajectory) with marginal value.
  html+=H('Refinement trajectory (best-so-far never regresses)');
  html+='<div class="tape-mini">'+traj.map((r2)=>{ const blk=(r2.blocked_targets||[]).length?` <span class="down">blocked:${esc((r2.blocked_targets||[]).join(','))}</span>`:'';
    return `<div class="row2"><span>r${esc(r2.round)}</span><span>score <b>${Number(r2.best_score).toFixed(4)}</b></span>`
      +`<span class="${r2.marginal_value>=0?'ok':'down'}">Δ${Number(r2.marginal_value).toFixed(4)}</span>`
      +`<span class="l2">${esc(r2.candidates_explored)} cand${blk}</span></div>`; }).join('')+'</div>';
  // Budget→emergence (genesis of specialists / sub-envs under ReplicationBound).
  const em=(ref.emergence||[]).filter((e)=>e.event==='budget_to_emergence_genesis');
  if(em.length){ html+=H('Budget → emergence (16_POP §4A factor 7)');
    html+=em.map((e)=>{ const g=e.genesis||{};
      return `<div class="grant"><span>genesis: <b class="ok">${esc(g.niche)}</b> · sub-env ${esc((e.sub_env||{}).kind)}</span>`
        +`<span class="l2">pressure ${esc(e.pressure_score)} (admissible ${e.pressure_admissible?'✓':'✗'}) · ReplicationBound ceiling ${esc(g.replication_bound_population_ceiling)}</span></div>`; }).join(''); }
  if(ref.manufacturability_ceiling) html+=H('Manufacturability ceiling (honest)')+`<div class="l2">${esc(ref.manufacturability_ceiling)}</div>`;
  return {title:`<span class="kind k-mission">MISSION</span> ${esc(r.label)}`, html};
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
  let html=kv('Run',S0(run))+kv('Status',`<span class="${rs.status==='running'?'ok':''}">${S0(rs.status)}</span>`)
    +kv('Task',S0((rs.task||'').slice(0,160)));
  const dh=st.design_history; if(dh&&dh.final_status) html+=kv('Final',S0(dh.final_status))
    +kv('Best score',S0(dh.best_so_far_score!=null?Number(dh.best_so_far_score).toFixed(4):null));
  const files=arts.package_files||arts.files||[];
  if(files.length) html+=H(`Artifacts (${files.length})`)+files.slice(0,80).map((f)=>
    `<div class="grant"><span>${esc(typeof f==='string'?f:(f.path||f.title||''))}</span>`
    +`<span class="l2">${esc(typeof f==='object'?(f.size??''):'')}</span></div>`).join('');
  const ev=st.objective_evidence||(dh&&dh.objective_evidence);
  if(ev) html+=H('Objective evidence basis')+Object.entries(ev).map(([n,e2])=>
    `<div class="grant"><span>${esc(n)}</span><span class="l2">${esc((e2||{}).evidence_strength||'—')}</span></div>`).join('');
  return {title:`<span class="kind k-mission">RUN</span> ${esc(run)}`,html};
}

async function viewFor(id){ const r=S.recs.get(id); if(!r) return {title:'—',html:'not found'};
  const L=r._links||{};
  if(r.kind==='artifact' && L.media_kind==='design_history') return missionView(r);
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
  if(now-lastBucket>BUCKET_MS){ lastBucket=now; rollBuckets(); refreshTicker(); }
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
    +`<td class="status" data-c="status"><span class="dot ${live?'live':'idle'}">●</span>${live?'<span class="live">ACTIVE</span>':'<span class="idle">listed</span>'}</td>`;
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
    const st=tr.querySelector('[data-c=status]'); const live=r.rate>0.05;
    if(st) st.innerHTML=`<span class="dot ${live?'live':'idle'}">●</span>${live?'<span class="live">ACTIVE</span>':'<span class="idle">listed</span>'}`;
  }
}
let statCache={};
function setStat(el,label,val){ const v=$(el);
  if(!v){ return; } if(statCache[el]!==val){ statCache[el]=val; v.querySelector('.v').textContent=val;
    const node=v.querySelector('.v'); node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash'); } }
function renderStats(){
  const box=$('#stats');
  if(!box.dataset.built){ box.dataset.built='1';
    box.innerHTML=['personas','pop','records','kernels','events','evs','verified','clock'].map((k)=>
      `<div class="stat" id="st-${k}"><div class="v">${k==='pop'?'—/—':'0'}</div><div class="k">${k==='evs'?'ev/s':k==='clock'?'utc':k==='pop'?'pop':k}</div></div>`).join(''); }
  let personas=0,verified=0; for(const id of S.order){ const r=S.recs.get(id); if(r.kind==='persona')personas++; verified++; }
  const eps=S.epsWin.length;
  // non-blocking: pull population from any cached /status hit
  let pop='—/—';
  for(const [,hit] of statusCache){ if(hit&&hit.v&&hit.v.population){ const p=hit.v.population; pop=`${p.current??'?'}/${p.ceiling??'?'}`; break; } }
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
  initP2P();   // start the real libp2p P2P node (non-blocking; HTTP discovery already populated the page)
  // periodic live re-discovery (genuinely re-resolves + re-verifies; ticks in new personas)
  setInterval(()=>{ discover().then(buildRows).catch(()=>{}); }, 15000);
  requestAnimationFrame(tick);
})().catch((e)=>{ $('#status').textContent='discovery error: '+e.message; console.error(e); });
