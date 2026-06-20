/* ====================================================================
   PersonaOS deliverable viewer — lazy file-renderer module
   FAMILY: pdf  (Portable Document Format, .pdf)
   --------------------------------------------------------------------
   Renders PDF bytes to <canvas> pages in-browser using pdf.js
   (pdfjs-dist, Mozilla), lazy-loaded from a pinned CDN ESM build only
   when a PDF is actually opened. The pdf.js worker is run off the main
   thread via GlobalWorkerOptions.workerSrc -> the MATCHING CDN worker
   URL (same pinned version).

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

// How many pages to eagerly render before showing a "render more" control.
// Keeps large documents from blocking the drawer; the rest render on demand.
const FIRST_N = 5;
// Cap the rendered bitmap width (CSS px) so huge media-box pages don't blow
// up canvas memory; scaled up for device pixel ratio for crisp text.
const MAX_W = 900;

export const meta = {
  exts: ['pdf'],
  media_kinds: ['pdf', 'application/pdf'],
  fetchMode: 'bytes',
  label: 'PDF document',
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
  host.innerHTML = '';
  const wrap = el('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;max-height:520px;overflow:auto;padding:2px';
  host.appendChild(wrap);

  const note = el('div', 'fv-note',
    `${esc(ctx.title || 'document.pdf')} · ${total} page${total === 1 ? '' : 's'}`);
  host.insertBefore(note, wrap);

  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  let rendered = 0;
  let firstPaintOk = false;

  // Render a single page into its own canvas appended to `wrap`.
  async function renderPage(pageNo) {
    const page = await doc.getPage(pageNo);
    // Fit width to MAX_W (cap), preserving aspect; multiply by dpr for crisp.
    const base = page.getViewport({ scale: 1 });
    const cssScale = Math.min(1.6, MAX_W / (base.width || MAX_W));
    const viewport = page.getViewport({ scale: cssScale * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    // Display at logical (CSS) size; the extra dpr pixels sharpen text.
    canvas.style.cssText =
      'display:block;width:100%;max-width:' +
      Math.ceil(viewport.width / dpr) +
      'px;margin:0 auto;border:1px solid var(--line2,#2a3340);border-radius:4px;background:#fff';
    canvas.setAttribute('aria-label', 'PDF page ' + pageNo);

    const c2d = canvas.getContext('2d');
    if (!c2d) throw new Error('pdf: 2d context unavailable');

    wrap.appendChild(canvas);
    await page.render({ canvasContext: c2d, viewport }).promise;
    page.cleanup();
    rendered = Math.max(rendered, pageNo);
  }

  // Render the first batch sequentially (so a parse-but-render failure on
  // page 1 still THROWS and triggers the app fallback).
  const firstBatch = Math.min(FIRST_N, total);
  for (let p = 1; p <= firstBatch; p++) {
    try {
      await renderPage(p);
      firstPaintOk = true;
    } catch (e) {
      if (!firstPaintOk) {
        // Nothing painted at all -> let the app fall back to download/text.
        try { doc.destroy(); } catch (_) {}
        throw new Error('pdf render failed: ' + (e && e.message ? e.message : e));
      }
      // Later pages in the batch failing is non-fatal; show a marker + stop.
      const bad = el('div', 'fv-note', `page ${p} failed to render`);
      wrap.appendChild(bad);
      break;
    }
  }

  // --- "render remaining pages" control (lazy, on demand) ----------------
  if (rendered < total) {
    const more = el('button', null, `render remaining ${total - rendered} page(s) →`);
    more.type = 'button';
    more.style.cssText =
      'align-self:center;margin:2px 0 4px;padding:5px 12px;font-size:11px;cursor:pointer;' +
      'background:var(--surface-inset,#11161c);color:var(--amber,#e2a23b);' +
      'border:1px solid var(--line2,#2a3340);border-radius:5px;letter-spacing:.3px';
    more.addEventListener('click', async () => {
      more.disabled = true;
      const start = rendered + 1;
      more.textContent = 'rendering…';
      for (let p = start; p <= total; p++) {
        try {
          await renderPage(p);
        } catch (e) {
          const bad = el('div', 'fv-note', `page ${p} failed to render`);
          wrap.appendChild(bad);
        }
      }
      more.remove();
    });
    wrap.appendChild(more);
  }

  // Best-effort: free worker/document resources when the view is torn down.
  // (Non-fatal; discovery.js owns the host lifecycle.)
  if (typeof ctx.onCleanup === 'function') {
    try { ctx.onCleanup(() => { try { doc.destroy(); } catch (_) {} }); } catch (_) {}
  }
}
