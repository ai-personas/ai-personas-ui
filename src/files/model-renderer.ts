import type { Mesh } from './mesh';

export type ModelView = { yaw: number; pitch: number; zoom: number; wireframe: boolean };
export const defaultModelView = (): ModelView => ({ yaw: -0.55, pitch: 0.35, zoom: 1, wireframe: false });

/** On-demand WebGL drawing: no perpetual animation loop or third-party runtime. */
export function modelRenderer(canvas: HTMLCanvasElement, mesh: Mesh) {
  const context = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false });
  if (!context) throw new Error('WebGL is unavailable. Enable hardware acceleration or download the model.');
  const gl: WebGLRenderingContext = context;
  const buffers: WebGLBuffer[] = [], shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null, disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; for (const b of buffers) gl.deleteBuffer(b); for (const s of shaders) gl.deleteShader(s); if (program) gl.deleteProgram(program); gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  try {
    const shader = (type: number, source: string) => {
      const value = gl.createShader(type); if (!value) throw new Error('Could not allocate a model shader.'); shaders.push(value);
      gl.shaderSource(value, source); gl.compileShader(value); if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error('The browser could not compile the model shader.'); return value;
    };
    program = gl.createProgram(); if (!program) throw new Error('Could not allocate a model renderer.');
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `attribute vec3 position; attribute vec3 normal;
      uniform vec2 angles; uniform vec2 scale; varying vec3 shading;
      void main() {
        float cy=cos(angles.x), sy=sin(angles.x), cp=cos(angles.y), sp=sin(angles.y);
        mat3 yaw=mat3(cy,0.,-sy,0.,1.,0.,sy,0.,cy);
        mat3 pitch=mat3(1.,0.,0.,0.,cp,sp,0.,-sp,cp);
        vec3 p=pitch*yaw*position; shading=pitch*yaw*normal;
        gl_Position=vec4(p.xy*scale,-p.z/8.,1.);
      }`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `precision mediump float; varying vec3 shading; uniform bool wire;
      void main() { float light=.35+.65*abs(dot(normalize(shading),normalize(vec3(.4,.7,1.))));
      gl_FragColor=vec4(wire?vec3(.73,.88,.94):vec3(.25,.67,.78)*light,1.); }`));
    gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The browser could not link the model shaders.'); gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'position'), normal = gl.getAttribLocation(program, 'normal');
    const angles = gl.getUniformLocation(program, 'angles'), scale = gl.getUniformLocation(program, 'scale'), wire = gl.getUniformLocation(program, 'wire');
    function buffer(data: Float32Array) { const value = gl.createBuffer(); if (!value) throw new Error('Could not allocate model geometry.'); buffers.push(value); gl.bindBuffer(gl.ARRAY_BUFFER, value); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return value; }
    const positions = buffer(mesh.positions), normals = buffer(mesh.normals);
    const edges = new Float32Array(mesh.triangles * 18);
    for (let triangle = 0; triangle < mesh.triangles; triangle++) {
      const order = [0, 1, 1, 2, 2, 0];
      for (let i = 0; i < 6; i++) edges.set(mesh.positions.subarray(triangle * 9 + order[i] * 3, triangle * 9 + order[i] * 3 + 3), triangle * 18 + i * 3);
    }
    const lines = buffer(edges); if (gl.getError() !== gl.NO_ERROR) throw new Error('The model exceeds available graphics memory.');
    const radius = Math.max(1, Math.sqrt(3));
    function draw(view: ModelView) {
      if (disposed || gl.isContextLost()) return;
      const rect = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.min(2048, Math.round(rect.width * ratio))), height = Math.max(1, Math.min(1536, Math.round(rect.height * ratio)));
      if (canvas.width !== width) canvas.width = width; if (canvas.height !== height) canvas.height = height;
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(.055, .075, .1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(program);
      const aspect = canvas.width / canvas.height, zoom = Math.max(.25, Math.min(8, view.zoom)) * .9 / radius;
      gl.uniform2f(scale, zoom / Math.max(1, aspect), zoom * Math.min(1, aspect)); gl.uniform2f(angles, view.yaw, view.pitch); gl.uniform1i(wire, Number(view.wireframe));
      gl.enableVertexAttribArray(position); gl.bindBuffer(gl.ARRAY_BUFFER, view.wireframe ? lines : positions); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
      if (view.wireframe) { gl.disableVertexAttribArray(normal); gl.vertexAttrib3f(normal, 0, 0, 1); }
      else { gl.enableVertexAttribArray(normal); gl.bindBuffer(gl.ARRAY_BUFFER, normals); gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 0, 0); }
      gl.drawArrays(view.wireframe ? gl.LINES : gl.TRIANGLES, 0, mesh.triangles * (view.wireframe ? 6 : 3));
    }
    return { draw, dispose };
  } catch (error) { dispose(); throw error; }
}
