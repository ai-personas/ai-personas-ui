import test from 'node:test';
import assert from 'node:assert/strict';
import { fileFormat, previewLimit } from '../src/files/formats.ts';
import { parseMesh, MeshBuilder, MODEL_BYTES, MAX_TRIANGLES } from '../src/files/mesh.ts';
import { parseGltf } from '../src/files/gltf.ts';
import { parseDelimited, TABLE_ROWS, TABLE_COLUMNS } from '../src/files/delimited.ts';
const bytes = text => new TextEncoder().encode(text).buffer;
const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3';
const stl = 'solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle';
const plyHeader = format => `ply\nformat ${format} 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n`;
function valid(mesh, triangles = 1) { assert.equal(mesh.triangles, triangles); assert.equal(mesh.positions.length, triangles * 9); assert.equal(mesh.normals.length, triangles * 9); assert([...mesh.positions, ...mesh.normals].every(Number.isFinite)); assert([...mesh.positions].every(n => Math.abs(n) <= 1)); return mesh; }
function gltf() {
  const data = Buffer.alloc(36); [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) => data.writeFloatLE(n, i * 4));
  return { asset: { version: '2.0' }, buffers: [{ byteLength: 36, uri: 'data:application/octet-stream;base64,' + data.toString('base64') }], bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
}
function glb(document = gltf()) {
  const body = Buffer.from(document.buffers[0].uri.split(',')[1], 'base64'); delete document.buffers[0].uri;
  let json = JSON.stringify(document); json += ' '.repeat((4 - Buffer.byteLength(json) % 4) % 4); const jsonBytes = Buffer.from(json), result = Buffer.alloc(28 + jsonBytes.length + body.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8); result.writeUInt32LE(jsonBytes.length, 12); result.writeUInt32LE(0x4e4f534a, 16); jsonBytes.copy(result, 20);
  result.writeUInt32LE(body.length, 20 + jsonBytes.length); result.writeUInt32LE(0x004e4942, 24 + jsonBytes.length); body.copy(result, 28 + jsonBytes.length); return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

test('routes six 3D formats, generic uploads and canonical MIME types', () => {
  for (const ext of ['STL', 'OBJ', 'PLY', 'OFF', 'GLTF', 'GLB']) assert.equal(fileFormat('folder/mesh.' + ext, 'application/octet-stream').kind, 'model');
  for (const mime of ['Model/STL; charset=utf-8', 'model/gltf+json', 'model/gltf-binary', 'application/x-stl', 'application/x-wavefront-obj', 'application/ply']) assert.equal(fileFormat('download', mime).kind, 'model');
  assert.equal(previewLimit('model'), MODEL_BYTES);
  assert.equal(fileFormat('mesh.blend').kind, 'unsupported'); assert.equal(fileFormat('mesh.fbx').kind, 'unsupported');
  assert.equal(fileFormat('page.html', 'model/stl').kind, 'text');
  for (const name of ['constructor', '__proto__', 'file.__proto__']) assert.equal(fileFormat(name, 'constructor').kind, 'unsupported');
});
test('CSV/TSV route to tables without changing JSON or code routing', () => {
  for (const name of ['DATA.CSV', 'data.tsv']) assert.equal(fileFormat(name, 'text/plain').kind, 'table');
  assert.equal(fileFormat('download', 'text/csv; charset=utf-16le').kind, 'table');
  for (const name of ['geometry.json', 'preview.html', 'program.py']) assert.equal(fileFormat(name).kind, 'text');
});
test('OBJ supports relative indices, normals/UV references and ignored material URLs', () => { valid(parseMesh(bytes(obj.replace('f 1 2 3', 'mtllib https://invalid.example/secret\nf -3/1/1 -2/2/1 -1/3/1')), 'obj')); });
test('OBJ triangulates quads and concave polygons', () => {
  valid(parseMesh(bytes('v 0 0 0\nv 2 0 0\nv 2 2 0\nv 1 1 0\nv 0 2 0\nf 1 2 3 4 5'), 'obj'), 3);
  valid(parseMesh(bytes('v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 4 3 2 1'), 'obj'), 2);
});
test('OBJ vertex colors do not change vertex positions', () => { assert.deepEqual(parseMesh(bytes(obj), 'obj').positions, parseMesh(bytes(obj.replaceAll('v ', 'v ').replace('v 1 0 0', 'v 1 0 0 0.5 0.2 0.3')), 'obj').positions); });
test('rejects bad OBJ indices, non-finite coordinates, empty and line-only geometry', () => {
  for (const text of [obj.replace('1 2 3', '0 2 3'), obj.replace('1 2 3', '1 2 4'), obj.replace('1 2 3', '1.5 2 3'), obj.replace('v 0 0 0', 'v NaN 0 0'), obj.replace('v 0 0 0', 'v Infinity 0 0'), 'v 0 0 0\nl 1 1', '']) assert.throws(() => parseMesh(bytes(text), 'obj'));
});
test('enforces byte and triangle budgets before rendering', () => {
  assert.throws(() => parseMesh(new ArrayBuffer(MODEL_BYTES + 1), 'obj'), /16 MiB/);
  const mesh = new MeshBuilder(); mesh.vertex(0, 0, 0); mesh.vertex(1, 0, 0); mesh.vertex(0, 1, 0);
  for (let i = 0; i < MAX_TRIANGLES; i++) mesh.face([0, 1, 2]); assert.throws(() => mesh.face([0, 1, 2]), /triangle preview limit/);
});
test('ASCII STL requires complete facets and end marker', () => {
  valid(parseMesh(bytes(stl), 'stl')); valid(parseMesh(bytes(stl + '\n' + stl), 'stl'), 2);
  assert.throws(() => parseMesh(bytes(stl.replace('vertex 0 1 0\n', '')), 'stl'));
  assert.throws(() => parseMesh(bytes(stl.replace('endsolid triangle', '')), 'stl'), /Truncated/);
});
test('binary STL wins over a misleading solid header and rejects truncation', () => {
  const buffer = new ArrayBuffer(134), view = new DataView(buffer); new Uint8Array(buffer).set(new TextEncoder().encode('solid binary'));
  view.setUint32(80, 1, true); [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) => view.setFloat32(96 + i * 4, n, true));
  valid(parseMesh(buffer, 'stl')); assert.throws(() => parseMesh(buffer.slice(0, 133), 'stl'));
});
test('OFF supports comments, inline counts and polygon faces', () => {
  valid(parseMesh(bytes('OFF 3 1 0\n# triangle\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2'), 'off'));
  assert.throws(() => parseMesh(bytes('OFF\n3 1 0\n0 0 0'), 'off'), /Truncated/);
});
test('ASCII PLY and binary PLY in both byte orders', () => {
  valid(parseMesh(bytes(plyHeader('ascii') + '0 0 0\n1 0 0\n0 1 0\n3 0 1 2'), 'ply'));
  for (const little of [true, false]) {
    const header = new TextEncoder().encode(plyHeader(little ? 'binary_little_endian' : 'binary_big_endian')), buffer = new ArrayBuffer(header.length + 49), view = new DataView(buffer); new Uint8Array(buffer).set(header);
    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) => view.setFloat32(header.length + i * 4, n, little)); view.setUint8(header.length + 36, 3);
    [0, 1, 2].forEach((n, i) => view.setInt32(header.length + 37 + i * 4, n, little)); valid(parseMesh(buffer, 'ply'));
    assert.throws(() => parseMesh(buffer.slice(0, -1), 'ply'), /Truncated/);
  }
});
test('rejects malformed PLY headers and excessive face lists', () => {
  assert.throws(() => parseMesh(bytes('ply\n'), 'ply'), /header/);
  assert.throws(() => parseMesh(bytes(plyHeader('ascii').replace('property float x', 'property constructor x')), 'ply'), /scalar/);
  assert.throws(() => parseMesh(bytes(plyHeader('ascii') + '0 0 0 1 0 0 0 1 0 999999'), 'ply'), /count/);
});
test('self-contained glTF and GLB render static geometry', () => { valid(parseGltf(bytes(JSON.stringify(gltf())))); valid(parseGltf(glb(), true)); });
test('glTF applies scene transforms and mesh instances', () => {
  const d = gltf(); d.nodes = [{ translation: [10, 20, 30], children: [1, 2] }, { mesh: 0, scale: [2, 3, 4] }, { mesh: 0, translation: [4, 0, 0] }]; valid(parseGltf(bytes(JSON.stringify(d))), 2);
});
test('glTF rejects external resources without fetching them', () => {
  for (const uri of ['https://example.com/file.bin', '../file.bin', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html;base64,AAAA']) {
    const d = gltf(); d.buffers[0].uri = uri; assert.throws(() => parseGltf(bytes(JSON.stringify(d))), /External/);
  }
});
test('glTF rejects out-of-bounds accessors, required codecs, skins and cycles', () => {
  for (const mutate of [d => { d.accessors[0].count = 999; }, d => { d.bufferViews[0].byteLength = 999; }, d => { d.extensionsRequired = ['KHR_draco_mesh_compression']; }, d => { d.nodes[0].skin = 0; }, d => { d.nodes[0].children = [0]; }, d => { d.accessors[0].sparse = {}; }, d => { d.meshes[0].primitives[0].targets = [{}]; }]) {
    const d = gltf(); mutate(d); assert.throws(() => parseGltf(bytes(JSON.stringify(d))));
  }
});
test('GLB rejects malformed version, total length and chunk boundaries', () => {
  for (const [offset, value] of [[4, 1], [8, 0], [12, 0xffffffff], [16, 0]]) { const b = glb(); new DataView(b).setUint32(offset, value, true); assert.throws(() => parseGltf(b, true)); }
});
test('CSV preserves quotes, commas, multiline values, BOM and CRLF', () => {
  assert.deepEqual(parseDelimited('\ufeffname,note\r\n"A, B","line 1\nline ""2"""\r\n', ',').rows, [['name', 'note'], ['A, B', 'line 1\nline "2"']]);
  assert.deepEqual(parseDelimited('a\tb\n1\t2', '\t').rows, [['a', 'b'], ['1', '2']]);
});
test('CSV keeps empty trailing cells, literal formulas and markup', () => {
  assert.deepEqual(parseDelimited('a,,\n=1+1,"<script>bad()</script>",', ',').rows, [['a', '', ''], ['=1+1', '<script>bad()</script>', '']]);
  assert.deepEqual(parseDelimited('', ',').rows, []); assert.deepEqual(parseDelimited('""', ',').rows, [['']]);
});
test('CSV malformed quotes produce a source-view error', () => { for (const text of ['"unfinished', 'un"quoted', '"done"bad']) assert.throws(() => parseDelimited(text, ','), /source view/); });
test('CSV limits rows and columns and omits incomplete byte-truncated records', () => {
  const rows = parseDelimited('a,b\n'.repeat(TABLE_ROWS + 1), ','); assert.equal(rows.rows.length, TABLE_ROWS); assert(rows.truncated);
  const columns = parseDelimited(Array(TABLE_COLUMNS + 1).fill('a').join(','), ','); assert.equal(columns.rows[0].length, TABLE_COLUMNS); assert(columns.truncated);
  assert.deepEqual(parseDelimited('a,b\n"partial', ',', true), { rows: [['a', 'b']], truncated: true });
  assert.equal(parseDelimited('a\n'.repeat(TABLE_ROWS), ',').truncated, false);
});
test('glTF handles indexed primitives in each unsigned index width', () => {
  for (const [componentType, size] of [[5121, 1], [5123, 2], [5125, 4]]) {
    const d = gltf(), buffer = Buffer.alloc(36 + size * 3); Buffer.from(d.buffers[0].uri.split(',')[1], 'base64').copy(buffer);
    [0, 1, 2].forEach((n, i) => buffer.writeUIntLE(n, 36 + i * size, size));
    d.buffers[0] = { byteLength: buffer.length, uri: 'data:application/octet-stream;base64,' + buffer.toString('base64') };
    d.bufferViews.push({ buffer: 0, byteOffset: 36, byteLength: size * 3 }); d.accessors.push({ bufferView: 1, count: 3, componentType, type: 'SCALAR' }); d.meshes[0].primitives[0].indices = 1;
    valid(parseGltf(bytes(JSON.stringify(d))));
    buffer.writeUIntLE(3, 36, size); d.buffers[0].uri = 'data:application/octet-stream;base64,' + buffer.toString('base64'); assert.throws(() => parseGltf(bytes(JSON.stringify(d))), /index exceeds/);
  }
});
test('glTF honors interleaved vertex strides and offsets', () => {
  const d = gltf(), buffer = Buffer.alloc(52); [[0, 0, 0], [1, 0, 0], [0, 1, 0]].forEach((row, i) => row.forEach((n, j) => buffer.writeFloatLE(n, 4 + i * 16 + j * 4)));
  d.buffers[0] = { byteLength: buffer.length, uri: 'data:application/octet-stream;base64,' + buffer.toString('base64') }; d.bufferViews[0] = { buffer: 0, byteLength: 52, byteStride: 16 }; d.accessors[0].byteOffset = 4;
  valid(parseGltf(bytes(JSON.stringify(d)))); d.bufferViews[0].byteStride = 2; assert.throws(() => parseGltf(bytes(JSON.stringify(d))), /bounds/);
});
test('glTF triangle strips and fans expand without duplicate triangles', () => {
  for (const mode of [5, 6]) { const d = gltf(); d.meshes[0].primitives[0].mode = mode; valid(parseGltf(bytes(JSON.stringify(d)))); }
});
