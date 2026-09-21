import { useEffect, useRef, useState } from 'preact/hooks';
import { useObjectURL } from './useObjectURL';
import type { PreviewFile } from './formats';

export default function MediaPreview({ file }: { file: PreviewFile }) {
  const url = useObjectURL(file.blob, file.media), ref = useRef<HTMLMediaElement>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = ref.current;
    return () => { if (media) { media.pause(); media.removeAttribute('src'); media.load(); } };
  }, []);
  if (failed) return <p role="alert">Your browser cannot play this file. Download the original to open it in a media application.</p>;
  const props = { ref: (element: HTMLMediaElement | null) => { ref.current = element; }, src: url || undefined, controls: true, preload: 'metadata' as const, 'aria-label': file.name, onError: () => setFailed(true) };
  return file.media.startsWith('video/') ? <video class="file-video" {...props}/> : <audio class="file-audio" {...props}/>;
}
