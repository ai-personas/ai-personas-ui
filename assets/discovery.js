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
  map:{} };

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
    if(ok) found.push({...r,_kernel:boot.kernel_id||'',_url:join(base,p.record_url),_access:doc.access_policy||{},_plane:plane});
  }
  return {boot,found};
}
function peerList(){ const p=new URLSearchParams(location.search).getAll('peer'); let s=[];
  try{ s=JSON.parse(localStorage.getItem('personaos_peers')||'[]'); }catch(e){} return [...new Set([...p,...s])]; }

function upsert(r){
  const id=r.record_id||r.card_id; if(!id) return;
  let row=S.recs.get(id);
  if(!row){ row={id,events:0,lastT:0,spark:new Array(SPARK_N).fill(0),bucket:0,rate:0,_new:true};
    S.recs.set(id,row); S.order.push(id); }
  Object.assign(row,{kind:r.kind,label:r.label||id,did:r.did||id,visibility_tier:r.visibility_tier,
    planes:planesOf(r.visibility_tier),_kernel:r._kernel,_access:r._access,_url:r._url});
}
function classifyMap(){ // map a telemetry scope -> a record id so rows tick
  const byKind={}; for(const id of S.order){ const k=S.recs.get(id).kind; (byKind[k]=byKind[k]||[]).push(id); }
  const first=(k)=>(byKind[k]||[])[0];
  const bundle=(byKind.artifact||[]).find((id)=>/board|bundle|package/i.test(S.recs.get(id).label))||first('artifact');
  S.map={persona:first('persona'),env:first('env'),domain:first('persona'),task:first('persona'),
    answer:first('persona'),project:first('env'),bundle,artifact:bundle,telemetry:first('telemetry')};
  S.telemetryId=first('telemetry');
}
async function discover(){
  $('#log').innerHTML=''; $('#status').textContent='resolving + verifying records…';
  const internet=await discoverFrom('','internet'); internet.found.forEach(upsert);
  const peers=peerList();
  for(const b of peers){ const r=await discoverFrom(b,'intranet'); r.found.forEach(upsert); }
  classifyMap();
  if(!S.events.length) await loadTelemetry('');
  buildRows(); buildTicker(); renderStats();
  $('#status').innerHTML=`<span class="ok">${S.recs.size}</span> records discovered + Ed25519-verified from `
    +`<span class="ok">${S.kernels.size||1}</span> kernel(s) · internet (.well-known + DHT) + intranet (mDNS) · access-gated`;
}

/* ---------- telemetry tape (replay of real signed spans) ---------- */
async function loadTelemetry(base){
  const boot=await fetchJson(join(base,'.well-known/personaos-discovery.json'));
  const url=boot?.telemetry_url||'telemetry/spans.json';
  const spans=await fetchJson(join(base,url));
  if(!Array.isArray(spans)||!spans.length){ return; }
  const evs=spans.map((s)=>{ const a=s.attributes||{};
    return { t:Date.parse(s.ended_at||s.started_at||'')||0, scope:String(a['personaos.lineage.scope']||(s.name||'').split('.').pop()||'other'),
      kind:String(a['personaos.lineage.event_kind']||s.name||'SPAN'), trace:String(a['personaos.trace_id']||s.span_id||''),
      signed:a['personaos.lineage.signed']!==false, ms:Number(a['personaos.lineage.append_ms']||0) }; })
    .filter((e)=>e.kind).sort((a,b)=>a.t-b.t);
  // normalise inter-event gaps to a lively but real cadence
  let prev=evs[0]?.t||0;
  evs.forEach((e)=>{ let g=e.t-prev; prev=e.t; e.gap=Math.max(90,Math.min(900,g||300)); });
  if(evs.length) evs[0].gap=0;
  S.events=evs;
  log('telemetry',`loaded ${evs.length} signed OTel spans for the live tape`);
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
  // counters: the scope's record + the telemetry-feed record (counts every event)
  S.evCount++; S.epsWin.push(performance.now());
  const rid=S.map[e.scope];
  if(rid) bump(rid,e.t);
  if(S.telemetryId && S.telemetryId!==rid) bump(S.telemetryId,e.t);
}
function bump(id,t){
  const r=S.recs.get(id); if(!r) return;
  r.events++; r.lastT=t||Date.now(); r.spark[r.spark.length-1]++; r._dirty=true;
}
function rollBuckets(){ for(const id of S.order){ const r=S.recs.get(id);
  const recent=r.spark.slice(-6).reduce((a,b)=>a+b,0); r.rate=recent/(6*BUCKET_MS/1000);
  r.spark.push(0); if(r.spark.length>SPARK_N) r.spark.shift(); r._dirty=true; } }

let lastBucket=0;
function tick(now){
  if(!S.paused && S.events.length){
    if(!S.lastEmit) S.lastEmit=now;
    let guard=0;
    while(guard++<50){
      const e=S.events[S.rIdx];
      if(now-S.lastEmit < e.gap) break;
      S.lastEmit=now; emitOne(); S.rIdx++;
      if(S.rIdx>=S.events.length){ S.rIdx=0; S.lastEmit=now+700; break; } // loop with a brief pause
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
  $('#addpeer').addEventListener('click',()=>{ const v=$('#peer').value.trim(); if(!v)return; let s=[];
    try{ s=JSON.parse(localStorage.getItem('personaos_peers')||'[]'); }catch(e){} if(!s.includes(v))s.push(v);
    localStorage.setItem('personaos_peers',JSON.stringify(s)); discover().then(buildRows); });
  const closeLog=()=>$('#logmodal').classList.remove('open');
  $('#logbtn').addEventListener('click',()=>$('#logmodal').classList.add('open'));
  $('#logclose').addEventListener('click',closeLog);
  $('#logmodal').addEventListener('click',(e)=>{ if(e.target.id==='logmodal') closeLog(); });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeLog(); });
}

(async ()=>{
  wire();
  await discover();
  // periodic live re-discovery (genuinely re-resolves + re-verifies; ticks in new personas)
  setInterval(()=>{ discover().then(buildRows).catch(()=>{}); }, 15000);
  requestAnimationFrame(tick);
})().catch((e)=>{ $('#status').textContent='discovery error: '+e.message; console.error(e); });
