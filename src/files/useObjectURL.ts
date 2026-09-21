import { useEffect, useState } from 'preact/hooks';

export function useObjectURL(blob: Blob, media: string): string {
  const [value, setValue] = useState<{ blob: Blob; media: string; url: string }>();
  useEffect(() => {
    const url = URL.createObjectURL(blob.slice(0, blob.size, media));
    setValue({ blob, media, url });
    return () => URL.revokeObjectURL(url);
  }, [blob, media]);
  return value?.blob === blob && value.media === media ? value.url : '';
}
