// Exercise the shipped read/cache boundary with independently delayed transport
// and verification. The real-node browser regression covers its stage consumer.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import test from 'node:test';

const assets = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assets, 'discovery.js'), 'utf8');
function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, start);
  return source.slice(first, last);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function fixture() {
  const requests = [], admitted = [], paints = [], verification = deferred();
  let now = 20000, delayVerification = false;
  const S = {telemetryRefusals: new Map()};
  const values = {
    S, Date: {now: () => now}, join: (base, rel) => `${base}/${rel}`,
    fetchJson: route => {
      const request = {route, ...deferred()}; requests.push(request); return request.promise;
    },
    verifyPublicCommunicationRoutes: async () => {},
    isPublicEntityTelemetryDocument: () => true,
    isPublicEntityIndexDocument: () => false,
    verifyPublicEntityDocument: async (_base, _rel, doc) => {
      if (delayVerification) await verification.promise;
      return doc.valid !== false;
    },
    _ingestVerifiedEntityRoutes: (base, doc) => admitted.push({base, doc}),
    _ingestVerifiedPersonaEntityFeed: () => '',
    scheduleSseCognitionRefresh: () => {},
    scheduleRealtimeRepaint: () => paints.push(now), log: () => {},
  };
  const api = new Function(...Object.keys(values),
    section('function fetchEntityFeed(base,rel){', '// Project the small, independently')
    + section('function _clearEntityFeedCache(base){', 'async function _refreshPeerInventory(')
    + '\nreturn {fetchEntityFeed,cachedEntityFeed,clear:_clearEntityFeedCache};'
  )(...Object.values(values));
  return {...api, S, requests, admitted, paints, verification,
    expire: () => { now += 5000; }, delayVerification: () => { delayVerification = true; }};
}

test('overlapping renders and awaited consumers share a read through signature verification', async () => {
  const f = fixture(); f.delayVerification();
  const pending = f.fetchEntityFeed('/node', 'person.json');
  for (let index = 0; index < 20; index++) {
    assert.equal(f.cachedEntityFeed('/node', 'person.json'), null);
    assert.equal(f.fetchEntityFeed('/node', 'person.json'), pending);
  }
  assert.equal(f.requests.length, 1);
  const doc = {name: 'Ada'}; f.requests[0].resolve(doc);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.cachedEntityFeed('/node', 'person.json'), null);
  assert.deepEqual(f.admitted, []);
  f.verification.resolve();
  assert.equal(await pending, doc);
  assert.equal(f.cachedEntityFeed('/node', 'person.json'), doc);
  assert.deepEqual(f.admitted, [{base: '/node', doc}]);
  assert.equal(f.paints.length, 1);
});

test('an old verified observation remains available until its single refresh completes', async () => {
  const f = fixture();
  const first = f.fetchEntityFeed('/node', 'environment.json');
  const before = {members: ['Ada']}; f.requests[0].resolve(before); await first;
  f.expire();
  for (let index = 0; index < 20; index++)
    assert.equal(f.cachedEntityFeed('/node', 'environment.json'), before);
  assert.equal(f.requests.length, 2);
  const refresh = f.fetchEntityFeed('/node', 'environment.json');
  const after = {members: ['Ada', 'Bea']}; f.requests[1].resolve(after); await refresh;
  assert.equal(f.cachedEntityFeed('/node', 'environment.json'), after);
});

test('invalidation drains the pending read without admitting its old value or duplicating it', async () => {
  const f = fixture();
  const old = f.fetchEntityFeed('/node', 'person.json');
  const other = f.fetchEntityFeed('/other', 'person.json');
  f.clear('/node');
  assert.equal(f.fetchEntityFeed('/node', 'person.json'), old);
  assert.equal(f.requests.length, 2);
  f.requests[0].resolve({name: 'Withdrawn'});
  f.requests[1].resolve({name: 'Independent'});
  assert.equal(await old, null); await other;
  assert.deepEqual(f.admitted.map(row => row.doc.name), ['Independent']);
  assert.equal(f.cachedEntityFeed('/node', 'person.json'), null);
  assert.equal(f.requests.length, 3);
  const current = f.fetchEntityFeed('/node', 'person.json');
  f.requests[2].resolve({name: 'Current'}); await current;
  assert.equal(f.cachedEntityFeed('/node', 'person.json').name, 'Current');
  assert.equal(f.cachedEntityFeed('/other', 'person.json').name, 'Independent');
});

test('invalid signatures and failed optional reads cannot become visible or cause a repaint loop', async () => {
  const f = fixture();
  const invalid = f.fetchEntityFeed('/node', 'person.json');
  f.requests[0].resolve({valid: false, name: 'Untrusted'});
  assert.equal(await invalid, null);
  assert.equal(f.cachedEntityFeed('/node', 'person.json'), null);
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.admitted, []);
  f.expire();
  const failed = f.fetchEntityFeed('/node', 'person.json');
  f.requests[1].reject(new Error('transport failed'));
  await assert.rejects(failed, /transport failed/);
  for (let index = 0; index < 20; index++)
    assert.equal(f.cachedEntityFeed('/node', 'person.json'), null);
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.admitted, []);
  assert.equal(f.paints.length, 2);
});
