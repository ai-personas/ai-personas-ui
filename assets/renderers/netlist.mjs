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

  const raw = await ctx.fetchText();
  if (raw == null) throw new Error('netlist: body fetch returned null');
  if (typeof raw !== 'string') throw new Error('netlist: body is not text');
  if (!raw.trim()) throw new Error('netlist: empty body');

  // -- parse -----------------------------------------------------------------
  const parsed = parseNetlist(raw);
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
function parseNetlist(raw) {
  // SPICE line-continuation: a line beginning with '+' appends to the previous.
  const physical = raw.replace(/\r\n?/g, '\n').split('\n');
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

    if (trimmed[0] === '.') {
      const tok = trimmed.slice(1).split(/\s+/);
      const dir = (tok[0] || '').toLowerCase();
      if (dir === 'model') {
        models.push({ lineNo, name: tok[1] || '', type: tok[2] || '', text: trimmed });
      } else if (dir === 'subckt') {
        subckts++;
        directives.push({ lineNo, dir: '.' + dir, args: tok.slice(1).join(' '), text: trimmed });
      } else {
        directives.push({ lineNo, dir: '.' + dir, args: tok.slice(1).join(' '), text: trimmed });
      }
      continue;
    }

    // A device card: <ref> <nodes...> <params...>
    const tok = trimmed.split(/\s+/);
    const ref = tok[0];
    const letter = ref[0].toUpperCase();
    const klass = DEVICE[letter] || 'Device';

    // Decide how many leading tokens are nodes.
    let nNodes = pinCount(letter, tok);
    nNodes = Math.min(nNodes, tok.length - 1);
    const nodes = tok.slice(1, 1 + nNodes);
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
      lineNo, ref, letter, klass,
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

  return { title, components, nets, directives, models, comments, subckts, lineCount: lines.length };
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
  const head = el('div', 'nl-block-h', 'Topology');
  wrap.appendChild(head);

  const colN = nets.length, colC = comps.length;
  const rows = Math.max(colN, colC, 1);
  const ROW = 30, PADY = 24, LX = 150, RX = 470, W = 620;
  const H = PADY * 2 + (rows - 1) * ROW + 14;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'nl-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');

  const yN = {}, yC = {};
  nets.forEach((n, i) => { yN[n.name] = PADY + i * ROW; });
  comps.forEach((c, i) => { yC[c.ref] = PADY + i * ROW; });

  const mk = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };

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
  svg.appendChild(g);

  // net nodes (left)
  for (const n of nets) {
    const y = yN[n.name];
    const cls = isGround(n.name) ? 'nl-node-net nl-gnd' : 'nl-node-net';
    svg.appendChild(mk('circle', { cx: LX, cy: y, r: 4, class: cls }));
    const t = mk('text', { x: LX - 9, y: y + 3.5, class: 'nl-lbl nl-lbl-net' }, n.name);
    svg.appendChild(t);
  }
  // component nodes (right)
  for (const c of comps) {
    const y = yC[c.ref];
    svg.appendChild(mk('rect', { x: RX - 3.5, y: y - 3.5, width: 7, height: 7, rx: 1.5, class: 'nl-node-comp dev-' + c.letter }));
    const lbl = c.ref + (c.value ? '  ' + c.value : '');
    svg.appendChild(mk('text', { x: RX + 9, y: y + 3.5, class: 'nl-lbl nl-lbl-comp' }, lbl));
  }

  // column captions
  svg.appendChild(mk('text', { x: LX - 9, y: 12, class: 'nl-col-h', 'text-anchor': 'end' }, 'NETS'));
  svg.appendChild(mk('text', { x: RX + 9, y: 12, class: 'nl-col-h' }, 'COMPONENTS'));

  wrap.appendChild(svg);

  if (p.components.length > MAXC || p.nets.length > MAXN) {
    wrap.appendChild(el('div', 'nl-note',
      `Graph capped to ${comps.length} components / ${nets.length} nets ` +
      `(of ${p.components.length} / ${p.nets.length}). Full data in tables below.`));
  }
  return wrap;
}

// ===========================================================================
// TABLES
// ===========================================================================
function buildComponentsTable(p, ctx) {
  const { el, esc } = ctx;
  const wrap = el('div', 'nl-block');
  wrap.appendChild(el('div', 'nl-block-h', `Components (${p.components.length})`));
  const tbl = el('table', 'nl-table');
  tbl.innerHTML = `<thead><tr>
    <th>Ref</th><th>Type</th><th>Nodes</th><th>Value / Model</th><th class="nl-rl">Line</th>
  </tr></thead>`;
  const tb = el('tbody', '');
  for (const c of p.components) {
    const tr = el('tr', '');
    const nodes = c.nodes.map((n) =>
      `<span class="nl-pin${isGround(n) ? ' nl-pin-gnd' : ''}">${esc(n)}</span>`).join('');
    tr.innerHTML =
      `<td class="nl-ref dev-${esc(c.letter)}">${esc(c.ref)}</td>` +
      `<td>${esc(c.klass)}</td>` +
      `<td class="nl-nodes">${nodes || '<span class="nl-dim">—</span>'}</td>` +
      `<td class="nl-val">${c.value ? esc(c.value) : '<span class="nl-dim">—</span>'}</td>` +
      `<td class="nl-rl nl-dim">${c.lineNo}</td>`;
    tb.appendChild(tr);
  }
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  return wrap;
}

function buildNetsTable(p, ctx) {
  const { el, esc } = ctx;
  const wrap = el('div', 'nl-block');
  wrap.appendChild(el('div', 'nl-block-h', `Nets (${p.nets.length})`));
  const tbl = el('table', 'nl-table');
  tbl.innerHTML = `<thead><tr><th>Net</th><th class="nl-rl">Fan-out</th><th>Connected to</th></tr></thead>`;
  const tb = el('tbody', '');
  for (const n of p.nets) {
    const tr = el('tr', '');
    tr.innerHTML =
      `<td class="nl-net${isGround(n.name) ? ' nl-pin-gnd' : ''}">${esc(n.name)}</td>` +
      `<td class="nl-rl">${n.fanout}</td>` +
      `<td class="nl-members">${n.members.map((m) => `<span class="nl-pin">${esc(m)}</span>`).join('')}</td>`;
    tb.appendChild(tr);
  }
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  return wrap;
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
function buildSource(raw, p, ctx) {
  const { el, esc } = ctx;
  const wrap = el('div', 'nl-block');
  wrap.appendChild(el('div', 'nl-block-h', 'Source'));
  const pre = el('pre', 'nl-src');
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  let out = '';
  let n = 0;
  for (const ln of lines) {
    n++;
    out += `<span class="nl-ln">${highlightLine(ln, esc)}</span>`;
    if (n < lines.length) out += '\n';
  }
  pre.innerHTML = out;
  wrap.appendChild(pre);
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
  style.textContent = `
.nl-root{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--int,#cfe);max-width:100%}
.nl-summary{margin-bottom:14px}
.nl-title{font-size:13px;font-weight:600;color:var(--amber,#f0b429);margin-bottom:8px;font-family:ui-sans-serif,system-ui,sans-serif}
.nl-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.nl-chip{background:var(--surface-inset,#070b10);border:1px solid var(--line2,#1d2733);border-radius:4px;padding:2px 8px;font-size:11px;color:var(--int,#cfe)}
.nl-chip b{color:var(--intr,#21d07a)}
.nl-chips-soft .nl-chip{opacity:.85}
.nl-block{margin:16px 0;border:1px solid var(--line2,#1d2733);border-radius:6px;overflow:hidden;background:var(--code-bg,#070b10)}
.nl-block-h{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--amber,#f0b429);padding:7px 10px;border-bottom:1px solid var(--line2,#1d2733);background:rgba(255,255,255,.02);font-family:ui-sans-serif,system-ui,sans-serif}
.nl-note{font-size:10.5px;color:var(--l2,#7c8a99);padding:6px 10px}
.nl-table{width:100%;border-collapse:collapse;font-size:11px}
.nl-table th{text-align:left;font-weight:600;color:var(--l2,#7c8a99);padding:5px 10px;border-bottom:1px solid var(--line2,#1d2733);position:sticky;top:0;background:var(--code-bg,#070b10)}
.nl-table td{padding:4px 10px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
.nl-table tr:last-child td{border-bottom:0}
.nl-table tr:hover td{background:rgba(255,255,255,.025)}
.nl-rl{text-align:right;white-space:nowrap}
.nl-ref{font-weight:600;color:var(--intr,#21d07a)}
.nl-val{color:var(--amber,#f0b429)}
.nl-net{font-weight:600;color:var(--int,#cfe)}
.nl-dim{color:var(--l2,#7c8a99)}
.nl-pin,.nl-nodes .nl-pin,.nl-members .nl-pin{display:inline-block;background:var(--surface-inset,#070b10);border:1px solid var(--line2,#1d2733);border-radius:3px;padding:0 5px;margin:1px 3px 1px 0;font-size:10px;color:var(--int,#cfe)}
.nl-pin-gnd{color:#9aa7b3;border-color:#33414f}
.nl-dir-list{padding:6px 10px}
.nl-dir{padding:2px 0;font-size:11px}
.nl-dir-k{color:var(--amber,#f0b429);font-weight:600}
/* device colour accents */
.dev-R{color:#e06c75}.dev-C{color:#56b6c2}.dev-L{color:#c678dd}.dev-D{color:#e5c07b}
.dev-Q,.dev-M,.dev-J,.dev-Z{color:#61afef}.dev-V,.dev-I{color:#98c379}.dev-X{color:#d19a66}
/* svg graph */
.nl-svg{display:block;background:var(--code-bg,#070b10)}
.nl-edge{fill:none;stroke:var(--line2,#1d2733);stroke-width:1;opacity:.7}
.nl-edge-gnd{stroke:#33414f;opacity:.45;stroke-dasharray:2 2}
.nl-node-net{fill:var(--int,#cfe);stroke:var(--code-bg,#070b10);stroke-width:1}
.nl-node-net.nl-gnd{fill:#7c8a99}
.nl-node-comp{fill:var(--intr,#21d07a)}
.nl-node-comp.dev-R{fill:#e06c75}.nl-node-comp.dev-C{fill:#56b6c2}.nl-node-comp.dev-L{fill:#c678dd}
.nl-node-comp.dev-D{fill:#e5c07b}.nl-node-comp.dev-Q,.nl-node-comp.dev-M,.nl-node-comp.dev-J{fill:#61afef}
.nl-node-comp.dev-V,.nl-node-comp.dev-I{fill:#98c379}.nl-node-comp.dev-X{fill:#d19a66}
.nl-lbl{font:9.5px ui-monospace,Menlo,monospace;fill:var(--int,#cfe)}
.nl-lbl-net{text-anchor:end}
.nl-lbl-comp{text-anchor:start}
.nl-col-h{font:8.5px ui-sans-serif,system-ui,sans-serif;letter-spacing:.08em;fill:var(--l2,#7c8a99)}
/* source */
.nl-src{margin:0;padding:8px 10px;font:11px/1.55 ui-monospace,Menlo,Consolas,monospace;white-space:pre;overflow:auto;max-height:420px;color:var(--int,#cfe)}
.nl-ln{display:block}
.hl-cmt{color:var(--l2,#5b6773);font-style:italic}
.hl-cont{color:#7c8a99}
.hl-dir{color:var(--amber,#f0b429);font-weight:600}
.hl-ref{color:var(--intr,#21d07a);font-weight:600}
.hl-key{color:#61afef}
.hl-val{color:#e5c07b}
.hl-num{color:#d19a66}
.hl-tok{color:var(--int,#cfe)}
`;
  root.appendChild(style);
}
