/** Bounded, read-only engineering sketches. No machine execution or external resources. */
export const ENGINEERING_BYTES = 4 * 1024 * 1024;
export const MAX_DRAW_POINTS = 100_000;
export const MAX_DRAW_PATHS = 10_000;
export type EngineeringFormat = 'dxf' | 'gcode' | 'pcb' | 'footprint' | 'schematic';
export type Point = [number, number, number];
export type DrawPath = { points: Point[]; layer: string; width: number; closed: boolean };
export type Drawing = { paths: DrawPath[]; layers: string[]; warnings: string[]; units: string; yDown: boolean };
const extensions: Record<string, EngineeringFormat> = { dxf: 'dxf', gcode: 'gcode', nc: 'gcode', tap: 'gcode', kicad_pcb: 'pcb', kicad_mod: 'footprint', kicad_sch: 'schematic' };
export function engineeringFormat(name: string): EngineeringFormat | undefined {
  const ext = name.split('.').at(-1)?.toLowerCase() || '';
  return Object.hasOwn(extensions, ext) ? extensions[ext] : undefined;
}
export const engineeringLabels: Record<EngineeringFormat, string> = { dxf: 'DXF drawing', gcode: 'G-code toolpath', pcb: 'KiCad PCB', footprint: 'KiCad footprint', schematic: 'KiCad schematic connectivity' };
export function engineeringAdvice(name: string): string {
  const ext = name.split('.').at(-1)?.toLowerCase() || '';
  if (['blend', 'blend1', 'blend2'].includes(ext)) return 'Blender projects need a static, uncompressed GLB, embedded glTF, OBJ or STL export for the 3D geometry viewer. Native .blend files and scripts are not executed.';
  if (['step', 'stp', 'iges', 'igs', 'brep', 'fcstd', 'sldprt', 'sldasm', '3dm', 'dwg', 'ifc', 'scad'].includes(ext)) return 'Native CAD geometry requires an application export: use STL or OBJ for a tessellated 3D view, or ASCII DXF for a supported 2D outline. Parametric features, assemblies and external references are not evaluated here.';
  if (['gbr', 'ger', 'gerber', 'gtl', 'gbl', 'gts', 'gbs', 'gto', 'gbo', 'drl', 'sch', 'brd'].includes(ext)) return 'Use KiCad to open this manufacturing or legacy electronics file and export SVG, or save as a modern .kicad_pcb or .kicad_sch file. Gerber polarity, aperture macros and drill programs are not interpreted by this viewer.';
  if (['fbx', 'usd', 'usda', 'usdc', 'usdz', '3mf'].includes(ext)) return 'Export a static, uncompressed, self-contained GLB, embedded glTF, OBJ or STL for the existing 3D geometry viewer.';
  return '';
}
export function finite(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Missing drawing coordinate.');
  if (typeof value === 'string' && !value.trim()) throw new Error('Empty drawing coordinate.');
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 10_000_000) throw new Error('Invalid or excessive drawing coordinate.');
  return n;
}
export class DrawingBuilder {
  readonly drawing: Drawing = { paths: [], layers: [], warnings: [], units: 'drawing units', yDown: false };
  private points = 0;
  warn(message: string) { if (!this.drawing.warnings.includes(message) && this.drawing.warnings.length < 30) this.drawing.warnings.push(message); }
  path(points: Point[], layer = 'Geometry', width = 0, closed = false) {
    if (points.length < 2) return;
    if (this.points + points.length > MAX_DRAW_POINTS || this.drawing.paths.length >= MAX_DRAW_PATHS) throw new Error('Drawing exceeds the 100,000-point / 10,000-path preview limit.');
    if (!Number.isFinite(width) || width < 0 || width > 10_000_000) throw new Error('Invalid drawing width.');
    for (const p of points) p.forEach(finite);
    this.points += points.length;
    layer = layer.slice(0, 128) || 'Geometry';
    if (!this.drawing.layers.includes(layer)) {
      if (this.drawing.layers.length >= 128) throw new Error('Drawing exceeds the 128-layer preview limit.');
      this.drawing.layers.push(layer);
    }
    this.drawing.paths.push({ points, layer, width, closed });
  }
  finish(): Drawing { if (!this.drawing.paths.length) throw new Error('No supported geometry found. Use source view or export SVG / STL in the authoring application.'); return this.drawing; }
}
export function arcPoints(center: Point, radius: number, start: number, sweep: number, zEnd = center[2]): Point[] {
  if (!Number.isFinite(radius) || radius <= 0 || radius > 10_000_000 || !Number.isFinite(start) || !Number.isFinite(sweep) || Math.abs(sweep) > Math.PI * 2 + 1e-8) throw new Error('Invalid circular arc.');
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 90)));
  return Array.from({ length: steps + 1 }, (_, i) => [center[0] + radius * Math.cos(start + sweep * i / steps), center[1] + radius * Math.sin(start + sweep * i / steps), center[2] + (zEnd - center[2]) * i / steps]);
}
const tau = Math.PI * 2;
export const positiveAngle = (angle: number) => ((angle % tau) + tau) % tau;
export function throughArc(a: Point, m: Point, b: Point): Point[] {
  const ax = m[0] - a[0], ay = m[1] - a[1], bx = b[0] - a[0], by = b[1] - a[1], d = 2 * (ax * by - ay * bx);
  if (Math.abs(d) < 1e-12) throw new Error('Degenerate three-point arc.');
  const c: Point = [a[0] + (by * (ax * ax + ay * ay) - ay * (bx * bx + by * by)) / d, a[1] + (ax * (bx * bx + by * by) - bx * (ax * ax + ay * ay)) / d, a[2]];
  const start = Math.atan2(a[1] - c[1], a[0] - c[0]), end = positiveAngle(Math.atan2(b[1] - c[1], b[0] - c[0]) - start), mid = positiveAngle(Math.atan2(m[1] - c[1], m[0] - c[0]) - start);
  return arcPoints(c, Math.hypot(a[0] - c[0], a[1] - c[1]), start, mid <= end ? end : end - tau);
}
