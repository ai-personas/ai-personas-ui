/* mdrich — Rich Markdown renderer for the PersonaOS deliverable viewer.
 *
 * Enhances plain markdown with:
 *   - marked      (md -> html)
 *   - mermaid     (```mermaid fenced blocks -> SVG diagrams: flowchart/sequence/etc)
 *   - katex       ($...$ / $$...$$ math -> rendered HTML)
 * All rendered output is sanitised (DOMPurify). Artifact bodies are REMOTE PEER
 * content, so every byte that reaches innerHTML passes through DOMPurify first;
 * mermaid SVG (generated client-side) is sanitised under the SVG profile before
 * insertion. KaTeX auto-render runs with throwOnError:false (degrades per-formula).
 *
 * LAZY: marked + DOMPurify always (markdown is the base format); mermaid loads
 * ONLY when a ```mermaid block is present, KaTeX ONLY when $-math syntax is
 * present — so a plain prose doc pulls neither heavy lib.
 *
 * Contract: self-contained module, libs lazy-loaded ONLY inside render() via
 * ctx.lazy(); FAIL-SOFT — hard failures THROW so the app shows its plain-text
 * fallback; per-diagram / per-formula failures degrade in place (show source).
 *
 * Licenses (all permissive): marked MIT, DOMPurify (Apache-2.0 OR MPL-2.0),
 * mermaid MIT, KaTeX MIT.
 */

export const meta = {
  exts: ['md', 'markdown'],
  media_kinds: ['md', 'markdown'],
  fetchMode: 'text',
  label: 'Rich Markdown',
};

// Pinned CDN ESM libs (esm.sh, version-pinned). Imported lazily in render().
const URL_MARKED    = 'https://esm.sh/marked@12.0.2';
const URL_DOMPURIFY = 'https://esm.sh/dompurify@3.1.6';
const URL_MERMAID   = 'https://esm.sh/mermaid@11.4.1';
const URL_KATEX     = 'https://esm.sh/katex@0.16.11';
const URL_KATEX_AR  = 'https://esm.sh/katex@0.16.11/contrib/auto-render';
const URL_KATEX_CSS = 'https://esm.sh/katex@0.16.11/dist/katex.min.css';

// Guardrails so a pathological body can't freeze the drawer tab. Markdown is
// cheap per-byte, but marked + DOMPurify + KaTeX auto-render over a multi-MB
// doc can lock the main thread; cap the bytes we parse and the diagram count.
const MAX_CHARS   = 600 * 1024;  // ~600 KB of markdown parsed (rest truncated, noted)
const MAX_DIAGRAMS = 40;          // mermaid.render is expensive; excess -> source

// ---- scoped styling (token-coherent, injected once per host root) -----------
// mdrich emits three classes the host stylesheet leaves un-themed (.fv-mdrich,
// .fv-mermaid, .fv-mermaid-fallback) plus a light-themed mermaid SVG (mermaid
// computes its palette in JS, not from CSS vars). We inject one id-guarded
// <style> that authors every value as var(--token, <correct-fallback>) — the
// fallbacks MATCH the live design-system token values so this never becomes a
// second palette — to make the rendered markdown + diagrams read as one product
// with the dashboard. The base .fv-md / .fv-loading / .fv-note chrome already
// lives in discovery.css; these rules only fill the orphan surfaces and harden
// the mermaid SVG onto the dark substrate. Scope honours an enclosing shadow
// root the same way the sibling renderers (table/datatree) do.
const STYLE_ID = 'mdrich-style';
const CSS = `
.fv-mdrich{
  font-family:var(--sans,'Inter var','Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);
}
.fv-mdrich code,.fv-mdrich pre,.fv-mdrich kbd,.fv-mdrich samp{
  font-family:var(--mono,ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace);
  font-variant-numeric:tabular-nums slashed-zero;
}
.fv-mdrich h1,.fv-mdrich h2,.fv-mdrich h3,.fv-mdrich h4,.fv-mdrich h5,.fv-mdrich h6{
  color:var(--amber,#f0a73a);font-weight:var(--w-bold,700);letter-spacing:var(--tr-tight,-.01em);
  line-height:var(--lh-tight,1.25);text-wrap:balance;margin:var(--space-3,12px) 0 var(--space-1,4px);
}
.fv-mdrich h1{font-size:var(--fs-name,15px)}
.fv-mdrich h2{font-size:var(--fs-h,16px)}
.fv-mdrich h3{font-size:var(--fs-ui,13px)}
.fv-mdrich h4,.fv-mdrich h5,.fv-mdrich h6{font-size:var(--fs-body,12px)}
.fv-mdrich p,.fv-mdrich li{line-height:var(--lh-body,1.55);text-wrap:pretty}
.fv-mdrich a{color:var(--int,#4c9ff0);text-decoration:none}
.fv-mdrich a:hover{text-decoration:underline}
.fv-mdrich strong,.fv-mdrich b{color:var(--off-white,#eaf1f8);font-weight:var(--w-semi,600)}
.fv-mdrich code{
  background:var(--surface-raised,#0b121b);border:1px solid var(--line,#1c2733);
  border-radius:var(--radius-sm,4px);padding:0 var(--space-1,4px);
  font-size:var(--fs-body,12px);color:var(--intr,#19c39a);
}
.fv-mdrich pre{
  background:var(--surface-inset,#070b10);border:1px solid var(--line2,#233040);
  border-radius:var(--radius-md,6px);padding:var(--space-2,8px) var(--space-3,12px);
  font-size:var(--fs-body,12px);color:var(--ink,#cdd9e5);overflow:auto;overscroll-behavior:contain;
}
.fv-mdrich pre code{background:none;border:none;padding:0;color:inherit}
.fv-mdrich blockquote{
  border-left:var(--stroke-bold,2px) solid var(--line2,#233040);
  margin:var(--space-2,8px) 0;padding:var(--space-0,2px) 0 var(--space-0,2px) var(--space-3,12px);
  color:var(--dim,#90a0b2);
}
.fv-mdrich hr{border:none;border-top:1px solid var(--line2,#233040);margin:var(--space-3,12px) 0}
.fv-mdrich table{border-collapse:collapse;margin:var(--space-2,8px) 0;font-size:var(--fs-body,12px)}
.fv-mdrich thead th{
  background:var(--surface-well2,#0b1118);color:var(--mut,#7d8ea2);
  font-weight:var(--w-semi,600);letter-spacing:var(--tr-caps,.06em);
}
.fv-mdrich th,.fv-mdrich td{border:1px solid var(--line2,#233040);padding:var(--space-1,4px) var(--space-2,8px);text-align:left}
.fv-mdrich td{font-variant-numeric:tabular-nums}
.fv-mdrich img{max-width:100%;height:auto;border-radius:var(--radius-md,6px)}
.fv-mdrich ul,.fv-mdrich ol{margin:var(--space-1,4px) 0 var(--space-1,4px) var(--space-5,20px);padding:0}

/* mermaid figure — sit the (neutral-themed) SVG on the dark substrate so it
   reads as part of the dashboard, never a pasted-in light card. */
.fv-mermaid{
  margin:var(--space-3,12px) 0;padding:var(--space-3,12px);
  background:var(--surface-inset,#070b10);border:1px solid var(--line2,#233040);
  border-radius:var(--radius-lg,8px);overflow:auto;overscroll-behavior:contain;text-align:center;
}
.fv-mermaid svg{max-width:100%;height:auto;font-family:var(--sans,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif)!important}

/* per-diagram graceful fallback (source shown) — reuses the .fv-note callout
   chrome and the inset code well so a bad diagram looks intentional. */
.fv-mermaid-fallback{
  margin:var(--space-3,12px) 0;padding:var(--space-2,8px) var(--space-3,12px);
  background:var(--surface-inset,#070b10);
  border:1px solid var(--line2,#233040);border-left:var(--stroke-bold,2px) solid var(--amber,#f0a73a);
  border-radius:var(--radius-md,6px);
}
.fv-mermaid-fallback .fv-note{margin:0 0 var(--space-1,4px);color:var(--amber,#f0a73a)}
.fv-mermaid-fallback pre{
  margin:0;background:var(--surface-inset,#070b10);border:1px solid var(--line,#1c2733);
  border-radius:var(--radius-sm,4px);padding:var(--space-2,8px) var(--space-3,12px);
  font:var(--fs-body,12px)/var(--lh-snug,1.4) var(--mono,ui-monospace,Menlo,Consolas,monospace);
  color:var(--ink,#cdd9e5);overflow:auto;white-space:pre-wrap;word-break:break-word;
}
`;

// mermaid theme overrides — mermaid resolves its palette to concrete colors in
// JS at render() time (it cannot read CSS vars), so these MUST be literals that
// equal the design-system token values; the CSS above provides the durable
// token-driven layer, this keeps mermaid's computed defaults on-palette.
const MERMAID_THEME_VARS = {
  darkMode: true,
  background: '#070b10',            // --surface-inset
  primaryColor: '#0b121b',          // --surface-raised (node fill)
  primaryBorderColor: '#233040',    // --line2
  primaryTextColor: '#cdd9e5',      // --ink
  secondaryColor: '#0f1620',        // --panel
  secondaryBorderColor: '#1c2733',  // --line
  secondaryTextColor: '#cdd9e5',    // --ink
  tertiaryColor: '#0d131c',         // --bg2
  tertiaryBorderColor: '#233040',   // --line2
  tertiaryTextColor: '#cdd9e5',     // --ink
  lineColor: '#7d8ea2',             // --mut (edges legible on dark)
  textColor: '#cdd9e5',             // --ink
  mainBkg: '#0b121b',               // --surface-raised
  nodeBorder: '#233040',            // --line2
  clusterBkg: '#0d131c',            // --bg2
  clusterBorder: '#1c2733',         // --line
  edgeLabelBackground: '#070b10',   // --surface-inset
  titleColor: '#f0a73a',            // --amber
  noteBkgColor: '#0b1118',          // --surface-well2
  noteBorderColor: '#233040',       // --line2
  noteTextColor: '#cdd9e5',         // --ink
  fontFamily: "var(--sans,'Inter var','Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif)",
};

// Inject the scoped stylesheet once per host root (idempotent; shadow-aware).
function ensureStyle(host, doc, el) {
  try {
    const root = host.getRootNode ? host.getRootNode() : doc;
    const scope = (root && root.nodeType === 11) ? root : (doc.head || doc.documentElement);
    if (!scope || (scope.querySelector && scope.querySelector('#' + STYLE_ID))) return;
    const style = (typeof el === 'function') ? el('style', null) : doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    scope.appendChild(style);
  } catch (_e) { /* styling is cosmetic — never block render on it */ }
}

// Inject KaTeX stylesheet once per page (idempotent). KaTeX needs its CSS for
// correct glyph metrics; without it formulas render but mis-spaced.
function ensureKatexCss(doc) {
  try {
    const id = 'mdrich-katex-css';
    if (doc.getElementById(id)) return;
    const link = doc.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = URL_KATEX_CSS;
    link.crossOrigin = 'anonymous';
    (doc.head || doc.documentElement).appendChild(link);
  } catch (_e) { /* css is cosmetic — never block render on it */ }
}

// Stable, collision-resistant placeholder token for extracted mermaid blocks.
function ph(i) { return ' MDRICH_MERMAID_' + i + ' '; }

// Detect whether KaTeX-style math is even present, so we don't import the lib
// (and its CSS) for a doc with none. Cheap pre-scan; over-matching only costs a
// no-op auto-render pass, never a wrong render.
function hasMath(s) {
  return /\$[^$]/.test(s) || s.indexOf('\\(') !== -1 || s.indexOf('\\[') !== -1;
}

export async function render(ctx) {
  const { host, esc, el } = ctx;
  const doc = host.ownerDocument || document;

  // Teardown guard: discovery.js runs view cleanups before painting the next
  // view. If the user switches files mid-flight, `disposed` short-circuits any
  // late CDN import / heavy parse so we never write into a recycled host.
  let disposed = false;
  if (typeof ctx.onCleanup === 'function') {
    try { ctx.onCleanup(() => { disposed = true; }); } catch (_e) { /* non-fatal */ }
  }
  const live = () => !disposed && host.isConnected !== false;

  // Inject the scoped, token-coherent stylesheet up front so the loading note,
  // mounted markdown, and any mermaid figures all paint on-palette from frame 1.
  ensureStyle(host, doc, el);

  // Visible progress note before the slow CDN imports + heavy parse resolve, so
  // the drawer never sits blank. Reused/updated through the pipeline.
  host.innerHTML = '';
  const loading = el('div', 'fv-loading', 'loading markdown renderer…');
  host.appendChild(loading);
  const say = (msg) => { if (loading.isConnected) loading.textContent = msg; };

  // ---- 1. fetch body (THROW on failure -> app falls back) ----
  let src;
  try {
    src = await ctx.fetchText();
  } catch (e) {
    throw new Error('mdrich: body fetch failed: ' + (e && e.message || e));
  }
  if (src == null) throw new Error('mdrich: empty/unavailable body');
  src = String(src);
  if (!live()) return; // view torn down during fetch

  // ---- 1b. large-file guard: truncate before parsing, note what's hidden ----
  let truncatedBy = 0;
  if (src.length > MAX_CHARS) {
    truncatedBy = src.length - MAX_CHARS;
    // cut on a line boundary near the cap so we don't split a fence/heading
    let cut = src.lastIndexOf('\n', MAX_CHARS);
    if (cut < MAX_CHARS * 0.5) cut = MAX_CHARS; // no nearby newline — hard cut
    src = src.slice(0, cut);
  }

  // ---- 2. load core libs lazily (THROW on failure -> app falls back) ----
  say('loading markdown renderer…');
  let markedMod, puriMod;
  try {
    [markedMod, puriMod] = await Promise.all([
      ctx.lazy(URL_MARKED),
      ctx.lazy(URL_DOMPURIFY),
    ]);
  } catch (e) {
    throw new Error('mdrich: core libs failed to load: ' + (e && e.message || e));
  }
  if (!live()) return;
  const marked = markedMod.marked || markedMod.parse || markedMod.default || markedMod;
  const DOMPurify = puriMod.default || puriMod;
  if (!DOMPurify || typeof DOMPurify.sanitize !== 'function') {
    throw new Error('mdrich: DOMPurify unavailable');
  }

  // ---- 3. extract ```mermaid fenced blocks BEFORE markdown parsing ----
  // marked would HTML-escape the diagram source into a <pre>; we pull each block
  // out, leave a placeholder paragraph, and render the SVGs after sanitisation.
  const diagrams = [];
  const fence = /^[ \t]*```[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*$/gim;
  const staged = src.replace(fence, (_m, code) => {
    const i = diagrams.length;
    diagrams.push(code);
    // placeholder on its own paragraph so marked wraps it predictably
    return '\n\n' + ph(i) + '\n\n';
  });

  // ---- 4. md -> html (THROW on parse failure -> app falls back) ----
  say('parsing markdown…');
  let raw;
  try {
    raw = (typeof marked === 'function')
      ? marked(staged, { breaks: true })
      : marked.parse(staged, { breaks: true });
    if (raw && typeof raw.then === 'function') raw = await raw;
  } catch (e) {
    throw new Error('mdrich: markdown parse failed: ' + (e && e.message || e));
  }
  if (!live()) return;

  // ---- 5. sanitise EVERY rendered byte ----
  let clean;
  try {
    clean = DOMPurify.sanitize(String(raw), {
      FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'object', 'embed', 'link', 'meta', 'base'],
      FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover', 'srcset'],
      ADD_ATTR: ['target', 'rel'],
    });
  } catch (e) {
    throw new Error('mdrich: sanitise failed: ' + (e && e.message || e));
  }

  // mount sanitised markdown
  host.innerHTML = '';
  const md = el('div', 'fv-md fv-mdrich');
  md.innerHTML = clean; // clean is DOMPurify output
  // harden links: open externally, strip referrer/opener
  md.querySelectorAll('a[href]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  host.appendChild(md);

  // truncation notice (after mount so a huge doc still shows what we kept)
  if (truncatedBy > 0) {
    const kb = (n) => Math.round(n / 1024);
    host.appendChild(el('div', 'fv-note',
      'large file — showing first ' + kb(src.length) + ' KB of ' +
      kb(src.length + truncatedBy) + ' KB. Use the download link above for the full document.'));
  }

  // ---- 6. render mermaid diagrams into their placeholders ----
  // Per-diagram failures degrade in place (show the source) — they do NOT throw
  // the whole render, since a single bad diagram shouldn't lose the document.
  if (diagrams.length) {
    say('rendering ' + diagrams.length + ' diagram' + (diagrams.length === 1 ? '' : 's') + '…');
    let mermaid = null;
    try {
      const mod = await ctx.lazy(URL_MERMAID);
      mermaid = mod.default || mod.mermaid || mod;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict', // mermaid sanitises labels; we re-sanitise SVG too
        theme: 'base',           // 'base' honours themeVariables -> our token palette
        themeVariables: MERMAID_THEME_VARS,
        fontFamily: 'inherit',
      });
    } catch (_e) { mermaid = null; }
    if (!live()) return;

    // Find placeholder text nodes / paragraphs and replace each with its diagram.
    for (let i = 0; i < diagrams.length; i++) {
      if (!live()) return;
      const token = ph(i);
      const holder = findPlaceholder(md, token);
      const code = diagrams[i];
      if (!holder) continue;

      // Cap how many diagrams we actually rasterise; the rest show their source
      // so a doc with hundreds of charts can't lock the tab.
      if (i >= MAX_DIAGRAMS) {
        holder.replaceWith(mermaidFallback(doc, code, el, esc, 'diagram cap reached (' + MAX_DIAGRAMS + ')'));
        continue;
      }
      if (!mermaid) { holder.replaceWith(mermaidFallback(doc, code, el, esc, 'mermaid unavailable')); continue; }

      let svg = null;
      const id = 'mdrich-mmd-' + Date.now().toString(36) + '-' + i;
      try {
        const out = await mermaid.render(id, code);
        svg = (out && out.svg) ? out.svg : (typeof out === 'string' ? out : null);
      } catch (_e) { svg = null; }
      finally {
        // mermaid renders into transient DOM nodes; remove any it left behind
        // (id may be prefixed 'd' for the wrapper) so the document doesn't leak.
        const orphan = doc.getElementById('d' + id) || doc.getElementById(id);
        if (orphan && orphan.parentNode) orphan.parentNode.removeChild(orphan);
      }
      if (!live()) return;

      if (!svg) { holder.replaceWith(mermaidFallback(doc, code, el, esc, 'diagram render failed')); continue; }

      // sanitise the generated SVG (peer-derived text drove it) before insertion.
      let cleanSvg;
      try {
        cleanSvg = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ['foreignObject'],
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
        });
      } catch (_e) { cleanSvg = null; }

      if (!cleanSvg) { holder.replaceWith(mermaidFallback(doc, code, el, esc, 'diagram sanitise failed')); continue; }

      const fig = el('figure', 'fv-mermaid');
      fig.innerHTML = cleanSvg; // sanitised SVG
      makeSvgResponsive(fig);   // fit the 360px-wide drawer, no fixed huge widths
      holder.replaceWith(fig);
    }
  }

  // ---- 7. typeset math with KaTeX (auto-render over the mounted DOM) ----
  // Per-formula failures degrade (throwOnError:false leaves the source visible).
  // Skip entirely when no math syntax is present so we don't pull KaTeX (+ its
  // CSS) for a plain-prose doc. The input cap above already bounds the DOM the
  // auto-render pass walks.
  if (live() && hasMath(src)) {
    say('typesetting math…');
    try {
      ensureKatexCss(doc);
      const [, arMod] = await Promise.all([ctx.lazy(URL_KATEX), ctx.lazy(URL_KATEX_AR)]);
      if (!live()) return;
      const renderMathInElement = arMod.default || arMod.renderMathInElement || arMod;
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(md, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
          ],
          throwOnError: false,
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        });
      }
    } catch (_e) { /* math is an enhancement; never lose the rendered doc over it */ }
  }

  // remove the loading note if anything left it dangling (normal path already
  // cleared host before mount, but guard the early-return / no-mount edges)
  if (loading.isConnected) loading.remove();
}

// Locate the element whose text content is exactly the placeholder token. marked
// wraps a lone placeholder in <p>…</p>; we replace that <p>. Falls back to a
// TreeWalker scan if the structure differs. NEVER returns the root itself (a
// replaceWith on it would wipe the whole document).
function findPlaceholder(root, token) {
  const ps = root.querySelectorAll('p');
  for (const p of ps) { if (p.textContent.trim() === token) return p; }
  const tok = token.trim();
  const doc = root.ownerDocument || document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeValue && n.nodeValue.indexOf(tok) !== -1) {
      const parent = n.parentElement;
      // only replace a real descendant element — never the mount root, and never
      // a node already detached from it.
      if (parent && parent !== root && root.contains(parent)) return parent;
      return null;
    }
  }
  return null;
}

// Strip fixed pixel dimensions from a mermaid SVG so it scales to the drawer
// width (down to a 360px-wide mobile drawer) instead of overflowing. We set
// width/height as presentation ATTRIBUTES (DOMPurify keeps these; it strips the
// `style` attribute) and preserve the viewBox so aspect ratio is retained.
function makeSvgResponsive(fig) {
  try {
    const svg = fig.querySelector('svg');
    if (!svg) return;
    // mermaid emits a viewBox; if absent, synthesise one from the numeric w/h so
    // removing the pixel width doesn't collapse the diagram.
    if (!svg.getAttribute('viewBox')) {
      const w = parseFloat(svg.getAttribute('width'));
      const h = parseFloat(svg.getAttribute('height'));
      if (w > 0 && h > 0) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    }
    svg.setAttribute('width', '100%');
    svg.removeAttribute('height');           // let height follow viewBox aspect
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.removeAttribute('style');            // belt-and-braces: drop fixed max-width
  } catch (_e) { /* responsive sizing is cosmetic — never block on it */ }
}

// Graceful per-diagram fallback: show the mermaid source as a labelled code block.
function mermaidFallback(doc, code, el, esc, why) {
  const wrap = el('div', 'fv-mermaid-fallback');
  wrap.appendChild(el('div', 'fv-note', 'mermaid diagram — ' + why + ' (source shown)'));
  const pre = el('pre', 'filview');
  const c = doc.createElement('code');
  c.textContent = String(code); // textContent — safe
  pre.appendChild(c);
  wrap.appendChild(pre);
  return wrap;
}
