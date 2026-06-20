import * as ed from './noble-ed25519.js';

const $=(s)=>document.querySelector(s);
const esc=(s)=>String(s??'').replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* ---------- ONE inline-SVG icon set (design-system iconography) ----------
   16x16 viewBox, stroke=currentColor, fill=none, round caps/joins (Lucide/Geist
   house style) so every glyph inherits its surface colour and the token palette.
   aria-hidden — the accessible name always lives on the host element's
   aria-label/title (never on the decorative glyph). Replaces ALL colour emoji and
   fullwidth/symbol faux-icons so they stop defeating the token palette. */
const _ICON_PATHS={
  // verdicts (pass / fail / not-run) — colour comes from the parent .ok/.no/.amber currentColor
  check:'M3.5 8.5l3 3 6-7',
  x:'M4 4l8 8M12 4l-8 8',
  minus:'M4 8h8',
  // nav / disclosure
  close:'M4 4l8 8M12 4l-8 8',
  back:'M10 3l-5 5 5 5',
  chevron:'M5 6l3 3 3-3',                 // disclosure ▸/▾ (rotated by CSS when collapsed)
  play:'M6 4l5 4-5 4z',                    // ▸ resting/activity marker (filled triangle)
  // toolbar / actions
  key:'M10.5 2.5a3.5 3.5 0 1 0 2.3 6.1l1.2 1.2 1.5-1.5-1.2-1.2A3.5 3.5 0 0 0 10.5 2.5zM9.6 6.4l-6 6',
  plus:'M8 3.5v9M3.5 8h9',
  help:'M6 6a2 2 0 1 1 2.6 1.9c-.6.2-.9.7-.9 1.3v.3M8 12.2v.1',
  // operator verbs
  ask:'M9 2L3.5 9H8l-1 5 5.5-7H8l1-5z',                 // ⚡ ASK
  fund:'M8 2.5v11M5 5.5h4a1.5 1.5 0 0 1 0 3H6.5a1.5 1.5 0 0 0 0 3H11', // 💰 FUND (cash)
  stop:'M5 5h6v6H5z',                                    // ⏹ STOP
  env_new:'M2.5 13.5V7L8 3l5.5 4v6.5M6 13.5v-4h4v4',     // 🏗 NEW ENV (building)
  persona_new:'M8 8.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM3.5 13.5a4.5 4.5 0 0 1 9 0', // 🧬 NEW PERSONA (person)
  tool:'M11.5 2.5a3 3 0 0 1-4 4l-4.5 4.5 1.5 1.5L9 8a3 3 0 0 0 4-4l-1.5 1.5-1.5-1.5L11.5 2.5z', // 🔧 tool (wrench)
  attest:'M9.5 3l3.5 3.5-6.5 6.5H3v-3.5L9.5 3z',         // ✍ ATTEST (pen)
  // status / glance
  lesson:'M8 2.5a3.5 3.5 0 0 0-2 6.4V11h4V8.9A3.5 3.5 0 0 0 8 2.5zM6.5 13h3', // 💡 lesson (bulb)
  task:'M5.5 8.5l1.5 1.5 3.5-4M3 3h10v10H3z',            // ⚙/task → checklist
  rep:'M8 2.5l1.6 3.4 3.7.4-2.8 2.5.8 3.6L8 10.6 4.7 12.4l.8-3.6L2.7 6.3l3.7-.4L8 2.5z', // ✦ reputation (star)
  warn:'M8 2.5l6 11H2l6-11zM8 7v3M8 12v.1',              // ⚠ warning (triangle)
  arrow:'M3 8h9M9 5l3 3-3 3',                            // → flow arrow
  dot:'M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',     // ● filled-ish marker (running pulse host)
  dna:'M5 3c0 3 6 3 6 6s-6 3-6 6M11 3c0 3-6 3-6 6s6 3 6 6M5.5 5h5M5.5 11h5', // 🧬 evolved tactics
  mode:'M8 2.5l1.5 1.5L8 5.5 6.5 4 8 2.5zM8 10.5L9.5 12 8 13.5 6.5 12 8 10.5zM2.5 8L4 6.5 5.5 8 4 9.5 2.5 8zM10.5 8L12 6.5 13.5 8 12 9.5 10.5 8z', // ◈ cognitive mode
  target:'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', // ◎ follow / watch-one
  box:'M8 2l5.5 3v6L8 14l-5.5-3V5L8 2zM2.5 5L8 8l5.5-3M8 8v6', // ▣ deliverable bundle (package)
  copy:'M5.5 5.5V3.5h7v7h-2M3.5 5.5h7v7h-7z',                  // ⧉ copy (two overlapping sheets)
};
function icon(name,extra){
  const d=_ICON_PATHS[name]; if(!d) return '';
  const cls='ico'+(extra?' '+extra:'');
  const fill=(name==='dot'||name==='play')?'currentColor':'none';
  return `<svg class="${cls}" viewBox="0 0 16 16" width="16" height="16" fill="${fill}" stroke="currentColor" `
    +`stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`
    +`<path d="${d}"/></svg>`;
}
// verdict glyph keyed to the three states the verdict columns use (pass/fail/not-run),
// wrapped so the existing .ok/.no/.amber colour classes still drive the hue via currentColor.
const _verdict=(state)=>state==='pass'?icon('check'):state==='fail'?icon('x'):icon('minus','ico-sm');
// Record envelope fields (base/_url/links.profile/content path) live OUTSIDE the
// Ed25519-signed payload, yet are written into real <a href> navigations. esc()
// neutralises markup but NOT dangerous schemes — block javascript:/data:/vbscript:/file:.
const safeUrl=(u)=>{ const s=String(u||'').trim(); return /^\s*(javascript|data|vbscript|file):/i.test(s)?'#':s; };
// ---- copy-to-clipboard for long cognition/script surfaces ----
// A long thinking frame / model output / sandbox stdout is shown truncated and/or
// inside a scroll box, so reading it is not the same as having it. Each such surface
// gets a small copy button that lifts the surface's OWN full textContent (never a
// re-truncated copy) to the clipboard. copyBtn() emits the button; copyFromButton()
// resolves the target (the .copy-host the button sits in) and copies + flashes 'copied'.
function copyBtn(){ return `<button class="copy-btn" data-act="copy" type="button" title="copy to clipboard" aria-label="copy to clipboard">${icon('copy','ico-sm')}<span class="copy-lbl">copy</span></button>`; }
async function copyFromButton(btn){
  const host=btn.closest('.copy-host'); if(!host) return;
  // .copy-src isolates the payload text (the button lives outside it), so its
  // textContent is exactly the surface content — no label-stripping needed.
  const tgt=host.querySelector('.copy-src')||host;
  const text=(tgt.textContent||'').trimEnd();
  let ok=false;
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); ok=true; } }catch(e){}
  if(!ok){ try{ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); ok=document.execCommand('copy'); document.body.removeChild(ta); }catch(e){} }
  const lbl=btn.querySelector('.copy-lbl'); const prev=lbl?lbl.textContent:'';
  btn.classList.toggle('ok',ok); btn.classList.toggle('no',!ok); if(lbl) lbl.textContent=ok?'copied':'failed';
  clearTimeout(btn._cpT); btn._cpT=setTimeout(()=>{ btn.classList.remove('ok','no'); if(lbl) lbl.textContent=prev||'copy'; },1600);
}
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
// In-drawer renderers fetch bytes WITH the operator token (authHeaders), but a plain
// <a download href> carries none — so for the default federation-tier (read-gated)
// bodies this UI exists to surface, the node returns 403/404 and the download silently
// fails. The node accepts ?token= (already used for EventSource), so thread it onto the
// raw href when we hold a token for that base.
function dlHref(u){ const t=tokenFor(u); return t?u+(u.includes('?')?'&':'?')+'token='+encodeURIComponent(t):u; }
function authHeaders(u){ const t=tokenFor(u); return t?{'Authorization':'Bearer '+t}:{}; }
function updateOpBadge(){ const b=$('#opbtn'); if(!b) return;
  const n=Object.keys(opTokens()).length; b.classList.toggle('on',n>0);
  // stroked key glyph (inherits the button's currentColor; goes green via #opbtn.on)
  // instead of the colour emoji that defeated the token palette.
  b.innerHTML=icon('key')+`<span class="opbtn-label">OPERATOR${n>0?` · ${n}`:''}</span>`; }
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
// Reduce ANY id form to the bare trailing id (ULID / kernel hex) the node's
// /thinking + per-entity endpoints resolve. Personas/envs ship two DID shapes:
//   colon  did:personaos:<kernel>:persona:<ULID>
//   slash  did:personaos:kernel:<kernel>/persona/persona:<ULID>   (live form)
// The slash form's trailing segment is the real id — taking only the last path
// segment is what strips the `<kernel>/persona/` middle that previously survived
// and leaked into /thinking fetches (URL-encoded → ':'→%3A, '/'→%2F → 404).
const _shortId=(s)=>{
  let v=String(s||'').replace(/^did:personaos:[^:]+:/,'');
  if(v.includes('/')) v=v.slice(v.lastIndexOf('/')+1);   // slash-path DID → trailing id
  return v.replace(/^(persona|env|kernel):/,'');
};
// The workspace RUN id (k/run-XXXX) every record carries in its resolved links /
// url. It is the reliable join between an environment and ITS deliverables: an
// env record and the artifact bundle + files it produced all share one run path.
function runOf(r){ if(!r) return null;
  const cands=[...Object.values(r._links||{}), r._url, r._base];
  for(const v of cands){ if(typeof v==='string'){ const m=v.match(/k\/(run-[0-9A-Za-z]+)/); if(m) return m[1]; } }
  // Some records (notably ARTIFACTS) carry the run path only NESTED — e.g. an env+federation tier
  // artifact's body is gated, so its run lives in links.content_stub.note/locator, not a top-level
  // string link. Deep-scan the links blob so a deliverable still joins to ITS env lane.
  try{ const m=JSON.stringify(r._links||{}).match(/k\/(run-[0-9A-Za-z]+)/); if(m) return m[1]; }catch(e){}
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
  // heartbeat is a per-base map OR'd into the single S.heartbeat the three readers use
  // (livedot, drawVital, constellation beat): with multiple nodes, processed sequentially,
  // a last-writer-wins overwrite let a later idle node clobber an earlier running one and
  // read the whole page as idle. running = ANY node running; interval = min over running.
  if(live.node&&live.node.heartbeat){
    (S.heartbeatByBase=S.heartbeatByBase||new Map()).set(base||'@origin',live.node.heartbeat);
    let anyRunning=false, anyBusy=false, minIv=null;
    for(const hb of S.heartbeatByBase.values()){
      const r=hb&&hb.running!==false; if(r){ anyRunning=true;
        const iv=+(hb&&hb.interval_s); if(iv>0) minIv=(minIv==null?iv:Math.min(minIv,iv)); }
      // busy is the HONEST distinguisher: node.py sets heartbeat.busy='running run-xxxx'
      // only while actually producing, '' when idle. OR it across bases so the warming
      // claim ('producing the first candidate') never shows for an unfunded/idle node.
      if(hb&&hb.busy) anyBusy=true; }
    // when nothing is running, keep the last reported interval so the cadence is stable
    S.heartbeat={running:anyRunning,busy:anyBusy,interval_s:(minIv!=null?minIv:(S.heartbeat&&S.heartbeat.interval_s)||live.node.heartbeat.interval_s)};
  }
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
  S.lastModelSeenAt=S.lastModelSeenAt||new Map();   // sid -> frame ts this persona last carried live model events (liveness decay)
  for(const [pid,models] of byP){
    S.lastModelSeenAt.set(pid,t);   // byP carries THIS persona this poll → stamp model-recency for the 5-min liveness window
    const prev=S.modelCount.get(pid); const now2=models.length;
    if(prev!=null && now2>prev){ const g=Math.min(now2-prev,6);
      for(let k=0;k<g;k++) _pushSpike('produce');
      S.lastActiveAt.set(pid,Date.now());   // this persona just asked a model → it is RUNNING NOW
      setTimeout(()=>_fireEdge(pid,'produce','out'),60); }   // persona asked a model → outbound spoke pulse
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
      const arr=S.ixByPersona.get(sid)||S.ixByPersona.set(sid,[]).get(sid); arr.push({kind:e.kind,_t:e._t,_cap:e._cap}); }
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
        const cls=_ixClass(rec.kind), d=Math.min(fired*120,1500), failed=_ixFailed(rec.kind);
        // PRIMARY (rare on real data): if a single act names an actor persona AND affected
        // persona(s), fire the DIRECTIONAL actor→affected chord — that IS the inter-persona message.
        const from=rec.actor_kind==='persona'?_shortId(rec.actor_id):null;
        const tos=(rec.affected||[]).filter((a)=>a.kind==='persona').map((a)=>_shortId(a.id)).filter((s)=>s&&s!==from);
        if(from&&tos.length){
          setTimeout(()=>{ _flashNode(from,cls,failed); tos.forEach((to)=>{ _fireLink(from,to,cls); _flashNode(to,cls,failed); }); },d);
        } else {
          // REAL path (telemetry is 100% kernel-mediated): the act touches ONE persona on an
          // env scope. Resolve the live peer the kernel relays among that scope and fire the
          // person→person HOP so a routed message visibly travels between two people, with
          // honest direction — work routed TO a persona is inbound (kernel→X), a persona's
          // own result is outbound (X→kernel). Fall back to the kernel spoke only when no
          // graph peer shares the scope.
          const onEnv=rec.scope==='environment'&&rec.scope_id;
          const subj=from || (RELAY_KINDS.has(rec.kind)
            ? (rec.affected||[]).filter((a)=>a.kind==='persona').map((a)=>_shortId(a.id)).find((s)=>S.nodePos.has(s))
            : null);
          const outbound=rec.actor_kind==='persona';   // persona reporting back vs kernel routing in
          const peer=onEnv&&subj?_scopePeer(rec.scope_id,subj):null;
          if(peer){
            const a=outbound?subj:peer, b=outbound?peer:subj;   // M is always the source of the dash
            setTimeout(()=>{ _fireLink(a,b,cls); _flashNode(subj,cls,failed); },d);
          } else {
            _ixSids(rec).forEach((sid)=>setTimeout(()=>_fireEdge(sid,cls,outbound?'out':'in'),d));
          }
        }
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
  if(!g.size){ el.innerHTML='<span class="loading-inline"><span class="dot"></span><span class="dim">no kernels discovered yet</span></span>'; return; }
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
    description:r.description||'',
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
let _discoverBusy=false;
async function discover(){
  // re-entrancy guard: the 15s interval is .then()-fired-and-forgotten and can stack
  // on a slow tunnel (each run does parallel per-base fetches + telemetry loads).
  if(_discoverBusy) return; _discoverBusy=true;
  try{
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
  }finally{ _discoverBusy=false; }
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
    <h3>${icon('warn')} No live PersonaOS personas discovered yet</h3>
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
    4 · Your own node? Click <b>OPERATOR</b>, paste its token
    (<code>runs/…/_operator/token</code>) and drive it from here: ASK / FUND / STOP, runs,
    personas, live telemetry.</div>
  </div>`;
}

// ---------- WARMING state: a reachable node is alive but the first candidate /
// telemetry hasn't reached this client yet ----------
// HONEST gate: at least one node bootstrapped OK (S.boots / a reachable peer),
// the heartbeat is running, but NOTHING streamable has landed (no env lanes, no
// live personas, no coordination acts). Distinct from emptyStateHTML() (no node
// at all) and from a populated stage. Returns '' when it is NOT genuinely warming.
function isReachableNode(){
  if(S.boots&&S.boots.size) return true;
  for(const h of (S.peerHealth||new Map()).values()) if(h&&h.ok) return true;
  return false;
}
function isWarming(){
  // reachable + heartbeat actually BUSY producing, yet zero streamable signal at the
  // client. heartbeat.running alone is true for an unfunded/idle node (the thread is
  // just alive), so requiring busy stops the green 'producing' claim on an idle node.
  if(!isReachableNode()) return false;
  if(!(S.heartbeat&&S.heartbeat.running&&S.heartbeat.busy)) return false;
  const noPersonas=!(S.liveByPersona&&S.liveByPersona.size);
  const noActs=!((S.interactions||[]).length);
  return noPersonas&&noActs;
}
// HONEST idle-but-alive: node reachable, heartbeat running, but NOT busy (no funded
// mission) and nothing has streamed yet. Distinct from warming (busy) — the copy must
// not claim production.
function isIdleAlive(){
  if(!isReachableNode()) return false;
  if(!(S.heartbeat&&S.heartbeat.running)) return false;
  if(S.heartbeat.busy) return false;
  const noPersonas=!(S.liveByPersona&&S.liveByPersona.size);
  const noActs=!((S.interactions||[]).length);
  return noPersonas&&noActs;
}
function idleAliveHTML(){
  // .state-banner / .idle: token-elevated callout (reduced-motion-covered dot) — the
  // inline-style blob is gone; the class carries the spacing/colour from the design system.
  // A minimal inline fallback on the dot keeps it legible until the shared CSS lands.
  return `<div class="state-banner idle">`
    +`<span class="dot" style="background:var(--amber);box-shadow:0 0 8px var(--amber)"></span>`
    +`<div><b class="amber">node is online — no funded mission running</b>`
    +`<span class="l2"> — the heartbeat is alive but idle. Open <b>OPERATOR</b>, ask the node a task and fund a budget to start a run; personas, coordination and deliverables stream here the moment it produces.</span></div>`
    +`</div>`;
}
// A calm pulsing-green warming banner: the dot reuses the existing 'live' class for its
// pulse (with a minimal inline colour fallback) and the .state-banner shell carries the
// shared token spacing/elevation — no more inline layout blob.
function warmingHTML(){
  return `<div class="state-banner warming">`
    +`<span class="dot live" style="background:var(--up);box-shadow:0 0 8px var(--up)"></span>`
    +`<div><b style="color:var(--up)">node is producing the first candidate</b>`
    +`<span class="l2"> — telemetry will stream here shortly. Personas, coordination and deliverables appear the moment the run emits them.</span></div>`
    +`</div>`;
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
    +kv('Verified in browser',`<span class="ok">${icon('check','ico-sm')} signature checked here</span>`)
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
// MODEL-PER-ROLE rollup: PersonaOS resolves a DIFFERENT model per role/purpose
// (EnvironmentModelRegistry), so summarise the distinct models a persona/env used
// → the roles/purposes each served, busiest first, as mono <code> chips. Honest:
// pure live telemetry; renders nothing when idle.
function _modelSummary(models){
  if(!models||!models.length) return '';
  const byM=new Map();
  for(const m of models){ const mdl=String(m.model||'—'); const r=String(m.role||m.purpose||'');
    const e=byM.get(mdl)||{n:0,roles:new Set()}; e.n++; if(r&&r!=='-') e.roles.add(PURPOSE_LABEL[r]||r); byM.set(mdl,e); }
  return [...byM.entries()].sort((a,b)=>b[1].n-a[1].n).map(([mdl,e])=>
    `<div class="grant"><span><code>${esc(mdl)}</code></span>`
    +`<span class="l2">${esc([...e.roles].slice(0,4).join(', ')||'model')}${e.n>1?` <span class="rr-count">×${e.n}</span>`:''}</span></div>`).join('');
}
function _liveFeed(models){
  if(!models||!models.length) return '<div class="l2">idle — no recent model calls</div>';
  // A persona legitimately produces, repairs AND evolves its own tactics — so SUMMARISE
  // its recent model calls by PURPOSE with a count (newest purpose first), instead of a
  // repeating row per call that reads like a glitch ("repairing candidate" ×6 in a row).
  const byP=new Map(); let i=0;
  for(const m of models){ const k=m.purpose||'model';
    const e=byP.get(k)||{n:0,model:m.model,role:m.role||'',seen:i}; e.n++; e.model=m.model||e.model; if(m.role) e.role=m.role; e.seen=i++; byP.set(k,e); }
  const order=[...byP.entries()].sort((a,b)=>b[1].seen-a[1].seen);   // most-recently-used purpose first
  return order.map(([p,e])=>{
    const lbl=PURPOSE_LABEL[p]||p;
    return `<div class="grant"><span class="l2"><span class="livedot2"></span>${esc(lbl)}`
      +`${e.n>1?` <span class="rr-count">×${e.n}</span>`:''}</span>`
      +`<span><code>${esc(e.model)}</code>${e.role&&e.role!=='-'&&e.role!==p?` <span class="l2">${esc(e.role)}</span>`:''}</span></div>`;
  }).join('');
}
function renderPersonaLive(pid,profileFallback){
  // profileFallback (the served persona card) lets the grid render for IDLE personas too
  // (state/tasks/reputation), since the drawer no longer duplicates those as kv rows.
  const d=S.liveByPersona.get(_shortId(pid))||(profileFallback?{summary:profileFallback,models:[]}:null);
  if(!d) return '<div class="l2">— no live telemetry yet (idle or not streaming) —</div>';
  const s=d.summary||profileFallback||{}; let h='';
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
  h+=`<div class="sublabel">Doing now</div>`+_liveFeed(d.models);
  return h;
}
function renderEnvLive(eid){
  const d=S.liveByEnv.get(_shortId(eid)); if(!d) return '<div class="l2">— no live telemetry yet (idle or not streaming) —</div>';
  let h='';
  const sp=d.spans||[];
  if(sp.length){
    const counts={}; sp.forEach((s)=>{counts[s.kind]=(counts[s.kind]||0)+1;});
    h+=`<div class="sublabel">Lineage events</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>
        `<div class="grant"><span class="l2">${esc(k)}</span><span class="ok">${esc(v)}</span></div>`).join('');
  }
  h+=`<div class="sublabel">Model activity in this env</div>`+_liveFeed(d.models);
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
// TOOL = a persona reaching for / acquiring / using a capability — the headline
// "self-extension" story. These have human verbs in IX_VERB but would otherwise
// fall to the muted 'activity' catch-all, indistinguishable from background noise.
const TOOL_KINDS=new Set(['CAPABILITY_PROVISIONED','EXTERNAL_CAPABILITY_BLOCKED','EXTERNAL_CAPABILITY_ACQUIRED',
  'ENV_MCP_TOOL_REGISTERED','ENV_MCP_TOOL_INVOKED']);
// a verdict that did NOT accept → render in the rejected colour. A persona honestly
// stuck on self-provisioning (EXTERNAL_CAPABILITY_BLOCKED) reads as fail too. NOTE:
// the public interaction projection strips payload, so CAPABILITY_PROVISIONED's
// ok/error fields are NOT in the client stream — only BLOCKED is markable client-side.
const _ixFailed=(kind)=>kind==='TASK_NOT_ACCEPTED'||kind==='EXTERNAL_CAPABILITY_BLOCKED';
function _ixClass(kind){ if(kind==='MODEL_CALL'||kind==='LLM_OUTPUT'||kind==='LLM_LESSON')return 'think';
  if(CROSSENV_KINDS.has(kind))return 'crossenv'; if(VERIFY_KINDS.has(kind))return 'verify';
  if(TOOL_KINDS.has(kind))return 'tool';
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
// per-row feed kind glyph keyed to the _ixClass lane (inherits the lane colour via
// currentColor on .ix-kind). One stroked icon per lane — no colour emoji.
const _IX_GLYPH={think:'lesson',coord:'arrow',verify:'check',artifact:'task',tool:'tool',crossenv:'arrow',activity:'dot'};
const _ixGlyph=(cls)=>icon(_IX_GLYPH[cls]||'dot','ico-sm ix-glyph');
const _ago=(t)=>{const s=Math.max(0,(Date.now()-t)/1000|0);return s<5?'now':s<60?s+'s':s<3600?(s/60|0)+'m':(s/3600|0)+'h';};
const _PERSONA_NAME=new Map();   // short id -> friendly name (filled from live summaries + records)
function _nameFor(shortId){ return _PERSONA_NAME.get(shortId)||shortId.slice(0,10); }
// RUNNING NOW vs merely live: a persona is "running now" iff its model/coordination activity
// GREW within the last ~18 s (just over one 15s poll window) — i.e. it is mid model-call this moment. This is
// the precise signal that distinguishes the ONE persona actually working from the several that are
// recently-active ("live"). Everything else stays calm so the running one is unmistakable.
const _RUNNING_WINDOW_MS=18000;
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
  // DEDUP consecutive identical _msg (the fixture/real loops emit identical back-to-back
  // outputs) BEFORE the on-card budget so the wall shows two DISTINCT recent messages.
  const _cogAll=(S.interactions||[]).filter((e)=>e.scope==='cognition'&&_shortId(e.actor_id)===sid);
  const _cogDedup=[]; for(const e of _cogAll){ const p=_cogDedup[_cogDedup.length-1]; if(!p||p._msg!==e._msg) _cogDedup.push(e); }
  const cogMsgs=_cogDedup.slice(-2).reverse();
  // CARD/FEED freshness decoupled from token arrival: track the newest cognition _key
  // seen per persona, so only an actually-new top cognition message slides in (model-count
  // growth no longer false-flashes the unchanged top message).
  S.pcCogSeen=S.pcCogSeen||new Map();
  const _topCogKey=cogMsgs[0]?cogMsgs[0]._key:'';
  const _cogFresh=!!_topCogKey && S.pcCogSeen.get(sid)!==_topCogKey;
  S.pcCogSeen.set(sid,_topCogKey);
  const actFresh=!!recentAct && (Date.now()-recentAct._t)<90000;
  const hasModels=models.length>0;
  // HONEST recency: a model-bearing card decays to idle once its model events stop
  // arriving (5-min window) instead of staying green forever via the sticky models[]
  // carry-forward. Liveness = model events seen recently OR a fresh coordination act.
  const modelFresh=hasModels&&(Date.now()-(S.lastModelSeenAt?.get(sid)||0))<300000;
  const live=modelFresh||actFresh;
  const running=_runningNow(sid);   // mid model-call THIS moment — the one truly working
  // flash on genuine growth of total activity (model reqs + monotonic act tally)
  const actTally=(S.ixCountBySid&&S.ixCountBySid.get(sid))||0;
  const grew=_personaGrew(sid,models.length+actTally);
  // Card content (UX): the useful signal is WHAT it's doing now + WHAT it produced/learned
  // (the message stream) + a clean grouped ACTIVITY GLANCE — not a raw per-call list.
  let doingHTML, glance='';
  if(hasModels){
    doingHTML=`${running?'<span class="pulse">'+icon('dot','ico-sm')+'</span>':'<span class="pc-rest">'+icon('play','ico-sm')+'</span>'} ${esc(PURPOSE_VERB[last.purpose]||last.purpose)} <code>${esc(last.model)}</code>`;
    const byP=new Map();
    for(const m of models){ const k=m.purpose||'model'; byP.set(k,(byP.get(k)||0)+1); }
    glance=[...byP.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4)
      .map(([p,n])=>`<span class="pc-g">${esc(PURPOSE_VERB[p]||p)}${n>1?` <b>×${n}</b>`:''}</span>`).join('');
  } else if(actFresh){
    doingHTML=`${running?'<span class="pulse">'+icon('dot','ico-sm')+'</span>':'<span class="pc-rest">'+icon('play','ico-sm')+'</span>'} ${esc(_ixVerb(recentAct.kind))}`;
  } else {
    doingHTML='<span class="l2">idle — awaiting a mission</span>';
  }
  // TOOL chip: the persona's headline self-extension act (provision / acquire / use /
  // block) within the live window. doingHTML is model-purpose-only when hasModels, so a
  // persona calling models AND just reaching for a tool would otherwise mask the tool act.
  // Strictly additive — does NOT touch pc-msgs/pc-glance/pc-stats. The client projection
  // strips payload, so only the verb is available (no capability name / error).
  const toolAct=[...acts].reverse().find((a)=>TOOL_KINDS.has(a.kind)&&(Date.now()-a._t)<90000);
  const toolFail=toolAct&&(_ixFailed(toolAct.kind)||(toolAct._cap&&toolAct._cap.ok===false));
  const toolCap=toolAct&&toolAct._cap?(toolAct._cap.capability||toolAct._cap.tool_name||''):'';
  const mp=s.mode_proficiencies||{}; const topMode=Object.entries(mp).sort((a,b)=>b[1]-a[1])[0];
  // PER-04: the public card shows reputation_score (role-relative [0,1]), NEVER raw
  // operator fitness. Evolution internals (tactics/lessons/modes) are operator-tier
  // — shown only when an operator token is held (and in the 🧠 thinking drawer).
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  // pc-stats footer: assemble the spans first so a model-only persona (s={}, no summary)
  // doesn't render an EMPTY pc-stats div whose border-top draws a stray separator bar.
  // neutral .tag chips with leading stroked glyphs (replaces the colour-emoji prefixes);
  // .tag is additive — the existing pc-stats span styling still applies until shared CSS lands.
  const statHTML=(s.experience_tasks!=null?`<span class="tag" title="tasks worked">${icon('task','ico-sm')} ${esc(s.experience_tasks)}</span>`:'')
    +(s.reputation_score!=null?`<span class="tag" title="reputation — role-relative [0,1]">${icon('rep','ico-sm')} ${esc(Number(s.reputation_score).toFixed(2))}</span>`:'')
    +(hasOp&&s.tactic_count!=null?`<span class="tag" title="evolved tactics (operator)">${icon('dna','ico-sm')} ${esc(s.tactic_count)}</span>`:'')
    +(hasOp&&s.lesson_count!=null?`<span class="tag" title="lessons learned (operator)">${icon('lesson','ico-sm')} ${esc(s.lesson_count)}</span>`:'')
    +(hasOp&&topMode?`<span class="tag" title="strongest cognitive mode (operator)">${icon('mode','ico-sm')} ${esc(topMode[0])} ${esc(Number(topMode[1]).toFixed(2))}</span>`:'');
  // 3-state presence: RUNNING NOW (pulsing) · active (calm, recently worked) · idle.
  const dotCls=running?'run':(live?'on':'off');
  const statusBadge=running
    ? '<span class="pc-run">RUNNING</span>'
    : (live?'<span class="pc-active">active</span>':'<span class="pc-idle">idle</span>');
  // HONEST recency tag on the doing line: when did this persona last actually do
  // something (model event / coordination act / cognition / tool use)? So an "active"
  // card reads "3m ago" instead of an unbounded-green claim. Hidden while running-now.
  const lastSeen=Math.max(S.lastModelSeenAt?.get(sid)||0, recentAct?._t||0, cogMsgs[0]?._t||0, toolAct?._t||0);
  if(!running && lastSeen>0) doingHTML+=`<span class="pc-when">${_ago(lastSeen)}</span>`;
  return `<div class="pcard role-${role}${running?' running':live?' live':''}${grew&&!running?' flashcard':''}" data-pcard="${esc(sid)}" role="button" tabindex="0" title="open ${esc(name)}">`
    +`<div class="pcard-top"><span class="pc-dot ${dotCls}"></span>`
    +`<span class="pc-name">${esc(name)}</span>`
    +(name.toLowerCase()!==role?`<span class="pc-role">${esc(role)}</span>`:'')
    +statusBadge
    +(state&&state!=='ACTIVE'?`<span class="pc-state">${esc(state.toLowerCase())}</span>`:'')
    +`<button class="pc-follow" data-follow="${esc(sid)}" title="watch only this persona" aria-pressed="false">${icon('target','ico-sm')}</button></div>`
    +`<div class="pc-doing">${doingHTML}</div>`
    +(toolAct?`<div class="pc-tool${toolFail?' fail':''}">${toolFail?icon('warn','ico-sm'):icon('tool','ico-sm')} ${esc(_ixVerb(toolAct.kind))}${toolCap?` · ${esc(toolCap)}`:''}</div>`:'')
    +(cogMsgs.length?`<div class="pc-msgs">`+cogMsgs.map((m,i)=>{
        const ct=(m._ctype&&m._ctype!=='think')?`<span class="pc-ct ct-${m._ctype}">${m._ctype}</span>`:'';
        return `<div class="pc-msg ${m.kind==='LLM_LESSON'?'lesson':'out'}${_cogFresh&&i===0?' fresh':''}">`
        +`<span class="pc-msg-g">${m.kind==='LLM_LESSON'?icon('lesson','ico-sm'):icon('play','ico-sm')}</span>${ct}${esc(m._msg||'')}</div>`; }).join('')
      +`</div>`:'')
    +(glance?`<div class="pc-glance">${glance}</div>`:'')
    +(statHTML?`<div class="pc-stats">${statHTML}</div>`:'')
    +'</div>';
}

// ---- live coordination GRAPH (SVG): kernel hub + persona nodes + pulsing edges --
// Honest topology: PersonaOS coordination is KERNEL-MEDIATED (the kernel routes
// candidate→verify→accept), so the kernel is the hub and personas are spokes; the
// persona↔persona CHORDS overlay who-coordinates-with-whom, derived from the cohort
// the kernel relays within one env scope. Edges/nodes PULSE when a fresh interaction
// names that persona (from kernel.interactions).
function _hotPersonas(){
  const hot=new Set();
  for(const e of (S.interactions||[]).slice(-10)){
    if(e.actor_kind==='persona'&&e.actor_id) hot.add(_shortId(e.actor_id));
    for(const a of (e.affected||[])) if(a.kind==='persona') hot.add(_shortId(a.id));
  }
  return hot;
}
// quadratic control point for a persona↔persona chord, bowed clear of the kernel
// core at (cx,cy). Default bow = outward along the kernel→midpoint normal so the curve
// arcs AWAY from the hub. When the two nodes sit opposite at the ellipse waist the
// midpoint lands on the core and that normal collapses — fall back to the chord's own
// perpendicular so the chord still arcs clear instead of slicing straight through the core.
function _chordCtl(ax,ay,bx,by,bow){
  const cx=500,cy=100, mx=(ax+bx)/2, my=(ay+by)/2;
  let nx=mx-cx, ny=my-cy; let nl=Math.hypot(nx,ny);
  if(nl<6){ nx=-(by-ay); ny=(bx-ax); nl=Math.hypot(nx,ny)||1; bow=Math.max(bow,84); }   // degenerate (opposite nodes) → chord perpendicular + force a core-clearing bow (apex stays clear of the r=34 ring)
  nx/=nl; ny/=nl;
  return {qx:+(mx+nx*bow).toFixed(1), qy:+(my+ny*bow).toFixed(1)};
}
// kernel-RELAY acts: the kernel routing coordination AMONG the personas of one
// environment scope. These carry exactly ONE affected persona (the relay target), so
// no single act names two personas — but grouped by scope_id they reveal the cohort the
// kernel is shuttling messages between. This is the honest persona↔persona channel on a
// 100%-kernel-mediated substrate (verified: real telemetry emits 0 actor→affected pairs).
const RELAY_KINDS=new Set(['ATTENTION_ALLOCATED','COORDINATION_SHAPE_EVENT','COORDINATION_SHAPE_ADMITTED','VERIFIER_VERDICT']);
const _COORD_WINDOW_MS=900000;   // chords reflect CURRENT relay (≈ active-run span), not all-time membership
// the graph-persona(s) an act puts on a scope: a kernel relay act → its affected persona;
// a persona's own act on the scope → that actor. Either way, scoped to personas on the graph.
function _scopePersonas(e,posOf,out){
  if(RELAY_KINDS.has(e.kind)) for(const af of (e.affected||[])){
    if(af.kind!=='persona') continue; const b=_shortId(af.id); if(b&&posOf.has(b)) out.add(b); }
  if(e.actor_kind==='persona'){ const a=_shortId(e.actor_id); if(a&&posOf.has(a)) out.add(a); }
}
// the persona MOST-RECENTLY relayed on `scopeId` other than `exceptSid`, restricted to
// personas that have a rendered graph position — the live peer a kernel-mediated hop should
// travel TO/FROM, so a routed message visibly moves person→person, not only person→hub.
// Scans the WHOLE ring newest-first but only env-scope rows, because the recent tail is
// dominated by model-call rows that carry no env peer; returns null when none shares the scope.
function _scopePeer(scopeId,exceptSid){
  if(!scopeId) return null;
  const onGraph={has:(sid)=>S.nodePos.has(sid)};
  const all=(S.interactions||[]);
  for(let i=all.length-1;i>=0;i--){ const e=all[i];
    if(e.scope!=='environment'||e.scope_id!==scopeId) continue;
    const ps=new Set(); _scopePersonas(e,onGraph,ps);
    for(const sid of ps) if(sid!==exceptSid) return sid;
  }
  return null;
}
// persona↔persona traffic over the recent interaction window — the standing
// coordination topology (WHO coordinates with WHOM). TWO honest sources, merged:
//  (1) DIRECT actor→affected acts (one act naming two graph personas) — the strongest
//      signal, kept as a HIGHER-WEIGHT overlay for the day the node emits them.
//  (2) CO-RELAY co-membership: kernel-relay acts (ATTENTION/COORDINATION/VERDICT) +
//      persona acts on the SAME environment scope_id, grouped over the live window — the
//      distinct graph-personas the kernel is shuttling among one scope are linked
//      star-through-the-busiest (the most-relayed persona is the hub of its cohort, the
//      others spoke off it), n = co-relay count. This is the ONLY channel that renders on
//      real (fully kernel-mediated) telemetry. Pairs are canonical-keyed ("a|b", a<b) so
//      both directions sum into one chord. O(ring≤400), filtered by scope, once per render.
function _personaTraffic(posOf){
  const map=new Map();
  const bump=(a,b,n,direct)=>{ if(!a||!b||a===b) return;
    const key=a<b?a+'|'+b:b+'|'+a;
    const t=map.get(key)||map.set(key,{a:key.slice(0,key.indexOf('|')),b:key.slice(key.indexOf('|')+1),n:0,direct:false}).get(key);
    t.n+=n; if(direct) t.direct=true; };
  const now=Date.now();
  const all=(S.interactions||[]);
  // (2) co-relay co-membership grouped by environment scope_id. Scan the WHOLE ring for
  // env-scope rows (the recent tail is all model-call rows that carry no env peer, so a
  // last-N slice would miss every relay act). The relay BURST happens once at run start, then
  // the cohort grinds model calls for tens of minutes — so we gate on the SCOPE's own latest
  // activity (any act on it, incl. the personas' work acts), NOT each relay's age. A cohort
  // whose env is still producing acts is still coordinating; one gone quiet fades out.
  const byScope=new Map();    // scope_id -> Map(sid -> relay count)
  const scopeLast=new Map();  // scope_id -> ts of its most-recent act
  for(const e of all){
    if(e.scope!=='environment'||!e.scope_id) continue;
    const t=e._t||0; if(t>(scopeLast.get(e.scope_id)||0)) scopeLast.set(e.scope_id,t);
    const ps=new Set(); _scopePersonas(e,posOf,ps); if(!ps.size) continue;
    const cm=byScope.get(e.scope_id)||byScope.set(e.scope_id,new Map()).get(e.scope_id);
    for(const sid of ps) cm.set(sid,(cm.get(sid)||0)+1);
  }
  for(const [scopeId,cm] of byScope){
    if((now-(scopeLast.get(scopeId)||0))>_COORD_WINDOW_MS) continue;   // gate: scope still active?
    const ranked=[...cm.entries()].sort((x,y)=>y[1]-x[1]).map((e)=>e[0]);
    if(ranked.length<2) continue;
    const hub=ranked[0];   // busiest persona in the cohort = star centre
    for(let i=1;i<ranked.length;i++) bump(hub,ranked[i],Math.min(cm.get(hub),cm.get(ranked[i])),false);
  }
  // (1) DIRECT actor→affected acts — higher-weight overlay (counts double, marks the channel).
  // Bounded to the recent tail; these are rare on real data but dominate the chord when present.
  for(const e of all.slice(-120)){
    if(e.actor_kind!=='persona') continue;
    const a=_shortId(e.actor_id); if(!a||!posOf.has(a)) continue;
    for(const af of (e.affected||[])){
      if(af.kind!=='persona') continue;
      const b=_shortId(af.id); if(!b||b===a||!posOf.has(b)) continue;
      bump(a,b,2,true);
    }
  }
  return map;
}
const SVGNS='http://www.w3.org/2000/svg';
const _svg=(tag,attrs,cls)=>{ const e=document.createElementNS(SVGNS,tag);
  if(cls) e.setAttribute('class',cls); for(const k in (attrs||{})) e.setAttribute(k,attrs[k]); return e; };
// CONSTELLATION (supporting minimap): KERNEL core (beats on heartbeat) + persona
// nodes (breathe live / dim idle) on an ellipse, + persona↔persona coordination chords.
// Rendered with a KEYED enter/update/exit diff (NOT innerHTML=) so in-flight
// breathing + traveling pulses survive each 5s refresh. The kernel is the honest
// hub: PersonaOS coordination is kernel-mediated. cx/cy in the wide 1000×200 rail.
function renderCoordGraph(persons,totalPersons){
  const svg=$('#sysGraph'); if(!svg) return;
  const popN=(totalPersons!=null?totalPersons:persons.length);
  const cx=500,cy=100,rx=432,ry=58;
  // skeleton (created once): edges / axons / core / nodes layers
  if(!svg._built){ svg._built=true;
    svg.appendChild(_svg('g',{},'cg-edges'));
    const links=_svg('g',{},'cg-links');        // persona↔persona layer (above hub spokes, below the core)
    links.appendChild(_svg('g',{},'cg-chords'));    // resting chords — rebuilt via innerHTML each render
    links.appendChild(_svg('g',{},'cg-linkfire'));  // directional fire pulses — PERSISTENT (keyed reuse, survive refresh)
    svg.appendChild(links);
    svg.appendChild(_svg('g',{},'cg-axons'));
    const core=_svg('g',{transform:`translate(${cx},${cy})`},'core');
    core.appendChild(_svg('title',{}));   // native hover tooltip for the kernel hub
    core.appendChild(_svg('circle',{r:34},'core-ring'));
    core.appendChild(_svg('circle',{r:28},'core-c'));
    core.appendChild(_svg('text',{y:-2},'core-t')).textContent='KERNEL';
    const cs=_svg('text',{y:13},'core-s'); core.appendChild(cs);
    svg.appendChild(core); svg.appendChild(_svg('g',{},'cg-nodes'));
    svg._edges=svg.querySelector('.cg-edges'); svg._chords=svg.querySelector('.cg-chords');
    svg._linkfire=svg.querySelector('.cg-linkfire'); svg._axons=svg.querySelector('.cg-axons');
    svg._core=core; svg._nodes=svg.querySelector('.cg-nodes');
  }
  const hot=_hotPersonas();
  const n=persons.length||1;
  persons.forEach((p,i)=>{ const ang=(-Math.PI/2)+(i*2*Math.PI/n);
    p.x=+(cx+Math.cos(ang)*rx).toFixed(1); p.y=+(cy+Math.sin(ang)*ry).toFixed(1);
    S.nodePos.set(p.sid,{x:p.x,y:p.y}); });
  // core: beat cadence from the heartbeat; caption = live/active count
  const beat=S.heartbeat&&S.heartbeat.interval_s?Math.max(2,+S.heartbeat.interval_s):5;
  svg._core.style.setProperty('--beat',beat+'s');
  const _coreTitle=svg._core.querySelector('title');
  if(_coreTitle) _coreTitle.textContent=`PersonaOS kernel — routes all persona coordination · heartbeat ${beat}s`;
  const runningN=persons.filter((p)=>p.running).length;
  const liveN=persons.filter((p)=>p.live).length;
  svg._core.querySelector('.core-s').textContent=
    runningN ? `${runningN} in a model call · ${popN} personas`
             : `${liveN} active · ${popN} personas`;
  // edges (kernel spokes only) — safe to rebuild (no continuous anim). The spoke is
  // calm (live/idle); recent coordination is now carried by the chord layer + the
  // directional spoke PULSE, not by highlighting the hub spoke (that overstated the hub).
  let e='';
  persons.forEach((p)=>{
    e+=`<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" class="ge ${p.live?'ge-live':'ge-idle'}"/>`; });
  svg._edges.innerHTML=e;
  // PERSONA↔PERSONA coordination chords — the standing topology of WHO talks to WHOM.
  // Aggregated from recent interactions (actor persona → affected persona), both on
  // the graph. Stroke weight + opacity scale with traffic so the busiest channels read
  // loudest; the curve bows AWAY from the kernel (control point pushed outward from the
  // chord midpoint) so it never collides with the radial spokes or the central core.
  const posOf=new Map(persons.map((p)=>[p.sid,p]));
  const traffic=_personaTraffic(posOf);   // "a|b" -> {a,b,n}  (a<b canonical; n = recent acts over this channel)
  let lk='';
  for(const t of traffic.values()){
    const A=posOf.get(t.a), B=posOf.get(t.b); if(!A||!B) continue;
    const {qx,qy}=_chordCtl(A.x,A.y,B.x,B.y,18+Math.min(t.n,6)*4);
    // DIRECT actor→affected channels (a single act named both) read louder than the
    // co-relay co-membership channels — when the node ever emits them they dominate.
    const w=((t.direct?1.4:1.1)+Math.min(t.n,8)*0.5).toFixed(2);   // weight by traffic (clamped)
    const op=((t.direct?0.40:0.30)+Math.min(t.n,8)*0.06).toFixed(2);
    lk+=`<path d="M${A.x} ${A.y} Q${qx} ${qy} ${B.x} ${B.y}" class="cl${t.direct?' cl-direct':''}" `
       +`style="stroke-width:${w};opacity:${op}"/>`;
  }
  svg._chords.innerHTML=lk;   // resting chords only — fire pulses live in the sibling cg-linkfire layer
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
      g.appendChild(_svg('title',{}));   // native SVG hover tooltip (full untruncated name — first child)
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
    // full untruncated hover tooltip — the on-screen name is clipped to 10 chars
    const ttl=`${p.name||'persona'} — ${p.role} · ${p.running?(p.doing||'active'):(p.live?'active':'idle')}`;
    if(g.children[0].textContent!==ttl) g.children[0].textContent=ttl;
    const nm=p.name&&p.name.length>11?p.name.slice(0,10)+'…':(p.name||''); if(g.children[3].textContent!==nm) g.children[3].textContent=nm;
    const rl=(p.role[0]||'?').toUpperCase(); if(g.children[4].textContent!==rl) g.children[4].textContent=rl;
    const dn=p.running?(p.doing||'').slice(0,16):''; if(g.children[5].textContent!==dn) g.children[5].textContent=dn; });
  [...svg._nodes.children].forEach((g)=>{ if(!liveSids.has(g.getAttribute('data-gp'))) g.remove(); });
  // drop reused fire-pulse paths whose endpoints left the graph (keeps the persistent
  // linkfire layer from accumulating orphans referencing positions that no longer exist)
  [...svg._linkfire.children].forEach((p)=>{ const [f,tt]=(p.getAttribute('data-link')||'').split('>');
    if(!liveSids.has(f)||!liveSids.has(tt)) p.remove(); });
}
const cssEsc=(s)=>(window.CSS&&CSS.escape)?CSS.escape(String(s)):String(s).replace(/["\\]/g,'\\$&');

// fire a traveling pulse along a persona's kernel-edge (and flash its node) —
// called when a NEW coordination act names that persona (staggered). The axon is
// a reused element; we restart its one-shot travel by reflow + class re-add.
// dir makes the honest kernel-mediated flow legible: 'out' = persona reporting BACK to the
// kernel (dash travels persona→core); else (inbound) the kernel routing work TO the persona
// (dash travels core→persona, the default). Same axon, opposite keyframe — no new geometry.
function _fireEdge(sid,cls,dir){
  if(RM) { _flashNode(sid,cls); return; }
  const svg=$('#sysGraph'); if(!svg||!svg._axons) return;
  const ax=svg._axons.querySelector(`[data-axon="${cssEsc(sid)}"]`); if(!ax) return;
  ax.setAttribute('class','axon'); void ax.getBoundingClientRect();
  ax.setAttribute('class','axon fire'+(dir==='out'?' out':'')+(cls&&cls!=='coord'?' fire-'+cls:''));
  _flashNode(sid,cls);
}
// fire a DIRECTIONAL traveling pulse along the persona→persona chord (actor→affected),
// so live coordination shows not just THAT two personas talked but WHICH WAY. Reuses one
// path per ordered pair in the links layer; the dash travels from→to (M is always the
// actor) so direction is unambiguous. Geometry matches the resting chord in renderCoordGraph.
function _fireLink(fromSid,toSid,cls){
  if(RM) { _flashNode(toSid,cls); return; }   // reduced-motion: flash the target instead of traveling
  const svg=$('#sysGraph'); if(!svg||!svg._linkfire) return;
  const A=S.nodePos.get(fromSid), B=S.nodePos.get(toSid); if(!A||!B) return;
  const {qx,qy}=_chordCtl(A.x,A.y,B.x,B.y,26);
  const id=fromSid+'>'+toSid;
  let p=svg._linkfire.querySelector(`[data-link="${cssEsc(id)}"]`);
  if(!p){ p=_svg('path',{},'cl-fire'); p.setAttribute('data-link',id);
    p.addEventListener('animationend',()=>p.setAttribute('class','cl-fire')); svg._linkfire.appendChild(p); }
  p.setAttribute('d',`M${A.x} ${A.y} Q${qx} ${qy} ${B.x} ${B.y}`);
  p.setAttribute('class','cl-fire'); void p.getBoundingClientRect();
  p.setAttribute('class','cl-fire fire'+(cls&&cls!=='coord'?' fire-'+cls:''));
}
function _flashNode(sid,cls,failed){
  const svg=$('#sysGraph'); if(!svg||!svg._nodes) return;
  const g=svg._nodes.querySelector(`[data-gp="${cssEsc(sid)}"]`); if(!g) return;
  const base=g.getAttribute('class').replace(/ gn-flash| gn-verdict-\w+/g,'');
  // a VERIFY flash must read PASS-green vs FAIL-red HONESTLY — a rejected verdict
  // flashing green while the same act reads FAIL-red in the feed was a bug.
  const verdict=cls==='verify'?(failed?' gn-verdict-fail':' gn-verdict-pass'):'';
  g.setAttribute('class',base+' gn-flash'+verdict);
  setTimeout(()=>{ g.setAttribute('class',base); },800);
}

// VITAL-SIGN spike queue: a verified event (model-event growth or a new
// coordination act) injects a decaying spike, coloured by class. The ECG canvas
// (drawVital) consumes it. Never enqueued without a real telemetry delta behind it.
const SPIKE_COL={produce:'#a779e6',coord:'#3aa0ff',verify:'#19c39a',artifact:'#f0a73a',crossenv:'#ff5fa2',tool:'#a779e6',activity:'#48586a'};
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
      // the STREAMING counter is the page's hero metric — the already-built .stat.primary
      // (18px/green when .hot) gives the page a visual anchor when work is live.
      return `<div class="stat${k==='active'?' primary':''}" id="st-${k}"><div class="v">${init}</div><div class="k">${lbl}</div></div>`;
    }).join(''); }
  const setV=(id,val)=>{ const el=$(id); if(!el) return; const v=el.querySelector('.v');
    if(v.textContent!==String(val)){ v.textContent=val; v.classList.remove('flash'); void v.offsetWidth; v.classList.add('flash'); } };
  let personasN=S.liveByPersona.size;
  for(const id of S.order){ if(S.recs.get(id).kind==='persona') personasN=Math.max(personasN,1); }
  const recPersona=S.order.filter((id)=>S.recs.get(id).kind==='persona').length;
  personasN=Math.max(S.liveByPersona.size,recPersona);
  const now=Date.now();
  // STREAMING = personas whose activity GREW in the running window (genuinely mid-work
  // right now) OR with a coordination act in the last 60s — so the headline can't read 0
  // while the feed is streaming, and a persona that merely once called a model (its
  // models[] is carried forward forever) is NOT counted as permanently streaming.
  const streaming=new Set();
  for(const psid of (S.lastActiveAt?S.lastActiveAt.keys():[])) if(_runningNow(psid)) streaming.add(psid);
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
  $('#st-active')?.classList.toggle('hot',active>0);   // hero treatment lights up only while work streams
  setV('#st-acts',acts); setV('#st-signed',signed.toLocaleString());
  // verify badge live count
  const vb=$('#verifybadge'); if(vb) vb.title=`${S.recs.size} signed record(s) Ed25519-verified in your browser`;
  // livedot beats ONLY while a real node heartbeat is running (no decorative pulse)
  const dot=$('#livedot'); if(dot){ const beating=!!(S.heartbeat&&S.heartbeat.running!==false);
    dot.classList.toggle('beating',beating);
    dot.title=beating?'live — node heartbeat running':'no live node heartbeat';
    dot.setAttribute('aria-label',beating?'node heartbeat live':'node idle'); }
}

let _sysBusy=false;
async function refreshSystemView(){
  const host=$('#sysEnvs'); if(!host||_sysBusy) return;
  // re-entrancy guard (mirrors _cogBusy): the 5s interval fires this unconditionally,
  // and its many serial awaited fetches can overrun the interval on a slow link, so
  // invocations would otherwise overlap and stack duplicate fetches + full rebuilds.
  _sysBusy=true;
  try{
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

  // presence rank for in-lane ordering: running-now (0) → live/model-bearing (1) → idle (2),
  // so the one persona actually working floats to the top of its lane instead of sitting in
  // raw roster order. Hoisted so the orphan lane sorts the same way.
  const _rank=(m)=>{ const live=((S.liveByPersona.get(m)||{}).models||[]).length>0;
    return _runningNow(m)?0:(live?1:2); };
  // first-seen deliverable ids → mint-flash a chip the moment it ships (not on every poll,
  // and not the whole set on cold load); mirrors the ixColdLoaded pattern.
  S.seenArts=S.seenArts||new Set();
  const laneHTML=(b)=>{
    const cards=b.members.length?[...b.members].sort((a,c)=>_rank(a)-_rank(c)).map(renderPersonaCard).join('')
      :'<div class="l2" style="padding:8px">awaiting members</div>';
    const arts=b.run?(artByRun.get(b.run)||[]):[];
    const bundles=arts.filter((a)=>a._links&&a._links.bundle);
    // file cards carry content_stub/content_hash (the public projection), not always a
    // raw `content` link — count any of them so the bundle chip shows a real file count.
    const fileCount=arts.filter((a)=>{ const L=a._links||{};
      return L.content||L.content_stub||L.content_hash; }).length;
    // env-meta file count EXCLUDES the bundle wrapper (its own content_hash) so the
    // headline agrees with the deliverable chip's "N files" instead of overcounting.
    const metaFiles=arts.filter((a)=>{ const L=a._links||{};
      return (L.content||L.content_stub||L.content_hash)&&!(L.bundle); }).length;
    const chips=(bundles.length?bundles:arts).slice(0,6).map((a)=>{
      // The signed bundle record's description is '{state} deliverable bundle (N files)'.
      // Parse it for per-BUNDLE state + count: prefer the per-bundle file count over the
      // run-wide fileCount (which is wrong when a run has >1 bundle), and show the state so
      // the chip distinguishes draft from shipped.
      const m=String(a.description||'').match(/^(\w+) deliverable bundle \((\d+) files?\)/i);
      const stt=m?m[1].toLowerCase():''; const bn=m?+m[2]:0;
      const isBundle=bundles.length&&a._links&&a._links.bundle;
      const n=isBundle?(bn||fileCount):0;
      const stCls=isBundle&&stt?((stt==='shipped'||stt==='accepted')?' ds-ok':(stt==='deprecated'||stt==='rejected')?' ds-no':' ds-amber'):'';
      // data-artid MUST be the S.recs key (record_id/card_id — see upsert), not a.id
      // (records have no .id field), or the click handler's S.recs.has() always misses.
      const aid=a.record_id||a.card_id||a.id||'';
      const _al=a.label||'artifact';
      const isNew=S.artsColdLoaded && !S.seenArts.has(aid); S.seenArts.add(aid);
      return `<span class="art-chip${isNew?' mint':''}${stCls}" data-artid="${esc(aid)}" role="button" tabindex="0" title="${esc(a.label||'')}">${icon('box','ico-sm')} ${esc(_al.length>26?_al.slice(0,24)+'…':_al)}${stt?` · <b>${esc(stt)}</b>`:''}${n?` · ${n} file${n>1?'s':''}`:''}</span>`;
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
      +`<span class="env-meta">${esc((b.type||'env').replace(/_/g,' '))} · <span class="${statusOk?'ok':'l2'}">${esc(statusTxt)}</span>${memberTxt}${metaFiles?` · ${metaFiles} file${metaFiles>1?'s':''}`:''}${bundles.length?` · ${bundles.length} bundle${bundles.length>1?'s':''}`:''}</span></div>`
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
  S.artsColdLoaded=true;   // first full lane pass done → from now on a NEW chip id mints
  if(orphans.length){
    html+=`<div class="env-lane orphan"><div class="env-head"><span class="env-badge alt">NODE ROSTER</span>`
      +`<span class="env-meta">personas not currently in a task environment</span></div>`
      +`<div class="env-personas">${[...orphans].sort((a,c)=>_rank(a)-_rank(c)).map(renderPersonaCard).join('')}</div></div>`;
  }
  // empty stage: warming (reachable node, heartbeat running, nothing streamed yet)
  // ranks ABOVE the generic "no environments" line and the no-node empty card, so a
  // viewer who just started a run sees honest "first candidate is coming", not a blank.
  const finalHTML=html||(isWarming()?warmingHTML()
    :isIdleAlive()?idleAliveHTML()
    :(S.recs.size||S.liveByPersona.size)
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
      doing:last?(PURPOSE_VERB[last.purpose]||last.purpose):''}; });
  // graph renders at most 14 nodes, but the caption must report the TRUE population
  // (matching #st-personas), not the rendered cap.
  const totalPersons=persons.length;
  renderCoordGraph(persons.slice(0,14),totalPersons);
  renderInteractionStream();
  updateVitalsCounters();
  if(S.q) _applyFilter();   // re-apply the active filter after the 5s stage/feed rebuild
  }finally{ _sysBusy=false; }
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
  const ff=$('#cfFollow'); if(ff){ ff.hidden=!f; const lbl=ff.querySelector('.dim'); if(lbl&&f) lbl.textContent='following '+_nameFor(f); }
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
    if(flt==='tool') return c==='tool';
    return true; }).slice(-120).reverse();
  const f=S.follow;
  const matches=(e)=>!f|| (e.actor_kind==='persona'&&_shortId(e.actor_id)===f)
    || (e.affected||[]).some((a)=>a.kind==='persona'&&_shortId(a.id)===f);
  let prevScope=null;
  // preserve the reader's scroll position across the wholesale innerHTML rebuild: newest
  // rows are prepended at top (rows are .reverse()'d), so when not pinned to the top, add
  // the grown height so the rows being read stay stationary; at the top, leave it pinned.
  const atTop=el.scrollTop<=4, prevH=el.scrollHeight, prevTop=el.scrollTop;
  el.innerHTML=rows.map((e)=>{
    const c=_ixClass(e.kind); const cap=e._cap||null; const fail=_ixFailed(e.kind)||(!!cap&&cap.ok===false);
    const who=e.actor_kind==='persona'?_nameFor(_shortId(e.actor_id)):(e.actor_id?`${esc(e.actor_kind)}:${esc((e.actor_id||'').slice(0,10))}`:esc(e.actor_kind||'kernel'));
    const aff=(e.affected||[]).map((a)=>a.kind==='persona'?_nameFor(_shortId(a.id)):a.kind==='model'?`model:${a.id||''}`:`${a.kind}:${(a.id||'').slice(0,8)}`);
    const arrow=aff.length?`<span class="ix-arrow">→</span><span class="ix-to">${esc(aff.join(', '))}</span>`:'';
    const fresh=!S.ixSeen.has(e._key); if(fresh) S.ixSeen.add(e._key);
    // thread spine when this row shares a real scope_id with the one above it
    const sid=e.scope_id&&/[:/]/.test(String(e.scope_id))?String(e.scope_id):null;
    const threaded=sid&&sid===prevScope; prevScope=sid;
    const spine=threaded?`<span class="ix-spine${fresh?' grow':''}" style="--thread:${_threadHue(sid)}"></span>`:'';
    // read the row like a live MESSAGE: "<persona> <verb> → <to> · <detail>".
    const verb=_ixVerb(e.kind);
    // content-type chip: a persona producing CODE vs hitting an ERROR vs writing a
    // PLAN reads instantly (the single _ctype computed once in streamPersonaCognition).
    const ct=(e._ctype&&e._ctype!=='think')?`<span class="ix-ct ct-${e._ctype}">${e._ctype}</span>`:'';
    const msg=e._msg?`<span class="ix-msg">${ct}${esc(e._msg)}</span>`:'';
    // capability/tool detail from the backend _cap projection: WHICH capability + its error
    const capDetail=cap&&(cap.capability||cap.tool_name)
      ?`<span class="ix-cap">${esc(cap.capability||cap.tool_name)}${cap.ok===false&&cap.error?' · '+esc(String(cap.error).split('\n')[0].slice(0,90)):''}</span>`:'';
    const ttl=e._rationale?` title="${esc(e._rationale)}"`:(cap&&cap.error?` title="${esc(cap.error)}"`:'');
    return `<li class="ix ix-${c}${fail?' fail':''}${fresh?' fresh':''}${threaded?' threaded':''}${(f&&!matches(e))?' dimmed':''}"${ttl}>`
      +spine+`<span class="ix-kind">${_ixGlyph(c)}${esc(verb)}</span>`
      +`<span class="ix-from">${esc(who)}</span>${arrow}${msg}${capDetail}`
      +`<span class="ix-scope">${esc((e.scope==='cognition'||e.scope==='model')?'':e.scope||'')}</span><span class="ix-time">${esc(_ago(e._t))}</span></li>`;
  }).join('')||(()=>{
    // cognition is operator-token-only by design (A-TF2), so an anonymous THINK feed is
    // always empty — explain that instead of the generic 'fund a mission' line.
    if(flt==='think' && Object.keys((typeof opTokens==='function'?opTokens():{})).length===0)
      return '<li class="l2" style="padding:10px">persona cognition is operator-only (A-TF2) — add an operator token in the console to watch the THINK stream.</li>';
    // warming: a reachable node is running but no act has streamed yet — say so on the
    // unfiltered feed rather than implying nothing is funded (honest only when warming).
    if(flt==='all' && isWarming())
      return '<li class="loading-inline">'
        +'<span class="dot live" style="background:var(--up);box-shadow:0 0 6px var(--up)"></span>'
        +'<span><b style="color:var(--up)">node is producing the first candidate</b> — coordination acts will stream here shortly.</span></li>';
    // idle-but-alive: reachable + heartbeat running but NOT busy (no funded mission) —
    // honest amber, never the green 'producing' claim.
    if(flt==='all' && isIdleAlive())
      return '<li class="loading-inline">'
        +'<span class="dot" style="background:var(--amber);box-shadow:0 0 6px var(--amber)"></span>'
        +'<span><b class="amber">node is online — no funded mission</b> — ask a task and fund a budget in the console to start a run.</span></li>';
    // presence check so the intentional empty-string label (all) survives the lookup
    const lbl={all:'',think:'thinking ',coord:'coordination ',verify:'verification ',artifact:'shipped-artifact ',tool:'tool ',crossenv:'cross-env '};
    const q=(flt in lbl)?lbl[flt]:(flt+' ');
    return '<li class="l2" style="padding:10px">no '+esc(q)+'activity yet — fund a mission to watch personas coordinate.</li>';
  })();
  if(!atTop) el.scrollTop=prevTop+(el.scrollHeight-prevH);
  // headline count must match what the reader sees: the grand total only for the
  // default all+no-follow view, else the shown (tab-filtered, follow-matching) count.
  const r=$('#sysStreamRate'); if(r){
    const narrowed=(flt!=='all')||!!f;
    const shown=f?rows.filter(matches).length:rows.length;
    r.textContent=narrowed?`${shown} of ${all.length} acts`:`${all.length} live acts`;
  }
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
  h+=`<div class="sublabel">Doing now</div>`+_liveFeed(feedModels(doc));
  const sp=doc.spans||[];
  if(sp.length){ const counts={}; sp.forEach((x)=>{const k2=(x.attributes||{})['personaos.lineage.event_kind']||x.name||'SPAN'; counts[k2]=(counts[k2]||0)+1;});
    h+=`<div class="sublabel">Lifecycle / lineage</div>`
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
    h+=`<div class="sublabel">Lineage events (this env)</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k2,v])=>
        `<div class="grant"><span class="l2">${esc(k2)}</span><span class="ok">${esc(v)}</span></div>`).join(''); }
  h+=`<div class="sublabel">Model activity in this env <span class="dim">(own feed)</span></div>`+_liveFeed(feedModels(doc));
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
    h+=`<div class="l2" style="margin:2px 0 3px">Recent model output — what the LLM actually produced (newest first)</div>`
      +out.slice(-10).reverse().map((o)=>{
        // the FULL text is carried in the (scroll-capped) surface so copy lifts everything,
        // not the 240-char preview. TYPE-AWARE: error/code/json/tool keep their structure
        // in a real <pre> (indentation + newlines preserved, larger scroll budget); prose
        // types (markdown/plan/think) stay clamped one-line prose. esc() on every byte.
        const full=String(o.text||''); const ty=_cogType(full);
        if(ty==='error'||ty==='code'||ty==='json'||ty==='tool'){
          return `<div class="think llmout copy-host ctype-${ty}"><span class="ctype-tag amber">${esc(o.kind||ty)}</span> ${copyBtn()}`
            +`<pre class="ct-pre copy-src">${esc(full)}</pre></div>`;
        }
        const long=full.length>240;
        return `<div class="think llmout copy-host"><span class="amber">${esc(o.kind||'output')}</span> ${copyBtn()}`
          +`<span class="opmsg copy-src${long?' clamp':''}">${esc(full)}</span></div>`;
      }).join('');
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
        +`<span class="${e.accepted===true?'ok':e.accepted===false?'down':'l2'}">${e.accepted===true?icon('check'):e.accepted===false?icon('x'):''}</span></div>`).join('')+`</div>`;
  }
  if(t.thinking_frame)
    h+=`<details class="frame"><summary class="l2">thinking frame — the exact prompt it generates under (SOUL + evolved tactics + retrieved knowledge)</summary>`
      +`<div class="copy-host">${copyBtn()}<pre class="opout copy-src">${esc(t.thinking_frame)}</pre></div></details>`;
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
      +`<span class="l2">${e.accepted===true?icon('check'):e.accepted===false?icon('x'):''}</span></div>`).join('')+'</div>';
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
// ONE content-type classifier shared by feed / card / drawer — the substance a
// persona's raw model output IS, computed once and ridden through on the interaction
// record (_ctype). Order-sensitive, cheapest-first: a failing-loop persona's error
// must out-rank a JSON/code read; tool-call json before generic json; a fenced/code
// blob before prose; a numbered plan before markdown. Returns one vocabulary value:
// error | tool | json | code | markdown | plan | think.
function _cogType(s){
  const v=String(s||'').trim(); if(!v) return 'think';
  // 1) ERROR — a traceback / exception / fatal line anywhere (a stuck loop).
  if(/(^|\n)\s*(Traceback \(most recent call last\)|[A-Za-z_]*(?:Error|Exception)\b\s*:|fatal:|FATAL\b|panic:|Segmentation fault)/.test(v)
     || /\b(Error|Exception)\b[^\n]*\n\s+at /.test(v)) return 'error';
  // 2) TOOL — a tool-call object (the distinctive keys), checked before generic json.
  if(v[0]==='{'){ try{ const o=JSON.parse(v);
    if(o&&typeof o==='object'&&(('tool_name' in o)||('tool' in o&&'arguments' in o)||('name' in o&&'arguments' in o)||('tool_calls' in o)||('function_call' in o))) return 'tool';
  }catch(e){} }
  // 3) JSON — parses cleanly as an object/array.
  if(v[0]==='{'||v[0]==='['){ try{ JSON.parse(v); return 'json'; }catch(e){} }
  // 4) CODE — a fenced block, a shebang, or a leading import/def/function line.
  if(/```/.test(v)||/^#!/.test(v)||/^\s*(import |from \S+ import |def |class |function |const |let |var |#include|package )/m.test(v)) return 'code';
  // 5) PLAN — a numbered step list (≥2 "1. … 2. …" lines).
  if((v.match(/^\s*\d+[.)]\s+\S/gm)||[]).length>=2) return 'plan';
  // 6) MARKDOWN — headings / bullets / tables (prose with structure).
  if(/^#{1,6}\s+\S/m.test(v)||/^\s*[-*]\s+\S/m.test(v)||/^\s*\|.+\|/m.test(v)) return 'markdown';
  // 7) THINK — plain reasoning prose (the default).
  return 'think';
}
// Readable one-line preview of a persona's raw model OUTPUT (a candidate package
// JSON or a code blob) — so the THINK feed shows WHAT it produced, not a code dump.
function _cogPreview(msg){
  const s=String(msg||'').trim();
  if(s[0]==='{'||s[0]==='['){ try{ const o=JSON.parse(s); const p=(o&&o.package)||o;
    const files=p&&p.files;
    if(Array.isArray(files)&&files.length) return `produced ${files.length}-file package — ${files.slice(0,4).join(', ')}${files.length>4?'…':''}`;
    if(p&&p.file_count) return `produced ${p.file_count}-file package`;
  }catch(e){} }
  // ERROR-FIRST: a failing-loop persona surfaces the verb (mirrors 'learned — '),
  // so it reads 'errored — KeyError: …' instead of masquerading as normal output.
  if(_cogType(s)==='error'){
    const ln=s.split(/\r?\n/).map((x)=>x.trim()).find((x)=>/((?:[A-Za-z_]*(?:Error|Exception))\b\s*:|fatal:|panic:|Segmentation fault)/.test(x))
      ||s.split(/\r?\n/).map((x)=>x.trim()).find(Boolean)||'';
    return 'errored — '+ln.slice(0,140);
  }
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
          _msg:preview.slice(0,200),_rationale:msg,
          _ctype:row.kind==='LLM_LESSON'?'think':_cogType(msg)});
      }
    }
    if(added){
      S.interactions.sort((a,b)=>a._t-b._t);
      if(S.interactions.length>400) S.interactions=S.interactions.slice(-400);
      S.ixKeys=new Set(S.interactions.map((e)=>e._key));
      renderInteractionStream();
      // CARD↔FEED sync: advance the card cognition walls together with the feed (the
      // diff-guards in refreshSystemView make the extra call cheap when nothing changed).
      if(typeof refreshSystemView==='function') refreshSystemView();
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
  // de-dup scalars the live grid already renders as tiles (state / tasks / reputation)
  // and the title already shows (name): keep only rows the grid does NOT carry.
  let html=kv('Persona id',S0(pid||r.did))
    +kv('Role',`<span class="cap">${esc(role)}</span>`)
    +kv('Archetype',S0(ps.archetype))
    +kv('Disposition',S0(ps.primary_disposition))
    +kv('Soul version',S0(ps.soul_version))
    +(ps.born_specialist?kv('Origin','<span class="amber">born specialist (genesis)</span>'):'');
  // MODEL-PER-ROLE: the distinct models this persona resolved (EnvironmentModelRegistry
  // picks one per role/purpose) — surfaced right under identity when it has live model calls.
  const _liveModels=(S.liveByPersona.get(_shortId(pid||r.did))||{}).models||[];
  if(_liveModels.length) html+=kv('Model',_modelSummary(_liveModels));
  if(ps.description) html+=H('Description')+`<div class="desc2">${esc(String(ps.description).slice(0,400))}</div>`;
  if((ps.advertised_interests||[]).length) html+=H('Interests')+chipsOf(ps.advertised_interests);
  if((ps.domain_curatorships||[]).length) html+=H('Domain curatorships')+chipsOf(ps.domain_curatorships);
  // what this persona CAN DO — its advertised capabilities (filtering the generic
  // project_workspace marker, same as the env lanes do).
  const caps=(ps.capability_summary||r.capability_summary||[]).filter((c)=>c&&c!=='project_workspace');
  if(caps.length) html+=H('Capabilities')+chipsOf(caps);
  // THE PLAN — the mission this persona is working on: the charter, objectives,
  // current round and blocked/measured state of the run its workspace env pursues.
  // The persona's own record may carry the run path; otherwise resolve it from its
  // kernel's env record (runOf scans the resolved links for k/run-XXXX).
  const _eidR=kernelRec(r._kernel,'env');
  const _prun=runOf(r)||(_eidR?runOf(S.recs.get(_eidR)):null);
  if(_prun) html+=await planSection(base,_prun);
  // LIVE per-persona activity — what this persona is doing right now + its
  // evolving internal state, streamed in place on every telemetry tick. Prefers
  // the persona's OWN feed document (links.telemetry → telemetry/personas/<slug>.json).
  S.drawerLiveKind='persona'; S.drawerLiveId=pid||r.did; S.drawerLiveBase=base;
  S.drawerLiveFeed=(L.telemetry&&!String(L.telemetry).includes('live/latest'))?L.telemetry:'';
  html+=H('● Live · inside this persona')+`<div id="livesec" class="livesec">${renderPersonaLive(pid||r.did,ps)}</div>`;
  if(S.drawerLiveFeed) setTimeout(refreshLiveSection,0);
  // 🧠 what it is THINKING: lessons/tactics/frame for the operator; redacted
  // transition timeline for everyone else. Streams on the live cadence.
  S.drawerThinkPid=_shortId(pid||r.did);   // always the bare id the /thinking endpoint resolves
  html+=H('Thinking')+`<div id="thinksec" class="livesec"><div class="fv-loading">resolving cognition…</div></div>`;
  setTimeout(refreshThinking,0);
  html+=trustPanel(r);
  // the persona's OWN env, not merely the FIRST env on the kernel (wrong on multi-env
  // nodes): prefer links.env / the profile's environment_id, resolved to a discovered
  // record; fall back to kernelRec only when neither resolves.
  const _ownEnvId=L.env||ps.environment_id||prof.environment_id||'';
  const _ownEnvSid=_ownEnvId?_shortId(_ownEnvId):'';
  const _ownEnvRec=_ownEnvSid?S.order.find((id)=>{ const x=S.recs.get(id);
    return x&&x.kind==='env'&&((x.did||'').includes(_ownEnvSid)||(x.record_id||'').includes(_ownEnvSid)||_envSid(x)===_ownEnvSid); }):null;
  const eid=_ownEnvRec||kernelRec(r._kernel,'env');
  const bid=S.order.find((id)=>{ const x=S.recs.get(id);
    return x&&x._kernel===r._kernel&&x.kind==='artifact'&&x._links&&x._links.bundle; });
  let nav='';
  if(eid) nav+=`<div class="row">${recLink(eid,'Workspace (env) →')}</div>`;
  if(bid) nav+=`<div class="row">${recLink(bid,'Deliverable (bundle) →')}</div>`;
  if(nav) html+=H('Related')+nav;
  if(L.profile) html+=H('Source')+`<div class="row"><a href="${esc(safeUrl(join(base,L.profile)))}" target="_blank" rel="noopener">signed persona card →</a></div>`;
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
  // de-dup scalars the live tiles + the 'Members (N)' header already carry
  // (name is in the title; status + member count are live tiles): keep only the rest.
  let html=kv('Environment',S0(d.environment_id||r.did||r.label))
    +kv('Type',`<span class="cap">${esc(d.env_type||'—')}</span>`)
    +kv('Env rules',S0(d.rule_count))
    +kv('Lineage events',S0(ld.event_count));
  // MODEL-PER-ROLE: the distinct models in use across this environment's personas
  // (the env's own model_events) — what THIS workspace is actually running on.
  const _envLiveModels=(S.liveByEnv.get(_shortId(d.environment_id||r.did))||{}).models||[];
  if(_envLiveModels.length) html+=kv('Models in use',_modelSummary(_envLiveModels));
  if(d.description) html+=H('Description')+`<div class="desc2">${esc(String(d.description).slice(0,300))}</div>`;
  // THE PLAN — the mission charter this environment exists to pursue (objectives,
  // current round, blocked/measured state). Surfaced right under the env header so
  // the drawer answers "what is this env trying to DO", not only "what did it make".
  const _run=runOf(r);
  if(_run) html+=await planSection(base,_run);
  // Deliverables produced in THIS environment — every signed bundle and every
  // file, joined to the env by its workspace run id. The whole point of clicking
  // an environment: see ALL its artifacts. Each row opens the verified body.
  const myArts=_run?S.order.map((id)=>S.recs.get(id)).filter((x)=>x&&x.kind==='artifact'&&runOf(x)===_run):[];
  const myBundles=myArts.filter((a)=>a._links&&a._links.bundle);
  const myFiles=myArts.filter((a)=>{ const L=a._links||{}; return L.content||L.content_stub||L.content_hash; });
  if(myArts.length){
    html+=H(`Deliverables — ${myArts.length} artifact${myArts.length>1?'s':''}`
      +(myBundles.length?` · ${myBundles.length} bundle${myBundles.length>1?'s':''}`:'')+' (click to view)');
    for(const bnd of myBundles)
      html+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(bnd._links.bundle)}" data-rec="${esc(bnd.record_id||bnd.card_id||'')}">${icon('box','ico-sm')} ${esc(bnd.label||'deliverable bundle')} →</a></div>`;
    if(myFiles.length)
      html+=`<div class="atree">`+myFiles.map((a)=>
        `<div class="tnode tfile"><a href="#" data-act="rec" data-id="${esc(a.record_id||a.card_id||a.id||'')}">${esc(a.label||a.record_id||'file')}</a>`
        +`<span class="l2">${esc((a._links||{}).media_kind||'')}</span></div>`).join('')+`</div>`;
  }
  const roster=members.length?members:( (ns.personas||[]).map((p)=>({persona_id:p.persona_id,role:p.role,active:p.lifecycle_state==='ACTIVE'})) );
  if(roster.length){
    html+=H(`Members (${roster.length})`);
    html+=roster.map((m)=>{
      const rid=findRecByDid(m.persona_id)||findRecByDid('did:personaos:'+m.persona_id);
      const label=rid?recLink(rid,m.role||m.persona_id):esc(m.role||m.persona_id);
      const active=m.active!==false;
      // the model this member is running on (its latest live model selection) — so the
      // roster shows WHO is on WHICH model, not just who is a member.
      const lm=(S.liveByPersona.get(_shortId(m.persona_id))||{}).models;
      const mdl=lm&&lm.length?lm[lm.length-1].model:'';
      return `<div class="grant">${label}<span class="l2">${mdl?`<code>${esc(mdl)}</code> · `:''}<span class="${active?'ok':'dim'}">${active?'active':'departed'}</span></span></div>`;
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
  // the env's MISSION — objectives + round trajectory, otherwise unreachable from here.
  const mid=kernelRec(r._kernel,'mission'); if(mid) nav+=`<div class="row">${recLink(mid,'Mission · objectives & round trajectory →')}</div>`;
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
// Run-artifact bodies are SERVED under k/<run>/artifacts/package/<path>, but record content
// links and bundle-manifest paths are run-RELATIVE (artifacts/package/<path>). Prefix with the
// run segment so the body fetch hits the served bytes. Idempotent — skips already-absolute or
// already-prefixed paths, so it is safe even where the public promotion already added k/<run>/.
function _bodyPath(p,run){ p=String(p||''); if(!p) return p;
  if(/^(https?:|\/|k\/run-)/.test(p)) return p; return run?('k/'+run+'/'+p):p; }
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
function renderArtifactNode(node,prefix,depth,pkgRun){
  let h='';
  for(const [seg,child] of [...node.dirs.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
    const key=prefix?prefix+'/'+seg:seg; const collapsed=dirCollapsed(key,depth);
    const n=(child.files.length)+child.dirs.size;
    h+=`<div class="tnode tdir" style="padding-left:${depth*14}px"><a href="#" data-act="tdir" data-key="${esc(key)}" data-collapsed="${collapsed?1:0}">`
      +`<span class="ttog${collapsed?' collapsed':''}">${icon('chevron','ico-sm')}</span> ${esc(seg)}/</a><span class="l2">${n}</span></div>`;
    if(!collapsed) h+=`<div class="tkids">${renderArtifactNode(child,key,depth+1,pkgRun)}</div>`; }
  for(const f of node.files.sort((a,b)=>a.name.localeCompare(b.name))){
    const a=f.art, published=a.body_published!==false;
    const body=published
      ? `<a href="#" data-act="file" data-path="${esc(_bodyPath('artifacts/package/'+f.path,pkgRun))}" data-title="${esc(f.path)}" data-kind="${esc(a.media_kind)}" data-hash="${esc(a.content_hash||'')}" data-size="${esc(a.size_bytes??a.size??a.bytes??'')}">${esc(f.name)}</a>`
      : `<span class="tgated">${esc(f.name)} <span class="no">· origin_gated</span></span>`;
    const sz=(a.size_bytes??a.size??a.bytes);
    h+=`<div class="tnode tfile" style="padding-left:${depth*14}px">${body}<span class="l2">${esc(a.media_kind||'—')}${sz!=null&&sz!==''?' · '+fmtBytes(+sz):''}</span></div>`; }
  return h;
}
function renderArtifactTree(arts,pkgRun){
  if(!S.bundleDirs) S.bundleDirs=new Set(); if(!S.bundleDirsOpen) S.bundleDirsOpen=new Set();
  if(!(arts||[]).length) return '<div class="l2">— no artifacts —</div>';
  return `<div class="atree">${renderArtifactNode(buildArtifactTree(arts),'',0,pkgRun)}</div>`;
}
async function bundleView(base,url,L){ S.curBase=base; const d=await dfetch(base,url);
  const pkgRun=(String(url).match(/k\/(run-[0-9A-Za-z]+)/)||[])[1]||(L&&L.run&&(String(L.run).match(/k\/(run-[0-9A-Za-z]+)/)||[])[1])||'';
  if(!d){
    // An anonymous viewer holds only 'discover': the node publishes that the deliverable
    // EXISTS (files, hashes, metadata) but gates the BYTES to read+ tier (07_ARTIFACTS §10a).
    // Render the PUBLIC manifest from the discovered file-card records + how to read the bytes.
    const run=(String(url||'').match(/k\/(run-[0-9A-Za-z]+)/)||[])[1]||'';
    const files=(S.order||[]).map((id)=>S.recs.get(id)).filter((r)=>r&&r.kind==='artifact'
        && !((r._links||{}).bundle) && runOf(r)===run);
    let mh=`<div class="empty-card"><h3>${icon('key')} Deliverable — content is read-gated</h3>`
      +'<p class="desc2">This node publishes that the deliverable <b>exists</b> (file list, hashes, metadata) '
      +'to anonymous viewers, but serves the actual <b>bytes</b> only at <b>read+</b> tier '
      +'(07_ARTIFACTS §10a). To open the files: click <b>OPERATOR</b> and paste this node\'s '
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
  const cosigners=d.co_signers||Object.keys(d.co_signatures||{});
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
      const mark=nr?(_verdict('notrun')+' not_run'):(ok?(_verdict('pass')+' pass'):(_verdict('fail')+' fail'));
      // surface what the export already ships: the failure_kind on non-pass rows and
      // a kernel-signed mark when the evidence carries the kernel's signature.
      const fk=(!ok&&!nr&&e.failure_kind)?` <span class="no" title="failure kind">(${esc(e.failure_kind)})</span>`:'';
      const ks=e.signed_by_kernel?` <span class="ok" title="kernel-signed evidence">${icon('check','ico-sm')} kernel</span>`:'';
      return `<div class="grant"><span class="l2">${esc(e.command_or_api_fingerprint||e.stage_id||'check')}${ks}</span>`
        +`<span class="${cls}">${mark}${fk}</span></div>`;
    }).join('');
  } else {
    html+=H('Verifier evidence')+`<div class="l2">— none recorded (below verified) —</div>`;
  }
  if(rv.length){
    html+=H(`Review verdicts (${rv.length})`);
    html+=rv.slice(0,8).map((v)=>`<div class="grant"><span class="l2">${esc(v.reviewer_id||v.reviewer_persona_id||v.reviewer||'reviewer')}${v.signed_by?` <span class="ok" title="Ed25519 signed">${icon('check','ico-sm')} signed</span>`:''}</span>`
      +`<span class="${String(v.verdict||'').includes('accept')?'ok':'no'}">${esc(v.verdict||'—')}</span></div>`
      +(v.rationale?`<div class="desc2">${esc(String(v.rationale).slice(0,240))}</div>`:'')).join('');
  }
  // Co-signer identities — the export ships them, but the UI previously showed only a bare count.
  if(cosigners.length){
    html+=H(`Co-signers (${cosigners.length})`);
    html+=cosigners.map((c)=>`<div class="grant"><span class="l2">${esc(c)}</span><span class="ok" title="Ed25519 signed">${icon('check','ico-sm')} signed</span></div>`).join('');
  }
  html+=H(`Artifacts (${arts.length}) — click to view`)+renderArtifactTree(arts,pkgRun);
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

/* ====================================================================
   LAZY .mjs RENDERER REGISTRY (richer deliverable viewers)
   --------------------------------------------------------------------
   Each entry is a self-contained ES module under ./renderers/ that
   lazy-loads its own heavy CDN libs (via ctx.lazy) inside render().
   These OUTRANK the legacy inline EXT_RENDERER/KIND_RENDERER maps for
   any ext/kind they claim; on ANY throw the host falls back to the
   built-in renderer path (markdown/csv/code/image/pdf/plain/download).
   DISPATCH: extension is authoritative (zero collisions across modules);
   media_kind is the fallback (first-writer-wins, registry ordered most-
   specific → most-generic so 'pcb'→gerber, 'eda'→netlist, 'cad'→cad3d).
   ==================================================================== */
const LAZY_RENDERERS=[
  {file:'gerber.mjs',label:'PCB Gerber',exts:['gbr','ger','gtl','gbl','gto','gts','gko','gm1','drl','xln'],media_kinds:['gerber','excellon','drill','pcb','gerber-layer'],fetchMode:'text'},
  {file:'kicad.mjs',label:'KiCad',exts:['kicad_pcb','kicad_sch','kicad_pro','kicad_mod'],media_kinds:['kicad','schematic'],fetchMode:'text'},
  {file:'netlist.mjs',label:'netlist / SPICE',exts:['cir','net','spice','sp','ckt','asc','scs','spc','subckt'],media_kinds:['netlist','spice','circuit','eda'],fetchMode:'text'},
  {file:'dxf.mjs',label:'DXF drawing',exts:['dxf'],media_kinds:['dxf','drawing','mechanical','mechanical_drawing'],fetchMode:'text'},
  {file:'cad3d.mjs',label:'3D model',exts:['step','stp','stl','3mf','obj','gltf','glb','ply'],media_kinds:['cad3d','mesh','3d','model','step','stl','gltf','glb','obj','ply','3mf','cad'],fetchMode:'bytes'},
  {file:'pdf.mjs',label:'PDF',exts:['pdf'],media_kinds:['pdf','application/pdf'],fetchMode:'bytes'},
  {file:'waveform.mjs',label:'waveform',exts:['vcd','wavedrom','wave','wavejson'],media_kinds:['waveform','vcd','wavedrom','wavejson','timing'],fetchMode:'text'},
  {file:'table.mjs',label:'table',exts:['csv','tsv','bom'],media_kinds:['table','bom','csv','tsv','tab'],fetchMode:'text'},
  {file:'mdrich.mjs',label:'Markdown',exts:['md','markdown'],media_kinds:['md','markdown'],fetchMode:'text'},
  {file:'datatree.mjs',label:'structured data',exts:['json','yaml','yml','toml','ndjson'],media_kinds:['json','yaml','yml','toml','ndjson','datatree','structured','data'],fetchMode:'text'},
];
// Flattened ext → entry index (built once). Extensions are collision-free, so an
// ext hit is a definitive, unambiguous module choice.
const _LAZY_BY_EXT=new Map();
// media_kind → entry index, FIRST-WRITER-WINS over registry order so the
// deliberate most-specific→most-generic ordering encodes precedence for the
// resolved kind collisions (gerber>kicad 'pcb'; netlist>kicad 'eda'; cad3d 'cad').
const _LAZY_BY_KIND=new Map();
for(const e of LAZY_RENDERERS){
  for(const x of e.exts){ const xl=String(x).toLowerCase(); if(!_LAZY_BY_EXT.has(xl)) _LAZY_BY_EXT.set(xl,e); }
  for(const k of e.media_kinds){ const kl=String(k).toLowerCase(); if(!_LAZY_BY_KIND.has(kl)) _LAZY_BY_KIND.set(kl,e); }
}
// extOf grabs only the final dot-segment, so it can't see the multi-underscore
// KiCad suffixes (.kicad_pcb / .kicad_sch / .kicad_pro / .kicad_mod) — match the
// full filename suffix FIRST, then fall back to the single trailing token.
function lazyExtOf(title){
  const t=String(title||'').toLowerCase();
  for(const x of _LAZY_BY_EXT.keys()){ if(x.includes('_') && t.endsWith('.'+x)) return x; }
  return extOf(title);
}
// Resolve the lazy module entry for a file: EXTENSION first (authoritative),
// then media_kind (fallback only when the ext is absent/unknown). Returns
// {entry,ext} or null.
function pickLazyRenderer(title,kind){
  const ext=lazyExtOf(title);
  if(ext && _LAZY_BY_EXT.has(ext)) return {entry:_LAZY_BY_EXT.get(ext),ext};
  const k=String(kind||'').toLowerCase();
  if(k && _LAZY_BY_KIND.has(k)) return {entry:_LAZY_BY_KIND.get(k),ext};
  return null;
}
// Cached per-URL dynamic import — this is ctx.lazy passed into each module for
// its heavy CDN libs (esm.sh / jsdelivr), with a per-URL retry on failure.
const _LAZY_URL=new Map();
async function _lazy(url){
  if(_LAZY_URL.has(url)) return _LAZY_URL.get(url);
  const p=import(/* @vite-ignore */ url);
  p.catch(()=>_LAZY_URL.delete(url));   // failed load → allow a later retry
  _LAZY_URL.set(url,p); return p;
}
// Cached per-file import of the renderer module itself (lazy on first open).
const _LAZY_MOD=new Map();
async function _lazyModule(file){
  if(_LAZY_MOD.has(file)) return _LAZY_MOD.get(file);
  const p=import(/* @vite-ignore */ './renderers/'+file);
  p.catch(()=>_LAZY_MOD.delete(file));
  _LAZY_MOD.set(file,p); return p;
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
  // highlight.js tokenises the WHOLE string on the main thread; a multi-MB generated
  // bundle / huge xml would freeze the UI for seconds. The JSON path is already capped
  // above — cap every other code body too, falling back to scroll-able plain <pre>.
  else if((ctx.realSize??body.length)>400*1024){
    host.appendChild(plainPre(body,'code > 400 KB — plain text (perf, no highlight)')); return;
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
  a.href=dlHref(ctx.url); a.target='_blank'; a.rel='noopener'; a.setAttribute('download',''); a.textContent='download →';
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
  const forcedPlain=opts.raw===true;
  // LAZY .mjs registry takes precedence over the legacy inline maps for any
  // ext/kind it claims (richer viewers win). Resolved once; only used when this
  // is NOT a forced-plain/raw view (raw always shows the built-in plain text).
  const lazyPick=forcedPlain?null:pickLazyRenderer(title,kind);
  // fetchMode drives byte-vs-text fetch: a bytes module fetches its own
  // ArrayBuffer inside render(), so we must NOT do a pointless text prefetch.
  const lazyBytes=!!(lazyPick && lazyPick.entry.fetchMode==='bytes');
  // header media-kind label reflects the chosen renderer (lazy ext if matched).
  const lazyExt=lazyPick?lazyPick.ext:'';
  const isBinary=lazyPick?lazyBytes:BINARY_RENDERERS.has(pick.id);
  const rendId=forcedPlain?'plain':(lazyPick?('lazy:'+lazyPick.entry.file):pick.id);
  // text bodies fetched here; binaries deferred to their renderer (blob/buffer).
  let text=null, realSize=null;
  if(!isBinary){
    // a forced-plain view of a binary would show garbage, so only fetch text for texty kinds
    text=await fetchText(url); realSize=text?text.length:null;
  }
  const ctx={ base, path, url, title, kind, ext:(lazyPick?lazyExt:pick.ext), text, realSize, size:opts.size,
    contentHash:opts.contentHash||null };
  // a texty body that came back null (read-gated bytes / offline node / 404) would render
  // as a SILENT blank pane (the renderers consume the body and "succeed"); flag it.
  const bodyUnavailable=(!isBinary && !forcedPlain && text===null);
  const sizeLabel=realSize!=null?fmtBytes(realSize):(opts.size!=null?fmtBytes(opts.size):'—');
  const rawTog=forcedPlain
    ? `<a href="#" data-act="fv-rich" data-path="${esc(path)}" data-title="${esc(title)}" data-kind="${esc(kind||'')}" data-hash="${esc(opts.contentHash||'')}" data-size="${esc(opts.size??'')}">rich view ←</a>`
    : (rendId!=='plain'
        ? `<a href="#" data-act="fv-raw" data-path="${esc(path)}" data-title="${esc(title)}" data-kind="${esc(kind||'')}" data-hash="${esc(opts.contentHash||'')}" data-size="${esc(opts.size??'')}">raw text</a>`
        : '<span class="l2">raw</span>');
  let html=kv('File',esc(title))
    +kv('Media kind',`${esc(kind||ctx.ext||'—')} <span class="fv-rid">· ${esc(rendId)}</span>`)
    +`<div class="row"><span class="l2">Size</span><span class="v2 fv-size">${esc(sizeLabel)}</span></div>`
    +`<div class="row"><span class="l2">view</span><span class="v2">${rawTog} · `
    +`<a href="${esc(safeUrl(dlHref(url)))}" target="_blank" rel="noopener" download>download / open raw →</a></span></div>`
    +`<div id="fv-body" class="fv-body"></div>`;
  // EXISTING (legacy) renderer path — the FALLBACK used when no lazy module
  // matches, or when a matched lazy module throws (CDN/lib/parse/empty).
  const runLegacy=async(host,lazyErr)=>{
    const legacyId=forcedPlain?'plain':pick.id;
    const r=RENDERERS[legacyId]||renderPlain;
    const legacyBinary=BINARY_RENDERERS.has(legacyId);
    // A rich .mjs viewer was matched but failed (CDN offline / parse / no export),
    // and the only fallback for this ext/kind is bare plain text — say so once, so
    // the downgrade from the expected rich view isn't silent. (When the legacy path
    // is itself a real renderer the user still gets a good view; no note needed.)
    if(lazyErr && r===renderPlain){
      const why=String(lazyErr&&lazyErr.message||'load failed').slice(0,140);
      host.appendChild(el('div','fv-note',
        'rich '+(ctx.ext||kind||'')+' viewer unavailable ('+why+') — plain text below'));
    }
    try{ await r(host,ctx);   // size discovered during a binary fetch reflected by caller
    }catch(e){
      // GRACEFUL FALLBACK: CDN import failed / parse error → plain <pre>, never broken.
      host.innerHTML='';
      host.appendChild(el('div','fv-note','renderer unavailable ('+esc(e&&e.message||'error')+') — plain text'));
      let body=ctx.text;
      if(body==null){ body=legacyBinary?null:await fetchText(url); }
      if(body==null && legacyBinary){ host.appendChild(el('div','fv-note','body unavailable — the bytes are read-gated (read+ tier), the node is offline, or this file 404s. The download/open-raw link above may also be gated; hold an operator token or open this on the node\'s own machine.')); return; }
      host.appendChild(plainPre(String(body??'').slice(0,20000)));
    }
  };
  const mount=async(root)=>{
    const host=root.querySelector('#fv-body'); if(!host) return;
    if(bodyUnavailable){ host.innerHTML=''; host.appendChild(el('div','fv-note','body unavailable — the bytes are read-gated (read+ tier), the node is offline, or this file 404s. Use the download/open-raw link above, or hold an operator token.')); return; }
    // LAZY MODULE FIRST (richer renderer). On ANY throw, clear and fall back to
    // the existing legacy renderer path exactly as before — never broken/blank.
    let lazyErr=null;
    if(lazyPick && !forcedPlain){
      // Immediate spinner: the .mjs module import (a network round-trip on first
      // open) AND each module's own fetch/CDN-lib load happen BEFORE its render()
      // paints. Without this the drawer sits blank for that whole window. Every
      // module clears the host as its first paint, so this is replaced cleanly.
      host.innerHTML='';
      host.appendChild(loadingNode(`loading ${lazyPick.entry.label||ctx.ext||'rich'} viewer…`));
      try{
        const mod=await _lazyModule(lazyPick.entry.file);
        if(!mod || typeof mod.render!=='function') throw new Error('no render() export');
        // ctx per the module contract: createElement+textContent-safe el(),
        // authenticated fetchText/fetchBytes against the resolved body url,
        // version-pinned CDN loader (lazy), and a view-scoped onCleanup.
        const mctx={ host, title, path, url, ext:ctx.ext, kind, size:opts.size, contentHash:ctx.contentHash,
          esc, el, lazy:_lazy, onCleanup:onViewCleanup,
          // both provided; honor fetchMode for the default fetch but never deny either.
          text:lazyBytes?null:ctx.text,
          fetchText:async()=>{ if(!lazyBytes && ctx.text!=null) return ctx.text; return await fetchText(url); },
          fetchBytes:async()=>{ const fb=await fetchBlob(url); if(!fb){ return null; }
            ctx.realSize=fb.size; const ab=await fb.blob.arrayBuffer();
            // copy so libs that DETACH the buffer (pdf.js) can't corrupt a shared one
            return ab.slice(0); } };
        await mod.render(mctx);
        if(ctx.realSize!=null){ const sz=root.querySelector('.fv-size'); if(sz) sz.textContent=fmtBytes(ctx.realSize); }
        return;
      }catch(e){
        lazyErr=e;           // remember WHY so the fallback can explain a silent downgrade
        host.innerHTML='';   // clear the spinner / any partial render before falling back
      }
    }
    await runLegacy(host,lazyErr);
    if(ctx.realSize!=null){ const sz=root.querySelector('.fv-size'); if(sz) sz.textContent=fmtBytes(ctx.realSize); }
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
    +kv('Lineage durable',k.lineage_durable?`<span class="ok">${icon('check','ico-sm')} durable</span>`:'<span class="no">in-memory only</span>')
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
    +kv('Kernel',esc(r._kernel||'—'))+kv('Signature',`<span class="ok">${icon('check','ico-sm')} Ed25519 verified</span>`)+kv('Body anchor',esc(anchor))
    +kv('Events (this run)',esc(r.events));
  const gh=grants.length?grants.map((g)=>`<div class="grant"><span>${esc(g.grantee_kind)}:${esc((g.grantee_id||'').slice(0,18))||'*'}</span><span class="ok">${esc(g.access_level)}</span></div>`).join(''):'<div class="grant"><span>owner only</span><span></span></div>';
  html+=H('Capabilities')+chipsOf(r.capability_summary)+H(`Access · outward ${esc(a.outward_tier||r.visibility_tier)}`)+gh
    +H('Source')+`<div class="row"><a href="${esc(safeUrl(r._url))}" target="_blank" rel="noopener">signed record JSON →</a></div>`;
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
async function bodyView(base,runUrl){ S.curBase=base; const rj0=await dfetch(base,runUrl);
  if(!rj0) return {title:`<span class="kind k-persona">BODY · J7</span> codex run`,
    html:`<div class="viewerr">run document could not be loaded — the node may be offline or the body is read-gated; hold an operator token (or open on the node's machine) to view it.</div>`};
  const rj=rj0; const b=rj.body||{}, ex=rj.real_execution||{};
  let html=kv('Task class',esc(b.task_class||'—'))+kv('Pathway',esc(b.pathway||'—'))
    +kv('Accepted',b.accepted?`<span class="ok">${icon('check','ico-sm')} verified</span>`:`<span class="no">${icon('x','ico-sm')}</span>`)
    +kv('Verified by model',`<span class="ok">${esc(b.verified_by_model||'—')}</span>`)+kv('Program',esc((b.program_chars||0)+' chars'));
  const at=b.attempts||[]; if(at.length) html+=H('Codex model cascade')+at.map((a)=>`<div class="grant"><span class="${a.accepted?'ok':'no'}">${a.accepted?icon('check','ico-sm'):icon('x','ico-sm')} ${esc(a.model_id)}</span><span class="l2">${esc(a.status)} · ${esc(a.program_chars)} ch</span></div>`).join('');
  html+=H('Real sandbox execution')+kv('Result',ex.ok?'<span class="ok">ok</span>':'<span class="no">failed</span>')+kv('Return code',esc(ex.returncode))+kv('stdout',`<code>${esc(ex.stdout||'')}</code>`);
  html+=H(`Safety floor sources (${(b.safety_sources||[]).length} of 8)`)+chipsOf(b.safety_sources);
  return {title:`<span class="kind k-persona">BODY · J7</span> codex run`, html};
}
async function verifyView(base,runUrl){ S.curBase=base; const rj0=await dfetch(base,runUrl);
  if(!rj0) return {title:`<span class="kind k-env">VERIFICATION</span> cascade + floor`,
    html:`<div class="viewerr">run document could not be loaded — the node may be offline or the body is read-gated; hold an operator token (or open on the node's machine) to view it.</div>`};
  const rj=rj0; const bv=rj.bundle_verification||{}, rt=rj.ready_to_order||{};
  let html=kv('Bundle verified',bv.passed?`<span class="ok">${icon('check','ico-sm')} passed</span>`:`<span class="no">${icon('x','ico-sm')}</span>`)
    +kv('Final state',`<span class="ok">${esc(rt.state||'—')}</span>`)+kv('Locked',esc(rt.locked))+kv('Co-signers',esc((rt.co_signers||[]).join(', ')||'—'));
  html+=H('Verifier cascade')+(bv.invocations||[]).map((v)=>`<div class="grant"><span>${esc(v[0])}</span><span class="${v[1]?'ok':'no'}">${v[1]?icon('check','ico-sm'):icon('x','ico-sm')}</span></div>`).join('');
  const ev=rj.environment_rule_evidence||[]; if(ev.length) html+=H(`Env-rule evidence (${ev.length})`)+ev.map((e)=>`<div class="desc2">• ${esc(e.rule_name||e.rule_id||'rule')} — ${e.passed===false?`<span class="no">${icon('x','ico-sm')}</span>`:`<span class="ok">${icon('check','ico-sm')} signed</span>`}</div>`).join('');
  return {title:`<span class="kind k-env">VERIFICATION</span> cascade + floor`, html};
}
async function distributionView(base,L){ S.curBase=base;
  const oci0=await dfetch(base,L.oci), dag0=await dfetch(base,L.dag), reg0=await dfetch(base,L.registry);
  if(!oci0&&!dag0&&!reg0) return {title:`<span class="kind k-artifact">DISTRIBUTION</span> OCI + IPLD`,
    html:`<div class="viewerr">distribution documents could not be loaded — the node may be offline or the bodies are read-gated; hold an operator token (or open on the node's machine) to view them.</div>`};
  const oci=oci0||{}, dag=dag0||{}, reg=reg0||{};
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
  if(unmeasured.length) html+=`<div class="viewerr">${icon('warn','ico-sm')} ${unmeasured.length} objective(s) have no admissible evidence — their claimed numbers never scored (fail-closed).</div>`;
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
        +`<span class="l2">pressure ${esc(e.pressure_score)} (admissible ${e.pressure_admissible?`<span class="ok">${icon('check','ico-sm')}</span>`:`<span class="no">${icon('x','ico-sm')}</span>`}) · ReplicationBound ceiling ${esc(g.replication_bound_population_ceiling)}</span></div>`; }).join(''); }
  const ceiling=ref.physical_realization_ceiling||ref.manufacturability_ceiling;
  if(ceiling) html+=H('Physical-realization ceiling (honest)')+`<div class="l2">${esc(ceiling)}</div>`;
  return html;
}
// ---------- THE PLAN — the mission charter that drives a persona/env ----------
// An environment (and the personas inside it) exists to PURSUE a mission: a task
// charter with objective TARGETS climbed over budget-scaled ROUNDS, some BLOCKED,
// each value MEASURED or honestly unmeasured. The whole plan is served by the
// node at /runs/<run> (run_state() -> {run_state, design_history}) — the exact
// doc operatorRunView + missionDocHTML consume — and runOf() already resolves
// the run id an env/artifact carries. This surfaces that plan in the drawer the
// user actually opens (the persona/env), not only the separate MISSION card / op
// console. Read-gated like the run endpoint itself: operator token or a local
// node returns the doc; an anonymous viewer gets an honest pointer, never a fake.
async function planSection(base,run){
  if(!run) return '';
  const doc=await dfetch(base,'runs/'+encodeURIComponent(run));
  // run_state is operator-tier (09_PROTOCOLS §3G.3): no token (or a tunneled node
  // without one) -> no plan to show. Say WHY + HOW to unlock instead of nothing.
  if(!doc||(!doc.run_state&&!doc.design_history)){
    return H('Plan')+`<div class="l2">${icon('key','ico-sm')} this mission's charter, objectives and round-by-round trajectory are <b>read-gated</b> (operator tier). Click <b>OPERATOR</b> and paste this node's token, or open the page on the node's own machine (localhost = operator), to see the plan for <code>${esc(run)}</code>.</div>`;
  }
  const rs=doc.run_state||{}, dh=doc.design_history||rs.refinement_mission||{};
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  // headline state — reuse the mission-card state chips (running/paused/shipped/converged)
  const stt=String(rs.status||dh.final_status||'—');
  const conv=dh.converged===true;
  const stCls=conv?'ms-converged':(stt==='shipped'||stt==='completed'||rs.accepted)?'ms-shipped'
    :(stt==='running'||stt==='queued')?'ms-running':(/budget|paused/.test(stt)?'ms-paused':'ms-shipped');
  const stLbl=conv?'CONVERGED':String(stt||'—').toUpperCase();
  let html=H('Plan — the mission charter');
  // CHARTER: the human task this env/persona is pursuing (the reason it exists).
  const task=String(rs.task||dh.task||'');
  if(task) html+=`<div class="desc2">${esc(task.slice(0,400))}</div>`;
  html+=kv('State',`<span class="mstate ${stCls}">● ${esc(stLbl)}</span>`
      +(conv?'':(dh.converged===false?' <span class="l2">reopen-eligible</span>':'')))
    +kv('Backend',S0(rs.task_class||dh.backend))
    +kv('Best-so-far',(dh.best_so_far_score!=null?`<b class="ok">${Number(dh.best_so_far_score).toFixed(4)}</b>`
        :(rs.best_score!=null?`<b class="ok">${Number(rs.best_score).toFixed(4)}</b>`:'—'))
      +(dh.best_so_far_ref?` <span class="l2">${esc(String(dh.best_so_far_ref).slice(0,18))}</span>`:''));
  // CURRENT ROUND — the live front of the plan: where the mission is right now.
  const traj=dh.trajectory||[];
  const last=traj.length?traj[traj.length-1]:null;
  if(last){
    const blk=(last.blocked_targets||[]);
    html+=kv('Round',`<b>r${esc(last.round)}</b> <span class="l2">${esc(last.candidates_explored||0)} candidate(s) explored`
      +(last.marginal_value!=null?` · <span class="${last.marginal_value>=0?'ok':'down'}">Δ${Number(last.marginal_value).toFixed(4)}</span>`:'')+`</span>`);
    if(blk.length) html+=`<div class="viewerr">${icon('warn','ico-sm')} blocked this round: ${esc(blk.join(', '))} — the mission honest-blocked rather than fabricate a value.</div>`;
  }
  // OBJECTIVES / TARGETS — baseline -> current -> ideal, each stamped with the
  // evidence that credited it (MEASURED vs claimed-but-unmeasured). The plan's spine.
  const targets=dh.objective_targets||[];
  const fin=dh.final_objective||{}; const evd=dh.objective_evidence||rs.objective_evidence||{};
  if(targets.length){
    html+=H('Objectives — baseline → current → ideal (every value carries its evidence)');
    html+=targets.map((t)=>{ const cur=fin[t.name]; const dir=t.direction==='minimize'?'↓':'↑';
      return `<div class="grant"><span>${esc(t.name)} ${dir} ${evBadge(evd[t.name])}</span>`
        +`<span class="l2">base ${esc(t.baseline)} → <b class="ok">${esc(cur!=null?cur:t.current)}</b> · ideal ${esc(t.ideal)}</span></div>`; }).join('');
    const unmeasured=targets.filter((t)=>String((evd[t.name]||{}).evidence_strength||'unmeasured')==='unmeasured');
    if(unmeasured.length) html+=`<div class="viewerr">${icon('warn','ico-sm')} ${unmeasured.length} objective(s) have no admissible evidence — their claimed numbers never scored (fail-closed).</div>`;
  } else if(rs.objective_evidence||dh.objective_evidence){
    const ev=rs.objective_evidence||dh.objective_evidence;
    html+=H('Objective evidence basis')+Object.entries(ev).map(([n,e2])=>{
      const es=(e2||{}).evidence_strength||'—';
      const cls=(es==='executed'||es==='executed_attested'||es==='attested')?'ok':(es==='unmeasured'?'no':'amber');
      return `<div class="grant"><span class="l2">${esc(n)}</span><span class="${cls}">${esc(String(es).replace(/_/g,' '))}</span></div>`;
    }).join('');
  }
  // open the full ADR-0071 trajectory (the same operator RUN view) for the deep dive.
  html+=`<div class="row"><a href="#" data-act="op-run" data-base="${esc(base)}" data-run="${esc(run)}">full mission trajectory (round-by-round) →</a></div>`;
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
// Render an opPost result into the #op-out pane with legible hints for the two most
// common operator failures (bad/missing token; unreachable node), then the raw JSON.
function showOpResult(out,r,suffix){
  let hint='';
  if(r.status===401||r.status===403) hint='authorization failed — this node rejected the token. Re-check it in the OPERATOR console (forget, then re-paste), or open the node\'s localhost UI where loopback grants access.\n\n';
  else if(r.status===0) hint='could not reach the node'+((r.body&&r.body.error)?' — '+String(r.body.error).slice(0,200):'')+'\n\n';
  const head=r.status===0?'HTTP 0 (no response)':`HTTP ${r.status}`;
  out.textContent=hint+head+'\n'+JSON.stringify(r.body,null,1).slice(0,1600)+(suffix||'');
  // colour the result pane off the status the call already computed: 2xx = ok (green
  // edge), everything else (auth/guard/unreachable) = err (danger edge). Additive
  // classes the design system styles; cleared each render so a retry re-derives them.
  const ok=r.status>=200&&r.status<300;
  out.classList.remove('is-ok','is-err'); out.classList.add(ok?'is-ok':'is-err');
}
// neutral 'in-progress' state for the result pane (clears any prior ok/err edge so a
// new submission doesn't keep the previous verdict colour while it awaits the network).
function opPending(out,msg){ if(!out) return; out.textContent=msg||'submitting…';
  out.classList.remove('is-ok','is-err'); }
// flag an operator field as invalid (red ring) for a failed inline guard; the flag
// clears itself the next time the user edits the field. No data/contract change —
// aria-invalid is presentational + a11y only.
function opInvalid(el){ if(!el) return; el.setAttribute('aria-invalid','true');
  const clear=()=>{ el.removeAttribute('aria-invalid'); el.removeEventListener('input',clear); };
  el.addEventListener('input',clear); el.focus&&el.focus(); }
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
    +`<label class="field"><span class="field-label">node base URL</span>`
    +`<input id="op-base" type="url" placeholder="e.g. http://localhost:8765" value="${esc(opBaseKey(peerList()[0]||''))}"></label>`
    +`<label class="field"><span class="field-label">operator token</span>`
    +`<input id="op-token" type="password" placeholder="paste the per-install token"></label>`
    +`<button class="btn btn-primary" data-act="op-save">SAVE</button></div><div id="op-save-msg" class="l2" role="status" aria-live="polite"></div>`;
  html+=H(`Operator nodes (${bases.length})`);
  for(const b of bases){ const loc=isLocalBase(b), tokd=!!(m[b]);
    html+=`<div class="grant"><span>${esc(b)}${loc&&!tokd?' <span class="ok">· local · token bypassed (loopback)</span>':''}</span>`
    +`<span><a href="#" data-act="op-node" data-base="${esc(b)}">console →</a>`
    +(tokd?` · <a href="#" data-act="op-del" data-base="${esc(b)}">forget ${icon('x','ico-sm')}</a>`:'')+`</span></div>`; }
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
    +kv('Lineage',st.lineage_durable?`<span class="ok">${icon('check','ico-sm')} durable</span>`:(pub?'—':'<span class="no">in-memory only</span>'))
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
  html+=H(`Human attestation${att.length?` — needed (${att.length}) — mission honest-blocked`:''}`);
  if(!att.length){
    html+=`<div class="l2">`+(pub
      ?`operator-only — attestation requests appear here once you have owner access (paste the token, or open the node's localhost UI).`
      :`${icon('check','ico-sm')} no mission is blocked on human attestation right now. When a persona honest-blocks on an external capability it cannot self-provision (a hardware instrument, a credential, a paid API…), it appears here with an <b>ATTEST</b> form.`)+`</div>`;
  } else {
    html+=att.map((a)=>{
      const blocks=(a.blocks||[]).map((bk)=>
        `<div class="grant"><span class="amber">${esc(bk.capability||bk.kind||'capability')}</span>`
        +`<span class="l2">${esc(bk.target||'')} ${esc((bk.reason||'').slice(0,90))}</span></div>`).join('');
      return `<div class="grant"><span>${esc(a.run)}</span><span class="l2">${esc((a.task||'').slice(0,60))}</span></div>`+blocks
        +`<div class="opform">`
        +`<label class="field"><span class="field-label">attestation statement</span>`
        +`<input class="op-att-stmt" data-run="${esc(a.run)}" placeholder="what you provisioned / verified (signed into the run)"></label>`
        +`<label class="field"><span class="field-label">smoke test (optional)</span>`
        +`<textarea class="op-att-smoke" data-run="${esc(a.run)}" rows="2" placeholder="Python, runs in the real sandbox; a failing probe REFUSES the attestation; passing output becomes EXECUTED evidence"></textarea></label>`
        +`<div class="oprow"><button class="btn" data-act="op-attest" data-base="${esc(b)}" data-run="${esc(a.run)}">${icon('attest')} ATTEST</button></div></div>`;
    }).join('');
  }
  html+=H('Ask the node — owner intake')
    +`<div class="opform"><label class="field"><span class="field-label">task</span>`
    +`<textarea id="op-task" rows="3" placeholder="any task in any field — the domain emerges at runtime"></textarea></label>`
    +`<div class="oprow"><label class="field"><span class="field-label">budget</span>`
    +`<input id="op-budget" type="number" min="1" placeholder="optional for ASK · required for FUND"></label>`
    +`<button class="btn btn-primary" data-act="op-ask" data-base="${esc(b)}" title="start a new mission from the task above (budget optional)">${icon('ask')} ASK</button>`
    +`<button class="btn" data-act="op-fund" data-base="${esc(b)}" title="add budget to a run — resumes a paused mission (needs a run id target, or it funds the node intake)">${icon('fund')} FUND</button>`
    +`<label class="field"><span class="field-label">run id (optional)</span>`
    +`<input id="op-run-target" placeholder="stop / fund target"></label>`
    +`<button class="btn btn-stop" data-act="op-stop" data-base="${esc(b)}" title="halt the targeted run, or ALL active runs if no run id is entered">${icon('stop')} STOP</button></div>`
    +`<pre id="op-out" class="opout" role="status" aria-live="polite"></pre></div>`;
  // Owner-class creation: environments form via the full §12c/§15 ceremony;
  // personas are OPERATOR-seeded souls (personas still never self-author).
  html+=H('Create — environment / persona (owner authority)')
    +`<div class="opform"><div class="oprow">`
    +`<label class="field"><span class="field-label">environment name</span><input id="op-env-name" placeholder="new environment"></label>`
    +`<label class="field"><span class="field-label">charter (optional)</span><input id="op-env-desc" placeholder="purpose / charter line"></label>`
    +`<button class="btn" data-act="op-newenv" data-base="${esc(b)}">${icon('env_new')} NEW ENV</button></div>`
    +`<div class="oprow">`
    +`<label class="field"><span class="field-label">persona name</span><input id="op-p-name" placeholder="new persona"></label>`
    +`<label class="field"><span class="field-label">role</span><input id="op-p-role" placeholder="default member"></label>`
    +`<label class="field"><span class="field-label">description (optional)</span><input id="op-p-desc" placeholder="short description"></label>`
    +`<button class="btn" data-act="op-newpersona" data-base="${esc(b)}">${icon('persona_new')} NEW PERSONA</button></div></div>`;
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
      +`<label class="field"><span class="field-label">environment id (optional)</span><input id="op-mcp-env" placeholder="env id"></label>`
      +`<label class="field"><span class="field-label">tool</span><input id="op-mcp-tool" placeholder="e.g. sandbox_exec"></label>`
      +`<label class="field"><span class="field-label">args JSON</span><input id="op-mcp-args" placeholder='{"code":"print(42)"}'></label>`
      +`<button class="btn" data-act="op-mcpcall" data-base="${esc(b)}">${icon('tool')} CALL</button></div></div>`;
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
    +'<label class="field"><span class="field-label">add budget</span><input id="opr-budget" type="number" min="1" placeholder="candidates"></label>'
    +'<button class="btn" data-act="op-fund" data-base="'+esc(b)+'" data-run="'+esc(run)+'" title="add budget to THIS run — resumes it if paused">'+icon('fund')+' FUND</button>'
    +'<button class="btn btn-stop" data-act="op-stop" data-base="'+esc(b)+'" data-run="'+esc(run)+'" title="halt THIS run">'+icon('stop')+' STOP</button></div>'
    +'<pre id="op-out" class="opout" role="status" aria-live="polite"></pre></div>';
  html+=kv('Run',`<code>${esc(run)}</code>`)
    +kv('Status',`<span class="${stClass}">● ${esc(stt)}</span>`)
    +kv('Accepted',rs.accepted?`<span class="ok">${icon('check','ico-sm')} yes</span>`:'<span class="no">no</span>')
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
    +kv('Bundle state',S0(ap.artifact_bundle_state))+kv('Signed',ap.signed_by?`<span class="ok">${icon('check','ico-sm')}</span>`:`<span class="no">${icon('x','ico-sm')}</span>`);
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

async function viewFor(id){ const r=S.recs.get(id); if(!r) return {title:'—',html:'<div class="viewerr">'+icon('warn','ico-sm')+' record not found — it may have been re-resolved or evicted since you clicked. Close this and reopen from the stage.</div>'};
  const L=r._links||{};
  if(r.kind==='artifact' && _isMissionDoc(r,L)) return missionView(r);
  if(r.kind==='mission' && L.content) return missionView(r);
  if(r.kind==='persona') return personaView(r);
  if(r.kind==='env') return envView(r);
  if(r.kind==='domain') return domainView(r);
  if(r.kind==='project') return projectView(r);
  if(r.kind==='telemetry') return telemetryView(r);
  if(r.kind==='artifact' && L.bundle) return bundleView(r._base||'',L.bundle,L);
  if(r.kind==='artifact'){
    // File artifact: prefer the explicit content link; otherwise derive the served path from the
    // package-relative title (artifacts/package/<title>) so an art-chip whose record carries no
    // content link still opens. _bodyPath adds the k/<run>/ prefix to hit the served bytes.
    const cpath=L.content||((r.title||r.label)?('artifacts/package/'+(r.title||r.label)):'');
    const _b=r._base||'';
    if(cpath) return fileView(_b, /k\/run-/.test(_b)?cpath:_bodyPath(cpath,runOf(r)), r.label, L.media_kind);
  }
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
  // monotonic guard: top() awaits the network (file/bundle/body views), and Back /
  // pushView call renderTop without serialization. A stale in-flight render must not
  // write LAST and show a view the user already navigated away from — latest wins.
  const gen=(S._renderGen=(S._renderGen||0)+1);
  $('#detailbody').innerHTML='<div class="fv-loading">resolving…</div>';
  let v; try{ v=await top(); }catch(e){ v={title:'error',html:'<div class="l2">'+esc(e.message)+'</div>'}; }
  if(gen!==S._renderGen) return;
  $('#detail-title').innerHTML=v.title; $('#detailbody').innerHTML=v.html;
  $('#detailback').hidden=S.views.length<=1; $('#detailbody').scrollTop=0;
  // A11y: move focus into the dialog ONLY after its accessible name (the title) is
  // populated, and only when the drawer is open and focus isn't already inside it.
  // Re-anchors focus on Back/nav when the clicked control was hidden/removed, so focus
  // never escapes the trap to <body>. (Replaces the eager pre-title-populate focus().)
  const dw=$('#detailwrap'); if(dw&&dw.classList.contains('open')&&!dw.contains(document.activeElement)) $('.drawer')?.focus();
  // optional async post-mount step (media renderers paint into a container here)
  if(typeof v.mount==='function'){ try{ await v.mount($('#detailbody')); }catch(e){} if(gen!==S._renderGen) return; }
}
function pushView(fn){ S.views.push(fn); renderTop(); }
function openDetail(id){ S._topIsOp=false; S._lastFocus=document.activeElement;
  // focus moves into the drawer in renderTop(), AFTER the title (accessible name) is painted.
  S.views=[()=>viewFor(id)]; $('#detailwrap').classList.add('open'); renderTop(); }

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
  // skip STALE cache entries: if a node goes unreachable, fetchNodeStatus only WRITES
  // on success, so a vanished node's last 'run-X RUNNING' would otherwise linger here as
  // a phantom card forever. Drop entries older than ~4 poll windows of the 8s serve-TTL.
  const fresh=Date.now()-32000;
  for(const [base,hit] of statusCache){ const v=hit&&hit.v; if(!v) continue;
    if(!(hit.ts>fresh)) continue;
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
  // Design-system nav family: promote the static index.html nav controls additively
  // (KEEP every id + the .link/.con-toggle classes the JS/CSS read) — the back control
  // becomes a ghost nav-back button, close/unfollow/collapse join the .ghost-btn family,
  // and their glyph text is swapped to the stroked icon set. Purely presentational +
  // a11y: no data/contract change, and a missing node is tolerated (?. guards).
  const _adopt=(sel,cls,iconName,label)=>{ const el=$(sel); if(!el) return;
    cls.split(' ').forEach((c)=>el.classList.add(c));
    if(iconName) el.innerHTML=icon(iconName)+(label?`<span>${label}</span>`:''); };
  _adopt('#detailback','nav-back ghost-btn','back','back');
  _adopt('#detailclose','ghost-btn','close','');
  _adopt('#logclose','ghost-btn','close','');
  _adopt('#introclose','ghost-btn','close','');
  _adopt('#cfUnfollow','ghost-btn','close','show all');
  // the constellation toggle keeps its rotate transform — only adopt the family class
  // + swap its ▾ for the shared disclosure chevron (CSS rotates it on .collapsed).
  const ct=$('#conToggle'); if(ct){ ct.classList.add('ghost-btn'); ct.innerHTML=icon('chevron'); }
  // the help button (？) → stroked help-circle (keeps its aria-label/title text).
  const hbtn=$('#helpbtn'); if(hbtn) hbtn.innerHTML=icon('help');
  // ＋ PEER → stroked plus + label (keeps the button's accessible text on the label span).
  const ap=$('#addpeer'); if(ap) ap.innerHTML=icon('plus')+'<span>PEER</span>';
  // keyboard access: Enter/Space activates any focusable [data-pcard]/[data-envrec]/
  // [data-artid]/[data-gp]/.mcard control (they carry role="button" tabindex="0").
  document.addEventListener('keydown',(e)=>{ if(e.key!=='Enter'&&e.key!==' ') return;
    // the ◎ follow button lives INSIDE the card, so Enter/Space would otherwise walk up to
    // the .pc-card and open the drawer — short-circuit it so follow is keyboard-reachable.
    const fb=e.target.closest('[data-follow]'); if(fb){ e.preventDefault(); fb.click(); return; }
    const t=e.target.closest('[data-pcard],[data-envrec],[data-artid],[data-gp],.mcard'); if(!t) return;
    e.preventDefault(); t.dispatchEvent(new MouseEvent('click',{bubbles:true})); });
  // coordination-feed filters: ALL · COORD · VERIFY · SHIP · CROSS-ENV
  $('#sysStreamTabs').addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b)return;
    S.sysFlt=b.dataset.flt; [...e.currentTarget.children].forEach((c)=>{ c.classList.toggle('on',c===b); c.setAttribute('aria-pressed',String(c===b)); }); renderInteractionStream(); });
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
    if(open && S._topIsOp){ closeDetail(); return; }   // closeDetail clears _topIsOp, restores focus, and tears down the active view
    S._lastFocus=document.activeElement;
    S.views=[()=>operatorView()]; S._topIsOp=true;
    $('#detailwrap').classList.add('open'); renderTop(); });   // focus moves in via renderTop() after the title paints
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
    if(c.dataset.mrun){ S._lastFocus=document.activeElement;
      S.views=[()=>operatorRunView(c.dataset.mbase||'',c.dataset.mrun)];
      $('#detailwrap').classList.add('open'); renderTop(); } });   // focus moves in via renderTop() after the title paints
  // in-drawer navigation: follow links to other records / bundles / artifact files
  $('#detailbody').addEventListener('click',(e)=>{
    // click a collapsed model-output to expand it in place (no nav). Guard against the
    // copy button living inside the same block so copying doesn't also expand.
    const clamped=e.target.closest('.opmsg.clamp');
    if(clamped && !e.target.closest('.copy-btn')){ clamped.classList.remove('clamp'); return; }
    const a=e.target.closest('[data-act]'); if(!a) return; e.preventDefault();
    const act=a.dataset.act, base=S.curBase||'';
    // COPY: lift the full text of the cognition/script surface this button hangs on
    // (the thinking frame's exact prompt, a model output, sandbox stdout) to the
    // clipboard — these are often truncated/scrolled, so reading != copyable.
    if(act==='copy'){ copyFromButton(a); return; }
    if(act==='tdir'){ const key=a.dataset.key, wasCollapsed=a.dataset.collapsed==='1';
      if(!S.bundleDirs)S.bundleDirs=new Set(); if(!S.bundleDirsOpen)S.bundleDirsOpen=new Set();
      // flip the effective state regardless of depth-default; explicit sets win over the default
      if(wasCollapsed){ S.bundleDirs.delete(key); S.bundleDirsOpen.add(key); }
      else { S.bundleDirsOpen.delete(key); S.bundleDirs.add(key); }
      const sc=$('#detailbody').scrollTop; renderTop().then(()=>{ $('#detailbody').scrollTop=sc; }); return; }
    if(act==='op-save'){ let raw=$('#op-base').value.trim(); if(raw && !/^https?:\/\//i.test(raw)) raw=(location.protocol==='https:'?'https://':'http://')+raw; const nb=opBaseKey(raw), tv=$('#op-token').value.trim();
      if(nb&&tv){ const m2=opTokens(); m2[nb]=tv; opSaveTokens(m2); S.views[S.views.length-1]=()=>operatorView(); renderTop(); discover(); }
      else { const msg=$('#op-save-msg'); if(msg) msg.textContent = !nb ? 'enter the node base URL first' : 'enter the operator token first'; }
      return; }
    if(act==='op-del'){ const m2=opTokens(); delete m2[a.dataset.base]; opSaveTokens(m2);
      S.views[S.views.length-1]=()=>operatorView(); renderTop(); return; }
    if(act==='op-node'){ pushView(()=>operatorNodeView(a.dataset.base)); return; }
    if(act==='op-run'){ pushView(()=>operatorRunView(a.dataset.base,a.dataset.run)); return; }
    if(act==='op-attest'){ const b2=a.dataset.base, run=a.dataset.run, out=$('#op-out');
      const done=()=>{ a.dataset.busy=''; a.disabled=false; a.removeAttribute('aria-busy'); };
      const sel=(window.CSS&&CSS.escape)?CSS.escape(run):run;
      const inp=document.querySelector(`.op-att-stmt[data-run="${sel}"]`);
      const smokeEl=document.querySelector(`.op-att-smoke[data-run="${sel}"]`);
      const statement=(inp&&inp.value||'').trim();
      const smoke_test=(smokeEl&&smokeEl.value||'').trim();
      if(!statement){ if(out) out.textContent='describe what you provisioned/verified first — the statement is signed into the run'; opInvalid(inp); return; }
      if(a.dataset.busy) return; a.dataset.busy='1'; a.disabled=true; a.setAttribute('aria-busy','true');
      opPending(out,smoke_test?'running smoke test in the sandbox, then signing…':'signing human attestation…');
      opPost(b2,'attest',{run,statement,smoke_test}).then((r)=>{ done();
        if(out){ showOpResult(out,r,(r.status>=200&&r.status<300)?'\n\n→ now FUND the mission to resume with the attested capability.':''); out.scrollIntoView({block:'nearest'}); }
        if(r.status>=200&&r.status<300){ S.views[S.views.length-1]=()=>operatorNodeView(b2);
          const sc=$('#detailbody').scrollTop; setTimeout(()=>renderTop().then(()=>{ $('#detailbody').scrollTop=sc; }),3500); } });
      return; }
    if(act==='op-newenv'||act==='op-newpersona'||act==='op-mcpcall'){ const b2=a.dataset.base, out=$('#op-out');
      const done=()=>{ a.dataset.busy=''; a.disabled=false; a.removeAttribute('aria-busy'); };
      const show=(r)=>{ done();
        if(out){ showOpResult(out,r); out.scrollIntoView({block:'nearest'}); }
        // leave the result readable, then refresh the console so the new entity shows
        if(r.status>=200&&r.status<300){ S.views[S.views.length-1]=()=>operatorNodeView(b2);
          const sc=$('#detailbody').scrollTop; setTimeout(()=>renderTop().then(()=>{ $('#detailbody').scrollTop=sc; }),3000); } };
      if(act==='op-newenv'){ const nf=$('#op-env-name'); const name=(nf?.value||'').trim();
        if(!name){ if(out) out.textContent='enter an environment name first'; opInvalid(nf); return; }
        if(a.dataset.busy) return; a.dataset.busy='1'; a.disabled=true; a.setAttribute('aria-busy','true');
        opPending(out,'forming environment (full §12c ceremony)…');
        opPost(b2,'env',{name,description:($('#op-env-desc')?.value||'').trim()}).then(show); }
      else if(act==='op-newpersona'){ const nf=$('#op-p-name'); const name=(nf?.value||'').trim();
        if(!name){ if(out) out.textContent='enter a persona name first'; opInvalid(nf); return; }
        if(a.dataset.busy) return; a.dataset.busy='1'; a.disabled=true; a.setAttribute('aria-busy','true');
        opPending(out,'seeding persona…');
        opPost(b2,'persona',{name,role:($('#op-p-role')?.value||'').trim()||'member',
          description:($('#op-p-desc')?.value||'').trim()}).then(show); }
      else { const tf=$('#op-mcp-tool'); const tool=(tf?.value||'').trim();
        if(!tool){ if(out) out.textContent='enter a tool name first'; opInvalid(tf); return; }
        const af=$('#op-mcp-args'); let args={}; try{ args=JSON.parse((af?.value||'').trim()||'{}'); }
        catch(e){ if(out) out.textContent='args must be valid JSON'; opInvalid(af); return; }
        if(a.dataset.busy) return; a.dataset.busy='1'; a.disabled=true; a.setAttribute('aria-busy','true');
        opPending(out,'calling (kernel-mediated, sandboxed)…');
        opPost(b2,'mcp/call',{environment_id:($('#op-mcp-env')?.value||'').trim(),tool,args})
          .then((r)=>{ done(); if(out){ showOpResult(out,r); out.scrollIntoView({block:'nearest'}); } }); }
      return; }
    if(act==='op-ask'||act==='op-fund'||act==='op-stop'){ const b2=a.dataset.base, out=$('#op-out');
      // a run-scoped control (operatorRunView's inline FUND/STOP) carries the run on the
      // button; prefer it over the console-level #op-run-target field.
      const run=(a.dataset.run||$('#op-run-target')?.value||'').trim();
      // when the button is run-scoped, re-render the SAME run (so a phone stays on the
      // run it just funded/halted and re-fetches THAT run's status), not the parent node.
      const isRunScoped=!!a.dataset.run;
      const done=()=>{ a.dataset.busy=''; a.disabled=false; a.removeAttribute('aria-busy'); };
      // ASK/FUND/STOP mutate node state — leave the JSON visible briefly, then re-render
      // the console so the new run / updated paused list shows (mirrors op-newenv).
      const show=(r)=>{ done();
        if(out){ showOpResult(out,r); out.scrollIntoView({block:'nearest'}); }
        if(r.status>=200&&r.status<300){ const bi=$('#opr-budget')||$('#op-budget'); if(bi) bi.value='';   // clear the budget so the 3s re-render window can't double-fund
          S.views[S.views.length-1]= isRunScoped ? (()=>operatorRunView(b2,run)) : (()=>operatorNodeView(b2));
          const sc=$('#detailbody').scrollTop; setTimeout(()=>renderTop().then(()=>{ $('#detailbody').scrollTop=sc; }),3000); } };
      if(a.dataset.busy) return; a.dataset.busy='1'; a.disabled=true; a.setAttribute('aria-busy','true');
      if(act==='op-ask'){ const tf=$('#op-task'); const text=(tf?.value||'').trim(); if(!text){ if(out) out.textContent='enter a task first'; opInvalid(tf); done(); return; }
        const body={text}; const bd=+($('#op-budget')?.value||0); if(bd>0) body.budget=bd;
        opPending(out,'submitting…'); opPost(b2,'task',body).then(show); }
      else if(act==='op-fund'){ const bf=$('#opr-budget')||$('#op-budget'); const bd=+(($('#opr-budget')?.value)||($('#op-budget')?.value)||0); if(!(bd>0)){ if(out) out.textContent='enter a budget > 0'; opInvalid(bf); done(); return; }
        const body={budget:bd}; if(run) body.run=run;
        opPending(out,'funding…'); opPost(b2,'budget',body).then(show); }
      else { if(!run && !confirm('No run id entered — stop ALL active missions on this node?')){ done(); return; }
        const body={}; if(run) body.run=run;
        opPending(out,'stopping…'); opPost(b2,'stop',body).then(show); }
      return; }
    if(act==='rec') pushView(()=>viewFor(a.dataset.id));
    else if(act==='file'){ const o={contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null};
      pushView(()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,o)); }
    else if(act==='fv-raw'){ // swap the CURRENT file view to forced plain text (re-render in place)
      S.views[S.views.length-1]=()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,{raw:true,contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null}); renderTop(); }
    else if(act==='fv-rich'){ // swap back to the rich media renderer
      S.views[S.views.length-1]=()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,{contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null}); renderTop(); }
    else if(act==='bundle'){ const br=a.dataset.rec?S.recs.get(a.dataset.rec):null; pushView(()=>bundleView(base,a.dataset.url,br?br._links:undefined)); }
    else if(act==='body') pushView(()=>bodyView(base,a.dataset.url));
    else if(act==='verify') pushView(()=>verifyView(base,a.dataset.url));
    else if(act==='physical') pushView(()=>physicalView(base,a.dataset.url));
    else if(act==='dist') pushView(()=>distributionView(base,{oci:a.dataset.oci,dag:a.dataset.dag,registry:a.dataset.reg})); });
  $('#detailback').addEventListener('click',()=>{ S.views.pop(); renderTop(); });
  // dialog focus management: save the trigger, move focus into the panel on open,
  // restore it on close (a11y — overlays are role=dialog aria-modal).
  const closeLog=()=>{ $('#logmodal').classList.remove('open');
    if(S._lastFocusLog){ try{ S._lastFocusLog.focus(); }catch(e){} S._lastFocusLog=null; } };
  const closeDetail=()=>{
    // Closing the drawer over a 3D/PDF view must run the active view's teardown
    // (renderer.dispose/forceContextLoss, URL.revokeObjectURL) — runViewCleanups()
    // only ran at the top of renderTop(), so closing here leaked WebGL/object-URLs.
    // Clear the drawer-live keys too, or the 5s loop keeps fetching feed/thinking
    // against the now-hidden drawer forever.
    runViewCleanups();
    S.drawerLiveKind=S.drawerLiveId=S.drawerLiveFeed=S.drawerThinkPid=null; S.drawerLiveBase='';
    $('#detailwrap').classList.remove('open'); S._topIsOp=false;
    if(S._lastFocus){ try{ S._lastFocus.focus(); }catch(e){} S._lastFocus=null; } };
  $('#logbtn').addEventListener('click',()=>{ S._lastFocusLog=document.activeElement;
    $('#logmodal').classList.add('open'); $('.logcard')?.focus(); });
  $('#logclose').addEventListener('click',closeLog);
  $('#logmodal').addEventListener('click',(e)=>{ if(e.target.id==='logmodal') closeLog(); });
  $('#detailclose').addEventListener('click',closeDetail);
  $('#detailwrap').addEventListener('click',(e)=>{ if(e.target.id==='detailwrap') closeDetail(); });
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape'){ closeLog(); closeDetail(); return; }
    // Tab focus trap: both .drawer and .logcard are aria-modal — keep Tab inside the open
    // overlay instead of letting it walk into the page behind it.
    if(e.key!=='Tab') return;
    const wrap=$('#detailwrap')?.classList.contains('open')?$('#detailwrap')
      :($('#logmodal')?.classList.contains('open')?$('#logmodal'):null);
    if(!wrap) return;
    const panel=wrap.querySelector('.drawer,.logcard')||wrap;
    const foc=[...panel.querySelectorAll('a[href],button:not([disabled]),input,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter((n)=>n.offsetParent!==null);
    if(!foc.length) return;
    const first=foc[0], last=foc[foc.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  });
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
