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

   SECURITY: every cell is inserted with the el(tag,cls,txt) helper
   (textContent — never innerHTML of remote peer content). No eval.
   ==================================================================== */

export const meta = {
  exts: ['csv', 'tsv', 'bom'],
  media_kinds: ['table', 'bom', 'csv', 'tsv', 'tab'],
  fetchMode: 'text',
  label: 'Table / BOM',
};

const PAPAPARSE = 'https://esm.sh/papaparse@5.4.1';

// Cap rows actually rendered to the DOM so a huge CSV can't lock the UI.
// Filtering/sorting/summary operate over the FULL parsed set; only the
// painted slice is capped (and re-derived whenever the view changes).
const RENDER_CAP = 2000;

// ---- BOM heuristics (domain-agnostic: column-NAME shape, not values) ----
const QTY_RE  = /^(qty|quantity|count|amount|qnt|qte)$/i;
const COST_RE = /(cost|price|total|amount|subtotal|ext(?:ended)?|unit\s*price|line\s*total)/i;
const REF_RE  = /(ref\s*des|refdes|reference|designator|part\s*(no|number|num|#)?|mpn|sku|component)/i;

export async function render(ctx) {
  const { host, el, esc } = ctx;
  host.appendChild(loadingNode(el, 'loading table parser…'));

  // ---- lazy-load papaparse (THROWS on CDN failure → host fallback) ----
  const mod = await ctx.lazy(PAPAPARSE);
  const Papa = (mod && (mod.default || mod.parse ? mod : mod.Papa)) || mod;
  if (!Papa || typeof Papa.parse !== 'function') {
    const P = Papa && Papa.default ? Papa.default : Papa;
    if (!P || typeof P.parse !== 'function') throw new Error('papaparse unavailable');
    return renderWith(ctx, P);
  }
  return renderWith(ctx, Papa);
}

async function renderWith(ctx, Papa) {
  const { host, el, esc } = ctx;

  const text = (ctx.text != null ? ctx.text : await ctx.fetchText());
  if (text == null) throw new Error('table fetch failed');
  const trimmed = String(text).replace(/^﻿/, '').trimEnd();
  if (!trimmed.trim()) throw new Error('empty table');

  // Force-pick delimiter from extension when known; else let papaparse sniff.
  const ext = String(ctx.ext || extOf(ctx.title) || '').toLowerCase();
  const forced = ext === 'tsv' ? '\t' : (ext === 'csv' ? ',' : '');

  const out = Papa.parse(trimmed, {
    delimiter: forced,                 // '' → auto-detect
    skipEmptyLines: 'greedy',
    dynamicTyping: false,              // keep raw strings; we coerce ourselves
    header: false,
  });
  const grid = (out && out.data) || [];
  if (!grid.length) throw new Error('no rows parsed');

  // Normalise into a header row + body rows of equal width.
  let header = (grid[0] || []).map((c) => (c == null ? '' : String(c)));
  let body = grid.slice(1).map((r) => (r || []).map((c) => (c == null ? '' : String(c))));
  // If a header cell is blank, give it a positional name so sorting works.
  header = header.map((h, i) => (h.trim() ? h : `col ${i + 1}`));
  const cols = header.length;
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
  host.innerHTML = '';
  const wrap = el('div', 'fv-tbl-root');

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

  // scrollable table region
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
        ? (sortState.dir === 1 ? ' ▲' : ' ▼') : '';
    });

    const rows = currentRows();
    const shown = rows.slice(0, RENDER_CAP);

    // body
    tb.textContent = '';
    const frag = document.createDocumentFragment();
    for (const r of shown) {
      const tr = el('tr');
      for (let i = 0; i < cols; i++) {
        tr.appendChild(el('td', colMeta[i].numeric ? 'fv-tbl-num' : null, r[i]));
      }
      frag.appendChild(tr);
    }
    tb.appendChild(frag);

    // summary / totals row for BOM-like data (totals over FILTERED rows)
    tfoot.textContent = '';
    if (looksBom) {
      const tr = el('tr', 'fv-tbl-total');
      for (let i = 0; i < cols; i++) {
        let txt = '';
        const cm = colMeta[i];
        if (i === 0) txt = `Σ ${rows.length} item${rows.length === 1 ? '' : 's'}`;
        else if ((cm.isQty || cm.isCost) && cm.numeric) {
          const sum = rows.reduce((acc, r) => {
            const n = parseNum(r[i]);
            return acc + (Number.isNaN(n) ? 0 : n);
          }, 0);
          txt = cm.isCost ? fmtNum(sum) : String(trimFloat(sum));
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

  let t = null;
  filter.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(repaint, 90);        // light debounce on large sets
  });

  repaint();
}

/* ----------------------------- helpers ----------------------------- */

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
