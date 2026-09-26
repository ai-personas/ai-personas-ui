// Synthetic responses exercise actual production hooks across different readers.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const port = 5207, origin = `http://127.0.0.1:${port}`;
const harness = '.qa/resource-sharing-harness.tsx';
await mkdir('.qa', { recursive: true });
await writeFile(harness, `
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { useResource } from '../src/hooks';
import { changes } from '../src/api';
const w = window as any;
w.shown = []; w.listeners = 0;
const add = changes.addEventListener.bind(changes), remove = changes.removeEventListener.bind(changes);
changes.addEventListener = (...a) => { w.listeners++; return add(...a); };
changes.removeEventListener = (...a) => { w.listeners--; return remove(...a); };
w.invalidate = () => changes.dispatchEvent(new CustomEvent('change', {detail:{kind:'information_policy'}}));
function Probe({id, enabled}: {id:string; enabled:boolean}) {
  const state = useResource<{label:string}>('/resource-sharing-probe', () => true, enabled);
  const visible = enabled && !state.loading ? state.error || state.value?.label || '' : '';
  if (visible) w.shown.push({id, value:visible});
  return <p data-testid={id}>{visible || (enabled ? 'Revalidating' : 'Disabled')}</p>;
}
function App() {
  const [readers, setReaders] = useState<string[]>([]), [enabled, setEnabled] = useState(true);
  w.setReaders = setReaders; w.enableToggle = setEnabled;
  return <main>{readers.map(id => <Probe key={id} id={id} enabled={id !== 'toggle' || enabled}/>)}</main>;
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
  const errors = [], writes = [], held = [];
  let replyFresh = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); });
  await page.route('**/resource-sharing-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="test"></div><script type="module" src="/.qa/resource-sharing-harness.tsx"></script></body></html>' }));
  await page.route('**/api/resource-sharing-probe', route => {
    if (replyFresh) return route.fulfill({ json: { label: 'CURRENT' } });
    held.push(route);
  });
  await page.goto(origin + '/resource-sharing-fixture');
  await page.waitForFunction(() => typeof window.setReaders === 'function');
  await page.evaluate(() => window.setReaders(['early', 'peer']));
  await expect.poll(() => page.evaluate(() => window.listeners)).toBe(2);
  await expect.poll(() => held.length).toBe(1);
  await page.evaluate(() => window.setReaders(['early']));
  await expect.poll(() => page.evaluate(() => window.listeners)).toBe(1);
  await expect(page.getByTestId('early')).toHaveText('Revalidating');
  console.log('PASS sharing: simultaneous readers share a pending request and one can leave');

  await page.evaluate(() => { window.invalidate(); window.setReaders(['early', 'late']); });
  await expect.poll(() => held.length).toBe(2);
  replyFresh = true;
  await held[0].fulfill({ json: { label: 'REVOKED_OLD_RESPONSE' } });
  await held[1].fulfill({ json: { label: 'CURRENT' } });
  await expect(page.getByTestId('early')).toHaveText('CURRENT');
  await expect(page.getByTestId('late')).toHaveText('CURRENT');
  assert(!(await page.evaluate(() => window.shown)).some(item => item.value === 'REVOKED_OLD_RESPONSE'));
  console.log('PASS freshness: a reader mounted after invalidation never receives the older shared response');

  await page.evaluate(() => window.setReaders([]));
  await expect.poll(() => page.evaluate(() => window.listeners)).toBe(0);
  replyFresh = false;
  await page.evaluate(() => window.setReaders(['early', 'toggle']));
  await expect.poll(() => page.evaluate(() => window.listeners)).toBe(2);
  await expect.poll(() => held.length).toBe(3);
  await page.evaluate(() => window.enableToggle(false));
  await expect(page.getByTestId('toggle')).toHaveText('Disabled');
  await expect.poll(() => page.evaluate(() => window.listeners)).toBe(1);
  await page.evaluate(() => { window.invalidate(); window.enableToggle(true); });
  await expect.poll(() => held.length).toBe(4);
  replyFresh = true;
  await held[2].fulfill({ json: { label: 'REVOKED_BEFORE_REENABLE' } });
  await held[3].fulfill({ json: { label: 'CURRENT' } });
  await expect(page.getByTestId('early')).toHaveText('CURRENT');
  await expect(page.getByTestId('toggle')).toHaveText('CURRENT');
  assert(!(await page.evaluate(() => window.shown)).some(item => item.value.startsWith('REVOKED_')));
  console.log('PASS freshness: re-enabling one reader cannot reuse another reader\'s invalidated request');

  await page.evaluate(() => window.setReaders([]));
  await expect.poll(() => page.evaluate(() => window.listeners)).toBe(0);
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log('PASS cleanup: all observers released; no writes, errors, or mobile overflow');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await rm(harness, { force: true });
}
