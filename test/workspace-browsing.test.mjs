import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {browseLimit,browseMoreHTML} from '../assets/workspace-state.mjs';
import {selectPriorityWindow} from '../assets/network-view.mjs';
const source=readFileSync(new URL('../assets/discovery.js',import.meta.url),'utf8');
const section=(start,end)=>{const first=source.indexOf(start),last=source.indexOf(end,first+start.length);
  assert.ok(first>=0&&last>first);return source.slice(first,last);};
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function fixture(){
  const elements=new Map();
  const $=selector=>{
    if(!elements.has(selector)) elements.set(selector,{dataset:{},innerHTML:'',textContent:'',hidden:false,
      replaceChildren(){this.innerHTML='';},classList:{toggle(){}},setAttribute(){}});
    return elements.get(selector);
  };
  const cards=Array.from({length:81},(_,i)=>({key:'task-'+String(i).padStart(3,'0'),
    recId:'record-'+i,task:'Work item '+i,state:'quiescent',meta:[],nodeAvailability:'online'}));
  const S={q:'',kernelFocus:null,globalKernels:new Map(),openInputDirectories:new Map()};
  let click;
  const values={S,$,esc,browseLimit,browseMoreHTML,selectPriorityWindow,
    missionCardList:()=>cards,missionCardIsObservedCurrent:()=>false,humanizeMachineKey:String,
    icon:()=>'',updateStageHTML:(host,html)=>{host.innerHTML=html;host.dataset.h=html;},
    replaceStageHTML:(host,html)=>{host.innerHTML=html;host.dataset.h=html;},
    document:{body:{dataset:{view:'work'}},addEventListener:(_kind,fn)=>{click=fn;}},
    NETWORK_LIMITS:{kernelChips:10},kernelActivity:()=>0,_kernelDisplayContext:kid=>({label:kid,detail:kid}),compactCount:String,
    _openInputPersonaName:(_kernel,id)=>id,_ago:()=>'',canon:JSON.stringify,copyBtn:()=>'',_openInputCandidateRows:()=>'',
  };
  const declarations=section('function renderMissions(){','/* ---------- wiring ---------- */')
    +section('function renderGlobalKernels(){','// A bare hosted URL')
    +section('function renderOpenInputs(){','async function refreshVisibleOpenInputs()')
    +section('function wire(){','  // Design-system nav family:')+'}\nwire();return {renderMissions,renderGlobalKernels,renderOpenInputs};';
  const api=new Function(...Object.keys(values),declarations)(...Object.values(values));
  const expand=kind=>{
    const host=$(kind==='tasks'?'#missionCards':kind==='requests'?'#openInputCards':'#moreNodes');
    const next=host.innerHTML.match(/data-next-limit="(\d+)"/);assert.ok(next,'Expected another page');
    click({target:{closest:()=>({dataset:{moreRecords:kind,nextLimit:next[1]}})}});
  };
  return {S,$,cards,...api,expand};
}
test('task browsing reaches every admitted record, retains its window on refresh, and resets for search',()=>{
  const f=fixture();f.renderMissions();
  const count=()=>[...f.$('#missionCards').innerHTML.matchAll(/data-mrec=/g)].length;
  assert.equal(count(),24);assert.match(f.$('#missionCount').textContent,/24 shown · 81 matching/);
  for(const expected of [48,72,81]){f.expand('tasks');assert.equal(count(),expected);f.renderMissions();assert.equal(count(),expected);}
  assert.doesNotMatch(f.$('#missionCards').innerHTML,/data-more-records/);
  f.S.q='Work item 80';f.renderMissions();assert.equal(count(),1);assert.match(f.$('#missionCards').innerHTML,/record-80/);
  f.S.q='';f.renderMissions();assert.equal(count(),24);
  f.expand('tasks');f.S.kernelFocus='another-node';f.renderMissions();assert.equal(count(),24);
});
test('all known nodes remain browsable beyond the original ten chips',()=>{
  const f=fixture();
  for(let i=0;i<31;i++) f.S.globalKernels.set('node-'+String(i).padStart(2,'0'),{
    lastSeen:Date.now(),via:new Set(['http']),bases:new Set(['https://node-'+i+'.test']),meta:{reachable:true}});
  const count=()=>[...f.$('#globalKernels').innerHTML.matchAll(/data-kernel=/g)].length;
  f.renderGlobalKernels();assert.equal(count(),10);
  for(const expected of [20,30,31]){f.expand('nodes');assert.equal(count(),expected);}
  assert.equal(f.$('#moreNodes').innerHTML,'');
  const previous=f.S.globalKernels;f.S.globalKernels=new Map();f.renderGlobalKernels();assert.equal(count(),0);
  f.S.globalKernels=previous;f.renderGlobalKernels();assert.equal(count(),31);
  f.S.q='node-30';f.renderGlobalKernels();assert.equal(count(),10);
  assert.match(f.$('#globalKernels').innerHTML.match(/data-kernel="([^"]+)"/)[1],/^node-30$/);
});
test('published input requests beyond the initial 48 remain reachable and use exact identity keys',()=>{
  const f=fixture();
  const requests=Array.from({length:101},(_,i)=>({status:'open',request:{request_id:'request-'+i,
    title:'Question '+i,question:'Question text',created_at:'2026-09-13T00:00:00Z',author_persona_id:'person',
    acceptance_criteria:{},response_schema:{}}}));
  f.S.openInputDirectories.set('node',{kernelId:'node',receivedAt:Date.now(),record:{requests}});
  const count=()=>[...f.$('#openInputCards').innerHTML.matchAll(/class="input-request-card/g)].length;
  f.renderOpenInputs();assert.equal(count(),48);
  f.expand('requests');assert.equal(count(),96);
  f.expand('requests');assert.equal(count(),101);
  assert.match(f.$('#openInputCards').innerHTML,/data-stage-key="\[&quot;node&quot;,&quot;request-100&quot;\]"/);
  f.S.q='Question 100';f.renderOpenInputs();assert.equal(count(),1);
});
test('persona search includes verified descriptions and authored aliases while withholding unverified profile fields',()=>{
  let verified=true;
  const values={S:{liveByPersona:new Map()},_personaRef:()=>({key:'node:alice',sid:'alice',kernel:'node'}),
    runtimeForPersona:()=>({}),_nameFor:()=> 'Alice',
    providerVerifiedPersonaObservation:()=>({identityVerified:verified,record:{description:'A ceramic material specialist',
      persona_card:{card:{display_name_alias:{display_name:'Potter'},self_publication:{body:'Studies glazes'}}}}}),
    _personaCharacteristicValue:value=>String(value||'')};
  const search=new Function(...Object.keys(values),section('  const _personaSearch=','  // first-seen deliverable')+'return _personaSearch;')(...Object.values(values));
  assert.match(search('alice'),/ceramic material specialist/);assert.match(search('alice'),/Potter/);assert.match(search('alice'),/Studies glazes/);
  verified=false;assert.doesNotMatch(search('alice'),/ceramic|Potter|glazes/);
});
