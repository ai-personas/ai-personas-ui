import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import test from 'node:test';

const assets=process.env.UI_PRESENTATION_ASSETS||fileURLToPath(new URL('../assets/',import.meta.url));
const {educationHtml,experienceHtml}=await import(pathToFileURL(resolve(assets,'persona-records.mjs')));
const large='Exact recorded evidence <not markup>. '.repeat(30000);

test('closed education disclosures do not serialize or mount their raw criterion bodies',()=>{
  const doc={curricula:[{record_id:'package',title:'Recorded course',rubric:[]}],enrollments:[],
    assessments:[{assessment_id:'attempt',package_hash:'package',version:'1',status:'not_yet_demonstrated',
      assessment_capability:{id:'assessor',version:'1'},latest_result:{record_id:'result'},history:[],
      criteria:[{criterion:'application',status:'not_yet_demonstrated',evidence:{exact:large}}]}]};
  const before=JSON.stringify(doc), html=educationHtml(doc);
  assert.equal(JSON.stringify(doc),before);
  assert.match(html,/application/);assert.match(html,/Not yet demonstrated/);
  assert.ok(html.length<5000,'closed markup must not grow with the evidence body');
  assert.doesNotMatch(html,/<pre|Exact recorded evidence/);
  assert.match(html,/data-record-evidence=/);
});

test('closed experience disclosures keep only their record identity, not serialized facts',()=>{
  const doc={summary:{recorded_turns:1},limits:'Observations, not competence.',records:[{
    source_kind:'work_turn',recorded_at:'2026-09-13T05:20:53.201000+00:00',
    source_record_hash:'sha256:record',task_id:'task',environment_id:'environment',facts:{exact:large}}]};
  const before=JSON.stringify(doc), html=experienceHtml(doc);
  assert.equal(JSON.stringify(doc),before);
  assert.match(html,/Measured facts/);assert.match(html,/sha256:record/);
  assert.ok(html.length<5000,'closed markup must not grow with the facts body');
  assert.doesNotMatch(html,/<pre|Exact recorded evidence/);
  assert.match(html,/data-record-evidence=/);
});

const source=readFileSync(resolve(assets,'discovery.js'),'utf8');
const privateView=source.slice(source.indexOf('function _humanTaskExecutionState('),source.indexOf('// per-persona "is fresh" detector'))
  +source.slice(source.indexOf('async function connectedPersonaView('),source.indexOf('async function connectedEnvironmentView('));
for(const tab of ['education','experience']) for(const late of [false,true])
  test(`the connected ${tab} view ${late?'rejects late evidence after closing':'owns and disposes its evidence mount'}`,async()=>{
    const cached={label:'cached',next_offset:null},fresh={label:'new',next_offset:null};
    const host={innerHTML:'initial'},cleanups=[],updates=[];
    const entry={status:{personas:[{persona_id:'learner',name:'Learner'}]}};
    let current=true,resolveRead,disposed=0;
    const values={MY_NODES:new Map([['node',entry]]),operatorView(){},connectedNodeView(){},
      selectConnectedDetails(){},connectedCachedDetail:()=>cached,
      connectedDetailRecord:()=>late?new Promise(resolve=>{resolveRead=resolve;}):Promise.resolve(fresh),
      connectedPersonaOverview(){},educationHtml:doc=>doc.label,experienceHtml:doc=>doc.label,connectedCognitionHtml(){},
      connectedNodeMarker:()=>'<div>',esc:value=>String(value||''),kv:()=>'',_displayPersonaName:name=>name,
      updateStageHTML:(node,html)=>{assert.equal(node,host);node.innerHTML=html;},
      mountRecordEvidence:node=>{
        assert.equal(node,host);return {update:doc=>updates.push(doc),dispose:()=>{disposed++;}};
      }};
    const view=await new Function(...Object.keys(values),privateView+';return connectedPersonaView;')(...Object.values(values))('node','learner',{tab});
    const mounting=view.mount({querySelector:()=>host},{isCurrent:()=>current,
      assertCurrent(){if(!current)throw new Error('closed');},onCleanup:fn=>cleanups.push(fn)});
    assert.deepEqual(updates,[cached]);assert.equal(cleanups.length,1);
    if(late){current=false;cleanups.forEach(fn=>fn());resolveRead(fresh);}
    await mounting;
    if(late){assert.deepEqual(updates,[cached]);assert.equal(host.innerHTML,'initial');}
    else{assert.deepEqual(updates,[cached,fresh]);assert.match(host.innerHTML,/new/);cleanups.forEach(fn=>fn());}
    assert.equal(disposed,1);
  });
