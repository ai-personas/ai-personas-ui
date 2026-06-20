/* ====================================================================
   PersonaOS deliverable viewer — lazy file-renderer module
   FAMILY: pdf  (Portable Document Format, .pdf)
   --------------------------------------------------------------------
   Renders PDF bytes to a <canvas> in-browser using pdf.js (pdfjs-dist,
   Mozilla), lazy-loaded from a pinned CDN ESM build only when a PDF is
   actually opened. The pdf.js worker is run off the main thread via
   GlobalWorkerOptions.workerSrc -> the MATCHING CDN worker URL (same
   pinned version).

   ONE page is on screen at a time via prev/next/jump page-nav, so a
   thousand-page PDF holds a single canvas — DOM and memory stay flat
   regardless of document size, and the tab never freezes. Each page is
   fit to the live drawer width (responsive down to ~360px mobile) and
   re-fit on resize. In-flight renders are cancelled on page switch /
   teardown; the document + worker are destroyed via ctx.onCleanup.

   Domain-agnostic: renders whatever PDF bytes appear — no project /
   intent assumptions. Fail-soft: every risky step is wrapped and the
   module THROWS on any failure so discovery.js shows its existing
   download / text fallback (never a broken or blank pane).

   Library : pdfjs-dist@4.10.38  (Apache-2.0 — permissive)
   Why 4.x : stable, broadly browser-compatible ESM build with a clean
             named-export surface (getDocument, GlobalWorkerOptions,
             version) and a module worker at build/pdf.worker.min.mjs.
   ==================================================================== */

// Pinned version — keep lib + worker in lockstep (worker MUST match the
// API build or pdf.js refuses to run / silently mismatches).
const PDFJS_VER = '4.10.38';
const PDFJS_ESM = `https://esm.sh/pdfjs-dist@${PDFJS_VER}`;
// Worker served as a real JS module from a raw-file CDN (esm.sh rewrites
// internal paths, so the unwrapped jsdelivr build is the reliable worker).
const PDFJS_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.worker.min.mjs`;

// Upper bound on the rendered page's CSS width. The actual width tracks the
// drawer (host) so the page fits a narrow ~360px mobile drawer; this only
// stops a wide desktop drawer from rasterising a needlessly huge bitmap.
const MAX_W = 900;
// Floor so a momentarily-zero-width host (not yet laid out) still produces a
// legible page instead of a 1px canvas.
const MIN_W = 240;
// Hard ceiling on the backing-store bitmap area (device px²). Above this we
// trim the device-pixel multiplier so a huge media-box page on a hi-dpi
// screen can't allocate hundreds of MB of canvas memory and freeze the tab.
const MAX_CANVAS_PX = 4_000_000;

export const meta = {
  exts: ['pdf'],
  media_kinds: ['pdf', 'application/pdf'],
  fetchMode: 'bytes',
  label: 'PDF document (paged)',
};

export async function render(ctx) {
  const { host, el, esc } = ctx;

  // --- progress note (replaced once the first page paints) ---------------
  host.innerHTML = '';
  const loading = el('div', 'fv-loading', 'loading PDF renderer…');
  host.appendChild(loading);

  // --- lazy-load the library (throws -> app fallback) --------------------
  const mod = await ctx.lazy(PDFJS_ESM);
  // esm.sh may expose the API under default or as named exports; normalise.
  const pdfjs = mod && (mod.getDocument ? mod : (mod.default || mod));
  if (!pdfjs || typeof pdfjs.getDocument !== 'function') {
    throw new Error('pdf.js: getDocument export not found');
  }

  // --- worker: run pdf.js off the main thread ----------------------------
  // Setting workerSrc to a .mjs URL makes pdf.js spawn a module worker.
  try {
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    }
  } catch (e) {
    // Non-fatal: pdf.js will fall back to a fake (main-thread) worker.
  }

  // --- fetch the bytes (throws -> app fallback) --------------------------
  loading.textContent = 'fetching PDF…';
  const buf = await ctx.fetchBytes();
  if (!buf || (buf.byteLength != null && buf.byteLength === 0)) {
    throw new Error('pdf: empty body');
  }
  // pdf.js consumes the buffer (transfers it to the worker); hand it a copy
  // so the original ArrayBuffer the host may reuse isn't detached.
  const data = new Uint8Array(buf.byteLength);
  data.set(new Uint8Array(buf));

  // --- parse the document (throws -> app fallback) -----------------------
  loading.textContent = 'parsing PDF…';
  const task = pdfjs.getDocument({
    data,
    // Don't reach out to the network for fonts/cmaps we can't host; pdf.js
    // degrades font rendering gracefully without these.
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    throw new Error('pdf parse failed: ' + (e && e.message ? e.message : e));
  }

  const total = doc.numPages | 0;
  if (!total) {
    try { doc.destroy(); } catch (_) {}
    throw new Error('pdf: zero pages');
  }

  // --- build the shell ---------------------------------------------------
  // One page is on screen at a time (page-nav), so a 1000-page PDF holds a
  // single canvas — DOM/memory stay flat regardless of document size.
  host.innerHTML = '';

  const note = el('div', 'fv-note',
    `${esc(ctx.title || 'document.pdf')} · ${total} page${total === 1 ? '' : 's'}`);
  host.appendChild(note);

  // Page viewport: scrolls when a tall page overflows; centred canvas.
  const stage = el('div');
  stage.style.cssText =
    'max-height:520px;overflow:auto;text-align:center;padding:2px;' +
    'background:var(--surface-inset,#11161c);border-radius:4px';
  host.appendChild(stage);

  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'display:inline-block;width:auto;max-width:100%;height:auto;' +
    'border:1px solid var(--line2,#2a3340);border-radius:4px;background:#fff';
  stage.appendChild(canvas);

  // --- teardown bookkeeping (cancel in-flight render, kill worker) --------
  let disposed = false;
  let curTask = null;     // the live pdf.js RenderTask, so we can cancel it
  let ro = null;          // ResizeObserver, disposed on teardown

  if (typeof ctx.onCleanup === 'function') {
    try {
      ctx.onCleanup(() => {
        disposed = true;
        if (ro) { try { ro.disconnect(); } catch (_) {} ro = null; }
        if (curTask) { try { curTask.cancel(); } catch (_) {} curTask = null; }
        try { doc.destroy(); } catch (_) {}
      });
    } catch (_) {}
  }

  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

  // Available CSS width = the drawer/host's content width, clamped. This is
  // what makes the page fit a ~360px mobile drawer instead of overflowing.
  function fitWidth() {
    const avail = (stage.clientWidth || host.clientWidth || MIN_W) - 6; // padding slack
    return Math.max(MIN_W, Math.min(MAX_W, avail || MIN_W));
  }

  let cur = 0;            // currently-displayed page number (0 = none yet)
  let busy = false;       // guard against overlapping renders / re-entrancy
  let firstPaintOk = false;

  // Render exactly ONE page into the single canvas. Cancels any in-flight
  // render first. Returns true on success; throws only when nothing has ever
  // painted (so the app fallback fires), otherwise surfaces an inline notice.
  async function showPage(pageNo) {
    pageNo = Math.min(total, Math.max(1, pageNo | 0));
    if (busy || disposed) return;
    busy = true;
    if (curTask) { try { curTask.cancel(); } catch (_) {} curTask = null; }
    let page = null;
    try {
      page = await doc.getPage(pageNo);
      if (disposed) return;

      // Fit the page to the live container width, preserving aspect ratio.
      const base = page.getViewport({ scale: 1 });
      const cssW = fitWidth();
      const cssScale = (cssW / (base.width || cssW)) || 1;
      // Device-pixel multiplier for crisp text, trimmed so the backing store
      // can't exceed MAX_CANVAS_PX (memory guard on huge / hi-dpi pages).
      const target = page.getViewport({ scale: cssScale });
      let pxScale = cssScale * dpr;
      const area = (target.width * dpr) * (target.height * dpr);
      if (area > MAX_CANVAS_PX) pxScale *= Math.sqrt(MAX_CANVAS_PX / area);

      const viewport = page.getViewport({ scale: pxScale });
      const c2d = canvas.getContext('2d', { alpha: false });
      if (!c2d) throw new Error('pdf: 2d context unavailable');

      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      // Logical (CSS) display size = backing store / dpr → device pixels add
      // sharpness without changing layout. Caps at the container width.
      canvas.style.width = Math.min(cssW, Math.ceil(viewport.width / dpr)) + 'px';
      canvas.setAttribute('aria-label', `PDF page ${pageNo} of ${total}`);

      const task = page.render({ canvasContext: c2d, viewport });
      curTask = task;
      await task.promise;
      if (disposed) return;
      curTask = null;
      cur = pageNo;
      firstPaintOk = true;
    } catch (e) {
      curTask = null;
      // A cancelled render (page switch / teardown) is expected — not an error.
      const cancelled = e && (e.name === 'RenderingCancelledException' ||
        /cancel/i.test(e.message || ''));
      if (disposed || cancelled) return;
      if (!firstPaintOk) {
        // Nothing ever painted → fall back to the app's download/text view.
        try { doc.destroy(); } catch (_) {}
        throw new Error('pdf render failed: ' + (e && e.message ? e.message : e));
      }
      // A later page failed: keep the viewer, surface an inline degraded notice.
      flash(`page ${pageNo} failed to render`);
    } finally {
      try { if (page) page.cleanup(); } catch (_) {}
      busy = false;
      syncNav();
    }
  }

  // --- page-nav controls -------------------------------------------------
  const nav = el('div');
  nav.style.cssText =
    'display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;' +
    'margin-top:8px;font-size:11px;color:var(--mut,#7c8a99);letter-spacing:.3px';

  const btnCss =
    'padding:4px 11px;font-size:11px;cursor:pointer;background:var(--surface-inset,#11161c);' +
    'color:var(--amber,#e2a23b);border:1px solid var(--line2,#2a3340);border-radius:5px;' +
    'min-width:54px;line-height:1.4';

  const prev = el('button', null, '← prev');
  const next = el('button', null, 'next →');
  prev.type = next.type = 'button';
  prev.style.cssText = next.style.cssText = btnCss;

  const jump = document.createElement('input');
  jump.type = 'number';
  jump.min = '1';
  jump.max = String(total);
  jump.setAttribute('aria-label', 'go to page');
  jump.style.cssText =
    'width:56px;text-align:center;font-size:11px;padding:3px 4px;background:var(--bg,#0d1117);' +
    'color:var(--fg,#cdd6e0);border:1px solid var(--line2,#2a3340);border-radius:4px';

  const ofTotal = el('span', null, `/ ${total}`);

  // Degraded-render notice (one line, reused).
  const notice = el('div', 'fv-note', '');
  notice.style.display = 'none';
  let flashT = null;
  function flash(msg) {
    notice.textContent = msg;
    notice.style.display = '';
    if (flashT) clearTimeout(flashT);
    flashT = setTimeout(() => { notice.style.display = 'none'; }, 6000);
  }

  function syncNav() {
    prev.disabled = busy || cur <= 1;
    next.disabled = busy || cur >= total;
    if (document.activeElement !== jump) jump.value = String(cur || 1);
  }

  prev.addEventListener('click', () => { if (!busy) showPage(cur - 1); });
  next.addEventListener('click', () => { if (!busy) showPage(cur + 1); });
  const go = () => {
    const n = parseInt(jump.value, 10);
    if (!isNaN(n) && n !== cur) showPage(n); else syncNav();
  };
  jump.addEventListener('change', go);
  jump.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });

  // Single-page documents need no nav at all.
  if (total > 1) {
    nav.appendChild(prev);
    nav.appendChild(jump);
    nav.appendChild(ofTotal);
    nav.appendChild(next);
    host.appendChild(nav);
  }
  host.appendChild(notice);

  // --- first paint (must succeed, or THROW for the app fallback) ----------
  await showPage(1);

  // Re-fit on drawer resize (orientation change / responsive layout). Only
  // re-render when the available width actually changes, debounced.
  if (typeof ResizeObserver !== 'undefined') {
    let lastW = fitWidth();
    let rt = null;
    try {
      ro = new ResizeObserver(() => {
        if (disposed) return;
        const w = fitWidth();
        if (Math.abs(w - lastW) < 8) return;   // ignore sub-pixel jitter
        lastW = w;
        if (rt) clearTimeout(rt);
        rt = setTimeout(() => { if (!disposed && !busy && cur) showPage(cur); }, 160);
      });
      ro.observe(stage);
    } catch (_) { ro = null; }
  }
}
