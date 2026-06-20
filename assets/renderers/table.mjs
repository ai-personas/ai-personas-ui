/* ====================================================================
   PersonaOS deliverable viewer — TABLE / BOM renderer (lazy module)
   --------------------------------------------------------------------
   FAMILY: table — tabular data & bills-of-materials.
     .csv .tsv .bom  +  media_kind: table / bom / csv / tsv

   Parses delimited text robustly with papaparse (MIT, esm.sh, pinned),
   auto-detecting the delimiter, then renders an interactive table that
   is client-side SORTABLE (per-column, asc/desc/none) and FILTERABLE
   (free-text across all columns). When the data looks like a bill of
   materials (qty / refdes / cost-like columns present) a SUMMARY row is
   appended that totals quantity / line cost across the visible rows.

   CONTRACT (see discovery.js): export `meta` + async `render(ctx)`.
   render() paints into ctx.host and THROWS on any failure so the host
   app falls back to its built-in download / plain-text pane. The lib is
   lazy-loaded ONLY inside render() via ctx.lazy(). Domain-agnostic:
   renders whatever delimited bytes arrive, no project assumptions.

   ROBUSTNESS: empty/blank → throw (fallback). Malformed/ragged rows →
   padded to header width, rendered anyway. Very large files are byte-
   capped BEFORE the (synchronous) parse so a multi-MB CSV can't freeze
   the tab, and the rendered DOM is row-capped on top of that — both
   surfaced with a visible "showing N of M / truncated" notice. A real
   parse error throws; a partial parse shows an inline notice but still
   renders the rows it got.

   SECURITY: every cell is inserted with the el(tag,cls,txt) helper
   (textContent — never innerHTML of remote peer content). No eval.
   Styles are injected once via an id-guarded <style> using the
   discovery palette CSS vars (with safe fallbacks) — the host CSS does
   not ship the fv-tbl-* classes this module needs for layout, sticky
   header, numeric alignment and 360px-drawer fit.
   ==================================================================== */

export const meta = {
  exts: ['csv', 'tsv', 'bom'],
  media_kinds: ['table', 'bom', 'csv', 'tsv', 'tab'],
  fetchMode: 'text',
  label: 'Table / BOM',
};

const PAPAPARSE = 'https://esm.sh/papaparse@5.4.1';

// Cap rows actually painted to the DOM so a huge CSV can't lock the UI.
// Filtering/sorting/summary operate over the FULL parsed set; only the
// painted slice is capped (and re-derived whenever the view changes).
const RENDER_CAP = 2000;

// Hard byte ceiling on the text handed to papaparse. The parse is fully
// synchronous, so an unbounded multi-MB file freezes the tab BEFORE the
// row cap can ever apply. We truncate to the last complete line under the
// limit and flag it. 8 MB of delimited text is already ~100k+ rows.
const PARSE_BYTE_CAP = 8 * 1024 * 1024;

// ---- BOM heuristics (domain-agnostic: column-NAME shape, not values) ----
const QTY_RE  = /^(qty|quantity|count|amount|qnt|qte)$/i;
const COST_RE = /(cost|price|total|amount|subtotal|ext(?:ended)?|unit\s*price|line\s*total)/i;
const REF_RE  = /(ref\s*des|refdes|reference|designator|part\s*(no|number|num|#)?|mpn|sku|component)/i;

export async function render(ctx) {
  const { host, el } = ctx;
  injectStyle(host, el);

  // ---- fetch text first (may be a slow gated/peer fetch) ----
  host.textContent = '';
  host.appendChild(loadingNode(el, 'loading table data…'));
  const rawText = (ctx.text != null ? ctx.text : await ctx.fetchText());
  if (rawText == null) throw new Error('table fetch failed');

  // Strip a UTF-8 BOM if present, then bail early on truly empty input so
  // the host fallback (download / plain text) shows instead of a blank pane.
  let text = String(rawText).replace(/^﻿/, '');
  if (!text.trim()) throw new Error('empty table');

  // Byte-cap BEFORE parse (see PARSE_BYTE_CAP). Trim to the last newline so
  // we don't hand papaparse a half-row.
  let truncatedBytes = false;
  if (text.length > PARSE_BYTE_CAP) {
    const cut = text.lastIndexOf('\n', PARSE_BYTE_CAP);
    text = text.slice(0, cut > 0 ? cut : PARSE_BYTE_CAP);
    truncatedBytes = true;
  }
  text = text.trimEnd();
  if (!text.trim()) throw new Error('empty table');

  // ---- lazy-load papaparse (THROWS on CDN failure → host fallback) ----
  host.textContent = '';
  host.appendChild(loadingNode(el, 'loading CSV parser…'));
  const mod = await ctx.lazy(PAPAPARSE);
  const Papa = resolvePapa(mod);
  if (!Papa || typeof Papa.parse !== 'function') throw new Error('papaparse unavailable');

  return renderWith(ctx, Papa, text, truncatedBytes);
}

async function renderWith(ctx, Papa, text, truncatedBytes) {
  const { host, el } = ctx;

  // Force-pick delimiter from extension when known; else let papaparse sniff.
  const ext = String(ctx.ext || extOf(ctx.title) || '').toLowerCase();
  const forced = ext === 'tsv' ? '\t' : (ext === 'csv' ? ',' : '');

  host.textContent = '';
  host.appendChild(loadingNode(el, 'parsing rows…'));

  let out;
  try {
    out = Papa.parse(text, {
      delimiter: forced,                 // '' → auto-detect
      skipEmptyLines: 'greedy',
      dynamicTyping: false,              // keep raw strings; we coerce ourselves
      header: false,
    });
  } catch (e) {
    throw new Error('table parse failed: ' + (e && e.message || e));
  }
  const grid = (out && out.data) || [];
  if (!grid.length) throw new Error('no rows parsed');
  // papaparse reports recoverable issues in out.errors without throwing; we
  // still render what parsed but surface a degraded-render notice below.
  const parseErrors = (out && Array.isArray(out.errors)) ? out.errors : [];

  // Normalise into a header row + body rows of equal width.
  let header = (grid[0] || []).map((c) => (c == null ? '' : String(c)));
  let body = grid.slice(1).map((r) => (r || []).map((c) => (c == null ? '' : String(c))));
  // If a header cell is blank, give it a positional name so sorting works.
  header = header.map((h, i) => (h.trim() ? h : `col ${i + 1}`));
  const cols = header.length;
  if (!cols) throw new Error('no columns parsed');
  body = body.map((r) => {
    const row = r.slice(0, cols);
    while (row.length < cols) row.push('');
    return row;
  });

  // ---- classify columns for BOM detection / numeric sorting ----
  const colMeta = header.map((name, i) => ({
    name,
    index: i,
    isQty: QTY_RE.test(name.trim()),
    isCost: COST_RE.test(name),
    isRef: REF_RE.test(name),
    numeric: columnIsNumeric(body, i),
  }));
  const qtyCol = colMeta.find((c) => c.isQty);
  const costCols = colMeta.filter((c) => c.isCost && c.numeric);
  const looksBom =
    (!!qtyCol || colMeta.some((c) => c.isRef)) && (!!qtyCol || costCols.length > 0);

  // ====================== build the UI shell ======================
  host.textContent = '';
  const wrap = el('div', 'fv-tbl-root');

  // degraded-render notices (input truncated and/or recoverable parse errors)
  if (truncatedBytes || parseErrors.length) {
    const notes = [];
    if (truncatedBytes) notes.push('file truncated to first ~' + Math.round(PARSE_BYTE_CAP / 1048576) + ' MB');
    if (parseErrors.length) notes.push(parseErrors.length + ' parse warning' + (parseErrors.length === 1 ? '' : 's'));
    wrap.appendChild(el('div', 'fv-note', notes.join(' · ')));
  }

  // toolbar: filter box + row counter + (BOM badge)
  const bar = el('div', 'fv-tbl-bar');
  const filter = el('input', 'fv-tbl-filter');
  filter.type = 'search';
  filter.placeholder = 'filter rows…';
  filter.setAttribute('aria-label', 'filter table rows');
  filter.spellcheck = false;
  const counter = el('span', 'fv-tbl-count');
  bar.appendChild(filter);
  bar.appendChild(counter);
  if (looksBom) {
    const badge = el('span', 'fv-tbl-badge', 'BOM');
    badge.title = 'detected bill-of-materials columns';
    bar.appendChild(badge);
  }
  wrap.appendChild(bar);

  // scrollable table region (horizontal scroll keeps wide tables in a 360px drawer)
  const scroll = el('div', 'fv-tablewrap fv-tbl-scroll');
  const tbl = el('table', 'fv-table fv-tbl');
  const thead = el('thead');
  const htr = el('tr');
  thead.appendChild(htr);
  tbl.appendChild(thead);
  const tb = el('tbody');
  tbl.appendChild(tb);
  const tfoot = el('tfoot');
  tbl.appendChild(tfoot);
  scroll.appendChild(tbl);
  wrap.appendChild(scroll);
  host.appendChild(wrap);

  // ---- header cells with sort affordance ----
  // sortState: {col:index, dir:1|-1} or null
  let sortState = null;
  colMeta.forEach((cm) => {
    const th = el('th', cm.numeric ? 'fv-tbl-num' : null);
    const lbl = el('span', 'fv-tbl-th-lbl', cm.name);
    const arrow = el('span', 'fv-tbl-arrow', '');
    th.appendChild(lbl);
    th.appendChild(arrow);
    th.title = `sort by ${cm.name}`;
    th.tabIndex = 0;
    th.setAttribute('role', 'button');
    th.dataset.col = String(cm.index);
    const doSort = () => {
      if (!sortState || sortState.col !== cm.index) sortState = { col: cm.index, dir: 1 };
      else if (sortState.dir === 1) sortState = { col: cm.index, dir: -1 };
      else sortState = null;            // 3rd click clears → original order
      repaint();
    };
    th.addEventListener('click', doSort);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSort(); }
    });
    htr.appendChild(th);
  });

  // ---- derive + paint (filter → sort → cap → rows → summary) ----
  function currentRows() {
    const q = filter.value.trim().toLowerCase();
    let rows = body;
    if (q) {
      rows = rows.filter((r) => r.some((c) => c.toLowerCase().includes(q)));
    }
    if (sortState) {
      const { col, dir } = sortState;
      const num = colMeta[col] && colMeta[col].numeric;
      rows = rows.slice().sort((a, b) => {
        const av = a[col] == null ? '' : a[col];
        const bv = b[col] == null ? '' : b[col];
        if (num) {
          const an = parseNum(av), bn = parseNum(bv);
          const aNaN = Number.isNaN(an), bNaN = Number.isNaN(bn);
          if (aNaN && bNaN) return 0;
          if (aNaN) return 1;            // blanks/non-numeric sink to bottom
          if (bNaN) return -1;
          return (an - bn) * dir;
        }
        return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }
    return rows;
  }

  function repaint() {
    // header arrows
    htr.querySelectorAll('th').forEach((th) => {
      const arr = th.querySelector('.fv-tbl-arrow');
      const idx = Number(th.dataset.col);
      th.classList.toggle('fv-tbl-sorted', !!sortState && sortState.col === idx);
      if (arr) arr.textContent = (sortState && sortState.col === idx)
        ? (sortState.dir === 1 ? '▲' : '▼') : '';
    });

    const rows = currentRows();
    const shown = rows.slice(0, RENDER_CAP);

    // body
    tb.textContent = '';
    const frag = document.createDocumentFragment();
    for (const r of shown) {
      const tr = el('tr');
      for (let i = 0; i < cols; i++) {
        const td = el('td', colMeta[i].numeric ? 'fv-tbl-num' : null, r[i]);
        // Cells clip at max-width with text-overflow:ellipsis and no title, so a
        // long BOM description / MPN / URL is unreadable. Set a native tooltip
        // when the value is long enough to plausibly clip (24-char gate keeps the
        // DOM lean; the browser only shows the tooltip when actually truncated).
        if (r[i] && r[i].length > 24) td.title = r[i];
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    }
    tb.appendChild(frag);

    // summary / totals row for BOM-like data (totals over FILTERED rows)
    tfoot.textContent = '';
    if (looksBom) {
      // Identify summable (qty/cost & numeric) columns FIRST, then place the
      // "Σ N items" label in the first NON-summable column. The old code claimed
      // column 0 unconditionally, so a Qty/cost column at index 0 (common in
      // exported BOMs) never summed and showed the item count instead.
      const sumCols = new Set(
        colMeta.filter((c) => (c.isQty || c.isCost) && c.numeric).map((c) => c.index),
      );
      const labelCol = colMeta.findIndex((c) => !sumCols.has(c.index));
      const firstLabelCol = labelCol < 0 ? 0 : labelCol;
      const tr = el('tr', 'fv-tbl-total');
      for (let i = 0; i < cols; i++) {
        let txt = '';
        const cm = colMeta[i];
        if (sumCols.has(i)) {
          const sum = rows.reduce((acc, r) => {
            const n = parseNum(r[i]);
            return acc + (Number.isNaN(n) ? 0 : n);
          }, 0);
          txt = cm.isCost ? fmtNum(sum) : String(trimFloat(sum));
        } else if (i === firstLabelCol) {
          txt = `Σ ${rows.length} item${rows.length === 1 ? '' : 's'}`;
        }
        const td = el('td', cm.numeric ? 'fv-tbl-num' : null, txt);
        tr.appendChild(td);
      }
      tfoot.appendChild(tr);
    }

    // counter
    const capNote = rows.length > RENDER_CAP ? ` · showing ${RENDER_CAP}` : '';
    const total = body.length;
    counter.textContent = rows.length === total
      ? `${total} row${total === 1 ? '' : 's'}${capNote}`
      : `${rows.length} / ${total} rows${capNote}`;
  }

  // debounced filter; tracked so we can cancel it when the view is torn down.
  let t = null;
  filter.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(repaint, 90);        // light debounce on large sets
  });
  if (typeof ctx.onCleanup === 'function') ctx.onCleanup(() => clearTimeout(t));

  repaint();
}

/* ----------------------------- helpers ----------------------------- */

// papaparse on esm.sh can surface as the namespace, `.default`, or nested
// `.Papa` depending on the build — normalise to the object exposing parse().
function resolvePapa(mod) {
  if (!mod) return null;
  if (typeof mod.parse === 'function') return mod;
  if (mod.default && typeof mod.default.parse === 'function') return mod.default;
  if (mod.Papa && typeof mod.Papa.parse === 'function') return mod.Papa;
  return null;
}

function loadingNode(el, label) {
  const d = el('div', 'fv-loading');
  d.textContent = label || 'loading…';
  return d;
}

function extOf(name) {
  const m = /\.([A-Za-z0-9_]+)$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

// Parse a numeric value tolerant of $ £ € , % and surrounding whitespace.
// Returns NaN when there's no parseable number.
function parseNum(v) {
  if (v == null) return NaN;
  const s = String(v).trim();
  if (!s) return NaN;
  // strip currency symbols, thousands separators, trailing %, and spaces
  const cleaned = s.replace(/[,\s]/g, '').replace(/^[^\d.+-]*/, '').replace(/%$/, '');
  if (cleaned === '' || cleaned === '.' || cleaned === '-' || cleaned === '+') return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// A column is "numeric" when a clear majority of its non-blank cells parse
// as numbers (lets one stray label coexist with a numeric column).
function columnIsNumeric(rows, i) {
  let total = 0, num = 0;
  for (const r of rows) {
    const v = r[i];
    if (v == null || String(v).trim() === '') continue;
    total++;
    if (!Number.isNaN(parseNum(v))) num++;
    if (total >= 64) break;             // sample is enough for classification
  }
  return total > 0 && num / total >= 0.7;
}

// Money-ish formatting: 2 decimals, grouped thousands, no currency symbol.
function fmtNum(n) {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Drop trailing .0 noise from integer-valued floats.
function trimFloat(n) {
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? n : Math.round(n * 1e6) / 1e6;
}

/* ===========================================================================
   STYLE  (id-guarded; uses the discovery palette vars with safe fallbacks).
   The host stylesheet ships .fv-table / .fv-tablewrap / .fv-loading / .fv-note
   but NOT the fv-tbl-* classes this module needs for the toolbar layout,
   sticky header sitting flush under the scroll viewport, numeric alignment,
   the totals row, and fitting a 360px-wide drawer (horizontal scroll, no
   fixed huge widths). Injected once per document/shadow-root.
   =========================================================================== */
const STYLE_ID = 'fv-tbl-style';
const CSS = `
.fv-tbl-root{display:flex;flex-direction:column;max-width:100%;min-width:0;
  font-family:var(--sans,'Inter var','Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif)}
/* toolbar: reuse the promoted .fv-bar idiom — flush descriptor strip, no card */
.fv-tbl-bar{display:flex;align-items:center;gap:var(--space-2,8px);flex-wrap:wrap;
  margin:0 0 var(--space-2,8px)}
.fv-tbl-filter{flex:1 1 140px;min-width:0;height:var(--ctl-h,30px);
  font:var(--w-reg,400) var(--fs-body,12px)/1.4 inherit;
  background:var(--surface-inset,#070b10);color:var(--ink,#cdd9e5);
  border:1px solid var(--line2,#233040);border-radius:var(--radius-md,6px);
  padding:0 var(--ctl-pad-x,10px);
  transition:border-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    box-shadow var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    background-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.fv-tbl-filter::placeholder{color:var(--mut,#7d8ea2);opacity:1}
.fv-tbl-filter::-webkit-search-cancel-button{filter:grayscale(1);opacity:.5;cursor:pointer}
.fv-tbl-filter:hover{border-color:var(--line2,#233040)}
.fv-tbl-filter:focus{outline:none;border-color:var(--accent,#4c9ff0);
  background:var(--surface-raised,#0b121b);
  box-shadow:0 0 0 3px var(--focus-ring,rgba(76,159,240,.20))}
.fv-tbl-count{font:var(--w-semi,600) var(--fs-meta,10px)/1 var(--sans,ui-sans-serif,system-ui,sans-serif);
  letter-spacing:var(--tr-caps,.06em);text-transform:uppercase;
  color:var(--mut,#7d8ea2);white-space:nowrap;font-variant-numeric:tabular-nums}
/* BOM detection badge: soft tinted pill (Linear/Vercel idiom), not a loud fill */
.fv-tbl-badge{display:inline-flex;align-items:center;height:var(--chip-h,18px);
  padding:0 var(--chip-px,7px);
  font:var(--w-semi,600) var(--fs-meta,10px)/1 var(--sans,ui-sans-serif,system-ui,sans-serif);
  letter-spacing:var(--tr-caps,.06em);text-transform:uppercase;
  color:var(--amber,#f0a73a);
  background:var(--amber-weak,rgba(240,167,58,.07));
  border:1px solid var(--amber-border,rgba(240,167,58,.34));
  border-radius:var(--chip-radius,5px);white-space:nowrap}
/* scroll viewport: vertical cap + horizontal scroll so wide/tall tables
   stay inside the drawer instead of stretching it. Frame matches .fv-tablewrap. */
.fv-tbl-scroll{max-width:100%;overflow:auto;-webkit-overflow-scrolling:touch}
.fv-tbl{border-collapse:collapse;font-size:var(--fs-body,12px);width:100%;
  font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);
  font-variant-numeric:tabular-nums}
.fv-tbl th{position:sticky;top:0;z-index:1;background:var(--surface-well2,#0b1118);
  color:var(--mut,#7d8ea2);text-align:left;padding:var(--space-1,4px) var(--space-2,8px);
  white-space:nowrap;
  font:var(--w-semi,600) var(--fs-label,11px)/1 var(--sans,ui-sans-serif,system-ui,sans-serif);
  letter-spacing:var(--tr-caps,.06em);text-transform:uppercase;
  border-bottom:1px solid var(--line2,#233040);cursor:pointer;user-select:none;
  box-shadow:0 2px 0 -1px var(--line2,#233040),0 6px 8px -6px rgba(0,0,0,.5);
  transition:color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),
    background-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.fv-tbl th:hover{color:var(--ink,#cdd9e5);background:var(--surface-hover,#0e1722)}
.fv-tbl th:focus-visible{outline:none;color:var(--ink,#cdd9e5);
  box-shadow:inset 0 0 0 1px var(--accent,#4c9ff0)}
.fv-tbl th.fv-tbl-sorted{color:var(--accent,#4c9ff0)}
/* reserve constant glyph space so the empty (unsorted) state doesn't collapse
   and nudge the header label on every sort toggle */
.fv-tbl-arrow{display:inline-block;width:.85em;margin-left:var(--space-0,2px);
  text-align:center;color:var(--accent,#4c9ff0);font-size:var(--fs-meta,10px)}
.fv-tbl td{padding:var(--space-1,4px) var(--space-2,8px);
  border-bottom:1px solid var(--line,#1c2733);
  color:var(--ink,#cdd9e5);white-space:nowrap;max-width:42ch;
  overflow:hidden;text-overflow:ellipsis}
.fv-tbl tbody tr{transition:background-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.fv-tbl tbody tr:hover td{background:var(--surface-hover,#0e1722)}
.fv-tbl .fv-tbl-num{text-align:right;font-variant-numeric:tabular-nums}
.fv-tbl tfoot .fv-tbl-total td{position:sticky;bottom:0;
  background:var(--surface-well2,#0b1118);color:var(--off-white,#eaf1f8);
  font-weight:var(--w-semi,600);
  border-top:1px solid var(--line2,#233040);
  box-shadow:0 -2px 0 -1px var(--line2,#233040),0 -6px 8px -6px rgba(0,0,0,.5)}
@media (max-width:639px){
  .fv-tbl td{max-width:22ch}
  .fv-tbl th,.fv-tbl td{padding:var(--space-1,4px) var(--space-1,4px)}
}
`;

function injectStyle(host, el) {
  const doc = (host && host.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;
  const rootNode = host.getRootNode ? host.getRootNode() : doc;
  const scope = rootNode && rootNode.nodeType === 11 ? rootNode : (doc.head || doc.documentElement);
  if (!scope || (scope.querySelector && scope.querySelector('#' + STYLE_ID))) return;
  const style = (typeof el === 'function') ? el('style', null) : doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  scope.appendChild(style);
}
