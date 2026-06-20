// netlist.mjs — PersonaOS deliverable viewer renderer for SPICE / EDA netlists.
//
// FAMILY: netlist — SPICE / EDA netlists + circuit text.
//
// viable=false: there is no maintained, permissively-licensed *browser ESM* lib
// that turns an arbitrary SPICE netlist into a schematic. netlistsvg targets
// yosys/digital JSON (not analog SPICE) and elkjs ships a web-worker that does
// not resolve cleanly as a bare esm.sh import inside a sandboxed drawer. So this
// renderer DEGRADES rather than skips: it parses the netlist into a
// components/parameters table + a nets table, lays out the topology as a
// self-contained SVG node-edge graph (components <-> nets, a bipartite layered
// layout — no third-party layout dependency), and syntax-highlights the source.
//
// Domain-agnostic: it renders whatever circuit text appears. No project/intent
// assumptions. Fail-soft: every risky step is wrapped and THROWS on hard failure
// so discovery.js falls back to its download/text view.

export const meta = {
  exts: ['cir', 'net', 'spice', 'sp', 'ckt', 'asc', 'scs', 'spc', 'subckt'],
  media_kinds: ['netlist', 'spice', 'circuit', 'eda'],
  fetchMode: 'text',
  label: 'SPICE / EDA Netlist',
};

// ---------------------------------------------------------------------------
// SPICE element-letter → human role. First char of a card is the device class
// in (Berkeley) SPICE. Unknown letters degrade to a generic "device" so the
// parser never assumes a domain.
// ---------------------------------------------------------------------------
const DEVICE = {
  R: 'Resistor', C: 'Capacitor', L: 'Inductor', K: 'Coupling',
  V: 'Voltage source', I: 'Current source', E: 'VCVS', G: 'VCCS',
  F: 'CCCS', H: 'CCVS', B: 'Behavioral source',
  D: 'Diode', Q: 'BJT', M: 'MOSFET', J: 'JFET', Z: 'MESFET/HEMT',
  S: 'Voltage switch', W: 'Current switch',
  T: 'Transmission line', O: 'Lossy line', U: 'Uniform line',
  X: 'Subcircuit', A: 'Mixed-signal', P: 'Port', N: 'Numeric device',
};
// Most elements have a fixed terminal count; used to split nodes from params.
const PINS = { R: 2, C: 2, L: 2, D: 2, V: 2, I: 2, B: 2, S: 4, W: 4,
  E: 4, G: 4, F: 2, H: 2, K: 0, Q: 3, J: 3, Z: 3, M: 4, T: 4, O: 4 };

export async function render(ctx) {
  const { host, el, esc } = ctx;

  // Loading state: fetch (network) + the parse can be slow on large decks, so
  // surface progress before any heavy work resolves (contract requirement).
  host.appendChild(el('div', 'fv-loading', 'fetching netlist…'));

  const raw = await ctx.fetchText();
  if (raw == null) throw new Error('netlist: body fetch returned null');
  if (typeof raw !== 'string') throw new Error('netlist: body is not text');
  if (!raw.trim()) throw new Error('netlist: empty body');

  host.innerHTML = '';
  host.appendChild(el('div', 'fv-loading', 'parsing netlist…'));

  // -- parse -----------------------------------------------------------------
  const parsed = parseNetlist(raw);
  host.innerHTML = '';   // clear the loading indicator before painting
  // Netlist-shaped guard. Arbitrary prose can superficially "parse" as one
  // card (first word -> device letter), so a single isolated card is too weak.
  // Require a real signal: any directive/.model, OR >=2 wired components, OR a
  // wired component that references a canonical node (numeric / ground) — real
  // decks almost always tie something to node 0. Otherwise fall through to the
  // app's text/download fallback.
  const wired = parsed.components.filter((c) => c.nodes.length > 0);
  const hasCanonicalNode = wired.some((c) =>
    c.nodes.some((n) => isGround(n) || /^\d+$/.test(n)));
  const looksLikeNetlist =
    parsed.directives.length > 0 || parsed.models.length > 0 ||
    wired.length >= 2 || (wired.length >= 1 && hasCanonicalNode);
  if (!looksLikeNetlist) {
    throw new Error('netlist: no SPICE cards or directives recognised');
  }

  // -- build view ------------------------------------------------------------
  const root = el('div', 'nl-root');
  injectStyle(root, ctx);

  root.appendChild(buildSummary(parsed, ctx));

  if (parsed.truncatedLines) {
    root.appendChild(el('div', 'nl-note nl-warn',
      `Large netlist: parsed the first ${MAX_LINES.toLocaleString()} lines; ` +
      `${parsed.truncatedLines.toLocaleString()} further line(s) were not read ` +
      `to keep the viewer responsive.`));
  }

  // Topology graph (self-contained SVG). Wrapped so a layout glitch on a
  // pathological file still leaves the tables + source usable.
  try {
    if (parsed.components.length) root.appendChild(buildGraph(parsed, ctx));
  } catch (e) {
    const note = el('div', 'nl-note', 'Topology graph unavailable: ' + (e && e.message || e));
    root.appendChild(note);
  }

  if (parsed.components.length) root.appendChild(buildComponentsTable(parsed, ctx));
  if (parsed.nets.length) root.appendChild(buildNetsTable(parsed, ctx));
  if (parsed.directives.length) root.appendChild(buildDirectives(parsed, ctx));
  if (parsed.models.length) root.appendChild(buildModels(parsed, ctx));

  root.appendChild(buildSource(raw, parsed, ctx));

  host.appendChild(root);
}

// ===========================================================================
// PARSER
// ===========================================================================
// Hard ceiling on physical lines actually walked. A pathological multi-MB deck
// must never freeze the tab; we parse the head and report the truncation.
const MAX_LINES = 50000;

// Strip an end-of-line SPICE comment: ';' (HSPICE/ngspice) or ' $' (PSPICE)
// begins a trailing comment. A leading '$' is also a whole-line comment in some
// dialects. Done at PARSE time so node/value tokens are never polluted by
// comment words (previously only the highlighter stripped these, cosmetically).
function stripInlineComment(s) {
  // ' $' (dollar must be space-delimited so it can't eat a "$param" token);
  // ';' ends a comment anywhere. Whichever comes first wins.
  const semi = s.indexOf(';');
  const dollar = s.search(/\s\$/);
  let cut = -1;
  if (semi >= 0) cut = semi;
  if (dollar >= 0 && (cut < 0 || dollar < cut)) cut = dollar;
  return cut >= 0 ? s.slice(0, cut) : s;
}

function parseNetlist(raw) {
  // SPICE line-continuation: a line beginning with '+' appends to the previous.
  let physical = raw.replace(/\r\n?/g, '\n').split('\n');
  let truncatedLines = 0;
  if (physical.length > MAX_LINES) {
    truncatedLines = physical.length - MAX_LINES;
    physical = physical.slice(0, MAX_LINES);
  }
  const lines = [];
  for (let i = 0; i < physical.length; i++) {
    let ln = physical[i];
    if (/^\s*\+/.test(ln) && lines.length) {
      lines[lines.length - 1].text += ' ' + ln.replace(/^\s*\+/, '').trim();
    } else {
      lines.push({ n: i + 1, text: ln });
    }
  }

  const components = [];
  const directives = [];
  const models = [];
  const comments = [];
  const netSet = new Map();      // net -> Set(componentRefs)
  let title = null;
  let subckts = 0;
  // Subckt scope stack: nets/refs defined inside a .subckt are local. We qualify
  // them with the subckt name so identically-named nodes (e.g. every subckt's
  // internal "1") don't collapse into one global net in the tables/graph.
  const scopeStack = [];
  const scopePrefix = () => (scopeStack.length ? scopeStack.join('/') + ':' : '');

  const touch = (net, ref) => {
    if (net == null || net === '') return;
    if (!netSet.has(net)) netSet.set(net, new Set());
    netSet.get(net).add(ref);
  };

  for (let li = 0; li < lines.length; li++) {
    const rawLine = lines[li].text;
    const lineNo = lines[li].n;
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // First non-empty line of a SPICE deck is the title comment (no leading *).
    if (title === null && li === 0 && trimmed[0] !== '*' && trimmed[0] !== '.') {
      // ...unless it actually looks like a real card; titles rarely start with
      // a device letter followed by token+node. Heuristic: if it parses as a
      // card later we keep both; here we only claim it as a title when the deck
      // has more than one line.
      if (lines.length > 1) { title = trimmed; continue; }
    }

    if (trimmed[0] === '*') { comments.push({ lineNo, text: trimmed.slice(1).trim() }); continue; }
    // Whole-line '$' comment (PSPICE-style) — not a device card.
    if (trimmed[0] === '$') { comments.push({ lineNo, text: trimmed.slice(1).trim() }); continue; }

    if (trimmed[0] === '.') {
      // Directive bodies can carry inline comments too.
      const body = stripInlineComment(trimmed).trim();
      const tok = body.slice(1).split(/\s+/);
      const dir = (tok[0] || '').toLowerCase();
      if (dir === 'model') {
        models.push({ lineNo, name: tok[1] || '', type: tok[2] || '', text: body });
      } else if (dir === 'subckt') {
        subckts++;
        scopeStack.push(tok[1] || ('sub' + subckts));
        directives.push({ lineNo, dir: '.' + dir, args: tok.slice(1).join(' '), text: body });
      } else if (dir === 'ends' || dir === 'eom') {
        if (scopeStack.length) scopeStack.pop();
        directives.push({ lineNo, dir: '.' + dir, args: tok.slice(1).join(' '), text: body });
      } else {
        directives.push({ lineNo, dir: '.' + dir, args: tok.slice(1).join(' '), text: body });
      }
      continue;
    }

    // A device card: <ref> <nodes...> <params...> — drop any inline comment first.
    const clean = stripInlineComment(trimmed).trim();
    if (!clean) continue;
    const tok = clean.split(/\s+/).filter(Boolean);
    const ref0 = tok[0];
    if (!ref0) continue;                       // defensive: no usable ref token
    const pfx = scopePrefix();
    const ref = pfx + ref0;                     // qualify ref by scope (display keeps prefix)
    const letter = ref0[0].toUpperCase();
    const klass = DEVICE[letter] || 'Device';

    // Decide how many leading tokens are nodes.
    let nNodes = pinCount(letter, tok);
    nNodes = Math.min(nNodes, tok.length - 1);
    const nodes = tok.slice(1, 1 + nNodes).map((n) => qualifyNode(n, pfx));
    const rest = tok.slice(1 + nNodes);

    // For Q/M/J/Z the token after the node list is usually the model name;
    // for X the LAST token is the subckt name. Surface a "value/model" field.
    let value = '';
    if (letter === 'X') {
      value = rest.length ? rest[rest.length - 1] : '';
    } else if ('QMJZD'.includes(letter)) {
      value = rest.length ? rest[0] : '';
    } else {
      value = rest.join(' ');
    }

    const comp = {
      lineNo, ref, letter, klass, scope: scopeStack[scopeStack.length - 1] || '',
      nodes, value: value || '', params: rest.join(' '),
    };
    components.push(comp);
    for (const nd of nodes) touch(nd, ref);
  }

  // Build nets array (sorted: ground-ish nodes first, then by fan-out desc).
  const nets = [...netSet.entries()].map(([name, set]) => ({
    name, members: [...set], fanout: set.size,
  }));
  nets.sort((a, b) => {
    const ga = isGround(a.name), gb = isGround(b.name);
    if (ga !== gb) return ga ? -1 : 1;
    return b.fanout - a.fanout || cmp(a.name, b.name);
  });

  return { title, components, nets, directives, models, comments, subckts,
    lineCount: lines.length, truncatedLines };
}

// Ground stays global (every subckt's "0" is the one true ground). All other
// nodes inside a subckt are local, so qualify them with the scope prefix.
function qualifyNode(n, pfx) {
  if (!pfx) return n;
  return isGround(n) ? n : pfx + n;
}

function pinCount(letter, tok) {
  if (letter === 'X') {
    // Subckt instance: every token before the (last) subckt name is a node,
    // minus any trailing key=val params. Treat all non key=val middle tokens
    // as nodes; the final bare token is the subckt name.
    let end = tok.length;
    while (end > 1 && tok[end - 1].includes('=')) end--;     // strip params
    // last remaining bare token = subckt name
    return Math.max(0, end - 1 - 1);
  }
  if (PINS[letter] != null) return PINS[letter];
  // Unknown device: take leading tokens that look like node identifiers
  // (no '=', not a pure float-with-unit value) as nodes, stop at first param.
  let c = 0;
  for (let i = 1; i < tok.length; i++) {
    if (tok[i].includes('=')) break;
    c++;
  }
  return Math.min(c, 2); // conservative default
}

const GROUND = new Set(['0', 'gnd', 'gnd!', 'ground', 'vss', 'agnd', 'dgnd']);
const isGround = (n) => GROUND.has(String(n).toLowerCase());
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ===========================================================================
// SUMMARY
// ===========================================================================
function buildSummary(p, ctx) {
  const { el, esc } = ctx;
  const wrap = el('div', 'nl-summary');
  if (p.title) wrap.appendChild(ctx.el('div', 'nl-title', p.title));

  const counts = {};
  for (const c of p.components) counts[c.klass] = (counts[c.klass] || 0) + 1;
  const chips = el('div', 'nl-chips');
  const stat = (label, n) => {
    const c = el('span', 'nl-chip');
    c.innerHTML = `<b>${esc(String(n))}</b> ${esc(label)}`;
    chips.appendChild(c);
  };
  stat('components', p.components.length);
  stat('nets', p.nets.length);
  if (p.models.length) stat('models', p.models.length);
  if (p.subckts) stat('subckts', p.subckts);
  stat('directives', p.directives.length);
  wrap.appendChild(chips);

  if (Object.keys(counts).length) {
    const byType = el('div', 'nl-chips nl-chips-soft');
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
      const c = el('span', 'nl-chip');
      c.innerHTML = `${esc(k)} <b>${esc(String(n))}</b>`;
      byType.appendChild(c);
    });
    wrap.appendChild(byType);
  }
  return wrap;
}

// ===========================================================================
// TOPOLOGY GRAPH  (self-contained SVG; bipartite components <-> nets)
// ---------------------------------------------------------------------------
// No external layout lib (elkjs needs a web worker that does not resolve as a
// bare esm.sh import; netlistsvg is yosys-JSON-only). We use a deterministic
// two-column-by-degree layout: nets on the left ordered by fan-out, components
// on the right grouped near their dominant net. Good enough to read topology,
// and bullet-proof in a sandboxed drawer.
// ===========================================================================
function buildGraph(p, ctx) {
  const { el, esc } = ctx;
  const NS = 'http://www.w3.org/2000/svg';

  // Cap to keep the SVG sane on huge decks; note the cap honestly.
  const MAXC = 120, MAXN = 120;
  const comps = p.components.slice(0, MAXC);
  const compRefs = new Set(comps.map((c) => c.ref));
  const nets = p.nets.filter((n) => n.members.some((m) => compRefs.has(m))).slice(0, MAXN);
  const netNames = new Set(nets.map((n) => n.name));

  const wrap = el('div', 'nl-block');
  const bar = el('div', 'nl-graph-bar');
  bar.appendChild(el('span', 'nl-block-h nl-graph-title', 'Topology'));
  const mkBtn = (txt, title) => { const b = el('button', 'nl-gbtn', txt); b.type = 'button'; if (title) b.title = title; return b; };
  const bFit = mkBtn('Fit', 'reset zoom');
  const bIn = mkBtn('+', 'zoom in');
  const bOut = mkBtn('−', 'zoom out');
  const hint = el('span', 'nl-ghint', 'drag = pan · wheel = zoom');
  bar.appendChild(bFit); bar.appendChild(bIn); bar.appendChild(bOut); bar.appendChild(hint);
  wrap.appendChild(bar);

  // ---- ordering: barycentric sweep to reduce edge crossings / visual overlap.
  // Components keep deck order initially; nets are placed at the mean Y of the
  // components they touch, then components are re-placed at the mean Y of their
  // nets. Two passes is enough to untangle most decks without a layout lib.
  const adj = new Map();             // ref -> [net names it touches]
  for (const c of comps) adj.set(c.ref, c.nodes.filter((n) => netNames.has(n)));

  let compOrder = comps.map((c) => c.ref);
  const idxOf = (arr) => { const m = new Map(); arr.forEach((v, i) => m.set(v, i)); return m; };
  for (let pass = 0; pass < 2; pass++) {
    // place nets at barycenter of their (current) component rows
    const cIdx = idxOf(compOrder);
    const netBary = nets.map((n) => {
      const rows = n.members.filter((m) => cIdx.has(m)).map((m) => cIdx.get(m));
      const b = rows.length ? rows.reduce((a, v) => a + v, 0) / rows.length : 1e9;
      return { name: n.name, b };
    });
    // keep ground nets pinned to the top for readability
    netBary.sort((a, b) => {
      const ga = isGround(a.name), gb = isGround(b.name);
      if (ga !== gb) return ga ? -1 : 1;
      return a.b - b.b || cmp(a.name, b.name);
    });
    const netOrder = netBary.map((x) => x.name);
    const nIdx = idxOf(netOrder);
    // place components at barycenter of their nets
    compOrder = compOrder.slice().sort((ra, rb) => {
      const ba = baryOf(adj.get(ra), nIdx), bb = baryOf(adj.get(rb), nIdx);
      return ba - bb || cmp(ra, rb);
    });
    // remember final net order on the last pass
    if (pass === 1) nets.forEach((n) => { n._row = nIdx.get(n.name); });
    else nets.sort((a, b) => nIdx.get(a.name) - nIdx.get(b.name));
  }
  const compRow = idxOf(compOrder);

  const colN = nets.length, colC = comps.length;
  const rows = Math.max(colN, colC, 1);
  const ROW = 30, PADY = 24, LX = 150, RX = 470, W = 620;
  const H = PADY * 2 + (rows - 1) * ROW + 14;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'nl-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
  svg.style.touchAction = 'none';

  const yN = {}, yC = {};
  nets.forEach((n) => { yN[n.name] = PADY + (n._row != null ? n._row : 0) * ROW; });
  comps.forEach((c) => { yC[c.ref] = PADY + (compRow.get(c.ref) || 0) * ROW; });

  const mk = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };

  // Everything that should pan/zoom together lives in this group; the column
  // captions stay fixed in the corner.
  const view = mk('g', {});

  // edges first (under nodes)
  const g = mk('g', {});
  for (const c of comps) {
    for (const nd of c.nodes) {
      if (!netNames.has(nd)) continue;
      const y1 = yC[c.ref], y2 = yN[nd];
      const mx = (LX + RX) / 2;
      const cls = isGround(nd) ? 'nl-edge nl-edge-gnd' : 'nl-edge';
      g.appendChild(mk('path', {
        d: `M ${RX} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${LX} ${y2}`,
        class: cls,
      }));
    }
  }
  view.appendChild(g);

  // net nodes (left)
  for (const n of nets) {
    const y = yN[n.name];
    const cls = isGround(n.name) ? 'nl-node-net nl-gnd' : 'nl-node-net';
    view.appendChild(mk('circle', { cx: LX, cy: y, r: 4, class: cls }));
    view.appendChild(mk('text', { x: LX - 9, y: y + 3.5, class: 'nl-lbl nl-lbl-net' }, clip(n.name, 22)));
  }
  // component nodes (right)
  for (const c of comps) {
    const y = yC[c.ref];
    view.appendChild(mk('rect', { x: RX - 3.5, y: y - 3.5, width: 7, height: 7, rx: 1.5, class: 'nl-node-comp dev-' + c.letter }));
    const lbl = c.ref + (c.value ? '  ' + c.value : '');
    view.appendChild(mk('text', { x: RX + 9, y: y + 3.5, class: 'nl-lbl nl-lbl-comp' }, clip(lbl, 26)));
  }
  svg.appendChild(view);

  // column captions (fixed, not inside the pan/zoom group)
  svg.appendChild(mk('text', { x: LX - 9, y: 12, class: 'nl-col-h', 'text-anchor': 'end' }, 'NETS'));
  svg.appendChild(mk('text', { x: RX + 9, y: 12, class: 'nl-col-h' }, 'COMPONENTS'));

  wrap.appendChild(svg);

  // ---- zoom / pan via a CSS transform on the inner group (viewBox stays the
  // intrinsic 0..W/0..H coordinate space; we scale+translate within it).
  const vs = { scale: 1, tx: 0, ty: 0 };
  const apply = () => view.setAttribute('transform', `translate(${vs.tx} ${vs.ty}) scale(${vs.scale})`);
  const ptIn = (ev) => {
    const r = svg.getBoundingClientRect();
    const sx = W / (r.width || 1), sy = H / (r.height || 1);
    return { x: (ev.clientX - r.left) * sx, y: (ev.clientY - r.top) * sy };
  };
  const zoomAt = (px, py, f) => {
    const ns = Math.max(0.2, Math.min(8, vs.scale * f));
    f = ns / vs.scale;
    vs.tx = px - (px - vs.tx) * f; vs.ty = py - (py - vs.ty) * f; vs.scale = ns; apply();
  };
  const onWheel = (ev) => { ev.preventDefault(); const p = ptIn(ev); zoomAt(p.x, p.y, ev.deltaY < 0 ? 1.15 : 1 / 1.15); };
  svg.addEventListener('wheel', onWheel, { passive: false });

  let drag = false, lx = 0, ly = 0;
  const onDown = (ev) => { drag = true; const p = ptIn(ev); lx = p.x; ly = p.y; svg.style.cursor = 'grabbing';
    svg.setPointerCapture && svg.setPointerCapture(ev.pointerId); };
  const onMove = (ev) => { if (!drag) return; const p = ptIn(ev); vs.tx += p.x - lx; vs.ty += p.y - ly; lx = p.x; ly = p.y; apply(); };
  const onUp = () => { drag = false; svg.style.cursor = 'grab'; };
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.style.cursor = 'grab';

  const cc = () => ({ x: W / 2, y: Math.min(H, 220) });
  bIn.addEventListener('click', () => { const p = cc(); zoomAt(p.x, p.y, 1.3); });
  bOut.addEventListener('click', () => { const p = cc(); zoomAt(p.x, p.y, 1 / 1.3); });
  bFit.addEventListener('click', () => { vs.scale = 1; vs.tx = 0; vs.ty = 0; apply(); });

  // dispose listeners when the drawer switches files
  if (typeof ctx.onCleanup === 'function') {
    ctx.onCleanup(() => {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
    });
  }

  if (p.components.length > MAXC || p.nets.length > MAXN) {
    wrap.appendChild(el('div', 'nl-note',
      `Graph capped to ${comps.length} components / ${nets.length} nets ` +
      `(of ${p.components.length} / ${p.nets.length}). Full data in tables below.`));
  }
  return wrap;
}

// mean row-index of a node's neighbours; isolated nodes sink to the bottom
function baryOf(neighbors, idxMap) {
  if (!neighbors || !neighbors.length) return 1e9;
  let sum = 0, n = 0;
  for (const k of neighbors) { if (idxMap.has(k)) { sum += idxMap.get(k); n++; } }
  return n ? sum / n : 1e9;
}

// clip an SVG label so very long net/ref names can't overrun the column
const clip = (s, max) => { s = String(s); return s.length > max ? s.slice(0, max - 1) + '…' : s; };

// ===========================================================================
// TABLES
// ===========================================================================
// Max rows we paint at once; beyond this the DOM (and the tab) chokes. The
// filter still searches the FULL dataset, so a hidden row is reachable by name.
const MAX_ROWS = 2000;

// Shared sortable + filterable table. `cols` describe headers and how to sort;
// `rowHtml(r)` returns the <tr> innerHTML; `sortKey(r, ci)` returns the value
// to compare for column ci (string or number).
function buildDataTable(ctx, blockTitle, rows, cols, rowHtml, sortKey) {
  const { el, esc } = ctx;
  const wrap = el('div', 'nl-block');
  wrap.appendChild(el('div', 'nl-block-h', `${blockTitle} (${rows.length})`));

  const bar = el('div', 'nl-tbar');
  const filter = el('input', 'nl-filter');
  filter.type = 'search';
  filter.placeholder = 'filter…';
  filter.spellcheck = false;
  filter.setAttribute('aria-label', `filter ${blockTitle}`);
  const counter = el('span', 'nl-count');
  bar.appendChild(filter); bar.appendChild(counter);
  wrap.appendChild(bar);

  const tbl = el('table', 'nl-table');
  const thead = el('thead', '');
  const htr = el('tr', '');
  let sortCi = -1, sortDir = 1;
  cols.forEach((c, ci) => {
    const th = el('th', (c.right ? 'nl-rl ' : '') + 'nl-sortable');
    th.textContent = c.label;
    th.setAttribute('role', 'button');
    th.tabIndex = 0;
    const onSort = () => {
      if (sortCi === ci) sortDir = -sortDir; else { sortCi = ci; sortDir = 1; }
      cols.forEach((_, j) => { htr.children[j].removeAttribute('data-sort'); });
      th.setAttribute('data-sort', sortDir > 0 ? 'asc' : 'desc');
      paint();
    };
    th.addEventListener('click', onSort);
    th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(); } });
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  tbl.appendChild(thead);
  const tb = el('tbody', '');
  tbl.appendChild(tb);
  wrap.appendChild(tbl);

  const paint = () => {
    const q = filter.value.trim().toLowerCase();
    let view = q
      ? rows.filter((r) => cols.some((c, ci) => String(sortKey(r, ci)).toLowerCase().includes(q)))
      : rows.slice();
    if (sortCi >= 0) {
      const col = cols[sortCi];
      view.sort((a, b) => {
        let va = sortKey(a, sortCi), vb = sortKey(b, sortCi);
        if (col.numeric) { va = Number(va); vb = Number(vb); if (isNaN(va)) va = -Infinity; if (isNaN(vb)) vb = -Infinity; return (va - vb) * sortDir; }
        return cmp(String(va).toLowerCase(), String(vb).toLowerCase()) * sortDir;
      });
    }
    const total = view.length;
    const shown = Math.min(total, MAX_ROWS);
    let html = '';
    for (let i = 0; i < shown; i++) html += `<tr>${rowHtml(view[i])}</tr>`;
    tb.innerHTML = html;
    counter.textContent = total > shown
      ? `showing ${shown} of ${total}${q ? ' matched' : ''}`
      : `${total}${q && total !== rows.length ? ' of ' + rows.length : ''} row${total === 1 ? '' : 's'}`;
  };

  let t = null;
  filter.addEventListener('input', () => { clearTimeout(t); t = setTimeout(paint, 90); });
  if (typeof ctx.onCleanup === 'function') ctx.onCleanup(() => clearTimeout(t));
  paint();
  return wrap;
}

function buildComponentsTable(p, ctx) {
  const { esc } = ctx;
  const cols = [
    { label: 'Ref' }, { label: 'Type' }, { label: 'Nodes' },
    { label: 'Value / Model' }, { label: 'Line', right: true, numeric: true },
  ];
  const sortKey = (c, ci) => ci === 0 ? c.ref : ci === 1 ? c.klass
    : ci === 2 ? c.nodes.join(' ') : ci === 3 ? c.value : c.lineNo;
  const rowHtml = (c) => {
    const nodes = c.nodes.map((n) =>
      `<span class="nl-pin${isGround(n) ? ' nl-pin-gnd' : ''}">${esc(n)}</span>`).join('');
    return `<td class="nl-ref dev-${esc(c.letter)}">${esc(c.ref)}</td>` +
      `<td>${esc(c.klass)}</td>` +
      `<td class="nl-nodes">${nodes || '<span class="nl-dim">—</span>'}</td>` +
      `<td class="nl-val">${c.value ? esc(c.value) : '<span class="nl-dim">—</span>'}</td>` +
      `<td class="nl-rl nl-dim">${c.lineNo}</td>`;
  };
  return buildDataTable(ctx, 'Components', p.components, cols, rowHtml, sortKey);
}

function buildNetsTable(p, ctx) {
  const { esc } = ctx;
  const cols = [
    { label: 'Net' }, { label: 'Fan-out', right: true, numeric: true }, { label: 'Connected to' },
  ];
  const sortKey = (n, ci) => ci === 0 ? n.name : ci === 1 ? n.fanout : n.members.join(' ');
  const rowHtml = (n) =>
    `<td class="nl-net${isGround(n.name) ? ' nl-pin-gnd' : ''}">${esc(n.name)}</td>` +
    `<td class="nl-rl">${n.fanout}</td>` +
    `<td class="nl-members">${n.members.map((m) => `<span class="nl-pin">${esc(m)}</span>`).join('')}</td>`;
  return buildDataTable(ctx, 'Nets', p.nets, cols, rowHtml, sortKey);
}

function buildDirectives(p, ctx) {
  const { el, esc } = ctx;
  const wrap = el('div', 'nl-block');
  wrap.appendChild(el('div', 'nl-block-h', `Directives (${p.directives.length})`));
  const list = el('div', 'nl-dir-list');
  for (const d of p.directives) {
    const row = el('div', 'nl-dir');
    row.innerHTML = `<span class="nl-dir-k">${esc(d.dir)}</span> <span class="nl-dim">${esc(d.args || '')}</span>`;
    list.appendChild(row);
  }
  wrap.appendChild(list);
  return wrap;
}

function buildModels(p, ctx) {
  const { el, esc } = ctx;
  const wrap = el('div', 'nl-block');
  wrap.appendChild(el('div', 'nl-block-h', `Models (${p.models.length})`));
  const tbl = el('table', 'nl-table');
  tbl.innerHTML = `<thead><tr><th>Name</th><th>Type</th><th class="nl-rl">Line</th></tr></thead>`;
  const tb = el('tbody', '');
  for (const m of p.models) {
    const tr = el('tr', '');
    tr.innerHTML = `<td class="nl-ref">${esc(m.name)}</td><td>${esc(m.type)}</td><td class="nl-rl nl-dim">${m.lineNo}</td>`;
    tb.appendChild(tr);
  }
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  return wrap;
}

// ===========================================================================
// SOURCE  (syntax-highlighted, self-contained tokenizer)
// ===========================================================================
// Cap highlighted source lines: each line becomes a span, so an enormous deck
// would otherwise build millions of nodes and freeze the tab.
const MAX_SRC_LINES = 5000;

function buildSource(raw, p, ctx) {
  const { el, esc } = ctx;
  const wrap = el('div', 'nl-block');
  wrap.appendChild(el('div', 'nl-block-h', 'Source'));
  const allLines = raw.replace(/\r\n?/g, '\n').split('\n');
  const total = allLines.length;
  const lines = total > MAX_SRC_LINES ? allLines.slice(0, MAX_SRC_LINES) : allLines;
  const pre = el('pre', 'nl-src');
  let out = '';
  for (let n = 0; n < lines.length; n++) {
    out += `<span class="nl-ln">${highlightLine(lines[n], esc)}</span>`;
    if (n < lines.length - 1) out += '\n';
  }
  pre.innerHTML = out;
  wrap.appendChild(pre);
  if (total > MAX_SRC_LINES) {
    wrap.appendChild(el('div', 'nl-note',
      `Source truncated: showing ${MAX_SRC_LINES.toLocaleString()} of ${total.toLocaleString()} lines.`));
  }
  return wrap;
}

function highlightLine(ln, esc) {
  const t = ln;
  const trimmed = t.trim();
  if (trimmed === '') return '';
  if (trimmed[0] === '*') return `<span class="hl-cmt">${esc(t)}</span>`;
  if (trimmed[0] === '+') return `<span class="hl-cont">${esc(t)}</span>`;
  if (trimmed[0] === '.') {
    // directive: leading whitespace + .word + rest
    const m = t.match(/^(\s*)(\.\S+)(.*)$/s);
    if (m) {
      return esc(m[1]) + `<span class="hl-dir">${esc(m[2])}</span>` + highlightInline(m[3], esc);
    }
  }
  // device card: leading ws + ref + rest
  const m = t.match(/^(\s*)(\S+)(.*)$/s);
  if (m) {
    return esc(m[1]) + `<span class="hl-ref">${esc(m[2])}</span>` + highlightInline(m[3], esc);
  }
  return esc(t);
}

// Inline highlighting for the body of a card: numbers/values, key=val, comments.
function highlightInline(s, esc) {
  let out = '';
  // split off trailing comment (';' or '$' begins an end-of-line comment)
  let comment = '';
  const cm = s.match(/(\s[;$].*)$/s);
  if (cm) { comment = cm[1]; s = s.slice(0, s.length - comment.length); }

  const tokens = s.split(/(\s+)/);
  for (const tk of tokens) {
    if (tk === '' ) continue;
    if (/^\s+$/.test(tk)) { out += esc(tk); continue; }
    if (tk.includes('=')) {
      const i = tk.indexOf('=');
      out += `<span class="hl-key">${esc(tk.slice(0, i))}</span>=<span class="hl-val">${esc(tk.slice(i + 1))}</span>`;
    } else if (/^[+-]?(\d|\.\d)/.test(tk)) {
      out += `<span class="hl-num">${esc(tk)}</span>`;
    } else {
      out += `<span class="hl-tok">${esc(tk)}</span>`;
    }
  }
  if (comment) out += `<span class="hl-cmt">${esc(comment)}</span>`;
  return out;
}

// ===========================================================================
// STYLE  (scoped; uses the discovery palette vars with safe fallbacks)
// ===========================================================================
function injectStyle(root, ctx) {
  const style = ctx.el('style', '');
  // Shared token contract: every value is var(--token,<fallback>) where the
  // fallback equals the live design-system value (renderer guidance is the
  // authoritative source for these). Chrome (panels/toolbars/borders/text/notes)
  // uses --sans; data/IDs/values/source stay --mono. Device-class accents and
  // the source highlighter map onto the canonical token palette (the .fv-code
  // role map: string=--up, number=--amber, keyword=--purple, key=--int) so no
  // off-palette hue ever leaks into the product.
  const SANS = `var(--sans,'Inter var','Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif)`;
  const MONO = `var(--mono,ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace)`;
  style.textContent = `
.nl-root{font:var(--fs-body,12px)/var(--lh-body,1.55) ${SANS};color:var(--ink,#cdd9e5);max-width:100%;font-variant-numeric:tabular-nums}
.nl-summary{margin-bottom:var(--space-4,16px)}
.nl-title{font:var(--w-semi,600) var(--fs-name,15px)/var(--lh-tight,1.25) ${SANS};letter-spacing:var(--tr-tight,-.01em);color:var(--amber,#f0a73a);margin-bottom:var(--space-2,8px)}
.nl-chips{display:flex;flex-wrap:wrap;gap:var(--space-1,4px);margin-bottom:var(--space-1,4px)}
.nl-chip{display:inline-flex;align-items:center;gap:5px;height:var(--chip-h,18px);background:var(--surface-raised,#0b121b);border:1px solid var(--line2,#233040);border-radius:var(--chip-radius,5px);padding:0 var(--chip-px,7px);font:var(--w-semi,600) var(--fs-meta,10px)/1 ${SANS};letter-spacing:var(--tr-caps,.06em);color:var(--dim,#90a0b2);text-transform:uppercase;white-space:nowrap}
.nl-chip b{font:var(--w-bold,700) var(--fs-meta,10px) ${MONO};color:var(--ink,#cdd9e5);font-variant-numeric:tabular-nums}
.nl-chips-soft .nl-chip{background:var(--surface-inset,#070b10);color:var(--mut,#7d8ea2)}
.nl-chips-soft .nl-chip b{color:var(--dim,#90a0b2)}
.nl-block{margin:var(--space-4,16px) 0;border:1px solid var(--line2,#233040);border-radius:var(--radius-lg,8px);overflow:hidden;background:var(--surface-inset,#070b10);box-shadow:var(--elev-1,0 1px 2px rgba(0,0,0,.30))}
.nl-block-h{font:var(--w-semi,600) var(--fs-label,11px) ${SANS};letter-spacing:var(--tr-caps,.06em);text-transform:uppercase;color:var(--mut,#7d8ea2);padding:var(--space-2,8px) var(--space-3,12px);border-bottom:1px solid var(--line2,#233040);background:var(--surface-raised,#0b121b)}
.nl-note{font:var(--fs-meta,10px)/var(--lh-snug,1.4) ${SANS};color:var(--mut,#7d8ea2);padding:var(--space-2,8px) var(--space-3,12px)}
.nl-warn{color:var(--amber,#f0a73a);background:var(--amber-weak,rgba(240,167,58,.07));border:1px solid var(--line2,#233040);border-left:2px solid var(--amber,#f0a73a);border-radius:var(--radius-md,6px);margin:var(--space-2,8px) 0;padding:var(--space-2,8px) var(--space-3,12px)}
/* graph toolbar — reuses the shared .fv-toolbar / .fv-btn language */
.nl-graph-bar{display:flex;align-items:center;gap:var(--space-1,4px);flex-wrap:wrap;padding:var(--space-2,8px) var(--space-3,12px);border-bottom:1px solid var(--line2,#233040);background:var(--surface-raised,#0b121b)}
.nl-graph-title{border:0;padding:0;background:none;margin-right:var(--space-1,4px)}
.nl-gbtn{display:inline-flex;align-items:center;justify-content:center;background:var(--surface-inset,#070b10);color:var(--dim,#90a0b2);border:1px solid var(--line2,#233040);border-radius:var(--radius-md,6px);font:var(--w-semi,600) var(--fs-label,11px) ${SANS};padding:0 var(--ctl-pad-x,10px);min-height:var(--ctl-h,30px);min-width:30px;cursor:pointer;transition:border-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),background var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.nl-gbtn:hover{border-color:var(--accent,#4c9ff0);color:var(--ink,#cdd9e5);background:var(--surface-hover,#0e1722)}
.nl-gbtn:active{transform:var(--press,translateY(.5px))}
.nl-gbtn:focus-visible{outline:none;border-color:var(--accent,#4c9ff0);box-shadow:0 0 0 3px var(--focus-ring,rgba(76,159,240,.20))}
.nl-ghint{margin-left:auto;font:var(--fs-meta,10px) ${SANS};color:var(--mut,#7d8ea2)}
/* table toolbar */
.nl-tbar{display:flex;align-items:center;gap:var(--space-2,8px);padding:var(--space-2,8px) var(--space-3,12px);border-bottom:1px solid var(--line2,#233040)}
.nl-filter{flex:1;min-width:0;background:var(--surface-inset,#070b10);color:var(--ink,#cdd9e5);border:1px solid var(--line2,#233040);border-radius:var(--radius-md,6px);font:var(--fs-body,12px) ${MONO};padding:0 var(--ctl-pad-x,10px);min-height:var(--ctl-h,30px);transition:border-color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1)),box-shadow var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.nl-filter::placeholder{color:var(--mut,#7d8ea2);opacity:1}
.nl-filter:hover{border-color:var(--line2,#233040)}
.nl-filter:focus{outline:none;border-color:var(--accent,#4c9ff0);box-shadow:0 0 0 3px var(--focus-ring,rgba(76,159,240,.20))}
.nl-count{font:var(--fs-meta,10px) ${SANS};color:var(--mut,#7d8ea2);white-space:nowrap;font-variant-numeric:tabular-nums}
.nl-sortable{cursor:pointer;user-select:none;transition:color var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.nl-sortable:hover{color:var(--ink,#cdd9e5)}
.nl-sortable[data-sort=asc]:after{content:' ▲';font-size:8px;color:var(--accent,#4c9ff0)}
.nl-sortable[data-sort=desc]:after{content:' ▼';font-size:8px;color:var(--accent,#4c9ff0)}
.nl-table{width:100%;border-collapse:collapse;font:var(--fs-body,12px) ${MONO};table-layout:auto;font-variant-numeric:tabular-nums}
.nl-table td,.nl-table th{word-break:break-word;overflow-wrap:anywhere}
.nl-table th{text-align:left;font:var(--w-semi,600) var(--fs-label,11px) ${SANS};letter-spacing:var(--tr-caps,.06em);text-transform:uppercase;color:var(--mut,#7d8ea2);padding:var(--space-1,4px) var(--space-3,12px);border-bottom:1px solid var(--line2,#233040);position:sticky;top:0;background:var(--surface-well2,#0b1118)}
.nl-table td{padding:var(--space-1,4px) var(--space-3,12px);border-bottom:1px solid var(--line,#1c2733);vertical-align:top}
.nl-table tr:last-child td{border-bottom:0}
.nl-table tbody tr{transition:background var(--dur-fast,120ms) var(--ease-out,cubic-bezier(.2,.8,.2,1))}
.nl-table tbody tr:hover td{background:var(--surface-hover,#0e1722)}
.nl-rl{text-align:right;white-space:nowrap}
.nl-ref{font-weight:var(--w-semi,600);color:var(--intr,#19c39a)}
.nl-val{color:var(--amber,#f0a73a)}
.nl-net{font-weight:var(--w-semi,600);color:var(--int,#4c9ff0)}
.nl-dim{color:var(--mut,#7d8ea2)}
.nl-pin,.nl-nodes .nl-pin,.nl-members .nl-pin{display:inline-block;background:var(--surface-raised,#0b121b);border:1px solid var(--line,#1c2733);border-radius:var(--radius-sm,4px);padding:0 5px;margin:1px 3px 1px 0;font:var(--fs-meta,10px) ${MONO};color:var(--dim,#90a0b2)}
.nl-pin-gnd{color:var(--mut,#7d8ea2);border-color:var(--line2,#233040)}
.nl-dir-list{padding:var(--space-2,8px) var(--space-3,12px)}
.nl-dir{padding:var(--space-0,2px) 0;font:var(--fs-body,12px) ${MONO}}
.nl-dir-k{color:var(--purple,#a081e0);font-weight:var(--w-semi,600)}
/* device-class accents — mapped onto the canonical token palette (no off-palette hue) */
.dev-R{color:var(--down,#f06a7e)}.dev-C{color:var(--intr,#19c39a)}.dev-L{color:var(--purple,#a081e0)}.dev-D{color:var(--amber,#f0a73a)}
.dev-Q,.dev-M,.dev-J,.dev-Z{color:var(--int,#4c9ff0)}.dev-V,.dev-I{color:var(--up,#21d07a)}.dev-X{color:var(--pink,#e86aa6)}
/* svg graph — clamp height so a tall deck doesn't dominate the drawer; the
   pan/zoom controls reach the rest. touch-action:none lets pointer drag work. */
.nl-svg{display:block;background:var(--well,#06090e);max-height:60vh;width:100%;touch-action:none}
.nl-edge{fill:none;stroke:var(--line2,#233040);stroke-width:var(--stroke-base,1.5px);opacity:.7}
.nl-edge-gnd{stroke:var(--line2,#233040);opacity:.45;stroke-dasharray:2 2}
.nl-node-net{fill:var(--int,#4c9ff0);stroke:var(--well,#06090e);stroke-width:1}
.nl-node-net.nl-gnd{fill:var(--mut,#7d8ea2)}
.nl-node-comp{fill:var(--intr,#19c39a)}
.nl-node-comp.dev-R{fill:var(--down,#f06a7e)}.nl-node-comp.dev-C{fill:var(--intr,#19c39a)}.nl-node-comp.dev-L{fill:var(--purple,#a081e0)}
.nl-node-comp.dev-D{fill:var(--amber,#f0a73a)}.nl-node-comp.dev-Q,.nl-node-comp.dev-M,.nl-node-comp.dev-J{fill:var(--int,#4c9ff0)}
.nl-node-comp.dev-V,.nl-node-comp.dev-I{fill:var(--up,#21d07a)}.nl-node-comp.dev-X{fill:var(--pink,#e86aa6)}
.nl-lbl{font:var(--fs-meta,10px) ${MONO};fill:var(--dim,#90a0b2)}
.nl-lbl-net{text-anchor:end}
.nl-lbl-comp{text-anchor:start}
.nl-col-h{font:var(--w-semi,600) var(--fs-meta,10px) ${SANS};letter-spacing:var(--tr-caps,.06em);fill:var(--mut,#7d8ea2)}
/* source — syntax roles on the canonical .fv-code map */
.nl-src{margin:0;padding:var(--space-2,8px) var(--space-3,12px);font:var(--fs-label,11px)/var(--lh-body,1.55) ${MONO};white-space:pre;overflow:auto;max-height:420px;color:var(--ink,#cdd9e5);font-feature-settings:'zero' 1}
.nl-ln{display:block}
.hl-cmt{color:var(--mut,#7d8ea2);font-style:italic}
.hl-cont{color:var(--mut,#7d8ea2)}
.hl-dir{color:var(--purple,#a081e0);font-weight:var(--w-semi,600)}
.hl-ref{color:var(--intr,#19c39a);font-weight:var(--w-semi,600)}
.hl-key{color:var(--int,#4c9ff0)}
.hl-val{color:var(--up,#21d07a)}
.hl-num{color:var(--amber,#f0a73a)}
.hl-tok{color:var(--ink,#cdd9e5)}
@media (prefers-reduced-motion:reduce){
  .nl-gbtn,.nl-filter,.nl-sortable,.nl-table tbody tr{transition-duration:.01ms!important}
}
`;
  root.appendChild(style);
}
