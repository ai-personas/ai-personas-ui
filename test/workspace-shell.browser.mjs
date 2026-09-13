// Deterministic browser coverage of the workspace shell. Fixture records are
// renderer inputs only; they do not enter or bypass the production verifier.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {renderer} from './helpers/discovery-presentation.mjs';
const {chromium} = await import(process.env.UI_BROWSER_MODULE || 'playwright');
const root = fileURLToPath(new URL('../',import.meta.url));
const discoverySource=await fs.readFile(path.join(root,'assets/discovery.js'),'utf8');
const sliceSource=(start,end)=>{const first=discoverySource.indexOf(start),last=discoverySource.indexOf(end,first+start.length);
  assert.ok(first>=0&&last>first);return discoverySource.slice(first,last);};
// The actual task renderer, click handler and DOM reconciler with admitted-state
// test records, served as a local module under the site's normal CSP.
const browsingFixture=`
import {browseLimit,browseMoreHTML} from '/assets/workspace-state.mjs';
import {selectPriorityWindow} from '/assets/network-view.mjs';
import {updateStageHTML} from '/assets/stage-dom.mjs';
const $=selector=>document.querySelector(selector), S={q:'',kernelFocus:null};
const esc=value=>String(value??''), icon=()=>'', humanizeMachineKey=String;
const missionCardIsObservedCurrent=()=>false,renderGlobalKernels=()=>{},renderOpenInputs=()=>{};
const cards=Array.from({length:49},(_,i)=>({key:'task-'+String(i).padStart(3,'0'),recId:'task-'+i,
  task:'Fixture work '+i,state:'quiescent',meta:[],nodeAvailability:'online'}));
const missionCardList=()=>cards;
${sliceSource('function renderMissions(){','/* ---------- wiring ---------- */')}
${sliceSource('function wire(){','  // Design-system nav family:')}}
wire();renderMissions();
`;
const server = http.createServer(async(req,res)=>{
  const url = new URL(req.url,'http://localhost');
  if(url.pathname==='/__browsing_fixture.mjs'){res.setHeader('Content-Type','text/javascript');res.end(browsingFixture);return;}
  const file = path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root)) {res.writeHead(403).end();return;}
  try { const body=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.css')?'text/css':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(body); }
  catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],
  ...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{})});
const errors=[],observations=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  // Suppress all discovery in this shell-only fixture. No remote route is reached.
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.includes('/assets/identity-first.mjs')) return route.fulfill({contentType:'text/javascript',body:''});
    return url.startsWith(origin)?route.continue():route.abort();
  });
  await page.goto(origin+'/#personas?q=Alice');
  await page.waitForFunction(()=>document.body.dataset.view==='personas');
  assert.equal(await page.locator('#q').inputValue(),'Alice');
  assert.equal(await page.title(),'AI Personas · Personas');
  const ui=renderer({identityVerified:true,record:{description:'Testing shared work.'}});
  const cards=ui.card('alice','node')+ui.card('bob','node');
  await page.evaluate(cards=>{
    const stage=document.querySelector('#sysEnvs');
    stage.innerHTML='<section class="persona-section"><div class="persona-deck">'+cards+'</div></section>'
      +'<section class="environment-section"><div class="environment-grid"><article class="env-card pk"><h3>Test workspace</h3></article></div></section>';
    Object.assign(stage.dataset,{discoveryReady:'true',personaTotal:'2',personaMatched:'2',environmentTotal:'1',environmentMatched:'1',workingTotal:'0'});
    document.dispatchEvent(new CustomEvent('workspace:updated'));
  },cards);
  assert.equal(await page.locator('.persona-section').isVisible(),true);
  assert.equal(await page.locator('.environment-section').isVisible(),false);
  await page.locator('#clearSearch').click();
  assert.equal(await page.locator('#q').inputValue(),'');
  await page.locator('button[data-layout="list"]').click();
  assert.equal(await page.locator('body').getAttribute('data-layout'),'list');
  assert.equal(await page.locator('button[data-layout="list"]').getAttribute('aria-pressed'),'true');
  await page.locator('.app-nav [data-view-link="workspaces"]').click();
  assert.equal(await page.locator('.persona-section').isVisible(),false);
  assert.equal(await page.locator('.environment-section').isVisible(),true);
  await page.goBack();
  await page.waitForFunction(()=>document.body.dataset.view==='personas');
  await page.locator('#q').fill('A & B');
  await page.waitForURL(url=>url.hash.includes('q=A+%26+B'));
  // An incoming refresh must retain the viewer's query and focused search field.
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('workspace:updated')));
  assert.equal(await page.locator('#q').inputValue(),'A & B');
  assert.equal(await page.locator('#q').evaluate(el=>el===document.activeElement),true);
  await page.locator('#resetFilters').click();
  assert.equal(await page.locator('#q').inputValue(),'');
  await page.locator('.app-nav [data-view-link="work"]').click();
  assert.equal(await page.locator('#workEmpty').isVisible(),true);
  await page.evaluate(()=>{
    window.connectionClicks=0;
    document.querySelector('#opbtn').addEventListener('click',()=>window.connectionClicks++);
  });
  await page.locator('#workEmpty [data-connect-node]').click();
  assert.equal(await page.evaluate(()=>window.connectionClicks),1);
  await page.locator('.app-nav [data-view-link="network"]').click();
  assert.equal(await page.locator('.network-page').isVisible(),true);
  await page.keyboard.press('/');
  assert.equal(await page.locator('body').getAttribute('data-view'),'network');
  assert.equal(await page.locator('#q').evaluate(el=>el===document.activeElement),true);
  for(const width of [1440,1024,768,390,320]) {
    await page.setViewportSize({width,height:900});
    for(const view of ['overview','personas','workspaces','work','network']) {
      await page.locator(`.app-nav [data-view-link="${view}"]`).click();
      assert.equal(await page.locator('#pageTitle').isVisible(),true);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      assert.equal(overflow,false,`${view} overflows at ${width}px`);
      const badControls=await page.locator('.app-nav a').evaluateAll(links=>links.filter(el=>!el.textContent.trim()).length);
      assert.equal(badControls,0);
      observations.push({width,view,overflow});
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.app-nav [data-view-link="work"]').click();
  await page.evaluate(()=>import('/__browsing_fixture.mjs'));
  assert.equal(await page.locator('#missionCards .mcard').count(),24);
  await page.locator('[data-more-records="tasks"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#missionCards .mcard').count(),48);
  assert.equal(await page.locator('[data-more-records="tasks"]').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#missionCards .mcard').count(),49);
  assert.equal(await page.locator('[data-mrec="task-48"]').evaluate(el=>el===document.activeElement),true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({completed:true,layouts:observations.length,errors}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
