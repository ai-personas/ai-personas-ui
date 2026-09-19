/** Real Preact UI against synthetic HTTP records, not live personas or engineering. */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const port = 4176, origin = `http://127.0.0.1:${port}`, id = n => n.toString(16).padStart(32, '0');
const work = id(1), person = id(2), file = id(7), badFile = id(8), nativeFile = id(9);
const stamp = '2026-09-16T00:00:00Z';
const record = (n, kind, data, scope = work) => ({ id: id(n), kind, scope, revision: 1, created: stamp, updated: stamp, data });
const bytes = Buffer.from('Exact fixture bytes. Not a real engineering result.\n');
const digest = createHash('sha256').update(bytes).digest('hex');
const records = [
  record(1, 'work', { title: 'Fixture house', brief: 'A fixture need, not a generated house.', personas: [person], activity: { running: 1 }, submissions: 1, assessments: { accepted: 1 }, pending_requests: 1 }, ''),
  record(2, 'persona', { name: 'Mira fixture', character: 'Interested in comparing alternatives.', model: 'fixture-only' }, ''),
  record(3, 'perspective', { title: 'Compare alternatives', owner: person, agenda: 'Explore within a common basis.', priorities: ['Compare first'], contribution: 'Two alternatives', concerns: ['Do not imply consensus'] }),
  record(4, 'commitment', { title: 'Unaccepted offer', status: 'offered', owner: person, offered_to: person }),
  record(5, 'submission', { title: 'Fixture submission', artifacts: [file, badFile, nativeFile], documents: [] }),
  record(6, 'finding', { title: 'Historical fixture review', verdict: 'accepted', submission: id(5), checks: [] }),
  record(7, 'artifact', { name: 'verified.txt', media_type: 'text/plain', digest, size: bytes.length }, person),
  record(8, 'artifact', { name: 'tampered.txt', media_type: 'text/plain', digest: '0'.repeat(64), size: bytes.length }, person),
  record(9, 'artifact', { name: 'large-native.cad', media_type: 'application/octet-stream', digest, size: 100_000_000 }, person),
  record(10, 'assumption', { title: 'Exploratory assumption', status: 'authorized_for_exploration', summary: 'Not a confirmed site fact.' }),
  record(11, 'birth', { title: 'Proposed peer', status: 'proposed', reason: 'Investigate uncertainty', parent: person, initialization_status: 'pending', membership_status: 'invited' }),
  record(12, 'working_agreement', { title: 'Same comparison basis', terms: 'Compare equivalent inputs.', endorsements: [] }),
  record(13, 'request', { purpose: 'Fixture clarification', status: 'open', evidence_required: 'An actual answer, not an acknowledgement.', artifacts: [] }),
  record(14, 'fragment', { title: 'A candidate lesson', content: 'Bind analysis to source versions.', applicability: 'When generating derived outputs', limitations: 'Usefulness not demonstrated.' }),
  record(15, 'run', { persona: person, status: 'running', note: 'Fixture run only.' }),
];
let serverLog = '', browser, checks = 0, activePage;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', b => { serverLog += b; }); server.stderr.on('data', b => { serverLog += b; });
async function step(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function ready() {
  for (let n = 0; n < 100; n++) { try { if ((await fetch(origin)).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Vite did not start: ' + serverLog);
}
try {
  await mkdir('.qa', { recursive: true }); await ready();
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport }); activePage = page; const errors = [], calls = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const req = route.request(), u = new URL(req.url()); calls.push(u.pathname + u.search);
      if (u.pathname === '/api/session') return route.fulfill({ json: {} });
      if (u.pathname === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': fixture keepalive\n\n' });
      if (u.pathname === '/api/network') return route.fulfill({ json: { id: 'fixture-peer', peers: [], addresses: [] } });
      if (u.pathname === '/api/models' || u.pathname === '/api/curricula') return route.fulfill({ json: [] });
      if (u.pathname === '/api/operations') { const body = req.postDataJSON(); writes.push(body); return route.fulfill({ json: { request: body, state: 'succeeded', result: {} } }); }
      if (u.pathname === '/api/records') {
        const q = u.searchParams, kinds = (q.get('kind') || '').split(',');
        const rows = records.filter(r => (!q.get('kind') || kinds.includes(r.kind)) && (!q.get('scope') || r.scope === q.get('scope')) && (!q.get('owner') || r.data.owner === q.get('owner') || r.data.persona === q.get('owner')) && (!q.get('status') || r.data.status === q.get('status')) && (!q.get('query') || JSON.stringify(r.data).toLowerCase().includes(q.get('query').toLowerCase())));
        return route.fulfill({ json: { items: rows, next: null, sequence: 0 } });
      }
      if (/\/records\/[^/]+\/revisions$/.test(u.pathname) || u.pathname === '/api/actions') return route.fulfill({ json: { items: [], next: null, sequence: 0 } });
      if (u.pathname.startsWith('/api/records/')) { const r = records.find(x => x.id === u.pathname.split('/').at(-1)); return route.fulfill({ status: r ? 200 : 404, json: r || { error: 'Missing fixture record' } }); }
      if (u.pathname.startsWith('/api/artifacts/')) return route.fulfill({ contentType: 'text/plain', body: bytes });
      return route.fulfill({ status: 404, json: { error: 'No such fixture endpoint' } });
    });
    await page.goto(origin); await page.getByLabel('Node token').fill('fixture-token'); await page.getByRole('button', { name: 'Connect to node', exact: true }).click();
    await step(`${viewport.width}: work opens in workspace`, async () => { await page.getByRole('button', { name: 'Open workspace ↗', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Fixture house', exact: true })).toBeVisible(); });
    await step(`${viewport.width}: no invented acceptance or balance`, async () => {
      await expect(page.getByLabel('Independent work status')).toContainText('Not established');
      await expect(page.getByText('No allowance is bound.', { exact: false })).toBeVisible();
    });
    for (const tab of ['Overview', 'Perspectives', 'Work & outcomes', 'People & agreements', 'Artifacts & evidence', 'Decisions & learning']) {
      await step(`${viewport.width}: ${tab}`, async () => {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#workspace-panel')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      });
    }
    await step(`${viewport.width}: offers and assumptions qualified`, async () => {
      await page.getByRole('tab', { name: 'Work & outcomes', exact: true }).click();
      await expect(page.getByLabel('Responsibilities & dependencies')).toContainText('acceptance not established');
      await expect(page.getByLabel('Conditional assumptions')).toContainText('not confirmation');
    });
    await step(`${viewport.width}: birth is not expertise`, async () => {
      await page.getByRole('tab', { name: 'People & agreements', exact: true }).click();
      await expect(page.getByLabel('Births & contributions')).toContainText('Birth is not membership');
    });
    await step(`${viewport.width}: historical acceptance unverifiable`, async () => {
      await page.getByRole('tab', { name: 'Artifacts & evidence', exact: true }).click();
      await expect(page.getByLabel('Assessments & applicability')).toContainText('unverifiable');
      await expect(page.getByLabel('Assessments & applicability').locator('.tone-neutral')).toContainText('accepted');
    });
    await step(`${viewport.width}: verified preview and focus return`, async () => {
      await page.getByLabel('Submitted versions & native files').locator('.record-references button').first().click();
      const dialog = page.getByRole('dialog', { name: 'Artifact viewer', exact: true });
      await expect(dialog).toContainText('Preview ready · bytes verified'); await expect(dialog.locator('pre')).toContainText('Exact fixture bytes');
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
      expect(await page.evaluate(() => document.activeElement?.textContent?.includes('Open artifact'))).toBe(true);
    });
    await step(`${viewport.width}: tampered bytes never render`, async () => {
      await page.getByLabel('Submitted versions & native files').locator('.record-references button').nth(1).click();
      const dialog = page.getByRole('dialog', { name: 'Artifact viewer', exact: true });
      await expect(dialog.getByRole('alert')).toContainText('digest mismatch'); await expect(dialog.locator('pre')).toHaveCount(0); await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: native preview is not fetched`, async () => {
      const before = calls.filter(c => c === '/api/artifacts/' + nativeFile).length;
      await page.getByLabel('Submitted versions & native files').locator('.record-references button').nth(2).click();
      await expect(page.getByRole('dialog', { name: 'Artifact viewer', exact: true })).toContainText('Native application required');
      expect(calls.filter(c => c === '/api/artifacts/' + nativeFile).length).toBe(before); await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: detail Escape cleanup`, async () => {
      await page.getByRole('button', { name: 'Historical fixture review', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Record details', exact: true })).toContainText('Reported applicability');
      await page.keyboard.press('Escape'); await expect(page.locator('dialog')).toHaveCount(0);
    });
    await page.getByRole('tab', { name: 'Perspectives', exact: true }).click();
    await expect(page.getByLabel('Individual agendas')).toContainText('Compare alternatives');
    await page.screenshot({ path: `.qa/workspace-${viewport.width}.png`, fullPage: true });
    await step(`${viewport.width}: keyboard tabs`, async () => {
      await page.getByRole('tab', { name: 'Perspectives', exact: true }).focus(); await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('tab', { name: 'Work & outcomes', exact: true })).toBeFocused();
    });
    await step(`${viewport.width}: tools and legacy create`, async () => {
      await page.getByRole('button', { name: 'Tools', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Tools', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Personas', exact: true }).click(); await page.getByRole('button', { name: '+ New persona', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Create', exact: true })).toContainText('authors its own character'); await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: no invented writes, token storage or page errors`, async () => {
      expect(writes).toEqual([]); expect(await page.evaluate(() => sessionStorage.getItem('personas-token'))).toBe(null); expect(errors).toEqual([]);
    });
    await page.close(); activePage = undefined;
  }
  await writeFile('.qa/workspace-results.json', JSON.stringify({ fixtureOnly: true, checks, result: 'passed', backend: 'mock HTTP records; no Rust or model execution' }, null, 2));
  console.log(`${checks} browser fixture checks passed.`);
} catch (error) {
  console.error(error); if (activePage) await activePage.screenshot({ path: '.qa/failure.png', fullPage: true }).catch(() => {});
  await writeFile('.qa/workspace-failure.log', String(error) + '\n' + serverLog); process.exitCode = 1;
} finally { await browser?.close(); server.kill('SIGTERM'); }
