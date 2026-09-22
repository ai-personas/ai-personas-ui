/** Actual browser components and worker, synthetic files only. No Rust node or
 * provider is used; this is not end-to-end runtime or model acceptance. */
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { gzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const evidence = '.qa/reliability-components';
await mkdir(evidence, {recursive:true});
function tar(files) {
  const parts = [];
  for (const [name, text] of files) {
    const body = Buffer.from(text), header = Buffer.alloc(512);
    header.write(name,0,100,'utf8'); header.write('0000600\0',100); header.write('0000000\0',108); header.write('0000000\0',116);
    header.write(body.length.toString(8).padStart(11,'0') + '\0',124); header.write('00000000000\0',136);
    header.fill(32,148,156); header[156] = 48; header.write('ustar\0',257); header.write('00',263);
    header.write(header.reduce((a,b) => a+b,0).toString(8).padStart(6,'0')+'\0 ',148);
    parts.push(header, body, Buffer.alloc((512-body.length%512)%512));
  }
  return Buffer.concat([...parts,Buffer.alloc(1024)]);
}
const gzip = gzipSync(tar([['README.txt','Synthetic package'],['plans/figure.svg','<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="gray"/><script>window.fixtureExecuted=true</script></svg>']]));
let server, browser, page; const checks = [], errors = [];
async function step(name, fn) {await fn(); checks.push(name); console.log('PASS '+name);}
try {
  server = await createServer({server:{host:'127.0.0.1',port:0},clearScreen:false}); await server.listen();
  browser = await chromium.launch({headless:true}); page = await browser.newPage(); page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    const probe = window.probe = {workers:new Set(),urls:new Set(),messages:[]};
    const WorkerBase = Worker, create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    window.Worker = class extends WorkerBase {
      constructor(...args) {super(...args);probe.workers.add(this);}
      postMessage(data,...rest) {if(data?.kind)probe.messages.push(data.kind);return super.postMessage(data,...rest);}
      terminate() {probe.workers.delete(this);super.terminate();}
    };
    URL.createObjectURL = blob => {const url=create(blob);probe.urls.add(url);return url;};
    URL.revokeObjectURL = url => {probe.urls.delete(url);revoke(url);};
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/reliability-fixture.html`);
  await expect(page.getByRole('heading',{name:'Reliability fixture ready'})).toBeVisible();
  await page.evaluate(encoded => window.mountArchive(encoded,'example.TAR.GZ','application/octet-stream'),gzip.toString('base64'));
  await step('TAR.GZ opens as a folder without eager extraction',async () => {
    await expect(page.getByRole('button',{name:'Open folder plans',exact:true})).toBeVisible();
    assert.equal(await page.evaluate(() => window.probe.messages.filter(x=>x==='extract').length),0);
  });
  await step('Only the selected image is extracted and its active SVG content stays inert',async () => {
    await page.getByRole('button',{name:'Open folder plans',exact:true}).click();
    await page.getByRole('button',{name:'Open file figure.svg',exact:true}).click();
    await expect.poll(() => page.getByRole('img',{name:'figure.svg',exact:true}).evaluate(img=>img.complete && img.naturalWidth)).toBe(40);
    assert.equal(await page.evaluate(() => window.probe.messages.filter(x=>x==='extract').length),1);
    assert.equal(await page.evaluate(() => window.fixtureExecuted),undefined);
    const source = await page.getByRole('img',{name:'figure.svg',exact:true}).evaluate(async img=>(await fetch(img.src)).text());
    assert(!source.includes('<script'));
    await page.getByRole('button',{name:'← Back to folder',exact:true}).click();
    await expect.poll(() => page.evaluate(() => window.probe.urls.size)).toBe(0);
  });
  await step('Unmounting the archive releases its worker and object URLs',async () => {
    await page.evaluate(() => window.unmount());
    await expect.poll(() => page.evaluate(() => [window.probe.workers.size,window.probe.urls.size])).toEqual([0,0]);
  });
  await step('A corrupt gzip is a visible failure, not a partial folder listing',async () => {
    const bad = Buffer.from(gzip); bad[bad.length-8] ^= 1;
    await page.evaluate(encoded => window.mountArchive(encoded,'corrupt.tgz','application/gzip'),bad.toString('base64'));
    await expect(page.getByRole('alert')).toContainText('Could not browse this archive');
    await expect(page.getByRole('button',{name:'Open folder plans',exact:true})).toHaveCount(0);
    await page.evaluate(() => window.unmount());
    await expect.poll(() => page.evaluate(() => window.probe.workers.size)).toBe(0);
  });
  await step('Receipt presentation distinguishes discovery, selection and measured usage',async () => {
    const stage = {stage:'admitted_request',transport_boundary:'pre_dispatch'};
    await page.evaluate(value => window.mountEvidence(value),{status:'completed',context_bytes:40000,usage:{known:true,input:5000,cached:0,output:100},
      discovery_context:{schema:'discovery-context/1',...stage,offered:[{version:{id:'a'.repeat(32),revision:2}}]},
      learning_context:{schema:'learning-context/1',...stage,active:[],correction_notices:[]},
      context_recovery:{schema:'context-recovery/1',omitted_history:[{}],projected_commands:[],projected_diagnostics:[{}],omitted_discovery_candidates:2,omitted_retention_opportunities:0,original_request_bytes:90000}});
    await expect(page.getByRole('heading',{name:'Discovery previews admitted',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Selected learning admitted',exact:true})).toBeVisible();
    await expect(page.getByText('0 active lesson references; 0 correction notices.',{exact:true})).toBeVisible();
    await expect(page.getByText(/do not by themselves prove model receipt/)).toBeVisible();
    assert.deepEqual(await page.evaluate(() => window.opened),[]);
    await page.getByRole('button',{name:'Show exact references',exact:true}).click();
    await page.getByRole('button',{name:/referenced revision 2/}).click();
    assert.deepEqual(await page.evaluate(() => window.opened),['a'.repeat(32)]);
  });
  await step('Learning cards distinguish ordinary documents from lesson fragments',async () => {
    await page.evaluate(() => window.mountCards());
    await expect(page.getByText('Document — not a retained lesson',{exact:true})).toBeVisible();
    await expect(page.getByText('Retained lesson — usefulness not established',{exact:true})).toBeVisible();
    await page.screenshot({path:evidence+'/learning-labels.png'});
  });
  assert.deepEqual(errors,[]);
} finally {
  await writeFile(evidence+'/checks.json',JSON.stringify({scope:'synthetic_frontend_components_not_runtime_acceptance',checks,errors},null,2));
  await browser?.close(); await server?.close();
}
