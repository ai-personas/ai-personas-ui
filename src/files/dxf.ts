import { DrawingBuilder, arcPoints, finite, positiveAngle, type Drawing, type Point } from './engineering.ts';
type Pair = [number, string];
/** ASCII ENTITIES only. Unsupported entities are counted, never silently invented. */
export function parseDxf(text: string): Drawing {
  if (text.startsWith('AutoCAD Binary DXF')) throw new Error('Binary DXF needs an ASCII DXF export.');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/); while (lines.at(-1)?.trim() === '') lines.pop();
  if (lines.length % 2) throw new Error('Truncated DXF code/value pair.');
  const pairs: Pair[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    if (!/^\s*\d+\s*$/.test(lines[i])) throw new Error('Invalid DXF group code.');
    pairs.push([Number(lines[i]), lines[i + 1].trim()]);
  }
  if (!pairs.some(([c, v]) => c === 0 && v === 'EOF')) throw new Error('DXF is missing its EOF marker.');
  const out = new DrawingBuilder(); out.warn('2D outline preview only. Blocks, text, dimensions, fills, splines and non-default extrusion are not rendered.');
  let section = '', inEntities = false, skipped = 0;
  for (let i = 0; i < pairs.length;) {
    if (pairs[i][0] !== 0) { i++; continue; }
    const kind = pairs[i++][1], record: Pair[] = [];
    while (i < pairs.length && pairs[i][0] !== 0) record.push(pairs[i++]);
    const get = (code: number, fallback?: string) => record.find(p => p[0] === code)?.[1] ?? fallback;
    const n = (code: number, fallback?: string) => finite(get(code, fallback));
    if (kind === 'SECTION') { section = get(2, '')!; inEntities ||= section === 'ENTITIES'; continue; }
    if (kind === 'ENDSEC') { section = ''; continue; }
    if (kind === 'EOF') break;
    if (section !== 'ENTITIES') continue;
    const layer = get(8, '0')!, point = (base: number): Point => [n(base), n(base + 10), 0];
    if (n(210, '0') !== 0 || n(220, '0') !== 0 || n(230, '1') !== 1) { skipped++; continue; }
    if (kind === 'LINE') out.path([point(10), point(11)], layer);
    else if (kind === 'CIRCLE' || kind === 'ARC') {
      const start = kind === 'ARC' ? n(50) * Math.PI / 180 : 0;
      const sweep = kind === 'ARC' ? positiveAngle(n(51) * Math.PI / 180 - start) : Math.PI * 2;
      if (sweep === 0) throw new Error('Zero-sweep DXF arc.');
      out.path(arcPoints(point(10), n(40), start, sweep), layer, 0, kind === 'CIRCLE');
    } else if (kind === 'LWPOLYLINE') {
      const vertices: { p: Point; bulge: number }[] = []; let current: { p: Point; bulge: number } | undefined;
      for (const [code, value] of record) {
        if (code === 10) { current = { p: [finite(value), NaN, 0], bulge: 0 }; vertices.push(current); }
        else if (code === 20 && current) current.p[1] = finite(value);
        else if (code === 42 && current) current.bulge = finite(value);
      }
      if (vertices.length < 2 || n(90) !== vertices.length) throw new Error('Invalid DXF polyline vertex count.');
      const flags = n(70, '0'); if (!Number.isInteger(flags)) throw new Error('Invalid DXF polyline flags.');
      const closed = (flags & 1) !== 0;
      for (let j = 0; j < vertices.length - (closed ? 0 : 1); j++) {
        const { p: a, bulge } = vertices[j], b = vertices[(j + 1) % vertices.length].p;
        if (Math.abs(bulge) < 1e-12) { out.path([a, b], layer); continue; }
        const dx = b[0] - a[0], dy = b[1] - a[1], chord = Math.hypot(dx, dy);
        if (chord === 0) throw new Error('Degenerate DXF bulge.');
        const offset = (1 - bulge * bulge) / (4 * bulge), c: Point = [(a[0] + b[0]) / 2 - dy * offset, (a[1] + b[1]) / 2 + dx * offset, 0];
        out.path(arcPoints(c, chord * (1 + bulge * bulge) / (4 * Math.abs(bulge)), Math.atan2(a[1] - c[1], a[0] - c[0]), 4 * Math.atan(bulge)), layer);
      }
    } else skipped++;
  }
  if (!inEntities) throw new Error('DXF has no ENTITIES section.');
  if (skipped) out.warn(`${skipped} unsupported DXF entities omitted. This is a partial preview.`);
  return out.finish();
}
