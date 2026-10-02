/** Production UI and real restricted Node, with synthetic keys and local model
 * catalogues. No paid inference, live vendor authentication or task-quality claim. */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, statSync, existsSync } from 'node:fs';
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
let app, browser, page, port, url, checks = 0, discovery = 0, inferences = 0, syntheticCodex = false;
const errors = [], captured = [];
// Synthetic textured pixels exercise realistic file size and the real portrait
// path, not image quality. Blank pixels hid the old 512 KB preview cutoff.
function pngChunk(type, data) {
  const content = Buffer.concat([Buffer.from(type), data]), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(content)); return Buffer.concat([length, content, crc]);
}
const dimensions = Buffer.alloc(13); dimensions.writeUInt32BE(1024, 0); dimensions.writeUInt32BE(1024, 4); dimensions[8] = 8; dimensions[9] = 2;
const avatarPixels = Buffer.alloc(1024 * (1 + 1024 * 3));
let pixelSeed = 104729;
for (let row = 0; row < 1024; row++) for (let column = 1; column <= 1024 * 3; column++) {
  pixelSeed ^= pixelSeed << 13; pixelSeed ^= pixelSeed >>> 17; pixelSeed ^= pixelSeed << 5;
  avatarPixels[row * (1 + 1024 * 3) + column] = pixelSeed & 255;
}
const avatarPNG = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', dimensions), pngChunk('IDAT', deflateSync(avatarPixels)), pngChunk('IEND', Buffer.alloc(0))]);
assert(avatarPNG.length > 512_000 && avatarPNG.length < 8 * 1024 * 1024);
// Exercise the existing installed-Codex adapter with an entirely local CLI,
// catalogue and synthetic login. Only this test's child receives these paths;
// the host's login and environment remain untouched. This is transport evidence,
// not API-key image generation or provider capability/quality acceptance.
const codexFixture = join(root, 'synthetic-codex'); mkdirSync(codexFixture);
const codexBinary = join(codexFixture, 'codex.cjs'), nativeRequestFile = join(codexFixture, 'requests.jsonl');
keys.push('fixture-codex-access', 'fixture-codex-account');
writeFileSync(join(codexFixture, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: keys[3], account_id: keys[4] } }), { mode: 0o600 });
writeFileSync(join(codexFixture, 'catalog.json'), JSON.stringify({ models: [
  { slug: 'fixture-native-other', display_name: 'Other native fixture', visibility: 'list', context_window: 272000, input_modalities: ['text'], supported_reasoning_levels: [{ effort: 'medium' }] },
  { slug: 'fixture-native-selected', display_name: 'Selected native fixture', visibility: 'list', context_window: 272000, input_modalities: ['text', 'image'], supported_reasoning_levels: [{ effort: 'medium' }] }
] }));
writeFileSync(join(codexFixture, 'portrait.png'), avatarPNG);
writeFileSync(codexBinary, `#!/usr/bin/env node
const { readFileSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const send = value => process.stdout.write(JSON.stringify(value) + '\\n');
if (process.argv[2] === 'debug' && process.argv[3] === 'models') {
  process.stdout.write(readFileSync(join(__dirname, 'catalog.json')));
} else {
  assert.deepEqual(process.argv.slice(2), ['app-server', '--stdio']);
  require('node:readline').createInterface({ input: process.stdin }).on('line', line => {
    const request = JSON.parse(line), p = request.params || {};
    const result = value => send({ id: request.id, result: value });
    if (['thread/start', 'turn/start', 'turn/interrupt'].includes(request.method)) appendFileSync(join(__dirname, 'requests.jsonl'), JSON.stringify(request) + '\\n');
    switch (request.method) {
      case 'initialize': result({}); break;
      case 'initialized': break;
      case 'account/read': result({ account: { type: 'chatgpt', planType: 'fixture' } }); break;
      case 'modelProvider/capabilities/read': result({ imageGeneration: true }); break;
      case 'config/read': result({ config: {} }); break;
      case 'skills/list': result({ data: [] }); break;
      case 'thread/start':
        assert.equal(p.model, 'fixture-native-selected'); assert.equal(p.allowProviderModelFallback, false);
        assert.equal(p.ephemeral, true); assert.equal(p.approvalPolicy, 'never'); assert.deepEqual(p.environments, []);
        result({ model: p.model, modelProvider: 'openai', thread: { id: 'fixture-image-thread' } }); break;
      case 'turn/start':
        assert.equal(p.model, 'fixture-native-selected'); assert.equal(p.effort, 'medium');
        assert(p.input[0].text.includes('synthetic avatar integration'));
        result({ turn: { id: 'fixture-image-turn' } });
        send({ method: 'thread/tokenUsage/updated', params: { threadId: 'fixture-image-thread', turnId: 'fixture-image-turn', tokenUsage: { total: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 10, totalTokens: 110, reasoningOutputTokens: 0 } } } });
        send({ method: 'item/completed', params: { threadId: 'fixture-image-thread', turnId: 'fixture-image-turn', item: { type: 'imageGeneration', id: 'fixture-image', status: 'completed', result: readFileSync(join(__dirname, 'portrait.png')).toString('base64') } } }); break;
      case 'turn/interrupt': result({}); break;
      default: throw Error('Unexpected synthetic Codex request: ' + request.method);
    }
  });
}
`, { mode: 0o700 });
const nativeRequests = () => existsSync(nativeRequestFile) ? readFileSync(nativeRequestFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
const provider = createServer(async (req, res) => {
  if (!req.url.startsWith('/models')) { inferences++; res.writeHead(400); res.end('{}'); return; }
  discovery++; captured.push(req.headers);
  res.setHeader('Content-Type', 'application/json');
  if (req.headers.authorization === 'Bearer rejected-key') { res.writeHead(401); res.end(JSON.stringify({ error: 'PRIVATE_AUTH_ECHO' })); return; }
  res.end(JSON.stringify(req.headers['x-goog-api-key'] ? { models: [{ name: 'models/fixture-model', supportedGenerationMethods: ['generateContent'] }] }
    : { data: [{ id: 'fixture-model' }, { id: 'gpt-5.6-sol' }, { id: 'gpt-image-1-mini' }], has_more: false }));
});
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) { for (let i = 0; i < 150; i++) { if (await fn()) return; await delay(100); } throw Error('Node did not become ready'); }
async function start() {
  const fd = openSync(join(root, 'node.log'), 'a');
  const args = ['serve', '--root', join(root, 'node'), '--listen', `127.0.0.1:${port}`, '--ui', process.env.PERSONAS_UI_DIST || resolve('dist')];
  if (!syntheticCodex) args.push('--no-codex');
  app = spawn(binary, args, { stdio: ['ignore', fd, fd], env: { ...process.env, PERSONAS_CODEX_BIN: codexBinary, CODEX_HOME: codexFixture } }); closeSync(fd);
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
async function noMediaSettings(dialog) {
  await expect(dialog.getByText('Automatic persona avatars', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Add image route', exact: true })).toHaveCount(0);
  for (const label of ['Avatar model ID', 'Image route', 'Image API endpoint', 'Tool image model ID', 'Image input rate', 'Image output rate', 'Image size', 'Image quality', 'Image pricing evidence']) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  await expect(dialog.locator('[name*="vision"], [name*="max_images"], [name*="image_token"]')).toHaveCount(0);
}
function noMediaConfiguration(connection) {
  assert(!Object.hasOwn(connection, 'images'));
  assert(!Object.hasOwn(connection.config, 'max_images'));
  for (const model of connection.config.models) assert(!Object.hasOwn(model, 'vision'));
}
async function add(protocol, id, model = 'fixture-model') {
  await page.getByRole('button', { name: 'Add custom provider' }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect provider' });
  await noMediaSettings(dialog);
  await dialog.getByLabel('Provider ID', { exact: true }).fill(id);
  await dialog.getByLabel('API protocol', { exact: true }).selectOption(protocol);
  const suffix = { responses: 'responses', anthropic: 'messages', gemini: 'models' }[protocol];
  await dialog.getByLabel('API endpoint', { exact: true }).fill(`http://127.0.0.1:${provider.address().port}/${suffix}`);
  await dialog.getByLabel('API key', { exact: true }).fill(keys[0]);
  await dialog.getByRole('button', { name: 'Add model', exact: true }).click();
  await dialog.getByLabel('Model ID', { exact: true }).fill(model);
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
    for (const name of ['OpenAI', 'Anthropic Claude', 'Google Gemini']) {
      await page.getByRole('button', { name: 'Connect ' + name, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Connect provider' });
      await expect(dialog.getByLabel('API key', { exact: true })).toHaveAttribute('type', 'password');
      await expect(dialog.getByLabel('API endpoint')).toHaveAttribute('readonly', '');
      await noMediaSettings(dialog);
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
  await step('custom endpoints advertise no invented media and saved settings contain no image controls', async () => {
    const card = await add('responses', 'fixture-unknown', 'gpt-5.6-sol');
    const settings = await get('/settings/providers');
    for (const connection of [...settings.templates, ...settings.connections.map(saved => saved.connection)]) noMediaConfiguration(connection);
    const catalog = await get('/inference');
    for (const providerId of ['fixture-unknown', 'fixture-claude', 'fixture-gemini']) {
      const model = catalog.models.find(model => model.provider === providerId);
      assert(model.capabilities.inference.operations.length > 0);
      assert.deepEqual(model.capabilities.inputModalities, ['text']);
      assert.equal(model.capabilities.image_input, false);
      assert.equal(model.capabilities.image_input_readiness.state, 'unsupported');
      assert(!model.capabilities.avatar_generation);
    }
    await card.locator('summary').click(); await expect(card).toContainText('Image input unsupported');
    await card.getByRole('button', { name: 'Edit fixture-unknown' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit provider connection' });
    await noMediaSettings(dialog); await dialog.getByRole('button', { name: 'Close form' }).click();
    assert.equal(inferences, 0);
  });
  await step('settings fits a narrow screen and observers create no work or model calls', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: join(evidence, 'settings-mobile.png'), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'Replace JEV API key' }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Save JEV key' })).toBeInViewport();
    await page.getByRole('dialog').getByRole('button', { name: 'Close form' }).click();
    assert.equal(inferences, 0); assert.equal((await get('/records?kind=call')).items.length, 0); assert.deepEqual(errors, []);
  });
  await step('installed native model capabilities need no image settings or generation probe', async () => {
    syntheticCodex = true; await stop(); await start(); await page.reload(); await funding();
    const catalog = await get('/inference');
    const selected = catalog.models.find(model => model.provider === 'codex' && model.id === 'fixture-native-selected');
    const other = catalog.models.find(model => model.provider === 'codex' && model.id === 'fixture-native-other');
    assert(selected && other);
    assert.deepEqual(selected.capabilities.inputModalities, ['text', 'image']);
    assert.equal(selected.capabilities.image_input_readiness.state, 'ready');
    assert.equal(other.capabilities.image_input_readiness.state, 'unsupported');
    assert.equal(selected.capabilities.avatar_generation.id, selected.id);
    assert.equal(other.capabilities.avatar_generation.id, other.id);
    assert.equal(selected.capabilities.source, 'installed_codex_catalog');
    const card = page.locator('.provider-card').filter({ has: page.getByRole('heading', { name: 'Codex', exact: true }) });
    await card.locator('summary').click();
    await expect(card).toContainText('Supports image input'); await expect(card).toContainText('Image input unsupported');
    assert.deepEqual(nativeRequests(), []); assert.equal(inferences, 0);
    assert.equal((await get('/records?kind=call')).items.length, 0);
  });
  await step('selected native model generates a large portrait through the real server without substitution', async () => {
    const op = async (kind, args) => {
      const response = await fetch(url + '/api/operations', { method: 'POST', headers: { 'X-Personas-Client': 'workspace', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), kind, args, actor: '', run: '' }) });
      const receipt = await response.json(); assert(response.ok); assert.equal(receipt.state, 'succeeded', JSON.stringify(receipt)); return receipt.result;
    };
    const root = await op('resource.root.create', { limits: { calls: 10, births: 2, max_depth: 1, concurrent_calls: 2 }, closeout_calls: 1, reason: 'Synthetic avatar integration' });
    await op('resource.bounds.configure', { root: root.id, revision: root.revision, bounds: {
      expires: new Date(Date.now() + 86400000).toISOString(), tokens: 1000000, closeout_tokens: 1000, cost_units: 1000000, closeout_cost_units: 100, currency: 'USD',
      prices: ['fixture-native-other', 'fixture-native-selected'].map(model => ({ provider: 'codex', model, input_units_per_million: 0, output_units_per_million: 0, evidence: 'Synthetic subscription fixture; no API charge, aggregate image usage unknown' })),
      remote_calls: 2, retained_payload_bytes: 10000000, cpu_seconds: 20, effect_operations: 0, concurrent_memory_bytes: 10000000, births_per_window: 2, birth_window_seconds: 60, reason: 'Synthetic avatar integration'
    } });
    await page.getByRole('button', { name: 'Personas', exact: true }).click();
    await page.locator('.page-heading').getByRole('button', { name: '+ New persona', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Create', exact: true });
    assert((await form.getByLabel('Starting model').locator('option').allTextContents()).every(label => !label.includes('gpt-image')));
    await form.getByLabel('Starting model').selectOption(JSON.stringify(['codex', 'fixture-native-other']));
    await expect(form).toContainText('Image input unsupported');
    await form.getByLabel('Starting model').selectOption(JSON.stringify(['codex', 'fixture-native-selected']));
    await expect(form).toContainText('Supports image input');
    await form.getByLabel('Funding allowance', { exact: true }).selectOption(root.id);
    await form.getByLabel('Character', { exact: true }).fill('I support this synthetic avatar integration with careful comparisons.');
    await form.getByRole('button', { name: 'Create', exact: true }).click(); await expect(form).toHaveCount(0);
    let persona;
    await until(async () => {
      const summary = (await get('/records?kind=persona')).items[0]; persona = summary && await get('/records/' + summary.id);
      const avatar = persona?.data.avatar_initialization;
      if (['failed', 'uncertain', 'unavailable', 'cancelled'].includes(avatar?.status)) throw Error(JSON.stringify(avatar));
      return avatar?.status === 'ready';
    });
    assert.equal(persona.data.character_initialization.status, 'ready'); assert.equal(inferences, 0);
    assert.equal(persona.data.provider, 'codex'); assert.equal(persona.data.model, 'fixture-native-selected');
    assert.equal(persona.data.avatar_initialization.provider, 'codex'); assert.equal(persona.data.avatar_initialization.model, 'fixture-native-selected');
    const requests = nativeRequests();
    assert.equal(requests.filter(request => request.method === 'turn/start').length, 1);
    assert(requests.filter(request => ['thread/start', 'turn/start'].includes(request.method)).every(request => request.params.model === 'fixture-native-selected'));
    assert.equal(requests.filter(request => request.method === 'turn/interrupt').length, 1);
    await page.getByRole('button', { name: 'Open details', exact: true }).click();
    const detail = page.getByRole('dialog', { name: 'Record details', exact: true });
    await expect(detail.getByRole('region', { name: 'Avatar generation', exact: true })).toContainText('Generated avatar');
    await expect(detail.getByRole('region', { name: 'Avatar generation', exact: true })).toContainText('The full admitted reservation remains accounted');
    const portrait = detail.locator('img.portrait'); await expect(portrait).toHaveCount(1);
    await expect(portrait).toHaveJSProperty('naturalWidth', 1024);
    const call = await get('/records/' + persona.data.avatar_initialization.call);
    assert.equal(call.data.provider, 'codex'); assert.equal(call.data.requested_model, 'fixture-native-selected');
    assert.equal(call.data.actual_model, null); assert.equal(call.data.image_model, null);
    assert.equal(call.data.image_route, 'codex_app_server_image'); assert.equal(call.data.usage.known, false);
    assert.equal(call.data.provider_observation.controller_usage.known, true);
    assert.equal(call.data.provider_observation.controller_usage.input, 100);
    assert.equal(call.data.provider_observation.controller_usage.output, 10);
    assert.equal(call.data.artifact, persona.data.portrait);
    const charge = await get('/records/' + call.data.budget_charge);
    assert.equal(charge.data.status, 'uncertain'); assert.equal(charge.data.accounted.cost, 0);
    assert.equal(charge.data.accounted.tokens, charge.data.input_upper + charge.data.output_upper);
    assert(charge.data.accounted.tokens > 110);
    const artifact = await get('/records/' + persona.data.portrait);
    assert.equal(artifact.data.size, avatarPNG.length);
    assert.equal((await get('/records?kind=call')).items.length, 1); assert.deepEqual(errors, []);
    await page.screenshot({ path: join(evidence, 'generated-avatar-mobile.png'), fullPage: true });
  });
  writeFileSync(join(evidence, 'report.json'), JSON.stringify({ checks, discovery, inferences, nativeImageTurns: nativeRequests().filter(request => request.method === 'turn/start').length, portraitBytes: avatarPNG.length, errors, fixtureOnly: true }, null, 2));
  console.log(JSON.stringify({ checks, evidence }));
} finally { if (browser) await browser.close(); await stop(); provider.closeAllConnections(); await new Promise(r => provider.close(r)); }
