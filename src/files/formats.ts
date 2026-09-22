export type FileKind = 'markdown' | 'image' | 'text' | 'pdf' | 'audio' | 'video' | 'archive' | 'unsupported';
export type FileFormat = { kind: FileKind; media: string; label: string };
export type PreviewFile = { name: string; blob: Blob; media: string };

const extensions: Record<string, [FileKind, string, string]> = {
  md: ['markdown', 'text/markdown', 'Markdown document'], markdown: ['markdown', 'text/markdown', 'Markdown document'],
  svg: ['image', 'image/svg+xml', 'SVG image'], png: ['image', 'image/png', 'PNG image'], jpg: ['image', 'image/jpeg', 'JPEG image'], jpeg: ['image', 'image/jpeg', 'JPEG image'],
  webp: ['image', 'image/webp', 'WebP image'], gif: ['image', 'image/gif', 'GIF image'], avif: ['image', 'image/avif', 'AVIF image'], bmp: ['image', 'image/bmp', 'Bitmap image'], ico: ['image', 'image/x-icon', 'Icon'],
  tar: ['archive', 'application/x-tar', 'TAR archive'],
  tgz: ['archive', 'application/gzip', 'TAR.GZ archive'],
  zip: ['archive', 'application/zip', 'ZIP archive'], pdf: ['pdf', 'application/pdf', 'PDF document'],
  json: ['text', 'application/json', 'JSON file'], geojson: ['text', 'application/geo+json', 'GeoJSON file'],
  csv: ['text', 'text/csv', 'CSV file'], tsv: ['text', 'text/tab-separated-values', 'TSV file'],
  html: ['text', 'text/html', 'HTML source'], htm: ['text', 'text/html', 'HTML source'], xml: ['text', 'application/xml', 'XML source'],
  mp3: ['audio', 'audio/mpeg', 'Audio'], wav: ['audio', 'audio/wav', 'Audio'], ogg: ['audio', 'audio/ogg', 'Audio'], m4a: ['audio', 'audio/mp4', 'Audio'], flac: ['audio', 'audio/flac', 'Audio'],
  mp4: ['video', 'video/mp4', 'Video'], webm: ['video', 'video/webm', 'Video'], mov: ['video', 'video/quicktime', 'Video'],
};
const sourceExtensions = new Set('txt log py js jsx ts tsx mjs cjs rs c h cpp hpp cs java go rb sh bash zsh fish ps1 sql css scss sass less yaml yml toml ini cfg conf scad step stp stl obj mtl dxf ifc nc gcode tex r svelte vue'.split(' '));

/** Extensions fill missing/generic upload MIME types; authored HTML always
 * stays source text. Image, media and PDF elements use an explicit MIME type. */
export function fileFormat(name: string, media = ''): FileFormat {
  const mime = media.split(';', 1)[0].trim().toLowerCase();
  if (/\.tar\.gz$/i.test(name)) return { kind: 'archive', media: 'application/gzip', label: 'TAR.GZ archive' };
  const ext = name.split('.').at(-1)?.toLowerCase() || '';
  const known = Object.hasOwn(extensions, ext) ? extensions[ext] : undefined;
  if (known) return { kind: known[0], media: known[1], label: known[2] };
  const byMime = Object.values(extensions).find(row => row[1] === mime);
  if (byMime) return { kind: byMime[0], media: byMime[1], label: byMime[2] };
  if (['application/x-zip-compressed', 'application/x-zip'].includes(mime)) return { kind: 'archive', media: 'application/zip', label: 'ZIP archive' };
  if (['application/x-gzip', 'application/x-compressed-tar'].includes(mime)) return { kind: 'archive', media: 'application/gzip', label: 'TAR.GZ archive' };
  if (mime === 'text/x-markdown') return { kind: 'markdown', media: 'text/markdown', label: 'Markdown document' };
  if (mime.startsWith('text/') || /(?:\+json|\+xml)$/.test(mime) || ['application/javascript', 'application/x-yaml', 'application/toml'].includes(mime) || sourceExtensions.has(ext) || /^(readme|license|makefile|dockerfile)$/i.test(name.split('/').at(-1) || '')) {
    return { kind: 'text', media: mime || 'text/plain', label: sourceExtensions.has(ext) && ext !== 'txt' ? 'Source file' : 'Text file' };
  }
  return { kind: 'unsupported', media: mime || 'application/octet-stream', label: 'File' };
}

// Browser working-set limits only, never storage or original download limits.
export const MAX_PREVIEW_BYTES = 128 * 1024 * 1024;
export const TEXT_PREVIEW_BYTES = 128 * 1024;
export const MAX_ARCHIVE_ENTRIES = 10_000;
export const MAX_ARCHIVE_DEPTH = 4;
export function previewLimit(kind: FileKind, media = ''): number {
  return kind === 'unsupported' ? 0 : media === 'image/svg+xml' ? 2 * 1024 * 1024 : kind === 'image' ? 32 * 1024 * 1024 : MAX_PREVIEW_BYTES;
}

export function archivePath(value: string): string {
  const path = value.replaceAll('\\', '/').replace(/^(\.\/)+/, '');
  if (!path || path.length > 4096 || /[\u0000-\u001f\u007f]/.test(path) || path.startsWith('/') || /^[a-z]:/i.test(path) || path.split('/').some(part => part === '..')) throw new Error('This archive contains a file path that cannot be browsed safely. Download the original to inspect it.');
  const normalized = path.split('/').filter(part => part && part !== '.').join('/');
  if (!normalized || /^[a-z]:/i.test(normalized)) throw new Error('This archive contains an empty or unsafe file path. Download the original to inspect it.');
  return normalized;
}

export type ArchiveEntry = { index: number; path: string; directory: boolean; size: number; encrypted: boolean };
export type ArchiveItem = { path: string; name: string; directory: boolean; entry?: ArchiveEntry };
export function folderItems(entries: ArchiveEntry[], folder: string): ArchiveItem[] {
  const prefix = folder ? folder + '/' : '', items = new Map<string, ArchiveItem>();
  for (const entry of entries) {
    if (!entry.path.startsWith(prefix)) continue;
    const rest = entry.path.slice(prefix.length); if (!rest) continue;
    const [name, ...tail] = rest.split('/'), directory = tail.length > 0 || entry.directory;
    const path = prefix + name, key = (directory ? 'folder:' : 'file:') + path;
    if (!items.has(key)) items.set(key, { path, name, directory, entry: directory ? undefined : entry });
  }
  return [...items.values()].sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** A file and directory cannot occupy the same normalized path. Include implicit
 * parents so `a/b` cannot coexist with a regular file named `a`, in either order. */
export class ArchivePaths {
  private explicit = new Set<string>();
  private files = new Set<string>();
  private folders = new Set<string>();
  add(path: string, directory: boolean): void {
    if (this.explicit.has(path) || this.files.has(path) || (!directory && this.folders.has(path))) {
      throw new Error('This archive contains duplicate or conflicting paths. Download it for inspection.');
    }
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/');
      if (this.files.has(parent)) throw new Error('An archive file is also used as a folder.');
      this.folders.add(parent);
    }
    this.explicit.add(path);
    (directory ? this.folders : this.files).add(path);
  }
}

export function archiveFormat(name: string, media = ''): 'zip' | 'tar' | 'tar_gzip' {
  const format = fileFormat(name, media);
  if (format.media === 'application/x-tar') return 'tar';
  if (format.media === 'application/gzip') return 'tar_gzip';
  return 'zip';
}
