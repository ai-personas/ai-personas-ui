/** Production UI and real restricted Node, with synthetic keys and local model
 * catalogues. No paid inference, live vendor authentication or task-quality claim. */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const root = mkdtempSync(join(tmpdir(), 'personas-settings-'));
const evidence = process.env.PERSONAS_BROWSER_EVIDENCE || join(root, 'evidence'); mkdirSync(evidence, { recursive: true });
const binary = process.env.PERSONAS_BIN || resolve('../ai-personas/target/debug/personas');
const keys = ['fixture-key-one', 'fixture-key-two', 'fixture-jev-key'];
let app, browser, page, port, url, checks = 0, discovery = 0, inferences = 0;
const errors = [], captured = [];
const provider = createServer(async (req, res) => {
  if (!req.url.startsWith('/models')) { inferences++; res.writeHead(400); res.end('{}'); return; }
  discovery++; captured.push(req.headers);
  res.setHeader('Content-Type', 'application/json');
  if (req.headers.authorization === 'Bearer rejected-key') { res.writeHead(401); res.end(JSON.stringify({ error: 'PRIVATE_AUTH_ECHO' })); return; }
  res.end(JSON.stringify(req.headers['x-goog-api-key'] ? { models: [{ name: 'models/fixture-model', supportedGenerationMethods: ['generateContent'] }] }
    : { data: [{ id: 'fixture-model' }], has_more: false }));
});
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) { for (let i = 0; i < 150; i++) { if (await fn()) return; await delay(100); } throw Error('Node did not become ready'); }
async function start() {
  const fd = openSync(join(root, 'node.log'), 'a');
  app = spawn(binary, ['serve', '--root', join(root, 'node'), '--listen', `127.0.0.1:${port}`, '--no-codex', '--ui', process.env.PERSONAS_UI_DIST || resolve('dist')], { stdio: ['ignore', fd, fd] }); closeSync(fd);
  url = `http://127.0.0.1:${port}`;
  await until(async () => { if (app.exitCode !== null) throw Error(readFileSync(join(root, 'node.log'), 'utf8')); try { return (await fetch(url + '/health')).ok; } catch { return false; } });
}
async function stop() { if (app && app.exitCode === null) { const exited = once(app, 'exit'); app.kill('SIGTERM'); await exited; } }
async function get(path) { const r = await fetch(url + '/api' + path); assert(r.ok); return r.json(); }
async function step(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
async function funding() {
  await page.getByRole('button', { name: 'Funding', exact: true }).click();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Provider connections' })).toBeVisible();
}
async function add(protocol, id) {
  await page.getByRole('button', { name: 'Add custom provider' }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect provider' });
  await dialog.getByLabel('Provider ID', { exact: true }).fill(id);
  await dialog.getByLabel('API protocol', { exact: true }).selectOption(protocol);
  const suffix = { responses: 'responses', anthropic: 'messages', gemini: 'models' }[protocol];
  await dialog.getByLabel('API endpoint', { exact: true }).fill(`http://127.0.0.1:${provider.address().port}/${suffix}`);
  await dialog.getByLabel('API key', { exact: true }).fill(keys[0]);
  await dialog.getByRole('button', { name: 'Add model', exact: true }).click();
  await dialog.getByLabel('Model ID', { exact: true }).fill('fixture-model');
  await dialog.getByLabel('Context tokens', { exact: true }).fill('1000000');
  await dialog.getByLabel('Maximum output tokens', { exact: true }).fill('1024');
  await dialog.getByLabel('Allow HTTP', { exact: false }).check();
  await dialog.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator('.provider-card').filter({ has: page.getByRole('heading', { name: id, exact: true }) });
  await expect(card).toContainText('1 available model'); return card;
}
try {
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening'); port = reservation.address().port; await new Promise(r => reservation.close(r));
  await start(); browser = await chromium.launch(); page = await browser.newPage({ viewport: { width: 1360, height: 900 } }); page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', async r => { if (r.url().includes('/api/') && r.headers()['content-type']?.includes('application/json')) {
    try { const text = await r.text(); for (const key of keys) if (text.includes(key)) errors.push('API returned a synthetic secret'); } catch { /* Stream closed on navigation. */ }
  } });
  await page.goto(url); await funding();
  await step('shared settings shows API-based OpenAI, Claude, Gemini and JEV entries', async () => {
    for (const name of ['OpenAI', 'Anthropic Claude', 'Google Gemini', 'TypeSafe.ai JEV']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Settings' }).press('Home');
    await expect(page.getByRole('tab', { name: 'Allowances' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Allowances' }).press('End');
    for (const name of ['Anthropic Claude', 'Google Gemini']) {
      await page.getByRole('button', { name: 'Connect ' + name, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Connect provider' });
      await expect(dialog.getByLabel('API key', { exact: true })).toHaveAttribute('type', 'password');
      await expect(dialog.getByLabel('API endpoint')).toHaveAttribute('readonly', '');
      await dialog.getByRole('button', { name: 'Close form' }).click();
    }
  });
  let card;
  await step('saving a key discovers models through the actual node and masks saved values', async () => {
    card = await add('responses', 'fixture-responses');
    assert(captured.some(h => h.authorization === 'Bearer ' + keys[0]));
    await expect(card).toContainText('API key saved');
    assert.equal(statSync(join(root, 'node/secrets/inference.json')).mode & 0o777, 0o600);
    assert(!JSON.stringify(await get('/settings/providers')).includes(keys[0]));
    await expect(page.locator('input[type=password]')).toHaveCount(0);
  });
  await step('replace key remains responsive and does not rediscover on each keystroke', async () => {
    await card.getByRole('button', { name: 'Edit fixture-responses' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit provider connection' });
    const key = dialog.getByLabel('Replace API key'); await expect(key).toHaveValue('');
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => { window.typing = []; document.addEventListener('input', () => { const t = performance.now(); requestAnimationFrame(() => window.typing.push(performance.now() - t)); }); });
    const before = discovery; await key.pressSequentially(keys[1], { delay: 20 }); await page.waitForTimeout(100);
    assert.equal(discovery, before); const values = await page.evaluate(() => window.typing.sort((a,b) => a-b));
    assert(values.length >= keys[1].length); assert(values[Math.floor(values.length * .95)] < 100);
    console.log(JSON.stringify({ typingP95: values[Math.floor(values.length * .95)], cpuSlowdown: 4 }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await dialog.getByRole('button', { name: 'Save connection' }).click();
    await expect(dialog).toHaveCount(0); await expect(card).toContainText('1 available model');
    assert(captured.some(h => h.authorization === 'Bearer ' + keys[1]));
  });
  await step('save survives node restart and browser reload without exposing the key', async () => {
    await stop(); await start(); await page.reload(); await funding();
    await expect(page.getByRole('button', { name: 'Edit fixture-responses' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit fixture-responses' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit provider connection' }); await expect(dialog.getByLabel('Replace API key')).toHaveValue('');
    await dialog.getByRole('button', { name: 'Close form' }).click();
    assert(await page.evaluate(() => !JSON.stringify(localStorage).includes('fixture-key') && !JSON.stringify(sessionStorage).includes('fixture-key')));
  });
  await step('native Claude and Gemini model discovery use their own API authentication', async () => {
    await add('anthropic', 'fixture-claude'); await add('gemini', 'fixture-gemini');
    assert(captured.some(h => h['x-api-key'] === keys[0] && h['anthropic-version'] === '2023-06-01'));
    assert(captured.some(h => h['x-goog-api-key'] === keys[0]));
  });
  await step('JEV key is saved separately from text models without making an evaluation', async () => {
    await page.getByRole('button', { name: 'Connect TypeSafe JEV' }).click();
    const dialog = page.getByRole('dialog', { name: 'Connect TypeSafe JEV' });
    await dialog.getByLabel('JEV API key').fill(keys[2]); await dialog.getByRole('button', { name: 'Save JEV key' }).click();
    await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: 'Replace JEV API key' })).toBeVisible();
    const catalog = await get('/inference'); assert(catalog.models.some(m => m.provider === 'typesafe' && m.capabilities.inference.operations.includes('choice')));
    assert(catalog.decision_models.some(m => m.provider === 'typesafe')); assert.equal(inferences, 0);
    assert.deepEqual((await get('/records?kind=grant')).items, []);
  });
  await step('Jev spending ceiling is editable in dollars and survives reload without resetting accounting', async () => {
    const form=page.locator('.jev-budget');
    await form.getByLabel('Total Jev limit (USD)', { exact: true }).fill('5');
    await form.getByLabel('Reason for Jev limit').fill('Explicit five dollar synthetic test ceiling');
    await form.getByRole('button', { name: 'Save Jev limit' }).click();
    await expect(form).toContainText('Limit: $5.000000');
    const budget=(await get('/settings/providers')).typesafe_budget;
    assert.equal(budget.limit_micro_usd, 5000000); assert.equal(budget.accounted_micro_usd, 0);
    await form.getByLabel('Total Jev limit (USD)', { exact: true }).fill('2');
    await form.getByLabel('Reason for Jev limit').fill('Reduce remaining ceiling');
    await form.getByRole('button', { name: 'Save Jev limit' }).click();
    await expect(form).toContainText('Limit: $2.000000');
    await page.reload(); await funding();
    await expect(page.getByLabel('Total Jev limit (USD)', { exact: true })).toHaveValue('2');
    assert.equal((await get('/settings/providers')).typesafe_budget.accounted_micro_usd, 0);
  });
  await step('bad key reports an access-safe error and removal clears the saved secret', async () => {
    await page.getByRole('button', { name: 'Edit fixture-responses' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit provider connection' }); await dialog.getByLabel('Replace API key').fill('rejected-key'); await dialog.getByRole('button', { name: 'Save connection' }).click();
    await expect(dialog).toHaveCount(0);
    card = page.locator('.provider-card').filter({ has: page.getByRole('heading', { name: 'fixture-responses', exact: true }) });
    await expect(card).toContainText('provider rejected this API key'); await expect(page.locator('body')).not.toContainText('PRIVATE_AUTH_ECHO');
    await card.getByRole('button', { name: 'Remove fixture-responses' }).click(); await card.getByRole('button', { name: 'Remove connection' }).click();
    await expect(card).toHaveCount(0); assert(!readFileSync(join(root, 'node/secrets/inference.json'), 'utf8').includes('rejected-key'));
  });
  await step('settings fits a narrow screen and observers create no work or model calls', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: join(evidence, 'settings-mobile.png'), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'Replace JEV API key' }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Save JEV key' })).toBeInViewport();
    await page.getByRole('dialog').getByRole('button', { name: 'Close form' }).click();
    assert.equal(inferences, 0); assert.equal((await get('/records?kind=call')).items.length, 0); assert.deepEqual(errors, []);
  });
  writeFileSync(join(evidence, 'report.json'), JSON.stringify({ checks, discovery, inferences, errors, fixtureOnly: true }, null, 2));
  console.log(JSON.stringify({ checks, evidence }));
} finally { if (browser) await browser.close(); await stop(); provider.closeAllConnections(); await new Promise(r => provider.close(r)); }
