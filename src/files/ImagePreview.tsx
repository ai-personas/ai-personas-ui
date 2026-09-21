import { useState } from 'preact/hooks';
import { lazy } from 'preact/compat';
import { useObjectURL } from './useObjectURL';
import type { PreviewFile } from './formats';

const SvgPreview = lazy(() => import('./SvgPreview'));
export default function ImagePreview({ file }: { file: PreviewFile }) {
  return file.media === 'image/svg+xml' ? <SvgPreview file={file}/> : <Image file={file}/>;
}

export function Image({ file }: { file: PreviewFile }) {
  const url = useObjectURL(file.blob, file.media), [failed, setFailed] = useState(false);
  return failed ? <p role="alert">This image could not be decoded. Download the original to open it in an image application.</p>
    : url ? <img class="artifact-image" src={url} alt={file.name} decoding="async" onError={() => setFailed(true)}/> : <p role="status">Preparing image…</p>;
}
