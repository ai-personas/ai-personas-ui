/** Production UI + real restricted Rust/SQLite + synthetic local inference. */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const root = mkdtempSync(join(tmpdir(), 'personas-participants-'));
const binary = process.env.PERSONAS_BIN || resolve('../ai-personas/target/debug/personas');
let app, browser, page, url, calls = 0, checks = 0;
const errors = [], providerErrors = [];
const delay = ms => new Promise(r => setTimeout(r, ms));
const provider = createServer(async (req, res) => {
  try {
    let body = ''; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body), context = JSON.parse(input.input[0].content[0].text);
    calls++;
    let actions;
    const sharedQuestion = context.selected_records.find(r => r.kind === 'request' && r.data.purpose === 'Shared fixture question');
    const peerAnswer = context.selected_records.find(r => r.kind === 'response' && r.data.text === 'Peer answer from Bo fixture.');
    const groupInput = context.messages.find(r => r.data.text === 'Compare choices together.');
    const directInput = context.messages.find(r => r.data.text === 'Use this additional fixture direction for this task.');
    if (context.run.data.membership === 'invited') {
      const invitation = context.work.data.core.invitation;
      actions = [{ kind: 'invitation.respond', args: { id: invitation.id, revision: invitation.revision, accept: true, reason: 'Synthetic consent' } }];
    } else if (context.persona.data.name === 'Bo fixture' && sharedQuestion && !context.history.some(a => a.request.kind === 'request.respond' && a.request.args.request === sharedQuestion.id)) {
      actions = [{ kind: 'request.respond', args: { request: sharedQuestion.id, text: 'Peer answer from Bo fixture.', artifacts: [] } }];
    } else if (context.persona.data.name === 'Ada fixture' && peerAnswer && !context.history.some(a => a.request.kind === 'request.resolve' && a.request.args.request === peerAnswer.data.request)) {
      actions = [
        { kind: 'message.send', args: { to: 'user', text: 'I received the peer answer and used it for this response.' } },
        { kind: 'request.resolve', args: { request: peerAnswer.data.request, conclusion: 'The peer supplied the requested fixture answer.', evidence: [peerAnswer.id] } }
      ];
    } else if (context.persona.data.name === 'Ada fixture' && groupInput && !context.history.some(a => a.request.kind === 'request.create' && a.request.args.purpose === 'Shared fixture question')) {
      actions = [{ kind: 'request.create', args: { audience: 'work', purpose: 'Shared fixture question', instructions: 'Can another participant supply a fixture answer?', evidence_required: 'An attributed peer answer.', artifacts: [] } }];
    } else if (directInput && !context.history.some(a => a.request.kind === 'message.send' && a.request.args.to === 'user')) {
      actions = [{ kind: 'message.send', args: { to: 'user', text: 'I considered your additional fixture direction.' } }];
    } else if (context.work.data.title !== 'Group task' && !context.history.some(a => a.request.kind === 'request.create')) {
      actions = [{ kind: 'request.create', args: { audience: 'user', purpose: `Question from ${context.persona.data.name}`, instructions: 'Please provide a fixture observation.', evidence_required: 'A text answer.', artifacts: [] } }];
    } else actions = [{ kind: 'wait', args: { reason: 'Waiting for fixture input' } }];
    if (context.inputs.through && actions[0].kind !== 'invitation.respond') {
      actions.unshift({ kind: 'input.acknowledge', args: { through: context.inputs.through } });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'fixture-' + calls, object: 'response', status: 'completed', model: 'roster-fixture',
      output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ continuity: { focus: 'Continue the fixture', disposition: 'no_change', learning: 'Synthetic contract fixture; no experience claimed.', changes: [], records: [], actions: [], retrieval_query: '', handoff: '' }, summary: 'Synthetic roster decision', actions }) }] }],
      usage: { input_tokens: 100, output_tokens: 25, total_tokens: 125, input_tokens_details: { cached_tokens: 0 } } }));
  } catch (e) { providerErrors.push(String(e)); res.writeHead(500); res.end('{}'); }
});
async function get(path) { const r = await fetch(url + '/api' + path); const body = await r.json(); assert(r.ok, JSON.stringify(body)); return body; }
async function op(kind, args, actor = '') {
  const r = await fetch(url + '/api/operations', { method: 'POST', headers: { 'X-Personas-Client': 'workspace', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), kind, args, actor, run: '' }) });
  const body = await r.json(); assert(r.ok, JSON.stringify(body)); assert.equal(body.state, 'succeeded', JSON.stringify(body)); return body.result;
}
async function until(fn, name) { for (let n = 0; n < 160; n++) { const r = await fn(); if (r) return r; await delay(100); } throw Error('Timed out: ' + name); }
async function step(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
async function stopNode() { if (app && app.exitCode === null) { const exited = once(app, 'exit'); app.kill('SIGTERM'); await exited; } }
async function startNode() {
  const fd = openSync(join(root, 'node.log'), 'a');
  app = spawn(binary, ['serve', '--root', join(root, 'node'), '--listen', url.replace('http://', ''), '--http-providers', join(root, 'providers.json'), '--ui', resolve(process.env.PERSONAS_UI_DIST || 'dist')], { stdio: ['ignore', fd, fd] }); closeSync(fd);
  await until(async () => { if (app.exitCode !== null) throw Error(readFileSync(join(root, 'node.log'), 'utf8')); try { return (await fetch(url + '/health')).ok; } catch { return false; } }, 'node');
}
const bounds = { expires: '2099-01-01T00:00:00Z', tokens: 10000000, closeout_tokens: 1000, cost_units: 1000000, closeout_cost_units: 100, currency: 'fixture',
  prices: [{ provider: 'fixture', model: 'roster-fixture', input_units_per_million: 0, output_units_per_million: 0, evidence: 'Local synthetic provider' }], remote_calls: 2, retained_payload_bytes: 1000000000,
  cpu_seconds: 20, effect_operations: 20, concurrent_memory_bytes: 1073741824, births_per_window: 4, birth_window_seconds: 60, reason: 'Fixture bounds' };
try {
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening'); url = `http://127.0.0.1:${reservation.address().port}`; await new Promise(r => reservation.close(r));
  writeFileSync(join(root, 'providers.json'), JSON.stringify({ fixture: { endpoint: `http://127.0.0.1:${provider.address().port}/responses`, trust_loopback_http: true,
    models: [{ id: 'roster-fixture', context_window_tokens: 1000000, max_output_tokens: 1024, input_tokens_per_utf8_byte_upper_bound: 1, framing_token_allowance: 1024 }] } }));
  await startNode();
  let allowance = await op('resource.root.create', { limits: { calls: 80, births: 5, max_depth: 4, concurrent_calls: 2 }, closeout_calls: 2, reason: 'Roster fixture' });
  allowance = await op('resource.bounds.configure', { root: allowance.id, revision: allowance.revision, bounds });
  const people = [];
  for (const name of ['Ada fixture', 'Bo fixture']) {
    let person = await op('persona.create', { provider: 'fixture', model: 'roster-fixture', resource_root: allowance.id });
    person = await op('persona.update', { revision: person.revision, name, reason: 'Fixture identity' }, person.id); people.push(person);
  }
  let environment = await op('environment.create', {});
  environment = await op('environment.update', { id: environment.id, revision: environment.revision, name: 'Roster environment' });
  browser = await chromium.launch({ headless: true }); page = await browser.newPage({ viewport: { width: 1360, height: 900 } }); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  const details = page.getByRole('dialog', { name: 'Record details', exact: true });
  const manager = () => page.getByRole('region', { name: 'Manage personas', exact: true });
  const add = async (name, environment = false) => {
    await manager().getByRole('button', { name: 'Add persona', exact: true }).click();
    await manager().getByRole('radio', { name: new RegExp(name) }).check();
    await manager().getByRole('button', { name: environment ? 'Add to environment' : 'Invite to work', exact: true }).click();
    await expect(manager().locator('.participant-editor')).toHaveCount(0);
    await expect(manager().getByRole('button', { name, exact: true })).toBeVisible();
  };
  const remove = async name => {
    await manager().getByRole('button', { name: 'Remove ' + name, exact: true }).click();
    await manager().getByRole('button', { name: 'Remove persona', exact: true }).click();
    await expect(manager().locator('.participant-editor')).toHaveCount(0);
    await expect(manager().getByRole('button', { name, exact: true })).toHaveCount(0);
  };
  await step('environment roster can add and remove personas before any work exists', async () => {
    await page.getByRole('button', { name: 'Environments', exact: true }).click();
    await page.getByRole('button', { name: 'Roster environment', exact: true }).click();
    await add('Ada fixture', true); await remove('Ada fixture'); await add('Ada fixture', true);
    assert.equal(calls, 0); await details.getByRole('button', { name: 'Close details', exact: true }).click();
  });
  let work;
  await step('environment tool controls reflect real bindings and add or remove without inference', async () => {
    await page.getByRole('button', { name: 'Roster environment', exact: true }).click();
    await details.getByRole('button', { name: 'Tools', exact: true }).click();
    const card = details.locator('.environment-tool').filter({ has: page.getByRole('heading', { name: 'Browser research', exact: true }) });
    await expect(card).toContainText('Ready to try · not checked yet');
    await card.getByRole('button', { name: 'Remove tool', exact: true }).click();
    await expect(card).toContainText('Not enabled');
    await card.getByRole('button', { name: 'Add tool', exact: true }).click();
    await expect(card).toContainText('Ready to try · not checked yet');
    const bindings = (await get('/records?kind=environment_tool&scope=' + environment.id)).items;
    assert.equal(bindings.length, 2); assert(bindings.every(r => r.data.enabled && r.data.tool));
    assert.equal(calls, 0);
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
  });
  await step('new work can select its environment roster', async () => {
    await page.getByRole('button', { name: 'Work', exact: true }).click();
    await page.locator('.page-heading').getByRole('button', { name: '+ New work', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Create', exact: true });
    await form.getByLabel('Short title').fill('Roster task'); await form.getByLabel('Your instructions').fill('Request a fixture observation.');
    await form.getByRole('radio', { name: 'Roster environment' }).check();
    await form.getByRole('button', { name: 'Use environment personas (1)', exact: true }).click();
    await expect(form.getByRole('checkbox', { name: /Ada fixture/ })).toBeChecked();
    await form.getByLabel('Funding allowance', { exact: true }).selectOption(allowance.id);
    await form.getByRole('button', { name: 'Create', exact: true }).click(); await expect(form).toHaveCount(0);
    work = (await get('/records?kind=work')).items[0];
    await until(async () => (await get('/attention')).requests === 1, 'first request');
  });
  await step('unanswered input highlights navigation, work, persona and environment', async () => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const name of ['Work', 'Personas', 'Environments']) await expect(nav.getByRole('button', { name, exact: true })).toHaveClass(/nav-attention/);
    await expect(page.locator('.work-row.needs-input')).toHaveCount(1);
    await page.getByRole('button', { name: 'Environments', exact: true }).click();
    await expect(page.locator('.card.needs-input')).toHaveCount(1);
    await page.getByRole('button', { name: 'Roster environment', exact: true }).click();
    await expect(details.locator('.input-notice').first()).toContainText('needs your input');
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    await page.getByRole('button', { name: 'Personas', exact: true }).click();
    await expect(page.locator('.card.needs-input')).toHaveCount(1);
    await page.screenshot({ path: join(root, 'attention-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(root, 'attention-mobile.png'), fullPage: true });
  });
  await step('Respond now opens the exact request and a reply clears every input highlight', async () => {
    await page.locator('.card.needs-input').getByRole('button', { name: /Respond now/ }).click();
    await expect(details).toContainText('Question from Ada fixture');
    await details.getByLabel('Your response').fill('A synthetic observation.'); await details.getByRole('button', { name: 'Send response', exact: true }).click();
    await expect(details).toContainText('Response delivered'); await details.getByRole('button', { name: 'Close details', exact: true }).click();
    await expect(page.locator('.nav-attention')).toHaveCount(0); await expect(page.locator('.card.needs-input')).toHaveCount(0);
    assert.equal((await get('/records/' + work.id)).data.pending_requests, 1);
    assert.equal((await get('/records/' + work.id)).data.input_requests, 0);
  });
  await step('waiting activity accepts a direct work reply after the input request has been answered', async () => {
    await page.getByRole('button', { name: 'Work', exact: true }).click();
    await page.getByRole('button', { name: 'Roster task', exact: true }).click();
    const run = await until(async () => (await get('/records?kind=run&scope=' + work.id)).items.find(r => r.data.persona === people[0].id && r.data.status === 'waiting'), 'waiting owner');
    const card = page.locator('.work-record[data-kind="run"]').filter({ has: page.getByRole('button', { name: new RegExp('Ada fixture ' + people[0].id.slice(0, 8)) }) });
    await card.getByRole('button', { name: 'Reply to persona', exact: true }).click();
    await expect(card.getByLabel('Your reply or direction')).toBeFocused();
    await expect(card.getByLabel('Reply audience')).toHaveValue('work');
    await card.getByLabel('Reply audience').selectOption('persona');
    await card.getByLabel('Your reply or direction').fill('Use this additional fixture direction for this task.');
    let rejected = false;
    const rejectFirstReply = async route => {
      if (!rejected && route.request().postDataJSON()?.kind === 'message.send') {
        rejected = true;
        return route.fulfill({ status: 400, json: { error: 'Synthetic reply rejection' } });
      }
      return route.continue();
    };
    await page.route('**/api/operations', rejectFirstReply);
    await card.getByRole('button', { name: 'Send reply', exact: true }).click();
    await expect(card.getByRole('alert')).toContainText('Synthetic reply rejection');
    await expect(card.getByLabel('Your reply or direction')).toHaveValue('Use this additional fixture direction for this task.');
    const before = calls;
    await card.getByRole('button', { name: 'Send reply', exact: true }).click();
    await expect(card.getByText('Message saved.', { exact: true })).toBeVisible();
    await page.unroute('**/api/operations', rejectFirstReply);
    await until(async () => calls > before && (await get('/records/' + run.id)).data.status === 'waiting', 'scoped reply wakes waiting activity');
    const message = (await get('/records?kind=message')).items[0];
    const saved = await get('/records/' + message.id);
    assert.equal(saved.data.to, people[0].id); assert.equal(saved.data.work, work.id); assert.equal(saved.data.from, '');
    assert.equal(saved.data.text, 'Use this additional fixture direction for this task.');
    assert.equal((await get('/attention')).requests, 0);
    assert.equal((await get('/records?kind=response')).items.length, 1, 'a new message does not fabricate a request response');
    await expect(card).toContainText('Persona acknowledged your input.');
    await expect(page.getByRole('region', { name: 'Work conversation' })).toContainText('I considered your additional fixture direction.');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await card.locator('.run-reply').screenshot({ path: join(root, 'waiting-reply-mobile.png') });
    await card.getByRole('button', { name: 'Close reply', exact: true }).click();
    await card.getByRole('button', { name: 'View details ↗', exact: true }).click();
    await expect(details.getByRole('button', { name: 'Reply to persona', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    await card.locator('.activity-persona').click();
    await expect(details.getByRole('button', { name: 'Reply to persona', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    await page.getByRole('button', { name: '← All work', exact: true }).click();
  });
  await step('existing work supports adding, removing and reinviting personas', async () => {
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.getByRole('button', { name: 'Work', exact: true }).click(); await page.getByRole('button', { name: 'Roster task', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Manage personas', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'People & agreements', exact: true }).click(); await add('Bo fixture');
    await until(async () => (await get('/attention')).requests === 1, 'invited persona request');
    await expect(manager().locator('.participant-row.needs-input')).toHaveCount(1);
    await page.screenshot({ path: join(root, 'participants-desktop.png'), fullPage: true });
    const oldRun = (await get('/records?kind=run&scope=' + work.id)).items.find(r => r.data.persona === people[1].id);
    await remove('Bo fixture'); await expect(page.locator('.nav-attention')).toHaveCount(0);
    assert.equal((await get('/records/' + oldRun.id)).data.membership, 'removed');
    await add('Bo fixture'); await until(async () => (await get('/attention')).requests === 1, 'new invitation request');
    assert.equal((await get('/records/' + oldRun.id)).data.membership, 'removed');
  });
  await step('group replies reach both personas and a peer can answer a shared question', async () => {
    // A visible question can precede the final wait call. Complete that setup
    // before starting the second task; this check is about group messaging.
    await until(async () => (await get('/records?kind=call&limit=100')).items.every(r => !['running', 'decided'].includes(r.data.status)), 'previous task inference settled');
    const groupWork = await op('work.create', { title: 'Group task', brief: 'Discuss shared choices', environment: environment.id, personas: people.map(p => p.id), resource_root: allowance.id });
    await until(async () => {
      const runs = (await get('/records?kind=run&scope=' + groupWork.id)).items;
      return runs.length === 2 && runs.every(r => r.data.status === 'waiting' && r.data.membership === 'accepted');
    }, 'group membership and initial wait');
    await page.getByRole('button', { name: 'Work', exact: true }).click();
    await page.getByRole('button', { name: 'Group task', exact: true }).click();
    const card = page.locator('.work-record[data-kind="run"]').filter({ has: page.getByRole('button', { name: new RegExp('Ada fixture ' + people[0].id.slice(0, 8)) }) });
    await card.getByRole('button', { name: 'Reply to persona', exact: true }).click();
    await expect(card.getByLabel('Reply audience')).toHaveValue('work');
    await card.getByLabel('Your reply or direction').fill('Compare choices together.');
    await card.getByRole('button', { name: 'Send reply', exact: true }).click();
    const shared = await until(async () => {
      const r = (await get('/records?kind=request&scope=' + groupWork.id)).items.find(r => r.data.purpose === 'Shared fixture question');
      return r?.data.status === 'resolved' && r;
    }, 'shared question answered by peer and resolved by owner');
    const response = (await get('/records?kind=response&scope=' + shared.id)).items[0];
    assert.equal(response.data.from, people[1].id);
    const conversation = page.getByRole('region', { name: 'Work conversation' });
    await expect(conversation).toContainText('Peer answer from Bo fixture.');
    await expect(conversation).toContainText('I received the peer answer and used it for this response.');
    await expect(conversation).toContainText('All work participants');
    await expect(conversation).toContainText('Shared answer');
    const input = (await get('/records?kind=message')).items.find(r => r.data.text === 'Compare choices together.');
    assert.equal(input.data.to, environment.id);
    const receipt = await until(async () => {
      const d = await get('/messages/' + input.id + '/delivery');
      return d.items.length === 2 && d.items.every(r => r.included_call && r.acknowledged) && d;
    }, 'both personas consider group message');
    assert.deepEqual(receipt.items.map(r => r.persona).sort(), people.map(r => r.id).sort());
    await card.getByRole('button', { name: 'Close reply', exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await conversation.screenshot({ path: join(root, 'group-conversation.png') });
    assert.equal((await get('/attention')).requests, 1, 'peer answer does not answer a separate user-only request');
  });
  await step('environment removal ends participation across its work and survives restart', async () => {
    await op('work.create', { title: 'Second task', brief: 'Ask for another observation', environment: environment.id, personas: [people[1].id], resource_root: allowance.id });
    await until(async () => (await get('/attention')).requests === 2, 'two pending requests');
    await page.getByRole('button', { name: 'Environments', exact: true }).click(); await page.getByRole('button', { name: 'Roster environment', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 }); await remove('Bo fixture');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await expect(page.locator('.nav-attention')).toHaveCount(0);
    await expect(details.locator('.needs-input')).toHaveCount(0);
    await details.locator('.drawer-body').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: join(root, 'participants-mobile.png') });
    for (const run of (await get('/records?kind=run')).items.filter(r => r.data.persona === people[1].id)) assert.equal(run.data.membership, 'removed');
    await stopNode(); await startNode(); await page.goto(url);
    assert.equal((await get('/attention')).requests, 0);
    assert.deepEqual((await get('/records/' + environment.id)).data.participant_ids, [people[0].id]);
    await page.getByRole('button', { name: 'Environments', exact: true }).click(); await page.getByRole('button', { name: 'Roster environment', exact: true }).click();
    await expect(manager().getByRole('button', { name: 'Ada fixture', exact: true })).toBeVisible();
    await expect(manager().getByRole('button', { name: 'Bo fixture', exact: true })).toHaveCount(0);
  });
  assert.deepEqual(errors, []); assert.deepEqual(providerErrors, []); assert(calls < 40);
  writeFileSync(join(root, 'report.json'), JSON.stringify({ checks, calls, errors, providerErrors }, null, 2));
  console.log(JSON.stringify({ checks, calls, evidence: root }));
} catch (e) {
  if (page) { await page.screenshot({ path: join(root, 'failure.png'), fullPage: true }).catch(() => {}); writeFileSync(join(root, 'failure.txt'), String(e) + '\n' + await page.locator('body').innerText().catch(() => '')); }
  throw e;
} finally {
  await browser?.close(); await stopNode(); provider.closeAllConnections(); await new Promise(r => provider.close(r)); console.log('Private evidence: ' + root);
}
