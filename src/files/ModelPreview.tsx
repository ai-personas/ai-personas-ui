import { useEffect, useRef, useState } from 'preact/hooks';
import { fileFormat, type PreviewFile } from './formats';
import { MODEL_BYTES, type Mesh } from './mesh';
import { defaultModelView, modelRenderer, type ModelView } from './model-renderer';
import './extended-preview.css';

function ModelScene({ mesh, name }: { mesh: Mesh; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null), view = useRef(defaultModelView());
  const renderer = useRef<ReturnType<typeof modelRenderer>>();
  const [error, setError] = useState(''), [zoom, setZoom] = useState(100), [wireframe, setWireframe] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number }>();
  function update(patch: Partial<ModelView>) {
    view.current = { ...view.current, ...patch };
    view.current.zoom = Math.max(.25, Math.min(8, view.current.zoom));
    view.current.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, view.current.pitch));
    renderer.current?.draw(view.current); setZoom(Math.round(view.current.zoom * 100)); setWireframe(view.current.wireframe);
  }
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    let observer: ResizeObserver | undefined, alive = true;
    const lost = (event: Event) => { event.preventDefault(); if (alive) setError('The graphics context was lost. Reopen this file or download the original.'); };
    const wheel = (event: WheelEvent) => { if (document.activeElement !== element) return; event.preventDefault(); update({ zoom: view.current.zoom * Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .005) }); };
    try {
      renderer.current = modelRenderer(element, mesh); renderer.current.draw(view.current);
      observer = new ResizeObserver(() => renderer.current?.draw(view.current)); observer.observe(element);
      element.addEventListener('webglcontextlost', lost); element.addEventListener('wheel', wheel, { passive: false });
    } catch (error) { setError(error instanceof Error ? error.message : 'The model could not be rendered.'); }
    return () => { alive = false; observer?.disconnect(); element.removeEventListener('webglcontextlost', lost); element.removeEventListener('wheel', wheel); renderer.current?.dispose(); renderer.current = undefined; };
  }, [mesh]);
  if (error) return <p role="alert">{error}</p>;
  return <section class="model-scene" aria-label={`3D preview of ${name}`}>
    <div class="model-toolbar" role="group" aria-label="3D view controls">
      <button onClick={() => update(defaultModelView())}>Reset view</button>
      <button aria-label="Rotate left" onClick={() => update({ yaw: view.current.yaw - .2 })}>↶</button>
      <button aria-label="Rotate right" onClick={() => update({ yaw: view.current.yaw + .2 })}>↷</button>
      <button aria-label="Zoom out" disabled={zoom <= 25} onClick={() => update({ zoom: view.current.zoom / 1.2 })}>−</button>
      <output aria-label="Model zoom">{zoom}%</output>
      <button aria-label="Zoom in" disabled={zoom >= 800} onClick={() => update({ zoom: view.current.zoom * 1.2 })}>+</button>
      <label><input type="checkbox" checked={wireframe} onChange={event => update({ wireframe: event.currentTarget.checked })}/>Wireframe</label>
    </div>
    <canvas ref={canvas} tabIndex={0} role="img" aria-label={`${name}: interactive 3D geometry. Drag or use arrow keys to rotate; plus and minus to zoom; Home to reset; W for wireframe.`}
      onKeyDown={event => {
        const key = event.key.toLowerCase();
        if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '=', '-', 'home', 'w'].includes(key)) return;
        event.preventDefault();
        if (key === 'home') update(defaultModelView());
        else if (key === 'w') update({ wireframe: !view.current.wireframe });
        else if (key === '+' || key === '=') update({ zoom: view.current.zoom * 1.2 });
        else if (key === '-') update({ zoom: view.current.zoom / 1.2 });
        else update({ yaw: view.current.yaw + (key === 'arrowright' ? .15 : key === 'arrowleft' ? -.15 : 0), pitch: view.current.pitch + (key === 'arrowdown' ? .15 : key === 'arrowup' ? -.15 : 0) });
      }}
      onPointerDown={event => { if (event.button !== 0 || drag.current) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; }}
      onPointerMove={event => { const start = drag.current; if (!start || start.id !== event.pointerId) return; update({ yaw: view.current.yaw + (event.clientX - start.x) * .008, pitch: view.current.pitch + (event.clientY - start.y) * .008 }); drag.current = { id: start.id, x: event.clientX, y: event.clientY }; }}
      onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }} onLostPointerCapture={() => { drag.current = undefined; }}/>
    <p class="model-caption">{mesh.triangles.toLocaleString()} triangles · {mesh.vertices.toLocaleString()} vertices · Drag to orbit. Focus the canvas to use scroll zoom or keyboard controls.</p>
  </section>;
}

export default function ModelPreview({ file }: { file: PreviewFile }) {
  const [result, setResult] = useState<{ blob: Blob; format: string; mesh?: Mesh; error?: string }>();
  const media = fileFormat(file.name, file.media).media;
  const format = ({ 'model/stl': 'stl', 'model/obj': 'obj', 'model/ply': 'ply', 'model/off': 'off', 'model/gltf+json': 'gltf', 'model/gltf-binary': 'glb' } as Record<string, string>)[media];
  useEffect(() => {
    let disposed = false, worker: Worker | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { clearTimeout(timer); worker?.terminate(); worker = undefined; };
    const fail = (error: string) => { stop(); if (!disposed) setResult({ blob: file.blob, format, error }); };
    if (!format || file.blob.size > MODEL_BYTES) { fail('This 3D format cannot be previewed, or the file exceeds 16 MiB. Download the original.'); return; }
    try {
      worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => { stop(); if (!disposed) setResult({ blob: file.blob, format, ...data }); };
      worker.onerror = () => fail('The model reader stopped. Reopen the file or download the original.');
      timer = setTimeout(() => fail('The model took too long to parse. Download it to inspect in a 3D application.'), 10_000);
      void file.blob.arrayBuffer().then(buffer => { if (!disposed && worker) worker.postMessage({ buffer, format }, [buffer]); }).catch(() => fail('Could not read the model bytes.'));
    } catch { fail('The model worker could not start. Download the original.'); }
    return () => { disposed = true; stop(); };
  }, [file.blob, format]);
  const current = result?.blob === file.blob && result.format === format ? result : undefined;
  return <div class="model-preview">
    <p class="notice">Geometry-only preview · textures, materials, vertex colors and animations are not rendered. Skinned, compressed and morph-target models require a static mesh export.</p>
    {!current ? <p role="status">Reading 3D geometry…</p> : current.error ? <p role="alert">{current.error}</p> : current.mesh ? <ModelScene mesh={current.mesh} name={file.name}/> : <p role="alert">The model reader returned no geometry.</p>}
  </div>;
}
