// Exercise the real renderer declarations without starting discovery, a browser,
// or a transport. Fixtures below represent the renderer's already-admitted state;
// signature admission is tested separately against node-produced documents.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const human = await import(pathToFileURL(resolve(assetRoot, 'human-content.mjs')));
const section = (start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing renderer declarations: ${start}`);
  return source.slice(first, last);
};
const esc = (value) => String(value ?? '').replace(/[&<>"']/g,
  (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const short = (value) => String(value || '').replace(/^persona:/, '');
const nameFor = (value) => ({'node:alice': 'Alice', 'node:bob': 'Bob'}[value] || value);
const declarations = [
  section('function _eventKernel(', 'function _eventEntityLabel('),
  section('function _personaCharacteristicValue(', 'const _personaMonogram='),
  section('function _boundedLatestUnique(', 'function _artifactPresentationKey('),
  section('const _ARTIFACT_DECLARATION_DISPLAY_SCHEMA=', 'function artifactDeclarationAttr('),
  section('function _liveWorkspaceRevisionOrder(', 'function _firstAuthoredMethodText('),
  section('function _personaAuthoredWorkHTML(', '// ==== Collectible card gallery'),
  section('function _artifactDeclaringSid(', '// The persona\'s own stated refusal'),
  section('const PK_TASK_EXEC_DOING=', '// ---- C-OP-16'),
  // Include the complete card, so description assertions cover the face binding.
  section('// Personal worktrees may contain', '// ==== end collectible card gallery helpers'),
  section('function renderPersonaCard(', '\nfunction '),
  section('function _disclosureKey(', 'async function refreshSystemView('),
  section('  const envOutputContext=(b)=>{', '  const environmentCardHTML='),
].join('\n');

function renderer(observation = null) {
  const S = {liveByPersona: new Map(), verifiedPublicCognitionByPersona: new Map(),
    personaDiscoveryByKey: new Map(), recs: new Map(), ixByPersona: new Map()};
  const liveWorkspacesByEnv = new Map();
  const empty = () => '';
  const values = {
    ...human, S, esc, icon: empty, _shortId: short, _nameFor: nameFor,
    _personaKey: (kernel, pid) => `${kernel}:${short(pid)}`,
    kernelForBase: () => 'node', _eventEntityLabel: (kind, id) => id,
    _ixClass: () => 'activity', _ixGlyph: empty,
    _activityPrimaryContextHTML: empty, _activityTechnicalHTML: empty,
    _activityTrustBadgeHTML: empty, _eventTimeHTML: empty,
    _compactHumanLabel: (value, limit) => String(value).slice(0, limit),
    _friendlyInstant: (value) => value || '',
    PUBLIC_PERSONA_ACTION_OUTPUT_KIND: 'PERSONA_ACTION_AUTHORED',
    PUBLIC_PERSONA_COMMUNICATION_OUTPUT_KIND: 'PERSONA_COMMUNICATION_AUTHORED',
    PUBLIC_PERSONA_COGNITIVE_OUTPUT_KIND: 'PERSONA_COGNITIVE_INTENT',
    _publicCognitionDocOk: (doc) => !!doc,
    _publicPersonaOutputDisplayText: (output) => output.text,
    _publicOutputLabel: (output) => output.kind,
    _personaAgenticDevelopmentHTML: empty, _latestLessonHTML: empty,
    _personaWorkNoteComparisonHTML: empty,
    _artifactExactFormatCountsHTML: empty,
    _artifactGroupedListHTML: (rows, {render}) => rows.map(render).join(''),
    _artifactFilePresentation: (path) => ({path}),
    _liveFileSignedArtifactMetadata: () => null,
    selectArtifactRenderer: () => ({mediaType: 'text/plain'}),
    artifactMediaPresentation: () => ({mediaType: 'text/plain'}),
    authoredArtifactLabelText: empty, _artifactDeclarationPersonaLabel: empty,
    _artifactFormatTileHTML: empty,
    _artifactFileIdentityHTML: (file) => `<b>${esc(file.path)}</b>`,
    artifactTypeLabel: () => 'Text', fmtBytes: (value) => `${value} B`,
    _personaRef: (sid, kernel = 'node') => ({sid, kernel, key: `${kernel}:${sid}`}),
    _personaModelHistory: () => [], runtimeForPersona: () => ({}),
    _activeModelCallsForPersona: () => [],
    providerVerifiedPersonaObservation: () => observation,
    _personaAuthoredNameForObservation: () => 'Alice',
    _personaNameRolePresentation: () => ({name: 'Alice', exactName: 'Alice'}),
    _ROLE_NOT_DECLARED: 'not declared', _coordRole: () => 'not declared',
    _latestPersonaActivityForRecency: () => null, _modelFresh: () => false,
    _runningNow: () => false, _personaMechanicalRunProjection: () => ({key: 'unknown'}),
    _personaGrew: () => false, TOOL_KINDS: new Set(), _personaAvatarHue: () => 0,
    _pkCognitionStats: () => null, _scorecardForRun: () => null,
    _verifiedIdentityDecline: () => null,
    _coordRoleClass: empty, _domEntityKey: (value) => value, _personaAvatarHTML: empty,
    _ownedOutputsHTML: empty, _runScorecardHTML: empty,
    liveWorkspacesByEnv, envKey: (kernel, sid) => `${kernel}:${sid}`,
    envArtifacts: (b) => b.artifacts || [], envManifestFiles: () => [], manifestRun: empty,
    _artifactRevisionProjection: (rows) => ({current: rows.length ? {rows} : null}),
    LIVE_ARTIFACT_LIMITS: {maxFiles: 4096}, runOf: (row) => row.run,
    _sentenceStart: (value) => value,
  };
  return new Function(...Object.keys(values), declarations + `\nreturn {
    S, activity: _personaActivityHTML, work: _personaAuthoredWorkHTML,
    files: _liveWorkspacesHTML, fileCount: _liveWorkspaceCurrentFileCount,
    declaringPersona: _artifactDeclaringSid, card: renderPersonaCard,
    worktreeFiles: _personaWorktreeFilesHTML, environment: envOutputContext, liveWorkspacesByEnv,
    rememberDisclosure: _rememberDisclosure, restoreDisclosures: _restoreDisclosures,
  };`)(...Object.values(values));
}

function event(kind, text, at, extra = {}) {
  return {kind, actor_kind: 'persona', actor_id: 'alice', _kernel: 'node',
    _t: at, _key: `event-${at}`, signed: true, _authority: 'persona_signature',
    _msg: text.slice(0, 40), _exactText: text, _provenance: {event: `event-${at}`},
    recipients: [], ...extra};
}
const visibleUpdates = (html) => html.split('<details class="pc-diagnostics">')[0];

test('a command burst and newer thoughts do not bury a directed message', () => {
  const ui = renderer();
  const message = 'Please verify the new model.\n' + 'Keep every authored word. '.repeat(25);
  const events = [event('PERSONA_COMMUNICATION_AUTHORED', message, 1,
    {recipients: [{kind: 'persona', id: 'bob'}], _recipientCount: 1}),
  ...[2, 3, 4].map((at) => event('PERSONA_COGNITIVE_INTENT', `Thought ${at}`, at)),
  ...[5, 6, 7, 8].map((at) => event('PERSONA_ACTION_AUTHORED', `command ${at}`, at))];
  const html = ui.activity(events, 'node:alice'), visible = visibleUpdates(html);
  assert.ok(visible.includes(esc(message)), 'the full signed message is on the face');
  assert.ok(visible.includes('Alice → Bob'));
  assert.ok(visible.includes('Thought 4'));
  assert.ok(!visible.includes('command 8'));
  assert.ok(html.includes('command 8'), 'actions remain in technical activity');
});

test('an incoming message names its author and displayed recipients', () => {
  const html = renderer().activity([event('PERSONA_COMMUNICATION_AUTHORED',
    'The review found an overlap.', 1, {actor_id: 'bob',
      recipients: [{kind: 'persona', id: 'alice'}], _recipientCount: 3})], 'node:alice');
  assert.ok(html.includes('Bob → Alice'));
  assert.ok(html.includes('2 other recipients'));
});

test('kernel observations and action requests cannot become signed messages', () => {
  const html = renderer().activity([
    event('PERSONA_COMMUNICATION_AUTHORED', 'Unverified message', 1, {signed: false}),
    event('PERSONA_COGNITIVE_INTENT', 'Kernel claim', 2, {_authority: 'kernel_signature'}),
    event('PERSONA_ACTION_AUTHORED', 'A persona_message tool request', 3),
  ], 'node:alice');
  const visible = visibleUpdates(html);
  assert.ok(!visible.includes('Unverified message'));
  assert.ok(!visible.includes('Kernel claim'));
  assert.ok(!visible.includes('A persona_message tool request'));
  assert.ok(visible.includes('has not published a signed message or thought'));
});

test('a complete model response retains its own lane and full text', () => {
  const text = 'A complete provider response.\n' + 'More detail. '.repeat(30);
  const html = renderer().activity([event('PROVISIONAL_ASSISTANT_MESSAGE', text, 1,
    {signed: false, _providerProvisional: true, _providerComplete: true})], 'node:alice');
  assert.ok(html.includes('Latest model response'));
  assert.ok(html.includes(esc(text)));
});

test('current thinking selects authored cognition instead of a newer action request', () => {
  const ui = renderer();
  ui.S.verifiedPublicCognitionByPersona.set('node:alice', {doc: {recent_outputs: [
    {kind: 'PERSONA_COGNITIVE_INTENT', authority: 'persona_signature', text: 'Check the geometry'},
    {kind: 'PERSONA_ACTION_AUTHORED', authority: 'persona_signature', text: 'Run a command'},
  ]}});
  const html = ui.work('node:alice');
  assert.ok(html.includes('Check the geometry'));
  assert.ok(!html.includes('Run a command'));
});

test('the persona face uses its verified character and renders structured self-description', () => {
  const profile = {_personaCharacteristics: {description: 'Curious, precise and patient',
    OCEAN: {O: 0.8, C: 0.9, E: 0.4, A: 0.6, N: 0},
    VAD: {valence: 0.2, arousal: 0, dominance: -0.1}}};
  const observation = {identityVerified: true, record: profile};
  const html = renderer(observation).card('alice', 'node');
  const face = html.split('<details class="pk-dossier">')[0];
  assert.ok(face.includes('Curious, precise and patient'));
  assert.ok(!html.includes('Neutral persona'));
  assert.ok(html.includes('OCEAN') && html.includes('N: 0') && html.includes('Arousal: 0'));
  profile.persona_card = {card: {self_publication: {body: {description: 'I check every joint.'}}}};
  const published = renderer(observation).card('alice', 'node');
  assert.ok(published.split('<details class="pk-dossier">')[0].includes('I check every joint.'));
  assert.ok(!published.includes('[object Object]'));
  const refused = renderer({...observation, identityVerified: false}).card('alice', 'node');
  assert.ok(!refused.includes('Curious, precise and patient'));
  assert.ok(!refused.includes('I check every joint.'));
  assert.ok(!refused.includes('Neutral persona'));
});

const workspace = (workspaceId, hash = 'a'.repeat(64), extra = {}) => ({
  kernel: 'node', base: 'http://node.test', environmentId: 'env-a',
  run: 'run-2', workspaceId, personaId: 'alice',
  generatedAt: '2026-09-06T00:00:00Z', revision: '2', ended: true,
  files: [{path: 'delivery/model.step', sha256: hash, size_bytes: 123}], ...extra,
});

test('identical captured copies count once and each source remains openable', () => {
  const ui = renderer(), rows = [workspace('ws-a'), workspace('ws-b'), workspace('ws-c')];
  assert.equal(ui.fileCount(rows), 1);
  const html = ui.files(rows);
  assert.ok(html.includes('3 worktree copies'));
  for (const row of rows) assert.ok(html.includes(`data-live-file-workspace="${row.workspaceId}"`));
  assert.equal(ui.fileCount([...rows, workspace('ws-b', 'b'.repeat(64))]), 2);
  assert.ok(ui.files([...rows, workspace('ws-b', 'b'.repeat(64))]).includes('different content'));
});

test('same paths in another node, environment or run stay distinct', () => {
  const ui = renderer();
  for (const extra of [{kernel: 'other-node'}, {environmentId: 'env-b'}, {run: 'run-3'}])
    assert.equal(ui.fileCount([workspace('ws-a'), workspace('ws-b', 'a'.repeat(64), extra)]), 2);
  assert.equal(ui.fileCount([workspace('ws-a', ''), workspace('ws-b', '')]), 2);
  assert.ok(!ui.files([workspace('ws-a', ''), workspace('ws-b', '')]).includes('different content'));
  const old = workspace('ws-a', 'b'.repeat(64), {run: 'run-1', generatedAt: '2026-09-07T00:00:00Z'});
  assert.equal(ui.fileCount([old, workspace('ws-a')]), 1, 'later fetch time does not revive a prior run');
  assert.equal(ui.fileCount([workspace('ws-a'), workspace('ws-a', 'a'.repeat(64),
    {environmentId: 'env-b'})]), 2, 'an equal workspace label cannot merge distinct contexts');
});

test('environment totals use only its own current files and count identical bytes once', () => {
  const ui = renderer();
  ui.liveWorkspacesByEnv.set('node:env-a', [workspace('ws-a'), workspace('ws-b')]);
  ui.liveWorkspacesByEnv.set('node:env-b', [workspace('ws-c', 'c'.repeat(64),
    {environmentId: 'env-b', files: [{path: 'other.step', size_bytes: 999, sha256: 'c'.repeat(64)}]})]);
  const output = ui.environment({kernel: 'node', sid: 'env-a', status: 'active'});
  assert.equal(output.metaFiles, 1);
  assert.equal(output.currentFileBytes, 123);
  const newerPublication = ui.environment({kernel: 'node', sid: 'env-a',
    artifacts: [{run: 'run-3', path: 'new-publication.step'}]});
  assert.equal(newerPublication.metaFiles, 1);
  assert.equal(newerPublication.currentFileBytes, null, 'old live bytes do not describe newer published files');
});

test('personal captures are disclosed as held files and do not claim they were built', () => {
  const ui = renderer(), context = {liveWorkspaces: [workspace('ws-a')]};
  const html = ui.worktreeFiles(context, 'run-2');
  assert.match(html, /^<details[^>]*><summary>Files in my worktree/);
  assert.ok(!html.includes('Built this run'));
  assert.ok(!html.includes(' built '));
  assert.ok(ui.worktreeFiles(context, 'run-3').includes('earlier worktree captures'));
});

test('file disclosures stay open through a repaint without opening another panel or node', () => {
  const ui = renderer();
  const panels = (kernel) => {
    const card = {dataset: {pcard: 'alice', pkernel: kernel}, querySelectorAll: () => rows};
    const panel = (className, key = '') => {
      const classList = className.split(' ');
      classList.contains = (name) => classList.includes(name);
      return {className, classList, dataset: {disclosureKey: key}, open: false, closest: () => card};
    };
    const rows = [panel('pk-dossier pc-worktree-files', 'worktree-files'), panel('pk-dossier'),
      panel('artifact-copy-sources', 'file-copies:model.step:a'),
      panel('artifact-copy-sources', 'file-copies:drawing.svg:b')];
    return rows;
  };
  const initial = panels('node');
  initial[0].open = true;
  initial[2].open = true;
  initial.forEach(ui.rememberDisclosure);
  const repainted = panels('node'), otherNode = panels('other-node');
  ui.restoreDisclosures({querySelectorAll: () => [...repainted].reverse().concat(otherNode)});
  assert.deepEqual(repainted.map((row) => row.open), [true, false, true, false]);
  assert.ok(otherNode.every((row) => !row.open));
});

test('access ownership does not claim artifact authorship', () => {
  const ui = renderer();
  assert.equal(ui.declaringPersona({_access: {owner_persona_id: 'persona:alice'}}), '');
  assert.equal(ui.declaringPersona({_access: {owner_persona_id: 'persona:alice'},
    artifact_declaration: {declaring_persona_id: 'persona:bob'}}), 'bob');
});

test('requesting a message action does not claim a message was sent', () => {
  const requested = human.humanActivityPresentation('PERSONA_ACTION_AUTHORED', {action: 'persona_message'});
  assert.ok(!requested.headline.includes('Messaged'));
  assert.match(requested.headline, /request/i);
});
