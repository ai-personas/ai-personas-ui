import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const assetRoot=process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/',import.meta.url));
const source=readFileSync(resolve(assetRoot,'discovery.js'),'utf8');
const section=source.slice(source.indexOf('function _downloadName('),
  source.indexOf('function updateOpBadge('));
const bytes=Uint8Array.from({length:524288},(_,index)=>index%256);
const hash=createHash('sha256').update(bytes).digest('hex');

function downloadFixture(){
  let blob, downloaded, networkReads=0, current=true, afterHash=()=>{};
  const label={textContent:'download verified bytes'};
  const button={dataset:{url:'libp2p://peer/artifact',name:'relay.bin',hash},
    querySelector:()=>label,classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}};
  class DownloadURL extends URL {
    static createObjectURL(value){blob=value;return 'blob:verified-download';}
    static revokeObjectURL(){}
  }
  const values={
    URL:DownloadURL,location:{href:'https://portal.example/'},
    document:{body:{appendChild(){}},createElement:()=>({
      click(){downloaded={blob,name:this.download};},remove(){},
    })},
    setTimeout:()=>0,clearTimeout(){},isHttp:()=>false,
    fetchP2PArtifactBytes:async()=>{networkReads++;throw new Error('peer unavailable');},
    LIVE_ARTIFACT_LIMITS:{maxDownloadBytes:64*1024*1024},
    sha256Hex:async value=>{afterHash();return createHash('sha256').update(value).digest('hex');},
  };
  const api=new Function(...Object.keys(values),section+
    '\nreturn {download:secureDownloadFromButton,retained:_verifiedDownloadBytes};')(...Object.values(values));
  const assertCurrent=()=>{if(!current)throw new Error('view changed');};
  api.retained.set(button,{url:button.dataset.url,hash,bytes,assertCurrent});
  return {button,label,api,get downloaded(){return downloaded;},get networkReads(){return networkReads;},
    close(){current=false;},onHash(fn){afterHash=fn;}};
}

test('Download saves the preview’s complete verified bytes without contacting the peer again',async()=>{
  const f=downloadFixture();
  await f.api.download(f.button);
  assert.equal(f.networkReads,0);
  assert.equal(f.downloaded.name,'relay.bin');
  assert.equal(f.downloaded.blob.type,'application/octet-stream');
  assert.deepEqual(new Uint8Array(await f.downloaded.blob.arrayBuffer()),bytes);
  assert.equal(f.label.textContent,'verified download started');
});

test('a changed view during the hash check prevents a retained download',async()=>{
  const f=downloadFixture();
  f.onHash(()=>f.close());
  await f.api.download(f.button);
  assert.equal(f.downloaded,undefined);
  assert.equal(f.label.textContent,'view changed');
});

test('a different route cannot reuse the preview’s retained bytes',async()=>{
  const f=downloadFixture();
  f.button.dataset.url='libp2p://other/artifact';
  await f.api.download(f.button);
  assert.equal(f.networkReads,1);
  assert.equal(f.downloaded,undefined);
});
