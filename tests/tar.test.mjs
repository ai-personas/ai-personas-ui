import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { scanTar } from '../src/files/tar.ts';
import { archiveFormat, archivePath, ArchivePaths, fileFormat, folderItems } from '../src/files/formats.ts';
const encode = value => Buffer.from(value);
function header(name, size, type = '0', extra = {}) {
  const out = Buffer.alloc(512);
  const put = (offset, width, value) => out.write(value, offset, width, 'utf8');
  put(0, 100, name); put(100, 8, '0000644'); put(108, 8, '0000000'); put(116, 8, '0000000');
  put(124, 12, size.toString(8).padStart(11, '0')); put(136, 12, '00000000000');
  out.fill(32, 148, 156); out[156] = type.charCodeAt(0); put(257, 6, 'ustar'); put(263, 2, '00');
  if (extra.prefix) put(345, 155, extra.prefix);
  if (extra.sizeBytes) extra.sizeBytes.copy(out, 124);
  const sum = out.reduce((a, b) => a + b, 0);
  put(148, 8, sum.toString(8).padStart(6, '0') + '\0 ');
  return out;
}
function member(name, value = '', type = '0', extra = {}) {
  const content = Buffer.isBuffer(value) ? value : encode(value);
  return Buffer.concat([header(name, content.length, type, extra), content, Buffer.alloc((512 - content.length % 512) % 512)]);
}
const tar = (...members) => Buffer.concat([...members, Buffer.alloc(1024)]);
function pax(key, value) {
  const body = ` ${key}=${value}\n`; let count = Buffer.byteLength(body) + 1;
  while (Buffer.byteLength(String(count) + body) !== count) count = Buffer.byteLength(String(count) + body);
  return encode(String(count) + body);
}
async function read(bytes, extra = {}) { return scanTar(new Blob([bytes]), { gzip: false, signal: new AbortController().signal, ...extra }); }

test('TAR, TAR.GZ and TGZ are recognized without changing ZIP or HTML handling', () => {
  for (const name of ['bundle.tar', 'bundle.TAR.GZ', 'bundle.tgz']) assert.equal(fileFormat(name).kind, 'archive');
  assert.equal(archiveFormat('bundle.tar'), 'tar');
  assert.equal(archiveFormat('bundle.TAR.GZ'), 'tar_gzip');
  assert.equal(archiveFormat('download', 'application/x-gzip'), 'tar_gzip');
  assert.equal(archiveFormat('bundle.zip'), 'zip');
  assert.equal(fileFormat('index.html').kind, 'text');
});
test('listing retains no member blobs and extraction retains only the selected member', async () => {
  const bytes = tar(member('./plans', '', '5'), member('plans/a.txt', 'one'), member('b.txt', 'two'));
  const listing = await read(bytes);
  assert.equal(listing.blob, undefined);
  assert.deepEqual(listing.entries.map(e => e.path), ['plans', 'plans/a.txt', 'b.txt']);
  assert.equal(folderItems(listing.entries, 'plans')[0].name, 'a.txt');
  const extracted = await read(bytes, { selected: listing.entries[1] });
  assert.equal(await extracted.blob.text(), 'one');
});
test('GZIP listing and extraction verify the trailer and preserve exact bytes', async () => {
  const bytes = gzipSync(tar(member('payload.bin', Buffer.from([0, 1, 2, 255]))));
  const listing = await read(bytes, { gzip: true });
  const result = await read(bytes, { gzip: true, selected: listing.entries[0] });
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), new Uint8Array([0, 1, 2, 255]));
  const corrupt = Buffer.from(bytes); corrupt[corrupt.length - 8] ^= 1;
  await assert.rejects(read(corrupt, { gzip: true }));
});
test('USTAR prefixes and PAX Unicode long paths are preserved', async () => {
  const path = 'drawings/' + 'étage-'.repeat(25) + '.svg';
  const bytes = tar(member('a.txt', 'a', '0', { prefix: 'docs' }), member('pax', pax('path', path), 'x'), member('short', 'svg'));
  const listing = await read(bytes);
  assert.equal(listing.entries[0].path, 'docs/a.txt'); assert.equal(listing.entries[1].path, path);
  assert.equal(await (await read(bytes, { selected: listing.entries[1] })).blob.text(), 'svg');
});
test('GNU long names and explicit root-directory entries are supported', async () => {
  const long = 'folder/'.repeat(30) + 'file.txt';
  const listing = await read(tar(member('./', '', '5'), member('././@LongLink', long + '\0', 'L'), member('short', 'value')));
  assert.equal(listing.entries.length, 1); assert.equal(listing.entries[0].path, long);
});
test('unsafe names and normalized drive paths fail closed', async () => {
  for (const path of ['../escape', '/absolute', 'C:/drive', './/C:/drive', 'dir/../escape', 'a\u0001b']) {
    await assert.rejects(read(tar(member(path, 'x'))), /archive|TAR/);
  }
  assert.throws(() => archivePath('.//C:/drive'));
});
test('links, devices, FIFOs and sparse members are never followed', async () => {
  for (const type of ['1', '2', '3', '4', '6', 'S']) await assert.rejects(read(tar(member('unsafe', '', type))), /special|links/);
});
test('duplicate normalized paths are rejected', async () => {
  await assert.rejects(read(tar(member('./a.txt', 'a'), member('a.txt', 'b'))), /duplicate/);
});
test('file-folder collisions are rejected in both orders, including implicit parents', async () => {
  for (const entries of [[member('a', 'a'), member('a/b', 'b')], [member('a/b', 'b'), member('a', 'a')], [member('a', '', '5'), member('a', 'a')]]) {
    await assert.rejects(read(tar(...entries)), /folder|conflicting/);
  }
  const paths = new ArchivePaths(); paths.add('a/b', false); paths.add('a', true);
});
test('corrupt checksums and truncated members/end markers are rejected', async () => {
  const broken = tar(member('a.txt', 'one')); broken[0] ^= 1;
  await assert.rejects(read(broken), /checksum/);
  await assert.rejects(read(header('a.txt', 1024)), /truncated/);
  await assert.rejects(read(Buffer.concat([member('a.txt', 'x'), Buffer.alloc(512)])), /truncated/);
});
test('nonzero trailing data and concatenated TAR content are not hidden', async () => {
  await assert.rejects(read(Buffer.concat([tar(member('a', 'a')), member('b', 'b')])), /end markers/);
});
test('PAX duplicate keys, unsafe overrides, dangling records and sparse metadata are rejected', async () => {
  for (const body of [Buffer.concat([pax('path', 'a'), pax('path', 'b')]), pax('path', '../escape'), pax('GNU.sparse.map', '0,5')]) {
    await assert.rejects(read(tar(member('pax', body, 'x'), member('a', 'a'))));
  }
  await assert.rejects(read(tar(member('pax', pax('path', 'a'), 'x'))), /no member/);
  await assert.rejects(read(tar(member('pax', pax('path', 'a'), 'g'), member('a', 'a'))), /global/);
});
test('PAX byte lengths and decimal sizes must be strict and bounded', async () => {
  for (const body of [encode('999 path=x\n'), encode('x path=y\n'), pax('size', '-1'), pax('size', '9007199254740993')]) {
    await assert.rejects(read(tar(member('pax', body, 'x'), member('a', 'a'))));
  }
});
test('decompression and selected-file limits apply before retention', async () => {
  const bytes = tar(member('a', 'x'.repeat(4096)));
  await assert.rejects(read(bytes, { maximumScanBytes: 1024 }), /scan/);
  const listing = await read(bytes);
  await assert.rejects(read(bytes, { selected: listing.entries[0], limit: 100 }), /limit/);
  await assert.rejects(read(bytes, { maximumScanBytes: NaN }), /limit/);
});
test('selected identity and size must match the indexed member', async () => {
  const bytes = tar(member('a', 'a')), listing = await read(bytes);
  for (const patch of [{ path: 'b' }, { size: 2 }, { index: 1 }]) await assert.rejects(read(bytes, { selected: { ...listing.entries[0], ...patch } }));
});
test('abort before and during extraction releases the reader without returning a blob', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(read(tar(member('a', 'a')), { signal: controller.signal }), /abort/i);
  const bytes = tar(member('a', 'x'.repeat(65536))), listing = await read(bytes), active = new AbortController();
  await assert.rejects(read(bytes, { selected: listing.entries[0], signal: active.signal, progress: () => active.abort() }), /abort/i);
});
test('zero-length members and empty archives are valid; zero-byte input is not', async () => {
  assert.equal((await read(tar())).entries.length, 0);
  const bytes = tar(member('empty', '')), listing = await read(bytes);
  assert.equal((await read(bytes, { selected: listing.entries[0], limit: 0 })).blob.size, 0);
  await assert.rejects(read(Buffer.alloc(0)));
});
test('positive base-256 sizes work, while negative sizes and invalid UTF-8 names fail', async () => {
  const sizeBytes = Buffer.alloc(12); sizeBytes[0] = 0x80; sizeBytes[11] = 1;
  assert.equal((await read(tar(member('a', 'x', '0', { sizeBytes })))).entries[0].size, 1);
  sizeBytes[0] = 0xff;
  await assert.rejects(read(tar(member('a', 'x', '0', { sizeBytes }))));
  const invalid = tar(member('a', 'x')); invalid[0] = 0xff; invalid.fill(32, 148, 156);
  const sum = invalid.subarray(0, 512).reduce((a, b) => a + b, 0);
  invalid.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  await assert.rejects(read(invalid));
});
