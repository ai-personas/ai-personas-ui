/** Bounded sequential TAR reader. Indexing reads headers and skips file bodies;
 * only the selected file is retained. GZIP is streamed again for extraction.
 * No archive path is opened on a filesystem and no member is executed.
 * Supports regular files/directories, USTAR, local PAX and GNU long names.
 * Links, sparse files, devices and ambiguous names fail closed. */
import { archivePath, ArchivePaths, MAX_ARCHIVE_ENTRIES, MAX_PREVIEW_BYTES, type ArchiveEntry } from './formats.ts';

export const MAX_TAR_SCAN_BYTES = 512 * 1024 * 1024;
const BLOCK = 512, MAX_METADATA = 64 * 1024, MAX_HEADERS = MAX_ARCHIVE_ENTRIES * 3;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const invalid = (detail: string) => new Error('Cannot browse this TAR: ' + detail + '. Download the original for inspection.');

class Bytes {
  private chunk: Uint8Array = new Uint8Array();
  private offset = 0;
  private total = 0;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private aborted: () => void;
  private signal: AbortSignal;
  private maximum: number;
  constructor(stream: ReadableStream<Uint8Array>, signal: AbortSignal, maximum: number) {
    this.signal = signal; this.maximum = maximum;
    this.reader = stream.getReader();
    this.aborted = () => { void this.reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', this.aborted, { once: true });
  }
  private async available(): Promise<boolean> {
    this.signal.throwIfAborted();
    while (this.offset === this.chunk.length) {
      const next = await this.reader.read();
      this.signal.throwIfAborted();
      if (next.done) return false;
      this.total += next.value.byteLength;
      if (this.total > this.maximum) throw invalid('decompressed scan exceeds the browser limit');
      this.chunk = next.value; this.offset = 0;
    }
    return true;
  }
  async consume(size: number, receive?: (bytes: Uint8Array) => void): Promise<void> {
    for (let left = size; left > 0;) {
      if (!await this.available()) throw invalid('truncated member');
      const take = Math.min(left, this.chunk.length - this.offset);
      receive?.(this.chunk.subarray(this.offset, this.offset + take));
      this.offset += take; left -= take;
    }
    this.signal.throwIfAborted();
  }
  async read(size: number): Promise<Uint8Array> {
    const output = new Uint8Array(size); let offset = 0;
    await this.consume(size, chunk => { output.set(chunk, offset); offset += chunk.length; });
    return output;
  }
  async end(): Promise<void> {
    // Consume the entire stream: validates GZIP CRC/trailer and rejects appended
    // nonzero archives rather than silently hiding their members after TAR EOF.
    while (await this.available()) {
      if (this.chunk.subarray(this.offset).some(byte => byte !== 0)) throw invalid('nonzero data after end markers');
      this.offset = this.chunk.length;
    }
  }
  async close(): Promise<void> {
    this.signal.removeEventListener('abort', this.aborted);
    await this.reader.cancel().catch(() => {});
    this.reader.releaseLock();
  }
}

function text(bytes: Uint8Array): string {
  const zero = bytes.indexOf(0);
  return utf8.decode(zero < 0 ? bytes : bytes.subarray(0, zero));
}
function octal(bytes: Uint8Array): number {
  const value = text(bytes).trim();
  if (!/^[0-7]+$/.test(value)) throw invalid('invalid numeric field');
  const n = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(n) || n < 0) throw invalid('numeric field exceeds its bound');
  return n;
}
function memberSize(bytes: Uint8Array): number {
  if ((bytes[0] & 0x80) === 0) return octal(bytes);
  if (bytes[0] !== 0x80) throw invalid('negative or excessive base-256 size');
  let size = 0;
  for (const byte of bytes.subarray(1)) {
    size = size * 256 + byte;
    if (!Number.isSafeInteger(size)) throw invalid('member size exceeds its bound');
  }
  return size;
}
function checksum(header: Uint8Array): void {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
  if (octal(header.subarray(148, 156)) !== sum) throw invalid('header checksum mismatch');
}

function pax(bytes: Uint8Array): Map<string, string> {
  const result = new Map<string, string>();
  for (let offset = 0; offset < bytes.length;) {
    const space = bytes.indexOf(32, offset);
    if (space < offset || space - offset > 12) throw invalid('invalid PAX record length');
    const raw = utf8.decode(bytes.subarray(offset, space));
    if (!/^[1-9][0-9]*$/.test(raw)) throw invalid('invalid PAX record length');
    const length = Number(raw), end = offset + length;
    if (!Number.isSafeInteger(end) || end > bytes.length || end <= space + 2 || bytes[end - 1] !== 10) throw invalid('truncated PAX record');
    const record = utf8.decode(bytes.subarray(space + 1, end - 1)), equals = record.indexOf('=');
    if (equals <= 0) throw invalid('invalid PAX key');
    const key = record.slice(0, equals);
    if (result.has(key)) throw invalid('duplicate PAX key');
    if (/sparse/i.test(key) || ['linkpath', 'GNU.dumpdir', 'SCHILY.filetype'].includes(key)) throw invalid('unsupported extended member type');
    result.set(key, record.slice(equals + 1)); offset = end;
  }
  return result;
}

export type TarOptions = {
  gzip: boolean;
  signal: AbortSignal;
  selected?: ArchiveEntry;
  limit?: number;
  maximumScanBytes?: number;
  progress?: (bytes: number) => void;
};
export async function scanTar(blob: Blob, options: TarOptions): Promise<{ entries: ArchiveEntry[]; blob?: Blob }> {
  if (blob.size > MAX_PREVIEW_BYTES) throw invalid('archive exceeds the browser input limit');
  const maximum = options.maximumScanBytes ?? MAX_TAR_SCAN_BYTES;
  if (!Number.isSafeInteger(maximum) || maximum <= 0 || maximum > MAX_TAR_SCAN_BYTES) throw invalid('invalid scan limit');
  const limit = Math.min(options.limit ?? MAX_PREVIEW_BYTES, MAX_PREVIEW_BYTES);
  if (!Number.isSafeInteger(limit) || limit < 0) throw invalid('invalid extraction limit');
  options.signal.throwIfAborted();
  let stream: ReadableStream<Uint8Array> = blob.stream();
  if (options.gzip) {
    if (typeof DecompressionStream === 'undefined') throw invalid('this browser does not support GZIP decompression');
    stream = stream.pipeThrough(new DecompressionStream('gzip'));
  }
  const input = new Bytes(stream, options.signal, maximum), entries: ArchiveEntry[] = [], paths = new ArchivePaths();
  let attributes = new Map<string, string>(), longName: string | undefined, pendingMetadata = false;
  let selected: Blob | undefined, selectedBytes = 0;
  try {
    for (let count = 0; count <= MAX_HEADERS; count++) {
      if (count === MAX_HEADERS) throw invalid('too many headers');
      const header = await input.read(BLOCK);
      if (header.every(byte => byte === 0)) {
        if (pendingMetadata) throw invalid('extended header has no member');
        const second = await input.read(BLOCK);
        if (second.some(byte => byte !== 0)) throw invalid('missing second end marker');
        await input.end();
        if (options.selected && !selected) throw invalid('selected member is unavailable');
        return { entries, blob: selected };
      }
      checksum(header);
      const type = String.fromCharCode(header[156]), rawSize = memberSize(header.subarray(124, 136));
      if (rawSize > maximum) throw invalid('member exceeds the scan limit');
      if (['x', 'g', 'L'].includes(type)) {
        if (rawSize > MAX_METADATA) throw invalid('extended header is too large');
        const body = await input.read(rawSize);
        await input.consume((BLOCK - rawSize % BLOCK) % BLOCK);
        if (type === 'L') {
          if (longName !== undefined) throw invalid('duplicate long-name header');
          longName = text(body); pendingMetadata = true;
        } else {
          const values = pax(body);
          if (type === 'g') {
            // Global ownership/times are irrelevant to reading. Global path and
            // size would override unrelated files and are intentionally refused.
            if (values.has('path') || values.has('size')) throw invalid('global path or size override');
          } else {
            for (const [key, value] of values) {
              if (attributes.has(key)) throw invalid('duplicate local PAX override');
              attributes.set(key, value);
            }
            pendingMetadata = true;
          }
        }
        continue;
      }
      if (!['\0', '0', '5'].includes(type)) throw invalid('links, sparse files and special members are not previewable');
      let size = rawSize;
      if (attributes.has('size')) {
        const raw = attributes.get('size')!;
        if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw invalid('invalid extended size');
        size = Number(raw);
        if (!Number.isSafeInteger(size) || size > maximum) throw invalid('extended size exceeds the scan limit');
      }
      const directory = type === '5';
      if (directory && size !== 0) throw invalid('directory has a payload');
      const prefix = text(header.subarray(257, 263)) === 'ustar' ? text(header.subarray(345, 500)) : '';
      const name = text(header.subarray(0, 100));
      if (longName !== undefined && attributes.has('path') && attributes.get('path') !== longName) throw invalid('conflicting extended names');
      const rawPath = attributes.get('path') ?? longName ?? (prefix ? prefix + '/' + name : name);
      attributes = new Map(); longName = undefined; pendingMetadata = false;
      if (directory && /^(\.\/)*\.?\/?$/.test(rawPath) && rawPath.startsWith('.')) continue;
      const path = archivePath(rawPath);
      paths.add(path, directory);
      if (entries.length >= MAX_ARCHIVE_ENTRIES) throw invalid('more than 10,000 entries');
      const entry: ArchiveEntry = { index: entries.length, path, directory, size, encrypted: false };
      entries.push(entry);
      if (options.selected?.index === entry.index) {
        if (directory || path !== options.selected.path || size !== options.selected.size) throw invalid('selected identity changed');
        if (size > limit) throw invalid('selected file exceeds its preview limit');
        const parts: Uint8Array<ArrayBuffer>[] = [];
        await input.consume(size, chunk => {
          selectedBytes += chunk.length;
          if (selectedBytes > limit) throw invalid('extracted bytes exceed their limit');
          parts.push(new Uint8Array(chunk));
          options.progress?.(selectedBytes);
        });
        selected = new Blob(parts);
      } else {
        await input.consume(size);
      }
      await input.consume((BLOCK - size % BLOCK) % BLOCK);
    }
    throw invalid('missing end markers');
  } finally {
    await input.close();
  }
}
