import * as ed from './noble-ed25519.js';
import {
  artifactSemanticLabels,
  boundedLineDiff,
  decideLiveArtifactUpdate,
  endLiveArtifactState,
  finalizeLiveArtifactState,
  installEd25519HashFallback,
  LIVE_ARTIFACT_LIMITS,
  liveBodyCommitIsCurrent,
  liveArtifactFileKey,
  liveArtifactRunKey,
  sha256Hex,
  terminalLiveArtifactCalls,
  transitionLiveArtifacts,
} from './live-artifacts.mjs?v=20260720-active-call-capture-v3';
import {
  verifyLiveArtifactEvent,
  verifyLiveArtifactSnapshot,
} from './live-signatures.mjs?v=20260718-live-current-v3';
import {
  currentMasterKey,
  evaluatePublicRecordAccess,
  hydrateProviderIndex,
  personaAuthoredRole,
  projectDiscoveryRecord,
  projectRecordSurface,
  providerLookupHints,
  recordVerificationEntries,
  validateProviderInventoryWindow,
} from './discovery-authority.mjs?v=20260715-provider-window-v1';
import {
  collectBrowserLibp2pBootstraps,
  compactCount,
  nextProgressiveGroupLevel,
  providerIndexResponseByteLimit,
  publicTaskLifecycleProjection,
  projectTerminalModelFailures,
  progressiveGroupLimit,
  responseByteLengthWithinLimit,
  selectMonitoringBases,
  selectVerifiedPublicTaskRunTargets,
  selectPriorityWindow,
  signedPersonaIdentity,
  verifiedPersonaIdentityPresent,
  verifiedPersonaRenderable,
  personaLifecycleProjection,
} from './network-view.mjs?v=20260727-latest-outcome-v8';
import {
  NetworkStore,
  TelemetryAdmissionGate,
  networkEntityKey,
  splitNetworkKey,
} from './network-store.mjs?v=20260710-scalable-network-v1';
import {
  artifactTypeLabel,
  selectArtifactRenderer,
  sniffArtifactMediaType,
} from './artifact-types.mjs?v=20260824-viewer-v1';
import {
  renderMarkdownDocument,
  renderPlainTextWithLinks,
} from './artifact-markdown.mjs?v=20260812-markdown-linkify-v1';
import {
  fetchVerifiedPersonaAvatar,
  normalizePersonaAvatar,
  personaIdentityKeyPin,
  resolvePersonaAvatarBodyUrl,
} from './persona-avatar.mjs?v=20260722-persona-raster-v3';
import {
  environmentIdentity,
  resolveEnvironmentAuthority,
} from './routing-authority.mjs?v=20260722-exact-environment-authority-v2';
import {
  friendlyDuration,
  humanActivityPresentation,
  humanizeMachineKey,
  isTechnicalKey,
  structuredContentProjection,
} from './human-content.mjs?v=20260728-agency-v3';
import {
  expiredProviderKernels,
  reconcileResolverDirectory,
} from './global-directory.mjs?v=20260726-fast-global-v1';
import {
  locatorFallbackDecision,
  shouldPrefetchNodeStatus,
} from './discovery-strategy.mjs?v=20260803-fast-fallback-v5';
import {
  createOfflineHistorySnapshot,
  readOfflineHistorySnapshots,
  verifyOfflineHistorySnapshots,
  writeOfflineHistorySnapshot,
} from './offline-history.mjs?v=20260808-offline-history-v2';
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
} from './public-telemetry.mjs?v=20260802-work-state-v4';

// A node-served shell on a plain-HTTP LAN address is not a browser secure
// context, so SubtleCrypto is withheld and every Ed25519 check would throw
// before it could compare a single byte. Install the in-page SHA-512 digest so
// the exact same signatures are verified there as over loopback/HTTPS.
installEd25519HashFallback(ed.etc);

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
  box:'M8 2l5.5 3v6L8 14l-5.5-3V5L8 2zM2.5 5L8 8l5.5-3M8 8v6', // ▣ artifact bundle (package)
  copy:'M5.5 5.5V3.5h7v7h-2M3.5 5.5h7v7h-7z',                  // ⧉ copy (two overlapping sheets)
  download:'M8 2.5v7M5.5 7L8 9.5 10.5 7M3 11v2h10v-2',       // download to tray
  history:'M8 3a5 5 0 1 1-4.2 2.3M3 2.8v3.5h3.5M8 5.2V8l2 1.4', // historical observation
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
const KIND_LABEL={persona:'PERSONA',env:'ENV',project:'PROJECT',domain:'DOMAIN',artifact:'ARTIFACT',telemetry:'TELEMETRY',knowledge:'KNOWLEDGE',skill:'SKILL',tool:'TOOL',mission:'WORK EVIDENCE'};
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
function normalizedHttpsBase(value){
  const raw=String(value||'').replace(/\/$/,'');
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash) return '';
    return url.toString().replace(/\/$/,'');
  }catch(_){ return ''; }
}
function normalizedHttpBase(value){
  const raw=String(value||'').replace(/\/$/,'');
  try{
    const url=new URL(raw);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password
        ||url.search||url.hash||url.pathname!=='/') return '';
    return url.toString().replace(/\/$/,'');
  }catch(_){ return ''; }
}
/* ---------- node authority (A5-01/A5-08: explicit node policy, never network position) ----------
   The current browser surface is deliberately read-only. Public reachability may publish a
   complete read projection, but the portal neither retains a process bearer nor originates
   owner mutations. Controlled non-browser clients and authenticated persona transports are
   separate authority surfaces. */
function opTokens(){
  // Fail closed across upgrades: browser-held owner credentials from an older build
  // must not silently re-enable task, input, budget, stop, or tool mutations.
  try{ localStorage.removeItem('personaos_operator'); }catch(e){}
  try{ localStorage.removeItem('personaos_peers'); }catch(e){}
  try{ sessionStorage.removeItem('personaos_operator'); }catch(e){}
  return {};
}
const opBaseKey=(b)=>String(b||location.origin).replace(/\/$/,'');
// Loopback detection is only a discovery/convenience hint. Network position never
// grants authority; only an accepted process bearer grants owner control.
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
    return new Uint8Array(bytes);
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
  return out;
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
    const rawExpected=String(btn.dataset.hash||'').replace(/^sha256:/i,'').toLowerCase();
    if(rawExpected){
      if(!/^[a-f0-9]{64}$/.test(rawExpected)) throw new Error('invalid expected SHA-256'); }
    let bytes=null;
    try{
      const response=await fetch(target.href,secureFetchInit(target.href));
      if(!response.ok) throw new Error(`body HTTP ${response.status}`);
      bytes=await readBoundedResponseBytes(response,LIVE_ARTIFACT_LIMITS.maxDownloadBytes);
    }catch(httpError){
      bytes=await fetchP2PArtifactBytes(target.href,
        rawExpected?`sha256:${rawExpected}`:'',LIVE_ARTIFACT_LIMITS.maxDownloadBytes);
      if(!bytes) throw httpError;
    }
    if(rawExpected){
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
  opTokens(); b.classList.remove('on');
  b.innerHTML='<span class="opbtn-label">PUBLIC DATA</span>'; }
const DEFAULT_JSON_MAX_BYTES=4*1024*1024;
function p2pDataRouteForUrl(value){
  let target; try{ target=new URL(value,location.href); }catch(_){ return null; }
  if(target.hash) return null;
  let sinceRevision='';
  if(target.search){
    const keys=[...target.searchParams.keys()];
    const values=target.searchParams.getAll('since');
    if(keys.length!==1||keys[0]!=='since'||values.length!==1
        ||!/^sha256:[0-9a-f]{64}$/.test(values[0])) return null;
    sinceRevision=values[0];
  }
  for(const [rawBase,route] of (S.p2pDataRoutes||new Map())){
    let base; try{ base=new URL(rawBase,location.href); }catch(_){ continue; }
    if(target.origin!==base.origin) continue;
    const root=base.pathname.replace(/\/+$/,'');
    if(root&&target.pathname!==root&&!target.pathname.startsWith(root+'/')) continue;
    let path=target.pathname.slice(root.length).replace(/^\/+/, '');
    try{ path=decodeURIComponent(path); }catch(_){ continue; }
    if(!path) continue;
    return {route,path,sinceRevision,url:target.href};
  }
  return null;
}
async function fetchP2PJson(value,init={}){
  if(init.signal?.aborted) return null;
  const found=p2pDataRouteForUrl(value);
  if(!found||!P2P?.fetchPublicJson) return null;
  const request=P2P.fetchPublicJson(found.route.providerRecord,found.path,{
    timeoutMs:Math.min(12000,Number(init.timeoutMs)||8000),
    maxBytes:init.maxBytes||DEFAULT_JSON_MAX_BYTES,
    sinceRevision:found.sinceRevision,
  }).catch(()=>null);
  return settleBeforeAbort(request,init.signal,null);
}
function settleBeforeAbort(request,signal,abortedValue=null){
  if(!signal) return request;
  if(signal.aborted) return Promise.resolve(abortedValue);
  // Peer fetches have their own transport timeout, but callers also use a
  // whole-job deadline. Resolve this read as soon as that deadline fires and
  // ignore any later transport result instead of serially overrunning it.
  return new Promise((resolve)=>{
    let settled=false;
    const finish=(value)=>{
      if(settled) return; settled=true;
      signal.removeEventListener('abort',onAbort); resolve(value);
    };
    const onAbort=()=>finish(abortedValue);
    signal.addEventListener('abort',onAbort,{once:true});
    if(signal.aborted){ onAbort(); return; }
    request.then(finish,()=>finish(null));
  });
}
async function fetchP2PArtifactBytes(value,expectedHash='',maxBytes=64*1024*1024){
  let target; try{ target=new URL(value,location.href); }catch(_){ return null; }
  // JSON polling has its own sole `since=sha256:...` query contract in
  // p2pDataRouteForUrl. Artifact bodies instead permit only the exact hash query
  // emitted by a signed live-workspace snapshot. Strip it solely for peer path
  // routing, then bind it back to the independently advertised expected hash.
  let queryHash='';
  if(target.search){
    const match=/^\?sha256=([0-9a-fA-F]{64})$/.exec(target.search);
    if(!match) return null;
    queryHash=`sha256:${match[1].toLowerCase()}`; target.search='';
  }
  const found=p2pDataRouteForUrl(target.href);
  if(!found||found.sinceRevision||!P2P?.fetchPublicBlob) return null;
  const urlKey=target.href;
  const contentHash=String(expectedHash||S.p2pArtifactHashes?.get(urlKey)||'').toLowerCase();
  if(!/^sha256:[0-9a-f]{64}$/.test(contentHash)) return null;
  if(queryHash&&queryHash!==contentHash) return null;
  const result=await P2P.fetchPublicBlob(found.route.providerRecord,contentHash,
    {timeoutMs:10000,maxBytes,path:found.path}).catch(()=>null);
  return result?.bytes||null;
}
// Large signed inventories are fetched concurrently by the HTTP and P2P
// discovery lanes at boot. Share one in-flight (and just-settled) download per
// absolute URL so the same multi-megabyte document is never transferred twice;
// both lanes verify the identical signed document downstream.
const _sharedDocJobs=new Map();
function sharedDocumentJson(url,fetch_){
  const hit=_sharedDocJobs.get(url);
  if(hit&&Date.now()-hit.ts<10000) return hit.promise;
  const promise=Promise.resolve().then(fetch_).finally(()=>{
    setTimeout(()=>{ const job=_sharedDocJobs.get(url);
      if(job&&job.promise===promise) _sharedDocJobs.delete(url); },10000);
  });
  _sharedDocJobs.set(url,{promise,ts:Date.now()});
  return promise;
}
async function fetchJson(u,init={}){
  // A current-master-verified provider route is already a stronger transport
  // binding than an opportunistic cross-origin HTTP attempt. Public refetches
  // therefore stay on that peer first; operator-token requests still use HTTP.
  const peerRouted=!tokenFor(u)&&!!p2pDataRouteForUrl(u)&&!!P2P?.fetchPublicJson;
  if(peerRouted&&!init.signal?.aborted){
    const peerDocument=await fetchP2PJson(u,init);
    if(peerDocument!==null&&peerDocument!==undefined) return peerDocument;
    // A verified provider route is authority for the peer binding, not a lease
    // on the only usable transport. A disconnected relay must not suppress the
    // same independently verified public document on the provider's HTTPS route.
  }
  // Callers may pass their own signal; every un-signaled fetch still gets a
  // bounded default so one hung connection can never stall a refresh pipeline
  // (a stuck stage guard used to freeze card faces on their loading shells).
  const transportSignal=init.signal||AbortSignal.timeout(20000);
  try{ const r=await fetch(u,secureFetchInit(u,{...init,signal:transportSignal})); if(r.ok){
    const bytes=await readBoundedResponseBytes(r,init.maxBytes||DEFAULT_JSON_MAX_BYTES);
    return JSON.parse(new TextDecoder().decode(bytes)); }
  }catch(e){}
  if(transportSignal.aborted) return null;
  // The peer route was already tried first above. Do not pay the same failed
  // transport timeout twice before the next live refresh.
  return peerRouted?null:fetchP2PJson(u,init);
}
const bootstrapFetchJobs=new Map();
function fetchDiscoveryBootstrap(base,{signal=null,maxBytes=256*1024}={}){
  const url=join(base,'.well-known/personaos-discovery.json');
  const key=opBaseKey(base||location.origin);
  let job=bootstrapFetchJobs.get(key);
  if(!job){
    const transportSignal=AbortSignal.timeout(8000);
    job=fetchJson(url,{signal:transportSignal,maxBytes}).finally(()=>{
      if(bootstrapFetchJobs.get(key)===job) bootstrapFetchJobs.delete(key);
    });
    bootstrapFetchJobs.set(key,job);
  }
  return settleBeforeAbort(job,signal,null);
}
const responsivePublicJsonJobs=new Map();
async function fetchResponsivePublicJson(u,init={}){
  if(tokenFor(u)) return fetchJson(u,init);
  const callerSignal=init.signal;
  if(callerSignal?.aborted) return null;
  const maxBytes=init.maxBytes||DEFAULT_JSON_MAX_BYTES;
  const peerOnly=init.peerOnly===true;
  const verifiedDirectFallback=init.verifiedDirectFallback===true;
  const key=`${String(u)}\u0000${maxBytes}\u0000${peerOnly?'peer':'any'}\u0000${verifiedDirectFallback?'direct-fallback':'strict'}`;
  let job=responsivePublicJsonJobs.get(key);
  if(!job){
    const transportSignal=AbortSignal.timeout(15000);
    // This shared job is deliberately anonymous and GET-only. Do not inherit
    // caller headers or consult token state again after it starts.
    const transportInit={signal:transportSignal,maxBytes,timeoutMs:12000};
    const request=(async()=>{
      const directDocument=async()=>{
        try{
          const r=await fetch(u,{signal:transportSignal,cache:'no-store',credentials:'omit',
            redirect:'error',referrerPolicy:'no-referrer'});
          if(r.ok){
            const bytes=await readBoundedResponseBytes(r,maxBytes);
            return JSON.parse(new TextDecoder().decode(bytes));
          }
        }catch(_){}
        return null;
      };
      const firstUsable=(reads)=>new Promise((resolve)=>{
        let pending=reads.length, finished=false;
        const settle=(value)=>{
          if(finished) return;
          if(value!==null&&value!==undefined){ finished=true; resolve(value); return; }
          pending--;
          if(pending<=0){ finished=true; resolve(null); }
        };
        for(const read of reads) Promise.resolve(read).then(settle,()=>settle(null));
      });
      const peerRouted=!!p2pDataRouteForUrl(u)&&!!P2P?.fetchPublicJson;
      if(peerRouted){
        const peerRead=fetchP2PJson(u,transportInit);
        if(!verifiedDirectFallback) return peerRead;
        // Dynamic signed documents must not disappear behind a slow peer read.
        // Race the peer transport with the same current-master-verified
        // provider's anonymous HTTPS route. The returned document still has to
        // pass its independent signature/identity verification; this hedge does
        // not consult a locator or change discovery authority.
        return firstUsable([peerRead,directDocument()]);
      }
      if(peerOnly&&!verifiedDirectFallback) return null;
      const direct=await directDocument();
      if(direct!==null&&direct!==undefined) return direct;
      if(transportSignal.aborted) return null;
      return fetchP2PJson(u,transportInit);
    })();
    job=request.finally(()=>{
      if(responsivePublicJsonJobs.get(key)===job) responsivePublicJsonJobs.delete(key);
    });
    responsivePublicJsonJobs.set(key,job);
  }
  // A drawer refresh and the background cognition stream can ask for the same
  // public document. Each caller may stop waiting independently; its deadline
  // must not cancel the shared anonymous transport needed by the other view.
  return settleBeforeAbort(job,callerSignal,null);
}
const planesOf=(t)=>['federation','public'].includes(t)?['internet','intranet']:['intranet'];

// Hard UI/backpressure ceilings. Global discovery can describe millions of
// kernels, but a browser must render and actively monitor a small, explicit
// window. Selected/running/recent entities outrank idle ones; every omitted
// population is reported as an aggregate instead of silently disappearing.
const NETWORK_LIMITS=Object.freeze({
  kernelChips:10, monitoredBases:12, cachedKernels:4096, cachedRecords:20000,
  resolverPage:100, resolverPages:4, discoveryLogRows:24, telemetryTapeRows:2000,
  graphKernels:6, graphPersonasGlobal:30, graphPersonasFocused:36,
  environmentInitial:10, environmentStep:10, personaInitial:12, personaStep:12,
  cognitionPersonas:24, cognitionRowsPerPersona:24, interactionRows:120,
});
const NETWORK=new NetworkStore({limits:{maxEntities:NETWORK_LIMITS.cachedRecords,
  maxPresence:NETWORK_LIMITS.cachedRecords,maxGraphExact:96,maxGraphAggregates:24,maxGraphNodes:120}});
const TELEMETRY_GATE=new TelemetryAdmissionGate({maxSources:128,maxAgeMs:30000,futureSkewMs:30000});
const VERIFIED_COMMUNICATION_ROUTES=new WeakMap();
const VERIFIED_COMMUNICATION_ROUTE_COLLECTIONS=new WeakSet();
const INITIAL_OFFLINE_HISTORY=Array.isArray(globalThis.__personaOSOfflineHistory)
  ?globalThis.__personaOSOfflineHistory:[];

const S={ recs:new Map(), order:[], kernels:new Set(), events:[], emitted:0, rIdx:0, lastEmit:0,
  paused:false, sort:'events', dir:-1, plane:'all', kind:'all', q:'', epsWin:[], evCount:0, live:false,
  map:{}, mapByKernel:{}, telLoaded:new Set(), eventKeys:new Set(), keys:new Map(), keyDocs:new Map(), boots:new Map(),
  peerHealth:new Map(), identityIndexes:new Map(),
  openInputDirectories:new Map(), openInputFetchAfter:new Map(),
  providerKeyRefreshAt:new Map(), telemetryKeyRefreshAt:new Map(),
  providerHintJobs:new Map(), providerHintQueue:[],
  providerInventories:new Map(),
  offlineHistory:INITIAL_OFFLINE_HISTORY,
  cachedIdentityPendingKernels:new Set(),
  providerHintActive:0, providerHintWindow:[], pendingProviderHints:new Map(),
  providerRouteReconciliations:new Map(),
  verifiedGossipJobs:new Map(),verifiedGossipQueue:[],verifiedGossipActive:0,
  verifiedGossipWindow:[],verifiedGossipAttempts:new Map(),
  streams:new Map(), p2pInvalidations:new Map(), p2pWatchRevisions:new Map(),
  p2pBootstraps:new Set(), portalPeers:new Set(), p2pDialQueue:[], p2pDialStates:new Map(),
  p2pDialRetryTimer:null, p2pDialActive:0, globalPeers:new Set(), gossipPeers:new Set(),
  globalAnnouncements:new Map(), globalAnnouncementByBase:new Map(), views:[], curBase:'',
  resolverSnapshots:new Map(), resolverFingerprint:'', globalLastSuccessAt:0,
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
  verifiedArtifactBodies:new Map(), verifiedArtifactBodyJobs:new Map(), verifiedArtifactBodyBytes:0,
  liveArtifactRequestGeneration:new Map(), liveArtifactAbort:new Map(), liveArtifactEnded:new Map(),
  liveArtifactPublicProbes:new Map(),
  terminalCallTombstones:new Map(),
  terminalModelFailureByKernel:new Map(),
  personaRuntimeById:new Map(), cognitionByPersona:new Map(), verifiedPublicCognitionByPersona:new Map(),
  publicCognitionFetchAfter:new Map(),
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

// Runtime truth for "in a model call" comes from current kernel.active_model_calls
// and the bounded, kernel-signed public-cognition active-call snapshot, not from
// replayed model_events or heartbeat.busy. Historical model_events remain useful
// history, but they must not mark personas/envs as running now.
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
  _expireProviderInventories(now);
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
function _personaRunningInEnvironment(value,environment,kernel=''){
  const ref=_personaRef(value,kernel), environmentId=environmentIdentity(environment);
  if(!environmentId) return false;
  return _activeModelCallsForPersona(ref.key).some((call)=>
    environmentIdentity(call?.environment_id)===environmentId);
}
function _runtimeBusy(){
  return !!(S.activeModelCallCount>0);
}
function _envRunningNow(b){
  const sid=_shortId((b&&b.sid)||(b&&b.envId));
  if(sid && S.activeModelCallsByEnv && S.activeModelCallsByEnv.has(_environmentKey(b?.kernel,sid))) return true;
  return !!(b&&Array.isArray(b.members)&&b.members.some((m)=>
    _personaRunningInEnvironment(m,sid,b.kernel)));
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
function _eventEntityLabel(kind,id,kernel=''){
  if(kind==='persona') return _nameFor(id,kernel);
  if(kind==='env'||kind==='environment') return _environmentNameFor(id,kernel);
  if(kind==='kernel') return 'node';
  if(kind==='model') return String(id||'model');
  return String(kind||'activity').replace(/_/g,' ');
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
// The live feed has already performed the full current-master/public-tier
// verification. Keep the latest admitted document for each monitored persona:
// signed messages and assembled provider output are durable activity history,
// not presence signals that should disappear when the 30-second live lease ends.
// Public-cognition schema family: /3 replaced the retired lessons/tactics
// optimizer surfaces with mechanical brain_* fact counters; both wire shapes
// verify field-exactly below and render everywhere the other does.
const PUBLIC_COGNITION_SCHEMAS=new Set([
  'personaos-persona-public-cognition/2','personaos-persona-public-cognition/3']);
function _publicCognitionDocOk(doc){
  return PUBLIC_COGNITION_SCHEMAS.has(doc?.schema)&&doc?.tier==='public';
}
function _rememberVerifiedPublicCognition(personaKey,doc,{base='',kernel='',personaId=''}={}){
  if(!_publicCognitionDocOk(doc)) return false;
  const store=S.verifiedPublicCognitionByPersona=S.verifiedPublicCognitionByPersona||new Map();
  const modelProjection=canon([...(doc.recent_calls||[]),...(doc.active_calls||[])].map((call)=>[
    call.model_id,call.requested_purpose,call.environment_id,call.started_at,call.ended_at||'',
  ]));
  const modelHistoryChanged=store.get(personaKey)?.modelProjection!==modelProjection;
  store.delete(personaKey);
  store.set(personaKey,{doc,base,kernel,personaId,modelProjection,observedAt:Date.now()});
  // Retain one verified cognition document per hydrated persona up to the
  // cognition window: a four-document cap rotated the lesson lead off every
  // fifth card as the deck hydrated (observed 2026-09-03: 4 leads, then 0).
  while(store.size>NETWORK_LIMITS.cognitionPersonas) store.delete(store.keys().next().value);
  return modelHistoryChanged;
}
function _personaModelHistory(personaKey,fallback=[]){
  const retained=S.verifiedPublicCognitionByPersona?.get(personaKey);
  const doc=retained?.doc;
  if(!_publicCognitionDocOk(doc))
    return fallback;
  const models=[...(doc.recent_calls||[]),...(doc.active_calls||[])].map((call)=>({
    t:Date.parse(call.ended_at||call.started_at||'')||0,
    purpose:String(call.requested_purpose||'model'),
    model:String(call.model_id||''),
    role:'',
    environment:_shortId(call.environment_id),
    run:String(call.run_id||''),
    task:String(call.task_id||''),
  })).filter((call)=>call.model).sort((left,right)=>left.t-right.t);
  return models.length?models:fallback;
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
  S.ixByPersona=new Map([...indexed].map(([personaKey,events])=>{
    const ordered=[...events.values()].sort((a,b)=>a._t-b._t);
    const selected=new Map();
    // Keep exact public persona text visible even when frequently refreshed
    // model-status snapshots have newer observation times.
    for(const event of ordered.filter(_durablePublicPersonaActivity).slice(-4))
      selected.set(event._key,event);
    for(let index=ordered.length-1;index>=0&&selected.size<12;index--)
      selected.set(ordered[index]._key,ordered[index]);
    return [personaKey,[...selected.values()].sort((a,b)=>a._t-b._t)];
  }));
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
function declaredArtifactMedia(value){ const a=value&&typeof value==='object'?value:{}, L=a._links||{};
  return String(a.media_kind||L.media_kind||a.mime_type||L.mime_type||'').trim(); }
function artifactMediaPresentation(value,path=''){
  const fallbackPath=path||_artifactDisplayPath(value);
  return selectArtifactRenderer(declaredArtifactMedia(value),{path:fallbackPath});
}
function authoredArtifactLabels(value){ const a=value&&typeof value==='object'?value:{}, L=a._links||{};
  const media=declaredArtifactMedia(a);
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
const _ARTIFACT_DECLARATION_DISPLAY_SCHEMA='ai-personas-ui-artifact-declaration-display/1';
function _artifactDeclarationDisplayProjection(value){
  const a=value&&typeof value==='object'?value:{}, L=a._links||{};
  const direct=a.artifact_declaration&&typeof a.artifact_declaration==='object'
    ?a.artifact_declaration:(L.artifact_declaration&&typeof L.artifact_declaration==='object'?L.artifact_declaration:{});
  const provenance=a.provenance&&typeof a.provenance==='object'?a.provenance:{};
  const publicationDeclaration=provenance.schema==='personaos-live-artifact-declaration-publication-provenance/1'
    &&provenance.authority==='verified_artifact_declaration_and_environment_publication'?provenance:{};
  const projected=value?.schema===_ARTIFACT_DECLARATION_DISPLAY_SCHEMA?value:null;
  const text=(candidate,limit=1024)=>String(candidate??'').trim().slice(0,limit);
  const title=text(projected?.title||a.persona_authored_title||L.persona_authored_title
    ||direct.title||publicationDeclaration.title);
  const metadataSource=projected?.metadata&&typeof projected.metadata==='object'
    ?projected.metadata:(a.persona_authored_metadata&&typeof a.persona_authored_metadata==='object'
      ?a.persona_authored_metadata:(direct.metadata&&typeof direct.metadata==='object'
        ?direct.metadata:(publicationDeclaration.metadata&&typeof publicationDeclaration.metadata==='object'
          ?publicationDeclaration.metadata:{})));
  let metadata={}, metadataOmitted=projected?.metadata_omitted===true;
  try{
    const encoded=JSON.stringify(metadataSource);
    if(encoded.length<=8192) metadata=JSON.parse(encoded);
    else metadataOmitted=true;
  }catch(_){ metadataOmitted=true; }
  const declaration={
    schema:_ARTIFACT_DECLARATION_DISPLAY_SCHEMA,
    title,
    declaring_persona_id:text(projected?.declaring_persona_id||direct.declaring_persona_id
      ||publicationDeclaration.declaring_persona_id,512),
    declared_task_id:text(projected?.declared_task_id||direct.declared_task_id
      ||publicationDeclaration.declared_task_id,512),
    declaration_event_id:text(projected?.declaration_event_id||direct.declaration_event_id
      ||publicationDeclaration.declaration_event_id,512),
    declaration_event_hash:text(projected?.declaration_event_hash||direct.declaration_event_hash
      ||publicationDeclaration.declaration_event_hash,256),
    source_action_id:text(projected?.source_action_id||direct.action_id
      ||direct.source_persona_action?.action_id,512),
    metadata,
    metadata_omitted:metadataOmitted,
  };
  declaration.present=Boolean(declaration.title||declaration.declaring_persona_id
    ||declaration.declaration_event_id||Object.keys(metadata).length||metadataOmitted);
  return Object.freeze(declaration);
}
function artifactDeclarationAttr(value){ return JSON.stringify(_artifactDeclarationDisplayProjection(value)); }
function artifactDeclarationFromAttr(value){ try{
  const parsed=JSON.parse(String(value||'{}'));
  return _artifactDeclarationDisplayProjection(parsed);
}catch(_){ return _artifactDeclarationDisplayProjection({}); } }
function _artifactDeclarationPersonaLabel(declaration,kernel=''){
  const id=String(declaration?.declaring_persona_id||'');
  return id?(_nameFor(id,kernel)||_shortId(id)||id):'';
}
function _artifactDeclarationMetadataHTML(declaration){
  const metadata=declaration?.metadata&&typeof declaration.metadata==='object'?declaration.metadata:{};
  const entries=Object.entries(metadata).slice(0,24);
  if(!entries.length&&!declaration?.metadata_omitted) return '';
  // authored provenance is verification detail, not story: keep it reachable
  // but out of the main reading flow, and summarize structured values
  const renderValue=(value)=>{
    if(typeof value==='string') return esc(value);
    try{
      const text=JSON.stringify(value);
      const keys=value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).length:null;
      return `<span class="artifact-authored-value">${esc(text.length>120
        ?(keys!=null?`structured details · ${keys} field${keys===1?'':'s'} (exact values under “plain text view”)`:text.slice(0,117)+'…')
        :text)}</span>`;
    }catch(_){ return esc(String(value)); }
  };
  const rows=entries.map(([key,value])=>kv(key,renderValue(value))).join('');
  return `<details class="fv-technical"><summary>Persona-authored file details</summary><div>${rows}`
    +(declaration?.metadata_omitted?`<div class="fv-note">Additional authored metadata is retained in the signed record but is too large for this compact view.</div>`:'')+`</div></details>`;
}
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
      model:String(m.model_id||'—'), role:String(m.role||''), reason:String(m.reason||''),
      environment:_shortId(m.environment_id),run:String(m.run_id||''),task:String(m.task_id||'')};
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
const P2P_BOOTSTRAP_LIMITS=Object.freeze({maxKnown:64,maxCandidatesPerSource:256,
  maxQueue:16,maxConcurrent:2,dialTimeoutMs:5000,retryBaseMs:5000,
  retryMaxMs:60000,successfulRedialMs:60000});
const PORTAL_P2P_HINTS_MAX_BYTES=16*1024;
// Served beside the module so node-served shells (which mount only assets/ +
// index.html) stop 404ing; the GitHub Pages mirror keeps a root-level copy.
const PORTAL_P2P_HINTS_URL=new URL('./p2p-bootstrap-hints.json?v=20260822-assets-path-v5',import.meta.url).href;
const P2P_ROUTE_LIMITS=Object.freeze({maxCandidatesPerResolution:16,
  maxReconciliationsPerJob:8,maxRouteAttemptsPerSource:4,maxMultiaddrsPerProvider:8,
  maxRendezvousBucketsPerRefresh:3,
  maxRememberedProviders:64,providerRetryMs:30*1000,
  successfulRefreshMs:45*1000,verifiedGossipRetryMs:30*1000,
  initialRefreshMs:0,coldRetryBaseMs:3000,coldRetryMaxMs:10000,steadyRefreshMs:60000,
  jobDeadlineMs:30000});
function boundedP2PBootstrapSource(value){
  if(typeof value==='string') return [value];
  return Array.isArray(value)?value.slice(0,P2P_BOOTSTRAP_LIMITS.maxCandidatesPerSource):[];
}
function rememberP2PBootstraps(sourceLists,{dial=false}={}){
  // Bound how much untrusted input is scanned per source, but filter for an
  // actually browser-eligible transport before applying the 64-address
  // admission ceiling. An invalid bootstrap list therefore cannot crowd valid
  // relay entries out merely by appearing first.
  const sources=(Array.isArray(sourceLists)?sourceLists:[sourceLists])
    .map(boundedP2PBootstrapSource);
  const eligible=collectBrowserLibp2pBootstraps(
    {pageProtocol:location.protocol},...sources);
  const admitted=[];
  for(const multiaddr of eligible){
    if(S.p2pBootstraps.has(multiaddr)){
      if(dial) _queueP2PBootstrapDial(multiaddr);
      continue;
    }
    if(S.p2pBootstraps.size>=P2P_BOOTSTRAP_LIMITS.maxKnown){
      if(!S._p2pBootstrapLimitNoted){
        S._p2pBootstrapLimitNoted=true;
        log('p2p','browser bootstrap address limit reached; additional transport hints refused',false);
      }
      break;
    }
    S.p2pBootstraps.add(multiaddr); admitted.push(multiaddr);
    if(dial) _queueP2PBootstrapDial(multiaddr);
  }
  return admitted;
}
function collectP2PBootstraps(boot,{dial=false}={}){
  return rememberP2PBootstraps([
    boot?.bootstrap_peers,
    boot?.relay_peers,
    boot?.reachability_profile?.bootstrap_peers,
    boot?.reachability_profile?.relay_peers,
  ],{dial});
}
async function loadPortalP2PBootstrapHints({dial=false}={}){
  // This same-origin file is a replaceable transport commons, not a registry:
  // it can only help the browser reach public peers. It cannot admit a node, persona,
  // telemetry frame or artifact; those still traverse the current-master,
  // signature, inventory and body-hash verification paths below.
  // Node-served shells already receive signed reachability/bootstrap hints from
  // their node bootstrap. The repository-level commons exists only on the
  // hosted portal; do not issue a guaranteed root-file 404 on every local load.
  if(location.hostname!=='ai-personas.github.io') return [];
  const hints=await fetchJson(PORTAL_P2P_HINTS_URL,{
    signal:AbortSignal.timeout(3000),maxBytes:PORTAL_P2P_HINTS_MAX_BYTES});
  const libp2p=Array.isArray(hints)?hints:hints?.libp2p;
  if(!Array.isArray(libp2p)) return [];
  const peerRoutes=(Array.isArray(hints?.https)?hints.https:[])
    .map(normalizedHttpsBase).filter(Boolean).slice(0,P2P_BOOTSTRAP_LIMITS.maxKnown);
  for(const base of peerRoutes) S.portalPeers.add(base);
  const admitted=rememberP2PBootstraps([libp2p],{dial});
  if(admitted.length)
    log('p2p',`${admitted.length} same-origin transport bootstrap hint(s) admitted; zero record authority`);
  if(peerRoutes.length)
    log('bootstrap',`${peerRoutes.length} direct peer route hint(s) admitted; records still require signature verification`);
  return admitted;
}
function admitKeysDocument(base,boot,keysDoc,{expectedMaster=''}={}){
  const key=base||'@origin';
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
  if(expectedMaster&&String(masters[0]?.public_key_hex||'').toLowerCase()
      !==String(expectedMaster).toLowerCase()) valid=false;
  if(masters.length===1&&String(keysDoc.kernel_id||'')
      !==`kernel:${String(masters[0].public_key_hex).toLowerCase().slice(0,16)}`) valid=false;
  if(!valid){ S.keys.delete(key); S.keyDocs.delete(key);
    log('keys',`${boot?.kernel_id||key}: current master registry invalid`,false); return {}; }
  S.keys.set(key,keys); S.keyDocs.set(key,{schema:keysDoc.schema,
    kernelId:String(keysDoc.kernel_id||''),entries,at:Date.now()});
  return keys;
}
const keyRegistryFetchJobs=new Map();
async function keysFor(base,boot,{refresh=false,signal=null,expectedMaster=''}={}){
  const key=base||'@origin';
  const cached=S.keyDocs.get(key);
  const cachedMaster=currentMasterKey(cached?.entries||[]);
  if(!refresh&&S.keys.has(key)&&cached&&Date.now()-cached.at<10000
      &&(!boot?.kernel_id||cached.kernelId===boot.kernel_id)
      &&(!expectedMaster||cachedMaster.toLowerCase()===String(expectedMaster).toLowerCase()))
    return S.keys.get(key);
  const route=join(base,boot?.keys_url||'.well-known/personaos-keys.json');
  const jobKey=`${opBaseKey(base||location.origin)}\u0000${route}`;
  let job=keyRegistryFetchJobs.get(jobKey);
  if(!job){
    job=fetchJson(route,{signal:AbortSignal.timeout(8000),maxBytes:256*1024})
      .finally(()=>{ if(keyRegistryFetchJobs.get(jobKey)===job)
        keyRegistryFetchJobs.delete(jobKey); });
    keyRegistryFetchJobs.set(jobKey,job);
  }
  const keysDoc=await settleBeforeAbort(job,signal,null);
  // A route-reconciliation deadline is not evidence that a previously verified
  // registry became invalid. Do not let its abort erase shared cached authority.
  if(signal?.aborted||keysDoc==null){
    if(expectedMaster&&cachedMaster.toLowerCase()!==String(expectedMaster).toLowerCase()) return {};
    return S.keys.get(key)||{};
  }
  return admitKeysDocument(base,boot,keysDoc,{expectedMaster});
}

const OPEN_INPUT_DIRECTORY_FIELDS=Object.freeze([
  'anonymous_submission_allowed','generated_at','kernel_id','open_request_count',
  'owner_bearer_required','owner_contribution_url','persona_contribution_url',
  'request_count','requests','revision','schema','semantic_interpretation_performed',
].sort());
const OPEN_INPUT_ENTRY_FIELDS=Object.freeze([
  'author_display_name','contributions','human_precedence_applied',
  'preferred_contribution_id','preferred_source_kind','request',
  'request_authority_hash','request_event_id','request_signature_verified',
  'resolution','semantic_acceptance_performed','status',
].sort());
const OPEN_INPUT_REQUEST_FIELDS=Object.freeze([
  'acceptance_criteria','author_persona_id','context_refs','created_at',
  'environment_id','mission_task_id','question','request_id','response_schema',
  'schema','signature_hex','signing_key_id','task_id','title','visibility','why_needed',
].sort());
const OPEN_INPUT_CONTRIBUTION_FIELDS=Object.freeze([
  'contribution_id','contributor_id','contributor_name','created_at','environment_id',
  'evidence_refs','request_id','schema','signature_hex','signing_key_id','source_kind',
  'task_id','value',
].sort());
const OPEN_INPUT_RESOLUTION_FIELDS=Object.freeze([
  'author_persona_id','created_at','disposition','environment_id','evidence_refs',
  'rationale','request_id','resolution_id','schema','selected_contribution_id',
  'signature_hex','signing_key_id','task_id',
].sort());
const _exactObjectFields=(value,fields)=>!!value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).sort().join('\u0000')===fields.join('\u0000');
const _boundedExactRefs=(value)=>Array.isArray(value)&&value.length<=32
  &&new Set(value).size===value.length&&value.every((item)=>typeof item==='string'
    &&item===item.trim()&&item.length>0&&item.length<=1024);
function _openInputClaimEnvelope(claim){
  const record={}; for(const key of Object.keys(claim||{})) if(key!=='signature_hex') record[key]=claim[key];
  return {record,signing_key_id:String(claim?.signing_key_id||''),signature_hex:String(claim?.signature_hex||'')};
}
async function _verifiedOpenInputClaim(claim,keyEntries,{remoteMayBeKernelAttested=false}={}){
  const schema=String(claim?.schema||''); let fields=null;
  if(schema==='personaos-open-input-request/1') fields=OPEN_INPUT_REQUEST_FIELDS;
  else if(schema==='personaos-open-input-contribution/1') fields=OPEN_INPUT_CONTRIBUTION_FIELDS;
  else if(schema==='personaos-open-input-resolution/1') fields=OPEN_INPUT_RESOLUTION_FIELDS;
  if(!fields||!_exactObjectFields(claim,fields)||!/^[0-9a-f]{128}$/.test(String(claim.signature_hex||''))
      ||typeof claim.environment_id!=='string'||!claim.environment_id
      ||typeof claim.task_id!=='string'||!claim.task_id
      ||typeof claim.created_at!=='string'||!Number.isFinite(Date.parse(claim.created_at))) return false;
  if(schema==='personaos-open-input-request/1'){
    if(!['public','environment'].includes(claim.visibility)
        ||typeof claim.request_id!=='string'||!claim.request_id
        ||typeof claim.author_persona_id!=='string'||!claim.author_persona_id
        ||claim.signing_key_id!==`persona:${claim.author_persona_id}`
        ||typeof claim.title!=='string'||!claim.title||typeof claim.question!=='string'||!claim.question
        ||typeof claim.why_needed!=='string'||!claim.why_needed
        ||!claim.response_schema||typeof claim.response_schema!=='object'||Array.isArray(claim.response_schema)
        ||!_boundedExactRefs(claim.context_refs)) return false;
  }else if(schema==='personaos-open-input-contribution/1'){
    if(!['persona','owner_human'].includes(claim.source_kind)
        ||typeof claim.contribution_id!=='string'||!claim.contribution_id
        ||typeof claim.request_id!=='string'||!claim.request_id
        ||typeof claim.contributor_id!=='string'||!claim.contributor_id
        ||typeof claim.contributor_name!=='string'||!_boundedExactRefs(claim.evidence_refs)) return false;
    if(claim.source_kind==='persona'&&claim.signing_key_id!==`persona:${claim.contributor_id}`) return false;
    if(claim.source_kind==='owner_human'&&claim.signing_key_id!=='kernel-master') return false;
  }else if(!['resolved','withdrawn'].includes(claim.disposition)
      ||typeof claim.resolution_id!=='string'||!claim.resolution_id
      ||typeof claim.request_id!=='string'||!claim.request_id
      ||typeof claim.author_persona_id!=='string'||!claim.author_persona_id
      ||claim.signing_key_id!==`persona:${claim.author_persona_id}`
      ||typeof claim.rationale!=='string'||!claim.rationale
      ||typeof claim.selected_contribution_id!=='string'||!_boundedExactRefs(claim.evidence_refs)) return false;
  const verified=await verifyRecord(_openInputClaimEnvelope(claim),keyEntries||[]);
  if(verified.ok) return true;
  return remoteMayBeKernelAttested&&schema==='personaos-open-input-contribution/1'
    &&claim.source_kind==='persona';
}
async function admitVerifiedOpenInputDirectory(document,base,boot){
  if(!_exactObjectFields(document,['record','signature_hex','signing_key_id'])
      ||document.signing_key_id!=='kernel-master'
      ||!/^[0-9a-f]{128}$/.test(String(document.signature_hex||''))) return false;
  const record=document.record, registry=S.keyDocs.get(base||'@origin');
  if(!_exactObjectFields(record,OPEN_INPUT_DIRECTORY_FIELDS)
      ||record.schema!=='personaos-open-input-directory/1'||record.kernel_id!==boot?.kernel_id
      ||record.anonymous_submission_allowed!==false||record.owner_bearer_required!==true
      ||record.owner_contribution_url!=='inputs/owner-contribution'
      ||record.persona_contribution_url!=='inputs/persona-contribution'
      ||record.semantic_interpretation_performed!==false
      ||!/^sha256:[0-9a-f]{64}$/.test(String(record.revision||''))
      ||!Array.isArray(record.requests)||record.requests.length>512
      ||record.request_count!==record.requests.length
      ||record.open_request_count!==record.requests.filter((item)=>item?.status==='open').length) return false;
  const directoryVerification=await verifyRecord(document,registry?.entries||[]);
  if(!directoryVerification.ok||directoryVerification.entry?.key_id!=='kernel-master'
      ||directoryVerification.entry?.status!=='current'||directoryVerification.entry?.role!=='master') return false;
  const requestIds=new Set();
  for(const item of record.requests){
    if(!_exactObjectFields(item,OPEN_INPUT_ENTRY_FIELDS)||!_exactObjectFields(item.request,OPEN_INPUT_REQUEST_FIELDS)
        ||item.request_signature_verified!==true||item.semantic_acceptance_performed!==false
        ||!['open','resolved','withdrawn'].includes(item.status)
        ||!Array.isArray(item.contributions)||item.contributions.length>512
        ||!/^sha256:[0-9a-f]{64}$/.test(String(item.request_authority_hash||''))
        ||requestIds.has(item.request.request_id)
        ||!await _verifiedOpenInputClaim(item.request,registry?.entries||[])) return false;
    requestIds.add(item.request.request_id);
    const contributionIds=new Set(); let ownerCount=0;
    for(const contribution of item.contributions){
      if(!_exactObjectFields(contribution,OPEN_INPUT_CONTRIBUTION_FIELDS)
          ||contribution.request_id!==item.request.request_id
          ||contribution.environment_id!==item.request.environment_id
          ||contribution.task_id!==item.request.task_id
          ||contributionIds.has(contribution.contribution_id)
          ||!await _verifiedOpenInputClaim(contribution,registry?.entries||[],{remoteMayBeKernelAttested:true})) return false;
      contributionIds.add(contribution.contribution_id);
      if(contribution.source_kind==='owner_human') ownerCount++;
    }
    if(item.resolution!==null){
      if(!_exactObjectFields(item.resolution,OPEN_INPUT_RESOLUTION_FIELDS)
          ||item.resolution.request_id!==item.request.request_id
          ||item.resolution.environment_id!==item.request.environment_id
          ||item.resolution.task_id!==item.request.task_id
          ||item.status!==item.resolution.disposition
          ||(item.resolution.selected_contribution_id
            &&!contributionIds.has(item.resolution.selected_contribution_id))
          ||!await _verifiedOpenInputClaim(item.resolution,registry?.entries||[])) return false;
    }else if(item.status!=='open') return false;
    const preferred=String(item.preferred_contribution_id||'');
    if(preferred&&!contributionIds.has(preferred)) return false;
    if(item.human_precedence_applied!==(ownerCount>0)
        ||(ownerCount>0&&item.preferred_source_kind!=='owner_human')) return false;
  }
  const key=base||'@origin', prior=S.openInputDirectories.get(key);
  S.openInputDirectories.set(key,{base:base||'',kernelId:record.kernel_id,record,
    receivedAt:Date.now(),revision:record.revision});
  if(!prior||prior.revision!==record.revision) renderOpenInputs();
  return true;
}
const openInputDirectoryJobs=new Map();
async function refreshOpenInputDirectory(base,boot,{signal=null,force=false}={}){
  const key=base||'@origin', route=String(boot?.open_inputs_url||'');
  if(!route){ S.openInputDirectories.delete(key); renderOpenInputs(); return false; }
  const now=Date.now(), next=S.openInputFetchAfter.get(key)||0;
  if(!force&&now<next) return true;
  S.openInputFetchAfter.set(key,now+1000);
  const url=join(base,route), jobKey=`${opBaseKey(base||location.origin)}\u0000${url}`;
  let job=openInputDirectoryJobs.get(jobKey);
  if(!job){
    job=fetchResponsivePublicJson(url,{signal:AbortSignal.timeout(5000),maxBytes:2*1024*1024,
      verifiedDirectFallback:true}).finally(()=>{
        if(openInputDirectoryJobs.get(jobKey)===job) openInputDirectoryJobs.delete(jobKey);
      });
    openInputDirectoryJobs.set(jobKey,job);
  }
  const document=await settleBeforeAbort(job,signal,null);
  if(!document) return false;
  return admitVerifiedOpenInputDirectory(document,base,boot);
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
async function verifyHttpProviderWithKeyRefresh(envelope,doc,boot,base,expectedKey='',
  {signal=null}={}){
  if(signal?.aborted) return {ok:false,reason:'provider_verification_aborted',keys:{}};
  let keys=await keysFor(base,boot,{signal});
  let verification=await verifyHttpProviderEnvelope(envelope,doc,keys,boot,base,expectedKey);
  if(verification.ok) return {...verification,keys};
  if(signal?.aborted) return {...verification,keys:{}};
  const cacheKey=base||'@origin', last=S.providerKeyRefreshAt.get(cacheKey)||0;
  if(Date.now()-last<10000) return {...verification,keys:{}};
  S.providerKeyRefreshAt.set(cacheKey,Date.now());
  keys=await keysFor(base,boot,{refresh:true,signal});
  if(signal?.aborted) return {...verification,keys:{}};
  verification=await verifyHttpProviderEnvelope(envelope,doc,keys,boot,base,expectedKey);
  return verification.ok?{...verification,keys}:{...verification,keys:{}};
}
async function verifyPersonaLifecycleCard(card,record,documentKey){
  if(record?.kind!=='persona'||documentKey?.key_id!=='kernel-master') return false;
  if(!card||typeof card!=='object'||Array.isArray(card)
      ||card.schema!=='personaos-persona-lifecycle-card/2'
      ||card.signing_key_id!=='kernel-master'
      ||!/^[0-9a-f]{128}$/i.test(String(card.signature_hex||''))) return false;
  const payload={};
  for(const key of Object.keys(card)) if(key!=='signature_hex') payload[key]=card[key];
  try{ return await ed.verifyAsync(hexToBytes(card.signature_hex),enc.encode(canon(payload)),
    hexToBytes(documentKey.public_key_hex)); }catch(_){ return false; }
}
const PERSONA_PARTICIPATION_ENVELOPE_FIELDS=Object.freeze([
  'card','path','persona_id','schema','signature_hex','signing_key_id','ttl_seconds',
].sort());
const PERSONA_PARTICIPATION_REQUIRED_FIELDS=Object.freeze([
  'accepts_inbound_from','charter_hash','description','expires_at','federation_visibility',
  'identity_authority','kernel_a2a_url','kernel_provider','name','persona_id','rate_limit',
  'schema','signing_key_id','soul_hash','soul_version','visibility','voice_hash',
]);
const PERSONA_PARTICIPATION_ALLOWED_FIELDS=new Set([
  ...PERSONA_PARTICIPATION_REQUIRED_FIELDS,
  'avatar','capabilities_summary','characteristic_identity','display_name_alias',
  'participation_status','self_publication',
]);
// persona-card/5 adds the optional persona-authored `self_publication` object
// (body/revision/identity_signature_hex …). It rides inside the signed card and
// is treated as opaque; presentation escapes any text before it reaches the DOM.
const PERSONA_CARD_ACCEPTED_SCHEMAS=new Set(['persona-card/4','persona-card/5']);
const PERSONA_CAPABILITY_REQUIRED_FIELDS=Object.freeze([
  'description','name','skill_hash','skill_id',
]);
const PERSONA_CAPABILITY_ALLOWED_FIELDS=new Set([
  ...PERSONA_CAPABILITY_REQUIRED_FIELDS,'lineage_parent_skill_id',
]);
const PERSONA_PARTICIPATION_EXPIRES_RE=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;
function _plainPersonaParticipationObject(value){
  return !!value&&typeof value==='object'&&!Array.isArray(value);
}
function _exactPersonaParticipationName(value){
  return typeof value==='string'&&[...value].length<=80&&enc.encode(value).length<=320
    &&!/\p{Cc}/u.test(value);
}
function _exactPersonaParticipationDescription(value){
  return typeof value==='string'&&[...value].length<=240&&enc.encode(value).length<=960;
}
function _exactPersonaCapabilityText(value,maximum,required=true){
  return typeof value==='string'&&value===value.trim()&&(!required||!!value)
    &&enc.encode(value).length<=maximum
    &&!/[\u0000-\u001f\u007f]/u.test(value);
}
function _exactPersonaCapabilitiesSummary(value){
  if(value===undefined) return [];
  if(!Array.isArray(value)||value.length>64) return null;
  const seen=new Set(),out=[];
  for(const item of value){
    if(!_plainPersonaParticipationObject(item)
        ||PERSONA_CAPABILITY_REQUIRED_FIELDS.some((field)=>!Object.hasOwn(item,field))
        ||Object.keys(item).some((field)=>!PERSONA_CAPABILITY_ALLOWED_FIELDS.has(field))
        ||!_exactPersonaCapabilityText(item.skill_id,180)
        ||!_exactPersonaCapabilityText(item.name,240)
        ||!_exactPersonaCapabilityText(item.description,1600)
        ||!_exactPersonaCapabilityText(item.skill_hash,180)
        ||(Object.hasOwn(item,'lineage_parent_skill_id')
          &&!_exactPersonaCapabilityText(item.lineage_parent_skill_id,180,false))
        ||seen.has(item.skill_id)) return null;
    seen.add(item.skill_id); out.push({...item});
  }
  return out;
}
function _exactPersonaCharacteristics(value){
  if(!_plainPersonaParticipationObject(value)
      ||value.schema!=='persona-characteristic-card/1'
      ||!_plainPersonaParticipationObject(value.characteristics)) return null;
  let entries=0;
  const bounded=(item,depth=0)=>{
    if(depth>12||++entries>2048) return false;
    if(item===null||typeof item==='boolean') return true;
    if(typeof item==='number') return Number.isFinite(item);
    if(typeof item==='string') return [...item].length<=16384
      &&enc.encode(item).length<=65536;
    if(Array.isArray(item)) return item.length<=256
      &&item.every((nested)=>bounded(nested,depth+1));
    if(!_plainPersonaParticipationObject(item)||Object.keys(item).length>256) return false;
    return Object.entries(item).every(([key,nested])=>typeof key==='string'
      &&[...key].length<=16384&&enc.encode(key).length<=65536
      &&bounded(nested,depth+1));
  };
  const source=value.characteristics;
  try{
    if(!bounded(source)||enc.encode(canon(source)).length>65536) return null;
    return Object.freeze(JSON.parse(JSON.stringify(source)));
  }catch(_){ return null; }
}
function _currentPersonaParticipationExpiry(value,now=Date.now()){
  if(typeof value!=='string') return false;
  const match=PERSONA_PARTICIPATION_EXPIRES_RE.exec(value);
  if(!match) return false;
  const [,yearText,monthText,dayText,hourText,minuteText,secondText,fraction='',zone]=match;
  const year=Number(yearText),month=Number(monthText),day=Number(dayText);
  const hour=Number(hourText),minute=Number(minuteText),second=Number(secondText);
  if(hour>23||minute>59||second>59) return false;
  const wall=new Date(0); wall.setUTCFullYear(year,month-1,day);
  wall.setUTCHours(hour,minute,second,0);
  if(wall.getUTCFullYear()!==year||wall.getUTCMonth()!==month-1
      ||wall.getUTCDate()!==day||wall.getUTCHours()!==hour
      ||wall.getUTCMinutes()!==minute||wall.getUTCSeconds()!==second) return false;
  let offsetMinutes=0;
  if(zone!=='Z'){
    const offsetHour=Number(zone.slice(1,3)),offsetMinute=Number(zone.slice(4,6));
    if(offsetHour>23||offsetMinute>59) return false;
    offsetMinutes=(offsetHour*60+offsetMinute)*(zone[0]==='+'?1:-1);
  }
  const expiresAt=wall.getTime()+(fraction?Number(`0.${fraction}`)*1000:0)
    -offsetMinutes*60_000;
  return Number.isFinite(expiresAt)&&expiresAt>now;
}
async function verifyPersonaParticipationCard(envelope,record,identity,publicKeyHex){
  if(record?.kind!=='persona'||!identity||!/^[0-9a-f]{64}$/.test(publicKeyHex)
      ||!_exactObjectFields(envelope,PERSONA_PARTICIPATION_ENVELOPE_FIELDS)) return null;
  const personaId=identity.signedId, keyId=`persona:${personaId}`, card=envelope.card;
  if(!_plainPersonaParticipationObject(card)
      ||PERSONA_PARTICIPATION_REQUIRED_FIELDS.some((field)=>!Object.hasOwn(card,field))
      ||Object.keys(card).some((field)=>!PERSONA_PARTICIPATION_ALLOWED_FIELDS.has(field))
      ||!PERSONA_CARD_ACCEPTED_SCHEMAS.has(envelope.schema)||card.schema!==envelope.schema
      ||envelope.persona_id!==personaId||card.persona_id!==personaId
      ||envelope.path!==`.well-known/personas/${personaId}.json`
      ||envelope.signing_key_id!==keyId||card.signing_key_id!==keyId
      ||record.identity_signing_key_id!==keyId
      ||String(record.identity_public_key_hex||'')!==publicKeyHex
      ||record.visibility_tier!=='public'
      ||card.visibility!=='public'||card.federation_visibility!=='public'
      ||card.name!==record.label||!_exactPersonaParticipationName(card.name)
      ||!_exactPersonaParticipationDescription(card.description)
      ||!Number.isSafeInteger(envelope.ttl_seconds)
      ||envelope.ttl_seconds<1||envelope.ttl_seconds>86400
      ||!_currentPersonaParticipationExpiry(card.expires_at)
      ||!/^[0-9a-f]{128}$/i.test(String(envelope.signature_hex||''))
      ||!Number.isSafeInteger(card.soul_version)
      ||!_plainPersonaParticipationObject(card.rate_limit)
      ||!_plainPersonaParticipationObject(card.identity_authority)) return null;
  const capabilitiesSummary=_exactPersonaCapabilitiesSummary(card.capabilities_summary);
  if(capabilitiesSummary===null) return null;
  for(const field of ['charter_hash','voice_hash','soul_hash','kernel_provider','kernel_a2a_url',
    'accepts_inbound_from']) if(typeof card[field]!=='string') return null;
  for(const field of ['display_name_alias','characteristic_identity','self_publication'])
    if(Object.hasOwn(card,field)&&(!_plainPersonaParticipationObject(card[field])
      ||Object.keys(card[field]).length===0)) return null;
  if(Object.keys(card.identity_authority).length===0) return null;
  if(Object.hasOwn(card,'participation_status')
      &&(typeof card.participation_status!=='string'||!card.participation_status))
    return null;
  // Profile enrichment is not participation authority. Bind its exact signed
  // bytes to the outer record, but let the independent avatar hydration gate
  // validate descriptor, identity signature, body hash, MIME, and dimensions.
  if(canon(card.avatar||{})!==canon(record.avatar||{})) return null;
  let signatureVerified=false;
  try{ signatureVerified=await ed.verifyAsync(hexToBytes(envelope.signature_hex),
    enc.encode(canon(card)),hexToBytes(publicKeyHex)); }catch(_){ signatureVerified=false; }
  const characteristics=_exactPersonaCharacteristics(card.characteristic_identity);
  return signatureVerified?Object.freeze({
    envelope,name:card.name,capabilitiesSummary:Object.freeze(capabilitiesSummary),
    characteristics,
  }):null;
}
const PUBLIC_TASK_LIFECYCLE_FIELDS=Object.freeze([
  'access','amended_from_run','block','continued_from_run','current_execution','environment_id',
  'kernel_id','links',
  'pressure','resumed_from_run','review','revision','root_run_id','run_id','schema','signature_hex',
  'signing_key_id','state','task_id','terminal_reason',
].sort());
const PUBLIC_TASK_LIFECYCLE_REVISION_FIELDS=Object.freeze([
  'schema','kernel_id','run_id','task_id','current_execution','environment_id',
  'resumed_from_run','continued_from_run','amended_from_run','root_run_id','state',
  'pressure','review','block','terminal_reason','links','access',
]);
const PUBLIC_TASK_LIFECYCLE_CAPABILITY_PREFIXES=Object.freeze([
  'task_state:','task_run:','task_id:','task_current_execution:','task_environment:',
  'task_resumed_from:','task_continued_from:','task_amended_from:','task_root_run:',
  'task_revision:',
]);
const PUBLIC_TASK_LIFECYCLE_RUN_RE=/^run-[A-Za-z0-9_-]{1,180}$/;
const PUBLIC_TASK_LIFECYCLE_TASK_ID_RE=/^[A-Za-z0-9][A-Za-z0-9:_.-]{0,255}$/;
function _plainLifecycleObject(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function _publicLifecycleText(value,maximum){ return typeof value==='string'&&value===value.trim()
  &&!!value&&[...value].length<=maximum&&!/[\u0000-\u001f\u007f]/u.test(value); }
async function verifyPublicTaskLifecycle(lifecycle,record,documentKey,kernelId){
  if(record?.kind!=='task'||documentKey?.key_id!=='kernel-master'
      ||!_exactObjectFields(lifecycle,PUBLIC_TASK_LIFECYCLE_FIELDS)
      ||lifecycle.schema!=='personaos-public-task-lifecycle/2'
      ||lifecycle.kernel_id!==kernelId
      ||lifecycle.access!=='public_read_only'
      ||lifecycle.signing_key_id!=='kernel-master'
      ||typeof lifecycle.run_id!=='string'
      ||!PUBLIC_TASK_LIFECYCLE_RUN_RE.test(lifecycle.run_id)
      ||!PUBLIC_TASK_LIFECYCLE_TASK_ID_RE.test(String(lifecycle.task_id||''))
      ||typeof lifecycle.current_execution!=='boolean'
      ||typeof lifecycle.environment_id!=='string'
      ||(lifecycle.environment_id
        &&!PUBLIC_TASK_LIFECYCLE_TASK_ID_RE.test(lifecycle.environment_id))
      ||typeof lifecycle.continued_from_run!=='string'
      ||(lifecycle.continued_from_run
        &&!PUBLIC_TASK_LIFECYCLE_RUN_RE.test(lifecycle.continued_from_run))
      ||typeof lifecycle.amended_from_run!=='string'
      ||(lifecycle.amended_from_run
        &&!PUBLIC_TASK_LIFECYCLE_RUN_RE.test(lifecycle.amended_from_run))
      ||typeof lifecycle.resumed_from_run!=='string'
      ||(lifecycle.resumed_from_run
        &&!PUBLIC_TASK_LIFECYCLE_RUN_RE.test(lifecycle.resumed_from_run))
      ||typeof lifecycle.root_run_id!=='string'
      ||!PUBLIC_TASK_LIFECYCLE_RUN_RE.test(lifecycle.root_run_id)
      ||(lifecycle.continued_from_run&&lifecycle.continued_from_run===lifecycle.run_id)
      ||(lifecycle.amended_from_run&&lifecycle.amended_from_run===lifecycle.run_id)
      ||(lifecycle.resumed_from_run&&lifecycle.resumed_from_run===lifecycle.run_id)
      ||((lifecycle.continued_from_run||lifecycle.amended_from_run
          ||lifecycle.resumed_from_run)
        &&lifecycle.root_run_id===lifecycle.run_id)
      ||(!(lifecycle.continued_from_run||lifecycle.amended_from_run
          ||lifecycle.resumed_from_run)
        &&lifecycle.root_run_id!==lifecycle.run_id)
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
    `task_current_execution:${lifecycle.current_execution?'true':'false'}`,
    `task_environment:${lifecycle.environment_id}`,
    `task_continued_from:${lifecycle.continued_from_run}`,
    `task_amended_from:${lifecycle.amended_from_run}`,
    `task_resumed_from:${lifecycle.resumed_from_run}`,
    `task_root_run:${lifecycle.root_run_id}`,
    `task_revision:${lifecycle.revision}`,
  ];
  const capabilities=Array.isArray(record.capability_summary)?record.capability_summary:[];
  if(expectedCapabilities.some((value)=>capabilities.filter((item)=>item===value).length!==1))
    return false;
  if(PUBLIC_TASK_LIFECYCLE_CAPABILITY_PREFIXES.some((prefix)=>
    capabilities.filter((item)=>typeof item==='string'&&item.startsWith(prefix)).length!==1))
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
  'topology','topology_hash',
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
  const cacheKey=base||'@origin';
  const verifyWithCurrentRegistry=async()=>{
    const registry=S.keyDocs.get(cacheKey);
    return !!registry?.kernelId&&String(live.node_id||'')===registry.kernelId
      &&await verifyCurrentMasterSignedDocument(base,live);
  };
  if(await verifyWithCurrentRegistry()) return true;
  const boot=S.boots.get(cacheKey);
  if(!boot?.kernel_id||String(live.node_id||'')!==boot.kernel_id) return false;
  const route=S.p2pDataRoutes?.get(opBaseKey(base||''));
  const provider=route?.providerRecord;
  const expectedMaster=provider?.host_kernel_id===boot.kernel_id
    &&/^[0-9a-f]{64}$/i.test(String(provider?.public_key_hex||''))
    ?String(provider.public_key_hex).toLowerCase():'';
  const last=S.telemetryKeyRefreshAt.get(cacheKey)||0;
  if(Date.now()-last<10000) return false;
  S.telemetryKeyRefreshAt.set(cacheKey,Date.now());
  await keysFor(base,boot,{refresh:true,expectedMaster});
  return verifyWithCurrentRegistry();
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
// ---- C-OP-16 member-view siblings: kernel-signed, additive, verified per
// sibling and failed closed per sibling (an unverified sibling is absent; the
// record itself still renders). Field sets are exact: an extra or missing
// member refuses the document. ----
const PUBLIC_RUN_SCORECARD_SCHEMA='personaos-public-run-scorecard/1';
const PUBLIC_RUN_SCORECARD_FIELDS=Object.freeze(['counters','environment_id','record_hash','run_id','schema',
  'scorecard_event_id','settled_at','signature_hex','signing_key_id','task_id','unavailable_counters']);
const PUBLIC_IDENTITY_REQUIREMENT_STATUS_SCHEMA='personaos-public-identity-requirement-status/1';
const PUBLIC_IDENTITY_REQUIREMENT_STATUS_FIELDS=Object.freeze(['claim_hash','declared_at','declined','persona_id',
  'reason','refusal_event_id','requirement_id','schema','signature_hex','signing_key_id']);
const PUBLIC_IDENTITY_REQUIREMENT_REASON_MAX_CHARS=600;
const _SCORECARD_COUNTER_NAME=/^[a-z][a-z0-9_]{0,63}$/;
function _exactFieldSet(doc,fields){
  if(!doc||typeof doc!=='object'||Array.isArray(doc)) return false;
  const keys=Object.keys(doc).sort();
  return keys.length===fields.length&&keys.every((key,index)=>key===fields[index]);
}
function _boundedPublicText(value,max){
  return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
}
function publicRunScorecardShapeOk(doc){
  if(!_exactFieldSet(doc,PUBLIC_RUN_SCORECARD_FIELDS)) return false;
  if(doc.schema!==PUBLIC_RUN_SCORECARD_SCHEMA||doc.signing_key_id!=='kernel-master') return false;
  for(const key of ['environment_id','task_id','run_id','settled_at','scorecard_event_id'])
    if(!_boundedPublicText(doc[key],200)) return false;
  if(!/^sha256:[0-9a-f]{64}$/.test(String(doc.record_hash||''))) return false;
  const counters=doc.counters;
  if(!counters||typeof counters!=='object'||Array.isArray(counters)) return false;
  const names=Object.keys(counters);
  if(names.length>64) return false;
  for(const name of names){
    if(!_SCORECARD_COUNTER_NAME.test(name)||!Number.isInteger(counters[name])||counters[name]<0) return false;
  }
  const unavailable=doc.unavailable_counters;
  if(!Array.isArray(unavailable)||unavailable.length>64) return false;
  const seen=new Set(names);
  for(const name of unavailable){
    if(typeof name!=='string'||!_SCORECARD_COUNTER_NAME.test(name)||seen.has(name)) return false;
    seen.add(name);
  }
  return true;
}
async function verifyPublicRunScorecard(base,doc,record){
  if(record?.kind!=='task'||!publicRunScorecardShapeOk(doc)) return false;
  return verifyCurrentMasterSignedDocument(base,doc);
}
const PUBLIC_RUN_SCORECARDS_MAX=64;
// Environment records carry `run_scorecards`: one signed scorecard per task
// of the environment (the newest settle of that task), newest first. The
// task record is not a durable carrier -- an operator stop leaves the run
// document incomplete and the live task doc vanishes at termination, exactly
// when the scorecard appears -- so the environment record carries them.
// Admission is exact and fails closed per element: an oversized array admits
// nothing; each element must have the exact scorecard shape and name THIS
// environment; a later element repeating a task id is dropped (the first,
// newest, stands). Signatures are verified afterwards, one element at a time.
// `envIdentities`: a string (one environment), an iterable of identities, or
// null when the carrier's memberships are not known at admission time -- then
// the element is admitted on shape alone and the kernel signature below binds
// the persona-independent facts. An empty known set admits nothing.
function _admitRunScorecardsArray(list,envIdentities){
  if(!Array.isArray(list)||list.length>PUBLIC_RUN_SCORECARDS_MAX) return [];
  let want=null;
  if(envIdentities!=null){
    const values=typeof envIdentities==='string'?[envIdentities]:[...envIdentities];
    want=new Set(values.map((value)=>environmentIdentity(String(value||''))).filter(Boolean));
    if(!want.size) return [];
  }
  const seenTasks=new Set(), admitted=[];
  for(const element of list){
    if(!publicRunScorecardShapeOk(element)) continue;
    if(want&&!want.has(environmentIdentity(element.environment_id))) continue;
    if(seenTasks.has(element.task_id)) continue;
    seenTasks.add(element.task_id); admitted.push(element);
  }
  return admitted;
}
async function _verifyAdmittedRunScorecards(base,admitted){
  const verified=[];
  for(const element of admitted){
    if(await verifyCurrentMasterSignedDocument(base,element)) verified.push(element);
  }
  return verified;
}
async function verifyPublicRunScorecardsForEnvironment(base,list,record){
  if(record?.kind!=='env') return [];
  const envIdentity=environmentIdentity(String(record.did||record.record_id||''));
  return _verifyAdmittedRunScorecards(base,_admitRunScorecardsArray(list,envIdentity));
}
// The persona record is the last durable carrier after an operator stop:
// task records end with their runs and environment records leave the export
// once no task is live in them. The persona's memberships, when the record
// states them, bound the elements to its environments; when it states none
// the kernel signature alone binds each element.
function _personaRecordEnvironmentIdentities(record){
  const values=[record?.environment_id,record?.owning_environment_id,record?.owning_env_id,
    record?.primary_environment_id,...(Array.isArray(record?.environment_ids)?record.environment_ids:[]),
    ...(Array.isArray(record?.host_environment_ids)?record.host_environment_ids:[])];
  const known=new Set(values.map((value)=>typeof value==='string'?environmentIdentity(value):'').filter(Boolean));
  return known.size?known:null;
}
async function verifyPublicRunScorecardsForPersona(base,list,record){
  if(record?.kind!=='persona') return [];
  return _verifyAdmittedRunScorecards(base,
    _admitRunScorecardsArray(list,_personaRecordEnvironmentIdentities(record)));
}
function publicIdentityRequirementStatusShapeOk(doc,personaId){
  if(!_exactFieldSet(doc,PUBLIC_IDENTITY_REQUIREMENT_STATUS_FIELDS)) return false;
  if(doc.schema!==PUBLIC_IDENTITY_REQUIREMENT_STATUS_SCHEMA||doc.signing_key_id!=='kernel-master') return false;
  if(doc.requirement_id!=='R-ID-1'||doc.declined!==true) return false;
  if(!_boundedPublicText(doc.persona_id,200)||_shortId(doc.persona_id)!==_shortId(personaId||'')) return false;
  if(!_boundedPublicText(doc.reason,PUBLIC_IDENTITY_REQUIREMENT_REASON_MAX_CHARS)) return false;
  if(!_boundedPublicText(doc.declared_at,80)||!_boundedPublicText(doc.refusal_event_id,200)) return false;
  return /^sha256:[0-9a-f]{64}$/.test(String(doc.claim_hash||''));
}
async function verifyPublicIdentityRequirementStatus(base,doc,record,personaId){
  if(record?.kind!=='persona'||!publicIdentityRequirementStatusShapeOk(doc,personaId)) return false;
  return verifyCurrentMasterSignedDocument(base,doc);
}
const PROVIDER_INVENTORY_FIELDS=Object.freeze([
  'base','document_count','documents','expires_at','generated_at','inventory_generation',
  'inventory_hash','inventory_manifest','inventory_manifest_hash','kernel_id',
  'previous_inventory_hash','provider_count','providers','schema','signature_hex',
  'signing_key_id','version','visibility',
].sort());
const PROVIDER_MANIFEST_FIELDS=Object.freeze(['document_hash','record_id','record_url']);
const SHA256_CONTENT_RE=/^sha256:[0-9a-f]{64}$/;
const REACHABILITY_PROFILE_FIELDS=Object.freeze([
  'bootstrap_peers','libp2p_peer_id','node_id','public_key_hex','reachability_class',
  'relay_circuit_multiaddrs','relay_peers','schema','signature_hex','signing_key_id','transports',
].sort());
async function verifyCurrentReachabilityProfile(profile,base,boot){
  const registry=S.keyDocs.get(base||'@origin');
  const key=currentMasterKey(registry?.entries||[]);
  if(!_exactObjectFields(profile,REACHABILITY_PROFILE_FIELDS)
      ||profile.schema!=='reachability-profile/1'||profile.node_id!==boot?.kernel_id
      ||profile.signing_key_id!=='kernel-master'||profile.public_key_hex!==key
      ||!['public','nat_private','intranet_only'].includes(profile.reachability_class)
      ||!/^[0-9a-f]{128}$/i.test(String(profile.signature_hex||''))) return false;
  for(const field of ['transports','relay_peers','relay_circuit_multiaddrs','bootstrap_peers']){
    const values=profile[field];
    if(!Array.isArray(values)||values.length>64
        ||values.some((value)=>typeof value!=='string'||!value||value.length>2048
          ||/[\u0000-\u001f\u007f]/.test(value))) return false;
  }
  const payload={};
  for(const field of REACHABILITY_PROFILE_FIELDS)
    if(!['signature_hex','public_key_hex'].includes(field)) payload[field]=profile[field];
  try{ return await ed.verifyAsync(hexToBytes(profile.signature_hex),
    enc.encode(canon(payload)),hexToBytes(key)); }
  catch(_){ return false; }
}
async function verifiedCanonicalBaseMatch(value,base,boot){
  const requestedBase=String(base||'').replace(/\/$/,'');
  const expectedBase=String(requestedBase||location.origin).replace(/\/$/,'');
  const canonicalBase=String(value||'').replace(/\/$/,'');
  if(canonicalBase===expectedBase||(!requestedBase&&!canonicalBase)) return true;
  // A loopback probe — or a route this node itself published in its current-
  // master signed reachability profile — is an alternate delivery route, not
  // the canonical outward route written into a signed inventory.  Bind that
  // alias to the same current-master key and that signed profile before
  // accepting it.  This grants no browser write authority and never rewrites
  // the signed canonical base; it only permits hash/signature verification to
  // continue over the route that actually delivered the bytes.  A node-served
  // shell is commonly reached on its LAN/intranet address while its inventory
  // correctly names its public route; that address is attested by the same
  // kernel key as the inventory, so it is exactly as bound as loopback.
  const reachability=boot?.reachability_profile;
  if(reachability?.schema!=='reachability-profile/1'
    ||reachability?.node_id!==boot?.kernel_id
    ||reachability?.public_key_hex!==currentMasterKey(
      S.keyDocs.get(base||'@origin')?.entries||[])) return false;
  if(!await verifyCurrentReachabilityProfile(reachability,base,boot)) return false;
  const transports=Array.isArray(reachability.transports)?reachability.transports:[];
  const deliveredBase=normalizedHttpBase(expectedBase);
  const localAlias=requestedBase?isLocalBase(requestedBase):isLocalBase(location.origin);
  const attestedRoute=localAlias||(!!deliveredBase
    &&transports.some((route)=>normalizedHttpBase(route)===deliveredBase));
  if(!attestedRoute) return false;
  if(!canonicalBase) return reachability.reachability_class!=='public';
  return normalizedHttpBase(canonicalBase)===canonicalBase
    &&transports.some((route)=>normalizedHttpBase(route)===canonicalBase);
}
async function verifyProviderInventory(index,base,boot){
  const inventoryBase=String(index?.base||'').replace(/\/$/,'');
  // `base` is the current-master-signed canonical public route, while `base`
  // passed to this function is the transport route that delivered those bytes.
  // A node-served shell commonly reaches the same kernel through localhost/LAN
  // even though its atomic inventory correctly names its public HTTPS route.
  // Treat that as an alias only after the exact inventory hash + current-master
  // signature checks below. The reached provider route remains `requestedBase`;
  // this signed canonical value never rewrites transport authority.
  const baseMatches=await verifiedCanonicalBaseMatch(inventoryBase,base,boot);
  if(!_exactObjectFields(index,PROVIDER_INVENTORY_FIELDS)
      ||index.schema!=='dht-provider-index/3'||index.kernel_id!==boot?.kernel_id
      ||!baseMatches
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
  'activity','communication_routes','communication_routes_hash','current_work_state','generated_at','model_status',
  'name','node_id','persona_id','schema','signature_hex','signing_key_id','summary','tier',
].sort());
const PUBLIC_ENVIRONMENT_FEED_FIELDS=Object.freeze([
  'activity','communication_routes','communication_routes_hash','environment_id','generated_at',
  'member_count','members','model_status','node_id','schema','signature_hex','signing_key_id','status','tier',
].sort());
// /2 adds run_budgets: the node's live signed model-call balance per run
// (counts only; a run whose ledger does not verify says available:false).
const PUBLIC_ENVIRONMENT_FEED_FIELDS_V2=Object.freeze([...PUBLIC_ENVIRONMENT_FEED_FIELDS,'run_budgets'].sort());
const PUBLIC_LIVE_RUN_BUDGET_SCHEMA='personaos-live-run-budget/1';
const PUBLIC_LIVE_RUN_BUDGET_FIELDS=Object.freeze(['available','environment_id','run','schema','status_at_last_export','task_id']);
const PUBLIC_LIVE_RUN_BUDGET_OPTIONAL=Object.freeze(['budget_mode','granted','remaining','spent_net','remaining_exceeds_grant_from_topups']);
function _validPublicRunBudgets(rows,eid){
  if(!Array.isArray(rows)||rows.length>8) return false;
  for(const row of rows){
    if(!row||typeof row!=='object'||Array.isArray(row)||row.schema!==PUBLIC_LIVE_RUN_BUDGET_SCHEMA) return false;
    const keys=Object.keys(row);
    if(PUBLIC_LIVE_RUN_BUDGET_FIELDS.some((k)=>!keys.includes(k))
        ||keys.some((k)=>!PUBLIC_LIVE_RUN_BUDGET_FIELDS.includes(k)&&!PUBLIC_LIVE_RUN_BUDGET_OPTIONAL.includes(k))) return false;
    if(typeof row.available!=='boolean'||String(row.environment_id||'')!==eid
        ||!_safePublicCognitionAtom(row.run,512,{required:true})||!_safePublicCognitionAtom(row.task_id,512)
        ||typeof row.status_at_last_export!=='string'||row.status_at_last_export.length>64) return false;
    if('budget_mode' in row&&!_safePublicCognitionAtom(row.budget_mode,32)) return false;
    for(const k of ['granted','remaining','spent_net']){
      if(row.available){ if(!Number.isSafeInteger(row[k])||row[k]<0) return false; }
      else if(k in row) return false;
    }
    if('remaining_exceeds_grant_from_topups' in row&&row.remaining_exceeds_grant_from_topups!==true) return false;
  }
  return true;
}
// The newest verified balance of one environment's runs, for the cards.
function _environmentRunBudget(doc){
  const rows=Array.isArray(doc?.run_budgets)?doc.run_budgets.filter((r)=>r&&r.available===true):[];
  return rows.length?rows[rows.length-1]:null;
}
function _runBudgetLabel(budget){
  if(!budget) return '';
  const used=`${budget.spent_net} of ${budget.granted} model call${budget.granted===1?'':'s'} used`;
  return budget.remaining_exceeds_grant_from_topups?`${used} · ${budget.remaining} remaining after top-ups`:`${used} · ${budget.remaining} remaining`;
}
const PUBLIC_PROJECT_TOPOLOGY_FIELDS=Object.freeze([
  'cross_verified','environment_creation_event_id','environment_ids','hosting_link_event_id',
  'members','primary_environment_id','project_creation_event_id','project_id','schema','status',
].sort());
async function verifyPublicProjectTopology(topology,signatureHex,record,policy,keyEntry){
  if(record?.kind!=='project'
      ||!_exactObjectFields(topology,PUBLIC_PROJECT_TOPOLOGY_FIELDS)
      ||topology.schema!=='personaos-public-project-topology/1'
      ||topology.cross_verified!==true) return false;
  const projectId=String(topology.project_id||'');
  const environments=topology.environment_ids;
  const primary=String(topology.primary_environment_id||'');
  const members=topology.members;
  const eventIds=[topology.project_creation_event_id,
    topology.environment_creation_event_id,topology.hosting_link_event_id];
  if(!projectId||projectId.length>512
      ||String(policy?.subject_kind||'')!=='project'
      ||String(policy?.subject_id||'')!==projectId
      ||!Array.isArray(environments)||!environments.length||environments.length>128
      ||environments.some((value)=>typeof value!=='string'||!value||value.length>512)
      ||new Set(environments).size!==environments.length
      ||!primary||!environments.includes(primary)
      ||!members||typeof members!=='object'||Array.isArray(members)
      ||Object.keys(members).length>512
      ||Object.entries(members).some(([personaId,role])=>!personaId||personaId.length>512
        ||typeof role!=='string'||!role||role.length>500)
      ||eventIds.some((value)=>typeof value!=='string'||!value||value.length>512)
      ||typeof topology.status!=='string'||!topology.status||topology.status.length>100)
    return false;
  try{
    return await ed.verifyAsync(hexToBytes(String(signatureHex||'')),
      enc.encode(canon(topology)),hexToBytes(String(keyEntry?.public_key_hex||'')));
  }catch(_error){ return false; }
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
function _freshPublicGeneratedAt(value,now=Date.now(),maxAgeMs=30000){
  const at=Date.parse(String(value||''));
  return Number.isFinite(at)&&at>=now-maxAgeMs&&at<=now+30000;
}
// The kernel regenerates the public cognition document on publication epochs,
// not per request; between epochs it serves the cached master-signed copy. A
// 30s freshness gate silently blanked the entire brain surface whenever the
// node was mid-run, which is exactly the fail-silent observability trap.
// Verified-but-older snapshots stay renderable and carry their generated_at
// age on the face. Currency comes from the binding to the CURRENT master key
// (rotation invalidates the document); this bound only stops indefinite
// replay of a long-dead node's final snapshot.
const PUBLIC_COGNITION_MAX_AGE_MS=86400000;
function _safeEntityMap(value,prefix){
  if(!value||typeof value!=='object'||Array.isArray(value)
      ||Object.keys(value).length>NETWORK_LIMITS.cachedRecords) return false;
  return Object.entries(value).every(([id,rel])=>id&&id.length<=512
    &&String(rel)===`${prefix}/${_telemetryEntitySlug(id)}.json`);
}
function _validPublicEntityModelStatus(value,identityField,identity){
  if(!value||typeof value!=='object'||Array.isArray(value)
      ||!_exactObjectFields(value,['active_calls','recent_events'])
      ||!Array.isArray(value.active_calls)||!Array.isArray(value.recent_events)) return false;
  const belongs=(entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)
    &&String(entry[identityField]||'')===identity;
  return value.active_calls.every(belongs)&&value.recent_events.every(belongs);
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
  }else if(doc?.schema==='personaos-persona-telemetry-public/2'){
    const pid=String(doc.persona_id||'');
    const row=_currentInventoryPersona(registry.kernelId,_shortId(pid));
    const identity=signedPersonaIdentity(row);
    const workState=doc.current_work_state;
    const workStateAbsent=workState&&typeof workState==='object'
      &&!Array.isArray(workState)&&Object.keys(workState).length===0;
    if(!_exactObjectFields(doc,PUBLIC_PERSONA_FEED_FIELDS)||!pid||pid.length>512
        ||path!==`telemetry/personas/${_telemetryEntitySlug(pid)}.json`
        ||doc.tier!=='public_redacted'
        ||!doc.summary||typeof doc.summary!=='object'||Array.isArray(doc.summary)
        ||String(doc.summary.persona_id||'')!==pid
        ||String(doc.name||'')!==String(doc.summary.name||'')
        ||(!workStateAbsent&&(!identity
          ||!_validPublicPersonaWorkState(workState,identity)))
        ||!_validPublicEntityModelStatus(doc.model_status,'persona_id',pid)
        ||!Array.isArray(doc.activity)
        ||!Array.isArray(doc.communication_routes)
        ||!VERIFIED_COMMUNICATION_ROUTE_COLLECTIONS.has(doc)) return false;
  }else if(doc?.schema==='personaos-environment-telemetry-public/1'||doc?.schema==='personaos-environment-telemetry-public/2'){
    const eid=String(doc.environment_id||'');
    const feedV2=doc.schema==='personaos-environment-telemetry-public/2';
    if(!_exactObjectFields(doc,feedV2?PUBLIC_ENVIRONMENT_FEED_FIELDS_V2:PUBLIC_ENVIRONMENT_FEED_FIELDS)||!eid||eid.length>512
        ||(feedV2&&!_validPublicRunBudgets(doc.run_budgets,eid))
        ||path!==`telemetry/environments/${_telemetryEntitySlug(eid)}.json`
        ||doc.tier!=='public_redacted'||!Number.isSafeInteger(doc.member_count)
        ||doc.member_count<0||!Array.isArray(doc.members)||doc.members.length!==doc.member_count
        ||!_validPublicEntityModelStatus(doc.model_status,'environment_id',eid)
        ||!Array.isArray(doc.activity)
        ||!Array.isArray(doc.communication_routes)
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
  const participation=identityPublicKeyHex
    ?await verifyPersonaParticipationCard(
      doc.persona_card,doc.record,personaIdentity,identityPublicKeyHex):null;
  const lifecycleVerified=personaId
    ?await verifyPersonaLifecycleCard(doc.persona_lifecycle_card,doc.record,signature.entry):false;
  const lifecycleObservationState=!personaId?'refused'
    :lifecycleVerified?'verified'
      :doc.persona_lifecycle_card==null?'pending':'refused';
  const taskLifecycleVerified=r.kind==='task'
    ?await verifyPublicTaskLifecycle(doc.task_lifecycle,doc.record,signature.entry,k):false;
  const projectTopologyVerified=r.kind==='project'
    ?await verifyPublicProjectTopology(doc.project_topology,
      doc.project_topology_signature_hex,doc.record,doc.access_policy,signature.entry):false;
  // C-OP-16 siblings: each verified on its own; failure leaves it absent.
  const runScorecardVerified=r.kind==='task'&&doc.run_scorecard!=null
    ?await verifyPublicRunScorecard(base,doc.run_scorecard,r):false;
  const identityStatusVerified=!!personaId&&doc.identity_requirement_status!=null
    ?await verifyPublicIdentityRequirementStatus(base,doc.identity_requirement_status,r,personaId):false;
  const runScorecards=Array.isArray(doc.run_scorecards)
    ?(r.kind==='env'?await verifyPublicRunScorecardsForEnvironment(base,doc.run_scorecards,r)
      :r.kind==='persona'?await verifyPublicRunScorecardsForPersona(base,doc.run_scorecards,r):[])
    :[];
  return {ok:true,row:{...r,_kernel:k,_url:url,_access:projectedPolicy,_links:links,
    _base:b,_plane:plane,_effective_level:access.level,_readAuthorized:access.canRead,
    // Keep the reached provider route separate from the read-gated content
    // base. `base` is the endpoint whose bootstrap, current-master keys and
    // ProviderRecord were just verified; an empty base means this verified
    // node is the current page origin. Public discover-only projection may
    // correctly clear `_base`, but it must not clear this node API route.
    _providerBase:meta.providerBaseVerified===true?opBaseKey(base):'',
    _personaIdentityPublicKeyHex:identityPublicKeyHex,
    _personaIdentitySigningKeyId:personaId?String(doc.record.identity_signing_key_id||''):'',
    _personaParticipationVerified:!!participation,
    _personaParticipationName:participation?.name||'',
    _personaCapabilitiesSummary:participation?.capabilitiesSummary||[],
    _personaCharacteristics:participation?.characteristics||null,
    persona_card:participation?.envelope||null,
    _personaLifecycleVerified:lifecycleVerified,
    _personaLifecycleObservationState:personaId?lifecycleObservationState:'',
    persona_lifecycle_card:lifecycleVerified?doc.persona_lifecycle_card:null,
    _taskLifecycleVerified:taskLifecycleVerified,
    task_lifecycle:taskLifecycleVerified?doc.task_lifecycle:null,
    _projectTopologyVerified:projectTopologyVerified,
    _projectTopology:projectTopologyVerified?doc.project_topology:null,
    _runScorecardVerified:runScorecardVerified,
    run_scorecard:runScorecardVerified?doc.run_scorecard:null,
    _runScorecardsVerified:runScorecards.length>0,
    run_scorecards:runScorecards,
    _identityRequirementStatusVerified:identityStatusVerified,
    identity_requirement_status:identityStatusVerified?doc.identity_requirement_status:null,
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
async function verifiedRowsFromProviderIndex(providerIndex,base,boot,plane,source='http',
  {signal=null}={}){
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
      const authority=await verifyHttpProviderWithKeyRefresh(
        envelope,doc,boot,base,'',{signal});
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

const PUBLIC_IDENTITY_INDEX_FIELDS=Object.freeze([
  'base','document_count','documents','expires_at','generated_at','inventory_generation',
  'inventory_hash','inventory_manifest_hash','kernel_id','schema','signature_hex',
  'signing_key_id','visibility',
].sort());
async function verifiedRowsFromIdentityIndex(index,base,boot){
  const rows=[];
  if(!_exactObjectFields(index,PUBLIC_IDENTITY_INDEX_FIELDS))
    return {ok:false,rows,reason:'identity_index_shape_invalid'};
  if(index.schema!=='personaos-public-identity-index/1'
      ||index.kernel_id!==boot?.kernel_id||index.visibility!=='public'
      ||index.signing_key_id!=='kernel-master')
    return {ok:false,rows,reason:'identity_index_authority_invalid'};
  if(!Number.isSafeInteger(index.inventory_generation)||index.inventory_generation<1
      ||!SHA256_CONTENT_RE.test(String(index.inventory_hash||''))
      ||!SHA256_CONTENT_RE.test(String(index.inventory_manifest_hash||'')))
    return {ok:false,rows,reason:'identity_index_inventory_invalid'};
  if(!Number.isSafeInteger(index.document_count)||index.document_count<1
      ||index.document_count>512||!index.documents
      ||typeof index.documents!=='object'||Array.isArray(index.documents)
      ||Object.keys(index.documents).length!==index.document_count)
    return {ok:false,rows,reason:'identity_index_document_set_invalid'};
  if(!validateProviderInventoryWindow(index.generated_at,index.expires_at).ok)
    return {ok:false,rows,reason:'identity_index_stale'};
  if(!await verifiedCanonicalBaseMatch(index.base,base,boot))
    return {ok:false,rows,reason:'identity_index_base_mismatch'};
  if(!await verifyCurrentMasterSignedDocument(base,index))
    return {ok:false,rows,reason:'identity_index_signature_invalid'};
  const entries=Object.entries(index.documents), recordIds=new Set();
  for(const [hash,doc] of entries){
    const record=doc?.record||{},policy=doc?.access_policy||{};
    const rid=String(record.record_id||'');
    if(!SHA256_CONTENT_RE.test(hash)||!['persona','env'].includes(String(record.kind||''))
        ||!rid||recordIds.has(rid)||doc?.host_kernel_id!==boot.kernel_id
        ||doc?.kernel_id!==boot.kernel_id
        ||String(doc?.base||'').replace(/\/$/,'')!==String(index.base||'').replace(/\/$/,''))
      return {ok:false,rows,reason:'identity_document_binding_invalid'};
    recordIds.add(rid);
  }
  const registry=S.keyDocs.get(base||'@origin')||{};
  const results=await Promise.all(entries.map(async([hash,doc])=>{
    const record=doc.record,policy=doc.access_policy||{},rid=String(record.record_id||'');
    if(`sha256:${await sha256Hex(enc.encode(canon(doc)))}`!==hash)
      return {ok:false,reason:'identity_document_hash_invalid'};
    const signed=await verifyRecord(doc,registry.entries||[]);
    if(!signed.ok) return {ok:false,reason:'identity_document_signature_invalid'};
    let policyOk=false;
    try{ policyOk=await ed.verifyAsync(hexToBytes(policy.signature_hex),
      enc.encode(canon(providerPolicyPayload(policy))),
      hexToBytes(signed.entry.public_key_hex)); }catch(_){ policyOk=false; }
    const access=evaluatePublicRecordAccess(record,policy,doc.links||{});
    if(!policyOk||!access.ok||!access.canDiscover)
      return {ok:false,reason:'identity_document_access_invalid'};
    const out=await verifiedRecordFromDoc(doc,{},boot,base,'internet',
      `discovery/public/records/${rid}.json`,
      {access,providerBaseVerified:true});
    return out.ok?{ok:true,row:out.row}
      :{ok:false,reason:out.reason||'identity_document_refused'};
  }));
  const refused=results.find((result)=>!result.ok);
  if(refused) return {ok:false,rows:[],reason:refused.reason};
  return {ok:true,rows:results.map((result)=>result.row),inventory:{generation:index.inventory_generation,
    hash:index.inventory_hash,manifestHash:index.inventory_manifest_hash,
    generatedAt:Date.parse(index.generated_at),expiresAt:Date.parse(index.expires_at)}};
}

// Verify the small human-identity slice first on a warm start. This is not a
// weaker identity path: every selected ProviderRecord, embedded document,
// record, policy, lifecycle/profile card and expiry passes the normal current-
// master checks. Inventory freshness is explicitly labelled pending until the
// complete hash/signature/generation is verified immediately after the browser
// gets a paint opportunity; these rows are deliberately not recorded as an
// authoritative complete provider generation before then.
async function verifiedWarmIdentityRows(providerIndex,base,boot){
  const hydrated=hydrateProviderIndex(providerIndex);
  if(providerIndex?.kernel_id!==boot?.kernel_id
      ||!Number.isSafeInteger(providerIndex?.inventory_generation)
      ||providerIndex.inventory_generation<1
      ||!SHA256_CONTENT_RE.test(String(providerIndex?.inventory_hash||''))
      ||!hydrated.ok||hydrated.refused
      ||hydrated.envelopes.length!==Number(providerIndex?.document_count))
    return {ok:false,rows:[]};
  const byUrl=new Map();
  for(const envelope of hydrated.envelopes){
    const kind=String(envelope?.document?.record?.kind||'');
    if(!['persona','env'].includes(kind)) continue;
    const url=String(envelope?.record?.record_url||'');
    if(!/^discovery\/public\/records\/[A-Za-z0-9:_.-]+\.json$/.test(url))
      return {ok:false,rows:[]};
    if(!byUrl.has(url)) byUrl.set(url,envelope);
  }
  const results=await Promise.all([...byUrl].map(async([recordUrl,envelope])=>{
    const authority=await verifyHttpProviderWithKeyRefresh(
      envelope,envelope.document,boot,base,'');
    if(!authority.ok) return null;
    const out=await verifiedRecordFromDoc(
      envelope.document,authority.keys,boot,base,'internet',recordUrl,
      {access:authority.access,providerBaseVerified:true});
    return out.ok?out.row:null;
  }));
  if(results.some((row)=>!row)) return {ok:false,rows:[]};
  return {ok:true,rows:results,inventory:{
    generation:providerIndex.inventory_generation,hash:providerIndex.inventory_hash}};
}

// Same-origin node shells have a uniquely strong fast-start opportunity: the
// HTML request proves that this exact route is reachable, while a previously
// admitted public inventory already contains every signed document needed to
// paint personas and environments. Keep one bounded public snapshot in origin-
// scoped browser storage. On reload it is NEVER trusted as browser state: the
// current bootstrap + current self-certifying key registry are fetched first,
// then the small persona/environment slice runs through its normal signatures,
// policies, lifecycle/profile cards and expiry checks. It is visibly labelled
// as awaiting inventory freshness. The complete inventory hash/master signature
// follows after first paint, while fresh `no-store` discovery concurrently
// atomically retires/replaces it as soon as the current generation arrives.
const FAST_ORIGIN_CACHE_KEY='personaos.fast-origin-inventory.v1';
const FAST_ORIGIN_CACHE_MAX_BYTES=3*1024*1024;
const FAST_SIGNED_IDENTITY_CACHE_KEY='personaos.fast-signed-identities.v1';
const FAST_SIGNED_IDENTITY_CACHE_MAX_BYTES=2*1024*1024;
const FAST_SIGNED_IDENTITY_CACHE_MAX_SNAPSHOTS=12;
function yieldAfterVerifiedRosterPaint(){
  // scheduleRealtimeRepaint mutates the stage in a requestAnimationFrame
  // callback. A promise resolved by another callback in that same frame resumes
  // in a microtask *before* the browser paints, so starting the full inventory
  // verification there can still hide an already verified roster behind a long
  // crypto task. The second frame proves that the first frame reached a render
  // opportunity. Hidden tabs have nothing to paint and use a task boundary.
  if(typeof requestAnimationFrame!=='function'
      ||(typeof document!=='undefined'&&document.visibilityState==='hidden'))
    return new Promise((resolve)=>setTimeout(resolve,0));
  return new Promise((resolve)=>requestAnimationFrame(()=>
    requestAnimationFrame(()=>resolve())));
}
function readFastSignedIdentitySnapshots(){
  try{
    const raw=localStorage.getItem(FAST_SIGNED_IDENTITY_CACHE_KEY)||'';
    if(!raw||raw.length>FAST_SIGNED_IDENTITY_CACHE_MAX_BYTES){
      if(raw) localStorage.removeItem(FAST_SIGNED_IDENTITY_CACHE_KEY);
      return [];
    }
    const cache=JSON.parse(raw), snapshots=cache?.snapshots;
    if(cache?.schema!=='personaos-browser-signed-identity-cache/1'
        ||!Array.isArray(snapshots)){
      localStorage.removeItem(FAST_SIGNED_IDENTITY_CACHE_KEY); return [];
    }
    return snapshots.slice(0,FAST_SIGNED_IDENTITY_CACHE_MAX_SNAPSHOTS);
  }catch(_){
    try{ localStorage.removeItem(FAST_SIGNED_IDENTITY_CACHE_KEY); }catch(__){ }
    return [];
  }
}
function writeFastSignedIdentitySnapshots(snapshots){
  try{
    const bounded=(snapshots||[]).slice(0,FAST_SIGNED_IDENTITY_CACHE_MAX_SNAPSHOTS);
    while(bounded.length){
      const raw=JSON.stringify({schema:'personaos-browser-signed-identity-cache/1',
        snapshots:bounded});
      if(raw.length<=FAST_SIGNED_IDENTITY_CACHE_MAX_BYTES){
        localStorage.setItem(FAST_SIGNED_IDENTITY_CACHE_KEY,raw); return true;
      }
      bounded.pop();
    }
    localStorage.removeItem(FAST_SIGNED_IDENTITY_CACHE_KEY);
  }catch(_){ }
  return false;
}
function persistFastSignedIdentitySnapshot(base,boot,identityIndex){
  const kernel=String(boot?.kernel_id||''), registry=S.keyDocs.get(base||'@origin');
  const route=base?normalizedHttpBase(base):'';
  if(!kernel||identityIndex?.kernel_id!==kernel||(base&&!route)
      ||!Array.isArray(registry?.entries)||!currentMasterKey(registry.entries)) return false;
  const snapshot={schema:'personaos-browser-signed-identity-snapshot/1',
    kernel_id:kernel,provider_base:route,same_origin:!base,
    stored_at:new Date().toISOString(),
    boot:{kernel_id:kernel,reachability_profile:boot.reachability_profile||null},
    keys:{schema:'personaos-keys/1',kernel_id:kernel,
      keys:registry.entries.map((entry)=>({...entry}))},
    identity_index:identityIndex};
  const prior=readFastSignedIdentitySnapshots().filter((item)=>
    String(item?.kernel_id||'')!==kernel);
  return writeFastSignedIdentitySnapshots([snapshot,...prior]);
}
function persistOfflinePublicHistory(base,boot,providerIndex){
  // Retain exact signed evidence only after the complete current generation has
  // passed the normal authority path. Reads still re-run every signature, hash,
  // policy and historical lease check before projecting route-free metadata.
  const registry=S.keyDocs.get(base||'@origin');
  if(!Array.isArray(registry?.entries)||!providerIndex) return false;
  const snapshot=createOfflineHistorySnapshot({
    kernelId:boot?.kernel_id,storedAt:Date.now(),providerIndex,
    keys:{schema:'personaos-keys/1',kernel_id:boot?.kernel_id,
      keys:registry.entries.map((entry)=>({...entry}))},
  });
  return !!snapshot&&writeOfflineHistorySnapshot(snapshot);
}
function retireFastSignedIdentityRoute(kernel){
  const info=S.globalKernels?.get(kernel);
  if(info){
    info.via?.delete('cache'); info.sourceBases?.delete('cache');
    info.seenBySource?.delete('cache');
    info.bases=new Set([...(info.sourceBases?.values?.()||[])]
      .flatMap((values)=>[...values]));
    _dropKernelDirectoryEntry(kernel,{retireRecords:false});
  }
  for(const [base,health] of (S.peerHealth||new Map()))
    if(health?.warm===true&&health?.kernel===kernel) S.peerHealth.delete(base);
}
function expireFastSignedIdentityRows(kernel,rows,inventory){
  const wait=Math.max(0,Math.min(2147483000,
    Number(inventory?.expiresAt||0)-Date.now()+25));
  setTimeout(()=>{
    for(const id of rows){
      const row=S.recs.get(id);
      if(row?._warmProvisional===true
          &&row._inventoryGeneration===inventory.generation
          &&row._inventoryHash===inventory.hash) _removeRecordStoreKey(id);
    }
    S.cachedIdentityPendingKernels.delete(kernel);
    retireFastSignedIdentityRoute(kernel);
    S.fastOriginRefreshPending=S.cachedIdentityPendingKernels.size>0;
    scheduleRealtimeRepaint({records:true});
  },wait);
}
async function hydrateFastSignedIdentitySnapshots(){
  const snapshots=readFastSignedIdentitySnapshots();
  if(!snapshots.length) return false;
  let restored=0;
  for(const snapshot of snapshots){
    const kernel=String(snapshot?.kernel_id||''), boot=snapshot?.boot;
    const base=snapshot?.same_origin===true?'':normalizedHttpBase(snapshot?.provider_base);
    if(snapshot?.schema!=='personaos-browser-signed-identity-snapshot/1'
        ||typeof snapshot.same_origin!=='boolean'
        ||!kernel||boot?.kernel_id!==kernel||(!snapshot.same_origin&&!base)
        ||snapshot?.keys?.kernel_id!==kernel
        ||!Array.isArray(snapshot?.keys?.keys)||snapshot.keys.keys.length>64) continue;
    const admitted=admitKeysDocument(base,boot,snapshot.keys);
    if(!admitted['kernel-master']) continue;
    const verified=await verifiedRowsFromIdentityIndex(
      snapshot.identity_index,base,boot);
    // A no-store pass that finished while local crypto ran is always newer
    // presentation authority than this explicitly freshness-pending snapshot.
    if(!verified.ok||S.providerInventories.has(kernel)
        ||S.identityIndexes?.has(kernel)) continue;
    const rowKeys=[];
    for(const row of verified.rows){
      const projected={...row,_inventorySource:kernel,
        _inventoryGeneration:verified.inventory.generation,
        _inventoryHash:verified.inventory.hash,_warmProvisional:true};
      if(upsert(projected)) rowKeys.push(recordStoreKey(projected));
    }
    if(!rowKeys.length) continue;
    restored+=rowKeys.length;
    S.cachedIdentityPendingKernels.add(kernel);
    noteKernel(kernel,'cache',base||location.origin,{reachable:null,warm:true});
    S.peerHealth=(S.peerHealth||new Map());
    S.peerHealth.set(base||location.origin,{ok:true,records:rowKeys.length,
      kernel,t:Date.now(),warm:true});
    expireFastSignedIdentityRows(kernel,rowKeys,verified.inventory);
  }
  if(!restored) return false;
  S.fastOriginRefreshPending=true;
  scheduleRealtimeRepaint({records:true});
  log('cache',restored+' signed persona/environment identity record(s) restored; checking current sources',true);
  return true;
}
function _clearFastOriginInventory(){
  try{ localStorage.removeItem(FAST_ORIGIN_CACHE_KEY); }catch(_){ }
}
function persistFastOriginInventory(boot,providerIndex){
  if(!boot?.kernel_id||providerIndex?.kernel_id!==boot.kernel_id) return false;
  try{
    const raw=JSON.stringify({schema:'personaos-browser-fast-origin/1',
      kernel_id:boot.kernel_id,stored_at:new Date().toISOString(),provider_index:providerIndex});
    if(raw.length>FAST_ORIGIN_CACHE_MAX_BYTES){ _clearFastOriginInventory(); return false; }
    localStorage.setItem(FAST_ORIGIN_CACHE_KEY,raw); return true;
  }catch(_){ return false; }
}
function readFastOriginInventory(){
  try{
    const raw=localStorage.getItem(FAST_ORIGIN_CACHE_KEY)||'';
    if(!raw||raw.length>FAST_ORIGIN_CACHE_MAX_BYTES){
      if(raw) _clearFastOriginInventory(); return null; }
    const cached=JSON.parse(raw);
    if(cached?.schema!=='personaos-browser-fast-origin/1'
        ||!cached.kernel_id||!cached.provider_index){
      _clearFastOriginInventory(); return null; }
    return cached;
  }catch(_){ _clearFastOriginInventory(); return null; }
}
async function hydrateFastOriginInventory(){
  const cached=readFastOriginInventory();
  if(!cached) return false;
  // A static hosted portal is not a node route. Its cache namespace must never
  // cause a same-origin node probe or paint a node from unrelated portal state.
  if(location.hostname==='ai-personas.github.io') return false;
  try{
    const boot=await fetchDiscoveryBootstrap('',{
      signal:AbortSignal.timeout(3000),maxBytes:256*1024});
    if(!boot||boot.kernel_id!==cached.kernel_id){ _clearFastOriginInventory(); return false; }
    const currentKeys=await keysFor('',boot,{signal:AbortSignal.timeout(3000)});
    if(!currentKeys['kernel-master']){
      _clearFastOriginInventory(); return false; }
    const priority=await verifiedWarmIdentityRows(cached.provider_index,'',boot);
    if(!priority.ok||!priority.rows.length){
      _clearFastOriginInventory(); return false;
    }
    // A concurrently completed no-store pass is always the presentation
    // authority. Never let delayed browser-cache work overwrite any already
    // admitted complete provider generation.
    if(S.providerInventories.has(boot.kernel_id)) return false;
    const provisionalKeys=[];
    S.fastOriginRefreshPending=true;
    for(const row of priority.rows){
      const projected={...row,_inventorySource:boot.kernel_id,
        _inventoryGeneration:priority.inventory.generation,
        _inventoryHash:priority.inventory.hash,_warmProvisional:true};
      if(upsert(projected)) provisionalKeys.push(recordStoreKey(projected));
    }
    S.boots.set('@origin',boot);
    noteKernel(boot.kernel_id,'http',location.origin,{reachable:true});
    S.peerHealth=(S.peerHealth||new Map());
    S.peerHealth.set(location.origin,{ok:true,records:priority.rows.length,
      kernel:boot.kernel_id,t:Date.now(),warm:true});
    collectP2PBootstraps(boot,{dial:true});
    connectDiscoveryStream('',boot);
    scheduleRealtimeRepaint({records:true});
    loadTelemetry('',{boot}).then(()=>scheduleRealtimeRepaint()).catch(()=>{});
    log('cache',`${priority.rows.length} signed persona/environment record(s) restored; fresh discovery continues`,true);
    // Yield before the remaining artifacts/tasks/telemetry are checked so the
    // six human-facing identity cards can reach the compositor first.
    const verifyCompleteCachedInventory=async()=>{
      const verified=await verifiedRowsFromProviderIndex(
        cached.provider_index,'',boot,'internet','warm same-origin cache');
      const inventory={...(verified.inventory||{}),complete:verified.inventory?.ok===true
        &&verified.refused===0
        &&new Set(verified.rows.map((row)=>row.record_id)).size
          ===verified.inventory?.recordIds?.size};
      if(inventory.complete){
        // Fresh transport won the race while cached verification was running.
        // Keep that complete generation, irrespective of numeric ordering.
        if(S.providerInventories.has(boot.kernel_id)){
          const current=S.providerInventories.get(boot.kernel_id),
            authoritative=current?.recordKeys instanceof Set
              ?current.recordKeys:new Set(current?.recordKeys||[]);
          // The current no-store pass won while cached verification was in
          // flight. Remove only rows that are still this exact cached
          // provisional generation and that the winning manifest does not
          // contain. A fresh upsert clears _warmProvisional, so this cannot
          // erase a row that has since acquired current authority.
          for(const id of provisionalKeys){
            const row=S.recs.get(id);
            if(!authoritative.has(id)&&row?._warmProvisional===true
                &&row._inventoryGeneration===priority.inventory.generation
                &&row._inventoryHash===priority.inventory.hash)
              _removeRecordStoreKey(id);
          }
          S.fastOriginRefreshPending=false;
          scheduleRealtimeRepaint({records:true}); return;
        }
        const applied=applyVerifiedProviderInventory(
          '',boot,verified.rows,inventory,cached.provider_index);
        const current=S.providerInventories.get(boot.kernel_id);
        const superseded=current&&(current.generation>inventory.generation
          ||(current.generation===inventory.generation&&current.hash===inventory.hash));
        if(applied||superseded){ S.fastOriginRefreshPending=false;
          scheduleRealtimeRepaint({records:true}); return; }
      }
      for(const id of provisionalKeys){
        const row=S.recs.get(id);
        if(row?._warmProvisional===true
            &&row._inventoryGeneration===priority.inventory.generation
            &&row._inventoryHash===priority.inventory.hash) _removeRecordStoreKey(id);
      }
      S.fastOriginRefreshPending=false;
      _clearFastOriginInventory(); scheduleRealtimeRepaint({records:true});
    };
    yieldAfterVerifiedRosterPaint()
      .then(()=>verifyCompleteCachedInventory()).catch(()=>{});
    return true;
  }catch(_){ return false; }
}
async function verifiedRouteHintsFromP2PResult(result,{signal=null}={}){
  const routeHints=[];
  const expectedKey=String(result?.key||''), allRecords=Array.isArray(result?.records)?result.records:[],
    records=allRecords.slice(0,P2P_ROUTE_LIMITS.maxCandidatesPerResolution);
  let refused=Math.max(0,allRecords.length-records.length);
  if(result?.schema!=='personaos-browser-provider-resolution/1'||!expectedKey
      ||result.verified_count!==allRecords.length)
    return {routeHints,refused:Math.max(1,allRecords.length)};
  for(const item of records){
    if(signal?.aborted) break;
    const doc=item?.document, p=item?.record||{};
    const base=normalizedHttpsBase(p.base_url);
    if(!doc?.record||!expectedKey||!base
        ||String(p.key||'')!==expectedKey
        ||p.visibility_tier!=='public'
        ||p.signing_key_id!=='kernel-master'
        ||p.signing_key_role!=='master'||p.signing_key_status!=='current'
        ||!/^[0-9a-f]{64}$/.test(String(p.public_key_hex||''))
        ||p.host_kernel_id!==`kernel:${String(p.public_key_hex).slice(0,16)}`
        ||!String(p.provider_peer_id||'')
        ||!Array.isArray(p.host_multiaddrs)||!p.host_multiaddrs.length
        ||!p.host_multiaddrs.every((value)=>
          String(value).endsWith(`/p2p/${p.provider_peer_id}`))
        ||!Number.isSafeInteger(p.inventory_generation)||p.inventory_generation<1
        ||!/^sha256:[0-9a-f]{64}$/.test(String(p.inventory_manifest_hash||''))){
      refused++; continue;
    }
    // resolveProvider returns only envelopes that the vendored transport has
    // independently verified against this self-certifying current master and
    // exact provider peer. Preserve the peer-bound record so subsequent JSON
    // and blob reads can stay on libp2p instead of degrading to an HTTPS hint.
    routeHints.push({base,kernel:p.host_kernel_id,peerId:p.provider_peer_id,
      providerRecord:p,anchor:item});
  }
  return {routeHints,refused};
}
const DEFAULT_GLOBAL_DISCOVERY_ENDPOINT='https://node1.personas.ai';
const GLOBAL_ENVELOPE_FIELDS=Object.freeze([
  'announcement','public_key_hex','schema','signature_hex','signing_key_id',
].sort());
const GLOBAL_ANNOUNCEMENT_FIELDS=Object.freeze([
  'base_url','expires_at','generated_at','kernel_id','libp2p_multiaddrs','node_id',
  'public_bundle_hash','public_discovery','reachability_class','record_count','schema','sequence',
].sort());
function globalDiscoveryEndpoints(){
  const p=new URLSearchParams(location.search);
  if(p.get('no_global_discovery')==='1') return [];
  // The community directory and any explicit resolvers are untrusted,
  // replaceable first-contact locators. Every announcement, provider inventory,
  // record, policy, and identity is independently verified in this browser.
  // Explicit resolver routes replace the community locator. node1 is used only
  // when no other resolver was supplied, and the caller still places this
  // entire locator plane behind the direct/libp2p fallback decision.
  const explicit=p.getAll('resolver')
    .map((u)=>String(u||'').replace(/\/$/,'')).filter(Boolean);
  return [...new Set(explicit.length?explicit:[DEFAULT_GLOBAL_DISCOVERY_ENDPOINT])];
}
async function verifyGlobalEnvelope(env){
  const ann=env?.announcement;
  if(!_exactObjectFields(env,GLOBAL_ENVELOPE_FIELDS)
      ||!_exactObjectFields(ann,GLOBAL_ANNOUNCEMENT_FIELDS)
      ||env?.schema!=='personaos-node-announcement-envelope/1'
      ||ann?.schema!=='personaos-node-announcement/1') return {ok:false};
  const publicKey=String(env?.public_key_hex||'');
  const kernelId=String(ann?.kernel_id||'');
  // A resolver response is an untrusted locator, so a self-signature alone cannot assign an
  // arbitrary kernel id. Production kernel ids are self-certifying prefixes of
  // their stable kernel-master discovery key.
  if(env?.signing_key_id!=='kernel-master'||!/^[0-9a-f]{64}$/.test(publicKey)
    ||!/^[0-9a-f]{128}$/.test(String(env?.signature_hex||''))
    ||!/^kernel:[0-9a-f]{16}$/.test(kernelId)
    ||kernelId!==`kernel:${publicKey.slice(0,16)}`) return {ok:false};
  const generated=Date.parse(ann.generated_at||''), exp=Date.parse(ann.expires_at||'');
  const now=Date.now(), ttl=exp-generated;
  let parsedBase=null; try{ parsedBase=new URL(String(ann.base_url||'')); }catch(_){ }
  const multiaddrs=ann.libp2p_multiaddrs;
  if(!parsedBase||!['http:','https:'].includes(parsedBase.protocol)
      ||parsedBase.username||parsedBase.password||parsedBase.search||parsedBase.hash
      ||String(ann.base_url||'').endsWith('/')
      ||!['public','nat_private','intranet_only'].includes(ann.reachability_class)
      ||ann.public_discovery!==true||ann.public_bundle_hash!==''
      ||!Number.isSafeInteger(ann.record_count)||ann.record_count<0||ann.record_count>100000
      ||!Number.isSafeInteger(ann.sequence)||ann.sequence<0
      ||!Array.isArray(multiaddrs)||multiaddrs.length>64
      ||multiaddrs.some((value)=>typeof value!=='string'||!value.startsWith('/')
        ||value.length>2048||/[\s\u0000-\u001f\u007f]/.test(value))
      ||JSON.stringify(multiaddrs)!==JSON.stringify([...new Set(multiaddrs)].sort())
      ||!Number.isFinite(generated)||!Number.isFinite(exp)||generated>now+300000
      ||exp<=now||exp<=generated||ttl>900000||exp>now+1200000)
    return {ok:false};
  let ok=false;
  try{ ok=await ed.verifyAsync(hexToBytes(env.signature_hex),enc.encode(canon(ann)),hexToBytes(publicKey)); }catch(e){}
  if(!ok) return {ok:false};
  return {ok:true,ann};
}
let _globalLoadPromise=null;
const _globalDirectoryListeners=new Set();
function notifyIncrementalGlobalDirectory(){
  for(const listener of _globalDirectoryListeners)
    Promise.resolve().then(()=>listener()).catch(()=>{});
}
async function loadGlobalNodes({onUpdate=null}={}){
  if(typeof onUpdate==='function') _globalDirectoryListeners.add(onUpdate);
  if(_globalLoadPromise){
    try{ return await _globalLoadPromise; }
    finally{ if(typeof onUpdate==='function') _globalDirectoryListeners.delete(onUpdate); }
  }
  _globalLoadPromise=_loadGlobalNodes();
  try{ return await _globalLoadPromise; }
  finally{
    _globalLoadPromise=null;
    if(typeof onUpdate==='function') _globalDirectoryListeners.delete(onUpdate);
  }
}
async function _loadGlobalNodes(){
  const endpoints=globalDiscoveryEndpoints();
  const previousFingerprint=String(S.resolverFingerprint||'');
  const previousTotal=Number(S.globalTotal)||0;
  const firstSuccessfulSnapshot=!S.globalLastSuccessAt;
  if(!endpoints.length){
    const directory=reconcileResolverDirectory(S.resolverSnapshots,[],{nowMs:Date.now()});
    applyResolverDirectory(directory);
    return {changed:directory.fingerprint!==previousFingerprint||directory.total!==previousTotal,
      successfulResolvers:0,announcements:[],total:0,pollAfterMs:5000};
  }

  const settledResults=new Map();
  const finishResolverResult=(result)=>{
    settledResults.set(result.endpoint,result);
    // Preserve the still-live prior view for endpoints that have not settled,
    // while atomically replacing the endpoint that just completed. This lets a
    // fast explicit resolver expose signed node routes immediately instead of
    // waiting for an unrelated slow/dead locator's deadline.
    const partial=endpoints.map((endpoint)=>settledResults.get(endpoint)
      ||{endpoint,successful:false,complete:false,total:0,announcements:[]});
    const directory=reconcileResolverDirectory(
      S.resolverSnapshots,partial,{nowMs:Date.now()});
    applyResolverDirectory(directory);
    if(directory.successfulResolvers) S.globalLastSuccessAt=Date.now();
    renderGlobalKernels(); updateVitalsCounters();
    notifyIncrementalGlobalDirectory();
    return result;
  };

  // Relay/bootstrap hints and signed node pages start together. A slow
  // bootstrap response cannot delay a fresh directory snapshot.
  const bootPromise=Promise.all(endpoints.map((endpoint)=>
    fetchJson(join(endpoint,'/v1/bootstrap'),{signal:AbortSignal.timeout(3000)})
      .then((document)=>({endpoint,document}))
      .catch(()=>({endpoint,document:null}))));
  const pagesPromise=Promise.all(endpoints.map(async(endpoint)=>{
    // One dead or pathological locator must not hold the first useful paint.
    // Share one bounded deadline across the whole cursor walk rather than
    // giving every page a fresh timeout.
    const resolverSignal=AbortSignal.timeout(5000);
    const envelopes=[]; let total=0, cursor='', pages=0, successful=false;
    let complete=false, revision='', pollAfterMs=0, queryMode='recent';
    while(pages<NETWORK_LIMITS.resolverPages
        &&envelopes.length<NETWORK_LIMITS.cachedKernels){
      const params=new URLSearchParams({limit:String(NETWORK_LIMITS.resolverPage)});
      if(queryMode==='recent'){
        params.set('order','recent'); params.set('status','active');
      }else if(queryMode==='active') params.set('status','active');
      if(cursor) params.set('cursor',cursor);
      let document=await fetchJson(join(endpoint,'/v1/nodes?'+params.toString()),
        {signal:resolverSignal});
      // Fall back through the two older resolver contracts once. All three
      // return the same self-signed envelopes; only ordering/query syntax differs.
      if(!document&&!pages&&queryMode==='recent'){
        queryMode='active'; params.delete('order');
        document=await fetchJson(join(endpoint,'/v1/nodes?'+params.toString()),
          {signal:resolverSignal});
      }
      if(!document&&!pages&&queryMode==='active'){
        queryMode='legacy'; params.delete('status');
        document=await fetchJson(join(endpoint,'/v1/nodes?'+params.toString()),
          {signal:resolverSignal});
      }
      if(!document||!Array.isArray(document.nodes)) break;
      successful=true; pages+=1;
      revision=String(document.revision??document.change_id??revision);
      const hintSeconds=Number(document.refresh_after_s);
      if(Number.isFinite(hintSeconds)&&hintSeconds>=1&&hintSeconds<=30)
        pollAfterMs=pollAfterMs?Math.min(pollAfterMs,hintSeconds*1000):hintSeconds*1000;
      envelopes.push(...document.nodes.slice(
        0,NETWORK_LIMITS.cachedKernels-envelopes.length));
      total=Math.max(total,
        Number(document.total??document.total_count??document.node_count
          ??document.count??envelopes.length)||envelopes.length);
      const next=String(document.next_cursor??document.pagination?.next_cursor??'');
      if(!next||next===cursor){ complete=true; break; }
      cursor=next;
    }
    if(!successful) return finishResolverResult({endpoint,successful:false,
      complete:false,total:0,announcements:[],pages:0,revision:'',pollAfterMs:0});
    const verified=await Promise.all(envelopes.map(verifyGlobalEnvelope));
    const announcements=[]; let refused=0;
    for(const result of verified){
      if(!result.ok){ refused+=1; continue; }
      announcements.push(result.ann);
    }
    if(refused) log('global',endpoint+': '+refused
      +' announcement signature/hash failed or lease expired; refused',false);
    return finishResolverResult({endpoint,successful:true,complete,total,
      announcements,pages,revision,pollAfterMs,refused});
  }));

  const [boots,results]=await Promise.all([bootPromise,pagesPromise]);
  for(const {endpoint,document} of boots){
    if(!document) continue;
    const addrs=rememberP2PBootstraps(
      [document.libp2p_multiaddrs,document.relay_multiaddrs],{dial:true});
    if(addrs.length) log('global',endpoint+': '+addrs.length+' bootstrap multiaddr(s)');
  }

  const directory=reconcileResolverDirectory(S.resolverSnapshots,results,{nowMs:Date.now()});
  applyResolverDirectory(directory);
  if(directory.successfulResolvers) S.globalLastSuccessAt=Date.now();
  const changed=directory.fingerprint!==previousFingerprint||directory.total!==previousTotal;
  if(changed||firstSuccessfulSnapshot){
    for(const result of results.filter((item)=>item.successful))
      log('global',result.endpoint+': '+result.announcements.length+'/'+result.total
        +' signed node announcement(s) in '+result.pages+' bounded page(s)',true);
    if(S.globalPeers.size) log('resolver','verified current resolver peer(s): '
      +[...S.globalPeers].slice(0,4).join(', '),true);
  }

  // Paint the verified node set before provider inventories arrive. People and
  // workspaces follow in the change-triggered discovery pass below.
  const announced=[...S.globalAnnouncements.values()];
  renderGlobalKernels(); updateVitalsCounters();
  if(announced.length&&!S.recs.size){
    const expected=announced.reduce((count,item)=>count+(Number(item.record_count)||0),0);
    const host=$('#sysEnvs');
    if(host) host.innerHTML='<section class="discovery-progress" role="status" aria-live="polite">'
      +'<div class="discovery-orbit" aria-hidden="true"><span></span><i></i></div>'
      +'<div><span class="discovery-kicker">LIVE NODES VERIFIED</span>'
      +'<h2>'+announced.length+' node'+(announced.length===1?'':'s')+' found</h2>'
      +'<p>Fetching and checking '+compactCount(expected)+' signed public record'
      +(expected===1?'':'s')+' for people and workspaces…</p>'
      +'<div class="discovery-steps"><span class="done">01 · locate</span>'
      +'<span class="done">02 · verify nodes</span>'
      +'<span class="active">03 · show people and workspaces</span></div></div></section>';
    const status=$('#status');
    if(status) status.innerHTML='<span class="ok">'+announced.length+'</span> live node'
      +(announced.length===1?'':'s')+' verified · loading people and workspaces…';
  }else if(changed&&!announced.length&&!S.recs.size) refreshSystemView();
  const pollAfterMs=results.map((result)=>Number(result.pollAfterMs)||0)
    .filter(Boolean).reduce((minimum,value)=>Math.min(minimum,value),Infinity);
  return {changed,successfulResolvers:directory.successfulResolvers,
    announcements:announced,total:directory.total,
    pollAfterMs:Number.isFinite(pollAfterMs)?pollAfterMs:0};
}
async function admitVerifiedIdentityIndex(identityDoc,base,boot,where,{transport='http'}={}){
  const identity=await verifiedRowsFromIdentityIndex(identityDoc,base,boot);
  if(!identity.ok){
    log('identity',`${boot?.kernel_id||where}: compact signed identity refused · ${identity.reason||'invalid'}`,false);
    return false;
  }
  // Cache only after the complete compact document, every embedded record,
  // policy and persona proof has verified. Do this before mutable presentation
  // bookkeeping so a rendering/transport-state fault cannot lose the next
  // reload's already verified fast path.
  persistFastSignedIdentitySnapshot(base,boot,identityDoc);
  const prior=(S.identityIndexes||(S.identityIndexes=new Map())).get(boot.kernel_id);
  const advances=!prior||identity.inventory?.generation>prior.generation
    ||(identity.inventory?.generation===prior.generation
      &&identity.inventory?.hash===prior.hash);
  // A complete inventory may already be authoritative when this compact slice
  // arrives on a periodic P2P refresh. It is still worth retaining the exact
  // signed slice for the next browser start; persistence grants no live-state
  // authority and hydration re-runs every signature, policy and expiry check.
  if(!advances) return false;
  if(S.providerInventories.has(boot.kernel_id)) return false;
  const incoming=new Set();
  for(const row of identity.rows){
    const projected={...row,_inventorySource:boot.kernel_id,
      _inventoryGeneration:identity.inventory.generation,
      _inventoryHash:identity.inventory.hash,_identityIndexVerified:true};
    if(upsert(projected)) incoming.add(recordStoreKey(projected));
  }
  for(const id of (prior?.recordKeys||[])){
    const row=S.recs.get(id);
    if(!incoming.has(id)&&row?._identityIndexVerified===true) _removeRecordStoreKey(id);
  }
  // A freshly fetched compact index is the signed authority for this
  // generation's complete persona/environment slice. Retire an omitted cached
  // identity even if the larger artifact inventory later fails to transfer.
  for(const [id,row] of [...S.recs]){
    if(!incoming.has(id)&&String(row?._kernel||'')===boot.kernel_id
        &&['persona','env'].includes(String(row?.kind||''))
        &&(row?._warmProvisional===true||row?._identityIndexVerified===true))
      _removeRecordStoreKey(id);
  }
  S.identityIndexes.set(boot.kernel_id,{...identity.inventory,recordKeys:incoming});
  S.cachedIdentityPendingKernels.delete(boot.kernel_id);
  S.fastOriginRefreshPending=S.cachedIdentityPendingKernels.size>0;
  S.boots.set(base||'@origin',boot);
  noteKernel(boot.kernel_id,transport,base||location.origin,{reachable:true});
  retireFastSignedIdentityRoute(boot.kernel_id);
  S.peerHealth.set(where,{ok:true,records:identity.rows.length,
    kernel:boot.kernel_id,t:Date.now(),identityIndex:true});
  collectP2PBootstraps(boot,{dial:true});
  scheduleRealtimeRepaint({records:true});
  const personaKeys=identity.rows.filter((row)=>row?.kind==='persona')
    .map((row)=>_personaKey(boot.kernel_id,_shortId(row.did||row.record_id)))
    .filter((key)=>!!providerVerifiedPersonaObservation(key));
  const personaFeeds=identity.rows.filter((row)=>row?.kind==='persona'
      &&typeof row?._links?.telemetry==='string')
    .map(async(row)=>_ingestVerifiedPersonaEntityFeed(
      base,await fetchEntityFeed(base,row._links.telemetry)));
  if(personaFeeds.length){
    Promise.all(personaFeeds).then((keys)=>{
      const hydrated=keys.filter(Boolean);
      if(hydrated.length) scheduleRealtimeRepaint();
      if(personaKeys.length) scheduleSseCognitionRefresh({base:base||'',personaKeys});
    }).catch(()=>{
      if(personaKeys.length) scheduleSseCognitionRefresh({base:base||'',personaKeys});
    });
  }else if(personaKeys.length)
    scheduleSseCognitionRefresh({base:base||'',personaKeys});
  log('identity',`${identity.rows.length} current signed persona/environment record(s) verified first`,true);
  // Let the roster reach the compositor before full inventory verification.
  await yieldAfterVerifiedRosterPaint();
  return true;
}
async function discoverFrom(base,plane,knownBoot=null,
  {expectedKernel='',resolveProviderAliases=true,signal=null}={}){
  const where=base||location.origin;
  log('bootstrap',`${where}/.well-known/personaos-discovery.json`);
  const boot=knownBoot||await fetchDiscoveryBootstrap(base,{signal});
  S.peerHealth=(S.peerHealth||new Map());
  if(!boot){ log('bootstrap',`no endpoint at ${where}`,false);
    const gb=S.globalAnnouncementByBase?.get(opBaseKey(where))||S.globalAnnouncementByBase?.get(String(where||'').replace(/\/$/,''));
    if(gb?.kernel_id) noteKernel(gb.kernel_id,'unreachable',where,{reachable:false});
    S.peerHealth.set(where,{ok:false,records:0,t:Date.now()}); return {boot:null,found:[]}; }
  if(expectedKernel&&boot.kernel_id!==expectedKernel){
    log('bootstrap',`${where}: route hint resolved to a different kernel`,false);
    S.peerHealth.set(where,{ok:false,records:0,t:Date.now()}); return {boot:null,found:[]};
  }
  const keys=await keysFor(base,boot,{signal});
  if(signal?.aborted) return {boot:null,found:[]};
  if(!keys['kernel-master']){
    log('keys',`${boot.kernel_id||where}: no valid current master`,false);
    S.peerHealth.set(where,{ok:false,records:0,t:Date.now()});
    return {boot:null,found:[]};
  }
  // This independently signed, bounded directory is intentionally fetched
  // before the full provider inventory. Open questions can therefore paint as
  // soon as current node keys are verified, without waiting for artifacts.
  refreshOpenInputDirectory(base,boot,{signal}).catch(()=>{});
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
  // Transfer the full atomic inventory and compact signed human roster in
  // parallel. The roster normally carries only persona/environment documents,
  // so a cold viewer can verify people and workspaces without waiting for every
  // artifact/task/telemetry byte in the generation.
  const providerUrl=join(base,boot.providers_url||'discovery/providers.json');
  const providerPromise=sharedDocumentJson(providerUrl,
    ()=>fetchJson(providerUrl,{maxBytes:providerIndexMaxBytes,signal}));
  let identityAccepted=false;
  if(boot.identity_index_url){
    const identityDoc=await fetchJson(join(base,boot.identity_index_url),{
      maxBytes:2*1024*1024,signal});
    identityAccepted=await admitVerifiedIdentityIndex(identityDoc,base,boot,where);
  }
  const prov=await providerPromise;
  if(!prov||Number(prov.document_count)!==advertisedRecordCount){
    log('dht',`${boot.kernel_id||where}: provider document count does not match advertised bootstrap`,false);
    if(!identityAccepted) S.peerHealth.set(where,{ok:false,records:0,t:Date.now()});
    return {boot,found:[]};
  }
  const providers=Array.isArray(prov?.providers)?prov.providers:[];
  log('dht',`${boot.kernel_id||where}: ${providers.length} provider key(s)${boot.providers_are_aggregate?' · public aggregate':''}`);
  const http=await verifiedRowsFromProviderIndex(
    prov,base,boot,plane,'http provider',{signal});
  const found=[...http.rows];
  const uniqueFound=new Map(found.map((row)=>[
    `${row._kernel||boot.kernel_id||'@unknown'}\u0000${row.record_id||row.did}`,row]));
  found.length=0; found.push(...uniqueFound.values());
  if(found.length) log('verify',`${found.length}/${http.envelopeCount} record(s) provider + record + policy verified`,true);
  const inventory={...(http.inventory||{}),complete:http.inventory?.ok===true
    &&http.refused===0&&new Set(found.map((row)=>row.record_id)).size===http.inventory.recordIds?.size};
  if(!inventory.complete){
    if(!identityAccepted) S.peerHealth.set(where,{ok:false,records:0,t:Date.now()});
    return {boot,found,inventory};
  }
  // Provider lookups and gossip caches are secondary routing hints; none can
  // alter these already verified rows. Run them after returning the complete
  // inventory so a disconnected relay or stale bridge never blocks first paint.
  setTimeout(async()=>{
    const hintSignal=AbortSignal.timeout(10000);
    try{
      if(resolveProviderAliases&&P2P?.resolveProvider){
        const aliases=[...new Set(providers.map((p)=>String(p?.record?.key||''))
          .filter(Boolean))].slice(0,16);
        const resolved=await Promise.all(aliases.map((key)=>
          P2P.resolveProvider(key,{timeoutMs:5000}).catch(()=>null)));
        let authorityVerified=0;
        for(const result of resolved){
          const verified=await verifiedRouteHintsFromP2PResult(result,{signal:hintSignal});
          authorityVerified+=verified.routeHints.length;
        }
        if(aliases.length) log('p2p',`${authorityVerified}/${aliases.length} per-key provider lookup proof(s) verified · inventory promotion required`,authorityVerified>0);
      }
      const p2pReceived=boot.p2p_received_url||boot.discovery_p2p_received_url;
      const [p2pDoc,gossip]=await Promise.all([
        p2pReceived?fetchJson(join(base,p2pReceived),{signal:hintSignal}):null,
        fetchJson(join(base,'gossip/cache'),{signal:hintSignal}),
      ]);
      for(const doc of (p2pDoc?.records||[]).slice(0,NETWORK_LIMITS.cachedRecords)){
        if(doc?.record?.visibility_tier!=='public') continue;
        const verified=P2P?.verifyGossipProviderEnvelope
          ?await P2P.verifyGossipProviderEnvelope(doc).catch(()=>null):null;
        if(verified) await onVerifiedGossipProvider(verified);
        else queueProviderHints(doc.record,'bridge-cache gossip');
      }
      for(const id in (gossip?.cards||gossip||{})){
        const card=(gossip.cards||gossip)[id]; if(!card||typeof card!=='object') continue;
        const record=card.record||card;
        if(record?.visibility_tier==='public') queueProviderHints(record,'HTTP gossip cache');
      }
    }catch(_){ }
  },0);
  return {boot,found,inventory,providerIndex:prov};
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
  const cur=g.get(kernelId)||{via:new Set(),bases:new Set(),sourceBases:new Map(),
    seenBySource:new Map(),lastSeen:0,meta:{}};
  cur.sourceBases=cur.sourceBases instanceof Map?cur.sourceBases:new Map();
  cur.seenBySource=cur.seenBySource instanceof Map?cur.seenBySource:new Map();
  cur.via.add(via); cur.seenBySource.set(via,Date.now());
  if(base){
    if(!cur.sourceBases.has(via)) cur.sourceBases.set(via,new Set());
    cur.sourceBases.get(via).add(base);
  }
  cur.bases=new Set([...cur.sourceBases.values()].flatMap((values)=>[...values]));
  cur.lastSeen=Date.now();
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
function _dropKernelDirectoryEntry(kernelId,{retireRecords=false}={}){
  const info=S.globalKernels?.get(kernelId);
  if(info?.via?.size) return false;
  S.globalKernels?.delete(kernelId); S.kernels?.delete(kernelId);
  if(S.kernelFocus===kernelId) S.kernelFocus=null;
  try{ NETWORK.removeEntity(networkEntityKey(kernelId,'kernel',kernelId)); }catch(_){ }
  if(retireRecords) retireProviderInventory(kernelId,'node announcement lease ended');
  return true;
}
function applyResolverDirectory(directory){
  const affected=[];
  for(const [kernelId,info] of (S.globalKernels||new Map())){
    if(!info?.via?.has('resolver')) continue;
    affected.push(kernelId);
    info.via.delete('resolver'); info.via.delete('unreachable');
    info.sourceBases?.delete('resolver'); info.sourceBases?.delete('unreachable');
    info.seenBySource?.delete('resolver'); info.seenBySource?.delete('unreachable');
    info.bases=new Set([...(info.sourceBases?.values?.()||[])]
      .flatMap((values)=>[...values]));
  }
  S.resolverSnapshots=directory.snapshots;
  S.globalAnnouncements=directory.announcements;
  S.globalAnnouncementByBase=directory.announcementByBase;
  S.globalPeers=directory.peers;
  S.globalTotal=directory.total;
  S.resolverFingerprint=directory.fingerprint;
  for(const [kernelId,announcement] of directory.announcements){
    const base=String(announcement.base_url||'').replace(/\/$/,'');
    noteKernel(kernelId,'resolver',base||announcement.source_endpoint,{
      announced:true,
      recordCount:Number(announcement.record_count)||0,
      reachability:String(announcement.reachability_class||''),
      publicDiscovery:!!announcement.public_discovery,
      announcementExpiresAt:Date.parse(String(announcement.expires_at||''))||0,
    });
    rememberP2PBootstraps([announcement.libp2p_multiaddrs],{dial:true});
  }
  for(const kernelId of affected) _dropKernelDirectoryEntry(kernelId,{retireRecords:true});
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
function _kernelDisplayContext(kernelId){
  const activeTasks=new Set(), tasks=new Set(), environmentIds=new Set();
  const environmentNames=new Set();
  for(const id of (S.order||[])){
    const record=S.recs.get(id);
    if(record?._kernel!==kernelId) continue;
    const lifecycle=publicTaskLifecycleProjection(record);
    if(lifecycle){
      tasks.add(lifecycle.task);
      if(lifecycle.liveTask) activeTasks.add(lifecycle.task);
    }
    if(record.kind==='env'){
      const sid=_envSid(record), label=String(record.label||'').trim();
      if(sid) environmentIds.add(sid);
      if(!_isMechanicalEnvironmentName(label,sid)) environmentNames.add(label);
    }
  }
  const taskSet=activeTasks.size?activeTasks:tasks;
  let label='', source='';
  if(taskSet.size===1){
    label=taskSet.values().next().value;
    source=activeTasks.size?'signed current task':'signed task';
  }else if(activeTasks.size>1){
    label=`${activeTasks.size} active tasks`;
    source='signed current tasks';
  }else if(environmentIds.size===1&&environmentNames.size===1){
    label=environmentNames.values().next().value;
    source='signed workspace';
  }else if(environmentIds.size===1){
    label='Shared workspace';
    source='signed workspace';
  }else if(environmentIds.size>1){
    label=`${environmentIds.size} workspaces`;
    source='signed workspaces';
  }else if(tasks.size>1){
    label=`${tasks.size} tasks`;
    source='signed tasks';
  }
  if(!label) return {label:'Public node',detail:'public node'};
  const chars=[...String(label)];
  return {
    label:chars.length>52?chars.slice(0,51).join('')+'…':chars.join(''),
    detail:`${source}: ${label}`,
  };
}
function renderGlobalKernels(){
  const el=$('#globalKernels'); if(!el) return;
  const g=S.globalKernels||new Map();
  const allBtn=$('#networkAll'); if(allBtn){ allBtn.classList.toggle('on',!S.kernelFocus); allBtn.setAttribute('aria-pressed',String(!S.kernelFocus)); }
  const scope=$('#networkScope'), overflow=$('#networkOverflow');
  const knownTotal=Math.max(g.size,Number(S.globalTotal)||0,S.kernels?.size||0);
  if(!g.size){
    el.innerHTML='<span class="loading-inline"><span class="dot"></span><span class="dim">no kernels discovered yet</span></span>';
    if(scope) scope.textContent='0 nodes · awaiting signed peer announcements';
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
    const context=_kernelDisplayContext(kid);
    const title=`${context.detail} · ${[...info.bases].join(' ')} · via ${[...info.via].join(', ')||'unknown'}`
      +((info.meta?.recordCount||info.meta?.reachability)?` · records=${info.meta.recordCount||0} · reachability=${info.meta.reachability||''}`:'');
    const liveRoute=active>0||(reachable&&fresh);
    return `<button type="button" class="gk ${liveRoute?'ok':'dim'}${kid===S.kernelFocus?' on':''}" data-kernel="${esc(kid)}"`
      +` aria-pressed="${kid===S.kernelFocus?'true':'false'}" title="${esc(title)}">`
      +`<span class="dot ${liveRoute?'live':''}"></span>${esc(context.label)}`
      +(active?` <span class="n k">${active} RUNNING</span>`:via)+`</button>`;
  }).join('');
  if(scope) scope.textContent=S.kernelFocus
    ?`focused node · ${compactCount(Number(g.get(S.kernelFocus)?.meta?.recordCount)||0)} public records`
    :`${compactCount(knownTotal)} discovered · ${visible.length} activity-prioritized`;
  const omitted=Math.max(0,knownTotal-visible.length);
  if(overflow){ overflow.hidden=omitted===0; overflow.textContent=omitted?`+${compactCount(omitted)} aggregated · search or select a node`:''; }
}
// A bare hosted URL joins the shared public Kademlia plane through the shipped,
// replaceable bootstrap commons. Same-origin/local, explicit resolver, gossip,
// and content-addressed P2P routes are additive evidence; viewers never need to
// carry a node URL in the public URL.
function peerList(){
  const focused=S.kernelFocus?[...(S.globalKernels?.get(S.kernelFocus)?.bases||[])]:[];
  const recentGossip=[...(S.gossipPeers||[])].reverse();
  // Explicit and local routes outrank opportunistic/global ones; a focused node
  // is pinned to the front. Verified P2P routes are stored as an LRU Set, so
  // reverse them here to keep the newest live route in the monitoring window.
  // This is the active monitoring window, not a claim that the rest of the
  // discovered population ceased to exist.
  const all=[...new Set([...focused,...(S.localPeers||[]),...(S.portalPeers||[]),
    ...recentGossip,...(S.ipfsPeers||[]),...(S.globalPeers||[])].filter(Boolean))];
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
// node then appears in the PUBLIC DATA drawer as a local read route. The browser
// never treats network position as a credential or retains owner authority.
// Silent when nothing's running. From an https page: https://localhost works if the
// node's cert is trusted; plain-http localhost is browser-policy dependent and
// may fail before CORS, so the empty state explains the public P2P route.
const LOCAL_PORTS=[8765,8766,8805,8910];
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
    if(opBaseKey(base)===opBaseKey(location.origin)) return;
    if(await probeBase(base)) found.add(base);
  })));
  const before=[...S.localPeers].sort().join('|'), after=[...found].sort().join('|');
  S.localPeers=found;                      // rebuild each cycle: a stopped local node drops off
  if(after!==before){
    if(found.size) log('local',`PersonaOS node on THIS machine: ${[...found].join(', ')} — open its control console; access follows that node's policy`,true);
    if(!rediscover) return found;
    discover().then(()=>{ renderMissions(); }).catch(()=>{});
  }
  return found;
}

function recordStoreKey(r){ const raw=r?.record_id||r?.card_id; if(!raw) return '';
  return `${encodeURIComponent(String(r?._kernel||'@unknown'))}::${encodeURIComponent(String(raw))}`; }
// Node API requests (status, public cognition, telemetry and live workspaces)
// may use only the provider route admitted by current-master verification.
// `_base` is a different surface: it is intentionally blank for discover-only
// records and otherwise names the read-authorized content host.
function nodeBaseForRecord(r){ return String(r?._providerBase||'').replace(/\/$/,''); }
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
      &&String(before.lifecycle_transition_hash||'')!==String(after.lifecycle_transition_hash||'')) return true;
  return false;
}
function _removeRecordStoreKey(id){
  const row=S.recs.get(id); if(!row) return false;
  if(row.kind==='persona'){
    const sid=_shortId(row.did||row.record_id), key=_personaKey(row._kernel,sid);
    if(S.personaDiscoveryByKey.get(key)===row) S.personaDiscoveryByKey.delete(key);
    S.liveByPersona.delete(key); S.personaRuntimeById?.delete(key);
    S.cognitionByPersona?.delete(key); S.ixByPersona?.delete(key);
    S.verifiedPublicCognitionByPersona?.delete(key);
    S.publicCognitionFetchAfter?.delete(key);
    if(S.follow===key) S.follow=null;
  }
  try{ NETWORK.removeEntity(networkEntityKey(row._kernel,row.kind,
    _shortId(row.did||row.record_id))); }catch(_){ }
  S.recs.delete(id); S.order=S.order.filter((value)=>value!==id); return true;
}
function _providerInventoryIsCurrent(inventory,now=Date.now()){
  const generatedAt=Number(inventory?.generatedAt), expiresAt=Number(inventory?.expiresAt);
  return Number.isFinite(generatedAt)&&Number.isFinite(expiresAt)
    &&expiresAt>generatedAt&&expiresAt>now;
}
function retireProviderInventory(kernelId,reason='provider lease expired'){
  const source=String(kernelId||''), inventory=S.providerInventories.get(source);
  if(!inventory) return false;
  let removed=0, kernelChanged=false;
  for(const id of (inventory.recordKeys||[])) if(_removeRecordStoreKey(id)) removed++;
  S.providerInventories.delete(source);
  for(const [base,boot] of (S.boots||new Map())){
    if(String(boot?.kernel_id||'')!==source) continue;
    S.boots.delete(base); S.peerHealth?.delete(base);
  }
  for(const [base,route] of (S.p2pDataRoutes||new Map())){
    if(String(route?.kernel||'')!==source) continue;
    S.p2pDataRoutes.delete(base);
    const stream=S.streams.get(`p2p:${base}`);
    try{ stream?.close?.(); }catch(_){ }
    S.streams.delete(`p2p:${base}`);
  }
  const kernelInfo=S.globalKernels?.get(source);
  if(kernelInfo){
    kernelChanged=true;
    for(const via of ['http','p2p','gossip','ipfs','local']){
      kernelInfo.via?.delete(via);
      kernelInfo.sourceBases?.delete(via);
      kernelInfo.seenBySource?.delete(via);
    }
    kernelInfo.bases=new Set([...(kernelInfo.sourceBases?.values?.()||[])]
      .flatMap((values)=>[...values]));
    kernelChanged=_dropKernelDirectoryEntry(source,{retireRecords:false})||kernelChanged;
  }
  if(removed) log('discovery',_kernelDisplayContext(source).label+': removed '+removed
    +' expired public record'+(removed===1?'':'s')+' · '+reason);
  return removed>0||kernelChanged;
}
function _expireProviderInventories(now=Date.now()){
  let changed=false;
  for(const kernel of expiredProviderKernels(S.providerInventories,now))
    changed=retireProviderInventory(kernel)||changed;
  for(const [kernel,inventory] of (S.identityIndexes||new Map())){
    if(_providerInventoryIsCurrent(inventory,now)) continue;
    for(const id of (inventory?.recordKeys||[])){
      const row=S.recs.get(id);
      if(row?._identityIndexVerified===true&&row._inventorySource===kernel
          &&row._inventoryGeneration===inventory.generation
          &&row._inventoryHash===inventory.hash)
        changed=_removeRecordStoreKey(id)||changed;
    }
    S.identityIndexes.delete(kernel);
  }
  if(changed){
    classifyMap();
    scheduleRealtimeRepaint({records:true});
  }
  return changed;
}
function pruneExpiredDiscoveryState(now=Date.now()){
  let changed=false;
  const priorFingerprint=String(S.resolverFingerprint||'');
  const resolverFailures=[...(S.resolverSnapshots||new Map()).keys()]
    .map((endpoint)=>({endpoint,successful:false}));
  const directory=reconcileResolverDirectory(
    S.resolverSnapshots,resolverFailures,{nowMs:now});
  if(directory.fingerprint!==priorFingerprint
      ||directory.total!==(Number(S.globalTotal)||0)){
    applyResolverDirectory(directory); changed=true;
  }
  changed=_expireProviderInventories(now)||changed;
  if(changed){
    classifyMap(); renderGlobalKernels(); updateVitalsCounters();
    refreshSystemView(); renderMissions(); refreshLiveSection();
  }
  return changed;
}
function applyVerifiedProviderInventory(base,boot,rows,inventory,providerIndex=null){
  if(!inventory?.complete||!inventory.ok||!boot?.kernel_id
    ||!_providerInventoryIsCurrent(inventory)) return false;
  const source=String(boot.kernel_id), prior=S.providerInventories.get(source);
  if(prior){
    if(inventory.generation<prior.generation
        ||(inventory.generation===prior.generation&&inventory.hash!==prior.hash)){
      log('verify',`${source}: stale/equivocating provider inventory generation refused`,false); return false;
    }
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
  // Re-apply an identical, freshly verified generation as well as a newer one.
  // This heals bounded-cache eviction without weakening atomic retirement: the
  // exact inventory hash was checked above and every incoming row must still
  // exhaust the signed manifest before any stale key is removed.
  for(const row of rows) upsert({...row,_inventorySource:source,
    _inventoryGeneration:inventory.generation,_inventoryHash:inventory.hash});
  for(const id of (prior?.recordKeys||[])) if(!incoming.has(id)) _removeRecordStoreKey(id);
  // A compact identity index or warm browser snapshot can be admitted before a
  // complete provider inventory exists, so there may be no prior inventory
  // whose recordKeys enumerate those early rows. The full signed manifest is
  // authoritative: retire every same-kernel early-projection row it omits.
  // Incoming rows were just upserted and therefore had both provisional flags
  // cleared; the flag guard also protects any independently current row.
  for(const [id,row] of [...S.recs]){
    if(!incoming.has(id)&&String(row?._kernel||'')===source
        &&(row?._warmProvisional===true||row?._identityIndexVerified===true))
      _removeRecordStoreKey(id);
  }
  S.providerInventories.set(source,{generation:inventory.generation,hash:inventory.hash,
    recordKeys:incoming,manifestHash:inventory.manifestHash,
    bindings:new Map(inventory.bindings||[]),base:base||'',
    generatedAt:inventory.generatedAt,expiresAt:inventory.expiresAt});
  persistOfflinePublicHistory(base,boot,providerIndex);
  S.cachedIdentityPendingKernels.delete(source);
  retireFastSignedIdentityRoute(source);
  S.fastOriginRefreshPending=S.cachedIdentityPendingKernels.size>0;
  // Inventory admission can complete after the enclosing HTTP discovery pass
  // (notably through a verified libp2p route). Coalesce the record/header repaint
  // from this single authority gate so the summary cannot remain on an earlier
  // zero-record snapshot while admitted records are already rendered elsewhere.
  scheduleRealtimeRepaint({records:true});
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
    _providerBase:r._providerBase||row._providerBase||'',
    _inventorySource:r._inventorySource||row._inventorySource||'',
    _inventoryGeneration:r._inventoryGeneration||row._inventoryGeneration||0,
    _inventoryHash:r._inventoryHash||row._inventoryHash||'',
    _warmProvisional:r._warmProvisional===true,
    _identityIndexVerified:r._identityIndexVerified===true,
    _broadcastOnly:!!r._broadcastOnly,_effective_level:r._effective_level||'discover',
    _readAuthorized:!!r._readAuthorized,_gossipHint:r._gossipHint||null,
    description:r.description||'',
    _storeKey:id,record_id:r.record_id||r.card_id,
    capability_summary:r.capability_summary||[],interfaces:r.interfaces||[],content_hash:r.content_hash||'',content_locator_ref:r.content_locator_ref||'',
    // This is a signed artifact-record fact. Preserve the exact boolean so the
    // UI can distinguish a currently published workspace file without guessing
    // from its path, media type, label, task, or bundle description.
    in_progress:r.kind==='artifact'&&r.in_progress===true,
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
    _personaSignedName:r.kind==='persona'?String(r.label||''):'',
    _personaIdentityPublicKeyHex:r.kind==='persona'?(r._personaIdentityPublicKeyHex||''):'',
    _personaIdentitySigningKeyId:r.kind==='persona'?(r._personaIdentitySigningKeyId||''):'',
    _personaParticipationVerified:r.kind==='persona'&&r._personaParticipationVerified===true,
    _personaParticipationName:r.kind==='persona'&&r._personaParticipationVerified===true
      ?String(r._personaParticipationName||''):'',
    _personaCapabilitiesSummary:r.kind==='persona'&&r._personaParticipationVerified===true
      &&Array.isArray(r._personaCapabilitiesSummary)
      ?r._personaCapabilitiesSummary.slice(0,64):[],
    _personaCharacteristics:r.kind==='persona'&&r._personaParticipationVerified===true
      &&r._personaCharacteristics?{...r._personaCharacteristics}:null,
    persona_card:r.kind==='persona'&&r._personaParticipationVerified===true&&r.persona_card
      ?r.persona_card:null,
    _personaLifecycleVerified:r.kind==='persona'&&r._personaLifecycleVerified===true,
    _personaLifecycleObservationState:r.kind==='persona'
      ?String(r._personaLifecycleObservationState||'refused'):'',
    persona_lifecycle_card:r.kind==='persona'&&r.persona_lifecycle_card
      ?r.persona_lifecycle_card:null,
    _taskLifecycleVerified:r.kind==='task'&&r._taskLifecycleVerified===true,
    task_lifecycle:r.kind==='task'&&r.task_lifecycle?r.task_lifecycle:null,
    // C-OP-16: kernel-signed member-view siblings and the signed
    // persona↔artifact↔run attribution ride the stored row only when verified.
    _runScorecardVerified:r.kind==='task'&&r._runScorecardVerified===true,
    run_scorecard:r.kind==='task'&&r._runScorecardVerified===true&&r.run_scorecard?r.run_scorecard:null,
    _runScorecardsVerified:(r.kind==='env'||r.kind==='persona')&&r._runScorecardsVerified===true,
    run_scorecards:(r.kind==='env'||r.kind==='persona')&&r._runScorecardsVerified===true
      &&Array.isArray(r.run_scorecards)?r.run_scorecards.slice(0,PUBLIC_RUN_SCORECARDS_MAX):[],
    _identityRequirementStatusVerified:r.kind==='persona'&&r._identityRequirementStatusVerified===true,
    identity_requirement_status:r.kind==='persona'&&r._identityRequirementStatusVerified===true
      &&r.identity_requirement_status?r.identity_requirement_status:null,
    declaring_persona_id:r.kind==='artifact'&&typeof r.declaring_persona_id==='string'
      ?r.declaring_persona_id.slice(0,200):'',
    run_id:r.kind==='artifact'&&typeof r.run_id==='string'?r.run_id.slice(0,200):'',
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
    const job=fetchDiscoveryBootstrap(b,{
      signal:AbortSignal.timeout(8000)}).then((boot)=>{
      if(!boot){
        if(b){ log('bootstrap',`no endpoint at ${b}`,false);
          S.peerHealth=(S.peerHealth||new Map());
          S.peerHealth.set(b,{ok:false,records:0,t:Date.now()}); }
        return;
      }
      // Bootstrap fields are bounded locator input here. Identity is admitted
      // only after discoverFrom verifies the current master and a complete
      // signed provider inventory, so this lookup cannot paint a node chip.
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
    }).catch(()=>{
      if(b){ log('bootstrap',`malformed endpoint at ${b}`,false);
        S.peerHealth=(S.peerHealth||new Map());
        S.peerHealth.set(b,{ok:false,records:0,t:Date.now()}); }
    }).finally(()=>pending.delete(job));
    pending.add(job);
  };
  for(const item of queue) schedule(item);
  while(pending.size) await Promise.allSettled([...pending]);
  const unique=[...kernels.values()].map((item)=>item.base);
  S.monitoringOmitted=(S.monitoringOmitted||0)+Math.max(0,unique.length-NETWORK_LIMITS.monitoredBases);
  return unique.slice(0,NETWORK_LIMITS.monitoredBases);
}
let _discoverBusy=false, _discoverQueued=false;
function updateDiscoverySummary(when=new Date()){
  const status=$('#status'); if(!status) return;
  // Count only browser-admitted state. Resolver-advertised totals are useful
  // network-scale hints, but they are not verified record inventories and must
  // not be presented as this tab's verified node count.
  const admittedKernels=new Set(S.kernels||[]);
  for(const kernel of (S.providerInventories||new Map()).keys()) if(kernel) admittedKernels.add(kernel);
  for(const record of (S.recs||new Map()).values()) if(record?._kernel) admittedKernels.add(record._kernel);
  const recordCount=S.recs?.size||0, kernelCount=admittedKernels.size;
  const monitored=(S.boots&&S.boots.size)||0;
  const refreshed=`${String(when.getUTCHours()).padStart(2,'0')}:${String(when.getUTCMinutes()).padStart(2,'0')} UTC`;
  const discoveryMode=S.locatorDiscoveryMode==='fallback_locator'
    ?'The optional announcement locator is supplying fallback first contact.'
    :'Direct and libp2p peer discovery are primary; the optional announcement locator is standing by.';
  const warmPending=S.fastOriginRefreshPending===true;
  status.title=warmPending
    ?`${recordCount} previously verified signed identity records restored; checking the current complete inventory now. ${discoveryMode}`
    :`${recordCount} signed discovery records verified with Ed25519 across ${kernelCount} discovered kernels; ${monitored} actively monitored. ${discoveryMode}`;
  status.setAttribute('aria-label',warmPending
    ?`${recordCount} previously verified signed records; refreshing current inventory`
    :`${recordCount} verified records across ${kernelCount} nodes; updated ${refreshed}`);
  status.innerHTML=warmPending
    ?`<span class="amber">${recordCount}</span> previously verified identity record${recordCount===1?'':'s'} · checking current inventory…`
    :`<span class="ok">${recordCount}</span> verified record${recordCount===1?'':'s'} · `
      +`<span class="ok">${compactCount(kernelCount)}</span> node${kernelCount===1?'':'s'} · updated ${refreshed}`;
}
async function discover({refreshGlobal=true,trailing=false}={}){
  // A fixed safety refresh can overlap an event-triggered refresh on a slow
  // route. Coalesce one trailing pass when the verified node set changed.
  if(_discoverBusy){ if(trailing) _discoverQueued=true; return {queued:trailing}; }
  _discoverBusy=true;
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
    const signal=AbortSignal.timeout(P2P_ROUTE_LIMITS.jobDeadlineMs);
    const job=discoverFrom(b,'internet',knownBoot,{signal}).then(async(res)=>{
      if(!res.boot) return;
      const accepted=applyVerifiedProviderInventory(
        b,res.boot,res.found,res.inventory,res.providerIndex);
      if(!accepted) return;
      if(!b){
        S.fastOriginRefreshPending=false;
        if(res.providerIndex) persistFastOriginInventory(res.boot,res.providerIndex);
      }
      S.boots.set(b||'@origin',res.boot);
      const sources=peerSourceTags(b);
      const directTransport=S.p2pDataRoutes?.has(opBaseKey(b||location.origin))
        ?'p2p':'http';
      noteKernel(res.boot.kernel_id,directTransport,b||location.origin,{reachable:true});
      sources.filter((src)=>src!==directTransport).forEach((src)=>
        noteKernel(res.boot.kernel_id,src,b||location.origin,{reachable:true}));
      S.peerHealth=(S.peerHealth||new Map());
      S.peerHealth.set(b||location.origin,{ok:true,records:res.found.length,
        kernel:res.boot.kernel_id,t:Date.now()});
      connectDiscoveryStream(b,res.boot);
      collectP2PBootstraps(res.boot,{dial:true});
      scheduleRealtimeRepaint({records:true});
      await loadTelemetry(b,{signal,boot:res.boot}); // aggregate static spans + live node telemetry
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
  const incrementalGlobalJobs=new Set();
  const discoverIncrementalGlobal=()=>{
    const job=discoverAvailable().finally(()=>incrementalGlobalJobs.delete(job));
    incrementalGlobalJobs.add(job); return job;
  };
  // Direct/P2P locator planes get the first bounded opportunity. The optional
  // HTTP directory is queried only after that window produces no verified
  // P2P data route or healthy direct node read.
  const planeJobs=[
    discoverViaIPFS({rediscover:false}),                            // signed IPFS node cards → peers
    discoverLocalNode({rediscover:false}),                          // local node, if this browser can reach it
  ];
  await discoverAvailable();
  const sourceJobs=planeJobs.map((job)=>Promise.resolve(job).catch(()=>null).then(discoverAvailable));
  await Promise.allSettled(sourceJobs);
  await Promise.allSettled(resultJobs);
  if(refreshGlobal){
    const fallback=_currentLocatorFallbackDecision();
    S.locatorDiscoveryMode=fallback.mode;
    if(fallback.queryLocator){
      await loadGlobalNodes({onUpdate:discoverIncrementalGlobal}).catch(()=>null);
      await Promise.resolve();
      await Promise.allSettled([...incrementalGlobalJobs]);
      await discoverAvailable();
      await Promise.allSettled(resultJobs);
    }
  }
  rebalanceDiscoveryStreams();
  classifyMap(); renderGlobalKernels(); updateVitalsCounters();
  refreshSystemView();
  // The first interval tick can precede provider-inventory admission on a
  // fresh hosted tab. Start the separately verified public artifact probe as
  // soon as discovery has established the signed task/base/run join.
  pollLiveArtifacts();
  updateDiscoverySummary();
  }finally{
    _discoverBusy=false;
    if(_discoverQueued){
      _discoverQueued=false;
      queueMicrotask(()=>discover({refreshGlobal:false}).catch(()=>{}));
    }
  }
}

let _globalRefreshTimer=null, _globalRefreshBusy=false;
const _globalRefreshStartedAt=Date.now();
function _healthyDirectPeerCount(now=Date.now()){
  const locatorBases=new Set(globalDiscoveryEndpoints()
    .map((base)=>String(base||'').replace(/\/$/,'')));
  let count=0;
  for(const [base,health] of (S.peerHealth||new Map())){
    const normalized=String(base||'').replace(/\/$/,'');
    if(!normalized||locatorBases.has(normalized)||health?.ok!==true) continue;
    const observedAt=Number(health?.t)||0;
    if(observedAt&&now-observedAt<=45000) count++;
  }
  return count;
}
function _currentLocatorFallbackDecision(now=Date.now()){
  const rendezvousConfigured=P2P?._rendezvousConfigured===true;
  return locatorFallbackDecision({
    locatorEnabled:globalDiscoveryEndpoints().length>0,
    nowMs:now,
    startedAtMs:_globalRefreshStartedAt,
    verifiedP2PRouteCount:S.p2pDataRoutes?.size||0,
    healthyDirectPeerCount:_healthyDirectPeerCount(now),
    // The hosted transport commons and libp2p module initialize concurrently
    // with direct discovery.  Their not-yet-settled state is an expected peer
    // probe, not evidence that no peer probe exists.  Otherwise a fast first
    // discovery pass can contact the last-resort HTTP locator before libp2p has
    // even had an opportunity to dial its bootstrap set.
    peerProbeExpected:_p2pStartupExpected||rendezvousConfigured,
    peerProbeComplete:rendezvousConfigured
      ?P2P?._rendezvousFirstAttemptCompleted===true
      :_p2pStartupSettled,
  });
}
function scheduleFastGlobalRefresh(delayMs){
  clearTimeout(_globalRefreshTimer);
  _globalRefreshTimer=setTimeout(refreshGlobalDirectoryFast,Math.max(50,delayMs));
}
async function refreshGlobalDirectoryFast(){
  if(_globalRefreshBusy){ scheduleFastGlobalRefresh(1000); return; }
  _globalRefreshBusy=true; let nextDelay=7000;
  try{
    const fallback=_currentLocatorFallbackDecision();
    S.locatorDiscoveryMode=fallback.mode;
    if(!fallback.queryLocator){
      pruneExpiredDiscoveryState();
      nextDelay=fallback.nextCheckMs;
      return;
    }
    const result=await loadGlobalNodes();
    pruneExpiredDiscoveryState();
    const warming=Date.now()-_globalRefreshStartedAt<30000;
    const resolverSuggestedDelay=Number(result?.pollAfterMs)
      ||(warming||!result?.announcements?.length?2500:7000);
    // One fallback response is enough to try every signed route it supplied.
    // Treat the server hint as a freshness suggestion, not permission for
    // every open tab to amplify reads while direct/P2P reconciliation runs.
    nextDelay=Math.max(Number(fallback.nextCheckMs)||0,resolverSuggestedDelay);
    if(result?.changed){
      classifyMap(); renderGlobalKernels(); updateVitalsCounters(); refreshSystemView();
      discover({refreshGlobal:false,trailing:true}).then(()=>{
        renderMissions(); refreshLiveSection();
      }).catch(()=>{});
    }
  }finally{
    _globalRefreshBusy=false; scheduleFastGlobalRefresh(nextDelay);
  }
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
    <h3>${icon('warn')} No live AI Personas discovered yet</h3>
    <div class="desc2">This page ships <b>no data</b> — every persona, message and number you see is
	    discovered at runtime from live nodes. Signed discovery records are Ed25519-verified in your browser;
	    unverified operator-status execution frames are separately labelled unsigned transport telemetry. Nothing is showing because
	    no reachable node is currently publishing public records.</div>
	    ${S.globalAnnouncements?.size?`<div class="desc2"><b>${S.globalAnnouncements.size}</b> signed node announcement(s) were found through a configured resolver, but none produced browser-reachable public records yet.</div>`:''}
    <h4>Peers tried</h4>${rows}
    <h4>Get live data</h4>
    <div class="desc2">
    1 · From the AI Personas repository, run <code>./start-node.sh</code>.<br>
    ${httpsPage?`2 · This page is <b>https://</b> — browsers block direct fetches to a plain-http
    LAN/localhost node. A public <code>--libp2p</code> launch creates HTTPS/WSS quick-tunnel routes
    automatically; a stable deployment may supply its own <code>--public-url</code> and
    <code>--libp2p-advertise-host</code>. A same-origin node-served shell requires both
    <code>--ui-shell-dir</code> and <code>--ui-shell-manifest-sha256</code>.`:`2 · LAN peers
    also meet over mDNS; a public node joins the shared DHT.`}<br>
    3 · The global directory refreshes every few seconds and inspects changed nodes immediately.<br>
    4 · Click <b>PUBLIC DATA</b> to inspect any complete verified route discovered by the network.
    This browser is display-only: task, response, budget, stop, and tool mutations are unavailable
    until the deployment runtime has a separately verified secure boundary.</div>
  </div>`;
}

function offlineHistoryHTML(){
  // History is never merged into S.recs, route maps, counters, mission state,
  // or liveness. A reachable bootstrap is not yet current inventory authority,
  // so the historical lane may remain visible while direct/P2P verification races.
  const currentKernels=new Set([...S.providerInventories.entries()]
    .filter(([,inventory])=>_providerInventoryIsCurrent(inventory))
    .map(([kernel])=>String(kernel)));
  const currentIds=new Set();
  for(const row of S.recs.values()) for(const value of [
    row?.record_id,row?.card_id,row?.did,row?.id,_shortId(row?.did||row?.record_id||''),
  ]) if(value) currentIds.add(String(value));
  const byKernel=new Map();
  for(const snapshot of (S.offlineHistory||[])){
    const kernel=String(snapshot?.kernel_id||'');
    if(!kernel||currentKernels.has(kernel)||(S.kernelFocus&&S.kernelFocus!==kernel)) continue;
    const prior=byKernel.get(kernel);
    if(!prior||Date.parse(snapshot.stored_at)>Date.parse(prior.stored_at))
      byKernel.set(kernel,snapshot);
  }
  const snapshots=[...byKernel.values()];
  if(!snapshots.length) return '';
  const snapshotLabel=snapshots.every((snapshot)=>
    Date.parse(String(snapshot?.lease?.expires_at||''))<=Date.now())
    ?'Expired signed snapshot cached by this browser'
    :'Signed snapshot cached by this browser · offline';
  const query=String(S.q||'').trim().toLowerCase();
  const matches=(...values)=>!query||values.flat().join(' ').toLowerCase().includes(query);
  const personas=snapshots.flatMap((snapshot)=>(snapshot.personas||[])
    .filter((row)=>!currentIds.has(String(row.id||''))
      &&matches(row.name,row.description,row.id,snapshot.kernel_id))
    .map((row)=>({...row,kernel:snapshot.kernel_id,storedAt:snapshot.stored_at})));
  const environments=snapshots.flatMap((snapshot)=>(snapshot.environments||[])
    .filter((row)=>!currentIds.has(String(row.id||''))
      &&matches(row.name,row.description,row.capabilities,row.id,snapshot.kernel_id))
    .map((row)=>({...row,kernel:snapshot.kernel_id,storedAt:snapshot.stored_at})));
  const artifacts=snapshots.flatMap((snapshot)=>(snapshot.artifacts||[])
    .filter((row)=>!currentIds.has(String(row.id||''))
      &&matches(row.path,row.description,row.media,row.purpose,row.content_hash,
        row.environment_id,snapshot.kernel_id))
    .map((row)=>({...row,kernel:snapshot.kernel_id,storedAt:snapshot.stored_at})));
  const retained={persona:personas.length,env:environments.length,artifact:artifacts.length};
  if(!retained.persona&&!retained.env&&!retained.artifact) return '';
  const personaCards=personas.slice(0,NETWORK_LIMITS.personaInitial).map((row,index)=>{
    const hue=(Array.from(row.id||'persona').reduce((sum,char)=>sum+char.codePointAt(0),0)+index*29)%360;
    const when=_friendlyInstant(row.storedAt)||'an earlier visit';
    return `<article class="pcard identity-signed offline-history-card" style="--avatar-hue:${hue}" aria-label="offline history for ${esc(row.name)}">`
      +'<div class="pc-card-shine" aria-hidden="true"></div><div class="pc-card-edition"><span>OFFLINE HISTORY</span><span>NOT LIVE</span></div>'
      +`<header class="pc-profile"><span class="pc-avatar" aria-label="portrait body is not retained in offline metadata"><span class="pc-avatar-placeholder" aria-hidden="true"><span class="pc-avatar-silhouette"><i></i></span><small>${row.avatar_available?'portrait offline':'portrait unavailable'}</small></span></span>`
      +'<i class="pc-dot off" aria-hidden="true"></i>'
      +`<div class="pc-identity"><h3 class="pc-name">${esc(row.name)}</h3><span class="pc-name-proof">historical signatures rechecked</span>`
      +`<span class="pc-role-line"><small>${row.description?'Self-description':'Profile state'}</small><strong>${esc(row.description||'Self-description still forming')}</strong></span></div>`
      +'<div class="pc-badges"><span class="pc-idle">OFFLINE</span></div></header>'
      +`<section class="pc-current"><span class="pc-current-label">Cached signed observation</span><div class="pc-doing"><span class="pc-rest">●</span><strong>Signed identity lease was valid at ${esc(when)}; current activity is unknown.</strong></div></section>`
      +`<div class="pc-stats"><span class="tag" title="historical node identity">${esc(row.kernel)}</span></div></article>`;
  }).join('');
  const environmentCards=environments.slice(0,NETWORK_LIMITS.environmentInitial).map((row)=>{
    const words=String(row.name||'workspace').split(/\s+/).filter(Boolean);
    const initials=(words.length>1?words[0][0]+words.at(-1)[0]:words[0]?.slice(0,2)||'EN').toUpperCase();
    const when=_friendlyInstant(row.storedAt)||'an earlier visit';
    return `<article class="env-card record-signed offline-history-card" aria-label="offline history for workspace ${esc(row.name)}">`
      +'<div class="env-card-foil" aria-hidden="true"></div><header class="env-card-profile">'
      +`<div class="env-card-avatar"><span class="env-card-glyph">${icon('box')}</span><strong>${esc(initials)}</strong></div>`
      +`<div class="env-identity"><span class="env-kicker">OFFLINE WORKSPACE HISTORY</span><span class="env-name">${esc(row.name)}</span><span class="env-card-id" title="host node ${esc(row.kernel)}">cached signed history</span></div>`
      +'<span class="env-state">offline</span></header>'
      +`<div class="env-card-empty">Signed workspace evidence was valid at ${esc(when)}. Current membership and work state are unknown.</div></article>`;
  }).join('');
  const artifactRows=artifacts.slice(0,80).map((row)=>{
    const presentation=_artifactFilePresentation(row.path),media=String(row.media?.[0]||'');
    const workspaceName=row.environment_id?(_environmentNameFor(row.environment_id,row.kernel)||''):'';
    const factBits=[
      artifactTypeLabel(media),
      row.size_bytes!=null?fmtBytes(row.size_bytes):'',
      workspaceName?`workspace ${workspaceName}`:'',
      row.storedAt?`signed snapshot ${_friendlyInstant(row.storedAt)}`:'signed snapshot earlier',
    ].filter(Boolean);
    return `<div class="current-artifact-file artifact-preview-unavailable offline-history-artifact" aria-label="${esc(row.path)} — offline metadata only"${row.content_hash?` title="content sha256 ${esc(row.content_hash)}"`:''}>`
      +`${_artifactFormatTileHTML(presentation)}<span class="current-artifact-copy">${_artifactFileIdentityHTML(presentation)}`
      +`<small>${esc(factBits.join(' · '))}</small></span>`
      +'<span class="current-artifact-preview">Metadata only · offline</span></div>';
  }).join('');
  const matchCount=personas.length+environments.length+artifacts.length;
  return `<section class="offline-history-banner" role="status"><strong>${icon('history','ico-sm')} ${esc(snapshotLabel)}</strong>`
    +'<span>The browser rechecked the cached signatures, inventory, document hashes, policies, and historical lease window. The cached timestamp is not current liveness evidence; direct and peer discovery continues in the background.</span></section>'
    +`<div class="stage-summary"><div><strong>${query?`${matchCount} matching historical records`:`${retained.persona} personas · ${retained.env} workspaces · ${retained.artifact} artifacts`}</strong> <span class="scope-copy">· offline metadata history · not live</span></div></div>`
    +(personaCards?`<section class="persona-section offline-history-section"><header class="stage-section-head"><div><span class="section-kicker">OFFLINE PERSONA HISTORY</span><h2>Personas in cached signed evidence</h2></div><p>No current thinking, work, or availability is implied.</p></header><div class="persona-deck">${personaCards}</div></section>`:'')
    +(environmentCards?`<section class="environment-section offline-history-section"><header class="stage-section-head compact"><div><span class="section-kicker">OFFLINE WORKSPACE HISTORY</span><h2>Workspaces in cached signed evidence</h2></div><p>Live membership and work state are unknown.</p></header><div class="environment-grid">${environmentCards}</div></section>`:'')
    +(artifactRows?`<section class="offline-history-files"><header class="stage-section-head compact"><div><span class="section-kicker">OFFLINE ARTIFACT INDEX</span><h2>File metadata in cached signed evidence</h2></div><p>File bodies stay closed until a current verified provider route returns.</p></header>${_artifactExactFormatCountsHTML(artifacts,(row)=>row.path)}<div class="current-artifact-list">${artifactRows}</div>${artifacts.length>80?`<p class="persona-window-note">${artifacts.length-80} additional matching historical artifact records remain in the bounded cache.</p>`:''}</section>`:'')
    +(!matchCount&&query?'<div class="mission-no-match">No offline history matches this network filter.</div>':'');
}

function _verifiedOfflineHistoryProjection(value){
  return value?.schema==='personaos-browser-verified-public-history/2'
    &&/^kernel:[0-9a-f]{16}$/i.test(String(value.kernel_id||''))
    &&Number.isFinite(Date.parse(String(value.stored_at||'')))
    &&Array.isArray(value.personas)&&Array.isArray(value.environments)
    &&Array.isArray(value.artifacts);
}
function mergeOfflineHistoryProjections(values){
  const byKernel=new Map((S.offlineHistory||[])
    .filter(_verifiedOfflineHistoryProjection).map((item)=>[item.kernel_id,item]));
  for(const value of (Array.isArray(values)?values:[])){
    if(!_verifiedOfflineHistoryProjection(value)) continue;
    const prior=byKernel.get(value.kernel_id);
    if(!prior||Date.parse(value.stored_at)>=Date.parse(prior.stored_at))
      byKernel.set(value.kernel_id,value);
  }
  S.offlineHistory=[...byKernel.values()].sort((left,right)=>
    Date.parse(right.stored_at)-Date.parse(left.stored_at)).slice(0,4);
  globalThis.__personaOSOfflineHistory=S.offlineHistory;
  return S.offlineHistory;
}
async function hydrateOfflineHistory(){
  const verified=await verifyOfflineHistorySnapshots(readOfflineHistorySnapshots());
  if(!verified.length) return false;
  mergeOfflineHistoryProjections(verified);
  refreshSystemView();
  return true;
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
  // client. heartbeat.running alone is true for an idle node (the thread is
  // just alive), so requiring busy stops the green 'producing' claim on an idle node.
  if(!isReachableNode()) return false;
  const heartbeat=heartbeatForScope();
  if(!(heartbeat&&heartbeat.running&&heartbeat.busy)) return false;
  const noPersonas=!(S.liveByPersona&&S.liveByPersona.size);
  const noActs=!((S.interactions||[]).length);
  return noPersonas&&noActs;
}
// HONEST idle-but-alive: node reachable, heartbeat running, but NOT busy (no active
// task run) and nothing has streamed yet. Distinct from warming (busy) — the copy must
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
    +`<div><b class="amber">node is online — no active task run observed</b>`
    +`<span class="l2"> — the heartbeat is alive but idle. This public browser remains read-only; personas, coordination and artifacts appear when the node publishes them.</span></div>`
    +`</div>`;
}
// A calm pulsing-green warming banner: the dot reuses the existing 'live' class for its
// pulse (with a minimal inline colour fallback) and the .state-banner shell carries the
// shared token spacing/elevation — no more inline layout blob.
function warmingHTML(){
  return `<div class="state-banner warming">`
    +`<span class="dot live" style="background:var(--up);box-shadow:0 0 8px var(--up)"></span>`
    +`<div><b style="color:var(--up)">node is producing the first candidate</b>`
    +`<span class="l2"> — telemetry will stream here shortly. Personas, coordination and artifacts appear when the run emits them.</span></div>`
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
    if(recordsChanged){ classifyMap(); renderGlobalKernels(); updateDiscoverySummary(); }
    renderInteractionStream(); renderMissions(); updateVitalsCounters();
    refreshLiveSection();
    Promise.resolve(refreshSystemView()).catch(()=>{});
  };
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(paint);
  else setTimeout(paint,0);
}
// A telemetry frame is also a concrete signal that a persona's signed public
// cognition snapshot may have advanced. Coalesce bursts so provider deltas paint
// quickly without turning one SSE burst into an unbounded fetch fan-out.
let _sseCognitionTimer=0, _sseCognitionBusy=false, _sseCognitionPending=false;
let _sseCognitionFullPending=false;
const _sseCognitionPendingPersonaKeys=new Set(), _sseCognitionPendingBases=new Set();
function scheduleSseCognitionRefresh(scope=null){
  if(scope?.preservePending!==true){
    // The collectible-card lazy cognition cache follows the scoped
    // cognition_invalidate signal so stat rows / model badges refresh with the
    // deck repaint; unscoped telemetry ticks are left to the cache TTL.
    for(const key of Array.isArray(scope?.personaKeys)?scope.personaKeys.filter(Boolean):[])
      _pkCognitionInvalidate(key);
    const personaKeys=Array.isArray(scope?.personaKeys)?scope.personaKeys.filter(Boolean):[];
    const hasBase=Object.prototype.hasOwnProperty.call(scope||{},'base')
      &&typeof scope.base==='string';
    const base=hasBase?scope.base.replace(/\/$/,''):'';
    if(personaKeys.length&&hasBase){
      for(const key of personaKeys) _sseCognitionPendingPersonaKeys.add(String(key));
      _sseCognitionPendingBases.add(base);
    }else _sseCognitionFullPending=true;
    _sseCognitionPending=true;
  }
  if(_sseCognitionBusy||_sseCognitionTimer) return;
  _sseCognitionTimer=setTimeout(async()=>{
    _sseCognitionTimer=0;
    if(!_sseCognitionPending) return;
    const full=_sseCognitionFullPending;
    const pendingPersonaKeys=new Set(_sseCognitionPendingPersonaKeys);
    const pendingBases=new Set(_sseCognitionPendingBases);
    _sseCognitionPending=false; _sseCognitionFullPending=false;
    _sseCognitionPendingPersonaKeys.clear(); _sseCognitionPendingBases.clear();
    _sseCognitionBusy=true;
    try{
      const jobs=[streamPersonaCognition(full?{force:true}:{personaKeys:[...pendingPersonaKeys],
        bases:[...pendingBases],force:true})];
      const drawerKey=S.drawerThinkPid
        ?_personaRef(S.drawerThinkPid,S.drawerLiveKernel||'').key:'';
      if(S.drawerThinkPid&&(full||pendingPersonaKeys.has(drawerKey))) jobs.push(refreshThinking());
      const settled=await Promise.allSettled(jobs);
      if(settled[0]?.status==='fulfilled'&&settled[0].value===false){
        if(full) _sseCognitionFullPending=true;
        else{
          for(const key of pendingPersonaKeys) _sseCognitionPendingPersonaKeys.add(key);
          for(const pendingBase of pendingBases) _sseCognitionPendingBases.add(pendingBase);
        }
        _sseCognitionPending=true;
      }
    }
    finally{
      _sseCognitionBusy=false;
      if(_sseCognitionPending) scheduleSseCognitionRefresh({preservePending:true});
    }
  },250);
}
// A verified SSE frame has already updated the per-entity indices. Coalesce a
// burst into the next browser paint instead of waiting for the five-second poll.
function appendTelemetryEvent(payload,base,boot,reason){ scheduleRealtimeRepaint(); }
function _personaKeysForInvalidation(base,boot,personaIds){
  const expectedKernel=String(kernelForBase(base)||boot?.kernel_id||'');
  if(!expectedKernel||!Array.isArray(personaIds)||!personaIds.length) return null;
  const known=new Map();
  for(const id of (S.order||[])){ const record=S.recs.get(id);
    if(record?.kind!=='persona'||record?._kernel!==expectedKernel) continue;
    const ref=_personaRef(record.did||record.id||'',expectedKernel);
    known.set(_signedPersonaEndpointId(ref.key),ref.key); }
  for(const key of (S.liveByPersona||new Map()).keys()){
    const ref=_personaRef(key); if(ref.kernel===expectedKernel)
      known.set(_signedPersonaEndpointId(ref.key),ref.key); }
  const personaKeys=personaIds.map((id)=>known.get(id));
  return personaKeys.some((value)=>!value)?null:{expectedKernel,personaKeys};
}
function _clearEntityFeedCache(base){
  const prefix=(base||'@origin')+'|';
  for(const key of (S.entFeed||new Map()).keys()) if(key.startsWith(prefix)) S.entFeed.delete(key);
}
async function _refreshPeerInventory(base){
  const route=S.p2pDataRoutes?.get(opBaseKey(base)); if(!route) return false;
  const resolved=await _discoverFromP2P({base,kernel:route.kernel,peerId:route.peerId,
    providerRecord:route.providerRecord}).catch(()=>null);
  if(!resolved?.boot) return false;
  const accepted=applyVerifiedProviderInventory(
    base,resolved.boot,resolved.found,resolved.inventory,resolved.providerIndex);
  if(accepted){ classifyMap(); updateVitalsCounters(); renderMissions(); }
  return accepted;
}
function _schedulePeerInvalidation(base,boot,event){
  if(!event||event.kind==='heartbeat') return;
  const baseKey=String(base||'').replace(/\/$/,'');
  const revisionKey=`${baseKey}\u0000${event.kind}\u0000${event.run||''}`;
  const revision=String(event.revision||event.previous_revision||'');
  if(revision&&S.p2pWatchRevisions.get(revisionKey)===revision) return;
  if(revision){ S.p2pWatchRevisions.delete(revisionKey); S.p2pWatchRevisions.set(revisionKey,revision);
    while(S.p2pWatchRevisions.size>NETWORK_LIMITS.cachedKernels)
      S.p2pWatchRevisions.delete(S.p2pWatchRevisions.keys().next().value); }
  let pending=S.p2pInvalidations.get(baseKey);
  if(!pending){ pending={base:baseKey,boot,kinds:new Set(),personaIds:new Set(),runs:new Map(),timer:null};
    S.p2pInvalidations.set(baseKey,pending); }
  pending.boot=boot||pending.boot; pending.kinds.add(event.kind);
  for(const id of (event.persona_ids||[])) if(pending.personaIds.size<256) pending.personaIds.add(id);
  if(event.kind==='artifact'&&event.run) pending.runs.set(event.run,event);
  if(pending.timer) return;
  pending.timer=setTimeout(async()=>{
    S.p2pInvalidations.delete(baseKey);
    const resync=pending.kinds.has('resync');
    const jobs=[];
    if(resync||pending.kinds.has('discovery')) jobs.push(_refreshPeerInventory(baseKey));
    if(resync||pending.kinds.has('telemetry')){
      _clearEntityFeedCache(baseKey); jobs.push(loadTelemetry(baseKey)); }
    if(resync||pending.kinds.has('cognition')){
      const scoped=_personaKeysForInvalidation(baseKey,pending.boot,[...pending.personaIds]);
      scheduleSseCognitionRefresh(scoped?{base:baseKey,personaKeys:scoped.personaKeys}:null);
    }
    for(const item of pending.runs.values()) jobs.push(fetchLiveArtifacts(baseKey,item.run,{publicSeed:true}));
    if(resync) pollLiveArtifacts();
    await Promise.allSettled(jobs);
    scheduleRealtimeRepaint({records:resync||pending.kinds.has('discovery')});
    refreshSystemView(); refreshLiveSection();
  },150);
}
function _ensurePeerDiscoveryStream(base,boot,route){
  if(!P2P?.watchPublicEvents||!route?.providerRecord) return false;
  const normalized=String(base||'').replace(/\/$/,'');
  const key=`p2p:${opBaseKey(normalized)}`, current=S.streams.get(key);
  if(current&&current._peerId===route.peerId&&current._kernel===route.kernel){
    current._boot=boot||current._boot; return true; }
  for(const [streamKey,stream] of S.streams){
    if(String(stream?._base||'').replace(/\/$/,'')!==normalized) continue;
    try{ stream?.close?.(); }catch(e){} S.streams.delete(streamKey);
  }
  const watchCount=[...S.streams.keys()].filter((value)=>String(value).startsWith('p2p:')).length;
  if(watchCount>=NETWORK_LIMITS.monitoredBases) return false;
  let entry;
  try{
    const watch=P2P.watchPublicEvents(route.providerRecord,{
      onInvalidation:(event)=>_schedulePeerInvalidation(normalized,entry?._boot||boot,event),
      onState:(state,detail)=>{
        if(state==='open'&&entry?._opened!==true){ if(entry) entry._opened=true;
          log('stream',`${normalized} peer invalidation stream connected`,true); }
        else if(state==='retry'&&entry?._noted!==true){ if(entry) entry._noted=true;
          log('stream',`${normalized} peer stream retrying; polling remains active${detail?`: ${detail}`:''}`,false); }
      }
    });
    entry={close:watch.close,done:watch.done,_base:normalized,_boot:boot,
      _peerId:route.peerId,_kernel:route.kernel,_opened:false,_noted:false};
    S.streams.set(key,entry); return true;
  }catch(_){ return false; }
}
function connectDiscoveryStream(base,boot){
  const peerRoute=S.p2pDataRoutes?.get(opBaseKey(base));
  if(peerRoute){ _ensurePeerDiscoveryStream(base,boot,peerRoute); return; }
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
  es.addEventListener('discovery_snapshot',async (ev)=>{
    try{
      const snap=JSON.parse(ev.data||'{}');
      const providerIndex=snap?.providers;
      const verified=await verifiedRowsFromProviderIndex(providerIndex,base,boot,'internet','SSE provider snapshot');
      const inventory={...(verified.inventory||{}),complete:verified.inventory?.ok===true
        &&verified.refused===0
        &&new Set(verified.rows.map((row)=>row.record_id)).size===verified.inventory.recordIds?.size};
      const accepted=applyVerifiedProviderInventory(
        base,boot,verified.rows,inventory,providerIndex);
      const added=accepted?verified.rows.length:0;
      log('stream',`discovery snapshot: ${added} current ProviderRecord(s) verified; ${verified.refused} refused`,verified.refused===0);
      if(added){ classifyMap(); updateVitalsCounters(); refreshSystemView(); scheduleSseCognitionRefresh(); }
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
      scheduleSseCognitionRefresh();
    }
    catch(e){ return; }
  });
  es.addEventListener('cognition_invalidate',(ev)=>{
    // This frame is intentionally content-free and conveys no authority. It
    // can only schedule a refetch; model text is rendered solely after the
    // fetched public cognition document verifies under the current master.
    try{
      const payload=JSON.parse(ev.data||'{}');
      const expectedKernel=String(kernelForBase(base)||boot?.kernel_id||'');
      const personaIds=Array.isArray(payload?.persona_ids)?payload.persona_ids:[];
      if(!expectedKernel
          ||!_exactObjectFields(payload,
            ['generated_at','node_id','persona_ids','revision','schema'])
          ||payload.schema!=='personaos-cognition-invalidator/1'
          ||String(payload.node_id||'')!==expectedKernel
          ||!/^sha256:[0-9a-f]{64}$/.test(String(payload.revision||''))
          ||!personaIds.length||personaIds.length>256
          ||new Set(personaIds).size!==personaIds.length
          ||personaIds.some((value)=>typeof value!=='string'||!value
            ||value!==value.trim()||new TextEncoder().encode(value).byteLength>240)
          ||!_safePublicCognitionInstant(payload.generated_at)) return;
      const scoped=_personaKeysForInvalidation(base,boot,personaIds);
      if(!scoped||scoped.expectedKernel!==expectedKernel) return;
      scheduleSseCognitionRefresh({base,personaKeys:scoped.personaKeys});
    }catch(e){}
  });
  es.addEventListener('live_artifact_update',(ev)=>{
    const raw=ev.data||'{}';
    enqueueLiveArtifactFrame(async()=>{
      let payload; try{ payload=JSON.parse(raw); }
      catch(e){ log('stream','live artifact frame parse failed',false); return; }
      const previous=liveArtifactState(base,payload?.run);
      const verification=await _verifyLiveWithKeyRefresh(base,url,boot,(context)=>
        verifyLiveArtifactEvent(payload,{...context,requirePublic:true,
          expectedPreviousRevision:previous?.revision||''}));
      if(!verification.ok){
        _logLiveVerificationRefusal(payload?.run,verification); return;
      }
      if(verification.kind==='run_ended'){
        endLiveArtifactRun(base,payload,{verification}); return;
      }
      if(verification.kind!=='snapshot'){
        _logLiveVerificationRefusal(payload?.run,{reason:'unexpected_live_artifact_event_kind'}); return;
      }
      ingestLiveArtifactSnapshot(base,payload.snapshot,'sse',{
        previousRevision:payload.previous_revision,verification:verification.snapshot});
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
async function loadTelemetry(base,{signal=null,boot:knownBoot=null}={}){
  const boot=knownBoot||await fetchDiscoveryBootstrap(base,{signal});
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
    if(!publicFrameVerified){ log('telemetry',`${base||'@origin'}: refused public telemetry verification`,false); return; }
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
    if(signal?.aborted) return;
    const spans=await fetchJson(join(base,url),{signal});
    ingestSpans(spans);
  }
  if(boot.live_telemetry_url){
    const live=await fetchJson(join(base,boot.live_telemetry_url),{signal});
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
async function contentBoundDocument(base,path,expectedHash){
  const document=await dfetch(base,path);
  if(!document||!expectedHash) return null;
  const observed=`sha256:${await sha256Hex(enc.encode(canon(document)))}`;
  return observed===String(expectedHash)?document:null;
}
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
const statusFetchJobs=new Map();
const liveStatusCache=new Map();
const liveStatusFetchJobs=new Map();
function currentStatusCacheHit(baseKey,hit=statusCache.get(baseKey)){
  const base=baseKey==='@origin'?'':baseKey;
  return hit&&hit.credential===tokenFor(join(base,'status'))?hit:null;
}
function fullNodeStatusProjection(status){
  return status?.schema==='personaos-node-status/1';
}
function nodeStatusAccess(base,status){
  const key=base||'@origin', cached=currentStatusCacheHit(key);
  const exactCachedMode=cached?.v===status?cached.credentialed:!!tokenFor(join(base,'status'));
  const read=fullNodeStatusProjection(status);
  const bearer=read&&exactCachedMode;
  return {granted:read,read,publicRead:read&&!exactCachedMode,bare:read&&!exactCachedMode,
    bearer,control:bearer};
}
function freshPublicReadStatusBases(now=Date.now()){
  const bases=[];
  for(const [key,hit] of statusCache){
    if(!currentStatusCacheHit(key,hit)||now-Number(hit?.ts||0)>15000) continue;
    const base=key==='@origin'?'':key;
    if(nodeStatusAccess(base,hit?.v).publicRead) bases.push(base);
  }
  return bases;
}
async function fetchNodeStatus(base){
  const key=base||'@origin', endpoint=join(base,'status');
  const credential=tokenFor(endpoint), credentialed=!!credential, hit=currentStatusCacheHit(key);
  // Never reuse a bearer-derived full projection after a credential is removed,
  // a bare public projection immediately after a bearer is added, or a response
  // obtained under a different bearer.
  if(hit&&hit.credential===credential&&(Date.now()-hit.ts)<4000) return hit.v;
  if(credentialed){
    const v=await fetchJson(endpoint);
    if(tokenFor(endpoint)!==credential) return null;
    if(v){ statusCache.set(key,{v,ts:Date.now(),credentialed:true,credential}); indexRuntimeStatus(base,v); }
    return v||null;
  }
  const requestKey=key;
  const pending=statusFetchJobs.get(requestKey);
  if(pending) return pending;
  let job;
  const request=(async()=>{
    const v=await fetchResponsivePublicJson(endpoint);
    if(tokenFor(endpoint)) return null;
    if(v){ statusCache.set(key,{v,ts:Date.now(),credentialed:false,credential:''}); indexRuntimeStatus(base,v); }
    return v||null;
  })();
  job=request.finally(()=>{
    if(statusFetchJobs.get(requestKey)===job) statusFetchJobs.delete(requestKey);
  });
  statusFetchJobs.set(requestKey,job);
  return job;
}
async function fetchNodeLiveStatus(base){
  const key=base||'@origin', endpoint=join(base,'status/live');
  const credential=tokenFor(endpoint); let hit=liveStatusCache.get(key);
  if(hit&&hit.credential!==credential){ liveStatusCache.delete(key); hit=null; }
  if(hit&&(Date.now()-hit.ts)<2000) return hit.v;
  const pending=liveStatusFetchJobs.get(key); if(pending) return pending;
  let job;
  const request=(async()=>{
    const v=await fetchResponsivePublicJson(endpoint);
    if(tokenFor(endpoint)!==credential) return null;
    if(v?.schema==='personaos-node-live-status/1'){
      liveStatusCache.set(key,{v,ts:Date.now(),credential});
      indexRuntimeStatus(base,v);
      return v;
    }
    return null;
  })();
  job=request.finally(()=>{
    if(liveStatusFetchJobs.get(key)===job) liveStatusFetchJobs.delete(key);
  });
  liveStatusFetchJobs.set(key,job);
  return job;
}
function overlayNodeLiveStatus(status,live){
  if(!live) return status||null;
  if(!status) return live;
  const merged={...status};
  for(const key of ['personas','live_run_model_pools','active_persona_count',
    'environment_member_persona_ids','active_run_persona_ids','paused_run_persona_ids',
    'running_llm_persona_ids','active_model_calls','stoppable_run','stoppable_runs',
    'pending_budget','public_discovery_version','public_discovery_record_count',
    'global_discovery','global_discovery_consumer','heartbeat','generated_at']){
    if(Object.prototype.hasOwnProperty.call(live,key)) merged[key]=live[key];
  }
  // Preserve the full response schema: live data may update observations but
  // must never manufacture read or owner-control authority.
  merged.schema=status.schema;
  return merged;
}
async function fetchNodeStatusWithLive(base){
  const [statusResult,liveResult]=await Promise.allSettled([
    fetchNodeStatus(base),fetchNodeLiveStatus(base),
  ]);
  const status=statusResult.status==='fulfilled'?statusResult.value:null;
  const live=liveResult.status==='fulfilled'?liveResult.value:null;
  return overlayNodeLiveStatus(status,live);
}
function currentRuntimeStatusEntries(now=Date.now(),maxAge=15000){
  const keys=new Set([...statusCache.keys(),...liveStatusCache.keys()]);
  const rows=[];
  for(const key of keys){
    const full=currentStatusCacheHit(key), live=liveStatusCache.get(key);
    const base=key==='@origin'?'':key;
    const currentCredential=tokenFor(join(base,'status/live'));
    const currentFull=full&&now-Number(full.ts||0)<=maxAge?full:null;
    const currentLive=live&&live.credential===currentCredential
      &&now-Number(live.ts||0)<=maxAge?live:null;
    if(!currentFull&&!currentLive) continue;
    rows.push([key,{
      v:overlayNodeLiveStatus(currentFull?.v||null,currentLive?.v||null),
      ts:Math.max(Number(currentFull?.ts||0),Number(currentLive?.ts||0)),
    }]);
  }
  return rows;
}
function personaIdFromDid(did){
  const m=/\/persona\/([^/]+)$/.exec(did||''); if(m) return m[1];
  return (did||'').replace('did:personaos:',''); }
async function fetchText(u,{signal=null}={}){
  if(signal?.aborted) return null;
  try{ const r=await fetch(u,secureFetchInit(u,{signal})); if(r.ok)
    return new TextDecoder().decode(await readBoundedResponseBytes(r,LIVE_ARTIFACT_LIMITS.maxFileBytes));
  }catch(e){}
  if(signal?.aborted) return null;
  const bytes=await settleBeforeAbort(
    fetchP2PArtifactBytes(u,'',LIVE_ARTIFACT_LIMITS.maxFileBytes),signal,null);
  return bytes?new TextDecoder().decode(bytes):null;
}
// Binary-safe bounded fetch for any artifact body — returns {blob,size,type} or null.
async function fetchBlob(u,{signal=null}={}){
  if(signal?.aborted) return null;
  try{ const r=await fetch(u,secureFetchInit(u,{signal})); if(r.ok){
    const bytes=await readBoundedResponseBytes(r,LIVE_ARTIFACT_LIMITS.maxFileBytes);
    const type=r.headers.get('content-type')||'application/octet-stream';
    const b=new Blob([bytes],{type}); return {blob:b,size:b.size,type}; }
  }catch(e){}
  if(signal?.aborted) return null;
  const bytes=await settleBeforeAbort(
    fetchP2PArtifactBytes(u,'',LIVE_ARTIFACT_LIMITS.maxFileBytes),signal,null);
  if(!bytes) return null;
  const type='application/octet-stream', b=new Blob([bytes],{type});
  return {blob:b,size:b.size,type};
}
async function fetchVerifiedLiveBody(url,expectedHash,{signal=null}={}){
  const cancelled={ok:false,checkOutcome:'cancelled',error:'artifact view cancelled'};
  if(signal?.aborted) return cancelled;
  const expected=String(expectedHash||'').replace(/^sha256:/,'').toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(expected))
    return {ok:false,checkOutcome:'failed',error:'invalid advertised SHA-256'};
  let absoluteUrl; try{ absoluteUrl=new URL(url,location.href).href; }
  catch(_){ return {ok:false,checkOutcome:'failed',error:'invalid artifact URL'}; }
  const cacheKey=`${expected}\u0000${absoluteUrl}`;
  const cached=S.verifiedArtifactBodies.get(cacheKey);
  if(cached){
    // Refresh insertion order so the byte-bound cache behaves as an LRU. The
    // hash was checked before insertion; a reused entry never skips the
    // advertised-hash binding because the digest is part of the cache key.
    S.verifiedArtifactBodies.delete(cacheKey); S.verifiedArtifactBodies.set(cacheKey,cached);
    return {...cached,blob:new Blob([cached.bytes],{type:cached.type})};
  }
  const pending=S.verifiedArtifactBodyJobs.get(cacheKey);
  if(pending) return settleBeforeAbort(pending,signal,cancelled);
  let job;
  const request=(async()=>{ try{
    const controller=new AbortController();
    const httpAttempt=(async()=>{
      const r=await fetch(absoluteUrl,secureFetchInit(absoluteUrl,{signal:controller.signal,priority:'high'}));
      if(!r.ok) throw new Error(`body HTTP ${r.status}`);
      const bytes=await readBoundedResponseBytes(r,LIVE_ARTIFACT_LIMITS.maxFileBytes);
      return {bytes,type:r.headers.get('content-type')||'application/octet-stream'};
    })();
    const attempts=[httpAttempt];
    if(p2pDataRouteForUrl(absoluteUrl)&&P2P?.fetchPublicBlob) attempts.push((async()=>{
      const bytes=await fetchP2PArtifactBytes(absoluteUrl,`sha256:${expected}`,
        LIVE_ARTIFACT_LIMITS.maxFileBytes);
      if(!bytes) throw new Error('verified peer body unavailable');
      return {bytes,type:'application/octet-stream'};
    })());
    let loaded;
    try{ loaded=attempts.length===1?await httpAttempt:await Promise.any(attempts); }
    finally{ controller.abort(); }
    const {bytes,type}=loaded,actual=await sha256Hex(bytes);
    if(actual!==expected) return {ok:false,checkOutcome:'failed',error:'SHA-256 mismatch',actual,expected};
    const verified={ok:true,actual,bytes,type,size:bytes.byteLength};
    S.verifiedArtifactBodies.set(cacheKey,verified);
    S.verifiedArtifactBodyBytes+=bytes.byteLength;
    const maxCacheBytes=LIVE_ARTIFACT_LIMITS.maxFileBytes*2;
    while(S.verifiedArtifactBodies.size>16||S.verifiedArtifactBodyBytes>maxCacheBytes){
      const oldestKey=S.verifiedArtifactBodies.keys().next().value;
      if(oldestKey===undefined) break;
      const oldest=S.verifiedArtifactBodies.get(oldestKey);
      S.verifiedArtifactBodies.delete(oldestKey);
      S.verifiedArtifactBodyBytes=Math.max(0,S.verifiedArtifactBodyBytes-Number(oldest?.size||0));
    }
    return {...verified,blob:new Blob([bytes],{type})};
  }catch(e){ const error=String(e&&e.message||e);
    return {ok:false,checkOutcome:/\bexceeds\b/i.test(error)?'failed':'unavailable',error}; }
  })();
  job=request.finally(()=>{ if(S.verifiedArtifactBodyJobs.get(cacheKey)===job)
    S.verifiedArtifactBodyJobs.delete(cacheKey); });
  S.verifiedArtifactBodyJobs.set(cacheKey,job);
  return settleBeforeAbort(job,signal,cancelled);
}
const fmtBytes=(n)=>{ if(n==null||isNaN(n))return '—'; if(n<1024)return n+' B';
  if(n<1048576)return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; };
const kv=(l,v)=>`<div class="row"><span class="l2">${esc(l)}</span><span class="v2">${v}</span></div>`;
const H=(t)=>`<h4>${esc(t)}</h4>`;
const chipsOf=(a)=>`<div class="caps">${(a||[]).filter(Boolean).map((c)=>`<span class="cap">${esc(c)}</span>`).join('')||'<span class="l2">—</span>'}</div>`;
function authoredCapabilitiesHTML(capabilities){
  const items=Array.isArray(capabilities)?capabilities.slice(0,64):[];
  if(!items.length) return '';
  const namesById=new Map(items.map((item)=>[String(item?.skill_id||''),String(item?.name||'')]));
  return `<div class="persona-capability-list">${items.map((capability)=>{
    const name=String(capability?.name||''), description=String(capability?.description||'');
    const parent=String(capability?.lineage_parent_skill_id||'');
    const parentName=namesById.get(parent)||'';
    return `<article class="persona-capability-detail"><strong>${esc(name)}</strong>`
      +`<p>${esc(description)}</p>`
      +(parentName?`<small>Derived from ${esc(parentName)}</small>`:'')
      +`</article>`;
  }).join('')}</div>`;
}
const recLink=(id,txt)=>`<a href="#" data-act="rec" data-id="${esc(id)}">${esc(txt)}</a>`;
function verificationIdentityDetails(label,value){
  const exact=String(value||''); if(!exact) return '';
  return `<details class="verification-identity"><summary>Verification identity</summary>`
    +`<div class="copy-host">${copyBtn()}<code class="copy-src">${esc(exact)}</code><span class="l2">${esc(label)} · exact signed reference</span></div></details>`;
}
function verificationReferencesDetails(entries){
  const exact=(entries||[]).map(([label,value])=>[String(label||''),String(value||'')])
    .filter(([,value])=>value);
  if(!exact.length) return '';
  return `<details class="verification-identity"><summary>Verification references</summary>`
    +exact.map(([label,value])=>`<div class="copy-host">${copyBtn()}<code class="copy-src">${esc(value)}</code>`
      +`<span class="l2">${esc(label)} · exact signed reference</span></div>`).join('')+`</details>`;
}
function structuredContentHTML(value,{label='Exact response JSON'}={}){
  const projection=structuredContentProjection(value);
  if(!projection.parsed)
    return `<span class="opmsg copy-src">${esc(projection.paragraphs[0]||'')}</span>`;
  const paragraphs=projection.paragraphs.filter((text)=>text!==projection.headline).slice(0,3)
    .map((text)=>`<p>${esc(text)}</p>`).join('');
  const facts=projection.facts.slice(0,10).map((fact)=>
    `<div class="structured-fact"><span>${esc(fact.label)}</span><b>${esc(fact.value)}</b></div>`).join('');
  const items=projection.items.length
    ?`<ul>${projection.items.slice(0,12).map((item)=>`<li>${esc(item)}</li>`).join('')}</ul>`:'';
  return `<div class="structured-content" data-structured-content="readable"><strong>${esc(projection.headline)}</strong>${paragraphs}${facts?`<div class="structured-facts">${facts}</div>`:''}${items}</div>`
    +`<details class="verification-identity structured-raw"><summary>${esc(label)}</summary>`
    +`<div class="copy-host">${copyBtn()}<pre class="ct-pre copy-src">${esc(projection.raw)}</pre></div></details>`;
}
function structuredInlineText(value){
  const projection=structuredContentProjection(value);
  if(!projection.parsed) return projection.paragraphs[0]||'';
  if(projection.headline&&projection.headline!=='Structured response') return projection.headline;
  const fact=projection.facts[0]; if(fact) return `${fact.label}: ${fact.value}`;
  return projection.items[0]||projection.headline;
}
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
  if(!boot) boot=await fetchDiscoveryBootstrap(base);
  if(!boot?.kernel_id) return {ok:false,reason:'missing_kernel_identity'};
  await keysFor(base,boot,{refresh});
  const keyDoc=S.keyDocs.get(key)||{};
  if(keyDoc.kernelId!==boot.kernel_id) return {ok:false,reason:'kernel_key_registry_mismatch'};
  S.boots.set(key,boot);
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
  const ended=endLiveArtifactState(previous,event,meta.verification);
  if(ended) _applyTerminalLiveArtifactEffects(base,key,previous);
  if(ended){ ended.receivedAt=Date.now(); ended.verification={...(ended.verification||{}),
      verified:true,
      signingKeyId:ended.verification?.signingKeyId||meta.verification.signingKeyId,
      accessPolicyRef:ended.verification?.accessPolicyRef||meta.verification.accessPolicyRef,
      outwardTier:ended.verification?.outwardTier||meta.verification.outwardTier,
      terminalEventVerified:true};
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
  for(const [baseKey,hit] of currentRuntimeStatusEntries(now,15000)){
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
    {focusedKernel:S.kernelFocus||'',limit:48,
      includeHistorical:true,latestOutcomeOnly:true},
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
    const authored=authoredArtifactLabelText(file), presentation=_artifactFilePresentation(file.path||name);
    const declaration=_artifactDeclarationDisplayProjection(file);
    const media=artifactMediaPresentation(file,file.path||name).mediaType;
    const declarer=_artifactDeclarationPersonaLabel(declaration,String(state?.snapshot?.node_id||''));
    html+=`<div class="tnode tfile live-file-row" style="padding-left:${depth*14}px"><a class="live-tree-file-action" href="#" data-act="live-file" data-run="${esc(state.run)}" data-workspace="${esc(workspaceId)}" data-path="${esc(file.path)}" title="Open ${esc(presentation.exactPath)}">`
      +`${_artifactFormatTileHTML(presentation)}<span class="current-artifact-copy">${_artifactFileIdentityHTML(presentation,declaration)}`
      +`<small>${esc(artifactTypeLabel(media))} · ${fmtBytes(file.size_bytes)}${declarer?` · Declared by ${esc(declarer)}`:''}${authored?` · ${esc(authored)}`:''}</small></span>`
      +`<span class="current-artifact-preview">Open file →</span></a></div>`;
  }
  return html;
}
function _isAuthenticatedActiveCallCapture(capture,{ended=false}={}){
  return !ended
    &&capture?.schema==='personaos-live-artifact-capture-boundary/1'
    &&capture.state==='authenticated_active_native_call_observation'
    &&capture.in_call_file_streaming===true&&capture.provisional===true;
}
function _activeCallCaptureBadgeHTML(active){
  return active
    ?`<span class="transport-badge live-capture-badge" title="Kernel-authenticated workspace observation during an active native model call; provisional until call completion.">ACTIVE CALL CAPTURE · PROVISIONAL</span>`:'';
}
function liveArtifactsHTML(base,run){
  const state=liveArtifactState(base,run);
  if(!state) return `<div class="live-artifacts waiting"><div class="live-artifacts-head"><span class="loading-inline">waiting for a workspace snapshot</span><span class="transport-badge">AWAITING KERNEL-SIGNED SNAPSHOT</span></div><div class="l2">Polling every 3 seconds; only snapshots and SSE events whose Ed25519 signatures check are applied.</div></div>`;
  const snap=state.snapshot||{}; const ch=state.changes;
  const changed=ch.baseline?'<span class="l2">baseline snapshot</span>'
    : `<span class="live-change c-created">+${ch.created.length} created</span><span class="live-change c-modified">${ch.modified.length} modified</span><span class="live-change c-deleted">-${ch.deleted.length} deleted</span>`;
  const changeRows=ch.baseline?'':[...ch.created.map((x)=>['created',x]),...ch.modified.map((x)=>['modified',x]),...ch.deleted.map((x)=>['deleted',x])]
    .slice(0,12).map(([kind,file])=>`<div class="live-change-row ${kind}" title="${esc(file.sha256||'')}"><span>${esc(file.path)}</span><small>${esc(kind)}</small></div>`).join('');
  const wsMeta=new Map((snap.workspaces||[]).map((w)=>[w.workspace_id,w]));
  const byWs=new Map(); for(const file of state.files.values()) (byWs.get(file.workspace_id)||byWs.set(file.workspace_id,[]).get(file.workspace_id)).push(file);
  const workspaces=[...new Set([...(snap.workspaces||[]).map((w)=>w.workspace_id),...byWs.keys()])].sort();
  const finalizedBootstrap=state.verification?.immutableFinalizedBootstrap===true;
  const capture=snap.capture_boundary;
  const activeCallCapture=_isAuthenticatedActiveCallCapture(capture,{ended:state.ended});
  const captureBadge=_activeCallCaptureBadgeHTML(activeCallCapture);
  const signedTerminalFields=state.ended?[
    state.terminalState?`state ${state.terminalState}`:'',
    state.terminalStatus?`status ${state.terminalStatus}`:'',
  ].filter(Boolean):[];
  const trees=workspaces.map((workspaceId)=>{ const w=wsMeta.get(workspaceId)||{}; const files=byWs.get(workspaceId)||[];
    const pid=_shortId(w.persona_id||files[0]?.persona_id), kernel=snap.node_id||kernelForBase(base);
    const label=_nameFor(pid,kernel)||pid||workspaceId;
    const workspaceState=state.ended?'final snapshot':(w.state||'run_active').replace(/_/g,' ');
    return `<section class="live-workspace"><div class="live-workspace-head"><span title="${esc(workspaceId)}"><b>${esc(label)}</b> · personal worktree</span><span class="${!state.ended&&w.state==='model_call_active'?'ok':'l2'}">${esc(workspaceState)} · ${files.length} file${files.length===1?'':'s'}</span></div>`
      +`<div class="atree">${_renderLiveTreeNode(_liveTreeBuild(files),'',0,state,workspaceId)||'<div class="l2">No files were captured in this signed run snapshot.</div>'}</div></section>`;
  }).join('');
  const revision=String(state.revision||'');
  const terminalTitle=finalizedBootstrap?'Run finalized · final workspace':'Run ended · final workspace';
  const terminalNote=finalizedBootstrap?'Immutable finalized-snapshot signature checked':'Terminal-event signature checked';
  return `<div class="live-artifacts verified${state.ended?' ended':''}" role="status" aria-live="polite" aria-atomic="false"><div class="live-artifacts-head"><span><span class="livedot2"></span><b>${state.ended?terminalTitle:'Live workspaces'}</b> · ${snap.indexed_file_count??state.files.size} indexed</span><span class="live-artifacts-badges">${captureBadge}<span class="transport-badge verified">WORKSPACE SNAPSHOT · SIGNATURE CHECKED</span></span></div>`
    +(state.ended?`<div class="fv-note"><span class="transport-badge verified live-terminal-badge">SIGNED TERMINAL${signedTerminalFields.length?` · ${esc(signedTerminalFields.join(' · '))}`:''}</span>. ${terminalNote}${state.endedAt?` · ${esc(_friendlyInstant(state.endedAt)||state.endedAt)}`:''}. Polling stopped; this is the final captured workspace revision.</div>`:'')
    +`<div class="live-revision"><span>${changed}</span><span title="${esc(revision)}">current signed revision</span></div>`
    +(changeRows?`<div class="live-change-list">${changeRows}</div>`:'')
    +(snap.truncated?`<div class="fv-warn">Snapshot truncated: ${esc(snap.omitted_file_count||0)} file(s) omitted by node or browser limits.</div>`:'')
    +trees+`<div class="live-integrity-note"><b>Workspace snapshot only · no artifact meaning or review state is inferred.</b> Snapshot metadata is Ed25519 signature-checked against the node kernel key. Opened file bytes are separately SHA-256 checked against the exact signed hash before rendering.</div></div>`;
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
  answer:'answering',
  artifact_review:'reviewing artifact evidence',
  artifact_generation:'building artifacts',artifact_revision:'revising artifacts'};
// MODEL-PER-ROLE rollup: PersonaOS resolves a DIFFERENT model per role/purpose
// (EnvironmentModelRegistry), so summarise the distinct models a persona/env used
// → the roles/purposes each served, busiest first, as mono <code> chips. Honest:
// pure live telemetry; renders nothing when idle.
const _modelLabel=(value)=>{ const v=String(value||'').trim(); return /^[a-z0-9][a-z0-9._:/+@-]{0,95}$/i.test(v)?v:'model unavailable'; };
const _modelFacet=(value)=>String(value??'').trim();
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
  if(!models||!models.length) return '<div class="l2">No model-assisted work was observed recently.</div>';
  // A persona legitimately produces, repairs AND evolves its own tactics — so SUMMARISE
  // its recent model calls by PURPOSE with a count (newest purpose first), instead of a
  // repeating row per call that reads like a glitch ("repairing candidate" ×6 in a row).
  const byP=new Map(); let i=0;
  for(const m of models){ const k=_modelFacet(m.purpose)||'model';
    const e=byP.get(k)||{n:0,model:_modelLabel(m.model),role:_modelFacet(m.role),seen:i}; e.n++; e.model=_modelLabel(m.model); if(_modelFacet(m.role)) e.role=_modelFacet(m.role); e.seen=i++; byP.set(k,e); }
  const order=[...byP.entries()].sort((a,b)=>b[1].seen-a[1].seen);   // most-recently-used purpose first
  return order.map(([p,e])=>{
    const lbl=humanActivityPresentation('MODEL_CALL',{purpose:p}).context||PURPOSE_LABEL[p]||p;
    return `<div class="grant" title="model ${esc(e.model)}${e.role&&e.role!=='-'?` · role ${esc(e.role)}`:''}"><span class="l2">${historical?'':'<span class="livedot2"></span>'}${esc(_sentenceStart(lbl))}`
      +`${e.n>1?` <span class="rr-count">×${e.n}</span>`:''}</span>`
      +`<span class="l2">${e.n} step${e.n===1?'':'s'}</span></div>`;
  }).join('');
}
function _terminalModelFailureHTML(failure){
  if(!failure) return '';
  const purpose=humanActivityPresentation('MODEL_CALL',{purpose:failure.purpose}).context
    ||PURPOSE_LABEL[failure.purpose]||String(failure.purpose||'model call').replace(/_/g,' ');
  const detail=[failure.model?`model ${failure.model}`:'',failure.status?`HTTP ${failure.status}`:'']
    .filter(Boolean).join(' · ');
  return `<div class="model-failure" role="status"><div><span>${icon('warn','ico-sm')}</span>`
    +`<b>A work step needs attention</b><small>${esc(_sentenceStart(purpose))}</small></div>`
    +(failure.reason?`<p>${esc(failure.reason)}</p>`:'')
    +(detail?`<details class="activity-technical"><summary>Technical details</summary><div><code>${esc(detail)}</code><span class="ix-trust transport">OBSERVED LIVE</span></div></details>`:'')+`</div>`;
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
      +`<div class="lm"><div class="lmv ${s.lifecycle_state==='ACTIVE'?'ok':''}">${esc(s.lifecycle_state==='ACTIVE'?'Available':_sentenceStart(String(s.lifecycle_state||'observed').replace(/_/g,' ')))}</div><div class="lmk">availability</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.experience_tasks??0)}</div><div class="lmk">tasks worked</div></div>`
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
    h+=`<div class="sublabel">Current participation</div>`
      +kv('Task',esc(_humanTaskExecutionState(rt.task_execution_state||'not_participating')))
      +kv('Model-assisted step',esc(rt.llm_execution_state==='not_currently_calling'?'Not running now':_sentenceStart(String(rt.llm_execution_state||'not reported').replace(/_/g,' '))));
    const call=rt.current_model_call;
    if(call){ const purpose=humanActivityPresentation('MODEL_CALL',{purpose:call.requested_purpose}).context;
      h+=kv('Working on',`<span class="ok" title="model ${esc(call.model_id||'not reported')}">${esc(_sentenceStart(purpose||call.requested_purpose||'the current task'))}</span>`); }
  }
  if(terminalFailure) h+=`<div class="sublabel">Terminal execution status</div>`
    +_terminalModelFailureHTML(terminalFailure);
  h+=`<div class="sublabel">${running?'Working now':'Recent model-assisted work'}</div>`
    +_liveFeed(d.models,{historical:!running});
  return h;
}
function renderEnvLive(eid,kernel=''){
  const d=S.liveByEnv.get(_environmentRef(eid,kernel).key); if(!d) return '<div class="l2">— no live telemetry yet (idle or not streaming) —</div>';
  let h='';
  const sp=d.spans||[];
  if(sp.length){
    const counts={}; sp.forEach((s)=>{counts[s.kind]=(counts[s.kind]||0)+1;});
    h+=`<div class="sublabel">Recent work</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>
        `<div class="grant"><span class="l2">${esc(_ixHeadline({kind:k,_provenance:{}}))}</span><span class="ok">${esc(v)}</span></div>`).join('');
  }
  h+=`<div class="sublabel">Model-assisted work</div>`+_liveFeed(d.models);
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
    `<span class="env-live-chip ${s.signed?'ok':''}" title="${s.signed?'verified work update':'observed live update'}">${esc(_ixHeadline({kind:s.kind,_provenance:{}}))}</span>`).join('');
  const envRunning=_envRunningNow(b);
  const latestModel=live.models.length?live.models[live.models.length-1]:null;
  const modelPurpose=latestModel
    ?humanActivityPresentation('MODEL_CALL',{purpose:latestModel.purpose}).context:'';
  const model=latestModel
    ? `<span class="env-live-chip ${envRunning?'model':''}" title="model ${esc(latestModel.model||'not reported')}">${envRunning?'<span class="livedot2"></span>Working on ':'Most recently: '}${esc(modelPurpose||PURPOSE_LABEL[latestModel.purpose]||latestModel.purpose||'the task')}</span>`
    : '';
  const state=live.fresh?'Working now':live.recent?'Updated recently':'Earlier work';
  return `<div class="env-live${live.fresh?' hot':''}"><span class="env-live-label">${state}</span>${model}${recent}</div>`;
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
  answer:'answer',verifier:'verify',
  artifact_review:'review artifact evidence',
  artifact_generation:'build artifacts',artifact_revision:'revise artifacts'};
// event-kind → coordination / cross-env / artifact / lifecycle classification + glyph
const COORD_KINDS=new Set(['COORDINATION_SHAPE_EVENT','COORDINATION_SHAPE_ADMITTED','ATTENTION_ALLOCATED',
  'MEMBER_JOINED','ENV_MEMBER_ADMITTED','ENV_MEMBER_RE_ADMITTED','BLACKBOARD_POST','blackboard_post','coordination_signal',
  'coordination_update',
  'PERSONA_COMMUNICATION_INTENT_RECORDED',
  'PERSONA_COMMUNICATION_ROUTE_OBSERVED',
  'PERSONA_COMMUNICATION_AUTHORED','PERSONA_INVITATION_AUTHORED','PERSONA_INVITATION_RESPONSE_AUTHORED',
  'PERSONA_BIRTH_PROPOSAL_AUTHORED','PERSONA_BIRTH_ADMITTED','PERSONA_BIRTH_REFUSED']);
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
const TOOL_KINDS=new Set(['CAPABILITY_PROVISIONED','EXTERNAL_CAPABILITY_ACQUIRED',
  'ENV_MCP_TOOL_REGISTERED','ENV_MCP_TOOL_INVOKED','PROVISIONAL_TOOL_STATUS',
  'PERSONA_ACTION_AUTHORED','PERSONA_ACTION_COMPLETED','PERSONA_ACTION_FAILED']);
// A verdict that did not accept renders in the rejected colour.
const _ixFailed=(kind)=>kind==='TASK_NOT_ACCEPTED'
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
  TASK_COMPLETED:'task-completion event recorded',TASK_ACCEPTED:'task-acceptance event recorded',TASK_NOT_ACCEPTED:'task rejection recorded',
  TASK_CLASSIFIED:'classified task',MODE_ENTRY:'entered mode',MODE_EXIT:'exited mode',
  ENVELOPE_MINTED:'minted envelope',EXPERIENCE_TASK_RECORDED:'recorded experience',
  PROVEN_FACT_RECORDED:'recorded proven fact',COORDINATION_SHAPE_EVENT:'coordinated',
  COORDINATION_SHAPE_ADMITTED:'coordination admitted',ATTENTION_ALLOCATED:'allocated attention',
  MEMBER_JOINED:'joined environment',ENV_MEMBER_ADMITTED:'admitted member',ENV_MEMBER_RE_ADMITTED:'re-admitted member',BLACKBOARD_POST:'posted to blackboard',
  PERSONA_COMMUNICATION_INTENT_RECORDED:'recorded message intent',
  PERSONA_COMMUNICATION_ROUTE_OBSERVED:'observed communication route',
  PERSONA_COMMUNICATION_AUTHORED:'authored message',PERSONA_INVITATION_AUTHORED:'invited persona',
  PERSONA_INVITATION_RESPONSE_AUTHORED:'answered invitation',
  PERSONA_BIRTH_PROPOSAL_AUTHORED:'proposed persona birth',PERSONA_BIRTH_ADMITTED:'admitted persona birth',
  PERSONA_BIRTH_REFUSED:'refused persona birth',
  MODEL_CALL:'model call observed',MODEL_SELECTED:'model selected',MODEL_CALL_SUCCEEDED:'model call succeeded',
  MODEL_CALL_FAILED:'model call failed',LLM_OUTPUT:'produced',LLM_LESSON:'learned',
  PROVISIONAL_ASSISTANT_MESSAGE:'streamed assistant message',PROVISIONAL_PROVIDER_STATUS:'provider status',
  PROVISIONAL_TOOL_STATUS:'tool status',COGNITION_LESSON:'holds lesson',
  COGNITION_TACTIC:'holds tactic',COGNITION_PROVEN_FACT:'holds proven fact',
  EXTERNAL_CAPABILITY_ACQUIRED:'acquired capability',CAPABILITY_PROVISIONED:'provisioned tool',
  ENV_MCP_TOOL_REGISTERED:'mounted tool',ENV_MCP_TOOL_INVOKED:'used tool',
  PERSONA_ACTION_AUTHORED:'action authored',PERSONA_ACTION_COMPLETED:'action completed',
  PERSONA_ACTION_FAILED:'action failed'};
const _ixVerb=(kind)=>IX_VERB[kind]||String(kind||'acted').toLowerCase().replace(/_/g,' ');
function _ixHeadline(event){
  return humanActivityPresentation(event?.kind,event?._provenance||{}).headline;
}
const PUBLIC_ACTIVITY_PROVENANCE_ORDER=Object.freeze([
  'action','actionId','invocation','purpose','model','status','callStatus','role','tool','server','run','task','missionTask','call','event','intent',
  'request','message','parentMessage','sequence','latencyMs','effort','effortSource','environment','persona','scopeId',
  'evidence','dedupe','authority','authorityHash','parentHash','signingKey','authoredAt','startedAt','endedAt','at','snapshotAt',
]);
const PUBLIC_ACTIVITY_CORE_PROVENANCE=new Set([
  'action','actionId','invocation','purpose','model','status','callStatus','role','tool','server','run','task','missionTask','call','event','intent',
  'request','message','parentMessage','sequence','latencyMs','effort','effortSource','environment','authoredAt','startedAt','at','snapshotAt',
]);
const PUBLIC_ACTIVITY_PROVENANCE_LABEL=Object.freeze({
  action:'action',actionId:'action id',invocation:'invocation',purpose:'purpose',model:'model',status:'state',callStatus:'call state',run:'run',task:'task',
  missionTask:'task',call:'call',event:'event',intent:'intent',request:'request',
  message:'message',parentMessage:'parent message',sequence:'seq',latencyMs:'latency ms',
  role:'role',tool:'tool',server:'server',effort:'reasoning',effortSource:'reasoning source',environment:'env',persona:'persona',scopeId:'scope',
  evidence:'evidence',dedupe:'wake key',authority:'authority',authorityHash:'authority hash',
  parentHash:'parent hash',signingKey:'signing key',authoredAt:'authored',
  startedAt:'started',endedAt:'ended',at:'at',snapshotAt:'snapshot',
});
function _boundedActivityProvenanceValue(value){
  if(typeof value==='number'&&Number.isFinite(value)) return String(value);
  return typeof value==='string'&&value.length<=4096?value:'';
}
const PUBLIC_ACTIVITY_REFERENCE_FIELDS=new Set([
  'actionId','invocation','run','task','missionTask','call','event','intent','request','message','parentMessage',
  'evidence','dedupe','authority','authorityHash','parentHash','signingKey','scopeId',
]);
const PUBLIC_ACTIVITY_TIME_FIELDS=new Set(['authoredAt','startedAt','endedAt','at','snapshotAt']);
function _friendlyInstant(value){
  const exact=String(value||''), at=Date.parse(exact); if(!Number.isFinite(at)) return '';
  const local=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(at);
  return `${_ago(at)} · ${local}`;
}
function _taskTextForExactReference(taskReference,runReference,kernel=''){
  const task=String(taskReference||'').trim(), run=String(runReference||'').trim();
  if(!kernel||!task) return '';
  // A nearby run is not authority for this field. When a signed event carries a
  // run reference, its exact lifecycle must bind to this exact task reference;
  // without a run, only an unambiguous task→run projection may supply a label.
  const resolvedRun=run||_verifiedPublicTaskRun(kernel,task);
  const lifecycle=resolvedRun?_verifiedPublicTaskForRun(kernel,resolvedRun):null;
  return lifecycle?.taskId===task?lifecycle.task||'':'';
}
function _taskContextForExactReferences(taskReference,runReference,environmentReference,kernel=''){
  const task=String(taskReference||'').trim(), run=String(runReference||'').trim();
  const environment=environmentIdentity(environmentReference);
  if(!kernel||!task||!run||!environment) return null;
  const lifecycle=_verifiedPublicTaskForRun(kernel,run);
  return lifecycle?.taskId===task
      &&environmentIdentity(lifecycle.environment)===environment
    ?lifecycle:null;
}
function _humanActivityProvenance(field,value,provenance,kernel=''){
  if(PUBLIC_ACTIVITY_TIME_FIELDS.has(field)){
    const friendly=_friendlyInstant(value);
    return friendly?{label:PUBLIC_ACTIVITY_PROVENANCE_LABEL[field]||field,value:friendly,title:value}:null;
  }
  if(field==='environment'){
    // A model-call context carries all three references. Promote its workspace
    // label only when one verified lifecycle binds that exact run, task and env.
    const contextual=provenance?.run&&provenance?.task
      ?_taskContextForExactReferences(provenance.task,provenance.run,value,kernel):null;
    if((provenance?.run||provenance?.task)&&!contextual) return null;
    const environment=contextual?.environment||value;
    return {label:'workspace',value:_environmentNameFor(environment,kernel),title:value};
  }
  if(field==='persona') return {label:'persona',value:_nameFor(value,kernel),title:value};
  if(field==='task'||field==='missionTask'){
    const contextual=provenance?.run&&provenance?.environment
      ?_taskContextForExactReferences(value,provenance.run,provenance.environment,kernel):null;
    const task=contextual?.task
      ||(!(provenance?.run&&provenance?.environment)
        ?_taskTextForExactReference(value,provenance?.run,kernel):'');
    return task?{label:'task',value:_compactHumanLabel(task),title:task}:null;
  }
  // These values remain available in the exact signed document and in the
  // chip tooltip, but a call/run/hash/intent identifier is verification
  // metadata rather than the activity a person came here to read.
  if(PUBLIC_ACTIVITY_REFERENCE_FIELDS.has(field)) return null;
  return {label:PUBLIC_ACTIVITY_PROVENANCE_LABEL[field]||field,value,title:value};
}
function _activityProvenanceFragments(provenance,{full=false,kernel=''}={}){
  if(!provenance||typeof provenance!=='object'||Array.isArray(provenance)) return '';
  const fragments=[], references=[];
  for(const field of PUBLIC_ACTIVITY_PROVENANCE_ORDER){
    if(!full&&!PUBLIC_ACTIVITY_CORE_PROVENANCE.has(field)) continue;
    const source=Array.isArray(provenance[field])?provenance[field]:[provenance[field]];
    for(const raw of source.slice(0,16)){
      const value=_boundedActivityProvenanceValue(raw); if(!value) continue;
      const joinedRun=field==='run'&&provenance.runFromTaskLifecycle===true;
      const human=_humanActivityProvenance(field,value,provenance,kernel);
      if(!human){
        if(PUBLIC_ACTIVITY_REFERENCE_FIELDS.has(field))
          references.push(`${PUBLIC_ACTIVITY_PROVENANCE_LABEL[field]||field}: ${value}`);
        continue;
      }
      const title=joinedRun
        ?`exact run joined from the independently verified public task lifecycle: ${value}`:human.title;
      fragments.push(`<span class="ix-prov" title="${esc(title)}"><small>${esc(human.label)}</small><code>${esc(human.value)}</code></span>`);
    }
  }
  if(references.length) fragments.push(`<span class="ix-prov" title="${esc(references.join('\n'))}"><small>proof</small><code>${references.length} exact ref${references.length===1?'':'s'}</code></span>`);
  return fragments.join('');
}
function _eventTrustHTML(event){
  return event?.signed===true
    ? `<span class="ix-trust signed" title="${esc(event._trustTitle||'lineage signature asserted by the admitted node frame')}">${esc(event._trustLabel||'SIGNED EVENT')}</span>`
    : `<span class="ix-trust transport" title="${esc(event?._trustTitle||'live node transport frame; not independently signature-verified in this browser')}">${esc(event?._trustLabel||'LIVE FRAME')}</span>`;
}
function _activityTrustBadgeHTML(event){
  return event?.signed===true
    ?`<span class="ix-trust signed" title="${esc(event._trustTitle||'verified signed activity')}">${icon('check','ico-sm')} Verified</span>`
    :`<span class="ix-trust transport" title="${esc(event?._trustTitle||'observed live activity; not independently signature-verified in this browser')}">Observed live</span>`;
}
function _activityPrimaryContextHTML(event,{className='activity-context',kernel=''}={}){
  const provenance=event?._provenance||{}, fragments=[];
  const add=(human)=>{ if(!human||fragments.some((item)=>item.label===human.label&&item.value===human.value)) return;
    fragments.push(human); };
  for(const field of ['task','missionTask','environment']){
    const source=Array.isArray(provenance[field])?provenance[field][0]:provenance[field];
    const value=_boundedActivityProvenanceValue(source); if(!value) continue;
    add(_humanActivityProvenance(field,value,provenance,kernel));
  }
  const duration=friendlyDuration(provenance.latencyMs);
  if(duration) fragments.push({label:'took',value:duration,title:`${provenance.latencyMs} ms`});
  if(!fragments.length) return '';
  return `<span class="${esc(className)}">${fragments.map((item)=>
    `<span class="activity-context-item" title="${esc(item.title||item.value)}"><small>${esc(item.label)}</small><span>${esc(item.value)}</span></span>`).join('')}</span>`;
}
function _activityTechnicalHTML(event,kernel=''){
  const details=_activityProvenanceFragments(event?._provenance,{full:true,kernel});
  const trust=_eventTrustHTML(event);
  if(!details&&!trust) return '';
  return `<details class="activity-technical"><summary>Verification & technical details</summary><div>${trust}${details}</div></details>`;
}
function _activityProvenanceHTML(provenance,{className='ix-provenance',prepend='',full=false,kernel=''}={}){
  const fragments=_activityProvenanceFragments(provenance,{full,kernel});
  return fragments||prepend?`<span class="${esc(className)}">${prepend}${fragments}</span>`:'';
}
function _eventTimeHTML(event){
  const provenance=event?._provenance||{};
  const exact=String(provenance.at||provenance.startedAt||provenance.snapshotAt||event?.at||'');
  const valid=Number.isFinite(Date.parse(exact));
  const label=_ago(event?._t||Date.now());
  return `<time${valid?` datetime="${esc(exact)}" title="${esc(exact)}"`:''}>${esc(label)}</time>`;
}
// per-row feed kind glyph keyed to the _ixClass lane (inherits the lane colour via
// currentColor on .ix-kind). One stroked icon per lane — no colour emoji.
const _IX_GLYPH={think:'lesson',coord:'arrow',verify:'check',artifact:'task',tool:'tool',crossenv:'arrow',activity:'dot'};
const _ixGlyph=(cls)=>icon(_IX_GLYPH[cls]||'dot','ico-sm ix-glyph');
const _ago=(t)=>{const s=Math.max(0,(Date.now()-t)/1000|0);return s<5?'now':s<60?s+'s ago':s<3600?(s/60|0)+'m ago':s<86400?(s/3600|0)+'h ago':(s/86400|0)+'d ago';};
const _PERSONA_NAME=new Map();   // kernel-qualified persona key -> friendly name
function _personaTechnicalToken(sid=''){
  return _shortId(sid).replace(/[^A-Za-z0-9]/g,'').slice(0,6).toUpperCase();
}
const _personaAlias=()=> 'Forming identity';
function _personaDisplayNameCandidate(value,sid=''){
  const name=typeof value==='string'?value.trim():'', id=_shortId(sid||'');
  if(!name||name===id||name===`persona:${id}`
      ||(name.startsWith('did:personaos:')&&_shortId(name)===id)) return '';
  return name;
}
function _personaNameRolePresentation(value,sid=''){
  const exactName=_personaDisplayNameCandidate(value,sid);
  if(!exactName) return {name:_personaAlias(sid),embeddedRole:'',exactName:''};
  return {name:exactName,embeddedRole:'',exactName};
}
const _displayPersonaName=(value,sid='')=>
  _personaNameRolePresentation(value,sid).name;
function _personaCharacteristicValue(value,depth=0){
  if(depth>3||value===null||value===undefined) return '';
  if(typeof value==='string') return value.trim().slice(0,900);
  if(typeof value==='boolean') return value?'Yes':'No';
  if(typeof value==='number'&&Number.isFinite(value)) return String(value);
  if(Array.isArray(value)) return value.slice(0,8)
    .map((item)=>_personaCharacteristicValue(item,depth+1)).filter(Boolean).join(' · ').slice(0,900);
  if(typeof value==='object') return Object.entries(value).slice(0,8)
    .map(([key,item])=>{ const text=_personaCharacteristicValue(item,depth+1);
      return text?`${humanizeMachineKey(key)}: ${text}`:''; })
    .filter(Boolean).join(' · ').slice(0,900);
  return '';
}
function _personaCharacteristicRows(characteristics,{name='',limit=8}={}){
  if(!characteristics||typeof characteristics!=='object'||Array.isArray(characteristics)) return [];
  const exactName=String(name||'').trim(), rows=[];
  const entries=Object.entries(characteristics);
  const presentationOrder=['role','description','traits'];
  const ordered=[
    ...presentationOrder.flatMap((field)=>entries.filter(([key])=>key.toLowerCase()===field)),
    ...entries.filter(([key])=>!presentationOrder.includes(key.toLowerCase())),
  ];
  for(const [key,value] of ordered){
    if(isTechnicalKey(key)) continue;
    const text=_personaCharacteristicValue(value);
    if(!text||text===exactName) continue;
    rows.push({label:humanizeMachineKey(key),value:text});
    if(rows.length>=limit) break;
  }
  return rows;
}
function _personaCharacteristicHeadline(characteristics,name=''){
  return _personaCharacteristicRows(characteristics,{name,limit:1})[0]||null;
}
function _personaCharacteristicsHTML(characteristics,{name='',limit=8,compact=false}={}){
  const rows=_personaCharacteristicRows(characteristics,{name,limit});
  if(!rows.length) return '';
  if(compact) return rows.map((row,index)=>index===0
    ?`<p><b>${esc(row.label)}</b> · ${esc(row.value)}</p>`
    :`<div class="pc-working-style"><b>${esc(row.label)}</b><span>${esc(row.value)}</span></div>`).join('');
  return `<div class="persona-about-view">${rows.map((row)=>
    `<div><b>${esc(row.label)}</b><span>${esc(row.value)}</span></div>`).join('')}</div>`;
}
const _personaMonogram=(value,sid='')=>{ const name=_personaDisplayNameCandidate(value,sid);
  if(name){ const parts=_personaNameRolePresentation(name,sid).name.split(/\s+/).filter(Boolean); return ((parts[0]?.[0]||'')+(parts.length>1?(parts.at(-1)?.[0]||''):(parts[0]?.[1]||''))).toUpperCase(); }
  return _personaTechnicalToken(sid).slice(0,2)||'ID'; };
function _nameFor(value,kernel=''){ const ref=_personaRef(value,kernel);
  return _displayPersonaName(_PERSONA_NAME.get(ref.key),ref.sid); }
function providerVerifiedPersonaObservation(personaKey){
  const ref=_personaRef(personaKey), record=S.personaDiscoveryByKey.get(ref.key);
  const identity=signedPersonaIdentity(record);
  if(record?.kind!=='persona'||identity?.canonicalId!==ref.sid) return null;
  const lifecycle=personaLifecycleProjection(S.personaDiscoveryByKey,ref.key);
  const identityVerified=verifiedPersonaIdentityPresent(S.personaDiscoveryByKey,ref.key);
  const identityProofState=identityVerified?'verified'
    :(lifecycle?.materializationState==='pending'
      ||record._personaLifecycleObservationState==='pending'?'pending':'refused');
  return {ref,record,identity,lifecycle,identityVerified,identityProofState};
}
function _personaAuthoredNameForObservation(observation){
  const field=observation?.lifecycle?.identityFields?.name;
  return observation?.identityVerified===true&&field?.state==='materialized'
    &&field?.personaAuthored===true
    ?_personaDisplayNameCandidate(
      observation.record?._personaParticipationName,observation.ref?.sid):'';
}
function _signedPersonaNameFor(value,kernel=''){ const ref=_personaRef(value,kernel);
  const observation=providerVerifiedPersonaObservation(ref.key);
  return _displayPersonaName(_personaAuthoredNameForObservation(observation),ref.sid); }
function _isMechanicalEnvironmentName(value,sid=''){
  const name=String(value||'').trim(), id=environmentIdentity(sid||'');
  return !name||['env','environment'].includes(name.toLowerCase())||name===id||name===`env:${id}`||name.startsWith('did:personaos:');
}
function _compactHumanLabel(value,limit=88){
  const text=String(value||'').normalize('NFC').replace(/\s+/gu,' ').trim();
  const chars=[...text],maximum=Math.max(32,Math.min(160,Number(limit)||88));
  if(chars.length<=maximum) return text;
  const visible=chars.slice(0,maximum+1).join('');
  const punctuation=[...visible.matchAll(/[.!?;:](?=\s|$)/gu)].map((match)=>match.index+1)
    .filter((index)=>index>=Math.floor(maximum*.55)&&index<=maximum);
  let end=punctuation.at(-1)||visible.lastIndexOf(' ',maximum);
  if(end<Math.floor(maximum*.55)) end=maximum;
  return `${visible.slice(0,end).replace(/[\s,;:.-]+$/u,'')}…`;
}
function _environmentNameFor(value,kernel=''){
  const ref=_environmentRef(value,kernel), candidateNames=new Set(), names=new Set();
  const taskIds=new Set(), tasks=new Set();
  for(const id of (S.order||[])){
    const record=S.recs.get(id); if(ref.kernel!=='@unknown'&&record?._kernel!==ref.kernel) continue;
    if(record?.kind==='env'&&environmentIdentity(_envSid(record)||record.did)===ref.sid){
      const label=String(record.label||'').trim();
      if(!_isMechanicalEnvironmentName(label,ref.sid)) candidateNames.add(label);
    }
    const lifecycle=record?.kind==='task'?publicTaskLifecycleProjection(record):null;
    if(environmentIdentity(lifecycle?.environment)===ref.sid){
      if(typeof lifecycle.taskId==='string'&&lifecycle.taskId.trim()) taskIds.add(lifecycle.taskId.trim());
      if(typeof lifecycle.task==='string'&&lifecycle.task.trim()) tasks.add(lifecycle.task.trim());
    }
  }
  // An env export may use its exact bound task reference as a placeholder label.
  // Equality to the verified lifecycle is authority, not an identifier pattern.
  for(const label of candidateNames) if(!taskIds.has(label)) names.add(label);
  if(names.size===1){ const name=names.values().next().value;
    return tasks.has(name)?`Workspace for ${_compactHumanLabel(name)}`:_compactHumanLabel(name,104); }
  if(tasks.size===1){ const task=tasks.values().next().value;
    return `Workspace for ${_compactHumanLabel(task)}`; }
  return 'Shared workspace';
}
// This detector is deliberately narrower than the signed mechanical run
// projection below: it answers only whether a model call is active right now.
// Prefer exact active-call rows. A freshly verified per-persona entity document
// is also authoritative for its own `running_llm` bit; that small signed lane
// arrives before the much larger aggregate snapshot. Its short presence lease
// prevents an old entity document from keeping a card active.
function _runningNow(value,kernel=''){
  const ref=_personaRef(value,kernel);
  if(_activeModelCallsForPersona(ref.key).length) return true;
  const live=S.liveByPersona.get(ref.key), receivedAt=Number(live?.receivedAt)||0;
  return live?.stale!==true&&live?.summary?.running_llm===true
    &&receivedAt>0&&(Date.now()-receivedAt)<30000;
}
function _modelFresh(value,models,kernel=''){
  const ref=_personaRef(value,kernel), seen=S.lastModelSeenAt?.get(ref.key)||0;
  return !!(models&&models.length) && !!seen && (Date.now()-seen)<300000;
}
function _taskLifecycleRecordOrder(record,lifecycle){
  const recordId=String(record?.record_id||record?.card_id||'');
  const ulid=/^rec:([0-9A-HJKMNP-TV-Z]{26})$/.exec(recordId)?.[1]||'';
  return `${ulid?'2':'1'}${ulid||String(lifecycle?.run||'')}`;
}
function _latestTaskLifecycle(kernel,{task='',environment=''}={}){
  const taskId=String(task||''), envId=environmentIdentity(environment), matches=[];
  for(const id of (S.order||[])){
    const record=S.recs.get(id); if(record?._kernel!==kernel) continue;
    const lifecycle=publicTaskLifecycleProjection(record); if(!lifecycle) continue;
    if(taskId&&lifecycle.taskId!==taskId) continue;
    if(!taskId&&envId&&environmentIdentity(lifecycle.environment)!==envId) continue;
    matches.push({lifecycle,order:_taskLifecycleRecordOrder(record,lifecycle)});
  }
  matches.sort((left,right)=>left.order.localeCompare(right.order));
  return matches.at(-1)?.lifecycle||null;
}
const _MECHANICAL_QUIESCENT_TASK_STATES=new Set([
  'persona_continuation_unbound',
]);
const _MECHANICAL_RESOURCE_PAUSED_TASK_STATES=new Set([
  'budget_exhausted','timed_out','task_run_not_quiescent',
  'bounded_wait_ended_before_idle','task_run_quiescence_timeout',
  'run_idle_observer_unavailable',
]);
const _MECHANICAL_CANCELLED_TASK_STATES=new Set([
  'operator_terminated','run_cancelled','task_run_cancelled',
]);
function _mechanicalRunProjection(exactState,{activeCall=false,currentExecution=false,
  source='signed task lifecycle'}={}){
  const exact=String(exactState||'');
  if(activeCall) return {key:'running',label:'Running',exactState:exact,
    detail:'A current model call is mechanically active.',source:'active model call'};
  if(_MECHANICAL_CANCELLED_TASK_STATES.has(exact))
    return {key:'cancelled',label:'Cancelled',exactState:exact,
      detail:'The run lifecycle records cancellation.',source};
  if(_MECHANICAL_RESOURCE_PAUSED_TASK_STATES.has(exact))
    return {key:'resource-paused',label:'Resource-paused',exactState:exact,
      detail:'The run lifecycle records a transport or resource pause.',source};
  if(_MECHANICAL_QUIESCENT_TASK_STATES.has(exact))
    return {key:'quiescent',label:'Quiescent',exactState:exact,
      detail:'No persona continuation is currently bound.',source};
  if(currentExecution)
    return {key:'running',label:'Running',exactState:exact,
      detail:'The run lifecycle records active execution.',source};
  if(exact==='event_driven_handoff')
    return {key:'continuation-bound',label:'Continuation bound',exactState:exact,
      detail:'A signed persona continuation is mechanically bound.',source};
  return {key:'unavailable',label:'Run state unavailable',exactState:exact,
    detail:'No current mechanical run category is available.',
    source:exact?source:'no current lifecycle'};
}
function _taskLifecycleForPersonaWork(model,kernel='',acts=[],personaKey='',workState=null){
  if(!kernel) return null;
  const activeCall=_activeModelCallsForPersona(personaKey,kernel).at(-1)||null;
  let lifecycle=activeCall?.run_id
    ?_verifiedPublicTaskForRun(kernel,activeCall.run_id):null;
  if(!lifecycle&&(workState?.task_id||workState?.environment_id))
    lifecycle=_latestTaskLifecycle(kernel,{task:workState?.task_id||'',
      environment:workState?.environment_id||''});
  if(!lifecycle&&model?.run) lifecycle=_verifiedPublicTaskForRun(kernel,model.run);
  if(!lifecycle&&model?.task){
    const run=_verifiedPublicTaskRun(kernel,model.task);
    if(run) lifecycle=_verifiedPublicTaskForRun(kernel,run);
  }
  // Some aggregate model events intentionally omit task/run identifiers. In
  // that case bind the model observation to the persona's newest exact
  // task-scoped activity, then to the latest signed lifecycle for that task.
  // Only if no task-scoped event survived the bounded activity window do we
  // fall back to the exact workspace id carried by the model event. The card
  // says "workspace task" because that fallback proves environment outcome,
  // not sole authorship by this persona.
  if(!lifecycle){
    const task=[...(acts||[])].reverse()
      .filter((event)=>event?.actor_kind==='persona'
        &&_eventPersonaKey(event,event.actor_id)===personaKey)
      .map((event)=>String(event?._provenance?.task||'')).find(Boolean)||'';
    if(task||model?.environment)
      lifecycle=_latestTaskLifecycle(kernel,{task,environment:model?.environment||''});
  }
  return lifecycle;
}
function _personaMechanicalRunProjection(model,kernel='',acts=[],personaKey='',workState=null){
  const activeCalls=_activeModelCallsForPersona(personaKey,kernel);
  const lifecycle=_taskLifecycleForPersonaWork(
    model,kernel,acts,personaKey,workState);
  const exactState=String(lifecycle?.state||'');
  return _mechanicalRunProjection(exactState,{activeCall:activeCalls.length>0,
    currentExecution:lifecycle?.currentExecution===true,
    source:'signed task lifecycle'});
}
// face notes are for humans: verification plumbing (hashes, receipts, paths,
// signatures) stays in the dossier and the drawer, not on the card face
const FACE_TECHNICAL_KEY=/(?:^|_)(?:sha256|hash|receipt|path|url|uri|signature|sig|nonce|token|key|did|urn)(?:$|_)/i;
function _personaWorkNoteValueHTML(value,{compact=false,depth=0}={}){
  if(value===null||typeof value!=='object'){
    const text=value===null?'null':String(value);
    // compact faces keep scalars to a readable sentence; the dossier and the
    // drawer carry the exact full-length values
    return `<span class="work-note-scalar"${compact&&text.length>220?` title="${esc(text)}"`:''}>${esc(compact?_compactHumanLabel(text,220):text)}</span>`;
  }
  const maximum=compact?4:32;
  if(Array.isArray(value)){
    const rows=value.slice(0,maximum);
    return `<ul class="work-note-list">${rows.map((item)=>`<li>${_personaWorkNoteValueHTML(item,{compact,depth:depth+1})}</li>`).join('')}`
      +(value.length>rows.length?`<li class="work-note-more">+${value.length-rows.length} more values</li>`:'')+'</ul>';
  }
  const entries=Object.entries(value);
  const rows=entries.filter(([key])=>!(compact&&FACE_TECHNICAL_KEY.test(key))).slice(0,maximum);
  const hiddenCount=compact?entries.length-rows.length:Math.max(0,entries.length-rows.length);
  if(!rows.length) return compact
    ?'<span class="work-note-more">Full details in the dossier</span>'
    :'<span class="work-note-empty">Empty note</span>';
  // compact faces flatten nested mappings into inline key/value chips so a
  // card face stays scannable; the full nested tree renders in the dossier
  if(compact&&depth>=1)
    return `<span class="work-note-inline">${rows.map(([key,item])=>`<span><b title="${esc(key)}">${esc(humanizeMachineKey(key))}</b>${_personaWorkNoteValueHTML(item,{compact,depth:depth+1})}</span>`).join('')}`
      +(hiddenCount>0?`<span class="work-note-more">+${hiddenCount} detail${hiddenCount===1?'':'s'} in dossier</span>`:'')+'</span>';
  return `<dl class="work-note-fields">${rows.map(([key,item])=>`<div><dt title="${esc(key)}">${esc(humanizeMachineKey(key))}</dt><dd>${_personaWorkNoteValueHTML(item,{compact,depth:depth+1})}</dd></div>`).join('')}`
    +(hiddenCount>0?`<div class="work-note-more"><dt>More</dt><dd>+${hiddenCount} field${hiddenCount===1?'':'s'} in the full dossier</dd></div>`:'')+'</dl>';
}
function _personaCausalDispositionHTML(disposition,{compact=false,mechanical=null}={}){
  if(!disposition||typeof disposition!=='object') return '';
  const rationale=String(disposition.rationale||'').trim();
  if(disposition.kind==='no_successor')
    return `<div class="work-note-next"><span>Persona-chosen next step</span>`
      +`<strong>No immediate successor requested</strong>`
      +`<small>This scheduling choice is not evidence that the task is complete.</small>`
      +(rationale?`<small><b>Persona's reason:</b> ${esc(rationale)}</small>`:'')+'</div>';
  if(disposition.kind!=='immediate_wake') return '';
  const label=_sentenceStart(humanizeMachineKey(disposition.wake_kind||'continue'));
  const selectedPaths=Array.isArray(disposition.model_input_paths)
    ?disposition.model_input_paths.filter((value)=>typeof value==='string'&&value):[];
  const resourcePaused=mechanical?.key==='resource-paused';
  return `<div class="work-note-next"><span>Persona-chosen next step</span>`
    +`<strong>${esc(label)}</strong>`
    +_personaWorkNoteValueHTML(disposition.payload||{},{compact})
    +(rationale?`<small><b>Persona's reason:</b> ${esc(rationale)}</small>`:'')
    +(selectedPaths.length?`<small>${selectedPaths.length} exact workspace ${selectedPaths.length===1?'file':'files'} selected for observation on the next authorized turn.</small>`:'')
    +(resourcePaused?'<small>Waiting for signed run resources; this request is preserved, but no model call is currently authorized by it.</small>':'')+'</div>';
}
function _personaWorkNoteComparisonHTML(state,mechanical,{compact=false}={}){
  if(!state||typeof state!=='object') return '';
  const authoredAt=_friendlyInstant(state.authored_at);
  const mechanicalState=mechanical||{key:'unavailable',label:'Run state unavailable',
    exactState:'',detail:'No current signed mechanical run category is available.',
    source:'no current lifecycle'};
  return `<div class="persona-claim-comparison"><article class="persona-authored-claim">`
    +`<span>What this persona says</span><div class="work-note-meta">Persona-authored claim · revision ${esc(state.revision)}${authoredAt?` · ${esc(authoredAt)}`:''} · ${esc(state.causal_ref_count)} causal ${state.causal_ref_count===1?'reference':'references'}</div>`
    +_personaWorkNoteValueHTML(state.work_note,{compact})
    +_personaCausalDispositionHTML(state.causal_disposition,{compact,mechanical:mechanicalState})+'</article>'
    +`<article class="mechanical-run-observation is-${esc(mechanicalState.key)}"><span>System-observed mechanical state</span>`
    +`<strong>${esc(mechanicalState.label)}</strong><p>${esc(mechanicalState.detail)}</p>`
    +`<small>${esc(mechanicalState.source)}${mechanicalState.exactState?` · exact state ${esc(mechanicalState.exactState)}`:''}</small></article></div>`;
}
function _eventEligibleForRecency(event){
  const at=Number(event?._t);
  return event?._observedState!==true&&Number.isFinite(at)&&at>0;
}
function _latestPersonaActivityForRecency(acts){
  for(let index=(acts?.length||0)-1;index>=0;index--){
    const event=acts[index];
    if(_eventEligibleForRecency(event)) return event;
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
  const observation=providerVerifiedPersonaObservation(ref.key);
  return observation?.identityVerified
    ?observation.record._personaAuthoredRole||_ROLE_NOT_DECLARED
    :_ROLE_NOT_DECLARED;
}
const _coordRoleClass=(role)=>role===_ROLE_NOT_DECLARED?'role-undesignated':'role-declared';
function _humanTaskExecutionState(value){
  return ({
    paused_participant:'Participation paused',run_participant:'Participating',
    not_participating:'Not participating',completed_participant:'Participation ended',
    failed_participant:'Participation failed',
  })[String(value||'')]||String(value||'').replace(/_/g,' ');
}
function _sentenceStart(value){ const text=String(value||'').trim();
  return text?text[0].toUpperCase()+text.slice(1):''; }
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
const _PERSONA_AVATAR_FETCH_CONCURRENCY=4;
const _PERSONA_AVATAR_ATTEMPT_TIMEOUT_MS=15000;
const _PERSONA_AVATAR_MOUNT_TIMEOUT_MS=5000;
const _PERSONA_AVATAR_RETRY_BASE_MS=500;
const _PERSONA_AVATAR_RETRY_MAX_MS=30000;
const _PERSONA_AVATAR_PERSISTENT_CACHE='personaos-verified-persona-avatars-v1';
const _personaAvatarAssets=new Map();
const _personaAvatarJobs=new Map();
const _personaAvatarJobControllers=new Set();
const _personaAvatarFetchQueue=[];
const _personaAvatarMountUrls=new Map();
const _personaAvatarFailures=new Set();
let _personaAvatarCacheBytes=0;
let _personaAvatarActiveFetches=0;
let _personaAvatarPageActive=true;
async function _persistentPersonaAvatarResponse(sourceUrl){
  if(!sourceUrl||!globalThis.caches?.open) return null;
  try{
    const cache=await caches.open(_PERSONA_AVATAR_PERSISTENT_CACHE);
    return await cache.match(sourceUrl)||null;
  }catch(_){ return null; }
}
async function _persistPersonaAvatarResponse(sourceUrl,loaded){
  if(!sourceUrl||!loaded?.bytes||!globalThis.caches?.open) return false;
  try{
    const cache=await caches.open(_PERSONA_AVATAR_PERSISTENT_CACHE);
    await cache.put(sourceUrl,new Response(loaded.bytes,{status:200,headers:{
      'Content-Type':loaded.descriptor.mime_type,
      'Content-Length':String(loaded.descriptor.byte_length),
      'Cache-Control':'public, max-age=31536000, immutable',
    }}));
    const keys=await cache.keys();
    for(const request of keys.slice(0,Math.max(0,keys.length-_PERSONA_AVATAR_CACHE_MAX_ENTRIES)))
      await cache.delete(request);
    return true;
  }catch(_){ return false; }
}
function _personaAvatarBodyTransientError(){
  const error=new Error('avatar body transport temporarily unavailable');
  Object.defineProperty(error,'avatarBodyTransient',{value:true});
  return error;
}
function _personaAvatarRetryDelay(attempt){
  const exponent=Math.min(16,Math.max(0,Number(attempt)||0));
  return Math.min(_PERSONA_AVATAR_RETRY_MAX_MS,_PERSONA_AVATAR_RETRY_BASE_MS*(2**exponent));
}
function _personaAvatarRouteError(error,signal){
  if(error?.avatarBodyTransient===true) return error;
  if(!signal.aborted&&error?.personaAvatarPermanent===true) return error;
  // Response status/redirect, transfer encoding, declared length, and response
  // MIME/body/hash/dimensions are route observations: tunnels, gateways and a
  // just-published body can repair them without a descriptor revision. They
  // remain fail-closed for display while retrying. Only descriptor authority,
  // key and path failures are session-stable.
  return _personaAvatarBodyTransientError();
}
function _drainPersonaAvatarFetchQueue(){
  while(_personaAvatarPageActive
      &&_personaAvatarActiveFetches<_PERSONA_AVATAR_FETCH_CONCURRENCY
      &&_personaAvatarFetchQueue.length){
    const entry=_personaAvatarFetchQueue.shift();
    if(entry.signal.aborted){ entry.reject(_personaAvatarBodyTransientError()); continue; }
    _personaAvatarActiveFetches+=1;
    Promise.resolve().then(entry.run).then(entry.resolve,entry.reject).finally(()=>{
      _personaAvatarActiveFetches=Math.max(0,_personaAvatarActiveFetches-1);
      _drainPersonaAvatarFetchQueue();
    });
  }
}
function _queuePersonaAvatarFetch(run,signal){
  return new Promise((resolve,reject)=>{
    _personaAvatarFetchQueue.push({run,signal,resolve,reject});
    _drainPersonaAvatarFetchQueue();
  });
}
function _rememberPersonaAvatarFailure(key){
  _personaAvatarFailures.delete(key); _personaAvatarFailures.add(key);
  while(_personaAvatarFailures.size>512) _personaAvatarFailures.delete(_personaAvatarFailures.values().next().value);
}
function _personaAvatarRevision(descriptor){
  return descriptor?`${descriptor.sha256}:${descriptor.identity_signature_hex}`:'';
}
function _personaAvatarProviderBase(signedCard){
  return String(signedCard?._providerBase||signedCard?._base||'');
}
function _personaAvatarMountRevision(descriptor,signedCard){
  return descriptor?`${_personaAvatarRevision(descriptor)}:${String(signedCard?._personaIdentityPublicKeyHex||'')}`
    +`:${_personaAvatarProviderBase(signedCard)}`:'';
}
function _personaAvatarFallbackCopy(personaKey,signedCard,state='local'){
  const lifecycle=personaLifecycleProjection(S.personaDiscoveryByKey,_personaRef(personaKey).key);
  const avatarField=lifecycle?.identityFields?.avatar;
  const lifecyclePending=avatarField?.state==='pending'&&avatarField?.personaAuthored===false;
  if(lifecyclePending) return {
    visible:'avatar pending · not persona-authored',
    accessible:'avatar pending · not persona-authored; neutral person silhouette shown',
    lifecycle:'pending',
  };
  if(state==='failed'||signedCard?.avatar) return {
    visible:'portrait unavailable',
    accessible:'neutral person silhouette shown; persona-authored raster avatar unavailable',
    lifecycle:'unavailable',
  };
  return {
    visible:'no persona-authored avatar',
    accessible:'neutral person silhouette shown; no persona-authored raster avatar admitted',
    lifecycle:'absent',
  };
}
function _personaAvatarHTML(personaKey,{identityVerified=false}={}){
  const ref=_personaRef(personaKey);
  // C-OP-16: a stated refusal of the identity requirement is the persona's
  // own claim; the placeholder says so instead of "pending" forever.
  const decline=_verifiedIdentityDecline(ref.key);
  // Avatar shape is inspected synchronously only to make signed descriptor
  // changes observable to the keyed stage diff. No image appears until the
  // asynchronous identity, provider, byte, hash, MIME, and dimension gates pass.
  if(!identityVerified){
    // The deterministic identicon is derived from the id alone; it claims no
    // persona authorship, so it may stand in while the identity proof settles.
    if(decline) return `<span class="pc-avatar" data-avatar-state="identity-pending" data-avatar-lifecycle="declined" aria-label="identity declined by the persona; its stated reason is shown">`
      +`<span class="pc-avatar-placeholder" aria-hidden="true">${identiconSVG(ref.sid)}${_identityDeclineCaptionHTML(decline)}</span></span>`;
    return `<span class="pc-avatar" data-avatar-state="identity-pending" data-avatar-lifecycle="withheld" aria-label="portrait withheld until persona identity proof verifies">`
      +`<span class="pc-avatar-placeholder" aria-hidden="true">${identiconSVG(ref.sid)}<small>identity proof pending · portrait withheld</small></span></span>`;
  }
  const signedCard=S.personaDiscoveryByKey.get(ref.key)||null;
  const descriptor=normalizePersonaAvatar(signedCard?.avatar);
  const state=descriptor?'pending':(signedCard?.avatar?'failed':'local');
  const fallback=_personaAvatarFallbackCopy(ref.key,signedCard,state);
  if(!descriptor&&decline){
    return `<span class="pc-avatar" data-avatar-key="${esc(_domEntityKey(ref.key))}" data-avatar-revision="${esc(_personaAvatarMountRevision(descriptor,signedCard))}" data-avatar-state="${state}" data-avatar-lifecycle="declined" aria-label="identity declined by the persona; its stated reason is shown">`
      +`<span class="pc-avatar-placeholder" aria-hidden="true">${identiconSVG(ref.sid)}${_identityDeclineCaptionHTML(decline)}</span></span>`;
  }
  const placeholderLabel=descriptor?'verifying persona-authored avatar':fallback.visible;
  const avatarLabel=descriptor
    ?'neutral person silhouette shown while persona-authored raster avatar is verified'
    :fallback.accessible;
  return `<span class="pc-avatar" data-avatar-key="${esc(_domEntityKey(ref.key))}" data-avatar-revision="${esc(_personaAvatarMountRevision(descriptor,signedCard))}" data-avatar-state="${state}" data-avatar-lifecycle="${esc(descriptor?'verifying':fallback.lifecycle)}" aria-label="${esc(avatarLabel)}">`
    +`<span class="pc-avatar-placeholder" aria-hidden="true">${identiconSVG(ref.sid)}<small>${esc(placeholderLabel)}</small></span></span>`;
}
async function _decodePersonaAvatarBlob(blob,descriptor,signal=null){
  if(typeof createImageBitmap==='function'){
    let bitmap;
    try{ bitmap=await createImageBitmap(blob); }
    catch(_){ throw _personaAvatarBodyTransientError(); }
    try{
      if(signal?.aborted) throw _personaAvatarBodyTransientError();
      if(bitmap.width!==descriptor.width||bitmap.height!==descriptor.height)
        throw _personaAvatarBodyTransientError();
    }finally{ try{ bitmap.close(); }catch(e){} }
    return;
  }
  if(typeof Image!=='function') throw _personaAvatarBodyTransientError();
  let probeUrl;
  try{ probeUrl=URL.createObjectURL(blob); }
  catch(_){ throw _personaAvatarBodyTransientError(); }
  const probe=new Image();
  try{
    await new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(action)=>{ if(settled) return; settled=true;
        signal?.removeEventListener('abort',onAbort); action(); };
      const onAbort=()=>finish(()=>reject(_personaAvatarBodyTransientError()));
      probe.onload=()=>finish(resolve);
      probe.onerror=()=>finish(()=>reject(_personaAvatarBodyTransientError()));
      if(signal?.aborted){ onAbort(); return; }
      signal?.addEventListener('abort',onAbort,{once:true}); probe.src=probeUrl;
    });
    if(probe.naturalWidth!==descriptor.width||probe.naturalHeight!==descriptor.height)
      throw _personaAvatarBodyTransientError();
  }finally{
    probe.onload=null; probe.onerror=null; URL.revokeObjectURL(probeUrl);
  }
}
function _rememberPersonaAvatarAsset(key,asset){
  const prior=_personaAvatarAssets.get(key);
  if(prior) _personaAvatarCacheBytes-=prior.byteLength;
  _personaAvatarAssets.delete(key); _personaAvatarAssets.set(key,asset);
  _personaAvatarCacheBytes+=asset.byteLength;
  while(_personaAvatarAssets.size>_PERSONA_AVATAR_CACHE_MAX_ENTRIES
      ||_personaAvatarCacheBytes>_PERSONA_AVATAR_CACHE_MAX_BYTES){
    const oldestKey=_personaAvatarAssets.keys().next().value;
    if(oldestKey===undefined||(_personaAvatarAssets.size===1&&oldestKey===key)) break;
    const oldest=_personaAvatarAssets.get(oldestKey); _personaAvatarAssets.delete(oldestKey);
    _personaAvatarCacheBytes-=oldest.byteLength;
  }
  return asset;
}
function _releasePersonaAvatarMountUrl(mount){
  const url=_personaAvatarMountUrls.get(mount);
  if(!url) return;
  _personaAvatarMountUrls.delete(mount); URL.revokeObjectURL(url);
}
function _releaseDisconnectedPersonaAvatarMountUrls(){
  for(const mount of _personaAvatarMountUrls.keys())
    if(!mount.isConnected) _releasePersonaAvatarMountUrl(mount);
}
async function _loadPersonaAvatarAsset(personaKey,signedCard,descriptor){
  const ref=_personaRef(personaKey);
  const signedPersona=signedPersonaIdentity(signedCard);
  if(!signedPersona||signedPersona.canonicalId!==ref.sid)
    throw new Error('signed persona identity binding unavailable');
  const assertedPin=String(signedCard?._personaIdentityPublicKeyHex||'');
  const rememberedPin=String(S.personaIdentityKeys.get(ref.key)||'');
  if(assertedPin&&rememberedPin&&assertedPin!==rememberedPin)
    throw new Error('persona identity key pin changed');
  const pin=assertedPin||rememberedPin;
  const providerBase=_personaAvatarProviderBase(signedCard);
  const sourceUrl=resolvePersonaAvatarBodyUrl(descriptor.body_path,{
    providerBase,pageUrl:location.href,
  });
  const cacheKey=[ref.key,_personaAvatarRevision(descriptor),providerBase,pin].join('\u0000');
  const cached=_personaAvatarAssets.get(cacheKey);
  if(cached){ _personaAvatarAssets.delete(cacheKey); _personaAvatarAssets.set(cacheKey,cached); return cached; }
  if(_personaAvatarFailures.has(cacheKey)) throw new Error('avatar previously refused');
  let job=_personaAvatarJobs.get(cacheKey);
  if(!job){
    const controller=new AbortController(); _personaAvatarJobControllers.add(controller);
    job=_queuePersonaAvatarFetch(async()=>{
      const timeout=globalThis.setTimeout(()=>controller.abort(),_PERSONA_AVATAR_ATTEMPT_TIMEOUT_MS);
      const aborted=new Promise((_,reject)=>{
        if(controller.signal.aborted){ reject(_personaAvatarBodyTransientError()); return; }
        controller.signal.addEventListener('abort',
          ()=>reject(_personaAvatarBodyTransientError()),{once:true});
      });
      const attempt=(async()=>{
        const verifyWith=async(fetchImpl)=>{
          try{
            return await fetchVerifiedPersonaAvatar(descriptor,{
              expectedPersonaId:signedPersona.signedId,pinnedPublicKeyHex:pin,
              providerBase,pageUrl:location.href,fetchImpl,
            });
          }catch(error){
            throw _personaAvatarRouteError(error,controller.signal);
          }
        };
        const persistentAttempt=verifyWith(async(requestUrl)=>{
          if(requestUrl!==sourceUrl) throw _personaAvatarBodyTransientError();
          const response=await _persistentPersonaAvatarResponse(requestUrl);
          if(!response) throw _personaAvatarBodyTransientError();
          return response;
        }).then((loaded)=>({loaded,persistent:true}));
        const peerAttempt=verifyWith(async(requestUrl)=>{
          if(!p2pDataRouteForUrl(requestUrl)) throw _personaAvatarBodyTransientError();
          const bytes=await settleBeforeAbort(fetchP2PArtifactBytes(
            requestUrl,`sha256:${descriptor.sha256}`,descriptor.byte_length),controller.signal,null);
          if(bytes?.byteLength!==descriptor.byte_length) throw _personaAvatarBodyTransientError();
          return new Response(bytes,{status:200,headers:{
            'Content-Type':descriptor.mime_type,
            'Content-Length':String(descriptor.byte_length),
          }});
        }).then((loaded)=>({loaded,persistent:false}));
        const httpAttempt=verifyWith(async(requestUrl,init={})=>{
          try{
            const response=await fetch(requestUrl,secureFetchInit(requestUrl,{
              ...init,signal:controller.signal,
            }));
            if(response?.ok) return response;
          }catch(_){ /* the peer-bound public-data route remains available */ }
          throw _personaAvatarBodyTransientError();
        }).then((loaded)=>({loaded,persistent:false}));
        let winner;
        try{
          winner=await Promise.any([persistentAttempt,peerAttempt,httpAttempt]);
        }catch(error){
          const failures=Array.from(error?.errors||[error]);
          const refusal=failures.find((failure)=>failure?.avatarBodyTransient!==true);
          if(refusal) throw refusal;
          throw _personaAvatarBodyTransientError();
        }
        const {loaded}=winner;
        if(controller.signal.aborted) throw _personaAvatarBodyTransientError();
        const observedKey=loaded.descriptor.identity_public_key_hex;
        const currentPin=S.personaIdentityKeys.get(ref.key)||'';
        if(currentPin&&currentPin!==observedKey) throw new Error('persona identity key pin mismatch');
        const blob=new Blob([loaded.bytes],{type:loaded.descriptor.mime_type});
        await _decodePersonaAvatarBlob(blob,loaded.descriptor,controller.signal);
        if(controller.signal.aborted) throw _personaAvatarBodyTransientError();
        if(!winner.persistent) await _persistPersonaAvatarResponse(loaded.sourceUrl,loaded);
        S.personaIdentityKeys.set(ref.key,observedKey);
        return _rememberPersonaAvatarAsset(cacheKey,Object.freeze({
          blob,byteLength:loaded.descriptor.byte_length,
          width:loaded.descriptor.width,height:loaded.descriptor.height,
        }));
      })();
      try{ return await Promise.race([attempt,aborted]); }
      finally{ globalThis.clearTimeout(timeout); controller.abort(); }
    },controller.signal).catch((error)=>{
      if(error?.avatarBodyTransient!==true) _rememberPersonaAvatarFailure(cacheKey);
      throw error;
    })
      .finally(()=>{
        _personaAvatarJobControllers.delete(controller);
        if(_personaAvatarJobs.get(cacheKey)===job) _personaAvatarJobs.delete(cacheKey);
      });
    _personaAvatarJobs.set(cacheKey,job);
  }
  return job;
}
function _neutralPersonaAvatar(mount,state='failed'){
  _releasePersonaAvatarMountUrl(mount);
  mount.dataset.avatarState=state;
  const placeholder=document.createElement('span'); placeholder.className='pc-avatar-placeholder';
  placeholder.setAttribute('aria-hidden','true');
  const ref=_personaRef(_entityKeyFromDom(mount.dataset.avatarKey||''));
  const signedCard=S.personaDiscoveryByKey.get(ref.key)||null;
  const fallback=_personaAvatarFallbackCopy(ref.key,signedCard,state);
  mount.dataset.avatarLifecycle=fallback.lifecycle;
  mount.setAttribute('aria-label',fallback.accessible);
  // Deterministic identicon in place of the shared silhouette: stable per-id
  // art with no persona-authorship claim. Markup is generated locally from the
  // hash alone (no remote bytes), so innerHTML carries only our own SVG.
  const identicon=document.createElement('span'); identicon.className='pk-identicon-holder';
  identicon.innerHTML=identiconSVG(ref.sid);
  const label=document.createElement('small'); label.textContent=fallback.visible;
  placeholder.append(identicon,label);
  mount.replaceChildren(placeholder);
}
function _schedulePersonaAvatarRetry(mount,revision){
  if(!_personaAvatarPageActive||!mount.isConnected||mount.dataset.avatarRevision!==revision) return;
  _releasePersonaAvatarMountUrl(mount);
  if(!mount.querySelector('.pc-avatar-placeholder')) _neutralPersonaAvatar(mount);
  const attempt=Math.max(0,Number.parseInt(mount.dataset.avatarRetryAttempt||'0',10)||0);
  const nextAttempt=Math.min(32,attempt+1);
  mount.dataset.avatarRetryAttempt=String(nextAttempt);
  mount.dataset.avatarState='waiting'; mount.dataset.avatarLifecycle='verifying';
  const label=mount.querySelector('.pc-avatar-placeholder small');
  if(label) label.textContent='verifying persona-authored avatar';
  mount.setAttribute('aria-label','neutral person silhouette shown while persona-authored raster avatar transport retries');
  globalThis.setTimeout(()=>{
    if(!_personaAvatarPageActive||!mount.isConnected||mount.dataset.avatarRevision!==revision
        ||mount.dataset.avatarState!=='waiting'
        ||mount.dataset.avatarRetryAttempt!==String(nextAttempt)) return;
    mount.dataset.avatarState='pending';
    _hydratePersonaAvatarMount(mount).catch(()=>{});
  },_personaAvatarRetryDelay(attempt));
}
async function _hydratePersonaAvatarMount(mount){
  if(!_personaAvatarPageActive||!mount?.isConnected||mount.dataset.avatarState!=='pending') return;
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
    if(!_personaAvatarPageActive||!mount.isConnected||mount.dataset.avatarRevision!==revision) return;
    const img=document.createElement('img'); img.alt=''; img.setAttribute('aria-hidden','true');
    img.decoding='async'; img.draggable=false; img.width=asset.width; img.height=asset.height;
    let objectUrl;
    try{ objectUrl=URL.createObjectURL(asset.blob); }
    catch(_){ throw _personaAvatarBodyTransientError(); }
    _releasePersonaAvatarMountUrl(mount); _personaAvatarMountUrls.set(mount,objectUrl);
    const displayTimeout=globalThis.setTimeout(()=>{
      if(mount.isConnected&&mount.contains(img)&&mount.dataset.avatarRevision===revision
          &&mount.dataset.avatarState==='loading') _schedulePersonaAvatarRetry(mount,revision);
    },_PERSONA_AVATAR_MOUNT_TIMEOUT_MS);
    img.addEventListener('load',()=>{
      globalThis.clearTimeout(displayTimeout);
      if(!mount.isConnected||!mount.contains(img)||mount.dataset.avatarRevision!==revision) return;
      mount.dataset.avatarState='ready'; mount.dataset.avatarLifecycle='materialized';
      delete mount.dataset.avatarRetryAttempt;
      mount.setAttribute('aria-label','verified persona-authored raster avatar');
    },{once:true});
    img.addEventListener('error',()=>{
      globalThis.clearTimeout(displayTimeout);
      if(mount.isConnected&&mount.contains(img)&&mount.dataset.avatarRevision===revision)
        _schedulePersonaAvatarRetry(mount,revision);
    },{once:true});
    mount.replaceChildren(img); img.src=objectUrl;
  }catch(e){
    if(!mount.isConnected||mount.dataset.avatarRevision!==revision) return;
    if(!_personaAvatarPageActive){ mount.dataset.avatarState='pending'; return; }
    if(e?.avatarBodyTransient===true){ _schedulePersonaAvatarRetry(mount,revision); return; }
    _neutralPersonaAvatar(mount);
  }
}
function _hydratePersonaAvatars(){
  _releaseDisconnectedPersonaAvatarMountUrls();
  document.querySelectorAll('.pc-avatar[data-avatar-key]').forEach((mount)=>{
    if(mount.dataset.avatarState==='pending') _hydratePersonaAvatarMount(mount).catch(()=>{});
  });
}
window.addEventListener('pagehide',()=>{
  _personaAvatarPageActive=false;
  for(const controller of _personaAvatarJobControllers) controller.abort();
  for(const entry of _personaAvatarFetchQueue.splice(0))
    entry.reject(_personaAvatarBodyTransientError());
  for(const mount of _personaAvatarMountUrls.keys()) _releasePersonaAvatarMountUrl(mount);
  _personaAvatarAssets.clear(); _personaAvatarCacheBytes=0;
});
window.addEventListener('pageshow',()=>{
  _personaAvatarPageActive=true;
  document.querySelectorAll('.pc-avatar[data-avatar-key]').forEach((mount)=>{
    if(['loading','ready','waiting'].includes(mount.dataset.avatarState)) mount.dataset.avatarState='pending';
  });
  _drainPersonaAvatarFetchQueue(); _hydratePersonaAvatars();
});
if(typeof MutationObserver==='function'){
  let cleanupQueued=false;
  new MutationObserver(()=>{
    if(cleanupQueued||!_personaAvatarMountUrls.size) return;
    cleanupQueued=true; queueMicrotask(()=>{ cleanupQueued=false; _releaseDisconnectedPersonaAvatarMountUrls(); });
  }).observe(document.documentElement,{childList:true,subtree:true});
}
function _boundedLatestUnique(rows,keyOf,limit){
  const selected=new Map(); let fallback=0;
  for(const row of (rows||[])){
    if(!row) continue;
    const projected=String(keyOf(row)||''), key=projected||`unkeyed:${fallback++}`;
    if(selected.has(key)) selected.delete(key);
    selected.set(key,row);
    while(selected.size>limit) selected.delete(selected.keys().next().value);
  }
  return [...selected.values()];
}
function _artifactPresentationKey(r){ const L=r?._links||{};
  const hash=String(L.content_hash||r?.content_hash||''), path=String(L.content||r?.path||r?.title||''),
    label=String(r?.label||r?.artifact_id||'');
  return (hash||path||label)?`${hash}\u0000${path}\u0000${label}`:String(r?._storeKey||r?.record_id||r?.did||'');
}
function _artifactDisplayPath(r){
  const L=r?._links||{}, authored=String(r?.path||r?.title||r?.artifact_id||'').trim();
  if(authored) return authored;
  const body=String(L.content||r?.content||r?.package_path||'');
  const marker='/artifacts/package/', index=body.lastIndexOf(marker);
  if(index>=0) return body.slice(index+marker.length);
  return String(r?.label||'').trim()||(body.split('/').filter(Boolean).at(-1)||'artifact');
}
const _ARTIFACT_COMPOUND_EXTENSIONS=Object.freeze([
  'tar.bz2','tar.gz','tar.lz','tar.xz','tar.zst','nii.gz','blend.gz',
]);
const _ARTIFACT_ACRONYMS=Object.freeze(new Map([
  ['api','API'],['bim','BIM'],['cad','CAD'],['cam','CAM'],['csv','CSV'],
  ['dxf','DXF'],['gltf','glTF'],['glb','GLB'],['hv4','HV4'],['ifc','IFC'],
  ['json','JSON'],['mep','MEP'],['obj','OBJ'],['pdf','PDF'],['qa','QA'],
  ['svg','SVG'],['ui','UI'],['ux','UX'],['xml','XML'],
]));
function _artifactExtensionParts(filename){
  const value=String(filename||''), lower=value.toLowerCase();
  const compound=_ARTIFACT_COMPOUND_EXTENSIONS.find((extension)=>lower.endsWith(`.${extension}`));
  if(compound) return {stem:value.slice(0,-compound.length-1),extension:compound};
  const match=/\.([A-Za-z0-9][A-Za-z0-9+_-]{0,15})$/.exec(value);
  return match&&match.index>0
    ?{stem:value.slice(0,match.index),extension:match[1]}
    :{stem:value,extension:''};
}
function _humanizeArtifactSegment(value,{title=false}={}){
  let text=String(value||'').normalize('NFC')
    .replace(/([a-z0-9])([A-Z])/g,'$1 $2')
    .replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  // Expand an actual revision token ("rev C", "rev_C", "revC", "rev2")
  // without corrupting ordinary words that merely begin with those letters,
  // such as "review", "reverse", or "revenue".
  text=text
    .replace(/\b[Rr][Ee][Vv]\s+([A-Za-z0-9]+)\b/g,(_match,suffix)=>`Revision ${suffix}`)
    .replace(/\b(?:rev|Rev)([A-Z0-9][A-Za-z0-9]*)\b/g,(_match,suffix)=>`Revision ${suffix}`);
  const words=text.split(' ').filter(Boolean).map((word,index)=>{
    const acronym=_ARTIFACT_ACRONYMS.get(word.toLowerCase());
    if(acronym) return acronym;
    if(!title) return word;
    return index===0?word.charAt(0).toUpperCase()+word.slice(1):word;
  });
  return words.join(' ')||'Untitled file';
}
function _artifactFilePresentation(path){
  const exactPath=String(path||'artifact').normalize('NFC'), segments=exactPath
    .replace(/\\/g,'/').split('/').filter(Boolean);
  const filename=segments.at(-1)||exactPath||'artifact';
  const parts=_artifactExtensionParts(filename);
  const folders=segments.slice(0,-1).filter((segment,index,array)=>
    !(segment==='artifacts'&&array[index+1]==='package')&&segment!=='package');
  const visibleFolders=folders.slice(-3).map((segment)=>_humanizeArtifactSegment(segment));
  return Object.freeze({
    exactPath,filename,stem:parts.stem,
    title:_humanizeArtifactSegment(parts.stem,{title:true}),
    extension:parts.extension,
    extensionLabel:parts.extension?`.${parts.extension.toUpperCase()}`:'',
    folderLabel:`${folders.length>visibleFolders.length?'… / ':''}${visibleFolders.join(' / ')}`,
  });
}
function _artifactFileIdentityHTML(presentation,declaration={}){
  const item=presentation||_artifactFilePresentation('artifact');
  const authoredTitle=String(declaration?.title||'').trim();
  const primaryTitle=authoredTitle||item.title;
  return `<span class="artifact-file-title" title="${esc(item.exactPath)}"><b>${esc(primaryTitle)}</b>`
    +(item.extensionLabel?`<span class="artifact-extension-badge" aria-label="file format ${esc(item.extensionLabel)}">${esc(item.extensionLabel)}</span>`:'')+'</span>'
    +(authoredTitle?`<span class="artifact-file-location artifact-exact-filename"><small>File</small><span>${esc(item.filename)}</span></span>`:'')
    +(item.folderLabel?`<span class="artifact-file-location"><small>Folder</small><span>${esc(item.folderLabel)}</span></span>`:'');
}
function _artifactFormatTileHTML(presentation){
  const item=presentation||_artifactFilePresentation('artifact');
  const format=(item.extensionLabel||'FILE').replace(/^\./,'');
  return `<span class="artifact-format-tile${format.length>5?' long-format':''}" aria-label="${esc(format)} file format"><small>Format</small><strong>${esc(format)}</strong></span>`;
}
function _artifactExactFormatCountsHTML(rows,pathOf=_artifactDisplayPath){
  const counts=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const presentation=_artifactFilePresentation(pathOf(row));
    const format=presentation.extensionLabel||'NO EXTENSION';
    counts.set(format,(counts.get(format)||0)+1);
  }
  const ordered=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  if(!ordered.length) return '';
  return `<div class="artifact-exact-format-counts" aria-label="Exact file formats in this package">`
    +`<span class="artifact-exact-format-label">Formats</span>`
    +ordered.map(([format,count])=>`<span class="artifact-exact-format-count"><b>${esc(format)}</b><strong>${count}</strong></span>`).join('')
    +`</div>`;
}
const _ARTIFACT_PRESENTATION_GROUPS=Object.freeze([
  Object.freeze({id:'cad',label:'CAD & 3D models',description:'Models, exchange geometry, and fabrication drawings',extensions:new Set(['3dm','3mf','blend','dae','dwg','dxf','fbx','glb','gltf','ifc','iges','igs','obj','ply','scad','skp','step','stl','stp'])}),
  Object.freeze({id:'drawing',label:'Drawings & images',description:'Sheets, diagrams, renders, and visual references',extensions:new Set(['apng','bmp','gif','heic','jpeg','jpg','png','svg','svgz','tif','tiff','webp'])}),
  Object.freeze({id:'document',label:'Documents',description:'Narratives, specifications, reports, and read-me files',extensions:new Set(['doc','docx','html','htm','md','odt','pdf','rtf','txt'])}),
  Object.freeze({id:'data',label:'Data & schedules',description:'Schedules, manifests, structured data, and tables',extensions:new Set(['csv','json','ods','parquet','tsv','xls','xlsx','xml','yaml','yml'])}),
  Object.freeze({id:'package',label:'Packages & exports',description:'Archives and bundled delivery files',extensions:new Set(['7z','bz2','gz','rar','tar','tar.bz2','tar.gz','tar.xz','tar.zst','tgz','xz','zip','zst'])}),
  Object.freeze({id:'code',label:'Code & technical files',description:'Source, configuration, simulations, and fabrication data',extensions:new Set(['asc','brd','c','cc','cir','cpp','css','drl','gbr','gbrjob','ger','go','h','hpp','ibs','ini','java','js','jsx','kicad_dru','kicad_mod','kicad_pcb','kicad_prl','kicad_pro','kicad_sch','kicad_sym','kt','m','mjs','pho','py','rs','s1p','s2p','s3p','s4p','sch','sh','sp','spice','sql','sv','toml','ts','tsx','v','vhd','vhdl','xln'])}),
]);
function _artifactPresentationGroup(path){
  const presentation=_artifactFilePresentation(path), extension=presentation.extension.toLowerCase();
  const group=_ARTIFACT_PRESENTATION_GROUPS.find((candidate)=>candidate.extensions.has(extension));
  return {presentation,group:group||Object.freeze({id:'other',label:'Other files',description:'Additional verified artifacts'})};
}
function _artifactRevisionRank(path){
  const matches=[...String(path||'').matchAll(/(?:^|[^a-z0-9])rev(?:ision)?[\s_-]*([a-z]|\d+)(?=$|[^a-z0-9])/gi)];
  if(!matches.length) return null;
  const token=matches.at(-1)[1].toUpperCase();
  return /^\d+$/.test(token)?Number(token):token.charCodeAt(0)-64;
}
function _artifactPresentationTime(row){
  const links=row?._links||{};
  for(const value of [row?.mtime,row?.modified_at,row?.updated_at,row?.generated_at,row?.created_at,
    links.modified_at,links.updated_at,links.generated_at]){
    const parsed=typeof value==='number'?value:Date.parse(String(value||''));
    if(Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
function _artifactNewestFirst(a,b,pathOf){
  const pathA=String(pathOf(a)||''),pathB=String(pathOf(b)||'');
  const revisionA=_artifactRevisionRank(pathA),revisionB=_artifactRevisionRank(pathB);
  if(revisionA!==null&&revisionB!==null&&revisionA!==revisionB) return revisionB-revisionA;
  const timeA=_artifactPresentationTime(a),timeB=_artifactPresentationTime(b);
  if(timeA!==timeB) return timeB-timeA;
  return pathB.localeCompare(pathA,undefined,{numeric:true,sensitivity:'base'});
}
function _artifactGroupedListHTML(items,{pathOf,render,ariaLabel='Current files'}={}){
  const rows=Array.isArray(items)?items:[];
  if(rows.length<8) return `<div class="current-artifact-list" aria-label="${esc(ariaLabel)}">${rows.map(render).join('')}</div>`;
  const groups=new Map();
  for(const row of rows){
    const projected=_artifactPresentationGroup(pathOf(row));
    const bucket=groups.get(projected.group.id)||{...projected.group,rows:[],formats:new Set()};
    bucket.rows.push(row);
    if(projected.presentation.extensionLabel) bucket.formats.add(projected.presentation.extensionLabel);
    groups.set(projected.group.id,bucket);
  }
  const ordered=[..._ARTIFACT_PRESENTATION_GROUPS.map((group)=>groups.get(group.id)).filter(Boolean),groups.get('other')].filter(Boolean);
  for(const group of ordered) group.rows.sort((a,b)=>_artifactNewestFirst(a,b,pathOf));
  const primary=groups.has('cad')?'cad':ordered[0]?.id;
  const overview=`<div class="artifact-format-overview" aria-label="File groups">${ordered.map((group)=>
    `<span class="artifact-format-summary${group.id==='cad'?' cad':''}"><small>${esc(group.label)}</small><strong>${group.rows.length}</strong><em>${esc([...group.formats].slice(0,5).join(' · ')||'mixed formats')}</em></span>`).join('')}</div>`;
  const grouped=ordered.map((group)=>`<details class="artifact-file-group group-${esc(group.id)}"${group.id===primary&&group.rows.length<=4?' open':''}><summary>`
    +`<span class="artifact-group-copy"><strong>${esc(group.label)}</strong><small>${esc(group.description)}</small></span>`
    +`<span class="artifact-group-formats">${[...group.formats].slice(0,6).map((format)=>`<em>${esc(format)}</em>`).join('')}</span>`
    +`<span class="artifact-group-count">${group.rows.length} file${group.rows.length===1?'':'s'}</span>${icon('chevron','ico-sm')}</summary>`
    +`<div class="artifact-group-list">${group.rows.map(render).join('')}</div></details>`).join('');
  return overview+`<div class="artifact-file-groups" aria-label="${esc(ariaLabel)}">${grouped}</div>`;
}
function _artifactRevisionKey(r){ const L=r?._links||{};
  return String(L.bundle_id||r?.bundle_id||runOf(r)||'unversioned');
}
function _artifactRevisionOrder(rows){
  let run='', record='';
  for(const row of rows||[]){
    const candidateRun=String(runOf(row)||''); if(candidateRun>run) run=candidateRun;
    const candidateRecord=String(row?.record_id||row?.card_id||row?._storeKey||'');
    if(candidateRecord>record) record=candidateRecord;
  }
  return `${run}\u0000${record}`;
}
function _artifactRevisionProjection(artifacts){
  const rows=_boundedLatestUnique(artifacts,_artifactPresentationKey,LIVE_ARTIFACT_LIMITS.maxFiles*4);
  const files=rows.filter((row)=>{ const L=row?._links||{};
    return typeof L.content==='string'||typeof L.content_stub==='string'||row?.package_path
      ||(L.bundle_id&&(L.content_hash||row?.content_hash)); });
  const groups=new Map();
  for(const file of files){ const key=_artifactRevisionKey(file);
    (groups.get(key)||groups.set(key,[]).get(key)).push(file); }
  const revisions=[...groups].map(([key,groupRows])=>{
    const unique=new Map();
    for(const row of groupRows){ const path=_artifactDisplayPath(row);
      if(unique.has(path)) unique.delete(path); unique.set(path,row); }
    return {key,rows:[...unique.values()].sort((a,b)=>_artifactDisplayPath(a).localeCompare(_artifactDisplayPath(b))),
      order:_artifactRevisionOrder(groupRows)};
  }).sort((a,b)=>a.order.localeCompare(b.order)||a.key.localeCompare(b.key));
  const current=revisions.at(-1)||null;
  return {rows,current,history:current?revisions.slice(0,-1).reverse():[]};
}
function _exactSha256Digest(value,{prefixRequired=false}={}){
  const raw=String(value||'').trim();
  const match=(prefixRequired?/^sha256:([0-9a-f]{64})$/i:/^(?:sha256:)?([0-9a-f]{64})$/i).exec(raw);
  return match?match[1].toLowerCase():'';
}
function _signedArtifactWorkspaceBinding(r){
  if(r?.kind!=='artifact') return null;
  const L=r._links||{}, content=typeof L.content==='string'?L.content:'';
  // A file card must bind the whole package route. Do not recover a run or
  // filename from labels, extensions, bundle descriptions, or a loose suffix.
  const route=/^\/?k\/(run-[0-9A-Za-z]+)\/artifacts\/package\/(.+)$/.exec(content);
  if(!route) return null;
  const authority=environmentAuthorityOfRecord(r);
  if(authority.status!=='resolved'||!authority.environmentId) return null;
  const linkHash=_exactSha256Digest(L.content_hash,{prefixRequired:true});
  const recordHash=r.content_hash?_exactSha256Digest(r.content_hash,{prefixRequired:true}):linkHash;
  if(!linkHash||!recordHash||linkHash!==recordHash) return null;
  const mimeType=selectArtifactRenderer(L.mime_type).mediaType;
  if(!mimeType) return null;
  return {record:r,kernel:String(r._kernel||''),run:route[1],environmentId:authority.environmentId,
    path:route[2],contentHash:linkHash,mimeType,authoredLabels:authoredArtifactLabels(r),
    declaration:_artifactDeclarationDisplayProjection(r)};
}
function _liveFileSignedArtifactMetadata(file,{kernel='',run='',environmentId='',workspaceId=''}={}){
  const liveHash=_exactSha256Digest(file?.sha256), livePath=String(file?.path||'');
  const liveEnvironmentId=environmentIdentity(file?.environment_id);
  // The live snapshot remains the authority for workspace membership, route,
  // size and bytes. Its file and workspace bindings must agree before a file
  // card is even considered as a display-metadata witness.
  if(!kernel||!run||!environmentId||!workspaceId||!liveHash||!livePath
      ||String(file?.workspace_id||'')!==workspaceId
      ||liveEnvironmentId!==environmentId) return null;
  let match=null;
  for(const id of S.order||[]){
    const candidate=_signedArtifactWorkspaceBinding(S.recs.get(id));
    if(!candidate||candidate.kernel!==kernel||candidate.run!==run
        ||candidate.environmentId!==environmentId||candidate.path!==livePath
        ||candidate.contentHash!==liveHash) continue;
    // Two admitted records matching the same live file are ambiguous even if
    // they happen to repeat the same MIME. Fail closed instead of picking one.
    if(match) return null;
    match=candidate;
  }
  if(!match) return null;
  return Object.freeze({mimeType:match.mimeType,
    authoredLabels:Object.freeze([...match.authoredLabels]),declaration:match.declaration,
    recordId:String(match.record.record_id||'')});
}
function _artifactPreviewActionHTML(r,{scope='output',base='',run='',verifiedMetadata=false}={}){
  if(!r) return '';
  // The caller must establish either a provider/document-verified record or a
  // manifest reached through a provider-verified environment route. The button
  // remains inert otherwise, and also requires an exact advertised SHA-256.
  // fileView performs the separate byte fetch + hash check only after selection.
  const L=r._links||{}, label=_artifactDisplayPath(r), filePresentation=_artifactFilePresentation(label);
  const declaration=_artifactDeclarationDisplayProjection(r);
  const mediaSelection=artifactMediaPresentation(r,label);
  const media=mediaSelection.mediaType||'undeclared media';
  const typeLabel=artifactTypeLabel(mediaSelection.mediaType);
  const hash=String(L.content_hash||r.content_hash||'');
  const rawPath=String(L.content||r.content||r.package_path||'');
  const path=rawPath&&run&&!/^(?:https?:|\/|k\/run-)/.test(rawPath)?_bodyPath(rawPath,run):rawPath;
  const size=r.size_bytes??r.size??r.bytes??'';
  // Prefer the currently verified provider transport over the document's
  // canonical content base. The signed content path/hash stay unchanged, so a
  // local or alternate verified route can avoid a slow canonical tunnel while
  // the byte verifier still rejects any different body.
  const semantics=artifactSemanticsAttr(r),
    resolvedBase=String(base||r._providerBase||r._base||'');
  const aid=r._storeKey||r.record_id||r.card_id||r.id||'';
  const inProgress=r.in_progress===true;
  const canPreview=verifiedMetadata===true&&!!path&&/^sha256:[0-9a-f]{64}$/i.test(hash);
  const canInspect=verifiedMetadata===true&&!!aid;
  if(!canPreview&&!canInspect){
    return `<div class="current-artifact-file artifact-preview-unavailable" aria-label="${esc(label)} — file not ready to open">`
      +`${_artifactFormatTileHTML(filePresentation)}<span class="current-artifact-copy">${_artifactFileIdentityHTML(filePresentation,declaration)}`
      +`<small>${esc(typeLabel)} · The filename is available, but verified file bytes have not arrived yet.</small></span>`
      +`<span class="current-artifact-preview">${inProgress?'Still being created':'Not ready to open'}</span></div>`;
  }
  const action=canPreview
    ?`data-current-artifact-path="${esc(path)}" data-current-artifact-base="${esc(resolvedBase)}" data-current-artifact-title="${esc(label)}" data-current-artifact-kind="${esc(media)}" data-current-artifact-hash="${esc(hash)}" data-current-artifact-size="${esc(size)}" data-current-artifact-semantics="${esc(semantics)}" data-current-artifact-declaration="${esc(artifactDeclarationAttr(declaration))}"`
    :`data-artid="${esc(aid)}"`;
  const authored=authoredArtifactLabelText(r);
  const declarer=_artifactDeclarationPersonaLabel(declaration,String(r._kernel||''));
  return `<button type="button" class="current-artifact-file" ${action} title="${canPreview?'Open and verify':'View details for'} ${esc(label)}">`
    +`${_artifactFormatTileHTML(filePresentation)}<span class="current-artifact-copy">${_artifactFileIdentityHTML(filePresentation,declaration)}`
    +`<small>${esc(typeLabel)}${size!==''?` · ${fmtBytes(Number(size))}`:''}${declarer?` · Declared by ${esc(declarer)}`:''}${authored?` · ${esc(authored)}`:''}</small></span>`
    +`<span class="current-artifact-preview">${inProgress?'Still being created · ':''}${canPreview?'Open file':'View details'} →</span></button>`;
}
function _artifactActionHTML(r,{scope='output'}={}){
  if(!r) return '';
  const aid=r._storeKey||r.record_id||r.card_id||r.id||'';
  const label=String(r.label||'artifact bundle');
  const authored=authoredArtifactLabelText(r);
  return `<button type="button" class="owned-output" data-artid="${esc(aid)}" title="open ${esc(label)}">`
    +`<span class="owned-output-icon">${icon('box','ico-sm')}</span><span class="owned-output-copy"><b>${esc(label)}</b>`
    +`<small>${esc(_sentenceStart(scope))}${authored?` · ${esc(authored)}`:''}</small></span><span class="current-artifact-preview">Open details →</span></button>`;
}
function _ownedOutputsHTML(artifacts,{label='Owned outputs',scope='persona worktree'}={}){
  const projection=_artifactRevisionProjection(artifacts), rows=projection.rows;
  if(projection.current?.rows.length){
    const current=projection.current.rows;
    const inProgress=current.filter((r)=>r?.in_progress===true).length;
    const authored=[...new Set(current.flatMap((r)=>authoredArtifactLabels(r)))].slice(0,8);
    const history=projection.history;
    return `<section class="owned-outputs current-artifacts"><div class="owned-outputs-head"><span>${esc(label)}</span>`
      +`<small>${current.length} file${current.length===1?'':'s'} ready to open${inProgress?` · ${inProgress} still being created`:''}</small></div>`
      +_artifactExactFormatCountsHTML(current,_artifactDisplayPath)
      +_artifactGroupedListHTML(current,{pathOf:_artifactDisplayPath,
        render:(r)=>_artifactPreviewActionHTML(r,{scope,verifiedMetadata:true}),ariaLabel:`${label} — current files`})
      +`<div class="artifact-preview-note">Select a file to fetch it on demand, verify its SHA-256, and open the preview.</div>`
    +(authored.length?`<div class="owned-output-history">Purpose · ${esc(authored.join(' · '))}</div>`:'')
    +(history.length?`<div class="artifact-revision-history"><b>Earlier versions</b><span>${history.length} earlier version${history.length===1?'':'s'} retained.</span>`
        +history.slice(0,12).map((revision)=>`<span title="${esc(revision.key)}">Earlier version · ${revision.rows.length} file${revision.rows.length===1?'':'s'}</span>`).join('')
        +(history.length>12?`<span>${history.length-12} additional earlier revisions retained in verified records</span>`:'')+`</div>`:'')+`</section>`;
  }
  const bundles=rows.filter((r)=>r?._links?.bundle), selected=bundles.length?[bundles.at(-1)]:rows.slice(-1);
  if(!selected.length) return '';
  const authored=[...new Set(rows.flatMap((r)=>authoredArtifactLabels(r)))].slice(0,8);
  return `<section class="owned-outputs"><div class="owned-outputs-head"><span>${esc(label)}</span><small>${esc(scope)}</small></div>`
    +selected.map((r)=>_artifactActionHTML(r,{scope})).join('')
    +(authored.length?`<div class="owned-output-history">authored role claims · ${esc(authored.join(' · '))}</div>`:'')
    +(rows.length>selected.length?`<div class="owned-output-history">${rows.length-selected.length} earlier signed record${rows.length-selected.length===1?'':'s'} retained separately</div>`:'')+`</section>`;
}
function _liveWorkspaceRevisionOrder(row){
  const signedTime=Date.parse(String(row?.generatedAt||''));
  // Run ids are monotonic ULIDs minted when the causal run begins. Prefer that
  // lineage order across resumed runs; a finalized predecessor can be served or
  // re-observed later and must not become "current" merely because of fetch time.
  return `${String(row?.run||'')}\u0000${Number.isFinite(signedTime)?String(signedTime).padStart(16,'0'):''}\u0000${String(row?.revision||'')}`;
}
function _currentLiveWorkspaceProjection(rows){
  const bounded=_boundedLatestUnique(rows,(row)=>
    `${row?.kernel||row?.base||''}\u0000${row?.run||''}\u0000${row?.workspaceId||''}`,48);
  const currentByWorkspace=new Map(), history=[];
  for(const row of bounded){
    const key=`${row?.kernel||row?.base||''}\u0000${row?.workspaceId||row?.run||''}`, prior=currentByWorkspace.get(key);
    if(!prior){ currentByWorkspace.set(key,row); continue; }
    if(_liveWorkspaceRevisionOrder(row)>_liveWorkspaceRevisionOrder(prior)){
      history.push(prior); currentByWorkspace.set(key,row);
    }else history.push(row);
  }
  const current=[...currentByWorkspace.values()].sort((a,b)=>
    _liveWorkspaceRevisionOrder(b).localeCompare(_liveWorkspaceRevisionOrder(a)));
  history.sort((a,b)=>_liveWorkspaceRevisionOrder(b).localeCompare(_liveWorkspaceRevisionOrder(a)));
  return {current,history};
}
function _liveWorkspaceCurrentFileCount(rows){
  return _currentLiveWorkspaceProjection(rows).current.reduce((total,row)=>total+(row.files?.length||0),0);
}
function _liveCurrentFileActionHTML(file,row,scope){
  const label=String(file?.path||'artifact'), filePresentation=_artifactFilePresentation(label);
  const metadata=_liveFileSignedArtifactMetadata(file,row);
  const declaration=metadata?.declaration?.present?metadata.declaration:_artifactDeclarationDisplayProjection(file);
  const presentation=metadata
    ?selectArtifactRenderer(metadata.mimeType,{path:label})
    :artifactMediaPresentation(file,label);
  const media=presentation.mediaType;
  const authored=metadata?metadata.authoredLabels.join(' · '):authoredArtifactLabelText(file);
  const declarer=_artifactDeclarationPersonaLabel(declaration,String(row?.kernel||''));
  const proof=[media||'type not declared',metadata?'signed file-card metadata':'signed workspace metadata',scope].join(' · ');
  return `<button type="button" class="current-artifact-file live-current-artifact" data-live-current-file="1" data-live-file-run="${esc(row.run)}" data-live-file-base="${esc(row.base||'')}" data-live-file-workspace="${esc(row.workspaceId)}" data-live-file-path="${esc(file.path)}" title="${esc(`Open ${label}. ${proof}`)}">`
    +`${_artifactFormatTileHTML(filePresentation)}<span class="current-artifact-copy">${_artifactFileIdentityHTML(filePresentation,declaration)}`
    +`<small>${esc(artifactTypeLabel(media))} · ${fmtBytes(file.size_bytes)}${declarer?` · Declared by ${esc(declarer)}`:''}${authored?` · ${esc(authored)}`:''}</small></span>`
    +`<span class="current-artifact-preview">Open file →</span></button>`;
}
function _liveWorkspacesHTML(rows,{label='Live worktree',scope='persona worktree'}={}){
  const projection=_currentLiveWorkspaceProjection(rows);
  if(!projection.current.length) return '';
  const fileCount=projection.current.reduce((total,row)=>total+(row.files?.length||0),0);
  // A finalized, empty scratch worktree is not a useful "current files"
  // surface. Durable environment outputs remain visible through independently
  // verified file cards, so this does not imply that published work vanished.
  if(!fileCount&&projection.current.every((row)=>row.ended===true)) return '';
  const captureSummary=fileCount
    ?`${fileCount} current file${fileCount===1?'':'s'}`
    :'No new live-run files yet';
  return `<section class="owned-outputs live-owned-outputs current-artifacts"><div class="owned-outputs-head"><span>${esc(label)}</span><small>${captureSummary}</small></div>`
    +projection.current.map((row)=>{
      const updated=_friendlyInstant(row.generatedAt);
      const exact=[row.workspaceId?`workspace ${row.workspaceId}`:'',row.run?`run ${row.run}`:'',row.revision?`revision ${row.revision}`:''].filter(Boolean).join(' · ');
      const workspaceStatus=row.ended?'Saved from the latest work':row.files.length?'Updating as work continues':'Live run started; no files captured yet';
      return `<div class="current-workspace"><div class="current-workspace-head"><span title="${esc(exact)}"><b>${esc(workspaceStatus)}</b>${updated?` · ${esc(updated)}`:''}</span><span>${row.files.length} file${row.files.length===1?'':'s'}</span></div>`
        +(row.files.length?_artifactExactFormatCountsHTML(row.files,(file)=>String(file?.path||''))
          +_artifactGroupedListHTML(row.files,{pathOf:(file)=>String(file?.path||''),
            render:(file)=>_liveCurrentFileActionHTML(file,row,scope),ariaLabel:`${label} — current files`})
          :'<span class="l2">No files were captured in this run snapshot. Durable published and shared outputs, when available, are shown separately.</span>')+'</div>';
    }).join('')
    +`<div class="artifact-preview-note">${fileCount?'Files load only when opened. Before showing a preview, the browser checks that the downloaded bytes match the workspace record.':'This is the signed live-run capture, not a claim that the durable workspace is empty.'}</div>`
    +(projection.history.length?`<div class="artifact-revision-history"><b>Earlier versions</b><span>${projection.history.length} earlier workspace version${projection.history.length===1?'':'s'} retained.</span>`
      +projection.history.slice(0,12).map((row)=>`<span title="${esc(`run ${row.run||''} · revision ${row.revision||''}`)}">Earlier version${_friendlyInstant(row.generatedAt)?` · ${esc(_friendlyInstant(row.generatedAt))}`:''} · ${row.files.length} file${row.files.length===1?'':'s'}</span>`).join('')
      +(projection.history.length>12?`<span>${projection.history.length-12} additional earlier revisions retained</span>`:'')+`</div>`:'')+`</section>`;
}
function _firstAuthoredMethodText(value,depth=0){
  if(depth>5||value===null||value===undefined) return '';
  if(typeof value==='string') return value.trim();
  if(Array.isArray(value)){
    for(const item of value){ const text=_firstAuthoredMethodText(item,depth+1); if(text) return text; }
    return '';
  }
  if(typeof value==='object'){
    for(const item of Object.values(value)){ const text=_firstAuthoredMethodText(item,depth+1); if(text) return text; }
  }
  return '';
}
function _personaAgenticDevelopmentHTML(agentic,{compact=false}={}){
  if(!PUBLIC_PERSONA_AGENTIC_SCHEMAS.includes(agentic?.schema)) return '';
  const retainedKnowledge=agentic.authored_knowledge||[];
  const methods=agentic.authored_methods||[], bindings=agentic.active_bindings||[];
  const practice=agentic.recent_action_practice||[], acquired=agentic.acquired_tools||[];
  const capabilities=agentic.acquired_capabilities||[], invocations=agentic.tool_invocations||[];
  const localExecutions=agentic.local_executions||[];
  if(!retainedKnowledge.length&&!methods.length&&!bindings.length&&!practice.length&&!acquired.length
      &&!capabilities.length&&!invocations.length&&!localExecutions.length) return '';
  const activeIds=new Set(bindings.flatMap((binding)=>binding.fragment_ids||[]));
  const knowledgeRows=[...retainedKnowledge].reverse().slice(0,compact?2:12).map((record)=>{
    const authoredText=record.body_included?_firstAuthoredMethodText(record.body):'';
    const title=authoredText?_compactHumanLabel(authoredText,compact?180:420)
      :'Retained persona-authored knowledge';
    const cognitionDetail=record.future_cognition_inventory_eligible
      ?'Available to the persona in a mechanically bounded future-cognition inventory'
      :'Retained as signed history';
    const detail=record.body_included
      ?`${cognitionDetail} · exact body is present in this public signed activity snapshot`
      :`${cognitionDetail} · ${fmtBytes(record.content_bytes)} · body access was not widened`;
    return `<li><span class="agentic-evidence-mark catalogued">${icon('lesson','ico-sm')}</span>`
      +`<div><strong>${esc(title)}</strong><small>${esc(detail)}</small>`
      +(!compact&&record.body_included
        ?`<details><summary>Exact authored knowledge</summary>${_personaWorkNoteValueHTML(record.body,{compact:false})}</details>`:'')
      +`</div></li>`;
  }).join('');
  const methodRows=[...methods].reverse().slice(0,compact?2:12).map((method)=>{
    const authoredText=_firstAuthoredMethodText(method.body);
    const omittedReason=String(method.body_omitted_reason||'').trim();
    const title=authoredText?_compactHumanLabel(authoredText,compact?180:420)
      :(omittedReason?`Authored method body is retained by hash (${humanizeMachineKey(omittedReason)})`
        :'Authored method body is retained by hash');
    const active=activeIds.has(method.fragment_id);
    const authoredAt=Date.parse(String(method.updated_at||method.created_at||''));
    const authoredWhen=Number.isFinite(authoredAt)?` · authored ${_friendlyInstant(method.updated_at||method.created_at)}`:'';
    return `<li><span class="agentic-evidence-mark ${active?'active':'catalogued'}">${icon(active?'check':'lesson','ico-sm')}</span>`
      +`<div><strong>${esc(title)}</strong><small>${active?'Active in an exact persona-chosen carrier':'Authored and catalogued; not active in a carrier'}${esc(authoredWhen)}</small>`
      +(!compact&&method.body_included
        ?`<details><summary>Exact authored method</summary>${_personaWorkNoteValueHTML(method.body,{compact:false})}</details>`:'')
      +`</div></li>`;
  }).join('');
  const practiceRows=[...practice].reverse().slice(0,compact?6:16);
  const toolRows=[...new Map([
    ...acquired.map((row)=>[`${row.environment_id}\u0000${row.tool_name}`,
      {label:row.tool_name,detail:'acquired',count:1,lastAt:row.acquired_at}]),
    ...invocations.map((row)=>[`${row.environment_id}\u0000${row.tool_name}`,
      {label:row.tool_name,detail:'used',count:row.count,lastAt:row.last_at}]),
    ...capabilities.map((row)=>[`${row.environment_id}\u0000${row.capability}`,
      {label:row.capability,detail:'provisioned',count:1,lastAt:row.provisioned_at||row.acquired_at}]),
  ]).values()].slice(-(compact?6:16));
  const executionRows=[...localExecutions].reverse().slice(0,compact?6:16);
  return `<section class="pc-agentic-development${compact?' compact':''}"><div class="pc-section-head"><span>Learning and practice over time</span>`
    +`<small>${retainedKnowledge.length} retained · ${methods.length} method${methods.length===1?'':'s'} · ${activeIds.size} active</small></div>`
    +(knowledgeRows?`<ol class="agentic-methods">${knowledgeRows}</ol>`:'')
    +(methodRows?`<ol class="agentic-methods">${methodRows}</ol>`
      :'<p class="agentic-empty">No reusable method has been authored and activated yet.</p>')
    +(practiceRows.length?`<div class="agentic-practice"><b>Recent practiced actions</b><div>${practiceRows.map((row)=>{const at=Date.parse(String(row.last_at||''));return `<span title="${esc(row.action_name)}">${esc(humanizeMachineKey(row.action_name))}${row.count>1?` · ${esc(row.count)}×`:''}${Number.isFinite(at)?` · ${esc(_ago(at))}`:''}</span>`;}).join('')}</div></div>`:'')
    +(toolRows.length?`<div class="agentic-practice"><b>Capabilities and tools</b><div>${toolRows.map((row)=>{const at=Date.parse(String(row.lastAt||''));return `<span>${esc(humanizeMachineKey(row.label))} · ${esc(row.detail)}${row.count>1?` ${esc(row.count)}×`:''}${Number.isFinite(at)?` · ${esc(_ago(at))}`:''}</span>`;}).join('')}</div></div>`:'')
    +(executionRows.length?`<div class="agentic-practice"><b>Executable evidence from task runs</b><div>${executionRows.map((row)=>{const at=Date.parse(String(row.last_at||''));return `<span title="${esc(row.last_command_hash)}">${esc(row.executable)} · ${esc(row.successful_count)}/${esc(row.invocation_count)} succeeded${Number.isFinite(at)?` · ${esc(_ago(at))}`:''}</span>`;}).join('')}</div></div>`:'')
    +`<p class="agentic-neutrality">Retained knowledge can return through the persona's bounded future-cognition inventory. Authored tactics, active bindings, acquired tools, and practice remain separate verified facts—not an automatic expertise score. Executable evidence contains exact launchers plus mechanically sampled child processes; it does not parse shell text, and short-lived child programs may be absent.</p></section>`;
}
function _latestLessonHTML(agentic){
  if(!PUBLIC_PERSONA_AGENTIC_SCHEMAS.includes(agentic?.schema)) return '';
  const methods=Array.isArray(agentic.authored_methods)?agentic.authored_methods.filter((m)=>m&&typeof m==='object'):[];
  if(!methods.length) return '';
  const authoredAt=(m)=>String(m.updated_at||m.created_at||'');
  const latest=[...methods].sort((a,b)=>authoredAt(b).localeCompare(authoredAt(a)))[0];
  const text=_firstAuthoredMethodText(latest.body);
  if(!text) return '';
  const when=Number.isFinite(Date.parse(authoredAt(latest)))?_friendlyInstant(authoredAt(latest)):'';
  return `<section class="pk-latest-lesson"><div class="pc-section-head"><span>Latest lesson</span>`
    +`<small>${icon('check','ico-sm')} persona-authored</small></div>`
    +`<p title="${esc(_compactHumanLabel(text,600))}"><strong>${esc(_compactHumanLabel(text,200))}</strong>`
    +(when?`<small>authored ${esc(when)}</small>`:'')+`</p></section>`;
}
function _personaAuthoredWorkHTML(personaKey,kernel='',mechanical=null){
  const retained=S.verifiedPublicCognitionByPersona?.get(personaKey);
  const doc=retained?.doc;
  const publicCognition=_publicCognitionDocOk(doc);
  const fastState=S.liveByPersona.get(personaKey)?.currentWorkState;
  const state=publicCognition
    &&doc.current_work_state?.schema==='personaos-persona-work-state-surface/5'
    ?doc.current_work_state
    :fastState?.schema==='personaos-persona-work-state-surface/5'?fastState:null;
  if(!publicCognition&&!state) return '';
  const outputs=publicCognition?[...(doc.recent_outputs||[])].reverse():[];
  const latestOutput=outputs.find((output)=>output?.authority==='persona_signature');
  const agenticHTML=publicCognition
    ?_personaAgenticDevelopmentHTML(doc.agentic_development,{compact:true}):'';
  if(!state&&!latestOutput&&!agenticHTML) return '';
  let stateHTML='';
  if(state){
    stateHTML=`<div class="pc-authored-state"><div class="pc-authored-state-head"><strong>Persona-authored work note</strong>`
      +`<span>${icon('check','ico-sm')} persona-authored</span></div>`
      +_personaWorkNoteComparisonHTML(state,mechanical,{compact:true})
      +'</div>';
  }
  let outputHTML='';
  if(latestOutput){
    const exact=_publicPersonaOutputDisplayText(latestOutput);
    const view=structuredContentProjection(exact);
    const headline=view.headline||'Latest shared update';
    const details=[...(view.paragraphs||[]),...(view.items||[])]
      .map((value)=>String(value||'').trim())
      .filter((value)=>value&&value!==headline);
    const summary=details[0]||(!headline||headline==='Latest shared update'
      ?_compactHumanLabel(exact,240):'');
    outputHTML=`<div class="pc-authored-output"><span>${esc(_publicOutputLabel(latestOutput))}</span>`
      +`<strong>${esc(headline||'Latest shared update')}</strong>`
      +(summary?`<p>${esc(_compactHumanLabel(summary,280))}</p>`:'')
      +'</div>';
  }
  const snapshotAge=publicCognition&&doc.generated_at
    ?` · as of ${_friendlyInstant(doc.generated_at)}`:'';
  const currentHTML=state||latestOutput
    ?`<section class="pc-authored-work"><div class="pc-section-head"><span>Current thinking and work</span>`
      +`<small>${icon('check','ico-sm')} signed snapshot verified${esc(snapshotAge)}</small></div>${stateHTML}${outputHTML}</section>`:'';
  // The newest kernel-signed proven facts belong on the face: they are the
  // clearest "what this persona has actually learned" a visitor can consume.
  const facts=publicCognition?(doc.proven_facts||[]).slice(-2).reverse():[];
  const factsHTML=facts.length
    ?`<section class="pc-proven-facts"><div class="pc-section-head"><span>Proven facts it holds</span>`
      +`<small>${icon('check','ico-sm')} kernel-signed snapshot</small></div>`
      +facts.map((fact)=>`<p>${esc(_compactHumanLabel(String(fact),220))}</p>`).join('')+'</section>':'';
  // C-OP-16: the member's latest lesson leads -- the newest persona-authored
  // method, by its own authored time, as the persona's claim.
  const latestLessonHTML=_latestLessonHTML(publicCognition?doc.agentic_development:null);
  return latestLessonHTML+currentHTML+factsHTML+agenticHTML;
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
  const personaAuthored=({event})=>event?.signed===true
    &&event?._providerProvisional!==true
    &&typeof event?._exactText==='string'&&event._exactText.trim();
  const rows=[];
  const add=(row)=>{ if(row&&!rows.includes(row)&&rows.length<4) rows.push(row); };
  candidates.filter(personaAuthored)
    .slice(0,2).forEach(add);
  candidates.forEach(add);
  // The card shows only the first two rows. Keep exact persona-authored text in
  // those human-facing slots before sorting within each evidence class by
  // recency; otherwise a pair of newer mechanical kernel observations can
  // conceal the actual thought that explains what the persona concluded.
  rows.sort((left,right)=>{
    const leftAuthored=personaAuthored(left)?1:0;
    const rightAuthored=personaAuthored(right)?1:0;
    return rightAuthored-leftAuthored||Number(right.event?._t||0)-Number(left.event?._t||0);
  });
  if(!rows.length) return `<section class="pc-activity pc-message-stream"><div class="pc-section-head"><span>Persona updates</span><small>quiet now</small></div><div class="pc-activity-empty">No public work updates have been shared yet.</div></section>`;
  const renderRows=(selected)=>selected.map(({event:e,count})=>{ const cls=_ixClass(e.kind,e), kernel=_eventKernel(e);
      const actorKey=e.actor_kind==='persona'?_eventPersonaKey(e,e.actor_id):'';
      const actor=actorKey?_nameFor(actorKey):(e.actor_kind||'kernel');
      const mine=actorKey===personaKey;
      const targets=_eventEndpoints(e).map((endpoint)=>endpoint.kind==='persona'
        ?_nameFor(_eventPersonaKey(e,endpoint.id))
        :_eventEntityLabel(endpoint.kind,endpoint.id,kernel)).slice(0,3);
      const recipientCount=Number.isSafeInteger(e._recipientCount)&&e._recipientCount>0?e._recipientCount:0;
      const targetLabel=recipientCount?`${recipientCount} recipient${recipientCount===1?'':'s'}`:targets.join(', ');
      const selfName=_nameFor(personaKey);
      const route=mine
        ?`${selfName}${targetLabel?` → ${targetLabel}`:''}`
        :`${actor}${targetLabel?` → ${targetLabel}`:` → ${selfName}`}`;
      const exactText=typeof e._exactText==='string'&&e._exactText.trim()?e._exactText:'';
      const exactProjection=exactText?structuredContentProjection(exactText):null;
      const presentation=humanActivityPresentation(e.kind,e._provenance||{});
      const observedDetail=String(e._msg||e._cap?.capability||e._cap?.tool_name||'').trim();
      const direction=mine?'outbound':(actorKey?'inbound':'observed');
      const modelUpdate=e.kind==='MODEL_CALL'||String(e.kind||'').startsWith('MODEL_');
      // Model telemetry often carries transport summaries such as
      // "200 · 26036 ms" as its message. Keep those values in the collapsed
      // verification disclosure and use human work context on the card.
      // Signed persona outputs are often JSON envelopes. Keep those exact
      // bytes in verification details and put their authored message or
      // purpose—not raw JSON—on the human-facing card.
      const exactHumanText=exactProjection?.headline
        &&exactProjection.headline!==String(e._provenance?.action||'')
        ?exactProjection.headline:'';
      const detail=exactHumanText||(modelUpdate?presentation.summary:(observedDetail||presentation.summary));
      const routeLabel=exactText
        ?`${selfName} · ${e._cognition===true?'Shared thought':'Shared update'}`
        :modelUpdate?`${selfName} · Work update`:route;
      const context=_activityPrimaryContextHTML(e,{className:'pc-message-context',kernel});
      const technical=_activityTechnicalHTML(e,kernel);
      return `<li class="pc-activity-row pc-message ${direction} ix-${cls}" data-message-kind="${esc(String(e.kind||''))}">`
        +`<span class="pc-activity-mark">${_ixGlyph(cls)}</span><span class="pc-activity-copy"><span class="pc-message-route">${esc(routeLabel)} ${_activityTrustBadgeHTML(e)}</span>`
        +`<b>${esc(presentation.headline)}${count>1?` <span class="pc-message-count">×${count}</span>`:''}</b>`+(detail?`<span class="pc-message-body">${esc(detail)}</span>`:'')
        +context+technical+`</span>${_eventTimeHTML(e)}</li>`; }).join('');
  const authoredRows=rows.filter(personaAuthored);
  const diagnosticRows=rows.filter((row)=>!personaAuthored(row));
  const authoredHTML=authoredRows.length
    ?`<section class="pc-activity pc-message-stream"><div class="pc-section-head"><span>Persona-authored updates</span><small><i></i> newest first</small></div><ol aria-live="polite" aria-relevant="additions text" aria-atomic="false">${renderRows(authoredRows)}</ol></section>`
    :`<section class="pc-activity pc-message-stream"><div class="pc-section-head"><span>Persona updates</span><small>none shared yet</small></div><div class="pc-activity-empty">The persona has not published a signed message or thought yet.</div></section>`;
  const diagnosticsHTML=diagnosticRows.length
    ?`<details class="pc-diagnostics"><summary>Technical activity · ${diagnosticRows.length}</summary><ol>${renderRows(diagnosticRows)}</ol></details>`
    :'';
  return authoredHTML+diagnosticsHTML;
}
// ==== Collectible card gallery (landing redesign) ====================
// Deterministic identicon: 5x5 mirrored grid, hue from an FNV-1a hash of the
// id. Pure presentation — no fetched bytes, no authorship claim; it simply
// gives every persona/environment stable, distinct art instead of one shared
// fallback image.
function _identiconHash(value){ let h=2166136261>>>0;
  for(const ch of String(value||'')){ h^=ch.codePointAt(0); h=Math.imul(h,16777619)>>>0; }
  return h>>>0; }
function identiconSVG(id,{className='pk-identicon',title=''}={}){
  let h=_identiconHash(id);
  const next=()=>{ h=Math.imul(h^(h>>>15),2246822519)>>>0;
    h=Math.imul(h^(h>>>13),3266489917)>>>0; return (h^=h>>>16)>>>0; };
  const hue=_identiconHash(`hue:${id}`)%360;
  const cells=[];
  for(let x=0;x<3;x++) for(let y=0;y<5;y++) if(next()%2===1){
    cells.push([x,y]); if(x<2) cells.push([4-x,y]); }
  if(!cells.length) cells.push([2,1],[1,2],[2,2],[3,2],[2,3]);
  const rects=cells.map(([x,y])=>`<rect x="${3+x*10}" y="${3+y*10}" width="10" height="10" rx="1.5"/>`).join('');
  return `<svg class="${esc(className)}" viewBox="0 0 56 56" role="img" aria-label="${esc(title||'deterministic identicon derived from the identifier')}" style="--pk-idhue:${hue}"><rect class="pk-id-bg" x="0" y="0" width="56" height="56" rx="10"/><g class="pk-id-fg">${rects}</g></svg>`;
}
// Lazy, cached, presentation-only read of the persona's public cognition
// document (personas/<id>/thinking). It enriches the collectible face with
// stat counters (EP/FR/TL/EV), the current model id, and the persona-authored
// work note. 403/404 (message tier not public) and malformed bodies degrade to
// "no stat row"; nothing here feeds a verification decision, and every string
// is HTML-escaped at render time.
const _pkCog={cache:new Map(),inflight:new Set()};
const PK_COG_TTL_MS=60000, PK_COG_NEG_TTL_MS=120000;
function _pkCognitionInvalidate(personaKey){
  if(personaKey===undefined){ _pkCog.cache.clear(); return; }
  _pkCog.cache.delete(String(personaKey||''));
}
function _pkCount(value){ return Number.isSafeInteger(value)&&value>=0&&value<=1e9?value:null; }
function _pkCognitionProjection(doc){
  if(!doc||typeof doc!=='object'||Array.isArray(doc)
      ||!String(doc.schema||'').startsWith('personaos-persona-public-cognition/')) return null;
  const calls=[...(Array.isArray(doc.active_calls)?doc.active_calls:[]),
    ...(Array.isArray(doc.recent_calls)?doc.recent_calls:[])].slice(0,32);
  const model=String(calls.find((call)=>call&&typeof call==='object'
    &&typeof call.model_id==='string'&&call.model_id)?.model_id||'').slice(0,80);
  const development=doc.agentic_development;
  const tools=development&&typeof development==='object'&&!Array.isArray(development)
    &&Array.isArray(development.acquired_tools)?development.acquired_tools.length:null;
  const workState=doc.current_work_state&&typeof doc.current_work_state==='object'
    &&!Array.isArray(doc.current_work_state)?doc.current_work_state:null;
  const workNote=workState&&workState.work_note&&typeof workState.work_note==='object'
    &&!Array.isArray(workState.work_note)?workState.work_note:null;
  const envIds=new Set();
  for(const call of calls){ const eid=String(call?.environment_id||'').trim();
    if(eid&&envIds.size<64) envIds.add(eid); }
  const workEnv=String(workState?.environment_id||'').trim();
  if(workEnv) envIds.add(workEnv);
  return {model,ep:_pkCount(doc.brain_episode_count),fr:_pkCount(doc.brain_fragment_count),
    tl:_pkCount(tools),ev:_pkCount(doc.brain_evolution_application_count),workNote,
    envCount:envIds.size};
}
function _pkBaseForKernel(kernel){
  const want=String(kernel||'');
  for(const key of (S.boots?S.boots.keys():[])){
    const base=key==='@origin'?'':key;
    const kid=String(kernelForBase(base)||(S.boots.get(key)||{}).kernel_id||'');
    if(kid&&kid===want) return {found:true,base};
  }
  return {found:false,base:''};
}
function _pkCognitionStats(personaKey){
  const key=String(personaKey||''); if(!key) return null;
  const cached=_pkCog.cache.get(key), now=Date.now();
  if(cached&&now-cached.at<(cached.stats?PK_COG_TTL_MS:PK_COG_NEG_TTL_MS)) return cached.stats;
  // The strictly verified cognition store outranks the tolerant lazy fetch.
  const verified=S.verifiedPublicCognitionByPersona?.get(key)?.doc;
  if(verified){ const stats=_pkCognitionProjection(verified);
    if(stats){ _pkCog.cache.set(key,{at:now,stats}); return stats; } }
  if(_pkCog.inflight.has(key)) return cached?.stats||null;
  const ref=_personaRef(key);
  const route=_pkBaseForKernel(ref.kernel);
  if(!route.found) return cached?.stats||null;
  _pkCog.inflight.add(key);
  (async()=>{
    try{
      const endpoint=join(route.base,`personas/${encodeURIComponent(ref.sid)}/thinking`);
      const doc=await fetchResponsivePublicJson(endpoint,
        {maxBytes:PUBLIC_PERSONA_COGNITION_LIMITS.documentBytes});
      const stats=doc&&String(doc.persona_id||'')===ref.sid?_pkCognitionProjection(doc):null;
      _pkCog.cache.set(key,{at:Date.now(),stats:stats||null});
      if(stats) scheduleRealtimeRepaint();
    }catch(_error){ _pkCog.cache.set(key,{at:Date.now(),stats:null}); }
    finally{ _pkCog.inflight.delete(key); }
  })();
  return cached?.stats||null;
}
// Kernel-signed task discovery facts for an environment/run: mechanical
// task_state / acceptance_state tokens from the record's capability summary.
function _pkTaskFacts(kernel,envSid,run){
  const wantEnv=environmentIdentity(envSid||'');
  for(const id of S.order){ const r=S.recs.get(id);
    if(!r||r.kind!=='task'||String(r._kernel||'')!==String(kernel||'')) continue;
    const caps=Array.isArray(r.capability_summary)?r.capability_summary.filter((cap)=>typeof cap==='string'):[];
    const runMatch=!!run&&caps.includes(`task_run:${run}`);
    const envMatch=!!wantEnv&&caps.some((cap)=>cap.startsWith('task_environment:')
      &&environmentIdentity(cap.slice('task_environment:'.length))===wantEnv);
    if(!runMatch&&!envMatch) continue;
    const token=(prefix)=>{ const hit=caps.find((cap)=>cap.startsWith(prefix));
      return hit?hit.slice(prefix.length).slice(0,64):''; };
    return {state:token('task_state:'),acceptance:token('acceptance_state:'),
      run:token('task_run:'),recordId:id};
  }
  return null;
}
// Tool-kind discovery records mounted in this environment → bounded name chips.
function _pkEnvTools(kernel,envSid){
  const want=environmentIdentity(envSid||''); if(!want) return [];
  const out=[];
  for(const id of S.order){ const r=S.recs.get(id);
    if(!r||r.kind!=='tool'||String(r._kernel||'')!==String(kernel||'')) continue;
    const caps=Array.isArray(r.capability_summary)?r.capability_summary.filter((cap)=>typeof cap==='string'):[];
    const envCap=caps.find((cap)=>cap.startsWith('environment_id:'));
    if(!envCap||environmentIdentity(envCap.slice('environment_id:'.length))!==want) continue;
    const nameCap=caps.find((cap)=>cap.startsWith('tool_name:'));
    const name=String(nameCap?nameCap.slice('tool_name:'.length):(r.label||'')).trim().slice(0,48);
    if(name) out.push({name,recordId:id});
    if(out.length>=16) break;
  }
  return out;
}
const PK_TASK_EXEC_DOING=Object.freeze({running_llm:'thinking…',run_participant:'on a mission',
  idle:'resting',away:'away',available:'ready',paused_participant:'paused'});
// ---- C-OP-16 member view: who and what, per member ----
// The signed declaring persona of an artifact outranks the access owner.
function _artifactDeclaringSid(record){
  // The persona who declared the artifact: the exported artifact_declaration
  // (the persona's own signed declare_artifact action) names it; the access
  // policy's owner is the RUN persona and is only the fallback.
  let declared='';
  try{ declared=String(_artifactDeclarationDisplayProjection(record||{})?.declaring_persona_id||''); }catch(_){ declared=''; }
  return _shortId(declared||record?.declaring_persona_id||record?._access?.owner_persona_id||'');
}
// The persona's own stated refusal of the identity requirement (R-ID-1),
// verified as a kernel-signed sibling; null when none was stated.
function _verifiedIdentityDecline(personaKey){
  const row=S.personaDiscoveryByKey.get(personaKey)||null;
  const status=row?._identityRequirementStatusVerified===true?row.identity_requirement_status:null;
  return status&&status.declined===true
    ?{reason:String(status.reason||''),declaredAt:String(status.declared_at||'')}:null;
}
function _identityDeclineCaptionHTML(decline){
  // The persona's OWN statement, rendered as its claim -- never a host verdict.
  return `<small class="pc-avatar-claim persona-authored-claim-inline" title="${esc(decline.reason)}">`
    +`identity declined — ${esc(_compactHumanLabel(decline.reason,110))}<em>persona's own statement</em></small>`;
}
// The kernel-signed scorecard of one run, found on its verified task record.
// The kernel-signed scorecard for a member's run: (a) the task record of
// that run, (b0) the member's own persona record's scorecard for that run,
// (b) the environment records' scorecard for that run, (c) the newest
// settle of the same TASK across all three carriers (labelled as such),
// (d) the newest element the persona record carries (labelled as the latest
// settled scorecard in its environments), else nothing -- never a guess.
// `envIds` bounds (b) and (c)'s environment elements to the member's
// environments when known.
function _scorecardForRun(kernel,run,taskId='',envIds=[],personaRow=null){
  const exactKernel=String(kernel||''); if(!exactKernel) return null;
  const exactRun=String(run||'').trim(), exactTask=String(taskId||'').trim();
  const wantEnvs=new Set((envIds||[]).map((id)=>environmentIdentity(String(id||''))).filter(Boolean));
  const personaCards=personaRow&&personaRow.kind==='persona'&&personaRow._runScorecardsVerified===true
    &&String(personaRow._kernel||'')===exactKernel&&Array.isArray(personaRow.run_scorecards)
    ?personaRow.run_scorecards.filter((card)=>publicRunScorecardShapeOk(card)):[];
  const envRows=[], taskRows=[];
  for(const id of (S.order||[])){ const r=S.recs.get(id);
    if(!r||String(r._kernel||'')!==exactKernel) continue;
    if(r.kind==='task'&&r._runScorecardVerified===true&&r.run_scorecard) taskRows.push(r.run_scorecard);
    if(r.kind==='env'&&r._runScorecardsVerified===true&&Array.isArray(r.run_scorecards)
      &&(!wantEnvs.size||wantEnvs.has(environmentIdentity(String(r.did||r.record_id||'')))))
      envRows.push(...r.run_scorecards);
  }
  const bySettled=(a,b)=>String(b.settled_at||'').localeCompare(String(a.settled_at||''));
  if(exactRun){
    const byRun=taskRows.find((card)=>String(card.run_id||'')===exactRun)
      ||personaCards.find((card)=>String(card.run_id||'')===exactRun)
      ||envRows.find((card)=>String(card.run_id||'')===exactRun);
    if(byRun) return {scorecard:byRun,via:'run'};
  }
  if(exactTask){
    const sameTask=[...taskRows,...personaCards,...envRows]
      .filter((card)=>String(card.task_id||'')===exactTask).sort(bySettled);
    if(sameTask.length) return {scorecard:sameTask[0],via:'task'};
  }
  if(personaCards.length) return {scorecard:[...personaCards].sort(bySettled)[0],via:'latest'};
  return null;
}
function _runScorecardHTML(scorecard,{compact=false,via='run'}={}){
  if(!publicRunScorecardShapeOk(scorecard)) return '';
  const names=Object.keys(scorecard.counters).sort();
  const unavailable=[...scorecard.unavailable_counters].sort();
  const rows=names.map((name)=>`<div><dt>${esc(humanizeMachineKey(name))}</dt><dd><b>${esc(String(scorecard.counters[name]))}</b></dd></div>`).join('')
    // C-OP-14: an unreadable source is named, never counted as zero.
    +unavailable.map((name)=>`<div class="scorecard-unavailable"><dt>${esc(humanizeMachineKey(name))}</dt><dd><em>not measurable — no readable source</em></dd></div>`).join('');
  const settled=_friendlyInstant(scorecard.settled_at);
  const heading=via==='task'?"Scorecard of this task's latest settle"
    :via==='latest'?"Latest settled scorecard in this member's environments":'Run scorecard';
  return `<section class="pc-run-scorecard mechanical-run-observation is-scorecard via-${esc(via)}${compact?' compact':''}" aria-label="${esc(heading.toLowerCase())}, kernel-signed">`
    +`<div class="pc-section-head"><span>${esc(heading)}</span><small>${icon('check','ico-sm')} kernel-signed · system-observed</small></div>`
    +`<dl class="scorecard-rows">${rows||'<div><dt>no counters</dt><dd><em>the scorecard carried no measurable counter</em></dd></div>'}</dl>`
    +`<small class="scorecard-foot" title="${esc(`run ${scorecard.run_id} · scorecard ${scorecard.scorecard_event_id}`)}">${names.length} measured · ${unavailable.length} not measurable${settled?` · settled ${esc(settled)}`:''}</small></section>`;
}
// What the member built this run: its current live workspaces scoped to the
// exact run when one is known, else its latest run.
function _builtThisRunHTML(context,run){
  const rows=Array.isArray(context?.liveWorkspaces)?context.liveWorkspaces:[];
  const exactRun=String(run||'').trim();
  const scoped=exactRun?rows.filter((row)=>String(row?.run||'')===exactRun):[];
  return _liveWorkspacesHTML(scoped.length?scoped:rows,
    {label:scoped.length?'Built this run':'Built in my latest run',scope:'my work'});
}
// ==== end collectible card gallery helpers ============================
function renderPersonaCard(pid,kernel='',context={}){
  const ref=_personaRef(pid,kernel), sid=ref.sid, personaKey=ref.key;
  const enrichmentPending=context.enrichmentPending===true;
  const d=S.liveByPersona.get(personaKey)||{}; const s=d.summary||{};
  const models=_personaModelHistory(personaKey,d.models||[]);
  const last=models[models.length-1];
  const rt=runtimeForPersona(personaKey)||{};
  const indexedActiveCalls=_activeModelCallsForPersona(personaKey);
  const signedCognitionCall=[...indexedActiveCalls].reverse().find((call)=>call?._signedPublicCognition===true)||null;
  const transportStale=!!d.stale&&!signedCognitionCall;
  const activeCall=signedCognitionCall||(!d.stale?(indexedActiveCalls.at(-1)||rt.current_model_call||null):null);
  const activeEnvironmentIds=new Set(indexedActiveCalls
    .map((call)=>environmentIdentity(call?.environment_id)).filter(Boolean));
  const currentEnvironmentId=activeEnvironmentIds.size===1
    ?activeEnvironmentIds.values().next().value:'';
  const identityObservation=providerVerifiedPersonaObservation(personaKey);
  const signedIdentity=identityObservation?.record||null;
  const identityVerified=identityObservation?.identityVerified===true;
  const characteristics=identityVerified&&signedIdentity?._personaCharacteristics
    ?signedIdentity._personaCharacteristics:null;
  const signedDescription=identityVerified&&signedIdentity
    ?String(signedIdentity.description||'').trim():'';
  const lifecycle=identityObservation?.lifecycle||null;
  const signedName=_personaAuthoredNameForObservation(identityObservation);
  const hasSignedIdentity=identityVerified;
  const hasSignedName=hasSignedIdentity&&!!signedName;
  const nameRole=_personaNameRolePresentation(signedName,sid);
  const name=nameRole.name;
  const authoredRole=identityVerified?_coordRole(sid,s,ref.kernel):_ROLE_NOT_DECLARED;
  const role=authoredRole;
  const characteristicHeadline=identityVerified
    ?_personaCharacteristicHeadline(characteristics,name):null;
  const identityProofState=identityObservation?.identityProofState||'refused';
  const state=lifecycle?.lifecycleState||(identityVerified?s.lifecycle_state:'OBSERVED');
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
  const cognitionDoc=S.verifiedPublicCognitionByPersona?.get(personaKey)?.doc;
  const currentWorkState=cognitionDoc?.current_work_state?.schema
    ==='personaos-persona-work-state-surface/5'?cognitionDoc.current_work_state
    :d.currentWorkState?.schema==='personaos-persona-work-state-surface/5'
      ?d.currentWorkState:null;
  const mechanicalRun=_personaMechanicalRunProjection(
    last,ref.kernel,acts,personaKey,currentWorkState);
  // flash on genuine growth of total activity (model reqs + monotonic act tally)
  const actTally=(S.ixCountBySid&&S.ixCountBySid.get(personaKey))||0;
  const grew=_personaGrew(personaKey,models.length+actTally);
  let doingHTML, focusLabel="What I'm doing now";
  if(activeCall){
    const purpose=String(activeCall.requested_purpose||activeCall.purpose||'model');
    const model=String(activeCall.model_id||activeCall.model||'—');
    const purposeLabel=humanActivityPresentation('MODEL_CALL',{purpose}).context
      ||PURPOSE_VERB[purpose]||purpose.replace(/_/g,' ');
    doingHTML=`<span class="pulse">${icon('dot','ico-sm')}</span><strong title="model ${esc(model)}">${esc(_sentenceStart(purposeLabel))}</strong>`
      +(activeCall.role?` <span class="pc-when">${esc(activeCall.role)}</span>`:'');
  } else if(terminalFailure){
    focusLabel='Work status';
    const purpose=PURPOSE_VERB[terminalFailure.purpose]
      ||String(terminalFailure.purpose||'model call').replace(/_/g,' ');
    doingHTML=`<span class="pc-failure-mark">${icon('warn','ico-sm')}</span><strong>A work step needs attention</strong>`
      +`<span class="pc-when"${terminalFailure.model?` title="model ${esc(terminalFailure.model)}${terminalFailure.status?` · HTTP ${esc(terminalFailure.status)}`:''}"`:''}>${esc(_sentenceStart(purpose))}</span>`;
  } else if(mechanicalRun.key==='running'){
    focusLabel='Mechanical run state';
    doingHTML=`<span class="pc-rest">${icon('play','ico-sm')}</span><strong>Running</strong>`
      +`<span class="pc-when">${esc(mechanicalRun.detail)}</span>`;
  } else if(mechanicalRun.key==='quiescent'){
    focusLabel='Mechanical run state';
    doingHTML=`<span class="pc-rest">${icon('dot','ico-sm')}</span><strong>Quiescent</strong>`
      +`<span class="pc-when">${esc(mechanicalRun.detail)}</span>`;
  } else if(mechanicalRun.key==='resource-paused'){
    focusLabel='Mechanical run state';
    doingHTML=`<span class="pc-rest">${icon('warn','ico-sm')}</span><strong>Resource-paused</strong>`
      +`<span class="pc-when">${esc(mechanicalRun.detail)}</span>`;
  } else if(mechanicalRun.key==='cancelled'){
    focusLabel='Mechanical run state';
    doingHTML=`<span class="pc-failure-mark">${icon('x','ico-sm')}</span><strong>Cancelled</strong>`
      +`<span class="pc-when">${esc(mechanicalRun.detail)}</span>`;
  } else if(hasModels){
    const purposeLabel=humanActivityPresentation('MODEL_CALL',{purpose:last.purpose}).context
      ||PURPOSE_VERB[last.purpose]||String(last.purpose||'activity').replace(/_/g,' ');
    focusLabel=modelFresh?'Recent work':'Most recent work';
    const verb=_sentenceStart(purposeLabel||'working through the task');
    doingHTML=`${running?'<span class="pulse">'+icon('dot','ico-sm')+'</span>':'<span class="pc-rest">'+icon('play','ico-sm')+'</span>'}<strong title="model ${esc(last.model)}">${esc(verb)}</strong>`;
  } else if(actFresh){
    doingHTML=`${running?'<span class="pulse">'+icon('dot','ico-sm')+'</span>':'<span class="pc-rest">'+icon('play','ico-sm')+'</span>'}<strong>${esc(_ixHeadline(recentAct))}</strong>`;
  } else {
    focusLabel='Mechanical run state';
    doingHTML='<span class="pc-rest">'+icon('dot','ico-sm')+'</span><strong>No current run state observed</strong>';
  }
  // TOOL chip: the persona's headline self-extension act (provision / acquire / use /
  // block) within the live window. doingHTML is model-purpose-only when hasModels, so a
  // persona calling models AND just reaching for a tool would otherwise mask the tool act.
  // Strictly additive — does NOT touch pc-msgs/pc-glance/pc-stats. The client projection
  // strips payload, so only the verb is available (no capability name / error).
  const toolAct=[...acts].reverse().find((a)=>a?._observedState!==true
    &&TOOL_KINDS.has(a.kind)&&(Date.now()-a._t)<90000);
  // The substrate refuses reputation_score / experience_tasks / mode_proficiencies /
  // tactic_count / lesson_count on the public summary — those chips could never
  // render and are deleted. brain_fragment_count is public (also in /thinking).
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  // pc-stats footer: assemble the spans first so a model-only persona (s={}, no summary)
  // doesn't render an EMPTY pc-stats div whose border-top draws a stray separator bar.
  // neutral .tag chips with leading stroked glyphs (replaces the colour-emoji prefixes);
  // .tag is additive — the existing pc-stats span styling still applies until shared CSS lands.
  const statHTML=(namePending?`<span class="tag" title="${esc(s.identity_name_pending_reason||'persona-authored name pending')}">${icon('warn','ico-sm')} name pending</span>`:'')
    +(characteristicsPending?`<span class="tag" title="persona-authored characteristics pending">${icon('warn','ico-sm')} traits pending</span>`:'')
    +(s.brain_fragment_count!=null?`<span class="tag" title="brain fragments">${icon('lesson','ico-sm')} ${esc(s.brain_fragment_count)}</span>`:'')
    +(hasOp&&s.brain_compile_count!=null?`<span class="tag" title="brain compiles (operator)">${icon('mode','ico-sm')} ${esc(s.brain_compile_count)}</span>`:'')
    +(rt.task_execution_state?`<span class="tag runtime-tag" title="live task participation status">${icon('task','ico-sm')} ${esc(_humanTaskExecutionState(rt.task_execution_state))}</span>`:'');
  // Runtime state is separate from lifecycle. RUNNING is LLM/model-call only;
  // RECENT is public activity; IDLE means available but no recent activity.
  const dotCls=running?'run':(terminalFailure||mechanicalRun.key==='cancelled'
    ?'error':(recent?'on':'off'));
  const statusBadge=transportStale
    ? `<span class="pc-idle">${d.presence==='offline'?'OFFLINE':'UPDATE DELAYED'}</span>`
    : running ? '<span class="pc-run">WORKING NOW</span>'
    : terminalFailure ? '<span class="pc-failed">NEEDS ATTENTION</span>'
    : mechanicalRun.key==='running'?'<span class="pc-recent">RUNNING</span>'
      :mechanicalRun.key==='quiescent'?'<span class="pc-idle">QUIESCENT</span>'
      :mechanicalRun.key==='resource-paused'?'<span class="pc-idle">RESOURCE-PAUSED</span>'
      :mechanicalRun.key==='cancelled'?'<span class="pc-failed">CANCELLED</span>'
      :(recent?'<span class="pc-recent">RECENT UPDATE</span>':'<span class="pc-idle">NO RUN STATE</span>');
  const lifecycleState=(state||'ACTIVE').toUpperCase();
  const lifecycleBadge=lifecycleState==='ACTIVE'?'':`<span class="pc-life off">${esc(lifecycleState.toLowerCase())}</span>`;
  const authoredCapabilities=identityVerified&&Array.isArray(
    signedIdentity?._personaCapabilitiesSummary)
    ?signedIdentity._personaCapabilitiesSummary:[];
  const authoredCapabilityNames=new Map(authoredCapabilities.map((item)=>[
    String(item?.skill_id||''),String(item?.name||''),
  ]));
  const capabilityHTML=authoredCapabilities.length
    ?`<section class="pc-capabilities"><span class="pc-current-label">What I can contribute</span><div>`
      +authoredCapabilities.slice(0,2).map((capability)=>{
        const parent=String(capability.lineage_parent_skill_id||'');
        const parentName=authoredCapabilityNames.get(parent)||'';
        return `<div class="pc-cap-item" title="${esc(capability.description)}">`
          +`<strong>${esc(capability.name)}</strong><span>${esc(capability.description)}</span>`
          +(parentName?`<small>Derived from ${esc(parentName)}</small>`:'')+`</div>`;
      }).join('')
      +(authoredCapabilities.length>2
        ?`<span class="pc-cap-more">+${authoredCapabilities.length-2} more in profile</span>`:'')
      +`</div></section>`:'';
  const characteristicHTML=_personaCharacteristicsHTML(characteristics,{name,limit:4,compact:true});
  const aboutHTML=characteristicHTML||signedDescription
    ?`<section class="pc-about"><div class="pc-section-head"><span>About me</span><small>${icon('check','ico-sm')} self-described</small></div>`
      +(characteristicHTML||`<p>${esc(signedDescription)}</p>` )+'</section>':'';
  const identityLine=role!==_ROLE_NOT_DECLARED?role
    :(characteristicHeadline?.value||'Self-description still forming');
  const identityLineLabel=role!==_ROLE_NOT_DECLARED?'Self-described role'
    :(characteristicHeadline?.label||'Self-description');
  const identityLineTitle=authoredRole!==_ROLE_NOT_DECLARED
    ?'Explicit persona-authored role in the verified profile'
    :characteristicHeadline
      ?`Persona-authored ${characteristicHeadline.label.toLowerCase()} from the verified open-vocabulary characteristic profile`
      :'No persona-authored characteristic description is present yet';
  // HONEST recency tag on the doing line: when did this persona last actually do
  // something (model event / coordination act / cognition / tool use)? So an "active"
  // card reads "3m ago" instead of an unbounded-green claim. Hidden while running-now.
  const lastSeen=Math.max(S.lastModelSeenAt?.get(personaKey)||0, recentAct?._t||0, toolAct?._t||0);
  if(!running && !terminalFailure && lastSeen>0) doingHTML+=`<span class="pc-when">${_ago(lastSeen)}</span>`;
  const hue=_personaAvatarHue(personaKey);
  const environments=(context.environments||[]).filter(Boolean).map((env)=>({
    ...env,current:!!currentEnvironmentId&&environmentIdentity(env.sid)===currentEnvironmentId,
  })).sort((left,right)=>Number(right.current)-Number(left.current));
  const workspaceRows=(context.liveWorkspaces||[]).filter((row)=>row&&typeof row.run==='string'&&row.run.trim());
  const workspaceTimes=workspaceRows.map((row)=>Date.parse(row.generatedAt||''));
  const newestWorkspaceAt=workspaceTimes.length&&workspaceTimes.every(Number.isFinite)
    ?Math.max(...workspaceTimes):null;
  const currentWorkspaceRows=newestWorkspaceAt===null?workspaceRows
    :workspaceRows.filter((row)=>Date.parse(row.generatedAt||'')===newestWorkspaceAt);
  const workspaceRuns=[...new Set(currentWorkspaceRows
    .map((row)=>typeof row?.run==='string'?row.run.trim():'').filter(Boolean))];
  // An active call's exact run outranks workspace recency. This prevents a
  // finalized predecessor from being presented as the work happening now while
  // a new run has not emitted its first workspace snapshot yet.
  const activeRuns=[...new Set(indexedActiveCalls
    .map((call)=>typeof call?.run_id==='string'?call.run_id.trim():'').filter(Boolean))];
  const hasActiveCalls=indexedActiveCalls.length>0;
  const taskRun=activeRuns.length===1?activeRuns[0]
    :(!hasActiveCalls&&workspaceRuns.length===1?workspaceRuns[0]:'');
  const verifiedCurrentTask=taskRun?_verifiedPublicTaskForRun(ref.kernel,taskRun):null;
  // A recent or terminal workspace proves task history, not present execution.
  // Promote its title onto the persona card only when the exact signed task
  // lifecycle independently says this run is the current live execution.
  const currentTask=verifiedCurrentTask?.liveTask===true
    &&typeof verifiedCurrentTask.task==='string'?verifiedCurrentTask.task:'';
  // C-OP-16: the member's own scorecard -- by its exact run first, then by
  // its task's newest settle (labelled), bounded to its environments.
  const scorecardTaskId=String(verifiedCurrentTask?.taskId
    ||(taskRun?(S.recs.get(_pkTaskFacts(ref.kernel,'',taskRun)?.recordId)?.task_lifecycle?.task_id||''):'')||'');
  const scorecardHit=_scorecardForRun(ref.kernel,taskRun,scorecardTaskId,environments.map((env)=>env.sid),
    S.personaDiscoveryByKey.get(personaKey)||null);
  const currentTaskHTML=currentTask
    ?`<section class="pc-current pc-current-task"><span class="pc-current-label">Task I'm working on</span><div class="pc-doing"><strong title="${esc(currentTask)}">${esc(_compactHumanLabel(currentTask,104))}</strong></div></section>`:'';
  const environmentHTML=environments.length?`<section class="pc-environments"><span class="pc-current-label">Working in</span><div>`
    +environments.slice(0,4).map((env)=>`<button type="button" class="pc-env-chip${env.current?' current':''}" data-envrec="${esc(env.sid)}" data-envkernel="${esc(env.kernel||ref.kernel)}" title="open ${esc(env.name)}">${icon('box','ico-sm')}<span>${esc(env.name)}</span></button>`).join('')
    +(environments.length>4?`<span class="pc-env-more">+${environments.length-4}</span>`:'')+`</div></section>`
    :enrichmentPending
      ?`<section class="pc-environments independent"><span class="pc-current-label">Workspace</span><div><span class="pc-env-none">loading workspace details…</span></div></section>`
    :`<section class="pc-environments independent"><span class="pc-current-label">Workspace</span><div><span class="pc-env-none">working independently</span></div></section>`;
  const authoredWorkHTML=_personaAuthoredWorkHTML(personaKey,ref.kernel,mechanicalRun);
  // ---- collectible face bindings ----
  // Verified signed card body (retained on the record only after the exact
  // participation-card signature verified) supplies alias + self_publication.
  const verifiedCardBody=identityVerified&&signedIdentity?.persona_card?.card
    &&typeof signedIdentity.persona_card.card==='object'
    &&!Array.isArray(signedIdentity.persona_card.card)?signedIdentity.persona_card.card:null;
  const aliasRaw=verifiedCardBody?.display_name_alias;
  const aliasName=aliasRaw&&typeof aliasRaw==='object'&&!Array.isArray(aliasRaw)
    ?String(aliasRaw.display_name||'').trim().slice(0,80):'';
  const pkName=aliasName||(hasSignedName?name:'')||sid.slice(0,6);
  const selfPub=verifiedCardBody?.self_publication;
  const selfPubBody=selfPub&&typeof selfPub==='object'&&!Array.isArray(selfPub)
    ?String(selfPub.body||'').trim():'';
  const speciesLine=_compactHumanLabel(selfPubBody||signedDescription||'',120)||'Neutral persona';
  const speciesTitle=selfPubBody?'persona self-publication (signed card)'
    :signedDescription?'signed card description':'no self-description published yet';
  // DOING NOW: persona-authored work note first, then the mechanical
  // task-execution state, then the richer live-telemetry line computed above.
  const cogStats=_pkCognitionStats(personaKey);
  const feedWorkNote=currentWorkState&&currentWorkState.work_note
    &&typeof currentWorkState.work_note==='object'&&!Array.isArray(currentWorkState.work_note)
    ?currentWorkState.work_note:null;
  const pkWorkNote=feedWorkNote||cogStats?.workNote||null;
  // the doing line is for humans: machine-style states ("executed_and_published")
  // read as words, and the exact authored text stays one hover away
  const pkWorkNoteText=pkWorkNote
    ?String(pkWorkNote.observed_state||pkWorkNote.status||'').trim():'';
  const pkWorkNoteHuman=pkWorkNoteText?humanizeMachineKey(pkWorkNoteText):'';
  const execDoing=PK_TASK_EXEC_DOING[String(s.task_execution_state||'')]||'';
  const pkPulse=s.llm_execution_state==='running'||running;
  const pkDoingHTML=pkWorkNoteHuman
    ?`<strong title="${esc(pkWorkNoteText)} — persona-authored work note">${esc(_compactHumanLabel(pkWorkNoteHuman,90))}</strong>`
    :execDoing?`<strong>${esc(execDoing)}</strong>`:doingHTML;
  const envBadgeCount=Array.isArray(s.active_environment_ids)
    ?s.active_environment_ids.length
    :(environments.length||cogStats?.envCount||0);
  const pkTypeRow=`<div class="pk-typerow">`
    +(cogStats?.model?`<span class="pk-type model" title="model in the public cognition doc">${icon('mode','ico-sm')}<span>${esc(cogStats.model)}</span></span>`:'')
    +`<span class="pk-type envs" title="environment memberships">${icon('box','ico-sm')}<span>${envBadgeCount} env${envBadgeCount===1?'':'s'}</span></span>`
    +`</div>`;
  const pkStat=(value,label,title)=>value!=null
    ?`<span class="pk-stat" title="${esc(title)}"><b>${esc(value)}</b><small>${esc(label)}</small></span>`:'';
  const pkStatRow=cogStats?`<div class="pk-statrow" aria-label="verified cognition counters">`
    +pkStat(cogStats.ep,'EPISODES','thinking episodes retained in this persona\'s verified memory')
    +pkStat(cogStats.fr,'FRAGMENTS','memory fragments kept from its work')
    +pkStat(cogStats.tl,'TOOLS','tools it acquired and can use')
    +pkStat(cogStats.ev,'EVOLUTIONS','times it updated its own knowledge or tactics')
    +`</div>`:'';
  // C-OP-16: a persona that stated its refusal of the identity requirement is
  // shown with its own reason, as its claim, instead of an indefinite "pending".
  const identityDecline=hasSignedName?null:_verifiedIdentityDecline(personaKey);
  const proofHTML=hasSignedName?icon('check','ico-sm')+' self-chosen name verified'
    :identityDecline?icon('check','ico-sm')+` identity declined · stated reason: <q class="persona-authored-claim-inline" title="${esc(identityDecline.reason)}">${esc(_compactHumanLabel(identityDecline.reason,96))}</q>`
    :identityPending?icon('check','ico-sm')+' profile verified · name pending'
    :hasSignedIdentity?icon('check','ico-sm')+' participation verified · name unavailable'
    :icon('warn','ico-sm')+` profile proof ${identityProofState}`;
  return `<article class="pcard pk ${_coordRoleClass(role)}${hasSignedIdentity?' identity-signed':' identity-unpublished'}${identityPending||!identityVerified?' identity-pending':''}${running?' running':terminalFailure?' failed':recent?' live':''}${grew&&!running?' flashcard':''}" style="--avatar-hue:${hue}" data-pcard="${esc(sid)}" data-pkey="${esc(_domEntityKey(personaKey))}" data-pkernel="${esc(ref.kernel)}" data-identity-state="${hasSignedName?'named':identityDecline?'declined':identityPending?'materializing':hasSignedIdentity?'name-pending':identityProofState}" role="button" tabindex="0" title="open ${esc(pkName)}">`
    +`<div class="pc-card-shine" aria-hidden="true"></div><div class="pc-card-edition"><span>${hasSignedIdentity?icon('check','ico-sm')+' VERIFIED PROFILE':identityPending?icon('warn','ico-sm')+' PROFILE BEING CREATED':icon('warn','ico-sm')+` PROFILE PROOF ${identityProofState.toUpperCase()}`}</span><span>PERSONA</span></div>`
    +`<header class="pk-namebar"><h3 class="pc-name"${nameRole.exactName&&nameRole.exactName!==pkName?` title="Exact signed identity: ${esc(nameRole.exactName)}"`:hasSignedName?'':` title="This persona hasn't chosen its name yet — its id is ${esc(sid)}"`}>${esc(pkName)}</h3>`
    +`<div class="pc-badges">${statusBadge}${lifecycleBadge}</div>`
    +`<button class="pc-follow" data-follow="${esc(_domEntityKey(personaKey))}" title="focus on ${esc(pkName)}" aria-label="focus on ${esc(pkName)}" aria-pressed="false">${icon('target','ico-sm')}</button></header>`
    +`<figure class="pk-art">${_personaAvatarHTML(personaKey,{identityVerified})}<i class="pc-dot ${dotCls}" aria-hidden="true"></i></figure>`
    +`<span class="pc-name-proof">${proofHTML}</span>`
    +`<p class="pk-species" title="${esc(speciesTitle)}">${esc(speciesLine)}</p>`
    +`<section class="pc-current pk-doing-face"><span class="pc-current-label">Doing now${pkPulse?' <i class="pk-pulse" aria-hidden="true" title="model call running"></i>':''}</span><div class="pc-doing">${pkDoingHTML}</div></section>`
    // The consumable story lives on the face: the exact task, the rooms the
    // persona works in, its newest signed thinking/update, and the files it
    // published. The dossier keeps identity detail and the long activity tail.
    +currentTaskHTML+environmentHTML+authoredWorkHTML
    +_personaActivityHTML(acts,personaKey)
    +pkTypeRow
    +_ownedOutputsHTML(context.artifacts,{label:'My published files',scope:'my work'})
    // C-OP-16: what the member built this run, and the run's kernel-signed
    // scorecard, lead the face beside the published files.
    +_builtThisRunHTML(context,taskRun)
    +_runScorecardHTML(scorecardHit?.scorecard,{compact:true,via:scorecardHit?.via||'run'})
    +`<details class="pk-dossier"><summary>Full dossier · verified work log</summary>`
    +`<span class="pc-role-line" title="${esc(identityLineTitle)}"><small>${esc(identityLineLabel)}</small><strong>${esc(identityLine)}</strong></span>`
    +(pkStatRow?`<div class="pc-stats dossier-stats">${pkStatRow}</div>`:'')
    +aboutHTML+capabilityHTML
    +(pkWorkNoteText||execDoing?`<section class="pc-current"><span class="pc-current-label">${esc(focusLabel)}</span><div class="pc-doing">${doingHTML}</div></section>`:'')
    +'</details>'
    +(statHTML?`<div class="pc-stats">${statHTML}</div>`:'')
    +`<footer class="pk-setline" title="host node ${esc(String(ref.kernel||'').replace(/^kernel:/,''))} · persona id ${esc(sid)}"><span class="pk-set-no" aria-hidden="true"></span><span class="pk-set-kind">verified persona</span></footer>`
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
    &&_eventEligibleForRecency(event)
    &&now-event._t<=lease&&event._t-now<30000);
}
function _environmentGraphId(b){
  let value=2166136261;
  for(const char of `${b?.kernel||''}\u0000${b?.sid||b?.envId||''}`){ value^=char.charCodeAt(0); value=Math.imul(value,16777619); }
  return `env-arrow-${(value>>>0).toString(36)}`;
}
function _environmentCommunicationGraphHTML(b){
  const refs=[...new Set((b?.members||[]).map((value)=>_personaRef(value,b?.kernel).key).filter(Boolean))];
  const scopedEvents=_environmentScopedEvents(b);
  const environmentId=environmentIdentity(b?.sid||b?.envId);
  const memberState=(personaKey)=>{ const d=S.liveByPersona.get(personaKey)||{};
    const models=(d.models||[]).filter((model)=>
      environmentIdentity(model?.environment)===environmentId);
    const recentEvent=scopedEvents.find((event)=>
      Date.now()-event._t<90000&&_interactionPersonaKeys(event).includes(personaKey));
    const recent=_modelFresh(personaKey,models)||!!recentEvent;
    return {running:_personaRunningInEnvironment(personaKey,environmentId,b?.kernel),recent}; };
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
    html:`<section class="env-network empty"><div class="env-network-head"><span>People working together</span><small>No participants yet</small></div>`
      +`<div class="env-network-empty">No participants have joined this workspace yet.</div></section>`};

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
    const identityVerified=providerVerifiedPersonaObservation(personaKey)?.identityVerified===true;
    const stateLabel=state.running?'model call':(state.recent?'recent':'idle');
    return `<button type="button" class="env-persona-node ${state.running?'running':state.recent?'recent':'idle'}" style="--node-x:${positions.get(personaKey).x}%;--node-y:${positions.get(personaKey).y}%" data-pcard="${esc(ref.sid)}" data-pkey="${esc(_domEntityKey(personaKey))}" data-pkernel="${esc(ref.kernel)}" title="open ${esc(_signedPersonaNameFor(personaKey))}">`
      +`<span class="env-node-portrait">${_personaAvatarHTML(personaKey,{identityVerified})}<i aria-hidden="true"></i></span>`
      +`<strong>${esc(_signedPersonaNameFor(personaKey))}</strong><small>${esc(stateLabel)}</small></button>`;
  }).join('');
  const directEvents=scopedEvents.filter((event)=>event.actor_kind==='persona'&&_personaEndpoints(event).length).slice(-3).reverse();
  const feed=directEvents.length?`<ol class="env-comm-feed" aria-live="polite" aria-relevant="additions text">${directEvents.map((event)=>{
    const actor=_nameFor(_eventPersonaKey(event,event.actor_id));
    const recipients=_personaEndpoints(event).map((endpoint)=>_nameFor(_eventPersonaKey(event,endpoint.id))).slice(0,3);
    return `<li><span>${esc(actor)} <b>→</b> ${esc(recipients.join(', '))}</span><small>${esc(_ixVerb(event.kind))} · ${esc(_ago(event._t))}</small></li>`;
  }).join('')}</ol>`:`<div class="env-comm-quiet">No person-to-person collaboration was observed in the last five minutes.</div>`;
  return {activeCount,eventCount:scopedEvents.length,directCount:edges.size,
    html:`<section class="env-network"><div class="env-network-head"><span>People working together</span><small>${activeCount} working now · ${edges.size} direct conversation${edges.size===1?'':'s'}</small></div>`
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
    .filter((e)=>_eventEligibleForRecency(e)
      &&now-e._t<=5*60*1000&&e._t-now<30000).slice(-10);
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
    .filter((e)=>_eventEligibleForRecency(e)
      &&now-e._t<=5*60*1000&&e._t-now<30000);
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
  const upsertCore=(kernel,x,y,summary,{fresh=true,focused=false,label='LIVE NODE'}={})=>{
    let core=svg._cores.querySelector(`[data-kernel-core="${cssEsc(kernel)}"]`);
    if(!core){ core=_svg('g',{},'core'); core.setAttribute('data-kernel-core',kernel);
      core.setAttribute('role','button'); core.setAttribute('tabindex','0');
      core.appendChild(_svg('title',{}));       core.appendChild(_svg('circle',{r:36},'core-ring'));
      core.appendChild(_svg('circle',{r:30},'core-c'));
      core.appendChild(_svg('text',{y:-14},'core-t'));
      core.appendChild(_svg('text',{y:4},'core-id'));
      core.appendChild(_svg('text',{y:22},'core-s')); svg._cores.appendChild(core); }
    core.setAttribute('transform',`translate(${x},${y})`);
    core.setAttribute('class',`core${focused?' focused':''}${fresh?'':' core-offline'}`);
    core.style.setProperty('--beat',beat+'s');
    core.children[0].textContent=`${kernel} · ${summary}`;
    core.children[3].textContent='NODE';
    core.children[4].textContent=label;
    core.children[5].textContent=summary;
    core.setAttribute('aria-label',`${label} — ${summary}. Select to inspect this node.`);
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
      upsertCore(row.kernel,+x.toFixed(1),cy,summary,{fresh:row.fresh||row.reachable,label:'PUBLIC NODE'}); coreIds.add(row.kernel); });
    [...svg._cores.children].forEach((core)=>{ if(!coreIds.has(core.getAttribute('data-kernel-core'))) core.remove(); });
    svg._edges.innerHTML=''; svg._chords.innerHTML=''; svg._axons.innerHTML=''; svg._nodes.innerHTML=''; svg._linkfire.innerHTML='';
    // an empty map states itself instead of rendering a silent dark plate
    if(!n){
      svg._edges.innerHTML=`<text x="${cx}" y="${cy-6}" text-anchor="middle" class="cg-hint">no nodes discovered yet</text>`
        +`<text x="${cx}" y="${cy+14}" text-anchor="middle" class="cg-hint dim">nodes appear here as signed announcements resolve</text>`;
    }
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
  upsertCore(effectiveFocus,cx,cy,coreSummary,{fresh:focusedReachable||runningN>0,
    focused:!!S.kernelFocus,label:'FOCUSED NODE'});
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
  if(graphScope) graphScope.textContent='FOCUSED NODE';
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
  if(running && !RM && _vitalPhase-_lastBeatAt>=beatFrames){ _lastBeatAt=_vitalPhase; }
  // render each heartbeat as a short decay pulse rather than a 1-frame tick —
  // at 180×32 a single-frame spike is invisible and the vital reads as dead
  if(running && !RM){ const beat=Math.exp(-(_vitalPhase-_lastBeatAt)/4);
    if(beat>.03) sample=Math.max(sample,.34*beat); }
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
  // leading-edge dot, coloured by the most recent event class (dim when idle so
  // the trace still reads as a live instrument, not an empty box)
  const last=_vitalBuf[_vitalBuf.length-1];
  ctx.fillStyle=last.v>.1?last.col:'rgba(72,88,106,.9)';
  ctx.beginPath(); ctx.arc((N-1)*(w/N),mid-last.v*amp,2.2,0,7); ctx.fill();
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
    kernelIsFocused(d?.kernel)&&!!providerVerifiedPersonaObservation(personaKey)).length;
  const recPersonaKeys=new Set();
  for(const id of S.order){ const r=S.recs.get(id);
    if(r?.kind!=='persona'||!kernelIsFocused(r._kernel)) continue;
    const sid=_shortId(r.did||r.record_id), personaKey=sid?_personaKey(r._kernel,sid):'';
    if(personaKey&&providerVerifiedPersonaObservation(personaKey)) recPersonaKeys.add(personaKey);
  }
  const recPersona=recPersonaKeys.size;
  const personasN=Math.max(livePersona,recPersona);
  const now=Date.now();
  // RUNNING = provider/document-verified persona observations currently named by
  // either admitted live telemetry or kernel-signed public cognition.
  // Coordination-only traffic stays in acts/min so "running" always means LLM.
  const activePersonaKeys=new Set();
  for(const personaKey of S.personaDiscoveryByKey.keys()){
    const ref=_personaRef(personaKey);
    if(!kernelIsFocused(ref.kernel)||!providerVerifiedPersonaObservation(personaKey)) continue;
    if(_runningNow(personaKey)) activePersonaKeys.add(personaKey);
  }
  const active=activePersonaKeys.size;
  const acts=(S.interactions||[]).filter((e)=>_eventEligibleForRecency(e)
    &&now-e._t<60000&&kernelIsFocused(e._kernel||kernelForBase(e._base))).length;
  // "verified" counts ONLY Ed25519-verified records (S.recs all pass verifyRecord);
  // unverified live interactions are NOT signed and must never inflate this.
  const signed=S.order.filter((id)=>kernelIsFocused(S.recs.get(id)?._kernel)).length;
  const publicRead=freshPublicReadStatusBases(now).length>0;
  setV('#st-auth',publicRead?'public read':'discover');
  const authEl=$('#st-auth'); if(authEl){ authEl.classList.toggle('auth-read',publicRead);
    authEl.title=publicRead
      ?'public node — complete tokenless read projection available; browser mutations are disabled'
      :'no complete public node status observed yet — discovery remains public and tokenless'; }
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

function _paintVerifiedIdentityShells(host){
  if(host.querySelector('.pcard,.env-card')&&host.dataset.identityShell!=='1') return;
  const query=String(S.q||'').trim().toLowerCase();
  const personaCandidates=[...S.personaDiscoveryByKey.keys()].filter((personaKey)=>{
    const ref=_personaRef(personaKey);
    if(!kernelIsFocused(ref.kernel)||!providerVerifiedPersonaObservation(personaKey)) return false;
    return !query||`${_signedPersonaNameFor(personaKey)} ${_coordRole(ref.sid,{},ref.kernel)}`.toLowerCase().includes(query);
  });
  const environmentCandidates=S.order.map((id)=>S.recs.get(id)).filter((record)=>{
    if(record?.kind!=='env'||!kernelIsFocused(record._kernel)) return false;
    const sid=_envSid(record), name=_environmentNameFor(sid,record._kernel);
    const type=(record.capability_summary||[])
      .filter((value)=>value&&value!=='project_workspace').at(-1)||'workspace';
    return !query||`${name} ${humanizeMachineKey(type)} ${sid}`.toLowerCase().includes(query);
  });
  if(!personaCandidates.length&&!environmentCandidates.length) return;
  const visible=personaCandidates.slice(0,NETWORK_LIMITS.personaInitial);
  const visibleEnvironments=environmentCandidates.slice(0,NETWORK_LIMITS.environmentInitial);
  S.visiblePersonaIds.clear();
  visible.forEach((personaKey)=>S.visiblePersonaIds.add(personaKey));
  const cards=visible.map((personaKey)=>{
    const ref=_personaRef(personaKey);
    return renderPersonaCard(personaKey,ref.kernel,{enrichmentPending:true});
  }).join('');
  const environmentCards=visibleEnvironments.map((record)=>{
    const sid=_envSid(record), kernel=String(record._kernel||'');
    const name=_environmentNameFor(sid,kernel);
    const rawType=(record.capability_summary||[])
      .filter((value)=>value&&value!=='project_workspace').at(-1)||'workspace';
    const type=humanizeMachineKey(rawType);
    return `<article class="env-card pk record-signed" data-envsid="${esc(sid)}" data-envkernel="${esc(kernel)}" data-verification="signed-record" style="--envhue:${_envHue(sid)}" aria-label="environment ${esc(name)}">`
      +`<div class="env-card-foil" aria-hidden="true"></div>`
      +`<div class="pc-card-edition"><span>${icon('check','ico-sm')} SIGNED WORKSPACE</span><span>ENVIRONMENT</span></div>`
      +`<header class="pk-namebar env"><h3 class="pc-name env-name" data-envrec="${esc(sid)}" data-envkernel="${esc(kernel)}" role="button" tabindex="0" title="open ${esc(name)}">${esc(name)}</h3>`
      +`<div class="pc-badges"><span class="env-state ok">verified</span></div></header>`
      +`<figure class="pk-art env">${identiconSVG(sid,{className:'pk-identicon env',title:`workspace identicon for ${name}`})}</figure>`
      +`<span class="env-kicker">SHARED WORKSPACE · ${esc(type)} · SIGNED IDENTITY</span>`
      +`<div class="env-card-empty">Loading people, current work, and files…</div>`
      +`<div class="env-card-footer"><span>Workspace identity verified</span><span>Details loading</span></div></article>`;
  }).join('');
  const hidden=Math.max(0,personaCandidates.length-visible.length);
  const hiddenEnvironments=Math.max(0,environmentCandidates.length-visibleEnvironments.length);
  const warmPending=S.fastOriginRefreshPending===true;
  S.envCount=Math.max(S.envCount,environmentCandidates.length);
  S.renderedEnvironmentKeys=new Set(visibleEnvironments.map((record)=>
    _environmentKey(record._kernel,_envSid(record))));
  const counts=[];
  if(visible.length) counts.push(`${compactCount(visible.length)} ${visible.length===1?'persona':'personas'}`);
  if(visibleEnvironments.length) counts.push(`${compactCount(visibleEnvironments.length)} ${visibleEnvironments.length===1?'workspace':'workspaces'}`);
  const personaSection=cards?`<section class="persona-section"><header class="stage-section-head"><div><span class="section-kicker">PERSONA DECK</span>`
    +`<h2>${warmPending?'Previously verified personas':'Verified personas'}</h2></div><p role="status">${warmPending?'Signature checks passed; freshness is being confirmed now.':'Verified personas found; loading live workspace details.'}</p></header>`
    +`<div class="persona-deck">${cards}</div>`
    +(hidden?`<div class="persona-window-note"><span>${hidden} additional verified ${hidden===1?'persona':'personas'} will appear with the enriched view</span></div>`:'')
    +`</section>`:'';
  const environmentSection=environmentCards?`<section class="environment-section"><header class="stage-section-head compact"><div><span class="section-kicker">ENVIRONMENT INDEX</span>`
    +`<h2>${warmPending?'Previously verified workspaces':'Verified workspaces'}</h2></div><p role="status">${warmPending?'Signature checks passed; freshness is being confirmed now.':'Workspace identities found; loading people, activity, and files.'}</p></header>`
    +`<div class="environment-grid">${environmentCards}</div>`
    +(hiddenEnvironments?`<div class="persona-window-note"><span>${hiddenEnvironments} additional verified ${hiddenEnvironments===1?'workspace':'workspaces'} will appear with the enriched view</span></div>`:'')
    +`</section>`:'';
  const html=`<div class="stage-summary"><div><strong>${counts.join(' · ')} on screen</strong>`
    +` <span class="scope-copy">· ${warmPending?'previously verified identities · checking the current signed inventory':'loading live activity and artifacts'}</span></div></div>`
    +personaSection+environmentSection;
  host.dataset.identityShell='1';
  host.dataset.h=html;
  host.innerHTML=html;
  rebindInspectionSource();
  _hydratePersonaAvatars();
  _applyFollow();
}

let _sysBusy=false, _sysQueued=false;
// ---- disclosure persistence across stage repaints -------------------------
// The stage is repainted by innerHTML swap on every data change, which used to
// snap every open <details> (artifact groups, dossiers, diagnostics) shut
// within seconds of the viewer opening it. Record explicit viewer toggles by a
// stable key and re-apply them after each swap.
function _disclosureKey(details){
  const card=details.closest('[data-pcard],[data-envsid]');
  const scope=card?`${card.dataset.pcard?'p':'e'}:${card.dataset.pcard||card.dataset.envsid}`:'stage';
  const group=[...details.classList].find((cls)=>cls.startsWith('group-'));
  let kind=group||['pk-dossier','pc-diagnostics','fv-source','artifact-file-group']
    .find((cls)=>details.classList.contains(cls))||details.className||'details';
  if(!group){
    const siblings=[...(card||details.closest('#sysEnvs')||document).querySelectorAll('details')]
      .filter((candidate)=>candidate.className===details.className);
    const index=siblings.indexOf(details);
    if(index>0) kind+=`#${index}`;
  }
  return `${scope} ${kind}`;
}
function _rememberDisclosure(details){
  const store=S.openDisclosures=S.openDisclosures||new Map();
  const key=_disclosureKey(details);
  store.delete(key); store.set(key,details.open);
  while(store.size>400) store.delete(store.keys().next().value);
}
function _restoreDisclosures(host){
  const store=S.openDisclosures; if(!store||!store.size) return;
  for(const details of host.querySelectorAll('details')){
    const wanted=store.get(_disclosureKey(details));
    if(wanted!==undefined&&details.open!==wanted) details.open=wanted;
  }
}
async function refreshSystemView(){
  const host=$('#sysEnvs'); if(!host) return;
  if(host.dataset.disclosureWatch!=='1'){
    host.dataset.disclosureWatch='1';
    host.addEventListener('toggle',(event)=>{
      const details=event.target;
      if(details instanceof HTMLDetailsElement) _rememberDisclosure(details);
    },true);
  }
  // Provider inventory verification often finishes before slower environment,
  // artifact and telemetry enrichment. Paint those already-admitted persona
  // identities immediately, while naming the still-pending join honestly.
  _paintVerifiedIdentityShells(host);
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
    const personaRows=Object.entries(ent.personas||{}).slice(0,NETWORK_LIMITS.personaInitial*4);
    const environmentRows=Object.entries(ent.environments||{}).slice(0,NETWORK_LIMITS.environmentInitial*4);
    const [personaFeeds,environmentFeeds]=await Promise.all([
      Promise.all(personaRows.map(async([,rel])=>{
        const feed=await fetchEntityFeed(base,rel);
        return _ingestVerifiedPersonaEntityFeed(base,feed);
      })),
      Promise.all(environmentRows.map(async([eid,rel])=>{
      const feed=await fetchEntityFeed(base,rel); if(!feed) return null;
      const members=(feed.members||[]).map((member)=>{
        const raw=member&&typeof member==='object'?(member.persona_id||member.id):member;
        const memberSid=_shortId(raw); return memberSid?_personaKey(kernel,memberSid):'';
      }).filter((personaKey)=>!!providerVerifiedPersonaObservation(personaKey));
      const sid=_shortId(eid);
      return {base,kernel,envId:eid,sid,name:feed.name||eid,type:feed.env_type||'',
        status:feed.status||'',members,spans:feed.spans||[],feedDoc:feed,run:null,
        recId:null,live:true,verified:false};
      })),
    ]);
    const personaKeys=personaFeeds.filter(Boolean);
    if(personaKeys.length) scheduleSseCognitionRefresh({base,personaKeys});
    return environmentFeeds.filter(Boolean);
  }));
  // The compact verified cards are already on screen. Repaint them with the
  // just-arrived signed entity state before exports, manifests and artifact
  // history perform their separate, potentially larger joins below.
  _paintVerifiedIdentityShells(host);
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
      if(!b.artifactManifestRel) b.artifactManifestRel=manifestRel;
      if(manifestRel&&b.artifactManifestRel===manifestRel) b.artifactManifestRouteVerified=true; }
    else { b={base:r._base||'',kernel:r._kernel||'',envId:r.did||sid,sid,
        name:r.label||sid,type:cap[cap.length-1]||'env',status:'',members:[],spans:[],
        run,recId:id,live:false,verified:true,exportRel,artifactManifestRel:manifestRel,
        artifactManifestRouteVerified:!!manifestRel};
      bySid.set(k,b); envBlocks.push(b); }
  }
  // (2b) An env whose LIVE feed is absent (a federated env, or any env whose live
  // telemetry dropped after a node RESTART) still has its signed, durable export doc
  // (links.export → environments/<id>.json) carrying its full member ROSTER. Pull it
  // so the personas that worked in the env still SHOW in the env (members + count),
  // instead of a "no members" lane — the env's people don't vanish on restart.
  S.observedEnvironmentCount=envBlocks.length;
  const prefetchLimit=Math.min(512,Math.max(40,S.environmentWindow*3));
  const prefetchWindow=selectPriorityWindow(envBlocks,{
    query:S.q||'',limit:prefetchLimit,keyOf:(b)=>envKey(b.kernel,b.sid),
    priorityOf:(b)=>(b.live?1e6:0)+(b.status==='active'?1e5:0)+Math.min(9999,b.members.length),
    searchTextOf:(b)=>`${b.kernel} ${b.name} ${b.type} ${b.status} ${b.members.map((m)=>_nameFor(m,b.kernel)).join(' ')}`,
  });
  envBlocks.length=0; envBlocks.push(...prefetchWindow.items);
  await Promise.all(envBlocks.map(async(b)=>{
    let ed=null;
    if(b.exportRel) ed=await fetchEntityFeed(b.base,b.exportRel);
    const exportedEnvironment=environmentIdentity(ed?.environment_id);
    const exportMatches=!!exportedEnvironment&&exportedEnvironment===environmentIdentity(b.sid);
    if(exportMatches&&Array.isArray(ed.members)&&!b.members.length){
      b.roster=ed.members;
      b.members=ed.members.map((m)=>{ const memberSid=_shortId(m.persona_id||m.id||'');
        return memberSid?_personaKey(b.kernel,memberSid):''; })
        .filter((personaKey)=>!!providerVerifiedPersonaObservation(personaKey));
      b.members.forEach((m)=>assigned.add(m));
      if(!b.status) b.status=ed.status||'';
      b.fromExport=true;
    }
    if(exportMatches){
      // Environment-authored display title from the export's
      // environment_identity. Presentation only (bounded + escaped at render);
      // the verified record label remains the workspace's identity authority.
      const exportIdentity=ed.environment_identity;
      const exportTitle=exportIdentity&&typeof exportIdentity==='object'
        &&!Array.isArray(exportIdentity)?String(exportIdentity.title||'').trim():'';
      if(exportTitle&&!/[\u0000-\u001f\u007f]/u.test(exportTitle))
        b.exportTitle=exportTitle.slice(0,120);
    }
    const manifestRel=b.artifactManifestRel||(exportMatches&&ed.artifact_manifest)||'';
    if(manifestRel){
      const mf=await fetchEntityFeed(b.base,manifestRel);
      if(mf&&Array.isArray(mf.artifacts)){
        b.artifactManifestRel=manifestRel;
        b.artifactManifest=mf;
      }
    }
  }));
  // Only verified discovery labels and exact signed task context lead the
  // visual surface. The export route has no independent document-authenticity
  // marker, so its self-asserted name is never promoted into a workspace name.
  // An opaque environment identity stays available on the record, but is never
  // used as the workspace's human-facing name.
  for(const b of envBlocks){
    b.name=_environmentNameFor(b.sid,b.kernel);
  }
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
    if(block&&providerVerifiedPersonaObservation(personaKey)
      &&!block.members.includes(personaKey)){ block.members.push(personaKey); assigned.add(personaKey); block.memberSource='observed telemetry'; }
  }
  S.envCount=envBlocks.length;
  // personas known live but not in any env feed → a node-roster lane
  const orphans=[...S.liveByPersona.entries()].filter(([personaKey,d])=>{ const ref=_personaRef(personaKey);
    return kernelIsFocused(d?.kernel||ref.kernel)&&!assigned.has(personaKey)
      &&!!providerVerifiedPersonaObservation(personaKey);
  }).map(([personaKey])=>personaKey);
  // refresh the friendly-name map from discovered persona records
  for(const id of S.order){ const r=S.recs.get(id); if(r.kind==='persona'){
    const sid=_shortId(r.did||r.record_id), personaKey=_personaKey(r._kernel,sid);
    const authoredName=_personaAuthoredNameForObservation(
      providerVerifiedPersonaObservation(personaKey));
    if(authoredName)
      _PERSONA_NAME.set(personaKey,authoredName);
    else _PERSONA_NAME.delete(personaKey); } }
  // Artifacts join their environment only through exact verified environment
  // authority, and their member only through the signed declaring persona
  // (falling back to the access owner). A run, title or observation order
  // can never manufacture either binding; an artifact belongs to both
  // (C-OP-16: "what the member built").
  const artByEnv=new Map();
  const artByPersona=new Map();
  const unresolvedArtifacts=[];
  for(const id of S.order){ const r=S.recs.get(id);
    if(r.kind!=='artifact'||!kernelIsFocused(r._kernel)) continue;
    const authority=environmentAuthorityOfRecord(r);
    let target='';
    if(authority.status==='resolved') target=envKey(r._kernel,authority.environmentId);
    else unresolvedArtifacts.push({record:r,authority});
    if(target) (artByEnv.get(target)||artByEnv.set(target,[]).get(target)).push(r);
    const owner=_artifactDeclaringSid(r);
    if(owner){ const pk=_personaKey(r._kernel,owner);
      (artByPersona.get(pk)||artByPersona.set(pk,[]).get(pk)).push(r); }
  }
  const envArtifacts=(b)=>artByEnv.get(envKey(b.kernel,b.sid))||[];
  const envManifestFiles=(b)=>manifestArtifacts(b&&b.artifactManifest);
  const envHasArtifacts=(b)=>envManifestFiles(b).length>0||envArtifacts(b).length>0;
  const liveWorkspacesByPersona=new Map(), liveWorkspacesByEnv=new Map();
  for(const state of S.liveArtifacts.values()){
    const snap=state?.snapshot||{};
    for(const ws of (snap.workspaces||[])){
      const workspaceId=String(ws.workspace_id||''), personaId=_shortId(ws.persona_id||''), environmentId=environmentIdentity(ws.environment_id);
      const workspaceFiles=[...state.files.values()].filter((f)=>String(f.workspace_id||'')===workspaceId)
        .sort((a,b)=>String(a.path||'').localeCompare(String(b.path||'')));
      const fileCount=workspaceFiles.length;
      const authored=[...new Set(workspaceFiles.flatMap((file)=>authoredArtifactLabels(file)))].slice(0,8);
      const row={base:state.base,kernel:String(snap.node_id||kernelForBase(state.base)||''),run:state.run,environmentId,workspaceId,fileCount,files:workspaceFiles,authored,state:ws.state||'live',
        captureBoundary:snap.capture_boundary||null,ended:state.ended===true,
        terminalState:String(state.terminalState||''),terminalStatus:String(state.terminalStatus||''),
        generatedAt:String(snap.generated_at||''),revision:String(state.revision||''),receivedAt:Number(state.receivedAt)||0};
      if(personaId){ const pk=_personaKey(snap.node_id||kernelForBase(state.base),personaId);
        (liveWorkspacesByPersona.get(pk)||liveWorkspacesByPersona.set(pk,[]).get(pk)).push(row); }
      if(environmentId){ const ek=envKey(snap.node_id||kernelForBase(state.base),environmentId);
        (liveWorkspacesByEnv.get(ek)||liveWorkspacesByEnv.set(ek,[]).get(ek)).push(row); }
    }
  }
  // A manifest-only generation can have one verified bundle card but no
  // per-file cards. Resolve its manifest only from the latest run's exact route
  // in those already provider/document-verified artifact rows. Conflicting
  // routes or run bindings fail closed; environment titles and fetch order have
  // no authority here.
  await Promise.all(envBlocks.map(async(b)=>{
    const rows=envArtifacts(b); if(!rows.length||_artifactRevisionProjection(rows).current?.rows.length) return;
    const runs=[...new Set(rows.map((row)=>runOf(row)).filter(Boolean))].sort();
    const run=runs.at(-1); if(!run) return;
    const currentRows=rows.filter((row)=>runOf(row)===run);
    const routes=[...new Set(currentRows.map((row)=>String(row?._links?.artifact_manifest||'')).filter(Boolean))];
    if(routes.length!==1) return;
    const route=routes[0], routeRun=(route.match(/(?:^|\/)k\/(run-[0-9A-Za-z]+)(?:\/|$)/)||[])[1]||'';
    if(routeRun!==run) return;
    const manifest=await fetchEntityFeed(b.base,route);
    if(manifest?.schema!=='personaos-event-driven-artifact-manifest/1'||!Array.isArray(manifest.artifacts)) return;
    b.artifactManifestRel=route; b.artifactManifest=manifest; b.artifactManifestRouteVerified=true;
  }));

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
    const identityVerified=providerVerifiedPersonaObservation(ref.key)?.identityVerified===true;
    return `${ref.sid} ${ref.kernel} ${_nameFor(ref.key)} ${identityVerified?s.name||'':''} ${identityVerified?s.role||'':''} ${s.lifecycle_state||''} ${rt.task_execution_state||''}`; };
  // first-seen deliverable ids → mint-flash a chip the moment it ships (not on every poll,
  // and not the whole set on cold load); mirrors the ixColdLoaded pattern.
  S.seenArts=S.seenArts||new Set();
  const envOutputContext=(b)=>{
    const arts=envArtifacts(b);
    const declaredProjection=_artifactRevisionProjection(arts);
    const routedManifestEntries=b.artifactManifestRouteVerified===true?envManifestFiles(b):[];
    const routedManifestFiles=routedManifestEntries.slice(0,LIVE_ARTIFACT_LIMITS.maxFiles);
    const manifestUnique=new Map();
    for(const file of routedManifestFiles){ const path=String(_artifactDisplayPath(file)||'').normalize('NFC')
        .replace(/[\u0000-\u001f\u007f]/gu,' ').trim().slice(0,LIVE_ARTIFACT_LIMITS.maxPathLength);
      if(!path) continue; if(manifestUnique.has(path)) manifestUnique.delete(path);
      // Only the bounded filename crosses this unverified-manifest fallback.
      // MIME, size, hashes, semantic claims and body routes remain unavailable.
      manifestUnique.set(path,{title:path}); }
    const currentManifestFiles=[...manifestUnique.values()];
    const manifestRunMatch=String(b.artifactManifestRel||'').match(/(?:^|\/)k\/(run-[0-9A-Za-z]+)(?:\/|$)/);
    const manifestRunId=manifestRun(b.artifactManifest)||(manifestRunMatch?.[1]||'');
    // A workspace can publish several signed bundle generations. Only the latest
    // generation is the current file set; prior generations remain history and
    // must never be added into the headline (3 files + 4 files is 4 current, not 7).
    const fileCount=declaredProjection.current?.rows.length||(manifestRunId?currentManifestFiles.length:0);
    const metaFiles=fileCount;
    const liveEnvRows=liveWorkspacesByEnv.get(envKey(b.kernel,b.sid))||[];
    const liveProjection=_currentLiveWorkspaceProjection(liveEnvRows);
    const liveFileCount=_liveWorkspaceCurrentFileCount(liveEnvRows);
    const newestLiveRun=[...new Set(liveProjection.current
      .filter((row)=>(row.files?.length||0)>0).map((row)=>String(row.run||'')).filter(Boolean))]
      .sort().at(-1)||'';
    const declaredCurrentRows=declaredProjection.current?.rows||[];
    const newestDeclaredRun=[...new Set(declaredCurrentRows.map((row)=>runOf(row)).filter(Boolean))]
      .sort().at(-1)||manifestRunId;
    // A personal worktree snapshot is useful live evidence, but it is not
    // authority to hide a later, durably published environment generation.
    // In particular, an older artifact-rich snapshot must not mask a newer
    // reviewed package merely because later scratch worktrees captured zero
    // files. Keep both evidence lanes visible and put the newest published
    // generation first when its monotonic run id outranks the live capture.
    const publishedOutranksLive=!!newestDeclaredRun&&(!newestLiveRun||newestDeclaredRun>newestLiveRun);
    const liveEnvOutputs=_liveWorkspacesHTML(liveEnvRows,{label:publishedOutranksLive
      ?'Earlier captured worktrees':'Live shared worktree',scope:'environment worktree'});
    const manifestOutputs=!declaredCurrentRows.length&&currentManifestFiles.length&&manifestRunId
      ?`<section class="owned-outputs env-owned-outputs current-artifacts"><div class="owned-outputs-head"><span>Shared outputs</span><small>${currentManifestFiles.length} manifest filename${currentManifestFiles.length===1?'':'s'} · verified route · body unverified</small></div>`
        +_artifactExactFormatCountsHTML(currentManifestFiles,(file)=>String(file?.title||''))
        +_artifactGroupedListHTML(currentManifestFiles,{pathOf:(file)=>String(file?.title||''),
          render:(file)=>_artifactPreviewActionHTML(file,{scope:'environment worktree',base:b.base,run:manifestRunId,verifiedMetadata:false}),
          ariaLabel:'Shared outputs — current manifest filenames'})
        +`<div class="artifact-preview-note">The manifest route and run come from a verified record, but the fetched manifest bytes are not independently signed or hash-bound. Filenames remain visible; preview stays unavailable until signed file cards or a signed live snapshot supplies authoritative hashes.</div>`
        +(routedManifestEntries.length>currentManifestFiles.length?`<div class="owned-output-history">${routedManifestEntries.length-currentManifestFiles.length} manifest entries not shown after bounded, unique-path projection</div>`:'')
        +`<div class="artifact-revision-history"><b>Revision history</b><span>No earlier verified file-card generation is published for this manifest-only workspace.</span></div></section>`:'';
    const declaredEnvOutputs=declaredCurrentRows.length
      ?_ownedOutputsHTML(arts,{label:publishedOutranksLive?'Current published outputs':'Published shared outputs',scope:'environment worktree'})
      :manifestOutputs;
    const artRow=declaredEnvOutputs+liveEnvOutputs;
    const departed=b.fromExport && (b.roster||[]).length>0 && (b.roster||[]).every((m)=>m&&m.active===false);
    const rawStatus=String(b.status||(b.live?'':'discovered')).toLowerCase();
    const statusTxt=departed?'Archived':({active:'Open',running:'Working',paused:'Paused',idle:'Idle',discovered:'Discovered'})[rawStatus]
      ||_sentenceStart(rawStatus||'Available');
    const statusOk=(b.status==='active' && !departed);
    return {artRow,departed,statusTxt,statusOk,
      metaFiles:publishedOutranksLive?(metaFiles||liveFileCount):(liveFileCount||metaFiles)};
  };
  const environmentCardHTML=(b)=>{ const output=envOutputContext(b), liveRow=renderEnvLaneLive(b);
    const network=_environmentCommunicationGraphHTML(b);
    const membershipRow=b.members.length?'':'<div class="env-card-empty">Waiting for the first participant</div>';
    const type=String(b.type||'workspace').replace(/_/g,' ');
    // Environment-authored title (export environment_identity.title) leads the
    // name bar; the verified record label stays as the identity in the tooltip.
    const envName=b.exportTitle||b.name;
    // Mechanical task facts from the signed task discovery record for this
    // environment/run: task_state + acceptance_state capability tokens.
    const facts=_pkTaskFacts(b.kernel,b.sid,b.run||'');
    const acceptChip=facts?.acceptance?`<span class="pk-accept" title="acceptance state from the signed task record">${esc(facts.acceptance.replace(/_/g,' '))}</span>`:'';
    // DOING NOW: task lifecycle state + active model calls from the verified
    // public environment telemetry feed (model_status.active_calls).
    const envFeedDoc=_retainedVerifiedEntityFeed('environment',b.sid,b.kernel);
    const envActiveCalls=telemetryActiveCalls(envFeedDoc||{}).length;
    const taskState=String(facts?.state||'').replace(/_/g,' ');
    const envBudget=_environmentRunBudget(envFeedDoc||{});
    const doingBits=[taskState?`task ${taskState}`:'',
      envActiveCalls?`${envActiveCalls} model call${envActiveCalls===1?'':'s'} running`:'',
      _runBudgetLabel(envBudget)].filter(Boolean);
    const envDoing=doingBits.length?doingBits.join(' · ')
      :(b.live?'live updates streaming':String(output.statusTxt||'available').toLowerCase());
    // HAVING row: members (count + up to five deterministic mini identicons),
    // mounted tool chips (tool-kind discovery records), current files + bytes.
    const memberMinis=b.members.slice(0,5).map((personaKey)=>{ const mref=_personaRef(personaKey);
      return `<span class="pk-mini" title="${esc(_signedPersonaNameFor(personaKey))}">${identiconSVG(mref.sid,{className:'pk-identicon mini'})}</span>`; }).join('');
    const tools=_pkEnvTools(b.kernel,b.sid);
    const toolChips=tools.slice(0,4).map((tool)=>`<span class="pk-tool"${tool.recordId?` data-artid="${esc(tool.recordId)}" role="button" tabindex="0"`:''} title="persona-acquired tool record">${esc(tool.name)}</span>`).join('')
      +(tools.length>4?`<span class="pk-tool more">+${tools.length-4}</span>`:'');
    const liveState=b.run?liveArtifactState(b.base,b.run):null;
    const liveBytes=liveState?.files?[...liveState.files.values()]
      .reduce((total,file)=>total+(Number(file.size_bytes)||0),0):null;
    const fileCount=output.metaFiles||0;
    return `<article class="env-card pk record-signed" data-envsid="${esc(b.sid)}" data-envkernel="${esc(b.kernel)}" data-verification="signed-record" style="--envhue:${_envHue(b.sid)}" aria-label="environment ${esc(envName)}">`
      +`<div class="env-card-foil" aria-hidden="true"></div>`
      +`<div class="pc-card-edition"><span>${icon('check','ico-sm')} SIGNED WORKSPACE</span><span>ENVIRONMENT</span></div>`
      +`<header class="pk-namebar env"><h3 class="pc-name env-name" data-envrec="${esc(b.sid)}" data-envkernel="${esc(b.kernel)}" role="button" tabindex="0" title="${b.exportTitle?`environment-authored title · verified record label: ${esc(b.name)}`:`open ${esc(envName)}`}">${esc(envName)}</h3>`
      +`<div class="pc-badges"><span class="env-state ${output.statusOk?'ok':''}">${esc(output.statusTxt)}</span>${acceptChip}</div></header>`
      +`<figure class="pk-art env">${identiconSVG(b.sid,{className:'pk-identicon env',title:`workspace identicon for ${envName}`})}</figure>`
      +`<span class="env-kicker">SHARED WORKSPACE · ${esc(type)} · ${b.live?'UPDATES LIVE':'VERIFIED IDENTITY'}</span>`
      +`<section class="pk-having"><span class="pc-current-label">In this workspace</span><div class="pk-having-row">`
      +`<span class="pk-have members" title="participants"><span class="pk-minis">${memberMinis}</span><b>${b.members.length}</b><small>${output.departed?'contributors':'people'}</small></span>`
      +(toolChips?`<span class="pk-have tools" title="mounted persona-acquired tools">${toolChips}</span>`:'')
      +`<span class="pk-have files" title="current shared files${liveBytes!=null?' · live workspace bytes':''}"><b>${fileCount}</b><small>file${fileCount===1?'':'s'}${liveBytes?` · ${fmtBytes(liveBytes)}`:''}</small></span>`
      +`</div></section>`
      +`<section class="pc-current pk-doing-face env"><span class="pc-current-label">Doing now${envActiveCalls?' <i class="pk-pulse" aria-hidden="true" title="model calls running"></i>':''}</span><div class="pc-doing"><strong>${esc(_sentenceStart(envDoing))}</strong></div></section>`
      +`<section class="env-card-stats" aria-label="workspace facts">`
      +`<span>${icon('persona_new','ico-sm')}<b>${b.members.length}</b><small>${output.departed?'contributors':'people'}</small></span>`
      +`<span>${icon('dot','ico-sm')}<b>${network.activeCount}</b><small>working</small></span>`
      +`<span>${icon('arrow','ico-sm')}<b>${network.eventCount}</b><small>updates · 5m</small></span>`
      +`<span>${icon('box','ico-sm')}<b>${output.metaFiles||0}</b><small>files</small></span>`
      +`</section>${membershipRow}`
      // The workspace's produced files ARE the point of the card: surface the
      // published/live output sections; the dossier keeps the social graph
      // and the run lane detail.
      +output.artRow
      +`<details class="pk-dossier"><summary>Workspace activity · people</summary>${network.html}${liveRow}</details>`
      +`<div class="env-card-footer"><span>${b.live?'People and files update live':'Workspace profile verified'}</span><span>Open for full history</span></div></article>`;
  };
  // (3) Preserve every exact environment identity. Shared titles, rosters,
  // tasks, or run references are observations, never authority to collapse one
  // signed context into another.
  const _kept=envBlocks.slice();
  // (4) SORT lanes by activity so running/deliverable-bearing environments lead.
  // Stable sort keeps signed empty environments visible while placing them last.
  const _score=(b)=> (_envLaneLive(b).fresh?8:0)
    + (_envRunningNow(b)?4:0)
    + (((S.liveByEnv.get(_environmentKey(b.kernel,b.sid))||{}).models||[]).length?2:0)
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
    if(!ref.sid||!providerVerifiedPersonaObservation(ref.key)) return null;
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
    +`<h2>People doing the work</h2></div><p>Meet each persona, see what they are doing and read the updates they chose to share.</p></header>`
    +`<div class="persona-deck">${personaCards}</div>${morePersonas}</section>`:'';
  const environmentCards=envBlocks.map(environmentCardHTML).join('');
  const environmentSection=environmentCards?`<section class="environment-section"><header class="stage-section-head compact"><div><span class="section-kicker">ENVIRONMENT INDEX</span>`
    +`<h2>Shared workspaces</h2></div><p>See who is working together, what changed recently and which files they produced.</p></header>`
    +`<div class="environment-grid">${environmentCards}</div></section>`:'';
  S.artsColdLoaded=true;
  const hiddenEnvs=Math.max(0,envCandidates.length-envBlocks.length,
    query?0:(S.observedEnvironmentCount||0)-envBlocks.length);
  const bodyHTML=personaSection+environmentSection;
  const visiblePersonaCount=S.visiblePersonaIds.size;
  const cachedFreshnessPending=S.fastOriginRefreshPending===true;
  const summary=bodyHTML?`<div class="stage-summary"><div><strong>${compactCount(visiblePersonaCount)} ${visiblePersonaCount===1?'persona':'personas'} on screen</strong>`
    +` <span class="scope-copy">· ${compactCount(S.envCount)} environments${cachedFreshnessPending?' · previously verified identities · checking current sources':''}</span></div>`
    +(hiddenEnvs?`<button type="button" class="window-more" data-more-environments="1">show ${Math.min(NETWORK_LIMITS.environmentStep,hiddenEnvs)} more environments</button>`:'')
    +`</div>`:'';
  const routingPressure=unresolvedArtifacts.length
    ?`<div class="routing-pressure" role="status"><strong>${icon('warn','ico-sm')} Environment routing unresolved</strong>`
      +`<span>${unresolvedArtifacts.length} signed artifact${unresolvedArtifacts.length===1?'':'s'} ${unresolvedArtifacts.length===1?'lacks':'lack'} one unambiguous exact verified environment reference. No environment was inferred from its run, title, owner, or observation order.</span>`
      +`<span class="routing-pressure-items">${unresolvedArtifacts.slice(0,4).map(({record,authority})=>{ const count=(authority.candidates||[]).length;
        return `<span><b>${esc(record.label||record.record_id||'artifact')}</b> · ${count?`${esc(count)} candidate${count===1?'':'s'}`:esc(authority.reason||'environment reference absent')}</span>`; }).join('')}`
      +`${unresolvedArtifacts.length>4?`<span>+${unresolvedArtifacts.length-4} more</span>`:''}</span></div>`:'';
  const historyHTML=offlineHistoryHTML();
  let html=summary+routingPressure+bodyHTML+historyHTML;
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
  delete host.dataset.identityShell;
  if(host.dataset.h!==finalHTML){ host.dataset.h=finalHTML; host.innerHTML=finalHTML;
    _restoreDisclosures(host); }
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

// A verified public-cognition row is durable history even after it stops being
// "live now". Presence/model-call styling still expires on its short lease; only
// the exact public activity text remains available to the reader.
function _durablePublicPersonaActivity(event){
  return event?.actor_kind==='persona'&&(
    event?._cognition===true
    ||event?._providerProvisional===true
    ||(event?.signed===true&&typeof event?._exactText==='string'&&!!event._exactText.trim()));
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
  const retained=new Map((S.interactions||[]).map((event)=>[event._key,event]));
  for(const events of (S.cognitionByPersona||new Map()).values())
    for(const [key,event] of events) retained.set(key,event);
  const scoped=[...retained.values()]
    .filter((e)=>kernelIsFocused(e._kernel||kernelForBase(e._base)))
    .sort((left,right)=>Number(left?._t||0)-Number(right?._t||0));
  const all=scoped.filter((e)=>e._t>0&&e._t-now<30000
    &&(now-e._t<=leaseMs||_durablePublicPersonaActivity(e)));
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
    const who=_eventEntityLabel(e.actor_kind||'kernel',e.actor_id,eventKernel);
    const aff=_eventEndpoints(e).map((a)=>_eventEntityLabel(a.kind,a.id,eventKernel));
    const recipientCount=Number.isSafeInteger(e._recipientCount)&&e._recipientCount>0?e._recipientCount:0;
    const targetLabel=recipientCount?`${recipientCount} recipient${recipientCount===1?'':'s'}`:aff.join(', ');
    const arrow=targetLabel?`<span class="ix-arrow">→</span><span class="ix-to">${esc(targetLabel)}</span>`:'';
    const fresh=!S.ixSeen.has(e._key); if(fresh) S.ixSeen.add(e._key);
    // thread spine when this row shares a real scope_id with the one above it
    const sid=e.scope_id&&/[:/]/.test(String(e.scope_id))?String(e.scope_id):null;
    const threaded=sid&&sid===prevScope; prevScope=sid;
    const spine=threaded?`<span class="ix-spine${fresh?' grow':''}" style="--thread:${_threadHue(sid)}"></span>`:'';
    // read the row like a live MESSAGE: "<persona> <verb> → <to> · <detail>".
    const presentation=humanActivityPresentation(e.kind,e._provenance||{});
    const verb=presentation.headline;
    const completeText=flt==='think'&&typeof e._exactText==='string'&&e._exactText.trim()
      ?e._exactText:String(e._msg||'');
    const humanDetail=completeText||presentation.summary;
    const msg=humanDetail?`<span class="ix-msg${completeText===e._exactText?' complete':''}">${esc(humanDetail)}</span>`:'';
    const trust=_activityTrustBadgeHTML(e);
    const context=_activityPrimaryContextHTML(e,{className:'ix-human-context',kernel:eventKernel});
    const technical=_activityTechnicalHTML(e,eventKernel);
    // capability/tool detail from the backend _cap projection: WHICH capability + its error
    const capDetail=cap&&(cap.capability||cap.tool_name)
      ?`<span class="ix-cap">${esc(cap.capability||cap.tool_name)}${cap.ok===false&&cap.error?' · '+esc(String(cap.error).split('\n')[0].slice(0,90)):''}</span>`:'';
    const rationaleTitle=e._exactText?_cognitionPreview(e._exactText):e._rationale;
    const ttl=rationaleTitle?` title="${esc(rationaleTitle)}"`:(cap&&cap.error?` title="${esc(cap.error)}"`:'');
    return `<li class="ix ix-${c}${fail?' fail':''}${fresh?' fresh':''}${threaded?' threaded':''}${(f&&!matches(e))?' dimmed':''}"${ttl}>`
      +spine+`<span class="ix-kind">${_ixGlyph(c)}${esc(verb)}</span>`
      +`<span class="ix-from">${esc(who)}</span>${arrow}${msg}${capDetail}${trust}`
      +`<span class="ix-scope">${esc((e.scope==='cognition'||e.scope==='model')?'':e.scope||'')}</span>${context}`
      +`<span class="ix-time">${_eventTimeHTML(e)}</span>${technical}</li>`;
  }).join('')||(()=>{
    // A node may publish a signed public-cognition tier. Private nodes answer the
    // same anonymous probe with 404, so an empty THINK feed must stay neutral: the
    // browser cannot infer whether the persona is quiet or its cognition is private.
    if(flt==='think' && Object.keys((typeof opTokens==='function'?opTokens():{})).length===0)
      return '<li class="l2" style="padding:10px">no signed public cognition has been retained — this node may be quiet or keep its cognition private.</li>';
    // warming: a reachable node is running but no act has streamed yet — say so on the
    // unfiltered feed rather than implying nothing is funded (honest only when warming).
    if(flt==='all' && isWarming())
      return '<li class="loading-inline">'
        +'<span class="dot live" style="background:var(--up);box-shadow:0 0 6px var(--up)"></span>'
        +'<span><b style="color:var(--up)">node is producing the first candidate</b> — coordination acts will stream here shortly.</span></li>';
    // idle-but-alive: reachable + heartbeat running but NOT busy —
    // honest amber, never the green 'producing' claim.
    if(flt==='all' && isIdleAlive())
      return '<li class="loading-inline">'
        +'<span class="dot" style="background:var(--amber);box-shadow:0 0 6px var(--amber)"></span>'
        +'<span><b class="amber">node is online — no active task run observed</b> — submit a task or add budget to an existing run from the operator console.</span></li>';
    // presence check so the intentional empty-string label (all) survives the lookup
    const lbl={all:'',think:'thinking ',coord:'coordination ',verify:'verification ',artifact:'artifact ',tool:'tool ',crossenv:'cross-env '};
    const q=(flt in lbl)?lbl[flt]:(flt+' ');
    return '<li class="l2" style="padding:10px">no '+esc(q)+'activity is currently retained — submit or resume a task run to watch personas coordinate.</li>';
  })();
  if(!atTop) el.scrollTop=prevTop+(el.scrollHeight-prevH);
  // headline count must match what the reader sees: the grand total only for the
  // default all+no-follow view, else the shown (tab-filtered, follow-matching) count.
  const r=$('#sysStreamRate'); if(r){
    const narrowed=(flt!=='all')||!!f;
    const shown=f?rows.filter(matches).length:rows.length;
    const durable=all.filter(_durablePublicPersonaActivity).length;
    r.textContent=narrowed?`${shown} of ${all.length} activity records`
      :`${all.length} activity records${durable?` · ${durable} retained persona history`:''}`;
  }
  // self-filter so an active search query keeps filtering the feed even when this is
  // called directly (tab-switch / follow toggle / cognition merge), not only via the 5s caller.
  if(S.q) document.querySelectorAll('#sysStream .ix').forEach((li)=>{ if(!li.textContent.toLowerCase().includes(S.q)) li.style.display='none'; });
  // prune the 'seen' set to the live ring unconditionally — a node streaming ONLY
  // cognition/model events never hits the indexLiveTelemetry prune, so ixSeen would
  // otherwise leak for the page's life.
  const liveKeys=new Set(scoped.map((e)=>e._key));
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

// Project the small, independently current-master-signed persona entity feed
// into the same presentation index used by aggregate telemetry. This is a
// fast enrichment lane, not a new authority: fetchEntityFeed has already
// verified the document's exact schema, route, subject and signature, and the
// persona must already exist in the verified compact/full discovery inventory.
// The projection reads protocol state only; it never classifies task text,
// roles, domains, tools, or authored work-note vocabulary.
function _ingestVerifiedPersonaEntityFeed(base,doc){
  if(!isPersonaTelemetryDocument(doc)) return '';
  const baseKey=base||'@origin';
  const kernel=String(doc.node_id||doc.kernel_id||kernelForBase(base)||'');
  const expected=String((S.boots?.get(baseKey)||{}).kernel_id||kernelForBase(base)||'');
  if(!kernel||(expected&&kernel!==expected)) return '';
  const pid=_shortId(doc.persona_id), personaKey=_personaKey(kernel,pid);
  if(!pid||!providerVerifiedPersonaObservation(personaKey)) return '';
  const receivedAt=Date.now();
  const observedAt=Date.parse(String(doc.generated_at||''))||receivedAt;
  const current=S.liveByPersona.get(personaKey)||{};
  // A later aggregate/entity observation must not be replaced by an older
  // signed snapshot that happened to finish transport afterwards.
  if(Number(current.observedAt)>observedAt) return personaKey;
  const events=telemetryModelEvents(doc);
  const failures=projectTerminalModelFailures(events);
  const running=doc.summary?.running_llm===true||_activeCalls(doc).length>0;
  const failure=running?null:(failures.byPersona.get(doc.persona_id)
    ||failures.byPersona.get(pid)||failures.latest||current.terminalFailure||null);
  const currentWorkState=doc.current_work_state?.schema
    ==='personaos-persona-work-state-surface/5'?doc.current_work_state:null;
  S.liveByPersona.set(personaKey,{...current,summary:{...(current.summary||{}),...(doc.summary||{})},
    currentWorkState,terminalFailure:failure,sid:pid,generated_at:doc.generated_at,
    base:baseKey==='@origin'?'':baseKey,kernel,observedAt,receivedAt,stale:false,
    _entityFeedVerified:true});
  if(running){ S.lastModelSeenAt=S.lastModelSeenAt||new Map();
    S.lastModelSeenAt.set(personaKey,receivedAt); }
  try{ NETWORK.upsertPresence({...doc.summary,kernel_id:kernel,kind:'persona',persona_id:pid,
    observed_at_ms:observedAt,state:running?'running_llm'
      :(doc.summary?.task_execution_state||doc.summary?.lifecycle_state||'idle')}); }catch(_){ }
  return personaKey;
}
// fetchEntityFeed stores a public entity document only after its exact shape,
// current-master signature, route and subject binding verify. Reuse that admitted
// document in inspectors so a slow peer refresh cannot replace public telemetry
// with a misleading "no telemetry" placeholder.
function _retainedVerifiedEntityFeed(kind,id,kernel){
  const persona=kind==='persona', expected=_shortId(id); let selected=null;
  for(const hit of (S.entFeed||new Map()).values()){
    const doc=hit?.v;
    if(!isPublicEntityTelemetryDocument(doc)
        ||(persona?!isPersonaTelemetryDocument(doc):!isEnvironmentTelemetryDocument(doc))) continue;
    const subject=_shortId(persona?doc.persona_id:doc.environment_id);
    const owner=String(doc.kernel_id||doc.node_id||'');
    if(subject!==expected||owner!==String(kernel||'')) continue;
    if(!selected||Number(hit.ts||0)>Number(selected.ts||0)) selected=hit;
  }
  return selected?.v||null;
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
  const events=telemetryModelEvents(doc); if(!events.length) return '<div class="l2">No recent model-assisted work was published.</div>';
  return events.slice(-16).reverse().map((event)=>{
    const provenance=_publicModelEventProvenance(event,doc.generated_at);
    const projected={...event,signed:true,_provenance:provenance,
      _trustLabel:'KERNEL SIGNED SNAPSHOT',
      _trustTitle:'model-status entry in the verified kernel-signed public telemetry document'};
    const presentation=humanActivityPresentation(event.kind||'MODEL_EVENT',provenance);
    const context=_activityPrimaryContextHTML(projected,{className:'think-human-context',
      kernel:String(doc.kernel_id||doc.node_id||'')});
    return `<div class="think human-model-status"><div><strong>${esc(presentation.headline)}</strong>${_activityTrustBadgeHTML(projected)}</div>`
      +(presentation.summary?`<p>${esc(presentation.summary)}</p>`:'')+context
      +_activityTechnicalHTML(projected,String(doc.kernel_id||doc.node_id||''))+`</div>`;
  }).join('');
}
function renderPersonaFeedDoc(doc,personaKey=''){
  const s=doc.summary||{}; let h='';
  // PER-04 / §4.1: public tiles (state, tasks, reputation); operator-tier evolution
  // internals + GEPA cohort only with an operator token.
  const hasOp=Object.keys((typeof opTokens==='function'?opTokens():{})).length>0;
  h+=`<div class="livegrid">`
    +`<div class="lm"><div class="lmv ${s.lifecycle_state==='ACTIVE'?'ok':''}">${esc(s.lifecycle_state==='ACTIVE'?'Available':_sentenceStart(String(s.lifecycle_state||'observed').replace(/_/g,' ')))}</div><div class="lmk">availability</div></div>`
    +`<div class="lm"><div class="lmv">${esc(s.experience_tasks??0)}</div><div class="lmk">tasks worked</div></div>`
    +(s.reputation_score!=null?`<div class="lm"><div class="lmv ok">${esc(Number(s.reputation_score).toFixed(2))}</div><div class="lmk">reputation</div></div>`:'')
    +(hasOp?`<div class="lm"><div class="lmv">${esc(s.tactic_count??s.cohort_visible_tactic_count??0)}</div><div class="lmk">tactics</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.lesson_count??0)}</div><div class="lmk">lessons</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.memory_count??0)}</div><div class="lmk">memory</div></div>`
      +`<div class="lm"><div class="lmv">${esc(s.fitness!=null?Number(s.fitness).toFixed(1):'—')}</div><div class="lmk">fitness (op)</div></div>`:'')
    +`</div>`;
  if(hasOp&&(s.evolution_trace_count!=null||s.accepted_trace_count!=null))
    h+=`<div class="l2" style="margin:4px 0 0">evolution: ${esc(s.accepted_trace_count??0)}/${esc(s.evolution_trace_count??0)} accepted trials${s.gepa_cohort_id?' · cohort '+esc(String(s.gepa_cohort_id).slice(0,18)):''}</div>`;
  if(s.task_execution_state||s.llm_execution_state){
    h+=`<div class="sublabel">Current participation</div>`
      +kv('Task',esc(_humanTaskExecutionState(s.task_execution_state||'not_participating')))
      +kv('Model-assisted step',esc(s.llm_execution_state==='not_currently_calling'?'Not running now':_sentenceStart(String(s.llm_execution_state||'not reported').replace(/_/g,' '))));
  }
  if(doc.current_work_state?.schema==='personaos-persona-work-state-surface/5')
    h+=_renderPersonaWorkState(doc,{kernel:String(doc.node_id||doc.kernel_id||'')});
  const ref=_personaRef(personaKey||doc.persona_id||'');
  const running=_activeModelCallsForPersona(ref.key).length>0;
  const projected=projectTerminalModelFailures(telemetryModelEvents(doc));
  const feedFailure=projected.byPersona.get(doc.persona_id)||projected.latest;
  const indexedFailure=S.liveByPersona.get(ref.key)?.terminalFailure||null;
  const terminalFailure=running?null:(indexedFailure||feedFailure||null);
  if(terminalFailure) h+=`<div class="sublabel">Work status</div>`
    +_terminalModelFailureHTML(terminalFailure);
  h+=`<div class="sublabel">${isPublicEntityTelemetryDocument(doc)?'Recent verified work':running?'Working now':'Recent model-assisted work'}</div>`
    +(isPublicEntityTelemetryDocument(doc)?_verifiedPublicModelStatusHTML(doc)
      :_liveFeed(feedModels(doc),{historical:!running}));
  const sp=doc.spans||[];
  if(sp.length){ const counts={}; sp.forEach((x)=>{const k2=(x.attributes||{})['personaos.lineage.event_kind']||x.name||'SPAN'; counts[k2]=(counts[k2]||0)+1;});
    h+=`<div class="sublabel">Recent work updates</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k2,v])=>
        `<div class="grant"><span class="l2">${esc(_ixHeadline({kind:k2,_provenance:{}}))}</span><span class="ok">${esc(v)}</span></div>`).join(''); }
  return h;
}
function renderEnvFeedDoc(doc){
  let h=`<div class="livegrid">`
    +`<div class="lm"><div class="lmv ${String(doc.status)==='active'?'ok':''}">${esc(String(doc.status)==='active'?'Open':_sentenceStart(doc.status||'Available'))}</div><div class="lmk">availability</div></div>`
    +`<div class="lm"><div class="lmv">${esc(String(doc.env_type||'workspace').replace(/_/g,' '))}</div><div class="lmk">workspace kind</div></div>`
    +`<div class="lm"><div class="lmv">${esc(doc.member_count??(doc.members||[]).length)}</div><div class="lmk">people</div></div>`
    +`<div class="lm"><div class="lmv">${esc((doc.spans||[]).length)}</div><div class="lmk">updates</div></div>`
    +(()=>{ const budget=_environmentRunBudget(doc);
      return budget?`<div class="lm" title="${esc(_runBudgetLabel(budget))}"><div class="lmv">${esc(`${budget.spent_net}/${budget.granted}`)}</div><div class="lmk">model calls used</div></div>`:''; })()
    +`</div>`;
  const sp=doc.spans||[];
  if(sp.length){ const counts={}; sp.forEach((x)=>{const k2=(x.attributes||{})['personaos.lineage.event_kind']||x.name||'SPAN'; counts[k2]=(counts[k2]||0)+1;});
    h+=`<div class="sublabel">Recent work in this workspace</div>`
      +Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k2,v])=>
        `<div class="grant"><span class="l2">${esc(_ixHeadline({kind:k2,_provenance:{}}))}</span><span class="ok">${esc(v)}</span></div>`).join(''); }
  h+=`<div class="sublabel">Model-assisted work</div>`
    +(isPublicEntityTelemetryDocument(doc)?_verifiedPublicModelStatusHTML(doc):_liveFeed(feedModels(doc)));
  return h;
}
// ---- persona public activity (02_PERSONA §4/§8-10) ----
// A node can opt its bounded persona activity projection into the public tier.
// Anonymous viewers accept only the exact current-master-signed schema below.
// Persona-signed final output remains distinct from closed, kernel-observed
// provisional provider events; the exact thinking FRAME remains operator-only.
function _provisionalPresentationRows(events){
  const source=Array.isArray(events)?events:[], rows=[];
  for(let index=0;index<source.length;index++){
    const first=source[index];
    if(first?.kind!=='assistant_message'){
      rows.push({event:first,events:[first],assistant:false,text:'',firstSequence:first?.sequence,
        lastSequence:first?.sequence,complete:false,mode:'status',presentationKey:''});
      continue;
    }
    const stream=first.stream_delta===true, messageId=String(first.message_id||'');
    const callId=String(first.call_id||''), group=[first];
    // Stream deltas need the provider's exact message binding. Indexed chunks
    // can also be joined without one because their verified 0..count-1 shape
    // supplies an unambiguous boundary inside one exact call.
    if(messageId||!stream){
      while(index+1<source.length){
        const previous=group[group.length-1], next=source[index+1];
        const sameBinding=next?.kind==='assistant_message'
          &&String(next.call_id||'')===callId&&String(next.message_id||'')===messageId
          &&next.sequence===previous.sequence+1;
        const sameShape=stream
          ?next?.stream_delta===true
          :next?.stream_delta!==true&&next?.chunk_count===first.chunk_count
            &&next?.chunk_index===previous.chunk_index+1;
        if(!sameBinding||!sameShape) break;
        group.push(next); index++;
      }
    }
    const last=group[group.length-1], chunkCount=stream?null:first.chunk_count;
    const complete=!stream&&Number.isSafeInteger(chunkCount)
      &&first.chunk_index===0&&group.length===chunkCount
      &&last.chunk_index===chunkCount-1;
    rows.push({
      event:last,events:group,assistant:true,mode:stream?'stream':'chunks',complete,
      text:group.map((event)=>event.text).join(''),firstSequence:first.sequence,
      lastSequence:last.sequence,chunkCount,
      // An exact provider message binding, or an indexed chunk boundary inside
      // one call, is stable enough to replace a growing presentation row.
      presentationKey:messageId?['message',callId,messageId].join('\u0000')
        :!stream?['chunks',callId,'',String(first.sequence),String(chunkCount)].join('\u0000'):'',
    });
  }
  // Tool/provider status can legitimately occur between deltas for the same
  // exact provider message. Present those admitted text segments as one logical
  // window while retaining the intervening status rows in chronological order.
  const streamGroups=new Map();
  rows.forEach((row,index)=>{
    const messageId=String(row.event?.message_id||''), callId=String(row.event?.call_id||'');
    if(row.mode!=='stream'||!messageId||!callId) return;
    const key=`${callId}\u0000${messageId}`;
    const group=streamGroups.get(key)||{events:[],text:'',firstSequence:row.firstSequence,
      lastSequence:row.lastSequence,lastIndex:index,lastRow:row};
    group.events.push(...row.events); group.text+=row.text;
    group.lastSequence=row.lastSequence; group.lastIndex=index; group.lastRow=row;
    streamGroups.set(key,group);
  });
  const presented=rows.flatMap((row,index)=>{
    const messageId=String(row.event?.message_id||''), callId=String(row.event?.call_id||'');
    if(row.mode!=='stream'||!messageId||!callId) return [row];
    const group=streamGroups.get(`${callId}\u0000${messageId}`);
    if(!group||group.lastIndex!==index) return [];
    return [{...group.lastRow,events:group.events,text:group.text,
      firstSequence:group.firstSequence,lastSequence:group.lastSequence}];
  });
  // Select exactly one presentation for each exact provider message. A full
  // indexed set is strongest; until it arrives, an aggregated live stream is
  // more informative than a partial indexed window. Source events remain in
  // the signed document and its verification path.
  const choices=new Map();
  presented.forEach((row,index)=>{
    const messageId=String(row.event?.message_id||''), callId=String(row.event?.call_id||'');
    if(!row.assistant||!messageId||!callId) return;
    const key=`${callId}\u0000${messageId}`;
    const priority=row.complete?3:row.mode==='stream'?2:1;
    const prior=choices.get(key);
    if(!prior||priority>prior.priority||(priority===prior.priority&&index>prior.index))
      choices.set(key,{index,priority});
  });
  return presented.filter((row,index)=>{
    const messageId=String(row.event?.message_id||''), callId=String(row.event?.call_id||'');
    if(!row.assistant||!messageId||!callId) return true;
    return choices.get(`${callId}\u0000${messageId}`)?.index===index;
  });
}
function _renderPersonaWorkState(t,{kernel='',retainedSnapshot=false}={}){
  const state=t?.current_work_state;
  const personaKey=_personaKey(kernel,String(t?.persona_id||state?.persona_id||''));
  const live=S.liveByPersona.get(personaKey)||{};
  const model=_personaModelHistory(personaKey,live.models||[]).at(-1)||null;
  const acts=(S.ixByPersona&&S.ixByPersona.get(personaKey))||[];
  const mechanical=_personaMechanicalRunProjection(
    model,kernel,acts,personaKey,state||null);
  if(!state||state.schema!=='personaos-persona-work-state-surface/5'){
    const mechanicalClass=mechanical.key==='running'?'is-working'
      :mechanical.key==='resource-paused'||mechanical.key==='cancelled'?'is-waiting':'is-stale';
    return `<section class="work-state-card work-state-empty"><div class="work-state-head">`
      +`<div><span class="work-state-kicker">Public work note</span><strong>No persona-authored work note yet</strong></div>`
      +`<span class="work-state-status ${mechanicalClass}">${esc(mechanical.label)}</span>`
      +`</div><p>${esc(mechanical.detail)} No signed open-vocabulary note is published for this persona and task.</p></section>`;
  }
  const bindingLabel=state.bound_to_latest_observation
    ?'Bound to latest observation':'Not bound to latest observation';
  const environment=_environmentNameFor(state.environment_id,kernel);
  const lifecycle=_taskContextForExactReferences(
    state.task_id,'',state.environment_id,kernel);
  const task=String(lifecycle?.task||'').trim();
  const context=[task,environment].filter(Boolean);
  const provenance=[
    ['Authored at',state.authored_at],['Work-state ID',state.work_state_id],
    ['Note ID',state.note_id],
    ['Content hash',state.work_state_content_hash],['Situation hash',state.situation_hash],
    ['Latest observed situation hash',state.latest_observed_situation_hash],
    ['Bound to latest observation',String(state.bound_to_latest_observation)],
    ['Signing key',state.signing_key_id],['Persona signature',state.signature_hex],
  ];
  return `<section class="work-state-card">`
    +`<div class="work-state-head"><div><span class="work-state-kicker">${retainedSnapshot?'Retained signed snapshot':'Signed persona work note'}</span>`
    +`<strong>Persona-authored work note</strong></div><span class="work-state-status">${esc(bindingLabel)}</span></div>`
    +(context.length?`<div class="work-state-context">${context.map(esc).join('<span aria-hidden="true">·</span>')}</div>`:'')
    +_personaWorkNoteComparisonHTML(state,mechanical)
    +`<p class="work-note-neutrality">Each persona’s note is shown independently. The browser does not infer agreement, readiness, or completion from its vocabulary.</p>`
    +(state.causal_refs.length?`<details class="work-note-lineage"><summary>${state.causal_refs.length} exact causal ${state.causal_refs.length===1?'reference':'references'}</summary><ul>${state.causal_refs.map((ref)=>`<li><code>${esc(ref)}</code></li>`).join('')}</ul></details>`:'')
    +`<details class="work-note-lineage work-note-provenance"><summary>Signature and note provenance</summary><dl>${provenance.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd><code>${esc(value)}</code></dd></div>`).join('')}</dl></details>`
    +`<div class="work-state-verification">${icon('check')} Publisher reports the persona signature and signing key verified; this browser verified the enclosing current-master snapshot${retainedSnapshot?' · retained public snapshot':''}</div>`
    +'</section>';
}
function renderThinking(t,{allowThinkingFrame=false,kernel='',retainedSnapshot=false}={}){
  let h='';
  const publicCognition=_publicCognitionDocOk(t);
  const activeCalls=t.active_calls||[];
  const recentCalls=publicCognition?(t.recent_calls||[]):[];
  const callsById=new Map([...recentCalls,...activeCalls]
    .map((call)=>[call.call_id,call]));
  const taskRunCache=new Map();
  const resolveTaskRun=(runKernel,task)=>{
    const key=`${runKernel}\u0000${task}`;
    if(!taskRunCache.has(key)) taskRunCache.set(key,_verifiedPublicTaskRun(runKernel,task));
    return taskRunCache.get(key);
  };
  const callContext=(call)=>{
    const lifecycle=_taskContextForExactReferences(
      call?.task_id,call?.run_id,call?.environment_id,kernel);
    const task=lifecycle?.task||'';
    const workspace=lifecycle?_environmentNameFor(lifecycle.environment,kernel):'';
    return [task?`task · ${task}`:'',workspace?`workspace · ${workspace}`:''].filter(Boolean);
  };
  if(publicCognition){
    h+=_renderPersonaWorkState(t,{kernel,retainedSnapshot});
    h+=_personaAgenticDevelopmentHTML(t.agentic_development,{compact:false});
  }
  let technical='';
  if(activeCalls.length){
    technical+=`<div class="l2" style="margin:2px 0 3px">${retainedSnapshot
      ?'Calls active when this verified snapshot was captured — retained history, not current execution'
      :'Active model calls — verified current snapshot'}</div>`
      +[...activeCalls].reverse().map((call)=>{
        const started=Date.parse(String(call.started_at||''));
        const purpose=String(call.requested_purpose||'').trim()||'purpose not declared';
        const signedMeta=publicCognition?_activityProvenanceHTML(_publicCallProvenance(call),{
          className:'think-provenance',full:true,kernel,prepend:_eventTrustHTML({signed:true,
            _trustLabel:retainedSnapshot?'KERNEL SIGNED SNAPSHOT CALL':'KERNEL SIGNED ACTIVE CALL',
            _trustTitle:retainedSnapshot
              ?'model call recorded as active when this retained kernel-signed public cognition snapshot was captured; not a current execution claim'
              :'active model call in the verified current kernel-signed public cognition snapshot'})}):'';
        return `<div class="think"><span class="amber">${esc(call.status||'active')}</span> ${esc(purpose)}`
          +`<div class="l2"><code>${esc(call.model_id||'model not declared')}</code>`
          +(call.reasoning_effort?` · reasoning ${esc(call.reasoning_effort)}`:'')
          +(call.reasoning_effort_source?` · ${esc(call.reasoning_effort_source.replace(/_/g,' '))}`:'')
          +(Number.isFinite(started)?` · started ${esc(_ago(started))}`:'')+`</div>`
          +(callContext(call).length?`<div class="l2">${callContext(call).map(esc).join(' · ')}</div>`:'')
          +signedMeta+`</div>`;
      }).join('');
  }
  if(recentCalls.length){
    technical+=`<div class="l2" style="margin:6px 0 3px">Recent model calls — verified finished snapshots</div>`
      +[...recentCalls].reverse().map((call)=>{
        const started=Date.parse(String(call.started_at||''));
        const ended=Date.parse(String(call.ended_at||''));
        const purpose=String(call.requested_purpose||'').trim()||'purpose not declared';
        const signedMeta=_activityProvenanceHTML(_publicCallProvenance(call),{
          className:'think-provenance',full:true,kernel,prepend:_eventTrustHTML({signed:true,
            _trustLabel:'KERNEL SIGNED FINISHED CALL',
            _trustTitle:'finished model call in the verified kernel-signed public cognition snapshot'})});
        return `<div class="think"><span class="amber">finished</span> ${esc(purpose)}`
          +`<div class="l2"><code>${esc(call.model_id||'model not declared')}</code>`
          +(call.reasoning_effort?` · reasoning ${esc(call.reasoning_effort)}`:'')
          +(call.reasoning_effort_source?` · ${esc(call.reasoning_effort_source.replace(/_/g,' '))}`:'')
          +(Number.isFinite(ended)?` · ended ${esc(_ago(ended))}`:'')
          +(Number.isFinite(started)&&Number.isFinite(ended)?` · ${esc(Math.max(0,ended-started))} ms`:'')+`</div>`
          +(callContext(call).length?`<div class="l2">${callContext(call).map(esc).join(' · ')}</div>`:'')
          +signedMeta+`</div>`;
      }).join('');
  }
  const provisional=publicCognition?(t.provisional_outputs||[]):[];
  if(provisional.length){
    const visibleProvisional=_provisionalPresentationRows(provisional);
    technical+=`<div class="privacy-note">${retainedSnapshot?'Retained provider-stream snapshot':'Live provider stream'} — kernel-observed and provisional, not persona-signed cognition or hidden reasoning${retainedSnapshot?', and not current execution':''}.</div>`
      +visibleProvisional.map((presented,index)=>{ const event=presented.event;
        const call=callsById.get(event.call_id);
        const provenance=_publicProvisionalProvenance(event,call);
        if(presented.assistant&&presented.firstSequence!==presented.lastSequence)
          provenance.sequence=`${presented.firstSequence}–${presented.lastSequence}`;
        const trustLabel=presented.assistant
          ?presented.complete?'KERNEL OBSERVED · COMPLETE CHUNK SET':'KERNEL OBSERVED · ADMITTED WINDOW'
          :'KERNEL OBSERVED · PROVISIONAL';
        const trustTitle=presented.assistant
          ?presented.complete
            ?'verified kernel-signed public snapshot; every advertised assistant chunk is present, but the provider observation remains provisional and is not persona-signed cognition or hidden reasoning'
            :'verified kernel-signed public snapshot; all displayed text is from the admitted provider-event stream, whose beginning and end are not asserted'
          :'verified kernel-signed public snapshot; provisional provider event, not persona-signed cognition or hidden reasoning';
        const signedMeta=_activityProvenanceHTML(provenance,{className:'think-provenance',full:true,kernel,
          prepend:_eventTrustHTML({signed:true,_trustLabel:trustLabel,_trustTitle:trustTitle})});
        const sequence=presented.firstSequence===presented.lastSequence
          ?String(presented.firstSequence):`${presented.firstSequence}–${presented.lastSequence}`;
        const assistantWindow=presented.mode==='stream'
          ?`${presented.events.length} verified delta${presented.events.length===1?'':'s'} · admitted stream window`
          :presented.complete
            ?`${presented.events.length}/${presented.chunkCount} verified chunks · complete chunk set`
            :`${presented.events.length}/${presented.chunkCount} verified chunks · admitted chunk window`;
        const callMeta=`<div class="l2"><code>${esc(event.model_id||'model not declared')}</code>`
          +` · sequence ${esc(sequence)}`
          +(presented.assistant?` · ${esc(assistantWindow)}`:'')
          +`</div>${signedMeta}`;
        if(presented.assistant){
          const label=presented.mode==='stream'
            ?'provisional assistant stream · admitted window'
            :presented.complete?'provisional assistant message · complete chunk set'
              :'provisional assistant message · admitted chunk window';
          return `<div class="think llmout copy-host"><span class="amber">${label}</span> ${copyBtn()}`
            +`<pre class="ct-pre copy-src" data-provisional-presentation-index="${index}"></pre>${callMeta}</div>`;
        }
        const subject=event.kind==='tool_status'
          ?[event.tool_type,event.tool_name,event.server].filter(Boolean).join(' · ')
          :'provider turn';
        return `<div class="think"><span class="amber">${esc(String(event.kind||'status').replace(/_/g,' '))}</span> ${esc(event.status||'')}`
          +(subject?` · ${esc(subject)}`:'')+callMeta+`</div>`;
      }).join('');
  }
  if(technical){
    const activeLabel=activeCalls.length?`${activeCalls.length} active`:'';
    const recentLabel=recentCalls.length?`${recentCalls.length} recent`:'';
    h+=`<details class="persona-technical-activity"><summary><span>Technical activity</span><small>${esc([activeLabel,recentLabel].filter(Boolean).join(' · '))}</small>${icon('chevron')}</summary>`
      +`<div class="persona-technical-body">${technical}</div></details>`;
  }
  const out=t.recent_outputs||[];
  if(out.length){
    const visibleOutputs=out.map((output,index)=>({output,index})).reverse();
    h+=`<div class="l2" style="margin:2px 0 3px">${publicCognition?'Signed outputs and messages':'Recent authored output'} (newest first)</div>`
      +visibleOutputs.map(({output:o,index})=>{
        const recipients=Array.isArray(o.audience_persona_ids)?o.audience_persona_ids.length:0;
        const recipientNames=recipients?o.audience_persona_ids.map((id)=>_nameFor(id,kernel)):[];
        const trust=publicCognition?_publicOutputTrust(o):null;
        const publicMeta=publicCognition
          ? `<div class="l2">${recipients?`to ${esc(recipientNames.join(', '))}`:'not addressed to another persona'}</div>`
            +_activityProvenanceHTML(_publicOutputProvenance(o,kernel,resolveTaskRun),{className:'think-provenance',full:true,
              kernel,prepend:_eventTrustHTML({signed:true,_trustLabel:trust.label,_trustTitle:trust.title})})
          : '';
        return `<div class="think llmout copy-host"><span class="amber">${esc(_publicOutputLabel(o))}</span> ${copyBtn()}`
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
    h+=`<div class="l2" style="margin:6px 0 3px">${publicCognition
      ?retainedSnapshot?'Signed lessons in retained public snapshot':'Signed lessons in current public state'
      :'Lessons it learned — its own words'}</div>`
      +[...lessons].reverse().map((l)=>
        `<div class="think"><span class="amber">when</span> ${esc(l.trigger||'—')} <span class="amber">→</span> ${esc(l.action||'')}`
        +(l.rationale?`<div class="l2">${esc(String(l.rationale))}</div>`:'')
        +`<div class="l2">confidence ${esc(Number(l.confidence||0).toFixed(2))}</div></div>`).join('');
  }
  const tactics=t.tactics||[];
  if(tactics.length){
    h+=`<div class="l2" style="margin:6px 0 3px">${publicCognition
      ?retainedSnapshot?'Signed tactics in retained public snapshot':'Signed tactics in current public state'
      :'Evolved tactics (EVOLVE-BLOCK · GEPA-signed)'}</div>`
      +[...tactics].reverse().map((x)=>
        `<div class="think">${esc(String(x.action||x.trigger||''))}`
        +`<div class="l2">${esc(x.source||'manual')} · score ${esc(Number(x.score||0).toFixed(2))} · v${esc(x.version||1)}${x.cohort?' · '+esc(x.cohort):''}</div></div>`).join('');
  }
  // /3 carries the brain as mechanical fact counters (the retired
  // lessons/tactics optimizer surfaces are gone); show them as a labeled row.
  if(Number.isSafeInteger(t.brain_episode_count)){
    h+=`<div class="l2" style="margin:6px 0 3px">${retainedSnapshot?'Signed brain state in retained public snapshot':'Signed brain state in current public state'}</div>`
      +`<div class="think brain-counters">`
      +[['episodes',t.brain_episode_count],['fragments',t.brain_fragment_count],
        ['bindings',t.brain_fragment_binding_count],
        ['evolution decisions',t.brain_evolution_decision_count],
        ['evolution applications',t.brain_evolution_application_count]]
        .map(([label,value])=>`<span><b>${esc(value)}</b> <span class="l2">${label}</span></span>`).join(' · ')
      +`</div>`;
  }
  const facts=t.proven_facts||[];
  if(facts.length){
    h+=`<div class="l2" style="margin:6px 0 3px">${publicCognition
      ?retainedSnapshot?'Signed proven facts in retained public snapshot':'Signed proven facts in current public state'
      :'Shared proven facts it holds'}</div>`
      +[...facts].reverse().map((s)=>`<div class="think l2">${esc(String(s))}</div>`).join('');
  }
  const tl=t.evolution_timeline||[];
  if(tl.length){
    h+=`<div class="l2" style="margin:6px 0 3px">${publicCognition?'Signed evolution timeline':'Cognition timeline (signed evolution log)'}</div><div class="tape-mini">`
      +[...tl].reverse().map((e)=>
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
      ?_publicPersonaOutputDisplayText(outputs[index]):'';
    target.textContent=typeof text==='string'?text:String(text??'');
  }
  const provisional=Array.isArray(doc?.provisional_outputs)?doc.provisional_outputs:[];
  const presented=_provisionalPresentationRows(provisional);
  for(const target of host.querySelectorAll('[data-provisional-presentation-index]')){
    const index=Number(target.dataset.provisionalPresentationIndex);
    const text=Number.isSafeInteger(index)&&index>=0&&index<presented.length
      ?presented[index]?.text:'';
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
  'active_calls','agentic_development','evolution_timeline','generated_at','identity_fields',
  'identity_materialization_state','lessons','lifecycle_state','name','persona_id',
  'proven_facts','provisional_outputs','recent_calls','recent_outputs','schema','signature_hex','signing_key_id','tactics','tier',
  'current_work_state','work_state_history',
].sort());
const PUBLIC_COGNITION_BRAIN_COUNT_FIELDS=Object.freeze([
  'brain_episode_count','brain_evolution_application_count','brain_evolution_decision_count',
  'brain_fragment_binding_count','brain_fragment_count',
]);
const PUBLIC_PERSONA_COGNITION_FIELDS_V3=Object.freeze([
  ...PUBLIC_PERSONA_COGNITION_FIELDS.filter((field)=>field!=='lessons'&&field!=='tactics'),
  ...PUBLIC_COGNITION_BRAIN_COUNT_FIELDS,
].sort());
const PUBLIC_PERSONA_OUTPUT_FIELDS=Object.freeze([
  'at','audience_persona_ids','authority','author_persona_id','environment_id','kind','text',
].sort());
const PUBLIC_PERSONA_EXACT_OUTPUT_FIELDS=Object.freeze([
  ...PUBLIC_PERSONA_OUTPUT_FIELDS,
  'authored_output','persona_authority','persona_authority_hash',
].sort());
const PUBLIC_PERSONA_AUTHORITY_OUTPUT_FIELDS=Object.freeze([
  ...PUBLIC_PERSONA_OUTPUT_FIELDS,
  'persona_authority','persona_authority_hash',
].sort());
const PUBLIC_PERSONA_STRUCTURED_OUTPUT_FIELDS=Object.freeze([
  ...PUBLIC_PERSONA_AUTHORITY_OUTPUT_FIELDS,
  'structured_cognition',
].sort());
const PUBLIC_PERSONA_AUTHORED_OUTPUT_FIELDS=Object.freeze([
  'schema','sha256','text','utf8_bytes',
].sort());
const PUBLIC_PERSONA_ACTION_AUTHORITY_FIELDS=Object.freeze([
  'action_arguments','action_descriptor_hash','action_dispatch_descriptor_hash','action_id',
  'action_invocation_id','action_name','authored_text','authored_text_hash','environment_id',
  'model_call_id','persona_id','replication_effect_descriptors','schema','signed_by',
  'signing_key_id','task_id',
].sort());
const PUBLIC_REPLICATION_EFFECT_DESCRIPTOR_FIELDS=Object.freeze([
  'effect_kind','schema',
].sort());
const PUBLIC_PERSONA_COGNITIVE_AUTHORITY_FIELDS=Object.freeze([
  'authored_at','environment_id','intent','intent_id','mission_task_id','persona_id',
  'persona_signature','schema','self_wake','signing_key_id','task_id','wake_dedupe_key',
  'wake_event_id',
].sort());
const PUBLIC_PERSONA_COMMUNICATION_AUTHORITY_FIELDS=Object.freeze([
  'addressed_to','authored_by','communication_id','environment_id','parent_communication_hash',
  'parent_communication_id','payload','provenance','schema','signed_by','signing_key_id',
].sort());
const PUBLIC_PERSONA_ACTIVE_CALL_FIELDS=Object.freeze([
  'call_id','environment_id','model_id','persona_id','provisional_events','reasoning_effort','reasoning_effort_source','requested_purpose','run_id',
  'started_at','status','task_id',
].sort());
const PUBLIC_PERSONA_RECENT_CALL_FIELDS=Object.freeze([
  'call_id','ended_at','environment_id','model_id','persona_id','provisional_events','reasoning_effort','reasoning_effort_source',
  'requested_purpose','run_id','started_at','status','task_id',
].sort());
const PUBLIC_PERSONA_LESSON_FIELDS=Object.freeze([
  'action','confidence','rationale','trigger',
].sort());
const PUBLIC_PERSONA_TACTIC_FIELDS=Object.freeze([
  'action','cohort','score','source','trigger','version',
].sort());
const PUBLIC_PERSONA_EVOLUTION_FIELDS=Object.freeze([
  'accepted','at','kind','mode','task_id',
].sort());
const PUBLIC_PERSONA_AGENTIC_FIELDS=Object.freeze([
  'active_bindings','acquired_capabilities','acquired_tools','authored_knowledge','authored_methods',
  'expertise_awarded_by_substrate','local_executions','recent_action_practice','schema',
  'semantic_interpretation_performed','tool_invocations',
].sort());
const PUBLIC_PERSONA_KNOWLEDGE_FIELDS_V2=Object.freeze([
  'body','body_included','content_bytes','content_hash','environment_id','evidence_ref_count',
  'issued_at','persona_signature_verified','record_id','task_id',
].sort());
const PUBLIC_PERSONA_KNOWLEDGE_FIELDS=Object.freeze([
  'body','body_included','content_bytes','content_hash','environment_id','evidence_ref_count',
  'future_cognition_inventory_eligible','issued_at','persona_signature_verified','record_id','task_id',
].sort());
const PUBLIC_PERSONA_METHOD_FIELDS=Object.freeze([
  'authority_scope','body','body_included','created_at','fragment_hash','fragment_id',
  'persona_signature_verified','updated_at','version',
].sort());
const PUBLIC_PERSONA_METHOD_FIELDS_V4=Object.freeze([...PUBLIC_PERSONA_METHOD_FIELDS,'body_omitted_reason'].sort());
const PUBLIC_PERSONA_AGENTIC_SCHEMAS=Object.freeze(['personaos-persona-agentic-development/2',
  'personaos-persona-agentic-development/3','personaos-persona-agentic-development/4']);
// A method body is the persona's own distillation: a bounded mapping or a bounded
// text, carried verbatim when included and empty when the node stated a reason.
function _validPublicMethodBody(method,{v4=false}={}){
  if(typeof method.body_included!=='boolean') return false;
  if(v4){
    if(typeof method.body_omitted_reason!=='string'
        ||(method.body_omitted_reason&&!_safePublicCognitionAtom(method.body_omitted_reason,64))
        ||(method.body_included!==(method.body_omitted_reason===''))) return false;
  }
  if(typeof method.body==='string') return v4&&method.body_included&&_safePublicCognitionText(method.body,4000,{required:true});
  return _validPublicWorkDocument(method.body)&&(method.body_included||!Object.keys(method.body).length);
}
const PUBLIC_PERSONA_BINDING_FIELDS=Object.freeze([
  'binding_hash','binding_id','carrier_scope_refs','created_at','fragment_ids',
  'persona_signature_verified','updated_at','version',
].sort());
const PUBLIC_PERSONA_PRACTICE_FIELDS=Object.freeze(['action_name','count','last_at'].sort());
const PUBLIC_PERSONA_CAPABILITY_FIELDS=Object.freeze([
  'acquired_at','capability','environment_id','recipe_hash',
].sort());
const PUBLIC_PERSONA_ACQUIRED_TOOL_FIELDS=Object.freeze([
  'acquired_at','artifact_id','environment_id','tool_name',
].sort());
const PUBLIC_PERSONA_TOOL_INVOCATION_FIELDS=Object.freeze([
  'artifact_id','count','environment_id','last_at','tool_name',
].sort());
const PUBLIC_PERSONA_LOCAL_EXECUTION_FIELDS=Object.freeze([
  'environment_id','executable','invocation_count','last_at','last_command_hash','successful_count',
].sort());
const PUBLIC_PERSONA_WORK_STATE_FIELDS=Object.freeze([
  'active_membership_current','authored_at','automatic_action',
  'bound_to_latest_observation','causal_disposition','causal_ref_count','causal_refs',
  'disposition_frontier_settlement','environment_id',
  'latest_observed_situation_hash','note_id','persona_id','projection_tier','revision',
  'schema','semantic_interpretation_performed','signature_hex','signature_verified',
  'signing_key_id','situation_hash','supersedes_work_state_ref','task_id',
  'terminal_frontier_bound','work_note',
  'work_state_content_hash','work_state_id',
].sort());
const PUBLIC_WORK_STATE_SETTLEMENT_FIELDS=Object.freeze([
  'authenticated_action_count','authored_situation_hash','automatic_action_selected',
  'bound_to_latest_observation','disposition_action_identity','disposition_kind','environment_id',
  'independent_effect_count','lineage_event_id','persona_id','preceding_effect_action_identities',
  'preceding_effect_count','preceding_effect_manifest_hash','read_only_action_count',
  'read_only_action_identities','read_only_action_manifest_hash','response_publication_count',
  'response_publication_hashes','schema','semantic_interpretation_performed',
  'settled_situation_hash','settled_situation_lineage_event_id','settled_workspace_state_signature',
  'settlement_hash','source_wake_event_id','task_id','work_state_content_hash','work_state_id',
  'workspace_changed_in_authoring_turn',
].sort());
const PUBLIC_SETTLEMENT_ACTION_IDENTITY_FIELDS=Object.freeze([
  'action_descriptor_hash','action_dispatch_descriptor_hash','action_event_id','action_hash',
  'action_id','action_invocation_id','action_name','replication_effect_descriptors','schema',
].sort());
function _validPublicSettlementActionIdentity(value){
  return _exactObjectFields(value,PUBLIC_SETTLEMENT_ACTION_IDENTITY_FIELDS)
    &&value.schema==='personaos-authenticated-action-identity/2'
    &&['action_id','action_invocation_id','action_name','action_event_id']
      .every((field)=>_safePublicCognitionAtom(value[field],512))
    &&['action_descriptor_hash','action_dispatch_descriptor_hash','action_hash']
      .every((field)=>value[field]===''||SHA256_CONTENT_RE.test(String(value[field]||'')))
    &&Array.isArray(value.replication_effect_descriptors)
    &&value.replication_effect_descriptors.length<=64
    &&value.replication_effect_descriptors.every((item)=>
      _exactObjectFields(item,PUBLIC_REPLICATION_EFFECT_DESCRIPTOR_FIELDS)
      &&_safePublicCognitionAtom(item.effect_kind,128,{required:true})
      &&_safePublicCognitionAtom(item.schema,128,{required:true}));
}
// The settlement is either exactly {} (superseded_or_unbound frontier) or the
// full /3 record bound to its parent work state. Same fail-closed exact-field
// style as the rest of the cognition surface.
function _validPublicWorkStateSettlement(value,parent){
  if(!value||typeof value!=='object'||Array.isArray(value)) return false;
  if(!Object.keys(value).length) return true;
  const hashOk=(item)=>item===''||SHA256_CONTENT_RE.test(String(item||''));
  const idOk=(item)=>_validPublicSettlementActionIdentity(item)
    ||_safePublicCognitionAtom(item,512,{required:true});
  return _exactObjectFields(value,PUBLIC_WORK_STATE_SETTLEMENT_FIELDS)
    &&value.schema==='personaos-persona-disposition-frontier-settlement/3'
    &&value.work_state_id===parent.work_state_id
    &&value.persona_id===parent.persona_id
    &&value.environment_id===parent.environment_id
    &&value.task_id===parent.task_id
    &&value.work_state_content_hash===parent.work_state_content_hash
    &&_safePublicCognitionAtom(value.disposition_kind,128,{required:true})
    &&['authored_situation_hash','settled_situation_hash','settled_workspace_state_signature',
       'read_only_action_manifest_hash','preceding_effect_manifest_hash','settlement_hash']
      .every((field)=>hashOk(value[field]))
    &&['settled_situation_lineage_event_id','source_wake_event_id','lineage_event_id']
      .every((field)=>_safePublicCognitionAtom(value[field],512))
    &&['authenticated_action_count','independent_effect_count','read_only_action_count',
       'preceding_effect_count','response_publication_count']
      .every((field)=>Number.isSafeInteger(value[field])&&value[field]>=0)
    &&['workspace_changed_in_authoring_turn','semantic_interpretation_performed',
       'automatic_action_selected','bound_to_latest_observation']
      .every((field)=>typeof value[field]==='boolean')
    &&Array.isArray(value.read_only_action_identities)
    &&value.read_only_action_identities.length<=64
    &&value.read_only_action_identities.every(idOk)
    &&Array.isArray(value.preceding_effect_action_identities)
    &&value.preceding_effect_action_identities.length<=64
    &&value.preceding_effect_action_identities.every(idOk)
    &&Array.isArray(value.response_publication_hashes)
    &&value.response_publication_hashes.length<=64
    &&value.response_publication_hashes.every(hashOk);
}
const PUBLIC_PERSONA_OUTPUT_AUTHORITIES=new Set(['persona_signature','signed_lineage']);
const PUBLIC_PERSONA_ACTION_OUTPUT_KIND='PERSONA_ACTION_AUTHORED';
const PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND='PERSONA_COMMUNICATION_AUTHORED';
const PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND='PERSONA_COGNITIVE_INTENT';
const PUBLIC_PERSONA_COGNITION_INSTANT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const PUBLIC_PERSONA_COGNITION_LIMITS=Object.freeze({
  atom:512,lineageText:32*1024*1024,exactTextBytes:32*1024*1024,
  documentBytes:32*1024*1024,
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
function _validPublicWorkDocument(value,depth=0){
  if(!value||typeof value!=='object'||Array.isArray(value)||depth>6
      ||Object.keys(value).length>32) return false;
  for(const [key,item] of Object.entries(value)){
    if(!_safePublicCognitionText(key,160,{required:true})||key.trim()!==key) return false;
    if(item===null||typeof item==='boolean'||Number.isSafeInteger(item)) continue;
    if(typeof item==='number'){
      if(!Number.isFinite(item)) return false;
      continue;
    }
    if(typeof item==='string'){
      if(!_safePublicCognitionText(item,4000)) return false;
      continue;
    }
    if(Array.isArray(item)){
      if(item.length>32) return false;
      for(const nested of item){
        if(nested&&typeof nested==='object'&&!Array.isArray(nested)){
          if(!_validPublicWorkDocument(nested,depth+1)) return false;
        }else if(Array.isArray(nested)){
          if(!_validPublicWorkDocument({items:nested},depth+1)) return false;
        }else if(typeof nested==='string'){
          if(!_safePublicCognitionText(nested,4000)) return false;
        }else if(nested!==null&&typeof nested!=='boolean'
            &&!(typeof nested==='number'&&Number.isFinite(nested))) return false;
      }
      continue;
    }
    if(!_validPublicWorkDocument(item,depth+1)) return false;
  }
  try{ return enc.encode(canon(value)).length<=16000; }catch(_){ return false; }
}
function _validPublicWorkRef(value,maximum=500){
  return _safePublicCognitionText(value,maximum,{required:true})&&value.trim()===value;
}
function _validPublicCausalDisposition(value){
  if(!value||typeof value!=='object'||Array.isArray(value)
      ||value.schema!=='personaos-persona-causal-disposition/2'
      ||!_validPublicWorkRef(value.rationale,4000)) return false;
  if(value.kind==='no_successor')
    return _exactObjectFields(value,['kind','rationale','schema']);
  if(value.kind!=='immediate_wake') return false;
  const keys=Object.keys(value), allowed=new Set([
    'schema','kind','wake_kind','payload','model_input_paths','rationale',
  ]);
  if(keys.some((key)=>!allowed.has(key))
      ||!Object.hasOwn(value,'wake_kind')||!Object.hasOwn(value,'payload')
      ||!_validPublicWorkRef(value.wake_kind,512)
      ||!_validPublicWorkDocument(value.payload)) return false;
  if(!Object.hasOwn(value,'model_input_paths')) return true;
  const paths=value.model_input_paths;
  return Array.isArray(paths)&&paths.length>0&&paths.length<=8
    &&paths.every((path)=>_validPublicWorkRef(path,500))
    &&new Set(paths).size===paths.length;
}
function _validPublicPersonaWorkState(value,identity){
  if(!value||typeof value!=='object'||Array.isArray(value)) return false;
  const fields=Object.keys(value).sort();
  if(fields.join('\u0000')!==PUBLIC_PERSONA_WORK_STATE_FIELDS.join('\u0000')
      ||value.schema!=='personaos-persona-work-state-surface/5'
      ||value.projection_tier!=='public'
      ||String(value.persona_id||'')!==identity.signedId
      ||!_safePublicCognitionAtom(value.environment_id,512,{required:true})
      ||!_safePublicCognitionAtom(value.task_id,512,{required:true})
      ||!_safePublicCognitionAtom(value.work_state_id,512,{required:true})
      ||!_safePublicCognitionAtom(value.note_id,512,{required:true})
      ||!_safePublicCognitionInstant(value.authored_at)
      ||!Number.isSafeInteger(value.revision)||value.revision<1
      ||(!_validPublicWorkRef(value.supersedes_work_state_ref||'',500)
        &&value.supersedes_work_state_ref!=='')
      ||!SHA256_CONTENT_RE.test(String(value.situation_hash||''))
      ||!SHA256_CONTENT_RE.test(String(value.latest_observed_situation_hash||''))
      ||!SHA256_CONTENT_RE.test(String(value.work_state_content_hash||''))
      ||!_safePublicCognitionAtom(value.signing_key_id,512,{required:true})
      ||!/^[0-9a-f]{128}$/i.test(String(value.signature_hex||''))
      ||typeof value.bound_to_latest_observation!=='boolean'
      ||value.bound_to_latest_observation
        !==(value.situation_hash===value.latest_observed_situation_hash)
      ||typeof value.active_membership_current!=='boolean'
      ||value.signature_verified!==true
      ||value.automatic_action!==false
      ||value.semantic_interpretation_performed!==false
      ||!_validPublicWorkDocument(value.work_note)
      ||!_validPublicCausalDisposition(value.causal_disposition)
      ||!Array.isArray(value.causal_refs)||value.causal_refs.length>32
      ||!value.causal_refs.every((item)=>_validPublicWorkRef(item))
      ||new Set(value.causal_refs).size!==value.causal_refs.length
      ||!Number.isSafeInteger(value.causal_ref_count)
      ||value.causal_ref_count!==value.causal_refs.length
      ||typeof value.terminal_frontier_bound!=='boolean'
      ||!_validPublicWorkStateSettlement(value.disposition_frontier_settlement,value)) return false;
  return true;
}
function _validPublicPersonaWorkStateHistory(doc,identity){
  const history=doc.work_state_history;
  if(!Array.isArray(history)||history.length>12
      ||history.some((state)=>!_validPublicPersonaWorkState(state,identity))) return false;
  const ids=history.map((state)=>state.work_state_id);
  if(new Set(ids).size!==ids.length) return false;
  if(!history.length) return doc.current_work_state
    &&typeof doc.current_work_state==='object'&&!Array.isArray(doc.current_work_state)
    &&Object.keys(doc.current_work_state).length===0;
  const latestBound=history.filter((state)=>state.bound_to_latest_observation===true);
  const expected=latestBound.length?latestBound[latestBound.length-1]:history[history.length-1];
  return canon(doc.current_work_state)===canon(expected);
}
async function _validPublicProvisionalEvent(event,{call,generatedAt}={}){
  if(!event||typeof event!=='object'||Array.isArray(event)
      ||event.schema!=='personaos-provisional-cognition/1'
      ||event.authority!=='kernel_observed_provider_event'
      ||event.persona_signed!==false||event.provisional!==true
      ||!_safePublicCognitionAtom(event.kind,128,{required:true})
      ||!Number.isSafeInteger(event.sequence)||event.sequence<1
      ||!_safePublicCognitionInstant(event.at)) return false;
  const observed=Date.parse(event.at), started=Date.parse(String(call?.started_at||''));
  const generated=Date.parse(String(generatedAt||''));
  if(!Number.isFinite(observed)||!Number.isFinite(started)||!Number.isFinite(generated)
      ||observed<started||observed>generated) return false;
  if(event.kind==='assistant_message'){
    if(typeof event.text!=='string'||!event.text
        ||!Number.isSafeInteger(event.utf8_bytes)||event.utf8_bytes<1
        ||!SHA256_CONTENT_RE.test(String(event.sha256||''))
        ||(Object.prototype.hasOwnProperty.call(event,'message_id')
          &&!_safePublicCognitionText(event.message_id,180,{required:true}))) return false;
    if(Object.prototype.hasOwnProperty.call(event,'stream_delta')){
      if(event.stream_delta!==true) return false;
    }else if(!Number.isSafeInteger(event.chunk_index)||event.chunk_index<0
        ||!Number.isSafeInteger(event.chunk_count)||event.chunk_count<1
        ||event.chunk_index>=event.chunk_count) return false;
    const bytes=enc.encode(event.text);
    return bytes.length===event.utf8_bytes
      &&`sha256:${await sha256Hex(bytes)}`===event.sha256;
  }
  if(event.kind==='provider_status')
    return _safePublicCognitionAtom(event.status,256,{required:true});
  if(event.kind==='tool_status'){
    if(!_safePublicCognitionAtom(event.status,256,{required:true})
        ||!_safePublicCognitionText(event.tool_type,160,{required:true})
        ||event.tool_type.trim()!==event.tool_type) return false;
    for(const field of ['server','tool_name']) if(Object.prototype.hasOwnProperty.call(event,field)){
      if(!_safePublicCognitionText(event[field],240,{required:true})
          ||event[field].trim()!==event[field]) return false;
    }
  }
  // Unknown provider event kinds remain visible as exact kernel-signed data.
  // Their semantics are not inferred and no fixed vocabulary controls admission.
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
        ||authority.schema!=='personaos-persona-cognitive-intent/2'
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
    const authorityPayload=authority?.payload;
    const authoredOutputPresent=Object.hasOwn(output,'authored_output');
    const exactTextBound=authoredOutputPresent
      ?authorityPayload&&typeof authorityPayload==='object'&&!Array.isArray(authorityPayload)
        &&canon(authorityPayload.authored_output)===canon(output.authored_output)
      :authorityPayload&&typeof authorityPayload==='object'&&!Array.isArray(authorityPayload)
        &&typeof authorityPayload.message==='string'&&authorityPayload.message===output.text;
    if(!_exactObjectFields(authority,PUBLIC_PERSONA_COMMUNICATION_AUTHORITY_FIELDS)
        ||authority.schema!=='personaos-persona-communication/1'
        ||authority.authored_by!==identity.signedId
        ||authority.environment_id!==output.environment_id
        ||authority.signing_key_id!==signingKeyId
        ||!Array.isArray(authority.addressed_to)
        ||canon(authority.addressed_to)!==canon(output.audience_persona_ids)
        ||!exactTextBound) return false;
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
const PUBLIC_ATOMIC_ACTION_AUTHORITY_FIELDS=Object.freeze([
  'authenticated_action','container_event_hash','container_event_id','schema',
].sort());
// The kernel may wrap the flat authenticated action in an atomic-projection
// envelope that names the containing lineage event; consumers unwrap exactly
// like the node does (node.py reads authority.authenticated_action when the
// wrapper schema matches). The persona_authority_hash stays bound to the
// outer object as served.
function _actionAuthorityPayload(authority){
  return authority&&typeof authority==='object'&&!Array.isArray(authority)
    &&authority.schema==='personaos-atomic-persona-action-authority/1'
    ?authority.authenticated_action:authority;
}
async function _validPublicPersonaActionAuthority(output,identity,row){
  const served=output.persona_authority;
  let authority=served;
  if(served&&typeof served==='object'&&!Array.isArray(served)
      &&served.schema==='personaos-atomic-persona-action-authority/1'){
    if(!_exactObjectFields(served,PUBLIC_ATOMIC_ACTION_AUTHORITY_FIELDS)
        ||!_safePublicCognitionAtom(served.container_event_id,512)
        ||!(served.container_event_hash===''
          ||SHA256_CONTENT_RE.test(String(served.container_event_hash||'')))) return false;
    authority=served.authenticated_action;
  }
  const publicKey=String(row?._personaIdentityPublicKeyHex||'').toLowerCase();
  const signingKeyId=String(row?._personaIdentitySigningKeyId||'');
  const replicationEffects=authority?.replication_effect_descriptors;
  const effectKinds=new Set();
  if(!Array.isArray(replicationEffects)||replicationEffects.length>64) return false;
  for(const descriptor of replicationEffects){
    const effectKind=descriptor?.effect_kind;
    if(!_exactObjectFields(descriptor,PUBLIC_REPLICATION_EFFECT_DESCRIPTOR_FIELDS)
        ||descriptor.schema!=='personaos-replication-effect-descriptor/1'
        ||typeof effectKind!=='string'||!effectKind||effectKind!==effectKind.trim()
        ||enc.encode(effectKind).length>240
        ||Array.from(effectKind).some((character)=>character.codePointAt(0)<32)
        ||effectKinds.has(effectKind)) return false;
    effectKinds.add(effectKind);
  }
  if(!authority||typeof authority!=='object'||Array.isArray(authority)
      ||!_exactObjectFields(authority,PUBLIC_PERSONA_ACTION_AUTHORITY_FIELDS)
      ||authority.schema!=='personaos-authenticated-persona-action/3'
      ||authority.persona_id!==identity.signedId
      ||authority.environment_id!==output.environment_id
      ||signingKeyId!==`persona:${identity.signedId}`
      ||authority.signing_key_id!==signingKeyId
      ||!/^[0-9a-f]{64}$/.test(publicKey)
      ||!_safePublicCognitionAtom(authority.action_id,512,{required:true})
      ||!_safePublicCognitionAtom(authority.action_invocation_id,512,{required:true})
      ||!_safePublicCognitionAtom(authority.task_id,512)
      ||!_safePublicCognitionAtom(authority.model_call_id,512)
      ||!_safePublicCognitionAtom(authority.action_name,512,{required:true})
      ||!SHA256_CONTENT_RE.test(String(authority.action_descriptor_hash||''))
      ||!SHA256_CONTENT_RE.test(String(authority.action_dispatch_descriptor_hash||''))
      ||!SHA256_CONTENT_RE.test(String(authority.authored_text_hash||''))
      ||!SHA256_CONTENT_RE.test(String(output.persona_authority_hash||''))
      ||!authority.action_arguments||typeof authority.action_arguments!=='object'
      ||Array.isArray(authority.action_arguments)
      ||authority.authored_text!==output.text
      ||`sha256:${await sha256Hex(enc.encode(output.text))}`!==authority.authored_text_hash
      ||`sha256:${await sha256Hex(enc.encode(canon(served)))}`!==output.persona_authority_hash)
    return false;
  const actionIdentity={
    schema:'personaos-authenticated-persona-action-identity/2',
    persona_id:authority.persona_id,
    environment_id:authority.environment_id,
    task_id:authority.task_id,
    model_call_id:authority.model_call_id,
    action_invocation_id:authority.action_invocation_id,
    action_name:authority.action_name,
    action_descriptor_hash:authority.action_descriptor_hash,
    action_dispatch_descriptor_hash:authority.action_dispatch_descriptor_hash,
    replication_effect_descriptors:replicationEffects,
    action_arguments:authority.action_arguments,
  };
  if(authority.action_id!==`persona-action:${await sha256Hex(enc.encode(canon(actionIdentity)))}`)
    return false;
  let action;
  try{
    action=JSON.parse(output.text);
    if(!_exactObjectFields(action,['action','arguments'])
        ||!_safePublicCognitionAtom(action.action,512,{required:true})
        ||!action.arguments||typeof action.arguments!=='object'||Array.isArray(action.arguments)
        ||canon(action)!==output.text
        ||action.action!==authority.action_name
        ||canon(action.arguments)!==canon(authority.action_arguments)) return false;
  }catch(_){ return false; }
  const signature=String(authority.signed_by||'');
  if(!/^[0-9a-f]{128}$/.test(signature)) return false;
  const cacheKey=`action:${publicKey}:${output.persona_authority_hash}:${signature}`;
  if(PUBLIC_PERSONA_AUTHORITY_SIGNATURE_CACHE.get(cacheKey)===true) return true;
  const payload={};
  for(const field of Object.keys(authority)) if(field!=='signed_by') payload[field]=authority[field];
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
async function _validPublicPersonaStructuredAuthority(output,identity,row){
  const authority=output.persona_authority;
  const structured=output.structured_cognition;
  const publicKey=String(row?._personaIdentityPublicKeyHex||'').toLowerCase();
  const signingKeyId=String(row?._personaIdentitySigningKeyId||'');
  if(!authority||typeof authority!=='object'||Array.isArray(authority)
      ||!structured||typeof structured!=='object'||Array.isArray(structured)
      ||!Object.keys(structured).length
      ||Object.hasOwn(structured,'signed_by')
      ||authority.persona_id!==identity.signedId
      ||authority.environment_id!==output.environment_id
      ||authority.signing_key_id!==signingKeyId
      ||!_safePublicCognitionAtom(authority.schema,512,{required:true})
      ||!_safePublicCognitionInstant(authority.authored_at)
      ||!/^[0-9a-f]{64}$/.test(publicKey)
      ||!SHA256_CONTENT_RE.test(String(output.persona_authority_hash||''))
      ||`sha256:${await sha256Hex(enc.encode(canon(authority)))}`!==output.persona_authority_hash)
    return false;
  let parsed;
  try{ parsed=JSON.parse(output.text); }catch(_){ return false; }
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)
      ||canon(parsed)!==canon(structured)
      ||!Object.keys(structured).every((field)=>Object.hasOwn(authority,field)
        &&canon(authority[field])===canon(structured[field]))) return false;
  const signature=String(authority.signed_by||'');
  if(!/^[0-9a-f]{128}$/.test(signature)) return false;
  const cacheKey=`structured:${publicKey}:${output.persona_authority_hash}:${signature}`;
  if(PUBLIC_PERSONA_AUTHORITY_SIGNATURE_CACHE.get(cacheKey)===true) return true;
  const payload={};
  for(const field of Object.keys(authority)) if(field!=='signed_by') payload[field]=authority[field];
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
async function _validPublicPersonaOutput(output,identity,row){
  const communication=output?.kind===PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND;
  const cognitiveExact=output?.kind===PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND;
  const authoredOutputPresent=Object.hasOwn(output||{},'authored_output');
  const actionExact=output?.kind===PUBLIC_PERSONA_ACTION_OUTPUT_KIND;
  const structuredExact=!communication&&!cognitiveExact&&!actionExact
    &&output?.authority==='persona_signature'
    &&Object.hasOwn(output||{},'structured_cognition');
  const personaExact=communication||cognitiveExact||structuredExact;
  const outputFields=actionExact?PUBLIC_PERSONA_AUTHORITY_OUTPUT_FIELDS
    :(cognitiveExact||communication&&authoredOutputPresent)
      ?PUBLIC_PERSONA_EXACT_OUTPUT_FIELDS
      :structuredExact?PUBLIC_PERSONA_STRUCTURED_OUTPUT_FIELDS
      :communication?PUBLIC_PERSONA_AUTHORITY_OUTPUT_FIELDS
        :PUBLIC_PERSONA_OUTPUT_FIELDS;
  if(!_exactObjectFields(output,outputFields)
      ||!_safePublicCognitionAtom(output.kind,128,{required:true})
      ||!_safePublicCognitionInstant(output.at)
      ||typeof output.text!=='string'||!output.text.trim()
      ||!_safePublicCognitionAtom(output.author_persona_id,512,{required:true})
      ||output.author_persona_id!==identity.signedId
      ||!_safePublicCognitionAtom(output.environment_id,512)
      ||!PUBLIC_PERSONA_OUTPUT_AUTHORITIES.has(output.authority)
      ||!Array.isArray(output.audience_persona_ids)) return false;
  if((personaExact||actionExact)!==(output.authority==='persona_signature')
      ||((personaExact||actionExact)&&!output.environment_id)
      ||(!communication&&output.audience_persona_ids.length)
      ||(!personaExact&&!actionExact&&!_safePublicCognitionText(output.text,
        PUBLIC_PERSONA_COGNITION_LIMITS.lineageText,{required:true}))) return false;
  const audience=new Set();
  for(const personaId of output.audience_persona_ids){
    if(!_safePublicCognitionAtom(personaId,512,{required:true})||audience.has(personaId)) return false;
    audience.add(personaId);
  }
  if(actionExact) return await _validPublicPersonaActionAuthority(output,identity,row);
  if(structuredExact) return await _validPublicPersonaStructuredAuthority(output,identity,row);
  if(!personaExact) return true;
  if((cognitiveExact||authoredOutputPresent)
      &&!await _validPublicPersonaAuthoredOutput(output.authored_output,output.text)) return false;
  return await _validPublicPersonaAuthority(output,identity,row);
}
function _validPublicPersonaActiveCall(call,identity,generatedAt){
  return _exactObjectFields(call,PUBLIC_PERSONA_ACTIVE_CALL_FIELDS)
    &&_safePublicCognitionAtom(call.call_id,512,{required:true})
    &&_safePublicCognitionAtom(call.model_id,512,{required:true})
    &&_safePublicCognitionAtom(call.persona_id,512,{required:true})
    &&call.persona_id===identity.signedId
    &&_safePublicCognitionAtom(call.reasoning_effort,128)
    &&_safePublicCognitionAtom(call.reasoning_effort_source,128,{required:true})
    &&_safePublicCognitionText(call.requested_purpose,512)
    &&_safePublicCognitionAtom(call.environment_id,512)
    &&_safePublicCognitionAtom(call.run_id,512)
    &&_safePublicCognitionInstant(call.started_at)
    &&Date.parse(call.started_at)<=Date.parse(generatedAt)
    &&call.status==='running'
    &&_safePublicCognitionAtom(call.task_id,512)
    &&Array.isArray(call.provisional_events);
}
function _validPublicPersonaRecentCall(call,identity,generatedAt){
  const startedAt=Date.parse(String(call?.started_at||''));
  const endedAt=Date.parse(String(call?.ended_at||''));
  const snapshotAt=Date.parse(String(generatedAt||''));
  return _exactObjectFields(call,PUBLIC_PERSONA_RECENT_CALL_FIELDS)
    &&_safePublicCognitionAtom(call.call_id,512,{required:true})
    &&_safePublicCognitionAtom(call.model_id,512,{required:true})
    &&_safePublicCognitionAtom(call.persona_id,512,{required:true})
    &&call.persona_id===identity.signedId
    &&_safePublicCognitionAtom(call.reasoning_effort,128)
    &&_safePublicCognitionAtom(call.reasoning_effort_source,128,{required:true})
    &&_safePublicCognitionText(call.requested_purpose,512)
    &&_safePublicCognitionAtom(call.environment_id,512)
    &&_safePublicCognitionAtom(call.run_id,512)
    &&_safePublicCognitionInstant(call.started_at)
    &&_safePublicCognitionInstant(call.ended_at)
    &&Number.isFinite(startedAt)&&Number.isFinite(endedAt)&&Number.isFinite(snapshotAt)
    &&startedAt<=endedAt&&endedAt<=snapshotAt
    &&call.status==='finished'
    &&_safePublicCognitionAtom(call.task_id,512)
    &&Array.isArray(call.provisional_events);
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
function _validPublicPersonaAgenticDevelopment(value){
  const developmentV4=value?.schema==='personaos-persona-agentic-development/4';
  const developmentV3=developmentV4||value?.schema==='personaos-persona-agentic-development/3';
  if(!value||typeof value!=='object'||Array.isArray(value)
      ||!_exactObjectFields(value,PUBLIC_PERSONA_AGENTIC_FIELDS)
      ||!PUBLIC_PERSONA_AGENTIC_SCHEMAS.includes(value.schema)
      ||value.expertise_awarded_by_substrate!==false
      ||value.semantic_interpretation_performed!==false) return false;
  for(const field of ['authored_knowledge','authored_methods','active_bindings','recent_action_practice',
    'acquired_capabilities','acquired_tools','tool_invocations','local_executions'])
    if(!Array.isArray(value[field])) return false;
  if(value.authored_knowledge.length>24||value.authored_methods.length>24||value.active_bindings.length>24
      ||value.recent_action_practice.length>32||value.acquired_capabilities.length>24
      ||value.acquired_tools.length>24||value.tool_invocations.length>32
      ||value.local_executions.length>32) return false;
  const knowledgeIds=new Set();
  for(const record of value.authored_knowledge){
    if(!_exactObjectFields(record,developmentV3?PUBLIC_PERSONA_KNOWLEDGE_FIELDS:PUBLIC_PERSONA_KNOWLEDGE_FIELDS_V2)
        ||!_safePublicCognitionAtom(record.record_id,512,{required:true})
        ||knowledgeIds.has(record.record_id)
        ||!_safePublicCognitionAtom(record.environment_id,512)
        ||!_safePublicCognitionAtom(record.task_id,512)
        ||typeof record.body_included!=='boolean'
        ||(developmentV3&&record.future_cognition_inventory_eligible!==true)
        ||!_validPublicWorkDocument(record.body)
        ||(!record.body_included&&Object.keys(record.body).length)
        ||!SHA256_CONTENT_RE.test(String(record.content_hash||''))
        ||!Number.isSafeInteger(record.content_bytes)||record.content_bytes<2||record.content_bytes>262144
        ||!Number.isSafeInteger(record.evidence_ref_count)||record.evidence_ref_count<0||record.evidence_ref_count>32
        ||!_safePublicCognitionInstant(record.issued_at)
        ||record.persona_signature_verified!==true) return false;
    knowledgeIds.add(record.record_id);
  }
  const fragmentIds=new Set();
  for(const method of value.authored_methods){
    if(!_exactObjectFields(method,developmentV4?PUBLIC_PERSONA_METHOD_FIELDS_V4:PUBLIC_PERSONA_METHOD_FIELDS)
        ||!_safePublicCognitionAtom(method.fragment_id,512,{required:true})
        ||fragmentIds.has(method.fragment_id)
        ||!Number.isSafeInteger(method.version)||method.version<1
        ||!_validPublicMethodBody(method,{v4:developmentV4})
        ||!_safePublicCognitionAtom(method.authority_scope,512)
        ||!_safePublicCognitionInstant(method.created_at)
        ||!_safePublicCognitionInstant(method.updated_at)
        ||!SHA256_CONTENT_RE.test(String(method.fragment_hash||''))
        ||method.persona_signature_verified!==true) return false;
    fragmentIds.add(method.fragment_id);
  }
  const bindingIds=new Set();
  for(const binding of value.active_bindings){
    if(!_exactObjectFields(binding,PUBLIC_PERSONA_BINDING_FIELDS)
        ||!_safePublicCognitionAtom(binding.binding_id,512,{required:true})
        ||bindingIds.has(binding.binding_id)
        ||!Number.isSafeInteger(binding.version)||binding.version<1
        ||!Array.isArray(binding.fragment_ids)||!binding.fragment_ids.length
        ||binding.fragment_ids.length>128
        ||!binding.fragment_ids.every((item)=>_safePublicCognitionAtom(item,512,{required:true})
          &&fragmentIds.has(item))
        ||new Set(binding.fragment_ids).size!==binding.fragment_ids.length
        ||!Array.isArray(binding.carrier_scope_refs)||!binding.carrier_scope_refs.length
        ||binding.carrier_scope_refs.length>16
        ||!binding.carrier_scope_refs.every((item)=>_safePublicCognitionAtom(item,512,{required:true}))
        ||new Set(binding.carrier_scope_refs).size!==binding.carrier_scope_refs.length
        ||!_safePublicCognitionInstant(binding.created_at)
        ||!_safePublicCognitionInstant(binding.updated_at)
        ||!SHA256_CONTENT_RE.test(String(binding.binding_hash||''))
        ||binding.persona_signature_verified!==true) return false;
    bindingIds.add(binding.binding_id);
  }
  const actionNames=new Set();
  for(const row of value.recent_action_practice){
    if(!_exactObjectFields(row,PUBLIC_PERSONA_PRACTICE_FIELDS)
        ||!_safePublicCognitionAtom(row.action_name,512,{required:true})
        ||actionNames.has(row.action_name)
        ||!Number.isSafeInteger(row.count)||row.count<1
        ||!_safePublicCognitionInstant(row.last_at)) return false;
    actionNames.add(row.action_name);
  }
  for(const row of value.acquired_capabilities)
    if(!_exactObjectFields(row,PUBLIC_PERSONA_CAPABILITY_FIELDS)
        ||!_safePublicCognitionAtom(row.environment_id,512,{required:true})
        ||!_safePublicCognitionText(row.capability,500,{required:true})
        ||row.capability.trim()!==row.capability
        ||!SHA256_CONTENT_RE.test(String(row.recipe_hash||''))
        ||!_safePublicCognitionInstant(row.acquired_at)) return false;
  for(const row of value.acquired_tools)
    if(!_exactObjectFields(row,PUBLIC_PERSONA_ACQUIRED_TOOL_FIELDS)
        ||!_safePublicCognitionAtom(row.environment_id,512,{required:true})
        ||!_safePublicCognitionText(row.tool_name,500,{required:true})
        ||row.tool_name.trim()!==row.tool_name
        ||!_safePublicCognitionAtom(row.artifact_id,512,{required:true})
        ||!_safePublicCognitionInstant(row.acquired_at)) return false;
  const invocationKeys=new Set();
  for(const row of value.tool_invocations){
    const key=`${row?.environment_id||''}\u0000${row?.tool_name||''}\u0000${row?.artifact_id||''}`;
    if(!_exactObjectFields(row,PUBLIC_PERSONA_TOOL_INVOCATION_FIELDS)
        ||!_safePublicCognitionAtom(row.environment_id,512,{required:true})
        ||!_safePublicCognitionText(row.tool_name,500,{required:true})
        ||row.tool_name.trim()!==row.tool_name
        ||!_safePublicCognitionAtom(row.artifact_id,512,{required:true})
        ||!Number.isSafeInteger(row.count)||row.count<1
        ||!_safePublicCognitionInstant(row.last_at)||invocationKeys.has(key)) return false;
    invocationKeys.add(key);
  }
  const executionKeys=new Set();
  for(const row of value.local_executions){
    const key=`${row?.environment_id||''}\u0000${row?.executable||''}`;
    if(!_exactObjectFields(row,PUBLIC_PERSONA_LOCAL_EXECUTION_FIELDS)
        ||!_safePublicCognitionAtom(row.environment_id,512,{required:true})
        ||!_safePublicCognitionText(row.executable,500,{required:true})
        ||row.executable.trim()!==row.executable
        ||!Number.isSafeInteger(row.invocation_count)||row.invocation_count<1
        ||!Number.isSafeInteger(row.successful_count)||row.successful_count<0
        ||row.successful_count>row.invocation_count
        ||!_safePublicCognitionInstant(row.last_at)
        ||!SHA256_CONTENT_RE.test(String(row.last_command_hash||''))
        ||executionKeys.has(key)) return false;
    executionKeys.add(key);
  }
  return true;
}
function _currentInventoryPersona(kernel,pid){
  const personaKey=_personaKey(kernel,pid), row=S.personaDiscoveryByKey.get(personaKey);
  const provider=S.providerInventories.get(String(kernel||''));
  const identity=S.identityIndexes?.get(String(kernel||''));
  const providerCurrent=row&&_providerInventoryIsCurrent(provider)
    &&row._inventorySource===kernel
    &&row._inventoryGeneration===provider.generation&&row._inventoryHash===provider.hash;
  // The compact identity index is not provisional routing gossip. It is a
  // current-master-signed, expiry-bounded inventory of complete persona/env
  // documents whose hashes, record signatures, policies, lifecycle cards and
  // persona identity proofs were all checked before admission. It can therefore
  // authorize this persona's independently signed cognition while the larger
  // artifact/task inventory is still transferring.
  const identityCurrent=row&&row._identityIndexVerified===true
    &&_providerInventoryIsCurrent(identity)
    &&row._inventorySource===kernel
    &&row._inventoryGeneration===identity.generation&&row._inventoryHash===identity.hash;
  return (providerCurrent||identityCurrent)
    &&verifiedPersonaRenderable(S.personaDiscoveryByKey,personaKey)?row:null;
}
async function verifyPublicPersonaCognition(base,doc,{personaId,kernel}={}){
  const pid=_shortId(personaId), row=_currentInventoryPersona(kernel,pid);
  const identity=signedPersonaIdentity(row);
  const v3=doc?.schema==='personaos-persona-public-cognition/3';
  if(!row||!identity||identity.canonicalId!==pid
      ||!_exactObjectFields(doc,v3?PUBLIC_PERSONA_COGNITION_FIELDS_V3:PUBLIC_PERSONA_COGNITION_FIELDS)
      ||!_publicCognitionDocOk(doc)
      ||String(doc.persona_id||'')!==identity.signedId||!_safePublicCognitionInstant(doc.generated_at)
      ||!_freshPublicGeneratedAt(doc.generated_at,Date.now(),PUBLIC_COGNITION_MAX_AGE_MS)
      ||!_safePublicCognitionAtom(doc.persona_id,512,{required:true})
      ||!_safePublicCognitionText(doc.name,512)
      ||!_safePublicCognitionAtom(doc.lifecycle_state,64,{required:true})
      ||!_safePublicCognitionAtom(doc.identity_materialization_state,64,{required:true})
      ||!Array.isArray(doc.active_calls)
      ||!Array.isArray(doc.recent_calls)
      ||!Array.isArray(doc.provisional_outputs)
      ||!Array.isArray(doc.recent_outputs)
      ||!doc.current_work_state||typeof doc.current_work_state!=='object'
      ||Array.isArray(doc.current_work_state)
      ||!Array.isArray(doc.work_state_history)
      ||(v3?PUBLIC_COGNITION_BRAIN_COUNT_FIELDS.some((field)=>
            !Number.isSafeInteger(doc[field])||doc[field]<0)
          :(!Array.isArray(doc.lessons)||!Array.isArray(doc.tactics)))
      ||!Array.isArray(doc.proven_facts)
      ||!Array.isArray(doc.evolution_timeline)
      ||!_validPublicPersonaAgenticDevelopment(doc.agentic_development)) return false;
  if(!await verifyCurrentMasterSignedDocument(base,doc)) return false;
  const lifecycle=personaLifecycleProjection(S.personaDiscoveryByKey,_personaKey(kernel,pid));
  if(!lifecycle||doc.lifecycle_state!==lifecycle.lifecycleState
      ||doc.identity_materialization_state!==lifecycle.materializationState
      ||!doc.identity_fields||typeof doc.identity_fields!=='object'||Array.isArray(doc.identity_fields)
      ||Object.keys(doc.identity_fields).sort().join('\u0000')!=='avatar\u0000characteristics\u0000name') return false;
  // A lifecycle shell legitimately has no persona-authored name yet. Bind
  // emptiness to the independently verified name-field state: a pending name
  // must remain empty, while a materialized name must remain non-empty. The
  // materialized value must equal the current-inventory signed discovery name,
  // so cognition cannot invent a name or turn a pending fallback label into one.
  const materializedName=lifecycle.identityFields.name.state==='materialized';
  const expectedName=materializedName?String(row._personaSignedName||''):'';
  if(materializedName!==Boolean(doc.name)||String(doc.name||'')!==expectedName)return false;
  for(const field of ['name','characteristics','avatar']){
    const value=doc.identity_fields[field], expected=lifecycle.identityFields[field];
    if(!_exactObjectFields(value,['persona_authored','state'])
        ||value.state!==expected.state||value.persona_authored!==expected.personaAuthored)return false;
  }
  if(!_validPublicPersonaWorkStateHistory(doc,identity))return false;
  const callIds=new Set(), callsById=new Map(), flattenedProvisional=[];
  for(const call of [...doc.recent_calls,...doc.active_calls]){
    const recent=call?.status==='finished';
    if((recent?!_validPublicPersonaRecentCall(call,identity,doc.generated_at)
      :!_validPublicPersonaActiveCall(call,identity,doc.generated_at))
        ||callIds.has(call.call_id))return false;
    callIds.add(call.call_id); callsById.set(call.call_id,call);
    let previousSequence=0,previousObservedAt=Date.parse(call.started_at);
    for(const event of call.provisional_events){
      const observedAt=Date.parse(event?.at||'');
      if(!await _validPublicProvisionalEvent(event,
        {call,generatedAt:doc.generated_at})
          ||event.sequence<=previousSequence||observedAt<previousObservedAt
          ||(recent&&observedAt>Date.parse(call.ended_at))) return false;
      previousSequence=event.sequence; previousObservedAt=observedAt;
      flattenedProvisional.push({...event,call_id:call.call_id,model_id:call.model_id,
        persona_id:identity.signedId,call_status:call.status});
    }
  }
  const expectedProvisional=flattenedProvisional;
  if(canon(doc.provisional_outputs)!==canon(expectedProvisional))return false;
  // Exact equality to the independently validated nested records proves content
  // integrity without hashing every assistant chunk twice. Close the flattened
  // shape explicitly and bind its transport identifiers to the owning call.
  for(const event of doc.provisional_outputs){
    const call=callsById.get(event?.call_id);
    if(!call||event.call_id!==call.call_id||event.model_id!==call.model_id
        ||event.persona_id!==identity.signedId||event.call_status!==call.status) return false;
  }
  for(const output of doc.recent_outputs)
    if(!await _validPublicPersonaOutput(output,identity,row))return false;
  if((!v3&&(doc.lessons.some((lesson)=>!_validPublicPersonaLesson(lesson))
        ||doc.tactics.some((tactic)=>!_validPublicPersonaTactic(tactic))))
      ||doc.proven_facts.some((fact)=>!_safePublicCognitionText(fact,4096,{required:true}))
      ||doc.evolution_timeline.some((event)=>!_validPublicPersonaEvolution(event)))return false;
  return true;
}
async function refreshThinking(){
  if(!S.drawerThinkPid) return;
  const el=$('#thinksec'); if(!el) return;
  const want=S.drawerThinkPid, wantBase=S.drawerLiveBase||'', wantKernel=S.drawerLiveKernel||'';
  const personaKey=_personaKey(wantKernel,want);
  const retained=S.verifiedPublicCognitionByPersona?.get(personaKey);
  let retainedRendered=false;
  // This exact object reached the store only after whole-document verification.
  // Repaint it immediately while a fresh peer fetch is in flight; freshness is
  // liveness metadata, not a reason to erase already admitted signed history.
  if(retained&&retained.kernel===wantKernel&&retained.personaId===want){
    retainedRendered=true;
    const current=$('#thinksec');
    if(current&&S.drawerThinkPid===want&&S.drawerLiveBase===wantBase&&S.drawerLiveKernel===wantKernel){
      const observed=_friendlyInstant(retained.doc?.generated_at);
      current.innerHTML=(observed
        ?`<div class="privacy-note">Retained verified public activity · snapshot ${esc(observed)} · refreshing…</div>`:'')
        +renderThinking(retained.doc,{kernel:wantKernel,retainedSnapshot:true});
      hydrateThinkingOutputText(current,retained.doc);
    }
  }
  if(!wantBase){
    if(!retainedRendered)
      el.innerHTML='<div class="privacy-note">No current-master-verified node route is available for public activity.</div>';
    return;
  }
  const endpoint=join(wantBase,`personas/${encodeURIComponent(want)}/thinking`);
  const hasOperator=!!tokenFor(endpoint);
  const t=await fetchResponsivePublicJson(endpoint,{
    maxBytes:PUBLIC_PERSONA_COGNITION_LIMITS.documentBytes,
    peerOnly:true,
    verifiedDirectFallback:true,
  });
  if(S.drawerThinkPid!==want||S.drawerLiveBase!==wantBase||S.drawerLiveKernel!==wantKernel) return;
  const el2=$('#thinksec'); if(!el2) return;
  const operatorAccepted=hasOperator&&t?.tier==='operator'
    &&t?.schema==='personaos-persona-thinking/2'&&String(t.persona_id||'')===want;
  const publicAccepted=!hasOperator&&await verifyPublicPersonaCognition(wantBase,t,
    {personaId:want,kernel:wantKernel});
  if(operatorAccepted||publicAccepted){
    if(publicAccepted){
      const modelHistoryChanged=_rememberVerifiedPublicCognition(personaKey,t,
        {base:wantBase,kernel:wantKernel,personaId:want});
      // The drawer and the card consume the same kernel-qualified cognition
      // projection. Repaint the card when this asynchronous fetch hydrates it.
      if(modelHistoryChanged) scheduleRealtimeRepaint();
    }
    el2.innerHTML=renderThinking(t,{allowThinkingFrame:operatorAccepted,kernel:wantKernel});
    hydrateThinkingOutputText(el2,t); return; }
  const doc=S.drawerLiveFeed?await fetchEntityFeed(wantBase,S.drawerLiveFeed):null;
  if(S.drawerThinkPid!==want||S.drawerLiveBase!==wantBase||S.drawerLiveKernel!==wantKernel) return;
  const el3=$('#thinksec'); if(el3&&!retainedRendered) el3.innerHTML=hasOperator?renderThinkingRedacted(doc)
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
    effortSource:_publicProvenanceAtom(call?.reasoning_effort_source),
    environment:_publicProvenanceAtom(call?.environment_id),
    startedAt:_publicProvenanceAtom(call?.started_at,80),
    endedAt:_publicProvenanceAtom(call?.ended_at,80),
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
    callStatus:_publicProvenanceAtom(event?.call_status,256),
    status:_publicProvenanceAtom(event?.status,256),message:_publicProvenanceAtom(event?.message_id),
    tool:_publicProvenanceAtom(event?.tool_name,512)||_publicProvenanceAtom(event?.tool_type,512),
    server:_publicProvenanceAtom(event?.server,512)};
}
function _publicOutputTrust(output){
  if(output?.kind===PUBLIC_PERSONA_ACTION_OUTPUT_KIND) return {
    label:'PERSONA SIGNED ACTION',
    title:'persona action signature, authority hash, and exact action binding verified inside the kernel-signed public cognition document',
  };
  if(output?.kind===PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND) return {
    label:'PERSONA SIGNED INTENT',
    title:'persona signature and authored-output hash verified, inside the verified kernel-signed public cognition document',
  };
  if(output?.kind===PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND) return {
    label:'PERSONA SIGNED MESSAGE',
    title:'persona communication signature and authored-output hash verified, inside the verified kernel-signed public cognition document',
  };
  if(output?.authority==='persona_signature') return {
    label:'PERSONA SIGNED COGNITION',
    title:'persona signature, authority hash, and displayed structured fields verified inside the kernel-signed public cognition document',
  };
  return {label:'KERNEL SIGNED LINEAGE',
    title:'exact lineage output in the verified kernel-signed public cognition document'};
}
function _publicPersonaOutputDisplayText(output){
  const structured=output?.structured_cognition;
  if(output?.authority==='persona_signature'
      &&structured&&typeof structured==='object'&&!Array.isArray(structured))
    return canon(structured);
  return typeof output?.text==='string'?output.text:String(output?.text??'');
}
function _publicOutputLabel(output){
  if(output?.kind===PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND) return 'persona message';
  if(output?.kind===PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND) return 'persona cognition';
  if(output?.kind===PUBLIC_PERSONA_ACTION_OUTPUT_KIND) return 'persona action';
  return String(output?.kind||'authored output').replace(/_/g,' ').toLowerCase();
}
function _publicOutputProvenance(output,kernel,resolveRun=_verifiedPublicTaskRun){
  const provenance={
    environment:_publicProvenanceAtom(output?.environment_id),
    at:_publicProvenanceAtom(output?.at,80),authority:_publicProvenanceAtom(output?.authority,128),
  };
  if(output?.kind===PUBLIC_PERSONA_ACTION_OUTPUT_KIND){
    const authority=_actionAuthorityPayload(output.persona_authority)||{};
    try{
      const action=JSON.parse(output.text), args=action.arguments||{};
      provenance.action=_publicProvenanceAtom(action.action);
      provenance.actionPurpose=_publicProvenanceAtom(args.purpose,600);
      provenance.run=_publicProvenanceAtom(args.run_id);
      provenance.task=_publicProvenanceAtom(authority.task_id)
        ||_publicProvenanceAtom(args.task_id);
      provenance.call=_publicProvenanceAtom(authority.model_call_id);
      provenance.actionId=_publicProvenanceAtom(authority.action_id);
      provenance.invocation=_publicProvenanceAtom(authority.action_invocation_id);
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
  }else if(output?.authority==='persona_signature'){
    const authority=output.persona_authority||{};
    provenance.task=_publicProvenanceAtom(authority.task_id);
    provenance.missionTask=_publicProvenanceAtom(authority.mission_task_id);
    provenance.authoredAt=_publicProvenanceAtom(authority.authored_at,80);
    provenance.signingKey=_publicProvenanceAtom(authority.signing_key_id);
    provenance.authorityHash=_publicProvenanceAtom(output.persona_authority_hash,1024);
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
  const calls=[...doc.recent_calls,...doc.active_calls];
  const callsById=new Map(calls.map((call)=>[call.call_id,call]));
  for(const call of calls){
    const provenance=_publicCallProvenance(call);
    const finished=call.status==='finished';
    rows.push({
      source:finished?'recent_call':'active_call',kind:finished?'MODEL_CALL_FINISHED':'MODEL_CALL',
      at:finished?call.ended_at:call.started_at,scope:'model',scopeId:call.task_id||call.run_id,
      msg:[call.requested_purpose,call.model_id,call.status].filter(Boolean).join(' · '),
      rationale:`model ${call.model_id} · ${call.status}${call.reasoning_effort?` · reasoning ${call.reasoning_effort}`:''}`,
      cognition:true,ctype:'think',recipients:[],dedup:provenance,provenance,
      trustLabel:finished?'KERNEL SIGNED FINISHED CALL':'KERNEL SIGNED ACTIVE CALL',
      trustTitle:finished
        ?'finished model call in the verified kernel-signed public cognition snapshot'
        :'active model call in the verified current kernel-signed public cognition snapshot',
    });
  }
  for(const presented of _provisionalPresentationRows(doc.provisional_outputs)){
    const event=presented.event;
    const assistant=presented.assistant, tool=event.kind==='tool_status';
    const kind=assistant?'PROVISIONAL_ASSISTANT_MESSAGE'
      :tool?'PROVISIONAL_TOOL_STATUS':String(event.kind||'PROVISIONAL_PROVIDER_EVENT');
    const statusDetail=tool
      ?[event.status,event.tool_type,event.tool_name,event.server].filter(Boolean).join(' · ')
      :[event.status,event.model_id,event.tool_type,event.tool_name,event.server]
        .filter(Boolean).join(' · ');
    const call=callsById.get(event.call_id);
    const provenance=_publicProvisionalProvenance(event,call);
    if(assistant&&presented.firstSequence!==presented.lastSequence)
      provenance.sequence=`${presented.firstSequence}–${presented.lastSequence}`;
    rows.push({
      source:'provisional',kind,at:event.at,scope:'provider',scopeId:event.call_id,
      msg:assistant?presented.text:statusDetail,rationale:assistant?presented.text:statusDetail,
      exactText:assistant?presented.text:'',cognition:false,providerProvisional:true,ctype:'think',
      recipients:[],authority:event.authority,dedup:assistant?presented.events:event,
      presentationKey:assistant?presented.presentationKey:'',personaSigned:false,provenance,
      trustLabel:assistant
        ?presented.complete?'KERNEL OBSERVED · COMPLETE CHUNK SET':'KERNEL OBSERVED · ADMITTED WINDOW'
        :'KERNEL OBSERVED · PROVISIONAL',
      trustTitle:assistant
        ?presented.complete
          ?'verified kernel-signed public snapshot; every advertised assistant chunk is present, but the provider observation remains provisional and is not persona-signed cognition or hidden reasoning'
          :'verified kernel-signed public snapshot; all displayed text is from the admitted provider-event stream, whose beginning and end are not asserted'
        :'verified kernel-signed public snapshot; provisional provider event, not persona-signed cognition or hidden reasoning',
    });
  }
  for(const output of doc.recent_outputs){
    const communication=output.kind===PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND;
    const action=output.kind===PUBLIC_PERSONA_ACTION_OUTPUT_KIND;
    const provenance=_publicOutputProvenance(output,kernel,resolveRun);
    const trust=_publicOutputTrust(output);
    const displayText=_publicPersonaOutputDisplayText(output);
    rows.push({
      source:'output',kind:output.kind,at:output.at,
      scope:communication?'communication':action?'action':'cognition',
      scopeId:provenance.task||output.environment_id,
      msg:displayText,rationale:displayText,cognition:!communication&&!action,ctype:action?'tool':'think',
      exactText:displayText,recipients:output.audience_persona_ids,
      authority:output.authority,dedup:output,provenance,
      trustLabel:trust.label,trustTitle:trust.title,
    });
  }
  for(const lesson of doc.lessons||[]) rows.push({
    source:'lesson',kind:'COGNITION_LESSON',at:observedAt,scope:'cognition',scopeId:'',
    msg:lesson.action,rationale:[lesson.trigger,lesson.rationale].filter(Boolean).join(' · '),
    cognition:true,ctype:'think',recipients:[],dedup:lesson,observedState:true,
    provenance:{snapshotAt:observedAt},trustLabel:'KERNEL SIGNED SNAPSHOT',
  });
  for(const tactic of doc.tactics||[]) rows.push({
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
async function streamPersonaCognition(options={}){
  if(_cogBusy) return false;
  _cogBusy=true;
  try{
    const scopedPersonaKeys=new Set(
      (Array.isArray(options?.personaKeys)?options.personaKeys:[])
        .map((value)=>String(value||'')).filter(Boolean));
    const scopedBases=new Set(
      (Array.isArray(options?.bases)?options.bases:[])
        .map((value)=>String(value||'').replace(/\/$/,'')));
    const urgent=options?.force===true||scopedPersonaKeys.size>0||scopedBases.size>0;
    S.cogBaseFor=S.cogBaseFor||new Map();   // kernel-qualified persona key -> API base
    // The bases that actually serve the personaos API are the ones that streamed LIVE telemetry
    // (the cards render from those) — NOT necessarily a discovery record's _base (which may be an
    // IPFS/alias host that doesn't serve the API). Probe telemetry bases first, then record bases.
    const baseCandidates=[
      ...[...(S.liveTel?S.liveTel.keys():[])].map((k)=>({base:k==='@origin'?'':k,
        active:(S.activeModelCallsByBase?.get(k)||[]).length>0,focused:!!S.kernelFocus&&baseIsFocused(k==='@origin'?'':k)})),
      ...[...(S.order||[])].map((id)=>S.recs.get(id)).filter((r)=>r&&r.kind==='persona'&&kernelIsFocused(r._kernel)).map((r)=>({base:nodeBaseForRecord(r)})),
    ];
    const apiBases=selectMonitoringBases(baseCandidates,{limit:NETWORK_LIMITS.monitoredBases,hardLimit:64}).bases;
    // Visible, running and recent personas outrank the rest. This selector scans
    // the bounded cache once and retains only the cognition polling window.
    function* cognitionCandidates(){
      for(const personaKey of (S.visiblePersonaIds||[])){ const ref=_personaRef(personaKey);
        if(!scopedPersonaKeys.size||scopedPersonaKeys.has(ref.key))
          yield {...ref,endpointId:_signedPersonaEndpointId(personaKey),selected:true,
            base:S.liveByPersona.get(personaKey)?.base||''}; }
      for(const [personaKey,d] of (S.liveByPersona||new Map())) if(kernelIsFocused(d?.kernel)){
        const ref=_personaRef(personaKey); if(!scopedPersonaKeys.size||scopedPersonaKeys.has(ref.key))
          yield {...ref,endpointId:_signedPersonaEndpointId(personaKey),
            base:d?.base||'',running:_runningNow(personaKey),live:!!(d.models||[]).length}; }
      for(const id of (S.order||[])){ const r=S.recs.get(id);
        if(r&&r.kind==='persona'&&kernelIsFocused(r._kernel)){ const ref=_personaRef(r.did||r.id||'',r._kernel);
          if(!scopedPersonaKeys.size||scopedPersonaKeys.has(ref.key))
            yield {...ref,endpointId:_signedPersonaEndpointId(ref.key),base:nodeBaseForRecord(r)}; } }
    }
    const list=selectPriorityWindow(cognitionCandidates(),{limit:NETWORK_LIMITS.cognitionPersonas,
      keyOf:(row)=>row.key,priorityOf:(row)=>(row.selected?1e9:0)+(row.running?1e8:0)+(row.live?1e7:0),
      searchTextOf:(row)=>`${row.sid} ${row.kernel} ${_nameFor(row.key)}`}).items
      .filter((row)=>row.key&&row.sid);
    S.interactions=S.interactions||[]; S.ixKeys=S.ixKeys||new Set();
    let added=0, cognitionHydrated=false;
    // Persona cognition documents are independent signed subjects. Fetch and
    // verify the bounded visible window concurrently; serial reads made the
    // fourth persona wait behind the bytes and cryptography of the first three.
    // Each persona still tries only its own current-master-verified routes in
    // order, and no result is admitted until its normal subject proof passes.
    const cognitionReads=await Promise.all(list.map(async(candidate)=>{
      const {key:personaKey,kernel,endpointId}=candidate;
      if(!urgent&&Number(S.publicCognitionFetchAfter?.get(personaKey)||0)>Date.now()) return null;
      // Never probe another kernel for a colliding short id. A sticky route is
      // retained only while it still resolves to this persona's owning kernel.
      const routes=[S.cogBaseFor.get(personaKey),candidate.base,
        ...apiBases.filter((base)=>kernelForBase(base)===kernel),
        ...[...(S.globalKernels?.get(kernel)?.bases||[])]];
      const order=[...new Set(routes.filter((b)=>b!==undefined)
        .map((b)=>String(b==='@origin'?'':b).replace(/\/$/,'')))]
        .filter((base)=>(!scopedBases.size||scopedBases.has(base))
          &&(kernelForBase(base)===kernel || (!!base&&base===candidate.base)));
      let t=null, usedBase='';
      for(const base of order){
        // Node routes are identity-bound: a PersonaOS-born identity is exactly
        // `persona:<ULID>`, while an initial founder may be the bare id. The
        // canonical `sid` remains only the browser join key.
        const endpoint=join(base,`personas/${encodeURIComponent(endpointId)}/thinking`);
        const hasOperator=!!tokenFor(endpoint);
        const r=await fetchResponsivePublicJson(endpoint,{
          maxBytes:PUBLIC_PERSONA_COGNITION_LIMITS.documentBytes,
          peerOnly:true,
          verifiedDirectFallback:true,
        });
        const accepted=hasOperator
          ?r?.schema==='personaos-persona-thinking/2'&&r.tier==='operator'
            &&String(r.persona_id||'')===endpointId
          :await verifyPublicPersonaCognition(base,r,{personaId:endpointId,kernel});
        if(accepted){
          t=r; usedBase=base; S.cogBaseFor.set(personaKey,base);
          if(PUBLIC_COGNITION_SCHEMAS.has(r?.schema)){
            S.publicCognitionFetchAfter.set(personaKey,Date.now()+12000);
            while(S.publicCognitionFetchAfter.size>NETWORK_LIMITS.cognitionPersonas*4)
              S.publicCognitionFetchAfter.delete(S.publicCognitionFetchAfter.keys().next().value);
          }
          break; }
      }
      return t?{candidate,t,usedBase}:null;
    }));
    for(const read of cognitionReads){
      if(!read) continue;
      const {candidate,t,usedBase}=read;
      const {key:personaKey,sid,kernel,endpointId}=candidate;
      const publicCognition=_publicCognitionDocOk(t);
      if(publicCognition){
        cognitionHydrated=_rememberVerifiedPublicCognition(personaKey,t,
          {base:usedBase,kernel,personaId:endpointId})||cognitionHydrated;
      }
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
        const revision=_publicCognitionFingerprint(row.dedup);
        const presentationKey=typeof row.presentationKey==='string'?row.presentationKey:'';
        const identity=presentationKey?_publicCognitionFingerprint(presentationKey):revision;
        const key=`cog|${personaKey}|${row.source}|${row.kind}|${identity}`;
        const interactionIndex=presentationKey
          ?S.interactions.findIndex((event)=>event?._key===key):-1;
        const prior=presentationKey
          ?S.cognitionByPersona?.get(personaKey)?.get(key)
            ||(interactionIndex>=0?S.interactions[interactionIndex]:null)
          :null;
        const known=personaSeen?.has(key)||S.ixKeys.has(key)
          ||S.cognitionByPersona?.get(personaKey)?.has(key);
        if((!presentationKey&&known)||(presentationKey&&prior?._presentationRevision===revision)) continue;
        if(personaSeen&&!personaSeen.has(key)){
          personaSeen.add(key); while(personaSeen.size>128) personaSeen.delete(personaSeen.values().next().value);
        }
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
          _presentationRevision:presentationKey?revision:'',
        };
        if(presentationKey&&interactionIndex>=0) S.interactions[interactionIndex]=event;
        else S.interactions.push(event);
        _rememberPersonaCognitionEvent(event);
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
    // A verified snapshot can hydrate model history without adding a new feed
    // row. Paint that state now instead of waiting for another telemetry tick.
    else if(cognitionHydrated) scheduleRealtimeRepaint();
  }catch(e){}
  finally{ _cogBusy=false; }
  return true;
}
function refreshLiveSection(){
  if(!S.drawerLiveKind||!S.drawerLiveId) return;
  const el=$('#livesec'); if(!el) return;
  const retained=_retainedVerifiedEntityFeed(
    S.drawerLiveKind,S.drawerLiveId,S.drawerLiveKernel);
  if(retained) el.innerHTML=S.drawerLiveKind==='persona'
    ?renderPersonaFeedDoc(retained,_personaKey(S.drawerLiveKernel,S.drawerLiveId))
    :renderEnvFeedDoc(retained);
  const fallback=()=>{ const el2=$('#livesec'); if(!el2) return;
    if(retained) return;
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
async function personaView(r){ const contentBase=r._base||'',base=nodeBaseForRecord(r),L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v);
  S.curBase=base;
  // PersonaCard public projection (02_PERSONA): bind the SERVED profile doc
  // (links.profile → personas/<id>.json). PER-04: the public card shows
  // reputation_score [0,1] — never raw operator fitness (that lives only in
  // the token-gated operator console). /status is a fallback for liveness.
  const prof=(L.profile?await dfetch(contentBase,L.profile):null)||{};
  const ns=base?(await fetchNodeStatusWithLive(base)||{}):{};
  // The provider/document-signed outer record owns the observation key. A profile
  // may enrich it only after nested identity verification; it cannot redirect the
  // drawer to a different persona while that proof is pending or refused.
  const pid=personaIdFromDid(r.did)||prof.persona_id;
  const personaKey=_personaKey(r._kernel,pid||r.did);
  const identityObservation=providerVerifiedPersonaObservation(personaKey);
  const identityVerified=identityObservation?.identityVerified===true;
  const identityProofState=identityObservation?.identityProofState||'refused';
  const lifecycle=identityObservation?.lifecycle||null;
  const statusPersona=((ns.personas||[]).find((p)=>p.persona_id===pid||(pid&&(p.persona_id||'').endsWith(pid)))||{});
  const ps=prof.persona_id?{...prof,...statusPersona}:statusPersona;
  const rawDisplayName=_personaAuthoredNameForObservation(identityObservation);
  const drawerNameRole=_personaNameRolePresentation(rawDisplayName,pid||r.did);
  const displayName=drawerNameRole.name;
  const explicitRole=identityVerified
    ?r._personaAuthoredRole||_ROLE_NOT_DECLARED:_ROLE_NOT_DECLARED;
  const role=explicitRole;
  const state=lifecycle?.lifecycleState||(identityVerified?ps.lifecycle_state:'observed');
  const rep=ps.reputation_score!=null?Number(ps.reputation_score).toFixed(2):'—';
  // de-dup scalars the live grid already renders as tiles (state / tasks / reputation)
  // and the title already shows (name): keep only rows the grid does NOT carry.
  const personaIdentity=String(pid||r.did||'');
  const drawerCharacteristics=identityVerified&&r._personaCharacteristics
    ?r._personaCharacteristics:null;
  const drawerHeadline=_personaCharacteristicHeadline(drawerCharacteristics,displayName);
  const availability=String(state||'').toUpperCase()==='ACTIVE'?'Available'
    :_sentenceStart(String(state||'observed').replace(/_/g,' '));
  const identityDetails=(lifecycle?kv('Profile creation',`<span class="${lifecycle.materializationState==='pending'?'amber':'ok'}">${esc(lifecycle.materializationState)}</span>`):'')
    +(lifecycle?kv('Profile fields',['name','characteristics','avatar'].map((field)=>{
      const value=lifecycle.identityFields[field];
      return `<span class="cap ${value.state==='pending'?'amber':'ok'}">${esc(field)} ${esc(value.state)}</span>`;
    }).join(' ')):'')
    +(identityVerified&&ps.identity_name_state?kv('Name proof',ps.identity_name_pending
      ?`<span class="amber">pending</span> <span class="l2">${esc(ps.identity_name_pending_reason||'')}</span>`
      :`<span class="ok">${esc(ps.identity_name_state)}</span>`):'')
    +(ps.brain_fragment_count!=null?kv('Private-state counters',`fragments ${esc(ps.brain_fragment_count)} · contexts ${esc(ps.brain_context_count??0)} · compiles ${esc(ps.brain_compile_count??0)}`):'')
    +((ps.last_active_spec_fragment_ids||[]).length?kv('Active spec fragments',esc((ps.last_active_spec_fragment_ids||[]).join(', '))):'')
    +(identityVerified?kv('Soul version',S0(ps.soul_version)):'')
    +verificationIdentityDetails('persona id',personaIdentity);
  let html=(!identityVerified
      ?`<div class="viewerr">${icon('warn','ico-sm')} This public persona profile is still being verified. Name, self-description and portrait stay hidden until that finishes.</div>`:'')
    +kv('Availability',`<span class="${availability==='Available'?'ok':''}">${esc(availability)}</span>`)
    +(role!==_ROLE_NOT_DECLARED?kv('Role',`<span class="cap">${esc(role)}</span>`):'')
    +(role===_ROLE_NOT_DECLARED&&drawerHeadline
      ?kv(drawerHeadline.label,`<span class="cap">${esc(drawerHeadline.value)}</span>`):'')
    +(drawerCharacteristics?H(`About ${displayName}`)
      +_personaCharacteristicsHTML(drawerCharacteristics,{name:displayName,limit:12}):'')
    +(identityVerified?kv('Archetype',S0(ps.archetype)):'')
    +(identityVerified?kv('Disposition',S0(ps.primary_disposition)):'')
    +(identityVerified&&ps.born_specialist?kv('Origin','<span class="amber">Born as a specialist for this work</span>'):'')
    +(identityDetails?`<details class="profile-technical"><summary>Profile verification details</summary><div>${identityDetails}</div></details>`:'');
  // MODEL-PER-ROLE: the distinct models this persona resolved (EnvironmentModelRegistry
  // picks one per role/purpose) — surfaced right under identity when it has live model calls.
  const _personaModelKey=_personaKey(r._kernel,pid||r.did);
  const _liveModelState=S.liveByPersona.get(_personaModelKey)||{};
  const _liveModels=_personaModelHistory(_personaModelKey,_liveModelState.models||[]);
  if(_liveModels.length) html+=kv('Recent model use',_modelSummary(_liveModels));
  if(identityVerified&&ps.description) html+=H('Description')+`<div class="desc2">${esc(String(ps.description).slice(0,400))}</div>`;
  if(identityVerified&&(ps.advertised_interests||[]).length) html+=H('Interests')+chipsOf(ps.advertised_interests);
  if(identityVerified&&(ps.domain_curatorships||[]).length) html+=H('Domain curatorships')+chipsOf(ps.domain_curatorships);
  // what this persona CAN DO — its advertised capabilities (filtering the generic
  // project_workspace marker, same as the env lanes do).
  const authoredCapabilities=identityVerified&&Array.isArray(r._personaCapabilitiesSummary)
    ?r._personaCapabilitiesSummary:[];
  if(authoredCapabilities.length) html+=H('What I can contribute')
    +authoredCapabilitiesHTML(authoredCapabilities);
  // Keep the exact run binding for artifact navigation. Run lifecycle and
  // persona-authored notes are rendered by their independently verified live
  // surfaces; the drawer does not synthesize a mission plan from run status.
  const _personaEnv=envRecordForAuthority(r);
  const _prun=runOf(r)||(_personaEnv.recordId?runForEnv(S.recs.get(_personaEnv.recordId)):null);
  // LIVE per-persona activity — what this persona is doing right now + its
  // evolving internal state, streamed in place on every telemetry tick. Prefers
  // the persona's OWN feed document (links.telemetry → telemetry/personas/<slug>.json).
  S.drawerLiveKind='persona'; S.drawerLiveId=pid||r.did; S.drawerLiveKernel=r._kernel||kernelForBase(base); S.drawerLiveBase=base;
  S.drawerLiveFeed=(base&&L.telemetry&&!String(L.telemetry).includes('live/latest'))?L.telemetry:'';
  const retainedPersonaTelemetry=_retainedVerifiedEntityFeed(
    'persona',S.drawerLiveId,S.drawerLiveKernel);
  html+=H('● Current work status')+`<div id="livesec" class="livesec">${retainedPersonaTelemetry
    ?renderPersonaFeedDoc(retainedPersonaTelemetry,personaKey)
    :renderPersonaLive(pid||r.did,ps,S.drawerLiveKernel)}</div>`;
  if(S.drawerLiveFeed) setTimeout(refreshLiveSection,0);
  // C-OP-16: the run's kernel-signed scorecard beside the member's work status.
  const _personaEnvIds=_personaEnv.authority?.status==='resolved'&&_personaEnv.authority.environmentId
    ?[_personaEnv.authority.environmentId]:[];
  const _personaTaskId=String(S.recs.get(_pkTaskFacts(S.drawerLiveKernel,_personaEnvIds[0]||'',_prun)?.recordId)?.task_lifecycle?.task_id||'');
  const _personaScorecardHit=_scorecardForRun(S.drawerLiveKernel,_prun,_personaTaskId,_personaEnvIds,r);
  html+=H(_personaScorecardHit?.via==='task'?"Scorecard of this task's latest settle"
    :_personaScorecardHit?.via==='latest'?"Latest settled scorecard in this member's environments":'Run scorecard')
    +(_personaScorecardHit?_runScorecardHTML(_personaScorecardHit.scorecard,{via:_personaScorecardHit.via})
    :'<div class="privacy-note">No kernel-signed scorecard for this run yet — the run has not reached its settle point, or no environment or task record carries one.</div>');
  // Public activity combines persona-signed final output with explicitly
  // provisional kernel observations; the private thinking frame remains
  // available only with operator authority. Both refresh on the live cadence.
  S.drawerThinkPid=base?_signedPersonaEndpointId(personaKey):null;
  const thinkingEndpoint=base?join(base,`personas/${encodeURIComponent(S.drawerThinkPid)}/thinking`):'';
  const operatorThinking=!!thinkingEndpoint&&!!tokenFor(thinkingEndpoint);
  html+=H(operatorThinking?'Private thinking':'Shared thoughts and work updates')
    +`<div id="thinksec" class="livesec">${base
      ?`<div class="fv-loading">${operatorThinking?'resolving cognition…':'resolving verified public activity…'}</div>`
      :'<div class="privacy-note">No current-master-verified node route is available for public activity.</div>'}</div>`;
  if(base) setTimeout(refreshThinking,0);
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
  if(bid) nav+=`<div class="row">${recLink(bid,'Artifact bundle →')}</div>`;
  if(nav) html+=H('Related')+nav;
  if(L.profile) html+=H('Source')+`<div class="row"><a href="${esc(safeUrl(join(contentBase,L.profile)))}" target="_blank" rel="noopener">signed persona card →</a></div>`;
  return {title:`<span class="kind k-persona">PERSONA</span> ${esc(displayName)}`, html};
}
async function envView(r){ const contentBase=r._base||'',base=nodeBaseForRecord(r),L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v); S.curBase=base;
  // EnvironmentInstance export (05_ENVIRONMENT): bind the SERVED env doc
  // (environments/<id>.json) — env_type, status, members, lineage_digest,
  // rule_count. /status is only a liveness fallback when no export link exists.
  const d=(L.export?await dfetch(contentBase,L.export):null)||{};
  const ns=d.environment_id||!base?{}:(await fetchNodeStatusWithLive(base)||{});
  const members=d.members||[];
  const ld=d.lineage_digest||{};
  // de-dup scalars the live tiles + the 'Members (N)' header already carry
  // (name is in the title; status + member count are live tiles): keep only the rest.
  const environmentReference=String(d.environment_id||r.did||r.label||'');
  const workspaceName=_environmentNameFor(environmentReference,r._kernel);
  let html=kv('Workspace',`<b>${esc(workspaceName)}</b>`)
    +kv('Type',`<span class="cap">${esc(d.env_type||'—')}</span>`)
    +kv('Env rules',S0(d.rule_count))
    +kv('Lineage events',S0(ld.event_count))
    +verificationIdentityDetails('environment id',environmentReference);
  // MODEL-PER-ROLE: the distinct models in use across this environment's personas
  // (the env's own model_events) — what THIS workspace is actually running on.
  const _envLiveModels=(S.liveByEnv.get(_environmentKey(r._kernel,d.environment_id||r.did))||{}).models||[];
  if(_envLiveModels.length) html+=kv('Models in use',_modelSummary(_envLiveModels));
  if(d.description) html+=H('Description')+`<div class="desc2">${esc(String(d.description).slice(0,300))}</div>`;
  // Deliverables produced in THIS environment. Artifact records participate only
  // when their independently verified authority names this exact environment.
  const manifestRel=L.artifact_manifest||d.artifact_manifest||'';
  const manifest=manifestRel?await dfetch(contentBase,manifestRel):null;
  const manifestFiles=manifestArtifacts(manifest);
  const _sid=_envSid(r)||_envSidFromValue(d.environment_id);
  const myArts=S.order.map((id)=>S.recs.get(id)).filter((x)=>x&&x.kind==='artifact'
    &&(()=>{ const authority=environmentAuthorityOfRecord(x);
      return authority.status==='resolved'&&authority.environmentId===_sid; })());
  const myBundles=myArts.filter((a)=>a._links&&a._links.bundle);
  const signedProjection=_artifactRevisionProjection(myArts);
  const signedFiles=signedProjection.current?.rows||[];
  const signedPaths=new Set(signedFiles.map((file)=>_artifactDisplayPath(file)));
  const signedRun=[...new Set(signedFiles.map((file)=>runOf(file)).filter(Boolean))].sort().at(-1)||'';
  const manifestRouteRun=(String(manifestRel).match(/(?:^|\/)k\/(run-[0-9A-Za-z]+)(?:\/|$)/)||[])[1]||'';
  const manifestRunId=manifestRun(manifest)||manifestRouteRun;
  // The signed file cards and fetched manifest are independent evidence lanes.
  // A partial or stale manifest must never erase a complete signed generation.
  // A manifest may supplement filenames only when it is not mechanically older
  // than the latest signed run; its unverified metadata never overrides cards.
  const manifestCanSupplement=!signedRun||!manifestRunId||manifestRunId>=signedRun;
  const manifestOnlyFiles=manifestCanSupplement
    ?manifestFiles.filter((file)=>!signedPaths.has(_artifactDisplayPath(file)))
    :[];
  if(signedFiles.length||manifestOnlyFiles.length) html+=H('Workspace files');
  if(signedFiles.length){
    html+=_ownedOutputsHTML(myArts,{label:'Latest signed workspace files',scope:'shared workspace'});
  }
  if(manifestOnlyFiles.length){
    html+=`<details class="artifact-index"><summary><span>Browse ${manifestOnlyFiles.length} additional manifest filename${manifestOnlyFiles.length===1?'':'s'}</span>${icon('chevron','ico-sm')}</summary>`
      +`<div class="artifact-index-body">${renderArtifactTree(manifestOnlyFiles,manifestRunId)}</div>`
      +`<div class="artifact-preview-note">These additional filenames come from the environment's published manifest. Openable signed file records remain visible above and replace matching manifest-only entries as they arrive.</div></details>`;
  }
  if(myBundles.length){
    html+=H('Published packages');
    for(const bnd of myBundles)
      html+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(bnd._links.bundle)}" data-rec="${esc(bnd.record_id||bnd.card_id||'')}">${icon('box','ico-sm')} ${esc(bnd.label||'artifact bundle')} →</a></div>`;
  }
  const roster=members.length?members:( (ns.personas||[]).map((p)=>({persona_id:p.persona_id,role:p.role,active:p.lifecycle_state==='ACTIVE'})) );
  if(roster.length){
    html+=H(`Members (${roster.length})`);
    html+=roster.map((m)=>{
      const rid=findRecByDid(m.persona_id,r._kernel)||findRecByDid('did:personaos:'+m.persona_id,r._kernel);
      const memberName=_nameFor(m.persona_id,r._kernel);
      const label=rid?recLink(rid,memberName):esc(memberName);
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
  S.drawerLiveFeed=(base&&L.telemetry&&!String(L.telemetry).includes('live/latest'))?L.telemetry:'';
  const retainedEnvironmentTelemetry=_retainedVerifiedEntityFeed(
    'env',envId,S.drawerLiveKernel);
  // C-OP-16: the environment is the durable carrier of its runs' scorecards
  // (one per task, newest settle first), each independently kernel-signed.
  if(r._runScorecardsVerified===true&&Array.isArray(r.run_scorecards)&&r.run_scorecards.length){
    html+=H(`Run scorecards (${r.run_scorecards.length})`)
      +`<div class="env-scorecards">`+r.run_scorecards.map((card)=>{
        const settled=_friendlyInstant(card.settled_at)||String(card.settled_at||'');
        return `<div class="env-scorecard"><div class="env-scorecard-head" title="${esc(`task ${card.task_id} · run ${card.run_id}`)}">`
          +`<span>task ${esc(_shortId(card.task_id).slice(0,12))}</span><span>run ${esc(_shortId(card.run_id).slice(0,16))}</span><span>settled ${esc(settled)}</span></div>`
          +_runScorecardHTML(card,{via:'run'})+`</div>`; }).join('')+`</div>`;
  }
  html+=H('● Live · inside this environment')+`<div id="livesec" class="livesec">${retainedEnvironmentTelemetry
    ?renderEnvFeedDoc(retainedEnvironmentTelemetry)
    :renderEnvLive(envId,S.drawerLiveKernel)}</div>`;
  if(S.drawerLiveFeed) setTimeout(refreshLiveSection,0);
  html+=trustPanel(r);
  const did=kernelRec(r._kernel,'domain'), pid=kernelRec(r._kernel,'project'); let nav='';
  if(did) nav+=`<div class="row">${recLink(did,'Domain →')}</div>`;
  if(pid) nav+=`<div class="row">${recLink(pid,'Project →')}</div>`;
  if(L.bundle && !myBundles.length) nav+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(L.bundle)}">Artifact bundle →</a></div>`;
  if(nav) html+=H('Related')+nav;
  return {title:`<span class="kind k-env">ENV</span> ${esc(workspaceName)}`, html};
}
// ---------- deliverable-bundle artifact TREE ----------
// Bundle-export artifacts carry their opaque package-relative path in `title`;
// '/' separators are preserved. The on-disk body lives at
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
    const filePresentation=_artifactFilePresentation(f.path);
    const declaration=_artifactDeclarationDisplayProjection(a);
    const authored=authoredArtifactLabels(a), semanticAttr=artifactSemanticsAttr(a);
    const media=declaredArtifactMedia(a);
    const primaryTitle=declaration.title||filePresentation.title;
    const declarer=_artifactDeclarationPersonaLabel(declaration,String(a._kernel||''));
    const body=published
      ? `<a href="#" data-act="file" data-path="${esc(_bodyPath('artifacts/package/'+f.path,pkgRun))}" data-title="${esc(f.path)}" data-kind="${esc(media)}" data-semantics="${esc(semanticAttr)}" data-declaration="${esc(artifactDeclarationAttr(declaration))}" data-hash="${esc(a.content_hash||'')}" data-size="${esc(a.size_bytes??a.size??a.bytes??'')}" title="${esc(f.path)}"><span class="artifact-tree-file"><span>${esc(primaryTitle)}</span>${filePresentation.extensionLabel?`<em>${esc(filePresentation.extensionLabel)}</em>`:''}</span></a>`
      : `<span class="tgated" title="${esc(f.path)}"><span class="artifact-tree-file"><span>${esc(primaryTitle)}</span>${filePresentation.extensionLabel?`<em>${esc(filePresentation.extensionLabel)}</em>`:''}</span> <span class="no">· origin_gated</span></span>`;
    const sz=(a.size_bytes??a.size??a.bytes);
    h+=`<div class="tnode tfile" style="padding-left:${depth*14}px">${body}<span class="l2">${declaration.title?`${esc(filePresentation.filename)} · `:''}${declarer?`declared by ${esc(declarer)} · `:''}${authored.length?`authored: ${esc(authored.join(' · '))} · `:''}${esc(media||'—')}${sz!=null&&sz!==''?' · '+fmtBytes(+sz):''}</span></div>`; }
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
    // A public node publishes artifact bytes anonymously. If a bundle fetch still
    // fails, retain its verified manifest without implying that a bearer would fix it.
    const run=(String(url||'').match(/k\/(run-[0-9A-Za-z]+)/)||[])[1]||'';
    const files=(S.order||[]).map((id)=>S.recs.get(id)).filter((r)=>r&&r.kind==='artifact'
        && !((r._links||{}).bundle) && runOf(r)===run);
    let mh=`<div class="empty-card"><h3>${icon('key')} Artifact bundle — bytes unavailable on this route</h3>`
      +'<p class="desc2">The signed file manifest remains visible, but this route did not return '
      +'the published bundle bytes. The browser does not request a process bearer or downgrade '
      +'to a mutation-capable surface; try another verified route when one is discovered.</p></div>';
    if(files.length){
      mh+=H(`Files (${files.length}) — published manifest`)+files.slice(0,80).map((r)=>{
        const L2=r._links||{}; const h=String(L2.content_hash||'').replace('sha256:','').slice(0,10);
        const authored=authoredArtifactLabelText(r);
        return `<div class="grant"><span class="l2">${esc(r.label||'file')}</span>`
          +`<span class="tier">${authored?`authored: ${esc(authored)} · `:''}${esc(declaredArtifactMedia(r))}${h?` · ${h}…`:''}</span></div>`;
      }).join('');
    }
    return {title:'artifact bundle manifest', html:mh};
  }
  // Render the exact optional evidence carried by this artifact grouping. The
  // browser does not interpret lifecycle vocabulary, verdict words, receipt
  // absence, or co-signature counts as acceptance, completion, or quality.
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  const arts=d.artifacts||[], ev=d.verifier_evidence||[], rv=d.review_verdicts||[];
  const cosigners=d.co_signers||Object.keys(d.co_signatures||{});
  let html=kv('Authored grouping kind',`<span class="cap">${esc(d.bundle_kind||'not declared')}</span>`)
    +kv('Version',S0(d.version))
    +kv('Outward tier',`<span class="tier-pill t-${esc(d.outward_artifact_tier||d.visibility_tier||'federation')}">${esc(d.outward_artifact_tier||d.visibility_tier||'federation')}</span>`)
    +kv('Contributors',S0((d.contributors||[]).map((id)=>_nameFor(id,kernelForBase(base))).join(', ')))
    +(cosigners.length?kv('Co-signature references',esc(cosigners.length)):'')
    +verificationIdentityDetails('bundle id',d.bundle_id);
  if(ev.length){
    html+=H(`Authored verifier and tool receipts (${ev.length})`);
    html+=ev.slice(0,12).map((e)=>{
      const exact=[e.exit_status_kind,e.parsed_verdict,e.failure_kind]
        .filter((value)=>value!==undefined&&value!==null&&String(value)!=='')
        .map((value)=>`<code>${esc(value)}</code>`).join(' · ');
      const signer=e.signed_by_kernel===true?' · authored field: signed_by_kernel=true':'';
      return `<div class="grant"><span class="l2">${esc(e.command_or_api_fingerprint||e.stage_id||'receipt')}</span>`
        +`<span class="tier">${exact||'exact outcome not authored'}${esc(signer)}</span></div>`;
    }).join('');
  }
  if(rv.length){
    html+=H(`Authored review receipts (${rv.length})`);
    html+=rv.slice(0,8).map((v)=>`<div class="grant"><span class="l2">${esc(v.reviewer_id||v.reviewer_persona_id||v.reviewer||'reviewer')}${v.signed_by?` · signature reference ${esc(v.signed_by)}`:''}</span>`
      +`<span class="tier"><code>${esc(v.verdict||'outcome not authored')}</code></span></div>`
      +(v.rationale?`<div class="desc2">${esc(String(v.rationale).slice(0,240))}</div>`:'')).join('');
  }
  if(cosigners.length){
    html+=H(`Co-signature references (${cosigners.length})`);
    html+=cosigners.map((c)=>`<div class="grant"><span class="l2">${esc(c)}</span><span class="tier">authored reference</span></div>`).join('');
  }
  html+=H(`Artifacts (${arts.length}) — click to view`)+renderArtifactTree(arts,pkgRun);
  if(L && L.run){ html+=H('Provenance')
    +`<div class="row"><a href="#" data-act="body" data-url="${esc(L.run)}">Authored body evidence →</a></div>`
    +`<div class="row"><a href="#" data-act="verify" data-url="${esc(L.run)}">Authored verification receipts →</a></div>`
    +`<div class="row"><a href="#" data-act="physical" data-url="${esc(L.run)}">Physical-asset evidence →</a></div>`;
    if(L.oci) html+=`<div class="row"><a href="#" data-act="dist" data-oci="${esc(L.oci)}" data-dag="${esc(L.dag||'')}" data-reg="${esc(L.registry||'')}">Distribution · OCI + IPLD →</a></div>`; }
  return {title:'<span class="kind k-artifact">ARTIFACTS</span> Authored artifact grouping', html};
}
/* ====================================================================
   DECLARED-MEDIA ARTIFACT RENDERING
   --------------------------------------------------------------------
   A path is an opaque persona-authored identifier. It never controls the
   renderer, and peer bytes are never searched for domain words. Rich views are
   selected from admitted media metadata plus bounded file signatures inspected
   only after the fetched bytes match their advertised SHA-256. Format detection
   is presentation-only authority. Unknown media use the generic inspector.

   SECURITY: artifact bodies are REMOTE PEER content. Markdown, tables, code,
   and plain text use textContent-only primitives. Declared image/audio/video
   and PDF bytes render through view-scoped blob URLs. No peer code is loaded.
   ==================================================================== */

// Renderers that consume bytes. All unknown media enters this path, so a custom
// persona/tool artifact remains observable without the substrate naming it.
const BINARY_RENDERERS=new Set(['image','audio','video','pdf','archive','cad3d','generic']);

function pickRenderer(kind,path='',responseMedia='',contentMedia=''){
  return selectArtifactRenderer(kind,{path,responseMedia,contentMedia});
}

// Track blob: URLs allocated for the current view so they're revoked on change.
function mkBlobURL(blob,ctx=null){
  ctx?.assertCurrent?.();
  const u=URL.createObjectURL(blob);
  (ctx?.onCleanup||onViewCleanup)(()=>URL.revokeObjectURL(u));
  if(ctx?.signal?.aborted){ URL.revokeObjectURL(u); ctx.assertCurrent?.(); }
  return u;
}

// Nodes may serve bodies as application/octet-stream. After integrity checking,
// restore only the exact declared Web media family selected above; arbitrary
// declarations remain application/octet-stream.
function safeRenderMime(kind,path='',responseMedia='',contentMedia=''){
  const selected=pickRenderer(kind,path,responseMedia,contentMedia), media=selected.mediaType;
  return ['image','audio','video','pdf'].includes(selected.id)
    ?media:'application/octet-stream';
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
  // Render the same hash-checked bytes as a formatted document: headings, lists,
  // emphasis, code, and clickable http/https/mailto links (both bare URLs and
  // [label](url)). The renderer builds DOM via createElement/textContent under a
  // strict scheme allowlist — raw HTML in the body (e.g. <script>, <img onerror>)
  // is inert text, never executed. The "plain text view" toggle keeps the exact
  // escaped source available for byte inspection.
  const text=String(ctx.text||'').slice(0,LIVE_ARTIFACT_LIMITS.maxFileBytes);
  host.appendChild(renderMarkdownDocument(text,document));
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
  const delimiter=String(ctx.kind||'').toLowerCase()==='text/tab-separated-values'?'\t':',';
  const N=500, rows=parseCsvBounded(String(ctx.text||''),delimiter); const shown=rows.slice(0,N);
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
async function artifactBytes(ctx,label='artifact'){
  ctx.assertCurrent?.();
  if(ctx.verifiedBytes instanceof Uint8Array){ ctx.realSize=ctx.verifiedBytes.byteLength; return ctx.verifiedBytes; }
  if(ctx.verifiedBytes instanceof ArrayBuffer){
    ctx.verifiedBytes=new Uint8Array(ctx.verifiedBytes); ctx.realSize=ctx.verifiedBytes.byteLength;
    return ctx.verifiedBytes;
  }
  ctx.reportProgress?.(`fetching ${label} bytes`);
  const fb=await fetchBlob(ctx.url,{signal:ctx.signal});
  ctx.assertCurrent?.();
  if(!fb) throw new Error(`${label} body unavailable`);
  ctx.realSize=fb.size;
  const bytes=new Uint8Array(await fb.blob.arrayBuffer());
  ctx.assertCurrent?.(); return bytes;
}
async function renderImage(host,ctx){
  const bytes=await artifactBytes(ctx,'image');
  const url=mkBlobURL(new Blob([bytes],{type:safeRenderMime(ctx.kind,ctx.title,ctx.responseMedia,ctx.detectedMedia)}),ctx);
  host.innerHTML='';
  const img=document.createElement('img'); img.className='fv-img'; img.alt=ctx.title;
  img.addEventListener('error',()=>{ host.innerHTML='';
    const card=el('div','fv-card'); card.appendChild(el('div','fv-cardhd',artifactTypeLabel(ctx.kind)));
    card.appendChild(el('p','fv-note','This browser cannot display this image format. The verified original remains available from the download action above.'));
    host.appendChild(card); },{once:true});
  img.src=url;   // blob: URL — SVG too (NOT inline innerHTML)
  host.appendChild(img);
}
async function renderMedia(host,ctx,type){
  const bytes=await artifactBytes(ctx,type);
  const url=mkBlobURL(new Blob([bytes],{type:safeRenderMime(ctx.kind,ctx.title,ctx.responseMedia,ctx.detectedMedia)}),ctx);
  host.innerHTML=''; const media=document.createElement(type); media.className=`fv-${type}`;
  media.controls=true; media.preload='metadata'; media.src=url; media.setAttribute('playsinline','');
  media.setAttribute('controlslist','nodownload noplaybackrate'); media.setAttribute('disablepictureinpicture','');
  media.addEventListener('error',()=>{ host.innerHTML='';
    const card=el('div','fv-card'); card.appendChild(el('div','fv-cardhd',artifactTypeLabel(ctx.kind)));
    card.appendChild(el('p','fv-note',`This browser cannot play this ${type} format. The verified original remains available from the download action above.`));
    host.appendChild(card); },{once:true});
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

/* ---------- bounded engineering-format previews ----------
   These parsers operate only on the selected artifact after its advertised
   hash has been checked. They derive presentation geometry/metadata locally;
   no peer code, external dependency, or embedded reference is executed. */
const SVG_NS='http://www.w3.org/2000/svg';
const MAX_DXF_RENDER_POINTS=50000;
function svgEl(tag,attrs={}){ const node=document.createElementNS(SVG_NS,tag);
  for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
  return node; }
function dxfUnitLabel(text){
  const code=/\$INSUNITS\s*\r?\n\s*70\s*\r?\n\s*(\d+)/i.exec(text)?.[1]||'';
  return ({0:'unitless',1:'inches',2:'feet',4:'millimetres',5:'centimetres',6:'metres'})[code]||'not declared';
}
function parseDxfEntities(text){
  const source=String(text||'').slice(0,LIVE_ARTIFACT_LIMITS.maxFileBytes);
  const lines=source.split(/\r?\n/), pairs=[];
  for(let index=0;index+1<lines.length&&pairs.length<250000;index+=2){
    const code=Number.parseInt(lines[index].trim(),10);
    if(Number.isFinite(code)) pairs.push({code,value:lines[index+1].trim()});
  }
  const entities=[]; let section='', current=null;
  const flush=()=>{ if(current&&entities.length<5000) entities.push(current); current=null; };
  for(let index=0;index<pairs.length;index++){
    const pair=pairs[index];
    if(pair.code===0&&pair.value==='SECTION'){
      flush(); section=pairs[index+1]?.code===2?pairs[++index].value:''; continue;
    }
    if(pair.code===0&&pair.value==='ENDSEC'){ flush(); section=''; continue; }
    if(section!=='ENTITIES') continue;
    if(pair.code===0){
      flush();
      if(!['EOF','SEQEND'].includes(pair.value)) current={type:pair.value,values:new Map(),ordered:[]};
      continue;
    }
    if(!current) continue;
    const values=current.values.get(pair.code)||[]; values.push(pair.value);
    current.values.set(pair.code,values); current.ordered.push(pair);
  }
  flush(); return {entities,truncated:entities.length>=5000,units:dxfUnitLabel(source)};
}
const dxfValues=(entity,code)=>entity?.values?.get(code)||[];
const dxfValue=(entity,code,index=0)=>dxfValues(entity,code)[index]??'';
const dxfNumber=(entity,code,index=0)=>{ const value=Number(dxfValue(entity,code,index)); return Number.isFinite(value)?value:null; };
function dxfPolylinePoints(entity,limit=MAX_DXF_RENDER_POINTS){
  const points=[]; let pending=null, truncated=false;
  const appendPending=()=>{ if(pending?.x==null||pending?.y==null) return;
    if(points.length<limit) points.push(pending); else truncated=true; };
  for(const pair of entity.ordered){
    if(pair.code===10){ appendPending();
      const x=Number(pair.value); pending=Number.isFinite(x)?{x,y:null}:null; }
    else if(pair.code===20&&pending){ const y=Number(pair.value); if(Number.isFinite(y)) pending.y=y; }
  }
  appendPending(); return {points,truncated};
}
function dxfGeometry(parsed){
  const geometry=[], layers=new Set(), typeCounts=new Map(), points=[]; let truncated=false;
  const addPoint=(x,y)=>{ if(!Number.isFinite(x)||!Number.isFinite(y)) return false;
    if(points.length>=MAX_DXF_RENDER_POINTS){ truncated=true; return false; }
    points.push({x,y}); return true; };
  for(const entity of parsed.entities){
    typeCounts.set(entity.type,(typeCounts.get(entity.type)||0)+1);
    const layer=String(dxfValue(entity,8)||'0').slice(0,80); layers.add(layer);
    if(points.length>=MAX_DXF_RENDER_POINTS){ truncated=true; continue; }
    if(entity.type==='LINE'){
      const x1=dxfNumber(entity,10),y1=dxfNumber(entity,20),x2=dxfNumber(entity,11),y2=dxfNumber(entity,21);
      if([x1,y1,x2,y2].every(Number.isFinite)){ geometry.push({type:'line',layer,x1,y1,x2,y2}); addPoint(x1,y1); addPoint(x2,y2); }
    }else if(entity.type==='LWPOLYLINE'){
      const remaining=Math.max(0,MAX_DXF_RENDER_POINTS-points.length);
      const polyline=dxfPolylinePoints(entity,remaining), vertices=polyline.points;
      truncated=truncated||polyline.truncated; if(vertices.length>1){
        const closed=(Number(dxfValue(entity,70))&1)===1;
        geometry.push({type:'polyline',layer,vertices,closed}); vertices.forEach(({x,y})=>addPoint(x,y)); }
    }else if(entity.type==='CIRCLE'||entity.type==='ARC'){
      const x=dxfNumber(entity,10),y=dxfNumber(entity,20),r=dxfNumber(entity,40);
      if([x,y,r].every(Number.isFinite)&&r>0){ const start=dxfNumber(entity,50),end=dxfNumber(entity,51);
        geometry.push({type:entity.type.toLowerCase(),layer,x,y,r,start,end}); addPoint(x-r,y-r); addPoint(x+r,y+r); }
    }else if(['TEXT','MTEXT'].includes(entity.type)){
      const x=dxfNumber(entity,10),y=dxfNumber(entity,20),height=dxfNumber(entity,40)||0.18;
      const value=String(dxfValue(entity,1)||dxfValue(entity,3)||'').replace(/\\P/g,' ').slice(0,240);
      if(Number.isFinite(x)&&Number.isFinite(y)&&value){ geometry.push({type:'text',layer,x,y,height,value}); addPoint(x,y); }
    }
  }
  return {geometry,layers:[...layers].sort(),typeCounts,points,truncated};
}
function dxfLayerColour(layer){ let hash=0; for(const char of String(layer)) hash=(hash*31+char.charCodeAt(0))>>>0;
  return `hsl(${(hash%240)+160} 72% 66%)`; }
function cadFormat(ctx){
  const media=String(ctx.detectedMedia||ctx.kind||'').toLowerCase();
  if(media.includes('ifc')) return 'ifc'; if(media.includes('step')) return 'step';
  if(media.includes('stl')) return 'stl'; if(media.includes('obj')) return 'obj';
  if(media.includes('ply')) return 'ply'; if(media.includes('gltf-binary')) return 'glb';
  if(media.includes('gltf')) return 'gltf';
  const leaf=String(ctx.title||'').toLowerCase().split(/[?#]/,1)[0];
  return (leaf.match(/\.([a-z0-9]+)$/)||[])[1]||'cad';
}
function inspectCadBytes(bytes,format){
  const result={facts:[],types:new Map(),preview:'',warning:''};
  const decoded=()=>new TextDecoder().decode(bytes.subarray(0,Math.min(bytes.length,LIVE_ARTIFACT_LIMITS.maxFileBytes)));
  if(format==='stl'){
    if(bytes.length>=84){ const triangles=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(80,true);
      if(triangles>0&&84+triangles*50===bytes.length){ result.facts.push(['Encoding','binary STL'],['Triangles',triangles]); return result; } }
    const text=decoded(); result.facts.push(['Encoding',/^\s*solid\b/i.test(text)?'ASCII STL':'unrecognised STL'],['Facets inspected',(text.match(/^\s*facet\s+normal\b/gmi)||[]).length]); result.preview=text.slice(0,20000); return result;
  }
  if(format==='gltf'||format==='glb'){
    if(format==='glb'){ result.facts.push(['Container','binary glTF'],['Size',fmtBytes(bytes.length)]); return result; }
    const text=decoded(); try{ const document=JSON.parse(text), external=[];
      const pending=[document]; while(pending.length&&external.length<32){ const value=pending.pop();
        if(Array.isArray(value)){ pending.push(...value); continue; } if(!value||typeof value!=='object') continue;
        for(const [key,child] of Object.entries(value)){ if(key==='uri'&&typeof child==='string'&&!child.startsWith('data:')) external.push(child);
          else if(child&&typeof child==='object') pending.push(child); } }
      result.facts.push(['Scenes',document.scenes?.length||0],['Nodes',document.nodes?.length||0],['Meshes',document.meshes?.length||0],['External dependencies',external.length?`${external.length} declared · not fetched`:'none declared']);
    }catch(_){ result.warning='The glTF JSON could not be parsed.'; } result.preview=text.slice(0,20000); return result;
  }
  const text=decoded(); result.preview=text.slice(0,20000);
  if(format==='ifc'||format==='step'){
    const schema=/FILE_SCHEMA\s*\(\s*\(\s*['"]([^'"]+)/i.exec(text)?.[1]||'';
    let entities=0; for(const match of text.matchAll(/^#\d+\s*=\s*([A-Z][A-Z0-9_]*)/gmi)){
      entities++; const type=match[1].toUpperCase(); result.types.set(type,(result.types.get(type)||0)+1); }
    result.facts.push(['STEP envelope',/^ISO-10303-21;/i.test(text.trimStart())?'recognised':'not recognised']);
    if(schema) result.facts.push(['Schema',schema]); result.facts.push(['Entities inspected',entities]);
    if(format==='ifc') result.facts.push(['IFC entity types',result.types.size]);
    const declaration=/FILE_DESCRIPTION\s*\(\s*\(\s*['"]([^'"]+)/i.exec(text)?.[1]||'';
    if(declaration) result.facts.push(['Author declaration',declaration.slice(0,240)]);
    if(/\b(?:NOT VALIDATED|IFC-LIKE)\b/i.test(declaration)) result.warning='The file itself says it is schematic or not validated IFC. Treat it as coordination data, not an authoritative BIM model.';
    return result;
  }
  if(format==='obj'){
    let vertices=0,normals=0,faces=0,lines=0,materials=0;
    for(const line of text.split(/\r?\n/)){ if(/^v\s/.test(line)) vertices++; else if(/^vn\s/.test(line)) normals++; else if(/^f\s/.test(line)) faces++; else if(/^l\s/.test(line)) lines++; else if(/^(?:mtllib|usemtl)\s/.test(line)) materials++; }
    result.facts.push(['Vertices',vertices],['Normals',normals],['Faces',faces],['Line elements',lines],['Material references',materials?`${materials} declared · not fetched`:'none declared']); return result;
  }
  if(format==='ply'){
    const header=text.slice(0,Math.max(0,text.indexOf('end_header')+10)); result.preview=header;
    result.facts.push(['PLY header',/^ply\s*$/m.test(header)?'recognised':'not recognised']);
    for(const name of ['vertex','face']){ const count=new RegExp(`^element\\s+${name}\\s+(\\d+)`,'mi').exec(header)?.[1]; if(count) result.facts.push([`${humanizeMachineKey(name)} elements`,count]); }
    const encoding=/^format\s+([^\s]+)/mi.exec(header)?.[1]; if(encoding) result.facts.push(['Encoding',encoding]); return result;
  }
  result.facts.push(['Format',format.toUpperCase()]); return result;
}

const CAD_MESH_LIMITS=Object.freeze({vertices:100000,triangles:160000,drawTriangles:14000});
const _finite3=(point)=>Array.isArray(point)&&point.length===3&&point.every(Number.isFinite);
function _cadMesh(format){ return {format,vertices:[],triangles:[],groups:[],truncated:false,warnings:[]}; }
function _cadTriangle(mesh,a,b,c,group=0){
  if(mesh.triangles.length>=CAD_MESH_LIMITS.triangles){ mesh.truncated=true; return; }
  if([a,b,c].every((value)=>Number.isSafeInteger(value)&&value>=0&&value<mesh.vertices.length)
      &&a!==b&&b!==c&&a!==c) mesh.triangles.push({a,b,c,group});
}
function parseObjMesh(bytes){
  const mesh=_cadMesh('obj'),text=new TextDecoder().decode(bytes),groups=new Map(); let group=0;
  const groupId=(name)=>{ const key=String(name||'default').slice(0,120);
    if(!groups.has(key)) groups.set(key,groups.size); return groups.get(key); };
  groups.set('default',0);
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim(); if(!line||line.startsWith('#')) continue;
    const parts=line.split(/\s+/),kind=parts.shift();
    if(kind==='v'&&parts.length>=3){ if(mesh.vertices.length>=CAD_MESH_LIMITS.vertices){ mesh.truncated=true; continue; }
      const point=parts.slice(0,3).map(Number); if(_finite3(point)) mesh.vertices.push(point); }
    else if(['o','g','usemtl'].includes(kind)) group=groupId(`${kind}:${parts.join(' ')}`);
    else if(kind==='f'&&parts.length>=3){ const indices=[];
      for(const token of parts){ const rawIndex=Number.parseInt(token.split('/',1)[0],10);
        if(!Number.isSafeInteger(rawIndex)||rawIndex===0) continue;
        const index=rawIndex<0?mesh.vertices.length+rawIndex:rawIndex-1;
        if(index>=0&&index<mesh.vertices.length) indices.push(index); }
      for(let index=1;index+1<indices.length;index++) _cadTriangle(mesh,indices[0],indices[index],indices[index+1],group);
    }
  }
  mesh.groups=[...groups.keys()]; return mesh;
}
function parseStlMesh(bytes){
  const mesh=_cadMesh('stl');
  if(bytes.length>=84){ const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=view.getUint32(80,true);
    if(count>0&&84+count*50===bytes.length){ const shown=Math.min(count,Math.floor(CAD_MESH_LIMITS.vertices/3),CAD_MESH_LIMITS.triangles);
      for(let face=0;face<shown;face++){ const offset=84+face*50,base=mesh.vertices.length;
        for(let corner=0;corner<3;corner++){ const at=offset+12+corner*12;
          mesh.vertices.push([view.getFloat32(at,true),view.getFloat32(at+4,true),view.getFloat32(at+8,true)]); }
        _cadTriangle(mesh,base,base+1,base+2,0); }
      mesh.truncated=shown<count; mesh.groups=['solid']; return mesh; }
  }
  const text=new TextDecoder().decode(bytes),pending=[];
  for(const line of text.split(/\r?\n/)){ const match=/^\s*vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/i.exec(line);
    if(!match) continue; const point=match.slice(1,4).map(Number); if(!_finite3(point)) continue;
    pending.push(point); if(pending.length===3){ if(mesh.vertices.length+3>CAD_MESH_LIMITS.vertices){ mesh.truncated=true; break; }
      const base=mesh.vertices.length; mesh.vertices.push(...pending.splice(0)); _cadTriangle(mesh,base,base+1,base+2,0); }
  }
  mesh.groups=['solid']; return mesh;
}
function parseAsciiPlyMesh(bytes){
  const mesh=_cadMesh('ply'),text=new TextDecoder().decode(bytes),end=text.indexOf('end_header');
  if(end<0) return mesh; const header=text.slice(0,end).split(/\r?\n/),body=text.slice(end+'end_header'.length).replace(/^\s*\r?\n/,'').split(/\r?\n/);
  if(!header.some((line)=>/^format\s+ascii\b/i.test(line))){ mesh.warnings.push('Only ASCII PLY geometry is previewed in this browser.'); return mesh; }
  let vertexCount=0,faceCount=0,current=''; const vertexProperties=[];
  for(const line of header){ const element=/^element\s+(\w+)\s+(\d+)/i.exec(line.trim());
    if(element){ current=element[1].toLowerCase(); if(current==='vertex') vertexCount=Number(element[2]); else if(current==='face') faceCount=Number(element[2]); continue; }
    const property=/^property\s+\S+\s+(\w+)/i.exec(line.trim()); if(property&&current==='vertex') vertexProperties.push(property[1].toLowerCase()); }
  const xyz=['x','y','z'].map((name)=>vertexProperties.indexOf(name)); if(xyz.some((index)=>index<0)) return mesh;
  const shownVertices=Math.min(vertexCount,CAD_MESH_LIMITS.vertices);
  for(let index=0;index<shownVertices&&index<body.length;index++){ const values=body[index].trim().split(/\s+/).map(Number),point=xyz.map((at)=>values[at]); if(_finite3(point)) mesh.vertices.push(point); }
  for(let row=0;row<faceCount&&vertexCount+row<body.length;row++){ const values=body[vertexCount+row].trim().split(/\s+/).map(Number),count=values[0],indices=values.slice(1,1+count);
    if(!Number.isSafeInteger(count)||count<3) continue; for(let index=1;index+1<indices.length;index++) _cadTriangle(mesh,indices[0],indices[index],indices[index+1],0); }
  mesh.truncated=shownVertices<vertexCount||mesh.triangles.length>=CAD_MESH_LIMITS.triangles; mesh.groups=['mesh']; return mesh;
}
function _dataUriBytes(uri){
  const match=/^data:([^,]*?),(.*)$/s.exec(String(uri||'')); if(!match) return null;
  try{ if(/;base64(?:;|$)/i.test(match[1])){ const binary=atob(match[2].replace(/\s/g,'')),out=new Uint8Array(binary.length);
      for(let index=0;index<binary.length;index++) out[index]=binary.charCodeAt(index); return out; }
    return new TextEncoder().encode(decodeURIComponent(match[2])); }catch(_){ return null; }
}
const _matIdentity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function _matMultiply(a,b){ const out=new Array(16).fill(0); for(let column=0;column<4;column++) for(let row=0;row<4;row++)
  for(let inner=0;inner<4;inner++) out[column*4+row]+=a[inner*4+row]*b[column*4+inner]; return out; }
function _nodeMatrix(node){
  if(Array.isArray(node?.matrix)&&node.matrix.length===16&&node.matrix.every(Number.isFinite)) return [...node.matrix];
  const t=Array.isArray(node?.translation)&&node.translation.length===3?node.translation:[0,0,0];
  const s=Array.isArray(node?.scale)&&node.scale.length===3?node.scale:[1,1,1];
  const q=Array.isArray(node?.rotation)&&node.rotation.length===4?node.rotation:[0,0,0,1];
  const [x,y,z,w]=q,xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
  return [(1-2*(yy+zz))*s[0],2*(xy+wz)*s[0],2*(xz-wy)*s[0],0,
    2*(xy-wz)*s[1],(1-2*(xx+zz))*s[1],2*(yz+wx)*s[1],0,
    2*(xz+wy)*s[2],2*(yz-wx)*s[2],(1-2*(xx+yy))*s[2],0,
    Number(t[0])||0,Number(t[1])||0,Number(t[2])||0,1];
}
function _matPoint(matrix,point){ const [x,y,z]=point,w=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15]||1;
  return [(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])/w,(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])/w,(matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14])/w]; }
const GLTF_COMPONENTS=Object.freeze({5120:['getInt8',1],5121:['getUint8',1],5122:['getInt16',2],5123:['getUint16',2],5125:['getUint32',4],5126:['getFloat32',4]});
const GLTF_WIDTHS=Object.freeze({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16});
function _gltfAccessor(document,buffers,index){
  const accessor=document?.accessors?.[index],view=document?.bufferViews?.[accessor?.bufferView],info=GLTF_COMPONENTS[accessor?.componentType],width=GLTF_WIDTHS[accessor?.type];
  const bytes=buffers?.[view?.buffer]; if(!accessor||!view||!info||!width||!(bytes instanceof Uint8Array)) return null;
  const [reader,size]=info,stride=Number(view.byteStride)||size*width,start=(Number(view.byteOffset)||0)+(Number(accessor.byteOffset)||0),count=Math.min(Number(accessor.count)||0,CAD_MESH_LIMITS.vertices*3);
  if(!Number.isSafeInteger(count)||count<0||start<0||start+Math.max(0,count-1)*stride+size*width>bytes.byteLength) return null;
  const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=[];
  for(let item=0;item<count;item++){ const row=[]; for(let part=0;part<width;part++) row.push(data[reader](start+item*stride+part*size,true)); out.push(width===1?row[0]:row); }
  return out;
}
function _parseGltfContainer(bytes,format){
  if(format!=='glb'){ try{ const document=JSON.parse(new TextDecoder().decode(bytes)); return {document,bin:null}; }catch(_){ return null; } }
  if(bytes.length<20) return null; const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)>bytes.length) return null;
  let offset=12,document=null,bin=null;
  while(offset+8<=bytes.length){ const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true),start=offset+8,end=start+length; if(end>bytes.length) break;
    const chunk=bytes.subarray(start,end); if(type===0x4e4f534a){ try{ document=JSON.parse(new TextDecoder().decode(chunk).replace(/[\u0000\u0020]+$/g,'')); }catch(_){} }
    else if(type===0x004e4942&&!bin) bin=chunk; offset=end; }
  return document?{document,bin}:null;
}
function parseGltfMesh(bytes,format){
  const mesh=_cadMesh(format),container=_parseGltfContainer(bytes,format); if(!container) return mesh;
  const {document,bin}=container,buffers=(document.buffers||[]).map((buffer,index)=>buffer?.uri?_dataUriBytes(buffer.uri):(index===0?bin:null));
  if(buffers.some((buffer)=>!(buffer instanceof Uint8Array))) mesh.warnings.push('External glTF buffers were not fetched; only self-contained geometry is previewed.');
  const addPrimitive=(primitive,matrix,meshIndex)=>{ if(Number(primitive?.mode??4)!==4){ mesh.warnings.push('A non-triangle glTF primitive was omitted.'); return; }
    const positions=_gltfAccessor(document,buffers,primitive?.attributes?.POSITION); if(!positions) return;
    const remaining=CAD_MESH_LIMITS.vertices-mesh.vertices.length,shown=positions.slice(0,Math.max(0,remaining)),base=mesh.vertices.length;
    shown.forEach((point)=>{ if(_finite3(point)) mesh.vertices.push(_matPoint(matrix,point)); });
    const rawIndices=primitive.indices==null?shown.map((_,index)=>index):_gltfAccessor(document,buffers,primitive.indices);
    const indices=(rawIndices||[]).map(Number); for(let index=0;index+2<indices.length;index+=3){ const a=indices[index],b=indices[index+1],c=indices[index+2];
      if([a,b,c].every((value)=>Number.isSafeInteger(value)&&value>=0&&value<shown.length)) _cadTriangle(mesh,base+a,base+b,base+c,Number(primitive.material??meshIndex) || 0); }
    if(shown.length<positions.length) mesh.truncated=true;
  };
  const visit=(nodeIndex,parent,path=new Set())=>{ if(path.has(nodeIndex)) return; const node=document.nodes?.[nodeIndex]; if(!node) return;
    const nextPath=new Set(path); nextPath.add(nodeIndex);
    const matrix=_matMultiply(parent,_nodeMatrix(node)); if(Number.isSafeInteger(node.mesh)) (document.meshes?.[node.mesh]?.primitives||[]).forEach((primitive)=>addPrimitive(primitive,matrix,node.mesh));
    for(const child of node.children||[]) if(Number.isSafeInteger(child)) visit(child,matrix,nextPath); };
  const scene=document.scenes?.[Number(document.scene)||0],roots=Array.isArray(scene?.nodes)?scene.nodes:[];
  if(roots.length) roots.forEach((node)=>visit(node,_matIdentity()));
  else (document.meshes||[]).forEach((entry,index)=>(entry.primitives||[]).forEach((primitive)=>addPrimitive(primitive,_matIdentity(),index)));
  mesh.groups=(document.materials||[]).map((material,index)=>String(material?.name||`material ${index+1}`)); return mesh;
}
function cadMeshFromBytes(bytes,format){
  try{ if(format==='obj') return parseObjMesh(bytes); if(format==='stl') return parseStlMesh(bytes);
    if(format==='ply') return parseAsciiPlyMesh(bytes); if(format==='gltf'||format==='glb') return parseGltfMesh(bytes,format); }
  catch(error){ const mesh=_cadMesh(format); mesh.warnings.push(`Geometry preview failed safely: ${String(error?.message||error).slice(0,180)}`); return mesh; }
  return null;
}
function cadMeshBounds(mesh){
  if(!mesh?.vertices?.length) return null; const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const point of mesh.vertices) for(let axis=0;axis<3;axis++){ min[axis]=Math.min(min[axis],point[axis]); max[axis]=Math.max(max[axis],point[axis]); }
  return {min,max,size:max.map((value,index)=>value-min[index]),center:max.map((value,index)=>(value+min[index])/2)};
}
const _cadFormatNumber=(value)=>Math.abs(value)>=1000||Math.abs(value)<.01&&value!==0?value.toExponential(2):value.toFixed(2);
function mountCadMeshPreview(host,mesh,title){
  const bounds=cadMeshBounds(mesh); if(!bounds||!mesh.triangles.length) return false;
  const wrap=el('div','fv-3d-view'),controls=el('div','fv-3d-controls'),canvas=el('canvas','fv-3d');
  canvas.width=1200; canvas.height=720; canvas.setAttribute('role','img'); canvas.setAttribute('aria-label',`${title} interactive 3D geometry preview`);
  canvas.tabIndex=0;
  const status=el('div','fv-3d-status'),left=el('span',null,'drag or arrow keys to orbit · wheel or +/− to zoom'),right=el('span'); status.append(left,right);
  let yaw=-.72,pitch=.52,zoom=1,solid=true,edges=true,drag=null;
  const viewButton=(label,apply)=>{ const button=el('button','fv-btn',label); button.type='button'; button.addEventListener('click',()=>{ apply(); draw(); }); controls.appendChild(button); return button; };
  viewButton('Isometric',()=>{yaw=-.72;pitch=.52;zoom=1;}); viewButton('Top',()=>{yaw=0;pitch=Math.PI/2-.001;zoom=1;});
  viewButton('Front',()=>{yaw=0;pitch=0;zoom=1;}); viewButton('Right',()=>{yaw=-Math.PI/2;pitch=0;zoom=1;});
  viewButton('Fit',()=>{zoom=1;});
  const solidButton=viewButton('Surface',()=>{solid=!solid; solidButton.setAttribute('aria-pressed',String(solid));}); solidButton.setAttribute('aria-pressed','true');
  const edgeButton=viewButton('Edges',()=>{edges=!edges; edgeButton.setAttribute('aria-pressed',String(edges));}); edgeButton.setAttribute('aria-pressed','true');
  const ctx=canvas.getContext('2d',{alpha:false}),radius=Math.max(...bounds.size,1e-6)/2;
  const selected=mesh.triangles.filter((_,index)=>index%Math.max(1,Math.ceil(mesh.triangles.length/CAD_MESH_LIMITS.drawTriangles))===0).slice(0,CAD_MESH_LIMITS.drawTriangles);
  const transform=(point)=>{ const x=point[0]-bounds.center[0],y=point[1]-bounds.center[1],z=point[2]-bounds.center[2],cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const rx=cy*x-sy*y,ry=sy*x+cy*y; return {x:rx,y:cp*ry-sp*z,z:sp*ry+cp*z}; };
  const normalize=(point)=>{ const length=Math.hypot(...point)||1; return point.map((value)=>value/length); };
  const keyLight=normalize([-.38,-.72,.58]),fillLight=normalize([.76,-.28,.22]);
  // A CAD preview is evidence, not a decorative render. Keep the canvas and
  // materials achromatic so ambient application colours cannot read as a
  // material, reflection, or shadow that is absent from the source geometry.
  const materialPalette=[[207,208,204],[194,196,192],[214,211,205],[185,188,185]];
  const draw=()=>{ const width=canvas.width,height=canvas.height,scale=Math.min(width,height)*.39*zoom/radius;
    ctx.fillStyle='#eef0ed'; ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='rgba(62,67,64,.09)'; ctx.lineWidth=1; const grid=80;
    for(let x=(width/2)%grid;x<width;x+=grid){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
    for(let y=(height/2)%grid;y<height;y+=grid){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }
    const transformed=mesh.vertices.map(transform);
    const projected=transformed.map((point)=>({x:width/2+point.x*scale,y:height/2-point.z*scale,depth:point.y}));
    const faces=selected.map((triangle)=>{ const a3=transformed[triangle.a],b3=transformed[triangle.b],c3=transformed[triangle.c];
      const ux=b3.x-a3.x,uy=b3.y-a3.y,uz=b3.z-a3.z,vx=c3.x-a3.x,vy=c3.y-a3.y,vz=c3.z-a3.z;
      const normal=normalize([uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx]);
      const a=projected[triangle.a],b=projected[triangle.b],c=projected[triangle.c];
      const key=Math.abs(normal[0]*keyLight[0]+normal[1]*keyLight[1]+normal[2]*keyLight[2]);
      const fill=Math.abs(normal[0]*fillLight[0]+normal[1]*fillLight[1]+normal[2]*fillLight[2]);
      return {triangle,a,b,c,light:Math.min(1,.42+key*.43+fill*.15),depth:(a.depth+b.depth+c.depth)/3};
    // The camera looks from negative view-Y toward positive view-Y. Paint the
    // far faces first; reversing this order makes rear faces bleed over the
    // visible surface and looks like a coloured/offset shadow on dense STL.
    }).sort((a,b)=>b.depth-a.depth);
    ctx.lineJoin='round'; for(const face of faces){ const base=materialPalette[Math.abs(Number(face.triangle.group)||0)%materialPalette.length];
      ctx.beginPath(); ctx.moveTo(face.a.x,face.a.y); ctx.lineTo(face.b.x,face.b.y); ctx.lineTo(face.c.x,face.c.y); ctx.closePath();
      if(solid){ const shade=face.light; ctx.fillStyle=`rgb(${Math.round(base[0]*shade)} ${Math.round(base[1]*shade)} ${Math.round(base[2]*shade)})`; ctx.fill(); }
      if(edges||!solid){ ctx.strokeStyle=solid?'rgba(45,49,47,.42)':'rgba(47,52,49,.9)'; ctx.lineWidth=solid?.72:1.05; ctx.stroke(); } }
    // A fixed-size orientation triad stays out of the model and does not imply
    // that the source contains axes or coloured material.
    const origin={x:58,y:height-52},axisLength=34;
    const axes=[[[1,0,0],'X','#c8464d'],[[0,1,0],'Y','#3f8b58'],[[0,0,1],'Z','#a77518']];
    for(const [vector,label,colour] of axes){ const direction=transform(vector.map((value,index)=>value+bounds.center[index]));
      const center=transform(bounds.center),dx=direction.x-center.x,dz=direction.z-center.z,length=Math.hypot(dx,dz)||1;
      const end={x:origin.x+(dx/length)*axisLength,y:origin.y-(dz/length)*axisLength};
      ctx.strokeStyle=colour; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(origin.x,origin.y); ctx.lineTo(end.x,end.y); ctx.stroke();
      ctx.fillStyle=colour; ctx.font='700 16px ui-monospace, monospace'; ctx.fillText(label,end.x+4,end.y-3); }
    const dimensions=bounds.size.map(_cadFormatNumber).join(' × ');
    right.textContent=`${selected.length.toLocaleString()} of ${mesh.triangles.length.toLocaleString()} triangles · ${dimensions} · orthographic`;
  };
  canvas.addEventListener('pointerdown',(event)=>{ drag={x:event.clientX,y:event.clientY,yaw,pitch}; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove',(event)=>{ if(!drag) return; yaw=drag.yaw+(event.clientX-drag.x)*.008; pitch=Math.max(-1.54,Math.min(1.54,drag.pitch+(event.clientY-drag.y)*.008)); draw(); });
  const end=()=>{drag=null;}; canvas.addEventListener('pointerup',end); canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('wheel',(event)=>{ event.preventDefault(); zoom=Math.max(.25,Math.min(6,zoom*Math.exp(-event.deltaY*.001))); draw(); },{passive:false});
  canvas.addEventListener('keydown',(event)=>{ let handled=true;
    if(event.key==='ArrowLeft') yaw-=.10; else if(event.key==='ArrowRight') yaw+=.10;
    else if(event.key==='ArrowUp') pitch=Math.max(-1.54,pitch-.10); else if(event.key==='ArrowDown') pitch=Math.min(1.54,pitch+.10);
    else if(event.key==='+'||event.key==='=') zoom=Math.min(6,zoom*1.12);
    else if(event.key==='-'||event.key==='_') zoom=Math.max(.25,zoom/1.12);
    else if(event.key==='0'){ yaw=-.72; pitch=.52; zoom=1; } else handled=false;
    if(handled){ event.preventDefault(); draw(); }
  });
  wrap.append(controls,canvas,status); host.appendChild(wrap); draw(); return true;
}
function zipDirectoryEntries(bytes,limit=200){
  if(bytes.length<22) return [];
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const floor=Math.max(0,bytes.length-65557); let end=-1;
  for(let offset=bytes.length-22;offset>=floor;offset--){
    if(view.getUint32(offset,true)===0x06054b50){ end=offset; break; }
  }
  if(end<0||end+22>bytes.length) return [];
  const total=Math.min(view.getUint16(end+10,true),limit), central=view.getUint32(end+16,true);
  if(central>=bytes.length) return [];
  const decoder=new TextDecoder('utf-8'), entries=[]; let offset=central;
  for(let index=0;index<total&&offset+46<=bytes.length;index++){
    if(view.getUint32(offset,true)!==0x02014b50) break;
    const compressed=view.getUint32(offset+20,true), size=view.getUint32(offset+24,true);
    const nameLength=view.getUint16(offset+28,true), extraLength=view.getUint16(offset+30,true);
    const commentLength=view.getUint16(offset+32,true), next=offset+46+nameLength+extraLength+commentLength;
    if(offset+46+nameLength>bytes.length||next>bytes.length) break;
    const name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLength))
      .replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,300);
    if(name) entries.push({name,size,compressed,directory:name.endsWith('/')});
    offset=next;
  }
  return entries;
}
const MAX_ARCHIVE_INSPECTION_BYTES=32*1024*1024;
function tarText(bytes,start,length){
  return new TextDecoder('utf-8').decode(bytes.subarray(start,start+length))
    .replace(/\0.*$/s,'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
}
function tarOctal(bytes,start,length){
  const value=tarText(bytes,start,length).replace(/^0+/,'')||'0';
  return /^[0-7]+$/.test(value)?Number.parseInt(value,8):Number.NaN;
}
function tarHeaderChecksum(bytes,offset){
  let sum=0; for(let index=0;index<512;index++)
    sum+=(index>=148&&index<156)?32:bytes[offset+index];
  return sum;
}
function tarDirectoryEntries(bytes,limit=200){
  const entries=[]; let offset=0,zeroBlocks=0;
  while(offset+512<=bytes.length&&entries.length<limit){
    const header=bytes.subarray(offset,offset+512);
    if(header.every((value)=>value===0)){ zeroBlocks++; offset+=512; if(zeroBlocks>=2) break; continue; }
    zeroBlocks=0;
    const expected=tarOctal(bytes,offset+148,8),observed=tarHeaderChecksum(bytes,offset);
    if(!Number.isFinite(expected)||expected!==observed) break;
    const name=tarText(bytes,offset,100),prefix=tarText(bytes,offset+345,155);
    const fullName=(prefix?`${prefix}/${name}`:name).slice(0,300);
    const size=tarOctal(bytes,offset+124,12),type=String.fromCharCode(bytes[offset+156]||48);
    if(!fullName||!Number.isSafeInteger(size)||size<0) break;
    entries.push({name:fullName,size,directory:type==='5'||fullName.endsWith('/')});
    const padded=Math.ceil(size/512)*512;
    if(!Number.isSafeInteger(padded)||offset+512+padded<offset) break;
    offset+=512+padded;
  }
  return entries;
}
async function gunzipBounded(bytes,limit=MAX_ARCHIVE_INSPECTION_BYTES,{signal=null}={}){
  if(typeof DecompressionStream!=='function') return null;
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const abort=()=>{ reader.cancel().catch(()=>{}); };
  signal?.addEventListener('abort',abort,{once:true});
  const chunks=[]; let total=0;
  try{
    while(true){
      if(signal?.aborted) throw new DOMException('Artifact view cancelled','AbortError');
      const {done,value}=await reader.read(); if(done) break;
      const chunk=value instanceof Uint8Array?value:new Uint8Array(value||0);
      total+=chunk.byteLength;
      if(total>limit){ await reader.cancel(); throw new Error('expanded archive exceeds the safe preview limit'); }
      chunks.push(chunk);
    }
  }finally{ signal?.removeEventListener('abort',abort); try{ reader.releaseLock(); }catch(_){} }
  const output=new Uint8Array(total); let offset=0;
  for(const chunk of chunks){ output.set(chunk,offset); offset+=chunk.byteLength; }
  return output;
}
let TECHNICAL_RENDERERS_JOB=null;
function technicalRendererRuntime(){
  return {artifactBytes,artifactTypeLabel,cadFormat,cadMeshBounds,cadMeshFromBytes,
    dxfGeometry,dxfLayerColour,el,fmtBytes,gunzipBounded,inspectCadBytes,
    maxArchiveInspectionBytes:MAX_ARCHIVE_INSPECTION_BYTES,mountCadMeshPreview,
    parseDxfEntities,plainPre,svgEl,tarDirectoryEntries,zipDirectoryEntries,
    cadFormatNumber:_cadFormatNumber};
}
async function loadTechnicalRenderers(ctx){
  ctx?.reportProgress?.('loading technical format renderer…');
  if(!TECHNICAL_RENDERERS_JOB){
    const request=import('./artifact-technical-renderers.mjs?v=20260808-async-artifacts-v1')
      .then((module)=>module.createTechnicalRenderers(technicalRendererRuntime()));
    TECHNICAL_RENDERERS_JOB=request.catch((error)=>{
      if(TECHNICAL_RENDERERS_JOB) TECHNICAL_RENDERERS_JOB=null; throw error;
    });
  }
  const renderers=await TECHNICAL_RENDERERS_JOB;
  ctx?.assertCurrent?.(); return renderers;
}
function lazyTechnicalRenderer(name){
  return async(host,ctx)=>{
    ctx?.assertCurrent?.(); const renderers=await loadTechnicalRenderers(ctx);
    ctx?.assertCurrent?.(); return renderers[name](host,ctx);
  };
}
const renderDxf=lazyTechnicalRenderer('renderDxf');
const renderCad3d=lazyTechnicalRenderer('renderCad3d');
const renderArchive=lazyTechnicalRenderer('renderArchive');

// ---- JSON tree view --------------------------------------------------------
// Structured artifacts render as a real collapsible tree (typed leaves, entry
// counts, bounded node budget) instead of a flattened row projection. Pure
// DOM construction; every string passes through textContent.
function _jsonLeafNode(value){
  const span=document.createElement('span');
  if(value===null){ span.className='fv-json-null'; span.textContent='null'; }
  else if(typeof value==='boolean'){ span.className='fv-json-bool'; span.textContent=String(value); }
  else if(typeof value==='number'){ span.className='fv-json-num'; span.textContent=String(value); }
  else{ const text=String(value); span.className='fv-json-str';
    span.textContent=text.length>400?`"${text.slice(0,400)}…"`:`"${text}"`;
    if(text.length>400) span.title=`${text.length} characters — open the raw source below for the full value`; }
  return span;
}
function _jsonBranchNode(key,value,depth,budget){
  const isArray=Array.isArray(value);
  const entries=isArray?value.map((item,index)=>[String(index),item]):Object.entries(value);
  const details=document.createElement('details');
  details.className='fv-json-node';
  if(depth<2&&entries.length<=64) details.open=true;
  const summary=document.createElement('summary');
  const name=document.createElement('span'); name.className='fv-json-key';
  name.textContent=key===undefined?(isArray?'[…]':'{…}'):key; summary.appendChild(name);
  const meta=document.createElement('span'); meta.className='fv-json-meta';
  meta.textContent=isArray?`[ ${entries.length} item${entries.length===1?'':'s'} ]`
    :`{ ${entries.length} ${entries.length===1?'key':'keys'} }`;
  summary.appendChild(meta); details.appendChild(summary);
  const body=document.createElement('div'); body.className='fv-json-children';
  let shown=0;
  for(const [entryKey,entryValue] of entries){
    if(budget.nodes>=budget.max||shown>=512){ const more=document.createElement('div');
      more.className='fv-json-more'; more.textContent=`… ${entries.length-shown} more entr${entries.length-shown===1?'y':'ies'} — open the raw source below`;
      body.appendChild(more); break; }
    budget.nodes++; shown++;
    if(entryValue&&typeof entryValue==='object'){
      body.appendChild(_jsonBranchNode(entryKey,entryValue,depth+1,budget));
    }else{
      const row=document.createElement('div'); row.className='fv-json-row';
      const keySpan=document.createElement('span'); keySpan.className='fv-json-key';
      keySpan.textContent=entryKey; row.appendChild(keySpan);
      row.appendChild(_jsonLeafNode(entryValue)); body.appendChild(row);
    }
  }
  details.appendChild(body);
  return details;
}
function jsonTreeView(text,{label='Verified JSON artifact'}={}){
  let value; try{ value=JSON.parse(text); }catch(_){ return null; }
  const wrap=el('div','fv-json-tree');
  const head=el('div','fv-json-head'); head.textContent=label; wrap.appendChild(head);
  if(value&&typeof value==='object') wrap.appendChild(_jsonBranchNode(undefined,value,0,{nodes:0,max:5000}));
  else{ const row=el('div','fv-json-row'); row.appendChild(_jsonLeafNode(value)); wrap.appendChild(row); }
  const source=document.createElement('details'); source.className='fv-source';
  const summary=document.createElement('summary'); summary.textContent='Exact raw JSON source';
  source.appendChild(summary); source.appendChild(plainPre(text.slice(0,400*1024),text.length>400*1024?'first 400 KB':''));
  wrap.appendChild(source);
  return wrap;
}
// ---- SPICE netlist renderer ------------------------------------------------
// A .cir/.sp netlist gets a structural reading — components with their nodes,
// parameters, models, analyses and measurements — plus the colorized source.
// Inspection only; nothing is simulated or executed.
const SPICE_COMPONENT_KINDS=Object.freeze({R:'Resistor',C:'Capacitor',L:'Inductor',
  V:'Voltage source',I:'Current source',D:'Diode',Q:'BJT',M:'MOSFET',J:'JFET',
  S:'Voltage-controlled switch',W:'Current-controlled switch',X:'Subcircuit call',
  K:'Coupled inductors',E:'VCVS',F:'CCCS',G:'VCCS',H:'CCVS',T:'Transmission line'});
function _parseSpice(text){
  const rawLines=String(text||'').split(/\r?\n/).slice(0,4000);
  const logical=[];
  for(const line of rawLines){
    if(/^\s*\+/.test(line)&&logical.length) logical[logical.length-1].text+=' '+line.replace(/^\s*\+/,'').trim();
    else logical.push({text:line});
  }
  const out={title:'',components:[],params:[],models:[],analyses:[],measures:[],comments:0,control:[],other:[]};
  let inControl=false;
  logical.forEach((entry,index)=>{
    const line=entry.text.trim();
    if(!line) return;
    if(index===0&&!/^[.*]/.test(line)&&!/^[A-Za-z]\S*\s+\S+\s+\S+/.test(line)){ out.title=line; return; }
    if(line.startsWith('*')){ out.comments++; if(index===0) out.title=line.replace(/^\*+\s?/,''); return; }
    if(line.startsWith('.')){
      const word=line.split(/\s+/,1)[0].toLowerCase();
      if(word==='.control'){ inControl=true; out.analyses.push(line); return; }
      if(word==='.endc'){ inControl=false; return; }
      if(word==='.param') out.params.push(line.slice(6).trim());
      else if(word==='.model'){ const m=line.match(/^\.model\s+(\S+)\s+(\S+)\s*(.*)$/i);
        out.models.push(m?{name:m[1],kind:m[2],args:m[3]}:{name:line,kind:'',args:''}); }
      else if(word==='.meas'||word==='.measure') out.measures.push(line.replace(/^\.\w+\s+/,''));
      else if(['.tran','.ac','.dc','.op','.noise','.tf','.four'].includes(word)) out.analyses.push(line);
      else out.other.push(line);
      return;
    }
    // Between .control and .endc every line is an interactive-interpreter
    // command (run, wrdata, print, plot…), never a circuit element.
    if(inControl){ out.control.push(line); return; }
    const match=line.match(/^([A-Za-z])(\S*)\s+(.*)$/);
    if(match){ const kind=match[1].toUpperCase();
      const tokens=match[3].split(/\s+/);
      out.components.push({name:match[1]+match[2],kind:SPICE_COMPONENT_KINDS[kind]||`Element ${kind}`,
        nodes:tokens.slice(0,kind==='Q'||kind==='M'?4:2).join(' → '),value:tokens.slice(kind==='Q'||kind==='M'?4:2).join(' ')}); }
    else out.other.push(line);
  });
  return out;
}
function _spiceSourcePre(text){
  const pre=el('pre','filview fv-code fv-spice');
  for(const line of String(text||'').split(/\r?\n/).slice(0,4000)){
    const span=document.createElement('span');
    const trimmed=line.trim();
    span.className=trimmed.startsWith('*')?'sp-cmt'
      :trimmed.startsWith('.')?'sp-dir'
      :trimmed.startsWith('+')?'sp-cont'
      :/^[A-Za-z]/.test(trimmed)?'sp-comp':'sp-plain';
    span.textContent=line+'\n';
    pre.appendChild(span);
  }
  return pre;
}
async function renderSpice(host,ctx){
  const text=String(ctx.text??new TextDecoder().decode(await artifactBytes(ctx)));
  ctx.assertCurrent?.(); host.innerHTML='';
  const parsed=_parseSpice(text);
  const card=el('div','fv-card');
  card.appendChild(el('div','fv-cardhd','SPICE netlist · structural reading · nothing was simulated'));
  const add=(label,value)=>{ const row=el('div','row'); row.appendChild(el('span','l2',label));
    row.appendChild(el('span','v2',value)); card.appendChild(row); };
  if(parsed.title) add('Title',parsed.title);
  add('Components',String(parsed.components.length));
  if(parsed.models.length) add('Models',parsed.models.map((model)=>`${model.name} (${model.kind})`).join(' · '));
  if(parsed.analyses.length) add('Analyses',parsed.analyses.join(' · ').slice(0,400));
  if(parsed.measures.length) add('Measurements',String(parsed.measures.length));
  host.appendChild(card);
  if(parsed.components.length){
    const grid=el('div','fv-spice-grid');
    grid.appendChild(el('div','fv-spice-hd','Component'));
    grid.appendChild(el('div','fv-spice-hd','Kind'));
    grid.appendChild(el('div','fv-spice-hd','Nodes'));
    grid.appendChild(el('div','fv-spice-hd','Value / args'));
    for(const component of parsed.components.slice(0,80)){
      grid.appendChild(el('b',null,component.name));
      grid.appendChild(el('span',null,component.kind));
      grid.appendChild(el('span','fv-spice-nodes',component.nodes));
      grid.appendChild(el('span','fv-spice-val',component.value||'—'));
    }
    host.appendChild(grid);
    if(parsed.components.length>80) host.appendChild(el('div','fv-note',`${parsed.components.length-80} more components in the source below`));
  }
  if(parsed.params.length){
    const params=el('div','fv-card');
    params.appendChild(el('div','fv-cardhd','Parameters'));
    for(const param of parsed.params.slice(0,40)){ const row=el('div','row');
      row.appendChild(el('span','v2 fv-spice-param',param)); params.appendChild(row); }
    host.appendChild(params);
  }
  if(parsed.measures.length){
    const measures=el('div','fv-card');
    measures.appendChild(el('div','fv-cardhd','Measurements the netlist requests'));
    for(const measure of parsed.measures.slice(0,40)){ const row=el('div','row');
      row.appendChild(el('span','v2 fv-spice-param',measure)); measures.appendChild(row); }
    host.appendChild(measures);
  }
  if(parsed.control.length){
    const control=el('div','fv-card');
    control.appendChild(el('div','fv-cardhd','Control-block commands (not simulated here)'));
    for(const command of parsed.control.slice(0,24)){ const row=el('div','row');
      row.appendChild(el('span','v2 fv-spice-param',command)); control.appendChild(row); }
    host.appendChild(control);
  }
  host.appendChild(el('div','fv-note','Colorized source · comments, directives and elements'));
  host.appendChild(_spiceSourcePre(text));
}
async function renderGeneric(host,ctx){
  const bytes=await artifactBytes(ctx); host.innerHTML='';
  const integrity=ctx.integrityVerified?'hash-checked':'unhashed';
  if(bytesLookTextual(bytes)){
    const text=new TextDecoder().decode(bytes), truncated=text.length>400*1024;
    if(/^[{[]/.test(text.trim())){ const tree=jsonTreeView(text,{label:'Verified JSON artifact · collapsible tree'});
      if(tree){ host.appendChild(tree); return; } }
    host.appendChild(plainPre(text.slice(0,400*1024),truncated?`first 400 KB · ${integrity} generic text`:`generic ${integrity} text`));
    return;
  }
  const card=el('div','fv-card'); card.appendChild(el('div','fv-cardhd',`${ctx.kind||'undeclared media'} · ${integrity} binary artifact`));
  const add=(label,value)=>{ const row=el('div','row'); row.appendChild(el('span','l2',label)); row.appendChild(el('span','v2',value)); card.appendChild(row); };
  add('Size',fmtBytes(bytes.length)); add('SHA-256',ctx.contentHash||(ctx.integrityVerified?'checked':'not advertised'));
  add('Rendering','safe generic inspector · executable content was not run'); host.appendChild(card);
  host.appendChild(el('div','fv-note',`hex preview · first ${Math.min(512,bytes.length)} bytes`));
  const pre=el('pre','filview fv-code fv-hex'); pre.textContent=hexPreview(bytes); host.appendChild(pre);
}
async function renderCode(host,ctx){
  let body=ctx.text||'';
  const media=String(ctx.kind||'').toLowerCase().split(';',1)[0].trim();
  const isJson=media==='application/json'||media.endsWith('+json');
  if(isJson){
    if((ctx.realSize??body.length)>200*1024){ host.appendChild(plainPre(body,'json > 200 KB — plain text (perf)')); return; }
    const tree=jsonTreeView(body,{label:'Verified JSON artifact · collapsible tree'});
    if(tree){ host.appendChild(tree); return; }
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
function openScadSourceOverview(source){
  const lines=String(source||'').split(/\r?\n/),modules=[],functions=[],dependencies=[],parameters=[];
  for(const rawLine of lines.slice(0,20000)){
    const line=rawLine.replace(/\/\/.*$/,'').trim(); if(!line) continue;
    const module=/^module\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/.exec(line);
    const fn=/^function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/.exec(line);
    const dependency=/^(?:include|use)\s*<([^>]+)>/.exec(line);
    const parameter=/^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^;]{1,240});/.exec(line);
    if(module&&modules.length<40) modules.push({name:module[1],signature:module[2].trim()});
    else if(fn&&functions.length<40) functions.push({name:fn[1],signature:fn[2].trim()});
    else if(dependency&&dependencies.length<40) dependencies.push(dependency[1].slice(0,300));
    else if(parameter&&parameters.length<48) parameters.push({name:parameter[1],value:parameter[2].trim()});
  }
  return {lineCount:lines.length,modules,functions,dependencies,parameters,
    bounded:lines.length>20000};
}
function openScadCompanionFiles(ctx){
  const live=ctx.liveFile,run=String(live?.run||''),path=String(live?.path||ctx.title||'');
  if(!path) return [];
  const slash=path.lastIndexOf('/'),folder=slash>=0?path.slice(0,slash+1):'',leaf=slash>=0?path.slice(slash+1):path;
  const dot=leaf.lastIndexOf('.'),stem=(dot>0?leaf.slice(0,dot):leaf).normalize('NFC');
  const accepted=new Set(['stl','obj','ply','gltf','glb']);
  const matches=(candidatePath)=>{
    const candidate=String(candidatePath||''),candidateSlash=candidate.lastIndexOf('/');
    const candidateFolder=candidateSlash>=0?candidate.slice(0,candidateSlash+1):'';
    const candidateLeaf=candidateSlash>=0?candidate.slice(candidateSlash+1):candidate;
    const candidateDot=candidateLeaf.lastIndexOf('.');
    if(candidateDot<=0||candidateFolder!==folder) return false;
    return candidateLeaf.slice(0,candidateDot).normalize('NFC')===stem
      &&accepted.has(candidateLeaf.slice(candidateDot+1).toLowerCase());
  };
  const companions=[];
  if(run){
    const state=liveArtifactState(ctx.base,run),files=state?.files;
    if(files instanceof Map) for(const file of files.values()) if(matches(file?.path)) companions.push({
      ...file,transport:'live',run,base:String(ctx.base||''),workspace_id:String(file.workspace_id||live?.workspace_id||''),
    });
  }
  for(const file of Array.isArray(ctx.companionFiles)?ctx.companionFiles:[])
    if(matches(file?.path)) companions.push({...file,transport:'file'});
  const unique=new Map();
  for(const file of companions){
    const key=`${file.transport||''}\u0000${String(file.path||'')}\u0000${String(file.sha256||file.contentHash||'')}`;
    if(!unique.has(key)) unique.set(key,file);
  }
  return [...unique.values()].slice(0,8);
}
async function renderOpenScadCompanion(host,ctx,file){
  host.innerHTML=''; host.appendChild(loadingNode('verifying published geometry…'));
  const advertised=String(file.sha256||file.contentHash||'').replace(/^sha256:/i,'').toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(advertised)){
    host.innerHTML=''; host.appendChild(el('div','fv-warn','Inline geometry stayed closed because the companion file has no valid advertised SHA-256.'));
    return;
  }
  const bodyPath=String(file.body_url||file.bodyPath||'');
  const verified=bodyPath?await fetchVerifiedLiveBody(join(ctx.base,bodyPath),advertised):null;
  if(!verified?.ok){
    host.innerHTML=''; host.appendChild(el('div','fv-warn',`Inline geometry stayed closed because its bytes could not be verified${verified?.error?`: ${verified.error}`:'.'}`));
    return;
  }
  const title=String(file.path||'published geometry');
  const declared=String(file.mediaKind||declaredArtifactMedia(file)||'');
  const detected=sniffArtifactMediaType(verified.bytes);
  const selected=pickRenderer(declared,title,verified.type,detected);
  if(selected.id!=='cad3d'){
    host.innerHTML=''; host.appendChild(el('div','fv-warn','The verified companion is not a directly renderable 3D mesh.'));
    return;
  }
  await renderCad3d(host,{base:ctx.base,title,kind:selected.mediaType||declared,
    declaredMedia:declared,responseMedia:verified.type,detectedMedia:detected,
    verifiedBytes:verified.bytes,realSize:verified.size,contentHash:`sha256:${advertised}`,
    integrityVerified:true,liveFile:file.transport==='live'?file:null});
}
async function renderOpenScad(host,ctx){
  const source=String(ctx.text||''),overview=openScadSourceOverview(source),companions=openScadCompanionFiles(ctx);
  host.innerHTML='';
  const card=el('div','fv-card fv-scad-card');
  card.appendChild(el('div','fv-cardhd','OpenSCAD · verified parametric source'));
  const add=(label,value)=>{ const row=el('div','row'); row.appendChild(el('span','l2',label)); row.appendChild(el('span','v2',value)); card.appendChild(row); };
  add('Source lines',`${overview.lineCount.toLocaleString()}${overview.bounded?' · first 20,000 indexed':''}`);
  add('Declared modules',overview.modules.length); add('Declared functions',overview.functions.length);
  add('External source references',overview.dependencies.length||'none declared');
  card.appendChild(el('div','fv-note','The browser presents the hash-checked source without executing it. A separately published mesh remains the inspectable geometry result; the source stays the editable parametric authority.'));
  host.appendChild(card);
  if(companions.length){
    const section=el('section','fv-scad-companions'); section.appendChild(el('div','fv-cardhd','Published geometry from the same source name'));
    const inlineHost=el('div','fv-scad-inline');
    for(const file of companions){
      const row=el('div','fv-scad-companion'),copy=el('span','fv-scad-companion-copy');
      const presentation=_artifactFilePresentation(file.path);
      copy.appendChild(el('strong',null,presentation.filename));
      copy.appendChild(el('small',null,`${artifactTypeLabel(file.mediaKind||declaredArtifactMedia(file)||file.path)} · ${fmtBytes(file.size_bytes??file.size)}`));
      const actions=el('span','fv-scad-companion-actions');
      const preview=el('button','fv-btn','Preview here'); preview.type='button';
      preview.addEventListener('click',async()=>{
        for(const candidate of actions.closest('.fv-scad-companions').querySelectorAll('.fv-scad-companion-actions button')) candidate.disabled=true;
        try{ await renderOpenScadCompanion(inlineHost,ctx,file); }
        catch(error){ inlineHost.innerHTML='';
          inlineHost.appendChild(el('div','fv-warn',`The companion preview could not open: ${String(error?.message||error).slice(0,180)}`)); }
        finally{ for(const candidate of actions.closest('.fv-scad-companions').querySelectorAll('.fv-scad-companion-actions button')) candidate.disabled=false; }
      });
      const button=el('button','fv-btn','Open file'); button.type='button';
      if(file.transport==='live'){
        button.dataset.act='live-file'; button.dataset.run=String(file.run||ctx.liveFile?.run||'');
        button.dataset.workspace=String(file.workspace_id||ctx.liveFile?.workspace_id||'');
        button.dataset.path=String(file.path||'');
      }else{
        button.dataset.act='file'; button.dataset.path=String(file.bodyPath||'');
        button.dataset.title=String(file.path||''); button.dataset.kind=String(file.mediaKind||'');
        button.dataset.hash=String(file.contentHash||file.sha256||'');
        button.dataset.size=String(file.size_bytes??file.size??'');
        button.dataset.semantics=JSON.stringify(Array.isArray(file.authoredLabels)?file.authoredLabels:[]);
        button.dataset.declaration=artifactDeclarationAttr(file.declaration||{});
      }
      actions.append(preview,button); row.append(copy,actions); section.appendChild(row);
    }
    section.appendChild(inlineHost);
    host.appendChild(section);
  }
  const declarations=[
    ...overview.parameters.map((item)=>({kind:'parameter',...item})),
    ...overview.modules.map((item)=>({kind:'module',value:item.signature,...item})),
    ...overview.functions.map((item)=>({kind:'function',value:item.signature,...item})),
  ];
  if(declarations.length||overview.dependencies.length){
    const details=document.createElement('details'); details.className='fv-source fv-scad-index'; details.open=true;
    const summary=document.createElement('summary'); summary.textContent='Source structure'; details.appendChild(summary);
    const grid=el('div','fv-scad-grid');
    for(const item of declarations.slice(0,64)){
      const row=el('span'); row.appendChild(el('small',null,item.kind)); row.appendChild(el('b',null,item.name));
      if(item.value) row.appendChild(el('code',null,item.value)); grid.appendChild(row);
    }
    for(const dependency of overview.dependencies){ const row=el('span'); row.appendChild(el('small',null,'source reference'));
      row.appendChild(el('b',null,dependency)); grid.appendChild(row); }
    details.appendChild(grid); host.appendChild(details);
  }
  const pre=el('pre','filview fv-code fv-scad-source'),code=document.createElement('code');
  code.textContent=source; pre.appendChild(code); host.appendChild(pre);
}
async function renderPdf(host,ctx){
  const bytes=await artifactBytes(ctx,'PDF');
  if(new TextDecoder('latin1').decode(bytes.subarray(0,5))!=='%PDF-') throw new Error('invalid PDF header');
  const url=mkBlobURL(new Blob([bytes],{type:'application/pdf'}),ctx);
  host.innerHTML='';
  const obj=document.createElement('iframe'); obj.className='fv-pdf'; obj.src=url; obj.title=ctx.title;
  obj.setAttribute('sandbox',''); obj.referrerPolicy='no-referrer';
  host.appendChild(obj);
}
async function renderPlain(host,ctx){
  let body=ctx.text;
  if(body==null){ // forced-plain view of a binary kind → best-effort text decode
    host.appendChild(loadingNode('loading…')); body=await fetchText(ctx.url,{signal:ctx.signal});
    ctx.assertCurrent?.(); host.innerHTML='';
    if(body==null){ host.appendChild(el('div','l2','binary body — use the download link above.')); return; } }
  const trunc=body.length>20000, shown=body.slice(0,20000);
  // The explicit "plain text view" toggle (forcedPlain) is the raw-source
  // affordance for markdown/code: keep it byte-exact and non-interactive. The
  // natural text/plain view instead linkifies bare http/https URLs so a plain
  // job listing's apply links are clickable, showing every other char verbatim.
  if(ctx.forcedPlain){ host.appendChild(plainPre(shown,trunc?'first 20 KB':'')); return; }
  if(trunc) host.appendChild(el('div','fv-note','first 20 KB'));
  host.appendChild(renderPlainTextWithLinks(shown,document));
}
// GeoJSON: a real 2-D preview instead of the code view. Planar fit-to-viewbox
// projection (persona-authored plans use planar feet/metres, not lon/lat);
// Polygon/MultiPolygon rings are drawn, other geometry kinds are counted.
const GEOJSON_LIMITS=Object.freeze({maxFeatures:500,maxRingPoints:4096,maxTotalPoints:120000});
const GEOJSON_COLOURS=Object.freeze(['#19c39a','#3aa0ff','#a779e6','#f0a73a','#ff5fa2','#56b5ff']);
function _geojsonRings(geometry){
  const type=String(geometry?.type||'');
  const polygons=type==='Polygon'&&Array.isArray(geometry.coordinates)?[geometry.coordinates]
    :type==='MultiPolygon'&&Array.isArray(geometry.coordinates)?geometry.coordinates:[];
  const rings=[];
  for(const polygon of polygons){ if(!Array.isArray(polygon)) continue;
    for(const ring of polygon){ if(!Array.isArray(ring)||ring.length<3) continue;
      const points=[];
      for(const position of ring.slice(0,GEOJSON_LIMITS.maxRingPoints)){
        const x=Number(position?.[0]),y=Number(position?.[1]);
        if(Number.isFinite(x)&&Number.isFinite(y)) points.push({x,y});
      }
      if(points.length>=3) rings.push(points);
    }
  }
  return rings;
}
async function renderGeojson(host,ctx){
  ctx.assertCurrent?.();
  let doc; try{ doc=JSON.parse(String(ctx.text||'')); }
  catch(_error){ throw new Error('GeoJSON body is not valid JSON'); }
  const features=doc?.type==='FeatureCollection'&&Array.isArray(doc.features)?doc.features
    :doc?.type==='Feature'?[doc]
    :doc?.type&&doc.coordinates?[{type:'Feature',geometry:doc,properties:{}}]:null;
  if(!features) throw new Error('no FeatureCollection, Feature, or geometry found');
  const shown=features.slice(0,GEOJSON_LIMITS.maxFeatures);
  const drawn=[]; let skippedKinds=0,totalPoints=0;
  for(let index=0;index<shown.length;index++){
    const feature=shown[index]; if(!feature||typeof feature!=='object') continue;
    const geometry=feature.geometry&&typeof feature.geometry==='object'?feature.geometry:feature;
    const rings=_geojsonRings(geometry);
    if(!rings.length){ if(geometry?.type) skippedKinds++; continue; }
    const kept=[];
    for(const ring of rings){
      if(totalPoints+ring.length>GEOJSON_LIMITS.maxTotalPoints) break;
      totalPoints+=ring.length; kept.push(ring);
    }
    if(!kept.length) break;
    const properties=feature.properties&&typeof feature.properties==='object'?feature.properties:{};
    const name=String(properties.name??'').trim();
    const areaSf=properties.area_sf;
    const label=name||(areaSf!==undefined&&areaSf!==null&&areaSf!==''?`${areaSf} sf`:'');
    drawn.push({rings:kept,label:label.slice(0,60),index});
  }
  ctx.assertCurrent?.(); host.innerHTML='';
  const card=el('div','fv-card');
  card.appendChild(el('div','fv-cardhd','GeoJSON · 2-D preview'));
  const add=(label,value)=>{ const row=el('div','row'); row.appendChild(el('span','l2',label));
    row.appendChild(el('span','v2',value)); card.appendChild(row); };
  add('Features',String(features.length)+(features.length>shown.length?` · first ${shown.length} shown`:''));
  add('Polygons drawn',String(drawn.length)||'0');
  if(skippedKinds) add('Other geometry',`${skippedKinds} feature${skippedKinds===1?'':'s'} without Polygon/MultiPolygon geometry (not drawn)`);
  if(!drawn.length){
    card.appendChild(el('div','fv-note','No Polygon or MultiPolygon geometry was found; showing the bounded source instead.'));
    host.appendChild(card);
    host.appendChild(plainPre(String(ctx.text||'').slice(0,64*1024),'first 64 KB'));
    return;
  }
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const feature of drawn) for(const ring of feature.rings) for(const point of ring){
    minX=Math.min(minX,point.x); maxX=Math.max(maxX,point.x);
    minY=Math.min(minY,point.y); maxY=Math.max(maxY,point.y);
  }
  if(maxX===minX){ minX-=1; maxX+=1; } if(maxY===minY){ minY-=1; maxY+=1; }
  add('Bounds',`${_cadFormatNumber(maxX-minX)} × ${_cadFormatNumber(maxY-minY)} (planar units from the file)`);
  card.appendChild(el('div','fv-note','The browser drew Polygon/MultiPolygon rings from the fetched GeoJSON on a planar fit-to-view projection (no geodesy). The download remains the authoritative source.'));
  host.appendChild(card);
  const width=1000,padding=32;
  const aspect=(maxY-minY)/(maxX-minX);
  const height=Math.max(360,Math.min(760,Math.round((width-padding*2)*aspect+padding*2)));
  const scale=Math.min((width-padding*2)/(maxX-minX),(height-padding*2)/(maxY-minY));
  const px=(x)=>padding+(x-minX)*scale, py=(y)=>height-padding-(y-minY)*scale;
  const svg=svgEl('svg',{class:'fv-geo',viewBox:`0 0 ${width} ${height}`,role:'img',
    'aria-label':`${ctx.title} GeoJSON polygon preview`});
  svg.appendChild(svgEl('rect',{x:0,y:0,width,height,class:'fv-geo-bg'}));
  const labels=[];
  for(const feature of drawn){
    const colour=GEOJSON_COLOURS[feature.index%GEOJSON_COLOURS.length];
    for(const ring of feature.rings){
      const path=ring.map((point,index)=>`${index?'L':'M'}${px(point.x).toFixed(2)} ${py(point.y).toFixed(2)}`).join(' ')+' Z';
      svg.appendChild(svgEl('path',{d:path,class:'fv-geo-poly',stroke:colour,fill:colour}));
    }
    if(feature.label){
      const ring=feature.rings[0];
      const cx=ring.reduce((total,point)=>total+point.x,0)/ring.length;
      const cy=ring.reduce((total,point)=>total+point.y,0)/ring.length;
      labels.push({x:px(cx),y:py(cy),text:feature.label});
    }
  }
  for(const label of labels.slice(0,120)){
    const node=svgEl('text',{x:label.x.toFixed(2),y:label.y.toFixed(2),class:'fv-geo-label',
      'text-anchor':'middle'});
    node.textContent=label.text; svg.appendChild(node);
  }
  const wrap=el('div','fv-geo-wrap'); wrap.appendChild(svg); host.appendChild(wrap);
}
const RENDERERS={ markdown:renderMarkdown, csv:renderCsv, image:renderImage,audio:renderAudio,video:renderVideo,
  dxf:renderDxf,cad3d:renderCad3d,openscad:renderOpenScad,code:renderCode,pdf:renderPdf,archive:renderArchive,
  geojson:renderGeojson,plain:renderPlain,generic:renderGeneric,spice:renderSpice };

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

function liveFileView(base,run,workspaceId,path){
  S.curBase=base;
  const state=liveArtifactState(base,run); const file=state?.files?.get(`${workspaceId}\u0000${path}`);
  if(!file){
    return {title:`<span class="kind k-artifact">LIVE FILE</span> ${esc(path)}`,
      html:`<div class="viewerr">This file was deleted from the live workspace. The prior hash remains in the run's change list, but there are no current bytes to render.</div>`};
  }
  const stateKey=_liveRunKey(base,run); const bodyKey=_liveFileStateKey(base,run,workspaceId,path);
  S.openLiveFile={stateKey,base,run,workspaceId,path,hash:file.sha256,bodyKey};
  const raw=!!(S.liveRawModes&&S.liveRawModes.get(bodyKey));
  const workspaces=(state.snapshot?.workspaces||[]).filter((workspace)=>
    String(workspace?.workspace_id||'')===workspaceId);
  const environmentId=workspaces.length===1?environmentIdentity(workspaces[0]?.environment_id):'';
  const metadata=_liveFileSignedArtifactMetadata(file,{kernel:String(state.snapshot?.node_id||''),
    run:String(state.run||''),environmentId,workspaceId});
  return fileView(base,file.body_url,path,metadata?metadata.mimeType:declaredArtifactMedia(file),{
    raw,size:file.size_bytes,contentHash:file.sha256,
    authoredLabels:metadata?metadata.authoredLabels:authoredArtifactLabels(file),
    artifactDeclaration:metadata?.declaration||_artifactDeclarationDisplayProjection(file),
    liveFile:{...file,run,revision:state.revision,generatedAt:state.generatedAt,bodyKey,source:state.source,
      terminalAtStart:Boolean(state.ended),endedAt:String(state.endedAt||'')},
  });
}

// File identity, format declaration and provenance paint synchronously. Body
// transport, SHA-256, byte sniffing and rendering belong to the view lifecycle
// and hydrate the already-mounted metadata slots in the background.
function fileView(base,path,title,kind,opts){ S.curBase=base; opts=opts||{};
  const filePresentation=_artifactFilePresentation(title);
  const declaration=_artifactDeclarationDisplayProjection(opts.artifactDeclaration||{});
  const humanTitle=declaration.title||filePresentation.title;
  const declarer=_artifactDeclarationPersonaLabel(declaration,kernelForBase(base));
  const authoredLabels=artifactSemanticLabels({
    capability_summary:Array.isArray(opts.authoredLabels)?opts.authoredLabels:[],
  });
  const authoredAttr=JSON.stringify(authoredLabels);
  const initialPick=pickRenderer(kind,title);
  const sourceUrl=join(base,path);
  const forcedPlain=opts.raw===true;
  const initialBinary=BINARY_RENDERERS.has(initialPick.id);
  const advertisedHash=String(opts.liveFile?.sha256||opts.contentHash||'').trim();
  const expectedHash=advertisedHash.replace(/^sha256:/i,'').toLowerCase();
  const hashAdvertised=!!advertisedHash, validExpectedHash=/^[a-f0-9]{64}$/.test(expectedHash);
  if(validExpectedHash&&p2pDataRouteForUrl(sourceUrl)){
    let artifactUrl=''; try{ artifactUrl=new URL(sourceUrl,location.href).href; }catch(_){}
    if(artifactUrl){
      const artifacts=S.p2pArtifactHashes=S.p2pArtifactHashes||new Map();
      artifacts.set(artifactUrl,`sha256:${expectedHash}`);
    }
  }
  const liveAttr=opts.liveFile?' data-live="1"':'';
  const rawToggle=(isBinary,rendererId)=>forcedPlain
    ? `<a href="#" data-act="fv-rich"${liveAttr} data-path="${esc(path)}" data-title="${esc(title)}" data-kind="${esc(kind||'')}" data-semantics="${esc(authoredAttr)}" data-declaration="${esc(artifactDeclarationAttr(declaration))}" data-hash="${esc(opts.contentHash||'')}" data-size="${esc(opts.size??'')}">formatted view ←</a>`
    : (!isBinary&&rendererId!=='plain'
        ? `<a href="#" data-act="fv-raw"${liveAttr} data-path="${esc(path)}" data-title="${esc(title)}" data-kind="${esc(kind||'')}" data-semantics="${esc(authoredAttr)}" data-declaration="${esc(artifactDeclarationAttr(declaration))}" data-hash="${esc(opts.contentHash||'')}" data-size="${esc(opts.size??'')}">plain text view</a>`
        : `<span class="l2">${isBinary?'format preview':'plain text view'}</span>`);
  const mediaSourceLabel=(pick)=>({
    declared:'signed artifact metadata',
    response:'hash-checked body response',
    bytes:'hash-checked content signature',
    path:'signed path suffix fallback',
    none:'no type metadata',
  }[pick.source]||'type metadata');
  const initialRendererId=forcedPlain?'plain':initialPick.id;
  const initialVerification=kv('Exact path',`<code class="exact-path">${esc(filePresentation.exactPath)}</code>`)
    +kv('Media details',`${esc(initialPick.mediaType||kind||'undeclared')} <span class="fv-rid">· ${esc(initialRendererId)} renderer · ${esc(mediaSourceLabel(initialPick))}</span>`)
    +(opts.liveFile?kv('Workspace revision',`<code class="exact-hash">${esc(opts.liveFile.revision)}</code>`):'')
    +(hashAdvertised?kv('SHA-256',`<span class="amber">checking downloaded bytes…</span> <code class="exact-hash">${esc(advertisedHash)}</code>`):'');
  const sizeLabel=opts.size!=null?fmtBytes(opts.size):'—';
  let html=kv(declaration.title?'Persona title':'Name',`<span class="fv-human-file-name"><strong>${esc(humanTitle)}</strong>${filePresentation.extensionLabel?`<span class="artifact-extension-badge">${esc(filePresentation.extensionLabel)}</span>`:''}</span>`)
    +kv('Filename',`<code>${esc(filePresentation.filename)}</code>`)
    +(filePresentation.folderLabel?kv('Folder',esc(filePresentation.folderLabel)):'')
    +(declarer?kv('Declared by',`<strong>${esc(declarer)}</strong>`):'')
    +kv('Type',`<strong data-fv-type>${esc(artifactTypeLabel(initialPick.mediaType||kind))}</strong>`)
    +`<div class="fv-note" data-fv-unknown${initialPick.mediaType?' hidden':''}>This file type is not yet recognised, so it opens in a safe general-purpose inspector.</div>`
    +(authoredLabels.length?kv('Purpose',authoredLabels.map((label)=>`<span class="cap">${esc(label)}</span>`).join(' ')):'')
    +`<div class="row"><span class="l2">Size</span><span class="v2 fv-size">${esc(sizeLabel)}</span></div>`
    +`<div class="row"><span class="l2">Open as</span><span class="v2" data-fv-open-as>${rawToggle(initialBinary,initialRendererId)} · `
    +`${secureDownloadMarkup(sourceUrl,title,opts.contentHash)}</span></div>`
    +(hashAdvertised?`<div class="fv-integrity amber" data-fv-integrity>${icon('history','ico-sm')} Advertised SHA-256 recorded · fetching and checking bytes in the background.</div>`:'')
    +_artifactDeclarationMetadataHTML(declaration)
    +verificationReferencesDetails([
      ['artifact declaration event',declaration.declaration_event_id],
      ['artifact declaration hash',declaration.declaration_event_hash],
      ['declared task',declaration.declared_task_id],
      ['source persona action',declaration.source_action_id],
    ])
    +`<details class="fv-technical"><summary>Verification & file details</summary><div data-fv-verification>${initialVerification}</div></details>`
    +`<div data-fv-diff></div>`
    +`<div id="fv-body" class="fv-body"><div class="fv-loading" role="status">preparing verified preview…</div></div>`;
  const mount=async(root,lifecycle)=>{
    lifecycle.assertCurrent();
    const host=root.querySelector('#fv-body'); if(!host) return;
    const report=(message)=>{ lifecycle.reportProgress(message); };
    let pick=initialPick,isBinary=initialBinary,rendererId=initialRendererId;
    let text=null,realSize=null,verified=null,detectedMedia='',liveDiff='';
    if(hashAdvertised){
      report(validExpectedHash?'fetching artifact bytes…':'checking advertised SHA-256…');
      verified=validExpectedHash
        ?await fetchVerifiedLiveBody(sourceUrl,expectedHash,{signal:lifecycle.signal})
        :{ok:false,checkOutcome:'failed',error:'invalid advertised SHA-256'};
      lifecycle.assertCurrent();
      if(opts.liveFile){ const current=liveArtifactState(base,opts.liveFile.run);
        if(verified.ok&&!liveBodyCommitIsCurrent(opts.liveFile,current,S.openLiveFile))
          verified={ok:false,checkOutcome:'failed',error:'stale live body response discarded'};
      }
      if(verified.ok){
        report('checking advertised SHA-256…');
        realSize=verified.size; detectedMedia=sniffArtifactMediaType(verified.bytes);
        pick=pickRenderer(kind,title,verified.type,detectedMedia);
        isBinary=BINARY_RENDERERS.has(pick.id); rendererId=forcedPlain?'plain':pick.id;
        if(!isBinary||forcedPlain) text=new TextDecoder().decode(verified.bytes);
        const cache=opts.liveFile?S.liveArtifactBodyCache.get(opts.liveFile.bodyKey):null;
        if(opts.liveFile&&text!=null){
          let nextCache=cache;
          if(!cache||cache.hash!==opts.liveFile.sha256){
            nextCache={hash:opts.liveFile.sha256,text,
              previousHash:cache?.hash||'',previousText:cache?.text??null};
            lifecycle.assertCurrent();
            S.liveArtifactBodyCache.set(opts.liveFile.bodyKey,nextCache);
            while(S.liveArtifactBodyCache.size>24)
              S.liveArtifactBodyCache.delete(S.liveArtifactBodyCache.keys().next().value);
          }
          if(nextCache?.previousText!=null&&nextCache.previousHash!==nextCache.hash)
            liveDiff=_lineDiffHTML(nextCache.previousText,nextCache.text);
        }
      }
    }else if(!isBinary){
      report('fetching text bytes…');
      text=await fetchText(sourceUrl,{signal:lifecycle.signal});
      lifecycle.assertCurrent(); realSize=text==null?null:new TextEncoder().encode(text).byteLength;
    }
    const ctx={base,path,url:sourceUrl,sourceUrl,title,kind:pick.mediaType||kind,forcedPlain,
      declaredMedia:kind||'',responseMedia:verified?.type||'',detectedMedia,
      verifiedBytes:verified?.ok?verified.bytes:null,text,realSize,size:opts.size,
      contentHash:advertisedHash||null,integrityVerified:!!verified?.ok,
      liveFile:opts.liveFile||null,
      companionFiles:Array.isArray(opts.companionFiles)?opts.companionFiles:[],
      lifecycle,signal:lifecycle.signal,assertCurrent:lifecycle.assertCurrent,
      onCleanup:lifecycle.onCleanup,reportProgress:report};
    const bodyUnavailable=hashAdvertised?!verified?.ok:(!isBinary&&!forcedPlain&&text===null);
    const byteCheckLabel=verified?.ok?'BYTES CHECKED':
      (verified?.checkOutcome==='unavailable'?'BYTES NOT CHECKED':'BYTES CHECK FAILED/REFUSED');
    const verificationRows=kv('Exact path',`<code class="exact-path">${esc(filePresentation.exactPath)}</code>`)
      +kv('Media details',`${esc(pick.mediaType||kind||'undeclared')} <span class="fv-rid">· ${esc(rendererId)} renderer · ${esc(mediaSourceLabel(pick))}</span>`)
      +(detectedMedia?kv('Observed byte format',`<code>${esc(detectedMedia)}</code>`):'')
      +(opts.liveFile?kv('Workspace revision',`<code class="exact-hash">${esc(opts.liveFile.revision)}</code>`):'')
      +(hashAdvertised?kv('SHA-256',verified?.ok
        ?`<span class="ok">${icon('check','ico-sm')} bytes checked</span> <code class="exact-hash">${esc(advertisedHash)}</code>`
        :`<span class="no">${icon('x','ico-sm')} ${esc(verified?.error||'body unavailable')}</span> <code class="exact-hash">${esc(advertisedHash)}</code>`)
        +`<div class="live-view-meta"><span class="transport-badge${verified?.ok?' verified':' failed'}">${opts.liveFile?'SNAPSHOT SIGNATURE CHECKED · ':'ADVERTISED HASH · '}${byteCheckLabel}</span>${opts.liveFile?`<span>${esc(opts.liveFile.mtime||opts.liveFile.generatedAt||'')}</span>`:''}</div>`:'');
    lifecycle.assertCurrent();
    const typeNode=root.querySelector('[data-fv-type]');
    if(typeNode) typeNode.textContent=artifactTypeLabel(pick.mediaType||kind);
    const unknownNode=root.querySelector('[data-fv-unknown]');
    if(unknownNode) unknownNode.hidden=!!pick.mediaType;
    const openNode=root.querySelector('[data-fv-open-as]');
    if(openNode) openNode.innerHTML=`${rawToggle(isBinary,rendererId)} · ${secureDownloadMarkup(sourceUrl,title,opts.contentHash)}`;
    const verificationNode=root.querySelector('[data-fv-verification]');
    if(verificationNode) verificationNode.innerHTML=verificationRows;
    const diffNode=root.querySelector('[data-fv-diff]'); if(diffNode) diffNode.innerHTML=liveDiff;
    const integrityNode=root.querySelector('[data-fv-integrity]');
    if(integrityNode){
      integrityNode.className=`fv-integrity ${verified?.ok?'ok':'no'}`;
      integrityNode.innerHTML=verified?.ok
        ?`${icon('check','ico-sm')} Verified file — downloaded bytes match the advertised SHA-256.`
        :`${icon('x','ico-sm')} This file could not be verified and will not be previewed.`;
    }
    if(realSize!=null){ const sizeNode=root.querySelector('.fv-size');
      if(sizeNode) sizeNode.textContent=fmtBytes(realSize); }
    if(bodyUnavailable){
      host.innerHTML=''; host.appendChild(el('div','fv-note',opts.liveFile
        ?`The current file cannot be shown: ${verified?.error||'it is unavailable'}. The preview stays closed unless the downloaded bytes exactly match the workspace record.`
        :'The file could not be loaded. It may require access, its node may be offline, or the file may no longer exist.'));
      return;
    }
    const renderer=RENDERERS[rendererId]||renderPlain;
    const rendererConsumesBytes=BINARY_RENDERERS.has(rendererId);
    try{
      report('loading format renderer…'); lifecycle.assertCurrent();
      host.innerHTML=''; await renderer(host,ctx); lifecycle.assertCurrent();
    }catch(error){
      if(error?.name==='AbortError'||lifecycle.signal.aborted) throw error;
      lifecycle.assertCurrent(); host.innerHTML='';
      host.appendChild(el('div','fv-note','The format preview is unavailable ('+String(error&&error.message||'error')+').'));
      let body=ctx.text;
      if(body==null&&!rendererConsumesBytes)
        body=await fetchText(sourceUrl,{signal:lifecycle.signal});
      lifecycle.assertCurrent();
      if(body==null&&rendererConsumesBytes&&ctx.verifiedBytes&&rendererId!=='generic'){
        await renderGeneric(host,{...ctx,kind:ctx.detectedMedia||ctx.kind});
        lifecycle.assertCurrent(); return;
      }
      if(body==null&&rendererConsumesBytes){
        host.appendChild(el('div','fv-note','The file could not be loaded. It may require access, its node may be offline, or the file may no longer exist.')); return;
      }
      host.appendChild(plainPre(String(body??'').slice(0,20000)));
    }
    if(ctx.realSize!=null){ const sizeNode=root.querySelector('.fv-size');
      if(sizeNode) sizeNode.textContent=fmtBytes(ctx.realSize); }
  };
  return {title:`<span class="kind k-artifact">FILE</span> <span class="fv-drawer-file-name">${esc(humanTitle)}${filePresentation.extensionLabel?` <em>${esc(filePresentation.extensionLabel)}</em>`:''}</span>`, html, mount};
}
async function telemetryView(r){ const contentBase=r._base||'',base=nodeBaseForRecord(r),L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v); S.curBase=base;
  // 01_KERNEL §8/§11: live telemetry nests OTel/lineage under `kernel`
  // (model_events, spans, summary, lineage_durable) and persona evolution
  // summaries under `personas`. Bind those — NOT the old tel.events/tel.ring.
  const snapshotPath=L.snapshot||'telemetry/live/latest.json';
  const feedBase=L.snapshot?contentBase:base;
  if(!feedBase) return {title:`<span class="kind k-telemetry">TELEMETRY</span> ${esc(r.label)}`,
    html:'<div class="privacy-note">No current-master-verified node route is available for this telemetry feed.</div>'};
  const tel=await fetchJson(join(feedBase,snapshotPath))||{};
  const publicEntity=isPublicEntityTelemetryDocument(tel);
  const publicAggregate=tel.schema==='personaos-live-telemetry-public/1';
  if(publicEntity) await verifyPublicCommunicationRoutes(feedBase,tel);
  const admitted=publicEntity?await verifyPublicEntityDocument(feedBase,snapshotPath,tel)
    :publicAggregate?await verifyPublicTelemetryFrame(feedBase,tel):true;
  if(!admitted) return {title:`<span class="kind k-telemetry">TELEMETRY</span> ${esc(r.label)}`,
    html:'<div class="privacy-note">Public telemetry was refused because its current-master signature or exact public shape did not verify.</div>'};
  // Per-ENTITY feed record (telemetry:<persona>/<env> → its own redacted-tier
  // document): render the entity's live "inside" view and stream it in place.
  if(isPersonaTelemetryDocument(tel)||isEnvironmentTelemetryDocument(tel)){
    const isP=isPersonaTelemetryDocument(tel);
    S.drawerLiveKind=isP?'persona':'env';
    S.drawerLiveId=isP?tel.persona_id:tel.environment_id;
    S.drawerLiveKernel=r._kernel||tel.kernel_id||tel.node_id||kernelForBase(feedBase);
    S.drawerLiveBase=feedBase; S.drawerLiveFeed=snapshotPath;
    const subjectLabel=isP?_nameFor(S.drawerLiveId,S.drawerLiveKernel)
      :_environmentNameFor(S.drawerLiveId,S.drawerLiveKernel);
    const generatedFriendly=_friendlyInstant(tel.generated_at);
    let html=kv('Feed',S0(r.label))
      +kv('Subject',`<span class="cap">${esc(isP?'persona':'workspace')}</span> <b>${esc(subjectLabel)}</b>`)
      +kv('Tier',isPublicEntityTelemetryDocument(tel)
        ?'public redacted — lifecycle, model status and route metadata only'
        :'redacted — span kinds / status / durations / transitions only (A-TF2)')
      +(generatedFriendly?kv('Updated',`<time datetime="${esc(tel.generated_at)}" title="${esc(tel.generated_at)}">${esc(generatedFriendly)}</time>`):'')
      +kv('Access','consent-gated · content tier needs a read+ grant AND a consent pin (A-TF3)')
      +verificationIdentityDetails(isP?'persona id':'environment id',S.drawerLiveId);
    html+=H(isP?'● Live · inside this persona':'● Live · inside this environment')
      +`<div id="livesec" class="livesec">${isP?renderPersonaFeedDoc(tel):renderEnvFeedDoc(tel)}</div>`;
    html+=trustPanel(r);
    return {title:`<span class="kind k-telemetry">TELEMETRY</span> ${esc(subjectLabel)}`, html};
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
  const lifecycle=publicTaskLifecycleProjection(r);
  let html='';
  if(lifecycle){
    const workspace=lifecycle.environment?_environmentNameFor(lifecycle.environment,r._kernel):'';
    const mechanical=_mechanicalRunProjection(lifecycle.state,{
      currentExecution:lifecycle.currentExecution===true,source:'signed task lifecycle'});
    html+=kv('Task',`<span class="off-white">${esc(lifecycle.task)}</span>`)
      +kv('Mechanical run state',`<span class="work-state-status">${esc(mechanical.label)}</span> <span class="l2">${esc(mechanical.detail)}</span>`)
      +kv('Exact lifecycle state',`<code>${esc(lifecycle.state)}</code>`)
      +kv('Current execution field',`<code>${esc(String(lifecycle.currentExecution))}</code>`)
      +kv('Workspace',workspace
        ?`<span title="${esc(lifecycle.environment)}">${esc(workspace)}</span>`
        :'<span class="l2">not routed</span>');
  }
  html+=kv('Kind',esc(r.kind))+kv('Visibility',esc(r.visibility_tier))
    +kv('Signature',`<span class="ok">${icon('check','ico-sm')} Ed25519 verified</span>`)
    +kv('Body anchor',esc(anchor))+kv('Events (this run)',esc(r.events));
  html+=verificationReferencesDetails([
    ['record id',r.did],['node id',r._kernel],
    ...(lifecycle?[
      ['task id',lifecycle.taskId],['run id',lifecycle.run],['environment id',lifecycle.environment],
      ['revision',lifecycle.revision],['root run',lifecycle.rootRun],
      ['resumed from',lifecycle.resumedFrom],['continued from',lifecycle.continuedFrom],
      ['amended from',lifecycle.amendedFrom],
    ]:[]),
  ]);
  const gh=grants.length?grants.map((g)=>`<div class="grant"><span>${esc(g.grantee_kind)}:${esc((g.grantee_id||'').slice(0,18))||'*'}</span><span class="ok">${esc(g.access_level)}</span></div>`).join(''):'<div class="grant"><span>owner only</span><span></span></div>';
  if(lifecycle){
    html+=H('Signed task lineage / history')
      +kv('Origin',lifecycle.rootRun===lifecycle.run
        ?'<span class="l2">this execution began the signed lineage</span>'
        :'<span class="l2">continued from earlier signed work</span>')
      +kv('Resumed',lifecycle.resumedFrom
        ?'<span class="ok">yes · signed parent recorded</span>':'<span class="l2">no signed resume parent</span>')
      +kv('Continued',lifecycle.continuedFrom
        ?'<span class="ok">yes · signed parent recorded</span>':'<span class="l2">no signed continuation parent</span>')
      +kv('Amended',lifecycle.amendedFrom
        ?'<span class="ok">yes · signed parent recorded</span>':'<span class="l2">no signed amendment parent</span>');
    html+=`<div class="fv-note"><span class="ok">${icon('check','ico-sm')} kernel signature and content-hash revision verified</span> · exact lifecycle mechanics only; no task-result verdict is inferred.</div>`;
  }
  html+=H('Capabilities')+chipsOf(r.capability_summary)+H(`Access · outward ${esc(a.outward_tier||r.visibility_tier)}`)+gh
    +H('Source')+(r._url?`<div class="row"><a href="${esc(safeUrl(r._url))}" target="_blank" rel="noopener">signed record JSON →</a></div>`
      :'<div class="row"><span class="l2">withheld · discover-only metadata projection</span></div>');
  return {title:`<span class="kind k-${esc(r.kind)}">${esc(KIND_LABEL[r.kind]||r.kind)}</span> ${esc(lifecycle?.task||r.label)}`, html};
}
const kernelRec=(kid,kind)=>S.order.find((id)=>{ const r=S.recs.get(id); return r._kernel===kid && r.kind===kind; });
async function domainView(r){ const base=r._base||'',L=r._links||{}, S0=(v)=>esc((v===''||v==null)?'—':v); S.curBase=base;
  // The exact deep document is accepted only when its canonical hash matches the
  // content anchor inside the already verified signed discovery record.
  const d=(L.export?await contentBoundDocument(base,L.export,r.content_hash):null)||{};
  let html=kv('Domain',S0(d.domain_id||r.did))
    +kv('Name',S0(d.name||r.label))
    +kv('Origin',S0(d.origin))
    +kv('Stage',`<span class="cap">${S0(d.stage)}</span>`)
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
  // Project/3 has open multi-environment hosting. Prefer its complete immutable
  // run export when available; a restarted live project instead carries an
  // independently kernel-signed reciprocal-topology snapshot. The removed
  // singular environment_id/env_id aliases never regain presentation authority.
  const d=(L.export?await dfetch(base,L.export):null)||{};
  const liveTopology=r._projectTopologyVerified===true?r._projectTopology:null;
  const topologySource=d.schema==='personaos-project-export/2'?d:(liveTopology||{});
  const rawMembers=topologySource.members||{};
  const members=Array.isArray(rawMembers)
    ?rawMembers.map((m)=>typeof m==='string'?{persona_id:m,role:''}:m).filter((m)=>m&&m.persona_id)
    :Object.entries(rawMembers).map(([personaId,value])=>typeof value==='object'&&value!==null
      ?{...value,persona_id:value.persona_id||personaId}
      :{persona_id:personaId,role:String(value||'')});
  const hasExportTopology=d.schema==='personaos-project-export/2'&&Array.isArray(d.environments);
  const hasLiveTopology=liveTopology?.schema==='personaos-public-project-topology/1'
    &&Array.isArray(liveTopology.environment_ids);
  const hasCanonicalTopology=hasExportTopology||hasLiveTopology;
  const hostValues=hasCanonicalTopology
    ?(hasExportTopology?d.environments:liveTopology.environment_ids)
      .map((value)=>String(value||'').trim()).filter(Boolean):[];
  const hosts=[...new Set(hostValues)];
  const primary=String(topologySource.primary_environment_id||'').trim();
  const topologyValid=hasCanonicalTopology&&hostValues.length===hosts.length
    &&((hosts.length===0&&!primary)||(hosts.length>0&&hosts.includes(primary)));
  let html=kv('Project',`<b>${S0(d.name||r.label)}</b>`)
    +kv('Hosted environments',topologyValid?S0(hosts.length):'<span class="no">invalid / unavailable</span>')
    +(topologyValid&&hosts.length?kv('Primary workspace',`<b>${esc(_environmentNameFor(primary,r._kernel))}</b>`):'')
    +kv('Members',S0(members.length||'—'))
    +(topologySource.status?kv('State',`<span class="cap">${esc(topologySource.status)}</span>`):'')
    +(d.bundle_id?kv('Artifact bundle','published metadata'):'')
    +verificationIdentityDetails('project id',topologySource.project_id||r.did);
  if(topologyValid&&hosts.length) html+=H(`Environments (${hosts.length})`)+hosts.map((environmentId)=>{
    const rid=S.order.find((id)=>{ const candidate=S.recs.get(id);
      return candidate&&candidate.kind==='env'&&candidate._kernel===r._kernel
        &&(_envSid(candidate)===_envSidFromValue(environmentId)
          ||String(candidate.did||'').includes(environmentId)); });
    const label=`${_environmentNameFor(environmentId,r._kernel)}${environmentId===primary?' · primary':''}`;
    return `<div class="grant"><span>${rid?recLink(rid,label):`<code>${esc(label)}</code>`}</span>`
      +`<span class="l2">${environmentId===primary?'PRIMARY':'HOST'}</span></div>`;
  }).join('');
  else if(d.schema&&d.schema!=='personaos-project-export/2'&&!liveTopology) html+=`<div class="viewerr">${icon('warn','ico-sm')} Legacy singular project-host topology was refused; republish this project with export/2.</div>`;
  if(members.length) html+=H(`Members (${members.length})`)+members.slice(0,10).map((m)=>{
    const rid=findRecByDid(m.persona_id,r._kernel)||findRecByDid('did:personaos:'+m.persona_id,r._kernel);
    const memberName=_nameFor(m.persona_id,r._kernel);
    return `<div class="grant">${rid?recLink(rid,memberName):esc(memberName)}<span class="l2">${esc(m.role||'')}</span></div>`;
  }).join('');
  html+=trustPanel(r);
  let nav=''; const did=kernelRec(r._kernel,'domain');
  if(did) nav+=`<div class="row">${recLink(did,'Domain →')}</div>`;
  if(L.bundle) nav+=`<div class="row"><a href="#" data-act="bundle" data-url="${esc(L.bundle)}">Artifact bundle →</a></div>`;
  if(nav) html+=H('Related')+nav;
  return {title:`<span class="kind k-project">PROJECT</span> ${esc(d.name||r.label)}`, html};
}
async function bodyView(base,runUrl){ S.curBase=base; const rj0=await dfetch(base,runUrl);
  if(!rj0) return {title:`<span class="kind k-persona">BODY EVIDENCE</span> authored run record`,
    html:`<div class="viewerr">Run document could not be loaded from this public route. The node may be offline or another verified route may be needed; this browser does not request owner credentials.</div>`};
  const rj=rj0; const b=rj.body||{}, ex=rj.real_execution||{};
  let html=kv('Task class',esc(b.task_class||'—'))+kv('Pathway',esc(b.pathway||'—'))
    +kv('Authored accepted field',`<code>${esc(String(b.accepted??'not authored'))}</code>`)
    +kv('Authored model field',`<code>${esc(b.verified_by_model||'not authored')}</code>`)
    +kv('Program',esc((b.program_chars||0)+' chars'));
  const at=b.attempts||[]; if(at.length) html+=H('Authored model-attempt receipts')+at.map((a)=>`<div class="grant"><span>${esc(a.model_id||'model')}</span><span class="l2"><code>${esc(a.status||'')}</code> · accepted=<code>${esc(String(a.accepted??''))}</code> · ${esc(a.program_chars)} ch</span></div>`).join('');
  html+=H('Sandbox execution receipt')+kv('Authored ok field',`<code>${esc(String(ex.ok??'not authored'))}</code>`)+kv('Return code',esc(ex.returncode))+kv('stdout',`<code>${esc(ex.stdout||'')}</code>`);
  if((b.safety_sources||[]).length) html+=H(`Authored source references (${b.safety_sources.length})`)+chipsOf(b.safety_sources);
  return {title:`<span class="kind k-persona">BODY EVIDENCE</span> authored run record`, html};
}
async function verifyView(base,runUrl){ S.curBase=base; const rj0=await dfetch(base,runUrl);
  if(!rj0) return {title:`<span class="kind k-env">EVIDENCE</span> authored verification receipts`,
    html:`<div class="viewerr">Verification document could not be loaded from this public route. The node may be offline or another verified route may be needed; this browser does not request owner credentials.</div>`};
  const rj=rj0; const bv=rj.bundle_verification||{}, rt=rj.ready_to_order||{};
  let html=kv('Authored passed field',`<code>${esc(String(bv.passed??'not authored'))}</code>`)
    +kv('Authored state field',`<code>${esc(rt.state||'not authored')}</code>`)
    +kv('Authored locked field',`<code>${esc(String(rt.locked??'not authored'))}</code>`)
    +kv('Co-signature references',esc((rt.co_signers||[]).join(', ')||'—'));
  const invocations=bv.invocations||[];
  if(invocations.length) html+=H('Authored verifier receipts')+invocations.map((v)=>`<div class="grant"><span>${esc(v[0])}</span><span class="tier"><code>${esc(String(v[1]??''))}</code></span></div>`).join('');
  const ev=rj.environment_rule_evidence||[]; if(ev.length) html+=H(`Authored environment evidence (${ev.length})`)+ev.map((e)=>`<div class="desc2">${esc(e.rule_name||e.rule_id||'evidence')} · passed=<code>${esc(String(e.passed??''))}</code>${e.signature_hex?' · signature field present':''}</div>`).join('');
  return {title:`<span class="kind k-env">EVIDENCE</span> authored verification receipts`, html};
}
async function distributionView(base,L){ S.curBase=base;
  const oci0=await dfetch(base,L.oci), dag0=await dfetch(base,L.dag), reg0=await dfetch(base,L.registry);
  if(!oci0&&!dag0&&!reg0) return {title:`<span class="kind k-artifact">DISTRIBUTION</span> OCI + IPLD`,
    html:`<div class="viewerr">Distribution documents could not be loaded from this public route. The node may be offline or another verified route may be needed; this browser does not request owner credentials.</div>`};
  const oci=oci0||{}, dag=dag0||{}, reg=reg0||{};
  let html=kv('OCI artifactType',esc(oci.artifactType||'—'))+kv('OCI layers',esc((oci.layers||[]).length))
    +kv('IPLD root CID',esc(((dag.root_cid||'')+'').slice(0,32)||'—'))+kv('Addressing','SHA-256 · CIDv1 · content-addressed');
  const pk=reg.packages||[]; if(pk.length) html+=H(`Registry DIDs (${pk.length})`)+pk.map((p)=>`<div class="grant"><span>${esc(p.kind)}</span><span class="l2">${esc((p.did||'').slice(0,34))}…</span></div>`).join('');
  return {title:`<span class="kind k-artifact">DISTRIBUTION</span> OCI + IPLD`, html};
}
async function physicalView(base,runUrl){ S.curBase=base; const rj=await dfetch(base,runUrl)||{}; const p=rj.physical_board;
  if(!p) return {title:'<span class="kind k-artifact">PHYSICAL</span>', html:'<div class="l2">No physical asset is recorded for this task; its artifacts are digital.</div>'};
  const html=kv('MHBB tier',esc(p.mhbb_tier))+kv('Asset kind',esc(p.asset_kind))+kv('State',`<span class="ok">${esc(p.asset_state)}</span>`)
    +kv('As-built ref',esc(p.as_built_ref))+kv('Fabricator',esc(p.fab))+H('External attestation')+`<div class="desc2">${esc(p.attestation)}</div>`;
  return {title:`<span class="kind k-artifact">PHYSICAL BOARD</span>`, html};
}
// Legacy refinement/mission documents are intentionally not interpreted here.
async function workEvidenceView(r){
  const run=runOf(r),recordId=String(r.record_id||r.card_id||'');
  let html=kv('Published label',`<span class="off-white">${esc(r.label||'Work evidence')}</span>`)
    +kv('Evidence type','Signed discovery record')
    +verificationReferencesDetails([
      ['record id',recordId],['run id',run],['kernel id',r._kernel||''],
    ])
    +'<div class="fv-note">This signed record is retained as work evidence, not as a task-state verdict. Current execution comes only from mechanical run lifecycle, while work descriptions come from persona-authored notes.</div>';
  html+=trustPanel(r);
  return {title:`<span class="kind k-mission">WORK EVIDENCE</span> ${esc(r.label||'Published record')}`,html};
}
/* ---------- complete public-read views ---------- */

async function operatorView(){
  opTokens();
  // Surface verified and directly reached public nodes for inspection. Network
  // position never grants authority and this browser does not retain a bearer.
  const localBases=[...new Set([...peerList().map(opBaseKey).filter(isLocalBase),
    ...(isLocalBase(location.origin)?[opBaseKey(location.origin)]:[])])];
  // Status prefetch may prove that a remote route publishes a full public read
  // projection. A discovery card by itself never enters this list.
  const publicBases=freshPublicReadStatusBases();
  const bases=[...new Set([...localBases,...publicBases])];
  let html=H('Public node inspection')
    +`<div class="desc2">Every published persona, environment, task, artifact, workspace, message, telemetry, knowledge, tool, and open-input record is readable here. Human browser submissions and owner mutations are disabled until the deployment runtime has a separately verified secure boundary. Signed personas continue through their authenticated action transport.</div>`;
  html+=H(`Public nodes (${bases.length})`);
  for(const b of bases){ const loc=isLocalBase(b), pub=publicBases.includes(b);
    html+=`<div class="grant"><span>${esc(b)}${loc?' <span class="l2">· local route</span>':''}</span>`
    +`<span>${pub?'<span class="ok">public read</span> · ':''}<a href="#" data-act="op-node" data-base="${esc(b)}">inspect →</a>`
    +`</span></div>`; }
  if(!bases.length) html+=`<div class="l2">No complete public node route is verified yet. Live cards will appear here as global discovery resolves them.</div>`;
  return {title:`<span class="kind k-env">PUBLIC DATA</span> nodes`,html};
}

async function operatorNodeView(b){
  const key=opBaseKey(b);
  const mixed=location.protocol==='https:'&&/^http:\/\//i.test(key);
  const st=await fetchNodeStatusWithLive(b)||{};
  const reached=!!st.schema;
  const access=nodeStatusAccess(b,st), full=access.granted;
  const limited=st.schema==='personaos-node-status-public/1';
  const S0=(v)=>esc((v===''||v==null)?'—':v);
  let html='';
  if(!reached){
    html+=`<div class="desc2"><span class="no">can't reach this node from this page</span>`
      +(mixed
        ?` — this page is served over <b>HTTPS</b> and browsers block it from calling an <b>HTTP</b> node. Open the node's own console directly; that node's policy will say whether a bearer is needed: <a href="${esc(key)}/" target="_blank" rel="noopener">${esc(key)}/</a>`
        :` — check the node is running and reachable at <code>${esc(key)}</code>.`)+`</div>`;
    return {title:`<span class="kind k-env">PUBLIC DATA</span> ${esc(key)}`,html};
  }
  if(access.publicRead) html+=`<div class="desc2"><span class="ok">complete public read projection available</span> — this browser remains display-only.</div>`;
  else if(limited) html+=`<div class="desc2"><span class="no">limited public projection</span> — this node did not publish the complete public read surface.</div>`;
  html+=kv('Node',S0(st.node_id))+kv('Backend',S0(st.backend)+' · '+S0(st.active_model))
    +kv('Lineage',st.lineage_durable?`<span class="ok">${icon('check','ico-sm')} durable</span>`:(limited?'—':'<span class="no">in-memory only</span>'))
    +kv('Model-call budget',st.task_model_call_budget==null
      ?`unbounded when omitted · queued ${S0(st.pending_budget??0)}`
      :`${S0(st.task_model_call_budget)} per task · queued ${S0(st.pending_budget??0)}`)
    +kv('Artifact tier',S0(st.artifact_tier))
    +kv('Public discovery',st.public_discovery?`<span class="ok">on</span> (${esc((st.public_discovery_kinds||[]).join(', '))})`:'off');
  const activePersonaCount=Number.isSafeInteger(st.active_persona_count)
    ?st.active_persona_count:(Array.isArray(st.personas)?st.personas.length:null);
  html+=kv('Active people',activePersonaCount==null?'not reported':String(activePersonaCount));
  const replicationBounds=Array.isArray(st.replication_bounds)
    ?st.replication_bounds.filter((bound)=>bound&&typeof bound==='object'):[];
  html+=H('Population authority');
  if(replicationBounds.length){
    html+=replicationBounds.map((bound)=>{
      const kind=String(bound.replication_kind||'').split(/[.:/]/).filter(Boolean).at(-1)||'actor creation';
      const limits=[
        bound.population_ceiling==null?'population unbounded':`population ceiling ${bound.population_ceiling}`,
        bound.rate_ceiling_per_window==null?'rate unbounded':`${bound.rate_ceiling_per_window} per ${friendlyDuration(Number(bound.rate_window_seconds||0)*1000)||'configured window'}`,
        bound.depth_ceiling==null?'depth unbounded':`depth ceiling ${bound.depth_ceiling}`,
      ];
      const verified=bound.signature_verified===true;
      return `<div class="grant"><span><b>${esc(humanizeMachineKey(kind))}</b><small class="l2">${esc(limits.join(' · '))}</small></span>`
        +`<span class="${verified?'ok':'no'}">${verified?icon('check','ico-sm')+' signed bound verified':'bound signature unavailable'}</span></div>`;
    }).join('');
  }else{
    html+='<div class="fv-note">No signed replication bound is configured. Actions that declare actor materialization fail closed; the node cannot admit a new persona through that action surface.</div>';
  }
  const personas=st.personas||[];
  if(personas.length) html+=H(`Personas (${personas.length})`)+personas.map((p)=>{
    const call=(st.active_model_calls||[]).find((c)=>_shortId(c.persona_id)===_shortId(p.persona_id));
    const taskState=p.task_execution_state||'unmarked', llmState=p.llm_execution_state||'unmarked';
    return `<div class="persona-runtime-row"><div><b>${esc(_displayPersonaName(p.name,p.persona_id))}</b>`
      +`<span class="runtime-pills"><span class="runtime-pill ${taskState==='running_llm'?'hot':''}">${esc(taskState.replace(/_/g,' '))}</span><span class="runtime-pill">LLM ${esc(llmState.replace(/_/g,' '))}</span></span></div>`
      +(call?`<div class="runtime-call"><span class="livedot2"></span>${esc(PURPOSE_LABEL[call.requested_purpose]||call.requested_purpose||'model call')} · <code>${esc(call.model_id||'—')}</code>${call.role?` · ${esc(call.role)}`:''}</div>`
        :`<div class="l2">${esc(p.lifecycle_state||'')} · ${esc(p.experience_tasks??0)} task(s)</div>`)+`</div>`;
  }).join('');
  const runs=st.runs||[];
  if(runs.length) html+=H(`Runs (${runs.length})`)+runs.slice(-12).reverse().map((r,index)=>{
    const id=typeof r==='string'?r:(r.run||r.run_id||'');
    const task=typeof r==='object'?String(r.task||r.text||'').trim():'';
    const label=task||_verifiedPublicTaskForRun(st.node_id||'',id)?.task||`Run ${index+1}`;
    return `<div class="grant"><span><a href="#" data-act="op-run" data-base="${esc(b)}" data-run="${esc(id)}">${esc(label)}</a></span>`
      +`<span class="l2">${esc(typeof r==='object'?(r.status||''):'')}</span></div>`; }).join('');
  const paused=st.paused_missions||[];
  if(paused.length) html+=H(`Runs awaiting a causal continuation (${paused.length})`)+paused.map((p)=>{
    const mechanical=_mechanicalRunProjection(String(p?.status||p?.reason||''),{
      source:'node resume inventory',
    });
    return `<div class="grant"><span>${esc(p.task||'Retained task run')}</span>`
      +`<span><b class="work-state-status is-${esc(mechanical.key)}">${esc(mechanical.label)}</b> <small class="l2">${esc(mechanical.detail)}</small></span></div>`;
  }).join('');
  html+=H('Human input policy')
    +`<div class="l2">Persona questions and peer answers stay visible in the signed live activity stream. Human browser submission is temporarily disabled; signed personas may answer through their authenticated action surface, and silence never creates a wait state.</div>`;
  if(!full){
    html+=H('Public read status')
      +`<div class="l2">This response did not provide the complete public read projection. The browser does not request or retain owner credentials.</div>`;
    return {title:`<span class="kind k-env">PUBLIC DATA</span> ${esc(_kernelDisplayContext(st.node_id||'').label)}`,html};
  }
  html+=H('Browser access')
    +`<div class="l2">Read-only public inspection is active. This UI offers no task, response, budget, stop, or tool-invocation mutation, even if older browser storage contains a process bearer.</div>`;
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
    html+=`<div class="l2">Tool inventory is public; browser invocation is disabled under the current deployment policy.</div>`;
  }
  html+=verificationReferencesDetails([['node id',st.node_id||''],['node URL',b]]);
  return {title:`<span class="kind k-env">PUBLIC DATA</span> ${esc(_kernelDisplayContext(st.node_id||'').label)}`,html};
}

async function operatorRunView(b,run){
  S.curBase=b;
  const trackKey=_liveRunKey(b,run);
  S.trackedLiveRuns.set(trackKey,{base:b,run,lastSeen:Date.now()});
  const [nodeStatus,liveFetch]=await Promise.all([
    fetchNodeStatusWithLive(b),fetchLiveArtifacts(b,run),
  ]);
  const statusAccess=nodeStatusAccess(b,nodeStatus),hasFullStatus=statusAccess.read;
  const [runStatus,artifacts]=await Promise.all([
    hasFullStatus?fetchJson(join(b,'runs/'+encodeURIComponent(run))):null,
    hasFullStatus?fetchJson(join(b,'runs/'+encodeURIComponent(run)+'/artifacts')):null,
  ]);
  const raw=runStatus||{},rs=raw.run_state||{},arts=artifacts||{};
  const liveState=liveArtifactState(b,run)||liveFetch;
  const runKernel=String(liveState?.snapshot?.node_id||nodeStatus?.node_id
    ||kernelForBase(b)||'');
  const publicTask=_verifiedPublicTaskForRun(runKernel,run);
  // A public run can have a small live-worktree delta while its finalized
  // package contains the complete environment output.  The already-admitted
  // artifact rows are provider-envelope, record-signature, policy-signature,
  // exact-run, and exact-kernel bound, so surface those records in the run
  // drawer without depending on an operator-status grant or an unsigned
  // package-path response.  No filename, extension, media type, or task text
  // participates in admission or selection here.
  const publishedRunArtifacts=(S.order||[]).map((id)=>S.recs.get(id)).filter((record)=>
    record?.kind==='artifact'&&record._kernel===runKernel&&runOf(record)===run);
  const taskText=String(publicTask?.task||rs.task||'').trim();
  const finalizedBootstrap=liveState?.verification?.immutableFinalizedBootstrap===true;
  const terminal=Boolean(liveState?.ended
    &&(liveState?.verification?.terminalEventVerified||finalizedBootstrap));
  const activeCalls=terminal?[]:(nodeStatus?.active_model_calls||[]).filter((call)=>{
    const current=liveState?.snapshot?.active?.calls||[];
    return !current.length||current.some((item)=>item.call_id&&item.call_id===call.call_id);
  });
  const liveCalls=terminal?[]:(liveState?.snapshot?.active?.calls||activeCalls);
  const liveActive=liveCalls.length>0
    ||(liveState?.snapshot?.active?.persona_ids||[]).length>0
    ||(liveState?.snapshot?.active?.environment_ids||[]).length>0;
  const exactState=String(publicTask?.state||rs.status||'');
  const mechanical=_mechanicalRunProjection(exactState,{
    activeCall:liveCalls.length>0,
    currentExecution:publicTask?.currentExecution===true||(!publicTask&&liveActive),
    source:publicTask?'signed task lifecycle':'unsigned operator status',
  });
  let html=terminal
    ?'<div class="l2">Signature-checked termination evidence reports no active execution.</div>'
    :'<div class="l2">Read-only run monitor. Human browser mutation controls are disabled under the current deployment policy.</div>';
  html+=kv('Task',taskText?`<span class="off-white">${esc(taskText)}</span>`
      :'<span class="l2">Task text not published</span>')
    +kv('Mechanical run state',`<span class="work-state-status is-${esc(mechanical.key)}">${esc(mechanical.label)}</span> <span class="l2">${esc(mechanical.detail)}</span>`)
    +kv('Exact lifecycle state',exactState?`<code>${esc(exactState)}</code>`
      :'<span class="l2">not published</span>')
    +kv('Observation source',`<span class="l2">${esc(mechanical.source)}</span>`)
    +verificationReferencesDetails([
      ['run id',run],['node id',runKernel],['task id',publicTask?.taskId],
      ['environment id',publicTask?.environment],['revision',publicTask?.revision],
    ]);
  html+=H(terminal
    ?`Execution · ${finalizedBootstrap?'finalized-snapshot':'terminal-event'} signature checked`
    :'Current execution observations');
  if(liveCalls.length) html+=liveCalls.map((call)=>{
    const pid=_shortId(call.persona_id);
    const purpose=call.requested_purpose||call.purpose||'model call';
    return `<div class="live-call"><span><span class="livedot2"></span><b>${esc(_nameFor(pid,runKernel)||pid||'persona')}</b> · ${esc(PURPOSE_LABEL[purpose]||purpose)}</span>`
      +`<span><code>${esc(call.model_id||'—')}</code>${call.role?` · ${esc(call.role)}`:''}</span></div>`;
  }).join('');
  else html+=terminal
    ?`<div class="l2">The signature-checked ${finalizedBootstrap?'finalized snapshot':'run-ended event'} cleared active execution; no model call remains active.</div>`
    :'<div class="l2">No model call is active at this instant.</div>';
  if(publishedRunArtifacts.length){
    html+=H('Complete published output')
      +_ownedOutputsHTML(publishedRunArtifacts,{label:'Complete signed package',scope:'task output'})
      +'<div class="fv-note">This package is the complete current hash-bound output for the run, including formats that may not appear in the smaller live-change capture below. Its presence is execution evidence, not a claim that the engineering is complete or production-ready.</div>';
  }
  html+=H('Recent live workspace changes')
    +`<div data-live-run-key="${esc(_liveRunDomKey(b,run))}" role="region" aria-label="Recent live workspace updates" aria-live="polite">${liveArtifactsHTML(b,run)}</div>`;
  const files=arts.package||arts.package_files||arts.files||[];
  if(files.length) html+=H(`Observed package paths (${files.length})`)+files.slice(0,100).map((file)=>{
    const path=typeof file==='string'?file:(file.path||file.title||'');
    const name=String(path).split('/').pop();
    return `<div class="grant"><span class="l2">${esc(name)}</span><span class="l2">${esc(String(path).includes('/')?path.split('/').slice(0,-1).join('/'):'')}</span></div>`;
  }).join('');
  html+='<div class="fv-note">Run status is presented only as mechanical execution evidence. The browser derives no task-result or quality verdict from operator status vocabulary.</div>';
  return {title:`<span class="kind k-mission">RUN</span> ${esc(taskText||'Task run')}`,html};
}

async function viewFor(id){ const r=S.recs.get(id); if(!r) return {title:'—',html:'<div class="viewerr">'+icon('warn','ico-sm')+' record not found — it may have been re-resolved or evicted since you clicked. Close this and reopen from the stage.</div>'};
  const L=r._links||{};
  if(r.kind==='mission') return workEvidenceView(r);
  if(r.kind==='persona') return personaView(r);
  if(r.kind==='env') return envView(r);
  if(r.kind==='domain') return domainView(r);
  if(r.kind==='project') return projectView(r);
  if(r.kind==='telemetry') return telemetryView(r);
  if(r.kind==='artifact' && L.bundle) return bundleView(r._providerBase||r._base||'',L.bundle,L);
  if(r.kind==='artifact'){
    // File artifact: prefer the explicit content link; otherwise derive the served path from the
    // package-relative title (artifacts/package/<title>) so an art-chip whose record carries no
    // content link still opens. _bodyPath adds the k/<run>/ prefix to hit the served bytes.
    const cpath=L.content||((r.title||r.label)?('artifacts/package/'+(r.title||r.label)):'');
    const _b=r._providerBase||r._base||'';
    if(cpath) return fileView(_b, /k\/run-/.test(_b)?cpath:_bodyPath(cpath,runOf(r)), r.label, declaredArtifactMedia(r),{
      authoredLabels:authoredArtifactLabels(r),
      artifactDeclaration:_artifactDeclarationDisplayProjection(r),
      contentHash:L.content_hash||r.content_hash||null,
    });
  }
  return genericView(r);
}
// Each detail render owns its cancellation signal and teardown callbacks. A
// stale async renderer can never register resources into the next view.
function createViewLifecycle(generation){
  const controller=new AbortController(),cleanups=new Set(); let cancelled=false;
  const lifecycle={generation,signal:controller.signal,
    isCurrent:()=>!cancelled&&!controller.signal.aborted
      &&S.activeViewLifecycle===lifecycle&&S._renderGen===generation
      &&$('#detailwrap')?.classList.contains('open'),
    assertCurrent:()=>{ if(!lifecycle.isCurrent())
      throw new DOMException('Artifact view cancelled','AbortError'); },
    onCleanup:(fn)=>{ if(typeof fn!=='function') return;
      if(cancelled||controller.signal.aborted){ try{ fn(); }catch(_){}; return; }
      cleanups.add(fn); },
    reportProgress:(message)=>{ if(!lifecycle.isCurrent()) return;
      const node=$('#detailbody')?.querySelector('#fv-body .fv-loading');
      if(node) node.textContent=String(message||'loading preview…'); },
    cancel:()=>{ if(cancelled) return; cancelled=true; controller.abort();
      for(const fn of cleanups){ try{ fn(); }catch(_){} } cleanups.clear(); },
  };
  return lifecycle;
}
function runViewCleanups(){
  const lifecycle=S.activeViewLifecycle; S.activeViewLifecycle=null;
  lifecycle?.cancel?.();
  const legacy=S.viewCleanups||[]; S.viewCleanups=[];
  for(const fn of legacy){ try{ fn(); }catch(_){} }
}
function onViewCleanup(fn){
  if(S.activeViewLifecycle) S.activeViewLifecycle.onCleanup(fn);
  else { try{ fn(); }catch(_){} }
}
async function renderTop(){ const top=S.views[S.views.length-1]; if(!top) return;
  runViewCleanups();
  S.openLiveFile=null;
  S.drawerLiveKind=null; S.drawerLiveId=null; S.drawerLiveKernel=''; S.drawerLiveFeed=null; S.drawerLiveBase=''; S.drawerThinkPid=null;   // the view sets these if it streams
  // monotonic guard: top() awaits the network (file/bundle/body views), and Back /
  // pushView call renderTop without serialization. A stale in-flight render must not
  // write LAST and show a view the user already navigated away from — latest wins.
  const gen=(S._renderGen=(S._renderGen||0)+1);
  const lifecycle=createViewLifecycle(gen); S.activeViewLifecycle=lifecycle;
  $('#detailbody').innerHTML='<div class="fv-loading">resolving…</div>';
  let v; try{ v=await top(); }catch(e){ v={title:'error',html:'<div class="l2">'+esc(e.message)+'</div>'}; }
  if(!lifecycle.isCurrent()) return;
  $('#detail-title').innerHTML=v.title; $('#detailbody').innerHTML=v.html;
  $('#detailback').hidden=S.views.length<=1; $('#detailbody').scrollTop=0;
  // A11y: move focus into the dialog ONLY after its accessible name (the title) is
  // populated, and only when the drawer is open and focus isn't already inside it.
  // Re-anchors focus on Back/nav when the clicked control was hidden/removed, so focus
  // never escapes the trap to <body>. (Replaces the eager pre-title-populate focus().)
  const dw=$('#detailwrap'); if(dw&&dw.classList.contains('open')&&!dw.contains(document.activeElement)) $('.drawer')?.focus();
  // Mount work starts only after the metadata/header has reached a paint
  // opportunity. It owns this lifecycle and is intentionally not awaited by
  // navigation; cancellation makes stale completion harmless.
  if(typeof v.mount==='function') requestAnimationFrame(()=>{
    if(!lifecycle.isCurrent()) return;
    Promise.resolve(v.mount($('#detailbody'),lifecycle)).catch((error)=>{
      if(error?.name!=='AbortError'&&lifecycle.isCurrent())
        lifecycle.reportProgress('preview unavailable');
    });
  });
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

/* ---------- task/run evidence strip ---------- */
// Internal mission* DOM/function names remain for stable wiring. The visible
// surface admits only exact mechanical run categories from signed task
// lifecycle/live-workspace evidence or explicitly labelled operator telemetry.
function missionCardIsCurrent(card){
  return card?.mechanical?.key==='running';
}
function _missionNodeAvailability(kernel,now=Date.now()){
  const info=S.globalKernels?.get(String(kernel||''));
  if(!info) return 'unobserved';
  // A locator announcement says where a node might be reached; it is not a
  // successful live observation. Only an explicitly verified reachability
  // result may promote cached signed history into current activity.
  return info.meta?.reachable===true&&now-Number(info.lastSeen||0)<45000
    ?'online':'offline';
}
function missionCardIsObservedCurrent(card){
  return missionCardIsCurrent(card)&&card?.nodeAvailability==='online';
}
function _missionRunLabel(value){ const run=String(value||'');
  return run.length>26?`${run.slice(0,25)}…`:run; }
function missionCardList(){
  const lifecycleCards=new Map(),seenRuns=new Set();
  for(const id of S.order){
    const record=S.recs.get(id);
    const lifecycle=publicTaskLifecycleProjection(record);
    if(!lifecycle) continue;
    const mechanical=_mechanicalRunProjection(lifecycle.state,{
      currentExecution:lifecycle.currentExecution===true,
      source:'signed task lifecycle',
    });
    // Unrecognized lifecycle vocabulary remains available in record details,
    // but it is not converted into a task-state badge.
    if(mechanical.key==='unavailable') continue;
    const lineageKey=`${record._kernel}::${lifecycle.rootRun||lifecycle.run}`;
    const order=_taskLifecycleRecordOrder(record,lifecycle);
    const refs=[
      lifecycle.resumedFrom?'resumed from an earlier run':'',
      lifecycle.continuedFrom?'continued from an earlier run':'',
      lifecycle.amendedFrom?'amended from an earlier run':'',
    ].filter(Boolean);
    const revision=String(lifecycle.revision??'').trim();
    const revisionShort=/^[0-9]{1,4}$/.test(revision)?` · revision ${revision}`:'';
    const meta=[
      mechanical.detail,
      lifecycle.environment?`workspace ${_environmentNameFor(lifecycle.environment,record._kernel)}`:'',
      ...refs,
      `signed task record${revisionShort}`,
    ].filter(Boolean);
    const cardTitle=lifecycle.task+(mechanical.exactState?` — exact state ${mechanical.exactState}`:'')
      +(lifecycle.resumedFrom?` — resumed from ${lifecycle.resumedFrom}`:'');
    const card={key:`task:${lineageKey}`,task:lifecycle.task,title:cardTitle,state:mechanical.key,
      mechanical,kernel:record._kernel||'',meta,recId:id,run:lifecycle.run,
      base:nodeBaseForRecord(record),order,
      nodeAvailability:_missionNodeAvailability(record._kernel)};
    const prior=lifecycleCards.get(lineageKey);
    if(!prior||order>prior.order) lifecycleCards.set(lineageKey,card);
    seenRuns.add(`${record._kernel}\u0000${lifecycle.run}`);
  }
  const cards=[...lifecycleCards.values()]
    .sort((left,right)=>right.order.localeCompare(left.order));

  // A current signed live-workspace snapshot can expose execution before its
  // task lifecycle record reaches this browser. Admit only active mechanics.
  for(const state of S.liveArtifacts.values()){
    if(state.ended||Date.now()-(state.receivedAt||0)>20000) continue;
    const kernel=String(state.snapshot?.node_id||kernelForBase(state.base)||'');
    const run=String(state.run||''),runKey=`${kernel}\u0000${run}`;
    if(!run||seenRuns.has(runKey)) continue;
    const active=state.snapshot?.active||{};
    const activeNow=(active.calls||[]).length>0||(active.persona_ids||[]).length>0
      ||(active.environment_ids||[]).length>0;
    if(!activeNow) continue;
    const lifecycle=_verifiedPublicTaskForRun(kernel,run);
    const mechanical=_mechanicalRunProjection('',{
      currentExecution:true,source:'signed live-workspace snapshot',
    });
    cards.push({key:`live:${kernel}:${run}`,
      task:lifecycle?.task||`Task run ${_missionRunLabel(run)}`,
      state:mechanical.key,mechanical,kernel,
      meta:[mechanical.detail,`${state.files.size} current file${state.files.size===1?'':'s'}`,
        'signed live-workspace snapshot'],
      base:state.base,run,nodeAvailability:'online'});
    seenRuns.add(runKey);
  }

  // Full node status is unsigned transport telemetry and is labelled as such.
  // It may fill a focused/operator view, but never becomes signed task evidence.
  const fresh=Date.now()-32000;
  for(const [baseKey,hit] of currentRuntimeStatusEntries(Date.now(),32000)){
    const base=baseKey==='@origin'?'':baseKey,v=hit?.v;
    if(!v||!(hit.ts>fresh)) continue;
    const kernel=kernelForBase(base);
    for(const raw of (v.stoppable_runs||[])){
      const run=String(raw||''),runKey=`${kernel}\u0000${run}`;
      if(!run||seenRuns.has(runKey)||S.liveArtifactEnded.has(_liveRunKey(base,run))) continue;
      const lifecycle=_verifiedPublicTaskForRun(kernel,run);
      const mechanical=_mechanicalRunProjection('',{
        currentExecution:true,source:'unsigned operator status',
      });
      cards.push({key:`status:${kernel}:${run}`,
        task:lifecycle?.task||`Task run ${_missionRunLabel(run)}`,
        state:mechanical.key,mechanical,kernel,
        meta:[mechanical.detail,'unsigned operator status'],
        base,run,nodeAvailability:'online'});
      seenRuns.add(runKey);
    }
    for(const paused of (v.paused_missions||[])){
      const run=String(paused?.run||paused?.run_id||paused||'');
      const runKey=`${kernel}\u0000${run}`;
      if(!run||seenRuns.has(runKey)) continue;
      const exactState=String(paused?.status||paused?.reason||'');
      let mechanical=_mechanicalRunProjection(exactState,{source:'unsigned operator status'});
      if(mechanical.key==='unavailable') mechanical={key:'resource-paused',
        label:'Resource-paused',exactState,
        detail:'Node status places this run in its resource-paused collection.',
        source:'unsigned operator status'};
      const lifecycle=_verifiedPublicTaskForRun(kernel,run);
      cards.push({key:`paused:${kernel}:${run}`,
        task:String(paused?.task||lifecycle?.task||`Task run ${_missionRunLabel(run)}`),
        state:mechanical.key,mechanical,kernel,
        meta:[mechanical.detail,exactState?`exact state ${exactState}`:'',
          'unsigned operator status'].filter(Boolean),
        base,run,nodeAvailability:'online'});
      seenRuns.add(runKey);
    }
  }
  return S.kernelFocus?cards.filter((card)=>card.kernel===S.kernelFocus):cards;
}
// Full /status is intentionally scoped to authenticated or explicitly focused
// nodes. Global missions, personas, environments, and live work arrive through
// signed discovery/telemetry; polling every anonymous peer's rich status here
// would turn each hosted-UI viewer into a distributed projection storm.
function prefetchNodeStatuses(){
  const candidates=[...S.boots.keys()].map((key)=>{ const base=key==='@origin'?'':key;
    const focused=!!S.kernelFocus&&baseIsFocused(base);
    return {base,focused,credentialed:!!tokenFor(join(base,'status')),
      active:(S.activeModelCallsByBase?.get(key)||[]).length>0,
      priority:(S.activeModelCallsByBase?.get(key)||[]).length}; })
    .filter((row)=>shouldPrefetchNodeStatus(row));
  const window=selectMonitoringBases(candidates,{limit:NETWORK_LIMITS.monitoredBases,hardLimit:64});
  for(const base of window.bases){
    fetchNodeLiveStatus(base)
      .then(()=>{ renderMissions(); pollLiveArtifacts(); })
      .catch(()=>{});
    const row=candidates.find((item)=>item.base===base);
    if(row?.focused||row?.credentialed){
      fetchNodeStatus(base)
        .then(()=>{ renderMissions(); pollLiveArtifacts(); })
        .catch(()=>{});
    }
  }
}
function _openInputPersonaName(kernel,personaId,fallback=''){
  const exact=String(personaId||'');
  for(const row of S.recs.values()){
    if(String(row?._kernel||'')!==String(kernel||'')||String(row?.kind||'')!=='persona') continue;
    const did=String(row?.did||''), recordId=String(row?.record_id||'');
    if(String(row?.persona_id||'')===exact||did===exact||did.endsWith(`/persona/${exact}`)
        ||did===`did:personaos:${exact}`||recordId===exact) return String(row?.label||row?.name||fallback||exact);
  }
  return String(fallback||exact||'Persona');
}
function _openInputCandidateText(value){
  try{ return String(structuredInlineText(value)||canon(value)).slice(0,1600); }
  catch(_){ return String(value??'').slice(0,1600); }
}
function _openInputCandidateRows(item,kernel){
  const all=Array.isArray(item?.contributions)?item.contributions:[];
  const preferred=String(item?.preferred_contribution_id||'');
  const visible=all.slice(-4);
  const preferredRow=all.find((row)=>row?.contribution_id===preferred);
  if(preferredRow&&!visible.includes(preferredRow)) visible.unshift(preferredRow);
  if(!visible.length) return `<p class="input-request-readonly">No response candidates yet. Active personas can inspect this signed request and contribute independently.</p>`;
  return `<div class="input-request-candidates"><strong>${all.length} candidate response${all.length===1?'':'s'} · preserved separately</strong>`
    +visible.map((candidate)=>{ const isPreferred=candidate.contribution_id===preferred;
      const source=candidate.source_kind==='owner_human'?'Authenticated owner':_openInputPersonaName(kernel,candidate.contributor_id,candidate.contributor_name);
      const at=Date.parse(String(candidate.created_at||''));
      return `<article class="input-candidate${isPreferred?' is-preferred':''}"><span><b>${esc(source)}</b>`
        +`<i>${Number.isFinite(at)?esc(_ago(at)):''}${isPreferred?' · <em class="input-precedence">consider first</em>':''}</i></span>`
        +`<p>${esc(_openInputCandidateText(candidate.value))}</p></article>`; }).join('')
    +`<p class="input-request-readonly">Owner-human precedence controls which candidate is considered first. It does not prove correctness, satisfy the request's acceptance criteria, or complete the task.</p></div>`;
}
function renderOpenInputs(){
  const host=$('#openInputs'), cardsHost=$('#openInputCards'), count=$('#openInputCount'), headline=$('#openInputHeadline');
  if(!host||!cardsHost) return;
  const now=Date.now(), rows=[];
  for(const directory of S.openInputDirectories.values()){
    if(now-Number(directory.receivedAt||0)>45000) continue;
    if(S.kernelFocus&&directory.kernelId!==S.kernelFocus) continue;
    for(const item of (directory.record?.requests||[])) rows.push({directory,item});
  }
  rows.sort((a,b)=>{
    const openDelta=Number(b.item.status==='open')-Number(a.item.status==='open');
    if(openDelta) return openDelta;
    return String(b.item.request?.created_at||'').localeCompare(String(a.item.request?.created_at||''));
  });
  const query=String(S.q||'').trim().toLowerCase();
  const filtered=query?rows.filter(({directory,item})=>{
    const request=item.request||{};
    return `${request.title||''} ${request.question||''} ${request.why_needed||''} ${request.author_persona_id||''} ${request.environment_id||''} ${request.task_id||''} ${directory.kernelId||''}`.toLowerCase().includes(query);
  }):rows;
  host.hidden=!rows.length;
  if(!rows.length){ cardsHost.replaceChildren(); cardsHost.dataset.h=''; return; }
  const openCount=rows.filter(({item})=>item.status==='open').length;
  if(count) count.textContent=`${openCount} open · ${rows.length} total`;
  if(headline) headline.textContent=openCount
    ?`${openCount} request${openCount===1?'':'s'} waiting for evidence`
    :'No open requests; signed history retained';
  if(!host.dataset.initialized){ host.open=openCount>0; host.dataset.initialized='1'; }
  const html=filtered.slice(0,48).map(({directory,item})=>{
    const request=item.request||{}, kernel=directory.kernelId;
    const author=_openInputPersonaName(kernel,request.author_persona_id,item.author_display_name);
    const at=Date.parse(String(request.created_at||''));
    const criteria=(()=>{ try{return canon(request.acceptance_criteria);}catch(_){return '';} })();
    const responseSchema=(()=>{ try{return canon(request.response_schema);}catch(_){return '';} })();
    const audience=request.visibility==='environment'
      ?'environment audience · publicly visible from this node'
      :'public audience';
    return `<article class="input-request-card${item.status==='open'?'':' is-closed'}">`
      +`<header><div><span class="input-request-kicker">${esc(author)} is asking</span><h3>${esc(request.title)}</h3></div><span class="input-request-state">${esc(item.status)}</span></header>`
      +`<p class="input-request-question">${esc(request.question)}</p>`
      +`<p class="input-request-why"><b>Why it matters now</b><br>${esc(request.why_needed)}</p>`
      +`<div class="input-request-meta"><span>${esc(author)}</span><span>${Number.isFinite(at)?esc(_ago(at)):'signed time unavailable'}</span><span>${esc(String(item.contributions?.length||0))} candidates</span><span>${esc(audience)}</span><span>kernel signature verified</span></div>`
      +_openInputCandidateRows(item,kernel)
      +`<details class="verification-identity"><summary>Requested response and acceptance contract</summary><div class="copy-host">${copyBtn()}<pre class="ct-pre copy-src">${esc(`Response schema\n${responseSchema}\n\nAcceptance criteria\n${criteria}`)}</pre></div></details>`
      +`<p class="input-request-readonly">All records exposed by this public node are public. Human response submission is temporarily disabled in this browser surface; signed personas may inspect and contribute through their authenticated action surface.</p></article>`;
  }).join('')||`<div class="mission-no-match">No open input request matches this network filter.</div>`;
  if(cardsHost.dataset.h!==html){ cardsHost.dataset.h=html; cardsHost.innerHTML=html; }
}
async function refreshVisibleOpenInputs(){
  const candidates=[];
  for(const [key,boot] of S.boots){
    const base=key==='@origin'?'':key;
    if(!boot?.open_inputs_url) continue;
    candidates.push({base,boot,priority:Number(boot.kernel_id===S.kernelFocus)});
  }
  candidates.sort((a,b)=>b.priority-a.priority);
  await Promise.allSettled(candidates.slice(0,NETWORK_LIMITS.monitoredBases)
    .map(({base,boot})=>refreshOpenInputDirectory(base,boot)));
  renderOpenInputs();
}
function renderMissions(){
  const box=$('#missions'), wrap=$('#missionCards'), count=$('#missionCount'), headline=$('#missionHeadline'),
    eyebrow=$('#missionEyebrow'); if(!box||!wrap) return;
  const cards=missionCardList();
  box.hidden=!cards.length;
  if(!cards.length){ if(wrap.dataset.h){ wrap.dataset.h=''; wrap.replaceChildren(); } return; }
  const window=selectPriorityWindow(cards,{query:S.q||'',limit:24,keyOf:(c)=>c.key,
    priorityOf:(c)=>missionCardIsObservedCurrent(c)?1:0,
    searchTextOf:(c)=>`${c.task} ${c.state} ${c.kernel||''} ${(c.meta||[]).join(' ')}`});
  // A network-wide search can match a persona without matching its task text.
  // Keep the compact run summary useful in that case and render an explicit
  // empty filtered view instead of dereferencing an empty priority window.
  const active=window.items.find((c)=>missionCardIsObservedCurrent(c))||window.items[0]||null;
  const matching=window.items.length===cards.length
    ?`${cards.length} task/run record${cards.length===1?'':'s'}`
    :`${window.items.length} matching · ${cards.length} total`;
  if(count) count.textContent=active
    ?`${matching} · ${active.state}`
      +(active.nodeAvailability==='offline'?' · offline'
        :active.nodeAvailability==='unobserved'?' · not currently observed':'')
    :matching;
  const cached=!missionCardIsObservedCurrent(active)
    &&['offline','unobserved'].includes(active?.nodeAvailability);
  if(headline) headline.textContent=missionCardIsObservedCurrent(active)
    ?active.task:cached?'Cached signed task/run evidence':active?'Mechanical task/run evidence':'No matching task or run';
  if(eyebrow) eyebrow.textContent=missionCardIsObservedCurrent(active)
    ?(S.kernelFocus?'CURRENT MECHANICAL RUN':'CURRENT NETWORK RUNS')
    :cached?'CACHED TASK/RUN EVIDENCE':'TASK AND RUN EVIDENCE';
  if(!box.dataset.initialized){ box.open=false; box.dataset.initialized='1'; }
  const stateClass=(value)=>String(value||'unknown').replace(/[^A-Za-z0-9_-]/g,'-').slice(0,80)||'unknown';
  const html=window.items.length?window.items.map((c)=>{
    return `<article class="mcard" role="button" tabindex="0"${c.recId?` data-mrec="${esc(c.recId)}"`:''}${c.run?` data-mrun="${esc(c.run)}" data-mbase="${esc(c.base||'')}"`:''}>`
      +`<div class="mission-state-dot ms-${stateClass(c.state)}"></div><div class="mission-copy"><span class="mstate ms-${stateClass(c.state)}">${esc(c.mechanical?.label||humanizeMachineKey(c.state))}</span>`
      +`<h2 class="mtask" title="${esc(c.title||c.task)}">${esc(c.task)}</h2><div class="mmeta">`
      +c.meta.filter(Boolean).map((m)=>`<span>${esc(m)}</span>`).join('')+`</div></div><span class="mission-open">${icon('chevron')}</span></article>`;
  }).join('')
    :`<div class="mission-no-match">No task or run evidence matches this network filter.</div>`;
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
  // tools default to open where there is room for them (the search, vitals and
  // public-data surface), closed on narrow screens; an explicit viewer choice
  // persists across reloads like the collapse key does
  const toolsPref=()=>{ try{ return localStorage.getItem('personaos_header_tools'); }catch(e){ return null; } };
  const toolsDefaultOpen=()=>!!(window.matchMedia&&matchMedia('(min-width:1100px)').matches);
  setHeaderToolsOpen(toolsPref()!==null?toolsPref()==='1':toolsDefaultOpen());
  headerToolsToggle?.addEventListener('click',()=>{
    const open=!header.classList.contains('tools-open'); setHeaderToolsOpen(open);
    try{ localStorage.setItem('personaos_header_tools',open?'1':'0'); }catch(e){} });
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
    if(e.target.closest('summary')) return;
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
    renderGlobalKernels(); renderMissions(); renderOpenInputs(); refreshSystemView(); discover().catch(()=>{});
  });
  $('#networkAll')?.addEventListener('click',()=>{ S.kernelFocus=null; S.follow=null;
    S.environmentWindow=NETWORK_LIMITS.environmentInitial; S.personaWindows.clear();
    renderGlobalKernels(); renderMissions(); renderOpenInputs(); refreshSystemView(); });
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
    // Verification disclosures inside a persona card are independently
    // interactive; opening one must not also navigate away to the card drawer.
    const disclosure=e.target.closest('details');
    if(disclosure&&!e.target.closest('[data-live-current-file],[data-current-artifact-path],[data-artid],[data-envrec],[data-live-output-run]')){
      e.stopPropagation(); return;
    }
    const liveFile=e.target.closest('[data-live-current-file]'); if(liveFile){ e.preventDefault(); e.stopPropagation();
      S._topIsOp=false; S._lastFocus=document.activeElement; markInspectionSource(liveFile);
      S.views=[()=>liveFileView(liveFile.dataset.liveFileBase||'',liveFile.dataset.liveFileRun,
        liveFile.dataset.liveFileWorkspace,liveFile.dataset.liveFilePath)];
      $('#detailwrap').classList.add('open'); renderTop(); return; }
    const currentFile=e.target.closest('[data-current-artifact-path]'); if(currentFile){ e.preventDefault(); e.stopPropagation();
      const size=currentFile.dataset.currentArtifactSize;
      const companionScope=currentFile.closest('.artifact-file-groups,.owned-outputs')||currentFile.parentElement;
      const companionFiles=[...(companionScope?.querySelectorAll('[data-current-artifact-path]')||[])]
        .filter((candidate)=>candidate!==currentFile)
        .map((candidate)=>({
          path:candidate.dataset.currentArtifactTitle||'',
          bodyPath:candidate.dataset.currentArtifactPath||'',
          mediaKind:candidate.dataset.currentArtifactKind||'',
          contentHash:candidate.dataset.currentArtifactHash||'',
          size:candidate.dataset.currentArtifactSize!==''&&Number.isFinite(Number(candidate.dataset.currentArtifactSize))
            ?Number(candidate.dataset.currentArtifactSize):null,
          authoredLabels:artifactSemanticsFromAttr(candidate.dataset.currentArtifactSemantics),
          declaration:artifactDeclarationFromAttr(candidate.dataset.currentArtifactDeclaration),
        }));
      const options={contentHash:currentFile.dataset.currentArtifactHash||null,
        size:size!==''&&Number.isFinite(Number(size))?Number(size):null,
        authoredLabels:artifactSemanticsFromAttr(currentFile.dataset.currentArtifactSemantics),
        artifactDeclaration:artifactDeclarationFromAttr(currentFile.dataset.currentArtifactDeclaration),companionFiles};
      S._topIsOp=false; S._lastFocus=document.activeElement; markInspectionSource(currentFile);
      S.views=[()=>fileView(currentFile.dataset.currentArtifactBase||'',currentFile.dataset.currentArtifactPath,
        currentFile.dataset.currentArtifactTitle,currentFile.dataset.currentArtifactKind,options)];
      $('#detailwrap').classList.add('open'); renderTop(); return; }
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
      renderGlobalKernels(); refreshSystemView(); renderInteractionStream(); renderOpenInputs();
      // A resolver-backed global search must reach beyond the sampled first page.
      // Do not re-fetch and re-verify a large provider inventory when the signed
      // record is already cached locally: the bounded stage selector can surface
      // that match directly. Empty queries also never need a resolver lookup.
      // The discovery pass remains bounded and is ignored while another is active.
      if(S.q&&!loadedMatch&&!S.kernelFocus&&globalDiscoveryEndpoints().length) discover().catch(()=>{});
    },120); });
  // PUBLIC DATA is a toggle: a second click closes the read drawer it opened. We tag the
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
  // Missions strip → open the signed mission record or its public run monitor.
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
    if(act==='op-node'){ pushView(()=>operatorNodeView(a.dataset.base)); return; }
    if(act==='op-run'){ pushView(()=>operatorRunView(a.dataset.base,a.dataset.run)); return; }
    if(act==='rec') pushView(()=>viewFor(a.dataset.id));
    else if(act==='live-file') pushView(()=>liveFileView(base,a.dataset.run,a.dataset.workspace,a.dataset.path));
    else if(act==='file'){ const o={contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null,
        authoredLabels:artifactSemanticsFromAttr(a.dataset.semantics),
        artifactDeclaration:artifactDeclarationFromAttr(a.dataset.declaration)};
      pushView(()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,o)); }
    else if(act==='fv-raw'){ // swap the CURRENT file view to forced plain text (re-render in place)
      if(a.dataset.live==='1'&&S.openLiveFile){ S.liveRawModes=S.liveRawModes||new Map(); S.liveRawModes.set(S.openLiveFile.bodyKey,true); renderTop(); }
      else { S.views[S.views.length-1]=()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,{raw:true,contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null,authoredLabels:artifactSemanticsFromAttr(a.dataset.semantics),artifactDeclaration:artifactDeclarationFromAttr(a.dataset.declaration)}); renderTop(); } }
    else if(act==='fv-rich'){ // swap back to the rich media renderer
      if(a.dataset.live==='1'&&S.openLiveFile){ S.liveRawModes=S.liveRawModes||new Map(); S.liveRawModes.set(S.openLiveFile.bodyKey,false); renderTop(); }
      else { S.views[S.views.length-1]=()=>fileView(base,a.dataset.path,a.dataset.title,a.dataset.kind,{contentHash:a.dataset.hash||null,size:a.dataset.size?+a.dataset.size:null,authoredLabels:artifactSemanticsFromAttr(a.dataset.semantics),artifactDeclaration:artifactDeclarationFromAttr(a.dataset.declaration)}); renderTop(); } }
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
    S._renderGen=(S._renderGen||0)+1;
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
// Every browser attempts the peer transport.  Keep the fallback decision aware
// of that attempt before the asynchronously imported transport can populate
// `P2P`; the bounded strategy deadline still prevents a failed import or dead
// bootstrap from holding an empty roster indefinitely.
let _p2pStartupExpected=true;
let _p2pStartupSettled=false;
function updateP2PStatus(){ const el=$('#p2p'); if(!el) return; const n=P2P&&P2P.node;
  const peers=n&&n.getConnections?new Set(n.getConnections()
    .map((connection)=>connection.remotePeer?.toString?.()).filter(Boolean)).size:0;
  const routes=S.p2pDataRoutes?.size||0;
  el.dataset.verifiedRoutes=String(routes);
  const detail=n?`libp2p ${n.peerId.toString()} · ${peers} connected peer${peers===1?'':'s'} · ${routes} verified route${routes===1?'':'s'}`:'HTTP federation discovery';
  el.title=detail; el.setAttribute('aria-label',`Network connectivity: ${detail}`);
  el.textContent=n?`Network · ${peers} peer${peers===1?'':'s'}${routes?` · ${routes} verified route${routes===1?'':'s'}`:''}`:'Network · web discovery'; }
function _scheduleP2PRendezvous(delayMs){
  if(!P2P?._rendezvousConfigured||!P2P.node||P2P._rendezvousTimer
      ||P2P._rendezvousActive) return;
  P2P._rendezvousTimer=setTimeout(async()=>{
    P2P._rendezvousTimer=null; P2P._rendezvousActive=true;
    let verified=false;
    try{ verified=await refreshP2PRendezvous(); }catch(e){}
    finally{
      P2P._rendezvousFirstAttemptCompleted=true;
      P2P._rendezvousActive=false;
      if(verified||P2P._rendezvousLastVerifiedAt){
        P2P._rendezvousColdAttempts=0;
        _scheduleP2PRendezvous(P2P_ROUTE_LIMITS.steadyRefreshMs);
      }else{
        const attempt=Number(P2P._rendezvousColdAttempts)||0;
        P2P._rendezvousColdAttempts=Math.min(2,attempt+1);
        _scheduleP2PRendezvous(Math.min(P2P_ROUTE_LIMITS.coldRetryMaxMs,
          P2P_ROUTE_LIMITS.coldRetryBaseMs*(2**attempt)));
      }
    }
  },delayMs);
}
function _ensureP2PRendezvousSchedule(){
  if(!P2P?.node) return;
  P2P._rendezvousConfigured=true;
  // The temporal CIDs and bounded first-contact peers are already available
  // when the browser node starts. Begin that first scan in the next task;
  // retain the multi-second exponential delay only for an actual cold miss.
  _scheduleP2PRendezvous(P2P_ROUTE_LIMITS.initialRefreshMs);
}
function _p2pBootstrapDialState(multiaddr){
  let state=S.p2pDialStates.get(multiaddr);
  if(state) return state;
  if(S.p2pDialStates.size>=P2P_BOOTSTRAP_LIMITS.maxKnown) return null;
  state={queued:false,active:false,retry:false,nextAt:0,attempts:0,peerId:''};
  S.p2pDialStates.set(multiaddr,state); return state;
}
function _scheduleP2PBootstrapRetries(){
  if(S.p2pDialRetryTimer){ clearTimeout(S.p2pDialRetryTimer); S.p2pDialRetryTimer=null; }
  let nextAt=Infinity;
  for(const state of S.p2pDialStates.values()) if(state.retry&&!state.queued&&!state.active)
    nextAt=Math.min(nextAt,state.nextAt);
  if(!Number.isFinite(nextAt)) return;
  S.p2pDialRetryTimer=setTimeout(()=>{
    S.p2pDialRetryTimer=null; const now=Date.now();
    for(const [multiaddr,state] of S.p2pDialStates)
      if(state.retry&&!state.queued&&!state.active&&state.nextAt<=now)
        _queueP2PBootstrapDial(multiaddr);
    _pumpP2PBootstrapDials(); _scheduleP2PBootstrapRetries();
  },Math.max(0,nextAt-Date.now()));
}
function _primeInitialP2PBootstrapDial(multiaddr){
  const state=_p2pBootstrapDialState(multiaddr); if(!state) return;
  // The libp2p bootstrap plugin gets the first attempt. Schedule a direct dial
  // as a bounded fallback because that plugin does not expose per-address
  // success/failure to this module.
  state.retry=true;
  state.nextAt=Date.now()+P2P_BOOTSTRAP_LIMITS.dialTimeoutMs;
  _scheduleP2PBootstrapRetries();
}
function _queueP2PBootstrapDial(multiaddr){
  if(!P2P?.dialBootstrap) return;
  const state=_p2pBootstrapDialState(multiaddr); if(!state||state.queued||state.active) return;
  const now=Date.now();
  if(state.nextAt>now){ if(state.retry) _scheduleP2PBootstrapRetries(); return; }
  if(state.peerId&&P2P.node.getConnections().some((connection)=>
      connection.remotePeer?.toString?.()===state.peerId)){
    // A successful bootstrap is a renewable lease, not a reason to redial an
    // already connected peer every minute. Keep the bounded liveness check
    // armed so a later disconnect remains recoverable.
    state.retry=true;
    state.nextAt=now+P2P_BOOTSTRAP_LIMITS.successfulRedialMs;
    _scheduleP2PBootstrapRetries(); return;
  }
  if(S.p2pDialQueue.length>=P2P_BOOTSTRAP_LIMITS.maxQueue){
    state.retry=true; state.nextAt=now+250; _scheduleP2PBootstrapRetries(); return;
  }
  state.queued=true; state.retry=false;
  S.p2pDialQueue.push(multiaddr); _pumpP2PBootstrapDials();
}
function _pumpP2PBootstrapDials(){
  while(P2P?.dialBootstrap&&S.p2pDialActive<P2P_BOOTSTRAP_LIMITS.maxConcurrent
      &&S.p2pDialQueue.length){
    const multiaddr=S.p2pDialQueue.shift(), state=_p2pBootstrapDialState(multiaddr);
    if(!state) continue;
    state.queued=false; state.active=true; S.p2pDialActive++;
    // Promise.resolve places both multiaddr parsing and node.dial inside the
    // rejection boundary. A malformed locator can never strand an active slot.
    Promise.resolve().then(()=>P2P.dialBootstrap(multiaddr,
      {signal:AbortSignal.timeout(P2P_BOOTSTRAP_LIMITS.dialTimeoutMs)}))
      .then((connection)=>{
        state.attempts=0; state.retry=true;
        state.peerId=connection?.remotePeer?.toString?.()||state.peerId;
        state.nextAt=Date.now()+P2P_BOOTSTRAP_LIMITS.successfulRedialMs;
        log('p2p','new browser bootstrap connected',true);
        updateP2PStatus(); _ensureP2PRendezvousSchedule();
      })
      .catch((error)=>{
        state.attempts=Math.min(16,state.attempts+1); state.retry=true;
        const factor=2**Math.min(6,state.attempts-1);
        state.nextAt=Date.now()+Math.min(P2P_BOOTSTRAP_LIMITS.retryMaxMs,
          P2P_BOOTSTRAP_LIMITS.retryBaseMs*factor);
        log('p2p',`bootstrap dial failed: ${String(error&&error.message||error).slice(0,100)}`,false);
      })
      .finally(()=>{
        state.active=false; S.p2pDialActive--;
        _pumpP2PBootstrapDials(); _scheduleP2PBootstrapRetries();
      });
  }
}
function _rearmDisconnectedP2PBootstrap(peerId){
  if(!P2P?.dialBootstrap) return;
  const exact=String(peerId||''), now=Date.now(); let matched=false;
  for(const [multiaddr,state] of S.p2pDialStates){
    if(exact&&state.peerId!==exact) continue;
    matched=true; state.retry=true; state.nextAt=now;
    _queueP2PBootstrapDial(multiaddr);
  }
  // The bootstrap plugin can establish a connection before the direct fallback
  // records its peer id. If the browser has lost every connection, re-arm every
  // admitted generic route; queue and concurrency ceilings still apply.
  if(!matched&&!P2P.node.getConnections().length){
    for(const multiaddr of S.p2pBootstraps){
      const state=_p2pBootstrapDialState(multiaddr); if(!state) continue;
      state.retry=true; state.nextAt=now; _queueP2PBootstrapDial(multiaddr);
    }
  }
  _pumpP2PBootstrapDials(); _scheduleP2PBootstrapRetries();
}
async function maintainP2PBootstrapConnectivity(){
  if(!P2P?.dialBootstrap||P2P.node.getConnections().length) return;
  // A strict bare hosted page has no node URL or resolver. Re-admit already
  // known routes immediately, then reload the same-origin replaceable transport
  // commons so one transient startup fetch cannot strand the browser forever.
  rememberP2PBootstraps([[...S.p2pBootstraps]],{dial:true});
  await loadPortalP2PBootstrapHints({dial:true});
}
const PROVIDER_HINT_LIMITS=Object.freeze({maxPending:64,maxQueue:16,maxJobsPerMinute:16,
  maxConcurrent:2,maxKeysPerHint:5,maxRouteHints:64,cooldownMs:30000});
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
function _rememberP2PRouteHint(base){
  S.gossipPeers.delete(base); S.gossipPeers.add(base);
  while(S.gossipPeers.size>PROVIDER_HINT_LIMITS.maxRouteHints)
    S.gossipPeers.delete(S.gossipPeers.values().next().value);
}
function _registerP2PDataRoute(hint,rows=[]){
  const base=opBaseKey(hint?.base||''), providerRecord=hint?.providerRecord;
  if(!base||!providerRecord||providerRecord.provider_peer_id!==hint.peerId) return false;
  const routes=S.p2pDataRoutes=S.p2pDataRoutes||new Map();
  routes.delete(base); routes.set(base,{providerRecord,kernel:hint.kernel,peerId:hint.peerId});
  while(routes.size>NETWORK_LIMITS.cachedKernels){
    const victim=routes.keys().next().value;
    if(victim===base&&routes.size===1) break;
    routes.delete(victim);
    const stream=S.streams.get(`p2p:${victim}`);
    try{ stream?.close?.(); }catch(e){} S.streams.delete(`p2p:${victim}`);
  }
  const artifacts=S.p2pArtifactHashes=S.p2pArtifactHashes||new Map();
  for(const row of rows){
    const rel=String(row?._links?.content||''), hash=String(
      row?._links?.content_hash||row?.content_hash||'').toLowerCase();
    if(row?.kind!=='artifact'||!rel||!/^sha256:[0-9a-f]{64}$/.test(hash)) continue;
    let url=join(base,rel); try{ url=new URL(url,location.href).href; }catch(_){ continue; }
    artifacts.set(url,hash);
  }
  while(artifacts.size>NETWORK_LIMITS.cachedRecords)
    artifacts.delete(artifacts.keys().next().value);
  return true;
}
async function _discoverFromP2P(hint,{signal=null}={}){
  const p=hint?.providerRecord||{}, base=String(hint?.base||'').replace(/\/$/,'');
  if(!P2P?.fetchPublicJson||!base||p.host_kernel_id!==hint.kernel
      ||p.provider_peer_id!==hint.peerId) return {boot:null,found:[],inventory:null};
  const keysDoc=await settleBeforeAbort(P2P.fetchPublicJson(p,'.well-known/personaos-keys.json',
    {timeoutMs:6000,maxBytes:1024*1024}).catch(()=>null),signal,null);
  if(signal?.aborted||!keysDoc) return {boot:null,found:[],inventory:null};
  const boot=await settleBeforeAbort(P2P.fetchPublicJson(p,'.well-known/personaos-discovery.json',
    {timeoutMs:6000,maxBytes:1024*1024}).catch(()=>null),signal,null);
  if(signal?.aborted||!boot||boot.kernel_id!==hint.kernel
      ||keysDoc?.kernel_id!==hint.kernel) return {boot:null,found:[],inventory:null};
  const keys=admitKeysDocument(base,boot,keysDoc,{expectedMaster:p.public_key_hex});
  if(!keys['kernel-master']) return {boot:null,found:[],inventory:null};
  const advertisedRecordCount=Number(boot.record_count);
  const providerIndexMaxBytes=providerIndexResponseByteLimit(
    advertisedRecordCount,NETWORK_LIMITS.cachedRecords);
  if(!providerIndexMaxBytes) return {boot:null,found:[],inventory:null};
  const providerPath=String(boot.providers_url||'discovery/public/providers.json');
  const providerUrl=join(base,providerPath);
  const providerPromise=sharedDocumentJson(providerUrl,
    ()=>P2P.fetchPublicJson(p,providerPath,{timeoutMs:8000,maxBytes:providerIndexMaxBytes}).catch(()=>null));
  // The peer-bound transport carries the same signed compact identity surface
  // as HTTP. Admit it first so P2P discovery paints people/workspaces and seeds
  // the warm browser cache without waiting for every artifact and telemetry
  // signature in the complete inventory.
  if(boot.identity_index_url){
    const identityPath=String(boot.identity_index_url);
    // A DHT scan can discover a correct provider at the very end of its own
    // bounded deadline. Do not let that exhausted scan signal cancel the small
    // identity read or its durable warm cache. The independent job remains
    // bounded and can finish after full-inventory reconciliation has resumed.
    const identityWork=(async()=>{
      const identitySignal=AbortSignal.timeout(6000);
      const usableIdentity=(promise)=>promise.then((value)=>{
        if(!value) throw new Error('identity route unavailable');
        return value;
      });
      // Race the peer-bound data stream with the node's direct HTTPS route.
      // Both carry the identical current-master-signed document and pass the
      // same verification; neither is a locator or an identity authority.
      const identityUrl=join(base,identityPath);
      const directIdentity=(async()=>{
        const response=await fetch(identityUrl,secureFetchInit(identityUrl,{signal:identitySignal}));
        if(!response.ok) return null;
        const bytes=await readBoundedResponseBytes(response,2*1024*1024);
        return JSON.parse(new TextDecoder().decode(bytes));
      })().catch(()=>null);
      const identityDoc=await Promise.any([
        usableIdentity(P2P.fetchPublicJson(p,identityPath,
          {timeoutMs:6000,maxBytes:2*1024*1024}).catch(()=>null)),
        usableIdentity(directIdentity),
      ]).catch(()=>null);
      if(identityDoc)
        await admitVerifiedIdentityIndex(identityDoc,base,boot,base,{transport:'p2p'});
      else log('identity',`${boot.kernel_id}: compact signed identity route unavailable; full inventory continues`,false);
    })().catch(()=>{});
    // A healthy compact route normally wins in hundreds of milliseconds. A
    // broken route gets only this small head start; it cannot hold the complete
    // signed inventory behind its full transport timeout.
    await Promise.race([identityWork,new Promise((resolve)=>setTimeout(resolve,1000))]);
  }else log('identity',`${boot.kernel_id}: compact signed identity route not advertised; full inventory continues`,false);
  const providerIndex=await settleBeforeAbort(providerPromise,signal,null);
  if(signal?.aborted||!providerIndex
      ||Number(providerIndex.document_count)!==advertisedRecordCount)
    return {boot:null,found:[],inventory:null};
  const verified=await verifiedRowsFromProviderIndex(
    providerIndex,base,boot,'internet','p2p provider',{signal});
  const found=[...new Map(verified.rows.map((row)=>[
    `${row._kernel||boot.kernel_id}\u0000${row.record_id||row.did}`,row])).values()];
  const inventory={...(verified.inventory||{}),complete:verified.inventory?.ok===true
    &&verified.refused===0
    &&new Set(found.map((row)=>row.record_id)).size===verified.inventory.recordIds?.size};
  if(!inventory.complete) return {boot:null,found:[],inventory};
  _registerP2PDataRoute(hint,found);
  return {boot,found,inventory,providerIndex};
}
function _reconcileP2PRouteHint(hint,{signal=null}={}){
  const {base,kernel}=hint;
  const id=`${kernel}\u0000${base}`;
  const active=S.providerRouteReconciliations.get(id);
  if(active) return active;
  const work=(async()=>{
    // Prefer the peer-bound public-data protocol. Its bootstrap and key registry
    // are anchored to the self-certifying master in the already verified
    // ProviderRecord; the complete inventory still passes the same manifest,
    // chain, document and policy verification as HTTP before promotion.
    let resolved=await _discoverFromP2P(hint,{signal});
    if(!resolved.boot&&!signal?.aborted){
      resolved=await discoverFrom(base,'internet',null,
        {expectedKernel:kernel,resolveProviderAliases:false,signal});
    }
    if(signal?.aborted||!resolved.boot) return {accepted:false,count:0};
    const accepted=applyVerifiedProviderInventory(
      base,resolved.boot,resolved.found,resolved.inventory,resolved.providerIndex);
    if(!accepted) return {accepted:false,count:0};
    S.boots.set(base||'@origin',resolved.boot);
    _rememberP2PRouteHint(base);
    updateP2PStatus();
    collectP2PBootstraps(resolved.boot,{dial:true});
    noteKernel(kernel,'p2p',base,{reachable:true});
    await loadTelemetry(base,{signal,boot:resolved.boot});
    if(!signal?.aborted) connectDiscoveryStream(base,resolved.boot);
    return {accepted:true,count:resolved.found.length};
  })();
  S.providerRouteReconciliations.set(id,work);
  return work.finally(()=>{
    if(S.providerRouteReconciliations.get(id)===work)
      S.providerRouteReconciliations.delete(id);
  });
}
async function _resolveProviderHintJob(job){
  const controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),P2P_ROUTE_LIMITS.jobDeadlineMs);
  try{
    const results=await Promise.all(job.hints.map((key)=>
      P2P.resolveProvider(key,{timeoutMs:5000}).catch(()=>null)));
    const routeHints=[];
    for(const result of results){
      if(controller.signal.aborted) break;
      const verified=await verifiedRouteHintsFromP2PResult(
        result,{signal:controller.signal});
      routeHints.push(...verified.routeHints);
    }
    const unique=new Map();
    for(const routeHint of routeHints){
      const base=normalizedHttpsBase(routeHint?.base), kernel=String(routeHint?.kernel||'');
      if(base&&kernel) unique.set(`${kernel}\u0000${base}`,{...routeHint,base,kernel});
      if(unique.size>=P2P_ROUTE_LIMITS.maxReconciliationsPerJob) break;
    }
    let reconciledRoutes=0, reconciledRecords=0;
    for(const hint of unique.values()){
      if(controller.signal.aborted) break;
      const reconciled=await _reconcileP2PRouteHint(
        hint,{signal:controller.signal});
      if(reconciled.accepted){
        reconciledRoutes++; reconciledRecords+=reconciled.count;
      }
    }
    if(reconciledRoutes){
      log('p2p',`${job.source}: ${reconciledRoutes} verified route(s) · ${reconciledRecords} signed inventory record(s) reconciled`,true);
      classifyMap(); updateVitalsCounters(); refreshSystemView(); renderMissions(); refreshLiveSection(); }
    else log('p2p',`${job.source}: provider route unresolved; nothing displayed`,false);
  }finally{ clearTimeout(deadline); }
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
  // Raw gossip contributes bounded lookup aliases only. The transport reports
  // a separately verified, peer-bound envelope through onVerifiedProvider.
  if(doc?.record) queueProviderHints(doc.record,'libp2p gossip');
}
async function _runVerifiedGossipJob(job){
  const controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),P2P_ROUTE_LIMITS.jobDeadlineMs);
  try{
    const reconciled=await _reconcileP2PRouteHint(job.hint,{signal:controller.signal});
    if(!reconciled.accepted) return;
    log('p2p',`verified gossip: 1 route · ${reconciled.count} signed inventory record(s) reconciled`,true);
    classifyMap(); updateVitalsCounters(); refreshSystemView(); renderMissions(); refreshLiveSection();
  }finally{ clearTimeout(deadline); }
}
function _pumpVerifiedGossipJobs(){
  while(S.verifiedGossipActive<PROVIDER_HINT_LIMITS.maxConcurrent
      &&S.verifiedGossipQueue.length){
    const job=S.verifiedGossipQueue.shift(); S.verifiedGossipActive++;
    S.verifiedGossipJobs.set(job.id,{state:'running',at:Date.now()});
    _runVerifiedGossipJob(job)
      .catch((e)=>log('p2p',`verified gossip route failed ${String(e&&e.message||e).slice(0,100)}`,false))
      .finally(()=>{ S.verifiedGossipActive--;
        S.verifiedGossipJobs.set(job.id,{state:'done',at:Date.now()});
        _pumpVerifiedGossipJobs(); });
  }
}
function _enqueueVerifiedGossipHint(hint){
  const base=normalizedHttpsBase(hint?.base),kernel=String(hint?.kernel||''),
    peerId=String(hint?.peerId||''),provider=hint?.providerRecord||{};
  if(!base||!kernel||!peerId) return;
  const id=`${kernel}\u0000${base}\u0000${peerId}`,now=Date.now(),
    generation=Number(provider.inventory_generation)||0,
    manifestHash=String(provider.inventory_manifest_hash||''),
    prior=S.verifiedGossipAttempts.get(id),active=S.verifiedGossipJobs.get(id);
  if(active&&(active.state==='queued'||active.state==='running')) return;
  if(prior&&prior.generation===generation&&prior.manifestHash===manifestHash
      &&now-prior.at<P2P_ROUTE_LIMITS.verifiedGossipRetryMs) return;
  S.verifiedGossipWindow=S.verifiedGossipWindow.filter((at)=>now-at<60000);
  if(S.verifiedGossipWindow.length>=PROVIDER_HINT_LIMITS.maxJobsPerMinute
      ||S.verifiedGossipQueue.length>=PROVIDER_HINT_LIMITS.maxQueue){
    log('gossip','verified route work limit reached; route deferred',false); return; }
  S.verifiedGossipWindow.push(now);
  S.verifiedGossipAttempts.delete(id);
  S.verifiedGossipAttempts.set(id,{at:now,generation,manifestHash});
  while(S.verifiedGossipAttempts.size>P2P_ROUTE_LIMITS.maxRememberedProviders)
    S.verifiedGossipAttempts.delete(S.verifiedGossipAttempts.keys().next().value);
  S.verifiedGossipJobs.set(id,{state:'queued',at:now});
  while(S.verifiedGossipJobs.size>256)
    S.verifiedGossipJobs.delete(S.verifiedGossipJobs.keys().next().value);
  S.verifiedGossipQueue.push({id,hint:{...hint,base,kernel,peerId}});
  _pumpVerifiedGossipJobs();
}
async function onVerifiedGossipProvider(result){
  const verified=await verifiedRouteHintsFromP2PResult(result);
  const unique=new Map();
  for(const hint of verified.routeHints){
    const base=normalizedHttpsBase(hint?.base),kernel=String(hint?.kernel||''),
      peerId=String(hint?.peerId||'');
    if(base&&kernel&&peerId) unique.set(`${kernel}\u0000${base}\u0000${peerId}`,
      {...hint,base,kernel,peerId});
    if(unique.size>=P2P_ROUTE_LIMITS.maxReconciliationsPerJob) break;
  }
  for(const hint of unique.values()) _enqueueVerifiedGossipHint(hint);
}
async function refreshP2PRendezvous(){
  if(!P2P?._rendezvousConfigured||!P2P.node?.contentRouting||!P2P.rendezvousCids) return false;
  if(P2P._rendezvousLastVerifiedAt
      &&Date.now()-P2P._rendezvousLastVerifiedAt<P2P_ROUTE_LIMITS.successfulRefreshMs) return true;
  const seen=P2P._rendezvousProvidersSeen||(P2P._rendezvousProvidersSeen=new Map());
  const recent=P2P._rendezvousProviderAttempts||(P2P._rendezvousProviderAttempts=new Map());
  const now=Date.now();
  for(const [routeKey,verifiedAt] of seen)
    if(now-verifiedAt>=P2P_ROUTE_LIMITS.successfulRefreshMs) seen.delete(routeKey);
  for(const [routeKey,attemptedAt] of recent)
    if(now-attemptedAt>=P2P_ROUTE_LIMITS.providerRetryMs) recent.delete(routeKey);
  const buckets=(await P2P.rendezvousCids(now).catch(()=>[]))
    .filter((bucket)=>bucket?.cid)
    .slice(0,P2P_ROUTE_LIMITS.maxRendezvousBucketsPerRefresh);
  if(!buckets.length) return false;
  const signal=AbortSignal.timeout(P2P_ROUTE_LIMITS.jobDeadlineMs);
  const attemptedThisScan=new Set();
  const eagerProviderKeys=new Set(),eagerProviderJobs=new Set();
  let eagerProviderAttempts=0;
  let attempted=0,found=0,reconciledRoutes=0,reconciledRecords=0,queriedBuckets=0;
  const inspectProvider=async(provider,maxNewAttempts)=>{
    if(provider?.id?.equals?.(P2P.node.peerId)||signal.aborted) return 0;
    const providerId=provider?.id?.toString?.()||'';
    if(!providerId) return 0;
    const addresses=[...new Map((provider.multiaddrs||[])
      .map((target)=>[String(target||''),target])).values()]
      .filter((target)=>String(target||''))
      .slice(0,P2P_ROUTE_LIMITS.maxMultiaddrsPerProvider);
    let routeAttempts=0;
    for(const target of addresses){
      if(signal.aborted||routeAttempts>=maxNewAttempts) break;
      let terminal,dialTarget;
      try{
        const components=target.getComponents?.()||[]; terminal=components.at(-1);
        if(terminal?.name==='p2p'&&String(terminal.value||'')!==providerId) continue;
        dialTarget=terminal?.name==='p2p'?target:target.encapsulate(`/p2p/${providerId}`);
      }catch(_){ continue; }
      const routeKey=`${providerId}\u0000${String(target)}`;
      if(seen.has(routeKey)||recent.has(routeKey)||attemptedThisScan.has(routeKey)) continue;
      attemptedThisScan.add(routeKey); routeAttempts++; attempted++;
      recent.delete(routeKey); recent.set(routeKey,now);
      while(recent.size>P2P_ROUTE_LIMITS.maxRememberedProviders)
        recent.delete(recent.keys().next().value);
      try{
        const dialSignal=AbortSignal.any([signal,AbortSignal.timeout(5000)]);
        await P2P.node.dial(dialTarget,{signal:dialSignal});
        found++;
        const result=await P2P.fetchProviderInventory?.(
          provider,{timeoutMs:8000}).catch(()=>null);
        const verified=await verifiedRouteHintsFromP2PResult(
          result,{signal});
        const unique=new Map();
        for(const hint of verified.routeHints){
          const base=normalizedHttpsBase(hint?.base),kernel=String(hint?.kernel||'');
          if(base&&kernel) unique.set(`${kernel}\u0000${base}`,{...hint,base,kernel});
        }
        let routeVerified=false;
        for(const hint of unique.values()){
          if(signal.aborted
              ||reconciledRoutes>=P2P_ROUTE_LIMITS.maxReconciliationsPerJob) break;
          const reconciled=await _reconcileP2PRouteHint(hint,{signal});
          if(reconciled.accepted){
            reconciledRoutes++; reconciledRecords+=reconciled.count; routeVerified=true;
          }
        }
        if(routeVerified){
          seen.delete(routeKey); seen.set(routeKey,Date.now());
          while(seen.size>P2P_ROUTE_LIMITS.maxRememberedProviders)
            seen.delete(seen.keys().next().value);
          break;
        }
      }catch(e){}
    }
    return routeAttempts;
  };
  const inspectEagerProvider=(provider)=>{
    if(signal.aborted||reconciledRoutes>=P2P_ROUTE_LIMITS.maxReconciliationsPerJob
        ||eagerProviderAttempts>=P2P_ROUTE_LIMITS.maxRouteAttemptsPerSource) return;
    const providerId=provider?.id?.toString?.()||'', firstAddress=String(provider?.multiaddrs?.[0]||'');
    const key=`${providerId}\u0000${firstAddress}`;
    if(!providerId||!firstAddress||eagerProviderKeys.has(key)) return;
    eagerProviderKeys.add(key); eagerProviderAttempts++;
    const job=inspectProvider(provider,1).catch(()=>0)
      .finally(()=>eagerProviderJobs.delete(job));
    eagerProviderJobs.add(job);
  };
  try{
    // Give every adjacent temporal bucket a direct first-contact chance in
    // parallel. A sequential current-bucket traversal could consume the whole
    // job deadline exactly at an epoch rollover and starve the already
    // pre-published next bucket.
    const directBuckets=await Promise.all(buckets.map(async(bucket)=>({
      bucket,
      direct:await P2P.findRendezvousProviders?.(bucket.cid,{
        signal,timeoutMs:6000,maxProviders:P2P_ROUTE_LIMITS.maxCandidatesPerResolution,
        onProvider:inspectEagerProvider
      }).catch(()=>null)
    })));
    await Promise.allSettled([...eagerProviderJobs]);
    queriedBuckets=directBuckets.length;
    for(const {direct} of directBuckets){
      if(signal.aborted) break;
      let sourceAttempts=0,sourceCandidates=0;
      for(const provider of direct?.providers||[]){
        if(signal.aborted||sourceCandidates>=P2P_ROUTE_LIMITS.maxCandidatesPerResolution
            ||sourceAttempts>=P2P_ROUTE_LIMITS.maxRouteAttemptsPerSource
            ||reconciledRoutes>=P2P_ROUTE_LIMITS.maxReconciliationsPerJob) break;
        sourceCandidates++;
        sourceAttempts+=await inspectProvider(provider,
          P2P_ROUTE_LIMITS.maxRouteAttemptsPerSource-sourceAttempts);
      }
      if(reconciledRoutes>=P2P_ROUTE_LIMITS.maxReconciliationsPerJob) break;
    }
    // Direct first-contact queries merge live routes hidden by another
    // responder's stale K-provider window, but one verified direct route does
    // not prove that window is complete. Give iterative Kademlia its own
    // remaining bounded budget after every temporal bucket had a direct chance.
    for(const bucket of buckets){
      if(signal.aborted||reconciledRoutes>=P2P_ROUTE_LIMITS.maxReconciliationsPerJob) break;
      let sourceAttempts=0,sourceCandidates=0;
      try{
        for await(const provider of P2P.node.contentRouting.findProviders(bucket.cid,{signal})){
          if(signal.aborted||sourceCandidates>=P2P_ROUTE_LIMITS.maxCandidatesPerResolution
              ||sourceAttempts>=P2P_ROUTE_LIMITS.maxRouteAttemptsPerSource
              ||reconciledRoutes>=P2P_ROUTE_LIMITS.maxReconciliationsPerJob) break;
          sourceCandidates++;
          sourceAttempts+=await inspectProvider(provider,
            P2P_ROUTE_LIMITS.maxRouteAttemptsPerSource-sourceAttempts);
        }
      }catch(e){}
    }
    log('p2p',`DHT rendezvous scan: ${queriedBuckets} temporal bucket(s) · ${attempted} route(s) tried · ${found} dialed · ${reconciledRoutes} verified route(s)`,reconciledRoutes>0);
    if(reconciledRoutes){
      P2P._rendezvousLastVerifiedAt=Date.now();
      log('p2p',`rendezvous: ${reconciledRoutes} verified route(s) · ${reconciledRecords} signed inventory record(s) reconciled`,true);
    }
    return reconciledRoutes>0;
  }catch(e){
    if(!P2P._dhtNoted){ P2P._dhtNoted=true; log('p2p','DHT rendezvous unavailable through configured peers: '+String(e&&e.message||e),false); }
    return false;
  }
}
async function initP2P(){
  const params=new URLSearchParams(location.search);
  // HTTP discovery has already collected browser-eligible multiaddrs from every
  // admitted node and the global resolver. Re-fetching this static page's origin
  // as though it were a node produces a guaranteed 404 on bare hosted portals.
  // Viewer-supplied routes are explicit intent, so admit their eligible values
  // before learned hints can consume the bounded startup window.
  const explicit=collectBrowserLibp2pBootstraps({pageProtocol:location.protocol},
    boundedP2PBootstrapSource(params.getAll('relay')),
    boundedP2PBootstrapSource(params.getAll('bootstrap')));
  const list=collectBrowserLibp2pBootstraps({pageProtocol:location.protocol},
    explicit,S.p2pBootstraps)
    .slice(0,P2P_BOOTSTRAP_LIMITS.maxKnown);
  log('p2p','starting vendored libp2p — WebRTC + gossipsub; configured peers enable DHT rendezvous…');
  try{
    const mod=await import('./p2p-libp2p.js?v=20260803-persona-envelope-v30');
    P2P=await mod.startP2P({ bootstrapList:list,
      onLog:(t,m)=>{ log('p2p',t+' '+m, t==='peer:connect'||t==='peer:discovery'?true:undefined); updateP2PStatus(); },
      onRecord:onGossipRecord,
      onVerifiedProvider:onVerifiedGossipProvider });
    P2P.verifyGossipProviderEnvelope=mod.verifyGossipProviderEnvelope;
    P2P.dialBootstrap=(multiaddr,options)=>
      mod.dialP2PBootstrap(P2P.node,multiaddr,options);
    P2P.node.addEventListener('peer:disconnect',(event)=>{
      updateP2PStatus();
      _rearmDisconnectedP2PBootstrap(event.detail?.toString?.()||'');
    });
    for(const multiaddr of list) _primeInitialP2PBootstrapDial(multiaddr);
    P2P._rendezvousConfigured=list.length>0;
    updateP2PStatus();
    for(const id of S.order){ const r=S.recs.get(id);
      if(r._gossipHint?.record?.visibility_tier==='public') P2P.announce(r._gossipHint); }
    const pending=[...S.pendingProviderHints.values()]; S.pendingProviderHints.clear();
    for(const job of pending) _enqueueProviderHintJob(job);
    log('p2p', list.length ? `dialling ${list.length} relay/bootstrap peer(s)…`
      : 'libp2p running — no relay configured; add ?relay=<multiaddr> to reach other machines (a browser needs a relay/bootstrap to find peers)');
    if(list.length) _ensureP2PRendezvousSchedule();
    _pumpP2PBootstrapDials();
    if(list.length) Promise.resolve().then(()=>discover()).then(()=>{ renderMissions(); refreshLiveSection(); }).catch(()=>{});
  }catch(e){ log('p2p','libp2p unavailable here, using HTTP federation: '+(e&&e.message||e), false);
    updateP2PStatus(); }
}

(async ()=>{
  wire();
  // Historical verification is side-effect-free and races every live plane.
  // It never enters record stores, routing, liveness, missions, or counters.
  mergeOfflineHistoryProjections(globalThis.__personaOSOfflineHistory);
  globalThis.addEventListener?.('personaos:offline-history',(event)=>{
    if(mergeOfflineHistoryProjections(event?.detail).length) refreshSystemView();
  });
  hydrateOfflineHistory().catch(()=>{});
  // A bounded, origin-scoped signed identity snapshot races (and never gates)
  // every network plane. This also serves returning hosted-portal viewers. If
  // no compact snapshot exists yet, a node-served shell can fall back to its
  // older complete-inventory cache after reconfirming the current node keys.
  hydrateFastSignedIdentitySnapshots().then((restored)=>{
    if(!restored) hydrateFastOriginInventory().catch(()=>{});
  }).catch(()=>{ hydrateFastOriginInventory().catch(()=>{}); });
  // Fetch the static transport commons concurrently, but settle its bounded
  // request before libp2p starts so it participates in the initial dial set.
  // Direct/same-origin discovery does not wait for that optional file.
  const portalP2PHints=loadPortalP2PBootstrapHints();
  // The 1.2MB vendored libp2p bundle competes with first paint for bandwidth.
  // The same-origin/direct lane is the primary operating path: give it a short
  // head start (settled first discovery pass, capped at 2.5s) before the peer
  // transport starts dialling. P2P remains fully independent afterwards.
  const firstDiscoveryPass=discover({refreshGlobal:true}).catch(()=>{});
  portalP2PHints.catch(()=>[]).then(()=>Promise.race([
    firstDiscoveryPass,new Promise((resolve)=>setTimeout(resolve,2500))
  ])).then(()=>initP2P()).catch(()=>{})
    .finally(()=>{ _p2pStartupSettled=true; });
  // The discovery pass below already starts local + optional IPFS planes once;
  // only their later maintenance ticks are scheduled here.
  setInterval(()=>{ discoverViaIPFS().catch(()=>{}); }, 120000);
  setInterval(()=>{ discoverLocalNode().catch(()=>{}); }, 30000);
  // Same-origin/direct records are the first operating path. Optional transport
  // commons, libp2p and the fallback locator continue independently.
  // Arm the locator decision concurrently so an empty hosted shell is not held
  // behind unrelated local/IPFS timeouts. The decision itself still refuses the
  // locator while any verified direct/P2P route exists and gives the in-flight
  // peer startup its bounded first-contact opportunity.
  scheduleFastGlobalRefresh(75);
  // The periodic cadences are armed BEFORE the first full discovery pass
  // resolves: one slow plane (a busy node, a hanging locator probe) used to
  // hold the 5s live cadence and persona-cognition streaming hostage forever,
  // leaving cards without their verified brain/stat surfaces. Every tick body
  // is idempotent against partial discovery state.
  // periodic live re-discovery (genuinely re-resolves + re-verifies; ticks in new personas)
  setInterval(()=>{
    maintainP2PBootstrapConnectivity().catch(()=>{});
    discover({refreshGlobal:false}).then(()=>{ renderMissions(); refreshLiveSection(); }).catch(()=>{});
  }, 15000);
  // per-entity drawer feed + node run state + the living network: re-fetch on the
  // node's live cadence so the stage, constellation and feed stream without SSE.
  setInterval(()=>{ try{ refreshLiveSection(); refreshThinking(); prefetchNodeStatuses();
    refreshSystemView(); streamPersonaCognition(); }catch(e){} }, 5000);
  // Exact live workspace snapshots: SSE is primary; this 3s poll is the bounded
  // fallback for proxies/browsers that buffer or block EventSource.
  setInterval(()=>{ try{ pollLiveArtifacts(); }catch(e){} },3000);
  // Small current-master-signed directories are cheap to refresh and keep
  // newly authored requests visible without waiting for the 15s inventory pass.
  setInterval(()=>{ refreshVisibleOpenInputs().catch(()=>{}); },1500);
  requestAnimationFrame(tick);
  await firstDiscoveryPass;
  prefetchNodeStatuses();
  renderMissions();
  refreshVisibleOpenInputs().catch(()=>{});
  streamPersonaCognition();
})().catch((e)=>{ $('#status').textContent='discovery error: '+e.message; console.error(e); });
