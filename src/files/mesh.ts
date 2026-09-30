/** Bounded, geometry-only readers. Never resolve material, texture or file URLs. */
export const MODEL_BYTES = 16 * 1024 * 1024;
export const MAX_TRIANGLES = 100_000;
const MAX_VERTICES = 300_000;
const MAX_FACE = 128;
export type Mesh = { positions: Float32Array; normals: Float32Array; triangles: number; vertices: number };
export type ModelType = 'stl' | 'obj' | 'off' | 'ply';

function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function integer(value: number, max: number) { check(Number.isSafeInteger(value) && value >= 0 && value <= max, 'Invalid or excessive model count.'); return value; }
function number(value: string) { check(value !== undefined && value.trim() !== '', 'Missing model coordinate.'); const n = Number(value); check(Number.isFinite(n) && Math.abs(n) <= 1e30, 'Invalid model coordinate.'); return n; }

export class MeshBuilder {
  points: number[] = [];
  indices: number[] = [];
  vertex(x: number, y: number, z: number) {
    check(this.points.length / 3 < MAX_VERTICES, 'Model exceeds the 300,000 vertex preview limit.');
    check([x, y, z].every(n => Number.isFinite(n) && Math.abs(n) <= 1e30), 'Invalid model coordinate.');
    this.points.push(x, y, z);
  }
  /** Ear clipping supports concave polygons; ambiguous faces fail explicitly. */
  face(face: number[]) {
    check(face.length >= 3 && face.length <= MAX_FACE, 'Faces must contain 3–128 vertices. Export a triangulated model.');
    check(face.every(i => Number.isSafeInteger(i) && i >= 0 && i < this.points.length / 3), 'A face refers to a missing vertex.');
    check(this.indices.length / 3 + face.length - 2 <= MAX_TRIANGLES, 'Model exceeds the 100,000 triangle preview limit.');
    if (face.length === 3) { this.indices.push(...face); return; }
    const normal = [0, 0, 0];
    for (let i = 0; i < face.length; i++) {
      const a = face[i] * 3, b = face[(i + 1) % face.length] * 3;
      for (let k = 0; k < 3; k++) normal[k] += (this.points[a + (k + 1) % 3] - this.points[b + (k + 1) % 3]) * (this.points[a + (k + 2) % 3] + this.points[b + (k + 2) % 3]);
    }
    const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
    const xy = (i: number) => [this.points[i * 3 + (axis + 1) % 3], this.points[i * 3 + (axis + 2) % 3]];
    const cross = (a: number, b: number, c: number) => { const p = xy(a), q = xy(b), r = xy(c); return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); };
    const direction = Math.sign(normal[axis]); check(direction, 'Degenerate polygon. Export a triangulated model.');
    const remaining = [...face];
    while (remaining.length > 3) {
      let clipped = false;
      for (let i = 0; i < remaining.length; i++) {
        const a = remaining[(i + remaining.length - 1) % remaining.length], b = remaining[i], c = remaining[(i + 1) % remaining.length];
        if (cross(a, b, c) * direction <= 0) continue;
        if (remaining.some(p => p !== a && p !== b && p !== c && cross(a, b, p) * direction >= 0 && cross(b, c, p) * direction >= 0 && cross(c, a, p) * direction >= 0)) continue;
        this.indices.push(a, b, c); remaining.splice(i, 1); clipped = true; break;
      }
      check(clipped, 'This polygon cannot be triangulated safely. Export a triangulated model.');
    }
    this.indices.push(...remaining);
  }
  finish(): Mesh {
    check(this.indices.length, 'No mesh faces found. Point clouds and line-only models are not supported.');
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    for (const i of this.indices) for (let k = 0; k < 3; k++) { const n = this.points[i * 3 + k]; low[k] = Math.min(low[k], n); high[k] = Math.max(high[k], n); }
    const center = low.map((n, k) => (n + high[k]) / 2), size = Math.max(...low.map((n, k) => high[k] - n));
    check(Number.isFinite(size) && size > 0, 'The model has no measurable extent.');
    const positions = new Float32Array(this.indices.length * 3), normals = new Float32Array(positions.length);
    for (let i = 0; i < this.indices.length; i++) for (let k = 0; k < 3; k++) positions[i * 3 + k] = (this.points[this.indices[i] * 3 + k] - center[k]) * 2 / size;
    for (let i = 0; i < positions.length; i += 9) {
      const a = [0, 1, 2].map(k => positions[i + 3 + k] - positions[i + k]), b = [0, 1, 2].map(k => positions[i + 6 + k] - positions[i + k]);
      const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], length = Math.hypot(...n) || 1;
      for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) normals[i + j * 3 + k] = n[k] / length;
    }
    return { positions, normals, triangles: this.indices.length / 3, vertices: this.points.length / 3 };
  }
}

function* lines(text: string) { for (const line of text.split(/\r\n|\n|\r/)) { const value = line.replace(/#.*/, '').trim(); if (value) yield value.split(/\s+/); } }
function obj(text: string, mesh: MeshBuilder) {
  for (const row of lines(text)) {
    if (row[0] === 'v') { check(row.length >= 4, 'Incomplete OBJ vertex.'); const w = row.length === 5 ? number(row[4]) : 1; check(w !== 0, 'Invalid OBJ homogeneous coordinate.'); mesh.vertex(number(row[1]) / w, number(row[2]) / w, number(row[3]) / w); }
    if (row[0] === 'f') mesh.face(row.slice(1).map(v => { const n = number(v.split('/')[0]); check(Number.isInteger(n) && n !== 0, 'Invalid OBJ vertex index.'); return n < 0 ? mesh.points.length / 3 + n : n - 1; }));
  }
}
function off(text: string, mesh: MeshBuilder) {
  const rows = lines(text), header = rows.next().value;
  check(header?.[0] === 'OFF', 'Expected an OFF mesh.');
  const counts = header.length > 1 ? header.slice(1) : rows.next().value;
  check(counts && counts.length >= 3, 'Missing OFF counts.');
  const vertices = integer(number(counts[0]), MAX_VERTICES), faces = integer(number(counts[1]), MAX_TRIANGLES);
  for (let i = 0; i < vertices; i++) { const row = rows.next().value; check(row && row.length >= 3, 'Truncated OFF vertices.'); mesh.vertex(number(row[0]), number(row[1]), number(row[2])); }
  for (let i = 0; i < faces; i++) { const row = rows.next().value; check(row, 'Truncated OFF faces.'); const count = integer(number(row[0]), MAX_FACE); check(row.length >= count + 1, 'Truncated OFF face.'); mesh.face(row.slice(1, count + 1).map(number)); }
}
function stl(buffer: ArrayBuffer, mesh: MeshBuilder) {
  const view = new DataView(buffer), count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  // Binary STL headers may begin with "solid"; exact structural length wins.
  if (buffer.byteLength >= 84 && 84 + count * 50 === buffer.byteLength) {
    integer(count, MAX_TRIANGLES);
    for (let i = 0; i < count; i++) {
      const first = mesh.points.length / 3;
      for (let j = 0; j < 3; j++) { const offset = 84 + i * 50 + 12 + j * 12; mesh.vertex(view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)); }
      mesh.face([first, first + 1, first + 2]);
    }
    return;
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  check(/^\s*solid(?:\s|$)/i.test(text), 'Invalid or truncated STL file.');
  let state = 'solid', face: number[] = [];
  for (const row of lines(text)) {
    const token = row[0].toLowerCase();
    if (token === 'solid') { check(state === 'solid' || state === 'done', 'Invalid STL solid.'); state = 'solid'; continue; }
    if (token === 'facet') { check(state === 'solid' && row[1] === 'normal' && row.length === 5, 'Invalid STL facet.'); row.slice(2).forEach(number); state = 'facet'; }
    else if (token === 'outer') { check(state === 'facet' && row[1] === 'loop', 'Invalid STL loop.'); state = 'loop'; }
    else if (token === 'vertex') { check(state === 'loop' && row.length === 4 && face.length < 3, 'Invalid STL vertex.'); face.push(mesh.points.length / 3); mesh.vertex(number(row[1]), number(row[2]), number(row[3])); }
    else if (token === 'endloop') { check(state === 'loop' && face.length === 3, 'Incomplete STL triangle.'); state = 'endloop'; }
    else if (token === 'endfacet') { check(state === 'endloop', 'Incomplete STL facet.'); mesh.face(face); face = []; state = 'solid'; }
    else if (token === 'endsolid') { check(state === 'solid', 'Truncated STL.'); state = 'done'; }
    else throw new Error('Invalid STL content.');
  }
  check(state === 'done', 'Truncated STL file.');
}

const scalarTypes: Record<string, [number, string]> = {
  char: [1, 'getInt8'], int8: [1, 'getInt8'], uchar: [1, 'getUint8'], uint8: [1, 'getUint8'],
  short: [2, 'getInt16'], int16: [2, 'getInt16'], ushort: [2, 'getUint16'], uint16: [2, 'getUint16'],
  int: [4, 'getInt32'], int32: [4, 'getInt32'], uint: [4, 'getUint32'], uint32: [4, 'getUint32'],
  float: [4, 'getFloat32'], float32: [4, 'getFloat32'], double: [8, 'getFloat64'], float64: [8, 'getFloat64'],
};
function ply(buffer: ArrayBuffer, mesh: MeshBuilder) {
  const head = new TextDecoder().decode(buffer.slice(0, Math.min(buffer.byteLength, 65536)));
  const end = /^end_header\r?\n/m.exec(head);
  check(head.startsWith('ply\n') || head.startsWith('ply\r\n'), 'Expected a PLY mesh.'); check(end, 'Missing or oversized PLY header.');
  const header = head.slice(0, end.index), bodyOffset = new TextEncoder().encode(head.slice(0, end.index + end[0].length)).length;
  type Property = { name: string; type: string; count?: string };
  const elements: { name: string; count: number; properties: Property[] }[] = [];
  let format = '';
  for (const row of lines(header)) {
    if (row[0] === 'format') { check(row[2] === '1.0' && !format, 'Unsupported PLY version.'); format = row[1]; }
    if (row[0] === 'element') { check(elements.length < 32, 'Too many PLY elements.'); elements.push({ name: row[1], count: integer(number(row[2]), MAX_VERTICES), properties: [] }); }
    if (row[0] === 'property') {
      const element = elements.at(-1); check(element && element.properties.length < 64, 'Invalid PLY properties.');
      const list = row[1] === 'list', type = row[list ? 3 : 1], count = list ? row[2] : undefined, name = row[list ? 4 : 2];
      check(Object.hasOwn(scalarTypes, type) && (!count || Object.hasOwn(scalarTypes, count)), 'Unsupported PLY scalar type.');
      check(name && !element.properties.some(p => p.name === name), 'Duplicate or missing PLY property.');
      element.properties.push({ name, type, count });
    }
  }
  check(['ascii', 'binary_little_endian', 'binary_big_endian'].includes(format), 'Unsupported PLY encoding.');
  check(elements.filter(e => e.name === 'vertex').length === 1 && elements.filter(e => e.name === 'face').length === 1, 'PLY must contain one vertex and one face element.');
  const vertex = elements.find(e => e.name === 'vertex')!;
  check(['x', 'y', 'z'].every(name => vertex.properties.some(p => p.name === name && !p.count)), 'Missing PLY coordinates.');
  const tokens = format === 'ascii' ? new TextDecoder('utf-8', { fatal: true }).decode(buffer.slice(bodyOffset)).matchAll(/\S+/g) : undefined;
  const view = new DataView(buffer); let offset = bodyOffset;
  function scalar(type: string) {
    if (tokens) { const token = tokens.next(); check(!token.done, 'Truncated PLY body.'); return number(token.value[0]); }
    const [size, method] = scalarTypes[type]; check(offset + size <= view.byteLength, 'Truncated PLY body.');
    const value = (view[method as keyof DataView] as (offset: number, little: boolean) => number).call(view, offset, format === 'binary_little_endian'); offset += size;
    check(Number.isFinite(value), 'Invalid PLY value.'); return value;
  }
  const faces: number[][] = []; let faceIndices = 0;
  for (const element of elements) for (let i = 0; i < element.count; i++) {
    const coordinates = [0, 0, 0]; let face: number[] | undefined;
    for (const property of element.properties) {
      if (property.count) {
        const count = integer(scalar(property.count), MAX_FACE), values = Array.from({ length: count }, () => scalar(property.type));
        if (element.name === 'face' && ['vertex_indices', 'vertex_index'].includes(property.name)) face = values;
      } else { const value = scalar(property.type); if (element.name === 'vertex') { const axis = ['x', 'y', 'z'].indexOf(property.name); if (axis >= 0) coordinates[axis] = value; } }
    }
    if (element.name === 'vertex') mesh.vertex(coordinates[0], coordinates[1], coordinates[2]);
    if (element.name === 'face') { check(face, 'Missing PLY face indices.'); faceIndices += face.length; check(faceIndices <= MAX_TRIANGLES * 3, 'PLY exceeds the face preview limit.'); faces.push(face); }
  }
  for (const face of faces) mesh.face(face);
}

export function parseMesh(buffer: ArrayBuffer, type: ModelType): Mesh {
  check(buffer.byteLength > 0 && buffer.byteLength <= MODEL_BYTES, '3D previews are limited to 16 MiB. Download the original for larger models.');
  const mesh = new MeshBuilder();
  if (type === 'stl') stl(buffer, mesh);
  else if (type === 'ply') ply(buffer, mesh);
  else if (type === 'obj') obj(new TextDecoder('utf-8', { fatal: true }).decode(buffer), mesh);
  else if (type === 'off') off(new TextDecoder('utf-8', { fatal: true }).decode(buffer), mesh);
  else throw new Error('Unsupported mesh format.');
  return mesh.finish();
}
