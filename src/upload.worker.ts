import { createSHA256 } from 'hash-wasm';
self.onmessage = async ({ data: file }: MessageEvent<File>) => {
  try {
    const hash = await createSHA256(); const reader = file.stream().getReader(); let bytes = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; hash.update(value); bytes += value.length; self.postMessage({ bytes }); } }
    finally { reader.releaseLock(); }
    self.postMessage({ digest: hash.digest('hex') });
  } catch (e) { self.postMessage({ error: (e as Error).message }); }
};
