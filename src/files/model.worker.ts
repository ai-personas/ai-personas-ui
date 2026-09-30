import { parseMesh, type ModelType } from './mesh.ts';
import { parseGltf } from './gltf.ts';

self.onmessage = ({ data }: MessageEvent<{ buffer: ArrayBuffer; format: string }>) => {
  try {
    const mesh = data.format === 'glb' || data.format === 'gltf' ? parseGltf(data.buffer, data.format === 'glb') : parseMesh(data.buffer, data.format as ModelType);
    self.postMessage({ mesh }, { transfer: [mesh.positions.buffer, mesh.normals.buffer] });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'The model could not be read.' }); }
};
