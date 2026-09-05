import assert from 'node:assert/strict';
import test from 'node:test';
import {NodeReadSession, fetchEventSource} from '../assets/node-connection.mjs';

const encode = value => new TextEncoder().encode(value);
function streamResponse(chunks) {
  return new Response(new ReadableStream({start(controller) {
    for (const chunk of chunks) controller.enqueue(chunk);
    controller.close();
  }}), {headers: {'Content-Type': 'text/event-stream'}});
}

test('tokens are scoped to the exact origin and path and disappear on disconnect', () => {
  const session = new NodeReadSession();
  session.set('https://node.example/api/', 'private-token');
  session.set('https://node.example/api/nested', 'nested-token');
  assert.equal(session.tokenFor('https://node.example/api/status'), 'private-token');
  assert.equal(session.tokenFor('https://node.example/api/nested/status'), 'nested-token');
  for (const url of ['https://node.example/api-other', 'https://node.example:4430/api/status',
    'http://node.example/api/status', 'https://node.example.evil/api/status',
    'https://user@node.example/api/status']) assert.equal(session.tokenFor(url), '');
  session.delete('https://node.example/api/nested');
  assert.equal(session.tokenFor('https://node.example/api/nested/status'), 'private-token');
  session.delete('https://node.example/api');
  assert.deepEqual(session.entries(), []);
  assert.equal(session.tokenFor('https://node.example/api/status'), '');
});

test('invalid node URLs and header-breaking tokens are rejected', () => {
  const session = new NodeReadSession();
  for (const base of ['javascript:alert(1)', 'https://user:pass@node.example',
    'https://node.example?token=secret', 'https://node.example/#secret'])
    assert.throws(() => session.set(base, 'token'));
  for (const token of ['secret\nHeader: value', 'secret with space', 'secret\tvalue', 'é'])
    assert.throws(() => session.set('https://node.example', token));
  assert.deepEqual(session.entries(), []);
});

test('SSE handles split UTF-8, CRLF, comments, multi-line data and complete messages', {timeout: 3000}, async () => {
  const wire = encode(': heartbeat\r\nid: current\r\nevent: persona_cognition\r\ndata: first 🧭\r\ndata: second\r\n\r\n');
  const events = [];
  const source = fetchEventSource('https://node.example/discovery/events', {
    fetchImpl: async () => streamResponse([...wire].map(byte => Uint8Array.of(byte))),
  });
  source.addEventListener('persona_cognition', event => {
    events.push({data: event.data, id: event.lastEventId}); source.close();
  });
  await source.done;
  assert.deepEqual(events, [{data: 'first 🧭\nsecond', id: 'current'}]);
  assert.equal(source.readyState, 2);
});

test('a final CR frame delimiter is accepted without waiting for another byte', {timeout: 3000}, async () => {
  const events = [];
  const source = fetchEventSource('https://node.example/events', {
    fetchImpl: async () => streamResponse([encode('data: complete\r\r')]),
  });
  source.addEventListener('message', event => { events.push(event.data); source.close(); });
  await source.done;
  assert.deepEqual(events, ['complete']);
});

test('reconnect uses fresh header credentials with no cookie or redirect forwarding', {timeout: 3000}, async () => {
  const calls = [];
  let credential = 'first-token';
  const source = fetchEventSource('https://node.example/events', {
    retryMs: 1,
    requestInit: () => ({headers: {Authorization: 'Bearer ' + credential}}),
    fetchImpl: async (url, init) => {
      calls.push({url, init});
      return streamResponse([encode(calls.length === 1 ? ': reconnect\n\n' : 'data: complete\n\n')]);
    },
  });
  source.onerror = () => { credential = 'second-token'; };
  source.addEventListener('message', () => source.close());
  await source.done;
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => call.init.headers.Authorization), ['Bearer first-token', 'Bearer second-token']);
  for (const {url, init} of calls) {
    assert.equal(url, 'https://node.example/events');
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
  }
});

test('disconnect aborts a pending connection and stops reconnection', {timeout: 3000}, async () => {
  let calls = 0;
  const source = fetchEventSource('https://node.example/events', {
    fetchImpl: (_url, {signal}) => {
      calls++;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {once: true});
        queueMicrotask(() => source.close());
      });
    },
  });
  await source.done;
  assert.equal(calls, 1);
  assert.equal(source.readyState, 2);
});

test('oversized or incomplete frames never become visible messages', {timeout: 3000}, async () => {
  for (const wire of ['data: ' + 'x'.repeat(100) + '\n\n', 'data: incomplete']) {
    const events = [];
    const source = fetchEventSource('https://node.example/events', {
      maxFrameBytes: 40, fetchImpl: async () => streamResponse([encode(wire)]),
    });
    source.addEventListener('message', event => events.push(event.data));
    source.onerror = () => source.close();
    await source.done;
    assert.deepEqual(events, []);
  }
});

test('a rejected token response is never interpreted as an event stream', {timeout: 3000}, async () => {
  const events = [];
  const source = fetchEventSource('https://node.example/events', {
    fetchImpl: async () => new Response('data: private\n\n', {status: 401,
      headers: {'Content-Type': 'text/event-stream'}}),
  });
  source.addEventListener('message', event => events.push(event.data));
  source.onerror = () => source.close();
  await source.done;
  assert.deepEqual(events, []);
});
