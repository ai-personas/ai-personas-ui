// Exercise the UI readers and shipped peer queue against a held wire response.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assets = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assets, 'discovery.js'), 'utf8');
const browser = await import(pathToFileURL(resolve(assets, 'p2p-libp2p.js')));
globalThis.location = {protocol: 'http:'};
const peer = '12D3KooWGTrLWhGWoNRVQLwrc2C9UKsVRHPg4PzPk3eDzE8Ukgbz';
const provider = {provider_peer_id: peer, host_kernel_id: 'kernel:priority',
  host_multiaddrs: [`/ip4/127.0.0.1/tcp/12345/ws/p2p/${peer}`]};
const inventoryPath = 'discovery/public/providers.json';
const cognitionPath = 'personas/alice/thinking';
const bootstrapPath = '.well-known/personaos-discovery.json';
const chunkSize = 192 * 1024;
const inventory = {body: 'inventory'.repeat(70000)};
const cognition = {body: 'complete response'.repeat(20000)};
const documents = new Map([[inventoryPath, inventory], [cognitionPath, cognition]]);
const bodies = new Map([...documents].map(([path, document]) => {
  const raw = Buffer.from(JSON.stringify(document));
  return [path, {raw, hash: 'sha256:' + createHash('sha256').update(raw).digest('hex')}];
}));
function section(start, end) {
  const offset = source.indexOf(start), limit = source.indexOf(end, offset);
  assert.ok(offset >= 0 && limit > offset);
  return source.slice(offset, limit);
}

function fixture(mode) {
  let unblock, entered, unblockRemainder, enteredRemainder;
  const blocked = new Promise(resolve => {unblock = resolve;});
  const started = new Promise(resolve => {entered = resolve;});
  const remainderBlocked = new Promise(resolve => {unblockRemainder = resolve;});
  const remainderStarted = new Promise(resolve => {enteredRemainder = resolve;});
  const requests = [], options = [];
  const connection = {status: 'open', limits: null, async newStream() {
    let request;
    return {send(bytes) {request = JSON.parse(Buffer.from(bytes).toString()); return true;},
      close: async () => {}, abort() {}, async *[Symbol.asyncIterator]() {
        requests.push(request);
        if (request.path === inventoryPath && request.op === 'blob' && request.offset === 0) {
          entered(); await blocked;
        }
        if (request.path === inventoryPath && request.op === 'blob' && request.offset === chunkSize) {
          enteredRemainder(); await remainderBlocked;
        }
        const reply = {schema: 'personaos-public-data-response/1', status: 'ok',
          op: request.op, responder_peer_id: peer, kernel_id: provider.host_kernel_id,
          path: request.path, since_revision: request.since_revision || ''};
        const body = bodies.get(request.path);
        if (request.op === 'blob') {
          const bytes = Buffer.from(body.raw.subarray(request.offset, request.offset + request.length));
          if (request.path === cognitionPath && mode === 'tampered') bytes[0] ^= 1;
          Object.assign(reply, {content_hash: body.hash, offset: request.offset,
            total_size: body.raw.length, eof: request.offset + bytes.length === body.raw.length,
            bytes_base64: bytes.toString('base64')});
          if (request.path === cognitionPath && mode === 'withdrawn') reply.status = 'not_found';
        } else if (body) Object.assign(reply, {content_hash: body.hash, total_size: body.raw.length});
        else reply.document = {kernel_id: provider.host_kernel_id};
        yield Buffer.from(JSON.stringify(reply));
      }};
  }};
  const node = {getConnections: () => [connection], dial: async () => {throw new Error('No dial expected');}};
  const values = {tokenFor: () => '', DEFAULT_JSON_MAX_BYTES: 4000000,
    p2pDataRouteForUrl: () => ({route: {providerRecord: provider}, path: cognitionPath, sinceRevision: ''}),
    P2P: {fetchPublicJson: (record, path, init) => {
      options.push(init); return browser.fetchPublicJson(node, record, path, init);
    }},
    isHttpRequest: () => false,
  };
  const read = new Function(...Object.keys(values),
    section('async function fetchP2PJson(', 'async function fetchP2PArtifactBytes(')
      + section('const responsivePublicJsonJobs=new Map();', 'const planesOf=')
      + '\nreturn fetchResponsivePublicJson;')(...Object.values(values));
  return {node, read, options, requests, started, unblock, remainderStarted, unblockRemainder};
}

for (const mode of ['complete', 'withdrawn', 'tampered']) {
  test(`a ${mode} cognition read retains priority and verification between inventory chunks`, async () => {
    const f = fixture(mode);
    const pendingInventory = browser.fetchPublicJson(f.node, provider, inventoryPath, {priority: 50});
    await f.started;
    const pendingCognition = f.read(`libp2p://${peer}/${cognitionPath}`,
      {peerOnly: true, verifiedDirectFallback: true, priority: 75});
    const pendingBootstrap = browser.fetchPublicJson(f.node, provider, bootstrapPath, {priority: 100});
    f.unblock();
    let cognitionResult, bootstrapResult;
    try {
      // Hold the remaining inventory on the wire. Every cognition range must
      // already have arrived, and its complete verified result must be able to
      // settle independently while the inventory is still stalled.
      await f.remainderStarted;
      const bootstrapIndex = f.requests.findIndex(request => request.path === bootstrapPath);
      const cognitionIndex = f.requests.findIndex(request => request.path === cognitionPath);
      const nextInventoryIndex = f.requests.findIndex(request => request.path === inventoryPath
        && request.op === 'blob' && request.offset === chunkSize);
      assert.ok(bootstrapIndex < cognitionIndex, 'Bootstrap still precedes cognition');
      const cognitionChunks = f.requests.flatMap((request, index) =>
        request.path === cognitionPath && request.op === 'blob' ? [{...request, index}] : []);
      const expectedChunkCount = mode === 'withdrawn' ? 1
        : Math.ceil(bodies.get(cognitionPath).raw.length / chunkSize);
      assert.deepEqual(cognitionChunks.map(request => request.offset),
        Array.from({length: expectedChunkCount}, (_, index) => index * chunkSize),
        'All response ranges must transfer before the remaining inventory');
      assert.ok(cognitionChunks.every(request => request.index > cognitionIndex
        && request.index < nextInventoryIndex), 'Every cognition chunk retains precedence over inventory');
      [cognitionResult, bootstrapResult] = await Promise.all([pendingCognition, pendingBootstrap]);
    } finally {
      f.unblockRemainder();
      await Promise.allSettled([pendingInventory, pendingCognition, pendingBootstrap]);
    }
    const inventoryResult = await pendingInventory;
    assert.deepEqual(inventoryResult, inventory, 'The complete inventory still finishes with its hash intact');
    assert.deepEqual(bootstrapResult, {kernel_id: provider.host_kernel_id});
    assert.deepEqual(cognitionResult, mode === 'complete' ? cognition : null,
      'A withdrawn or changed response must never reach the UI');
    assert.equal(f.options[0].priority, 75, 'Both UI helper layers must preserve numeric caller priority');
  });
}
