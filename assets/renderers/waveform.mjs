// PersonaOS deliverable viewer — waveform renderer (lazy module)
// Family: waveform — digital timing diagrams.
//   * WaveJSON timing descriptions (.wavedrom .wave .json) -> rendered via WaveDrom.
//   * Value-Change-Dump (.vcd, IEEE 1364) -> hand-parsed into WaveJSON, then via WaveDrom.
// Lib: wavedrom@3.6.1 (MIT) loaded lazily from esm.sh inside render().
// Contract (see discovery.js): export `meta` + async `render(ctx)`. render() paints into
// ctx.host and THROWS on any fatal failure so the host app's own download/text fallback
// takes over — it must never leave a blank or broken pane. Domain-agnostic: render
// whatever bytes appear. Heavy lib loaded ONLY inside render() via ctx.lazy().

export const meta = {
  exts: ['vcd', 'wavedrom', 'wave', 'wavejson'],
  media_kinds: ['waveform', 'vcd', 'wavedrom', 'wavejson', 'timing'],
  fetchMode: 'text',
  label: 'Digital Waveform / Timing',
};

const WAVEDROM_ESM = 'https://esm.sh/wavedrom@3.6.1?bundle';

// --- size ceilings so a pathological file can't freeze / OOM the tab --------
// A real VCD can carry millions of value-change lines across thousands of nets.
// The cost of rendering is O(signals × distinct-timesteps): every signal gets a
// `wave` string spanning every timestep, then WaveDrom builds one SVG node per
// glyph. We therefore bound BOTH axes before the heavy parse/render and surface
// a visible "showing N of M" notice when a bound bites.
const MAX_SIGNALS    = 256;     // rows actually fed to WaveDrom
const MAX_SAMPLES    = 4000;    // distinct timesteps kept (the visible window)
const MAX_VCD_LINES  = 4_000_000; // hard stop on value-change scanning
const MAX_INPUT_CHARS = 24 * 1024 * 1024; // 24 MB of text — refuse larger

// ---------------------------------------------------------------------------
// WaveJSON parsing — accepts strict JSON, or the relaxed/JSON5-ish form that
// WaveDrom sources commonly use (unquoted keys, trailing commas, comments,
// single quotes). We tolerate as much as we safely can without eval().
// ---------------------------------------------------------------------------

function tryStrictJson(text) {
  try { return JSON.parse(text); } catch (_) { return undefined; }
}

function stripComments(text) {
  // Remove /* */ and // comments without touching string contents.
  let out = '';
  let i = 0;
  const n = text.length;
  let inStr = null; // quote char when inside a string
  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') { out += (c2 ?? ''); i += 2; continue; }
      if (c === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; out += c; i += 1; continue; }
    if (c === '/' && c2 === '/') { while (i < n && text[i] !== '\n') i += 1; continue; }
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function relaxedToJson(text) {
  // Convert a relaxed WaveJSON object literal into strict JSON.
  let s = stripComments(text);
  // Single-quoted strings -> double-quoted (escape any embedded double quotes).
  s = s.replace(/'(?:[^'\\]|\\.)*'/g, (m) => {
    const inner = m.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"');
    return '"' + inner + '"';
  });
  // Quote unquoted object keys:  { name: ... }  ->  { "name": ... }
  s = s.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
  // Remove trailing commas before } or ].
  s = s.replace(/,(\s*[}\]])/g, '$1');
  return s;
}

function parseWaveJson(text) {
  const direct = tryStrictJson(text);
  if (direct && typeof direct === 'object') return direct;

  // Some files wrap the object in an assignment / export, e.g.
  //   var x = { signal: [...] };   or   export default { signal: [...] }
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  let candidate = text;
  if (braceStart !== -1 && braceEnd > braceStart) {
    candidate = text.slice(braceStart, braceEnd + 1);
  }

  const relaxed = relaxedToJson(candidate);
  const parsed = tryStrictJson(relaxed);
  if (parsed && typeof parsed === 'object') return parsed;

  throw new Error('not parseable as WaveJSON (expected a { signal: [...] } object)');
}

function looksLikeWaveJson(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return Array.isArray(obj.signal) || Array.isArray(obj.assign) || ('reg' in obj) || ('config' in obj && Array.isArray(obj.signal));
}

// ---------------------------------------------------------------------------
// VCD (Value Change Dump, IEEE 1364) -> WaveJSON
// ---------------------------------------------------------------------------

function parseVcd(text) {
  const lines = text.split(/\r?\n/);
  const vars = new Map();   // id -> { name, scope, size }
  const order = [];         // id order as declared
  const scopeStack = [];
  const nameCounts = new Map(); // leaf name -> count (for scope-qualifying dupes)
  let timescale = '';
  let i = 0;
  const n = lines.length;
  let truncatedTime = false;

  // --- header / declarations ---
  for (; i < n; i++) {
    const ln = lines[i].trim();
    if (!ln) continue;

    if (ln.startsWith('$timescale')) {
      let m = ln.replace('$timescale', '').replace('$end', '').trim();
      if (!m && lines[i + 1]) m = lines[i + 1].trim().replace('$end', '').trim();
      if (m) timescale = m;
      continue;
    }
    if (ln.startsWith('$scope')) {
      const p = ln.split(/\s+/);
      // $scope <type> <name> $end — name is the token before $end (or p[2]).
      if (p[2] && p[2] !== '$end') scopeStack.push(p[2]);
      continue;
    }
    if (ln.startsWith('$upscope')) { scopeStack.pop(); continue; }
    if (ln.startsWith('$var')) {
      // $var <type> <size> <id> <reference> [bit-range] $end
      const p = ln.split(/\s+/);
      const endIdx = p.indexOf('$end');
      const size = parseInt(p[2], 10) || 1;
      const id = p[3];
      if (!id) continue;
      const refParts = p.slice(4, endIdx === -1 ? p.length : endIdx);
      const name = (refParts.join(' ').trim() || id);
      if (!vars.has(id)) {
        vars.set(id, { name, scope: scopeStack.join('.'), size });
        order.push(id);
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      }
      continue;
    }
    if (ln.startsWith('$enddefinitions')) { i += 1; break; }
  }

  // Same leaf reference appearing under several scopes is ambiguous — qualify
  // those (and only those) with their scope path so rows stay distinguishable.
  for (const v of vars.values()) {
    v.label = (nameCounts.get(v.name) > 1 && v.scope) ? (v.scope + '.' + v.name) : v.name;
  }

  // --- value changes ---
  const times = [];                 // unique, ascending simulation times
  const seenTime = new Set();
  const changes = new Map();        // id -> Map(time -> value string)
  for (const id of vars.keys()) changes.set(id, new Map());
  let t = 0;
  let atCap = false;                // stop recording new timesteps past the cap

  const record = (id, val) => {
    if (atCap && !seenTime.has(t)) return; // ignore changes at times we won't keep
    const cm = changes.get(id);
    if (cm) cm.set(t, val);
  };

  const scanned = Math.min(n, MAX_VCD_LINES + i);
  if (n > scanned) truncatedTime = true;
  for (; i < scanned; i++) {
    let ln = lines[i].trim();
    if (!ln) continue;
    if (ln[0] === '$') continue; // $dumpvars / $end / $comment etc.

    if (ln[0] === '#') {
      const nt = parseInt(ln.slice(1), 10);
      if (!Number.isNaN(nt)) {
        t = nt;
        if (!seenTime.has(t)) {
          if (times.length >= MAX_SAMPLES) { atCap = true; truncatedTime = true; }
          else { seenTime.add(t); times.push(t); }
        }
      }
      continue;
    }
    if (ln[0] === 'b' || ln[0] === 'B' || ln[0] === 'r' || ln[0] === 'R') {
      // vector / real:  b<value> <id>   or   r<value> <id>
      const sp = ln.slice(1).trim().split(/\s+/);
      const value = sp[0];
      const id = sp.slice(1).join('');
      if (id) record(id, value);
      continue;
    }
    // scalar:  <0|1|x|z><id>
    const v = ln[0];
    const id = ln.slice(1).trim();
    if (id) record(id, v);
  }

  times.sort((a, b) => a - b);
  return { timescale, vars, order, times, changes, truncatedTime };
}

function hexFromBinary(bits) {
  // Pure 0/1 binary string -> hex. Keeps x/z verbatim.
  if (!/^[01]+$/.test(bits)) return bits;
  // Group into hex; use BigInt for arbitrary width.
  try {
    return BigInt('0b' + bits).toString(16);
  } catch (_) {
    return bits;
  }
}

// Normalise a VCD bus token: pure-binary -> 0x… hex; an x/z-bearing token
// stays verbatim (so partial-unknown buses read as e.g. `1x0z`).
function busLabel(cur) {
  if (/^[01]+$/.test(cur)) return '0x' + hexFromBinary(cur);
  return cur;
}

function vcdToWaveJson(parsed, cappedOrder) {
  const { vars, times, changes, timescale } = parsed;
  const order = cappedOrder;
  const signal = [];

  if (times.length === 0) {
    // No timesteps recorded — still surface the declared signals as unknown.
    for (const id of order) {
      const v = vars.get(id);
      signal.push({ name: v.label || v.name, wave: 'x' });
    }
    const wj0 = { signal };
    if (timescale) wj0.head = { text: 'timescale ' + timescale };
    return wj0;
  }

  for (const id of order) {
    const v = vars.get(id);
    const cm = changes.get(id);
    let wave = '';
    const data = [];
    let last = null;

    for (const tm of times) {
      const has = cm.has(tm);
      const cur = has ? cm.get(tm) : null;

      if (cur === null) { wave += wave ? '.' : 'x'; continue; } // hold; lead-in unknown

      if (v.size === 1) {
        const c = cur.toLowerCase();
        let sym;
        if (c === '1') sym = '1';
        else if (c === '0') sym = '0';
        else if (c === 'z') sym = 'z';
        else sym = 'x';
        wave += (last !== null && sym === last) ? '.' : sym;
        last = sym;
      } else {
        // bus / vector
        const label = busLabel(cur);
        const token = '=' + label;
        if (last === token) {
          wave += '.';
        } else {
          wave += '=';
          data.push(label);
          last = token;
        }
      }
    }

    const name = (v.label || v.name) + (v.size > 1 ? `[${v.size - 1}:0]` : '');
    const sig = { name, wave: wave || 'x' };
    if (data.length) sig.data = data;
    signal.push(sig);
  }

  const wj = { signal };
  if (timescale) wj.head = { text: 'timescale ' + timescale };
  return wj;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function renderToSvgString(mod, waveJson) {
  // Primary path: renderAny -> ONML array -> onml.stringify (no DOM needed).
  const renderAny = mod.renderAny || (mod.default && mod.default.renderAny);
  const onml = mod.onml || (mod.default && mod.default.onml);
  const waveSkin = mod.waveSkin || (mod.default && mod.default.waveSkin) || {};

  if (typeof renderAny === 'function' && onml && typeof onml.stringify === 'function') {
    const tree = renderAny(0, waveJson, waveSkin);
    const svg = onml.stringify(tree);
    if (svg && svg.indexOf('<svg') !== -1) return svg;
  }

  // Fallback path: renderWaveForm needs the DOM but returns ONML too.
  const renderWaveForm = mod.renderWaveForm || (mod.default && mod.default.renderWaveForm);
  if (typeof renderWaveForm === 'function' && onml && typeof onml.stringify === 'function') {
    const tree = renderWaveForm(0, waveJson, '');
    const svg = onml.stringify(tree);
    if (svg && svg.indexOf('<svg') !== -1) return svg;
  }

  throw new Error('WaveDrom produced no SVG output for this description');
}

function buildSummary(ctx, waveJson, source, headerNote) {
  const wrap = ctx.el('div', 'wf-summary');
  // Dark, token-driven summary that coheres with the dashboard surfaces.
  // Mono is the right family here (it's signal data + raw wave strings).
  wrap.style.cssText =
    'margin-top:var(--space-3,12px);border:1px solid var(--line2,#233040);' +
    'border-radius:var(--radius-md,6px);background:var(--surface-inset,#070b10);' +
    'overflow:hidden;font:var(--fs-body,12px)/var(--lh-snug,1.4) var(--mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);' +
    'color:var(--dim,#90a0b2);font-variant-numeric:tabular-nums;';

  const signals = Array.isArray(waveJson.signal) ? flattenSignals(waveJson.signal) : [];
  const head = ctx.el('div', 'wf-summary-head',
    `${source} · ${signals.length} signal${signals.length === 1 ? '' : 's'}` + (headerNote ? ` · ${headerNote}` : ''));
  // Eyebrow strip header: raised band, uppercase caps, strong ink.
  head.style.cssText =
    'font-weight:var(--w-semi,600);padding:7px var(--space-3,12px);' +
    'background:var(--surface-raised,#0b121b);border-bottom:1px solid var(--line2,#233040);' +
    'color:var(--ink,#cdd9e5);font-size:var(--fs-label,11px);' +
    'letter-spacing:var(--tr-caps,.06em);text-transform:uppercase;';
  wrap.appendChild(head);

  if (signals.length) {
    const table = ctx.el('table', 'wf-summary-table');
    table.style.cssText = 'border-collapse:collapse;width:100%;';
    const thead = ctx.el('tr');
    for (const h of ['signal', 'transitions', 'wave']) {
      const th = ctx.el('th', null, h);
      th.style.cssText =
        'text-align:left;padding:5px var(--space-3,12px);' +
        'border-bottom:1px solid var(--line2,#233040);color:var(--mut,#7d8ea2);' +
        'font-weight:var(--w-semi,600);font-size:var(--fs-meta,10px);' +
        'letter-spacing:var(--tr-caps,.06em);text-transform:uppercase;';
      thead.appendChild(th);
    }
    table.appendChild(thead);

    const ROWS = 64;
    for (const s of signals.slice(0, ROWS)) {
      const tr = ctx.el('tr');
      const wave = typeof s.wave === 'string' ? s.wave : '';
      const transitions = wave ? wave.replace(/\./g, '').length : 0;
      const cells = [
        s.name || '(unnamed)',
        String(transitions),
        wave.length > 80 ? wave.slice(0, 77) + '…' : wave,
      ];
      cells.forEach((val, idx) => {
        const td = ctx.el('td', null, val);
        // value column (the raw wave string) reads as live data -> --up green.
        td.style.cssText =
          'padding:3px var(--space-3,12px);border-bottom:1px solid var(--line,#1c2733);' +
          (idx === 2
            ? 'white-space:pre;color:var(--up,#21d07a);'
            : (idx === 0
              ? 'word-break:break-all;color:var(--ink,#cdd9e5);'
              : 'color:var(--dim,#90a0b2);font-variant-numeric:tabular-nums;'));
        tr.appendChild(td);
      });
      table.appendChild(tr);
    }
    if (signals.length > ROWS) {
      const tr = ctx.el('tr');
      const td = ctx.el('td', null, `… and ${signals.length - ROWS} more`);
      td.setAttribute('colspan', '3');
      td.style.cssText = 'padding:5px var(--space-3,12px);color:var(--mut,#7d8ea2);';
      tr.appendChild(td);
      table.appendChild(tr);
    }
    wrap.appendChild(table);
  }
  return wrap;
}

function flattenSignals(arr, out, depth) {
  out = out || [];
  depth = depth || 0;
  if (depth > 64) return out; // guard against pathological nesting
  for (const item of arr) {
    if (Array.isArray(item)) {
      // group: [groupName?, ...signals]
      flattenSignals(item.filter((x) => typeof x === 'object' || Array.isArray(x)), out, depth + 1);
    } else if (item && typeof item === 'object') {
      if ('wave' in item || 'name' in item) out.push(item);
    }
  }
  return out;
}

// Count leaf signals in a (possibly grouped) WaveJSON signal array.
function countSignals(arr) {
  return flattenSignals(Array.isArray(arr) ? arr : []).length;
}

// Truncate a WaveJSON signal array to at most `cap` leaf signals, preserving
// group structure. Returns {signal, total}. Groups are kept whole until the
// cap is reached; nested groups recurse.
function capWaveJsonSignals(arr, cap) {
  const total = countSignals(arr);
  if (total <= cap) return { signal: arr, total };
  let budget = cap;
  const take = (items) => {
    const out = [];
    for (const item of items) {
      if (budget <= 0) break;
      if (Array.isArray(item)) {
        const inner = take(item.filter((x) => Array.isArray(x) || (x && typeof x === 'object' && ('wave' in x || 'name' in x))));
        const labels = item.filter((x) => typeof x === 'string');
        if (inner.length) out.push([...labels, ...inner]);
      } else if (item && typeof item === 'object' && ('wave' in item || 'name' in item)) {
        out.push(item); budget -= 1;
      } else {
        out.push(item); // config-ish entries pass through, don't count
      }
    }
    return out;
  };
  return { signal: take(arr), total };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function render(ctx) {
  const { host, el } = ctx;

  // Show a loading indicator immediately — the CDN import + parse can be slow.
  const loading = el('div', 'fv-loading', 'parsing waveform…');
  host.appendChild(loading);

  const text = await ctx.fetchText();
  if (text == null) throw new Error('waveform fetch failed');
  if (!text.trim()) throw new Error('empty waveform body');
  if (text.length > MAX_INPUT_CHARS) {
    throw new Error(`waveform too large to render in-browser (${(text.length / 1048576).toFixed(0)} MB) — use the download link`);
  }

  const title = (ctx.title || '').toLowerCase();
  const ext = (ctx.ext || '').toLowerCase();
  const kind = (ctx.kind || '').toLowerCase();
  const trimmed = text.trimStart();

  // Decide the input shape. Extension is authoritative; otherwise sniff content.
  const looksVcd =
    ext === 'vcd' ||
    title.endsWith('.vcd') ||
    kind === 'vcd' ||
    /\$enddefinitions\b/.test(text) ||
    (/\$timescale\b/.test(text) && /\$var\b/.test(text));

  let waveJson;     // the (capped) description fed to WaveDrom
  let fullSignal;   // the un-capped signal array (for the summary count)
  let source;
  const notes = []; // inline degraded-render notices (still render what we can)
  let headerNote = '';

  if (looksVcd) {
    const parsed = parseVcd(text);
    if (parsed.order.length === 0) throw new Error('VCD has no $var declarations — not a usable dump');

    const totalSignals = parsed.order.length;
    const cappedOrder = parsed.order.slice(0, MAX_SIGNALS);
    waveJson = vcdToWaveJson(parsed, cappedOrder);
    fullSignal = waveJson.signal;
    source = 'VCD';

    const bits = [];
    if (parsed.timescale) bits.push('timescale ' + parsed.timescale);
    if (parsed.times.length) bits.push(parsed.times.length + ' timesteps');
    headerNote = bits.join(' · ');

    if (totalSignals > MAX_SIGNALS) {
      notes.push(`showing ${MAX_SIGNALS} of ${totalSignals} signals`);
    }
    if (parsed.truncatedTime) {
      notes.push(`time window truncated to first ${parsed.times.length} steps`);
    }
  } else {
    const obj = parseWaveJson(trimmed);
    if (!looksLikeWaveJson(obj)) {
      throw new Error('not a recognizable WaveJSON timing description (no `signal`/`reg`/`assign`)');
    }
    source = 'WaveJSON';
    const totalSignals = countSignals(obj.signal);
    const { signal: capped } = capWaveJsonSignals(Array.isArray(obj.signal) ? obj.signal : [], MAX_SIGNALS);
    waveJson = { ...obj, signal: capped };
    fullSignal = Array.isArray(obj.signal) ? obj.signal : [];
    if (totalSignals > MAX_SIGNALS) {
      notes.push(`showing ${MAX_SIGNALS} of ${totalSignals} signals`);
    }
  }

  // Lazy-load the lib only now (slow CDN fetch). THROWS up to the host on
  // failure → the app's download/text fallback shows.
  loading.textContent = 'loading WaveDrom…';
  const mod = await ctx.lazy(WAVEDROM_ESM);
  if (!mod) throw new Error('WaveDrom failed to load');

  // Deep-clone the WaveJSON: WaveDrom mutates its input.
  let svg;
  try {
    const forRender = JSON.parse(JSON.stringify(waveJson));
    svg = renderToSvgString(mod, forRender);
  } catch (e) {
    // A malformed-but-parseable description (bad `data` length, exotic config…)
    // can make WaveDrom throw. That's a real, fatal render failure for this
    // module → rethrow so the host fallback shows the raw text.
    throw new Error('WaveDrom could not render this description: ' + (e && e.message || e));
  }

  // ---- Mount -------------------------------------------------------------
  host.innerHTML = ''; // clear the loading indicator

  const container = el('div', 'wf-root');
  container.style.cssText = 'width:100%;max-width:100%;padding:var(--space-1,4px) 0;box-sizing:border-box;';

  // Degraded-render notice (we still render what we can).
  if (notes.length) {
    const note = el('div', 'fv-note', notes.join(' · '));
    container.appendChild(note);
  }

  // WaveDrom emits black-on-transparent SVG; on the dark dashboard theme that
  // is illegible, so frame it on a light card. Keep the SVG at its NATURAL
  // width and scroll horizontally — shrinking a wide timing diagram to fit
  // would crush the detail. The card itself never exceeds the drawer width.
  const diagram = el('div', 'wf-diagram');
  // WaveDrom emits black-on-transparent SVG; a light card is the only legible
  // frame for it, so the #fff fill is deliberate. Everything AROUND the SVG —
  // border, radius, padding, depth — is tokenised so the card still reads as
  // part of the dark product (a framed plate, like a spec sheet).
  diagram.style.cssText =
    'overflow-x:auto;overflow-y:hidden;max-width:100%;-webkit-overflow-scrolling:touch;' +
    'background:#fff;border:1px solid var(--line2,#233040);' +
    'border-radius:var(--radius-md,6px);padding:var(--space-2,8px);box-sizing:border-box;' +
    'box-shadow:var(--elev-1,0 1px 2px rgba(0,0,0,.30));';
  // The svg string is WaveDrom output built from PEER-authored WaveJSON (signal
  // names, head/foot text, node labels); WaveDrom reflects that text into the SVG
  // without reliable escaping, so a crafted .wavedrom/.vcd can inject markup.
  // Sanitise via an inert XML document (mirrors gerber.mjs svgStringToNode): parse,
  // reject on parse error / no <svg> root (throw → host text/download fallback),
  // strip active/embedding elements and event/URL/style attributes, then adopt.
  const sdoc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (sdoc.getElementsByTagName('parsererror').length) {
    throw new Error('waveform: SVG parse error');
  }
  const sroot = sdoc.documentElement;
  if (!sroot || sroot.localName.toLowerCase() !== 'svg') {
    throw new Error('waveform: no <svg> root produced');
  }
  sroot.querySelectorAll('script,foreignObject,iframe,image,a').forEach((n) => n.remove());
  const walkSvg = (node) => {
    if (node.attributes) {
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'href' || name.endsWith(':href') || name === 'style') {
          node.removeAttribute(attr.name);
        }
      }
    }
    for (const child of Array.from(node.children || [])) walkSvg(child);
  };
  walkSvg(sroot);
  diagram.appendChild(document.importNode(sroot, true));

  const svgEl = diagram.querySelector('svg');
  if (svgEl) {
    // Let it keep its intrinsic width so it can scroll; cap height sanely.
    svgEl.style.height = 'auto';
    svgEl.style.maxWidth = 'none';
    svgEl.style.display = 'block';
  }

  container.appendChild(diagram);
  container.appendChild(buildSummary(ctx, { signal: fullSignal }, source, headerNote));

  host.appendChild(container);
}
