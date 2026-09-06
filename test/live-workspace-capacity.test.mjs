import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const assetRoot=process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/',import.meta.url));
const {sanitizeLiveArtifactSnapshot,transitionLiveArtifacts}=await import(
  pathToFileURL(resolve(assetRoot,'live-artifacts.mjs')));
const {responseByteLengthWithinLimit}=await import(pathToFileURL(resolve(assetRoot,'network-view.mjs')));

function file(index){
  return {workspace_id:`ws-${index%137}`,path:`file-${index}.bin`,
    sha256:'a'.repeat(64),size_bytes:index===612?513*1024*1024:1,
    body_url:`/runs/run/live-artifacts/body/ws-${index%137}/file-${index}.bin?sha256=${'a'.repeat(64)}`};
}

test('verified snapshot projection retains all files, workspaces, calls and large file metadata',()=>{
  const snapshot={schema:'personaos-live-artifacts/1',run:'run',revision:'current',
    files:Array.from({length:613},(_,index)=>file(index)),
    workspaces:Array.from({length:137},(_,index)=>({workspace_id:`ws-${index}`})),
    active:{calls:Array.from({length:139},(_,index)=>({call_id:`call-${index}`}))},
    limits:{max_files:null,max_file_bytes:null,max_total_bytes:null}};
  const clean=sanitizeLiveArtifactSnapshot(snapshot);
  assert.equal(clean.files.length,613);
  assert.equal(clean.workspaces.length,137);
  assert.equal(clean.active.calls.length,139);
  assert.equal(clean.truncated,false);
  const state=transitionLiveArtifacts(null,snapshot);
  assert.equal(state.files.size,613);
  assert.equal([...state.files.values()].at(-1).size_bytes,513*1024*1024);
});

test('deep valid paths survive while traversal, invalid sizes and missing hashes remain omitted',()=>{
  const deep=Array.from({length:45},(_,index)=>`directory-${index}`).join('/')+'/result.bin';
  const files=[{...file(0),path:deep,body_url:'/runs/run/live-artifacts/body/ws-0/'+deep+'?sha256='+'a'.repeat(64)},
    {...file(1),path:'../secret'}, {...file(2),size_bytes:-1}, {...file(3),sha256:''}];
  const clean=sanitizeLiveArtifactSnapshot({files});
  assert.deepEqual(clean.files.map(row=>row.path),[deep]);
  assert.equal(clean.omitted_file_count,3);
  assert.equal(clean.truncated,true);
});

test('complete public body reads honor the advertised size without the former preview limit',async()=>{
  const source=readFileSync(resolve(assetRoot,'discovery.js'),'utf8');
  const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  const bytes=new Uint8Array(65*1024*1024); bytes[0]=1; bytes[bytes.length-1]=2;
  const digest=value=>createHash('sha256').update(value).digest('hex'), hash=digest(bytes);
  const state={verifiedArtifactBodies:new Map(),verifiedArtifactBodyJobs:new Map(),verifiedArtifactBodyBytes:0};
  const values={S:state,URL,Blob,AbortController,TextDecoder,Uint8Array,
    location:{href:'https://node.test/'},responseByteLengthWithinLimit,fmtBytes:n=>`${n} B`,
    LIVE_ARTIFACT_LIMITS:{maxBodyCacheBytes:16*1024*1024},isHttp:()=>true,P2P:null,
    secureFetchInit:(_url,init)=>init,sha256Hex:async value=>digest(value),
    fetch:async()=>new Response(bytes,{headers:{'Content-Length':String(bytes.length)}}),
    settleBeforeAbort:promise=>promise};
  const api=new Function(...Object.keys(values),
    section('async function readBoundedResponseBytes(', 'function _downloadName(')
    +section('async function fetchVerifiedLiveBody(', 'const fmtBytes=')
    +'\nreturn {body:fetchVerifiedLiveBody,read:readBoundedResponseBytes};')(...Object.values(values));
  const result=await api.body('https://node.test/file',hash,{maxBytes:bytes.length});
  assert.equal(result.ok,true); assert.equal(result.size,bytes.length);
  assert.equal(digest(result.bytes),hash);
  assert.equal(state.verifiedArtifactBodyBytes,0,'a large complete read need not remain in the memory cache');
  const refused=await api.body('https://node.test/file',hash,{maxBytes:bytes.length-1});
  assert.equal(refused.ok,false);
  const complete=await api.read(new Response(bytes));
  assert.equal(complete.length,bytes.length);
});
