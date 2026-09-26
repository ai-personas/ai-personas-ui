// Exercise the production transport with controlled, non-billable HTTP responses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, changed, changes, resourceRequest, HttpError } from '../src/api.ts';

function fixture(t) {
  connect('fixture');
  const calls = [], readers = [];
  const original = globalThis.fetch;
  globalThis.fetch = (url, init) => new Promise((resolve, reject) => {
    // Deliberately ignore transport abort: a response may already be buffered.
    calls.push({ url, signal: init.signal, headers: init.headers,
      reply: (body, status = 200) => resolve(new Response(JSON.stringify(body), { status })),
      fail: reject });
  });
  const read = (path = '/records/shared') => {
    const controller = new AbortController();
    const promise = resourceRequest(path, controller.signal);
    const result = promise.then(value => ({ value }), error => ({ error }));
    const reader = { controller, promise, result };
    readers.push(reader); return reader;
  };
  t.after(async () => {
    for (const reader of readers) reader.controller.abort();
    for (const call of calls) call.reply({});
    await Promise.all(readers.map(reader => reader.result));
    connect(''); globalThis.fetch = original;
  });
  return { calls, read };
}

const invalidate = () => changed({ kind: 'information_policy' });

test('new readers cannot join a transport started before an invalidation', async t => {
  const { calls, read } = fixture(t);
  const old = read(); invalidate();
  assert.equal(calls.length, 1, 'invalidation alone must not perform another read');
  const fresh = read(), peer = read();
  assert.equal(calls.length, 2, 'only same-generation readers share transport');
  calls[0].reply({ label: 'old' }); calls[1].reply({ label: 'fresh' });
  assert.deepEqual(await old.promise, { label: 'old' }); // Existing hooks fence this response.
  assert.deepEqual(await fresh.promise, { label: 'fresh' });
  assert.deepEqual(await peer.promise, { label: 'fresh' });
});

test('direct change dispatch fences transport before notifying new observers', async t => {
  const { calls, read } = fixture(t);
  read(); let fresh;
  const onChange = () => { fresh = read(); };
  changes.addEventListener('change', onChange, { once: true });
  t.after(() => changes.removeEventListener('change', onChange));
  changes.dispatchEvent(new CustomEvent('change', { detail: { kind: 'fragment' } }));
  assert.equal(calls.length, 2);
  calls[1].reply({ label: 'new observer' });
  assert.deepEqual(await fresh.promise, { label: 'new observer' });
});

test('other event types preserve ordinary in-flight coalescing', async t => {
  const { calls, read } = fixture(t);
  const a = read(); changes.dispatchEvent(new Event('unrelated'));
  const b = read(); assert.equal(calls.length, 1);
  calls[0].reply({ ok: true });
  assert.deepEqual(await a.promise, await b.promise);
});

test('old completion cannot remove the newer in-flight transport', async t => {
  const { calls, read } = fixture(t);
  const old = read(); invalidate(); const fresh = read();
  assert.equal(calls.length, 2);
  calls[0].reply({ old: true }); await old.promise;
  const peer = read(); assert.equal(calls.length, 2);
  calls[1].reply({ fresh: true });
  assert.deepEqual(await fresh.promise, { fresh: true });
  assert.deepEqual(await peer.promise, { fresh: true });
});

test('old failure cannot poison the newer in-flight transport', async t => {
  const { calls, read } = fixture(t);
  const old = read(); invalidate(); const fresh = read();
  assert.equal(calls.length, 2);
  calls[0].fail(new TypeError('old network failure'));
  assert.match((await old.result).error.message, /old network failure/);
  const peer = read(); assert.equal(calls.length, 2);
  calls[1].reply({ fresh: true });
  assert.deepEqual(await fresh.promise, await peer.promise);
});

test('aborting the old generation leaves the fresh transport alive and shareable', async t => {
  const { calls, read } = fixture(t);
  const old = read(); invalidate(); const fresh = read();
  assert.equal(calls.length, 2);
  old.controller.abort();
  assert.equal((await old.result).error.name, 'AbortError');
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(calls[1].signal.aborted, false);
  const peer = read(); assert.equal(calls.length, 2);
  calls[1].reply({ fresh: true });
  assert.deepEqual(await fresh.promise, await peer.promise);
});

test('aborting one fresh reader preserves its peer and the older transport', async t => {
  const { calls, read } = fixture(t);
  const old = read(); invalidate(); const a = read(), b = read();
  assert.equal(calls.length, 2);
  a.controller.abort(); assert.equal((await a.result).error.name, 'AbortError');
  assert.equal(calls[0].signal.aborted, false);
  assert.equal(calls[1].signal.aborted, false);
  calls[1].reply({ fresh: true }); assert.deepEqual(await b.promise, { fresh: true });
  assert.equal(calls[1].signal.aborted, true);
  assert.equal(calls[0].signal.aborted, false);
  calls[0].reply({ old: true }); await old.promise;
});

test('repeated invalidations are lazy and each actual generation can coalesce', async t => {
  const { calls, read } = fixture(t);
  read(); invalidate(); invalidate(); invalidate();
  assert.equal(calls.length, 1);
  read(); read(); assert.equal(calls.length, 2);
  invalidate(); const fresh = read(), peer = read();
  assert.equal(calls.length, 3);
  calls[2].reply({ latest: true });
  assert.deepEqual(await fresh.promise, await peer.promise);
});

test('settled responses are never retained as a completed payload cache', async t => {
  const { calls, read } = fixture(t);
  const first = read(); calls[0].reply({ first: true }); await first.promise;
  const second = read(); assert.equal(calls.length, 2);
  calls[1].reply({ second: true });
  assert.deepEqual(await second.promise, { second: true });
});

test('an already cancelled subscriber never starts or joins a transport', async t => {
  const { calls } = fixture(t);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(resourceRequest('/records/shared', controller.signal), { name: 'AbortError' });
  assert.equal(calls.length, 0);
});

test('session replacement cancels every generation without exposing late old-session data', async t => {
  const { calls, read } = fixture(t);
  const old = read(); invalidate(); const pending = read();
  assert.equal(calls.length, 2);
  connect('replacement');
  assert(calls[0].signal.aborted && calls[1].signal.aborted);
  calls[0].reply({ private_old_session: true }); calls[1].reply({ private_old_session: true });
  assert.equal((await old.result).error?.name, 'AbortError');
  assert.equal((await pending.result).error?.name, 'AbortError');
  const fresh = read(); assert.equal(calls.length, 3);
  assert.equal(calls[2].headers.Authorization, 'Bearer replacement');
  calls[2].reply({ new_session: true });
  assert.deepEqual(await fresh.promise, { new_session: true });
});

test('current-session server failures remain explicit HTTP errors for all shared readers', async t => {
  const { calls, read } = fixture(t);
  const a = read(), b = read();
  calls[0].reply({ error: 'Access denied' }, 403);
  for (const reader of [a, b]) {
    const { error } = await reader.result;
    assert(error instanceof HttpError);
    assert.equal(error.status, 403); assert.equal(error.message, 'Access denied');
  }
});

test('a buffered success cannot cross a connection change even when fetch ignores abort', async t => {
  const { calls, read } = fixture(t);
  const old = read();
  connect('replacement');
  calls[0].reply({ private_old_session: true });
  assert.equal((await old.result).error?.name, 'AbortError');
});
