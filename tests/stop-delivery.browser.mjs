/** Production components with synthetic records; no runtime or model is used. */
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

await mkdir('.qa', { recursive: true });
const harness = '.qa/stop-delivery-harness.tsx';
await writeFile(harness, `import {render} from 'preact';
import {RunProgress} from '../src/RunProgress';
import RecordReader from '../src/RecordReader';
import '../src/style.css';
const api=window as any; api.actions=[];
api.mount=(run:any, submission:any)=>render(<><RunProgress run={run} open={()=>{}} act={async (...args:any[])=>{api.actions.push(args);}}/><RecordReader record={submission} open={()=>{}}/></>,document.getElementById('fixture')!);`);
let server, browser;
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, clearScreen: false });
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } }), errors = [], methods = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/stop-delivery-fixture', route => route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app" hidden></div><main id="fixture" style="padding:12px"></main><script type="module" src="/.qa/stop-delivery-harness.tsx"></script></body></html>' }));
  await page.route('**/api/**', route => {
    // Production composer imports the app's shared primitives. Keep its auth
    // bootstrap disconnected while testing the rendered participation alone.
    if (route.request().url().endsWith('/session')) return route.fulfill({ status: 401, json: { error: 'Synthetic fixture is disconnected' } });
    methods.push(route.request().method());
    const id = route.request().url().split('/').at(-1);
    return route.fulfill({ json: route.request().url().includes('/records/') ? { id, kind: 'document', scope: '', revision: 1, created: '', updated: '', data: { title: 'Owned source policy' } } : [] });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/stop-delivery-fixture`);
  await page.waitForFunction(() => typeof window.mount === 'function');
  const run = { id: 'a'.repeat(32), kind: 'run', scope: 'b'.repeat(32), revision: 3, created: '2026-10-01T00:00:00Z', updated: '2026-10-01T00:00:00Z', data: {
    persona: 'c'.repeat(32), status: 'paused', membership: 'accepted', note: 'The requested evidence is still outstanding.',
    stop_disposition: { classification: 'voluntary_yield', automatic_acceptance: false },
    stop_context: { schema: 'stop-context/1', binding: 'adopted', delivery_gaps: { adopted_candidate_missing: true, uncovered_outcomes: ['result'], blocking_findings: 2, stale_checks: 1 }, pending_requests: [{}], handoff_gaps: [{}], sharing_restrictions: [{}] }
  } };
  const submission = { id: 'd'.repeat(32), kind: 'submission', scope: run.scope, revision: 1, created: run.created, updated: run.updated, data: {
    summary: 'A retained contribution awaits a sharing choice.', peer_delivery: { schema: 'submission-delivery/1', restricted_peers: 1, readable_peers: 0, recovery: {
      schema: 'delivery-recovery/2', complete: false, audience_complete: true, audience: [], owned_sources: [{ subject: { id: 'e'.repeat(32), revision: 2 }, readers: null, readers_complete: false, allow_export: false, implicit_audiences: {} }]
    } }
  } };
  await page.evaluate(({ run, submission }) => window.mount(run, submission), { run, submission });
  await expect(page.getByText(run.data.note, { exact: true })).toBeVisible();
  const gaps = page.getByRole('region', { name: 'Current recorded gaps' });
  await expect(gaps).toContainText('Required outcomes without current evidence: result');
  await expect(gaps).toContainText('Blocking findings: 2. Stale checks: 1.');
  await expect(gaps).toContainText('Open questions: 1. Responsibilities needing a handoff: 1.');
  await expect(gaps).toContainText('1 retained contributions have current peer access restrictions.');
  const recovery = page.getByRole('region', { name: 'Sharing recovery choices' });
  await expect(recovery).toContainText('This source check is incomplete');
  await expect(recovery).toContainText('incomplete; inspect the exact policy before replacing its readers');
  await expect(recovery).toContainText('No source was automatically shared.');
  assert.deepEqual(await page.evaluate(() => window.actions), []);
  run.data.stop_context = { schema: 'stop-context/1', binding: 'adopted', delivery_gaps: { adopted_candidate_missing: false, uncovered_outcomes: [], blocking_findings: 0, stale_checks: 0 }, pending_requests: [], handoff_gaps: [], sharing_restrictions: [] };
  submission.data.peer_delivery = { schema: 'submission-delivery/1', restricted_peers: 0, readable_peers: 1 };
  await page.evaluate(({ run, submission }) => window.mount(run, submission), { run, submission });
  await expect(gaps).toContainText('Required outcomes without current evidence: none recorded.');
  await expect(page.getByText(run.data.note, { exact: true })).toBeVisible();
  await expect(recovery).toHaveCount(0);
  await expect(page.getByText('Checked delivery recorded', { exact: false })).toHaveCount(0);
  assert.deepEqual(await page.evaluate(() => window.actions), []);
  assert.ok(methods.every(method => method === 'GET'), 'rendering must only read');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile layout fits');
  assert.deepEqual(errors, []);
  console.log('Stop and delivery browser checks passed: authored stop, changing recorded gaps, current sharing restrictions, bounded recovery, no mutation or quality verdict, mobile fit.');
} finally {
  await browser?.close();
  await server?.close();
  await rm(harness, { force: true });
}
