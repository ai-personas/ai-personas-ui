// All decoding stays in this worker. Terminating it releases every read/decoder.
import { BlobReader, ZipReader, configure, type Entry } from '@zip.js/zip.js/lib/zip-core-native.js';
import { archivePath, ArchivePaths, MAX_ARCHIVE_ENTRIES, MAX_PREVIEW_BYTES, type ArchiveEntry } from './formats';
import { scanTar } from './tar';

configure({ useWebWorkers: false, chunkSize: 64 * 1024 });
let entries: Entry[] = [], controller: AbortController | undefined;
let archive: ZipReader<Blob> | undefined;
let tar: { blob: Blob; gzip: boolean; entries: ArchiveEntry[] } | undefined;
let generation = 0;
type Input = { kind: 'open'; blob: Blob; format?: 'zip' | 'tar' | 'tar_gzip' }
  | { kind: 'extract'; index: number; request: number; limit: number } | { kind: 'cancel' };
self.onmessage = async ({ data }: MessageEvent<Input>) => {
  if (data.kind === 'cancel') { controller?.abort(); return; }
  controller?.abort();
  const pending = new AbortController(), current = ++generation;
  controller = pending;
  const timer = setTimeout(() => pending.abort(new Error('Archive reading exceeded its browser time limit. Download the original to inspect it.')), 30_000);
  const request = data.kind === 'extract' ? data.request : undefined;
  try {
    if (data.kind === 'open') {
      const previous = archive; archive = undefined; entries = []; tar = undefined;
      await previous?.close(); pending.signal.throwIfAborted();
      if (data.blob.size > MAX_PREVIEW_BYTES) throw new Error('Archive exceeds the browser preview limit.');
      if (data.format === 'tar' || data.format === 'tar_gzip') {
        const gzip = data.format === 'tar_gzip';
        const result = await scanTar(data.blob, { gzip, signal: pending.signal });
        pending.signal.throwIfAborted();
        tar = { blob: data.blob, gzip, entries: result.entries };
        self.postMessage({ entries: result.entries });
      } else {
        const opened = new ZipReader(new BlobReader(data.blob), { useWebWorkers: false, checkSignature: true });
        archive = opened;
        const listed: ArchiveEntry[] = [], paths = new ArchivePaths();
        for await (const entry of opened.getEntriesGenerator()) {
          pending.signal.throwIfAborted();
          if (entries.length >= MAX_ARCHIVE_ENTRIES) throw new Error('This archive has more than 10,000 entries. Download it to browse in an archive application.');
          const path = archivePath(entry.filename);
          paths.add(path, entry.directory);
          if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0) throw new Error('This archive contains an invalid file size.');
          listed.push({ index: entries.length, path, directory: entry.directory, size: entry.uncompressedSize, encrypted: entry.encrypted });
          entries.push(entry);
        }
        pending.signal.throwIfAborted(); self.postMessage({ entries: listed });
      }
      return;
    }
    const limit = Math.min(data.limit, MAX_PREVIEW_BYTES);
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid preview limit.');
    let lastProgress = 0;
    const progress = (bytes: number) => {
      if (performance.now() - lastProgress > 100 && !pending.signal.aborted) {
        self.postMessage({ request, bytes }); lastProgress = performance.now();
      }
    };
    if (tar) {
      const selected = tar.entries[data.index];
      if (!selected || selected.directory) throw new Error('This archive file is unavailable.');
      const result = await scanTar(tar.blob, { gzip: tar.gzip, signal: pending.signal, selected, limit, progress });
      pending.signal.throwIfAborted(); self.postMessage({ request, blob: result.blob });
      return;
    }
    const entry = entries[data.index];
    if (!entry || entry.directory) throw new Error('This archive file is unavailable.');
    if (entry.encrypted) throw new Error('This file is password protected. Download the archive to open it with your password.');
    if (entry.uncompressedSize > limit) throw new Error('This file is too large for an in-browser preview. Download the archive to extract it.');
    const parts: Uint8Array<ArrayBuffer>[] = []; let bytes = 0;
    await entry.getData(new WritableStream<Uint8Array>({ write(chunk) {
      bytes += chunk.byteLength;
      if (bytes > limit || bytes > entry.uncompressedSize) throw new Error('Extracted file exceeds its recorded size or browser preview limit.');
      parts.push(new Uint8Array(chunk)); progress(bytes);
    } }), { signal: pending.signal, checkSignature: true, useWebWorkers: false });
    if (bytes !== entry.uncompressedSize) throw new Error('Extracted file size does not match the archive.');
    pending.signal.throwIfAborted(); self.postMessage({ request, blob: new Blob(parts) });
  } catch (error) {
    if (current === generation) {
      if (data.kind === 'open') {
        entries = []; tar = undefined;
        const previous = archive; archive = undefined;
        await previous?.close().catch(() => {});
      }
      // Cancellation of a selection is ignored by the component's request ID.
      // Timeouts remain visible, including while listing an archive.
      const reason = pending.signal.aborted ? pending.signal.reason : error;
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        self.postMessage({ request, error: reason instanceof Error ? reason.message : 'Archive reading failed.' });
      }
    }
  } finally {
    clearTimeout(timer);
    if (controller === pending) controller = undefined;
  }
};
