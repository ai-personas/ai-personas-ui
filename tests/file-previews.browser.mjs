/** Production ESM component build with synthetic blobs. No Rust/runtime claims. */
import { chromium, expect } from '@playwright/test';
import { build, preview } from 'vite';
import preact from '@preact/preset-vite';
import { ZipWriter, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const temporary = await mkdtemp(join(tmpdir(), 'personas-previews-')), outDir = join(temporary, 'dist');
const evidence = resolve(process.env.PERSONAS_BROWSER_EVIDENCE || '.qa/file-previews'); await mkdir(evidence, { recursive: true });
let server, browser, page, checks = 0; const errors = [], requests = [];
const obj = 'v 0 0 0\nv 2 0 0\nv 0 2 0\nv 0 0 2\nf 1 3 2\nf 1 2 4\nf 2 3 4\nf 3 1 4';
async function step(name, check) { await check(); checks++; console.log('PASS ' + name); }
async function upload(name, text, mimeType = 'application/octet-stream') { await page.getByLabel('Fixture file').setInputFiles({ name, mimeType, buffer: Buffer.from(text) }); }
async function clear() { await page.getByRole('button', { name: 'Clear preview', exact: true }).click(); await expect(page.locator('.file-preview')).toHaveCount(0); await expect.poll(() => page.evaluate(() => [window.previewProbe.workers.size, window.previewProbe.buffers.size, window.previewProbe.urls.size])).toEqual([0, 0, 0]); }
function gltf() { const b = Buffer.alloc(36); [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) => b.writeFloatLE(n, i * 4)); return { asset: { version: '2.0' }, buffers: [{ byteLength: 36, uri: 'data:application/octet-stream;base64,' + b.toString('base64') }], bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }] }; }
try {
  await build({ configFile: false, plugins: [preact()], logLevel: 'warn', build: { outDir, emptyOutDir: true, rollupOptions: { input: resolve('tests/fixtures/file-previews.html') } } });
  server = await preview({ configFile: false, build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    const probe = window.previewProbe = { workers: new Set(), buffers: new Set(), urls: new Set(), draws: 0 };
    const NativeWorker = Worker, createURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
    window.Worker = class extends NativeWorker { constructor(...args) { super(...args); probe.workers.add(this); } terminate() { probe.workers.delete(this); super.terminate(); } };
    URL.createObjectURL = blob => { const url = createURL(blob); probe.urls.add(url); return url; };
    URL.revokeObjectURL = url => { probe.urls.delete(url); revokeURL(url); };
    const create = WebGLRenderingContext.prototype.createBuffer, remove = WebGLRenderingContext.prototype.deleteBuffer, draw = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.createBuffer = function (...args) { const value = create.apply(this, args); if (value) probe.buffers.add(value); return value; };
    WebGLRenderingContext.prototype.deleteBuffer = function (value) { probe.buffers.delete(value); return remove.call(this, value); };
    WebGLRenderingContext.prototype.drawArrays = function (...args) { probe.draws++; return draw.apply(this, args); };
  });
  page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url()));
  const base = server.resolvedUrls.local[0]; await page.goto(base + 'tests/fixtures/file-previews.html');
  await step('initial fixture does not load model or table renderer chunks', async () => { await expect(page.getByRole('heading', { name: 'Production file preview fixture' })).toBeVisible(); assert(!requests.some(url => /ModelPreview-|TablePreview-|model.worker-/.test(url))); });
  await step('OBJ loads geometry into WebGL and releases its parsing worker', async () => { await upload('tetra.OBJ', obj); await expect(page.locator('.model-caption')).toContainText('4 triangles'); await expect(page.locator('canvas')).toBeVisible(); await expect.poll(() => page.evaluate(() => window.previewProbe.draws)).toBeGreaterThan(0); await expect.poll(() => page.evaluate(() => window.previewProbe.workers.size)).toBe(0); await page.screenshot({ path: join(evidence, 'model-desktop.png') }); });
  await step('keyboard, wireframe, reset and pointer controls work', async () => {
    const canvas = page.locator('canvas'); await canvas.focus(); await canvas.press('+'); await expect(page.getByLabel('Model zoom')).toHaveText('120%');
    await canvas.press('w'); await expect(page.getByLabel('Wireframe')).toBeChecked(); await canvas.press('Home'); await expect(page.getByLabel('Wireframe')).not.toBeChecked(); await expect(page.getByLabel('Model zoom')).toHaveText('100%');
    const before = await page.evaluate(() => window.previewProbe.draws), box = await canvas.boundingBox(); await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.down(); await page.mouse.move(box.x + 180, box.y + 150); await page.mouse.up(); await expect.poll(() => page.evaluate(() => window.previewProbe.draws)).toBeGreaterThan(before);
  });
  await step('mobile layout and cleanup preserve a usable viewport', async () => { await page.setViewportSize({ width: 390, height: 844 }); await expect(page.locator('canvas')).toBeVisible(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: join(evidence, 'model-mobile.png') }); await clear(); await page.setViewportSize({ width: 1280, height: 900 }); });
  await step('malformed models show an error and leave no worker running', async () => { await upload('broken.stl', 'solid broken'); await expect(page.getByRole('alert')).toContainText('Truncated'); await clear(); });
  await step('embedded glTF renders and external buffers are refused', async () => { await upload('triangle.gltf', JSON.stringify(gltf())); await expect(page.locator('.model-caption')).toContainText('1 triangles'); await clear(); const d = gltf(); d.buffers[0].uri = 'https://invalid.example/model.bin'; await upload('external.gltf', JSON.stringify(d)); await expect(page.getByRole('alert')).toContainText('External glTF buffers'); assert(!requests.some(url => url.includes('invalid.example'))); await clear(); });
  await step('CSV shows literal, accessible cells and a source toggle', async () => { await upload('values.csv', 'Name,Value\n"A, B","<script>window.csvExecuted=true</script>"\nFormula,=1+1', 'text/csv; charset=utf-8'); await expect(page.getByRole('cell', { name: 'A, B', exact: true })).toBeVisible(); await expect(page.getByRole('cell', { name: '=1+1', exact: true })).toBeVisible(); assert.equal(await page.evaluate(() => window.csvExecuted), undefined); await page.getByRole('button', { name: 'Show source', exact: true }).click(); await expect(page.locator('.file-source')).toContainText('Formula,=1+1'); await clear(); });
  await step('TSV and malformed CSV preserve source access', async () => { await upload('values.tsv', 'a\tb\n1\t2'); await expect(page.getByRole('cell', { name: '2', exact: true })).toBeVisible(); await clear(); await upload('broken.csv', '"unfinished'); await expect(page.getByRole('alert')).toContainText('Unclosed'); await page.getByRole('button', { name: 'Show source' }).click(); await expect(page.locator('.file-source')).toHaveText('"unfinished'); await clear(); });
  await step('nested archive models reuse the same production renderer', async () => { const writer = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false }); await writer.add('tetra.obj', new Uint8ArrayReader(Buffer.from(obj))); await upload('models.zip', Buffer.from(await writer.close()), 'application/zip'); await page.getByRole('button', { name: 'Open file tetra.obj', exact: true }).click(); await expect(page.locator('.model-caption')).toContainText('4 triangles'); await clear(); });
  await step('unsupported formats remain explicit and rapid switches do not leak', async () => { await upload('model.blend', 'BLENDER'); await expect(page.locator('.notice')).toContainText('not available'); await upload('tetra.obj', obj); await upload('values.csv', 'a,b\n1,2'); await expect(page.locator('table')).toBeVisible(); await expect(page.locator('canvas')).toHaveCount(0); await clear(); });
  await step('oversized models are refused before starting a parser', async () => { await upload('large.obj', Buffer.alloc(16 * 1024 * 1024 + 1)); await expect(page.getByRole('alert')).toContainText('16 MiB'); await clear(); });
  await step('WebGL-unavailable browsers get a readable fallback', async () => { const disabled = await context.newPage(); await disabled.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return kind === 'webgl' ? null : original.call(this, kind, ...args); }; }); await disabled.goto(base + 'tests/fixtures/file-previews.html'); await disabled.getByLabel('Fixture file').setInputFiles({ name: 'tetra.obj', mimeType: 'application/octet-stream', buffer: Buffer.from(obj) }); await expect(disabled.getByRole('alert')).toContainText('WebGL is unavailable'); await disabled.close(); });
  assert.deepEqual(errors, []); await writeFile(join(evidence, 'result.json'), JSON.stringify({ checks, errors, validation: 'Production ESM component fixture only; not Rust integration.' }, null, 2));
} finally { await browser?.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve)); await rm(temporary, { recursive: true, force: true }); }
