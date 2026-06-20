/* datatree.mjs — PersonaOS deliverable viewer renderer
 * FAMILY: structured data (.json .yaml .yml .toml .ndjson)
 * Renders a collapsible, syntax-highlighted tree of the parsed value.
 *   - JSON  : parsed natively (JSON.parse)
 *   - YAML  : parsed via `yaml` (ISC) lazy-loaded from esm.sh
 *   - TOML  : parsed via `smol-toml` (BSD-3-Clause) lazy-loaded from esm.sh
 *   - NDJSON: each non-empty line parsed as JSON → array of records
 * Domain-agnostic: renders whatever structured bytes arrive. No project/intent
 * assumptions. Self-contained: the only third-party code is lazy-loaded INSIDE
 * render() via ctx.lazy(). Fails soft by THROWING so the app's own download/
 * plain-text fallback takes over.
 */

export const meta = {
  exts: ['json', 'yaml', 'yml', 'toml', 'ndjson'],
  media_kinds: ['json', 'yaml', 'yml', 'toml', 'ndjson', 'datatree', 'structured', 'data'],
  fetchMode: 'text',
  label: 'Structured data',
};

// Pinned, permissively-licensed ESM libs (loaded lazily, only when needed).
const YAML_CDN = 'https://esm.sh/yaml@2.9.0';        // ISC
const TOML_CDN = 'https://esm.sh/smol-toml@1.6.1';   // BSD-3-Clause

// ---- value-type classification ----------------------------------------------
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'object') return 'object';
  return t; // string | number | boolean | bigint | undefined | function | symbol
}
function isContainer(v) {
  const t = typeOf(v);
  return t === 'object' || t === 'array';
}
function entriesOf(v) {
  // returns [{key, value}] for objects/arrays in a stable, displayable order
  if (Array.isArray(v)) return v.map((val, i) => ({ key: i, value: val, isIndex: true }));
  return Object.keys(v).map((k) => ({ key: k, value: v[k], isIndex: false }));
}
function childCount(v) {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return Object.keys(v).length;
  return 0;
}

// ---- parsing ----------------------------------------------------------------
function detectFormat(ctx) {
  const ext = String(ctx.ext || extFromTitle(ctx.title) || '').toLowerCase();
  if (ext) return ext;
  const k = String(ctx.kind || '').toLowerCase();
  if (k === 'yaml' || k === 'yml') return 'yaml';
  if (k === 'toml') return 'toml';
  if (k === 'ndjson') return 'ndjson';
  if (k === 'json') return 'json';
  return ''; // unknown → caller sniffs
}
function extFromTitle(title) {
  const m = String(title || '').toLowerCase().match(/\.([a-z0-9]+)\s*$/);
  return m ? m[1] : '';
}

function parseNdjson(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    rows.push(JSON.parse(line)); // THROW on a bad line → fail soft
  }
  return rows;
}

// Best-effort sniff when the format is unknown: try JSON, then NDJSON.
function sniffParse(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('empty body');
  if (trimmed[0] === '{' || trimmed[0] === '[') {
    try { return { value: JSON.parse(trimmed), fmt: 'json' }; } catch (_) { /* fall through */ }
  }
  // NDJSON: multiple JSON values, one per line
  if (/\n/.test(trimmed)) {
    const rows = parseNdjson(trimmed);
    if (rows.length) return { value: rows, fmt: 'ndjson' };
  }
  // single JSON scalar/value
  return { value: JSON.parse(trimmed), fmt: 'json' };
}

async function parseByFormat(ctx, text, fmt) {
  switch (fmt) {
    case 'json':
      return { value: JSON.parse(text), fmt };
    case 'ndjson':
      return { value: parseNdjson(text), fmt };
    case 'yaml':
    case 'yml': {
      const mod = await ctx.lazy(YAML_CDN);
      const YAML = mod.default && mod.default.parse ? mod.default : mod;
      if (typeof YAML.parse !== 'function') throw new Error('yaml lib missing parse()');
      return { value: YAML.parse(text), fmt: 'yaml' };
    }
    case 'toml': {
      const mod = await ctx.lazy(TOML_CDN);
      const TOML = mod.default && mod.default.parse ? mod.default : mod;
      if (typeof TOML.parse !== 'function') throw new Error('toml lib missing parse()');
      return { value: TOML.parse(text), fmt: 'toml' };
    }
    default:
      return sniffParse(text);
  }
}

// ---- styling (scoped, injected once per host) -------------------------------
const STYLE_ID = 'datatree-style';
const CSS = `
.dt-root{font:12.5px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#c8d2dc;
  padding:8px 10px;overflow:auto;max-width:100%;word-break:break-word;-webkit-text-size-adjust:100%}
.dt-bar{display:flex;gap:8px;align-items:center;margin:0 0 8px;flex-wrap:wrap;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px}
.dt-bar .dt-fmt{padding:2px 7px;border-radius:10px;background:#1d2733;color:#7fb2e0;
  border:1px solid #2c3947;letter-spacing:.04em;text-transform:uppercase;font-size:10.5px}
.dt-bar .dt-meta{color:#6b7a8a}
.dt-bar button{font:inherit;cursor:pointer;background:#1b2531;color:#aab8c6;
  border:1px solid #2c3947;border-radius:5px;padding:2px 9px}
.dt-bar button:hover{background:#243140;color:#dce6ef}
.dt-tree{list-style:none;margin:0;padding:0}
.dt-tree ul{list-style:none;margin:0;padding:0 0 0 16px;
  border-left:1px solid #232f3b}
.dt-node{margin:0;padding:0}
.dt-row{display:flex;align-items:flex-start;gap:0;padding:1px 0;border-radius:4px;
  position:relative}
.dt-row:hover{background:#161e27}
.dt-tw{flex:0 0 auto;width:14px;text-align:center;cursor:pointer;color:#5c7186;
  user-select:none;transition:transform .12s ease;line-height:1.55}
.dt-tw.dt-leaf{cursor:default;color:transparent}
.dt-node.dt-collapsed > .dt-row .dt-tw{transform:rotate(-90deg)}
.dt-node.dt-collapsed > ul{display:none}
.dt-key{color:#9ad0ff;white-space:pre}
.dt-idx{color:#6b7a8a;white-space:pre}
.dt-colon{color:#6b7a8a;white-space:pre}
.dt-v-string{color:#9ee493}
.dt-v-number{color:#f0b86c}
.dt-v-bigint{color:#f0b86c}
.dt-v-boolean{color:#d99bff}
.dt-v-null{color:#7a8896;font-style:italic}
.dt-v-undefined{color:#7a8896;font-style:italic}
.dt-v-date{color:#7fd4cf}
.dt-summary{color:#6b7a8a;white-space:pre}
.dt-count{color:#52606d;margin-left:6px;font-size:11px}
.dt-copy{flex:0 0 auto;margin-left:8px;opacity:0;cursor:pointer;border:0;background:none;
  color:#5c7186;font:inherit;padding:0 4px;border-radius:4px;transition:opacity .1s}
.dt-row:hover .dt-copy{opacity:1}
.dt-copy:hover{color:#9ad0ff;background:#1d2733}
.dt-copy.dt-ok{color:#9ee493}
.dt-empty{color:#6b7a8a;font-style:italic;padding:8px 2px}
`;

function ensureStyle(host) {
  const doc = host.ownerDocument || document;
  const root = host.getRootNode ? host.getRootNode() : doc;
  const scope = root && root.nodeType === 11 ? root : doc.head || doc.documentElement;
  if (scope.querySelector && scope.querySelector('#' + STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  scope.appendChild(style);
}

// ---- scalar formatting ------------------------------------------------------
function formatScalar(v, t) {
  if (t === 'string') return JSON.stringify(v); // quoted + escaped, safe display text
  if (t === 'null') return 'null';
  if (t === 'undefined') return 'undefined';
  if (t === 'bigint') return String(v) + 'n';
  if (t === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (t === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// ---- clipboard (best-effort, never throws to caller) ------------------------
function copyText(doc, text) {
  try {
    if (doc.defaultView && doc.defaultView.navigator && doc.defaultView.navigator.clipboard) {
      doc.defaultView.navigator.clipboard.writeText(text).catch(() => fallbackCopy(doc, text));
      return true;
    }
  } catch (_) { /* fall through */ }
  return fallbackCopy(doc, text);
}
function fallbackCopy(doc, text) {
  try {
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    (doc.body || doc.documentElement).appendChild(ta);
    ta.select();
    const ok = doc.execCommand && doc.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch (_) { return false; }
}

function pathToString(path) {
  // dotted/bracketed path: root -> "" ; ["a", 0, "b c"] -> a[0]["b c"]
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += '[' + seg + ']';
    else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(seg)) out += (out ? '.' : '') + seg;
    else out += '[' + JSON.stringify(seg) + ']';
  }
  return out || '$';
}

// ---- tree construction ------------------------------------------------------
// Builds one <li> node. `keyLabel`/`isIndex` describe how this node was reached
// from its parent (null for root). `path` is the full key path for copy-path.
function buildNode(ctx, value, keyLabel, isIndex, path, depth) {
  const doc = ctx.host.ownerDocument || document;
  const li = doc.createElement('li');
  li.className = 'dt-node';

  const row = doc.createElement('div');
  row.className = 'dt-row';

  const container = isContainer(value);
  const t = typeOf(value);

  // twisty
  const tw = doc.createElement('span');
  tw.className = 'dt-tw' + (container && childCount(value) ? '' : ' dt-leaf');
  tw.textContent = container && childCount(value) ? '▾' : '·'; // ▾ / ·
  row.appendChild(tw);

  // key / index label
  if (keyLabel !== null) {
    const keyEl = doc.createElement('span');
    keyEl.className = isIndex ? 'dt-idx' : 'dt-key';
    keyEl.textContent = isIndex ? String(keyLabel) : String(keyLabel);
    row.appendChild(keyEl);
    const colon = doc.createElement('span');
    colon.className = 'dt-colon';
    colon.textContent = ': ';
    row.appendChild(colon);
  }

  if (container) {
    const n = childCount(value);
    const summary = doc.createElement('span');
    summary.className = 'dt-summary';
    summary.textContent = Array.isArray(value) ? '[' + (n ? '' : ']') : '{' + (n ? '' : '}');
    row.appendChild(summary);
    if (n) {
      const cnt = doc.createElement('span');
      cnt.className = 'dt-count';
      cnt.textContent = Array.isArray(value)
        ? n + (n === 1 ? ' item' : ' items')
        : n + (n === 1 ? ' key' : ' keys');
      row.appendChild(cnt);
    }
  } else {
    const valEl = doc.createElement('span');
    valEl.className = 'dt-v-' + (value instanceof Date ? 'date' : t);
    valEl.textContent = formatScalar(value, t);
    row.appendChild(valEl);
  }

  // copy-path button
  const copy = doc.createElement('button');
  copy.className = 'dt-copy';
  copy.type = 'button';
  copy.title = 'Copy path';
  copy.textContent = 'copy path';
  copy.addEventListener('click', (e) => {
    e.stopPropagation();
    const ok = copyText(doc, pathToString(path));
    if (ok) {
      const prev = copy.textContent;
      copy.textContent = 'copied';
      copy.classList.add('dt-ok');
      setTimeout(() => { copy.textContent = prev; copy.classList.remove('dt-ok'); }, 1100);
    }
  });
  row.appendChild(copy);

  li.appendChild(row);

  if (container && childCount(value)) {
    const ul = doc.createElement('ul');
    // lazy child build: only materialize children when first expanded (keeps
    // huge documents responsive). Root + shallow levels are eager.
    let built = false;
    const buildChildren = () => {
      if (built) return;
      built = true;
      for (const { key, value: cv, isIndex: ci } of entriesOf(value)) {
        ul.appendChild(buildNode(ctx, cv, key, ci, path.concat([key]), depth + 1));
      }
    };
    li.appendChild(ul);

    // collapse deep levels by default to keep the initial view tidy.
    const startCollapsed = depth >= 2;
    if (startCollapsed) li.classList.add('dt-collapsed');
    else buildChildren();

    const toggle = () => {
      const willOpen = li.classList.contains('dt-collapsed');
      if (willOpen) buildChildren();
      li.classList.toggle('dt-collapsed');
    };
    tw.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    // clicking the summary/key area also toggles (but not the copy button)
    row.addEventListener('click', (e) => {
      if (e.target === copy) return;
      toggle();
    });
    row.style.cursor = 'pointer';
  }

  return li;
}

// ---- main render ------------------------------------------------------------
export async function render(ctx) {
  if (!ctx || !ctx.host) throw new Error('datatree: no host');
  const host = ctx.host;
  const doc = host.ownerDocument || document;

  // 1) fetch text body (THROW on failure → app fallback)
  let text;
  if (typeof ctx.fetchText === 'function') text = await ctx.fetchText();
  if (text == null) throw new Error('datatree: empty body');

  // perf guard for pathologically large bodies — let the app's plain-text
  // renderer handle multi-MB blobs instead of building a giant DOM tree.
  if (text.length > 4 * 1024 * 1024) {
    throw new Error('datatree: body > 4 MB — falling back to plain text');
  }

  // 2) parse by detected format (THROW on parse failure → app fallback)
  const fmt = detectFormat(ctx);
  const parsed = await parseByFormat(ctx, text, fmt);
  const value = parsed.value;

  // 3) build the UI
  ensureStyle(host);
  host.textContent = '';

  const rootEl = doc.createElement('div');
  rootEl.className = 'dt-root';

  // toolbar
  const bar = doc.createElement('div');
  bar.className = 'dt-bar';
  const fmtBadge = doc.createElement('span');
  fmtBadge.className = 'dt-fmt';
  fmtBadge.textContent = parsed.fmt;
  bar.appendChild(fmtBadge);

  const meta = doc.createElement('span');
  meta.className = 'dt-meta';
  const top = isContainer(value) ? childCount(value) : 1;
  if (isContainer(value)) {
    meta.textContent = (Array.isArray(value) ? top + (top === 1 ? ' item' : ' items')
      : top + (top === 1 ? ' key' : ' keys'));
  } else {
    meta.textContent = typeOf(value) + ' value';
  }
  bar.appendChild(meta);

  const expandAll = doc.createElement('button');
  expandAll.type = 'button';
  expandAll.textContent = 'expand all';
  const collapseAll = doc.createElement('button');
  collapseAll.type = 'button';
  collapseAll.textContent = 'collapse all';
  bar.appendChild(expandAll);
  bar.appendChild(collapseAll);
  rootEl.appendChild(bar);

  // tree
  const treeUl = doc.createElement('ul');
  treeUl.className = 'dt-tree';
  rootEl.appendChild(treeUl);

  if (isContainer(value) && childCount(value) === 0) {
    const empty = doc.createElement('div');
    empty.className = 'dt-empty';
    empty.textContent = Array.isArray(value) ? '(empty array)' : '(empty object)';
    rootEl.appendChild(empty);
  } else {
    treeUl.appendChild(buildNode(ctx, value, null, false, [], 0));
  }

  // expand/collapse all operate on already-materialized nodes; expanding a node
  // triggers its lazy child build via the click handler, so dispatch clicks on
  // collapsed twisties to force materialization top-down.
  expandAll.addEventListener('click', () => {
    // repeatedly open any collapsed node until none remain (handles lazy builds)
    for (let pass = 0; pass < 64; pass++) {
      const collapsed = treeUl.querySelectorAll('.dt-node.dt-collapsed');
      if (!collapsed.length) break;
      collapsed.forEach((n) => {
        const tw = n.querySelector(':scope > .dt-row > .dt-tw');
        if (tw) tw.click();
      });
    }
  });
  collapseAll.addEventListener('click', () => {
    treeUl.querySelectorAll('.dt-node').forEach((n) => {
      if (n.querySelector(':scope > ul')) n.classList.add('dt-collapsed');
    });
  });

  host.appendChild(rootEl);
}
