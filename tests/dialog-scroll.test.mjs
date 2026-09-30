import test from 'node:test';
import assert from 'node:assert/strict';
import { lockDialogScroll } from '../src/dialog-scroll.ts';

function documentFixture({ scrollbar = 0, gutter = 'auto', initial = {} } = {}) {
  const values = new Map(Object.entries(initial).map(([name, pair]) => [name, [...pair]]));
  const style = {
    getPropertyValue: name => values.get(name)?.[0] || '',
    getPropertyPriority: name => values.get(name)?.[1] || '',
    setProperty: (name, value, priority = '') => values.set(name, [value, priority]),
    removeProperty: name => values.delete(name),
  };
  const doc = { documentElement: { style, clientWidth: 1200 - scrollbar },
    defaultView: { innerWidth: 1200, getComputedStyle: () => ({ scrollbarGutter: gutter }) } };
  return { doc, style, values };
}

test('locks both axes and removes only its own inline properties on release', () => {
  const { doc, style, values } = documentFixture({ initial: { color: ['green', ''] } });
  const release = lockDialogScroll(doc);
  for (const name of ['overflow-x', 'overflow-y']) {
    assert.equal(style.getPropertyValue(name), 'hidden');
    assert.equal(style.getPropertyPriority(name), 'important');
  }
  release();
  assert.deepEqual([...values], [['color', ['green', '']]]);
});

test('reserves an existing classic scrollbar without adding padding', () => {
  const { doc, style } = documentFixture({ scrollbar: 15 });
  const release = lockDialogScroll(doc);
  assert.equal(style.getPropertyValue('scrollbar-gutter'), 'stable');
  assert.equal(style.getPropertyValue('padding-right'), '');
  release();
  assert.equal(style.getPropertyValue('scrollbar-gutter'), '');
});

test('does not introduce a gutter on pages without a classic scrollbar', () => {
  const { doc, style } = documentFixture();
  const release = lockDialogScroll(doc);
  assert.equal(style.getPropertyValue('scrollbar-gutter'), '');
  release();
});

test('keeps an existing stable both-edges gutter', () => {
  const { doc, style } = documentFixture({ scrollbar: 30, gutter: 'stable both-edges' });
  const release = lockDialogScroll(doc);
  assert.equal(style.getPropertyValue('scrollbar-gutter'), '');
  release();
});

test('nested dialogs keep the page locked until the last release', () => {
  const { doc, style } = documentFixture();
  const outer = lockDialogScroll(doc), inner = lockDialogScroll(doc);
  inner();
  assert.equal(style.getPropertyValue('overflow-y'), 'hidden');
  outer();
  assert.equal(style.getPropertyValue('overflow-y'), '');
});

test('out-of-order unmounts and duplicate cleanup cannot unlock another modal', () => {
  const { doc, style } = documentFixture();
  const outer = lockDialogScroll(doc), inner = lockDialogScroll(doc);
  outer(); outer();
  assert.equal(style.getPropertyValue('overflow-y'), 'hidden');
  inner(); inner();
  assert.equal(style.getPropertyValue('overflow-y'), '');
});

test('restores distinct inline axis values and their priorities exactly', () => {
  const initial = { 'overflow-x': ['clip', 'important'], 'overflow-y': ['scroll', ''],
    'scrollbar-gutter': ['auto', 'important'] };
  const { doc, values } = documentFixture({ scrollbar: 15, initial });
  const release = lockDialogScroll(doc);
  release();
  assert.deepEqual(Object.fromEntries(values), initial);
});

test('locks are independent across documents and can be reacquired', () => {
  const a = documentFixture(), b = documentFixture();
  const releaseA = lockDialogScroll(a.doc), releaseB = lockDialogScroll(b.doc);
  releaseA();
  assert.equal(b.style.getPropertyValue('overflow-y'), 'hidden');
  const again = lockDialogScroll(a.doc);
  releaseA();
  assert.equal(a.style.getPropertyValue('overflow-y'), 'hidden');
  again(); releaseB();
  assert.equal(a.style.getPropertyValue('overflow-y'), '');
  assert.equal(b.style.getPropertyValue('overflow-y'), '');
});

test('detached documents do not require a window to release their styles', () => {
  const { doc, style } = documentFixture();
  doc.defaultView = null;
  const release = lockDialogScroll(doc);
  assert.equal(style.getPropertyValue('overflow-y'), 'hidden');
  release();
  assert.equal(style.getPropertyValue('overflow-y'), '');
});

test('browsers without a computed scrollbar-gutter property still lock safely', () => {
  const { doc, style } = documentFixture({ scrollbar: 15 });
  doc.defaultView.getComputedStyle = () => ({});
  const release = lockDialogScroll(doc);
  assert.equal(style.getPropertyValue('overflow-y'), 'hidden');
  release();
  assert.equal(style.getPropertyValue('overflow-y'), '');
});
