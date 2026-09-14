import {chromium, expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {createServer,createConnection} from 'node:net';
import {Transform} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

if(!process.argv[2])throw new Error('Usage: npm run test:network -- /path/to/installed/release');
const release=resolve(process.argv[2]);
const root=await mkdtemp('/tmp/personas-slow-peer-');
const children=[],proxies=[],sockets=new Set();let browser;
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function app(name){const node=root+'/'+name,p=await port();const child=spawn(release+'/bin/personas',['serve','--root',node,'--listen','127.0.0.1:'+p,'--ui',release+'/ui'],{stdio:'ignore'});children.push(child);let token;for(let n=0;n<100;n++){try{token=await readFile(node+'/token','utf8');if((await fetch('http://127.0.0.1:'+p+'/health')).ok)break;}catch{}await delay(50);}const base='http://127.0.0.1:'+p;const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};async function get(path){const r=await fetch(base+'/api'+path,{headers});assert(r.ok);return r.json();}async function op(kind,args){const r=await fetch(base+'/api/operations',{method:'POST',headers,body:JSON.stringify({id:crypto.randomUUID().replaceAll('-',''),kind,args})});const a=await r.json();assert(r.ok&&a.state!=='failed',JSON.stringify(a));return a.result;}return{node,child,base,token,get,op};}
async function proxy(address){const parts=address.split('/'),destination=Number(parts[4]);const server=createServer(client=>{const upstream=createConnection({host:'127.0.0.1',port:destination});sockets.add(client);sockets.add(upstream);const throttle=()=>new Transform({transform(chunk,_,next){setTimeout(()=>{this.push(chunk);next();},45);}});client.pipe(throttle()).pipe(upstream);upstream.pipe(throttle()).pipe(client);for(const s of [client,upstream]){s.on('error',()=>{});s.on('close',()=>{sockets.delete(s);client.destroy();upstream.destroy();});}});await new Promise(r=>server.listen(0,'127.0.0.1',r));proxies.push(server);parts[4]=String(server.address().port);return parts.join('/');}
try{
 const a=await app('source'),b=await app('destination');
 let na=await a.get('/network'),nb=await b.get('/network');
 const pa=await proxy(na.addresses[0]),pb=await proxy(nb.addresses[0]);
 await a.op('peer.connect',{address:pb});await b.op('peer.connect',{address:pa});
 const path=root+'/native-bytes.bin',bytes=randomBytes(8_000_000);await writeFile(path,bytes);
 const artifact=await a.op('artifact.publish',{path,name:'Slow shared native bytes.bin'});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1360,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(b.base);await page.getByLabel('Node token').fill(b.token);await page.getByRole('button',{name:'Connect to node'}).click();await page.getByRole('button',{name:'Network',exact:true}).click();await page.getByRole('button',{name:'Receive a shared artifact'}).click();
 await page.getByLabel('Shared artifact details').fill(JSON.stringify({peer:na.id,artifact:artifact.id,digest:artifact.data.digest,size:artifact.data.size,name:artifact.data.name}));await page.getByRole('button',{name:'Start transfer'}).click();
 await expect(page.locator('progress')).toBeVisible();let transfer;
 for(let n=0;n<200;n++){transfer=(await b.get('/snapshot')).records.find(r=>r.kind==='transfer');if(transfer?.data.bytes>0)break;await delay(100);}assert(transfer.data.bytes>0&&transfer.data.bytes<transfer.data.total);
 const started=performance.now();for(const name of ['Personas','Work','Learning','Environments','Network']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();}const navigationMs=performance.now()-started;assert(navigationMs<3000);
 await page.screenshot({path:root+'/slow-transfer.png',fullPage:true});await page.getByRole('button',{name:'Cancel transfer',exact:true}).click();
 for(let n=0;n<100;n++){transfer=(await b.get('/records/'+transfer.id)).record;if(transfer.data.status==='cancelled')break;await delay(50);}assert.equal(transfer.data.status,'cancelled');assert.equal((await readdir(b.node+'/transfers')).filter(n=>n.endsWith('.part')).length,0);
 assert.deepEqual(errors,[]);const result={status:'passed',transport:'actual libp2p connections through delayed TCP proxies',navigationMs,bytesBeforeCancel:transfer.data.bytes,total:transfer.data.total,partialFilesAfterCancel:0,root};await writeFile(root+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();for(const c of children)c.kill('SIGTERM');for(const s of sockets)s.destroy();for(const p of proxies)p.close();}
