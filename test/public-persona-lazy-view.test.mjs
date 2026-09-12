// Full history belongs to the selected drawer, not a grid-wide poller.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const assets=process.env.UI_PRESENTATION_ASSETS||fileURLToPath(new URL('../assets/',import.meta.url));
const source=readFileSync(resolve(assets,'discovery.js'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const esc=value=>String(value??'').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture(){
  const requests=[], timers=new Map(), listeners=new Map(), cleanups=[];
  const state={views:[],keyDocs:new Map()}, host={innerHTML:''}, controller=new AbortController();
  const document={hidden:false}; let timerId=0,current=true;
  const lifecycle={signal:controller.signal,isCurrent:()=>current,assertCurrent(){if(!current) throw new Error('closed');},
    onCleanup:fn=>cleanups.push(fn),cancel(){current=false;controller.abort();cleanups.forEach(fn=>fn());}};
  const root={querySelector:()=>host,addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:event=>listeners.delete(event)};
  const values={S:state,esc,document,setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id),
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
    nodeBaseForRecord:()=> 'https://node.test',personaIdFromDid:id=>id,_personaKey:(k,id)=>k+'/'+id,
    providerVerifiedPersonaObservation:()=>({identityVerified:true,lifecycle:{lifecycleState:'active'}}),
    _personaAuthoredNameForObservation:()=> 'Alice',_personaNameRolePresentation:name=>({name}),
    envRecordForAuthority:()=>({}),kv:(k,v)=>`<p>${k}: ${v}</p>`,H:text=>`<h4>${text}</h4>`,
    _personaCharacteristicsHTML:()=>'<p>Curious and careful</p>',authoredCapabilitiesHTML:()=>'',recLink:()=>'',
    verificationIdentityDetails:()=>'',trustPanel:()=>'',_friendlyInstant:at=>at,
    connectedActivityItems:doc=>doc.rows||[],updateStageHTML:(node,html)=>{node.innerHTML=html;},renderTop(){},
    join:(base,path)=>base+'/'+path,_signedPersonaEndpointId:key=>key.split('/').at(-1),
    DEFAULT_JSON_MAX_BYTES:4*1024*1024,PUBLIC_COGNITION_READ_PRIORITY:75,
    fetchResponsivePublicJson:(url,options)=>new Promise(resolve=>{requests.push({url,options,resolve});
      options.signal.addEventListener('abort',()=>resolve(null),{once:true});}),
    keysFor:async()=>{},verifyPublicPersonaCognition:async(_base,doc)=>doc?.valid===true,
    verifyPersonaEducation:async doc=>({ok:doc?.valid===true}),verifyPersonaExperience:async doc=>({ok:doc?.valid===true}),
    educationHtml:doc=>'<p>'+esc(doc.title)+'</p>',experienceHtml:doc=>'<p>'+esc(doc.title)+'</p>',canonicalJson:JSON.stringify,
    _comparePublicCognitionGeneratedAt:(a,b)=>Date.parse(a)-Date.parse(b),
  };
  const api=new Function(...Object.keys(values),section('async function personaView(', 'async function envView(')
    +section('function scheduleSseCognitionRefresh(', '// A verified SSE frame')+'\nreturn {view:personaView,invalidate:scheduleSseCognitionRefresh};')(...Object.values(values));
  const record={did:'alice',_kernel:'kernel:test',description:'Checks measured work.',_personaCharacteristics:{traits:['curious']}};
  return {...api,record,state,requests,timers,listeners,host,root,lifecycle,document};
}
test('the character drawer opens and mounts without a profile, status or history request',async()=>{
  const f=fixture(), view=await f.view(f.record);
  assert.match(view.html,/Curious and careful/);assert.equal(f.requests.length,0);
  await view.mount(f.root,f.lifecycle);
  assert.equal(f.requests.length,0);assert.equal(f.timers.size,0);
  f.lifecycle.cancel();assert.equal(f.listeners.size,0);
});
test('education and paged experience fetch only their chosen record after rendering the shell',async()=>{
  for(const tab of ['education','experience']){
    const f=fixture(), view=await f.view(f.record,{tab,offset:32});
    assert.match(view.html,/Loading and verifying/);assert.equal(f.requests.length,0);
    const mounted=view.mount(f.root,f.lifecycle);assert.equal(f.requests.length,1);
    assert.equal(f.requests[0].url,'https://node.test/personas/alice/'+tab+(tab==='experience'?'?offset=32&limit=32':''));
    f.requests[0].resolve({valid:true,title:'Verified selected record',next_offset:64});await mounted;
    assert.match(f.host.innerHTML,/Verified selected record/);
    if(tab==='experience') assert.match(f.host.innerHTML,/Next records/);
    f.lifecycle.cancel();assert.equal(f.timers.size,0);
  }
});
test('full responses enter the DOM only when opened and selected-view state is released',async()=>{
  const f=fixture(), view=await f.view(f.record,{tab:'activity'}), mounted=view.mount(f.root,f.lifecycle);
  const text='Measured response. '.repeat(20000), row={key:'first',kind:'Model response',label:'Luna',at:'2026-09-12T00:00:00Z',text};
  f.requests[0].resolve({valid:true,generated_at:row.at,rows:[row]});await mounted;
  assert.ok(f.host.innerHTML.length<2000);assert.match(f.host.innerHTML,/Read complete text/);
  const target={dataset:{publicActivityRecord:'first'},hasAttribute:key=>key==='data-public-activity-record'};
  const click=()=>f.listeners.get('click')({target:{closest:()=>target},preventDefault(){}});
  click();assert.ok(f.host.innerHTML.includes(text));click();assert.ok(f.host.innerHTML.length<2000);
  assert.ok(f.state.publicPersonaView);f.lifecycle.cancel();
  assert.equal(f.state.publicPersonaView,null);assert.equal(f.timers.size,0);assert.equal(f.listeners.size,0);
});
test('closing a slow view cancels its read and a late response cannot paint',async()=>{
  const f=fixture(), view=await f.view(f.record,{tab:'activity'}), mounted=view.mount(f.root,f.lifecycle);
  f.lifecycle.cancel();await mounted;
  assert.equal(f.requests[0].options.signal.aborted,true);assert.equal(f.host.innerHTML,'');
  f.requests[0].resolve({valid:true,rows:[{text:'Late private data'}]});await tick();
  assert.equal(f.host.innerHTML,'');assert.equal(f.state.publicPersonaView,null);
});
test('invalidation refreshes only the open persona, coalesces bursts, and hidden views do not poll',async()=>{
  const f=fixture(), view=await f.view(f.record,{tab:'activity'}), mounted=view.mount(f.root,f.lifecycle);
  f.requests[0].resolve({valid:true,generated_at:'2026-09-12T00:00:00Z',rows:[]});await mounted;
  f.invalidate({personaKeys:['kernel:test/bob']});assert.equal(f.timers.size,1);
  f.invalidate({personaKeys:['kernel:test/alice']});f.invalidate({personaKeys:['kernel:test/alice']});assert.equal(f.timers.size,2);
  [...f.timers.values()].at(-1)();assert.equal(f.requests.length,2);
  f.requests[1].resolve({valid:true,generated_at:'2026-09-12T00:00:01Z',rows:[]});await tick();
  f.document.hidden=true;await [...f.timers.values()][0]();assert.equal(f.requests.length,2);f.lifecycle.cancel();
});
