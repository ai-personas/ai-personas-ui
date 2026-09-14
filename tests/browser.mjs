import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, openSync, ftruncateSync, closeSync } from 'node:fs';
import { tmpdir, cpus, totalmem, platform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { once } from 'node:events';
const cycles=Number(process.env.PERSONAS_BROWSER_CYCLES||100);
const runtime=process.env.PERSONAS_RELEASE || resolve('../ai-personas');const installed=!!process.env.PERSONAS_RELEASE;const binary=process.env.PERSONAS_BIN || join(runtime,installed?'bin/personas':'target/debug/personas');
const integration=process.env.PERSONAS_INTEGTEST || join(runtime,installed?'bin/integtest':'target/debug/integtest');
const root=mkdtempSync(join(tmpdir(),'personas-browser-new-'));const evidence=process.env.PERSONAS_BROWSER_EVIDENCE || join(root,'evidence');mkdirSync(evidence,{recursive:true});
const servers=[];let browser;let proxy;let jobs=[];let app;let observedPage;const pageErrors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function start(name,load=false){const dir=join(root,name);mkdirSync(dir);if(load)execFileSync(integration,['--root',dir,'load-fixture'],{stdio:'pipe'});else mkdirSync(join(dir,'node'));
  const cfg=join(dir,'providers.json');writeFileSync(cfg,JSON.stringify({fixture:['python3',join(runtime,'integtest/provider_fixture.py')]}));const port=await freePort();const log=openSync(join(dir,'server.log'),'a');
  const child=spawn(binary,['serve','--root',join(dir,'node'),'--listen',`127.0.0.1:${port}`,'--providers',cfg,'--ui',installed?join(runtime,'ui'):resolve('dist')],{stdio:['ignore',log,log]});closeSync(log);servers.push(child);
  const url=`http://127.0.0.1:${port}`;for(let i=0;i<300;i++){if(child.exitCode!==null)throw Error(readFileSync(join(dir,'server.log'),'utf8'));try{if((await fetch(url+'/health')).ok)break;}catch{}await delay(100);}
  const token=readFileSync(join(dir,'node/token'),'utf8');
  async function get(path){const r=await fetch(url+'/api'+path,{headers:{Authorization:`Bearer ${token}`}});const body=await r.json();assert(r.ok,JSON.stringify(body));return body;}
  async function op(kind,args,actor='',run=''){const r=await fetch(url+'/api/operations',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID().replaceAll('-',''),kind,args,actor,run})});const a=await r.json();assert(r.ok && a.state!=='failed',JSON.stringify(a));return a.result;}
  return {url,token,get,op,dir};
}
try{
  app=await start('loaded',true);const peer=await start('peer');
  const records=await app.get('/records?kind=document&limit=24');assert.equal(records.items.length,24);assert(records.next);assert(records.sequence>=100000);assert(records.items.every(r=>!('content' in r.data)));
  const p=await app.op('persona.create',{provider:'fixture',model:'inspection'});
  await app.op('persona.update',{revision:1,name:'Protocol fixture',character:'Synthetic volume verification, not a live persona.',reason:'Explicit test fixture'},p.id);
  const env=await app.op('environment.create',{});
  const work=await app.op('work.create',{title:'Active browser verification',brief:'Observe supplied context, then wait.',environment:env.id,personas:[p.id]});
  const runs=await app.get('/records?kind=run&scope='+work.id);const run=runs.items[0].id;
  for(let i=0;i<20;i++){const job=await app.op('exec',{command:`python3 -u -c "import time; [(print('job ${i} active', flush=True),time.sleep(1)) for _ in range(600)]"`,background:true},p.id,run);jobs.push(job.job);}
  const request=await app.op('request.create',{purpose:'Provide a factual test response',instructions:'Return an observation and an original attachment.',evidence_required:'Original evidence with a factual account. Synthetic browser test only.',artifacts:[]},p.id,run);
  const small=join(root,'preview.txt');writeFileSync(small,'A freshly created artifact for bounded browser viewing.\n');const artifact=await app.op('artifact.publish',{path:small,name:'preview.txt',media_type:'text/plain'});
  const previewImage=join(root,'preview.png');
  const pngCode=String.raw`import sys,struct,zlib; w=h=128; chunk=lambda t,d:struct.pack('!I',len(d))+t+d+struct.pack('!I',zlib.crc32(t+d)); rows=b''.join(b'\x00'+b''.join(bytes((x*2,y*2,90)) for x in range(w)) for y in range(h)); open(sys.argv[1],'wb').write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b''))`;
  execFileSync('python3',['-c',pngCode,previewImage]);
  const imageArtifact=await app.op('artifact.publish',{path:previewImage,name:'preview.png',media_type:'image/png'});
  await app.op('submit',{summary:'A fixture artifact for viewer and download verification.',artifacts:[artifact.id,imageArtifact.id],documents:[]},p.id,run);
  const large=join(root,'slow-artifact.bin');const fd=openSync(large,'w');ftruncateSync(fd,64*1024*1024);closeSync(fd);
  const remote=await peer.op('artifact.publish',{path:large,name:'slow-artifact.bin',media_type:'application/octet-stream'});
  const [network,remoteNetwork]=await Promise.all([app.get('/network'),peer.get('/network')]);
  const remotePort=remoteNetwork.addresses[0].match(/\/tcp\/(\d+)/)[1];
  proxy=spawn('python3',[join(runtime,'integtest/slow_peer.py'),remotePort],{stdio:['ignore','pipe','ignore']});
  const proxyPort=await new Promise((resolve,reject)=>{proxy.stdout.once('data',d=>resolve(String(d).trim()));proxy.once('error',reject);});
  await app.op('peer.connect',{address:`/ip4/127.0.0.1/tcp/${proxyPort}/p2p/${remoteNetwork.id}`});
  await peer.op('peer.connect',{address:`/ip4/127.0.0.1/tcp/${await freePort()}/p2p/${network.id}`}); // Retain trust; the established relay connection carries traffic.
  let transfer;
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1360,height:900}});const page=await context.newPage();observedPage=page;
  await page.addInitScript(()=>{const values=new Set();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=value=>{const url=create(value);values.add(url);return url;};URL.revokeObjectURL=url=>{values.delete(url);revoke(url);};Object.defineProperty(window,'livePreviewURLs',{get:()=>values.size});});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);pageErrors.push(e.message)});const active=new Map();page.on('request',r=>active.set(r,r.url()));page.on('requestfinished',r=>active.delete(r));page.on('requestfailed',r=>active.delete(r));
  await page.goto(app.url);await page.getByLabel('Node token').fill(app.token);await page.getByRole('button',{name:'Connect to node',exact:true}).click();
  await page.getByRole('button',{name:'Active browser verification',exact:true}).waitFor();
  await page.getByRole('button',{name:'Provide a factual test response',exact:true}).click();await page.getByLabel('Your response').fill('Synthetic observer reply; this is not physical measurement evidence.');
  await page.getByLabel('Attach evidence').setInputFiles(small);await page.getByText('File attached',{exact:false}).waitFor();await page.getByRole('button',{name:'Send response',exact:true}).click();await page.getByRole('status').getByText('Response delivered to the owner.').waitFor();
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  const replies=await app.get('/records?kind=response&scope='+request.id);assert.equal(replies.items.length,1);assert.equal((await app.get('/records/'+request.id)).data.status,'answered');
  // Exercise UI creation using a deterministic provider; these are not live model claims.
  await page.getByRole('button',{name:'Personas',exact:true}).click();await page.getByRole('button',{name:'+ New persona',exact:true}).click();
  await page.getByLabel('Starting model').selectOption({label:'fixture / Protocol fixture'});await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('button',{name:'Unnamed persona',exact:true}).waitFor();
  await page.getByRole('button',{name:'Network',exact:true}).click();await page.getByRole('button',{name:'+ Connect or receive',exact:true}).click();
  await page.getByLabel('Or shared artifact details').fill(JSON.stringify({peer:remoteNetwork.id,address:`/ip4/127.0.0.1/tcp/${proxyPort}/p2p/${remoteNetwork.id}`,artifact:remote.id,digest:remote.data.digest,size:remote.data.size,name:'slow-artifact.bin'}));await page.getByRole('button',{name:'Create',exact:true}).click();
  await page.getByRole('button',{name:'slow-artifact.bin',exact:true}).waitFor();transfer=(await app.get('/records?kind=transfer')).items[0];
  await page.getByRole('button',{name:'Work',exact:true}).click();
  const cdp=await context.newCDPSession(page);
  const gc=async()=>{await cdp.send('HeapProfiler.collectGarbage');await delay(80);return (await cdp.send('Runtime.getHeapUsage')).usedSize;};
  // Warm the actual lazy modules before measuring retained heap.
  async function view(){await page.getByRole('button',{name:'Active browser verification',exact:true}).click();await page.getByRole('button',{name:'Submissions',exact:true}).click();await page.getByRole('button',{name:/Submitted version/}).first().click();await page.getByRole('button',{name:/Open attachment/}).first().click();await page.getByText('A freshly created artifact for bounded browser viewing.',{exact:false}).waitFor();await page.getByRole('button',{name:'Close viewer',exact:true}).click();await page.getByRole('button',{name:/Open attachment/}).last().click();await page.locator('.artifact-image').waitFor();await page.waitForFunction(()=>document.querySelector('.artifact-image')?.naturalWidth===128);await page.getByRole('button',{name:'Close viewer',exact:true}).click();await page.getByRole('button',{name:'Close details',exact:true}).click();}
  await view();const baseline=await gc();const baselineDOM=await cdp.send('Memory.getDOMCounters');const timings=[];const firstPages=[];
  for(let cycle=0;cycle<cycles;cycle++){
    const before=performance.now();await page.getByRole('button',{name:'Learning',exact:true}).click();await page.getByRole('heading',{name:'Learning',exact:true}).waitFor();await page.evaluate(()=>new Promise(requestAnimationFrame));timings.push(performance.now()-before);
    await page.getByRole('button',{name:/Synthetic record/}).first().waitFor();firstPages.push(performance.now()-before);
    await page.getByRole('button',{name:'Work',exact:true}).click();await page.getByRole('button',{name:'Active browser verification',exact:true}).waitFor();await view();
    if(cycle%20===0)console.log(`Browser cycles ${cycle}/${cycles}`);
  }
  const retained=await gc();const dom=await cdp.send('Memory.getDOMCounters');
  await page.getByRole('button',{name:'Network',exact:true}).click();await page.getByText('slow-artifact.bin',{exact:true}).first().waitFor();
  const progressing=await app.get('/records/'+transfer.id);assert.equal(progressing.data.status,'running');assert(progressing.data.bytes>0);assert(progressing.data.bytes<progressing.data.total);
  await page.screenshot({path:join(evidence,'desktop-network.png'),fullPage:true});await page.getByRole('button',{name:'Cancel transfer',exact:true}).click();
  for(let i=0;i<100;i++){if((await app.get('/records/'+transfer.id)).data.status==='cancelled')break;await delay(100);}
  assert.equal((await app.get('/records/'+transfer.id)).data.status,'cancelled');
  writeFileSync(join(evidence,'desktop-measurements.json'),JSON.stringify({cycles,timings,firstPages,baseline,retained,baselineDOM,dom,pageErrors:errors},null,2));
  await page.setViewportSize({width:390,height:844});for(const name of ['Work','Personas','Environments','Learning','Network']){await page.getByRole('button',{name,exact:true}).click();await delay(120);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow on '+name);}
  await page.screenshot({path:join(evidence,'mobile-network.png'),fullPage:true});
  await page.getByRole('button',{name:'Work',exact:true}).click();await delay(500);const openRequests=[...active.values()];assert.equal(await page.evaluate(()=>window.livePreviewURLs),0,'preview URLs were retained');assert.equal(openRequests.filter(x=>x.includes('/api/events')).length,1);assert(!openRequests.some(x=>/\/api\/(artifacts|calls)\//.test(x)),'viewer resources remain active');
  const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*p)-1];
  const report={scope:'Artificial load and real browser/public API behavior; no live persona competence claim',machine:{platform:platform(),release:release(),cpus:cpus().length,cpu:cpus()[0].model,memory:totalmem()},load:{records:10000,events:100000,jobs:20,peerBytes:remote.data.size,relayDelayMsPer8192Bytes:40},cycles,navigationP95Ms:percentile(timings,.95),firstPageP95Ms:percentile(firstPages,.95),firstPageMaxMs:Math.max(...firstPages),heapBaseline:baseline,heapAfter:retained,retainedBytes:retained-baseline,baselineDOM,dom,activeRequests:openRequests.map(x=>new URL(x).pathname),pageErrors:errors,transferBytes:progressing.data.bytes,timings,firstPages};
  writeFileSync(join(evidence,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,timings:undefined,firstPages:undefined}));
  assert(report.navigationP95Ms<250,'navigation p95 exceeds 250ms');assert(report.firstPageP95Ms<1000,'first-page p95 exceeds 1s');assert(report.retainedBytes<=5*1024*1024,'retained heap exceeds baseline + 5MB');assert.deepEqual(errors,[]);
  await context.close();
  const tracked=await app.get('/actions?scope='+run+'&limit=100');assert.equal(tracked.items.filter(a=>a.request.kind==='exec'&&a.state==='running').length,20,'browser closure cancelled work');
}catch(error){
  if(observedPage){await observedPage.screenshot({path:join(evidence,'failure.png'),fullPage:true}).catch(()=>{});writeFileSync(join(evidence,'failure.json'),JSON.stringify({error:String(error),body:await observedPage.locator('body').innerText().catch(()=>''),pageErrors},null,2));}
  throw error;
}finally{
  if(browser)await browser.close();if(app)for(const job of jobs)try{await app.op('job.cancel',{id:job});}catch{}
  proxy?.kill('SIGTERM');for(const server of servers)server.kill('SIGTERM');
  console.log('Browser evidence: '+evidence);
}
