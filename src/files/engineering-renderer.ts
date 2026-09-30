import type { Drawing, Point } from './engineering';
export type Projection = 'XY' | 'XZ' | 'YZ';
export type DrawingView = { zoom: number; x: number; y: number; projection: Projection; hidden: Set<string> };
export const initialDrawingView = (): DrawingView => ({ zoom: 1, x: 0, y: 0, projection: 'XY', hidden: new Set() });
/** On-demand Canvas2D: bounded backing store, no animation loop, DOM or URL injection. */
export function drawEngineering(canvas: HTMLCanvasElement, drawing: Drawing, view: DrawingView): void {
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas 2D is unavailable. Use source view or download the original.');
  const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  const ratio = Math.min(2, window.devicePixelRatio || 1, 4096 / width, 4096 / height);
  canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const axes = view.projection === 'XY' ? [0, 1] : view.projection === 'XZ' ? [0, 2] : [1, 2];
  const project = (p: Point): [number, number] => [p[axes[0]], p[axes[1]] * (drawing.yDown && view.projection === 'XY' ? 1 : -1)];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of drawing.paths) for (const p of path.points) { const [x, y] = project(p); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const scale = Math.min(Math.max(1, width - 64) / Math.max(.001, maxX - minX), Math.max(1, height - 64) / Math.max(.001, maxY - minY)) * view.zoom;
  const screen = (p: Point): [number, number] => { const [x, y] = project(p); return [width / 2 + (x - (minX + maxX) / 2) * scale + view.x, height / 2 + (y - (minY + maxY) / 2) * scale + view.y]; };
  context.lineCap = 'round'; context.lineJoin = 'round';
  for (const path of drawing.paths) {
    if (view.hidden.has(path.layer)) continue;
    const index = drawing.layers.indexOf(path.layer);
    context.strokeStyle = `hsl(${(index * 137.508 + 170) % 360} 70% 72%)`;
    context.lineWidth = Math.max(1.25, Math.min(20, path.width * scale));
    context.setLineDash(path.layer === 'Rapid G0' ? [6, 4] : []); context.beginPath();
    path.points.forEach((p, i) => { const [x, y] = screen(p); if (i === 0) context.moveTo(x, y); else context.lineTo(x, y); });
    if (path.closed) context.closePath(); context.stroke();
  }
}
