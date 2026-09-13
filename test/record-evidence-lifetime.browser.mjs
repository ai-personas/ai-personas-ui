// Real DOM/interaction regression with synthetic records, not a live-node or GC claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const assets=process.env.UI_PRESENTATION_ASSETS||fileURLToPath(new URL('../assets/',import.meta.url));
const {chromium}=await import(process.env.UI_BROWSER_MODULE||'playwright');
const report={completed:false,browser_closed:false,observations:[],errors:[],blocked_requests:[],
  scope:'Offline synthetic records in the actual renderer, disclosure lifecycle and stage-update modules.',
  limits:['No live node, provider call, P2P transfer or persona artifact is tested.',
    'No forced GC or claim about browser garbage-collection timing.']};
const bounded=async(promise,label,milliseconds=10000)=>{
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(label+' exceeded its deadline')),milliseconds);
  })]);}finally{clearTimeout(timer);}
};
const server=http.createServer(async(request,response)=>{
  const pathname=new URL(request.url,'http://fixture').pathname;
  if(request.method!=='GET'||!/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname)){
    response.writeHead(404);response.end();return;
  }
  try{
    const bytes=await fs.readFile(path.join(assets,path.basename(pathname)));
    response.writeHead(200,{'Content-Type':pathname.endsWith('.css')?'text/css':'text/javascript',
      'Access-Control-Allow-Origin':'*'});response.end(bytes);
  }catch(_){response.writeHead(404);response.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,timeout:10000,
    ...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
  const page=await bounded(browser.newPage(),'page creation');page.setDefaultTimeout(5000);
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.route('**/*',route=>{
    const request=route.request();
    if(new URL(request.url()).origin!==base||request.method()!=='GET'){
      report.blocked_requests.push(request.url());return route.abort();
    }
    return route.continue();
  });
  await bounded(page.setContent(`<link rel="stylesheet" href="${base}/assets/discovery.css"><main id="fixture" style="max-width:760px;margin:20px;padding:20px"></main>`),'initial page');
  await bounded(page.evaluate(async base=>{
    window.records=await import(base+'/assets/persona-records.mjs');
    window.stage=await import(base+'/assets/stage-dom.mjs');
    window.host=document.getElementById('fixture');
  },base),'module imports');
  for(const width of [390,1440]) for(const kind of ['education','experience']){
    await page.setViewportSize({width,height:1000});
    const initial=await page.evaluate(({kind})=>{
      const exact='Exact evidence <script>not executable</script> α 🧭. '.repeat(30000);
      window.doc=kind==='education'?{curricula:[{record_id:'package',title:'Recorded course',rubric:[]}],enrollments:[],
        assessments:[{assessment_id:'attempt',package_hash:'package',version:'1',status:'not_yet_demonstrated',
          assessment_capability:{id:'assessor',version:'1'},latest_result:{record_id:'result'},history:[],
          criteria:[{criterion:'application',status:'not_yet_demonstrated',evidence:{exact}},
            {criterion:'retention',status:'not_yet_demonstrated',evidence:'Second exact evidence.'}]}]}
        :{summary:{recorded_turns:2},limits:'Recorded observations.',records:[
          {source_kind:'work_turn',recorded_at:'2026-09-13T05:20:53Z',source_record_hash:'sha256:first',facts:{exact}},
          {source_kind:'work_turn',recorded_at:'2026-09-13T05:20:54Z',source_record_hash:'sha256:second',facts:'Second exact evidence.'}]};
      window.render=()=>kind==='education'?records.educationHtml(doc):records.experienceHtml(doc);
      const started=performance.now();stage.replaceStageHTML(host,render());
      return {html_bytes:new TextEncoder().encode(host.innerHTML).length,eager_bodies:host.querySelectorAll('pre').length,
        render_ms:performance.now()-started,overflow:document.documentElement.scrollWidth>innerWidth};
    },{kind});
    report.observations.push({width,kind,initial});
    assert.equal(initial.eager_bodies,0,'closed evidence must not already occupy DOM bodies');
    assert.ok(initial.html_bytes<6000);assert.equal(initial.overflow,false);
    await page.evaluate(()=>{
      window.observedToggles=[];
      window.observeToggle=event=>observedToggles.push({open:event.target.open,key:event.target.dataset.disclosureKey});
      host.addEventListener('toggle',observeToggle,true);
      window.mount=records.mountRecordEvidence(host);mount.update(doc);
    });
    const disclosures=page.locator('[data-record-evidence]');
    assert.equal(await disclosures.count(),2);
    report.stage='opening first '+kind+' '+width;
    await disclosures.nth(0).locator('summary').click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-record-evidence-body] pre').length===1);
    assert.equal(await page.locator('[data-record-evidence-body] script').count(),0);
    const paged=await bounded(page.evaluate(kind=>{
      const body=host.querySelector('[data-record-evidence-body]'),chunks=[];
      do{
        chunks.push(body.querySelector('pre').textContent);
        const next=body.querySelector('[data-record-evidence-page="next"]');
        if(!next||next.disabled) break;
        next.click();
      }while(chunks.length<200);
      const value=kind==='education'?doc.assessments[0].criteria[0].evidence:doc.records[0].facts;
      const last=body.querySelector('pre').textContent;
      body.querySelector('[data-record-evidence-page="previous"]').click();
      const movedBack=body.querySelector('pre').textContent!==last;
      body.querySelector('[data-record-evidence-page="next"]').click();
      return {parts:chunks.length,exact:chunks.join('')===JSON.stringify(value),
        largest:Math.max(...chunks.map(text=>text.length)),
        splitSurrogate:chunks.some(text=>/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(text)),
        roundTrip:movedBack&&body.querySelector('pre').textContent===last};
    },kind),'paged evidence read');
    assert.ok(paged.parts>1);assert.equal(paged.exact,true);assert.ok(paged.largest<=16000);
    assert.equal(paged.splitSurrogate,false);assert.equal(paged.roundTrip,true);
    report.observations.at(-1).paged=paged;
    await disclosures.nth(1).locator('summary').click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-record-evidence-body] pre').length===2);
    await disclosures.nth(0).locator('summary').click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-record-evidence-body] pre').length===1);
    assert.equal(await page.locator('[data-record-evidence-body] pre').innerText(),'Second exact evidence.');
    // An unchanged open record survives both immediate and deferred pointer repaint.
    const box=await disclosures.nth(1).locator('summary').boundingBox();
    await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();
    await page.evaluate(()=>{stage.updateStageHTML(host,'<p>Updated metadata</p>'+render());mount.update(doc);});
    await page.mouse.move(width-2,2);await page.mouse.up();await page.waitForTimeout(50);
    assert.equal(await page.locator('[data-record-evidence-body] pre').innerText(),'Second exact evidence.');
    const revised=await page.evaluate(kind=>{
      if(kind==='education'){
        doc.assessments[0].latest_result.record_id='corrected-result';
        doc.assessments[0].criteria.reverse();doc.assessments[0].criteria[0].evidence='Corrected exact evidence.';
      }else{doc.records.reverse();doc.records[0].facts='Corrected exact evidence.';}
      stage.updateStageHTML(host,render());mount.update(doc);
      return [...host.querySelectorAll('[data-record-evidence-body] pre')].map(node=>node.textContent);
    },kind);
    assert.deepEqual(revised,['Corrected exact evidence.']);
    assert.equal(await page.evaluate(()=>{
      const opened=host.querySelector('details[data-record-evidence][open]');
      const original=opened.dataset.disclosureKey;
      opened.dataset.disclosureKey='not JSON';mount.update(doc);
      const cleared=opened.querySelector('[data-record-evidence-body]').childNodes.length===0;
      opened.dataset.disclosureKey=original;return cleared;
    }),true);
    await page.evaluate(()=>{stage.updateStageHTML(host,render());mount.update(doc);});
    const released=await page.evaluate(()=>{
      mount.update(null);
      const cleared=host.querySelectorAll('[data-record-evidence-body] pre').length===0;
      mount.update(doc);mount.dispose();mount.dispose();mount.update(doc);
      for(const node of host.querySelectorAll('[data-record-evidence]')) node.open=true;
      return cleared&&host.querySelectorAll('[data-record-evidence-body] pre').length===0;
    });
    assert.equal(released,true);await page.waitForTimeout(50);
    assert.equal(await page.locator('[data-record-evidence-body] pre').count(),0);
    await page.evaluate(()=>{
      host.removeEventListener('toggle',observeToggle,true);window.observeToggle=null;
      stage.replaceStageHTML(host,'');window.doc=null;window.mount=null;window.render=null;
    });
    report.observations.at(-1).lifecycle_passed=true;
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked_requests,[]);report.completed=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;
  try{
    const page=browser?.contexts()[0]?.pages()[0];
    if(page) report.failure_dom=await bounded(page.evaluate(()=>({toggles:window.observedToggles,
      disclosures:[...document.querySelectorAll('[data-record-evidence]')].map(node=>({open:node.open,
        key:node.dataset.disclosureKey,body_count:node.querySelectorAll('pre').length,
        text_bytes:node.querySelector('[data-record-evidence-body]')?.textContent.length}))})), 'failure DOM',2000);
  }catch(observation){report.failure_dom_error=String(observation.message);}
}finally{
  if(browser){try{await bounded(browser.close(),'browser close');report.browser_closed=true;}
    catch(error){report.cleanup_failure=String(error.message);process.exitCode=1;}}
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(process.env.UI_RECORDS_REPORT)await fs.writeFile(process.env.UI_RECORDS_REPORT,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
}
console.log(JSON.stringify({completed:report.completed,browser_closed:report.browser_closed,cases:report.observations.length,
  failure:report.failure,cleanup_failure:report.cleanup_failure}));
