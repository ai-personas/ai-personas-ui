'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../design/state.js');

test('initial state is a fresh copy; preview work has no submission or assessment',()=>{
 const a=D.initialState(),b=D.initialState();a.works[0].title='changed';assert.equal(b.works[0].title,'Four-bedroom home');
 for(const w of b.works){assert.equal(w.latest,'No submission');assert.equal(w.evidence,'Not assessed');}
});
test('search and filters compose without modifying records',()=>{
 const s=D.initialState();assert.equal(D.filterWorks(s,'needs').length,1);assert.equal(D.filterWorks(s,'progress').length,1);
 assert.equal(D.filterWorks(s,'all','  WILLOW ').length,1);assert.equal(D.filterWorks(s,'needs','circuit').length,0);assert.equal(s.works.length,2);
});
test('unknown is an answer, not a fact confirmation, grant or resolved request',()=>{
 const before=D.initialState();const after=D.transition(before,{type:'answer',id:'home',text:'Not known yet'});
 assert.equal(after.works[0].answer,'Not known yet');assert.equal(after.works[0].request,'answered');assert.equal(after.works[0].activity,'waiting');
 assert.equal(after.works[0].evidence,'Not assessed');assert.equal(after.works[0].latest,'No submission');assert.equal(before.works[0].request,'open');
 assert.deepEqual(after.works[1],before.works[1]);assert.equal(D.filterWorks(after,'needs').length,0);
});
test('empty, excessive, duplicate and unrelated responses are rejected',()=>{
 const s=D.initialState();for(const text of ['', '   ', 'x'.repeat(5001)])assert.throws(()=>D.transition(s,{type:'answer',id:'home',text}));
 assert.throws(()=>D.transition(s,{type:'answer',id:'circuit',text:'hello'}));assert.throws(()=>D.transition(s,{type:'answer',id:'missing',text:'hello'}));
 const answered=D.transition(s,{type:'answer',id:'home',text:'Unknown'});assert.throws(()=>D.transition(answered,{type:'answer',id:'home',text:'again'}));
});
test('untrusted answer text remains exact data, not an executable operation',()=>{
 const payload='<img src=x onerror="alert(1)">';const next=D.transition(D.initialState(),{type:'answer',id:'home',text:payload});
 assert.equal(next.works[0].answer,payload);assert.equal(next.works.length,2);
});
test('pause and resume do not modify evidence or request resolution',()=>{
 const initial=D.initialState(),paused=D.transition(initial,{type:'pause',id:'home'});assert.equal(paused.works[0].activity,'paused');
 assert.equal(paused.works[0].request,'open');assert.equal(paused.works[0].evidence,'Not assessed');
 assert.deepEqual(D.transition(paused,{type:'pause',id:'home'}),initial);
});
test('an answer while paused remains paused and resumes awaiting assessment',()=>{
 let s=D.transition(D.initialState(),{type:'pause',id:'home'});s=D.transition(s,{type:'answer',id:'home',text:'Unknown'});
 assert.equal(s.works[0].activity,'paused');s=D.transition(s,{type:'pause',id:'home'});assert.equal(s.works[0].activity,'waiting');assert.equal(s.works[0].request,'answered');
});
test('new work does not silently select personas or accept responsibility',()=>{
 const s=D.transition(D.initialState(),{type:'work',title:'New need',brief:'Preserve the original requirement'});const w=s.works.at(-1);
 assert.equal(w.activity,'awaiting_acceptance');assert.deepEqual(w.personas,[]);assert.equal(w.evidence,'Not assessed');assert.equal(w.brief,'Preserve the original requirement');
});
test('local work identifiers do not collide across creations',()=>{
 let s=D.initialState();for(let i=0;i<5;i++)s=D.transition(s,{type:'work',title:`Need ${i}`,brief:'Work'});
 assert.equal(new Set(s.works.map(w=>w.id)).size,s.works.length);
});
test('new persona is unauthored, uncommitted and has no invented experience',()=>{
 const s=D.transition(D.initialState(),{type:'persona',name:'Alex Field'});const p=s.people.at(-1);
 assert.equal(p.initials,'AF');assert.equal(p.note,null);assert.equal(p.disposition,'Unauthored');assert.equal(p.attention,'No accepted work');
 assert(s.works.every(w=>!w.personas.includes(p.id)));
});
test('draft limits and unknown operations fail without mutating state',()=>{
 const s=D.initialState();for(const action of [{type:'work',title:'',brief:'need'},{type:'work',title:'x'.repeat(81),brief:'need'},{type:'work',title:'need',brief:''},{type:'persona',name:' '},{type:'persona',name:'x'.repeat(81)},{type:'release'},{type:'grant'},{type:'resolve'},{type:'pause',id:'missing'}])assert.throws(()=>D.transition(s,action));
 assert.deepEqual(s,D.initialState());
});
for(const kind of D.scenarioKeys)test(`${kind}: all three snapshots are bounded fictional records, not quality scores`,()=>{
 for(let step=1;step<=3;step++){const s=D.snapshot(kind,step);assert.equal(s.allowance,120);assert(s.calls<=s.allowance);assert.equal(s.protectedCloseout,null);assert.equal(s.acceptance,'Not recorded');assert.equal(s.review,'Not established');assert(s.outcomes.length>0);assert(s.outside.length>0);}
});
test('house change preserves stale evidence and consent history without rewriting prior snapshots',()=>{
 const before=D.snapshot('house',2),after=D.snapshot('house',3);
 assert.deepEqual(before.members,['Mira','Nox']);assert.deepEqual(after.members,['Mira','Nox','Vale']);assert(after.outcomes.some(o=>o[0]==='Thermal analysis / v2'&&o[2]==='Stale'));
 after.outcomes[0][0]='tampered';assert.equal(D.snapshot('house',3).outcomes[0][0],'Architectural model / v4');
 assert.deepEqual(D.snapshot('house',2),before);
});
test('restraint and subjective acceptance remain representable',()=>{
 assert.deepEqual(D.snapshot('dataset',3).members,['Nox']);assert.equal(D.snapshot('story',3).acceptance,'Not recorded');
 assert(D.snapshot('story',3).outcomes.some(o=>o[0]==='Author acceptance'&&o[2]==='Pending'));
});
test('invalid snapshot keys or ordinals do not silently substitute a fixture',()=>{
 for(const [kind,step] of [['missing',1],['__proto__',1],['house',0],['house',4],['house',1.5],['house',NaN]])assert.throws(()=>D.snapshot(kind,step));
});
