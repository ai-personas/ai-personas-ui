/* ====================================================================
   PersonaOS deliverable viewer — GERBER family renderer (lazy module)
   --------------------------------------------------------------------
   Renders PCB fabrication Gerber layers (RS-274X) and Excellon NC drill
   files as an SVG board image, using the tracespace `gerber-to-svg`
   library (MIT). Each artifact body is a SINGLE layer file, so we render
   that one layer to SVG and present it on a board-coloured backdrop with
   a descriptor bar (guessed layer type, real-world size, units) and a
   zoom/pan viewport (toolbar + wheel-zoom + drag-pan) sized for the
   narrow drawer.

   CONTRACT: see the renderer module contract — `meta` + async `render(ctx)`.
   Lib is imported ONLY inside render() via ctx.lazy(). All risky work is
   wrapped and we THROW on any failure so the app's download/text fallback
   takes over (never a blank or broken pane). Heavy listeners/observers are
   torn down via ctx.onCleanup so switching files cannot leak.

   SECURITY: the SVG string is produced by gerber-to-svg's own serializer
   (geometry → path/mask elements, no remote scripting), but the source
   bytes are untrusted peer content, so before mounting we parse the SVG
   in an inert XML document and strip <script>, <foreignObject>, and any
   event-handler (on...) / href / xlink href URL vectors before adopting it.
   ==================================================================== */

export const meta = {
  exts: ['gbr', 'ger', 'gtl', 'gbl', 'gto', 'gts', 'gko', 'gm1', 'drl', 'xln'],
  media_kinds: ['gerber', 'excellon', 'drill', 'pcb', 'gerber-layer'],
  fetchMode: 'text',
  label: 'PCB Gerber / Excellon layer',
};

// esm.sh serves gerber-to-svg@4.2.8 (MIT) as an ESM wrapper with its node
// stream / process deps polyfilled for the browser. Version pinned.
const LIB = 'https://esm.sh/gerber-to-svg@4.2.8';

// Guard rails so a pathological body can never freeze the drawer tab:
//  - SOFT cap: above this we warn the parse may be slow (still attempted).
//  - HARD cap: above this we refuse and THROW (fallback shows download).
//  - TIMEOUT:  the converter stream is bounded; a hang rejects → fallback.
const SOFT_BYTES = 4 * 1024 * 1024;   // 4 MB — large board, still parseable
const HARD_BYTES = 24 * 1024 * 1024;  // 24 MB — refuse, would freeze the tab
const PARSE_TIMEOUT_MS = 20000;

// Best-effort human label for a layer, keyed off the file extension. Pure
// presentation — never affects rendering; unknown extensions stay generic.
const LAYER_BY_EXT = {
  gtl: 'Top copper',
  gbl: 'Bottom copper',
  gto: 'Top silkscreen',
  gbo: 'Bottom silkscreen',
  gts: 'Top solder mask',
  gbs: 'Bottom solder mask',
  gko: 'Board outline / keep-out',
  gm1: 'Mechanical 1',
  gbr: 'Gerber layer',
  ger: 'Gerber layer',
  drl: 'Excellon drill',
  xln: 'Excellon drill',
};

function extOf(title) {
  const m = String(title || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function fmtBytes(n) {
  if (!(n > 0)) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${i === 0 ? v : v.toFixed(1)} ${u[i]}`;
}

// One-shot injection of the renderer's scoped chrome styles. Authored entirely
// against the shared design tokens (every value var(--token,<live-fallback>) so
// the fallback half can never drift into a second palette). The PCB board itself
// (green soldermask + gold copper, and the white invert) is the deliberate
// data-viz representation of the layer — kept off the chrome palette by intent,
// the same way the WaveDrom card or a CAD mesh keeps its own colours. Everything
// around it — toolbar, buttons, descriptor bar, hint, frame — is product chrome
// and rides the tokens so the viewport reads as one piece with the dashboard.
const STYLE_ID = 'fv-gerber-style';
const GERBER_CSS = `
.fv-gerber{display:flex;flex-direction:column;width:100%;max-width:100%;
  border:1px solid var(--line2,#233040);border-radius:var(--radius-md,6px);
  overflow:hidden;background:var(--well,#06090e);
  font-family:var(--sans,'Inter var','Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif)}
.fv-gerber-bar{display:flex;gap:var(--space-1,4px);align-items:center;flex-wrap:wrap;
  padding:var(--space-2,8px) var(--space-3,12px);
  background:var(--surface-raised,#0b121b);
  border-bottom:1px solid var(--line2,#233040)}
.fv-gerber-bar button{display:inline-flex;align-items:center;justify-content:center;
  min-width:28px;height:24px;padding:0 var(--space-2,8px);cursor:pointer;
  background:var(--surface-inset,#070b10);color:var(--dim,#90a0b2);
  border:1px solid var(--line2,#233040);border-radius:var(--radius-sm,4px);
  font:600 11px/1 var(--sans,ui-sans-serif,system-ui,sans-serif);letter-spacing:.02em;
  transition:border-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    background var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.fv-gerber-bar button:hover:not(:disabled){border-color:var(--accent,#4c9ff0);color:var(--ink,#cdd9e5);background:var(--surface-raised,#0b121b)}
.fv-gerber-bar button:focus-visible{outline:none;border-color:var(--accent,#4c9ff0);box-shadow:0 0 0 3px var(--focus-ring,rgba(76,159,240,.20))}
.fv-gerber-bar button:active:not(:disabled){transform:var(--press,translateY(.5px))}
.fv-gerber-bar button:disabled{opacity:.4;cursor:default}
.fv-gerber-hint{margin-left:auto;color:var(--mut,#7d8ea2);
  font:10px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.04em;
  font-variant-numeric:tabular-nums}
/* Board surface + trace colour ARE the PCB data-viz representation: the gerber
   geometry is emitted with fill/stroke="currentColor", so the stage's color
   drives the copper tint. Namespaced renderer-local vars keep these overridable
   while carrying the conventional PCB fallbacks (off the chrome palette). */
.fv-gerber-stage{position:relative;width:100%;height:clamp(220px,52vh,520px);
  overflow:hidden;padding:var(--space-3,12px);box-sizing:border-box;
  touch-action:none;cursor:grab;
  background:var(--gbr-board,#0b3d2e);color:var(--gbr-trace,#f0c14b)}
.fv-gerber-stage.is-inverted{background:var(--gbr-board-inv,#f3efe3);color:var(--gbr-trace-inv,#1a1a1a)}
@media (prefers-reduced-motion:reduce){
  .fv-gerber-bar button{transition-duration:.01ms!important}
  .fv-gerber-bar button:active:not(:disabled){transform:none}
}`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = GERBER_CSS;
  (document.head || document.documentElement).appendChild(s);
}

// Sanitise a serialized SVG string into a live, inert SVG node. Parses as
// XML (no script execution), drops dangerous elements/attributes, then
// imports the cleaned root into the host document.
function svgStringToNode(svgText) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('gerber: SVG parse error');
  }
  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== 'svg') {
    throw new Error('gerber: no <svg> root produced');
  }
  // Strip active/embedding content.
  root.querySelectorAll('script,foreignObject,iframe,image,a').forEach((n) => n.remove());
  // Strip event handlers and any URL-bearing attributes.
  const walk = (node) => {
    if (node.attributes) {
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'href' || name.endsWith(':href') || name === 'style') {
          node.removeAttribute(attr.name);
        }
      }
    }
    for (const child of Array.from(node.children || [])) walk(child);
  };
  walk(root);
  return document.importNode(root, true);
}

// Parse "minX minY width height" out of a viewBox attribute (numbers only).
function parseViewBox(node, converter) {
  const raw = node.getAttribute('viewBox');
  if (raw) {
    const p = raw.trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p.every((n) => isFinite(n)) && p[2] > 0 && p[3] > 0) {
      return { x: p[0], y: p[1], w: p[2], h: p[3] };
    }
  }
  // Fallback: derive from the converter's real-world extents (in svg units).
  const vb = converter && converter.viewBox;
  if (Array.isArray(vb) && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    return { x: +vb[0], y: +vb[1], w: +vb[2], h: +vb[3] };
  }
  return null;
}

// gerber-to-svg's callback form buffers its internal stream and hands back
// the finished SVG string; the converter object also carries real-world
// width/height/units/viewBox. Promisify with a hard timeout so a malformed
// stream that never closes can't wedge the tab.
function convert(gerberToSvg, source, id) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, arg) => { if (settled) return; settled = true; clearTimeout(timer); fn(arg); };
    const timer = setTimeout(
      () => finish(reject, new Error('gerber: parse timed out (file may be malformed or too large)')),
      PARSE_TIMEOUT_MS,
    );
    let converter;
    try {
      converter = gerberToSvg(source, { id }, (err, svg) => {
        if (err) return finish(reject, err);
        if (!svg || typeof svg !== 'string') return finish(reject, new Error('gerber: empty SVG output'));
        finish(resolve, { svg, converter });
      });
    } catch (e) {
      finish(reject, e);
    }
  });
}

export async function render(ctx) {
  const { host, el } = ctx;

  // 1) Source bytes (text format).
  const source = await ctx.fetchText();
  if (source == null || !String(source).trim()) throw new Error('gerber: empty source file');

  // HARD large-file guard — refuse before the (memory-hungry) parse so a huge
  // body can't freeze the tab; throwing surfaces the app's download fallback.
  const bytes = (ctx.size && +ctx.size) || source.length;
  if (bytes > HARD_BYTES) {
    throw new Error(`gerber: file too large to render (${fmtBytes(bytes)} > ${fmtBytes(HARD_BYTES)} cap) — use download`);
  }

  // 2) Loading state (the CDN import + parse are the slow part). Reuse the
  //    single shared .fv-loading pattern (token spinner) for product cohesion.
  ensureStyle();
  host.innerHTML = '';
  const loading = el('div', 'fv-loading', 'loading PCB Gerber renderer…');
  host.appendChild(loading);

  // 3) Lazy-load the converter (THROWS up to the app on CDN failure).
  const mod = await ctx.lazy(LIB);
  const gerberToSvg = mod && (mod.default || mod);
  if (typeof gerberToSvg !== 'function') throw new Error('gerber: library export not callable');

  // 4) Convert this single layer to SVG. A stable, collision-free id keeps
  //    SVG mask/def ids unique if several layers share a page.
  loading.textContent = bytes > SOFT_BYTES
    ? `parsing large layer (${fmtBytes(bytes)})…`
    : 'parsing Gerber layer…';
  const id = 'gbr-' + Math.random().toString(36).slice(2, 10);
  const { svg, converter } = await convert(gerberToSvg, source, id);

  // 5) Sanitise + adopt the SVG node.
  const node = svgStringToNode(svg);
  const vb = parseViewBox(node, converter);
  // Drop the intrinsic sizing — the viewport <svg> drives display size, and
  // we pan/zoom via the viewBox so the geometry stays crisp at any scale.
  node.removeAttribute('width');
  node.removeAttribute('height');
  node.style.display = 'block';
  node.style.width = '100%';
  node.style.height = '100%';

  // 6) Mount: descriptor bar + zoom/pan board viewport.
  host.innerHTML = '';

  const ext = ctx.ext || extOf(ctx.title);
  const layerLabel = LAYER_BY_EXT[ext] || (ext ? '.' + ext + ' layer' : 'PCB layer');
  const units = converter && converter.units ? String(converter.units) : '';
  const w = converter && typeof converter.width === 'number' && isFinite(converter.width) ? converter.width : null;
  const h = converter && typeof converter.height === 'number' && isFinite(converter.height) ? converter.height : null;

  // Descriptor bar: a chrome label (.fv-note, sans) carrying the layer name,
  // with the measured dimensions/units set in mono as the data half so the
  // numbers don't jitter and read as telemetry, not prose.
  const bar = el('div', 'fv-note');
  bar.textContent = layerLabel;
  if (w != null && h != null && units) {
    const sep = document.createTextNode(' · ');
    const data = el('span');
    data.style.cssText = "font-family:var(--mono,ui-monospace,Menlo,monospace);"
      + 'font-variant-numeric:tabular-nums;color:var(--dim,#90a0b2)';
    data.textContent = `${(+w).toFixed(2)} × ${(+h).toFixed(2)} ${units}`;
    bar.appendChild(sep);
    bar.appendChild(data);
  }
  host.appendChild(bar);

  // Degraded-render notice (still show what we have): the layer parsed but has
  // no measurable extent / viewBox, so pan/zoom falls back to plain scaling.
  if (!vb) {
    const warn = el('div', 'fv-note', 'note: no board extent reported — showing layer without measured zoom');
    warn.style.color = 'var(--amber,#f0a73a)';
    host.appendChild(warn);
  }

  // ---- viewport: board backdrop + toolbar + zoom/pan svg ----------------
  // All chrome is class-driven off the injected token stylesheet; only the
  // geometry-bound bits (viewBox math) stay inline below.
  const wrap = el('div', 'fv-gerber');

  const toolbar = el('div', 'fv-gerber-bar');
  const mkBtn = (label, aria) => {
    const b = el('button', null, label);
    b.type = 'button';
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  };
  const bFit = mkBtn('Fit', 'fit to view');
  const bIn = mkBtn('+', 'zoom in');
  const bOut = mkBtn('−', 'zoom out');
  const bInv = mkBtn('Invert', 'invert board colours');
  const hint = el('span', 'fv-gerber-hint', 'drag = pan · wheel = zoom');
  toolbar.appendChild(bFit); toolbar.appendChild(bIn); toolbar.appendChild(bOut);
  toolbar.appendChild(bInv); toolbar.appendChild(hint);
  wrap.appendChild(toolbar);

  // Stage holds the SVG; clipped so panned-out geometry doesn't overflow the
  // drawer. Fixed-ratio height that adapts to the narrow (360px) drawer.
  const stage = el('div', 'fv-gerber-stage');
  stage.appendChild(node);
  wrap.appendChild(stage);
  host.appendChild(wrap);

  // ---- zoom/pan over the SVG viewBox ------------------------------------
  // When we have a real viewBox we drive {x,y,w,h}; otherwise the SVG just
  // scales to fit (still visible, just no interactive zoom).
  // The board surface (green soldermask / white invert) is the deliberate PCB
  // data-viz representation, toggled via a class on the stage so the chrome
  // stylesheet owns the actual colours (var(--gbr-board…) with PCB fallbacks).
  let inverted = false;
  const applyColors = () => { stage.classList.toggle('is-inverted', inverted); };
  applyColors();

  if (vb) {
    const base = { x: vb.x, y: vb.y, w: vb.w, h: vb.h };
    const view = { x: vb.x, y: vb.y, w: vb.w, h: vb.h };
    const setVB = () => node.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);

    const fit = () => { view.x = base.x; view.y = base.y; view.w = base.w; view.h = base.h; setVB(); };

    // Zoom about a stage-relative point (sx,sy in [0..1]) so the feature under
    // the cursor stays put. factor>1 zooms in (smaller viewBox window).
    const MIN_W = base.w / 2000, MAX_W = base.w * 50;
    const zoomAt = (sx, sy, factor) => {
      let nw = view.w / factor;
      let nh = view.h / factor;
      if (nw < MIN_W) { const k = view.w / MIN_W; nw = MIN_W; nh = view.h / k; }
      if (nw > MAX_W) { const k = MAX_W / view.w; nw = MAX_W; nh = view.h * k; }
      const fx = view.x + view.w * sx;
      const fy = view.y + view.h * sy;
      view.x = fx - nw * sx;
      view.y = fy - nh * sy;
      view.w = nw; view.h = nh;
      setVB();
    };

    const rel = (clientX, clientY) => {
      const r = stage.getBoundingClientRect();
      return {
        sx: r.width ? (clientX - r.left) / r.width : 0.5,
        sy: r.height ? (clientY - r.top) / r.height : 0.5,
      };
    };

    const onWheel = (ev) => {
      ev.preventDefault();
      const { sx, sy } = rel(ev.clientX, ev.clientY);
      zoomAt(sx, sy, ev.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });

    let dragging = false, lx = 0, ly = 0;
    const onDown = (ev) => {
      dragging = true; lx = ev.clientX; ly = ev.clientY;
      stage.style.cursor = 'grabbing';
      if (stage.setPointerCapture) { try { stage.setPointerCapture(ev.pointerId); } catch (_) {} }
    };
    const onMove = (ev) => {
      if (!dragging) return;
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // screen px → viewBox units
      view.x -= (ev.clientX - lx) * (view.w / r.width);
      view.y -= (ev.clientY - ly) * (view.h / r.height);
      lx = ev.clientX; ly = ev.clientY;
      setVB();
    };
    const endDrag = () => { dragging = false; stage.style.cursor = 'grab'; };
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', endDrag);

    const onFit = () => fit();
    const onIn = () => zoomAt(0.5, 0.5, 1.3);
    const onOut = () => zoomAt(0.5, 0.5, 1 / 1.3);
    bFit.addEventListener('click', onFit);
    bIn.addEventListener('click', onIn);
    bOut.addEventListener('click', onOut);

    setVB();

    // Tear down listeners on view switch so nothing leaks.
    ctx.onCleanup(() => {
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', endDrag);
      stage.removeEventListener('pointercancel', endDrag);
      stage.removeEventListener('pointerleave', endDrag);
      bFit.removeEventListener('click', onFit);
      bIn.removeEventListener('click', onIn);
      bOut.removeEventListener('click', onOut);
    });
  } else {
    // No viewBox: zoom/pan would be meaningless. Keep the SVG fit-to-width and
    // disable the geometry buttons rather than wiring no-ops.
    node.style.maxWidth = '100%';
    node.style.height = 'auto';
    stage.style.cursor = 'default';
    stage.style.height = 'auto';
    // Disabled state (opacity/cursor) is handled by the chrome stylesheet.
    for (const b of [bFit, bIn, bOut]) { b.disabled = true; }
    hint.textContent = '';
  }

  const onInv = () => { inverted = !inverted; applyColors(); };
  bInv.addEventListener('click', onInv);
  ctx.onCleanup(() => bInv.removeEventListener('click', onInv));
}
