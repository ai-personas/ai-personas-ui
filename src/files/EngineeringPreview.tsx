import { lazy, Suspense } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PreviewFile } from './formats';
import { ENGINEERING_BYTES, engineeringFormat, type Drawing } from './engineering';
import { drawEngineering, initialDrawingView, type DrawingView, type Projection } from './engineering-renderer';
import './engineering-preview.css';
const TextPreview = lazy(() => import('./TextPreview'));
function DrawingScene({ drawing, name }: { drawing: Drawing; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null), view = useRef(initialDrawingView()), drag = useRef<{ id: number; x: number; y: number }>();
  const [state, setState] = useState(view.current), [error, setError] = useState('');
  function draw() { try { if (canvas.current) drawEngineering(canvas.current, drawing, view.current); } catch (error) { setError(error instanceof Error ? error.message : 'Could not draw this file.'); } }
  function update(patch: Partial<DrawingView>) { view.current = { ...view.current, ...patch }; view.current.zoom = Math.max(.25, Math.min(16, view.current.zoom)); setState({ ...view.current }); draw(); }
  useEffect(() => {
    view.current = initialDrawingView(); setState(view.current); setError(''); drag.current = undefined;
    const element = canvas.current; if (!element) return;
    const observer = new ResizeObserver(draw); observer.observe(element); draw();
    const wheel = (event: WheelEvent) => { if (document.activeElement !== element) return; event.preventDefault(); update({ zoom: view.current.zoom * Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .005) }); };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener('wheel', wheel); element.width = 0; element.height = 0; };
  }, [drawing]);
  return <section class="engineering-scene" aria-label={`Engineering preview of ${name}`}>
    <div class="engineering-toolbar" role="group" aria-label="Drawing controls">
      <button onClick={() => update(initialDrawingView())}>Reset drawing</button>
      <button aria-label="Zoom drawing out" disabled={state.zoom <= .25} onClick={() => update({ zoom: view.current.zoom / 1.2 })}>−</button>
      <output aria-label="Drawing zoom">{Math.round(state.zoom * 100)}%</output>
      <button aria-label="Zoom drawing in" disabled={state.zoom >= 16} onClick={() => update({ zoom: view.current.zoom * 1.2 })}>+</button>
      {!drawing.yDown && drawing.units === 'mm' && <label>Projection <select aria-label="Toolpath projection" value={state.projection} onChange={event => update({ ...initialDrawingView(), projection: event.currentTarget.value as Projection })}><option>XY</option><option>XZ</option><option>YZ</option></select></label>}
    </div>
    {error && <p role="alert">{error}</p>}
    <canvas ref={canvas} hidden={!!error} tabIndex={0} role="img" aria-label={`${name}: drawing. Drag or use arrow keys to pan; plus and minus to zoom; Home to reset.`}
      onKeyDown={event => {
        const key = event.key.toLowerCase(); if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '=', '-', 'home'].includes(key)) return;
        event.preventDefault();
        if (key === 'home') update(initialDrawingView());
        else if (key === '+' || key === '=') update({ zoom: view.current.zoom * 1.2 });
        else if (key === '-') update({ zoom: view.current.zoom / 1.2 });
        else update({ x: view.current.x + (key === 'arrowright' ? 25 : key === 'arrowleft' ? -25 : 0), y: view.current.y + (key === 'arrowdown' ? 25 : key === 'arrowup' ? -25 : 0) });
      }}
      onPointerDown={event => { if (event.button !== 0 || drag.current) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; }}
      onPointerMove={event => { const start = drag.current; if (!start || start.id !== event.pointerId) return; update({ x: view.current.x + event.clientX - start.x, y: view.current.y + event.clientY - start.y }); drag.current = { id: start.id, x: event.clientX, y: event.clientY }; }}
      onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }} onLostPointerCapture={() => { drag.current = undefined; }}/>
    <p class="engineering-caption">{drawing.paths.length.toLocaleString()} paths · {drawing.layers.length} layers · {drawing.units} · {state.projection} projection. Drag to pan; focus to use scroll zoom. Stroke widths may be clamped for legibility.</p>
    <fieldset class="engineering-layers"><legend>Visible layers</legend>{drawing.layers.map(layer => <label key={layer}><input type="checkbox" checked={!state.hidden.has(layer)} onChange={event => { const hidden = new Set(view.current.hidden); if (event.currentTarget.checked) hidden.delete(layer); else hidden.add(layer); update({ hidden }); }}/>{layer}</label>)}</fieldset>
  </section>;
}
export default function EngineeringPreview({ file }: { file: PreviewFile }) {
  const format = engineeringFormat(file.name), [source, setSource] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; format: string; drawing?: Drawing; error?: string }>();
  useEffect(() => {
    setSource(false); setResult(undefined); let disposed = false, worker: Worker | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { clearTimeout(timer); worker?.terminate(); worker = undefined; };
    const fail = (error: string) => { stop(); if (!disposed) setResult({ blob: file.blob, format: format || '', error }); };
    if (!format || file.blob.size > ENGINEERING_BYTES) { fail('Engineering preview exceeds 4 MiB or has an unsupported format. Use source view or download the original.'); return; }
    try {
      worker = new Worker(new URL('./engineering.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => { stop(); if (!disposed) setResult({ blob: file.blob, format, ...data }); };
      worker.onerror = () => fail('The drawing worker stopped. Use source view or download the original.');
      worker.onmessageerror = () => fail('The drawing worker returned unreadable data.');
      timer = setTimeout(() => fail('Drawing parsing exceeded ten seconds. Download the original to inspect it.'), 10_000);
      void file.blob.arrayBuffer().then(buffer => { if (!disposed && worker) worker.postMessage({ buffer, format }, [buffer]); }).catch(() => fail('Could not read the drawing bytes.'));
    } catch { fail('The drawing worker could not start. Use source view or download the original.'); }
    return () => { disposed = true; stop(); };
  }, [file.blob, format]);
  const current = result?.blob === file.blob && result.format === format ? result : undefined;
  return <div class="engineering-preview">
    <p class="notice">Read-only engineering sketch · partial format support · not for manufacturing approval. Original bytes are unchanged; no scripts, machine commands or external references are executed.</p>
    <button aria-pressed={source} onClick={() => setSource(!source)}>{source ? 'Show drawing' : 'Show source'}</button>
    {source ? <Suspense fallback={<p role="status">Reading source…</p>}><TextPreview file={file}/></Suspense>
      : !current ? <p role="status">Reading engineering geometry…</p>
      : current.error ? <p role="alert">{current.error}</p>
      : current.drawing ? <><div class="engineering-warnings" aria-label="Preview limitations">{current.drawing.warnings.map(warning => <p key={warning}>{warning}</p>)}</div><DrawingScene drawing={current.drawing} name={file.name}/></>
      : <p role="alert">No drawing returned. Use source view or download the original.</p>}
  </div>;
}
