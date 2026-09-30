import { MeshBuilder, MODEL_BYTES, type Mesh } from './mesh.ts';

type Json = Record<string, any>;
function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function count(value: unknown, max = MODEL_BYTES): number { check(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max, 'Invalid glTF count or offset.'); return value; }
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function vector(value: unknown, size: number, fallback: number[]): number[] { if (value === undefined) return fallback; check(Array.isArray(value) && value.length === size && value.every(n => typeof n === 'number' && Number.isFinite(n)), 'Invalid glTF transform.'); return value; }
function multiply(a: number[], b: number[]) { const out = Array<number>(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return out; }
function transform(node: Json) {
  if (node.matrix !== undefined) {
    check(node.translation === undefined && node.rotation === undefined && node.scale === undefined, 'glTF cannot combine a matrix with TRS transforms.');
    const m = vector(node.matrix, 16, identity()); check(m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1, 'Invalid glTF affine matrix.'); return m;
  }
  const t = vector(node.translation, 3, [0, 0, 0]), s = vector(node.scale, 3, [1, 1, 1]), q = vector(node.rotation, 4, [0, 0, 0, 1]);
  const length = Math.hypot(...q); check(length > 0, 'Invalid glTF rotation.'); const [x, y, z, w] = q.map(n => n / length);
  return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, ...t, 1];
}

/** Static, uncompressed glTF 2.0 geometry. No network, image or script loading. */
export function parseGltf(input: ArrayBuffer, binary = false): Mesh {
  check(input.byteLength > 0 && input.byteLength <= MODEL_BYTES, '3D previews are limited to 16 MiB.');
  let document: Json, bin: ArrayBuffer | undefined;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  if (binary) {
    const view = new DataView(input);
    check(input.byteLength >= 20 && view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === input.byteLength, 'Invalid GLB 2.0 header.');
    let offset = 12, json: string | undefined;
    while (offset < input.byteLength) {
      check(offset + 8 <= input.byteLength, 'Truncated GLB chunk.'); const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true); offset += 8;
      check(length % 4 === 0 && offset + length <= input.byteLength, 'Invalid GLB chunk length.');
      check(json !== undefined || type === 0x4e4f534a, 'GLB must start with a JSON chunk.');
      if (type === 0x4e4f534a) { check(json === undefined, 'Duplicate GLB JSON chunk.'); json = decoder.decode(input.slice(offset, offset + length)); }
      if (type === 0x004e4942) { check(bin === undefined, 'Duplicate GLB binary chunk.'); bin = input.slice(offset, offset + length); }
      offset += length;
    }
    check(json, 'Missing GLB JSON.'); document = JSON.parse(json);
  } else document = JSON.parse(decoder.decode(input));
  check(document && document.asset?.version === '2.0' && (!document.asset.minVersion || document.asset.minVersion === '2.0'), 'Only glTF 2.0 is supported by this geometry preview.');
  check(!document.extensionsRequired?.length, 'This glTF requires unsupported extensions. Export an uncompressed glTF 2.0 mesh.');
  const definitions = document.buffers;
  check(Array.isArray(definitions) && definitions.length <= 32, 'Invalid glTF buffers.'); let total = 0;
  const buffers: ArrayBuffer[] = definitions.map((definition: Json, i: number) => {
    const expected = count(definition.byteLength); total += expected; check(total <= MODEL_BYTES, 'Embedded glTF buffers exceed the 16 MiB preview limit.');
    if (definition.uri === undefined) { check(i === 0 && bin && expected <= bin.byteLength && bin.byteLength - expected <= 3, 'Missing or incorrectly sized GLB binary data.'); return bin.slice(0, expected); }
    check(typeof definition.uri === 'string', 'Invalid glTF buffer URI.');
    const match = /^data:application\/(?:octet-stream|gltf-buffer);base64,([A-Za-z0-9+/]*={0,2})$/.exec(definition.uri);
    check(match, 'External glTF buffers are not loaded. Export a self-contained GLB or embed the buffers.');
    check(match[1].length <= Math.ceil(expected / 3) * 4, 'Embedded glTF buffer is larger than declared.');
    const raw = atob(match[1]); check(raw.length === expected, 'Embedded glTF buffer length mismatch.');
    return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer;
  });
  function accessor(index: unknown, positions: boolean) {
    const a = document.accessors?.[count(index, 100_000)];
    check(a && !a.sparse && a.bufferView !== undefined && !a.normalized, 'Sparse, normalized or missing glTF accessors are not supported.');
    const components = positions ? 3 : 1;
    check(a.type === (positions ? 'VEC3' : 'SCALAR') && (positions ? a.componentType === 5126 : [5121, 5123, 5125].includes(a.componentType)), 'Unsupported glTF position or index type.');
    const size = a.componentType === 5121 ? 1 : a.componentType === 5123 ? 2 : 4, n = count(a.count, 300_000);
    check(n > 0, 'Empty glTF accessor.'); const v = document.bufferViews?.[count(a.bufferView, 100_000)]; check(v && !v.extensions, 'Missing or compressed glTF buffer view.');
    const buffer = buffers[count(v.buffer, 31)]; check(buffer, 'Missing glTF buffer.');
    const start = count(v.byteOffset ?? 0), length = count(v.byteLength), local = count(a.byteOffset ?? 0), stride = count(v.byteStride ?? size * components, 252);
    check(stride >= size * components && stride % size === 0 && (start + local) % size === 0 && start + length <= buffer.byteLength && local + (n - 1) * stride + size * components <= length, 'glTF accessor exceeds its buffer bounds.');
    const view = new DataView(buffer);
    return { count: n, get(i: number, c = 0) { const offset = start + local + i * stride + c * size; return positions ? view.getFloat32(offset, true) : size === 1 ? view.getUint8(offset) : size === 2 ? view.getUint16(offset, true) : view.getUint32(offset, true); } };
  }
  const mesh = new MeshBuilder(), nodes = document.nodes;
  check(Array.isArray(nodes) && nodes.length <= 4096, 'Missing or excessive glTF nodes.');
  const parents = new Set<number>();
  for (const node of nodes) {
    check(node && (!node.children || Array.isArray(node.children)), 'Invalid glTF node.');
    for (const child of node.children ?? []) { count(child, nodes.length - 1); check(!parents.has(child), 'glTF nodes must form a tree.'); parents.add(child); }
  }
  let roots: number[];
  if (document.scenes !== undefined) { const scene = document.scenes?.[count(document.scene ?? 0, 4096)]; check(scene && Array.isArray(scene.nodes), 'Missing glTF scene.'); roots = scene.nodes; }
  else roots = nodes.map((_: Json, i: number) => i).filter((i: number) => !parents.has(i));
  check(roots.length > 0 && roots.length <= 4096, 'Empty or cyclic glTF scene.');
  const visited = new Set<number>();
  function visit(index: number, parent: number[], depth: number) {
    count(index, nodes.length - 1); check(depth <= 128 && !visited.has(index), 'Cyclic, repeated or overly deep glTF node.'); visited.add(index);
    const node = nodes[index]; check(node.skin === undefined, 'Skinned models are not supported. Export a static mesh.'); const matrix = multiply(parent, transform(node));
    if (node.mesh !== undefined) {
      const source = document.meshes?.[count(node.mesh, 100_000)]; check(source && Array.isArray(source.primitives) && source.primitives.length <= 10_000, 'Invalid glTF mesh.');
      for (const p of source.primitives) {
        check(!p.targets?.length && !p.extensions, 'Compressed or morph-target geometry is not supported. Export a static mesh.');
        const mode = p.mode ?? 4; check([4, 5, 6].includes(mode), 'Only glTF triangle meshes are supported.');
        const position = accessor(p.attributes?.POSITION, true), first = mesh.points.length / 3;
        for (let i = 0; i < position.count; i++) {
          const x = position.get(i, 0), y = position.get(i, 1), z = position.get(i, 2);
          mesh.vertex(matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12], matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13], matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]);
        }
        const indices = p.indices === undefined ? undefined : accessor(p.indices, false), n = indices?.count ?? position.count;
        const indexAt = (i: number) => { const value = indices ? indices.get(i) : i; check(value < position.count, 'glTF index exceeds the primitive vertex count.'); return first + value; };
        check(n >= 3 && (mode !== 4 || n % 3 === 0), 'Incomplete glTF triangles.');
        for (let i = 2; i < n; i += mode === 4 ? 3 : 1) {
          const a = indexAt(mode === 6 ? 0 : i - 2), b = indexAt(i - 1), c = indexAt(i);
          if (a !== b && b !== c && a !== c) mesh.face(mode === 5 && i % 2 ? [b, a, c] : [a, b, c]);
        }
      }
    }
    for (const child of node.children ?? []) visit(child, matrix, depth + 1);
  }
  for (const root of roots) { check(!parents.has(root), 'A glTF scene root has a parent.'); visit(root, identity(), 0); }
  return mesh.finish();
}
