import assert from 'node:assert/strict';
import test from 'node:test';
import {VerifiedImageMounts} from '../assets/verified-image-mounts.mjs';

test('off-screen or removed environment images release bytes and object URLs',async()=>{
  let visible, mutation;
  const requests=[],revoked=[],children=[];
  const target={dataset:{verifiedImage:JSON.stringify({url:'https://node/image',hash:'sha256:'+'a'.repeat(64),size:3,alt:'Selected scene'})},
    replaceChildren(...items){children.splice(0,children.length,...items);},querySelector(){return children[0];}};
  let mounted=true;
  const root={querySelectorAll:()=>mounted?[target]:[]};
  const images=new VerifiedImageMounts((url,hash,options)=>new Promise(resolve=>requests.push({url,hash,options,resolve})),{
    IntersectionObserver:class{constructor(callback){visible=callback;}observe(){}unobserve(){}disconnect(){}},
    MutationObserver:class{constructor(callback){mutation=callback;}observe(){}disconnect(){}},
    url:{createObjectURL:()=> 'blob:verified',revokeObjectURL:url=>revoked.push(url)},document:{createElement:()=>({})},
  });
  images.sync(root);assert.equal(requests.length,0);
  visible([{target,isIntersecting:true}]);assert.equal(requests.length,1);
  requests[0].resolve({ok:true,size:3,blob:new Blob(['abc'])});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(children[0].src,'blob:verified');assert.equal(children[0].alt,'Selected scene');
  visible([{target,isIntersecting:false}]);assert.deepEqual(revoked,['blob:verified']);assert.equal(children.length,0);
  visible([{target,isIntersecting:true}]);assert.equal(requests.length,2);
  mounted=false;mutation();assert.equal(requests[1].options.signal.aborted,true);assert.equal(images.mounts.size,0);
  requests[1].resolve({ok:true,size:3,blob:new Blob(['abc'])});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(children.length,0);images.dispose();
});
