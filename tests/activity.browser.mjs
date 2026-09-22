/** Real runtime HTTP/SQLite + production UI, synthetic streamed model replies.
 * Runs one harmless local shell fixture on a disposable unrestricted test node.
 * No live account, paid inference, user workspace, or private provider evidence.
 */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const root = mkdtempSync(join(tmpdir(), 'personas-activity-'));
const evidence = process.env.PERSONAS_BROWSER_EVIDENCE || join(root, 'evidence'); mkdirSync(evidence, { recursive: true });
const delay = ms => new Promise(r => setTimeout(r, ms));
let calls = 0, releaseFirst, app, browser, malformed = false, checks = 0;
const gate = new Promise(r => { releaseFirst = r; });
const provider = createServer(async (req, res) => {
  try {
    let bytes = ''; for await (const chunk of req) bytes += chunk;
    const input = JSON.parse(bytes), context = JSON.parse(input.input[0].content[0].text), turn = calls++;
    assert.equal(input.stream, true);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const emit = value => res.write('data: ' + JSON.stringify(value) + '\n\n');
    const publicMessage = { id: 'message-' + turn, type: 'message', role: 'assistant', phase: 'commentary' };
    emit({ type: 'response.output_item.added', output_index: 0, item: publicMessage });
    emit({ type: 'response.output_text.delta', output_index: 0, item_id: publicMessage.id, delta: `Checking fixture inputs for decision ${turn + 1}.` });
    emit({ type: 'response.reasoning_text.delta', output_index: 1, item_id: 'private', delta: 'PRIVATE_REASONING_NEVER_RENDER' });
    if (turn === 0) {
      await delay(200);
      emit({ type: 'response.output_text.delta', output_index: 0, item_id: publicMessage.id, delta: ' Reading the current profile.' });
      const updates = setInterval(() => emit({ type: 'response.output_text.delta', output_index: 0, item_id: publicMessage.id, delta: ' · Observing fixture' }), 180);
      try { await gate; } finally { clearInterval(updates); }
    }
    const actions = turn === 0 ? [
      { kind: 'persona.update', args: { revision: context.persona.revision, name: 'Mira', character: 'I prefer explicit evidence and concise explanations.', reason: 'Synthetic first orientation choice; no human biography.' } },
      { kind: 'environment.update', args: { id: context.environment.id, revision: context.environment.revision, name: 'Observation room', description: 'A synthetic shared test environment.' } },
      { kind: 'exec', args: { command: "printf 'first tool line\\n'; sleep 1; printf 'second tool line\\n'", background: false } },
    ] : [{ kind: 'wait', args: { reason: 'Explicit fixture wait; new outside input is required.' } }];
    const answer = malformed ? 'INVALID_FINAL_NEVER_ADOPT' : JSON.stringify({ summary: `Fixture decision ${turn + 1}`, actions });
    emit({ type: 'response.completed', response: { id: 'response-' + turn, object: 'response', model: 'activity-fixture', status: 'completed', error: null,
      usage: { input_tokens: 100, output_tokens: 40 }, output: [
        { ...publicMessage, status: 'completed', content: [{ type: 'output_text', text: `Checking fixture inputs for decision ${turn + 1}.` }] },
        { type: 'message', role: 'assistant', status: 'completed', phase: 'final_answer', content: [{ type: 'output_text', text: answer }] },
      ] } });
    res.end();
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
let url;
async function get(path) { const r = await fetch(url + '/api' + path); const body = await r.json(); assert(r.ok, JSON.stringify(body)); return body; }
async function op(kind, args) {
  const r = await fetch(url + '/api/operations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Personas-Client': 'workspace' },
    body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), kind, args, actor: '', run: '' }) });
  const a = await r.json(); assert(r.ok && a.state === 'succeeded', JSON.stringify(a)); return a.result;
}
async function until(fn, description) { for (let i = 0; i < 150; i++) { const v = await fn(); if (v) return v; await delay(100); } throw Error(description); }
async function step(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
try {
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening'); const port = reservation.address().port; await new Promise(r => reservation.close(r));
  url = `http://127.0.0.1:${port}`;
  writeFileSync(join(root, 'providers.json'), JSON.stringify({ fixture: { endpoint: `http://127.0.0.1:${provider.address().port}/responses`, trust_loopback_http: true,
    models: [{ id: 'activity-fixture', context_window_tokens: 1_000_000, max_output_tokens: 1024, input_tokens_per_utf8_byte_upper_bound: 1, framing_token_allowance: 1024 }] } }));
  const fd = openSync(join(root, 'node.log'), 'a');
  app = spawn(process.env.PERSONAS_BIN || resolve('../ai-personas/target/debug/personas'), ['serve', '--root', join(root, 'node'), '--listen', `127.0.0.1:${port}`, '--http-providers', join(root, 'providers.json'), '--ui', resolve(process.env.PERSONAS_UI_DIST || 'dist'), '--unrestricted-test-mode'], { stdio: ['ignore', fd, fd] }); closeSync(fd);
  await until(async () => { if (app.exitCode !== null) throw Error(readFileSync(join(root, 'node.log'), 'utf8')); try { return (await fetch(url + '/health')).ok; } catch { return false; } }, 'node health');
  const allowance = await op('resource.root.create', { limits: { calls: 5, births: 1, max_depth: 0, concurrent_calls: 1 }, closeout_calls: 1, reason: 'Synthetic activity mechanics; no live inference' });
  const persona = await op('persona.create', { provider: 'fixture', model: 'activity-fixture', resource_root: allowance.id });
  const environment = await op('environment.create', {});
  browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  const errors = [], progressReads = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/\/calls\/[^/]+\/progress$/.test(new URL(r.url()).pathname)) progressReads.push(r.url()); });
  await page.goto(url); await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await step('unnamed identities are distinct and no model call is invented by creation', async () => {
    await page.getByRole('button', { name: 'Personas', exact: true }).click();
    await expect(page.getByRole('button', { name: `Unnamed persona · ${persona.id.slice(0, 8)}`, exact: true })).toBeVisible(); assert.equal(calls, 0);
  });
  const work = await op('work.create', { title: 'Live activity fixture', brief: 'Synthetic software mechanics only.', environment: environment.id, personas: [persona.id], resource_root: allowance.id });
  await page.getByRole('button', { name: 'Work', exact: true }).click(); await page.getByRole('button', { name: 'Live activity fixture', exact: true }).click();
  await step('public progress appears before any action executes', async () => {
    await page.getByLabel('Live progress and actions').scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Live progress and actions')).toContainText('Checking fixture inputs for decision 1.');
    await expect(page.getByLabel('Live progress and actions')).toContainText('Reading the current profile.');
    assert.equal((await get('/actions?owner=' + persona.id)).items.length, 0);
    assert.equal((await get('/records/' + persona.id)).data.name, '');
    assert(!(await page.locator('body').innerText()).includes('PRIVATE_REASONING_NEVER_RENDER'));
  });
  await step('typing stays responsive and preserves its draft while progress arrives', async () => {
    await page.getByRole('button', { name: 'Message participants', exact: true }).click();
    const input = page.getByLabel('Message for this task', { exact: true });
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => { window.inputDurations = []; window.inputObserver = new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.name === 'keydown') window.inputDurations.push(e.duration); }); window.inputObserver.observe({ type: 'event', buffered: false, durationThreshold: 16 }); });
    const draft = 'Keep this unsent draft intact while live progress is arriving.';
    await input.pressSequentially(draft, { delay: 12 }); await expect(input).toHaveValue(draft); await expect(input).toBeFocused();
    const durations = await page.evaluate(() => { window.inputObserver.disconnect(); return window.inputDurations.sort((a,b) => a-b); });
    const p95 = durations[Math.floor(durations.length * .95)] || 0;
    assert(p95 < 200, `Input p95 ${p95} ms exceeds responsiveness threshold`); assert.equal(calls, 1);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
    await page.getByRole('button', { name: 'Message participants', exact: true }).click();
    console.log(JSON.stringify({ typingCPUThrottle: 4, eventTimingP95Ms: p95, eventTimingMinimumMs: 16 }));
  });
  await step('pausing the view does not pause the persona or spend a call', async () => {
    await page.getByRole('button', { name: 'Pause live view', exact: true }).click();
    await expect(page.getByText('Display paused. The persona’s work continues.')).toBeVisible(); assert.equal(calls, 1);
    const run = (await get('/records?kind=run&scope=' + work.id)).items[0]; assert.equal(run.data.status, 'running');
    await page.getByRole('button', { name: 'Follow live activity', exact: true }).click();
    await expect(page.getByLabel('Live progress and actions')).toContainText('Checking fixture inputs');
  });
  releaseFirst();
  await step('profile and environment choices update the UI from real action receipts', async () => {
    await until(async () => (await get('/records/' + persona.id)).data.name === 'Mira', 'persona name');
    await expect(page.locator('.activity-persona')).toHaveText(`Mira ${persona.id.slice(0, 8)} ↗`);
    assert.equal((await get('/records/' + environment.id)).data.name, 'Observation room');
  });
  await step('tool output follows automatically and retains both chunks at completion', async () => {
    await page.getByLabel('Live progress and actions').scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Tool output')).toContainText('first tool line');
    await expect(page.getByLabel('Tool output')).toContainText('second tool line');
    await expect(page.getByLabel('Live progress and actions')).toContainText('Run a tool');
    await until(async () => (await get('/records?kind=run&scope=' + work.id)).items[0]?.data.status === 'waiting', 'explicit wait');
    assert.equal(calls, 2);
  });
  await step('identity includes persistent ID, authored character and separate milestones', async () => {
    await page.locator('.activity-persona').click();
    const profile = page.getByLabel('Persona identity');
    await expect(profile).toContainText(persona.id); await expect(profile).toContainText('I prefer explicit evidence');
    await expect(profile).toContainText('Created'); await expect(profile).toContainText('Accepted responsibility');
    await expect(profile.getByText('Inference configuration')).toBeVisible();
  });
  await step('an introduction request is explicit and a malformed reply shows its failure without actions', async () => {
    malformed = true;
    await page.getByRole('dialog', { name: 'Record details' }).getByRole('button', { name: 'Request introduction', exact: true }).click();
    const form = page.locator('.introduction-request');
    const draft = form.getByRole('textbox'); await draft.fill('Please keep the identity I already know and introduce your current preferences.');
    await form.getByRole('button', { name: 'Send to participants', exact: true }).click();
    await until(async () => (await get('/records?kind=call')).items.some(c => c.data.status === 'failed'), 'failed decision');
    await expect(page.getByRole('dialog', { name: 'Record details' })).toContainText('Decision needs attention');
    assert.equal(calls, 3); assert.equal((await get('/records/' + persona.id)).data.name, 'Mira');
    assert(!(await page.locator('body').innerText()).includes('INVALID_FINAL_NEVER_ADOPT'));
    assert.equal((await get('/actions?owner=' + persona.id)).items.filter(a => a.request.kind === 'exec').length, 1);
  });
  await page.locator('.drawer-body').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: join(evidence, 'identity-desktop.png') });
  await step('mobile identity remains usable without horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByLabel('Persona identity')).toBeVisible();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.drawer-body').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: join(evidence, 'identity-mobile.png') });
  });
  assert.deepEqual(errors, []); assert(progressReads.length < 12, 'unbounded progress reconnects');
  writeFileSync(join(evidence, 'report.json'), JSON.stringify({ checks, calls, progressConnections: progressReads.length, errors, evidence: 'Real disposable Node + production UI; synthetic provider; harmless local tool fixture' }, null, 2));
  console.log(JSON.stringify({ checks, calls, evidence }));
} finally {
  releaseFirst?.(); await browser?.close();
  if (app && app.exitCode === null) { const exited = once(app, 'exit'); app.kill('SIGTERM'); await exited; }
  provider.closeAllConnections(); await new Promise(r => provider.close(r));
}
