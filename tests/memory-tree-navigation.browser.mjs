// Actual production component with synthetic display data; no Rust integration.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const port = 5208, origin = `http://127.0.0.1:${port}`;
const card = (n, title) => ({
  node: { id: n.toString(16).padStart(32, '0'), revision: 1 },
  fragment: { id: (n + 100).toString(16).padStart(32, '0'), revision: 1 },
  title, short_description: 'Compare representations before drawing conclusions. Keep the source, the transformation, and the result together so another reader can follow the reasoning.',
  applicability: '', limitations: '', full_context: { status: 'available', fragments: 1 },
});
const a = card(1, 'Field notes'), b = card(2, 'Review release');
const c = card(3, 'Check representations'), d = card(4, 'Compare exports across packaging targets and supported environments');
const e = card(5, 'Shared method');
const edge = (source, target) => ({ source: source.node, target: target.node, origin: 'authored_related', mode: 'preview_only', applicability: 'not_evaluated' });
const graph = { items: [a, b, c, d, e], connections: [edge(b, c), edge(b, d), edge(c, e), edge(d, e), edge(e, b)], focus_card: null, next: null };
await mkdir('.qa', { recursive: true });
const harness = '.qa/memory-tree-navigation-harness.tsx';
await writeFile(harness, `
import { render } from 'preact';
import { useState } from 'preact/hooks';
import MemoryTree from '../src/MemoryTree';
import type { MemoryGraph } from '../src/memoryGraph';
import '../src/style.css'; import '../src/workspace.css'; import '../src/design-system.css'; import '../src/reading.css';
const graph = ${JSON.stringify(graph)} as MemoryGraph;
function App() {
  const [empty, setEmpty] = useState(false);
  return <>
    <header><p class="eyebrow">PERSONA MEMORY</p><h1>Find your way through learning</h1>
      <p class="micro">Production MemoryTree component · synthetic display fixture, not runtime evidence.</p></header>
    <MemoryTree graph={empty ? { ...graph, items: [], connections: [] } : graph} renderCard={item =>
      <article class="memory-card"><p class="field-label">FRAGMENT PREVIEW</p><h4>{item.title}</h4>
        <p>{item.short_description}</p><p class="micro">Preview only. Browsing does not select context or establish usefulness.</p></article>}/>
    <button type="button" class="text-button" onClick={() => setEmpty(!empty)}>Toggle empty fixture</button>
  </>;
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
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.route('**/tree-navigation-fixture', route => route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="test" style="padding:20px;max-width:1100px;margin:auto"></main><script type="module" src="/.qa/memory-tree-navigation-harness.tsx"></script></body></html>' }));
  await page.goto(origin + '/tree-navigation-fixture');
  const tree = page.getByRole('tree', { name: 'Persona fragment tree' });
  const preview = page.getByRole('region', { name: 'Selected fragment preview' });
  const trail = page.getByRole('navigation', { name: 'Selected fragment path' });
  const row = title => tree.getByRole('treeitem', { name: `${title} · Association`, exact: true });
  const expectPreview = title => expect(preview.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(tree.getByRole('treeitem')).toHaveCount(7);
  await expect(tree.locator('[tabindex="0"]')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('5 fragments');
  await expect(page.getByRole('status')).toContainText('7 of 7 entries shown');

  await tree.getByRole('treeitem', { name: `${b.title} · Browsing anchor`, exact: true }).focus();
  await page.keyboard.press('ArrowRight'); await expectPreview(c.title);
  await page.keyboard.press('c'); await expectPreview(d.title);
  await page.keyboard.press('c'); await expectPreview(c.title);
  await page.keyboard.press('c'); await expectPreview(d.title);
  await page.keyboard.press('Home');
  await page.keyboard.press('c'); await expectPreview(c.title);
  await page.keyboard.press('o'); await expectPreview(d.title);

  await row(e.title).click();
  await expect(trail.locator('[aria-current="location"]')).toHaveText(e.title);
  await expect(trail.getByRole('button')).toHaveText([b.title, c.title]);
  await page.getByRole('button', { name: 'Collapse all', exact: true }).click();
  await expect(tree.getByRole('treeitem')).toHaveCount(2);
  await expectPreview(b.title);
  await expect(tree.locator('[tabindex="0"]')).toHaveCount(1);
  await expect(tree.locator('[aria-selected="true"]')).toHaveAttribute('aria-label', `${b.title} · Browsing anchor`);
  await expect(page.getByRole('status')).toContainText('2 of 7 entries shown');
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  await expectPreview(e.title);
  await expect(tree.getByRole('treeitem')).toHaveCount(7);
  await trail.getByRole('button', { name: c.title, exact: true }).click();
  await expect(row(c.title)).toBeFocused();
  await expectPreview(c.title);
  await row(e.title).click();
  await page.screenshot({ path: '.qa/memory-tree-navigation-desktop.png', fullPage: true });

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}px`);
    await expect(trail.locator('[aria-current="location"]')).toBeVisible();
    if (width === 390) await page.screenshot({ path: '.qa/memory-tree-navigation-mobile.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'Toggle empty fixture', exact: true }).click();
  await expect(tree).toHaveCount(0);
  await expect(trail).toHaveCount(0);
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('Memory tree navigation passed: repeated-letter cycling, prefix matching, branch-preserving collapse, restored selection, breadcrumb focus, live counts, empty state, and 390/320px overflow checks. Synthetic component fixture only.');
} finally {
  await browser?.close(); server.kill('SIGTERM'); await rm(harness, { force: true });
}
