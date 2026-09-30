/** Production Dialog with synthetic content. No Rust/runtime integration. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const evidence = '.qa/dialogs', checks = [], errors = [];
let server, browser, page, failure;
await mkdir(evidence, { recursive: true });
async function step(name, run) { await run(); checks.push(name); console.log('PASS ' + name); }
const scrollY = () => page.evaluate(() => window.scrollY);
const inlineStyles = () => page.evaluate(() => ['overflow-x', 'overflow-y', 'scrollbar-gutter'].map(name => [name, document.documentElement.style.getPropertyValue(name), document.documentElement.style.getPropertyPriority(name)]));
async function openEditor() {
  await page.getByRole('button', { name: 'Open work editor', exact: true }).click();
  await page.locator('dialog[open][aria-label="Work editor"]').waitFor();
}
async function closeEditor() {
  await page.getByRole('button', { name: 'Close editor', exact: true }).click();
  await page.locator('dialog[open]').waitFor({ state: 'detached' });
}
async function headerIsReachable(selector) {
  const geometry = await page.locator(selector).evaluate(panel => {
    const header = panel.querySelector(':scope > header'), button = header.querySelector('button');
    const p = panel.getBoundingClientRect(), h = header.getBoundingClientRect(), b = button.getBoundingClientRect();
    return { inside: h.top >= p.top - 1 && h.bottom <= p.bottom + 1,
      width: b.width, height: b.height,
      hit: button.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)),
      overflow: panel.scrollWidth > panel.clientWidth + 1 };
  });
  assert(geometry.inside, 'header must stay inside the panel');
  assert(geometry.hit, 'close button must not be covered by scrolling content');
  assert(geometry.width >= 44 && geometry.height >= 44, 'close target must be at least 44px');
  assert(!geometry.overflow, 'panel must not overflow horizontally');
}
try {
  let url = process.env.DIALOG_FIXTURE_URL;
  if (!url) {
    const { createServer } = await import('vite');
    server = await createServer({ server: { host: '127.0.0.1', port: 0 }, clearScreen: false });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}/tests/dialog-fixture.html`;
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.getByRole('button', { name: 'Open work editor', exact: true }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 480));
  const before = await scrollY(), initialStyles = await inlineStyles();
  assert(before > 0, 'fixture must start on a scrolled page');
  const widthBefore = await page.evaluate(() => document.documentElement.clientWidth);

  await step('Opening a dialog preserves page position and layout width', async () => {
    await openEditor();
    assert.equal(await scrollY(), before);
    assert.equal(await page.evaluate(() => document.documentElement.clientWidth), widthBefore);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden');
    assert(await page.evaluate(() => document.querySelector('dialog[open]').contains(document.activeElement)));
    await page.screenshot({ path: evidence + '/desktop.png' });
  });
  await step('Backdrop wheel input cannot move the workspace', async () => {
    await page.mouse.move(4, 4); await page.mouse.wheel(0, 700);
    await page.waitForTimeout(200);
    assert.equal(await scrollY(), before);
  });
  await step('Long forms scroll while their header and close button stay reachable', async () => {
    const box = await page.locator('.create-panel').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * .75);
    await page.mouse.wheel(0, 800);
    await page.waitForFunction(() => document.querySelector('.create-panel').scrollTop > 0);
    await headerIsReachable('.create-panel');
    assert.equal(await scrollY(), before);
    await page.screenshot({ path: evidence + '/desktop-scrolled.png' });
  });
  await step('Keyboard navigation cannot focus background controls', async () => {
    await page.getByRole('button', { name: 'Close editor', exact: true }).focus();
    for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      assert(await page.evaluate(() => document.querySelector('dialog[open]').contains(document.activeElement)));
    }
    await page.evaluate(() => document.querySelector('main > div:last-of-type button')?.focus());
    assert(await page.evaluate(() => document.querySelector('dialog[open]').contains(document.activeElement)));
  });
  await step('Nested preview Escape restores parent focus without releasing the page lock', async () => {
    await page.getByRole('button', { name: 'Preview evidence', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 2);
    await page.locator('.viewer').evaluate(panel => { panel.scrollTop = panel.scrollHeight; });
    await headerIsReachable('.viewer');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 1);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Preview evidence');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden');
    assert.equal(await scrollY(), before);
  });
  await step('Closing the final modal restores focus, page position and inline styles', async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 0);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Open work editor');
    assert.equal(await scrollY(), before);
    assert.deepEqual(await inlineStyles(), initialStyles);
    await page.mouse.move(100, 200); await page.mouse.wheel(0, 300);
    await page.waitForFunction(y => window.scrollY > y, before);
  });

  for (const [name, width, height] of [['mobile', 390, 844], ['narrow', 320, 568], ['landscape', 740, 360]]) {
    await step(`${name}: no horizontal overflow and a reachable close control after scrolling`, async () => {
      await page.setViewportSize({ width, height });
      await openEditor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await headerIsReachable('.create-panel');
      await page.screenshot({ path: `${evidence}/${name}.png` });
      await page.locator('.create-panel').evaluate(panel => { panel.scrollTop = panel.scrollHeight; });
      await headerIsReachable('.create-panel');
      await closeEditor();
    });
  }
  await step('Drawers keep independent scrolling and restore the page lock', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Open activity drawer', exact: true }).click();
    await page.locator('dialog[open][aria-label="Activity drawer"]').waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden');
    await page.locator('.drawer-body').evaluate(body => { body.scrollTop = body.scrollHeight; });
    assert(await page.locator('.drawer-body').evaluate(body => body.scrollTop > 0));
    await page.getByRole('button', { name: 'Close activity', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 0);
    assert.deepEqual(await inlineStyles(), initialStyles);
  });
  await step('Existing inline axis values and priorities survive a modal lifecycle', async () => {
    await page.evaluate(() => {
      const style = document.documentElement.style;
      style.setProperty('overflow-x', 'clip', 'important');
      style.setProperty('overflow-y', 'scroll');
      style.setProperty('scrollbar-gutter', 'auto', 'important');
    });
    const saved = await inlineStyles();
    await openEditor(); await closeEditor();
    assert.deepEqual(await inlineStyles(), saved);
  });
  await step('Unmounting nested dialogs releases every scroll lock', async () => {
    const saved = await inlineStyles();
    await openEditor();
    await page.getByRole('button', { name: 'Preview evidence', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 2);
    await page.evaluate(() => window.unmountDialogFixture());
    await page.waitForFunction(() => document.querySelectorAll('dialog').length === 0);
    assert.deepEqual(await inlineStyles(), saved);
  });
  assert.deepEqual(errors, []);
} catch (error) {
  failure = error.stack || String(error);
  if (page) await page.screenshot({ path: evidence + '/failure.png' }).catch(() => {});
  throw error;
} finally {
  await writeFile(evidence + '/checks.json', JSON.stringify({ scope: 'production_dialog_synthetic_content_not_rust_integration', checks, errors, failure }, null, 2));
  await browser?.close(); await server?.close();
}
