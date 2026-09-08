import test from 'node:test';
import assert from 'node:assert/strict';
import {renderer, taskRecord} from './helpers/discovery-presentation.mjs';
import {createPublicEvidence, canonicalJson} from './helpers/public-evidence.mjs';

function setup(){
  const b=createPublicEvidence({canon:canonicalJson,now:()=>Date.parse('2026-09-08T09:00:00Z')});b.reader.enable();
  const ui=renderer(null,{_publicEvidence:b.producer});
  const row=taskRecord('run-first','task:first','env:first');row.record_id='rec:first';
  row._inventorySource='node';row._inventoryGeneration=1;row._inventoryHash='sha256:index';
  const document={record:{record_id:row.record_id,kind:'task'},task_lifecycle:row.task_lifecycle};
  row._doc={record:document.record};
  const envelope={record:{record_id:row.record_id,document_hash:'sha256:document',inventory_generation:1,
    inventory_manifest_hash:'sha256:manifest'},document};
  const index={kernel_id:'node',inventory_generation:1,inventory_hash:row._inventoryHash,
    inventory_manifest_hash:'sha256:manifest',expires_at:'2026-09-08T10:00:00Z',documents:{'sha256:document':document}};
  const a=b.producer.begin('offline public task fixture','https://public.example');
  b.producer.available(a,index);b.producer.verified(a,{ok:true},{entries:[]});
  assert.equal(b.producer.rowVerified(a,row,envelope,{entries:[]}),true);b.producer.admitted(a,true,'accepted');
  ui.S.order=['rec:first'];ui.S.recs.set('rec:first',row);
  const context={liveWorkspaces:[{run:'run-first'}]};
  const render=()=>ui.card('alice','node',context);
  return {b,ui,row,render};
}
function selection(html){
  const encoded=/data-public-task-selection="([^"]+)"/.exec(html)?.[1];assert(encoded);
  return JSON.parse(encoded.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'));
}
test('actual persona current-task observation follows the final live-title predicate',()=>{
  const {row,render}=setup();let html=render();
  assert(html.includes('class="pc-current pc-current-task"'));let selected=selection(html);
  assert.equal(selected.selected,true);assert.equal(selected.record_id,'rec:first');
  assert.equal(selected.authority_available,true);assert.equal(selected.selection_reason,'rendered_current_task');
  row.task_lifecycle.current_execution=false;row.task_lifecycle.state='budget_exhausted';
  html=render();assert(!html.includes('class="pc-current pc-current-task"'));selected=selection(html);
  assert.equal(selected.selected,false);assert.equal(selected.record_id,'');assert.equal(selected.revision,'');
  assert.equal(selected.selection_reason,'no_rendered_current_task');assert.equal(selected.authority_available,false);
});
test('actual persona missing lifecycle cannot retain an earlier selected proof',()=>{
  const {row,render}=setup();assert.equal(selection(render()).selected,true);
  row._taskLifecycleVerified=false;const html=render();assert(!html.includes('class="pc-current pc-current-task"'));
  const selected=selection(html);assert.equal(selected.selected,false);assert.equal(selected.authority_available,false);
});
