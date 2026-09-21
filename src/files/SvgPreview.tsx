import DOMPurify from 'dompurify';
import { useEffect, useState } from 'preact/hooks';
import { Image } from './ImagePreview';
import type { PreviewFile } from './formats';

export default function SvgPreview({ file }: { file: PreviewFile }) {
  const [blob, setBlob] = useState<Blob>(), [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    void (async () => {
      // Bound DOM parsing independently of the compressed/raster image limit.
      if (file.blob.size > 2 * 1024 * 1024) throw new Error('This SVG is too large for a browser preview. Download it to open in an image application.');
      // SVG is always an image, never inline UI markup. Sanitizing also keeps
      // "Open image in new tab" from turning an image blob into active code.
      const clean = DOMPurify.sanitize(await file.blob.text(), { USE_PROFILES: { svg: true, svgFilters: true }, PARSER_MEDIA_TYPE: 'image/svg+xml', FORBID_TAGS: ['foreignObject'] });
      if (!clean) throw new Error('This SVG could not be read. Download the original to inspect it.');
      if (!disposed) setBlob(new Blob([clean], { type: 'image/svg+xml' }));
    })().catch(error => { if (!disposed) setError((error as Error).message); });
    return () => { disposed = true; };
  }, [file.blob]);
  return error ? <p role="alert">{error}</p> : blob ? <Image file={{ ...file, blob }}/> : <p role="status">Preparing SVG image…</p>;
}
