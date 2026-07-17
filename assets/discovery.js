import * as ed from './noble-ed25519.js';
import {
  artifactSemanticLabels,
  boundedLineDiff,
  decideLiveArtifactUpdate,
  endLiveArtifactState,
  finalizeLiveArtifactState,
  LIVE_ARTIFACT_LIMITS,
  liveBodyCommitIsCurrent,
  liveArtifactFileKey,
  liveArtifactRunKey,
  sha256Hex,
  terminalLiveArtifactCalls,
  transitionLiveArtifacts,
} from './live-artifacts.mjs?v=20260716-finalized-state-v2';
import {
  verifyLiveArtifactEvent,
  verifyLiveArtifactSnapshot,
} from './live-signatures.mjs?v=20260716-finalized-state-v1';
import {
  currentMasterKey,
  evaluatePublicRecordAccess,
  hydrateProviderIndex,
  personaAuthoredRole,
  projectDiscoveryRecord,
  projectRecordSurface,
  providerLookupHints,
  recordVerificationEntries,
  signedPersonaLabel,
  validateProviderInventoryWindow,
} from './discovery-authority.mjs?v=20260715-provider-window-v1';
import {
  collectBrowserLibp2pBootstraps,
  compactCount,
  nextProgressiveGroupLevel,
  providerIndexResponseByteLimit,
  publishedMissionEvidenceProjection,
  publicTaskLifecycleProjection,
  projectTerminalModelFailures,
  progressiveGroupLimit,
  responseByteLengthWithinLimit,
  selectMonitoringBases,
  selectVerifiedPublicTaskRunTargets,
  selectPriorityWindow,
  signedPersonaIdentity,
  verifiedPersonaRenderable,
  personaLifecycleProjection,
} from './network-view.mjs?v=20260717-public-task-lifecycle-v1';
import {
  NetworkStore,
  TelemetryAdmissionGate,
  networkEntityKey,
  splitNetworkKey,
} from './network-store.mjs?v=20260710-scalable-network-v1';
import {
  selectBuiltinArtifactRenderer,
  selectLocalArtifactModule,
  resolveVerifiedArtifactDispatch,
} from './artifact-types.mjs?v=20260715-verified-sniff-v1';
import {
  fetchVerifiedPersonaAvatar,
  normalizePersonaAvatar,
  personaIdentityKeyPin,
} from './persona-avatar.mjs?v=20260712-persona-raster-v2';
import {
  environmentIdentity,
  resolveEnvironmentAuthority,
  resolveUniqueRunEnvironment,
} from './routing-authority.mjs?v=20260715-persona-routing-authority-v1';
import {
  entityTelemetryProjection,
  isExactPublicCommunicationRoute,
  isEnvironmentTelemetryDocument,
  isPersonaTelemetryDocument,
  isPublicEntityIndexDocument,
  isPublicEntityTelemetryDocument,
  OPERATOR_LIVE_TELEMETRY_SCHEMA,
  publicCommunicationRouteEvents,
  telemetryActiveCalls,
  telemetryActivity,
  telemetryModelEvents,
  telemetrySpans,
} from './public-telemetry.mjs?v=20260717-direct-routes-v1';

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
  download:'M8 2.5v7M5.5 7L8 9.5 10.5 7M3 11v2h10v-2',       // download to tray
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
  const text=tgt.textContent||'';
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
async function verifyRecord(doc,keyEntries){
  for(const entry of recordVerificationEntries(keyEntries,doc?.signing_key_id)){
    try{ if(await ed.verifyAsync(hexToBytes(doc.signature_hex),enc.encode(canon(doc.record)),
      hexToBytes(entry.public_key_hex))) return {ok:true,entry}; }
    catch(e){}
  }
  return {ok:false,entry:null};
}
const isAbs=(u)=>/^https?:\/\//i.test(String(u||''));
const isHttp=(u)=>/^https?:\/\//i.test(String(u||''));
const join=(b,r)=>{ if(isAbs(r))return r; if(!b)return r; return b.replace(/\/$/,'')+'/'+String(r||'').replace(/^\//,''); };
/* ---------- operator authority (A5-01/A5-08: a BEARER TOKEN, never network position) ----------
   The node mints a process bearer at boot and temporarily stages it under
   runs/.../_operator/token until the first model call.
   Saved per node base in sessionStorage; every fetch to that base carries it, unlocking owner
   intake (/task /budget /stop), full /status, /runs, /personas and the gated static tree.
   Anonymous viewers keep working — they see each node's public discovery projection only. */
function opTokens(){
  // Clear credentials written by older portal builds instead of silently retaining
  // durable authority that model-authored same-origin content could have observed.
  try{ localStorage.removeItem('personaos_operator'); }catch(e){}
  try{ localStorage.removeItem('personaos_peers'); }catch(e){}
  try{ return JSON.parse(sessionStorage.getItem('personaos_operator')||'{}'); }catch(e){ return {}; }
}
function opSaveTokens(m){
  try{ localStorage.removeItem('personaos_operator'); }catch(e){}
  sessionStorage.setItem('personaos_operator',JSON.stringify(m)); updateOpBadge();
}
const opBaseKey=(b)=>String(b||location.origin).replace(/\/$/,'');
// Loopback detection is only a discovery/convenience hint. Network position never
// grants operator authority; protected calls still require the bearer token.
const isLocalBase=(b)=>{ try{ const h=new URL(opBaseKey(b),location.href).hostname;
  return h==='localhost'||h==='127.0.0.1'||h==='[::1]'||h==='::1'; }catch(e){ return false; } };
function tokenFor(u){
  let target; try{ target=new URL(isAbs(u)?u:join(location.origin,u),location.href); }catch(e){ return ''; }
  let best='',tok='';
  for(const [rawBase,candidate] of Object.entries(opTokens())){
    let base; try{ base=new URL(rawBase,location.href); }catch(e){ continue; }
    if(target.origin!==base.origin) continue;
    const root=base.pathname.replace(/\/+$/,'')||'/';
    const within=root==='/'||target.pathname===root||target.pathname.startsWith(root+'/');
    if(within&&rawBase.length>best.length){ best=rawBase; tok=candidate; }
  }
  return tok;
}
function authHeaders(u){ const t=tokenFor(u); return t?{'Authorization':'Bearer '+t}:{}; }
function secureFetchInit(u,init={}){
  return {...init,cache:init.cache||'no-store',credentials:'omit',redirect:'error',
    referrerPolicy:'no-referrer',headers:{...(init.headers||{}),...authHeaders(u)}};
}
async function readBoundedResponseBytes(response,maxBytes){
  const declared=Number(response.headers.get('content-length'));
  if(Number.isFinite(declared)&&!responseByteLengthWithinLimit(declared,maxBytes))
    throw new Error(`body exceeds ${fmtBytes(maxBytes)} client limit`);
  if(!response.body||typeof response.body.getReader!=='function'){
    const bytes=await response.arrayBuffer();
    if(!responseByteLengthWithinLimit(bytes.byteLength,maxBytes))
      throw new Error(`body exceeds ${fmtBytes(maxBytes)} client limit`);
    return bytes;
  }
  const reader=response.body.getReader(), chunks=[]; let total=0;
  try{
    for(;;){ const {done,value}=await reader.read(); if(done) break;
      total+=value.byteLength;
      if(!responseByteLengthWithinLimit(total,maxBytes)){
        await reader.cancel(); throw new Error(`body exceeds ${fmtBytes(maxBytes)} client limit`); }
      chunks.push(value);
    }
  }finally{ try{ reader.releaseLock(); }catch(e){} }
  const out=new Uint8Array(total); let offset=0;
  for(const chunk of chunks){ out.set(chunk,offset); offset+=chunk.byteLength; }
  return out.buffer;
}
function _downloadName(name){
  const leaf=String(name||'artifact.bin').split(/[\\/]/).pop()
    .replace(/[\x00-\x1f\x7f<>:"|?*]/g,'_').trim().slice(0,180);
  return leaf||'artifact.bin';
}
function secureDownloadMarkup(url,name,expectedHash){
  const verified=!!String(expectedHash||'').replace(/^sha256:/i,'');
  const label=verified?'download verified bytes':'download bytes';
  return `<button class="fv-btn secure-download" type="button" data-act="secure-download" data-url="${esc(url)}" data-name="${esc(_downloadName(name))}" data-hash="${esc(expectedHash||'')}" title="${esc(label)}">`
    +`${icon('download','ico-sm')}<span aria-live="polite">${label}</span></button>`;
}
async function secureDownloadFromButton(btn){
  if(btn.dataset.busy==='1') return;
  const label=btn.querySelector('span');
  const original=label?.textContent||'download bytes';
  const finish=(state,text)=>{
    btn.dataset.busy=''; btn.disabled=false; btn.removeAttribute('aria-busy');
    btn.classList.remove('ok','no'); if(state) btn.classList.add(state);
    if(label) label.textContent=text;
    clearTimeout(btn._downloadTimer);
    btn._downloadTimer=setTimeout(()=>{ btn.classList.remove('ok','no'); if(label) label.textContent=original; },2200);
  };
  btn.dataset.busy='1'; btn.disabled=true; btn.setAttribute('aria-busy','true');
  if(label) label.textContent='checking bytes';
  try{
    const target=new URL(btn.dataset.url||'',location.href);
    if(!/^https?:$/.test(target.protocol)) throw new Error('unsupported download URL');
    const response=await fetch(target.href,secureFetchInit(target.href));
    if(!response.ok) throw new Error(`body HTTP ${response.status}`);
    const bytes=await readBoundedResponseBytes(response,LIVE_ARTIFACT_LIMITS.maxDownloadBytes);
    const rawExpected=String(btn.dataset.hash||'').replace(/^sha256:/i,'').toLowerCase();
    if(rawExpected){
      if(!/^[a-f0-9]{64}$/.test(rawExpected)) throw new Error('invalid expected SHA-256');
      const actual=await sha256Hex(bytes);
      if(actual!==rawExpected) throw new Error('SHA-256 mismatch');
    }
    // Model-authored HTML/SVG must never receive a navigable same-origin URL.
    // Rewrap verified bytes as an attachment-only type and discard the URL at once.
    const objectUrl=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
    const anchor=document.createElement('a');
    anchor.href=objectUrl; anchor.download=_downloadName(btn.dataset.name); anchor.hidden=true;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),0);
    finish('ok',rawExpected?'verified download started':'download started');
  }catch(e){
    const message=String(e&&e.message||'download failed').slice(0,90);
    btn.title=message; finish('no',message);
  }
}
function updateOpBadge(){ const b=$('#opbtn'); if(!b) return;
  const n=Object.keys(opTokens()).length; b.classList.toggle('on',n>0);
  // stroked key glyph (inherits the button's currentColor; goes green via #opbtn.on)
  // instead of the colour emoji that defeated the token palette.
  b.innerHTML=icon('key')+`<span class="opbtn-label">OPERATOR${n>0?` · ${n}`:''}</span>`; }
const DEFAULT_JSON_MAX_BYTES=4*1024*1024;
async function fetchJson(u,init={}){ try{ const r=await fetch(u,secureFetchInit(u,init)); if(!r.ok)return null;
  const bytes=await readBoundedResponseBytes(r,init.maxBytes||DEFAULT_JSON_MAX_BYTES);
  return JSON.parse(new TextDecoder().decode(bytes)); }catch(e){ return null; } }
const planesOf=(t)=>['federation','public'].includes(t)?['internet','intranet']:['intranet'];

// Hard UI/backpressure ceilings. Global discovery can describe millions of
// kernels, but a browser must render and actively monitor a small, explicit
// window. Selected/running/recent entities outrank idle ones; every omitted
// population is reported as an aggregate instead of silently disappearing.
const NETWORK_LIMITS=Object.freeze({
  kernelChips:10, monitoredBases:12, cachedKernels:4096, cachedRecords:20000,
  resolverPage:128, resolverPages:4, discoveryLogRows:24, telemetryTapeRows:2000,
  graphKernels:6, graphPersonasGlobal:30, graphPersonasFocused:36,
  environmentInitial:10, environmentStep:10, personaInitial:12, personaStep:12,
  cognitionPersonas:24, cognitionRowsPerPersona:24, interactionRows:120,
});
const NETWORK=new NetworkStore({limits:{maxEntities:NETWORK_LIMITS.cachedRecords,
  maxPresence:NETWORK_LIMITS.cachedRecords,maxGraphExact:96,maxGraphAggregates:24,maxGraphNodes:120}});
const TELEMETRY_GATE=new TelemetryAdmissionGate({maxSources:128,maxAgeMs:30000,futureSkewMs:30000});
const VERIFIED_COMMUNICATION_ROUTES=new WeakMap();
const VERIFIED_COMMUNICATION_ROUTE_COLLECTIONS=new WeakSet();

const S={ recs:new Map(), order:[], kernels:new Set(), events:[], emitted:0, rIdx:0, lastEmit:0,
  paused:false, sort:'events', dir:-1, plane:'all', kind:'all', q:'', epsWin:[], evCount:0, live:false,
  map:{}, mapByKernel:{}, telLoaded:new Set(), eventKeys:new Set(), keys:new Map(), keyDocs:new Map(), boots:new Map(),
  providerKeyRefreshAt:new Map(), providerHintJobs:new Map(), providerHintQueue:[],
  providerInventories:new Map(),
  providerHintActive:0, providerHintWindow:[], pendingProviderHints:new Map(),
  streams:new Map(), p2pBootstraps:new Set(), globalPeers:new Set(), gossipPeers:new Set(),
  globalAnnouncements:new Map(), globalAnnouncementByBase:new Map(), views:[], curBase:'',
  bundleDirs:new Set(), bundleDirsOpen:new Set(),
  // Live per-entity telemetry index: base → latest live telemetry doc, plus
  // derived per-persona / per-env activity. Lets each persona + env view show
  // what is happening INSIDE it right now (model selections, evolution, lineage).
  liveTel:new Map(), liveByPersona:new Map(), liveByEnv:new Map(), drawerTimer:null,
  personaDiscoveryByKey:new Map(), personaIdentityKeys:new Map(),
  activeModelCallsByBase:new Map(), activeModelCallsByPersona:new Map(), activeModelCallsByEnv:new Map(),
  activeModelCallCount:0,
  // Kernel-signed live snapshots/events remain separate from signed discovery
  // records. File bytes are also checked against each signed advertised sha256.
  liveArtifacts:new Map(), liveArtifactPolls:new Map(), liveArtifactBodyCache:new Map(),
  liveArtifactRequestGeneration:new Map(), liveArtifactAbort:new Map(), liveArtifactEnded:new Map(),
  liveArtifactPublicProbes:new Map(),
  terminalCallTombstones:new Map(),
  terminalModelFailureByKernel:new Map(),
  personaRuntimeById:new Map(), cognitionByPersona:new Map(),
  trackedLiveRuns:new Map(), openLiveFile:null,
  // living-network state: heartbeat (always-on baseline), vital-sign spike queue,
  // persistent constellation node positions/elements, env count, persona-follow.
  heartbeat:null, vitalSpikes:[], nodePos:new Map(), gnodes:new Map(), envCount:0,
  follow:null, sysFlt:'all', kernelFocus:null, globalTotal:0, kernelOverflow:0,
  environmentWindow:NETWORK_LIMITS.environmentInitial, personaWindows:new Map(),
  visiblePersonaIds:new Set(), renderedEnvironmentKeys:new Set(), telemetryRefusals:new Map() };

// honour the viewer's motion preference: freeze the ambient/firing animations
// (canvas trace, traveling pulses, breathe/heartbeat) while keeping all STATE —
// counters, colours, fresh-classes, feed rows — fully live.
const RM=(typeof matchMedia!=='undefined')&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// Runtime truth for "in a model call" comes from kernel.active_model_calls, not
// from replayed model_events or heartbeat.busy. Historical model_events remain
// useful history, but they must not mark personas/envs as running now.
function _activeCalls(live){
  return telemetryActiveCalls(live).filter(Boolean);
}
function _terminalCallKey(base,call){
  const id=String(call?.call_id||'');
  return id?`${base||'@origin'}\u0000${id}`:'';
}
function _pruneTerminalCallTombstones(now=Date.now()){
  for(const [key,expiresAt] of (S.terminalCallTombstones||new Map())){
    if(expiresAt<=now) S.terminalCallTombstones.delete(key);
  }
}
function _terminalCallIsBlocked(base,call,now=Date.now()){
  const key=_terminalCallKey(base,call); if(!key) return false;
  const expiresAt=S.terminalCallTombstones?.get(key)||0;
  if(expiresAt<=now){ if(expiresAt) S.terminalCallTombstones.delete(key); return false; }
  return true;
}
function _filterTerminalCalls(base,calls,now=Date.now()){
  _pruneTerminalCallTombstones(now);
  return (Array.isArray(calls)?calls:[]).filter((call)=>!_terminalCallIsBlocked(base,call,now));
}
function _rebuildActiveModelCallIndex(){
  const byP=new Map(), byE=new Map(); let n=0;
  for(const [baseKey,calls] of S.activeModelCallsByBase) for(const c of calls){
    n++;
    const base=baseKey==='@origin'?'':baseKey;
    const kernel=String(c?.kernel_id||c?.node_id||kernelForBase(base)||baseKey||'@unknown');
    const pid=_shortId(c&&c.persona_id); if(pid){ const key=_personaKey(kernel,pid);
      (byP.get(key)||byP.set(key,[]).get(key)).push({...c,_kernel:kernel,_base:base}); }
    const eid=_shortId(c&&c.environment_id); if(eid){ const key=_environmentKey(kernel,eid);
      (byE.get(key)||byE.set(key,[]).get(key)).push({...c,_kernel:kernel,_base:base}); }
  }
  S.activeModelCallsByPersona=byP;
  S.activeModelCallsByEnv=byE;
  S.activeModelCallCount=n;
}
function _indexActiveModelCalls(base,live,{observedAt=Date.now(),kernelId=''}={}){ const key=base||'@origin';
  const kernel=String(kernelId||live?.kernel?.kernel_id||live?.node?.node_id||kernelForBase(base)||key);
  const calls=_filterTerminalCalls(base,_activeCalls(live),observedAt)
    .map((call)=>({...call,kernel_id:call?.kernel_id||kernel}));
  (S.activeModelCallsByBase=S.activeModelCallsByBase||new Map()).set(key,calls);
  (S.activeModelCallObservedAt=S.activeModelCallObservedAt||new Map()).set(key,observedAt);
  _rebuildActiveModelCallIndex();
  return calls;
}
function _rebuildHeartbeat(){
  let anyRunning=false, anyBusy=false, minIv=null;
  for(const hb of (S.heartbeatByBase||new Map()).values()){
    const r=hb&&hb.running!==false; if(r){ anyRunning=true;
      const iv=+(hb&&hb.interval_s); if(iv>0) minIv=minIv==null?iv:Math.min(minIv,iv); }
    if(hb&&hb.busy) anyBusy=true;
  }
  S.heartbeat={running:anyRunning,busy:anyBusy,interval_s:minIv||(S.heartbeat&&S.heartbeat.interval_s)||5};
}
function heartbeatForScope(){
  if(!S.kernelFocus) return S.heartbeat||null;
  let running=false,busy=false,minIv=null,found=false;
  for(const [baseKey,hb] of (S.heartbeatByBase||new Map())){
    const base=baseKey==='@origin'?'':baseKey;
    if(kernelForBase(base)!==S.kernelFocus) continue;
    found=true; const isRunning=hb&&hb.running!==false;
    if(isRunning){ running=true; const iv=Number(hb.interval_s); if(iv>0) minIv=minIv==null?iv:Math.min(minIv,iv); }
    if(hb?.busy) busy=true;
  }
  return found?{running,busy,interval_s:minIv||5}:null;
}
function expireLivePresence(now=Date.now()){
  NETWORK.sweepPresence(now);
  const lease=30000, retention=120000; let callsChanged=false;
  for(const [personaKey,state] of (S.cognitionActiveCallsByPersona||new Map()))
    if(now-Number(state?.observedAt||0)>lease) S.cognitionActiveCallsByPersona.delete(personaKey);
  for(const [base,at] of (S.activeModelCallObservedAt||new Map())) if(now-at>lease){
    S.activeModelCallObservedAt.delete(base); S.activeModelCallsByBase.delete(base); callsChanged=true; }
  if(callsChanged) _rebuildActiveModelCallIndex();
  let hbChanged=false;
  for(const [base,hb] of (S.heartbeatByBase||new Map())) if(now-(hb?._observedAt||0)>lease){
    S.heartbeatByBase.delete(base); hbChanged=true; }
  if(hbChanged) _rebuildHeartbeat();
  for(const [personaKey,d] of (S.liveByPersona||new Map())) if(now-(d?.receivedAt||0)>lease){
    if(now-(d?.receivedAt||0)>retention){
      S.liveByPersona.delete(personaKey); S.personaRuntimeById?.delete(personaKey);
      S.lastModelSeenAt?.delete(personaKey); S.lastActiveAt?.delete(personaKey);
      S.modelCount?.delete(personaKey); S.pcardSeen?.delete(personaKey); S.pcCogSeen?.delete(personaKey);
      const retained=[...(S.cognitionByPersona?.get(personaKey)?.values()||[])]
        .sort((a,b)=>a._t-b._t).slice(-12);
      if(retained.length) S.ixByPersona?.set(personaKey,retained);
      else S.ixByPersona?.delete(personaKey);
      S.ixCountBySid?.delete(personaKey); S.cogBaseFor?.delete(personaKey);
      S.publicCognitionSeen?.delete(personaKey);
      if(S.follow===personaKey) S.follow=null;
      continue;
    }
    // Keep the durable/discovered card, but its ephemeral presence expires.
    let effective='stale'; try{ effective=NETWORK.presenceStatus(personaKey,now)?.freshness||effective; }catch(e){}
    S.liveByPersona.set(personaKey,{...d,models:[],stale:true,presence:effective});
    S.lastModelSeenAt?.delete(personaKey); S.lastActiveAt?.delete(personaKey);
  }
  for(const [envKey,d] of (S.liveByEnv||new Map())) if(now-(d?.receivedAt||0)>retention) S.liveByEnv.delete(envKey);
  for(const [base,at] of (S.liveTelObservedAt||new Map())) if(now-at>retention){
    S.liveTelObservedAt.delete(base); S.liveTel.delete(base); S.telLoaded?.delete(base==='@origin'?'':base); }
  for(const [kernel,failure] of (S.terminalModelFailureByKernel||new Map()))
    if(now-(failure?.receivedAt||0)>retention) S.terminalModelFailureByKernel.delete(kernel);
}
function _indexPublicCognitionActiveCalls(personaKey,calls,{base='',kernel='',observedAt=Date.now()}={}){
  const map=S.cognitionActiveCallsByPersona=S.cognitionActiveCallsByPersona||new Map();
  const rows=(Array.isArray(calls)?calls:[]).map((call)=>({...call,_base:base,_kernel:kernel,
    _signedPublicCognition:true}));
  map.delete(personaKey); map.set(personaKey,{calls:rows,observedAt});
  while(map.size>NETWORK_LIMITS.cognitionPersonas*4) map.delete(map.keys().next().value);
}
function _activeModelCallsForPersona(value,kernel=''){
  const ref=_personaRef(value,kernel);
  const telemetry=(S.activeModelCallsByPersona&&S.activeModelCallsByPersona.get(ref.key))||[];
  const cognition=S.cognitionActiveCallsByPersona?.get(ref.key);
  if(cognition&&Date.now()-cognition.observedAt>30000){
    S.cognitionActiveCallsByPersona.delete(ref.key);
    return telemetry;
  }
  if(!cognition?.calls?.length) return telemetry;
  const merged=new Map();
  for(const call of [...telemetry,...cognition.calls]) merged.set(String(call.call_id||canon(call)),call);
  return [...merged.values()];
}
function _runtimeBusy(){
  return !!(S.activeModelCallCount>0);
}
function _envRunningNow(b){
  const sid=_shortId((b&&b.sid)||(b&&b.envId));
  if(sid && S.activeModelCallsByEnv && S.activeModelCallsByEnv.has(_environmentKey(b?.kernel,sid))) return true;
  return !!(b&&Array.isArray(b.members)&&b.members.some((m)=>_activeModelCallsForPersona(m,b.kernel).length));
}
function _latestSpanTime(spans){
  let out=0;
  for(const s of (Array.isArray(spans)?spans:[])){
    const t=Date.parse((s&&s.ended_at)||(s&&s.started_at)||'')||0;
    if(t>out) out=t;
  }
  return out;
}
function _modelEventTime(m,fallback){
  return Date.parse((m&&m.at)||(m&&m.timestamp)||(m&&m.started_at)||(m&&m.ended_at)||(m&&m.generated_at)||'')||fallback;
}

// Index a live-telemetry doc per-persona and per-env so the detail views can
// render each entity's OWN activity (model_events carry persona_id +
// environment_id; spans carry scope + trace_id). Every Map key is qualified by
// its kernel; short ids are canonical browser join keys and compact labels.
// Exact signed ids are retained separately for identity-bound node routes.
// Personas/envs ship two DID shapes:
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
function _personaKey(kernel,pid){
  try{ return networkEntityKey(String(kernel||'@unknown'),'persona',_shortId(pid)); }
  catch(e){ return networkEntityKey('@unknown','persona',String(pid||'unknown')); }
}
function _environmentKey(kernel,eid){
  try{ return networkEntityKey(String(kernel||'@unknown'),'env',_shortId(eid)); }
  catch(e){ return networkEntityKey('@unknown','env',String(eid||'unknown')); }
}
const _personaRefCache=new Map();
function _personaRef(value,kernel=''){
  const raw=String(value||'');
  const cached=_personaRefCache.get(raw); if(cached) return cached;
  const parsed=splitNetworkKey(raw);
  if(parsed?.kind==='persona'){
    const ref=Object.freeze({key:raw,kernel:parsed.kernelId,sid:parsed.identity});
    _personaRefCache.set(raw,ref);
    while(_personaRefCache.size>NETWORK_LIMITS.cachedRecords)
      _personaRefCache.delete(_personaRefCache.keys().next().value);
    return ref;
  }
  const sid=_shortId(value); return {key:_personaKey(kernel,sid),kernel:String(kernel||'@unknown'),sid};
}
function _signedPersonaEndpointId(value,kernel=''){
  const ref=_personaRef(value,kernel);
  return signedPersonaIdentity(S.personaDiscoveryByKey.get(ref.key))?.signedId||ref.sid;
}
function _environmentRef(value,kernel=''){
  const parsed=splitNetworkKey(value);
  if(parsed?.kind==='env') return {key:String(value),kernel:parsed.kernelId,sid:parsed.identity};
  const sid=_shortId(value); return {key:_environmentKey(kernel,sid),kernel:String(kernel||'@unknown'),sid};
}
const _domEntityKey=(key)=>encodeURIComponent(String(key||''));
const _entityKeyFromDom=(key)=>{ try{ return decodeURIComponent(String(key||'')); }catch(e){ return ''; } };
function _eventKernel(event){ return String(event?._kernel||kernelForBase(event?._base)||'@unknown'); }
function _eventPersonaKey(event,pid){ return _personaKey(_eventKernel(event),pid); }
function _eventEndpoints(event){
  const out=[], seen=new Set();
  const recipients=Array.isArray(event?.recipients)?event.recipients.slice(0,64):[];
  const affected=Array.isArray(event?.affected)?event.affected.slice(0,64):[];
  for(const endpoint of [...recipients,...affected]){
    const kind=String(endpoint?.kind||''), id=String(endpoint?.id||'');
    if(!kind||!id) continue;
    const key=`${kind}\u0000${id}`; if(seen.has(key)) continue; seen.add(key);
    out.push({...endpoint,kind,id});
  }
  return out;
}
function _personaEndpoints(event){ return _eventEndpoints(event).filter((endpoint)=>endpoint.kind==='persona'); }
function _interactionPersonaKeys(event){
  return [event?.actor_kind==='persona'?_eventPersonaKey(event,event.actor_id):null,
    ..._personaEndpoints(event).map((endpoint)=>_eventPersonaKey(event,endpoint.id))].filter(Boolean);
}
function _rememberPersonaCognitionEvent(event){
  const store=S.cognitionByPersona=S.cognitionByPersona||new Map();
  for(const personaKey of new Set(_interactionPersonaKeys(event))){
    let rows=store.get(personaKey); if(!rows) rows=new Map();
    if(rows.has(event._key)) rows.delete(event._key);
    rows.set(event._key,event);
    while(rows.size>NETWORK_LIMITS.cognitionRowsPerPersona) rows.delete(rows.keys().next().value);
    store.delete(personaKey); store.set(personaKey,rows);
  }
  while(store.size>NETWORK_LIMITS.cognitionPersonas*4) store.delete(store.keys().next().value);
}
function _refreshPersonaInteractionIndex(){
  const indexed=new Map();
  for(const event of (S.interactions||[])) for(const personaKey of _interactionPersonaKeys(event)){
    const rows=indexed.get(personaKey)||indexed.set(personaKey,new Map()).get(personaKey);
    rows.set(event._key,event);
  }
  // Cognition has its own per-persona bound. Unrelated traffic may roll off the
  // global coordination tape without making this persona's current rows vanish.
  for(const [personaKey,retained] of (S.cognitionByPersona||new Map())){
    const rows=indexed.get(personaKey)||indexed.set(personaKey,new Map()).get(personaKey);
    for(const [key,event] of retained) rows.set(key,event);
  }
  S.ixByPersona=new Map([...indexed].map(([personaKey,events])=>[
    personaKey,[...events.values()].sort((a,b)=>a._t-b._t).slice(-12),
  ]));
}

function ingestLiveTelemetry(base,live,{source='poll',eventId='',verifiedCommunicationRoutes=[],
  publicFrameVerified=false}={}){
  const sourceKey=base||'@origin';
  if(live?.schema==='personaos-live-telemetry-public/1'&&publicFrameVerified!==true){
    return {accepted:false,decision:{accepted:false,reason:'public_signature_invalid',sourceKey}};
  }
  const decision=TELEMETRY_GATE.admit(sourceKey,live,{eventId});
  if(!decision.accepted){
    const refusalKey=`${sourceKey}\u0000${decision.reason}`;
    const last=S.telemetryRefusals.get(refusalKey)||0;
    if(Date.now()-last>10000){
      S.telemetryRefusals.set(refusalKey,Date.now());
      log('telemetry',`${sourceKey}: refused ${decision.reason} ${source} frame`,false);
    }
    return {accepted:false,decision};
  }
  indexLiveTelemetry(base,live,{observedAt:decision.observedAt,
    receivedAt:decision.receivedAt,sequence:decision.sequence,source,verifiedCommunicationRoutes,
    publicFrameVerified});
  return {accepted:true,decision};
}
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
function _envSidFromProject(r){ const L=r?._links||{};
  const authority=resolveEnvironmentAuthority(r,L,{verified:true});
  return authority.status==='resolved'?authority.environmentId:''; }
function runForEnv(r){ const direct=runOf(r); if(direct) return direct;
  const sid=_envSid(r); if(!sid) return null;
  for(const id of S.order||[]){ const p=S.recs.get(id);
    if(!p||p.kind!=='project'||p._kernel!==r._kernel) continue;
    if(_envSidFromProject(p)===sid){ const prun=runOf(p); if(prun) return prun; }
  }
  return null; }
function _envSidFromValue(v){ return environmentIdentity(v); }
function environmentAuthorityOfRecord(r){
  // S.recs admits only provider-envelope + discovery-record verified rows.
  // No unsigned live/status/profile object is passed into this authority path.
  return resolveEnvironmentAuthority(r,r?._links||{},{verified:true});
}
function envSidOfRecord(r){ if(!r) return '';
  if(r.kind==='env') return _envSid(r);
  const authority=environmentAuthorityOfRecord(r);
  return authority.status==='resolved'?authority.environmentId:'';
}
function envRecordForAuthority(r){
  const authority=environmentAuthorityOfRecord(r);
  if(authority.status!=='resolved') return {authority,recordId:null};
  const recordId=S.order.find((id)=>{ const candidate=S.recs.get(id);
    return candidate?.kind==='env'&&candidate._kernel===r._kernel
      &&_envSid(candidate)===authority.environmentId; })||null;
  return {authority,recordId};
}
function manifestArtifacts(m){ const arts=(m&&Array.isArray(m.artifacts))?m.artifacts:[];
  return arts.map((a)=>({ ...a, title:a.title||a.path||a.artifact_id||'',
    body_published:a.body_published!==undefined?a.body_published:!!a.content,
    size:a.size??a.size_bytes??a.bytes })); }
function authoredArtifactLabels(value){ const a=value&&typeof value==='object'?value:{}, L=a._links||{};
  const media=String(a.media_kind||L.media_kind||'').trim();
  return artifactSemanticLabels({
    role_in_bundle:a.role_in_bundle||L.role_in_bundle||'',
    artifact_roles:a.artifact_roles||L.artifact_roles,
    capability_summary:a.capability_summary||L.capability_summary,
  }).filter((label)=>label!==media);
}
function authoredArtifactLabelText(value){ return authoredArtifactLabels(value).join(' · '); }
function artifactSemanticsAttr(value){ return JSON.stringify(authoredArtifactLabels(value)); }
function artifactSemanticsFromAttr(value){ try{ const parsed=JSON.parse(String(value||'[]'));
    return Array.isArray(parsed)?parsed:[]; }catch(_){ return []; } }
function manifestRun(m){ for(const a of manifestArtifacts(m)){ if(a&&a.run) return String(a.run); } return ''; }
function indexLiveTelemetry(base,live,meta={}){
  if(!live||typeof live!=='object') return;
  const baseKey=base||'@origin';
  const kernelId=(S.boots?.get(baseKey)||{}).kernel_id||live?.node_id
    ||live?.node?.node_id||live?.kernel?.kernel_id||baseKey;
  const receivedAt=Number(meta.receivedAt)||Date.now();
  const t=Number(meta.observedAt)||Date.parse(live.generated_at||'')||receivedAt;
  const publicSnapshotSigned=live.schema==='personaos-live-telemetry-public/1'
    &&meta.publicFrameVerified===true;
  // the always-on baseline pulse: node.heartbeat is present + running on every
  // node sample, so the page is alive the instant it loads even when both event
  // streams are momentarily quiet — and it NEVER fakes activity.
  // heartbeat is a per-base map OR'd into the single S.heartbeat the three readers use
  // (livedot, drawVital, constellation beat): with multiple nodes, processed sequentially,
  // a last-writer-wins overwrite let a later idle node clobber an earlier running one and
  // read the whole page as idle. running = ANY node running; interval = min over running.
  if(live.node&&live.node.heartbeat){
    (S.heartbeatByBase=S.heartbeatByBase||new Map()).set(baseKey,{...live.node.heartbeat,_observedAt:receivedAt});
    _rebuildHeartbeat();
  }
  const rawActiveCalls=_activeCalls(live);
  const activeCalls=_indexActiveModelCalls(base,live,{observedAt:receivedAt,kernelId});
  const terminalPersonaIds=new Set(rawActiveCalls
    .filter((call)=>_terminalCallIsBlocked(base,call,receivedAt))
    .map((call)=>_shortId(call?.persona_id)).filter(Boolean));
  const me=telemetryModelEvents(live);
  const projectedFailures=projectTerminalModelFailures(me);
  const terminalFailuresByPersona=new Map([...projectedFailures.byPersona]
    .map(([pid,failure])=>[_shortId(pid),failure]).filter(([pid])=>pid));
  const terminalFailuresByEnvironment=new Map([...projectedFailures.byEnvironment]
    .map(([eid,failure])=>[_shortId(eid),failure]).filter(([eid])=>eid));
  if(projectedFailures.latest) S.terminalModelFailureByKernel.set(kernelId,{
    ...projectedFailures.latest,observedAt:t,receivedAt,base:baseKey==='@origin'?'':baseKey,kernel:kernelId,
  });
  else S.terminalModelFailureByKernel.delete(kernelId);
  const sp=telemetrySpans(live);
  const rawPersonas=Array.isArray(live.personas)?live.personas:[];
  const personas=rawPersonas.slice(0,NETWORK_LIMITS.cachedRecords);
  S.liveTel.set(baseKey,rawPersonas.length===personas.length?live:{...live,personas});
  (S.liveTelObservedAt=S.liveTelObservedAt||new Map()).set(baseKey,receivedAt);
  const runtimeBusy=activeCalls.length>0;
  const modelBaseT=runtimeBusy?t:(_latestSpanTime(sp)||t);
  // model selections → per persona and per env
  const byP=new Map(), byE=new Map();
  me.forEach((m,i)=>{
    if((m.kind||'')!=='MODEL_SELECTED') return;
    const rec={t:_modelEventTime(m,modelBaseT-((me.length-i)*200)), purpose:String(m.requested_purpose||m.purpose||m.role||'model'),
      model:String(m.model_id||'—'), role:String(m.role||''), reason:String(m.reason||''),environment:_shortId(m.environment_id)};
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
  const activePersonaIds=new Set(activeCalls.map((call)=>_shortId(call?.persona_id)).filter(Boolean));
  personas.forEach((p)=>{ const pid=_shortId(p.persona_id);
    if(!pid) return; const personaKey=_personaKey(kernelId,pid), cur=S.liveByPersona.get(personaKey)||{};
    const terminalized=terminalPersonaIds.has(pid)&&!activePersonaIds.has(pid);
    const terminalFailure=activePersonaIds.has(pid)?null:(terminalFailuresByPersona.get(pid)||null);
    const summary=terminalized?{...p,running_llm:false,llm_execution_state:'idle',task_execution_state:'idle'}:p;
    S.liveByPersona.set(personaKey,{...cur,summary,models:byP.get(pid)||cur.models||[],terminalFailure,sid:pid,
      generated_at:live.generated_at,base:baseKey==='@origin'?'':baseKey,kernel:kernelId,
      observedAt:t,receivedAt,stale:false});
    try{ NETWORK.upsertPresence({...summary,kernel_id:kernelId,kind:'persona',persona_id:pid,
      observed_at_ms:t,state:activePersonaIds.has(pid)?'running_llm':(summary.task_execution_state||summary.lifecycle_state||'idle')}); }catch(e){}
  });
  for(const [pid,models] of byP){ const personaKey=_personaKey(kernelId,pid), cur=S.liveByPersona.get(personaKey)||{};
    const terminalFailure=activePersonaIds.has(pid)?null:(terminalFailuresByPersona.get(pid)||null);
    S.liveByPersona.set(personaKey,{...cur,models,terminalFailure,sid:pid,generated_at:live.generated_at,
      base:baseKey==='@origin'?'':baseKey,kernel:kernelId,observedAt:t,receivedAt,stale:false});
    try{ NETWORK.upsertPresence({kernel_id:kernelId,kind:'persona',persona_id:pid,
      observed_at_ms:t,state:activePersonaIds.has(pid)?'running_llm':'recent'}); }catch(e){}
  }
  for(const [eid,models] of byE){ const envKey=_environmentKey(kernelId,eid), cur=S.liveByEnv.get(envKey)||{};
    const terminalFailure=activeCalls.some((call)=>_shortId(call?.environment_id)===eid)
      ?null:(terminalFailuresByEnvironment.get(eid)||null);
    S.liveByEnv.set(envKey,{...cur,models,terminalFailure,spans:spByE.get(eid)||cur.spans||[],sid:eid,
      kernel:kernelId,base:baseKey==='@origin'?'':baseKey,generated_at:live.generated_at,
      observedAt:t,receivedAt}); }
  for(const [eid,spans] of spByE){ const envKey=_environmentKey(kernelId,eid), cur=S.liveByEnv.get(envKey)||{};
    if(!cur.spans) S.liveByEnv.set(envKey,{...cur,spans,sid:eid,kernel:kernelId,
      base:baseKey==='@origin'?'':baseKey,generated_at:live.generated_at,observedAt:t,receivedAt}); }
  // VITAL SPIKES from model_events growth: a persona just asked a model to do
  // something. Honest — fires only when a persona's req/resp count GREW since
  // last poll (a static snapshot spikes once on cold load, then rests).
  S.modelCount=S.modelCount||new Map();
  S.lastActiveAt=S.lastActiveAt||new Map();   // kernel-qualified persona key -> recent model-event growth
  S.lastModelSeenAt=S.lastModelSeenAt||new Map();
  if(!runtimeBusy){
    // The node heartbeat says no mission is actively running. Clear only the
    // model-call liveness indices; historical models/interactions remain visible
    // as recent/history below, but they cannot keep the "running" state alive.
    for(const key of [...S.lastActiveAt.keys()]) if(splitNetworkKey(key)?.kernelId===kernelId) S.lastActiveAt.delete(key);
    for(const key of [...S.lastModelSeenAt.keys()]) if(splitNetworkKey(key)?.kernelId===kernelId) S.lastModelSeenAt.delete(key);
  }
  for(const [pid,models] of byP){
    const personaKey=_personaKey(kernelId,pid);
    if(runtimeBusy) S.lastModelSeenAt.set(personaKey,t);
    const prev=S.modelCount.get(personaKey); const now2=models.length;
    if(runtimeBusy && prev!=null && now2>prev){ const g=Math.min(now2-prev,6);
      for(let k=0;k<g;k++) _pushSpike('produce');
      S.lastActiveAt.set(personaKey,receivedAt);
      setTimeout(()=>_fireEdge(personaKey,'produce','out'),60); }
    S.modelCount.set(personaKey,now2);
  }
  // WHO→WHOM interaction stream (kernel.interactions): actor → affected : kind.
  // Drives the coordination feed + constellation. Keyed by a stable signature so
  // re-polls don't duplicate; newest kept (ring of 400). On the FIRST load we
  // seed the ring WITHOUT spiking the vital or firing edges (the 400-ring spans
  // hours — stale events must not animate); only genuinely-new keys fire after.
  const ix=telemetryActivity(live,{verifiedCommunicationRoutes:meta.verifiedCommunicationRoutes,
    publicFrameVerified:meta.publicFrameVerified===true});
  if(ix.length){
    S.interactions=S.interactions||[]; S.ixKeys=S.ixKeys||new Set();
    S.ixColdByBase=S.ixColdByBase||new Set();
    const cold=!S.ixColdByBase.has(baseKey); let fired=0; const fresh=[];
    ix.forEach((e,i)=>{
      const aff=_eventEndpoints(e).map((a)=>`${a.kind}:${a.id}`).join(',');
      const key=`${base}|${e.scope_id}|${e.actor_id}|${aff}|${e.kind}|${e.at||i}`;
      if(S.ixKeys.has(key)) return; S.ixKeys.add(key);
      const routeSigned=e.persona_signature_verified===true&&e.lineage_signature_verified===true;
      const snapshotSigned=publicSnapshotSigned||routeSigned;
      const scope=String(e.scope||''), scopeId=String(e.scope_id||'');
      const provenance={event:String(e.event_id||''),at:String(e.at||''),
        status:_publicProvenanceStatus(e.status),
        environment:String(e.environment_id||(scope==='environment'?scopeId:'')),
        task:scope==='task'?scopeId:'',scopeId:!['environment','task'].includes(scope)?scopeId:'',
        snapshotAt:publicSnapshotSigned&&!e.at?String(live.generated_at||''):''};
      const rec={...e,signed:e.signed===true||snapshotSigned,
        _base:base,_kernel:kernelId,_t:Date.parse(e.at||'')||t,_key:key,_provenance:provenance,
        _observedState:!e.at,
        _trustLabel:routeSigned?'PERSONA + LINEAGE SIGNED ROUTE'
          :publicSnapshotSigned?'KERNEL SIGNED SNAPSHOT':String(e._trustLabel||''),
        _trustTitle:routeSigned
          ?'persona-authored route and kernel lineage signatures independently verified'
          :publicSnapshotSigned?'activity in the verified kernel-signed public telemetry snapshot'
            :String(e._trustTitle||'')};
      S.interactions.push(rec); fresh.push(rec);
      try{ NETWORK.ingestEvent({...e,kernel_id:kernelId,event_id:key}); }catch(err){}
    });
    S.interactions.sort((a,b)=>a._t-b._t);
    if(S.interactions.length>400) S.interactions=S.interactions.slice(-400);
    // bound the dedup/seen sets to the live ring so a long-running page doesn't
    // leak (the node never re-sends an evicted event, so this can't re-fire one).
    const liveKeys=new Set(S.interactions.map((e)=>e._key)); S.ixKeys=liveKeys;
    if(S.ixSeen) for(const k of [...S.ixSeen]) if(!liveKeys.has(k)) S.ixSeen.delete(k);
    // index recent coordination acts PER PERSONA (actor + explicit endpoints) so a persona
    // card can stream its activity in live state A (interactions, no model_events).
    // Keep complete bounded events so each owning persona card can show honest
    // actor, recipient, scope and detail—not a detached generic verb.
    _refreshPersonaInteractionIndex();
    if(!cold){
      S.ixCountBySid=S.ixCountBySid||new Map();
      for(const rec of fresh){
        // monotonic per-persona act tally → drives the card flash on genuine growth
        // coordination acts drive the edge-fire + per-card tally, but they do NOT mark a
        // persona 'running': 'running' means actively IN A MODEL CALL (set only on
        // model_events growth above). A persona merely NAMED in a routed message is not
        // itself in an LLM call — conflating the two made every coordinated persona pulse.
        for(const personaKey of _interactionPersonaKeys(rec)){
          S.ixCountBySid.set(personaKey,(S.ixCountBySid.get(personaKey)||0)+1); }
        if(fired>=12) continue;               // vital spike + edge fire are capped/staggered
        _pushSpike(_ixClass(rec.kind)); fired++;
        const cls=_ixClass(rec.kind), d=Math.min(fired*120,1500), failed=_ixFailed(rec.kind);
        // Draw persona→persona only when the frame names BOTH endpoints. A shared
        // environment/scope is not a recipient edge and must never be animated as
        // one; single-ended kernel relay acts remain honest kernel spokes.
        const fromSid=rec.actor_kind==='persona'?_shortId(rec.actor_id):null;
        const from=fromSid?_personaKey(kernelId,fromSid):null;
        const tos=_personaEndpoints(rec).map((a)=>_shortId(a.id))
          .filter((sid)=>sid&&sid!==fromSid).map((sid)=>_personaKey(kernelId,sid));
        if(from&&tos.length){
          setTimeout(()=>{ _flashNode(from,cls,failed); tos.forEach((to)=>{ _fireLink(from,to,cls); _flashNode(to,cls,failed); }); },d);
        } else { const outbound=rec.actor_kind==='persona';
          _interactionPersonaKeys(rec).forEach((personaKey)=>setTimeout(()=>_fireEdge(personaKey,cls,outbound?'out':'in'),d)); }
      }
    }
    S.ixColdByBase.add(baseKey); S.ixColdLoaded=true;
  }
  // Persona model-status entries join the same live stream. Public snapshots are
  // whole-document signed but may intentionally omit model/call IDs and event
  // timestamps; absent fields stay absent and generated_at is labelled snapshot,
  // never reinterpreted as the event time.
  const me2=telemetryModelEvents(live);
  if(me2.length){
    S.interactions=S.interactions||[]; S.ixKeys=S.ixKeys||new Set();
    const baseT=runtimeBusy?(Date.parse(live.generated_at||'')||t):(_latestSpanTime(sp)||t);
    let addedM=0;
    me2.forEach((m,i)=>{
      const kind=String(m.kind||''); if(!kind.startsWith('MODEL_')) return;
      const model=_publicProvenanceAtom(m.model_id), purpose=_publicProvenanceAtom(m.requested_purpose);
      const role=_publicProvenanceAtom(m.role), rationale=String(m.rationale||m.reason||'');
      const status=_publicProvenanceStatus(m.status);
      const eventAt=_publicProvenanceAtom(m.at,80);
      const provenance=_publicModelEventProvenance(m,
        publicSnapshotSigned?String(live.generated_at||''):'');
      const key=`${base}|model|${m.persona_id||''}|${kind}|${model}|${purpose}|${role}|${status}|${m.latency_ms??''}|${i}`;
      if(S.ixKeys.has(key)) return; S.ixKeys.add(key); addedM++;
      const mt=_modelEventTime(m,baseT-((me2.length-i)*200));
      S.interactions.push({actor_id:String(m.persona_id||''),actor_kind:m.persona_id?'persona':'kernel',
        affected:model?[{id:model,kind:'model'}]:[],kind,scope:'model',scope_id:String(m.environment_id||''),
        at:eventAt,signed:publicSnapshotSigned,_base:base,_kernel:kernelId,_t:mt,_key:key,
        _msg:[purpose,role,status,Number.isFinite(m.latency_ms)?`${m.latency_ms} ms`:''].filter(Boolean).join(' · '),
        _model:model,_rationale:rationale,_provenance:provenance,_observedState:!eventAt,
        _trustLabel:publicSnapshotSigned?'KERNEL SIGNED SNAPSHOT':'',
        _trustTitle:publicSnapshotSigned
          ?'model-status entry in the verified kernel-signed public telemetry snapshot; missing event fields were not inferred'
          :''});
    });
    if(addedM){
      S.interactions.sort((a,b)=>a._t-b._t);
      if(S.interactions.length>400) S.interactions=S.interactions.slice(-400);
      S.ixKeys=new Set(S.interactions.map((e)=>e._key));
      // A model request is itself a live persona message. Re-index after it
      // joins the bounded ring so its card streams it on this render.
      _refreshPersonaInteractionIndex();
    }
  }
}

/* ---------- discovery log ---------- */
function log(tag,msg,ok){ const li=document.createElement('li');
  const c=ok===true?'ok':ok===false?'bad':'';
  li.innerHTML=`<span class="tag2">${esc(tag)}</span><span class="${c}">${esc(msg)}</span>`;
  const host=$('#log'); if(!host) return; host.appendChild(li);
  while(host.children.length>NETWORK_LIMITS.discoveryLogRows) host.firstElementChild?.remove(); }

/* ---------- discovery (runtime resolve + in-browser verify) ---------- */
function collectP2PBootstraps(boot){
  const observed=[...(boot?.bootstrap_peers||[]),...(boot?.relay_peers||[]),
    ...((boot?.reachability_profile||{}).bootstrap_peers||[]),
    ...((boot?.reachability_profile||{}).relay_peers||[])];
  for(const multiaddr of collectBrowserLibp2pBootstraps(
    {pageProtocol:location.protocol},observed)) S.p2pBootstraps.add(multiaddr);
}
async function keysFor(base,boot,{refresh=false}={}){
  const key=base||'@origin';
  const cached=S.keyDocs.get(key);
  if(!refresh&&S.keys.has(key)&&cached&&Date.now()-cached.at<10000
      &&(!boot?.kernel_id||cached.kernelId===boot.kernel_id)) return S.keys.get(key);
  const keysDoc=await fetchJson(join(base,boot?.keys_url||'.well-known/personaos-keys.json'));
  const keys={}; const entries=[]; const currentIds=new Set();
  let valid=keysDoc?.schema==='personaos-keys/1'
    &&!!String(keysDoc?.kernel_id||'')
    &&(!boot?.kernel_id||keysDoc.kernel_id===boot.kernel_id);
  for(const raw of (Array.isArray(keysDoc?.keys)?keysDoc.keys:[])){
    const entry={key_id:String(raw?.key_id||''),role:String(raw?.role||''),
      public_key_hex:String(raw?.public_key_hex||''),status:String(raw?.status||''),
      rotated_at:String(raw?.rotated_at||'')};
    if(!entry.key_id||!['current','previous','archived'].includes(entry.status)
        ||!/^[0-9a-f]{64}$/i.test(entry.public_key_hex)){ valid=false; continue; }
    entries.push(entry);
    if(entry.status==='current'){
      if(currentIds.has(entry.key_id)){ valid=false; continue; }
      currentIds.add(entry.key_id); keys[entry.key_id]=entry.public_key_hex;
    }
  }
  const masters=entries.filter((entry)=>entry.key_id==='kernel-master'
    &&entry.role==='master'&&entry.status==='current');
  if(masters.length!==1) valid=false;
  if(!valid){ S.keys.delete(key); S.keyDocs.delete(key);
    log('keys',`${boot?.kernel_id||key}: current master registry invalid`,false); return {}; }
  S.keys.set(key,keys); S.keyDocs.set(key,{schema:keysDoc.schema,
    kernelId:String(keysDoc.kernel_id||''),entries,at:Date.now()});
  return keys;
}

function providerPolicyPayload(policy){ const out={};
  for(const key of ['schema','policy_id','subject_kind','subject_id','owner_persona_id','access_grants','outward_tier','cross_tenant_agreement_ref'])
    if(Object.prototype.hasOwnProperty.call(policy||{},key)) out[key]=policy[key];
  return out; }
function currentProviderMaster(base,boot){
  const registry=S.keyDocs.get(base||'@origin');
  if(registry?.schema!=='personaos-keys/1'||registry.kernelId!==boot?.kernel_id) return '';
  return currentMasterKey(registry.entries||[]);
}
async function verifyHttpProviderEnvelope(envelope,doc,keys,boot,base,expectedKey=''){
  const p=envelope?.record, pk=currentProviderMaster(base,boot);
  if(envelope?.schema!=='provider-record-envelope/1'||p?.schema!=='provider-record/1'||!pk
    ||keys?.['kernel-master']!==pk||p.signing_key_id!=='kernel-master'
    ||p.signing_key_role!=='master'||p.signing_key_status!=='current'
    ||String(p.public_key_hex||'').toLowerCase()!==pk.toLowerCase()
    ||(expectedKey&&String(p.key||'')!==expectedKey)
    ||p.visibility_tier!=='public'||p.host_kernel_id!==boot?.kernel_id
    ||String(p.record_url||'')!==`discovery/public/records/${p.record_id}.json`)
    return {ok:false,reason:'provider_authority_invalid'};
  let ok=false; try{ ok=await ed.verifyAsync(hexToBytes(envelope.signature_hex),enc.encode(canon(p)),hexToBytes(pk)); }catch(e){}
  if(!ok) return {ok:false,reason:'provider_signature_invalid'};
  if(`sha256:${await sha256Hex(enc.encode(canon(doc)))}`!==p.document_hash) return {ok:false,reason:'provider_document_hash_mismatch'};
  const r=doc?.record||{}, policy=doc?.access_policy||{};
  if(r.record_id!==p.record_id||r.visibility_tier!=='public'||doc.host_kernel_id!==p.host_kernel_id
    ||String(doc.base||'')!==String(p.base_url||'')
    ||r.access_policy_ref!==p.access_policy_ref||policy.policy_id!==p.access_policy_ref
    ||policy.outward_tier!=='public') return {ok:false,reason:'provider_document_binding_mismatch'};
  if(!providerLookupHints(r).includes(String(p.key||''))) return {ok:false,reason:'provider_key_alias_mismatch'};
  const loc=[r.content_locator_ref].filter(Boolean).sort();
  if(canon(loc)!==canon([...(p.content_locator_refs||[])].filter(Boolean).sort())) return {ok:false,reason:'provider_locator_binding_mismatch'};
  const registry=S.keyDocs.get(base||'@origin');
  let candidates=recordVerificationEntries(registry?.entries||[],doc.signing_key_id);
  const boundId=String(p.document_signing_key_id||''),
    boundStatus=String(p.document_signing_key_status||''),
    boundKey=String(p.document_public_key_hex||'').toLowerCase();
  const hasDocumentKeyBinding=!!(boundId||boundStatus||boundKey);
  if(!hasDocumentKeyBinding||boundId!==String(doc.signing_key_id||'')
      ||!['current','previous','archived'].includes(boundStatus)
      ||!/^[0-9a-f]{64}$/.test(boundKey))
    return {ok:false,reason:'provider_document_key_binding_invalid'};
  candidates=candidates.filter((entry)=>entry.key_id===boundId&&entry.status===boundStatus
    &&String(entry.public_key_hex||'').toLowerCase()===boundKey);
  const recordMatches=[];
  for(const entry of candidates){ try{
    if(await ed.verifyAsync(hexToBytes(doc.signature_hex),enc.encode(canon(r)),
      hexToBytes(entry.public_key_hex))) recordMatches.push(entry);
  }catch(e){} }
  if(recordMatches.length!==1) return {ok:false,reason:'provider_document_signature_invalid'};
  const documentKey=recordMatches[0];
  try{ ok=await ed.verifyAsync(hexToBytes(policy.signature_hex),
    enc.encode(canon(providerPolicyPayload(policy))),hexToBytes(documentKey.public_key_hex)); }catch(e){ ok=false; }
  if(!ok) return {ok:false,reason:'provider_policy_signature_invalid'};
  const did=String(r.did||'');
  if(did.startsWith('did:personaos:')&&did.slice('did:personaos:'.length).split('/')[0]!==p.host_kernel_id) return {ok:false,reason:'provider_did_kernel_mismatch'};
  const access=evaluatePublicRecordAccess(r,policy,doc.links||{});
  if(!access.ok||!access.canDiscover) return {ok:false,reason:access.reason||'provider_access_refused'};
  return {ok:true,access,documentKey};
}
async function verifyHttpProviderWithKeyRefresh(envelope,doc,boot,base,expectedKey=''){
  let keys=await keysFor(base,boot);
  let verification=await verifyHttpProviderEnvelope(envelope,doc,keys,boot,base,expectedKey);
  if(verification.ok) return {...verification,keys};
  const cacheKey=base||'@origin', last=S.providerKeyRefreshAt.get(cacheKey)||0;
  if(Date.now()-last<10000) return {...verification,keys:{}};
  S.providerKeyRefreshAt.set(cacheKey,Date.now());
  keys=await keysFor(base,boot,{refresh:true});
  verification=await verifyHttpProviderEnvelope(envelope,doc,keys,boot,base,expectedKey);
  return verification.ok?{...verification,keys}:{...verification,keys:{}};
}
async function verifyPersonaLifecycleCard(card,record,documentKey){
  if(record?.kind!=='persona'||documentKey?.key_id!=='kernel-master') return false;
  if(!card||typeof card!=='object'||Array.isArray(card)
      ||card.schema!=='personaos-persona-lifecycle-card/1'
      ||card.signing_key_id!=='kernel-master'
      ||!/^[0-9a-f]{128}$/i.test(String(card.signature_hex||''))) return false;
  const payload={};
  for(const key of Object.keys(card)) if(key!=='signature_hex') payload[key]=card[key];
  try{ return await ed.verifyAsync(hexToBytes(card.signature_hex),enc.encode(canon(payload)),
    hexToBytes(documentKey.public_key_hex)); }catch(_){ return false; }
}
const PUBLIC_TASK_LIFECYCLE_FIELDS=Object.freeze([
  'access','block','kernel_id','links','pressure','review','revision','run_id','schema',
  'signature_hex','signing_key_id','state','task_id','terminal_reason',
].sort());
const PUBLIC_TASK_LIFECYCLE_REVISION_FIELDS=Object.freeze([
  'schema','kernel_id','run_id','task_id','state','pressure','review','block',
  'terminal_reason','links','access',
]);
const PUBLIC_TASK_LIFECYCLE_TASK_ID_RE=/^[A-Za-z0-9][A-Za-z0-9:_.-]{0,255}$/;
function _plainLifecycleObject(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function _publicLifecycleText(value,maximum){ return typeof value==='string'&&value===value.trim()
  &&!!value&&[...value].length<=maximum&&!/[\u0000-\u001f\u007f]/u.test(value); }
async function verifyPublicTaskLifecycle(lifecycle,record,documentKey,kernelId){
  if(record?.kind!=='task'||documentKey?.key_id!=='kernel-master'
      ||!_exactObjectFields(lifecycle,PUBLIC_TASK_LIFECYCLE_FIELDS)
      ||lifecycle.schema!=='personaos-public-task-lifecycle/1'
      ||lifecycle.kernel_id!==kernelId
      ||lifecycle.access!=='public_read_only'
      ||lifecycle.signing_key_id!=='kernel-master'
      ||!/^run-[A-Za-z0-9_-]{1,180}$/.test(String(lifecycle.run_id||''))
      ||!PUBLIC_TASK_LIFECYCLE_TASK_ID_RE.test(String(lifecycle.task_id||''))
      ||!_publicLifecycleText(lifecycle.state,128)
      ||(lifecycle.terminal_reason
        &&!_publicLifecycleText(lifecycle.terminal_reason,512))
      ||!/^sha256:[0-9a-f]{64}$/.test(String(lifecycle.revision||''))
      ||!/^[0-9a-f]{128}$/.test(String(lifecycle.signature_hex||''))
      ||!_plainLifecycleObject(lifecycle.pressure)
      ||!_plainLifecycleObject(lifecycle.review)
      ||!_plainLifecycleObject(lifecycle.block)
      ||!_exactObjectFields(lifecycle.links,['discovery','live_artifacts','telemetry'])
      ||lifecycle.links.discovery!=='/.well-known/personaos-discovery.json'
      ||lifecycle.links.live_artifacts!==`/runs/${lifecycle.run_id}/live-artifacts`
      ||lifecycle.links.telemetry!=='/telemetry/live/latest.json'
      ||String(record.did||'')!==`did:personaos:${kernelId}/task/${lifecycle.run_id}`)
    return false;
  const evidenceBytes=enc.encode(canon({pressure:lifecycle.pressure,
    review:lifecycle.review,block:lifecycle.block})).length;
  if(evidenceBytes>3*256*1024) return false;
  const revisionPayload={};
  for(const field of PUBLIC_TASK_LIFECYCLE_REVISION_FIELDS) revisionPayload[field]=lifecycle[field];
  if(`sha256:${await sha256Hex(enc.encode(canon(revisionPayload)))}`!==lifecycle.revision)
    return false;
  const expectedCapabilities=[
    'public_task_lifecycle',
    `task_state:${lifecycle.state}`,
    `task_run:${lifecycle.run_id}`,
    `task_id:${lifecycle.task_id}`,
    `task_revision:${lifecycle.revision}`,
  ];
  const capabilities=Array.isArray(record.capability_summary)?record.capability_summary:[];
  if(expectedCapabilities.some((value)=>capabilities.filter((item)=>item===value).length!==1))
    return false;
  const payload={}; for(const field of Object.keys(lifecycle))
    if(field!=='signature_hex') payload[field]=lifecycle[field];
  try{ return await ed.verifyAsync(hexToBytes(lifecycle.signature_hex),enc.encode(canon(payload)),
    hexToBytes(documentKey.public_key_hex)); }catch(_){ return false; }
}
async function verifyPublicCommunicationRoutes(base,live){
  const routes=Array.isArray(live?.communication_routes)?live.communication_routes.slice(-96):null;
  if(live&&typeof live==='object'){
    VERIFIED_COMMUNICATION_ROUTES.set(live,[]);
    VERIFIED_COMMUNICATION_ROUTE_COLLECTIONS.delete(live);
  }
  if(!routes) return [];
  const advertised=String(live?.communication_routes_hash||'').toLowerCase();
  if(!/^sha256:[0-9a-f]{64}$/.test(advertised)
      ||`sha256:${await sha256Hex(enc.encode(canon(routes)))}`!==advertised){
    return []; }
  VERIFIED_COMMUNICATION_ROUTE_COLLECTIONS.add(live);
  const registry=S.keyDocs.get(base||'@origin');
  const key=currentMasterKey(registry?.entries||[]); if(!key) return [];
  const verified=[];
  for(const route of routes){
    if(!isExactPublicCommunicationRoute(route)) continue;
    const payload={}; for(const field of Object.keys(route)) if(field!=='signature_hex') payload[field]=route[field];
    try{ if(await ed.verifyAsync(hexToBytes(route.signature_hex),enc.encode(canon(payload)),hexToBytes(key)))
      verified.push(route); }catch(_){ /* one bad route cannot poison independently signed siblings */ }
  }
  VERIFIED_COMMUNICATION_ROUTES.set(live,verified);
  return verified;
}
const PUBLIC_AGGREGATE_TELEMETRY_FIELDS=Object.freeze([
  'activity','activity_hash','communication_routes','communication_routes_hash','counts',
  'generated_at','model_status','node_id','personas','schema','signature_hex','signing_key_id',
  'sufficiency','topology','topology_hash',
].sort());
async function verifyPublicTelemetryFrame(base,live){
  if(live?.schema===OPERATOR_LIVE_TELEMETRY_SCHEMA)
    return !!tokenFor(join(base,'telemetry.json'));
  if(live?.schema!=='personaos-live-telemetry-public/1'
      ||!_exactObjectFields(live,PUBLIC_AGGREGATE_TELEMETRY_FIELDS)
      ||!_freshPublicGeneratedAt(live.generated_at)
      ||!Array.isArray(live.personas)||!Array.isArray(live.activity)
      ||!Array.isArray(live.communication_routes)
      ||!live.model_status||typeof live.model_status!=='object'||Array.isArray(live.model_status)
      ||!_exactObjectFields(live.model_status,['active_calls','recent_events'])
      ||!Array.isArray(live.model_status.active_calls)||!Array.isArray(live.model_status.recent_events))
    return false;
  const registry=S.keyDocs.get(base||'@origin');
  if(!registry?.kernelId||String(live.node_id||'')!==registry.kernelId) return false;
  return verifyCurrentMasterSignedDocument(base,live);
}
async function verifyCurrentMasterSignedDocument(base,doc){
  if(!doc||typeof doc!=='object'||Array.isArray(doc)) return false;
  if(doc.signing_key_id!=='kernel-master'
      ||!/^[0-9a-f]{128}$/i.test(String(doc.signature_hex||''))) return false;
  const registry=S.keyDocs.get(base||'@origin');
  const key=currentMasterKey(registry?.entries||[]); if(!key) return false;
  const payload={}; for(const field of Object.keys(doc)) if(field!=='signature_hex') payload[field]=doc[field];
  try{ return await ed.verifyAsync(hexToBytes(doc.signature_hex),enc.encode(canon(payload)),hexToBytes(key)); }
  catch(_){ return false; }
}
const PROVIDER_INVENTORY_FIELDS=Object.freeze([
  'base','document_count','documents','expires_at','generated_at','inventory_generation',
  'inventory_hash','inventory_manifest','inventory_manifest_hash','kernel_id',
  'previous_inventory_hash','provider_count','providers','schema','signature_hex',
  'signing_key_id','version','visibility',
].sort());
const PROVIDER_MANIFEST_FIELDS=Object.freeze(['document_hash','record_id','record_url']);
const SHA256_CONTENT_RE=/^sha256:[0-9a-f]{64}$/;
async function verifyProviderInventory(index,base,boot){
  const expectedBase=String(base||location.origin).replace(/\/$/,'');
  if(!_exactObjectFields(index,PROVIDER_INVENTORY_FIELDS)
      ||index.schema!=='dht-provider-index/3'||index.kernel_id!==boot?.kernel_id
      ||String(index.base||'').replace(/\/$/,'')!==expectedBase
      ||index.signing_key_id!=='kernel-master'||index.visibility!=='public'
      ||!Number.isSafeInteger(index.inventory_generation)||index.inventory_generation<1
      ||index.version!==index.inventory_generation
      ||!Array.isArray(index.inventory_manifest)||!Array.isArray(index.providers)
      ||!index.documents||typeof index.documents!=='object'||Array.isArray(index.documents)
      ||!Number.isSafeInteger(index.provider_count)||index.provider_count!==index.providers.length
      ||!Number.isSafeInteger(index.document_count)
      ||index.document_count!==Object.keys(index.documents).length
      ||index.document_count!==index.inventory_manifest.length
      ||!SHA256_CONTENT_RE.test(String(index.inventory_manifest_hash||''))
      ||!SHA256_CONTENT_RE.test(String(index.inventory_hash||'')))
    return {ok:false,reason:'provider_inventory_shape_invalid'};
  const inventoryWindow=validateProviderInventoryWindow(index.generated_at,index.expires_at);
  const {generatedAt,expiresAt}=inventoryWindow;
  if(!inventoryWindow.ok)
    return {ok:false,reason:'provider_inventory_stale'};
  if((index.inventory_generation===1&&index.previous_inventory_hash!=='')
      ||(index.inventory_generation>1&&!SHA256_CONTENT_RE.test(String(index.previous_inventory_hash||''))))
    return {ok:false,reason:'provider_inventory_chain_invalid'};
  const manifest=index.inventory_manifest;
  const rows=[]; const recordIds=new Set(), documentHashes=new Set();
  for(const item of manifest){
    if(!_exactObjectFields(item,PROVIDER_MANIFEST_FIELDS)
        ||!/^[A-Za-z0-9:_.-]{1,300}$/.test(String(item.record_id||''))
        ||!SHA256_CONTENT_RE.test(String(item.document_hash||''))
        ||String(item.record_url)!==`discovery/public/records/${item.record_id}.json`
        ||recordIds.has(item.record_id)||documentHashes.has(item.document_hash)
        ||!Object.hasOwn(index.documents,item.document_hash))
      return {ok:false,reason:'provider_inventory_manifest_invalid'};
    recordIds.add(item.record_id); documentHashes.add(item.document_hash); rows.push(item);
  }
  const lexical=(left,right)=>left<right?-1:left>right?1:0;
  const sorted=[...rows].sort((a,b)=>lexical(a.record_id,b.record_id)
    ||lexical(a.document_hash,b.document_hash)||lexical(a.record_url,b.record_url));
  if(canon(rows)!==canon(sorted)
      ||`sha256:${await sha256Hex(enc.encode(canon(rows)))}`!==index.inventory_manifest_hash
      ||Object.keys(index.documents).some((hash)=>!documentHashes.has(hash)))
    return {ok:false,reason:'provider_inventory_manifest_hash_invalid'};
  const byRecord=new Map(rows.map((item)=>[item.record_id,item]));
  const referenced=new Set();
  for(const reference of index.providers){
    const provider=reference?.record, item=byRecord.get(String(provider?.record_id||''));
    if(!item||String(provider.record_url||'')!==item.record_url
        ||String(provider.document_hash||'')!==item.document_hash
        ||String(reference.document_ref||'')!==item.document_hash
        ||provider.inventory_generation!==index.inventory_generation
        ||provider.inventory_manifest_hash!==index.inventory_manifest_hash)
      return {ok:false,reason:'provider_inventory_record_binding_invalid'};
    referenced.add(item.record_id);
  }
  if(referenced.size!==recordIds.size)
    return {ok:false,reason:'provider_inventory_manifest_unreferenced'};
  const hashPayload={};
  for(const field of Object.keys(index)) if(field!=='inventory_hash'&&field!=='signature_hex')
    hashPayload[field]=index[field];
  if(`sha256:${await sha256Hex(enc.encode(canon(hashPayload)))}`!==index.inventory_hash)
    return {ok:false,reason:'provider_inventory_hash_invalid'};
  if(!await verifyCurrentMasterSignedDocument(base,index))
    return {ok:false,reason:'provider_inventory_signature_invalid'};
  return {ok:true,generation:index.inventory_generation,hash:index.inventory_hash,
    previousHash:String(index.previous_inventory_hash||''),manifestHash:index.inventory_manifest_hash,
    recordIds,bindings:new Map(rows.map((item)=>[item.record_id,item.document_hash])),
    generatedAt,expiresAt};
}
const PUBLIC_ENTITY_INDEX_FIELDS=Object.freeze([
  'environments','generated_at','node_id','personas','schema','signature_hex','signing_key_id',
].sort());
const PUBLIC_PERSONA_FEED_FIELDS=Object.freeze([
  'activity','communication_routes','communication_routes_hash','generated_at','model_status',
  'name','node_id','persona_id','schema','signature_hex','signing_key_id','summary','tier',
].sort());
const PUBLIC_ENVIRONMENT_FEED_FIELDS=Object.freeze([
  'activity','communication_routes','communication_routes_hash','environment_id','generated_at',
  'member_count','members','model_status','node_id','schema','signature_hex','signing_key_id','status','tier',
].sort());
function _exactObjectFields(value,fields){
  return !!value&&typeof value==='object'&&!Array.isArray(value)
    &&Object.keys(value).sort().join('\u0000')===fields.join('\u0000');
}
function _telemetryEntitySlug(value){
  const source=String(value||'').split(':').pop().trim(); let out='',replaced=false;
  for(const char of source){
    if(/[A-Za-z0-9._-]/.test(char)){ out+=char; replaced=false; }
    else if(!replaced){ out+='_'; replaced=true; }
  }
  return out.replace(/^_+|_+$/g,'')||'unknown';
}
function _entityFeedPath(rel){ return String(rel||'').split(/[?#]/,1)[0].replace(/^\/+/, ''); }
function _freshPublicGeneratedAt(value,now=Date.now()){
  const at=Date.parse(String(value||''));
  return Number.isFinite(at)&&at>=now-30000&&at<=now+30000;
}
function _safeEntityMap(value,prefix){
  if(!value||typeof value!=='object'||Array.isArray(value)
      ||Object.keys(value).length>NETWORK_LIMITS.cachedRecords) return false;
  return Object.entries(value).every(([id,rel])=>id&&id.length<=512
    &&String(rel)===`${prefix}/${_telemetryEntitySlug(id)}.json`);
}
async function verifyPublicEntityDocument(base,rel,doc){
  const registry=S.keyDocs.get(base||'@origin');
  if(!_freshPublicGeneratedAt(doc?.generated_at)||!registry?.kernelId
      ||String(doc?.node_id||'')!==registry.kernelId
      ||(kernelForBase(base)&&kernelForBase(base)!==registry.kernelId)) return false;
  const path=_entityFeedPath(rel);
  if(isPublicEntityIndexDocument(doc)){
    if(!_exactObjectFields(doc,PUBLIC_ENTITY_INDEX_FIELDS)
        ||path!=='telemetry/live/entities.json'
        ||!_safeEntityMap(doc.personas,'telemetry/personas')
        ||!_safeEntityMap(doc.environments,'telemetry/environments')) return false;
  }else if(doc?.schema==='personaos-persona-telemetry-public/1'){
    const pid=String(doc.persona_id||'');
    if(!_exactObjectFields(doc,PUBLIC_PERSONA_FEED_FIELDS)||!pid||pid.length>512
        ||path!==`telemetry/personas/${_telemetryEntitySlug(pid)}.json`
        ||doc.tier!=='public_redacted'
        ||!doc.summary||typeof doc.summary!=='object'||Array.isArray(doc.summary)
        ||String(doc.summary.persona_id||'')!==pid
        ||String(doc.name||'')!==String(doc.summary.name||'')
        ||!Array.isArray(doc.model_status)||!Array.isArray(doc.activity)
        ||!Array.isArray(doc.communication_routes)
        ||doc.model_status.some((event)=>!event||typeof event!=='object'||Array.isArray(event)
          ||String(event.persona_id||'')!==pid)
        ||!VERIFIED_COMMUNICATION_ROUTE_COLLECTIONS.has(doc)) return false;
  }else if(doc?.schema==='personaos-environment-telemetry-public/1'){
    const eid=String(doc.environment_id||'');
    if(!_exactObjectFields(doc,PUBLIC_ENVIRONMENT_FEED_FIELDS)||!eid||eid.length>512
        ||path!==`telemetry/environments/${_telemetryEntitySlug(eid)}.json`
        ||doc.tier!=='public_redacted'||!Number.isSafeInteger(doc.member_count)
        ||doc.member_count<0||!Array.isArray(doc.members)||doc.members.length!==doc.member_count
        ||!Array.isArray(doc.model_status)||!Array.isArray(doc.activity)
        ||!Array.isArray(doc.communication_routes)
        ||doc.model_status.some((event)=>!event||typeof event!=='object'||Array.isArray(event)
          ||String(event.environment_id||'')!==eid)
        ||!VERIFIED_COMMUNICATION_ROUTE_COLLECTIONS.has(doc)) return false;
  }else return false;
  return verifyCurrentMasterSignedDocument(base,doc);
}
async function verifiedRecordFromDoc(doc,keys,boot,base,plane,recordUrl,meta={}){
  if(!doc?.record) return {ok:false,row:null};
  const registry=S.keyDocs.get(base||'@origin')||{};
  const signature=await verifyRecord(doc,registry.entries||[]);
  if(!signature.ok) return {ok:false,row:null,reason:'record_signature_invalid'};
  const access=meta.access||evaluatePublicRecordAccess(doc.record,doc.access_policy||{},doc.links||{});
  if(!access.ok||!access.canDiscover) return {ok:false,row:null,reason:access.reason||'record_access_refused'};
  const k=doc.host_kernel_id||boot?.kernel_id||'', rawBase=doc.base||base||'';
  const rawUrl=recordUrl?join(base,recordUrl):(doc._url||'');
  const surface=projectRecordSurface(doc.record,doc.access_policy||{},doc.links||{},access,
    {base:rawBase,url:rawUrl});
  const r=surface.record, projectedPolicy=surface.policy;
  const b=surface.base, links=surface.links, url=surface.url;
  const gossipRecord=projectDiscoveryRecord(doc.record,false);
  const personaIdentity=r.kind==='persona'?signedPersonaIdentity(doc.record):null;
  const personaId=personaIdentity?.canonicalId||'';
  // An independently published persona-key claim is useful only because this
  // exact source record has already passed the kernel/document signature gate.
  // Keep the pin internal; absence is normal and never invents one.
  const identityPublicKeyHex=personaIdentity
    ?personaIdentityKeyPin(doc.record,personaIdentity.signedId):'';
  const lifecycleVerified=personaId
    ?await verifyPersonaLifecycleCard(doc.persona_lifecycle_card,doc.record,signature.entry):false;
  const taskLifecycleVerified=r.kind==='task'
    ?await verifyPublicTaskLifecycle(doc.task_lifecycle,doc.record,signature.entry,k):false;
  return {ok:true,row:{...r,_kernel:k,_url:url,_access:projectedPolicy,_links:links,
    _base:b,_plane:plane,_effective_level:access.level,_readAuthorized:access.canRead,
    _providerBase:meta.providerBaseVerified===true?rawBase:'',
    _personaIdentityPublicKeyHex:identityPublicKeyHex,
    _personaIdentitySigningKeyId:personaId?String(doc.record.identity_signing_key_id||''):'',
    _personaLifecycleVerified:lifecycleVerified,
    persona_lifecycle_card:lifecycleVerified?doc.persona_lifecycle_card:null,
    _taskLifecycleVerified:taskLifecycleVerified,
    task_lifecycle:taskLifecycleVerified?doc.task_lifecycle:null,
    _gossipHint:{schema:'personaos-provider-hint/1',record:gossipRecord},
    _doc:{record:r,signature_hex:doc.signature_hex,signing_key_id:doc.signing_key_id,
          signing_key_status:signature.entry.status,public_key_hex:signature.entry.public_key_hex,
          kernel_id:k,host_kernel_id:doc.host_kernel_id||'',base:b,links,
          access_policy:projectedPolicy,record_signature_verified:true,
          policy_signature_verified:true,task_lifecycle_signature_verified:taskLifecycleVerified}}};
}
function logRecordAccess(row,source){
  const label=String(row?.label||row?.record_id||'record').slice(0,36);
  log('access',`${source}: ${label} · ${row?._readAuthorized?'public read granted':'discover-only; read links withheld'}`,true);
}
async function verifiedRowsFromProviderIndex(providerIndex,base,boot,plane,source='http'){
  const rows=[]; let refused=0;
  const inventory=await verifyProviderInventory(providerIndex,base,boot);
  if(!inventory.ok){
    log('verify',`${source}: signed provider inventory refused · ${inventory.reason}`,false);
    return {rows,refused:Math.max(1,Number(providerIndex?.provider_count)||0),
      envelopeCount:Number(providerIndex?.provider_count)||0,inventory};
  }
  const hydrated=hydrateProviderIndex(providerIndex);
  const declared=Array.isArray(providerIndex?.providers)?providerIndex.providers.length:0;
  const indexReason=providerIndex?.kernel_id!==boot?.kernel_id
    ?'provider_index_kernel_mismatch':hydrated.reason;
  if(!hydrated.ok||indexReason){
    log('verify',`${source}: compact provider index refused · ${indexReason}`,false);
    return {rows,refused:Math.max(1,declared),envelopeCount:declared,inventory};
  }
  refused=hydrated.refused||0;
  const providers=hydrated.envelopes;
  const byUrl=new Map();
  for(const envelope of (Array.isArray(providers)?providers:[])){
    const url=String(envelope?.record?.record_url||'');
    if(envelope?.schema!=='provider-record-envelope/1'
        ||envelope?.record?.schema!=='provider-record/1'
        ||!envelope?.document?.record
        ||!/^discovery\/public\/records\/[A-Za-z0-9:_.-]+\.json$/.test(url)){
      refused++; log('verify',`${source}: incomplete or malformed provider envelope refused`,false); continue; }
    if(!byUrl.has(url)) byUrl.set(url,envelope);
  }
  const entries=[...byUrl.entries()];
  // The signed ProviderRecord hashes this exact embedded document. Verifying the
  // atomic envelope+document pair avoids joining an envelope from generation N
  // with a moving record URL from generation N+1. HTTP and P2P now share the same
  // transport semantics; record_url remains a signed inspection locator only.
  // Provider identities are independent once the atomic inventory has passed.
  // Verify bounded batches concurrently so a large population does not turn
  // discovery into an artificial one-person-at-a-time schedule.
  const batchSize=64;
  for(let offset=0;offset<entries.length;offset+=batchSize){
    const batch=await Promise.all(entries.slice(offset,offset+batchSize).map(async([recordUrl,envelope])=>{
      const doc=envelope.document;
      const authority=await verifyHttpProviderWithKeyRefresh(envelope,doc,boot,base);
      if(!authority.ok) return {ok:false,envelope,reason:authority.reason||'FAIL'};
      const out=await verifiedRecordFromDoc(doc,authority.keys,boot,base,plane,recordUrl,
        {access:authority.access,providerBaseVerified:true});
      return out.ok?{ok:true,row:out.row}:{ok:false,envelope,reason:out.reason||'record refused'};
    }));
    for(const result of batch){
      if(!result.ok){ refused++;
        log('verify',`${source}: ${(result.envelope?.record?.key||'provider').slice(0,28)} · ${result.reason}`,false);
        continue; }
      logRecordAccess(result.row,source); rows.push(result.row);
    }
  }
  return {rows,refused,envelopeCount:entries.length,inventory};
}
async function verifiedRowsFromP2PResult(result,source='p2p'){
  const rows=[]; let refused=0;
  const expectedKey=String(result?.key||'');
  for(const item of (Array.isArray(result?.records)?result.records:[])){
    const doc=item?.document, p=item?.record||{};
    if(!doc?.record||!expectedKey){ refused++; continue; }
    const pboot={kernel_id:p.host_kernel_id,keys_url:'.well-known/personaos-keys.json'};
    const base=String(p.base_url||'');
    const authority=await verifyHttpProviderWithKeyRefresh(item,doc,pboot,base,expectedKey);
    if(!authority.ok){ refused++; continue; }
    const out=await verifiedRecordFromDoc(doc,authority.keys,pboot,base,'internet','',
      {access:authority.access,providerBaseVerified:true});
    if(!out.ok){ refused++; continue; }
    out.row._net='p2p';
    out.row._providerInventoryGeneration=p.inventory_generation;
    out.row._providerInventoryManifestHash=String(p.inventory_manifest_hash||'');
    out.row._providerDocumentHash=String(p.document_hash||'');
    logRecordAccess(out.row,source); rows.push(out.row);
  }
  return {rows,refused};
}
const DEFAULT_GLOBAL_DISCOVERY_ENDPOINT='https://node1.personas.ai';
function globalDiscoveryEndpoints(){
  const p=new URLSearchParams(location.search);
  if(p.get('no_global_discovery')==='1') return [];
  // node1 is only an untrusted first-contact locator. Every announcement and
  // every reached discovery record is independently signature/hash verified;
  // the locator has no record or identity authority.
  return [...new Set([...p.getAll('resolver'),DEFAULT_GLOBAL_DISCOVERY_ENDPOINT]
    .map((u)=>String(u||'').replace(/\/$/,'')).filter(Boolean))];
}
async function verifyGlobalEnvelope(env){
  const ann=env?.announcement;
  if(env?.schema!=='personaos-node-announcement-envelope/1'||ann?.schema!=='personaos-node-announcement/1') return {ok:false};
  const publicKey=String(env?.public_key_hex||'');
  const kernelId=String(ann?.kernel_id||'');
  // node1 is an untrusted locator, so a self-signature alone cannot assign an
  // arbitrary kernel id. Production kernel ids are self-certifying prefixes of
  // their stable kernel-master discovery key.
  if(env?.signing_key_id!=='kernel-master'||!/^[0-9a-f]{64}$/.test(publicKey)
    ||!/^[0-9a-f]{128}$/.test(String(env?.signature_hex||''))
    ||!/kernel:[0-9a-f]{16}/.test(kernelId)
    ||kernelId!==`kernel:${publicKey.slice(0,16)}`) return {ok:false};
  const exp=Date.parse(ann.expires_at||'');
  if(!Number.isFinite(exp)||exp<=Date.now()) return {ok:false};
  let ok=false;
  try{ ok=await ed.verifyAsync(hexToBytes(env.signature_hex),enc.encode(canon(ann)),hexToBytes(publicKey)); }catch(e){}
  if(!ok) return {ok:false};
  if(Object.prototype.hasOwnProperty.call(env,'public_bundle')||ann.public_bundle_hash) return {ok:false};
  return {ok:true,ann};
}
async function loadGlobalNodes(){
  const endpoints=globalDiscoveryEndpoints();
  if(!endpoints.length){
    S.globalPeers=new Set(); S.globalAnnouncements=new Map(); S.globalAnnouncementByBase=new Map();
    return [];
  }
  const freshPeers=new Set();
  S.globalAnnouncements=new Map(); S.globalAnnouncementByBase=new Map();
  const rows=[];
  const boots=await Promise.all(endpoints.map((ep)=>
    fetchJson(join(ep,'/v1/bootstrap')).then((d)=>({ep,d})).catch(()=>({ep,d:null}))));
  for(const {ep,d} of boots){
    if(!d) continue;
    const addrs=collectBrowserLibp2pBootstraps(
      {pageProtocol:location.protocol},d.libp2p_multiaddrs,d.relay_multiaddrs);
    for(const ma of addrs) S.p2pBootstraps.add(ma);
    if(addrs.length) log('global',`${ep}: ${addrs.length} bootstrap multiaddr(s)`);
  }
  // Traverse only a fixed number of small cursor pages. In global mode a search
  // is sent to the resolver, allowing a kernel outside the sampled first page to
  // surface without materialising the fleet. The paged contract is mandatory;
  // an unpaged legacy response is intentionally not interpreted.
  const resolverQuery=!S.kernelFocus?String(S.q||'').trim():'';
  const docs=await Promise.all(endpoints.map(async(ep)=>{
    const allNodes=[]; let advertisedTotal=0, cursor='', pages=0;
    while(pages<NETWORK_LIMITS.resolverPages&&allNodes.length<NETWORK_LIMITS.cachedKernels){
      const params=new URLSearchParams({limit:String(NETWORK_LIMITS.resolverPage),status:'active'});
      if(resolverQuery) params.set('q',resolverQuery);
      if(cursor) params.set('cursor',cursor);
      const d=await fetchJson(join(ep,`/v1/nodes?${params}`));
      if(!d) break;
      const pageNodes=Array.isArray(d.nodes)?d.nodes:[];
      allNodes.push(...pageNodes.slice(0,NETWORK_LIMITS.cachedKernels-allNodes.length));
      advertisedTotal=Math.max(advertisedTotal,
        Number(d.total??d.total_count??d.node_count??d.count??allNodes.length)||allNodes.length);
      pages++;
      const next=String(d.next_cursor??d.pagination?.next_cursor??'');
      if(!next||next===cursor) break; cursor=next;
    }
    return {ep,allNodes,advertisedTotal,pages};
  }));
  for(const {ep,allNodes,advertisedTotal,pages} of docs){
    S.globalTotal=Math.max(Number(S.globalTotal)||0,advertisedTotal);
    const nodes=allNodes.slice(0,NETWORK_LIMITS.cachedKernels);
    if(!nodes.length) continue;
    log('global',`${ep}: ${nodes.length}/${advertisedTotal} announced node(s) in ${pages} bounded page(s)`);
    for(const env of nodes){
      const verified=await verifyGlobalEnvelope(env);
      if(!verified.ok){ log('global','announcement signature/hash failed',false); continue; }
      const ann=verified.ann, kid=ann.kernel_id||'';
      const base=String(ann.base_url||'').replace(/\/$/,'');
      const announced={...ann,source_endpoint:ep};
      if(kid) S.globalAnnouncements.set(kid,announced);
      if(base) S.globalAnnouncementByBase.set(base,announced);
      noteKernel(kid,'resolver',base||ep,{
        announced:true,
        recordCount:ann.record_count||0,
        reachability:ann.reachability_class||'',
        publicDiscovery:!!ann.public_discovery,
      });
      for(const ma of collectBrowserLibp2pBootstraps(
        {pageProtocol:location.protocol},ann.libp2p_multiaddrs)) S.p2pBootstraps.add(ma);
      if(base) freshPeers.add(base);
    }
  }
  S.globalPeers=freshPeers;
  if(S.globalPeers.size) log('resolver',`verified optional resolver peer(s): ${[...S.globalPeers].slice(0,4).join(', ')}`,true);
  // Paint verified announcements immediately. A public tunnel can take longer to
  // deliver its provider index and record documents; hiding an already-verified
  // node until that entire second phase finishes makes a healthy bootstrap look
  // like an empty network.
  const announced=[...S.globalAnnouncements.values()];
  if(announced.length){
    renderGlobalKernels();
    // A resolver announcement has kernel identity/lease data but no persona
    // topology. Keep an already-rendered focused persona projection until the
    // authoritative entity-feed refresh below replaces it. That refresh still
    // sends an exact empty projection when the final persona departs; this only
    // prevents the locator phase from creating a transient 1→0→1 race.
    const graph=$('#sysGraph');
    const focusedProjectionRendered=!!graph?._nodes?.childElementCount
      &&(!!S.kernelFocus||Math.max(S.globalKernels?.size||0,S.kernels?.size||0,
        Number(S.globalTotal)||0)<=1);
    if(!focusedProjectionRendered) renderCoordGraph([],0);
    updateVitalsCounters();
    if(!S.recs.size){
      const expected=announced.reduce((n,a)=>n+(Number(a.record_count)||0),0);
      const sample=String(announced[0]?.kernel_id||'node').replace(/^kernel:/,'');
      const host=$('#sysEnvs');
      if(host) host.innerHTML=`<section class="discovery-progress" role="status" aria-live="polite">
        <div class="discovery-orbit" aria-hidden="true"><span></span><i></i></div>
        <div><span class="discovery-kicker">SIGNED NODE ANNOUNCEMENT VERIFIED</span>
          <h2>${esc(sample.length>18?sample.slice(0,17)+'…':sample)}</h2>
          <p>Node identity and lease verified. Fetching and checking ${compactCount(expected)} signed public record${expected===1?'':'s'}…</p>
          <div class="discovery-steps"><span class="done">01 · locate</span><span class="done">02 · verify node</span><span class="active">03 · verify records</span></div>
        </div>
      </section>`;
      const status=$('#status');
      if(status) status.innerHTML=`<span class="ok">${announced.length}</span> signed node announcement${announced.length===1?'':'s'} verified · fetching ${compactCount(expected)} public record${expected===1?'':'s'}…`;
    }
  }
  return rows;
}
async function discoverFrom(base,plane,knownBoot=null){
  const where=base||location.origin;
  log('bootstrap',`${where}/.well-known/personaos-discovery.json`);
  const boot=knownBoot||await fetchJson(join(base,'.well-known/personaos-discovery.json'));
  S.peerHealth=(S.peerHealth||new Map());
  if(!boot){ log('bootstrap',`no endpoint at ${where}`,false);
    const gb=S.globalAnnouncementByBase?.get(opBaseKey(where))||S.globalAnnouncementByBase?.get(String(where||'').replace(/\/$/,''));
    if(gb?.kernel_id) noteKernel(gb.kernel_id,'unreachable',where,{reachable:false});
    S.peerHealth.set(where,{ok:false,records:0,t:Date.now()}); return {boot:null,found:[]}; }
  S.boots.set(base||'@origin',boot); collectP2PBootstraps(boot);
  await keysFor(base,boot);
  // The bootstrap count is the number of signed discovery documents, not the
  // number of provider lookup aliases. A compact v3 inventory may legitimately
  // publish several independently signed ProviderRecords (DID, record id,
  // handle) that all bind the same hash-addressed document.
  const advertisedRecordCount=Number(boot.record_count);
  const providerIndexMaxBytes=providerIndexResponseByteLimit(
    advertisedRecordCount,NETWORK_LIMITS.cachedRecords);
  if(!providerIndexMaxBytes){
    log('dht',`${boot.kernel_id||where}: provider record count missing, invalid, or over browser ceiling`,false);
    S.peerHealth.set(where,{ok:false,records:0,t:Date.now()});
    return {boot,found:[]};
  }
  const prov=await fetchJson(join(base,boot.providers_url||'discovery/providers.json'),
    {maxBytes:providerIndexMaxBytes});
  if(!prov||Number(prov.document_count)!==advertisedRecordCount){
    log('dht',`${boot.kernel_id||where}: provider document count does not match advertised bootstrap`,false);
    S.peerHealth.set(where,{ok:false,records:0,t:Date.now()});
    return {boot,found:[]};
  }
  const providers=Array.isArray(prov?.providers)?prov.providers:[];
  log('dht',`${boot.kernel_id||where}: ${providers.length} provider key(s)${boot.providers_are_aggregate?' · public aggregate':''}`);
  const http=await verifiedRowsFromProviderIndex(prov,base,boot,plane,'http provider');
  const found=[...http.rows];
  if(P2P?.resolveProvider){
    const aliases=[...new Set(providers.map((p)=>String(p?.record?.key||'')).filter(Boolean))].slice(0,16);
    const resolved=await Promise.all(aliases.map((key)=>P2P.resolveProvider(key,{timeoutMs:5000}).catch(()=>null)));
    let authorityVerified=0;
    for(const result of resolved){ const verified=await verifiedRowsFromP2PResult(result,'p2p index lookup');
      // Standalone provider lookups remain locator evidence only. Public rows
      // are rendered from the signed v3 inventory so retirement/omission can
      // be reconciled atomically instead of leaving a stale P2P contribution.
      authorityVerified+=verified.rows.length; }
    if(aliases.length) log('p2p',`${authorityVerified}/${aliases.length} per-key provider lookup proof(s) verified · inventory promotion required`,authorityVerified>0);
  }
  const uniqueFound=new Map(found.map((row)=>[
    `${row._kernel||boot.kernel_id||'@unknown'}\u0000${row.record_id||row.did}`,row]));
  found.length=0; found.push(...uniqueFound.values());
  if(found.length) log('verify',`${found.length}/${http.envelopeCount} record(s) provider + record + policy verified`,true);
  // Bridge-cache gossip is untrusted lookup material only. It never becomes a
  // displayed record or supplies base/links/policy; current-master ProviderRecord
  // resolution is the sole promotion path into S.recs.
  const p2pReceived=boot.p2p_received_url||boot.discovery_p2p_received_url;
  const p2pDoc=p2pReceived?await fetchJson(join(base,p2pReceived)):null;
  for(const doc of (p2pDoc?.records||[])){
    if(doc?.record?.visibility_tier==='public') queueProviderHints(doc.record,'bridge-cache gossip');
  }
  // HTTP gossip cache is also hint-only. Self-asserted origin/kernel fields never
  // create a node or record in the UI before current-master provider resolution.
  const gossip=await fetchJson(join(base,'gossip/cache'));
  for(const id in (gossip?.cards||gossip||{})){
    const card=(gossip.cards||gossip)[id]; if(!card||typeof card!=='object') continue;
    const record=card.record||card;
    if(record?.visibility_tier==='public') queueProviderHints(record,'HTTP gossip cache');
  }
  if(boot.kernel_id){
    const sources=peerSourceTags(base);
    if(sources.length) sources.forEach((src)=>noteKernel(boot.kernel_id,src,base||location.origin,{reachable:true}));
    else noteKernel(boot.kernel_id,'http',base||location.origin,{reachable:true});
  }
  S.peerHealth.set(where,{ok:true,records:found.length,kernel:boot.kernel_id||'',t:Date.now()});
  const inventory={...(http.inventory||{}),complete:http.inventory?.ok===true
    &&http.refused===0&&new Set(found.map((row)=>row.record_id)).size===http.inventory.recordIds?.size};
  return {boot,found,inventory};
}

// ---------- global kernel tracker (the "across the globe" strip) ----------
function rememberKernel(kernelId){
  if(!kernelId) return;
  const kernels=S.kernels;
  if(kernels.has(kernelId)) kernels.delete(kernelId);
  kernels.add(kernelId);
  while(kernels.size>NETWORK_LIMITS.cachedKernels){
    const victim=[...kernels].find((id)=>id!==S.kernelFocus);
    if(!victim) break;
    kernels.delete(victim); S.kernelOverflow++;
  }
}
function noteKernel(kernelId,via,base,meta={}){
  if(!kernelId) return;
  rememberKernel(kernelId);
  const g=S.globalKernels=(S.globalKernels||new Map());
  const cur=g.get(kernelId)||{via:new Set(),bases:new Set(),lastSeen:0,meta:{}};
  cur.via.add(via); if(base) cur.bases.add(base); cur.lastSeen=Date.now();
  cur.meta={...(cur.meta||{}),...(meta||{})};
  // Reinsert so Map iteration is an LRU order. Keep the focused kernel pinned;
  // an old idle aggregate may be rediscovered later without making this tab's
  // memory grow with global population size.
  if(g.has(kernelId)) g.delete(kernelId);
  g.set(kernelId,cur);
  try{ NETWORK.upsertEntity({kernel_id:kernelId,node_id:kernelId,kind:'kernel',
    status:meta.reachable===false?'offline':'idle',last_seen_at:cur.lastSeen,...meta}); }catch(e){}
  while(g.size>NETWORK_LIMITS.cachedKernels){
    const victim=[...g.keys()].find((id)=>id!==S.kernelFocus); if(!victim) break;
    g.delete(victim); S.kernelOverflow++;
  }
}
function kernelForBase(base){
  const key=base||'@origin';
  return (S.boots&&S.boots.get(key)?.kernel_id)
    ||S.globalAnnouncementByBase?.get(String(base||'').replace(/\/$/,''))?.kernel_id||'';
}
function kernelIsFocused(kernel){ return !S.kernelFocus||String(kernel||'')===S.kernelFocus; }
function baseIsFocused(base){ return !S.kernelFocus||kernelForBase(base)===S.kernelFocus; }
function kernelActivity(info){
  let active=0;
  for(const base of (info?.bases||[])){
    const calls=S.activeModelCallsByBase?.get(base||'@origin')||[]; active+=calls.length;
  }
  return active;
}
function renderGlobalKernels(){
  const el=$('#globalKernels'); if(!el) return;
  const g=S.globalKernels||new Map();
  const allBtn=$('#networkAll'); if(allBtn){ allBtn.classList.toggle('on',!S.kernelFocus); allBtn.setAttribute('aria-pressed',String(!S.kernelFocus)); }
  const scope=$('#networkScope'), overflow=$('#networkOverflow');
  const knownTotal=Math.max(g.size,Number(S.globalTotal)||0,S.kernels?.size||0);
  if(!g.size){
    el.innerHTML='<span class="loading-inline"><span class="dot"></span><span class="dim">no kernels discovered yet</span></span>';
    if(scope) scope.textContent='0 nodes · awaiting node1.personas.ai announcements';
    if(overflow) overflow.hidden=true;
    return;
  }
  const now=Date.now();
  let entries=[...g.entries()].map(([kid,info])=>{
    const fresh=(now-info.lastSeen)<45000;
    const hasRoute=[...info.via].some((v)=>['http','manual','local','ipfs','p2p','gossip'].includes(v));
    const reachable=info.meta?.reachable===false?false:(info.meta?.reachable===true||hasRoute);
    const active=kernelActivity(info);
    const score=(kid===S.kernelFocus?1e9:0)+(active?1e7+active:0)+(fresh?1e5:0)+(reachable?1e4:0)
      +Math.min(9999,Number(info.meta?.recordCount)||0);
    return {kid,info,fresh,reachable,active,score};
  }).sort((a,b)=>b.score-a.score||b.info.lastSeen-a.info.lastSeen||a.kid.localeCompare(b.kid));
  const query=String(S.q||'').trim();
  if(query){ const matches=entries.filter(({kid,info})=>`${kid} ${[...info.bases].join(' ')}`.toLowerCase().includes(query));
    if(matches.length) entries=[...matches,...entries.filter((row)=>!matches.includes(row))]; }
  const visible=entries.slice(0,NETWORK_LIMITS.kernelChips);
  el.innerHTML=visible.map(({kid,info,fresh,reachable,active})=>{
    const via=[...info.via].map((v)=>`<span class="n ${v==='p2p'?'i':v==='gossip'||v==='unreachable'?'m':'k'}">${v.toUpperCase()}</span>`).join('')
      +(info.via.has('resolver')&&!reachable?'<span class="n m">NO ROUTE</span>':'');
    const title=[...info.bases].join(' ')+` · via ${[...info.via].join(', ')||'unknown'}`
      +((info.meta?.recordCount||info.meta?.reachability)?` · records=${info.meta.recordCount||0} · reachability=${info.meta.reachability||''}`:'');
    const label=kid.replace(/^kernel:/,'');
    const liveRoute=active>0||(reachable&&fresh);
    return `<button type="button" class="gk ${liveRoute?'ok':'dim'}${kid===S.kernelFocus?' on':''}" data-kernel="${esc(kid)}"`
      +` aria-pressed="${kid===S.kernelFocus?'true':'false'}" title="${esc(title)}">`
      +`<span class="dot ${liveRoute?'live':''}"></span>${esc(label.length>14?label.slice(0,13)+'…':label)}`
      +(active?` <span class="n k">${active} RUNNING</span>`:via)+`</button>`;
  }).join('');
  if(scope) scope.textContent=S.kernelFocus
    ?`focused node · ${compactCount(Number(g.get(S.kernelFocus)?.meta?.recordCount)||0)} public records`
    :`${compactCount(knownTotal)} discovered · ${visible.length} activity-prioritized`;
  const omitted=Math.max(0,knownTotal-visible.length);
  if(overflow){ overflow.hidden=omitted===0; overflow.textContent=omitted?`+${compactCount(omitted)} aggregated · search or select a node`:''; }
}
// A bare hosted URL resolves signed node announcements through
// node1.personas.ai automatically. Same-origin/local, resolver, gossip, and
// content-addressed P2P routes are additive evidence; viewers never enter a
// peer URL or carry routing state in the public URL.
function peerList(){
  const focused=S.kernelFocus?[...(S.globalKernels?.get(S.kernelFocus)?.bases||[])]:[];
  // Explicit and local routes outrank opportunistic/global ones; a focused node
  // is pinned to the front. This is the active monitoring window, not a claim
  // that the rest of the discovered population ceased to exist.
  const all=[...new Set([...focused,...(S.localPeers||[]),
    ...(S.gossipPeers||[]),...(S.ipfsPeers||[]),...(S.globalPeers||[])].filter(Boolean))];
  const activeBases=[...(S.activeModelCallsByBase||new Map()).entries()]
    .filter(([,calls])=>Array.isArray(calls)&&calls.length).map(([base])=>base);
  const window=selectMonitoringBases(all.map((base,index)=>({base,priority:all.length-index})),{
    focusedBases:focused,activeBases,limit:NETWORK_LIMITS.monitoredBases,hardLimit:64,
  });
  const selected=window.bases;
  S.monitoringWindow=new Set(selected.map((x)=>String(x||'').replace(/\/$/,'')));
  S.monitoringOmitted=Math.max(0,all.length-selected.length);
  return selected; }
function peerSourceTags(base){
  const u=String(base||'').replace(/\/$/,'');
  if(!u) return [];
  const inSet=(set)=>[...(set||[])].map((x)=>String(x||'').replace(/\/$/,'')).includes(u);
  const out=[];
  if(inSet(S.localPeers)) out.push('local');
  if(inSet(S.globalPeers)) out.push('resolver');
  if(inSet(S.gossipPeers)) out.push('gossip');
  if(inSet(S.ipfsPeers)) out.push('ipfs');
  return out;
}

/* ---------- optional IPFS discovery commons (content-addressed rendezvous) ----------
   When the VIEWER supplies ?ipfs_routing= and one or more ?ipfs_gw= routes, the
   portal can query the deterministic PersonaOS rendezvous CID and verify signed
   node cards. No delegated router or gateway is privileged or contacted by
   default. This is an optional locator commons; record signatures remain trust. */
const IPFS_RENDEZVOUS_CID='Qmbnw4HfNbSp9YqpNBGoQqZcBgAbfF3reayr79DWxPqJgQ';
function ipfsRouting(){ const p=new URLSearchParams(location.search).get('ipfs_routing');
  return String(p||'').trim(); }
function ipfsGateways(){ const p=new URLSearchParams(location.search).getAll('ipfs_gw');
  return p.map((item)=>String(item||'').replace(/\/$/,'')).filter(isHttp); }
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
    const rr=await fetch(ipnsRoutingBase()+name,secureFetchInit(ipnsRoutingBase()+name,{headers:{Accept:'application/vnd.ipfs.ipns-record'}}));
    if(rr.ok){ const buf=new Uint8Array(await readBoundedResponseBytes(rr,256*1024));
      let txt=''; for(let i=0;i<buf.length;i++) txt+=String.fromCharCode(buf[i]);
      const m=txt.match(/\/ipfs\/(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]{20,})/);
      if(m){ for(const gw of ipfsGateways()){ try{ const u=`${gw}/ipfs/${m[1]}`; const doc=await fetchJson(u,{maxBytes:256*1024}); if(doc) return doc; }catch(e){} } } }
  }catch(e){} }
  for(const gw of ipfsGateways()){ try{ const u=`${gw}/ipns/${pid}`; const doc=await fetchJson(u,{maxBytes:256*1024}); if(doc) return doc; }catch(e){} }
  return null;
}
async function discoverViaIPFS(opts={}){
  const rediscover = opts.rediscover !== false;
  S.ipfsPeers=S.ipfsPeers||new Set();
  const routing=ipfsRouting();
  if(!routing){ if(!S._ipfsConfigNoted){ S._ipfsConfigNoted=true; log('ipfs','optional commons not configured; supply ?ipfs_routing= and ?ipfs_gw= to use one'); }
    S.ipfsPeers=new Set(); return S.ipfsPeers; }
  let provs=[];
  try{ const u=routing+IPFS_RENDEZVOUS_CID; const r=await fetch(u,secureFetchInit(u,{headers:{Accept:'application/json'}}));
    if(!r.ok){ if(!S._ipfsNoted){ S._ipfsNoted=true; log('ipfs',`delegated routing HTTP ${r.status} — IPFS plane idle`,false); } return; }
    const d=JSON.parse(new TextDecoder().decode(await readBoundedResponseBytes(r,1024*1024)));
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
        if(ok){ url=String(doc.card.peer_url||''); if(doc.card.kernel_id) noteKernel(doc.card.kernel_id,'ipfs',url); }
      }
    }
    if(url) fresh.add(url);
  }
  const before=[...S.ipfsPeers].sort().join('|'), after=[...fresh].sort().join('|');
  S.ipfsPeers=fresh;                       // replace → stale URLs fall away, latest stays
  if(after!==before){ log('ipfs',`IPFS peers refreshed: ${fresh.size} live kernel(s)`,true);
    if(!rediscover) return fresh;
    discover().then(()=>{ renderMissions(); }).catch(()=>{}); }
  return fresh;
}

// ---- LOCAL probe: is a PersonaOS node running on THIS machine? -----------------
// A node's PUBLIC url (a tunnel) and its localhost url are the same kernel, but
// localhost is never globally advertised (every visitor's localhost is their own
// box). So probe a few well-known ports here; self-register any that answer. That
// node then appears in the OPERATOR console as a LOCAL route. The bearer token is
// still required for operator authority; network position is not a credential.
// Silent when nothing's running. From an https page: https://localhost works if the
// node's cert is trusted; plain-http localhost is browser-policy dependent and
// may fail before CORS, so the empty state points users at the node-served UI.
const LOCAL_PORTS=[8765,8805,8910];
async function probeBase(base){
  try{
    const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),2500);
    const u=join(base,'.well-known/personaos-discovery.json');
    const r=await fetch(u,secureFetchInit(u,{signal:ctl.signal}));
    clearTimeout(t);
    if(!r.ok) return false;
    const d=await r.json();
    return !!(d&&typeof d==='object'&&/personaos-discovery/.test(d.schema||''));
  }catch(e){ return false; }
}
async function discoverLocalNode(opts={}){
  const rediscover = opts.rediscover !== false;
  S.localPeers=S.localPeers||new Set();
  const query=new URLSearchParams(location.search);
  const localRoute=location.protocol!=='https:'||isLocalBase(location.origin);
  if(query.get('no_local_discovery')==='1'
      ||(!localRoute&&query.get('local_discovery')!=='1')){
    S.localPeers=new Set(); return S.localPeers;
  }
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
    if(found.size) log('local',`PersonaOS node on THIS machine: ${[...found].join(', ')} — paste its bearer token for operator controls`,true);
    if(!rediscover) return found;
    discover().then(()=>{ renderMissions(); }).catch(()=>{});
  }
  return found;
}

function recordStoreKey(r){ const raw=r?.record_id||r?.card_id; if(!raw) return '';
  return `${encodeURIComponent(String(r?._kernel||'@unknown'))}::${encodeURIComponent(String(raw))}`; }
function _personaLifecycleRegresses(current,candidate){
  if(current?.kind!=='persona'||current?._personaLifecycleVerified!==true) return false;
  if(candidate?.kind!=='persona'||candidate?._personaLifecycleVerified!==true
      ||!candidate.persona_lifecycle_card) return true;
  const before=current.persona_lifecycle_card||{}, after=candidate.persona_lifecycle_card||{};
  const beforeAt=Date.parse(String(before.issued_at||''));
  const afterAt=Date.parse(String(after.issued_at||''));
  if(!Number.isFinite(afterAt)||Number.isFinite(beforeAt)&&afterAt<beforeAt) return true;
  if(before.identity_materialization_state==='materialized'
      &&after.identity_materialization_state!=='materialized') return true;
  if(Number.isFinite(beforeAt)&&afterAt===beforeAt
      &&String(before.lifecycle_chain_head_hash||'')!==String(after.lifecycle_chain_head_hash||'')) return true;
  return false;
}
function _removeRecordStoreKey(id){
  const row=S.recs.get(id); if(!row) return false;
  if(row.kind==='persona'){
    const sid=_shortId(row.did||row.record_id), key=_personaKey(row._kernel,sid);
    if(S.personaDiscoveryByKey.get(key)===row) S.personaDiscoveryByKey.delete(key);
    S.liveByPersona.delete(key); S.personaRuntimeById?.delete(key);
    S.cognitionByPersona?.delete(key); S.ixByPersona?.delete(key);
    if(S.follow===key) S.follow=null;
  }
  try{ NETWORK.removeEntity(networkEntityKey(row._kernel,row.kind,
    _shortId(row.did||row.record_id))); }catch(_){ }
  S.recs.delete(id); S.order=S.order.filter((value)=>value!==id); return true;
}
function applyVerifiedProviderInventory(base,boot,rows,inventory){
  if(!inventory?.complete||!inventory.ok||!boot?.kernel_id) return false;
  const source=String(boot.kernel_id), prior=S.providerInventories.get(source);
  if(prior){
    if(inventory.generation<prior.generation
        ||(inventory.generation===prior.generation&&inventory.hash!==prior.hash)){
      log('verify',`${source}: stale/equivocating provider inventory generation refused`,false); return false;
    }
    if(inventory.generation===prior.generation) return true;
    if(inventory.generation===prior.generation+1&&inventory.previousHash!==prior.hash){
      log('verify',`${source}: provider inventory chain head mismatch refused`,false); return false;
    }
  }
  const incoming=new Set();
  for(const row of rows){
    if(String(row?._kernel||'')!==source||!inventory.recordIds.has(String(row.record_id||''))){
      log('verify',`${source}: provider inventory row escaped its signed manifest`,false); return false;
    }
    const id=recordStoreKey(row), current=S.recs.get(id);
    if(!id||_personaLifecycleRegresses(current,row)){
      log('verify',`${source}: stale persona lifecycle head refused`,false); return false;
    }
    incoming.add(id);
  }
  if(incoming.size!==inventory.recordIds.size) return false;
  for(const row of rows) upsert({...row,_inventorySource:source,
    _inventoryGeneration:inventory.generation,_inventoryHash:inventory.hash});
  for(const id of (prior?.recordKeys||[])) if(!incoming.has(id)) _removeRecordStoreKey(id);
  S.providerInventories.set(source,{generation:inventory.generation,hash:inventory.hash,
    recordKeys:incoming,manifestHash:inventory.manifestHash,
    bindings:new Map(inventory.bindings||[]),base:base||'',
    generatedAt:inventory.generatedAt,expiresAt:inventory.expiresAt});
  return true;
}
function upsert(r){
  const id=recordStoreKey(r); if(!id) return false;
  let row=S.recs.get(id);
  if(row&&_personaLifecycleRegresses(row,r)){
    log('verify',`${r._kernel||'node'}: ignored regressive persona lifecycle update`,false); return false;
  }
  if(!row){ row={id,events:0,lastT:0,spark:new Array(SPARK_N).fill(0),bucket:0,rate:0,_new:true};
    S.recs.set(id,row); S.order.push(id); }
  Object.assign(row,{kind:r.kind,label:r.kind==='persona'?String(r.label||''):(r.label||id),did:r.did||id,visibility_tier:r.visibility_tier,
    planes:planesOf(r.visibility_tier),_kernel:r._kernel,_access:r._access,_url:r._url,_links:r._links||{},_base:r._base||'',_doc:r._doc,_net:r._net||'',
    _providerBase:r._providerBase||'',
    _inventorySource:r._inventorySource||row._inventorySource||'',
    _inventoryGeneration:r._inventoryGeneration||row._inventoryGeneration||0,
    _inventoryHash:r._inventoryHash||row._inventoryHash||'',
    _broadcastOnly:!!r._broadcastOnly,_effective_level:r._effective_level||'discover',
    _readAuthorized:!!r._readAuthorized,_gossipHint:r._gossipHint||null,
    description:r.description||'',
    _storeKey:id,record_id:r.record_id||r.card_id,
    capability_summary:r.capability_summary||[],interfaces:r.interfaces||[],content_hash:r.content_hash||'',content_locator_ref:r.content_locator_ref||'',
    // Keep only the bounded environment-authority fields from this already
    // verified discovery row. Unsigned status/profile observations never enter
    // the routing resolver.
    environment_id:r.environment_id,
    owning_environment_id:r.owning_environment_id,
    owning_env_id:r.owning_env_id,
    primary_environment_id:r.primary_environment_id,
    environment_ids:Array.isArray(r.environment_ids)?r.environment_ids.slice(0,64):r.environment_ids,
    host_environment_ids:Array.isArray(r.host_environment_ids)?r.host_environment_ids.slice(0,64):r.host_environment_ids,
    candidate_environment_ids:Array.isArray(r.candidate_environment_ids)?r.candidate_environment_ids.slice(0,64):r.candidate_environment_ids,
    _personaAuthoredRole:r.kind==='persona'?personaAuthoredRole(r):'',
    _personaSignedName:r.kind==='persona'?signedPersonaLabel(r):'',
    _personaIdentityPublicKeyHex:r.kind==='persona'?(r._personaIdentityPublicKeyHex||''):'',
    _personaIdentitySigningKeyId:r.kind==='persona'?(r._personaIdentitySigningKeyId||''):'',
    _personaLifecycleVerified:r.kind==='persona'&&r._personaLifecycleVerified===true,
    persona_lifecycle_card:r.kind==='persona'&&r.persona_lifecycle_card
      ?r.persona_lifecycle_card:null,
    _taskLifecycleVerified:r.kind==='task'&&r._taskLifecycleVerified===true,
    task_lifecycle:r.kind==='task'&&r.task_lifecycle?r.task_lifecycle:null,
    avatar:r.kind==='persona'&&Object.hasOwn(r,'avatar')?r.avatar:null});
  if(row.kind==='persona'){
    const sid=_shortId(row.did||row.record_id);
    if(sid) S.personaDiscoveryByKey.set(_personaKey(row._kernel,sid),row);
  }
  try{ NETWORK.upsertEntity({...r,kernel_id:r._kernel,record_id:r.record_id||r.card_id}); }catch(e){
    log('scale',`record identity refused: ${String(e&&e.message||e).slice(0,90)}`,false); }
  while(S.order.length>NETWORK_LIMITS.cachedRecords){
    const victim=S.order.shift(); if(victim){ const victimRow=S.recs.get(victim);
      if(victimRow?.kind==='persona'){
        const sid=_shortId(victimRow.did||victimRow.record_id), key=_personaKey(victimRow._kernel,sid);
        if(S.personaDiscoveryByKey.get(key)===victimRow) S.personaDiscoveryByKey.delete(key);
      }
      S.recs.delete(victim); }
  }
  return true;
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
async function resolveKernelBases(seeds,onResolved=()=>{}){
  // Every automatic seed (this origin, signed locator, gossip, IPFS) is resolved the SAME way:
  // its bootstrap may BE a kernel (providers_url), LIST kernels (federated_kernels —
  // a multi-run node), and NAME further peers (one hop). Previously only the page's
  // own origin was expanded, so a multi-run peer node yielded zero records.
  const visited=new Set(), kernels=new Map(), queue=seeds.map((s)=>({b:s,depth:0}));
  const visitLimit=NETWORK_LIMITS.monitoredBases*2;
  const emit=(base,boot)=>{
    const key=base||'@origin'; if(kernels.has(key)) return;
    kernels.set(key,{base,boot});
    if(kernels.size<=NETWORK_LIMITS.monitoredBases){
      try{ onResolved(base,boot); }catch(e){}
    }
  };
  const pending=new Set();
  const schedule=({b,depth})=>{
    const key=b||'@origin';
    if(visited.has(key)||visited.size>=visitLimit) return;
    visited.add(key);
    const job=fetchJson(join(b,'.well-known/personaos-discovery.json')).then((boot)=>{
      if(!boot){ if(b) emit(b,null); return; }               // dead peer → discoverFrom logs it
      S.boots.set(b||'@origin',boot); collectP2PBootstraps(boot);
      const fks=boot.federated_kernels||[];
      if(boot.providers_are_aggregate) emit(b,boot);         // public aggregate: do not expand private runs
      else {
        if(boot.providers_url||!fks.length) emit(b,boot);
        for(const fk of fks.slice(0,NETWORK_LIMITS.monitoredBases)) emit(join(b,fk),null);
      }
      if(depth<1){
        const peers=[...(boot.peers||[]),...(boot.bootstrap_peers||[])].filter(isHttp);
        for(const peer of peers) schedule({b:peer,depth:depth+1});
      }
    }).catch(()=>{ if(b) emit(b,null); }).finally(()=>pending.delete(job));
    pending.add(job);
  };
  for(const item of queue) schedule(item);
  while(pending.size) await Promise.allSettled([...pending]);
  const unique=[...kernels.values()].map((item)=>item.base);
  S.monitoringOmitted=(S.monitoringOmitted||0)+Math.max(0,unique.length-NETWORK_LIMITS.monitoredBases);
  return unique.slice(0,NETWORK_LIMITS.monitoredBases);
}
let _discoverBusy=false;
async function discover(){
  // re-entrancy guard: the 15s interval is .then()-fired-and-forgotten and can stack
  // on a slow tunnel (each run does parallel per-base fetches + telemetry loads).
  if(_discoverBusy) return; _discoverBusy=true;
  try{
  $('#log').innerHTML='';
  // A periodic refresh may wait on a slow public tunnel. Keep the last fully
  // verified count and timestamp visible while that happens; "bootstrapping"
  // is truthful only before this tab has verified any node or record at all.
  if(!S.recs.size&&!(S.globalAnnouncements?.size)) $('#status').textContent='bootstrapping discovery…';
  const query=new URLSearchParams(location.search);
  const hostedPages=location.hostname==='ai-personas.github.io';
  const includeOrigin=!hostedPages||query.get('origin_discovery')==='1';
  S.telLoaded=S.telLoaded||new Set();
  const seenSeeds=new Set(), resolvedBases=new Set(), resultJobs=[];
  const enqueueResolved=(b,knownBoot)=>{
    const key=b||'@origin';
    if(resolvedBases.has(key)) return key;
    if(resolvedBases.size>=NETWORK_LIMITS.monitoredBases){
      S.monitoringOmitted=(S.monitoringOmitted||0)+1; return key;
    }
    resolvedBases.add(key);
    const job=discoverFrom(b,'internet',knownBoot).then(async(res)=>{
      if(!res.boot) return;
      const accepted=applyVerifiedProviderInventory(b,res.boot,res.found,res.inventory);
      connectDiscoveryStream(b,res.boot);
      if(accepted) scheduleRealtimeRepaint({records:true});
      await loadTelemetry(b);                 // aggregate static spans + live node telemetry
      scheduleRealtimeRepaint();
    }).catch(()=>{});
    resultJobs.push(job); return key;
  };
  const discoverAvailable=async()=>{
    const seeds=[...new Set([...(includeOrigin?['']:[]),...peerList()])]
      .filter((base)=>!seenSeeds.has(base||'@origin'));
    for(const base of seeds) seenSeeds.add(base||'@origin');
    if(seeds.length) await resolveKernelBases(seeds,enqueueResolved);
  };
  // Each locator plane contributes peers independently. As soon as one plane
  // yields a healthy node, its verified records paint while slower peers keep
  // resolving in the background of this same bounded discovery pass.
  const planeJobs=[
    loadGlobalNodes(),                                              // node1/additive ?resolver= signed locator → peers/relays
    discoverViaIPFS({rediscover:false}),                            // signed IPFS node cards → peers
    discoverLocalNode({rediscover:false}),                          // local node, if this browser can reach it
  ];
  await discoverAvailable();
  const sourceJobs=planeJobs.map((job)=>Promise.resolve(job).catch(()=>null).then(discoverAvailable));
  await Promise.allSettled(sourceJobs);
  await Promise.allSettled(resultJobs);
  rebalanceDiscoveryStreams();
  classifyMap(); renderGlobalKernels(); updateVitalsCounters();
  refreshSystemView();
  // The first interval tick can precede provider-inventory admission on a
  // fresh hosted tab. Start the separately verified public artifact probe as
  // soon as discovery has established the signed task/base/run join.
  pollLiveArtifacts();
  const when=new Date();
  const kernelCount=Math.max(S.kernels.size||0,Number(S.globalTotal)||0);
  const monitored=(S.boots&&S.boots.size)||0;
  const refreshed=`${String(when.getUTCHours()).padStart(2,'0')}:${String(when.getUTCMinutes()).padStart(2,'0')} UTC`;
  const status=$('#status');
  status.title=`${S.recs.size} signed discovery records verified with Ed25519 across ${kernelCount} discovered kernels; ${monitored} actively monitored. Discovery uses .well-known, Kademlia DHT and mDNS and refreshes every 15 seconds.`;
  status.setAttribute('aria-label',`${S.recs.size} verified records across ${kernelCount} nodes; updated ${refreshed}`);
  status.innerHTML=`<span class="ok">${S.recs.size}</span> verified record${S.recs.size===1?'':'s'} · `
    +`<span class="ok">${compactCount(kernelCount)}</span> node${kernelCount===1?'':'s'} · updated ${refreshed}`;
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
	    discovered at runtime from live nodes. Signed discovery records are Ed25519-verified in your browser;
	    unverified operator-status execution frames are separately labelled unsigned transport telemetry. Nothing is showing because
	    no reachable node is currently publishing public records.</div>
	    ${S.globalAnnouncements?.size?`<div class="desc2"><b>${S.globalAnnouncements.size}</b> signed node announcement(s) were found through a configured resolver, but none produced browser-reachable public records yet.</div>`:''}
    <h4>Peers tried</h4>${rows}
    <h4>Get live data</h4>
    <div class="desc2">
    1 · Run a node: <code>python -m personaos.node --budget 8 --port 8765</code><br>
    ${httpsPage?`2 · This page is <b>https://</b> — browsers block fetches to a plain-http
    LAN/localhost node. Either open the <b>node-served UI</b> at
    <code>http://localhost:8765/</code> (same-origin), or expose the
    node through an HTTPS tunnel (e.g. <code>cloudflared tunnel --url http://localhost:8765</code>)
    and let the node announce its tunnel through <code>node1.personas.ai</code>.`:`2 · The node announces
    itself through <code>node1.personas.ai</code> automatically.`}<br>
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
  const heartbeat=heartbeatForScope();
  if(!(heartbeat&&heartbeat.running&&heartbeat.busy)) return false;
  const noPersonas=!(S.liveByPersona&&S.liveByPersona.size);
  const noActs=!((S.interactions||[]).length);
  return noPersonas&&noActs;
}
// HONEST idle-but-alive: node reachable, heartbeat running, but NOT busy (no funded
// mission) and nothing has streamed yet. Distinct from warming (busy) — the copy must
// not claim production.
function isIdleAlive(){
  if(!isReachableNode()) return false;
  const heartbeat=heartbeatForScope();
  if(!(heartbeat&&heartbeat.running)) return false;
  if(heartbeat.busy) return false;
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

let _realtimeRepaintQueued=false, _realtimeRecordsDirty=false;
function scheduleRealtimeRepaint({records=false}={}){
  _realtimeRecordsDirty=_realtimeRecordsDirty||records;
  if(_realtimeRepaintQueued) return;
  _realtimeRepaintQueued=true;
  const paint=()=>{
    const recordsChanged=_realtimeRecordsDirty;
    _realtimeRepaintQueued=false; _realtimeRecordsDirty=false;
    if(recordsChanged){ classifyMap(); renderGlobalKernels(); }
    renderInteractionStream(); renderMissions(); updateVitalsCounters();
    refreshLiveSection();
    Promise.resolve(refreshSystemView()).catch(()=>{});
  };
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(paint);
  else setTimeout(paint,0);
}
// A verified SSE frame has already updated the per-entity indices. Coalesce a
// burst into the next browser paint instead of waiting for the five-second poll.
function appendTelemetryEvent(payload,base,boot,reason){ scheduleRealtimeRepaint(); }
function connectDiscoveryStream(base,boot){
  if(!boot?.discovery_stream_url||typeof EventSource==='undefined') return;
  const url=join(base,boot.discovery_stream_url);
  if(S.streams.has(url)) return;
  // EventSource cannot set an Authorization header. Never move an operator token
  // into its URL: private nodes use authenticated status/live-artifact polling.
  if(tokenFor(url)){
    S.streams.set(url,{pollOnly:true,_base:String(base||'').replace(/\/$/,'')});
    log('stream',`${url} uses authenticated polling (token omitted from URL)`,true);
    return;
  }
  const es=new EventSource(url);
  es._base=String(base||'').replace(/\/$/,'');
  S.streams.set(url,es);
  let liveArtifactQueue=Promise.resolve();
  const enqueueLiveArtifactFrame=(work)=>{
    liveArtifactQueue=liveArtifactQueue.then(work).catch((e)=>{
      log('stream','live artifact verification failed: '+String(e&&e.message||e),false);
    });
  };
  es.addEventListener('open',()=>log('stream',`${url} connected`,true));
  es.addEventListener('hello',(ev)=>{
    try{ const d=JSON.parse(ev.data||'{}'); if(d.node_id) noteKernel(d.node_id,'sse',base||location.origin,{reachable:true}); }catch(e){}
  });
  es.addEventListener('discovery_snapshot',async (ev)=>{
    try{
      const snap=JSON.parse(ev.data||'{}');
      const providerIndex=snap?.providers;
      const verified=await verifiedRowsFromProviderIndex(providerIndex,base,boot,'internet','SSE provider snapshot');
      const inventory={...(verified.inventory||{}),complete:verified.inventory?.ok===true
        &&verified.refused===0
        &&new Set(verified.rows.map((row)=>row.record_id)).size===verified.inventory.recordIds?.size};
      const accepted=applyVerifiedProviderInventory(base,boot,verified.rows,inventory);
      const added=accepted?verified.rows.length:0;
      log('stream',`discovery snapshot: ${added} current ProviderRecord(s) verified; ${verified.refused} refused`,verified.refused===0);
      if(added){ classifyMap(); updateVitalsCounters(); refreshSystemView(); }
    }catch(e){ log('stream','snapshot parse failed: '+(e&&e.message||e),false); }
  });
  es.addEventListener('telemetry_update',async (ev)=>{
    try{
      const payload=JSON.parse(ev.data||'{}');
      const live=payload.telemetry||payload;
      const publicFrameVerified=await verifyPublicTelemetryFrame(base,live);
      if(!publicFrameVerified) return;
      const verifiedCommunicationRoutes=await verifyPublicCommunicationRoutes(base,live);
      if(live?.schema==='personaos-live-telemetry-public/1'
          &&!VERIFIED_COMMUNICATION_ROUTE_COLLECTIONS.has(live)) return;
      const admitted=ingestLiveTelemetry(base,live,{source:'sse',eventId:ev.lastEventId||'',
        verifiedCommunicationRoutes,publicFrameVerified});
      if(!admitted.accepted) return;
      appendTelemetryEvent(payload,base,boot,'LIVE_TELEMETRY');
    }
    catch(e){ return; }
  });
  es.addEventListener('live_artifact_update',(ev)=>{
    const raw=ev.data||'{}';
    enqueueLiveArtifactFrame(async()=>{
      let payload; try{ payload=JSON.parse(raw); }
      catch(e){ log('stream','live artifact frame parse failed',false); return; }
      const verification=await _verifyLiveWithKeyRefresh(base,url,boot,(context)=>
        verifyLiveArtifactEvent(payload,{...context,requirePublic:true}));
      if(!verification.ok||verification.kind!=='snapshot'){
        _logLiveVerificationRefusal(payload?.run,verification); return;
      }
      ingestLiveArtifactSnapshot(base,payload.snapshot,'sse',{
        previousRevision:payload.previous_revision,verification:verification.snapshot});
    });
  });
  es.addEventListener('run_ended',(ev)=>{
    const raw=ev.data||'{}';
    enqueueLiveArtifactFrame(async()=>{
      let payload; try{ payload=JSON.parse(raw); }
      catch(e){ log('stream','run-ended frame parse failed',false); return; }
      const previous=liveArtifactState(base,payload?.run);
      const verification=await _verifyLiveWithKeyRefresh(base,url,boot,(context)=>
        verifyLiveArtifactEvent(payload,{...context,requirePublic:true,
          expectedPreviousRevision:previous?.revision||''}));
      if(!verification.ok||verification.kind!=='run_ended'){
        _logLiveVerificationRefusal(payload?.run,verification); return;
      }
      endLiveArtifactRun(base,payload,{verification});
    });
  });
  es.onerror=()=>{ if(!es._noted){ log('stream','SSE reconnecting; polling remains active',false); es._noted=true; } };
}
function rebalanceDiscoveryStreams(){
  const allowed=new Set(S.monitoringWindow||[]);
  for(const [base,calls] of (S.activeModelCallsByBase||new Map())) if((calls||[]).length)
    allowed.add(String(base==='@origin'?'':base).replace(/\/$/,''));
  for(const [url,stream] of (S.streams||new Map())){
    const base=String(stream?._base||'').replace(/\/$/,'');
    if(allowed.has(base)) continue;
    try{ stream?.close?.(); }catch(e){}
    S.streams.delete(url);
  }
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
    delete e.key; e._eventKey=key;
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
  const ingestLive=async(live)=>{
    const publicFrameVerified=await verifyPublicTelemetryFrame(base,live);
    if(!publicFrameVerified){ log('telemetry',`${base||'@origin'}: refused invalid public telemetry signature`,false); return; }
    const verifiedCommunicationRoutes=await verifyPublicCommunicationRoutes(base,live);
    if(live?.schema==='personaos-live-telemetry-public/1'
        &&!VERIFIED_COMMUNICATION_ROUTE_COLLECTIONS.has(live)){
      log('telemetry',`${base||'@origin'}: refused invalid public communication-route collection`,false); return;
    }
    if(!ingestLiveTelemetry(base,live,{source:'poll',verifiedCommunicationRoutes,publicFrameVerified}).accepted) return;
    const modelEvents=telemetryModelEvents(live);
    if(!Array.isArray(modelEvents)||!modelEvents.length) return;
    const generatedT=Date.parse(live.generated_at||'')||Date.now();
    const baseT=_activeCalls(live).length?generatedT:(_latestSpanTime(telemetrySpans(live))||generatedT);
    modelEvents.forEach((m,i)=>{
      const purpose=String(m.requested_purpose||m.purpose||'model');
      pushEvent({
        key:`live|${kid}|${i}|${m.kind||''}|${m.model_id||''}|${purpose}|${m.role||''}|${m.reason||''}`,
        t:_modelEventTime(m,baseT-((modelEvents.length-i)*220)), kernel:kid,
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
    await ingestLive(live);
  }
  if(!added){ return; }
  // aggregate across kernels, re-sort by time, normalise inter-event gaps to a lively cadence
  S.events=(S.events||[]).sort((a,b)=>a.t-b.t);
  if(S.events.length>NETWORK_LIMITS.telemetryTapeRows) S.events=S.events.slice(-NETWORK_LIMITS.telemetryTapeRows);
  S.eventKeys=new Set(S.events.map((event)=>event._eventKey).filter(Boolean));
  let prev=S.events[0]?.t||0;
  S.events.forEach((e)=>{ const g=e.t-prev; prev=e.t; e.gap=Math.max(90,Math.min(900,g||300)); });
  if(S.events.length) S.events[0].gap=0;
  log('telemetry',`+${added} telemetry event(s) (${S.events.length} total) for the live tape`);
}


// ---------- rich, navigable detail drawer (resolves deep docs) ----------
const dcache=new Map();
async function dfetch(base,path){ if(!path) return null; const k=base+'|'+path;
  if(dcache.has(k)) return dcache.get(k); const v=await fetchJson(join(base,path)); dcache.set(k,v);
  while(dcache.size>512) dcache.delete(dcache.keys().next().value); return v; }
function indexRuntimeStatus(base,status){
  if(!status||typeof status!=='object') return;
  const baseKey=base||'@origin';
  const kernelId=String(status.node_id||status.kernel_id||kernelForBase(base)||baseKey);
  for(const [personaKey,item] of [...S.personaRuntimeById]){
    if(item&&item._baseKey===baseKey) S.personaRuntimeById.delete(personaKey);
  }
  const rawCalls=Array.isArray(status.active_model_calls)?status.active_model_calls:[];
  const calls=_filterTerminalCalls(base,rawCalls);
  const terminalPersonaIds=new Set(rawCalls.filter((call)=>_terminalCallIsBlocked(base,call))
    .map((call)=>_shortId(call?.persona_id)).filter(Boolean));
  const byPersona=new Map();
  for(const call of calls){ const sid=_shortId(call&&call.persona_id); if(sid) byPersona.set(sid,call); }
  for(const persona of (Array.isArray(status.personas)?status.personas:[])){
    const sid=_shortId(persona&&persona.persona_id); if(!sid) continue;
    const personaKey=_personaKey(kernelId,sid);
    const terminalized=terminalPersonaIds.has(sid)&&!byPersona.has(sid);
    const runtime=terminalized
      ?{...persona,running_llm:false,llm_execution_state:'idle',task_execution_state:'idle'}:persona;
    S.personaRuntimeById.set(personaKey,{...runtime,current_model_call:byPersona.get(sid)||null,
      _baseKey:baseKey,_kernel:kernelId,_receivedAt:Date.now()});
  }
  // /status is a second authoritative source for calls when the telemetry card is
  // private or delayed. It carries runtime state, not a signed discovery record.
  if(Array.isArray(status.active_model_calls)){
    _indexActiveModelCalls(base,{kernel:{kernel_id:kernelId,active_model_calls:calls}},
      {kernelId});
  }
}
function runtimeForPersona(value,kernel=''){ const ref=_personaRef(value,kernel), runtime=S.personaRuntimeById.get(ref.key)||null;
  if(runtime&&Date.now()-(runtime._receivedAt||0)>30000){ S.personaRuntimeById.delete(ref.key); return null; }
  return runtime; }
// Node /status cache — 4s TTL so active calls and run discovery keep the 2-5s live cadence.
const statusCache=new Map();
async function fetchNodeStatus(base){
  const key=base||'@origin'; const hit=statusCache.get(key);
  if(hit&&(Date.now()-hit.ts)<4000) return hit.v;
  const v=await fetchJson(join(base,'status'));
  if(v){ statusCache.set(key,{v,ts:Date.now()}); indexRuntimeStatus(base,v); }
  return v||null;
}
function personaIdFromDid(did){
  const m=/\/persona\/([^/]+)$/.exec(did||''); if(m) return m[1];
  return (did||'').replace('did:personaos:',''); }
async function fetchText(u){ try{ const r=await fetch(u,secureFetchInit(u)); if(!r.ok)return null;
  return new TextDecoder().decode(await readBoundedResponseBytes(r,LIVE_ARTIFACT_LIMITS.maxFileBytes)); }catch(e){ return null; } }
// Binary-safe fetch for images / PDFs / 3D meshes — returns {blob,size,type} or null.
// Binaries are detected by extension BEFORE this is called so fetchText is never run on them.
async function fetchBlob(u){ try{ const r=await fetch(u,secureFetchInit(u)); if(!r.ok)return null;
  const bytes=await readBoundedResponseBytes(r,LIVE_ARTIFACT_LIMITS.maxFileBytes);
  const type=r.headers.get('content-type')||'application/octet-stream';
  const b=new Blob([bytes],{type}); return {blob:b,size:b.size,type}; }catch(e){ return null; } }
async function fetchVerifiedLiveBody(url,expectedHash){
  try{
    const r=await fetch(url,secureFetchInit(url));
    if(!r.ok) return {ok:false,checkOutcome:'unavailable',error:`body HTTP ${r.status}`};
    const bytes=await readBoundedResponseBytes(r,LIVE_ARTIFACT_LIMITS.maxFileBytes);
    const actual=await sha256Hex(bytes);
    const expected=String(expectedHash||'').replace(/^sha256:/,'').toLowerCase();
    if(!expected||actual!==expected) return {ok:false,checkOutcome:'failed',error:'SHA-256 mismatch',actual,expected};
    const type=r.headers.get('content-type')||'application/octet-stream';
    return {ok:true,actual,bytes,blob:new Blob([bytes],{type}),type,size:bytes.byteLength};
  }catch(e){ const error=String(e&&e.message||e);
    return {ok:false,checkOutcome:/\bexceeds\b/i.test(error)?'failed':'unavailable',error}; }
}
const fmtBytes=(n)=>{ if(n==null||isNaN(n))return '—'; if(n<1024)return n+' B';
  if(n<1048576)return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; };
const extOf=(p)=>{ const m=/\.([a-z0-9_]+)$/i.exec(String(p||'')); return m?m[1].toLowerCase():''; };
const kv=(l,v)=>`<div class="row"><span class="l2">${esc(l)}</span><span class="v2">${v}</span></div>`;
const H=(t)=>`<h4>${esc(t)}</h4>`;
const chipsOf=(a)=>`<div class="caps">${(a||[]).filter(Boolean).map((c)=>`<span class="cap">${esc(c)}</span>`).join('')||'<span class="l2">—</span>'}</div>`;
const recLink=(id,txt)=>`<a href="#" data-act="rec" data-id="${esc(id)}">${esc(txt)}</a>`;
const findRecByDid=(pid,kernel='')=>S.order.find((id)=>{ const r=S.recs.get(id);
  return (!kernel||r?._kernel===kernel)&&(r?.did==='did:personaos:'+pid||r?.did===pid); });

/* ---------- kernel-signed live workspace metadata + exact-byte integrity ---------- */
function _liveRunKey(base,run){ return liveArtifactRunKey(base,run,location.origin); }
function _liveRunDomKey(base,run){ return encodeURIComponent(_liveRunKey(base,run)); }
function liveArtifactState(base,run){ return S.liveArtifacts.get(_liveRunKey(base,run))||null; }
function _liveFileStateKey(base,run,workspaceId,path){
  return `${_liveRunKey(base,run)}\u0000${workspaceId}\u0000${path}`;
}
function _nodeScopedBodyUrl(base,value){
  try{
    const root=new URL(opBaseKey(base||location.origin)+'/',location.href);
    const target=new URL(join(base,value),location.href);
    const rootPath=root.pathname.replace(/\/$/,'');
    if(!/^https?:$/.test(target.protocol)||target.username||target.password||target.origin!==root.origin) return '';
    if(rootPath&&rootPath!=='/'&&target.pathname!==rootPath&&!target.pathname.startsWith(rootPath+'/')) return '';
    return target.href;
  }catch(e){ return ''; }
}
async function _liveVerificationContext(base,url,bootHint=null,refresh=false){
  const key=base||'@origin';
  let boot=bootHint||S.boots.get(key)||null;
  if(!boot){ boot=await fetchJson(join(base,'.well-known/personaos-discovery.json'));
    if(boot) S.boots.set(key,boot); }
  if(!boot?.kernel_id) return {ok:false,reason:'missing_kernel_identity'};
  await keysFor(base,boot,{refresh});
  const keyDoc=S.keyDocs.get(key)||{};
  if(keyDoc.kernelId!==boot.kernel_id) return {ok:false,reason:'kernel_key_registry_mismatch'};
  return {ok:true,keyEntries:keyDoc.entries||[],expectedNodeId:boot.kernel_id,
    requirePublic:!tokenFor(url)};
}
async function _verifyLiveWithKeyRefresh(base,url,bootHint,verify){
  let last={ok:false,reason:'live_verification_failed'};
  for(const refresh of [false,true]){
    const context=await _liveVerificationContext(base,url,bootHint,refresh);
    if(!context.ok) last=context;
    else { last=await verify(context); if(last.ok) return last; }
  }
  return last;
}
function _logLiveVerificationRefusal(run,verification){
  log('live',`${String(run||'live frame')}: refused ${verification?.reason||'unverified metadata'}`,false);
}
function _renderLiveArtifactMount(base,run){
  const domKey=_liveRunDomKey(base,run);
  document.querySelectorAll('[data-live-run-key]').forEach((host)=>{
    if(host.dataset.liveRunKey!==domKey) return;
    const html=liveArtifactsHTML(base,run);
    if(host.dataset.h!==html){ host.dataset.h=html; host.innerHTML=html; }
  });
}
function _rememberTrackedLiveRun(key,base,run,meta={}){
  // Anonymous automatic probes must re-establish their current unexpired
  // provider-inventory authority on every poll. Promoting a successful probe
  // into the generic tracker would let it outlive the inventory that supplied
  // its base/run join. Operator status, explicit drawer opens, and verified SSE
  // snapshots retain the ordinary short-lived tracking fallback.
  if(meta.publicSeed===true) return;
  S.trackedLiveRuns.set(key,{base,run,lastSeen:Date.now()});
}
function _applyTerminalLiveArtifactEffects(base,key,...states){
  const now=Date.now(), baseKey=base||'@origin';
  const endedCalls=terminalLiveArtifactCalls(...states);
  for(const call of endedCalls){ const tombstoneKey=_terminalCallKey(base,call);
    if(tombstoneKey) S.terminalCallTombstones.set(tombstoneKey,now+120000); }
  while(S.terminalCallTombstones.size>256){
    S.terminalCallTombstones.delete(S.terminalCallTombstones.keys().next().value);
  }
  const currentCalls=S.activeModelCallsByBase?.get(baseKey)||[];
  S.activeModelCallsByBase?.set(baseKey,_filterTerminalCalls(base,currentCalls,now));
  S.activeModelCallObservedAt?.set(baseKey,now);
  _rebuildActiveModelCallIndex();
  for(const [personaKey,item] of (S.personaRuntimeById||new Map())){
    if(item?._baseKey!==baseKey||!_terminalCallIsBlocked(base,item.current_model_call,now)) continue;
    S.personaRuntimeById.set(personaKey,{...item,current_model_call:null,running_llm:false,
      llm_execution_state:'idle',task_execution_state:'idle',_receivedAt:now});
  }
  S.liveArtifactEnded.set(key,now);
  while(S.liveArtifactEnded.size>64) S.liveArtifactEnded.delete(S.liveArtifactEnded.keys().next().value);
  S.liveArtifactRequestGeneration.set(key,(S.liveArtifactRequestGeneration.get(key)||0)+1);
  S.liveArtifactAbort.get(key)?.abort(); S.liveArtifactAbort.delete(key); S.trackedLiveRuns.delete(key);
}
function ingestLiveArtifactSnapshot(base,snapshot,source='poll',meta={}){
  if(snapshot?.schema!=='personaos-live-artifacts/1'||!snapshot.run||!snapshot.revision) return null;
  const key=_liveRunKey(base,snapshot.run);
  const previous=S.liveArtifacts.get(key)||null;
  if(!meta.verification?.ok){ _logLiveVerificationRefusal(snapshot.run,meta.verification); return previous; }
  const scoped={...snapshot,files:(Array.isArray(snapshot.files)?snapshot.files:[]).map((file)=>
    ({...file,body_url:_nodeScopedBodyUrl(base,file&&file.body_url)}))};
  const decision=decideLiveArtifactUpdate(previous,scoped,{...meta,source,
    ended:S.liveArtifactEnded.has(key),
    latestRequestGeneration:S.liveArtifactRequestGeneration.get(key)||0});
  if(!decision.accept){
    if(!['run_ended'].includes(decision.reason)) log('live',`${snapshot.run}: ignored ${decision.reason}`,false);
    return previous;
  }
  let next=transitionLiveArtifacts(previous,scoped);
  next.base=base;
  next.source=source;
  next.receivedAt=Date.now();
  next.verification={verified:true,signingKeyId:meta.verification.signingKeyId,
    accessPolicyRef:meta.verification.accessPolicyRef,outwardTier:meta.verification.outwardTier,
    immutableFinalizedBootstrap:meta.verification.immutableFinalizedBootstrap===true};
  if(previous&&decision.refresh) next.changes=previous.changes;
  if(meta.verification.immutableFinalizedBootstrap===true){
    const finalized=finalizeLiveArtifactState(next,meta.verification);
    if(!finalized){
      _logLiveVerificationRefusal(snapshot.run,{reason:'finalized_snapshot_projection_mismatch'});
      return previous;
    }
    // The final snapshot correctly carries no active calls. Tombstone the
    // preceding signed snapshot too so delayed unsigned telemetry cannot
    // resurrect a call that the finalized generation has ended.
    _applyTerminalLiveArtifactEffects(base,key,previous,next);
    next=finalized;
  }
  S.liveArtifacts.set(key,next);
  while(S.liveArtifacts.size>48){
    const oldest=S.liveArtifacts.keys().next().value;
    if(oldest===S.openLiveFile?.stateKey) break;
    S.liveArtifacts.delete(oldest);
  }
  if(!next.ended) _rememberTrackedLiveRun(key,base,snapshot.run,meta);
  _renderLiveArtifactMount(base,snapshot.run);
  const open=S.openLiveFile;
  if(open&&open.stateKey===key){
    const current=next.files.get(`${open.workspaceId}\u0000${open.path}`);
    if(!current||current.sha256!==open.hash){
      // The current view closure resolves the newest record. Re-render in place;
      // text viewers retain the prior hash-checked body for a bounded diff.
      Promise.resolve().then(()=>renderTop()).catch(()=>{});
    }
  }
  renderMissions(); refreshLiveSection(); updateVitalsCounters();
  Promise.resolve().then(()=>refreshSystemView()).catch(()=>{});
  return next;
}
async function fetchLiveArtifacts(base,run,options={}){
  const key=_liveRunKey(base,run);
  if(S.liveArtifactEnded.has(key)) return S.liveArtifacts.get(key)||null;
  if(S.liveArtifactPolls.has(key)) return S.liveArtifactPolls.get(key).promise;
  const generation=(S.liveArtifactRequestGeneration.get(key)||0)+1;
  S.liveArtifactRequestGeneration.set(key,generation);
  const startedRevision=S.liveArtifacts.get(key)?.revision||'';
  const controller=new AbortController(); S.liveArtifactAbort.set(key,controller);
  const p=(async()=>{
    const relative=`runs/${encodeURIComponent(run)}/live-artifacts`
      +(startedRevision?`?since=${encodeURIComponent(startedRevision)}`:'');
    const endpoint=join(base,relative);
    const doc=await fetchJson(endpoint,
      {signal:controller.signal,maxBytes:LIVE_ARTIFACT_LIMITS.maxSnapshotBytes});
    if(doc){
      const expectedSince=startedRevision||null;
      const verification=await _verifyLiveWithKeyRefresh(base,endpoint,null,(context)=>
        verifyLiveArtifactSnapshot(doc,{...context,expectedRun:run,
          expectedSinceRevision:expectedSince}));
      if(!verification.ok){ _logLiveVerificationRefusal(run,verification); return S.liveArtifacts.get(key)||null; }
      return ingestLiveArtifactSnapshot(base,doc,'poll',{
        requestGeneration:generation,startedRevision,verification,
        publicSeed:options.publicSeed===true});
    }
    return null;
  })().finally(()=>{ const current=S.liveArtifactPolls.get(key); if(current?.generation===generation) S.liveArtifactPolls.delete(key);
    if(S.liveArtifactAbort.get(key)===controller) S.liveArtifactAbort.delete(key); });
  S.liveArtifactPolls.set(key,{promise:p,generation,controller});
  return p;
}
function endLiveArtifactRun(base,event,meta={}){
  const run=String(event?.run||''); if(!run) return;
  if(!meta.verification?.ok){ _logLiveVerificationRefusal(run,meta.verification); return; }
  const key=_liveRunKey(base,run); const previous=S.liveArtifacts.get(key);
  if(!previous||String(event.previous_revision||'')!==String(previous.revision||'')){
    _logLiveVerificationRefusal(run,{reason:'broken_terminal_revision_chain'}); return;
  }
  const ended=endLiveArtifactState(previous,event);
  if(ended) _applyTerminalLiveArtifactEffects(base,key,previous);
  if(ended){ ended.receivedAt=Date.now(); ended.verification={verified:true,
      signingKeyId:meta.verification.signingKeyId,accessPolicyRef:meta.verification.accessPolicyRef,
      outwardTier:meta.verification.outwardTier,terminalEventVerified:true};
    S.liveArtifacts.set(key,ended); _renderLiveArtifactMount(base,run);
    const runDrawerVisible=[...document.querySelectorAll('[data-live-run-key]')]
      .some((host)=>host.dataset.liveRunKey===_liveRunDomKey(base,run));
    if(runDrawerVisible||S.openLiveFile?.stateKey===key){
      Promise.resolve().then(()=>renderTop()).catch(()=>{});
    }
  }
  renderMissions(); updateVitalsCounters(); renderGlobalKernels(); refreshLiveSection();
  Promise.resolve().then(()=>refreshSystemView()).catch(()=>{});
}
function pollLiveArtifacts(){
  const targets=new Map(); const now=Date.now();
  for(const [baseKey,hit] of statusCache){
    if(!hit?.ts||now-hit.ts>15000) continue;
    const base=baseKey==='@origin'?'':baseKey;
    for(const run of (hit?.v?.stoppable_runs||[])) targets.set(_liveRunKey(base,run),{base,run});
  }
  for(const [key,item] of S.trackedLiveRuns){
    if(S.liveArtifactEnded.has(key)) S.trackedLiveRuns.delete(key);
    else if(now-item.lastSeen<60000 || S.openLiveFile?.stateKey===key) targets.set(key,item);
    else S.trackedLiveRuns.delete(key);
  }
  // Anonymous hosted viewers cannot learn run ids from operator `/status`, and
  // SSE has no obligation to replay a snapshot published before this tab joined.
  // Seed polling only from an exact signed task DID that remains in the same
  // kernel's current verified provider inventory. The inventory supplies the
  // API base; links, labels and unsigned status never invent a run/base join.
  const publicTargets=selectVerifiedPublicTaskRunTargets(
    S.recs.values(),S.providerInventories,S.boots,
    {focusedKernel:S.kernelFocus||'',limit:48},
  );
  const currentPublicKeys=new Set();
  for(const item of publicTargets){
    const key=_liveRunKey(item.base,item.run); currentPublicKeys.add(key);
    if(S.liveArtifactEnded.has(key)||targets.has(key)) continue;
    const probe=S.liveArtifactPublicProbes.get(key);
    if(probe?.nextAt>now) continue;
    targets.set(key,{...item,publicSeed:true});
  }
  for(const key of S.liveArtifactPublicProbes.keys()){
    if(!currentPublicKeys.has(key)) S.liveArtifactPublicProbes.delete(key);
  }
  while(S.liveArtifactPublicProbes.size>64)
    S.liveArtifactPublicProbes.delete(S.liveArtifactPublicProbes.keys().next().value);
  for(const item of targets.values()){
    const request=fetchLiveArtifacts(item.base,item.run,{publicSeed:item.publicSeed===true});
    if(item.publicSeed) request.then((state)=>{
      const key=_liveRunKey(item.base,item.run);
      if(state){ S.liveArtifactPublicProbes.delete(key); return; }
      const failures=(S.liveArtifactPublicProbes.get(key)?.failures||0)+1;
      S.liveArtifactPublicProbes.set(key,{failures,
        nextAt:Date.now()+Math.min(30000,3000*(2**Math.min(3,failures-1)))});
    }).catch(()=>{});
    else request.catch(()=>{});
  }
}
function _liveTreeBuild(files){
  const root={dirs:new Map(),files:[]};
  for(const file of files){ const parts=String(file.path||'').split('/').filter(Boolean); let node=root;
    for(let i=0;i<parts.length-1;i++){ const part=parts[i];
      if(!node.dirs.has(part)) node.dirs.set(part,{dirs:new Map(),files:[]}); node=node.dirs.get(part); }
    node.files.push({file,name:parts.at(-1)||file.path}); }
  return root;
}
function _renderLiveTreeNode(node,prefix,depth,state,workspaceId){
  let html='';
  for(const [name,child] of [...node.dirs].sort((a,b)=>a[0].localeCompare(b[0]))){
    const rel=prefix?`${prefix}/${name}`:name;
    const dirKey=`live:${state.run}:${workspaceId}:${rel}`; const collapsed=dirCollapsed(dirKey,depth);
    html+=`<div class="tnode tdir" style="padding-left:${depth*14}px"><a href="#" data-act="tdir" data-key="${esc(dirKey)}" data-collapsed="${collapsed?1:0}"><span class="ttog${collapsed?' collapsed':''}">${icon('chevron','ico-sm')}</span> ${esc(name)}/</a><span class="l2">${child.files.length+child.dirs.size}</span></div>`;
    if(!collapsed) html+=`<div class="tkids">${_renderLiveTreeNode(child,rel,depth+1,state,workspaceId)}</div>`;
  }
  for(const {file,name} of node.files.sort((a,b)=>a.name.localeCompare(b.name))){
    const authored=authoredArtifactLabelText(file);
    html+=`<div class="tnode tfile live-file-row" style="padding-left:${depth*14}px"><a href="#" data-act="live-file" data-run="${esc(state.run)}" data-workspace="${esc(workspaceId)}" data-path="${esc(file.path)}">${esc(name)}</a>`
      +`<span class="l2">${authored?`authored: ${esc(authored)} · `:''}${esc(extOf(file.path)||file.media_kind||'file')} · ${fmtBytes(file.size_bytes)}</span></div>`;
  }
  return html;
}
function liveArtifactsHTML(base,run){
  const state=liveArtifactState(base,run);
  if(!state) return `<div class="live-artifacts waiting"><div class="live-artifacts-head"><span class="loading-inline">waiting for a workspace snapshot</span><span class="transport-badge">AWAITING KERNEL-SIGNED SNAPSHOT</span></div><div class="l2">Polling every 3 seconds; only snapshots and SSE events whose Ed25519 signatures check are applied.</div></div>`;
  const snap=state.snapshot||{}; const ch=state.changes;
  const changed=ch.baseline?'<span class="l2">baseline snapshot</span>'
    : `<span class="live-change c-created">+${ch.created.length} created</span><span class="live-change c-modified">${ch.modified.length} modified</span><span class="live-change c-deleted">-${ch.deleted.length} deleted</span>`;
  const changeRows=ch.baseline?'':[...ch.created.map((x)=>['created',x]),...ch.modified.map((x)=>['modified',x]),...ch.deleted.map((x)=>['deleted',x])]
    .slice(0,12).map(([kind,file])=>`<div class="live-change-row ${kind}"><span>${esc(file.path)}</span><code>${esc(String(file.sha256||'').slice(0,12))}</code></div>`).join('');
  const wsMeta=new Map((snap.workspaces||[]).map((w)=>[w.workspace_id,w]));
  const byWs=new Map(); for(const file of state.files.values()) (byWs.get(file.workspace_id)||byWs.set(file.workspace_id,[]).get(file.workspace_id)).push(file);
  const workspaces=[...new Set([...(snap.workspaces||[]).map((w)=>w.workspace_id),...byWs.keys()])].sort();
  const finalizedBootstrap=state.verification?.immutableFinalizedBootstrap===true;
  const trees=workspaces.map((workspaceId)=>{ const w=wsMeta.get(workspaceId)||{}; const files=byWs.get(workspaceId)||[];
    const pid=_shortId(w.persona_id||files[0]?.persona_id), kernel=snap.node_id||kernelForBase(base);
    const label=_nameFor(pid,kernel)||pid||workspaceId;
    const workspaceState=state.ended?'final snapshot':(w.state||'run_active').replace(/_/g,' ');
    return `<section class="live-workspace"><div class="live-workspace-head"><span><b>${esc(label)}</b> <code>${esc(workspaceId)}</code></span><span class="${!state.ended&&w.state==='model_call_active'?'ok':'l2'}">${esc(workspaceState)} · ${files.length} file${files.length===1?'':'s'}</span></div>`
      +`<div class="atree">${_renderLiveTreeNode(_liveTreeBuild(files),'',0,state,workspaceId)||'<div class="l2">workspace is currently empty</div>'}</div></section>`;
  }).join('');
  const revision=String(state.revision||'');
  const terminalTitle=finalizedBootstrap?'Run finalized · final workspace':'Run ended · final workspace';
  const terminalNote=finalizedBootstrap?'Immutable finalized-snapshot signature checked':'Terminal-event signature checked';
  return `<div class="live-artifacts verified${state.ended?' ended':''}" role="status" aria-live="polite" aria-atomic="false"><div class="live-artifacts-head"><span><span class="livedot2"></span><b>${state.ended?terminalTitle:'Live workspaces'}</b> · ${snap.indexed_file_count??state.files.size} indexed</span><span class="transport-badge verified">WORKSPACE SNAPSHOT · SIGNATURE CHECKED</span></div>`
    +(state.ended?`<div class="fv-note">${terminalNote}${state.endedAt?` at ${esc(state.endedAt)}`:''}. Polling stopped; this is the final captured workspace revision.</div>`:'')
    +`<div class="live-revision"><span>${changed}</span><code title="${esc(revision)}">${esc(revision.slice(0,20))}…</code></div>`
    +(changeRows?`<div class="live-change-list">${changeRows}</div>`:'')
    +(snap.truncated?`<div class="fv-warn">Snapshot truncated: ${esc(snap.omitted_file_count||0)} file(s) omitted by node or browser limits.</div>`:'')
    +trees+`<div class="live-integrity-note"><b>Workspace snapshot only · ArtifactBundle lifecycle is unknown.</b> Snapshot metadata is Ed25519 signature-checked against the node kernel key. Opened file bytes are separately SHA-256 checked against the exact signed hash before rendering.</div></div>`;
}

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
  let html=H('Signature details')
    +kv('Verified in browser',`<span class="ok">${icon('check','ico-sm')} signature checked here</span>`)
    +kv('Signing key',`<code>${esc(keyId)}</code>${keyHex?` <span class="l2">${esc(keyHex)}… · ${esc(doc.signing_key_status||'registry')}</span>`:''}`)
    +kv('Key source','<span class="l2">.well-known/personaos-keys.json</span>');
  // drive min-to-discover/read from the record's REAL access policy, not constants
  const minD=esc(a.min_to_discover||'discover');
  const minR=a.min_to_read?esc(a.min_to_read)
    :(r._readAuthorized?'read granted to this public viewer'
      :'read required · current viewer is discover-only');
  html+=H('Access policy · '+esc(tier))+_ladderBar(r._effective_level||'discover')
    +kv('Visibility tier',`<span class="tier-pill t-${esc(tier)}">${esc(tier)}</span>`)
    +kv('Min to discover',minD)+kv('Min to read',minR);
  if(r.promoted_from_tier) html+=kv('Bridged from',`<span class="amber">${esc(r.promoted_from_tier)} → public</span>`
    +(r.bridge_policy_ref?` <span class="l2">${esc(r.bridge_policy_ref)}</span>`:''));
  html+=kv('Body',esc(anchor));
  if(grants.length) html+=H(`Grants (${grants.length})`)+grants.slice(0,8).map((g)=>
    `<div class="grant"><span>${esc(g.grantee_kind||'?')}:${esc((g.grantee_id||'*').slice(0,18))}</span>`
    +`<span class="ok">${esc(g.access_level||'discover')}</span></div>`).join('');
  return `<details class="trust-details"><summary><span>${icon('check','ico-sm')} Verified record</span>`
    +`<small>signature checked here · ${esc(String(tier).replace(/_/g,' '))} metadata</small>`
    +`${icon('chevron','ico-sm')}</summary><div class="trust-details-body">${html}</div></details>`;
}

// ---------- live per-entity activity (what is happening INSIDE this persona / env) ----------
const PURPOSE_LABEL={candidate:'producing candidate',repair:'repairing candidate',judge:'judging (PoLL)',
  safety:'safety check',objective:'naming objectives',classifier:'classifying',optimize_tactics:'evolving tactics',
  domain_probe_perceiver:'probing domain',domain_probe_abducer:'abducing domain',answer:'answering',
  pressure:'appraising completion pressure',pressure_appraisal:'appraising completion pressure',
  peer_pressure_appraisal:'independent pressure review',artifact_review:'reviewing artifact evidence',
  artifact_generation:'building artifacts',artifact_revision:'revising artifacts'};
// MODEL-PER-ROLE rollup: PersonaOS resolves a DIFFERENT model per role/purpose
// (EnvironmentModelRegistry), so summarise the distinct models a persona/env used
// → the roles/purposes each served, busiest first, as mono <code> chips. Honest:
// pure live telemetry; renders nothing when idle.
const _modelLabel=(value)=>{ const v=String(value||'').trim(); return /^[a-z0-9][a-z0-9._:/+@-]{0,95}$/i.test(v)?v:'model unavailable'; };
const _modelFacet=(value)=>{ const v=String(value||'').trim(); return v.length<=64&&/^[a-z0-9][a-z0-9 _./:+-]*$/i.test(v)?v:''; };
function _modelSummary(models){
  if(!models||!models.length) return '';
  const byM=new Map();
  for(const m of models){ const mdl=_modelLabel(m.model); const r=_modelFacet(m.role)||_modelFacet(m.purpose);
    const e=byM.get(mdl)||{n:0,roles:new Set()}; e.n++; if(r&&r!=='-') e.roles.add(PURPOSE_LABEL[r]||r); byM.set(mdl,e); }
  return [...byM.entries()].sort((a,b)=>b[1].n-a[1].n).map(([mdl,e])=>
    `<div class="grant"><span><code>${esc(mdl)}</code></span>`
    +`<span class="l2">${esc([...e.roles].slice(0,4).join(', ')||'model')}${e.n>1?` <span class="rr-count">×${e.n}</span>`:''}</span></div>`).join('');
}
function _liveFeed(models,{historical=false}={}){
  if(!models||!models.length) return '<div class="l2">idle — no recent model calls</div>';
  // A persona legitimately produces, repairs AND evolves its own tactics — so SUMMARISE
  // its recent model calls by PURPOSE with a count (newest purpose first), instead of a
  // repeating row per call that reads like a glitch ("repairing candidate" ×6 in a row).
  const byP=new Map(); let i=0;
  for(const m of models){ const k=_modelFacet(m.purpose)||'model';
    const e=byP.get(k)||{n:0,model:_modelLabel(m.model),role:_modelFacet(m.role),seen:i}; e.n++; e.model=_modelLabel(m.model); if(_modelFacet(m.role)) e.role=_modelFacet(m.role); e.seen=i++; byP.set(k,e); }
  const order=[...byP.entries()].sort((a,b)=>b[1].seen-a[1].seen);   // most-recently-used purpose first
  return order.map(([p,e])=>{
    const lbl=PURPOSE_LABEL[p]||p;
    return `<div class="grant"><span class="l2">${historical?'':'<span class="livedot2"></span>'}${esc(lbl)}`
      +`${e.n>1?` <span class="rr-count">×${e.n}</span>`:''}</span>`
      +`<span><code>${esc(e.model)}</code>${e.role&&e.role!=='-'&&e.role!==p?` <span class="l2">${esc(e.role)}</span>`:''}</span></div>`;
  }).join('');
}
function _terminalModelFailureHTML(failure){
  if(!failure) return '';
  const purpose=PURPOSE_LABEL[failure.purpose]||String(failure.purpose||'model call').replace(/_/g,' ');
  const detail=[failure.model?`model ${failure.model}`:'',failure.status?`HTTP ${failure.status}`:'']
    .filter(Boolean).join(' · ');
  return `<div class="model-failure" role="status"><div><span>${icon('warn','ico-sm')}</span>`
    +`<b>Model call failed</b><small>${esc(purpose)}${detail?` · ${esc(detail)}`:''}</small></div>`
    +(failure.reason?`<p>${esc(failure.reason)}</p>`:'')
    +`<span class="ix-trust transport">UNSIGNED LIVE TELEMETRY</span></div>`;
}
function renderPersonaLive(pid,profileFallback,kernel=''){
  // profileFallback (the served persona card) lets the grid render for IDLE personas too
  // (state/tasks/reputation), since the drawer no longer duplicates those as kv rows.
  const ref=_personaRef(pid,kernel), rt=runtimeForPersona(ref.key);
  const d=S.liveByPersona.get(ref.key)||(profileFallback||rt?{summary:profileFallback||rt||{},models:[]}:null);
  if(!d) return '<div class="l2">— no live telemetry yet (idle or not streaming) —</div>';
  const s=d.summary||profileFallback||rt||{}; let h='';
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
  const running=_activeModelCallsForPersona(ref.key).length>0;
  const terminalFailure=running?null:(d.terminalFailure||null);
  if(rt){
    h+=`<div class="sublabel">Runtime state · unsigned status telemetry</div>`
      +kv('Task execution',esc(rt.task_execution_state||'unmarked'))
      +kv('LLM execution',esc(rt.llm_execution_state||'unmarked'));
    const call=rt.current_model_call;
    if(call) h+=kv('Current model call',`<span class="ok">${esc(PURPOSE_LABEL[call.requested_purpose]||call.requested_purpose||'model call')}</span> · <code>${esc(call.model_id||'—')}</code>${call.role?` · ${esc(call.role)}`:''}`);
  }
  if(terminalFailure) h+=`<div class="sublabel">Terminal execution status</div>`
    +_terminalModelFailureHTML(terminalFailure);
  h+=`<div class="sublabel">${running?'Doing now':'Model selection history'}</div>`
    +_liveFeed(d.models,{historical:!running});
  return h;
}
function renderEnvLive(eid,kernel=''){
  const d=S.liveByEnv.get(_environmentRef(eid,kernel).key); if(!d) return '<div class="l2">— no live telemetry yet (idle or not streaming) —</div>';
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

function _spanSummary(s){
  const a=s&&s.attributes||{};
  return {
    kind:String((s&&s.kind)||a['personaos.lineage.event_kind']||(s&&s.name)||'SPAN'),
    signed:(s&&s.signed)===true || a['personaos.lineage.signed']===true,
    t:Number((s&&s.t)||Date.parse((s&&s.ended_at)||(s&&s.started_at)||'')||0)
  };
}
function _envLaneLive(b){
  const sid=_shortId(b&&b.sid||b&&b.envId);
  const live=S.liveByEnv.get(_environmentKey(b?.kernel,sid))||{};
  const envRunning=_envRunningNow(b);
  const seen=new Set(), spans=[];
  for(const raw of [...(live.spans||[]),...(b&&b.spans||[])]){
    const s=_spanSummary(raw); if(!s.kind) continue;
    const k=s.kind+'|'+s.t+'|'+(s.signed?1:0); if(seen.has(k)) continue;
    seen.add(k); spans.push(s);
  }
  spans.sort((a,c)=>a.t-c.t);
  const mSeen=new Set(), models=[];
  for(const m of [...(live.models||[]),...feedModels(b&&b.feedDoc||{})]){
    const key=[m.purpose,m.model,m.role,m.t||''].join('|'); if(mSeen.has(key)) continue;
    mSeen.add(key); models.push(m);
  }
  const lastSpan=spans.length?spans[spans.length-1].t:0;
  // Model-event rows are intentionally low-detail and may not carry source
  // timestamps. Use signed lineage span time for "live now" so a historical model
  // allocation does not keep an env looking active forever.
  const last=lastSpan;
  const recent=!!(last&&Date.now()-last<10*60*1000);
  return {spans,models,last,recent,fresh:envRunning&&recent};
}
function renderEnvLaneLive(b){
  const live=_envLaneLive(b);
  if(!live.spans.length&&!live.models.length) return '';
  const recent=live.spans.slice(-4).reverse().map((s)=>
    `<span class="env-live-chip ${s.signed?'ok':''}" title="${s.signed?'signed lineage event':'live event'}">${esc(s.kind.replace(/_/g,' '))}</span>`).join('');
  const envRunning=_envRunningNow(b);
  const latestModel=live.models.length?live.models[live.models.length-1]:null;
  const model=latestModel
    ? `<span class="env-live-chip ${envRunning?'model':''}">${envRunning?'<span class="livedot2"></span>':'last: '}${esc(PURPOSE_LABEL[latestModel.purpose]||latestModel.purpose||'model')} · <code>${esc(latestModel.model||'—')}</code></span>`
    : '';
  return `<div class="env-live${live.fresh?' hot':''}"><span class="env-live-label">${live.fresh?'live now':'recent'}</span>${model}${recent}</div>`;
}

/* ===================== ◫ SYSTEM VIEW — the living representation ===================
   Environments contain their personas; each persona card streams its live
   request/response (model selections = what it ASKED a model to do) and its
   cognition; the right rail streams coordination + cross-env interactions
   (kernel.interactions: actor → affected : kind); artifacts show as deliverables.
   Signed lineage events retain their provenance from admitted signed feeds. Raw
   operator-status model calls and coordination observations remain unsigned;
   independently verified public telemetry, messages, and routes retain their own
   signed labels, while workspace snapshots are kernel-signed. */
const PURPOSE_VERB={candidate:'produce candidate',repair:'repair candidate',judge:'judge (PoLL)',
  safety:'safety check',objective:'name objectives',classifier:'classify task',optimize_tactics:'evolve tactics',
  domain_probe_perceiver:'probe domain',domain_probe_abducer:'abduce domain',answer:'answer',verifier:'verify',
  pressure:'appraise completion pressure',pressure_appraisal:'appraise completion pressure',
  peer_pressure_appraisal:'independently appraise pressure',artifact_review:'review artifact evidence',
  artifact_generation:'build artifacts',artifact_revision:'revise artifacts'};
// event-kind → coordination / cross-env / artifact / lifecycle classification + glyph
const COORD_KINDS=new Set(['COORDINATION_SHAPE_EVENT','COORDINATION_SHAPE_ADMITTED','ATTENTION_ALLOCATED',
  'MEMBER_JOINED','ENV_MEMBER_ADMITTED','ENV_MEMBER_RE_ADMITTED','BLACKBOARD_POST','blackboard_post','coordination_signal',
  'coordination_update','GOAL_PROGRESS_REPORTED','TASK_PROGRESS_REPORTED',
  'ENV_CLARIFICATION_REQUESTED','ENV_CLARIFICATION_ANSWERED','PERSONA_COMMUNICATION_INTENT_RECORDED',
  'PERSONA_COMMUNICATION_ROUTE_OBSERVED',
  'PERSONA_COMMUNICATION_AUTHORED','PERSONA_INVITATION_AUTHORED','PERSONA_INVITATION_RESPONSE_AUTHORED',
  'PERSONA_BIRTH_NEED_AUTHORED','PERSONA_BIRTH_PROPOSAL_AUTHORED','PERSONA_BIRTH_ADMITTED','PERSONA_BIRTH_REFUSED']);
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
  'ENV_MCP_TOOL_REGISTERED','ENV_MCP_TOOL_INVOKED','PROVISIONAL_TOOL_STATUS',
  'PERSONA_ACTION_AUTHORED','PERSONA_ACTION_COMPLETED','PERSONA_ACTION_FAILED']);
// a verdict that did NOT accept → render in the rejected colour. A persona honestly
// stuck on self-provisioning (EXTERNAL_CAPABILITY_BLOCKED) reads as fail too. NOTE:
// the public interaction projection strips payload, so CAPABILITY_PROVISIONED's
// ok/error fields are NOT in the client stream — only BLOCKED is markable client-side.
const _ixFailed=(kind)=>kind==='TASK_NOT_ACCEPTED'||kind==='EXTERNAL_CAPABILITY_BLOCKED'
  ||kind==='PERSONA_ACTION_FAILED';
function _ixClass(kind,event=null){ if(event?._cognition===true
    ||(event?._providerProvisional===true&&kind==='PROVISIONAL_ASSISTANT_MESSAGE')
    ||kind==='MODEL_CALL'||String(kind||'').startsWith('MODEL_')
    ||kind==='LLM_OUTPUT'||kind==='LLM_LESSON')return 'think';
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
  MEMBER_JOINED:'joined environment',ENV_MEMBER_ADMITTED:'admitted member',ENV_MEMBER_RE_ADMITTED:'re-admitted member',BLACKBOARD_POST:'posted to blackboard',
  GOAL_PROGRESS_REPORTED:'reported progress',TASK_PROGRESS_REPORTED:'reported progress',
  ENV_CLARIFICATION_REQUESTED:'asked clarification',ENV_CLARIFICATION_ANSWERED:'answered clarification',
  PERSONA_COMMUNICATION_INTENT_RECORDED:'recorded message intent',
  PERSONA_COMMUNICATION_ROUTE_OBSERVED:'observed communication route',
  PERSONA_COMMUNICATION_AUTHORED:'authored message',PERSONA_INVITATION_AUTHORED:'invited persona',
  PERSONA_INVITATION_RESPONSE_AUTHORED:'answered invitation',PERSONA_BIRTH_NEED_AUTHORED:'identified a team need',
  PERSONA_BIRTH_PROPOSAL_AUTHORED:'proposed persona birth',PERSONA_BIRTH_ADMITTED:'admitted persona birth',
  PERSONA_BIRTH_REFUSED:'refused persona birth',
  MODEL_CALL:'model call observed',MODEL_SELECTED:'model selected',MODEL_CALL_SUCCEEDED:'model call succeeded',
  MODEL_CALL_FAILED:'model call failed',LLM_OUTPUT:'produced',LLM_LESSON:'learned',
  PROVISIONAL_ASSISTANT_MESSAGE:'streamed assistant message',PROVISIONAL_PROVIDER_STATUS:'provider status',
  PROVISIONAL_TOOL_STATUS:'tool status',COGNITION_LESSON:'holds lesson',
  COGNITION_TACTIC:'holds tactic',COGNITION_PROVEN_FACT:'holds proven fact',EXTERNAL_CAPABILITY_BLOCKED:'blocked on capability',
  EXTERNAL_CAPABILITY_ACQUIRED:'acquired capability',CAPABILITY_PROVISIONED:'provisioned tool',
  ENV_MCP_TOOL_REGISTERED:'mounted tool',ENV_MCP_TOOL_INVOKED:'used tool',
  PERSONA_ACTION_AUTHORED:'action authored',PERSONA_ACTION_COMPLETED:'action completed',
  PERSONA_ACTION_FAILED:'action failed'};
const _ixVerb=(kind)=>IX_VERB[kind]||String(kind||'acted').toLowerCase().replace(/_/g,' ');
function _ixHeadline(event){
  const provenance=event?._provenance||{};
  if(provenance.action) return String(provenance.action);
  if(event?.kind==='MODEL_CALL'&&provenance.purpose)
    return `model · ${provenance.purpose}`;
  return _ixVerb(event?.kind);
}
const PUBLIC_ACTIVITY_PROVENANCE_ORDER=Object.freeze([
  'action','purpose','model','status','role','tool','server','run','task','missionTask','call','event','intent',
  'request','message','parentMessage','sequence','latencyMs','effort','environment','persona','scopeId',
  'evidence','dedupe','authority','authorityHash','parentHash','signingKey','authoredAt','startedAt','at','snapshotAt',
]);
const PUBLIC_ACTIVITY_CORE_PROVENANCE=new Set([
  'action','purpose','model','status','role','tool','server','run','task','missionTask','call','event','intent',
  'request','message','parentMessage','sequence','latencyMs','effort','environment','authoredAt','startedAt','at','snapshotAt',
]);
const PUBLIC_ACTIVITY_PROVENANCE_LABEL=Object.freeze({
  action:'action',purpose:'purpose',model:'model',status:'state',run:'run',task:'task',
  missionTask:'mission task',call:'call',event:'event',intent:'intent',request:'request',
  message:'message',parentMessage:'parent message',sequence:'seq',latencyMs:'latency ms',
  role:'role',tool:'tool',server:'server',effort:'reasoning',environment:'env',persona:'persona',scopeId:'scope',
  evidence:'evidence',dedupe:'wake key',authority:'authority',authorityHash:'authority hash',
  parentHash:'parent hash',signingKey:'signing key',authoredAt:'authored',
  startedAt:'started',at:'at',snapshotAt:'snapshot',
});
function _boundedActivityProvenanceValue(value){
  if(typeof value==='number'&&Number.isFinite(value)) return String(value);
  return typeof value==='string'&&value.length<=4096?value:'';
}
function _activityProvenanceFragments(provenance,{full=false}={}){
  if(!provenance||typeof provenance!=='object'||Array.isArray(provenance)) return '';
  const fragments=[];
  for(const field of PUBLIC_ACTIVITY_PROVENANCE_ORDER){
    if(!full&&!PUBLIC_ACTIVITY_CORE_PROVENANCE.has(field)) continue;
    const source=Array.isArray(provenance[field])?provenance[field]:[provenance[field]];
    for(const raw of source.slice(0,16)){
      const value=_boundedActivityProvenanceValue(raw); if(!value) continue;
      const joinedRun=field==='run'&&provenance.runFromTaskLifecycle===true;
      const title=joinedRun
        ?'exact run joined from the independently verified public task lifecycle':value;
      const label=joinedRun?'run · task proof':PUBLIC_ACTIVITY_PROVENANCE_LABEL[field]||field;
      fragments.push(`<span class="ix-prov" title="${esc(title)}"><small>${esc(label)}</small><code>${esc(value)}</code></span>`);
    }
  }
  return fragments.join('');
}
function _eventTrustHTML(event){
  return event?.signed===true
    ? `<span class="ix-trust signed" title="${esc(event._trustTitle||'lineage signature asserted by the admitted node frame')}">${esc(event._trustLabel||'SIGNED EVENT')}</span>`
    : `<span class="ix-trust transport" title="${esc(event?._trustTitle||'live node transport frame; not independently signature-verified in this browser')}">${esc(event?._trustLabel||'LIVE FRAME')}</span>`;
}
function _activityProvenanceHTML(provenance,{className='ix-provenance',prepend='',full=false}={}){
  const fragments=_activityProvenanceFragments(provenance,{full});
  return fragments||prepend?`<span class="${esc(className)}">${prepend}${fragments}</span>`:'';
}
function _eventTimeHTML(event){
  const provenance=event?._provenance||{};
  const exact=String(provenance.at||provenance.startedAt||provenance.snapshotAt||event?.at||'');
  const valid=Number.isFinite(Date.parse(exact));
  const label=event?._observedState?'snapshot':_ago(event?._t||Date.now());
  return `<time${valid?` datetime="${esc(exact)}" title="${esc(exact)}"`:''}>${esc(label)}</time>`;
}
// per-row feed kind glyph keyed to the _ixClass lane (inherits the lane colour via
// currentColor on .ix-kind). One stroked icon per lane — no colour emoji.
const _IX_GLYPH={think:'lesson',coord:'arrow',verify:'check',artifact:'task',tool:'tool',crossenv:'arrow',activity:'dot'};
const _ixGlyph=(cls)=>icon(_IX_GLYPH[cls]||'dot','ico-sm ix-glyph');
const _ago=(t)=>{const s=Math.max(0,(Date.now()-t)/1000|0);return s<5?'now':s<60?s+'s':s<3600?(s/60|0)+'m':(s/3600|0)+'h';};
const _PERSONA_NAME=new Map();   // kernel-qualified persona key -> friendly name
const _isMechanicalPersonaName=(value,sid='')=>{ const v=String(value||'').trim(), id=_shortId(sid||'');
  return !v||v===id||new RegExp(`^(?:identity|persona)\\s+${id.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}$`,'i').test(v)
    ||/^(?:identity|persona)\s+[A-Z0-9]{16,}$/i.test(v); };
const _personaAlias=(sid)=>{ const id=_shortId(sid||''); return id?`Persona ${id.slice(0,4)}…${id.slice(-4)}`:'Unnamed persona'; };
const _displayPersonaName=(value,sid='')=>_isMechanicalPersonaName(value,sid)?_personaAlias(sid):String(value).trim();
const _personaMonogram=(value,sid='')=>{ const name=_displayPersonaName(value,sid), id=_shortId(sid||'');
  if(!_isMechanicalPersonaName(value,sid)){ const parts=name.split(/\s+/).filter(Boolean); return ((parts[0]?.[0]||'')+(parts.length>1?(parts.at(-1)?.[0]||''):(parts[0]?.[1]||''))).toUpperCase(); }
  return (id.slice(-2)||'AI').toUpperCase(); };
function _nameFor(value,kernel=''){ const ref=_personaRef(value,kernel);
  return _displayPersonaName(_PERSONA_NAME.get(ref.key),ref.sid); }
function _signedPersonaNameFor(value,kernel=''){ const ref=_personaRef(value,kernel);
  return _displayPersonaName(S.personaDiscoveryByKey.get(ref.key)?._personaSignedName,ref.sid); }
// RUNNING NOW vs merely recent: a persona is "running" iff the node currently
// reports an active model call for that persona. Coordination/model history can
// make a card RECENT, but never RUNNING.
function _runningNow(value,kernel=''){ return _activeModelCallsForPersona(value,kernel).length>0; }
function _modelFresh(value,models,kernel=''){
  const ref=_personaRef(value,kernel), seen=S.lastModelSeenAt?.get(ref.key)||0;
  return !!(models&&models.length) && !!seen && (Date.now()-seen)<300000;
}
function _latestPersonaActivityForRecency(acts){
  for(let index=(acts?.length||0)-1;index>=0;index--){
    const event=acts[index], at=Number(event?._t);
    if(event?._observedState!==true&&Number.isFinite(at)&&at>0) return event;
  }
  return null;
}

// one persona card: identity + lifecycle + live "doing now" + request/response mini-stream + cognition
const _ROLE_NOT_DECLARED='role not declared';
function _coordRole(sid,_summary,kernel=''){
  const ref=_personaRef(sid,kernel);
  // S.personaDiscoveryByKey contains only Ed25519-verified discovery rows.
  // Never turn a name, capability, origin, lifecycle flag, or operator fitness
  // into a role. An explicit signed/persona-authored role stays open vocabulary.
  const signedCard=S.personaDiscoveryByKey.get(ref.key)||null;
  return signedCard?._personaAuthoredRole||_ROLE_NOT_DECLARED;
}
const _coordRoleClass=(role)=>role===_ROLE_NOT_DECLARED?'role-undesignated':'role-declared';
// per-persona "is fresh" detector for realtime streaming: did its model-event
// count grow since the last render? (drives the slide-in animation + node pulse)
function _personaGrew(personaKey,count){
  S.pcardSeen=S.pcardSeen||new Map();
  const prev=S.pcardSeen.get(personaKey); S.pcardSeen.set(personaKey,count);
  return prev!=null && count>prev;
}
function _personaAvatarHue(value){ let h=0; for(const c of String(value||'')) h=(h*31+c.charCodeAt(0))%360; return h; }
// The hue is decorative card chrome only. Identity imagery is admitted below
// exclusively from a persona-signed raster descriptor and verified bytes.
const _PERSONA_AVATAR_CACHE_MAX_ENTRIES=96;
const _PERSONA_AVATAR_CACHE_MAX_BYTES=64*1024*1024;
const _personaAvatarAssets=new Map();
const _personaAvatarJobs=new Map();
const _personaAvatarFailures=new Set();
let _personaAvatarCacheBytes=0;
function _rememberPersonaAvatarFailure(key){
  _personaAvatarFailures.delete(key); _personaAvatarFailures.add(key);
  while(_personaAvatarFailures.size>512) _personaAvatarFailures.delete(_personaAvatarFailures.values().next().value);
}
function _personaAvatarRevision(descriptor){
  return descriptor?`${descriptor.sha256}:${descriptor.identity_signature_hex}`:'';
}
function _personaAvatarMountRevision(descriptor,signedCard){
  return descriptor?`${_personaAvatarRevision(descriptor)}:${String(signedCard?._personaIdentityPublicKeyHex||'')}`:'';
}
function _personaAvatarHTML(personaKey){
  const ref=_personaRef(personaKey);
  // Avatar shape is inspected synchronously only to make signed descriptor
  // changes observable to the keyed stage diff. No image appears until the
  // asynchronous identity, provider, byte, hash, MIME, and dimension gates pass.
  const signedCard=S.personaDiscoveryByKey.get(ref.key)||null;
  const descriptor=normalizePersonaAvatar(signedCard?.avatar);
  const state=descriptor?'pending':(signedCard?.avatar?'failed':'local');
  const monogram=_personaMonogram(_PERSONA_NAME.get(ref.key),ref.sid);
  const placeholderLabel=state==='local'?'instant local avatar':state==='failed'?'local avatar · portrait unavailable':'local avatar · verifying portrait';
  const avatarLabel=state==='local'
    ?'instant deterministic local avatar; no optional persona-authored raster admitted'
    :state==='failed'
      ?'instant deterministic local avatar; optional persona-authored raster unavailable'
      :'instant deterministic local avatar shown while optional persona-authored raster is verified';
  return `<span class="pc-avatar" data-avatar-key="${esc(_domEntityKey(ref.key))}" data-avatar-revision="${esc(_personaAvatarMountRevision(descriptor,signedCard))}" data-avatar-state="${state}" aria-label="${esc(avatarLabel)}">`
    +`<span class="pc-avatar-placeholder" aria-hidden="true"><strong>${esc(monogram)}</strong><small>${esc(placeholderLabel)}</small></span></span>`;
}
async function _decodePersonaAvatarBlob(blob,descriptor){
  if(typeof createImageBitmap==='function'){
    const bitmap=await createImageBitmap(blob);
    try{
      if(bitmap.width!==descriptor.width||bitmap.height!==descriptor.height)
        throw new Error('decoded avatar dimensions mismatch');
    }finally{ try{ bitmap.close(); }catch(e){} }
    return;
  }
  if(typeof Image!=='function') throw new Error('raster decoder unavailable');
  const probeUrl=URL.createObjectURL(blob);
  try{
    const probe=new Image();
    await new Promise((resolve,reject)=>{ probe.onload=resolve; probe.onerror=()=>reject(new Error('avatar decode failed'));
      probe.src=probeUrl; });
    if(probe.naturalWidth!==descriptor.width||probe.naturalHeight!==descriptor.height)
      throw new Error('decoded avatar dimensions mismatch');
  }finally{ URL.revokeObjectURL(probeUrl); }
}
function _rememberPersonaAvatarAsset(key,asset){
  const prior=_personaAvatarAssets.get(key);
  if(prior){ _personaAvatarCacheBytes-=prior.byteLength; URL.revokeObjectURL(prior.url); }
  _personaAvatarAssets.delete(key); _personaAvatarAssets.set(key,asset);
  _personaAvatarCacheBytes+=asset.byteLength;
  while(_personaAvatarAssets.size>_PERSONA_AVATAR_CACHE_MAX_ENTRIES
      ||_personaAvatarCacheBytes>_PERSONA_AVATAR_CACHE_MAX_BYTES){
    const oldestKey=_personaAvatarAssets.keys().next().value;
    if(oldestKey===undefined||(_personaAvatarAssets.size===1&&oldestKey===key)) break;
    const oldest=_personaAvatarAssets.get(oldestKey); _personaAvatarAssets.delete(oldestKey);
    _personaAvatarCacheBytes-=oldest.byteLength; URL.revokeObjectURL(oldest.url);
  }
  return asset;
}
async function _loadPersonaAvatarAsset(personaKey,signedCard,descriptor){
  const ref=_personaRef(personaKey);
  const assertedPin=String(signedCard?._personaIdentityPublicKeyHex||'');
  const rememberedPin=String(S.personaIdentityKeys.get(ref.key)||'');
  if(assertedPin&&rememberedPin&&assertedPin!==rememberedPin)
    throw new Error('persona identity key pin changed');
  const pin=assertedPin||rememberedPin;
  const providerBase=String(signedCard?._providerBase||signedCard?._base||'');
  const cacheKey=[ref.key,_personaAvatarRevision(descriptor),providerBase,pin].join('\u0000');
  const cached=_personaAvatarAssets.get(cacheKey);
  if(cached){ _personaAvatarAssets.delete(cacheKey); _personaAvatarAssets.set(cacheKey,cached); return cached; }
  if(_personaAvatarFailures.has(cacheKey)) throw new Error('avatar previously refused');
  let job=_personaAvatarJobs.get(cacheKey);
  if(!job){
    job=(async()=>{
      const loaded=await fetchVerifiedPersonaAvatar(descriptor,{
        expectedPersonaId:ref.sid,pinnedPublicKeyHex:pin,providerBase,pageUrl:location.href,
      });
      const observedKey=loaded.descriptor.identity_public_key_hex;
      const currentPin=S.personaIdentityKeys.get(ref.key)||'';
      if(currentPin&&currentPin!==observedKey) throw new Error('persona identity key pin mismatch');
      S.personaIdentityKeys.set(ref.key,observedKey);
      const blob=new Blob([loaded.bytes],{type:loaded.descriptor.mime_type});
      await _decodePersonaAvatarBlob(blob,loaded.descriptor);
      return _rememberPersonaAvatarAsset(cacheKey,Object.freeze({
        url:URL.createObjectURL(blob),byteLength:loaded.descriptor.byte_length,
        width:loaded.descriptor.width,height:loaded.descriptor.height,
      }));
    })().catch((error)=>{ _rememberPersonaAvatarFailure(cacheKey); throw error; })
      .finally(()=>_personaAvatarJobs.delete(cacheKey));
    _personaAvatarJobs.set(cacheKey,job);
  }
  return job;
}
function _neutralPersonaAvatar(mount,state='failed'){
  mount.dataset.avatarState=state;
  mount.setAttribute('aria-label',state==='local'
    ?'instant deterministic local avatar; no optional persona-authored raster admitted'
    :'instant deterministic local avatar; optional persona-authored raster unavailable');
  const placeholder=document.createElement('span'); placeholder.className='pc-avatar-placeholder';
  placeholder.setAttribute('aria-hidden','true');
  const ref=_personaRef(_entityKeyFromDom(mount.dataset.avatarKey||''));
  const monogram=document.createElement('strong'); monogram.textContent=_personaMonogram(_PERSONA_NAME.get(ref.key),ref.sid);
  const label=document.createElement('small'); label.textContent=state==='local'?'instant local avatar':'local avatar · portrait unavailable';
  placeholder.append(monogram,label);
  mount.replaceChildren(placeholder);
}
async function _hydratePersonaAvatarMount(mount){
  if(!mount?.isConnected||mount.dataset.avatarState!=='pending') return;
  const personaKey=_entityKeyFromDom(mount.dataset.avatarKey||'');
  const signedCard=S.personaDiscoveryByKey.get(personaKey)||null;
  const descriptor=normalizePersonaAvatar(signedCard?.avatar);
  const revision=_personaAvatarMountRevision(descriptor,signedCard);
  if(!descriptor||mount.dataset.avatarRevision!==revision){
    _neutralPersonaAvatar(mount,signedCard?.avatar?'failed':'local'); return;
  }
  mount.dataset.avatarState='loading';
  try{
    const asset=await _loadPersonaAvatarAsset(personaKey,signedCard,descriptor);
    if(!mount.isConnected||mount.dataset.avatarRevision!==revision) return;
    const img=document.createElement('img'); img.alt=''; img.setAttribute('aria-hidden','true');
    img.decoding='async'; img.draggable=false; img.width=asset.width; img.height=asset.height;
    img.addEventListener('error',()=>{ if(mount.isConnected&&mount.contains(img)) _neutralPersonaAvatar(mount); },{once:true});
    img.src=asset.url;
    mount.replaceChildren(img); mount.dataset.avatarState='ready'; mount.setAttribute('aria-label','verified optional persona-authored raster avatar');
  }catch(e){ if(mount.isConnected&&mount.dataset.avatarRevision===revision) _neutralPersonaAvatar(mount); }
}
function _hydratePersonaAvatars(){
  document.querySelectorAll('.pc-avatar[data-avatar-key]').forEach((mount)=>{
    if(mount.dataset.avatarState==='pending') _hydratePersonaAvatarMount(mount).catch(()=>{});
  });
}
window.addEventListener('pagehide',()=>{
  for(const asset of _personaAvatarAssets.values()) URL.revokeObjectURL(asset.url);
  _personaAvatarAssets.clear(); _personaAvatarCacheBytes=0;
},{once:true});
function _artifactStateInfo(r){
  const m=String(r?.description||'').match(/^(\w+) deliverable bundle \((\d+) files?\)/i);
  const state=m?m[1].toLowerCase():'', files=m?Number(m[2]):0;
  const cls=(state==='shipped'||state==='accepted')?'ds-ok'
    :(state==='deprecated'||state==='rejected')?'ds-no':'ds-amber';
  return {state,files,cls};
}
function _artifactActionHTML(r,{scope='output'}={}){
  if(!r) return '';
  const aid=r._storeKey||r.record_id||r.card_id||r.id||'';
  const info=_artifactStateInfo(r), label=String(r.label||'deliverable');
  const authored=authoredArtifactLabelText(r);
  return `<button type="button" class="owned-output ${info.cls}" data-artid="${esc(aid)}" title="open ${esc(label)}">`
    +`<span class="owned-output-icon">${icon('box','ico-sm')}</span><span class="owned-output-copy"><b>${esc(label)}</b>`
    +`<small>${esc(scope)}${info.state?` · ${esc(info.state.replace(/_/g,' '))}`:''}${info.files?` · ${info.files} files`:''}${authored?` · authored: ${esc(authored)}`:''}</small></span>${icon('chevron','ico-sm')}</button>`;
}
function _ownedOutputsHTML(artifacts,{label='Owned outputs',scope='persona worktree'}={}){
  const rows=[...(artifacts||[])], bundles=rows.filter((r)=>r?._links?.bundle);
  const selected=bundles.length?[bundles[bundles.length-1]]:rows.slice(-2).reverse();
  if(!selected.length) return '';
  const earlier=Math.max(0,bundles.length-1);
  const authored=[...new Set(rows.flatMap((r)=>authoredArtifactLabels(r)))].slice(0,8);
  return `<section class="owned-outputs"><div class="owned-outputs-head"><span>${esc(label)}</span><small>${esc(scope)}</small></div>`
    +selected.map((r)=>_artifactActionHTML(r,{scope})).join('')
    +(authored.length?`<div class="owned-output-history">authored role claims · ${esc(authored.join(' · '))}</div>`:'')
    +(earlier?`<div class="owned-output-history">${earlier} earlier revision${earlier===1?'':'s'} retained in signed history</div>`:'')+`</section>`;
}
function _liveWorkspacesHTML(rows,{label='Live worktree',scope='persona worktree'}={}){
  if(!(rows||[]).length) return '';
  return `<section class="owned-outputs live-owned-outputs"><div class="owned-outputs-head"><span>${esc(label)}</span><small>workspace snapshot · signature checked · lifecycle unknown</small></div>`
    +rows.slice(0,2).map((row)=>`<button type="button" class="owned-output live-output" data-live-output-run="${esc(row.run)}" data-live-output-base="${esc(row.base||'')}">`
      +`<span class="owned-output-icon">${icon('code','ico-sm')}</span><span class="owned-output-copy"><b>${esc(row.workspaceId||row.run)}</b>`
      +`<small>${esc(scope)} · ${row.fileCount} file${row.fileCount===1?'':'s'} · ${esc(row.state||'live')}${row.authored?.length?` · authored: ${esc(row.authored.join(' · '))}`:''}</small></span>${icon('chevron','ico-sm')}</button>`).join('')+`</section>`;
}
function _personaActivityHTML(acts,personaKey){
  const candidates=[]; const seen=new Map();
  for(const e of [...(acts||[])].reverse()){
    const endpoints=_eventEndpoints(e).map((endpoint)=>`${endpoint.kind}:${endpoint.id}`).sort().join(',');
    const detail=String(e?._msg||e?._cap?.capability||e?._cap?.tool_name||'').replace(/\s+/g,' ').trim();
    const provenance=e?._provenance||{};
    const identity=[provenance.call,provenance.event,provenance.intent,provenance.message,
      provenance.action,provenance.run,provenance.task,provenance.at,provenance.startedAt,
      provenance.snapshotAt].filter((value)=>value!==undefined&&value!==null&&value!=='').join('|');
    const preserveEvent=identity||e?._cognition===true||e?._providerProvisional===true
      ||e?.kind==='MODEL_CALL'||String(e?.kind||'').startsWith('MODEL_');
    const key=[e?.kind,e?.actor_kind,e?.actor_id,endpoints,detail,identity,
      preserveEvent?(e?._key||''):''].join('|');
    const prior=seen.get(key); if(prior){ prior.count++; continue; }
    const row={event:e,count:1}; seen.set(key,row); candidates.push(row);
  }
  // Repeated kernel model snapshots can have a newer observation timestamp than
  // the exact persona-authored output they report on. Keep that transport status
  // visible, but reserve half of this compact surface for the newest verified
  // exact persona messages/actions when they exist. Trust still comes from the
  // already-verified public-cognition document; this is presentation only.
  const rows=[];
  const add=(row)=>{ if(row&&!rows.includes(row)&&rows.length<4) rows.push(row); };
  candidates.filter(({event})=>typeof event?._exactText==='string'&&event._exactText.trim())
    .slice(0,2).forEach(add);
  candidates.forEach(add);
  rows.sort((left,right)=>Number(right.event?._t||0)-Number(left.event?._t||0));
  if(!rows.length) return `<section class="pc-activity pc-message-stream"><div class="pc-section-head"><span>Live persona activity</span><small>quiet now</small></div><div class="pc-activity-empty">No signed or observed activity is available in the retained public window.</div></section>`;
  return `<section class="pc-activity pc-message-stream"><div class="pc-section-head"><span>Live persona activity</span><small><i></i> verified and observed stream</small></div><ol aria-live="polite" aria-relevant="additions text" aria-atomic="false">`
    +rows.map(({event:e,count})=>{ const cls=_ixClass(e.kind,e), kernel=_eventKernel(e);
      const actorKey=e.actor_kind==='persona'?_eventPersonaKey(e,e.actor_id):'';
      const actor=actorKey?_nameFor(actorKey):(e.actor_kind||'kernel');
      const mine=actorKey===personaKey;
      const targets=_eventEndpoints(e).map((endpoint)=>endpoint.kind==='persona'
        ?_nameFor(_eventPersonaKey(e,endpoint.id))
        :(endpoint.kind==='model'?String(endpoint.id||'model'):`${endpoint.kind}:${String(endpoint.id||'').slice(0,10)}`)).slice(0,3);
      const recipientCount=Number.isSafeInteger(e._recipientCount)&&e._recipientCount>0?e._recipientCount:0;
      const targetLabel=recipientCount?`${recipientCount} recipient${recipientCount===1?'':'s'}`:targets.join(', ');
      const selfName=_nameFor(personaKey);
      const route=mine
        ?`${selfName}${targetLabel?` → ${targetLabel}`:''}`
        :`${actor}${targetLabel?` → ${targetLabel}`:` → ${selfName}`}`;
      const detail=String(e._msg||e._cap?.capability||e._cap?.tool_name||'').replace(/\s+/g,' ').trim();
      const direction=mine?'outbound':(actorKey?'inbound':'observed');
      const provenance=_activityProvenanceHTML(e._provenance,{className:'pc-message-provenance',
        prepend:_eventTrustHTML(e)});
      return `<li class="pc-activity-row pc-message ${direction} ix-${cls}" data-message-kind="${esc(String(e.kind||''))}">`
        +`<span class="pc-activity-mark">${_ixGlyph(cls)}</span><span class="pc-activity-copy"><span class="pc-message-route">${esc(route)}</span>`
        +`<b>${esc(_ixHeadline(e))}${count>1?` <span class="pc-message-count">×${count}</span>`:''}</b>`+(detail?`<span class="pc-message-body">${esc(detail)}</span>`:'')
        +provenance+`</span>${_eventTimeHTML(e)}</li>`; }).join('')+`</ol></section>`;
}
function renderPersonaCard(pid,kernel='',context={}){
  const ref=_personaRef(pid,kernel), sid=ref.sid, personaKey=ref.key;
  const d=S.liveByPersona.get(personaKey)||{}; const s=d.summary||{};
  const models=d.models||[]; const last=models[models.length-1];
  const rt=runtimeForPersona(personaKey)||{};
  const indexedActiveCalls=_activeModelCallsForPersona(personaKey);
  const signedCognitionCall=[...indexedActiveCalls].reverse().find((call)=>call?._signedPublicCognition===true)||null;
  const transportStale=!!d.stale&&!signedCognitionCall;
  const activeCall=signedCognitionCall||(!d.stale?(indexedActiveCalls.at(-1)||rt.current_model_call||null):null);
  const signedIdentity=S.personaDiscoveryByKey.get(personaKey)||null;
  const lifecycle=personaLifecycleProjection(S.personaDiscoveryByKey,personaKey);
  const signedName=String(signedIdentity?._personaSignedName||'');
  const hasSignedIdentity=!!signedIdentity;
  const hasSignedName=hasSignedIdentity&&!_isMechanicalPersonaName(signedName,sid);
  const name=_displayPersonaName(signedName,sid);
  const role=_coordRole(sid,s,ref.kernel);
  const state=s.lifecycle_state||lifecycle?.lifecycleState||'';
  const identityPending=lifecycle?.materializationState==='pending';
  const namePending=lifecycle?.identityFields?.name?.state==='pending'
    ||s.identity_name_pending===true;
  const characteristicsPending=lifecycle?.identityFields?.characteristics?.state==='pending';
  // dual-state hero: STATE B = model req/resp (the richest signal); STATE A =
  // recent kernel.interactions naming this persona (so the hero stays alive on a
  // node that streams coordination but no model_events). Both are real telemetry.
  const acts=(S.ixByPersona&&S.ixByPersona.get(personaKey))||[];
  const recentAct=_latestPersonaActivityForRecency(acts);
  const actFresh=!!recentAct && (Date.now()-recentAct._t)<90000;
  const hasModels=models.length>0;
  // HONEST recency: a model-bearing card decays to idle once its model events stop
  // arriving (5-min window) instead of staying green forever via the sticky models[]
  // carry-forward. Liveness = model events seen recently OR a fresh coordination act.
  const modelFresh=_modelFresh(personaKey,models);
  const recent=!transportStale&&(modelFresh||actFresh);
  const running=!!signedCognitionCall||(!d.stale&&_runningNow(personaKey));
  const terminalFailure=running?null:(d.terminalFailure||null);
  // flash on genuine growth of total activity (model reqs + monotonic act tally)
  const actTally=(S.ixCountBySid&&S.ixCountBySid.get(personaKey))||0;
  const grew=_personaGrew(personaKey,models.length+actTally);
  let doingHTML, focusLabel='Current move';
  if(activeCall){
    const purpose=String(activeCall.requested_purpose||activeCall.purpose||'model');
    const model=String(activeCall.model_id||activeCall.model||'—');
    const purposeLabel=activeCall._signedPublicCognition===true
      ?purpose:(PURPOSE_VERB[purpose]||purpose.replace(/_/g,' '));
    doingHTML=`<span class="pulse">${icon('dot','ico-sm')}</span><strong>${esc(purposeLabel)}</strong><code>${esc(model)}</code>`
      +(activeCall.role?` <span class="pc-when">${esc(activeCall.role)}</span>`:'');
  } else if(terminalFailure){
    focusLabel='Execution status';
    const purpose=PURPOSE_VERB[terminalFailure.purpose]
      ||String(terminalFailure.purpose||'model call').replace(/_/g,' ');
    doingHTML=`<span class="pc-failure-mark">${icon('warn','ico-sm')}</span><strong>Model call failed</strong>`
      +(terminalFailure.model?`<code>${esc(terminalFailure.model)}</code>`:'')
      +`<span class="pc-when">${esc(purpose)}${terminalFailure.status?` · HTTP ${esc(terminalFailure.status)}`:''}</span>`;
  } else if(hasModels){
    const purposeLabel=PURPOSE_VERB[last.purpose]||String(last.purpose||'activity').replace(/_/g,' ');
    focusLabel=modelFresh?'Recent model activity':'Last model activity';
    const verb=modelFresh?purposeLabel:('last '+purposeLabel);
    doingHTML=`${running?'<span class="pulse">'+icon('dot','ico-sm')+'</span>':'<span class="pc-rest">'+icon('play','ico-sm')+'</span>'}<strong>${esc(verb)}</strong><code>${esc(last.model)}</code>`;
  } else if(actFresh){
    doingHTML=`${running?'<span class="pulse">'+icon('dot','ico-sm')+'</span>':'<span class="pc-rest">'+icon('play','ico-sm')+'</span>'}<strong>${esc(_ixVerb(recentAct.kind))}</strong>`;
  } else {
    focusLabel='Next move'; doingHTML='<span class="pc-rest">'+icon('dot','ico-sm')+'</span><strong>Ready for the next assignment</strong>';
  }
  // TOOL chip: the persona's headline self-extension act (provision / acquire / use /
  // block) within the live window. doingHTML is model-purpose-only when hasModels, so a
  // persona calling models AND just reaching for a tool would otherwise mask the tool act.
  // Strictly additive — does NOT touch pc-msgs/pc-glance/pc-stats. The client projection
  // strips payload, so only the verb is available (no capability name / error).
  const toolAct=[...acts].reverse().find((a)=>a?._observedState!==true
    &&TOOL_KINDS.has(a.kind)&&(Date.now()-a._t)<90000);
  const mp=s.mode_proficiencies||{}; const topMode=Object.entries(mp).sort((a,b)=>b[1]-a[1])[0];
  // PER-04: the public card shows reputation_score (role-relative [0,1]), NEVER raw
  // operator fitness. Evolution internals (tactics/lessons/modes) are operator-tier
  // — shown only when an operator token is held (and in the 🧠 thinking drawer).
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  // pc-stats footer: assemble the spans first so a model-only persona (s={}, no summary)
  // doesn't render an EMPTY pc-stats div whose border-top draws a stray separator bar.
  // neutral .tag chips with leading stroked glyphs (replaces the colour-emoji prefixes);
  // .tag is additive — the existing pc-stats span styling still applies until shared CSS lands.
  const statHTML=(Number(s.experience_tasks)>0?`<span class="tag" title="tasks worked">${icon('task','ico-sm')} ${esc(s.experience_tasks)}</span>`:'')
    +(namePending?`<span class="tag" title="${esc(s.identity_name_pending_reason||'persona-authored name pending')}">${icon('warn','ico-sm')} name pending</span>`:'')
    +(characteristicsPending?`<span class="tag" title="persona-authored characteristics pending">${icon('warn','ico-sm')} traits pending</span>`:'')
    +(s.reputation_score!=null?`<span class="tag" title="reputation — role-relative [0,1]">${icon('rep','ico-sm')} ${esc(Number(s.reputation_score).toFixed(2))}</span>`:'')
    +(hasOp&&s.brain_fragment_count!=null?`<span class="tag" title="brain fragments (operator)">${icon('lesson','ico-sm')} ${esc(s.brain_fragment_count)}</span>`:'')
    +(hasOp&&s.brain_compile_count!=null?`<span class="tag" title="brain compiles (operator)">${icon('mode','ico-sm')} ${esc(s.brain_compile_count)}</span>`:'')
    +(hasOp&&s.tactic_count!=null?`<span class="tag" title="evolved tactics (operator)">${icon('dna','ico-sm')} ${esc(s.tactic_count)}</span>`:'')
    +(hasOp&&s.lesson_count!=null?`<span class="tag" title="lessons learned (operator)">${icon('lesson','ico-sm')} ${esc(s.lesson_count)}</span>`:'')
    +(hasOp&&topMode?`<span class="tag" title="strongest cognitive mode (operator)">${icon('mode','ico-sm')} ${esc(topMode[0])} ${esc(Number(topMode[1]).toFixed(2))}</span>`:'')
    +(rt.task_execution_state?`<span class="tag runtime-tag" title="task execution state from unsigned node status">${icon('task','ico-sm')} ${esc(rt.task_execution_state.replace(/_/g,' '))}</span>`:'');
  // Runtime state is separate from lifecycle. RUNNING is LLM/model-call only;
  // RECENT is public activity; IDLE means available but no recent activity.
  const dotCls=running?'run':(terminalFailure?'error':(recent?'on':'off'));
  const statusBadge=transportStale
    ? `<span class="pc-idle">${d.presence==='offline'?'OFFLINE':'STALE'}</span>`
    : running ? '<span class="pc-run">MODEL CALL</span>'
    : terminalFailure ? '<span class="pc-failed">MODEL FAILED</span>'
    : (rt.task_execution_state==='paused_participant'?'<span class="pc-idle">PAUSED</span>'
      :rt.task_execution_state==='run_participant'?'<span class="pc-recent">RUN ACTIVE</span>'
      :(recent?'<span class="pc-recent">RECENT</span>':'<span class="pc-idle">IDLE</span>'));
  const lifecycleState=(state||'ACTIVE').toUpperCase();
  const lifecycleBadge=`<span class="pc-life${lifecycleState==='ACTIVE'?'':' off'}">${esc(lifecycleState==='ACTIVE'?'AVAILABLE':lifecycleState.toLowerCase())}</span>`;
  // HONEST recency tag on the doing line: when did this persona last actually do
  // something (model event / coordination act / cognition / tool use)? So an "active"
  // card reads "3m ago" instead of an unbounded-green claim. Hidden while running-now.
  const lastSeen=Math.max(S.lastModelSeenAt?.get(personaKey)||0, recentAct?._t||0, toolAct?._t||0);
  if(!running && !terminalFailure && lastSeen>0) doingHTML+=`<span class="pc-when">${_ago(lastSeen)}</span>`;
  const hue=_personaAvatarHue(personaKey);
  const environments=(context.environments||[]).filter(Boolean);
  const workspaceRows=(context.liveWorkspaces||[]).filter((row)=>row&&typeof row.run==='string'&&row.run.trim());
  const workspaceTimes=workspaceRows.map((row)=>Date.parse(row.generatedAt||''));
  const newestWorkspaceAt=workspaceTimes.length&&workspaceTimes.every(Number.isFinite)
    ?Math.max(...workspaceTimes):null;
  const currentWorkspaceRows=newestWorkspaceAt===null?workspaceRows
    :workspaceRows.filter((row)=>Date.parse(row.generatedAt||'')===newestWorkspaceAt);
  const workspaceRuns=[...new Set(currentWorkspaceRows
    .map((row)=>typeof row?.run==='string'?row.run.trim():'').filter(Boolean))];
  const verifiedCurrentTask=workspaceRuns.length===1
    ?_verifiedPublicTaskForRun(ref.kernel,workspaceRuns[0]):null;
  const currentTask=typeof verifiedCurrentTask?.task==='string'?verifiedCurrentTask.task:'';
  const currentTaskHTML=currentTask
    ?`<section class="pc-current pc-current-task"><span class="pc-current-label">Current task</span><div class="pc-doing"><strong>${esc(currentTask)}</strong></div></section>`:'';
  const environmentHTML=environments.length?`<section class="pc-environments"><span class="pc-current-label">Working in</span><div>`
    +environments.slice(0,4).map((env,index)=>`<button type="button" class="pc-env-chip${index===0?' current':''}" data-envrec="${esc(env.sid)}" data-envkernel="${esc(env.kernel||ref.kernel)}" title="open ${esc(env.name)}">${icon('box','ico-sm')}<span>${esc(env.name)}</span></button>`).join('')
    +(environments.length>4?`<span class="pc-env-more">+${environments.length-4}</span>`:'')+`</div></section>`
    :`<section class="pc-environments independent"><span class="pc-current-label">Environment</span><div><span class="pc-env-none">working independently</span></div></section>`;
  return `<article class="pcard ${_coordRoleClass(role)}${hasSignedIdentity?' identity-signed':' identity-unpublished'}${identityPending?' identity-pending':''}${running?' running':terminalFailure?' failed':recent?' live':''}${grew&&!running?' flashcard':''}" style="--avatar-hue:${hue}" data-pcard="${esc(sid)}" data-pkey="${esc(_domEntityKey(personaKey))}" data-pkernel="${esc(ref.kernel)}" data-identity-state="${hasSignedName?'named':identityPending?'materializing':hasSignedIdentity?'name-pending':'unpublished'}" role="button" tabindex="0" title="open ${esc(name)}">`
    +`<div class="pc-card-shine" aria-hidden="true"></div><div class="pc-card-edition"><span>${identityPending?icon('warn','ico-sm')+' IDENTITY MATERIALIZING':hasSignedIdentity?icon('check','ico-sm')+' VERIFIED PERSONA':icon('warn','ico-sm')+' IDENTITY UNPUBLISHED'}</span><span>LIVE CARD · ${esc(sid.slice(-6).toUpperCase())}</span></div>`
    +`<header class="pc-profile">${_personaAvatarHTML(personaKey)}`
    +`<i class="pc-dot ${dotCls}" aria-hidden="true"></i>`
    +`<div class="pc-identity"><h3 class="pc-name">${esc(name)}</h3><span class="pc-name-proof">${hasSignedName?icon('check','ico-sm')+' signed display name':identityPending?icon('check','ico-sm')+' signed lifecycle · name pending':hasSignedIdentity?icon('check','ico-sm')+' signed identity · name pending':icon('warn','ico-sm')+' signed name unavailable'}</span><span class="pc-idline">${esc(role)} · ${esc(sid.slice(0,10))}</span></div>`
    +`<div class="pc-badges">${statusBadge}${lifecycleBadge}</div>`
    +`<button class="pc-follow" data-follow="${esc(_domEntityKey(personaKey))}" title="focus on ${esc(name)}" aria-label="focus on ${esc(name)}" aria-pressed="false">${icon('target','ico-sm')}</button></header>`
    +environmentHTML+currentTaskHTML+`<section class="pc-current"><span class="pc-current-label">${esc(focusLabel)}</span><div class="pc-doing">${doingHTML}</div></section>`
    +_personaActivityHTML(acts,personaKey)
    +_liveWorkspacesHTML(context.liveWorkspaces,{label:'My live worktree',scope:'persona worktree'})
    +_ownedOutputsHTML(context.artifacts,{label:'My outputs',scope:'persona worktree'})
    +(statHTML?`<div class="pc-stats">${statHTML}</div>`:'')
    +'</article>';
}

// A compact environment-local social graph. Membership comes only from the
// verified environment roster or explicit live environment telemetry. Edges
// come only from one observed frame naming both an actor persona and a persona
// endpoint in this exact environment; shared membership never invents a link.
function _environmentScopedEvents(b){
  const sid=_shortId(b?.sid||b?.envId), kernel=String(b?.kernel||'');
  const now=Date.now(), lease=5*60*1000;
  return (S.interactions||[]).filter((event)=>_eventKernel(event)===kernel
    &&_shortId(event?.scope_id||'')===sid
    &&event?._t>0&&now-event._t<=lease&&event._t-now<30000);
}
function _environmentGraphId(b){
  let value=2166136261;
  for(const char of `${b?.kernel||''}\u0000${b?.sid||b?.envId||''}`){ value^=char.charCodeAt(0); value=Math.imul(value,16777619); }
  return `env-arrow-${(value>>>0).toString(36)}`;
}
function _environmentCommunicationGraphHTML(b){
  const refs=[...new Set((b?.members||[]).map((value)=>_personaRef(value,b?.kernel).key).filter(Boolean))];
  const scopedEvents=_environmentScopedEvents(b);
  const memberState=(personaKey)=>{ const d=S.liveByPersona.get(personaKey)||{}, models=d.models||[];
    const acts=S.ixByPersona?.get(personaKey)||[], latest=_latestPersonaActivityForRecency(acts);
    const recent=_modelFresh(personaKey,models)||!!(latest&&Date.now()-latest._t<90000);
    return {running:_runningNow(personaKey),recent}; };
  // Compute each member's state/name once, then retain only the six best rows.
  // Sorting a thousand-person environment recomputed key parsing/state from every
  // comparator even though the compact graph renders six nodes; that froze search
  // and progressive card expansion for seconds at realistic population sizes.
  const states=new Map(), names=new Map(); let activeCount=0;
  for(const key of refs){ const state=memberState(key); states.set(key,state);
    names.set(key,_signedPersonaNameFor(key)); if(state.running) activeCount++; }
  const shown=selectPriorityWindow(refs,{limit:6,keyOf:(key)=>`${names.get(key)||''}\u0000${key}`,
    priorityOf:(key)=>{ const state=states.get(key)||{};
      return (state.running?2:0)+(state.recent?1:0); }}).items;
  const shownSet=new Set(shown), hidden=Math.max(0,refs.length-shown.length);
  if(!shown.length) return {activeCount,eventCount:scopedEvents.length,directCount:0,
    html:`<section class="env-network empty"><div class="env-network-head"><span>Active constellation</span><small>0 observed members</small></div>`
      +`<div class="env-network-empty">No persona roster has been observed for this signed environment yet.</div></section>`};

  const positions=new Map();
  shown.forEach((key,index)=>{ const count=shown.length;
    if(count===1){ positions.set(key,{x:50,y:50}); return; }
    if(count===2){ positions.set(key,{x:index?73:27,y:50}); return; }
    const angle=(-Math.PI/2)+(index*2*Math.PI/count);
    positions.set(key,{x:50+36*Math.cos(angle),y:50+32*Math.sin(angle)}); });
  const edges=new Map();
  for(const event of scopedEvents){
    if(event.actor_kind!=='persona') continue;
    const from=_eventPersonaKey(event,event.actor_id); if(!shownSet.has(from)) continue;
    for(const endpoint of _personaEndpoints(event)){
      const to=_eventPersonaKey(event,endpoint.id); if(!shownSet.has(to)||to===from) continue;
      const key=`${from}\u0000${to}`, prior=edges.get(key);
      if(prior){ prior.count++; if(event._t>=prior.latest._t) prior.latest=event; }
      else edges.set(key,{from,to,count:1,latest:event});
    }
  }
  const markerId=_environmentGraphId(b);
  const edgeHTML=[...edges.values()].map((edge)=>{ const from=positions.get(edge.from), to=positions.get(edge.to);
    const dx=to.x-from.x, dy=to.y-from.y, len=Math.max(1,Math.hypot(dx,dy));
    const reciprocal=edges.has(`${edge.to}\u0000${edge.from}`), bend=reciprocal?(edge.from<edge.to?5:-5):0;
    const mx=(from.x+to.x)/2-(dy/len)*bend, my=(from.y+to.y)/2+(dx/len)*bend;
    const cls=_ixClass(edge.latest.kind), label=`${_nameFor(edge.from)} to ${_nameFor(edge.to)}: ${_ixVerb(edge.latest.kind)}${edge.count>1?`, ${edge.count} observed frames`:''}`;
    return `<path class="env-comm-edge edge-${esc(cls)}" d="M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}" marker-end="url(#${markerId})"><title>${esc(label)}</title></path>`;
  }).join('');
  const nodes=shown.map((personaKey)=>{ const ref=_personaRef(personaKey), state=states.get(personaKey)||{};
    const stateLabel=state.running?'model call':(state.recent?'recent':'ready');
    return `<button type="button" class="env-persona-node ${state.running?'running':state.recent?'recent':'idle'}" style="--node-x:${positions.get(personaKey).x}%;--node-y:${positions.get(personaKey).y}%" data-pcard="${esc(ref.sid)}" data-pkey="${esc(_domEntityKey(personaKey))}" data-pkernel="${esc(ref.kernel)}" title="open ${esc(_signedPersonaNameFor(personaKey))}">`
      +`<span class="env-node-portrait">${_personaAvatarHTML(personaKey)}<i aria-hidden="true"></i></span>`
      +`<strong>${esc(_signedPersonaNameFor(personaKey))}</strong><small>${esc(stateLabel)}</small></button>`;
  }).join('');
  const directEvents=scopedEvents.filter((event)=>event.actor_kind==='persona'&&_personaEndpoints(event).length).slice(-3).reverse();
  const feed=directEvents.length?`<ol class="env-comm-feed" aria-live="polite" aria-relevant="additions text">${directEvents.map((event)=>{
    const actor=_nameFor(_eventPersonaKey(event,event.actor_id));
    const recipients=_personaEndpoints(event).map((endpoint)=>_nameFor(_eventPersonaKey(event,endpoint.id))).slice(0,3);
    return `<li><span>${esc(actor)} <b>→</b> ${esc(recipients.join(', '))}</span><small>${esc(_ixVerb(event.kind))} · ${esc(_ago(event._t))}</small></li>`;
  }).join('')}</ol>`:`<div class="env-comm-quiet">No explicit persona→persona message observed in the last five minutes.</div>`;
  return {activeCount,eventCount:scopedEvents.length,directCount:edges.size,
    html:`<section class="env-network"><div class="env-network-head"><span>Active constellation</span><small>${activeCount} working · ${edges.size} direct channel${edges.size===1?'':'s'}</small></div>`
      +`<div class="env-network-canvas"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="${markerId}" markerWidth="5" markerHeight="5" refX="4.3" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z"></path></marker></defs>${edgeHTML}</svg>${nodes}</div>`
      +(hidden?`<div class="env-network-more">+${hidden} additional member${hidden===1?'':'s'} in the verified roster</div>`:'')+feed+`</section>`};
}

// ---- live coordination GRAPH (SVG): kernel hub + persona nodes + pulsing edges --
// Honest topology: PersonaOS coordination is KERNEL-MEDIATED (the kernel routes
// candidate→verify→accept), so the kernel is the hub and personas are spokes.
// Persona↔persona chords exist only for events that explicitly name both endpoints.
// Edges/nodes pulse only for fresh interactions from kernel telemetry.
function _hotPersonas(){
  const hot=new Set(), now=Date.now(), recent=(S.interactions||[])
    .filter((e)=>e._t>0&&now-e._t<=5*60*1000&&e._t-now<30000).slice(-10);
  for(const e of recent){
    if(e.actor_kind==='persona'&&e.actor_id) hot.add(_eventPersonaKey(e,e.actor_id));
    for(const endpoint of _personaEndpoints(e)) hot.add(_eventPersonaKey(e,endpoint.id));
  }
  return hot;
}
// quadratic control point for a persona↔persona chord, bowed clear of the kernel
// core at (cx,cy). Default bow = outward along the kernel→midpoint normal so the curve
// arcs AWAY from the hub. When the two nodes sit opposite at the ellipse waist the
// midpoint lands on the core and that normal collapses — fall back to the chord's own
// perpendicular so the chord still arcs clear instead of slicing straight through the core.
function _chordCtl(ax,ay,bx,by,bow){
  const cx=600,cy=120, mx=(ax+bx)/2, my=(ay+by)/2;
  let nx=mx-cx, ny=my-cy; let nl=Math.hypot(nx,ny);
  if(nl<6){ nx=-(by-ay); ny=(bx-ax); nl=Math.hypot(nx,ny)||1; bow=Math.max(bow,84); }   // degenerate (opposite nodes) → chord perpendicular + force a core-clearing bow (apex stays clear of the r=34 ring)
  nx/=nl; ny/=nl;
  return {qx:+(mx+nx*bow).toFixed(1), qy:+(my+ny*bow).toFixed(1)};
}
// Exact persona↔persona traffic over the recent interaction window. A chord
// exists only when one event names an actor persona and a recipient/affected
// persona. Shared scope/cohort membership is intentionally NOT converted into
// a message edge; otherwise the UI would claim a flow the telemetry never sent.
function _personaTraffic(posOf){
  const map=new Map();
  const bump=(a,b,n)=>{ if(!a||!b||a===b) return;
    const ordered=a<b?[a,b]:[b,a], key=`${ordered[0]}\u0001${ordered[1]}`;
    const t=map.get(key)||map.set(key,{a:ordered[0],b:ordered[1],n:0,direct:true}).get(key);
    t.n+=n; };
  const now=Date.now(), all=(S.interactions||[])
    .filter((e)=>e._t>0&&now-e._t<=5*60*1000&&e._t-now<30000);
  for(const e of all.slice(-NETWORK_LIMITS.interactionRows)){
    if(e.actor_kind!=='persona') continue;
    const a=_eventPersonaKey(e,e.actor_id); if(!a||!posOf.has(a)) continue;
    for(const af of _personaEndpoints(e)){
      const b=_eventPersonaKey(e,af.id); if(!b||b===a||!posOf.has(b)) continue;
      bump(a,b,1);
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
  const cx=600,cy=120,rx=520,ry=78;
  const discoveredKernelTotal=Math.max(S.globalKernels?.size||0,Number(S.globalTotal)||0,S.kernels?.size||0);
  const implicitSingle=discoveredKernelTotal===1?[...(S.globalKernels||new Map()).keys()][0]||[...(S.kernels||[])][0]||'':null;
  const effectiveFocus=S.kernelFocus||implicitSingle;
  // Keyed layers survive the 5s refresh; their DOM cardinality is capped by the
  // selected projection, never by total global population.
  if(!svg._built){ svg._built=true;
    svg.appendChild(_svg('g',{},'cg-edges'));
    const links=_svg('g',{},'cg-links');
    links.appendChild(_svg('g',{},'cg-chords'));
    links.appendChild(_svg('g',{},'cg-linkfire'));
    svg.appendChild(links);
    svg.appendChild(_svg('g',{},'cg-axons'));
    svg.appendChild(_svg('g',{},'cg-cores'));
    svg.appendChild(_svg('g',{},'cg-nodes'));
    svg._edges=svg.querySelector('.cg-edges'); svg._chords=svg.querySelector('.cg-chords');
    svg._linkfire=svg.querySelector('.cg-linkfire'); svg._axons=svg.querySelector('.cg-axons');
    svg._cores=svg.querySelector('.cg-cores'); svg._nodes=svg.querySelector('.cg-nodes');
  }
  const scopedHeartbeat=heartbeatForScope();
  const beat=scopedHeartbeat?.interval_s?Math.max(2,+scopedHeartbeat.interval_s):5;
  const upsertCore=(kernel,x,y,summary,{fresh=true,focused=false}={})=>{
    let core=svg._cores.querySelector(`[data-kernel-core="${cssEsc(kernel)}"]`);
    if(!core){ core=_svg('g',{},'core'); core.setAttribute('data-kernel-core',kernel);
      core.setAttribute('role','button'); core.setAttribute('tabindex','0');
      core.appendChild(_svg('title',{})); core.appendChild(_svg('circle',{r:36},'core-ring'));
      core.appendChild(_svg('circle',{r:30},'core-c'));
      core.appendChild(_svg('text',{y:-9},'core-t'));
      core.appendChild(_svg('text',{y:5},'core-id'));
      core.appendChild(_svg('text',{y:19},'core-s')); svg._cores.appendChild(core); }
    core.setAttribute('transform',`translate(${x},${y})`);
    core.setAttribute('class',`core${focused?' focused':''}${fresh?'':' core-offline'}`);
    core.style.setProperty('--beat',beat+'s');
    const short=String(kernel||'kernel').replace(/^kernel:/,'');
    core.children[0].textContent=`${kernel} · ${summary}`;
    core.children[3].textContent='NODE';
    core.children[4].textContent=short.length>15?short.slice(0,14)+'…':short;
    core.children[5].textContent=summary;
    core.setAttribute('aria-label',`${kernel} — ${summary}. Select to inspect this node.`);
    return core;
  };
  S.nodePos.clear();
  const graphScope=$('#graphScope'), graphWindow=$('#graphWindow'), graphCap=$('#sysGraphCap');

  // Global mode is kernel-level aggregation. Rendering even a sample of every
  // kernel's personas would imply completeness and collapse at large scale;
  // selecting a kernel drills to the exact persona/message view below.
  if(!effectiveFocus){
    const now=Date.now();
    const rows=[...(S.globalKernels||new Map()).entries()].map(([kernel,info])=>{ const hasRoute=[...info.via]
      .some((v)=>['http','manual','local','ipfs','p2p','gossip'].includes(v));
      return {kernel,info,fresh:now-(info.lastSeen||0)<45000,active:kernelActivity(info),
        reachable:info.meta?.reachable===false?false:(info.meta?.reachable===true||hasRoute)}; });
    const window=selectPriorityWindow(rows,{limit:NETWORK_LIMITS.graphKernels,keyOf:(row)=>row.kernel,
      priorityOf:(row)=>(row.active?1e8+row.active:0)+(row.fresh?1e6:0)+(row.reachable?1e5:0)+(Number(row.info.meta?.recordCount)||0)});
    const n=window.items.length, coreIds=new Set();
    window.items.forEach((row,i)=>{ const x=n<=1?cx:80+i*(1040/(n-1));
      const records=Number(row.info.meta?.recordCount)||0;
      const summary=row.active?`${row.active} running`:(records?`${compactCount(records)} records`:(row.reachable?'reachable':'no route'));
      upsertCore(row.kernel,+x.toFixed(1),cy,summary,{fresh:row.fresh||row.reachable}); coreIds.add(row.kernel); });
    [...svg._cores.children].forEach((core)=>{ if(!coreIds.has(core.getAttribute('data-kernel-core'))) core.remove(); });
    svg._edges.innerHTML=''; svg._chords.innerHTML=''; svg._axons.innerHTML=''; svg._nodes.innerHTML=''; svg._linkfire.innerHTML='';
    const total=Math.max(rows.length,Number(S.globalTotal)||0,S.kernels?.size||0);
    if(graphScope) graphScope.textContent='GLOBAL NETWORK';
    if(graphWindow) graphWindow.textContent=`${window.returned} of ${compactCount(total)} nodes`;
    if(graphCap) graphCap.textContent='activity-prioritized node window · select a node to inspect environments, personas, exact status and messages';
    return;
  }

  // Focused kernel: rank a bounded exact-persona window, then draw only direct
  // actor→recipient chords from observed frames. The stage remains the accessible
  // semantic list and can progressively reveal more cards.
  const coreIds=new Set([effectiveFocus]);
  const runningN=persons.filter((p)=>p.running).length, liveN=persons.filter((p)=>p.live).length;
  const focusedInfo=S.globalKernels?.get(effectiveFocus), now=Date.now();
  const focusedHasRoute=!!focusedInfo&&[...focusedInfo.via].some((v)=>['http','manual','local','ipfs','p2p','gossip'].includes(v));
  const focusedReachable=!!focusedInfo&&focusedInfo.meta?.reachable!==false
    &&(focusedInfo.meta?.reachable===true||focusedHasRoute)&&now-(focusedInfo.lastSeen||0)<45000;
  const coreSummary=runningN?`${runningN} running · ${compactCount(popN)} personas`
    :(focusedReachable?`${liveN} recent · ${compactCount(popN)} personas`:`offline · ${compactCount(popN)} cached personas`);
  upsertCore(effectiveFocus,cx,cy,coreSummary,{fresh:focusedReachable||runningN>0,focused:!!S.kernelFocus});
  [...svg._cores.children].forEach((core)=>{ if(!coreIds.has(core.getAttribute('data-kernel-core'))) core.remove(); });
  const hot=_hotPersonas();
  const n=persons.length||1;
  // In a dense projection, keep roughly ten evenly-spaced labels plus every
  // active/recent/followed endpoint. The remaining exact nodes stay keyboard
  // focusable and retain their full native tooltip; hiding colliding text does
  // not hide a persona or imply the bounded graph is complete.
  const labelStride=Math.max(1,Math.ceil(n/10));
  const labeledKeys=new Set(persons.filter((p,i)=>n<=18||i%labelStride===0
    ||p.running||p.live||hot.has(p.key)||S.follow===p.key).map((p)=>p.key));
  persons.forEach((p,i)=>{ const ang=(-Math.PI/2)+(i*2*Math.PI/n);
    p.x=+(cx+Math.cos(ang)*rx).toFixed(1); p.y=+(cy+Math.sin(ang)*ry).toFixed(1);
    S.nodePos.set(p.key,{x:p.x,y:p.y,kernel:effectiveFocus}); });
  if(graphScope) graphScope.textContent=String(effectiveFocus).replace(/^kernel:/,'');
  if(graphWindow) graphWindow.textContent=`${persons.length} of ${compactCount(popN)} personas`;
  if(graphCap) graphCap.textContent='exact actor→recipient links only · pulses travel observed direction · select a persona to follow';
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
  const posOf=new Map(persons.map((p)=>[p.key,p]));
  const traffic=_personaTraffic(posOf);   // "a|b" -> {a,b,n}  (a<b canonical; n = recent acts over this channel)
  let lk='';
  for(const t of traffic.values()){
    const A=posOf.get(t.a), B=posOf.get(t.b); if(!A||!B) continue;
    const {qx,qy}=_chordCtl(A.x,A.y,B.x,B.y,18+Math.min(t.n,6)*4);
    const w=(1.4+Math.min(t.n,8)*0.5).toFixed(2);
    const op=(0.40+Math.min(t.n,8)*0.06).toFixed(2);
    lk+=`<path d="M${A.x} ${A.y} Q${qx} ${qy} ${B.x} ${B.y}" class="cl cl-direct" `
       +`style="stroke-width:${w};opacity:${op}"/>`;
  }
  svg._chords.innerHTML=lk;   // resting chords only — fire pulses live in the sibling cg-linkfire layer
  // axons (persistent, one per sid kernel→persona) — fired imperatively by _fireEdge
  const liveKeys=new Set(persons.map((p)=>_domEntityKey(p.key)));
  persons.forEach((p)=>{ const domKey=_domEntityKey(p.key);
    let ax=svg._axons.querySelector(`[data-axon="${cssEsc(domKey)}"]`);
    if(!ax){ ax=_svg('line',{},'axon'); ax.setAttribute('data-axon',domKey);
      ax.addEventListener('animationend',()=>ax.setAttribute('class','axon')); svg._axons.appendChild(ax); }
    ax.setAttribute('x1',cx); ax.setAttribute('y1',cy); ax.setAttribute('x2',p.x); ax.setAttribute('y2',p.y); });
  [...svg._axons.children].forEach((ax)=>{ if(!liveKeys.has(ax.getAttribute('data-axon'))) ax.remove(); });
  // nodes — KEYED upsert so breathing persists; only touch what changed
  persons.forEach((p)=>{ const domKey=_domEntityKey(p.key);
    let g=svg._nodes.querySelector(`[data-gp="${cssEsc(domKey)}"]`);
    if(!g){ g=_svg('g',{},''); g.setAttribute('data-gp',domKey); g.setAttribute('data-pid',p.sid);
      g.setAttribute('tabindex','0'); g.setAttribute('role','button');   // keyboard-focusable map node
      g.appendChild(_svg('title',{}));   // native SVG hover tooltip (full untruncated name — first child)
      g.appendChild(_svg('circle',{r:11},'gn-c'));
      g.appendChild(_svg('circle',{r:14},'gn-ring'));
      g.appendChild(_svg('text',{y:-17},'gn-name'));
      g.appendChild(_svg('text',{y:4},'gn-role'));
      g.appendChild(_svg('text',{y:25},'gn-do'));
      svg._nodes.appendChild(g); }
    const cls=`gnode ${_coordRoleClass(p.role)}${p.running?' gn-running':p.live?' gn-live':''}${hot.has(p.key)?' gn-hot':''}${S.follow===p.key?' gn-followed':''}`;
    if(g.getAttribute('class')!==cls) g.setAttribute('class',cls);   // toggle only on change → no anim restart
    g.style.setProperty('--persona-hue',String(_personaAvatarHue(p.key)));
    g.setAttribute('transform',`translate(${p.x},${p.y})`);
    g.setAttribute('aria-label',`${p.name||'persona'} — ${p.role}${p.live?', live: '+(p.doing||''):', idle'} (press Enter to follow)`);
    // full untruncated hover tooltip — the on-screen name is clipped to 10 chars
    const ttl=`${p.name||'persona'} — ${p.role} · ${p.running?(p.doing||'active'):(p.live?'active':'idle')}`;
    if(g.children[0].textContent!==ttl) g.children[0].textContent=ttl;
    const nm=labeledKeys.has(p.key)
      ?(p.name&&p.name.length>11?p.name.slice(0,10)+'…':(p.name||'')):'';
    if(g.children[3].textContent!==nm) g.children[3].textContent=nm;
    const rl=p.role===_ROLE_NOT_DECLARED?'?':(p.role[0]||'?').toUpperCase(); if(g.children[4].textContent!==rl) g.children[4].textContent=rl;
    const dn=p.running?(p.doing||'').slice(0,16):''; if(g.children[5].textContent!==dn) g.children[5].textContent=dn; });
  [...svg._nodes.children].forEach((g)=>{ if(!liveKeys.has(g.getAttribute('data-gp'))) g.remove(); });
  // drop reused fire-pulse paths whose endpoints left the graph (keeps the persistent
  // linkfire layer from accumulating orphans referencing positions that no longer exist)
  [...svg._linkfire.children].forEach((p)=>{ const [f,tt]=(p.getAttribute('data-link')||'').split('>');
    if(!liveKeys.has(f)||!liveKeys.has(tt)) p.remove(); });
}
const cssEsc=(s)=>(window.CSS&&CSS.escape)?CSS.escape(String(s)):String(s).replace(/["\\]/g,'\\$&');

// fire a traveling pulse along a persona's kernel-edge (and flash its node) —
// called when a NEW coordination act names that persona (staggered). The axon is
// a reused element; we restart its one-shot travel by reflow + class re-add.
// dir makes the honest kernel-mediated flow legible: 'out' = persona reporting BACK to the
// kernel (dash travels persona→core); else (inbound) the kernel routing work TO the persona
// (dash travels core→persona, the default). Same axon, opposite keyframe — no new geometry.
function _fireEdge(personaKey,cls,dir){
  if(RM) { _flashNode(personaKey,cls); return; }
  const svg=$('#sysGraph'); if(!svg||!svg._axons) return;
  const ax=svg._axons.querySelector(`[data-axon="${cssEsc(_domEntityKey(personaKey))}"]`); if(!ax) return;
  ax.setAttribute('class','axon'); void ax.getBoundingClientRect();
  ax.setAttribute('class','axon fire'+(dir==='out'?' out':'')+(cls&&cls!=='coord'?' fire-'+cls:''));
  _flashNode(personaKey,cls);
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
  const id=_domEntityKey(fromSid)+'>'+_domEntityKey(toSid);
  let p=svg._linkfire.querySelector(`[data-link="${cssEsc(id)}"]`);
  if(!p){ p=_svg('path',{},'cl-fire'); p.setAttribute('data-link',id);
    p.addEventListener('animationend',()=>p.setAttribute('class','cl-fire')); svg._linkfire.appendChild(p); }
  p.setAttribute('d',`M${A.x} ${A.y} Q${qx} ${qy} ${B.x} ${B.y}`);
  p.setAttribute('class','cl-fire'); void p.getBoundingClientRect();
  p.setAttribute('class','cl-fire fire'+(cls&&cls!=='coord'?' fire-'+cls:''));
}
function _flashNode(sid,cls,failed){
  const svg=$('#sysGraph'); if(!svg||!svg._nodes) return;
  const g=svg._nodes.querySelector(`[data-gp="${cssEsc(_domEntityKey(sid))}"]`); if(!g) return;
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
  const scopedHeartbeat=heartbeatForScope();
  const running=!!scopedHeartbeat&&scopedHeartbeat.running!==false;
  // advance one sample/frame: baseline heartbeat blip + the strongest queued spike
  _vitalPhase+=1;
  let sample=0, col='#21d07a';
  const beatFrames=Math.max(40,Math.round((scopedHeartbeat?.interval_s||5)*60/3)); // visible blip cadence
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
  expireLivePresence();
  const box=$('#stats'); if(!box) return;
  if(!box.dataset.built){ box.dataset.built='1';
    box.innerHTML=['auth','personas','active','envs','acts','signed'].map((k)=>{
      const lbl={auth:'access',personas:'personas',active:'running',envs:'envs',acts:'acts/min',signed:'signed recs'}[k];
      const init=k==='auth'?'discover':'0';
      // the RUNNING counter is the page's hero runtime metric: personas with
      // fresh model-call growth only. Non-LLM coordination is counted in acts/min.
      return `<div class="stat${k==='active'?' primary':''}" id="st-${k}"><div class="v">${init}</div><div class="k">${lbl}</div></div>`;
    }).join(''); }
  const setV=(id,val)=>{ const el=$(id); if(!el) return; const v=el.querySelector('.v');
    if(v.textContent!==String(val)){ v.textContent=val; v.classList.remove('flash'); void v.offsetWidth; v.classList.add('flash'); } };
  const livePersona=[...S.liveByPersona.entries()].filter(([personaKey,d])=>
    kernelIsFocused(d?.kernel)&&verifiedPersonaRenderable(
      S.personaDiscoveryByKey, personaKey,
    )).length;
  const recPersonaKeys=new Set();
  for(const id of S.order){ const r=S.recs.get(id);
    if(r?.kind!=='persona'||!kernelIsFocused(r._kernel)) continue;
    const sid=_shortId(r.did||r.record_id), personaKey=sid?_personaKey(r._kernel,sid):'';
    if(personaKey&&verifiedPersonaRenderable(
      S.personaDiscoveryByKey,personaKey)) recPersonaKeys.add(personaKey);
  }
  const recPersona=recPersonaKeys.size;
  const personasN=Math.max(livePersona,recPersona);
  const now=Date.now();
  // RUNNING = personas currently named by active_model_calls.
  // Coordination-only traffic stays in acts/min so "running" always means LLM.
  const activeBases=[...(S.activeModelCallsByBase||new Map()).entries()].filter(([base])=>baseIsFocused(base==='@origin'?'':base));
  const active=new Set(activeBases.flatMap(([base,calls])=>{ const kernel=kernelForBase(base==='@origin'?'':base);
    return (calls||[]).map((call)=>{ const sid=_shortId(call?.persona_id);
      return sid?_personaKey(call?.kernel_id||kernel,sid):''; }).filter(Boolean); })).size;
  const acts=(S.interactions||[]).filter((e)=>now-e._t<60000&&kernelIsFocused(e._kernel||kernelForBase(e._base))).length;
  // "verified" counts ONLY Ed25519-verified records (S.recs all pass verifyRecord);
  // unverified live interactions are NOT signed and must never inflate this.
  const signed=S.order.filter((id)=>kernelIsFocused(S.recs.get(id)?._kernel)).length;
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  setV('#st-auth',hasOp?'read':'discover');
  const authEl=$('#st-auth'); if(authEl){ authEl.classList.toggle('auth-read',hasOp);
    authEl.title=hasOp?'operator token saved — read-level views unlocked':'anonymous — discover-level public projection only'; }
  setV('#st-personas',compactCount(personasN)); setV('#st-active',compactCount(active)); setV('#st-envs',compactCount(S.envCount));
  $('#st-active')?.classList.toggle('hot',active>0);   // hero treatment lights up only while work streams
  setV('#st-acts',compactCount(acts)); setV('#st-signed',compactCount(signed));
  // verify badge live count
  const vb=$('#verifybadge'); if(vb) vb.title=`${S.recs.size} signed discovery record(s) Ed25519-verified in this browser. Workspace snapshot signatures and opened-file hashes are checked separately. Raw operator-status runtime frames remain labelled unsigned transport telemetry; whole-document-signed public telemetry, messages, and routes retain their verified labels.`;
  // livedot beats ONLY while a real node heartbeat is running (no decorative pulse)
  const dot=$('#livedot'); if(dot){ const heartbeat=heartbeatForScope(); const beating=!!(heartbeat&&heartbeat.running!==false);
    dot.classList.toggle('beating',beating);
    dot.title=beating?'live — node heartbeat running':'no live node heartbeat';
    dot.setAttribute('aria-label',beating?'node heartbeat live':'node idle'); }
}

let _sysBusy=false, _sysQueued=false;
async function refreshSystemView(){
  const host=$('#sysEnvs'); if(!host) return;
  if(_sysBusy){ _sysQueued=true; return; }
  // re-entrancy guard (mirrors _cogBusy): the 5s interval fires this unconditionally,
  // and its many serial awaited fetches can overrun the interval on a slow link, so
  // invocations would otherwise overlap and stack duplicate fetches + full rebuilds.
  _sysBusy=true;
  try{
  // Structure: a bounded monitoring window of bases → their visible env feeds.
  // Selected and actively-running bases rank first; the global population stays
  // represented by aggregates in the navigator instead of being polled en masse.
  // Live entity feeds belong to a bootstrapped node. The static portal origin is
  // not an implicit node base: include it only when discovery actually admitted
  // an `@origin` bootstrap document.
  const allBases=[...new Set(S.boots?S.boots.keys():[])];
  const bases=allBases.filter((key)=>{ const base=key==='@origin'?'':key; return baseIsFocused(base); })
    .sort((a,b)=>((S.activeModelCallsByBase?.get(b)||[]).length-(S.activeModelCallsByBase?.get(a)||[]).length))
    .slice(0,NETWORK_LIMITS.monitoredBases);
  const envBlocks=[];          // {kernel, envId, sid, name, type, status, members[], run, recId, live}
  const assigned=new Set();
  const bySid=new Map();        // kernel\0sid -> block; short ids alone may collide globally
  const envKey=(kernel,sid)=>String(kernel||'@unknown')+'\u0000'+String(sid||'');
  // (1) LIVE-telemetry environments — rich: members, status, lineage spans.
  const liveGroups=await Promise.all(bases.map(async(key)=>{ const base=key==='@origin'?'':key;
    const ent=await fetchEntityFeed(base,'telemetry/live/entities.json'); if(!ent) return [];
    const kernel=(S.boots.get(key)||{}).kernel_id||base||'@origin';
    const rows=Object.entries(ent.environments||{}).slice(0,NETWORK_LIMITS.environmentInitial*4);
    return (await Promise.all(rows.map(async([eid,rel])=>{
      const feed=await fetchEntityFeed(base,rel); if(!feed) return null;
      const members=(feed.members||[]).map((member)=>{
        const raw=member&&typeof member==='object'?(member.persona_id||member.id):member;
        const memberSid=_shortId(raw); return memberSid?_personaKey(kernel,memberSid):'';
      }).filter((personaKey)=>verifiedPersonaRenderable(
        S.personaDiscoveryByKey, personaKey,
      ));
      const sid=_shortId(eid);
      return {base,kernel,envId:eid,sid,name:feed.name||eid,type:feed.env_type||'',
        status:feed.status||'',members,spans:feed.spans||[],feedDoc:feed,run:null,
        recId:null,live:true,verified:false};
    }))).filter(Boolean);
  }));
  for(const rows of liveGroups) for(const b of rows){ const k=envKey(b.kernel,b.sid), prev=bySid.get(k);
    b.members.forEach((m)=>assigned.add(m));
    if(prev){ if(b.members.length>prev.members.length) prev.members=b.members;
      prev.spans=b.spans||prev.spans; prev.feedDoc=b.feedDoc||prev.feedDoc;
      if(!prev.status) prev.status=b.status||''; if(!prev.type) prev.type=b.type||''; continue; }
    bySid.set(k,b); envBlocks.push(b);
  }
  // (2) Every DISCOVERED + Ed25519-verified environment record — so each public
  // environment can show on the stage even without a live feed. A record
  // that matches a live env enriches that lane (run id for the deliverable join);
  // one with no live feed becomes its own lane.
  for(const id of S.order){ const r=S.recs.get(id); if(r.kind!=='env'||!kernelIsFocused(r._kernel)) continue;
    const sid=_envSid(r); const run=runForEnv(r); const exportRel=(r._links||{}).export;
    const manifestRel=(r._links||{}).artifact_manifest;
    const cap=(r.capability_summary||[]).filter((c)=>c&&c!=='project_workspace');
    const k=envKey(r._kernel,sid); let b=bySid.get(k);
    if(b){ b.recId=b.recId||id; b.run=b.run||run; b.verified=true; if(b.name===b.envId) b.name=r.label||b.name;
      if(!b.type&&cap.length) b.type=cap[cap.length-1]; if(!b.exportRel) b.exportRel=exportRel;
      if(!b.artifactManifestRel) b.artifactManifestRel=manifestRel; }
    else { b={base:r._base||'',kernel:r._kernel||'',envId:r.did||sid,sid,
        name:r.label||sid,type:cap[cap.length-1]||'env',status:'',members:[],spans:[],
        run,recId:id,live:false,verified:true,exportRel,artifactManifestRel:manifestRel};
      bySid.set(k,b); envBlocks.push(b); }
  }
  // (2b) An env whose LIVE feed is absent (a federated env, or any env whose live
  // telemetry dropped after a node RESTART) still has its signed, durable export doc
  // (links.export → environments/<id>.json) carrying its full member ROSTER. Pull it
  // so the personas that worked in the env still SHOW in the env (members + count),
  // instead of a "no members" lane — the env's people don't vanish on restart.
  S.observedEnvironmentCount=envBlocks.length;
  const prefetchLimit=Math.min(512,Math.max(40,S.environmentWindow*3));
  let prefetchWindow=selectPriorityWindow(envBlocks,{
    query:S.q||'',limit:prefetchLimit,keyOf:(b)=>envKey(b.kernel,b.sid),
    priorityOf:(b)=>(b.live?1e6:0)+(b.status==='active'?1e5:0)+Math.min(9999,b.members.length),
    searchTextOf:(b)=>`${b.kernel} ${b.name} ${b.type} ${b.status} ${b.members.map((m)=>_nameFor(m,b.kernel)).join(' ')}`,
  });
  // A query may target an export-only persona whose roster is not loaded yet.
  // Keep a bounded activity window as a legacy fallback; cursor-aware servers
  // can answer that query directly without this client probing every env.
  if(S.q&&!prefetchWindow.items.length) prefetchWindow=selectPriorityWindow(envBlocks,{
    limit:prefetchLimit,keyOf:(b)=>envKey(b.kernel,b.sid),priorityOf:(b)=>(b.live?1e6:0)+b.members.length,
  });
  envBlocks.length=0; envBlocks.push(...prefetchWindow.items);
  await Promise.all(envBlocks.map(async(b)=>{
    let ed=null;
    if(b.exportRel) ed=await fetchEntityFeed(b.base,b.exportRel);
    if(ed&&Array.isArray(ed.members)&&!b.members.length){
      b.roster=ed.members;
      b.members=ed.members.map((m)=>{ const memberSid=_shortId(m.persona_id||m.id||'');
        return memberSid?_personaKey(b.kernel,memberSid):''; }).filter((personaKey)=>
        verifiedPersonaRenderable(S.personaDiscoveryByKey,personaKey));
      b.members.forEach((m)=>assigned.add(m));
      if(!b.status) b.status=ed.status||'';
      b.fromExport=true;
    }
    const manifestRel=b.artifactManifestRel||(ed&&ed.artifact_manifest)||'';
    if(manifestRel){
      const mf=await fetchEntityFeed(b.base,manifestRel);
      if(mf&&Array.isArray(mf.artifacts)){
        b.artifactManifestRel=manifestRel;
        b.artifactManifest=mf;
      }
    }
  }));
  // Redacted environment feeds may intentionally omit their roster. Associate a
  // persona with a shared environment only when live model or interaction
  // telemetry explicitly names that environment; this is observed ownership,
  // not a guessed join from display names.
  for(const [personaKey,d] of S.liveByPersona){
    let sid=String([...(d.models||[])].reverse().find((m)=>m.environment)?.environment||'');
    if(!sid){ const hit=[...(S.ixByPersona?.get(personaKey)||[])].reverse().find((e)=>e.scope==='environment'&&e.scope_id);
      sid=_shortId(hit?.scope_id||''); }
    if(!sid) continue;
    const ref=_personaRef(personaKey), block=bySid.get(envKey(d.kernel||ref.kernel,sid));
    if(block&&verifiedPersonaRenderable(S.personaDiscoveryByKey,personaKey)
      &&!block.members.includes(personaKey)){ block.members.push(personaKey); assigned.add(personaKey); block.memberSource='observed telemetry'; }
  }
  S.envCount=envBlocks.length;
  // personas known live but not in any env feed → a node-roster lane
  const orphans=[...S.liveByPersona.entries()].filter(([personaKey,d])=>{ const ref=_personaRef(personaKey);
    return kernelIsFocused(d?.kernel||ref.kernel)&&!assigned.has(personaKey)
      &&verifiedPersonaRenderable(S.personaDiscoveryByKey,personaKey);
  }).map(([personaKey])=>personaKey);
  // refresh the friendly-name map from discovered persona records
  for(const id of S.order){ const r=S.recs.get(id); if(r.kind==='persona'){
    const sid=_shortId(r.did||r.record_id); if(r.label) _PERSONA_NAME.set(_personaKey(r._kernel,sid),r.label); } }
  // Artifacts join to an exact verified environment reference first. A run path
  // is only a compatibility join when exactly ONE observed environment owns
  // that run. With multiple hosts we surface routing pressure and attach the
  // artifact to none of them; activity/array order never fabricates a winner.
  const artByEnv=new Map();
  const artByPersona=new Map();
  const runHosts=new Map();
  // Resolve legacy run-path joins against the complete verified record cache,
  // not only the visible card window. A paginated-away second host must still
  // make the run ambiguous.
  for(const id of S.order){ const envRecord=S.recs.get(id);
    if(envRecord?.kind!=='env'||!kernelIsFocused(envRecord._kernel)) continue;
    const envRun=runForEnv(envRecord); if(!envRun) continue;
    const rk=envKey(envRecord._kernel,envRun);
    (runHosts.get(rk)||runHosts.set(rk,new Set()).get(rk))
      .add(envKey(envRecord._kernel,_envSid(envRecord)));
  }
  for(const b of envBlocks){ if(!b.run) continue; const rk=envKey(b.kernel,b.run);
    (runHosts.get(rk)||runHosts.set(rk,new Set()).get(rk))
      .add(envKey(b.kernel,b.sid)); }
  const unresolvedArtifacts=[];
  for(const id of S.order){ const r=S.recs.get(id);
    if(r.kind!=='artifact'||!kernelIsFocused(r._kernel)) continue;
    const authority=environmentAuthorityOfRecord(r);
    let target='';
    if(authority.status==='resolved') target=envKey(r._kernel,authority.environmentId);
    else if(authority.status==='absent'){
      const run=runOf(r);
      const runResolution=resolveUniqueRunEnvironment(
        run?[...(runHosts.get(envKey(r._kernel,run))||[])]:[],
      );
      if(runResolution.status==='resolved') target=runResolution.environmentKey;
      else if(runResolution.status==='ambiguous') unresolvedArtifacts.push({record:r,
        authority:{status:'ambiguous',reason:'project_host_choice',candidates:runResolution.candidates}});
    }else unresolvedArtifacts.push({record:r,authority});
    if(target) (artByEnv.get(target)||artByEnv.set(target,[]).get(target)).push(r);
    const owner=_shortId(r._access?.owner_persona_id||'');
    if(owner&&!target){ const pk=_personaKey(r._kernel,owner);
      (artByPersona.get(pk)||artByPersona.set(pk,[]).get(pk)).push(r); }
  }
  const envArtifacts=(b)=>artByEnv.get(envKey(b.kernel,b.sid))||[];
  const envManifestFiles=(b)=>manifestArtifacts(b&&b.artifactManifest);
  const envHasArtifacts=(b)=>envManifestFiles(b).length>0||envArtifacts(b).length>0;
  const liveWorkspacesByPersona=new Map(), liveWorkspacesByEnv=new Map();
  for(const state of S.liveArtifacts.values()){
    const snap=state?.snapshot||{};
    for(const ws of (snap.workspaces||[])){
      const workspaceId=String(ws.workspace_id||''), personaId=_shortId(ws.persona_id||''), environmentId=_shortId(ws.environment_id||'');
      const workspaceFiles=[...state.files.values()].filter((f)=>String(f.workspace_id||'')===workspaceId);
      const fileCount=workspaceFiles.length;
      const authored=[...new Set(workspaceFiles.flatMap((file)=>authoredArtifactLabels(file)))].slice(0,8);
      const row={base:state.base,run:state.run,workspaceId,fileCount,authored,state:ws.state||'live',
        generatedAt:String(snap.generated_at||'')};
      if(personaId){ const pk=_personaKey(snap.node_id||kernelForBase(state.base),personaId);
        (liveWorkspacesByPersona.get(pk)||liveWorkspacesByPersona.set(pk,[]).get(pk)).push(row); }
      if(environmentId){ const ek=envKey(snap.node_id||kernelForBase(state.base),environmentId);
        (liveWorkspacesByEnv.get(ek)||liveWorkspacesByEnv.set(ek,[]).get(ek)).push(row); }
    }
  }

  // presence rank for in-lane ordering: running-now (0) → live/model-bearing (1) → idle (2),
  // so the one persona actually working floats to the top of its lane instead of sitting in
  // raw roster order. Hoisted so the orphan lane sorts the same way.
  const _rank=(value,kernel='')=>{ const ref=_personaRef(value,kernel);
    const live=((S.liveByPersona.get(ref.key)||{}).models||[]).length>0;
    return _runningNow(ref.key)?0:(live?1:2); };
  const _personaPriority=(value,kernel='')=>{ const ref=_personaRef(value,kernel);
    const d=S.liveByPersona.get(ref.key)||{}, rt=runtimeForPersona(ref.key)||{};
    return (_runningNow(ref.key)?1e8:0)+(_rank(ref.key)===1?1e7:0)
      +(rt.task_execution_state==='paused_participant'?5e6:0)+Math.min(9999,(S.ixCountBySid?.get(ref.key)||0)); };
  const _personaSearch=(value,kernel='')=>{ const ref=_personaRef(value,kernel);
    const d=S.liveByPersona.get(ref.key)||{}, s=d.summary||{}, rt=runtimeForPersona(ref.key)||{};
    return `${ref.sid} ${ref.kernel} ${_nameFor(ref.key)} ${s.name||''} ${s.role||''} ${s.lifecycle_state||''} ${rt.task_execution_state||''}`; };
  // first-seen deliverable ids → mint-flash a chip the moment it ships (not on every poll,
  // and not the whole set on cold load); mirrors the ixColdLoaded pattern.
  S.seenArts=S.seenArts||new Set();
  const envOutputContext=(b)=>{
    const manifestFiles=envManifestFiles(b);
    const arts=envArtifacts(b);
    const bundles=arts.filter((a)=>a._links&&a._links.bundle);
    // file cards carry content_stub/content_hash (the public projection), not always a
    // raw `content` link — count any of them so the bundle chip shows a real file count.
    const fileCount=manifestFiles.length||arts.filter((a)=>{ const L=a._links||{};
      return L.content||L.content_stub||L.content_hash; }).length;
    // env-meta file count EXCLUDES the bundle wrapper (its own content_hash) so the
    // headline agrees with the deliverable chip's "N files" instead of overcounting.
    const metaFiles=manifestFiles.length||arts.filter((a)=>{ const L=a._links||{};
      return (L.content||L.content_stub||L.content_hash)&&!(L.bundle); }).length;
    const manifestBundleId=(b.artifactManifest&&b.artifactManifest.current_bundle_id)||'';
    const manifestAuthored=[...new Set(manifestFiles.flatMap((item)=>authoredArtifactLabels(item)))].slice(0,8);
    const artifactRows=bundles.length?bundles:arts;
    const liveEnvRows=liveWorkspacesByEnv.get(envKey(b.kernel,b.sid))||[];
    const liveEnvOutputs=_liveWorkspacesHTML(liveEnvRows,{label:'Live shared worktree',scope:'environment worktree'});
    const liveFileCount=liveEnvRows.reduce((total,row)=>total+(Number(row.fileCount)||0),0);
    const artRow=liveEnvOutputs||(artifactRows.length
      ?_ownedOutputsHTML(artifactRows,{label:'Shared outputs',scope:'environment worktree'})
      :(manifestFiles.length?`<section class="owned-outputs env-owned-outputs"><div class="owned-outputs-head"><span>Shared outputs</span><small>environment worktree</small></div>`
        +`<button type="button" class="owned-output ds-amber" data-envrec="${esc(b.sid)}" data-envkernel="${esc(b.kernel)}"><span class="owned-output-icon">${icon('box','ico-sm')}</span>`
        +`<span class="owned-output-copy"><b>${esc(manifestBundleId||'Current workspace')}</b><small>${fileCount} file${fileCount===1?'':'s'}${manifestAuthored.length?` · authored: ${esc(manifestAuthored.join(' · '))}`:''}</small></span>${icon('chevron','ico-sm')}</button></section>`:''));
    const departed=b.fromExport && (b.roster||[]).length>0 && (b.roster||[]).every((m)=>m&&m.active===false);
    const statusTxt=departed?'archived':(b.status||(b.live?'—':'discovered'));
    const statusOk=(b.status==='active' && !departed);
    return {artRow,departed,statusTxt,statusOk,
      metaFiles:liveEnvRows.length?liveFileCount:metaFiles};
  };
  const environmentCardHTML=(b)=>{ const output=envOutputContext(b), liveRow=renderEnvLaneLive(b);
    const network=_environmentCommunicationGraphHTML(b);
    const membershipRow=b.members.length?'':'<div class="env-card-empty">awaiting members</div>';
    const type=String(b.type||'workspace').replace(/_/g,' '), words=String(b.name||'workspace').trim().split(/\s+/).filter(Boolean);
    const initials=(words.length>1?(words[0][0]+words[words.length-1][0]):words[0]?.slice(0,2)||'EN').toUpperCase();
    const cardId=String(b.sid||b.envId||'').replace(/^env:/,'').slice(-10).toUpperCase();
    return `<article class="env-card" data-envsid="${esc(b.sid)}" data-envkernel="${esc(b.kernel)}" style="--envhue:${_envHue(b.sid)}" aria-label="environment ${esc(b.name)}">`
      +`<div class="env-card-foil" aria-hidden="true"></div><header class="env-card-profile">`
      +`<div class="env-card-avatar"><span class="env-card-glyph">${icon('box')}</span><strong>${esc(initials)}</strong></div>`
      +`<div class="env-identity"><span class="env-kicker">WORKSPACE LOCATION · ${esc(type)}</span>`
      +`<span class="env-name" data-envrec="${esc(b.sid)}" data-envkernel="${esc(b.kernel)}" role="button" tabindex="0">${esc(b.name)}</span>`
      +`<span class="env-card-id">${esc(cardId||'WORKSPACE')}</span></div>`
      +`<span class="env-state ${output.statusOk?'ok':''}">${esc(output.statusTxt)}</span></header>`
      +`<section class="env-card-stats" aria-label="workspace facts">`
      +`<span>${icon('persona_new','ico-sm')}<b>${b.members.length}</b><small>${output.departed?'contributors':'people'}</small></span>`
      +`<span>${icon('dot','ico-sm')}<b>${network.activeCount}</b><small>working</small></span>`
      +`<span>${icon('arrow','ico-sm')}<b>${network.eventCount}</b><small>signals · 5m</small></span>`
      +`<span>${icon('box','ico-sm')}<b>${output.metaFiles||0}</b><small>files</small></span>`
      +`</section>${membershipRow}${network.html}${liveRow}${output.artRow}<div class="env-card-footer"><span>${b.live?(b.verified?'live telemetry + verified identity':'unsigned live telemetry'):'verified record'}</span><span>environment-owned outputs</span></div></article>`;
  };
  // (3) Preserve every exact environment identity. Shared titles, rosters,
  // tasks, or run references are observations, never authority to collapse one
  // signed context into another.
  const _kept=envBlocks.slice();
  // (4) SORT lanes by activity so running/deliverable-bearing environments lead.
  // Stable sort keeps signed empty environments visible while placing them last.
  const _score=(b)=> (_envLaneLive(b).fresh?8:0)
    + (b.members.some((m)=>_runningNow(m,b.kernel))?4:0)
    + (b.members.some((m)=>(S.liveByPersona.get(_personaRef(m,b.kernel).key)||{}).models)?2:0)
    + (envHasArtifacts(b)?1:0);
  _kept.sort((a,b)=>_score(b)-_score(a));
  // Every verified environment record is an authoritative workspace identity.
  // Missing live roster/artifact telemetry means "not observed yet", never
  // permission to erase the signed environment card from the stage.
  const _baseCandidates=_kept;
  const query=String(S.q||'').trim();
  const _envMatches=(b)=>!query||`${b.kernel} ${b.name} ${b.type} ${b.status}`.toLowerCase().includes(query)
    ||b.members.some((sid)=>_personaSearch(sid,b.kernel).toLowerCase().includes(query))
    ||envArtifacts(b).some((a)=>`${a.label||''} ${a.description||''} ${authoredArtifactLabelText(a)}`.toLowerCase().includes(query))
    ||envManifestFiles(b).some((a)=>`${a.title||a.path||''} ${authoredArtifactLabelText(a)}`.toLowerCase().includes(query))
    ||(liveWorkspacesByEnv.get(envKey(b.kernel,b.sid))||[]).some((row)=>(row.authored||[]).join(' ').toLowerCase().includes(query));
  const envCandidates=query?_baseCandidates.filter(_envMatches):_baseCandidates;
  const envWindow=selectPriorityWindow(envCandidates,{
    limit:Math.min(120,S.environmentWindow),keyOf:(b)=>envKey(b.kernel,b.sid),priorityOf:_score,
  });
  envBlocks.length=0; envBlocks.push(...envWindow.items);
  S.envCount=Math.max(S.observedEnvironmentCount||0,_baseCandidates.length);
  S.renderedEnvironmentKeys=new Set(envBlocks.map((b)=>envKey(b.kernel,b.sid)));
  // Personas are a primary deck, never children of environment cards. Each
  // persona receives the exact environments whose roster or telemetry names it.
  const personaContexts=new Map();
  const ensurePersona=(value,kernel='')=>{ const ref=_personaRef(value,kernel);
    if(!ref.sid||!verifiedPersonaRenderable(S.personaDiscoveryByKey,ref.key)) return null;
    let context=personaContexts.get(ref.key); if(!context){ context={key:ref.key,kernel:ref.kernel,environments:[]}; personaContexts.set(ref.key,context); }
    return context; };
  for(const b of _baseCandidates) for(const member of b.members){ const context=ensurePersona(member,b.kernel); if(!context) continue;
    if(!context.environments.some((env)=>envKey(env.kernel,env.sid)===envKey(b.kernel,b.sid)))
      context.environments.push({sid:b.sid,kernel:b.kernel,name:b.name,status:b.status,live:b.live,score:_score(b)}); }
  for(const personaKey of orphans) ensurePersona(personaKey);
  // A newly born persona may have a verified lifecycle envelope before it has
  // joined an environment or emitted telemetry. Keep that honest materialising
  // card discoverable instead of waiting for an unrelated roster side effect.
  for(const personaKey of S.personaDiscoveryByKey.keys()){
    const ref=_personaRef(personaKey);
    if(kernelIsFocused(ref.kernel)) ensurePersona(personaKey);
  }
  const personaCandidates=[...personaContexts.values()].filter((context)=>!query
    ||_personaSearch(context.key).toLowerCase().includes(query)
    ||context.environments.some((env)=>`${env.name} ${env.status}`.toLowerCase().includes(query))
    ||(artByPersona.get(context.key)||[]).some((a)=>`${a.label||''} ${a.description||''} ${authoredArtifactLabelText(a)}`.toLowerCase().includes(query))
    ||(liveWorkspacesByPersona.get(context.key)||[]).some((row)=>(row.authored||[]).join(' ').toLowerCase().includes(query)));
  const deckKey='@persona-deck', deckLimit=progressiveGroupLimit(deckKey,S.personaWindows,{
    initial:NETWORK_LIMITS.personaInitial,step:NETWORK_LIMITS.personaStep,max:240,
  });
  const personaWindow=selectPriorityWindow(personaCandidates,{
    limit:deckLimit,keyOf:(context)=>context.key,priorityOf:(context)=>_personaPriority(context.key),
  });
  S.visiblePersonaIds.clear(); personaWindow.items.forEach((context)=>S.visiblePersonaIds.add(context.key));
  const personaCards=personaWindow.items.map((context)=>renderPersonaCard(context.key,context.kernel,{
    environments:context.environments.slice().sort((a,b)=>b.score-a.score),
    artifacts:artByPersona.get(context.key)||[],liveWorkspaces:liveWorkspacesByPersona.get(context.key)||[],
  })).join('');
  const hiddenPersonas=Math.max(0,personaWindow.matched-personaWindow.returned);
  const morePersonas=hiddenPersonas?`<div class="persona-window-note"><span>showing ${personaWindow.returned} of ${personaWindow.matched} matching personas</span>`
    +`<button type="button" class="window-more" data-more-personas="${encodeURIComponent(deckKey)}">show ${Math.min(NETWORK_LIMITS.personaStep,hiddenPersonas)} more</button></div>`:'';
  const personaSection=personaCards?`<section class="persona-section"><header class="stage-section-head"><div><span class="section-kicker">PERSONA DECK</span>`
    +`<h2>People doing the work</h2></div><p>Each card owns its identity, portrait, activity and personal worktree.</p></header>`
    +`<div class="persona-deck">${personaCards}</div>${morePersonas}</section>`:'';
  const environmentCards=envBlocks.map(environmentCardHTML).join('');
  const environmentSection=environmentCards?`<section class="environment-section"><header class="stage-section-head compact"><div><span class="section-kicker">ENVIRONMENT INDEX</span>`
    +`<h2>Shared workspaces</h2></div><p>Open a workspace for its shared state and environment-scoped outputs.</p></header>`
    +`<div class="environment-grid">${environmentCards}</div></section>`:'';
  S.artsColdLoaded=true;
  const hiddenEnvs=Math.max(0,envCandidates.length-envBlocks.length,
    query?0:(S.observedEnvironmentCount||0)-envBlocks.length);
  const bodyHTML=personaSection+environmentSection;
  const visiblePersonaCount=S.visiblePersonaIds.size;
  const summary=bodyHTML?`<div class="stage-summary"><div><strong>${compactCount(visiblePersonaCount)} ${visiblePersonaCount===1?'persona':'personas'} on screen</strong>`
    +` <span class="scope-copy">· ${compactCount(S.envCount)} environments</span></div>`
    +(hiddenEnvs?`<button type="button" class="window-more" data-more-environments="1">show ${Math.min(NETWORK_LIMITS.environmentStep,hiddenEnvs)} more environments</button>`:'')
    +`</div>`:'';
  const routingPressure=unresolvedArtifacts.length
    ?`<div class="routing-pressure" role="status"><strong>${icon('warn','ico-sm')} Environment routing unresolved</strong>`
      +`<span>${unresolvedArtifacts.length} signed artifact${unresolvedArtifacts.length===1?'':'s'} ${unresolvedArtifacts.length===1?'has':'have'} multiple or conflicting environment contexts. No environment was selected; the artifact remains visible only as unresolved routing pressure.</span>`
      +`<span class="routing-pressure-items">${unresolvedArtifacts.slice(0,4).map(({record,authority})=>
        `<span><b>${esc(record.label||record.record_id||'artifact')}</b> · ${esc((authority.candidates||[]).length)} candidate${(authority.candidates||[]).length===1?'':'s'}</span>`).join('')}`
      +`${unresolvedArtifacts.length>4?`<span>+${unresolvedArtifacts.length-4} more</span>`:''}</span></div>`:'';
  let html=summary+routingPressure+bodyHTML;
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
  rebindInspectionSource();
  _hydratePersonaAvatars();
  _applyFollow();
  // Focused graph selection is independent of card pagination: running/recent
  // personas remain visible even if their card is outside the current window.
  const graphIds=[...new Set([..._baseCandidates.flatMap((b)=>b.members),...orphans])]
    .filter((personaKey)=>kernelIsFocused(S.liveByPersona.get(personaKey)?.kernel||splitNetworkKey(personaKey)?.kernelId||S.kernelFocus));
  const personRows=graphIds.map((personaKey)=>{ const ref=_personaRef(personaKey);
    const sid=ref.sid, d=S.liveByPersona.get(personaKey)||{}; const s=d.summary||{};
    const models=d.models||[]; const last=models[models.length-1];
    const acts=(S.ixByPersona&&S.ixByPersona.get(personaKey))||[];
    const recentAct=_latestPersonaActivityForRecency(acts);
    const recent=_modelFresh(personaKey,models)||!!(recentAct&&(Date.now()-recentAct._t)<90000);
    return {key:personaKey,sid,kernel:d.kernel||ref.kernel,name:_signedPersonaNameFor(personaKey),
      role:_coordRole(sid,s,ref.kernel),live:recent,running:_runningNow(personaKey),
      doing:last?(PURPOSE_VERB[last.purpose]||last.purpose):''}; });
  const graphWindow=selectPriorityWindow(personRows,{query:S.q||'',limit:NETWORK_LIMITS.graphPersonasFocused,
    keyOf:(p)=>p.key,priorityOf:(p)=>(p.running?1e8:0)+(p.live?1e7:0)+(S.ixCountBySid?.get(p.key)||0),
    searchTextOf:(p)=>`${p.sid} ${p.kernel} ${p.name} ${p.role} ${p.doing}`});
  renderCoordGraph(graphWindow.items,personRows.length);
  renderInteractionStream();
  updateVitalsCounters();
  if(S.q) _applyFilter();   // re-apply the active filter after the 5s stage/feed rebuild
  }finally{ _sysBusy=false;
    if(_sysQueued){ _sysQueued=false; Promise.resolve().then(()=>refreshSystemView()).catch(()=>{}); } }
}
// per-env accent hue (stable, from the design palette) for the lane border/badge
const _ENV_HUES=['#19c39a','#3aa0ff','#a779e6','#f0a73a','#ff5fa2'];
function _envHue(sid){ let h=0; const s=String(sid||''); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return _ENV_HUES[h%_ENV_HUES.length]; }
// persona-follow: dim cards + feed rows that aren't the followed persona
function _applyFollow(){
  const f=S.follow;
  const fdom=_domEntityKey(f);
  document.querySelectorAll('.pcard').forEach((el)=>{ el.classList.toggle('dimmed',!!f&&el.dataset.pkey!==fdom);
    el.querySelector('.pc-follow')?.setAttribute('aria-pressed',String(el.dataset.pkey===fdom)); });
  const ff=$('#cfFollow'); if(ff){ ff.hidden=!f; const lbl=ff.querySelector('.dim'); if(lbl&&f) lbl.textContent='following '+_nameFor(f); }
  // light up the followed node in the constellation too (card/feed-initiated follows
  // should give the graph the same selected feedback as clicking a node directly).
  const g=$('#sysGraph'); if(g){ g.classList.toggle('has-follow',!!f);
    g.querySelectorAll('[data-gp]').forEach((n)=>n.classList.toggle('gn-followed',n.dataset.gp===fdom)); }
}

// the live COORDINATION FEED — the heartbeat of who→whom:what. Newest slides in
// at the top (.fresh); adjacent acts sharing a real scope_id get a per-task
// THREAD SPINE so you can watch one task ripple produce→verify→ship. The kernel
// is rendered as the honest mediator — we NEVER draw a persona→persona arrow the
// data doesn't contain; only explicit recipient/affected endpoints create a link.
function renderInteractionStream(){
  const el=$('#sysStream'); if(!el) return;
  const flt=S.sysFlt||'all';
  const now=Date.now(), leaseMs=5*60*1000;
  const scoped=(S.interactions||[]).filter((e)=>kernelIsFocused(e._kernel||kernelForBase(e._base)));
  const all=scoped.filter((e)=>e._t>0&&now-e._t<=leaseMs&&e._t-now<30000);
  S.ixSeen=S.ixSeen||new Set();   // _keys already painted (so only genuinely-new rows .fresh in)
  const rows=all.filter((e)=>{ const c=_ixClass(e.kind,e);
    if(flt==='all') return true;
    if(flt==='think') return c==='think';
    if(flt==='coord') return c==='coord';
    if(flt==='verify') return c==='verify';
    if(flt==='crossenv') return c==='crossenv';
    if(flt==='artifact') return c==='artifact';
    if(flt==='tool') return c==='tool';
    return true; }).slice(-120).reverse();
  const f=S.follow;
  const matches=(e)=>!f|| (e.actor_kind==='persona'&&_eventPersonaKey(e,e.actor_id)===f)
    || _personaEndpoints(e).some((a)=>_eventPersonaKey(e,a.id)===f);
  let prevScope=null;
  // preserve the reader's scroll position across the wholesale innerHTML rebuild: newest
  // rows are prepended at top (rows are .reverse()'d), so when not pinned to the top, add
  // the grown height so the rows being read stay stationary; at the top, leave it pinned.
  const atTop=el.scrollTop<=4, prevH=el.scrollHeight, prevTop=el.scrollTop;
  el.innerHTML=rows.map((e)=>{
    const c=_ixClass(e.kind,e); const cap=e._cap||null; const fail=_ixFailed(e.kind)||(!!cap&&cap.ok===false);
    const eventKernel=_eventKernel(e);
    const who=e.actor_kind==='persona'?_nameFor(e.actor_id,eventKernel):(e.actor_id?`${esc(e.actor_kind)}:${esc((e.actor_id||'').slice(0,10))}`:esc(e.actor_kind||'kernel'));
    const aff=_eventEndpoints(e).map((a)=>a.kind==='persona'?_nameFor(a.id,eventKernel):a.kind==='model'?`model:${a.id||''}`:`${a.kind}:${(a.id||'').slice(0,8)}`);
    const recipientCount=Number.isSafeInteger(e._recipientCount)&&e._recipientCount>0?e._recipientCount:0;
    const targetLabel=recipientCount?`${recipientCount} recipient${recipientCount===1?'':'s'}`:aff.join(', ');
    const arrow=targetLabel?`<span class="ix-arrow">→</span><span class="ix-to">${esc(targetLabel)}</span>`:'';
    const fresh=!S.ixSeen.has(e._key); if(fresh) S.ixSeen.add(e._key);
    // thread spine when this row shares a real scope_id with the one above it
    const sid=e.scope_id&&/[:/]/.test(String(e.scope_id))?String(e.scope_id):null;
    const threaded=sid&&sid===prevScope; prevScope=sid;
    const spine=threaded?`<span class="ix-spine${fresh?' grow':''}" style="--thread:${_threadHue(sid)}"></span>`:'';
    // read the row like a live MESSAGE: "<persona> <verb> → <to> · <detail>".
    const verb=_ixHeadline(e);
    const msg=e._msg?`<span class="ix-msg">${esc(e._msg)}</span>`:'';
    const trust=_eventTrustHTML(e);
    const provenance=_activityProvenanceHTML(e._provenance);
    // capability/tool detail from the backend _cap projection: WHICH capability + its error
    const capDetail=cap&&(cap.capability||cap.tool_name)
      ?`<span class="ix-cap">${esc(cap.capability||cap.tool_name)}${cap.ok===false&&cap.error?' · '+esc(String(cap.error).split('\n')[0].slice(0,90)):''}</span>`:'';
    const rationaleTitle=e._exactText?_cognitionPreview(e._exactText):e._rationale;
    const ttl=rationaleTitle?` title="${esc(rationaleTitle)}"`:(cap&&cap.error?` title="${esc(cap.error)}"`:'');
    return `<li class="ix ix-${c}${fail?' fail':''}${fresh?' fresh':''}${threaded?' threaded':''}${(f&&!matches(e))?' dimmed':''}"${ttl}>`
      +spine+`<span class="ix-kind">${_ixGlyph(c)}${esc(verb)}</span>`
      +`<span class="ix-from">${esc(who)}</span>${arrow}${msg}${capDetail}${trust}`
      +`<span class="ix-scope">${esc((e.scope==='cognition'||e.scope==='model')?'':e.scope||'')}</span>${provenance}`
      +`<span class="ix-time">${_eventTimeHTML(e)}</span></li>`;
  }).join('')||(()=>{
    // A node may publish a signed public-cognition tier. Private nodes answer the
    // same anonymous probe with 404, so an empty THINK feed must stay neutral: the
    // browser cannot infer whether the persona is quiet or its cognition is private.
    if(flt==='think' && Object.keys((typeof opTokens==='function'?opTokens():{})).length===0)
      return '<li class="l2" style="padding:10px">no signed public cognition in the last 5 minutes — this node may be quiet or keep its cognition private.</li>';
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
    return '<li class="l2" style="padding:10px">no '+esc(q)+'activity in the last 5 minutes — fund or resume a mission to watch personas coordinate.</li>';
  })();
  if(!atTop) el.scrollTop=prevTop+(el.scrollHeight-prevH);
  // headline count must match what the reader sees: the grand total only for the
  // default all+no-follow view, else the shown (tab-filtered, follow-matching) count.
  const r=$('#sysStreamRate'); if(r){
    const narrowed=(flt!=='all')||!!f;
    const shown=f?rows.filter(matches).length:rows.length;
    r.textContent=narrowed?`${shown} of ${all.length} recent acts`:`${all.length} recent acts · 5m window`;
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
  const v=await fetchJson(join(base,rel));
  if(v&&typeof v==='object'){
    await verifyPublicCommunicationRoutes(base,v);
    if(isPublicEntityTelemetryDocument(v)||isPublicEntityIndexDocument(v)){
      const verified=await verifyPublicEntityDocument(base,rel,v);
      if(!verified){
        const refusalKey=`${base||'@origin'}\u0000public_entity_signature_invalid`;
        const last=S.telemetryRefusals.get(refusalKey)||0;
        if(Date.now()-last>10000){
          S.telemetryRefusals.set(refusalKey,Date.now());
          log('telemetry',`${base||'@origin'}: refused invalid public entity-feed signature`,false);
        }
        m.set(key,{v:null,ts:Date.now()}); return null;
      }
    }
    _ingestVerifiedEntityRoutes(base,v);
  }
  m.set(key,{v,ts:Date.now()}); return v;
}
function _ingestVerifiedEntityRoutes(base,doc){
  const routes=publicCommunicationRouteEvents(VERIFIED_COMMUNICATION_ROUTES.get(doc)||[]);
  if(!routes.length) return 0;
  const kernel=kernelForBase(base)||String(doc?.kernel_id||doc?.node_id||'@unknown');
  S.interactions=S.interactions||[]; S.ixKeys=S.ixKeys||new Set(); let added=0;
  for(const event of routes){
    const aff=_eventEndpoints(event).map((endpoint)=>`${endpoint.kind}:${endpoint.id}`).join(',');
    const key=`${base}|${event.scope_id}|${event.actor_id}|${aff}|${event.kind}|${event.at||event.event_id}`;
    if(S.ixKeys.has(key)) continue;
    const rec={...event,signed:true,_base:base,_kernel:kernel,
      _t:Date.parse(event.at||'')||Date.now(),_key:key,
      _provenance:{event:String(event.event_id||''),environment:String(event.environment_id||''),
        at:String(event.at||'')},
      _trustLabel:'PERSONA + LINEAGE SIGNED ROUTE',
      _trustTitle:'persona-authored route and kernel lineage signatures independently verified'};
    S.ixKeys.add(key); S.interactions.push(rec); added++;
    try{ NETWORK.ingestEvent({...event,kernel_id:kernel,event_id:event.event_id||key}); }catch(_){ }
  }
  if(added){
    S.interactions.sort((a,b)=>a._t-b._t);
    if(S.interactions.length>400) S.interactions=S.interactions.slice(-400);
    S.ixKeys=new Set(S.interactions.map((event)=>event._key));
    _refreshPersonaInteractionIndex();
  }
  return added;
}
function feedModels(doc){ return telemetryModelEvents(doc).filter((m)=>(m.kind||'')==='MODEL_SELECTED')
  .map((m)=>({purpose:String(m.requested_purpose||m.role||'model'),model:String(m.model_id||'—'),role:String(m.role||'')})); }
// Callers admit public documents through their current-master verification gate
// before reaching this renderer. Keep every signed status row distinct: the
// current public contract has no event ID with which identical calls could be merged.
function _verifiedPublicModelStatusHTML(doc){
  const events=telemetryModelEvents(doc); if(!events.length) return '<div class="l2">no model status published</div>';
  return events.slice(-16).reverse().map((event)=>{
    const provenance=_publicModelEventProvenance(event,doc.generated_at);
    const missing=[['model id',provenance.model],['call id',provenance.call],['run id',provenance.run],
      ['task id',provenance.task],['event id',provenance.event],['event timestamp',provenance.at]]
      .filter(([,value])=>!value).map(([label])=>label);
    const trust=_eventTrustHTML({signed:true,_trustLabel:'KERNEL SIGNED SNAPSHOT',
      _trustTitle:'model-status entry in the verified kernel-signed public telemetry document'});
    return `<div class="think"><span class="amber">${esc(_ixVerb(event.kind||'MODEL_EVENT'))}</span>`
      +([provenance.status,Number.isFinite(event.latency_ms)?`${event.latency_ms} ms`:null]
        .filter(Boolean).length?` · ${esc([provenance.status,Number.isFinite(event.latency_ms)?`${event.latency_ms} ms`:null].filter(Boolean).join(' · '))}`:'')
      +_activityProvenanceHTML(provenance,{className:'think-provenance',prepend:trust,full:true})
      +(missing.length?`<div class="l2">not published for this event: ${esc(missing.join(', '))}</div>`:'')+`</div>`;
  }).join('');
}
function renderPersonaFeedDoc(doc,personaKey=''){
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
  if(s.task_execution_state||s.llm_execution_state){
    h+=`<div class="sublabel">Runtime state · unsigned status telemetry</div>`
      +kv('Task execution',esc(s.task_execution_state||'unmarked'))
      +kv('LLM execution',esc(s.llm_execution_state||'unmarked'));
  }
  const ref=_personaRef(personaKey||doc.persona_id||'');
  const running=_activeModelCallsForPersona(ref.key).length>0;
  const projected=projectTerminalModelFailures(telemetryModelEvents(doc));
  const feedFailure=projected.byPersona.get(doc.persona_id)||projected.latest;
  const indexedFailure=S.liveByPersona.get(ref.key)?.terminalFailure||null;
  const terminalFailure=running?null:(indexedFailure||feedFailure||null);
  if(terminalFailure) h+=`<div class="sublabel">Terminal execution status</div>`
    +_terminalModelFailureHTML(terminalFailure);
  h+=`<div class="sublabel">${isPublicEntityTelemetryDocument(doc)?'Verified model status':running?'Doing now':'Model selection history'}</div>`
    +(isPublicEntityTelemetryDocument(doc)?_verifiedPublicModelStatusHTML(doc)
      :_liveFeed(feedModels(doc),{historical:!running}));
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
  h+=`<div class="sublabel">Model activity in this env <span class="dim">(own feed)</span></div>`
    +(isPublicEntityTelemetryDocument(doc)?_verifiedPublicModelStatusHTML(doc):_liveFeed(feedModels(doc)));
  return h;
}
// ---- persona public activity (02_PERSONA §4/§8-10) ----
// A node can opt its bounded persona activity projection into the public tier.
// Anonymous viewers accept only the exact current-master-signed schema below.
// Persona-signed final output remains distinct from closed, kernel-observed
// provisional provider events; the exact thinking FRAME remains operator-only.
function renderThinking(t,{allowThinkingFrame=false,kernel=''}={}){
  let h='';
  const publicCognition=t.schema==='personaos-persona-public-cognition/1';
  const calls=t.active_calls||[];
  const callsById=new Map(calls.map((call)=>[call.call_id,call]));
  const taskRunCache=new Map();
  const resolveTaskRun=(runKernel,task)=>{
    const key=`${runKernel}\u0000${task}`;
    if(!taskRunCache.has(key)) taskRunCache.set(key,_verifiedPublicTaskRun(runKernel,task));
    return taskRunCache.get(key);
  };
  if(calls.length){
    h+=`<div class="l2" style="margin:2px 0 3px">Active model calls — verified current snapshot</div>`
      +calls.slice(-8).reverse().map((call)=>{
        const started=Date.parse(String(call.started_at||''));
        const purpose=String(call.requested_purpose||'').trim()||'purpose not declared';
        const signedMeta=publicCognition?_activityProvenanceHTML(_publicCallProvenance(call),{
          className:'think-provenance',full:true,prepend:_eventTrustHTML({signed:true,
            _trustLabel:'KERNEL SIGNED ACTIVE CALL',
            _trustTitle:'active model call in the verified current kernel-signed public cognition snapshot'})}):'';
        return `<div class="think"><span class="amber">${esc(call.status||'active')}</span> ${esc(purpose)}`
          +`<div class="l2"><code>${esc(call.model_id||'model not declared')}</code>`
          +(call.reasoning_effort?` · reasoning ${esc(call.reasoning_effort)}`:'')
          +(Number.isFinite(started)?` · started ${esc(_ago(started))}`:'')+`</div>`
          +((call.task_id||call.run_id)?`<div class="l2">${call.task_id?`task ${esc(call.task_id)}`:''}${call.task_id&&call.run_id?' · ':''}${call.run_id?`run ${esc(call.run_id)}`:''}</div>`:'')
          +signedMeta+`</div>`;
      }).join('');
  }
  const provisional=publicCognition?(t.provisional_outputs||[]):[];
  if(provisional.length){
    const provisionalStart=Math.max(0,provisional.length-24);
    const visibleProvisional=provisional.slice(provisionalStart)
      .map((event,offset)=>({event,index:provisionalStart+offset}));
    h+=`<div class="privacy-note">Live provider stream — kernel-observed and provisional, not persona-signed cognition or hidden reasoning.</div>`
      +visibleProvisional.map(({event,index})=>{
        const call=callsById.get(event.call_id);
        const provenance=_publicProvisionalProvenance(event,call);
        const signedMeta=_activityProvenanceHTML(provenance,{className:'think-provenance',full:true,
          prepend:_eventTrustHTML({signed:true,_trustLabel:'KERNEL OBSERVED · PROVISIONAL',
            _trustTitle:'verified kernel-signed public snapshot; provisional provider event, not persona-signed cognition or hidden reasoning'})});
        const callMeta=`<div class="l2"><code>${esc(event.model_id||'model not declared')}</code>`
          +`${event.call_id?` · call ${esc(event.call_id)}`:''} · sequence ${esc(event.sequence)}`
          +(event.kind==='assistant_message'?` · chunk ${esc(event.chunk_index+1)}/${esc(event.chunk_count)}`:'')
          +`</div>${signedMeta}`;
        if(event.kind==='assistant_message'){
          return `<div class="think llmout copy-host"><span class="amber">provisional assistant message</span> ${copyBtn()}`
            +`<pre class="ct-pre copy-src" data-provisional-output-index="${index}"></pre>${callMeta}</div>`;
        }
        const subject=event.kind==='tool_status'
          ?[event.tool_type,event.tool_name,event.server].filter(Boolean).join(' · ')
          :'provider turn';
        return `<div class="think"><span class="amber">${esc(String(event.kind||'status').replace(/_/g,' '))}</span> ${esc(event.status||'')}`
          +(subject?` · ${esc(subject)}`:'')+callMeta+`</div>`;
      }).join('');
  }
  const out=t.recent_outputs||[];
  if(out.length){
    const outputStart=Math.max(0,out.length-12);
    const visibleOutputs=out.slice(outputStart)
      .map((output,offset)=>({output,index:outputStart+offset})).reverse();
    h+=`<div class="l2" style="margin:2px 0 3px">${publicCognition?'Signed outputs and messages':'Recent authored output'} (newest first)</div>`
      +visibleOutputs.map(({output:o,index})=>{
        const recipients=Array.isArray(o.audience_persona_ids)?o.audience_persona_ids.length:0;
        const trust=publicCognition?_publicOutputTrust(o):null;
        const publicMeta=publicCognition
          ? `<div class="l2">${recipients?`${recipients} addressed recipient${recipients===1?'':'s'}`:'no addressed recipients'}</div>`
            +_activityProvenanceHTML(_publicOutputProvenance(o,kernel,resolveTaskRun),{className:'think-provenance',full:true,
              prepend:_eventTrustHTML({signed:true,_trustLabel:trust.label,_trustTitle:trust.title})})
          : '';
        return `<div class="think llmout copy-host"><span class="amber">${esc(o.kind||'output')}</span> ${copyBtn()}`
          +`<pre class="ct-pre copy-src" data-thinking-output-index="${index}"></pre>${publicMeta}</div>`;
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
    h+=`<div class="l2" style="margin:6px 0 3px">${publicCognition?'Signed lessons in current public state':'Lessons it learned — its own words'}</div>`
      +lessons.slice(-10).reverse().map((l)=>
        `<div class="think"><span class="amber">when</span> ${esc(l.trigger||'—')} <span class="amber">→</span> ${esc(l.action||'')}`
        +(l.rationale?`<div class="l2">${esc(String(l.rationale).slice(0,260))}</div>`:'')
        +`<div class="l2">confidence ${esc(Number(l.confidence||0).toFixed(2))}</div></div>`).join('');
  }
  const tactics=t.tactics||[];
  if(tactics.length){
    h+=`<div class="l2" style="margin:6px 0 3px">${publicCognition?'Signed tactics in current public state':'Evolved tactics (EVOLVE-BLOCK · GEPA-signed)'}</div>`
      +tactics.slice(-10).reverse().map((x)=>
        `<div class="think">${esc(String(x.action||x.trigger||'').slice(0,300))}`
        +`<div class="l2">${esc(x.source||'manual')} · score ${esc(Number(x.score||0).toFixed(2))} · v${esc(x.version||1)}${x.cohort?' · '+esc(x.cohort):''}</div></div>`).join('');
  }
  const facts=t.proven_facts||[];
  if(facts.length){
    h+=`<div class="l2" style="margin:6px 0 3px">${publicCognition?'Signed proven facts in current public state':'Shared proven facts it holds'}</div>`
      +facts.slice(-6).reverse().map((s)=>`<div class="think l2">${esc(String(s).slice(0,220))}</div>`).join('');
  }
  const tl=t.evolution_timeline||[];
  if(tl.length){
    h+=`<div class="l2" style="margin:6px 0 3px">${publicCognition?'Signed evolution timeline':'Cognition timeline (signed evolution log)'}</div><div class="tape-mini">`
      +tl.slice(-20).reverse().map((e)=>
        `<div class="row2"><span class="l2">${esc(e.kind||'')}</span><span>${esc(e.mode||'')}</span>`
        +`<span class="${e.accepted===true?'ok':e.accepted===false?'down':'l2'}">${e.accepted===true?icon('check'):e.accepted===false?icon('x'):''}</span></div>`).join('')+`</div>`;
  }
  if(allowThinkingFrame&&t.thinking_frame)
    h+=`<details class="frame"><summary class="l2">thinking frame — the exact prompt it generates under (SOUL + evolved tactics + retrieved knowledge)</summary>`
      +`<div class="copy-host">${copyBtn()}<pre class="opout copy-src">${esc(t.thinking_frame)}</pre></div></details>`;
  return h||'<div class="l2">no cognition recorded yet</div>';
}
function hydrateThinkingOutputText(host,doc){
  const outputs=Array.isArray(doc?.recent_outputs)?doc.recent_outputs:[];
  for(const target of host.querySelectorAll('[data-thinking-output-index]')){
    const index=Number(target.dataset.thinkingOutputIndex);
    const text=Number.isSafeInteger(index)&&index>=0&&index<outputs.length
      ?outputs[index]?.text:'';
    target.textContent=typeof text==='string'?text:String(text??'');
  }
  const provisional=Array.isArray(doc?.provisional_outputs)?doc.provisional_outputs:[];
  for(const target of host.querySelectorAll('[data-provisional-output-index]')){
    const index=Number(target.dataset.provisionalOutputIndex);
    const text=Number.isSafeInteger(index)&&index>=0&&index<provisional.length
      ?provisional[index]?.text:'';
    target.textContent=typeof text==='string'?text:String(text??'');
  }
}
function renderThinkingRedacted(doc){
  let h='<div class="privacy-note">Detailed cognition is private. This view shows verified state transitions only.</div>';
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
const PUBLIC_PERSONA_COGNITION_FIELDS=Object.freeze([
  'active_calls','evolution_timeline','generated_at','identity_fields',
  'identity_materialization_state','lessons','lifecycle_state','name','persona_id',
  'proven_facts','provisional_outputs','recent_outputs','schema','signature_hex','signing_key_id','tactics','tier',
].sort());
const PUBLIC_PERSONA_OUTPUT_FIELDS=Object.freeze([
  'at','audience_persona_ids','authority','author_persona_id','environment_id','kind','text',
].sort());
const PUBLIC_PERSONA_EXACT_OUTPUT_FIELDS=Object.freeze([
  ...PUBLIC_PERSONA_OUTPUT_FIELDS,
  'authored_output','persona_authority','persona_authority_hash',
].sort());
const PUBLIC_PERSONA_AUTHORED_OUTPUT_FIELDS=Object.freeze([
  'schema','sha256','text','utf8_bytes',
].sort());
const PUBLIC_PERSONA_COGNITIVE_AUTHORITY_FIELDS=Object.freeze([
  'authored_at','completion_readiness','environment_id','intent','intent_id',
  'mission_task_id','persona_id','persona_signature','schema','self_wake','signing_key_id',
  'task_id','wake_dedupe_key','wake_event_id',
].sort());
const PUBLIC_PERSONA_COMMUNICATION_AUTHORITY_FIELDS=Object.freeze([
  'addressed_to','authored_by','communication_id','environment_id','parent_communication_hash',
  'parent_communication_id','payload','provenance','schema','signed_by','signing_key_id',
].sort());
const PUBLIC_PERSONA_ACTIVE_CALL_FIELDS=Object.freeze([
  'call_id','model_id','persona_id','provisional_events','reasoning_effort','requested_purpose','run_id',
  'started_at','status','task_id',
].sort());
const PUBLIC_PROVISIONAL_BASE_FIELDS=Object.freeze([
  'at','authority','kind','persona_signed','provisional','schema','sequence',
].sort());
const PUBLIC_PROVISIONAL_BINDING_FIELDS=Object.freeze([
  'call_id','model_id','persona_id',
].sort());
const PUBLIC_PROVISIONAL_KINDS=new Set([
  'assistant_message','provider_status','tool_status',
]);
const PUBLIC_PROVISIONAL_PROVIDER_STATUSES=new Set([
  'turn_completed','turn_failed','turn_started',
]);
const PUBLIC_PROVISIONAL_TOOL_STATUSES=new Set([
  'completed','failed','started',
]);
const PUBLIC_PERSONA_LESSON_FIELDS=Object.freeze([
  'action','confidence','rationale','trigger',
].sort());
const PUBLIC_PERSONA_TACTIC_FIELDS=Object.freeze([
  'action','cohort','score','source','trigger','version',
].sort());
const PUBLIC_PERSONA_EVOLUTION_FIELDS=Object.freeze([
  'accepted','at','kind','mode','task_id',
].sort());
const PUBLIC_PERSONA_OUTPUT_AUTHORITIES=new Set(['persona_signature','signed_lineage']);
const PUBLIC_PERSONA_ACTION_OUTPUT_KIND='PERSONA_ACTION_AUTHORED';
const PUBLIC_PERSONA_LINEAGE_OUTPUT_KINDS=new Set([
  'ANSWER_DRAFTED','CANDIDATE_PRODUCED','CANDIDATE_REPAIRED',PUBLIC_PERSONA_ACTION_OUTPUT_KIND,
]);
const PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND='PERSONA_COMMUNICATION_AUTHORED';
const PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND='PERSONA_COGNITIVE_INTENT';
const PUBLIC_PERSONA_EXACT_OUTPUT_KINDS=new Set([
  PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND,PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND,
]);
const PUBLIC_PERSONA_COGNITION_INSTANT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const PUBLIC_PERSONA_COGNITION_LIMITS=Object.freeze({
  activeCalls:8,outputs:12,lessons:10,tactics:10,facts:6,evolution:20,audience:64,
  provisionalEvents:128,provisionalTextCodePoints:16*1024,
  atom:512,lineageText:4096,exactTextBytes:512*1024,documentBytes:4*1024*1024,
});
const PUBLIC_PERSONA_AUTHORITY_SIGNATURE_CACHE=new Map();
function _safePublicCognitionText(value,maximum,{required=false}={}){
  if(typeof value!=='string'||value.length>maximum||(required&&!value.trim())) return false;
  for(let index=0;index<value.length;index++){
    const code=value.charCodeAt(index);
    if((code<0x20&&code!==0x09&&code!==0x0a&&code!==0x0d)||code===0x7f) return false;
  }
  return true;
}
function _safePublicCognitionAtom(value,maximum=PUBLIC_PERSONA_COGNITION_LIMITS.atom,{required=false}={}){
  if(!_safePublicCognitionText(value,maximum,{required})||value.trim()!==value) return false;
  for(let index=0;index<value.length;index++){
    const code=value.charCodeAt(index); if(code<=0x20||code===0x7f) return false;
  }
  return true;
}
function _safePublicCognitionInstant(value,{required=true}={}){
  return _safePublicCognitionAtom(value,64,{required})
    &&(!value||(PUBLIC_PERSONA_COGNITION_INSTANT.test(value)&&Number.isFinite(Date.parse(value))));
}
function _publicProvisionalEventFields(event,{bound=false}={}){
  const fields=[...PUBLIC_PROVISIONAL_BASE_FIELDS];
  if(event?.kind==='assistant_message'){
    fields.push('chunk_count','chunk_index','sha256','text','utf8_bytes');
    if(Object.prototype.hasOwnProperty.call(event,'message_id')) fields.push('message_id');
  }else if(event?.kind==='provider_status') fields.push('status');
  else if(event?.kind==='tool_status'){
    fields.push('status','tool_type');
    for(const field of ['server','tool_name'])
      if(Object.prototype.hasOwnProperty.call(event,field)) fields.push(field);
  }
  if(bound) fields.push(...PUBLIC_PROVISIONAL_BINDING_FIELDS);
  return fields.sort();
}
function _safePublicProvisionalStateToken(value){
  return typeof value==='string'&&value.length>=1&&value.length<=180
    &&value.trim()===value&&/^[A-Za-z0-9:_.@/+\-]+$/.test(value)
    &&!value.startsWith('/')&&!value.startsWith('./')&&!value.startsWith('../')
    &&!value.startsWith('~/')&&!value.includes('/../')&&!/^[A-Za-z]:\//.test(value);
}
async function _validPublicProvisionalEvent(event,{call,generatedAt}={}){
  if(!_exactObjectFields(event,_publicProvisionalEventFields(event))
      ||event.schema!=='personaos-provisional-cognition/1'
      ||event.authority!=='kernel_observed_provider_event'
      ||event.persona_signed!==false||event.provisional!==true
      ||!PUBLIC_PROVISIONAL_KINDS.has(event.kind)
      ||!Number.isSafeInteger(event.sequence)||event.sequence<1
      ||!_safePublicCognitionInstant(event.at)) return false;
  const observed=Date.parse(event.at), started=Date.parse(String(call?.started_at||''));
  const generated=Date.parse(String(generatedAt||''));
  if(!Number.isFinite(observed)||!Number.isFinite(started)||!Number.isFinite(generated)
      ||observed<started||observed>generated) return false;
  if(event.kind==='assistant_message'){
    if(typeof event.text!=='string'||!event.text
        ||[...event.text].length>PUBLIC_PERSONA_COGNITION_LIMITS.provisionalTextCodePoints
        ||!Number.isSafeInteger(event.utf8_bytes)||event.utf8_bytes<1
        ||!SHA256_CONTENT_RE.test(String(event.sha256||''))
        ||!Number.isSafeInteger(event.chunk_index)||event.chunk_index<0
        ||!Number.isSafeInteger(event.chunk_count)||event.chunk_count<1
        ||event.chunk_count>4096||event.chunk_index>=event.chunk_count
        ||(Object.prototype.hasOwnProperty.call(event,'message_id')
          &&!_safePublicProvisionalStateToken(event.message_id))) return false;
    const bytes=enc.encode(event.text);
    return bytes.length===event.utf8_bytes
      &&`sha256:${await sha256Hex(bytes)}`===event.sha256;
  }
  if(event.kind==='provider_status') return PUBLIC_PROVISIONAL_PROVIDER_STATUSES.has(event.status);
  if(!PUBLIC_PROVISIONAL_TOOL_STATUSES.has(event.status)
      ||!_safePublicCognitionText(event.tool_type,160,{required:true})
      ||event.tool_type.trim()!==event.tool_type) return false;
  for(const field of ['server','tool_name']) if(Object.prototype.hasOwnProperty.call(event,field)){
    if(!_safePublicCognitionText(event[field],240,{required:true})
        ||event[field].trim()!==event[field]) return false;
  }
  return true;
}
async function _validPublicPersonaAuthoredOutput(authored,exactText){
  if(!_exactObjectFields(authored,PUBLIC_PERSONA_AUTHORED_OUTPUT_FIELDS)
      ||authored.schema!=='personaos-persona-authored-output/1'
      ||typeof exactText!=='string'||authored.text!==exactText
      ||!Number.isSafeInteger(authored.utf8_bytes)||authored.utf8_bytes<1
      ||authored.utf8_bytes>PUBLIC_PERSONA_COGNITION_LIMITS.exactTextBytes
      ||!SHA256_CONTENT_RE.test(String(authored.sha256||''))) return false;
  const bytes=enc.encode(authored.text);
  return bytes.length===authored.utf8_bytes
    &&`sha256:${await sha256Hex(bytes)}`===authored.sha256;
}
async function _validPublicPersonaAuthority(output,identity,row){
  const authority=output.persona_authority;
  const publicKey=String(row?._personaIdentityPublicKeyHex||'').toLowerCase();
  const signingKeyId=String(row?._personaIdentitySigningKeyId||'');
  if(!authority||typeof authority!=='object'||Array.isArray(authority)
      ||!/^[0-9a-f]{64}$/.test(publicKey)||!signingKeyId
      ||!SHA256_CONTENT_RE.test(String(output.persona_authority_hash||''))
      ||`sha256:${await sha256Hex(enc.encode(canon(authority)))}`!==output.persona_authority_hash)
    return false;
  let signature='',payload=null;
  if(output.kind===PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND){
    if(!_exactObjectFields(authority,PUBLIC_PERSONA_COGNITIVE_AUTHORITY_FIELDS)
        ||authority.schema!=='personaos-persona-cognitive-intent/1'
        ||authority.persona_id!==identity.signedId
        ||authority.environment_id!==output.environment_id
        ||authority.signing_key_id!==signingKeyId
        ||!_safePublicCognitionInstant(authority.authored_at)
        ||!authority.intent||typeof authority.intent!=='object'||Array.isArray(authority.intent)
        ||canon(authority.intent.authored_output)!==canon(output.authored_output)) return false;
    signature=String(authority.persona_signature||'');
    payload={};
    for(const field of Object.keys(authority)) if(field!=='persona_signature') payload[field]=authority[field];
  }else if(output.kind===PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND){
    if(!_exactObjectFields(authority,PUBLIC_PERSONA_COMMUNICATION_AUTHORITY_FIELDS)
        ||authority.schema!=='personaos-persona-communication/1'
        ||authority.authored_by!==identity.signedId
        ||authority.environment_id!==output.environment_id
        ||authority.signing_key_id!==signingKeyId
        ||!Array.isArray(authority.addressed_to)
        ||canon(authority.addressed_to)!==canon(output.audience_persona_ids)
        ||!authority.payload||typeof authority.payload!=='object'||Array.isArray(authority.payload)
        ||canon(authority.payload.authored_output)!==canon(output.authored_output)) return false;
    signature=String(authority.signed_by||'');
    payload={};
    for(const field of Object.keys(authority)) if(field!=='signed_by') payload[field]=authority[field];
  }else return false;
  if(!/^[0-9a-f]{128}$/i.test(signature)) return false;
  const cacheKey=`${publicKey}:${output.persona_authority_hash}:${signature}`;
  if(PUBLIC_PERSONA_AUTHORITY_SIGNATURE_CACHE.get(cacheKey)===true) return true;
  let verified=false;
  try{ verified=await ed.verifyAsync(hexToBytes(signature),enc.encode(canon(payload)),hexToBytes(publicKey)); }
  catch(_){ verified=false; }
  if(verified){
    PUBLIC_PERSONA_AUTHORITY_SIGNATURE_CACHE.delete(cacheKey);
    PUBLIC_PERSONA_AUTHORITY_SIGNATURE_CACHE.set(cacheKey,true);
    while(PUBLIC_PERSONA_AUTHORITY_SIGNATURE_CACHE.size>512)
      PUBLIC_PERSONA_AUTHORITY_SIGNATURE_CACHE.delete(PUBLIC_PERSONA_AUTHORITY_SIGNATURE_CACHE.keys().next().value);
  }
  return verified;
}
function _validPublicPersonaActionText(text){
  if(typeof text!=='string'||!text
      ||enc.encode(text).length>PUBLIC_PERSONA_COGNITION_LIMITS.exactTextBytes) return false;
  try{
    const action=JSON.parse(text);
    return _exactObjectFields(action,['action','arguments'])
      &&_safePublicCognitionAtom(action.action,512,{required:true})
      &&action.arguments&&typeof action.arguments==='object'&&!Array.isArray(action.arguments)
      &&canon(action)===text;
  }catch(_){ return false; }
}
async function _validPublicPersonaOutput(output,identity,row){
  const personaExact=PUBLIC_PERSONA_EXACT_OUTPUT_KINDS.has(output?.kind);
  const actionExact=output?.kind===PUBLIC_PERSONA_ACTION_OUTPUT_KIND;
  if(!_exactObjectFields(output,personaExact?PUBLIC_PERSONA_EXACT_OUTPUT_FIELDS:PUBLIC_PERSONA_OUTPUT_FIELDS)
      ||!_safePublicCognitionAtom(output.kind,128,{required:true})
      ||!_safePublicCognitionInstant(output.at)
      ||typeof output.text!=='string'||!output.text.trim()
      ||!_safePublicCognitionAtom(output.author_persona_id,512,{required:true})
      ||output.author_persona_id!==identity.signedId
      ||!_safePublicCognitionAtom(output.environment_id,512)
      ||!PUBLIC_PERSONA_OUTPUT_AUTHORITIES.has(output.authority)
      ||!Array.isArray(output.audience_persona_ids)
      ||output.audience_persona_ids.length>PUBLIC_PERSONA_COGNITION_LIMITS.audience) return false;
  const communication=output.kind===PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND;
  if(personaExact!==(output.authority==='persona_signature')
      ||(!personaExact&&!PUBLIC_PERSONA_LINEAGE_OUTPUT_KINDS.has(output.kind))
      ||((personaExact||actionExact)&&!output.environment_id)
      ||(!communication&&output.audience_persona_ids.length)
      ||(!personaExact&&!actionExact&&!_safePublicCognitionText(output.text,
        PUBLIC_PERSONA_COGNITION_LIMITS.lineageText,{required:true}))) return false;
  const audience=new Set();
  for(const personaId of output.audience_persona_ids){
    if(!_safePublicCognitionAtom(personaId,512,{required:true})||audience.has(personaId)) return false;
    audience.add(personaId);
  }
  if(actionExact) return _validPublicPersonaActionText(output.text);
  if(!personaExact) return true;
  return await _validPublicPersonaAuthoredOutput(output.authored_output,output.text)
    &&await _validPublicPersonaAuthority(output,identity,row);
}
function _validPublicPersonaActiveCall(call,identity,generatedAt){
  return _exactObjectFields(call,PUBLIC_PERSONA_ACTIVE_CALL_FIELDS)
    &&_safePublicCognitionAtom(call.call_id,512,{required:true})
    &&_safePublicCognitionAtom(call.model_id,512,{required:true})
    &&_safePublicCognitionAtom(call.persona_id,512,{required:true})
    &&call.persona_id===identity.signedId
    &&_safePublicCognitionAtom(call.reasoning_effort,128)
    &&_safePublicCognitionText(call.requested_purpose,512)
    &&_safePublicCognitionAtom(call.run_id,512)
    &&_safePublicCognitionInstant(call.started_at)
    &&Date.parse(call.started_at)<=Date.parse(generatedAt)
    &&call.status==='running'
    &&_safePublicCognitionAtom(call.task_id,512)
    &&Array.isArray(call.provisional_events)
    &&call.provisional_events.length<=PUBLIC_PERSONA_COGNITION_LIMITS.provisionalEvents;
}
function _validPublicPersonaLesson(lesson){
  return _exactObjectFields(lesson,PUBLIC_PERSONA_LESSON_FIELDS)
    &&_safePublicCognitionText(lesson.trigger,4096)
    &&_safePublicCognitionText(lesson.action,4096,{required:true})
    &&_safePublicCognitionText(lesson.rationale,4096)
    &&typeof lesson.confidence==='number'&&Number.isFinite(lesson.confidence)
    &&lesson.confidence>=0&&lesson.confidence<=1;
}
function _validPublicPersonaTactic(tactic){
  return _exactObjectFields(tactic,PUBLIC_PERSONA_TACTIC_FIELDS)
    &&_safePublicCognitionText(tactic.trigger,4096)
    &&_safePublicCognitionText(tactic.action,4096,{required:true})
    &&typeof tactic.score==='number'&&Number.isFinite(tactic.score)&&Math.abs(tactic.score)<=1000000
    &&_safePublicCognitionAtom(tactic.source,256)
    &&Number.isSafeInteger(tactic.version)&&tactic.version>=1&&tactic.version<=1000000000
    &&_safePublicCognitionAtom(tactic.cohort,256);
}
function _validPublicPersonaEvolution(event){
  return _exactObjectFields(event,PUBLIC_PERSONA_EVOLUTION_FIELDS)
    &&_safePublicCognitionAtom(event.kind,128,{required:true})
    &&_safePublicCognitionInstant(event.at,{required:false})
    &&_safePublicCognitionAtom(event.mode,256)
    &&(event.accepted===null||typeof event.accepted==='boolean')
    &&_safePublicCognitionAtom(event.task_id,512);
}
function _currentInventoryPersona(kernel,pid){
  const personaKey=_personaKey(kernel,pid), row=S.personaDiscoveryByKey.get(personaKey);
  const inventory=S.providerInventories.get(String(kernel||''));
  return row&&inventory&&row._inventorySource===kernel
    &&row._inventoryGeneration===inventory.generation&&row._inventoryHash===inventory.hash
    &&verifiedPersonaRenderable(S.personaDiscoveryByKey,personaKey)?row:null;
}
async function verifyPublicPersonaCognition(base,doc,{personaId,kernel}={}){
  const pid=_shortId(personaId), row=_currentInventoryPersona(kernel,pid);
  const identity=signedPersonaIdentity(row);
  if(!row||!identity||identity.canonicalId!==pid
      ||!_exactObjectFields(doc,PUBLIC_PERSONA_COGNITION_FIELDS)
      ||doc.schema!=='personaos-persona-public-cognition/1'||doc.tier!=='public'
      ||String(doc.persona_id||'')!==identity.signedId||!_safePublicCognitionInstant(doc.generated_at)
      ||!_freshPublicGeneratedAt(doc.generated_at)
      ||!_safePublicCognitionAtom(doc.persona_id,512,{required:true})
      ||!_safePublicCognitionText(doc.name,512,{required:true})
      ||!_safePublicCognitionAtom(doc.lifecycle_state,64,{required:true})
      ||!_safePublicCognitionAtom(doc.identity_materialization_state,64,{required:true})
      ||String(doc.name||'')!==String(row._personaSignedName||'')
      ||!Array.isArray(doc.active_calls)||doc.active_calls.length>PUBLIC_PERSONA_COGNITION_LIMITS.activeCalls
      ||!Array.isArray(doc.provisional_outputs)
      ||doc.provisional_outputs.length>PUBLIC_PERSONA_COGNITION_LIMITS.provisionalEvents
      ||!Array.isArray(doc.recent_outputs)||doc.recent_outputs.length>PUBLIC_PERSONA_COGNITION_LIMITS.outputs
      ||!Array.isArray(doc.lessons)||doc.lessons.length>PUBLIC_PERSONA_COGNITION_LIMITS.lessons
      ||!Array.isArray(doc.tactics)||doc.tactics.length>PUBLIC_PERSONA_COGNITION_LIMITS.tactics
      ||!Array.isArray(doc.proven_facts)||doc.proven_facts.length>PUBLIC_PERSONA_COGNITION_LIMITS.facts
      ||!Array.isArray(doc.evolution_timeline)||doc.evolution_timeline.length>PUBLIC_PERSONA_COGNITION_LIMITS.evolution) return false;
  if(!await verifyCurrentMasterSignedDocument(base,doc)) return false;
  const lifecycle=personaLifecycleProjection(S.personaDiscoveryByKey,_personaKey(kernel,pid));
  if(!lifecycle||doc.lifecycle_state!==lifecycle.lifecycleState
      ||doc.identity_materialization_state!==lifecycle.materializationState
      ||!doc.identity_fields||typeof doc.identity_fields!=='object'||Array.isArray(doc.identity_fields)
      ||Object.keys(doc.identity_fields).sort().join('\u0000')!=='avatar\u0000characteristics\u0000name') return false;
  for(const field of ['name','characteristics','avatar']){
    const value=doc.identity_fields[field], expected=lifecycle.identityFields[field];
    if(!_exactObjectFields(value,['persona_authored','state'])
        ||value.state!==expected.state||value.persona_authored!==expected.personaAuthored) return false;
  }
  const callIds=new Set(), callsById=new Map(), flattenedProvisional=[];
  for(const call of doc.active_calls){
    if(!_validPublicPersonaActiveCall(call,identity,doc.generated_at)||callIds.has(call.call_id)) return false;
    callIds.add(call.call_id); callsById.set(call.call_id,call);
    let previousSequence=0,previousObservedAt=Date.parse(call.started_at);
    for(const event of call.provisional_events){
      const observedAt=Date.parse(event?.at||'');
      if(!await _validPublicProvisionalEvent(event,
        {call,generatedAt:doc.generated_at})
          ||event.sequence<=previousSequence||observedAt<previousObservedAt) return false;
      previousSequence=event.sequence; previousObservedAt=observedAt;
      flattenedProvisional.push({...event,call_id:call.call_id,model_id:call.model_id,
        persona_id:identity.signedId});
    }
  }
  const expectedProvisional=flattenedProvisional.slice(-PUBLIC_PERSONA_COGNITION_LIMITS.provisionalEvents);
  if(canon(doc.provisional_outputs)!==canon(expectedProvisional)) return false;
  // Exact equality to the independently validated nested records proves content
  // integrity without hashing every assistant chunk twice. Close the flattened
  // shape explicitly and bind its transport identifiers to the owning call.
  for(const event of doc.provisional_outputs){
    const call=callsById.get(event?.call_id);
    if(!call||!_exactObjectFields(event,_publicProvisionalEventFields(event,{bound:true}))
        ||event.call_id!==call.call_id||event.model_id!==call.model_id
        ||event.persona_id!==identity.signedId) return false;
  }
  for(const output of doc.recent_outputs)
    if(!await _validPublicPersonaOutput(output,identity,row)) return false;
  if(doc.lessons.some((lesson)=>!_validPublicPersonaLesson(lesson))
      ||doc.tactics.some((tactic)=>!_validPublicPersonaTactic(tactic))
      ||doc.proven_facts.some((fact)=>!_safePublicCognitionText(fact,4096,{required:true}))
      ||doc.evolution_timeline.some((event)=>!_validPublicPersonaEvolution(event))) return false;
  return true;
}
async function refreshThinking(){
  if(!S.drawerThinkPid) return;
  const el=$('#thinksec'); if(!el) return;
  const want=S.drawerThinkPid, wantBase=S.drawerLiveBase||'', wantKernel=S.drawerLiveKernel||'';
  const endpoint=join(wantBase,`personas/${encodeURIComponent(want)}/thinking`);
  const hasOperator=!!tokenFor(endpoint);
  const t=await fetchJson(endpoint,{maxBytes:PUBLIC_PERSONA_COGNITION_LIMITS.documentBytes});
  if(S.drawerThinkPid!==want||S.drawerLiveBase!==wantBase||S.drawerLiveKernel!==wantKernel) return;
  const el2=$('#thinksec'); if(!el2) return;
  const operatorAccepted=hasOperator&&t?.tier==='operator'
    &&t?.schema==='personaos-persona-thinking/1'&&String(t.persona_id||'')===want;
  const publicAccepted=!hasOperator&&await verifyPublicPersonaCognition(wantBase,t,
    {personaId:want,kernel:wantKernel});
  if(operatorAccepted||publicAccepted){
    el2.innerHTML=renderThinking(t,{allowThinkingFrame:operatorAccepted,kernel:wantKernel});
    hydrateThinkingOutputText(el2,t); return; }
  const doc=S.drawerLiveFeed?await fetchEntityFeed(wantBase,S.drawerLiveFeed):null;
  if(S.drawerThinkPid!==want||S.drawerLiveBase!==wantBase||S.drawerLiveKernel!==wantKernel) return;
  const el3=$('#thinksec'); if(el3) el3.innerHTML=hasOperator?renderThinkingRedacted(doc)
    :'<div class="privacy-note">No verified signed public cognition is available. Private cognition is not exposed.</div>';
}
// LIVE persona activity: poll active personas and merge the exact validated
// kernel-signed snapshot into the live feed. Persona-signed final output and
// provisional kernel observations keep separate trust labels. With a token this
// accepts the operator tier; a private node's anonymous 404 remains a quiet no-op.
let _cogBusy=false;
function _cognitionPreview(value){
  for(const line of String(value||'').split('\n')){
    const text=line.trim(); if(text) return text.slice(0,150);
  }
  return '';
}
// This bounded non-cryptographic fingerprint is only a render de-duplication key.
// Trust comes from verifyPublicPersonaCognition's whole-document signature check.
function _publicCognitionFingerprint(value){
  const source=canon(value); let left=2166136261,right=0x9e3779b9;
  for(let index=0;index<source.length;index++){
    const code=source.charCodeAt(index);
    left=Math.imul(left^code,16777619);
    right=Math.imul(right^(code+index),2246822519);
  }
  return `${source.length.toString(36)}-${(left>>>0).toString(36)}-${(right>>>0).toString(36)}`;
}
function _publicProvenanceAtom(value,maximum=512){
  return typeof value==='string'&&value.length<=maximum&&value.trim()===value?value:'';
}
function _publicProvenanceStatus(value){
  return typeof value==='number'&&Number.isFinite(value)?String(value):_publicProvenanceAtom(value,256);
}
function _verifiedPublicTaskRun(kernel,taskId){
  const task=_publicProvenanceAtom(taskId); if(!kernel||!task) return '';
  const runs=new Set();
  for(const id of (S.order||[])){
    const record=S.recs.get(id); if(record?._kernel!==kernel) continue;
    const lifecycle=publicTaskLifecycleProjection(record);
    if(lifecycle?.taskId===task&&lifecycle.run) runs.add(lifecycle.run);
  }
  return runs.size===1?runs.values().next().value:'';
}
function _verifiedPublicTaskForRun(kernel,runId){
  const run=_publicProvenanceAtom(runId); if(!kernel||!run) return null;
  const matches=[];
  for(const id of (S.order||[])){
    const record=S.recs.get(id); if(record?._kernel!==kernel) continue;
    const lifecycle=publicTaskLifecycleProjection(record);
    if(lifecycle?.run===run&&typeof lifecycle.task==='string'&&lifecycle.task.trim())
      matches.push(lifecycle);
  }
  return matches.length===1?matches[0]:null;
}
function _withVerifiedTaskRun(provenance,kernel,resolveRun=_verifiedPublicTaskRun){
  if(!provenance.run&&provenance.task){
    const run=resolveRun(kernel,provenance.task);
    if(run){ provenance.run=run; provenance.runFromTaskLifecycle=true; }
  }
  return provenance;
}
function _publicCallProvenance(call){
  return {
    purpose:_publicProvenanceAtom(call?.requested_purpose),
    model:_publicProvenanceAtom(call?.model_id),status:_publicProvenanceAtom(call?.status),
    run:_publicProvenanceAtom(call?.run_id),task:_publicProvenanceAtom(call?.task_id),
    call:_publicProvenanceAtom(call?.call_id),effort:_publicProvenanceAtom(call?.reasoning_effort),
    startedAt:_publicProvenanceAtom(call?.started_at,80),
  };
}
function _publicModelEventProvenance(event,snapshotAt=''){
  return {model:_publicProvenanceAtom(event?.model_id),
    purpose:_publicProvenanceAtom(event?.requested_purpose),status:_publicProvenanceStatus(event?.status),
    role:_publicProvenanceAtom(event?.role),run:_publicProvenanceAtom(event?.run_id),
    task:_publicProvenanceAtom(event?.task_id),call:_publicProvenanceAtom(event?.call_id),
    event:_publicProvenanceAtom(event?.event_id),environment:_publicProvenanceAtom(event?.environment_id),
    persona:_publicProvenanceAtom(event?.persona_id),
    latencyMs:Number.isFinite(event?.latency_ms)?event.latency_ms:undefined,
    at:_publicProvenanceAtom(event?.at,80),snapshotAt:_publicProvenanceAtom(snapshotAt,80)};
}
function _publicProvisionalProvenance(event,call){
  return {..._publicCallProvenance(call),model:_publicProvenanceAtom(event?.model_id),
    call:_publicProvenanceAtom(event?.call_id),at:_publicProvenanceAtom(event?.at,80),
    authority:_publicProvenanceAtom(event?.authority,256),sequence:event?.sequence,
    status:_publicProvenanceAtom(event?.status,256),message:_publicProvenanceAtom(event?.message_id),
    tool:_publicProvenanceAtom(event?.tool_name,512)||_publicProvenanceAtom(event?.tool_type,512),
    server:_publicProvenanceAtom(event?.server,512)};
}
function _publicOutputTrust(output){
  if(output?.kind===PUBLIC_PERSONA_ACTION_OUTPUT_KIND) return {
    label:'SIGNED LINEAGE ACTION',
    title:'exact authenticated action in the verified kernel-signed public cognition document',
  };
  if(output?.kind===PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND) return {
    label:'PERSONA SIGNED INTENT',
    title:'persona signature and authored-output hash verified, inside the verified kernel-signed public cognition document',
  };
  if(output?.kind===PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND) return {
    label:'PERSONA SIGNED MESSAGE',
    title:'persona communication signature and authored-output hash verified, inside the verified kernel-signed public cognition document',
  };
  return {label:'KERNEL SIGNED LINEAGE',
    title:'exact lineage output in the verified kernel-signed public cognition document'};
}
function _publicOutputProvenance(output,kernel,resolveRun=_verifiedPublicTaskRun){
  const provenance={
    environment:_publicProvenanceAtom(output?.environment_id),
    at:_publicProvenanceAtom(output?.at,80),authority:_publicProvenanceAtom(output?.authority,128),
  };
  if(output?.kind===PUBLIC_PERSONA_ACTION_OUTPUT_KIND){
    try{
      const action=JSON.parse(output.text), args=action.arguments||{};
      provenance.action=_publicProvenanceAtom(action.action);
      provenance.run=_publicProvenanceAtom(args.run_id);
      provenance.task=_publicProvenanceAtom(args.task_id);
      provenance.event=_publicProvenanceAtom(args.event_id);
      provenance.request=_publicProvenanceAtom(args.request_id);
      provenance.status=_publicProvenanceAtom(args.status,256)
        ||_publicProvenanceAtom(args.lifecycle_state,256);
      provenance.environment=_publicProvenanceAtom(args.environment_id)||provenance.environment;
      if(Array.isArray(args.evidence_refs)) provenance.evidence=args.evidence_refs
        .map((value)=>_publicProvenanceAtom(value,1024)).filter(Boolean).slice(0,16);
    }catch(_){ /* reached only after the exact action validator; keep base provenance if unavailable */ }
  }else if(output?.kind===PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND){
    const authority=output.persona_authority||{};
    provenance.intent=_publicProvenanceAtom(authority.intent_id);
    provenance.event=_publicProvenanceAtom(authority.wake_event_id);
    provenance.task=_publicProvenanceAtom(authority.task_id);
    provenance.missionTask=_publicProvenanceAtom(authority.mission_task_id);
    provenance.dedupe=_publicProvenanceAtom(authority.wake_dedupe_key,1024);
    provenance.authoredAt=_publicProvenanceAtom(authority.authored_at,80);
    provenance.signingKey=_publicProvenanceAtom(authority.signing_key_id);
    provenance.authorityHash=_publicProvenanceAtom(output.persona_authority_hash,1024);
  }else if(output?.kind===PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND){
    const authority=output.persona_authority||{}, source=authority.provenance;
    provenance.message=_publicProvenanceAtom(authority.communication_id);
    provenance.parentMessage=_publicProvenanceAtom(authority.parent_communication_id);
    provenance.parentHash=_publicProvenanceAtom(authority.parent_communication_hash,1024);
    provenance.signingKey=_publicProvenanceAtom(authority.signing_key_id);
    provenance.authorityHash=_publicProvenanceAtom(output.persona_authority_hash,1024);
    if(source&&typeof source==='object'&&!Array.isArray(source)){
      provenance.run=_publicProvenanceAtom(source.run_id);
      provenance.task=_publicProvenanceAtom(source.task_id);
      provenance.event=_publicProvenanceAtom(source.event_id)
        ||_publicProvenanceAtom(source.wake_event_id);
    }
  }
  return _withVerifiedTaskRun(provenance,kernel,resolveRun);
}
function _publicCognitionRows(doc,{kernel=''}={}){
  const observedAt=doc.generated_at, rows=[];
  const runCache=new Map();
  const resolveRun=(runKernel,task)=>{
    const key=`${runKernel}\u0000${task}`;
    if(!runCache.has(key)) runCache.set(key,_verifiedPublicTaskRun(runKernel,task));
    return runCache.get(key);
  };
  const callsById=new Map(doc.active_calls.map((call)=>[call.call_id,call]));
  for(const call of doc.active_calls){
    const provenance=_publicCallProvenance(call);
    rows.push({
      source:'active_call',kind:'MODEL_CALL',at:call.started_at,scope:'model',scopeId:call.task_id||call.run_id,
      msg:[call.requested_purpose,call.model_id,call.status].filter(Boolean).join(' · '),
      rationale:`model ${call.model_id} · ${call.status}${call.reasoning_effort?` · reasoning ${call.reasoning_effort}`:''}`,
      cognition:true,ctype:'think',recipients:[],dedup:provenance,provenance,
      trustLabel:'KERNEL SIGNED ACTIVE CALL',
      trustTitle:'active model call in the verified current kernel-signed public cognition snapshot',
    });
  }
  for(const event of doc.provisional_outputs){
    const assistant=event.kind==='assistant_message', tool=event.kind==='tool_status';
    const kind=assistant?'PROVISIONAL_ASSISTANT_MESSAGE':tool?'PROVISIONAL_TOOL_STATUS':'PROVISIONAL_PROVIDER_STATUS';
    const statusDetail=tool
      ?[event.status,event.tool_type,event.tool_name,event.server].filter(Boolean).join(' · ')
      :[event.status,event.model_id].filter(Boolean).join(' · ');
    const call=callsById.get(event.call_id);
    const provenance=_publicProvisionalProvenance(event,call);
    rows.push({
      source:'provisional',kind,at:event.at,scope:'provider',scopeId:event.call_id,
      msg:assistant?event.text:statusDetail,rationale:assistant?event.text:statusDetail,
      exactText:assistant?event.text:'',cognition:false,providerProvisional:true,ctype:'think',
      recipients:[],authority:event.authority,dedup:event,personaSigned:false,provenance,
      trustLabel:'KERNEL OBSERVED · PROVISIONAL',
      trustTitle:'verified kernel-signed public snapshot; provisional provider event, not persona-signed cognition or hidden reasoning',
    });
  }
  for(const output of doc.recent_outputs){
    const communication=output.kind===PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND;
    const action=output.kind===PUBLIC_PERSONA_ACTION_OUTPUT_KIND;
    const provenance=_publicOutputProvenance(output,kernel,resolveRun);
    const trust=_publicOutputTrust(output);
    rows.push({
      source:'output',kind:output.kind,at:output.at,
      scope:communication?'communication':action?'action':'cognition',
      scopeId:provenance.task||output.environment_id,
      msg:output.text,rationale:output.text,cognition:!communication&&!action,ctype:action?'tool':'think',
      exactText:output.text,recipients:output.audience_persona_ids,
      authority:output.authority,dedup:output,provenance,
      trustLabel:trust.label,trustTitle:trust.title,
    });
  }
  for(const lesson of doc.lessons) rows.push({
    source:'lesson',kind:'COGNITION_LESSON',at:observedAt,scope:'cognition',scopeId:'',
    msg:lesson.action,rationale:[lesson.trigger,lesson.rationale].filter(Boolean).join(' · '),
    cognition:true,ctype:'think',recipients:[],dedup:lesson,observedState:true,
    provenance:{snapshotAt:observedAt},trustLabel:'KERNEL SIGNED SNAPSHOT',
  });
  for(const tactic of doc.tactics) rows.push({
    source:'tactic',kind:'COGNITION_TACTIC',at:observedAt,scope:'cognition',scopeId:'',
    msg:tactic.action,rationale:[tactic.trigger,tactic.source].filter(Boolean).join(' · '),
    cognition:true,ctype:'think',recipients:[],dedup:tactic,observedState:true,
    provenance:{snapshotAt:observedAt},trustLabel:'KERNEL SIGNED SNAPSHOT',
  });
  for(const fact of doc.proven_facts) rows.push({
    source:'fact',kind:'COGNITION_PROVEN_FACT',at:observedAt,scope:'cognition',scopeId:'',
    msg:fact,rationale:fact,cognition:true,ctype:'think',recipients:[],dedup:fact,observedState:true,
    provenance:{snapshotAt:observedAt},trustLabel:'KERNEL SIGNED SNAPSHOT',
  });
  for(const event of doc.evolution_timeline) rows.push({
    source:'evolution',kind:event.kind,at:event.at||observedAt,scope:'cognition',scopeId:event.task_id,
    msg:[event.mode,event.accepted===true?'accepted':event.accepted===false?'not accepted':'',event.kind].filter(Boolean).join(' · '),
    rationale:event.mode,cognition:true,ctype:'think',recipients:[],dedup:event,observedState:!event.at,
    provenance:_withVerifiedTaskRun({task:event.task_id,at:event.at||'',snapshotAt:event.at?'':observedAt},kernel,resolveRun),
    trustLabel:'KERNEL SIGNED EVOLUTION',
    trustTitle:'evolution entry in the verified kernel-signed public cognition document',
  });
  return rows;
}
async function streamPersonaCognition(){
  if(_cogBusy) return;
  _cogBusy=true;
  try{
    S.cogBaseFor=S.cogBaseFor||new Map();   // kernel-qualified persona key -> API base
    // The bases that actually serve the personaos API are the ones that streamed LIVE telemetry
    // (the cards render from those) — NOT necessarily a discovery record's _base (which may be an
    // IPFS/alias host that doesn't serve the API). Probe telemetry bases first, then record bases.
    const baseCandidates=[
      ...[...(S.liveTel?S.liveTel.keys():[])].map((k)=>({base:k==='@origin'?'':k,
        active:(S.activeModelCallsByBase?.get(k)||[]).length>0,focused:!!S.kernelFocus&&baseIsFocused(k==='@origin'?'':k)})),
      ...[...(S.order||[])].map((id)=>S.recs.get(id)).filter((r)=>r&&r.kind==='persona'&&kernelIsFocused(r._kernel)).map((r)=>({base:r._base||''})),
      {base:''},
    ];
    const apiBases=selectMonitoringBases(baseCandidates,{limit:NETWORK_LIMITS.monitoredBases,hardLimit:64}).bases;
    // Visible, running and recent personas outrank the rest. This selector scans
    // the bounded cache once and retains only the cognition polling window.
    function* cognitionCandidates(){
      for(const personaKey of (S.visiblePersonaIds||[])){ const ref=_personaRef(personaKey);
        yield {...ref,endpointId:_signedPersonaEndpointId(personaKey),selected:true,
          base:S.liveByPersona.get(personaKey)?.base||''}; }
      for(const [personaKey,d] of (S.liveByPersona||new Map())) if(kernelIsFocused(d?.kernel)){
        const ref=_personaRef(personaKey); yield {...ref,endpointId:_signedPersonaEndpointId(personaKey),
          base:d?.base||'',running:_runningNow(personaKey),live:!!(d.models||[]).length}; }
      for(const id of (S.order||[])){ const r=S.recs.get(id);
        if(r&&r.kind==='persona'&&kernelIsFocused(r._kernel)){ const ref=_personaRef(r.did||r.id||'',r._kernel);
          yield {...ref,endpointId:_signedPersonaEndpointId(ref.key),base:r._base||''}; } }
    }
    const list=selectPriorityWindow(cognitionCandidates(),{limit:NETWORK_LIMITS.cognitionPersonas,
      keyOf:(row)=>row.key,priorityOf:(row)=>(row.selected?1e9:0)+(row.running?1e8:0)+(row.live?1e7:0),
      searchTextOf:(row)=>`${row.sid} ${row.kernel} ${_nameFor(row.key)}`}).items.filter((row)=>row.key&&row.sid);
    S.interactions=S.interactions||[]; S.ixKeys=S.ixKeys||new Set(); let added=0;
    for(const candidate of list){ const {key:personaKey,sid,kernel,endpointId}=candidate;
      // Never probe another kernel for a colliding short id. A sticky route is
      // retained only while it still resolves to this persona's owning kernel.
      const routes=[S.cogBaseFor.get(personaKey),candidate.base,
        ...apiBases.filter((base)=>kernelForBase(base)===kernel),
        ...[...(S.globalKernels?.get(kernel)?.bases||[])]];
      const order=[...new Set(routes.filter((b)=>b!==undefined)
        .map((b)=>String(b==='@origin'?'':b).replace(/\/$/,'')))]
        .filter((base)=>kernelForBase(base)===kernel || (!!base&&base===candidate.base));
      let t=null, usedBase='';
      for(const base of order){
        // Node routes are identity-bound: a PersonaOS-born identity is exactly
        // `persona:<ULID>`, while an initial founder may be the bare id. The
        // canonical `sid` remains only the browser join key.
        const endpoint=join(base,`personas/${encodeURIComponent(endpointId)}/thinking`);
        const hasOperator=!!tokenFor(endpoint);
        const r=await fetchJson(endpoint,{maxBytes:PUBLIC_PERSONA_COGNITION_LIMITS.documentBytes});
        const accepted=hasOperator
          ?r?.schema==='personaos-persona-thinking/1'&&r.tier==='operator'
            &&String(r.persona_id||'')===endpointId
          :await verifyPublicPersonaCognition(base,r,{personaId:endpointId,kernel});
        if(accepted){
          t=r; usedBase=base; S.cogBaseFor.set(personaKey,base); break; }
      }
      if(!t) continue;
      const publicCognition=t.schema==='personaos-persona-public-cognition/1';
      const retainedCognition=S.cognitionByPersona?.get(personaKey);
      if(retainedCognition){
        S.cognitionByPersona.delete(personaKey);
        S.cognitionByPersona.set(personaKey,retainedCognition);
      }
      if(publicCognition) _indexPublicCognitionActiveCalls(personaKey,t.active_calls,
        {base:usedBase,kernel,observedAt:Date.now()});
      const rows=publicCognition?_publicCognitionRows(t,{kernel}):[];
      if(!publicCognition){
        for(const output of (t.recent_outputs||[])) rows.push({source:'output',kind:String(output.kind||'LLM_OUTPUT'),
          msg:output.text,at:output.at,scope:'cognition',scopeId:'',recipients:[],dedup:output});
        const lessons=t.lessons||[]; if(lessons.length){ const lesson=lessons[lessons.length-1];
          rows.push({source:'lesson',kind:'LLM_LESSON',msg:lesson.action,at:t.generated_at||'',scope:'cognition',
            scopeId:'',recipients:[],dedup:lesson}); }
      }
      S.publicCognitionSeen=S.publicCognitionSeen||new Map();
      let personaSeen=null;
      if(publicCognition){
        personaSeen=S.publicCognitionSeen.get(personaKey)||new Set();
        S.publicCognitionSeen.delete(personaKey); S.publicCognitionSeen.set(personaKey,personaSeen);
        while(S.publicCognitionSeen.size>NETWORK_LIMITS.cognitionPersonas*4)
          S.publicCognitionSeen.delete(S.publicCognitionSeen.keys().next().value);
      }
      for(const row of rows){
        const msg=typeof row.msg==='string'?row.msg:String(row.msg??'');
        if(!msg.trim()&&row.providerProvisional!==true) continue;
        const key=`cog|${personaKey}|${row.source}|${row.kind}|${_publicCognitionFingerprint(row.dedup)}`;
        if(personaSeen?.has(key)||S.ixKeys.has(key)||S.cognitionByPersona?.get(personaKey)?.has(key)) continue;
        if(personaSeen){ personaSeen.add(key); while(personaSeen.size>128) personaSeen.delete(personaSeen.values().next().value); }
        S.ixKeys.add(key); added++;
        const contentPreview=_cognitionPreview(msg);
        const prefix={lesson:'lesson',tactic:'tactic',fact:'proven fact'}[row.source];
        const preview=prefix?`${prefix} — ${contentPreview}`:contentPreview;
        const recipients=(row.recipients||[]).map((id)=>({kind:'persona',id}));
        const personaSigned=publicCognition&&row.personaSigned!==false;
        const trustTitle=row.trustTitle||(personaSigned
          ?`whole public cognition document verified under the current kernel master${row.authority?`; output authority: ${row.authority}`:''}`:'');
        const event={actor_id:sid,actor_kind:'persona',affected:[],recipients,kind:row.kind,
          scope:row.scope||'cognition',scope_id:row.scopeId||'',at:row.at||'',signed:personaSigned,
          _base:usedBase,_kernel:kernel,_t:Date.parse(row.at||'')||Date.now(),_key:key,
          _msg:preview.slice(0,200),_rationale:String(row.rationale||msg),
          _exactText:typeof row.exactText==='string'?row.exactText:'',
          _recipientCount:recipients.length,_authority:String(row.authority||''),_cognition:row.cognition===true,
          _providerProvisional:row.providerProvisional===true,
          _observedState:row.observedState===true,
          _provenance:row.provenance&&typeof row.provenance==='object'?row.provenance:null,
          _trustLabel:String(row.trustLabel||(personaSigned?'SIGNED COGNITION':'')),
          _trustTitle:String(trustTitle),
        };
        S.interactions.push(event); _rememberPersonaCognitionEvent(event);
      }
    }
    if(added){
      S.interactions.sort((a,b)=>a._t-b._t);
      if(S.interactions.length>400) S.interactions=S.interactions.slice(-400);
      S.ixKeys=new Set(S.interactions.map((e)=>e._key));
      // Cognition is merged after the node-wide telemetry ingest, so rebuild the
      // per-persona index here as well; otherwise the global feed advances while
      // the corresponding collectible card remains falsely quiet.
      _refreshPersonaInteractionIndex();
      scheduleRealtimeRepaint();
    }
  }catch(e){}
  finally{ _cogBusy=false; }
}
function refreshLiveSection(){
  if(!S.drawerLiveKind||!S.drawerLiveId) return;
  const el=$('#livesec'); if(!el) return;
  const fallback=()=>{ const el2=$('#livesec'); if(!el2) return;
    el2.innerHTML=S.drawerLiveKind==='persona'
      ?renderPersonaLive(S.drawerLiveId,null,S.drawerLiveKernel)
      :renderEnvLive(S.drawerLiveId,S.drawerLiveKernel); };
  if(S.drawerLiveFeed){
    // capture the target before the async fetch: if the drawer navigated away
    // meanwhile, a slow response must never paint entity A into entity B's view.
    const wantFeed=S.drawerLiveFeed, wantId=S.drawerLiveId, wantKernel=S.drawerLiveKernel;
    fetchEntityFeed(S.drawerLiveBase||'',wantFeed).then((doc)=>{
      if(S.drawerLiveFeed!==wantFeed||S.drawerLiveId!==wantId||S.drawerLiveKernel!==wantKernel) return;
      const el2=$('#livesec'); if(!el2) return;
      if(isPersonaTelemetryDocument(doc))
        el2.innerHTML=renderPersonaFeedDoc(doc,_personaKey(wantKernel,wantId));
      else if(isEnvironmentTelemetryDocument(doc)) el2.innerHTML=renderEnvFeedDoc(doc);
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
  const ns=await fetchNodeStatus(base)||{};
  const pid=prof.persona_id||personaIdFromDid(r.did);
  const personaKey=_personaKey(r._kernel,pid||r.did);
  const lifecycle=personaLifecycleProjection(S.personaDiscoveryByKey,personaKey);
  const statusPersona=((ns.personas||[]).find((p)=>p.persona_id===pid||(pid&&(p.persona_id||'').endsWith(pid)))||{});
  const ps=prof.persona_id?{...prof,...statusPersona}:statusPersona;
  const rawDisplayName=String(ps.name||r._personaSignedName||'');
  const displayName=_displayPersonaName(rawDisplayName,pid||r.did);
  const role=ps.role||(ps.membership||{}).role||r._personaAuthoredRole||_ROLE_NOT_DECLARED;
  const state=ps.lifecycle_state||lifecycle?.lifecycleState||'—';
  const rep=ps.reputation_score!=null?Number(ps.reputation_score).toFixed(2):'—';
  // de-dup scalars the live grid already renders as tiles (state / tasks / reputation)
  // and the title already shows (name): keep only rows the grid does NOT carry.
  const personaIdentity=String(pid||r.did||'');
  const compactPersonaIdentity=personaIdentity.length>16
    ?`${personaIdentity.slice(0,6)}…${personaIdentity.slice(-6)}`:personaIdentity;
  let html=kv('Persona id',`<code title="${esc(personaIdentity)}">${esc(compactPersonaIdentity||'—')}</code>`)
    +kv('Role',`<span class="cap">${esc(role)}</span>`)
    +(lifecycle?kv('Identity materialization',`<span class="${lifecycle.materializationState==='pending'?'amber':'ok'}">${esc(lifecycle.materializationState)}</span>`):'')
    +(lifecycle?kv('Identity fields',['name','characteristics','avatar'].map((field)=>{
      const value=lifecycle.identityFields[field];
      return `<span class="cap ${value.state==='pending'?'amber':'ok'}">${esc(field)} ${esc(value.state)}</span>`;
    }).join(' ')):'')
    +kv('Archetype',S0(ps.archetype))
    +kv('Disposition',S0(ps.primary_disposition))
    +(ps.identity_name_state?kv('Identity name',ps.identity_name_pending
      ?`<span class="amber">pending</span> <span class="l2">${esc(ps.identity_name_pending_reason||'')}</span>`
      :`<span class="ok">${esc(ps.identity_name_state)}</span>`):'')
    +(ps.brain_fragment_count!=null?kv('Brain',`fragments ${esc(ps.brain_fragment_count)} · contexts ${esc(ps.brain_context_count??0)} · compiles ${esc(ps.brain_compile_count??0)}`):'')
    +((ps.last_active_spec_fragment_ids||[]).length?kv('Active spec fragments',esc((ps.last_active_spec_fragment_ids||[]).join(', '))):'')
    +kv('Soul version',S0(ps.soul_version))
    +(ps.born_specialist?kv('Origin','<span class="amber">born specialist (genesis)</span>'):'');
  // MODEL-PER-ROLE: the distinct models this persona resolved (EnvironmentModelRegistry
  // picks one per role/purpose) — surfaced right under identity when it has live model calls.
  const _liveModels=(S.liveByPersona.get(_personaKey(r._kernel,pid||r.did))||{}).models||[];
  if(_liveModels.length) html+=kv('Model',_modelSummary(_liveModels));
  if(ps.description) html+=H('Description')+`<div class="desc2">${esc(String(ps.description).slice(0,400))}</div>`;
  if((ps.advertised_interests||[]).length) html+=H('Interests')+chipsOf(ps.advertised_interests);
  if((ps.domain_curatorships||[]).length) html+=H('Domain curatorships')+chipsOf(ps.domain_curatorships);
  // what this persona CAN DO — its advertised capabilities (filtering the generic
  // project_workspace marker, same as the env lanes do).
  const caps=(ps.capability_summary||r.capability_summary||[]).filter((c)=>c&&c!=='project_workspace');
  if(caps.length) html+=H('Capabilities')+chipsOf(caps);
  // THE PLAN — use the persona's direct run or its one exact verified env
  // association. Never borrow the first env on a multi-env kernel.
  const _personaEnv=envRecordForAuthority(r);
  const _prun=runOf(r)||(_personaEnv.recordId?runForEnv(S.recs.get(_personaEnv.recordId)):null);
  if(_prun) html+=await planSection(base,_prun);
  // LIVE per-persona activity — what this persona is doing right now + its
  // evolving internal state, streamed in place on every telemetry tick. Prefers
  // the persona's OWN feed document (links.telemetry → telemetry/personas/<slug>.json).
  S.drawerLiveKind='persona'; S.drawerLiveId=pid||r.did; S.drawerLiveKernel=r._kernel||kernelForBase(base); S.drawerLiveBase=base;
  S.drawerLiveFeed=(L.telemetry&&!String(L.telemetry).includes('live/latest'))?L.telemetry:'';
  html+=H('● Live · inside this persona')+`<div id="livesec" class="livesec">${renderPersonaLive(pid||r.did,ps,S.drawerLiveKernel)}</div>`;
  if(S.drawerLiveFeed) setTimeout(refreshLiveSection,0);
  // Public activity combines persona-signed final output with explicitly
  // provisional kernel observations; the private thinking frame remains
  // available only with operator authority. Both refresh on the live cadence.
  S.drawerThinkPid=_signedPersonaEndpointId(personaKey);
  const thinkingEndpoint=join(base,`personas/${encodeURIComponent(S.drawerThinkPid)}/thinking`);
  const operatorThinking=!!tokenFor(thinkingEndpoint);
  html+=H(operatorThinking?'Thinking':'Live public activity')
    +`<div id="thinksec" class="livesec"><div class="fv-loading">${operatorThinking?'resolving cognition…':'resolving verified public activity…'}</div></div>`;
  setTimeout(refreshThinking,0);
  html+=trustPanel(r);
  // Related navigation obeys the same exact authority result. Profile/status
  // environment fields are unsigned transport observations and cannot select a
  // destination; ambiguous candidates remain visible as pressure instead.
  const eid=_personaEnv.recordId;
  const bid=S.order.find((id)=>{ const x=S.recs.get(id);
    return x&&x._kernel===r._kernel&&x.kind==='artifact'&&x._links&&x._links.bundle
      &&((_personaEnv.authority.status==='resolved'
          &&envSidOfRecord(x)===_personaEnv.authority.environmentId)
        ||(_prun&&runOf(x)===_prun)); });
  let nav='';
  if(eid) nav+=`<div class="row">${recLink(eid,'Workspace (env) →')}</div>`;
  else if(['ambiguous','conflict'].includes(_personaEnv.authority.status))
    nav+=`<div class="row"><span class="amber">Environment routing unresolved</span><span class="l2">${esc(_personaEnv.authority.candidates.length)} verified candidates · no selection</span></div>`;
  else if(ps.environment_id||prof.environment_id)
    nav+=`<div class="row"><span class="l2">Environment observation withheld from navigation — no verified routing reference</span></div>`;
  if(bid) nav+=`<div class="row">${recLink(bid,'Deliverable (bundle) →')}</div>`;
  if(nav) html+=H('Related')+nav;
  if(L.profile) html+=H('Source')+`<div class="row"><a href="${esc(safeUrl(join(base,L.profile)))}" target="_blank" rel="noopener">signed persona card →</a></div>`;
  return {title:`<span class="kind k-persona">PERSONA</span> ${esc(displayName)}`, html};
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
  const environmentIdentity=String(d.environment_id||r.did||r.label||'');
  const compactEnvironmentIdentity=environmentIdentity.length>20
    ?`${environmentIdentity.slice(0,8)}…${environmentIdentity.slice(-7)}`:environmentIdentity;
  let html=kv('Environment',`<code title="${esc(environmentIdentity)}">${esc(compactEnvironmentIdentity||'—')}</code>`)
    +kv('Type',`<span class="cap">${esc(d.env_type||'—')}</span>`)
    +kv('Env rules',S0(d.rule_count))
    +kv('Lineage events',S0(ld.event_count));
  // MODEL-PER-ROLE: the distinct models in use across this environment's personas
  // (the env's own model_events) — what THIS workspace is actually running on.
  const _envLiveModels=(S.liveByEnv.get(_environmentKey(r._kernel,d.environment_id||r.did))||{}).models||[];
  if(_envLiveModels.length) html+=kv('Models in use',_modelSummary(_envLiveModels));
  if(d.description) html+=H('Description')+`<div class="desc2">${esc(String(d.description).slice(0,300))}</div>`;
  // THE PLAN — the mission charter this environment exists to pursue (objectives,
  // current round, blocked/measured state). Surfaced right under the env header so
  // the drawer answers "what is this env trying to DO", not only "what did it make".
  const _run=runForEnv(r);
  if(_run) html+=await planSection(base,_run);
  // Deliverables produced in THIS environment. New exports publish an env-current
  // manifest; older exports fall back to signed records joined by env id or run id.
  const manifestRel=L.artifact_manifest||d.artifact_manifest||'';
  const manifest=manifestRel?await dfetch(base,manifestRel):null;
  const manifestFiles=manifestArtifacts(manifest);
  const _sid=_envSid(r)||_envSidFromValue(d.environment_id);
  const _runHostKeys=_run?S.order.map((id)=>S.recs.get(id)).filter((x)=>x&&x.kind==='env'
    &&x._kernel===r._kernel&&runForEnv(x)===_run).map((x)=>_environmentKey(r._kernel,_envSid(x))):[];
  const _runAuthority=resolveUniqueRunEnvironment(_runHostKeys);
  const _thisEnvKey=_environmentKey(r._kernel,_sid);
  const myArts=S.order.map((id)=>S.recs.get(id)).filter((x)=>x&&x.kind==='artifact'
    &&(()=>{ const authority=environmentAuthorityOfRecord(x);
      if(authority.status==='resolved') return authority.environmentId===_sid;
      return authority.status==='absent'&&_run&&runOf(x)===_run
        &&_runAuthority.status==='resolved'&&_runAuthority.environmentKey===_thisEnvKey; })());
  const myBundles=myArts.filter((a)=>a._links&&a._links.bundle);
  const myFiles=myArts.filter((a)=>{ const L=a._links||{}; return L.content||L.content_stub||L.content_hash; });
  if(manifestFiles.length){
    html+=H('Workspace files');
    html+=`<details class="artifact-index"><summary><span>Browse ${manifestFiles.length} workspace file${manifestFiles.length===1?'':'s'}</span>${icon('chevron','ico-sm')}</summary>`
      +`<div class="artifact-index-body">${renderArtifactTree(manifestFiles,manifestRun(manifest))}</div></details>`;
  }
  if(myArts.length&&(myBundles.length||!manifestFiles.length)){
    html+=H('Deliverables');
    for(const bnd of myBundles)
      html+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(bnd._links.bundle)}" data-rec="${esc(bnd.record_id||bnd.card_id||'')}">${icon('box','ico-sm')} ${esc(bnd.label||'deliverable bundle')} →</a></div>`;
    if(myFiles.length&&!manifestFiles.length)
      html+=`<details class="artifact-index"><summary><span>Browse ${myFiles.length} signed file record${myFiles.length===1?'':'s'}</span>${icon('chevron','ico-sm')}</summary><div class="artifact-index-body atree">`+myFiles.map((a)=>
        `<div class="tnode tfile"><a href="#" data-act="rec" data-id="${esc(a.record_id||a.card_id||a.id||'')}">${esc(a.label||a.record_id||'file')}</a>`
        +`<span class="l2">${authoredArtifactLabelText(a)?`authored: ${esc(authoredArtifactLabelText(a))} · `:''}${esc((a._links||{}).media_kind||'')}</span></div>`).join('')+`</div></details>`;
  }
  const roster=members.length?members:( (ns.personas||[]).map((p)=>({persona_id:p.persona_id,role:p.role,active:p.lifecycle_state==='ACTIVE'})) );
  if(roster.length){
    html+=H(`Members (${roster.length})`);
    html+=roster.map((m)=>{
      const rid=findRecByDid(m.persona_id,r._kernel)||findRecByDid('did:personaos:'+m.persona_id,r._kernel);
      const label=rid?recLink(rid,m.role||m.persona_id):esc(m.role||m.persona_id);
      const active=m.active!==false;
      // the model this member is running on (its latest live model selection) — so the
      // roster shows WHO is on WHICH model, not just who is a member.
      const lm=(S.liveByPersona.get(_personaKey(r._kernel,m.persona_id))||{}).models;
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
  S.drawerLiveKind='env'; S.drawerLiveId=envId; S.drawerLiveKernel=r._kernel||kernelForBase(base); S.drawerLiveBase=base;
  S.drawerLiveFeed=(L.telemetry&&!String(L.telemetry).includes('live/latest'))?L.telemetry:'';
  html+=H('● Live · inside this environment')+`<div id="livesec" class="livesec">${renderEnvLive(envId,S.drawerLiveKernel)}</div>`;
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
    const authored=authoredArtifactLabels(a), semanticAttr=artifactSemanticsAttr(a);
    const body=published
      ? `<a href="#" data-act="file" data-path="${esc(_bodyPath('artifacts/package/'+f.path,pkgRun))}" data-title="${esc(f.path)}" data-kind="${esc(a.media_kind)}" data-semantics="${esc(semanticAttr)}" data-hash="${esc(a.content_hash||'')}" data-size="${esc(a.size_bytes??a.size??a.bytes??'')}">${esc(f.name)}</a>`
      : `<span class="tgated">${esc(f.name)} <span class="no">· origin_gated</span></span>`;
    const sz=(a.size_bytes??a.size??a.bytes);
    h+=`<div class="tnode tfile" style="padding-left:${depth*14}px">${body}<span class="l2">${authored.length?`authored: ${esc(authored.join(' · '))} · `:''}${esc(a.media_kind||'—')}${sz!=null&&sz!==''?' · '+fmtBytes(+sz):''}</span></div>`; }
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
      +'captured process bearer. If HTTPS blocks an HTTP node, open the node\'s own console '
      +'and paste the same bearer there.</p></div>';
    if(files.length){
      mh+=H(`Files (${files.length}) — published manifest`)+files.slice(0,80).map((r)=>{
        const L2=r._links||{}; const h=String(L2.content_hash||'').replace('sha256:','').slice(0,10);
        const authored=authoredArtifactLabelText(r);
        return `<div class="grant"><span class="l2">${esc(r.label||'file')}</span>`
          +`<span class="tier">${authored?`authored: ${esc(authored)} · `:''}${esc(L2.media_kind||'')}${h?` · ${h}…`:''}</span></div>`;
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
   (fallback). Executable renderer code is loaded only from this repository;
   third-party CDN modules are never imported into the operator-token realm.
   SECURITY: artifact bodies are REMOTE PEER content. Markdown is
   rendered with local textContent-only primitives; tables / code / descriptors are built with
   createElement + textContent (never innerHTML of raw content); SVG and
   images are rendered as blob: <img> (never inline innerHTML). No eval.
   ==================================================================== */

/* ====================================================================
   LAZY .mjs RENDERER REGISTRY (richer deliverable viewers)
   --------------------------------------------------------------------
   Each enabled entry is a self-contained ES module under ./renderers/ with
   no runtime executable dependency outside this repository.
   These outrank the built-in text/media renderer families for
   any ext/kind they claim; on ANY throw the host falls back to the
   built-in renderer path (markdown/csv/code/image/pdf/plain/download).
   DISPATCH: extension is authoritative (zero collisions across modules);
   media_kind is the fallback (first-writer-wins, registry ordered most-
   specific → most-generic so 'pcb'→gerber, 'eda'→netlist, 'cad'→cad3d).
   ==================================================================== */
// The registry and its extension/kind precedence live in a data-only module so
// the complete dispatch matrix can be tested without a browser. Peer metadata
// can select only repository-owned entries from that manifest.
const pickLazyRenderer=selectLocalArtifactModule;
async function _localDependencyOnly(){ throw new Error('external executable renderer dependencies are disabled'); }
// Cached per-file import of the renderer module itself (lazy on first open).
const _LAZY_MOD=new Map();
async function _lazyModule(file){
  if(_LAZY_MOD.has(file)) return _LAZY_MOD.get(file);
  const p=import(/* @vite-ignore */ './renderers/'+file+'?v=20260714-ifc-inspector-v1');
  p.catch(()=>_LAZY_MOD.delete(file));
  _LAZY_MOD.set(file,p); return p;
}

// Renderers that consume binary bytes (blob), not text. Text fetch is skipped.
const BINARY_RENDERERS=new Set(['image','audio','video','model3d','descriptor','pdf','generic']);
const IMG_EXT=new Set(['png','jpg','jpeg','gif','webp','svg','avif','bmp','ico','tif','tiff']);
const TEXTY_DESCRIPTOR_EXT=new Set(['step','stp','ifc','obj','gltf','ply','kicad_pcb','kicad_sch']);

function pickRenderer(title,kind){
  return selectBuiltinArtifactRenderer(title,kind);
}

// Track blob: URLs allocated for the current view so they're revoked on change.
function mkBlobURL(blob){ const u=URL.createObjectURL(blob);
  onViewCleanup(()=>URL.revokeObjectURL(u)); return u; }

// Nodes may deliberately serve live bodies as application/octet-stream. Assign
// only a small renderer-controlled MIME allowlist after integrity verification;
// never trust a peer-supplied HTML MIME for a same-origin blob URL.
function safeRenderMime(ext,kind){
  const byExt={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',
    webp:'image/webp',svg:'image/svg+xml',avif:'image/avif',bmp:'image/bmp',ico:'image/x-icon',
    tif:'image/tiff',tiff:'image/tiff',pdf:'application/pdf',mp3:'audio/mpeg',wav:'audio/wav',
    ogg:'audio/ogg',oga:'audio/ogg',m4a:'audio/mp4',flac:'audio/flac',aac:'audio/aac',opus:'audio/ogg',
    mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',m4v:'video/mp4',ogv:'video/ogg'};
  if(byExt[ext]) return byExt[ext];
  const k=String(kind||'').toLowerCase();
  return Object.values(byExt).includes(k)?k:'application/octet-stream';
}

// Small helper: build an element with optional class/text (textContent — safe).
function el(tag,cls,text){ const e=document.createElement(tag);
  if(cls) e.className=cls; if(text!=null) e.textContent=String(text); return e; }
function loadingNode(label){ const d=el('div','fv-loading'); d.textContent=label||'loading renderer…'; return d; }
function plainPre(text,note){ const wrap=document.createElement('div');
  if(note) wrap.appendChild(el('div','fv-note',note));
  const pre=el('pre','filview'); pre.textContent=String(text??''); wrap.appendChild(pre); return wrap; }

/* ---------- individual renderers (each fills `host`, may throw → fallback) ---------- */
async function renderMarkdown(host,ctx){
  const md=el('div','fv-md');
  const text=String(ctx.text||'').slice(0,LIVE_ARTIFACT_LIMITS.maxFileBytes);
  let code=null, list=null;
  const safeLine=(line)=>line
    .replace(/!\[[^\]]*\]\([^)]*\)/g,'[embedded/remote image omitted]')
    .replace(/<\/?(?:img|video|audio|source|picture|iframe|object|embed)\b[^>]*>/gi,'[remote resource omitted]');
  for(const rawLine of text.split(/\r?\n/)){
    if(/^```/.test(rawLine)){ if(code){ md.appendChild(code); code=null; } else code=el('pre','filview fv-code'); list=null; continue; }
    if(code){ code.textContent+=(code.textContent?'\n':'')+rawLine; continue; }
    const line=safeLine(rawLine);
    const heading=/^(#{1,4})\s+(.*)$/.exec(line);
    if(heading){ list=null; md.appendChild(el('h'+heading[1].length,null,heading[2])); continue; }
    const item=/^\s*[-*+]\s+(.*)$/.exec(line);
    if(item){ if(!list){ list=el('ul'); md.appendChild(list); } list.appendChild(el('li',null,item[1])); continue; }
    list=null;
    if(/^>\s?/.test(line)){ md.appendChild(el('blockquote',null,line.replace(/^>\s?/,''))); continue; }
    if(!line.trim()){ md.appendChild(document.createElement('br')); continue; }
    md.appendChild(el('p',null,line));
  }
  if(code) md.appendChild(code);
  host.appendChild(md);
}
function parseCsvBounded(text,delimiter=','){
  const rows=[]; let row=[],field='',quoted=false;
  const pushField=()=>{ row.push(field.slice(0,8192)); field=''; };
  const pushRow=()=>{ pushField(); if(row.some((cell)=>cell!=='')) rows.push(row.slice(0,128)); row=[]; };
  for(let i=0;i<text.length&&rows.length<501;i++){
    const ch=text[i];
    if(quoted){ if(ch==='"'&&text[i+1]==='"'){ field+='"'; i++; } else if(ch==='"') quoted=false; else field+=ch; }
    else if(ch==='"') quoted=true;
    else if(ch===delimiter) pushField();
    else if(ch==='\n'){ pushRow(); }
    else if(ch!=='\r') field+=ch;
  }
  if(field||row.length) pushRow();
  return rows;
}
async function renderCsv(host,ctx){
  const N=500, rows=parseCsvBounded(String(ctx.text||''),ctx.ext==='tsv'?'\t':','); const shown=rows.slice(0,N);
  if(rows.length>N) host.appendChild(el('div','fv-note',`showing first ${N} rows`));
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
  const bytes=await fb.blob.arrayBuffer();
  const url=mkBlobURL(new Blob([bytes],{type:safeRenderMime(ctx.ext,ctx.kind)}));
  host.innerHTML='';
  const img=document.createElement('img'); img.className='fv-img'; img.alt=ctx.title;
  img.src=url;   // blob: URL — SVG too (NOT inline innerHTML)
  host.appendChild(img);
}
async function renderMedia(host,ctx,type){
  const fb=await fetchBlob(ctx.url); if(!fb) throw new Error(`${type} fetch failed`);
  ctx.realSize=fb.size; const bytes=await fb.blob.arrayBuffer();
  const url=mkBlobURL(new Blob([bytes],{type:safeRenderMime(ctx.ext,ctx.kind)}));
  host.innerHTML=''; const media=document.createElement(type); media.className=`fv-${type}`;
  media.controls=true; media.preload='metadata'; media.src=url; media.setAttribute('playsinline','');
  media.setAttribute('controlslist','nodownload noplaybackrate'); media.setAttribute('disablepictureinpicture','');
  media.setAttribute('aria-label',ctx.title); host.appendChild(media);
}
const renderAudio=(host,ctx)=>renderMedia(host,ctx,'audio');
const renderVideo=(host,ctx)=>renderMedia(host,ctx,'video');

function bytesLookTextual(bytes){
  const sample=bytes.subarray(0,Math.min(bytes.length,64*1024)); if(!sample.length) return true;
  let controls=0; for(const byte of sample){ if(byte===0) return false;
    if(byte<9||(byte>13&&byte<32)) controls++; }
  if(controls/sample.length>.02) return false;
  try{ new TextDecoder('utf-8',{fatal:true}).decode(sample); return true; }catch(e){ return false; }
}
function hexPreview(bytes,limit=512){
  const out=[]; const view=bytes.subarray(0,Math.min(limit,bytes.length));
  for(let i=0;i<view.length;i+=16){ const row=view.subarray(i,i+16);
    const hex=[...row].map((b)=>b.toString(16).padStart(2,'0')).join(' ').padEnd(47,' ');
    const ascii=[...row].map((b)=>b>=32&&b<=126?String.fromCharCode(b):'.').join('');
    out.push(`${i.toString(16).padStart(8,'0')}  ${hex}  |${ascii}|`); }
  return out.join('\n');
}
async function renderGeneric(host,ctx){
  const fb=await fetchBlob(ctx.url); if(!fb) throw new Error('artifact body unavailable');
  ctx.realSize=fb.size; const bytes=new Uint8Array(await fb.blob.arrayBuffer()); host.innerHTML='';
  const integrity=ctx.integrityVerified?'hash-checked':'unhashed';
  if(bytesLookTextual(bytes)){
    const text=new TextDecoder().decode(bytes), truncated=text.length>400*1024;
    host.appendChild(plainPre(text.slice(0,400*1024),truncated?`first 400 KB · ${integrity} generic text`:`generic ${integrity} text`));
    return;
  }
  const card=el('div','fv-card'); card.appendChild(el('div','fv-cardhd',`${ctx.ext||ctx.kind||'unknown'} · ${integrity} binary artifact`));
  const add=(label,value)=>{ const row=el('div','row'); row.appendChild(el('span','l2',label)); row.appendChild(el('span','v2',value)); card.appendChild(row); };
  add('Size',fmtBytes(bytes.length)); add('SHA-256',ctx.contentHash||(ctx.integrityVerified?'checked':'not advertised'));
  add('Rendering','safe generic inspector · executable content was not run'); host.appendChild(card);
  host.appendChild(el('div','fv-note',`hex preview · first ${Math.min(512,bytes.length)} bytes`));
  const pre=el('pre','filview fv-code fv-hex'); pre.textContent=hexPreview(bytes); host.appendChild(pre);
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
  const pre=el('pre','filview fv-code'); const code=document.createElement('code');
  code.textContent=body;
  pre.appendChild(code); host.appendChild(pre);
}
async function renderModel3d(host,ctx){
  await renderDescriptor(host,ctx);
  host.prepend(el('div','fv-note','Interactive 3D parsing is disabled in the credential-bearing portal. Download the verified bytes for an isolated CAD tool.'));
}
async function renderDescriptor(host,ctx){
  // .step / .kicad_* etc: no in-browser renderer → honest descriptor card,
  // byte-download action, + a plain-text head preview if the body is texty.
  host.innerHTML='';
  const card=el('div','fv-card');
  card.appendChild(el('div','fv-cardhd',`No in-browser viewer for .${ctx.ext||ctx.kind||'?'} — descriptor only`));
  const add=(l,v)=>{ const r=el('div','row'); r.appendChild(el('span','l2',l));
    r.appendChild(el('span','v2',v)); card.appendChild(r); };
  add('Kind',ctx.kind||ctx.ext||'—');
  add('Size',fmtBytes(ctx.realSize!=null?ctx.realSize:ctx.size));
  add('Content hash',ctx.contentHash||'—');
  host.appendChild(card);
  const dl=el('div','row');
  dl.innerHTML=secureDownloadMarkup(ctx.sourceUrl||ctx.url,ctx.title,ctx.contentHash);
  host.appendChild(dl);
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
  const bytes=await fb.blob.arrayBuffer();
  if(new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-') throw new Error('invalid PDF header');
  ctx.realSize=fb.size; const url=mkBlobURL(new Blob([bytes],{type:'application/pdf'}));
  host.innerHTML='';
  const obj=document.createElement('iframe'); obj.className='fv-pdf'; obj.src=url; obj.title=ctx.title;
  obj.setAttribute('sandbox',''); obj.referrerPolicy='no-referrer';
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
const RENDERERS={ markdown:renderMarkdown, csv:renderCsv, image:renderImage,audio:renderAudio,video:renderVideo,
  code:renderCode,model3d:renderModel3d,descriptor:renderDescriptor,pdf:renderPdf,plain:renderPlain,generic:renderGeneric };

function _lineDiffHTML(prior,current){
  const diff=boundedLineDiff(prior,current);
  const rows=diff.rows;
  // Preserve a little context around edits while keeping the drawer readable.
  const visible=new Set(); rows.forEach((row,i)=>{ if(row.kind!=='same') for(let j=Math.max(0,i-2);j<=Math.min(rows.length-1,i+2);j++) visible.add(j); });
  let skipped=false, html='';
  rows.forEach((row,i)=>{
    if(!visible.has(i)){ if(!skipped){ html+='<div class="diff-skip">unchanged lines omitted</div>'; skipped=true; } return; }
    skipped=false;
    html+=`<div class="diff-row ${row.kind}"><span class="diff-ln">${row.left??''}</span><span class="diff-ln">${row.right??''}</span><span class="diff-mark">${row.kind==='add'?'+':row.kind==='del'?'-':' '}</span><code>${esc(row.text)}</code></div>`;
  });
  return `<details class="live-diff" open><summary>Hash-checked prior/current text diff${diff.truncated?' · bounded preview':''}</summary><div class="diff-head"><span>prior</span><span>current</span><span></span><span>content</span></div>${html||'<div class="l2">No textual changes.</div>'}</details>`;
}

async function liveFileView(base,run,workspaceId,path){
  S.curBase=base;
  const state=liveArtifactState(base,run); const file=state?.files?.get(`${workspaceId}\u0000${path}`);
  if(!file){
    return {title:`<span class="kind k-artifact">LIVE FILE</span> ${esc(path)}`,
      html:`<div class="viewerr">This file was deleted from the live workspace. The prior hash remains in the run's change list, but there are no current bytes to render.</div>`};
  }
  const stateKey=_liveRunKey(base,run); const bodyKey=_liveFileStateKey(base,run,workspaceId,path);
  S.openLiveFile={stateKey,base,run,workspaceId,path,hash:file.sha256,bodyKey};
  const raw=!!(S.liveRawModes&&S.liveRawModes.get(bodyKey));
  return fileView(base,file.body_url,path,file.media_kind,{
    raw,size:file.size_bytes,contentHash:file.sha256,
    authoredLabels:authoredArtifactLabels(file),
    liveFile:{...file,run,revision:state.revision,generatedAt:state.generatedAt,bodyKey,source:state.source,
      terminalAtStart:Boolean(state.ended),endedAt:String(state.endedAt||'')},
  });
}

// fileView builds the header synchronously, then mounts the chosen renderer
// asynchronously into #fv-body, with a graceful <pre> fallback on any failure.
async function fileView(base,path,title,kind,opts){ S.curBase=base; opts=opts||{};
  const authoredLabels=artifactSemanticLabels({
    capability_summary:Array.isArray(opts.authoredLabels)?opts.authoredLabels:[],
  });
  const authoredAttr=JSON.stringify(authoredLabels);
  let pick=pickRenderer(title,kind);
  const sourceUrl=join(base,path);
  const forcedPlain=opts.raw===true;
  // Repository-owned .mjs registry takes precedence over built-in families for any
  // ext/kind it claims (richer viewers win). Resolved once; only used when this
  // is NOT a forced-plain/raw view (raw always shows the built-in plain text).
  let lazyPick=forcedPlain?null:pickLazyRenderer(title,kind);
  // fetchMode drives byte-vs-text fetch: a bytes module fetches its own
  // ArrayBuffer inside render(), so we must NOT do a pointless text prefetch.
  let lazyBytes=!!(lazyPick && lazyPick.entry.fetchMode==='bytes');
  // header media-kind label reflects the chosen renderer (lazy ext if matched).
  let lazyExt=lazyPick?lazyPick.ext:'';
  let isBinary=lazyPick?lazyBytes:BINARY_RENDERERS.has(pick.id);
  let rendId=forcedPlain?'plain':(lazyPick?('lazy:'+lazyPick.entry.file):pick.id);
  let verifiedDispatch=null, renderKind=kind;
  // text bodies fetched here; binaries deferred to their renderer (blob/buffer).
  let text=null, realSize=null, verified=null, url=sourceUrl, liveDiff='';
  const advertisedHash=String(opts.liveFile?.sha256||opts.contentHash||'').trim();
  const expectedHash=advertisedHash.replace(/^sha256:/i,'').toLowerCase();
  const hashAdvertised=!!advertisedHash, validExpectedHash=/^[a-f0-9]{64}$/.test(expectedHash);
  if(hashAdvertised){
    verified=validExpectedHash
      ?await fetchVerifiedLiveBody(sourceUrl,expectedHash)
      :{ok:false,checkOutcome:'failed',error:'invalid advertised SHA-256'};
    if(opts.liveFile){ const current=liveArtifactState(base,opts.liveFile.run);
      if(verified.ok&&!liveBodyCommitIsCurrent(opts.liveFile,current,S.openLiveFile)){
        verified={ok:false,checkOutcome:'failed',error:'stale live body response discarded'};
      }
    }
    if(verified.ok){
      realSize=verified.size;
      verifiedDispatch=resolveVerifiedArtifactDispatch(title,kind,verified.bytes);
      if(verifiedDispatch.detected&&!forcedPlain){
        renderKind=verifiedDispatch.selectionMediaKind;
        pick=pickRenderer(verifiedDispatch.selectionTitle,renderKind);
        lazyPick=pickLazyRenderer(verifiedDispatch.selectionTitle,renderKind);
        lazyBytes=!!(lazyPick&&lazyPick.entry.fetchMode==='bytes');
        lazyExt=lazyPick?lazyPick.ext:'';
        isBinary=lazyPick?lazyBytes:BINARY_RENDERERS.has(pick.id);
        rendId=lazyPick?('lazy:'+lazyPick.entry.file):pick.id;
      }
      if(!isBinary) text=new TextDecoder().decode(verified.bytes);
      const cache=opts.liveFile?S.liveArtifactBodyCache.get(opts.liveFile.bodyKey):null;
      if(opts.liveFile&&text!=null){
        let nextCache=cache;
        if(!cache||cache.hash!==opts.liveFile.sha256){
          nextCache={hash:opts.liveFile.sha256,text,
            previousHash:cache?.hash||'',previousText:cache?.text??null};
          S.liveArtifactBodyCache.set(opts.liveFile.bodyKey,nextCache);
          while(S.liveArtifactBodyCache.size>24) S.liveArtifactBodyCache.delete(S.liveArtifactBodyCache.keys().next().value);
        }
        if(nextCache?.previousText!=null&&nextCache.previousHash!==nextCache.hash){
          liveDiff=_lineDiffHTML(nextCache.previousText,nextCache.text);
        }
      }
    }
  } else if(!isBinary){
    // a forced-plain view of a binary would show garbage, so only fetch text for texty kinds
    text=await fetchText(url); realSize=text?text.length:null;
  }
  const ctx={ base, path, url,sourceUrl, title, kind:renderKind, ext:(lazyPick?lazyExt:pick.ext), text, realSize, size:opts.size,
    contentHash:advertisedHash||null,integrityVerified:!!verified?.ok };
  // a texty body that came back null (read-gated bytes / offline node / 404) would render
  // as a SILENT blank pane (the renderers consume the body and "succeed"); flag it.
  const bodyUnavailable=hashAdvertised?!verified?.ok:(!isBinary && !forcedPlain && text===null);
  const sizeLabel=realSize!=null?fmtBytes(realSize):(opts.size!=null?fmtBytes(opts.size):'—');
  const byteCheckLabel=verified?.ok?'BYTES CHECKED':
    (verified?.checkOutcome==='unavailable'?'BYTES NOT CHECKED':'BYTES CHECK FAILED/REFUSED');
  const liveAttr=opts.liveFile?' data-live="1"':'';
  const rawTog=forcedPlain
    ? `<a href="#" data-act="fv-rich"${liveAttr} data-path="${esc(path)}" data-title="${esc(title)}" data-kind="${esc(kind||'')}" data-semantics="${esc(authoredAttr)}" data-hash="${esc(opts.contentHash||'')}" data-size="${esc(opts.size??'')}">rich view ←</a>`
    : (rendId!=='plain'
        ? `<a href="#" data-act="fv-raw"${liveAttr} data-path="${esc(path)}" data-title="${esc(title)}" data-kind="${esc(kind||'')}" data-semantics="${esc(authoredAttr)}" data-hash="${esc(opts.contentHash||'')}" data-size="${esc(opts.size??'')}">raw text</a>`
        : '<span class="l2">raw</span>');
  let html=kv('File',esc(title))
    +kv('Media kind',`${esc(kind||ctx.ext||'—')} <span class="fv-rid">· ${esc(rendId)}</span>`)
    +(verifiedDispatch?.detected?kv('Detected format',`<span class="${verifiedDispatch.contradiction?'no':'ok'}">${verifiedDispatch.contradiction?icon('warn','ico-sm'):icon('check','ico-sm')} ${esc(verifiedDispatch.detected.label)}</span> <span class="l2">· ${esc(verifiedDispatch.detected.evidence)} · hash-checked bytes</span>`):'')
    +(verifiedDispatch?.contradiction?`<div class="viewerr artifact-format-contradiction">Advertised filename/media metadata conflicts with the verified byte header. Rendering uses the detected ${esc(verifiedDispatch.detected.label)} format; peer code was not executed.</div>`:'')
    +(verifiedDispatch?.inferred?`<div class="fv-note artifact-format-inferred">No usable format was advertised. The renderer was selected from the bounded header of the hash-checked bytes.</div>`:'')
    +(authoredLabels.length?kv('Authored role claims',authoredLabels.map((label)=>`<span class="cap">${esc(label)}</span>`).join(' ')):'')
    +`<div class="row"><span class="l2">Size</span><span class="v2 fv-size">${esc(sizeLabel)}</span></div>`
    +`<div class="row"><span class="l2">view</span><span class="v2">${rawTog} · `
    +`${secureDownloadMarkup(sourceUrl,title,opts.contentHash)}</span></div>`
    +(opts.liveFile?kv('Live revision',`<code class="exact-hash">${esc(opts.liveFile.revision)}</code>`)
      +kv('SHA-256',verified?.ok?`<span class="ok">${icon('check','ico-sm')} bytes checked</span> <code class="exact-hash">${esc(opts.liveFile.sha256)}</code>`
        :`<span class="no">${icon('x','ico-sm')} ${esc(verified?.error||'body unavailable')}</span>`)
      +`<div class="live-view-meta"><span class="transport-badge${verified?.ok?' verified':' failed'}">SNAPSHOT SIGNATURE CHECKED · ${byteCheckLabel}</span><span>${esc(opts.liveFile.mtime||opts.liveFile.generatedAt||'')}</span></div>`
      +(isBinary?'<div class="fv-note">Current hash-bound bytes are rerendered when the file changes. Geometric/media diff is not claimed for this format.</div>':'')+liveDiff
      :(hashAdvertised?kv('SHA-256',verified?.ok?`<span class="ok">${icon('check','ico-sm')} bytes checked</span> <code class="exact-hash">${esc(advertisedHash)}</code>`
        :`<span class="no">${icon('x','ico-sm')} ${esc(verified?.error||'body unavailable')}</span>`)
        +`<div class="live-view-meta"><span class="transport-badge${verified?.ok?' verified':' failed'}">ADVERTISED HASH · ${byteCheckLabel}</span></div>`:''))
    +`<div id="fv-body" class="fv-body"></div>`;
  // Built-in renderer path — the fallback used when no local module
  // matches, or when a matched local module throws (parse/empty).
  const runLegacy=async(host,lazyErr)=>{
    const legacyId=forcedPlain?'plain':pick.id;
    const r=RENDERERS[legacyId]||renderPlain;
    const legacyBinary=BINARY_RENDERERS.has(legacyId);
    // A local .mjs viewer was matched but failed (parse / no export),
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
      // Graceful fallback: local renderer/parse error → plain <pre>, never broken.
      host.innerHTML='';
      host.appendChild(el('div','fv-note','renderer unavailable ('+esc(e&&e.message||'error')+') — plain text'));
      let body=ctx.text;
      if(body==null){ body=legacyBinary?null:await fetchText(url); }
      if(body==null && legacyBinary){ host.appendChild(el('div','fv-note','body unavailable — the bytes are read-gated (read+ tier), the node is offline, or this file 404s. The byte-download action above may also be gated; hold an operator token.')); return; }
      host.appendChild(plainPre(String(body??'').slice(0,20000)));
    }
  };
  const mount=async(root)=>{
    const host=root.querySelector('#fv-body'); if(!host) return;
    if(bodyUnavailable){ host.innerHTML=''; host.appendChild(el('div','fv-note',opts.liveFile
      ?`live body refused: ${verified?.error||'unavailable'}. Nothing is rendered unless the fetched bytes match the advertised SHA-256.`
      :'body unavailable — the bytes are read-gated (read+ tier), the node is offline, or this file 404s. Use the byte-download action above, or hold an operator token.')); return; }
    if(verified?.ok){
      const mime=safeRenderMime(ctx.ext,ctx.kind);
      url=mkBlobURL(new Blob([verified.bytes],{type:mime})); ctx.url=url;
    }
    // LAZY MODULE FIRST (richer renderer). On ANY throw, clear and fall back to
    // the existing legacy renderer path exactly as before — never broken/blank.
    let lazyErr=null;
    if(lazyPick && !forcedPlain){
      // Immediate spinner: the local .mjs module import and body preparation
      // paints. Without this the drawer sits blank for that whole window. Every
      // module clears the host as its first paint, so this is replaced cleanly.
      host.innerHTML='';
      host.appendChild(loadingNode(`loading ${lazyPick.entry.label||ctx.ext||'rich'} viewer…`));
      try{
        const mod=await _lazyModule(lazyPick.entry.file);
        if(!mod || typeof mod.render!=='function') throw new Error('no render() export');
        // ctx per the module contract: createElement+textContent-safe el(),
        // authenticated fetchText/fetchBytes against the resolved body url,
        // local-only dependency guard and a view-scoped onCleanup.
        const mctx={ host, title, path, url, ext:ctx.ext, kind, size:opts.size, contentHash:ctx.contentHash,
          esc, el, lazy:_localDependencyOnly, onCleanup:onViewCleanup,
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
  const snapshotPath=L.snapshot||'telemetry/live/latest.json';
  const tel=await fetchJson(join(base,snapshotPath))||{};
  const publicEntity=isPublicEntityTelemetryDocument(tel);
  const publicAggregate=tel.schema==='personaos-live-telemetry-public/1';
  if(publicEntity) await verifyPublicCommunicationRoutes(base,tel);
  const admitted=publicEntity?await verifyPublicEntityDocument(base,snapshotPath,tel)
    :publicAggregate?await verifyPublicTelemetryFrame(base,tel):true;
  if(!admitted) return {title:`<span class="kind k-telemetry">TELEMETRY</span> ${esc(r.label)}`,
    html:'<div class="privacy-note">Public telemetry was refused because its current-master signature or exact public shape did not verify.</div>'};
  // Per-ENTITY feed record (telemetry:<persona>/<env> → its own redacted-tier
  // document): render the entity's live "inside" view and stream it in place.
  if(isPersonaTelemetryDocument(tel)||isEnvironmentTelemetryDocument(tel)){
    const isP=isPersonaTelemetryDocument(tel);
    S.drawerLiveKind=isP?'persona':'env';
    S.drawerLiveId=isP?tel.persona_id:tel.environment_id;
    S.drawerLiveKernel=r._kernel||tel.kernel_id||tel.node_id||kernelForBase(base);
    S.drawerLiveBase=base; S.drawerLiveFeed=L.snapshot||'';
    let html=kv('Feed',S0(r.label))
      +kv('Subject',`<span class="cap">${esc(isP?'persona':'environment')}</span> <code>${esc(S.drawerLiveId)}</code>`)
      +kv('Tier',isPublicEntityTelemetryDocument(tel)
        ?'public redacted — lifecycle, model status and route metadata only'
        :'redacted — span kinds / status / durations / transitions only (A-TF2)')
      +kv('Generated',S0(tel.generated_at))
      +kv('Access','consent-gated · content tier needs a read+ grant AND a consent pin (A-TF3)');
    html+=H(isP?'● Live · inside this persona':'● Live · inside this environment')
      +`<div id="livesec" class="livesec">${isP?renderPersonaFeedDoc(tel):renderEnvFeedDoc(tel)}</div>`;
    html+=trustPanel(r);
    return {title:`<span class="kind k-telemetry">TELEMETRY</span> ${esc(r.label)}`, html};
  }
  const k=tel.kernel||{}, personas=tel.personas||[], modelEvents=telemetryModelEvents(tel);
  const selected=modelEvents.filter((e)=>e.kind==='MODEL_SELECTED');
  const byPurpose={};
  for(const e of selected){ const pp=e.requested_purpose||e.role||'other'; byPurpose[pp]=(byPurpose[pp]||0)+1; }
  let html=kv('Feed',S0(r.label))
    +kv('Reason',S0(tel.reason))
    +kv('Lineage durable',k.lineage_durable?`<span class="ok">${icon('check','ico-sm')} durable</span>`:'<span class="no">in-memory only</span>')
    +kv('Signed spans',S0((k.spans||[]).length))
    +kv('Model-selection events',S0(selected.length))
    +kv('Access','consent-gated · read+ (operator) or public-telemetry opt-in');
  if(publicAggregate) html+=H('Verified model status')+_verifiedPublicModelStatusHTML(tel);
  if(!publicAggregate&&Object.keys(byPurpose).length){
    html+=H('Model selection by purpose');
    html+=Object.entries(byPurpose).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([kk,v])=>
      `<div class="grant"><span class="l2">${esc(kk)}</span><span class="ok">${esc(v)}</span></div>`).join('');
  }
  const recent=selected.slice(-8).reverse();
  if(!publicAggregate&&recent.length){
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
  const lifecycle=publicTaskLifecycleProjection(r);
  if(lifecycle){
    html+=H('Exact public lifecycle')
      +kv('State',`<span class="ok">${esc(lifecycle.state)}</span>`)
      +kv('Run',`<code>${esc(lifecycle.run)}</code>`)
      +kv('Task id',`<code>${esc(lifecycle.taskId)}</code>`)
      +kv('Revision',`<code>${esc(lifecycle.revision)}</code>`)
      +kv('Terminal reason',lifecycle.terminalReason
        ?`<span class="amber">${esc(lifecycle.terminalReason)}</span>`:'<span class="l2">active / non-terminal</span>');
    for(const [label,value] of [['Pressure',lifecycle.pressure],['Review',lifecycle.review],['Block',lifecycle.block]]){
      if(!value||typeof value!=='object'||!Object.keys(value).length) continue;
      html+=H(label)+`<pre class="filview">${esc(JSON.stringify(value,null,2))}</pre>`;
    }
    html+=`<div class="fv-note"><span class="ok">${icon('check','ico-sm')} kernel signature and content-hash revision verified</span> · anonymous read-only lifecycle projection; no operator capability is present.</div>`;
  }
  html+=H('Capabilities')+chipsOf(r.capability_summary)+H(`Access · outward ${esc(a.outward_tier||r.visibility_tier)}`)+gh
    +H('Source')+(r._url?`<div class="row"><a href="${esc(safeUrl(r._url))}" target="_blank" rel="noopener">signed record JSON →</a></div>`
      :'<div class="row"><span class="l2">withheld · discover-only metadata projection</span></div>');
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
  const domainEnv=envRecordForAuthority(r);
  if(domainEnv.recordId) html+=H('Used by')+`<div class="row">${recLink(domainEnv.recordId,'Environment →')}</div>`;
  else if(['ambiguous','conflict'].includes(domainEnv.authority.status))
    html+=H('Used by')+`<div class="row"><span class="amber">Environment routing unresolved</span><span class="l2">${esc(domainEnv.authority.candidates.length)} verified candidates · no selection</span></div>`;
  return {title:`<span class="kind k-domain">DOMAIN</span> ${esc(d.name||r.label)}`, html};
}
async function projectView(r){ const base=r._base||'',L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v); S.curBase=base;
  // Project export (04_PROJECT): project/3 has open multi-environment hosting.
  // Only export/2's canonical hosts + primary designation are rendered as
  // topology; the removed singular environment_id/env_id aliases never regain
  // presentation authority through an old document.
  const d=(L.export?await dfetch(base,L.export):null)||{};
  const rawMembers=d.members||{};
  const members=Array.isArray(rawMembers)
    ?rawMembers.map((m)=>typeof m==='string'?{persona_id:m,role:''}:m).filter((m)=>m&&m.persona_id)
    :Object.entries(rawMembers).map(([personaId,value])=>typeof value==='object'&&value!==null
      ?{...value,persona_id:value.persona_id||personaId}
      :{persona_id:personaId,role:String(value||'')});
  const hasCanonicalTopology=d.schema==='personaos-project-export/2'&&Array.isArray(d.environments);
  const hostValues=hasCanonicalTopology
    ?d.environments.map((value)=>String(value||'').trim()).filter(Boolean):[];
  const hosts=[...new Set(hostValues)];
  const primary=String(d.primary_environment_id||'').trim();
  const topologyValid=hasCanonicalTopology&&hostValues.length===hosts.length
    &&((hosts.length===0&&!primary)||(hosts.length>0&&hosts.includes(primary)));
  let html=kv('Project',S0(d.project_id||r.did))+kv('Name',S0(d.name||r.label))
    +kv('Hosted environments',topologyValid?S0(hosts.length):'<span class="no">invalid / unavailable</span>')
    +(topologyValid&&hosts.length?kv('Primary environment',`<code>${esc(primary)}</code>`):'')
    +kv('Members',S0(members.length||'—'))
    +(d.bundle_id?kv('Deliverable bundle',`<code>${esc(d.bundle_id)}</code>`):'');
  if(topologyValid&&hosts.length) html+=H(`Environments (${hosts.length})`)+hosts.map((environmentId)=>{
    const rid=S.order.find((id)=>{ const candidate=S.recs.get(id);
      return candidate&&candidate.kind==='env'&&candidate._kernel===r._kernel
        &&(_envSid(candidate)===_envSidFromValue(environmentId)
          ||String(candidate.did||'').includes(environmentId)); });
    const label=environmentId===primary?`${environmentId} · primary`:environmentId;
    return `<div class="grant"><span>${rid?recLink(rid,label):`<code>${esc(label)}</code>`}</span>`
      +`<span class="l2">${environmentId===primary?'PRIMARY':'HOST'}</span></div>`;
  }).join('');
  else if(d.schema&&d.schema!=='personaos-project-export/2') html+=`<div class="viewerr">${icon('warn','ico-sm')} Legacy singular project-host topology was refused; republish this project with export/2.</div>`;
  if(members.length) html+=H(`Members (${members.length})`)+members.slice(0,10).map((m)=>{
    const rid=findRecByDid(m.persona_id,r._kernel)||findRecByDid('did:personaos:'+m.persona_id,r._kernel);
    return `<div class="grant">${rid?recLink(rid,m.role||m.persona_id):esc(m.role||m.persona_id)}<span class="l2">${esc(m.role||'')}</span></div>`;
  }).join('');
  html+=trustPanel(r);
  let nav=''; const did=kernelRec(r._kernel,'domain');
  if(did) nav+=`<div class="row">${recLink(did,'Domain →')}</div>`;
  if(L.bundle) nav+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(L.bundle)}">Deliverable bundle →</a></div>`;
  if(nav) html+=H('Related')+nav;
  return {title:`<span class="kind k-project">PROJECT</span> ${esc(d.name||r.label)}`, html};
}
async function bodyView(base,runUrl){ S.curBase=base; const rj0=await dfetch(base,runUrl);
  if(!rj0) return {title:`<span class="kind k-persona">BODY · J7</span> codex run`,
    html:`<div class="viewerr">run document could not be loaded — the node may be offline or the body is read-gated; paste the captured process bearer. If HTTPS blocks an HTTP node, open its console and use the same bearer there.</div>`};
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
    html:`<div class="viewerr">run document could not be loaded — the node may be offline or the body is read-gated; paste the captured process bearer. If HTTPS blocks an HTTP node, open its console and use the same bearer there.</div>`};
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
    html:`<div class="viewerr">distribution documents could not be loaded — the node may be offline or the bodies are read-gated; paste the captured process bearer. If HTTPS blocks an HTTP node, open its console and use the same bearer there.</div>`};
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
// console. Read-gated like the run endpoint itself: only the operator bearer
// returns the doc; an anonymous viewer gets an honest pointer, never a fake.
async function planSection(base,run){
  if(!run) return '';
  const doc=await dfetch(base,'runs/'+encodeURIComponent(run));
  // run_state is operator-tier (09_PROTOCOLS §3G.3): no token (or a tunneled node
  // without one) -> no plan to show. Say WHY + HOW to unlock instead of nothing.
  if(!doc||(!doc.run_state&&!doc.design_history)){
    return H('Plan')+`<div class="l2">${icon('key','ico-sm')} this mission's charter, objectives and round-by-round trajectory are <b>read-gated</b> (operator tier). Click <b>OPERATOR</b> and paste this node's captured process bearer. If HTTPS blocks its HTTP route, open the node's console and use the same bearer there to see the plan for <code>${esc(run)}</code>.</div>`;
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
  if(r.status===401||r.status===403) hint='authorization failed — this node rejected the token. Re-check it in the OPERATOR console (forget, then re-paste).\n\n';
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
  try{ const r=await fetch(u,secureFetchInit(u,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
    const d=await r.json().catch(()=>({})); return {status:r.status,body:d}; }
  catch(e){ let msg=String(e&&e.message||e);
    if(location.protocol==='https:'&&/^http:\/\//i.test(u))
      msg+=` — this page is HTTPS and browsers block calls to an HTTP node. Open the node's own console directly at ${opBaseKey(base)}/, then paste and use the captured process bearer there.`;
    return {status:0,body:{error:msg}}; } }

async function operatorView(){
  const m=opTokens();
  // Surface loopback nodes automatically for convenience, but never treat network
  // position as authority. The same bearer-token rule applies locally and remotely.
  const localBases=[...new Set([...peerList().map(opBaseKey).filter(isLocalBase),
    ...(isLocalBase(location.origin)?[opBaseKey(location.origin)]:[])])];
  const bases=[...new Set([...Object.keys(m),...localBases])];
  let html=H('Operator authority — bearer token')
    +`<div class="desc2">Each node mints a process bearer at boot and temporarily stages it at `
    +`<code>runs/…/_operator/token</code> until the first model call. Paste it here to unlock a node's owner intake `
    +`(ASK / FUND / STOP / ATTEST), full status, runs and personas. Loopback is a convenient `
    +`route, not authority: <b>local and remote nodes both require the token</b>.</div>`;
  html+=H('Add a node')+`<div class="opform">`
    +`<label class="field"><span class="field-label">node base URL</span>`
    +`<input id="op-base" type="url" placeholder="e.g. http://localhost:8765" value="${esc(opBaseKey(peerList()[0]||''))}"></label>`
    +`<label class="field"><span class="field-label">operator token</span>`
    +`<input id="op-token" type="password" placeholder="paste the captured process bearer"></label>`
    +`<button class="btn btn-primary" data-act="op-save">SAVE</button></div><div id="op-save-msg" class="l2" role="status" aria-live="polite"></div>`;
  html+=H(`Operator nodes (${bases.length})`);
  for(const b of bases){ const loc=isLocalBase(b), tokd=!!(m[b]);
    html+=`<div class="grant"><span>${esc(b)}${loc?' <span class="l2">· local route</span>':''}</span>`
    +`<span><a href="#" data-act="op-node" data-base="${esc(b)}">console →</a>`
    +(tokd?` · <a href="#" data-act="op-del" data-base="${esc(b)}">forget ${icon('x','ico-sm')}</a>`:'')+`</span></div>`; }
  if(!bases.length) html+=`<div class="l2">no operator tokens saved and no local node discovered — this browser is an anonymous public viewer. Run a node locally (it appears here automatically), then paste its token.</div>`;
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
        ?` — this page is served over <b>HTTPS</b> and browsers block it from calling an <b>HTTP</b> node. Open the node's own console directly, then paste and use the captured process bearer there: <a href="${esc(key)}/" target="_blank" rel="noopener">${esc(key)}/</a>`
        :` — check the node is running and reachable at <code>${esc(key)}</code>.`)+`</div>`;
    return {title:`<span class="kind k-env">OPERATOR</span> ${esc(key)}`,html};
  }
  if(!pub&&!tokd) html+=`<div class="desc2"><span class="ok">operator projection granted by node policy</span>.</div>`;
  else if(pub) html+=`<div class="desc2"><span class="no">token missing or rejected</span> — the node returned its public projection. Paste this node's bearer token in the operator console.</div>`;
  html+=kv('Node',S0(st.node_id))+kv('Backend',S0(st.backend)+' · '+S0(st.active_model))
    +kv('Lineage',st.lineage_durable?`<span class="ok">${icon('check','ico-sm')} durable</span>`:(pub?'—':'<span class="no">in-memory only</span>'))
    +kv('Budget',S0(st.budget_candidates)+' cand/task · pending '+S0(st.pending_budget??0))
    +kv('Artifact tier',S0(st.artifact_tier))
    +kv('Public discovery',st.public_discovery?`<span class="ok">on</span> (${esc((st.public_discovery_kinds||[]).join(', '))})`:'off');
  const personas=st.personas||[];
  if(personas.length) html+=H(`Personas (${personas.length})`)+personas.map((p)=>{
    const call=(st.active_model_calls||[]).find((c)=>_shortId(c.persona_id)===_shortId(p.persona_id));
    const taskState=p.task_execution_state||'unmarked', llmState=p.llm_execution_state||'unmarked';
    return `<div class="persona-runtime-row"><div><b>${esc(p.name||p.persona_id)}</b>`
      +`<span class="runtime-pills"><span class="runtime-pill ${taskState==='running_llm'?'hot':''}">${esc(taskState.replace(/_/g,' '))}</span><span class="runtime-pill">LLM ${esc(llmState.replace(/_/g,' '))}</span></span></div>`
      +(call?`<div class="runtime-call"><span class="livedot2"></span>${esc(PURPOSE_LABEL[call.requested_purpose]||call.requested_purpose||'model call')} · <code>${esc(call.model_id||'—')}</code>${call.role?` · ${esc(call.role)}`:''}</div>`
        :`<div class="l2">${esc(p.lifecycle_state||'')} · ${esc(p.experience_tasks??0)} task(s)</div>`)+`</div>`;
  }).join('');
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
      ?`operator-only — attestation requests appear here once you have owner access. Paste the captured process bearer; if needed, open the node's localhost UI and use the same bearer there.`
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

function _runRuntimeSurfaces(st){
  const rs=st?.run_state||{}; const durable=st?.durable_run_state||{}; const dh=st?.design_history||{};
  const candidates=[rs?.runtime,durable?.runtime,dh?.runtime,rs,durable,dh].filter((x)=>x&&typeof x==='object');
  const take=(...names)=>{ for(const obj of candidates) for(const name of names){
    if(obj[name]!==undefined&&obj[name]!==null&&obj[name]!=='') return obj[name]; } return null; };
  const pressure=take('pressure_open','runtime_pressure_open','active_pressure');
  const block=(pressure&&typeof pressure==='object'&&(pressure.completion_block_reason||pressure.block_reason))
    ||take('completion_block_reason','block_reason');
  const review=take('review_eligibility','review_eligible','eligible_for_review','artifact_review_eligibility');
  const activePressure=take('active_pressure_appraisals','active_pressure_count');
  return {pressure,block,review,activePressure};
}

async function operatorRunView(b,run){
  S.curBase=b;
  const trackKey=_liveRunKey(b,run); S.trackedLiveRuns.set(trackKey,{base:b,run,lastSeen:Date.now()});
  const hasOperatorStatus=!!tokenFor(join(b,'status'));
  const [stRaw,artsRaw,_live,nodeStatus]=await Promise.all([
    hasOperatorStatus?fetchJson(join(b,'runs/'+encodeURIComponent(run))):Promise.resolve(null),
    hasOperatorStatus?fetchJson(join(b,'runs/'+encodeURIComponent(run)+'/artifacts')):Promise.resolve(null),
    fetchLiveArtifacts(b,run),
    fetchNodeStatus(b),
  ]);
  const st=stRaw||{}, arts=artsRaw||{};
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  const rs=st.run_state||{};
  const liveState=liveArtifactState(b,run)||_live;
  const publicTask=_verifiedPublicTaskForRun(
    String(liveState?.snapshot?.node_id||nodeStatus?.node_id||kernelForBase(b)||''),
    run,
  );
  const finalizedBootstrap=liveState?.verification?.immutableFinalizedBootstrap===true;
  const terminal=Boolean(liveState?.ended
    &&(liveState?.verification?.terminalEventVerified||finalizedBootstrap));
  const stt=terminal?'ended':String(rs.status||'—');
  const stClass=terminal?'l2':((stt==='shipped'||stt==='completed'||rs.accepted)?'ok':(stt==='running'||stt==='queued'?'amber':'no'));
  // a paused mission card opens this view directly, so give it inline resume/stop
  // controls (it is otherwise read-only). The handlers prefer a.dataset.run over the
  // console-level #op-run-target, and read #opr-budget when present.
  const canOperate=!terminal&&hasOperatorStatus;
  let html=canOperate?('<div class="opform"><div class="oprow">'
    +'<label class="field"><span class="field-label">add budget</span><input id="opr-budget" type="number" min="1" placeholder="candidates"></label>'
    +'<button class="btn" data-act="op-fund" data-base="'+esc(b)+'" data-run="'+esc(run)+'" title="add budget to THIS run — resumes it if paused">'+icon('fund')+' FUND</button>'
    +'<button class="btn btn-stop" data-act="op-stop" data-base="'+esc(b)+'" data-run="'+esc(run)+'" title="halt THIS run">'+icon('stop')+' STOP</button></div>'
    +'<pre id="op-out" class="opout" role="status" aria-live="polite"></pre></div>')
    :'<div class="l2">Read-only live monitor. Save this node\'s operator bearer token to enable FUND and STOP.</div>';
  html+=kv('Run',`<code>${esc(run)}</code>`)
    +kv('Status',`<span class="${stClass}">● ${esc(stt)}</span>`)
    +kv('Accepted',rs.accepted?`<span class="ok">${icon('check','ico-sm')} yes</span>`:'<span class="no">no</span>')
    +kv('Task class',S0(rs.task_class))+kv('Pathway',S0(rs.acceptance_pathway))
    +kv('Task',S0((rs.task||publicTask?.task||'').slice(0,200)));
  const activeCalls=terminal?[]:(nodeStatus?.active_model_calls||[]).filter((call)=>{
    const current=liveState?.snapshot?.active?.calls||[];
    return !current.length||current.some((item)=>item.call_id&&item.call_id===call.call_id);
  });
  const liveCalls=terminal?[]:(liveState?.snapshot?.active?.calls||activeCalls);
  html+=H(terminal
    ?`Execution · ${finalizedBootstrap?'finalized-snapshot':'terminal-event'} signature checked`
    :'Live execution · unsigned status telemetry');
  if(liveCalls.length) html+=liveCalls.map((call)=>{
    const pid=_shortId(call.persona_id); const purpose=call.requested_purpose||call.purpose||'model call';
    return `<div class="live-call"><span><span class="livedot2"></span><b>${esc(_nameFor(pid,st.node_id||kernelForBase(b))||pid||'persona')}</b> · ${esc(PURPOSE_LABEL[purpose]||purpose)}</span>`
      +`<span><code>${esc(call.model_id||'—')}</code>${call.role?` · ${esc(call.role)}`:''}</span></div>`;
  }).join('');
  else html+=terminal
    ?`<div class="l2">The signature-checked ${finalizedBootstrap?'finalized snapshot':'run-ended event'} cleared active execution; no model call remains active.</div>`
    :'<div class="l2">No model call is active at this instant; the run may be coordinating between calls.</div>';
  const runtime=terminal?{pressure:null,block:null,review:null,activePressure:null}:_runRuntimeSurfaces(st);
  const inPressure=liveCalls.some((call)=>/pressure/.test(String(call.requested_purpose||'')));
  const inReview=liveCalls.some((call)=>/review/.test(String(call.requested_purpose||'')));
  html+=kv('Pressure',runtime.pressure||runtime.activePressure||inPressure
      ?`<span class="amber">${inPressure?'appraisal in progress':'open / recorded'}</span>`
      :'<span class="l2">none exposed</span>')
    +kv('Completion block',runtime.block?`<span class="no">${esc(runtime.block)}</span>`:'<span class="l2">none exposed</span>')
    +kv('Review eligibility',runtime.review!==null?esc(typeof runtime.review==='object'?JSON.stringify(runtime.review):runtime.review)
      :(inReview?'<span class="amber">review in progress</span>':'<span class="l2">not exposed</span>'));
  html+=H('Live workspace files')
    +`<div data-live-run-key="${esc(_liveRunDomKey(b,run))}" role="region" aria-label="Live workspace updates" aria-live="polite">${liveArtifactsHTML(b,run)}</div>`;
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
  // `/runs/<run>` and `/runs/<run>/artifacts` are operator status documents, not
  // browser-validated AnswerPackage or ArtifactBundle envelopes. Schema strings,
  // `signed_by` truthiness, verifier-shaped objects, and lifecycle state strings in
  // those raw documents have no admission authority. No validated bundle projection
  // reaches this view yet, so lifecycle must remain unknown here.
  html+=H('AnswerPackage / ArtifactBundle lifecycle')
    +kv('Lifecycle','<span class="l2 bundle-lifecycle-unknown">unknown</span>')
    +'<div class="fv-note">Run status and artifact-index JSON are not browser-validated bundle lifecycle evidence. A lifecycle state requires a separately browser-validated bundle plus verifier evidence bound to its current content hash.</div>';
  const files=arts.package||arts.package_files||arts.files||[];
  if(files.length) html+=H(`Package artifacts (${files.length})`)+files.slice(0,100).map((f)=>{
    const path=typeof f==='string'?f:(f.path||f.title||'');
    const name=String(path).split('/').pop();
    return `<div class="grant"><span class="l2">${esc(name)}</span><span class="l2">${esc(String(path).includes('/')?path.split('/').slice(0,-1).join('/'):'')}</span></div>`;
  }).join('');
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
    if(cpath) return fileView(_b, /k\/run-/.test(_b)?cpath:_bodyPath(cpath,runOf(r)), r.label, L.media_kind,{
      authoredLabels:authoredArtifactLabels(r),
      contentHash:L.content_hash||r.content_hash||null,
    });
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
  S.openLiveFile=null;
  S.drawerLiveKind=null; S.drawerLiveId=null; S.drawerLiveKernel=''; S.drawerLiveFeed=null; S.drawerLiveBase=''; S.drawerThinkPid=null;   // the view sets these if it streams
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
function markInspectionSource(source){
  if(S._detailSource){ S._detailSource.classList.remove('inspecting'); S._detailSource.setAttribute('aria-expanded','false'); }
  const card=source?.closest?.('.pcard,.env-card')||null; S._detailSource=card;
  S._detailSourceRef=card?.classList.contains('pcard')
    ?{kind:'persona',key:String(card.dataset.pkey||''),sid:String(card.dataset.pcard||''),kernel:String(card.dataset.pkernel||'')}
    :card?.classList.contains('env-card')
      ?{kind:'environment',sid:String(card.dataset.envsid||''),kernel:String(card.dataset.envkernel||'')}:null;
  if(card){ card.classList.add('inspecting'); card.setAttribute('aria-expanded','true'); card.setAttribute('aria-controls','detailwrap'); }
  document.body.classList.add('detail-open');
}
// Live telemetry can repaint the card deck while its inspector is open. Keep
// the dialog anchored to the newly rendered card instead of retaining a
// detached element and silently losing aria-expanded/source focus context.
function rebindInspectionSource(){
  if(!document.body.classList.contains('detail-open')||!S._detailSourceRef) return;
  const ref=S._detailSourceRef;
  const cards=ref.kind==='persona'?document.querySelectorAll('.pcard'):document.querySelectorAll('.env-card');
  const card=[...cards].find((candidate)=>ref.kind==='persona'
    ?((ref.key&&candidate.dataset.pkey===ref.key)
      ||(!ref.key&&candidate.dataset.pcard===ref.sid&&candidate.dataset.pkernel===ref.kernel))
    :(candidate.dataset.envsid===ref.sid&&candidate.dataset.envkernel===ref.kernel));
  if(!card) return;
  const previous=S._detailSource;
  if(previous&&previous!==card){ previous.classList.remove('inspecting'); previous.setAttribute('aria-expanded','false'); }
  S._detailSource=card; card.classList.add('inspecting'); card.setAttribute('aria-expanded','true'); card.setAttribute('aria-controls','detailwrap');
  if(S._lastFocus===previous||!S._lastFocus?.isConnected) S._lastFocus=card;
}
function openDetail(id,source){ S._topIsOp=false; S._lastFocus=document.activeElement; markInspectionSource(source||document.activeElement);
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
// Cards come from three honest sources: (1) signed public task/project/mission
// records as published evidence, with signed terminal/live-task state overlays;
// (2) live artifact snapshots; (3) the node's /status —
// running/paused mission state, which the node only exposes to an operator
// token (anonymous viewers see the public projection without run state).
// A mission document is the run's Design-History-File artifact. Media kinds are
// EMERGENT registry values (a run may classify it structured_data), so match the
// canonical filename too — the label rides inside the signed record.
function _isMissionDoc(r,L){ return L.media_kind==='design_history'
  || /(^|\/)design_history\.json$/i.test(r.label||''); }
function missionCardList(){
  const cards=[]; const seen=new Set();
  const records=S.order.map((id)=>S.recs.get(id)).filter(Boolean);
  const projects=records.filter((r)=>r.kind==='project');
  const projectFor=(kernel,run='')=>projects.find((p)=>p._kernel===kernel&&run&&runOf(p)===run)
    ||[...projects].reverse().find((p)=>p._kernel===kernel);
  const humanTask=(value,kernel,run='')=>{ const raw=String(value||'').trim();
    if(!raw||/^run[-:]/i.test(raw)||/\.json$/i.test(raw))
      return _verifiedPublicTaskForRun(kernel,run)?.task||projectFor(kernel,run)?.label||'Untitled mission';
    return raw; };
  // Record structure decides admission; capability vocabulary never assigns
  // task state. A task card requires its independently signed lifecycle object;
  // project/mission records remain published evidence. Design-history JSON is
  // evidence owned by the mission, never a second mission card.
  for(const [id,r] of S.order.map((id)=>[id,S.recs.get(id)])){
    const published=publishedMissionEvidenceProjection(r); if(!published) continue;
    const lifecycle=publicTaskLifecycleProjection(r);
    if(r.kind==='task'&&!lifecycle) continue;
    const projected=lifecycle||published;
    const run=projected.run||runOf(r)||'';
    const lifecycleSurfaces=lifecycle?[
      Object.keys(lifecycle.pressure||{}).length?'pressure':'',
      Object.keys(lifecycle.review||{}).length?'review':'',
      Object.keys(lifecycle.block||{}).length?'block':'',
    ].filter(Boolean):[];
    const meta=lifecycle
      ?[lifecycle.taskId.slice(0,26),`rev ${lifecycle.revision.slice(7,19)}`,
        lifecycleSurfaces.join(' · '),lifecycle.terminalReason?`terminal ${lifecycle.terminalReason}`:'signed live lifecycle']
      :[run?run.slice(0,26):'',`signed ${published.kind} record`];
    const card={key:`record:${r._kernel}:${run||id}`,task:projected.task,state:projected.state,
      kernel:r._kernel||'',meta,recId:id,run,recordKind:published.kind,
      terminalTask:!!lifecycle?.terminalTask,liveTask:!!lifecycle?.liveTask,
      exactLifecycle:!!lifecycle};
    if(lifecycle) cards.unshift(card); else cards.push(card);
  }
  // Public artifact-tier nodes can expose a kernel-signed live workspace snapshot even
  // when /status remains operator-gated. Surface those active runs as read-only
  // monitors; opening one still verifies every fetched file body against sha256.
  for(const state of S.liveArtifacts.values()){
    const nodeRun=_liveRunKey(state.base,state.run);
    if(state.ended||Date.now()-(state.receivedAt||0)>20000||seen.has(nodeRun)) continue;
    seen.add(nodeRun);
    const nodeId=state.snapshot?.node_id||'';
    const project=projectFor(nodeId,state.run);
    const active=state.snapshot?.active||{};
    const calls=(active.calls||[]).length;
    const activeNow=calls>0||(active.persona_ids||[]).length>0
      ||(active.environment_ids||[]).length>0;
    const card={key:'live:'+nodeRun,
      task:humanTask(project?.label||state.snapshot?.task,nodeId,state.run),
      state:activeNow?'running':'published',kernel:nodeId||kernelForBase(state.base),
      meta:[state.run.slice(0,26),`${state.files.size} ${activeNow?'live':'verified'} files`,
        calls?`${calls} model call${calls===1?'':'s'}`:''],base:state.base,run:state.run};
    if(activeNow) cards.unshift(card); else cards.push(card);
  }
  // skip STALE cache entries: if a node goes unreachable, fetchNodeStatus only WRITES
  // on success, so a vanished node's last 'run-X RUNNING' would otherwise linger here as
  // a phantom card forever. Drop entries older than ~4 poll windows of the 8s serve-TTL.
  const fresh=Date.now()-32000;
  for(const [baseKey,hit] of statusCache){ const base=baseKey==='@origin'?'':baseKey; const v=hit&&hit.v; if(!v) continue;
    if(!(hit.ts>fresh)) continue;
    const busy=String((v.heartbeat||{}).busy||'');
    for(const run of (v.stoppable_runs||[])){ const nodeRun=_liveRunKey(base,run);
      if(seen.has(nodeRun)||S.liveArtifactEnded.has(nodeRun)) continue; seen.add(nodeRun);
      const live=liveArtifactState(base,run); const files=live?.files?.size||0;
      const calls=(live?.snapshot?.active?.calls||[]).length;
      const kernel=kernelForBase(base);
      cards.unshift({key:'run:'+nodeRun,task:humanTask(busy,kernel,run),state:'running',kernel,meta:[run.slice(0,26),files?`${files} live files`:'',calls?`${calls} model call${calls===1?'':'s'}`:''],base,run}); }
    for(const p of (v.paused_missions||[])){
      const run=String(p.run||p.run_id||p); const nodeRun=_liveRunKey(base,run); if(!run||seen.has(nodeRun)) continue; seen.add(nodeRun);
      const kernel=kernelForBase(base);
      cards.push({key:'pause:'+nodeRun,task:humanTask(p.task,kernel,run),state:'paused',kernel,
        meta:[run.slice(0,26),String(p.status||'')],base,run}); } }
  const scoped=S.kernelFocus?cards.filter((card)=>card.kernel===S.kernelFocus):cards;
  const grouped=new Map();
  const rank=(card)=>card.state==='running'?7:card.terminalTask?6:card.liveTask?5:card.state==='paused'?3
    :card.recordKind==='task'?2:card.state==='published'?1:0;
  for(const card of scoped){ const key=`${card.kernel}::${String(card.task).toLowerCase().replace(/\s+/g,' ').trim()}`;
    const prev=grouped.get(key); if(!prev){ grouped.set(key,{...card,meta:[...(card.meta||[])]}); continue; }
    const winner=rank(card)>rank(prev)?card:prev;
    grouped.set(key,{...prev,...winner,key,meta:[...new Set([...(prev.meta||[]),...(card.meta||[])])].filter(Boolean).slice(0,4)}); }
  const result=[...grouped.values()];
  const byKernel=new Map();
  for(const card of result) (byKernel.get(card.kernel)||byKernel.set(card.kernel,[]).get(card.kernel)).push(card);
  for(const [kernel,kernelCards] of byKernel){
    // A kernel-wide terminal event can be bound to a mission headline only when
    // there is exactly one published task candidate on that kernel. With
    // multiple tasks, keep the failure on its exact persona/environment cards
    // instead of guessing which signed task it belongs to.
    const publishedCards=kernelCards.filter((card)=>
      card.state==='published'&&card.recordKind==='task');
    if(publishedCards.length!==1) continue;
    const failure=S.terminalModelFailureByKernel?.get(kernel); if(!failure) continue;
    const active=[...(S.activeModelCallsByPersona||new Map()).entries()].some(([key,calls])=>
      splitNetworkKey(key)?.kernelId===kernel&&(calls||[]).length>0);
    if(active) continue;
    const card=publishedCards[0], detail=[failure.model||'',failure.status?`HTTP ${failure.status}`:'']
      .filter(Boolean).join(' · ');
    card.state='failed'; card.terminalFailure=true;
    const failureMeta=`unsigned live telemetry · model call failed${detail?` · ${detail}`:''}`;
    card.meta=[failureMeta,...(card.meta||[]).filter((value)=>value!==failureMeta)]
      .filter(Boolean).slice(0,4);
  }
  return result;
}
// The strip needs each node's run state (the token-gated part of /status);
// prefetch statuses for every discovered base so running/paused missions show
// without first opening a drawer. Anonymous viewers get the public projection
// (no run state) and the strip stays honest — records only.
function prefetchNodeStatuses(){
  const candidates=[...S.boots.keys()].map((key)=>{ const base=key==='@origin'?'':key;
    return {base,focused:!!S.kernelFocus&&baseIsFocused(base),active:(S.activeModelCallsByBase?.get(key)||[]).length>0,
      priority:(S.activeModelCallsByBase?.get(key)||[]).length}; }).filter((row)=>!S.kernelFocus||row.focused);
  const window=selectMonitoringBases(candidates,{limit:NETWORK_LIMITS.monitoredBases,hardLimit:64});
  for(const base of window.bases){
    fetchNodeStatus(base).then(()=>{ renderMissions(); pollLiveArtifacts(); }).catch(()=>{}); }
}
function renderMissions(){
  const box=$('#missions'), wrap=$('#missionCards'), count=$('#missionCount'), headline=$('#missionHeadline'),
    eyebrow=$('#missionEyebrow'); if(!box||!wrap) return;
  const cards=missionCardList();
  box.hidden=!cards.length;
  if(!cards.length){ if(wrap.dataset.h){ wrap.dataset.h=''; wrap.replaceChildren(); } return; }
  const window=selectPriorityWindow(cards,{query:S.q||'',limit:24,keyOf:(c)=>c.key,
    priorityOf:(c)=>c.state==='running'?1e6:c.state==='failed'?9e5:c.terminalTask?8.5e5:c.liveTask?8e5:c.state==='paused'?5e5:c.state==='shipped'?1e5:0,
    searchTextOf:(c)=>`${c.task} ${c.state} ${c.kernel||''} ${(c.meta||[]).join(' ')}`});
  // A network-wide search can match a persona without matching its mission text.
  // Keep the compact mission summary useful in that case and render an explicit
  // empty filtered view instead of dereferencing an empty priority window.
  const active=window.items.find((c)=>c.state==='running')||window.items.find((c)=>c.state==='failed')
    ||window.items.find((c)=>c.liveTask)||cards.find((c)=>c.state==='running')
    ||cards.find((c)=>c.state==='failed')||window.items[0]||cards[0];
  const matching=window.items.length===cards.length
    ?`${cards.length} mission${cards.length===1?'':'s'}`
    :`${window.items.length} matching · ${cards.length} total`;
  if(count) count.textContent=`${matching} · ${active.state}`;
  if(headline) headline.textContent=active.task;
  if(eyebrow) eyebrow.textContent=cards.some((card)=>card.state==='running')?'NOW WORKING ON'
    :cards.some((card)=>card.state==='failed')?'EXECUTION NEEDS ATTENTION':'MISSION EVIDENCE';
  if(!box.dataset.initialized){ box.open=false; box.dataset.initialized='1'; }
  const stateClass=(value)=>String(value||'unknown').replace(/[^A-Za-z0-9_-]/g,'-').slice(0,80)||'unknown';
  const html=window.items.length?window.items.map((c)=>
    `<article class="mcard" role="button" tabindex="0"${c.recId?` data-mrec="${esc(c.recId)}"`:''}${c.run?` data-mrun="${esc(c.run)}" data-mbase="${esc(c.base||'')}"`:''}>`
    +`<div class="mission-state-dot ms-${stateClass(c.state)}"></div><div class="mission-copy"><span class="mstate ms-${stateClass(c.state)}">${esc(c.state.toUpperCase().replace(/_/g,' '))}</span>`
    +`<h2 class="mtask" title="${esc(c.task)}">${esc(c.task)}</h2><div class="mmeta">`
    +c.meta.filter(Boolean).map((m)=>`<span>${esc(m)}</span>`).join('')+`</div></div><span class="mission-open">${icon('chevron')}</span></article>`).join('')
    :`<div class="mission-no-match">No missions match this network filter.</div>`;
  if(wrap.dataset.h!==html){ wrap.dataset.h=html; wrap.innerHTML=html; }
}

/* ---------- wiring ---------- */
// lightweight stage/feed filter — hides persona cards, env lanes, and feed rows
// that don't match the query (replaces the board's row filter).
function _elementFilterText(el){
  const data=Object.values(el?.dataset||{}).join(' ');
  return `${el?.textContent||''} ${data}`.toLowerCase();
}
function _loadedRecordMatchesSearch(query){
  if(!String(query||'').trim()) return false;
  return selectPriorityWindow(S.recs.values(),{
    query,limit:1,scanLimit:NETWORK_LIMITS.cachedRecords,dedupeByKey:false,
    searchTextOf:(r)=>`${r.record_id||r.card_id||''} ${r.did||''} ${r.label||''} ${r.description||''} ${r._kernel||''} ${(r.capability_summary||[]).join(' ')}`,
  }).items.length>0;
}
function _applyFilter(){
  const q=(S.q||'').trim();
  document.querySelectorAll('.pcard').forEach((el)=>{ el.style.display=(!q||_elementFilterText(el).includes(q))?'':'none'; });
  document.querySelectorAll('.env-card').forEach((lane)=>{
    const hay=_elementFilterText(lane);
    lane.style.display=(!q||hay.includes(q))?'':'none'; });
  document.querySelectorAll('#sysStream .ix').forEach((li)=>{ li.style.display=(!q||_elementFilterText(li).includes(q))?'':'none'; });
}
function wire(){
  // Design-system nav family: promote the static index.html nav controls additively
  // (KEEP every id + the .link/.con-toggle classes the JS/CSS read) — the back control
  // becomes a ghost nav-back button, close/unfollow/collapse join the .ghost-btn family,
  // and their glyph text is swapped to the stroked icon set. Purely presentational +
  // a11y: no data/contract change, and a missing node is tolerated (?. guards).
  const _adopt=(sel,cls,iconName,label,accessibleName)=>{ const el=$(sel); if(!el) return;
    cls.split(' ').forEach((c)=>el.classList.add(c));
    if(iconName) el.innerHTML=icon(iconName)+(label?`<span>${label}</span>`:'');
    if(accessibleName){ el.setAttribute('aria-label',accessibleName); el.title=accessibleName; } };
  _adopt('#detailback','nav-back ghost-btn','back','back');
  _adopt('#detailclose','ghost-btn','close','','Close details');
  _adopt('#logclose','ghost-btn','close','','Close discovery log');
  _adopt('#introclose','ghost-btn','close','','Close help');
  _adopt('#cfUnfollow','ghost-btn','close','show all');
  // the constellation toggle keeps its rotate transform — only adopt the family class
  // + swap its ▾ for the shared disclosure chevron (CSS rotates it on .collapsed).
  const ct=$('#conToggle'); if(ct){ ct.classList.add('ghost-btn'); ct.innerHTML=icon('chevron'); }
  const header=$('#appHeader'), headerToggle=$('#headerToggle'), headerToolsToggle=$('#headerToolsToggle');
  const setHeaderToolsOpen=(open)=>{ if(!header||!headerToolsToggle) return;
    header.classList.toggle('tools-open',open); headerToolsToggle.setAttribute('aria-expanded',String(open));
    headerToolsToggle.setAttribute('aria-label',open?'hide search and network controls':'show search and network controls');
    headerToolsToggle.title=open?'hide search and network controls':'show search and network controls';
    headerToolsToggle.innerHTML=icon('chevron','ico-sm')+'<span>controls</span>'; };
  setHeaderToolsOpen(false); headerToolsToggle?.addEventListener('click',()=>setHeaderToolsOpen(!header.classList.contains('tools-open')));
  const setHeaderCollapsed=(collapsed)=>{ if(!header||!headerToggle) return;
    header.classList.toggle('collapsed',collapsed); document.body.classList.toggle('header-collapsed',collapsed);
    if(collapsed) document.querySelector('.command-shell')?.prepend(headerToggle); else header.after(headerToggle);
    headerToggle.classList.toggle('collapsed',collapsed); headerToggle.setAttribute('aria-expanded',String(!collapsed));
    headerToggle.setAttribute('aria-label',collapsed?'expand status and controls':'collapse status and controls');
    headerToggle.title=collapsed?'expand status and controls':'collapse status and controls';
    headerToggle.innerHTML=icon('chevron','ico-sm')+`<span>${collapsed?'controls':'collapse'}</span>`;
    try{ localStorage.setItem('personaos_header_collapsed',collapsed?'1':'0'); }catch(e){} };
  let headerCollapsed=false; try{ headerCollapsed=localStorage.getItem('personaos_header_collapsed')==='1'; }catch(e){}
  setHeaderCollapsed(headerCollapsed); headerToggle?.addEventListener('click',()=>setHeaderCollapsed(!header.classList.contains('collapsed')));
  // the help button (？) → stroked help-circle (keeps its aria-label/title text).
  const hbtn=$('#helpbtn'); if(hbtn) hbtn.innerHTML=icon('help');
  // keyboard access: Enter/Space activates any focusable [data-pcard]/[data-envrec]/
  // [data-artid]/[data-gp]/.mcard control (they carry role="button" tabindex="0").
  document.addEventListener('keydown',(e)=>{ if(e.key!=='Enter'&&e.key!==' ') return;
    // the ◎ follow button lives INSIDE the card, so Enter/Space would otherwise walk up to
    // the .pc-card and open the drawer — short-circuit it so follow is keyboard-reachable.
    const fb=e.target.closest('[data-follow]'); if(fb){ e.preventDefault(); fb.click(); return; }
    const t=e.target.closest('[data-pcard],[data-envrec],[data-artid],[data-gp],[data-kernel-core],.mcard'); if(!t) return;
    e.preventDefault(); t.dispatchEvent(new MouseEvent('click',{bubbles:true})); });
  // coordination-feed filters: ALL · COORD · VERIFY · SHIP · CROSS-ENV
  $('#sysStreamTabs')?.addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b)return;
    S.sysFlt=b.dataset.flt; [...e.currentTarget.children].forEach((c)=>{ c.classList.toggle('on',c===b); c.setAttribute('aria-pressed',String(c===b)); }); renderInteractionStream(); });
  // Global navigator: select a kernel to move from aggregate network mode to
  // its exact env/persona window. ALL NODES clears the scope without discarding
  // cached signed records.
  $('#globalKernels')?.addEventListener('click',(e)=>{ const b=e.target.closest('[data-kernel]'); if(!b) return;
    S.kernelFocus=b.dataset.kernel||null; S.follow=null;
    S.environmentWindow=NETWORK_LIMITS.environmentInitial; S.personaWindows.clear();
    renderGlobalKernels(); renderMissions(); refreshSystemView(); discover().catch(()=>{});
  });
  $('#networkAll')?.addEventListener('click',()=>{ S.kernelFocus=null; S.follow=null;
    S.environmentWindow=NETWORK_LIMITS.environmentInitial; S.personaWindows.clear();
    renderGlobalKernels(); renderMissions(); refreshSystemView(); });
  // stage click: a persona card or env name → open its Ed25519 drawer; deliverable chip → bundle/mission drawer
  $('#sysEnvs').addEventListener('click',(e)=>{
    const morePersonas=e.target.closest('[data-more-personas]'); if(morePersonas){
      const key=decodeURIComponent(morePersonas.dataset.morePersonas||'');
      S.personaWindows.set(key,nextProgressiveGroupLevel(key,S.personaWindows,{
        initial:NETWORK_LIMITS.personaInitial,step:NETWORK_LIMITS.personaStep,max:240,
      })); refreshSystemView(); return; }
    if(e.target.closest('[data-more-environments]')){
      S.environmentWindow=Math.min(120,S.environmentWindow+NETWORK_LIMITS.environmentStep); refreshSystemView(); return; }
    // follow toggle: the card's ◎ button focuses the stage+feed on ONE persona
    // (the only follow trigger reachable at every breakpoint). Stop here so the
    // click doesn't also open the drawer.
    const fb=e.target.closest('[data-follow]'); if(fb){ e.stopPropagation(); const fid=_entityKeyFromDom(fb.dataset.follow);
      S.follow=(S.follow===fid)?null:fid; _applyFollow(); renderInteractionStream(); return; }
    const liveOutput=e.target.closest('[data-live-output-run]'); if(liveOutput){ e.stopPropagation();
      S._lastFocus=document.activeElement; S.views=[()=>operatorRunView(liveOutput.dataset.liveOutputBase||'',liveOutput.dataset.liveOutputRun)];
      markInspectionSource(liveOutput); $('#detailwrap').classList.add('open'); renderTop(); return; }
    // Owned outputs live inside their persona/environment card. Resolve the
    // output before the enclosing card so clicking a deliverable opens that
    // deliverable rather than its owner.
    const ar=e.target.closest('[data-artid]'); if(ar){ e.stopPropagation(); const aid=ar.dataset.artid;
      const rid=S.recs.has(aid)?aid:S.order.find((id)=>{ const r=S.recs.get(id);
        return r&&((r.record_id||r.card_id)===aid||(r.did||'').includes(aid)); });
      if(rid) openDetail(rid); else log('artifact',`no viewable record for ${String(aid).slice(0,16)} (not yet exported)`,false); return; }
    // the card/lane carry a SHORT id (a ULID); a discovered record's canonical
    // DID contains it (…/persona/<ULID>) — match by containment, tolerant of did form.
    const ev=e.target.closest('[data-envrec]'); if(ev){ e.stopPropagation(); const sid=ev.dataset.envrec, kernel=ev.dataset.envkernel||'';
      const rid=S.order.find((id)=>{ const r=S.recs.get(id);
        return r.kind==='env'&&(!kernel||r._kernel===kernel)&&((r.did||'').includes(sid)||_shortId(r.did||'')===sid); });
      if(rid) openDetail(rid,ev); return; }
    const pc=e.target.closest('[data-pcard]'); if(pc){ const sid=pc.dataset.pcard, kernel=pc.dataset.pkernel||'';
      const personaKey=_entityKeyFromDom(pc.dataset.pkey)||_personaKey(kernel,sid);
      // clicking a card that is dimmed-out under follow opens its drawer — clear the
      // follow first so the just-inspected card isn't left greyed (looks disabled).
      if(S.follow&&S.follow!==personaKey){ S.follow=null; _applyFollow(); renderInteractionStream(); }
      const rid=S.order.find((id)=>{ const r=S.recs.get(id);
        return r.kind==='persona'&&(!kernel||r._kernel===kernel)
          &&((r.did||'').includes(sid)||_shortId(r.did||'')===sid||(r.record_id||'').includes(sid)); });
      if(rid) openDetail(rid,pc); return; }
    });
  // constellation node click → FOLLOW that persona (focus the stage + feed on it);
  // click the same node (or "show all") to clear. The full drawer opens from the card.
  const g=$('#sysGraph'); if(g) g.addEventListener('click',(e)=>{
    const core=e.target.closest('[data-kernel-core]'); if(core){ S.kernelFocus=core.getAttribute('data-kernel-core')||null;
      S.follow=null; S.environmentWindow=NETWORK_LIMITS.environmentInitial; S.personaWindows.clear();
      renderGlobalKernels(); renderMissions(); refreshSystemView(); discover().catch(()=>{}); return; }
    const node=e.target.closest('[data-gp]'); if(!node) return;
    const personaKey=_entityKeyFromDom(node.dataset.gp); S.follow=(S.follow===personaKey)?null:personaKey; _applyFollow(); renderInteractionStream(); });
  $('#cfUnfollow')?.addEventListener('click',()=>{ S.follow=null; _applyFollow(); renderInteractionStream(); });
  // collapse / expand the constellation rail
  $('#conToggle').addEventListener('click',(e)=>{ $('#constellation').classList.toggle('collapsed');
    e.currentTarget.setAttribute('aria-expanded',String(!$('#constellation').classList.contains('collapsed'))); });
  // Search is part of the bounded selector, not just a DOM hide pass: it can
  // surface a loaded persona/environment that was outside the current window.
  let searchTimer=null;
  $('#q').addEventListener('input',(e)=>{ S.q=e.target.value.toLowerCase().slice(0,256); _applyFilter();
    clearTimeout(searchTimer); searchTimer=setTimeout(()=>{ S.environmentWindow=NETWORK_LIMITS.environmentInitial;
      const loadedMatch=_loadedRecordMatchesSearch(S.q);
      renderGlobalKernels(); refreshSystemView(); renderInteractionStream();
      // A resolver-backed global search must reach beyond the sampled first page.
      // Do not re-fetch and re-verify a large provider inventory when the signed
      // record is already cached locally: the bounded stage selector can surface
      // that match directly. Empty queries also never need a resolver lookup.
      // The discovery pass remains bounded and is ignored while another is active.
      if(S.q&&!loadedMatch&&!S.kernelFocus&&globalDiscoveryEndpoints().length) discover().catch(()=>{});
    },120); });
  // OPERATOR is a TOGGLE: a second click closes the console it opened. We tag the
  // drawer with S._topIsOp; opening any other drawer (openDetail) or closing the
  // drawer clears the flag, so the toggle reflects true open-ness.
  $('#opbtn').addEventListener('click',()=>{
    const open=$('#detailwrap').classList.contains('open');
    if(open && S._topIsOp){ closeDetail(); return; }   // closeDetail clears _topIsOp, restores focus, and tears down the active view
    S._lastFocus=document.activeElement;
    S.views=[()=>operatorView()]; S._topIsOp=true;
    markInspectionSource($('#opbtn')); $('#detailwrap').classList.add('open'); renderTop(); });   // focus moves in via renderTop() after the title paints
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
    if(c.dataset.mrec){ openDetail(c.dataset.mrec,c); return; }
    if(c.dataset.mrun){ S._lastFocus=document.activeElement;
      S.views=[()=>operatorRunView(c.dataset.mbase||'',c.dataset.mrun)];
      markInspectionSource(c); $('#detailwrap').classList.add('open'); renderTop(); } });   // focus moves in via renderTop() after the title paints
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
    if(act==='secure-download'){ secureDownloadFromButton(a); return; }
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
    else if(act==='live-file') pushView(()=>liveFileView(base,a.dataset.run,a.dataset.workspace,a.dataset.path));
    else if(act==='file'){ const o={contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null,
        authoredLabels:artifactSemanticsFromAttr(a.dataset.semantics)};
      pushView(()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,o)); }
    else if(act==='fv-raw'){ // swap the CURRENT file view to forced plain text (re-render in place)
      if(a.dataset.live==='1'&&S.openLiveFile){ S.liveRawModes=S.liveRawModes||new Map(); S.liveRawModes.set(S.openLiveFile.bodyKey,true); renderTop(); }
      else { S.views[S.views.length-1]=()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,{raw:true,contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null,authoredLabels:artifactSemanticsFromAttr(a.dataset.semantics)}); renderTop(); } }
    else if(act==='fv-rich'){ // swap back to the rich media renderer
      if(a.dataset.live==='1'&&S.openLiveFile){ S.liveRawModes=S.liveRawModes||new Map(); S.liveRawModes.set(S.openLiveFile.bodyKey,false); renderTop(); }
      else { S.views[S.views.length-1]=()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,{contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null,authoredLabels:artifactSemanticsFromAttr(a.dataset.semantics)}); renderTop(); } }
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
    S.drawerLiveKind=S.drawerLiveId=S.drawerLiveFeed=S.drawerThinkPid=null; S.drawerLiveKernel=''; S.drawerLiveBase=''; S.openLiveFile=null;
    $('#detailwrap').classList.remove('open'); S._topIsOp=false;
    document.body.classList.remove('detail-open');
    if(S._detailSource){ S._detailSource.classList.remove('inspecting'); S._detailSource.setAttribute('aria-expanded','false'); S._detailSource=null; }
    S._detailSourceRef=null;
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

// ---------- real P2P transport: a vendored js-libp2p node in the browser ----------
// WebRTC + circuit-relay + gossipsub, with Kademlia provider rendezvous only after
// an explicit/node-advertised bootstrap or relay connects it to a shared routing table.
let P2P=null;
function updateP2PStatus(){ const el=$('#p2p'); if(!el) return; const n=P2P&&P2P.node;
  const peers=n&&n.getPeers?n.getPeers().length:0;
  const detail=n?`libp2p ${n.peerId.toString()} · ${peers} connected peer${peers===1?'':'s'}`:'HTTP federation discovery';
  el.title=detail; el.setAttribute('aria-label',`Network connectivity: ${detail}`);
  el.textContent=n?`Network · ${peers} peer${peers===1?'':'s'}`:'Network · web discovery'; }
const PROVIDER_HINT_LIMITS=Object.freeze({maxPending:64,maxQueue:16,maxJobsPerMinute:16,
  maxConcurrent:2,maxKeysPerHint:5,cooldownMs:30000});
function _providerHintJobId(record,hints){
  return String(record?.did||record?.record_id||record?.card_id||hints.join('|')).slice(0,2048);
}
function _enqueueProviderHintJob(job){
  const now=Date.now(), prior=S.providerHintJobs.get(job.id);
  if(prior&&now-prior.at<PROVIDER_HINT_LIMITS.cooldownMs) return;
  S.providerHintWindow=S.providerHintWindow.filter((at)=>now-at<60000);
  if(S.providerHintWindow.length>=PROVIDER_HINT_LIMITS.maxJobsPerMinute
      ||S.providerHintQueue.length>=PROVIDER_HINT_LIMITS.maxQueue){
    log('gossip','lookup hint rate limit reached; hint refused',false); return; }
  S.providerHintWindow.push(now); S.providerHintJobs.set(job.id,{state:'queued',at:now});
  while(S.providerHintJobs.size>256) S.providerHintJobs.delete(S.providerHintJobs.keys().next().value);
  S.providerHintQueue.push(job); _pumpProviderHintJobs();
}
function queueProviderHints(record,source='gossip'){
  if(record?.visibility_tier!=='public') return;
  const hints=providerLookupHints(record,{max:PROVIDER_HINT_LIMITS.maxKeysPerHint});
  if(!hints.length){ log('gossip',`${source}: no bounded provider lookup key`,false); return; }
  const job={id:_providerHintJobId(record,hints),hints,source};
  const prior=S.providerHintJobs.get(job.id);
  if(prior&&Date.now()-prior.at<PROVIDER_HINT_LIMITS.cooldownMs) return;
  log('gossip',`${source}: untrusted lookup hint only; awaiting current-master ProviderRecord`);
  if(!P2P?.resolveProvider){
    if(S.pendingProviderHints.size>=PROVIDER_HINT_LIMITS.maxPending)
      S.pendingProviderHints.delete(S.pendingProviderHints.keys().next().value);
    S.pendingProviderHints.set(job.id,job); return;
  }
  _enqueueProviderHintJob(job);
}
async function _resolveProviderHintJob(job){
  const results=await Promise.all(job.hints.map((key)=>
    P2P.resolveProvider(key,{timeoutMs:5000}).catch(()=>null)));
  const rows=[];
  for(const result of results){ const verified=await verifiedRowsFromP2PResult(result,`${job.source} lookup`);
    rows.push(...verified.rows); }
  const unique=new Map(rows.map((row)=>[`${row._kernel}\u0000${row.record_id||row.did}`,row]));
  let added=0;
  for(const row of unique.values()){
    const inventory=S.providerInventories.get(String(row._kernel||''));
    const id=recordStoreKey(row), recordId=String(row.record_id||'');
    if(!inventory||!inventory.recordKeys?.has(id)
        ||row._providerInventoryGeneration!==inventory.generation
        ||row._providerInventoryManifestHash!==inventory.manifestHash
        ||row._providerDocumentHash!==inventory.bindings?.get(recordId)) continue;
    if(upsert({...row,_inventorySource:row._kernel,
      _inventoryGeneration:inventory.generation,_inventoryHash:inventory.hash})){
      added++; noteKernel(row._kernel,'p2p',row._base||''); }
  }
  if(added){ log('p2p',`${job.source}: ${added} current-master ProviderRecord(s) verified`,true);
    classifyMap(); updateVitalsCounters(); refreshSystemView(); renderMissions(); refreshLiveSection(); }
  else log('p2p',`${job.source}: provider lookup unresolved; nothing displayed`,false);
}
function _pumpProviderHintJobs(){
  while(P2P?.resolveProvider&&S.providerHintActive<PROVIDER_HINT_LIMITS.maxConcurrent
      &&S.providerHintQueue.length){
    const job=S.providerHintQueue.shift(); S.providerHintActive++;
    S.providerHintJobs.set(job.id,{state:'running',at:Date.now()});
    _resolveProviderHintJob(job).catch((e)=>log('p2p',`${job.source}: lookup failed ${String(e&&e.message||e).slice(0,100)}`,false))
      .finally(()=>{ S.providerHintActive--;
        S.providerHintJobs.set(job.id,{state:'done',at:Date.now()}); _pumpProviderHintJobs(); });
  }
}
function onGossipRecord(doc){
  // A record-supplied public key is self-asserted. Gossip contributes bounded
  // lookup aliases only and can never insert, display, or overwrite UI records.
  if(doc?.record) queueProviderHints(doc.record,'libp2p gossip');
}
let _p2pRendezvousCid=null;
async function p2pRendezvousCid(){
  if(_p2pRendezvousCid) return _p2pRendezvousCid;
  const digest=hexToBytes(await sha256Hex(enc.encode('personaos-discovery-rendezvous/v1')));
  const multihash=new Uint8Array(34); multihash.set([0x12,0x20]); multihash.set(digest,2);
  _p2pRendezvousCid=Object.freeze({multihash:Object.freeze({bytes:multihash}),
    toString:()=> 'personaos-discovery-rendezvous/v1'});
  return _p2pRendezvousCid;
}
async function refreshP2PRendezvous(){
  if(!P2P?._rendezvousConfigured||!P2P.node?.contentRouting) return;
  const cid=await p2pRendezvousCid(); const signal=AbortSignal.timeout(8000); let found=0;
  try{
    await P2P.node.contentRouting.provide(cid,{signal});
    for await(const provider of P2P.node.contentRouting.findProviders(cid,{signal})){
      if(provider?.id?.equals?.(P2P.node.peerId)) continue;
      found++;
      const target=provider.multiaddrs?.[0]||provider.id;
      if(target) P2P.node.dial(target,{signal:AbortSignal.timeout(5000)}).catch(()=>{});
      if(found>=16) break;
    }
    log('p2p',`DHT rendezvous provided; ${found} peer provider(s) resolved`,true);
  }catch(e){ if(!P2P._dhtNoted){ P2P._dhtNoted=true; log('p2p','DHT rendezvous unavailable through configured peers: '+String(e&&e.message||e),false); } }
}
async function initP2P(){
  const params=new URLSearchParams(location.search);
  // HTTP discovery has already collected browser-eligible multiaddrs from every
  // admitted node and the global resolver. Re-fetching this static page's origin
  // as though it were a node produces a guaranteed 404 on bare hosted portals.
  const list=collectBrowserLibp2pBootstraps({pageProtocol:location.protocol},S.p2pBootstraps,
    params.getAll('relay'),params.getAll('bootstrap'));
  log('p2p','starting vendored libp2p — WebRTC + gossipsub; configured peers enable DHT rendezvous…');
  try{
    const mod=await import('./p2p-libp2p.js?v=20260715-authority-continuity-v1');
    P2P=await mod.startP2P({ bootstrapList:list,
      onLog:(t,m)=>{ log('p2p',t+' '+m, t==='peer:connect'||t==='peer:discovery'?true:undefined); updateP2PStatus(); },
      onRecord:onGossipRecord });
    P2P._rendezvousConfigured=list.length>0;
    updateP2PStatus();
    for(const id of S.order){ const r=S.recs.get(id);
      if(r._gossipHint?.record?.visibility_tier==='public') P2P.announce(r._gossipHint); }
    const pending=[...S.pendingProviderHints.values()]; S.pendingProviderHints.clear();
    for(const job of pending) _enqueueProviderHintJob(job);
    log('p2p', list.length ? `dialling ${list.length} relay/bootstrap peer(s)…`
      : 'libp2p running — no relay configured; add ?relay=<multiaddr> to reach other machines (a browser needs a relay/bootstrap to find peers)');
    if(list.length){ setTimeout(()=>refreshP2PRendezvous().catch(()=>{}),3000);
      P2P._rendezvousTimer=setInterval(()=>refreshP2PRendezvous().catch(()=>{}),60000); }
    if(list.length) Promise.resolve().then(()=>discover()).then(()=>{ renderMissions(); refreshLiveSection(); }).catch(()=>{});
  }catch(e){ log('p2p','libp2p unavailable here, using HTTP federation: '+(e&&e.message||e), false);
    updateP2PStatus(); }
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
  // Exact live workspace snapshots: SSE is primary; this 3s poll is the bounded
  // fallback for proxies/browsers that buffer or block EventSource.
  setInterval(()=>{ try{ pollLiveArtifacts(); }catch(e){} },3000);
  requestAnimationFrame(tick);
})().catch((e)=>{ $('#status').textContent='discovery error: '+e.message; console.error(e); });
