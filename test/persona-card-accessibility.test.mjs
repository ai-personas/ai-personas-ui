import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {assetRoot} from './helpers/public-evidence.mjs';
import {esc, renderer} from './helpers/discovery-presentation.mjs';

const source = readFileSync(resolve(assetRoot, 'discovery.js'), 'utf8');
const section = (start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, start);
  return source.slice(first, last);
};
const attributes = markup => Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)]
  .map(([, name, value]) => [name, value.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')]));

test('the persona has one native named profile control without an interactive card ancestor', () => {
  for (const name of ['Alice', 'Name pending', 'Alice <&>']) {
    const html = renderer({identityVerified:true, record:{}}, {_personaNameRolePresentation:() => ({name, exactName:name})})
      .card('alice', 'node');
    const card = attributes(html.match(/^<article\b[^>]*>/)[0]);
    assert.equal(card.role, undefined);
    assert.equal(card.tabindex, undefined);
    assert.equal(card['data-pcard'], 'alice');
    const buttons = [...html.matchAll(/<button\b([^>]*data-persona-profile[^>]*)>([\s\S]*?)<\/button>/g)];
    assert.equal(buttons.length, 1);
    const button = attributes(buttons[0][1]);
    assert.equal(button.type, 'button');
    assert.equal(button['aria-label'], `Open profile for ${name}`);
    assert.equal(button['aria-controls'], 'detailwrap');
    assert.equal(button['aria-haspopup'], 'dialog');
    assert.equal(buttons[0][2], esc(name), 'The existing displayed name remains the button text');
    assert.match(html, /<h3 class="pc-name"[^>]*><button /);
    assert.match(html, /<button class="pc-follow"[^>]*data-follow=/);
    assert.doesNotMatch(html, /<details class="pk-dossier"><summary>/, 'Large dossiers load only in the opened profile');
  }
});

// These small DOM/event objects exercise the shipped delegated handlers. Native
// default activation is modeled only after the key handler leaves it uncancelled;
// the separate populated Firefox fixture verifies real browser activation/axe.
class Element {
  constructor(tag, attrs = {}, parent = null) {
    this.tag = tag; this.attrs = attrs; this.parentElement = parent;
    this.dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    this.clicked = 0; this.open = false;
  }
  matches(selector) {
    if (selector.startsWith('[')) {
      const [, key, value] = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
      return Object.hasOwn(this.attrs, key) && (value === undefined || this.attrs[key] === value);
    }
    return selector.startsWith('.') ? (this.attrs.class || '').split(' ').includes(selector.slice(1))
      : this.tag === selector;
  }
  closest(selectors) {
    for (let node = this; node; node = node.parentElement)
      if (selectors.split(',').some(selector => node.matches(selector.trim()))) return node;
    return null;
  }
  dispatchEvent(event) {this.click(event);}
  click() {this.clicked++; this.onClick?.(this);}
}

function interactions() {
  const html = renderer().card('alice', 'node');
  const card = new Element('article', attributes(html.match(/^<article\b[^>]*>/)[0]));
  const profileTag = html.match(/<button\b[^>]*data-persona-profile[^>]*>/)?.[0];
  const profile = profileTag ? new Element('button', attributes(profileTag), card) : null;
  const follow = new Element('button', attributes(html.match(/<button\b[^>]*data-follow=[^>]*>/)[0]), card);
  const artifact = new Element('button', {'data-artid':'output'}, card);
  const customArtifact = new Element('span', {'data-artid':'output', role:'button', tabindex:'0'}, card);
  const details = new Element('details', {}, card), summary = new Element('summary', {}, details);
  const input = new Element('input', {}, card), textarea = new Element('textarea', {}, card);
  const opened = [], S = {follow:null, order:['persona', 'output'],
    recs:new Map([['persona', {kind:'persona', _kernel:'node', did:'persona/alice'}],
      ['output', {kind:'artifact', record_id:'output'}]])};
  let keyboard, stage, followChanges = 0;
  const values = {S, document:{addEventListener:(kind, handler) => {assert.equal(kind, 'keydown'); keyboard = handler;}},
    $:selector => {assert.equal(selector, '#sysEnvs'); return {addEventListener:(kind, handler) => {
      assert.equal(kind, 'click'); stage = handler;
    }};},
    MouseEvent:class {constructor(type, options) {this.type = type; Object.assign(this, options);}},
    _entityKeyFromDom:value => value, _personaKey:(kernel, sid) => `${kernel}:${sid}`,
    _shortId:value => value.split('/').at(-1), _applyFollow:() => {followChanges++;},
    renderInteractionStream() {}, openDetail:(id, origin) => opened.push({id, origin}), log() {},
  };
  new Function(...Object.keys(values),
    section('function publicFileViewFromControl(', 'function inspectionSourceControl(')
    + section('  // keyboard access:', '  // coordination-feed filters:')
    + section("  $('#sysEnvs').addEventListener('click'", '  // constellation node click')
  )(...Object.values(values));
  for (const element of [card, profile, follow, artifact, customArtifact, summary, input, textarea].filter(Boolean))
    element.onClick = target => stage({target, preventDefault() {}, stopPropagation() {}});
  const press = (target, key) => {
    let prevented = false;
    keyboard({target, key, preventDefault() {prevented = true;}});
    if (!prevented && target.tag === 'button') target.click();
    if (!prevented && target.tag === 'summary') {target.click(); details.open = !details.open;}
    return prevented;
  };
  return {card, profile, follow, artifact, customArtifact, details, summary, input, textarea,
    opened, S, press, followChanges:() => followChanges};
}

for (const key of ['Enter', ' ']) {
  test(`${JSON.stringify(key)} activates the profile once and preserves native nested actions`, () => {
    const profile = interactions();
    assert(profile.profile, 'The native profile button exists');
    assert.equal(profile.press(profile.profile, key), false);
    assert.equal(profile.profile.clicked, 1);
    assert.deepEqual(profile.opened.map(item => item.id), ['persona']);
    assert.equal(profile.followChanges(), 0);

    const follow = interactions();
    assert.equal(follow.press(follow.follow, key), false);
    assert.equal(follow.follow.clicked, 1);
    assert.equal(follow.followChanges(), 1);
    assert.equal(follow.S.follow, 'node:alice');
    assert.deepEqual(follow.opened, []);

    const artifact = interactions();
    assert.equal(artifact.press(artifact.artifact, key), false);
    assert.equal(artifact.artifact.clicked, 1);
    assert.deepEqual(artifact.opened.map(item => item.id), ['output']);

    const disclosure = interactions();
    assert.equal(disclosure.press(disclosure.summary, key), false);
    assert.equal(disclosure.details.open, true);
    assert.equal(disclosure.summary.clicked, 1);
    assert.deepEqual(disclosure.opened, []);
    assert.equal(disclosure.press(disclosure.input, key), false);
    assert.equal(disclosure.press(disclosure.textarea, key), false);
    assert.deepEqual(disclosure.opened, [], 'Native inputs never synthesize a click on their card');

    const custom = interactions();
    assert.equal(custom.press(custom.customArtifact, key), true);
    assert.equal(custom.customArtifact.clicked, 1);
    assert.deepEqual(custom.opened.map(item => item.id), ['output']);
    assert.equal(custom.press(custom.card, key), false);
    assert.equal(custom.card.clicked, 0, 'The article is not a keyboard button');
  });
}

test('each avatar state is a named image with decorative children hidden', () => {
  for (const [identityVerified, descriptor, label] of [
    [false, null, 'portrait withheld until persona identity proof verifies'],
    [true, null, 'avatar pending · not persona-authored; neutral person silhouette shown'],
    [true, {valid:true}, 'neutral person silhouette shown while persona-authored raster avatar is verified'],
  ]) {
    const values = {S:{personaDiscoveryByKey:new Map([['node:alice', {avatar:descriptor}]])}, esc,
      _personaRef:() => ({key:'node:alice', sid:'alice'}),
      normalizePersonaAvatar:value => value, _domEntityKey:value => value,
      _personaAvatarMountRevision:() => '', identiconSVG:() => '<svg aria-hidden="true"></svg>',
      _personaAvatarFallbackCopy:() => ({visible:'avatar pending · not persona-authored',
        accessible:'avatar pending · not persona-authored; neutral person silhouette shown', lifecycle:'pending'}),
    };
    const avatar = new Function(...Object.keys(values),
      section('function _personaAvatarHTML(', 'async function _decodePersonaAvatarBlob(')
      + '\nreturn _personaAvatarHTML;')(...Object.values(values));
    const html = avatar('node:alice', {identityVerified});
    const image = attributes(html.match(/^<span\b[^>]*>/)[0]);
    assert.equal(image.role, 'img');
    assert.equal(image['aria-label'], label);
    assert.equal(image['aria-hidden'], undefined);
    assert.match(html, /class="pc-avatar-placeholder" aria-hidden="true"/);
  }
});

test('drawer state and focus follow the native profile control after a live repaint', () => {
  const element = (classes = []) => {
    const names = new Set(classes), attrs = {};
    return {attrs, isConnected:true, focused:false,
      classList:{contains:name => names.has(name), add:name => names.add(name), remove:name => names.delete(name)},
      setAttribute:(name, value) => {attrs[name] = value;},
      focus() {this.focused = true;},
    };
  };
  const card = () => {
    const outer = element(['pcard']), profile = element();
    outer.dataset = {pkey:'node:alice', pcard:'alice', pkernel:'node'};
    outer.querySelector = selector => selector === '[data-persona-profile]' ? profile : null;
    profile.closest = () => outer;
    return {outer, profile};
  };
  const first = card(), replacement = card(), body = element(), drawer = element(['open']);
  let cards = [first.outer];
  const S = {_lastFocus:first.profile};
  const values = {S, document:{body, querySelectorAll:() => cards},
    $:selector => {assert.equal(selector, '#detailwrap'); return drawer;}, runViewCleanups() {}};
  const handlers = new Function(...Object.keys(values),
    section('function inspectionSourceControl(', 'function openDetail(')
    + section('  const closeDetail=()=>{', "  $('#logbtn').addEventListener")
    + '\nreturn {inspectionSourceControl, markInspectionSource, rebindInspectionSource, closeDetail};')(...Object.values(values));
  const environment = element(['env-card']);
  environment.querySelector = () => first.profile;
  assert.equal(handlers.inspectionSourceControl(environment), environment,
    'An environment inspector never binds to a nested persona profile button');
  handlers.markInspectionSource(first.profile);
  assert.equal(first.profile.attrs['aria-expanded'], 'true');
  assert.equal(first.profile.attrs['aria-controls'], 'detailwrap');
  assert.equal(first.outer.attrs['aria-expanded'], undefined);
  assert.equal(first.outer.classList.contains('inspecting'), true);

  first.outer.isConnected = first.profile.isConnected = false;
  cards = [replacement.outer];
  handlers.rebindInspectionSource();
  assert.equal(first.profile.attrs['aria-expanded'], 'false');
  assert.equal(first.outer.classList.contains('inspecting'), false);
  assert.equal(replacement.profile.attrs['aria-expanded'], 'true');
  assert.equal(replacement.outer.attrs['aria-expanded'], undefined);
  assert.equal(S._lastFocus, replacement.profile);

  handlers.closeDetail();
  assert.equal(replacement.profile.attrs['aria-expanded'], 'false');
  assert.equal(replacement.outer.attrs['aria-expanded'], undefined);
  assert.equal(replacement.profile.focused, true);
  assert.equal(replacement.outer.focused, false);
  assert.equal(body.classList.contains('detail-open'), false);
  assert.equal(drawer.classList.contains('open'), false);
  assert.equal(S._detailSource, null);
});
