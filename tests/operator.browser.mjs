/** Production UI + real restricted Rust Node/SQLite + synthetic HTTP provider.
 * No browser API mocks, paid model calls, expertise claims, or live acceptance.
 * Output stays in a temporary/private runtime directory, never this public repo.
 */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const binary = process.env.PERSONAS_BIN || resolve('../ai-personas/target/debug/personas');
const root = mkdtempSync(join(tmpdir(), 'personas-operator-'));
const evidence = process.env.PERSONAS_BROWSER_EVIDENCE || join(root, 'evidence');
mkdirSync(evidence, { recursive: true });
const delay = ms => new Promise(r => setTimeout(r, ms));
let calls = 0, app, browser, page, url, port, checks = 0;
const errors = [], providerErrors = [];
const provider = createServer(async (req, res) => {
  try {
    let body = ''; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body), context = JSON.parse(input.input[0].content[0].text);
    calls++;
    let actions;
    if (context.run.data.membership === 'invited') {
      const i = context.work.data.core.invitation;
      actions = [{ kind: 'invitation.respond', args: { id: i.id, revision: i.revision, accept: true, reason: 'Synthetic fixture chooses participation' } }];
    } else if (!context.persona.data.name) {
      actions = [{ kind: 'persona.update', args: { revision: context.persona.revision, name: 'Browser fixture persona', character: 'Synthetic provider for operator mechanics, not model capability evidence.', reason: 'Fixture-authored identity' } }];
    } else if (!context.history.some(a => a.request.kind === 'request.create')) {
      actions = [{ kind: 'request.create', args: { purpose: 'Operator fixture question', instructions: 'Provide an observation through the UI.', evidence_required: 'A text response; no physical evidence is claimed.', artifacts: [] } }];
    } else {
      actions = [{ kind: 'wait', args: { reason: 'Explicit synthetic wait for new outside input' } }];
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'fixture-' + calls, object: 'response', status: 'completed', error: null, model: 'operator-fixture',
      output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ summary: 'Synthetic operator fixture', actions }) }] }],
      usage: { input_tokens: 100, output_tokens: 25, total_tokens: 125, input_tokens_details: { cached_tokens: 0 } } }));
  } catch (e) { providerErrors.push(String(e)); res.writeHead(500); res.end('{}'); }
});
async function get(path) {
  const response = await fetch(url + '/api' + path, { headers: { 'X-Personas-Client': 'workspace' } });
  const body = await response.json(); assert(response.ok, JSON.stringify(body)); return body;
}
async function op(kind, args, actor = '', run = '', success = true) {
  const response = await fetch(url + '/api/operations', { method: 'POST', headers: { 'X-Personas-Client': 'workspace', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), kind, args, actor, run }) });
  const body = await response.json(); assert(response.ok, JSON.stringify(body));
  if (success) assert.equal(body.state, 'succeeded', JSON.stringify(body));
  return body;
}
async function until(test, label) {
  for (let i = 0; i < 160; i++) { const value = await test(); if (value) return value; await delay(100); }
  throw Error('Timed out: ' + label);
}
async function startNode(requireToken = false) {
  const fd = openSync(join(root, 'node.log'), 'a');
  app = spawn(binary, ['serve', '--root', join(root, 'node'), '--listen', `127.0.0.1:${port}`, '--http-providers', join(root, 'providers.json'), '--ui', process.env.PERSONAS_UI_DIST || resolve('dist'), ...(requireToken ? ['--require-token'] : [])], { stdio: ['ignore', fd, fd] }); closeSync(fd);
  url = `http://127.0.0.1:${port}`;
  await until(async () => {
    if (app.exitCode !== null) throw Error(readFileSync(join(root, 'node.log'), 'utf8'));
    try { return (await fetch(url + '/health')).ok; } catch { return false; }
  }, 'node health');
}
async function stopNode() {
  if (!app || app.exitCode !== null) return;
  const exited = once(app, 'exit'); app.kill('SIGTERM'); await exited;
}
async function step(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
async function connect() {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await expect(page.getByLabel('Node token')).toHaveCount(0);
  assert.deepEqual(await page.context().cookies(), [], 'local session stored a browser secret');
}
try {
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening'); port = reservation.address().port; await new Promise(r => reservation.close(r));
  writeFileSync(join(root, 'providers.json'), JSON.stringify({ fixture: { endpoint: `http://127.0.0.1:${provider.address().port}/responses`, trust_loopback_http: true,
    models: [{ id: 'operator-fixture', context_window_tokens: 1_000_000, max_output_tokens: 1024, input_tokens_per_utf8_byte_upper_bound: 1, framing_token_allowance: 1024 }] } }));
  await startNode();
  browser = await chromium.launch({ headless: true }); page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
  await step('local API opens directly and rejects unrelated website origins', async () => {
    assert.equal((await fetch(url + '/api/deployment')).status, 200);
    assert.equal((await fetch(url + '/api/deployment', { headers: { Origin: 'https://unrelated.example' } })).status, 401);
    assert.equal((await get('/deployment')).funding_required, true);
  });
  await connect();
  await step('local disconnect and reconnect need no token or reload', async () => {
    await page.getByRole('button', { name: 'Disconnect view', exact: true }).click();
    await expect(page.getByLabel('Node token')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reconnect to local node', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  });
  await step('an opened HTML artifact cannot act as the local operator', async () => {
    const before = (await get('/records?kind=environment')).items.length;
    const envelope = { id: crypto.randomUUID().replaceAll('-', ''), kind: 'environment.create', actor: '', run: '', args: {} };
    const bytes = `<html><body><h1>Untrusted artifact fixture</h1><script>window.artifactScriptRan = true; fetch('/api/operations', {method:'POST',headers:{'X-Personas-Client':'workspace','Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify(envelope))}});</script></body></html>`;
    const q = new URLSearchParams({ id: crypto.randomUUID().replaceAll('-', ''), name: 'fixture.html', media_type: 'text/html', size: String(Buffer.byteLength(bytes)), digest: createHash('sha256').update(bytes).digest('hex') });
    const upload = await fetch(url + '/api/uploads?' + q, { method: 'POST', headers: { 'X-Personas-Client': 'workspace' }, body: bytes });
    assert(upload.ok); const result = await upload.json(); assert.equal(result.state, 'succeeded');
    const response = await page.goto(url + '/api/artifacts/' + result.result.id);
    assert(response.headers()['content-security-policy'].includes('sandbox'));
    await expect(page.getByRole('heading', { name: 'Untrusted artifact fixture' })).toBeVisible();
    assert.equal(await page.evaluate(() => window.artifactScriptRan), undefined);
    assert.equal((await get('/records?kind=environment')).items.length, before);
    await connect();
  });
  let allowance, persona, environment, work, run, request;
  await step('create finite funding with explicit prices through UI', async () => {
    await page.getByRole('button', { name: 'Funding', exact: true }).click();
    await page.getByRole('button', { name: 'New allowance', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Create funding allowance' });
    await form.getByLabel('Purpose', { exact: true }).fill('Synthetic browser allowance');
    await form.getByLabel('Input price per million tokens').fill('0');
    await form.getByLabel('Output price per million tokens').fill('0');
    await form.getByLabel('Price source and date').fill('Local synthetic provider: no charge; test only');
    await form.getByLabel('Total tokens', { exact: true }).fill('10000000');
    await form.getByRole('button', { name: 'Create allowance', exact: true }).click();
    await expect(form).toHaveCount(0);
    allowance = (await get('/records?kind=resource_root')).items[0];
    assert.equal(allowance.data.bounds_configured, true);
    await expect(page.getByRole('heading', { name: 'Synthetic browser allowance' })).toBeVisible();
  });
  await step('create funded founder and environment through UI', async () => {
    await page.getByRole('button', { name: 'Personas', exact: true }).click();
    await page.locator('.page-heading').getByRole('button', { name: '+ New persona', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Create', exact: true });
    await form.getByLabel('Funding allowance', { exact: true }).selectOption(allowance.id);
    await form.getByRole('button', { name: 'Create', exact: true }).click(); await expect(form).toHaveCount(0);
    persona = (await get('/records?kind=persona')).items[0]; assert.equal(persona.data.resource_root, allowance.id);
    await page.getByRole('button', { name: 'Environments', exact: true }).click();
    await page.locator('.page-heading').getByRole('button', { name: '+ New environment', exact: true }).click();
    await page.getByRole('dialog', { name: 'Create', exact: true }).getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Create', exact: true })).toHaveCount(0);
    environment = (await get('/records?kind=environment')).items[0];
  });
  await step('create task with atomic scope and persona-owned invitation response', async () => {
    await page.getByRole('button', { name: 'Work', exact: true }).click();
    await page.locator('.page-heading').getByRole('button', { name: '+ New work', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Create', exact: true });
    await form.getByLabel('Short title').fill('Operator browser task');
    await form.getByLabel('Your instructions').fill('Original synthetic request remains intact.');
    await form.getByRole('radio').check(); await form.getByRole('checkbox').check();
    await form.getByLabel('Funding allowance', { exact: true }).selectOption(allowance.id);
    await form.getByRole('button', { name: 'Create', exact: true }).click(); await expect(form).toHaveCount(0);
    work = (await get('/records?kind=work')).items[0];
    await page.getByRole('button', { name: 'Operator browser task', exact: true }).click();
    await until(async () => { const r = (await get('/records?kind=run&scope=' + work.id)).items[0]; return r?.data.status === 'waiting' && r; }, 'accepted participant yields');
    run = (await get('/records?kind=run&scope=' + work.id)).items[0];
    const current = await get('/records/' + work.id);
    assert(current.data.mandate.id); assert.deepEqual(current.data.personas, [persona.id]);
    await expect(page.getByLabel('Current obligations')).toContainText('No accepted owner');
    await expect(page.getByLabel('Current obligations')).toContainText('Evidence: missing');
  });
  await step('amend scope through UI while preserving original request', async () => {
    await page.getByRole('button', { name: 'Amend task', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Amend task', exact: true });
    await form.getByLabel('Title', { exact: true }).fill('Amended browser task');
    await form.getByLabel('Clarifications and updated instructions').fill('A second explicit requirement.');
    await form.getByLabel('Expected result').fill('Amended synthetic outcome');
    await form.getByLabel('Evidence', { exact: true }).selectOption('reviewed');
    await form.getByRole('button', { name: 'Add outcome', exact: true }).click();
    await expect(form.getByLabel('Expected result')).toHaveCount(2);
    await expect(form.getByLabel('Expected result').first()).toHaveValue('Amended synthetic outcome');
    await expect(form.getByLabel('Evidence', { exact: true }).first()).toHaveValue('reviewed');
    await form.getByRole('button', { name: 'Remove outcome', exact: true }).last().click();
    await expect(form.getByLabel('Clarifications and updated instructions')).toHaveValue('A second explicit requirement.');
    await form.getByRole('button', { name: 'Adopt amendment', exact: true }).click(); await expect(form).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Amended browser task', exact: true })).toBeVisible();
    const current = await get('/records/' + work.id);
    assert.equal(current.data.brief, 'Original synthetic request remains intact.');
    const mandate = await get('/records/' + current.data.mandate.id);
    assert.equal(mandate.data.mandate.outcomes[0].description, 'Amended synthetic outcome');
    assert.equal(mandate.data.mandate.outcomes[0].evidence, 'reviewed');
    assert.equal((await op('work.amend', { work: work.id, revision: work.revision, title: 'Stale', mandate: mandate.data.mandate }, '', '', false)).state, 'failed');
  });
  await step('an open amendment cannot silently overwrite a concurrent scope change', async () => {
    await page.getByRole('button', { name: 'Amend task', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Amend task', exact: true });
    await expect(form.getByLabel('Evidence', { exact: true })).toHaveValue('reviewed');
    await form.getByLabel('Expected result').fill('Unsaved draft must not win');
    const current = await get('/records/' + work.id), mandate = await get('/records/' + current.data.mandate.id);
    await op('work.amend', { work: work.id, revision: current.revision, title: current.data.title, mandate: mandate.data.mandate });
    await expect(form).toContainText('This task changed while you were editing.');
    await expect(form.getByRole('button', { name: 'Adopt amendment', exact: true })).toBeDisabled();
    await form.getByRole('button', { name: 'Close form', exact: true }).click();
  });
  await step('send scoped participant message and answer a request through UI', async () => {
    await page.getByRole('button', { name: 'Message participants', exact: true }).click();
    await page.getByLabel('Message for this task').fill('Operator task-scoped instruction');
    await page.getByRole('button', { name: 'Send to participants', exact: true }).click();
    await until(async () => (await get('/records?kind=message&scope=' + environment.id)).items.some(r => r.data.to === environment.id), 'task message retained');
    request = (await get('/records?kind=request&scope=' + work.id)).items[0]; assert(request);
    await page.getByRole('button', { name: 'Operator fixture question', exact: true }).first().click();
    const details = page.getByRole('dialog', { name: 'Record details', exact: true });
    await details.getByLabel('Your response').fill('Synthetic operator observation, not physical evidence.');
    await details.getByLabel('Attach evidence').setInputFiles({ name: 'fixture-note.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic local upload; no external observation claimed.') });
    await expect(details).toContainText('File attached');
    await details.getByRole('button', { name: 'Send response', exact: true }).click();
    await expect(details).toContainText('Response delivered to the owner');
    assert.equal((await get('/records/' + request.id)).data.status, 'answered');
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
  });
  await step('run controls and direct persona messaging stay attributable', async () => {
    await page.getByLabel('Persona activity').getByRole('button', { name: 'Inspect exact record ↗', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Record details', exact: true });
    await details.getByRole('button', { name: 'Pause decisions', exact: true }).click();
    await until(async () => (await get('/records/' + run.id)).data.status === 'paused', 'pause');
    await details.getByRole('button', { name: 'Resume', exact: true }).click();
    await until(async () => (await get('/records/' + run.id)).data.status === 'waiting', 'explicit resume then yield');
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    await page.getByRole('button', { name: 'Personas', exact: true }).click();
    await page.getByRole('button', { name: 'Browser fixture persona', exact: true }).click();
    await details.getByRole('button', { name: /Send a message/ }).click();
    await details.getByLabel('Message', { exact: true }).fill('Direct operator correspondence');
    await details.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(details).toContainText('Message sent.');
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    await page.getByRole('button', { name: 'Work', exact: true }).click();
    await page.getByRole('button', { name: 'Amended browser task', exact: true }).click();
  });
  await expect(page.getByRole('heading', { name: 'Amended browser task', exact: true })).toBeVisible();
  await expect(page.getByLabel('Current obligations')).toContainText('No accepted owner');
  await page.screenshot({ path: join(evidence, 'operator-desktop.png'), fullPage: true });
  await step('mobile controls fit and archive retains history without refund or resume', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile overflow');
    const before = await get('/resources/' + allowance.id);
    await page.getByRole('button', { name: 'Archive task', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Archive task', exact: true });
    await form.getByLabel('Reason', { exact: true }).fill('Operator chose to stop synthetic work');
    await form.getByRole('button', { name: 'Cancel participation and archive', exact: true }).click(); await expect(form).toHaveCount(0);
    await expect(page.getByLabel('Task controls')).toContainText('Archived.');
    assert.equal((await get('/records/' + run.id)).data.status, 'cancelled');
    assert.equal((await op('run.resume', { id: run.id }, '', '', false)).state, 'failed');
    const after = await get('/resources/' + allowance.id); assert(after.calls.charged >= before.calls.charged); assert.equal(after.births.consumed, before.births.consumed);
    await page.getByRole('button', { name: '← All work', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Amended browser task', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Archived', exact: true }).click();
    await page.getByRole('button', { name: 'Amended browser task', exact: true }).click();
    await expect(page.getByLabel('Task controls')).toContainText('Archived.');
    await expect(page.getByLabel('Current obligations')).toContainText('No accepted owner');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'archived mobile overflow');
    await page.screenshot({ path: join(evidence, 'operator-mobile-archived.png'), fullPage: true });
  });
  await step('erase selected message payload separately; task accounting survives', async () => {
    await page.getByRole('button', { name: 'Personas', exact: true }).click();
    await page.getByRole('button', { name: 'Browser fixture persona', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Record details', exact: true });
    await details.getByRole('button', { name: 'Messages', exact: true }).click();
    await details.getByRole('button', { name: /^message/ }).first().click();
    await details.getByRole('button', { name: 'Erase this payload…', exact: true }).click();
    await details.getByLabel('Erasure reason').fill('Operator retention choice');
    await details.getByRole('checkbox').check();
    await details.getByRole('button', { name: 'Erase selected payload', exact: true }).click();
    await expect(details).toContainText('Payload erased.');
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    assert.equal((await get('/records/' + work.id)).data.status, 'archived');
  });
  await step('restart retains archive, funding, identity and no idle inference', async () => {
    await stopNode(); await startNode();
    assert.equal((await get('/records/' + work.id)).data.status, 'archived');
    assert.equal((await get('/records/' + run.id)).data.status, 'cancelled');
    const before = calls; await delay(1200); assert.equal(calls, before);
    await connect(); await page.getByRole('button', { name: 'Archived', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Amended browser task', exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('personas-token')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('personas-token')), null);
  });
  await step('explicit token mode still requires and validates an operator token', async () => {
    await stopNode(); await startNode(true); await page.goto(url);
    await page.getByLabel('Node token').fill('incorrect-token');
    await page.getByRole('button', { name: 'Connect to node', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Could not connect');
    await page.getByLabel('Node token').fill(readFileSync(join(root, 'node/token'), 'utf8').trim());
    await page.getByRole('button', { name: 'Connect to node', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  });
  assert.deepEqual(errors, []); assert.deepEqual(providerErrors, []); assert(calls < 25, 'unexpected unbounded fixture inference');
  writeFileSync(join(evidence, 'report.json'), JSON.stringify({ scope: 'Real Rust API/SQLite and production browser; synthetic HTTP decisions, no live-model or process-kill claim', checks, calls, pageErrors: errors, providerErrors }, null, 2));
  console.log(JSON.stringify({ checks, calls, evidence }));
} catch (error) {
  if (page) { await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {}); writeFileSync(join(evidence, 'failure.json'), JSON.stringify({ error: String(error), body: await page.locator('body').innerText().catch(() => ''), errors, providerErrors }, null, 2)); }
  throw error;
} finally {
  if (browser) await browser.close(); await stopNode(); await new Promise(r => provider.close(r));
  console.log('Private operator evidence: ' + evidence);
}
