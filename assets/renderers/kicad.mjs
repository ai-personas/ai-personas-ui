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
/* ---------------------------------------------------------------- */
function parseSexpr(src) {
  let i = 0;
  const n = src.length;
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
    let out = '';
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '(' || c === ')' || c === '"') break;
      out += c; i++;
    }
    return out;
  }
  function readList() {
    i++; // consume '('
    const list = [];
    while (i < n) {
      skipWs();
      const c = src[i];
      if (c === undefined) break; // unterminated — tolerate
      if (c === ')') { i++; return list; }
      if (c === '(') list.push(readList());
      else if (c === '"') list.push(readString());
      else list.push(readAtom());
    }
    return list; // unterminated — tolerate
  }
  skipWs();
  if (src[i] !== '(') throw new Error('not an S-expression (no opening paren)');
  const root = readList();
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
// deep count of all list nodes carrying token `name`
function deepCount(node, name) {
  let count = 0;
  (function walk(x) {
    if (!Array.isArray(x)) return;
    if (x[0] === name) count++;
    for (const c of x) if (Array.isArray(c)) walk(c);
  })(node);
  return count;
}
// deep collect of all list nodes carrying token `name`
function deepCollect(node, name, limit) {
  const out = [];
  (function walk(x) {
    if (out.length >= limit) return;
    if (!Array.isArray(x)) return;
    if (x[0] === name) out.push(x);
    for (const c of x) { if (out.length >= limit) return; if (Array.isArray(c)) walk(c); }
  })(node);
  return out;
}

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
  s.textContent = `
.kic-root{font:13px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:inherit}
.kic-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5em;margin:0 0 .6em}
.kic-badge{display:inline-block;padding:.1em .55em;border-radius:.4em;background:#2b6cb0;color:#fff;font-weight:600;font-size:.78em;letter-spacing:.02em}
.kic-sub{opacity:.7;font-size:.85em}
.kic-note{margin:.4em 0 .8em;padding:.5em .7em;border-left:3px solid #2b6cb0;background:rgba(43,108,176,.08);font-size:.85em;opacity:.92;border-radius:0 .3em .3em 0}
.kic-section{margin:.9em 0}
.kic-h{margin:.2em 0 .4em;font-size:.95em;font-weight:700;opacity:.9}
.kic-kv{display:grid;grid-template-columns:auto 1fr;gap:.15em .8em;font-size:.88em;max-width:46em}
.kic-k{opacity:.62;white-space:nowrap}
.kic-v{word-break:break-word}
.kic-stats{display:flex;flex-wrap:wrap;gap:.5em;margin:.4em 0}
.kic-stat{padding:.3em .6em;border-radius:.45em;background:rgba(128,128,128,.12);font-size:.82em}
.kic-stat b{font-size:1.05em}
.kic-table{border-collapse:collapse;width:100%;max-width:60em;font-size:.83em;margin:.3em 0}
.kic-table th,.kic-table td{border:1px solid rgba(128,128,128,.25);padding:.22em .5em;text-align:left;vertical-align:top}
.kic-table th{background:rgba(128,128,128,.12);font-weight:600;position:sticky;top:0}
.kic-table tbody tr:nth-child(even){background:rgba(128,128,128,.05)}
.kic-tablewrap{max-height:24em;overflow:auto;border-radius:.3em}
.kic-more{opacity:.6;font-size:.8em;margin:.25em 0}
.kic-toggle{margin:.8em 0 .3em;cursor:pointer;font-size:.85em;font-weight:600;color:#2b6cb0;background:none;border:1px solid rgba(43,108,176,.4);border-radius:.35em;padding:.3em .7em}
.kic-toggle:hover{background:rgba(43,108,176,.1)}
.kic-src{margin:.3em 0 0;padding:.7em .8em;background:rgba(128,128,128,.08);border-radius:.4em;overflow:auto;max-height:30em;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre;tab-size:2}
.kic-tk-str{color:#3a9a3a}
.kic-tk-num{color:#b5651d}
.kic-tk-com{color:#888;font-style:italic}
.kic-tk-paren{color:#888}
.kic-tk-kw{color:#2b6cb0;font-weight:600}
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
  stats.appendChild(stat('layers', layerRows.length));
  stats.appendChild(stat('nets', Math.max(0, nets.length - childrenByTok(root, 'net').filter(x => x[2] === '').length)));
  stats.appendChild(stat('footprints', footprints.length));
  stats.appendChild(stat('tracks', tracks));
  stats.appendChild(stat('vias', vias));
  stats.appendChild(stat('zones', zones));
  frag.appendChild(stats);

  const tb = titleBlockPairs(root);
  const thickness = (() => { const g = firstChild(root, 'general'); return g ? leafVal(g, 'thickness') : null; })();
  const meta = [['Paper', leafVal(root, 'paper')], ...tb];
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
    const w = ctx.el('div', 'kic-tablewrap');
    w.appendChild(makeTable(ctx, ['Ref', 'Value', 'Library / Footprint', 'Layer', 'Pads'], rows));
    s.appendChild(w);
    if (footprints.length > MAX_ROWS) s.appendChild(ctx.el('div', 'kic-more', '… ' + (footprints.length - MAX_ROWS) + ' more not shown'));
    frag.appendChild(s);
  }

  const namedNets = nets.filter(nn => nn[2] && nn[2] !== '');
  if (namedNets.length) {
    const s = section(ctx, 'Nets (' + namedNets.length + ')');
    const rows = namedNets.slice(0, MAX_ROWS).map(nn => [nn[1], nn[2]]);
    const w = ctx.el('div', 'kic-tablewrap');
    w.appendChild(makeTable(ctx, ['#', 'Net name'], rows));
    s.appendChild(w);
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
    const w = ctx.el('div', 'kic-tablewrap');
    w.appendChild(makeTable(ctx, ['Ref', 'Value', 'Footprint', 'Library ID'], rows));
    s.appendChild(w);
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
      const net = leafVal(pad, 'net') || '';
      rows.push([num, type, shape, pos, size, net]);
    }
    const w = ctx.el('div', 'kic-tablewrap');
    w.appendChild(makeTable(ctx, ['Pad', 'Type', 'Shape', 'Pos (x y rot)', 'Size', 'Net'], rows));
    s.appendChild(w);
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
  const erc = data && data.board && data.board.design_settings;
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
  const source = await ctx.fetchText();
  if (source == null) throw new Error('empty KiCad body');

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
  if (ext === 'kicad_pro') {
    renderPro(ctx, source, body);
  } else {
    let tree;
    try { tree = parseSexpr(source); }
    catch (e) { throw new Error('KiCad S-expression parse failed: ' + (e && e.message || e)); }
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
    if (ext === 'kicad_sch') renderSch(ctx, tree, body);
    else if (ext === 'kicad_mod') renderMod(ctx, tree, body);
    else renderPcb(ctx, tree, body); // default & kicad_pcb
    void rootTok;
  }
  root.appendChild(body);

  // Note explaining the parsed view (honest about no live render).
  const note = ctx.el('div', 'kic-note',
    'Parsed structural view. A live graphical PCB/schematic render is not '
    + 'available in-browser for this viewer; the file structure is shown '
    + 'below with the raw source.');
  root.appendChild(note);

  // Raw source toggle with lightweight syntax highlight.
  const btn = ctx.el('button', 'kic-toggle', 'Show raw source');
  const pre = ctx.el('pre', 'kic-src');
  pre.style.display = 'none';
  let built = false;
  btn.addEventListener('click', () => {
    const showing = pre.style.display !== 'none';
    if (showing) { pre.style.display = 'none'; btn.textContent = 'Show raw source'; return; }
    if (!built) {
      // cap highlight cost on very large files; show plain text past the cap
      const CAP = 200000;
      try {
        if (source.length > CAP) { pre.textContent = source; }
        else { highlightInto(ctx, pre, source); }
      } catch (e) { pre.textContent = source; }
      built = true;
    }
    pre.style.display = ''; btn.textContent = 'Hide raw source';
  });
  root.appendChild(btn);
  root.appendChild(pre);

  ctx.host.appendChild(root);
}
