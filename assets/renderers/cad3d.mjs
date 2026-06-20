// cad3d.mjs — PersonaOS deliverable renderer for 3D CAD / mesh formats.
//
// Mesh/scene formats (.stl .obj .gltf .glb .3mf .ply) are rendered with an
// interactive three.js orbit viewer (three is MIT). STEP (.step .stp) has no
// permissively-licensed browser tessellator (occt-import-js is LGPL-2.1, which
// our license policy forbids), so STEP degrades to an enhanced parsed view of
// the ISO-10303-21 structure (header + entity summary table) — never skipped.
//
// Self-contained: the only imports happen lazily inside render() via ctx.lazy().

const THREE_VER = '0.160.0';
const THREE = `https://esm.sh/three@${THREE_VER}`;
const JSM = (p) => `https://esm.sh/three@${THREE_VER}/examples/jsm/${p}?deps=three@${THREE_VER}`;

export const meta = {
  exts: ['step', 'stp', 'stl', '3mf', 'obj', 'gltf', 'glb', 'ply'],
  media_kinds: ['cad', 'cad3d', 'mesh', '3d', 'model', 'step', 'stl', 'gltf', 'glb', 'obj', 'ply', '3mf'],
  // bytes is the universal mode: binary meshes (glb/binary-stl/binary-ply/3mf)
  // require it, and STEP text decodes cleanly from the same ArrayBuffer.
  fetchMode: 'bytes',
  label: '3D CAD / Mesh',
};

// ---------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------
export async function render(ctx) {
  const ext = extOf(ctx.title, ctx.url);
  const buf = await ctx.fetchBytes();
  if (!buf || buf.byteLength === 0) throw new Error('cad3d: empty body');

  if (ext === 'step' || ext === 'stp') {
    // No permissive STEP tessellator — enhanced parsed fallback (still useful).
    return renderStep(ctx, buf);
  }
  return renderMesh(ctx, buf, ext);
}

// ---------------------------------------------------------------------------
// three.js mesh / scene viewer
// ---------------------------------------------------------------------------
async function renderMesh(ctx, buf, ext) {
  const three = await ctx.lazy(THREE);

  // Layout: viewport + small info bar. host may have no fixed height; give one.
  const wrap = ctx.el('div', 'cad3d-wrap');
  wrap.style.cssText = 'position:relative;width:100%;height:520px;max-height:78vh;background:#0d1117;border-radius:6px;overflow:hidden;';
  const bar = ctx.el('div', 'cad3d-bar');
  bar.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:2;font:11px/1.4 ui-monospace,Menlo,monospace;color:#9aa7b4;background:rgba(13,17,23,.66);padding:3px 7px;border-radius:4px;pointer-events:none;max-width:calc(100% - 16px);';
  bar.textContent = `${ctx.title || 'model'} · ${ext.toUpperCase()} · loading…`;
  wrap.appendChild(bar);
  ctx.host.appendChild(wrap);

  // Renderer / scene / camera.
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  const W = wrap.clientWidth || 600;
  const H = wrap.clientHeight || 520;
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = three.SRGBColorSpace;
  wrap.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';

  const scene = new three.Scene();
  scene.background = new three.Color(0x0d1117);
  const camera = new three.PerspectiveCamera(45, W / H, 0.01, 1e6);

  scene.add(new three.HemisphereLight(0xffffff, 0x222b36, 1.15));
  const key = new three.DirectionalLight(0xffffff, 1.4);
  key.position.set(1, 1.6, 1.2);
  scene.add(key);
  const fill = new three.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-1.2, -0.4, -1);
  scene.add(fill);

  // Load the object as a three.Object3D (THROWS on failure → app fallback).
  let object;
  let stats = '';
  try {
    const r = await loadObject(ctx, three, buf, ext);
    object = r.object;
    stats = r.stats;
  } catch (e) {
    cleanup();
    throw new Error(`cad3d: ${ext} load failed: ${e && e.message ? e.message : e}`);
  }
  if (!object) {
    cleanup();
    throw new Error(`cad3d: ${ext} produced no geometry`);
  }
  scene.add(object);

  // Frame the model: center + fit camera to bounding sphere.
  const box = new three.Box3().setFromObject(object);
  if (box.isEmpty()) {
    cleanup();
    throw new Error('cad3d: model has empty bounds');
  }
  const sphere = box.getBoundingSphere(new three.Sphere());
  object.position.sub(sphere.center); // recenter at origin
  const radius = sphere.radius || 1;
  const dist = radius / Math.sin((camera.fov * Math.PI) / 180 / 2);
  camera.position.set(dist * 0.8, dist * 0.6, dist * 0.9);
  camera.near = Math.max(radius / 1000, 1e-4);
  camera.far = dist * 1000;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);

  // Orbit controls.
  let controls = null;
  try {
    const { OrbitControls } = await ctx.lazy(JSM('controls/OrbitControls.js'));
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.update();
  } catch {
    /* controls are a nicety; static view still works */
  }

  const dim = box.getSize(new three.Vector3());
  bar.textContent =
    `${ctx.title || 'model'} · ${ext.toUpperCase()} · ${stats}` +
    ` · ${fmt(dim.x)}×${fmt(dim.y)}×${fmt(dim.z)}` +
    (controls ? ' · drag to orbit, scroll to zoom' : '');

  // Render loop with visibility/resize handling.
  let raf = 0;
  let alive = true;
  const tick = () => {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (controls) controls.update();
    renderer.render(scene, camera);
  };
  tick();

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      const w = wrap.clientWidth || W;
      const h = wrap.clientHeight || H;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    ro.observe(wrap);
  }

  // Best-effort teardown when the drawer node leaves the DOM.
  if (typeof MutationObserver !== 'undefined' && wrap.ownerDocument) {
    const mo = new MutationObserver(() => {
      if (!wrap.isConnected) {
        mo.disconnect();
        dispose();
      }
    });
    mo.observe(wrap.ownerDocument.body, { childList: true, subtree: true });
  }

  function dispose() {
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    if (controls && controls.dispose) controls.dispose();
    scene.traverse((o) => {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      const m = o.material;
      if (m) {
        (Array.isArray(m) ? m : [m]).forEach((mm) => {
          if (mm.map && mm.map.dispose) mm.map.dispose();
          if (mm.dispose) mm.dispose();
        });
      }
    });
    renderer.dispose();
  }
  function cleanup() {
    try { renderer.dispose(); } catch { /* ignore */ }
    try { wrap.remove(); } catch { /* ignore */ }
  }
}

// Returns { object: THREE.Object3D, stats: string }. THROWS on parse failure.
async function loadObject(ctx, three, buf, ext) {
  if (ext === 'stl') {
    const { STLLoader } = await ctx.lazy(JSM('loaders/STLLoader.js'));
    const geo = new STLLoader().parse(buf);
    geo.computeVertexNormals();
    const mesh = new three.Mesh(geo, defaultMat(three));
    return { object: mesh, stats: triStats(geo) };
  }

  if (ext === 'ply') {
    const { PLYLoader } = await ctx.lazy(JSM('loaders/PLYLoader.js'));
    const geo = new PLYLoader().parse(buf);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const hasIndex = !!geo.index;
    // Point clouds (no faces) → render as points.
    if (!hasIndex && (!geo.groups || geo.groups.length === 0) && geo.attributes.position) {
      const pts = new three.Points(
        geo,
        new three.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: !!geo.attributes.color, color: 0x9ecbff }),
      );
      return { object: pts, stats: `${(geo.attributes.position.count).toLocaleString()} pts` };
    }
    const mat = defaultMat(three);
    if (geo.attributes.color) { mat.vertexColors = true; }
    return { object: new three.Mesh(geo, mat), stats: triStats(geo) };
  }

  if (ext === 'obj') {
    const { OBJLoader } = await ctx.lazy(JSM('loaders/OBJLoader.js'));
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const obj = new OBJLoader().parse(text);
    fixMaterials(three, obj);
    return { object: obj, stats: objStats(obj) };
  }

  if (ext === '3mf') {
    const { ThreeMFLoader } = await ctx.lazy(JSM('loaders/3MFLoader.js'));
    const group = new ThreeMFLoader().parse(buf);
    fixMaterials(three, group);
    return { object: group, stats: objStats(group) };
  }

  if (ext === 'gltf' || ext === 'glb') {
    const { GLTFLoader } = await ctx.lazy(JSM('loaders/GLTFLoader.js'));
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      try {
        // parse needs an ArrayBuffer (glb) or JSON string (gltf). Pass through;
        // GLTFLoader.parse auto-detects glTF vs glb from the buffer header.
        loader.parse(buf, '', resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
    const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!root) throw new Error('no scene in glTF');
    return { object: root, stats: objStats(root) };
  }

  throw new Error(`unsupported ext ${ext}`);
}

function defaultMat(three) {
  return new three.MeshStandardMaterial({
    color: 0xb9c2cc,
    metalness: 0.1,
    roughness: 0.65,
    side: three.DoubleSide,
    flatShading: false,
  });
}

// Ensure imported scenes have a visible material (some OBJ/3MF lack one).
function fixMaterials(three, root) {
  root.traverse((o) => {
    if (o.isMesh && (!o.material || (Array.isArray(o.material) && o.material.length === 0))) {
      o.material = defaultMat(three);
    }
  });
}

function triStats(geo) {
  const verts = geo.attributes && geo.attributes.position ? geo.attributes.position.count : 0;
  const tris = geo.index ? geo.index.count / 3 : verts / 3;
  return `${Math.round(tris).toLocaleString()} tris`;
}

function objStats(root) {
  let tris = 0;
  let meshes = 0;
  root.traverse((o) => {
    if (o.isMesh && o.geometry) {
      meshes++;
      const g = o.geometry;
      const v = g.attributes && g.attributes.position ? g.attributes.position.count : 0;
      tris += g.index ? g.index.count / 3 : v / 3;
    }
  });
  return `${meshes} mesh${meshes === 1 ? '' : 'es'} · ${Math.round(tris).toLocaleString()} tris`;
}

function fmt(n) {
  if (!isFinite(n)) return '?';
  const a = Math.abs(n);
  if (a >= 1000) return n.toFixed(0);
  if (a >= 1) return n.toFixed(2);
  if (a === 0) return '0';
  return n.toPrecision(2);
}

// ---------------------------------------------------------------------------
// STEP (ISO-10303-21) enhanced parsed fallback — no permissive tessellator.
// ---------------------------------------------------------------------------
function renderStep(ctx, buf) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!/ISO-10303-21/i.test(text.slice(0, 4096)) && !/\bDATA\b/.test(text.slice(0, 8192))) {
    throw new Error('cad3d: not a recognizable STEP (ISO-10303-21) file');
  }

  const header = parseStepHeader(text);
  const entities = countStepEntities(text);
  const totalEnt = entities.reduce((s, e) => s + e.count, 0);

  const root = ctx.el('div', 'cad3d-step');
  root.style.cssText = 'font:13px/1.55 ui-sans-serif,system-ui,sans-serif;color:#e6edf3;max-width:100%;';

  const head = ctx.el('div', 'cad3d-step-head');
  head.style.cssText = 'display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px;';
  const h = ctx.el('div', null, ctx.title || 'STEP model');
  h.style.cssText = 'font-weight:600;font-size:15px;';
  const badge = ctx.el('div', null, 'STEP · ISO-10303-21');
  badge.style.cssText = 'font:11px ui-monospace,monospace;color:#9aa7b4;background:#161b22;padding:2px 8px;border-radius:10px;';
  head.appendChild(h);
  head.appendChild(badge);
  root.appendChild(head);

  const note = ctx.el(
    'div',
    null,
    'No permissively-licensed in-browser STEP tessellator is available, so this shows the parsed B-Rep structure instead of a 3D view. Download the file to open it in CAD software.',
  );
  note.style.cssText = 'font-size:12px;color:#9aa7b4;background:#161b22;border:1px solid #21262d;border-left:3px solid #d29922;padding:8px 11px;border-radius:5px;margin-bottom:14px;';
  root.appendChild(note);

  // Header table.
  root.appendChild(sectionTitle(ctx, 'File header'));
  const headerRows = [
    ['Schema', header.schema],
    ['Name', header.name],
    ['Description', header.description],
    ['Author', header.author],
    ['Organization', header.organization],
    ['Originating system', header.originatingSystem],
    ['Preprocessor', header.preprocessor],
    ['Timestamp', header.timeStamp],
    ['Authorization', header.authorization],
  ].filter((r) => r[1]);
  root.appendChild(kvTable(ctx, headerRows.length ? headerRows : [['(header)', 'no FILE_NAME/FILE_DESCRIPTION fields found']]));

  // Entity summary.
  root.appendChild(sectionTitle(ctx, `Entity summary · ${totalEnt.toLocaleString()} instances · ${entities.length} types`));
  const top = entities.slice(0, 40);
  const entRows = top.map((e) => [e.type, e.count.toLocaleString()]);
  root.appendChild(twoColTable(ctx, ['Entity type', 'Count'], entRows));
  if (entities.length > top.length) {
    const more = ctx.el('div', null, `…and ${entities.length - top.length} more entity types`);
    more.style.cssText = 'font-size:12px;color:#7d8590;margin-top:6px;';
    root.appendChild(more);
  }

  // Geometry signal: highlight key B-Rep counts if present.
  const sig = pickGeometrySignals(entities);
  if (sig.length) {
    root.appendChild(sectionTitle(ctx, 'Geometry signals'));
    root.appendChild(twoColTable(ctx, ['Concept', 'Count'], sig));
  }

  ctx.host.appendChild(root);
}

function parseStepHeader(text) {
  const headerBlock = sliceBetween(text, /HEADER\s*;/i, /ENDSEC\s*;/i) || text.slice(0, 4000);
  const out = {
    schema: '', name: '', description: '', author: '', organization: '',
    preprocessor: '', originatingSystem: '', timeStamp: '', authorization: '',
  };

  const schema = matchCall(headerBlock, 'FILE_SCHEMA');
  if (schema) out.schema = firstStrings(schema).join(', ');

  const desc = matchCall(headerBlock, 'FILE_DESCRIPTION');
  if (desc) out.description = firstStrings(desc).filter(Boolean).join(' ');

  const fn = matchCall(headerBlock, 'FILE_NAME');
  if (fn) {
    const parts = splitTopLevel(fn);
    const s = (i) => unquote(parts[i]);
    out.name = s(0);
    out.timeStamp = s(1);
    out.author = stringsIn(parts[2]).join(', ');
    out.organization = stringsIn(parts[3]).join(', ');
    out.preprocessor = s(4);
    out.originatingSystem = s(5);
    out.authorization = s(6);
  }
  return out;
}

// Count entity instances in the DATA section: "#123 = TYPE_NAME(...)".
function countStepEntities(text) {
  const data = sliceBetween(text, /\bDATA\s*;/i, /ENDSEC\s*;[\s\S]*?END-ISO-10303-21/i) || text;
  const counts = new Map();
  const re = /#\d+\s*=\s*([A-Z][A-Z0-9_]*)\s*[(]/g;
  let m;
  while ((m = re.exec(data)) !== null) {
    const t = m[1];
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

function pickGeometrySignals(entities) {
  const wanted = [
    'ADVANCED_FACE', 'MANIFOLD_SOLID_BREP', 'CLOSED_SHELL', 'OPEN_SHELL',
    'EDGE_CURVE', 'VERTEX_POINT', 'CARTESIAN_POINT', 'CYLINDRICAL_SURFACE',
    'PLANE', 'B_SPLINE_SURFACE_WITH_KNOTS', 'PRODUCT', 'SHAPE_REPRESENTATION',
  ];
  const map = new Map(entities.map((e) => [e.type, e.count]));
  return wanted
    .filter((w) => map.has(w))
    .map((w) => [titleize(w), map.get(w).toLocaleString()]);
}

// ---------- small parse helpers (STEP) ----------
function sliceBetween(text, startRe, endRe) {
  const s = text.search(startRe);
  if (s < 0) return '';
  const after = text.slice(s);
  const e = after.search(endRe);
  return e < 0 ? after : after.slice(0, e);
}
function matchCall(block, fn) {
  const idx = block.toUpperCase().indexOf(fn.toUpperCase());
  if (idx < 0) return '';
  const open = block.indexOf('(', idx);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < block.length; i++) {
    const c = block[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return block.slice(open + 1, i);
    }
  }
  return '';
}
// Split a paren-body on top-level commas (respects nesting + quotes).
function splitTopLevel(body) {
  const out = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      cur += c;
      if (c === "'") {
        if (body[i + 1] === "'") { cur += "'"; i++; } // escaped quote
        else inStr = false;
      }
      continue;
    }
    if (c === "'") { inStr = true; cur += c; continue; }
    if (c === '(') { depth++; cur += c; continue; }
    if (c === ')') { depth--; cur += c; continue; }
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}
function unquote(s) {
  if (!s) return '';
  const t = s.trim();
  if (t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'").replace(/\\X2\\[0-9A-Fa-f]+\\X0\\/g, '?').trim();
  }
  if (t === '$' || t === '*') return '';
  return t;
}
function stringsIn(group) {
  if (!group) return [];
  return splitTopLevel(group.replace(/^\(/, '').replace(/\)$/, '')).map(unquote).filter(Boolean);
}
function firstStrings(body) {
  return splitTopLevel(body).map(unquote).filter(Boolean);
}
function titleize(s) {
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------- shared DOM builders ----------
function sectionTitle(ctx, t) {
  const d = ctx.el('div', null, t);
  d.style.cssText = 'font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#7d8590;margin:16px 0 7px;';
  return d;
}
function kvTable(ctx, rows) {
  const tbl = baseTable(ctx);
  for (const [k, v] of rows) {
    const tr = ctx.el('tr');
    const th = ctx.el('td', null, k);
    th.style.cssText = 'padding:5px 12px 5px 0;color:#9aa7b4;white-space:nowrap;vertical-align:top;width:1%;';
    const td = ctx.el('td');
    td.style.cssText = 'padding:5px 0;word-break:break-word;';
    td.textContent = v;
    tr.appendChild(th);
    tr.appendChild(td);
    tbl.appendChild(tr);
  }
  return tbl;
}
function twoColTable(ctx, headers, rows) {
  const tbl = baseTable(ctx);
  const htr = ctx.el('tr');
  headers.forEach((hh, i) => {
    const th = ctx.el('th', null, hh);
    th.style.cssText = `text-align:${i === 0 ? 'left' : 'right'};padding:4px 0;border-bottom:1px solid #21262d;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:#7d8590;`;
    htr.appendChild(th);
  });
  tbl.appendChild(htr);
  for (const row of rows) {
    const tr = ctx.el('tr');
    row.forEach((cell, i) => {
      const td = ctx.el('td');
      td.style.cssText = `padding:4px 0;${i === 0 ? 'font-family:ui-monospace,Menlo,monospace;font-size:12px;' : 'text-align:right;color:#9ecbff;font-variant-numeric:tabular-nums;'}`;
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbl.appendChild(tr);
  }
  return tbl;
}
function baseTable(ctx) {
  const t = ctx.el('table');
  t.style.cssText = 'border-collapse:collapse;width:100%;';
  return t;
}

// ---------------------------------------------------------------------------
function extOf(title, url) {
  const src = (title || '') + ' ' + (url || '');
  const m = src.toLowerCase().match(/\.(step|stp|stl|3mf|obj|gltf|glb|ply)\b/g);
  if (m && m.length) {
    const last = m[m.length - 1].slice(1);
    return last;
  }
  // Fallback: trailing token of url path.
  try {
    const u = (url || '').split('?')[0].split('#')[0];
    const seg = u.substring(u.lastIndexOf('.') + 1).toLowerCase();
    if (meta.exts.includes(seg)) return seg;
  } catch { /* ignore */ }
  return '';
}
