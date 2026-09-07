// The real-node browser case checks signatures and file integrity. These tests
// check that asynchronous source verification cannot turn a cache or key change
// into a new automatic probe, and that no historical inventory is required.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const assets=process.env.UI_PRESENTATION_ASSETS
  ||fileURLToPath(new URL('../assets/',import.meta.url));
const source=readFileSync(resolve(assets,'discovery.js'),'utf8');
const first=source.indexOf('async function _verifiedPublicEnvironmentRunTargets(){');
const last=source.indexOf('async function pollLiveArtifacts(){',first);
assert.ok(first>=0&&last>first);
function fixture(verify=async()=>true){
  const S={entFeed:new Map(),keyDocs:new Map(),kernelFocus:''},calls=[];
  const api=new Function('S','isEnvironmentTelemetryDocument','verifyPublicEntityDocument',
    source.slice(first,last)+'\nreturn _verifiedPublicEnvironmentRunTargets;')(
    S,doc=>doc?.schema==='personaos-environment-telemetry-public/2',
    async(base,rel,doc)=>{calls.push({base,rel,doc});return verify(base,rel,doc);});
  function feed(base,kernel,values){
    const doc={schema:'personaos-environment-telemetry-public/2',node_id:kernel,
      environment_id:'env:room',...values};
    const key=`${base||'@origin'}|telemetry/environments/room.json`;
    S.entFeed.set(key,{v:doc,ts:Date.now()});
    S.keyDocs.set(base||'@origin',{kernelId:kernel});
    return {key,doc};
  }
  return {S,calls,feed,targets:api};
}
test('current environment progress starts exact run reads without a full inventory',async()=>{
  const f=fixture();f.feed('libp2p://peer','kernel:one',{
    run_progress:[{run:'run-current'},{run:'run-settled'}],
    run_budgets:[{run:'run-old'}]});
  assert.deepEqual(await f.targets(),[
    {base:'libp2p://peer',run:'run-current',kernel:'kernel:one'},
    {base:'libp2p://peer',run:'run-settled',kernel:'kernel:one'}]);
  assert.equal(f.calls[0].rel,'telemetry/environments/room.json');
});
test('an older signed environment projection supplies only its latest retained run',async()=>{
  const f=fixture();f.feed('','kernel:one',{run_budgets:[{run:'run-old'},{run:'run-latest'}]});
  assert.deepEqual(await f.targets(),[{base:'',run:'run-latest',kernel:'kernel:one'}]);
});
test('a refused source and an unfocused kernel never start a run read',async()=>{
  const f=fixture(async()=>false);f.feed('https://one','kernel:one',{run_progress:[{run:'run-one'}]});
  f.feed('https://two','kernel:two',{run_progress:[{run:'run-two'}]});
  f.S.kernelFocus='kernel:one';assert.deepEqual(await f.targets(),[]);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].base,'https://one');
});
for(const change of ['source','key']) test(`a ${change} change during verification prevents a stale probe`,async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve;});
  const f=fixture(()=>pending),{key}=f.feed('https://one','kernel:one',{run_progress:[{run:'run-one'}]});
  const result=f.targets();assert.equal(f.calls.length,1);
  if(change==='source')f.S.entFeed.delete(key);
  else f.S.keyDocs.set('https://one',{kernelId:'kernel:one',rotation:'new'});
  release(true);assert.deepEqual(await result,[]);
});
