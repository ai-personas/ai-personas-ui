// Synthetic transport exercises the real lazy readers and useResource hook.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const port = 5199, origin = `http://127.0.0.1:${port}`;
const owner = 'a'.repeat(32), fragment = 'b'.repeat(32), node = 'c'.repeat(32);
const validFragment = {
  id: fragment, kind: 'fragment', revision: 1, scope: owner,
  created: '2026-09-26T00:00:00Z', updated: '2026-09-26T00:00:00Z',
  data: { owner, status: 'retained', title: 'Exact memory',
    content: '## Exact lesson\n\nPERMITTED_FRAGMENT_TEXT', draft: {} },
};
const validNode = {
  id: node, kind: 'memory_node', revision: 2, scope: owner,
  data: { owner, status: 'retained', fragment: { id: fragment, revision: 1 },
    locator: { description: 'An exact retrieval utility', parameters: [], script: 'PERMITTED_UTILITY_CODE' } },
};
const harness = '.qa/memory-details-harness.tsx';
await mkdir('.qa', { recursive: true });
await writeFile(harness, `
import { render } from 'preact';
import { useState } from 'preact/hooks';
import Fragment from '../src/MemoryFragment';
import Locator from '../src/MemoryLocator';
import { useResource } from '../src/hooks';
import { changes } from '../src/api';
import '../src/style.css';
const w = window as any;
w.shown = []; w.listeners = 0; w.opened = [];
const add = changes.addEventListener.bind(changes), remove = changes.removeEventListener.bind(changes);
changes.addEventListener = (...a) => { w.listeners++; return add(...a); };
changes.removeEventListener = (...a) => { w.listeners--; return remove(...a); };
w.invalidate = (detail: any = {kind:'information_policy'}) => changes.dispatchEvent(new CustomEvent('change', {detail}));
function Probe() {
  const [enabled, setEnabled] = useState(true);
  w.enableProbe = setEnabled;
  const state = useResource<{label:string}>('/memory-details-probe', () => true, enabled);
  const visible = !state.loading ? state.error || state.value?.label || '' : '';
  if (visible) w.shown.push(visible);
  return <p data-testid="probe">{visible || (enabled ? 'Revalidating' : 'Disabled')}</p>;
}
function App() {
  const [pane, setPane] = useState('none');
  w.showMemory = setPane;
  return <main style="padding:12px">
    {pane === 'fragment' && <Fragment id="${fragment}" revision={1} owner="${owner}" open={id => w.opened.push(id)}/>}
    {pane === 'utility' && <Locator node="${node}" revision={2} fragment={{id:'${fragment}',revision:1}} owner="${owner}"/>}
    {pane === 'probe' && <Probe/>}
  </main>;
}
render(<App/>, document.getElementById('test')!);
`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, 'Vite must be ready before the browser test');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = [], writes = [], probeRequests = [], heldFragments = [], heldUtilities = [];
  let fragmentBody = { ...validFragment, revision: 2 }, utilityBody = validNode;
  let holdFragment = false, holdUtility = false, usageRequests = 0;
  let usageBody = { selected_participations: 1, admitted_calls: 2, recent_calls: [] };
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); });
  await page.route('**/memory-details-fixture', route => route.fulfill({ contentType: 'text/html',
    body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="test"></div><script type="module" src="/.qa/memory-details-harness.tsx"></script></body></html>' }));
  await page.route('**/api/records/' + fragment, route => {
    if (holdFragment) { heldFragments.push(route); return; }
    return route.fulfill({ json: fragmentBody });
  });
  await page.route('**/api/records/' + node, route => {
    if (holdUtility) { heldUtilities.push(route); return; }
    return route.fulfill({ json: utilityBody });
  });
  await page.route('**/api/personas/*/memory/usage/*', route => { usageRequests++; return route.fulfill({ json: usageBody }); });
  await page.route('**/api/memory-details-probe', route => { probeRequests.push(route); });
  await page.goto(origin + '/memory-details-fixture');
  await page.waitForFunction(() => typeof window.showMemory === 'function');

  await page.evaluate(() => window.showMemory('fragment'));
  await expect(page.getByRole('alert')).toContainText('no longer matches this graph card');
  await expect(page.getByText('PERMITTED_FRAGMENT_TEXT', { exact: true })).toHaveCount(0);
  assert.equal(usageRequests, 0, 'invalid fragment must not load usage evidence');
  console.log('PASS detail: a new fragment version is not silently substituted');

  fragmentBody = validFragment;
  await page.getByRole('button', { name: 'Retry fragment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exact lesson', exact: true })).toBeVisible();
  await expect(page.getByText('Selected in 1 participation.', { exact: true })).toBeVisible();
  console.log('PASS detail: exact-version retry restores valid fragment and usage');

  usageBody = { ...usageBody, admitted_calls: -1 };
  await page.evaluate(() => window.invalidate({ kind: 'call' }));
  await expect(page.getByRole('alert')).toContainText('Usage evidence is incomplete or malformed');
  await expect(page.getByText('Selected in 1 participation.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Exact lesson', exact: true })).toBeVisible();
  console.log('PASS detail: malformed usage is not current measured evidence');

  holdFragment = true;
  await page.evaluate(id => window.invalidate({ kind: 'fragment', entity: id }), fragment);
  await expect(page.getByRole('heading', { name: 'Exact lesson', exact: true })).toHaveCount(0);
  await expect.poll(() => heldFragments.length).toBe(1);
  await heldFragments[0].fulfill({ status: 403, json: { error: 'Fragment access revoked' } });
  await expect(page.getByRole('alert')).toContainText('Fragment access revoked');
  await expect(page.getByText('PERMITTED_FRAGMENT_TEXT', { exact: true })).toHaveCount(0);
  console.log('PASS detail: refresh and failed access both withhold retained prose');

  await page.evaluate(() => window.showMemory('utility'));
  await expect(page.getByText('View utility code · revision 2', { exact: true })).toBeVisible();
  await page.getByText('View utility code · revision 2', { exact: true }).click();
  await expect(page.locator('.memory-code')).toHaveText('PERMITTED_UTILITY_CODE');
  holdUtility = true;
  await page.evaluate(() => window.invalidate());
  await expect(page.locator('.memory-code')).toHaveCount(0);
  await expect.poll(() => heldUtilities.length).toBe(1);
  await heldUtilities[0].fulfill({ status: 403, json: { error: 'Utility access revoked' } });
  await expect(page.getByRole('alert')).toContainText('Utility access revoked');
  await expect(page.locator('.memory-code')).toHaveCount(0);
  console.log('PASS utility: refreshing or denied utility code is withheld');

  holdUtility = false;
  utilityBody = { ...validNode, data: { ...validNode.data, fragment: { id: fragment, revision: 2 } } };
  await page.getByRole('button', { name: 'Retry retrieval utility', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('no longer matches this graph card');
  await expect(page.locator('.memory-code')).toHaveCount(0);
  console.log('PASS utility: an exact node with a mismatched fragment binding is rejected');

  await page.evaluate(() => window.showMemory('probe'));
  await expect.poll(() => probeRequests.length).toBe(1);
  await page.evaluate(() => window.invalidate());
  await probeRequests[0].fulfill({ json: { label: 'STALE_SUCCESS' } });
  await expect.poll(() => probeRequests.length).toBe(2);
  assert(!(await page.evaluate(() => window.shown)).includes('STALE_SUCCESS'));
  await probeRequests[1].fulfill({ json: { label: 'FRESH_SUCCESS' } });
  await expect(page.getByTestId('probe')).toHaveText('FRESH_SUCCESS');
  console.log('PASS race: invalidated in-flight success is never displayed as current');

  await page.evaluate(() => window.invalidate());
  await expect.poll(() => probeRequests.length).toBe(3);
  await page.evaluate(() => window.invalidate());
  await probeRequests[2].fulfill({ status: 403, json: { error: 'STALE_FAILURE' } });
  await expect.poll(() => probeRequests.length).toBe(4);
  assert(!(await page.evaluate(() => window.shown)).includes('STALE_FAILURE'));
  await probeRequests[3].fulfill({ json: { label: 'REVALIDATED_SUCCESS' } });
  await expect(page.getByTestId('probe')).toHaveText('REVALIDATED_SUCCESS');
  console.log('PASS race: invalidated in-flight failure cannot terminate revalidation');

  await page.evaluate(() => window.enableProbe(false));
  await expect(page.getByTestId('probe')).toHaveText('Disabled');
  await expect.poll(() => page.evaluate(() => window.listeners)).toBe(0);
  await page.evaluate(() => { window.shown = []; window.enableProbe(true); });
  await expect.poll(() => probeRequests.length).toBe(5);
  assert(!(await page.evaluate(() => window.shown)).includes('REVALIDATED_SUCCESS'));
  await probeRequests[4].fulfill({ json: { label: 'AFTER_REENABLE' } });
  await expect(page.getByTestId('probe')).toHaveText('AFTER_REENABLE');
  console.log('PASS race: re-enabled observer cannot flash its previous snapshot');

  await page.evaluate(() => window.showMemory('none'));
  await expect.poll(() => page.evaluate(() => window.listeners)).toBe(0);
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log('PASS cleanup: no writes, browser errors, overflow or leaked observers');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await rm(harness, { force: true });
}
