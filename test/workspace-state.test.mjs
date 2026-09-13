import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkspaceRoute, workspaceHash, personaActivity, matchesActivity} from '../assets/workspace-state.mjs';
import {readFileSync} from 'node:fs';
import {selectPriorityWindow, progressiveGroupLimit} from '../assets/network-view.mjs';

test('workspace bookmarks round-trip text safely and reject unknown views and activity filters', () => {
  const state = {view:'personas', query:'A&B / 雨 #? <script>', activity:'working'};
  assert.deepEqual(parseWorkspaceRoute(workspaceHash(state)), state);
  assert.deepEqual(parseWorkspaceRoute('#unknown?activity=anything'), {view:'overview', query:'', activity:'all'});
  assert.equal(parseWorkspaceRoute('#personas?q='+'x'.repeat(800)).query.length, 256);
  assert.equal(workspaceHash({view:'workspaces', activity:'working'}), '#workspaces');
});
test('activity states distinguish an observed active call from failure and quiet state', () => {
  assert.equal(personaActivity({running:true,failed:true}), 'working');
  assert.equal(personaActivity({failed:true}), 'attention');
  assert.equal(personaActivity(), 'quiet');
  assert.equal(matchesActivity('attention','quiet'), true);
  assert.equal(matchesActivity('working','quiet'), false);
});
test('activity selection finds working personas beyond the initial page before pagination', () => {
  const source = readFileSync(new URL('../assets/discovery.js', import.meta.url), 'utf8');
  const start = source.indexOf("  const activityFilter=host.dataset.activityFilter||'all';");
  const end = source.indexOf('  S.visiblePersonaIds.clear();', start);
  assert.ok(start > 0 && end > start);
  const select = new Function('personaCandidates','host','activityForContext','matchesActivity','S',
    'NETWORK_LIMITS','progressiveGroupLimit','selectPriorityWindow','_personaPriority',
    source.slice(start,end)+'return personaWindow;');
  const candidates = Array.from({length:100}, (_,i) => ({key:String(i),state:i>=80?'working':'quiet'}));
  const state = {personaWindows:new Map()};
  const run = filter => select(candidates,{dataset:{activityFilter:filter}},row=>row.state,matchesActivity,state,
    {personaInitial:12,personaStep:12},progressiveGroupLimit,selectPriorityWindow,()=>0);
  assert.equal(run('working').matched,20);
  assert.equal(run('working').returned,12);
  assert.ok(run('working').items.every(row=>Number(row.key)>=80));
  assert.equal(run('attention').returned,0);
  assert.equal(run('all').matched,100);
});
