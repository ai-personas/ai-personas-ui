/* ====================================================================
   PersonaOS deliverable viewer — GERBER family renderer (lazy module)
   --------------------------------------------------------------------
   Renders PCB fabrication Gerber layers (RS-274X) and Excellon NC drill
   files as an SVG board image, using the tracespace `gerber-to-svg`
   library (MIT). Each artifact body is a SINGLE layer file, so we render
   that one layer to SVG and present it on a board-coloured backdrop with
   a small descriptor bar (guessed layer type, real-world size, units).

   CONTRACT: see the renderer module contract — `meta` + async `render(ctx)`.
   Lib is imported ONLY inside render() via ctx.lazy(). All risky work is
   wrapped and we THROW on any failure so the app's download/text fallback
   takes over (never a blank or broken pane).

   SECURITY: the SVG string is produced by gerber-to-svg's own serializer
   (geometry → path/mask elements, no remote scripting), but the source
   bytes are untrusted peer content, so before mounting we parse the SVG
   in an inert XML document and strip <script>, <foreignObject>, and any
   event-handler (on...) / href / xlink href URL vectors before adopting it.
   ==================================================================== */

export const meta = {
  exts: ['gbr', 'ger', 'gtl', 'gbl', 'gto', 'gts', 'gko', 'gm1', 'drl', 'xln'],
  media_kinds: ['gerber', 'excellon', 'drill', 'pcb', 'gerber-layer'],
  fetchMode: 'text',
  label: 'PCB Gerber',
};

// esm.sh serves gerber-to-svg@4.2.8 (MIT) as an ESM wrapper with its node
// stream / process deps polyfilled for the browser. Version pinned.
const LIB = 'https://esm.sh/gerber-to-svg@4.2.8';

// Best-effort human label for a layer, keyed off the file extension. Pure
// presentation — never affects rendering; unknown extensions stay generic.
const LAYER_BY_EXT = {
  gtl: 'Top copper',
  gbl: 'Bottom copper',
  gto: 'Top silkscreen',
  gbo: 'Bottom silkscreen',
  gts: 'Top solder mask',
  gbs: 'Bottom solder mask',
  gko: 'Board outline / keep-out',
  gm1: 'Mechanical 1',
  gbr: 'Gerber layer',
  ger: 'Gerber layer',
  drl: 'Excellon drill',
  xln: 'Excellon drill',
};

function extOf(title) {
  const m = String(title || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

// Sanitise a serialized SVG string into a live, inert SVG node. Parses as
// XML (no script execution), drops dangerous elements/attributes, then
// imports the cleaned root into the host document.
function svgStringToNode(svgText) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('gerber: SVG parse error');
  }
  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== 'svg') {
    throw new Error('gerber: no <svg> root produced');
  }
  // Strip active/embedding content.
  root.querySelectorAll('script,foreignObject,iframe,image,a').forEach((n) => n.remove());
  // Strip event handlers and any URL-bearing attributes.
  const walk = (node) => {
    if (node.attributes) {
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'href' || name.endsWith(':href') || name === 'style') {
          node.removeAttribute(attr.name);
        }
      }
    }
    for (const child of Array.from(node.children || [])) walk(child);
  };
  walk(root);
  return document.importNode(root, true);
}

// gerber-to-svg's callback form buffers its internal stream and hands back
// the finished SVG string; the converter object also carries real-world
// width/height/units/viewBox. Promisify it.
function convert(gerberToSvg, source, id) {
  return new Promise((resolve, reject) => {
    let converter;
    try {
      converter = gerberToSvg(source, { id }, (err, svg) => {
        if (err) return reject(err);
        if (!svg || typeof svg !== 'string') return reject(new Error('gerber: empty SVG output'));
        resolve({ svg, converter });
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function render(ctx) {
  const { host, el, esc } = ctx;

  // 1) Source bytes (text format).
  const source = await ctx.fetchText();
  if (!source || !source.trim()) throw new Error('gerber: empty source file');

  // 2) Lazy-load the converter (THROWS up to the app on CDN failure).
  const loading = el('div', 'fv-loading', 'loading PCB Gerber renderer…');
  host.appendChild(loading);
  const mod = await ctx.lazy(LIB);
  const gerberToSvg = mod && (mod.default || mod);
  if (typeof gerberToSvg !== 'function') throw new Error('gerber: library export not callable');

  // 3) Convert this single layer to SVG. A stable, collision-free id keeps
  //    SVG mask/def ids unique if several layers share a page.
  const id = 'gbr-' + Math.random().toString(36).slice(2, 10);
  const { svg, converter } = await convert(gerberToSvg, source, id);

  // 4) Sanitise + adopt the SVG node.
  const node = svgStringToNode(svg);
  // Geometry is emitted as currentColor (dark = exposed copper/ink); make it
  // legible on a board-coloured backdrop. Scale to fit the drawer width.
  node.setAttribute('width', '100%');
  node.removeAttribute('height');
  node.style.maxWidth = '100%';
  node.style.height = 'auto';
  node.style.display = 'block';

  // 5) Mount: descriptor bar + framed board image.
  host.innerHTML = '';

  const ext = ctx.ext || extOf(ctx.title);
  const layerLabel = LAYER_BY_EXT[ext] || (ext ? '.' + ext + ' layer' : 'PCB layer');
  const units = converter && converter.units ? converter.units : '';
  const w = converter && typeof converter.width === 'number' ? converter.width : null;
  const h = converter && typeof converter.height === 'number' ? converter.height : null;

  const bar = el('div', 'fv-note');
  let dim = '';
  if (w != null && h != null && units) {
    dim = ` · ${(+w).toFixed(2)} × ${(+h).toFixed(2)} ${esc(units)}`;
  }
  bar.textContent = `${layerLabel}${dim}`;
  host.appendChild(bar);

  const frame = el('div', 'fv-gerber');
  // Board backdrop + exposed-feature colour. Inline on the wrapper only
  // (our own trusted styles — the untrusted SVG had its style attrs stripped).
  frame.style.background = '#0b3d2e';   // soldermask-green board field
  frame.style.color = '#f0c14b';        // gold-ish exposed copper / ink
  frame.style.padding = '12px';
  frame.style.borderRadius = '6px';
  frame.style.overflow = 'auto';
  frame.appendChild(node);
  host.appendChild(frame);
}
