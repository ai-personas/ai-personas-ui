// Exercise the real renderer declarations without starting discovery, a browser,
// or a transport. Fixtures below represent the renderer's already-admitted state;
// signature admission is tested separately against node-produced documents.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assetRoot, disabledPublicEvidenceDependencies} from './public-evidence.mjs';

const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const human = await import(pathToFileURL(resolve(assetRoot, 'human-content.mjs')));
const {environmentIdentity} = await import(pathToFileURL(resolve(assetRoot, 'routing-authority.mjs')));
const {publicTaskLifecycleProjection} = await import(pathToFileURL(resolve(assetRoot, 'network-view.mjs')));
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
  section('function _personaEndpoints(', '// The live feed has already'),
  section('function _refreshPersonaInteractionIndex(', 'function ingestLiveTelemetry('),
  section('function _durablePublicPersonaActivity(', '// the live COORDINATION FEED'),
  section('function _runningNow(', 'function _modelFresh('),
  section('function _terminalModelFailureHTML(', 'function renderEnvLive('),
  section('function renderPersonaFeedDoc(', 'function renderEnvFeedDoc('),
  section('function _personaCharacteristicValue(', 'const _personaMonogram='),
  section('function _boundedLatestUnique(', 'function _artifactPresentationKey('),
  section('const _ARTIFACT_DECLARATION_DISPLAY_SCHEMA=', 'function artifactDeclarationAttr('),
  section('function _liveWorkspaceRevisionOrder(', 'function _firstAuthoredMethodText('),
  section('function _personaAuthoredWorkHTML(', '// ==== Collectible card gallery'),
  section('function _artifactDeclaringSid(', '// The persona\'s own stated refusal'),
  // Include the complete card, so description assertions cover the face binding.
  section('// Personal worktrees may contain', '// ==== end collectible card gallery helpers'),
  section('function renderPersonaCard(', '\nfunction '),
  section('function _verifiedPublicTaskForRun(', 'function _withVerifiedTaskRun('),
  section('function _disclosureKey(', 'function refreshSystemView('),
  section('  const envOutputContext=(b)=>{', '  const environmentCardHTML='),
].join('\n');

function renderer(observation = null, overrides = {}) {
  const S = {liveByPersona: new Map(), verifiedPublicCognitionByPersona: new Map(),
    personaDiscoveryByKey: new Map(), recs: new Map(), ixByPersona: new Map()};
  const liveWorkspacesByEnv = new Map();
  const empty = () => '';
  const values = {
    ...human, ...disabledPublicEvidenceDependencies(), S, esc, icon: empty, _shortId: short, _nameFor: nameFor,
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
    _personaRef: (value, kernel = 'node') => {
      const key = String(value).includes(':') ? value : `${kernel || 'node'}:${value}`;
      return {key, kernel: key.split(':')[0], sid: key.split(':').at(-1)};
    },
    _personaModelHistory: () => [], runtimeForPersona: () => ({}),
    _activeModelCallsForPersona: () => [],
    providerVerifiedPersonaObservation: () => observation,
    _personaAuthoredNameForObservation: () => 'Alice',
    _personaNameRolePresentation: () => ({name: 'Alice', exactName: 'Alice'}),
    _ROLE_NOT_DECLARED: 'not declared', _coordRole: () => 'not declared',
    _latestPersonaActivityForRecency: () => null, _modelFresh: () => false,
    _personaMechanicalRunProjection: () => ({key: 'unknown'}),
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
    NETWORK_LIMITS: {cognitionRowsPerPersona: 24, cognitionPersonas: 24},
    opTokens: () => ({}), kv: (key, value) => `<div>${key}: ${value}</div>`,
    _humanTaskExecutionState: (value) => value,
    _liveFeed: empty, feedModels: () => [], _verifiedPublicModelStatusHTML: empty,
    telemetryModelEvents: () => [], isPublicEntityTelemetryDocument: () => true,
    projectTerminalModelFailures: () => ({byPersona: new Map()}),
    PURPOSE_VERB: {}, environmentIdentity, publicTaskLifecycleProjection,
    _publicProvenanceAtom: (value) => typeof value === 'string' ? value.trim() : '',
    _pkTaskFacts: () => null,
    ...overrides,
  };
  return new Function(...Object.keys(values), declarations + `\nreturn {
    S, activity: _personaActivityHTML, work: _personaAuthoredWorkHTML,
    files: _liveWorkspacesHTML, fileCount: _liveWorkspaceCurrentFileCount,
    declaringPersona: _artifactDeclaringSid, card: renderPersonaCard,
    worktreeFiles: _personaWorktreeFilesHTML, environment: envOutputContext, liveWorkspacesByEnv,
    rememberDisclosure: _rememberDisclosure, restoreDisclosures: _restoreDisclosures,
    rememberActivity: _rememberPersonaCognitionEvent, indexActivity: _refreshPersonaInteractionIndex,
    liveStatus: renderPersonaLive, feedStatus: renderPersonaFeedDoc,
  };`)(...Object.values(values));
}

function event(kind, text, at, extra = {}) {
  return {kind, actor_kind: 'persona', actor_id: 'alice', _kernel: 'node',
    _t: at, _key: `event-${at}`, signed: true, _authority: 'persona_signature',
    _msg: text.slice(0, 40), _exactText: text, _provenance: {event: `event-${at}`},
    recipients: [], ...extra};
}
const visibleUpdates = (html) => html.split('<details class="pc-diagnostics">')[0];

function taskRecord(run, taskId, environment, revision = 'a') {
  return {kind: 'task', _kernel: 'node', _taskLifecycleVerified: true,
    did: `did:personaos:node/task/${run}`, label: 'The same published task title',
    task_lifecycle: {schema: 'personaos-public-task-lifecycle/2', kernel_id: 'node',
      run_id: run, task_id: taskId, environment_id: environment,
      state: 'running', current_execution: true, continued_from_run: '',
      amended_from_run: '', resumed_from_run: '', root_run_id: run,
      revision: `sha256:${revision.repeat(64)}`}};
}

export {human, esc, renderer, event, visibleUpdates, taskRecord};
