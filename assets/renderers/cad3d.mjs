/* Local-only CAD descriptor. Interactive parsing belongs in an isolated tool. */

export const meta = {
  exts: ['step','stp','stl','3mf','obj','gltf','glb','ply'],
  media_kinds: ['cad','cad3d','mesh','3d','model','step','stl','gltf','glb','obj','ply','3mf'],
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

export async function render(ctx) {
  const ext = String(ctx.ext || ctx.title?.split('.').pop() || '').toLowerCase();
  const bytes = await ctx.fetchBytes();
  if (!bytes) throw new Error('CAD body unavailable');
  if (ext === 'gltf' || ext === 'glb') assertSelfContainedGltf(bytes, ext);
  ctx.host.textContent = '';
  const card = ctx.el('div', 'fv-card');
  card.appendChild(ctx.el('div', 'fv-cardhd', `${ext || 'CAD'} verified descriptor`));
  card.appendChild(ctx.el('div', 'fv-note',
    'Interactive CAD execution is disabled in this credential-bearing page. Use the verified byte download in an isolated CAD tool.'));
  ctx.host.appendChild(card);
}
