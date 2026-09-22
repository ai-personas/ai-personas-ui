/** Production UI + disposable Rust node, with authored file fixtures and a local
 * deterministic provider. Fault injection is explicit; no live model calls. */
import { chromium, expect } from '@playwright/test';
import { ZipWriter, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const root = await mkdtemp(join(tmpdir(), 'personas-files-'));
const evidence = process.env.PERSONAS_BROWSER_EVIDENCE || join(root, 'evidence');
await mkdir(evidence, { recursive: true });
let app, browser, page, url, token = '', checks = 0, providerCalls = 0;
const errors = [], assets = [], files = new Map();
const provider = createServer(async (req, res) => {
  for await (const _ of req) { /* Drain the synthetic call. */ }
  providerCalls++;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ id: 'file-fixture', status: 'completed', model: 'file-fixture', output: [{ type: 'message', role: 'assistant', status: 'completed', phase: 'final_answer', content: [{ type: 'output_text', text: JSON.stringify({ summary: 'File viewer fixture', actions: [{ kind: 'wait', args: { reason: 'Viewer verification uses supplied files.' } }] }) }] }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }));
});
async function until(fn) { for (let i = 0; i < 200; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } throw Error('Fixture node did not start.'); }
async function get(path) { const r = await fetch(url + '/api' + path, { headers: { Authorization: 'Bearer ' + token } }); assert(r.ok); return r.json(); }
async function op(kind, args, actor = '', run = '') {
  const response = await fetch(url + '/api/operations', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), kind, args, actor, run }) });
  const result = await response.json(); assert(response.ok, JSON.stringify(result)); assert.equal(result.state, 'succeeded', JSON.stringify(result)); return result.result;
}
async function upload(name, media, input) {
  const bytes = Buffer.from(input), q = new URLSearchParams({ id: crypto.randomUUID().replaceAll('-', ''), name, media_type: media, size: String(bytes.length), digest: createHash('sha256').update(bytes).digest('hex') });
  const response = await fetch(url + '/api/uploads?' + q, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: bytes });
  const result = await response.json(); assert.equal(result.state, 'succeeded', JSON.stringify(result)); files.set(name, { ...result.result, bytes }); return result.result.id;
}
async function zip(entries) {
  const writer = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  for (const [name, body, options = {}] of entries) await writer.add(name, body === null ? undefined : new Uint8ArrayReader(Buffer.from(body)), { directory: body === null, ...options });
  return Buffer.from(await writer.close());
}
async function step(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
const dialog = () => page.getByRole('dialog', { name: 'Artifact viewer', exact: true });
async function open(name) {
  await page.getByLabel('Documents & files', { exact: true }).getByRole('article', { name, exact: true }).getByRole('button', { name: 'Open file ↗', exact: true }).click();
  await expect(dialog()).toBeVisible();
}
async function close() { await dialog().getByRole('button', { name: 'Close viewer', exact: true }).click(); await expect(dialog()).toHaveCount(0); await expect.poll(() => page.evaluate(() => [window.fileProbe.urls.size, window.fileProbe.workers.size])).toEqual([0, 0]); }
async function imageReady(name) { await expect.poll(() => dialog().getByRole('img', { name, exact: true }).evaluate(img => img.complete && img.naturalWidth)).toBeGreaterThan(0); }
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160"><style>text{font:16px sans-serif}</style><rect x="10" y="10" width="300" height="140" fill="#f4f7ee" stroke="#244e3c"/><text x="30" y="50">Four bedrooms</text><script>window.svgExecuted=true</script></svg>';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64');
const markdown = '# Four-bedroom concept\n\nA **readable** document.\n\n- Four bedrooms\n- Two bathrooms\n\n| Room | Count |\n| --- | --- |\n| Bedroom | 4 |\n\n```python\nprint("geometry")\n```\n\n[Unsafe](javascript:alert(1))\n\n<img src="x" onerror="window.markdownExecuted=true">\n';
try {
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening'); const port = reservation.address().port; await new Promise(r => reservation.close(r));
  await writeFile(join(root, 'providers.json'), JSON.stringify({ fixture: { endpoint: `http://127.0.0.1:${provider.address().port}/responses`, trust_loopback_http: true, models: [{ id: 'file-fixture', context_window_tokens: 1000000, max_output_tokens: 1024, input_tokens_per_utf8_byte_upper_bound: 1, framing_token_allowance: 1024 }] } }));
  app = spawn(process.env.PERSONAS_BIN || resolve('../ai-personas/target/debug/personas'), ['serve', '--root', join(root, 'node'), '--listen', `127.0.0.1:${port}`, '--require-token', '--unrestricted-test-mode', '--http-providers', join(root, 'providers.json'), '--ui', resolve(process.env.PERSONAS_UI_DIST || 'dist')], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; app.stdout.on('data', b => { log += b; }); app.stderr.on('data', b => { log += b; }); url = `http://127.0.0.1:${port}`;
  await until(async () => { if (app.exitCode !== null) throw Error(log); try { return (await fetch(url + '/health')).ok; } catch { return false; } });
  token = (await readFile(join(root, 'node/token'), 'utf8')).trim();
  const inner = await zip([['readme.md', '# Inner archive\n\nNested content.']]);
  const forged = Buffer.from(await zip([['expanded.txt', 'x'.repeat(300_000)]]));
  const central = forged.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); forged.writeUInt32LE(12, central + 24);
  const crcBad = Buffer.from(inner), crcCentral = crcBad.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); crcBad.writeUInt32LE((crcBad.readUInt32LE(crcCentral + 16) ^ 1) >>> 0, crcCentral + 16);
  const packageBytes = await zip([
    ['README.md', markdown], ['plans/floor-plan.svg', svg], ['plans/pixel.png', png], ['plans/empty/', null],
    ['data/geometry.json', '{"bedrooms":4,"units":"m"}'], ['scripts/verify.py', 'print("geometry")\n'],
    ['notes.txt', '# Keep this literal\n**Text is not Markdown**'], ['nested.zip', inner], ['broken-size.zip', forged], ['bad-crc.zip', crcBad],
    ['private.txt', 'Password protected fixture', { password: 'test-only', zipCrypto: true }], ['model.blend', Buffer.from([0, 1, 2, 3])],
    ...Array.from({ length: 205 }, (_, i) => [`many/file-${String(i).padStart(3, '0')}.txt`, 'Small file ' + i]),
  ]);
  const wav = Buffer.alloc(44 + 1600); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(1600, 40);
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (const object of ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>']) { offsets.push(Buffer.byteLength(pdf)); pdf += `${offsets.length - 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf); pdf += 'xref\n0 4\n0000000000 65535 f \n' + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const ids = [];
  for (const [name, media, bytes] of [
    ['plan.SVG', 'application/octet-stream', svg], ['pixel.png', 'image/png', png], ['concept.md', 'text/markdown; charset=utf-8', markdown],
    ['notes.txt', 'text/plain', '# Literal heading\n**Literal emphasis**'], ['concept.zip', 'application/zip', packageBytes],
    ['corrupt.zip', 'application/zip', 'This is not a ZIP'], ['empty.zip', 'application/zip', await zip([])],
    ['sound.wav', 'audio/wav', wav], ['drawing.pdf', 'application/pdf', pdf], ['large.md', 'text/markdown', '# Long document\n\n' + 'Fixture paragraph.\n\n'.repeat(15000)],
    ['tampered.txt', 'text/plain', 'Tamper-check original'], ['slow.txt', 'text/plain', 'A slow fixture download'],
  ]) ids.push(await upload(name, media, bytes));
  const persona = await op('persona.create', { provider: 'fixture', model: 'file-fixture' }), environment = await op('environment.create', {});
  const work = await op('work.create', { title: 'File viewer fixture', brief: 'Wait while the supplied files are read.', environment: environment.id, personas: [persona.id] });
  const run = (await get('/records?kind=run&scope=' + work.id)).items[0];
  await op('run.pause', { id: run.id });
  await op('submit', { summary: 'Authored file fixtures for browser verification.', artifacts: ids, documents: [] }, '', run.id);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); page = await context.newPage(); page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    const probe = window.fileProbe = { urls: new Set(), workers: new Set(), messages: [] };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL), NativeWorker = Worker;
    URL.createObjectURL = blob => { const url = create(blob); probe.urls.add(url); return url; }; URL.revokeObjectURL = url => { probe.urls.delete(url); revoke(url); };
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); probe.workers.add(this); }
      postMessage(data, ...rest) { if (data.kind) probe.messages.push({ kind: data.kind, index: data.index }); return super.postMessage(data, ...rest); }
      terminate() { probe.workers.delete(this); super.terminate(); }
    };
  });
  page.on('pageerror', e => errors.push(e.message)); page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/assets/')) assets.push(new URL(request.url()).pathname); });
  await page.goto(url); await page.getByLabel('Node token').fill(token); await page.getByRole('button', { name: 'Connect to node', exact: true }).click();
  await step('initial production page loads no file renderers, Markdown parser or archive worker', async () => {
    await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
    assert(!assets.some(path => /Viewer-|Preview-|MarkdownContent-|archive.worker|artifact.worker/.test(path)), assets.join('\n'));
  });
  await page.getByRole('button', { name: 'File viewer fixture', exact: true }).click(); await page.getByRole('tab', { name: 'Artifacts & evidence', exact: true }).click();
  await step('SVG uses a decoded image; unrelated renderers stay unloaded', async () => {
    await open('plan.SVG'); await imageReady('plan.SVG');
    const source = await dialog().getByRole('img').evaluate(async img => (await fetch(img.src)).text()); assert(!source.includes('<script')); assert(source.includes('Four bedrooms'));
    assert(!assets.some(path => /ArchivePreview-|archive.worker|MarkdownPreview-|TextPreview-|MediaPreview-|PdfPreview-/.test(path)));
    await page.screenshot({ path: join(evidence, 'svg.png') }); await close();
  });
  await step('PNG displays as an image and releases its object URL', async () => { await open('pixel.png'); await imageReady('pixel.png'); await close(); });
  await step('Markdown headings, emphasis, lists, tables and code render through marked', async () => {
    await open('concept.md'); await expect(dialog().getByRole('heading', { name: 'Four-bedroom concept', exact: true })).toBeVisible();
    await expect(dialog().locator('strong')).toHaveText('readable'); await expect(dialog().getByRole('columnheader', { name: 'Room', exact: true })).toBeVisible();
    await expect(dialog().locator('li')).toHaveCount(2); await expect(dialog().locator('pre code')).toHaveText('print("geometry")');
    await expect(dialog().locator('script, img, a[href^="javascript:"]')).toHaveCount(0); assert.equal(await page.evaluate(() => window.markdownExecuted), undefined);
    await close();
  });
  await step('plain text retains literal Markdown characters', async () => { await open('notes.txt'); await expect(dialog().locator('.file-source')).toHaveText('# Literal heading\n**Literal emphasis**'); await expect(dialog().locator('strong')).toHaveCount(0); await close(); });
  await open('concept.zip'); const archive = () => dialog().getByRole('region', { name: 'Contents of concept.zip', exact: true });
  await step('ZIP lists folders without extracting a file', async () => {
    await expect(archive().getByRole('button', { name: 'Open folder plans', exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => window.fileProbe.messages.filter(m => m.kind === 'extract').length), 0);
    assert.equal(await page.evaluate(() => window.fileProbe.workers.size), 1);
    await page.screenshot({ path: join(evidence, 'zip-folders.png') });
  });
  await step('ZIP extracts only the selected SVG and revokes it when returning to the folder', async () => {
    await archive().getByRole('button', { name: 'Open folder plans', exact: true }).click(); await archive().getByRole('button', { name: 'Open file floor-plan.svg', exact: true }).click();
    await imageReady('floor-plan.svg'); assert.equal(await page.evaluate(() => window.fileProbe.messages.filter(m => m.kind === 'extract').length), 1);
    const download = await Promise.all([page.waitForEvent('download'), archive().getByRole('link', { name: 'Download this file', exact: true }).click()]);
    assert.equal(download[0].suggestedFilename(), 'floor-plan.svg'); assert.deepEqual(await readFile(await download[0].path()), Buffer.from(svg));
    await archive().getByRole('button', { name: '← Back to folder', exact: true }).click(); await expect.poll(() => page.evaluate(() => window.fileProbe.urls.size)).toBe(0);
    await archive().getByRole('button', { name: 'Open folder empty', exact: true }).click(); await expect(archive()).toContainText('This folder is empty.'); await archive().getByRole('button', { name: 'Archive home', exact: true }).click();
  });
  await step('archive Markdown and JSON use the same renderers without a JSON property table', async () => {
    await archive().getByRole('button', { name: 'Open file README.md', exact: true }).click(); await expect(archive().getByRole('heading', { name: 'Four-bedroom concept', exact: true })).toBeVisible();
    await archive().getByRole('button', { name: 'Archive home', exact: true }).click(); await archive().getByRole('button', { name: 'Open folder data', exact: true }).click();
    await archive().getByRole('button', { name: 'Open file geometry.json', exact: true }).click(); await expect(archive().locator('.file-source')).toHaveText('{"bedrooms":4,"units":"m"}'); await expect(archive().locator('table')).toHaveCount(0);
    await archive().getByRole('button', { name: 'Archive home', exact: true }).click();
  });
  await step('archive folders are paginated and searchable', async () => {
    await archive().getByRole('button', { name: 'Open folder many', exact: true }).click(); await expect(archive().locator('.archive-files > li')).toHaveCount(100);
    await archive().getByRole('button', { name: 'Next files', exact: true }).click(); await expect(archive()).toContainText('101–200 of 205');
    await archive().getByRole('searchbox', { name: 'Find in this folder' }).fill('file-204'); await expect(archive().locator('.archive-files > li')).toHaveCount(1);
    await archive().getByRole('button', { name: 'Archive home', exact: true }).click();
  });
  await step('nested archives release their worker when returning to the parent', async () => {
    await archive().getByRole('button', { name: 'Open file nested.zip', exact: true }).click(); const inner = archive().getByRole('region', { name: 'Contents of nested.zip', exact: true });
    await inner.getByRole('button', { name: 'Open file readme.md', exact: true }).click(); await expect(inner.getByRole('heading', { name: 'Inner archive', exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => window.fileProbe.workers.size), 2);
    await archive().getByRole('button', { name: 'Archive home', exact: true }).first().click(); await expect.poll(() => page.evaluate(() => window.fileProbe.workers.size)).toBe(1);
  });
  await step('encrypted and malformed entries give actionable errors without mounting a renderer', async () => {
    await archive().getByRole('button', { name: 'Open file private.txt', exact: true }).click(); await expect(archive().getByRole('alert')).toContainText('password protected');
    await archive().getByRole('button', { name: 'Archive home', exact: true }).click();
    for (const [name, inside] of [['broken-size.zip', 'expanded.txt'], ['bad-crc.zip', 'readme.md']]) {
      await archive().getByRole('button', { name: 'Open file ' + name, exact: true }).click(); const inner = archive().getByRole('region', { name: 'Contents of ' + name, exact: true });
      await inner.getByRole('button', { name: 'Open file ' + inside, exact: true }).click(); await expect(inner.getByRole('alert')).toContainText('Could not extract'); await expect(inner.locator('.file-source, .reader-prose')).toHaveCount(0);
      await archive().getByRole('button', { name: 'Archive home', exact: true }).first().click();
    }
  });
  await step('unsupported archive entries can be downloaded without interpreting them', async () => {
    await archive().getByRole('button', { name: 'Open file model.blend', exact: true }).click(); await expect(archive()).toContainText('A preview is not available'); await expect(archive().getByRole('link', { name: 'Download this file', exact: true })).toBeVisible();
    await close();
  });
  await step('empty and invalid ZIP files are readable states; failed workers terminate', async () => {
    await open('empty.zip'); await expect(dialog()).toContainText('This folder is empty.'); await close();
    await open('corrupt.zip'); await expect(dialog().getByRole('alert')).toContainText('Could not browse this archive'); await expect.poll(() => page.evaluate(() => window.fileProbe.workers.size)).toBe(0); await close();
  });
  await step('large Markdown has a bounded reading surface and retains the original download', async () => { await open('large.md'); await expect(dialog()).toContainText('Showing the first 128 KB'); await expect(dialog().getByRole('link', { name: 'Download original', exact: true })).toBeVisible(); assert((await dialog().locator('.reader-prose').innerText()).length < 140000); await close(); });
  await step('audio uses native controls and stops/relinquishes its source on close', async () => {
    await open('sound.wav'); await expect.poll(() => dialog().locator('audio').evaluate(audio => audio.readyState)).toBeGreaterThan(0);
    await dialog().locator('audio').evaluate(audio => { window.fixtureAudio = audio; }); await close();
    assert.deepEqual(await page.evaluate(() => [window.fixtureAudio.paused, window.fixtureAudio.hasAttribute('src')]), [true, false]); await page.evaluate(() => { delete window.fixtureAudio; });
  });
  await step('PDF uses the browser PDF viewer and releases its source', async () => { await open('drawing.pdf'); await expect(dialog().locator('object[type="application/pdf"]')).toBeVisible(); await close(); });
  await step('tampered download fails SHA-256 verification before rendering', async () => {
    const path = '**/api/artifacts/' + files.get('tampered.txt').id;
    await context.route(path, route => route.fulfill({ contentType: 'text/plain', body: Buffer.alloc(files.get('tampered.txt').bytes.length, 88) }));
    await open('tampered.txt'); await expect(dialog().getByRole('alert')).toContainText('digest mismatch'); await expect(dialog().locator('.file-source')).toHaveCount(0); await close(); await context.unroute(path);
  });
  await step('oversized SVG previews are declined before fetching or allocating a worker', async () => {
    const id = files.get('plan.SVG').id, metaPath = '**/api/records/' + id, bytePath = '**/api/artifacts/' + id;
    const metadata = await get('/records/' + id); let reads = 0;
    await context.route(metaPath, route => route.fulfill({ json: { ...metadata, data: { ...metadata.data, size: 2 * 1024 * 1024 + 1 } } }));
    await context.route(bytePath, route => { reads++; return route.fulfill({ body: svg }); });
    await open('plan.SVG'); await expect(dialog()).toContainText('larger than the browser preview'); assert.equal(reads, 0);
    assert.equal(await page.evaluate(() => window.fileProbe.workers.size), 0); await expect(dialog().getByRole('link', { name: 'Download original', exact: true })).toBeVisible();
    await close(); await context.unroute(metaPath); await context.unroute(bytePath);
  });
  await step('closing an unfinished download terminates its worker and discards late results', async () => {
    const path = '**/api/artifacts/' + files.get('slow.txt').id; let release, pending;
    const gate = new Promise(resolve => { release = resolve; });
    await context.route(path, async route => { pending = true; await gate; await route.fulfill({ contentType: 'text/plain', body: files.get('slow.txt').bytes }).catch(() => {}); });
    await open('slow.txt'); await expect.poll(() => !!pending).toBe(true); await close(); release(); await context.unroute(path, { behavior: 'wait' });
    await expect(dialog()).toHaveCount(0);
  });
  await step('unloading an archive releases its components and workers; reloading starts cleanly', async () => {
    await open('concept.zip'); await expect(archive().getByRole('button', { name: 'Open folder plans', exact: true })).toBeVisible();
    await dialog().getByRole('button', { name: 'Unload preview', exact: true }).click(); await expect.poll(() => page.evaluate(() => [window.fileProbe.workers.size, window.fileProbe.urls.size])).toEqual([0, 0]);
    await expect(dialog().locator('.archive-browser')).toHaveCount(0); await dialog().getByRole('button', { name: 'Load preview', exact: true }).click();
    await expect(archive().getByRole('button', { name: 'Open folder plans', exact: true })).toBeVisible(); await close();
  });
  await step('repeated image/archive navigation does not retain previews, workers or object URLs', async () => {
    for (let i = 0; i < 6; i++) { await open('concept.zip'); await archive().getByRole('button', { name: 'Open folder plans', exact: true }).click(); await archive().getByRole('button', { name: 'Open file pixel.png', exact: true }).click(); await imageReady('pixel.png'); await close(); }
  });
  await step('mobile ZIP navigation and images fit the dialog without horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await open('concept.zip'); await expect(archive().getByRole('button', { name: 'Open folder plans', exact: true })).toBeVisible();
    assert(await dialog().evaluate(el => el.scrollWidth <= el.clientWidth)); await page.screenshot({ path: join(evidence, 'zip-mobile.png') });
    await archive().getByRole('button', { name: 'Open folder plans', exact: true }).click(); await archive().getByRole('button', { name: 'Open file floor-plan.svg', exact: true }).click(); await imageReady('floor-plan.svg');
    assert(await dialog().evaluate(el => el.scrollWidth <= el.clientWidth)); await page.screenshot({ path: join(evidence, 'svg-mobile.png') }); await close();
  });
  assert.deepEqual(errors, []);
  await writeFile(join(evidence, 'report.json'), JSON.stringify({ scope: 'Production UI and real Rust artifact API; authored files and local synthetic provider; explicit network fault injection', checks, providerCalls, assets: [...new Set(assets)], errors }, null, 2));
  console.log(JSON.stringify({ checks, providerCalls, evidence }));
} catch (error) {
  console.error(error); process.exitCode = 1;
  await page?.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(join(evidence, 'failure.txt'), String(error) + '\n' + errors.join('\n') + '\n' + (await page?.locator('body').innerText().catch(() => '')));
  console.error('Evidence: ' + evidence);
} finally {
  await browser?.close();
  if (app && app.exitCode === null) { const exited = once(app, 'exit'); app.kill('SIGTERM'); await exited; }
  await new Promise(resolve => provider.close(resolve));
}
