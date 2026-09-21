import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const port = Number(process.env.IDENTITY_TEST_PORT || 5187), origin = `http://127.0.0.1:${port}`;
const id = 'a'.repeat(32), operation = 'b'.repeat(32), second = 'c'.repeat(32);
const revision = (number, data = {}) => ({ id, kind: 'persona', scope: '', revision: number,
  created: '2026-01-01T00:00:00Z', updated: `2026-01-0${number}T00:00:00Z`, data });
const revisions = [revision(1), revision(2, { character: 'Careful and curious', ocean: { openness: 0 }, vad: { valence: -1 } }),
  revision(3, { character: 'Learning from observed outcomes', ocean: { openness: 0.4 }, vad: { valence: 0, arousal: -1 },
    profile_revision: { revision: 3, actor: id, operation, source: operation, reason: 'Reconsidered after retained feedback.', evidence: [] } })];
await mkdir('.qa', { recursive: true });
const harness = resolve('.qa/identity-harness.tsx');
await writeFile(harness, `import { h, render } from 'preact';
import Identity from '../src/Identity';
import '../src/style.css';
const host = document.getElementById('identity-test')!;
(window as any).showPersona = (persona: any) => render(h(Identity, { persona, open: (id: string) => { (window as any).opened = id; } }), host);
(window as any).showPersona(${JSON.stringify(revisions[0])});`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; server.stdout.on('data', data => { output += data; }); server.stderr.on('data', data => { output += data; });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite exited: ${output}`);
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* Startup only. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Vite did not start: ${output}`);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 950 } });
  const errors = [], requests = []; let failHistory = false, wrongPersona = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/identity-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="identity-test" style="max-width:600px;padding:16px;box-sizing:border-box"></main><script type="module" src="/.qa/identity-harness.tsx"></script></body></html>' }));
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()); requests.push({ method: req.method(), path: url.pathname });
    if (url.pathname.endsWith('/revisions')) {
      if (failHistory) return route.fulfill({ status: 503, json: { error: 'Synthetic history failure' } });
      const later = Number(url.searchParams.get('after')) > 0;
      return route.fulfill({ json: { items: wrongPersona ? [{ ...revisions[2], id: second }] : later ? [revisions[2]] : revisions.slice(0, 2), next: later ? null : 2, sequence: 10 } });
    }
    if (url.pathname === `/api/actions/${operation}`) return route.fulfill({ json: { request: { id: operation, actor: id, kind: 'persona.update', source: operation, run: '', args: {} }, state: 'succeeded', created: revisions[2].updated, finished: revisions[2].updated, result: {}, error: null } });
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' } });
  });
  await page.goto(origin + '/identity-fixture');
  await expect(page.getByText('Not authored', { exact: true })).toHaveCount(8);
  assert.equal(requests.length, 0, 'opening a profile must not read history or create work');
  await page.evaluate(persona => window.showPersona(persona), revisions[2]);
  await expect(page.locator('meter[aria-label="Valence: 0 on a -1 to 1 scale"]')).toHaveJSProperty('value', 0);
  await expect(page.locator('meter[aria-label="Arousal: -1 on a -1 to 1 scale"]')).toHaveJSProperty('value', -1);
  await page.getByRole('button', { name: 'Show persona evolution' }).click();
  await expect(page.getByRole('article', { name: 'Identity revision 2', exact: true })).toContainText('Careful and curious');
  await expect(page.getByRole('img', { name: /^Openness:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next revisions' }).click();
  await expect(page.getByRole('article', { name: 'Identity revision 3', exact: true })).toContainText('Reconsidered after retained feedback.');
  await expect(page.getByText('Earlier revisions are not loaded.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect authoring receipt' }).click();
  await expect(page.locator('.identity-receipt')).toContainText('succeeded');
  failHistory = true;
  await page.getByRole('button', { name: 'Refresh history' }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic history failure');
  failHistory = false;
  await page.getByRole('button', { name: 'Retry history' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  wrongPersona = true;
  await page.getByRole('button', { name: 'Refresh history' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid or out-of-order revision');
  await expect(page.getByRole('article')).toHaveCount(0);
  wrongPersona = false;
  await page.getByRole('button', { name: 'Retry history' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'identity/history must fit a narrow screen');
  await page.screenshot({ path: '.qa/identity-mobile.png', fullPage: true });
  await page.evaluate(persona => window.showPersona(persona), { ...revisions[0], id: second });
  await expect(page.getByRole('region', { name: 'Persona evolution', exact: true })).toHaveCount(0);
  await expect(page.getByText('Not authored', { exact: true })).toHaveCount(8);
  assert.equal(requests.filter(req => req.method !== 'GET').length, 0, 'identity observation must be read-only');
  assert.deepEqual(errors, []);
  console.log('Identity production-component browser checks passed: missing scores, signed values, history, pagination, attribution, failure/retry, wrong-persona rejection, responsive layout, identity switching and read-only observation.');
} finally {
  await browser?.close(); server.kill('SIGTERM'); await rm(harness, { force: true });
}
