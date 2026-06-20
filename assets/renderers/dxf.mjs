/* PersonaOS deliverable viewer — DXF (Mechanical 2D drawings) renderer.
 *
 * Parses AutoCAD DXF text with dxf-parser@1.1.2 (MIT) and draws the resulting
 * entity model onto a 2D <canvas> with mouse pan / wheel-zoom, layer colours,
 * INSERT/block expansion and a parsed-summary header. We deliberately do NOT
 * use dxf-viewer (MPL-2.0, outside the permissive MIT/Apache/BSD/ISC allow-list)
 * nor three-dxf (fragile THREE.Font version coupling via esm.sh); a small custom
 * canvas painter over the MIT parser is robust and self-contained.
 *
 * Contract: lazy-load the lib ONLY inside render() via ctx.lazy(); THROW on any
 * failure so discovery.js shows its download/text fallback. Domain-agnostic:
 * renders whatever DXF bytes appear, no project/intent assumptions.
 */

export const meta = {
  exts: ['dxf'],
  media_kinds: ['dxf', 'drawing', 'cad', 'mechanical', 'mechanical_drawing'],
  fetchMode: 'text',
  label: 'Mechanical 2D drawing (DXF)',
};

// AutoCAD Color Index → CSS, for the handful of colours common in drawings.
// Index 0 = BYBLOCK, 7 = white/black (drawn light on dark), 256 = BYLAYER.
const ACI = {
  1: '#ff5555', 2: '#ffff66', 3: '#5dff5d', 4: '#5dffff', 5: '#6a8cff',
  6: '#ff66ff', 7: '#e8eef5', 8: '#808080', 9: '#c0c0c0',
};
const TWO_PI = Math.PI * 2;
// Hard cap on flattened drawable primitives. A pathological DXF (deep nested
// INSERTs, million-vertex polylines) would otherwise blow memory in flatten()
// and stall every pan/zoom frame in draw(). We stop flattening past the budget
// and surface a "showing N of M" notice rather than freezing the tab.
const MAX_PRIMS = 60000;

function aciToColor(idx) {
  if (idx == null || idx === 256 || idx === 0) return null; // BYLAYER / BYBLOCK
  return ACI[idx] || '#e8eef5';
}

// Resolve an entity's stroke colour: explicit ACI → layer colour → default.
function entColor(e, layers) {
  const direct = aciToColor(e.colorIndex ?? e.color);
  if (direct) return direct;
  const ly = e.layer && layers ? layers[e.layer] : null;
  if (ly && ly.color != null) {
    const c = aciToColor(ly.color);
    if (c) return c;
  }
  return '#9fd0ff';
}

function isFiniteNum(n) { return typeof n === 'number' && isFinite(n); }
function pt(p) { return p && isFiniteNum(p.x) && isFiniteNum(p.y) ? p : null; }

// Grow a {minX,minY,maxX,maxY} bbox by a point (model space).
function grow(b, x, y) {
  if (!isFiniteNum(x) || !isFiniteNum(y)) return;
  if (x < b.minX) b.minX = x; if (y < b.minY) b.minY = y;
  if (x > b.maxX) b.maxX = x; if (y > b.maxY) b.maxY = y;
}

// Arc point at angle (radians) around a centre.
function arcPt(cx, cy, r, a) { return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }

// Expand INSERTs into a flat list of drawable primitives in model space.
// Each primitive is one of: {k:'poly',pts,closed}, {k:'circle',c,r},
// {k:'arc',c,r,a0,a1}, {k:'text',p,h,s,rot}, {k:'point',p}. color/layer attached.
function flatten(entities, blocks, layers, out, xf, depth, stats) {
  if (!entities || depth > 12) return;
  for (const e of entities) {
    if (out.length >= MAX_PRIMS) { stats.truncated = true; return; }
    if (!e || !e.type) continue;
    const col = entColor(e, layers);
    const ly = e.layer || '0';
    const add = (prim) => { prim.color = col; prim.layer = ly; transform(prim, xf); out.push(prim); };
    switch (e.type) {
      case 'LINE': {
        const a = pt(e.vertices && e.vertices[0]);
        const b = pt(e.vertices && e.vertices[1]);
        if (a && b) add({ k: 'poly', pts: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], closed: false });
        break;
      }
      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const vs = (e.vertices || []).filter(pt).map((v) => ({ x: v.x, y: v.y, bulge: v.bulge || 0 }));
        if (vs.length >= 2 || (vs.length === 1 && e.type === 'POINT')) {
          add({ k: 'poly', pts: bulgePts(vs, e.shape), closed: !!e.shape });
        }
        break;
      }
      case 'CIRCLE': {
        const c = pt(e.center);
        if (c && isFiniteNum(e.radius)) add({ k: 'circle', c: { x: c.x, y: c.y }, r: e.radius });
        break;
      }
      case 'ARC': {
        const c = pt(e.center);
        if (c && isFiniteNum(e.radius)) {
          // dxf-parser stores start/end angle in RADIANS.
          add({ k: 'arc', c: { x: c.x, y: c.y }, r: e.radius, a0: e.startAngle || 0, a1: (e.endAngle ?? TWO_PI) });
        }
        break;
      }
      case 'ELLIPSE': {
        const c = pt(e.center);
        const maj = e.majorAxisEndPoint;
        if (c && maj && isFiniteNum(maj.x)) add(ellipsePrim(c, maj, e.axisRatio, e.startAngle, e.endAngle));
        break;
      }
      case 'SPLINE': {
        const cps = (e.fitPoints && e.fitPoints.length ? e.fitPoints : e.controlPoints) || [];
        const vs = cps.filter(pt).map((v) => ({ x: v.x, y: v.y }));
        if (vs.length >= 2) add({ k: 'poly', pts: vs, closed: false });
        break;
      }
      case 'SOLID':
      case '3DFACE': {
        const vs = (e.points || e.vertices || []).filter(pt).map((v) => ({ x: v.x, y: v.y }));
        if (vs.length >= 3) add({ k: 'poly', pts: vs, closed: true });
        break;
      }
      case 'POINT': {
        const p = pt(e.position) || pt(e);
        if (p) add({ k: 'point', p: { x: p.x, y: p.y } });
        break;
      }
      case 'TEXT':
      case 'MTEXT': {
        const p = pt(e.startPoint) || pt(e.position) || pt(e.insertionPoint);
        const s = (e.text || '').replace(/\\[A-Za-z][^;]*;|[{}]/g, '').trim();
        if (p && s) add({ k: 'text', p: { x: p.x, y: p.y }, h: e.textHeight || e.height || 2, s, rot: e.rotation || 0 });
        break;
      }
      case 'INSERT': {
        const blk = blocks && blocks[e.name];
        if (blk && blk.entities) {
          const ip = pt(e.position) || { x: 0, y: 0 };
          const child = composeXf(xf, {
            ox: ip.x, oy: ip.y,
            sx: e.xScale || 1, sy: e.yScale || 1,
            rot: ((e.rotation || 0) * Math.PI) / 180,
            bx: (blk.position && blk.position.x) || 0,
            by: (blk.position && blk.position.y) || 0,
          });
          flatten(blk.entities, blocks, layers, out, child, depth + 1, stats);
        }
        break;
      }
      default:
        // Unknown entity types are skipped, not fatal — but we tally them so the
        // header can warn that the drawing is partially rendered.
        stats.unsupported[e.type] = (stats.unsupported[e.type] || 0) + 1;
        break;
    }
  }
}

// Tessellate a polyline honouring per-vertex bulge (arc segment) values.
function bulgePts(vs, closed) {
  const out = [];
  const n = vs.length;
  for (let i = 0; i < n; i++) {
    const a = vs[i];
    out.push({ x: a.x, y: a.y });
    const last = i === n - 1;
    if (last && !closed) break;
    const b = vs[last ? 0 : i + 1];
    if (a.bulge) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const chord = Math.hypot(dx, dy);
      if (chord > 1e-9) {
        const theta = 4 * Math.atan(a.bulge);
        const r = chord / (2 * Math.sin(theta / 2));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const h = (r * Math.cos(theta / 2));
        const nx = -dy / chord, ny = dx / chord;
        const cx = mid.x + nx * h * Math.sign(a.bulge);
        const cy = mid.y + ny * h * Math.sign(a.bulge);
        let a0 = Math.atan2(a.y - cy, a.x - cx);
        let a1 = Math.atan2(b.y - cy, b.x - cx);
        const steps = Math.max(2, Math.ceil(Math.abs(theta) / 0.2));
        let span = a1 - a0;
        if (a.bulge > 0 && span < 0) span += TWO_PI;
        if (a.bulge < 0 && span > 0) span -= TWO_PI;
        for (let s = 1; s < steps; s++) {
          const ang = a0 + (span * s) / steps;
          out.push({ x: cx + Math.abs(r) * Math.cos(ang), y: cy + Math.abs(r) * Math.sin(ang) });
        }
      }
    }
  }
  return out;
}

// Polyline approximation of an ellipse / elliptical arc.
function ellipsePrim(c, maj, ratio, a0, a1) {
  const r = ratio || 1;
  const majLen = Math.hypot(maj.x, maj.y);
  const rot = Math.atan2(maj.y, maj.x);
  const start = a0 || 0;
  const end = (a1 == null || a1 === 0) ? TWO_PI : a1;
  let span = end - start; if (span <= 0) span += TWO_PI;
  const steps = Math.max(16, Math.ceil(span / 0.15));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = start + (span * i) / steps;
    const ex = majLen * Math.cos(t);
    const ey = majLen * r * Math.sin(t);
    pts.push({ x: c.x + ex * Math.cos(rot) - ey * Math.sin(rot), y: c.y + ex * Math.sin(rot) + ey * Math.cos(rot) });
  }
  return { k: 'poly', pts, closed: span >= TWO_PI - 1e-6 };
}

// --- block transform stack (translate + uniform/per-axis scale + rotation) ---
function composeXf(parent, t) {
  const cos = Math.cos(t.rot), sin = Math.sin(t.rot);
  // local point lp → parent: translate by -block base, scale, rotate, translate by insert pt
  const local = (x, y) => {
    const px = (x - t.bx) * t.sx, py = (y - t.by) * t.sy;
    return { x: t.ox + px * cos - py * sin, y: t.oy + px * sin + py * cos };
  };
  if (!parent) return { apply: local, scale: Math.max(Math.abs(t.sx), Math.abs(t.sy)) };
  return {
    apply: (x, y) => { const p = local(x, y); return parent.apply(p.x, p.y); },
    scale: parent.scale * Math.max(Math.abs(t.sx), Math.abs(t.sy)),
  };
}
function transform(prim, xf) {
  if (!xf) return;
  const f = xf.apply;
  if (prim.pts) for (const p of prim.pts) { const q = f(p.x, p.y); p.x = q.x; p.y = q.y; }
  if (prim.c) { const q = f(prim.c.x, prim.c.y); prim.c = q; prim.r *= xf.scale; }
  if (prim.p) prim.p = f(prim.p.x, prim.p.y);
  if (prim.h) prim.h *= xf.scale;
}

// Compute model-space bounding box across all flattened primitives.
function bboxOf(prims) {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of prims) {
    if (p.pts) for (const v of p.pts) grow(b, v.x, v.y);
    else if (p.k === 'circle' || p.k === 'arc') { grow(b, p.c.x - p.r, p.c.y - p.r); grow(b, p.c.x + p.r, p.c.y + p.r); }
    else if (p.p) grow(b, p.p.x, p.p.y);
  }
  return b;
}

export async function render(ctx) {
  const { host } = ctx;
  const note = loading(ctx, 'loading DXF renderer…');
  host.appendChild(note);

  // 1) fetch the drawing text
  const text = await ctx.fetchText();
  if (text == null || text === '') throw new Error('dxf: empty body');

  // 2) lazy-load the MIT parser (pinned). esm.sh exposes the class as default.
  const mod = await ctx.lazy('https://esm.sh/dxf-parser@1.1.2');
  const DxfParser = mod.default || mod.DxfParser || mod;
  if (typeof DxfParser !== 'function') throw new Error('dxf: parser export missing');

  // 3) parse → entity model. The parse is a heavy SYNCHRONOUS pass; flag the
  // stage so a multi-MB drawing doesn't sit on the "loading renderer" text.
  note.textContent = 'parsing DXF…';
  let dxf;
  try {
    const parser = new DxfParser();
    dxf = (typeof parser.parseSync === 'function') ? parser.parseSync(text) : parser.parse(text);
  } catch (e) {
    throw new Error('dxf: parse failed — ' + (e && e.message ? e.message : e));
  }
  if (!dxf || !Array.isArray(dxf.entities)) throw new Error('dxf: no entities parsed');

  const layers = (dxf.tables && dxf.tables.layer && dxf.tables.layer.layers) || {};
  const blocks = dxf.blocks || {};

  // 4) flatten (expand INSERTs) into drawable primitives in model space, under a
  // budget so a huge file can't freeze the tab. stats carries degraded-render
  // signals (truncation + unsupported entity types) for the inline notice.
  const stats = { truncated: false, unsupported: {} };
  const prims = [];
  flatten(dxf.entities, blocks, layers, prims, null, 0, stats);
  if (!prims.length) throw new Error('dxf: nothing drawable (no supported entities)');

  const bb = bboxOf(prims);
  if (!isFinite(bb.minX) || !isFinite(bb.maxX) || bb.maxX <= bb.minX && bb.maxY <= bb.minY) {
    throw new Error('dxf: degenerate bounds');
  }

  // ---- layout: header summary + toolbar + canvas ----------------------------
  host.innerHTML = '';
  const wrap = ctx.el('div', 'dxfv');
  wrap.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;min-height:360px;background:#0c1118;color:#cfe0f2;font:12px/1.4 ui-monospace,Menlo,monospace';

  // entity-type tally for the summary line
  const tally = {};
  for (const e of dxf.entities) tally[e.type] = (tally[e.type] || 0) + 1;
  const tallyStr = Object.keys(tally).sort().map((k) => `${k}×${tally[k]}`).join('  ');
  const w = (bb.maxX - bb.minX), h = (bb.maxY - bb.minY);
  const fmt = (n) => Math.abs(n) >= 1000 ? n.toFixed(0) : (+n.toFixed(3)).toString();

  const head = ctx.el('div', 'dxfv-head');
  head.style.cssText = 'padding:6px 10px;border-bottom:1px solid #1d2a3a;background:#0f1722;font-size:11px;color:#8fb6e0';
  head.appendChild(ctx.el('div', null, `${ctx.title || 'drawing.dxf'} · ${dxf.entities.length} entities · extent ${fmt(w)} × ${fmt(h)}`));
  const sub = ctx.el('div', null, tallyStr || '—');
  sub.style.cssText = 'color:#5f7da0;margin-top:2px;word-break:break-word';
  head.appendChild(sub);

  // degraded-render notice: budget-truncated and/or unsupported entity types.
  // We still render what we have — this is a warning, not a fatal throw.
  const unsupNames = Object.keys(stats.unsupported);
  if (stats.truncated || unsupNames.length) {
    const parts = [];
    if (stats.truncated) parts.push(`large drawing capped — showing first ${prims.length.toLocaleString()} shapes (more exist)`);
    if (unsupNames.length) {
      const total = unsupNames.reduce((s, k) => s + stats.unsupported[k], 0);
      const shown = unsupNames.slice(0, 6).map((k) => `${k}×${stats.unsupported[k]}`).join(', ');
      parts.push(`${total} unsupported entit${total === 1 ? 'y' : 'ies'} not drawn (${shown}${unsupNames.length > 6 ? ', …' : ''})`);
    }
    const warn = ctx.el('div', 'dxfv-warn', '⚠ ' + parts.join(' · '));
    warn.style.cssText = 'color:#e6c07b;margin-top:4px;word-break:break-word;line-height:1.35';
    head.appendChild(warn);
  }
  wrap.appendChild(head);

  const bar = ctx.el('div', 'dxfv-bar');
  bar.style.cssText = 'display:flex;gap:6px;align-items:center;padding:5px 10px;border-bottom:1px solid #1d2a3a;background:#0d1420;flex-wrap:wrap';
  const mkBtn = (label) => { const b = ctx.el('button', null, label);
    b.style.cssText = 'background:#16263a;color:#bcd6f0;border:1px solid #28435f;border-radius:4px;padding:3px 9px;cursor:pointer;font:11px ui-monospace,monospace';
    return b; };
  const bFit = mkBtn('Fit'); const bIn = mkBtn('+'); const bOut = mkBtn('−');
  const bTxt = mkBtn('Text: on');
  const hint = ctx.el('span', null, 'drag = pan · wheel = zoom');
  hint.style.cssText = 'color:#4f6684;margin-left:auto';
  bar.appendChild(bFit); bar.appendChild(bIn); bar.appendChild(bOut); bar.appendChild(bTxt); bar.appendChild(hint);
  wrap.appendChild(bar);

  const cvWrap = ctx.el('div', 'dxfv-cv');
  cvWrap.style.cssText = 'position:relative;flex:1;min-height:300px;overflow:hidden;cursor:grab';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  cvWrap.appendChild(canvas);
  wrap.appendChild(cvWrap);
  host.appendChild(wrap);

  // ---- view state: model→screen via {scale, tx, ty}; Y flips (DXF is Y-up) --
  const view = { scale: 1, tx: 0, ty: 0, showText: true };
  // teardown guard: once the view is disposed, deferred RAFs / observer
  // callbacks must no-op (the canvas may be detached).
  let alive = true;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const g = canvas.getContext('2d');
  if (!g) throw new Error('dxf: 2d canvas unavailable');

  // Resize the canvas backing store to the container. Only call this on real
  // size changes (fit + ResizeObserver) — NOT inside draw(), or every pan/zoom
  // frame would reallocate the backing store and stutter on large drawings.
  function sizeCanvas() {
    const r = cvWrap.getBoundingClientRect();
    const cw = Math.max(50, Math.floor(r.width)), ch = Math.max(50, Math.floor(r.height));
    const bw = Math.floor(cw * dpr), bh = Math.floor(ch * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    return { cw, ch };
  }
  function fit() {
    const { cw, ch } = sizeCanvas();
    const pad = 24;
    const sx = (cw - pad * 2) / (w || 1), sy = (ch - pad * 2) / (h || 1);
    view.scale = Math.min(sx, sy) || 1;
    if (!isFinite(view.scale) || view.scale <= 0) view.scale = 1;
    // centre the drawing
    const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
    view.tx = cw / 2 - cx * view.scale;
    view.ty = ch / 2 + cy * view.scale; // +: Y flip handled here
    draw();
  }
  const toScreen = (x, y) => ({ X: x * view.scale + view.tx, Y: -y * view.scale + view.ty });

  function draw() {
    if (!alive) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // backing-store size in CSS px (set by sizeCanvas) drives the clear/fill.
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = '#0c1118'; g.fillRect(0, 0, cw, ch);
    g.lineWidth = 1; g.lineJoin = 'round'; g.lineCap = 'round';

    for (const p of prims) {
      g.strokeStyle = p.color || '#9fd0ff';
      if (p.k === 'poly') {
        if (!p.pts.length) continue;
        g.beginPath();
        const a = toScreen(p.pts[0].x, p.pts[0].y); g.moveTo(a.X, a.Y);
        for (let i = 1; i < p.pts.length; i++) { const s = toScreen(p.pts[i].x, p.pts[i].y); g.lineTo(s.X, s.Y); }
        if (p.closed) g.closePath();
        g.stroke();
      } else if (p.k === 'circle') {
        const c = toScreen(p.c.x, p.c.y); const rr = p.r * view.scale;
        if (rr > 0.2) { g.beginPath(); g.arc(c.X, c.Y, rr, 0, TWO_PI); g.stroke(); }
      } else if (p.k === 'arc') {
        const c = toScreen(p.c.x, p.c.y); const rr = p.r * view.scale;
        if (rr > 0.2) {
          // model Y-up → screen Y-down: negate angles and swap direction
          g.beginPath(); g.arc(c.X, c.Y, rr, -p.a1, -p.a0, false); g.stroke();
        }
      } else if (p.k === 'point') {
        const c = toScreen(p.p.x, p.p.y);
        g.fillStyle = p.color || '#9fd0ff'; g.fillRect(c.X - 1.5, c.Y - 1.5, 3, 3);
      } else if (p.k === 'text' && view.showText) {
        const c = toScreen(p.p.x, p.p.y);
        const px = Math.max(7, Math.min(40, (p.h || 2) * view.scale));
        if (px >= 5) {
          g.save(); g.translate(c.X, c.Y);
          if (p.rot) g.rotate((-p.rot * Math.PI) / 180);
          g.fillStyle = p.color || '#cfe0f2';
          g.font = `${px}px ui-monospace,monospace`;
          g.textBaseline = 'bottom';
          g.fillText(p.s, 0, 0);
          g.restore();
        }
      }
    }
  }

  // ---- interaction ----------------------------------------------------------
  function zoomAt(cx, cy, factor) {
    const r = cvWrap.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    // keep the model point under the cursor stationary
    const mx = (px - view.tx) / view.scale, my = -(py - view.ty) / view.scale;
    view.scale *= factor;
    view.tx = px - mx * view.scale; view.ty = py + my * view.scale;
    draw();
  }
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (ev) => { dragging = true; lx = ev.clientX; ly = ev.clientY;
    cvWrap.style.cursor = 'grabbing'; canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId); });
  canvas.addEventListener('pointermove', (ev) => { if (!dragging) return;
    view.tx += ev.clientX - lx; view.ty += ev.clientY - ly; lx = ev.clientX; ly = ev.clientY; draw(); });
  const endDrag = () => { dragging = false; cvWrap.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', endDrag);

  bFit.addEventListener('click', fit);
  const cc = () => { const r = cvWrap.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  bIn.addEventListener('click', () => { const p = cc(); zoomAt(p.x, p.y, 1.3); });
  bOut.addEventListener('click', () => { const p = cc(); zoomAt(p.x, p.y, 1 / 1.3); });
  bTxt.addEventListener('click', () => { view.showText = !view.showText; bTxt.textContent = 'Text: ' + (view.showText ? 'on' : 'off'); draw(); });

  // resize the backing store then repaint on container resize (drawer open /
  // window resize). draw() alone no longer resizes, so resize must do both.
  const onResize = () => { if (!alive) return; sizeCanvas(); draw(); };
  let ro = null;
  try {
    ro = new ResizeObserver(onResize);
    ro.observe(cvWrap);
  } catch (_) { window.addEventListener('resize', onResize); }

  // teardown: stop deferred work and detach observers/listeners so switching
  // files doesn't leak a live ResizeObserver / window handler per opened DXF.
  const dispose = () => {
    if (!alive) return;
    alive = false;
    if (ro) { try { ro.disconnect(); } catch (_) {} }
    try { window.removeEventListener('resize', onResize); } catch (_) {}
  };
  if (typeof ctx.onCleanup === 'function') { try { ctx.onCleanup(dispose); } catch (_) {} }

  // initial paint — defer one frame so the drawer has its final size
  requestAnimationFrame(() => { if (alive) fit(); });
}

function loading(ctx, label) {
  const d = ctx.el('div', 'fv-loading', label);
  d.style.cssText = 'padding:14px;color:#7f9bbd;font:12px ui-monospace,monospace';
  return d;
}
