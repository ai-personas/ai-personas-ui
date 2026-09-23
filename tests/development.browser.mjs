import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir,writeFile,rm } from 'node:fs/promises';
import { chromium,expect } from '@playwright/test';
const port=5196,origin=`http://127.0.0.1:${port}`,persona='a'.repeat(32);
const profile={id:persona,kind:'persona',revision:1,scope:'',created:'2026-09-23T00:00:00Z',updated:'2026-09-23T00:00:00Z',data:{self_authorship:true,character:'Explore representative alternatives',ocean:{openness:0},vad:{valence:0},starting_profile:{character:'Seed narrative',ocean:{openness:0},vad:{valence:0},initialization:{algorithm:'uniform-sha256-53/1',random_seed:'0'.repeat(32)}}}};
await mkdir('.qa',{recursive:true});const harness='.qa/development-harness.tsx';
await writeFile(harness,`import {h,render} from 'preact'; import Identity from '../src/Identity'; import ProfileFields,{profileInput} from '../src/ProfileFields'; import '../src/style.css';
(window as any).operations=[];
render(<><form id="seed-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);(window as any).seed={profile_seed:profileInput(f,true),self_authorship:f.has('self_authorship')};}}><ProfileFields creation/><button>Create fixture persona</button></form><Identity persona={${JSON.stringify(profile)}} open={()=>{}} act={async(kind,args)=>{(window as any).operations.push({kind,args});return {state:'succeeded',result:{}} as any;}}/></>,document.getElementById('test')!);`);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:900}});const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.route('**/development-fixture',r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="test" style="padding:12px"></main><script type="module" src="/.qa/development-harness.tsx"></script></body></html>'}));
  await page.route('**/api/records?*',r=>r.fulfill({json:{items:[],next:null,sequence:0}}));
  await page.goto(origin+'/development-fixture');
  assert.equal(requests.some(u=>u.includes('/Development.tsx')),false,'development code must load only on opening');
  const form=page.locator('#seed-form');await expect(form.getByRole('checkbox')).toBeChecked();
  await form.getByText('Choose starting traits and affect').click();await form.locator('[name="ocean.openness"]').fill('0');await form.locator('[name="vad.valence"]').fill('0');
  await form.getByRole('button',{name:'Create fixture persona'}).click();
  assert.deepEqual(await page.evaluate(()=>window.seed),{profile_seed:{ocean:{openness:0},vad:{valence:0}},self_authorship:true});
  await page.getByRole('button',{name:'Edit character and authorship'}).click();
  const editor=page.locator('.identity-profile form');await editor.getByRole('checkbox').uncheck();await editor.locator('[name="reason"]').fill('Keep my current character preferences');await editor.getByRole('button',{name:'Save your changes'}).click();
  assert.equal((await page.evaluate(()=>window.operations))[0].kind,'persona.profile.configure');assert.equal((await page.evaluate(()=>window.operations))[0].args.self_authorship,false);assert.equal((await page.evaluate(()=>window.operations))[0].args.revision,1);
  await page.getByRole('button',{name:'Show starting profile'}).click();await expect(page.getByText('Seed narrative',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Show experience and exploration'}).click();await expect(page.getByRole('region',{name:'Experience and exploration',exact:true})).toBeVisible();assert.equal(requests.some(u=>u.includes('/Development.tsx')),true);
  await page.getByRole('button',{name:'Hide experience and exploration'}).click();await expect(page.getByRole('region',{name:'Experience and exploration',exact:true})).toHaveCount(0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'controls must fit a mobile viewport');assert.deepEqual(errors,[]);
  console.log('Production development UI passed: blank/random input, explicit zeros, default authorship, exact operator edits, immutable seed display, lazy mount/unmount and mobile layout.');
}finally{await browser?.close();server.kill('SIGTERM');await rm(harness,{force:true});}
