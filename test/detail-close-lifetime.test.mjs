import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {assetRoot} from './helpers/public-evidence.mjs';

const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const start = source.indexOf('  const closeDetail=()=>{');
const end = source.indexOf("  $('#logbtn').addEventListener", start);
assert(start >= 0 && end > start);
const code = source.slice(start, end) + '\nreturn closeDetail;';

test('closing details cancels before releasing rendered bodies, title and navigation closures', () => {
  const events = [], nodes = new Map();
  const makeNode = selector => ({dataset: {connectedNode: 'private-node'},
    children: ['retained preview'], classList: {remove: name => events.push(selector + ':hide:' + name)},
    replaceChildren() { this.children = []; events.push(selector + ':unmount'); },
  });
  for (const selector of ['#detailbody', '#detail-title', '#detailwrap']) nodes.set(selector, makeNode(selector));
  const state = {views: [() => 'retained previous view'], _renderGen: 1, _topIsOp: true,
    drawerLiveKind: 'file', openLiveFile: {body: 'retained live metadata'}};
  const values = {S: state, $: selector => nodes.get(selector),
    document: {body: {classList: {remove: name => events.push('body:' + name)}}},
    runViewCleanups(options) { assert.deepEqual(options, {releaseConnections: true}); events.push('cancel'); },
    inspectionSourceControl() { throw new Error('No source in this fixture'); },
  };
  const close = new Function(...Object.keys(values), code)(...Object.values(values));
  close();
  assert.deepEqual(events.slice(0, 3), ['cancel', '#detailbody:unmount', '#detail-title:unmount']);
  assert.deepEqual(state.views, []);
  assert.deepEqual(nodes.get('#detailbody').children, []);
  assert.deepEqual(nodes.get('#detail-title').children, []);
  assert.equal(nodes.get('#detail-title').dataset.connectedNode, undefined);
  assert.equal(state._renderGen, 2);
  assert.equal(state.openLiveFile, null);
  assert.equal(state._topIsOp, false);
  close();
  assert.equal(state._renderGen, 3);
});
