import test from 'node:test';
import assert from 'node:assert/strict';
import { fileFormat, archivePath, folderItems } from '../src/files/formats.ts';

test('file previews recognize generic uploads, MIME parameters, uppercase extensions and source formats', () => {
  for (const [name, mime, kind] of [
    ['PLAN.SVG', 'application/octet-stream', 'image'], ['README.MD', 'text/plain', 'markdown'],
    ['download', 'Text/Markdown; charset=UTF-8', 'markdown'], ['house.ZIP', '', 'archive'],
    ['download', 'application/x-zip-compressed', 'archive'], ['plan.png', '', 'image'],
    ['notes.txt', 'text/plain', 'text'], ['preview.html', 'text/html', 'text'],
    ['source.py', '', 'text'], ['toolpath.nc', '', 'text'], ['geometry.json', '', 'text'],
    ['model.blend', 'application/octet-stream', 'unsupported'], ['README', '', 'text'],
    ['constructor', '', 'unsupported'], ['file.__proto__', '', 'unsupported'],
    ['sound.wav', '', 'audio'], ['movie.webm', '', 'video'], ['drawing.pdf', '', 'pdf'],
  ]) assert.equal(fileFormat(name, mime).kind, kind, name + ' / ' + mime);
});
test('archive paths remain inside the archive and have an actual readable name', () => {
  assert.equal(archivePath('./plans/floor.svg'), 'plans/floor.svg');
  assert.equal(archivePath('plans\\étage 2.svg'), 'plans/étage 2.svg');
  for (const path of ['../outside.txt', '/absolute.txt', 'C:\\Windows\\file', 'plans/../../file', 'bad\0name', '.', './', '']) assert.throws(() => archivePath(path), /archive/);
});
test('folder browsing preserves implicit, explicit, empty and similarly named paths without prefix leaks', () => {
  const entries = [
    { index: 0, path: 'plans/floor.svg', directory: false, size: 10, encrypted: false },
    { index: 1, path: 'plans-old/private.txt', directory: false, size: 10, encrypted: false },
    { index: 2, path: 'plans/empty', directory: true, size: 0, encrypted: false },
    { index: 3, path: 'README.md', directory: false, size: 10, encrypted: false },
    { index: 4, path: 'plans', directory: false, size: 10, encrypted: false },
  ];
  assert.deepEqual(folderItems(entries, 'plans').map(item => [item.name, item.directory]), [['empty', true], ['floor.svg', false]]);
  assert.deepEqual(folderItems(entries, 'plans/empty'), []);
  const root = folderItems(entries, '');
  assert.equal(root.filter(item => item.name === 'plans').length, 2);
  assert(root[0].directory && root[1].directory);
});
