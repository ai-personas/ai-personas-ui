/** Production ESM components with synthetic blobs; no Rust integration claims. */
import { chromium, expect } from '@playwright/test';
import { build, preview } from 'vite';
import preact from '@preact/preset-vite';
import { ZipWriter, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const temporary = await mkdtemp(join(tmpdir(), 'personas-engineering-')), outDir = join(temporary, 'dist');
const evidence = resolve(process.env.PERSONAS_BROWSER_EVIDENCE || '.qa/engineering-previews'); await mkdir(evidence, { recursive: true });
const board = '(kicad_pcb (version 20240108) (segment (start 0 0) (end 10 5) (width 0.25) (layer "F.Cu")) (gr_rect (start -2 -2) (end 15 10) (layer "Edge.Cuts")) (via (at 10 5) (size 1) (drill 0.5)))';
const dxf = '0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nOutline\n10\n0\n20\n0\n11\n10\n21\n5\n0\nENDSEC\n0\nEOF\n';
let server, browser, page, checks = 0; const errors = [], requests = [];
async function step(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
async function upload(name, data) { await page.getByLabel('Fixture file').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(data) }); }
async function clear() { await page.getByRole('button', { name: 'Clear preview', exact: true }).click(); await expect(page.locator('.file-preview')).toHaveCount(0); await expect.poll(() => page.evaluate(() => window.engineeringProbe.workers.size)).toBe(0); }
try {
  await build({ configFile: false, plugins: [preact()], logLevel: 'warn', build: { outDir, emptyOutDir: true, rollupOptions: { input: resolve('tests/fixtures/file-previews.html') } } });
  server = await preview({ configFile: false, build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    const probe = window.engineeringProbe = { workers: new Set(), strokes: 0 };
    const NativeWorker = Worker, stroke = CanvasRenderingContext2D.prototype.stroke;
    window.Worker = class extends NativeWorker { constructor(...args) { super(...args); probe.workers.add(this); } terminate() { probe.workers.delete(this); super.terminate(); } };
    CanvasRenderingContext2D.prototype.stroke = function (...args) { probe.strokes++; return stroke.apply(this, args); };
  });
  page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url()));
  const base = server.resolvedUrls.local[0]; await page.goto(base + 'tests/fixtures/file-previews.html');
  await step('engineering chunks are lazy-loaded', async () => { await expect(page.getByRole('heading', { name: 'Production file preview fixture' })).toBeVisible(); assert(!requests.some(url => /EngineeringPreview-|engineering.worker-/.test(url))); });
  await step('KiCad PCB renders layers and releases the worker', async () => { await upload('board.kicad_pcb', board); await expect(page.locator('.engineering-caption')).toContainText('4 paths'); await expect(page.getByLabel('F.Cu', { exact: true })).toBeChecked(); await expect.poll(() => page.evaluate(() => window.engineeringProbe.workers.size)).toBe(0); await expect.poll(() => page.evaluate(() => window.engineeringProbe.strokes)).toBeGreaterThan(0); await page.screenshot({ path: join(evidence, 'pcb.png') }); });
  await step('keyboard zoom, layer filtering and reset work', async () => {
    await page.locator('canvas').focus(); await page.locator('canvas').press('+'); await expect(page.getByLabel('Drawing zoom')).toHaveText('120%');
    await page.getByLabel('F.Cu', { exact: true }).uncheck(); await expect(page.getByLabel('F.Cu', { exact: true })).not.toBeChecked();
    await page.getByRole('button', { name: 'Reset drawing', exact: true }).click(); await expect(page.getByLabel('Drawing zoom')).toHaveText('100%'); await expect(page.getByLabel('F.Cu', { exact: true })).toBeChecked();
  });
  await step('source switching unmounts the drawing and remains reversible', async () => { await page.getByRole('button', { name: 'Show source', exact: true }).click(); await expect(page.locator('.file-source')).toContainText('kicad_pcb'); await expect(page.locator('canvas')).toHaveCount(0); await page.getByRole('button', { name: 'Show drawing', exact: true }).click(); await expect(page.locator('canvas')).toBeVisible(); await clear(); });
  await step('G-code projections and unsupported mode errors are explicit', async () => { await upload('part.gcode', 'G21 G90\nG0 X1\nG3 X0 Y1 Z2 I-1 J0'); await expect(page.locator('.engineering-caption')).toContainText('2 paths'); await page.getByLabel('Toolpath projection').selectOption('XZ'); await expect(page.locator('.engineering-caption')).toContainText('XZ projection'); await upload('unsafe.nc', 'G0 X1\nG92 X2'); await expect(page.getByRole('alert')).toContainText('Unsupported G92'); await page.getByRole('button', { name: 'Show source', exact: true }).click(); await expect(page.locator('.file-source')).toContainText('G92 X2'); await clear(); });
  await step('DXF works on mobile without horizontal overflow', async () => { await page.setViewportSize({ width: 390, height: 844 }); await upload('outline.DXF', dxf); await expect(page.locator('.engineering-caption')).toContainText('1 paths'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: join(evidence, 'dxf-mobile.png') }); await clear(); await page.setViewportSize({ width: 1280, height: 900 }); });
  await step('schematic limitations are visible rather than pretending full symbols', async () => { await upload('circuit.kicad_sch', '(kicad_sch (wire (pts (xy 0 0) (xy 10 0))) (symbol (at 10 5)))'); await expect(page.getByLabel('Preview limitations')).toContainText('Symbol graphics'); await expect(page.getByLabel('Symbol anchors (not outlines)', { exact: true })).toBeChecked(); await clear(); });
  await step('archive entries reuse the engineering router', async () => { const writer = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false }); await writer.add('board.kicad_pcb', new Uint8ArrayReader(Buffer.from(board))); await upload('project.zip', Buffer.from(await writer.close())); await page.getByRole('button', { name: 'Open file board.kicad_pcb', exact: true }).click(); await expect(page.locator('.engineering-caption')).toContainText('4 paths'); await clear(); });
  await step('layer text stays literal and never requests external content', async () => { await upload('literal.dxf', dxf.replace('Outline', '<img src=https://invalid.example/x onerror=alert(1)>')); await expect(page.locator('.engineering-layers')).toContainText('<img'); await expect(page.locator('.engineering-layers img')).toHaveCount(0); assert(!requests.some(url => url.includes('invalid.example'))); await clear(); });
  await step('oversize and malformed files fail without worker leaks', async () => { await upload('large.dxf', Buffer.alloc(4 * 1024 * 1024 + 1)); await expect(page.getByRole('alert')).toContainText('4 MiB'); await clear(); await upload('broken.kicad_pcb', '(kicad_pcb'); await expect(page.getByRole('alert')).toContainText('Truncated'); await clear(); });
  await step('rapid file switches and Blender export guidance preserve existing previews', async () => { await upload('board.kicad_pcb', board); await upload('values.csv', 'a,b\n1,2'); await expect(page.locator('table')).toBeVisible(); await expect(page.locator('canvas')).toHaveCount(0); await clear(); await upload('scene.blend', 'BLENDER'); await expect(page.locator('.notice')).toContainText('GLB'); await clear(); });
  await step('Canvas-unavailable browsers get source fallback', async () => {
    const disabled = await context.newPage(); await disabled.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return kind === '2d' ? null : get.call(this, kind, ...args); }; });
    await disabled.goto(base + 'tests/fixtures/file-previews.html'); await disabled.getByLabel('Fixture file').setInputFiles({ name: 'outline.dxf', mimeType: 'application/octet-stream', buffer: Buffer.from(dxf) }); await expect(disabled.getByRole('alert')).toContainText('Canvas 2D is unavailable'); await disabled.getByRole('button', { name: 'Show source', exact: true }).click(); await expect(disabled.locator('.file-source')).toContainText('ENTITIES'); await disabled.close();
  });
  assert.deepEqual(errors, []); await writeFile(join(evidence, 'result.json'), JSON.stringify({ checks, errors, validation: 'Production ESM component fixture, not Rust integration.' }, null, 2));
} finally { await browser?.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve)); await rm(temporary, { recursive: true, force: true }); }
