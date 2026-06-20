/* ====================================================================
   PersonaOS deliverable viewer — KiCad renderer
   --------------------------------------------------------------------
   FAMILY: kicad — KiCad PCB / schematic / project / footprint files
     .kicad_pcb  .kicad_sch  .kicad_pro  .kicad_mod
   --------------------------------------------------------------------
   LIB DECISION: viable = false (no lazy 3rd-party lib).
   The best in-browser KiCad renderer is KiCanvas (MIT, theacodes/
   kicanvas). It is, however, NOT publishable through this contract:
     - not on npm (package version is 0.0.0, registry 404),
     - not served by esm.sh (404), no GitHub releases / tags,
       no jsdelivr-pinnable version,
     - distributed only as an UNVERSIONED single-host bundle
       (https://kicanvas.org/kicanvas/kicanvas.js).
   The contract requires `ctx.lazy('https://esm.sh/<pkg>@<ver>')` with a
   PINNED version — KiCanvas cannot satisfy that (nothing to pin, esm.sh
   cannot serve it). Loading an unpinned single-origin bundle would
   violate the version-pin rule and be fragile / unverifiable.
   => Per contract: viable=false, but ship a graceful ENHANCED renderer.

   WHAT THIS RENDERER DOES (no 3rd-party lib, fully self-contained):
   KiCad files are S-expression text (.kicad_pcb/.kicad_sch/.kicad_mod)
   or JSON (.kicad_pro). We parse them in-browser and present:
     - a summary header (file kind, generator, version, title block),
     - structured tables (layers, nets, components/symbols/pads, …)
       extracted domain-agnostically from the parsed tree,
     - the raw source with lightweight S-expression / JSON syntax
       highlighting, behind a toggle.
   Everything is built with createElement + textContent (never innerHTML
   of remote content). FAIL-SOFT: risky work is wrapped and re-THROWN so
   discovery.js shows its own download / plain-text fallback.
   ==================================================================== */

export const meta = {
  exts: ['kicad_pcb', 'kicad_sch', 'kicad_pro', 'kicad_mod'],
  media_kinds: ['kicad', 'pcb', 'schematic', 'eda', 'cad'],
  fetchMode: 'text',
  label: 'KiCad EDA',
};

/* ---------------------------------------------------------------- */
/* S-expression parser. KiCad uses a strict Lisp-like grammar:      */
/*   atom | "quoted string" | ( token child child ... )             */
/* Quoted strings use backslash escapes. Returns nested arrays where */
/* the first element of a list is its token (a string).             */
/*                                                                  */
/* This is an EXPLICIT-STACK parser (not recursive): KiCad PCBs can  */
/* nest hundreds of levels deep, which would blow the JS call stack  */
/* with a recursive descent. We also cap total node count so a       */
/* pathological / adversarial peer file can't pin the tab forever;   */
/* on cap we stop early and flag `truncated` rather than hang.       */
/* ---------------------------------------------------------------- */
const MAX_NODES = 4000000; // ceiling on parsed list+atom nodes (~tens of MB of EDA text)

function parseSexpr(src) {
  let i = 0;
  const n = src.length;
  let nodes = 0;
  let truncated = false;
  function skipWs() {
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
      break;
    }
  }
  function readString() {
    // assumes src[i] === '"'
    i++; // opening quote
    let out = '';
    while (i < n) {
      const c = src[i++];
      if (c === '\\') {
        const e = src[i++];
        if (e === 'n') out += '\n';
        else if (e === 't') out += '\t';
        else if (e === 'r') out += '\r';
        else out += e; // covers \" \\ and any other escaped char
      } else if (c === '"') {
        return out;
      } else {
        out += c;
      }
    }
    return out; // unterminated — tolerate
  }
  function readAtom() {
    const start = i;
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '(' || c === ')' || c === '"') break;
      i++;
    }
    return src.slice(start, i);
  }

  skipWs();
  if (src[i] !== '(') throw new Error('not an S-expression (no opening paren)');

  // Iterative read of the root list and all descendants via an explicit stack.
  i++; // consume root '('
  const root = [];
  const stack = [root];
  while (i < n) {
    if (nodes >= MAX_NODES) { truncated = true; break; }
    skipWs();
    const c = src[i];
    if (c === undefined) break; // unterminated — tolerate
    const cur = stack[stack.length - 1];
    if (c === ')') { i++; stack.pop(); if (stack.length === 0) break; continue; }
    if (c === '(') {
      i++; // consume '('
      const child = [];
      cur.push(child);
      stack.push(child);
      nodes++;
    } else if (c === '"') {
      cur.push(readString()); nodes++;
    } else {
      cur.push(readAtom()); nodes++;
    }
  }
  root._truncated = truncated;
  return root;
}

// token name of a list node (first element if it's a plain string)
function tok(node) {
  return (Array.isArray(node) && typeof node[0] === 'string') ? node[0] : null;
}
// direct children that are lists with the given token
function childrenByTok(node, name) {
  if (!Array.isArray(node)) return [];
  const out = [];
  for (const c of node) if (Array.isArray(c) && c[0] === name) out.push(c);
  return out;
}
function firstChild(node, name) {
  const c = childrenByTok(node, name);
  return c.length ? c[0] : null;
}
// the "value" of a (token value) leaf-ish list: its 2nd element as string
function leafVal(node, name) {
  const c = firstChild(node, name);
  if (!c) return null;
  return c[1] != null ? String(c[1]) : '';
}
// deep count of all list nodes carrying token `name`. Iterative (explicit
// stack) so a deeply-nested but legitimate file can't overflow the call stack.
function deepCount(node, name) {
  if (!Array.isArray(node)) return 0;
  let count = 0;
  const stack = [node];
  while (stack.length) {
    const x = stack.pop();
    if (x[0] === name) count++;
    for (let k = x.length - 1; k >= 0; k--) if (Array.isArray(x[k])) stack.push(x[k]);
  }
  return count;
}

// Board bounding box from the Edge.Cuts outline (mm). KiCad draws the board
// boundary as gr_line/gr_rect/gr_arc/gr_poly (and footprint fp_* equivalents)
// on layer "Edge.Cuts"; we accumulate the extent of every (start/end/center/xy)
// point belonging to such graphics. Iterative walk (no recursion). Returns
// {w,h,minX,minY,maxX,maxY} in mm, or null if no outline geometry is found.
const EDGE_GFX = new Set(['gr_line', 'gr_rect', 'gr_arc', 'gr_poly', 'gr_circle',
  'fp_line', 'fp_rect', 'fp_arc', 'fp_poly', 'fp_circle']);
function boardBBox(root) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const num = (v) => { const f = parseFloat(v); return Number.isFinite(f) ? f : null; };
  const acc = (x, y) => {
    if (x == null || y == null) return;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  // collect coordinate pairs from a graphic node's direct point-bearing children
  const pointsOf = (g) => {
    for (const c of g) {
      if (!Array.isArray(c)) continue;
      const t = c[0];
      if (t === 'start' || t === 'end' || t === 'center' || t === 'mid' || t === 'xy') {
        acc(num(c[1]), num(c[2]));
      } else if (t === 'pts') {
        for (const p of c) if (Array.isArray(p) && p[0] === 'xy') acc(num(p[1]), num(p[2]));
      }
    }
  };
  // iterative DFS so a deep tree never recurses
  const stack = [root];
  while (stack.length) {
    const x = stack.pop();
    if (!Array.isArray(x)) continue;
    if (EDGE_GFX.has(x[0])) {
      // only count graphics actually on the Edge.Cuts layer
      const layer = leafVal(x, 'layer');
      if (layer === 'Edge.Cuts') pointsOf(x);
    }
    for (let k = x.length - 1; k >= 0; k--) if (Array.isArray(x[k])) stack.push(x[k]);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
const fmtMM = (v) => (Math.round(v * 1000) / 1000).toString();

/* ---------------------------------------------------------------- */
/* DOM helpers built on ctx.el (safe textContent only).             */
/* ---------------------------------------------------------------- */
function makeTable(ctx, headers, rows) {
  const tbl = ctx.el('table', 'kic-table');
  const thead = ctx.el('thead');
  const htr = ctx.el('tr');
  for (const h of headers) htr.appendChild(ctx.el('th', null, h));
  thead.appendChild(htr); tbl.appendChild(thead);
  const tbody = ctx.el('tbody');
  for (const r of rows) {
    const tr = ctx.el('tr');
    for (const cell of r) tr.appendChild(ctx.el('td', null, cell == null ? '' : String(cell)));
    tbody.appendChild(tr);
  }
  tbl.appendChild(tbody);
  return tbl;
}
function section(ctx, titleText) {
  const wrap = ctx.el('section', 'kic-section');
  if (titleText) wrap.appendChild(ctx.el('h4', 'kic-h', titleText));
  return wrap;
}

/* Sortable + text-filterable table. Pure client-side over already-capped rows
   (<= MAX_ROWS), so this stays cheap and can't be made to hang by a big file.
   Click a header to sort (toggles asc/desc; numeric columns sort numerically);
   type in the filter box to keep only rows containing the term (any column). */
function makeRichTable(ctx, headers, rows) {
  const wrap = ctx.el('div');
  let filterInput = null;
  if (rows.length > 8) {
    filterInput = ctx.el('input', 'kic-filter');
    filterInput.setAttribute('type', 'search');
    filterInput.setAttribute('placeholder', 'filter ' + rows.length + ' rows…');
    filterInput.setAttribute('aria-label', 'filter table');
    wrap.appendChild(filterInput);
  }
  const tblWrap = ctx.el('div', 'kic-tablewrap');
  const tbl = ctx.el('table', 'kic-table');
  const thead = ctx.el('thead');
  const htr = ctx.el('tr');
  const ths = [];
  headers.forEach((h, ci) => {
    const th = ctx.el('th', 'kic-sortable', String(h));
    th.setAttribute('role', 'button');
    th.setAttribute('tabindex', '0');
    ths.push(th);
    const onSort = () => sortBy(ci, th);
    th.addEventListener('click', onSort);
    th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(); } });
    htr.appendChild(th);
  });
  thead.appendChild(htr); tbl.appendChild(thead);
  const tbody = ctx.el('tbody');
  tbl.appendChild(tbody);
  tblWrap.appendChild(tbl);
  wrap.appendChild(tblWrap);

  const status = ctx.el('div', 'kic-more');
  wrap.appendChild(status);

  // working copy of rows as strings
  const all = rows.map(r => r.map(c => (c == null ? '' : String(c))));
  let view = all;
  let sortCol = -1, sortDir = 1;

  const numericCol = (ci) => all.length > 0 && all.every(r => r[ci] === '' || /^-?\d+(\.\d+)?$/.test(r[ci].trim()));

  function paint() {
    tbody.replaceChildren();
    for (const r of view) {
      const tr = ctx.el('tr');
      for (const cell of r) tr.appendChild(ctx.el('td', null, cell));
      tbody.appendChild(tr);
    }
    if (view.length !== all.length) status.textContent = 'showing ' + view.length + ' of ' + all.length + ' rows';
    else status.textContent = '';
  }
  function applyFilter() {
    const q = filterInput ? filterInput.value.trim().toLowerCase() : '';
    let base = q ? all.filter(r => r.some(c => c.toLowerCase().includes(q))) : all.slice();
    if (sortCol >= 0) {
      const numeric = numericCol(sortCol);
      base.sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol];
        let cmp;
        if (numeric) cmp = (parseFloat(av) || 0) - (parseFloat(bv) || 0);
        else cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
        return cmp * sortDir;
      });
    }
    view = base;
    paint();
  }
  function sortBy(ci, th) {
    if (sortCol === ci) sortDir = -sortDir; else { sortCol = ci; sortDir = 1; }
    ths.forEach(x => { x.removeAttribute('data-sort'); });
    th.setAttribute('data-sort', sortDir > 0 ? 'asc' : 'desc');
    applyFilter();
  }
  if (filterInput) filterInput.addEventListener('input', applyFilter);
  paint();
  return wrap;
}
function kvGrid(ctx, pairs) {
  const dl = ctx.el('div', 'kic-kv');
  for (const [k, v] of pairs) {
    if (v == null || v === '') continue;
    dl.appendChild(ctx.el('span', 'kic-k', k));
    dl.appendChild(ctx.el('span', 'kic-v', String(v)));
  }
  return dl;
}

/* ---------------------------------------------------------------- */
/* Self-contained syntax highlight (no lib). Tokenises with a single */
/* regex and appends spans (textContent only — never innerHTML of    */
/* remote bytes). Works for both S-expr and JSON sources.            */
/* ---------------------------------------------------------------- */
function highlightInto(ctx, pre, source) {
  // groups: string | comment | number | symbol-after-paren (token) | paren | keyword
  const re = /("(?:[^"\\]|\\.)*"?)|(#.*?$)|(-?\d+\.?\d*(?:e[+-]?\d+)?)|([()])|\b(true|false|null|yes|no)\b/gim;
  let last = 0; let m;
  const push = (txt, cls) => {
    if (!txt) return;
    pre.appendChild(ctx.el('span', cls || null, txt));
  };
  while ((m = re.exec(source)) !== null) {
    if (m.index > last) push(source.slice(last, m.index), null);
    if (m[1] != null) push(m[1], 'kic-tk-str');
    else if (m[2] != null) push(m[2], 'kic-tk-com');
    else if (m[3] != null) push(m[3], 'kic-tk-num');
    else if (m[4] != null) push(m[4], 'kic-tk-paren');
    else if (m[5] != null) push(m[5], 'kic-tk-kw');
    last = re.lastIndex;
    if (m.index === re.lastIndex) re.lastIndex++; // guard zero-width
  }
  if (last < source.length) push(source.slice(last), null);
}

/* ---------------------------------------------------------------- */
/* Inject scoped CSS once per document.                             */
/* ---------------------------------------------------------------- */
const STYLE_ID = 'kic-renderer-style';
function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  // All colors/spacing/radius/typography flow from the shared design tokens.
  // Each value is var(--token,<fallback>) where the fallback EQUALS the live
  // (post-migration) token value, so this renderer reads as one product with
  // the dashboard whether or not the CSS migration has landed yet.
  //   --sans = chrome/prose/labels  ·  --mono = data/code/IDs/tables
  //   syntax map matches .fv-code: string=--up · number=--amber · keyword=--purple
  s.textContent = `
.kic-root{font:13px/1.55 var(--sans,'Inter var','Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);color:var(--ink,#cdd9e5);font-variant-numeric:tabular-nums}
.kic-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 12px}
.kic-badge{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:var(--chip-radius,5px);font:600 11px/1 var(--sans,ui-sans-serif,system-ui,sans-serif);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;color:var(--int,#4c9ff0);background:color-mix(in srgb,var(--int,#4c9ff0) 12%,transparent);border:1px solid color-mix(in srgb,var(--int,#4c9ff0) 34%,transparent)}
.kic-sub{color:var(--mut,#7d8ea2);font-size:12px;overflow-wrap:anywhere}
.kic-note{margin:8px 0 12px;padding:8px 10px;border-left:2px solid var(--amber,#f0a73a);background:var(--amber-weak,rgba(240,167,58,.07));color:var(--dim,#90a0b2);font-size:12px;line-height:1.5;border-radius:0 6px 6px 0}
.kic-note.kic-info{border-left-color:var(--line2,#233040);background:var(--surface-inset,#070b10);color:var(--mut,#7d8ea2)}
.kic-section{margin:16px 0}
.kic-h{display:flex;align-items:center;margin:0 0 8px;font:600 11px/1 var(--sans,ui-sans-serif,system-ui,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:var(--mut,#7d8ea2)}
.kic-h::before{content:'';width:3px;height:11px;margin-right:7px;border-radius:2px;background:var(--amber,#f0a73a);flex:0 0 auto}
.kic-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:12px;max-width:46em}
.kic-k{color:var(--mut,#7d8ea2);white-space:nowrap}
.kic-v{color:var(--ink,#cdd9e5);word-break:break-word;font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-variant-numeric:tabular-nums slashed-zero}
.kic-stats{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 12px}
.kic-stat{display:inline-flex;align-items:baseline;gap:5px;padding:5px 10px;border-radius:6px;background:var(--surface-raised,#0b121b);border:1px solid var(--line,#1c2733);font-size:11px;color:var(--dim,#90a0b2);letter-spacing:.02em}
.kic-stat b{font:700 14px/1 var(--mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);color:var(--off-white,#eaf1f8);font-variant-numeric:tabular-nums}
.kic-table{border-collapse:collapse;width:100%;font:11px/1.5 var(--mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-variant-numeric:tabular-nums;margin:0}
.kic-table th{position:sticky;top:0;z-index:1;background:var(--surface-well2,#0b1118);color:var(--mut,#7d8ea2);text-align:left;padding:5px 9px;border-bottom:1px solid var(--line2,#233040);font:600 11px/1 var(--sans,ui-sans-serif,system-ui,sans-serif);letter-spacing:.04em;white-space:nowrap;vertical-align:top}
.kic-table td{padding:4px 9px;border-bottom:1px solid var(--line,#1c2733);color:var(--ink,#cdd9e5);text-align:left;vertical-align:top}
.kic-table tbody tr:hover{background:var(--surface-hover,#0e1722)}
.kic-tablewrap{max-height:min(440px,68vh);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;border:1px solid var(--line2,#233040);border-radius:6px;background:var(--surface-inset,#070b10)}
.kic-sortable{cursor:pointer;user-select:none}
.kic-sortable:hover{color:var(--int,#4c9ff0)}
.kic-sortable::after{content:'';opacity:.5;font-size:8px;margin-left:5px;color:var(--amber,#f0a73a)}
.kic-sortable[data-sort=asc]::after{content:'▲';opacity:1}
.kic-sortable[data-sort=desc]::after{content:'▼';opacity:1}
.kic-filter{display:block;width:100%;max-width:20em;box-sizing:border-box;margin:0 0 8px;padding:5px 9px;font:11px var(--mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);border:1px solid var(--line2,#233040);border-radius:6px;background:var(--surface-inset,#070b10);color:var(--ink,#cdd9e5)}
.kic-filter::placeholder{color:var(--mut,#7d8ea2);opacity:1}
.kic-filter:hover{border-color:var(--line2,#233040)}
.kic-filter:focus{outline:none;border-color:var(--accent,#4c9ff0);box-shadow:0 0 0 3px var(--focus-ring,rgba(76,159,240,.20))}
.kic-loading{padding:10px 2px}
.kic-more{color:var(--mut,#7d8ea2);font-size:10px;margin:6px 0;letter-spacing:.02em}
.kic-toggle{display:inline-flex;align-items:center;gap:6px;margin:12px 0 4px;min-height:30px;padding:0 10px;cursor:pointer;font:600 12px var(--sans,ui-sans-serif,system-ui,sans-serif);color:var(--dim,#90a0b2);background:var(--surface-raised,#0b121b);border:1px solid var(--line2,#233040);border-radius:6px;transition:border-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),background var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.kic-toggle:hover{border-color:var(--accent,#4c9ff0);background:var(--surface-hover,#0e1722);color:var(--ink,#cdd9e5)}
.kic-toggle:active{transform:var(--press,translateY(.5px))}
.kic-toggle:focus-visible{outline:none;border-color:var(--accent,#4c9ff0);box-shadow:0 0 0 3px var(--focus-ring,rgba(76,159,240,.20))}
.kic-src{margin:4px 0 0;padding:10px 12px;background:var(--surface-inset,#070b10);border:1px solid var(--line2,#233040);border-radius:6px;overflow:auto;max-height:min(480px,72vh);overscroll-behavior:contain;font:12px/1.55 var(--mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);white-space:pre;tab-size:2;color:var(--ink,#cdd9e5)}
.kic-tk-str{color:var(--up,#21d07a)}
.kic-tk-num{color:var(--amber,#f0a73a)}
.kic-tk-com{color:var(--mut,#7d8ea2);font-style:italic}
.kic-tk-paren{color:var(--mut,#7d8ea2)}
.kic-tk-kw{color:var(--purple,#a081e0);font-weight:600}
`;
  document.head.appendChild(s);
}

/* ---------------------------------------------------------------- */
/* Per-file-kind structured extraction (domain-agnostic).           */
/* ---------------------------------------------------------------- */
const MAX_ROWS = 400; // hard cap on any single rendered table

function titleBlockPairs(root) {
  const tb = firstChild(root, 'title_block');
  if (!tb) return [];
  const pairs = [];
  for (const key of ['title', 'date', 'rev', 'company']) {
    const v = leafVal(tb, key);
    if (v) pairs.push([key[0].toUpperCase() + key.slice(1), v]);
  }
  for (const c of childrenByTok(tb, 'comment')) {
    if (c[2]) pairs.push(['Comment ' + c[1], String(c[2])]);
  }
  return pairs;
}

function renderPcb(ctx, root, frag) {
  const stats = ctx.el('div', 'kic-stats');
  const layers = firstChild(root, 'layers');
  const layerRows = layers ? layers.slice(1).filter(Array.isArray) : [];
  const nets = childrenByTok(root, 'net');
  const footprints = childrenByTok(root, 'footprint');
  const tracks = deepCount(root, 'segment');
  const vias = deepCount(root, 'via');
  const zones = deepCount(root, 'zone');
  const stat = (label, val) => {
    const d = ctx.el('div', 'kic-stat');
    d.appendChild(ctx.el('b', null, String(val)));
    d.appendChild(document.createTextNode(' ' + label));
    return d;
  };
  // net 0 is the unconnected/no-net entry; named nets are the meaningful count.
  const namedNetCount = nets.filter(nn => nn[2] && nn[2] !== '').length;
  const bbox = boardBBox(root);
  stats.appendChild(stat('layers', layerRows.length));
  stats.appendChild(stat('nets', namedNetCount));
  stats.appendChild(stat('footprints', footprints.length));
  stats.appendChild(stat('tracks', tracks));
  stats.appendChild(stat('vias', vias));
  stats.appendChild(stat('zones', zones));
  frag.appendChild(stats);

  const tb = titleBlockPairs(root);
  const thickness = (() => { const g = firstChild(root, 'general'); return g ? leafVal(g, 'thickness') : null; })();
  const meta = [['Paper', leafVal(root, 'paper')], ...tb];
  if (bbox && bbox.w > 0 && bbox.h > 0) {
    meta.push(['Board size', fmtMM(bbox.w) + ' × ' + fmtMM(bbox.h) + ' mm (from Edge.Cuts)']);
  }
  if (thickness) meta.push(['Board thickness', thickness + ' mm']);
  if (meta.some(p => p[1])) {
    const s = section(ctx, 'Board');
    s.appendChild(kvGrid(ctx, meta));
    frag.appendChild(s);
  }

  if (layerRows.length) {
    const s = section(ctx, 'Layers (' + layerRows.length + ')');
    const rows = layerRows.slice(0, MAX_ROWS).map(l => [l[1], l[2] || '', l[3] || '']);
    const w = ctx.el('div', 'kic-tablewrap');
    w.appendChild(makeTable(ctx, ['Name', 'Type', 'Description'], rows));
    s.appendChild(w);
    frag.appendChild(s);
  }

  if (footprints.length) {
    const s = section(ctx, 'Footprints (' + footprints.length + ')');
    const rows = [];
    for (const fp of footprints.slice(0, MAX_ROWS)) {
      const ref = (fp.find(x => Array.isArray(x) && x[0] === 'property' && x[1] === 'Reference') || [])[2]
        || leafVal(fp, 'fp_text') || '';
      const val = (fp.find(x => Array.isArray(x) && x[0] === 'property' && x[1] === 'Value') || [])[2] || '';
      const lib = (typeof fp[1] === 'string') ? fp[1] : '';
      const layer = leafVal(fp, 'layer') || '';
      const pads = deepCount(fp, 'pad');
      rows.push([ref, val, lib, layer, pads]);
    }
    s.appendChild(makeRichTable(ctx, ['Ref', 'Value', 'Library / Footprint', 'Layer', 'Pads'], rows));
    if (footprints.length > MAX_ROWS) s.appendChild(ctx.el('div', 'kic-more', '… ' + (footprints.length - MAX_ROWS) + ' more not shown'));
    frag.appendChild(s);
  }

  const namedNets = nets.filter(nn => nn[2] && nn[2] !== '');
  if (namedNets.length) {
    const s = section(ctx, 'Nets (' + namedNets.length + ')');
    const rows = namedNets.slice(0, MAX_ROWS).map(nn => [nn[1], nn[2]]);
    s.appendChild(makeRichTable(ctx, ['#', 'Net name'], rows));
    if (namedNets.length > MAX_ROWS) s.appendChild(ctx.el('div', 'kic-more', '… ' + (namedNets.length - MAX_ROWS) + ' more not shown'));
    frag.appendChild(s);
  }
}

function renderSch(ctx, root, frag) {
  // Top-level placed symbols carry (lib_id ...) + properties; lib_symbols are
  // the definitions. Count both; table the placed instances.
  const libSymbols = firstChild(root, 'lib_symbols');
  const libDefs = libSymbols ? childrenByTok(libSymbols, 'symbol') : [];
  const placed = childrenByTok(root, 'symbol');
  const sheets = childrenByTok(root, 'sheet');
  const wires = deepCount(root, 'wire');
  const labels = deepCount(root, 'label') + deepCount(root, 'global_label') + deepCount(root, 'hierarchical_label');
  const junctions = deepCount(root, 'junction');

  const stats = ctx.el('div', 'kic-stats');
  const stat = (label, val) => { const d = ctx.el('div', 'kic-stat'); d.appendChild(ctx.el('b', null, String(val))); d.appendChild(document.createTextNode(' ' + label)); return d; };
  stats.appendChild(stat('symbols placed', placed.length));
  stats.appendChild(stat('library defs', libDefs.length));
  stats.appendChild(stat('sheets', sheets.length));
  stats.appendChild(stat('wires', wires));
  stats.appendChild(stat('labels', labels));
  stats.appendChild(stat('junctions', junctions));
  frag.appendChild(stats);

  const meta = [['Paper', leafVal(root, 'paper')], ...titleBlockPairs(root)];
  if (meta.some(p => p[1])) { const s = section(ctx, 'Sheet'); s.appendChild(kvGrid(ctx, meta)); frag.appendChild(s); }

  // Build a component (BOM-ish) table from placed symbols' properties.
  const propOf = (sym, key) => {
    const p = sym.find(x => Array.isArray(x) && x[0] === 'property' && x[1] === key);
    return p ? (p[2] != null ? String(p[2]) : '') : '';
  };
  const list = placed.length ? placed : libDefs;
  if (list.length) {
    const s = section(ctx, (placed.length ? 'Components (' : 'Library symbols (') + list.length + ')');
    const rows = [];
    for (const sym of list.slice(0, MAX_ROWS)) {
      const ref = propOf(sym, 'Reference');
      const val = propOf(sym, 'Value');
      const fp = propOf(sym, 'Footprint');
      const lib = leafVal(sym, 'lib_id') || (typeof sym[1] === 'string' ? sym[1] : '');
      rows.push([ref, val, fp, lib]);
    }
    s.appendChild(makeRichTable(ctx, ['Ref', 'Value', 'Footprint', 'Library ID'], rows));
    if (list.length > MAX_ROWS) s.appendChild(ctx.el('div', 'kic-more', '… ' + (list.length - MAX_ROWS) + ' more not shown'));
    frag.appendChild(s);
  }
}

function renderMod(ctx, root, frag) {
  // (footprint "Lib:Name" ... ) — pads, drawings, 3d model.
  const name = (typeof root[1] === 'string') ? root[1] : '';
  const pads = childrenByTok(root, 'pad');
  const models = childrenByTok(root, 'model');
  const lines = deepCount(root, 'fp_line') + deepCount(root, 'fp_arc') + deepCount(root, 'fp_circle') + deepCount(root, 'fp_poly');
  const texts = deepCount(root, 'fp_text');

  const stats = ctx.el('div', 'kic-stats');
  const stat = (label, val) => { const d = ctx.el('div', 'kic-stat'); d.appendChild(ctx.el('b', null, String(val))); d.appendChild(document.createTextNode(' ' + label)); return d; };
  stats.appendChild(stat('pads', pads.length));
  stats.appendChild(stat('graphics', lines));
  stats.appendChild(stat('texts', texts));
  stats.appendChild(stat('3D models', models.length));
  frag.appendChild(stats);

  const meta = [
    ['Footprint', name],
    ['Layer', leafVal(root, 'layer')],
    ['Description', leafVal(root, 'descr')],
    ['Tags', leafVal(root, 'tags')],
  ];
  if (meta.some(p => p[1])) { const s = section(ctx, 'Footprint'); s.appendChild(kvGrid(ctx, meta)); frag.appendChild(s); }

  if (pads.length) {
    const s = section(ctx, 'Pads (' + pads.length + ')');
    const rows = [];
    for (const pad of pads.slice(0, MAX_ROWS)) {
      const num = (pad[1] != null) ? String(pad[1]) : '';
      const type = (pad[2] != null) ? String(pad[2]) : '';
      const shape = (pad[3] != null) ? String(pad[3]) : '';
      const at = firstChild(pad, 'at');
      const pos = at ? at.slice(1).join(' ') : '';
      const sz = firstChild(pad, 'size');
      const size = sz ? sz.slice(1).join(' x ') : '';
      const netNode = firstChild(pad, 'net');
      const net = netNode ? (netNode[2] != null ? String(netNode[2]) : String(netNode[1] ?? '')) : '';
      rows.push([num, type, shape, pos, size, net]);
    }
    s.appendChild(makeRichTable(ctx, ['Pad', 'Type', 'Shape', 'Pos (x y rot)', 'Size', 'Net'], rows));
    if (pads.length > MAX_ROWS) s.appendChild(ctx.el('div', 'kic-more', '… ' + (pads.length - MAX_ROWS) + ' more not shown'));
    frag.appendChild(s);
  }
}

function renderPro(ctx, source, frag) {
  // .kicad_pro is JSON.
  let data;
  try { data = JSON.parse(source); } catch (e) { throw new Error('invalid KiCad project JSON: ' + (e && e.message || e)); }
  const stats = ctx.el('div', 'kic-stats');
  const topKeys = Object.keys(data || {});
  const stat = (label, val) => { const d = ctx.el('div', 'kic-stat'); d.appendChild(ctx.el('b', null, String(val))); d.appendChild(document.createTextNode(' ' + label)); return d; };
  stats.appendChild(stat('sections', topKeys.length));
  const sheets = (data && data.sheets) ? data.sheets.length : 0;
  if (sheets) stats.appendChild(stat('sheets', sheets));
  frag.appendChild(stats);

  const meta = [];
  if (data && data.meta) {
    if (data.meta.filename) meta.push(['Project file', data.meta.filename]);
    if (data.meta.version != null) meta.push(['Project format', data.meta.version]);
  }
  if (data && data.text_variables && Object.keys(data.text_variables).length) {
    for (const [k, v] of Object.entries(data.text_variables)) meta.push(['var: ' + k, String(v)]);
  }
  if (meta.length) { const s = section(ctx, 'Project'); s.appendChild(kvGrid(ctx, meta)); frag.appendChild(s); }

  if (topKeys.length) {
    const s = section(ctx, 'Sections');
    const rows = topKeys.map(k => {
      const v = data[k];
      let kind, summary;
      if (Array.isArray(v)) { kind = 'array'; summary = v.length + ' items'; }
      else if (v && typeof v === 'object') { kind = 'object'; summary = Object.keys(v).length + ' keys'; }
      else { kind = typeof v; summary = String(v); }
      return [k, kind, summary];
    });
    const w = ctx.el('div', 'kic-tablewrap');
    w.appendChild(makeTable(ctx, ['Section', 'Type', 'Summary'], rows));
    s.appendChild(w);
    frag.appendChild(s);
  }
}

/* ---------------------------------------------------------------- */
/* Entry point.                                                     */
/* ---------------------------------------------------------------- */
export async function render(ctx) {
  ensureStyle();

  // LOADING STATE: paint an indicator into the host before the (potentially
  // slow) authenticated fetch + heavy in-browser parse. We mount it, then
  // yield a frame so the browser actually renders it before we block on parse.
  // Clear the host first: the dispatcher mounts its own fv-loading spinner and
  // relies on each module clearing the host as its first paint. Only appending
  // here orphaned that spinner above the finished view. Adding fv-loading also
  // gives KiCad the real animated spinner it otherwise lacked.
  ctx.host.textContent = '';
  const loading = ctx.el('div', 'fv-loading kic-loading', 'Loading KiCad file…');
  ctx.host.appendChild(loading);
  await new Promise(r => (typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

  let source;
  try {
    source = await ctx.fetchText();
  } catch (e) {
    loading.remove();
    throw new Error('failed to fetch KiCad body: ' + (e && e.message || e));
  }
  if (source == null) { loading.remove(); throw new Error('empty KiCad body'); }
  if (source.trim() === '') { loading.remove(); throw new Error('empty KiCad body'); }
  loading.textContent = 'Parsing KiCad file…';
  // Yield once more so the "Parsing…" text paints before a multi-MB parse blocks.
  await new Promise(r => (typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

  // Determine file kind from the title extension (primary) then content.
  const t = String(ctx.title || '').toLowerCase();
  let ext = '';
  const dot = t.lastIndexOf('.');
  if (dot >= 0) ext = t.slice(dot + 1);
  if (!meta.exts.includes(ext)) {
    // sniff from content
    const head = source.slice(0, 200);
    if (/^\s*\(kicad_pcb/.test(head)) ext = 'kicad_pcb';
    else if (/^\s*\(kicad_sch/.test(head)) ext = 'kicad_sch';
    else if (/^\s*\(\s*footprint|^\s*\(\s*module/.test(head)) ext = 'kicad_mod';
    else if (/^\s*\{/.test(head)) ext = 'kicad_pro';
    else ext = 'kicad_pcb';
  }

  const root = ctx.el('div', 'kic-root');

  // Header.
  const head = ctx.el('div', 'kic-head');
  const labelMap = {
    kicad_pcb: 'KiCad PCB', kicad_sch: 'KiCad Schematic',
    kicad_pro: 'KiCad Project', kicad_mod: 'KiCad Footprint',
  };
  head.appendChild(ctx.el('span', 'kic-badge', labelMap[ext] || 'KiCad'));
  if (ctx.title) head.appendChild(ctx.el('span', 'kic-sub', ctx.title));
  root.appendChild(head);

  // Parse + structured view. THROW on parse failure so the app falls back.
  const body = ctx.el('div', 'kic-body');
  let truncatedParse = false;
  if (ext === 'kicad_pro') {
    try { renderPro(ctx, source, body); }
    catch (e) { loading.remove(); throw e; }
  } else {
    let tree;
    try { tree = parseSexpr(source); }
    catch (e) { loading.remove(); throw new Error('KiCad S-expression parse failed: ' + (e && e.message || e)); }
    truncatedParse = !!tree._truncated;
    const rootTok = tok(tree);
    // generator / version are common to PCB & SCH
    const gen = leafVal(tree, 'generator');
    const ver = leafVal(tree, 'version');
    if (gen || ver) {
      const gp = [];
      if (ver) gp.push(['Format version', ver]);
      if (gen) gp.push(['Generator', gen]);
      body.appendChild(kvGrid(ctx, gp));
    }
    try {
      if (ext === 'kicad_sch') renderSch(ctx, tree, body);
      else if (ext === 'kicad_mod') renderMod(ctx, tree, body);
      else renderPcb(ctx, tree, body); // default & kicad_pcb
    } catch (e) {
      loading.remove();
      throw new Error('KiCad structure extraction failed: ' + (e && e.message || e));
    }
    void rootTok;
  }

  // DEGRADED-RENDER notice: if the parser hit its node ceiling we still show
  // everything we managed to extract, but warn the structural view is partial.
  if (truncatedParse) {
    root.appendChild(ctx.el('div', 'kic-note kic-warn',
      'Large file: parsing stopped at a safety limit, so the structural summary '
      + 'below is partial. Use the raw source or the download link for the full file.'));
  }

  root.appendChild(body);

  // Note explaining the parsed view (honest about no live render).
  const note = ctx.el('div', 'kic-note kic-info',
    'Parsed structural view. A live graphical PCB/schematic render is not '
    + 'available in-browser for this viewer; the file structure is shown '
    + 'below with the raw source.');
  root.appendChild(note);

  // Raw source toggle with lightweight syntax highlight. Built lazily on first
  // open so the heavy tokenise/append never runs unless the user asks for it.
  const HL_CAP = 200000;   // above this, skip syntax highlight (plain text)
  const SHOW_CAP = 2000000; // above this, even the plain <pre> is truncated so
  //                           the browser can't choke laying out a huge node.
  const btn = ctx.el('button', 'kic-toggle', 'Show raw source');
  const pre = ctx.el('pre', 'kic-src');
  pre.style.display = 'none';
  let built = false;
  btn.addEventListener('click', () => {
    const showing = pre.style.display !== 'none';
    if (showing) { pre.style.display = 'none'; btn.textContent = 'Show raw source'; return; }
    if (!built) {
      const shown = source.length > SHOW_CAP ? source.slice(0, SHOW_CAP) : source;
      try {
        if (shown.length > HL_CAP) { pre.textContent = shown; }
        else { highlightInto(ctx, pre, shown); }
      } catch (e) { pre.textContent = shown; }
      if (source.length > SHOW_CAP) {
        const more = ctx.el('div', 'kic-more',
          'showing first ' + SHOW_CAP.toLocaleString() + ' of ' + source.length.toLocaleString()
          + ' characters — use the download link above for the complete file.');
        pre.appendChild(document.createTextNode('\n'));
        pre.appendChild(more);
      }
      built = true;
    }
    pre.style.display = ''; btn.textContent = 'Hide raw source';
  });
  root.appendChild(btn);
  root.appendChild(pre);

  // Atomically swap the loading indicator for the finished view.
  loading.remove();
  ctx.host.appendChild(root);
}
