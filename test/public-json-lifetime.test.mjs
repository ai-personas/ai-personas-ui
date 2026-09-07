import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const assets = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assets, 'discovery.js'), 'utf8');
const settleStart = source.indexOf('function settleBeforeAbort(');
const settleEnd = source.indexOf('async function fetchP2PArtifactBytes(', settleStart);
const start = source.indexOf('const responsivePublicJsonJobs=new Map();');
const end = source.indexOf('const planesOf=', start);
assert.ok(settleStart >= 0 && settleEnd > settleStart && start >= 0 && end > start);

function reader({peer = true, operator = false} = {}) {
  const timers = [], reads = [];
  let release;
  const body = new Promise(resolve => {release = resolve;});
  const wait = signal => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    signal?.addEventListener('abort', () => reject(signal.reason), {once: true});
    body.then(resolve);
  });
  const values = {tokenFor: () => operator ? 'operator' : '', DEFAULT_JSON_MAX_BYTES: 4000000,
    AbortSignal: {timeout(milliseconds) {
      const controller = new AbortController(); timers.push({milliseconds, controller});
      return controller.signal;
    }},
    p2pDataRouteForUrl: () => peer ? {} : null, P2P: {fetchPublicJson() {}},
    isHttpRequest: () => !peer,
    fetchJson: async (_url, init) => {reads.push({kind: 'operator', ...init}); return {operator: true};},
    fetchP2PJson: async (_url, init) => {reads.push({kind: 'peer', ...init}); return wait(init.signal).catch(() => null);},
    fetch: async (_url, init) => {reads.push({kind: 'http', ...init}); return wait(init.signal);},
    readBoundedResponseBytes: async () => new TextEncoder().encode('{"http":true}'),
    TextDecoder,
  };
  const fetchPublic = new Function(...Object.keys(values),
    source.slice(settleStart, settleEnd) + source.slice(start, end)
      + '\nreturn fetchResponsivePublicJson;')(...Object.values(values));
  return {fetchPublic, timers, reads, release};
}

test('a peer snapshot survives time waiting behind a complete inventory', async () => {
  const state = reader();
  const pending = state.fetchPublic('libp2p://peer/personas/alice/thinking', {peerOnly: true});
  // Expire every whole-job timer while another queued transfer is progressing.
  // Per-request deadlines remain the responsibility of the real peer reader.
  for (const timer of state.timers) timer.controller.abort(new DOMException('deadline', 'TimeoutError'));
  await Promise.resolve();
  state.release({schema: 'current-signed-cognition'});
  assert.deepEqual(await pending, {schema: 'current-signed-cognition'});
  assert.equal(state.reads.length, 1);
  assert.equal(state.reads[0].timeoutMs, 12000);
});

test('one cancelled viewer does not cancel another viewer of the same peer snapshot', async () => {
  const state = reader();
  const controller = new AbortController();
  const first = state.fetchPublic('libp2p://peer/personas/alice/thinking', {signal: controller.signal});
  const second = state.fetchPublic('libp2p://peer/personas/alice/thinking');
  controller.abort();
  assert.equal(await first, null);
  assert.equal(state.reads.length, 1);
  state.release({shared: true});
  assert.deepEqual(await second, {shared: true});
});

test('anonymous HTTP reads keep their whole-request deadline', async () => {
  const state = reader({peer: false});
  const pending = state.fetchPublic('https://node/personas/alice/thinking');
  assert.equal(state.reads[0].kind, 'http');
  assert.equal(state.timers.length, 1);
  state.timers[0].controller.abort(new DOMException('deadline', 'TimeoutError'));
  assert.equal(await pending, null);
});

test('operator reads keep their authenticated path', async () => {
  const state = reader({operator: true});
  assert.deepEqual(await state.fetchPublic('https://node/personas/alice/thinking'), {operator: true});
  assert.deepEqual(state.reads.map(row => row.kind), ['operator']);
  assert.equal(state.timers.length, 0);
});
