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

  // Inject the module-local layout chrome once. The host stylesheet ships the
  // shared .fv-loading / .fv-note primitives (which this module reuses), but
  // not the pdf-* stage / canvas / page-nav classes below. All colours, radii,
  // spacing and type reference the discovery design tokens (with fallbacks that
  // match the live token values) so the viewer reads as one product with the
  // dashboard and the other renderers.
  injectStyle(host, el);

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
  const stage = el('div', 'pdf-stage');
  host.appendChild(stage);

  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-canvas';
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
  const nav = el('div', 'pdf-nav');

  const prev = el('button', 'pdf-btn', '← prev');
  const next = el('button', 'pdf-btn', 'next →');
  prev.type = next.type = 'button';

  const jump = document.createElement('input');
  jump.type = 'number';
  jump.className = 'pdf-jump';
  jump.min = '1';
  jump.max = String(total);
  jump.setAttribute('aria-label', 'go to page');

  const ofTotal = el('span', 'pdf-of', `/ ${total}`);

  // Degraded-render notice (one line, reused).
  const notice = el('div', 'fv-note pdf-notice', '');
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

/* ===========================================================================
   STYLE  (id-guarded; references the discovery design tokens with fallbacks
   that MATCH the live token values — a wrong fallback would be a latent second
   palette). The host stylesheet ships the shared .fv-loading / .fv-note
   primitives this module reuses, but NOT the pdf-* stage / page / page-nav
   chrome below, which provides the scrolling page viewport, the white page
   surface (a PDF page is rendered light-on-white by definition) framed to sit
   inside the dark drawer, and the segmented prev / jump / next control group.

   DESIGN: surfaces use --surface-inset / --surface-raised, hairlines --line2,
   radii the --radius-* scale, type the --sans chrome font with --mono only for
   the tabular page-number digits, and a two-layer accent focus ring + eased
   hover/press so the controls read as one product with the dashboard buttons.
   Injected once per document / shadow-root.
   =========================================================================== */
const STYLE_ID = 'fv-pdf-style';
const CSS = `
.pdf-stage{max-height:min(520px,68vh);overflow:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;text-align:center;
  padding:var(--space-2,8px);
  background:var(--surface-inset,#070b10);
  border:1px solid var(--line2,#233040);border-radius:var(--radius-md,6px)}
/* The page itself is light-on-white (PDF media-box); frame it so it reads as a
   document sheet resting on the dark inset, not a raw white box. */
.pdf-canvas{display:inline-block;width:auto;max-width:100%;height:auto;
  border-radius:var(--radius-sm,4px);background:#fff;
  box-shadow:0 1px 2px rgba(0,0,0,.30),0 4px 12px rgba(0,0,0,.22)}
/* page-nav: centred segmented control group (prev · jump / total · next). */
.pdf-nav{display:flex;align-items:center;justify-content:center;gap:var(--space-2,8px);
  flex-wrap:wrap;margin-top:var(--space-2,8px);
  font-family:var(--sans,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);
  font-size:var(--fs-label,11px);color:var(--mut,#7d8ea2);letter-spacing:var(--tr-caps,.06em)}
.pdf-btn{display:inline-flex;align-items:center;justify-content:center;
  min-width:62px;min-height:var(--ctl-h,30px);padding:0 var(--ctl-pad-x,10px);
  font-family:inherit;font-size:var(--fs-label,11px);font-weight:var(--w-semi,600);
  line-height:1;cursor:pointer;
  color:var(--dim,#90a0b2);background:var(--surface-raised,#0b121b);
  border:1px solid var(--line2,#233040);border-radius:var(--radius-md,6px);
  transition:color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    border-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    background var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    box-shadow var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    transform var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.pdf-btn:hover:not(:disabled){color:var(--ink,#cdd9e5);
  border-color:var(--accent,#4c9ff0);background:var(--surface-hover,#0e1722)}
.pdf-btn:active:not(:disabled){transform:var(--press,translateY(.5px))}
.pdf-btn:focus-visible{outline:none;border-color:var(--accent,#4c9ff0);
  box-shadow:0 0 0 3px var(--focus-ring,rgba(76,159,240,.20))}
.pdf-btn:disabled{opacity:.42;cursor:not-allowed}
.pdf-jump{width:58px;text-align:center;
  font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);
  font-size:var(--fs-label,11px);font-variant-numeric:tabular-nums;
  min-height:var(--ctl-h,30px);padding:0 var(--space-1,4px);
  color:var(--ink,#cdd9e5);background:var(--surface-inset,#070b10);
  border:1px solid var(--line2,#233040);border-radius:var(--radius-md,6px);
  transition:border-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    box-shadow var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.pdf-jump:focus{outline:none;border-color:var(--accent,#4c9ff0);
  box-shadow:0 0 0 3px var(--focus-ring,rgba(76,159,240,.20))}
.pdf-jump::-webkit-inner-spin-button,
.pdf-jump::-webkit-outer-spin-button{opacity:.5;filter:grayscale(1)}
.pdf-of{font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);
  font-variant-numeric:tabular-nums;color:var(--mut,#7d8ea2)}
/* degraded-page notice: amber-left soft callout, distinct from the neutral
   document caption note above the stage. */
.pdf-notice{color:var(--amber,#f0a73a);
  border-left:2px solid var(--amber,#f0a73a);
  background:var(--amber-weak,rgba(240,167,58,.07));
  padding:var(--space-1,4px) var(--space-2,8px);
  border-radius:0 var(--radius-sm,4px) var(--radius-sm,4px) 0}
@media (prefers-reduced-motion:reduce){
  .pdf-btn{transition-duration:.01ms!important}
  .pdf-jump{transition-duration:.01ms!important}
}
`;

function injectStyle(host, el) {
  const doc = (host && host.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;
  const rootNode = host && host.getRootNode ? host.getRootNode() : doc;
  const scope = rootNode && rootNode.nodeType === 11 ? rootNode : (doc.head || doc.documentElement);
  if (!scope || (scope.querySelector && scope.querySelector('#' + STYLE_ID))) return;
  const style = (typeof el === 'function') ? el('style', null) : doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  scope.appendChild(style);
}
