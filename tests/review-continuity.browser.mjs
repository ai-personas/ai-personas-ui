import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const port = 5198, origin = `http://127.0.0.1:${port}`;
const prior = 'a'.repeat(32), change = 'b'.repeat(32), source = 'c'.repeat(32);
await mkdir('.qa', {recursive:true});
const harness = '.qa/review-continuity-harness.tsx';
await writeFile(harness, `import {render} from 'preact'; import ReviewContinuity from '../src/ReviewContinuity'; import '../src/style.css';
const valid={concludes:{id:'${prior}',revision:2},change_evidence:[{basis:'explicit_exact_reference',change:{id:'${change}',revision:3},observations:[{id:'${source}',revision:4}]}]};
render(<><ReviewContinuity value={valid} open={()=>{}}/><ReviewContinuity value={{concludes:{id:'not-an-id',revision:0},change_evidence:[{basis:'claimed',change:{id:'${change}',revision:3},observations:[]}]}} open={()=>{}}/></>,document.getElementById('test')!);`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'], {stdio:'ignore'});
let browser;
try {
  for (let i=0;i<100;i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  browser = await chromium.launch();
  const page = await browser.newPage({viewport:{width:390,height:900}}), reads=[], errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.route('**/review-fixture', r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="test" style="padding:12px"></main><script type="module" src="/.qa/review-continuity-harness.tsx"></script></body></html>'}));
  await page.route('**/api/records/*', r=>{ reads.push(r.request().url()); const id=r.request().url().split('/').at(-1); return r.fulfill({json:{id,kind:'fragment',scope:'',revision:8,created:'2026-09-23T00:00:00Z',updated:'2026-09-23T00:00:00Z',data:{title:'Current record',content:'Current content'}}}); });
  await page.goto(origin+'/review-fixture');
  await expect(page.getByRole('region',{name:'Review continuity',exact:true})).toHaveCount(1);
  await expect(page.getByText('This concludes an earlier deferral.',{exact:false})).toBeVisible();
  assert.equal(reads.length,0,'closed details must not fetch evidence previews');
  await page.getByRole('button',{name:'Show review links'}).click();
  await expect(page.getByText('Referenced version 2',{exact:true})).toBeVisible();
  await expect(page.getByText('Referenced version 3',{exact:true})).toBeVisible();
  await expect(page.getByText('Referenced version 4',{exact:true})).toBeVisible();
  await expect.poll(()=>reads.length).toBe(3);
  await page.getByRole('button',{name:'Hide review links'}).click();
  await expect(page.locator('[aria-label="Review evidence links"]')).toHaveCount(0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile layout fits');
  assert.deepEqual(errors,[]);
  console.log('Review continuity browser checks passed: deferred closeout, qualified exact links, invalid-reference rejection, no eager reads, exact version labels, unmount and mobile fit.');
} finally { await browser?.close(); server.kill('SIGTERM'); await rm(harness,{force:true}); }
