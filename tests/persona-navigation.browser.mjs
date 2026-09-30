// Production components and synthetic wire fixtures; not a Rust integration test.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { owner, first, second, later, card, edge, page as graphPage } from './memory-graph.fixture.mjs';

const port = 5207, origin = `http://127.0.0.1:${port}`;
const ada = owner, bea = '9'.repeat(32), work = '8'.repeat(32);
const a = card(first, 'Check representations'), b = card(second, 'Compare exports');
const c = card(later, 'Review constraints'), d = card('f'.repeat(32), 'Shared method');
const connections = [edge(a, b), edge(a, c), edge(b, d), edge(c, d), edge(d, a)];
let denyGraph = false, denyBea = false;
await mkdir('.qa', { recursive: true });
const harness = '.qa/persona-navigation-harness.tsx';
await writeFile(harness, `
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { changes, connect } from '../src/api';
import RecentPersonas, { useRecentPersonas } from '../src/RecentPersonas';
import '../src/style.css'; import '../src/workspace.css'; import '../src/design-system.css'; import '../src/reading.css';
const Graph = lazy(() => import('../src/MemoryGraph'));
(window as any).listeners = 0;
(window as any).invalidateNavigation = () => changes.dispatchEvent(new CustomEvent('change', { detail: { kind: 'information_policy' } }));
const add = changes.addEventListener.bind(changes), remove = changes.removeEventListener.bind(changes);
changes.addEventListener = (...args) => { (window as any).listeners++; return add(...args); };
changes.removeEventListener = (...args) => { (window as any).listeners--; return remove(...args); };
function App() {
  const [selected, select] = useState<string>(), [connected, setConnected] = useState(true);
  const [show, setShow] = useState(true), [collection, setCollection] = useState(true);
  const recent = useRecentPersonas(selected, connected);
  return <><nav aria-label="Fixture controls" style="display:flex;gap:8px;flex-wrap:wrap">
    <button onClick={() => select('${ada}')}>Open Ada fixture</button>
    <button onClick={() => select('${bea}')}>Open Bea fixture</button>
    <button onClick={() => select('${work}')}>Open work fixture</button>
    <button onClick={() => select(undefined)}>Close record fixture</button>
    <button onClick={() => setCollection(!collection)}>Toggle collection fixture</button>
    <button onClick={() => { connect(''); select(undefined); setConnected(!connected); }}>{connected ? 'Disconnect fixture' : 'Connect fixture'}</button>
    <button onClick={() => { select(undefined); setShow(false); }}>Close fixture</button>
  </nav>{connected && show && <><h1>Personas &amp; fragments</h1>
    {collection && <RecentPersonas ids={recent.ids} clear={recent.clear} open={select}/>}
    <Suspense fallback={<p>Loading graph…</p>}><Graph owner="${owner}" open={select}/></Suspense>
  </>}</>;
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
  assert(ready, 'Vite did not start');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request));
  await page.route('**/navigation-fixture', route => route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="test" style="padding:20px;max-width:1100px;margin:auto"></main><script type="module" src="/.qa/persona-navigation-harness.tsx"></script></body></html>' }));
  await page.route('**/api/records/*', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    if (id === bea && denyBea) return route.fulfill({ status: 403, json: { error: 'Access revoked' } });
    if (![ada, bea, work].includes(id)) return route.fulfill({ status: 404, json: { error: 'Not in fixture' } });
    return route.fulfill({ json: { id, kind: id === work ? 'work' : 'persona', scope: '', revision: 1, data: { name: id === ada ? 'Ada' : id === bea ? 'Bea' : 'A work item', lifecycle: 'active' } } });
  });
  await page.route('**/api/personas/*/memory?*', route => {
    if (denyGraph) return route.fulfill({ status: 403, json: { error: 'Graph access revoked' } });
    const params = new URL(route.request().url()).searchParams;
    const query = params.get('query'), focus = params.get('focus');
    if (query) return route.fulfill({ json: graphPage({ query, items: query === 'missing' ? [] : [d] }) });
    if (params.get('after') === '12') return route.fulfill({ json: graphPage({ after: 12, items: [card('1'.repeat(32), 'Later fragment')] }) });
    const focused = [a, b, c, d].find(item => item.node.id === focus) || null;
    return route.fulfill({ json: graphPage({ focus: focused, items: [a, b, c, d].filter(item => item !== focused), connections, next: 12 }) });
  });
  await page.goto(origin + '/navigation-fixture');
  const tree = page.getByRole('tree', { name: 'Persona fragment tree' });
  const preview = page.getByRole('region', { name: 'Selected fragment preview' });
  const recents = page.getByRole('region', { name: 'Recent personas', exact: true });
  await expect(tree.getByRole('treeitem')).toHaveCount(6);
  await expect(tree.locator('[tabindex="0"]')).toHaveCount(1);
  await expect(preview.getByRole('heading', { name: a.title })).toBeVisible();
  assert(!requests.some(request => request.url().includes('MemoryFragment.tsx')));
  assert(!requests.some(request => request.method() !== 'GET'));

  const root = tree.getByRole('treeitem', { name: `${a.title} · Browsing anchor`, exact: true });
  await root.focus(); await page.keyboard.press('ArrowLeft');
  await expect(tree.getByRole('treeitem')).toHaveCount(1);
  await expect(root).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowRight');
  await expect(tree.getByRole('treeitem')).toHaveCount(6);
  await page.keyboard.press('ArrowRight');
  await expect(preview.getByRole('heading', { name: b.title })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(preview.getByRole('heading', { name: d.title })).toBeVisible();
  await page.keyboard.press('Home'); await expect(root).toBeFocused();
  await page.keyboard.press('End');
  await expect(tree.getByRole('treeitem', { name: /Also linked/ })).toBeFocused();
  await page.keyboard.press('r');
  await expect(preview.getByRole('heading', { name: c.title })).toBeVisible();
  await tree.getByRole('treeitem', { name: /Cycle link/ }).click();
  await expect(preview).toContainText('returns to a fragment already in this branch');
  await tree.getByRole('treeitem', { name: /Also linked/ }).click();
  await expect(preview).toContainText('also appears in another branch');
  await page.getByRole('button', { name: 'Collapse all', exact: true }).click();
  await expect(tree.getByRole('treeitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  await expect(tree.getByRole('treeitem')).toHaveCount(6);
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await expect(tree).toHaveCount(0);
  for (const item of [a, b, c, d]) await expect(page.getByRole('heading', { name: item.title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(tree).toBeVisible();

  await page.getByRole('button', { name: 'Open Ada fixture', exact: true }).click();
  await expect(recents.getByRole('button', { name: 'Reopen Ada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Bea fixture', exact: true }).click();
  await expect(recents.locator('.recent-persona-copy strong')).toHaveText(['Bea', 'Ada']);
  await page.getByRole('button', { name: 'Open work fixture', exact: true }).click();
  await expect(recents.locator('.recent-persona-copy strong')).toHaveText(['Bea', 'Ada']);
  await recents.getByRole('button', { name: 'Reopen Ada', exact: true }).click();
  await expect(recents.locator('.recent-persona-copy strong')).toHaveText(['Ada', 'Bea']);
  await page.getByRole('button', { name: 'Close record fixture', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle collection fixture', exact: true }).click();
  await expect(recents).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle collection fixture', exact: true }).click();
  await expect(recents.locator('.recent-persona-copy strong')).toHaveText(['Ada', 'Bea']);
  await page.screenshot({ path: '.qa/persona-navigation-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 900 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('.memory-tree-layout').screenshot({ path: '.qa/fragment-tree-mobile.png' });
  await recents.screenshot({ path: '.qa/recent-personas-mobile.png' });

  await page.getByLabel('Find learning', { exact: true }).fill('missing');
  await page.getByRole('button', { name: 'Search learning', exact: true }).click();
  await expect(tree).toHaveCount(0);
  await expect(page.getByText('No matching titles or descriptions on this page.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(tree).toBeVisible();
  await page.getByRole('button', { name: 'Explore connections', exact: true }).click();
  await expect(page.locator('.memory-focus [aria-current="location"]')).toHaveText(a.title);
  await expect(tree.getByRole('treeitem')).toHaveCount(6);
  await page.getByRole('button', { name: 'All learning', exact: true }).click();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(preview.getByRole('heading', { name: 'Later fragment', exact: true })).toBeVisible();
  await expect(tree.getByRole('treeitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(tree.getByRole('treeitem')).toHaveCount(6);

  denyGraph = true; denyBea = true;
  await page.evaluate(() => window.invalidateNavigation());
  await expect(tree).toHaveCount(0);
  await expect(recents.getByRole('button', { name: 'Reopen Bea', exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Could not load this graph');
  await expect(recents).toContainText('Persona unavailable');
  denyGraph = false; denyBea = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await recents.getByRole('button', { name: 'Retry shortcut', exact: true }).click();
  await expect(tree).toBeVisible();
  await expect(recents.getByRole('button', { name: 'Reopen Bea', exact: true })).toBeVisible();
  await recents.getByRole('button', { name: 'Clear recent personas', exact: true }).click();
  await expect(recents.getByRole('list')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Ada fixture', exact: true }).click();
  await expect(recents.getByRole('button', { name: 'Reopen Ada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect fixture', exact: true }).click();
  await expect(recents).toHaveCount(0);
  await page.getByRole('button', { name: 'Connect fixture', exact: true }).click();
  await expect(recents.getByRole('list')).toHaveCount(0);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.getByRole('button', { name: 'Close fixture', exact: true }).click();
  await expect(tree).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.listeners)).toBe(0);
  assert.deepEqual(errors, []);
  console.log('Persona navigation fixture passed: tree keyboard controls, cycles/shared links, card fallback, search/pagination/focus, lazy reads, recent ordering/clear/disconnect, permission revocation, mobile overflow and observer cleanup.');
} finally {
  await browser?.close(); server.kill('SIGTERM'); await rm(harness, { force: true });
}
