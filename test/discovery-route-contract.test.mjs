import assert from 'node:assert/strict';
import {createHash, createPrivateKey, createPublicKey, sign, verify} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createContext, runInContext} from 'node:vm';
import test from 'node:test';
import {createPublicEvidence} from './helpers/public-evidence.mjs';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const authority = await import(pathToFileURL(resolve(assetRoot, 'discovery-authority.mjs')));
const network = await import(pathToFileURL(resolve(assetRoot, 'network-view.mjs')));
const directory = await import(pathToFileURL(resolve(assetRoot, 'global-directory.mjs')));
const strategy = await import(pathToFileURL(resolve(assetRoot, 'discovery-strategy.mjs')));
const routes = await import(pathToFileURL(resolve(assetRoot, 'peer-route.mjs')));
const connection = await import(pathToFileURL(resolve(assetRoot, 'node-connection.mjs')));
const signedJson = await import(pathToFileURL(resolve(assetRoot, 'canonical-json.mjs')));

function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing production section: ${start}`);
  return source.slice(first, last);
}
const startup = source.slice(source.lastIndexOf('\n(async ()=>{'));
assert.ok(startup.startsWith('\n(async ()=>{\n  wire();'));
const focusHandler = section("  $('#globalKernels')?.addEventListener('click'", "  $('#networkAll')?.addEventListener");
const connectHandler = section("  $('#detailbody').addEventListener('submit'", "  $('#detailbody').addEventListener('click'");
const initP2P = section('async function initP2P(){', '\n(async ()=>{');
assert.equal((initP2P.match(/await import\(/g) || []).length, 1);
// Replace only the external transport module loader. Production startup,
// discovery, event handlers, signed admission and reconnect scheduling execute.
const peerStartup = initP2P.replace(/await import\('[^']+'\)/, 'await __loadPeerModule()');
const declarations = [
  section('const enc=new TextEncoder();', '/* ---------- explicit node read access'),
  section('function opTokens(){', 'async function readBoundedResponseBytes('),
  section('async function readBoundedResponseBytes(', 'function _downloadName('),
  section('const DEFAULT_JSON_MAX_BYTES=', 'async function fetchP2PArtifactBytes('),
  section('const _sharedDocJobs=', 'const responsivePublicJsonJobs='),
  section('const P2P_BOOTSTRAP_LIMITS=', 'function validatedKeysDocument(')
    .replace('import.meta.url', '__moduleUrl'),
  section('function validatedKeysDocument(', 'const OPEN_INPUT_DIRECTORY_FIELDS='),
  section('const _exactObjectFields=', ';\n') + ';\n',
  section('function providerPolicyPayload(', 'async function verifyPersonaLifecycleCard('),
  section('async function verifyCurrentMasterSignedDocument(', '// ---- C-OP-16 member-view siblings'),
  section('const PROVIDER_INVENTORY_FIELDS=', 'const PUBLIC_ENTITY_INDEX_FIELDS='),
  section('async function verifiedRecordFromDoc(', 'const PUBLIC_IDENTITY_INDEX_FIELDS='),
  section('const DEFAULT_GLOBAL_DISCOVERY_ENDPOINT=', 'async function admitVerifiedIdentityIndex('),
  section('async function discoverFrom(', '// ---------- global kernel tracker'),
  section('function rememberKernel(', 'function kernelForBase('),
  section('function peerList(){', '/* ---------- optional IPFS discovery commons'),
  // This also includes the old scanner when running the regression on the
  // before-source. Its requests therefore remain observable in the baseline.
  section('const IPFS_RENDEZVOUS_CID=', 'function recordStoreKey('),
  section('function recordStoreKey(', 'function upsert('),
  section('async function resolveKernelBases(', '// ---------- empty state:'),
  section('const MY_NODES=', 'async function connectedProfile('),
  section('function disconnectMyNode(', 'function paintConnectedNode('),
  section('async function rememberConnectedCognition(', 'function connectedNodeMarker('),
  section('async function operatorView(){', 'async function operatorNodeView('),
  section('let P2P=null;', 'function _providerHintJobId('),
  section('function _rememberP2PRouteHint(', 'async function _resolveProviderHintJob('),
  peerStartup,
  `function wire(){\n${focusHandler}\n${connectHandler}\n}`,
].join('\n');

const hash = value => createHash('sha256').update(value).digest('hex');
const canonicalBytes = value => Buffer.from(signedJson.canonicalJson(value));
const contentHash = value => 'sha256:' + hash(canonicalBytes(value));
const PEER = '12D3KooWF7xpFSFqd71tpWY5MhUEKMcv96M6ziSXkyxBbDS6vp9x';
const RELAY = `/dns4/relay.example.test/tcp/443/wss/p2p/${PEER}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

function signedNode(base, now) {
  // Fixed synthetic signing material; no retained identity or running node.
  const seed = createHash('sha256').update('route-contract:' + base).digest();
  const privateKey = createPrivateKey({key:Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'), seed,
  ]), format:'der', type:'pkcs8'});
  const publicKey = createPublicKey(privateKey).export({format:'der', type:'spki'}).subarray(-32).toString('hex');
  const kernel = 'kernel:' + publicKey.slice(0, 16), recordId = 'tool:' + publicKey.slice(0, 12);
  const signed = payload => sign(null, canonicalBytes(payload), privateKey).toString('hex');
  const generatedAt = new Date(now - 1000).toISOString(), expiresAt = new Date(now + 600000).toISOString();
  const record = {schema:'discovery-record/1', record_id:recordId, kind:'tool',
    did:`did:personaos:${kernel}/tool/example`, label:'Verified exact route',
    visibility_tier:'public', access_policy_ref:'policy:' + recordId, expires_at:expiresAt};
  const policy = {schema:'access-policy/1', policy_id:record.access_policy_ref,
    subject_kind:'tool', subject_id:recordId, owner_persona_id:'persona:fixture',
    access_grants:[], outward_tier:'public', cross_tenant_agreement_ref:''};
  const document = {record, signature_hex:signed(record), signing_key_id:'kernel-master',
    host_kernel_id:kernel, kernel_id:kernel, base, links:{},
    access_policy:{...policy, signature_hex:signed(policy)}};
  const documentHash = contentHash(document), recordUrl = `discovery/public/records/${recordId}.json`;
  const manifest = [{record_id:recordId, document_hash:documentHash, record_url:recordUrl}];
  const manifestHash = contentHash(manifest);
  const provider = {schema:'provider-record/1', key:record.did, record_id:recordId,
    record_url:recordUrl, document_hash:documentHash, visibility_tier:'public',
    host_kernel_id:kernel, public_key_hex:publicKey, base_url:base,
    provider_peer_id:PEER, host_multiaddrs:[RELAY], content_locator_refs:[],
    access_policy_ref:policy.policy_id, signing_key_id:'kernel-master',
    signing_key_role:'master', signing_key_status:'current',
    document_signing_key_id:'kernel-master', document_signing_key_status:'current',
    document_public_key_hex:publicKey, inventory_generation:1, inventory_manifest_hash:manifestHash};
  const payload = {schema:'dht-provider-index/3', base, kernel_id:kernel, version:1,
    inventory_generation:1, previous_inventory_hash:'', visibility:'public',
    signing_key_id:'kernel-master', generated_at:generatedAt, expires_at:expiresAt,
    provider_count:1, document_count:1, inventory_manifest:manifest, inventory_manifest_hash:manifestHash,
    documents:{[documentHash]:document}, providers:[{schema:'provider-record-reference/1',
      record:provider, signature_hex:signed(provider), document_ref:documentHash}]};
  const inventory = {...payload, inventory_hash:contentHash(payload)};
  inventory.signature_hex = signed(inventory);
  const boot = {schema:'personaos-discovery/1', kernel_id:kernel, record_count:1,
    providers_url:'discovery/providers.json', keys_url:'.well-known/personaos-keys.json'};
  const keys = {schema:'personaos-keys/1', kernel_id:kernel,
    keys:[{key_id:'kernel-master', role:'master', status:'current', public_key_hex:publicKey}]};
  const announcement = {schema:'personaos-node-announcement/1', node_id:kernel, kernel_id:kernel,
    base_url:base, generated_at:generatedAt, expires_at:expiresAt, libp2p_multiaddrs:[RELAY],
    public_discovery:true, record_count:1, public_bundle_hash:'', sequence:1, reachability_class:'public'};
  return {base, kernel, recordId, inventory, boot, keys, provider,
    hint:{base, kernel, peerId:PEER, providerRecord:provider},
    announcement:{schema:'personaos-node-announcement-envelope/1', announcement,
      signing_key_id:'kernel-master', public_key_hex:publicKey, signature_hex:signed(announcement)}};
}

function clock() {
  let now = Date.parse('2026-09-08T12:00:00Z'), nextId = 0;
  const jobs = new Map();
  const add = (callback, delay, repeat) => {
    const id = ++nextId, ms = Math.max(0, Number(delay) || 0);
    jobs.set(id, {callback, at:now + ms, repeat:repeat ? ms : null}); return id;
  };
  return {get now() {return now;},
    Date:class extends Date {constructor(...args) {super(...(args.length ? args : [now]));} static now() {return now;}},
    setTimeout:(callback, delay) => add(callback, delay, false),
    setInterval:(callback, delay) => add(callback, delay, true),
    clear:id => jobs.delete(id),
    async advance(ms, settle) {
      const end = now + ms;
      for (let steps = 0; ; steps++) {
        assert.ok(steps < 10000, 'The production schedule must remain bounded');
        const due = [...jobs.entries()].filter(([, job]) => job.at <= end)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        const [id, job] = due; now = job.at;
        if (job.repeat === null) jobs.delete(id); else job.at += job.repeat;
        await job.callback(); await settle();
      }
      now = end; await settle();
    },
  };
}

function fixture(page = 'https://127.0.0.1:45133/') {
  const time = clock(), location = new URL(page), http = [], peerReads = [], unexpected = [], errors = [];
  const documents = new Map(), nodes = new Map(), allowed = new Set([location.origin]);
  const streams = [], dom = new Map(), listeners = new Map(), connections = [];
  const metrics = {peerStarts:0, rendezvous:0, dials:0, statuses:0, cognition:0, paints:0};
  let rendezvousHint = null, failDial = false, api;
  for (const selector of ['#status', '#log', '#globalKernels', '#detailbody', '#detail-title']) {
    const events = new Map();
    dom.set(selector, {events, dataset:{}, innerHTML:'', textContent:'',
      setAttribute() {}, addEventListener:(name, fn) => events.set(name, fn), querySelector:() => null});
  }
  const S = {recs:new Map(), order:[], kernels:new Set(), boots:new Map(),
    keys:new Map(), keyDocs:new Map(), providerKeyRefreshAt:new Map(), providerInventories:new Map(),
    identityIndexes:new Map(), cachedIdentityPendingKernels:new Set(), peerHealth:new Map(),
    p2pDataRoutes:new Map(), p2pArtifactHashes:new Map(), providerRouteReconciliations:new Map(),
    p2pBootstraps:new Set(), portalPeers:new Set(), gossipPeers:new Set(), ipfsPeers:new Set(),
    globalPeers:new Set(), globalKernels:new Map(), globalAnnouncements:new Map(), resolverSnapshots:new Map(),
    globalAnnouncementByBase:new Map(), pendingProviderHints:new Map(), streams:new Map(),
    p2pDialQueue:[], p2pDialStates:new Map(), p2pDialActive:0, personaWindows:new Map(),
    personaDiscoveryByKey:new Map(), liveByPersona:new Map(), activeModelCallsByBase:new Map()};
  const resolveUrl = value => new URL(value, location).href;
  const put = (url, document) => {allowed.add(new URL(url).origin); documents.set(url, document);};
  const hintsUrl = new URL('assets/p2p-bootstrap-hints.json?v=20260822-assets-path-v5', location.origin + '/').href;
  put(hintsUrl, {libp2p:[]});
  const fetch = async (value, init = {}) => {
    const url = resolveUrl(value); http.push({url, init, at:time.now});
    if (!allowed.has(new URL(url).origin)) {unexpected.push(url); throw new Error('Unexpected transport: ' + url);}
    const value_ = documents.get(url);
    if (value_ instanceof Response) return value_.clone();
    return value_ === undefined ? new Response('', {status:404}) : Response.json(value_);
  };
  const p2p = {node:{peerId:{toString:() => PEER}, getConnections:() => connections,
    addEventListener:(event, callback) => listeners.set(event, callback)}, announce() {},
    async fetchPublicJson(provider, path) {
      peerReads.push({kernel:provider.host_kernel_id, path, at:time.now});
      const node = nodes.get(provider.host_kernel_id);
      if (!node || provider.public_key_hex !== node.provider.public_key_hex) return null;
      return structuredClone(path.endsWith('personaos-keys.json') ? node.keys
        : path.endsWith('personaos-discovery.json') ? node.boot
          : path === node.boot.providers_url ? node.inventory : null);
    },
  };
  const noops = Object.fromEntries(['mergeOfflineHistoryProjections', 'classifyMap', 'renderGlobalKernels',
    'updateVitalsCounters', 'refreshSystemView', 'renderMissions', 'renderOpenInputs', 'refreshLiveSection', 'refreshThinking',
    'rebalanceDiscoveryStreams', 'persistOfflinePublicHistory', 'retireFastSignedIdentityRoute',
    'persistFastOriginInventory', 'updateOpBadge', 'renderTop', 'paintConnectedNode', 'replaceStageHTML',
    'queueProviderHints', 'onGossipRecord', 'onVerifiedGossipProvider', 'tick', 'pushView',
  ].map(name => [name, () => {}]));
  const context = createContext({...authority, ...network, ...directory, ...strategy, ...routes,
    ...connection, ...signedJson, createPublicEvidence, ...noops, S, location, URL, URLSearchParams, Response,
    TextEncoder, TextDecoder, Uint8Array, AbortController, DOMException, queueMicrotask,
    Date:time.Date, setTimeout:time.setTimeout, setInterval:time.setInterval,
    clearTimeout:time.clear, clearInterval:time.clear,
    AbortSignal:{timeout(ms) {const controller = new AbortController(); time.setTimeout(() => controller.abort(), ms); return controller.signal;}},
    __moduleUrl:new URL('assets/discovery.js', location.origin + '/').href,
    fetch, esc, H:title => `<h3>${esc(title)}</h3>`, icon:() => '',
    $:selector => dom.get(selector) || null, document:{},
    NETWORK:{upsertEntity() {}, removeEntity() {}},
    NETWORK_LIMITS:{monitoredBases:32, cachedKernels:64, cachedRecords:20000, resolverPage:100},
    log:(tag, text, ok) => {if (ok === false) errors.push({tag, text});},
    console:{error:error => {throw error;}}, requestAnimationFrame() {}, addEventListener() {},
    ed:{verifyAsync:async (signature, message, key) => verify(null, message,
      createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(key)]),
        format:'der', type:'spki'}), signature)},
    sha256Hex:async value => hash(value),
    validateProviderInventoryWindow:(generated, expires) => authority.validateProviderInventoryWindow(generated, expires, {nowMs:time.now}),
    evaluatePublicRecordAccess:(record, policy, links) => authority.evaluatePublicRecordAccess(record, policy, links, {nowMs:time.now}),
    upsert:row => {const key = `${encodeURIComponent(row._kernel)}::${encodeURIComponent(row.record_id)}`;
      if (!S.recs.has(key)) S.order.push(key); S.recs.set(key, row); return true;},
    scheduleRealtimeRepaint:() => {metrics.paints++;},
    hydrateOfflineHistory:async () => [], hydrateFastSignedIdentitySnapshots:async () => true,
    hydrateFastOriginInventory:async () => false,
    refreshOpenInputDirectory:async () => {}, refreshVisibleOpenInputs:async () => {},
    loadTelemetry:async () => {}, pollLiveArtifacts:async () => {},
    prefetchNodeStatuses:() => {metrics.statuses++;}, streamPersonaCognition:() => {metrics.cognition++;},
    connectDiscoveryStream:(base, boot) => {S.streams.set(base, {kernel:boot.kernel_id});},
    freshPublicReadStatusBases:() => [],
    fetchEventSource:(url, options) => {const stream = {url, options, closed:false,
      addEventListener() {}, close() {this.closed = true;}}; streams.push(stream); return stream;},
    __loadPeerModule:async () => ({
      startP2P:async () => {metrics.peerStarts++; return p2p;},
      dialP2PBootstrap:async () => {metrics.dials++; if (failDial) throw new Error('Offline dial failure');
        const connected = {remotePeer:{toString:() => PEER}}; connections.push(connected); return connected;},
      verifyGossipProviderEnvelope:async () => true,
    }),
    refreshP2PRendezvous:async () => {metrics.rendezvous++;
      return rendezvousHint ? (await api.reconcile(rendezvousHint)).accepted : false;},
  });
  runInContext(declarations, context, {filename:'production-discovery-route-sections.js'});
  api = runInContext(`({discover, peerList, operatorView, connectMyNode, disconnectMyNode,
    nodes:MY_NODES, reconcile:_reconcileP2PRouteHint, loadGlobalNodes, discoverViaIPFS,
    loadPortalP2PBootstrapHints, fallback:_currentLocatorFallbackDecision,
    maintain:maintainP2PBootstrapConnectivity,
    busy:()=>_discoverBusy||_globalRefreshBusy||!!P2P?._rendezvousActive
      ||S.p2pDialActive>0||S.providerRouteReconciliations.size>0,
    peer:()=>P2P})`, context);
  const settle = async () => {
    for (let tries = 0; tries < 1000; tries++) {
      await nextTurn();
      if (!api.busy()) {await nextTurn(); if (!api.busy()) return;}
    }
    assert.fail('Offline production work did not settle');
  };
  return {...api, S, time, http, peerReads, unexpected, errors, streams, metrics, p2p,
    put, resolveUrl, settle,
    addNode(base) {const node = signedNode(base, time.now); nodes.set(node.kernel, node);
      if (base.startsWith('http')) for (const [path, body] of [[node.boot.keys_url, node.keys],
        ['.well-known/personaos-discovery.json', node.boot], [node.boot.providers_url, node.inventory]])
        put(base + '/' + path, body);
      return node;},
    hints(value) {put(hintsUrl, value);},
    rendezvous(node) {rendezvousHint = node?.hint || null;},
    async start() {await runInContext(startup, context, {filename:'production-discovery-startup.js'}); await settle();},
    advance:ms => time.advance(ms, settle),
    async focus(node) {dom.get('#globalKernels').events.get('click')({target:{closest:() => ({dataset:{kernel:node.kernel}})}}); await settle();},
    async submit(base, token = '') {
      const button = {disabled:false}, status = {textContent:''};
      const form = {id:'node-connect-form', elements:{node_url:{value:base}, node_token:{value:token}},
        querySelector:selector => selector.startsWith('button') ? button : status};
      await dom.get('#detailbody').events.get('submit')({target:form, preventDefault() {}});
      await settle(); assert.equal(button.disabled, false); assert.equal(form.elements.node_token.value, '');
      assert.equal(status.textContent, 'Connecting…', status.textContent);
      return api.nodes.get(base);
    },
    async disconnectPeer({fail = false} = {}) {failDial = fail; connections.length = 0;
      listeners.get('peer:disconnect')({detail:{toString:() => PEER}}); await settle();},
    allowDial() {failDial = false;},
    clean() {assert.deepEqual(unexpected, [], 'Only actual named routes may be requested');},
  };
}

for (const port of [8765, 43433]) test(`the printed HTTP origin on ${port} survives startup, events and maintenance without guessed peers`, async () => {
  const base = `http://127.0.0.1:${port}`, ui = fixture(base + '/?no_global_discovery=1');
  const node = ui.addNode(base);
  await ui.start();
  assert.equal(ui.S.recs.size, 1, JSON.stringify(ui.errors));
  assert.equal([...ui.S.recs.values()][0].record_id, node.recordId);
  const boots = () => ui.http.filter(row => row.url === base + '/.well-known/personaos-discovery.json').length;
  const before = boots();
  await ui.advance(60000);
  assert.equal(boots(), before + 4, 'The actual 15-second discovery schedule remains active');
  const eventBefore = boots(); await ui.focus(node);
  assert.equal(boots(), eventBefore + 1, 'The actual focus event still re-resolves this node');
  assert.ok(ui.metrics.statuses >= 13 && ui.metrics.cognition >= 13);
  assert.equal(ui.metrics.peerStarts, 1);
  assert.match((await ui.operatorView()).html, new RegExp(base.replaceAll('.', '\\.')));
  ui.clean();
});

for (const origin of ['https://127.0.0.1:45133', 'https://portal.example.test', 'http://portal.example.test']) {
  for (const flag of ['', '&local_discovery=1', '&no_local_discovery=1']) {
    test(`${origin} ${flag || 'defaults'} keeps cold and healthy peer discovery without guessed addresses`, async () => {
      const ui = fixture(origin + '/?no_global_discovery=1' + flag);
      await ui.start(); await ui.advance(30000);
      assert.equal(ui.S.recs.size, 0);
      const node = ui.addNode('libp2p://' + PEER);
      assert.equal((await ui.reconcile(node.hint)).accepted, true, JSON.stringify(ui.errors));
      assert.equal(ui.S.recs.size, 1); assert.ok(ui.S.p2pDataRoutes.has(node.base));
      const reads = ui.peerReads.length;
      await ui.advance(30000); await ui.focus(node);
      assert.ok(ui.peerReads.length > reads, 'The verified peer is refreshed after admission');
      assert.equal(ui.S.recs.size, 1); ui.clean();
    });
  }
}

test('current-node access and manual public/private addresses do not depend on public discovery', async () => {
  const ui = fixture('http://127.0.0.1:43433/?no_global_discovery=1');
  await ui.start();
  assert.equal(ui.S.recs.size, 0);
  assert.match((await ui.operatorView()).html, /http:\/\/127\.0\.0\.1:43433/);
  for (const base of ['http://localhost:8765', 'http://127.0.0.1:49281/private']) {
    for (const token of ['', 'fixture-private-token']) {
      const status = {schema:'personaos-node-status/1', node_id:'kernel:connection', personas:[], runs:[], environments:[]};
      ui.put(base + '/status', token ? Response.json(status, {headers:{'X-PersonaOS-Read-Tier':'operator'}}) : status);
      const first = ui.http.length, entry = await ui.submit(base, token);
      assert.ok(entry); assert.equal(entry.tier, token ? 'operator' : 'public');
      const connectedReads = ui.http.slice(first).filter(row => row.url.startsWith(base + '/'));
      assert.ok(connectedReads.some(row => row.url === base + '/status'));
      for (const row of connectedReads) assert.equal(row.init.headers.Authorization || '', token ? 'Bearer ' + token : '');
      assert.equal(entry.stream.url, base + '/discovery/events');
      assert.equal(entry.stream.options.requestInit().headers.Authorization || '', token ? 'Bearer ' + token : '');
      assert.equal(ui.peerList().includes(base), !token, 'Private connections stay out of public discovery');
      const publicReads = ui.http.slice(first).filter(row => !row.url.startsWith(base + '/'));
      assert.ok(publicReads.every(row => !row.init.headers?.Authorization));
      ui.disconnectMyNode(base); assert.equal(entry.session.entries().length, 0); assert.equal(entry.stream.closed, true);
    }
  }
  ui.clean();
});

test('named portal, gossip, IPFS and signed resolver routes still reach signed inventory admission', async () => {
  const resolver = 'https://resolver.example.test';
  const routing = 'https://routing.example.test/providers/';
  const ui = fixture('https://portal.example.test/?resolver=' + encodeURIComponent(resolver)
    + '&ipfs_routing=' + encodeURIComponent(routing) + '&no_local_discovery=1');
  const portal = ui.addNode('https://127.0.0.1:8765');
  const gossip = ui.addNode('https://gossip.example.test');
  const ipfs = ui.addNode('https://ipfs-node.example.test');
  const resolved = ui.addNode('https://resolved.example.test');
  ui.hints({libp2p:[RELAY], https:[portal.base]});
  ui.S.gossipPeers.add(gossip.base);
  ui.put(routing + 'Qmbnw4HfNbSp9YqpNBGoQqZcBgAbfF3reayr79DWxPqJgQ',
    {Providers:[{ID:PEER, Addrs:['/dns4/ipfs-node.example.test/tcp/443/https']}]});
  ui.put(resolver + '/v1/bootstrap', {libp2p_multiaddrs:[]});
  ui.put(resolver + '/v1/nodes?limit=100&order=recent&status=active',
    {nodes:[resolved.announcement], total:1, revision:'fixture'});
  await ui.start(); await ui.advance(0);
  await ui.loadGlobalNodes(); await ui.discover({refreshGlobal:false}); await ui.settle();
  assert.equal(ui.S.recs.size, 4, JSON.stringify(ui.errors));
  for (const node of [portal, gossip, ipfs, resolved]) {
    assert.ok(ui.S.providerInventories.has(node.kernel), node.base);
    assert.ok(ui.peerList().includes(node.base), node.base);
  }
  assert.ok(ui.S.p2pBootstraps.has(RELAY));
  assert.ok(ui.S.globalAnnouncements.has(resolved.kernel));
  assert.ok(ui.S.ipfsPeers.has(ipfs.base));
  ui.clean();
});

test('peer disconnect retries and locator fallback survive route loss without scanning ports', async () => {
  const resolver = 'https://resolver.example.test', ui = fixture('https://127.0.0.1:45133/?resolver=' + encodeURIComponent(resolver));
  const peer = ui.addNode('libp2p://' + PEER), replacement = ui.addNode('https://replacement.example.test');
  ui.hints({libp2p:[RELAY]}); ui.rendezvous(peer);
  ui.put(resolver + '/v1/bootstrap', {libp2p_multiaddrs:[]});
  ui.put(resolver + '/v1/nodes?limit=100&order=recent&status=active',
    {nodes:[], total:0, revision:'empty'});
  await ui.start(); await ui.advance(0);
  assert.ok(ui.S.p2pDataRoutes.has(peer.base));
  assert.equal(ui.fallback().queryLocator, false);
  assert.equal(ui.http.filter(row => row.url.startsWith(resolver)).length, 0);
  const before = ui.metrics.dials;
  ui.rendezvous(null); ui.S.p2pDataRoutes.clear(); ui.S.gossipPeers.clear(); ui.S.peerHealth.clear();
  await ui.disconnectPeer({fail:true});
  assert.equal(ui.metrics.dials, before + 1, 'The actual disconnect event immediately retries a known bootstrap');
  await ui.advance(4999); assert.equal(ui.metrics.dials, before + 1);
  ui.allowDial(); await ui.advance(1); assert.equal(ui.metrics.dials, before + 2);
  assert.equal(ui.fallback().queryLocator, true);
  ui.put(resolver + '/v1/nodes?limit=100&order=recent&status=active',
    {nodes:[replacement.announcement], total:1, revision:'replacement'});
  await ui.advance(15000);
  assert.ok(ui.http.some(row => row.url.startsWith(resolver + '/v1/nodes')));
  assert.ok(ui.S.providerInventories.has(replacement.kernel), JSON.stringify(ui.errors));
  assert.equal(ui.fallback().queryLocator, false, 'A healthy replacement direct route restores locator standby');
  assert.ok(ui.metrics.rendezvous >= 1);
  ui.clean();
});

test('a named address does not bypass signed inventory authority', async () => {
  const ui = fixture('http://127.0.0.1:8765/?no_global_discovery=1');
  const node = ui.addNode('http://127.0.0.1:8765');
  node.inventory.signature_hex = '00'.repeat(64);
  await ui.start();
  assert.equal(ui.S.recs.size, 0);
  assert.ok(ui.errors.some(row => row.text.includes('provider_inventory_signature_invalid')));
  ui.clean();
});
