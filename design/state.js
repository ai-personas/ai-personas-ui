/* Pure fixture transitions shared by the browser and offline tests. No runtime API. */
(function (root) {
  'use strict';
  const people = [
    {id:'mira', name:'Mira Vale', initials:'MV', tone:'sand', character:'Curious and reflective. Explores alternatives, then explains the trade-offs.', disposition:'Exploratory · considered', attention:'Clarifying the house brief', note:'Keep assumptions separate from confirmed site information.'},
    {id:'orin', name:'Orin Reed', initials:'OR', tone:'sage', character:'Methodical and calm. Makes assumptions visible and checks the details.', disposition:'Careful · composed', attention:'Comparing circuit approaches', note:'Compare alternatives using the same declared inputs.'},
    {id:'nela', name:'Nela Wren', initials:'NW', tone:'blue', character:'Warm and questioning. Brings differing perspectives into the conversation.', disposition:'Collaborative · inquisitive', attention:'Bringing requirements together', note:'An offered responsibility is not an accepted commitment.'}
  ];
  const works = [
    {id:'home', title:'Four-bedroom home', environment:'Willow Studio', icon:'home', activity:'needs_you', request:'open', answer:'', personas:['mira','orin','nela'], latest:'No submission', evidence:'Not assessed', updateType:'Request', update:'Mira asked for site details.', brief:'Design a four-bedroom home. Clarify missing site requirements before committing to a layout. Preserve the editable design, assumptions and checks.', summary:'We need the site dimensions and location before the team can make defensible design choices. The design brief is still open; no plans or checks have been produced.'},
    {id:'circuit', title:'5 W DC-to-AC design', environment:'Current Lab', icon:'wave', activity:'working', request:null, answer:'', personas:['mira','orin','nela'], latest:'No submission', evidence:'Not assessed', updateType:'Team summary', update:'Orin recorded an approach comparison.', brief:'Explore a 5 W DC-to-AC design. Input voltage, output voltage, frequency, waveform, load and isolation remain to be clarified. No physical operation is authorized.', summary:'Orin recorded a comparison of possible approaches. Required operating conditions remain unknown. No schematic, simulation or bench measurement has been produced.'}
  ];
  const scenarios = {
    house:{title:'Breeze House', need:'Design a four-bedroom house', description:'Coordinated four-bedroom design: editable models, structure, plumbing, HVAC, electrical and appropriate analyses. Site and professional checks remain explicit outside requirements.', outside:'Outside site and professional review is still pending. No construction approval is implied.', stages:[
      {calls:12, priority:'Clarify the brief and accept responsibility', rationale:'Mira and Nox notice different questions. Initial responsibilities are offers until accepted; the original need and unresolved inputs stay visible.', owner:'Mira · continuation accepted in this fixture', expected:'An attributed interpretation, open site questions and visible ownership gaps.', changed:'Two continuing personas consider the need. No prescribed professions or engineering output are implied.', members:['Mira','Nox'], outcomes:[['Coordinated design scope','Required outcomes need accepted owners','Unowned','No accepted owner'],['Site information','Location and dimensions are unknown','Needs you','Mira · question only'],['Native model','No model has been produced','Not started','Unowned']], decisions:[['Need received','Original request retained without adding permissions.'],['Different perspectives','Mira proposes alternatives; Nox asks for a common comparison basis.']]},
      {calls:31, priority:'Investigate a recurring analysis uncertainty', rationale:'The team has a provisional model in this authored snapshot. Nox proposes another perspective; birth, membership and commitment acceptance remain separate.', owner:'Nox · accepted investigation', expected:'A bounded comparison and an invitation with exact preview access.', changed:'A birth proposal is admitted against the existing root. Vale has not yet accepted membership or the offered work.', members:['Mira','Nox'], outcomes:[['Architectural model / v3','Provisional scenario input, not a real-site approval','Provisional','Mira'],['Analysis comparison','Offered to Vale; no accepted commitment yet','Offered','Unowned'],['Plumbing / HVAC / electrical coordination','Coverage and interface agreements remain incomplete','Unowned','Unowned']], decisions:[['Uncertainty recorded','The proposed contribution is linked to a work question, not an expert label.'],['Invitation offered','A bounded bootstrap preview is available; general work access is not.']]},
      {calls:47, priority:'Recheck affected results after the chosen layout change', rationale:'The team adopted a provisional layout revision. Prior analysis depended on the previous model and is now stale; presentation polish is deferred.', owner:'Vale + affected commitment owners', expected:'Analysis inputs and coordination findings bound to model v4.', changed:'Vale joined by consent and produced a first analysis contribution. The priority moved from team formation to revalidation.', members:['Mira','Nox','Vale'], outcomes:[['Architectural model / v4','Current revision remains provisional pending integrated checks','Native check recorded','Mira'],['Thermal analysis / v2','Inputs refer to model v3, not the chosen model v4','Stale','Vale'],['Plumbing / HVAC / electrical coordination','Resolve affected routes, loads and schedules','In progress','Nox + Vale'],['Service-zone alternative','Benefit must survive the new checks','Provisional','Team adopted for testing'],['Final rendering','Revalidation is more important now','Deferred','Deferred']], decisions:[['Vale joined','A distinct identity accepted the offered commitment within existing funding.'],['Alternative explored','A shared service-zone idea was compared against the baseline; adoption remains provisional.'],['Model changed','Dependencies marked old results stale; affected owners received events.'],['Priority revised','Revalidation now precedes optional presentation polish.']]}
    ]},
    dataset:{title:'Clearer Records',need:'Clean a dataset',description:'An illustrative data-cleaning need with preserved sources, reproducible transformations and held-out checks. One persona can be sufficient.',outside:'Data-owner confirmation is pending for ambiguous duplicate records.',stages:[
      {calls:3,priority:'Establish the schema and preserve the source',rationale:'The incoming file contains unknown field meanings. Preserve it before proposing a transformation.',owner:'Nox',expected:'A schema question and an immutable source reference.',changed:'Nox accepts the need without proposing a new persona.',members:['Nox'],outcomes:[['Source preservation','No transformation has been accepted','Pending','Nox'],['Field definitions','Ambiguous date field','Needs you','Nox']],decisions:[['Need accepted','One continuing persona accepts continuation responsibility.']]},
      {calls:8,priority:'Test an ambiguous duplicate rule',rationale:'A comparison exposes records that share a name but not an identifier. Do not merge them on appearance alone.',owner:'Nox',expected:'A preserved alternative and a question to the data owner.',changed:'New evidence changes the candidate transformation.',members:['Nox'],outcomes:[['Cleaning recipe / v1','Candidate rules retain ambiguous records','Provisional','Nox'],['Duplicate interpretation','Owner clarification required','Needs you','Nox']],decisions:[['Rule questioned','An experiment rejects an overly broad merge.']]},
      {calls:13,priority:'Revalidate against the corrected schema',rationale:'The source schema changed. Earlier checks remain historical and must not qualify the new transformation.',owner:'Nox',expected:'Checks bound to source v2; no unnecessary birth.',changed:'The same persona revises the method; adaptive work does not require population growth.',members:['Nox'],outcomes:[['Cleaning recipe / v2','Inputs now refer to source v2','In progress','Nox'],['Held-out check / v1','Checked source v1 only','Stale','Nox']],decisions:[['Schema changed','Old checks are explicitly inapplicable.'],['No birth','Existing capability is sufficient for the bounded next step.']]}
    ]},
    story:{title:'The Orchard Letter',need:'Write a short story',description:'A creative fixture with versioned drafts, attributed critique and the author’s preferences. User judgment is not a fabricated machine truth score.',outside:'Author acceptance remains pending; critique is not objective certification.',stages:[
      {calls:2,priority:'Understand the author’s intended tone',rationale:'Mira asks which relationship should be central before drafting.',owner:'Mira',expected:'A bounded interpretation and the author’s preferences.',changed:'A small creative need does not require a full engineering workflow.',members:['Mira'],outcomes:[['Story direction','Tone remains an open preference','Needs you','Mira']],decisions:[['Preference requested','The author retains control of the purpose.']]},
      {calls:7,priority:'Compare two possible endings',rationale:'Nela offers a critique, not a replacement of the author’s intent.',owner:'Mira + Nela',expected:'Two preserved alternatives and an attributed comparison.',changed:'A peer joins the critique by agreement; no newborn is needed.',members:['Mira','Nela'],outcomes:[['Draft / v1','Ending remains provisional','Provisional','Mira'],['Critique','A shared perspective, not universal agreement','In progress','Nela']],decisions:[['Alternative proposed','The baseline draft remains available.']]},
      {calls:11,priority:'Check continuity after the revised ending',rationale:'Earlier critique referred to draft v1. The author still decides whether the revised story succeeds.',owner:'Mira',expected:'A coherent draft v2 and an explicit acceptance request.',changed:'Peer feedback changes the draft without pretending subjective quality is a technical pass.',members:['Mira','Nela'],outcomes:[['Draft / v2','Revised ending awaits author judgment','Provisional','Mira'],['Critique of v1','Historical critique does not assess v2','Stale','Nela'],['Author acceptance','No acceptance recorded','Pending','Author']],decisions:[['Draft revised','The change is attributed to peer feedback.'],['Acceptance requested','No numerical quality score is invented.']]}
    ]}
  };
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function initialState() { return {works:clone(works),people:clone(people),nextId:1}; }
  function filterWorks(state, filter='all', search='') {
    const query=search.trim().toLocaleLowerCase();
    return state.works.filter(w=>(filter==='all'||(filter==='needs'&&w.request==='open')||(filter==='progress'&&w.activity==='working'))&&`${w.title} ${w.environment} ${w.update}`.toLocaleLowerCase().includes(query));
  }
  function transition(state, action) {
    const next=clone(state);
    if(action.type==='answer') {
      const work=next.works.find(w=>w.id===action.id);
      if(!work||work.request!=='open') throw new Error('This request is not open.');
      const text=String(action.text||'').trim();
      if(!text||text.length>5000) throw new Error('Enter an answer of 1–5,000 characters. Unknown details may stay unknown.');
      work.answer=text; work.request='answered';
      if(work.activity!=='paused') work.activity='waiting';
      work.updateType='Response'; work.update='Your response was recorded; persona assessment is pending.';
    } else if(action.type==='pause') {
      const work=next.works.find(w=>w.id===action.id);
      if(!work) throw new Error('Work not found.');
      if(work.activity==='paused') {work.activity=work.previousActivity;delete work.previousActivity;}
      else {work.previousActivity=work.activity;work.activity='paused';}
      // A response received while paused resumes as waiting, never needs-you or resolved.
      if(work.request==='answered'&&work.activity==='needs_you')work.activity='waiting';
    } else if(action.type==='work') {
      const title=String(action.title||'').trim();const brief=String(action.brief||'').trim();
      if(!title||title.length>80||!brief||brief.length>5000)throw new Error('A title (up to 80 characters) and need (up to 5,000) are required.');
      next.works.push({id:`local-${next.nextId++}`,title,brief,environment:'Your workspace',icon:'work',activity:'awaiting_acceptance',personas:[],request:null,answer:'',latest:'No submission',evidence:'Not assessed',updateType:'Need recorded',update:'No persona has accepted continuation responsibility.',summary:'This is a local draft need. No model was called and no participant has accepted it.'});
    } else if(action.type==='persona') {
      const name=String(action.name||'').trim();
      if(!name||name.length>80)throw new Error('Enter a name of 1–80 characters.');
      next.people.push({id:`persona-${next.nextId++}`,name,initials:name.split(/\s+/).slice(0,2).map(s=>Array.from(s)[0]).join('').toUpperCase(),tone:'sage',character:'No persona-authored character is available.',disposition:'Unauthored',attention:'No accepted work',note:null});
    } else {throw new Error('Unsupported preview transition.');}
    return next;
  }
  function snapshot(kind, step) {
    if(!Object.hasOwn(scenarios,kind)||!Number.isInteger(step)||step<1||step>3)throw new Error('Unknown fixture snapshot.');
    const {stages,...meta}=scenarios[kind];return clone({...meta,...stages[step-1],step,allowance:120,protectedCloseout:null,review:'Not established',acceptance:'Not recorded'});
  }
  const api={initialState,filterWorks,transition,snapshot,scenarioKeys:Object.keys(scenarios)};
  root.PersonaDesign=Object.freeze(api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
