import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assets=process.env.UI_PRESENTATION_ASSETS||fileURLToPath(new URL('../assets/',import.meta.url));
const source=readFileSync(resolve(assets,'discovery.js'),'utf8');
const start=source.indexOf('async function readBoundedResponseBytes(');
const end=source.indexOf('function _downloadName(',start);
assert.ok(start>=0&&end>start);
const {responseByteLengthWithinLimit}=await import(pathToFileURL(resolve(assets,'network-view.mjs')));
const read=new Function('responseByteLengthWithinLimit','fmtBytes',source.slice(start,end)
  +'\nreturn readBoundedResponseBytes;')(responseByteLengthWithinLimit,value=>`${value} B`);

function body({declared=null,chunks=[new Uint8Array([1,2])],cancelResult=()=>{},closed=false}={}){
  const events=[];
  const stream=new ReadableStream({
    start(controller){for(const chunk of chunks)controller.enqueue(chunk);if(closed)controller.close();},
    cancel(){events.push('cancel');return cancelResult();},
  });
  const response=new Response(stream,{headers:declared===null?{}:{'Content-Length':String(declared)}});
  return {events,response,stream};
}

test('a declared oversized body is cancelled without beginning a read',async()=>{
  const state=body({declared:5});let progress=0;
  await assert.rejects(read(state.response,4,()=>progress++),/body exceeds 4 B/);
  assert.deepEqual(state.events,['cancel']);assert.equal(progress,0);
  assert.equal(state.stream.locked,false);
});

for(const at of ['initial','chunk'])test(`a ${at} progress failure cancels and unlocks its body`,async()=>{
  const state=body(), original=new Error('display unavailable');
  await assert.rejects(read(state.response,4,bytes=>{
    if(at==='initial'||bytes>0)throw original;
  }),error=>error===original);
  assert.deepEqual(state.events,['cancel']);assert.equal(state.stream.locked,false);
});

test('streamed overflow cancels once and preserves the byte-limit error',async()=>{
  const state=body({chunks:[new Uint8Array([1,2,3,4,5])]});
  await assert.rejects(read(state.response,4),/body exceeds 4 B/);
  assert.deepEqual(state.events,['cancel']);assert.equal(state.stream.locked,false);
});

for(const cleanup of ['reject','pending'])test(`a ${cleanup} cancellation cannot mask or stall the read failure`,async()=>{
  const state=body({chunks:[new Uint8Array(5)],cancelResult:()=>cleanup==='reject'
    ?Promise.reject(new Error('cleanup unavailable')):new Promise(()=>{})});
  let timer;
  try{
    const outcome=await Promise.race([
      read(state.response,4).then(()=>({passed:true}),error=>({error:error.message})),
      new Promise(resolve=>{timer=setTimeout(()=>resolve({stalled:true}),100);}),
    ]);
    assert.deepEqual(outcome,{error:'body exceeds 4 B client limit'});
    assert.deepEqual(state.events,['cancel']);assert.equal(state.stream.locked,false);
  }finally{clearTimeout(timer);}
});

test('complete reads preserve every byte and progress report without cancellation',async()=>{
  const state=body({declared:4,chunks:[new Uint8Array([1,2]),new Uint8Array([3,4])],closed:true});
  const progress=[];
  assert.deepEqual(await read(state.response,4,(...values)=>progress.push(values)),new Uint8Array([1,2,3,4]));
  assert.deepEqual(progress,[[0,4],[2,4],[4,4]]);
  assert.deepEqual(state.events,[]);assert.equal(state.stream.locked,false);
});

test('a rejected read preserves the source error and releases its reader',async()=>{
  const original=new Error('source unavailable'),events=[];
  const reader={read:async()=>{throw original;},cancel:async()=>{events.push('cancel');},
    releaseLock(){events.push('release');}};
  await assert.rejects(read({headers:new Headers(),body:{getReader:()=>reader}},4),error=>error===original);
  assert.deepEqual(events,['cancel','release']);
});

test('the arrayBuffer fallback still enforces the observed byte limit',async()=>{
  const response={headers:new Headers(),arrayBuffer:async()=>new Uint8Array([1,2]).buffer};
  assert.deepEqual(await read(response,2),new Uint8Array([1,2]));
  await assert.rejects(read(response,1),/body exceeds 1 B/);
});
