// Each completed, verified persona response must be visible independently of
// another peer's slow request. Use the production scheduler and selectors.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assets = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assets, 'discovery.js'), 'utf8');
const priorityDeclaration = source.match(/const PUBLIC_COGNITION_READ_PRIORITY=(\d+);/);
assert.ok(priorityDeclaration, 'Cognition reads must have an explicit peer scheduling priority');
const PUBLIC_COGNITION_READ_PRIORITY = Number(priorityDeclaration[1]);
assert.ok(PUBLIC_COGNITION_READ_PRIORITY > 50 && PUBLIC_COGNITION_READ_PRIORITY < 100);
const {selectPriorityWindow, selectMonitoringBases, normalizeMonitoringBase} = await import(pathToFileURL(resolve(assets, 'network-view.mjs')));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const requests = [], admitted = [], verifications = [];
  const base = 'libp2p://node';
  let now = 20000;
  const S = {visiblePersonaIds: ['node/alice', 'node/bob'], liveByPersona: new Map(),
    streams: new Map(), publicCognitionFetchAfter: new Map(),
    recs: new Map(['alice', 'bob'].map(sid => [sid, {kind: 'persona', did: sid, _kernel: 'node'}])),
    order: ['alice', 'bob']};
  const values = {S, selectPriorityWindow, selectMonitoringBases,
    Date: {now: () => now}, NETWORK_LIMITS: {monitoredBases: 8, cognitionPersonas: 8},
    PUBLIC_PERSONA_COGNITION_LIMITS: {documentBytes: 1000000},
    PUBLIC_COGNITION_READ_PRIORITY,
    PUBLIC_COGNITION_SCHEMAS: new Set(['personaos-persona-public-cognition/3']),
    _cognitionInFlight: new Set(), _runningNow: () => false,
    kernelIsFocused: () => true, baseIsFocused: () => true,
    kernelForBase: route => route === base ? 'node' : '',
    nodeBaseForRecord: () => base, _nameFor: key => key,
    _personaRef: (value, kernel = 'node') => {
      const key = value.includes('/') ? value : `${kernel}/${value}`;
      return {key, sid: key.split('/')[1], kernel: key.split('/')[0]};
    },
    _signedPersonaEndpointId: key => key.split('/')[1],
    join: (route, path) => `${route}/${path}`, tokenFor: () => '',
    fetchResponsivePublicJson: (route, options) => {
      const request = {route, options, ...deferred()}; requests.push(request); return request.promise;
    },
    verifyPublicPersonaCognition: async (_base, doc, {personaId}) => {
      const verification = {doc, personaId, ...deferred()};
      verifications.push(verification);
      return verification.promise;
    },
    ingestPersonaCognitionReads: rows => admitted.push(...rows),
  };
  const start = source.indexOf('async function streamPersonaCognition(');
  const end = source.indexOf('function refreshLiveSection(', start);
  assert.ok(start >= 0 && end > start);
  const stream = new Function(...Object.keys(values), source.slice(start, end)
    + '\nreturn streamPersonaCognition;')(...Object.values(values));
  return {stream, requests, admitted, verifications, expire: () => { now += 13000; }};
}
const response = text => ({schema: 'personaos-persona-public-cognition/3', tier: 'public', text});

test('verified peer routes remain eligible for monitoring without an HTTP alias', () => {
  const peer = 'libp2p://12D3KooWAbC';
  assert.equal(normalizeMonitoringBase(peer), peer);
  assert.deepEqual(selectMonitoringBases([{base: peer, active: true}], {limit: 1}).bases, [peer]);
  for (const route of ['libp2p://user@peer', 'libp2p://peer:80', 'libp2p://peer/path',
    'libp2p://peer?x=1', 'libp2p://peer#x']) assert.equal(normalizeMonitoringBase(route), null);
});

test('a verified response appears while another persona is still loading', async () => {
  const f = fixture();
  const first = f.stream();
  assert.equal(f.requests.length, 2);
  assert.ok(f.requests.every(request => request.options.priority === PUBLIC_COGNITION_READ_PRIORITY));
  f.requests[0].resolve(response('Alice is ready'));
  await tick();
  assert.equal(f.verifications.length, 1);
  assert.deepEqual(f.admitted, [], 'verification must finish before presentation');
  f.verifications[0].resolve(true);
  await tick();
  assert.deepEqual(f.admitted.map(row => row.t.text), ['Alice is ready']);
  assert.equal(f.admitted[0].candidate.key, 'node/alice');
  f.requests[1].reject(new Error('Bob is unreachable'));
  assert.equal(await first, true);
});

test('a slow persona cannot block the next refresh of a ready persona or multiply requests', async () => {
  const f = fixture();
  const first = f.stream();
  f.requests[0].resolve(response('First response')); await tick();
  f.verifications[0].resolve(true); await tick();
  f.expire();
  const next = f.stream();
  assert.equal(f.requests.length, 3, 'only Alice needs another request');
  assert.match(f.requests[2].route, /\/alice\/thinking$/);
  await f.stream({force: true});
  assert.equal(f.requests.length, 3, 'both in-flight persona reads are shared');
  f.requests[2].resolve(response('Next response')); await tick();
  f.verifications[1].resolve(true); await next;
  assert.deepEqual(f.admitted.map(row => row.t.text), ['First response', 'Next response']);
  f.requests[1].resolve(response('Unverified Bob')); await tick();
  f.verifications[2].resolve(false); await first;
  assert.equal(f.admitted.length, 2, 'an unverified response never appears');
});
