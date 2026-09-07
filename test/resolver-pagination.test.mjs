import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const {reconcileResolverDirectory} = await import(
  pathToFileURL(resolve(assetRoot, 'global-directory.mjs')));
const limits = source.slice(source.indexOf('const NETWORK_LIMITS='),
  source.indexOf('\nconst NETWORK='));
const section = source.slice(source.indexOf('async function _loadGlobalNodes(){'),
  source.indexOf('async function admitVerifiedIdentityIndex('));

function harness(count, {cycle = false, stopAfter = Infinity, pageDelayMs = 0} = {}) {
  let now = Date.now();
  class ClockDate extends Date {static now() {return now;}}
  const announcements = Array.from({length: count}, (_, index) => ({
    kernel_id: `kernel:${String(index).padStart(16, '0')}`,
    base_url: `https://node-${index}.example.test`,
    expires_at: new Date(now + 45_000).toISOString(),
    sequence: 1, record_count: 1, public_discovery: true,
  }));
  const endpoint = 'https://resolver.example.test';
  const S = {resolverSnapshots: new Map(), globalAnnouncements: new Map(),
    globalPeers: new Set(), recs: new Map([['already-rendered', {}]])};
  const requests = [];
  const values = {
    S, URLSearchParams, Date: ClockDate,
    AbortSignal: {timeout: milliseconds => ({deadline: now + milliseconds, stopped: false,
      get aborted() {return this.stopped || now >= this.deadline;}})},
    globalDiscoveryEndpoints: () => [endpoint],
    fetchJson: async (url, {signal}) => {
      const request = new URL(url);
      if (request.pathname.endsWith('/bootstrap')) return {};
      if (requests.length >= stopAfter) {signal.stopped = true; return null;}
      const cursor = request.searchParams.get('cursor') || '';
      requests.push(cursor);
      if (now + pageDelayMs > signal.deadline) {now = signal.deadline; return null;}
      now += pageDelayMs;
      const offset = Number(cursor || 0);
      const nodes = announcements.slice(offset, offset + 100);
      const next = offset + nodes.length;
      return {nodes, total: count,
        next_cursor: cycle ? '100' : next < count ? String(next) : ''};
    },
    verifyGlobalEnvelope: async announcement => ({
      ok: Date.parse(announcement.expires_at) > now, ann: announcement}),
    join: (base, path) => base + '/' + path.replace(/^\//, ''),
    reconcileResolverDirectory,
    applyResolverDirectory: directory => {
      S.resolverSnapshots = directory.snapshots;
      S.globalAnnouncements = directory.announcements;
      S.globalPeers = directory.peers;
      S.globalTotal = directory.total;
      S.resolverFingerprint = directory.fingerprint;
    },
    rememberP2PBootstraps: () => [],
    renderGlobalKernels() {}, updateVitalsCounters() {}, notifyIncrementalGlobalDirectory() {},
    log() {}, refreshSystemView() {},
  };
  const load = new Function(...Object.keys(values),
    limits + section + '\nreturn _loadGlobalNodes;')(...Object.values(values));
  return {load, requests, announcements, snapshot: () => S.resolverSnapshots.get(endpoint),
    advance: milliseconds => {now += milliseconds;},
    renewTail: index => {
      for (const announcement of announcements.slice(index))
        announcement.expires_at = new Date(now + 45_000).toISOString();
    },
    seed: announcement => S.resolverSnapshots.set(endpoint, {
      announcements: new Map([[announcement.kernel_id, announcement]]),
      complete: true, total: 1, revision: '', updatedAt: now,
    }),
  };
}

for (const count of [401, 4_101]) {
  test(`a resolver's complete ${count}-node cursor walk reaches announcement verification`, async () => {
    const view = harness(count);
    const result = await view.load();
    assert.equal(result.announcements.length, count);
    assert.equal(view.requests.length, Math.ceil(count / 100));
    assert.equal(view.snapshot().complete, true);
  });
}

test('a repeated resolver cursor stops an incomplete walk without declaring it complete', async () => {
  const view = harness(401, {cycle: true});
  await view.load();
  assert.equal(view.requests.length, 2);
  assert.equal(view.snapshot().complete, false);
});

test('an expired transport deadline preserves the verified partial directory as incomplete', async () => {
  const view = harness(401, {stopAfter: 1});
  const result = await view.load();
  assert.equal(result.announcements.length, 100);
  assert.equal(view.snapshot().complete, false);
});

test('slow resolver pagination resumes across deadlines instead of repeating its first pages', async () => {
  const view = harness(501, {pageDelayMs: 1100});
  const first = await view.load();
  assert.equal(first.announcements.length, 400);
  assert.equal(view.snapshot().complete, false);
  const priorRequests = view.requests.length;
  const second = await view.load();
  assert.equal(view.requests[priorRequests], '400', 'Continue at the interrupted page');
  assert.equal(second.announcements.length, 501);
  assert.equal(view.snapshot().complete, false, 'A resumed walk is explicitly non-atomic');
  const afterCompleteWalk = view.requests.length;
  await view.load();
  assert.equal(view.requests[afterCompleteWalk], '', 'The following walk refreshes the directory head');
});

test('a resumed walk merges unexpired prior leases without claiming a complete replacement', async () => {
  const view = harness(501, {pageDelayMs: 1100});
  const prior = {...view.announcements[0], kernel_id: 'kernel:previous-lease',
    base_url: 'https://previous.example.test'};
  view.seed(prior);
  await view.load();
  const result = await view.load();
  assert.equal(result.announcements.length, 502);
  assert.ok(result.announcements.some(announcement => announcement.kernel_id === prior.kernel_id));
  assert.equal(view.snapshot().complete, false);
});

test('resuming a cursor does not extend the signed expiry of earlier pages', async () => {
  const view = harness(501, {pageDelayMs: 1100});
  await view.load();
  view.advance(45_001);
  view.renewTail(400);
  const result = await view.load();
  assert.equal(result.announcements.length, 101);
  assert.ok(result.announcements.every(announcement => Number(announcement.kernel_id.slice(7)) >= 400));
  assert.equal(view.snapshot().complete, false);
});
