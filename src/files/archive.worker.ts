// Native + JS fallback, entirely within our own worker. Disable the library's
// worker pool so terminating this worker releases every decoder and read.
import { BlobReader, ZipReader, configure, type Entry } from '@zip.js/zip.js/lib/zip-core-native.js';
import { archivePath, MAX_ARCHIVE_ENTRIES, MAX_PREVIEW_BYTES, type ArchiveEntry } from './formats';

configure({ useWebWorkers: false, chunkSize: 64 * 1024 });
let entries: Entry[] = [], controller: AbortController | undefined;
let archive: ZipReader<Blob> | undefined;
type Input = { kind: 'open'; blob: Blob } | { kind: 'extract'; index: number; request: number; limit: number } | { kind: 'cancel' };
self.onmessage = async ({ data }: MessageEvent<Input>) => {
  if (data.kind === 'cancel') { controller?.abort(); return; }
  if (data.kind === 'open') {
    try {
      archive = new ZipReader(new BlobReader(data.blob), { useWebWorkers: false, checkSignature: true });
      const listed: ArchiveEntry[] = [], paths = new Set<string>();
      for await (const entry of archive.getEntriesGenerator()) {
        if (entries.length >= MAX_ARCHIVE_ENTRIES) throw new Error('This archive has more than 10,000 entries. Download it to browse in an archive application.');
        const path = archivePath(entry.filename), key = (entry.directory ? 'folder:' : 'file:') + path;
        if (paths.has(key)) throw new Error('This archive contains duplicate file paths. Download it to choose which version to open.');
        if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0) throw new Error('This archive contains an invalid file size.');
        paths.add(key); listed.push({ index: entries.length, path, directory: entry.directory, size: entry.uncompressedSize, encrypted: entry.encrypted }); entries.push(entry);
      }
      self.postMessage({ entries: listed });
    } catch (error) { entries = []; await archive?.close(); archive = undefined; self.postMessage({ error: (error as Error).message }); }
    return;
  }
  controller?.abort(); const pending = new AbortController(); controller = pending;
  const request = data.request;
  try {
    const entry = entries[data.index];
    if (!entry || entry.directory) throw new Error('This archive file is unavailable.');
    if (entry.encrypted) throw new Error('This file is password protected. Download the archive to open it with your password.');
    const limit = Math.min(data.limit, MAX_PREVIEW_BYTES);
    if (!Number.isSafeInteger(limit) || limit < 0 || entry.uncompressedSize > limit) throw new Error('This file is too large for an in-browser preview. Download the archive to extract it.');
    const parts: Uint8Array<ArrayBuffer>[] = []; let bytes = 0, lastProgress = 0;
    await entry.getData(new WritableStream<Uint8Array>({ write(chunk) {
      bytes += chunk.byteLength;
      if (bytes > limit || bytes > entry.uncompressedSize) throw new Error('Extracted file exceeds its recorded size or browser preview limit.');
      parts.push(new Uint8Array(chunk));
      if (performance.now() - lastProgress > 100) { self.postMessage({ request, bytes }); lastProgress = performance.now(); }
    } }), { signal: pending.signal, checkSignature: true, useWebWorkers: false });
    if (bytes !== entry.uncompressedSize) throw new Error('Extracted file size does not match the archive.');
    if (!pending.signal.aborted) self.postMessage({ request, blob: new Blob(parts) });
  } catch (error) { if (!pending.signal.aborted) self.postMessage({ request, error: (error as Error).message }); }
  finally { if (controller === pending) controller = undefined; }
};
