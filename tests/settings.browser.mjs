/** Production UI and real restricted Node, with synthetic keys and local model
 * catalogues. No paid inference, live vendor authentication or task-quality claim. */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { deflateSync, crc32 } from 'node:zlib';
import assert from 'node:assert/strict';

const root = mkdtempSync(join(tmpdir(), 'personas-settings-'));
const evidence = process.env.PERSONAS_BROWSER_EVIDENCE || join(root, 'evidence'); mkdirSync(evidence, { recursive: true });
const binary = process.env.PERSONAS_BIN || resolve('../ai-personas/target/debug/personas');
const keys = ['fixture-key-one', 'fixture-key-two', 'fixture-jev-key'];
let app, browser, page, port, url, checks = 0, discovery = 0, inferences = 0;
const errors = [], captured = [];
// Synthetic blank pixels exercise the real decoder and portrait path, not quality.
function pngChunk(type, data) {
  const content = Buffer.concat([Buffer.from(type), data]), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(content)); return Buffer.concat([length, content, crc]);
}
const dimensions = Buffer.alloc(13); dimensions.writeUInt32BE(1024, 0); dimensions.writeUInt32BE(1024, 4); dimensions[8] = 8; dimensions[9] = 2;
const avatarPNG = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', dimensions), pngChunk('IDAT', deflateSync(Buffer.alloc(1024 * (1 + 1024 * 3)))), pngChunk('IEND', Buffer.alloc(0))]);
const provider = createServer(async (req, res) => {
  if (req.url === '/images/generations') {
    inferences++; const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks)); assert.equal(input.model, 'gpt-image-1-mini'); assert.equal(input.quality, 'low'); assert.equal(input.size, '1024x1024');
    assert(input.prompt.includes('synthetic avatar integration'));
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ b64_json: avatarPNG.toString('base64') }], usage: { input_tokens: 100, output_tokens: 272, total_tokens: 372, input_tokens_details: { text_tokens: 100, image_tokens: 0 } } })); return;
  }
  if (!req.url.startsWith('/models')) { inferences++; res.writeHead(400); res.end('{}'); return; }
  discovery++; captured.push(req.headers);
  res.setHeader('Content-Type', 'application/json');
  if (req.headers.authorization === 'Bearer rejected-key') { res.writeHead(401); res.end(JSON.stringify({ error: 'PRIVATE_AUTH_ECHO' })); return; }
  res.end(JSON.stringify(req.headers['x-goog-api-key'] ? { models: [{ name: 'models/fixture-model', supportedGenerationMethods: ['generateContent'] }] }
    : { data: [{ id: 'fixture-model' }, { id: 'gpt-image-1-mini' }], has_more: false }));
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
  await step('Jev remains a funding choice once and cannot be chosen as a primary persona model', async () => {
    await page.getByRole('button', { name: 'Personas', exact: true }).click();
    await page.locator('.page-heading').getByRole('button', { name: '+ New persona', exact: true }).click();
    const starting = page.getByLabel('Starting model');
    await expect(starting.locator('option')).toHaveCount(3);
    assert((await starting.locator('option').allTextContents()).every(text => !text.includes('typesafe')));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Funding', exact: true }).click();
    await page.getByRole('button', { name: 'New allowance' }).click();
    const allowance = page.getByRole('dialog', { name: 'Create funding allowance' });
    const choices = allowance.getByLabel('Price policy for model').locator('option');
    await expect(choices.filter({ hasText: 'jev-1.13.0' })).toHaveCount(1);
    const values = await choices.evaluateAll(items => items.map(item => item.value));
    assert.equal(new Set(values).size, values.length);
    await page.keyboard.press('Escape'); await funding();
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
  await step('an image-only connection exposes enabled avatars without making an image call', async () => {
    await page.getByRole('button', { name: 'Add custom provider' }).click();
    const dialog = page.getByRole('dialog', { name: 'Connect provider' });
    await dialog.getByLabel('Provider ID', { exact: true }).fill('fixture-images');
    await dialog.getByLabel('API endpoint', { exact: true }).fill(`http://127.0.0.1:${provider.address().port}/responses`);
    await dialog.getByLabel('API key', { exact: true }).fill(keys[0]);
    await dialog.getByLabel('gpt-image-1-mini', { exact: true }).check();
    await dialog.getByLabel('Allow HTTP', { exact: false }).check();
    await dialog.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const connection = (await get('/settings/providers')).connections.find(c => c.connection.provider === 'fixture-images').connection;
    assert.deepEqual(connection.avatar_models, ['gpt-image-1-mini']); assert.deepEqual(connection.config.models, []);
    const model = (await get('/inference')).models.find(m => m.provider === 'fixture-images');
    assert.equal(model.id, 'gpt-image-1-mini'); assert.deepEqual(model.capabilities.inference.operations, []);
    assert.equal(model.capabilities.avatar_generation.output_units_per_million, 8000000); assert.equal(inferences, 0);
    await page.getByRole('button', { name: 'Edit fixture-images' }).click();
    await expect(page.getByRole('dialog').getByLabel('gpt-image-1-mini', { exact: true })).toBeChecked();
    await page.getByRole('dialog').getByRole('button', { name: 'Close form' }).click();
  });
  await step('settings fits a narrow screen and observers create no work or model calls', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: join(evidence, 'settings-mobile.png'), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'Replace JEV API key' }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Save JEV key' })).toBeInViewport();
    await page.getByRole('dialog').getByRole('button', { name: 'Close form' }).click();
    assert.equal(inferences, 0); assert.equal((await get('/records?kind=call')).items.length, 0); assert.deepEqual(errors, []);
  });
  await step('persona creation attaches and displays a funded generated avatar through the real server', async () => {
    const op = async (kind, args) => {
      const response = await fetch(url + '/api/operations', { method: 'POST', headers: { 'X-Personas-Client': 'workspace', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), kind, args, actor: '', run: '' }) });
      const receipt = await response.json(); assert(response.ok); assert.equal(receipt.state, 'succeeded', JSON.stringify(receipt)); return receipt.result;
    };
    const root = await op('resource.root.create', { limits: { calls: 10, births: 2, max_depth: 1, concurrent_calls: 2 }, closeout_calls: 1, reason: 'Synthetic avatar integration' });
    await op('resource.bounds.configure', { root: root.id, revision: root.revision, bounds: {
      expires: new Date(Date.now() + 86400000).toISOString(), tokens: 1000000, closeout_tokens: 1000, cost_units: 1000000, closeout_cost_units: 100, currency: 'USD',
      prices: [{ provider: 'fixture-images', model: 'gpt-image-1-mini', input_units_per_million: 2000000, output_units_per_million: 8000000, evidence: 'Synthetic image usage at documented rates' }],
      remote_calls: 2, retained_payload_bytes: 10000000, cpu_seconds: 20, effect_operations: 0, concurrent_memory_bytes: 10000000, births_per_window: 2, birth_window_seconds: 60, reason: 'Synthetic avatar integration'
    } });
    await page.getByRole('button', { name: 'Personas', exact: true }).click();
    await page.locator('.page-heading').getByRole('button', { name: '+ New persona', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Create', exact: true });
    assert((await form.getByLabel('Starting model').locator('option').allTextContents()).every(label => !label.includes('gpt-image')));
    await form.getByLabel('Funding allowance', { exact: true }).selectOption(root.id);
    await form.getByLabel('Character', { exact: true }).fill('I support this synthetic avatar integration with careful comparisons.');
    await form.getByRole('button', { name: 'Create', exact: true }).click(); await expect(form).toHaveCount(0);
    let persona;
    await until(async () => { const summary = (await get('/records?kind=persona')).items[0]; persona = summary && await get('/records/' + summary.id); return persona?.data.avatar_initialization?.status === 'ready'; });
    assert.equal(persona.data.character_initialization.status, 'ready'); assert.equal(inferences, 1);
    await page.getByRole('button', { name: 'Open details ↗', exact: true }).click();
    const detail = page.getByRole('dialog', { name: 'Record details', exact: true });
    await expect(detail.getByRole('region', { name: 'Avatar generation', exact: true })).toContainText('Generated avatar');
    const portrait = detail.locator('img.portrait'); await expect(portrait).toHaveCount(1);
    await expect(portrait).toHaveJSProperty('naturalWidth', 1024);
    const call = await get('/records/' + persona.data.avatar_initialization.call);
    assert.equal(call.data.requested_model, 'gpt-image-1-mini'); assert.equal(call.data.usage.known, true); assert.equal(call.data.artifact, persona.data.portrait);
    const charge = await get('/records/' + call.data.budget_charge); assert.equal(charge.data.accounted.cost, 2376);
    assert.equal((await get('/records?kind=call')).items.length, 1); assert.deepEqual(errors, []);
    await page.screenshot({ path: join(evidence, 'generated-avatar-mobile.png'), fullPage: true });
  });
  writeFileSync(join(evidence, 'report.json'), JSON.stringify({ checks, discovery, inferences, errors, fixtureOnly: true }, null, 2));
  console.log(JSON.stringify({ checks, evidence }));
} finally { if (browser) await browser.close(); await stop(); provider.closeAllConnections(); await new Promise(r => provider.close(r)); }
