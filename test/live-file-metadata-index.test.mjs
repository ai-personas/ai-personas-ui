// Renderer inputs below represent already-admitted signed records. Signature
// admission and downloaded-byte verification remain separate boundaries.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assetRoot=process.env.UI_PRESENTATION_ASSETS
  ||fileURLToPath(new URL('../assets/',import.meta.url));
const source=readFileSync(resolve(assetRoot,'discovery.js'),'utf8');
const {environmentIdentity,resolveEnvironmentAuthority}=await import(pathToFileURL(resolve(assetRoot,'routing-authority.mjs')));
const {selectArtifactRenderer}=await import(pathToFileURL(resolve(assetRoot,'artifact-types.mjs')));
const {artifactSemanticLabels}=await import(pathToFileURL(resolve(assetRoot,'live-artifacts.mjs')));
const section=(start,end)=>{
  const first=source.indexOf(start),last=source.indexOf(end,first+start.length);
  assert.ok(first>=0&&last>first,`Missing renderer declarations: ${start}`);
  return source.slice(first,last);
};
const declarations=section('function declaredArtifactMedia(','function artifactMediaPresentation(')
  +section('function authoredArtifactLabels(','function artifactDeclarationAttr(')
  +section('function _exactSha256Digest(','function _artifactPreviewActionHTML(');
const scope={kernel:'kernel-a',run:'run-ABC123',environmentId:'room-a',workspaceId:'workspace-a'};
const digest=n=>n.toString(16).padStart(64,'0');
const record=(n=1)=>({
  record_id:`record-${n}`,kind:'artifact',_kernel:scope.kernel,environment_id:scope.environmentId,
  _links:{content:`k/${scope.run}/artifacts/package/files/file-${n}.md`,
    content_hash:`sha256:${digest(n)}`,mime_type:'text/markdown',artifact_roles:['authored report']},
  artifact_declaration:{title:`Authored file ${n}`,declaring_persona_id:'alice'},
});
const file=(n=1)=>({workspace_id:scope.workspaceId,environment_id:`env:${scope.environmentId}`,
  path:`files/file-${n}.md`,sha256:digest(n),size_bytes:100});
function fixture(records=[record()]){
  const S={order:records.map(row=>row.record_id),recs:new Map(records.map(row=>[row.record_id,row]))};
  let projections=0;
  const api=new Function('S','environmentIdentity','environmentAuthorityOfRecord','selectArtifactRenderer','artifactSemanticLabels',
    declarations+';return {index:_signedArtifactWorkspaceIndex,metadata:_liveFileSignedArtifactMetadata};')(
    S,environmentIdentity,row=>{projections++;return resolveEnvironmentAuthority(row,row._links,{verified:true});},
    selectArtifactRenderer,artifactSemanticLabels);
  return {...api,S,projections:()=>projections};
}

test('indexed metadata retains the exact signed file binding and declaration',()=>{
  const ui=fixture(),index=ui.index(),metadata=ui.metadata(file(),scope,index);
  assert.equal(metadata.mimeType,'text/markdown');
  assert.deepEqual(metadata.authoredLabels,['authored report']);
  assert.equal(metadata.declaration.title,'Authored file 1');
  assert.equal(metadata.declaration.declaring_persona_id,'alice');
  assert.equal(metadata.recordId,'record-1');
  assert.ok(Object.isFrozen(metadata));
  assert.deepEqual(ui.metadata(file(),scope),metadata);
  for(const [field,value] of Object.entries({kernel:'kernel-b',run:'run-OTHER',environmentId:'room-b',workspaceId:'workspace-b'}))
    assert.equal(ui.metadata(file(),{...scope,[field]:value},index),null,field);
  for(const [field,value] of Object.entries({workspace_id:'workspace-b',environment_id:'env:room-b',path:'files/other.md',sha256:digest(99)}))
    assert.equal(ui.metadata({...file(),[field]:value},scope,index),null,field);
  assert.equal(ui.metadata({...file(),sha256:'invalid'},scope,index),null);
});

test('ambiguous duplicate witnesses remain refused until a later render sees their withdrawal',()=>{
  const first=record(),second={...record(),record_id:'second'},third={...record(),record_id:'third'};
  const ui=fixture([first,second,third]);
  assert.equal(ui.metadata(file(),scope,ui.index()),null);
  ui.S.recs.delete('second');
  assert.equal(ui.metadata(file(),scope,ui.index()),null);
  ui.S.recs.delete('third');
  assert.equal(ui.metadata(file(),scope,ui.index()).recordId,'record-1');
  // Stale order entries and a duplicate pointer to the same record must not
  // silently manufacture a second unique authority decision.
  ui.S.order.push('record-1');
  assert.equal(ui.metadata(file(),scope,ui.index()),null);
});

test('each render reflects deletion, replacement and changed signed metadata',()=>{
  const ui=fixture();
  assert.equal(ui.metadata(file(),scope,ui.index()).mimeType,'text/markdown');
  ui.S.recs.delete('record-1');
  assert.equal(ui.metadata(file(),scope),null,'opening a file rechecks current authority');
  assert.equal(ui.metadata(file(),scope,ui.index()),null);
  const replacement=record();replacement._links.mime_type='application/json';
  ui.S.recs.set('record-1',replacement);
  assert.equal(ui.metadata(file(),scope).mimeType,'application/json');
  assert.equal(ui.metadata(file(),scope,ui.index()).mimeType,'application/json');
  replacement._links.content_hash=`sha256:${digest(2)}`;
  assert.equal(ui.metadata(file(),scope,ui.index()),null);
  assert.equal(ui.metadata({...file(),sha256:digest(2)},scope,ui.index()).recordId,'record-1');
  ui.S.order=[];
  assert.equal(ui.metadata({...file(),sha256:digest(2)},scope,ui.index()),null);
});

test('indexing preserves invalid route, hash and environment refusals',()=>{
  for(const mutate of [
    row=>{row._links.content=`k/${scope.run}/artifacts/files/file-1.md`;},
    row=>{row._links.content_hash='sha256:invalid';},
    row=>{row.content_hash=`sha256:${digest(2)}`;},
    row=>{row._links.environment_id='room-b';},
    row=>{delete row.environment_id;},
    row=>{row.kind='persona';},
  ]){
    const invalid=record();mutate(invalid);const ui=fixture([invalid]);
    assert.equal(ui.metadata(file(),scope,ui.index()),null);
  }
});

test('716 files displayed twice project 972 admitted bindings once per render',()=>{
  const ui=fixture(Array.from({length:972},(_,i)=>record(i+1))),index=ui.index();
  assert.equal(ui.projections(),972);
  for(let copy=0;copy<2;copy++)for(let n=1;n<=716;n++)
    assert.equal(ui.metadata(file(n),scope,index)?.recordId,`record-${n}`);
  assert.equal(ui.projections(),972,'file copies must reuse the render index');
  ui.S.recs.delete('record-716');
  const next=ui.index();
  assert.equal(ui.metadata(file(716),scope,next),null);
  assert.equal(ui.metadata(file(715),scope,next)?.recordId,'record-715');
  assert.equal(ui.projections(),1943,'next render reconsiders the admitted set');
});
