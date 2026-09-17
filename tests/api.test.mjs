import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, operate, watch, label, token } from '../src/api.ts';
const success = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

test('token begins in memory and authored titles are type checked', () => {
  assert.equal(token, '');
  assert.equal(label({ kind: 'work', data: { title: { bad: true } } }), 'Untitled work');
});
test('ambiguous network retry reuses exact operation identity and payload', async () => {
  connect('test'); const bodies = []; let attempt = 0;
  globalThis.fetch = async (_, init) => { bodies.push(init.body); if (!attempt++) throw new TypeError('connection lost'); return success({ state: 'succeeded', result: {} }); };
  await assert.rejects(operate('request.respond', { request: 'r', text: 'hello', artifacts: [] }), /connection lost/);
  await operate('request.respond', { artifacts: [], text: 'hello', request: 'r' });
  assert.equal(bodies[0], bodies[1]);
});
test('concurrent duplicate clicks share one inflight request', async () => {
  connect('test'); let resolve, calls = 0;
  globalThis.fetch = () => { calls++; return new Promise(r => { resolve = r; }); };
  const a = operate('run.pause', { id: 'run' }), b = operate('run.pause', { id: 'run' });
  assert.equal(a, b); assert.equal(calls, 1);
  resolve(success({ state: 'succeeded', result: {} })); await a;
});
test('definite action failure is surfaced; corrected attempt receives a new ID', async () => {
  connect('test'); const bodies = [];
  globalThis.fetch = async (_, init) => { bodies.push(JSON.parse(init.body)); return success({ state: bodies.length === 1 ? 'failed' : 'succeeded', error: 'bad input', result: {} }); };
  await assert.rejects(operate('run.resume', { id: 'r' }), /bad input/);
  await operate('run.resume', { id: 'r' }); assert.notEqual(bodies[0].id, bodies[1].id);
});
test('server error does not mint a second action identity on retry', async () => {
  connect('test'); const bodies = [];
  globalThis.fetch = async (_, init) => { bodies.push(init.body); return bodies.length === 1 ? new Response('{"error":"interrupted"}', { status: 503 }) : success({ state: 'succeeded' }); };
  await assert.rejects(operate('run.pause', { id: 'r' }), /interrupted/);
  await operate('run.pause', { id: 'r' }); assert.equal(bodies[0], bodies[1]);
});
test('initial session failure is retried; abort stops the retry loop', async () => {
  connect('test'); const c = new AbortController(); let sessions = 0; const statuses = [];
  globalThis.fetch = async url => {
    if (url === '/api/session') { sessions++; if (sessions === 1) throw new TypeError('offline'); return success({}); }
    if (url.startsWith('/api/records')) return success({ items: [], next: null, sequence: 0 });
    return new Response('data: {"sequence":1,"kind":"work","entity":"r","data":{}}\r\n\r\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  const safety = setTimeout(() => c.abort(), 5000);
  await watch(c.signal, s => { statuses.push(s); if (s === 'Connected') c.abort(); });
  clearTimeout(safety); assert.equal(sessions, 2); assert.ok(statuses.some(s => s.startsWith('Reconnecting'))); assert.ok(statuses.includes('Connected'));
});
test('uncertain receipt is not treated as success and retains its operation ID', async () => {
  connect('test'); const bodies = [];
  globalThis.fetch = async (_, init) => { bodies.push(init.body); return success({ state: bodies.length === 1 ? 'uncertain' : 'succeeded', result: {} }); };
  await assert.rejects(operate('run.cancel', { id: 'r' }), /outcome is uncertain/);
  await operate('run.cancel', { id: 'r' }); assert.equal(bodies[0], bodies[1]);
});
