import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const [base, node, out] = process.argv.slice(2);
if (!base || !node || !out) throw new Error('Usage: node tests/live.mjs URL NODE_DIRECTORY OUTPUT_DIRECTORY');
await mkdir(out, { recursive: true });
const token = (await readFile(join(node, 'token'), 'utf8')).trim();
const headers = { Authorization: `Bearer ${token}` };
async function get(path) {
  const response = await fetch(base + '/api' + path, { headers });
  assert(response.ok, path);
  return response.json();
}
async function records(kind) {
  const values = []; let after = 0;
  do {
    const page = await get(`/records?kind=${kind}&after=${after}&limit=100`);
    values.push(...page.items); after = page.next;
  } while (after !== null);
  return values;
}
const personas = (await records('persona')).filter(r => r.data.portrait).slice(0, 24);
const environments = (await records('environment')).filter(r => r.data.image).slice(0, 24);
const activeRuns = (await records('run')).filter(r => r.data.status === 'running' || r.data.status === 'queued');
assert(personas.length >= 2, 'Requires completed authored persona imagery');
assert(environments.length > 0, 'Requires an authored environment image');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(base);
  await page.getByLabel('Node token').fill(token);
  await page.getByRole('button', { name: 'Connect to node' }).click();
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await page.screenshot({ path: join(out, 'live-work.png'), fullPage: true });
  await page.getByRole('button', { name: 'Personas', exact: true }).click();
  for (const persona of personas) {
    const img = page.getByRole('img', { name: persona.data.name + ', authored image', exact: true });
    await expect(img).toBeVisible();
    assert(await img.evaluate(image => image.complete && image.naturalWidth > 0));
  }
  await page.screenshot({ path: join(out, 'live-personas.png'), fullPage: true });
  await page.getByRole('button', { name: 'Environments', exact: true }).click();
  for (const environment of environments) {
    await expect(page.getByRole('img', { name: environment.data.name + ', authored image', exact: true })).toBeVisible();
  }
  await page.screenshot({ path: join(out, 'live-environments.png'), fullPage: true });
  const start = performance.now();
  for (const name of ['Learning', 'Network', 'Work', 'Personas', 'Environments']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  const navigationMs = performance.now() - start;
  assert(navigationMs < 3000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Work', exact: true }).click();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  await page.screenshot({ path: join(out, 'live-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const report = {
    status: 'passed',
    observed: new Date().toISOString(),
    release: await get('/release'),
    personas: personas.map(p => ({ id: p.id, name: p.data.name, portrait: p.data.portrait })),
    environments: environments.map(e => ({ id: e.id, name: e.data.name, image: e.data.image })),
    workingRunsAtStart: activeRuns.map(r => r.id),
    navigationMs,
    pageErrors: errors,
    note: 'Read-only browser observation of the installed live model campaign. Screenshots and visible authored images are actual node data.'
  };
  await writeFile(join(out, 'live-browser.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, navigationMs, portraits: personas.length, environments: environments.length, out }));
} catch (error) {
  await page.screenshot({ path: join(out, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(join(out, 'failure.json'), JSON.stringify({ error: String(error), pageErrors: errors }, null, 2));
  throw error;
} finally {
  await browser.close();
}
