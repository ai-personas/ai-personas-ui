'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const R = require('../design/reference-screens.js');
const manifest = JSON.parse(readFileSync(path.join(__dirname, '../design/source-images.json'), 'utf8'));

test('all seven supplied images have one unique review route', () => {
  assert.equal(R.screens.length, 7);
  assert.equal(new Set(R.screens.map(s => s.id)).size, 7);
  assert.deepEqual(R.screens.map(s => s.source).sort(), manifest.images.map(s => s.file).sort());
});
for (const s of R.screens) {
  test(`${s.id}: known image, original width and local-only URL`, () => {
    const image = manifest.images.find(image => image.file === s.source);
    assert.equal(s.width, image.width);
    assert.ok(Number.isSafeInteger(s.height) && s.height > 0 && s.height <= 2048);
    assert.equal(typeof s.fullPage, 'boolean');
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Object.isFrozen(s));
    assert.equal(R.find(s.id), s);
    const url = new URL(R.url(s), 'http://127.0.0.1/design/');
    assert.equal(url.origin, 'http://127.0.0.1');
    assert.equal(url.pathname, '/design/index.html');
    assert.equal(url.hash, s.route);
    assert.ok(s.note.length > 50);
  });
}
test('unknown, malformed and URL-looking selections fall back safely', () => {
  for (const id of ['', undefined, '__proto__', '%E0%A4%A', 'https://example.com', '<script>']) {
    assert.equal(R.find(id), R.screens[0]);
  }
  assert.throws(() => R.url({ route: 'https://example.com' }), TypeError);
  assert.ok(Object.isFrozen(R.screens));
});
test('only the information request has a non-authorizing deep link', () => {
  assert.deepEqual(R.screens.filter(s => s.preview).map(s => s.id), ['request-mobile']);
  assert.equal(R.url(R.find('request-mobile')), 'index.html?preview=request#/work');
  assert.equal(R.find('request-mobile').fullPage, false);
});
test('the narrow replay shares the same renderer and snapshot', () => {
  assert.equal(R.find('workspace-mobile').width, 266);
  assert.equal(R.url(R.find('workspace-desktop')), R.url(R.find('workspace-mobile')));
});
