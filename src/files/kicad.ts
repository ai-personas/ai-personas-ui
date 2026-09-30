import { DrawingBuilder, arcPoints, throughArc, finite, type Drawing, type Point } from './engineering.ts';
export type SExpr = (string | SExpr)[];
/** Iterative tokenizer with explicit nesting/node budgets; never evaluates input. */
export function parseSExpr(text: string): SExpr {
  const roots: SExpr = [], stack: SExpr[] = [roots]; let count = 0;
  for (let i = 0; i < text.length;) {
    const char = text[i];
    if (/\s/.test(char)) { i++; continue; }
    if (char === ';') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (++count > 250_000) throw new Error('KiCad token limit exceeded.');
    if (char === '(') { if (stack.length > 64) throw new Error('KiCad nesting limit exceeded.'); const node: SExpr = []; stack.at(-1)!.push(node); stack.push(node); i++; }
    else if (char === ')') { if (stack.length === 1) throw new Error('Unbalanced KiCad expression.'); stack.pop(); i++; }
    else {
      let value = '';
      if (char === '"') {
        i++; let closed = false;
        while (i < text.length) {
          const next = text[i++];
          if (next === '"') { closed = true; break; }
          if (next === '\\') { if (i >= text.length) break; const escaped = text[i++]; value += escaped === 'n' ? '\n' : escaped === 'r' ? '\r' : escaped === 't' ? '\t' : escaped; }
          else value += next;
        }
        if (!closed) throw new Error('Unclosed KiCad string.');
      } else { const start = i; while (i < text.length && !/[\s();"]/.test(text[i])) i++; value = text.slice(start, i); }
      stack.at(-1)!.push(value);
    }
  }
  if (stack.length !== 1 || roots.length !== 1 || !Array.isArray(roots[0])) throw new Error('Truncated or invalid KiCad document.');
  return roots[0];
}
const children = (node: SExpr, tag?: string): SExpr[] => node.filter((item): item is SExpr => Array.isArray(item) && (!tag || item[0] === tag));
const child = (node: SExpr, tag: string) => children(node, tag)[0];
const atom = (node: SExpr | undefined, index = 1, fallback = '') => typeof node?.[index] === 'string' ? node[index] as string : fallback;
const number = (node: SExpr | undefined, index = 1, fallback?: number) => node?.[index] === undefined && fallback !== undefined ? fallback : finite(node?.[index]);
const point = (node: SExpr | undefined): Point => [number(node, 1), number(node, 2), 0];
type Transform = (p: Point) => Point;
const identity: Transform = p => p;
function transform(at: Point, angle: number): Transform {
  const radians = -angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  return p => [at[0] + p[0] * c - p[1] * s, at[1] + p[0] * s + p[1] * c, 0];
}
function rectangle(a: Point, b: Point): Point[] { return [a, [b[0], a[1], 0], b, [a[0], b[1], 0]]; }
export function parseKicad(text: string, format: 'pcb' | 'footprint' | 'schematic'): Drawing {
  const root = parseSExpr(text), expected = { pcb: 'kicad_pcb', footprint: 'footprint', schematic: 'kicad_sch' }[format];
  if (root[0] !== expected) throw new Error(`Expected a modern ${expected} document. Legacy formats need re-saving in KiCad.`);
  const out = new DrawingBuilder(); out.drawing.units = 'mm'; out.drawing.yDown = true;
  out.warn(format === 'schematic' ? 'Connectivity sketch only: wires, buses, junctions and anchor markers. Symbol graphics, pin connectivity, label text and hierarchical child sheets are not rendered. Open KiCad or export SVG for a complete schematic.' : '2D layout sketch, not a manufacturing plot or DRC check. Pads are outlines; round-rect pads are simplified. Zones are boundaries, not copper fills. Text, 3D models, custom pads and advanced shapes are not rendered.');
  const width = (node: SExpr) => number(child(node, 'width') || child(child(node, 'stroke') || [], 'width'), 1, 0);
  const layer = (node: SExpr, fallback: string) => atom(child(node, 'layer'), 1, fallback);
  function graphics(node: SExpr, tx: Transform, fallback: string): boolean {
    const tag = String(node[0]).replace(/^(gr_|fp_)/, ''), on = layer(node, fallback), w = width(node);
    if (tag === 'line' || tag === 'segment') out.path([point(child(node, 'start')), point(child(node, 'end'))].map(tx), on, w);
    else if (tag === 'rect' || tag === 'rectangle') out.path(rectangle(point(child(node, 'start')), point(child(node, 'end'))).map(tx), on, w, true);
    else if (tag === 'circle') {
      const center = point(child(node, 'center')), end = point(child(node, 'end'));
      out.path(arcPoints(center, Math.hypot(end[0] - center[0], end[1] - center[1]), 0, Math.PI * 2).map(tx), on, w, true);
    } else if (tag === 'arc') {
      if (!child(node, 'mid')) { out.warn('Legacy angle-based arcs omitted; save in a recent KiCad version.'); return true; }
      out.path(throughArc(point(child(node, 'start')), point(child(node, 'mid')), point(child(node, 'end'))).map(tx), on, w);
    } else if (tag === 'poly' || tag === 'polyline' || tag === 'wire' || tag === 'bus') {
      const pts = children(child(node, 'pts') || [], 'xy').map(n => tx(point(n)));
      if (pts.length < 2) throw new Error('KiCad geometry is missing points.');
      out.path(pts, on, w, tag === 'poly');
    } else return false;
    return true;
  }
  function pad(node: SExpr, tx: Transform) {
    const shape = atom(node, 3), at = child(node, 'at'), center = tx(at ? point(at) : [0, 0, 0]), size = child(node, 'size');
    const x = number(size, 1), y = number(size, 2); if (x <= 0 || y <= 0) throw new Error('Invalid KiCad pad size.');
    const local = transform(center, number(at, 3, 0)); // Pad orientation is stored in board coordinates.
    const on = children(node, 'layers').map(n => n.slice(1).filter(v => typeof v === 'string').join(' / '))[0] || 'Pads';
    if (shape === 'circle' || shape === 'oval') {
      const radius = Math.min(x, y) / 2, dx = Math.max(0, (x - y) / 2), dy = Math.max(0, (y - x) / 2);
      const points: Point[] = Array.from({ length: 73 }, (_, i) => { const angle = i * Math.PI / 36, c = Math.cos(angle), s = Math.sin(angle); return [radius * c + (c >= 0 ? dx : -dx), radius * s + (s >= 0 ? dy : -dy), 0]; });
      out.path(points.map(local), on, 0, true);
    } else if (shape === 'rect' || shape === 'roundrect') out.path(rectangle([-x / 2, -y / 2, 0], [x / 2, y / 2, 0]).map(local), on, 0, true);
    else out.warn(`Unsupported ${shape || 'unknown'} pads omitted.`);
    const drill = child(node, 'drill');
    if (drill && atom(drill) !== 'oval') { const radius = number(drill) / 2; if (radius > 0) out.path(arcPoints(center, radius, 0, Math.PI * 2), 'Drill', 0, true); }
    else if (drill) out.warn('Slotted drills omitted.');
  }
  function footprint(node: SExpr) {
    const at = child(node, 'at'), tx = transform(at ? point(at) : [0, 0, 0], number(at, 3, 0));
    for (const item of children(node)) {
      if (item[0] === 'pad') pad(item, tx);
      else if (String(item[0]).startsWith('fp_') && !graphics(item, tx, 'Footprint')) out.warn('Some footprint graphics or text are omitted.');
    }
  }
  if (format === 'footprint') footprint(root);
  else for (const node of children(root)) {
    const tag = String(node[0]);
    if (format === 'schematic') {
      if (tag === 'wire' || tag === 'bus' || tag === 'polyline') graphics(node, identity, tag === 'bus' ? 'Buses' : 'Wires');
      else if (tag === 'junction') { const at = point(child(node, 'at')); out.path(arcPoints(at, number(child(node, 'diameter'), 1, 0) / 2 || .25, 0, Math.PI * 2), 'Junctions', 0, true); }
      else if (['symbol', 'label', 'global_label', 'hierarchical_label', 'no_connect'].includes(tag)) {
        const at = point(child(node, 'at')), delta = tag === 'symbol' ? 1.5 : .6, on = tag === 'symbol' ? 'Symbol anchors (not outlines)' : 'Label / no-connect anchors';
        out.path([[at[0] - delta, at[1], 0], [at[0] + delta, at[1], 0]], on);
        out.path([[at[0], at[1] - delta, 0], [at[0], at[1] + delta, 0]], on);
      } else if (tag === 'sheet') {
        const at = point(child(node, 'at')), size = point(child(node, 'size')); out.path(rectangle(at, [at[0] + size[0], at[1] + size[1], 0]), 'Child sheet boundaries', 0, true);
      }
    } else if (tag === 'footprint') footprint(node);
    else if (tag === 'via') {
      const center = point(child(node, 'at')); out.path(arcPoints(center, number(child(node, 'size')) / 2, 0, Math.PI * 2), 'Vias', 0, true);
      const drill = number(child(node, 'drill'), 1, 0); if (drill > 0) out.path(arcPoints(center, drill / 2, 0, Math.PI * 2), 'Drill', 0, true);
    } else if (tag === 'zone') {
      for (const polygon of children(node, 'polygon')) out.path(children(child(polygon, 'pts') || [], 'xy').map(point), layer(node, 'Zones') + ' zone boundary', 0, true);
    } else if ((tag.startsWith('gr_') || ['segment', 'arc'].includes(tag)) && !graphics(node, identity, 'Board')) out.warn('Some board graphics or text are omitted.');
    else if (tag === 'image') out.warn('Embedded images omitted.');
  }
  return out.finish();
}
