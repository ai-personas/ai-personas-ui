/* Local-only CAD inspector. It derives bounded metadata from verified bytes;
 * interactive parsing/execution belongs in an isolated tool. */

export const meta = {
  exts: ['step','stp','ifc','stl','3mf','obj','gltf','glb','ply'],
  media_kinds: ['cad','cad3d','mesh','3d','model','step','ifc','stl','gltf','glb','obj','ply','3mf'],
  fetchMode: 'bytes',
  label: 'CAD descriptor',
};

export function assertSelfContainedGltf(buffer, ext) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let jsonText = '';
  if (ext === 'glb') {
    if (bytes.byteLength < 20) throw new Error('glb header truncated');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== 0x46546c67) throw new Error('invalid glb magic');
    let offset = 12;
    while (offset + 8 <= bytes.byteLength) {
      const length = view.getUint32(offset, true);
      const type = view.getUint32(offset + 4, true);
      offset += 8;
      if (offset + length > bytes.byteLength) throw new Error('glb chunk truncated');
      if (type === 0x4e4f534a) {
        jsonText = new TextDecoder().decode(bytes.subarray(offset, offset + length)).replace(/\0+$/,'');
        break;
      }
      offset += length;
    }
    if (!jsonText) throw new Error('glb JSON chunk missing');
  } else {
    jsonText = new TextDecoder().decode(bytes);
  }
  let document;
  try { document = JSON.parse(jsonText); } catch (_) { throw new Error('invalid glTF JSON'); }
  const pending = [document]; let visited = 0;
  while (pending.length) {
    const value = pending.pop();
    if (++visited > 100_000) throw new Error('glTF structure exceeds client limit');
    if (Array.isArray(value)) { pending.push(...value); continue; }
    if (!value || typeof value !== 'object') continue;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'uri' && typeof child === 'string' && !child.startsWith('data:')) {
        throw new Error('external glTF dependency refused');
      }
      if (child && typeof child === 'object') pending.push(child);
    }
  }
  return document;
}

function decoded(bytes) {
  return new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.byteLength, 8 * 1024 * 1024)));
}

function textGeometryFacts(text, ext) {
  const lines = text.split(/\r?\n/);
  const facts = [];
  if (ext === 'obj') {
    let vertices = 0, normals = 0, faces = 0, linesCount = 0, external = 0;
    for (const line of lines) {
      if (/^v\s/.test(line)) vertices++;
      else if (/^vn\s/.test(line)) normals++;
      else if (/^f\s/.test(line)) faces++;
      else if (/^l\s/.test(line)) linesCount++;
      else if (/^(?:mtllib|usemtl)\s/.test(line)) external++;
    }
    facts.push(['Vertices', vertices], ['Normals', normals], ['Faces', faces], ['Line elements', linesCount]);
    facts.push(['Material references', external ? `${external} declared · not fetched` : 'none declared']);
  } else if (ext === 'ifc' || ext === 'step' || ext === 'stp') {
    let entities = 0, ifcEntities = 0;
    for (const line of lines) {
      if (/^#\d+\s*=/.test(line)) entities++;
      if (/^#\d+\s*=\s*IFC[A-Z0-9_]+/i.test(line)) ifcEntities++;
    }
    const schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(text)?.[1] || '';
    facts.push(['STEP envelope', /^ISO-10303-21;/i.test(text.trimStart()) ? 'recognized' : 'not recognized']);
    if (schema) facts.push(['Schema', schema]);
    facts.push(['Entities inspected', entities]);
    if (ext === 'ifc') facts.push(['IFC entities', ifcEntities]);
  } else if (ext === 'ply') {
    const header = text.slice(0, Math.max(0, text.indexOf('end_header') + 10));
    facts.push(['PLY header', /^ply\s*$/m.test(header) ? 'recognized' : 'not recognized']);
    for (const name of ['vertex', 'face']) {
      const count = new RegExp(`^element\\s+${name}\\s+(\\d+)`, 'mi').exec(header)?.[1];
      if (count) facts.push([`${name[0].toUpperCase()}${name.slice(1)} elements`, count]);
    }
    const format = /^format\s+([^\s]+)/mi.exec(header)?.[1];
    if (format) facts.push(['Encoding', format]);
  }
  return facts;
}

export function inspectCadBytes(buffer, extValue) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const ext = String(extValue || '').toLowerCase();
  const result = {format: ext || 'cad', byteLength: bytes.byteLength, facts: [], preview: ''};
  if (ext === 'gltf' || ext === 'glb') {
    const document = assertSelfContainedGltf(bytes, ext);
    result.facts.push(['Container', ext === 'glb' ? 'binary glTF 2.x' : 'JSON glTF']);
    result.facts.push(['Scenes', Array.isArray(document.scenes) ? document.scenes.length : 0]);
    result.facts.push(['Nodes', Array.isArray(document.nodes) ? document.nodes.length : 0]);
    result.facts.push(['Meshes', Array.isArray(document.meshes) ? document.meshes.length : 0]);
    result.facts.push(['External dependencies', 'none · verified self-contained']);
    if (ext === 'gltf') result.preview = decoded(bytes).slice(0, 8192);
    return result;
  }
  if (ext === 'stl') {
    if (bytes.byteLength >= 84) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const triangles = view.getUint32(80, true);
      if (84 + triangles * 50 === bytes.byteLength) {
        result.facts.push(['Encoding', 'binary STL'], ['Triangles', triangles]);
        return result;
      }
    }
    const text = decoded(bytes);
    const triangles = (text.match(/^\s*facet\s+normal\b/gmi) || []).length;
    result.facts.push(['Encoding', /^\s*solid\b/i.test(text) ? 'ASCII STL' : 'unrecognized STL'], ['Facets inspected', triangles]);
    result.preview = text.slice(0, 8192);
    return result;
  }
  if (['obj', 'ifc', 'step', 'stp', 'ply'].includes(ext)) {
    const text = decoded(bytes);
    result.facts.push(...textGeometryFacts(text, ext));
    result.preview = text.slice(0, 8192);
    return result;
  }
  if (ext === '3mf') result.facts.push(['Container', '3MF ZIP package'], ['Embedded execution', 'disabled']);
  else result.facts.push(['Format', ext || 'unknown CAD/mesh']);
  return result;
}

export async function render(ctx) {
  const ext = String(ctx.ext || ctx.title?.split('.').pop() || '').toLowerCase();
  const bytes = await ctx.fetchBytes();
  if (!bytes) throw new Error('CAD body unavailable');
  const inspection = inspectCadBytes(bytes, ext);
  ctx.host.textContent = '';
  const card = ctx.el('div', 'fv-card');
  card.appendChild(ctx.el('div', 'fv-cardhd', `${(ext || 'CAD').toUpperCase()} verified-byte inspection`));
  for (const [label, value] of inspection.facts) {
    const row = ctx.el('div', 'row');
    row.appendChild(ctx.el('span', 'l2', label));
    row.appendChild(ctx.el('span', 'v2', value));
    card.appendChild(row);
  }
  card.appendChild(ctx.el('div', 'fv-note',
    'Metadata above is derived from the verified bytes. No peer code or external model dependency was executed or fetched; use the verified download in an isolated CAD tool for authoritative geometry inspection.'));
  ctx.host.appendChild(card);
  if (inspection.preview) {
    ctx.host.appendChild(ctx.el('div', 'fv-note', 'bounded source/header preview · first 8 KB'));
    const pre = ctx.el('pre', 'filview'); pre.textContent = inspection.preview; ctx.host.appendChild(pre);
  }
}
