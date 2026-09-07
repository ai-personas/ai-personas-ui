import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const limits = source.slice(source.indexOf('const P2P_ROUTE_LIMITS='),
  source.indexOf('function boundedP2PBootstrapSource'));
const section = source.slice(source.indexOf('async function refreshP2PRendezvous(){'),
  source.indexOf('async function initP2P(){'));

function provider(number) {
  const name = `peer-${String(number).padStart(2, '0')}`;
  const address = {
    toString: () => `/ip4/192.0.2.${number}/tcp/443/wss/p2p/${name}`,
    getComponents: () => [{name: 'p2p', value: name}],
  };
  return {id: {toString: () => name, equals: () => false}, multiaddrs: [address]};
}

function harness({count = 12, directCount = count, failed = new Set(), unverified = new Set(),
  firstBucketDelayMs = 0} = {}) {
  let now = 2_000_000_000_000;
  let bucketsRequested = false;
  let providers = Array.from({length: count}, (_, index) => provider(index + 1));
  let bucketNames = ['current', 'previous', 'next'];
  const attempts = [], reconciled = [];
  const P2P = {
    _rendezvousConfigured: true,
    node: {
      peerId: 'viewer',
      dial: async target => {
        const name = target.getComponents().at(-1).value;
        attempts.push({name, at: now});
        if (failed.has(name)) throw new Error('unavailable route');
      },
      contentRouting: {async *findProviders() {yield* providers;}},
    },
    rendezvousCids: async () => {
      if (!bucketsRequested) {now += firstBucketDelayMs; bucketsRequested = true;}
      return bucketNames.map(cid => ({cid}));
    },
    browserDialableMultiaddrs: addresses => addresses,
    async findRendezvousProviders(_cid, {onProvider}) {
      const direct = providers.slice(0, directCount);
      for (const candidate of direct) onProvider(candidate);
      return {providers: direct};
    },
    fetchProviderInventory: async candidate => ({peer: candidate.id.toString()}),
  };
  const values = {
    P2P,
    Date: {now: () => now},
    AbortSignal: {timeout: () => ({aborted: false}), any: () => ({aborted: false})},
    verifiedRouteHintsFromP2PResult: async result => ({routeHints: unverified.has(result.peer)
      ? [] : [{kernel: result.peer, base: `libp2p://${result.peer}`}]}),
    normalizedPeerRouteBase: value => value,
    _reconcileP2PRouteHint: async hint => {
      reconciled.push({name: hint.kernel, at: now});
      return {accepted: true, count: 1};
    },
    log() {},
  };
  const refresh = new Function(...Object.keys(values),
    limits + section + '\nreturn refreshP2PRendezvous;')(...Object.values(values));
  return {refresh, attempts, reconciled,
    advance: milliseconds => {now += milliseconds;},
    replace: (candidates, buckets) => {providers = candidates; bucketNames = buckets;},
  };
}

test('stable rendezvous results eventually reconcile every peer across scan budgets', async () => {
  const view = harness();
  for (let scan = 0; scan < 3; scan++) {
    const before = view.reconciled.length;
    await view.refresh();
    assert.ok(view.reconciled.length - before <= 8, 'The existing work budget stays bounded');
    view.advance(60_000);
  }
  assert.deepEqual([...new Set(view.reconciled.map(row => row.name))].sort(),
    Array.from({length: 12}, (_, index) => provider(index + 1).id.toString()));
});

test('a later partial DHT response preserves previously queued routes in live buckets', async () => {
  const view = harness();
  await view.refresh();
  view.advance(60_000);
  view.replace(Array.from({length: 8}, (_, index) => provider(index + 1)),
    ['current', 'previous', 'next']);
  await view.refresh();
  assert.deepEqual([...new Set(view.reconciled.map(row => row.name))].sort(),
    Array.from({length: 12}, (_, index) => provider(index + 1).id.toString()));
});

test('iterative candidates beyond the first direct window remain queued for later scans', async () => {
  const view = harness({count: 20, directCount: 16});
  for (let scan = 0; scan < 3; scan++) {
    await view.refresh();
    view.advance(60_000);
  }
  assert.deepEqual([...new Set(view.reconciled.map(row => row.name))].sort(),
    Array.from({length: 20}, (_, index) => provider(index + 1).id.toString()));
});

test('alternate successful addresses for one provider do not consume other providers turns', async () => {
  const view = harness();
  const first = provider(1);
  first.multiaddrs = Array.from({length: 8}, (_, index) => ({
    toString: () => `/ip4/192.0.2.1/tcp/${443 + index}/wss/p2p/peer-01`,
    getComponents: () => [{name: 'p2p', value: 'peer-01'}],
  }));
  view.replace([first, ...Array.from({length: 11}, (_, index) => provider(index + 2))],
    ['current', 'previous', 'next']);
  await view.refresh();
  assert.equal(new Set(view.reconciled.map(row => row.name)).size, 8);
  assert.equal(view.reconciled.filter(row => row.name === 'peer-01').length, 1);
});

test('failed early peers cannot starve later peers and retries keep their delay', async () => {
  const failed = new Set(['peer-01', 'peer-02', 'peer-03', 'peer-04']);
  const view = harness({failed});
  await view.refresh();
  view.advance(60_000);
  await view.refresh();
  assert.deepEqual([...new Set(view.reconciled.map(row => row.name))].sort(),
    Array.from({length: 8}, (_, index) => provider(index + 5).id.toString()));

  const unavailable = harness({count: 1, failed: new Set(['peer-01'])});
  await unavailable.refresh();
  unavailable.advance(10_000);
  await unavailable.refresh();
  assert.equal(unavailable.attempts.length, 1);
  unavailable.advance(20_000);
  await unavailable.refresh();
  assert.equal(unavailable.attempts.length, 2, 'A failed route is retried after the existing delay');
});

test('unresolved routes leave the queue after their temporal buckets expire', async () => {
  const view = harness();
  await view.refresh();
  const before = view.attempts.length;
  view.advance(45 * 60_000);
  view.replace([provider(13)], ['later-current', 'later-previous', 'later-next']);
  await view.refresh();
  assert.deepEqual(view.attempts.slice(before).map(row => row.name), ['peer-13']);
});

test('route retry pacing starts when the actual attempt begins', async () => {
  const view = harness({count: 1, failed: new Set(['peer-01']), firstBucketDelayMs: 6_000});
  await view.refresh();
  view.advance(24_000);
  await view.refresh();
  assert.equal(view.attempts.length, 1, 'Thirty seconds since scan start is only 24 since the attempt');
  view.advance(6_000);
  await view.refresh();
  assert.equal(view.attempts.length, 2);
  assert.equal(view.attempts[1].at - view.attempts[0].at, 30_000);
});

test('queued candidates still require verified route hints before reconciliation', async () => {
  const view = harness({count: 1, unverified: new Set(['peer-01'])});
  await view.refresh();
  view.advance(60_000);
  await view.refresh();
  assert.equal(view.attempts.length, 2);
  assert.equal(view.reconciled.length, 0);
});

test('slow direct peers cannot consume every scan before iterative discovery starts', async () => {
  let now = 2_000_000_000_000;
  const waiting = [], admitted = [], lookups = [];
  const direct = Array.from({length: 16}, (_, index) => provider(index + 1));
  const healthy = provider(17);
  const timeout = milliseconds => ({deadline: now + milliseconds,
    get aborted() {return now >= this.deadline;}});
  const values = {
    Date: {now: () => now},
    AbortSignal: {timeout, any: signals => ({
      deadline: Math.min(...signals.map(signal => signal.deadline)),
      get aborted() {return now >= this.deadline;},
    })},
    P2P: {
      _rendezvousConfigured: true,
      node: {
        peerId: 'viewer',
        dial: async (target, {signal}) => {
          if (target.getComponents().at(-1).value === 'peer-17') return;
          await new Promise(resolve => waiting.push({at: signal.deadline, resolve}));
          throw new Error('direct dial timed out');
        },
        contentRouting: {async *findProviders(cid) {
          lookups.push(cid);
          yield* [...direct, healthy];
        }},
      },
      rendezvousCids: async () => ['current', 'previous', 'next'].map(cid => ({cid})),
      browserDialableMultiaddrs: addresses => addresses,
      findRendezvousProviders: async (_cid, {onProvider}) => {
        for (const candidate of direct) onProvider(candidate);
        return {providers: direct};
      },
      fetchProviderInventory: async candidate => ({peer: candidate.id.toString()}),
    },
    verifiedRouteHintsFromP2PResult: async result => ({routeHints: [
      {kernel: result.peer, base: `libp2p://${result.peer}`},
    ]}),
    normalizedPeerRouteBase: value => value,
    _reconcileP2PRouteHint: async hint => {
      admitted.push(hint.kernel);
      return {accepted: true, count: 1};
    },
    log() {},
  };
  const refresh = new Function(...Object.keys(values),
    limits + section + '\nreturn refreshP2PRendezvous;')(...Object.values(values));
  for (let scan = 0; scan < 3; scan++) {
    let finished = false;
    const work = refresh().finally(() => {finished = true;});
    for (let tick = 0; !finished && tick < 100; tick++) {
      for (let microtask = 0; microtask < 100; microtask++) await Promise.resolve();
      if (finished) break;
      assert.ok(waiting.length, 'The virtual scan must be awaiting an actual timed dial');
      now = Math.min(...waiting.map(wait => wait.at));
      for (let index = waiting.length - 1; index >= 0; index--)
        if (waiting[index].at <= now) waiting.splice(index, 1)[0].resolve();
    }
    assert.equal(finished, true, 'Each scan remains within its original deadline');
    await work;
    now += 60_000;
  }
  assert.ok(lookups.length >= 3, 'Iterative discovery must get its own turn in every scan');
  assert.ok(admitted.includes('peer-17'), 'The healthy iterative-only route must be admitted');
});
