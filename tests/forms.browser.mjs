/** Production bundle, synthetic API and SSE; no real account or paid inference. */
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import { resolve, extname } from 'node:path';

const id = n => n.toString(16).padStart(32, '0');
const record = (n, kind, data) => ({ id: id(n), kind, scope: '', revision: 1, created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z', data });
const models = ['alpha', 'beta'].map(name => ({ provider: 'codex', id: name, name: `Fixture ${name}`, capabilities: { billing: 'chatgpt_subscription' } }));
let catalog = { models, providers: [{ provider: 'codex', available: true, models: 2, message: 'Ready' }], checked: '2026-01-01T00:00:00Z' };
const roots = [], writes = [], reads = [], clients = new Set();
let sequence = 0, checks = 0, browser;
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }); res.write(': ready\n\n');
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  const json = value => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (u.pathname === '/api/session') return json({ authorized: 'local workspace' });
  if (u.pathname === '/api/deployment') return json({ funding_required: true });
  if (u.pathname === '/api/inference') { reads.push(u.pathname + u.search); return json(catalog); }
  if (u.pathname === '/api/records') {
    reads.push(u.pathname + u.search);
    const kind = u.searchParams.get('kind');
    return json({ items: kind === 'resource_root' ? roots : kind === 'work' ? Array.from({ length: 24 }, (_, i) => record(i + 100, 'work', { title: 'Fixture work ' + i, brief: 'Retained context '.repeat(100), personas: [], status: 'active' })) : [], sequence, next: null });
  }
  if (u.pathname.startsWith('/api/resources/')) return json({ calls: { production_remaining: 80, closeout_remaining: 20, uncertain: 0 } });
  if (u.pathname === '/api/operations') {
    let body = ''; for await (const chunk of req) body += chunk;
    const op = JSON.parse(body); writes.push(op);
    const root = record(roots.length + 1, 'resource_root', { status: 'active', reason: op.args.reason, limits: op.args.limits, bounds_configured: true });
    if (op.kind === 'resource.root.create') roots.push(root);
    return json({ request: op, state: 'succeeded', result: root });
  }
  if (u.pathname.startsWith('/api/')) return json({ items: [], next: null, sequence });
  const path = u.pathname === '/' ? '/index.html' : u.pathname;
  try {
    const file = resolve('dist', '.' + path); assert(file.startsWith(resolve('dist') + '/'));
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream' }); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
const emit = () => { const event = { sequence: ++sequence, kind: 'record', entity: id(999), data: { kind: 'resource_root', scope: '', data: {} } }; for (const client of clients) client.write('data: ' + JSON.stringify(event) + '\n\n'); };
async function step(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
try {
  await mkdir('.qa', { recursive: true }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport }); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
    await step(`${viewport.width}: search typing does not repeatedly render or read the collection`, async () => {
      await expect(page.locator('.work-row')).toHaveCount(24);
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.mutations = 0; new MutationObserver(list => window.mutations += list.length).observe(document.querySelector('.work-collection'), { childList: true, subtree: true, characterData: true, attributes: true }); });
      const before = reads.length;
      await page.getByLabel('Search records').pressSequentially('A continuous input with enough retained work to test rendering', { delay: 5 });
      assert.equal(await page.evaluate(() => window.mutations), 0, 'keystrokes mutated the collection before debounce');
      assert.equal(reads.length, before, 'keystrokes requested records before debounce');
      await page.waitForTimeout(400);
      assert.equal(reads.length - before, 1, 'one settled query should make one request');
    });
    await page.getByRole('button', { name: 'Funding', exact: true }).click(); await page.getByRole('button', { name: 'New allowance' }).click();
    const form = page.getByRole('dialog', { name: 'Create funding allowance' });
    await expect(form).toContainText('2 available models');
    await step(`${viewport.width}: allowance surface, internal scrolling and action remain usable`, async () => {
      assert.equal(await form.locator('form').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(255, 255, 255)');
      await expect(form.getByRole('button', { name: 'Create allowance', exact: true })).toBeInViewport();
      assert(await form.locator('.form-body').evaluate(e => e.scrollHeight > e.clientHeight));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `.qa/funding-${viewport.width}.png` });
    });
    await step(`${viewport.width}: typing stays responsive with CPU throttling and activity events`, async () => {
      const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluate(() => { window.frames = []; document.addEventListener('input', () => { const t = performance.now(); requestAnimationFrame(() => window.frames.push(performance.now() - t)); }); });
      const discoveryReads = reads.filter(path => path.startsWith('/api/inference')).length;
      const timer = setInterval(emit, 20), input = form.getByLabel('Purpose', { exact: true });
      const text = 'A complete allowance draft with responsive typing and retained updates. '.repeat(2);
      try { await input.pressSequentially(text, { delay: 10 }); } finally { clearInterval(timer); }
      await page.waitForTimeout(100); await expect(input).toHaveValue(text);
      assert.equal(reads.filter(path => path.startsWith('/api/inference')).length, discoveryReads, 'typing and record activity rediscovered models');
      const timing = await page.evaluate(() => { const samples = window.frames.sort((a,b) => a-b); return { count: samples.length, p95: samples[Math.floor(samples.length * .95)], maximum: samples.at(-1) }; });
      console.log(JSON.stringify({ viewport: viewport.width, cpuSlowdown: 4, timing }));
      assert(timing.count >= text.length); assert(timing.p95 < 100, 'input-to-frame p95 exceeds 100 ms under 4x CPU slowdown');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    });
    await step(`${viewport.width}: refresh keeps exact model selection and never substitutes a removed model`, async () => {
      const select = form.getByLabel('Price policy for model'); await select.selectOption(JSON.stringify(['codex', 'beta']));
      catalog = { ...catalog, models: [...models].reverse() }; await form.getByRole('button', { name: 'Refresh models' }).click();
      await expect(form.getByRole('button', { name: 'Refresh models' })).toBeEnabled(); await expect(select).toHaveValue(JSON.stringify(['codex', 'beta']));
      catalog = { ...catalog, models: [models[0]] }; await form.getByRole('button', { name: 'Refresh models' }).click();
      await expect(form).toContainText('Selected model unavailable'); await expect(form.getByRole('button', { name: 'Create allowance', exact: true })).toBeDisabled();
      await select.selectOption(JSON.stringify(['codex', 'alpha']));
    });
    await step(`${viewport.width}: subscription accounting is explicit and retains finite limits`, async () => {
      await form.getByLabel('Use included subscription usage, with no per-token charge').check();
      await expect(form).toContainText('plan limits still apply');
      await form.getByRole('button', { name: 'Create allowance', exact: true }).click(); await expect(form).toHaveCount(0);
      const bounds = writes.at(-1).args.bounds;
      assert.equal(writes.at(-1).kind, 'resource.bounds.configure'); assert.equal(bounds.cost_units, 0); assert.equal(bounds.prices[0].model, 'alpha');
      assert.equal(bounds.prices[0].input_units_per_million, 0); assert.match(bounds.prices[0].evidence, /Operator chose included/);
      assert(bounds.tokens > bounds.closeout_tokens && bounds.closeout_tokens > 0); assert.equal(bounds.effect_operations, 0);
    });
    await step(`${viewport.width}: failed discovery has actionable status and can recover without restart`, async () => {
      catalog = { ...catalog, models: [], providers: [{ provider: 'codex', available: false, models: 0, message: 'Run codex login on the node host, then refresh models.' }] };
      await page.getByRole('button', { name: 'New allowance' }).click();
      await expect(form).toContainText('Run codex login'); await expect(form.getByRole('button', { name: 'Create allowance', exact: true })).toBeDisabled();
      catalog = { models, providers: [{ provider: 'codex', available: true, models: 2, message: 'Ready' }], checked: 'fixture' };
      await form.getByRole('button', { name: 'Refresh models' }).click(); await expect(form).toContainText('2 available models');
      await page.keyboard.press('Escape'); await expect(form).toHaveCount(0); await expect(page.getByRole('button', { name: 'New allowance' })).toBeFocused();
      assert.deepEqual(errors, []);
    });
    await page.close();
  }
  console.log(`${checks} production form browser checks passed.`);
} finally { await browser?.close(); for (const client of clients) client.end(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
