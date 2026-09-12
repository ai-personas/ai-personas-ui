// The selected workspace observes late signed file metadata without remounting
// the whole drawer, opening file bodies, or retaining a closed view.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const assets=process.env.UI_PRESENTATION_ASSETS||fileURLToPath(new URL('../assets/',import.meta.url));
const source=readFileSync(resolve(assets,'discovery.js'),'utf8');
function section(start,end){
  const first=source.indexOf(start),last=source.indexOf(end,first+start.length);
  assert.ok(first>=0&&last>first,start);return source.slice(first,last);
}
test('late files stay bound to the open exact workspace and disappear on withdrawal',async()=>{
  const state={liveByEnv:new Map(),order:[],recs:new Map()},host={innerHTML:''};
  let rows=[],current=true,paints=0;const cleanups=[];
  const values={S:state,esc:String,nodeBaseForRecord:()=>'',_environmentNameFor:()=> 'Workshop',
    kv:()=>'',H:()=>'',verificationIdentityDetails:()=>'',_environmentKey:(k,id)=>k+'/'+id,
    manifestArtifacts:()=>[],_envSid:()=> 'room',_artifactRevisionProjection:()=>({current:null}),
    manifestRun:()=>'',_liveWorkspaceRows:()=>rows,
    _liveWorkspacesHTML:items=>items.map(row=>row.workspaceId+':'+row.revision).join('\n'),
    _retainedVerifiedEntityFeed:()=>null,renderEnvLive:()=>'',trustPanel:()=>'',kernelRec:()=>'',
    updateStageHTML:(target,html)=>{assert.equal(target,host);paints++;host.innerHTML=html;},
  };
  const viewFor=new Function(...Object.keys(values),
    section('async function envView(', '// ---------- deliverable-bundle artifact TREE ----------')
    +'\nreturn envView;')(...Object.values(values));
  const view=await viewFor({_kernel:'node',did:'room'});
  assert.match(view.html,/data-environment-live-files/);assert.equal(paints,0);
  view.mount({querySelector:()=>host},{isCurrent:()=>current,onCleanup:fn=>cleanups.push(fn)});
  assert.equal(paints,1);
  rows=[
    {kernel:'node',environmentId:'room',run:'run',workspaceId:'ours',revision:'a'},
    {kernel:'other-node',environmentId:'room',run:'run',workspaceId:'foreign',revision:'b'},
    {kernel:'node',environmentId:'other-room',run:'run',workspaceId:'elsewhere',revision:'c'},
  ];
  const selected=state.publicEnvironmentView;
  selected.refresh();assert.equal(host.innerHTML,'ours:a');assert.equal(paints,2);
  selected.refresh();assert.equal(paints,2,'unchanged metadata does not rebuild controls');
  rows=[];selected.refresh();assert.equal(host.innerHTML,'');assert.equal(paints,3);
  current=false;cleanups.forEach(fn=>fn());assert.equal(state.publicEnvironmentView,null);
  rows=[{kernel:'node',environmentId:'room',workspaceId:'late',revision:'z'}];
  selected.refresh();assert.equal(paints,3,'closed views cannot repaint');
});
test('one file-control resolver preserves exact route and proof for stage and drawer',async()=>{
  const calls=[];
  const resolver=new Function('liveFileView','fileView','artifactSemanticsFromAttr','artifactDeclarationFromAttr',
    section('function publicFileViewFromControl(', 'function inspectionSourceControl(')
    +'\nreturn publicFileViewFromControl;')((...args)=>calls.push(['live',...args]),
      (...args)=>calls.push(['saved',...args]),value=>value||'',value=>value||'');
  const live={dataset:{liveFileBase:'https://node.test',liveFileRun:'run-A',liveFileWorkspace:'persona-A',liveFilePath:'exact file.txt'}};
  const selected=resolver({closest:selector=>selector==='[data-live-current-file]'?live:null});
  assert.equal(calls.length,0,'metadata selection never fetches a body');
  live.dataset.liveFilePath='changed.txt';await selected.view();
  assert.deepEqual(calls.pop(),['live','https://node.test','run-A','persona-A','exact file.txt']);
  const saved={dataset:{currentArtifactBase:'https://node.test',currentArtifactPath:'k/run-A/output.txt',
    currentArtifactTitle:'output.txt',currentArtifactKind:'text/plain',currentArtifactHash:'sha256:exact',currentArtifactSize:'42'},
    closest:()=>null,parentElement:null};
  const opened=resolver({closest:selector=>selector==='[data-current-artifact-path]'?saved:null});
  await opened.view();const call=calls.pop();
  assert.deepEqual(call.slice(0,5),['saved','https://node.test','k/run-A/output.txt','output.txt','text/plain']);
  assert.equal(call[5].contentHash,'sha256:exact');assert.equal(call[5].size,42);
});
