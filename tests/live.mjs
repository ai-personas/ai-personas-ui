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
  assert(response.ok, path); return response.json();
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
const errors = [], imageChecks = [];
page.on('pageerror', error => errors.push(error.message));
// UI v1.2 bounds list previews. Keep original-file verification explicit rather
// than silently weakening an image requirement when a thumbnail is unavailable.
async function checkImages(name, entries, field) {
  await page.getByRole('button', { name, exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Search records', exact: true });
  for (const entry of entries) {
    await search.fill(entry.data.name);
    const card = page.locator('.compact-records > .card').filter({ has: page.getByRole('button', { name: entry.data.name, exact: true }) }).first();
    await expect(card).toBeVisible();
    const artifact = await get('/records/' + entry.data[field]);
    const d = artifact.data, raster = ['image/png', 'image/jpeg', 'image/webp'].includes(d.media_type);
    assert(raster, 'Authored image must use a supported raster format for this live image check');
    if (d.size <= 512_000) {
      const img = card.locator(`img[src="/api/artifacts/${entry.data[field]}"]`);
      await expect(img).toBeVisible();
      await expect.poll(() => img.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    } else {
      await expect(card.locator(`img[src="/api/artifacts/${entry.data[field]}"]`)).toHaveCount(0);
      await expect(card.getByLabel('Portrait preview unavailable; inspect the original in details')).toBeVisible();
    }
    await card.getByRole('button', { name: entry.data.name, exact: true }).click();
    await page.getByRole('button', { name: 'Inspect original image', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Artifact viewer', exact: true });
    assert(d.size <= 8_000_000, 'Live visual verification cannot qualify an image beyond the explicit preview limit; retain this incomplete check');
    await expect(viewer).toContainText('File loaded · bytes verified');
    await expect.poll(() => viewer.locator('.artifact-image').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    imageChecks.push({ record: entry.id, artifact: artifact.id, listPreview: d.size <= 512_000, originalDigestVerified: true });
    await page.getByRole('button', { name: 'Close viewer', exact: true }).click();
    await page.getByRole('button', { name: 'Close details', exact: true }).click();
  }
  await search.fill('');
}
try {
  await page.goto(base);
  const localSession = await fetch(base + '/api/session', { method: 'POST', headers: { 'X-Personas-Client': 'workspace' } });
  if (localSession.status === 401) {
    await page.getByLabel('Node token').fill(token);
    await page.getByRole('button', { name: 'Connect to node' }).click();
  } else if (!localSession.ok) throw Error('Node connection failed: ' + localSession.status);
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await page.screenshot({ path: join(out, 'live-work.png'), fullPage: true });
  await checkImages('Personas', personas, 'portrait');
  await page.screenshot({ path: join(out, 'live-personas.png'), fullPage: true });
  await checkImages('Environments', environments, 'image');
  await page.screenshot({ path: join(out, 'live-environments.png'), fullPage: true });
  const start = performance.now();
  for (const name of ['Learning', 'Tools', 'Network', 'Work', 'Personas', 'Environments']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  const navigationMs = performance.now() - start; assert(navigationMs < 3000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Work', exact: true }).click();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  await page.screenshot({ path: join(out, 'live-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const report = {
    status: 'passed', observed: new Date().toISOString(), release: await get('/release'),
    personas: personas.map(p => ({ id: p.id, name: p.data.name, portrait: p.data.portrait })),
    environments: environments.map(e => ({ id: e.id, name: e.data.name, image: e.data.image })),
    imageChecks, workingRunsAtStart: activeRuns.map(r => r.id), navigationMs, pageErrors: errors,
    note: 'Read-only browser observation of an installed live campaign. Image metadata, exact raster originals and hashes are checked; no persona competence claim.'
  };
  await writeFile(join(out, 'live-browser.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, navigationMs, portraits: personas.length, environments: environments.length, out }));
} catch (error) {
  await page.screenshot({ path: join(out, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(join(out, 'failure.json'), JSON.stringify({ error: String(error), pageErrors: errors, completedImageChecks: imageChecks }, null, 2));
  throw error;
} finally { await browser.close(); }
