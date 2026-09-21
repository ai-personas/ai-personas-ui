import { useEffect, useState } from 'preact/hooks';
import { TEXT_PREVIEW_BYTES } from './formats';

export function useText(blob: Blob, media: string) {
  const [value, setValue] = useState<{ blob: Blob; text?: string; error?: string }>();
  useEffect(() => {
    let disposed = false;
    void blob.slice(0, TEXT_PREVIEW_BYTES).arrayBuffer().then(buffer => {
      const bytes = new Uint8Array(buffer);
      const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : /charset\s*=\s*["']?([^;\s"']+)/i.exec(media)?.[1] || 'utf-8';
      const text = new TextDecoder(encoding).decode(bytes, { stream: blob.size > TEXT_PREVIEW_BYTES });
      if (text.includes('\0')) throw new Error('This file contains binary data. Download it to open in its application.');
      if (!disposed) setValue({ blob, text });
    }).catch(error => { if (!disposed) setValue({ blob, error: (error as Error).message }); });
    return () => { disposed = true; };
  }, [blob, media]);
  return { text: value?.blob === blob ? value.text : undefined, error: value?.blob === blob ? value.error : undefined, truncated: blob.size > TEXT_PREVIEW_BYTES };
}
