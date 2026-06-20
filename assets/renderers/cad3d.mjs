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

// Guardrails so a pathological file can't freeze the drawer tab.
const MAX_TRIS = 4_000_000;     // soft warn above this; we still render but flag it
const MAX_POINTS = 6_000_000;   // point-cloud cap (PLY without faces)
const STEP_SCAN_BYTES = 12 << 20; // 12 MB: cap STEP regex scan region

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
  const isStep = ext === 'step' || ext === 'stp';

  // Immediate loading note: shown BEFORE the (slow) byte fetch + CDN import +
  // heavy parse resolve, so the drawer never sits blank. Removed once we paint.
  // Use the shared .fv-loading chrome (spinner + amber accent) — its color,
  // padding and animation live in discovery.css, so no inline style is needed.
  const loading = ctx.el('div', 'fv-loading');
  loading.textContent = isStep ? 'parsing STEP structure…' : `loading 3D viewer (three.js)…`;
  // Clear host first so the dispatcher's own fv-loading spinner doesn't orphan
  // above this view (every module is expected to clear the host on first paint).
  ctx.host.textContent = '';
  ctx.host.appendChild(loading);
  const dropLoading = () => { try { loading.remove(); } catch { /* ignore */ } };

  let buf;
  try {
    buf = await ctx.fetchBytes();
  } catch (e) {
    dropLoading();
    throw new Error(`cad3d: fetch failed: ${e && e.message ? e.message : e}`);
  }
  if (!buf || buf.byteLength === 0) { dropLoading(); throw new Error('cad3d: empty body'); }

  try {
    if (isStep) {
      // No permissive STEP tessellator — enhanced parsed fallback (still useful).
      renderStep(ctx, buf);
    } else {
      await renderMesh(ctx, buf, ext, loading);
    }
  } catch (e) {
    dropLoading();
    throw e;
  }
  dropLoading();
}

// ---------------------------------------------------------------------------
// three.js mesh / scene viewer
// ---------------------------------------------------------------------------
async function renderMesh(ctx, buf, ext, loading) {
  if (loading) loading.textContent = `loading 3D viewer (three.js)…`;
  const three = await ctx.lazy(THREE);
  if (loading) loading.textContent = `parsing ${ext.toUpperCase()} mesh…`;

  // Layout: viewport + small info bar. host may have no fixed height; give one.
  // The viewport is a data-viz well, so it sits on the shared --well backdrop
  // with a tokenised hairline; the status bar is mono telemetry on --dim.
  const wrap = ctx.el('div', 'cad3d-wrap');
  wrap.style.cssText = 'position:relative;width:100%;height:520px;max-height:78vh;background:var(--well,#06090e);border:1px solid var(--line2,#233040);border-radius:var(--radius-md,6px);overflow:hidden;';
  const bar = ctx.el('div', 'cad3d-bar');
  bar.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:2;font:11px/1.4 var(--mono,ui-monospace,Menlo,monospace);color:var(--dim,#90a0b2);background:color-mix(in srgb,var(--well,#06090e) 78%,transparent);border:1px solid var(--line,#1c2733);padding:3px 7px;border-radius:var(--radius-sm,4px);pointer-events:none;max-width:calc(100% - 16px);font-variant-numeric:tabular-nums;';
  bar.textContent = `${ctx.title || 'model'} · ${ext.toUpperCase()} · parsing…`;
  wrap.appendChild(bar);
  ctx.host.appendChild(wrap);
  // The viewport (with its own status bar) is now mounted; drop the plain
  // pre-import loading note so we don't show two "loading" lines at once.
  if (loading) { try { loading.remove(); } catch { /* ignore */ } }

  // Renderer / scene / camera.
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  const W = wrap.clientWidth || 600;
  const H = wrap.clientHeight || 520;
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = three.SRGBColorSpace;
  wrap.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';

  // Mutable refs so dispose() (registered before they exist) tears everything
  // down deterministically when the drawer navigates away.
  let raf = 0;
  let alive = true;
  let ro = null;
  let controls = null;
  let disposed = false;
  let object = null;
  function dispose() {
    if (disposed) return;
    disposed = true;
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    if (ro) { try { ro.disconnect(); } catch { /* ignore */ } }
    if (controls && controls.dispose) { try { controls.dispose(); } catch { /* ignore */ } }
    renderer.domElement.removeEventListener('webglcontextlost', onCtxLost);
    scene.traverse((o) => {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      const m = o.material;
      if (m) {
        (Array.isArray(m) ? m : [m]).forEach((mm) => {
          if (mm && mm.map && mm.map.dispose) mm.map.dispose();
          if (mm && mm.dispose) mm.dispose();
        });
      }
    });
    try { renderer.dispose(); } catch { /* ignore */ }
    // Force-release the GPU context (three's dispose() doesn't always free it).
    try { renderer.forceContextLoss && renderer.forceContextLoss(); } catch { /* ignore */ }
  }
  function cleanup() { dispose(); try { wrap.remove(); } catch { /* ignore */ } }
  // Deterministic teardown: the dispatcher runs this on every view switch
  // (renderTop → runViewCleanups), so nothing leaks across navigation. This is
  // the contract's hook — far more reliable than watching the DOM for removal.
  if (typeof ctx.onCleanup === 'function') ctx.onCleanup(dispose);

  // GPU may drop the context on a huge model; surface it instead of blanking.
  const onCtxLost = (ev) => {
    if (ev && ev.preventDefault) ev.preventDefault();
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    bar.textContent = `${ctx.title || 'model'} · ${ext.toUpperCase()} · WebGL context lost (model too large for this GPU) — download to view`;
  };
  renderer.domElement.addEventListener('webglcontextlost', onCtxLost, false);

  const scene = new three.Scene();
  // WebGL clear color: match the --well backdrop token (#06090e) so the canvas
  // reads as the same dark well as the rest of the file-viewer surfaces.
  scene.background = new three.Color(0x06090e);
  const camera = new three.PerspectiveCamera(45, W / H, 0.01, 1e6);

  scene.add(new three.HemisphereLight(0xffffff, 0x222b36, 1.15));
  const key = new three.DirectionalLight(0xffffff, 1.4);
  key.position.set(1, 1.6, 1.2);
  scene.add(key);
  const fill = new three.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-1.2, -0.4, -1);
  scene.add(fill);

  // Load the object as a three.Object3D (THROWS on failure → app fallback).
  let stats = '';
  let overCap = false;
  try {
    const r = await loadObject(ctx, three, buf, ext);
    object = r.object;
    stats = r.stats;
    overCap = !!r.overCap;
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
  // If dispose() already ran while we awaited controls, abort cleanly.
  if (disposed) return;

  const dim = box.getSize(new three.Vector3());
  bar.textContent =
    `${ctx.title || 'model'} · ${ext.toUpperCase()} · ${stats}` +
    ` · ${fmt(dim.x)}×${fmt(dim.y)}×${fmt(dim.z)}` +
    (controls ? ' · drag to orbit, scroll to zoom' : '');

  // Over-cap notice: the mesh is still rendered, but flag it so a sluggish or
  // frozen-looking tab is explained rather than silently confusing the viewer.
  if (overCap) {
    // Soft amber callout (the system's deliverable / warn idiom): tinted fill +
    // amber border + amber text, all derived from the --amber token.
    const warn = ctx.el('div', 'cad3d-warn');
    warn.style.cssText = 'position:absolute;left:8px;top:8px;right:8px;z-index:3;font:11px/1.4 var(--sans,system-ui,sans-serif);color:var(--amber,#f0a73a);background:color-mix(in srgb,var(--amber,#f0a73a) 14%,var(--well,#06090e));border:1px solid color-mix(in srgb,var(--amber,#f0a73a) 45%,transparent);border-left:2px solid var(--amber,#f0a73a);padding:4px 8px;border-radius:var(--radius-sm,4px);pointer-events:none;';
    warn.textContent = `Large model (${stats}) — interaction may be slow. Download to open in CAD software.`;
    wrap.appendChild(warn);
  }

  // Render loop with resize handling.
  const tick = () => {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (controls) controls.update();
    renderer.render(scene, camera);
  };
  tick();

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
}

// Returns { object: THREE.Object3D, stats: string, overCap: boolean }.
// THROWS on parse failure (→ app fallback shows download).
async function loadObject(ctx, three, buf, ext) {
  if (ext === 'stl') {
    const { STLLoader } = await ctx.lazy(JSM('loaders/STLLoader.js'));
    const geo = new STLLoader().parse(buf);
    geo.computeVertexNormals();
    const mesh = new three.Mesh(geo, defaultMat(three));
    const tris = geoTris(geo);
    return { object: mesh, stats: triStats(geo), overCap: tris > MAX_TRIS };
  }

  if (ext === 'ply') {
    const { PLYLoader } = await ctx.lazy(JSM('loaders/PLYLoader.js'));
    const geo = new PLYLoader().parse(buf);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const hasIndex = !!geo.index;
    // Point clouds (no faces) → render as points.
    if (!hasIndex && (!geo.groups || geo.groups.length === 0) && geo.attributes.position) {
      const n = geo.attributes.position.count;
      const pts = new three.Points(
        geo,
        new three.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: !!geo.attributes.color, color: 0x9ecbff }),
      );
      return { object: pts, stats: `${n.toLocaleString()} pts`, overCap: n > MAX_POINTS };
    }
    const mat = defaultMat(three);
    if (geo.attributes.color) { mat.vertexColors = true; }
    return { object: new three.Mesh(geo, mat), stats: triStats(geo), overCap: geoTris(geo) > MAX_TRIS };
  }

  if (ext === 'obj') {
    const { OBJLoader } = await ctx.lazy(JSM('loaders/OBJLoader.js'));
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const obj = new OBJLoader().parse(text);
    fixMaterials(three, obj);
    const s = objStats(obj);
    return { object: obj, stats: s.label, overCap: s.tris > MAX_TRIS };
  }

  if (ext === '3mf') {
    const { ThreeMFLoader } = await ctx.lazy(JSM('loaders/3MFLoader.js'));
    const group = new ThreeMFLoader().parse(buf);
    fixMaterials(three, group);
    const s = objStats(group);
    return { object: group, stats: s.label, overCap: s.tris > MAX_TRIS };
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
    const s = objStats(root);
    return { object: root, stats: s.label, overCap: s.tris > MAX_TRIS };
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

function geoTris(geo) {
  const verts = geo.attributes && geo.attributes.position ? geo.attributes.position.count : 0;
  return geo.index ? geo.index.count / 3 : verts / 3;
}

function triStats(geo) {
  return `${Math.round(geoTris(geo)).toLocaleString()} tris`;
}

// Returns { label, tris } so callers can both display and cap.
function objStats(root) {
  let tris = 0;
  let meshes = 0;
  root.traverse((o) => {
    if (o.isMesh && o.geometry) {
      meshes++;
      tris += geoTris(o.geometry);
    }
  });
  return { label: `${meshes} mesh${meshes === 1 ? '' : 'es'} · ${Math.round(tris).toLocaleString()} tris`, tris };
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

  // Cap the region we regex-scan so a multi-hundred-MB STEP can't freeze the
  // tab. The header is always near the top; entity counts stay representative.
  const truncated = text.length > STEP_SCAN_BYTES;
  const scan = truncated ? text.slice(0, STEP_SCAN_BYTES) : text;

  const header = parseStepHeader(scan);
  const entities = countStepEntities(scan);
  const totalEnt = entities.reduce((s, e) => s + e.count, 0);

  // Prose/chrome surface: sans body on --ink, matching the file-viewer drawer.
  const root = ctx.el('div', 'cad3d-step');
  root.style.cssText = 'font:13px/1.55 var(--sans,system-ui,sans-serif);color:var(--ink,#cdd9e5);max-width:100%;';

  const head = ctx.el('div', 'cad3d-step-head');
  head.style.cssText = 'display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px;';
  const h = ctx.el('div', null, ctx.title || 'STEP model');
  h.style.cssText = 'font-weight:600;font-size:15px;color:var(--off-white,#eaf1f8);letter-spacing:-.01em;';
  // Mono provenance pill (it carries an ID/standard) on the raised chip surface.
  const badge = ctx.el('div', null, 'STEP · ISO-10303-21');
  badge.style.cssText = 'font:11px var(--mono,ui-monospace,monospace);color:var(--dim,#90a0b2);background:var(--surface-raised,#0b121b);border:1px solid var(--line2,#233040);padding:2px 8px;border-radius:var(--radius-pill,999px);';
  head.appendChild(h);
  head.appendChild(badge);
  root.appendChild(head);

  const note = ctx.el(
    'div',
    null,
    'No permissively-licensed in-browser STEP tessellator is available, so this shows the parsed B-Rep structure instead of a 3D view. Download the file to open it in CAD software.',
  );
  // Amber-left informational callout (the system's .fv-warn idiom): tinted
  // inset fill, amber left accent, all from tokens.
  note.style.cssText = 'font-size:12px;color:var(--dim,#90a0b2);background:var(--surface-inset,#070b10);border:1px solid var(--line2,#233040);border-left:2px solid var(--amber,#f0a73a);padding:8px 11px;border-radius:var(--radius-md,6px);margin-bottom:14px;';
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
  const scannedNote = truncated
    ? ` (scanned first ${Math.round(STEP_SCAN_BYTES / (1 << 20))} MB of ${Math.round(text.length / (1 << 20))} MB)`
    : '';
  root.appendChild(sectionTitle(ctx, `Entity summary · ${totalEnt.toLocaleString()}${truncated ? '+' : ''} instances · ${entities.length} types${scannedNote}`));
  const top = entities.slice(0, 40);
  const entRows = top.map((e) => [e.type, e.count.toLocaleString()]);
  root.appendChild(twoColTable(ctx, ['Entity type', 'Count'], entRows));
  if (entities.length > top.length) {
    const more = ctx.el('div', null, `…and ${entities.length - top.length} more entity types`);
    more.style.cssText = 'font-size:12px;color:var(--mut,#7d8ea2);margin-top:6px;';
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
  // Uppercase eyebrow on the muted tier — the system's section-label idiom.
  const d = ctx.el('div', null, t);
  d.style.cssText = 'font-family:var(--sans,system-ui,sans-serif);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut,#7d8ea2);margin:16px 0 7px;';
  return d;
}
function kvTable(ctx, rows) {
  const tbl = baseTable(ctx);
  for (const [k, v] of rows) {
    const tr = ctx.el('tr');
    // Key = sans label on the dim tier; value = ink (mono not needed for prose).
    const th = ctx.el('td', null, k);
    th.style.cssText = 'padding:5px 12px 5px 0;font-family:var(--sans,system-ui,sans-serif);color:var(--dim,#90a0b2);white-space:nowrap;vertical-align:top;width:1%;';
    const td = ctx.el('td');
    td.style.cssText = 'padding:5px 0;color:var(--ink,#cdd9e5);word-break:break-word;';
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
    th.style.cssText = `text-align:${i === 0 ? 'left' : 'right'};padding:4px 0;border-bottom:1px solid var(--line2,#233040);font-family:var(--sans,system-ui,sans-serif);font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut,#7d8ea2);`;
    htr.appendChild(th);
  });
  tbl.appendChild(htr);
  for (const row of rows) {
    const tr = ctx.el('tr');
    row.forEach((cell, i) => {
      const td = ctx.el('td');
      // First col = mono entity-type ID (data); count col = the product-wide
      // amber number hue, right-aligned with tabular figures.
      td.style.cssText = `padding:4px 0;border-bottom:1px solid var(--line,#1c2733);${i === 0 ? 'font-family:var(--mono,ui-monospace,Menlo,monospace);font-size:12px;color:var(--ink,#cdd9e5);' : 'text-align:right;font-family:var(--mono,ui-monospace,Menlo,monospace);color:var(--amber,#f0a73a);font-variant-numeric:tabular-nums;'}`;
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
