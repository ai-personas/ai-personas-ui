import * as ed from './noble-ed25519.js';

const $=(s)=>document.querySelector(s);
const esc=(s)=>String(s??'').replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const enc=new TextEncoder();
const hexToBytes=(h)=>Uint8Array.from((h||'').match(/.{1,2}/g)?.map((b)=>parseInt(b,16))||[]);
const pad=(n,w=2)=>String(n).padStart(w,'0');
const KIND_LABEL={persona:'PERSONA',env:'ENV',project:'PROJECT',domain:'DOMAIN',artifact:'ARTIFACT',telemetry:'TELEMETRY',knowledge:'KNOWLEDGE',skill:'SKILL',tool:'TOOL'};
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
const join=(b,r)=>!b?r:b.replace(/\/$/,'')+'/'+r.replace(/^\//,'');
async function fetchJson(u){ try{ const r=await fetch(u,{cache:'no-store'}); if(!r.ok)return null; return await r.json(); }catch(e){ return null; } }
const planesOf=(t)=>['federation','public'].includes(t)?['internet','intranet']:['intranet'];

const S={ recs:new Map(), order:[], kernels:new Set(), events:[], emitted:0, rIdx:0, lastEmit:0,
  paused:false, sort:'events', dir:-1, plane:'all', kind:'all', q:'', epsWin:[], evCount:0, live:false,
  map:{}, mapByKernel:{}, telLoaded:new Set(), views:[], curBase:'' };

/* ---------- discovery log ---------- */
function log(tag,msg,ok){ const li=document.createElement('li');
  const c=ok===true?'ok':ok===false?'bad':'';
  li.innerHTML=`<span class="tag2">${esc(tag)}</span><span class="${c}">${esc(msg)}</span>`;
  $('#log').appendChild(li); }

/* ---------- discovery (runtime resolve + in-browser verify) ---------- */
async function discoverFrom(base,plane){
  const where=base||location.origin;
  log('bootstrap',`${where}/.well-known/personaos-discovery.json`);
  const boot=await fetchJson(join(base,'.well-known/personaos-discovery.json'));
  if(!boot){ log('bootstrap',`no endpoint at ${where}`,false); return {boot:null,found:[]}; }
  if(boot.kernel_id) S.kernels.add(boot.kernel_id);
  const keysDoc=await fetchJson(join(base,boot.keys_url||'.well-known/personaos-keys.json'));
  const keys={}; (keysDoc?.keys||[]).forEach((k)=>keys[k.key_id]=k.public_key_hex);
  const prov=await fetchJson(join(base,boot.providers_url||'discovery/providers.json'));
  const providers=prov?.providers||[];
  log('dht',`${boot.kernel_id||where}: ${providers.length} provider key(s)`);
  const found=[];
  for(const p of providers){
    const doc=await fetchJson(join(base,p.record_url)); if(!doc?.record){ continue; }
    const ok=await verifyRecord(doc,keys); const r=doc.record;
    log('verify',`${r.kind}: ${(r.label||p.did||'').slice(0,28)} — ${ok?'OK':'FAIL'}`,ok);
    if(ok) found.push({...r,_kernel:boot.kernel_id||'',_url:join(base,p.record_url),_access:doc.access_policy||{},_links:doc.links||{},_base:base,_plane:plane,
      _doc:{record:doc.record,signature_hex:doc.signature_hex,signing_key_id:doc.signing_key_id,public_key_hex:keys[doc.signing_key_id]||'',
            kernel_id:boot.kernel_id||'',base:base,links:doc.links||{},access_policy:doc.access_policy||{}}});
  }
  return {boot,found};
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
    planes:planesOf(r.visibility_tier),_kernel:r._kernel,_access:r._access,_url:r._url,_links:r._links||{},_base:r._base||'',_doc:r._doc,
    capability_summary:r.capability_summary||[],content_hash:r.content_hash||'',content_locator_ref:r.content_locator_ref||''});
}
function classifyMap(){ // per-kernel scope → record map so each kernel's events tick its own rows
  S.mapByKernel={}; const byKK={};
  for(const id of S.order){ const r=S.recs.get(id); const kk=byKK[r._kernel]=byKK[r._kernel]||{}; (kk[r.kind]=kk[r.kind]||[]).push(id); }
  for(const kid in byKK){ const bk=byKK[kid], first=(k)=>(bk[k]||[])[0];
    const bundle=(bk.artifact||[]).find((id)=>S.recs.get(id)._links&&S.recs.get(id)._links.bundle)||first('artifact');
    S.mapByKernel[kid]={persona:first('persona'),env:first('env'),domain:first('domain')||first('persona'),
      task:first('persona'),answer:first('persona'),project:first('project')||first('env'),
      bundle,artifact:bundle,telemetry:first('telemetry')}; }
}
async function discover(){
  $('#log').innerHTML=''; $('#status').textContent='bootstrapping discovery…';
  await loadPeersTxt();                                            // published peers.txt → TXT_PEERS
  const root=await fetchJson('.well-known/personaos-discovery.json')||{};
  const bases=[]; if(root.providers_url) bases.push('');           // single-run: this origin is a kernel
  for(const fk of (root.federated_kernels||[])) bases.push(fk);    // ecosystem: many kernel nodes
  if(!bases.length) bases.push('');
  S.telLoaded=S.telLoaded||new Set();
  for(const b of [...new Set([...bases, ...peerList()])]){
    const res=await discoverFrom(b,'internet'); res.found.forEach(upsert);
    if(res.boot && !S.telLoaded.has(b)){ await loadTelemetry(b); S.telLoaded.add(b); }   // aggregate each kernel's tape
  }
  classifyMap(); buildRows(); buildTicker(); renderStats();
  $('#status').innerHTML=`<span class="ok">${S.recs.size}</span> records discovered + Ed25519-verified across `
    +`<span class="ok">${S.kernels.size||1}</span> kernel(s) · internet (.well-known + Kademlia DHT) + intranet (mDNS) · access-gated`;
}

/* ---------- telemetry tape (replay of real signed spans) ---------- */
async function loadTelemetry(base){
  const boot=await fetchJson(join(base,'.well-known/personaos-discovery.json'));
  const url=boot?.telemetry_url||'telemetry/spans.json';
  const spans=await fetchJson(join(base,url));
  if(!Array.isArray(spans)||!spans.length){ return; }
  const kid=boot.kernel_id||base;
  const evs=spans.map((s)=>{ const a=s.attributes||{};
    return { t:Date.parse(s.ended_at||s.started_at||'')||0, kernel:kid,
      scope:String(a['personaos.lineage.scope']||(s.name||'').split('.').pop()||'other'),
      kind:String(a['personaos.lineage.event_kind']||s.name||'SPAN'), trace:String(a['personaos.trace_id']||s.span_id||''),
      signed:a['personaos.lineage.signed']!==false, ms:Number(a['personaos.lineage.append_ms']||0) }; })
    .filter((e)=>e.kind);
  // aggregate across kernels, re-sort by time, normalise inter-event gaps to a lively cadence
  S.events=(S.events||[]).concat(evs).sort((a,b)=>a.t-b.t);
  let prev=S.events[0]?.t||0;
  S.events.forEach((e)=>{ const g=e.t-prev; prev=e.t; e.gap=Math.max(90,Math.min(900,g||300)); });
  if(S.events.length) S.events[0].gap=0;
  log('telemetry',`+${evs.length} signed OTel spans (${S.events.length} total) for the live tape`);
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
async function fetchText(u){ try{ const r=await fetch(u,{cache:'no-store'}); if(!r.ok)return null; return await r.text(); }catch(e){ return null; } }
const kv=(l,v)=>`<div class="row"><span class="l2">${esc(l)}</span><span class="v2">${v}</span></div>`;
const H=(t)=>`<h4>${esc(t)}</h4>`;
const chipsOf=(a)=>`<div class="caps">${(a||[]).filter(Boolean).map((c)=>`<span class="cap">${esc(c)}</span>`).join('')||'<span class="l2">—</span>'}</div>`;
const recLink=(id,txt)=>`<a href="#" data-act="rec" data-id="${esc(id)}">${esc(txt)}</a>`;
const findRecByDid=(pid)=>S.order.find((id)=>{ const r=S.recs.get(id); return r.did==='did:personaos:'+pid||r.did===pid; });
const bundleRecId=()=>S.order.find((id)=>{ const r=S.recs.get(id); return r.kind==='artifact' && r._links && r._links.bundle; });
const envRecId=()=>S.order.find((id)=>S.recs.get(id).kind==='env');

async function personaView(r){ const base=r._base||'',L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v);
  S.curBase=base; const prof=await dfetch(base,L.profile), exp=await dfetch(base,L.export);
  const c=(prof&&prof.card)||{}, mc=(exp&&exp.memory_counts)||{};
  let html=kv('Persona id',S0(r.did))+kv('Name',S0(c.name||r.label))+kv('Archetype',S0(c.archetype))
    +kv('Disposition',S0(c.primary_disposition))+kv('Reputation',S0(c.reputation_score))
    +kv('Can lead cohorts',S0(c.can_lead_cohorts))+kv('Soul version',S0(c.soul_version))
    +kv('Visibility',S0(c.visibility||r.visibility_tier))+kv('Signature','<span class="ok">✓ Ed25519 verified</span>');
  if(c.description) html+=H('Description')+`<div class="desc2">${esc(c.description)}</div>`;
  html+=H('Accepted roles')+chipsOf(c.accepted_roles)+H('Interests')+chipsOf(c.advertised_interests)+H('Domain curatorships')+chipsOf(c.domain_curatorships);
  if(mc.entries!==undefined) html+=H('Memory')+kv('Entries',S0(mc.entries))+kv('Episodic',S0(mc.episodic))+kv('Semantic',S0(mc.semantic))+kv('Reflective',S0(mc.reflective));
  const eid=envRecId(), bid=bundleRecId(); let nav='';
  if(eid) nav+=`<div class="row">${recLink(eid,'Workspace (env) →')}</div>`;
  if(bid) nav+=`<div class="row">${recLink(bid,'Deliverable (bundle) →')}</div>`;
  if(nav) html+=H('Related')+nav;
  if(L.profile) html+=H('Source')+`<div class="row"><a href="${esc(join(base,L.profile))}" target="_blank" rel="noopener">signed persona card →</a></div>`;
  return {title:`<span class="kind k-persona">PERSONA</span> ${esc(c.name||r.label)}`, html};
}
async function envView(r){ const base=r._base||'',L=r._links||{}; S.curBase=base;
  const d=await dfetch(base,L.export)||{}; const env=d.environment||{}, mr=d.model_registry||{};
  const caps=mr.capabilities||[], active=(d.discovered_models||{}).active_model_id, members=d.members||[];
  const norms=((d.charter||{}).payload||{}).charter_text||[], rules=d.rules||[];
  let html=kv('Environment',esc(env.environment_id||r.did))+kv('Type',esc(env.type||'—'))
    +kv('Status',`<span class="ok">${esc(env.status||'—')}</span>`)+kv('Visibility',esc(env.visibility_tier||r.visibility_tier))
    +kv('Signature','<span class="ok">✓ Ed25519 verified</span>');
  html+=H(`Personas · members (${members.length})`)+(members.map((pid)=>{ const rid=findRecByDid(pid);
    return `<div class="grant">${rid?recLink(rid,pid):esc(pid)}<span class="l2">member</span></div>`; }).join('')||'<span class="l2">—</span>');
  html+=H(`Models available (${caps.length})`)+(caps.map((cp)=>`<div class="grant"><span>${esc(cp.model_id)}${cp.model_id===active?' <span class="ok">● active</span>':''}</span>`
    +`<span class="l2">${esc(cp.backend||'')} · ${esc(cp.provider||'')}</span></div>`).join('')||'<span class="l2">—</span>');
  if(norms.length) html+=H('Charter norms')+norms.map((n)=>`<div class="desc2">• ${esc(n)}</div>`).join('');
  if(rules.length) html+=H(`Env rules (${rules.length})`)+rules.map((ru)=>{ const p=ru.payload||ru; return `<div class="desc2">• ${esc(p.rule_name||p.description||'rule')}</div>`; }).join('');
  const did=kernelRec(r._kernel,'domain'), pid=kernelRec(r._kernel,'project'); let nav='';
  if(did) nav+=`<div class="row">${recLink(did,'Domain →')}</div>`;
  if(pid) nav+=`<div class="row">${recLink(pid,'Project →')}</div>`;
  if(L.bundle) nav+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(L.bundle)}">Deliverable bundle →</a></div>`;
  if(nav) html+=H('Related')+nav;
  return {title:`<span class="kind k-env">ENV</span> ${esc(env.name||r.label)}`, html};
}
async function bundleView(base,url,L){ S.curBase=base; const d=await dfetch(base,url);
  if(!d) return {title:'bundle', html:'<div class="l2">unavailable</div>'};
  const b=(d.bundle&&d.bundle.payload)||d.bundle||{}, arts=d.artifacts||[];
  let html=kv('Bundle',esc(b.bundle_id||''))+kv('Kind',esc(b.bundle_kind||'—'))
    +kv('State',`<span class="ok">${esc(b.state||'—')}</span>`)+kv('Version',esc(b.version||'—'))
    +kv('Owning env',esc(b.owning_env_id||'—'))+kv('Co-signers',esc(Object.keys(d.co_signatures||{}).join(', ')||'—'));
  const vinv=(d.verifier_invocations||[]).map((v)=>`${v.tier}:${v.passed?'✓':'✗'}`).join('  ');
  if(vinv) html+=H('Verifier cascade')+`<div class="desc2">${esc(vinv)}</div>`;
  html+=H(`Artifacts (${arts.length}) — click to view`)+arts.map((a)=>`<div class="grant">`
    +`<a href="#" data-act="file" data-path="${esc(a.package_path)}" data-title="${esc(a.title)}" data-kind="${esc(a.media_kind)}">${esc(a.title)}</a>`
    +`<span class="l2">${esc(a.media_kind)} · ${esc(a.size_bytes)}B</span></div>`).join('');
  if(L && L.run){ html+=H('Provenance')
    +`<div class="row"><a href="#" data-act="body" data-url="${esc(L.run)}">Body · codex model cascade →</a></div>`
    +`<div class="row"><a href="#" data-act="verify" data-url="${esc(L.run)}">Verification · cascade + safety floor →</a></div>`
    +`<div class="row"><a href="#" data-act="physical" data-url="${esc(L.run)}">Physical asset →</a></div>`;
    if(L.oci) html+=`<div class="row"><a href="#" data-act="dist" data-oci="${esc(L.oci)}" data-dag="${esc(L.dag||'')}" data-reg="${esc(L.registry||'')}">Distribution · OCI + IPLD →</a></div>`; }
  return {title:`<span class="kind k-artifact">BUNDLE</span> ${esc(b.bundle_id||'')}`, html};
}
async function fileView(base,path,title,kind){ S.curBase=base;
  const txt=await fetchText(join(base,path)); const isJson=/\.json$/i.test(path||'');
  let body=txt||''; if(isJson){ try{ body=JSON.stringify(JSON.parse(txt),null,2); }catch(e){} }
  const trunc=body.length>20000;
  let html=kv('File',esc(title))+kv('Media kind',esc(kind||'—'))+kv('Bytes',esc((txt||'').length))
    +H('Content'+(trunc?' (first 20 KB)':''))+`<pre class="filview">${esc(body.slice(0,20000))}</pre>`
    +`<div class="row"><a href="${esc(join(base,path))}" target="_blank" rel="noopener" download>download / open raw →</a></div>`;
  return {title:`<span class="kind k-artifact">FILE</span> ${esc(title)}`, html};
}
async function telemetryView(r){ const base=r._base||'',L=r._links||{}; S.curBase=base; const s=await dfetch(base,L.summary)||{};
  const ec=Object.entries(s.lineage_event_counts||{}).sort((a,b)=>b[1]-a[1]).slice(0,14);
  let html=kv('Feed',esc(r.label))+kv('OTel spans',esc(s.otel_spans||0))+kv('Lineage events',esc(s.lineage_events||0))
    +kv('Scopes',esc(s.lineage_scopes||0))+kv('Access','consent-gated (read+ &amp; ConsentLedger pin)')+kv('Signature','<span class="ok">✓ Ed25519 verified</span>');
  html+=H('Event kinds')+(ec.map(([k,v])=>`<div class="grant"><span>${esc(k)}</span><span class="ok">${esc(v)}</span></div>`).join('')||'<span class="l2">—</span>');
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
async function viewFor(id){ const r=S.recs.get(id); if(!r) return {title:'—',html:'not found'};
  const L=r._links||{};
  if(r.kind==='persona') return personaView(r);
  if(r.kind==='env') return envView(r);
  if(r.kind==='domain') return domainView(r);
  if(r.kind==='project') return projectView(r);
  if(r.kind==='telemetry') return telemetryView(r);
  if(r.kind==='artifact' && L.bundle) return bundleView(r._base||'',L.bundle,L);
  if(r.kind==='artifact' && L.content) return fileView(r._base||'',L.content,r.label,L.media_kind);
  return genericView(r);
}
async function renderTop(){ const top=S.views[S.views.length-1]; if(!top) return;
  $('#detailbody').innerHTML='<div class="l2">resolving…</div>';
  let v; try{ v=await top(); }catch(e){ v={title:'error',html:'<div class="l2">'+esc(e.message)+'</div>'}; }
  $('#detail-title').innerHTML=v.title; $('#detailbody').innerHTML=v.html;
  $('#detailback').hidden=S.views.length<=1; $('#detailbody').scrollTop=0;
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
  const net=r.planes.map((p)=>p==='internet'?'<span class="n i">DHT</span>':'<span class="n m">mDNS</span>').join('');
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
    box.innerHTML=['personas','records','kernels','events','evs','verified','clock'].map((k)=>
      `<div class="stat" id="st-${k}"><div class="v">0</div><div class="k">${k==='evs'?'ev/s':k==='clock'?'utc':k}</div></div>`).join(''); }
  let personas=0,verified=0; for(const id of S.order){ const r=S.recs.get(id); if(r.kind==='persona')personas++; verified++; }
  const eps=S.epsWin.length;
  setStat('#st-personas','personas',personas);
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
  // click any record row → detail drawer (deep-resolves env members, persona profile, artifacts)
  $('#rows').addEventListener('click',(e)=>{ const tr=e.target.closest('tr'); if(!tr||!tr.id) return; openDetail(tr.id.replace(/^r-/,'')); });
  // in-drawer navigation: follow links to other records / bundles / artifact files
  $('#detailbody').addEventListener('click',(e)=>{ const a=e.target.closest('[data-act]'); if(!a) return; e.preventDefault();
    const act=a.dataset.act, base=S.curBase||'';
    if(act==='rec') pushView(()=>viewFor(a.dataset.id));
    else if(act==='file') pushView(()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind));
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
  if(doc.public_key_hex){ try{ ok=await ed.verifyAsync(hexToBytes(doc.signature_hex),enc.encode(canon(doc.record)),hexToBytes(doc.public_key_hex)); }catch(e){} }
  log('gossip',`${doc.record.kind}: ${(doc.record.label||'').slice(0,24)} — ${ok?'verified':'unverified'}`, ok);
  const r=doc.record, id=r.record_id||r.card_id;
  if(ok && id && !S.recs.has(id)){ upsert({...r,_kernel:doc.kernel_id||'gossip',_url:'',_access:doc.access_policy||{},_links:doc.links||{},_base:doc.base||'',_doc:doc});
    if(P2P) P2P.announce(doc); classifyMap(); buildRows(); buildTicker(); renderStats(); }
}
async function initP2P(){
  const params=new URLSearchParams(location.search);
  const root=await fetchJson('.well-known/personaos-discovery.json')||{};
  const list=[...(root.bootstrap_peers||[]),...params.getAll('relay'),...params.getAll('bootstrap')].filter(Boolean);
  log('p2p','starting libp2p node — WebRTC + Kademlia DHT + gossipsub…');
  try{
    const mod=await import('./p2p-libp2p.js');
    P2P=await mod.startP2P({ bootstrapList:list,
      onLog:(t,m)=>{ log('p2p',t+' '+m, t==='peer:connect'||t==='peer:discovery'?true:undefined); updateP2PStatus(); },
      onRecord:onGossipRecord });
    updateP2PStatus();
    for(const id of S.order){ const r=S.recs.get(id); if(r._doc) P2P.announce(r._doc); }   // gossip our records to the mesh
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
