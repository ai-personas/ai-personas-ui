// Exercise the shipped selection and click-handler code with admitted records.
// Discovery signature admission is covered separately by node-produced fixtures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import test from 'node:test';

const assets = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../assets/', import.meta.url));
const source = readFileSync(resolve(assets, 'discovery.js'), 'utf8');
const network = await import(pathToFileURL(resolve(assets, 'network-view.mjs')));
const {networkEntityKey} = await import(pathToFileURL(resolve(assets, 'network-store.mjs')));
const personaKey = (kernel, id) => networkEntityKey(kernel, 'persona', id);
const environmentKey = (kernel, id) => networkEntityKey(kernel, 'env', id);
function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, start);
  return source.slice(first, last);
}

function stageSelection() {
  const S = {environmentWindow: 10, personaWindows: new Map()};
  const NETWORK_LIMITS = {environmentStep: 10, personaInitial: 12, personaStep: 12};
  let handler;
  const values = {
    ...network, S, NETWORK_LIMITS,
    $: () => ({addEventListener: (_kind, callback) => { handler = callback; }}),
    refreshSystemView: () => {},
    envKey: (kernel, sid) => `${kernel}:${sid}`,
    _score: () => 0,
    _personaPriority: () => 0,
  };
  const declarations = `
    function environmentSelection(envCandidates) {
      ${section('  const envWindow=selectPriorityWindow(envCandidates,', '  envBlocks.length=0;')}
      return envWindow;
    }
    function personaSelection(personaCandidates) {
      ${section("  const deckKey='@persona-deck', deckLimit=", '  S.visiblePersonaIds.clear();')}
      return personaWindow;
    }
    ${section("  $('#sysEnvs').addEventListener('click',(e)=>{", '    // follow toggle:')}
    });
    return {environmentSelection, personaSelection};
  `;
  const selectors = new Function(...Object.keys(values), declarations)(...Object.values(values));
  return {...selectors, expand(kind, total) {
    handler({target: {closest(selector) {
      return selector === `[data-more-${kind}]`
        ? {dataset: {morePersonas: '@persona-deck', total: String(total)}} : null;
    }}});
  }};
}

for (const [kind, count, initial] of [['environments', 613, 10], ['personas', 617, 12]]) {
  test(`every admitted ${kind} entry remains reachable through show more`, () => {
    const stage = stageSelection();
    const records = Array.from({length: count}, (_, i) => ({
      kernel: 'node', sid: String(i).padStart(4, '0'), key: String(i).padStart(4, '0'),
    }));
    const select = kind === 'environments' ? stage.environmentSelection : stage.personaSelection;
    let shown = select(records);
    assert.equal(shown.returned, initial);
    while (shown.returned < records.length) {
      const previous = shown.returned;
      stage.expand(kind, records.length);
      shown = select(records);
      assert.ok(shown.returned > previous, `show more stopped at ${previous} of ${count}`);
    }
    assert.deepEqual(shown.items, records);
    assert.equal(shown.omitted, 0);
    // A newly observed record remains reachable after the old set was exhausted.
    const extra = {kernel: 'node', sid: '9999', key: '9999'};
    records.push(extra);
    stage.expand(kind, records.length);
    assert.equal(select(records).items.at(-1), extra);
  });
}

function feedSelection(personaCount, environmentCount, windows) {
  const ent = {
    personas: Object.fromEntries(Array.from({length: personaCount}, (_, i) => [`p${i}`, `people/p${i}.json`])),
    environments: Object.fromEntries(Array.from({length: environmentCount}, (_, i) => [`e${i}`, `rooms/e${i}.json`])),
  };
  const values = {
    ...network, ent, kernel: 'node', S: {
      q: '', personaWindows: new Map([['@persona-deck', windows.personas]]),
      environmentWindow: windows.environments,
      visiblePersonaIds: new Set(windows.visiblePersonas || []),
      renderedEnvironmentKeys: new Set(windows.visibleEnvironments || []),
    },
    NETWORK_LIMITS: {personaInitial: 12, environmentInitial: 10},
    _shortId: value => value,
    _personaKey: personaKey,
    _environmentKey: environmentKey,
    _nameFor: id => id,
    _environmentNameFor: id => id,
  };
  const declaration = section('    const personaRows=', '    for(const [,rel] of personaRows)');
  return new Function(...Object.keys(values), declaration + '\nreturn {personaRows,environmentRows};')(...Object.values(values));
}

test('entity feed loading advances with the expanded people and environment windows', () => {
  const selected = feedSelection(617, 613, {personas: 617, environments: 613});
  assert.equal(selected.personaRows.length, 617);
  assert.equal(selected.environmentRows.length, 613);
});

test('a displayed person or environment outside the initial feed prefix receives its live feed', () => {
  const selected = feedSelection(617, 613, {
    personas: 12, environments: 10,
    visiblePersonas: [personaKey('node', 'p616')], visibleEnvironments: [environmentKey('node', 'e612')],
  });
  assert.ok(selected.personaRows.some(([id]) => id === 'p616'));
  assert.ok(selected.environmentRows.some(([id]) => id === 'e612'));
  assert.ok(selected.personaRows.length < 617);
  assert.ok(selected.environmentRows.length < 613);
});

test('environment enrichment cannot shorten an explicitly expanded inventory', () => {
  const envBlocks = Array.from({length: 613}, (_, i) => ({kernel: 'node', sid: `e${i}`, name: `Room ${i}`, members: []}));
  const values = {
    ...network, envBlocks, S: {environmentWindow: 613, q: ''},
    envKey: (kernel, id) => `${kernel}:${id}`, _nameFor: id => id,
  };
  const declaration = section('  const prefetchLimit=', '  envBlocks.forEach((b)=>{');
  new Function(...Object.keys(values), declaration)(...Object.values(values));
  assert.equal(envBlocks.length, 613);
});


test('enriched environment cards retain the same exact identity for the next feed selection', () => {
  const S = {};
  const values = {
    S, envBlocks: [{kernel: 'node', sid: 'e612'}],
    envKey: (kernel, id) => `${kernel}\u0000${id}`,
    _environmentKey: environmentKey,
  };
  const declaration = section('  S.renderedEnvironmentKeys=new Set(envBlocks.map(', '  // Personas are a primary deck');
  new Function(...Object.keys(values), declaration)(...Object.values(values));
  const selected = feedSelection(617, 613, {
    personas: 12, environments: 10, visibleEnvironments: [...S.renderedEnvironmentKeys],
  });
  assert.ok(selected.environmentRows.some(([id]) => id === 'e612'));
});
