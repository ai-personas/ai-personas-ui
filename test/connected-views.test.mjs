import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import {generateKeyPairSync, sign} from 'node:crypto';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const human = await import(pathToFileURL(resolve(assetRoot, 'human-content.mjs')));
const connection = await import(pathToFileURL(resolve(assetRoot, 'node-connection.mjs')));
const artifacts = await import(pathToFileURL(resolve(assetRoot, 'live-artifacts.mjs')));
const signatures = await import(pathToFileURL(resolve(assetRoot, 'live-signatures.mjs')));
const formats = await import(pathToFileURL(resolve(assetRoot, 'artifact-types.mjs')));
const network = await import(pathToFileURL(resolve(assetRoot, 'network-view.mjs')));
const signedJson = await import(pathToFileURL(resolve(assetRoot, 'canonical-json.mjs')));
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

function fixture({fetchImpl = async () => { throw new Error('Unexpected request'); },
  renderer = async () => {}, query = () => null, streamFactory = connection.fetchEventSource} = {}) {
  const privateSection = section('// Explicit connections are isolated', 'async function operatorView(');
  const declarations = section('function validatedKeysDocument(', 'function admitKeysDocument(')
    + section('async function readBoundedResponseBytes(', 'function _downloadName(')
    + section('const BINARY_RENDERERS=', 'function pickRenderer(')
    + section('function _groupLiveWorkspaceFiles(', 'function _liveWorkspaceCurrentFileCount(')
    + section('function _liveFileSharedState(', 'function _liveCurrentFileActionHTML(')
    + section('function _personaCharacteristicValue(', 'const _personaMonogram=') + privateSection;
  const values = {...human, ...connection, ...artifacts, ...signatures, ...formats, ...network, ...signedJson, esc,
    fetchEventSource: streamFactory,
    AbortController, setTimeout, clearTimeout, setInterval, clearInterval, URL,
    fetch: fetchImpl, join: (base, path) => /^https?:\/\//.test(path) ? path
      : base.replace(/\/$/, '') + '/' + path.replace(/^\//, ''),
    DEFAULT_JSON_MAX_BYTES: 4 * 1024 * 1024,
    $: query, updateOpBadge() {}, renderTop: async () => {},
    S: new Proxy({}, {get(_target, key) { throw new Error(`Private view touched public store: ${String(key)}`); }}),
    pickRenderer: (kind, path, responseMedia, contentMedia) => formats.selectArtifactRenderer(kind, {path, responseMedia, contentMedia}),
    declaredArtifactMedia: file => file.mime_type || '',
    RENDERERS: new Proxy({}, {get: () => renderer}), renderPlain: renderer,
    mkBlobURL: (blob, ctx) => {
      ctx.assertCurrent(); const url = URL.createObjectURL(blob);
      ctx.onCleanup(() => URL.revokeObjectURL(url)); return url;
    },
    _downloadName: path => path.split('/').at(-1),
    el: (tag, cls, text) => ({tag, cls, textContent:text}),
    _displayPersonaName: (name, pid) => name || pid, _friendlyInstant: at => at,
    _publicPersonaOutputDisplayText: output => output.text,
    copyBtn: () => '', renderThinking: () => '',
    H: title => `<h3>${esc(title)}</h3>`, kv: (key, value) => `${esc(key)}: ${value}`,
    fmtBytes: size => `${size} B`, operatorView: () => ({title: 'Connections', html: ''}),
  };
  const api = new Function(...Object.keys(values), declarations + `\nreturn {
    nodes: MY_NODES, personaView: connectedPersonaView, environmentView: connectedEnvironmentView,
    refresh: refreshConnectedNode, cognition: connectedCognitionHtml, disconnect: disconnectMyNode,
    connect: connectMyNode, profile: connectedProfile, readBytes: connectedNodeBytes,
    remember: rememberConnectedArtifacts, readArtifacts: readConnectedArtifacts, refreshArtifacts: refreshConnectedArtifacts,
    rememberSaved: rememberConnectedSavedArtifacts, readSaved: readConnectedSavedArtifacts,
    files: connectedEnvironmentFiles, select: connectedFileSelection, body: connectedFileBytes,
    ...(typeof connectedFileView === 'function' ? {fileView: connectedFileView} : {}),
  };`)(...Object.values(values));
  const entry = {base: 'https://node.test/private', tier: 'operator',
    session: new connection.NodeReadSession(), pending: new Set(), cognition: new Map(),
    profiles: new Map(), profileJobs: new Map(), artifacts: new Map(), artifactJobs: new Map(),
    savedArtifacts: new Map(), savedArtifactJobs: new Map(),
    viewCleanups: new Set(), closed: false, status: {schema: 'personaos-node-status/1', node_id: 'kernel:test', runs: [],
      personas: [{persona_id:'alice', name:'Alice'}, {persona_id:'bob', name:'Bob'}],
      environments: [{environment_id:'room', name:'Workshop', status:'active',
        visibility_tier:'persona_only', member_persona_ids:['alice','bob']}]}};
  entry.session.set(entry.base, 'private-token'); api.nodes.set(entry.base, entry);
  return {...api, entry};
}

const profile = description => ({schema:'personaos-persona-profile/1', persona_id:'alice',
  description, born_at:'2026-09-01T00:00:00Z', characteristic_identity: {
    schema:'persona-characteristic-card/1', characteristics: {
      traits:['patient','curious'], OCEAN:{O:0.8,N:0}, VAD:{valence:0.2,arousal:0},
    }}});

test('the connected persona shows its characteristic profile, including zero values', async () => {
  const ui = fixture({fetchImpl: async () => Response.json(profile('Checks every joint.'))});
  const view = await ui.personaView(ui.entry.base, 'alice');
  assert.match(view.html, /Checks every joint/);
  assert.match(view.html, /patient.*curious/);
  assert.match(view.html, /OCEAN/); assert.match(view.html, /N: 0/);
  assert.match(view.html, /VAD/); assert.match(view.html, /Arousal: 0/);
  ui.disconnect(ui.entry.base);
});

test('reopening a persona refreshes an expired profile rather than retaining its first description', async () => {
  let description = 'First description';
  const ui = fixture({fetchImpl: async () => Response.json(profile(description))});
  assert.match((await ui.personaView(ui.entry.base, 'alice')).html, /First description/);
  description = 'Evolved description';
  // The document cache records when the profile was fetched, not a lifetime pin.
  const cached = ui.entry.profiles.get('alice'); cached.at = 0;
  const view = await ui.personaView(ui.entry.base, 'alice');
  assert.match(view.html, /Evolved description/); assert.doesNotMatch(view.html, /First description/);
  ui.disconnect(ui.entry.base);
});

test('private messages retain their exact author, audience and complete text', () => {
  const ui = fixture();
  const message = 'Please check the dimensions. '.repeat(50);
  const html = ui.cognition({persona_id:'alice', recent_outputs: [{
    kind:'PERSONA_COMMUNICATION_AUTHORED', at:'2026-09-06T01:00:00Z', text:message,
    environment_id:'room', author_persona_id:'bob', audience_persona_ids:['alice'],
  }]}, ui.entry);
  assert.match(html, /Bob → Alice/); assert.ok(html.includes(esc(message)));
  ui.disconnect(ui.entry.base);
});

function signer() {
  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  const publicHex = publicKey.export({format:'der', type:'spki'}).subarray(-32).toString('hex');
  const node = 'kernel:' + publicHex.slice(0,16);
  const signed = value => ({...value, signature_hex: sign(null,
    Buffer.from(signatures.canonicalJson(value)), privateKey).toString('hex')});
  const keys = {schema:'personaos-keys/1', kernel_id:node, keys:[{
    key_id:'kernel-master', role:'master', status:'current', public_key_hex:publicHex,
  }]};
  const policy = run => {
    const body = {schema:'access-policy/1', policy_id:`policy:${run}`, subject_kind:'artifact',
      subject_id:`${node}:${run}`, owner_persona_id:'alice', access_grants:[],
      outward_tier:'persona_only', cross_tenant_agreement_ref:''};
    return {...signed(body), signing_key_id:'kernel-master'};
  };
  const snapshot = ({run='run-a', revision='1', since=null, files=[],
    workspaces=[{workspace_id:'ws-a', environment_id:'room', persona_id:'alice', state:'model_call_active'}],
    extra={}} = {}) => {
    const access = policy(run);
    return signed({schema:'personaos-live-artifacts/1', node_id:node, run,
      generated_at:`2026-09-06T03:00:0${revision}Z`, revision:'sha256:'+revision.repeat(64),
      since_revision:since, visibility_tier:'operator', active:{calls:[]},
      files, workspaces, file_count:files.length, signing_key_id:'kernel-master',
      access_policy_ref:access.policy_id, access_policy:access, ...extra});
  };
  const event = snapshot => signed({schema:'personaos-live-artifact-event/1', node_id:node,
    run:snapshot.run, generated_at:snapshot.generated_at, state:'snapshot', active:true,
    revision:snapshot.revision, previous_revision:snapshot.since_revision, snapshot,
    signing_key_id:'kernel-master', access_policy_ref:snapshot.access_policy_ref, access_policy:snapshot.access_policy});
  const ended = snapshot => signed({schema:'personaos-live-artifact-event/1', node_id:node,
    run:snapshot.run, generated_at:'2026-09-06T03:01:00Z', state:'run_ended', active:false,
    revision:null, previous_revision:snapshot.revision, snapshot:null,
    signing_key_id:'kernel-master', access_policy_ref:snapshot.access_policy_ref, access_policy:snapshot.access_policy});
  return {node, keys, signed, snapshot, event, ended};
}
async function file({run='run-a', workspace='ws-a', path='report.md', text='A complete private result. 🧭',
  environment='room', persona='alice'} = {}) {
  const bytes = new TextEncoder().encode(text), sha256 = await artifacts.sha256Hex(bytes);
  const encode = part => encodeURIComponent(part).replace(/[!'()*]/g, char => '%'+char.charCodeAt(0).toString(16).toUpperCase());
  return {bytes, record:{workspace_id:workspace, environment_id:environment, persona_id:persona,
    path, sha256, size_bytes:bytes.length, mime_type:'text/markdown',
    body_url:`/runs/${encode(run)}/live-artifacts/body/${workspace}/${path.split('/').map(encode).join('/')}?sha256=${sha256}`}};
}
function prepare(ui, issuer, runs=['run-a']) {
  ui.entry.status.node_id=issuer.node; ui.entry.status.runs=runs;
  ui.entry.artifactsRequested=true;
}
const withCleanup = (t, ui) => t.after(() => {
  for (const base of [...ui.nodes.keys()]) ui.disconnect(base);
});

function fakeView() {
  const elements = new Map();
  const element = () => ({innerHTML:'', textContent:'', hidden:true, children:[], listeners:{},
    addEventListener(type, listener) { this.listeners[type]=listener; },
    appendChild(child) { this.children.push(child); }});
  for (const selector of ['#fv-body','[data-private-integrity]','[data-private-download]','[data-private-format]'])
    elements.set(selector,element());
  const controller = new AbortController(), cleanup = new Set();
  const lifecycle = {signal:controller.signal, isCurrent:()=>!controller.signal.aborted,
    assertCurrent() { if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError'); },
    reportProgress() {}, onCleanup(callback) { cleanup.add(callback); },
    cancel() { controller.abort(); for (const callback of cleanup) callback(); cleanup.clear(); }};
  return {root:{querySelector:selector=>elements.get(selector)}, elements, lifecycle};
}

test('signed workspaces are joined to exact runs and environments on their connected node', async t => {
  const issuer=signer(), a=await file(), b=await file({workspace:'ws-b', environment:'other', path:'secret.md'});
  const ui=fixture({fetchImpl: async url => {
    assert.ok(url.startsWith(ui.entry.base+'/'));
    return Response.json(issuer.keys);
  }}); withCleanup(t,ui); prepare(ui,issuer,['run-a','run-b']);
  const snapshot=issuer.snapshot({files:[a.record,b.record],workspaces:[
    {workspace_id:'ws-a', environment_id:'room', persona_id:'alice'},
    {workspace_id:'ws-b', environment_id:'other', persona_id:'alice'},
  ]});
  assert.equal(await ui.remember(ui.entry,snapshot),true);
  const older=await file({run:'run-b',path:'earlier.md'});
  assert.equal(await ui.remember(ui.entry,issuer.snapshot({run:'run-b',files:[older.record]})),true);
  const view=await ui.environmentView(ui.entry.base,'room');
  assert.match(view.html,/Workspace files \(2\)/);
  assert.match(view.html,/data-run="run-a".*data-environment="room".*data-workspace="ws-a".*data-path="report.md"/);
  assert.match(view.html,/earlier.md/); assert.doesNotMatch(view.html,/secret.md/);
  assert.equal(ui.files(ui.entry,'other').length,0, 'an unlisted environment is not admitted');
  assert.equal(ui.select(ui.entry,'run-a','room','ws-a','report.md').file.sha256,a.record.sha256);
  assert.throws(()=>ui.select(ui.entry,'run-b','room','ws-a','report.md'),/no longer available/);
});

test('invalid keys, foreign nodes, invalid signatures and private snapshots on a public connection are refused', async t => {
  const issuer=signer(), foreign=signer();
  let keys={...issuer.keys,kernel_id:foreign.node};
  const ui=fixture({fetchImpl: async () => Response.json(keys)}); withCleanup(t,ui); prepare(ui,issuer);
  await assert.rejects(ui.remember(ui.entry,issuer.snapshot()),/signing key/);
  assert.equal(ui.entry.artifacts.size,0); assert.equal(ui.entry.keyDocument,undefined);
  keys=issuer.keys;
  await assert.rejects(ui.remember(ui.entry,foreign.snapshot()),/signature or revision/);
  await assert.rejects(ui.remember(ui.entry,{...issuer.snapshot(), task:'Tampered task'}),/signature or revision/);
  ui.entry.tier='public';
  await assert.rejects(ui.remember(ui.entry,issuer.snapshot()),/signature or revision/);
  assert.equal(ui.entry.artifacts.size,0);
});

test('a late initial poll cannot overwrite a newer signed SSE snapshot', async t => {
  const issuer=signer();
  const ui=fixture({fetchImpl:async()=>Response.json(issuer.keys)}); withCleanup(t,ui); prepare(ui,issuer);
  const newer=issuer.snapshot({revision:'2',files:[(await file({path:'new.md'})).record]});
  assert.equal(await ui.remember(ui.entry,issuer.event(newer),{event:true}),true);
  const first=issuer.snapshot({files:[(await file({path:'old.md'})).record]});
  assert.equal(await ui.remember(ui.entry,first,{startedRevision:null}),false);
  assert.equal(ui.entry.artifacts.get('run-a').revision,newer.revision);
  const broken=issuer.snapshot({revision:'3',since:first.revision});
  assert.equal(await ui.remember(ui.entry,issuer.event(broken),{event:true}),false);
  const next=issuer.snapshot({revision:'3',since:newer.revision});
  assert.equal(await ui.remember(ui.entry,issuer.event(next),{event:true}),true);
  assert.equal(ui.entry.artifacts.get('run-a').revision,next.revision);
});

test('private bytes use only the scoped bearer and reach the renderer after hash and size checks', async t => {
  const issuer=signer(), result=await file({path:"plans/it's (final) 🧭.md"}), requests=[], rendered=[];
  const ui=fixture({fetchImpl:async(url,options)=>{
    requests.push({url,options});
    return url.includes('/live-artifacts/body/') ? new Response(result.bytes,{headers:{'Content-Type':'text/markdown'}})
      : Response.json(issuer.keys);
  },renderer:async(_host,ctx)=>{ctx.assertCurrent(); rendered.push(ctx);}});
  withCleanup(t,ui); prepare(ui,issuer);
  assert.equal(await ui.remember(ui.entry,issuer.snapshot({files:[result.record]})),true);
  const view=ui.fileView(ui.entry.base,'run-a','room','ws-a',result.record.path);
  const dom=fakeView(); t.after(()=>dom.lifecycle.cancel());
  await view.mount(dom.root,dom.lifecycle);
  assert.equal(rendered.length,1); assert.deepEqual(rendered[0].verifiedBytes,result.bytes);
  assert.equal(rendered[0].text,new TextDecoder().decode(result.bytes));
  assert.match(dom.elements.get('[data-private-integrity]').textContent,/Verified bytes/);
  const download=dom.elements.get('[data-private-download]');
  assert.equal(download.hidden,false); assert.match(download.href,/^blob:/);
  assert.equal(download.download,"it's (final) 🧭.md");
  assert.equal(ui.entry.viewCleanups.size,1);
  for(const {url,options} of requests){
    assert.equal(options.headers.Authorization,'Bearer private-token');
    assert.equal(options.credentials,'omit'); assert.equal(options.redirect,'error');
    assert.equal(options.cache,'no-store'); assert.equal(options.referrerPolicy,'no-referrer');
    assert.ok(url.startsWith(ui.entry.base+'/')); assert.ok(!url.includes('private-token'));
  }
  ui.disconnect(ui.entry.base);
  assert.equal(dom.lifecycle.signal.aborted,true);
  assert.equal(ui.entry.viewCleanups.size,0); assert.equal(ui.entry.artifacts.size,0);
  assert.equal(ui.entry.keyDocument,null); assert.equal(ui.entry.session.entries().length,0);
  await assert.rejects(fetch(download.href));
});

test('body routes, lengths and hashes cannot redirect or substitute another private file', async t => {
  const issuer=signer(), result=await file(); let body=result.bytes, bodyCalls=0;
  const ui=fixture({fetchImpl:async url=>{
    if(!url.includes('/live-artifacts/body/')) return Response.json(issuer.keys);
    bodyCalls++; return new Response(body);
  }}); withCleanup(t,ui); prepare(ui,issuer);
  for(const url of ['https://elsewhere.test/steal','https://user:pass@node.test/private/runs/run-a',
    result.record.body_url.replace('/ws-a/','/ws-b/'), result.record.body_url+'&other=1']){
    ui.entry.artifacts.clear();
    await ui.remember(ui.entry,issuer.snapshot({files:[{...result.record,body_url:url}]}));
    assert.throws(()=>ui.select(ui.entry,'run-a','room','ws-a',result.record.path),/route/);
  }
  assert.equal(bodyCalls,0);
  ui.entry.artifacts.clear(); await ui.remember(ui.entry,issuer.snapshot({files:[result.record]}));
  const selection=ui.select(ui.entry,'run-a','room','ws-a',result.record.path);
  body=new Uint8Array(result.bytes.length); await assert.rejects(ui.body(ui.entry,selection),/do not match/);
  body=result.bytes.slice(1); await assert.rejects(ui.body(ui.entry,selection),/do not match/);
  body=new Uint8Array(result.bytes.length+1); await assert.rejects(ui.body(ui.entry,selection),/exceeds/);
  const before=bodyCalls;
  await assert.rejects(ui.readBytes(ui.entry,'https://elsewhere.test/file'),/outside/);
  await assert.rejects(ui.readBytes(ui.entry,'../sibling/file'),/outside/);
  assert.equal(bodyCalls,before);
});

for(const change of ['revision','terminal','disconnect','navigation']) test(`a ${change} during a body read prevents a late preview`, async t=>{
  const issuer=signer(), result=await file(); let complete, observedSignal;
  const ui=fixture({fetchImpl:async(url,options)=>{
    if(!url.includes('/live-artifacts/body/')) return Response.json(issuer.keys);
    observedSignal=options.signal; return new Promise(resolve=>{complete=()=>resolve(new Response(result.bytes));});
  }}); withCleanup(t,ui); prepare(ui,issuer);
  const first=issuer.snapshot({files:[result.record]}); await ui.remember(ui.entry,first);
  const selection=ui.select(ui.entry,'run-a','room','ws-a',result.record.path), viewController=new AbortController();
  const pending=ui.body(ui.entry,selection,viewController.signal);
  const refused=assert.rejects(pending,change==='disconnect'||change==='navigation'?{name:'AbortError'}:/changed/);
  assert.equal(typeof complete,'function');
  if(change==='revision') await ui.remember(ui.entry,issuer.event(issuer.snapshot({revision:'2',since:first.revision,files:[result.record]})),{event:true});
  if(change==='terminal') await ui.remember(ui.entry,issuer.ended(first),{event:true});
  if(change==='disconnect') ui.disconnect(ui.entry.base);
  if(change==='navigation') viewController.abort();
  if(change==='disconnect'||change==='navigation') assert.equal(observedSignal.aborted,true);
  complete(); await refused;
  assert.equal(ui.entry.pending.size,0);
});

test('ambiguous or contradictory workspace bindings never enter the environment file list', async t=>{
  const issuer=signer(), result=await file();
  const ui=fixture({fetchImpl:async()=>Response.json(issuer.keys)}); withCleanup(t,ui); prepare(ui,issuer);
  for(const workspaces of [[
    {workspace_id:'ws-a',environment_id:'room',persona_id:'alice'},
    {workspace_id:'ws-a',environment_id:'other',persona_id:'alice'},
  ],[{workspace_id:'ws-a',environment_id:'room',persona_id:'bob'}]]){
    ui.entry.artifacts.clear();
    await ui.remember(ui.entry,issuer.snapshot({files:[result.record],workspaces}));
    assert.equal(ui.files(ui.entry,'room').length,0);
  }
});

test('private environment counts group identical worktree copies and preserve different content', async t=>{
  const issuer=signer(), a=await file(), b=await file({workspace:'ws-b',persona:'bob'});
  const changed=await file({workspace:'ws-c',text:'A different result.'});
  const ui=fixture({fetchImpl:async()=>Response.json(issuer.keys)}); withCleanup(t,ui); prepare(ui,issuer);
  await ui.remember(ui.entry,issuer.snapshot({files:[a.record,b.record,changed.record],workspaces:[
    {workspace_id:'ws-a',environment_id:'room',persona_id:'alice'},
    {workspace_id:'ws-b',environment_id:'room',persona_id:'bob'},
    {workspace_id:'ws-c',environment_id:'room',persona_id:'alice'},
  ]}));
  const view=await ui.environmentView(ui.entry.base,'room');
  assert.match(view.html,/Workspace files \(2\)/); assert.match(view.html,/2 worktree copies · identical bytes/);
  assert.match(view.html,/different content at this path/);
  for(const workspace of ['ws-a','ws-b','ws-c']) assert.ok(view.html.includes(`data-workspace="${workspace}"`));
  assert.match(view.html,/Bob/);
});

test('private files identify a captured personal copy when the shared merge is incomplete', async t=>{
  const issuer=signer(), result=await file();
  result.record.provenance={schema:'personaos-live-artifact-workspace-publication-provenance/1',
    authority:'verified_persona_workspace_change_capture', publication_complete:false,
    environment_bytes_present:false};
  const ui=fixture({fetchImpl:async()=>Response.json(issuer.keys)}); withCleanup(t,ui); prepare(ui,issuer);
  assert.equal(await ui.remember(ui.entry,issuer.snapshot({files:[result.record]})),true);
  assert.match((await ui.environmentView(ui.entry.base,'room')).html,/Personal copy · shared merge incomplete/);
  assert.match(ui.fileView(ui.entry.base,'run-a','room','ws-a','report.md').html,
    /Workspace copy: Personal copy · shared merge incomplete/);
});

test('a private environment reports an incomplete capture even when no file was retained', async t=>{
  const issuer=signer();
  const ui=fixture({fetchImpl:async()=>Response.json(issuer.keys)}); withCleanup(t,ui); prepare(ui,issuer);
  assert.equal(await ui.remember(ui.entry,issuer.snapshot({extra:{truncated:true,omitted_file_count:2}})),true);
  assert.match((await ui.environmentView(ui.entry.base,'room')).html,/workspace capture is incomplete/);
});

async function savedFile(options={}){
  const result=await file(options), id='artifact:export-a';
  return {...result, document:{schema:'personaos-run-artifacts/1',node_id:'kernel:test',run:options.run||'run-a',
    environment_id:options.environment||'room',task:'Build the measured result.',metadata:[{
      schema:'artifact-run-export/1',artifact_id:id,path:result.record.path,
      environment_id:result.record.environment_id,owning_env_id:result.record.environment_id,
      content_hash:'sha256:'+result.record.sha256,size_bytes:result.bytes.length,mime_type:'text/markdown',
      body_available:false,operator_package_path:'artifacts/operator-package/'+result.record.path,
      body_url:'/runs/'+(options.run||'run-a')+'/artifacts/body?'+new URLSearchParams({artifact_id:id,sha256:result.record.sha256}),
    }]}};
}

test('an idle private node supplies saved output without a live snapshot or public cache',async t=>{
  const saved=await savedFile({path:"notes/.draft/it's final 🧭 %.md"}), rendered=[], requests=[];
  const ui=fixture({fetchImpl:async(url,options)=>{
    requests.push({url,options});
    if(new URL(url).pathname.endsWith('/live-artifacts')) return new Response('',{status:404});
    if(new URL(url).pathname.endsWith('/artifacts')) return Response.json(saved.document);
    return new Response(saved.bytes,{headers:{'Content-Type':'text/markdown'}});
  },renderer:async(_host,ctx)=>{ctx.assertCurrent();rendered.push(ctx);}});
  withCleanup(t,ui); ui.entry.status.runs=['run-a'];
  await ui.refreshArtifacts(ui.entry);
  assert.equal(ui.entry.artifactError,''); assert.equal(ui.entry.artifacts.size,0);
  assert.equal(ui.entry.savedArtifacts.size,1); assert.equal(ui.entry.keyDocument,undefined);
  const environment=await ui.environmentView(ui.entry.base,'room');
  assert.match(environment.html,/Saved output/); assert.match(environment.html,/Workspace files \(1\)/);
  const metadata=saved.document.metadata[0], options={source:'saved',artifactId:metadata.artifact_id};
  const view=ui.fileView(ui.entry.base,'run-a','room','',metadata.path,options), dom=fakeView();
  t.after(()=>dom.lifecycle.cancel());
  assert.match(view.html,/node-exported metadata/); assert.doesNotMatch(view.html,/signed metadata/);
  await view.mount(dom.root,dom.lifecycle);
  assert.equal(rendered.length,1); assert.deepEqual(rendered[0].verifiedBytes,saved.bytes);
  assert.equal(dom.elements.get('[data-private-download]').download,"it's final 🧭 %.md");
  const bodyRequest=requests.find(({url})=>new URL(url).pathname.endsWith('/artifacts/body'));
  assert.equal(new URL(bodyRequest.url).searchParams.get('artifact_id'),metadata.artifact_id);
  assert.equal(bodyRequest.options.headers.Authorization,'Bearer private-token');
  ui.disconnect(ui.entry.base); assert.equal(ui.entry.savedArtifacts.size,0);
  assert.equal(dom.lifecycle.signal.aborted,true);
});

test('saved metadata must match the connected node, run, environment and exact body route',async t=>{
  const saved=await savedFile(), ui=fixture(); withCleanup(t,ui); ui.entry.status.runs=['run-a'];
  const changes=[
    doc=>{doc.node_id='kernel:foreign';},doc=>{doc.run='run-b';},doc=>{doc.environment_id='other';},
    doc=>{doc.metadata[0].owning_env_id='other';},doc=>{doc.metadata[0].artifact_id='../escape';},
    doc=>{doc.metadata[0].path='../secret';},doc=>{doc.metadata[0].size_bytes=-1;},
    doc=>{doc.metadata[0].content_hash='sha256:invalid';},doc=>{doc.metadata.push({...doc.metadata[0]});},
    doc=>{doc.metadata[0].body_url='https://elsewhere.test/private';},
    doc=>{doc.metadata[0].body_url=doc.metadata[0].body_url.replace('run-a','run-b');},
    doc=>{doc.metadata[0].body_url+='&artifact_id=another';},
  ];
  for(const change of changes){
    const doc=structuredClone(saved.document); change(doc);
    await assert.rejects(ui.rememberSaved(ui.entry,'run-a',doc),/match|inconsistent/);
    assert.equal(ui.entry.savedArtifacts.size,0);
  }
  ui.entry.tier='public';
  await assert.rejects(ui.rememberSaved(ui.entry,'run-a',saved.document),/do not match/);
  await ui.readSaved(ui.entry,'run-a'); assert.equal(ui.entry.savedArtifactJobs.size,0);
});

test('saved and captured copies group by exact content and preserve both read routes',async t=>{
  const issuer=signer(), live=await file(), saved=await savedFile(); saved.document.node_id=issuer.node;
  const ui=fixture({fetchImpl:async()=>Response.json(issuer.keys)});withCleanup(t,ui);prepare(ui,issuer);
  await ui.remember(ui.entry,issuer.snapshot({files:[live.record]}));
  await ui.rememberSaved(ui.entry,'run-a',saved.document);
  const view=await ui.environmentView(ui.entry.base,'room');
  assert.match(view.html,/Workspace files \(1\)/); assert.match(view.html,/2 copies · identical bytes/);
  assert.match(view.html,/Saved output/); assert.match(view.html,/Worktree · Alice/);
  assert.match(view.html,/data-source="saved"/); assert.match(view.html,/data-source="live"/);
  const options={source:'saved',artifactId:saved.document.metadata[0].artifact_id};
  assert.match(ui.select(ui.entry,'run-a','room','',live.record.path,options).route,/\/artifacts\/body\?/);
  assert.match(ui.select(ui.entry,'run-a','room','ws-a',live.record.path).route,/\/live-artifacts\/body\//);
});

for(const change of ['metadata','environment','run','disconnect']) test(`saved ${change} changes during a read prevent a late preview`,async t=>{
  const saved=await savedFile(); let complete;
  const ui=fixture({fetchImpl:async()=>new Promise(resolve=>{complete=()=>resolve(new Response(saved.bytes));})});
  withCleanup(t,ui);ui.entry.status.runs=['run-a'];await ui.rememberSaved(ui.entry,'run-a',saved.document);
  const selection=ui.select(ui.entry,'run-a','room','',saved.record.path,
    {source:'saved',artifactId:saved.document.metadata[0].artifact_id});
  const pending=ui.body(ui.entry,selection);
  const refused=assert.rejects(pending,change==='disconnect'?{name:'AbortError'}:/changed|available/);
  if(change==='metadata'){
    const newer=await savedFile({text:'A revised private result.'});
    await ui.rememberSaved(ui.entry,'run-a',newer.document);
  }
  if(change==='environment')ui.entry.status.environments=[];
  if(change==='run')ui.entry.status.runs=[];
  if(change==='disconnect')ui.disconnect(ui.entry.base);
  complete();await refused;assert.equal(ui.entry.pending.size,0);
});

test('a saved body must still match its advertised bytes and hash',async t=>{
  const saved=await savedFile(), ui=fixture({fetchImpl:async()=>new Response(new Uint8Array(saved.bytes.length))});
  withCleanup(t,ui);ui.entry.status.runs=['run-a'];await ui.rememberSaved(ui.entry,'run-a',saved.document);
  const selection=ui.select(ui.entry,'run-a','room','',saved.record.path,
    {source:'saved',artifactId:saved.document.metadata[0].artifact_id});
  await assert.rejects(ui.body(ui.entry,selection),/do not match/);
});
