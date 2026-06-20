// PersonaOS deliverable viewer — waveform renderer
// Family: waveform — digital timing diagrams.
//   * WaveJSON timing descriptions (.wavedrom .wave .json) -> rendered via WaveDrom.
//   * Value-Change-Dump (.vcd) -> hand-parsed into WaveJSON, then rendered via WaveDrom.
// Lib: wavedrom@3.6.1 (MIT) loaded lazily from esm.sh inside render().
// Contract: lazy-load only inside render(); self-contained; FAIL-SOFT by THROWING so the
// app shows its own download/text fallback. Domain-agnostic: render whatever bytes appear.

export const meta = {
  exts: ['vcd', 'wavedrom', 'wave', 'wavejson'],
  media_kinds: ['waveform', 'vcd', 'wavedrom', 'wavejson', 'timing'],
  fetchMode: 'text',
  label: 'Digital Waveform / Timing',
};

const WAVEDROM_ESM = 'https://esm.sh/wavedrom@3.6.1?bundle';

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

  throw new Error('not parseable as WaveJSON');
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
  const vars = new Map();   // id -> { name, size }
  const order = [];         // id order as declared
  const scopeStack = [];
  let timescale = '';
  let i = 0;
  const n = lines.length;

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
      if (p[2]) scopeStack.push(p[2]);
      continue;
    }
    if (ln.startsWith('$upscope')) { scopeStack.pop(); continue; }
    if (ln.startsWith('$var')) {
      // $var <type> <size> <id> <reference> [bit-range] $end
      const p = ln.split(/\s+/);
      const endIdx = p.indexOf('$end');
      const size = parseInt(p[2], 10) || 1;
      const id = p[3];
      const refParts = p.slice(4, endIdx === -1 ? p.length : endIdx);
      let name = refParts.join(' ').trim() || id;
      if (!vars.has(id)) {
        vars.set(id, { name, size });
        order.push(id);
      }
      continue;
    }
    if (ln.startsWith('$enddefinitions')) { i += 1; break; }
  }

  // --- value changes ---
  const times = [];                 // unique, ascending simulation times
  const seenTime = new Set();
  const changes = new Map();        // id -> Map(time -> value string)
  for (const id of vars.keys()) changes.set(id, new Map());
  let t = 0;

  const record = (id, val) => {
    const cm = changes.get(id);
    if (cm) cm.set(t, val);
  };

  for (; i < n; i++) {
    let ln = lines[i].trim();
    if (!ln) continue;
    if (ln[0] === '$') continue; // $dumpvars / $end / $comment etc.

    if (ln[0] === '#') {
      const nt = parseInt(ln.slice(1), 10);
      if (!Number.isNaN(nt)) {
        t = nt;
        if (!seenTime.has(t)) { seenTime.add(t); times.push(t); }
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
  return { timescale, vars, order, times, changes };
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

function vcdToWaveJson(parsed) {
  const { vars, order, times, changes, timescale } = parsed;
  const signal = [];

  if (times.length === 0) {
    // No timesteps recorded — still surface the declared signals.
    for (const id of order) {
      const v = vars.get(id);
      signal.push({ name: v.name, wave: 'x' });
    }
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

      if (cur === null) { wave += '.'; continue; }

      if (v.size === 1) {
        let sym;
        const c = cur.toLowerCase();
        if (c === '1') sym = '1';
        else if (c === '0') sym = '0';
        else if (c === 'z') sym = 'z';
        else sym = 'x';
        wave += (last !== null && sym === last) ? '.' : sym;
        last = sym;
      } else {
        // bus / vector
        let label;
        if (/^[01]+$/.test(cur)) label = '0x' + hexFromBinary(cur);
        else label = cur; // x / z / partial-unknown
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

    const sig = { name: v.name + (v.size > 1 ? `[${v.size - 1}:0]` : ''), wave: wave || 'x' };
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

  throw new Error('WaveDrom produced no SVG output');
}

function buildSummary(ctx, waveJson, source, headerNote) {
  const wrap = ctx.el('div', 'wf-summary');
  wrap.style.cssText = 'margin-top:12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#444;';

  const signals = Array.isArray(waveJson.signal) ? flattenSignals(waveJson.signal) : [];
  const head = ctx.el('div', 'wf-summary-head',
    `${source} · ${signals.length} signal${signals.length === 1 ? '' : 's'}` + (headerNote ? ` · ${headerNote}` : ''));
  head.style.cssText = 'font-weight:600;margin-bottom:6px;color:#222;';
  wrap.appendChild(head);

  if (signals.length) {
    const table = ctx.el('table', 'wf-summary-table');
    table.style.cssText = 'border-collapse:collapse;width:100%;max-width:640px;';
    const thead = ctx.el('tr');
    for (const h of ['signal', 'transitions', 'wave']) {
      const th = ctx.el('th', null, h);
      th.style.cssText = 'text-align:left;padding:2px 8px;border-bottom:1px solid #ddd;color:#666;font-weight:600;';
      thead.appendChild(th);
    }
    table.appendChild(thead);

    for (const s of signals.slice(0, 64)) {
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
        td.style.cssText = 'padding:2px 8px;border-bottom:1px solid #f0f0f0;' +
          (idx === 2 ? 'white-space:pre;color:#0a7;' : '');
        tr.appendChild(td);
      });
      table.appendChild(tr);
    }
    wrap.appendChild(table);
  }
  return wrap;
}

function flattenSignals(arr, out) {
  out = out || [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      // group: [groupName?, ...signals]
      flattenSignals(item.filter((x) => typeof x === 'object' || Array.isArray(x)), out);
    } else if (item && typeof item === 'object') {
      if ('wave' in item || 'name' in item) out.push(item);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function render(ctx) {
  const text = await ctx.fetchText();
  if (!text || !text.trim()) throw new Error('empty waveform body');

  const title = (ctx.title || '').toLowerCase();
  const kind = (ctx.kind || '').toLowerCase();
  const trimmed = text.trimStart();

  // Decide the input shape.
  const looksVcd =
    title.endsWith('.vcd') ||
    kind === 'vcd' ||
    /\$enddefinitions\b/.test(text) ||
    (/\$timescale\b/.test(text) && /\$var\b/.test(text));

  let waveJson;
  let source;
  let headerNote = '';

  if (looksVcd) {
    const parsed = parseVcd(text);
    if (parsed.order.length === 0) throw new Error('VCD has no $var declarations');
    waveJson = vcdToWaveJson(parsed);
    source = 'VCD';
    if (parsed.timescale) headerNote = 'timescale ' + parsed.timescale;
    if (parsed.times.length) headerNote += (headerNote ? ' · ' : '') + parsed.times.length + ' timesteps';
  } else {
    const obj = parseWaveJson(trimmed);
    if (!looksLikeWaveJson(obj)) throw new Error('not a recognizable WaveJSON timing description');
    waveJson = obj;
    source = 'WaveJSON';
  }

  // Lazy-load the lib only now.
  const mod = await ctx.lazy(WAVEDROM_ESM);

  // Deep-clone the WaveJSON: WaveDrom mutates its input.
  const forRender = JSON.parse(JSON.stringify(waveJson));
  const svg = renderToSvgString(mod, forRender);

  // Mount.
  const container = ctx.el('div', 'wf-root');
  container.style.cssText = 'width:100%;overflow:auto;padding:8px 0;';

  const diagram = ctx.el('div', 'wf-diagram');
  diagram.style.cssText = 'overflow:auto;max-width:100%;';
  // svg is a complete, self-contained <svg> string produced by WaveDrom/onml.
  diagram.innerHTML = svg;

  const svgEl = diagram.querySelector('svg');
  if (svgEl) {
    svgEl.style.maxWidth = '100%';
    svgEl.style.height = 'auto';
  }

  container.appendChild(diagram);
  container.appendChild(buildSummary(ctx, waveJson, source, headerNote));

  ctx.host.appendChild(container);
}
