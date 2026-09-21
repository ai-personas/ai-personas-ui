import { createSHA256 } from 'hash-wasm';

type Load = { url: string; headers: Record<string, string>; size: number; digest: string; limit: number; media: string };
self.onmessage = async ({ data }: MessageEvent<Load>) => {
  try {
    const hash = await createSHA256();
    const response = await fetch(data.url, { headers: data.headers, credentials: 'same-origin' });
    if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error(`Artifact could not be loaded (${response.status}).`); }
    const reader = response.body.getReader(), parts: Uint8Array<ArrayBuffer>[] = [];
    let bytes = 0, lastProgress = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes > data.limit || bytes > data.size) throw new Error('Preview exceeds the recorded size or browser preview limit.');
        hash.update(chunk.value); parts.push(chunk.value);
        if (performance.now() - lastProgress > 100) { self.postMessage({ bytes }); lastProgress = performance.now(); }
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (bytes !== data.size) throw new Error('Artifact size mismatch. No preview was rendered.');
    self.postMessage({ bytes, verifying: true });
    if (hash.digest('hex') !== data.digest) throw new Error('Artifact digest mismatch. No preview was rendered.');
    self.postMessage({ blob: new Blob(parts, { type: data.media }) });
  } catch (error) { self.postMessage({ error: (error as Error).message }); }
};
