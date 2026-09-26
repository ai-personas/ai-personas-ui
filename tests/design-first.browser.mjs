/** Production Preact screens with synthetic HTTP data, not Rust or model execution. */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const port = 4178, origin = `http://127.0.0.1:${port}`;
const id = n => n.toString(16).padStart(32, '0');
const stamp = '2026-09-19T00:00:00Z';
const record = (n, kind, data) => ({ id: id(n), kind, scope: '', revision: 1, created: stamp, updated: stamp, data });
const records = [
  record(1, 'work', { title: 'Active fixture', brief: 'A recorded need, not generated work.', activity: { running: 1 }, pending_requests: 1, input_requests: 1, submissions: 2, personas: [id(10)] }),
  record(2, 'work', { title: 'Paused fixture', brief: 'A different original need.', activity: { paused: 1 }, pending_requests: 0, personas: [] }),
  record(3, 'work', { title: 'Historical fixture', brief: 'Historical review does not establish current activity.', assessments: { accepted: 3 }, submissions: 3 }),
  record(10, 'persona', { name: 'Mira fixture', character: 'An explicitly authored perspective.', provider: 'fixture-provider', model: 'fixture-only' }),
  record(11, 'persona', { name: 'Unpictured fixture', character: '<img src=x onerror=alert(1)> is literal authored text.' }),
  ...Array.from({ length: 5 }, (_, n) => record(30 + n, 'request', { purpose: `Question ${n + 1}`, status: 'open' })),
];
let browser, activePage, serverLog = '', checks = 0;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', b => { serverLog += b; }); server.stderr.on('data', b => { serverLog += b; });
async function ready() {
  for (let n = 0; n < 100; n++) { try { if ((await fetch(origin)).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Vite did not start: ' + serverLog);
}
async function step(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
try {
  await mkdir('.qa', { recursive: true }); await ready();
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' }); activePage = page;
    const errors = [], writes = []; let failRequests = true, failWork = false;
    // Isolate manual retry from the stream's legitimate initial resnapshot.
    // Release after the retry assertion, rather than racing an automatic recovery.
    let releaseWatermark;
    const watermarkGate = new Promise(resolve => { releaseWatermark = resolve; });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const req = route.request(), u = new URL(req.url());
      if (req.headers().authorization !== 'Bearer fixture-token') return route.fulfill({ status: 401, json: { error: 'Node token required' } });
      if (u.pathname === '/api/session') return route.fulfill({ json: {} });
      if (u.pathname === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': fixture keepalive\n\n' });
      if (req.method() !== 'GET') { writes.push(req.postData()); return route.fulfill({ status: 400, json: { error: 'No fixture operation allowed' } }); }
      if (u.pathname === '/api/records') {
        const q = u.searchParams, kinds = (q.get('kind') || '').split(',');
        if (q.get('kind') === 'work' && q.get('limit') === '1') await watermarkGate;
        if ((kinds.includes('request') && failRequests) || (kinds.includes('work') && failWork)) return route.fulfill({ status: 503, json: { error: 'Synthetic read failure' } });
        const found = records.filter(r => (!q.get('kind') || kinds.includes(r.kind)) && (!q.get('status') || r.data.status === q.get('status')) && (!q.get('query') || JSON.stringify(r.data).toLowerCase().includes(q.get('query').toLowerCase())));
        const after = Number(q.get('after') || 0), size = Math.min(Number(q.get('limit') || 24), kinds.includes('work') ? 2 : kinds.includes('request') ? 4 : 24);
        const items = found.slice(after, after + size), next = after + size < found.length ? after + size : null;
        return route.fulfill({ json: { items, next, sequence: 0 } });
      }
      if (u.pathname === '/api/network') return route.fulfill({ json: { id: 'fixture-node', peers: [], addresses: [] } });
      if (/^\/api\/personas\/[^/]+\/memory$/.test(u.pathname)) return route.fulfill({ json: { focus_card: null, items: [], connections: [], next: null } });
      if (/^\/api\/work\/[^/]+\/messages$/.test(u.pathname)) return route.fulfill({ json: { items: [], next: null, sequence: 0 } });
      if (u.pathname === '/api/models' || u.pathname === '/api/curricula') return route.fulfill({ json: [] });
      if (u.pathname.startsWith('/api/records/')) {
        const found = records.find(r => r.id === u.pathname.split('/').at(-1));
        return route.fulfill({ status: found ? 200 : 404, json: found || { error: 'Missing fixture record' } });
      }
      return route.fulfill({ status: 404, json: { error: 'No such fixture endpoint' } });
    });
    await page.goto(origin);
    await step(`${viewport.width}: invalid token stays on connection screen`, async () => {
      await page.getByLabel('Node token').fill('invalid-fixture-token');
      await page.getByRole('button', { name: 'Connect to node', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Could not connect');
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
      await page.getByLabel('Node token').fill('fixture-token');
      await page.getByRole('button', { name: 'Connect to node', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
    });
    await step(`${viewport.width}: request errors remain visible and recoverable`, async () => {
      const inbox = page.getByRole('region', { name: 'Requests needing your input' });
      await expect(inbox.getByRole('alert')).toContainText('Requests unavailable');
      failRequests = false; await inbox.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(inbox).toContainText('4 open requests on this page');
      await expect(inbox.getByRole('button', { name: /Question 4/ })).not.toBeVisible();
      await inbox.locator('summary').click();
      await expect(inbox.getByRole('button', { name: /Question 4/ })).toBeVisible();
      await inbox.getByRole('button', { name: 'Next requests', exact: true }).click();
      await expect(inbox.getByRole('button', { name: /Question 5/ })).toBeVisible();
      await inbox.getByRole('button', { name: 'Previous requests', exact: true }).click();
      await expect(inbox).toContainText('4 open requests on this page');
      releaseWatermark();
    });
    const work = page.getByRole('region', { name: 'Work records', exact: true });
    await step(`${viewport.width}: page-scoped work filters use recorded facts`, async () => {
      await expect(work.locator('.work-row')).toHaveCount(2);
      await work.getByRole('button', { name: 'Active', exact: true }).click();
      await expect(work.locator('.work-row')).toHaveCount(1);
      await expect(work.locator('.work-row')).toContainText('Active fixture');
      await work.getByRole('button', { name: 'Needs input', exact: true }).click();
      await expect(work.locator('.work-row')).toHaveCount(1);
      await work.getByRole('button', { name: 'Current work', exact: true }).click();
      await expect(work.locator('.work-row')).toHaveCount(2);
      await work.getByRole('button', { name: 'Next page', exact: true }).click();
      await expect(work.locator('.work-row')).toContainText('Historical fixture');
      await work.getByRole('button', { name: 'Active', exact: true }).click();
      await expect(work).toContainText('No work matches this page filter');
      await expect(work).toContainText('Filters apply to this page, not all work.');
      await work.getByRole('button', { name: 'Clear search and filters', exact: true }).click();
      await expect(work.locator('.work-row')).toHaveCount(2);
    });
    await step(`${viewport.width}: empty search is actionable and does not lose focus`, async () => {
      await page.getByRole('searchbox', { name: 'Search records' }).fill('no-matching-fixture');
      await expect(work.getByRole('heading', { name: 'No matching records', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await expect(page.getByRole('searchbox', { name: 'Search records' })).toBeFocused();
      await expect(work.locator('.work-row')).toHaveCount(2);
    });
    await step(`${viewport.width}: failed page reads do not masquerade as empty results`, async () => {
      failWork = true; await work.getByRole('button', { name: 'Next page', exact: true }).click();
      await expect(work.getByRole('alert')).toContainText('Could not load work');
      await expect(work.locator('.collection-empty')).toHaveCount(0);
      await expect(work.locator('.work-row')).toHaveCount(0);
      failWork = false; await work.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(work.locator('.work-row')).toContainText('Historical fixture');
      await work.getByRole('button', { name: 'Previous page', exact: true }).click();
      await expect(work.locator('.work-row')).toHaveCount(2);
    });
    await step(`${viewport.width}: skip link moves focus without changing the route`, async () => {
      await page.evaluate(() => history.replaceState(null, '', '#keep-route'));
      await page.getByRole('link', { name: 'Skip to content', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main-content')).toBeFocused();
      expect(new URL(page.url()).hash).toBe('#keep-route');
    });
    await page.screenshot({ path: `.qa/design-first-work-${viewport.width}.png`, fullPage: true });
    await step(`${viewport.width}: persona cards use authored character and honest placeholders`, async () => {
      await page.getByRole('button', { name: 'Personas', exact: true }).click();
      await expect(page.locator('.persona-cards .card')).toHaveCount(2);
      await expect(page.getByLabel('Image not authored')).toHaveCount(2);
      await expect(page.locator('.persona-cards img')).toHaveCount(0);
      await expect(page.locator('.persona-cards')).toContainText('<img src=x onerror=alert(1)>');
      await expect(page.getByText('Current model: fixture-provider / fixture-only', { exact: true })).not.toBeVisible();
      await page.locator('.model-disclosure summary').first().click();
      await expect(page.getByText('Current model: fixture-provider / fixture-only', { exact: true })).toBeVisible();
    });
    await page.screenshot({ path: `.qa/design-first-personas-${viewport.width}.png`, fullPage: true });
    await step(`${viewport.width}: learning opens an owned graph with an honest empty state`, async () => {
      await page.getByRole('button', { name: 'Learning', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Learning by persona', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Mira fixture', exact: true }).click();
      await expect(page.getByText('No lessons retained yet.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^\+ / })).toHaveCount(0);
    });
    for (const [view, title] of [['Environments', 'Give your work a place.'], ['Tools', 'No tools or capabilities recorded.']]) {
      await step(`${viewport.width}: honest ${view.toLowerCase()} empty state`, async () => {
        await page.getByRole('button', { name: view, exact: true }).click();
        await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (view !== 'Environments') await expect(page.getByRole('button', { name: /^\+ / })).toHaveCount(0);
      });
    }
    await page.screenshot({ path: `.qa/design-first-empty-${viewport.width}.png`, fullPage: true });
    await step(`${viewport.width}: no runtime writes, token persistence, page errors, or overflow`, async () => {
      expect(writes).toEqual([]); expect(errors).toEqual([]);
      expect(await page.evaluate(() => sessionStorage.getItem('personas-token'))).toBe(null);
      expect(await page.evaluate(() => localStorage.getItem('personas-token'))).toBe(null);
      await expect(page.getByRole('button', { name: 'Disconnect view', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.getByRole('button', { name: 'Disconnect view', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Connect to node', exact: true })).toBeVisible();
    });
    await page.close(); activePage = undefined;
  }
  await writeFile('.qa/design-first-results.json', JSON.stringify({ fixtureOnly: true, checks, result: 'passed', backend: 'Synthetic HTTP records; no Rust or model execution' }, null, 2));
  console.log(`${checks} design-first browser checks passed.`);
} catch (error) {
  console.error(error);
  if (activePage) await activePage.screenshot({ path: '.qa/design-first-failure.png', fullPage: true }).catch(() => {});
  await writeFile('.qa/design-first-failure.log', String(error) + '\n' + serverLog);
  process.exitCode = 1;
} finally { await browser?.close(); server.kill('SIGTERM'); }
